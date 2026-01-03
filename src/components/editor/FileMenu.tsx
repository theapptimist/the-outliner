import { useRef, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
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
  ChevronRight,
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

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}

function MenuItem({ icon, label, shortcut, onClick, disabled, destructive }: MenuItemProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors text-left",
        "hover:bg-muted/50 disabled:opacity-50 disabled:pointer-events-none",
        destructive && "text-destructive hover:bg-destructive/10"
      )}
    >
      <span className="h-4 w-4 flex-shrink-0">{icon}</span>
      <span className="flex-1">{label}</span>
      {shortcut && <span className="text-xs text-muted-foreground">{shortcut}</span>}
    </button>
  );
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
  const [sheetOpen, setSheetOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [newTitle, setNewTitle] = useState(documentTitle);
  const [showRecent, setShowRecent] = useState(false);
  const recentDocs = getRecentDocuments();

  const handleImportClick = () => {
    fileInputRef.current?.click();
    setSheetOpen(false);
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
    setSheetOpen(false);
  };

  const handleAction = (action: () => void) => {
    action();
    setSheetOpen(false);
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

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetTrigger asChild>
          <button
            data-allow-pointer
            className={cn(
              "h-7 w-7 rounded-md flex items-center justify-center transition-colors",
              sheetOpen
                ? "bg-primary/15 text-primary"
                : "hover:bg-muted/50 text-muted-foreground",
              hasUnsavedChanges && !sheetOpen && "text-warning"
            )}
          >
            <FileText className="h-4 w-4" />
          </button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="px-4 py-3 border-b border-border">
            <SheetTitle className="text-sm font-medium flex items-center gap-1">
              {documentTitle}
              {hasUnsavedChanges && <span className="text-warning">•</span>}
            </SheetTitle>
          </SheetHeader>

          {!showRecent ? (
            <div className="p-2 space-y-1">
              <MenuItem
                icon={<FilePlus className="h-4 w-4" />}
                label="New"
                shortcut="⌘N"
                onClick={() => handleAction(onNew)}
              />
              <MenuItem
                icon={<FolderOpen className="h-4 w-4" />}
                label="Open..."
                shortcut="⌘O"
                onClick={() => handleAction(onOpen)}
              />
              {recentDocs.length > 0 && (
                <button
                  onClick={() => setShowRecent(true)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors hover:bg-muted/50"
                >
                  <Clock className="h-4 w-4" />
                  <span className="flex-1">Open Recent</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              )}

              <div className="h-px bg-border my-2" />

              <MenuItem
                icon={<Save className="h-4 w-4" />}
                label="Save"
                shortcut="⌘S"
                onClick={() => handleAction(onSave)}
                disabled={!hasDocument}
              />
              <MenuItem
                icon={<Save className="h-4 w-4" />}
                label="Save As..."
                shortcut="⇧⌘S"
                onClick={() => handleAction(onSaveAs)}
              />
              <MenuItem
                icon={<Pencil className="h-4 w-4" />}
                label="Rename..."
                onClick={openRenameDialog}
              />

              <div className="h-px bg-border my-2" />

              <MenuItem
                icon={<FileDown className="h-4 w-4" />}
                label="Export..."
                onClick={() => handleAction(onExport)}
                disabled={!hasDocument}
              />
              <MenuItem
                icon={<FileUp className="h-4 w-4" />}
                label="Import..."
                onClick={handleImportClick}
              />

              <div className="h-px bg-border my-2" />

              <MenuItem
                icon={<Trash2 className="h-4 w-4" />}
                label="Delete Document"
                onClick={() => handleAction(onDelete)}
                disabled={!hasDocument}
                destructive
              />
            </div>
          ) : (
            <div className="p-2">
              <button
                onClick={() => setShowRecent(false)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronRight className="h-4 w-4 rotate-180" />
                Back
              </button>
              <div className="h-px bg-border my-2" />
              {recentDocs.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => {
                    onOpenRecent(doc.id);
                    setSheetOpen(false);
                    setShowRecent(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors hover:bg-muted/50 text-left"
                >
                  <FileText className="h-4 w-4 flex-shrink-0" />
                  <span className="flex-1 truncate">{doc.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(doc.updatedAt), { addSuffix: true })}
                  </span>
                </button>
              ))}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}