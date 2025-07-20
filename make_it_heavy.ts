import enquirer from 'enquirer';
import { Orchestrator } from './orchestrator.js';
import { loadConfig, validateConfig } from './utils/config.js';
import { toolRegistry } from './tools/index.js';
import { Config } from './types/config.js';
import fs from 'fs/promises';
import path from 'path';

interface UserInput {
  userInput: string;
}

interface ModeSelection {
  mode: 'single' | 'multi' | 'auto';
}

class MultiAgentCLI {
  private orchestrator: Orchestrator | null = null;
  private running = false;
  private config: Config | null = null;

  async initialize(): Promise<void> {
    try {
      console.log('🎯 Make It Heavy - Multi-Agent Mode');
      console.log('====================================');

      // Load configuration
      console.log('📁 Loading configuration...');
      this.config = await loadConfig();
      validateConfig(this.config);

      // Initialize orchestrator
      console.log('🎭 Initializing orchestrator...');
      this.orchestrator = new Orchestrator(this.config);

      console.log('✅ Initialization complete!');
      console.log(`🔧 Available tools: ${toolRegistry.getAllTools().length}`);
      console.log(`👥 Max parallel agents: ${this.config.orchestrator.max_agents}`);
      console.log(`📝 Input mode: ${this.config.input.type} ${this.config.input.multiline ? '(multi-line)' : '(single-line)'}`);
      console.log(`📏 Max input length: ${this.config.input.max_length} characters`);
      console.log('💡 Type "help" for available commands, "quit" to exit\n');

    } catch (error) {
      console.error('❌ Initialization failed:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  }

  async run(): Promise<void> {
    if (!this.orchestrator || !this.config) {
      throw new Error('Orchestrator not initialized. Call initialize() first.');
    }

    this.running = true;

    while (this.running) {
      try {
        const userInput = await this.getUserInput();

        if (!userInput || userInput.trim().length === 0) {
          console.log('❌ Please enter a complex question or task');
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

        // Check if query is complex enough for multi-agent processing
        const complexity = this.assessQueryComplexity(userInput);

        if (complexity < 3) {
          console.log('💡 This seems like a simple query. Consider using single-agent mode for faster results.');
          const { proceed } = await enquirer.prompt<{ proceed: boolean }>({
            type: 'confirm',
            name: 'proceed',
            message: 'Continue with multi-agent processing anyway?',
            initial: true
          });

          if (!proceed) {
            console.log('💨 Tip: Run with `npm run dev` for single-agent mode\n');
            continue;
          }
        }

        // Process with orchestrator
        console.log('\n🎯 Initiating multi-agent processing...');
        const startTime = Date.now();

        const response_text = await this.orchestrator.processQuery(userInput);

        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);

        console.log(`\n🎭 Multi-Agent Response (${duration}s):`);
        console.log('='.repeat(50));
        console.log(response_text);
        console.log('='.repeat(50) + '\n');

        // Save response to markdown file with title
        await this.saveResponseToMarkdown(userInput, response_text, duration);

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
            if (input.trim().length === 0) return 'Please enter a complex question or task';
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
          reject(new Error('Please enter a complex question or task'));
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
        if (input.trim().length === 0) return 'Please enter a complex question or task';
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
        console.log('🎯 Make It Heavy - Multi-Agent Mode\n');
        return true;

      case 'examples':
        this.showExamples();
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
  examples  - Show example complex queries
  config    - Show current configuration
  clear     - Clear the screen  
  quit/exit - Exit the application

🎭 Multi-Agent Mode:
  This mode is designed for complex questions that benefit from multiple perspectives
  or require breaking down into sub-tasks. The orchestrator will:
  
  1. 📋 Break your question into focused sub-questions
  2. 🚀 Process them in parallel with specialized agents
  3. 🔄 Synthesize all responses into a comprehensive answer

💡 Best suited for:
  - Research questions requiring multiple sources
  - Complex analysis with different aspects
  - Multi-step problem solving
  - Comparative studies
  - Strategic planning questions

📝 Input Settings:
  - Mode: ${this.config.input.type} ${this.config.input.multiline ? '(multi-line)' : '(single-line)'}
  - Max length: ${this.config.input.max_length} characters
  ${this.config.input.type === 'text' && this.config.input.multiline ?
        '  - For multi-line input: Press Enter for new lines, Ctrl+D to finish' : ''}
  ${this.config.input.type === 'editor' ?
        `  - Editor: ${this.config.input.editor_command}` : ''}
`);
  }

  private showTools(): void {
    console.log('\n🔧 Available Tools (shared across all agents):');
    console.log(toolRegistry.listAvailableTools());
    console.log();
  }

  private showExamples(): void {
    console.log(`
🎯 Example Complex Queries for Multi-Agent Processing:

📊 Research & Analysis:
  - "Compare the environmental impact of solar vs wind energy, including cost analysis and implementation challenges"
  - "Analyze the current state of artificial intelligence in healthcare, including benefits, risks, and regulatory considerations"
  - "What are the pros and cons of different programming languages for building scalable web applications?"

🔍 Multi-faceted Investigation:
  - "How do different countries approach renewable energy adoption, and what can we learn from their successes and failures?"
  - "Examine the economic, social, and technological factors driving the growth of remote work"
  - "What are the key considerations for starting a tech startup in 2024, including funding, market analysis, and technology trends?"

🎓 Educational & Planning:
  - "Create a comprehensive learning path for becoming a full-stack developer, including resources, timeline, and project ideas"
  - "Develop a strategic business plan for a sustainable fashion brand targeting Gen Z consumers"
  - "What are the most effective strategies for learning a new language as an adult, considering different learning styles and time constraints?"

💡 These queries benefit from multiple perspectives and parallel research!
`);
  }

  private showConfig(): void {
    if (!this.config) return;

    console.log('\n⚙️ Current Configuration:');
    console.log(`  Model: ${this.config.openrouter.model}`);
    console.log(`  Max agents: ${this.config.orchestrator.max_agents}`);
    console.log(`  Synthesis model: ${this.config.orchestrator.synthesis_model}`);
    console.log(`  Input type: ${this.config.input.type}`);
    console.log(`  Multi-line: ${this.config.input.multiline}`);
    console.log(`  Max input length: ${this.config.input.max_length}`);
    if (this.config.input.type === 'editor') {
      console.log(`  Editor command: ${this.config.input.editor_command}`);
    }
    console.log();
  }

  private assessQueryComplexity(query: string): number {
    // Simple heuristic to assess query complexity
    let complexity = 1;

    // Check for multiple questions or conjunctions
    const multipleQuestions = (query.match(/\?/g) || []).length;
    complexity += multipleQuestions;

    // Check for complex conjunctions
    const conjunctions = ['and', 'or', 'but', 'also', 'additionally', 'furthermore', 'moreover'];
    const conjunctionCount = conjunctions.reduce((count, word) =>
      count + (query.toLowerCase().split(word).length - 1), 0);
    complexity += conjunctionCount;

    // Check for comparison/analysis keywords
    const complexWords = ['compare', 'analyze', 'evaluate', 'research', 'study', 'investigate',
      'pros and cons', 'advantages', 'disadvantages', 'different', 'various'];
    const complexWordCount = complexWords.reduce((count, word) =>
      count + (query.toLowerCase().includes(word) ? 1 : 0), 0);
    complexity += complexWordCount;

    // Check for multiple topics (length heuristic)
    if (query.length > 100) complexity += 1;
    if (query.length > 200) complexity += 1;

    return Math.min(complexity, 5); // Cap at 5
  }

  private async saveResponseToMarkdown(query: string, response: string, duration: string): Promise<void> {
    if (!this.config) {
      console.error('Config not loaded, cannot save response.');
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.-]/g, '');
    const filename = `chat-${timestamp}.md`;
    const outputDir = path.join(process.cwd(), 'responses');

    try {
      const fullPath = path.join(outputDir, filename);
      await fs.mkdir(outputDir, { recursive: true });

      // Generate a title using a simple approach (we could enhance this to call the LLM)
      const title = this.generateChatTitle(query);

      const markdownContent = `# ${title}

**Query:**
${query}

**Multi-Agent Response:**
${response}

**Processing Duration:** ${duration}s

**Timestamp:** ${new Date().toISOString()}
`;

      await fs.writeFile(fullPath, markdownContent);
      console.log(`📄 Response saved to: ${path.relative(process.cwd(), fullPath)}`);
    } catch (error) {
      console.error('❌ Failed to save response to markdown file:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private generateChatTitle(query: string): string {
    // Simple title generation - could be enhanced to call LLM for better titles
    const words = query.split(' ').slice(0, 8); // Take first 8 words
    let title = words.join(' ');

    // Clean up title
    title = title.replace(/[^\w\s-]/g, '').trim();

    // Capitalize first letter
    title = title.charAt(0).toUpperCase() + title.slice(1);

    // Add ellipsis if truncated
    if (words.length < query.split(' ').length) {
      title += '...';
    }

    return title || 'Multi-Agent Chat';
  }
}

// Main execution
async function main(): Promise<void> {
  const cli = new MultiAgentCLI();

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