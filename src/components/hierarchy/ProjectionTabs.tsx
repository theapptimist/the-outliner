import { ProjectionType } from '@/types/node';
import { cn } from '@/lib/utils';
import { 
  TreeDeciduous, 
  List, 
  GitBranch 
} from 'lucide-react';

interface ProjectionTabsProps {
  active: ProjectionType;
  onChange: (type: ProjectionType) => void;
}

const tabs: { type: ProjectionType; icon: React.ReactNode; label: string }[] = [
  { type: 'tree', icon: <TreeDeciduous size={14} />, label: 'Tree' },
  { type: 'outline', icon: <List size={14} />, label: 'Outline' },
  { type: 'graph', icon: <GitBranch size={14} />, label: 'Graph' },
];

export function ProjectionTabs({ active, onChange }: ProjectionTabsProps) {
  return (
    <div className="flex items-center gap-1 px-2 py-1 bg-muted/50 border-b border-border">
      {tabs.map((tab) => (
        <button
          key={tab.type}
          onClick={() => onChange(tab.type)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium',
            'transition-colors duration-fast',
            active === tab.type
              ? 'bg-secondary text-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
          )}
        >
          {tab.icon}
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
