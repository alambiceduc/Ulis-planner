import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { HomeButton } from './HomeButton';
import { DAYS } from '../lib/timeUtils';
import { timeToMinutes } from '../lib/timeUtils';
import { getAutoPicto } from '../utils/pictoMap';
import type { Student, Event } from '../lib/database.types';

const TYPE_BG: Record<string, string> = {
  ULIS:'#dbeafe', CLASSE:'#dcfce7', PRISE_EN_CHARGE:'#f3f4f6', VIE_SCOLAIRE:'#fce7f3',
};
const TYPE_BORDER: Record<string, string> = {
  ULIS:'#93c5fd', CLASSE:'#86efac', PRISE_EN_CHARGE:'#d1d5db', VIE_SCOLAIRE:'#f9a8d4',
};
const TYPE_TEXT: Record<string, string> = {
  ULIS:'#1e40af', CLASSE:'#166534', PRISE_EN_CHARGE:'#374151', VIE_SCOLAIRE:'#9d174d',
};

function PersonCard({ url, label, initials, bg }: { url:string|null; label:string; initials:string; bg:string }) {
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:3}}>
      {url ? (
        <img src={url} alt={label} style={{width:44,height:44,borderRadius:'50%',objectFit:'cover',border:'2px solid #e5e7eb'}} />
      ) : (
        <div style={{width:44,height:44,borderRadius:'50%',background:bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:'#374151',border:'2px solid #e5e7eb'}}>{initials}</div>
      )}
      <span style={{fontSize:9,color:'#6b7280',textAlign:'center',lineHeight:1.2}}>{label}</span>
    </div>
  );
}

export function PrintPicto() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const studentId = searchParams.get('studentId');
  const periodId  = searchParams.get('periodId');
  const showWed   = searchParams.get('showWednesday') !== 'false';

  const [student, setStudent] = useState<Student|null>(null);
  const [events,  setEvents]  = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string|null>(null);

  useEffect(() => {
    if (!studentId || !periodId) return;
    (async () => {
      try {
        const {data:s,error:se} = await supabase.from('students').select('*').eq('id',studentId).single();
        if (se) throw se;
        setStudent(s as Student);
        const {data:ev,error:ee} = await supabase.from('events').select('*').eq('student_id',studentId);
        if (ee) throw ee;
        setEvents(ev || []);
      } catch(e:any) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, [studentId, periodId]);

  if (!studentId || !periodId) return <div style={{padding:24,color:'red'}}>Paramètres manquants</div>;
  if (loading) return <div style={{padding:24}}>Chargement…</div>;
  if (error || !student) return <div style={{padding:24,color:'red'}}>Erreur : {error}</div>;

  const visibleDays = showWed ? DAYS : DAYS.filter(d => d.id !== 3);

  // Créneaux uniques triés chronologiquement
  const allSlotKeys = new Set<string>();
  events.forEach(e => allSlotKeys.add(`${e.start_time}|${e.end_time}`));
  const sortedSlots = Array.from(allSlotKeys)
    .map(k => { const [s,e] = k.split('|'); return {start:s,end:e}; })
    .sort((a,b) => timeToMinutes(a.start) - timeToMinutes(b.start));

  // Hauteur de ligne : répartir dans ~155mm
  const rowHeightMM = Math.max(7, Math.floor(155 / sortedSlots.length));

  return (
    <div style={{background:'white',minHeight:'100vh',paddingTop:58}}>

      {/* Bannière écran */}
      <div className="no-print" style={{
        position:'fixed',top:0,left:0,right:0,zIndex:1000,
        background:'linear-gradient(135deg,#667eea,#764ba2)',
        color:'white',padding:'8px 16px',
        display:'flex',alignItems:'center',justifyContent:'space-between'
      }}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <button onClick={() => navigate(-1)} style={{display:'flex',alignItems:'center',gap:6,background:'rgba(255,255,255,0.2)',border:'none',color:'white',borderRadius:8,padding:'5px 12px',cursor:'pointer',fontWeight:600,fontSize:13}}>
            <ArrowLeft size={15}/> Retour
          </button>
          <div style={{borderLeft:'1px solid rgba(255,255,255,0.3)',paddingLeft:10,fontSize:13,fontWeight:700}}>
            EDT pictogrammes — {student.first_name} {student.last_name}
          </div>
          <div className="[&>button]:bg-white/20 [&>button]:text-white [&>button]:border-white/30 [&>button]:shadow-none [&>button]:text-sm [&>button]:px-3 [&>button]:py-1.5">
            <HomeButton onNavigateHome={() => { window.location.href = '/'; }} />
          </div>
        </div>
        <button onClick={() => window.print()} style={{background:'white',color:'#667eea',border:'none',borderRadius:8,padding:'7px 18px',fontWeight:700,fontSize:13,cursor:'pointer'}}>
          Imprimer (A4 paysage)
        </button>
      </div>

      {/* Page imprimable */}
      <div id="picto-page" style={{padding:'10px 14px'}}>

        {/* En-tête */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8,borderBottom:'2px solid #e5e7eb',paddingBottom:8}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            {student.photo_student_url && (
              <img src={student.photo_student_url} alt={student.first_name} style={{width:48,height:48,borderRadius:'50%',objectFit:'cover',border:'2px solid #e5e7eb'}} />
            )}
            <div style={{fontSize:16,fontWeight:700,color:'#1f2937'}}>
              Mon emploi du temps — {student.first_name} {student.last_name}
            </div>
          </div>
          <div style={{display:'flex',gap:14,alignItems:'flex-end'}}>
            <PersonCard url={student.photo_teacher_url} label="Mon enseignant(e)" initials="EN" bg="#dcfce7" />
            <PersonCard url={student.photo_coordo_url}  label="Coordo ULIS"       initials="CO" bg="#ede9fe" />
            {(student.photo_aesh_url || events.some(e => e.aesh)) && (
              <PersonCard url={student.photo_aesh_url} label="Mon AESH" initials="AE" bg="#ffedd5" />
            )}
          </div>
        </div>

        {/* Légende */}
        <div style={{display:'flex',gap:10,marginBottom:6,flexWrap:'wrap'}}>
          {[['ULIS','ULIS'],['CLASSE','Classe'],['PRISE_EN_CHARGE','Prise en charge'],['VIE_SCOLAIRE','Vie scolaire']].map(([type,label]) => (
            <div key={type} style={{display:'flex',alignItems:'center',gap:4,fontSize:9}}>
              <div style={{width:10,height:10,borderRadius:3,background:TYPE_BG[type],border:`1.5px solid ${TYPE_BORDER[type]}`}} />
              <span style={{color:'#4b5563'}}>{label}</span>
            </div>
          ))}
        </div>

        {/* Tableau */}
        <table style={{width:'100%',borderCollapse:'collapse',tableLayout:'fixed',fontSize:10}}>
          <thead>
            <tr>
              <th style={{width:50,padding:'3px 4px',fontSize:9,color:'#9ca3af',fontWeight:500,textAlign:'center',borderBottom:'2px solid #e5e7eb',background:'#f9fafb'}}>
                Horaires
              </th>
              {visibleDays.map(day => (
                <th key={day.id} style={{padding:'3px 4px',fontWeight:700,fontSize:11,color:'#374151',textAlign:'center',borderBottom:'2px solid #e5e7eb',background:'#f9fafb'}}>
                  {day.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedSlots.map((slot, idx) => (
              <tr key={idx} style={{height:`${rowHeightMM}mm`}}>
                {/* Horaire */}
                <td style={{padding:'2px 4px',textAlign:'center',verticalAlign:'middle',borderRight:'1px solid #f0f0f0',borderBottom:'1px solid #f0f0f0',background:'#f9fafb'}}>
                  <div style={{fontSize:8,fontWeight:600,color:'#374151',lineHeight:1.2}}>{slot.start}</div>
                  <div style={{fontSize:7,color:'#9ca3af',lineHeight:1.2}}>{slot.end}</div>
                </td>
                {/* Créneaux par jour */}
                {visibleDays.map(day => {
                  const ev = events.find(e => e.day_of_week === day.id && e.start_time === slot.start && e.end_time === slot.end);
                  if (!ev) return <td key={day.id} style={{padding:2,borderBottom:'1px solid #f0f0f0',borderRight:'1px solid #f0f0f0',background:'#fafafa'}} />;

                  const picto  = ev.picto || getAutoPicto(ev.label);
                  const bg     = TYPE_BG[ev.type]     || '#f3f4f6';
                  const border = TYPE_BORDER[ev.type]  || '#d1d5db';
                  const text   = TYPE_TEXT[ev.type]    || '#374151';
                  const big    = rowHeightMM >= 11;

                  return (
                    <td key={day.id} style={{padding:3,verticalAlign:'middle',borderBottom:'1px solid #f0f0f0',borderRight:'1px solid #f0f0f0'}}>
                      <div style={{background:bg,border:`1.5px solid ${border}`,borderRadius:5,padding:'2px 4px',height:'100%',boxSizing:'border-box',display:'flex',alignItems:'center',gap:4,overflow:'hidden'}}>
                        <span style={{fontSize: big ? 15 : 11, lineHeight:1, flexShrink:0}}>{picto}</span>
                        {ev.label && (
                          <span style={{fontSize: big ? 9 : 7, fontWeight:600, color:text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', lineHeight:1.2}}>
                            {ev.label}
                          </span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 5mm; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .no-print { display: none !important; }
          html, body { margin: 0 !important; padding: 0 !important; }
          #picto-page { padding: 0 !important; }
        }
      `}</style>
    </div>
  );
}
