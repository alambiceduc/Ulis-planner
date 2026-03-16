import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer, FileDown, BookOpen } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { HomeButton } from './HomeButton';
import { DAYS, timeToMinutes } from '../lib/timeUtils';
import type { Student, Event, Period } from '../lib/database.types';

// ── Types ─────────────────────────────────────────────────────────────────────
interface StudentEvent extends Event { student: Student; }

interface Slot {
  start_time: string;
  end_time: string;
  label: string;
  location: string;
  students: string[];
  dayId: number;
}

interface Notes {
  [key: string]: { objectif: string; materiel: string };
}

type ViewMode = 'jour' | 'semaine';

// ── Helpers ───────────────────────────────────────────────────────────────────
const slotKey = (dayId: number, start: string, end: string) => `${dayId}|${start}|${end}`;

const PERIOD_LABEL: Record<string, string> = {
  MATIN: '🌅 Matin', MIDI: '🍽️ Pause méridienne', 'APRES-MIDI': '☀️ Après-midi'
};

function getPeriod(time: string): 'MATIN' | 'MIDI' | 'APRES-MIDI' {
  const m = timeToMinutes(time);
  if (m < 720) return 'MATIN';
  if (m < 810) return 'MIDI';
  return 'APRES-MIDI';
}

// ── Composant principal ───────────────────────────────────────────────────────
export function CahierJournal() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const periodId = searchParams.get('periodId');

  const [period, setPeriod] = useState<Period | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [notes, setNotes] = useState<Notes>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('semaine');
  const [selectedDay, setSelectedDay] = useState(1);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!periodId) return;
    loadData();
  }, [periodId]);

  // Charger les notes sauvegardées depuis Supabase
  const loadNotes = async (pid: string) => {
    const { data } = await supabase
      .from('cahier_journal_notes')
      .select('*')
      .eq('period_id', pid);
    if (data) {
      const map: Notes = {};
      data.forEach((row: any) => {
        map[row.slot_key] = { objectif: row.objectif || '', materiel: row.materiel || '' };
      });
      setNotes(map);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);

      // Charger la période
      const { data: periodData, error: pe } = await supabase
        .from('periods').select('*').eq('id', periodId!).single();
      if (pe) throw pe;
      setPeriod(periodData);

      // Charger les élèves de la période
      const { data: studentsData, error: se } = await supabase
        .from('students').select('*').eq('period_id', periodId!);
      if (se) throw se;
      if (!studentsData?.length) { setLoading(false); return; }

      const studentIds = studentsData.map((s: any) => s.id);

      // Charger les événements ULIS uniquement
      const { data: eventsData, error: ee } = await supabase
        .from('events').select('*')
        .in('student_id', studentIds)
        .eq('type', 'ULIS');
      if (ee) throw ee;

      // Enrichir avec l'objet student
      const enriched: StudentEvent[] = (eventsData || []).map((ev: any) => ({
        ...ev,
        student: studentsData.find((s: any) => s.id === ev.student_id)!
      }));

      // Grouper par (jour, start, end)
      const map = new Map<string, StudentEvent[]>();
      enriched.forEach(ev => {
        const k = slotKey(ev.day_of_week, ev.start_time, ev.end_time);
        if (!map.has(k)) map.set(k, []);
        map.get(k)!.push(ev);
      });

      const builtSlots: Slot[] = Array.from(map.entries())
        .map(([k, evs]) => {
          const [dayId, start_time, end_time] = k.split('|');
          const first = evs[0];
          return {
            start_time,
            end_time,
            label: first.label || '',
            location: first.location || '',
            students: Array.from(new Set(evs.map(e => e.student.first_name))).sort(),
            dayId: Number(dayId),
          };
        })
        .sort((a, b) => {
          if (a.dayId !== b.dayId) return a.dayId - b.dayId;
          return timeToMinutes(a.start_time) - timeToMinutes(b.start_time);
        });

      setSlots(builtSlots);
      await loadNotes(periodId!);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateNote = useCallback((key: string, field: 'objectif' | 'materiel', value: string) => {
    setNotes(prev => ({
      ...prev,
      [key]: { objectif: '', materiel: '', ...prev[key], [field]: value }
    }));
  }, []);

  const saveNotes = async () => {
    if (!periodId) return;
    setSaving(true);
    try {
      for (const [key, note] of Object.entries(notes)) {
        await supabase.from('cahier_journal_notes').upsert({
          period_id: periodId,
          slot_key: key,
          objectif: note.objectif,
          materiel: note.materiel,
        }, { onConflict: 'period_id,slot_key' });
      }
    } finally {
      setSaving(false);
    }
  };

  const exportWord = async () => {
    await saveNotes();

    const visibleDays = viewMode === 'jour'
      ? DAYS.filter(d => d.id === selectedDay)
      : DAYS;

    let html = `
      <html><head><meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; font-size: 11pt; margin: 15mm; }
        h1 { font-size: 16pt; color: #1e40af; margin-bottom: 4px; }
        h2 { font-size: 13pt; color: #374151; margin: 14px 0 6px; border-bottom: 2px solid #e5e7eb; padding-bottom: 4px; }
        h3 { font-size: 10pt; color: #6b7280; font-weight: normal; margin: 10px 0 4px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
        th { background: #eff6ff; color: #1e40af; font-size: 9pt; padding: 5px 8px; text-align: left; border: 1px solid #bfdbfe; }
        td { padding: 6px 8px; border: 1px solid #e5e7eb; font-size: 10pt; vertical-align: top; }
        .time { font-weight: bold; color: #1e40af; white-space: nowrap; width: 80px; }
        .students { color: #166534; font-size: 9pt; }
        .empty { color: #9ca3af; font-style: italic; }
        .label { font-weight: 600; }
      </style></head><body>
      <h1>📓 Cahier journal ULIS — Période ${period?.name}</h1>
      <p style="color:#6b7280;font-size:9pt;">Semaine type · ${slots.length} créneaux ULIS</p>
    `;

    for (const day of visibleDays) {
      const daySlots = slots.filter(s => s.dayId === day.id);
      if (!daySlots.length) continue;

      html += `<h2>${day.name}</h2>`;

      const byPeriod: Record<string, Slot[]> = { MATIN: [], MIDI: [], 'APRES-MIDI': [] };
      daySlots.forEach(s => byPeriod[getPeriod(s.start_time)].push(s));

      for (const [p, pSlots] of Object.entries(byPeriod)) {
        if (!pSlots.length) continue;
        html += `<h3>${PERIOD_LABEL[p]}</h3><table>
          <tr><th>Horaire</th><th>Matière</th><th>Élèves</th><th>Objectif de séance</th><th>Matériel</th></tr>`;
        for (const slot of pSlots) {
          const k = slotKey(slot.dayId, slot.start_time, slot.end_time);
          const n = notes[k] || { objectif: '', materiel: '' };
          html += `<tr>
            <td class="time">${slot.start_time}–${slot.end_time}</td>
            <td class="label">${slot.label || '<span class="empty">—</span>'}</td>
            <td class="students">${slot.students.join(', ') || '<span class="empty">—</span>'}</td>
            <td>${n.objectif || '<span class="empty">À compléter</span>'}</td>
            <td>${n.materiel || '<span class="empty">À compléter</span>'}</td>
          </tr>`;
        }
        html += `</table>`;
      }
    }

    html += `</body></html>`;

    const blob = new Blob([html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Cahier_journal_ULIS_${period?.name || 'P'}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Rendu ─────────────────────────────────────────────────────────────────
  if (!periodId) return <div className="p-8 text-red-600">Paramètre periodId manquant</div>;
  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center">
      <div className="text-gray-600">Chargement du cahier journal…</div>
    </div>
  );
  if (error) return <div className="p-8 text-red-600">Erreur : {error}</div>;

  const visibleDays = viewMode === 'jour'
    ? DAYS.filter(d => d.id === selectedDay)
    : DAYS;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-4">
      <div className="max-w-5xl mx-auto">

        {/* En-tête */}
        <div className="mb-5 flex items-center justify-between">
          <button onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span>Retour</span>
          </button>
          <HomeButton onNavigateHome={() => { window.location.href = '/'; }} />
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6">

          {/* Titre + actions */}
          <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-3 rounded-xl">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">
                  Cahier journal ULIS — Période {period?.name}
                </h1>
                <p className="text-gray-500 text-sm">
                  {slots.length} créneau{slots.length > 1 ? 'x' : ''} ULIS · Semaine type
                </p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={saveNotes} disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors disabled:opacity-50 font-medium text-sm">
                {saving ? 'Sauvegarde…' : '💾 Sauvegarder'}
              </button>
              <button onClick={() => window.print()}
                className="flex items-center gap-2 px-4 py-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg transition-colors font-medium text-sm">
                <Printer className="w-4 h-4" />
                Imprimer
              </button>
              <button onClick={exportWord}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-semibold text-sm">
                <FileDown className="w-4 h-4" />
                Exporter Word
              </button>
            </div>
          </div>

          {/* Sélecteur vue jour / semaine */}
          <div className="flex items-center gap-3 mb-6 flex-wrap">
            <div className="flex rounded-lg overflow-hidden border border-gray-200">
              <button
                onClick={() => setViewMode('semaine')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${viewMode === 'semaine' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                Semaine entière
              </button>
              <button
                onClick={() => setViewMode('jour')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${viewMode === 'jour' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                Par jour
              </button>
            </div>

            {viewMode === 'jour' && (
              <div className="flex gap-1">
                {DAYS.map(day => (
                  <button key={day.id} onClick={() => setSelectedDay(day.id)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedDay === day.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}>
                    {day.short}
                  </button>
                ))}
              </div>
            )}
          </div>

          {slots.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-lg">Aucun créneau ULIS trouvé pour cette période.</p>
              <p className="text-sm mt-1">Ajoutez des créneaux de type ULIS dans les fiches élèves.</p>
            </div>
          ) : (
            <div className="space-y-8 no-print-break">
              {visibleDays.map(day => {
                const daySlots = slots.filter(s => s.dayId === day.id);
                if (!daySlots.length) return null;

                const byPeriod: Record<string, Slot[]> = { MATIN: [], MIDI: [], 'APRES-MIDI': [] };
                daySlots.forEach(s => byPeriod[getPeriod(s.start_time)].push(s));

                return (
                  <div key={day.id}>
                    <h2 className="text-lg font-bold text-gray-800 mb-3 pb-2 border-b-2 border-blue-100 flex items-center gap-2">
                      <span className="bg-blue-600 text-white px-3 py-1 rounded-lg text-sm">{day.name}</span>
                    </h2>

                    <div className="space-y-4">
                      {Object.entries(byPeriod).map(([p, pSlots]) => {
                        if (!pSlots.length) return null;
                        return (
                          <div key={p}>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                              {PERIOD_LABEL[p]}
                            </p>
                            <div className="space-y-2">
                              {pSlots.map(slot => {
                                const k = slotKey(slot.dayId, slot.start_time, slot.end_time);
                                const n = notes[k] || { objectif: '', materiel: '' };

                                return (
                                  <div key={k} className="border border-blue-100 rounded-xl bg-blue-50 overflow-hidden">
                                    {/* Ligne supérieure : infos fixes */}
                                    <div className="flex items-center gap-4 px-4 py-2 bg-blue-600 text-white flex-wrap">
                                      <span className="font-bold text-sm whitespace-nowrap">
                                        {slot.start_time}–{slot.end_time}
                                      </span>
                                      {slot.label && (
                                        <span className="font-semibold text-sm">{slot.label}</span>
                                      )}
                                      {slot.students.length > 0 && (
                                        <span className="text-xs bg-white bg-opacity-20 rounded-full px-2 py-0.5">
                                          👥 {slot.students.join(', ')}
                                        </span>
                                      )}
                                      {slot.location && (
                                        <span className="text-xs opacity-75">📍 {slot.location}</span>
                                      )}
                                    </div>

                                    {/* Champs libres */}
                                    <div className="grid grid-cols-2 gap-3 p-3">
                                      <div>
                                        <label className="block text-xs font-semibold text-blue-700 mb-1">
                                          🎯 Objectif de séance
                                        </label>
                                        <textarea
                                          value={n.objectif}
                                          onChange={e => updateNote(k, 'objectif', e.target.value)}
                                          placeholder="Compétences visées, activité prévue…"
                                          rows={2}
                                          className="w-full text-sm px-3 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent resize-none bg-white"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-xs font-semibold text-blue-700 mb-1">
                                          🧰 Matériel
                                        </label>
                                        <textarea
                                          value={n.materiel}
                                          onChange={e => updateNote(k, 'materiel', e.target.value)}
                                          placeholder="Fiches, outils, supports numériques…"
                                          rows={2}
                                          className="w-full text-sm px-3 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent resize-none bg-white"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 12mm; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body { margin: 0 !important; padding: 0 !important; }
          .no-print { display: none !important; }
          textarea { border: 1px solid #ccc !important; }
        }
      `}</style>
    </div>
  );
}
