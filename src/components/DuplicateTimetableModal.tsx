import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Copy, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Student, Event } from '../lib/database.types';

interface DuplicateTimetableModalProps {
  sourceStudent: Student;
  periodId: string;
  onClose: () => void;
  onDuplicate: () => void;
}

export function DuplicateTimetableModal({
  sourceStudent,
  periodId,
  onClose,
  onDuplicate,
}: DuplicateTimetableModalProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [studentsWithEvents, setStudentsWithEvents] = useState<Set<string>>(new Set());
  const [structureOnly, setStructureOnly] = useState(false);
  const [replaceExisting, setReplaceExisting] = useState(true);
  const [loading, setLoading] = useState(true);
  const [duplicating, setDuplicating] = useState(false);

  useEffect(() => {
    loadStudents();
  }, [periodId, sourceStudent.id]);

  const loadStudents = async () => {
    setLoading(true);

    const { data: allStudents, error: studentsError } = await supabase
      .from('students')
      .select('*')
      .eq('period_id', periodId)
      .neq('id', sourceStudent.id)
      .order('last_name', { ascending: true });

    if (studentsError) {
      console.error('Error loading students:', studentsError);
      setLoading(false);
      return;
    }

    setStudents(allStudents || []);

    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('student_id')
      .in('student_id', (allStudents || []).map(s => s.id));

    if (!eventsError && events) {
      const studentIdsWithEvents = new Set(events.map(e => e.student_id));
      setStudentsWithEvents(studentIdsWithEvents);
    }

    setLoading(false);
  };

  const toggleStudent = (studentId: string) => {
    const newSet = new Set(selectedStudentIds);
    if (newSet.has(studentId)) {
      newSet.delete(studentId);
    } else {
      newSet.add(studentId);
    }
    setSelectedStudentIds(newSet);
  };

  const handleDuplicate = async () => {
    if (selectedStudentIds.size === 0) return;

    setDuplicating(true);

    try {
      const { data: sourceEvents, error: fetchError } = await supabase
        .from('events')
        .select('*')
        .eq('student_id', sourceStudent.id);

      if (fetchError) throw fetchError;

      for (const targetStudentId of Array.from(selectedStudentIds)) {
        if (replaceExisting) {
          const { error: deleteError } = await supabase
            .from('events')
            .delete()
            .eq('student_id', targetStudentId);

          if (deleteError) throw deleteError;
        }

        const eventsToInsert = (sourceEvents || []).map((event: Event) => {
          const newEvent: Partial<Event> = {
            student_id: targetStudentId,
            day_of_week: event.day_of_week,
            start_time: event.start_time,
            end_time: event.end_time,
            label: event.label,
            location: event.location,
          };

          if (structureOnly) {
            const isVieScolaire =
              event.label?.toLowerCase().includes('récré') ||
              event.label?.toLowerCase().includes('cantine') ||
              event.type === 'VIE_SCOLAIRE';

            newEvent.type = isVieScolaire ? 'VIE_SCOLAIRE' : 'CLASSE';
            newEvent.aesh = false;
          } else {
            newEvent.type = event.type;
            newEvent.aesh = event.aesh;
          }

          return newEvent;
        });

        const { error: insertError } = await supabase
          .from('events')
          .insert(eventsToInsert);

        if (insertError) throw insertError;
      }

      onDuplicate();
      onClose();
    } catch (error) {
      console.error('Error duplicating timetable:', error);
      alert('Erreur lors de la duplication de l\'emploi du temps');
    } finally {
      setDuplicating(false);
    }
  };

  const hasWarnings = Array.from(selectedStudentIds).some(id => studentsWithEvents.has(id));

  const modalContent = (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4" style={{ zIndex: 99999 }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Copy className="w-6 h-6 text-blue-600" />
            <h2 className="text-2xl font-bold text-gray-800">
              Dupliquer l'emploi du temps
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-800">
              <strong>Source :</strong> {sourceStudent.first_name} {sourceStudent.last_name}
            </p>
            <p className="text-xs text-blue-600 mt-1">
              Sélectionnez les élèves vers lesquels dupliquer cet emploi du temps
            </p>
          </div>

          <div className="mb-6">
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200 mb-3">
              <input
                type="checkbox"
                id="structureOnly"
                checked={structureOnly}
                onChange={(e) => setStructureOnly(e.target.checked)}
                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
              />
              <label htmlFor="structureOnly" className="text-sm font-medium text-gray-700 cursor-pointer flex-1">
                <div>Dupliquer la structure uniquement</div>
                <div className="text-xs text-gray-500 mt-1">
                  Copier les horaires et labels, mais réinitialiser les types en CLASSE (sauf Récré/Cantine)
                </div>
              </label>
            </div>

            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <input
                type="checkbox"
                id="replaceExisting"
                checked={replaceExisting}
                onChange={(e) => setReplaceExisting(e.target.checked)}
                className="w-5 h-5 text-red-600 rounded focus:ring-red-500"
              />
              <label htmlFor="replaceExisting" className="text-sm font-medium text-gray-700 cursor-pointer flex-1">
                <div>Remplacer l'emploi du temps existant</div>
                <div className="text-xs text-gray-500 mt-1">
                  Si décoché, les créneaux seront ajoutés à l'emploi du temps existant
                </div>
              </label>
            </div>
          </div>

          {hasWarnings && replaceExisting && (
            <div className="mb-6 p-4 bg-orange-50 rounded-lg border-2 border-orange-300 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-orange-800">
                <strong>Attention :</strong> Certains élèves sélectionnés ont déjà un emploi du temps qui sera remplacé.
              </div>
            </div>
          )}

          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Élèves cibles ({selectedStudentIds.size} sélectionné{selectedStudentIds.size !== 1 ? 's' : ''})
            </h3>

            {loading ? (
              <div className="text-center py-8 text-gray-500">Chargement des élèves...</div>
            ) : students.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Aucun autre élève dans cette période
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {students.map((student) => {
                  const hasEvents = studentsWithEvents.has(student.id);
                  const isSelected = selectedStudentIds.has(student.id);

                  return (
                    <div
                      key={student.id}
                      onClick={() => toggleStudent(student.id)}
                      className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-gray-800">
                            {student.first_name} {student.last_name}
                          </div>
                          {hasEvents && (
                            <div className="text-xs text-orange-600 mt-1 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Emploi du temps existant
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleDuplicate}
            disabled={selectedStudentIds.size === 0 || duplicating}
            className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Copy className="w-5 h-5" />
            {duplicating ? 'Duplication...' : `Dupliquer vers ${selectedStudentIds.size} élève${selectedStudentIds.size !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
