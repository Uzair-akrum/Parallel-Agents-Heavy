import * as fs from 'fs/promises';
import * as path from 'path';
import { BaseTool, ToolSchema, ToolResult } from '../types/tool.js';

export class ReadFileTool extends BaseTool {
  name = 'read_file';
  description = 'Read the contents of a text file.';

  schema: ToolSchema = {
    name: 'read_file',
    description: this.description,
    parameters: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'Path to the file to read',
        }
      },
      required: ['file_path']
    }
  };

  async execute(params: Record<string, any>): Promise<ToolResult> {
    try {
      const { file_path } = params;

      if (!file_path || typeof file_path !== 'string') {
        return {
          success: false,
          result: '',
          error: 'file_path parameter is required and must be a string'
        };
      }

      // Security check - prevent reading files outside current directory
      const resolvedPath = path.resolve(file_path);
      const currentDir = process.cwd();

      if (!resolvedPath.startsWith(currentDir)) {
        return {
          success: false,
          result: '',
          error: 'Access denied: Cannot read files outside current directory'
        };
      }

      const content = await fs.readFile(file_path, 'utf-8');

      return {
        success: true,
        result: `File contents of ${file_path}:\n\n${content}`
      };
    } catch (error) {
      return {
        success: false,
        result: '',
        error: `File read error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

export class WriteFileTool extends BaseTool {
  name = 'write_file';
  description = 'Write content to a text file.';

  schema: ToolSchema = {
    name: 'write_file',
    description: this.description,
    parameters: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'Path to the file to write',
        },
        content: {
          type: 'string',
          description: 'Content to write to the file',
        }
      },
      required: ['file_path', 'content']
    }
  };

  async execute(params: Record<string, any>): Promise<ToolResult> {
    try {
      const { file_path, content } = params;

      if (!file_path || typeof file_path !== 'string') {
        return {
          success: false,
          result: '',
          error: 'file_path parameter is required and must be a string'
        };
      }

      if (content === undefined || typeof content !== 'string') {
        return {
          success: false,
          result: '',
          error: 'content parameter is required and must be a string'
        };
      }

      // Security check - prevent writing files outside current directory
      const resolvedPath = path.resolve(file_path);
      const currentDir = process.cwd();

      if (!resolvedPath.startsWith(currentDir)) {
        return {
          success: false,
          result: '',
          error: 'Access denied: Cannot write files outside current directory'
        };
      }

      // Ensure directory exists
      const dir = path.dirname(file_path);
      await fs.mkdir(dir, { recursive: true });

      await fs.writeFile(file_path, content, 'utf-8');

      return {
        success: true,
        result: `Successfully wrote ${content.length} characters to ${file_path}`
      };
    } catch (error) {
      return {
        success: false,
        result: '',
        error: `File write error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
} 