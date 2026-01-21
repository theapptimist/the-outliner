import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Eye,
  Focus,
} from 'lucide-react';
import { HierarchyNode, FlatNode } from '@/types/node';
import {
  SpritzNode,
  SpritzWord,
  SectionOption,
  buildSpritzNodes,
  buildSectionOptions,
  calculateWordDelay,
  getTotalWordCount,
  findWordPosition,
  getGlobalWordIndex,
} from '@/lib/spritzUtils';

interface SpritzerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tree: HierarchyNode[];
  startNodeId?: string;
  prefixGenerator: (node: FlatNode) => string;
}

type ViewMode = 'focus' | 'context';

const MIN_WPM = 100;
const MAX_WPM = 800;
const DEFAULT_WPM = 300;
const WPM_STEP = 50;
const NODE_BOUNDARY_PAUSE_MS = 1000;

export function SpritzerDialog({
  open,
  onOpenChange,
  tree,
  startNodeId,
  prefixGenerator,
}: SpritzerDialogProps) {
  // Build nodes and sections
  const [selectedSectionId, setSelectedSectionId] = useState<string | undefined>(startNodeId);
  const [spritzNodes, setSpritzNodes] = useState<SpritzNode[]>([]);
  const [sectionOptions, setSectionOptions] = useState<SectionOption[]>([]);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [wpm, setWpm] = useState(DEFAULT_WPM);
  const [viewMode, setViewMode] = useState<ViewMode>('context');
  const [globalWordIndex, setGlobalWordIndex] = useState(0);
  const [isPausedAtBoundary, setIsPausedAtBoundary] = useState(false);
  const [nextNodeLabel, setNextNodeLabel] = useState<string>('');

  const timerRef = useRef<number | null>(null);
  const totalWords = getTotalWordCount(spritzNodes);

  // Rebuild spritz nodes when section changes
  useEffect(() => {
    if (!open) return;
    const nodes = buildSpritzNodes(tree, selectedSectionId, prefixGenerator);
    setSpritzNodes(nodes);
    setGlobalWordIndex(0);
    setIsPlaying(false);
    setIsPausedAtBoundary(false);
  }, [tree, selectedSectionId, prefixGenerator, open]);

  // Build section options on open
  useEffect(() => {
    if (!open) return;
    const options = buildSectionOptions(tree, prefixGenerator);
    setSectionOptions(options);
    if (!selectedSectionId && options.length > 0) {
      setSelectedSectionId(undefined); // "Read All"
    }
  }, [tree, prefixGenerator, open, selectedSectionId]);

  // Reset on dialog open
  useEffect(() => {
    if (open) {
      setSelectedSectionId(startNodeId);
      setGlobalWordIndex(0);
      setIsPlaying(false);
      setIsPausedAtBoundary(false);
    } else {
      // Cleanup timer on close
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [open, startNodeId]);

  // Get current word info
  const position = findWordPosition(spritzNodes, globalWordIndex);
  const currentNode = position ? spritzNodes[position.nodeIndex] : null;
  const currentWord = currentNode?.words[position?.wordIndex ?? 0];

  // Playback loop
  useEffect(() => {
    if (!isPlaying || !currentWord || isPausedAtBoundary) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const delay = calculateWordDelay(wpm, currentWord.pauseMultiplier);

    timerRef.current = window.setTimeout(() => {
      setGlobalWordIndex((prev) => {
        const next = prev + 1;

        // Check if we've reached the end
        if (next >= totalWords) {
          setIsPlaying(false);
          return prev;
        }

        // Check if we're crossing a node boundary
        const nextPosition = findWordPosition(spritzNodes, next);
        if (nextPosition && position && nextPosition.nodeIndex !== position.nodeIndex) {
          // About to enter a new node - pause at boundary
          const nextNode = spritzNodes[nextPosition.nodeIndex];
          setNextNodeLabel(nextNode?.label?.slice(0, 50) ?? '');
          setIsPausedAtBoundary(true);

          // Auto-continue after boundary pause
          setTimeout(() => {
            setIsPausedAtBoundary(false);
          }, NODE_BOUNDARY_PAUSE_MS);
        }

        return next;
      });
    }, delay);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isPlaying, globalWordIndex, wpm, currentWord, isPausedAtBoundary, totalWords, spritzNodes, position]);

  // Keyboard controls
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case ' ':
          e.preventDefault();
          if (isPausedAtBoundary) {
            setIsPausedAtBoundary(false);
          } else {
            setIsPlaying((p) => !p);
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (e.shiftKey) {
            skipToPrevNode();
          } else {
            skipWord(-1);
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (e.shiftKey) {
            skipToNextNode();
          } else {
            skipWord(1);
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          adjustWpm(WPM_STEP);
          break;
        case 'ArrowDown':
          e.preventDefault();
          adjustWpm(-WPM_STEP);
          break;
        case 'Escape':
          e.preventDefault();
          onOpenChange(false);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, isPausedAtBoundary, onOpenChange]);

  const skipWord = useCallback((delta: number) => {
    setGlobalWordIndex((prev) => Math.max(0, Math.min(totalWords - 1, prev + delta)));
    setIsPausedAtBoundary(false);
  }, [totalWords]);

  const skipToPrevNode = useCallback(() => {
    if (!position || position.nodeIndex === 0) {
      setGlobalWordIndex(0);
      return;
    }
    const prevNodeIndex = position.nodeIndex - 1;
    setGlobalWordIndex(getGlobalWordIndex(spritzNodes, prevNodeIndex, 0));
    setIsPausedAtBoundary(false);
  }, [position, spritzNodes]);

  const skipToNextNode = useCallback(() => {
    if (!position || position.nodeIndex >= spritzNodes.length - 1) {
      return;
    }
    const nextNodeIndex = position.nodeIndex + 1;
    setGlobalWordIndex(getGlobalWordIndex(spritzNodes, nextNodeIndex, 0));
    setIsPausedAtBoundary(false);
  }, [position, spritzNodes]);

  const adjustWpm = useCallback((delta: number) => {
    setWpm((prev) => Math.max(MIN_WPM, Math.min(MAX_WPM, prev + delta)));
  }, []);

  // Render the ORP word display
  const renderORPWord = () => {
    if (!currentWord) {
      return (
        <div className="text-muted-foreground text-2xl">
          {totalWords === 0 ? 'No text to read' : 'Ready'}
        </div>
      );
    }

    const { text, orpIndex } = currentWord;
    const before = text.slice(0, orpIndex);
    const pivot = text[orpIndex] || '';
    const after = text.slice(orpIndex + 1);

    return (
      <div className="font-mono text-4xl tracking-wider flex items-center justify-center">
        <span className="text-right w-20 text-foreground">{before}</span>
        <span className="text-primary font-bold mx-px">{pivot}</span>
        <span className="text-left w-20 text-foreground">{after}</span>
      </div>
    );
  };

  // Get siblings for context view
  const getSiblingNodes = () => {
    if (!position || !currentNode) return [];
    
    // Find siblings of current node (same depth, same parent conceptually)
    const currentDepth = currentNode.depth;
    const nodeIndex = position.nodeIndex;
    
    // Collect nearby nodes at same or parent depth
    const contextNodes: { node: SpritzNode; isCurrent: boolean }[] = [];
    
    // Look backward for context
    for (let i = Math.max(0, nodeIndex - 2); i <= Math.min(spritzNodes.length - 1, nodeIndex + 2); i++) {
      const node = spritzNodes[i];
      if (node.depth <= currentDepth + 1) {
        contextNodes.push({ node, isCurrent: i === nodeIndex });
      }
    }
    
    return contextNodes;
  };

  const progress = totalWords > 0 ? ((globalWordIndex + 1) / totalWords) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>Speed Reader</span>
            <div className="flex-1" />
            {/* Section selector */}
            <Select
              value={selectedSectionId ?? '__all__'}
              onValueChange={(v) => setSelectedSectionId(v === '__all__' ? undefined : v)}
            >
              <SelectTrigger className="w-48 h-8 text-sm">
                <SelectValue placeholder="Select section" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Read All</SelectItem>
                {sectionOptions.map((opt) => (
                  <SelectItem key={opt.id} value={opt.id}>
                    <span style={{ paddingLeft: opt.depth * 8 }}>
                      {opt.prefix} {opt.label.slice(0, 25)}{opt.label.length > 25 ? '...' : ''}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* View mode toggle */}
            <Button
              variant={viewMode === 'focus' ? 'default' : 'outline'}
              size="sm"
              className="h-8"
              onClick={() => setViewMode('focus')}
              title="Focus Mode"
            >
              <Focus className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'context' ? 'default' : 'outline'}
              size="sm"
              className="h-8"
              onClick={() => setViewMode('context')}
              title="Context Mode"
            >
              <Eye className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        {/* Main display area */}
        <div className="flex flex-col gap-4">
          {/* ORP Display Zone */}
          <div className="relative bg-muted rounded-lg p-8 flex flex-col items-center justify-center min-h-[120px]">
            {/* Guide lines */}
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-primary/30 -translate-x-1/2" />
            <div className="absolute left-1/2 top-1/2 w-3 h-3 border-l-2 border-t-2 border-primary -translate-x-1/2 -translate-y-1/2 rotate-45" />
            
            {isPausedAtBoundary ? (
              <div className="text-center">
                <div className="text-muted-foreground text-sm mb-2">Next section:</div>
                <div className="text-lg font-medium">{nextNodeLabel}...</div>
                <div className="text-xs text-muted-foreground mt-2">Press Space to continue</div>
              </div>
            ) : (
              renderORPWord()
            )}
          </div>

          {/* Context Panel - shows current node + siblings */}
          {viewMode === 'context' && currentNode && (
            <ScrollArea className="h-32 rounded-md border bg-muted/30 p-3">
              <div className="space-y-1">
                {getSiblingNodes().map(({ node, isCurrent }) => (
                  <div
                    key={node.id}
                    className={cn(
                      'text-sm px-2 py-1 rounded transition-colors',
                      isCurrent ? 'bg-primary/10 text-foreground' : 'text-muted-foreground'
                    )}
                    style={{ paddingLeft: (node.depth * 12) + 8 }}
                  >
                    <span className="text-muted-foreground mr-2">{node.prefix}</span>
                    {isCurrent ? (
                      <span>
                        {node.words.map((w, i) => (
                          <span
                            key={i}
                            className={cn(
                              'transition-all',
                              position && i === position.wordIndex
                                ? 'underline decoration-primary decoration-2 underline-offset-2'
                                : ''
                            )}
                          >
                            {w.text}{' '}
                          </span>
                        ))}
                      </span>
                    ) : (
                      node.label
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          {/* Progress bar */}
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Controls bar */}
          <div className="flex items-center gap-4">
            {/* Skip to previous node */}
            <Button
              variant="ghost"
              size="sm"
              onClick={skipToPrevNode}
              title="Previous section (Shift+←)"
            >
              <SkipBack className="h-4 w-4" />
            </Button>

            {/* Skip back word */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => skipWord(-1)}
              title="Previous word (←)"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {/* Play/Pause */}
            <Button
              variant="default"
              size="lg"
              className="h-12 w-12 rounded-full"
              onClick={() => {
                if (isPausedAtBoundary) {
                  setIsPausedAtBoundary(false);
                } else {
                  setIsPlaying((p) => !p);
                }
              }}
              title="Play/Pause (Space)"
            >
              {isPlaying && !isPausedAtBoundary ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5 ml-0.5" />
              )}
            </Button>

            {/* Skip forward word */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => skipWord(1)}
              title="Next word (→)"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>

            {/* Skip to next node */}
            <Button
              variant="ghost"
              size="sm"
              onClick={skipToNextNode}
              title="Next section (Shift+→)"
            >
              <SkipForward className="h-4 w-4" />
            </Button>

            {/* Spacer */}
            <div className="flex-1" />

            {/* WPM Slider */}
            <div className="flex items-center gap-3 min-w-[200px]">
              <span className="text-sm text-muted-foreground w-16">{wpm} WPM</span>
              <Slider
                value={[wpm]}
                min={MIN_WPM}
                max={MAX_WPM}
                step={WPM_STEP}
                onValueChange={([v]) => setWpm(v)}
                className="flex-1"
              />
            </div>
          </div>

          {/* Progress info */}
          <div className="text-center text-sm text-muted-foreground">
            {currentNode && (
              <span>
                <span className="font-medium">{currentNode.prefix}</span>
                {' • '}
                Word {globalWordIndex + 1} of {totalWords}
              </span>
            )}
          </div>

          {/* Keyboard shortcuts hint */}
          <div className="text-center text-xs text-muted-foreground">
            <span className="opacity-70">
              Space: Play/Pause • ←/→: Skip word • Shift+←/→: Skip section • ↑/↓: Adjust speed • Esc: Close
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
