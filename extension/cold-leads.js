/**
 * Cold Leads Page Script
 * Displays prospects that have no social media or mobile number
 * These are harder to contact but may still be valuable
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
  const settingsBtn = document.getElementById('settings-btn');

  // State
  let prospects = {};
  let filteredProspects = {};

  /**
   * Check if a phone number is a mobile number (UK format)
   */
  function isMobileNumber(phone) {
    if (!phone || phone === 'Not available') return false;
    const cleaned = phone.replace(/\s+/g, '').replace(/[()-]/g, '');
    return /^(\+44\s?7|07)\d{9}$/.test(cleaned);
  }

  /**
   * Calculate warmth score for a prospect
   */
  function calculateWarmth(prospect) {
    const hasMobile = isMobileNumber(prospect.phone);
    const hasFacebook = prospect.facebook && prospect.facebook !== 'Not available';
    const hasInstagram = prospect.instagram && prospect.instagram !== 'Not available';
    const hasSocialMedia = hasFacebook || hasInstagram;

    // Cold lead: no social media AND no mobile
    if (!hasSocialMedia && !hasMobile) {
      return { level: 'cool', hasMobile, hasFacebook, hasInstagram };
    }
    if (hasSocialMedia && hasMobile) {
      return { level: 'hot', hasMobile, hasFacebook, hasInstagram };
    }
    return { level: 'warm', hasMobile, hasFacebook, hasInstagram };
  }

  /**
   * Load prospects from storage
   */
  async function loadProspects() {
    try {
      const storage = await chrome.storage.local.get(['prospects']);
      prospects = storage.prospects || {};
      updateTownFilter();
      applyFilters();
      updateStats();
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
    townFilter.innerHTML = '<option value="all">All Locations</option>';

    const towns = Object.keys(prospects).sort();
    for (const town of towns) {
      // Only add towns that have cold leads
      const coldLeadsInTown = prospects[town].filter(p => {
        const status = p.status || 'new';
        if (status !== 'new') return false;
        return calculateWarmth(p).level === 'cool';
      });

      if (coldLeadsInTown.length > 0) {
        const option = document.createElement('option');
        option.value = town;
        option.textContent = `${town} (${coldLeadsInTown.length})`;
        townFilter.appendChild(option);
      }
    }

    if (currentValue && Array.from(townFilter.options).some(o => o.value === currentValue)) {
      townFilter.value = currentValue;
    }
  }

  /**
   * Update stats display
   */
  function updateStats() {
    let totalNew = 0;
    let totalContacted = 0;
    let totalCold = 0;

    for (const town of Object.keys(prospects)) {
      for (const prospect of prospects[town]) {
        const status = prospect.status || 'new';
        const warmth = calculateWarmth(prospect);

        if (warmth.level === 'cool') {
          totalCold++;
        }

        if (status === 'new') totalNew++;
        if (status === 'contacted' || status === 'responded' || status === 'converted') {
          totalContacted++;
        }
      }
    }

    totalStatsEl.innerHTML = `
      <div class="stat-counter">
        <span class="counter-value">${totalCold}</span>
        <span class="counter-label">Cold Leads</span>
      </div>
      <div class="stat-counter">
        <span class="counter-value">${totalNew}</span>
        <span class="counter-label">Total New</span>
      </div>
      <div class="stat-counter">
        <span class="counter-value">${totalContacted}</span>
        <span class="counter-label">Contacted</span>
      </div>
    `;
  }

  /**
   * Apply search and filter criteria
   * This page shows only COLD leads (no social media, no mobile)
   */
  function applyFilters() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    const selectedTown = townFilter.value;

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

        // Only show NEW prospects
        const prospectStatus = prospect.status || 'new';
        if (prospectStatus !== 'new') return false;

        // Only show COLD leads
        const warmth = calculateWarmth(prospect);
        if (warmth.level !== 'cool') return false;

        return true;
      });

      if (townProspects.length > 0) {
        filteredProspects[town] = townProspects;
      }
    }

    renderProspects();
  }

  /**
   * Render prospects to the page
   */
  function renderProspects() {
    prospectsContainer.innerHTML = '';

    const towns = Object.keys(filteredProspects).sort();
    const hasAnyProspects = Object.keys(prospects).some(t =>
      prospects[t].some(p => {
        const status = p.status || 'new';
        return status === 'new' && calculateWarmth(p).level === 'cool';
      })
    );
    const hasFilteredResults = towns.length > 0;

    emptyStateEl.classList.toggle('hidden', hasAnyProspects);
    noResultsEl.classList.toggle('hidden', !hasAnyProspects || hasFilteredResults);

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
    section.className = 'town-section cold-leads-section';
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
        <span class="town-section-count">${townProspects.length} cold lead${townProspects.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="prospect-cards">
        ${townProspects.map(prospect => createProspectCard(prospect, town)).join('')}
      </div>
    `;

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
  }

  /**
   * Create a prospect card HTML for cold leads
   */
  function createProspectCard(prospect, town) {
    const rating = prospect.rating !== 'Not available'
      ? `<span class="rating-stars">${prospect.rating}</span> (${prospect.reviewCount} reviews)`
      : 'Not available';

    const phoneDisplay = prospect.phone !== 'Not available'
      ? `${escapeHtml(prospect.phone)} <span class="landline-indicator">☎️ Landline</span>`
      : 'Not available';

    return `
      <article class="prospect-card" data-id="${prospect.id}">
        <header class="card-header">
          <div class="card-title-row">
            <h3 class="business-name">${escapeHtml(prospect.businessName)}</h3>
            <span class="warmth-badge cool">❄️ Cold Lead</span>
          </div>
          <div class="card-actions">
            <button class="btn btn-sm btn-success contact-btn" data-id="${prospect.id}" title="Mark as Contacted">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
              </svg>
              Contacted
            </button>
            <button class="btn btn-sm btn-secondary copy-btn" data-id="${prospect.id}" title="Copy Info">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              Copy
            </button>
            <button class="btn btn-sm btn-danger remove-btn" data-id="${prospect.id}" title="Remove">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </header>

        <div class="card-content">
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Phone</span>
              <span class="info-value">${phoneDisplay}</span>
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
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                    Google Profile
                  </a>`
                : '<span class="link-item disabled">Google Profile: N/A</span>'}
              <span class="link-item disabled">Facebook: N/A</span>
              <span class="link-item disabled">Instagram: N/A</span>
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

  /**
   * Copy prospect info to clipboard
   */
  async function copyProspectInfo(prospectId, town) {
    const prospect = prospects[town]?.find(p => String(p.id) === prospectId);
    if (!prospect) {
      showToast('Prospect not found', 'error');
      return;
    }

    const text = `Business: ${prospect.businessName}
Location: ${prospect.address !== 'Not available' ? prospect.address : prospect.location}
Phone: ${prospect.phone}
Email: ${prospect.email}

Google Profile: ${prospect.profileLink}

Rating: ${prospect.rating !== 'Not available' ? `${prospect.rating} stars (${prospect.reviewCount} reviews)` : 'Not available'}

Note: This is a cold lead - no social media or mobile number available.`;

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
      updateStats();
      showToast('Marked as contacted!', 'success');
    } catch (error) {
      console.error('Failed to update prospect:', error);
      showToast('Failed to update prospect', 'error');
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
      updateStats();
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
    clearFiltersBtn.addEventListener('click', clearFilters);

    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        window.location.href = 'prospects.html';
      });
    }

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes.prospects) {
        prospects = changes.prospects.newValue || {};
        updateTownFilter();
        applyFilters();
        updateStats();
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
