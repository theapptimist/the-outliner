import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigation } from '@/contexts/NavigationContext';

interface NavigationBackBarProps {
  onNavigateBack: (documentId: string) => void;
}

export function NavigationBackBar({ onNavigateBack }: NavigationBackBarProps) {
  const { canGoBack, currentOrigin, popDocument, masterDocument, setActiveSubOutlineId } = useNavigation();

  if (!canGoBack || !currentOrigin) {
    return null;
  }

  const handleBack = () => {
    const origin = popDocument();
    if (origin) {
      // If returning to the master document, clear sub-outline marker
      if (masterDocument && origin.id === masterDocument.id) {
        setActiveSubOutlineId(null);
      }
      onNavigateBack(origin.id);
    }
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 border-b border-border">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleBack}
        className="gap-2 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back to "{currentOrigin.title}"</span>
      </Button>
    </div>
  );
}
