import { BaseAgent } from './base.js';
import { Config } from '../types/config.js';
import { SEARCH_SUBAGENT_PROMPT } from '../utils/prompts.js';
import {
  SubAgentTask,
  SubAgentResult,
  SearchResult
} from '../types/schemas.js';

export class SearchSubAgent extends BaseAgent {
  constructor(config: Config) {
    super(config, SEARCH_SUBAGENT_PROMPT);
  }

  /**
   * Execute a specific research task
   */
  async executeTask(task: SubAgentTask): Promise<SubAgentResult> {
    const timestamp = new Date().toISOString();

    console.log(`\n🔍 [SEARCH AGENT] ${timestamp} - STARTING TASK`);
    console.log(`🆔 [SEARCH AGENT] Task ID: ${task.task_id}`);
    console.log(`🎯 [SEARCH AGENT] Objective: ${task.objective}`);
    console.log(`🔍 [SEARCH AGENT] Search Focus: ${task.search_focus}`);
    console.log(`📋 [SEARCH AGENT] Expected Output: ${task.expected_output_format}`);
    console.log(`🔢 [SEARCH AGENT] Max Searches: ${task.max_searches || 5}`);

    const startTime = Date.now();
    let totalTokens = 0;

    try {
      // Step 1: Generate targeted search queries
      console.log(`\n📝 [SEARCH AGENT] STEP 1: Generating search queries...`);
      const queryGenStartTime = Date.now();
      const searchQueries = await this._generateSearchQueries(task);
      const queryGenDuration = Date.now() - queryGenStartTime;

      console.log(`✅ [SEARCH AGENT] Generated ${searchQueries.length} queries in ${queryGenDuration}ms:`);
      searchQueries.forEach((query, index) => {
        console.log(`   ${index + 1}. "${query}"`);
      });

      // Step 2: Perform searches
      console.log(`\n🌐 [SEARCH AGENT] STEP 2: Performing web searches...`);
      const searchStartTime = Date.now();
      const searchResults = await this._performSearches(searchQueries, task.max_searches || 5);
      const searchDuration = Date.now() - searchStartTime;

      console.log(`✅ [SEARCH AGENT] Found ${searchResults.length} results in ${searchDuration}ms:`);
      console.log(`   - Average results per query: ${(searchResults.length / searchQueries.length).toFixed(1)}`);
      console.log(`   - Unique URLs: ${new Set(searchResults.map(r => r.url)).size}`);

      // Step 3: Evaluate and filter results
      console.log(`\n⭐ [SEARCH AGENT] STEP 3: Evaluating result quality...`);
      const evalStartTime = Date.now();
      const evaluatedResults = await this._evaluateResults(searchResults, task);
      const evalDuration = Date.now() - evalStartTime;

      console.log(`✅ [SEARCH AGENT] Evaluated ${searchResults.length} → ${evaluatedResults.length} results in ${evalDuration}ms`);
      const avgRelevance = evaluatedResults.length > 0
        ? evaluatedResults.reduce((sum, r) => sum + r.relevance_score, 0) / evaluatedResults.length
        : 0;
      console.log(`   - Average relevance: ${avgRelevance.toFixed(3)}`);
      console.log(`   - Quality threshold: ≥0.6`);

      // Step 4: Extract findings
      console.log(`\n📊 [SEARCH AGENT] STEP 4: Extracting key findings...`);
      const extractStartTime = Date.now();
      const findings = await this._extractFindings(evaluatedResults, task);
      const extractDuration = Date.now() - extractStartTime;

      console.log(`✅ [SEARCH AGENT] Extracted ${findings.length} findings in ${extractDuration}ms:`);
      findings.slice(0, 3).forEach((finding, index) => {
        console.log(`   ${index + 1}. ${finding.finding?.slice(0, 60) || 'N/A'}... (confidence: ${finding.confidence || 'N/A'})`);
      });
      if (findings.length > 3) {
        console.log(`   ... and ${findings.length - 3} more findings`);
      }

      // Step 5: Check if we have sufficient information
      console.log(`\n🔍 [SEARCH AGENT] STEP 5: Checking information sufficiency...`);
      const hasSufficientInfo = await this._hasSufficientInformation(findings, task);

      console.log(`📈 [SEARCH AGENT] Sufficiency check: ${hasSufficientInfo ? '✅ SUFFICIENT' : '⚠️  INSUFFICIENT'}`);
      console.log(`   - Findings count: ${findings.length} (minimum: 3)`);
      const avgConfidence = findings.length > 0
        ? findings.reduce((sum, f) => sum + (f.confidence || 0.5), 0) / findings.length
        : 0;
      console.log(`   - Average confidence: ${avgConfidence.toFixed(3)} (minimum: 0.6)`);

      if (!hasSufficientInfo && searchResults.length < (task.max_searches || 5)) {
        console.log(`🔄 [SEARCH AGENT] Insufficient information detected - additional searches could be triggered`);
        // Could trigger additional search round here if needed
      }

      // Step 6: Summarize findings
      console.log(`\n📋 [SEARCH AGENT] STEP 6: Summarizing findings...`);
      const summaryStartTime = Date.now();
      const summary = await this._summarizeFindings(findings, task);
      const summaryDuration = Date.now() - summaryStartTime;

      console.log(`✅ [SEARCH AGENT] Summary generated in ${summaryDuration}ms:`);
      console.log(`   - Summary length: ${summary.length} characters`);
      console.log(`   - Summary preview: ${summary.slice(0, 80)}...`);

      // Count tokens (approximation)
      console.log(`\n🧮 [SEARCH AGENT] STEP 7: Calculating token usage...`);
      totalTokens = this.countTokens(JSON.stringify(findings)) + this.countTokens(summary);

      const result: SubAgentResult = {
        task_id: task.task_id,
        findings,
        sources: evaluatedResults,
        summary,
        token_count: totalTokens
      };

      const totalDuration = Date.now() - startTime;
      console.log(`\n🎉 [SEARCH AGENT] TASK COMPLETED SUCCESSFULLY!`);
      console.log(`📊 [SEARCH AGENT] Final Statistics:`);
      console.log(`   - Task ID: ${task.task_id}`);
      console.log(`   - Total duration: ${totalDuration}ms`);
      console.log(`   - Token count: ${totalTokens}`);
      console.log(`   - Sources collected: ${evaluatedResults.length}`);
      console.log(`   - Findings extracted: ${findings.length}`);
      console.log(`   - Summary length: ${summary.length} chars`);
      console.log(`   - Average relevance: ${evaluatedResults.length > 0 ? (evaluatedResults.reduce((sum, r) => sum + r.relevance_score, 0) / evaluatedResults.length).toFixed(3) : 'N/A'}`);

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`\n💥 [SEARCH AGENT] TASK FAILED after ${duration}ms`);
      console.error(`🆔 [SEARCH AGENT] Failed Task ID: ${task.task_id}`);
      console.error(`❌ [SEARCH AGENT] Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error(`🔍 [SEARCH AGENT] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
      throw new Error(`Search task failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate targeted search queries based on task objective
   */
  private async _generateSearchQueries(task: SubAgentTask): Promise<string[]> {
    const queryPrompt = `
Generate 3-5 targeted search queries for this research task:

**Objective:** ${task.objective}
**Search Focus:** ${task.search_focus}
**Expected Output:** ${task.expected_output_format}

Create search queries that:
1. Cover different aspects of the topic
2. Use specific terminology and keywords
3. Are likely to find authoritative sources
4. Avoid redundancy
5. Consider different perspectives

Respond with a JSON array of search query strings:
["query 1", "query 2", "query 3", ...]

Focus on creating queries that will find high-quality, relevant information sources.
`;

    const result = await this.think(queryPrompt);

    if (result.error) {
      // Fallback queries based on the task
      return [
        task.objective,
        `${task.search_focus} ${task.objective}`,
        `research ${task.objective}`
      ];
    }

    // Extract query array from result
    let queries = result.queries || result.searchQueries || [];

    if (Array.isArray(result) && result.length > 0) {
      queries = result;
    } else if (typeof result === 'object' && result.analysis) {
      try {
        const arrayMatch = result.analysis.match(/\[(.*?)\]/);
        if (arrayMatch) {
          queries = JSON.parse(`[${arrayMatch[1]}]`);
        }
      } catch (parseError) {
        console.warn('Failed to parse search queries from analysis');
      }
    }

    // Ensure we have valid queries
    if (!Array.isArray(queries) || queries.length === 0) {
      queries = [task.objective];
    }

    return queries.slice(0, 5); // Limit to 5 queries max
  }

  /**
   * Perform web searches using the search tool
   */
  private async _performSearches(queries: string[], maxResults: number): Promise<SearchResult[]> {
    const resultsPerQuery = Math.ceil(maxResults / queries.length);
    const allResults: SearchResult[] = [];

    console.log(`[SEARCH AGENT] Executing ${queries.length} searches with ~${resultsPerQuery} results each`);

    // Perform searches in parallel
    const searchPromises = queries.map(async (query) => {
      try {
        console.log(`[SEARCH AGENT] Searching: "${query}"`);
        const searchResponse = await this.run(`Please search for: ${query}`, 1);

        // Parse search results from response
        const results = this._parseSearchResponse(searchResponse, query);
        console.log(`[SEARCH AGENT] Found ${results.length} results for: "${query}"`);

        return results;
      } catch (error) {
        console.warn(`[SEARCH AGENT] Search failed for "${query}": ${error}`);
        return [];
      }
    });

    const searchResultArrays = await Promise.all(searchPromises);

    // Flatten and deduplicate results
    for (const resultArray of searchResultArrays) {
      for (const result of resultArray) {
        if (!allResults.some(existing => existing.url === result.url)) {
          allResults.push(result);
        }
      }
    }

    return allResults.slice(0, maxResults);
  }

  /**
   * Parse search response into SearchResult objects
   */
  private _parseSearchResponse(response: string, query: string): SearchResult[] {
    const results: SearchResult[] = [];

    // Look for search result patterns in the response
    const resultPattern = /(\d+)\.\s\*\*(.*?)\*\*\s*URL:\s*(https?:\/\/[^\s]+)\s*(.*?)(?=\d+\.\s|\n\n|$)/g;

    let match;
    while ((match = resultPattern.exec(response)) !== null) {
      const [, , title, url, snippet] = match;

      if (title && url) {
        results.push({
          title: title.trim(),
          url: url.trim(),
          snippet: (snippet || '').trim(),
          relevance_score: 0.5 // Will be updated in evaluation
        });
      }
    }

    // If no structured results found, try to extract URLs and titles differently
    if (results.length === 0) {
      const urlPattern = /https?:\/\/[^\s]+/g;
      const urls = response.match(urlPattern) || [];

      urls.forEach((url, index) => {
        results.push({
          title: `Search result ${index + 1}`,
          url,
          snippet: 'Content from search results',
          relevance_score: 0.4
        });
      });
    }

    return results;
  }

  /**
   * Evaluate search results for relevance and quality
   */
  private async _evaluateResults(results: SearchResult[], task: SubAgentTask): Promise<SearchResult[]> {
    console.log(`[SEARCH AGENT] Evaluating ${results.length} search results`);

    const evaluationPrompt = `
Evaluate these search results for relevance to the research task:

**Task Objective:** ${task.objective}
**Search Focus:** ${task.search_focus}

**Search Results:**
${results.map((result, index) =>
      `${index + 1}. **${result.title}**\n   URL: ${result.url}\n   Snippet: ${result.snippet}`
    ).join('\n\n')}

For each result, assign a relevance score from 0.0 to 1.0 based on:
- How well it matches the task objective
- Authority and credibility of the source
- Recency and accuracy of information
- Depth and quality of content

Respond with JSON:
{
  "evaluations": [
    {
      "index": 0,
      "relevance_score": 0.8,
      "reasoning": "Brief explanation"
    }
  ]
}

Only include results with relevance_score >= 0.6
`;

    const evaluationResult = await this.think(evaluationPrompt);

    if (evaluationResult.error || !evaluationResult.evaluations) {
      // Fallback: basic filtering by domain authority
      return results.filter(result => {
        const domain = new URL(result.url).hostname;
        const authorityDomains = ['.edu', '.gov', '.org'];
        const hasAuthority = authorityDomains.some(suffix => domain.includes(suffix));

        result.relevance_score = hasAuthority ? 0.7 : 0.5;
        return result.relevance_score >= 0.5;
      });
    }

    // Apply evaluations
    const evaluatedResults: SearchResult[] = [];

    for (const evaluation of evaluationResult.evaluations || []) {
      if (evaluation.index >= 0 && evaluation.index < results.length) {
        const result = results[evaluation.index];
        if (result) {
          result.relevance_score = evaluation.relevance_score || 0.5;

          if (result.relevance_score >= 0.6) {
            evaluatedResults.push(result);
          }
        }
      }
    }

    console.log(`[SEARCH AGENT] ${evaluatedResults.length} results passed evaluation (>= 0.6 relevance)`);
    return evaluatedResults;
  }

  /**
   * Extract key findings from search results
   */
  private async _extractFindings(results: SearchResult[], task: SubAgentTask): Promise<Record<string, any>[]> {
    if (results.length === 0) {
      return [];
    }

    const extractionPrompt = `
Extract key findings from these search results for the research task:

**Task Objective:** ${task.objective}
**Expected Output Format:** ${task.expected_output_format}

**Search Results:**
${results.slice(0, 5).map((result, index) => // Limit to top 5 results
      `${index + 1}. **${result.title}** (Relevance: ${result.relevance_score})
   ${result.snippet}
   ${result.content || ''}`
    ).join('\n\n')}

Extract specific, factual findings that directly address the task objective. Focus on:
- Key facts, figures, and statistics
- Important concepts and definitions
- Expert opinions and insights
- Recent developments and trends
- Authoritative statements and conclusions

Format as JSON array:
[
  {
    "finding": "Specific factual statement or insight",
    "source_title": "Title of source",
    "source_url": "URL",
    "confidence": 0.8,
    "type": "fact|statistic|opinion|trend|definition"
  }
]

Be precise and cite specific sources for each finding.
`;

    const extractionResult = await this._callLLM([
      { role: 'system', content: 'Extract key findings from search results.' },
      { role: 'user', content: extractionPrompt }
    ], { maxTokens: 1500, temperature: 0.2 });

    try {
      // Try to parse JSON from the response
      const jsonMatch = extractionResult.text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const findings = JSON.parse(jsonMatch[0]);
        if (Array.isArray(findings)) {
          console.log(`[SEARCH AGENT] Extracted ${findings.length} findings`);
          return findings;
        }
      }
    } catch (parseError) {
      console.warn('Failed to parse findings JSON, creating fallback findings');
    }

    // Fallback: create basic findings from top results
    return results.slice(0, 3).map(result => ({
      finding: result.snippet,
      source_title: result.title,
      source_url: result.url,
      confidence: result.relevance_score,
      type: 'general'
    }));
  }

  /**
   * Check if we have sufficient information
   */
  private async _hasSufficientInformation(findings: Record<string, any>[], task: SubAgentTask): Promise<boolean> {
    // Simple heuristics for determining sufficiency
    const minFindings = 3;
    const avgConfidence = findings.length > 0
      ? findings.reduce((sum, f) => sum + (f.confidence || 0.5), 0) / findings.length
      : 0;

    return findings.length >= minFindings && avgConfidence >= 0.6;
  }

  /**
   * Summarize findings into a coherent summary
   */
  private async _summarizeFindings(findings: Record<string, any>[], task: SubAgentTask): Promise<string> {
    if (findings.length === 0) {
      return "No significant findings were discovered for this research task.";
    }

    const summaryPrompt = `
Summarize these research findings for the task: "${task.objective}"

**Findings:**
${findings.map((finding, index) =>
      `${index + 1}. ${finding.finding} (Source: ${finding.source_title}, Confidence: ${finding.confidence})`
    ).join('\n')}

Create a concise, coherent summary that:
1. Highlights the most important discoveries
2. Addresses the task objective directly
3. Notes any significant patterns or themes
4. Mentions the overall quality and confidence of findings
5. Is structured in ${task.expected_output_format}

Keep the summary focused and actionable, around 2-3 paragraphs.
`;

    const summaryResult = await this._callLLM([
      { role: 'system', content: 'Summarize research findings concisely.' },
      { role: 'user', content: summaryPrompt }
    ], { maxTokens: 800, temperature: 0.3 });

    return summaryResult.text.trim();
  }
} 