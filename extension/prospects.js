/**
 * Full Prospects Page Script for Business Prospect Scraper
 * Handles displaying, searching, filtering, copying, and managing prospects
 * With Contacted/Converted tracking, warmth ranking, bulk actions, and messaging
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
  const settingsBtn = document.getElementById('settings-btn');
  const settingsModal = document.getElementById('settings-modal');
  const closeSettingsBtn = document.getElementById('close-settings');
  const clearAllBtn = document.getElementById('clear-all-btn');
  const bulkActionsBar = document.getElementById('bulk-actions-bar');
  const selectedCountEl = document.getElementById('selected-count');
  const bulkContactBtn = document.getElementById('bulk-contact-btn');
  const bulkDeleteBtn = document.getElementById('bulk-delete-btn');
  const bulkCancelBtn = document.getElementById('bulk-cancel-btn');

  // State
  let prospects = {};
  let stats = { totalAdded: 0, totalContacted: 0, totalConverted: 0, totalResponded: 0 };
  let filteredProspects = {};
  let selectedProspects = new Set();
  let previousStats = {};

  // Message template for social media outreach
  const MESSAGE_TEMPLATE = (businessName) =>
`Hi there!

I hope you're well. My name's Charlie and I run a web design agency called Transform Sites.

I noticed ${businessName} doesn't have a website yet, so I've put together a quick demo site to show what we could create for you.

Would you like me to send over the link so you can take a look? No pressure at all - just thought it might be useful!

Best,
Charlie
Transform Sites`;

  // Text message template
  const TEXT_MESSAGE_TEMPLATE = (businessName) =>
`Hi! I'm Charlie from Transform Sites. I noticed ${businessName} doesn't have a website yet, so I've built a quick demo for you. Would you like to see it? Just reply and I'll send the link over!`;

  /**
   * Check if a phone number is a mobile number (UK format)
   */
  function isMobileNumber(phone) {
    if (!phone || phone === 'Not available') return false;
    const cleaned = phone.replace(/\s+/g, '').replace(/[()-]/g, '');
    // UK mobile numbers start with 07 or +447
    return /^(\+44\s?7|07)\d{9}$/.test(cleaned);
  }

  /**
   * Calculate warmth score for a prospect
   * Higher score = warmer lead
   */
  function calculateWarmth(prospect) {
    let score = 0;
    const hasMobile = isMobileNumber(prospect.phone);
    const hasFacebook = prospect.facebook && prospect.facebook !== 'Not available';
    const hasInstagram = prospect.instagram && prospect.instagram !== 'Not available';
    const hasSocialMedia = hasFacebook || hasInstagram;
    const hasBothSocial = hasFacebook && hasInstagram;

    if (hasMobile) score += 2;
    if (hasFacebook) score += 2;
    if (hasInstagram) score += 2;
    if (hasBothSocial) score += 1; // Bonus for having both

    // Hot lead: has social media AND mobile
    if (hasSocialMedia && hasMobile) {
      return { score: score + 5, level: 'hot', hasMobile, hasFacebook, hasInstagram };
    }
    // Warm lead: has social media OR mobile
    if (hasSocialMedia || hasMobile) {
      return { score, level: 'warm', hasMobile, hasFacebook, hasInstagram };
    }
    // Cool lead: no social media, no mobile
    return { score, level: 'cool', hasMobile, hasFacebook, hasInstagram };
  }

  /**
   * Sort prospects by warmth (hottest first)
   */
  function sortByWarmth(prospects) {
    return [...prospects].sort((a, b) => {
      const warmthA = calculateWarmth(a);
      const warmthB = calculateWarmth(b);
      return warmthB.score - warmthA.score;
    });
  }

  /**
   * Load prospects from storage
   */
  async function loadProspects() {
    try {
      const storage = await chrome.storage.local.get(['prospects', 'stats']);
      prospects = storage.prospects || {};
      stats = storage.stats || { totalAdded: 0, totalContacted: 0, totalConverted: 0, totalResponded: 0 };

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
    let totalResponded = 0;

    for (const town of Object.keys(prospects)) {
      for (const prospect of prospects[town]) {
        totalAdded++;
        if (prospect.status === 'contacted' || prospect.status === 'converted' || prospect.status === 'responded') {
          totalContacted++;
        }
        if (prospect.status === 'responded' || prospect.status === 'converted') {
          totalResponded++;
        }
        if (prospect.status === 'converted') {
          totalConverted++;
        }
      }
    }

    previousStats = { ...stats };
    stats = { totalAdded, totalContacted, totalConverted, totalResponded };
  }

  /**
   * Animate counter from start to end value
   */
  function animateCounter(element, start, end, duration = 500) {
    if (start === end) return;

    const startTime = performance.now();
    const diff = end - start;

    function updateCounter(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      const current = Math.round(start + diff * easeProgress);

      element.textContent = current;
      element.classList.add('counter-animated');

      if (progress < 1) {
        requestAnimationFrame(updateCounter);
      }
    }

    requestAnimationFrame(updateCounter);
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
   * Update total stats display with counter animation
   */
  function updateStats() {
    recalculateStats();
    const responseRate = stats.totalContacted > 0
      ? ((stats.totalResponded / stats.totalContacted) * 100).toFixed(1)
      : 0;
    const conversionRate = stats.totalContacted > 0
      ? ((stats.totalConverted / stats.totalContacted) * 100).toFixed(1)
      : 0;

    // Count new prospects only
    let newProspects = 0;
    for (const town of Object.keys(prospects)) {
      newProspects += prospects[town].filter(p => !p.status || p.status === 'new').length;
    }

    totalStatsEl.innerHTML = `
      <div class="stat-counter">
        <span class="counter-value" id="stat-new">${newProspects}</span>
        <span class="counter-label">New</span>
      </div>
      <div class="stat-counter">
        <span class="counter-value" id="stat-contacted">${stats.totalContacted}</span>
        <span class="counter-label">Contacted</span>
      </div>
      <div class="stat-counter stat-responded">
        <span class="counter-value" id="stat-responded">${stats.totalResponded}</span>
        <span class="counter-label">Responded</span>
      </div>
      <div class="stat-counter">
        <span class="counter-value" id="stat-converted">${stats.totalConverted}</span>
        <span class="counter-label">Converted</span>
      </div>
      <div class="stat-counter stat-rate">
        <span class="counter-value" id="stat-response-rate">${responseRate}%</span>
        <span class="counter-label">Response</span>
      </div>
      <div class="stat-counter stat-rate">
        <span class="counter-value" id="stat-conversion-rate">${conversionRate}%</span>
        <span class="counter-label">Conversion</span>
      </div>
    `;
  }

  /**
   * Apply search and filter criteria
   * This page shows only NEW prospects (not contacted or converted)
   * Excludes cold leads (those go to cold-leads.html)
   */
  function applyFilters() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    const selectedTown = townFilter.value;
    const selectedStatus = statusFilter ? statusFilter.value : 'new';

    filteredProspects = {};

    // Collect all prospects first, then we'll sort globally
    let allFilteredProspects = [];

    for (const town of Object.keys(prospects)) {
      if (selectedTown !== 'all' && town !== selectedTown) {
        continue;
      }

      let townProspects = prospects[town].filter(prospect => {
        // Search filter
        if (searchTerm && !prospect.businessName.toLowerCase().includes(searchTerm)) {
          return false;
        }

        // This page only shows NEW prospects
        const prospectStatus = prospect.status || 'new';
        if (prospectStatus !== 'new') return false;

        // Calculate warmth to determine if this is a cold lead
        const warmth = calculateWarmth(prospect);

        // Exclude cold leads from this page - they go to cold-leads.html
        if (warmth.level === 'cool') return false;

        // Filter by status/warmth
        if (selectedStatus === 'flagged' && !prospect.flagged) return false;
        if (selectedStatus === 'hot' && warmth.level !== 'hot') return false;

        return true;
      });

      // Add town info to each prospect for rendering
      townProspects.forEach(p => {
        allFilteredProspects.push({ ...p, _town: town });
      });
    }

    // Sort ALL prospects globally by warmth (hot first, then warm)
    allFilteredProspects = sortByWarmth(allFilteredProspects);

    // Now group back by town, but maintain the global sort order
    // by processing in sorted order
    const hotLeads = [];
    const warmLeadsByTown = {};

    for (const prospect of allFilteredProspects) {
      const warmth = calculateWarmth(prospect);
      const town = prospect._town;

      if (warmth.level === 'hot') {
        hotLeads.push({ prospect, town });
      } else {
        if (!warmLeadsByTown[town]) {
          warmLeadsByTown[town] = [];
        }
        warmLeadsByTown[town].push(prospect);
      }
    }

    // Store for rendering - hot leads get special treatment
    filteredProspects._hotLeads = hotLeads;
    filteredProspects._warmLeadsByTown = warmLeadsByTown;

    // Also store in the old format for compatibility
    for (const town of Object.keys(warmLeadsByTown)) {
      filteredProspects[town] = warmLeadsByTown[town];
    }

    renderProspects();
    updateStats();
    updateBulkActionsBar();
  }

  /**
   * Render prospects to the page
   * Hot leads appear at the very top, then warm leads grouped by town
   */
  function renderProspects() {
    prospectsContainer.innerHTML = '';

    const hotLeads = filteredProspects._hotLeads || [];
    const warmLeadsByTown = filteredProspects._warmLeadsByTown || {};
    const warmTowns = Object.keys(warmLeadsByTown).sort();

    const hasProspects = Object.keys(prospects).some(t => prospects[t].length > 0);
    const hasFilteredResults = hotLeads.length > 0 || warmTowns.length > 0;

    emptyStateEl.classList.toggle('hidden', hasProspects);
    noResultsEl.classList.toggle('hidden', !hasProspects || hasFilteredResults);

    if (!hasFilteredResults) return;

    // Render hot leads section first (always at the top)
    if (hotLeads.length > 0) {
      const hotSection = createHotLeadsSection(hotLeads);
      prospectsContainer.appendChild(hotSection);
    }

    // Render warm leads grouped by town
    for (const town of warmTowns) {
      const townSection = createTownSection(town, warmLeadsByTown[town]);
      prospectsContainer.appendChild(townSection);
    }
  }

  /**
   * Create a special section for hot leads (always at top)
   */
  function createHotLeadsSection(hotLeads) {
    const section = document.createElement('section');
    section.className = 'town-section hot-leads-section';

    const cardsHtml = hotLeads.map(({ prospect, town }) => createProspectCard(prospect, town)).join('');

    section.innerHTML = `
      <div class="town-section-header hot-leads-header">
        <h2 class="town-section-title">
          <span class="hot-icon">🔥</span>
          Hot Leads
        </h2>
        <span class="town-section-count">${hotLeads.length} hot lead${hotLeads.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="prospect-cards">
        ${cardsHtml}
      </div>
    `;

    // Add event listeners for each card
    hotLeads.forEach(({ prospect, town }) => {
      addCardEventListenersForProspect(section, prospect.id, town);
    });

    return section;
  }

  /**
   * Add event listeners for a specific prospect card
   */
  function addCardEventListenersForProspect(section, prospectId, town) {
    const card = section.querySelector(`.prospect-card[data-id="${prospectId}"]`);
    if (!card) return;

    const copyBtn = card.querySelector('.copy-btn');
    const removeBtn = card.querySelector('.remove-btn');
    const contactBtn = card.querySelector('.contact-btn');
    const unflagBtn = card.querySelector('.unflag-btn');
    const checkbox = card.querySelector('.prospect-checkbox');
    const fbMessageBtn = card.querySelector('.fb-message-btn');
    const igMessageBtn = card.querySelector('.ig-message-btn');
    const copyPhoneBtn = card.querySelector('.copy-phone-btn');
    const textMessageBtn = card.querySelector('.text-message-btn');

    if (copyBtn) copyBtn.addEventListener('click', () => copyProspectInfo(prospectId, town));
    if (removeBtn) removeBtn.addEventListener('click', () => removeProspect(prospectId, town));
    if (contactBtn) contactBtn.addEventListener('click', () => markAsContacted(prospectId, town));
    if (unflagBtn) unflagBtn.addEventListener('click', () => unflagProspect(prospectId, town));
    if (checkbox) checkbox.addEventListener('change', (e) => toggleProspectSelection(prospectId, town, e.target.checked));
    if (fbMessageBtn) fbMessageBtn.addEventListener('click', () => copyMessage(fbMessageBtn.dataset.name, 'Facebook'));
    if (igMessageBtn) igMessageBtn.addEventListener('click', () => copyMessage(igMessageBtn.dataset.name, 'Instagram'));
    if (copyPhoneBtn) copyPhoneBtn.addEventListener('click', () => copyPhone(copyPhoneBtn.dataset.phone));
    if (textMessageBtn) textMessageBtn.addEventListener('click', () => copyTextMessage(textMessageBtn.dataset.name));
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

    section.querySelectorAll('.unflag-btn').forEach(btn => {
      btn.addEventListener('click', () => unflagProspect(btn.dataset.id, town));
    });

    section.querySelectorAll('.prospect-checkbox').forEach(cb => {
      cb.addEventListener('change', (e) => toggleProspectSelection(e.target.dataset.id, town, e.target.checked));
    });

    // Social media message buttons
    section.querySelectorAll('.fb-message-btn').forEach(btn => {
      btn.addEventListener('click', () => copyMessage(btn.dataset.name, 'Facebook'));
    });

    section.querySelectorAll('.ig-message-btn').forEach(btn => {
      btn.addEventListener('click', () => copyMessage(btn.dataset.name, 'Instagram'));
    });

    // Text message buttons
    section.querySelectorAll('.copy-phone-btn').forEach(btn => {
      btn.addEventListener('click', () => copyPhone(btn.dataset.phone));
    });

    section.querySelectorAll('.text-message-btn').forEach(btn => {
      btn.addEventListener('click', () => copyTextMessage(btn.dataset.name));
    });
  }

  /**
   * Create a prospect card HTML
   */
  function createProspectCard(prospect, town) {
    const status = prospect.status || 'new';
    const warmth = calculateWarmth(prospect);
    const isHot = warmth.level === 'hot';
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

    const flaggedBadge = prospect.flagged
      ? `<span class="status-badge status-flagged" title="${escapeHtml(prospect.flagReason || 'Flagged')}">Flagged</span>`
      : '';

    const warmthBadge = isHot
      ? `<span class="warmth-badge hot">🔥 Hot Lead</span>`
      : warmth.level === 'warm'
        ? `<span class="warmth-badge warm">Warm</span>`
        : `<span class="warmth-badge cool">Cool</span>`;

    const unflagBtn = prospect.flagged
      ? `<button class="btn btn-sm btn-secondary unflag-btn" data-id="${prospect.id}" title="Remove Flag">Unflag</button>`
      : '';

    const potentialWebsiteWarning = prospect.potentialWebsite
      ? `<div class="warning-box">
          <strong>Potential Website Found:</strong>
          <a href="${escapeHtml(prospect.potentialWebsite)}" target="_blank" rel="noopener noreferrer">${escapeHtml(prospect.potentialWebsite)}</a>
        </div>`
      : '';

    const isSelected = selectedProspects.has(`${town}-${prospect.id}`);

    // Phone display with mobile/landline indicator
    const phoneDisplay = prospect.phone !== 'Not available'
      ? `${escapeHtml(prospect.phone)}${warmth.hasMobile
          ? '<span class="mobile-indicator">📱 Mobile</span>'
          : '<span class="landline-indicator">☎️ Landline</span>'}`
      : 'Not available';

    // Social media links with message buttons
    const socialLinksHtml = `
      <div class="social-actions">
        ${prospect.facebook !== 'Not available'
          ? `<a href="${escapeHtml(prospect.facebook)}" target="_blank" rel="noopener noreferrer" class="social-btn facebook" title="Open Facebook">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>
            </a>
            <button class="social-btn message-btn fb-message-btn" data-name="${escapeHtml(prospect.businessName)}" title="Copy Facebook message">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            </button>`
          : '<span class="link-item disabled">FB: N/A</span>'}
        ${prospect.instagram !== 'Not available'
          ? `<a href="${escapeHtml(prospect.instagram)}" target="_blank" rel="noopener noreferrer" class="social-btn instagram" title="Open Instagram">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
            </a>
            <button class="social-btn message-btn ig-message-btn" data-name="${escapeHtml(prospect.businessName)}" title="Copy Instagram message">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            </button>`
          : '<span class="link-item disabled">IG: N/A</span>'}
        ${prospect.phone !== 'Not available' ? `
          <div class="text-action-group">
            <button class="text-btn copy-phone" data-phone="${escapeHtml(prospect.phone)}" title="Copy phone number">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
              Copy
            </button>
            <button class="text-btn text-message-btn" data-name="${escapeHtml(prospect.businessName)}" title="Copy text message">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
              Message
            </button>
          </div>
        ` : ''}
      </div>
    `;

    return `
      <article class="prospect-card ${isHot ? 'hot-lead' : ''} ${prospect.flagged ? 'flagged' : ''}" data-id="${prospect.id}">
        <header class="card-header">
          <div class="card-select">
            <input type="checkbox" class="prospect-checkbox" data-id="${prospect.id}" ${isSelected ? 'checked' : ''}>
          </div>
          <div class="card-title-row">
            <h3 class="business-name">${escapeHtml(prospect.businessName)}</h3>
            <div class="badges">${warmthBadge}${flaggedBadge}</div>
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
            <span class="info-label">Contact & Links</span>
            ${socialLinksHtml}
            <div class="links-list" style="margin-top: 8px;">
              ${prospect.profileLink !== 'Not available'
                ? `<a href="${escapeHtml(prospect.profileLink)}" target="_blank" rel="noopener noreferrer" class="link-item">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                    Google Profile
                  </a>`
                : '<span class="link-item disabled">Google Profile: N/A</span>'}
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
   * Copy personalized message for social media
   */
  async function copyMessage(businessName, platform) {
    const message = MESSAGE_TEMPLATE(businessName);
    try {
      await navigator.clipboard.writeText(message);
      showToast(`${platform} message copied!`, 'success');
    } catch (error) {
      console.error('Failed to copy message:', error);
      showToast('Failed to copy message', 'error');
    }
  }

  /**
   * Copy phone number to clipboard
   */
  async function copyPhone(phone) {
    try {
      await navigator.clipboard.writeText(phone);
      showToast('Phone number copied!', 'success');
    } catch (error) {
      console.error('Failed to copy phone:', error);
      showToast('Failed to copy phone number', 'error');
    }
  }

  /**
   * Copy text message to clipboard
   */
  async function copyTextMessage(businessName) {
    const message = TEXT_MESSAGE_TEMPLATE(businessName);
    try {
      await navigator.clipboard.writeText(message);
      showToast('Text message copied!', 'success');
    } catch (error) {
      console.error('Failed to copy text message:', error);
      showToast('Failed to copy message', 'error');
    }
  }

  /**
   * Toggle prospect selection for bulk actions
   */
  function toggleProspectSelection(prospectId, town, isSelected) {
    const key = `${town}-${prospectId}`;
    if (isSelected) {
      selectedProspects.add(key);
    } else {
      selectedProspects.delete(key);
    }
    updateBulkActionsBar();
  }

  /**
   * Update bulk actions bar visibility and count
   */
  function updateBulkActionsBar() {
    const count = selectedProspects.size;
    selectedCountEl.textContent = count;

    if (count > 0) {
      bulkActionsBar.classList.remove('hidden');
    } else {
      bulkActionsBar.classList.add('hidden');
    }
  }

  /**
   * Select all visible prospects
   */
  function selectAllProspects(checked) {
    selectedProspects.clear();

    if (checked) {
      for (const town of Object.keys(filteredProspects)) {
        for (const prospect of filteredProspects[town]) {
          selectedProspects.add(`${town}-${prospect.id}`);
        }
      }
    }

    // Update all checkboxes
    document.querySelectorAll('.prospect-checkbox').forEach(cb => {
      cb.checked = checked;
    });

    updateBulkActionsBar();
  }

  /**
   * Bulk mark as contacted
   */
  async function bulkMarkAsContacted() {
    if (selectedProspects.size === 0) return;

    const confirmed = confirm(`Mark ${selectedProspects.size} prospects as contacted?`);
    if (!confirmed) return;

    try {
      for (const key of selectedProspects) {
        const [town, id] = key.split('-');
        const prospectIndex = prospects[town]?.findIndex(p => String(p.id) === id);
        if (prospectIndex !== -1) {
          prospects[town][prospectIndex].status = 'contacted';
          prospects[town][prospectIndex].contactedDate = new Date().toISOString();
        }
      }

      await chrome.storage.local.set({ prospects });
      selectedProspects.clear();
      applyFilters();
      showToast('Prospects marked as contacted!', 'success');
    } catch (error) {
      console.error('Failed to bulk update:', error);
      showToast('Failed to update prospects', 'error');
    }
  }

  /**
   * Bulk delete prospects
   */
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
      updateTownFilter();
      applyFilters();
      showToast('Prospects deleted', 'success');
    } catch (error) {
      console.error('Failed to bulk delete:', error);
      showToast('Failed to delete prospects', 'error');
    }
  }

  /**
   * Cancel bulk selection
   */
  function cancelBulkSelection() {
    selectedProspects.clear();
    document.querySelectorAll('.prospect-checkbox').forEach(cb => {
      cb.checked = false;
    });
    updateBulkActionsBar();
  }

  /**
   * Copy prospect info to clipboard
   */
  async function copyProspectInfo(prospectId, town) {
    const prospect = prospects[town]?.find(p => String(p.id) === String(prospectId));
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
    const prospectIndex = prospects[town]?.findIndex(p => String(p.id) === String(prospectId));
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
   * Unflag a prospect
   */
  async function unflagProspect(prospectId, town) {
    const prospectIndex = prospects[town]?.findIndex(p => String(p.id) === String(prospectId));
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
    const prospect = prospects[town]?.find(p => String(p.id) === String(prospectId));
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
        version: '2.0',
        exportDate: new Date().toISOString(),
        prospects: storage.prospects || {},
        stats: storage.stats || {},
        scannedTowns: storage.scannedTowns || []
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transform-sites-prospects-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast('Data exported successfully!', 'success');
      closeSettings();
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

      const mergedTowns = [...new Set([...existingTowns, ...(data.scannedTowns || [])])];

      await chrome.storage.local.set({
        prospects: existingProspects,
        scannedTowns: mergedTowns
      });

      await loadProspects();
      showToast('Data imported successfully!', 'success');
      closeSettings();
    } catch (error) {
      console.error('Import failed:', error);
      showToast('Failed to import data: ' + error.message, 'error');
    }
  }

  /**
   * Clear all data
   */
  async function clearAllData() {
    const confirmed = confirm('Are you sure you want to delete ALL data? This cannot be undone.');
    if (!confirmed) return;

    const doubleConfirm = confirm('This will permanently delete all prospects, stats, and scanned towns. Are you absolutely sure?');
    if (!doubleConfirm) return;

    try {
      await chrome.storage.local.clear();
      await loadProspects();
      showToast('All data cleared', 'success');
      closeSettings();
    } catch (error) {
      console.error('Failed to clear data:', error);
      showToast('Failed to clear data', 'error');
    }
  }

  /**
   * Open settings modal
   */
  function openSettings() {
    settingsModal.classList.add('active');
  }

  /**
   * Close settings modal
   */
  function closeSettings() {
    settingsModal.classList.remove('active');
  }

  /**
   * Clear all filters
   */
  function clearFilters() {
    searchInput.value = '';
    townFilter.value = 'all';
    if (statusFilter) statusFilter.value = 'new';
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

    // Settings
    if (settingsBtn) settingsBtn.addEventListener('click', openSettings);
    if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', closeSettings);
    if (settingsModal) {
      settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) closeSettings();
      });
    }

    if (exportBtn) exportBtn.addEventListener('click', exportData);
    if (importBtn) importBtn.addEventListener('click', () => importInput.click());
    if (importInput) importInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        importData(e.target.files[0]);
        e.target.value = '';
      }
    });
    if (clearAllBtn) clearAllBtn.addEventListener('click', clearAllData);

    // Bulk actions
    if (bulkContactBtn) bulkContactBtn.addEventListener('click', bulkMarkAsContacted);
    if (bulkDeleteBtn) bulkDeleteBtn.addEventListener('click', bulkDelete);
    if (bulkCancelBtn) bulkCancelBtn.addEventListener('click', cancelBulkSelection);

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
      if (e.key === 'Escape' && settingsModal.classList.contains('active')) {
        closeSettings();
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
