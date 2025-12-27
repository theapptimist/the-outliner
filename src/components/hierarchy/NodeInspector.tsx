import { useState } from 'react';
import { HierarchyNode, NodeType } from '@/types/node';
import { NodeTypeIcon } from './NodeTypeIcon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NodeInspectorProps {
  node: HierarchyNode | null;
  onUpdate: (id: string, updates: Partial<HierarchyNode>) => void;
  onClose: () => void;
}

const nodeTypes: { value: NodeType; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'container', label: 'Container' },
  { value: 'data', label: 'Data' },
  { value: 'action', label: 'Action' },
  { value: 'reference', label: 'Reference' },
];

export function NodeInspector({ node, onUpdate, onClose }: NodeInspectorProps) {
  const [newPropKey, setNewPropKey] = useState('');
  const [newPropValue, setNewPropValue] = useState('');

  if (!node) {
    return (
      <div className="w-72 border-l border-border bg-card p-4">
        <p className="text-sm text-muted-foreground text-center mt-8">
          Select a node to inspect
        </p>
      </div>
    );
  }

  const handleAddProperty = () => {
    if (!newPropKey.trim()) return;
    
    onUpdate(node.id, {
      properties: {
        ...node.properties,
        [newPropKey.trim()]: newPropValue,
      },
    });
    setNewPropKey('');
    setNewPropValue('');
  };

  const handleRemoveProperty = (key: string) => {
    const { [key]: _, ...rest } = node.properties;
    onUpdate(node.id, { properties: rest });
  };

  const handleUpdateProperty = (key: string, value: string) => {
    onUpdate(node.id, {
      properties: {
        ...node.properties,
        [key]: value,
      },
    });
  };

  return (
    <div className="w-72 border-l border-border bg-card flex flex-col animate-slide-in">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <NodeTypeIcon type={node.type} size={16} />
          <span className="font-medium text-sm truncate">{node.label}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0">
          <X size={14} />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto scrollbar-thin p-4 space-y-6">
        {/* Basic Info */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Label</Label>
            <Input
              value={node.label}
              onChange={(e) => onUpdate(node.id, { label: e.target.value })}
              className="h-8 text-sm font-mono bg-background"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Type</Label>
            <Select
              value={node.type}
              onValueChange={(value: NodeType) => onUpdate(node.id, { type: value })}
            >
              <SelectTrigger className="h-8 text-sm bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {nodeTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div className="flex items-center gap-2">
                      <NodeTypeIcon type={type.value} size={12} />
                      <span>{type.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">ID</Label>
            <code className="block text-xs font-mono text-muted-foreground bg-muted px-2 py-1.5 rounded truncate">
              {node.id}
            </code>
          </div>
        </div>

        {/* Properties */}
        <div className="space-y-3">
          <Label className="text-xs text-muted-foreground">Properties</Label>
          
          {Object.entries(node.properties).map(([key, value]) => (
            <div key={key} className="flex items-center gap-2">
              <Input
                value={key}
                disabled
                className="h-7 text-xs font-mono bg-muted flex-1"
              />
              <Input
                value={String(value ?? '')}
                onChange={(e) => handleUpdateProperty(key, e.target.value)}
                className="h-7 text-xs font-mono bg-background flex-1"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveProperty(key)}
                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
              >
                <Trash2 size={12} />
              </Button>
            </div>
          ))}

          {/* Add property form */}
          <div className="flex items-center gap-2">
            <Input
              placeholder="key"
              value={newPropKey}
              onChange={(e) => setNewPropKey(e.target.value)}
              className="h-7 text-xs font-mono bg-background flex-1"
            />
            <Input
              placeholder="value"
              value={newPropValue}
              onChange={(e) => setNewPropValue(e.target.value)}
              className="h-7 text-xs font-mono bg-background flex-1"
              onKeyDown={(e) => e.key === 'Enter' && handleAddProperty()}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAddProperty}
              disabled={!newPropKey.trim()}
              className="h-7 w-7 p-0"
            >
              <Plus size={12} />
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="space-y-2 pt-2 border-t border-border">
          <Label className="text-xs text-muted-foreground">Statistics</Label>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-muted rounded px-2 py-1.5">
              <span className="text-muted-foreground">Children:</span>{' '}
              <span className="font-mono">{node.children.length}</span>
            </div>
            <div className="bg-muted rounded px-2 py-1.5">
              <span className="text-muted-foreground">Props:</span>{' '}
              <span className="font-mono">{Object.keys(node.properties).length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
