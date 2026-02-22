/**
 * Contacted Prospects Page Script
 * Shows only prospects with status 'contacted' or 'responded'
 * With bulk actions, responded tracking, and move back functionality
 */

(function() {
  'use strict';

  const totalStatsEl = document.getElementById('total-stats');
  const searchInput = document.getElementById('search-input');
  const townFilter = document.getElementById('town-filter');
  const statusFilter = document.getElementById('status-filter');
  const clearFiltersBtn = document.getElementById('clear-filters');
  const prospectsContainer = document.getElementById('prospects-container');
  const emptyStateEl = document.getElementById('empty-state');
  const noResultsEl = document.getElementById('no-results');
  const toastContainer = document.getElementById('toast-container');
  const bulkActionsBar = document.getElementById('bulk-actions-bar');
  const selectedCountEl = document.getElementById('selected-count');
  const bulkRespondedBtn = document.getElementById('bulk-responded-btn');
  const bulkConvertBtn = document.getElementById('bulk-convert-btn');
  const bulkBackBtn = document.getElementById('bulk-back-btn');
  const bulkDeleteBtn = document.getElementById('bulk-delete-btn');
  const bulkCancelBtn = document.getElementById('bulk-cancel-btn');
  const settingsBtn = document.getElementById('settings-btn');
  const platformModal = document.getElementById('platform-modal');
  const closePlatformModal = document.getElementById('close-platform-modal');
  const platformBtns = document.querySelectorAll('.platform-btn');

  let prospects = {};
  let contactedProspects = {};
  let filteredProspects = {};
  let selectedProspects = new Set();
  let pendingConversion = null; // Stores {prospectId, town} when awaiting platform selection

  async function loadProspects() {
    try {
      const storage = await chrome.storage.local.get(['prospects']);
      prospects = storage.prospects || {};

      // Filter to only contacted/responded prospects (not converted)
      contactedProspects = {};
      for (const town of Object.keys(prospects)) {
        const contacted = prospects[town].filter(p => p.status === 'contacted' || p.status === 'responded');
        if (contacted.length > 0) {
          contactedProspects[town] = contacted;
        }
      }

      updateTownFilter();
      applyFilters();
    } catch (error) {
      console.error('Failed to load prospects:', error);
      showToast('Failed to load prospects', 'error');
    }
  }

  function updateTownFilter() {
    const currentValue = townFilter.value;
    townFilter.innerHTML = '<option value="all">All Locations</option>';

    const towns = Object.keys(contactedProspects).sort();
    for (const town of towns) {
      const option = document.createElement('option');
      option.value = town;
      option.textContent = `${town} (${contactedProspects[town].length})`;
      townFilter.appendChild(option);
    }

    if (currentValue && towns.includes(currentValue)) {
      townFilter.value = currentValue;
    }
  }

  function updateStats() {
    let total = 0;
    let responded = 0;
    let awaiting = 0;

    for (const town of Object.keys(contactedProspects)) {
      for (const p of contactedProspects[town]) {
        total++;
        if (p.status === 'responded') {
          responded++;
        } else {
          awaiting++;
        }
      }
    }

    const responseRate = total > 0 ? ((responded / total) * 100).toFixed(1) : 0;

    totalStatsEl.innerHTML = `
      <div class="stat-counter">
        <span class="counter-value">${total}</span>
        <span class="counter-label">Contacted</span>
      </div>
      <div class="stat-counter">
        <span class="counter-value">${awaiting}</span>
        <span class="counter-label">Awaiting</span>
      </div>
      <div class="stat-counter stat-responded">
        <span class="counter-value">${responded}</span>
        <span class="counter-label">Responded</span>
      </div>
      <div class="stat-counter stat-rate">
        <span class="counter-value">${responseRate}%</span>
        <span class="counter-label">Response Rate</span>
      </div>
    `;
  }

  function applyFilters() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    const selectedTown = townFilter.value;
    const selectedStatus = statusFilter.value;

    filteredProspects = {};

    for (const town of Object.keys(contactedProspects)) {
      if (selectedTown !== 'all' && town !== selectedTown) continue;

      const filtered = contactedProspects[town].filter(prospect => {
        if (searchTerm && !prospect.businessName.toLowerCase().includes(searchTerm)) return false;

        if (selectedStatus === 'responded' && prospect.status !== 'responded') return false;
        if (selectedStatus === 'awaiting' && prospect.status !== 'contacted') return false;

        return true;
      });

      if (filtered.length > 0) {
        filteredProspects[town] = filtered;
      }
    }

    renderProspects();
    updateStats();
    updateBulkActionsBar();
  }

  function renderProspects() {
    prospectsContainer.innerHTML = '';

    const towns = Object.keys(filteredProspects).sort();
    const hasProspects = Object.keys(contactedProspects).length > 0;
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

    addCardEventListeners(section, town);

    return section;
  }

  function addCardEventListeners(section, town) {
    section.querySelectorAll('.convert-btn').forEach(btn => {
      btn.addEventListener('click', () => markAsConverted(btn.dataset.id, town));
    });

    section.querySelectorAll('.responded-btn').forEach(btn => {
      btn.addEventListener('click', () => markAsResponded(btn.dataset.id, town));
    });

    section.querySelectorAll('.back-btn').forEach(btn => {
      btn.addEventListener('click', () => moveBackToNew(btn.dataset.id, town));
    });

    section.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', () => copyProspectInfo(btn.dataset.id, town));
    });

    section.querySelectorAll('.prospect-checkbox').forEach(cb => {
      cb.addEventListener('change', (e) => toggleProspectSelection(e.target.dataset.id, town, e.target.checked));
    });
  }

  function createProspectCard(prospect, town) {
    const rating = prospect.rating !== 'Not available'
      ? `${prospect.rating} (${prospect.reviewCount} reviews)`
      : 'Not available';

    const isResponded = prospect.status === 'responded';
    const statusBadge = isResponded
      ? '<span class="status-badge status-responded">Responded</span>'
      : '<span class="status-badge status-contacted">Contacted</span>';

    const isSelected = selectedProspects.has(`${town}-${prospect.id}`);

    const respondedBtn = !isResponded
      ? `<button class="btn btn-sm btn-secondary responded-btn" data-id="${prospect.id}" title="Mark as Responded">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
          Responded
        </button>`
      : '';

    return `
      <article class="prospect-card ${isResponded ? 'status-responded' : 'status-contacted'}" data-id="${prospect.id}">
        <header class="card-header">
          <div class="card-select">
            <input type="checkbox" class="prospect-checkbox" data-id="${prospect.id}" ${isSelected ? 'checked' : ''}>
          </div>
          <div class="card-title-row">
            <h3 class="business-name">${escapeHtml(prospect.businessName)}</h3>
            ${statusBadge}
          </div>
          <div class="card-actions">
            ${respondedBtn}
            <button class="btn btn-sm btn-primary convert-btn" data-id="${prospect.id}" title="Mark as Converted">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
              Converted
            </button>
            <button class="btn btn-sm btn-outline back-btn" data-id="${prospect.id}" title="Move back to New Prospects">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
              Back to New
            </button>
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
              <span class="info-label">Contacted</span>
              <span class="info-value">${prospect.contactedDate ? new Date(prospect.contactedDate).toLocaleDateString() : 'N/A'}</span>
            </div>
            ${prospect.respondedDate ? `
              <div class="info-item">
                <span class="info-label">Responded</span>
                <span class="info-value">${new Date(prospect.respondedDate).toLocaleDateString()}</span>
              </div>
            ` : ''}
            <div class="info-item info-full">
              <span class="info-label">Address</span>
              <span class="info-value">${escapeHtml(prospect.address)}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Rating</span>
              <span class="info-value">${rating}</span>
            </div>
          </div>
        </div>
      </article>
    `;
  }

  function toggleProspectSelection(prospectId, town, isSelected) {
    const key = `${town}-${prospectId}`;
    if (isSelected) {
      selectedProspects.add(key);
    } else {
      selectedProspects.delete(key);
    }
    updateBulkActionsBar();
  }

  function updateBulkActionsBar() {
    const count = selectedProspects.size;
    selectedCountEl.textContent = count;

    if (count > 0) {
      bulkActionsBar.classList.remove('hidden');
    } else {
      bulkActionsBar.classList.add('hidden');
    }
  }

  function selectAllProspects(checked) {
    selectedProspects.clear();

    if (checked) {
      for (const town of Object.keys(filteredProspects)) {
        for (const prospect of filteredProspects[town]) {
          selectedProspects.add(`${town}-${prospect.id}`);
        }
      }
    }

    document.querySelectorAll('.prospect-checkbox').forEach(cb => {
      cb.checked = checked;
    });

    updateBulkActionsBar();
  }

  async function bulkMarkAsResponded() {
    if (selectedProspects.size === 0) return;

    try {
      let count = 0;
      for (const key of selectedProspects) {
        const [town, id] = key.split('-');
        const prospectIndex = prospects[town]?.findIndex(p => String(p.id) === id);
        if (prospectIndex !== -1 && prospects[town][prospectIndex].status === 'contacted') {
          prospects[town][prospectIndex].status = 'responded';
          prospects[town][prospectIndex].respondedDate = new Date().toISOString();
          count++;
        }
      }

      await chrome.storage.local.set({ prospects });
      selectedProspects.clear();
      await loadProspects();
      showToast(`${count} prospects marked as responded!`, 'success');
    } catch (error) {
      console.error('Failed to bulk update:', error);
      showToast('Failed to update prospects', 'error');
    }
  }

  async function bulkMarkAsConverted() {
    if (selectedProspects.size === 0) return;

    try {
      let count = 0;
      for (const key of selectedProspects) {
        const [town, id] = key.split('-');
        const prospectIndex = prospects[town]?.findIndex(p => String(p.id) === id);
        if (prospectIndex !== -1) {
          prospects[town][prospectIndex].status = 'converted';
          prospects[town][prospectIndex].convertedDate = new Date().toISOString();
          count++;
        }
      }

      await chrome.storage.local.set({ prospects });
      selectedProspects.clear();
      await loadProspects();
      showToast(`${count} prospects marked as converted!`, 'success');
    } catch (error) {
      console.error('Failed to bulk update:', error);
      showToast('Failed to update prospects', 'error');
    }
  }

  async function bulkMoveToNew() {
    if (selectedProspects.size === 0) return;

    const confirmed = confirm(`Move ${selectedProspects.size} prospects back to New Prospects?`);
    if (!confirmed) return;

    try {
      let count = 0;
      for (const key of selectedProspects) {
        const [town, id] = key.split('-');
        const prospectIndex = prospects[town]?.findIndex(p => String(p.id) === id);
        if (prospectIndex !== -1) {
          prospects[town][prospectIndex].status = 'new';
          prospects[town][prospectIndex].contactedDate = null;
          prospects[town][prospectIndex].respondedDate = null;
          count++;
        }
      }

      await chrome.storage.local.set({ prospects });
      selectedProspects.clear();
      await loadProspects();
      showToast(`${count} prospects moved back to new!`, 'success');
    } catch (error) {
      console.error('Failed to bulk update:', error);
      showToast('Failed to update prospects', 'error');
    }
  }

  async function bulkDelete() {
    if (selectedProspects.size === 0) return;

    const confirmed = confirm(`Delete ${selectedProspects.size} prospects? This cannot be undone.`);
    if (!confirmed) return;

    try {
      for (const key of selectedProspects) {
        const [town, id] = key.split('-');
        if (prospects[town]) {
          prospects[town] = prospects[town].filter(p => String(p.id) !== id);
          if (prospects[town].length === 0) {
            delete prospects[town];
          }
        }
      }

      await chrome.storage.local.set({ prospects });
      selectedProspects.clear();
      await loadProspects();
      showToast('Prospects deleted', 'success');
    } catch (error) {
      console.error('Failed to bulk delete:', error);
      showToast('Failed to delete prospects', 'error');
    }
  }

  function cancelBulkSelection() {
    selectedProspects.clear();
    document.querySelectorAll('.prospect-checkbox').forEach(cb => {
      cb.checked = false;
    });
    updateBulkActionsBar();
  }

  function showPlatformModal(prospectId, town) {
    pendingConversion = { prospectId, town };
    platformModal.classList.add('active');
  }

  function hidePlatformModal() {
    platformModal.classList.remove('active');
    pendingConversion = null;
  }

  async function markAsConverted(prospectId, town) {
    // Show platform selection modal instead of directly converting
    showPlatformModal(prospectId, town);
  }

  async function completeConversion(platform) {
    if (!pendingConversion) return;

    const { prospectId, town } = pendingConversion;
    const prospectIndex = prospects[town]?.findIndex(p => String(p.id) === String(prospectId));
    if (prospectIndex === -1) {
      showToast('Prospect not found', 'error');
      hidePlatformModal();
      return;
    }

    try {
      prospects[town][prospectIndex].status = 'converted';
      prospects[town][prospectIndex].convertedDate = new Date().toISOString();
      prospects[town][prospectIndex].convertedPlatform = platform;

      await chrome.storage.local.set({ prospects });
      hidePlatformModal();
      await loadProspects();
      showToast(`Marked as converted via ${platform}!`, 'success');
    } catch (error) {
      showToast('Failed to update prospect', 'error');
      hidePlatformModal();
    }
  }

  async function markAsResponded(prospectId, town) {
    const prospectIndex = prospects[town]?.findIndex(p => String(p.id) === prospectId);
    if (prospectIndex === -1) return;

    try {
      prospects[town][prospectIndex].status = 'responded';
      prospects[town][prospectIndex].respondedDate = new Date().toISOString();

      await chrome.storage.local.set({ prospects });
      await loadProspects();
      showToast('Marked as responded!', 'success');
    } catch (error) {
      showToast('Failed to update prospect', 'error');
    }
  }

  async function moveBackToNew(prospectId, town) {
    const prospectIndex = prospects[town]?.findIndex(p => String(p.id) === prospectId);
    if (prospectIndex === -1) return;

    try {
      prospects[town][prospectIndex].status = 'new';
      prospects[town][prospectIndex].contactedDate = null;
      prospects[town][prospectIndex].respondedDate = null;

      await chrome.storage.local.set({ prospects });
      await loadProspects();
      showToast('Moved back to new prospects!', 'success');
    } catch (error) {
      showToast('Failed to update prospect', 'error');
    }
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
    statusFilter.value = 'all';
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
    statusFilter.addEventListener('change', applyFilters);
    clearFiltersBtn.addEventListener('click', clearFilters);

    // Bulk actions
    if (bulkRespondedBtn) bulkRespondedBtn.addEventListener('click', bulkMarkAsResponded);
    if (bulkConvertBtn) bulkConvertBtn.addEventListener('click', bulkMarkAsConverted);
    if (bulkBackBtn) bulkBackBtn.addEventListener('click', bulkMoveToNew);
    if (bulkDeleteBtn) bulkDeleteBtn.addEventListener('click', bulkDelete);
    if (bulkCancelBtn) bulkCancelBtn.addEventListener('click', cancelBulkSelection);

    // Settings button opens prospects page settings
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        window.location.href = 'prospects.html';
      });
    }

    // Platform modal
    if (closePlatformModal) {
      closePlatformModal.addEventListener('click', hidePlatformModal);
    }
    if (platformModal) {
      platformModal.addEventListener('click', (e) => {
        if (e.target === platformModal) hidePlatformModal();
      });
    }
    platformBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const platform = btn.dataset.platform;
        completeConversion(platform);
      });
    });

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
