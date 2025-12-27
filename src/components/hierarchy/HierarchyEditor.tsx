import { useState, useCallback } from 'react';
import { ProjectionType } from '@/types/node';
import { useHierarchy } from '@/hooks/useHierarchy';
import { TreeView } from './TreeView';
import { OutlineView } from './OutlineView';
import { GraphView } from './GraphView';
import { NodeInspector } from './NodeInspector';
import { Toolbar } from './Toolbar';
import { ProjectionTabs } from './ProjectionTabs';
import { cn } from '@/lib/utils';

export function HierarchyEditor() {
  const [projection, setProjection] = useState<ProjectionType>('tree');
  const [showInspector, setShowInspector] = useState(true);

  const {
    tree,
    flatNodes,
    selectedId,
    selectedNode,
    addNode,
    addChildNode,
    removeNode,
    updateNodeData,
    handleMove,
    handleIndent,
    handleOutdent,
    handleToggleCollapse,
    collapseAll,
    expandAll,
    selectNode,
    navigateUp,
    navigateDown,
  } = useHierarchy();

  const handleAddNode = useCallback(() => {
    if (selectedId && selectedNode?.parentId) {
      addNode(selectedNode.parentId, 'default', 'New Node', selectedId);
    } else {
      addNode(null, 'default', 'New Node');
    }
  }, [selectedId, selectedNode, addNode]);

  const handleAddChildNode = useCallback(() => {
    if (selectedId) {
      addChildNode(selectedId);
    }
  }, [selectedId, addChildNode]);

  const handleDeleteNode = useCallback(() => {
    if (selectedId) {
      removeNode(selectedId);
    }
  }, [selectedId, removeNode]);

  const handleUpdateLabel = useCallback((id: string, label: string) => {
    updateNodeData(id, { label });
  }, [updateNodeData]);

  const handleSelectNode = useCallback((id: string) => {
    selectNode(id);
    if (!showInspector) {
      setShowInspector(true);
    }
  }, [selectNode, showInspector]);

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <span className="text-primary font-bold text-sm">H</span>
          </div>
          <div>
            <h1 className="text-sm font-semibold text-foreground">Hierarchy Engine</h1>
            <p className="text-xs text-muted-foreground">Structure Management System</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="px-2 py-1 bg-muted rounded font-mono">
            {flatNodes.length} nodes
          </span>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel - Main editor */}
        <div className="flex-1 flex flex-col min-w-0">
          <Toolbar
            hasSelection={!!selectedId}
            onAddNode={handleAddNode}
            onAddChildNode={handleAddChildNode}
            onDeleteNode={handleDeleteNode}
            onIndent={() => selectedId && handleIndent(selectedId)}
            onOutdent={() => selectedId && handleOutdent(selectedId)}
            onCollapseAll={collapseAll}
            onExpandAll={expandAll}
          />
          
          <ProjectionTabs active={projection} onChange={setProjection} />

          {/* View area */}
          <div className="flex-1 overflow-hidden">
            {projection === 'tree' && (
              <TreeView
                nodes={flatNodes}
                selectedId={selectedId}
                onSelect={handleSelectNode}
                onToggleCollapse={handleToggleCollapse}
                onUpdateLabel={handleUpdateLabel}
                onMove={handleMove}
                onIndent={handleIndent}
                onOutdent={handleOutdent}
                onDelete={removeNode}
                onNavigateUp={navigateUp}
                onNavigateDown={navigateDown}
                onAddNode={handleAddNode}
                onAddChildNode={handleAddChildNode}
              />
            )}
            {projection === 'outline' && (
              <OutlineView
                nodes={flatNodes}
                selectedId={selectedId}
                onSelect={handleSelectNode}
                onUpdateLabel={handleUpdateLabel}
              />
            )}
            {projection === 'graph' && (
              <GraphView
                tree={tree}
                selectedId={selectedId}
                onSelect={handleSelectNode}
              />
            )}
          </div>
        </div>

        {/* Right panel - Inspector */}
        {showInspector && (
          <NodeInspector
            node={selectedNode}
            onUpdate={updateNodeData}
            onClose={() => setShowInspector(false)}
          />
        )}
      </div>

      {/* Footer - Keyboard hints */}
      <footer className="flex items-center gap-4 px-4 py-2 border-t border-border bg-card/50 text-xs text-muted-foreground">
        <span>
          <kbd className="px-1.5 py-0.5 bg-muted rounded font-mono">↑↓</kbd> Navigate
        </span>
        <span>
          <kbd className="px-1.5 py-0.5 bg-muted rounded font-mono">Tab</kbd> Indent
        </span>
        <span>
          <kbd className="px-1.5 py-0.5 bg-muted rounded font-mono">Enter</kbd> Add
        </span>
        <span>
          <kbd className="px-1.5 py-0.5 bg-muted rounded font-mono">F2</kbd> Rename
        </span>
        <span>
          <kbd className="px-1.5 py-0.5 bg-muted rounded font-mono">Del</kbd> Delete
        </span>
        <span className="flex-1" />
        <span>Drag to reorder • Double-click to edit</span>
      </footer>
    </div>
  );
}
