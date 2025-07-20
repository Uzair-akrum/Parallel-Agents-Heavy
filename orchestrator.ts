import { Agent } from './agent.js';
import { Config } from './types/config.js';
import { ProgressDisplay } from './utils/progress.js';

export interface SubTask {
  id: string;
  question: string;
  priority: number;
}

export interface AgentResult {
  subTaskId: string;
  question: string;
  response: string;
  success: boolean;
  error?: string;
}

export class Orchestrator {
  private config: Config;
  private orchestratorAgent: Agent;
  private synthesisAgent: Agent;
  private progressDisplay: ProgressDisplay;

  constructor(config: Config) {
    this.config = config;
    this.orchestratorAgent = new Agent({
      ...config,
      prompts: {
        ...config.prompts,
        system_prompt: config.prompts.orchestrator_prompt
      }
    });
    this.synthesisAgent = new Agent({
      ...config,
      openrouter: {
        ...config.openrouter,
        model: config.orchestrator.synthesis_model
      },
      prompts: {
        ...config.prompts,
        system_prompt: config.prompts.synthesis_prompt
      }
    });
    this.progressDisplay = new ProgressDisplay();
  }

  async processQuery(query: string): Promise<string> {
    try {
      // Step 1: Break down the query into sub-tasks
      const subTasks = await this.generateSubTasks(query);

      if (subTasks.length === 0) {
        return "I couldn't break down your question into manageable sub-tasks. Please try rephrasing your question.";
      }

      // Initialize progress display with agents
      for (let i = 0; i < subTasks.length; i++) {
        this.progressDisplay.addAgent(`AGENT ${i + 1}`, `AGENT ${String(i + 1).padStart(2, '0')}`);
      }

      // Start the progress display
      this.progressDisplay.start();

      // Step 2: Process sub-tasks in parallel
      const results = await this.processSubTasksInParallel(subTasks);

      // Step 3: Synthesize results
      const finalAnswer = await this.synthesizeResults(query, results);

      // Stop progress display
      this.progressDisplay.stop();

      return finalAnswer;
    } catch (error) {
      // Make sure to stop progress display on error
      this.progressDisplay.stop();

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return `I encountered an error while processing your request with multiple agents: ${errorMessage}`;
    }
  }

  private async generateSubTasks(query: string): Promise<SubTask[]> {
    const prompt = `
Break down the following complex question into 3-5 specific, focused sub-questions that can be answered independently by specialized agents.

Original Question: ${query}

Please provide your response as a JSON array of objects with the following structure:
[
  {
    "id": "task_1",
    "question": "Specific sub-question 1",
    "priority": 1
  },
  {
    "id": "task_2", 
    "question": "Specific sub-question 2",
    "priority": 2
  }
]

Make sure each sub-question:
1. Can be answered independently
2. Is specific and actionable
3. Contributes to answering the original question
4. Is prioritized (1 = highest priority)

Return ONLY the JSON array, no additional text.
`;

    try {
      const response = await this.orchestratorAgent.quickResponse(prompt);

      // Extract JSON from response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('Could not extract JSON from orchestrator response');
      }

      const subTasks = JSON.parse(jsonMatch[0]) as SubTask[];

      // Validate and limit number of sub-tasks
      const validSubTasks = subTasks
        .filter(task => task.id && task.question && typeof task.priority === 'number')
        .slice(0, this.config.orchestrator.max_agents);

      return validSubTasks;
    } catch (error) {
      // Fallback: create a single sub-task with the original query
      return [{
        id: 'task_1',
        question: query,
        priority: 1
      }];
    }
  }

  private async processSubTasksInParallel(subTasks: SubTask[]): Promise<AgentResult[]> {
    const promises = subTasks.map(async (task, index) => {
      const agentId = `AGENT ${index + 1}`;

      // Update agent status to running
      this.progressDisplay.updateAgent(agentId, { status: 'running' });

      try {
        const agent = new Agent(this.config);
        const response = await agent.run(task.question);

        // Update agent status to completed
        this.progressDisplay.updateAgent(agentId, {
          status: 'completed',
          progress: 100
        });

        return {
          subTaskId: task.id,
          question: task.question,
          response,
          success: true
        };
      } catch (error) {
        // Update agent status to failed
        this.progressDisplay.updateAgent(agentId, { status: 'failed' });

        return {
          subTaskId: task.id,
          question: task.question,
          response: '',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    return await Promise.all(promises);
  }

  private async synthesizeResults(originalQuery: string, results: AgentResult[]): Promise<string> {
    const successfulResults = results.filter(result => result.success);
    const failedResults = results.filter(result => !result.success);

    if (successfulResults.length === 0) {
      return "I apologize, but all agent tasks failed to produce results. Please try rephrasing your question or check your configuration.";
    }

    const synthesisPrompt = `
You are synthesizing responses from multiple specialized agents to answer a complex question.

Original Question: ${originalQuery}

Agent Responses:
${successfulResults.map((result, index) =>
      `Agent ${index + 1} (${result.subTaskId}):
Question: ${result.question}
Answer: ${result.response}
`).join('\n---\n')}

${failedResults.length > 0 ? `
Failed Tasks:
${failedResults.map(result => `- ${result.question}: ${result.error}`).join('\n')}
` : ''}

Please provide a comprehensive, well-structured final answer that:
1. Directly addresses the original question
2. Integrates insights from all successful agent responses
3. Maintains coherence and flow
4. Acknowledges any limitations from failed tasks
5. Cites specific information when relevant

Final Answer:
`;

    try {
      const finalAnswer = await this.synthesisAgent.run(synthesisPrompt);
      return finalAnswer;
    } catch (error) {
      // Fallback: combine results directly
      const combinedAnswer = successfulResults
        .map(result => `**${result.question}**\n${result.response}`)
        .join('\n\n---\n\n');

      return `Here's what I found:\n\n${combinedAnswer}`;
    }
  }
} 