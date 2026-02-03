/**
 * Content Script for Business Prospect Scraper
 * Handles page detection, scraping, and UI injection
 * Updated with improved selectors for address, social links, reviews, and descriptions
 */

(function() {
  'use strict';

  // Constants - Updated selectors based on actual Google HTML structure
  const SELECTORS = {
    // Business cards in sidebar/results
    businessCards: '.VkpGBb, .rllt__borderless, [jscontroller="AtSb"] .uMdZh',
    businessCardContainer: '[jscontroller="AtSb"]',

    // Business name
    businessName: '.OSrXXb, .dbg0pd span, [role="heading"] .OSrXXb',

    // Business details link (contains data-cid)
    businessLink: 'a[data-cid], a.vwVdIc',

    // Phone number - multiple selectors
    phone: [
      'a[data-dtype="d3ph"] span',
      '[aria-label*="Call phone"]',
      '[data-local-attribute="d3ph"] .LrzXr',
      '[data-attrid*="phone"] .LrzXr'
    ],

    // Address - updated with specific selectors from provided HTML
    address: [
      '[data-local-attribute="d3adr"] .LrzXr',
      '[data-dtype="d3ifr"][data-local-attribute="d3adr"] .LrzXr',
      '[data-attrid*="address"] .LrzXr',
      '.LrzXr'
    ],

    // Social media - updated for the specific structure
    socialContainer: '[data-attrid="kc:/common/topic:social media presence"], [data-attrid*="social media"]',
    socialLinks: '.OOijTb a[href], .PZPZlf a[href]',

    // Business description - "From [Business Name]" section
    descriptionContainer: '.OYzgjc, [data-attrid*="merchant_description"]',
    descriptionText: '[jsname="EvNWZc"], [data-long-text]',

    // Reviews section - updated selectors
    reviewsContainer: '.nNlnIb',
    reviewItem: '.jfz',
    reviewText: '.HTXQwb a',
    reviewRating: '.z3HNkc[aria-label]',

    // Overall rating
    overallRating: '.yi40Hd, .Y0A0hc .yi40Hd',
    reviewCount: '.RDApEe, [aria-label*="reviews"]',

    // Website detection in main listing
    websiteButton: 'a[aria-label*="Website"], a[data-item-id*="authority"]',

    // Web results section - to detect hidden websites
    webResultsContainer: '.Iukrse, .g, [data-hveid] .yuRUbf',
    webResultLink: '.GFNUx, .yuRUbf a',
    webResultCite: '.gr1Yld, cite',

    // Detail panel (when business is clicked)
    detailPanel: '.kp-wholepage, .knowledge-panel, .xpdopen, [data-hveid]',

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

    const isLocalSearch = url.includes('tbm=lcl') ||
                         (url.includes('/search?') && hasLocalResults);

    return isLocalSearch;
  }

  /**
   * Extract town/location from the search query or page
   */
  function extractLocation() {
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('q') || '';

    const locationPatterns = [
      /(?:in|near|around)\s+([A-Za-z\s]+?)(?:\s|$)/i,
      /([A-Za-z]+)\s*$/i
    ];

    for (const pattern of locationPatterns) {
      const match = query.match(pattern);
      if (match && match[1]) {
        const location = match[1].trim();
        const nonLocations = ['plumber', 'plumbers', 'electrician', 'electricians',
                            'heating', 'gas', 'engineer', 'engineers', 'services',
                            'repair', 'installation', 'near', 'me', 'local'];
        if (!nonLocations.includes(location.toLowerCase())) {
          return capitalizeWords(location);
        }
      }
    }

    const businessCards = document.querySelectorAll(SELECTORS.businessCards);
    for (const card of businessCards) {
      const detailsText = card.textContent || '';
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
   * Check for website in web results section
   */
  function findWebsiteInWebResults() {
    const webResults = document.querySelectorAll(SELECTORS.webResultsContainer);
    const foundWebsites = [];

    for (const result of webResults) {
      const link = result.querySelector(SELECTORS.webResultLink);
      const cite = result.querySelector(SELECTORS.webResultCite);

      if (link || cite) {
        const href = link?.href || '';
        const citeText = cite?.textContent || '';

        // Check if it's an external website (not social media)
        if (href && !href.includes('google.com') &&
            !href.includes('facebook.com') &&
            !href.includes('instagram.com') &&
            !href.includes('youtube.com') &&
            !href.includes('twitter.com') &&
            !href.includes('yelp.com')) {
          foundWebsites.push({
            url: href,
            cite: citeText
          });
        }
      }
    }

    return foundWebsites;
  }

  /**
   * Check if a business card has a website (including web results check)
   */
  function hasWebsite(businessCard) {
    // Check for website button in the card
    const websiteButton = businessCard.querySelector('a[aria-label*="Website"]');
    if (websiteButton) return { hasWebsite: true, source: 'button' };

    // Check for authority link
    const authorityLink = businessCard.querySelector('a[data-item-id*="authority"]');
    if (authorityLink) return { hasWebsite: true, source: 'authority' };

    // Check all links for external non-social websites
    const allLinks = businessCard.querySelectorAll('a[href]');
    for (const link of allLinks) {
      const href = link.href || '';
      const text = link.textContent?.toLowerCase() || '';

      if (href.includes('google.com') ||
          href.includes('maps') ||
          href.includes('facebook.com') ||
          href.includes('instagram.com') ||
          href.includes('youtube.com') ||
          href.includes('twitter.com') ||
          href.includes('linkedin.com')) {
        continue;
      }

      if (text.includes('website') ||
          (href.startsWith('http') && !href.includes('google'))) {
        if (!href.includes('/maps/dir') && !href.includes('tel:')) {
          return { hasWebsite: true, source: 'link' };
        }
      }
    }

    // Check for "Website" text in action buttons
    const actionButtons = businessCard.querySelectorAll('.yYlJEf, .VDgVie');
    for (const btn of actionButtons) {
      if (btn.textContent?.toLowerCase().includes('website')) {
        return { hasWebsite: true, source: 'action_button' };
      }
    }

    return { hasWebsite: false, source: null };
  }

  /**
   * Try to find element using multiple selectors
   */
  function findElement(container, selectors) {
    if (Array.isArray(selectors)) {
      for (const selector of selectors) {
        const el = container.querySelector(selector);
        if (el) return el;
      }
      return null;
    }
    return container.querySelector(selectors);
  }

  /**
   * Extract address from the detail panel
   */
  function extractAddress() {
    // Try multiple selectors for address
    const addressSelectors = [
      '[data-local-attribute="d3adr"] .LrzXr',
      '[data-dtype="d3ifr"][data-local-attribute="d3adr"] .LrzXr',
      'div[data-attrid*="address"] .LrzXr',
      '.zloOqf.PZPZlf .LrzXr'
    ];

    for (const selector of addressSelectors) {
      const el = document.querySelector(selector);
      if (el && el.textContent.trim()) {
        return el.textContent.trim();
      }
    }

    return 'Not available';
  }

  /**
   * Extract social media links from the page
   */
  function extractSocialLinks() {
    const social = {
      facebook: 'Not available',
      instagram: 'Not available',
      twitter: 'Not available',
      linkedin: 'Not available',
      youtube: 'Not available'
    };

    // Find the social media section
    const socialContainer = document.querySelector(SELECTORS.socialContainer);

    if (socialContainer) {
      const links = socialContainer.querySelectorAll('a[href]');

      for (const link of links) {
        const href = link.href || '';

        if (href.includes('facebook.com')) {
          social.facebook = href;
        } else if (href.includes('instagram.com')) {
          social.instagram = href;
        } else if (href.includes('twitter.com') || href.includes('x.com')) {
          social.twitter = href;
        } else if (href.includes('linkedin.com')) {
          social.linkedin = href;
        } else if (href.includes('youtube.com')) {
          social.youtube = href;
        }
      }
    }

    // Also check OOijTb container (alternative location)
    const altContainer = document.querySelector('.OOijTb');
    if (altContainer) {
      const links = altContainer.querySelectorAll('a[href]');
      for (const link of links) {
        const href = link.href || '';
        if (href.includes('facebook.com') && social.facebook === 'Not available') {
          social.facebook = href;
        } else if (href.includes('instagram.com') && social.instagram === 'Not available') {
          social.instagram = href;
        }
      }
    }

    return social;
  }

  /**
   * Extract business description
   */
  function extractDescription() {
    // Look for the "From [Business Name]" section
    const descContainer = document.querySelector(SELECTORS.descriptionContainer);

    if (descContainer) {
      // Try jsname="EvNWZc" first
      const descEl = descContainer.querySelector('[jsname="EvNWZc"]');
      if (descEl && descEl.textContent.trim()) {
        return descEl.textContent.trim().replace(/^["']|["']$/g, '');
      }

      // Try data-long-text attribute
      const longTextEl = descContainer.querySelector('[data-long-text]');
      if (longTextEl) {
        const longText = longTextEl.getAttribute('data-long-text');
        if (longText) {
          return longText.replace(/^["']|["']$/g, '');
        }
      }
    }

    // Alternative: look for merchant description
    const merchantDesc = document.querySelector('[data-attrid*="merchant_description"] [jsname="EvNWZc"]');
    if (merchantDesc && merchantDesc.textContent.trim()) {
      return merchantDesc.textContent.trim().replace(/^["']|["']$/g, '');
    }

    return 'Not available';
  }

  /**
   * Extract customer reviews
   */
  function extractReviews() {
    const reviews = [];

    // Find the reviews container
    const reviewsContainer = document.querySelector(SELECTORS.reviewsContainer);

    if (reviewsContainer) {
      const reviewItems = reviewsContainer.querySelectorAll(SELECTORS.reviewItem);

      for (const item of reviewItems) {
        const textEl = item.querySelector(SELECTORS.reviewText);
        const ratingEl = item.querySelector(SELECTORS.reviewRating);

        if (textEl) {
          // Clean up the review text - remove highlighting spans
          let reviewText = textEl.textContent.trim();
          reviewText = reviewText.replace(/^["']|["']$/g, '');

          const rating = ratingEl ? ratingEl.getAttribute('aria-label') : 'Rating not available';

          reviews.push({
            text: reviewText,
            rating: rating
          });
        }
      }
    }

    // Also check for individual jfz elements outside nNlnIb
    if (reviews.length === 0) {
      const allReviewItems = document.querySelectorAll('.jfz');
      for (const item of allReviewItems) {
        const textEl = item.querySelector('.HTXQwb a');
        const ratingEl = item.querySelector('.z3HNkc[aria-label]');

        if (textEl) {
          let reviewText = textEl.textContent.trim();
          reviewText = reviewText.replace(/^["']|["']$/g, '');

          const rating = ratingEl ? ratingEl.getAttribute('aria-label') : 'Rating not available';

          // Avoid duplicates
          if (!reviews.some(r => r.text === reviewText)) {
            reviews.push({
              text: reviewText,
              rating: rating
            });
          }
        }
      }
    }

    return reviews;
  }

  /**
   * Extract phone number
   */
  function extractPhone(businessCard) {
    // First try the card itself
    const cardText = businessCard?.textContent || '';
    const phonePatterns = [
      /(\d{5}\s?\d{6})/,           // UK mobile: 07883 825962
      /(\d{4}\s?\d{3}\s?\d{4})/,   // Alternative UK
      /(\+44\s?\d{4}\s?\d{6})/,    // International UK
      /(0\d{2,4}[-.\s]?\d{6,7})/,  // General UK landline
      /(\d{3}[-.\s]?\d{3}[-.\s]?\d{4})/ // US format
    ];

    for (const pattern of phonePatterns) {
      const match = cardText.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    // Try the detail panel
    const phoneSelectors = [
      '[data-local-attribute="d3ph"] .LrzXr',
      'a[data-dtype="d3ph"] span',
      '[data-attrid*="phone"] .LrzXr',
      '[aria-label*="Call phone"]'
    ];

    for (const selector of phoneSelectors) {
      const el = document.querySelector(selector);
      if (el && el.textContent.trim()) {
        return el.textContent.trim();
      }
    }

    return 'Not available';
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
      twitter: 'Not available',
      linkedin: 'Not available',
      youtube: 'Not available',
      rating: 'Not available',
      reviewCount: 'Not available',
      description: 'Not available',
      reviews: [],
      potentialWebsite: null,  // Flag for websites found in web results
      status: 'new',           // new, contacted, converted
      contactedDate: null,
      convertedDate: null,
      notes: ''
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

      // Phone number
      data.phone = extractPhone(businessCard);

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

      // Extract detailed info from the page
      extractDetailedInfo(data, businessCard);

    } catch (error) {
      console.error('Error extracting business data:', error);
    }

    return data;
  }

  /**
   * Extract additional info from the detail panel if visible
   */
  function extractDetailedInfo(data, businessCard) {
    try {
      // Address - use the new extraction function
      if (data.address === 'Not available') {
        data.address = extractAddress();

        // Extract location from address if available
        if (data.address !== 'Not available') {
          const parts = data.address.split(',');
          if (parts.length >= 2) {
            // Get the second to last part (usually the town)
            const locationPart = parts[parts.length - 2] || parts[parts.length - 1];
            const cleanLocation = locationPart.replace(/[A-Z]{1,2}\d.*$/i, '').trim();
            if (cleanLocation && cleanLocation.length > 2) {
              data.location = cleanLocation;
            }
          }
        }
      }

      // Social media links
      const socialLinks = extractSocialLinks();
      data.facebook = socialLinks.facebook;
      data.instagram = socialLinks.instagram;
      data.twitter = socialLinks.twitter;
      data.linkedin = socialLinks.linkedin;
      data.youtube = socialLinks.youtube;

      // Description
      if (data.description === 'Not available') {
        data.description = extractDescription();
      }

      // Reviews
      if (data.reviews.length === 0) {
        data.reviews = extractReviews();
      }

      // Check for potential website in web results
      const webResults = findWebsiteInWebResults();
      if (webResults.length > 0) {
        // Check if any web result matches the business name
        const businessNameLower = data.businessName.toLowerCase();
        for (const result of webResults) {
          const citeLower = result.cite.toLowerCase();
          const urlLower = result.url.toLowerCase();

          // Check if the website might belong to this business
          const nameWords = businessNameLower.split(/\s+/);
          const hasMatch = nameWords.some(word =>
            word.length > 3 && (citeLower.includes(word) || urlLower.includes(word))
          );

          if (hasMatch) {
            data.potentialWebsite = result.url;
            break;
          }
        }
      }

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
      const flaggedProspects = []; // Prospects with potential websites

      for (const card of businessCards) {
        const websiteCheck = hasWebsite(card);

        if (!websiteCheck.hasWebsite) {
          const businessData = extractBusinessData(card, location);

          if (businessData.businessName !== 'Unknown Business') {
            // Check if there's a potential website in web results
            if (businessData.potentialWebsite) {
              businessData.flagged = true;
              businessData.flagReason = 'Potential website found in web results';
              flaggedProspects.push(businessData);
            }
            prospects.push(businessData);
          }
        }
      }

      // Also check for individual result items
      const resultItems = document.querySelectorAll('.rllt__details');
      for (const item of resultItems) {
        const parentCard = item.closest('[jscontroller="AtSb"]') || item.parentElement;
        if (parentCard) {
          const websiteCheck = hasWebsite(parentCard);

          if (!websiteCheck.hasWebsite) {
            const businessData = extractBusinessData(parentCard, location);

            const isDuplicate = prospects.some(p =>
              p.businessName === businessData.businessName ||
              (p.phone !== 'Not available' && p.phone === businessData.phone)
            );

            if (!isDuplicate && businessData.businessName !== 'Unknown Business') {
              if (businessData.potentialWebsite) {
                businessData.flagged = true;
                businessData.flagReason = 'Potential website found in web results';
              }
              prospects.push(businessData);
            }
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

      // Show success message with flagged count if any
      let message = `Found ${prospects.length} prospects in ${location}`;
      if (flaggedProspects.length > 0) {
        message += ` (${flaggedProspects.length} flagged with potential websites)`;
      }
      showNotification(message, 'success');
      updateButtonState('ready', prospects.length);

      // Notify other extension pages
      chrome.runtime.sendMessage({
        type: 'PROSPECTS_UPDATED',
        data: { location, count: prospects.length, flagged: flaggedProspects.length }
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
    const storage = await chrome.storage.local.get(['prospects', 'stats']);
    const allProspects = storage.prospects || {};
    const stats = storage.stats || { totalAdded: 0, totalContacted: 0, totalConverted: 0 };

    if (!allProspects[location]) {
      allProspects[location] = [];
    }

    let addedCount = 0;

    // Add new prospects, avoiding duplicates
    for (const prospect of newProspects) {
      const isDuplicate = allProspects[location].some(p =>
        p.businessName === prospect.businessName ||
        (p.phone !== 'Not available' && p.phone === prospect.phone)
      );

      if (!isDuplicate) {
        allProspects[location].push(prospect);
        addedCount++;
      }
    }

    // Update stats
    stats.totalAdded += addedCount;

    await chrome.storage.local.set({ prospects: allProspects, stats });
  }

  /**
   * Create and inject the scan button
   */
  function injectScanButton() {
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
    const observer = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;

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
