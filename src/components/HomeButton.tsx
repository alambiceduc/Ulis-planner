import { useEffect, useCallback } from 'react';
import { Home } from 'lucide-react';

interface HomeButtonProps {
  onNavigateHome: () => void;
  hasUnsavedChanges?: boolean;
}

export function HomeButton({ onNavigateHome, hasUnsavedChanges = false }: HomeButtonProps) {
  const handleHomeClick = useCallback(() => {
    if (hasUnsavedChanges) {
      const confirmLeave = window.confirm(
        'Vous avez des modifications non enregistrées. Quitter quand même ?'
      );
      if (!confirmLeave) return;
    }
    onNavigateHome();
  }, [hasUnsavedChanges, onNavigateHome]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        handleHomeClick();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleHomeClick]);

  return (
    <button
      onClick={handleHomeClick}
      className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 rounded-lg transition-colors shadow-sm border border-gray-200 hover:border-gray-300"
      title="Retour à l'accueil (Alt+H)"
    >
      <Home className="w-5 h-5" />
      <span className="font-medium">Accueil</span>
    </button>
  );
}
