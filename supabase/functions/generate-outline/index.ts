import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, context } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('Generating outline for prompt:', prompt);
    console.log('Context provided:', context ? 'yes' : 'no');

    const systemPrompt = `You are a legal document drafting assistant that generates structured outline content.

Your output must be a JSON array of outline items. Each item has:
- "label": The text content (use plain, modern language - avoid archaic legalisms like "hereto", "heretofore", "witnesseth")
- "depth": The nesting level (0 = top level, 1 = first indent, 2 = second indent, etc.)

Rules:
1. Generate clear, actionable legal/contract language
2. Use proper hierarchy - main clauses at depth 0, subclauses at depth 1, etc.
3. Keep each item focused on one concept
4. Use defined terms in quotes when introducing them (e.g., the "Parties", the "Agreement")
5. Be concise but complete

Example output for "draft a confidentiality clause":
[
  {"label": "Confidentiality", "depth": 0},
  {"label": "The Receiving Party agrees to hold in strict confidence all Confidential Information disclosed by the Disclosing Party.", "depth": 1},
  {"label": "\"Confidential Information\" means any non-public information disclosed by either Party, including:", "depth": 1},
  {"label": "Trade secrets and proprietary data", "depth": 2},
  {"label": "Business plans and strategies", "depth": 2},
  {"label": "Customer lists and pricing information", "depth": 2},
  {"label": "The obligations under this section shall survive termination of this Agreement for a period of three (3) years.", "depth": 1}
]

Only output valid JSON. No markdown, no explanation, just the JSON array.`;

    const messages = [
      { role: 'system', content: systemPrompt },
    ];

    if (context) {
      messages.push({ 
        role: 'user', 
        content: `Current document context:\n${context}\n\nNow generate: ${prompt}` 
      });
    } else {
      messages.push({ role: 'user', content: prompt });
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted. Please add credits in Settings.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    console.log('Raw AI response:', content);

    // Parse the JSON response
    let items: Array<{ label: string; depth: number }>;
    try {
      // Clean up the response - remove markdown code blocks if present
      let cleanContent = content.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.slice(7);
      }
      if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.slice(3);
      }
      if (cleanContent.endsWith('```')) {
        cleanContent = cleanContent.slice(0, -3);
      }
      
      items = JSON.parse(cleanContent.trim());
      
      if (!Array.isArray(items)) {
        throw new Error('Response is not an array');
      }
      
      // Validate structure
      items = items.map(item => ({
        label: String(item.label || ''),
        depth: typeof item.depth === 'number' ? item.depth : 0,
      }));
      
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      // Fallback: treat as single item
      items = [{ label: content, depth: 0 }];
    }

    console.log('Parsed items:', items.length);

    return new Response(JSON.stringify({ items }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-outline:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
