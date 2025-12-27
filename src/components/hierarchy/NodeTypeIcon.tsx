import { NodeType } from '@/types/node';
import { 
  Circle, 
  Box, 
  Database, 
  Zap, 
  Link2 
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NodeTypeIconProps {
  type: NodeType;
  className?: string;
  size?: number;
}

const iconMap: Record<NodeType, React.ElementType> = {
  default: Circle,
  container: Box,
  data: Database,
  action: Zap,
  reference: Link2,
};

const colorMap: Record<NodeType, string> = {
  default: 'text-node-default',
  container: 'text-node-container',
  data: 'text-node-data',
  action: 'text-node-action',
  reference: 'text-node-reference',
};

export function NodeTypeIcon({ type, className, size = 14 }: NodeTypeIconProps) {
  const Icon = iconMap[type];
  
  return (
    <Icon 
      size={size} 
      className={cn(colorMap[type], className)}
    />
  );
}
