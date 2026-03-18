import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Copy, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Student, Period } from '../lib/database.types';

interface CopyToPeriodModalProps {
  student: Student;
  currentPeriod: Period;
  onClose: () => void;
}

type Status = 'idle' | 'loading' | 'success' | 'error';

export function CopyToPeriodModal({ student, currentPeriod, onClose }: CopyToPeriodModalProps) {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [targetPeriodId, setTargetPeriodId] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [copiedStudentName, setCopiedStudentName] = useState('');

  useEffect(() => {
    loadPeriods();
  }, []);

  const loadPeriods = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('periods')
      .select('*')
      .eq('user_id', user.id)
      .order('name');
    // Exclure la période courante
    setPeriods((data || []).filter(p => p.id !== currentPeriod.id));
  };

  const handleCopy = async () => {
    if (!targetPeriodId) return;
    setStatus('loading');
    setErrorMsg('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non connecté');

      const targetPeriod = periods.find(p => p.id === targetPeriodId);

      // 1. Vérifier si l'élève existe déjà dans la période cible
      const { data: existing } = await supabase
        .from('students')
        .select('id')
        .eq('period_id', targetPeriodId)
        .eq('first_name', student.first_name)
        .eq('last_name', student.last_name)
        .maybeSingle();

      let targetStudentId: string;

      if (existing) {
        // L'élève existe déjà → on met à jour ses photos et on remplace ses créneaux
        targetStudentId = existing.id;
        await supabase.from('students').update({
          photo_student_url: student.photo_student_url,
          photo_teacher_url: student.photo_teacher_url,
          photo_coordo_url:  student.photo_coordo_url,
          photo_aesh_url:    student.photo_aesh_url,
          include_vie_scolaire_in_percentages: student.include_vie_scolaire_in_percentages,
        }).eq('id', targetStudentId);

        // Supprimer les anciens créneaux
        await supabase.from('events').delete().eq('student_id', targetStudentId);
      } else {
        // Créer le nouvel élève dans la période cible
        const { data: newStudent, error: createError } = await supabase
          .from('students')
          .insert({
            user_id: user.id,
            period_id: targetPeriodId,
            first_name: student.first_name,
            last_name: student.last_name,
            photo_student_url: student.photo_student_url,
            photo_teacher_url: student.photo_teacher_url,
            photo_coordo_url:  student.photo_coordo_url,
            photo_aesh_url:    student.photo_aesh_url,
            include_vie_scolaire_in_percentages: student.include_vie_scolaire_in_percentages,
          } as any)
          .select()
          .single();

        if (createError) throw createError;
        targetStudentId = newStudent.id;
      }

      // 2. Copier les créneaux
      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .eq('student_id', student.id);

      if (eventsError) throw eventsError;

      if (events && events.length > 0) {
        const eventsToInsert = events.map(({ id, created_at, student_id, ...rest }) => ({
          ...rest,
          student_id: targetStudentId,
        }));
        const { error: insertError } = await supabase
          .from('events')
          .insert(eventsToInsert as any);
        if (insertError) throw insertError;
      }

      setCopiedStudentName(`${student.first_name} ${student.last_name} → ${targetPeriod?.name}`);
      setStatus('success');
    } catch (err: any) {
      console.error('Erreur duplication:', err);
      setErrorMsg(err.message || 'Erreur inconnue');
      setStatus('error');
    }
  };

  const modal = (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">

        {/* En-tête */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-100 p-2 rounded-xl">
              <Copy className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">Dupliquer vers une période</h2>
              <p className="text-sm text-gray-500">{student.first_name} {student.last_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {status === 'success' ? (
          <div className="text-center py-6">
            <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-3" />
            <p className="text-gray-800 font-semibold text-lg mb-1">Duplication réussie !</p>
            <p className="text-gray-500 text-sm mb-5">{copiedStudentName}</p>
            <p className="text-xs text-gray-400 mb-5">
              Les créneaux et photos ont été copiés vers la nouvelle période.
            </p>
            <button
              onClick={onClose}
              className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors"
            >
              Fermer
            </button>
          </div>
        ) : (
          <>
            {/* Ce qui sera copié */}
            <div className="bg-indigo-50 rounded-xl p-4 mb-5">
              <p className="text-sm font-semibold text-indigo-800 mb-2">Ce qui sera copié :</p>
              <ul className="text-sm text-indigo-700 space-y-1">
                <li>✅ Tous les créneaux ({student.first_name})</li>
                <li>✅ Les photos (élève, enseignant, coordo, AESH)</li>
                <li className="text-indigo-400">- Si l'élève existe déjà dans la période cible, ses créneaux seront remplacés</li>
              </ul>
            </div>

            {/* Sélection période */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Période de destination *
              </label>
              {periods.length === 0 ? (
                <p className="text-sm text-gray-400 italic">Aucune autre période disponible.</p>
              ) : (
                <div className="grid grid-cols-5 gap-2">
                  {periods.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setTargetPeriodId(p.id)}
                      className={`py-3 rounded-xl border-2 font-bold text-sm transition-colors ${
                        targetPeriodId === p.id
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'bg-white border-gray-200 text-gray-700 hover:border-indigo-300 hover:bg-indigo-50'
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {status === 'error' && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{errorMsg}</p>
              </div>
            )}

            {/* Boutons */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleCopy}
                disabled={!targetPeriodId || status === 'loading' || periods.length === 0}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status === 'loading' ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Copie en cours…
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Dupliquer
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
