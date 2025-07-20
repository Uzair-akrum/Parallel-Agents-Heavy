export interface ToolSchema {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, {
      type: string;
      description: string;
      required?: boolean;
    }>;
    required?: string[];
  };
}

export interface ToolResult {
  success: boolean;
  result: string;
  error?: string;
}

export abstract class BaseTool {
  abstract name: string;
  abstract description: string;
  abstract schema: ToolSchema;

  abstract execute(params: Record<string, any>): Promise<ToolResult>;

  getSchema(): ToolSchema {
    return this.schema;
  }
}

export interface AgentToolCall {
  id: string;
  name: string;
  parameters: Record<string, any>;
}

export interface AgentResponse {
  content: string;
  toolCalls?: AgentToolCall[];
  finished: boolean;
} 