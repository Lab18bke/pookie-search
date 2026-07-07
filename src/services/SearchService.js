'use strict';

const Fuse = require('fuse.js');
const natural = require('natural');
const configuration = require('../config/config');
const DatabaseService = require('./DatabaseService');
const WhitelistService = require('./WhitelistService');

class SearchService {
    constructor() {
        this.databaseService = new DatabaseService();
        this.whitelistService = WhitelistService;
        this.fuse = null;
        this.pages = [];
        this.searchIndexReady = false;
        this.stopWords = new Set([
            'a',
            'an',
            'the',
            'of',
            'on',
            'at',
            'to',
            'in',
            'for',
            'with',
            'by',
            'from',
            'and',
            'or',
            'but',
            'is',
            'are',
            'was',
            'were',
            'be',
            'been',
            'being',
            'this',
            'that',
            'these',
            'those',
            'it',
            'its',
            'their',
            'his',
            'her',
            'our',
            'your',
            'my']);
    }

    initialize() {
        return this.databaseService.initialize()
        .then(() => this.whitelistService.load())
        .then(() => this.buildSearchIndex());
    }

    search(query) {
        const searchStartedAt = Date.now();
        const validationResult = this.validateQuery(query);
        if (!validationResult.valid) {
            return Promise.resolve({
                success: false,
                query: query,
                executionTime: 0,
                resultCount: 0,
                results: [],
                message: validationResult.message
            });
        }

        const normalizedQuery = this.normalizeQuery(query);
        const tokens = this.tokenizeQuery(normalizedQuery);
        return this.performSearch(normalizedQuery, tokens).then(results => {
            const executionTime = Date.now() - searchStartedAt;
            return {
                success: true,
                query: normalizedQuery,
                executionTime: executionTime,
                resultCount: results.length,
                results: results
            };
        });
    }

    validateQuery(query) {
        if (typeof query !== 'string') {
            return {
                valid: false,
                message: 'Query must be text brochacho.'
            };
        }

        const trimmedQuery = query.trim();
        if (trimmedQuery.length ===0) {
            return {
                valid: false,
                message: 'Query cant be za empty brain.'
            };
        }

        if (trimmedQuery.length < configuration.search.minimumQueryLength) {
            return {
                valid: false,
                message: 'Uh oh! Query is a damn shorty.'
            };
        }

        if (trimmedQuery.length > configuration.search.maximumQueryLength) {
            return {
                valid: false,
                message: 'Query is uhhh tooooo long bro.'
            };
        }

        return {
            valid: true,
            message: ''
        };
    }

    normalizeQuery(query) {
        let normalizedQuery = query;
        normalizedQuery = normalizedQuery.trim();
        normalizedQuery = normalizedQuery.toLowerCase();
        normalizedQuery = normalizedQuery.replace(/\s+/g, ' ');
        normalizedQuery = normalizedQuery.replace(/[^\w\s]/g, ' ');
        normalizedQuery = normalizedQuery.replace(/\s+/g, ' ');
        return normalizedQuery.trim();
    }

    tokenizeQuery(query) {
        const tokenizer = new natural.WordTokenizer();
        const tokens = tokenizer.tokenize(query) || [];
        const filteredTokens = [];

        for (const token of tokens) {
            if (token.length === 0 || this.stopWords.has(token)) {
                continue;
            }

            filteredTokens.push(token);
        }

        return filteredTokens;
    }

    buildSearchIndex() {
        return this.databaseService.getAllPages().then(pages => {
            this.pages = Array.isArray(pages) ? pages : [];
            this.fuse = new Fuse(this.pages, {
                includeScore: true,
                shouldSort: true,
                threshold: 0.35,
                ignoreLocation: true,
                minMatchCharLength: 2,
                keys: [
                    {
                        name: 'title',
                        weight: 0.45
                    },
                    {
                        name: 'description',
                        weight: 0.20
                    },
                    {
                        name: 'summary',
                        weight: 0.15
                    },
                    {
                        name: 'keywords',
                        weight: 0.10
                    },
                    {
                        name: 'content',
                        weight: 0.10
                    }
                ]
            });
            this.searchIndexReady = true;
            return this.pages.length;
        });
    }

    performSearch(query, tokens) {
        if (!this.searchIndexReady) {
            return this.buildSearchIndex().then(() => {
                return this.performSearch(query, tokens);
            });
        }

        const fuzzyResults = this.performFuzzySearch(query);
        const keywordResults = this.performKeywordSearch(tokens);
        const mergedResults = this.mergeResults(fuzzyResults, keywordResults);
        const sortedResults = this.sortResults(mergedResults, query, tokens);

        return Promise.resolve(this.limitResults(sortedResults));
    }

    performFuzzySearch(query) {
        if (!this.fuse) {
            return [];
        }

        const fuseResults = this.fuse.search(query);
        const formattedResults = [];

        for (const result of fuseResults) {
            const page = result.item;
            page.__fuseScore = result.score;
            formattedResults.push(page);
        }

        return formattedResults;
    }

    performKeywordSearch(tokens) {
        const keywordResults = [];

        if (tokens.length === 0) {
            return keywordResults;
        }

        for (const page of this.pages) {
            let score = 0;

            const searchableText = [
                page.title,
                page.description,
                page.summary,
                page.keywords,
                page.content
            ]
                .join(' ')
                .toLowerCase();

            for (const token of tokens) {
                if (searchableText.includes(token.toLowerCase())) {
                    score++;
                }
            }

            if (score > 0) {
                page.__keywordScore = score;
                keywordResults.push(page);
            }
        }

        return keywordResults;
    }

    mergeResults(fuzzyResults, keywordResults) {
        const uniqueResults = new Map();

        for (const result of fuzzyResults) {
            uniqueResults.set(result.url, result);
        }

        for (const result of keywordResults) {
            if (!uniqueResults.has(result.url)) {
                uniqueResults.set(result.url, result);
                continue;
            }

            const existingResult = uniqueResults.get(result.url);
            existingResult.__keywordScore = result.__keywordScore || 0;
        }

        return Array.from(uniqueResults.values());
    }

    sortResults(results, query, tokens) {
        for (const result of results) {
            result.__score = this.calculateResultScore(result, query, tokens);
        }

        results.sort((left, right) => {
            return right.__score - left.__score;
        });

        return results;
    }

    calculateResultScore(result, query, tokens) {
        let score = 0;

        const title = (result.title || '').toLowerCase();
        const description = (result.description || '').toLowerCase();
        const summary = (result.summary || '').toLowerCase();
        const keywords = (result.keywords || '').toLowerCase();
        const content = (result.content || '').toLowerCase();
        const url = (result.url || '').toLowerCase();
        const domain = (result.domain || '').toLowerCase();

        if (title.includes(query)) {
            score += configuration.ranking.titleWeight;
        }

        if (description.includes(query)) {
            score += configuration.ranking.descriptionWeight;
        }

        if (summary.includes(query)) {
            score += configuration.ranking.descriptionWeight;
        }

        if (keywords.includes(query)) {
            score += configuration.ranking.keywordWeight;
        }

        if (content.includes(query)) {
            score += configuration.ranking.bodyWeight;
        }

        if (url.includes(query)) {
            score += configuration.ranking.urlWeight;
        }

        if (configuration.search.enableExactMatchBoost && title === query) {
            score += configuration.ranking.exactMatchBonus;
        }

        if (this.whitelistService.isAllowed(domain)) {
            score += configuration.ranking.whitelistBonus;
        }

        if (typeof result.__keywordScore === 'number') {
            score += result.__keywordScore * 5;
        }

        if (typeof result.__fuseScore === 'number') {
            score += (1 - result.__fuseScore) * 100;
        }

        for (const token of tokens) {
            if (title.includes(token)) {
                score += 10;
            }

            if (keywords.includes(token)) {
                score += 5;
            }

            if (summary.includes(token)) {
                score += 3;
            }
        }

        return Math.round(score);
    }

    limitResults(results) {
        const maximumResults = configuration.search.maximumResults;
        return results.slice(0, maximumResults);
    }

    formatResults(results) {
        const formattedResults = [];

        for (const result of results) {
            formattedResults.push({
                title: result.title,
                url: result.url,
                domain: result.domain,
                description: result.description,
                summary: result.summary,
                keywords: result.keywords,
                score: result.__score
            });
        }

        return formattedResults;
    }

    refreshSearchIndex() {
        this.searchIndexReady = false;
        this.pages = [];
        this.fuse = null;

        return this.buildSearchIndex();
    }

    getStatistics() {
        return {
            indexedPages: this.pages.length,
            whitelistDomains: this.whitelistService.getDomainCount(),
            searchIndexReady: this.searchIndexReady
        };
    }
}

module.exports = SearchService;