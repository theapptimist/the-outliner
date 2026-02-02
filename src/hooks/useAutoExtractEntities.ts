import { useCallback, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getFullDocumentText } from '@/lib/documentContentExtractor';
import { HierarchyNode } from '@/types/node';
import { toast } from 'sonner';

interface ExtractedEntities {
  people: Array<{ name: string; role?: string }>;
  places: Array<{ name: string; significance?: string }>;
  dates: Array<{ rawText: string; description?: string }>;
  terms: Array<{ term: string; definition: string }>;
}

interface UseAutoExtractEntitiesOptions {
  addPerson: (name: string, role?: string, description?: string) => void;
  addPlace: (name: string, significance?: string) => void;
  addDate: (date: Date, rawText: string, description?: string) => void;
  addTerm: (term: string, definition: string) => void;
  existingPeople: Array<{ name: string }>;
  existingPlaces: Array<{ name: string }>;
  existingDates: Array<{ rawText: string }>;
  existingTerms: Array<{ term: string }>;
}

export function useAutoExtractEntities(options: UseAutoExtractEntitiesOptions) {
  const {
    addPerson,
    addPlace,
    addDate,
    addTerm,
    existingPeople,
    existingPlaces,
    existingDates,
    existingTerms,
  } = options;

  const [isExtracting, setIsExtracting] = useState(false);
  const extractionInProgressRef = useRef(false);

  const normalizeStr = (s: string) => s.toLowerCase().trim();

  const autoExtractEntities = useCallback(async (
    hierarchyBlocks: Record<string, HierarchyNode[]>,
    editorContent?: any
  ) => {
    // Prevent duplicate extractions
    if (extractionInProgressRef.current) {
      console.log('[AutoExtract] Extraction already in progress, skipping');
      return;
    }

    const content = getFullDocumentText(hierarchyBlocks, editorContent);

    if (!content.trim()) {
      console.log('[AutoExtract] No content to extract entities from');
      return;
    }

    extractionInProgressRef.current = true;
    setIsExtracting(true);

    try {
      console.log('[AutoExtract] Starting entity extraction, content length:', content.length);
      
      const { data, error } = await supabase.functions.invoke('detect-entities', {
        body: { content }
      });

      if (error) {
        console.error('[AutoExtract] Entity detection error:', error);
        toast.error('Failed to extract entities');
        return;
      }

      if (!data?.entities) {
        console.log('[AutoExtract] No entities returned from AI');
        return;
      }

      const entities: ExtractedEntities = data.entities;

      // Filter out duplicates
      const existingPeopleNames = new Set(existingPeople.map(p => normalizeStr(p.name)));
      const existingPlaceNames = new Set(existingPlaces.map(p => normalizeStr(p.name)));
      const existingDateTexts = new Set(existingDates.map(d => normalizeStr(d.rawText)));
      const existingTermNames = new Set(existingTerms.map(t => normalizeStr(t.term)));

      const newPeople = entities.people.filter(p => !existingPeopleNames.has(normalizeStr(p.name)));
      const newPlaces = entities.places.filter(p => !existingPlaceNames.has(normalizeStr(p.name)));
      const newDates = entities.dates.filter(d => !existingDateTexts.has(normalizeStr(d.rawText)));
      const newTerms = entities.terms.filter(t => !existingTermNames.has(normalizeStr(t.term)));

      const totalNew = newPeople.length + newPlaces.length + newDates.length + newTerms.length;

      if (totalNew === 0) {
        console.log('[AutoExtract] No new entities found');
        toast.info('No new entities detected');
        return;
      }

      // Auto-add all new entities
      for (const person of newPeople) {
        addPerson(person.name, person.role);
      }
      for (const place of newPlaces) {
        addPlace(place.name, place.significance);
      }
      for (const date of newDates) {
        // Parse date from rawText or use current date as fallback
        const parsedDate = new Date(date.rawText) || new Date();
        addDate(parsedDate, date.rawText, date.description);
      }
      for (const term of newTerms) {
        addTerm(term.term, term.definition);
      }

      console.log('[AutoExtract] Added entities:', {
        people: newPeople.length,
        places: newPlaces.length,
        dates: newDates.length,
        terms: newTerms.length
      });

      toast.success(`Extracted ${totalNew} entities: ${newPeople.length} people, ${newPlaces.length} places, ${newDates.length} dates, ${newTerms.length} terms`);

    } catch (err) {
      console.error('[AutoExtract] Error:', err);
      toast.error('Entity extraction failed');
    } finally {
      setIsExtracting(false);
      extractionInProgressRef.current = false;
    }
  }, [addPerson, addPlace, addDate, addTerm, existingPeople, existingPlaces, existingDates, existingTerms]);

  return {
    autoExtractEntities,
    isExtracting,
  };
}
