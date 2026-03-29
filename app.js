const grid = document.getElementById('highlightsGrid');
const filterBar = document.getElementById('filterBar');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const highlightCount = document.getElementById('highlightCount');
const dateDisplay = document.getElementById('dateDisplay');
const lastUpdatedEl = document.getElementById('lastUpdated');
const refreshBtn = document.getElementById('refreshBtn');
const emptyState = document.getElementById('emptyState');
const themeBtn = document.getElementById('themeBtn');

// --- Theme ---
const getTheme = () => localStorage.getItem('hl-theme') || 'dark';
const setTheme = t => { document.documentElement.setAttribute('data-theme', t); localStorage.setItem('hl-theme', t); };
setTheme(getTheme());
themeBtn.addEventListener('click', () => setTheme(getTheme() === 'dark' ? 'light' : 'dark'));

let allHighlights = [];
let activeFilter = 'all';

const leagueBg = {
  'F1': '#dc2626', 'FIBA': '#ea580c', 'EuroLeague': '#d97706',
  'NBA': '#2563eb', 'UCL': '#1d4ed8', 'Bundesliga': '#dc2626',
  'Manchester United': '#b91c1c', 'BVB': '#ca8a04',
  'Real Madrid': '#7c3aed', 'Atletico Madrid': '#dc2626',
  'Arsenal': '#dc2626', 'Bayern Munich': '#dc2626',
  'Milan': '#dc2626', 'Inter': '#1e40af'
};

const leagueLabel = {
  'Manchester United': 'Man Utd', 'Atletico Madrid': 'Atletico',
  'Bayern Munich': 'Bayern'
};

function createCard(item, index) {
  const bg = leagueBg[item.league] || '#6366f1';
  const label = leagueLabel[item.league] || item.league;
  const delay = Math.min(index * 30, 300);
  const time = timeAgo(new Date(item.pubDate));

  const a = document.createElement('a');
  a.className = 'card card-enter';
  a.href = item.link;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.style.animationDelay = `${delay}ms`;
  a.setAttribute('aria-label', `${item.name} - ${item.league}`);

  a.innerHTML = `
    <div class="card-img">
      ${item.thumbnail ? `<img src="${item.thumbnail}" alt="" loading="lazy" width="480" height="270">` : ''}
      <div class="card-play"><span><svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg></span></div>
    </div>
    <div class="card-info">
      <span class="badge" style="background:${bg}">${item.icon} ${esc(label)}</span>
      <div class="card-title">${esc(item.name)}</div>
      <div class="card-sub">${time}</div>
    </div>
  `;
  return a;
}

function esc(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

function timeAgo(d) {
  const m = Math.floor((Date.now() - d) / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return d.toLocaleDateString('en-GB');
}

function render(list) {
  grid.innerHTML = '';
  const f = activeFilter === 'all' ? list : list.filter(h => h.category === activeFilter);
  if (!f.length) { emptyState.style.display = 'block'; return; }
  emptyState.style.display = 'none';
  f.forEach((h, i) => grid.appendChild(createCard(h, i)));
}

function setFilter(v) {
  activeFilter = v;
  filterBar.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.filter === v));
  render(allHighlights);
}

async function load(refresh = false) {
  try {
    statusDot.className = 'live-dot';
    statusText.textContent = refresh ? 'Refreshing' : 'Loading';
    if (refresh) refreshBtn.classList.add('spinning');
    if (refresh) await fetch('/api/refresh');
    const data = await (await fetch('/api/highlights')).json();

    allHighlights = data.highlights;
    dateDisplay.textContent = `${data.day} | ${data.date}`;
    statusDot.className = 'live-dot on';
    statusText.textContent = 'Live';
    highlightCount.textContent = `${data.count} highlights`;
    lastUpdatedEl.textContent = `Updated ${new Date(data.lastUpdated).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
    setFilter(activeFilter);
  } catch {
    statusDot.className = 'live-dot err';
    statusText.textContent = 'Error';
  } finally {
    refreshBtn.classList.remove('spinning');
  }
}

filterBar.addEventListener('click', e => { const t = e.target.closest('.tab'); if (t) setFilter(t.dataset.filter); });
refreshBtn.addEventListener('click', () => load(true));

load();
setInterval(() => load(true), 5 * 60 * 1000);
