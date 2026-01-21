import { memo } from 'react';
import { Cloud, CloudOff, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AutoSaveIndicatorProps {
  hasUnsavedChanges: boolean;
  isSaving?: boolean;
  className?: string;
}

/**
 * Small indicator showing document save status.
 * Shows: saving spinner, unsaved dot, or saved cloud icon.
 */
export const AutoSaveIndicator = memo(function AutoSaveIndicator({
  hasUnsavedChanges,
  isSaving = false,
  className,
}: AutoSaveIndicatorProps) {
  if (isSaving) {
    return (
      <div className={cn("flex items-center gap-1.5 text-muted-foreground", className)}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span className="text-xs">Saving...</span>
      </div>
    );
  }

  if (hasUnsavedChanges) {
    return (
      <div className={cn("flex items-center gap-1.5 text-amber-500", className)}>
        <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
        <span className="text-xs">Unsaved</span>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-1.5 text-muted-foreground", className)}>
      <Cloud className="h-3.5 w-3.5" />
      <span className="text-xs">Saved</span>
    </div>
  );
});
