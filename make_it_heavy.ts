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
      console.log('🎯 Make It Heavy - Enhanced Multi-Agent Research Orchestrator');
      console.log('================================================================');

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

        // Assess query complexity for adaptive configuration
        const complexity = this.assessQueryComplexity(userInput);

        // Use enhanced orchestrator for all queries with adaptive configuration
        console.log('\n🔬 Using Enhanced Multi-Agent Research Orchestrator');
        console.log(`📊 Query complexity: ${complexity >= 4 ? 'High' : complexity >= 2 ? 'Medium' : 'Low'}`)

        console.log(`\n🎯 Initiating enhanced multi-agent research...`);
        const startTime = Date.now();

        // Use enhanced orchestrator with complexity-based settings
        const researchOptions = complexity >= 4
          ? { max_subagents: 4, max_iterations: 3 }  // Complex queries
          : complexity >= 2
            ? { max_subagents: 3, max_iterations: 2 }  // Medium queries
            : { max_subagents: 2, max_iterations: 1 }; // Simple queries

        console.log(`🎛️  Research Configuration:`);
        console.log(`   - Max subagents: ${researchOptions.max_subagents}`);
        console.log(`   - Max iterations: ${researchOptions.max_iterations}`);

        const result = await this.orchestrator.conductResearch(userInput, researchOptions);
        const response_text = result.report;
        const researchId = result.research_id;

        console.log(`\n📊 Research Statistics:`);
        console.log(`   Research ID: ${result.research_id}`);
        console.log(`   Sources Used: ${result.sources_used.length}`);
        console.log(`   Tokens Used: ${result.total_tokens_used}`);
        console.log(`   Citations: ${result.citations.length}`);

        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);

        console.log(`\n🎭 Enhanced Multi-Agent Research Response (${duration}s):`);
        console.log('='.repeat(70));
        console.log(response_text);
        console.log('='.repeat(70) + '\n');

        // Save enhanced research report to markdown file
        await this.saveResearchToMarkdown(userInput, response_text, duration, researchId);

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
        console.log('🎯 Make It Heavy - Enhanced Multi-Agent Research Orchestrator\n');
        return true;

      case 'examples':
        this.showExamples();
        return true;

      case 'config':
        this.showConfig();
        return true;

      case 'research':
      case 'multiagent':
        this.showResearchHelp();
        return true;

      case 'status':
        this.showActiveResearch();
        return true;

      default:
        // Check for research status command with ID
        if (command.startsWith('status ')) {
          const researchId = command.slice(7).trim();
          this.checkResearchStatus(researchId);
          return true;
        }

        // Check for result command with ID
        if (command.startsWith('result ')) {
          const researchId = command.slice(7).trim();
          this.getResearchResult(researchId);
          return true;
        }

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
  research  - Show multi-agent research commands
  status    - List active research sessions
  clear     - Clear the screen  
  quit/exit - Exit the application

🔬 Enhanced Multi-Agent Research System:
  - Full orchestrator with Lead Agent coordination
  - Specialized search subagents with parallel execution  
  - Automatic citation and bibliography generation
  - Detailed logging and progress tracking
  - Iterative research with follow-up tasks
  - Memory persistence and session management
  - Adaptive complexity-based resource allocation

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

  private showResearchHelp(): void {
    console.log(`
🔬 Multi-Agent Research Commands:

  research          - Show this research help
  status            - List all active research sessions
  status <id>       - Check status of specific research
  result <id>       - Get result of completed research

🎯 Enhanced Multi-Agent Research Orchestrator:
  Every query automatically uses the full orchestrator system:
  - Complete orchestrator workflow with Lead Agent coordination
  - Multi-tier agent system (Lead → Search Subagents → Citation Agent)
  - Real-time detailed logging of every step and decision
  - Adaptive complexity-based resource allocation

✨ Full Orchestrator Features:
  - Intelligent research planning with task breakdown
  - Parallel specialized search agents with quality evaluation  
  - Iterative research with automated follow-up task generation
  - Automatic source citation and bibliography with inline references
  - Persistent memory across sessions with Redis storage
  - Comprehensive error handling and fallback procedures
  - Token usage tracking and performance optimization

🎛️  Adaptive Configuration (automatic):
  - High complexity: 4 subagents, 3 iterations
  - Medium complexity: 3 subagents, 2 iterations  
  - Low complexity: 2 subagents, 1 iteration

💡 Perfect for any research task - from simple questions to complex investigations!
`);
  }

  private async showActiveResearch(): Promise<void> {
    if (!this.orchestrator) return;

    try {
      const activeResearch = await this.orchestrator.getActiveResearch();

      if (activeResearch.length === 0) {
        console.log('\n📊 No active research sessions found.');
      } else {
        console.log(`\n📊 Active Research Sessions (${activeResearch.length}):`);
        for (const researchId of activeResearch) {
          const status = await this.orchestrator.getResearchStatus(researchId);
          console.log(`  ${researchId}: ${status || 'unknown'}`);
        }
      }
      console.log();
    } catch (error) {
      console.error('❌ Failed to list active research:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private async checkResearchStatus(researchId: string): Promise<void> {
    if (!this.orchestrator) return;

    try {
      const status = await this.orchestrator.getResearchStatus(researchId);

      if (status) {
        console.log(`\n📊 Research Status: ${researchId}`);
        console.log(`   Status: ${status}`);

        if (status === 'completed') {
          console.log('   ✅ Research is complete! Use "result ' + researchId + '" to get results.');
        } else if (status.startsWith('failed')) {
          console.log('   ❌ Research failed: ' + status.slice(8));
        } else {
          console.log('   🔄 Research is still in progress...');
        }
      } else {
        console.log(`\n❌ Research session not found: ${researchId}`);
      }
      console.log();
    } catch (error) {
      console.error('❌ Failed to check research status:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private async getResearchResult(researchId: string): Promise<void> {
    if (!this.orchestrator) return;

    try {
      const result = await this.orchestrator.getResearchResult(researchId);

      if (result) {
        console.log(`\n📋 Research Result: ${researchId}`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`📝 Query: ${result.query}`);
        console.log(`⏱️  Execution Time: ${result.execution_time}ms`);
        console.log(`📊 Tokens Used: ${result.total_tokens_used}`);
        console.log(`📚 Sources: ${result.sources_used.length}`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
        console.log(result.report);
        console.log(`\n💾 Saving result to file: research_${researchId}.md`);

        // Save to file
        await fs.writeFile(`research_${researchId}.md`, result.report);
        console.log('✅ Result saved to file!');
      } else {
        console.log(`\n❌ Research result not found: ${researchId}`);
        console.log('   The research may still be running or may have failed.');
      }
      console.log();
    } catch (error) {
      console.error('❌ Failed to get research result:', error instanceof Error ? error.message : 'Unknown error');
    }
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

  private async saveResearchToMarkdown(query: string, response: string, duration: string, researchId: string): Promise<void> {
    if (!this.config) {
      console.error('Config not loaded, cannot save research.');
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.-]/g, '');
    const filename = `research-${timestamp}.md`;
    const outputDir = path.join(process.cwd(), 'responses');

    try {
      const fullPath = path.join(outputDir, filename);
      await fs.mkdir(outputDir, { recursive: true });

      // Generate a title
      const title = this.generateChatTitle(query);

      const markdownContent = `# ${title}

**Research Query:**
${query}

**Enhanced Multi-Agent Research Report:**
${response}

**Research ID:** ${researchId}
**Processing Duration:** ${duration}s
**Generated:** ${new Date().toISOString()}

---
*This report was generated using enhanced multi-agent research with automatic citation and bibliography.*
`;

      await fs.writeFile(fullPath, markdownContent);
      console.log(`📄 Research report saved to: ${path.relative(process.cwd(), fullPath)}`);
    } catch (error) {
      console.error('❌ Failed to save research report:', error instanceof Error ? error.message : 'Unknown error');
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