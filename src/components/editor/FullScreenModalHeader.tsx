import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserMenu } from './UserMenu';

interface FullScreenModalHeaderProps {
  onBack: () => void;
}

export function FullScreenModalHeader({ onBack }: FullScreenModalHeaderProps) {
  return (
    <div className="flex items-center justify-between px-6 py-3 border-b border-border/30 bg-background/95">
      {/* Left: User avatar/menu */}
      <UserMenu />
      
      {/* Center: Brand title */}
      <h1 className="text-lg font-bold tracking-wide text-brand uppercase">
        The Outliner
      </h1>
      
      {/* Right: Back chevron */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onBack}
        className="h-8 w-8"
      >
        <ChevronLeft className="h-5 w-5" />
        <span className="sr-only">Go back</span>
      </Button>
    </div>
  );
}
