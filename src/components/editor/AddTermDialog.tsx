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
import { MapPin } from 'lucide-react';
import { SelectionSource } from './EditorContext';

interface AddTermDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefillSelection?: string;
  selectionSource?: SelectionSource | null;
  onSave: (term: string, definition: string, source?: SelectionSource | null) => void;
}

/**
 * Smart extraction patterns for legal/contract language.
 * These patterns extract the defined term from common phrasings.
 */
/**
 * Extract the term from any quoted text in the selection.
 * Supports double quotes, single quotes, and smart quotes.
 * The term is the quoted text; the definition is the full selection.
 */
function extractTermFromSelection(selection: string): { term: string; definition: string } | null {
  // Match any text in quotes (double, single, or smart quotes)
  const quotePattern = /["'""]([^"'""]+)["'""]/;
  const match = selection.match(quotePattern);
  
  if (match && match[1]) {
    return {
      term: match[1].trim(),
      definition: selection.trim(),
    };
  }
  return null;
}

export function AddTermDialog({
  open,
  onOpenChange,
  prefillSelection,
  selectionSource,
  onSave,
}: AddTermDialogProps) {
  const [term, setTerm] = useState('');
  const [definition, setDefinition] = useState('');
  const [capturedSource, setCapturedSource] = useState<SelectionSource | null>(null);

  // Reset and prefill when dialog opens
  useEffect(() => {
    if (open) {
      // Capture the source location at the moment the dialog opens
      setCapturedSource(selectionSource || null);
      
      if (prefillSelection) {
        const extracted = extractTermFromSelection(prefillSelection);
        if (extracted) {
          setTerm(extracted.term);
          setDefinition(extracted.definition);
        } else {
          // No pattern matched - use selection as the term
          setTerm(prefillSelection.trim());
          setDefinition('');
        }
      } else {
        setTerm('');
        setDefinition('');
      }
    }
  }, [open, prefillSelection, selectionSource]);

  const handleSave = () => {
    if (term.trim() && definition.trim()) {
      onSave(term.trim(), definition.trim(), capturedSource);
      onOpenChange(false);
    }
  };

  const isValid = term.trim().length > 0 && definition.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Defined Term</DialogTitle>
          {capturedSource && (
            <div className="flex items-center gap-1.5 text-xs text-primary/80 mt-1">
              <MapPin className="h-3 w-3" />
              <span className="font-mono">{capturedSource.nodePrefix}</span>
              <span className="truncate max-w-[200px]">{capturedSource.nodeLabel}</span>
            </div>
          )}
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="term">Term</Label>
            <Input
              id="term"
              placeholder='e.g., "Parties"'
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="definition">Definition</Label>
            <Textarea
              id="definition"
              placeholder="Plain-language explanation of what this term means..."
              value={definition}
              onChange={(e) => setDefinition(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!isValid}>
            Save Term
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
