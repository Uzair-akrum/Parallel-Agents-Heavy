import { BaseTool } from '../types/tool.js';
import { CalculatorTool } from './calculator.js';
import { SearchTool } from './search.js';
import { ReadFileTool, WriteFileTool } from './file.js';

export class ToolRegistry {
  private tools: Map<string, BaseTool> = new Map();

  constructor() {
    this.registerDefaultTools();
  }

  private registerDefaultTools(): void {
    const defaultTools = [
      new CalculatorTool(),
      new SearchTool(),
      new ReadFileTool(),
      new WriteFileTool()
    ];

    for (const tool of defaultTools) {
      this.registerTool(tool);
    }
  }

  registerTool(tool: BaseTool): void {
    this.tools.set(tool.name, tool);
  }

  getTool(name: string): BaseTool | undefined {
    return this.tools.get(name);
  }

  getAllTools(): BaseTool[] {
    return Array.from(this.tools.values());
  }

  getToolSchemas() {
    return this.getAllTools().map(tool => tool.getSchema());
  }

  async executeTool(name: string, params: Record<string, any>) {
    const tool = this.getTool(name);

    if (!tool) {
      return {
        success: false,
        result: '',
        error: `Tool '${name}' not found`
      };
    }

    return await tool.execute(params);
  }

  listAvailableTools(): string {
    const tools = this.getAllTools();

    if (tools.length === 0) {
      return 'No tools available.';
    }

    const toolList = tools.map(tool =>
      `- **${tool.name}**: ${tool.description}`
    ).join('\n');

    return `Available tools:\n${toolList}`;
  }
}

// Export a singleton instance
export const toolRegistry = new ToolRegistry(); 