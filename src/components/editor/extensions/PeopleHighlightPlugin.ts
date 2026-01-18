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
    regex: new RegExp(`\\b${escapeRegex(normalizeEntityName(p.name))}\\b`, 'gi')
  })).filter(({ regex }) => regex.source !== '\\b\\b'); // Filter out empty names

  // Walk through all text nodes
  doc.descendants((node: any, pos: number) => {
    if (!node.isText) return;

    const text = node.text || '';

    for (const { person, regex } of patterns) {
      regex.lastIndex = 0;
      let match;

      while ((match = regex.exec(text)) !== null) {
        const from = pos + match.index;
        const to = from + match[0].length;

        decorations.push(
          Decoration.inline(from, to, {
            class: 'person-highlight',
            'data-person-id': person.id,
          })
        );
      }
    }
  });

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
