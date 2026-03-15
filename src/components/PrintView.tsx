import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { PrintIndividual } from './PrintIndividual';
import { PrintCommon } from './PrintCommon';
import { HomeButton } from './HomeButton';

type PrintType = 'individual' | 'ulis_common' | 'aesh_common' | 'care_common';

export function PrintView() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [suggestedFilename, setSuggestedFilename] = useState('EDT.pdf');
  const [copied, setCopied] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<'checking' | 'present' | 'absent'>('checking');
  const [isPrinting, setIsPrinting] = useState(false);

  const type = searchParams.get('type') as PrintType;
  const studentId = searchParams.get('studentId');
  const periodId = searchParams.get('periodId');

  useEffect(() => {
    console.log('🖨️ PrintView mounted');
    console.log('📋 Params:', { type, studentId, periodId });
    document.title = 'Impression EDT';

    checkSession();
  }, [type, studentId, periodId]);

  const checkSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setSessionStatus(session ? 'present' : 'absent');
    console.log('🔐 Session status:', session ? 'PRESENT' : 'ABSENT');
  };

  const handleCopyFilename = () => {
    navigator.clipboard.writeText(suggestedFilename);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getPxFromMm = (mm: number) => {
    const probe = document.createElement("div");
    probe.style.position = "fixed";
    probe.style.left = "-99999px";
    probe.style.top = "0";
    probe.style.width = `${mm}mm`;
    probe.style.height = "1px";
    document.body.appendChild(probe);
    const px = probe.offsetWidth;
    document.body.removeChild(probe);
    return px;
  };

  const handlePrint = () => {
    console.log('🖨️ Starting print process - A4 Landscape FIT WIDTH');

    document.body.classList.add("printing");

    const root = document.querySelector("#print-fit-root");
    if (!(root instanceof HTMLElement)) {
      console.log('⚠️ print-fit-root not found, printing anyway');
      window.print();
      document.body.classList.remove("printing");
      return;
    }

    const page = document.createElement("div");
    page.style.position = "fixed";
    page.style.left = "-99999px";
    page.style.top = "0";
    page.style.width = "297mm";
    page.style.height = "210mm";
    document.body.appendChild(page);
    const pageW = page.offsetWidth;
    const pageH = page.offsetHeight;
    document.body.removeChild(page);

    const padTop = getPxFromMm(3);
    const padLR = getPxFromMm(3);
    const padBottom = getPxFromMm(3);

    const printableW = pageW - padLR * 2;
    const printableH = pageH - padTop - padBottom;

    const contentW = root.scrollWidth;
    const contentH = root.scrollHeight;

    console.log('📄 A4 landscape real size:', pageW, '×', pageH, 'px');
    console.log('📏 Printable area:', printableW, '×', printableH, 'px');
    console.log('📏 Content full size:', contentW, '×', contentH, 'px');

    const scaleW = printableW / contentW;
    const scaleH = printableH / contentH;

    let scale = scaleW;
    if (contentH * scale > printableH) scale = scaleH;
    scale = scale * 0.99;

    console.log('📐 Calculated scale (FIT WIDTH):', scale.toFixed(4), '(scaleW:', scaleW.toFixed(4), 'scaleH:', scaleH.toFixed(4), ')');

    document.body.style.setProperty("--print-scale", String(scale));

    console.log("DEBUG_PRINT_SCALE_APPLIED", {
      scale: getComputedStyle(document.body).getPropertyValue("--print-scale"),
      rootZoom: getComputedStyle(root).zoom,
    });

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const scaledW = contentW * scale;
        const scaledH = contentH * scale;
        console.log("DEBUG_PRINT", {
          pageW, pageH, printableW, printableH,
          contentW, contentH,
          scale,
          scaledW, scaledH,
          overflowH: scaledH - printableH,
          overflowW: scaledW - printableW,
        });
        console.log('🖨️ Opening print dialog');
        window.print();
      });
    });
  };

  useEffect(() => {
    const handleAfterPrint = () => {
      console.log('✅ Print completed, cleaning up...');
      document.body.classList.remove('printing');
      document.body.style.removeProperty('--print-scale');
    };

    window.addEventListener('afterprint', handleAfterPrint);

    return () => {
      window.removeEventListener('afterprint', handleAfterPrint);
      document.body.classList.remove('printing');
      document.body.style.removeProperty('--print-scale');
    };
  }, []);

  if (!type || !periodId) {
    console.error('❌ Paramètres manquants:', { type, periodId });
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-8">
        <div className="bg-red-50 border-2 border-red-300 rounded-lg p-6 max-w-lg">
          <h1 className="text-2xl font-bold text-red-800 mb-4">Paramètres manquants</h1>
          <p className="text-red-600 mb-4">Les paramètres suivants sont requis :</p>
          <ul className="list-disc list-inside text-red-700 space-y-1">
            <li>type : {type || '❌ manquant'}</li>
            <li>periodId : {periodId || '❌ manquant'}</li>
          </ul>
          <p className="mt-4 text-sm text-gray-600">
            URL actuelle : {window.location.href}
          </p>
        </div>
      </div>
    );
  }

  const validTypes = ['individual', 'ulis_common', 'aesh_common', 'care_common'];
  if (!validTypes.includes(type)) {
    console.error('❌ Type invalide:', type);
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-8">
        <div className="bg-red-50 border-2 border-red-300 rounded-lg p-6 max-w-lg">
          <h1 className="text-2xl font-bold text-red-800 mb-4">Type invalide</h1>
          <p className="text-red-600 mb-4">Le type "{type}" n'est pas valide.</p>
          <p className="text-gray-700">Types valides : {validTypes.join(', ')}</p>
        </div>
      </div>
    );
  }

  if (type === 'individual' && !studentId) {
    console.error('❌ StudentId manquant pour type individual');
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-8">
        <div className="bg-red-50 border-2 border-red-300 rounded-lg p-6 max-w-lg">
          <h1 className="text-2xl font-bold text-red-800 mb-4">Paramètre manquant</h1>
          <p className="text-red-600">Le paramètre studentId est requis pour un EDT individuel.</p>
        </div>
      </div>
    );
  }

  console.log('✅ Params OK, rendering content');

  return (
    <div className="print-page preview-full">
      <div className="no-print filename-banner">
        <div className="filename-banner-content">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors text-sm font-semibold"
            >
              <ArrowLeft className="w-4 h-4" />
              Retour
            </button>
            <div className="[&>button]:bg-white/20 [&>button]:hover:bg-white/30 [&>button]:text-white [&>button]:border-white/30 [&>button]:shadow-none [&>button]:text-sm [&>button]:px-3 [&>button]:py-1.5">
              <HomeButton onNavigateHome={() => navigate('/')} />
            </div>
            <div className="border-l border-white/30 pl-3">
              <p className="text-xs font-medium opacity-90">Fichier :</p>
              <p className="text-sm font-bold">{suggestedFilename}</p>
            </div>
            <div className="border-l border-white/30 pl-3">
              <p className={`text-xs font-bold ${
                sessionStatus === 'present' ? 'text-green-200' :
                sessionStatus === 'absent' ? 'text-red-200' :
                'text-white/70'
              }`}>
                Session: {sessionStatus === 'checking' ? '...' :
                 sessionStatus === 'present' ? 'OK' : 'PERDUE'}
              </p>
            </div>
          </div>
          <div className="filename-actions">
            <button onClick={handlePrint} className="print-button">
              Imprimer (A4 paysage optimisé)
            </button>
          </div>
        </div>
      </div>

      {type === 'individual' && studentId ? (
        <PrintIndividual
          studentId={studentId}
          periodId={periodId}
          onFilenameGenerated={setSuggestedFilename}
          isPrinting={isPrinting}
        />
      ) : (
        <PrintCommon
          type={type}
          periodId={periodId}
          onFilenameGenerated={setSuggestedFilename}
          isPrinting={isPrinting}
        />
      )}
    </div>
  );
}
