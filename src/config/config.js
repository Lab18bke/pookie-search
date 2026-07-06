'use strict';

const path = require('path');
const PROJECT_ROOT_DIRECTORY = path.join(__dirname, '..', '..');

const CONFIGURATION = {
    application: {
        name: 'Pookie Search',
        version: '67.67.0',
        author: 'Vishwas Kumar',
        environment: process.env.NODE_ENV || 'development'
    },

    server: {
        port: Number(process.env.PORT) || 6767,
        host: '0.0.0.0',
        trustProxy: false,
        requestBodyLimit: '10mb',
        requestTimeoutMilliseconds: 30000,
    },

    search: {
        maximumResults: Number(process.env.MAX_RESULTS) || 15,
        minimumQueryLength: 2,
        maximumQueryLength: 120,
        enableFuzzySearching: true,
        enableExactMatchBoost: true,
        ignoreCase: true,
        removeDuplicateResults: true
    },

    ranking: {
        titleWeight: 50,
        keywordWeight: 20,
        descriptionWeight: 15,
        urlWeight: 10,
        bodyWeight: 5,
        exactMatchBonus: 50,
        whitelistBonus: 100
    },

    crawler: {
        enabled: process.env.ENABLE_CRAWLER === 'true',
        workerCount: 4,
        requestDelayMilliseconds: 500,
        requestTimeoutMilliseconds: 10000,
        maximumPagesPerDomain: 500,
        respectRobotsTxt: true,
        followRedirects: true,
        retryAttempts: 3,
        retryDelayMilliseconds: 1500,
        userAgent: 'PookieSearchBot/1.0 (+https://pookiesearch.localhost'
    },

    summarization: {
        enabled: true,
        maximumSentences: 3,
        minimumSentenceLength: 40,
        maximumSentenceLength: 220,
        preferMetaDescription: true,
        enableKeywordExtraction: true,
        enableTextRank: true
    },

    redirect: {
        enabled: true,
        delayMilliseconds: Number(process.env.REDIRECT_DELAY) || 2000,
        displayProgressBar: true
    },

    cache: {
        enabled: process.env.ENABLE_CACHE === 'true',
        defaultLifetimeSeconds: 3600,
        maxmimumEntries: 7500
    },

    database: {
        directory: path.join(PROJECT_ROOT_DIRECTORY, 'data', 'database'),
        filename: 'pookie_search.db',
    },

    files: {
        whitelist: path.join(PROJECT_ROOT_DIRECTORY, 'src', 'config', 'whitelist.json'),
    },

    logging: {
        enableConsoleLogging: true,
        enabledFileLogging: false,
        level: 'development'
    },

    interface: {
        theme: 'light',
        animations: true,
        defaultSearchPlaceholder: 'Lookup some nice stuff today.',
        showSearchCharacteristics: true
    }
};

module.exports = CONFIGURATION;