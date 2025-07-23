import axios from 'axios';
import * as cheerio from 'cheerio';
import { config } from 'dotenv';
import { BaseTool, ToolSchema, ToolResult } from '../types/tool.js';
import { cacheWithRedis } from '../utils/cache.js';

// Load environment variables from .env file
config();

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  content?: string;
}

interface BraveSearchResult {
  title: string;
  url: string;
  description: string;
}

interface BraveSearchResponse {
  web?: {
    results: BraveSearchResult[];
  };
}

// Global request queue to handle burst traffic and rate limiting
class RequestQueue {
  private static instance: RequestQueue;
  private queue: Array<{ resolve: Function; reject: Function; fn: Function }> = [];
  private processing = false;
  private lastRequestTime = 0;
  private readonly MIN_INTERVAL = 1200; // 1.2 seconds to be extra safe

  static getInstance(): RequestQueue {
    if (!RequestQueue.instance) {
      RequestQueue.instance = new RequestQueue();
    }
    return RequestQueue.instance;
  }

  async enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ resolve, reject, fn });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift()!;

      try {
        // Ensure minimum interval between requests
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;

        if (timeSinceLastRequest < this.MIN_INTERVAL) {
          const delayNeeded = this.MIN_INTERVAL - timeSinceLastRequest;
          console.log(`[SEARCH QUEUE] Rate limiting: waiting ${delayNeeded}ms`);
          await new Promise(resolve => setTimeout(resolve, delayNeeded));
        }

        this.lastRequestTime = Date.now();
        const result = await item.fn();
        item.resolve(result);

      } catch (error) {
        item.reject(error);
      }
    }

    this.processing = false;
  }
}

export class SearchTool extends BaseTool {
  name = 'search';
  description = 'Search the web using Brave Search API with intelligent query optimization and result refinement.';

  schema: ToolSchema = {
    name: 'search',
    description: this.description,
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query to execute',
        },
        max_results: {
          type: 'number',
          description: 'Maximum number of results to return (default: 5)',
        },
        enable_refinement: {
          type: 'boolean',
          description: 'Enable automatic query refinement if initial results are poor (default: false)',
        }
      },
      required: ['query']
    }
  };

  private performSearch: (query: string, maxResults: number, apiKey: string) => Promise<SearchResult[]>;
  private requestQueue = RequestQueue.getInstance();

  constructor() {
    super();
    // Wrap the search logic with our cache.
    this.performSearch = cacheWithRedis(
      'search-tool', // This is the Redis key prefix
      this._performSearch.bind(this) // The actual function to execute on a cache miss
    );
  }

  async execute(params: Record<string, any>): Promise<ToolResult> {
    try {
      const { query, max_results = 5, enable_refinement = false } = params;

      if (!query || typeof query !== 'string') {
        return {
          success: false,
          result: '',
          error: 'Query parameter is required and must be a string'
        };
      }

      // Check for API key
      const apiKey = process.env.BRAVE_SEARCH_API_KEY;
      if (!apiKey) {
        return {
          success: false,
          result: '',
          error: 'BRAVE_SEARCH_API_KEY environment variable is required. Please set it in your .env file or environment variables. Get your API key from https://api.search.brave.com'
        };
      }

      // Optimize the search query for search engines (limit to 1 query for most cases)
      const optimizedQueries = this.optimizeSearchQuery(query).slice(0, 1); // Reduced from 2 to 1
      console.log(`[SEARCH TOOL] Original query: "${query}"`);
      console.log(`[SEARCH TOOL] Optimized queries: ${optimizedQueries.map(q => `"${q}"`).join(', ')}`);

      let allResults: SearchResult[] = [];
      let bestScore = 0;

      // Try the primary optimized query with the global request queue
      for (const optimizedQuery of optimizedQueries) {
        try {
          const searchResults = await this.requestQueue.enqueue(async () => {
            return await this.performSearch(optimizedQuery, max_results, apiKey);
          });

          console.log(`[SEARCH TOOL] Query result `, searchResults);

          if (searchResults.length > 0) {
            // Calculate a quality score for these results
            const qualityScore = this.calculateResultsQuality(searchResults, query);
            console.log(`[SEARCH TOOL] Query "${optimizedQuery}" returned ${searchResults.length} results with quality score ${qualityScore.toFixed(2)}`);

            // Keep track of all results for deduplication
            for (const result of searchResults) {
              if (!allResults.some(existing => existing.url === result.url)) {
                allResults.push(result);
              }
            }

            // Update best score
            if (qualityScore > bestScore) {
              bestScore = qualityScore;
            }
          }
        } catch (error) {
          console.warn(`[SEARCH TOOL] Search failed for optimized query "${optimizedQuery}": ${error}`);
          continue;
        }

        // If we have good results from the first query, stop here
        if (allResults.length >= Math.ceil(max_results * 0.8) && bestScore > 0.4) {
          break;
        }
      }

      // Only try refinement if explicitly enabled AND we have zero results
      if (enable_refinement && allResults.length === 0) {
        console.log(`[SEARCH TOOL] No results found. Trying one final refined query...`);

        const refinedQuery = this.generateSimpleRefinedQuery(query);
        if (refinedQuery && refinedQuery !== optimizedQueries[0]) {
          try {
            const searchResults = await this.requestQueue.enqueue(async () => {
              return await this.performSearch(refinedQuery, max_results, apiKey);
            });

            console.log(`[SEARCH TOOL] Refined query "${refinedQuery}" returned ${searchResults.length} results`);

            // Add new unique results
            for (const result of searchResults) {
              if (!allResults.some(existing => existing.url === result.url) && allResults.length < max_results) {
                allResults.push(result);
              }
            }
          } catch (error) {
            console.warn(`[SEARCH TOOL] Refined search failed for "${refinedQuery}": ${error}`);
          }
        }
      }

      // Return top results up to max_results
      const finalResults = allResults.slice(0, max_results);

      if (finalResults.length === 0) {
        return {
          success: true,
          result: `No results found for query: ${query}. This may be due to API rate limiting. Please try again in a few seconds, or consider using fewer concurrent searches.`
        };
      }

      // Format results with quality indicators
      const formattedResults = finalResults.map((result, index) => {
        const qualityIndicator = this.getQualityIndicator(result);
        return `${index + 1}. **${result.title}** ${qualityIndicator}\n   URL: ${result.url}\n   ${result.snippet}${result.content ? `\n   Content: ${result.content.slice(0, 200)}...` : ''}`
      }).join('\n\n');

      const resultSummary = `Found ${finalResults.length} results from ${optimizedQueries.length} queries (quality score: ${bestScore.toFixed(2)})`;

      return {
        success: true,
        result: `Search results for "${query}":\n\n${resultSummary}\n\n${formattedResults}`
      };
    } catch (error) {
      return {
        success: false,
        result: '',
        error: `Search error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Optimize search query for search engines by transforming natural language into keywords
   * Simplified to reduce API calls and complexity
   */
  private optimizeSearchQuery(originalQuery: string): string[] {
    const queries: string[] = [];

    // Remove common instruction words and phrases
    let optimized = originalQuery
      .replace(/^(please\s+|can you\s+|search for\s+|find\s+|identify\s+|look for\s+)/i, '')
      .replace(/\s+(please|thanks?|thank you)$/i, '')
      .replace(/\b(the|a|an|of|in|on|at|by|for|with|to|from)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Extract key terms and phrases
    const keyTerms = this.extractKeyTerms(optimized);

    // Primary optimized query: key terms only
    if (keyTerms.length > 0) {
      queries.push(keyTerms.join(' '));
    }

    // Secondary query: add current date context if needed (fixing date parsing issue)
    const temporalQuery = this.addCurrentDateContext(keyTerms.join(' '), originalQuery);
    if (temporalQuery !== keyTerms.join(' ') && !queries.includes(temporalQuery)) {
      queries.push(temporalQuery);
    }

    // Fallback: use original if no optimization was possible
    if (queries.length === 0) {
      queries.push(originalQuery);
    }

    // Limit to 2 queries max to reduce API calls
    return queries.slice(0, 2);
  }

  /**
   * Extract key terms from the query
   */
  private extractKeyTerms(query: string): string[] {
    // Common stop words to remove
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'among', 'under', 'over', 'within', 'without', 'across', 'behind', 'beyond', 'around', 'near', 'far', 'since', 'until', 'while', 'during', 'because', 'as', 'if', 'when', 'where', 'why', 'how', 'what', 'which', 'who', 'whom', 'whose', 'that', 'this', 'these', 'those', 'some', 'any', 'each', 'every', 'all', 'both', 'few', 'many', 'much', 'most', 'more', 'less', 'other', 'another', 'such', 'no', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'can', 'will', 'just', 'should', 'now', 'get', 'has', 'had', 'have', 'is', 'was', 'are', 'were', 'be', 'been', 'being', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall'
    ]);

    const words = query.toLowerCase().split(/\s+/);
    const keyTerms: string[] = [];

    for (const word of words) {
      const cleanWord = word.replace(/[^\w]/g, '');
      if (cleanWord.length > 2 && !stopWords.has(cleanWord)) {
        keyTerms.push(cleanWord);
      }
    }

    return keyTerms;
  }

  /**
   * Add current date context to queries - fixing the date parsing issue
   */
  private addCurrentDateContext(baseQuery: string, originalQuery: string): string {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear().toString(); // 2025
    const currentMonth = currentDate.toLocaleString('default', { month: 'long' }); // July

    // Check if query mentions temporal terms
    const hasTemporalTerms = /\b(recent|latest|current|new|this year|last year|this month|last month|today|recently|2024|2025)\b/i.test(originalQuery);

    if (hasTemporalTerms) {
      // Add current context: "Current month is July 2025"
      return `${baseQuery} ${currentMonth} ${currentYear}`;
    }

    // Default recent constraint for competitive queries
    if (originalQuery.toLowerCase().includes('top') || originalQuery.toLowerCase().includes('best') || originalQuery.toLowerCase().includes('ranking')) {
      return `${baseQuery} ${currentYear}`;
    }

    return baseQuery;
  }

  /**
   * Calculate quality score for search results
   */
  private calculateResultsQuality(results: SearchResult[], originalQuery: string): number {
    if (results.length === 0) return 0;

    let totalScore = 0;
    const queryTerms = this.extractKeyTerms(originalQuery);

    for (const result of results) {
      let score = 0;

      // Check domain authority
      const domain = new URL(result.url).hostname.toLowerCase();
      const authorityDomains = ['.edu', '.gov', '.org'];
      const highQualityDomains = ['techcrunch.com', 'forbes.com', 'reuters.com', 'bloomberg.com', 'wsj.com', 'nytimes.com', 'bbc.com', 'cnn.com', 'theguardian.com', 'wired.com', 'arstechnica.com', 'venturebeat.com', 'crunchbase.com'];

      if (authorityDomains.some(suffix => domain.includes(suffix))) {
        score += 0.3;
      } else if (highQualityDomains.some(domain_name => domain.includes(domain_name))) {
        score += 0.4;
      }

      // Check term relevance in title and snippet
      const titleText = result.title.toLowerCase();
      const snippetText = result.snippet.toLowerCase();

      let termMatches = 0;
      for (const term of queryTerms) {
        if (titleText.includes(term.toLowerCase()) || snippetText.includes(term.toLowerCase())) {
          termMatches++;
        }
      }

      score += (termMatches / queryTerms.length) * 0.5;

      // Bonus for recency indicators with correct current year
      const currentYear = new Date().getFullYear().toString();
      if (titleText.includes(currentYear) || snippetText.includes(currentYear)) {
        score += 0.2;
      }

      totalScore += Math.min(score, 1.0);
    }

    return totalScore / results.length;
  }

  /**
   * Get quality indicator for display
   */
  private getQualityIndicator(result: SearchResult): string {
    const domain = new URL(result.url).hostname.toLowerCase();
    const authorityDomains = ['.edu', '.gov', '.org'];
    const highQualityDomains = ['techcrunch.com', 'forbes.com', 'reuters.com', 'bloomberg.com'];

    if (authorityDomains.some(suffix => domain.includes(suffix))) {
      return '🏛️';
    } else if (highQualityDomains.some(domain_name => domain.includes(domain_name))) {
      return '📰';
    }
    return '';
  }

  /**
   * Generate a single, simple refined query to avoid overcomplication
   */
  private generateSimpleRefinedQuery(originalQuery: string): string | null {
    const keyTerms = this.extractKeyTerms(originalQuery);

    // Only try refinement if we have sufficient terms
    if (keyTerms.length < 2) {
      return null;
    }

    // Simple strategy: try with fewer terms if original was too specific
    if (keyTerms.length > 3) {
      return keyTerms.slice(0, 3).join(' ');
    }

    // Add one simple context term based on query type
    if (originalQuery.toLowerCase().includes('startup') || originalQuery.toLowerCase().includes('company')) {
      return `${keyTerms.join(' ')} funding`;
    }

    if (originalQuery.toLowerCase().includes('ai') || originalQuery.toLowerCase().includes('artificial intelligence')) {
      return `${keyTerms.join(' ')} technology`;
    }

    return null;
  }

  private async _performSearch(query: string, maxResults: number, apiKey: string): Promise<SearchResult[]> {
    const maxRetries = 2; // Reduced from 3 to limit API calls
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        // Use Brave Web Search API
        const response = await axios.get('https://api.search.brave.com/res/v1/web/search', {
          params: {
            q: query,
            count: maxResults
          },
          headers: {
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip',
            'X-Subscription-Token': apiKey
          },
          timeout: 15000 // Reduced timeout
        });

        const data: BraveSearchResponse = response.data;
        const results: SearchResult[] = [];

        // Extract results from Brave API response
        if (data.web?.results) {
          data.web.results.forEach((result) => {
            if (result.title && result.url) {
              results.push({
                title: result.title,
                url: result.url,
                snippet: result.description || ''
              });
            }
          });
        }

        // Skip content extraction to reduce complexity and potential failures
        // Content extraction was causing additional delays and errors

        return results;
      } catch (error: any) {
        attempt++;

        // Handle rate limiting (429) and other retryable errors
        if (error.response?.status === 429 || error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
          if (attempt < maxRetries) {
            // Longer backoff for rate limiting
            const baseDelay = Math.pow(2, attempt) * 2000; // Doubled base delay
            const jitter = Math.random() * 1000;
            const delayMs = baseDelay + jitter;

            console.log(`[SEARCH TOOL] Rate limited (attempt ${attempt}), retrying in ${Math.round(delayMs)}ms`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
            continue;
          } else {
            // After max retries, throw a more informative error
            throw new Error(`Persistent rate limiting detected. API calls are being throttled. Consider reducing search frequency or implementing longer delays between requests.`);
          }
        }

        // For non-retryable errors
        const errorMsg = error.response?.status === 429
          ? `Rate limited after ${maxRetries} attempts. API quota may be exceeded.`
          : `Failed to perform search: ${error instanceof Error ? error.message : 'Unknown error'}`;

        throw new Error(errorMsg);
      }
    }

    throw new Error('Search failed after all retry attempts');
  }
} 