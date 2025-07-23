import { BaseAgent } from './base.js';
import { SearchSubAgent } from './search.js';
import { CitationAgent } from './citation.js';
import { Config } from '../types/config.js';
import { MemoryStore } from '../utils/memory.js';
import { LEAD_AGENT_PROMPT } from '../utils/prompts.js';
import {
  ResearchQuery,
  ResearchResult,
  ResearchPlan,
  SubAgentTask,
  SubAgentResult,
  ResearchContext,
  FollowUpTask,
  generateResearchId,
  generateTaskId
} from '../types/schemas.js';

export class LeadResearchAgent extends BaseAgent {
  private memoryStore: MemoryStore;
  private searchAgents: SearchSubAgent[] = [];
  private citationAgent: CitationAgent;

  constructor(config: Config) {
    super(config, LEAD_AGENT_PROMPT);
    this.memoryStore = new MemoryStore(config);
    this.citationAgent = new CitationAgent(config);
  }

  /**
   * Main research coordination method
   */
  async conductResearch(query: ResearchQuery): Promise<ResearchResult> {
    const researchId = generateResearchId();
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    console.log(`\n🧠 [LEAD AGENT] ${timestamp} - INITIALIZING RESEARCH`);
    console.log(`🆔 [LEAD AGENT] Research ID: ${researchId}`);
    console.log(`📝 [LEAD AGENT] Query: "${query.query}"`);
    console.log(`⚙️  [LEAD AGENT] Parameters:`);
    console.log(`   - Max subagents: ${query.max_subagents || 3}`);
    console.log(`   - Max iterations: ${query.max_iterations || 5}`);

    console.log(`💾 [LEAD AGENT] Setting initial status to 'planning'...`);
    await this.memoryStore.setStatus(researchId, 'planning');

    try {
      // Step 1: Create research plan
      console.log(`\n📋 [LEAD AGENT] STEP 1: Creating research plan...`);
      const planStartTime = Date.now();
      const plan = await this._createResearchPlan(query);
      const planDuration = Date.now() - planStartTime;

      console.log(`✅ [LEAD AGENT] Research plan created in ${planDuration}ms:`);
      console.log(`   - Strategy: ${plan.strategy}`);
      console.log(`   - Complexity: ${plan.estimated_complexity}`);
      console.log(`   - Subtasks: ${plan.subtasks.length}`);

      plan.subtasks.forEach((task, index) => {
        console.log(`   📝 Task ${index + 1}: ${task.objective.slice(0, 60)}...`);
        console.log(`      Focus: ${task.search_focus}`);
        console.log(`      Max searches: ${task.max_searches}`);
      });

      // Step 2: Initialize research context
      console.log(`\n💾 [LEAD AGENT] STEP 2: Initializing research context...`);
      const context: ResearchContext = {
        research_id: researchId,
        query: query.query,
        plan,
        completed_tasks: [],
        pending_tasks: [...plan.subtasks],
        iteration_count: 0,
        total_tokens_used: 0,
        start_time: startTime
      };

      console.log(`📊 [LEAD AGENT] Context initialized:`);
      console.log(`   - Pending tasks: ${context.pending_tasks.length}`);
      console.log(`   - Completed tasks: ${context.completed_tasks.length}`);

      console.log(`💾 [LEAD AGENT] Saving context to memory store...`);
      await this.memoryStore.saveContext(researchId, context);
      console.log(`✅ [LEAD AGENT] Context saved successfully`);

      // Step 3: Execute research plan with iterations
      console.log(`\n🚀 [LEAD AGENT] STEP 3: Executing research plan...`);
      await this.memoryStore.setStatus(researchId, 'executing');
      const executionStartTime = Date.now();
      const results = await this._executeResearchPlan(context, query);
      const executionDuration = Date.now() - executionStartTime;

      console.log(`✅ [LEAD AGENT] Research execution completed in ${executionDuration}ms:`);
      console.log(`   - Total results: ${results.length}`);
      console.log(`   - Total sources: ${results.reduce((sum, r) => sum + r.sources.length, 0)}`);
      console.log(`   - Total findings: ${results.reduce((sum, r) => sum + r.findings.length, 0)}`);

      // Step 4: Synthesize results
      console.log(`\n📝 [LEAD AGENT] STEP 4: Synthesizing results...`);
      await this.memoryStore.setStatus(researchId, 'synthesizing');
      const synthesisStartTime = Date.now();
      const report = await this._synthesizeResults(query.query, results);
      const synthesisDuration = Date.now() - synthesisStartTime;

      console.log(`✅ [LEAD AGENT] Synthesis completed in ${synthesisDuration}ms:`);
      console.log(`   - Report length: ${report.length} characters`);
      console.log(`   - Report preview: ${report.slice(0, 100)}...`);

      // Step 5: Add citations
      console.log(`\n📚 [LEAD AGENT] STEP 5: Adding citations...`);
      await this.memoryStore.setStatus(researchId, 'citing');
      const citationStartTime = Date.now();
      const citedReport = await this._addCitations(report, results);
      const citationDuration = Date.now() - citationStartTime;

      console.log(`✅ [LEAD AGENT] Citations added in ${citationDuration}ms:`);
      console.log(`   - Citations found: ${citedReport.citations.length}`);
      console.log(`   - Final report length: ${citedReport.report.length} characters`);

      // Step 6: Create final result
      const executionTime = Date.now() - startTime;
      const totalTokens = results.reduce((sum, result) => sum + result.token_count, 0);

      const finalResult: ResearchResult = {
        research_id: researchId,
        query: query.query,
        report: citedReport.report,
        citations: citedReport.citations,
        sources_used: results.flatMap(r => r.sources),
        total_tokens_used: totalTokens,
        execution_time: executionTime
      };

      await this.memoryStore.saveResult(researchId, finalResult);
      await this.memoryStore.setStatus(researchId, 'completed');

      console.log(`[LEAD AGENT] Research completed: ${researchId} (${executionTime}ms, ${totalTokens} tokens)`);
      return finalResult;

    } catch (error) {
      console.error(`[LEAD AGENT] Research failed: ${error}`);
      await this.memoryStore.setStatus(researchId, 'failed');

      return {
        research_id: researchId,
        query: query.query,
        report: `Research failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        citations: [],
        sources_used: [],
        total_tokens_used: 0,
        execution_time: Date.now() - startTime
      };
    }
  }

  /**
   * Create detailed research plan
   */
  private async _createResearchPlan(query: ResearchQuery): Promise<ResearchPlan> {
    const planningPrompt = `
Create a comprehensive research plan for this query: "${query.query}"

You need to break this down into ${query.max_subagents || 3} focused research subtasks that can be executed in parallel by specialized search agents.

For each subtask, provide:
1. A clear, specific objective
2. The search focus (what aspects to concentrate on)
3. Expected output format (what type of information to gather)
4. Maximum number of searches to perform (default: 5)

Consider:
- Different perspectives and aspects of the topic
- Authoritative sources and recent information
- Avoiding redundancy between subtasks
- Ensuring comprehensive coverage

Respond with a JSON object:
{
  "strategy": "Brief description of overall research approach",
  "estimated_complexity": "simple|moderate|complex",
  "subtasks": [
    {
      "objective": "Clear, specific research objective",
      "search_focus": "Specific aspect or perspective to focus on", 
      "expected_output_format": "Description of expected findings format",
      "max_searches": 5
    }
  ]
}
`;

    const thinkingResult = await this.think(planningPrompt);

    if (thinkingResult.error) {
      throw new Error(`Planning failed: ${thinkingResult.error}`);
    }

    // Extract plan from thinking result
    let planData = thinkingResult;

    // If the thinking result contains a nested structure, extract it
    if (thinkingResult.analysis || thinkingResult.plan) {
      try {
        const textResponse = thinkingResult.analysis || JSON.stringify(thinkingResult);
        const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          planData = JSON.parse(jsonMatch[0]);
        }
      } catch (parseError) {
        console.warn('Failed to parse plan, using default structure');
      }
    }

    // Create subtasks with IDs and status
    const subtasks: SubAgentTask[] = (planData.subtasks || [
      {
        objective: query.query,
        search_focus: "Comprehensive information gathering",
        expected_output_format: "Key findings and insights",
        max_searches: 5
      }
    ]).map((task: any) => ({
      task_id: generateTaskId(),
      objective: task.objective,
      search_focus: task.search_focus,
      expected_output_format: task.expected_output_format,
      max_searches: task.max_searches || 5,
      status: 'pending' as const
    }));

    return {
      plan_id: generateResearchId(),
      strategy: planData.strategy || "Comprehensive multi-angle research approach",
      subtasks,
      estimated_complexity: planData.estimated_complexity || 'moderate'
    };
  }

  /**
   * Execute research plan with iterations
   */
  private async _executeResearchPlan(
    context: ResearchContext,
    query: ResearchQuery
  ): Promise<SubAgentResult[]> {
    const maxIterations = query.max_iterations || 5;
    const results: SubAgentResult[] = [];

    while (context.iteration_count < maxIterations && context.pending_tasks.length > 0) {
      context.iteration_count++;
      console.log(`[LEAD AGENT] Starting iteration ${context.iteration_count}/${maxIterations}`);

      await this.memoryStore.setStatus(context.research_id, `executing_iteration_${context.iteration_count}`);

      // Execute pending tasks in parallel
      const iterationResults = await this._executePendingTasks(context);
      results.push(...iterationResults);

      // Update context
      context.completed_tasks.push(...iterationResults);
      context.pending_tasks = context.pending_tasks.filter(task =>
        !iterationResults.some(result => result.task_id === task.task_id)
      );

      await this.memoryStore.saveContext(context.research_id, context);

      // Check if we need more research
      if (await this._needsMoreResearch(context, results)) {
        const followUpTasks = await this._createFollowupTasks(query.query, results);
        context.pending_tasks.push(...followUpTasks.flatMap(f =>
          f.additional_queries.map(q => ({
            task_id: generateTaskId(),
            objective: q,
            search_focus: f.focus_areas.join(', '),
            expected_output_format: "Additional findings and clarifications",
            max_searches: 3,
            status: 'pending' as const
          }))
        ));
      }

      console.log(`[LEAD AGENT] Iteration ${context.iteration_count} complete. Results: ${iterationResults.length}, Pending: ${context.pending_tasks.length}`);
    }

    return results;
  }

  /**
   * Execute pending tasks in parallel
   */
  private async _executePendingTasks(context: ResearchContext): Promise<SubAgentResult[]> {
    const maxConcurrent = this.config.orchestrator.max_agents || 3;
    const tasksToExecute = context.pending_tasks.slice(0, maxConcurrent);

    console.log(`[LEAD AGENT] Executing ${tasksToExecute.length} tasks in parallel`);

    // Create search agents for parallel execution
    const promises = tasksToExecute.map(async (task) => {
      const searchAgent = new SearchSubAgent(this.config);

      // Update task status
      task.status = 'running';
      await this.memoryStore.saveTaskProgress(context.research_id, task.task_id, { status: 'running' });

      try {
        const result = await searchAgent.executeTask(task);

        // Update task status
        task.status = 'completed';
        await this.memoryStore.saveTaskProgress(context.research_id, task.task_id, { status: 'completed', result });

        return result;
      } catch (error) {
        console.error(`[LEAD AGENT] Task ${task.task_id} failed: ${error}`);
        task.status = 'failed';
        await this.memoryStore.saveTaskProgress(context.research_id, task.task_id, { status: 'failed', error: error instanceof Error ? error.message : 'Unknown error' });

        // Return empty result for failed tasks
        return {
          task_id: task.task_id,
          findings: [],
          sources: [],
          summary: `Task failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          token_count: 0
        };
      }
    });

    return await Promise.all(promises);
  }

  /**
   * Determine if more research is needed
   */
  private async _needsMoreResearch(context: ResearchContext, results: SubAgentResult[]): Promise<boolean> {
    // Simple heuristics for determining if more research is needed
    const totalSources = results.flatMap(r => r.sources).length;
    const avgRelevance = results.length > 0
      ? results.flatMap(r => r.sources).reduce((sum, s) => sum + s.relevance_score, 0) / totalSources
      : 0;

    // Need more research if:
    // - Too few sources (less than 8)
    // - Low average relevance (less than 0.7)
    // - We haven't reached max iterations and still have capacity
    return totalSources < 8 || avgRelevance < 0.7;
  }

  /**
   * Create follow-up tasks based on current results
   */
  private async _createFollowupTasks(originalQuery: string, results: SubAgentResult[]): Promise<FollowUpTask[]> {
    const followUpPrompt = `
Based on the research results so far for query: "${originalQuery}"

Current findings summary:
${results.map((r, i) => `${i + 1}. ${r.summary}`).join('\n')}

Identify any gaps or areas that need additional research. Create follow-up tasks if needed.

Respond with JSON:
{
  "needs_followup": true/false,
  "followup_tasks": [
    {
      "reason": "Why this follow-up is needed",
      "additional_queries": ["Specific search query 1", "Specific search query 2"],
      "focus_areas": ["focus area 1", "focus area 2"]
    }
  ]
}
`;

    const thinkingResult = await this.think(followUpPrompt);

    if (thinkingResult.error || !thinkingResult.needs_followup) {
      return [];
    }

    return (thinkingResult.followup_tasks || []).map((task: any) => ({
      task_id: generateTaskId(),
      reason: task.reason,
      additional_queries: task.additional_queries || [],
      focus_areas: task.focus_areas || []
    }));
  }

  /**
   * Synthesize all results into comprehensive report
   */
  private async _synthesizeResults(originalQuery: string, results: SubAgentResult[]): Promise<string> {
    const synthesisPrompt = `
Synthesize the following research results into a comprehensive, well-structured report for the query: "${originalQuery}"

Research Results:
${results.map((result, index) => `
## Task ${index + 1}: ${result.task_id}
**Summary:** ${result.summary}

**Key Findings:**
${result.findings.map(finding => `- ${JSON.stringify(finding)}`).join('\n')}

**Sources (${result.sources.length}):**
${result.sources.slice(0, 3).map(source => `- ${source.title} (${source.url}) - Relevance: ${source.relevance_score}`).join('\n')}
${result.sources.length > 3 ? `... and ${result.sources.length - 3} more sources` : ''}

---
`).join('\n')}

Create a comprehensive report that:
1. **Directly addresses the original query**
2. **Integrates insights from all research tasks**
3. **Maintains logical flow and clear structure**
4. **Uses specific evidence and examples**
5. **Provides balanced analysis**
6. **Includes actionable conclusions**

Structure the report with:
- Executive Summary
- Main Findings (organized by theme)
- Detailed Analysis
- Conclusions and Recommendations

Focus on creating authoritative, well-evidenced content that thoroughly answers the original question.
`;

    const synthesisResult = await this._callLLM([
      { role: 'system', content: 'You are synthesizing research findings into a comprehensive report.' },
      { role: 'user', content: synthesisPrompt }
    ], { maxTokens: 2000, temperature: 0.3 });

    return synthesisResult.text;
  }

  /**
   * Add citations to the synthesized report
   */
  private async _addCitations(report: string, results: SubAgentResult[]): Promise<{ report: string; citations: any[] }> {
    const allSources = results.flatMap(r => r.sources);
    return await this.citationAgent.addCitations(report, allSources);
  }
} 