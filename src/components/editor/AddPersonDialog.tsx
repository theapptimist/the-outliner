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
import { MapPin, User } from 'lucide-react';
import { SelectionSource } from './EditorContext';

interface AddPersonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefillSelection?: string;
  selectionSource?: SelectionSource | null;
  onSave: (name: string, role?: string, description?: string) => void;
}

export function AddPersonDialog({
  open,
  onOpenChange,
  prefillSelection,
  selectionSource,
  onSave,
}: AddPersonDialogProps) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [description, setDescription] = useState('');

  // Reset and prefill when dialog opens
  useEffect(() => {
    if (open) {
      if (prefillSelection) {
        setName(prefillSelection.trim());
      } else {
        setName('');
      }
      setRole('');
      setDescription('');
    }
  }, [open, prefillSelection]);

  const handleSave = () => {
    if (name.trim()) {
      onSave(name.trim(), role.trim() || undefined, description.trim() || undefined);
      onOpenChange(false);
    }
  };

  const isValid = name.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md overflow-hidden">
        <DialogHeader className="overflow-hidden">
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-purple-500" />
            Add Person
          </DialogTitle>
          {selectionSource && (
            <div className="flex items-start gap-2 text-sm text-primary mt-2 bg-primary/10 px-3 py-2 rounded-md">
              <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span className="font-mono font-semibold flex-shrink-0">{selectionSource.nodePrefix}</span>
              <span className="break-words">{selectionSource.nodeLabel}</span>
            </div>
          )}
        </DialogHeader>

        <div className="space-y-4 py-4">
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
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!isValid}>
            Add Person
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
