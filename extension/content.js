/**
 * Content Script for Business Prospect Scraper
 * Handles page detection, scraping, and UI injection
 */

(function() {
  'use strict';

  // Constants
  const SELECTORS = {
    // Business cards in sidebar/results
    businessCards: '.VkpGBb, .rllt__borderless, [jscontroller="AtSb"] .uMdZh',
    businessCardContainer: '[jscontroller="AtSb"]',

    // Business name
    businessName: '.OSrXXb, .dbg0pd span, [role="heading"] .OSrXXb',

    // Business details link (contains data-cid)
    businessLink: 'a[data-cid], a.vwVdIc',

    // Phone number patterns
    phone: 'a[data-dtype="d3ph"] span, [aria-label*="Call phone"]',

    // Address in detail view
    address: '[data-attrid*="address"] .LrzXr, .LrzXr',

    // Social media links
    socialLinks: '[data-attrid*="social"] a, .OOijTb a',

    // Business description
    description: '[data-attrid*="merchant_description"] [jsname="EvNWZc"], [data-attrid*="description"] div',

    // Reviews section
    reviewContainer: '.jfz, .review-snippet',
    reviewText: '.HTXQwb a, .review-text',
    reviewRating: '.z3HNkc',

    // Overall rating
    overallRating: '.yi40Hd, .Y0A0hc .yi40Hd',
    reviewCount: '.RDApEe, [aria-label*="reviews"]',

    // Website detection
    websiteButton: 'a[aria-label*="Website"], a[data-item-id*="authority"], a.yYlJEf[href*="http"]:not([href*="google.com"]):not([href*="maps"]):not([href*="facebook.com"]):not([href*="instagram.com"])',

    // Detail panel (when business is clicked)
    detailPanel: '.kp-wholepage, .knowledge-panel, [data-attrid]',

    // Local pack container
    localPack: '#lclrst, .rlfl__tls, [data-async-type="lcl_akp"]'
  };

  // State
  let scanButton = null;
  let isScanning = false;
  let lastUrl = location.href;

  /**
   * Check if current page is a Google Business search results page
   */
  function isBusinessSearchPage() {
    const url = window.location.href;
    const hasLocalResults = document.querySelector(SELECTORS.localPack) !== null ||
                           document.querySelector(SELECTORS.businessCards) !== null ||
                           document.querySelector('.rllt__details') !== null;

    // Check for local business search indicators
    const isLocalSearch = url.includes('tbm=lcl') ||
                         url.includes('/search?') && hasLocalResults;

    return isLocalSearch;
  }

  /**
   * Extract town/location from the search query or page
   */
  function extractLocation() {
    // Try to get from search query
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('q') || '';

    // Common patterns: "plumbers yeovil", "electricians in bristol"
    const locationPatterns = [
      /(?:in|near|around)\s+([A-Za-z\s]+?)(?:\s|$)/i,
      /([A-Za-z]+)\s*$/i
    ];

    for (const pattern of locationPatterns) {
      const match = query.match(pattern);
      if (match && match[1]) {
        const location = match[1].trim();
        // Filter out common non-location words
        const nonLocations = ['plumber', 'plumbers', 'electrician', 'electricians',
                            'heating', 'gas', 'engineer', 'engineers', 'services',
                            'repair', 'installation', 'near', 'me', 'local'];
        if (!nonLocations.includes(location.toLowerCase())) {
          return capitalizeWords(location);
        }
      }
    }

    // Try to extract from visible business listings
    const businessCards = document.querySelectorAll(SELECTORS.businessCards);
    for (const card of businessCards) {
      const detailsText = card.textContent || '';
      // Look for location patterns like "7+ years in business · Yeovil"
      const locationMatch = detailsText.match(/·\s*([A-Za-z\s]+?)(?:\s*·|$)/g);
      if (locationMatch) {
        for (const match of locationMatch) {
          const loc = match.replace(/·/g, '').trim();
          if (loc && !/^\d/.test(loc) && loc.length > 2 && loc.length < 30) {
            return capitalizeWords(loc);
          }
        }
      }
    }

    return 'Unknown Location';
  }

  /**
   * Capitalize first letter of each word
   */
  function capitalizeWords(str) {
    return str.replace(/\b\w/g, l => l.toUpperCase());
  }

  /**
   * Check if a business card has a website
   */
  function hasWebsite(businessCard) {
    // Check for website button
    const websiteButton = businessCard.querySelector('a[aria-label*="Website"]');
    if (websiteButton) return true;

    // Check for authority link
    const authorityLink = businessCard.querySelector('a[data-item-id*="authority"]');
    if (authorityLink) return true;

    // Check all links for external non-social websites
    const allLinks = businessCard.querySelectorAll('a[href]');
    for (const link of allLinks) {
      const href = link.href || '';
      const text = link.textContent?.toLowerCase() || '';

      // Skip Google, Maps, Facebook, Instagram links
      if (href.includes('google.com') ||
          href.includes('maps') ||
          href.includes('facebook.com') ||
          href.includes('instagram.com') ||
          href.includes('youtube.com') ||
          href.includes('twitter.com') ||
          href.includes('linkedin.com')) {
        continue;
      }

      // Check if it's an external website link
      if (text.includes('website') ||
          (href.startsWith('http') && !href.includes('google'))) {
        // Make sure it's not just a directions or phone link
        if (!href.includes('/maps/dir') && !href.includes('tel:')) {
          return true;
        }
      }
    }

    // Check for "Website" text in action buttons
    const actionButtons = businessCard.querySelectorAll('.yYlJEf, .VDgVie');
    for (const btn of actionButtons) {
      if (btn.textContent?.toLowerCase().includes('website')) {
        return true;
      }
    }

    return false;
  }

  /**
   * Extract business data from a business card element
   */
  function extractBusinessData(businessCard, location) {
    const data = {
      id: Date.now() + Math.random(),
      timestamp: new Date().toISOString(),
      businessName: 'Unknown Business',
      phone: 'Not available',
      email: 'Not available',
      address: 'Not available',
      location: location,
      profileLink: 'Not available',
      facebook: 'Not available',
      instagram: 'Not available',
      rating: 'Not available',
      reviewCount: 'Not available',
      description: 'Not available',
      reviews: []
    };

    try {
      // Business name
      const nameEl = businessCard.querySelector(SELECTORS.businessName);
      if (nameEl) {
        data.businessName = nameEl.textContent.trim();
      }

      // Profile link from data-cid
      const linkEl = businessCard.querySelector(SELECTORS.businessLink);
      if (linkEl) {
        const cid = linkEl.getAttribute('data-cid');
        if (cid) {
          data.profileLink = `https://www.google.com/maps?cid=${cid}`;
        }
      }

      // Phone number - look in the card text
      const cardText = businessCard.textContent || '';
      const phonePatterns = [
        /(\d{5}\s?\d{6})/,  // UK format: 07883 825962
        /(\d{4}\s?\d{3}\s?\d{4})/,  // Alternative UK
        /(\+44\s?\d{4}\s?\d{6})/,  // International UK
        /(\d{3}[-.\s]?\d{3}[-.\s]?\d{4})/,  // US format
        /(0\d{2,4}[-.\s]?\d{6,7})/  // General UK landline
      ];

      for (const pattern of phonePatterns) {
        const match = cardText.match(pattern);
        if (match) {
          data.phone = match[1].trim();
          break;
        }
      }

      // Rating
      const ratingEl = businessCard.querySelector('.yi40Hd, [aria-label*="Rated"]');
      if (ratingEl) {
        const ratingText = ratingEl.getAttribute('aria-label') || ratingEl.textContent;
        const ratingMatch = ratingText.match(/([\d.]+)/);
        if (ratingMatch) {
          data.rating = ratingMatch[1];
        }
      }

      // Review count
      const reviewCountEl = businessCard.querySelector('.RDApEe, [aria-label*="reviews"]');
      if (reviewCountEl) {
        const countText = reviewCountEl.getAttribute('aria-label') || reviewCountEl.textContent;
        const countMatch = countText.match(/\((\d+)\)|(\d+)\s*reviews?/i);
        if (countMatch) {
          data.reviewCount = countMatch[1] || countMatch[2];
        }
      }

      // Address - look for location info in card
      const addressPatterns = [
        /(\d+\s+[A-Za-z\s]+,\s*[A-Za-z\s]+\s+[A-Z]{1,2}\d{1,2}\s*\d[A-Z]{2})/i,  // UK postcode format
        /(\d+\s+[A-Za-z\s]+(?:St|Street|Rd|Road|Ave|Avenue|Ln|Lane|Dr|Drive)[^,]*,\s*[A-Za-z\s]+)/i
      ];

      for (const pattern of addressPatterns) {
        const match = cardText.match(pattern);
        if (match) {
          data.address = match[1].trim();
          break;
        }
      }

      // Try to get more details from expanded view if visible
      extractDetailedInfo(data);

    } catch (error) {
      console.error('Error extracting business data:', error);
    }

    return data;
  }

  /**
   * Extract additional info from the detail panel if visible
   */
  function extractDetailedInfo(data) {
    try {
      // Check if detail panel is open
      const detailPanel = document.querySelector('.kp-wholepage, .knowledge-panel, .xpdopen');
      if (!detailPanel) return;

      // Make sure it's for the same business
      const panelName = detailPanel.querySelector('[data-attrid*="title"] span, .qrShPb span');
      if (panelName && !panelName.textContent.includes(data.businessName.split(' ')[0])) {
        return; // Different business
      }

      // Address
      const addressEl = detailPanel.querySelector('[data-attrid*="address"] .LrzXr');
      if (addressEl && data.address === 'Not available') {
        data.address = addressEl.textContent.trim();
        // Extract location from address
        const parts = data.address.split(',');
        if (parts.length >= 2) {
          const locationPart = parts[parts.length - 2] || parts[parts.length - 1];
          data.location = locationPart.replace(/[A-Z]{1,2}\d.*$/i, '').trim();
        }
      }

      // Phone from detail panel
      const phoneEl = detailPanel.querySelector('[data-attrid*="phone"] a[data-dtype="d3ph"] span, [aria-label*="Call phone"]');
      if (phoneEl && data.phone === 'Not available') {
        data.phone = phoneEl.textContent.trim();
      }

      // Social media
      const socialSection = detailPanel.querySelector('[data-attrid*="social"]');
      if (socialSection) {
        const fbLink = socialSection.querySelector('a[href*="facebook.com"]');
        if (fbLink) {
          data.facebook = fbLink.href;
        }

        const igLink = socialSection.querySelector('a[href*="instagram.com"]');
        if (igLink) {
          data.instagram = igLink.href;
        }
      }

      // Description
      const descEl = detailPanel.querySelector('[data-attrid*="merchant_description"] [jsname="EvNWZc"], [data-attrid*="description"]');
      if (descEl && data.description === 'Not available') {
        data.description = descEl.textContent.trim();
      }

      // Reviews
      const reviewContainers = detailPanel.querySelectorAll('.jfz, .gws-localreviews__google-review');
      reviewContainers.forEach((container) => {
        const textEl = container.querySelector('.HTXQwb a, .review-full-text');
        const ratingEl = container.querySelector('.z3HNkc');

        if (textEl) {
          const review = {
            text: textEl.textContent.trim().replace(/^["']|["']$/g, ''),
            rating: ratingEl?.getAttribute('aria-label') || 'Rating not available'
          };
          data.reviews.push(review);
        }
      });

    } catch (error) {
      console.error('Error extracting detailed info:', error);
    }
  }

  /**
   * Scan the current page for prospects
   */
  async function scanPage() {
    if (isScanning) return;
    isScanning = true;
    updateButtonState('scanning');

    try {
      const location = extractLocation();

      // Check if already scanned
      const storage = await chrome.storage.local.get(['scannedTowns']);
      const scannedTowns = storage.scannedTowns || [];

      if (scannedTowns.includes(location)) {
        const confirmed = confirm(`You've already scanned "${location}". Scan again?`);
        if (!confirmed) {
          isScanning = false;
          updateButtonState('ready');
          return;
        }
      }

      // Find all business cards
      const businessCards = document.querySelectorAll(SELECTORS.businessCardContainer);
      const prospects = [];

      for (const card of businessCards) {
        // Check if business has no website
        if (!hasWebsite(card)) {
          const businessData = extractBusinessData(card, location);

          // Only add if we got a business name
          if (businessData.businessName !== 'Unknown Business') {
            prospects.push(businessData);
          }
        }
      }

      // Also check for individual result items
      const resultItems = document.querySelectorAll('.rllt__details');
      for (const item of resultItems) {
        const parentCard = item.closest('[jscontroller="AtSb"]') || item.parentElement;
        if (parentCard && !hasWebsite(parentCard)) {
          const businessData = extractBusinessData(parentCard, location);

          // Check for duplicates
          const isDuplicate = prospects.some(p =>
            p.businessName === businessData.businessName ||
            (p.phone !== 'Not available' && p.phone === businessData.phone)
          );

          if (!isDuplicate && businessData.businessName !== 'Unknown Business') {
            prospects.push(businessData);
          }
        }
      }

      // Save prospects
      await saveProspects(prospects, location);

      // Update scanned towns
      if (!scannedTowns.includes(location)) {
        scannedTowns.push(location);
        await chrome.storage.local.set({ scannedTowns });
      }

      // Show success message
      showNotification(`Found ${prospects.length} new prospects in ${location}`, 'success');
      updateButtonState('ready', prospects.length);

      // Notify other extension pages
      chrome.runtime.sendMessage({
        type: 'PROSPECTS_UPDATED',
        data: { location, count: prospects.length }
      }).catch(() => {});

    } catch (error) {
      console.error('Scan error:', error);
      showNotification('Failed to scan page. Please try again.', 'error');
      updateButtonState('ready');
    }

    isScanning = false;
  }

  /**
   * Save prospects to storage
   */
  async function saveProspects(newProspects, location) {
    const storage = await chrome.storage.local.get(['prospects']);
    const allProspects = storage.prospects || {};

    if (!allProspects[location]) {
      allProspects[location] = [];
    }

    // Add new prospects, avoiding duplicates
    for (const prospect of newProspects) {
      const isDuplicate = allProspects[location].some(p =>
        p.businessName === prospect.businessName ||
        (p.phone !== 'Not available' && p.phone === prospect.phone)
      );

      if (!isDuplicate) {
        allProspects[location].push(prospect);
      }
    }

    await chrome.storage.local.set({ prospects: allProspects });
  }

  /**
   * Create and inject the scan button
   */
  function injectScanButton() {
    // Remove existing button if any
    if (scanButton) {
      scanButton.remove();
    }

    scanButton = document.createElement('div');
    scanButton.id = 'prospect-scraper-btn';
    scanButton.innerHTML = `
      <button id="prospect-scan-btn">
        <span class="btn-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
        </span>
        <span class="btn-text">Scan This Page</span>
        <span class="btn-count"></span>
      </button>
    `;

    document.body.appendChild(scanButton);

    // Add click handler
    scanButton.querySelector('button').addEventListener('click', scanPage);
  }

  /**
   * Update scan button state
   */
  function updateButtonState(state, count = 0) {
    if (!scanButton) return;

    const btn = scanButton.querySelector('button');
    const textSpan = scanButton.querySelector('.btn-text');
    const countSpan = scanButton.querySelector('.btn-count');

    btn.disabled = state === 'scanning';

    switch (state) {
      case 'scanning':
        textSpan.textContent = 'Scanning...';
        btn.classList.add('scanning');
        break;
      case 'ready':
        textSpan.textContent = 'Scan This Page';
        btn.classList.remove('scanning');
        if (count > 0) {
          countSpan.textContent = `(${count} found)`;
        }
        break;
    }
  }

  /**
   * Show notification toast
   */
  function showNotification(message, type = 'info') {
    // Remove existing notification
    const existing = document.querySelector('.prospect-notification');
    if (existing) {
      existing.remove();
    }

    const notification = document.createElement('div');
    notification.className = `prospect-notification ${type}`;
    notification.innerHTML = `
      <span class="notification-icon">${type === 'success' ? '&#10003;' : type === 'error' ? '&#10007;' : '&#9432;'}</span>
      <span class="notification-text">${message}</span>
    `;

    document.body.appendChild(notification);

    // Auto-remove after 4 seconds
    setTimeout(() => {
      notification.classList.add('fade-out');
      setTimeout(() => notification.remove(), 300);
    }, 4000);
  }

  /**
   * Initialize the content script
   */
  function init() {
    if (isBusinessSearchPage()) {
      injectScanButton();
    }
  }

  /**
   * Handle page/URL changes (SPA navigation)
   */
  function setupPageChangeDetection() {
    // Monitor URL changes
    const observer = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;

        // Delay to let page content load
        setTimeout(() => {
          if (isBusinessSearchPage()) {
            injectScanButton();
          } else if (scanButton) {
            scanButton.remove();
            scanButton = null;
          }
        }, 1000);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Also listen for popstate (back/forward navigation)
    window.addEventListener('popstate', () => {
      setTimeout(init, 500);
    });
  }

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      init();
      setupPageChangeDetection();
    });
  } else {
    init();
    setupPageChangeDetection();
  }

})();
