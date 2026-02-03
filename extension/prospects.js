/**
 * Full Prospects Page Script for Business Prospect Scraper
 * Handles displaying, searching, filtering, copying, and managing prospects
 * With Contacted/Converted tracking functionality
 */

(function() {
  'use strict';

  // DOM Elements
  const totalStatsEl = document.getElementById('total-stats');
  const searchInput = document.getElementById('search-input');
  const townFilter = document.getElementById('town-filter');
  const statusFilter = document.getElementById('status-filter');
  const clearFiltersBtn = document.getElementById('clear-filters');
  const prospectsContainer = document.getElementById('prospects-container');
  const emptyStateEl = document.getElementById('empty-state');
  const noResultsEl = document.getElementById('no-results');
  const toastContainer = document.getElementById('toast-container');
  const exportBtn = document.getElementById('export-btn');
  const importBtn = document.getElementById('import-btn');
  const importInput = document.getElementById('import-input');

  // State
  let prospects = {};
  let stats = { totalAdded: 0, totalContacted: 0, totalConverted: 0 };
  let filteredProspects = {};

  /**
   * Load prospects from storage
   */
  async function loadProspects() {
    try {
      const storage = await chrome.storage.local.get(['prospects', 'stats']);
      prospects = storage.prospects || {};
      stats = storage.stats || { totalAdded: 0, totalContacted: 0, totalConverted: 0 };

      // Recalculate stats from actual data
      recalculateStats();
      updateTownFilter();
      applyFilters();
    } catch (error) {
      console.error('Failed to load prospects:', error);
      showToast('Failed to load prospects', 'error');
    }
  }

  /**
   * Recalculate stats from actual prospect data
   */
  function recalculateStats() {
    let totalAdded = 0;
    let totalContacted = 0;
    let totalConverted = 0;

    for (const town of Object.keys(prospects)) {
      for (const prospect of prospects[town]) {
        totalAdded++;
        if (prospect.status === 'contacted' || prospect.status === 'converted') {
          totalContacted++;
        }
        if (prospect.status === 'converted') {
          totalConverted++;
        }
      }
    }

    stats = { totalAdded, totalContacted, totalConverted };
  }

  /**
   * Update the town filter dropdown
   */
  function updateTownFilter() {
    const currentValue = townFilter.value;
    townFilter.innerHTML = '<option value="all">All Locations</option>';

    const towns = Object.keys(prospects).sort();
    for (const town of towns) {
      if (prospects[town].length > 0) {
        const option = document.createElement('option');
        option.value = town;
        option.textContent = `${town} (${prospects[town].length})`;
        townFilter.appendChild(option);
      }
    }

    if (currentValue && towns.includes(currentValue)) {
      townFilter.value = currentValue;
    }
  }

  /**
   * Update total stats display
   */
  function updateStats() {
    recalculateStats();
    const conversionRate = stats.totalContacted > 0
      ? ((stats.totalConverted / stats.totalContacted) * 100).toFixed(1)
      : 0;

    totalStatsEl.innerHTML = `
      <span class="stat-item">
        <span class="stat-value">${stats.totalAdded}</span>
        <span class="stat-label">Total</span>
      </span>
      <span class="stat-divider">|</span>
      <span class="stat-item">
        <span class="stat-value">${stats.totalContacted}</span>
        <span class="stat-label">Contacted</span>
      </span>
      <span class="stat-divider">|</span>
      <span class="stat-item">
        <span class="stat-value">${stats.totalConverted}</span>
        <span class="stat-label">Converted</span>
      </span>
      <span class="stat-divider">|</span>
      <span class="stat-item">
        <span class="stat-value">${conversionRate}%</span>
        <span class="stat-label">Rate</span>
      </span>
    `;
  }

  /**
   * Apply search and filter criteria
   * This page shows only NEW prospects (not contacted or converted)
   */
  function applyFilters() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    const selectedTown = townFilter.value;
    const selectedStatus = statusFilter ? statusFilter.value : 'new';

    filteredProspects = {};

    for (const town of Object.keys(prospects)) {
      if (selectedTown !== 'all' && town !== selectedTown) {
        continue;
      }

      const townProspects = prospects[town].filter(prospect => {
        // Search filter
        if (searchTerm && !prospect.businessName.toLowerCase().includes(searchTerm)) {
          return false;
        }

        // This page only shows NEW prospects
        const prospectStatus = prospect.status || 'new';
        if (prospectStatus !== 'new') return false;

        // Additional filter for flagged only
        if (selectedStatus === 'flagged' && !prospect.flagged) return false;

        return true;
      });

      if (townProspects.length > 0) {
        filteredProspects[town] = townProspects;
      }
    }

    renderProspects();
    updateStats();
  }

  /**
   * Render prospects to the page
   */
  function renderProspects() {
    prospectsContainer.innerHTML = '';

    const towns = Object.keys(filteredProspects).sort();
    const hasProspects = Object.keys(prospects).some(t => prospects[t].length > 0);
    const hasFilteredResults = towns.length > 0;

    emptyStateEl.classList.toggle('hidden', hasProspects);
    noResultsEl.classList.toggle('hidden', !hasProspects || hasFilteredResults);

    if (!hasFilteredResults) return;

    for (const town of towns) {
      const townSection = createTownSection(town, filteredProspects[town]);
      prospectsContainer.appendChild(townSection);
    }
  }

  /**
   * Create a town section with all its prospects
   */
  function createTownSection(town, townProspects) {
    const section = document.createElement('section');
    section.className = 'town-section';
    section.dataset.town = town;

    section.innerHTML = `
      <div class="town-section-header">
        <h2 class="town-section-title">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
          ${escapeHtml(town)}
        </h2>
        <span class="town-section-count">${townProspects.length} prospect${townProspects.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="prospect-cards">
        ${townProspects.map(prospect => createProspectCard(prospect, town)).join('')}
      </div>
    `;

    // Add event listeners
    addCardEventListeners(section, town);

    return section;
  }

  /**
   * Add event listeners to card buttons
   */
  function addCardEventListeners(section, town) {
    section.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', () => copyProspectInfo(btn.dataset.id, town));
    });

    section.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', () => removeProspect(btn.dataset.id, town));
    });

    section.querySelectorAll('.contact-btn').forEach(btn => {
      btn.addEventListener('click', () => markAsContacted(btn.dataset.id, town));
    });

    section.querySelectorAll('.convert-btn').forEach(btn => {
      btn.addEventListener('click', () => markAsConverted(btn.dataset.id, town));
    });

    section.querySelectorAll('.unflag-btn').forEach(btn => {
      btn.addEventListener('click', () => unflagProspect(btn.dataset.id, town));
    });
  }

  /**
   * Create a prospect card HTML
   */
  function createProspectCard(prospect, town) {
    const status = prospect.status || 'new';
    const rating = prospect.rating !== 'Not available'
      ? `<span class="rating-stars">${prospect.rating}</span> (${prospect.reviewCount} reviews)`
      : 'Not available';

    const reviewsHtml = prospect.reviews && prospect.reviews.length > 0
      ? prospect.reviews.map(review => `
          <div class="review-item">
            <p class="review-text">"${escapeHtml(review.text)}"</p>
            <span class="review-rating">${escapeHtml(review.rating)}</span>
          </div>
        `).join('')
      : '<p class="no-reviews">No reviews available</p>';

    const statusBadge = status === 'new'
      ? ''
      : `<span class="status-badge status-${status}">${status.charAt(0).toUpperCase() + status.slice(1)}</span>`;

    const flaggedBadge = prospect.flagged
      ? `<span class="status-badge status-flagged" title="${escapeHtml(prospect.flagReason || 'Flagged')}">Flagged</span>`
      : '';

    const contactBtn = status === 'new'
      ? `<button class="btn btn-sm btn-success contact-btn" data-id="${prospect.id}" title="Mark as Contacted">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72"></path>
          </svg>
          Contacted
        </button>`
      : '';

    const convertBtn = status === 'contacted'
      ? `<button class="btn btn-sm btn-primary convert-btn" data-id="${prospect.id}" title="Mark as Converted">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          Converted
        </button>`
      : '';

    const unflagBtn = prospect.flagged
      ? `<button class="btn btn-sm btn-secondary unflag-btn" data-id="${prospect.id}" title="Remove Flag">Unflag</button>`
      : '';

    const potentialWebsiteWarning = prospect.potentialWebsite
      ? `<div class="warning-box">
          <strong>Potential Website Found:</strong>
          <a href="${escapeHtml(prospect.potentialWebsite)}" target="_blank" rel="noopener noreferrer">${escapeHtml(prospect.potentialWebsite)}</a>
        </div>`
      : '';

    return `
      <article class="prospect-card ${status !== 'new' ? 'status-' + status : ''} ${prospect.flagged ? 'flagged' : ''}" data-id="${prospect.id}">
        <header class="card-header">
          <div class="card-title-row">
            <h3 class="business-name">${escapeHtml(prospect.businessName)}</h3>
            <div class="badges">${statusBadge}${flaggedBadge}</div>
          </div>
          <div class="card-actions">
            ${contactBtn}
            ${convertBtn}
            <button class="btn btn-sm btn-secondary copy-btn" data-id="${prospect.id}" title="Copy Info">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              Copy
            </button>
            ${unflagBtn}
            <button class="btn btn-sm btn-danger remove-btn" data-id="${prospect.id}" title="Remove">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </header>

        ${potentialWebsiteWarning}

        <div class="card-content">
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Phone</span>
              <span class="info-value">${escapeHtml(prospect.phone)}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Email</span>
              <span class="info-value">${escapeHtml(prospect.email)}</span>
            </div>
            <div class="info-item info-full">
              <span class="info-label">Address</span>
              <span class="info-value">${escapeHtml(prospect.address)}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Rating</span>
              <span class="info-value">${rating}</span>
            </div>
            ${prospect.contactedDate ? `
              <div class="info-item">
                <span class="info-label">Contacted</span>
                <span class="info-value">${new Date(prospect.contactedDate).toLocaleDateString()}</span>
              </div>
            ` : ''}
            ${prospect.convertedDate ? `
              <div class="info-item">
                <span class="info-label">Converted</span>
                <span class="info-value">${new Date(prospect.convertedDate).toLocaleDateString()}</span>
              </div>
            ` : ''}
          </div>

          <div class="links-section">
            <span class="info-label">Links</span>
            <div class="links-list">
              ${prospect.profileLink !== 'Not available'
                ? `<a href="${escapeHtml(prospect.profileLink)}" target="_blank" rel="noopener noreferrer" class="link-item">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                    Google Profile
                  </a>`
                : '<span class="link-item disabled">Google Profile: N/A</span>'}
              ${prospect.facebook !== 'Not available'
                ? `<a href="${escapeHtml(prospect.facebook)}" target="_blank" rel="noopener noreferrer" class="link-item">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>
                    Facebook
                  </a>`
                : '<span class="link-item disabled">Facebook: N/A</span>'}
              ${prospect.instagram !== 'Not available'
                ? `<a href="${escapeHtml(prospect.instagram)}" target="_blank" rel="noopener noreferrer" class="link-item">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path></svg>
                    Instagram
                  </a>`
                : '<span class="link-item disabled">Instagram: N/A</span>'}
            </div>
          </div>

          ${prospect.description !== 'Not available' ? `
            <div class="description-section">
              <span class="info-label">About</span>
              <p class="description-text">${escapeHtml(prospect.description)}</p>
            </div>
          ` : ''}

          <div class="reviews-section">
            <span class="info-label">Customer Reviews</span>
            <div class="reviews-list">${reviewsHtml}</div>
          </div>
        </div>
      </article>
    `;
  }

  /**
   * Copy prospect info to clipboard
   */
  async function copyProspectInfo(prospectId, town) {
    const prospect = prospects[town]?.find(p => String(p.id) === prospectId);
    if (!prospect) {
      showToast('Prospect not found', 'error');
      return;
    }

    const reviewsText = prospect.reviews && prospect.reviews.length > 0
      ? prospect.reviews.map(r => `"${r.text}" (${r.rating})`).join('\n')
      : 'No reviews available';

    const text = `Business: ${prospect.businessName}
Location: ${prospect.address !== 'Not available' ? prospect.address : prospect.location}
Phone: ${prospect.phone}
Email: ${prospect.email}

Google Profile: ${prospect.profileLink}
Facebook: ${prospect.facebook}
Instagram: ${prospect.instagram}

Rating: ${prospect.rating !== 'Not available' ? `${prospect.rating} stars (${prospect.reviewCount} reviews)` : 'Not available'}

About the Business:
${prospect.description !== 'Not available' ? prospect.description : 'No description available'}

Customer Reviews:
${reviewsText}`;

    try {
      await navigator.clipboard.writeText(text);
      showToast('Copied to clipboard!', 'success');
    } catch (error) {
      console.error('Failed to copy:', error);
      showToast('Failed to copy to clipboard', 'error');
    }
  }

  /**
   * Mark a prospect as contacted
   */
  async function markAsContacted(prospectId, town) {
    const prospectIndex = prospects[town]?.findIndex(p => String(p.id) === prospectId);
    if (prospectIndex === -1) {
      showToast('Prospect not found', 'error');
      return;
    }

    try {
      prospects[town][prospectIndex].status = 'contacted';
      prospects[town][prospectIndex].contactedDate = new Date().toISOString();

      await chrome.storage.local.set({ prospects });
      applyFilters();
      showToast('Marked as contacted!', 'success');
    } catch (error) {
      console.error('Failed to update prospect:', error);
      showToast('Failed to update prospect', 'error');
    }
  }

  /**
   * Mark a prospect as converted
   */
  async function markAsConverted(prospectId, town) {
    const prospectIndex = prospects[town]?.findIndex(p => String(p.id) === prospectId);
    if (prospectIndex === -1) {
      showToast('Prospect not found', 'error');
      return;
    }

    try {
      prospects[town][prospectIndex].status = 'converted';
      prospects[town][prospectIndex].convertedDate = new Date().toISOString();

      await chrome.storage.local.set({ prospects });
      applyFilters();
      showToast('Marked as converted!', 'success');
    } catch (error) {
      console.error('Failed to update prospect:', error);
      showToast('Failed to update prospect', 'error');
    }
  }

  /**
   * Unflag a prospect
   */
  async function unflagProspect(prospectId, town) {
    const prospectIndex = prospects[town]?.findIndex(p => String(p.id) === prospectId);
    if (prospectIndex === -1) {
      showToast('Prospect not found', 'error');
      return;
    }

    try {
      prospects[town][prospectIndex].flagged = false;
      prospects[town][prospectIndex].flagReason = null;
      prospects[town][prospectIndex].potentialWebsite = null;

      await chrome.storage.local.set({ prospects });
      applyFilters();
      showToast('Prospect unflagged', 'success');
    } catch (error) {
      console.error('Failed to unflag prospect:', error);
      showToast('Failed to unflag prospect', 'error');
    }
  }

  /**
   * Remove a prospect from storage
   */
  async function removeProspect(prospectId, town) {
    const prospect = prospects[town]?.find(p => String(p.id) === prospectId);
    if (!prospect) {
      showToast('Prospect not found', 'error');
      return;
    }

    const confirmed = confirm(`Remove "${prospect.businessName}" from your prospects?`);
    if (!confirmed) return;

    try {
      prospects[town] = prospects[town].filter(p => String(p.id) !== prospectId);
      if (prospects[town].length === 0) {
        delete prospects[town];
      }

      await chrome.storage.local.set({ prospects });
      updateTownFilter();
      applyFilters();
      showToast('Prospect removed', 'success');
    } catch (error) {
      console.error('Failed to remove prospect:', error);
      showToast('Failed to remove prospect', 'error');
    }
  }

  /**
   * Export all data to JSON
   */
  async function exportData() {
    try {
      const storage = await chrome.storage.local.get(null);
      const exportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        prospects: storage.prospects || {},
        stats: storage.stats || {},
        scannedTowns: storage.scannedTowns || []
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `prospect-scraper-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast('Data exported successfully!', 'success');
    } catch (error) {
      console.error('Export failed:', error);
      showToast('Failed to export data', 'error');
    }
  }

  /**
   * Import data from JSON file
   */
  async function importData(file) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.prospects) {
        throw new Error('Invalid backup file format');
      }

      const confirmed = confirm(
        `This will merge imported data with your existing data.\n\n` +
        `Import contains:\n` +
        `- ${Object.keys(data.prospects).length} locations\n` +
        `- ${Object.values(data.prospects).flat().length} prospects\n\n` +
        `Continue?`
      );

      if (!confirmed) return;

      // Merge prospects
      const storage = await chrome.storage.local.get(['prospects', 'scannedTowns']);
      const existingProspects = storage.prospects || {};
      const existingTowns = storage.scannedTowns || [];

      for (const town of Object.keys(data.prospects)) {
        if (!existingProspects[town]) {
          existingProspects[town] = [];
        }

        for (const prospect of data.prospects[town]) {
          const isDuplicate = existingProspects[town].some(p =>
            p.businessName === prospect.businessName ||
            (p.phone !== 'Not available' && p.phone === prospect.phone)
          );

          if (!isDuplicate) {
            existingProspects[town].push(prospect);
          }
        }
      }

      // Merge scanned towns
      const mergedTowns = [...new Set([...existingTowns, ...(data.scannedTowns || [])])];

      await chrome.storage.local.set({
        prospects: existingProspects,
        scannedTowns: mergedTowns
      });

      await loadProspects();
      showToast('Data imported successfully!', 'success');
    } catch (error) {
      console.error('Import failed:', error);
      showToast('Failed to import data: ' + error.message, 'error');
    }
  }

  /**
   * Clear all filters
   */
  function clearFilters() {
    searchInput.value = '';
    townFilter.value = 'all';
    if (statusFilter) statusFilter.value = 'all';
    applyFilters();
  }

  /**
   * Show toast notification
   */
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${type === 'success' ? '&#10003;' : type === 'error' ? '&#10007;' : '&#9432;'}</span>
      <span class="toast-message">${escapeHtml(message)}</span>
    `;

    toastContainer.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  /**
   * Escape HTML to prevent XSS
   */
  function escapeHtml(text) {
    if (typeof text !== 'string') return text;
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Debounce function for search input
   */
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  /**
   * Set up event listeners
   */
  function setupEventListeners() {
    searchInput.addEventListener('input', debounce(applyFilters, 300));
    townFilter.addEventListener('change', applyFilters);
    if (statusFilter) statusFilter.addEventListener('change', applyFilters);
    clearFiltersBtn.addEventListener('click', clearFilters);

    if (exportBtn) exportBtn.addEventListener('click', exportData);
    if (importBtn) importBtn.addEventListener('click', () => importInput.click());
    if (importInput) importInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        importData(e.target.files[0]);
        e.target.value = '';
      }
    });

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes.prospects) {
        prospects = changes.prospects.newValue || {};
        updateTownFilter();
        applyFilters();
      }
    });

    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        searchInput.focus();
      }
    });
  }

  /**
   * Initialize the page
   */
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
