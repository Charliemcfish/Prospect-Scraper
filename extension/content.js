/**
 * Content Script for Business Prospect Scraper
 * Handles page detection, scraping, and UI injection
 * IMPORTANT: Clicks on each business to load sidebar and extract detailed info
 */

(function() {
  'use strict';

  // State
  let scanButton = null;
  let isScanning = false;
  let lastUrl = location.href;

  /**
   * Check if current page is a Google Business search results page
   */
  function isBusinessSearchPage() {
    const url = window.location.href;
    const hasLocalResults = document.querySelector('#lclrst, .rlfl__tls, [data-async-type="lcl_akp"]') !== null ||
                           document.querySelector('.VkpGBb, .rllt__borderless') !== null ||
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

    return 'Unknown Location';
  }

  /**
   * Capitalize first letter of each word
   */
  function capitalizeWords(str) {
    return str.replace(/\b\w/g, l => l.toUpperCase());
  }

  /**
   * Wait for an element to appear in the DOM
   */
  function waitForElement(selector, timeout = 5000) {
    return new Promise((resolve) => {
      const element = document.querySelector(selector);
      if (element) {
        return resolve(element);
      }

      const observer = new MutationObserver((mutations, obs) => {
        const el = document.querySelector(selector);
        if (el) {
          obs.disconnect();
          resolve(el);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, timeout);
    });
  }

  /**
   * Wait for a specified time
   */
  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if a business card has a website
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
   * Extract business name from card
   */
  function extractBusinessName(businessCard) {
    const selectors = ['.OSrXXb', '.dbg0pd span', '[role="heading"] .OSrXXb', '.qBF1Pd'];
    for (const sel of selectors) {
      const el = businessCard.querySelector(sel);
      if (el && el.textContent.trim()) {
        return el.textContent.trim();
      }
    }
    return 'Unknown Business';
  }

  /**
   * Extract phone number from sidebar
   */
  function extractPhone() {
    // Phone selectors for the sidebar
    const phoneSelectors = [
      '[data-local-attribute="d3ph"] .LrzXr',
      '[data-dtype="d3ph"] .LrzXr',
      'a[data-dtype="d3ph"] span',
      '[data-attrid*="phone"] .LrzXr',
      '.zloOqf[data-local-attribute="d3ph"] .LrzXr'
    ];

    for (const selector of phoneSelectors) {
      const el = document.querySelector(selector);
      if (el && el.textContent.trim()) {
        return el.textContent.trim();
      }
    }

    // Try looking for tel: links
    const telLinks = document.querySelectorAll('a[href^="tel:"]');
    for (const link of telLinks) {
      const phone = link.href.replace('tel:', '').trim();
      if (phone) return phone;
    }

    return 'Not available';
  }

  /**
   * Extract address from sidebar - using the exact structure from user's HTML
   */
  function extractAddress() {
    // Based on user's HTML: <div class="zloOqf PZPZlf" data-local-attribute="d3adr">...<span class="LrzXr">
    const addressSelectors = [
      '[data-local-attribute="d3adr"] .LrzXr',
      '.zloOqf.PZPZlf[data-local-attribute="d3adr"] .LrzXr',
      '[data-dtype="d3ifr"][data-local-attribute="d3adr"] .LrzXr',
      'div[data-attrid*="address"] .LrzXr',
      '.zloOqf .LrzXr'
    ];

    for (const selector of addressSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        const text = el.textContent.trim();
        // Make sure it looks like an address (not a phone number or rating)
        if (text && text.length > 5 && !text.match(/^\d{5,}$/) && !text.match(/^\d+\.\d+$/)) {
          // Check if parent has address-related attribute
          const parent = el.closest('[data-local-attribute]');
          if (parent && parent.getAttribute('data-local-attribute') === 'd3adr') {
            return text;
          }
        }
      }
    }

    // Fallback: look for any element with address-like text
    const allLrzXr = document.querySelectorAll('.LrzXr');
    for (const el of allLrzXr) {
      const parent = el.closest('[data-local-attribute]');
      if (parent && parent.getAttribute('data-local-attribute') === 'd3adr') {
        return el.textContent.trim();
      }
    }

    return 'Not available';
  }

  /**
   * Extract social media links from sidebar
   */
  function extractSocialLinks() {
    const social = {
      facebook: 'Not available',
      instagram: 'Not available',
      twitter: 'Not available',
      linkedin: 'Not available',
      youtube: 'Not available'
    };

    // Look for social media section - based on user's HTML structure
    const socialContainers = document.querySelectorAll(
      '[data-attrid*="social"], [data-attrid*="kc:/common/topic:social"], .OOijTb, .PZPZlf'
    );

    for (const container of socialContainers) {
      const links = container.querySelectorAll('a[href]');
      for (const link of links) {
        const href = link.href || '';
        if (href.includes('facebook.com') && social.facebook === 'Not available') {
          social.facebook = href;
        } else if (href.includes('instagram.com') && social.instagram === 'Not available') {
          social.instagram = href;
        } else if ((href.includes('twitter.com') || href.includes('x.com')) && social.twitter === 'Not available') {
          social.twitter = href;
        } else if (href.includes('linkedin.com') && social.linkedin === 'Not available') {
          social.linkedin = href;
        } else if (href.includes('youtube.com') && social.youtube === 'Not available') {
          social.youtube = href;
        }
      }
    }

    // Also scan all links on the page for social media
    const allLinks = document.querySelectorAll('a[href*="facebook.com"], a[href*="instagram.com"], a[href*="twitter.com"], a[href*="x.com"], a[href*="linkedin.com"], a[href*="youtube.com"]');
    for (const link of allLinks) {
      const href = link.href || '';
      if (href.includes('facebook.com') && social.facebook === 'Not available') {
        social.facebook = href;
      } else if (href.includes('instagram.com') && social.instagram === 'Not available') {
        social.instagram = href;
      } else if ((href.includes('twitter.com') || href.includes('x.com')) && social.twitter === 'Not available') {
        social.twitter = href;
      } else if (href.includes('linkedin.com') && social.linkedin === 'Not available') {
        social.linkedin = href;
      } else if (href.includes('youtube.com') && social.youtube === 'Not available') {
        social.youtube = href;
      }
    }

    return social;
  }

  /**
   * Extract business description from sidebar - using user's exact HTML structure
   */
  function extractDescription() {
    // Based on user's HTML: <div class="OYzgjc">...<div data-long-text="..."><div jsname="EvNWZc">

    // Try data-long-text attribute first (contains full description)
    const longTextElements = document.querySelectorAll('[data-long-text]');
    for (const el of longTextElements) {
      const longText = el.getAttribute('data-long-text');
      if (longText && longText.length > 10) {
        // Clean up the text - remove surrounding quotes
        return longText.replace(/^["']|["']$/g, '').trim();
      }
    }

    // Try jsname="EvNWZc" (visible text)
    const evnElements = document.querySelectorAll('[jsname="EvNWZc"]');
    for (const el of evnElements) {
      const text = el.textContent.trim();
      // Make sure it's a description, not navigation or other text
      if (text && text.length > 20 && !text.includes('Address') && !text.includes('Reviews')) {
        // Remove "More" link text if present
        return text.replace(/\s*More$/, '').replace(/\.\.\.\s*$/, '...').trim();
      }
    }

    // Try .OYzgjc container (About section)
    const aboutContainers = document.querySelectorAll('.OYzgjc');
    for (const container of aboutContainers) {
      const descEl = container.querySelector('[data-long-text]') || container.querySelector('[jsname="EvNWZc"]');
      if (descEl) {
        const longText = descEl.getAttribute('data-long-text');
        if (longText) {
          return longText.replace(/^["']|["']$/g, '').trim();
        }
        const text = descEl.textContent.trim();
        if (text && text.length > 20) {
          return text.replace(/\s*More$/, '').trim();
        }
      }
    }

    return 'Not available';
  }

  /**
   * Extract customer reviews from sidebar - using user's exact HTML structure
   */
  function extractReviews() {
    const reviews = [];

    // Based on user's HTML: <div class="nNlnIb"><div class="jfz">...<div class="HTXQwb"><a>review text</a>

    // Find all review items
    const reviewItems = document.querySelectorAll('.jfz');

    for (const item of reviewItems) {
      // Get the review text from .HTXQwb a
      const textEl = item.querySelector('.HTXQwb a');
      if (textEl) {
        let reviewText = textEl.textContent.trim();
        // Clean up - remove quotes and highlighting spans
        reviewText = reviewText.replace(/^["']|["']$/g, '').trim();

        if (reviewText && reviewText.length > 0) {
          // Get rating from .z3HNkc with aria-label
          const ratingEl = item.querySelector('.z3HNkc[aria-label]');
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
   * Extract overall rating and review count
   */
  function extractRatingInfo() {
    let rating = 'Not available';
    let reviewCount = 'Not available';

    // Rating - look for elements with rating value
    const ratingSelectors = ['.fzTgPe', '.yi40Hd', '.Y0A0hc .yi40Hd', '[aria-label*="Rated"]'];
    for (const sel of ratingSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        const text = el.getAttribute('aria-label') || el.textContent;
        const match = text.match(/([\d.]+)/);
        if (match) {
          rating = match[1];
          break;
        }
      }
    }

    // Review count - look for "X reviews" text
    const countSelectors = ['.z5jxId', '.RDApEe', '[aria-label*="reviews"]'];
    for (const sel of countSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        const text = el.getAttribute('aria-label') || el.textContent;
        const match = text.match(/(\d+)\s*reviews?/i);
        if (match) {
          reviewCount = match[1];
          break;
        }
      }
    }

    return { rating, reviewCount };
  }

  /**
   * Extract email addresses from the page
   */
  function extractEmail() {
    // Look for mailto: links
    const mailtoLinks = document.querySelectorAll('a[href^="mailto:"]');
    for (const link of mailtoLinks) {
      const email = link.href.replace('mailto:', '').split('?')[0].trim();
      if (email && email.includes('@')) {
        return email;
      }
    }

    // Look for email patterns in text
    const pageText = document.body.innerText;
    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const matches = pageText.match(emailPattern);
    if (matches && matches.length > 0) {
      // Filter out common non-business emails
      for (const email of matches) {
        if (!email.includes('example.com') && !email.includes('google.com')) {
          return email;
        }
      }
    }

    return 'Not available';
  }

  /**
   * Extract profile link
   */
  function extractProfileLink(businessCard) {
    const linkEl = businessCard.querySelector('a[data-cid]');
    if (linkEl) {
      const cid = linkEl.getAttribute('data-cid');
      if (cid) {
        return `https://www.google.com/maps?cid=${cid}`;
      }
    }
    return 'Not available';
  }

  /**
   * Check for potential website in web results
   */
  function findPotentialWebsite(businessName) {
    const webResults = document.querySelectorAll('.g, [data-hveid] .yuRUbf, .Iukrse');
    const businessNameLower = businessName.toLowerCase();
    const nameWords = businessNameLower.split(/\s+/).filter(w => w.length > 3);

    for (const result of webResults) {
      const link = result.querySelector('a[href]');
      const cite = result.querySelector('cite');

      if (link && link.href) {
        const href = link.href.toLowerCase();
        const citeText = (cite?.textContent || '').toLowerCase();

        // Skip known non-business sites
        if (href.includes('google.com') ||
            href.includes('facebook.com') ||
            href.includes('instagram.com') ||
            href.includes('twitter.com') ||
            href.includes('yelp.com') ||
            href.includes('linkedin.com') ||
            href.includes('youtube.com')) {
          continue;
        }

        // Check if URL or cite matches business name words
        const hasMatch = nameWords.some(word =>
          href.includes(word) || citeText.includes(word)
        );

        if (hasMatch) {
          return link.href;
        }
      }
    }

    return null;
  }

  /**
   * Extract all data from the currently visible sidebar
   */
  function extractSidebarData(businessCard, location) {
    const businessName = extractBusinessName(businessCard);

    const data = {
      id: Date.now() + Math.random(),
      timestamp: new Date().toISOString(),
      businessName: businessName,
      phone: extractPhone(),
      email: extractEmail(),
      address: extractAddress(),
      location: location,
      profileLink: extractProfileLink(businessCard),
      ...extractSocialLinks(),
      ...extractRatingInfo(),
      description: extractDescription(),
      reviews: extractReviews(),
      potentialWebsite: findPotentialWebsite(businessName),
      status: 'new',
      contactedDate: null,
      convertedDate: null,
      notes: ''
    };

    // Update location from address if available
    if (data.address !== 'Not available') {
      const parts = data.address.split(',');
      if (parts.length >= 2) {
        const locationPart = parts[parts.length - 2] || parts[parts.length - 1];
        const cleanLocation = locationPart.replace(/[A-Z]{1,2}\d.*$/i, '').trim();
        if (cleanLocation && cleanLocation.length > 2) {
          data.location = cleanLocation;
        }
      }
    }

    // Flag if potential website found
    if (data.potentialWebsite) {
      data.flagged = true;
      data.flagReason = 'Potential website found in web results';
    }

    return data;
  }

  /**
   * Click on a business card and wait for sidebar to load
   */
  async function clickAndWaitForSidebar(businessCard) {
    // Find clickable element in the card
    const clickable = businessCard.querySelector('a[data-cid]') ||
                     businessCard.querySelector('.OSrXXb') ||
                     businessCard.querySelector('.dbg0pd') ||
                     businessCard;

    if (clickable) {
      clickable.click();

      // Wait for sidebar to load - look for common sidebar elements
      await wait(1500); // Initial wait for sidebar to appear

      // Wait for address or other detail elements
      await waitForElement('[data-local-attribute="d3adr"]', 3000);
      await wait(500); // Extra wait for full content load
    }
  }

  /**
   * Get all business cards on the page
   */
  function getBusinessCards() {
    // Multiple selectors to find business cards
    const cards = [];

    // Primary selector
    const containers = document.querySelectorAll('[jscontroller="AtSb"]');
    containers.forEach(c => cards.push(c));

    // Alternative selectors
    if (cards.length === 0) {
      const altCards = document.querySelectorAll('.VkpGBb, .rllt__borderless');
      altCards.forEach(c => cards.push(c));
    }

    return cards;
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
      const businessCards = getBusinessCards();
      const prospects = [];
      const flaggedProspects = [];
      let processedCount = 0;

      showNotification(`Found ${businessCards.length} businesses. Scanning...`, 'info');

      for (const card of businessCards) {
        // Check if has website first (before clicking)
        const websiteCheck = hasWebsite(card);

        if (!websiteCheck.hasWebsite) {
          // Click on the card to load sidebar details
          await clickAndWaitForSidebar(card);

          // Extract data from the sidebar
          const businessData = extractSidebarData(card, location);

          if (businessData.businessName !== 'Unknown Business') {
            // Check for duplicates
            const isDuplicate = prospects.some(p =>
              p.businessName === businessData.businessName ||
              (p.phone !== 'Not available' && p.phone === businessData.phone)
            );

            if (!isDuplicate) {
              if (businessData.potentialWebsite) {
                flaggedProspects.push(businessData);
              }
              prospects.push(businessData);
            }
          }

          processedCount++;
          updateButtonState('scanning', `${processedCount}/${businessCards.length}`);
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
  function updateButtonState(state, countOrProgress = 0) {
    if (!scanButton) return;

    const btn = scanButton.querySelector('button');
    const textSpan = scanButton.querySelector('.btn-text');
    const countSpan = scanButton.querySelector('.btn-count');

    btn.disabled = state === 'scanning';

    switch (state) {
      case 'scanning':
        if (typeof countOrProgress === 'string') {
          textSpan.textContent = `Scanning ${countOrProgress}...`;
        } else {
          textSpan.textContent = 'Scanning...';
        }
        btn.classList.add('scanning');
        break;
      case 'ready':
        textSpan.textContent = 'Scan This Page';
        btn.classList.remove('scanning');
        if (typeof countOrProgress === 'number' && countOrProgress > 0) {
          countSpan.textContent = `(${countOrProgress} found)`;
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
