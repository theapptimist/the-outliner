import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useState, useCallback, useEffect } from 'react';
import { EditorToolbar } from './EditorToolbar';
import { SlashCommandMenu } from './SlashCommandMenu';
import { HierarchyBlockExtension } from './extensions/HierarchyBlockExtension';
import { useDocument } from '@/hooks/useDocument';
import './editor-styles.css';

export function DocumentEditor() {
  const { document, addHierarchyBlock, updateContent } = useDocument();
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashMenuPosition, setSlashMenuPosition] = useState({ top: 0, left: 0 });

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === 'heading') {
            return 'Heading...';
          }
          return "Type '/' for commands...";
        },
      }),
      HierarchyBlockExtension,
    ],
    content: document.content,
    onUpdate: ({ editor }) => {
      updateContent(editor.getJSON());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-invert max-w-none focus:outline-none min-h-[500px] px-8 py-6',
      },
      handleKeyDown: (view, event) => {
        if (event.key === '/' && !slashMenuOpen) {
          const { from } = view.state.selection;
          const coords = view.coordsAtPos(from);
          
          setSlashMenuPosition({
            top: coords.bottom + 8,
            left: coords.left,
          });
          
          setTimeout(() => setSlashMenuOpen(true), 0);
          return false;
        }
        return false;
      },
    },
  });

  // Close slash menu when clicking outside
  useEffect(() => {
    if (!slashMenuOpen) return;
    
    const handleClick = () => setSlashMenuOpen(false);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [slashMenuOpen]);

  const handleInsertHierarchy = useCallback(() => {
    if (!editor) return;
    
    // Delete the "/" character if present
    const { from } = editor.state.selection;
    const textBefore = editor.state.doc.textBetween(Math.max(0, from - 1), from);
    if (textBefore === '/') {
      editor.chain().focus().deleteRange({ from: from - 1, to: from }).run();
    }
    
    const blockId = addHierarchyBlock();
    (editor.chain().focus() as any).insertHierarchyBlock(blockId).run();
    setSlashMenuOpen(false);
  }, [editor, addHierarchyBlock]);

  return (
    <div className="flex flex-col h-full bg-background">
      <EditorToolbar editor={editor} onInsertHierarchy={handleInsertHierarchy} />
      
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto">
          <EditorContent editor={editor} />
        </div>
      </div>

      <SlashCommandMenu
        editor={editor}
        isOpen={slashMenuOpen}
        position={slashMenuPosition}
        onClose={() => setSlashMenuOpen(false)}
        onInsertHierarchy={handleInsertHierarchy}
      />
    </div>
  );
}
