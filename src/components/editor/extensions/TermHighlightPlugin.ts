import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Extension } from '@tiptap/react';
import { DefinedTerm, HighlightMode } from '../EditorContext';

export const termHighlightPluginKey = new PluginKey('termHighlight');

interface TermHighlightState {
  terms: DefinedTerm[];
  highlightMode: HighlightMode;
  highlightedTerm: DefinedTerm | null;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findTermMatches(
  doc: any,
  terms: DefinedTerm[],
  highlightMode: HighlightMode,
  highlightedTerm: DefinedTerm | null
): Decoration[] {
  const decorations: Decoration[] = [];
  
  if (highlightMode === 'none' || terms.length === 0) {
    return decorations;
  }

  // Determine which terms to highlight
  // In 'selected' mode with no term chosen, highlight nothing (wait state)
  const termsToHighlight = highlightMode === 'selected'
    ? (highlightedTerm ? [highlightedTerm] : [])
    : terms;

  if (termsToHighlight.length === 0) {
    return decorations;
  }

  // Build regex pattern for all terms (case-insensitive, word boundaries)
  const patterns = termsToHighlight.map(t => ({
    term: t,
    regex: new RegExp(`\\b${escapeRegex(t.term)}\\b`, 'gi')
  }));

  // Walk through all text nodes
  doc.descendants((node: any, pos: number) => {
    if (!node.isText) return;
    
    const text = node.text || '';
    
    for (const { term, regex } of patterns) {
      regex.lastIndex = 0; // Reset regex state
      let match;
      
      while ((match = regex.exec(text)) !== null) {
        const from = pos + match.index;
        const to = from + match[0].length;
        
        decorations.push(
          Decoration.inline(from, to, {
            class: 'term-highlight entity-clickable',
            'data-term-id': term.id,
          })
        );
      }
    }
  });

  return decorations;
}

export function createTermHighlightPlugin(initialState: TermHighlightState) {
  // Track current state so doc changes don't lose highlight settings
  let currentState = { ...initialState };
  
  return new Plugin({
    key: termHighlightPluginKey,
    state: {
      init(_, { doc }) {
        const decorations = findTermMatches(
          doc,
          currentState.terms,
          currentState.highlightMode,
          currentState.highlightedTerm
        );
        return DecorationSet.create(doc, decorations);
      },
      apply(tr, oldDecorations, oldState, newState) {
        // Check if our metadata changed
        const meta = tr.getMeta(termHighlightPluginKey) as TermHighlightState | undefined;
        
        if (meta) {
          // Update current state when metadata is received
          currentState = { ...meta };
        }
        
        if (meta || tr.docChanged) {
          const decorations = findTermMatches(
            newState.doc,
            currentState.terms,
            currentState.highlightMode,
            currentState.highlightedTerm
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

export const TermHighlightExtension = Extension.create({
  name: 'termHighlight',

  addProseMirrorPlugins() {
    return [
      createTermHighlightPlugin({
        terms: [],
        highlightMode: 'all',
        highlightedTerm: null,
      }),
    ];
  },
});
