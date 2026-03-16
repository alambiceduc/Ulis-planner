import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Calculator, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Undo, Copy, FileDown, Sparkles, LayoutGrid } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Student, Event, EventType } from '../lib/database.types';
import { DAYS, timeToMinutes, calculateEventDuration } from '../lib/timeUtils';
import { MIN_READABLE_HEIGHT_REM } from '../constants';
import { EventModal } from './EventModal';
import { EventBlock } from './EventBlock';
import { SummaryStats } from './SummaryStats';
import { PdfViewer } from './PdfViewer';
import { DuplicateTimetableModal } from './DuplicateTimetableModal';
import { AiPrefillModal } from './AiPrefillModal';
import { UndoToast } from './UndoToast';
import { HomeButton } from './HomeButton';
import { PhotosPanel } from './PhotosPanel';
import { useUndoHistory } from '../hooks/useUndoHistory';
import { getEventZIndex } from '../utils/eventPriority';
import { detectOverlapsAllDays } from '../utils/overlapDetection';

interface TimetableGridProps {
  student: Student;
  onBack: () => void;
  onNavigateHome?: () => void;
}

const CANTINE_MAX_HEIGHT_REM = 2.0;
const BASE_HEIGHT_PER_MINUTE = 0.10;

interface TimelineSegment {
  startTime: string;
  endTime: string;
  durationMinutes: number;
  heightRem: number;
  topPositionRem: number;
  isCantineSegment: boolean;
}

interface UndoAction {
  type: 'delete' | 'cancel-create' | 'cancel-edit';
  message: string;
  event?: Event;
  newEventData?: { day: number; startTime: string };
}

export function TimetableGrid({ student: initialStudent, onBack, onNavigateHome }: TimetableGridProps) {
  const navigate = useNavigate();
  const [student, setStudent] = useState<Student>(initialStudent);
  const [events, setEvents] = useState<Event[]>([]);
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [newEventData, setNewEventData] = useState<{ day: number; startTime: string } | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [showPdf, setShowPdf] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [showWednesday, setShowWednesday] = useState(true);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [periodName, setPeriodName] = useState('');
  const [undoAction, setUndoAction] = useState<UndoAction | null>(null);

  const { captureState, undo, canUndo } = useUndoHistory(student.id);

  const visibleDays = useMemo(() => {
    return showWednesday ? DAYS : DAYS.filter(day => day.id !== 3);
  }, [showWednesday]);

  const findCantineTimeRange = (allEvents: Event[]): { startTime: string; endTime: string } | null => {
    const cantineEvents = allEvents.filter(
      e => e.type === 'VIE_SCOLAIRE' && e.label && e.label.toLowerCase().includes('cantine')
    );

    if (cantineEvents.length === 0) return null;

    const allStartMinutes = cantineEvents.map(e => timeToMinutes(e.start_time));
    const allEndMinutes = cantineEvents.map(e => timeToMinutes(e.end_time));

    return {
      startTime: cantineEvents.find(e => timeToMinutes(e.start_time) === Math.min(...allStartMinutes))?.start_time || '',
      endTime: cantineEvents.find(e => timeToMinutes(e.end_time) === Math.max(...allEndMinutes))?.end_time || ''
    };
  };

  const globalTimeline = useMemo((): TimelineSegment[] => {
    if (events.length === 0) return [];

    const allTimes = new Set<string>();
    events.forEach(event => {
      allTimes.add(event.start_time);
      allTimes.add(event.end_time);
    });

    const sortedTimes = Array.from(allTimes).sort((a, b) => timeToMinutes(a) - timeToMinutes(b));

    const cantineRange = findCantineTimeRange(events);

    const segments: TimelineSegment[] = [];
    let cumulativeTop = 0;

    for (let i = 0; i < sortedTimes.length - 1; i++) {
      const startTime = sortedTimes[i];
      const endTime = sortedTimes[i + 1];
      const durationMinutes = timeToMinutes(endTime) - timeToMinutes(startTime);

      const startMinutes = timeToMinutes(startTime);
      const endMinutes = timeToMinutes(endTime);

      const isCantineSegment = cantineRange !== null &&
        startMinutes >= timeToMinutes(cantineRange.startTime) &&
        endMinutes <= timeToMinutes(cantineRange.endTime);

      let heightRem = durationMinutes * BASE_HEIGHT_PER_MINUTE * zoom;

      if (isCantineSegment) {
        const normalHeight = durationMinutes * BASE_HEIGHT_PER_MINUTE * zoom;
        const cantineDuration = timeToMinutes(cantineRange!.endTime) - timeToMinutes(cantineRange!.startTime);
        const cantineTotalNormalHeight = cantineDuration * BASE_HEIGHT_PER_MINUTE * zoom;
        const compressionRatio = Math.min(CANTINE_MAX_HEIGHT_REM * zoom / cantineTotalNormalHeight, 1);
        heightRem = normalHeight * compressionRatio;
      }

      heightRem = Math.max(heightRem, MIN_READABLE_HEIGHT_REM * zoom);

      segments.push({
        startTime,
        endTime,
        durationMinutes,
        heightRem,
        topPositionRem: cumulativeTop,
        isCantineSegment
      });

      cumulativeTop += heightRem;
    }

    return segments;
  }, [events, zoom]);

  const totalGridHeight = useMemo(() => {
    if (globalTimeline.length === 0) return 12.5;
    const lastSegment = globalTimeline[globalTimeline.length - 1];
    return lastSegment.topPositionRem + lastSegment.heightRem;
  }, [globalTimeline]);

  const getEventPosition = (event: Event): { top: number; height: number } => {
    const startMinutes = timeToMinutes(event.start_time);
    const endMinutes = timeToMinutes(event.end_time);

    const relevantSegments = globalTimeline.filter(
      seg => timeToMinutes(seg.startTime) >= startMinutes && timeToMinutes(seg.endTime) <= endMinutes
    );

    if (relevantSegments.length === 0) {
      return { top: 0, height: MIN_READABLE_HEIGHT_REM * zoom };
    }

    const top = relevantSegments[0].topPositionRem;
    const height = relevantSegments.reduce((sum, seg) => sum + seg.heightRem, 0);

    return { top, height };
  };

  const timeReferences = useMemo(() => {
    if (events.length === 0 || globalTimeline.length === 0) return [];

    const allStartMinutes = events.map(e => timeToMinutes(e.start_time));
    const allEndMinutes = events.map(e => timeToMinutes(e.end_time));

    const dayStart = Math.min(...allStartMinutes);
    const dayEnd = Math.max(...allEndMinutes);

    const cantineRange = findCantineTimeRange(events);

    const references: { time: string; position: number; label: string }[] = [];

    const dayStartEvent = events.find(e => timeToMinutes(e.start_time) === dayStart);
    if (dayStartEvent) {
      const pos = getEventPosition(dayStartEvent);
      references.push({
        time: dayStartEvent.start_time,
        position: pos.top,
        label: 'Début'
      });
    }

    if (cantineRange) {
      const cantineStartSegment = globalTimeline.find(
        seg => timeToMinutes(seg.startTime) === timeToMinutes(cantineRange.startTime)
      );
      const cantineEndSegment = globalTimeline.find(
        seg => timeToMinutes(seg.endTime) === timeToMinutes(cantineRange.endTime)
      );

      if (cantineStartSegment) {
        references.push({
          time: cantineRange.startTime,
          position: cantineStartSegment.topPositionRem,
          label: 'Cantine'
        });
      }

      if (cantineEndSegment) {
        references.push({
          time: cantineRange.endTime,
          position: cantineEndSegment.topPositionRem + cantineEndSegment.heightRem,
          label: 'Fin cantine'
        });
      }
    }

    const dayEndEvent = events.find(e => timeToMinutes(e.end_time) === dayEnd);
    if (dayEndEvent) {
      const pos = getEventPosition(dayEndEvent);
      references.push({
        time: dayEndEvent.end_time,
        position: pos.top + pos.height,
        label: 'Fin'
      });
    }

    return references;
  }, [events, globalTimeline]);

  const getSortedDayEvents = (dayId: number): Event[] => {
    return events
      .filter(e => e.day_of_week === dayId)
      .sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));
  };

  const getDayGaps = (dayId: number): Array<{ top: number; height: number; startTime: string }> => {
    const dayEvents = getSortedDayEvents(dayId);
    if (dayEvents.length === 0) return [];

    const gaps: Array<{ top: number; height: number; startTime: string }> = [];

    for (let i = 0; i < dayEvents.length - 1; i++) {
      const currentEvent = dayEvents[i];
      const nextEvent = dayEvents[i + 1];

      if (currentEvent.end_time !== nextEvent.start_time) {
        const gapSegments = globalTimeline.filter(
          seg => timeToMinutes(seg.startTime) >= timeToMinutes(currentEvent.end_time) &&
                 timeToMinutes(seg.endTime) <= timeToMinutes(nextEvent.start_time)
        );

        if (gapSegments.length > 0) {
          const top = gapSegments[0].topPositionRem;
          const height = gapSegments.reduce((sum, seg) => sum + seg.heightRem, 0);
          gaps.push({ top, height, startTime: currentEvent.end_time });
        }
      }
    }

    return gaps;
  };

  // Calcul des chevauchements pour affichage côte à côte
  const overlapInfoMap = useMemo(() => {
    return detectOverlapsAllDays(events, timeToMinutes);
  }, [events]);

  useEffect(() => {
    loadEvents();
    loadStudent();
    loadPeriod();
  }, [student.id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) {
          undo(loadEvents);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canUndo, undo]);

  const loadStudent = async () => {
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('id', student.id)
      .maybeSingle();

    if (error) {
      console.error('Error loading student:', error);
    } else if (data) {
      setStudent(data as any);
    }
  };

  const loadPeriod = async () => {
    const { data, error } = await supabase
      .from('periods')
      .select('name')
      .eq('id', student.period_id)
      .maybeSingle();

    if (error) {
      console.error('Error loading period:', error);
    } else if (data) {
      setPeriodName(data.name);
    }
  };

  const loadEvents = async () => {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('student_id', student.id);

    if (error) {
      console.error('Error loading events:', error);
    } else {
      console.log('📅 TimetableGrid: Loaded', (data || []).length, 'events');
      setEvents(data || []);
    }
  };

  const calculatePercentages = useMemo(() => {
    const eventsForPercentages = student.include_vie_scolaire_in_percentages
      ? events
      : events.filter(e => e.type !== 'VIE_SCOLAIRE');

    const totalMinutes = eventsForPercentages.reduce((sum, event) => {
      return sum + calculateEventDuration(event.start_time, event.end_time);
    }, 0);

    const ulisMinutes = events
      .filter(e => e.type === 'ULIS')
      .reduce((sum, event) => sum + calculateEventDuration(event.start_time, event.end_time), 0);

    const classeMinutes = events
      .filter(e => e.type === 'CLASSE')
      .reduce((sum, event) => sum + calculateEventDuration(event.start_time, event.end_time), 0);

    const priseEnChargeMinutes = events
      .filter(e => e.type === 'PRISE_EN_CHARGE')
      .reduce((sum, event) => sum + calculateEventDuration(event.start_time, event.end_time), 0);

    const aeshMinutes = events
      .filter(e => e.aesh)
      .reduce((sum, event) => sum + calculateEventDuration(event.start_time, event.end_time), 0);

    const calculatePercentage = (minutes: number) => {
      if (totalMinutes === 0) return 0;
      return Math.round((minutes / totalMinutes) * 100);
    };

    return {
      inclusion: calculatePercentage(classeMinutes),
      ulis: calculatePercentage(ulisMinutes),
      aesh: calculatePercentage(aeshMinutes),
      prisesEnCharge: calculatePercentage(priseEnChargeMinutes),
    };
  }, [events, student.include_vie_scolaire_in_percentages]);

  const handleAddEvent = (day: number, startTime: string) => {
    setNewEventData({ day, startTime });
    setSelectedEvent(null);
    setShowEventModal(true);
  };

  const handleAddEventAfterLast = (dayId: number) => {
    const dayEvents = getSortedDayEvents(dayId);
    if (dayEvents.length === 0) {
      handleAddEvent(dayId, '08:30');
      return;
    }

    const lastEvent = dayEvents[dayEvents.length - 1];
    const startTime = lastEvent.end_time;
    const startMinutes = timeToMinutes(startTime);
    const maxMinutes = 18 * 60;

    if (startMinutes >= maxMinutes) {
      alert('La journée est déjà complète (fin à 18h00 ou après)');
      return;
    }

    handleAddEvent(dayId, startTime);
  };

  const handleEditEvent = (event: Event) => {
    setSelectedEvent(event);
    setNewEventData(null);
    setShowEventModal(true);
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('Supprimer cet événement ?')) return;

    const eventToDelete = events.find(e => e.id === eventId);
    if (!eventToDelete) return;

    await captureState();

    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', eventId);

    if (error) {
      console.error('Error deleting event:', error);
    } else {
      loadEvents();

      setUndoAction({
        type: 'delete',
        message: 'Créneau supprimé',
        event: eventToDelete
      });
    }
  };

  const handleUndoDelete = async (eventData: Event) => {
    const { id, ...eventWithoutId } = eventData;

    const { error } = await supabase
      .from('events')
      .insert([eventWithoutId]);

    if (error) {
      console.error('Error restoring event:', error);
      alert('Erreur lors de la restauration du créneau');
    } else {
      loadEvents();
      setUndoAction(null);
    }
  };

  const handleModalClose = () => {
    if (newEventData && !selectedEvent) {
      setUndoAction({
        type: 'cancel-create',
        message: 'Création annulée',
        newEventData: newEventData
      });
    } else if (selectedEvent) {
      setUndoAction({
        type: 'cancel-edit',
        message: 'Modification annulée',
        event: selectedEvent
      });
    }

    setShowEventModal(false);
    setSelectedEvent(null);
    setNewEventData(null);
  };

  const handleUndo = () => {
    if (!undoAction) return;

    switch (undoAction.type) {
      case 'delete':
        if (undoAction.event) {
          handleUndoDelete(undoAction.event);
        }
        break;
      case 'cancel-create':
        if (undoAction.newEventData) {
          setNewEventData(undoAction.newEventData);
          setSelectedEvent(null);
          setShowEventModal(true);
          setUndoAction(null);
        }
        break;
      case 'cancel-edit':
        if (undoAction.event) {
          setSelectedEvent(undoAction.event);
          setNewEventData(null);
          setShowEventModal(true);
          setUndoAction(null);
        }
        break;
    }
  };

  const handleToggleVieScolaireInPercentages = async () => {
    const newValue = !student.include_vie_scolaire_in_percentages;

    const { error } = await supabase
      .from('students')
      .update({ include_vie_scolaire_in_percentages: newValue })
      .eq('id', student.id);

    if (error) {
      console.error('Error updating setting:', error);
    } else {
      setStudent({ ...student, include_vie_scolaire_in_percentages: newValue });
    }
  };

  const handleOpenPrintView = () => {
    const params = new URLSearchParams({
      type: 'individual',
      studentId: student.id,
      periodId: student.period_id
    });
    navigate(`/print?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-4">
      <div className="max-w-none mx-auto">
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

        <div className="flex gap-4 items-start">
          {showPdf && (
            <div className="w-1/3 min-w-[400px]">
              <div className="sticky top-4 h-[calc(100vh-8rem)]">
                <PdfViewer student={student} onPdfUpdate={loadStudent} />
              </div>
            </div>
          )}

          <button
            onClick={() => setShowPdf(!showPdf)}
            className="fixed left-4 top-1/2 -translate-y-1/2 z-10 bg-white hover:bg-gray-100 p-2 rounded-lg shadow-lg border border-gray-200 transition-colors"
            title={showPdf ? 'Masquer le PDF' : 'Afficher le PDF'}
          >
            {showPdf ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </button>

          <div className={`${showPdf ? 'flex-1' : 'w-full'} transition-all`}>
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-gray-800">
                    Emploi du temps - {student.first_name} {student.last_name}
                  </h1>
                  <p className="text-gray-600 text-sm">
                    {events.length} événement{events.length !== 1 ? 's' : ''}
                  </p>
                </div>

                <div className="flex gap-3 flex-wrap">
                  <button
                    onClick={() => {
                      setNewEventData({ day: 1, startTime: '08:30' });
                      setSelectedEvent(null);
                      setShowEventModal(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-semibold shadow-md"
                  >
                    <Plus className="w-5 h-5" />
                    <span>Ajouter un créneau</span>
                  </button>
                  <button
                    onClick={() => undo(loadEvents)}
                    disabled={!canUndo}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors font-semibold shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-600"
                    title="Revenir en arrière (Ctrl+Z / Cmd+Z)"
                  >
                    <Undo className="w-5 h-5" />
                    <span>Revenir en arrière</span>
                  </button>
                  <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg">
                    <button
                      onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
                      className="p-1 hover:bg-gray-200 rounded transition-colors"
                      disabled={zoom <= 0.5}
                    >
                      <ZoomOut className="w-4 h-4" />
                    </button>
                    <span className="text-sm font-medium text-gray-700 min-w-[3rem] text-center">
                      {Math.round(zoom * 100)}%
                    </span>
                    <button
                      onClick={() => setZoom(Math.min(2, zoom + 0.25))}
                      className="p-1 hover:bg-gray-200 rounded transition-colors"
                      disabled={zoom >= 2}
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    onClick={() => setShowStats(!showStats)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-colors"
                  >
                    <Calculator className="w-5 h-5" />
                    <span>{showStats ? 'Masquer' : 'Voir'} stats</span>
                  </button>
                  <button
                    onClick={handleOpenPrintView}
                    className="flex items-center gap-2 px-4 py-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg transition-colors font-semibold"
                    title="Imprimer ou enregistrer en PDF"
                  >
                    <FileDown className="w-5 h-5" />
                    <span>Imprimer / PDF</span>
                  </button>
                  <button
                    onClick={() => {
                      const params = new URLSearchParams({
                        studentId: student.id,
                        periodId: student.period_id,
                        showWednesday: String(showWednesday)
                      });
                      navigate(`/print-picto?${params.toString()}`);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg transition-colors font-semibold"
                    title="Imprimer un EDT adapté avec pictogrammes"
                  >
                    <LayoutGrid className="w-5 h-5" />
                    <span>EDT pictogrammes</span>
                  </button>
                  <button
                    onClick={() => setShowAiModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-violet-100 hover:bg-violet-200 text-violet-700 rounded-lg transition-colors font-semibold"
                    title="Pré-remplir le planning depuis un document"
                  >
                    <Sparkles className="w-5 h-5" />
                    <span>Pré-remplir avec l'IA</span>
                  </button>
                  <button
                    onClick={() => setShowDuplicateModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg transition-colors font-semibold"
                    title="Dupliquer cet emploi du temps vers d'autres élèves"
                  >
                    <Copy className="w-5 h-5" />
                    <span>Dupliquer cet emploi du temps...</span>
                  </button>
                </div>
              </div>

              {showStats && (
                <div className="mb-6">
                  <SummaryStats
                    events={events}
                    includeVieScolaireInPercentages={student.include_vie_scolaire_in_percentages}
                  />

                  <div className="mt-4 flex items-center gap-3 p-4 bg-pink-50 rounded-lg border border-pink-200">
                    <input
                      type="checkbox"
                      id="includeVieScolaire"
                      checked={student.include_vie_scolaire_in_percentages}
                      onChange={handleToggleVieScolaireInPercentages}
                      className="w-5 h-5 text-pink-600 rounded focus:ring-pink-500"
                    />
                    <label htmlFor="includeVieScolaire" className="text-sm font-medium text-gray-700 cursor-pointer">
                      Inclure la vie scolaire dans le calcul des pourcentages
                    </label>
                  </div>
                </div>
              )}

              <PhotosPanel student={student} onUpdate={loadStudent} />

              <div className="mb-4 flex gap-4">
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <input
                    type="checkbox"
                    id="showWednesday"
                    checked={showWednesday}
                    onChange={(e) => setShowWednesday(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="showWednesday" className="text-sm font-medium text-gray-700 cursor-pointer">
                    Afficher le mercredi
                  </label>
                </div>
              </div>

          <div className="overflow-x-auto">
            <div className="min-w-[1400px]">
              <div className="flex gap-2">
                <div className="w-20 flex-shrink-0"></div>
                <div className="flex-1 grid gap-3 mb-2" style={{ gridTemplateColumns: `repeat(${visibleDays.length}, minmax(220px, 1fr))` }}>
                  {visibleDays.map((day) => (
                    <div key={day.id} className="font-semibold text-gray-700 text-center text-base p-2">
                      {day.name}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <div className="w-20 flex-shrink-0 relative" style={{ minHeight: `${totalGridHeight}rem` }}>
                  {timeReferences.map((ref, idx) => (
                    <div
                      key={idx}
                      className="absolute left-0 right-0 text-sm text-gray-600 font-medium"
                      style={{ top: `${ref.position}rem` }}
                    >
                      <div className="text-right pr-2">{ref.time}</div>
                    </div>
                  ))}
                </div>

                <div className="flex-1 grid gap-3" style={{ gridTemplateColumns: `repeat(${visibleDays.length}, minmax(220px, 1fr))` }}>
                {visibleDays.map((day) => {
                  const dayEvents = getSortedDayEvents(day.id);
                  const dayGaps = getDayGaps(day.id);

                  return (
                    <div
                      key={day.id}
                      className="relative border-2 border-gray-300 rounded-lg overflow-visible"
                      style={{ minHeight: `${totalGridHeight}rem` }}
                    >
                      {dayEvents.length === 0 ? (
                        <button
                          onClick={() => handleAddEvent(day.id, '08:30')}
                          className="absolute inset-0 flex items-center justify-center text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                        >
                          <Plus className="w-6 h-6" />
                        </button>
                      ) : (
                        <>
                          {dayEvents.map((event) => {
                            const { top, height } = getEventPosition(event);

                            // PRISE_EN_CHARGE : toujours pleine largeur, z-index maximal
                            const isPEC = event.type === 'PRISE_EN_CHARGE';
                            const overlapInfo = isPEC ? undefined : overlapInfoMap.get(event.id);
                            const colIndex = overlapInfo?.columnIndex ?? 0;
                            const colCount = overlapInfo?.overlapCount ?? 1;
                            const widthPct = isPEC ? 100 : 100 / colCount;
                            const leftPct = isPEC ? 0 : colIndex * widthPct;
                            const zIdx = isPEC ? 999 : getEventZIndex(event);

                            return (
                              <div
                                key={event.id}
                                className="absolute"
                                style={{
                                  top: `${top}rem`,
                                  height: `${height}rem`,
                                  left: `calc(${leftPct}% + 0.25rem)`,
                                  width: `calc(${widthPct}% - 0.5rem)`,
                                  zIndex: zIdx
                                }}
                              >
                                <EventBlock
                                  event={event}
                                  heightRem={height}
                                  onEdit={handleEditEvent}
                                  onDelete={handleDeleteEvent}
                                />
                              </div>
                            );
                          })}

                          {dayGaps.map((gap, idx) => (
                            <button
                              key={`gap-${idx}`}
                              onClick={() => handleAddEvent(day.id, gap.startTime)}
                              className="absolute left-0 right-0 flex items-center justify-center text-gray-300 hover:bg-blue-50 hover:text-blue-500 transition-colors group"
                              style={{
                                top: `${gap.top}rem`,
                                height: `${gap.height}rem`
                              }}
                            >
                              <div className="bg-white rounded-full p-1 shadow-sm border border-gray-200 group-hover:border-blue-400 group-hover:shadow-md transition-all">
                                <Plus className="w-4 h-4" />
                              </div>
                            </button>
                          ))}

                          {dayEvents.length > 0 && (() => {
                            const lastEvent = dayEvents[dayEvents.length - 1];
                            const { top, height } = getEventPosition(lastEvent);
                            const buttonTop = top + height;

                            return (
                              <button
                                key="add-after-last"
                                onClick={() => handleAddEventAfterLast(day.id)}
                                className="absolute left-0 right-0 flex items-center justify-center text-gray-300 hover:bg-blue-50 hover:text-blue-500 transition-colors group py-2"
                                style={{
                                  top: `${buttonTop}rem`,
                                  height: '2.5rem'
                                }}
                                title="Ajouter un créneau à la suite"
                              >
                                <div className="bg-white rounded-full p-1 shadow-sm border border-gray-200 group-hover:border-blue-400 group-hover:shadow-md transition-all">
                                  <Plus className="w-4 h-4" />
                                </div>
                              </button>
                            );
                          })()}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
              </div>
            </div>
          </div>
            </div>
          </div>
        </div>
      </div>

      {showEventModal && (
        <EventModal
          student={student}
          event={selectedEvent}
          initialDay={newEventData?.day}
          initialStartTime={newEventData?.startTime}
          onBeforeSave={captureState}
          onClose={handleModalClose}
          onSave={() => {
            loadEvents();
            setShowEventModal(false);
            setSelectedEvent(null);
            setNewEventData(null);
            setUndoAction(null);
          }}
        />
      )}

      {showAiModal && (
        <AiPrefillModal
          student={student}
          onClose={() => setShowAiModal(false)}
          onSuccess={() => {
            setShowAiModal(false);
            loadEvents();
          }}
        />
      )}

      {showDuplicateModal && (
        <DuplicateTimetableModal
          sourceStudent={student}
          periodId={student.period_id}
          onClose={() => setShowDuplicateModal(false)}
          onDuplicate={() => {
            setShowDuplicateModal(false);
          }}
        />
      )}

      {undoAction && (
        <UndoToast
          message={undoAction.message}
          onUndo={handleUndo}
          onDismiss={() => setUndoAction(null)}
        />
      )}
    </div>
  );
}
