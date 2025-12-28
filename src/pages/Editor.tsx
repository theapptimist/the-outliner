import { DocumentEditor } from '@/components/editor/DocumentEditor';

export default function Editor() {
  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <h1 className="text-lg font-semibold text-foreground">Document Editor</h1>
        <p className="text-sm text-muted-foreground">Type "/" for commands</p>
      </header>
      <main className="flex-1 overflow-hidden">
        <DocumentEditor />
      </main>
    </div>
  );
}
