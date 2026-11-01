"use strict";

/* ------------------------------------------------------------------ *
 * Config
 * ------------------------------------------------------------------ */
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];
const NOMINATIM = "https://nominatim.openstreetmap.org";
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // re-use nearby results for 12h
const RECENT_DAYS = 7; // "avoid recent" skips places picked in the last week
const PICK_COUNT = 3;

const USE_MILES = /-(US|GB|LR|MM)$/i.test(navigator.language || "");
const RADII = USE_MILES
  ? [0.5, 1, 2, 5].map((mi) => ({ label: `${mi} mi`, meters: mi * 1609.34 }))
  : [1, 2, 3, 8].map((km) => ({ label: `${km} km`, meters: km * 1000 }));

/* ------------------------------------------------------------------ *
 * Storage (never throws; private mode / blocked storage just won't persist)
 * ------------------------------------------------------------------ */
const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem("ds:" + key);
      return v == null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem("ds:" + key, JSON.stringify(value));
    } catch {
      /* ignore quota / privacy errors */
    }
  },
};

const state = {
  location: store.get("location", null), // { lat, lon, label }
  radiusIdx: clampIdx(store.get("radiusIdx", 2)),
  disabled: new Set(store.get("disabled", ["other"])),
  avoidRecent: store.get("avoidRecent", true),
  history: store.get("history", []), // [{ id, name, category, lat, lon, date }]
  restaurants: [],
  status: "idle", // idle | loading | ready | error
  error: "",
  picks: Array(PICK_COUNT).fill(null),
  locked: Array(PICK_COUNT).fill(false),
  view: "shuffle",
  shuffling: false,
};

function clampIdx(i) {
  return Number.isInteger(i) && i >= 0 && i < RADII.length ? i : 2;
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */
const $ = (sel) => document.querySelector(sel);

/** Tiny DOM builder. Text children are always inserted as text (no HTML injection). */
function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "style") el.style.cssText = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

function shuffled(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function formatDistance(m) {
  if (USE_MILES) {
    const mi = m / 1609.34;
    return mi < 0.1 ? "< 0.1 mi" : `${mi.toFixed(1)} mi`;
  }
  return m < 1000 ? `${Math.max(10, Math.round(m / 10) * 10)} m` : `${(m / 1000).toFixed(1)} km`;
}

function titleCase(s) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function safeUrl(url) {
  if (!url) return null;
  const u = /^https?:\/\//i.test(url) ? url : "https://" + url;
  try {
    const parsed = new URL(u);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : null;
  } catch {
    return null;
  }
}

const IS_APPLE = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

function directionsUrl(r) {
  return IS_APPLE
    ? `https://maps.apple.com/?daddr=${r.lat},${r.lon}&q=${encodeURIComponent(r.name)}`
    : `https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lon}`;
}

async function fetchWithTimeout(url, options = {}, ms = 25000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

let toastTimer;
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
}

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ------------------------------------------------------------------ *
 * Data: location + restaurants
 * ------------------------------------------------------------------ */
function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Your browser doesn't support location."));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve(p.coords),
      (err) =>
        reject(
          new Error(
            err.code === 1
              ? "Location permission was denied. You can search for a place instead."
              : "Couldn't get your location. Try again or search for a place."
          )
        ),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 5 * 60 * 1000 }
    );
  });
}

async function reverseGeocode(lat, lon) {
  try {
    const res = await fetchWithTimeout(
      `${NOMINATIM}/reverse?format=jsonv2&zoom=16&lat=${lat}&lon=${lon}`,
      { headers: { Accept: "application/json" } },
      8000
    );
    const j = await res.json();
    const a = j.address || {};
    return a.neighbourhood || a.suburb || a.city_district || a.town || a.city || a.village || "Current location";
  } catch {
    return "Current location";
  }
}

async function searchPlaces(query) {
  const res = await fetchWithTimeout(
    `${NOMINATIM}/search?format=jsonv2&limit=5&q=${encodeURIComponent(query)}`,
    { headers: { Accept: "application/json" } },
    10000
  );
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  const list = await res.json();
  return list.map((p) => ({
    lat: Number(p.lat),
    lon: Number(p.lon),
    label: p.display_name.split(",").slice(0, 2).join(",").trim(),
    full: p.display_name,
  }));
}

function overpassQuery(lat, lon, radius) {
  return (
    `[out:json][timeout:25];` +
    `nwr["amenity"~"^(restaurant|fast_food)$"]["name"](around:${Math.round(radius)},${lat.toFixed(5)},${lon.toFixed(5)});` +
    `out center tags;`
  );
}

function parseElements(elements, lat, lon) {
  const seen = new Set();
  const out = [];
  for (const el of elements) {
    const t = el.tags || {};
    const plat = el.lat ?? el.center?.lat;
    const plon = el.lon ?? el.center?.lon;
    if (!t.name || plat == null || plon == null) continue;
    const key = `${t.name.toLowerCase()}|${plat.toFixed(3)}|${plon.toFixed(3)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const cuisines = parseCuisines(t.cuisine);
    const street = [t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" ");
    out.push({
      id: `${el.type}/${el.id}`,
      name: t.name,
      lat: plat,
      lon: plon,
      category: categorize(t),
      cuisine: cuisines.map(titleCase).join(", "),
      address: street,
      phone: t.phone || t["contact:phone"] || "",
      website: safeUrl(t.website || t["contact:website"]),
      hours: t.opening_hours || "",
      distance: distanceMeters(lat, lon, plat, plon),
    });
  }
  return out.sort((a, b) => a.distance - b.distance);
}

async function fetchRestaurants(lat, lon, radius) {
  const body = new URLSearchParams({ data: overpassQuery(lat, lon, radius) });
  let lastErr;
  for (const url of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetchWithTimeout(url, { method: "POST", body }, 30000);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return parseElements(json.elements || [], lat, lon);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("No restaurant service reachable");
}

const cacheKey = (loc, radius) => `${loc.lat.toFixed(3)},${loc.lon.toFixed(3)},${Math.round(radius)}`;

async function loadRestaurants({ force = false } = {}) {
  const loc = state.location;
  if (!loc) return;
  const radius = RADII[state.radiusIdx].meters;
  const key = cacheKey(loc, radius);
  const cached = store.get("cache", null);

  state.picks = Array(PICK_COUNT).fill(null);
  state.locked = Array(PICK_COUNT).fill(false);

  if (!force && cached && cached.key === key && Date.now() - cached.time < CACHE_TTL_MS) {
    state.restaurants = cached.list;
    state.status = "ready";
    render();
    return;
  }

  state.status = "loading";
  state.restaurants = [];
  render();
  try {
    const list = await fetchRestaurants(loc.lat, loc.lon, radius);
    // Ignore a stale response if the user changed location/radius meanwhile.
    if (cacheKey(state.location, RADII[state.radiusIdx].meters) !== key) return;
    state.restaurants = list;
    state.status = "ready";
    store.set("cache", { key, time: Date.now(), list });
  } catch (e) {
    console.error(e);
    state.status = "error";
    state.error = "Couldn't reach the restaurant map service. Check your connection and try again.";
  }
  render();
}

async function setLocation(loc) {
  state.location = loc;
  store.set("location", loc);
  closeSheet();
  state.view = "shuffle";
  await loadRestaurants();
}

async function useMyLocation(btn) {
  const original = btn?.textContent;
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Locating…";
  }
  $("#sheetError").textContent = "";
  $("#setupError").textContent = "";
  try {
    const c = await getPosition();
    const loc = { lat: c.latitude, lon: c.longitude, label: "Current location" };
    setLocation(loc);
    reverseGeocode(loc.lat, loc.lon).then((label) => {
      if (state.location === loc) {
        loc.label = label;
        store.set("location", loc);
        renderLocation();
      }
    });
  } catch (e) {
    $("#sheetError").textContent = e.message;
    $("#setupError").textContent = e.message;
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = original;
    }
  }
}

/* ------------------------------------------------------------------ *
 * Shuffle logic
 * ------------------------------------------------------------------ */
function recentIds() {
  const cutoff = Date.now() - RECENT_DAYS * 86400000;
  return new Set(state.history.filter((h) => h.date >= cutoff).map((h) => h.id));
}

/** Map of categoryId -> restaurants, honoring category toggles and "avoid recent". */
function poolByCategory() {
  const recent = state.avoidRecent ? recentIds() : new Set();
  const map = new Map();
  for (const r of state.restaurants) {
    if (state.disabled.has(r.category)) continue;
    if (!map.has(r.category)) map.set(r.category, []);
    map.get(r.category).push(r);
  }
  for (const [cat, list] of map) {
    const fresh = list.filter((r) => !recent.has(r.id));
    if (fresh.length) map.set(cat, fresh); // fall back to all if every place is "recent"
  }
  return map;
}

/** Pick one restaurant from each of up to 3 different categories. Locked cards stay. */
function computePicks() {
  const pool = poolByCategory();
  const next = state.picks.map((p, i) => (state.locked[i] ? p : null));
  const usedCats = new Set(next.filter(Boolean).map((p) => p.category));
  const prevIds = new Set(state.picks.filter(Boolean).map((p) => p.id));
  const prevCats = new Set(state.picks.filter((p, i) => p && !state.locked[i]).map((p) => p.category));

  // Prefer categories we didn't just show, so repeated shuffles feel varied.
  const cats = [...pool.keys()].filter((c) => !usedCats.has(c));
  const ordered = [...shuffled(cats.filter((c) => !prevCats.has(c))), ...shuffled(cats.filter((c) => prevCats.has(c)))];

  for (let i = 0; i < PICK_COUNT; i++) {
    if (next[i]) continue;
    const cat = ordered.shift();
    if (!cat) break;
    const list = pool.get(cat);
    const fresh = list.filter((r) => !prevIds.has(r.id));
    next[i] = randomItem(fresh.length ? fresh : list);
  }
  return next;
}

function shuffle() {
  if (state.shuffling || state.status !== "ready") return;
  const next = computePicks();
  const changing = next.map((p, i) => !state.locked[i]);
  state.picks = next;
  state.locked = state.locked.map((l, i) => l && !!next[i]);

  if (reducedMotion()) {
    renderCards();
    return;
  }

  // Slot-machine style: flicker random names, then settle card by card.
  state.shuffling = true;
  $("#shuffleBtn").disabled = true;
  const names = state.restaurants.map((r) => r.name);
  const cards = [...document.querySelectorAll(".card")];
  const tick = setInterval(() => {
    cards.forEach((card, i) => {
      if (!changing[i] || card.dataset.settled) return;
      const nameEl = card.querySelector(".card-name");
      if (nameEl) nameEl.textContent = randomItem(names);
      card.classList.add("rolling");
    });
  }, 70);

  changing.forEach((isChanging, i) => {
    if (!isChanging) return;
    setTimeout(() => {
      const fresh = renderCard(i);
      const old = document.querySelector(`.card[data-slot="${i}"]`);
      old?.replaceWith(fresh);
      fresh.dataset.settled = "1";
      fresh.classList.add("pop");
    }, 550 + i * 260);
  });

  setTimeout(() => {
    clearInterval(tick);
    state.shuffling = false;
    renderCards();
    renderStatus();
    navigator.vibrate?.(15);
  }, 550 + (PICK_COUNT - 1) * 260 + 80);
}

function choose(r) {
  const today = new Date().toDateString();
  state.history = state.history.filter((h) => !(h.id === r.id && new Date(h.date).toDateString() === today));
  state.history.unshift({ id: r.id, name: r.name, category: r.category, lat: r.lat, lon: r.lon, date: Date.now() });
  state.history = state.history.slice(0, 100);
  store.set("history", state.history);
  toast(`Enjoy dinner at ${r.name}! 🍽️`);
  renderHistory();
}

/* ------------------------------------------------------------------ *
 * Rendering
 * ------------------------------------------------------------------ */
function render() {
  const hasLoc = !!state.location;
  $("#view-setup").hidden = hasLoc;
  for (const v of ["shuffle", "browse", "history"]) {
    $(`#view-${v}`).hidden = !hasLoc || state.view !== v;
  }
  $(".tabbar").hidden = !hasLoc;
  $(".shuffle-bar").hidden = !hasLoc || state.view !== "shuffle";
  document.querySelectorAll(".tab").forEach((t) => t.setAttribute("aria-current", t.dataset.view === state.view ? "page" : "false"));

  renderLocation();
  renderStatus();
  renderChips();
  renderCards();
  renderBrowse();
  renderHistory();
}

function renderLocation() {
  $("#locationLabel").textContent = state.location
    ? `${state.location.label} · ${RADII[state.radiusIdx].label}`
    : "Set location";
}

function renderStatus() {
  const el = $("#status");
  el.replaceChildren();
  el.className = "status";
  const btn = $("#shuffleBtn");
  btn.disabled = state.status !== "ready" || state.shuffling;

  if (state.status === "loading") {
    el.append(h("span", { class: "spinner", "aria-hidden": "true" }), "Finding restaurants nearby…");
  } else if (state.status === "error") {
    el.classList.add("error");
    el.append(state.error, " ", h("button", { class: "link", type: "button", onclick: () => loadRestaurants({ force: true }) }, "Retry"));
  } else if (state.status === "ready") {
    const pool = poolByCategory();
    const total = [...pool.values()].reduce((n, l) => n + l.length, 0);
    if (!state.restaurants.length) {
      el.append(`No restaurants found within ${RADII[state.radiusIdx].label}. `,
        h("button", { class: "link", type: "button", onclick: openSheet }, "Try a bigger radius"));
      btn.disabled = true;
    } else {
      el.append(`${state.restaurants.length} restaurants nearby · ${pool.size} categories in the mix`);
      if (!total) btn.disabled = true;
    }
  }
}

function renderChips() {
  const wrap = $("#chips");
  wrap.replaceChildren();
  const counts = new Map();
  for (const r of state.restaurants) counts.set(r.category, (counts.get(r.category) || 0) + 1);

  for (const c of CATEGORIES) {
    const n = counts.get(c.id) || 0;
    const on = !state.disabled.has(c.id);
    wrap.append(
      h("button", {
        type: "button",
        class: "chip" + (on ? " on" : "") + (n ? "" : " empty"),
        "aria-pressed": String(on),
        style: `--cat:${c.color}`,
        onclick: () => {
          on ? state.disabled.add(c.id) : state.disabled.delete(c.id);
          store.set("disabled", [...state.disabled]);
          renderChips();
          renderStatus();
        },
      }, h("span", { "aria-hidden": "true" }, c.emoji), ` ${c.label}`, h("span", { class: "count" }, n))
    );
  }
}

function renderCards() {
  const wrap = $("#cards");
  wrap.replaceChildren(...state.picks.map((_, i) => renderCard(i)));
}

function renderCard(i) {
  const r = state.picks[i];
  if (!r) {
    const ready = state.status === "ready" && state.picks.some(Boolean);
    return h("article", { class: "card placeholder", "data-slot": i },
      h("div", { class: "card-emoji", "aria-hidden": "true" }, ready ? "🤷" : "?"),
      h("div", { class: "card-body" },
        h("p", { class: "card-name" }, ready ? "Not enough categories" : `Option ${i + 1}`),
        h("p", { class: "card-meta" }, ready
          ? "Turn on more categories or widen the radius."
          : "Tap Shuffle to get 3 picks from different cuisines.")));
  }
  const cat = CATEGORY_BY_ID[r.category];
  const locked = state.locked[i];
  const cuisine = r.cuisine && r.cuisine !== cat.label ? r.cuisine : null;
  const details = [formatDistance(r.distance), cuisine, r.address].filter(Boolean).join(" · ");

  return h("article", { class: "card" + (locked ? " locked" : ""), "data-slot": i, style: `--cat:${cat.color}` },
    h("div", { class: "card-emoji", "aria-hidden": "true" }, cat.emoji),
    h("div", { class: "card-body" },
      h("p", { class: "card-cat" }, cat.label),
      h("h3", { class: "card-name" }, r.name),
      h("p", { class: "card-meta" }, details),
      r.hours && h("p", { class: "card-meta hours", title: r.hours }, "🕒 ", r.hours),
      h("div", { class: "card-actions" },
        h("a", { class: "btn small primary", href: directionsUrl(r), target: "_blank", rel: "noopener", onclick: () => choose(r) }, "Let's go"),
        r.phone && h("a", { class: "btn small", href: `tel:${r.phone.split(/[;,]/)[0].replace(/[^\d+]/g, "")}` }, "Call"),
        r.website && h("a", { class: "btn small", href: r.website, target: "_blank", rel: "noopener" }, "Website"))),
    h("button", {
      type: "button",
      class: "lock" + (locked ? " active" : ""),
      "aria-pressed": String(locked),
      "aria-label": locked ? "Unlock this pick" : "Keep this pick when reshuffling",
      title: locked ? "Unlock" : "Keep this one",
      onclick: () => {
        state.locked[i] = !state.locked[i];
        renderCards();
      },
    }, locked ? "🔒" : "🔓"));
}

function renderBrowse() {
  const wrap = $("#browseList");
  wrap.replaceChildren();
  if (state.status !== "ready") {
    wrap.append(h("p", { class: "muted" }, state.status === "loading" ? "Loading…" : "Nothing to show yet."));
    return;
  }
  const groups = new Map();
  for (const r of state.restaurants) {
    if (!groups.has(r.category)) groups.set(r.category, []);
    groups.get(r.category).push(r);
  }
  const ordered = CATEGORIES.filter((c) => groups.has(c.id));
  if (!ordered.length) wrap.append(h("p", { class: "muted" }, "No restaurants found nearby."));
  for (const c of ordered) {
    const list = groups.get(c.id);
    wrap.append(
      h("details", { class: "group", style: `--cat:${c.color}` },
        h("summary", null, h("span", { "aria-hidden": "true" }, c.emoji), ` ${c.label}`, h("span", { class: "count" }, list.length)),
        h("ul", { class: "rows" },
          list.map((r) =>
            h("li", null,
              h("a", { href: directionsUrl(r), target: "_blank", rel: "noopener" },
                h("span", { class: "row-name" }, r.name),
                h("span", { class: "row-meta" }, [r.cuisine, formatDistance(r.distance)].filter(Boolean).join(" · ")))))))
    );
  }
}

function renderHistory() {
  const list = $("#historyList");
  list.replaceChildren();
  $("#avoidRecent").checked = state.avoidRecent;
  if (!state.history.length) {
    list.append(h("li", { class: "muted" }, "No dinners yet. Tap “Let's go” on a pick and it shows up here."));
    return;
  }
  const fmt = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" });
  for (const item of state.history) {
    const cat = CATEGORY_BY_ID[item.category] || CATEGORY_BY_ID.other;
    list.append(
      h("li", { class: "history-row", style: `--cat:${cat.color}` },
        h("span", { class: "dot", "aria-hidden": "true" }, cat.emoji),
        h("span", { class: "row-name" }, item.name),
        h("span", { class: "row-meta" }, fmt.format(new Date(item.date))))
    );
  }
}

/* ------------------------------------------------------------------ *
 * Location sheet
 * ------------------------------------------------------------------ */
function openSheet() {
  renderRadius();
  $("#sheetError").textContent = "";
  $("#searchResults").replaceChildren();
  const dlg = $("#locationSheet");
  if (!dlg.open) dlg.showModal();
}

function closeSheet() {
  const dlg = $("#locationSheet");
  if (dlg.open) dlg.close();
}

function renderRadius() {
  const wrap = $("#radiusChips");
  wrap.replaceChildren(
    ...RADII.map((r, i) =>
      h("button", {
        type: "button",
        class: "chip" + (i === state.radiusIdx ? " on" : ""),
        "aria-pressed": String(i === state.radiusIdx),
        onclick: () => {
          if (i === state.radiusIdx) return;
          state.radiusIdx = i;
          store.set("radiusIdx", i);
          renderRadius();
          renderLocation();
          if (state.location) loadRestaurants();
        },
      }, r.label))
  );
}

async function onSearch(e) {
  e.preventDefault();
  const q = $("#searchInput").value.trim();
  const out = $("#searchResults");
  $("#sheetError").textContent = "";
  if (!q) return;
  out.replaceChildren(h("li", { class: "muted" }, "Searching…"));
  try {
    const results = await searchPlaces(q);
    out.replaceChildren();
    if (!results.length) out.append(h("li", { class: "muted" }, "No places found. Try a city, neighborhood, or address."));
    for (const p of results) {
      out.append(h("li", null, h("button", { type: "button", class: "result", onclick: () => setLocation({ lat: p.lat, lon: p.lon, label: p.label }) },
        h("span", { class: "row-name" }, p.label), h("span", { class: "row-meta" }, p.full))));
    }
  } catch (err) {
    out.replaceChildren();
    $("#sheetError").textContent = "Search didn't work. Check your connection and try again.";
  }
}

/* ------------------------------------------------------------------ *
 * Wire up
 * ------------------------------------------------------------------ */
function init() {
  $("#shuffleBtn").addEventListener("click", shuffle);
  $("#locationPill").addEventListener("click", openSheet);
  $("#setupLocate").addEventListener("click", (e) => useMyLocation(e.currentTarget));
  $("#setupSearch").addEventListener("click", () => {
    openSheet();
    $("#searchInput").focus();
  });
  $("#sheetLocate").addEventListener("click", (e) => useMyLocation(e.currentTarget));
  $("#sheetClose").addEventListener("click", closeSheet);
  $("#searchForm").addEventListener("submit", onSearch);
  $("#locationSheet").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeSheet(); // tap on backdrop
  });
  $("#refreshBtn").addEventListener("click", () => loadRestaurants({ force: true }));
  $("#allOn").addEventListener("click", () => {
    state.disabled.clear();
    store.set("disabled", []);
    renderChips();
    renderStatus();
  });
  $("#allOff").addEventListener("click", () => {
    CATEGORIES.forEach((c) => state.disabled.add(c.id));
    store.set("disabled", [...state.disabled]);
    renderChips();
    renderStatus();
  });
  $("#avoidRecent").addEventListener("change", (e) => {
    state.avoidRecent = e.target.checked;
    store.set("avoidRecent", state.avoidRecent);
  });
  $("#clearHistory").addEventListener("click", () => {
    if (!state.history.length || !confirm("Clear your dinner history?")) return;
    state.history = [];
    store.set("history", []);
    renderHistory();
  });
  document.querySelectorAll(".tab").forEach((t) =>
    t.addEventListener("click", () => {
      state.view = t.dataset.view;
      render();
      window.scrollTo({ top: 0 });
    })
  );

  render();
  if (state.location) loadRestaurants();

  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

document.addEventListener("DOMContentLoaded", init);
