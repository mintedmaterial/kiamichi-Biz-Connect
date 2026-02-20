/**
 * Code Mode Cron Handler
 * 
 * Uses Code Mode to let an LLM write analysis code that runs in a sandbox.
 * This replaces sequential tool calls with a single code execution.
 */

import { createCodeTool } from '@cloudflare/codemode/ai';
import { DynamicWorkerExecutor } from '@cloudflare/codemode';
import { generateText } from 'ai';
import { Env } from './types';
import { createAnalyzerTools } from './codemode-tools';

// Simple Workers AI model wrapper for ai-sdk
function createWorkersAIModel(env: Env) {
  return {
    specificationVersion: 'v1' as const,
    provider: 'workers-ai' as const,
    modelId: '@cf/meta/llama-3.1-8b-instruct',
    
    async doGenerate(options: any) {
      const messages = options.prompt.map((p: any) => ({
        role: p.role === 'system' ? 'system' : p.role === 'user' ? 'user' : 'assistant',
        content: typeof p.content === 'string' ? p.content : p.content.map((c: any) => c.text).join('')
      }));

      const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages,
        max_tokens: 4096
      });

      return {
        text: response.response || '',
        finishReason: 'stop' as const,
        usage: {
          promptTokens: 0,
          completionTokens: 0
        },
        rawCall: { rawPrompt: messages, rawSettings: {} },
        warnings: []
      };
    }
  };
}

/**
 * Run Code Mode analysis cron
 */
export async function runCodeModeCron(env: Env): Promise<{
  success: boolean;
  processed: number;
  updated: number;
  error?: string;
}> {
  console.log('[CodeMode] Starting analysis cron...');

  try {
    // Create the executor (runs code in isolated V8 sandbox)
    const executor = new DynamicWorkerExecutor({
      loader: env.LOADER,
      timeout: 60000 // 60 second timeout
    });

    // Create tools from analyzer functions
    const tools = createAnalyzerTools(env);

    // Create the codemode tool
    const codemode = createCodeTool({
      tools,
      executor,
      description: `You are the KBC Business Analyzer. Write JavaScript code to analyze and enrich business listings.

Available functions on the codemode object:
- getBusinessesForUpdate({ limit, minCompleteness, daysStale }): Get businesses needing analysis
- analyzeCompleteness({ businessId }): Get completeness score (0-100)
- generateEnrichmentPlan({ businessId }): Get list of fields to enrich
- enrichFromWeb({ businessId, fields }): Search web for missing data
- applyUpdates({ businessId, suggestions, confidenceThreshold }): Apply high-confidence updates
- storeAnalysis({ businessId, completenessScore, suggestions }): Save analysis for review

Write an async arrow function that:
1. Gets up to 10 businesses that need analysis
2. For each business, analyze completeness
3. If score < 80, generate enrichment plan and search web
4. Apply updates with confidence >= 0.95
5. Store all analysis results
6. Return a summary object with processed count and updated count`
    });

    // Use Workers AI to generate and execute the analysis code
    const model = createWorkersAIModel(env);

    const result = await generateText({
      model: model as any,
      system: 'You write JavaScript code to automate business data analysis. Write clean, efficient code.',
      prompt: 'Analyze businesses that need enrichment. Get businesses, check completeness, enrich from web if needed, apply high-confidence updates, and return results summary.',
      tools: { codemode },
      maxSteps: 3
    });

    // Extract results from the code execution
    const toolResults = result.steps?.flatMap(s => s.toolResults || []) || [];
    const codemodeResult = toolResults.find(r => r.toolName === 'codemode');

    if (codemodeResult?.result) {
      const summary = codemodeResult.result as { processed?: number; updated?: number };
      console.log(`[CodeMode] Completed: ${summary.processed || 0} processed, ${summary.updated || 0} updated`);
      
      return {
        success: true,
        processed: summary.processed || 0,
        updated: summary.updated || 0
      };
    }

    return {
      success: true,
      processed: 0,
      updated: 0
    };

  } catch (error) {
    console.error('[CodeMode] Error:', error);
    return {
      success: false,
      processed: 0,
      updated: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
