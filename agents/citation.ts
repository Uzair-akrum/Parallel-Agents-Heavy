import { BaseAgent } from './base.js';
import { Config } from '../types/config.js';
import { CITATION_AGENT_PROMPT } from '../utils/prompts.js';
import { SearchResult, Citation } from '../types/schemas.js';

export class CitationAgent extends BaseAgent {
  constructor(config: Config) {
    super(config, CITATION_AGENT_PROMPT);
  }

  /**
   * Add citations to a research report
   */
  async addCitations(report: string, sources: SearchResult[]): Promise<{ report: string; citations: Citation[] }> {
    const timestamp = new Date().toISOString();

    console.log(`\n📚 [CITATION AGENT] ${timestamp} - STARTING CITATION PROCESS`);
    console.log(`📄 [CITATION AGENT] Report length: ${report.length} characters`);
    console.log(`🔗 [CITATION AGENT] Available sources: ${sources.length}`);
    console.log(`⭐ [CITATION AGENT] Source quality distribution:`);

    const qualityBuckets = { high: 0, medium: 0, low: 0 };
    sources.forEach(source => {
      if (source.relevance_score >= 0.8) qualityBuckets.high++;
      else if (source.relevance_score >= 0.6) qualityBuckets.medium++;
      else qualityBuckets.low++;
    });
    console.log(`   - High quality (≥0.8): ${qualityBuckets.high}`);
    console.log(`   - Medium quality (≥0.6): ${qualityBuckets.medium}`);
    console.log(`   - Lower quality (<0.6): ${qualityBuckets.low}`);

    const startTime = Date.now();

    try {
      // Step 1: Identify claims that need citations
      console.log(`\n🔍 [CITATION AGENT] STEP 1: Identifying citeable claims...`);
      const claimsStartTime = Date.now();
      const claims = await this._identifyClaims(report);
      const claimsDuration = Date.now() - claimsStartTime;

      console.log(`✅ [CITATION AGENT] Identified ${claims.length} claims in ${claimsDuration}ms:`);
      claims.slice(0, 3).forEach((claim, index) => {
        console.log(`   ${index + 1}. "${claim.claim.slice(0, 50)}..."`);
      });
      if (claims.length > 3) {
        console.log(`   ... and ${claims.length - 3} more claims`);
      }

      // Step 2: Match claims to sources
      console.log(`\n🔗 [CITATION AGENT] STEP 2: Matching claims to sources...`);
      const matchingStartTime = Date.now();
      const citationMatches = await this._matchClaimsToSources(claims, sources);
      const matchingDuration = Date.now() - matchingStartTime;

      console.log(`✅ [CITATION AGENT] Matched ${citationMatches.length}/${claims.length} citations in ${matchingDuration}ms:`);
      console.log(`   - Match rate: ${((citationMatches.length / claims.length) * 100).toFixed(1)}%`);
      console.log(`   - Unmatched claims: ${claims.length - citationMatches.length}`);

      // Step 3: Insert inline citations
      console.log(`\n📝 [CITATION AGENT] STEP 3: Inserting inline citations...`);
      const insertionStartTime = Date.now();
      const citedReport = await this._insertCitations(report, citationMatches);
      const insertionDuration = Date.now() - insertionStartTime;

      console.log(`✅ [CITATION AGENT] Inserted citations in ${insertionDuration}ms:`);
      console.log(`   - Citations inserted: ${citationMatches.length}`);
      console.log(`   - Report length change: ${report.length} → ${citedReport.length} chars (+${citedReport.length - report.length})`);

      // Step 4: Generate citation list
      console.log(`\n📋 [CITATION AGENT] STEP 4: Generating citation list...`);
      const listGenStartTime = Date.now();
      const citations = await this._generateCitationList(citationMatches);
      const listGenDuration = Date.now() - listGenStartTime;

      console.log(`✅ [CITATION AGENT] Generated citation list in ${listGenDuration}ms:`);
      console.log(`   - Unique citations: ${citations.length}`);
      console.log(`   - Average relevance: ${citations.length > 0 ? (citations.reduce((sum, c) => sum + c.relevance, 0) / citations.length).toFixed(3) : 'N/A'}`);

      // Step 5: Add bibliography
      console.log(`\n📖 [CITATION AGENT] STEP 5: Adding bibliography...`);
      const biblioStartTime = Date.now();
      const finalReport = await this.generateBibliography(citedReport, citations);
      const biblioDuration = Date.now() - biblioStartTime;

      console.log(`✅ [CITATION AGENT] Bibliography added in ${biblioDuration}ms:`);
      console.log(`   - Final report length: ${finalReport.length} chars`);
      console.log(`   - Bibliography entries: ${citations.length}`);

      const totalDuration = Date.now() - startTime;
      console.log(`\n🎉 [CITATION AGENT] CITATION PROCESS COMPLETED!`);
      console.log(`📊 [CITATION AGENT] Final Statistics:`);
      console.log(`   - Total duration: ${totalDuration}ms`);
      console.log(`   - Claims processed: ${claims.length}`);
      console.log(`   - Citations added: ${citationMatches.length}`);
      console.log(`   - Unique sources cited: ${citations.length}`);
      console.log(`   - Final report size: ${finalReport.length} chars`);

      return {
        report: finalReport,
        citations
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`\n💥 [CITATION AGENT] CITATION PROCESS FAILED after ${duration}ms`);
      console.error(`❌ [CITATION AGENT] Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error(`🔍 [CITATION AGENT] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');

      console.log(`\n🔄 [CITATION AGENT] Falling back to basic source list...`);
      // Fallback: add basic source list
      const fallbackStartTime = Date.now();
      const sourceBibliography = sources
        .filter((source, index, self) => self.findIndex(s => s.url === source.url) === index)
        .slice(0, 20) // Limit to 20 sources
        .map((source, index) => ({
          id: `${index + 1}`,
          url: source.url,
          title: source.title,
          snippet: source.snippet,
          relevance: source.relevance_score
        }));

      const bibliography = `

## Sources

${sourceBibliography.map(citation =>
        `[${citation.id}] ${citation.title} - ${citation.url} (Relevance: ${citation.relevance.toFixed(2)})`
      ).join('\n')}`;

      const fallbackDuration = Date.now() - fallbackStartTime;
      console.log(`⚠️  [CITATION AGENT] Fallback completed in ${fallbackDuration}ms:`);
      console.log(`   - Sources listed: ${sourceBibliography.length}`);
      console.log(`   - Report with sources: ${(report + bibliography).length} chars`);

      return {
        report: report + bibliography,
        citations: sourceBibliography
      };
    }
  }

  /**
   * Identify factual claims that need citations
   */
  private async _identifyClaims(report: string): Promise<{ claim: string; position: number; context: string }[]> {
    const claimsPrompt = `
Identify factual claims, statistics, quotes, and specific information in this report that should be cited:

${report}

Look for:
- Specific facts, figures, and statistics
- Research findings and study results
- Expert quotes and opinions
- Historical events and dates
- Technical specifications
- Survey results and data
- Claims about current events
- Statements that could be verified

For each claim, provide:
- The exact text of the claim
- The approximate character position in the text
- Brief context around the claim

Respond with JSON:
{
  "claims": [
    {
      "claim": "Exact text that needs citation",
      "position": 1250,
      "context": "Brief context around the claim"
    }
  ]
}
`;

    const result = await this.think(claimsPrompt);

    if (result.error || !result.claims) {
      // Fallback: identify potential claims using simple heuristics
      const sentences = report.split(/[.!?]+/).filter(s => s.trim().length > 0);
      const potentialClaims = sentences.filter(sentence => {
        const claimIndicators = [
          /\d+%/, // percentages
          /\$[\d,]+/, // money amounts
          /\d{4}/, // years
          /according to/i,
          /study shows/i,
          /research indicates/i,
          /data reveals/i,
          /statistics show/i
        ];

        return claimIndicators.some(pattern => pattern.test(sentence));
      });

      return potentialClaims.map(claim => ({
        claim: claim.trim(),
        position: report.indexOf(claim),
        context: claim.trim()
      }));
    }

    return result.claims || [];
  }

  /**
   * Match claims to appropriate sources
   */
  private async _matchClaimsToSources(
    claims: { claim: string; position: number; context: string }[],
    sources: SearchResult[]
  ): Promise<{ claim: string; position: number; source: SearchResult; citationNumber: number }[]> {
    const matches: { claim: string; position: number; source: SearchResult; citationNumber: number }[] = [];
    let citationCounter = 1;

    // Filter and sort sources by relevance
    const qualifiedSources = sources
      .filter(source => source.relevance_score >= 0.6)
      .sort((a, b) => b.relevance_score - a.relevance_score);

    for (const claim of claims) {
      const matchingPrompt = `
Find the best source to cite for this claim:

**Claim:** ${claim.claim}
**Context:** ${claim.context}

**Available Sources:**
${qualifiedSources.slice(0, 10).map((source, index) =>
        `${index + 1}. ${source.title} (Relevance: ${source.relevance_score})
   URL: ${source.url}
   Content: ${source.snippet}`
      ).join('\n\n')}

Which source best supports this claim? Consider:
- Topical relevance
- Authority of source
- Specificity of information
- Quality of match

Respond with JSON:
{
  "best_match_index": 2,
  "confidence": 0.8,
  "reasoning": "Why this source is the best match"
}

If no good match exists, set best_match_index to -1.
`;

      try {
        const matchResult = await this.think(matchingPrompt);

        if (matchResult.best_match_index >= 0 &&
          matchResult.best_match_index < qualifiedSources.length &&
          matchResult.confidence >= 0.6) {

          const selectedSource = qualifiedSources[matchResult.best_match_index];
          if (selectedSource) {
            matches.push({
              claim: claim.claim,
              position: claim.position,
              source: selectedSource,
              citationNumber: citationCounter++
            });
          }
        }
      } catch (error) {
        console.warn(`[CITATION AGENT] Failed to match claim: ${claim.claim.slice(0, 50)}...`);
      }
    }

    return matches;
  }

  /**
   * Insert inline citations into the report
   */
  private async _insertCitations(
    report: string,
    citationMatches: { claim: string; position: number; source: SearchResult; citationNumber: number }[]
  ): Promise<string> {
    let citedReport = report;

    // Sort matches by position (descending) to avoid position shifts when inserting
    const sortedMatches = citationMatches.sort((a, b) => b.position - a.position);

    for (const match of sortedMatches) {
      const claimStart = citedReport.toLowerCase().indexOf(match.claim.toLowerCase());

      if (claimStart >= 0) {
        const claimEnd = claimStart + match.claim.length;
        const citation = ` [${match.citationNumber}]`;

        citedReport = citedReport.slice(0, claimEnd) + citation + citedReport.slice(claimEnd);

        console.log(`   📌 [CITATION AGENT] Added citation [${match.citationNumber}] for: "${match.claim.slice(0, 30)}..."`);
      }
    }

    return citedReport;
  }

  /**
   * Generate structured citation list
   */
  private async _generateCitationList(
    citationMatches: { claim: string; position: number; source: SearchResult; citationNumber: number }[]
  ): Promise<Citation[]> {
    const citations: Citation[] = [];
    const usedSources = new Set<string>();

    for (const match of citationMatches) {
      if (!usedSources.has(match.source.url)) {
        citations.push({
          id: match.citationNumber.toString(),
          url: match.source.url,
          title: match.source.title,
          snippet: match.source.snippet,
          relevance: match.source.relevance_score
        });

        usedSources.add(match.source.url);
      }
    }

    // Sort by citation number
    return citations.sort((a, b) => parseInt(a.id) - parseInt(b.id));
  }

  /**
   * Generate bibliography section
   */
  async generateBibliography(report: string, citations: Citation[]): Promise<string> {
    if (citations.length === 0) {
      return report;
    }

    const bibliography = `

## References

${citations.map(citation => {
      const domain = new URL(citation.url).hostname;
      const accessDate = new Date().toISOString().split('T')[0];

      return `[${citation.id}] ${citation.title}. ${domain}. ${citation.url} (accessed ${accessDate})`;
    }).join('\n\n')}

---
*Total sources cited: ${citations.length}*
*Average source relevance: ${(citations.reduce((sum, c) => sum + c.relevance, 0) / citations.length).toFixed(2)}*`;

    return report + bibliography;
  }

  /**
   * Validate citation format and completeness
   */
  async validateCitations(report: string, citations: Citation[]): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = [];

    // Check for citation markers without corresponding references
    const citationMarkers = report.match(/\[\d+\]/g) || [];
    const uniqueMarkers = Array.from(new Set(citationMarkers));

    for (const marker of uniqueMarkers) {
      const citationId = marker.replace(/[\[\]]/g, '');
      if (!citations.some(citation => citation.id === citationId)) {
        issues.push(`Citation marker ${marker} has no corresponding reference`);
      }
    }

    // Check for references without markers
    for (const citation of citations) {
      if (!report.includes(`[${citation.id}]`)) {
        issues.push(`Reference [${citation.id}] is not cited in the text`);
      }
    }

    // Check for duplicate URLs
    const urls = citations.map(c => c.url);
    const duplicateUrls = urls.filter((url, index) => urls.indexOf(url) !== index);
    if (duplicateUrls.length > 0) {
      issues.push(`Duplicate URLs found: ${Array.from(new Set(duplicateUrls)).join(', ')}`);
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }
} 