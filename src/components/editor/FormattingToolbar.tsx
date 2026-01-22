import { Editor } from '@tiptap/react';
import { 
  Bold, 
  Italic, 
  Underline,
  Strikethrough, 
  Code, 
  Heading1, 
  Heading2, 
  Heading3, 
  List, 
  ListOrdered, 
  Quote, 
  Minus,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
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
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
          isActive={editor?.isActive('underline')}
          disabled={!editor}
          icon={<Underline className="h-4 w-4" />}
          label="Underline"
          tooltip="Underline (Ctrl+U)"
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

      {/* Alignment - horizontal row */}
      {!collapsed && (
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">
          Alignment
        </span>
      )}
      <div className={cn("flex gap-1 flex-wrap", collapsed && "flex-col items-center")}>
        <ToolButton
          onClick={() => editor?.chain().focus().setTextAlign('left').run()}
          isActive={editor?.isActive({ textAlign: 'left' })}
          disabled={!editor}
          icon={<AlignLeft className="h-4 w-4" />}
          label="Left"
          tooltip="Align Left"
          collapsed={true}
        />
        <ToolButton
          onClick={() => editor?.chain().focus().setTextAlign('center').run()}
          isActive={editor?.isActive({ textAlign: 'center' })}
          disabled={!editor}
          icon={<AlignCenter className="h-4 w-4" />}
          label="Center"
          tooltip="Align Center"
          collapsed={true}
        />
        <ToolButton
          onClick={() => editor?.chain().focus().setTextAlign('right').run()}
          isActive={editor?.isActive({ textAlign: 'right' })}
          disabled={!editor}
          icon={<AlignRight className="h-4 w-4" />}
          label="Right"
          tooltip="Align Right"
          collapsed={true}
        />
        <ToolButton
          onClick={() => editor?.chain().focus().setTextAlign('justify').run()}
          isActive={editor?.isActive({ textAlign: 'justify' })}
          disabled={!editor}
          icon={<AlignJustify className="h-4 w-4" />}
          label="Justify"
          tooltip="Justify"
          collapsed={true}
        />
      </div>

      <Separator className="my-2" />

      {/* Headings - horizontal row */}
      {!collapsed && (
        <span className="text-[10px] font-medium text-accent uppercase tracking-wider px-1">
          Headings
        </span>
      )}
      <div className={cn("flex gap-1 flex-wrap", collapsed && "flex-col items-center")}>
        <ToolButton
          onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
          isActive={editor?.isActive('heading', { level: 1 })}
          disabled={!editor}
          icon={<Heading1 className="h-4 w-4" />}
          label="H1"
          tooltip="Heading 1"
          collapsed={true}
          color="accent"
        />
        <ToolButton
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor?.isActive('heading', { level: 2 })}
          disabled={!editor}
          icon={<Heading2 className="h-4 w-4" />}
          label="H2"
          tooltip="Heading 2"
          collapsed={true}
          color="accent"
        />
        <ToolButton
          onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
          isActive={editor?.isActive('heading', { level: 3 })}
          disabled={!editor}
          icon={<Heading3 className="h-4 w-4" />}
          label="H3"
          tooltip="Heading 3"
          collapsed={true}
          color="accent"
        />
      </div>

      <Separator className="my-2" />

      {/* Lists & Blocks - 2x2 grid */}
      {!collapsed && (
        <span className="text-[10px] font-medium text-success uppercase tracking-wider px-1">
          Blocks
        </span>
      )}
      <div className={cn("grid grid-cols-2 gap-1", collapsed && "grid-cols-1")}>
        <ToolButton
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          isActive={editor?.isActive('bulletList')}
          disabled={!editor}
          icon={<List className="h-4 w-4" />}
          label="Bullets"
          tooltip="Bullet List"
          collapsed={true}
          color="success"
        />
        <ToolButton
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          isActive={editor?.isActive('orderedList')}
          disabled={!editor}
          icon={<ListOrdered className="h-4 w-4" />}
          label="Numbers"
          tooltip="Numbered List"
          collapsed={true}
          color="success"
        />
        <ToolButton
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
          isActive={editor?.isActive('blockquote')}
          disabled={!editor}
          icon={<Quote className="h-4 w-4" />}
          label="Quote"
          tooltip="Block Quote"
          collapsed={true}
          color="success"
        />
        <ToolButton
          onClick={() => editor?.chain().focus().setHorizontalRule().run()}
          disabled={!editor}
          icon={<Minus className="h-4 w-4" />}
          label="Divider"
          tooltip="Horizontal Rule"
          collapsed={true}
          color="success"
        />
      </div>
    </>
  );
}
