import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Student, Event } from '../lib/database.types';
import { calculateEventDuration, timeToMinutes, DAYS } from '../lib/timeUtils';
import { PrintTableGrid } from './PrintTableGrid';
import { getUnifiedEventsForStudent } from '../services/unified-events.service';
import { applyPrintAutoFit } from '../utils/printAutoFit';

interface PrintIndividualProps {
  studentId: string;
  periodId: string;
  onFilenameGenerated: (filename: string) => void;
  isPrinting?: boolean;
}

export function PrintIndividual({ studentId, periodId, onFilenameGenerated, isPrinting = false }: PrintIndividualProps) {
  const [student, setStudent] = useState<Student | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [periodName, setPeriodName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    console.log('🔄 PrintIndividual: Loading data for', { studentId, periodId });
    loadData();
  }, [studentId, periodId]);

  useEffect(() => {
    if (!loading && events.length > 0) {
      console.log('✨ Content loaded, applying auto-fit...');
      setTimeout(() => {
        applyPrintAutoFit();
      }, 100);
    }
  }, [loading, events]);

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
        setError('Non connecté : vous devez être connecté pour imprimer un emploi du temps (protection RLS).');
        setLoading(false);
        return;
      }

      console.log('✅ Session present:', session.user.id);

      console.log('📥 Fetching student data...');
      const { data: studentData, error: studentError, status, statusText } = await supabase
        .from('students')
        .select('*')
        .eq('id', studentId)
        .maybeSingle();

      if (studentError) {
        console.error('❌ Error loading student:', {
          message: studentError.message,
          code: studentError.code,
          details: studentError.details,
          hint: studentError.hint,
          status,
          statusText
        });
        const isRLS = studentError.code === '42501' || studentError.message.includes('row-level security');
        if (isRLS) {
          setError(`Accès refusé (RLS) : vous n'avez pas les droits pour consulter cet élève.\n\nDétails : ${studentError.message}\nCode : ${studentError.code || 'N/A'}\nHint : ${studentError.hint || 'N/A'}`);
        } else {
          setError(`Erreur lors du chargement de l'élève:\n\nMessage : ${studentError.message}\nCode : ${studentError.code || 'N/A'}\nDétails : ${studentError.details || 'N/A'}\nHint : ${studentError.hint || 'N/A'}`);
        }
        setLoading(false);
        return;
      }

      if (!studentData) {
        console.error('❌ Student not found - possible RLS filter or deleted student');
        setError(`Élève introuvable : aucun élève ne correspond à l'ID "${studentId}".\n\nCauses possibles :\n- L'élève n'existe pas\n- Vous n'avez pas les droits de lecture (RLS)\n- L'élève a été supprimé`);
        setLoading(false);
        return;
      }

      console.log('✅ Student loaded:', studentData.first_name, studentData.last_name);
      setStudent(studentData);

      console.log('📥 Fetching period data...');
      const { data: periodData, error: periodError } = await supabase
        .from('periods')
        .select('name')
        .eq('id', periodId)
        .maybeSingle();

      if (periodError) {
        console.error('❌ Error loading period:', periodError);
        const isRLS = periodError.code === '42501' || periodError.message.includes('row-level security');
        if (isRLS) {
          setError(`Accès refusé : vous n'avez pas les droits pour consulter cette période.`);
        } else {
          setError(`Erreur lors du chargement de la période: ${periodError.message} (Code: ${periodError.code || 'N/A'})`);
        }
        setLoading(false);
        return;
      }

      if (periodData) {
        console.log('✅ Period loaded:', periodData.name);
        setPeriodName(periodData.name);
        onFilenameGenerated(`EDT_${studentData.first_name}_${periodData.name}.pdf`);
      } else {
        console.log('⚠️ Period not found, using default filename');
        onFilenameGenerated(`EDT_${studentData.first_name}.pdf`);
      }

      console.log('📥 Fetching unified events (base events + overlays)...');
      const unifiedEvents = await getUnifiedEventsForStudent(studentData);

      const eventCount = unifiedEvents.length;
      console.log(`✅ Unified events loaded: ${eventCount} événement(s)`);

      if (eventCount === 0) {
        console.log('ℹ️ Aucun événement trouvé - EDT vide (ce n\'est pas une erreur)');
      }

      setEvents(unifiedEvents);
      setLoading(false);
    } catch (err) {
      console.error('❌ Unexpected error:', err);
      setError(`Erreur inattendue: ${err instanceof Error ? err.message : String(err)}`);
      setLoading(false);
    }
  };


  const calculatePercentages = () => {
    const eventsForPercentages = student?.include_vie_scolaire_in_percentages
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
  };

  const getEventBlockColor = (event: Event) => {
    switch (event.type) {
      case 'CLASSE':
        return 'bg-blue-100 text-blue-800 border-blue-400';
      case 'ULIS':
        return 'bg-green-100 text-green-800 border-green-400';
      case 'PRISE_EN_CHARGE':
        return 'bg-white text-gray-800 border-gray-400';
      case 'VIE_SCOLAIRE':
        return 'bg-orange-100 text-orange-800 border-orange-400';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-400';
    }
  };

  const getDebugData = () => {
    if (events.length === 0) {
      return {
        totalCount: 0,
        firstStart: 'N/A',
        lastEnd: 'N/A',
        eventList: []
      };
    }

    const allStartMinutes = events.map(e => timeToMinutes(e.start_time));
    const allEndMinutes = events.map(e => timeToMinutes(e.end_time));
    const firstStartMinutes = Math.min(...allStartMinutes);
    const lastEndMinutes = Math.max(...allEndMinutes);

    const firstEvent = events.find(e => timeToMinutes(e.start_time) === firstStartMinutes);
    const lastEvent = events.find(e => timeToMinutes(e.end_time) === lastEndMinutes);

    const eventList = events.map(e => {
      const day = DAYS.find(d => d.id === e.day_of_week);
      return {
        day: day?.short || `J${e.day_of_week}`,
        timeRange: `${e.start_time}-${e.end_time}`,
        title: e.label || '(sans titre)',
        type: e.type,
        color: getEventBlockColor(e),
        location: e.location || ''
      };
    });

    return {
      totalCount: events.length,
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
          <p className="text-lg font-semibold text-gray-700">Chargement de l'emploi du temps...</p>
          <p className="text-sm text-gray-500 mt-2">StudentId: {studentId}</p>
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
            <p>StudentId: {studentId}</p>
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

  if (!student) {
    console.log('❌ Affichage: Student null');
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-8">
        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-6 max-w-lg">
          <h1 className="text-2xl font-bold text-yellow-800 mb-4">Élève introuvable</h1>
          <p className="text-yellow-700">Aucun élève ne correspond à cet identifiant.</p>
          <p className="text-sm text-gray-600 mt-2">StudentId: {studentId}</p>
        </div>
      </div>
    );
  }

  console.log('✅ Affichage: Rendu de la grille');

  const percentages = calculatePercentages();
  const debugData = getDebugData();

  return (
    <div className={`print-individual-content ${!isPrinting ? 'print-preview' : ''}`}>
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
              <p><strong>Total événements:</strong> {debugData.totalCount}</p>
              <p><strong>Première heure:</strong> {debugData.firstStart}</p>
              <p><strong>Dernière heure:</strong> {debugData.lastEnd}</p>
            </div>

            <div className="mb-2">
              <p className="font-semibold text-gray-800 mb-2">Liste des événements:</p>
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

      <div id="print-page" className="a4-content">
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
            <div className="print-header-compact">
              <h1 className="print-header-title">
                {student.first_name} {student.last_name} - {periodName}
              </h1>
              <div className="print-header-stats">
                Inclusion: {percentages.inclusion}% | ULIS: {percentages.ulis}% | AESH: {percentages.aesh}% | Prises en charge: {percentages.prisesEnCharge}%
              </div>
            </div>

            <PrintTableGrid
              events={events}
              showWednesday={false}
              getEventColor={getEventBlockColor}
              isPrinting={isPrinting}
              renderEventContent={(event) => (
                <>
                  {event.aesh && (
                    <div className="aesh-badge" style={{
                      position: 'absolute',
                      top: '2px',
                      right: '2px',
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      backgroundColor: '#f97316',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 10
                    }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                      </svg>
                    </div>
                  )}
                  <div className="font-bold text-sm mb-1">
                    {event.start_time}-{event.end_time}
                  </div>
                  {event.label && (
                    <div className="text-xs mb-0.5">
                      {event.label}
                    </div>
                  )}
                  {event.location && (
                    <div className="text-xs text-gray-600">
                      {event.location}
                    </div>
                  )}
                </>
              )}
            />
        </div>
      </div>
    </div>
  );
}
