import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface ToolButtonProps {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
  tooltip: string;
  collapsed: boolean;
   color?: 'primary' | 'accent' | 'success' | 'warning' | 'green' | 'purple';
}

const colorClasses = {
  primary: "hover:bg-primary/15 hover:text-primary",
  accent: "hover:bg-accent/15 hover:text-accent",
  success: "hover:bg-success/15 hover:text-success",
  warning: "hover:bg-warning/15 hover:text-warning",
   green: "hover:bg-green/15 hover:text-green",
   purple: "hover:bg-purple/15 hover:text-purple",
};

export function ToolButton({ 
  onClick, 
  isActive, 
  disabled, 
  icon, 
  label, 
  tooltip, 
  collapsed, 
  color = "primary" 
}: ToolButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClick}
          disabled={disabled}
          className={cn(
            collapsed ? "h-8 w-8 p-0" : "w-full justify-start h-8 px-2",
            "transition-colors",
            colorClasses[color],
            isActive && `bg-${color}/15 text-${color}`
          )}
        >
          {icon}
          {!collapsed && <span className="ml-2 text-xs">{label}</span>}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">
        <p>{tooltip}</p>
      </TooltipContent>
    </Tooltip>
  );
}
