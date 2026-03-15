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
  location: string | null;
  students: string[];
}



export function SharedTimetables({ period, onBack, onNavigateHome }: SharedTimetablesProps) {
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [events, setEvents] = useState<StudentEvent[]>([]);
  const [viewType, setViewType] = useState<ViewType>('ulis');
  const [loading, setLoading] = useState(true);

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

    const timeSlotMap = new Map<string, StudentEvent[]>();

    dayEvents.forEach(event => {
      const timeKey = `${event.start_time}-${event.end_time}`;
      if (!timeSlotMap.has(timeKey)) {
        timeSlotMap.set(timeKey, []);
      }
      timeSlotMap.get(timeKey)!.push(event);
    });

    const groupedEvents = Array.from(timeSlotMap.entries()).map(([timeKey, events]) => {
      const [start_time, end_time] = timeKey.split('-');
      const firstEvent = events[0];

      const uniqueStudents = Array.from(new Set(events.map(e => e.student.first_name))).sort();

      return {
        start_time,
        end_time,
        label: firstEvent.label,
        location: firstEvent.location,
        students: uniqueStudents
      };
    });

    groupedEvents.sort((a, b) => {
      return timeToMinutes(a.start_time) - timeToMinutes(b.start_time);
    });

    console.log(`DEBUG_MERGE [Jour ${day}]:`, {
      eventsInitiaux: dayEvents.length,
      eventsFusionnes: groupedEvents.length,
      details: groupedEvents.map(e => ({
        horaire: `${e.start_time}-${e.end_time}`,
        eleves: e.students.length,
        prenoms: e.students.join(', ')
      }))
    });

    return groupedEvents;
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
                                  <div className="font-bold text-blue-800 text-sm mb-2">
                                    MATIN
                                  </div>
                                  <div className="space-y-1.5">
                                    {eventsByPeriod.MATIN.map((event, idx) => (
                                      <div key={idx} className="text-sm leading-relaxed">
                                        <span className="font-bold text-gray-900">
                                          {event.start_time}-{event.end_time}
                                        </span>
                                        <span className="text-gray-700"> : </span>
                                        <span className="font-medium text-gray-800">
                                          {event.students.join(', ')}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {eventsByPeriod.MIDI.length > 0 && (
                                <div className="border border-yellow-200 rounded-lg bg-yellow-50 p-3">
                                  <div className="font-bold text-yellow-800 text-sm mb-2">
                                    MIDI
                                  </div>
                                  <div className="space-y-1.5">
                                    {eventsByPeriod.MIDI.map((event, idx) => (
                                      <div key={idx} className="text-sm leading-relaxed">
                                        <span className="font-bold text-gray-900">
                                          {event.start_time}-{event.end_time}
                                        </span>
                                        <span className="text-gray-700"> : </span>
                                        <span className="font-medium text-gray-800">
                                          {event.students.join(', ')}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {eventsByPeriod['APRES-MIDI'].length > 0 && (
                                <div className="border border-green-200 rounded-lg bg-green-50 p-3">
                                  <div className="font-bold text-green-800 text-sm mb-2">
                                    APRÈS-MIDI
                                  </div>
                                  <div className="space-y-1.5">
                                    {eventsByPeriod['APRES-MIDI'].map((event, idx) => (
                                      <div key={idx} className="text-sm leading-relaxed">
                                        <span className="font-bold text-gray-900">
                                          {event.start_time}-{event.end_time}
                                        </span>
                                        <span className="text-gray-700"> : </span>
                                        <span className="font-medium text-gray-800">
                                          {event.students.join(', ')}
                                        </span>
                                      </div>
                                    ))}
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
