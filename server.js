const express = require('express');
const fetch = require('node-fetch');
const { parseString } = require('xml2js');
const path = require('path');
const fs = require('fs');

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
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCZkcxFIsqW5htimoUQKA0iA", league: "Bayern Munich" },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UC-5AVLhL2v04-lfbVzejRZQ", league: "Israel" },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UC7am34-1rGU_ky1vWYnoOJQ", league: "Germany" },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCpnmJcBhJqKIHFkKvgdkdMQ", league: "Netherlands" },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCNT2e7Og56vm5_V-yJWvglA", league: "England" }
];

// --- Filter keywords (from N8N workflow) ---
const clOnlyNodes = ['Atletico Madrid', 'Real Madrid', 'Arsenal', 'Bayern Munich', 'Milan', 'Inter'];
const clKeywords = ['champions league', 'ucl'];
const f1Keywords = ['race highlights', 'qualifying highlights', 'sprint highlights', 'practice highlights', 'fp1 highlights', 'fp2 highlights', 'fp3 highlights'];
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
  'Inter':             { priority: 8, icon: '⚽', color: '#010E80' },
  'Israel':            { priority: 3, icon: '🇮🇱', color: '#0038b8' },
  'Germany':           { priority: 7, icon: '⚽', color: '#000000' },
  'Germany-DFB':       { priority: 7, icon: '⚽', color: '#000000' },
  'Netherlands':       { priority: 7, icon: '⚽', color: '#FF6600' },
  'England':           { priority: 7, icon: '⚽', color: '#FFFFFF' }
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
    const response = await fetch(feed.url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
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

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const pubDate = new Date(item.pubDate);

  if (!item.pubDate || isNaN(pubDate.getTime())) return false;
  if (pubDate < sevenDaysAgo) return false;

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
    // Filter out youth/NextGen tournaments
    if (/u18|nextgen|next gen|adidas.*belgrade|tournament/i.test(title)) return false;
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
    if (/\blive\b|watchparty|watch party|preview|presser|press conference/i.test(title)) return false;
    return clKeywords.some(key => title.includes(key)) && hasHighlightKeyword;
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

  // Israel — all national teams (all ages), filter for match summaries
  if (league === 'Israel') {
    const hasIsraelHighlight = title.includes('תקציר') || title.includes('highlight') || title.includes('recap');
    // Exclude women's matches
    // Keep all age groups (נוער, צעירה, בוגרת, etc.)
    return hasIsraelHighlight;
  }

  // Germany (DFB) — senior team only + DFB Pokal highlights
  if (league === 'Germany') {
    if (/under[- ]?\d|u\d{2}\b|u-\d{2}|frauen|women/i.test(title)) return false;
    if (title.includes('full game')) return false;
    return hasHighlightKeyword || title.includes('pokal');
  }

  // Netherlands — senior team only
  if (league === 'Netherlands') {
    if (title.includes('u17') || title.includes('u19') || title.includes('u21') || title.includes('jong') || title.includes('vrouwen') || title.includes('women')) return false;
    return hasHighlightKeyword || title.includes('samenvatting');
  }

  // England — senior team match highlights only (no reels, no archive, no compilations)
  if (league === 'England') {
    if (/under[- ]?\d|u\d{2}\b|women|lionesses|archive|all the/i.test(title)) return false;
    // Must have a clear match format with scores or vs in a pipe section
    const hasMatchFormat = /\|\s*.*(?:vs\.?|v\.?|\d+\s*[-–]\s*\d+).*\|/i.test(title) ||
                           /\|\s*.*(?:international match|match highlight)/i.test(title);
    return hasMatchFormat && hasHighlightKeyword;
  }

  return false;
}

function formatMatchName(title) {
  // Check for "Top 10" style
  if (/top\s*10/i.test(title)) {
    return 'Top 10 Plays';
  }

  // F1: "Race Highlights | 2026 Japanese Grand Prix" -> "Japanese Grand Prix"
  const f1Match = title.match(/(?:Race|Qualifying|Sprint)\s+Highlights?\s*\|\s*(.+)/i);
  if (f1Match) {
    return f1Match[1].trim();
  }

  // Score format anywhere: "Team A 1-2 Team B" (extract from pipe-separated sections)
  const sections = title.split('|').map(s => s.trim());
  for (const sec of sections) {
    const scoreMatch = sec.match(/^(.+?)\s+(\d+\s*[-–]\s*\d+)\s+(.+?)$/);
    if (scoreMatch) {
      let a = scoreMatch[1].trim(), b = scoreMatch[3].trim();
      // Clean trailing junk from team names
      a = a.replace(/[!.]+$/, '').trim();
      b = b.replace(/[!.]+$/, '').trim();
      if (a.length > 1 && b.length > 1) return `${a} vs ${b}`;
    }
  }

  // Hebrew: "ליגת העל לנוער | מחזור 22 | מכבי חיפה - ביתר ירושלים | תקציר"
  const hebrewMatch = title.match(/([^|]+\s+-\s+[^|]+)\s*\|\s*תקציר/);
  if (hebrewMatch) {
    return hebrewMatch[1].replace(/\s*\|\s*$/, '').trim();
  }
  // Also: "תקציר המשחק" at end
  const hebrewMatch2 = title.match(/\|\s*([^|]+-[^|]+?)\s*\|\s*תקציר/);
  if (hebrewMatch2) {
    return hebrewMatch2[1].trim();
  }

  // German: "INSANE WIRTZ SHOW!!! 4 SCORER | Switzerland vs Germany"
  // Dutch: "Samenvatting | Nederland - Duitsland"
  // Extract "Team A vs/- Team B" from anywhere in title
  const vsPatterns = [
    /(.+?)\s+(?:vs\.?|v\.?)\s+(.+?)(?:\s*[|:,!]|\s+\d|\s*$)/i,
    /\|\s*(.+?)\s+(\d+\s*-\s*\d+)\s+(.+?)(?:\s*[|]|\s*$)/,
    /\|\s*(.+?)\s+-\s+(.+?)(?:\s*[|]|\s*$)/,
  ];

  // "Team A vs Team B" pattern
  const vs1 = title.match(vsPatterns[0]);
  if (vs1) {
    let a = vs1[1].trim(), b = vs1[2].trim();
    a = a.replace(/^.*\|\s*/, '');
    // Clean trailing noise from b
    b = b.replace(/\s+(?:Full Game|Full Match|Highlights?).*$/i, '').trim();
    return `${a} vs ${b}`;
  }

  // "| Team A 1-2 Team B |" with score
  const sc1 = title.match(vsPatterns[1]);
  if (sc1) {
    return `${sc1[1].trim()} vs ${sc1[3].trim()}`;
  }

  // "| Team A - Team B |" or "Highlights Team A - Team B"
  const dash1 = title.match(vsPatterns[2]);
  if (dash1) {
    let a = dash1[1].trim().replace(/^Highlights?\s*/i, '');
    let b = dash1[2].trim().replace(/\s*\(.*\)\s*$/, ''); // remove (Friendly) etc
    return `${a} vs ${b}`;
  }

  // Fallback: clean up noise
  let cleaned = title
    .replace(/^Highlights?\s*\|\s*/i, '')
    .replace(/^Samenvatting[^|]*\|\s*/i, '')
    .replace(/\s*\|[^|]*(?:Jornada|Matchday|Round|מחזור)[^|]*/gi, '')
    .replace(/\s*\|[^|]*תקציר[^|]*/g, '')
    .replace(/\s*#\w+/g, '')
    .replace(/\bHIGHLIGHTS?\b/gi, '')
    .replace(/\brecap\b/gi, '')
    .replace(/\bfull\s+game\b/gi, '')
    .replace(/\bfull\s+match\b/gi, '')
    .replace(/\s*🦁.*$/g, '')
    .replace(/\s*\|[^|]*$/g, '') // trailing pipe section
    .replace(/^\s*\|\s*/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return cleaned || title;
}

function resolveLeague(item) {
  const title = item.title.toLowerCase();

  // If it came from a CL-only node and passed filter, it's UCL
  if (clOnlyNodes.includes(item.league)) return 'UCL';

  // BVB is Bundesliga
  if (item.league === 'BVB') return 'Bundesliga';

  // Germany channel: distinguish DFB Pokal from national team
  if (item.league === 'Germany' && title.includes('pokal')) return 'Germany-DFB';

  // Check title for league hints
  if (title.includes('champions league') || title.includes('ucl')) return 'UCL';
  if (title.includes('euroleague')) return 'EuroLeague';
  if (title.includes('bundesliga')) return 'Bundesliga';

  return item.league;
}

// --- Persistent storage ---
const STORE_FILE = path.join(__dirname, 'highlights-store.json');
let cachedHighlights = [];
let lastFetchTime = null;

function loadStore() {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const data = JSON.parse(fs.readFileSync(STORE_FILE, 'utf-8'));
      return data.highlights || [];
    }
  } catch (e) { console.error('Failed to load store:', e.message); }
  return [];
}

function saveStore(highlights) {
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify({ highlights, lastUpdated: new Date().toISOString() }, null, 2));
  } catch (e) { console.error('Failed to save store:', e.message); }
}

function formatHighlight(item) {
  const displayLeague = resolveLeague(item);
  const settings = leagueSettings[displayLeague] || leagueSettings[item.league] || { priority: 99, icon: '⚽', color: '#888' };
  const isIsrael = /israel|maccabi|hapoel/i.test(item.title);

  const footballLeagues = ['UCL', 'Bundesliga', 'Manchester United', 'BVB', 'Real Madrid', 'Atletico Madrid', 'Arsenal', 'Bayern Munich', 'Milan', 'Inter', 'Israel', 'Germany', 'Germany-DFB', 'Netherlands', 'England'];
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
}

async function fetchAllHighlights() {
  console.log(`[${new Date().toLocaleTimeString()}] Fetching highlights...`);

  const allItemsArrays = await Promise.all(feeds.map(feed => fetchFeed(feed)));
  const allItems = allItemsArrays.flat();
  const filtered = allItems.filter(filterItem);
  const newFormatted = filtered.map(formatHighlight);

  // Load existing stored highlights
  const stored = loadStore();

  // Merge: add new items, keep old ones (by link)
  const byLink = new Map();
  for (const h of stored) byLink.set(h.link, h);
  for (const h of newFormatted) byLink.set(h.link, h); // new overwrites old

  // Remove items older than 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  let all = [...byLink.values()].filter(h => new Date(h.pubDate) >= sevenDaysAgo);

  // Sort by date (newest first), then priority
  all.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

  // Save merged data to disk
  saveStore(all);

  cachedHighlights = all;
  lastFetchTime = new Date().toISOString();

  console.log(`[${new Date().toLocaleTimeString()}] Total: ${all.length} highlights (${newFormatted.length} new from RSS, ${stored.length} from store)`);
  return all;
}

// --- Serve static files ---
app.use(express.static(path.join(__dirname, 'public')));
app.use('/images', express.static(path.join(__dirname, 'images')));

// --- API ---
app.get('/api/highlights', async (req, res) => {
  try {
    // Re-fetch if cache is older than 5 minutes
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (!lastFetchTime || new Date(lastFetchTime) < fiveMinAgo) {
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

// --- Demo data (used when RSS feeds are temporarily down) ---
const H = 3600000; const D = 24*H;
const demoHighlights = [
  { name: '2026 Japanese Grand Prix', league: 'F1', category: 'F1', icon: '🏎️', color: '#E10600', link: 'https://www.youtube.com/watch?v=demo1', videoId: 'oAtYfF0_4-I', thumbnail: 'https://i.ytimg.com/vi/oAtYfF0_4-I/hqdefault.jpg', pubDate: new Date(Date.now() - 3*H).toISOString(), priority: 1 },
  { name: 'Partizan vs Valencia', league: 'EuroLeague', category: 'Basketball', icon: '🏀', color: '#FF8C00', link: 'https://www.youtube.com/watch?v=demo2', videoId: 'mii-PCPcCYk', thumbnail: 'https://i.ytimg.com/vi/mii-PCPcCYk/hqdefault.jpg', pubDate: new Date(Date.now() - 5*H).toISOString(), priority: 3 },
  { name: 'Phoenix Suns vs Utah Jazz', league: 'NBA', category: 'NBA', icon: '🏀', color: '#1D428A', link: 'https://www.youtube.com/watch?v=demo3', videoId: 'sCKPq5X10uI', thumbnail: 'https://i.ytimg.com/vi/sCKPq5X10uI/hqdefault.jpg', pubDate: new Date(Date.now() - 1*D - 2*H).toISOString(), priority: 4 },
  { name: 'Memphis Grizzlies vs Chicago Bulls', league: 'NBA', category: 'NBA', icon: '🏀', color: '#1D428A', link: 'https://www.youtube.com/watch?v=demo4', videoId: 'PwOL2vBR6xM', thumbnail: 'https://i.ytimg.com/vi/PwOL2vBR6xM/hqdefault.jpg', pubDate: new Date(Date.now() - 1*D - 5*H).toISOString(), priority: 4 },
  { name: 'Atlanta Hawks vs Sacramento Kings', league: 'NBA', category: 'NBA', icon: '🏀', color: '#1D428A', link: 'https://www.youtube.com/watch?v=demo5', videoId: 'QjMiE2p2fYE', thumbnail: 'https://i.ytimg.com/vi/QjMiE2p2fYE/hqdefault.jpg', pubDate: new Date(Date.now() - 2*D - 3*H).toISOString(), priority: 4 },
  { name: 'Liverpool vs BVB', league: 'Bundesliga', category: 'Football', icon: '⚽', color: '#D20515', link: 'https://www.youtube.com/watch?v=demo6', videoId: 'Pkh3e4JGMTE', thumbnail: 'https://i.ytimg.com/vi/Pkh3e4JGMTE/hqdefault.jpg', pubDate: new Date(Date.now() - 3*D - 1*H).toISOString(), priority: 6 },
  { name: 'Southampton vs Man Utd', league: 'Manchester United', category: 'Football', icon: '⚽', color: '#DA291C', link: 'https://www.youtube.com/watch?v=demo7', videoId: 'V-3VGqH5bQI', thumbnail: 'https://i.ytimg.com/vi/V-3VGqH5bQI/hqdefault.jpg', pubDate: new Date(Date.now() - 4*D - 2*H).toISOString(), priority: 7 },
  { name: 'San Antonio Spurs vs Milwaukee Bucks', league: 'NBA', category: 'NBA', icon: '🏀', color: '#1D428A', link: 'https://www.youtube.com/watch?v=demo8', videoId: 'XEhR_MTs0xA', thumbnail: 'https://i.ytimg.com/vi/XEhR_MTs0xA/hqdefault.jpg', pubDate: new Date(Date.now() - 5*D - 4*H).toISOString(), priority: 4 },
];

// --- Start ---
app.listen(PORT, async () => {
  console.log(`\n  Highlights server running at http://localhost:${PORT}\n`);
  await fetchAllHighlights();
  // If no real data found (feeds down), use demo data for preview
  if (cachedHighlights.length === 0) {
    console.log('  RSS feeds unavailable — loading demo data for preview');
    cachedHighlights = demoHighlights;
    lastFetchTime = new Date().toISOString();
  }
});
