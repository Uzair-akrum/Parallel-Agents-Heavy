import { evaluate } from 'mathjs';
import { BaseTool, ToolSchema, ToolResult } from '../types/tool.js';

export class CalculatorTool extends BaseTool {
  name = 'calculate';
  description = 'Perform mathematical calculations safely. Supports basic arithmetic, algebra, trigonometry, and more.';

  schema: ToolSchema = {
    name: 'calculate',
    description: this.description,
    parameters: {
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          description: 'Mathematical expression to evaluate (e.g., "2 + 2", "sqrt(16)", "sin(pi/2)")',
        }
      },
      required: ['expression']
    }
  };

  async execute(params: Record<string, any>): Promise<ToolResult> {
    try {
      const { expression } = params;

      if (!expression || typeof expression !== 'string') {
        return {
          success: false,
          result: '',
          error: 'Expression parameter is required and must be a string'
        };
      }

      // Use mathjs for safe evaluation
      const result = evaluate(expression);

      return {
        success: true,
        result: `${expression} = ${result}`
      };
    } catch (error) {
      return {
        success: false,
        result: '',
        error: `Calculation error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
} 