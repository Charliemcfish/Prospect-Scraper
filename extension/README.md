# Business Prospect Scraper

A Chrome extension that scrapes Google Business listing pages to collect prospects who don't have websites.

## Features

- **Auto-detection**: Automatically detects when you're on a Google Business search results page
- **Smart scraping**: Only collects businesses that have NO website
- **Local storage**: Stores prospects locally, grouped by town/location
- **Duplicate warning**: Warns you if you're about to re-scan a town you've already searched
- **Side panel interface**: Quick access to all prospects
- **Full prospect view**: Detailed view with search and filter capabilities
- **One-click copy**: Copy formatted prospect info to clipboard
- **Easy management**: View, copy, and delete prospects

## Installation

### Step 1: Download the Extension

Download or clone this repository to your local machine.

### Step 2: Load the Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** using the toggle in the top-right corner
3. Click **Load unpacked**
4. Select the `extension` folder from this repository
5. The extension icon should appear in your Chrome toolbar

### Step 3: Pin the Extension (Optional)

Click the puzzle piece icon in Chrome's toolbar, then click the pin icon next to "Business Prospect Scraper" to keep it visible.

## Usage

### Finding Prospects

1. Go to Google and search for businesses in your target area:
   - "plumbers yeovil"
   - "electricians in bristol"
   - "gas engineers bath"

2. When you see Google's local business results (the map and business listings), a blue **"Scan This Page"** button will appear in the bottom-right corner

3. Click the button to scan the page for businesses without websites

4. If you've already scanned this location, you'll be asked to confirm if you want to scan again

5. A notification will show how many prospects were found

### Viewing Prospects

**Side Panel:**
1. Click the extension icon in the toolbar to open the side panel
2. See a summary of total towns and prospects
3. Expand each town to see businesses
4. Click a business name for quick info

**Full View:**
1. Click **"View All Prospects"** in the side panel
2. Opens a new tab with detailed prospect cards
3. Use the search box to find specific businesses
4. Filter by location using the dropdown
5. View all collected information for each prospect

### Managing Prospects

**Copy Info:**
- Click the **"Copy Info"** button on any prospect card
- Formatted business information is copied to your clipboard
- Paste into emails, documents, or CRM systems

**Remove Prospects:**
- Click the **"Remove"** button on any prospect card
- Confirm the deletion
- Prospect is permanently removed from storage

## Data Collected

For each business WITHOUT a website, the extension collects:

| Field | Description |
|-------|-------------|
| Business Name | The name of the business |
| Phone | Contact phone number |
| Email | Email address (if available) |
| Address | Full business address |
| Location | Town/city |
| Google Profile | Link to their Google Business profile |
| Facebook | Facebook page link (if available) |
| Instagram | Instagram profile link (if available) |
| Rating | Star rating (e.g., 4.8) |
| Review Count | Number of reviews |
| Description | Business description |
| Reviews | Customer review snippets |

## Copy Format

When you copy a prospect's info, it's formatted as:

```
Business: Ben O'Malley Plumbing and Heating
Location: 69 Thorne Ln, Yeovil BA21 3LU
Phone: 07883 825962
Email: Not available

Google Profile: https://www.google.com/maps?cid=18121298015790268999
Facebook: https://www.facebook.com/benomalleyplumbing/
Instagram: Not available

Rating: 5.0 stars (21 reviews)

About the Business:
Plumbing and heating engineer 15+ years experience...

Customer Reviews:
"We had a new oven fitted and a service on our boiler." (Rated 5.0 out of 5)
"I highly recommend his workmanship." (Rated 5.0 out of 5)
```

## Data Storage

- All data is stored locally in Chrome using `chrome.storage.local`
- No data is sent to external servers
- Data persists until you remove it or clear extension data

### Backup Your Data

To export your data:
1. Open Chrome DevTools (F12)
2. Go to Application > Storage > Local Storage
3. Find the extension's storage
4. Copy the data

### Clear All Data

To remove all stored prospects:
1. Go to `chrome://extensions/`
2. Find "Business Prospect Scraper"
3. Click "Details"
4. Click "Clear data" under "Site access"

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + F` | Focus search box (on prospects page) |

## Troubleshooting

### Button not appearing

- Make sure you're on a Google search results page with local business listings
- Try refreshing the page
- Check that the extension is enabled in `chrome://extensions/`

### Scan not finding prospects

- The extension only collects businesses WITHOUT websites
- Try a different search query or location
- Some business listings may not have enough information to scrape

### Storage issues

- Chrome has storage limits; very large amounts of data may cause issues
- Try removing old prospects you no longer need

## Privacy

This extension:
- Only runs on Google search pages
- Only stores data locally on your device
- Does not track your activity
- Does not send data to any external servers
- Does not require user accounts or sign-in

## Permissions

| Permission | Why it's needed |
|------------|-----------------|
| `storage` | Save prospects locally |
| `activeTab` | Access current tab to scrape business data |
| `sidePanel` | Display the side panel interface |
| `host_permissions` | Run on Google search pages |

## Support

For issues or feature requests, please open an issue on GitHub.

## License

MIT License - feel free to modify and use as needed.
