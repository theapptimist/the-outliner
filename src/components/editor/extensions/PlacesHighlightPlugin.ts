import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Extension } from '@tiptap/react';
import { normalizeEntityName } from '@/lib/entityNameUtils';

export const placesHighlightPluginKey = new PluginKey('placesHighlight');

// Types duplicated here to avoid circular imports
export type PlacesHighlightMode = 'all' | 'selected' | 'none';

export interface TaggedPlace {
  id: string;
  name: string;
  significance?: string;
  usages: Array<{
    blockId: string;
    nodeId: string;
    nodeLabel: string;
    nodePrefix: string;
    count: number;
  }>;
}

interface PlacesHighlightState {
  places: TaggedPlace[];
  highlightMode: PlacesHighlightMode;
  highlightedPlace: TaggedPlace | null;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Build a linearized text map of the document for cross-node matching
interface TextSegment {
  text: string;
  from: number; // ProseMirror position
  to: number;
}

function buildLinearizedTextMap(doc: any): { fullText: string; segments: TextSegment[] } {
  const segments: TextSegment[] = [];
  let fullText = '';
  
  doc.descendants((node: any, pos: number) => {
    if (!node.isText) return;
    
    const text = node.text || '';
    segments.push({
      text,
      from: pos,
      to: pos + text.length,
    });
    fullText += text;
  });
  
  return { fullText, segments };
}

// Convert an index in the full concatenated text to a ProseMirror position
function fullTextIndexToDocPos(index: number, segments: TextSegment[]): number {
  let offset = 0;
  for (const segment of segments) {
    const segmentEnd = offset + segment.text.length;
    if (index < segmentEnd) {
      // The index falls within this segment
      const relativeIndex = index - offset;
      return segment.from + relativeIndex;
    }
    offset = segmentEnd;
  }
  // Fallback: return end of last segment
  if (segments.length > 0) {
    return segments[segments.length - 1].to;
  }
  return 0;
}

function findPlacesMatches(
  doc: any,
  places: TaggedPlace[],
  highlightMode: PlacesHighlightMode,
  highlightedPlace: TaggedPlace | null
): Decoration[] {
  const decorations: Decoration[] = [];

  if (highlightMode === 'none' || places.length === 0) {
    return decorations;
  }

  // Determine which places to highlight
  // In 'selected' mode with no place chosen, highlight nothing (wait state)
  const placesToHighlight = highlightMode === 'selected'
    ? (highlightedPlace ? [highlightedPlace] : [])
    : places;

  if (placesToHighlight.length === 0) {
    return decorations;
  }

  // Build regex pattern for all place names (case-insensitive, word boundaries)
  // Normalize names to ensure consistent matching
  const patterns = placesToHighlight.map(p => ({
    place: p,
    normalizedName: normalizeEntityName(p.name),
  })).filter(({ normalizedName }) => normalizedName.length > 0);

  if (patterns.length === 0) {
    return decorations;
  }

  // Build linearized text map for cross-node matching
  const { fullText, segments } = buildLinearizedTextMap(doc);
  
  if (fullText.length === 0 || segments.length === 0) {
    return decorations;
  }

  // Find matches in the linearized text
  for (const { place, normalizedName } of patterns) {
    const regex = new RegExp(`\\b${escapeRegex(normalizedName)}\\b`, 'gi');
    regex.lastIndex = 0;
    let match;

    while ((match = regex.exec(fullText)) !== null) {
      const matchStart = match.index;
      const matchEnd = matchStart + match[0].length;
      
      // Convert fullText indices to ProseMirror positions
      const from = fullTextIndexToDocPos(matchStart, segments);
      const to = fullTextIndexToDocPos(matchEnd, segments);

      // Validate the decoration range
      if (from < to && from >= 0) {
        decorations.push(
          Decoration.inline(from, to, {
            class: 'place-highlight',
            'data-place-id': place.id,
          })
        );
      }
    }
  }

  return decorations;
}

export function createPlacesHighlightPlugin(initialState: PlacesHighlightState) {
  // Track current state so doc changes don't lose highlight settings
  let currentState = { ...initialState };

  return new Plugin({
    key: placesHighlightPluginKey,
    state: {
      init(_, { doc }) {
        const decorations = findPlacesMatches(
          doc,
          currentState.places,
          currentState.highlightMode,
          currentState.highlightedPlace
        );
        return DecorationSet.create(doc, decorations);
      },
      apply(tr, oldDecorations, oldState, newState) {
        // Check if our metadata changed
        const meta = tr.getMeta(placesHighlightPluginKey) as PlacesHighlightState | undefined;

        if (meta) {
          // Update current state when metadata is received
          currentState = { ...meta };
        }

        if (meta || tr.docChanged) {
          const decorations = findPlacesMatches(
            newState.doc,
            currentState.places,
            currentState.highlightMode,
            currentState.highlightedPlace
          );
          return DecorationSet.create(newState.doc, decorations);
        }

        // Map decorations through document changes
        return oldDecorations.map(tr.mapping, tr.doc);
      },
    },
    props: {
      decorations(state) {
        return this.getState(state);
      },
    },
  });
}

export const PlacesHighlightExtension = Extension.create({
  name: 'placesHighlight',

  addProseMirrorPlugins() {
    return [
      createPlacesHighlightPlugin({
        places: [],
        highlightMode: 'all',
        highlightedPlace: null,
      }),
    ];
  },
});
