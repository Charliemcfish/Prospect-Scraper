/**
 * Analytics Page Script
 * Shows performance graphs with weekly/monthly/yearly views
 * Includes technical metrics with targets and actionable hints
 */

(function() {
  'use strict';

  const totalStatsEl = document.getElementById('total-stats');
  const barChartEl = document.getElementById('bar-chart');
  const yAxisEl = document.getElementById('y-axis');
  const motivationBox = document.getElementById('motivation-box');
  const summaryStatsEl = document.getElementById('summary-stats');
  const periodTabs = document.querySelectorAll('.period-tab');
  const settingsBtn = document.getElementById('settings-btn');
  const yearNavEl = document.getElementById('year-nav');
  const currentYearEl = document.getElementById('current-year');
  const prevYearBtn = document.getElementById('prev-year-btn');
  const nextYearBtn = document.getElementById('next-year-btn');

  let prospects = {};
  let currentPeriod = 'weekly';
  let currentYear = new Date().getFullYear();

  // Performance targets
  const TARGETS = {
    responseRate: 10,    // 10% response rate is good for cold outreach
    conversionRate: 2,   // 2% conversion rate target
    weeklyContacts: 50,  // Aim to contact 50 prospects per week
    dailyContacts: 10    // Aim for 10 contacts per day
  };

  // Motivational messages based on performance
  const motivationalMessages = {
    excellent: [
      { emoji: '🔥', text: "Outstanding Performance!", subtext: "You're crushing your targets!" },
      { emoji: '🚀', text: "Elite Status!", subtext: "Your outreach game is unstoppable!" },
      { emoji: '🏆', text: "Champion Level!", subtext: "This is how you build an empire!" }
    ],
    great: [
      { emoji: '⭐', text: "Excellent Progress!", subtext: "You're above target - keep it up!" },
      { emoji: '💪', text: "Strong Performance!", subtext: "Your hard work is showing results!" },
      { emoji: '📈', text: "Numbers Looking Great!", subtext: "Maintain this momentum!" }
    ],
    good: [
      { emoji: '👍', text: "Solid Performance!", subtext: "You're on track to hit your goals." },
      { emoji: '✨', text: "Good Progress!", subtext: "Keep pushing for those conversions!" },
      { emoji: '🎯', text: "On Target!", subtext: "Stay focused and keep going!" }
    ],
    improving: [
      { emoji: '📊', text: "Building Momentum!", subtext: "You're making progress - keep at it!" },
      { emoji: '🌱', text: "Growing!", subtext: "Your efforts are starting to pay off!" },
      { emoji: '⬆️', text: "On the Rise!", subtext: "Each day you're getting better!" }
    ],
    average: [
      { emoji: '💡', text: "Room to Improve!", subtext: "Check the hints below to boost results." },
      { emoji: '📋', text: "Review Your Strategy!", subtext: "Small changes can make a big difference." }
    ],
    needsWork: [
      { emoji: '🎯', text: "Time to Focus!", subtext: "Let's get those numbers up." },
      { emoji: '💪', text: "Let's Pick It Up!", subtext: "Review the hints below to improve." }
    ],
    noData: [
      { emoji: '🚀', text: "Ready to Launch!", subtext: "Start scanning for prospects to see your stats!" }
    ]
  };

  // Performance hints based on what's lacking
  const performanceHints = {
    lowContacts: [
      "Try to contact at least 10 prospects per day",
      "Focus on hot leads first - they have the highest conversion potential",
      "Set a daily outreach goal and stick to it",
      "Batch your outreach sessions for better efficiency"
    ],
    lowResponses: [
      "Personalize your messages more - mention specific details about their business",
      "Try different platforms (Facebook, Instagram, text) to see which works best",
      "Follow up with prospects who haven't responded after 3-5 days",
      "Send messages at different times - early morning or lunch often works well"
    ],
    lowConversions: [
      "Share demo websites tailored to their industry",
      "Highlight specific pain points their competitors are solving with websites",
      "Include testimonials or case studies from similar businesses",
      "Make your offer more compelling - consider limited-time discounts"
    ],
    noFollowUp: [
      "Many conversions come from follow-up messages, not the first contact",
      "Set reminders to follow up with prospects after 7 days",
      "Try a different approach in your follow-up message"
    ]
  };

  async function loadProspects() {
    try {
      const storage = await chrome.storage.local.get(['prospects']);
      prospects = storage.prospects || {};
      updateStats();
      renderChart();
      updateMotivation();
      renderSummaryStats();
    } catch (error) {
      console.error('Failed to load prospects:', error);
    }
  }

  function getAllProspects() {
    const all = [];
    for (const town of Object.keys(prospects)) {
      for (const prospect of prospects[town]) {
        all.push(prospect);
      }
    }
    return all;
  }

  function getDateRange(period) {
    const now = new Date();
    const ranges = [];

    if (period === 'weekly') {
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        const endDate = new Date(date);
        endDate.setHours(23, 59, 59, 999);
        ranges.push({
          label: date.toLocaleDateString('en-GB', { weekday: 'short' }),
          start: date,
          end: endDate
        });
      }
    } else if (period === 'monthly') {
      for (let i = 3; i >= 0; i--) {
        const endDate = new Date(now);
        endDate.setDate(endDate.getDate() - (i * 7));
        const startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 6);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        ranges.push({
          label: `Week ${4 - i}`,
          start: startDate,
          end: endDate
        });
      }
    } else if (period === 'yearly') {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      for (let i = 0; i < 12; i++) {
        const startDate = new Date(currentYear, i, 1);
        const endDate = new Date(currentYear, i + 1, 0);
        endDate.setHours(23, 59, 59, 999);
        ranges.push({
          label: months[i],
          start: startDate,
          end: endDate
        });
      }
    }

    return ranges;
  }

  function getStatsForRange(start, end) {
    const all = getAllProspects();
    let added = 0, contacted = 0, responded = 0, converted = 0;

    for (const p of all) {
      const addedDate = new Date(p.timestamp);
      if (addedDate >= start && addedDate <= end) {
        added++;
      }

      if (p.contactedDate) {
        const contactedDate = new Date(p.contactedDate);
        if (contactedDate >= start && contactedDate <= end) {
          contacted++;
        }
      }

      if (p.respondedDate) {
        const respondedDate = new Date(p.respondedDate);
        if (respondedDate >= start && respondedDate <= end) {
          responded++;
        }
      }

      if (p.convertedDate) {
        const convertedDate = new Date(p.convertedDate);
        if (convertedDate >= start && convertedDate <= end) {
          converted++;
        }
      }
    }

    return { added, contacted, responded, converted };
  }

  function renderYAxis(maxValue) {
    const steps = 5;
    const stepValue = Math.ceil(maxValue / steps);
    let html = '';

    for (let i = steps; i >= 0; i--) {
      const value = stepValue * i;
      html += `<span class="y-axis-label">${value}</span>`;
    }

    yAxisEl.innerHTML = html;
  }

  function renderChart() {
    const ranges = getDateRange(currentPeriod);
    let maxValue = 1;

    const allStats = ranges.map(r => getStatsForRange(r.start, r.end));
    for (const stats of allStats) {
      maxValue = Math.max(maxValue, stats.added, stats.contacted, stats.responded, stats.converted);
    }

    maxValue = Math.ceil(maxValue * 1.2) || 5;
    renderYAxis(maxValue);

    if (currentPeriod === 'yearly') {
      barChartEl.classList.add('yearly-view');
    } else {
      barChartEl.classList.remove('yearly-view');
    }

    let html = '';
    for (let i = 0; i < ranges.length; i++) {
      const range = ranges[i];
      const stats = allStats[i];

      const addedHeight = (stats.added / maxValue) * 200;
      const contactedHeight = (stats.contacted / maxValue) * 200;
      const respondedHeight = (stats.responded / maxValue) * 200;
      const convertedHeight = (stats.converted / maxValue) * 200;

      html += `
        <div class="chart-bar-group">
          <div class="chart-bars">
            <div class="chart-bar added" style="height: ${Math.max(addedHeight, 4)}px" data-value="${stats.added} added"></div>
            <div class="chart-bar contacted" style="height: ${Math.max(contactedHeight, 4)}px" data-value="${stats.contacted} contacted"></div>
            <div class="chart-bar responded" style="height: ${Math.max(respondedHeight, 4)}px" data-value="${stats.responded} responded"></div>
            <div class="chart-bar converted" style="height: ${Math.max(convertedHeight, 4)}px" data-value="${stats.converted} converted"></div>
          </div>
          <span class="chart-label">${range.label}</span>
        </div>
      `;
    }

    barChartEl.innerHTML = html;

    if (currentPeriod === 'yearly') {
      yearNavEl.classList.remove('hidden');
      currentYearEl.textContent = currentYear;
      const thisYear = new Date().getFullYear();
      nextYearBtn.disabled = currentYear >= thisYear;
    } else {
      yearNavEl.classList.add('hidden');
    }

    // Render period totals
    renderPeriodStats(allStats);
  }

  function renderPeriodStats(allStats) {
    const periodStatsEl = document.getElementById('period-stats');
    if (!periodStatsEl) return;

    // Sum up all stats for the current period
    let totalAdded = 0, totalContacted = 0, totalResponded = 0, totalConverted = 0;
    for (const stats of allStats) {
      totalAdded += stats.added;
      totalContacted += stats.contacted;
      totalResponded += stats.responded;
      totalConverted += stats.converted;
    }

    const periodLabel = currentPeriod === 'weekly' ? 'This Week' :
                        currentPeriod === 'monthly' ? 'This Month' :
                        `Year ${currentYear}`;

    periodStatsEl.innerHTML = `
      <div class="period-stat-item">
        <span class="period-stat-dot added"></span>
        <div class="period-stat-info">
          <span class="period-stat-value">${totalAdded}</span>
          <span class="period-stat-label">Added</span>
        </div>
      </div>
      <div class="period-stat-item">
        <span class="period-stat-dot contacted"></span>
        <div class="period-stat-info">
          <span class="period-stat-value">${totalContacted}</span>
          <span class="period-stat-label">Contacted</span>
        </div>
      </div>
      <div class="period-stat-item">
        <span class="period-stat-dot responded"></span>
        <div class="period-stat-info">
          <span class="period-stat-value">${totalResponded}</span>
          <span class="period-stat-label">Responded</span>
        </div>
      </div>
      <div class="period-stat-item">
        <span class="period-stat-dot converted"></span>
        <div class="period-stat-info">
          <span class="period-stat-value">${totalConverted}</span>
          <span class="period-stat-label">Converted</span>
        </div>
      </div>
    `;
  }

  function updateMotivation() {
    const all = getAllProspects();

    if (all.length === 0) {
      const msg = motivationalMessages.noData[0];
      motivationBox.innerHTML = `
        <div class="motivation-emoji">${msg.emoji}</div>
        <div class="motivation-text">${msg.text}</div>
        <div class="motivation-subtext">${msg.subtext}</div>
      `;
      return;
    }

    // Calculate all-time stats
    let totalContacted = 0, totalResponded = 0, totalConverted = 0;
    for (const p of all) {
      if (p.status === 'contacted' || p.status === 'responded' || p.status === 'converted') {
        totalContacted++;
      }
      if (p.status === 'responded' || p.status === 'converted') {
        totalResponded++;
      }
      if (p.status === 'converted') {
        totalConverted++;
      }
    }

    const responseRate = totalContacted > 0 ? (totalResponded / totalContacted) * 100 : 0;
    const conversionRate = totalContacted > 0 ? (totalConverted / totalContacted) * 100 : 0;

    // Get weekly stats for activity level
    const weekRanges = getDateRange('weekly');
    let weeklyContacted = 0;
    for (const range of weekRanges) {
      const stats = getStatsForRange(range.start, range.end);
      weeklyContacted += stats.contacted;
    }

    // Determine performance category
    let category;
    const hints = [];

    // Check response rate
    const responseRateOk = responseRate >= TARGETS.responseRate;
    const conversionRateOk = conversionRate >= TARGETS.conversionRate;
    const contactActivityOk = weeklyContacted >= TARGETS.weeklyContacts;

    if (responseRateOk && conversionRateOk && contactActivityOk) {
      category = 'excellent';
    } else if ((responseRateOk || conversionRateOk) && contactActivityOk) {
      category = 'great';
    } else if (responseRateOk || conversionRateOk) {
      category = 'good';
    } else if (weeklyContacted >= 10 || totalResponded > 0) {
      category = 'improving';
    } else if (totalContacted >= 5) {
      category = 'average';
    } else {
      category = 'needsWork';
    }

    // Collect relevant hints
    if (!contactActivityOk && totalContacted < 50) {
      hints.push(performanceHints.lowContacts[Math.floor(Math.random() * performanceHints.lowContacts.length)]);
    }
    if (!responseRateOk && totalContacted >= 10) {
      hints.push(performanceHints.lowResponses[Math.floor(Math.random() * performanceHints.lowResponses.length)]);
    }
    if (!conversionRateOk && totalResponded >= 3) {
      hints.push(performanceHints.lowConversions[Math.floor(Math.random() * performanceHints.lowConversions.length)]);
    }

    const messages = motivationalMessages[category];
    const msg = messages[Math.floor(Math.random() * messages.length)];

    // Build metrics display
    const responseRateStatus = responseRate >= TARGETS.responseRate ? 'good' : responseRate >= TARGETS.responseRate / 2 ? 'warning' : 'poor';
    const conversionRateStatus = conversionRate >= TARGETS.conversionRate ? 'good' : conversionRate >= TARGETS.conversionRate / 2 ? 'warning' : 'poor';

    let hintsHtml = '';
    if (hints.length > 0) {
      hintsHtml = `
        <div class="motivation-hints">
          <div class="hint-label">Tips to improve:</div>
          ${hints.map(h => `<div class="hint-item">${h}</div>`).join('')}
        </div>
      `;
    }

    motivationBox.innerHTML = `
      <div class="motivation-emoji">${msg.emoji}</div>
      <div class="motivation-text">${msg.text}</div>
      <div class="motivation-subtext">${msg.subtext}</div>
      <div class="motivation-metrics">
        <div class="metric-item ${responseRateStatus}">
          <span class="metric-label">Response Rate</span>
          <span class="metric-value">${responseRate.toFixed(1)}%</span>
          <span class="metric-target">Target: ${TARGETS.responseRate}%</span>
        </div>
        <div class="metric-item ${conversionRateStatus}">
          <span class="metric-label">Conversion Rate</span>
          <span class="metric-value">${conversionRate.toFixed(1)}%</span>
          <span class="metric-target">Target: ${TARGETS.conversionRate}%</span>
        </div>
        <div class="metric-item">
          <span class="metric-label">This Week</span>
          <span class="metric-value">${weeklyContacted} contacted</span>
          <span class="metric-target">Target: ${TARGETS.weeklyContacts}/week</span>
        </div>
      </div>
      ${hintsHtml}
    `;
  }

  function updateStats() {
    const all = getAllProspects();
    let totalContacted = 0, totalConverted = 0, totalResponded = 0;

    for (const p of all) {
      if (p.status === 'contacted' || p.status === 'responded' || p.status === 'converted') {
        totalContacted++;
      }
      if (p.status === 'responded' || p.status === 'converted') {
        totalResponded++;
      }
      if (p.status === 'converted') {
        totalConverted++;
      }
    }

    const responseRate = totalContacted > 0 ? ((totalResponded / totalContacted) * 100).toFixed(1) : 0;
    const conversionRate = totalContacted > 0 ? ((totalConverted / totalContacted) * 100).toFixed(1) : 0;

    totalStatsEl.innerHTML = `
      <div class="stat-counter">
        <span class="counter-value">${all.length}</span>
        <span class="counter-label">Total</span>
      </div>
      <div class="stat-counter">
        <span class="counter-value">${totalContacted}</span>
        <span class="counter-label">Contacted</span>
      </div>
      <div class="stat-counter stat-responded">
        <span class="counter-value">${totalResponded}</span>
        <span class="counter-label">Responded</span>
      </div>
      <div class="stat-counter stat-rate">
        <span class="counter-value">${responseRate}%</span>
        <span class="counter-label">Response</span>
      </div>
      <div class="stat-counter stat-rate">
        <span class="counter-value">${conversionRate}%</span>
        <span class="counter-label">Conversion</span>
      </div>
    `;
  }

  function renderSummaryStats() {
    const all = getAllProspects();
    let newCount = 0, contactedCount = 0, respondedCount = 0, convertedCount = 0;

    for (const p of all) {
      const status = p.status || 'new';
      if (status === 'new') newCount++;
      else if (status === 'contacted') contactedCount++;
      else if (status === 'responded') respondedCount++;
      else if (status === 'converted') convertedCount++;
    }

    summaryStatsEl.innerHTML = `
      <div class="dashboard-stat-card">
        <div class="stat-icon-box stat-total">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg>
        </div>
        <div class="stat-info">
          <span class="stat-number">${newCount}</span>
          <span class="stat-label">New Prospects</span>
        </div>
      </div>
      <div class="dashboard-stat-card">
        <div class="stat-icon-box stat-contacted">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
        </div>
        <div class="stat-info">
          <span class="stat-number">${contactedCount}</span>
          <span class="stat-label">Awaiting Response</span>
        </div>
      </div>
      <div class="dashboard-stat-card">
        <div class="stat-icon-box" style="background: rgba(54, 29, 73, 0.1); color: #361d49;">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
        </div>
        <div class="stat-info">
          <span class="stat-number">${respondedCount}</span>
          <span class="stat-label">Responded</span>
        </div>
      </div>
      <div class="dashboard-stat-card">
        <div class="stat-icon-box stat-converted">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </div>
        <div class="stat-info">
          <span class="stat-number">${convertedCount}</span>
          <span class="stat-label">Customers</span>
        </div>
      </div>
    `;
  }

  function switchPeriod(period) {
    currentPeriod = period;
    if (period === 'yearly') {
      currentYear = new Date().getFullYear();
    }
    periodTabs.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.period === period);
    });
    renderChart();
    updateMotivation();
  }

  function changeYear(delta) {
    const thisYear = new Date().getFullYear();
    const newYear = currentYear + delta;

    if (newYear > thisYear) return;
    if (newYear < thisYear - 10) return;

    currentYear = newYear;
    renderChart();
  }

  function setupEventListeners() {
    periodTabs.forEach(tab => {
      tab.addEventListener('click', () => switchPeriod(tab.dataset.period));
    });

    if (prevYearBtn) {
      prevYearBtn.addEventListener('click', () => changeYear(-1));
    }

    if (nextYearBtn) {
      nextYearBtn.addEventListener('click', () => changeYear(1));
    }

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
