// Healthcare Tool Executor with Claude Integration

import { lookupICD10 } from './icd10.ts';
import { verifyNPI } from './npi.ts';
import { checkDrugInteraction } from './rxnorm.ts';
import { searchPubMed } from './pubmed.ts';
import { HEALTHCARE_TOOLS, HEALTHCARE_SYSTEM_PROMPT, TASK_PROMPTS } from './index.ts';

const MAX_TOOL_ITERATIONS = 5;

export interface ToolResult {
  tool: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
}

export interface Citation {
  index: number;
  source_type: string;
  url?: string;
  title?: string;
  authors?: string;
  date?: string;
}

export interface ExecutionResult {
  content: string;
  tool_results: ToolResult[];
  citations: Citation[];
  model: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

// Execute a single tool
async function executeTool(toolName: string, toolInput: Record<string, unknown>): Promise<Record<string, unknown>> {
  switch (toolName) {
    case 'lookup_icd10':
      return await lookupICD10(toolInput as any);
    case 'verify_npi':
      return await verifyNPI(toolInput as any);
    case 'check_drug_interaction':
      return await checkDrugInteraction(toolInput as any);
    case 'search_pubmed':
      return await searchPubMed(toolInput as any);
    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

// Extract citations from tool results
function extractCitations(toolResults: ToolResult[]): Citation[] {
  const citations: Citation[] = [];
  let index = 1;

  for (const result of toolResults) {
    const output = result.output as any;

    // ICD-10 results
    if (result.tool === 'lookup_icd10' && output.results) {
      citations.push({
        index: index++,
        source_type: 'icd10',
        url: output.source_url,
        title: `ICD-10 Code Lookup: ${output.count} results`,
      });
    }

    // NPI results
    if (result.tool === 'verify_npi' && output.results) {
      for (const provider of output.results.slice(0, 3)) {
        citations.push({
          index: index++,
          source_type: 'npi',
          url: output.source_url,
          title: `NPI: ${provider.npi} - ${provider.name}`,
        });
      }
    }

    // PubMed results
    if (result.tool === 'search_pubmed' && output.results) {
      for (const article of output.results) {
        citations.push({
          index: index++,
          source_type: 'pubmed',
          url: article.url,
          title: article.title,
          authors: article.authors,
          date: article.year,
        });
      }
    }

    // Drug interaction results
    if (result.tool === 'check_drug_interaction') {
      if (output.interactions?.length > 0) {
        citations.push({
          index: index++,
          source_type: 'rxnorm',
          url: output.source_url,
          title: `Drug Interactions: ${output.count} found`,
        });
      }
    }
  }

  return citations;
}

// Get model based on task type
function getModel(taskType: string): string {
  const complexTasks = ['prior_auth_review', 'claims_appeal', 'clinical_documentation', 'care_coordination'];
  if (complexTasks.includes(taskType)) {
    return 'claude-opus-4-20250514';
  }
  return 'claude-sonnet-4-20250514';
}

// Build system prompt
function buildSystemPrompt(taskType: string): string {
  const taskAddition = TASK_PROMPTS[taskType] || TASK_PROMPTS['general_query'];
  return `${HEALTHCARE_SYSTEM_PROMPT}\n\n## CURRENT TASK\n${taskAddition}`;
}

// Main execution function
export async function executeHealthcareQuery(params: {
  query: string;
  task_type: string;
  context_chunks?: string[];
  anthropic_api_key: string;
}): Promise<ExecutionResult> {
  const { query, task_type, context_chunks, anthropic_api_key } = params;

  const model = getModel(task_type);
  const systemPrompt = buildSystemPrompt(task_type);
  const toolResults: ToolResult[] = [];

  // Build user message
  let userContent = query;
  if (context_chunks && context_chunks.length > 0) {
    userContent = `## CONTEXT FROM DOCUMENTS\n${context_chunks.join('\n\n---\n\n')}\n\n## USER QUERY\n${query}`;
  }

  const messages: Array<{ role: string; content: any }> = [
    { role: 'user', content: userContent }
  ];

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let finalContent = '';

  // Tool use loop
  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropic_api_key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: systemPrompt,
        tools: HEALTHCARE_TOOLS,
        messages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Claude API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    totalInputTokens += data.usage?.input_tokens || 0;
    totalOutputTokens += data.usage?.output_tokens || 0;

    // Process response content
    const assistantContent: any[] = [];
    let hasToolUse = false;

    for (const block of data.content || []) {
      if (block.type === 'text') {
        finalContent = block.text;
        assistantContent.push(block);
      } else if (block.type === 'tool_use') {
        hasToolUse = true;
        assistantContent.push(block);

        // Execute the tool
        const toolOutput = await executeTool(block.name, block.input);
        toolResults.push({
          tool: block.name,
          input: block.input,
          output: toolOutput,
        });

        // Add tool result to messages
        messages.push({ role: 'assistant', content: assistantContent });
        messages.push({
          role: 'user',
          content: [{
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(toolOutput),
          }],
        });
      }
    }

    // If no tool use, we're done
    if (!hasToolUse || data.stop_reason === 'end_turn') {
      break;
    }
  }

  // Extract citations from tool results
  const citations = extractCitations(toolResults);

  return {
    content: finalContent,
    tool_results: toolResults,
    citations,
    model,
    usage: {
      input_tokens: totalInputTokens,
      output_tokens: totalOutputTokens,
    },
  };
}
