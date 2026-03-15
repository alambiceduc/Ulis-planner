import { Edit2, Trash2, User } from 'lucide-react';
import type { Event } from '../lib/database.types';
import { EVENT_TYPE_CONFIG, calculateEventDuration } from '../lib/timeUtils';

interface EventBlockProps {
  event: Event;
  heightRem: number;
  onEdit: (event: Event) => void;
  onDelete: (eventId: string) => void;
  exportMode?: boolean;
}

export function EventBlock({ event, heightRem, onEdit, onDelete, exportMode = false }: EventBlockProps) {
  const config = EVENT_TYPE_CONFIG[event.type];
  const duration = calculateEventDuration(event.start_time, event.end_time);

  const isCantine = event.type === 'VIE_SCOLAIRE' &&
                    event.label &&
                    event.label.toLowerCase().includes('cantine');

  const getDisplaySize = () => {
    if (exportMode) {
      if (heightRem < 3.5) return 'tiny';
      if (heightRem < 5.5) return 'small';
      if (heightRem < 8.0) return 'medium';
      return 'large';
    }
    if (heightRem < 3) return 'tiny';
    if (heightRem < 4.5) return 'small';
    if (heightRem < 6.5) return 'medium';
    return 'large';
  };

  const displaySize = getDisplaySize();

  const tooltipText = [
    `${event.start_time} - ${event.end_time}`,
    event.label,
    event.location,
    config.label,
    event.aesh ? 'AESH présent' : null,
    isCantine ? `Durée réelle: ${duration} min (affichage compact)` : null
  ].filter(Boolean).join(' • ');

  const paddingClass = exportMode
    ? (displaySize === 'tiny' ? 'px-3 py-2' : displaySize === 'small' ? 'px-4 py-2.5' : 'px-5 py-3')
    : 'p-2';

  return (
    <div
      className={`${config.color} ${config.textColor} border-2 ${config.borderColor} rounded-lg relative group cursor-pointer print:cursor-default ${exportMode ? 'overflow-hidden' : 'overflow-visible'} hover:ring-2 hover:ring-blue-500 transition-all ${exportMode ? 'export-event-block' : ''}`}
      style={{ height: `${heightRem}rem` }}
      onClick={() => onEdit(event)}
      title={tooltipText}
    >
      <div className="absolute top-1 right-1 flex gap-0.5 print:hidden">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(event);
          }}
          className="bg-white bg-opacity-70 hover:bg-opacity-100 rounded p-0.5 transition-all shadow-sm"
          title="Modifier"
        >
          <Edit2 className="w-2.5 h-2.5 text-gray-700" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(event.id);
          }}
          className="bg-red-500 bg-opacity-70 hover:bg-opacity-100 rounded p-0.5 transition-all shadow-sm"
          title="Supprimer"
        >
          <Trash2 className="w-2.5 h-2.5 text-white" />
        </button>
      </div>
      {event.aesh && displaySize !== 'tiny' && !exportMode && (
        <div className="absolute top-1 left-1 bg-orange-500 text-white rounded-full p-0.5">
          <User className={displaySize === 'small' ? 'w-2 h-2' : 'w-3 h-3'} />
        </div>
      )}

      <div className={`flex flex-col h-full justify-center ${paddingClass}`}>
        {exportMode ? (
          <>
            <div className="flex items-baseline gap-1 leading-snug">
              <span className={`font-bold whitespace-nowrap ${
                displaySize === 'tiny' ? 'text-[1.1rem]' :
                displaySize === 'small' ? 'text-[1.3rem]' :
                displaySize === 'medium' ? 'text-[1.5rem]' : 'text-[1.7rem]'
              }`}>
                {event.start_time}-{event.end_time}
              </span>
              {event.label && (
                <span className={`font-semibold truncate ${
                  displaySize === 'tiny' ? 'text-[1.0rem]' :
                  displaySize === 'small' ? 'text-[1.2rem]' :
                  displaySize === 'medium' ? 'text-[1.4rem]' : 'text-[1.6rem]'
                }`}>
                  {event.label}
                </span>
              )}
            </div>
            {event.location && displaySize !== 'tiny' && (
              <div className={`opacity-90 leading-snug truncate mt-1 ${
                displaySize === 'small' ? 'text-[1.1rem]' :
                displaySize === 'medium' ? 'text-[1.3rem]' : 'text-[1.5rem]'
              }`}>
                {event.location}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="font-bold text-base leading-snug whitespace-nowrap">
              {event.start_time}-{event.end_time}
            </div>
            {event.label && (
              <div className="font-semibold text-sm leading-snug mt-1 break-words">
                {event.label}
              </div>
            )}
            {event.location && (
              <div className="text-sm leading-snug mt-1 opacity-90 break-words">
                {event.location}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
