import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { User, MapPin, Calendar as CalendarIcon, Quote, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDateForDisplay } from '@/lib/dateScanner';

export type EntityType = 'people' | 'places' | 'dates' | 'terms';

export interface EditableEntity {
  id: string;
  type: EntityType;
  // Person fields
  name?: string;
  role?: string;
  description?: string;
  // Place fields
  significance?: string;
  // Date fields
  date?: Date;
  rawText?: string;
  // Term fields
  term?: string;
  definition?: string;
}

interface EditEntityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entity: EditableEntity | null;
  onSave: (entity: EditableEntity) => void;
}

export function EditEntityDialog({
  open,
  onOpenChange,
  entity,
  onSave,
}: EditEntityDialogProps) {
  // Person/Place name
  const [name, setName] = useState('');
  // Person role
  const [role, setRole] = useState('');
  // Person/Date description
  const [description, setDescription] = useState('');
  // Place significance
  const [significance, setSignificance] = useState('');
  // Date fields
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [rawText, setRawText] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);
  // Term fields
  const [term, setTerm] = useState('');
  const [definition, setDefinition] = useState('');

  // Reset and prefill when dialog opens or entity changes
  useEffect(() => {
    if (open && entity) {
      if (entity.type === 'people') {
        setName(entity.name || '');
        setRole(entity.role || '');
        setDescription(entity.description || '');
      } else if (entity.type === 'places') {
        setName(entity.name || '');
        setSignificance(entity.significance || '');
      } else if (entity.type === 'dates') {
        setSelectedDate(entity.date);
        setRawText(entity.rawText || '');
        setDescription(entity.description || '');
      } else if (entity.type === 'terms') {
        setTerm(entity.term || '');
        setDefinition(entity.definition || '');
      }
    }
  }, [open, entity]);

  const handleSave = () => {
    if (!entity) return;

    const updatedEntity: EditableEntity = { id: entity.id, type: entity.type };

    if (entity.type === 'people') {
      if (!name.trim()) return;
      updatedEntity.name = name.trim();
      updatedEntity.role = role.trim() || undefined;
      updatedEntity.description = description.trim() || undefined;
    } else if (entity.type === 'places') {
      if (!name.trim()) return;
      updatedEntity.name = name.trim();
      updatedEntity.significance = significance.trim() || undefined;
    } else if (entity.type === 'dates') {
      if (!selectedDate) return;
      updatedEntity.date = selectedDate;
      updatedEntity.rawText = rawText.trim() || formatDateForDisplay(selectedDate);
      updatedEntity.description = description.trim() || undefined;
    } else if (entity.type === 'terms') {
      if (!term.trim() || !definition.trim()) return;
      updatedEntity.term = term.trim();
      updatedEntity.definition = definition.trim();
    }

    onSave(updatedEntity);
    onOpenChange(false);
  };

  const isValid = () => {
    if (!entity) return false;
    if (entity.type === 'people' || entity.type === 'places') {
      return name.trim().length > 0;
    }
    if (entity.type === 'dates') {
      return !!selectedDate;
    }
    if (entity.type === 'terms') {
      return term.trim().length > 0 && definition.trim().length > 0;
    }
    return false;
  };

  const getIcon = () => {
    if (!entity) return <Pencil className="h-5 w-5" />;
    switch (entity.type) {
      case 'people': return <User className="h-5 w-5 text-purple-500" />;
      case 'places': return <MapPin className="h-5 w-5 text-green-500" />;
      case 'dates': return <CalendarIcon className="h-5 w-5 text-blue-500" />;
      case 'terms': return <Quote className="h-5 w-5 text-amber-500" />;
    }
  };

  const getTitle = () => {
    if (!entity) return 'Edit Entity';
    switch (entity.type) {
      case 'people': return 'Edit Person';
      case 'places': return 'Edit Place';
      case 'dates': return 'Edit Date';
      case 'terms': return 'Edit Term';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md overflow-hidden">
        <DialogHeader className="overflow-hidden">
          <DialogTitle className="flex items-center gap-2">
            {getIcon()}
            {getTitle()}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Person fields */}
          {entity?.type === 'people' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Harold Norse"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role (optional)</Label>
                <Input
                  id="role"
                  placeholder="e.g., poet, friend, publisher"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  placeholder="Brief bio or relationship note..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="resize-none"
                  rows={3}
                />
              </div>
            </>
          )}

          {/* Place fields */}
          {entity?.type === 'places' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Beat Hotel"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="significance">Significance (optional)</Label>
                <Textarea
                  id="significance"
                  placeholder="Why this place is important..."
                  value={significance}
                  onChange={(e) => setSignificance(e.target.value)}
                  className="resize-none"
                  rows={3}
                />
              </div>
            </>
          )}

          {/* Date fields */}
          {entity?.type === 'dates' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="rawText">Date Text</Label>
                <Input
                  id="rawText"
                  placeholder="e.g., Spring 1959"
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label>Normalized Date</Label>
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !selectedDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDate ? formatDateForDisplay(selectedDate) : "Select a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => {
                        setSelectedDate(date);
                        setCalendarOpen(false);
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  placeholder="Context or notes about this date..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="resize-none"
                  rows={3}
                />
              </div>
            </>
          )}

          {/* Term fields */}
          {entity?.type === 'terms' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="term">Term</Label>
                <Input
                  id="term"
                  placeholder="e.g., Beat Generation"
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="definition">Definition</Label>
                <Textarea
                  id="definition"
                  placeholder="Definition or explanation..."
                  value={definition}
                  onChange={(e) => setDefinition(e.target.value)}
                  className="resize-none"
                  rows={4}
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!isValid()}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
