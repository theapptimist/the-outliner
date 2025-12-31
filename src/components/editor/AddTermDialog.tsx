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

interface AddTermDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefillSelection?: string;
  onSave: (term: string, definition: string) => void;
}

/**
 * Smart extraction patterns for legal/contract language.
 * These patterns extract the defined term from common phrasings.
 */
const EXTRACTION_PATTERNS = [
  // "referred to as the 'X'" or "referred to below as the 'X'"
  /referred\s+to\s+(?:below\s+)?as\s+(?:the\s+)?["'"]([^"'"]+)["'"]/i,
  // "(the 'X')" or "('X')"
  /\(\s*(?:the\s+)?["'"]([^"'"]+)["'"]\s*\)/i,
  // "hereinafter 'X'" or "hereinafter referred to as 'X'"
  /hereinafter\s+(?:referred\s+to\s+as\s+)?(?:the\s+)?["'"]([^"'"]+)["'"]/i,
  // "collectively, the 'X'" or "collectively referred to as 'X'"
  /collectively[,]?\s+(?:referred\s+to\s+as\s+)?(?:the\s+)?["'"]([^"'"]+)["'"]/i,
  // "each, a 'X'" or "each a 'X'"
  /each[,]?\s+(?:a\s+)?["'"]([^"'"]+)["'"]/i,
];

function extractTermFromSelection(selection: string): { term: string; context: string } | null {
  for (const pattern of EXTRACTION_PATTERNS) {
    const match = selection.match(pattern);
    if (match && match[1]) {
      return {
        term: match[1].trim(),
        context: selection.replace(match[0], '').trim(),
      };
    }
  }
  return null;
}

export function AddTermDialog({
  open,
  onOpenChange,
  prefillSelection,
  onSave,
}: AddTermDialogProps) {
  const [term, setTerm] = useState('');
  const [definition, setDefinition] = useState('');

  // Reset and prefill when dialog opens
  useEffect(() => {
    if (open) {
      if (prefillSelection) {
        const extracted = extractTermFromSelection(prefillSelection);
        if (extracted) {
          setTerm(extracted.term);
          setDefinition(extracted.context || '');
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
  }, [open, prefillSelection]);

  const handleSave = () => {
    if (term.trim() && definition.trim()) {
      onSave(term.trim(), definition.trim());
      onOpenChange(false);
    }
  };

  const isValid = term.trim().length > 0 && definition.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Defined Term</DialogTitle>
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
