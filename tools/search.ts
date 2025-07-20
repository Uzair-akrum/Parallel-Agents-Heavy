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

export class SearchTool extends BaseTool {
  name = 'search';
  description = 'Search the web using Brave Search API and extract content from results.';

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
        }
      },
      required: ['query']
    }
  };

  private performSearch: (query: string, maxResults: number, apiKey: string) => Promise<SearchResult[]>;

  constructor() {
    super();
    // Wrap the search logic with our cache.
    // The original method is now cached, but the rest of the class can call it
    // using `this.performSearch` as if nothing has changed.
    this.performSearch = cacheWithRedis(
      'search-tool', // This is the Redis key prefix
      this._performSearch.bind(this) // The actual function to execute on a cache miss
    );
  }

  async execute(params: Record<string, any>): Promise<ToolResult> {
    try {
      const { query, max_results = 5 } = params;

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

      // Use Brave Web Search API
      const searchResults = await this.performSearch(query, max_results, apiKey);

      if (searchResults.length === 0) {
        return {
          success: true,
          result: `No results found for query: ${query}`
        };
      }

      // Format results
      const formattedResults = searchResults.map((result, index) =>
        `${index + 1}. **${result.title}**\n   URL: ${result.url}\n   ${result.snippet}${result.content ? `\n   Content: ${result.content.slice(0, 200)}...` : ''}`
      ).join('\n\n');

      return {
        success: true,
        result: `Search results for "${query}":\n\n${formattedResults}`
      };
    } catch (error) {
      return {
        success: false,
        result: '',
        error: `Search error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async _performSearch(query: string, maxResults: number, apiKey: string): Promise<SearchResult[]> {
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
        timeout: 30000
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

      // Extract content from first few results
      await Promise.all(
        results.slice(0, 2).map(async (result) => {
          try {
            const content = await this.extractContent(result.url);
            result.content = content;
          } catch (error) {
            // Silently ignore content extraction errors
          }
        })
      );

      return results;
    } catch (error) {
      throw new Error(`Failed to perform search: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async extractContent(url: string): Promise<string> {
    try {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      const $ = cheerio.load(response.data);

      // Remove script and style elements
      $('script, style, nav, footer, header, aside').remove();

      // Extract main content
      const content = $('main, article, .content, #content, .post, .entry')
        .first()
        .text()
        .replace(/\s+/g, ' ')
        .trim();

      if (content.length > 100) {
        return content.slice(0, 1000);
      }

      // Fallback to body text
      return $('body')
        .text()
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 1000);
    } catch (error) {
      throw new Error(`Failed to extract content from ${url}`);
    }
  }
} 