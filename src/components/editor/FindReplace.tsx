import { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Replace, X, ChevronUp, ChevronDown, CaseSensitive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Toggle } from '@/components/ui/toggle';
import { Editor } from '@tiptap/react';
import { FindReplaceMatch, useEditorContext } from './EditorContext';

interface FindReplaceProps {
  editor: Editor | null;
  isOpen: boolean;
  onClose: () => void;
  showReplace?: boolean;
}

function isTipTapMatch(m: FindReplaceMatch): m is Extract<FindReplaceMatch, { kind: 'tiptap' }> {
  return m.kind === 'tiptap';
}

export function FindReplace({ editor, isOpen, onClose, showReplace = false }: FindReplaceProps) {
  const { findReplaceProviders } = useEditorContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [replaceTerm, setReplaceTerm] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [showReplaceField, setShowReplaceField] = useState(showReplace);
  const [matches, setMatches] = useState<FindReplaceMatch[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  // Find all matches in TipTap doc (if any)
  const findTipTapMatches = useCallback((): FindReplaceMatch[] => {
    const needleRaw = searchTerm.trim();
    if (!editor || !needleRaw) return [];

    const doc = editor.state.doc;
    const needle = caseSensitive ? needleRaw : needleRaw.toLowerCase();
    const found: FindReplaceMatch[] = [];

    doc.descendants((node, pos) => {
      if (!node.isText || !node.text) return;

      const haystack = caseSensitive ? node.text : node.text.toLowerCase();
      let idx = 0;

      while (true) {
        const at = haystack.indexOf(needle, idx);
        if (at === -1) break;
        found.push({ kind: 'tiptap', from: pos + at, to: pos + at + needleRaw.length });
        idx = at + Math.max(1, needleRaw.length);
      }
    });

    return found;
  }, [editor, searchTerm, caseSensitive]);

  const findAllMatches = useCallback(() => {
    const needleRaw = searchTerm.trim();
    if (!needleRaw) {
      setMatches([]);
      return;
    }

    const providerMatches = findReplaceProviders.flatMap(p => p.find(needleRaw, caseSensitive));
    const tiptapMatches = findTipTapMatches();

    // Prefer hierarchy matches first since this is an outliner.
    const all = [...providerMatches, ...tiptapMatches];

    setMatches(all);
    setCurrentMatchIndex(prev => (all.length === 0 ? 0 : Math.min(prev, all.length - 1)));
  }, [searchTerm, caseSensitive, findReplaceProviders, findTipTapMatches]);

  // Update matches when search term changes
  useEffect(() => {
    findAllMatches();
  }, [findAllMatches]);

  const activeMatch = useMemo(() => matches[currentMatchIndex], [matches, currentMatchIndex]);

  // Focus current match
  useEffect(() => {
    if (!isOpen || !activeMatch) return;

    if (activeMatch.kind === 'hierarchy') {
      const provider = findReplaceProviders.find(p => p.id === activeMatch.providerId);
      provider?.focus(activeMatch);
      return;
    }

    if (!editor) return;
    editor.chain().focus().setTextSelection({ from: activeMatch.from, to: activeMatch.to }).run();

    const { node } = editor.view.domAtPos(activeMatch.from);
    const element = node instanceof Element ? node : node.parentElement;
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [isOpen, activeMatch, editor, findReplaceProviders]);

  const goToNextMatch = () => {
    if (matches.length === 0) return;
    setCurrentMatchIndex(prev => (prev + 1) % matches.length);
  };

  const goToPrevMatch = () => {
    if (matches.length === 0) return;
    setCurrentMatchIndex(prev => (prev - 1 + matches.length) % matches.length);
  };

  const replaceCurrentMatch = () => {
    if (!activeMatch) return;

    if (activeMatch.kind === 'hierarchy') {
      const provider = findReplaceProviders.find(p => p.id === activeMatch.providerId);
      provider?.replace(activeMatch, replaceTerm);
      // refresh matches after replacement
      setTimeout(findAllMatches, 0);
      return;
    }

    if (!editor) return;

    editor
      .chain()
      .focus()
      .setTextSelection({ from: activeMatch.from, to: activeMatch.to })
      .deleteSelection()
      .insertContent(replaceTerm)
      .run();

    setTimeout(findAllMatches, 0);
  };

  const replaceAllMatches = () => {
    const needleRaw = searchTerm.trim();
    if (!needleRaw) return;

    // Replace in hierarchy providers
    let replacedCount = 0;
    findReplaceProviders.forEach(p => {
      replacedCount += p.replaceAll(needleRaw, replaceTerm, caseSensitive);
    });

    // Replace in tiptap by positions (end -> start)
    if (editor) {
      const tiptapMatches = matches.filter(isTipTapMatch).sort((a, b) => b.from - a.from);
      tiptapMatches.forEach(m => {
        editor
          .chain()
          .setTextSelection({ from: m.from, to: m.to })
          .deleteSelection()
          .insertContent(replaceTerm)
          .run();
      });
    }

    // Refresh
    setTimeout(() => {
      findAllMatches();
    }, 0);
  };

  // Keyboard shortcuts within dialog
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        goToNextMatch();
      } else if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        goToPrevMatch();
      } else if (e.key === 'F3') {
        e.preventDefault();
        if (e.shiftKey) goToPrevMatch();
        else goToNextMatch();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, matches.length]);

  // Sync showReplace prop
  useEffect(() => {
    setShowReplaceField(showReplace);
  }, [showReplace]);

  if (!isOpen) return null;

  return (
    <div className="absolute top-0 right-4 z-50 animate-fade-in">
      <div className="bg-card border border-border rounded-lg shadow-lg p-3 min-w-[320px]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Find &amp; Replace</span>
          </div>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Input
                placeholder="Find..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8 pr-20 text-sm"
                autoFocus
              />
              {searchTerm && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  {matches.length > 0 ? `${currentMatchIndex + 1}/${matches.length}` : '0/0'}
                </span>
              )}
            </div>

            <Toggle
              pressed={caseSensitive}
              onPressedChange={setCaseSensitive}
              size="sm"
              className="h-8 w-8 p-0"
              title="Case sensitive"
            >
              <CaseSensitive className="h-4 w-4" />
            </Toggle>

            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={goToPrevMatch}
              disabled={matches.length === 0}
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={goToNextMatch}
              disabled={matches.length === 0}
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs text-muted-foreground hover:text-foreground px-1"
            onClick={() => setShowReplaceField(!showReplaceField)}
          >
            <Replace className="h-3 w-3 mr-1" />
            {showReplaceField ? 'Hide Replace' : 'Show Replace'}
          </Button>

          {showReplaceField && (
            <div className="space-y-2 pt-1 border-t border-border/50">
              <Input
                placeholder="Replace with..."
                value={replaceTerm}
                onChange={(e) => setReplaceTerm(e.target.value)}
                className="h-8 text-sm"
              />
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-7 text-xs flex-1"
                  onClick={replaceCurrentMatch}
                  disabled={matches.length === 0}
                >
                  Replace
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-7 text-xs flex-1"
                  onClick={replaceAllMatches}
                  disabled={matches.length === 0}
                >
                  Replace All ({matches.length})
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-2 pt-2 border-t border-border/50 flex gap-3 text-[10px] text-muted-foreground">
          <span><kbd className="px-1 py-0.5 rounded bg-muted font-mono">Enter</kbd> Next</span>
          <span><kbd className="px-1 py-0.5 rounded bg-muted font-mono">Shift+Enter</kbd> Prev</span>
          <span><kbd className="px-1 py-0.5 rounded bg-muted font-mono">Esc</kbd> Close</span>
        </div>
      </div>
    </div>
  );
}
