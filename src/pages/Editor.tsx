import { DocumentEditor } from '@/components/editor/DocumentEditor';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Editor() {
  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <h1 className="text-lg font-semibold text-foreground">Document Editor</h1>
        <div className="flex items-center gap-4">
          <p className="text-sm text-muted-foreground">Type "/" for commands</p>
          <Button variant="outline" size="sm" asChild>
            <Link to="/hierarchy" className="flex items-center gap-1.5">
              Hierarchy Editor
              <ArrowRight size={14} />
            </Link>
          </Button>
        </div>
      </header>
      <main className="flex-1 overflow-hidden">
        <DocumentEditor />
      </main>
    </div>
  );
}
