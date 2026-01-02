import { useRef } from 'react';
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from '@/components/ui/menubar';
import {
  FilePlus,
  FolderOpen,
  Save,
  FileDown,
  FileUp,
  Trash2,
  Clock,
  FileText,
} from 'lucide-react';
import { DocumentMetadata, getRecentDocuments } from '@/lib/documentStorage';
import { formatDistanceToNow } from 'date-fns';

interface FileMenuProps {
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onExport: () => void;
  onImport: () => void;
  onDelete: () => void;
  onOpenRecent: (id: string) => void;
  hasDocument: boolean;
  iconOnly?: boolean;
}

export function FileMenu({
  onNew,
  onOpen,
  onSave,
  onSaveAs,
  onExport,
  onImport,
  onDelete,
  onOpenRecent,
  hasDocument,
  iconOnly = false,
}: FileMenuProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".json"
        onChange={handleFileChange}
      />
      <Menubar className="border-none bg-transparent h-auto p-0">
        <MenubarMenu>
          <MenubarTrigger className={iconOnly 
            ? "h-7 w-7 p-0 rounded-md flex items-center justify-center hover:bg-muted/50 text-muted-foreground cursor-pointer" 
            : "font-medium px-3 py-1.5 cursor-pointer"
          }>
            {iconOnly ? <FileText className="h-4 w-4" /> : "File"}
          </MenubarTrigger>
          <MenubarContent>
            <MenubarItem onClick={onNew}>
              <FilePlus className="mr-2 h-4 w-4" />
              New
              <MenubarShortcut>⌘N</MenubarShortcut>
            </MenubarItem>
            
            <MenubarItem onClick={onOpen}>
              <FolderOpen className="mr-2 h-4 w-4" />
              Open...
              <MenubarShortcut>⌘O</MenubarShortcut>
            </MenubarItem>

            {recentDocs.length > 0 && (
              <MenubarSub>
                <MenubarSubTrigger>
                  <Clock className="mr-2 h-4 w-4" />
                  Open Recent
                </MenubarSubTrigger>
                <MenubarSubContent>
                  {recentDocs.map((doc) => (
                    <MenubarItem key={doc.id} onClick={() => onOpenRecent(doc.id)}>
                      <FileText className="mr-2 h-4 w-4" />
                      <span className="flex-1 truncate max-w-[200px]">{doc.title}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(doc.updatedAt), { addSuffix: true })}
                      </span>
                    </MenubarItem>
                  ))}
                </MenubarSubContent>
              </MenubarSub>
            )}

            <MenubarSeparator />

            <MenubarItem onClick={onSave} disabled={!hasDocument}>
              <Save className="mr-2 h-4 w-4" />
              Save
              <MenubarShortcut>⌘S</MenubarShortcut>
            </MenubarItem>

            <MenubarItem onClick={onSaveAs}>
              <Save className="mr-2 h-4 w-4" />
              Save As...
              <MenubarShortcut>⇧⌘S</MenubarShortcut>
            </MenubarItem>

            <MenubarSeparator />

            <MenubarItem onClick={onExport} disabled={!hasDocument}>
              <FileDown className="mr-2 h-4 w-4" />
              Export...
            </MenubarItem>

            <MenubarItem onClick={handleImportClick}>
              <FileUp className="mr-2 h-4 w-4" />
              Import...
            </MenubarItem>

            <MenubarSeparator />

            <MenubarItem onClick={onDelete} disabled={!hasDocument} className="text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Document
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    </>
  );
}
