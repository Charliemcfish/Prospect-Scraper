/**
 * Background Service Worker for Business Prospect Scraper
 * Handles side panel management and message passing
 */

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener(async (tab) => {
  try {
    await chrome.sidePanel.open({ tabId: tab.id });
  } catch (error) {
    console.error('Failed to open side panel:', error);
  }
});

// Set side panel behavior to open on action click
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error('Failed to set panel behavior:', error));

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PROSPECTS_UPDATED') {
    // Broadcast to all extension pages (side panel, prospects page)
    chrome.runtime.sendMessage({
      type: 'REFRESH_PROSPECTS',
      data: message.data
    }).catch(() => {
      // Ignore errors if no listeners
    });
  }

  if (message.type === 'OPEN_PROSPECTS_PAGE') {
    chrome.tabs.create({
      url: chrome.runtime.getURL('prospects.html')
    });
    sendResponse({ success: true });
  }

  if (message.type === 'GET_CURRENT_TAB_URL') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        sendResponse({ url: tabs[0].url });
      } else {
        sendResponse({ url: null });
      }
    });
    return true; // Keep message channel open for async response
  }

  return false;
});

// Initialize storage on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['prospects', 'scannedTowns'], (result) => {
    if (!result.prospects) {
      chrome.storage.local.set({ prospects: {} });
    }
    if (!result.scannedTowns) {
      chrome.storage.local.set({ scannedTowns: [] });
    }
  });

  console.log('Business Prospect Scraper installed successfully');
});
