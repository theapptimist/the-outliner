interface TableOfContentsProps {
  sections: Array<{ id: string; label: string }>;
  onNavigate: (sectionId: string) => void;
}

export function TableOfContents({ sections, onNavigate }: TableOfContentsProps) {
  if (sections.length === 0) return null;
  
  return (
    <div className="border-b border-foreground/10 pb-3 mb-3">
      <div className="text-xs font-medium text-muted-foreground mb-2">Contents</div>
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
