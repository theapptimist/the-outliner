 import { useState, useMemo } from 'react';
 import {
   Folder,
   FolderPlus,
   ChevronRight,
   ChevronDown,
   MoreHorizontal,
   Pencil,
   Trash2,
   Check,
   X,
   FileText,
 } from 'lucide-react';
 import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuTrigger,
 } from '@/components/ui/dropdown-menu';
 import { Input } from '@/components/ui/input';
 import { Button } from '@/components/ui/button';
 import { cn } from '@/lib/utils';
 import { DocumentFolder, FolderWithChildren } from '@/hooks/useDocumentFolders';
 
 interface FolderItemProps {
   folder: FolderWithChildren;
   depth: number;
   expandedFolders: Set<string>;
   onToggleExpand: (id: string) => void;
   onRename: (id: string, name: string) => void;
   onDelete: (id: string) => void;
   selectedFolderId?: string | null;
   onSelectFolder?: (id: string | null) => void;
   editingFolderId: string | null;
   onStartEditing: (id: string) => void;
   onStopEditing: () => void;
 }
 
 function FolderItem({
   folder,
   depth,
   expandedFolders,
   onToggleExpand,
   onRename,
   onDelete,
   selectedFolderId,
   onSelectFolder,
   editingFolderId,
   onStartEditing,
   onStopEditing,
 }: FolderItemProps) {
   const [draftName, setDraftName] = useState(folder.name);
   const isExpanded = expandedFolders.has(folder.id);
   const isEditing = editingFolderId === folder.id;
   const isSelected = selectedFolderId === folder.id;
   const hasChildren = folder.children.length > 0;
 
   const handleSubmitRename = () => {
     const trimmed = draftName.trim();
     if (trimmed && trimmed !== folder.name) {
       onRename(folder.id, trimmed);
     }
     onStopEditing();
   };
 
   return (
     <div>
       <div
         className={cn(
           "group flex items-center gap-1 px-2 py-1.5 rounded-md text-xs transition-colors cursor-pointer",
           isSelected
             ? "bg-primary/10 text-foreground"
             : "text-muted-foreground hover:bg-muted hover:text-foreground"
         )}
         style={{ paddingLeft: `${8 + depth * 16}px` }}
         onClick={() => onSelectFolder?.(folder.id)}
       >
         <button
           onClick={(e) => {
             e.stopPropagation();
             onToggleExpand(folder.id);
           }}
           className="h-4 w-4 flex items-center justify-center shrink-0"
         >
           {hasChildren ? (
             isExpanded ? (
               <ChevronDown className="h-3 w-3" />
             ) : (
               <ChevronRight className="h-3 w-3" />
             )
           ) : (
             <span className="h-3 w-3" />
           )}
         </button>
         
         <Folder className={cn(
           "h-3.5 w-3.5 shrink-0",
           isExpanded ? "text-warning" : "text-muted-foreground"
         )} />
         
         {isEditing ? (
           <div className="flex items-center gap-1 flex-1" onClick={(e) => e.stopPropagation()}>
             <Input
               value={draftName}
               onChange={(e) => setDraftName(e.target.value)}
               onKeyDown={(e) => {
                 if (e.key === 'Enter') handleSubmitRename();
                 if (e.key === 'Escape') onStopEditing();
               }}
               onBlur={handleSubmitRename}
               className="h-5 text-xs px-1 py-0 flex-1"
               autoFocus
             />
             <button
               onClick={handleSubmitRename}
               className="h-4 w-4 flex items-center justify-center text-primary hover:text-primary/80"
             >
               <Check className="h-3 w-3" />
             </button>
             <button
               onClick={onStopEditing}
               className="h-4 w-4 flex items-center justify-center text-muted-foreground hover:text-foreground"
             >
               <X className="h-3 w-3" />
             </button>
           </div>
         ) : (
           <>
             <span className="flex-1 truncate">{folder.name}</span>
             
             <DropdownMenu>
               <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                 <button className="h-5 w-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded hover:bg-muted">
                   <MoreHorizontal className="h-3 w-3" />
                 </button>
               </DropdownMenuTrigger>
               <DropdownMenuContent align="end" className="w-32">
                 <DropdownMenuItem onClick={() => {
                   setDraftName(folder.name);
                   onStartEditing(folder.id);
                 }}>
                   <Pencil className="h-3.5 w-3.5 mr-2" />
                   Rename
                 </DropdownMenuItem>
                 <DropdownMenuItem 
                   onClick={() => onDelete(folder.id)}
                   className="text-destructive focus:text-destructive"
                 >
                   <Trash2 className="h-3.5 w-3.5 mr-2" />
                   Delete
                 </DropdownMenuItem>
               </DropdownMenuContent>
             </DropdownMenu>
           </>
         )}
       </div>
       
       {isExpanded && hasChildren && (
         <div>
           {folder.children.map(child => (
             <FolderItem
               key={child.id}
               folder={child}
               depth={depth + 1}
               expandedFolders={expandedFolders}
               onToggleExpand={onToggleExpand}
               onRename={onRename}
               onDelete={onDelete}
               selectedFolderId={selectedFolderId}
               onSelectFolder={onSelectFolder}
               editingFolderId={editingFolderId}
               onStartEditing={onStartEditing}
               onStopEditing={onStopEditing}
             />
           ))}
         </div>
       )}
     </div>
   );
 }
 
 interface FolderTreeProps {
   folders: FolderWithChildren[];
   selectedFolderId?: string | null;
   onSelectFolder?: (id: string | null) => void;
   onRename: (id: string, name: string) => void;
   onDelete: (id: string) => void;
   onCreate: (parentId: string | null) => void;
   showRootOption?: boolean;
 }
 
 export function FolderTree({
   folders,
   selectedFolderId,
   onSelectFolder,
   onRename,
   onDelete,
   onCreate,
   showRootOption = true,
 }: FolderTreeProps) {
   const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
   const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
 
   const toggleExpand = (id: string) => {
     setExpandedFolders(prev => {
       const next = new Set(prev);
       if (next.has(id)) {
         next.delete(id);
       } else {
         next.add(id);
       }
       return next;
     });
   };
 
   return (
     <div className="space-y-0.5">
       {showRootOption && (
         <button
           onClick={() => onSelectFolder?.(null)}
           className={cn(
             "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors",
             selectedFolderId === null
               ? "bg-primary/10 text-foreground"
               : "text-muted-foreground hover:bg-muted hover:text-foreground"
           )}
         >
           <FileText className="h-3.5 w-3.5" />
           <span className="flex-1 text-left">No Folder</span>
         </button>
       )}
       
       {folders.map(folder => (
         <FolderItem
           key={folder.id}
           folder={folder}
           depth={0}
           expandedFolders={expandedFolders}
           onToggleExpand={toggleExpand}
           onRename={onRename}
           onDelete={onDelete}
           selectedFolderId={selectedFolderId}
           onSelectFolder={onSelectFolder}
           editingFolderId={editingFolderId}
           onStartEditing={setEditingFolderId}
           onStopEditing={() => setEditingFolderId(null)}
         />
       ))}
       
       <button
         onClick={() => onCreate(null)}
         className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
       >
         <FolderPlus className="h-3.5 w-3.5" />
         <span>New Folder</span>
       </button>
     </div>
   );
 }
 
 interface FolderPickerProps {
   folders: DocumentFolder[];
   currentFolderId?: string | null;
   onSelect: (folderId: string | null) => void;
   buildTree: (parentId: string | null) => FolderWithChildren[];
 }
 
 export function FolderPicker({ folders, currentFolderId, onSelect, buildTree }: FolderPickerProps) {
   const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
   const tree = useMemo(() => buildTree(null), [buildTree]);
 
   const toggleExpand = (id: string) => {
     setExpandedFolders(prev => {
       const next = new Set(prev);
       if (next.has(id)) {
         next.delete(id);
       } else {
         next.add(id);
       }
       return next;
     });
   };
 
   const renderFolder = (folder: FolderWithChildren, depth: number) => {
     const isExpanded = expandedFolders.has(folder.id);
     const isSelected = currentFolderId === folder.id;
     const hasChildren = folder.children.length > 0;
 
     return (
       <div key={folder.id}>
         <button
           onClick={() => onSelect(folder.id)}
           className={cn(
             "w-full flex items-center gap-1 px-2 py-1.5 rounded-md text-xs transition-colors",
             isSelected
               ? "bg-primary/10 text-foreground"
               : "text-muted-foreground hover:bg-muted hover:text-foreground"
           )}
           style={{ paddingLeft: `${8 + depth * 16}px` }}
         >
           <button
             onClick={(e) => {
               e.stopPropagation();
               toggleExpand(folder.id);
             }}
             className="h-4 w-4 flex items-center justify-center shrink-0"
           >
             {hasChildren ? (
               isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />
             ) : (
               <span className="h-3 w-3" />
             )}
           </button>
           <Folder className={cn("h-3.5 w-3.5 shrink-0", isExpanded ? "text-warning" : "")} />
           <span className="flex-1 text-left truncate">{folder.name}</span>
           {isSelected && <Check className="h-3 w-3 text-primary shrink-0" />}
         </button>
         
         {isExpanded && hasChildren && folder.children.map(child => renderFolder(child, depth + 1))}
       </div>
     );
   };
 
   return (
     <div className="space-y-0.5">
       <button
         onClick={() => onSelect(null)}
         className={cn(
           "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors",
           currentFolderId === null
             ? "bg-primary/10 text-foreground"
             : "text-muted-foreground hover:bg-muted hover:text-foreground"
         )}
       >
         <FileText className="h-3.5 w-3.5" />
         <span className="flex-1 text-left">No Folder</span>
         {currentFolderId === null && <Check className="h-3 w-3 text-primary shrink-0" />}
       </button>
       
       {tree.map(folder => renderFolder(folder, 0))}
     </div>
   );
 }