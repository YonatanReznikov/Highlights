const $ = id => document.getElementById(id);
const grid       = $('highlightsGrid');
const filterBar  = $('filterBar');
const statusDot  = $('statusDot');
const statusText = $('statusText');
const countEl    = $('highlightCount');
const dateEl     = $('dateDisplay');
const updatedEl  = $('lastUpdated');
const refreshBtn = $('refreshBtn');
const emptyEl    = $('emptyState');
const themeBtn   = $('themeBtn');

/* ——— Theme ——— */
const getTheme = () => localStorage.getItem('hl-theme') || 'dark';
const setTheme = t => { document.documentElement.setAttribute('data-theme', t); localStorage.setItem('hl-theme', t); };
setTheme(getTheme());
themeBtn.addEventListener('click', () => setTheme(getTheme() === 'dark' ? 'light' : 'dark'));

let all = [];
let filter = 'all';

const shortLabel = {
  'Manchester United': 'Man Utd', 'Atletico Madrid': 'Atletico',
  'Bayern Munich': 'Bayern'
};

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
  return d.toLocaleDateString('en-GB');
}

function card(item, i) {
  const label = shortLabel[item.league] || item.league;
  const logo = logoSrc(item.league);
  const time = ago(new Date(item.pubDate));
  const delay = Math.min(i * 35, 300);

  const a = document.createElement('a');
  a.className = 'card card-in';
  a.href = item.link;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.style.animationDelay = `${delay}ms`;
  a.setAttribute('aria-label', `${item.name} — ${label}`);

  a.innerHTML = `
    <div class="card-img">
      ${item.thumbnail ? `<img src="${item.thumbnail}" alt="" loading="lazy" width="480" height="270">` : ''}
      ${logo ? `<div class="card-badge"><img class="card-badge-logo" src="${logo}" alt="${esc(label)}"></div>` : ''}
      <div class="play"><div class="play-btn"><svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21"/></svg></div></div>
    </div>
    <div class="card-body">
      <div class="card-title">${esc(item.name)}</div>
      <div class="card-meta">
        <span>${time}</span>
        <span class="meta-dot"></span>
        <span>${esc(item.category)}</span>
      </div>
    </div>`;

  return a;
}

function render() {
  grid.innerHTML = '';
  const list = filter === 'all' ? all : all.filter(h => h.category === filter);
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
    countEl.textContent = `${d.count} Highlights`;
    updatedEl.textContent = `Updated ${new Date(d.lastUpdated).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}`;
    pick(filter);
  } catch {
    statusDot.className = 'pill-dot err';
    statusText.textContent = 'Error';
  } finally {
    refreshBtn.classList.remove('spinning');
  }
}

filterBar.addEventListener('click', e => { const c = e.target.closest('.chip'); if (c) pick(c.dataset.filter); });
refreshBtn.addEventListener('click', () => load(true));

load();
setInterval(() => load(true), 30 * 60 * 1000);
