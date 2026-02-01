import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Loader2 } from 'lucide-react';
import { listCloudDocuments, CloudDocumentMetadata } from '@/lib/cloudDocumentStorage';
import { cn } from '@/lib/utils';

interface LinkDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (id: string, title: string) => void;
  currentDocId?: string;
}

export function LinkDocumentDialog({ open, onOpenChange, onSelect, currentDocId }: LinkDocumentDialogProps) {
  const [documents, setDocuments] = useState<CloudDocumentMetadata[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

    useEffect(() => {
      if (open) {
        setLoading(true);
        listCloudDocuments()
          .then(setDocuments)
          .finally(() => setLoading(false));
      }
    }, [open]);

    // Filter out current document and apply search
    const filtered = documents
      .filter(doc => doc.id !== currentDocId)
      .filter(doc =>
        doc.title.toLowerCase().includes(search.toLowerCase())
      );

    const handleSelect = (doc: CloudDocumentMetadata) => {
      onSelect(doc.id, doc.title);
      onOpenChange(false);
    };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Link document</DialogTitle>
          <DialogDescription>
            Select a document to create a link to
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Input
            placeholder="Search documents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />

          <ScrollArea className="h-64">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                <FileText className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">
                  {search ? 'No matching documents' : 'No other documents available'}
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {filtered.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => handleSelect(doc)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 rounded-md text-left',
                      'hover:bg-accent transition-colors'
                    )}
                  >
                    <FileText className="h-4 w-4 text-primary shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{doc.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(doc.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
