const express = require('express');
const fetch = require('node-fetch');
const { parseString } = require('xml2js');
const path = require('path');

const app = express();
const PORT = 3000;

// --- RSS Feeds (from N8N workflow) ---
const feeds = [
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCB_qr75-ydFVKSF9Dmo6izg", league: "F1" },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UC0LrZO9wORIqn_aRJtKdgfA", league: "NBA" },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCGr3nR_XH9r6E5b09ZJAT9w", league: "EuroLeague" },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCtInrnU3QbWqFGsdKT1GZtg", league: "FIBA" },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UC6UL29enLNe4mqwTfAyeNuw", league: "Bundesliga" },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UC6yW44UGJJBvYTlfC7CRg2Q", league: "Manchester United" },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCWV3obpZVGgJ3j9FVhEjF2Q", league: "Real Madrid" },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCK8rTVgp3-MebXkmeJcQb1Q", league: "BVB" },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCuzKFwdh7z2GHcIOX_tXgxA", league: "Atletico Madrid" },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCpryVRk_VDudG8SHXgWcG0w", league: "Arsenal" },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCZkcxFIsqW5htimoUQKA0iA", league: "Bayern Munich" }
];

// --- Filter keywords (from N8N workflow) ---
const clOnlyNodes = ['Atletico Madrid', 'Real Madrid', 'Arsenal', 'Bayern Munich', 'Milan', 'Inter'];
const clKeywords = ['champions league', 'ucl'];
const f1Keywords = ['race highlights', 'qualifying highlights', 'sprint highlights'];
const generalHighlights = ['highlight', 'highlights', 'recap', 'full game'];
const topTenKeyword = 'top 10';

// --- League settings (priority & icons) ---
const leagueSettings = {
  'F1':                { priority: 1, icon: '🏎️', color: '#E10600' },
  'FIBA':              { priority: 2, icon: '🏀', color: '#FF6B00' },
  'EuroLeague':        { priority: 3, icon: '🏀', color: '#FF8C00' },
  'NBA':               { priority: 4, icon: '🏀', color: '#1D428A' },
  'UCL':               { priority: 5, icon: '🏆', color: '#003899' },
  'Bundesliga':        { priority: 6, icon: '⚽', color: '#D20515' },
  'Manchester United':  { priority: 7, icon: '⚽', color: '#DA291C' },
  'BVB':               { priority: 7, icon: '⚽', color: '#FDE100' },
  'Real Madrid':       { priority: 8, icon: '⚽', color: '#FEBE10' },
  'Atletico Madrid':   { priority: 8, icon: '⚽', color: '#CB3524' },
  'Arsenal':           { priority: 8, icon: '⚽', color: '#EF0107' },
  'Bayern Munich':     { priority: 8, icon: '⚽', color: '#DC052D' },
  'Milan':             { priority: 8, icon: '⚽', color: '#FB090B' },
  'Inter':             { priority: 8, icon: '⚽', color: '#010E80' }
};

function parseXml(xml) {
  return new Promise((resolve, reject) => {
    parseString(xml, { explicitArray: false }, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

async function fetchFeed(feed) {
  try {
    const response = await fetch(feed.url, { timeout: 10000 });
    const xml = await response.text();
    const parsed = await parseXml(xml);

    const entries = parsed?.feed?.entry;
    if (!entries) return [];

    const items = Array.isArray(entries) ? entries : [entries];
    return items.map(entry => ({
      title: entry.title || '',
      link: entry.link?.$?.href || '',
      pubDate: entry.published || '',
      author: entry.author?.name || '',
      league: feed.league,
      videoId: entry['yt:videoId'] || ''
    }));
  } catch (err) {
    console.error(`Failed to fetch ${feed.league}:`, err.message);
    return [];
  }
}

function filterItem(item) {
  const title = (item.title || '').toLowerCase();
  const author = (item.author || '').toLowerCase();
  const link = (item.link || '').toLowerCase();
  const league = item.league;

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const pubDate = new Date(item.pubDate);

  if (!item.pubDate || isNaN(pubDate.getTime())) return false;
  if (pubDate < twentyFourHoursAgo) return false;

  const hasHighlightKeyword = generalHighlights.some(key => title.includes(key));
  const hasTopTen = title.includes(topTenKeyword);
  const isIsraelContext =
    title.includes('israel') ||
    title.includes('maccabi') ||
    title.includes('hapoel');

  if (league === 'FIBA' || title.includes('fiba') || author.includes('fiba')) {
    return isIsraelContext || hasTopTen;
  }

  if (
    league === 'EuroLeague' || league === 'NBA' ||
    title.includes('euroleague') || title.includes('nba') ||
    author.includes('euroleague') || author.includes('nba')
  ) {
    return hasHighlightKeyword || hasTopTen;
  }

  if (
    league === 'F1' ||
    author.includes('formula 1') ||
    title.includes('grand prix') ||
    title.includes('formula 1') ||
    title.includes('f1') ||
    link.includes('formula1')
  ) {
    return f1Keywords.some(key => title.includes(key));
  }

  if (clOnlyNodes.includes(league)) {
    return clKeywords.some(key => title.includes(key));
  }

  if (league === 'Manchester United') {
    if (title.includes('u18') || title.includes('u21') || title.includes('women')) return false;
    return hasHighlightKeyword;
  }

  if (
    league === 'Bundesliga' || league === 'BVB' ||
    title.includes('bundesliga') || author.includes('bundesliga')
  ) {
    return hasHighlightKeyword;
  }

  return false;
}

function formatMatchName(title) {
  // Try to extract "Team A vs Team B" pattern
  const vsMatch = title.match(/(.+?)\s+(?:vs\.?|v\.?)\s+(.+?)(?:\s*[|:,]|\s+(?:highlights?|recap|full game))/i);
  if (vsMatch) {
    return `${vsMatch[1].trim()} vs ${vsMatch[2].trim()}`;
  }

  // Check for "Top 10" style
  if (/top\s*10/i.test(title)) {
    return 'Top 10 Plays';
  }

  // F1: "Race Highlights | 2026 Japanese Grand Prix" -> "Japanese Grand Prix"
  const f1Match = title.match(/(?:Race|Qualifying|Sprint)\s+Highlights?\s*\|\s*(.+)/i);
  if (f1Match) {
    return f1Match[1].trim();
  }

  // Clean up: remove "Highlights", "Recap", etc. everywhere
  let cleaned = title
    .replace(/^Highlights?\s*\|\s*/i, '')  // leading "Highlights |"
    .replace(/\s*\|\s*/g, ' | ')    // normalize pipes
    .replace(/\bHIGHLIGHTS?\b/gi, '')
    .replace(/\brecap\b/gi, '')
    .replace(/\bfull\s+game\b/gi, '')
    .replace(/\bfull\s+match\b/gi, '')
    .replace(/\s*\|\s*\|\s*/g, ' | ')  // clean double pipes
    .replace(/^\s*\|\s*/, '')           // leading pipe
    .replace(/\s*\|\s*$/, '')           // trailing pipe
    .replace(/\s{2,}/g, ' ')           // multiple spaces
    .trim();

  // If result has pipe, take the more meaningful part
  if (cleaned.includes('|')) {
    const parts = cleaned.split('|').map(p => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      // For patterns like "Event Name | Details", keep both
      cleaned = parts.join(' | ');
    }
  }

  return cleaned || title;
}

function resolveLeague(item) {
  const title = item.title.toLowerCase();

  // If it came from a CL-only node and passed filter, it's UCL
  if (clOnlyNodes.includes(item.league)) return 'UCL';

  // BVB is Bundesliga
  if (item.league === 'BVB') return 'Bundesliga';

  // Check title for league hints
  if (title.includes('champions league') || title.includes('ucl')) return 'UCL';
  if (title.includes('euroleague')) return 'EuroLeague';
  if (title.includes('bundesliga')) return 'Bundesliga';

  return item.league;
}

// --- Cache ---
let cachedHighlights = [];
let lastFetchTime = null;

async function fetchAllHighlights() {
  console.log(`[${new Date().toLocaleTimeString()}] Fetching highlights...`);

  const allItemsArrays = await Promise.all(feeds.map(feed => fetchFeed(feed)));
  const allItems = allItemsArrays.flat();

  const filtered = allItems.filter(filterItem);

  const formatted = filtered.map(item => {
    const displayLeague = resolveLeague(item);
    const settings = leagueSettings[displayLeague] || leagueSettings[item.league] || { priority: 99, icon: '⚽', color: '#888' };
    const isIsrael = /israel|maccabi|hapoel/i.test(item.title);

    // Resolve category for frontend filters
    const footballLeagues = ['UCL', 'Bundesliga', 'Manchester United', 'BVB', 'Real Madrid', 'Atletico Madrid', 'Arsenal', 'Bayern Munich', 'Milan', 'Inter'];
    const basketballLeagues = ['EuroLeague', 'FIBA'];
    let category = 'other';
    if (displayLeague === 'F1') category = 'F1';
    else if (displayLeague === 'NBA') category = 'NBA';
    else if (basketballLeagues.includes(displayLeague)) category = 'Basketball';
    else if (footballLeagues.includes(displayLeague)) category = 'Football';

    return {
      name: formatMatchName(item.title),
      originalTitle: item.title,
      league: displayLeague,
      category,
      icon: isIsrael ? '🇮🇱' : settings.icon,
      color: settings.color,
      link: item.link,
      videoId: item.videoId,
      thumbnail: item.videoId ? `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg` : null,
      pubDate: item.pubDate,
      priority: settings.priority
    };
  });

  // Sort by priority
  formatted.sort((a, b) => a.priority - b.priority);

  // Remove duplicates by link
  const seen = new Set();
  const unique = formatted.filter(item => {
    if (seen.has(item.link)) return false;
    seen.add(item.link);
    return true;
  });

  cachedHighlights = unique;
  lastFetchTime = new Date().toISOString();

  console.log(`[${new Date().toLocaleTimeString()}] Found ${unique.length} highlights`);
  return unique;
}

// --- Serve static files ---
app.use(express.static(path.join(__dirname, 'public')));

// --- API ---
app.get('/api/highlights', async (req, res) => {
  try {
    // Re-fetch if cache is older than 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (!lastFetchTime || new Date(lastFetchTime) < fiveMinutesAgo) {
      await fetchAllHighlights();
    }

    const today = new Date();
    const dateStr = today.toLocaleDateString('en-GB').replace(/\//g, '.');
    const dayName = today.toLocaleDateString('en-US', { weekday: 'long' });

    res.json({
      date: dateStr,
      day: dayName,
      lastUpdated: lastFetchTime,
      count: cachedHighlights.length,
      highlights: cachedHighlights
    });
  } catch (err) {
    console.error('API error:', err);
    res.status(500).json({ error: 'Failed to fetch highlights' });
  }
});

app.get('/api/refresh', async (req, res) => {
  try {
    await fetchAllHighlights();
    res.json({ success: true, count: cachedHighlights.length, lastUpdated: lastFetchTime });
  } catch (err) {
    res.status(500).json({ error: 'Failed to refresh' });
  }
});

// --- Start ---
app.listen(PORT, async () => {
  console.log(`\n  Highlights server running at http://localhost:${PORT}\n`);
  await fetchAllHighlights();
});
