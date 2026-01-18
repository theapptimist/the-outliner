import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getFullDocumentText } from '@/lib/documentContentExtractor';
import { HierarchyNode } from '@/types/node';
import { toast } from 'sonner';

export interface PersonSuggestion {
  name: string;
  role?: string;
}

export interface PlaceSuggestion {
  name: string;
  significance?: string;
}

export interface DateSuggestion {
  rawText: string;
  description?: string;
}

export interface TermSuggestion {
  term: string;
  definition: string;
}

export interface EntitySuggestions {
  people: PersonSuggestion[];
  places: PlaceSuggestion[];
  dates: DateSuggestion[];
  terms: TermSuggestion[];
}

export type ScanState = 'idle' | 'scanning' | 'reviewing';

interface UseEntitySuggestionsOptions {
  existingPeople: Array<{ name: string }>;
  existingPlaces: Array<{ name: string }>;
  existingDates: Array<{ rawText: string }>;
  existingTerms: Array<{ term: string }>;
}

export function useEntitySuggestions(options: UseEntitySuggestionsOptions) {
  const { existingPeople, existingPlaces, existingDates, existingTerms } = options;
  
  const [state, setState] = useState<ScanState>('idle');
  const [suggestions, setSuggestions] = useState<EntitySuggestions>({
    people: [],
    places: [],
    dates: [],
    terms: []
  });

  const filterDuplicates = useCallback((entities: EntitySuggestions): EntitySuggestions => {
    const normalizeStr = (s: string) => s.toLowerCase().trim();
    
    const existingPeopleNames = new Set(existingPeople.map(p => normalizeStr(p.name)));
    const existingPlaceNames = new Set(existingPlaces.map(p => normalizeStr(p.name)));
    const existingDateTexts = new Set(existingDates.map(d => normalizeStr(d.rawText)));
    const existingTermNames = new Set(existingTerms.map(t => normalizeStr(t.term)));

    return {
      people: entities.people.filter(p => !existingPeopleNames.has(normalizeStr(p.name))),
      places: entities.places.filter(p => !existingPlaceNames.has(normalizeStr(p.name))),
      dates: entities.dates.filter(d => !existingDateTexts.has(normalizeStr(d.rawText))),
      terms: entities.terms.filter(t => !existingTermNames.has(normalizeStr(t.term)))
    };
  }, [existingPeople, existingPlaces, existingDates, existingTerms]);

  const scanDocument = useCallback(async (
    hierarchyBlocks: Record<string, HierarchyNode[]>,
    editorContent?: any
  ) => {
    const content = getFullDocumentText(hierarchyBlocks, editorContent);
    
    if (!content.trim()) {
      toast.error('No content to scan. Add some text to your document first.');
      return;
    }

    setState('scanning');
    setSuggestions({ people: [], places: [], dates: [], terms: [] });

    try {
      const { data, error } = await supabase.functions.invoke('detect-entities', {
        body: { content }
      });

      if (error) {
        console.error('Entity detection error:', error);
        toast.error(error.message || 'Failed to scan document');
        setState('idle');
        return;
      }

      if (!data?.entities) {
        toast.error('No response from AI');
        setState('idle');
        return;
      }

      const filtered = filterDuplicates(data.entities);
      
      const totalSuggestions = 
        filtered.people.length + 
        filtered.places.length + 
        filtered.dates.length + 
        filtered.terms.length;

      if (totalSuggestions === 0) {
        toast.info('No new entities found. All detected entities are already in your library.');
        setState('idle');
        return;
      }

      setSuggestions(filtered);
      setState('reviewing');
      toast.success(`Found ${totalSuggestions} new entities to review`);

    } catch (err) {
      console.error('Scan error:', err);
      toast.error('Failed to scan document');
      setState('idle');
    }
  }, [filterDuplicates]);

  const acceptPerson = useCallback((index: number) => {
    setSuggestions(prev => ({
      ...prev,
      people: prev.people.filter((_, i) => i !== index)
    }));
  }, []);

  const acceptPlace = useCallback((index: number) => {
    setSuggestions(prev => ({
      ...prev,
      places: prev.places.filter((_, i) => i !== index)
    }));
  }, []);

  const acceptDate = useCallback((index: number) => {
    setSuggestions(prev => ({
      ...prev,
      dates: prev.dates.filter((_, i) => i !== index)
    }));
  }, []);

  const acceptTerm = useCallback((index: number) => {
    setSuggestions(prev => ({
      ...prev,
      terms: prev.terms.filter((_, i) => i !== index)
    }));
  }, []);

  const dismissPerson = useCallback((index: number) => {
    setSuggestions(prev => ({
      ...prev,
      people: prev.people.filter((_, i) => i !== index)
    }));
  }, []);

  const dismissPlace = useCallback((index: number) => {
    setSuggestions(prev => ({
      ...prev,
      places: prev.places.filter((_, i) => i !== index)
    }));
  }, []);

  const dismissDate = useCallback((index: number) => {
    setSuggestions(prev => ({
      ...prev,
      dates: prev.dates.filter((_, i) => i !== index)
    }));
  }, []);

  const dismissTerm = useCallback((index: number) => {
    setSuggestions(prev => ({
      ...prev,
      terms: prev.terms.filter((_, i) => i !== index)
    }));
  }, []);

  const dismissAll = useCallback(() => {
    setSuggestions({ people: [], places: [], dates: [], terms: [] });
    setState('idle');
  }, []);

  const getSuggestionCount = useCallback((type: 'people' | 'places' | 'dates' | 'terms') => {
    return suggestions[type].length;
  }, [suggestions]);

  const getTotalSuggestionCount = useCallback(() => {
    return suggestions.people.length + 
           suggestions.places.length + 
           suggestions.dates.length + 
           suggestions.terms.length;
  }, [suggestions]);

  // Auto-close review mode when all suggestions are handled
  const checkAndCloseReview = useCallback(() => {
    if (getTotalSuggestionCount() === 0 && state === 'reviewing') {
      setState('idle');
    }
  }, [getTotalSuggestionCount, state]);

  return {
    state,
    suggestions,
    scanDocument,
    acceptPerson,
    acceptPlace,
    acceptDate,
    acceptTerm,
    dismissPerson,
    dismissPlace,
    dismissDate,
    dismissTerm,
    dismissAll,
    getSuggestionCount,
    getTotalSuggestionCount,
    checkAndCloseReview
  };
}
