import { LeadResearchAgent } from './agents/lead.js';
import { Config } from './types/config.js';
import { MemoryStore } from './utils/memory.js';
import { ResearchQuery, ResearchResult } from './types/schemas.js';



export class Orchestrator {
  private config: Config;
  private leadResearchAgent: LeadResearchAgent;
  private memoryStore: MemoryStore;

  constructor(config: Config) {
    this.config = config;
    this.leadResearchAgent = new LeadResearchAgent(config);
    this.memoryStore = new MemoryStore(config);
  }

  /**
   * Enhanced multi-agent research workflow
   */
  async conductResearch(query: string, options: {
    max_subagents?: number;
    max_iterations?: number;
  } = {}): Promise<ResearchResult> {
    const timestamp = new Date().toISOString();
    const researchQuery: ResearchQuery = {
      query,
      max_subagents: options.max_subagents || 3,
      max_iterations: options.max_iterations || 5
    };

    console.log(`\n🎬 [ORCHESTRATOR] ${timestamp} - STARTING ENHANCED RESEARCH`);
    console.log(`📋 [ORCHESTRATOR] Query: "${query}"`);
    console.log(`⚙️  [ORCHESTRATOR] Configuration:`);
    console.log(`   - Max subagents: ${researchQuery.max_subagents}`);
    console.log(`   - Max iterations: ${researchQuery.max_iterations}`);
    console.log(`   - Model: ${this.config.openrouter.model}`);
    console.log(`   - Redis TTL: ${this.config.redis.ttl || 3600}s`);

    const startTime = Date.now();

    try {
      console.log(`🚀 [ORCHESTRATOR] Delegating to Lead Research Agent...`);
      const result = await this.leadResearchAgent.conductResearch(researchQuery);

      const duration = Date.now() - startTime;
      console.log(`\n✅ [ORCHESTRATOR] Research completed successfully!`);
      console.log(`📊 [ORCHESTRATOR] Final Statistics:`);
      console.log(`   - Research ID: ${result.research_id}`);
      console.log(`   - Total duration: ${duration}ms`);
      console.log(`   - Execution time: ${result.execution_time}ms`);
      console.log(`   - Tokens used: ${result.total_tokens_used}`);
      console.log(`   - Sources found: ${result.sources_used.length}`);
      console.log(`   - Citations: ${result.citations.length}`);
      console.log(`   - Report length: ${result.report.length} chars`);

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`\n❌ [ORCHESTRATOR] Research failed after ${duration}ms`);
      console.error(`💥 [ORCHESTRATOR] Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error(`🔍 [ORCHESTRATOR] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
      throw error;
    }
  }

  /**
   * Start asynchronous research and return research ID
   */
  async startResearch(query: string, options: {
    max_subagents?: number;
    max_iterations?: number;
  } = {}): Promise<string> {
    const researchQuery: ResearchQuery = {
      query,
      max_subagents: options.max_subagents || 3,
      max_iterations: options.max_iterations || 5
    };

    // Start research in background (not awaited)
    const researchPromise = this.leadResearchAgent.conductResearch(researchQuery);

    // Extract research ID from the promise (assuming it's generated immediately)
    const researchId = `research_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Store the promise for later retrieval
    researchPromise.then(result => {
      this.memoryStore.saveResult(researchId, result);
    }).catch(error => {
      this.memoryStore.setStatus(researchId, `failed: ${error.message}`);
    });

    await this.memoryStore.setStatus(researchId, 'started');

    console.log(`[ORCHESTRATOR] Started research: ${researchId}`);
    return researchId;
  }

  /**
   * Get status of ongoing research
   */
  async getResearchStatus(researchId: string): Promise<string | null> {
    return await this.memoryStore.getStatus(researchId);
  }

  /**
   * Get completed research result
   */
  async getResearchResult(researchId: string): Promise<ResearchResult | null> {
    return await this.memoryStore.getResult(researchId);
  }

  /**
   * List all active research sessions
   */
  async getActiveResearch(): Promise<string[]> {
    return await this.memoryStore.getAllActiveResearch();
  }


} 