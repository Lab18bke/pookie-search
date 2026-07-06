'use strict';

/*
Whitelist Service Responsibilities: Load whitelist.json, Validate Domains, Normalize, Fast whitelist lookups and hot reloads for so.
*/

const fs = require('fs');
const path = require('path');

const configuration = require('../config/config');

class WhitelistService {
    constructor() {
        this.whitelistFilePath = configuration.files.whitelist;
        this.whitelistEntries = [];
        this.whitelistSet = new Set();
        this.isLoaded = false;
    }

    load() {
        const fileContents = fs.readFileSync(this.whitelistFilePath, 'utf-8');
        const parsedWhitelist = JSON.parse(fileContents);
        
        this.whitelistEntries = [];
        this.whitelistSet.clear();

        for (const entry of parsedWhitelist) {
            if (typeof entry !== 'string') {
                continue;
            }
            const normalizedDomain = this.normalizeDomain(entry);
            if (normalizedDomain.length === 0) {
                continue;
        }
        

        if (this.whitelistSet.has(normalizedDomain)) {
            continue;
        }

        this.whitelistEntries.push(normalizedDomain);
        this.whitelistSet.add(normalizedDomain);

    }

    this.isLoaded = true;
    return this.whitelistEntries.length;
    }

    reload() {
        this.isLoaded = false;
        this.whitelistEntries = [];
        this.whitelistSet.clear();
        return this.load();
    }

    normalizeDomain(domain) {

        if (typeof domain !== 'string') {
            return '';
        }

        let normalizedDomain = domain.trim().toLowerCase();
        normalizedDomain = normalizedDomain.replace(/^https?:\/\//, '');
        normalizedDomain = normalizedDomain.replace(/^www\./, '');
        normalizedDomain = normalizedDomain.replace(/\/$/, '');

        return normalizedDomain;
    }

    isAllowed(domain) {
        if (!this.isLoaded) {
            this.load();
    }
    const normalizedDomain = this.normalizeDomain(domain);
    return this.whitelistSet.has(normalizedDomain);
    }

    getAllDomains() {
        if (!this.isLoaded) {
            this.load();
    }
    return[...this.whitelistEntries];
    }

    getDomainCount() {
        if (!this.isLoaded) {
            this.load();
    }
    return this.whitelistEntries.length;
    }

    isEmpty() {
        return this.getDomainCount() === 0;
    }
}

module.exports = new WhitelistService();