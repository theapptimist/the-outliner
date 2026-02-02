interface TableOfContentsProps {
  sections: Array<{ id: string; label: string }>;
  onNavigate: (sectionId: string) => void;
  documentTitle?: string;
}

export function TableOfContents({ sections, onNavigate, documentTitle }: TableOfContentsProps) {
  if (sections.length === 0) return null;
  
  return (
    <div className="border-b border-foreground/10 pb-4 mb-4">
      {/* Document Title - Centered */}
      {documentTitle && (
        <h1 className="text-xl font-bold text-center mb-4">{documentTitle}</h1>
      )}
      
      <div className="text-sm font-semibold text-muted-foreground mb-2">Table of Contents</div>
      <ul className="space-y-1">
        {sections.map((section, index) => (
          <li key={section.id}>
            <button
              onClick={() => onNavigate(section.id)}
              className="text-sm text-primary hover:underline text-left truncate max-w-full"
            >
              {index + 1}. {section.label || '(Untitled)'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
