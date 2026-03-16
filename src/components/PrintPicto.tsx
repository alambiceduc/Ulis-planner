import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { HomeButton } from './HomeButton';
import { DAYS } from '../lib/timeUtils';
import { timeToMinutes } from '../lib/timeUtils';
import { getAutoPicto } from '../utils/pictoMap';
import type { Student, Event } from '../lib/database.types';

// ─── Couleurs pastel par type ────────────────────────────────────────────────
const TYPE_STYLE: Record<string, { bg: string; border: string; text: string }> = {
  ULIS:           { bg: '#dbeafe', border: '#93c5fd', text: '#1e40af' },
  CLASSE:         { bg: '#dcfce7', border: '#86efac', text: '#166534' },
  PRISE_EN_CHARGE:{ bg: '#f3f4f6', border: '#d1d5db', text: '#374151' },
  VIE_SCOLAIRE:   { bg: '#fce7f3', border: '#f9a8d4', text: '#9d174d' },
};

// ─── Carte d'une personne référente ──────────────────────────────────────────
function PersonCard({ url, label, initials, color }: {
  url: string | null; label: string; initials: string; color: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 64 }}>
      {url ? (
        <img
          src={url}
          alt={label}
          style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', border: '2px solid #e5e7eb' }}
        />
      ) : (
        <div style={{
          width: 52, height: 52, borderRadius: '50%',
          background: color, display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 14, fontWeight: 600,
          border: '2px solid #e5e7eb', color: '#374151'
        }}>
          {initials}
        </div>
      )}
      <span style={{ fontSize: 10, color: '#6b7280', textAlign: 'center', lineHeight: 1.2 }}>{label}</span>
    </div>
  );
}

// ─── Bloc créneau ────────────────────────────────────────────────────────────
function EventCard({ event, heightPx, studentPhotoUrl }: {
  event: Event; heightPx: number; studentPhotoUrl: string | null;
}) {
  const style = TYPE_STYLE[event.type] || TYPE_STYLE.ULIS;
  const picto = event.picto || getAutoPicto(event.label);
  const isCompact = heightPx < 60;
  const showPhoto = !!studentPhotoUrl && !isCompact && heightPx >= 80;

  return (
    <div style={{
      background: style.bg,
      border: `2px solid ${style.border}`,
      borderRadius: 8,
      padding: isCompact ? '2px 6px' : '4px 8px',
      height: '100%',
      boxSizing: 'border-box',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      gap: 2,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {showPhoto ? (
          <img
            src={studentPhotoUrl!}
            alt=""
            style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
          />
        ) : (
          <span style={{ fontSize: isCompact ? 14 : 20, lineHeight: 1, flexShrink: 0 }}>{picto}</span>
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: isCompact ? 9 : 11,
            fontWeight: 700,
            color: style.text,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {event.start_time}–{event.end_time}
          </div>
          {event.label && (
            <div style={{
              fontSize: isCompact ? 8 : 10,
              fontWeight: 600,
              color: style.text,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {event.label}
            </div>
          )}
          {!isCompact && event.location && (
            <div style={{
              fontSize: 9,
              color: style.text,
              opacity: 0.75,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {event.location}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────
export function PrintPicto() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const studentId = searchParams.get('studentId');
  const periodId = searchParams.get('periodId');
  const showWednesdayParam = searchParams.get('showWednesday');
  const showWednesday = showWednesdayParam !== 'false';

  const [student, setStudent] = useState<Student | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!studentId || !periodId) return;
    loadData();
  }, [studentId, periodId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const { data: studentData, error: studentError } = await supabase
        .from('students').select('*').eq('id', studentId!).single();
      if (studentError) throw studentError;
      setStudent(studentData as Student);

      const { data: eventsData, error: eventsError } = await supabase
        .from('events').select('*').eq('student_id', studentId!);
      if (eventsError) throw eventsError;
      setEvents(eventsData || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!studentId || !periodId) {
    return <div style={{ padding: 24, color: 'red' }}>Paramètres manquants</div>;
  }
  if (loading) {
    return <div style={{ padding: 24 }}>Chargement...</div>;
  }
  if (error || !student) {
    return <div style={{ padding: 24, color: 'red' }}>Erreur : {error}</div>;
  }

  // ── Calcul de la grille temporelle ──────────────────────────────────────
  const visibleDays = showWednesday ? DAYS : DAYS.filter(d => d.id !== 3);

  const allTimes = new Set<number>();
  events.forEach(e => {
    allTimes.add(timeToMinutes(e.start_time));
    allTimes.add(timeToMinutes(e.end_time));
  });
  // Bornes par défaut si pas d'événements
  allTimes.add(8 * 60 + 30);
  allTimes.add(16 * 60 + 30);

  const sortedTimes = Array.from(allTimes).sort((a, b) => a - b);
  const gridStart = sortedTimes[0];
  const gridEnd = sortedTimes[sortedTimes.length - 1];
  const totalMinutes = gridEnd - gridStart;

  // Hauteur de la zone de grille en pixels (A4 paysage ≈ 210mm utiles en hauteur)
  const GRID_HEIGHT_PX = 480;
  const PX_PER_MIN = GRID_HEIGHT_PX / totalMinutes;
  const TIME_COL_W = 44;
  const DAY_COL_W = `${Math.floor((100 - 6) / visibleDays.length)}%`;

  const minutesToPx = (min: number) => (min - gridStart) * PX_PER_MIN;
  const fmt = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

  // Repères horaires à afficher (toutes les 30 min)
  const timeLabels: number[] = [];
  for (let m = gridStart; m <= gridEnd; m += 30) timeLabels.push(m);

  return (
    <div style={{ background: 'white', minHeight: '100vh', paddingTop: 64 }}>
      {/* ── Bannière écran uniquement ── */}
      <div className="no-print" style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
        background: 'linear-gradient(135deg,#667eea,#764ba2)',
        color: 'white', padding: '10px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => navigate(-1)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
          >
            <ArrowLeft size={16} /> Retour
          </button>
          <div style={{ borderLeft: '1px solid rgba(255,255,255,0.3)', paddingLeft: 10 }}>
            <div style={{ fontSize: 11, opacity: 0.85 }}>EDT pictogrammes</div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{student.first_name} {student.last_name}</div>
          </div>
          <div className="[&>button]:bg-white/20 [&>button]:text-white [&>button]:border-white/30 [&>button]:shadow-none [&>button]:text-sm [&>button]:px-3 [&>button]:py-1.5">
            <HomeButton onNavigateHome={() => { window.location.href = '/'; }} />
          </div>
        </div>
        <button
          onClick={() => window.print()}
          style={{ background: 'white', color: '#667eea', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
        >
          Imprimer (A4 paysage)
        </button>
      </div>

      {/* ── Page imprimable ── */}
      <div id="picto-page" style={{ padding: '12px 16px', maxWidth: 1100, margin: '0 auto' }}>

        {/* En-tête : nom élève + photos référents */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, borderBottom: '2px solid #e5e7eb', paddingBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {student.photo_student_url && (
              <img src={student.photo_student_url} alt={student.first_name}
                style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: '2px solid #e5e7eb' }} />
            )}
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#1f2937' }}>
                Mon emploi du temps — {student.first_name} {student.last_name}
              </div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>{events.length} créneaux</div>
            </div>
          </div>

          {/* Photos des adultes référents */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
            <PersonCard url={student.photo_teacher_url} label="Mon enseignant(e)" initials="EN" color="#dcfce7" />
            <PersonCard url={student.photo_coordo_url} label="Coordo ULIS" initials="CO" color="#ede9fe" />
            {(student.photo_aesh_url || events.some(e => e.aesh)) && (
              <PersonCard url={student.photo_aesh_url} label="Mon AESH" initials="AE" color="#ffedd5" />
            )}
          </div>
        </div>

        {/* Légende */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
          {Object.entries(TYPE_STYLE).map(([type, s]) => (
            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: s.bg, border: `1.5px solid ${s.border}` }} />
              <span style={{ color: '#4b5563' }}>
                {{ ULIS: 'ULIS', CLASSE: 'Classe', PRISE_EN_CHARGE: 'Prise en charge', VIE_SCOLAIRE: 'Vie scolaire' }[type]}
              </span>
            </div>
          ))}
        </div>

        {/* Grille */}
        <div style={{ display: 'flex', gap: 0 }}>

          {/* Colonne horaires */}
          <div style={{ width: TIME_COL_W, flexShrink: 0, position: 'relative', height: GRID_HEIGHT_PX }}>
            {timeLabels.map(t => (
              <div key={t} style={{
                position: 'absolute',
                top: minutesToPx(t),
                right: 4,
                fontSize: 9,
                color: '#9ca3af',
                lineHeight: 1,
                transform: 'translateY(-50%)',
              }}>
                {fmt(t)}
              </div>
            ))}
            {/* Lignes horizontales */}
            {timeLabels.map(t => (
              <div key={`line-${t}`} style={{
                position: 'absolute',
                top: minutesToPx(t),
                left: TIME_COL_W - 4,
                right: -8,
                height: 1,
                background: '#f3f4f6',
                zIndex: 0,
              }} />
            ))}
          </div>

          {/* Colonnes jours */}
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: `repeat(${visibleDays.length}, 1fr)`, gap: 4 }}>
            {visibleDays.map(day => {
              const dayEvents = events
                .filter(e => e.day_of_week === day.id)
                .sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));

              return (
                <div key={day.id} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {/* En-tête du jour */}
                  <div style={{
                    textAlign: 'center', fontWeight: 700, fontSize: 12,
                    color: '#374151', padding: '4px 0', marginBottom: 4,
                    borderBottom: '2px solid #e5e7eb',
                  }}>
                    {day.name}
                  </div>

                  {/* Zone de positionnement absolu des créneaux */}
                  <div style={{ position: 'relative', height: GRID_HEIGHT_PX }}>
                    {dayEvents.map(event => {
                      const top = minutesToPx(timeToMinutes(event.start_time));
                      const height = minutesToPx(timeToMinutes(event.end_time)) - top;

                      return (
                        <div key={event.id} style={{
                          position: 'absolute',
                          top,
                          left: 0,
                          right: 0,
                          height: Math.max(height, 24),
                          padding: '0 2px',
                          boxSizing: 'border-box',
                        }}>
                          <EventCard
                            event={event}
                            heightPx={height}
                            studentPhotoUrl={student.photo_student_url}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── CSS impression ── */}
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 6mm; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .no-print { display: none !important; }
          body { margin: 0 !important; padding: 0 !important; }
          #picto-page { padding: 0 !important; max-width: none !important; }
        }
      `}</style>
    </div>
  );
}
