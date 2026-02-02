import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Extension } from '@tiptap/react';
import { normalizeEntityName } from '@/lib/entityNameUtils';

export const peopleHighlightPluginKey = new PluginKey('peopleHighlight');

// Types duplicated here to avoid circular imports
export type PeopleHighlightMode = 'all' | 'selected' | 'none';

export interface TaggedPerson {
  id: string;
  name: string;
  role?: string;
  description?: string;
  usages: Array<{
    blockId: string;
    nodeId: string;
    nodeLabel: string;
    nodePrefix: string;
    count: number;
  }>;
}

interface PeopleHighlightState {
  people: TaggedPerson[];
  highlightMode: PeopleHighlightMode;
  highlightedPerson: TaggedPerson | null;
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

function findPeopleMatches(
  doc: any,
  people: TaggedPerson[],
  highlightMode: PeopleHighlightMode,
  highlightedPerson: TaggedPerson | null
): Decoration[] {
  const decorations: Decoration[] = [];

  if (highlightMode === 'none' || people.length === 0) {
    return decorations;
  }

  // Determine which people to highlight
  // In 'selected' mode with no person chosen, highlight nothing (wait state)
  const peopleToHighlight = highlightMode === 'selected'
    ? (highlightedPerson ? [highlightedPerson] : [])
    : people;

  if (peopleToHighlight.length === 0) {
    return decorations;
  }

  // Build regex pattern for all person names (case-insensitive, word boundaries)
  // Normalize names to ensure consistent matching
  const patterns = peopleToHighlight.map(p => ({
    person: p,
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
  for (const { person, normalizedName } of patterns) {
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
            class: 'person-highlight entity-clickable',
            'data-person-id': person.id,
          })
        );
      }
    }
  }

  return decorations;
}

export function createPeopleHighlightPlugin(initialState: PeopleHighlightState) {
  // Track current state so doc changes don't lose highlight settings
  let currentState = { ...initialState };

  return new Plugin({
    key: peopleHighlightPluginKey,
    state: {
      init(_, { doc }) {
        const decorations = findPeopleMatches(
          doc,
          currentState.people,
          currentState.highlightMode,
          currentState.highlightedPerson
        );
        return DecorationSet.create(doc, decorations);
      },
      apply(tr, oldDecorations, oldState, newState) {
        // Check if our metadata changed
        const meta = tr.getMeta(peopleHighlightPluginKey) as PeopleHighlightState | undefined;

        if (meta) {
          // Update current state when metadata is received
          currentState = { ...meta };
        }

        if (meta || tr.docChanged) {
          const decorations = findPeopleMatches(
            newState.doc,
            currentState.people,
            currentState.highlightMode,
            currentState.highlightedPerson
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

export const PeopleHighlightExtension = Extension.create({
  name: 'peopleHighlight',

  addProseMirrorPlugins() {
    return [
      createPeopleHighlightPlugin({
        people: [],
        highlightMode: 'all',
        highlightedPerson: null,
      }),
    ];
  },
});
