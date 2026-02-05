import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import { useState, useCallback, useEffect, useRef } from 'react';
import { SlashCommandMenu } from './SlashCommandMenu';
import { FindReplace } from './FindReplace';
import { HierarchyBlockExtension } from './extensions/HierarchyBlockExtension';
import { TermHighlightExtension, termHighlightPluginKey } from './extensions/TermHighlightPlugin';
import { DateHighlightExtension, dateHighlightPluginKey } from './extensions/DateHighlightPlugin';
import { PeopleHighlightExtension, peopleHighlightPluginKey } from './extensions/PeopleHighlightPlugin';
import { PlacesHighlightExtension, placesHighlightPluginKey } from './extensions/PlacesHighlightPlugin';
 import { EntityClickExtension } from './extensions/EntityClickExtension';
 import type { EntityClickStorage } from './extensions/EntityClickExtension';
import { PaginatedDocument } from './PageContainer';
import { useEditorContext, EntityType } from './EditorContext';

export function DocumentEditor() {
  const {
    document,
    documentVersion,
    setDocumentContent,
    setEditor,
    setInsertHierarchyHandler,
    setFindReplaceHandler,
    setSelectedText,
    showSlashPlaceholder,
    // Terms
    terms,
    highlightMode,
    highlightedTerm,
    // Dates
    dates,
    dateHighlightMode,
    highlightedDate,
    // People
    people,
    peopleHighlightMode,
    highlightedPerson,
    // Places
    places,
    placesHighlightMode,
    highlightedPlace,
    // Entity reveal
    revealEntityInLibrary,
  } = useEditorContext();
  
  // Use a ref to access the current value in the placeholder callback
  const showSlashPlaceholderRef = useRef(showSlashPlaceholder);
  showSlashPlaceholderRef.current = showSlashPlaceholder;
  
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashMenuPosition, setSlashMenuPosition] = useState({ top: 0, left: 0 });
  const [findReplaceOpen, setFindReplaceOpen] = useState(false);
  const [showReplace, setShowReplace] = useState(false);
  
  // Track initial content for this document version
  const initialContentRef = useRef(document?.content || null);
  const lastVersionRef = useRef(documentVersion);

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
          return showSlashPlaceholderRef.current ? "Type '/' for commands..." : '';
        },
      }),
      HierarchyBlockExtension,
      TermHighlightExtension,
      DateHighlightExtension,
      PeopleHighlightExtension,
      PlacesHighlightExtension,
       EntityClickExtension,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
    ],
    content: initialContentRef.current,
    onUpdate: ({ editor }) => {
      setDocumentContent(editor.getJSON());
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

  // Reload editor content when document changes (user opened a different document)
  useEffect(() => {
    if (!editor) return;
    if (documentVersion !== lastVersionRef.current) {
      lastVersionRef.current = documentVersion;
      initialContentRef.current = document?.content || null;
      editor.commands.setContent(document?.content || { type: 'doc', content: [{ type: 'paragraph' }] });
    }
  }, [editor, document, documentVersion]);

  // Force placeholder update when setting changes
  useEffect(() => {
    if (!editor) return;
    // Dispatch an empty transaction to trigger decoration recalculation
    editor.view.dispatch(editor.state.tr);
  }, [editor, showSlashPlaceholder]);

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

  // Update term highlights when terms, mode, or highlighted term changes
  useEffect(() => {
    if (!editor) return;
    
    const tr = editor.state.tr.setMeta(termHighlightPluginKey, {
      terms,
      highlightMode,
      highlightedTerm,
    });
    
    editor.view.dispatch(tr);
  }, [editor, terms, highlightMode, highlightedTerm]);

  // Update date highlights
  useEffect(() => {
    if (!editor) return;
    
    const tr = editor.state.tr.setMeta(dateHighlightPluginKey, {
      dates,
      highlightMode: dateHighlightMode,
      highlightedDate,
    });
    
    editor.view.dispatch(tr);
  }, [editor, dates, dateHighlightMode, highlightedDate]);

  // Update people highlights
  useEffect(() => {
    if (!editor) return;
    
    const tr = editor.state.tr.setMeta(peopleHighlightPluginKey, {
      people,
      highlightMode: peopleHighlightMode,
      highlightedPerson,
    });
    
    editor.view.dispatch(tr);
  }, [editor, people, peopleHighlightMode, highlightedPerson]);

  // Update places highlights
  useEffect(() => {
    if (!editor) return;
    
    const tr = editor.state.tr.setMeta(placesHighlightPluginKey, {
      places,
      highlightMode: placesHighlightMode,
      highlightedPlace,
    });
    
    editor.view.dispatch(tr);
  }, [editor, places, placesHighlightMode, highlightedPlace]);

   // Set up entity click handler
   useEffect(() => {
     if (!editor) return;
     // eslint-disable-next-line @typescript-eslint/no-explicit-any
     const storage = (editor.storage as any).entityClick as EntityClickStorage;
     storage.onEntityClick = (type, text) => {
       revealEntityInLibrary(type, text);
     };
   }, [editor, revealEntityInLibrary]);
 
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
