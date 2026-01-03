import { Editor } from '@tiptap/react';
import { 
  Bold, 
  Italic, 
  Strikethrough, 
  Code, 
  Heading1, 
  Heading2, 
  Heading3, 
  List, 
  ListOrdered, 
  Quote, 
  Minus 
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { ToolButton } from './ToolButton';
import { cn } from '@/lib/utils';

interface FormattingToolbarProps {
  editor: Editor | null;
  collapsed: boolean;
}

export function FormattingToolbar({ editor, collapsed }: FormattingToolbarProps) {
  return (
    <>
      {/* Text Formatting */}
      {!collapsed && (
        <span className="text-[10px] font-medium text-primary uppercase tracking-wider px-1">
          Format
        </span>
      )}
      <div className={cn("space-y-1", collapsed && "flex flex-col items-center")}>
        <ToolButton
          onClick={() => editor?.chain().focus().toggleBold().run()}
          isActive={editor?.isActive('bold')}
          disabled={!editor}
          icon={<Bold className="h-4 w-4" />}
          label="Bold"
          tooltip="Bold (Ctrl+B)"
          collapsed={collapsed}
        />
        <ToolButton
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          isActive={editor?.isActive('italic')}
          disabled={!editor}
          icon={<Italic className="h-4 w-4" />}
          label="Italic"
          tooltip="Italic (Ctrl+I)"
          collapsed={collapsed}
        />
        <ToolButton
          onClick={() => editor?.chain().focus().toggleStrike().run()}
          isActive={editor?.isActive('strike')}
          disabled={!editor}
          icon={<Strikethrough className="h-4 w-4" />}
          label="Strikethrough"
          tooltip="Strikethrough"
          collapsed={collapsed}
        />
        <ToolButton
          onClick={() => editor?.chain().focus().toggleCode().run()}
          isActive={editor?.isActive('code')}
          disabled={!editor}
          icon={<Code className="h-4 w-4" />}
          label="Code"
          tooltip="Inline Code"
          collapsed={collapsed}
        />
      </div>

      <Separator className="my-2" />

      {/* Headings */}
      {!collapsed && (
        <span className="text-[10px] font-medium text-accent uppercase tracking-wider px-1">
          Headings
        </span>
      )}
      <div className={cn("space-y-1", collapsed && "flex flex-col items-center")}>
        <ToolButton
          onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
          isActive={editor?.isActive('heading', { level: 1 })}
          disabled={!editor}
          icon={<Heading1 className="h-4 w-4" />}
          label="Heading 1"
          tooltip="Heading 1"
          collapsed={collapsed}
          color="accent"
        />
        <ToolButton
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor?.isActive('heading', { level: 2 })}
          disabled={!editor}
          icon={<Heading2 className="h-4 w-4" />}
          label="Heading 2"
          tooltip="Heading 2"
          collapsed={collapsed}
          color="accent"
        />
        <ToolButton
          onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
          isActive={editor?.isActive('heading', { level: 3 })}
          disabled={!editor}
          icon={<Heading3 className="h-4 w-4" />}
          label="Heading 3"
          tooltip="Heading 3"
          collapsed={collapsed}
          color="accent"
        />
      </div>

      <Separator className="my-2" />

      {/* Lists & Blocks */}
      {!collapsed && (
        <span className="text-[10px] font-medium text-success uppercase tracking-wider px-1">
          Blocks
        </span>
      )}
      <div className={cn("space-y-1", collapsed && "flex flex-col items-center")}>
        <ToolButton
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          isActive={editor?.isActive('bulletList')}
          disabled={!editor}
          icon={<List className="h-4 w-4" />}
          label="Bullet List"
          tooltip="Bullet List"
          collapsed={collapsed}
          color="success"
        />
        <ToolButton
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          isActive={editor?.isActive('orderedList')}
          disabled={!editor}
          icon={<ListOrdered className="h-4 w-4" />}
          label="Numbered List"
          tooltip="Numbered List"
          collapsed={collapsed}
          color="success"
        />
        <ToolButton
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
          isActive={editor?.isActive('blockquote')}
          disabled={!editor}
          icon={<Quote className="h-4 w-4" />}
          label="Quote"
          tooltip="Block Quote"
          collapsed={collapsed}
          color="success"
        />
        <ToolButton
          onClick={() => editor?.chain().focus().setHorizontalRule().run()}
          disabled={!editor}
          icon={<Minus className="h-4 w-4" />}
          label="Divider"
          tooltip="Horizontal Rule"
          collapsed={collapsed}
          color="success"
        />
      </div>
    </>
  );
}
