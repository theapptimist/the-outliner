 import { 
   FileText, 
   Pen, 
   BookOpen, 
   Sparkles, 
   Clock,
   Edit3
 } from 'lucide-react';
 import { cn } from '@/lib/utils';
 import type { SidebarTab } from '@/contexts/NavigationContext';
 
 interface DashboardTile {
   id: SidebarTab | 'editor';
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
     icon: <Edit3 className="h-8 w-8" />,
     color: 'text-brand',
     bgColor: 'bg-brand/10 hover:bg-brand/20 border-brand/30',
   },
   {
     id: 'tools',
     label: 'Tools',
     description: 'Formatting and styling options',
     icon: <Pen className="h-8 w-8" />,
     color: 'text-purple',
     bgColor: 'bg-purple/10 hover:bg-purple/20 border-purple/30',
   },
   {
     id: 'library',
     label: 'Library',
     description: 'People, places, dates & terms',
     icon: <BookOpen className="h-8 w-8" />,
     color: 'text-blue',
     bgColor: 'bg-blue/10 hover:bg-blue/20 border-blue/30',
   },
   {
     id: 'ai',
     label: 'AI Generate',
     description: 'AI-powered outline generation',
     icon: <Sparkles className="h-8 w-8" />,
     color: 'text-green',
     bgColor: 'bg-green/10 hover:bg-green/20 border-green/30',
   },
   {
     id: 'timeline',
     label: 'Timeline',
     description: 'Document history & versions',
     icon: <Clock className="h-8 w-8" />,
     color: 'text-gray-500',
     bgColor: 'bg-gray-500/10 hover:bg-gray-500/20 border-gray-500/30',
   },
 ];
 
 interface DashboardViewProps {
   onSelectTile: (id: SidebarTab | 'editor') => void;
 }
 
 export function DashboardView({ onSelectTile }: DashboardViewProps) {
   return (
     <div className="flex-1 p-4 overflow-y-auto">
       <div className="mb-4">
         <h2 className="text-lg font-semibold text-foreground">Dashboard</h2>
         <p className="text-xs text-muted-foreground">Select a section to get started</p>
       </div>
       
       <div className="grid grid-cols-1 gap-3">
         {tiles.map((tile) => (
           <button
             key={tile.id}
             onClick={() => onSelectTile(tile.id)}
             className={cn(
               "flex items-center gap-3 p-4 rounded-lg border transition-all duration-200",
               "text-left group",
               tile.bgColor
             )}
           >
             <div className={cn("shrink-0", tile.color)}>
               {tile.icon}
             </div>
             <div className="min-w-0 flex-1">
               <div className={cn("font-medium text-sm", tile.color)}>
                 {tile.label}
               </div>
               <div className="text-xs text-muted-foreground truncate">
                 {tile.description}
               </div>
             </div>
           </button>
         ))}
       </div>
     </div>
   );
 }