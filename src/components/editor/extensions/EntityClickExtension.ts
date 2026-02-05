 import { Extension } from '@tiptap/core';
 import { Plugin, PluginKey } from '@tiptap/pm/state';
 
 export type EntityType = 'term' | 'person' | 'place' | 'date';
 export type EntityClickCallback = (type: EntityType, text: string) => void;
 
 export interface EntityClickStorage {
   onEntityClick: EntityClickCallback | null;
 }
 
 export const entityClickPluginKey = new PluginKey('entityClick');
 
 export const EntityClickExtension = Extension.create<{}, EntityClickStorage>({
   name: 'entityClick',
 
   addStorage() {
     return {
       onEntityClick: null,
     };
   },
 
   addProseMirrorPlugins() {
     const storage = this.storage;
 
     return [
       new Plugin({
         key: entityClickPluginKey,
         props: {
           handleClick(view, pos, event) {
             const target = event.target as HTMLElement;
             
             // Check for entity highlight classes
             const classToType: Record<string, EntityType> = {
               'term-highlight': 'term',
               'person-highlight': 'person',
               'place-highlight': 'place',
               'date-highlight': 'date',
             };
             
             for (const [className, entityType] of Object.entries(classToType)) {
               if (target.classList.contains(className)) {
                 const text = target.textContent || '';
                 if (text && storage.onEntityClick) {
                   storage.onEntityClick(entityType, text);
                   return true; // Prevent default selection behavior
                 }
               }
             }
             
             return false; // Allow normal behavior
           },
         },
       }),
     ];
   },
 });