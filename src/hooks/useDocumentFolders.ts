 import { useState, useEffect, useCallback } from 'react';
 import { supabase } from '@/integrations/supabase/client';
 import { useAuth } from '@/contexts/AuthContext';
 
 export interface DocumentFolder {
   id: string;
   name: string;
   parent_folder_id: string | null;
   created_at: string;
   updated_at: string;
 }
 
 export interface FolderWithChildren extends DocumentFolder {
   children: FolderWithChildren[];
 }
 
 export function useDocumentFolders() {
   const { user } = useAuth();
   const [folders, setFolders] = useState<DocumentFolder[]>([]);
   const [loading, setLoading] = useState(true);
 
   const fetchFolders = useCallback(async () => {
     if (!user) {
       setFolders([]);
       setLoading(false);
       return;
     }
 
     try {
       const { data, error } = await supabase
         .from('document_folders')
         .select('*')
         .eq('user_id', user.id)
         .order('name');
 
       if (error) throw error;
       setFolders(data || []);
     } catch (err) {
       console.error('[useDocumentFolders] Error fetching folders:', err);
       setFolders([]);
     } finally {
       setLoading(false);
     }
   }, [user]);
 
   useEffect(() => {
     fetchFolders();
   }, [fetchFolders]);
 
   const createFolder = useCallback(async (name: string, parentFolderId?: string | null): Promise<DocumentFolder | null> => {
     if (!user) return null;
 
     try {
       const { data, error } = await supabase
         .from('document_folders')
         .insert({
           user_id: user.id,
           name,
           parent_folder_id: parentFolderId || null,
         })
         .select()
         .single();
 
       if (error) throw error;
       
       setFolders(prev => [...prev, data]);
       return data;
     } catch (err) {
       console.error('[useDocumentFolders] Error creating folder:', err);
       return null;
     }
   }, [user]);
 
   const renameFolder = useCallback(async (folderId: string, newName: string): Promise<boolean> => {
     try {
       const { error } = await supabase
         .from('document_folders')
         .update({ name: newName })
         .eq('id', folderId);
 
       if (error) throw error;
       
       setFolders(prev => prev.map(f => f.id === folderId ? { ...f, name: newName } : f));
       return true;
     } catch (err) {
       console.error('[useDocumentFolders] Error renaming folder:', err);
       return false;
     }
   }, []);
 
   const deleteFolder = useCallback(async (folderId: string): Promise<boolean> => {
     try {
       const { error } = await supabase
         .from('document_folders')
         .delete()
         .eq('id', folderId);
 
       if (error) throw error;
       
       // Also remove any child folders from state (they cascade delete in DB)
       const removeRecursive = (folders: DocumentFolder[], id: string): DocumentFolder[] => {
         const childIds = folders.filter(f => f.parent_folder_id === id).map(f => f.id);
         let result = folders.filter(f => f.id !== id);
         childIds.forEach(cid => {
           result = removeRecursive(result, cid);
         });
         return result;
       };
       
       setFolders(prev => removeRecursive(prev, folderId));
       return true;
     } catch (err) {
       console.error('[useDocumentFolders] Error deleting folder:', err);
       return false;
     }
   }, []);
 
   const moveFolder = useCallback(async (folderId: string, newParentId: string | null): Promise<boolean> => {
     try {
       const { error } = await supabase
         .from('document_folders')
         .update({ parent_folder_id: newParentId })
         .eq('id', folderId);
 
       if (error) throw error;
       
       setFolders(prev => prev.map(f => 
         f.id === folderId ? { ...f, parent_folder_id: newParentId } : f
       ));
       return true;
     } catch (err) {
       console.error('[useDocumentFolders] Error moving folder:', err);
       return false;
     }
   }, []);
 
   const moveDocumentToFolder = useCallback(async (documentId: string, folderId: string | null): Promise<boolean> => {
     try {
       const { error } = await supabase
         .from('documents')
         .update({ folder_id: folderId })
         .eq('id', documentId);
 
       if (error) throw error;
       return true;
     } catch (err) {
       console.error('[useDocumentFolders] Error moving document:', err);
       return false;
     }
   }, []);
 
   // Build folder tree from flat list
   const buildFolderTree = useCallback((parentId: string | null = null): FolderWithChildren[] => {
     return folders
       .filter(f => f.parent_folder_id === parentId)
       .map(folder => ({
         ...folder,
         children: buildFolderTree(folder.id),
       }));
   }, [folders]);
 
   const getFolderPath = useCallback((folderId: string): DocumentFolder[] => {
     const path: DocumentFolder[] = [];
     let current = folders.find(f => f.id === folderId);
     
     while (current) {
       path.unshift(current);
       current = current.parent_folder_id 
         ? folders.find(f => f.id === current!.parent_folder_id)
         : undefined;
     }
     
     return path;
   }, [folders]);
 
   return {
     folders,
     loading,
     createFolder,
     renameFolder,
     deleteFolder,
     moveFolder,
     moveDocumentToFolder,
     buildFolderTree,
     getFolderPath,
     refresh: fetchFolders,
   };
 }