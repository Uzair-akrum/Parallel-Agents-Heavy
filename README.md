# Make It Heavy - TypeScript Multi-Agent AI System

A powerful TypeScript implementation of the "Make It Heavy" multi-agent AI system, converted from Python with modern tooling and type safety.

## 🚀 Features

- **🤖 Single Agent Mode**: Fast, direct AI interactions for simple queries
- **🎭 Multi-Agent Mode**: Complex query processing with parallel specialized agents
- **🔧 Tool System**: Extensible tool ecosystem with calculator, search, and file operations
- **⚡ TypeScript**: Full type safety and modern ES modules
- **🎯 OpenRouter Support**: Compatible with multiple AI models via OpenRouter
- **🔄 Parallel Processing**: Efficient concurrent agent execution
- **📊 Rich CLI Interface**: Interactive prompts with helpful commands

## 🎯 Quick Start for Code Translation Tasks

**🚨 Having trouble with multiline input?** Run the setup script first:

```bash
./setup-input.sh
```

This fixes the common UX issue where only the first line of code gets captured. Choose:
- **Editor Mode** (recommended): Opens VS Code/editor for pasting code blocks
- **Terminal Mode** (improved): Paste in terminal, press Enter twice to finish  
- **Single Line Mode**: For quick one-line questions

## 📦 Installation

### 1. Clone and Setup
```bash
git clone <repository-url>
cd make-it-heavy-ts
npm install
```

### 2. Install Dependencies
```bash
# Install all required packages
npm install @langchain/core @langchain/openai @langchain/community @ai-sdk/openai ai js-yaml cheerio axios mathjs enquirer zod

# Install development dependencies
npm install --save-dev typescript ts-node @types/node @types/js-yaml
```

### 3. Configuration

Edit `config.yaml` with your API credentials:

```yaml
openrouter:
  api_key: "your-openrouter-api-key-here"  # Get from https://openrouter.ai
  base_url: "https://openrouter.ai/api/v1"
  model: "anthropic/claude-3.5-sonnet:beta"

agent:
  max_iterations: 10
  max_execution_time: 300
  temperature: 0.7

orchestrator:
  max_agents: 5
  synthesis_model: "anthropic/claude-3.5-sonnet:beta"
```

## 🎯 Usage

### Single Agent Mode
For quick questions and simple tasks:
```bash
npm run dev
```

Example interactions:
- "What's the square root of 144?"
- "Search for the latest TypeScript features"
- "Read the contents of package.json"

### Multi-Agent Mode
For complex queries requiring research and analysis:
```bash
npm run dev:heavy
```

Example complex queries:
- "Compare Python, TypeScript, and Rust for web API development"
- "Analyze renewable energy trends and market opportunities"
- "Create a comprehensive machine learning study plan"

## 🔧 Available Tools

| Tool | Description | Example Usage |
|------|-------------|---------------|
| **Calculator** | Safe mathematical evaluation | "Calculate compound interest: (1000 * (1 + 0.05)^10)" |
| **Search** | Web search via DuckDuckGo | "Search for TypeScript best practices 2024" |
| **Read File** | Read local text files | "Read the contents of README.md" |
| **Write File** | Write to local text files | "Create a file called notes.txt with my ideas" |

## 🏗️ Architecture

```
make-it-heavy-ts/
├── types/                 # TypeScript interfaces
│   ├── config.ts         # Configuration types
│   └── tool.ts           # Tool system types
├── utils/                # Utility functions
│   └── config.ts         # Config loading
├── tools/                # Tool implementations
│   ├── calculator.ts     # Math operations
│   ├── search.ts         # Web search
│   ├── file.ts           # File operations
│   └── index.ts          # Tool registry
├── agent.ts              # Core AI agent
├── orchestrator.ts       # Multi-agent coordinator
├── main.ts               # Single-agent CLI
├── make_it_heavy.ts      # Multi-agent CLI
├── config.yaml           # Configuration
└── package.json          # Dependencies
```

## 🔄 How Multi-Agent Mode Works

1. **📋 Query Analysis**: The orchestrator breaks complex questions into focused sub-tasks
2. **🚀 Parallel Processing**: Multiple agents work on sub-tasks simultaneously
3. **🔄 Synthesis**: Results are combined into a comprehensive final answer

```mermaid
graph TD
    A[Complex Query] --> B[Orchestrator]
    B --> C[Sub-task 1]
    B --> D[Sub-task 2] 
    B --> E[Sub-task 3]
    C --> F[Agent 1]
    D --> G[Agent 2]
    E --> H[Agent 3]
    F --> I[Synthesis Agent]
    G --> I
    H --> I
    I --> J[Final Answer]
```

## ⚙️ Development

### Build
```bash
npm run build
```

### Production
```bash
npm start          # Single-agent mode
npm start:heavy    # Multi-agent mode
```

### Development with Hot Reload
```bash
npm run dev        # Single-agent mode
npm run dev:heavy  # Multi-agent mode
```

## 🔧 Configuration Options

### CLI Input Settings
Configure how the CLI handles user input to solve issues with incomplete input or limited input areas:

```yaml
input:
  type: "text"                    # Input type: 'input', 'text', 'editor'
  max_length: 10000              # Maximum characters allowed
  multiline: true                # Enable multi-line input
  editor_command: "nano"         # Editor for 'editor' type
```

#### Input Types:
- **`input`** (default): Single-line input, suitable for short queries
- **`text`**: Multi-line input with Ctrl+D to finish, ideal for longer questions
- **`editor`**: Opens external editor (nano, vim, code, etc.) for complex inputs

#### Recommended Settings:
- For **short queries**: `type: "input"`, `multiline: false`
- For **longer questions**: `type: "text"`, `multiline: true`  
- For **very long inputs**: `type: "editor"`, `editor_command: "code"` (or your preferred editor)

### OpenRouter Models
Popular model options:
- `anthropic/claude-3.5-sonnet:beta` (Recommended)
- `openai/gpt-4-turbo`
- `google/gemini-pro-1.5`
- `meta-llama/llama-3.1-70b-instruct`

### Agent Settings
- `max_iterations`: Maximum tool-use loops (default: 10)
- `max_execution_time`: Timeout in seconds (default: 300)
- `temperature`: Response randomness 0-1 (default: 0.7)

### Orchestrator Settings
- `max_agents`: Maximum parallel agents (default: 5)
- `synthesis_model`: Model for final synthesis

## 🛠️ Adding Custom Tools

1. Create a new tool class extending `BaseTool`:

```typescript
// tools/my-tool.ts
import { BaseTool, ToolSchema, ToolResult } from '../types/tool.js';

export class MyCustomTool extends BaseTool {
  name = 'my_tool';
  description = 'Description of what this tool does';
  
  schema: ToolSchema = {
    name: 'my_tool',
    description: this.description,
    parameters: {
      type: 'object',
      properties: {
        input: {
          type: 'string',
          description: 'Input parameter description',
        }
      },
      required: ['input']
    }
  };

  async execute(params: Record<string, any>): Promise<ToolResult> {
    const { input } = params;
    
    try {
      // Tool logic here
      const result = `Processed: ${input}`;
      
      return {
        success: true,
        result
      };
    } catch (error) {
      return {
        success: false,
        result: '',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
```

2. Register it in `tools/index.ts`:

```typescript
import { MyCustomTool } from './my-tool.js';

// In registerDefaultTools():
new MyCustomTool(),
```

3. Add to agent tools in `agent.ts`:

```typescript
// In createAITools():
tools.my_tool = tool({
  description: 'Description of my tool',
  parameters: z.object({
    input: z.string().describe('Input description')
  }),
  execute: async ({ input }) => {
    const result = await toolRegistry.executeTool('my_tool', { input });
    return result.success ? result.result : result.error;
  }
});
```

## 🚨 Troubleshooting

### Common Issues

1. **"Module not found" errors**:
   ```bash
   npm install
   ```

2. **"API key not set" error**:
   - Update `config.yaml` with your OpenRouter API key
   - Get free API key at https://openrouter.ai

3. **Search tool not working**:
   - Check internet connection
   - Some websites may block automated requests

4. **Agent loops/timeouts**:
   - Reduce `max_iterations` in config
   - Increase `max_execution_time` for complex queries

### Debug Mode
Enable verbose logging by setting environment variable:
```bash
DEBUG=true npm run dev
```

## 📚 Examples

### Single Agent Examples
```bash
# Calculator
"What's 15% of $2,450?"

# Search
"Find recent news about TypeScript 5.0"

# File Operations
"Read my package.json and summarize the dependencies"
"Create a TODO list file with 5 items for my project"
```

### Multi-Agent Examples
```bash
# Research Analysis
"Compare the top 3 JavaScript frameworks for 2024, including performance benchmarks, learning curves, and job market demand"

# Business Strategy
"I want to start an AI consulting business. Research the market, identify niches, suggest services, and create a pricing strategy"

# Technical Planning
"Plan a migration from React to Next.js for a large e-commerce site, including timeline, risks, and best practices"
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add your improvements
4. Ensure TypeScript compilation passes
5. Submit a pull request

## 📝 License

MIT License - see LICENSE file for details

## 🔗 Related Projects

- **Python Original**: [make-it-heavy-python]
- **LangChain.js**: https://langchain.com
- **OpenRouter**: https://openrouter.ai
- **Vercel AI SDK**: https://sdk.vercel.ai

---

**Made with ❤️ and TypeScript** 