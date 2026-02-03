/**
 * Side Panel Script for Business Prospect Scraper
 * Handles displaying prospects and dashboard stats in the side panel interface
 */

(function() {
  'use strict';

  // DOM Elements
  const statTotalEl = document.getElementById('stat-total');
  const statContactedEl = document.getElementById('stat-contacted');
  const statConvertedEl = document.getElementById('stat-converted');
  const statRateEl = document.getElementById('stat-rate');
  const viewAllBtn = document.getElementById('view-all-btn');
  const viewContactedBtn = document.getElementById('view-contacted-btn');
  const viewConvertedBtn = document.getElementById('view-converted-btn');
  const townsListEl = document.getElementById('towns-list');
  const emptyStateEl = document.getElementById('empty-state');
  const quickInfoEl = document.getElementById('quick-info');
  const quickInfoNameEl = document.getElementById('quick-info-name');
  const quickInfoPhoneEl = document.getElementById('quick-info-phone');
  const quickInfoLocationEl = document.getElementById('quick-info-location');
  const quickInfoRatingEl = document.getElementById('quick-info-rating');
  const closeQuickInfoBtn = document.getElementById('close-quick-info');

  // State
  let prospects = {};
  let expandedTowns = new Set();

  /**
   * Load prospects from storage
   */
  async function loadProspects() {
    try {
      const storage = await chrome.storage.local.get(['prospects']);
      prospects = storage.prospects || {};
      updateDashboardStats();
      renderProspects();
    } catch (error) {
      console.error('Failed to load prospects:', error);
    }
  }

  /**
   * Update dashboard statistics
   */
  function updateDashboardStats() {
    let totalProspects = 0;
    let totalContacted = 0;
    let totalConverted = 0;

    for (const town of Object.keys(prospects)) {
      for (const prospect of prospects[town]) {
        totalProspects++;
        if (prospect.status === 'contacted' || prospect.status === 'converted') {
          totalContacted++;
        }
        if (prospect.status === 'converted') {
          totalConverted++;
        }
      }
    }

    const conversionRate = totalContacted > 0
      ? ((totalConverted / totalContacted) * 100).toFixed(1)
      : 0;

    statTotalEl.textContent = totalProspects;
    statContactedEl.textContent = totalContacted;
    statConvertedEl.textContent = totalConverted;
    statRateEl.textContent = `${conversionRate}%`;

    // Show/hide empty state
    if (totalProspects === 0) {
      emptyStateEl.classList.remove('hidden');
    } else {
      emptyStateEl.classList.add('hidden');
    }
  }

  /**
   * Render the prospects list by town
   */
  function renderProspects() {
    // Clear existing towns (but keep empty state)
    const townCards = townsListEl.querySelectorAll('.town-card');
    townCards.forEach(card => card.remove());

    // Sort towns alphabetically
    const sortedTowns = Object.keys(prospects).sort();

    for (const town of sortedTowns) {
      if (prospects[town].length === 0) continue;

      const townCard = createTownCard(town, prospects[town]);
      townsListEl.appendChild(townCard);
    }
  }

  /**
   * Create a town card element
   */
  function createTownCard(town, townProspects) {
    const card = document.createElement('div');
    card.className = 'town-card';
    card.dataset.town = town;

    const isExpanded = expandedTowns.has(town);

    // Count statuses
    const newCount = townProspects.filter(p => !p.status || p.status === 'new').length;
    const contactedCount = townProspects.filter(p => p.status === 'contacted').length;
    const convertedCount = townProspects.filter(p => p.status === 'converted').length;

    card.innerHTML = `
      <button class="town-header" aria-expanded="${isExpanded}">
        <span class="town-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
        </span>
        <span class="town-name">${escapeHtml(town)}</span>
        <span class="town-count">(${townProspects.length})</span>
        <span class="expand-icon ${isExpanded ? 'expanded' : ''}">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </span>
      </button>
      <div class="town-prospects ${isExpanded ? 'expanded' : ''}">
        ${townProspects.map(prospect => createProspectItem(prospect)).join('')}
      </div>
    `;

    // Add click handler for expand/collapse
    const header = card.querySelector('.town-header');
    header.addEventListener('click', () => toggleTown(town, card));

    // Add click handlers for prospect items
    const prospectItems = card.querySelectorAll('.prospect-item');
    prospectItems.forEach((item, index) => {
      item.addEventListener('click', () => showQuickInfo(townProspects[index]));
    });

    return card;
  }

  /**
   * Create a prospect list item HTML
   */
  function createProspectItem(prospect) {
    const status = prospect.status || 'new';
    const statusClass = status !== 'new' ? `status-${status}` : '';
    const rating = prospect.rating !== 'Not available' ? `${prospect.rating} stars` : '';
    const flagged = prospect.flagged ? '<span class="flagged-dot" title="Flagged"></span>' : '';

    return `
      <button class="prospect-item ${statusClass}">
        <span class="prospect-name">${escapeHtml(prospect.businessName)}</span>
        ${flagged}
        ${rating ? `<span class="prospect-rating">${rating}</span>` : ''}
      </button>
    `;
  }

  /**
   * Toggle town expansion
   */
  function toggleTown(town, card) {
    const prospectsContainer = card.querySelector('.town-prospects');
    const expandIcon = card.querySelector('.expand-icon');
    const header = card.querySelector('.town-header');

    if (expandedTowns.has(town)) {
      expandedTowns.delete(town);
      prospectsContainer.classList.remove('expanded');
      expandIcon.classList.remove('expanded');
      header.setAttribute('aria-expanded', 'false');
    } else {
      expandedTowns.add(town);
      prospectsContainer.classList.add('expanded');
      expandIcon.classList.add('expanded');
      header.setAttribute('aria-expanded', 'true');
    }
  }

  /**
   * Show quick info panel for a prospect
   */
  function showQuickInfo(prospect) {
    quickInfoNameEl.textContent = prospect.businessName;
    quickInfoPhoneEl.textContent = prospect.phone;
    quickInfoLocationEl.textContent = prospect.address !== 'Not available' ? prospect.address : prospect.location;

    const rating = prospect.rating !== 'Not available'
      ? `${prospect.rating} (${prospect.reviewCount} reviews)`
      : 'Not available';
    quickInfoRatingEl.textContent = rating;

    quickInfoEl.classList.remove('hidden');
  }

  /**
   * Hide quick info panel
   */
  function hideQuickInfo() {
    quickInfoEl.classList.add('hidden');
  }

  /**
   * Open a page in a new tab
   */
  function openPage(pageName) {
    chrome.tabs.create({
      url: chrome.runtime.getURL(pageName)
    });
  }

  /**
   * Escape HTML to prevent XSS
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Set up event listeners
   */
  function setupEventListeners() {
    viewAllBtn.addEventListener('click', () => openPage('prospects.html'));
    viewContactedBtn.addEventListener('click', () => openPage('contacted.html'));
    viewConvertedBtn.addEventListener('click', () => openPage('converted.html'));
    closeQuickInfoBtn.addEventListener('click', hideQuickInfo);

    // Listen for updates from content script
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'REFRESH_PROSPECTS' || message.type === 'PROSPECTS_UPDATED') {
        loadProspects();
      }
    });

    // Listen for storage changes
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes.prospects) {
        prospects = changes.prospects.newValue || {};
        updateDashboardStats();
        renderProspects();
      }
    });
  }

  /**
   * Initialize the side panel
   */
  function init() {
    loadProspects();
    setupEventListeners();
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
