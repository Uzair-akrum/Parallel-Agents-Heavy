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
    console.log(`🔢 [SEARCH AGENT] Max Searches: ${task.max_searches || 8}`);

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
      const searchResults = await this._performSearches(searchQueries, task.max_searches || 8);
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

      if (!hasSufficientInfo && searchResults.length < (task.max_searches || 8)) {
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
    // Primary strategy: Generate deterministic keyword-based queries
    console.log(`[SEARCH AGENT] Generating queries for objective: "${task.objective}"`);

    // Extract key terms deterministically
    const keyTerms = this._extractKeyTermsFromTask(task.objective.toLowerCase(), task.search_focus.toLowerCase());
    console.log(`[SEARCH AGENT] Extracted key terms: ${keyTerms.join(', ')}`);

    // Generate initial keyword-focused queries
    const deterministicQueries = this._generateDeterministicQueries(task, keyTerms);
    console.log(`[SEARCH AGENT] Generated ${deterministicQueries.length} deterministic queries`);

    // Try LLM enhancement only as a secondary strategy
    let enhancedQueries: string[] = [];
    try {
      const queryPrompt = `
Generate 2-3 additional keyword-based search queries for this research task. Focus on creating KEYWORD-BASED queries that search engines will understand.

**Objective:** ${task.objective}
**Search Focus:** ${task.search_focus}
**Existing queries:** ${deterministicQueries.join(', ')}

CRITICAL: Use KEYWORDS and PHRASES only, not full sentences. Include specific terms, company names, dates, numbers.

Respond with ONLY a JSON array of query strings: ["query 1", "query 2"]
`;

      const result = await this.think(queryPrompt);

      if (!result.error && result.analysis) {
        try {
          const arrayMatch = result.analysis.match(/\[(.*?)\]/);
          if (arrayMatch) {
            enhancedQueries = JSON.parse(`[${arrayMatch[1]}]`)
              .map((q: string) => this._optimizeQueryForSearch(q, task))
              .filter((q: string) => q.length > 0);
          }
        } catch (parseError) {
          console.warn('[SEARCH AGENT] Failed to parse enhanced queries from LLM');
        }
      }
    } catch (error) {
      console.warn('[SEARCH AGENT] LLM query enhancement failed, using deterministic queries only');
    }

    // Combine and deduplicate
    const allQueries = [...deterministicQueries, ...enhancedQueries];
    const uniqueQueries = [...new Set(allQueries)].slice(0, 5);

    console.log(`[SEARCH AGENT] Final query set: ${uniqueQueries.join(', ')}`);
    return uniqueQueries;
  }

  /**
   * Generate deterministic keyword-based queries without LLM dependency
   */
  private _generateDeterministicQueries(task: SubAgentTask, keyTerms: string[]): string[] {
    const queries: string[] = [];
    const objective = task.objective.toLowerCase();

    // Query 1: Core keywords with date constraint
    if (keyTerms.length >= 2) {
      queries.push(`${keyTerms.slice(0, 4).join(' ')} 2024 2025`);
    }

    // Query 2: Add authority sources for credible results
    if (keyTerms.length >= 2) {
      if (objective.includes('startup') || objective.includes('company')) {
        queries.push(`${keyTerms.slice(0, 3).join(' ')} TechCrunch Forbes VentureBeat`);
      } else if (objective.includes('ai') || objective.includes('artificial intelligence')) {
        queries.push(`${keyTerms.slice(0, 3).join(' ')} AI technology`);
      } else {
        queries.push(`${keyTerms.slice(0, 3).join(' ')} industry report`);
      }
    }

    // Query 3: Broader keywords for coverage
    if (keyTerms.length >= 3) {
      queries.push(keyTerms.slice(0, 3).join(' '));
    }

    // Query 4: Specific domain focus if applicable
    if (objective.includes('ranking') || objective.includes('top') || objective.includes('best')) {
      const rankingTerms = keyTerms.filter(term => !['ranking', 'top', 'best'].includes(term));
      if (rankingTerms.length >= 2) {
        queries.push(`top ${rankingTerms.slice(0, 2).join(' ')} ranking list`);
      }
    }

    return queries.filter(q => q.length > 0);
  }



  /**
   * Extract key terms from task objective and focus
   */
  private _extractKeyTermsFromTask(objective: string, focus: string): string[] {
    const combined = `${objective} ${focus}`;
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'find', 'search', 'identify', 'look', 'get', 'information', 'about', 'that', 'this', 'are', 'is', 'was', 'were', 'have', 'has', 'had', 'will', 'would', 'could', 'should']);

    return combined
      .toLowerCase()
      .split(/\s+/)
      .map(word => word.replace(/[^\w]/g, ''))
      .filter(word => word.length > 2 && !stopWords.has(word))
      .slice(0, 6);
  }

  /**
   * Optimize individual query for search engines
   */
  private _optimizeQueryForSearch(query: string, task: SubAgentTask): string {
    // Remove instructional phrases
    let optimized = query
      .replace(/^(please\s+|can you\s+|search for\s+|find\s+|identify\s+|look for\s+|get\s+)/i, '')
      .replace(/\s+(please|thanks?|thank you)$/i, '')
      .trim();

    // If it's still a full sentence, extract keywords
    if (optimized.split(' ').length > 6 || optimized.includes('?')) {
      const keyTerms = this._extractKeyTermsFromTask(optimized, '');
      optimized = keyTerms.join(' ');
    }

    // Add temporal constraints for competitive queries
    if (task.objective.toLowerCase().includes('top') || task.objective.toLowerCase().includes('best') || task.objective.toLowerCase().includes('recent')) {
      if (!optimized.includes('2024') && !optimized.includes('2025')) {
        optimized += ' 2024 2025';
      }
    }

    return optimized;
  }

  /**
   * Perform web searches using the enhanced search tool
   */
  private async _performSearches(queries: string[], maxResults: number): Promise<SearchResult[]> {
    const resultsPerQuery = Math.ceil(maxResults / queries.length);
    const allResults: SearchResult[] = [];

    console.log(`[SEARCH AGENT] Executing ${queries.length} searches with ~${resultsPerQuery} results each`);

    // Perform searches sequentially to respect rate limits
    for (let i = 0; i < queries.length; i++) {
      const query = queries[i];
      try {
        console.log(`[SEARCH AGENT] Searching (${i + 1}/${queries.length}): "${query}"`);

        // Call the search tool directly via the tool registry (bypassing LLM tool calling)
        console.log(`[SEARCH AGENT] Calling search tool directly with query: "${query}"`);

        const toolResult = await import('../tools/index.js').then(module =>
          module.toolRegistry.executeTool('search', {
            query: query,
            max_results: resultsPerQuery,
            enable_refinement: false
          })
        );

        let results: SearchResult[] = [];

        if (toolResult.success && toolResult.result) {
          console.log(`[SEARCH AGENT] Search tool succeeded, result type: ${typeof toolResult.result}`);
          console.log(`[SEARCH AGENT] Result preview: ${String(toolResult.result).substring(0, 200)}...`);

          // Parse the search tool's formatted output
          results = this._parseSearchResponse(String(toolResult.result), query);
        } else {
          console.warn(`[SEARCH AGENT] Search tool failed: ${toolResult.error || 'No result returned'}`);
        }
        console.log(`[SEARCH AGENT] Found ${results.length} results for: "${query}"`);

        // Add new unique results
        for (const result of results) {
          if (!allResults.some(existing => existing.url === result.url) && allResults.length < maxResults) {
            allResults.push(result);
          }
        }

        // Add small delay between searches to respect rate limits
        if (i < queries.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

      } catch (error) {
        console.warn(`[SEARCH AGENT] Search failed for "${query}": ${error}`);
        continue;
      }
    }

    console.log(`[SEARCH AGENT] Total unique results collected: ${allResults.length}`);
    return allResults.slice(0, maxResults);
  }


  /**
   * Parse search response into SearchResult objects - Fixed to handle actual SearchTool format
   */
  private _parseSearchResponse(response: string, query: string): SearchResult[] {
    const results: SearchResult[] = [];

    console.log(`[SEARCH AGENT] Parsing search response for "${query}"`);
    console.log(`[SEARCH AGENT] Response length: ${response.length} characters`);

    // Handle the actual format returned by SearchTool:
    // "Search results for 'query':
    // 
    // Found X results...
    // 
    // 1. **Title** 🏛️
    //    URL: http://example.com
    //    Snippet text
    //
    // 2. **Title**
    //    URL: http://example2.com
    //    Snippet text"

    // First, try to parse the structured format with proper line breaks
    const structuredPattern = /(\d+)\.\s*\*\*(.*?)\*\*[^\n]*\n\s*URL:\s*(https?:\/\/[^\s\n]+)\n\s*(.*?)(?=\n\s*\d+\.\s*\*\*|\n\n|$)/gs;

    let match;
    while ((match = structuredPattern.exec(response)) !== null) {
      const [, , title, url, snippet] = match;

      if (title && url) {
        const cleanTitle = title.trim().replace(/[🏛️📰🔬💼🌐]/g, ''); // Remove emoji indicators
        const cleanSnippet = (snippet || '').trim().replace(/Content:\s*/, ''); // Remove "Content:" prefix if present

        results.push({
          title: cleanTitle,
          url: url.trim(),
          snippet: cleanSnippet,
          relevance_score: 0.7 // Higher initial score for properly parsed results
        });
      }
    }

    // If structured parsing didn't work, try alternative patterns
    if (results.length === 0) {
      console.log(`[SEARCH AGENT] Structured parsing failed, trying alternative patterns`);

      // Try single-line format: "1. **Title** URL: http://... snippet"
      const singleLinePattern = /(\d+)\.\s*\*\*(.*?)\*\*\s*URL:\s*(https?:\/\/[^\s]+)\s*(.*?)(?=\d+\.\s*\*\*|\n\n|$)/g;

      while ((match = singleLinePattern.exec(response)) !== null) {
        const [, , title, url, snippet] = match;

        if (title && url) {
          results.push({
            title: title.trim(),
            url: url.trim(),
            snippet: (snippet || '').trim(),
            relevance_score: 0.6
          });
        }
      }
    }

    // If still no results, try to extract any URLs and titles we can find
    if (results.length === 0) {
      console.log(`[SEARCH AGENT] Standard parsing failed, trying URL extraction`);

      // Look for any URLs in the response
      const urlPattern = /https?:\/\/[^\s\n]+/g;
      const urls = response.match(urlPattern) || [];

      // Look for any titles in **bold** format
      const titlePattern = /\*\*(.*?)\*\*/g;
      const titles: string[] = [];
      let titleMatch;
      while ((titleMatch = titlePattern.exec(response)) !== null) {
        if (titleMatch[1]) {
          titles.push(titleMatch[1]);
        }
      }

      // Pair URLs with titles if possible
      const maxResults = Math.min(urls.length, Math.max(titles.length, 3));
      for (let i = 0; i < maxResults; i++) {
        const currentUrl = urls[i];
        if (currentUrl) {
          results.push({
            title: titles[i] || `Search result ${i + 1} for "${query}"`,
            url: currentUrl,
            snippet: `Found via search for: ${query}`,
            relevance_score: 0.4
          });
        }
      }
    }

    // If we still have no results, check if the search tool returned an error or "no results" message
    if (results.length === 0) {
      if (response.toLowerCase().includes('no results found') ||
        response.toLowerCase().includes('no significant findings') ||
        response.toLowerCase().includes('rate limit')) {
        console.log(`[SEARCH AGENT] Search tool reported no results or rate limiting for "${query}"`);
      } else {
        console.warn(`[SEARCH AGENT] Could not parse any results from response for "${query}"`);
        console.warn(`[SEARCH AGENT] Response sample: ${response.substring(0, 200)}...`);
      }
    }

    console.log(`[SEARCH AGENT] Successfully parsed ${results.length} results from response`);
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