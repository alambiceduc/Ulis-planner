import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, User, Stethoscope, FileDown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Period, Student, Event } from '../lib/database.types';
import { DAYS, timeToMinutes } from '../lib/timeUtils';
import { HomeButton } from './HomeButton';

interface SharedTimetablesProps {
  period: Period;
  onBack: () => void;
  onNavigateHome?: () => void;
}

interface StudentEvent extends Event {
  student: Student;
}

type ViewType = 'ulis' | 'aesh' | 'prises_en_charge';

interface GroupedEvent {
  start_time: string;
  end_time: string;
  label: string | null;
  labels: string[]; // tous les labels des slots fusionnés
  location: string | null;
  students: string[];
}

interface StudentSummary {
  name: string;
  first_time: string;
  last_time: string;
  slots: GroupedEvent[];
  labels: string[]; // matières/labels sans doublons dans l'ordre
}



export function SharedTimetables({ period, onBack, onNavigateHome }: SharedTimetablesProps) {
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [events, setEvents] = useState<StudentEvent[]>([]);
  const [viewType, setViewType] = useState<ViewType>('ulis');
  const [loading, setLoading] = useState(true);
  const [expandedStudents, setExpandedStudents] = useState<Set<string>>(new Set());

  const toggleStudent = (key: string) => {
    setExpandedStudents(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  useEffect(() => {
    loadData();
  }, [period.id]);

  const loadData = async () => {
    const { data: studentsData, error: studentsError } = await supabase
      .from('students')
      .select('*')
      .eq('period_id', period.id);

    if (studentsError) {
      console.error('Error loading students:', studentsError);
      return;
    }

    setStudents(studentsData || []);

    if (!studentsData || studentsData.length === 0) {
      setLoading(false);
      return;
    }

    const studentIds = studentsData.map((s: any) => s.id);

    const { data: eventsData, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .in('student_id', studentIds);

    if (eventsError) {
      console.error('Error loading events:', eventsError);
      return;
    }

    const enrichedEvents: StudentEvent[] = (eventsData || []).map((event: any) => ({
      ...event,
      student: studentsData.find((s: any) => s.id === event.student_id)!
    }));

    setEvents(enrichedEvents);
    setLoading(false);
  };

  const getFilteredEvents = () => {
    const eventsWithoutVieScolaire = events.filter(e => e.type !== 'VIE_SCOLAIRE');

    switch (viewType) {
      case 'ulis':
        return eventsWithoutVieScolaire.filter(e => e.type === 'ULIS');
      case 'aesh':
        return eventsWithoutVieScolaire.filter(e => e.aesh);
      case 'prises_en_charge':
        return eventsWithoutVieScolaire.filter(e => e.type === 'PRISE_EN_CHARGE');
      default:
        return [];
    }
  };

  const getPeriodForTime = (time: string): 'MATIN' | 'MIDI' | 'APRES-MIDI' => {
    const minutes = timeToMinutes(time);
    if (minutes < 720) return 'MATIN';
    if (minutes < 810) return 'MIDI';
    return 'APRES-MIDI';
  };

  const getEventsForDay = (day: number): GroupedEvent[] => {
    const filteredEvents = getFilteredEvents();
    const dayEvents = filteredEvents.filter(e => e.day_of_week === day);

    // 1. Grouper par créneau exact (même heure début-fin)
    const timeSlotMap = new Map<string, StudentEvent[]>();
    dayEvents.forEach(event => {
      const timeKey = `${event.start_time}-${event.end_time}`;
      if (!timeSlotMap.has(timeKey)) timeSlotMap.set(timeKey, []);
      timeSlotMap.get(timeKey)!.push(event);
    });

    const groupedEvents = Array.from(timeSlotMap.entries()).map(([timeKey, evts]) => {
      const [start_time, end_time] = timeKey.split('-');
      const uniqueStudents = Array.from(new Set(evts.map(e => e.student.first_name))).sort();
      const uniqueLabels = Array.from(new Set(evts.map(e => e.label).filter(Boolean))) as string[];
      return {
        start_time,
        end_time,
        label: evts[0].label,
        labels: uniqueLabels,
        location: evts[0].location,
        students: uniqueStudents
      };
    });

    // 2. Trier par heure de début
    groupedEvents.sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));

    // 3. Fusionner les créneaux consécutifs avec le même groupe d'élèves
    const merged: GroupedEvent[] = [];
    for (const event of groupedEvents) {
      const last = merged[merged.length - 1];
      const sameStudents =
        last &&
        last.end_time === event.start_time &&
        last.students.join(',') === event.students.join(',');

      if (sameStudents) {
        last.end_time = event.end_time;
        // Accumuler les labels sans doublons
        event.labels.forEach(l => { if (!last.labels.includes(l)) last.labels.push(l); });
      } else {
        merged.push({ ...event, labels: [...event.labels] });
      }
    }

    return merged;
  };

  const getStudentSummaries = (dayEvents: GroupedEvent[]): StudentSummary[] => {
    const studentMap = new Map<string, { slots: GroupedEvent[], labels: string[] }>();

    dayEvents.forEach(event => {
      event.students.forEach(name => {
        if (!studentMap.has(name)) studentMap.set(name, { slots: [], labels: [] });
        const entry = studentMap.get(name)!;
        entry.slots.push(event);
        // Accumuler les labels de ce slot pour cet élève
        event.labels.forEach(l => { if (!entry.labels.includes(l)) entry.labels.push(l); });
      });
    });

    const summaries: StudentSummary[] = [];
    studentMap.forEach(({ slots, labels }, name => {
      const sorted = [...slots].sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));
      summaries.push({
        name,
        first_time: sorted[0].start_time,
        last_time: sorted[sorted.length - 1].end_time, // fixed
        slots: sorted,
        labels,
      });
    });

    return summaries.sort((a, b) => a.name.localeCompare(b.name));
  };

  const getEventsByPeriod = (dayEvents: GroupedEvent[]) => {
    const periods = {
      MATIN: [] as GroupedEvent[],
      MIDI: [] as GroupedEvent[],
      'APRES-MIDI': [] as GroupedEvent[]
    };

    dayEvents.forEach(event => {
      const period = getPeriodForTime(event.start_time);
      periods[period].push(event);
    });

    return periods;
  };


  const getBlockColor = () => {
    switch (viewType) {
      case 'ulis':
        return 'bg-blue-500 text-white border-blue-600';
      case 'aesh':
        return 'bg-orange-500 text-white border-orange-600';
      case 'prises_en_charge':
        return 'bg-white text-gray-800 border-gray-400';
    }
  };

  const handleOpenPrintView = () => {
    let type = '';
    switch (viewType) {
      case 'ulis':
        type = 'ulis_common';
        break;
      case 'aesh':
        type = 'aesh_common';
        break;
      case 'prises_en_charge':
        type = 'care_common';
        break;
    }

    const params = new URLSearchParams({
      type,
      periodId: period.id
    });
    navigate(`/print?${params.toString()}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center">
        <div className="text-gray-600">Chargement...</div>
      </div>
    );
  }

  return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-4">
        <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Retour à la liste</span>
          </button>
          {onNavigateHome && <HomeButton onNavigateHome={onNavigateHome} />}
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-0.5">
                Période {period.name}
              </h1>
              <p className="text-sm text-gray-600 font-medium">
                {students.length} élève{students.length !== 1 ? 's' : ''}
              </p>
            </div>
            <button
              onClick={handleOpenPrintView}
              className="flex items-center gap-2 px-4 py-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg transition-colors font-semibold"
              title="Imprimer ou enregistrer en PDF"
            >
              <FileDown className="w-5 h-5" />
              <span>Imprimer / PDF</span>
            </button>
          </div>

          <div className="flex gap-3 mb-6">
            <button
              onClick={() => setViewType('ulis')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                viewType === 'ulis'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Users className="w-5 h-5" />
              <span>EDT ULIS</span>
            </button>
            <button
              onClick={() => setViewType('aesh')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                viewType === 'aesh'
                  ? 'bg-orange-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <User className="w-5 h-5" />
              <span>EDT AESH</span>
            </button>
            <button
              onClick={() => setViewType('prises_en_charge')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                viewType === 'prises_en_charge'
                  ? 'bg-gray-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Stethoscope className="w-5 h-5" />
              <span>EDT Prises en charge</span>
            </button>
          </div>

          {students.length === 0 ? (
            <div className="text-center py-12 text-gray-600">
              Aucun élève dans cette période
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[1000px]">
                <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
                  {DAYS.map((day) => {
                    const dayEvents = getEventsForDay(day.id);
                    const eventsByPeriod = getEventsByPeriod(dayEvents);

                    return (
                      <div key={day.id} className="border-2 border-gray-300 rounded-lg bg-white">
                        <div className="bg-gray-100 p-3 border-b-2 border-gray-300">
                          <h3 className="font-bold text-gray-800 text-center text-base">
                            {day.name}
                          </h3>
                        </div>

                        <div className="p-3 space-y-4">
                          {dayEvents.length === 0 ? (
                            <div className="text-sm text-gray-500 text-center py-4">
                              Aucun créneau
                            </div>
                          ) : (
                            <>
                              {eventsByPeriod.MATIN.length > 0 && (
                                <div className="border border-blue-200 rounded-lg bg-blue-50 p-3">
                                  <div className="font-bold text-blue-800 text-sm mb-2">MATIN</div>
                                  <div className="space-y-1">
                                    {getStudentSummaries(eventsByPeriod.MATIN).map((s) => {
                                      const key = `${day.id}-matin-${s.name}`;
                                      const expanded = expandedStudents.has(key);
                                      return (
                                        <div key={key}>
                                          <button
                                            onClick={() => toggleStudent(key)}
                                            className="w-full flex items-center justify-between text-sm py-0.5 hover:bg-blue-100 rounded px-1 transition-colors"
                                          >
                                            <span className="font-semibold text-gray-900">{s.name}</span>
                                            <span className="text-gray-600 font-medium">
                                              {s.first_time} → {s.last_time}
                                              <span className="ml-1 text-blue-400 no-print">{expanded ? '▲' : '▼'}</span>
                                            </span>
                                          </button>
                                          <div
                                            className="ml-2 mt-0.5 mb-1 text-xs text-gray-500 flex flex-wrap gap-1 student-labels"
                                            style={{ display: expanded ? 'flex' : 'none' }}
                                          >
                                            {s.labels.length > 0 ? s.labels.map((label, i) => (
                                              <span key={i} className="bg-white border border-blue-200 rounded px-1.5 py-0.5 text-gray-700">
                                                {label}
                                              </span>
                                            )) : s.slots.map((slot, i) => (
                                              <span key={i} className="bg-white border border-blue-200 rounded px-1 py-0.5">
                                                {slot.start_time}-{slot.end_time}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {eventsByPeriod.MIDI.length > 0 && (
                                <div className="border border-yellow-200 rounded-lg bg-yellow-50 p-3">
                                  <div className="font-bold text-yellow-800 text-sm mb-2">MIDI</div>
                                  <div className="space-y-1">
                                    {getStudentSummaries(eventsByPeriod.MIDI).map((s) => {
                                      const key = `${day.id}-midi-${s.name}`;
                                      const expanded = expandedStudents.has(key);
                                      return (
                                        <div key={key}>
                                          <button
                                            onClick={() => toggleStudent(key)}
                                            className="w-full flex items-center justify-between text-sm py-0.5 hover:bg-yellow-100 rounded px-1 transition-colors"
                                          >
                                            <span className="font-semibold text-gray-900">{s.name}</span>
                                            <span className="text-gray-600 font-medium">
                                              {s.first_time} → {s.last_time}
                                              <span className="ml-1 text-yellow-400 no-print">{expanded ? '▲' : '▼'}</span>
                                            </span>
                                          </button>
                                          <div
                                            className="ml-2 mt-0.5 mb-1 text-xs text-gray-500 flex flex-wrap gap-1 student-labels"
                                            style={{ display: expanded ? 'flex' : 'none' }}
                                          >
                                            {s.labels.length > 0 ? s.labels.map((label, i) => (
                                              <span key={i} className="bg-white border border-yellow-200 rounded px-1.5 py-0.5 text-gray-700">
                                                {label}
                                              </span>
                                            )) : s.slots.map((slot, i) => (
                                              <span key={i} className="bg-white border border-yellow-200 rounded px-1 py-0.5">
                                                {slot.start_time}-{slot.end_time}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {eventsByPeriod['APRES-MIDI'].length > 0 && (
                                <div className="border border-green-200 rounded-lg bg-green-50 p-3">
                                  <div className="font-bold text-green-800 text-sm mb-2">APRÈS-MIDI</div>
                                  <div className="space-y-1">
                                    {getStudentSummaries(eventsByPeriod['APRES-MIDI']).map((s) => {
                                      const key = `${day.id}-aprem-${s.name}`;
                                      const expanded = expandedStudents.has(key);
                                      return (
                                        <div key={key}>
                                          <button
                                            onClick={() => toggleStudent(key)}
                                            className="w-full flex items-center justify-between text-sm py-0.5 hover:bg-green-100 rounded px-1 transition-colors"
                                          >
                                            <span className="font-semibold text-gray-900">{s.name}</span>
                                            <span className="text-gray-600 font-medium">
                                              {s.first_time} → {s.last_time}
                                              <span className="ml-1 text-green-400 no-print">{expanded ? '▲' : '▼'}</span>
                                            </span>
                                          </button>
                                          <div
                                            className="ml-2 mt-0.5 mb-1 text-xs text-gray-500 flex flex-wrap gap-1 student-labels"
                                            style={{ display: expanded ? 'flex' : 'none' }}
                                          >
                                            {s.labels.length > 0 ? s.labels.map((label, i) => (
                                              <span key={i} className="bg-white border border-green-200 rounded px-1.5 py-0.5 text-gray-700">
                                                {label}
                                              </span>
                                            )) : s.slots.map((slot, i) => (
                                              <span key={i} className="bg-white border border-green-200 rounded px-1 py-0.5">
                                                {slot.start_time}-{slot.end_time}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

