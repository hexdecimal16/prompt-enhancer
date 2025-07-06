import { CategoryConfig, TaskCategory, WebSearchQuery, ProviderInterface, ModelConfig } from '../types';
import { TaskCategorizer } from './task-categorizer';
import { Logger } from '../utils/logger';

export interface CategorizeWithSearchResult {
    categories: TaskCategory[];
    suggested_search_queries: WebSearchQuery[];
}

export class EnhancedTaskCategorizer extends TaskCategorizer {
    private searchQueryProvider?: ProviderInterface;
    private searchQueryModel?: ModelConfig;
    private enhancedLogger: Logger;

    constructor(
        categories: Record<string, CategoryConfig>,
        taggerConfig?: {
            provider: ProviderInterface;
            model: ModelConfig;
            tagMap: any
        },
        searchQueryConfig?: {
            provider: ProviderInterface;
            model: ModelConfig;
        }
    ) {
        super(categories, taggerConfig);
        this.enhancedLogger = new Logger('EnhancedTaskCategorizer');

        if (searchQueryConfig) {
            this.searchQueryProvider = searchQueryConfig.provider;
            this.searchQueryModel = searchQueryConfig.model;
            this.enhancedLogger.info('Enhanced task categorizer initialized with search query generation');
        } else {
            this.enhancedLogger.info('Enhanced task categorizer initialized without search query generation');
        }
    }

    async categorizeTaskWithWebSearch(prompt: string): Promise<CategorizeWithSearchResult> {
        this.enhancedLogger.debug('Categorizing task with web search query generation', {
            promptPreview: prompt.substring(0, 100) + '...'
        });

        try {
            // First categorize the task using the base categorizer
            const categories = await this.categorizeTask(prompt);

            // Generate search queries if provider is available
            let searchQueries: WebSearchQuery[] = [];

            if (this.searchQueryProvider && this.searchQueryModel && categories.length > 0) {
                searchQueries = await this.generateSearchQueries(prompt, categories);
            } else {
                // Fallback to rule-based search query generation
                searchQueries = this.generateFallbackSearchQueries(prompt, categories);
            }

            this.enhancedLogger.info('Task categorization with search queries completed', {
                categoriesFound: categories.length,
                searchQueriesGenerated: searchQueries.length,
                topCategory: categories[0]?.name || 'None'
            });

            return {
                categories,
                suggested_search_queries: searchQueries
            };
        } catch (error) {
            this.enhancedLogger.error('Failed to categorize task with web search', { error });

            // Return basic categorization without search queries on error
            const categories = await this.categorizeTask(prompt);
            return {
                categories,
                suggested_search_queries: []
            };
        }
    }

    private async generateSearchQueries(
        prompt: string,
        categories: TaskCategory[]
    ): Promise<WebSearchQuery[]> {
        this.enhancedLogger.debug('Generating search queries using LLM');

        if (!this.searchQueryProvider || !this.searchQueryModel) {
            return this.generateFallbackSearchQueries(prompt, categories);
        }

        try {
            const topCategory = categories[0];
            if (!topCategory) {
                return [];
            }

            const searchQueryPrompt = this.createSearchQueryPrompt(prompt, topCategory);

            const response = await this.searchQueryProvider.generate(searchQueryPrompt, {
                model: this.searchQueryModel.name,
                max_tokens: 200,
                temperature: 0.3
            });

            const searchQueries = this.parseSearchQueriesFromResponse(response.content, topCategory, prompt);

            this.enhancedLogger.debug('LLM-generated search queries', {
                queriesGenerated: searchQueries.length,
                queries: searchQueries.map(q => q.query)
            });

            return searchQueries;
        } catch (error) {
            this.enhancedLogger.warn('LLM search query generation failed, using fallback', { error });
            return this.generateFallbackSearchQueries(prompt, categories);
        }
    }

    private createSearchQueryPrompt(prompt: string, category: TaskCategory): string {
        return `You are an expert at creating effective web search queries to find the most current and relevant information.

User's prompt: "${prompt}"
Task category: ${category.name}

Based on this prompt and category, generate 1-2 broad search queries that would help find relevant information to enhance the user's prompt. Focus on:

1. Best practices and documentation
2. Official guides and tutorials
3. Real-world examples and practical guidance
4. Implementation patterns and techniques

For each search query, consider:
- Include relevant technical terms and keywords
- Add qualifiers like "tutorial", "best practices", "documentation", "guide"
- Make queries broad enough to find useful results
- Avoid overly specific phrases or exact quotes

Return ONLY the search queries, one per line, without quotes or additional text.

Example format:
MCP protocol specification documentation
Python server logging best practices tutorial`;
    }

    private parseSearchQueriesFromResponse(
        response: string,
        category: TaskCategory,
        originalPrompt: string
    ): WebSearchQuery[] {
        const queries: WebSearchQuery[] = [];

        try {
            const lines = response
                .split('\n')
                .map(line => line.trim())
                .filter(line => line && !line.startsWith('#') && !line.startsWith('*'));

            for (let i = 0; i < Math.min(lines.length, 3); i++) {
                const line = lines[i];
                if (line) {
                    let query = line.replace(/^\d+\.\s*/, '').trim(); // Remove numbering

                    // Remove quotes that make searches too restrictive
                    query = query.replace(/^["']|["']$/g, '').trim();

                    if (query.length > 10 && query.length < 200) {
                        queries.push({
                            query,
                            category: category.name,
                            priority: 0, // Will be set after relevance scoring
                            search_engines: ['brave']
                        });
                    }
                }
            }

            // Score and reorder queries by relevance
            const scoredQueries = this.scoreAndRankQueries(queries, originalPrompt);

            // Assign priority based on relevance ranking
            scoredQueries.forEach((query, index) => {
                query.priority = index + 1;
            });

            this.enhancedLogger.debug('Queries reordered by relevance', {
                originalOrder: queries.map(q => q.query),
                reorderedQueries: scoredQueries.map(q => q.query),
                relevanceScores: scoredQueries.map(q => (q as any).relevance_score)
            });

            return scoredQueries;
        } catch (error) {
            this.enhancedLogger.warn('Error parsing search queries from LLM response', { error });
        }

        return queries;
    }

    /**
     * Score search queries by their relevance to the original user prompt
     * and return them ordered by relevance score (highest first)
     */
    private scoreAndRankQueries(
        queries: WebSearchQuery[],
        originalPrompt: string
    ): WebSearchQuery[] {
        if (queries.length <= 1) {
            return queries; // No need to reorder single query
        }

        const originalWords = this.extractSignificantWords(originalPrompt.toLowerCase());
        const originalTerms = new Set(originalWords);

        const scoredQueries = queries.map(query => {
            const score = this.calculateRelevanceScore(query.query, originalTerms, originalPrompt);
            return {
                ...query,
                relevance_score: score
            };
        });

        // Sort by relevance score (descending)
        return scoredQueries.sort((a, b) =>
            (b as any).relevance_score - (a as any).relevance_score
        );
    }

    /**
     * Calculate relevance score between a search query and the original prompt
     */
    private calculateRelevanceScore(
        searchQuery: string,
        originalTerms: Set<string>,
        originalPrompt: string
    ): number {
        const queryWords = this.extractSignificantWords(searchQuery.toLowerCase());
        const queryTerms = new Set(queryWords);

        let score = 0;

        // 1. Exact term overlap (40% weight)
        const exactMatches = [...originalTerms].filter(term => queryTerms.has(term));
        const exactMatchRatio = exactMatches.length / Math.max(originalTerms.size, 1);
        score += exactMatchRatio * 0.4;

        // 2. Domain-specific term bonus (30% weight)
        const domainBonus = this.calculateDomainSpecificBonus(searchQuery, originalPrompt);
        score += domainBonus * 0.3;

        // 3. Semantic similarity (20% weight)
        const semanticScore = this.calculateSemanticSimilarity(searchQuery, originalPrompt);
        score += semanticScore * 0.2;

        // 4. Query completeness (10% weight)
        const completenessScore = this.calculateCompletenessScore(searchQuery, originalPrompt);
        score += completenessScore * 0.1;

        return Math.min(score, 1.0);
    }

    /**
     * Extract significant words (filter stop words, short words)
     */
    private extractSignificantWords(text: string): string[] {
        return text
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word =>
                word.length > 2 &&
                !this.isStopWord(word) &&
                !this.isCommonSearchWord(word)
            );
    }

    /**
     * Calculate bonus for domain-specific terms and context
     */
    private calculateDomainSpecificBonus(searchQuery: string, originalPrompt: string): number {
        let bonus = 0;
        const lowerQuery = searchQuery.toLowerCase();
        const lowerPrompt = originalPrompt.toLowerCase();

        // MCP/Model Context Protocol detection
        if ((lowerPrompt.includes('mcp') || lowerPrompt.includes('model context protocol')) &&
            (lowerQuery.includes('mcp') || lowerQuery.includes('model context protocol'))) {
            bonus += 0.5;
        }

        // Server/API context
        if (lowerPrompt.includes('server') && lowerQuery.includes('server')) {
            bonus += 0.3;
        }

        // Logging context  
        if ((lowerPrompt.includes('log') || lowerPrompt.includes('thought')) &&
            (lowerQuery.includes('log') || lowerQuery.includes('thought'))) {
            bonus += 0.3;
        }

        // Programming language context
        const languages = ['python', 'javascript', 'typescript', 'node', 'js', 'ts'];
        const promptLang = languages.find(lang => lowerPrompt.includes(lang));
        if (promptLang && lowerQuery.includes(promptLang)) {
            bonus += 0.2;
        }

        // Technical terms preservation
        const techTerms = ['api', 'database', 'framework', 'library', 'protocol', 'specification'];
        const sharedTechTerms = techTerms.filter(term =>
            lowerPrompt.includes(term) && lowerQuery.includes(term)
        );
        bonus += sharedTechTerms.length * 0.1;

        return Math.min(bonus, 1.0);
    }

    /**
     * Calculate semantic similarity using simple word overlap and positioning
     */
    private calculateSemanticSimilarity(searchQuery: string, originalPrompt: string): number {
        const queryWords = this.extractSignificantWords(searchQuery.toLowerCase());
        const promptWords = this.extractSignificantWords(originalPrompt.toLowerCase());

        if (queryWords.length === 0 || promptWords.length === 0) return 0;

        // Calculate word overlap
        const commonWords = queryWords.filter(word => promptWords.includes(word));
        const overlapRatio = commonWords.length / Math.max(queryWords.length, promptWords.length);

        // Bonus for word order preservation
        let orderBonus = 0;
        if (commonWords.length > 1) {
            const queryPositions = commonWords.map(word => queryWords.indexOf(word));
            const promptPositions = commonWords.map(word => promptWords.indexOf(word));

            // Check if relative order is preserved
            const orderPreserved = queryPositions.every((pos, i) => {
                if (i === 0) return true;
                const prevPos = queryPositions[i - 1];
                return prevPos !== undefined && pos > prevPos;
            }) && promptPositions.every((pos, i) => {
                if (i === 0) return true;
                const prevPos = promptPositions[i - 1];
                return prevPos !== undefined && pos > prevPos;
            });

            if (orderPreserved) orderBonus = 0.2;
        }

        return overlapRatio + orderBonus;
    }

    /**
     * Calculate how completely the search query covers the original prompt intent
     */
    private calculateCompletenessScore(searchQuery: string, originalPrompt: string): number {
        const queryWords = this.extractSignificantWords(searchQuery.toLowerCase());
        const promptWords = this.extractSignificantWords(originalPrompt.toLowerCase());

        if (promptWords.length === 0) return 1.0;

        // Calculate coverage of original prompt concepts
        const coveredWords = promptWords.filter(word => queryWords.includes(word));
        return coveredWords.length / promptWords.length;
    }

    /**
     * Check if word is a common search modifier that shouldn't affect relevance
     */
    private isCommonSearchWord(word: string): boolean {
        const commonSearchWords = [
            'tutorial', 'guide', 'documentation', 'best', 'practices',
            'example', 'how', 'what', 'where', 'when', 'why',
            'official', 'latest', 'current', 'modern'
        ];
        return commonSearchWords.includes(word.toLowerCase());
    }

    private generateFallbackSearchQueries(
        prompt: string,
        categories: TaskCategory[]
    ): WebSearchQuery[] {
        this.enhancedLogger.debug('Generating fallback search queries using rules');

        const queries: WebSearchQuery[] = [];

        if (categories.length === 0) {
            return queries;
        }

        const topCategory = categories[0];
        if (!topCategory) {
            return queries;
        }

        const keywords = this.extractKeywords(prompt);

        // Category-specific search query generation
        switch (topCategory.name.toLowerCase()) {
            case 'code generation & debugging':
                queries.push(...this.generateCodingSearchQueries(keywords));
                break;

            case 'technical documentation':
                queries.push(...this.generateDocumentationSearchQueries(keywords));
                break;

            case 'research & information synthesis':
                queries.push(...this.generateResearchSearchQueries(keywords));
                break;

            default:
                queries.push(...this.generateGenericSearchQueries(keywords, topCategory));
        }

        this.enhancedLogger.debug('Fallback search queries generated', {
            category: topCategory.name,
            queriesGenerated: queries.length
        });

        return queries.slice(0, 2); // Limit to 2 queries
    }

    private generateCodingSearchQueries(keywords: string[]): WebSearchQuery[] {
        const queries: WebSearchQuery[] = [];
        const techKeywords = keywords.filter(kw =>
            /^(javascript|typescript|python|react|node|api|server|database|framework|library)$/i.test(kw)
        );

        if (techKeywords.length > 0) {
            const mainTech = techKeywords[0];
            queries.push({
                query: `${mainTech} best practices documentation`,
                category: 'Code Generation & Debugging',
                priority: 1,
                search_engines: ['brave']
            });

            if (keywords.some(kw => /server|api|backend/i.test(kw))) {
                        queries.push({
          query: `${mainTech} server development tutorial`,
          category: 'Code Generation & Debugging',
          priority: 2,
          search_engines: ['brave']
        });
            }
        }

        return queries;
    }

    private generateDocumentationSearchQueries(keywords: string[]): WebSearchQuery[] {
        const queries: WebSearchQuery[] = [];

        if (keywords.some(kw => /mcp|model context protocol/i.test(kw))) {
                  queries.push({
        query: `MCP Model Context Protocol specification documentation`,
        category: 'Technical Documentation',
        priority: 1,
        search_engines: ['brave']
      });
        }

        const mainKeyword = keywords.find(kw => kw.length > 3) || keywords[0];
        if (mainKeyword) {
                  queries.push({
        query: `${mainKeyword} official documentation`,
        category: 'Technical Documentation',
        priority: 2,
        search_engines: ['brave']
      });
        }

        return queries;
    }

    private generateResearchSearchQueries(keywords: string[]): WebSearchQuery[] {
        const queries: WebSearchQuery[] = [];
        const mainKeywords = keywords.slice(0, 2).join(' ');

        if (mainKeywords) {
                  queries.push({
        query: `${mainKeywords} research guide`,
        category: 'Research & Information Synthesis',
        priority: 1,
        search_engines: ['brave']
      });

      queries.push({
        query: `${mainKeywords} best practices tutorial`,
        category: 'Research & Information Synthesis',
        priority: 2,
        search_engines: ['brave']
      });
        }

        return queries;
    }

    private generateGenericSearchQueries(
        keywords: string[],
        category: TaskCategory
    ): WebSearchQuery[] {
        const queries: WebSearchQuery[] = [];
        const mainKeywords = keywords.slice(0, 3).join(' ');

        if (mainKeywords) {
                  queries.push({
        query: `${mainKeywords} best practices`,
        category: category.name,
        priority: 1,
        search_engines: ['brave']
      });
        }

        return queries;
    }

    private extractKeywords(prompt: string): string[] {
        // Simple keyword extraction - in production, this could use NLP libraries
        const words = prompt
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word =>
                word.length > 3 &&
                !this.isStopWord(word)
            );

        // Remove duplicates and return top 5
        return [...new Set(words)].slice(0, 5);
    }

    private isStopWord(word: string): boolean {
        const stopWords = [
            'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had',
            'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his',
            'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'who', 'boy',
            'did', 'use', 'way', 'she', 'many', 'oil', 'sit', 'set', 'run', 'eat',
            'help', 'make', 'need', 'want', 'with', 'this', 'that', 'they', 'have',
            'from', 'they', 'know', 'want', 'been', 'good', 'much', 'some', 'time',
            'very', 'when', 'come', 'here', 'just', 'like', 'long', 'over', 'also',
            'back', 'call', 'came', 'each', 'find', 'give', 'hand', 'high', 'keep',
            'last', 'left', 'life', 'live', 'look', 'made', 'most', 'move', 'must',
            'name', 'never', 'only', 'open', 'part', 'place', 'right', 'said', 'same',
            'seem', 'show', 'small', 'sound', 'still', 'such', 'take', 'than', 'them',
            'well', 'went', 'were', 'what', 'where', 'which', 'while', 'will', 'word',
            'work', 'world', 'would', 'write', 'year'
        ];

        return stopWords.includes(word.toLowerCase());
    }
} 