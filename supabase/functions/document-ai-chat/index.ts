import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface DocumentAIChatRequest {
  messages: Message[];
  documentTitle?: string;
  documentContext?: string;
  existingCitations?: Record<string, string>;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: DocumentAIChatRequest = await req.json();
    const { messages, documentTitle, documentContext, existingCitations } = body;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build system prompt for document-level AI assistance
    const systemPrompt = `You are a helpful document assistant for "${documentTitle || 'this document'}".

${documentContext ? `Document content/context:\n${documentContext}\n\n` : ''}${existingCitations && Object.keys(existingCitations).length > 0 ? `Existing citation definitions:\n${JSON.stringify(existingCitations, null, 2)}\n\n` : ''}Your role is to help the user with their document. You can:
- Answer questions about the document's content
- Suggest improvements to structure or writing
- Help summarize or analyze sections
- Provide information related to the document's topic
- **Create, update, or redo footnotes/citations using the update_citations tool**

When the user asks you to "redo", "create", "update", or "fix" footnotes/citations:
1. Scan the document content for citation markers like [1], [2], [3], etc.
2. Generate appropriate bibliographic references based on the document's topic and context
3. Use the update_citations tool to apply the changes directly

**CRITICAL INSTRUCTIONS FOR update_citations TOOL:**
- The citations object keys MUST be EXACTLY the marker strings: "[1]", "[2]", "[3]", etc.
- Do NOT add quotes, extra text, or any other characters to the keys
- Do NOT use formats like: "_1", "1", "'[1]'", "[1] some text", or any non-English text in keys
- ONLY use keys that match markers actually found in the document
- Example of CORRECT format: { "[1]": "Author Name. Book Title. Publisher, Year.", "[2]": "..." }
- Example of WRONG format: { "'[1]'": "...", "_1": "...", "[1] citation": "..." }

Be concise, helpful, and reference specific parts of the document when relevant.`;

    // Define the tool for updating citations
    const tools = [
      {
        type: "function",
        function: {
          name: "update_citations",
          description: "Update or create citation definitions for the document's End Notes. Use this when the user asks to redo, create, update, or fix footnotes/citations.",
          parameters: {
            type: "object",
            properties: {
              citations: {
                type: "object",
                description: "A mapping of citation markers (e.g., '[1]', '[2]') to their full bibliographic text",
                additionalProperties: {
                  type: "string"
                }
              },
              summary: {
                type: "string",
                description: "A brief summary of what changes were made to the citations"
              }
            },
            required: ["citations", "summary"]
          }
        }
      }
    ];

    // Prepare messages for the API
    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.filter(m => m.role !== 'system'),
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: apiMessages,
        tools,
        temperature: 0.7,
        max_tokens: 2000,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    // Stream the response back to the client
    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    console.error("document-ai-chat error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error occurred" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});