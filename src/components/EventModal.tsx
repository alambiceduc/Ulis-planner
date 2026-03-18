import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, AlignVerticalJustifyCenter, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Student, Event, EventType } from '../lib/database.types';
import { DAYS } from '../lib/timeUtils';
import { PICTO_LIST, getAutoPicto } from '../utils/pictoMap';

interface EventModalProps {
  student: Student;
  event: Event | null;
  initialDay?: number;
  initialStartTime?: string;
  onClose: () => void;
  onSave: () => void;
  onBeforeSave?: () => Promise<void>;
}

export function EventModal({ student, event, initialDay, initialStartTime, onClose, onSave, onBeforeSave }: EventModalProps) {
  const calculateDefaultEndTime = (start: string): string => {
    const [hours, minutes] = start.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + 30;
    const newHours = Math.floor(totalMinutes / 60);
    const newMinutes = totalMinutes % 60;
    return `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`;
  };

  const [selectedDays, setSelectedDays] = useState<number[]>(event ? [event.day_of_week] : (initialDay ? [initialDay] : [1]));
  const [startTime, setStartTime] = useState(event?.start_time || initialStartTime || '08:30');
  const [endTime, setEndTime] = useState(event?.end_time || (initialStartTime ? calculateDefaultEndTime(initialStartTime) : '09:00'));
  const [type, setType] = useState<EventType>(event?.type || 'ULIS');
  const [aesh, setAesh] = useState(event?.aesh || false);
  const [label, setLabel] = useState(event?.label || '');
  const [location, setLocation] = useState(event?.location || '');
  const [picto, setPicto] = useState<string>(event?.picto || '');
  const [loading, setLoading] = useState(false);
  const [relatedEvents, setRelatedEvents] = useState<Event[]>([]);

  useEffect(() => {
    const loadRelatedEvents = async () => {
      if (!event) return;

      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('student_id', student.id)
        .eq('start_time', event.start_time)
        .eq('end_time', event.end_time)
        .eq('type', event.type)
        .eq('label', event.label)
        .eq('location', event.location)
        .eq('aesh', event.aesh);

      if (!error && data) {
        setRelatedEvents(data);
        const allDays = data.map(e => e.day_of_week);
        setSelectedDays(allDays);
      }
    };

    loadRelatedEvents();
  }, [event, student.id]);

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
    setStartTime(snapToGrid(startTime, GRID_STEP));
    setEndTime(snapToGrid(endTime, GRID_STEP));
  };

  const toggleDay = (dayId: number) => {
    if (selectedDays.includes(dayId)) {
      setSelectedDays(selectedDays.filter(d => d !== dayId));
    } else {
      setSelectedDays([...selectedDays, dayId]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (onBeforeSave) {
      await onBeforeSave();
    }

    if (event) {
      if (selectedDays.length === 0) {
        alert('Veuillez sélectionner au moins un jour.');
        setLoading(false);
        return;
      }

      const oldDays = relatedEvents.map(e => e.day_of_week);
      const newDays = selectedDays;

      const daysToKeep = oldDays.filter(d => newDays.includes(d));
      const daysToDelete = oldDays.filter(d => !newDays.includes(d));
      const daysToCreate = newDays.filter(d => !oldDays.includes(d));

      const updateData: any = {
        start_time: startTime,
        end_time: endTime,
        type,
        aesh: type === 'VIE_SCOLAIRE' ? false : aesh,
        label,
        location,
        picto: picto || null
      };

      try {
        if (daysToKeep.length > 0) {
          const eventsToUpdate = relatedEvents.filter(e => daysToKeep.includes(e.day_of_week));
          for (const evt of eventsToUpdate) {
            const { error } = await supabase
              .from('events')
              .update(updateData)
              .eq('id', evt.id);
            if (error) throw error;
          }
        }

        // Les jours décochés ne sont PAS supprimés - ils restent inchangés.
        // Seuls les jours encore cochés sont mis à jour, et les nouveaux jours sont créés.

        if (daysToCreate.length > 0) {
          const eventsToInsert = daysToCreate.map(day => ({
            student_id: student.id,
            day_of_week: day,
            ...updateData
          }));
          const { error } = await supabase
            .from('events')
            .insert(eventsToInsert as any);
          if (error) throw error;
        }

        onSave();
      } catch (error) {
        console.error('Error updating events:', error);
      }
    } else {
      if (selectedDays.length === 0) {
        alert('Veuillez sélectionner au moins un jour.');
        setLoading(false);
        return;
      }

      const eventsToInsert = selectedDays.map(day => ({
        student_id: student.id,
        day_of_week: day,
        start_time: startTime,
        end_time: endTime,
        type,
        aesh: type === 'VIE_SCOLAIRE' ? false : aesh,
        label,
        location,
        picto: picto || null
      }));

      const { error } = await supabase
        .from('events')
        .insert(eventsToInsert as any);

      if (error) {
        console.error('Error creating event:', error);
      } else {
        onSave();
      }
    }

    setLoading(false);
  };

  const modalContent = (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4" style={{ zIndex: 99999 }}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">
            {event ? 'Modifier' : 'Ajouter'} un événement
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type *
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as EventType)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="ULIS">ULIS (bleu)</option>
                <option value="CLASSE">Classe (vert)</option>
                <option value="PRISE_EN_CHARGE">Prise en charge (blanc)</option>
                <option value="VIE_SCOLAIRE">Vie scolaire (rose)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Jours * (sélection multiple)
            </label>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((day) => {
                const isSelected = selectedDays.includes(day.id);
                let colorClasses = 'bg-blue-500 border-blue-600';
                if (type === 'CLASSE') colorClasses = 'bg-green-500 border-green-600';
                if (type === 'PRISE_EN_CHARGE') colorClasses = 'bg-gray-500 border-gray-600';
                if (type === 'VIE_SCOLAIRE') colorClasses = 'bg-pink-500 border-pink-600';

                return (
                  <button
                    key={day.id}
                    type="button"
                    onClick={() => toggleDay(day.id)}
                    className={`px-6 py-3 rounded-lg border-2 transition-colors font-medium ${
                      isSelected
                        ? `${colorClasses} text-white`
                        : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50'
                    }`}
                  >
                    {day.name}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {event
                ? 'Cochez les jours à modifier. Les jours décochés restent inchangés.'
                : 'Sélectionnez un ou plusieurs jours où ce créneau se répète'
              }
            </p>
          </div>

          {event && selectedDays.length > 1 && (
            <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <strong>Modification multi-jours :</strong> Cette modification s'appliquera à tous les {selectedDays.length} jours sélectionnés.
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Heure de début *
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                  step="60"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Heure de fin *
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                  step="60"
                  min={startTime}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                Saisie libre au minute près - Utilisez ce bouton pour aligner à la grille
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Libellé
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={
                type === 'VIE_SCOLAIRE'
                  ? 'Ex: Récréation, Cantine...'
                  : 'Ex: Maths, EPS, Orthophonie...'
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Lieu
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Ex: CE1 Mme X, ULIS, Salle 3..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Pictogramme
            </label>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">{picto || getAutoPicto(label)}</span>
              <span className="text-xs text-gray-500">
                {picto ? 'Personnalisé' : 'Auto (basé sur le libellé)'}
              </span>
              {picto && (
                <button
                  type="button"
                  onClick={() => setPicto('')}
                  className="text-xs text-gray-400 hover:text-gray-600 underline"
                >
                  Réinitialiser
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 p-2 bg-gray-50 rounded-lg border border-gray-200 max-h-28 overflow-y-auto">
              {PICTO_LIST.map((p) => (
                <button
                  key={p.emoji}
                  type="button"
                  onClick={() => setPicto(p.emoji)}
                  title={p.label}
                  className={`text-xl rounded p-0.5 transition-all hover:scale-110 ${
                    (picto || getAutoPicto(label)) === p.emoji
                      ? 'ring-2 ring-blue-500 bg-blue-50'
                      : 'hover:bg-gray-200'
                  }`}
                >
                  {p.emoji}
                </button>
              ))}
            </div>
          </div>

                    {type !== 'VIE_SCOLAIRE' && (
            <div className="flex items-center gap-3 p-4 bg-orange-50 rounded-lg border border-orange-200">
              <input
                type="checkbox"
                id="aesh"
                checked={aesh}
                onChange={(e) => setAesh(e.target.checked)}
                className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
              />
              <label htmlFor="aesh" className="text-sm font-medium text-gray-700">
                Accompagnement AESH
              </label>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
