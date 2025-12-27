import { useState, useEffect, useCallback } from 'react';
import { 
  Heading1, 
  Heading2, 
  Heading3, 
  List, 
  ListOrdered, 
  Quote, 
  Code, 
  Minus,
  GitBranch,
  Type,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SlashCommandMenuProps {
  editor: any;
  isOpen: boolean;
  position: { top: number; left: number };
  onClose: () => void;
  onInsertHierarchy: () => void;
}

interface CommandItem {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  action: () => void;
}

export function SlashCommandMenu({ 
  editor, 
  isOpen, 
  position, 
  onClose,
  onInsertHierarchy,
}: SlashCommandMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  const commands: CommandItem[] = [
    {
      id: 'paragraph',
      label: 'Text',
      description: 'Plain text paragraph',
      icon: <Type className="h-4 w-4" />,
      action: () => editor.chain().focus().setParagraph().run(),
    },
    {
      id: 'h1',
      label: 'Heading 1',
      description: 'Large section heading',
      icon: <Heading1 className="h-4 w-4" />,
      action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
    },
    {
      id: 'h2',
      label: 'Heading 2',
      description: 'Medium section heading',
      icon: <Heading2 className="h-4 w-4" />,
      action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      id: 'h3',
      label: 'Heading 3',
      description: 'Small section heading',
      icon: <Heading3 className="h-4 w-4" />,
      action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    {
      id: 'bulletList',
      label: 'Bullet List',
      description: 'Create a bulleted list',
      icon: <List className="h-4 w-4" />,
      action: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      id: 'orderedList',
      label: 'Numbered List',
      description: 'Create a numbered list',
      icon: <ListOrdered className="h-4 w-4" />,
      action: () => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      id: 'quote',
      label: 'Quote',
      description: 'Add a blockquote',
      icon: <Quote className="h-4 w-4" />,
      action: () => editor.chain().focus().toggleBlockquote().run(),
    },
    {
      id: 'code',
      label: 'Code Block',
      description: 'Add a code block',
      icon: <Code className="h-4 w-4" />,
      action: () => editor.chain().focus().toggleCodeBlock().run(),
    },
    {
      id: 'divider',
      label: 'Divider',
      description: 'Horizontal line separator',
      icon: <Minus className="h-4 w-4" />,
      action: () => editor.chain().focus().setHorizontalRule().run(),
    },
    {
      id: 'outline',
      label: 'Outline',
      description: 'Insert an interactive outline',
      icon: <GitBranch className="h-4 w-4" />,
      action: onInsertHierarchy,
    },
  ];

  const filteredCommands = commands.filter(cmd =>
    cmd.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cmd.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    setSelectedIndex(0);
    setSearchQuery('');
  }, [isOpen]);

  const executeCommand = useCallback((command: CommandItem) => {
    command.action();
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(i => (i + 1) % filteredCommands.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(i => (i - 1 + filteredCommands.length) % filteredCommands.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          executeCommand(filteredCommands[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Backspace' && searchQuery === '') {
        onClose();
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        setSearchQuery(q => q + e.key);
      } else if (e.key === 'Backspace') {
        setSearchQuery(q => q.slice(0, -1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, filteredCommands, searchQuery, onClose, executeCommand]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed z-50 w-72 bg-popover border border-border rounded-lg shadow-lg overflow-hidden"
      style={{ top: position.top, left: position.left }}
    >
      {searchQuery && (
        <div className="px-3 py-2 border-b border-border text-sm text-muted-foreground">
          Searching: {searchQuery}
        </div>
      )}
      <div className="max-h-80 overflow-auto">
        {filteredCommands.length === 0 ? (
          <div className="px-3 py-4 text-sm text-muted-foreground text-center">
            No commands found
          </div>
        ) : (
          filteredCommands.map((cmd, index) => (
            <button
              key={cmd.id}
              onClick={() => executeCommand(cmd)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 text-left transition-colors',
                index === selectedIndex ? 'bg-secondary' : 'hover:bg-secondary/50'
              )}
            >
              <div className="flex-shrink-0 w-8 h-8 rounded bg-muted flex items-center justify-center text-muted-foreground">
                {cmd.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground">{cmd.label}</div>
                <div className="text-xs text-muted-foreground truncate">{cmd.description}</div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
