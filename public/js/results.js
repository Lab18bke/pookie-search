'use strict';

const searchForm = document.getElementById('searchForm');
const searchInput = document.getElementById('searchInput');
const statistics = document.getElementById('statistics');
const loadingContainer = document.getElementById('loadingContainer');
const resultsContainer = document.getElementById('resultsContainer');
const emptyContainer = document.getElementById('emptyContainer');
const resultTemplate = document.getElementById('resultTemplate');

let currentResults = [];

document.addEventListener('DOMContentLoaded', initialize);

function initialize() {
    attachEventListeners();
    const query = getQueryFromAddressBar();
    if (!query) {hideLoading(); searchInput.focus(); statistics.textContent = 'Start searching!!'; return;}
    searchInput.value = query;
    performSearch(query);
}

function attachEventListeners() {
    searchForm.addEventListener('submit', handleSearchSubmit);
}

function handleSearchSubmit(event) {
    event.preventDefault();
    const query = searchInput.value.trim();
    if (query.length === 0) {searchInput.focus(); return;}
    updateAddressBar(query);
    performSearch(query);
}

function getQueryFromAddressBar() {
    const parameters = new URLSearchParams(window.location.search);
    return parameters.get('q') || '';
}

function updateAddressBar(query) {
    const url = '/search?q=' + encodeURIComponent(query);
    window.history.pushState({}, '', url);
}

function performSearch(query) {
    showLoading();
    clearResults();
    fetch('/api/search?q=' + encodeURIComponent(query))
    .then(response => {if (!response.ok) {throw new Error('Search request failed.');}
    return response.json();
    })
    .then(data => {handleSearchResponse(data);})
    .catch(error => {console.error(error); hideLoading(); showEmptyState('Something went wrong.');
    });
}

function handleSearchResponse(response) {
    hideLoading();
    if (!response.success || response.results.length === 0) {showEmptyState(response.message || 'No results found.'); return;}
    currentResults = response.results;
    updateStatistics(response);
    renderResults(response.results);
}

function renderResults(results) {
    clearResults(); 
    hideEmpty();
    for (const result of results) {
        const resultCard = createResultCard(result);
        resultsContainer.appendChild(resultCard);
    }
}

function createResultCard(result) {
    const template = resultTemplate.content.cloneNode(true);
    const title = template.querySelector('.resultTitle');
    const url = template.querySelector('.resultUrl');
    const summary = template.querySelector('.resultSummary');
    title.textContent = result.title || result.url;
    title.href = '/redirect?url=' + encodeURIComponent(result.url);
    url.textContent = result.domain || result.url;
    summary.textContent = result.summary || result.description || 'No description available.';
    return template;
}

function updateStatistics(response) {
    statistics.textContent = 'About ' + response.resultCount + ' results (' + response.executionTime + ' ms)';
}

function showLoading() {
    loadingContainer.classList.remove('hidden');
    emptyContainer.classList.add('hidden');
    resultsContainer.classList.add('hidden');
}

function hideLoading() {
    loadingContainer.classList.add('hidden');
    resultsContainer.classList.remove('hidden');
}

function showEmptyState(message) {
    clearResults();
    hideLoading();
    emptyContainer.classList.remove('hidden');
    const heading = emptyContainer.querySelector('h2');
    const paragraph = emptyContainer.querySelector('p');
    heading.textContent = 'No Results';
    paragraph.textContent = message;
}

function hideEmpty() {
    emptyContainer.classList.add('hidden');
}

function clearResults() {
    resultsContainer.innerHTML = '';
}

function focusSearchBox() {
    searchInput.focus();
    searchInput.select();
}

function clearSearchBox() {
    searchInput.value = '';
}

function openFirstResult() {
    if (currentResults.length === 0) {return;}
    window.location.href = '/redirect?url=' + encodeURIComponent(currentResults[0].url);
}

function registerKeyboardShortcuts() {
    document.addEventListener('keydown', event => {
        if (event.ctrlKey && event.key.toLowerCase() === 'k') {
            event.preventDefault();
            focusSearchBox();
            return;
        }
        if (event.ctrlKey && event.key === 'Enter') {
            event.preventDefault();
            openFirstResult();
            return;
        }
        if (event.key === 'Escape') {
            clearSearchBox();
            return;
        }
    });
}

function registerBrowserNavigation() {
    window.addEventListener('popstate', () => {
    const query = getQueryFromAddressBar();
    searchInput.value = query;
    if (query.length === 0) {
        clearResults();
        statistics.textContent = 'Start searching for something nice.';
        return;
    }
    performSearch(query);
    });
}

function setLoadingMessage(message) {
    const paragraph = loadingContainer.querySelector('p');
    if (!paragraph) {return;}
    paragraph.textContent = message;
}

function showLoadingAnimation() {
    loadingContainer.style.opacity = '0';
    requestAnimationFrame(() => {
        loadingContainer.style.transition = 'opacity .2s ease';
        loadingContainer.style.opacity = '1';
    });
}

function hideLoadingAnimation() {
    loadingContainer.style.opacity = '0';
}

function initializeSearchPage() {
    registerKeyboardShortcuts();
    registerBrowserNavigation();
}

initializeSearchPage();