/**
 * Follow Up Page Script
 * Shows contacted prospects older than 7 days that haven't responded
 * With personalized follow-up message copy functionality
 */

(function() {
  'use strict';

  const totalStatsEl = document.getElementById('total-stats');
  const searchInput = document.getElementById('search-input');
  const townFilter = document.getElementById('town-filter');
  const daysFilter = document.getElementById('days-filter');
  const clearFiltersBtn = document.getElementById('clear-filters');
  const prospectsContainer = document.getElementById('prospects-container');
  const emptyStateEl = document.getElementById('empty-state');
  const noResultsEl = document.getElementById('no-results');
  const toastContainer = document.getElementById('toast-container');
  const settingsBtn = document.getElementById('settings-btn');

  let prospects = {};
  let followUpProspects = {};
  let filteredProspects = {};

  const FOLLOW_UP_DAYS = 7;
  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  async function loadProspects() {
    try {
      const storage = await chrome.storage.local.get(['prospects']);
      prospects = storage.prospects || {};

      filterFollowUpProspects();
      updateTownFilter();
      applyFilters();
    } catch (error) {
      console.error('Failed to load prospects:', error);
      showToast('Failed to load prospects', 'error');
    }
  }

  function filterFollowUpProspects() {
    const minDays = parseInt(daysFilter.value) || FOLLOW_UP_DAYS;
    const now = Date.now();

    followUpProspects = {};
    for (const town of Object.keys(prospects)) {
      const followUps = prospects[town].filter(p => {
        // Only contacted prospects that haven't responded
        if (p.status !== 'contacted') return false;
        if (p.responded) return false;

        // Check if contacted date is older than threshold
        if (!p.contactedDate) return false;
        const contactedDate = new Date(p.contactedDate).getTime();
        const daysSinceContact = Math.floor((now - contactedDate) / MS_PER_DAY);

        return daysSinceContact >= minDays;
      });

      if (followUps.length > 0) {
        // Sort by oldest first (most urgent follow-ups)
        followUps.sort((a, b) => new Date(a.contactedDate) - new Date(b.contactedDate));
        followUpProspects[town] = followUps;
      }
    }
  }

  function getDaysSinceContact(contactedDate) {
    if (!contactedDate) return 0;
    const now = Date.now();
    const contacted = new Date(contactedDate).getTime();
    return Math.floor((now - contacted) / MS_PER_DAY);
  }

  function updateTownFilter() {
    const currentValue = townFilter.value;
    townFilter.innerHTML = '<option value="all">All Locations</option>';

    const towns = Object.keys(followUpProspects).sort();
    for (const town of towns) {
      const option = document.createElement('option');
      option.value = town;
      option.textContent = `${town} (${followUpProspects[town].length})`;
      townFilter.appendChild(option);
    }

    if (currentValue && towns.includes(currentValue)) {
      townFilter.value = currentValue;
    }
  }

  function updateStats() {
    let total = 0;
    let urgent = 0; // 14+ days
    const now = Date.now();

    for (const town of Object.keys(followUpProspects)) {
      for (const prospect of followUpProspects[town]) {
        total++;
        const days = getDaysSinceContact(prospect.contactedDate);
        if (days >= 14) urgent++;
      }
    }

    totalStatsEl.innerHTML = `
      <div class="stat-counter stat-warning">
        <span class="counter-value">${total}</span>
        <span class="counter-label">Need Follow Up</span>
      </div>
      ${urgent > 0 ? `
      <div class="stat-counter stat-danger">
        <span class="counter-value">${urgent}</span>
        <span class="counter-label">Urgent (14+ days)</span>
      </div>
      ` : ''}
    `;
  }

  function applyFilters() {
    filterFollowUpProspects();

    const searchTerm = searchInput.value.toLowerCase().trim();
    const selectedTown = townFilter.value;

    filteredProspects = {};

    for (const town of Object.keys(followUpProspects)) {
      if (selectedTown !== 'all' && town !== selectedTown) continue;

      const filtered = followUpProspects[town].filter(prospect =>
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
    const hasProspects = Object.keys(followUpProspects).length > 0;
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
        <span class="town-section-count">${townProspects.length} prospect${townProspects.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="prospect-cards">
        ${townProspects.map(p => createProspectCard(p, town)).join('')}
      </div>
    `;

    section.querySelectorAll('.copy-followup-btn').forEach(btn => {
      btn.addEventListener('click', () => copyFollowUpMessage(btn.dataset.id, town));
    });

    section.querySelectorAll('.responded-btn').forEach(btn => {
      btn.addEventListener('click', () => markAsResponded(btn.dataset.id, town));
    });

    section.querySelectorAll('.convert-btn').forEach(btn => {
      btn.addEventListener('click', () => markAsConverted(btn.dataset.id, town));
    });

    return section;
  }

  function createProspectCard(prospect, town) {
    const days = getDaysSinceContact(prospect.contactedDate);
    const urgencyClass = days >= 14 ? 'urgent' : '';
    const urgencyLabel = days >= 14 ? 'Urgent' : `${days} days`;

    const hasSocial = prospect.facebook !== 'Not available' || prospect.instagram !== 'Not available';
    const hasMobile = prospect.phone && prospect.phone !== 'Not available' && /^07/.test(prospect.phone.replace(/\s/g, ''));

    return `
      <article class="prospect-card follow-up-card ${urgencyClass}" data-id="${prospect.id}">
        <header class="card-header">
          <div class="card-title-row">
            <h3 class="business-name">${escapeHtml(prospect.businessName)}</h3>
            <div class="badge-group">
              <span class="days-badge ${urgencyClass}">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                ${urgencyLabel}
              </span>
            </div>
          </div>
          <div class="card-actions">
            <button class="btn btn-sm btn-primary copy-followup-btn" data-id="${prospect.id}" title="Copy follow-up message">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
              Copy Follow Up
            </button>
            <button class="btn btn-sm btn-secondary responded-btn" data-id="${prospect.id}">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
              Responded
            </button>
            <button class="btn btn-sm btn-success convert-btn" data-id="${prospect.id}">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
              Converted
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
              <span class="info-label">Contacted</span>
              <span class="info-value">${prospect.contactedDate ? new Date(prospect.contactedDate).toLocaleDateString() : 'N/A'}</span>
            </div>
            <div class="info-item info-full">
              <span class="info-label">Contact Options</span>
              <div class="contact-options">
                ${hasMobile ? `<span class="contact-option available">Mobile</span>` : ''}
                ${prospect.facebook !== 'Not available' ? `<a href="${prospect.facebook}" target="_blank" class="contact-option available">Facebook</a>` : ''}
                ${prospect.instagram !== 'Not available' ? `<a href="${prospect.instagram}" target="_blank" class="contact-option available">Instagram</a>` : ''}
                ${!hasMobile && !hasSocial ? `<span class="contact-option unavailable">Limited options</span>` : ''}
              </div>
            </div>
          </div>
        </div>
      </article>
    `;
  }

  function generateFollowUpMessage(prospect) {
    const businessName = prospect.businessName;
    const firstName = extractFirstName(businessName);

    return `Hi ${firstName ? firstName : 'there'}!

I reached out about a week ago regarding your online presence for ${businessName}. I know running a business keeps you incredibly busy!

I just wanted to follow up and see if you had a chance to think about it. I'm still happy to offer a free website mockup so you can see exactly what I can do for ${businessName} before making any decisions.

No pressure at all - just let me know if you're interested or have any questions!

Best regards`;
  }

  function extractFirstName(businessName) {
    // Try to extract a first name if the business name looks like a person's name
    // e.g., "John's Plumbing" -> "John", "Smith & Sons" -> null
    const possessiveMatch = businessName.match(/^([A-Z][a-z]+)'s\s/);
    if (possessiveMatch) {
      return possessiveMatch[1];
    }
    return null;
  }

  async function copyFollowUpMessage(prospectId, town) {
    const prospect = prospects[town]?.find(p => String(p.id) === String(prospectId));
    if (!prospect) return;

    const message = generateFollowUpMessage(prospect);

    try {
      await navigator.clipboard.writeText(message);
      showToast('Follow-up message copied!', 'success');
    } catch (error) {
      showToast('Failed to copy message', 'error');
    }
  }

  async function markAsResponded(prospectId, town) {
    const prospectIndex = prospects[town]?.findIndex(p => String(p.id) === String(prospectId));
    if (prospectIndex === -1) return;

    try {
      prospects[town][prospectIndex].responded = true;
      prospects[town][prospectIndex].respondedDate = new Date().toISOString();

      await chrome.storage.local.set({ prospects });
      await loadProspects();
      showToast('Marked as responded!', 'success');
    } catch (error) {
      showToast('Failed to update prospect', 'error');
    }
  }

  async function markAsConverted(prospectId, town) {
    const prospectIndex = prospects[town]?.findIndex(p => String(p.id) === String(prospectId));
    if (prospectIndex === -1) return;

    try {
      prospects[town][prospectIndex].status = 'converted';
      prospects[town][prospectIndex].convertedDate = new Date().toISOString();
      prospects[town][prospectIndex].responded = true;

      await chrome.storage.local.set({ prospects });
      await loadProspects();
      showToast('Customer converted!', 'success');
    } catch (error) {
      showToast('Failed to convert customer', 'error');
    }
  }

  function clearFilters() {
    searchInput.value = '';
    townFilter.value = 'all';
    daysFilter.value = '7';
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
    daysFilter.addEventListener('change', applyFilters);
    clearFiltersBtn.addEventListener('click', clearFilters);

    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        window.location.href = 'prospects.html';
      });
    }

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
