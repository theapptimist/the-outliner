import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useState, useCallback, useEffect, useRef } from 'react';
import { SlashCommandMenu } from './SlashCommandMenu';
import { FindReplace } from './FindReplace';
import { HierarchyBlockExtension } from './extensions/HierarchyBlockExtension';
import { PaginatedDocument } from './PageContainer';
import { useEditorContext } from './EditorContext';
import { useSessionStorage } from '@/hooks/useSessionStorage';

export function DocumentEditor() {
  // Persist TipTap document content to localStorage so blockIds survive refresh
  const [savedContent, setSavedContent] = useSessionStorage<any>('document-content', null);
  const initialContentRef = useRef(savedContent);
  const {
    setEditor,
    setInsertHierarchyHandler,
    setFindReplaceHandler,
    setSelectedText,
  } = useEditorContext();
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
    content: initialContentRef.current,
    onUpdate: ({ editor }) => {
      setSavedContent(editor.getJSON());
    },
    editorProps: {
      attributes: {
        class: 'focus:outline-none min-h-[800px]',
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

  // Track text selection inside TipTap for Defined Terms
  useEffect(() => {
    if (!editor) return;

    const updateSelectedText = () => {
      const { from, to } = editor.state.selection;
      if (from === to) {
        setSelectedText('');
        return;
      }
      const text = editor.state.doc.textBetween(from, to, ' ');
      setSelectedText(text);
    };

    editor.on('selectionUpdate', updateSelectedText);

    // Initialize once
    updateSelectedText();

    return () => {
      editor.off('selectionUpdate', updateSelectedText);
    };
  }, [editor, setSelectedText]);

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
    
    // Generate a new blockId for this hierarchy block
    const blockId = crypto.randomUUID();
    (editor.chain().focus() as any).insertHierarchyBlock(blockId).run();
    setSlashMenuOpen(false);
  }, [editor]);

  // Register insert hierarchy handler
  useEffect(() => {
    setInsertHierarchyHandler(handleInsertHierarchy);
  }, [handleInsertHierarchy, setInsertHierarchyHandler]);

  return (
    <div
      className="flex flex-col h-full bg-muted/30 dark:bg-zinc-950 relative"
      onMouseDown={(e) => {
        if (!editor) return;
        const t = e.target as HTMLElement | null;

        // Let ProseMirror handle clicks inside the editor so caret placement and typing work normally.
        if (t?.closest('.ProseMirror')) return;

        // Don't steal focus when interacting with floating UI or hierarchy blocks (outlines).
        if (
          t?.closest('[data-floating-ui]') ||
          t?.closest('[data-radix-popper-content-wrapper]') ||
          t?.closest('[data-type="hierarchy-block"]')
        ) {
          return;
        }

        editor.chain().focus().run();
      }}
    >
      <div className="flex-1 overflow-auto">
        <PaginatedDocument>
          {editor ? (
            <EditorContent editor={editor} />
          ) : (
            <div className="min-h-[800px]" />
          )}
        </PaginatedDocument>
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
