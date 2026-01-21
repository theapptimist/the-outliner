import { useRef, useState, useEffect, forwardRef } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
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
  Check,
  X,
  Bug,
  Copy,
  LogOut,
  Cloud,
} from 'lucide-react';
import { getRecentCloudDocuments, CloudDocumentMetadata } from '@/lib/cloudDocumentStorage';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { AutoSaveIndicator } from './AutoSaveIndicator';

interface FileMenuProps {
  documentTitle: string;
  hasUnsavedChanges: boolean;
  isSaving?: boolean;
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onRename: (title: string) => void;
  onExport: () => void;
  onImport: () => void;
  onDelete: () => void;
  onOpenRecent: (id: string) => void;
  onSignOut?: () => void;
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

const MenuItem = forwardRef<HTMLButtonElement, MenuItemProps>(function MenuItem(
  { icon, label, shortcut, onClick, disabled, destructive },
  ref
) {
  return (
    <button
      ref={ref}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full flex items-center gap-2.5 px-2.5 py-2 text-xs rounded-md transition-colors text-left outline-none focus:outline-none focus-visible:outline-none",
        "hover:bg-muted/50 disabled:opacity-50 disabled:pointer-events-none",
        destructive && "text-destructive hover:bg-destructive/10"
      )}
    >
      <span className="h-4 w-4 flex-shrink-0">{icon}</span>
      <span className="flex-1">{label}</span>
      {shortcut && <span className="text-[10px] text-muted-foreground">{shortcut}</span>}
    </button>
  );
});

interface DiagnosticsData {
  note: string;
  recentDocsCount: number;
  recentDocs: { id: string; title: string }[];
}

function DiagnosticsPanel({ 
  onBack, 
  onCopy,
  getData,
}: { 
  onBack: () => void; 
  onCopy: () => void;
  getData: () => DiagnosticsData;
}) {
  const data = getData();
  
  return (
    <div className="p-3 text-xs">
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronRight className="h-4 w-4 rotate-180" />
          Back
        </button>
        <button
          onClick={onCopy}
          className="flex items-center gap-1 px-2 py-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
        >
          <Copy className="h-3 w-3" />
          Copy
        </button>
      </div>
      
      <div className="space-y-3">
        <div>
          <div className="font-medium text-muted-foreground mb-1 flex items-center gap-1.5">
            <Cloud className="h-3 w-3" />
            Cloud Storage
          </div>
          <div className="bg-muted/30 rounded p-2">
            <span className="text-muted-foreground">{data.note}</span>
          </div>
        </div>
        
        <div>
          <div className="font-medium text-muted-foreground mb-1">
            Recent Documents ({data.recentDocsCount})
          </div>
          <div className="bg-muted/30 rounded p-2 max-h-32 overflow-auto">
            {data.recentDocs.length === 0 ? (
              <span className="text-muted-foreground italic">No recent documents</span>
            ) : (
              data.recentDocs.map((doc, i) => (
                <div key={i} className="truncate">
                  • {doc.title} <span className="text-muted-foreground">({doc.id}...)</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function FileMenu({
  documentTitle,
  hasUnsavedChanges,
  isSaving = false,
  onNew,
  onOpen,
  onSave,
  onSaveAs,
  onRename,
  onExport,
  onImport,
  onDelete,
  onOpenRecent,
  onSignOut,
  hasDocument,
  iconOnly = false,
}: FileMenuProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [draftTitle, setDraftTitle] = useState(documentTitle);
  const [showRecent, setShowRecent] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [recentDocs, setRecentDocs] = useState<CloudDocumentMetadata[]>([]);

  // Sync draftTitle with documentTitle when prop changes (e.g., after save)
  useEffect(() => {
    if (!isRenaming) {
      setDraftTitle(documentTitle);
    }
  }, [documentTitle, isRenaming]);
  
  // Refresh recent docs list when sheet opens
  useEffect(() => {
    async function loadRecent() {
      if (sheetOpen) {
        try {
          const docs = await getRecentCloudDocuments();
          setRecentDocs(docs);
        } catch (e) {
          console.error('Failed to load recent docs:', e);
        }
      }
    }
    loadRecent();
  }, [sheetOpen]);

  // Focus the input when entering rename mode
  useEffect(() => {
    if (isRenaming) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [isRenaming]);

  // Reset rename state when sheet closes
  useEffect(() => {
    if (!sheetOpen) {
      setIsRenaming(false);
      setShowRecent(false);
      setShowDiagnostics(false);
    }
  }, [sheetOpen]);

  const getDiagnosticsData = () => {
    // Diagnostics now shows cloud storage info
    return {
      note: 'Documents are now stored in the cloud',
      recentDocsCount: recentDocs.length,
      recentDocs: recentDocs.map(d => ({ id: d.id.slice(0, 8), title: d.title })),
    };
  };

  const copyDiagnostics = () => {
    const data = getDiagnosticsData();
    const text = JSON.stringify(data, null, 2);
    navigator.clipboard.writeText(text);
    toast.success('Diagnostics copied to clipboard');
  };

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

  const startRenaming = () => {
    setDraftTitle(documentTitle);
    setIsRenaming(true);
  };

  const submitRename = () => {
    const trimmed = draftTitle.trim();
    if (trimmed && trimmed !== documentTitle) {
      onRename(trimmed);
    }
    setIsRenaming(false);
  };

  const cancelRename = () => {
    setDraftTitle(documentTitle);
    setIsRenaming(false);
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
        <SheetContent
          data-allow-pointer
          side="left"
          overlayClassName="bg-transparent"
          className="w-56 p-0 font-sans duration-0 data-[state=open]:animate-none data-[state=closed]:animate-none top-[72px] h-[calc(100%-72px)]"
          hideCloseButton
        >
          <SheetHeader 
            className="px-3 py-4 border-b border-border"
            onPointerDownCapture={(e) => {
              e.stopPropagation();
            }}
          >
            <SheetTitle asChild>
              {isRenaming ? (
                <div 
                  className="flex items-center gap-1"
                  onPointerDownCapture={(e) => e.stopPropagation()}
                >
                  <Input
                    ref={renameInputRef}
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') submitRename();
                      if (e.key === 'Escape') cancelRename();
                    }}
                    onBlur={submitRename}
                    className="h-6 text-xs px-1.5 py-0"
                  />
                  <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={submitRename}
                    className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted/50 text-primary"
                  >
                    <Check className="h-3 w-3" />
                  </button>
                  <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={cancelRename}
                    className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted/50 text-muted-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <button
                  onPointerDownCapture={(e) => e.stopPropagation()}
                  onClick={startRenaming}
                  className="text-xs font-medium flex items-center gap-1.5 hover:text-primary transition-colors cursor-pointer text-left"
                >
                  {documentTitle}
                  <Pencil className="h-2.5 w-2.5 opacity-50" />
                </button>
              )}
            </SheetTitle>
            {/* Auto-save indicator */}
            <AutoSaveIndicator 
              hasUnsavedChanges={hasUnsavedChanges} 
              isSaving={isSaving} 
              className="mt-1"
            />
          </SheetHeader>

          {showDiagnostics ? (
            <DiagnosticsPanel
              onBack={() => setShowDiagnostics(false)}
              onCopy={copyDiagnostics}
              getData={getDiagnosticsData}
            />
          ) : showRecent ? (
            <div className="p-3">
              <button
                onClick={() => setShowRecent(false)}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronRight className="h-4 w-4 rotate-180" />
                Back
              </button>
              <div className="h-px bg-border my-2" />
              {recentDocs.map((doc) => (
                <button
                  key={doc.id}
                  data-allow-pointer
                  onClick={() => {
                    onOpenRecent(doc.id);
                    setSheetOpen(false);
                    setShowRecent(false);
                  }}
                  className="w-full flex items-start gap-2.5 px-2.5 py-2 text-xs rounded-md transition-colors hover:bg-muted/50 text-left"
                >
                  <FileText className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="break-words">{doc.title}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {formatDistanceToNow(new Date(doc.updatedAt), { addSuffix: true })}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-3 space-y-0.5">
              <MenuItem
                icon={<FilePlus className="h-3.5 w-3.5" />}
                label="New"
                shortcut="⌘N"
                onClick={() => handleAction(onNew)}
              />
              <MenuItem
                icon={<FolderOpen className="h-3.5 w-3.5" />}
                label="Open..."
                shortcut="⌘O"
                onClick={() => handleAction(onOpen)}
              />
              {recentDocs.length > 0 && (
                <button
                  onClick={() => setShowRecent(true)}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs rounded-md transition-colors hover:bg-muted/50"
                >
                  <Clock className="h-4 w-4" />
                  <span className="flex-1">Open Recent</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              )}

              <div className="h-px bg-border my-3" />

              <MenuItem
                icon={<Save className="h-3.5 w-3.5" />}
                label="Save"
                shortcut="⌘S"
                onClick={() => handleAction(onSave)}
                disabled={!hasDocument}
              />
              <MenuItem
                icon={<Save className="h-3.5 w-3.5" />}
                label="Save As..."
                shortcut="⇧⌘S"
                onClick={() => handleAction(onSaveAs)}
              />
              <MenuItem
                icon={<Pencil className="h-3.5 w-3.5" />}
                label="Rename..."
                onClick={startRenaming}
              />

              <div className="h-px bg-border my-3" />

              <MenuItem
                icon={<FileDown className="h-3.5 w-3.5" />}
                label="Export..."
                onClick={() => handleAction(onExport)}
                disabled={!hasDocument}
              />
              <MenuItem
                icon={<FileUp className="h-3.5 w-3.5" />}
                label="Import..."
                onClick={handleImportClick}
              />

              <div className="h-px bg-border my-3" />

              <MenuItem
                icon={<Trash2 className="h-3.5 w-3.5" />}
                label="Delete Document"
                onClick={() => handleAction(onDelete)}
                disabled={!hasDocument}
                destructive
              />

              {onSignOut && (
                <>
                  <div className="h-px bg-border my-3" />
                  
                  <MenuItem
                    icon={<LogOut className="h-3.5 w-3.5" />}
                    label="Sign Out"
                    onClick={() => handleAction(onSignOut)}
                  />
                </>
              )}

              <div className="h-px bg-border my-3" />

              <div className="flex items-center gap-2 px-2.5 py-2 text-[10px] text-muted-foreground">
                <Cloud className="h-3 w-3" />
                <span>Cloud synced</span>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}