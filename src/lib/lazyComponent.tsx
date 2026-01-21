import { lazy, Suspense, ComponentType, ReactNode, ComponentProps } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Default loading fallback component
 */
function DefaultFallback() {
  return (
    <div className="flex items-center justify-center p-8">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

/**
 * Creates a lazy-loaded component with a loading fallback.
 * Use this for heavy dialogs and components that aren't needed on initial render.
 */
export function lazyWithFallback<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  fallback?: ReactNode
) {
  const LazyComponent = lazy(importFn);
  
  return function LazyWrapper(props: ComponentProps<T>) {
    return (
      <Suspense fallback={fallback ?? <DefaultFallback />}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}

/**
 * Creates a lazy-loaded dialog that only loads when opened.
 * The component won't be loaded until the 'open' prop is true.
 */
export function lazyDialog<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>
) {
  const LazyComponent = lazy(importFn);
  
  return function LazyDialogWrapper(props: ComponentProps<T> & { open?: boolean }) {
    // Don't render anything if not open (avoids loading the component)
    if (!props.open) return null;
    
    return (
      <Suspense fallback={null}>
        {/* @ts-expect-error - TypeScript has issues with spread on lazy components */}
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}
