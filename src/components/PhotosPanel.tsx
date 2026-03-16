import { useState } from 'react';
import { Upload, Trash2, User } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Student } from '../lib/database.types';

interface PhotoConfig {
  key: 'photo_student_url' | 'photo_teacher_url' | 'photo_coordo_url' | 'photo_aesh_url';
  label: string;
  color: string;
  initials: string;
}

const PHOTOS: PhotoConfig[] = [
  { key: 'photo_student_url',  label: 'Élève',           color: 'bg-blue-100 text-blue-700',   initials: 'ÉL' },
  { key: 'photo_teacher_url',  label: 'Enseignant(e)',   color: 'bg-green-100 text-green-700', initials: 'EN' },
  { key: 'photo_coordo_url',   label: 'Coordo ULIS',     color: 'bg-purple-100 text-purple-700', initials: 'CO' },
  { key: 'photo_aesh_url',     label: 'AESH',            color: 'bg-orange-100 text-orange-700', initials: 'AE' },
];

interface PhotosPanelProps {
  student: Student;
  onUpdate: () => void;
}

export function PhotosPanel({ student, onUpdate }: PhotosPanelProps) {
  const [uploading, setUploading] = useState<string | null>(null);

  const handleUpload = async (key: PhotoConfig['key'], file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Veuillez sélectionner une image (JPG, PNG, WEBP...)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Image trop lourde (max 5 Mo)');
      return;
    }

    setUploading(key);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non connecté');

      // Supprimer l'ancienne photo si elle existe
      const oldUrl = student[key];
      if (oldUrl) {
        const parts = oldUrl.split('/student-photos/');
        if (parts[1]) {
          await supabase.storage.from('student-photos').remove([parts[1]]);
        }
      }

      const ext = file.name.split('.').pop();
      const path = `${user.id}/${student.id}-${key}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('student-photos')
        .upload(path, file, { cacheControl: '3600', upsert: false });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('student-photos')
        .getPublicUrl(path);

      const { error: updateError } = await supabase
        .from('students')
        .update({ [key]: urlData.publicUrl })
        .eq('id', student.id);

      if (updateError) throw updateError;

      onUpdate();
    } catch (err: any) {
      console.error('Erreur upload photo:', err);
      alert('Erreur lors de l\'upload : ' + (err.message || 'Erreur inconnue'));
    } finally {
      setUploading(null);
    }
  };

  const handleDelete = async (key: PhotoConfig['key']) => {
    if (!confirm('Supprimer cette photo ?')) return;

    const oldUrl = student[key];
    if (oldUrl) {
      const parts = oldUrl.split('/student-photos/');
      if (parts[1]) {
        await supabase.storage.from('student-photos').remove([parts[1]]);
      }
    }

    await supabase.from('students').update({ [key]: null }).eq('id', student.id);
    onUpdate();
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
        <User className="w-4 h-4 text-gray-500" />
        Photos des personnes référentes
      </h3>
      <div className="grid grid-cols-4 gap-3">
        {PHOTOS.map((photo) => {
          const url = student[photo.key];
          const isUploading = uploading === photo.key;

          return (
            <div key={photo.key} className="flex flex-col items-center gap-1.5">
              <div className="relative w-14 h-14 rounded-full overflow-hidden border-2 border-gray-200 flex items-center justify-center bg-gray-50 group">
                {url ? (
                  <>
                    <img src={url} alt={photo.label} className="w-full h-full object-cover" />
                    <button
                      onClick={() => handleDelete(photo.key)}
                      className="absolute inset-0 bg-black bg-opacity-40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4 text-white" />
                    </button>
                  </>
                ) : isUploading ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors">
                    <Upload className="w-4 h-4 text-gray-400" />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleUpload(photo.key, f);
                        e.target.value = '';
                      }}
                    />
                  </label>
                )}
              </div>
              <span className="text-xs text-gray-500 text-center leading-tight">{photo.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
