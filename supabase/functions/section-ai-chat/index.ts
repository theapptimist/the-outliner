import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface SectionInfo {
  id: string;
  title: string;
}

interface GenerationOptions {
  includeCitations?: boolean;
  historicalDetail?: boolean;
  outputFormat?: 'outline' | 'prose';
  includeEndNotes?: boolean;
  includeTableOfContents?: boolean;
}

interface SectionAIChatRequest {
  operation: 'expand' | 'summarize' | 'refine' | 'chat' | 'plan-document';
  sectionLabel: string;
  sectionContent: string;
  documentContext?: string;
  userMessage?: string;
  // For plan-document operation
  sectionList?: SectionInfo[];
  // Generation options
  generationOptions?: GenerationOptions;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: SectionAIChatRequest = await req.json();
    const { operation, sectionLabel, sectionContent, documentContext, userMessage, sectionList, generationOptions } = body;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    let systemPrompt: string;
    let userPrompt: string = userMessage || '';

    // Handle plan-document operation specially
    if (operation === 'plan-document') {
      const sections = sectionList || [];
      
      // Determine if we need to CREATE new sections or just generate prompts for existing ones
      // Create new sections if: only 1 section exists, OR all sections are untitled
      const titledSections = sections.filter(s => s.title.trim().length > 0);
      const needsNewSections = sections.length <= 1 || titledSections.length === 0;

      if (needsNewSections) {
        // Phase 1: Generate NEW sections based on the user's topic
        systemPrompt = `You are a document structure planner. Based on the user's topic, create a comprehensive document outline with 4-7 major sections.

For each section, provide:
1. A clear, descriptive title
2. A specific AI prompt that would help generate content for that section

IMPORTANT: Respond with a JSON object in this exact format:
{
  "message": "Brief summary of the document structure you've created",
  "newSections": [
    { "title": "Introduction", "prompt": "Write an engaging introduction that..." },
    { "title": "Section Title 2", "prompt": "Explain in detail..." },
    { "title": "Section Title 3", "prompt": "Analyze the key aspects of..." }
  ]
}

Guidelines:
- Create 4-7 sections that logically structure the topic
- First section should typically be an introduction or overview
- Last section could be a conclusion, summary, or future directions
- Each prompt should be specific, actionable, and 2-4 sentences
- Prompts should guide the AI to generate structured outline content for that section`;

        userPrompt = userMessage || 'Create a document structure for this topic.';
      } else {
        // Phase 2: Generate prompts for EXISTING sections
        const sectionListText = sections
          .map((s, i) => `Section ${i + 1}: "${s.title || '(untitled)'}"`)
          .join('\n');

        systemPrompt = `You are a document planning assistant. Your job is to generate specific, actionable AI prompts for each section of a document outline.

The user will describe their document's theme or topic. Based on this, generate a tailored prompt for each section that will help expand and develop that section's content.

The document has these sections:
${sectionListText || '(No sections provided)'}

IMPORTANT: Respond with a JSON object in this exact format. Use the EXACT section numbers (1, 2, 3, etc.) as the sectionIndex:
{
  "message": "A brief summary of the plan you've created",
  "sectionPrompts": [
    {
      "sectionIndex": 1,
      "prompt": "A specific, actionable prompt for this section (2-4 sentences)"
    },
    {
      "sectionIndex": 2,
      "prompt": "A specific, actionable prompt for the second section"
    }
  ]
}

Guidelines for prompts:
- Generate a prompt for EACH section listed above
- Each prompt should be specific to that section's topic/title
- If a section has no title, infer its purpose from the document theme and its position
- Prompts should be actionable and clear
- Include suggestions for what subtopics or details to cover
- Keep prompts concise but informative (2-4 sentences each)
- The prompts will be used to guide AI expansion of each section`;

        userPrompt = userMessage || 'Generate prompts for each section based on their titles.';
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
          max_tokens: 2500,
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

      try {
        let jsonStr = content;
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          jsonStr = jsonMatch[1].trim();
        }
        
        const parsed = JSON.parse(jsonStr);
        
        // Check if this is a "new sections" response or "existing sections" response
        if (parsed.newSections && Array.isArray(parsed.newSections)) {
          // New sections response - return directly with isNew flag
          const result = {
            message: parsed.message || 'Created document structure with new sections.',
            newSections: parsed.newSections.map((ns: { title: string; prompt: string }) => ({
              title: ns.title || 'Untitled Section',
              prompt: ns.prompt || 'Expand this section with relevant details.',
              isNew: true,
            })),
          };
          
          return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } else {
          // Existing sections response - map sectionIndex back to section IDs
          const mappedPrompts = (parsed.sectionPrompts || [])
            .map((sp: { sectionIndex?: number; prompt?: string }) => {
              const idx = (sp.sectionIndex || 1) - 1; // Convert to 0-based
              const section = sections[idx];
              if (!section) return null;
              return {
                sectionId: section.id,
                sectionTitle: section.title || '(untitled)',
                prompt: sp.prompt || '',
                isNew: false,
              };
            })
            .filter(Boolean);
          
          const result = {
            message: parsed.message || 'Generated prompts for your sections.',
            sectionPrompts: mappedPrompts,
          };
          
          return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch {
        // If parsing fails, create a basic response
        const result = needsNewSections
          ? {
              message: "I couldn't generate structured sections. Please try again with a clearer topic.",
              newSections: [],
            }
          : {
              message: "I couldn't generate structured prompts. Here's what I came up with:",
              sectionPrompts: sections.map(s => ({
                sectionId: s.id,
                sectionTitle: s.title || '(untitled)',
                prompt: `Expand the "${s.title || 'this'}" section with relevant details and subtopics.`,
                isNew: false,
              })),
            };

        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Standard section operations
    
    // Build generation options instructions
    let optionsInstructions = '';
    let hasToc = false;
    let hasEndNotes = false;
    let hasCitations = false;
    
    if (generationOptions) {
      if (generationOptions.includeCitations) {
        hasCitations = true;
        optionsInstructions += `\n- CITATIONS: Include inline citations in your content. Format as [Author, Year] or [Source Name]. Place these within the text where claims are made.`;
      }
      if (generationOptions.historicalDetail) {
        optionsInstructions += `\n- HISTORICAL DETAIL: Be specific about historical actors, dates, and primary sources. Name specific people, institutions, and document references rather than speaking generally.`;
      }
      if (generationOptions.includeEndNotes) {
        hasEndNotes = true;
        optionsInstructions += `\n- END NOTES: Include numbered reference markers [1], [2], etc. in your content. At the VERY END of the items array (after all outline content), include a "References" header at depth 0 followed by the full citations at depth 1.`;
      }
      if (generationOptions.includeTableOfContents) {
        hasToc = true;
        optionsInstructions += `\n- TABLE OF CONTENTS: At the VERY BEGINNING of the items array, include a "Table of Contents" header at depth 0. Follow it with descriptive preview phrases at depth 1 that summarize what each major section will cover. Do NOT simply repeat the exact section headings—instead, write brief descriptions like "Overview of economic factors" or "Analysis of key political figures involved."`;
      }
      if (generationOptions.outputFormat === 'prose') {
        optionsInstructions += `\n- OUTPUT FORMAT: Write in flowing prose paragraphs rather than bullet points or outline format. Each item's label should be a full paragraph of text.`;
      }
    }
    
    // Build example that matches the options
    let exampleItems = `[
    { "label": "First main point", "depth": 0 },
    { "label": "Supporting detail", "depth": 1 },
    { "label": "Another detail", "depth": 1 },
    { "label": "Second main point", "depth": 0 }
  ]`;
    
    if (hasToc && hasEndNotes) {
      exampleItems = `[
    { "label": "Table of Contents", "depth": 0 },
    { "label": "Overview of the causes leading to conflict", "depth": 1 },
    { "label": "Analysis of key historical figures", "depth": 1 },
    { "label": "The lasting aftermath and consequences", "depth": 1 },
    { "label": "The Causes of the Event", "depth": 0 },
    { "label": "Economic tensions between nations [1]", "depth": 1 },
    { "label": "Political instability in the region [2]", "depth": 1 },
    { "label": "Key Figures Involved", "depth": 0 },
    { "label": "The main actors included leaders from several nations", "depth": 1 },
    { "label": "The Aftermath", "depth": 0 },
    { "label": "Long-term consequences shaped the modern world", "depth": 1 },
    { "label": "References", "depth": 0 },
    { "label": "[1] Smith, J. (1998). The History of Conflict. Oxford Press.", "depth": 1 },
    { "label": "[2] Jones, M. (2005). War and Peace. Cambridge University.", "depth": 1 }
  ]`;
    } else if (hasToc) {
      exampleItems = `[
    { "label": "Table of Contents", "depth": 0 },
    { "label": "Overview of the background and context", "depth": 1 },
    { "label": "Analysis of key events that unfolded", "depth": 1 },
    { "label": "The lasting aftermath and impact", "depth": 1 },
    { "label": "Background and Context", "depth": 0 },
    { "label": "A detailed explanation of the setting...", "depth": 1 },
    { "label": "Key Events", "depth": 0 },
    { "label": "The main events included...", "depth": 1 },
    { "label": "Aftermath", "depth": 0 },
    { "label": "The consequences were far-reaching...", "depth": 1 }
  ]`;
    } else if (hasEndNotes) {
      exampleItems = `[
    { "label": "Main point with citation [1]", "depth": 0 },
    { "label": "Supporting detail referencing source [2]", "depth": 1 },
    { "label": "Another main point", "depth": 0 },
    { "label": "References", "depth": 0 },
    { "label": "[1] Smith, J. (1998). The History of Conflict. Oxford Press.", "depth": 1 },
    { "label": "[2] Jones, M. (2005). War and Peace. Cambridge University.", "depth": 1 }
  ]`;
    } else if (hasCitations) {
      exampleItems = `[
    { "label": "The event began in 1914 [Keegan, 1998]", "depth": 0 },
    { "label": "Economic factors played a key role [Smith, 2005]", "depth": 1 }
  ]`;
    }
    
    systemPrompt = `You are an AI assistant helping to develop an outline document. 
You are working on a specific section titled "${sectionLabel}".

Current section content:
${sectionContent || '(empty section)'}

${documentContext ? `Document context:\n${documentContext}\n` : ''}
${optionsInstructions ? `\n=== REQUIRED FORMATTING ===\nYou MUST follow these instructions:${optionsInstructions}\n` : ''}
IMPORTANT: When generating outline items, respond with a JSON object containing:
1. "message": A brief explanation of what you did
2. "items": An array of outline items, each with:
   - "label": The text content of the item
   - "depth": The nesting level (0 = direct child of section, 1 = grandchild, etc.)

Example response format:
{
  "message": "I've expanded the section with detailed sub-items covering key aspects.",
  "items": ${exampleItems}
}

If the request doesn't require generating items (like a question), just respond with:
{
  "message": "Your response here",
  "items": []
}`;

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
