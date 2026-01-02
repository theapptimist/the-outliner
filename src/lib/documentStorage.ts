import { DocumentState, createEmptyDocument } from '@/types/document';

const DOCUMENTS_KEY = 'outliner:documents';
const DOC_PREFIX = 'outliner:doc:';
const RECENT_KEY = 'outliner:recent';
const MAX_RECENT = 5;

export interface DocumentMetadata {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

function getDocumentsIndex(): DocumentMetadata[] {
  try {
    const stored = localStorage.getItem(DOCUMENTS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function setDocumentsIndex(docs: DocumentMetadata[]) {
  localStorage.setItem(DOCUMENTS_KEY, JSON.stringify(docs));
}

export function listDocuments(): DocumentMetadata[] {
  return getDocumentsIndex().sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export function loadDocument(id: string): DocumentState | null {
  try {
    const stored = localStorage.getItem(DOC_PREFIX + id);
    if (!stored) return null;
    
    const doc = JSON.parse(stored) as DocumentState;
    addToRecent(id);
    return doc;
  } catch {
    return null;
  }
}

export function saveDocument(doc: DocumentState): DocumentState {
  const now = new Date().toISOString();
  const docId = doc.meta.id;
  const updatedDoc: DocumentState = {
    ...doc,
    meta: {
      ...doc.meta,
      updatedAt: now,
    },
  };

  // Save full document
  localStorage.setItem(DOC_PREFIX + docId, JSON.stringify(updatedDoc));

  // Update index
  const docs = getDocumentsIndex();
  const existingIndex = docs.findIndex(d => d.id === docId);
  const metadata: DocumentMetadata = {
    id: docId,
    title: doc.meta.title,
    createdAt: doc.meta.createdAt,
    updatedAt: now,
  };

  if (existingIndex >= 0) {
    docs[existingIndex] = metadata;
  } else {
    docs.push(metadata);
  }
  setDocumentsIndex(docs);
  addToRecent(docId);

  return updatedDoc;
}

export function deleteDocument(id: string) {
  localStorage.removeItem(DOC_PREFIX + id);
  
  const docs = getDocumentsIndex().filter(d => d.id !== id);
  setDocumentsIndex(docs);
  
  const recent = getRecentIds().filter(r => r !== id);
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
}

function getRecentIds(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function addToRecent(id: string) {
  const recent = getRecentIds().filter(r => r !== id);
  recent.unshift(id);
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

export function getRecentDocuments(): DocumentMetadata[] {
  const recentIds = getRecentIds();
  const allDocs = getDocumentsIndex();
  
  return recentIds
    .map(id => allDocs.find(d => d.id === id))
    .filter((d): d is DocumentMetadata => d !== undefined);
}

export function exportDocument(doc: DocumentState): void {
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${doc.meta.title || 'document'}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importDocument(file: File): Promise<DocumentState> {
  const text = await file.text();
  const doc = JSON.parse(text) as DocumentState;
  
  // Generate new ID to avoid conflicts
  const newDoc: DocumentState = {
    ...doc,
    meta: {
      ...doc.meta,
      id: crypto.randomUUID(),
      title: doc.meta.title + ' (imported)',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };
  
  return saveDocument(newDoc);
}

export function createNewDocument(title: string = 'Untitled'): DocumentState {
  const doc = createEmptyDocument();
  doc.meta.title = title;
  return saveDocument(doc);
}
