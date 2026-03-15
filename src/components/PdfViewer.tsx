import { useState } from 'react';
import { Upload, Trash2, FileText, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Student } from '../lib/database.types';

interface PdfViewerProps {
  student: Student;
  onPdfUpdate: () => void;
}

export function PdfViewer({ student, onPdfUpdate }: PdfViewerProps) {
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('Veuillez sélectionner un fichier PDF');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('Le fichier est trop volumineux (max 10 Mo)');
      return;
    }

    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Utilisateur non connecté');
      }

      if (student.reference_timetable_pdf_url) {
        const urlParts = student.reference_timetable_pdf_url.split('/');
        const bucketIndex = urlParts.indexOf('reference-timetables');
        if (bucketIndex !== -1 && bucketIndex < urlParts.length - 1) {
          const oldPath = urlParts.slice(bucketIndex + 1).join('/');
          await supabase.storage
            .from('reference-timetables')
            .remove([oldPath]);
        }
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${student.id}-${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('reference-timetables')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error(`Erreur d'upload: ${uploadError.message}`);
      }

      const { data: { publicUrl } } = supabase.storage
        .from('reference-timetables')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('students')
        .update({ reference_timetable_pdf_url: publicUrl } as any)
        .eq('id', student.id);

      if (updateError) {
        console.error('Database update error:', updateError);
        throw new Error(`Erreur de mise à jour: ${updateError.message}`);
      }

      onPdfUpdate();
    } catch (error: any) {
      console.error('Error uploading PDF:', error);
      alert(error.message || 'Erreur lors du téléchargement du PDF');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDeletePdf = async () => {
    if (!confirm('Supprimer le PDF de référence ?')) return;

    setDeleting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !student.reference_timetable_pdf_url) {
        throw new Error('Utilisateur non connecté ou pas de PDF');
      }

      const urlParts = student.reference_timetable_pdf_url.split('/');
      const bucketIndex = urlParts.indexOf('reference-timetables');
      if (bucketIndex !== -1 && bucketIndex < urlParts.length - 1) {
        const filePath = urlParts.slice(bucketIndex + 1).join('/');
        const { error: deleteError } = await supabase.storage
          .from('reference-timetables')
          .remove([filePath]);

        if (deleteError) {
          console.error('Storage delete error:', deleteError);
        }
      }

      const { error: updateError } = await supabase
        .from('students')
        .update({ reference_timetable_pdf_url: null } as any)
        .eq('id', student.id);

      if (updateError) {
        console.error('Database update error:', updateError);
        throw new Error(`Erreur de mise à jour: ${updateError.message}`);
      }

      onPdfUpdate();
    } catch (error: any) {
      console.error('Error deleting PDF:', error);
      alert(error.message || 'Erreur lors de la suppression du PDF');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 rounded-lg border border-gray-200">
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-gray-800">
            EDT Classe de référence
          </h3>
        </div>

        <div className="flex gap-2">
          {student.reference_timetable_pdf_url ? (
            <>
              <label className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg cursor-pointer transition-colors">
                <Upload className="w-4 h-4" />
                <span>Remplacer</span>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
              <button
                onClick={handleDeletePdf}
                disabled={deleting}
                className="flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>Supprimer</span>
              </button>
            </>
          ) : (
            <label className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg cursor-pointer transition-colors">
              <Upload className="w-4 h-4" />
              <span>{uploading ? 'Envoi...' : 'Déposer un PDF'}</span>
              <input
                type="file"
                accept="application/pdf"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {student.reference_timetable_pdf_url ? (
          <div className="h-full flex flex-col">
            <div className="p-3 bg-blue-50 border-b border-blue-200">
              <a
                href={student.reference_timetable_pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-blue-700 hover:text-blue-800 font-medium text-sm"
              >
                <ExternalLink className="w-4 h-4" />
                Ouvrir le PDF dans un nouvel onglet
              </a>
            </div>
            <div className="flex-1 overflow-hidden bg-gray-100">
              <object
                data={student.reference_timetable_pdf_url}
                type="application/pdf"
                className="w-full h-full"
                title="PDF Emploi du temps de référence"
              >
                <div className="h-full flex flex-col items-center justify-center p-8">
                  <FileText className="w-16 h-16 mb-4 text-gray-400" />
                  <p className="text-center mb-4 font-medium text-gray-700">
                    Impossible d'afficher le PDF dans le navigateur
                  </p>
                  <a
                    href={student.reference_timetable_pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Ouvrir le PDF
                  </a>
                </div>
              </object>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 p-8">
            <FileText className="w-16 h-16 mb-4" />
            <p className="text-center mb-2 font-medium">
              Aucun PDF déposé
            </p>
            <p className="text-sm text-center max-w-md">
              Déposez l'emploi du temps de la classe de référence pour faciliter la saisie.
              Le PDF sert uniquement de référence visuelle.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
