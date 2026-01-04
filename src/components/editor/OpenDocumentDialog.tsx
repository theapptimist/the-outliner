import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, FileText, Search, Loader2 } from 'lucide-react';
import { CloudDocumentMetadata, listCloudDocuments, deleteCloudDocument } from '@/lib/cloudDocumentStorage';
import { formatDistanceToNow } from 'date-fns';

interface OpenDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (id: string) => void;
  currentDocId?: string;
}

export function OpenDocumentDialog({
  open,
  onOpenChange,
  onSelect,
  currentDocId,
}: OpenDocumentDialogProps) {
  const [documents, setDocuments] = useState<CloudDocumentMetadata[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (open) {
        setLoading(true);
        try {
          const docs = await listCloudDocuments();
          setDocuments(docs);
        } catch (e) {
          console.error('Failed to list documents:', e);
        }
        setLoading(false);
        setSearch('');
      }
    }
    load();
  }, [open]);

  const filtered = documents.filter(d =>
    d.title.toLowerCase().includes(search.toLowerCase())
  );

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
}
