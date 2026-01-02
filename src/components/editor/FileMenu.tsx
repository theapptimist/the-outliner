import { useRef, useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  DropdownMenuShortcut,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  FilePlus,
  FolderOpen,
  Save,
  FileDown,
  FileUp,
  Trash2,
  Clock,
  FileText,
  Pencil,
} from 'lucide-react';
import { getRecentDocuments } from '@/lib/documentStorage';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface FileMenuProps {
  documentTitle: string;
  hasUnsavedChanges: boolean;
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onRename: (title: string) => void;
  onExport: () => void;
  onImport: () => void;
  onDelete: () => void;
  onOpenRecent: (id: string) => void;
  hasDocument: boolean;
  iconOnly?: boolean;
}

export function FileMenu({
  documentTitle,
  hasUnsavedChanges,
  onNew,
  onOpen,
  onSave,
  onSaveAs,
  onRename,
  onExport,
  onImport,
  onDelete,
  onOpenRecent,
  hasDocument,
  iconOnly = false,
}: FileMenuProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [newTitle, setNewTitle] = useState(documentTitle);
  const recentDocs = getRecentDocuments();

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      onImport();
    }
    e.target.value = '';
  };

  const handleRenameSubmit = () => {
    if (newTitle.trim()) {
      onRename(newTitle.trim());
    }
    setRenameOpen(false);
  };

  const openRenameDialog = () => {
    setNewTitle(documentTitle);
    setRenameOpen(true);
  };

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".json"
        onChange={handleFileChange}
      />
      
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Rename Document</DialogTitle>
          </DialogHeader>
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Document title"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRenameSubmit();
            }}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>Cancel</Button>
            <Button onClick={handleRenameSubmit}>Rename</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            data-allow-pointer
            className={cn(
              "h-7 w-7 p-0 rounded-md flex items-center justify-center hover:bg-muted/50 text-muted-foreground cursor-pointer transition-colors",
              hasUnsavedChanges && "text-warning"
            )}
          >
            <FileText className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {/* Document title header */}
          <div className="px-2 py-1.5 border-b border-border mb-1">
            <p className="text-sm font-medium truncate flex items-center gap-1">
              {documentTitle}
              {hasUnsavedChanges && <span className="text-warning">•</span>}
            </p>
          </div>

          <DropdownMenuItem onClick={onNew}>
            <FilePlus className="mr-2 h-4 w-4" />
            New
            <DropdownMenuShortcut>⌘N</DropdownMenuShortcut>
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={onOpen}>
            <FolderOpen className="mr-2 h-4 w-4" />
            Open...
            <DropdownMenuShortcut>⌘O</DropdownMenuShortcut>
          </DropdownMenuItem>

          {recentDocs.length > 0 && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Clock className="mr-2 h-4 w-4" />
                Open Recent
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {recentDocs.map((doc) => (
                  <DropdownMenuItem key={doc.id} onClick={() => onOpenRecent(doc.id)}>
                    <FileText className="mr-2 h-4 w-4" />
                    <span className="flex-1 truncate max-w-[200px]">{doc.title}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(doc.updatedAt), { addSuffix: true })}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={onSave} disabled={!hasDocument}>
            <Save className="mr-2 h-4 w-4" />
            Save
            <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={onSaveAs}>
            <Save className="mr-2 h-4 w-4" />
            Save As...
            <DropdownMenuShortcut>⇧⌘S</DropdownMenuShortcut>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={openRenameDialog}>
            <Pencil className="mr-2 h-4 w-4" />
            Rename...
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={onExport} disabled={!hasDocument}>
            <FileDown className="mr-2 h-4 w-4" />
            Export...
          </DropdownMenuItem>

          <DropdownMenuItem onClick={handleImportClick}>
            <FileUp className="mr-2 h-4 w-4" />
            Import...
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={onDelete} disabled={!hasDocument} className="text-destructive">
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Document
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
