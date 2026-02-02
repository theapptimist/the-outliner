import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Extension } from '@tiptap/react';

export const dateHighlightPluginKey = new PluginKey('dateHighlight');

// Types duplicated here to avoid circular imports
export type DateHighlightMode = 'all' | 'selected' | 'none';

export interface TaggedDate {
  id: string;
  date: Date;
  rawText: string;
  description?: string;
  usages: Array<{
    blockId: string;
    nodeId: string;
    nodeLabel: string;
    nodePrefix: string;
    count: number;
  }>;
}

interface DateHighlightState {
  dates: TaggedDate[];
  highlightMode: DateHighlightMode;
  highlightedDate: TaggedDate | null;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findDateMatches(
  doc: any,
  dates: TaggedDate[],
  highlightMode: DateHighlightMode,
  highlightedDate: TaggedDate | null
): Decoration[] {
  const decorations: Decoration[] = [];

  if (highlightMode === 'none' || dates.length === 0) {
    return decorations;
  }

  // Determine which dates to highlight
  // In 'selected' mode with no date chosen, highlight nothing (wait state)
  const datesToHighlight = highlightMode === 'selected'
    ? (highlightedDate ? [highlightedDate] : [])
    : dates;

  if (datesToHighlight.length === 0) {
    return decorations;
  }

  // Build regex pattern for all date raw texts (case-insensitive)
  const patterns = datesToHighlight.map(d => ({
    date: d,
    regex: new RegExp(escapeRegex(d.rawText), 'gi')
  }));

  // Walk through all text nodes
  doc.descendants((node: any, pos: number) => {
    if (!node.isText) return;

    const text = node.text || '';

    for (const { date, regex } of patterns) {
      regex.lastIndex = 0;
      let match;

      while ((match = regex.exec(text)) !== null) {
        const from = pos + match.index;
        const to = from + match[0].length;

        decorations.push(
          Decoration.inline(from, to, {
            class: 'date-highlight entity-clickable',
            'data-date-id': date.id,
          })
        );
      }
    }
  });

  return decorations;
}

export function createDateHighlightPlugin(initialState: DateHighlightState) {
  // Track current state so doc changes don't lose highlight settings
  let currentState = { ...initialState };

  return new Plugin({
    key: dateHighlightPluginKey,
    state: {
      init(_, { doc }) {
        const decorations = findDateMatches(
          doc,
          currentState.dates,
          currentState.highlightMode,
          currentState.highlightedDate
        );
        return DecorationSet.create(doc, decorations);
      },
      apply(tr, oldDecorations, oldState, newState) {
        // Check if our metadata changed
        const meta = tr.getMeta(dateHighlightPluginKey) as DateHighlightState | undefined;

        if (meta) {
          // Update current state when metadata is received
          currentState = { ...meta };
        }

        if (meta || tr.docChanged) {
          const decorations = findDateMatches(
            newState.doc,
            currentState.dates,
            currentState.highlightMode,
            currentState.highlightedDate
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

export const DateHighlightExtension = Extension.create({
  name: 'dateHighlight',

  addProseMirrorPlugins() {
    return [
      createDateHighlightPlugin({
        dates: [],
        highlightMode: 'all',
        highlightedDate: null,
      }),
    ];
  },
});
