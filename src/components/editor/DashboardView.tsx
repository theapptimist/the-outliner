 import { 
   FileText, 
   Pen, 
   BookOpen, 
   Sparkles, 
   Clock,
  Edit3,
  X
 } from 'lucide-react';
 import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { UserMenu } from './UserMenu';
 import type { SidebarTab } from '@/contexts/NavigationContext';
 
 interface DashboardTile {
  id: SidebarTab | 'editor' | 'master-library';
   label: string;
   description: string;
   icon: React.ReactNode;
   color: string;
   bgColor: string;
 }
 
 const tiles: DashboardTile[] = [
   {
     id: 'editor',
     label: 'Editor',
     description: 'Write and edit your outline',
    icon: <Edit3 className="h-10 w-10" />,
     color: 'text-brand',
     bgColor: 'bg-brand/10 hover:bg-brand/20 border-brand/30',
   },
   {
     id: 'tools',
     label: 'Tools',
     description: 'Formatting and styling options',
    icon: <Pen className="h-10 w-10" />,
     color: 'text-purple',
     bgColor: 'bg-purple/10 hover:bg-purple/20 border-purple/30',
   },
   {
    id: 'master-library',
     label: 'Library',
    description: 'Master research library',
    icon: <BookOpen className="h-10 w-10" />,
     color: 'text-blue',
     bgColor: 'bg-blue/10 hover:bg-blue/20 border-blue/30',
   },
   {
     id: 'ai',
     label: 'AI Generate',
     description: 'AI-powered outline generation',
    icon: <Sparkles className="h-10 w-10" />,
     color: 'text-green',
     bgColor: 'bg-green/10 hover:bg-green/20 border-green/30',
   },
   {
     id: 'timeline',
     label: 'Timeline',
     description: 'Document history & versions',
    icon: <Clock className="h-10 w-10" />,
     color: 'text-gray-500',
     bgColor: 'bg-gray-500/10 hover:bg-gray-500/20 border-gray-500/30',
   },
 ];
 
 interface DashboardViewProps {
  onSelectTile: (id: SidebarTab | 'editor' | 'master-library') => void;
  onClose: () => void;
 }
 
export function DashboardView({ onSelectTile, onClose }: DashboardViewProps) {
   return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-border/30">
        <div>
          <h1 className="text-2xl font-bold text-brand">The Outliner</h1>
          <p className="text-sm text-muted-foreground">Select a section to get started</p>
        </div>
        <div className="flex items-center gap-3">
          <UserMenu />
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-10 w-10 hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
       </div>
       
      {/* Tiles Grid */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 max-w-5xl w-full">
          {tiles.map((tile) => (
            <button
              key={tile.id}
              onClick={() => onSelectTile(tile.id)}
              className={cn(
                "flex flex-col items-center justify-center gap-4 p-8 rounded-xl border-2 transition-all duration-200",
                "hover:scale-105 hover:shadow-lg",
                "aspect-square",
                tile.bgColor
              )}
            >
              <div className={cn("shrink-0", tile.color)}>
                {tile.icon}
               </div>
              <div className="text-center">
                <div className={cn("font-semibold text-base", tile.color)}>
                  {tile.label}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {tile.description}
                </div>
              </div>
            </button>
          ))}
        </div>
       </div>
     </div>
   );
 }