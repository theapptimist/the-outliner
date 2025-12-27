import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { HierarchyBlockView } from '../HierarchyBlockView';

export interface HierarchyBlockOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    hierarchyBlock: {
      insertHierarchyBlock: (blockId: string) => ReturnType;
    };
  }
}

export const HierarchyBlockExtension = Node.create<HierarchyBlockOptions>({
  name: 'hierarchyBlock',
  group: 'block',
  atom: true,
  draggable: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      blockId: {
        default: null,
        parseHTML: element => element.getAttribute('data-block-id'),
        renderHTML: attributes => {
          if (!attributes.blockId) return {};
          return { 'data-block-id': attributes.blockId };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="hierarchy-block"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { 'data-type': 'hierarchy-block' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(HierarchyBlockView);
  },

  addCommands() {
    return {
      insertHierarchyBlock:
        (blockId: string) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { blockId },
          });
        },
    };
  },
});
