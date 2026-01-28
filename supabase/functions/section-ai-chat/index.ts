import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface SectionAIChatRequest {
  operation: 'expand' | 'summarize' | 'refine' | 'chat';
  sectionLabel: string;
  sectionContent: string;
  documentContext?: string;
  userMessage?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: SectionAIChatRequest = await req.json();
    const { operation, sectionLabel, sectionContent, documentContext, userMessage } = body;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build the system prompt based on operation
    let systemPrompt = `You are an AI assistant helping to develop an outline document. 
You are working on a specific section titled "${sectionLabel}".

Current section content:
${sectionContent || '(empty section)'}

${documentContext ? `Document context:\n${documentContext}\n` : ''}

IMPORTANT: When generating outline items, respond with a JSON object containing:
1. "message": A brief explanation of what you did
2. "items": An array of outline items, each with:
   - "label": The text content of the item
   - "depth": The nesting level (0 = direct child of section, 1 = grandchild, etc.)

Example response format:
{
  "message": "I've expanded the section with detailed sub-items covering key aspects.",
  "items": [
    { "label": "First main point", "depth": 0 },
    { "label": "Supporting detail", "depth": 1 },
    { "label": "Another detail", "depth": 1 },
    { "label": "Second main point", "depth": 0 }
  ]
}

If the request doesn't require generating items (like a question), just respond with:
{
  "message": "Your response here",
  "items": []
}`;

    let userPrompt = userMessage || '';

    // Customize prompt based on operation
    switch (operation) {
      case 'expand':
        userPrompt = `Expand this section with 3-6 detailed sub-items that elaborate on the topic "${sectionLabel}". 
Each item should be concise but informative. Include nested items where appropriate for complex concepts.
${userMessage ? `\nAdditional instructions: ${userMessage}` : ''}`;
        break;
      
      case 'summarize':
        userPrompt = `Summarize the key points of this section in a clear, organized manner.
Create 2-4 outline items that capture the essential information.
${userMessage ? `\nAdditional instructions: ${userMessage}` : ''}`;
        break;
      
      case 'refine':
        userPrompt = `Review and refine the language of this section. Suggest improved versions of the existing items.
Focus on clarity, conciseness, and professional tone.
${userMessage ? `\nAdditional instructions: ${userMessage}` : ''}`;
        break;
      
      case 'chat':
      default:
        // Use the user message as-is for general chat
        if (!userPrompt) {
          userPrompt = 'What would you like to know about this section?';
        }
        break;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 1500,
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

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Try to parse as JSON
    let result: { message: string; items: Array<{ label: string; depth: number }> };
    
    try {
      // Extract JSON from the response (it might be wrapped in markdown code blocks)
      let jsonStr = content;
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }
      
      result = JSON.parse(jsonStr);
    } catch {
      // If parsing fails, treat the entire response as a message with no items
      result = {
        message: content,
        items: [],
      };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("section-ai-chat error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error occurred" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
