import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Student, Event } from '../lib/database.types';
import { timeToMinutes, DAYS } from '../lib/timeUtils';
import { getUnifiedEventsForStudents } from '../services/unified-events.service';

interface PrintCommonProps {
  type: 'ulis_common' | 'aesh_common' | 'care_common';
  periodId: string;
  onFilenameGenerated: (filename: string) => void;
  isPrinting?: boolean;
}

interface StudentEvent extends Event {
  student: Student;
}

export function PrintCommon({ type, periodId, onFilenameGenerated, isPrinting = false }: PrintCommonProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [events, setEvents] = useState<StudentEvent[]>([]);
  const [periodName, setPeriodName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    console.log('🔄 PrintCommon: Loading data for', { type, periodId });
    loadData();
  }, [periodId, type]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔐 Checking session...');
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('❌ Session error:', sessionError);
        setError(`Erreur de session: ${sessionError.message}`);
        setLoading(false);
        return;
      }

      if (!session) {
        console.error('❌ No session found');
        setError('Non connecté : vous devez être connecté pour imprimer un emploi du temps commun (protection RLS).');
        setLoading(false);
        return;
      }

      console.log('✅ Session present:', session.user.id);

      console.log('📥 Fetching period data...');
      const { data: periodData, error: periodError, status: periodStatus, statusText: periodStatusText } = await supabase
        .from('periods')
        .select('name')
        .eq('id', periodId)
        .maybeSingle();

      if (periodError) {
        console.error('❌ Error loading period:', {
          message: periodError.message,
          code: periodError.code,
          details: periodError.details,
          hint: periodError.hint,
          status: periodStatus,
          statusText: periodStatusText
        });
        const isRLS = periodError.code === '42501' || periodError.message.includes('row-level security');
        if (isRLS) {
          setError(`Accès refusé (RLS) : vous n'avez pas les droits pour consulter cette période.\n\nDétails : ${periodError.message}\nCode : ${periodError.code || 'N/A'}\nHint : ${periodError.hint || 'N/A'}`);
        } else {
          setError(`Erreur lors du chargement de la période:\n\nMessage : ${periodError.message}\nCode : ${periodError.code || 'N/A'}\nDétails : ${periodError.details || 'N/A'}\nHint : ${periodError.hint || 'N/A'}`);
        }
        setLoading(false);
        return;
      }

      if (periodData) {
        console.log('✅ Period loaded:', periodData.name);
        setPeriodName(periodData.name);
        const typeLabel = type === 'ulis_common' ? 'ULIS' : type === 'aesh_common' ? 'AESH' : 'PrisesEnCharge';
        onFilenameGenerated(`EDT_Commun_${typeLabel}_${periodData.name}.pdf`);
      } else {
        console.log('⚠️ Period not found, using default filename');
        const typeLabel = type === 'ulis_common' ? 'ULIS' : type === 'aesh_common' ? 'AESH' : 'PrisesEnCharge';
        onFilenameGenerated(`EDT_Commun_${typeLabel}.pdf`);
      }

      console.log('📥 Fetching students...');
      const { data: studentsData, error: studentsError, status: studentsStatus, statusText: studentsStatusText } = await supabase
        .from('students')
        .select('*')
        .eq('period_id', periodId);

      if (studentsError) {
        console.error('❌ Error loading students:', {
          message: studentsError.message,
          code: studentsError.code,
          details: studentsError.details,
          hint: studentsError.hint,
          status: studentsStatus,
          statusText: studentsStatusText
        });
        const isRLS = studentsError.code === '42501' || studentsError.message.includes('row-level security');
        if (isRLS) {
          setError(`Accès refusé (RLS) : vous n'avez pas les droits pour consulter les élèves de cette période.\n\nDétails : ${studentsError.message}\nCode : ${studentsError.code || 'N/A'}\nHint : ${studentsError.hint || 'N/A'}`);
        } else {
          setError(`Erreur lors du chargement des élèves:\n\nMessage : ${studentsError.message}\nCode : ${studentsError.code || 'N/A'}\nDétails : ${studentsError.details || 'N/A'}\nHint : ${studentsError.hint || 'N/A'}`);
        }
        setLoading(false);
        return;
      }

      if (!studentsData || studentsData.length === 0) {
        console.log('ℹ️ Aucun élève trouvé pour cette période (ce n\'est pas une erreur)');
        setStudents([]);
        setEvents([]);
        setLoading(false);
        return;
      }

      console.log(`✅ Students loaded: ${studentsData.length} élève(s)`);
      setStudents(studentsData);

      const studentIds = studentsData.map((s: Student) => s.id);

      console.log('📥 Fetching unified events (base events + overlays)...');
      const unifiedEvents = await getUnifiedEventsForStudents(studentIds);

      const enrichedEvents: StudentEvent[] = unifiedEvents.map((event: Event) => ({
        ...event,
        student: studentsData.find((s: Student) => s.id === event.student_id)!
      }));

      const eventCount = enrichedEvents.length;
      console.log(`✅ Unified events loaded: ${eventCount} événement(s)`);

      if (eventCount === 0) {
        console.log('ℹ️ Aucun événement trouvé - EDT vide (ce n\'est pas une erreur)');
      }

      setEvents(enrichedEvents);
      setLoading(false);
    } catch (err) {
      console.error('❌ Unexpected error:', err);
      setError(`Erreur inattendue: ${err instanceof Error ? err.message : String(err)}`);
      setLoading(false);
    }
  };

  const getFilteredEvents = () => {
    const eventsWithoutVieScolaire = events.filter(e => e.type !== 'VIE_SCOLAIRE');

    switch (type) {
      case 'ulis_common':
        return eventsWithoutVieScolaire.filter(e => e.type === 'ULIS');
      case 'aesh_common':
        return eventsWithoutVieScolaire.filter(e => e.aesh);
      case 'care_common':
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

  interface GroupedEvent {
    start_time: string;
    end_time: string;
    students: string[];
    labels: string[];
  }

  interface StudentSummary {
    name: string;
    first_time: string;
    last_time: string;
    labels: string[];
  }

  const getEventsForDay = (day: number): GroupedEvent[] => {
    const filteredEvents = getFilteredEvents();
    const dayEvents = filteredEvents.filter(e => e.day_of_week === day);

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
      return { start_time, end_time, students: uniqueStudents, labels: uniqueLabels };
    });

    groupedEvents.sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));

    // Fusionner les créneaux consécutifs avec le même groupe d'élèves
    const merged: GroupedEvent[] = [];
    for (const event of groupedEvents) {
      const last = merged[merged.length - 1];
      const sameStudents = last &&
        last.end_time === event.start_time &&
        last.students.join(',') === event.students.join(',');
      if (sameStudents) {
        last.end_time = event.end_time;
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
        event.labels.forEach(l => { if (!entry.labels.includes(l)) entry.labels.push(l); });
      });
    });

    const summaries: StudentSummary[] = [];
    studentMap.forEach(({ slots, labels }, name) => {
      const sorted = [...slots].sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));
      summaries.push({
        name,
        first_time: sorted[0].start_time,
        last_time: sorted[sorted.length - 1].end_time,
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
    switch (type) {
      case 'ulis_common':
        return 'bg-blue-500 text-white border-blue-600';
      case 'aesh_common':
        return 'bg-orange-500 text-white border-orange-600';
      case 'care_common':
        return 'bg-white text-gray-800 border-gray-400';
    }
  };

  const getTitle = () => {
    switch (type) {
      case 'ulis_common':
        return 'EDT Commun ULIS';
      case 'aesh_common':
        return 'EDT Commun AESH';
      case 'care_common':
        return 'EDT Commun Prises en Charge';
    }
  };

  const getDebugData = () => {
    const filteredEvents = getFilteredEvents();

    if (filteredEvents.length === 0) {
      return {
        totalCount: 0,
        totalBeforeFilter: events.length,
        firstStart: 'N/A',
        lastEnd: 'N/A',
        eventList: []
      };
    }

    const allStartMinutes = filteredEvents.map(e => timeToMinutes(e.start_time));
    const allEndMinutes = filteredEvents.map(e => timeToMinutes(e.end_time));
    const firstStartMinutes = Math.min(...allStartMinutes);
    const lastEndMinutes = Math.max(...allEndMinutes);

    const firstEvent = filteredEvents.find(e => timeToMinutes(e.start_time) === firstStartMinutes);
    const lastEvent = filteredEvents.find(e => timeToMinutes(e.end_time) === lastEndMinutes);

    const eventList = filteredEvents.map(e => {
      const day = DAYS.find(d => d.id === e.day_of_week);
      return {
        day: day?.short || `J${e.day_of_week}`,
        timeRange: `${e.start_time}-${e.end_time}`,
        title: e.label || '(sans titre)',
        type: e.type,
        color: getBlockColor(),
        location: e.location || '',
        student: e.student.first_name
      };
    });

    return {
      totalCount: filteredEvents.length,
      totalBeforeFilter: events.length,
      firstStart: firstEvent?.start_time || 'N/A',
      lastEnd: lastEvent?.end_time || 'N/A',
      eventList
    };
  };

  if (loading) {
    console.log('⏳ Affichage: Chargement en cours...');
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-8">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-lg font-semibold text-gray-700">Chargement de l'emploi du temps commun...</p>
          <p className="text-sm text-gray-500 mt-2">Type: {type}</p>
          <p className="text-sm text-gray-500">PeriodId: {periodId}</p>
        </div>
      </div>
    );
  }

  if (error) {
    console.log('❌ Affichage: Erreur -', error);
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-8">
        <div className="bg-red-50 border-2 border-red-300 rounded-lg p-6 max-w-lg">
          <h1 className="text-2xl font-bold text-red-800 mb-4">Erreur</h1>
          <p className="text-red-600 mb-4">{error}</p>
          <div className="text-sm text-gray-600 space-y-1">
            <p>Type: {type}</p>
            <p>PeriodId: {periodId}</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  if (students.length === 0) {
    console.log('⚠️ Affichage: Aucun élève');
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-8">
        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-6 max-w-lg">
          <h1 className="text-2xl font-bold text-yellow-800 mb-4">Aucun élève</h1>
          <p className="text-yellow-700">Aucun élève trouvé pour cette période.</p>
          <p className="text-sm text-gray-600 mt-2">PeriodId: {periodId}</p>
        </div>
      </div>
    );
  }

  console.log('✅ Affichage: Rendu de la grille');

  const debugData = getDebugData();

  return (
    <div className={`print-common-content ${!isPrinting ? 'print-preview' : ''}`}>
      <div className="no-print mb-4">
        <button
          onClick={() => setShowDebug(!showDebug)}
          className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-semibold"
        >
          {showDebug ? 'Masquer' : 'Afficher'} DEBUG
        </button>

        {showDebug && (
          <div className="mt-2 p-4 bg-yellow-50 border-2 border-yellow-400 rounded-lg text-xs">
            <h3 className="font-bold text-lg mb-3 text-gray-800">DEBUG - Données chargées</h3>

            <div className="mb-4 p-3 bg-white rounded border border-yellow-300">
              <p className="font-semibold text-gray-800">Statistiques:</p>
              <p><strong>Total événements (avant filtre):</strong> {debugData.totalBeforeFilter}</p>
              <p><strong>Total événements (après filtre {type}):</strong> {debugData.totalCount}</p>
              <p><strong>Première heure:</strong> {debugData.firstStart}</p>
              <p><strong>Dernière heure:</strong> {debugData.lastEnd}</p>
            </div>

            <div className="mb-2">
              <p className="font-semibold text-gray-800 mb-2">Liste des événements filtrés:</p>
              {debugData.eventList.length === 0 ? (
                <p className="text-gray-600 italic">Aucun événement</p>
              ) : (
                <div className="space-y-1 max-h-96 overflow-y-auto">
                  {debugData.eventList.map((evt, idx) => (
                    <div key={idx} className="p-2 bg-white rounded border border-gray-300 flex items-center gap-2">
                      <span className="font-bold text-gray-700 w-8">{evt.day}</span>
                      <span className="font-mono text-sm w-24">{evt.timeRange}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${evt.color}`}>
                        {evt.type}
                      </span>
                      <span className="text-gray-800 font-medium">{evt.student}</span>
                      <span className="flex-1 text-gray-800">{evt.title}</span>
                      {evt.location && (
                        <span className="text-gray-600 text-xs">📍 {evt.location}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div id="print-page">
        <div id="print-fit-root">
            <div id="zoom-debug" className="no-print" style={{
              position: 'absolute',
              top: '4px',
              right: '4px',
              background: 'rgba(0,0,0,0.8)',
              color: 'white',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '10px',
              fontFamily: 'monospace',
              zIndex: 1000
            }}>
              Zoom: 1.000 | Content: 0px | Available: 0px
            </div>
            <div className="print-header-compact" style={{ marginBottom: '12px' }}>
              <h1 className="print-header-title">
                {getTitle()} - {periodName}
              </h1>
              <div className="print-header-stats">
                {students.length} élève{students.length !== 1 ? 's' : ''}
              </div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: '8px',
              fontSize: '11px'
            }}>
              {DAYS.map((day) => {
                const dayEvents = getEventsForDay(day.id);
                const eventsByPeriod = getEventsByPeriod(dayEvents);

                return (
                  <div key={day.id} style={{
                    border: '2px solid #d1d5db',
                    borderRadius: '6px',
                    backgroundColor: 'white',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      backgroundColor: '#f3f4f6',
                      padding: '8px',
                      borderBottom: '2px solid #d1d5db'
                    }}>
                      <h3 style={{
                        fontWeight: 'bold',
                        color: '#1f2937',
                        textAlign: 'center',
                        fontSize: '12px',
                        margin: 0
                      }}>
                        {day.name}
                      </h3>
                    </div>

                    <div style={{ padding: '8px' }}>
                      {dayEvents.length === 0 ? (
                        <div style={{
                          fontSize: '10px',
                          color: '#6b7280',
                          textAlign: 'center',
                          padding: '12px 0'
                        }}>
                          Aucun créneau
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {eventsByPeriod.MATIN.length > 0 && (
                            <div style={{ border: '1px solid #bfdbfe', borderRadius: '4px', backgroundColor: '#eff6ff', padding: '6px' }}>
                              <div style={{ fontWeight: 'bold', color: '#1e40af', fontSize: '10px', marginBottom: '4px' }}>MATIN</div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {getStudentSummaries(eventsByPeriod.MATIN).map((s, idx) => (
                                  <div key={idx} style={{ fontSize: '10px', lineHeight: '1.4' }}>
                                    <span style={{ fontWeight: 'bold', color: '#111827' }}>{s.name}</span>
                                    <span style={{ color: '#6b7280' }}> {s.first_time}→{s.last_time}</span>
                                    {s.labels.length > 0 && (
                                      <div style={{ color: '#4b5563', fontSize: '9px', marginLeft: '6px' }}>
                                        {s.labels.join(' · ')}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {eventsByPeriod.MIDI.length > 0 && (
                            <div style={{ border: '1px solid #fde68a', borderRadius: '4px', backgroundColor: '#fef9c3', padding: '6px' }}>
                              <div style={{ fontWeight: 'bold', color: '#92400e', fontSize: '10px', marginBottom: '4px' }}>MIDI</div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {getStudentSummaries(eventsByPeriod.MIDI).map((s, idx) => (
                                  <div key={idx} style={{ fontSize: '10px', lineHeight: '1.4' }}>
                                    <span style={{ fontWeight: 'bold', color: '#111827' }}>{s.name}</span>
                                    <span style={{ color: '#6b7280' }}> {s.first_time}→{s.last_time}</span>
                                    {s.labels.length > 0 && (
                                      <div style={{ color: '#4b5563', fontSize: '9px', marginLeft: '6px' }}>
                                        {s.labels.join(' · ')}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {eventsByPeriod['APRES-MIDI'].length > 0 && (
                            <div style={{ border: '1px solid #bbf7d0', borderRadius: '4px', backgroundColor: '#f0fdf4', padding: '6px' }}>
                              <div style={{ fontWeight: 'bold', color: '#166534', fontSize: '10px', marginBottom: '4px' }}>APRÈS-MIDI</div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {getStudentSummaries(eventsByPeriod['APRES-MIDI']).map((s, idx) => (
                                  <div key={idx} style={{ fontSize: '10px', lineHeight: '1.4' }}>
                                    <span style={{ fontWeight: 'bold', color: '#111827' }}>{s.name}</span>
                                    <span style={{ color: '#6b7280' }}> {s.first_time}→{s.last_time}</span>
                                    {s.labels.length > 0 && (
                                      <div style={{ color: '#4b5563', fontSize: '9px', marginLeft: '6px' }}>
                                        {s.labels.join(' · ')}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
        </div>
      </div>
    </div>
  );
}
