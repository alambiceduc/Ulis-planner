import type { EventType } from '../types';

export const DAYS = [
  { id: 1, name: 'Lundi', short: 'Lun' },
  { id: 2, name: 'Mardi', short: 'Mar' },
  { id: 3, name: 'Mercredi', short: 'Mer' },
  { id: 4, name: 'Jeudi', short: 'Jeu' },
  { id: 5, name: 'Vendredi', short: 'Ven' }
] as const;

export const DEFAULT_START_TIME = '08:30';
export const DEFAULT_END_TIME = '16:30';
export const DEFAULT_TIME_STEP = 30;
export const GRID_STEP_MINUTES = 30;

export const EVENT_TYPE_CONFIG: Record<EventType, {
  color: string;
  textColor: string;
  borderColor: string;
  label: string;
}> = {
  ULIS: {
    color: 'bg-blue-500',
    textColor: 'text-white',
    borderColor: 'border-blue-600',
    label: 'ULIS'
  },
  CLASSE: {
    color: 'bg-green-500',
    textColor: 'text-white',
    borderColor: 'border-green-600',
    label: 'Classe'
  },
  PRISE_EN_CHARGE: {
    color: 'bg-white',
    textColor: 'text-gray-800',
    borderColor: 'border-gray-400',
    label: 'Prise en charge'
  },
  VIE_SCOLAIRE: {
    color: 'bg-pink-400',
    textColor: 'text-white',
    borderColor: 'border-pink-500',
    label: 'Vie scolaire'
  }
};

export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 2;
export const ZOOM_STEP = 0.25;
export const DEFAULT_ZOOM = 1;

export const MIN_READABLE_HEIGHT_REM = 4.0;
export const MIN_READABLE_DURATION_MINUTES = 15;
