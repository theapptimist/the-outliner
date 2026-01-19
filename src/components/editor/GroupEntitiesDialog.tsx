import React, { useState } from 'react';
import { User, MapPin, Calendar, BookOpen, ArrowRight, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { COMMON_RELATIONSHIP_TYPES, createEntityRelationship } from '@/lib/cloudEntityRelationshipStorage';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { EntityRef } from './LibraryPane';

interface GroupEntitiesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: EntityRef | null;
  targets: EntityRef[];
  onSuccess: () => void;
}

const ENTITY_ICONS = {
  people: User,
  places: MapPin,
  dates: Calendar,
  terms: BookOpen,
};

const ENTITY_COLORS = {
  people: 'text-blue-500',
  places: 'text-emerald-500',
  dates: 'text-amber-500',
  terms: 'text-purple-500',
};

export function GroupEntitiesDialog({
  open,
  onOpenChange,
  source,
  targets,
  onSuccess,
}: GroupEntitiesDialogProps) {
  const { user } = useAuth();
  const [relationshipType, setRelationshipType] = useState<string>('');
  const [customType, setCustomType] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const effectiveType = relationshipType === '__custom__' ? customType.trim() : relationshipType;
  const canSubmit = source && targets.length > 0 && effectiveType && user;

  const handleSubmit = async () => {
    if (!canSubmit || !user || !source) return;

    setIsSubmitting(true);
    try {
      // Create relationships for each target
      const results = await Promise.all(
        targets.map(target =>
          createEntityRelationship(
            source.id,
            target.id,
            effectiveType,
            user.id,
            description.trim() || undefined
          )
        )
      );

      const successCount = results.filter(r => r !== null).length;
      const failCount = results.filter(r => r === null).length;

      if (successCount > 0) {
        toast.success(`Created ${successCount} relationship${successCount !== 1 ? 's' : ''}`);
        onSuccess();
        handleClose();
      }
      if (failCount > 0) {
        toast.error(`Failed to create ${failCount} relationship${failCount !== 1 ? 's' : ''}`);
      }
    } catch (error) {
      console.error('Failed to create relationships:', error);
      toast.error('Failed to create relationships');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setRelationshipType('');
    setCustomType('');
    setDescription('');
    onOpenChange(false);
  };

  if (!source) return null;

  const SourceIcon = ENTITY_ICONS[source.type];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Relationships</DialogTitle>
          <DialogDescription>
            Define how "{source.name}" relates to the selected entities
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Source entity */}
          <div className="p-3 rounded-lg bg-muted/50 border border-border">
            <div className="text-xs text-muted-foreground mb-1">Source</div>
            <div className="flex items-center gap-2">
              <SourceIcon className={cn("h-4 w-4", ENTITY_COLORS[source.type])} />
              <span className="text-sm font-medium">{source.name}</span>
            </div>
          </div>

          {/* Relationship type */}
          <div className="space-y-2">
            <Label className="text-xs">Relationship Type</Label>
            <Select value={relationshipType} onValueChange={setRelationshipType}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select relationship type..." />
              </SelectTrigger>
              <SelectContent>
                {COMMON_RELATIONSHIP_TYPES.map(type => (
                  <SelectItem key={type} value={type} className="text-sm">
                    {type}
                  </SelectItem>
                ))}
                <SelectItem value="__custom__" className="text-sm">
                  Custom type...
                </SelectItem>
              </SelectContent>
            </Select>

            {relationshipType === '__custom__' && (
              <Input
                value={customType}
                onChange={(e) => setCustomType(e.target.value)}
                placeholder="Enter custom relationship type"
                className="h-8 text-sm"
              />
            )}
          </div>

          {/* Arrow + targets preview */}
          <div className="flex items-center gap-3">
            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex-1">
              <div className="text-xs text-muted-foreground mb-1">
                Targets ({targets.length})
              </div>
              <ScrollArea className="max-h-32">
                <div className="space-y-1">
                  {targets.map(target => {
                    const TargetIcon = ENTITY_ICONS[target.type];
                    return (
                      <div
                        key={`${target.type}-${target.id}`}
                        className="flex items-center gap-2 p-1.5 rounded bg-muted/30"
                      >
                        <TargetIcon className={cn("h-3.5 w-3.5", ENTITY_COLORS[target.type])} />
                        <span className="text-xs">{target.name}</span>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label className="text-xs">Description (optional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add notes about this relationship..."
              className="min-h-[60px] text-sm resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              `Create ${targets.length} Relationship${targets.length !== 1 ? 's' : ''}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
