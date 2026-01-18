import { useMemo } from 'react';
import { useNavigation } from '@/contexts/NavigationContext';
import { Person, PersonUsage } from '@/components/editor/context/PeopleContext';
import { Place, PlaceUsage } from '@/components/editor/context/PlacesContext';
import { TaggedDate, DateUsage } from '@/components/editor/context/DatesContext';
import { DefinedTerm, TermUsage } from '@/components/editor/context/TermsContext';

const STORAGE_PREFIX = 'outliner-session';

interface AggregatedEntity<T> {
  entity: T;
  sourceDocId: string;
  sourceDocTitle: string;
}

export interface AggregatedPerson extends Person {
  sourceDocId: string;
  sourceDocTitle: string;
}

export interface AggregatedPlace extends Place {
  sourceDocId: string;
  sourceDocTitle: string;
}

export interface AggregatedDate extends TaggedDate {
  sourceDocId: string;
  sourceDocTitle: string;
}

export interface AggregatedTerm extends DefinedTerm {
  sourceDocId: string;
  sourceDocTitle: string;
}

function loadEntitiesFromStorage<T>(key: string): T[] {
  try {
    const storageKey = `${STORAGE_PREFIX}:${key}`;
    const item = localStorage.getItem(storageKey);
    if (item) {
      return JSON.parse(item) as T[];
    }
  } catch (e) {
    console.warn(`Failed to load ${key} from localStorage:`, e);
  }
  return [];
}

export function useAggregatedEntities() {
  const { masterDocument, activeSubOutlineId, isInMasterMode } = useNavigation();

  // Only aggregate when viewing master doc itself (not a sub-doc)
  const shouldAggregate = isInMasterMode && !activeSubOutlineId && masterDocument;

  const aggregatedPeople = useMemo(() => {
    if (!shouldAggregate || !masterDocument) return [];

    const result: AggregatedPerson[] = [];
    const seenNames = new Set<string>();

    for (const link of masterDocument.links) {
      const people = loadEntitiesFromStorage<Person>(`tagged-people:${link.linkedDocumentId}`);
      for (const person of people) {
        // Dedupe by name (case-insensitive)
        const normalizedName = person.name.toLowerCase();
        if (!seenNames.has(normalizedName)) {
          seenNames.add(normalizedName);
          result.push({
            ...person,
            sourceDocId: link.linkedDocumentId,
            sourceDocTitle: link.linkedDocumentTitle,
          });
        }
      }
    }

    return result;
  }, [shouldAggregate, masterDocument]);

  const aggregatedPlaces = useMemo(() => {
    if (!shouldAggregate || !masterDocument) return [];

    const result: AggregatedPlace[] = [];
    const seenNames = new Set<string>();

    for (const link of masterDocument.links) {
      const places = loadEntitiesFromStorage<Place>(`tagged-places:${link.linkedDocumentId}`);
      for (const place of places) {
        const normalizedName = place.name.toLowerCase();
        if (!seenNames.has(normalizedName)) {
          seenNames.add(normalizedName);
          result.push({
            ...place,
            sourceDocId: link.linkedDocumentId,
            sourceDocTitle: link.linkedDocumentTitle,
          });
        }
      }
    }

    return result;
  }, [shouldAggregate, masterDocument]);

  const aggregatedDates = useMemo(() => {
    if (!shouldAggregate || !masterDocument) return [];

    const result: AggregatedDate[] = [];
    const seenRawText = new Set<string>();

    for (const link of masterDocument.links) {
      const dates = loadEntitiesFromStorage<TaggedDate>(`tagged-dates:${link.linkedDocumentId}`);
      for (const date of dates) {
        // Dedupe by raw text
        const key = date.rawText.toLowerCase();
        if (!seenRawText.has(key)) {
          seenRawText.add(key);
          result.push({
            ...date,
            sourceDocId: link.linkedDocumentId,
            sourceDocTitle: link.linkedDocumentTitle,
          });
        }
      }
    }

    // Sort by date
    result.sort((a, b) => {
      const dateA = a.date instanceof Date ? a.date : new Date(a.date);
      const dateB = b.date instanceof Date ? b.date : new Date(b.date);
      return dateA.getTime() - dateB.getTime();
    });

    return result;
  }, [shouldAggregate, masterDocument]);

  const aggregatedTerms = useMemo(() => {
    if (!shouldAggregate || !masterDocument) return [];

    const result: AggregatedTerm[] = [];
    const seenTerms = new Set<string>();

    for (const link of masterDocument.links) {
      const terms = loadEntitiesFromStorage<DefinedTerm>(`defined-terms:${link.linkedDocumentId}`);
      for (const term of terms) {
        const key = term.term.toLowerCase();
        if (!seenTerms.has(key)) {
          seenTerms.add(key);
          result.push({
            ...term,
            sourceDocId: link.linkedDocumentId,
            sourceDocTitle: link.linkedDocumentTitle,
          });
        }
      }
    }

    return result;
  }, [shouldAggregate, masterDocument]);

  return {
    shouldAggregate,
    aggregatedPeople,
    aggregatedPlaces,
    aggregatedDates,
    aggregatedTerms,
  };
}
