import React from 'react';
import { cn } from '@/lib/utils';

interface PageContainerProps {
  children: React.ReactNode;
  pageNumber?: number;
  showPageNumber?: boolean;
  className?: string;
}

// US Letter: 8.5 x 11 inches
// At 96 DPI: 816 x 1056 pixels
// We'll scale it down to fit comfortably on screen
const PAGE_WIDTH = 816;
const PAGE_HEIGHT = 1056;
const SCALE = 0.85; // Scale factor for screen display

export function PageContainer({ 
  children, 
  pageNumber = 1, 
  showPageNumber = true,
  className 
}: PageContainerProps) {
  return (
    <div className="flex flex-col items-center py-6">
      {/* Page shadow and paper effect */}
      <div
        className={cn(
          "bg-white dark:bg-zinc-900 relative",
          "shadow-[0_2px_8px_rgba(0,0,0,0.1),0_8px_24px_rgba(0,0,0,0.15)]",
          "dark:shadow-[0_2px_8px_rgba(0,0,0,0.3),0_8px_24px_rgba(0,0,0,0.4)]",
          "border border-border/20",
          className
        )}
        style={{
          width: `${PAGE_WIDTH * SCALE}px`,
          minHeight: `${PAGE_HEIGHT * SCALE}px`,
          // Standard margins: 1 inch = 96px, scaled
          padding: `${96 * SCALE}px`,
        }}
      >
        {/* Content area */}
        <div className="w-full min-h-full">
          {children}
        </div>
      </div>
      
      {/* Page number */}
      {showPageNumber && (
        <div className="mt-3 text-xs text-muted-foreground">
          Page {pageNumber}
        </div>
      )}
    </div>
  );
}

interface PaginatedDocumentProps {
  children: React.ReactNode;
  className?: string;
}

export function PaginatedDocument({ children, className }: PaginatedDocumentProps) {
  return (
    <div 
      className={cn(
        "min-h-full bg-muted/30 dark:bg-zinc-950",
        className
      )}
    >
      <PageContainer>
        {children}
      </PageContainer>
    </div>
  );
}
