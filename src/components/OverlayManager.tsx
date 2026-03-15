import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Edit2, Trash2, Eye, EyeOff, AlignVerticalJustifyCenter } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { OverlayPeriodProfile, OverlayPeriodItem, Student } from '../lib/database.types';
import { DAYS } from '../lib/timeUtils';

interface OverlayManagerProps {
  student: Student;
  onUpdate: () => void;
}

interface OverlayItemFormData {
  name: string;
  days: number[];
  start_time: string;
  end_time: string;
  color: string;
  is_enabled: boolean;
}

export function OverlayManager({ student, onUpdate }: OverlayManagerProps) {
  const [profile, setProfile] = useState<OverlayPeriodProfile | null>(null);
  const [items, setItems] = useState<OverlayPeriodItem[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<OverlayPeriodItem | null>(null);
  const [formData, setFormData] = useState<OverlayItemFormData>({
    name: '',
    days: [],
    start_time: '10:00',
    end_time: '10:15',
    color: 'bg-pink-400',
    is_enabled: true
  });

  const GRID_STEP = 30;

  const snapToGrid = (time: string, stepMinutes: number): string => {
    const [hours, minutes] = time.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes;
    const snapped = Math.round(totalMinutes / stepMinutes) * stepMinutes;
    const newHours = Math.floor(snapped / 60);
    const newMinutes = snapped % 60;
    return `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`;
  };

  const handleSnapBoth = () => {
    setFormData(prev => ({
      ...prev,
      start_time: snapToGrid(prev.start_time, GRID_STEP),
      end_time: snapToGrid(prev.end_time, GRID_STEP)
    }));
  };

  const colorOptions = [
    { value: 'bg-pink-400', label: 'Rose' },
    { value: 'bg-purple-400', label: 'Violet' },
    { value: 'bg-yellow-400', label: 'Jaune' },
    { value: 'bg-orange-400', label: 'Orange' },
    { value: 'bg-cyan-400', label: 'Cyan' }
  ];

  useEffect(() => {
    loadProfile();
  }, [student.overlay_period_profile_id]);

  const loadProfile = async () => {
    if (!student.overlay_period_profile_id) {
      setProfile(null);
      setItems([]);
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from('overlay_period_profiles')
      .select('*')
      .eq('id', student.overlay_period_profile_id)
      .maybeSingle();

    if (profileError) {
      console.error('Error loading profile:', profileError);
      return;
    }

    setProfile(profileData);

    if (profileData) {
      const { data: itemsData, error: itemsError } = await supabase
        .from('overlay_period_items')
        .select('*')
        .eq('period_profile_id', profileData.id)
        .order('start_time');

      if (itemsError) {
        console.error('Error loading items:', itemsError);
      } else {
        setItems(itemsData || []);
      }
    }
  };

  const createDefaultProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: newProfile, error: profileError } = await supabase
      .from('overlay_period_profiles')
      .insert({
        user_id: user.id,
        period_id: student.period_id,
        name: `Profil ${student.first_name}`
      })
      .select()
      .maybeSingle();

    if (profileError) {
      console.error('Error creating profile:', profileError);
      return;
    }

    if (!newProfile) {
      console.error('Error: Profile was not created');
      return;
    }

    const { error: studentError } = await supabase
      .from('students')
      .update({ overlay_period_profile_id: newProfile.id })
      .eq('id', student.id);

    if (studentError) {
      console.error('Error updating student:', studentError);
      return;
    }

    onUpdate();
  };

  const openModal = (item?: OverlayPeriodItem) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        name: item.name,
        days: item.days,
        start_time: item.start_time,
        end_time: item.end_time,
        color: item.color,
        is_enabled: item.is_enabled
      });
    } else {
      setEditingItem(null);
      setFormData({
        name: '',
        days: [],
        start_time: '10:00',
        end_time: '10:15',
        color: 'bg-pink-400',
        is_enabled: true
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (editingItem) {
      const { error } = await supabase
        .from('overlay_period_items')
        .update(formData)
        .eq('id', editingItem.id);

      if (error) {
        console.error('Error updating item:', error);
      }
    } else {
      const { error } = await supabase
        .from('overlay_period_items')
        .insert({
          user_id: user.id,
          period_profile_id: profile.id,
          ...formData
        });

      if (error) {
        console.error('Error creating item:', error);
      }
    }

    setShowModal(false);
    loadProfile();
  };

  const handleDelete = async (itemId: string) => {
    if (!confirm('Supprimer cette tranche horaire ?')) return;

    const { error } = await supabase
      .from('overlay_period_items')
      .delete()
      .eq('id', itemId);

    if (error) {
      console.error('Error deleting item:', error);
    } else {
      loadProfile();
    }
  };

  const toggleDay = (day: number) => {
    setFormData(prev => ({
      ...prev,
      days: prev.days.includes(day)
        ? prev.days.filter(d => d !== day)
        : [...prev.days, day].sort()
    }));
  };

  const toggleItemEnabled = async (item: OverlayPeriodItem) => {
    const { error } = await supabase
      .from('overlay_period_items')
      .update({ is_enabled: !item.is_enabled })
      .eq('id', item.id);

    if (error) {
      console.error('Error toggling item:', error);
    } else {
      loadProfile();
    }
  };

  if (!profile) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Horaires (Récré, Cantine)</h3>
        <p className="text-gray-600 mb-4">
          Aucun profil d'horaires défini pour cet élève
        </p>
        <button
          onClick={createDefaultProfile}
          className="flex items-center gap-2 px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Créer un profil</span>
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">
          {profile.name}
        </h3>
        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 px-3 py-1.5 bg-pink-600 hover:bg-pink-700 text-white rounded-lg transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Ajouter</span>
        </button>
      </div>

      {items.length === 0 ? (
        <p className="text-gray-600 text-sm">Aucune tranche horaire définie</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className={`flex items-center justify-between p-3 rounded-lg border-2 ${
                item.is_enabled ? 'border-pink-200 bg-pink-50' : 'border-gray-200 bg-gray-50 opacity-60'
              }`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <div className={`w-4 h-4 ${item.color} rounded`}></div>
                  <span className="font-medium text-gray-800">{item.name}</span>
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  {item.start_time} - {item.end_time} | {item.days.map(d => DAYS.find(day => day.id === d)?.short).join(', ')}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => toggleItemEnabled(item)}
                  className="p-2 hover:bg-gray-100 rounded transition-colors"
                  title={item.is_enabled ? 'Masquer' : 'Afficher'}
                >
                  {item.is_enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => openModal(item)}
                  className="p-2 hover:bg-gray-100 rounded transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="p-2 hover:bg-red-100 text-red-600 rounded transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4" style={{ zIndex: 99999 }}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">
              {editingItem ? 'Modifier' : 'Ajouter'} une tranche horaire
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Récréation, Cantine..."
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Jours * (sélectionner au moins un)
                </label>
                <div className="flex gap-2">
                  {DAYS.map((day) => (
                    <button
                      key={day.id}
                      type="button"
                      onClick={() => toggleDay(day.id)}
                      className={`flex-1 px-3 py-2 rounded-lg border-2 transition-colors ${
                        formData.days.includes(day.id)
                          ? 'bg-pink-600 text-white border-pink-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-pink-400'
                      }`}
                    >
                      {day.short}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Heure de début *
                    </label>
                    <input
                      type="time"
                      value={formData.start_time}
                      onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                      required
                      step="60"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Heure de fin *
                    </label>
                    <input
                      type="time"
                      value={formData.end_time}
                      onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                      required
                      step="60"
                      min={formData.start_time}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSnapBoth}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                    title="Aligner les horaires au pas de la grille (30 min)"
                  >
                    <AlignVerticalJustifyCenter className="w-4 h-4" />
                    <span>Aligner au pas (30 min)</span>
                  </button>
                  <span className="text-xs text-gray-500">
                    Saisie libre au minute près
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Couleur *
                </label>
                <div className="flex gap-3">
                  {colorOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, color: option.value })}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-colors ${
                        formData.color === option.value
                          ? 'border-gray-800'
                          : 'border-gray-200 hover:border-gray-400'
                      }`}
                    >
                      <div className={`w-6 h-6 ${option.value} rounded`}></div>
                      <span className="text-sm">{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-pink-600 hover:bg-pink-700 text-white rounded-lg transition-colors"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
