import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExtractedEntities {
  people: Array<{ name: string; role?: string }>;
  places: Array<{ name: string; significance?: string }>;
  dates: Array<{ rawText: string; description?: string }>;
  terms: Array<{ term: string; definition: string }>;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { content } = await req.json();

    if (!content || typeof content !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Content is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Truncate content if too long (approx 8000 tokens ~ 32000 chars)
    const truncatedContent = content.length > 32000 ? content.slice(0, 32000) + '...' : content;

    const systemPrompt = `You are an expert legal document analyst. Your task is to extract entities from document content.

Analyze the provided text and identify:
1. **People**: Named individuals mentioned in the document. Extract their full name as written and any role/title if mentioned nearby.
2. **Places**: Specific locations, addresses, venues, jurisdictions, or geographic references.
3. **Dates**: Explicit dates, time periods, deadlines, or temporal references. Extract the exact text as written.
4. **Terms**: Defined terms that appear in quotes or are explicitly defined. These are typically legal or technical terms with specific meanings in the document.

Important guidelines:
- Only extract entities that are clearly identifiable in the text
- For people, use the full name as it appears (e.g., "John Smith", not just "John")
- For dates, capture the exact text (e.g., "January 15, 2024", "within 30 days", "the Effective Date")
- For terms, look for patterns like "the 'Term'" or "Term means..." or quoted phrases that are defined
- Do not invent or assume entities that aren't in the text
- Deduplicate - if the same entity appears multiple times, include it only once`;

    const userPrompt = `Extract all entities from this document content:

${truncatedContent}`;

    console.log('Calling AI gateway for entity detection...');
    console.log('Content length:', content.length, 'chars');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'extract_entities',
              description: 'Extract and return all identified entities from the document',
              parameters: {
                type: 'object',
                properties: {
                  people: {
                    type: 'array',
                    description: 'Named individuals found in the document',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string', description: 'Full name as it appears in the document' },
                        role: { type: 'string', description: 'Role, title, or relationship if mentioned' }
                      },
                      required: ['name'],
                      additionalProperties: false
                    }
                  },
                  places: {
                    type: 'array',
                    description: 'Locations, addresses, venues, or jurisdictions',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string', description: 'Place name or address as written' },
                        significance: { type: 'string', description: 'Why this place is mentioned' }
                      },
                      required: ['name'],
                      additionalProperties: false
                    }
                  },
                  dates: {
                    type: 'array',
                    description: 'Dates, deadlines, or time periods',
                    items: {
                      type: 'object',
                      properties: {
                        rawText: { type: 'string', description: 'The date text exactly as it appears' },
                        description: { type: 'string', description: 'What this date refers to' }
                      },
                      required: ['rawText'],
                      additionalProperties: false
                    }
                  },
                  terms: {
                    type: 'array',
                    description: 'Defined terms with their definitions',
                    items: {
                      type: 'object',
                      properties: {
                        term: { type: 'string', description: 'The term being defined' },
                        definition: { type: 'string', description: 'The definition or meaning' }
                      },
                      required: ['term', 'definition'],
                      additionalProperties: false
                    }
                  }
                },
                required: ['people', 'places', 'dates', 'terms'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'extract_entities' } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'AI service error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('AI response received');

    // Extract the tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== 'extract_entities') {
      console.error('Unexpected response format:', JSON.stringify(data));
      return new Response(
        JSON.stringify({ error: 'Invalid AI response format' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let entities: ExtractedEntities;
    try {
      entities = JSON.parse(toolCall.function.arguments);
    } catch (parseError) {
      console.error('Failed to parse tool arguments:', toolCall.function.arguments);
      return new Response(
        JSON.stringify({ error: 'Failed to parse AI response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate and clean up the response
    const cleanedEntities: ExtractedEntities = {
      people: (entities.people || []).filter(p => p.name && p.name.trim()),
      places: (entities.places || []).filter(p => p.name && p.name.trim()),
      dates: (entities.dates || []).filter(d => d.rawText && d.rawText.trim()),
      terms: (entities.terms || []).filter(t => t.term && t.term.trim() && t.definition)
    };

    console.log('Extracted entities:', {
      people: cleanedEntities.people.length,
      places: cleanedEntities.places.length,
      dates: cleanedEntities.dates.length,
      terms: cleanedEntities.terms.length
    });

    return new Response(
      JSON.stringify({ entities: cleanedEntities }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('detect-entities error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
