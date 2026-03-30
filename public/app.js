const $ = id => document.getElementById(id);
const grid       = $('highlightsGrid');
const filterBar  = $('filterBar');
const dayBar     = $('dayBar');
const statusDot  = $('statusDot');
const statusText = $('statusText');
const countEl    = $('highlightCount');
const dateEl     = $('dateDisplay');
const updatedEl  = $('lastUpdated');
const refreshBtn = $('refreshBtn');
const emptyEl    = $('emptyState');
const themeBtn   = $('themeBtn');
const overlay    = $('playerOverlay');
const playerFrame = $('playerFrame');
const playerClose = $('playerClose');

/* ——— Theme ——— */
const getTheme = () => localStorage.getItem('hl-theme') || 'dark';
const setTheme = t => { document.documentElement.setAttribute('data-theme', t); localStorage.setItem('hl-theme', t); };
setTheme(getTheme());
themeBtn.addEventListener('click', () => setTheme(getTheme() === 'dark' ? 'light' : 'dark'));

let all = [];
let filter = 'all';
let dayFilter = null; // will be set to today on build

const shortLabel = {
  'Manchester United': 'Man Utd', 'Atletico Madrid': 'Atletico',
  'Bayern Munich': 'Bayern'
};

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function logoSrc(league) {
  return (window.LEAGUE_LOGOS && window.LEAGUE_LOGOS[league]) || '';
}

function esc(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

function ago(d) {
  const m = Math.floor((Date.now() - d) / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-GB');
}

function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function buildDayBar() {
  dayBar.innerHTML = '';
  const today = new Date();
  const todayKey = dateKey(today);
  dayFilter = todayKey;

  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = dateKey(d);
    const btn = document.createElement('button');
    btn.className = 'day-chip' + (i === 0 ? ' on' : '');
    btn.dataset.day = key;
    const label = i === 0 ? 'Today' : i === 1 ? 'Yesterday' : dayNames[d.getDay()];
    const dateNum = `${d.getDate()}/${d.getMonth()+1}`;
    btn.innerHTML = `<span class="day-label">${label}</span><span class="day-num">${dateNum}</span>`;
    dayBar.appendChild(btn);
  }
}

function pickDay(v) {
  dayFilter = v;
  dayBar.querySelectorAll('.day-chip').forEach(c => c.classList.toggle('on', c.dataset.day === v));
  render();
}

function openPlayer(videoId) {
  playerFrame.innerHTML = `<iframe src="https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closePlayer() {
  overlay.classList.remove('open');
  playerFrame.innerHTML = '';
  document.body.style.overflow = '';
}

playerClose.addEventListener('click', closePlayer);
overlay.addEventListener('click', e => { if (e.target === overlay) closePlayer(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closePlayer(); });

function card(item, i) {
  const label = shortLabel[item.league] || item.league;
  const logo = logoSrc(item.league);
  const time = ago(new Date(item.pubDate));
  const delay = Math.min(i * 35, 300);

  const el = document.createElement('div');
  el.className = 'card card-in';
  el.style.animationDelay = `${delay}ms`;
  el.setAttribute('aria-label', `${item.name} — ${label}`);
  el.tabIndex = 0;

  if (item.videoId) {
    el.addEventListener('click', () => openPlayer(item.videoId));
    el.addEventListener('keydown', e => { if (e.key === 'Enter') openPlayer(item.videoId); });
  }

  el.innerHTML = `
    <div class="card-img">
      ${item.thumbnail ? `<img src="${item.thumbnail}" alt="" loading="lazy" width="480" height="270">` : ''}
      <div class="play"><div class="play-btn"><svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21"/></svg></div></div>
    </div>
    <div class="card-body">
      <div class="card-title-row">
        ${logo ? `<img class="card-title-logo" data-league="${esc(item.league)}" src="${logo}" alt="${esc(label)}">` : ''}
        <div class="card-title">${esc(item.name)}</div>
      </div>
      <div class="card-meta">
        <span>${time}</span>
        <span class="meta-dot"></span>
        <span>${esc(item.category)}</span>
      </div>
    </div>`;

  return el;
}

function render() {
  grid.innerHTML = '';
  let list = all;

  // Day filter
  if (dayFilter) {
    list = list.filter(h => dateKey(new Date(h.pubDate)) === dayFilter);
  }

  // Sport filter
  if (filter !== 'all') {
    list = list.filter(h => h.category === filter);
  }

  // Update count for current view
  countEl.textContent = `${list.length} Highlights`;

  if (!list.length) { emptyEl.style.display = 'block'; return; }
  emptyEl.style.display = 'none';
  list.forEach((h, i) => grid.appendChild(card(h, i)));
}

function pick(v) {
  filter = v;
  filterBar.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c.dataset.filter === v));
  render();
}

async function load(refresh = false) {
  try {
    statusDot.className = 'pill-dot';
    statusText.textContent = refresh ? 'Refreshing' : 'Loading';
    if (refresh) refreshBtn.classList.add('spinning');
    if (refresh) await fetch('/api/refresh');
    const d = await (await fetch('/api/highlights')).json();

    all = d.highlights;
    dateEl.textContent = `${d.day} \u00B7 ${d.date}`;
    statusDot.className = 'pill-dot on';
    statusText.textContent = 'Live';
    updatedEl.textContent = `Updated ${new Date(d.lastUpdated).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}`;
    pick(filter);
  } catch {
    statusDot.className = 'pill-dot err';
    statusText.textContent = 'Error';
  } finally {
    refreshBtn.classList.remove('spinning');
  }
}

buildDayBar();
dayBar.addEventListener('click', e => { const c = e.target.closest('.day-chip'); if (c) pickDay(c.dataset.day); });
filterBar.addEventListener('click', e => { const c = e.target.closest('.chip'); if (c) pick(c.dataset.filter); });
refreshBtn.addEventListener('click', () => load(true));

load();
setInterval(() => load(true), 30 * 60 * 1000);
