import { ArrowLeft, Library } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigation } from '@/contexts/NavigationContext';

interface NavigationBackBarProps {
  onNavigateBack: (documentId: string) => void;
  onOpenMasterLibrary?: () => void;
}

export function NavigationBackBar({ onNavigateBack, onOpenMasterLibrary }: NavigationBackBarProps) {
  const { 
    canGoBack, 
    currentOrigin, 
    popDocument, 
    masterDocument, 
    setActiveSubOutlineId, 
    activeSidebarTab,
    jumpedFromMasterLibrary,
    setJumpedFromMasterLibrary
  } = useNavigation();

  // Determine what kind of "back" we should show
  // Priority 1: Simple boolean flag for "Back to Snippets" (most reliable)
  // Priority 2: Stack-based navigation for document-to-document navigation
  const showBackToSnippets = jumpedFromMasterLibrary;
  const showBackToDocument = !showBackToSnippets && canGoBack && currentOrigin && currentOrigin.type !== 'master-library';

  // Hide the back bar when viewing the Master Outline pane (it has its own navigation)
  // BUT: Always show "Back to Snippets" since that's a different UI flow
  const shouldHideForMasterTab = activeSidebarTab === 'master' && !showBackToSnippets;
  
  // Debug logging
  console.log('[NavigationBackBar] Visibility check:', {
    jumpedFromMasterLibrary,
    showBackToSnippets,
    showBackToDocument,
    canGoBack,
    activeSidebarTab,
    shouldHideForMasterTab,
  });
  
  if (shouldHideForMasterTab) {
    return null;
  }

  if (!showBackToSnippets && !showBackToDocument) {
    return null;
  }

  const handleBackToSnippets = () => {
    console.log('[NavigationBackBar] Back to Snippets clicked');
    // Clear the flag first
    setJumpedFromMasterLibrary(false);
    // Open the Master Library dialog
    onOpenMasterLibrary?.();
  };

  const handleBackToDocument = () => {
    const origin = currentOrigin;
    if (!origin) return;

    popDocument(); // mutate stack

    // If returning to the master document, clear sub-outline marker
    if (masterDocument && origin.id === masterDocument.id) {
      setActiveSubOutlineId(null);
    }
    onNavigateBack(origin.id);
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 border-b border-border">
      {showBackToSnippets ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBackToSnippets}
          className="gap-2 text-muted-foreground hover:text-foreground"
        >
          <Library className="h-4 w-4" />
          <span>Back to Snippets</span>
        </Button>
      ) : showBackToDocument ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBackToDocument}
          className="gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to "{currentOrigin?.title}"</span>
        </Button>
      ) : null}
    </div>
  );
}
