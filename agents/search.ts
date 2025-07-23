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
    const queryPrompt = `
Generate 3-5 targeted search queries for this research task. Focus on creating KEYWORD-BASED queries that search engines will understand, not full sentences or instructions.

**Objective:** ${task.objective}
**Search Focus:** ${task.search_focus}
**Expected Output:** ${task.expected_output_format}

IMPORTANT GUIDELINES:
1. Use KEYWORDS and PHRASES, not full sentences
2. Avoid instructional words like "find", "search for", "identify", "look for"
3. Include specific terms, company names, dates, numbers
4. Add temporal constraints (2024, 2025, recent) for current information
5. Use quotes for exact phrases when needed
6. Consider different aspects and synonyms

GOOD EXAMPLES:
- "top AI startups 2024 funding"
- "unicorn startups artificial intelligence 2025"
- "venture capital AI companies Forbes TechCrunch"

BAD EXAMPLES:
- "Identify the top 3 AI startups recognized by authoritative media"
- "Find information about recent AI startup funding"
- "Search for the best artificial intelligence companies"

Respond with a JSON array of KEYWORD-BASED search query strings:
["query 1", "query 2", "query 3", ...]

Focus on creating queries that search engines will rank highly for relevant, authoritative sources.
`;

    const result = await this.think(queryPrompt);

    if (result.error) {
      // Improved fallback queries with keyword focus
      const keywordQueries = this._generateKeywordFallbackQueries(task);
      console.log(`[SEARCH AGENT] Query generation failed, using keyword fallbacks: ${keywordQueries.join(', ')}`);
      return keywordQueries;
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

    // Ensure we have valid queries and optimize them
    if (!Array.isArray(queries) || queries.length === 0) {
      queries = this._generateKeywordFallbackQueries(task);
    }

    // Clean and optimize the queries
    const optimizedQueries = queries
      .slice(0, 5) // Limit to 5 queries max
      .map((q: string) => this._optimizeQueryForSearch(q, task))
      .filter((q: string) => q.length > 0);

    return optimizedQueries.length > 0 ? optimizedQueries : this._generateKeywordFallbackQueries(task);
  }

  /**
   * Generate keyword-focused fallback queries
   */
  private _generateKeywordFallbackQueries(task: SubAgentTask): string[] {
    const objective = task.objective.toLowerCase();
    const focus = task.search_focus.toLowerCase();

    // Extract key terms
    const keyTerms = this._extractKeyTermsFromTask(objective, focus);

    const queries: string[] = [];

    // Primary query: main keywords
    queries.push(keyTerms.slice(0, 4).join(' '));

    // Secondary query: add temporal constraints
    queries.push(`${keyTerms.slice(0, 3).join(' ')} 2024 2025`);

    // Tertiary query: add authority sources
    if (objective.includes('startup') || objective.includes('company')) {
      queries.push(`${keyTerms.slice(0, 3).join(' ')} TechCrunch Forbes`);
    }

    return queries.slice(0, 3);
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

    // Perform searches sequentially to respect rate limits (not parallel)
    const searchResultArrays: SearchResult[][] = [];

    for (const query of queries) {
      try {
        console.log(`[SEARCH AGENT] Searching: "${query}"`);

        // Call the search tool directly with optimization enabled
        const searchResult = await this._callLLM([
          { role: 'system', content: 'You are a search assistant. Use the search tool to find information.' },
          { role: 'user', content: query }
        ], {
          maxTokens: 1000,
          temperature: 0.1,
          tools: true
        });

        // Parse search results from response
        const results = this._parseSearchResponse(searchResult.text, query);
        console.log(`[SEARCH AGENT] Found ${results.length} results for: "${query}"`);

        searchResultArrays.push(results);
      } catch (error) {
        console.warn(`[SEARCH AGENT] Search failed for "${query}": ${error}`);
        searchResultArrays.push([]);
      }
    }

    // Flatten and deduplicate results
    for (const resultArray of searchResultArrays) {
      for (const result of resultArray) {
        if (!allResults.some(existing => existing.url === result.url)) {
          allResults.push(result);
        }
      }
    }

    // If we didn't get enough results, try additional refined searches
    if (allResults.length < maxResults * 0.6 && allResults.length < maxResults) {
      console.log(`[SEARCH AGENT] Initial search yielded ${allResults.length} results, trying refinements...`);

      const additionalQueries = this._generateRefinedQueries(queries, allResults);

      for (const refinedQuery of additionalQueries) {
        if (allResults.length >= maxResults) break;

        try {
          console.log(`[SEARCH AGENT] Refined search: "${refinedQuery}"`);

          // Add a small delay between refined searches to be extra safe with rate limits
          await new Promise(resolve => setTimeout(resolve, 500));

          const searchResult = await this._callLLM([
            { role: 'system', content: 'You are a search assistant. Use the search tool to find information.' },
            { role: 'user', content: refinedQuery }
          ], {
            maxTokens: 1000,
            temperature: 0.1,
            tools: true
          });

          const results = this._parseSearchResponse(searchResult.text, refinedQuery);
          console.log(`[SEARCH AGENT] Refined search found ${results.length} additional results`);

          // Add new unique results
          for (const result of results) {
            if (!allResults.some(existing => existing.url === result.url) && allResults.length < maxResults) {
              allResults.push(result);
            }
          }
        } catch (error) {
          console.warn(`[SEARCH AGENT] Refined search failed for "${refinedQuery}": ${error}`);
          continue;
        }
      }
    }

    return allResults.slice(0, maxResults);
  }

  /**
   * Generate refined queries based on initial results
   */
  private _generateRefinedQueries(originalQueries: string[], currentResults: SearchResult[]): string[] {
    const refinedQueries: string[] = [];

    // Extract successful terms from current results
    const successfulTerms = new Set<string>();
    currentResults.forEach(result => {
      const titleTerms = result.title.toLowerCase().split(/\s+/);
      titleTerms.forEach(term => {
        if (term.length > 3) successfulTerms.add(term);
      });
    });

    // Strategy 1: Combine successful terms with authority sources
    const authoritySources = ['TechCrunch', 'Forbes', 'VentureBeat', 'Reuters', 'Bloomberg'];
    if (successfulTerms.size > 0 && authoritySources[0]) {
      const topTerms = Array.from(successfulTerms).slice(0, 3);
      refinedQueries.push(`${topTerms.join(' ')} site:${authoritySources[0].toLowerCase()}.com`);
    }

    // Strategy 2: Add more specific industry terms
    const firstQuery = originalQueries[0] || '';
    if (firstQuery.includes('AI') || firstQuery.includes('artificial intelligence')) {
      refinedQueries.push(`${firstQuery} machine learning deep learning`);
    }
    if (firstQuery.includes('startup')) {
      refinedQueries.push(`${firstQuery} unicorn valuation funding series`);
    }

    // Strategy 3: Try broader terms if queries were too specific
    if (originalQueries.length > 0 && originalQueries[0]) {
      const broadQuery = originalQueries[0].split(' ').slice(0, 3).join(' ');
      if (!originalQueries.includes(broadQuery)) {
        refinedQueries.push(broadQuery);
      }
    }

    return [...new Set(refinedQueries)].slice(0, 2);
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