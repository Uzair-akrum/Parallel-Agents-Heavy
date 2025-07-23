import { createOpenAI } from '@ai-sdk/openai';
import { generateText, tool } from 'ai';
import { z } from 'zod';
import { Config } from '../types/config.js';
import { toolRegistry } from '../tools/index.js';
import { THINKING_PROMPT } from '../utils/prompts.js';

export abstract class BaseAgent {
  protected config: Config;
  protected model: any;
  protected systemPrompt: string;

  constructor(config: Config, systemPrompt?: string) {
    this.config = config;
    this.systemPrompt = systemPrompt || config.prompts.system_prompt;

    const openai = createOpenAI({
      baseURL: config.openrouter.base_url,
      apiKey: config.openrouter.api_key,
    });
    this.model = openai(config.openrouter.model);
  }

  /**
   * Main conversation method with tool support
   */
  async run(input: string, maxIterations: number = 10): Promise<string> {
    try {
      let iteration = 0;

      // Keep a full, structured history of the conversation
      const messages: Array<{ role: 'system' | 'user' | 'assistant', content: string }> = [
        {
          role: 'system',
          content: this.systemPrompt,
        },
        {
          role: 'user',
          content: input,
        },
      ];

      while (iteration < maxIterations) {
        iteration++;

        // Convert our tools to AI SDK format
        const aiTools = this.createAITools();

        const result = await generateText({
          model: this.model,
          messages,
          tools: aiTools,
          maxTokens: 2000,
          temperature: this.config.agent.temperature,
        });

        // If no tool calls were made, we're done
        if (!result.toolCalls || result.toolCalls.length === 0) {
          return result.text;
        }

        // Execute tool calls
        let toolResults = '';
        for (const toolCall of result.toolCalls) {
          const toolResult = await toolRegistry.executeTool(toolCall.toolName, toolCall.args);

          if (toolResult.success) {
            toolResults += `Tool ${toolCall.toolName} result: ${toolResult.result}\n`;
          } else {
            toolResults += `Tool ${toolCall.toolName} error: ${toolResult.error}\n`;
          }
        }

        // Continue conversation with tool results
        messages.push({ role: 'assistant', content: result.text });

        if (toolResults) {
          // Attach tool results so the model can reference them explicitly in the next turn
          messages.push({ role: 'assistant', content: `Tool Results:\n${toolResults}` });

          // Add a follow-up user prompt asking for the final answer
          messages.push({
            role: 'user',
            content: `Based on the tool results above, please provide your final answer to the question: ${input}`,
          });
        }
      }

      return `Maximum iterations (${maxIterations}) reached. The agent may need more time to complete this task.`;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return `I encountered an error while processing your request: ${errorMessage}`;
    }
  }

  /**
   * Quick response without tool support
   */
  async quickResponse(input: string): Promise<string> {
    try {
      const result = await generateText({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: this.systemPrompt
          },
          {
            role: 'user',
            content: input
          }
        ],
        maxTokens: 1000,
        temperature: this.config.agent.temperature,
      });

      return result.text;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return `I encountered an error: ${errorMessage}`;
    }
  }

  /**
   * Structured thinking method for planning and analysis
   */
  async think(problem: string): Promise<any> {
    const startTime = Date.now();
    console.log(`🤔 [BASE AGENT] THINKING: ${problem.slice(0, 60)}...`);

    try {
      const result = await generateText({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: THINKING_PROMPT
          },
          {
            role: 'user',
            content: problem
          }
        ],
        maxTokens: 1500,
        temperature: 0.3, // Lower temperature for more structured thinking
      });

      const duration = Date.now() - startTime;
      const tokenCount = this.countTokens(result.text);
      console.log(`💡 [BASE AGENT] Thinking completed in ${duration}ms (${tokenCount} tokens)`);

      // Try to parse JSON response
      try {
        const jsonMatch = result.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          console.log(`✅ [BASE AGENT] Successfully parsed structured response`);
          return parsed;
        }
      } catch (parseError) {
        // If JSON parsing fails, return the raw text
        console.warn(`⚠️  [BASE AGENT] Failed to parse thinking response as JSON, returning raw text`);
      }

      return { analysis: result.text };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error(`❌ [BASE AGENT] Thinking failed after ${duration}ms: ${errorMessage}`);
      return { error: errorMessage };
    }
  }

  /**
   * Call LLM with custom parameters
   */
  protected async _callLLM(
    messages: Array<{ role: 'system' | 'user' | 'assistant', content: string }>,
    options: {
      maxTokens?: number;
      temperature?: number;
      tools?: boolean;
    } = {}
  ): Promise<{ text: string; toolCalls?: any[] }> {
    const {
      maxTokens = 1500,
      temperature = this.config.agent.temperature,
      tools = false
    } = options;

    const startTime = Date.now();
    const inputTokens = messages.reduce((sum, msg) => sum + this.countTokens(msg.content), 0);

    console.log(`🤖 [BASE AGENT] LLM CALL:`);
    console.log(`   - Messages: ${messages.length}`);
    console.log(`   - Input tokens: ~${inputTokens}`);
    console.log(`   - Max tokens: ${maxTokens}`);
    console.log(`   - Temperature: ${temperature}`);
    console.log(`   - Tools enabled: ${tools ? '✅' : '❌'}`);

    const generateOptions: any = {
      model: this.model,
      messages,
      maxTokens,
      temperature,
    };

    if (tools) {
      generateOptions.tools = this.createAITools();
    }

    try {
      const result = await generateText(generateOptions);

      const duration = Date.now() - startTime;
      const outputTokens = this.countTokens(result.text);
      const totalTokens = inputTokens + outputTokens;

      console.log(`✅ [BASE AGENT] LLM response received in ${duration}ms:`);
      console.log(`   - Output tokens: ~${outputTokens}`);
      console.log(`   - Total tokens: ~${totalTokens}`);
      console.log(`   - Tool calls: ${result.toolCalls ? result.toolCalls.length : 0}`);
      console.log(`   - Response preview: ${result.text.slice(0, 100)}...`);

      return {
        text: result.text,
        toolCalls: result.toolCalls
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ [BASE AGENT] LLM call failed after ${duration}ms: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Count tokens in text (approximation)
   */
  protected countTokens(text: string): number {
    // Rough approximation: 1 token ≈ 4 characters for English
    return Math.ceil(text.length / 4);
  }

  /**
   * Create AI SDK compatible tools
   */
  private createAITools() {
    const tools: Record<string, any> = {};

    // Add calculator tool
    tools.calculate = tool({
      description: 'Perform mathematical calculations safely',
      parameters: z.object({
        expression: z.string().describe('Mathematical expression to evaluate')
      }),
      execute: async ({ expression }: { expression: string }) => {
        const result = await toolRegistry.executeTool('calculate', { expression });
        return result.success ? result.result : result.error;
      }
    });

    // Add search tool
    tools.search = tool({
      description: 'Search the web using Brave Search API',
      parameters: z.object({
        query: z.string().describe('Search query to execute'),
        max_results: z.number().optional().describe('Maximum number of results (default: 5)')
      }),
      execute: async ({ query, max_results }: { query: string, max_results?: number | undefined }) => {
        const result = await toolRegistry.executeTool('search', { query, max_results });
        return result.success ? result.result : result.error;
      }
    });

    // Add file reading tool
    tools.read_file = tool({
      description: 'Read the contents of a text file',
      parameters: z.object({
        file_path: z.string().describe('Path to the file to read')
      }),
      execute: async ({ file_path }: { file_path: string }) => {
        const result = await toolRegistry.executeTool('read_file', { file_path });
        return result.success ? result.result : result.error;
      }
    });

    // Add file writing tool
    tools.write_file = tool({
      description: 'Write content to a text file',
      parameters: z.object({
        file_path: z.string().describe('Path to the file to write'),
        content: z.string().describe('Content to write to the file')
      }),
      execute: async ({ file_path, content }: { file_path: string, content: string }) => {
        const result = await toolRegistry.executeTool('write_file', { file_path, content });
        return result.success ? result.result : result.error;
      }
    });

    return tools;
  }
} 