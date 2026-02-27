/**
 * NEXUS REF SYSTEM — Application Logic
 *
 * Architecture:
 *   1. Fetch data/index.json → build sidebar navigation
 *   2. On sheet select → fetch data/<category>/<id>.json (lazy, cached)
 *   3. Render sheet view from JSON
 *
 * Adding a new sheet:
 *   1. Create data/<category>/<id>.json following the schema
 *   2. Add an entry to data/index.json
 *   That's it — the app picks it up automatically.
 */

'use strict';

/* ============================================================
   STATE
   ============================================================ */
const state = {
  /** @type {ManifestEntry[]} Full manifest */
  manifest: [],
  /** @type {string|null} Currently active sheet ID */
  activeId: null,
  /** @type {string} Current sidebar search query */
  searchQuery: '',
  /** @type {Map<string, SheetData>} In-memory cache for loaded sheets */
  cache: new Map(),
  /** @type {Set<string>} Collapsed category names */
  collapsedCategories: new Set(),
  /** @type {number} Sidebar width in pixels */
  sidebarWidth: 268,
  /** @type {boolean} Whether sidebar is minimized */
  sidebarMinimized: false,
};

/* ============================================================
   CONSTANTS & HELPERS
   ============================================================ */
const CATEGORY_ICONS = {
  'Version Control': '⎇',
  'Editor':          '✎',
  'Shell':           '$',
  'Language':        '{ }',
  'DevOps':          '⚡',
  'Web':             '◈',
  'Database':        '⊟',
  'Utilities':       '⚙',
};

/** Maps accent hex from manifest to a theme key */
function accentKey(hex) {
  if (!hex) return 'cyan';
  const map = {
    '#00ff9f': 'green',
    '#00d4ff': 'cyan',
    '#ff006e': 'magenta',
    '#ffb700': 'amber',
  };
  return map[hex.toLowerCase()] ?? 'cyan';
}

/**
 * Derive the section border color from sheet accent.
 * Returns a CSS value for --section-accent.
 */
function accentColor(accent) {
  const map = {
    green:   'var(--green)',
    cyan:    'var(--cyan)',
    magenta: 'var(--magenta)',
    amber:   'var(--amber)',
  };
  return map[accent] ?? 'var(--cyan)';
}

function countCommands(sheet) {
  if (!sheet.sections) return 0; // HTML sheets don't have sections
  return sheet.sections.reduce((acc, s) => acc + s.items.length, 0);
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ============================================================
   DATA LOADING
   ============================================================ */

/** Load manifest (data/index.json) once on startup */
async function loadManifest() {
  const res = await fetch('data/index.json');
  if (!res.ok) throw new Error(`Failed to load manifest: ${res.status}`);
  return res.json();
}

/** Lazy-load a sheet JSON with in-memory caching */
async function loadSheet(entry) {
  if (state.cache.has(entry.id)) return state.cache.get(entry.id);
  
  // For HTML files, return entry metadata directly (no fetch/parse needed)
  if (entry.type === 'html') {
    const htmlSheet = {
      id: entry.id,
      title: entry.title,
      description: entry.description,
      category: entry.category,
      icon: entry.icon,
      accent: entry.accent,
      tags: entry.tags,
      type: 'html',
      path: entry.path
    };
    state.cache.set(entry.id, htmlSheet);
    return htmlSheet;
  }
  
  const res = await fetch(entry.path);
  if (!res.ok) throw new Error(`Failed to load sheet "${entry.id}": ${res.status}`);
  const sheet = await res.json();
  state.cache.set(entry.id, sheet);
  return sheet;
}

/* ============================================================
   SIDEBAR RENDERING
   ============================================================ */

function buildSidebar() {
  const nav = document.getElementById('navList');
  if (!nav) return;

  nav.innerHTML = '';

  const q = state.searchQuery.toLowerCase();

  // Group entries by category
  const groups = {};
  for (const entry of state.manifest) {
    const match = !q ||
      entry.title.toLowerCase().includes(q) ||
      entry.category.toLowerCase().includes(q) ||
      entry.tags?.some(t => t.toLowerCase().includes(q));
    if (!match) continue;

    if (!groups[entry.category]) groups[entry.category] = [];
    groups[entry.category].push(entry);
  }

  if (Object.keys(groups).length === 0) {
    nav.innerHTML = '<div style="padding:1rem;font-size:0.75rem;color:var(--text-3);font-family:var(--font-code);text-align:center;">No results</div>';
    return;
  }

  for (const [category, entries] of Object.entries(groups)) {
    const isCollapsed = state.collapsedCategories.has(category);
    const chevron = isCollapsed ? '▸' : '▾';
    
    // Category label with collapse icon
    const catEl = document.createElement('div');
    catEl.className = 'nav-category';
    catEl.dataset.category = category;
    catEl.innerHTML = `
      <span class="nav-category-icon">${chevron}</span>
      <span class="nav-category-label">${esc(category)}</span>
    `;
    catEl.addEventListener('click', () => toggleCategory(category));
    nav.appendChild(catEl);

    // Items
    for (const entry of entries) {
      const cmdCount = state.cache.has(entry.id)
        ? countCommands(state.cache.get(entry.id))
        : '—';

      const item = document.createElement('div');
      item.className = 'nav-item' + (entry.id === state.activeId ? ' active' : '');
      item.dataset.id = entry.id;
      item.dataset.category = category;
      // Explicitly set display and visibility based on collapsed state
      item.style.display = isCollapsed ? 'none' : 'flex';
      item.style.visibility = isCollapsed ? 'hidden' : 'visible';
      item.innerHTML = `
        <div class="nav-item-icon">${esc(entry.icon)}</div>
        <div class="nav-item-body">
          <div class="nav-item-title">${esc(entry.title)}</div>
        </div>
        <div class="nav-item-count" data-count="${esc(entry.id)}">${cmdCount}</div>
      `;
      item.addEventListener('click', () => selectSheet(entry.id));
      nav.appendChild(item);
    }
  }
}

function toggleCategory(category) {
  if (state.collapsedCategories.has(category)) {
    state.collapsedCategories.delete(category);
  } else {
    state.collapsedCategories.add(category);
  }
  saveSidebarState();
  buildSidebar();
}

/** Update just the command count badges after a sheet loads */
function updateNavCount(id, count) {
  const el = document.querySelector(`[data-count="${id}"]`);
  if (el) el.textContent = count;
}

/* ============================================================
   TOPBAR
   ============================================================ */

function updateTopbar(entry, sheet) {
  const breadcrumb = document.getElementById('breadcrumb');
  const statSheets = document.getElementById('statSheets');
  const statCmds   = document.getElementById('statCmds');

  if (breadcrumb) {
    breadcrumb.innerHTML = `
      <span>${esc(entry.category)}</span>
      <span class="breadcrumb-sep">/</span>
      <span class="breadcrumb-active">${esc(entry.title)}</span>
    `;
  }

  if (sheet && statCmds) {
    if (entry.type === 'html') {
      statCmds.innerHTML = `<span>—</span> cmds`;
    } else {
      statCmds.innerHTML = `<span>${countCommands(sheet)}</span> cmds`;
    }
  }

  if (statSheets) {
    statSheets.innerHTML = `<span>${state.manifest.length}</span> sheets`;
  }
}

function resetTopbar() {
  const breadcrumb = document.getElementById('breadcrumb');
  const statSheets = document.getElementById('statSheets');
  const statCmds   = document.getElementById('statCmds');

  if (breadcrumb) breadcrumb.innerHTML = '<span>Select a sheet to begin</span>';
  if (statSheets) statSheets.innerHTML = `<span>${state.manifest.length}</span> sheets`;
  if (statCmds)   statCmds.innerHTML  = `<span>—</span> cmds`;
}

/* ============================================================
   SHEET RENDERING
   ============================================================ */

/** Render an HTML sheet in an iframe */
function renderHtmlSheet(entry, sheet) {
  const view      = document.getElementById('sheetView');
  const welcome   = document.getElementById('welcomeScreen');
  const body      = document.getElementById('sheetBody');
  const titleEl   = document.getElementById('sheetTitle');
  const iconEl    = document.getElementById('sheetIcon');
  const descEl    = document.getElementById('sheetDescription');
  const badgesEl  = document.getElementById('sheetBadges');
  const copyAllEl = document.getElementById('copyAllBtn');

  if (!view || !welcome) return;

  // Switch views
  welcome.style.display = 'none';
  view.classList.add('active');

  // Accent
  const accent = accentKey(entry.accent);
  view.dataset.accent = accent;

  // Glow color on header
  const headerGlow = document.querySelector('.sheet-header');
  if (headerGlow) headerGlow.style.setProperty('--glow-color', entry.accent || 'var(--cyan)');

  // Icon & title
  if (iconEl) {
    iconEl.textContent = entry.icon;
    iconEl.style.background = `${entry.accent}18`;
    iconEl.style.borderColor = `${entry.accent}30`;
  }
  if (titleEl) titleEl.textContent = sheet.title;
  if (descEl)  descEl.textContent  = sheet.description;

  // Badges - add "HTML Document" badge
  if (badgesEl) {
    badgesEl.innerHTML = `
      <span class="badge badge-category">${esc(entry.category)}</span>
      <span class="badge badge-tag">HTML Document</span>
      ${(sheet.tags || []).map(t => `<span class="badge badge-tag">#${esc(t)}</span>`).join('')}
    `;
  }

  // Hide copy-all button for HTML sheets
  if (copyAllEl) {
    copyAllEl.style.display = 'none';
  }

  // Handle sheet header visibility
  const sheetHeader = document.querySelector('.sheet-header');
  if (sheetHeader) {
    if (entry['show-sheet-header'] === false) {
      sheetHeader.classList.add('hidden');
    } else {
      sheetHeader.classList.remove('hidden');
    }
  }

  // Render iframe
  if (body) {
    body.innerHTML = `
      <div class="iframe-container">
        <iframe src="${esc(sheet.path)}" 
                title="${esc(sheet.title)}" 
                allow="clipboard-write" 
                loading="lazy"></iframe>
      </div>
    `;
  }

  // Scroll to top
  const contentEl = document.getElementById('content');
  if (contentEl) contentEl.scrollTop = 0;
}

function renderSheet(entry, sheet) {
  // Route HTML files to iframe renderer
  if (entry.type === 'html') {
    renderHtmlSheet(entry, sheet);
    return;
  }
  
  const view      = document.getElementById('sheetView');
  const welcome   = document.getElementById('welcomeScreen');
  const body      = document.getElementById('sheetBody');
  const titleEl   = document.getElementById('sheetTitle');
  const iconEl    = document.getElementById('sheetIcon');
  const descEl    = document.getElementById('sheetDescription');
  const badgesEl  = document.getElementById('sheetBadges');
  const copyAllEl = document.getElementById('copyAllBtn');

  if (!view || !welcome) return;

  // Switch views
  welcome.style.display = 'none';
  view.classList.add('active');

  // Accent
  const accent = accentKey(entry.accent);
  view.dataset.accent = accent;

  // Glow color on header
  const headerGlow = document.querySelector('.sheet-header');
  if (headerGlow) headerGlow.style.setProperty('--glow-color', entry.accent || 'var(--cyan)');

  // Icon & title
  if (iconEl) {
    iconEl.textContent = entry.icon;
    iconEl.style.background = `${entry.accent}18`;
    iconEl.style.borderColor = `${entry.accent}30`;
  }
  if (titleEl) titleEl.textContent = sheet.title;
  if (descEl)  descEl.textContent  = sheet.description;

  // Badges
  if (badgesEl) {
    badgesEl.innerHTML = `
      <span class="badge badge-category">${esc(entry.category)}</span>
      ${(sheet.tags || []).map(t => `<span class="badge badge-tag">#${esc(t)}</span>`).join('')}
    `;
  }

  // Copy-all button (show for JSON sheets)
  if (copyAllEl) {
    copyAllEl.style.display = 'flex';
    copyAllEl.onclick = () => copyAll(sheet, copyAllEl);
  }

  // Handle sheet header visibility
  const sheetHeader = document.querySelector('.sheet-header');
  if (sheetHeader) {
    if (entry['show-sheet-header'] === false) {
      sheetHeader.classList.add('hidden');
    } else {
      sheetHeader.classList.remove('hidden');
    }
  }

  // Sections
  if (body) {
    body.innerHTML = '';
    sheet.sections.forEach((section, idx) => {
      const card = document.createElement('div');
      card.className = 'section-card';
      card.style.animationDelay = `${idx * 55}ms`;
      card.style.setProperty('--section-accent', accentColor(accent));

      const rows = section.items.map(([cmd, desc]) => `
        <div class="cmd-row">
          <span class="cmd-command">${esc(cmd)}</span>
          <span class="cmd-desc">${esc(desc)}</span>
          <button class="cmd-copy" data-cmd="${esc(cmd)}" title="Copy command" aria-label="Copy: ${esc(cmd)}">
            <svg viewBox="0 0 24 24">
              <rect x="9" y="9" width="13" height="13" rx="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
          </button>
        </div>
      `).join('');

      card.innerHTML = `
        <div class="section-header">
          <span class="section-title">${esc(section.title)}</span>
          <span class="section-count">${section.items.length} cmds</span>
        </div>
        ${rows}
      `;
      body.appendChild(card);
    });

    // Delegate copy events
    body.addEventListener('click', handleCopyClick);
  }

  // Scroll to top
  const contentEl = document.getElementById('content');
  if (contentEl) contentEl.scrollTop = 0;
}

/* ============================================================
   COPY HANDLERS
   ============================================================ */

/** Event-delegated handler for copy buttons in the sheet body */
function handleCopyClick(e) {
  const btn = e.target.closest('.cmd-copy');
  if (!btn) return;
  e.stopPropagation();

  const cmd = btn.dataset.cmd;
  navigator.clipboard.writeText(cmd).then(() => {
    btn.classList.add('copied');
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    `;
    setTimeout(() => {
      btn.classList.remove('copied');
      btn.innerHTML = `
        <svg viewBox="0 0 24 24">
          <rect x="9" y="9" width="13" height="13" rx="2"/>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
      `;
    }, 1400);
  }).catch(() => {
    // Clipboard unavailable (HTTP / permissions)
    console.warn('Clipboard write failed for:', cmd);
  });
}

/** Copy all commands in the current sheet as formatted text */
function copyAll(sheet, btn) {
  const lines = [];
  lines.push(`# ${sheet.title} Cheat Sheet`);
  lines.push('');

  for (const section of sheet.sections) {
    lines.push(`## ${section.title}`);
    const maxLen = Math.max(...section.items.map(([c]) => c.length));
    for (const [cmd, desc] of section.items) {
      lines.push(`${cmd.padEnd(maxLen + 2)}# ${desc}`);
    }
    lines.push('');
  }

  navigator.clipboard.writeText(lines.join('\n')).then(() => {
    const orig = btn.textContent;
    btn.textContent = '✓ COPIED!';
    btn.style.background = 'rgba(0,255,159,0.1)';
    btn.style.borderColor = 'rgba(0,255,159,0.4)';
    btn.style.color = 'var(--green)';
    setTimeout(() => {
      btn.textContent = orig;
      btn.style.background = '';
      btn.style.borderColor = '';
      btn.style.color = '';
    }, 2000);
  });
}

/* ============================================================
   SHEET SELECTION
   ============================================================ */

async function selectSheet(id) {
  const entry = state.manifest.find(e => e.id === id);
  if (!entry) return;

  state.activeId = id;
  buildSidebar(); // re-render nav to update active state
  updateTopbar(entry, null);
  closeMobileSidebar();

  try {
    const sheet = await loadSheet(entry);

    // Update nav count after load
    updateNavCount(id, countCommands(sheet));
    buildSidebar(); // re-render with correct count
    updateTopbar(entry, sheet);
    renderSheet(entry, sheet);
  } catch (err) {
    console.error(err);
    showError(`Failed to load "${entry.title}": ${err.message}`);
  }
}

function showError(msg) {
  const content = document.getElementById('content');
  if (!content) return;
  content.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;height:100%;padding:2rem;">
      <div style="text-align:center;font-family:var(--font-code);color:var(--magenta);">
        <div style="font-size:1.5rem;margin-bottom:0.5rem;">⚠</div>
        <div style="font-size:0.8rem;">${esc(msg)}</div>
      </div>
    </div>
  `;
}

/* ============================================================
   WELCOME SCREEN STATS
   ============================================================ */

function updateWelcomeStats() {
  const statSheetCount = document.getElementById('welcomeSheetCount');
  const statCatCount   = document.getElementById('welcomeCatCount');

  if (statSheetCount) statSheetCount.textContent = state.manifest.length;

  if (statCatCount) {
    const cats = new Set(state.manifest.map(e => e.category));
    statCatCount.textContent = cats.size;
  }
}

/* ============================================================
   THEME
   ============================================================ */

function initTheme() {
  const saved = localStorage.getItem('nexus-theme') || 'dark';
  document.documentElement.dataset.theme = saved;
  updateThemeBtn(saved);
}

function toggleTheme() {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('nexus-theme', next);
  updateThemeBtn(next);
}

function updateThemeBtn(theme) {
  const btn  = document.getElementById('themeBtn');
  const icon = document.getElementById('themeIcon');
  const lbl  = document.getElementById('themeLabel');
  if (!btn) return;

  if (icon) icon.textContent = theme === 'dark' ? '☀' : '☾';
  if (lbl)  lbl.textContent  = theme === 'dark' ? 'Light' : 'Dark';
}

/* ============================================================
   SIDEBAR STATE PERSISTENCE
   ============================================================ */

function initSidebarState() {
  // Load sidebar width
  try {
    const savedWidth = localStorage.getItem('nexus-sidebar-width');
    if (savedWidth) {
      state.sidebarWidth = parseInt(savedWidth, 10);
      document.documentElement.style.setProperty('--sidebar-w', `${state.sidebarWidth}px`);
    }
  } catch (_) { /* ignore parse errors */ }
}

function saveSidebarState() {
  try {
    localStorage.setItem('nexus-sidebar-width', state.sidebarWidth.toString());
  } catch (_) { /* ignore storage errors */ }
}

/* ============================================================
   SIDEBAR RESIZE
   ============================================================ */

function initSidebarResize() {
  const handle = document.getElementById('sidebarResizeHandle');
  if (!handle) return;

  let isResizing = false;
  let startX = 0;
  let startWidth = 0;

  handle.addEventListener('mousedown', (e) => {
    isResizing = true;
    startX = e.clientX;
    startWidth = state.sidebarWidth;
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    
    const delta = e.clientX - startX;
    const newWidth = Math.max(180, Math.min(500, startWidth + delta));
    
    state.sidebarWidth = newWidth;
    document.documentElement.style.setProperty('--sidebar-w', `${newWidth}px`);
  });

  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      saveSidebarState();
    }
  });
}

/* ============================================================
   SIDEBAR MINIMIZE/MAXIMIZE
   ============================================================ */

function toggleSidebarMinimize() {
  state.sidebarMinimized = !state.sidebarMinimized;
  const sidebar = document.getElementById('sidebar');
  const btn = document.getElementById('sidebarToggleBtn');

  if (state.sidebarMinimized) {
    sidebar?.classList.add('minimized');
    if (btn) btn.innerHTML = '»';
  } else {
    sidebar?.classList.remove('minimized');
    
    if (btn) btn.innerHTML = '«';
    buildSidebar();
  }

  saveSidebarState();
}

/* ============================================================
   MOBILE SIDEBAR
   ============================================================ */

function openMobileSidebar() {
  document.getElementById('sidebar')?.classList.add('open');
  document.getElementById('sidebarOverlay')?.classList.add('visible');
}

function closeMobileSidebar() {
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebarOverlay')?.classList.remove('visible');
}

/* ============================================================
   KEYBOARD SHORTCUTS
   ============================================================ */

function initKeyboard() {
  document.addEventListener('keydown', (e) => {
    const search = document.getElementById('sidebarSearch');
    const active = document.activeElement;

    // / — focus search
    if (e.key === '/' && active !== search) {
      e.preventDefault();
      search?.focus();
      return;
    }

    // Esc — blur search / close mobile sidebar
    if (e.key === 'Escape') {
      if (active === search) {
        search.blur();
        return;
      }
      closeMobileSidebar();
    }

    // Arrow keys — navigate items when search is focused
    if (active === search && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      const items = [...document.querySelectorAll('.nav-item')];
      if (!items.length) return;
      const currentIdx = items.findIndex(i => i.dataset.id === state.activeId);
      let nextIdx = e.key === 'ArrowDown'
        ? Math.min(currentIdx + 1, items.length - 1)
        : Math.max(currentIdx - 1, 0);
      if (currentIdx === -1) nextIdx = 0;
      items[nextIdx]?.click();
    }

    // Enter — confirm selected item from keyboard
    if (active === search && e.key === 'Enter') {
      const items = [...document.querySelectorAll('.nav-item')];
      if (items.length === 1) items[0].click();
    }
  });
}

/* ============================================================
   PREFETCH & COUNT (background, non-blocking)
   Loads all sheets in the background to display total command
   count on the welcome screen.
   ============================================================ */

async function prefetchAndCountAll() {
  const el = document.getElementById('welcomeCmdCount');
  let total = 0;

  const promises = state.manifest.map(async (entry) => {
    try {
      const sheet = await loadSheet(entry);
      const cmdCount = countCommands(sheet);
      total += cmdCount;
      
      // Only show count badge for JSON sheets with commands
      if (entry.type !== 'html' && cmdCount > 0) {
        updateNavCount(entry.id, cmdCount);
      }
      
      if (el) el.textContent = total;
    } catch (_) { /* skip failed sheets */ }
  });

  await Promise.allSettled(promises);
  buildSidebar(); // refresh counts in nav
}

/* ============================================================
   BOOTSTRAP
   ============================================================ */

async function init() {
  initTheme();
  initKeyboard();
  initSidebarState();
  initSidebarResize();

  // Wire static event listeners
  document.getElementById('themeBtn')
    ?.addEventListener('click', toggleTheme);

  document.getElementById('menuBtn')
    ?.addEventListener('click', openMobileSidebar);

  document.getElementById('sidebarOverlay')
    ?.addEventListener('click', closeMobileSidebar);

  document.getElementById('sidebarSearch')
    ?.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      buildSidebar();
    });

  document.getElementById('sidebarToggleBtn')
    ?.addEventListener('click', toggleSidebarMinimize);

  // Reset topbar
  resetTopbar();

  // Load manifest
  try {
    state.manifest = await loadManifest();
    for (const entry of state.manifest) {
      state.collapsedCategories.add(entry.category);
    }
    buildSidebar();
    updateWelcomeStats();
    // Pre-warm first sheet silently so command count shows on welcome screen
    prefetchAndCountAll();
  } catch (err) {
    console.error('Failed to load manifest:', err);
    showError(`Could not load data/index.json — ${err.message}`);
  }
}

document.addEventListener('DOMContentLoaded', init);
