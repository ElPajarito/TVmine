/* TVmine — no-scroll hub: poster river + status panels */

// ---------- tiny seeded random (so each title always paints the same poster) ----------

function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- painted placeholder posters ----------

function paintedPoster(item) {
  const rnd = mulberry(hashSeed(item.id));
  const hue = Math.floor(rnd() * 360);
  const skyTop = `hsl(${hue}, 60%, 82%)`;
  const skyBot = `hsl(${(hue + 30) % 360}, 55%, 90%)`;
  const hillFar = `hsl(${(hue + 110) % 360}, 34%, 62%)`;
  const hillNear = `hsl(${(hue + 120) % 360}, 40%, 46%)`;
  const sunHue = (hue + 45) % 360;

  const w = 200, h = 300;
  const sunX = 40 + rnd() * 120;
  const sunY = 50 + rnd() * 80;
  const sunR = 16 + rnd() * 14;

  const farY = 170 + rnd() * 40;
  const nearY = 220 + rnd() * 40;
  const hill = (y, amp) => {
    const m1 = y - amp * (0.5 + rnd());
    const m2 = y + amp * (0.3 + rnd() * 0.7);
    return `M0 ${h} L0 ${y} Q ${w * 0.25} ${m1} ${w * 0.5} ${y} T ${w} ${m2} L${w} ${h} Z`;
  };

  let specks = "";
  for (let i = 0; i < 7; i++) {
    specks += `<circle cx="${rnd() * w}" cy="${rnd() * (h * 0.6)}" r="${1 + rnd() * 2}" fill="rgba(255,255,255,.75)"/>`;
  }

  const initials = item.title.split(/\s+/).slice(0, 2).map(s => s[0]).join("").toUpperCase();

  return `
  <svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${item.title} placeholder cover">
    <defs>
      <linearGradient id="sky-${item.id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${skyTop}"/><stop offset="1" stop-color="${skyBot}"/>
      </linearGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#sky-${item.id})"/>
    <circle cx="${sunX}" cy="${sunY}" r="${sunR}" fill="hsl(${sunHue}, 85%, 78%)"/>
    <circle cx="${sunX}" cy="${sunY}" r="${sunR * 1.9}" fill="hsl(${sunHue}, 85%, 78%)" opacity=".25"/>
    ${specks}
    <path d="${hill(farY, 30)}" fill="${hillFar}" opacity=".85"/>
    <path d="${hill(nearY, 26)}" fill="${hillNear}"/>
    <text x="${w / 2}" y="${h - 34}" text-anchor="middle"
      font-family="Limelight, Georgia, serif" font-size="40"
      fill="rgba(255,255,255,.92)" stroke="rgba(0,0,0,.12)" stroke-width="1">${initials}</text>
  </svg>`;
}

function posterMarkup(item) {
  return item.poster
    ? `<img src="${item.poster}" alt="${item.title} cover" loading="lazy">`
    : paintedPoster(item);
}

// ---------- card rendering ----------

const fmtDate = iso =>
  new Date(iso + "T00:00").toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });

function scoreBadge(item) {
  if (item.status === "watching") return ""; // no verdict until the story ends
  if (item.score == null) return `<div class="score-badge unrated" title="not rated yet">~</div>`;
  return `<div class="score-badge" title="my score">${item.score}</div>`;
}

function progressMarkup(item) {
  if (item.status !== "watching" || !item.progress) return "";
  const { season, episode, episodesInSeason } = item.progress;
  const pct = Math.round((episode / episodesInSeason) * 100);
  return `
    <div class="progress-wrap">
      <div class="progress-label"><span>S${season} · E${episode}/${episodesInSeason}</span><span>${pct}%</span></div>
      <div class="progress-track"><div class="progress-fill" data-pct="${pct}"></div></div>
    </div>`;
}

function cardMarkup(item, index) {
  const typeLabel = item.type === "tv" ? "TV" : "Film";
  return `
    <article class="card card-reveal" data-id="${item.id}" tabindex="0"
      style="--stagger:${(index % 12) * 0.045}s">
      ${scoreBadge(item)}
      <div class="poster">
        ${posterMarkup(item)}
        <div class="poster-veil">
          <div class="veil-row"><span class="chip">${typeLabel}</span><span class="chip">${item.year}</span></div>
          <div class="veil-row">${item.genres.slice(0, 2).map(g => `<span class="chip">${g}</span>`).join("")}</div>
        </div>
      </div>
      <div class="card-title">${item.title}</div>
      <div class="list-info">
        <div class="timeline-date">${item.status === "watched" ? "finished " : "added "}${fmtDate(item.date)}</div>
        <div class="list-title">${item.title}</div>
        <div class="list-meta">
          <span class="chip">${typeLabel}</span>
          <span class="chip">${item.year}</span>
          ${item.genres.map(g => `<span class="chip">${g}</span>`).join("")}
        </div>
        ${item.notes ? `<div class="list-notes">${item.notes}</div>` : ""}
      </div>
      ${progressMarkup(item)}
    </article>`;
}

// ---------- filtering + smart ordering ----------

const filterState = { query: "", type: "all", genres: new Set() };
let currentView = "grid";
let openStatus = null; // "watching" | "towatch" | "watched" | "search" | null

function matchesFilters(item) {
  if (filterState.type !== "all" && item.type !== filterState.type) return false;
  if (filterState.genres.size && !item.genres.some(g => filterState.genres.has(g))) return false;
  const q = filterState.query.trim().toLowerCase();
  if (q) {
    const haystack = (item.title + " " + item.genres.join(" ")).toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  return true;
}

// fixed smart order: watched by score, to-watch by date added, watching stays
// in data order; timeline view always sorts by date
function smartSort(items, status, view) {
  if (view === "timeline") return [...items].sort((a, b) => b.date.localeCompare(a.date));
  if (status === "watched") return [...items].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  if (status === "towatch") return [...items].sort((a, b) => b.date.localeCompare(a.date));
  return items;
}

const PANEL_META = {
  watching: { title: "Watching Now", empty: "nothing stirring here right now… 🍃", decor: "rays" },
  towatch:  { title: "To Watch",     empty: "no seeds match — try clearing a filter 🌱", decor: "sprouts" },
  watched:  { title: "Watched",      empty: "the meadow is quiet — nothing matches 🌾", decor: "leaves" },
  search:   { title: "Search",       empty: "nothing in the garden matches… 🔍", decor: "" }
};

// ---------- status panel ----------

const panel = document.getElementById("statusPanel");
const panelCard = document.getElementById("panelCard");
const panelTitle = document.getElementById("panelTitle");
const panelDecor = document.getElementById("panelDecor");
const panelCollection = document.getElementById("panelCollection");
const panelBody = document.getElementById("panelBody");

function renderPanelContent() {
  if (!openStatus) return;
  const pool = openStatus === "search" ? LIBRARY : LIBRARY.filter(x => x.status === openStatus);
  const items = smartSort(pool.filter(matchesFilters), openStatus, currentView);
  panelCollection.innerHTML = items.length
    ? items.map(cardMarkup).join("")
    : `<div class="empty-note">${PANEL_META[openStatus].empty}</div>`;
  panelCollection.className = "collection" + (currentView !== "grid" ? ` view-${currentView}` : "");
  requestAnimationFrame(() => requestAnimationFrame(() => {
    panelCollection.querySelectorAll(".card-reveal").forEach(c => c.classList.add("shown"));
    panelCollection.querySelectorAll(".progress-fill").forEach(f => { f.style.width = f.dataset.pct + "%"; });
  }));
}

function decorMarkup(kind) {
  if (kind === "leaves") {
    const glyphs = ["🍂", "🍁", "🍃"];
    let html = "";
    for (let i = 0; i < 7; i++) {
      html += `<span class="leaf-fall" style="
        left:${5 + Math.random() * 90}%;
        --sway:${(Math.random() * 140 - 70).toFixed(0)}px;
        animation-duration:${9 + Math.random() * 9}s;
        animation-delay:-${Math.random() * 14}s;">${glyphs[i % 3]}</span>`;
    }
    return html;
  }
  if (kind === "sprouts") return "🌱&nbsp;&nbsp;🌱&nbsp;&nbsp;🌱";
  return "";
}

function openPanel(status) {
  openStatus = status;
  const meta = PANEL_META[status];
  panelTitle.textContent = status === "search"
    ? `Search “${filterState.query.trim()}”` : meta.title;
  panelCard.className = `panel-card band-${status}`;
  panelDecor.className = `band-decor ${meta.decor}`;
  panelDecor.innerHTML = decorMarkup(meta.decor);
  renderPanelContent();
  panelBody.scrollTop = 0;
  panel.hidden = false;
}

function closePanel() {
  panel.hidden = true;
  openStatus = null;
}

function initPanel() {
  document.querySelectorAll(".hub-btn").forEach(btn =>
    btn.addEventListener("click", () => openPanel(btn.dataset.status)));
  document.getElementById("panelClose").addEventListener("click", closePanel);
  document.getElementById("panelBackdrop").addEventListener("click", closePanel);
}

// ---------- hub: counts + watching strip ----------

function renderHub() {
  const count = s => LIBRARY.filter(x => x.status === s).length;
  document.getElementById("countTowatch").textContent = count("towatch");
  document.getElementById("countWatched").textContent = count("watched");
  const rated = LIBRARY.filter(x => x.status === "watched" && x.score != null);
  if (rated.length) {
    const avg = (rated.reduce((s, x) => s + x.score, 0) / rated.length).toFixed(1);
    document.getElementById("watchedSub").textContent = `avg score ${avg}`;
  }

  const watching = LIBRARY.filter(x => x.status === "watching");
  const strip = document.getElementById("watchStrip");
  strip.innerHTML = watching.length
    ? `<span class="strip-label">watching now</span>` + watching.map(item => {
        const p = item.progress;
        const pct = p ? Math.round((p.episode / p.episodesInSeason) * 100) : 0;
        const ep = p ? `S${p.season} · E${p.episode}/${p.episodesInSeason}` : "";
        return `
          <button class="strip-item" data-id="${item.id}" title="${item.title}">
            <div class="strip-poster">${posterMarkup(item)}</div>
            ${p ? `<div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
                   <span class="strip-ep">${ep}</span>` : ""}
          </button>`;
      }).join("")
    : "";
}

// ---------- poster river ----------

function buildRiver() {
  const host = document.getElementById("river");
  if (!LIBRARY.length) { host.innerHTML = ""; return; }
  let items = [...LIBRARY].sort((a, b) => hashSeed(a.id) - hashSeed(b.id));
  while (items.length < 9) items = items.concat(items);
  const lanes = [[], [], []];
  items.forEach((item, i) => lanes[i % 3].push(item));

  host.innerHTML = lanes.map((lane, i) => {
    while (lane.length && lane.length < 8) lane = lane.concat(lane);
    const cards = lane.map(item =>
      `<div class="river-card" data-id="${item.id}" title="${item.title}">${posterMarkup(item)}</div>`
    ).join("");
    const dur = Math.max(30, lane.length * 7);
    return `<div class="lane ${i === 1 ? "rev" : ""}" style="--dur:${dur + i * 6}s">
      <div class="lane-track">${cards}${cards}</div>
    </div>`;
  }).join("");
}

// ---------- themes ----------

const THEMES = ["light", "dark"];

function applyTheme(name, persist) {
  document.documentElement.dataset.theme = name;
  if (persist) {
    try { localStorage.setItem("tvmine-theme", name); } catch (e) { /* private mode */ }
  }
}

function initThemes() {
  let saved = null;
  try { saved = localStorage.getItem("tvmine-theme"); } catch (e) { /* ignore */ }
  if (!THEMES.includes(saved)) {
    // first visit (or a stale old theme name): match the device
    saved = window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark" : "light";
  }
  applyTheme(saved, false);
  document.getElementById("themeToggle").addEventListener("click", () =>
    applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark", true));
}

// ---------- ambience ----------

function spawnStars() {
  const host = document.getElementById("stars");
  let html = "";
  for (let i = 0; i < 70; i++) {
    const size = 1 + Math.random() * 2.4;
    html += `<div class="star" style="
      left:${Math.random() * 100}%; top:${Math.random() * 85}%;
      width:${size}px; height:${size}px;
      animation-duration:${1.6 + Math.random() * 3}s;
      animation-delay:-${Math.random() * 4}s;"></div>`;
  }
  host.innerHTML = html;
}

function spawnSprites() {
  const host = document.getElementById("sprites");
  const n = window.innerWidth < 720 ? 10 : 18;
  let html = "";
  for (let i = 0; i < n; i++) {
    const size = 4 + Math.random() * 8;
    html += `<div class="sprite" style="
      left:${Math.random() * 100}vw;
      width:${size}px; height:${size}px;
      --sway:${(Math.random() * 160 - 80).toFixed(0)}px;
      animation-duration:${14 + Math.random() * 18}s;
      animation-delay:-${Math.random() * 30}s;"></div>`;
  }
  host.innerHTML = html;
}

// ---------- filters (inside the panel) + search (topbar) ----------

function initFilters() {
  const genres = [...new Set(LIBRARY.flatMap(x => x.genres))].sort();
  const host = document.getElementById("genreChips");
  host.innerHTML = genres.map(g => `<button class="genre-chip">${g}</button>`).join("");
  host.addEventListener("click", e => {
    const chip = e.target.closest(".genre-chip");
    if (!chip) return;
    const g = chip.textContent;
    if (filterState.genres.has(g)) { filterState.genres.delete(g); chip.classList.remove("active"); }
    else { filterState.genres.add(g); chip.classList.add("active"); }
    renderPanelContent();
  });

  document.querySelectorAll(".pill").forEach(pill => {
    pill.addEventListener("click", () => {
      document.querySelectorAll(".pill").forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      filterState.type = pill.dataset.type;
      renderPanelContent();
    });
  });

  document.getElementById("searchBox").addEventListener("input", e => {
    filterState.query = e.target.value;
    if (filterState.query.trim()) {
      if (!openStatus) openPanel("search");
      else if (openStatus === "search") {
        panelTitle.textContent = `Search “${filterState.query.trim()}”`;
        renderPanelContent();
      } else renderPanelContent();
    } else if (openStatus === "search") {
      closePanel();
    } else if (openStatus) {
      renderPanelContent();
    }
  });
}

// ---------- view switcher ----------

function initViewSwitcher() {
  document.querySelectorAll(".view-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".view-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentView = btn.dataset.view;
      renderPanelContent();
    });
  });
}

// ---------- detail modal ----------

const modal = document.getElementById("modal");
const modalBody = document.getElementById("modalBody");

function openModal(item) {
  const typeLabel = item.type === "tv" ? "TV series" : "Movie";
  modalBody.innerHTML = `
    <div class="modal-poster">${posterMarkup(item)}</div>
    <div class="modal-info">
      <div class="modal-title">${item.title}</div>
      <div class="modal-meta">
        <span class="chip">${typeLabel}</span>
        <span class="chip">${item.year}</span>
        ${item.genres.map(g => `<span class="chip">${g}</span>`).join("")}
      </div>
      ${item.status === "watching"
        ? ""
        : item.score != null
          ? `<div class="modal-score"><b>${item.score}</b> / 10</div>`
          : `<div class="modal-score">not rated yet</div>`}
      ${progressMarkup(item)}
      <p class="modal-synopsis">${item.synopsis}</p>
      ${item.notes ? `<div class="modal-notes">${item.notes}</div>` : ""}
      <div class="timeline-date">${item.status === "watched" ? "finished " : "added "}${fmtDate(item.date)}</div>
    </div>`;
  modal.hidden = false;
  modalBody.querySelectorAll(".progress-fill").forEach(f => {
    requestAnimationFrame(() => { f.style.width = f.dataset.pct + "%"; });
  });
}

function closeModal() { modal.hidden = true; }

function initModal() {
  document.addEventListener("click", e => {
    const card = e.target.closest(".card, .river-card, .strip-item");
    if (card) {
      const item = LIBRARY.find(x => x.id === card.dataset.id);
      if (item) openModal(item);
    }
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      if (!modal.hidden) closeModal();
      else if (!panel.hidden) closePanel();
    }
    if (e.key === "Enter" && document.activeElement?.classList.contains("card")) {
      const item = LIBRARY.find(x => x.id === document.activeElement.dataset.id);
      if (item) openModal(item);
    }
  });
  modal.querySelector(".modal-backdrop").addEventListener("click", closeModal);
  modal.querySelector(".modal-close").addEventListener("click", closeModal);
}

// ---------- boot ----------

initThemes();
buildRiver();
renderHub();
spawnSprites();
spawnStars();
initPanel();
initViewSwitcher();
initFilters();
initModal();
