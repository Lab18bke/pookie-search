'use strict';

/*
Search Routes. API Endp: /api/search, /api/statistics, /api/history, /api/reindex (all GET)
*/

const express = require('express');
const SearchService = require('../services/SearchService');
const router = express.Router();
const searchService = new SearchService();

searchService.initialize().catch(error => {
    console.error('[uh oh] failed to init search service.', error);
});

router.get('/search', (request, response) => {
    const query = request.query.q;
    searchService.search(query)
    .then(results => {response.status(200).json(results);})
    .catch(error => {console.error(error); response.status(500).json({success: false, message: 'Search failz compilation.', error: error.message});});
});

router.get('/statistics', (request, response) => {
    try {response.status(200).json({success: true, statistics: searchService.getStatistics()});}
    catch(error) {console.error(error); response.status(500).json({success: false, message: 'Statistics failz compilation.', error: error.message});}
});

router.get('/history', (request, response) => {
    searchService.databaseService
    .getSearchHistory()
    .then(history => {response.status(200).json({success: true, history: history});
    })

    .catch(error => {response.status(500).json({success: false, message: error.message});
    });
});

router.post('/reindex', (request, response) => {
    searchService.refreshSearchIndex()
    .then(() => {response.status(200).json({success: true, message: 'Search index rebuilt successfully.'});
    })
    .catch(error => {response.status(500).json({success: false, message: error.message});
    });
});

router.get('/ping', (request, response) => {
    response.status(200).json({
    success: true,
    application: 'Pookie Search',
    version: '67.67.0',
    uptime: process.uptime(),
    timestamp: Date.now()
    });
});

router.use((request, response) => {
    response.status(404).json({success: false, message: 'stop messing with my pooku search api, you are not me.'});
});


