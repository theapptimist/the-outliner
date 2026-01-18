import { useMemo, useEffect, useState } from 'react';
import { useNavigation } from '@/contexts/NavigationContext';
import { loadEntitiesForDocuments } from '@/lib/cloudEntityStorage';
import { Person, PersonUsage } from '@/components/editor/context/PeopleContext';
import { Place, PlaceUsage } from '@/components/editor/context/PlacesContext';
import { TaggedDate, DateUsage } from '@/components/editor/context/DatesContext';
import { DefinedTerm, TermUsage } from '@/components/editor/context/TermsContext';

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

export function useAggregatedEntities() {
  const { masterDocument, activeSubOutlineId, isInMasterMode } = useNavigation();

  // Only aggregate when viewing master doc itself (not a sub-doc)
  const shouldAggregate = isInMasterMode && !activeSubOutlineId && masterDocument;

  const [aggregatedPeople, setAggregatedPeople] = useState<AggregatedPerson[]>([]);
  const [aggregatedPlaces, setAggregatedPlaces] = useState<AggregatedPlace[]>([]);
  const [aggregatedDates, setAggregatedDates] = useState<AggregatedDate[]>([]);
  const [aggregatedTerms, setAggregatedTerms] = useState<AggregatedTerm[]>([]);
  const [loading, setLoading] = useState(false);

  // Get linked document IDs and their titles
  const linkMap = useMemo(() => {
    if (!masterDocument) return new Map<string, string>();
    const map = new Map<string, string>();
    for (const link of masterDocument.links) {
      map.set(link.linkedDocumentId, link.linkedDocumentTitle);
    }
    return map;
  }, [masterDocument]);

  const documentIds = useMemo(() => Array.from(linkMap.keys()), [linkMap]);

  // Load entities from cloud when in master mode
  useEffect(() => {
    if (!shouldAggregate || documentIds.length === 0) {
      setAggregatedPeople([]);
      setAggregatedPlaces([]);
      setAggregatedDates([]);
      setAggregatedTerms([]);
      return;
    }

    async function loadAllEntities() {
      setLoading(true);
      try {
        // Load all entity types in parallel
        const [people, places, dates, terms] = await Promise.all([
          loadEntitiesForDocuments<Person>(documentIds, 'person'),
          loadEntitiesForDocuments<Place>(documentIds, 'place'),
          loadEntitiesForDocuments<TaggedDate>(documentIds, 'date'),
          loadEntitiesForDocuments<DefinedTerm>(documentIds, 'term'),
        ]);

        // Process people with deduplication
        const seenPeopleNames = new Set<string>();
        const processedPeople: AggregatedPerson[] = [];
        for (const person of people) {
          if (!person || !person.name) continue;
          const normalizedName = person.name.toLowerCase();
          if (!seenPeopleNames.has(normalizedName)) {
            seenPeopleNames.add(normalizedName);
            processedPeople.push({
              ...person,
              sourceDocTitle: linkMap.get(person.sourceDocId) || 'Unknown',
            });
          }
        }
        setAggregatedPeople(processedPeople);

        // Process places with deduplication
        const seenPlaceNames = new Set<string>();
        const processedPlaces: AggregatedPlace[] = [];
        for (const place of places) {
          if (!place || !place.name) continue;
          const normalizedName = place.name.toLowerCase();
          if (!seenPlaceNames.has(normalizedName)) {
            seenPlaceNames.add(normalizedName);
            processedPlaces.push({
              ...place,
              sourceDocTitle: linkMap.get(place.sourceDocId) || 'Unknown',
            });
          }
        }
        setAggregatedPlaces(processedPlaces);

        // Process dates with deduplication and sorting
        const seenDateTexts = new Set<string>();
        const processedDates: AggregatedDate[] = [];
        for (const date of dates) {
          if (!date || !date.rawText) continue;
          const key = date.rawText.toLowerCase();
          if (!seenDateTexts.has(key)) {
            seenDateTexts.add(key);
            processedDates.push({
              ...date,
              // Ensure date is a Date object
              date: date.date instanceof Date ? date.date : new Date(date.date as unknown as string),
              sourceDocTitle: linkMap.get(date.sourceDocId) || 'Unknown',
            });
          }
        }
        // Sort by date
        processedDates.sort((a, b) => {
          const dateA = a.date instanceof Date ? a.date : new Date(a.date);
          const dateB = b.date instanceof Date ? b.date : new Date(b.date);
          return dateA.getTime() - dateB.getTime();
        });
        setAggregatedDates(processedDates);

        // Process terms with deduplication
        const seenTerms = new Set<string>();
        const processedTerms: AggregatedTerm[] = [];
        for (const term of terms) {
          if (!term || !term.term) continue;
          const key = term.term.toLowerCase();
          if (!seenTerms.has(key)) {
            seenTerms.add(key);
            processedTerms.push({
              ...term,
              sourceDocTitle: linkMap.get(term.sourceDocId) || 'Unknown',
            });
          }
        }
        setAggregatedTerms(processedTerms);

      } catch (error) {
        console.error('Failed to load aggregated entities:', error);
      } finally {
        setLoading(false);
      }
    }

    loadAllEntities();
  }, [shouldAggregate, documentIds, linkMap]);

  return {
    shouldAggregate,
    aggregatedPeople,
    aggregatedPlaces,
    aggregatedDates,
    aggregatedTerms,
    loading,
  };
}
