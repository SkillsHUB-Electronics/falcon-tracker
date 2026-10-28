// Falcon Tracker dashboard. Loads /api/state once, then follows /events (SSE):
// "report" (one packet), "log" (one serial line) and "status" (connection).
"use strict";

const $ = (id) => document.getElementById(id);
const COLORS = ["#ff7b72", "#58a6ff", "#3fb950", "#d2a8ff", "#ffa657", "#79c0ff"];
const MAX_POINTS = 5000;

const store = {
  get(k, d) { try { const v = localStorage.getItem("falcon-" + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("falcon-" + k, JSON.stringify(v)); } catch {} },
};

const falcons = new Map();  // id -> {id, color, last, pts, marker, line}
let selected = null;
let status = { mode: "idle" };
let base = store.get("base", null);
let baseMarker = null, baseLine = null;
let pickingBase = false, follow = true, paused = false, seenPacket = false, lastBeep = 0;
let win = 1800;
let audio = null;

// ------------------------------------------------------------------ helpers
const rad = (d) => (d * Math.PI) / 180;
const compass = (d) => ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(d / 45) % 8];
const fmtDist = (m) => (m < 1000 ? `${m.toFixed(0)} m` : `${(m / 1000).toFixed(2)} km`);
const fmtAge = (s) => (s < 90 ? `${s.toFixed(0)} s` : s < 5400 ? `${(s / 60).toFixed(0)} min` : `${(s / 3600).toFixed(1)} h`);

function distanceM(a, b) {
  const dLat = rad(b[0] - a[0]), dLon = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

function bearingDeg(a, b) {
  const y = Math.sin(rad(b[1] - a[1])) * Math.cos(rad(b[0]));
  const x = Math.cos(rad(a[0])) * Math.sin(rad(b[0])) - Math.sin(rad(a[0])) * Math.cos(rad(b[0])) * Math.cos(rad(b[1] - a[1]));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

// 1S LiPo resting voltage -> rough state of charge.
function lipoPercent(v) {
  const t = [[3.3, 0], [3.6, 10], [3.7, 30], [3.8, 55], [3.9, 70], [4.0, 82], [4.1, 92], [4.2, 100]];
  if (v <= t[0][0]) return 0;
  for (let i = 1; i < t.length; i++) if (v <= t[i][0]) return Math.round(t[i - 1][1] + ((v - t[i - 1][0]) / (t[i][0] - t[i - 1][0])) * (t[i][1] - t[i - 1][1]));
  return 100;
}

function toast(msg) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.add("on");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove("on"), 3500);
}

async function api(path, body) {
  const opt = body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
  const res = await fetch(path, opt);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

const lostSec = () => Math.max(5, +store.get("lostSec", 30));
const current = () => falcons.get(selected);

// ------------------------------------------------------------------ theme, nav, clock
function applyTheme(t) { if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; }
applyTheme(store.get("theme", null));
$("themeBtn").onclick = () => {
  const dark = document.documentElement.dataset.theme === "dark" ||
    (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
  const t = dark ? "light" : "dark";
  store.set("theme", t);
  applyTheme(t);
  drawCharts();
};

function showPage(p) {
  document.querySelectorAll(".page").forEach((el) => el.classList.toggle("on", el.id === "page-" + p));
  document.querySelectorAll("#nav button").forEach((b) => b.classList.toggle("on", b.dataset.p === p));
  $("pageTitle").textContent = document.querySelector(`#nav button[data-p=${p}]`).textContent;
  if (p === "live") { map.invalidateSize(); drawCharts(); }
  if (p === "tracks") renderTracks();
  if (p === "settings") loadPorts();
  if (p === "log") $("console").scrollTop = $("console").scrollHeight;
}
$("nav").onclick = (e) => { const b = e.target.closest("button"); if (b) showPage(b.dataset.p); };

setInterval(() => { $("clock").textContent = new Date().toLocaleTimeString(); }, 1000);
$("clock").textContent = new Date().toLocaleTimeString();

// ------------------------------------------------------------------ map
const map = L.map("map").setView([20, 0], 2);
const baseLayers = {
  Satellite: L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    { maxZoom: 19, attribution: "Imagery &copy; Esri" }),
  Street: L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    { maxZoom: 19, attribution: "&copy; OpenStreetMap contributors" }),
};
baseLayers.Satellite.addTo(map);
L.control.layers(baseLayers).addTo(map);
L.control.scale({ imperial: false }).addTo(map);

map.on("click", (e) => {
  if (!pickingBase) return;
  pickingBase = false;
  setBase([e.latlng.lat, e.latlng.lng]);
});
map.on("dragstart", () => setFollow(false));

function setFollow(on) { follow = on; $("followBtn").classList.toggle("on", on); }
$("followBtn").onclick = () => { setFollow(!follow); if (follow) panToSelected(); };
$("fitBtn").onclick = () => {
  const pts = [...falcons.values()].filter((f) => f.marker).map((f) => f.marker.getLatLng());
  if (base) pts.push(L.latLng(base));
  if (pts.length) { setFollow(false); map.fitBounds(L.latLngBounds(pts).pad(0.2), { maxZoom: 17 }); }
};

function panToSelected() {
  const f = current();
  if (f?.marker) map.setView(f.marker.getLatLng(), Math.max(map.getZoom(), 15));
}

function falconIcon(color, course) {
  const svg = `<svg width="30" height="30" viewBox="-15 -15 30 30"><g transform="rotate(${course || 0})">
    <path d="M0,-12 L8,10 L0,5 L-8,10 Z" fill="${color}" stroke="#000" stroke-width="1.5"/></g></svg>`;
  return L.divIcon({ className: "falcon-icon", html: svg, iconSize: [30, 30], iconAnchor: [15, 15] });
}

function setBase(ll, save = true) {
  base = ll;
  if (save) store.set("base", ll);
  if (!baseMarker) {
    baseMarker = L.marker(ll, { title: "Base station", icon: L.divIcon({ className: "", html: "<div style='font-size:22px'>📡</div>", iconSize: [24, 24], iconAnchor: [12, 12] }) }).addTo(map);
    baseLine = L.polyline([], { color: "#fff", weight: 2, dashArray: "6 6", opacity: 0.8 }).addTo(map);
  }
  baseMarker.setLatLng(ll);
  $("baseLat").value = ll[0].toFixed(6);
  $("baseLon").value = ll[1].toFixed(6);
  $("mapNote").textContent = `base ${ll[0].toFixed(5)}, ${ll[1].toFixed(5)}`;
  renderSelected();
}

// ------------------------------------------------------------------ falcons
function getFalcon(id) {
  let f = falcons.get(id);
  if (f) return f;
  const color = COLORS[(id - 1) % COLORS.length];
  f = { id, color, last: null, pts: [], marker: null, line: L.polyline([], { color, weight: 3, opacity: 0.85 }).addTo(map) };
  falcons.set(id, f);
  const sel = $("falconSel");
  sel.add(new Option(`Falcon ${id}`, id));
  sel.hidden = falcons.size < 2;
  if (selected === null) { selected = id; sel.value = id; }
  return f;
}

$("falconSel").onchange = (e) => select(+e.target.value, true);

function select(id, center) {
  selected = id;
  $("falconSel").value = id;
  renderSelected();
  if (center) { setFollow(true); panToSelected(); }
}

function addReport(m, live = true) {
  const f = getFalcon(m.id);
  f.last = m;
  f.pts.push(m);
  if (f.pts.length > MAX_POINTS) f.pts.shift();
  if (m.fix) {
    const ll = [m.lat, m.lon];
    f.line.addLatLng(ll);
    if (!f.marker) {
      f.marker = L.marker(ll, { icon: falconIcon(f.color, m.course) }).addTo(map);
      f.marker.on("click", () => select(f.id, false));
      if (!base && f.id === selected) map.setView(ll, 15);
    } else {
      f.marker.setLatLng(ll).setIcon(falconIcon(f.color, m.course));
    }
    if (live && follow && f.id === selected) map.panTo(ll);
  }
  if (live) seenPacket = true;
  if (f.id === selected) renderSelected();
  renderTable();
}

// ------------------------------------------------------------------ rendering
function metrics(f) {
  const m = f.last;
  const known = m && (m.lat || m.lon);
  const age = m ? Math.max(0, Date.now() / 1000 - m.rx_time) : null;
  const dist = base && known ? distanceM(base, [m.lat, m.lon]) : null;
  const brg = base && known ? bearingDeg(base, [m.lat, m.lon]) : null;
  return { m, age, dist, brg };
}

function renderSelected() {
  const f = current();
  const hero = $("hero");
  const banners = [];
  if (!base) banners.push(["info", "Base position is not set. Open Settings so distance and bearing can be shown."]);
  if (!f || !f.last) {
    hero.className = "card p hero st9";
    $("hState").textContent = status.mode === "idle" ? "NOT CONNECTED" : "WAITING";
    $("hSub").textContent = status.mode === "idle" ? "plug in the base station and press Connect USB" : "no packets yet; switch on the tag outdoors";
    $("hLab").textContent = "Falcon status";
    ["hsDist", "hsBrg", "hsAge"].forEach((id) => { $(id).textContent = "—"; });
    $("banners").innerHTML = banners.map(([c, t]) => `<div class="bn ${c}">${t}</div>`).join("");
    $("navBtn").hidden = true;
    return;
  }
  const { m, age, dist, brg } = metrics(f);
  const lost = status.mode !== "idle" && age > lostSec();
  let st = 0, state = "TRACKING", sub = `fresh GPS fix, ${m.sats} satellites`;
  if (status.mode === "idle") { st = 9; state = "NOT CONNECTED"; sub = "showing the last data received"; }
  else if (lost) { st = 2; state = "SIGNAL LOST"; sub = `no packet for ${fmtAge(age)}; last known position shown on the map`;
    banners.push(["bad", `No packet for ${fmtAge(age)}. Walk towards the last known position and keep an eye on RSSI.`]); }
  else if (!m.fix) { st = 1; state = "NO GPS FIX"; sub = "the tag cannot see enough satellites; last known position shown";
    banners.push(["warn", "The tag has no GPS fix. It may be under cover or the GPS antenna is blocked."]); }
  else if (m.low_batt) { st = 1; state = "LOW BATTERY"; sub = `${m.batt.toFixed(2)} V, recover the bird soon`; }
  if (!lost && m.low_batt && st !== 1) banners.push(["warn", `Tag battery is low (${m.batt.toFixed(2)} V).`]);
  if (!lost && m.rssi < -115) banners.push(["warn", `Weak signal (${m.rssi} dBm). Move closer or raise the base antenna.`]);
  hero.className = `card p hero st${st}`;
  $("hLab").textContent = `Falcon ${f.id}`;
  $("hState").textContent = state;
  $("hSub").textContent = sub;
  $("hsDist").textContent = dist === null ? "set base" : fmtDist(dist);
  $("hsBrg").textContent = brg === null ? "—" : `${brg.toFixed(0)}° ${compass(brg)}`;
  $("hsAge").textContent = `${fmtAge(age)} ago`;
  $("banners").innerHTML = banners.map(([c, t]) => `<div class="bn ${c}">${t}</div>`).join("");

  $("tAlt").innerHTML = `${m.alt}<small>m</small>`;
  $("tSpd").innerHTML = `${(m.speed * 3.6).toFixed(1)}<small>km/h</small>`;
  $("tCrs").textContent = `heading ${m.course.toFixed(0)}° ${compass(m.course)}`;
  $("tBat").innerHTML = m.batt ? `${m.batt.toFixed(2)}<small>V</small>` : "—";
  $("tBat").classList.toggle("low", !!m.low_batt);
  $("tBatN").textContent = m.batt ? `about ${lipoPercent(m.batt)} % (1S LiPo)` : "not measured";
  $("tSat").textContent = m.sats;
  $("tSatN").textContent = `HDOP ${m.hdop}`;
  $("tRssi").innerHTML = `${m.rssi}<small>dBm</small>`;
  $("tSnr").innerHTML = `${m.snr}<small>dB</small>`;
  $("navBtn").hidden = false;
  $("navBtn").href = `https://www.google.com/maps/dir/?api=1&destination=${m.lat},${m.lon}`;
  if (baseLine) baseLine.setLatLngs(base && f.marker ? [base, f.marker.getLatLng()] : []);
}

function renderTable() {
  const rows = [...falcons.values()].map((f) => {
    const { m, age, dist } = metrics(f);
    if (!m) return "";
    const lost = status.mode !== "idle" && age > lostSec();
    return `<tr data-id="${f.id}" class="${f.id === selected ? "sel" : ""}" style="cursor:pointer">
      <td><b style="color:${f.color}">●</b> Falcon ${f.id}</td>
      <td>${fmtAge(age)} ago ${lost ? '<span class="tag bad">lost</span>' : ""}</td>
      <td>${m.fix ? '<span class="tag ok">fix</span>' : '<span class="tag warn">no fix</span>'}</td>
      <td>${m.batt ? m.batt.toFixed(2) + " V" : "n/a"} ${m.low_batt ? '<span class="tag bad">low</span>' : ""}</td>
      <td>${m.rssi} dBm</td><td>${dist === null ? "—" : fmtDist(dist)}</td></tr>`;
  }).join("");
  $("fTable").innerHTML = rows || '<tr><td colspan="6" class="empty">Waiting for the first packet…</td></tr>';
}
$("fTable").onclick = (e) => { const tr = e.target.closest("tr[data-id]"); if (tr) select(+tr.dataset.id, true); };

function renderTracks() {
  const f = current();
  const pts = f ? f.pts.filter((p) => p.fix).slice(-200).reverse() : [];
  $("trkNote").textContent = f ? `Falcon ${f.id}, last ${pts.length} positions` : "";
  $("gpxSel").href = f ? `/api/track.gpx?id=${f.id}` : "#";
  $("trkBody").innerHTML = pts.map((p) => `<tr><td>${new Date(p.rx_time * 1000).toLocaleTimeString()}</td>
    <td>${p.lat.toFixed(6)}</td><td>${p.lon.toFixed(6)}</td><td>${p.alt}</td><td>${(p.speed * 3.6).toFixed(1)}</td><td>${p.sats}</td><td>${p.rssi}</td></tr>`).join("")
    || '<tr><td colspan="7" class="empty">No positions yet.</td></tr>';
}
$("clearBtn").onclick = async () => {
  if (!confirm("Delete all recorded positions from the dashboard? The CSV log is kept.")) return;
  await api("/api/clear", {});
  falcons.forEach((f) => { f.pts = []; f.line.setLatLngs([]); if (f.marker) map.removeLayer(f.marker); f.marker = null; f.last = null; });
  renderSelected(); renderTable(); renderTracks(); drawCharts();
};

// ------------------------------------------------------------------ charts
function drawChart(canvas, pts, get, color, unit) {
  const dpr = devicePixelRatio || 1, w = canvas.clientWidth, h = canvas.clientHeight;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const g = canvas.getContext("2d");
  g.scale(dpr, dpr);
  const css = getComputedStyle(document.documentElement);
  const grid = css.getPropertyValue("--bd").trim(), txt = css.getPropertyValue("--tx-3").trim();
  const data = pts.map((p) => [p.rx_time, get(p)]).filter(([, v]) => v !== null && !Number.isNaN(v));
  g.font = "11px system-ui, sans-serif";
  if (data.length < 2) { g.fillStyle = txt; g.fillText("waiting for data…", 12, h / 2); return; }
  const L0 = 42, R0 = 8, T0 = 8, B0 = 20;
  const t0 = data[0][0], t1 = data[data.length - 1][0];
  let lo = Math.min(...data.map((d) => d[1])), hi = Math.max(...data.map((d) => d[1]));
  if (hi - lo < 1e-6) { lo -= 1; hi += 1; }
  const decimals = Math.min(3, Math.max(0, Math.ceil(-Math.log10((hi - lo) / 3))));
  const pad = (hi - lo) * 0.1; lo -= pad; hi += pad;
  const X = (t) => L0 + ((t - t0) / Math.max(t1 - t0, 1)) * (w - L0 - R0);
  const Y = (v) => T0 + (1 - (v - lo) / (hi - lo)) * (h - T0 - B0);
  g.strokeStyle = grid; g.fillStyle = txt; g.lineWidth = 1;
  for (let i = 0; i <= 3; i++) {
    const v = lo + ((hi - lo) * i) / 3, y = Y(v);
    g.beginPath(); g.moveTo(L0, y); g.lineTo(w - R0, y); g.stroke();
    g.fillText(v.toFixed(decimals), 4, y + 4);
  }
  g.fillText(new Date(t0 * 1000).toLocaleTimeString(), L0, h - 5);
  const tl = new Date(t1 * 1000).toLocaleTimeString();
  g.fillText(tl, w - R0 - g.measureText(tl).width, h - 5);
  g.strokeStyle = color; g.lineWidth = 2; g.lineJoin = "round"; g.beginPath();
  data.forEach(([t, v], i) => (i ? g.lineTo(X(t), Y(v)) : g.moveTo(X(t), Y(v))));
  g.stroke();
}

function drawCharts() {
  if (!$("page-live").classList.contains("on")) return;
  const f = current();
  const now = Date.now() / 1000;
  const pts = f ? f.pts.filter((p) => !win || now - p.rx_time <= win) : [];
  const fix = pts.filter((p) => p.fix);
  drawChart($("cAlt"), fix, (p) => p.alt, "#2563eb");
  drawChart($("cSpd"), fix, (p) => p.speed * 3.6, "#7c5cf0");
  drawChart($("cBat"), pts, (p) => (p.batt || null), "#12a150");
  drawChart($("cRssi"), pts, (p) => p.rssi, "#f59e0b");
}
$("winSeg").onclick = (e) => {
  const b = e.target.closest("button"); if (!b) return;
  win = +b.dataset.w;
  document.querySelectorAll("#winSeg button").forEach((x) => x.classList.toggle("on", x === b));
  drawCharts();
};
addEventListener("resize", drawCharts);

// ------------------------------------------------------------------ connection
function applyStatus(s) {
  status = s;
  const live = s.mode !== "idle";
  const pill = $("pLink");
  pill.className = "pill " + (live ? "" : "off");
  $("pLinkT").textContent = s.mode === "serial" ? `Live · ${s.port}` : s.mode === "demo" ? "Demo mode" : "Not connected";
  $("sys").className = "sys " + (live ? "" : "off");
  $("sysT").textContent = live ? (s.mode === "demo" ? "Demo mode" : `Connected ${s.port}`) : "Not connected";
  $("sysS").textContent = live ? `${s.packets} packets · ${s.errors} bad` : "Press Connect USB";
  $("usbT").textContent = live ? "Disconnect" : "Connect USB";
  renderSelected();
}

async function act(fn) {
  $("connErr").hidden = true;
  try { applyStatus(await fn()); } catch (e) { $("connErr").textContent = e.message; $("connErr").hidden = false; toast(e.message); }
}
$("usbBtn").onclick = () => act(() => (status.mode === "idle" ? api("/api/connect", {}) : api("/api/disconnect", {})));
$("portConnect").onclick = () => act(() => api("/api/connect", { port: $("portSel").value }));
$("demoBtn").onclick = () => act(() => api("/api/connect", { demo: true }));
$("discBtn").onclick = () => act(() => api("/api/disconnect", {}));
$("portRefresh").onclick = loadPorts;

async function loadPorts() {
  try {
    const { ports, auto } = await api("/api/ports");
    $("portSel").innerHTML = ports.map((p) => `<option value="${p.device}">${p.device} · ${p.description}${p.espressif ? " (ESP32)" : ""}</option>`).join("")
      || '<option value="">no serial ports found</option>';
    if (auto) $("portSel").value = auto;
  } catch (e) { $("portSel").innerHTML = `<option value="">${e.message}</option>`; }
}

// ------------------------------------------------------------------ monitor
function addLog(entry) {
  if (paused) return;
  const c = $("console");
  const stick = c.scrollTop + c.clientHeight >= c.scrollHeight - 20;
  c.append(`${new Date(entry.t * 1000).toLocaleTimeString()}  ${entry.line}\n`);
  while (c.childNodes.length > 500) c.firstChild.remove();
  if (stick) c.scrollTop = c.scrollHeight;
}
$("pauseBtn").onclick = (e) => { paused = !paused; e.target.textContent = paused ? "Resume" : "Pause"; };
$("logClear").onclick = () => { $("console").textContent = ""; };

// ------------------------------------------------------------------ settings
$("baseSave").onclick = () => {
  const lat = parseFloat($("baseLat").value), lon = parseFloat($("baseLon").value);
  if (!(Math.abs(lat) <= 90 && Math.abs(lon) <= 180)) return toast("Enter a valid latitude and longitude.");
  setBase([lat, lon]);
  toast("Base position saved.");
};
$("baseGeo").onclick = () => navigator.geolocation?.getCurrentPosition(
  (p) => { setBase([p.coords.latitude, p.coords.longitude]); toast("Base set to this laptop's location."); },
  (err) => toast(`Location unavailable: ${err.message}`), { enableHighAccuracy: true });
$("basePick").onclick = () => { pickingBase = true; showPage("live"); toast("Click the map where the base station is."); };
$("lostSec").value = lostSec();
$("lostSec").onchange = (e) => store.set("lostSec", Math.max(5, +e.target.value || 30));
$("alarmOn").checked = store.get("alarm", false);
$("alarmOn").onchange = (e) => {
  store.set("alarm", e.target.checked);
  if (e.target.checked) { audio = audio || new AudioContext(); beep(); }  // created on a click so the browser allows sound
};

function beep() {
  if (!audio) return;
  for (let i = 0; i < 3; i++) {
    const o = audio.createOscillator(), g = audio.createGain();
    o.frequency.value = 880; o.connect(g); g.connect(audio.destination);
    g.gain.setValueAtTime(0.2, audio.currentTime + i * 0.35);
    o.start(audio.currentTime + i * 0.35); o.stop(audio.currentTime + i * 0.35 + 0.2);
  }
}

// ------------------------------------------------------------------ once a second
setInterval(() => {
  renderSelected();
  renderTable();
  drawCharts();
  if ($("page-tracks").classList.contains("on")) renderTracks();
  const f = current();
  if (store.get("alarm", false) && audio && seenPacket && f?.last && status.mode !== "idle" &&
      Date.now() / 1000 - f.last.rx_time > lostSec() && Date.now() - lastBeep > 10000) {
    lastBeep = Date.now();
    beep();
  }
}, 1000);

// ------------------------------------------------------------------ start
async function start() {
  const state = await api("/api/state");
  if (base) setBase(base, false);
  else if (state.config.base) setBase(state.config.base, false);
  if (base) map.setView(base, 14);
  for (const [id, pts] of Object.entries(state.tracks)) pts.forEach((p) => addReport({ ...p, id: +id }, false));
  state.latest.forEach((m) => { const f = getFalcon(m.id); f.last = m; });
  (await api("/api/log")).forEach(addLog);
  applyStatus(state.status);
  renderTable();

  const es = new EventSource("/events");
  es.addEventListener("report", (e) => addReport(JSON.parse(e.data)));
  es.addEventListener("log", (e) => addLog(JSON.parse(e.data)));
  es.addEventListener("status", (e) => applyStatus(JSON.parse(e.data)));
  es.onerror = () => { $("pLinkT").textContent = "App offline"; $("pLink").className = "pill bad"; };
  es.onopen = () => applyStatus(status);
}

start();
