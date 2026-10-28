// Falcon Tracker map. Loads /api/state once, then listens to /events (SSE).
"use strict";

const COLORS = ["#ff7b72", "#58a6ff", "#3fb950", "#d2a8ff", "#ffa657", "#79c0ff"];
const LIVE_S = 15;   // green dot if heard within this many seconds
const STALE_S = 60;  // amber until here, red after

const map = L.map("map", { zoomControl: true }).setView([0, 0], 2);
const layers = {
  "Street": L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19, attribution: "&copy; OpenStreetMap contributors",
  }),
  "Satellite": L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    { maxZoom: 19, attribution: "Imagery &copy; Esri" }),
};
layers["Satellite"].addTo(map);
L.control.layers(layers).addTo(map);
L.control.scale({ imperial: false }).addTo(map);

const falcons = new Map();  // id -> {last, track, marker, line, card}
let selected = null;
let base = loadBase();
let baseMarker = null;
let pickingBase = false;

// ------------------------------------------------------------------ geometry
const rad = (d) => (d * Math.PI) / 180;

function distanceM(a, b) {
  const R = 6371000;
  const dLat = rad(b[0] - a[0]), dLon = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function bearingDeg(a, b) {
  const y = Math.sin(rad(b[1] - a[1])) * Math.cos(rad(b[0]));
  const x = Math.cos(rad(a[0])) * Math.sin(rad(b[0])) -
            Math.sin(rad(a[0])) * Math.cos(rad(b[0])) * Math.cos(rad(b[1] - a[1]));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

const compass = (deg) => ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(deg / 45) % 8];
const fmtDist = (m) => (m < 1000 ? `${m.toFixed(0)} m` : `${(m / 1000).toFixed(2)} km`);

// 1S LiPo resting voltage -> rough state of charge.
function lipoPercent(v) {
  const table = [[3.3, 0], [3.6, 10], [3.7, 30], [3.8, 55], [3.9, 70], [4.0, 82], [4.1, 92], [4.2, 100]];
  if (v <= table[0][0]) return 0;
  for (let i = 1; i < table.length; i++) {
    const [v1, p1] = table[i], [v0, p0] = table[i - 1];
    if (v <= v1) return Math.round(p0 + ((v - v0) / (v1 - v0)) * (p1 - p0));
  }
  return 100;
}

// ---------------------------------------------------------------------- base
function loadBase() {
  try { return JSON.parse(localStorage.getItem("falcon-base")); } catch { return null; }
}

function setBase(latlng, save = true) {
  base = latlng;
  if (save) { try { localStorage.setItem("falcon-base", JSON.stringify(base)); } catch {} }
  if (!baseMarker) {
    baseMarker = L.marker(base, {
      title: "Base station",
      icon: L.divIcon({ className: "", html: "<div style='font-size:22px'>📡</div>", iconSize: [24, 24], iconAnchor: [12, 12] }),
    }).addTo(map);
  }
  baseMarker.setLatLng(base);
  document.getElementById("base-info").textContent = `Base: ${base[0].toFixed(5)}, ${base[1].toFixed(5)}`;
  falcons.forEach(render);
}

document.getElementById("set-base").onclick = (e) => {
  pickingBase = !pickingBase;
  e.target.classList.toggle("active", pickingBase);
};
map.on("click", (e) => {
  if (!pickingBase) return;
  pickingBase = false;
  document.getElementById("set-base").classList.remove("active");
  setBase([e.latlng.lat, e.latlng.lng]);
});
document.getElementById("gps-base").onclick = () => {
  navigator.geolocation?.getCurrentPosition(
    (p) => { setBase([p.coords.latitude, p.coords.longitude]); map.setView(base, 15); },
    (err) => alert(`Location unavailable: ${err.message}`),
    { enableHighAccuracy: true });
};

// ------------------------------------------------------------------- falcons
function falconIcon(color, course) {
  const svg = `<svg width="28" height="28" viewBox="-14 -14 28 28">
    <g transform="rotate(${course || 0})">
      <path d="M0,-12 L8,10 L0,5 L-8,10 Z" fill="${color}" stroke="#000" stroke-width="1.5"/>
    </g></svg>`;
  return L.divIcon({ className: "falcon-icon", html: svg, iconSize: [28, 28], iconAnchor: [14, 14] });
}

function getFalcon(id) {
  if (falcons.has(id)) return falcons.get(id);
  const color = COLORS[(id - 1) % COLORS.length];
  const card = document.getElementById("card").content.firstElementChild.cloneNode(true);
  card.style.setProperty("--c", color);
  card.querySelector(".name").textContent = `Falcon ${id}`;
  card.querySelector(".gpx").href = `/api/track.gpx?id=${id}`;
  const f = {
    id, color, card, last: null, track: [],
    line: L.polyline([], { color, weight: 3, opacity: 0.85 }).addTo(map),
    marker: null,
  };
  card.onclick = () => select(id);
  card.querySelector(".center").onclick = (e) => { e.stopPropagation(); select(id, true); };
  const list = document.getElementById("falcons");
  if (!falcons.size) list.innerHTML = "";
  list.appendChild(card);
  falcons.set(id, f);
  if (selected === null) selected = id;
  return f;
}

function select(id, center = false) {
  selected = id;
  falcons.forEach((f) => f.card.classList.toggle("selected", f.id === id));
  const f = falcons.get(id);
  if (f?.marker && (center || document.getElementById("follow").checked)) {
    map.setView(f.marker.getLatLng(), Math.max(map.getZoom(), 15));
  }
}

function addPoint(msg, live = true) {
  const f = getFalcon(msg.id);
  f.last = msg;
  if (msg.fix) {
    const ll = [msg.lat, msg.lon];
    f.track.push(ll);
    f.line.addLatLng(ll);
    if (!f.marker) {
      f.marker = L.marker(ll, { icon: falconIcon(f.color, msg.course) }).addTo(map);
      f.marker.on("click", () => select(f.id));
      if (falcons.size === 1 || f.id === selected) map.setView(ll, 15);
    } else {
      f.marker.setLatLng(ll).setIcon(falconIcon(f.color, msg.course));
    }
    if (live && f.id === selected && document.getElementById("follow").checked) map.panTo(ll);
  }
  render(f);
}

function render(f) {
  const m = f.last;
  if (!m) return;
  const q = (s) => f.card.querySelector(s);
  const ll = [m.lat, m.lon];
  q(".pos").textContent = m.fix ? `${m.lat.toFixed(6)}, ${m.lon.toFixed(6)}` : "no fix (last known shown)";
  q(".alt").textContent = `${m.alt} m`;
  q(".speed").textContent = `${(m.speed * 3.6).toFixed(1)} km/h · ${m.course.toFixed(0)}°`;
  if (base && (m.lat || m.lon)) {
    const b = bearingDeg(base, ll);
    q(".dist").textContent = `${fmtDist(distanceM(base, ll))} · ${b.toFixed(0)}° ${compass(b)}`;
  } else {
    q(".dist").textContent = "set base";
  }
  q(".gps").textContent = `${m.sats} sats · HDOP ${m.hdop}`;
  q(".batt").textContent = m.batt ? `${m.batt.toFixed(2)} V · ${lipoPercent(m.batt)}%` : "n/a";
  q(".batt").classList.toggle("low", !!m.low_batt);
  q(".rf").textContent = m.rssi !== undefined ? `${m.rssi} dBm · SNR ${m.snr} dB` : "";
  q(".nav").href = `https://www.google.com/maps/dir/?api=1&destination=${m.lat},${m.lon}`;
  f.card.classList.toggle("selected", f.id === selected);
}

// Age labels and status dots, once a second.
setInterval(() => {
  const now = Date.now() / 1000;
  falcons.forEach((f) => {
    if (!f.last) return;
    const age = Math.max(0, now - f.last.rx_time);
    f.card.querySelector(".age").textContent = age < 90 ? `${age.toFixed(0)} s ago` : `${(age / 60).toFixed(0)} min ago`;
    const dot = f.card.querySelector(".dot");
    dot.className = "dot " + (age < LIVE_S ? "live" : age < STALE_S ? "stale" : "lost");
  });
}, 1000);

// ---------------------------------------------------------------- data feed
async function start() {
  const state = await (await fetch("/api/state")).json();
  if (base) setBase(base, false);
  else if (state.config.base) setBase(state.config.base, false);
  if (base) map.setView(base, 14);
  for (const [id, pts] of Object.entries(state.tracks)) pts.forEach((p) => addPoint({ ...p, id: +id }, false));
  state.latest.forEach((m) => { const f = getFalcon(m.id); f.last = m; render(f); });

  const link = document.getElementById("link");
  const es = new EventSource("/events");
  es.onopen = () => { link.textContent = state.config.demo ? "demo" : "live"; link.className = "pill ok"; };
  es.onerror = () => { link.textContent = "app offline"; link.className = "pill bad"; };
  es.onmessage = (e) => addPoint(JSON.parse(e.data));
}

start();
