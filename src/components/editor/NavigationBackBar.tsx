import { ArrowLeft, Library } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigation } from '@/contexts/NavigationContext';

interface NavigationBackBarProps {
  onNavigateBack: (documentId: string) => void;
  onOpenMasterLibrary?: () => void;
}

export function NavigationBackBar({ onNavigateBack, onOpenMasterLibrary }: NavigationBackBarProps) {
  const { canGoBack, currentOrigin, popDocument, masterDocument, setActiveSubOutlineId, activeSidebarTab } = useNavigation();

  // Hide the back bar when viewing the Master Outline pane (it has its own navigation)
  // BUT: Always show for master-library origin so "Back to Snippets" is never hidden
  const isMasterLibraryOrigin = currentOrigin?.type === 'master-library';
  const shouldHideForMasterTab = activeSidebarTab === 'master' && !isMasterLibraryOrigin;
  
  if (!canGoBack || !currentOrigin || shouldHideForMasterTab) {
    return null;
  }

  // isMasterLibraryOrigin already computed above

  const handleBack = () => {
    // Use currentOrigin snapshot (already available) for decisions
    // Call popDocument() only to mutate the stack
    const origin = currentOrigin;
    if (!origin) return;

    popDocument(); // mutate stack

    // If coming from Master Library, re-open it instead of navigating to a document
    if (origin.type === 'master-library') {
      onOpenMasterLibrary?.();
      return;
    }

    // If returning to the master document, clear sub-outline marker
    if (masterDocument && origin.id === masterDocument.id) {
      setActiveSubOutlineId(null);
    }
    onNavigateBack(origin.id);
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 border-b border-border">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleBack}
        className="gap-2 text-muted-foreground hover:text-foreground"
      >
        {isMasterLibraryOrigin ? (
          <>
            <Library className="h-4 w-4" />
            <span>Back to Snippets</span>
          </>
        ) : (
          <>
            <ArrowLeft className="h-4 w-4" />
            <span>Back to "{currentOrigin.title}"</span>
          </>
        )}
      </Button>
    </div>
  );
}
