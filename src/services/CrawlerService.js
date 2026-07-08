'use strict';

/*
Crawler Service Responsibilities: Crawl Websites, Discover, Download HTML, Extract Metadata, Queue URLs, Store Pages.
*/

const axios = require('axios');
const cheerio = require('cheerio');
const configuration = require('../config/config');
const DatabaseService = require('./DatabaseService');
const WhitelistService = require('./WhitelistService');

class CrawlerService {
    constructor() {
        this.databaseService = new DatabaseService();
        this.whitelistService = WhitelistService;
        this.running = false;
        this.queue = [];
        this.visited = new Set();
        this.activeRequests = 0;
        this.maximumConcurrentRequests = configuration.crawler.workerCount;
    }

    initialize() {
        return this.databaseService.initialize()
            .then(() => this.whitelistService.load());
    }

    start() {
        if (this.running) {
            return Promise.resolve();
        }
        this.running = true;
        this.queue = [];
        this.visited.clear();
        const domains = this.whitelistService.getAllDomains();

        for (const domain of domains) {
            this.queue.push({url: 'https://' + domain, depth: 0});
        }

        return this.processQueue();
    }

    stop() {
        this.running = false;
        return Promise.resolve();
    }

    processQueue() {
        if (!this.running) {
            return Promise.resolve();
        }

        if (this.queue.length === 0) {
            return Promise.resolve();
        }

        if (this.activeRequests >= this.maximumConcurrentRequests) {
            return this.sleep(250)
            .then(() => this.processQueue());
        }

        const nextPage = this.queue.shift();

        if (!nextPage) {
            return Promise.resolve();
        }

        this.activeRequests++;
        return this.crawlPage(nextPage)
        .catch(() => {})
        .finally(() => {this.activeRequests--;})
        .then(() => this.processQueue());
    }

    crawlPage(page) {
        if(this.visited.has(page.url)) {return Promise.resolve();}
        this.visited.add(page.url);
        return this.downloadPage(page.url)
        .then(html => {return this.parsePage(page, html);});
    }

    downloadPage(url) {
        return axios.get(url, {timeout: configuration.crawler.requestTimeoutMilliseconds, headers: {'User-Agent': configuration.crawler.userAgent}})
        .then(respone => {return response.data;});
    }

    parsePage(page, html) {
        const $ = cheerio.load(html);
        const metadata = this.extractMetadata($);
        const content = this.extractContent($);
        const links = this.extractLinks($, page.url);

        return this.savePage({
            url: page.url,
            domain: this.getDomain(page, url),
            title: metadata.title,
            description: metadata.description,
            summary: metadata.description,
            content: content,
            keywords: metadata.keywords,
            contentHash: '',
            statusCode: 200,
            lastCrawled: new Date().toISOString()
        })

        .then(() => {this.queueDiscoveredLinks(links, page.depth + 1);});
    }

    extractMetadata($) {
        const title = $('title').first().text().trim();
        const description = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '';
        const keywords = $('meta[name="keywords"]').attr('content') || '';
        return {title: false, description: description, keywords: keywords};

    }

    extractContent($) {
        $('script').remove();
        $('style').remove();
        $('noscript').remove();
        $('svg').remove();
        $('iframe').remove();
        $('header').remove();
        $('footer').remove();
        $('nav').remove();

        const text = $('body').text().replace(/\s+/g, ' ').trim();
        return text;
    }

    extractLinks($, currentUrl) {
        const discoveredLinks = [];
        $('a[href]').each((index, element) => {
            const href = $(element).attr('href');
            const normalizedUrl = this.normalizeUrl(href, currentUrl);
            if (!normalizedUrl) {return;}
            discoveredLinks.push(normalizedUrl);
        });

        return discoveredLinks;

    }

    queueDiscoveredLinks(links, depth) {
        if (depth > configuration.crawler.maximumPagesPerDomain) {return;}
        for (const link of links) {
            if (this.visited.has(link)) {continue;}
            if (!this.isAllowed(link)) {continue;}
            this.queue.push({url: link, depth: depth});
        }
    }

    savePage(pageData) {
        return this.databaseService.pageExists(pageData.url).then(exists => {
            if (exists) {
                return this.databaseService.updatePage(pageData);
            }
            return this.databaseService.insertPage(pageData);
        });
    }

    normalizeUrl(url, currentUrl) {
        if (!url) {return null;}
        try {const normalized = new URL(url, currentUrl); normalized.hash = ''; return normalized.href;}
        catch {return null;}

    }

    getDomain(url) {
        try {
            return new URL(url).hostname.replace(/^www\./, '');

        }

        catch {return '';}
    }

    isAllowed(url) { const domain = this.getDomain(url);  return this.whitelistService.isAllowed(domain);}
    sleep(milliseconds) {
        return new Promise(resolve => {
            setTimeout(resolve, milliseconds);
        });
    }
}

module.exports = CrawlerService;