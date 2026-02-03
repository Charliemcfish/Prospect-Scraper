/**
 * Converted Customers Page Script
 * Shows only prospects with status 'converted'
 */

(function() {
  'use strict';

  const totalStatsEl = document.getElementById('total-stats');
  const searchInput = document.getElementById('search-input');
  const townFilter = document.getElementById('town-filter');
  const clearFiltersBtn = document.getElementById('clear-filters');
  const prospectsContainer = document.getElementById('prospects-container');
  const emptyStateEl = document.getElementById('empty-state');
  const noResultsEl = document.getElementById('no-results');
  const toastContainer = document.getElementById('toast-container');

  let prospects = {};
  let convertedProspects = {};
  let filteredProspects = {};

  async function loadProspects() {
    try {
      const storage = await chrome.storage.local.get(['prospects']);
      prospects = storage.prospects || {};

      // Filter to only converted prospects
      convertedProspects = {};
      for (const town of Object.keys(prospects)) {
        const converted = prospects[town].filter(p => p.status === 'converted');
        if (converted.length > 0) {
          convertedProspects[town] = converted;
        }
      }

      updateTownFilter();
      applyFilters();
    } catch (error) {
      console.error('Failed to load prospects:', error);
      showToast('Failed to load customers', 'error');
    }
  }

  function updateTownFilter() {
    const currentValue = townFilter.value;
    townFilter.innerHTML = '<option value="all">All Locations</option>';

    const towns = Object.keys(convertedProspects).sort();
    for (const town of towns) {
      const option = document.createElement('option');
      option.value = town;
      option.textContent = `${town} (${convertedProspects[town].length})`;
      townFilter.appendChild(option);
    }

    if (currentValue && towns.includes(currentValue)) {
      townFilter.value = currentValue;
    }
  }

  function updateStats() {
    let total = 0;
    for (const town of Object.keys(convertedProspects)) {
      total += convertedProspects[town].length;
    }

    totalStatsEl.innerHTML = `<span class="stat-value">${total}</span> customer${total !== 1 ? 's' : ''}`;
  }

  function applyFilters() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    const selectedTown = townFilter.value;

    filteredProspects = {};

    for (const town of Object.keys(convertedProspects)) {
      if (selectedTown !== 'all' && town !== selectedTown) continue;

      const filtered = convertedProspects[town].filter(prospect =>
        !searchTerm || prospect.businessName.toLowerCase().includes(searchTerm)
      );

      if (filtered.length > 0) {
        filteredProspects[town] = filtered;
      }
    }

    renderProspects();
    updateStats();
  }

  function renderProspects() {
    prospectsContainer.innerHTML = '';

    const towns = Object.keys(filteredProspects).sort();
    const hasProspects = Object.keys(convertedProspects).length > 0;
    const hasFilteredResults = towns.length > 0;

    emptyStateEl.classList.toggle('hidden', hasProspects);
    noResultsEl.classList.toggle('hidden', !hasProspects || hasFilteredResults);

    if (!hasFilteredResults) return;

    for (const town of towns) {
      const section = createTownSection(town, filteredProspects[town]);
      prospectsContainer.appendChild(section);
    }
  }

  function createTownSection(town, townProspects) {
    const section = document.createElement('section');
    section.className = 'town-section';

    section.innerHTML = `
      <div class="town-section-header">
        <h2 class="town-section-title">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
          ${escapeHtml(town)}
        </h2>
        <span class="town-section-count">${townProspects.length} customer${townProspects.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="prospect-cards">
        ${townProspects.map(p => createProspectCard(p, town)).join('')}
      </div>
    `;

    section.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', () => copyProspectInfo(btn.dataset.id, town));
    });

    return section;
  }

  function createProspectCard(prospect, town) {
    const rating = prospect.rating !== 'Not available'
      ? `${prospect.rating} (${prospect.reviewCount} reviews)`
      : 'Not available';

    return `
      <article class="prospect-card status-converted" data-id="${prospect.id}">
        <header class="card-header">
          <div class="card-title-row">
            <h3 class="business-name">${escapeHtml(prospect.businessName)}</h3>
            <span class="status-badge status-converted">Customer</span>
          </div>
          <div class="card-actions">
            <button class="btn btn-sm btn-secondary copy-btn" data-id="${prospect.id}">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              Copy
            </button>
          </div>
        </header>
        <div class="card-content">
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Phone</span>
              <span class="info-value">${escapeHtml(prospect.phone)}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Converted</span>
              <span class="info-value">${prospect.convertedDate ? new Date(prospect.convertedDate).toLocaleDateString() : 'N/A'}</span>
            </div>
            <div class="info-item info-full">
              <span class="info-label">Address</span>
              <span class="info-value">${escapeHtml(prospect.address)}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Rating</span>
              <span class="info-value">${rating}</span>
            </div>
          </div>
          ${prospect.description !== 'Not available' ? `
            <div class="description-section">
              <span class="info-label">About</span>
              <p class="description-text">${escapeHtml(prospect.description)}</p>
            </div>
          ` : ''}
        </div>
      </article>
    `;
  }

  async function copyProspectInfo(prospectId, town) {
    const prospect = prospects[town]?.find(p => String(p.id) === prospectId);
    if (!prospect) return;

    const text = `Business: ${prospect.businessName}
Location: ${prospect.address !== 'Not available' ? prospect.address : prospect.location}
Phone: ${prospect.phone}
Email: ${prospect.email}

Google Profile: ${prospect.profileLink}
Facebook: ${prospect.facebook}
Instagram: ${prospect.instagram}

Rating: ${prospect.rating !== 'Not available' ? `${prospect.rating} stars (${prospect.reviewCount} reviews)` : 'Not available'}

About the Business:
${prospect.description !== 'Not available' ? prospect.description : 'No description available'}`;

    try {
      await navigator.clipboard.writeText(text);
      showToast('Copied to clipboard!', 'success');
    } catch (error) {
      showToast('Failed to copy', 'error');
    }
  }

  function clearFilters() {
    searchInput.value = '';
    townFilter.value = 'all';
    applyFilters();
  }

  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${type === 'success' ? '&#10003;' : type === 'error' ? '&#10007;' : '&#9432;'}</span>
      <span class="toast-message">${escapeHtml(message)}</span>
    `;
    toastContainer.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  function escapeHtml(text) {
    if (typeof text !== 'string') return text;
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function debounce(func, wait) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  }

  function setupEventListeners() {
    searchInput.addEventListener('input', debounce(applyFilters, 300));
    townFilter.addEventListener('change', applyFilters);
    clearFiltersBtn.addEventListener('click', clearFilters);

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes.prospects) {
        loadProspects();
      }
    });
  }

  function init() {
    loadProspects();
    setupEventListeners();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
