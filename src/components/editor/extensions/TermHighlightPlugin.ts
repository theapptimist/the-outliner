import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Extension } from '@tiptap/react';
import { DefinedTerm, HighlightMode } from '../EditorContext';

export const termHighlightPluginKey = new PluginKey('termHighlight');

interface TermHighlightState {
  terms: DefinedTerm[];
  highlightMode: HighlightMode;
  inspectedTerm: DefinedTerm | null;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findTermMatches(
  doc: any,
  terms: DefinedTerm[],
  highlightMode: HighlightMode,
  inspectedTerm: DefinedTerm | null
): Decoration[] {
  const decorations: Decoration[] = [];
  
  if (highlightMode === 'none' || terms.length === 0) {
    return decorations;
  }

  // Determine which terms to highlight
  const termsToHighlight = highlightMode === 'selected' && inspectedTerm
    ? [inspectedTerm]
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
            class: 'term-highlight',
            'data-term-id': term.id,
          })
        );
      }
    }
  });

  return decorations;
}

export function createTermHighlightPlugin(initialState: TermHighlightState) {
  return new Plugin({
    key: termHighlightPluginKey,
    state: {
      init(_, { doc }) {
        const decorations = findTermMatches(
          doc,
          initialState.terms,
          initialState.highlightMode,
          initialState.inspectedTerm
        );
        return DecorationSet.create(doc, decorations);
      },
      apply(tr, oldDecorations, oldState, newState) {
        // Check if our metadata changed
        const meta = tr.getMeta(termHighlightPluginKey) as TermHighlightState | undefined;
        
        if (meta || tr.docChanged) {
          const state = meta || {
            terms: initialState.terms,
            highlightMode: initialState.highlightMode,
            inspectedTerm: initialState.inspectedTerm,
          };
          
          const decorations = findTermMatches(
            newState.doc,
            state.terms,
            state.highlightMode,
            state.inspectedTerm
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
        inspectedTerm: null,
      }),
    ];
  },
});
