import { useState } from 'react';
import { EditReferenceDialog } from './EditReferenceDialog';

interface Citation {
  marker: string;
  text?: string;
}

interface EndNotesSectionProps {
  citations: Citation[];
  citationDefinitions: Record<string, string>;
  onUpdateCitation: (marker: string, text: string) => void;
}

export function EndNotesSection({ 
  citations, 
  citationDefinitions, 
  onUpdateCitation 
}: EndNotesSectionProps) {
  const [editingMarker, setEditingMarker] = useState<string | null>(null);

  if (citations.length === 0) return null;
  
  const editingCitation = citations.find(c => c.marker === editingMarker);
  
  return (
    <div>
      <div className="border-t border-foreground/10 pt-3 mt-4">
        <div className="text-xs font-medium text-muted-foreground mb-2">References</div>
        <ul className="text-sm space-y-1 text-muted-foreground">
          {citations.map((c, i) => {
            const definedText = citationDefinitions[c.marker];
            return (
              <li key={i} className="break-words">
                <button
                  onClick={() => setEditingMarker(c.marker)}
                  className="text-left hover:text-foreground transition-colors group"
                >
                  <span className="font-medium">{c.marker}</span>
                  {definedText ? (
                    <span> {definedText}</span>
                  ) : (
                    <span className="italic"> (Click to add reference)</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      
      <EditReferenceDialog
        open={!!editingMarker}
        onOpenChange={(open) => !open && setEditingMarker(null)}
        marker={editingMarker || ''}
        currentText={editingMarker ? citationDefinitions[editingMarker] || '' : ''}
        onSave={onUpdateCitation}
      />
    </div>
  );
}

/**
 * Scan all nodes for citation markers like [1], [2], or [Author, Year]
 * Returns unique citations in order of appearance
 */
export function extractCitations(nodes: Array<{ label?: string }>): Citation[] {
  const seen = new Set<string>();
  const citations: Citation[] = [];
  
  // Pattern matches [1], [2], [Author, Year], [Smith 2020], etc.
  const citationPattern = /\[(\d+|[A-Za-z][^[\]]{0,50})\]/g;
  
  for (const node of nodes) {
    const label = node.label || '';
    let match;
    
    while ((match = citationPattern.exec(label)) !== null) {
      const marker = match[0]; // Full match like "[1]" or "[Smith, 2020]"
      if (!seen.has(marker)) {
        seen.add(marker);
        citations.push({ marker });
      }
    }
  }
  
  return citations;
}
