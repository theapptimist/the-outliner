import { useState, useEffect, forwardRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, FileText, Search, Loader2, AlertTriangle } from 'lucide-react';
import { CloudDocumentMetadata, listCloudDocuments, deleteCloudDocument, bulkDeleteByTitle } from '@/lib/cloudDocumentStorage';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface OpenDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (id: string) => void;
  currentDocId?: string;
}

export const OpenDocumentDialog = forwardRef<HTMLDivElement, OpenDocumentDialogProps>(function OpenDocumentDialog({
  open,
  onOpenChange,
  onSelect,
  currentDocId,
}, ref) {
  const [documents, setDocuments] = useState<CloudDocumentMetadata[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [cleaningUp, setCleaningUp] = useState(false);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const docs = await listCloudDocuments();
      setDocuments(docs);
    } catch (e) {
      console.error('Failed to list documents:', e);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (open) {
      loadDocuments();
      setSearch('');
    }
  }, [open]);

  const filtered = documents.filter(d =>
    d.title.toLowerCase().includes(search.toLowerCase())
  );

  const untitledCount = documents.filter(d => d.title === 'Untitled').length;

  const handleCleanupUntitled = async () => {
    setCleaningUp(true);
    try {
      const deleted = await bulkDeleteByTitle('Untitled');
      toast.success(`Deleted ${deleted} Untitled document${deleted !== 1 ? 's' : ''}`);
      await loadDocuments();
    } catch (e) {
      toast.error('Failed to delete documents');
    }
    setCleaningUp(false);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this document permanently?')) {
      setDeletingId(id);
      try {
        await deleteCloudDocument(id);
        const docs = await listCloudDocuments();
        setDocuments(docs);
      } catch (e) {
        console.error('Failed to delete document:', e);
      }
      setDeletingId(null);
    }
  };

  const handleSelect = (id: string) => {
    onSelect(id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Open Document</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Cleanup button for Untitled documents */}
        {untitledCount > 1 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-destructive border-destructive/50 hover:bg-destructive/10"
                disabled={cleaningUp}
              >
                {cleaningUp ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <AlertTriangle className="h-4 w-4 mr-2" />
                )}
                Delete {untitledCount} "Untitled" documents
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete all Untitled documents?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete {untitledCount} documents with the title "Untitled".
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleCleanupUntitled}>
                  Delete All
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        <ScrollArea className="h-[300px] -mx-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              {documents.length === 0 ? 'No saved documents' : 'No matching documents'}
            </div>
          ) : (
            <div className="space-y-1 px-2">
              {filtered.map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => handleSelect(doc.id)}
                  className={`flex items-center gap-3 p-3 rounded-md cursor-pointer hover:bg-accent group ${
                    doc.id === currentDocId ? 'bg-accent' : ''
                  }`}
                >
                  <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{doc.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(doc.updatedAt), { addSuffix: true })}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 shrink-0"
                    onClick={(e) => handleDelete(doc.id, e)}
                    disabled={deletingId === doc.id}
                  >
                    {deletingId === doc.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 text-destructive" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
});
