import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Extension } from '@tiptap/react';

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
  const patterns = placesToHighlight.map(p => ({
    place: p,
    regex: new RegExp(`\\b${escapeRegex(p.name)}\\b`, 'gi')
  }));

  // Walk through all text nodes
  doc.descendants((node: any, pos: number) => {
    if (!node.isText) return;

    const text = node.text || '';

    for (const { place, regex } of patterns) {
      regex.lastIndex = 0;
      let match;

      while ((match = regex.exec(text)) !== null) {
        const from = pos + match.index;
        const to = from + match[0].length;

        decorations.push(
          Decoration.inline(from, to, {
            class: 'place-highlight',
            'data-place-id': place.id,
          })
        );
      }
    }
  });

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
