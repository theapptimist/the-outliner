import { useState, useRef, useEffect } from 'react';

interface TableOfContentsProps {
  sections: Array<{ id: string; label: string }>;
  onNavigate: (sectionId: string) => void;
  documentTitle?: string;
  onTitleChange?: (newTitle: string) => void;
}

export function TableOfContents({ sections, onNavigate, documentTitle, onTitleChange }: TableOfContentsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(documentTitle || '');
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync draft when documentTitle changes externally
  useEffect(() => {
    if (!isEditing) {
      setDraftTitle(documentTitle || '');
    }
  }, [documentTitle, isEditing]);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleTitleClick = () => {
    if (onTitleChange) {
      setIsEditing(true);
    }
  };

  const handleTitleBlur = () => {
    setIsEditing(false);
    if (draftTitle.trim() && draftTitle !== documentTitle) {
      onTitleChange?.(draftTitle.trim());
    } else {
      setDraftTitle(documentTitle || '');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      inputRef.current?.blur();
    } else if (e.key === 'Escape') {
      setDraftTitle(documentTitle || '');
      setIsEditing(false);
    }
  };

  if (sections.length === 0) return null;
  
  return (
    <div className="border-b border-foreground/10 pb-4 mb-4">
      {/* Document Title - Centered & Editable */}
      {(documentTitle || onTitleChange) && (
        <div className="mb-4 text-center">
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={handleKeyDown}
              className="text-xl font-bold text-center bg-transparent border-b-2 border-primary outline-none w-full max-w-md mx-auto"
              placeholder="Document Title..."
            />
          ) : (
            <h1 
              onClick={handleTitleClick}
              className={`text-xl font-bold ${onTitleChange ? 'cursor-pointer hover:text-primary transition-colors' : ''}`}
              title={onTitleChange ? 'Click to edit title' : undefined}
            >
              {documentTitle || 'Untitled'}
            </h1>
          )}
        </div>
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
