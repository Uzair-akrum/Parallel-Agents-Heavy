import enquirer from 'enquirer';
import { Agent } from './agent.js';
import { loadConfig, validateConfig } from './utils/config.js';
import { toolRegistry } from './tools/index.js';
import { Config } from './types/config.js';

interface UserInput {
  userInput: string;
}

class SingleAgentCLI {
  private agent: Agent | null = null;
  private running = false;
  private config: Config | null = null;

  async initialize(): Promise<void> {
    try {
      console.log('🚀 Make It Heavy - Single Agent Mode');
      console.log('=====================================');

      // Load configuration
      console.log('📁 Loading configuration...');
      this.config = await loadConfig();
      validateConfig(this.config);

      // Initialize agent
      console.log('🤖 Initializing agent...');
      this.agent = new Agent(this.config);

      console.log('✅ Initialization complete!');
      console.log(`🔧 Available tools: ${toolRegistry.getAllTools().length}`);
      console.log(`📝 Input mode: ${this.config.input.type} ${this.config.input.multiline ? '(multi-line)' : '(single-line)'}`);
      console.log(`📏 Max input length: ${this.config.input.max_length} characters`);
      console.log('💡 Type "help" for available commands, "quit" to exit\n');

    } catch (error) {
      console.error('❌ Initialization failed:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  }

  async run(): Promise<void> {
    if (!this.agent || !this.config) {
      throw new Error('Agent not initialized. Call initialize() first.');
    }

    this.running = true;

    while (this.running) {
      try {
        const userInput = await this.getUserInput();

        if (!userInput || userInput.trim().length === 0) {
          console.log('❌ Please enter a message');
          continue;
        }

        // Handle special commands
        if (this.handleSpecialCommands(userInput)) {
          continue;
        }

        // Check input length
        if (userInput.length > this.config.input.max_length) {
          console.log(`❌ Input too long (${userInput.length} characters). Maximum allowed: ${this.config.input.max_length}`);
          continue;
        }

        // Process with agent
        console.log('\n🤔 Agent is thinking...');
        const startTime = Date.now();

        const agentResponse = await this.agent.run(userInput);

        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);

        console.log(`\n🤖 Agent (${duration}s):\n${agentResponse}\n`);

      } catch (error) {
        if (error instanceof Error && error.message.includes('canceled')) {
          console.log('\n👋 Goodbye!');
          break;
        }
        console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
      }
    }
  }

  private async getUserInput(): Promise<string> {
    if (!this.config) {
      throw new Error('Config not loaded');
    }

    const inputConfig = this.config.input;

    try {
      if (inputConfig.type === 'editor') {
        return await this.getEditorInput();
      } else if (inputConfig.type === 'text' && inputConfig.multiline) {
        return await this.getMultilineInput();
      } else {
        // Single line input (original behavior)
        const response = await enquirer.prompt<UserInput>({
          type: 'input',
          name: 'userInput',
          message: '🧑 You:',
          validate: (input: string) => {
            if (input.trim().length === 0) return 'Please enter a message';
            if (input.length > inputConfig.max_length) {
              return `Input too long (${input.length}/${inputConfig.max_length} characters)`;
            }
            return true;
          }
        });
        return response.userInput.trim();
      }
    } catch (error) {
      throw error;
    }
  }

  private async getMultilineInput(): Promise<string> {
    if (!this.config) {
      throw new Error('Config not loaded');
    }

    console.log('🧑 You: (Paste your code and press Enter twice, or type "END" on a new line to finish)');

    return new Promise((resolve, reject) => {
      let input = '';
      let emptyLines = 0;

      process.stdin.setEncoding('utf8');
      process.stdin.resume();

      const onData = (chunk: string) => {
        const lines = chunk.split('\n');

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i] || '';

          // Check for END command
          if (line.trim() === 'END') {
            cleanup();
            resolve(input.trim());
            return;
          }

          // Check for double newlines (empty line after content)
          if (line.trim() === '') {
            emptyLines++;
            if (emptyLines >= 2 && input.trim().length > 0) {
              cleanup();
              resolve(input.trim());
              return;
            }
          } else {
            emptyLines = 0;
          }

          // Add line to input (except the last partial line)
          if (i < lines.length - 1) {
            input += line + '\n';
          } else if (chunk.endsWith('\n')) {
            input += line + '\n';
          } else {
            input += line;
          }
        }

        // Check length limit
        if (input.length > this.config!.input.max_length) {
          cleanup();
          reject(new Error(`Input too long (${input.length}/${this.config!.input.max_length} characters)`));
          return;
        }
      };

      const onEnd = () => {
        cleanup();
        if (input.trim().length === 0) {
          reject(new Error('Please enter a message'));
        } else {
          resolve(input.trim());
        }
      };

      const onError = (err: Error) => {
        cleanup();
        reject(err);
      };

      const cleanup = () => {
        process.stdin.removeListener('data', onData);
        process.stdin.removeListener('end', onEnd);
        process.stdin.removeListener('error', onError);
        process.stdin.pause();
      };

      process.stdin.on('data', onData);
      process.stdin.on('end', onEnd);
      process.stdin.on('error', onError);
    });
  }

  private async getEditorInput(): Promise<string> {
    if (!this.config) {
      throw new Error('Config not loaded');
    }

    const response = await enquirer.prompt<UserInput>({
      type: 'editor',
      name: 'userInput',
      message: '🧑 Opening editor for your input...',
      validate: (input: string) => {
        if (input.trim().length === 0) return 'Please enter a message';
        if (input.length > this.config!.input.max_length) {
          return `Input too long (${input.length}/${this.config!.input.max_length} characters)`;
        }
        return true;
      }
    });

    return response.userInput.trim();
  }

  private handleSpecialCommands(input: string): boolean {
    const command = input.toLowerCase();

    switch (command) {
      case 'quit':
      case 'exit':
      case 'bye':
        console.log('👋 Goodbye!');
        this.running = false;
        return true;

      case 'help':
        this.showHelp();
        return true;

      case 'tools':
        this.showTools();
        return true;

      case 'clear':
        console.clear();
        console.log('🚀 Make It Heavy - Single Agent Mode\n');
        return true;

      case 'config':
        this.showConfig();
        return true;

      default:
        return false;
    }
  }

  private showHelp(): void {
    if (!this.config) return;

    console.log(`
📚 Available Commands:
  help      - Show this help message
  tools     - List available tools
  config    - Show current configuration
  clear     - Clear the screen  
  quit/exit - Exit the application

💡 Usage Tips:
  - Ask questions naturally
  - Request calculations: "What's 15 * 23?"
  - Search the web: "What's the latest news about AI?"
  - Read files: "Read the contents of config.yaml"
  - Write files: "Create a file called test.txt with 'Hello World'"

📝 Input Settings:
  - Mode: ${this.config.input.type} ${this.config.input.multiline ? '(multi-line)' : '(single-line)'}
  - Max length: ${this.config.input.max_length} characters
  ${this.config.input.type === 'text' && this.config.input.multiline ?
        '  - For multi-line input: Press Enter for new lines, Ctrl+D to finish' : ''}
  ${this.config.input.type === 'editor' ?
        `  - Editor: ${this.config.input.editor_command}` : ''}
  
Example questions:
  - "What's the square root of 144?"
  - "Search for information about TypeScript best practices"
  - "Calculate the compound interest for $1000 at 5% for 10 years"
`);
  }

  private showTools(): void {
    console.log('\n🔧 Available Tools:');
    console.log(toolRegistry.listAvailableTools());
    console.log();
  }

  private showConfig(): void {
    if (!this.config) return;

    console.log('\n⚙️ Current Configuration:');
    console.log(`  Model: ${this.config.openrouter.model}`);
    console.log(`  Max iterations: ${this.config.agent.max_iterations}`);
    console.log(`  Temperature: ${this.config.agent.temperature}`);
    console.log(`  Input type: ${this.config.input.type}`);
    console.log(`  Multi-line: ${this.config.input.multiline}`);
    console.log(`  Max input length: ${this.config.input.max_length}`);
    if (this.config.input.type === 'editor') {
      console.log(`  Editor command: ${this.config.input.editor_command}`);
    }
    console.log();
  }
}

// Main execution
async function main(): Promise<void> {
  const cli = new SingleAgentCLI();

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n👋 Received interrupt signal. Goodbye!');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n👋 Received termination signal. Goodbye!');
    process.exit(0);
  });

  await cli.initialize();
  await cli.run();
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
} 