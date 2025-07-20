import { createOpenAI } from '@ai-sdk/openai';
import { generateText, tool } from 'ai';
import { z } from 'zod';
import { Config } from './types/config.js';
import { toolRegistry } from './tools/index.js';
import { AgentResponse } from './types/tool.js';

export class Agent {
  private config: Config;
  private model: any;

  constructor(config: Config) {
    this.config = config;
    const openai = createOpenAI({
      baseURL: config.openrouter.base_url,
      apiKey: config.openrouter.api_key,
    });
    this.model = openai(config.openrouter.model);
  }

  async run(input: string, maxIterations: number = 10): Promise<string> {
    try {
      let iteration = 0;

      // Keep a full, structured history of the conversation
      const messages: Array<{ role: 'system' | 'user' | 'assistant', content: string }> = [
        {
          role: 'system',
          content: this.config.prompts.system_prompt,
        },
        {
          role: 'user',
          content: input,
        },
      ];

      while (iteration < maxIterations) {
        iteration++;

        const currentInput = messages[messages.length - 1]?.content ?? input;

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
      description: 'Search the web using DuckDuckGo',
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

  async quickResponse(input: string): Promise<string> {
    try {
      const result = await generateText({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: this.config.prompts.system_prompt
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
} 