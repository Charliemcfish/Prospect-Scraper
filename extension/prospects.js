/**
 * Full Prospects Page Script for Business Prospect Scraper
 * Handles displaying, searching, filtering, copying, and deleting prospects
 */

(function() {
  'use strict';

  // DOM Elements
  const totalStatsEl = document.getElementById('total-stats');
  const searchInput = document.getElementById('search-input');
  const townFilter = document.getElementById('town-filter');
  const clearFiltersBtn = document.getElementById('clear-filters');
  const prospectsContainer = document.getElementById('prospects-container');
  const emptyStateEl = document.getElementById('empty-state');
  const noResultsEl = document.getElementById('no-results');
  const toastContainer = document.getElementById('toast-container');

  // State
  let prospects = {};
  let filteredProspects = {};

  /**
   * Load prospects from storage
   */
  async function loadProspects() {
    try {
      const storage = await chrome.storage.local.get(['prospects']);
      prospects = storage.prospects || {};
      updateTownFilter();
      applyFilters();
    } catch (error) {
      console.error('Failed to load prospects:', error);
      showToast('Failed to load prospects', 'error');
    }
  }

  /**
   * Update the town filter dropdown
   */
  function updateTownFilter() {
    const currentValue = townFilter.value;

    // Clear existing options except "All"
    townFilter.innerHTML = '<option value="all">All Locations</option>';

    // Add town options
    const towns = Object.keys(prospects).sort();
    for (const town of towns) {
      if (prospects[town].length > 0) {
        const option = document.createElement('option');
        option.value = town;
        option.textContent = `${town} (${prospects[town].length})`;
        townFilter.appendChild(option);
      }
    }

    // Restore previous selection if still valid
    if (currentValue && towns.includes(currentValue)) {
      townFilter.value = currentValue;
    }
  }

  /**
   * Update total stats display
   */
  function updateStats() {
    const townCount = Object.keys(prospects).filter(t => prospects[t].length > 0).length;
    let totalProspects = 0;

    for (const town of Object.keys(prospects)) {
      totalProspects += prospects[town].length;
    }

    totalStatsEl.textContent = `${townCount} locations | ${totalProspects} prospects`;
  }

  /**
   * Apply search and filter criteria
   */
  function applyFilters() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    const selectedTown = townFilter.value;

    filteredProspects = {};

    for (const town of Object.keys(prospects)) {
      // Town filter
      if (selectedTown !== 'all' && town !== selectedTown) {
        continue;
      }

      const townProspects = prospects[town].filter(prospect => {
        // Search filter
        if (searchTerm) {
          return prospect.businessName.toLowerCase().includes(searchTerm);
        }
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

    // Show appropriate state
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

    // Add event listeners for buttons
    section.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', () => copyProspectInfo(btn.dataset.id, town));
    });

    section.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', () => removeProspect(btn.dataset.id, town));
    });

    return section;
  }

  /**
   * Create a prospect card HTML
   */
  function createProspectCard(prospect, town) {
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

    return `
      <article class="prospect-card" data-id="${prospect.id}">
        <header class="card-header">
          <h3 class="business-name">${escapeHtml(prospect.businessName)}</h3>
          <div class="card-actions">
            <button class="btn btn-sm btn-secondary copy-btn" data-id="${prospect.id}" title="Copy Info">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              Copy Info
            </button>
            <button class="btn btn-sm btn-danger remove-btn" data-id="${prospect.id}" title="Remove">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
              Remove
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
          </div>

          <div class="links-section">
            <span class="info-label">Links</span>
            <div class="links-list">
              ${prospect.profileLink !== 'Not available'
                ? `<a href="${escapeHtml(prospect.profileLink)}" target="_blank" rel="noopener noreferrer" class="link-item">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                      <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                    Google Profile
                  </a>`
                : '<span class="link-item disabled">Google Profile: Not available</span>'
              }
              ${prospect.facebook !== 'Not available'
                ? `<a href="${escapeHtml(prospect.facebook)}" target="_blank" rel="noopener noreferrer" class="link-item">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
                    </svg>
                    Facebook
                  </a>`
                : '<span class="link-item disabled">Facebook: Not available</span>'
              }
              ${prospect.instagram !== 'Not available'
                ? `<a href="${escapeHtml(prospect.instagram)}" target="_blank" rel="noopener noreferrer" class="link-item">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                    </svg>
                    Instagram
                  </a>`
                : '<span class="link-item disabled">Instagram: Not available</span>'
              }
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
            <div class="reviews-list">
              ${reviewsHtml}
            </div>
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
      // Remove from local state
      prospects[town] = prospects[town].filter(p => String(p.id) !== prospectId);

      // Remove town if empty
      if (prospects[town].length === 0) {
        delete prospects[town];
      }

      // Save to storage
      await chrome.storage.local.set({ prospects });

      // Re-render
      updateTownFilter();
      applyFilters();

      showToast('Prospect removed', 'success');
    } catch (error) {
      console.error('Failed to remove prospect:', error);
      showToast('Failed to remove prospect', 'error');
    }
  }

  /**
   * Clear all filters
   */
  function clearFilters() {
    searchInput.value = '';
    townFilter.value = 'all';
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

    // Trigger animation
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    // Remove after delay
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
    // Search input with debounce
    searchInput.addEventListener('input', debounce(applyFilters, 300));

    // Town filter
    townFilter.addEventListener('change', applyFilters);

    // Clear filters button
    clearFiltersBtn.addEventListener('click', clearFilters);

    // Listen for storage changes
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes.prospects) {
        prospects = changes.prospects.newValue || {};
        updateTownFilter();
        applyFilters();
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Focus search on Ctrl/Cmd + F
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

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
