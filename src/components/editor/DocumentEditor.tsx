import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useState, useCallback, useEffect } from 'react';
import { SlashCommandMenu } from './SlashCommandMenu';
import { FindReplace } from './FindReplace';
import { HierarchyBlockExtension } from './extensions/HierarchyBlockExtension';
import { useDocument } from '@/hooks/useDocument';
import { useEditorContext } from './EditorContext';
import './editor-styles.css';

export function DocumentEditor() {
  const { document, addHierarchyBlock, updateContent } = useDocument();
  const { setEditor, setInsertHierarchyHandler, setFindReplaceHandler } = useEditorContext();
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashMenuPosition, setSlashMenuPosition] = useState({ top: 0, left: 0 });
  const [findReplaceOpen, setFindReplaceOpen] = useState(false);
  const [showReplace, setShowReplace] = useState(false);

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
        class: 'prose prose-invert max-w-none focus:outline-none min-h-[500px] px-6 py-6',
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

  // Register editor in context
  useEffect(() => {
    setEditor(editor);
    return () => setEditor(null);
  }, [editor, setEditor]);

  // Keyboard shortcuts for find/replace
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setShowReplace(false);
        setFindReplaceOpen(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
        e.preventDefault();
        setShowReplace(true);
        setFindReplaceOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Register find/replace handler in context
  useEffect(() => {
    setFindReplaceHandler((withReplace: boolean) => {
      setShowReplace(withReplace);
      setFindReplaceOpen(true);
    });
  }, [setFindReplaceHandler]);

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

  // Register insert hierarchy handler
  useEffect(() => {
    setInsertHierarchyHandler(handleInsertHierarchy);
  }, [handleInsertHierarchy, setInsertHierarchyHandler]);

  return (
    <div className="flex flex-col h-full bg-background relative">
      <div className="flex-1 overflow-auto">
        <div className="w-full">
          <EditorContent editor={editor} />
        </div>
      </div>

      <FindReplace
        editor={editor}
        isOpen={findReplaceOpen}
        onClose={() => setFindReplaceOpen(false)}
        showReplace={showReplace}
      />

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
