// 🌙 지금 깨어 있는 사람 | 아이디어 공작소 #3

// ---------- 🔑 Supabase 설정 (딱 10초·픽셀 어항과 같은 프로젝트) ----------
// 공개용(Publishable) 키라 코드에 넣어도 됩니다. Secret 키는 절대 넣지 마세요!
const SUPABASE_URL = "https://mamunluhjcrmharnrqdz.supabase.co";
const SUPABASE_KEY = "sb_publishable_eh0u-VyFBgXRSovoBPrgsQ_F2pYPjWU";

// ---------- 설정 ----------
const PLAYER_KEY = "awake-player";
const LOOK_KEY = "awake-look";        // 내 조명 색·상태 기억
const WAVE_KEY = "awake-waves";       // 오늘 받은 👋 수
const ROOM = "awake-room";            // 실시간 채널 이름
const HEARTBEAT_MS = 60 * 1000;       // 화면이 켜져 있는 동안 1분마다 "아직 있어요" (서버가 시간 적립)
const REFRESH_MS = 30 * 1000;         // 30초마다 흔적(최근 24시간) 새로고침
const FALLBACK_AWAKE_MS = 3 * 60 * 1000; // 실시간 연결이 안 될 때: 3분 안에 신호가 있으면 깨어 있는 걸로
const WAVE_COOLDOWN_MS = 3000;

// 화면 (논리 크기, 캔버스는 2배로 그려서 선명하게)
const BLOCK_W = 360;                  // 3개 동이 들어가는 한 구역 너비
const H = 480;
const GROUND = 446;
const BW = 76;                        // 건물 너비
const BX = [20, 142, 264];            // 구역 안 건물 위치
const COLS = 4, FLOORS = 12;
const PER_BUILDING = COLS * FLOORS;   // 48
const PER_BLOCK = PER_BUILDING * 3;   // 144
const WIN_W = 10, WIN_H = 12;
const STEP_X = 16, STEP_Y = 22;
const ROOF_Y = 160;

// 창문 번호 → 자리. 첫 손님들이 한 줄로 몰리지 않게 골고루 흩어 배치 (61과 144는 서로소)
const SPREAD = 61, SPREAD_INV = 85;   // 61 × 85 ≡ 1 (mod 144)

// 조명 색 (DB에는 0~5 번호로 저장)
const COLORS = ["#FFC857", "#F4F1DE", "#FF8C42", "#FF8FB1", "#8EC5FF", "#9BE38A"];
const COLOR_NAMES = ["노랑", "하양", "주황", "분홍", "파랑", "초록"];

// 지금 뭐 해요? (DB에는 0~4 번호로 저장)
const STATUS_CHIPS = ["✨ 그냥", "📖 공부", "💻 일", "😴 잠이 안 와요", "🎮 노는 중"];
const STATUS_TEXT = ["✨ 그냥 깨어 있어요", "📖 공부하는 중", "💻 일하는 중", "😴 잠이 안 온대요", "🎮 노는 중"];

// 불을 오래 켜 둘수록 창문이 꾸며져요 (총 켜둔 시간 기준)
const GROWTH = [
  { h: 1 / 6, icon: "🌱", name: "새싹" },   // 10분
  { h: 1, icon: "🪴", name: "화분" },
  { h: 5, icon: "🪟", name: "커튼" },
  { h: 20, icon: "🐈", name: "고양이" },
  { h: 50, icon: "✨", name: "꼬마전구" },
];

// 단지 공동 목표 (모두가 켜둔 시간의 합) → 달성하면 동네에 자동으로 생겨요
const TOWN_GOALS = [
  { h: 3, icon: "🛝", name: "놀이터" },
  { h: 10, icon: "🏪", name: "편의점" },
  { h: 30, icon: "🌠", name: "별똥별" },
  { h: 60, icon: "🚌", name: "버스" },
];

// ---------- 요소 ----------
const $ = (id) => document.getElementById(id);
const town = $("town");
let tx = town.getContext("2d");          // 그리기 대상 (창문 확대 그릴 때 잠깐 바뀜)
const scroller = $("scroller");
const nowCountEl = $("nowCount");
const dayCountEl = $("dayCount");
const findBtn = $("findBtn");
const peekEl = $("peek");
const peekAddr = $("peekAddr");
const peekState = $("peekState");
const waveBtn = $("waveBtn");
const mineEl = $("mine");
const toastEl = $("toast");
tx.setTransform(2, 0, 0, 2, 0, 0);

// ---------- DB 연결 ----------
const keyOk = /^[\x21-\x7e]+$/.test(SUPABASE_KEY);
const db =
  SUPABASE_URL && keyOk && window.supabase
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
    : null;

// ---------- 상태 ----------
let frame = 0;
let blocks = 1;                // 화면에 그릴 구역 수 (구역당 3개 동)
let dbTotal = 0;               // 가장 뒤쪽 자리 번호
let taken = new Set();         // 누가 사는 자리 (빈 집 확인용)
let moveArm = null;            // 이사 버튼 한 번 누른 창문 (두 번 눌러야 이사)
let recent = new Map();        // 최근 24시간 흔적: n → { c, s, v, t }
let online = new Map();        // 지금 깨어 있는 사람: n → { c, s }
let myNo = null;
let myTotal = 0;               // 내가 지금까지 켜둔 시간(초) — 서버 기준
let myToday = 0;               // 오늘(새벽 6시 기준) 켜둔 시간(초)
let townSec = 0;               // 단지 전체 시간(초)
let syncedAt = 0;              // 마지막으로 서버 값을 받은 시각 (performance.now)
let counting = false;          // 지금 시간이 흐르는 중인지 (화면이 보일 때만)
let moodOn = false;            // 화면 켜 두기 모드
let myStars = 0;               // 끝까지 해낸 집중 세션 수
let sessionGoal = null;        // 진행 중인 세션 목표(초)
let sessionSec = 0;            // 세션에서 쌓은 시간(초) — 서버 기준
let sessionClosing = false;    // 세션 끝 확인 요청 중
let away = false;              // 다른 앱에 잠깐 가 있는 중 (3분 유예)
let awayTimer = null;
let leftAt = 0;
let myDays = new Map();        // 불빛 달력: 'YYYY-MM-DD' → { s, st }
let hourWaveAt = -999;         // 정각 파도가 시작된 프레임
let lastWaveHour = null;
const AWAY_GRACE_MS = 3 * 60 * 1000;
let wakeLock = null;
let lightAt = -1;              // 내 불이 켜진 순간 (딸깍 효과)
let connected = false;         // 실시간 연결 여부
let realtimeFailed = false;    // 실시간 연결 실패 → DB 기록으로 대신 세기
let channel = null;
let tracking = false;
let selectedN = null;
let lastWaveAt = 0;
const pops = new Map();        // n → 불이 켜진 프레임 (반짝 효과)
const waves = [];              // 날아가는 👋
const look = loadLook();

// 별 (위치 고정)
const stars = Array.from({ length: 60 }, (_, i) => ({
  x: rand(i * 3 + 1) * BLOCK_W,
  y: rand(i * 3 + 2) * 150 + 4,
  p: rand(i * 3 + 3) * 200,
}));

// ---------- 도우미 ----------
function rand(seed) {
  // 매번 같은 값을 주는 의사 난수 (배경이 새로고침마다 바뀌지 않게)
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

function mix(hex, toHex, t) {
  const a = parseInt(hex.slice(1), 16), b = parseInt(toHex.slice(1), 16);
  const r = Math.round((a >> 16) + (((b >> 16) - (a >> 16)) * t));
  const g = Math.round(((a >> 8) & 255) + ((((b >> 8) & 255) - ((a >> 8) & 255)) * t));
  const bl = Math.round((a & 255) + (((b & 255) - (a & 255)) * t));
  return `rgb(${r},${g},${bl})`;
}

function rgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${alpha})`;
}

function loadLook() {
  try {
    const v = JSON.parse(localStorage.getItem(LOOK_KEY));
    if (v && v.c >= 0 && v.c < COLORS.length && v.s >= 0 && v.s < STATUS_CHIPS.length) return v;
  } catch (e) {}
  return { c: 0, s: 0 };
}

function saveLook() {
  try { localStorage.setItem(LOOK_KEY, JSON.stringify(look)); } catch (e) {}
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function wavesToday() {
  try {
    const v = JSON.parse(localStorage.getItem(WAVE_KEY));
    return v && v.d === todayKey() ? v.n : 0;
  } catch (e) { return 0; }
}

function addWaveToday() {
  const n = wavesToday() + 1;
  try { localStorage.setItem(WAVE_KEY, JSON.stringify({ d: todayKey(), n })); } catch (e) {}
  return n;
}

function ago(iso) {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  return `${Math.floor(min / 60)}시간 전`;
}

// ---------- 창문 번호 ↔ 동·호수·자리 ----------
function slotOf(n) {
  const idx = n - 1;
  const block = Math.floor(idx / PER_BLOCK);
  const slot = ((idx % PER_BLOCK) * SPREAD) % PER_BLOCK;
  const b = Math.floor(slot / PER_BUILDING);
  const r = slot % PER_BUILDING;
  return { block, b, floor: Math.floor(r / COLS) + 1, unit: (r % COLS) + 1 };
}

function addr(n) {
  const { block, b, floor, unit } = slotOf(n);
  return `${101 + block * 3 + b}동 ${floor * 100 + unit}호`;
}

function winPos(n) {
  const { block, b, floor, unit } = slotOf(n);
  const bx = block * BLOCK_W + BX[b];
  return {
    x: bx + 9 + (unit - 1) * STEP_X,
    y: GROUND - 14 - floor * STEP_Y + 6,
  };
}

function numberAt(lx, ly) {
  // 화면 좌표 → 창문 번호 (창문이 아니면 null)
  const block = Math.floor(lx / BLOCK_W);
  if (block < 0 || block >= blocks) return null;
  const inX = lx - block * BLOCK_W;
  for (let b = 0; b < 3; b++) {
    const ox = inX - (BX[b] + 9);
    if (ox < -3 || ox > COLS * STEP_X) continue;
    const unit = Math.min(COLS, Math.max(1, Math.floor((ox + 3) / STEP_X) + 1));
    const floor = Math.round((GROUND - 14 + 6 + WIN_H / 2 - ly) / STEP_Y);
    if (floor < 1 || floor > FLOORS) return null;
    const slot = b * PER_BUILDING + (floor - 1) * COLS + (unit - 1);
    const idx = (slot * SPREAD_INV) % PER_BLOCK;
    return block * PER_BLOCK + idx + 1;
  }
  return null;
}

// 마지막 동기화 이후 흐른 시간 (서버도 최대 70초까지만 인정하므로 화면도 70초에서 멈춤)
function liveExtra() {
  if (!counting || !syncedAt) return 0;
  return Math.min(70, Math.floor((performance.now() - syncedAt) / 1000));
}

function townDone(name) {
  const g = TOWN_GOALS.find((x) => x.name === name);
  return g && (townSec + liveExtra()) / 3600 >= g.h;
}

function stateOf(n) {
  if (arriving.has(n)) return recent.has(n) && n !== myNo ? { kind: "ember", ...recent.get(n) } : { kind: "off" };
  if (n === myNo) return { kind: "on", c: look.c, s: look.s, h: myTotal + liveExtra(), st: myStars, f: !!sessionGoal, a: away };
  if (online.has(n)) {
    const r = recent.get(n) || {};
    return { kind: "on", ...online.get(n), h: r.h || 0, st: r.st || 0 };
  }
  if (recent.has(n)) return { kind: "ember", ...recent.get(n) };
  return { kind: "off" };
}

// ---------- 서울 실제 날씨 (Open-Meteo, 키 필요 없음) ----------
// 테스트·영상 촬영용:  ?weather=clear | cloudy | overcast | fog | drizzle | rain | snow | thunder
const weatherUrl = () => "https://api.open-meteo.com/v1/forecast"
  + `?latitude=${place.lat}&longitude=${place.lng}&current=temperature_2m,weather_code,cloud_cover`;
const WEATHER_MS = 15 * 60 * 1000;   // 15분마다 새로고침
const WEATHER_TEST = {
  clear: [0, 0], cloudy: [2, 55], overcast: [3, 100], fog: [45, 100],
  drizzle: [53, 90], rain: [63, 95], snow: [73, 90], thunder: [95, 100],
};
const WEATHER_PARAM = new URLSearchParams(location.search).get("weather");
let wx = { kind: "clear", code: 0, cloud: 0, power: 0, temp: null, ok: false };
let flashAt = -999;            // 번개 친 순간

function setWeather(code, cloud, temp) {
  const rain = { 51: 0.3, 53: 0.45, 55: 0.6, 56: 0.4, 57: 0.6, 61: 0.5, 63: 0.75, 65: 1, 66: 0.6, 67: 0.9, 80: 0.5, 81: 0.75, 82: 1 };
  const snow = { 71: 0.4, 73: 0.7, 75: 1, 77: 0.4, 85: 0.6, 86: 1 };
  let kind = "clear", power = 0;
  if (code >= 95) { kind = "thunder"; power = 1; }
  else if (rain[code]) { kind = code <= 57 ? "drizzle" : "rain"; power = rain[code]; }
  else if (snow[code]) { kind = "snow"; power = snow[code]; }
  else if (code === 45 || code === 48) kind = "fog";
  else if (code === 3) kind = "overcast";
  else if (code === 1 || code === 2) kind = "cloudy";
  if (kind !== "clear" && kind !== "cloudy") cloud = Math.max(cloud, 80);
  wx = { kind, code, cloud: Math.min(100, Math.max(0, cloud)), power, temp, ok: true };
  updateWeatherLabel();
}

function updateWeatherLabel() {
  const el = $("hudWx");   // 지금은 화면에 글자로 안 띄움 (하늘 그림으로만 표현)
  if (!el) return;
  if (!wx.ok) { el.textContent = ""; return; }
  const night = amb < 0.3;
  const names = {
    clear: night ? "🌙 맑음" : "☀️ 맑음", cloudy: "⛅ 구름 조금", overcast: "☁️ 흐림", fog: "🌫️ 안개",
    drizzle: "🌦️ 이슬비", rain: "🌧️ 비", snow: "🌨️ 눈", thunder: "⛈️ 천둥번개",
  };
  const temp = typeof wx.temp === "number" ? ` · ${Math.round(wx.temp)}°C` : "";
  const [icon, ...label] = names[wx.kind].split(" ");
  el.textContent = `${icon} 서울 ${label.join(" ")}${temp}`;
}

async function loadWeather() {
  if (WEATHER_PARAM && WEATHER_TEST[WEATHER_PARAM]) {
    const [code, cloud] = WEATHER_TEST[WEATHER_PARAM];
    setWeather(code, cloud, null);
    return;
  }
  try {
    const res = await fetch(weatherUrl());
    const j = await res.json();
    const c = j.current || {};
    if (typeof c.weather_code === "number") setWeather(c.weather_code, Number(c.cloud_cover) || 0, c.temperature_2m);
  } catch (e) {
    console.warn("[awake] 날씨를 못 불러왔어요", e);
  }
}

// 구름 (위치 고정, 흐린 정도만큼 보임)
const clouds = Array.from({ length: 9 }, (_, i) => ({
  x: rand(i + 500) * BLOCK_W,
  y: 18 + rand(i + 510) * 110,
  w: 34 + rand(i + 520) * 46,
  v: 0.03 + rand(i + 530) * 0.07,
}));
const drops = Array.from({ length: 200 }, (_, i) => ({ x: rand(i + 600), y: rand(i + 700) * H, l: 5 + rand(i + 800) * 6 }));
const flakes = Array.from({ length: 150 }, (_, i) => ({ x: rand(i + 900), y: rand(i + 1000) * H, v: 0.35 + rand(i + 1100) * 0.5, p: rand(i + 1200) * 6, r: rand(i + 1300) < 0.3 ? 2 : 1 }));

function drawCloud(x, y, w, color, shade) {
  tx.fillStyle = color;
  tx.fillRect(Math.round(x), Math.round(y), Math.round(w), 8);
  tx.fillRect(Math.round(x + w * 0.12), Math.round(y - 6), Math.round(w * 0.45), 6);
  tx.fillRect(Math.round(x + w * 0.45), Math.round(y - 10), Math.round(w * 0.32), 10);
  tx.fillStyle = shade;
  tx.fillRect(Math.round(x + 2), Math.round(y + 6), Math.round(w - 4), 2);
}

function drawClouds(W, sky) {
  const n = wx.cloud < 8 ? 0 : Math.max(1, Math.round((wx.cloud / 100) * clouds.length));
  if (!n) return;
  const wet = wx.kind === "rain" || wx.kind === "thunder" || wx.kind === "drizzle" || wx.kind === "snow";
  let base = mixHex("#2a3048", "#f3f5f9", amb);
  if (wet) base = mixHex(base, mixHex("#1d2130", "#8c93a3", amb), 0.6);
  base = mixHex(base, sky.bottom, 0.18);           // 노을 지면 구름도 물들게
  const shade = mixHex(base, "#000000", 0.18);
  for (let k = 0; k < blocks; k++) {
    for (let i = 0; i < n; i++) {
      const c = clouds[i];
      c.x += c.v / blocks;
      if (c.x > BLOCK_W + 10) c.x = -c.w - 10;
      drawCloud(c.x + k * BLOCK_W, c.y, c.w, base, shade);
    }
  }
}

// 건물 앞에 그리는 날씨 (비·눈·안개·번개)
function drawWeatherFront(W) {
  if (wx.kind === "rain" || wx.kind === "drizzle" || wx.kind === "thunder") {
    const count = Math.round(50 + wx.power * 150);
    tx.strokeStyle = `rgba(175,195,225,${0.35 + amb * 0.15})`;
    tx.lineWidth = 1;
    tx.beginPath();
    for (let i = 0; i < count; i++) {
      const d = drops[i];
      d.y += 6 + wx.power * 3;
      if (d.y > H) { d.y = -10; d.x = Math.random(); }
      const x = d.x * W, len = wx.kind === "drizzle" ? d.l * 0.6 : d.l;
      tx.moveTo(x, d.y);
      tx.lineTo(x - len * 0.25, d.y + len);
    }
    tx.stroke();
    // 땅에 튀는 빗방울
    tx.fillStyle = "rgba(190,210,235,0.5)";
    for (let i = 0; i < 6 * wx.power; i++) tx.fillRect(Math.random() * W, GROUND + 1 + Math.random() * 3, 2, 1);
  }

  if (wx.kind === "snow") {
    const count = Math.round(40 + wx.power * 110);
    tx.fillStyle = "rgba(255,255,255,0.9)";
    for (let i = 0; i < count; i++) {
      const f = flakes[i];
      f.y += f.v;
      if (f.y > GROUND) { f.y = -4; f.x = Math.random(); }
      const x = f.x * W + Math.sin(frame / 40 + f.p) * 4;
      tx.fillRect(Math.round(x), Math.round(f.y), f.r, f.r);
    }
    // 쌓인 눈 (땅 + 옥상)
    tx.fillStyle = "rgba(240,244,250,0.92)";
    tx.fillRect(0, GROUND, W, 3);
    for (let k = 0; k < blocks; k++) {
      for (let b = 0; b < 3; b++) tx.fillRect(k * BLOCK_W + BX[b] - 2, ROOF_Y - 5, BW + 4, 2);
    }
  }

  if (wx.kind === "fog") {
    for (let i = 0; i < 4; i++) {
      const y = 250 + i * 50 + Math.sin(frame / 120 + i) * 8;
      tx.fillStyle = `rgba(190,196,208,${0.1 + amb * 0.05})`;
      tx.fillRect(0, y, W, 40);
    }
    tx.fillStyle = `rgba(170,176,190,${0.1 + amb * 0.08})`;
    tx.fillRect(0, 0, W, H);
  }

  if (wx.kind === "thunder") {
    if (frame - flashAt > 240 && Math.random() < 1 / 420) {
      flashAt = frame;
      if (window.Sound) Sound.thunder();
    }
    const t = frame - flashAt;
    if (t < 14) {
      if (t < 6) {
        // 번개 줄기
        const seed = flashAt;
        let x = 60 + rand(seed) * (W - 120), y = 0;
        tx.fillStyle = "rgba(255,255,230,0.95)";
        while (y < 140) {
          const nx = x + (rand(seed + y) - 0.5) * 18;
          for (let k = 0; k < 10; k++) tx.fillRect(Math.round(x + ((nx - x) * k) / 10), y + k, 2, 2);
          x = nx; y += 10;
        }
      }
      tx.fillStyle = `rgba(255,255,255,${0.35 * (1 - t / 14)})`;
      tx.fillRect(0, 0, W, H);
    }
  }
}

// ---------- 하늘 기준 위치: 내 위치(허용하면) / 서울(거절·실패하면) ----------
// 위치는 이 기기에만 저장하고, 날씨 조회에는 소수점 한 자리(약 10km)로 뭉갠 좌표만 써요
const SEOUL = { mode: "seoul", lat: 37.5665, lng: 126.978 };
const LOC_KEY = "awake-loc";
let place = { ...SEOUL };

function loadPlace() {
  try {
    const v = JSON.parse(localStorage.getItem(LOC_KEY));
    if (v && v.mode === "geo" && isFinite(v.lat) && isFinite(v.lng)) place = v;
    return v ? v.mode : null;          // null = 아직 한 번도 안 물어봄
  } catch (e) { return null; }
}

function savePlace() {
  try { localStorage.setItem(LOC_KEY, JSON.stringify(place)); } catch (e) {}
}

// 그 기준 위치의 시간대 (분). 서울 기준이면 한국 시각, 내 위치면 이 기기 시각
function tzOffset() {
  return place.mode === "geo" ? -new Date().getTimezoneOffset() : 540;
}

function askLocation(byUser) {
  if (!("geolocation" in navigator)) {
    if (byUser) showToast("이 브라우저는 위치를 지원하지 않아요");
    useSeoul();
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      place = {
        mode: "geo",
        lat: Math.round(pos.coords.latitude * 10) / 10,
        lng: Math.round(pos.coords.longitude * 10) / 10,
      };
      savePlace();
      loadWeather();
      updateSkyWhere();
      if (byUser) showToast("내 위치의 하늘로 바꿨어요");
    },
    () => {
      if (byUser) showToast("위치 권한이 꺼져 있어요. 브라우저 설정에서 허용해 주세요");
      useSeoul();
    },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 6 * 3600 * 1000 }
  );
}

function useSeoul() {
  place = { ...SEOUL };
  savePlace();
  loadWeather();
  updateSkyWhere();
}

function updateSkyWhere() {
  const geo = place.mode === "geo";
  $("skyWhere").textContent = geo ? "하늘·날씨: 내 위치 기준" : "하늘·날씨: 서울 기준";
  $("skyToggle").textContent = geo ? "서울로 보기" : "내 위치로 보기";
}

$("skyToggle").addEventListener("click", () => {
  if (place.mode === "geo") {
    useSeoul();
    showToast("서울 하늘로 바꿨어요");
  } else {
    askLocation(true);
  }
});

// ---------- 하늘: 기준 위치의 실제 해 뜨는/지는 시간에 맞춰 색이 바뀜 ----------
// 테스트·영상 촬영용 주소 옵션:  ?sky=18:30 (그 시각으로 고정)  ·  ?sky=fast (하루를 60초에 빨리 감기)
const SKY_PARAM = new URLSearchParams(location.search).get("sky");
let amb = 0;                   // 주변 밝기 0(밤) ~ 1(한낮) — 건물·창문 색에 사용

// 기준 위치의 해 뜨는/지는 시각 (그곳 시각으로 자정부터 몇 분째인지). NOAA 근사식
function sunTimes(doy) {
  const lat = place.lat * Math.PI / 180, lng = place.lng;
  const g = (2 * Math.PI / 365) * (doy - 1);
  const eq = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g)
    - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g)
    + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  // 백야·극야 지역에서도 계산이 깨지지 않게 -1~1로 자르기
  const x = Math.cos(90.833 * Math.PI / 180) / (Math.cos(lat) * Math.cos(decl)) - Math.tan(lat) * Math.tan(decl);
  const ha = Math.acos(Math.max(-1, Math.min(1, x))) * 180 / Math.PI;
  const tz = tzOffset();
  return { rise: 720 - 4 * (lng + ha) - eq + tz, set: 720 - 4 * (lng - ha) - eq + tz };
}

// 기준 위치의 지금 시각 (자정부터 몇 분째, 소수점 포함) + 올해 몇 번째 날
function skyClock() {
  const k = new Date(Date.now() + tzOffset() * 60000);
  const doy = Math.floor((Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate()) - Date.UTC(k.getUTCFullYear(), 0, 1)) / 86400000) + 1;
  let min = k.getUTCHours() * 60 + k.getUTCMinutes() + k.getUTCSeconds() / 60;
  if (SKY_PARAM === "fast") min = ((performance.now() / 1000) * 24) % 1440;     // 60초 = 하루
  else if (SKY_PARAM && /^\d{1,2}:\d{2}$/.test(SKY_PARAM)) {
    const [hh, mm] = SKY_PARAM.split(":").map(Number);
    min = hh * 60 + mm;
  }
  return { min, doy };
}

// 하늘 색 이정표: [해 기준 시각(분), 위쪽 색, 아래쪽(지평선) 색, 별 밝기, 주변 밝기]
const NIGHT = ["#050812", "#121a33", 1, 0];
function skyStops(rise, set) {
  return [
    [0, ...NIGHT],
    [rise - 75, ...NIGHT],
    [rise - 35, "#1a2150", "#5d4577", 0.5, 0.08],   // 새벽
    [rise, "#34437f", "#ee9466", 0.1, 0.32],          // 해돋이
    [rise + 45, "#5a8fd0", "#f1cfa2", 0, 0.7],        // 아침
    [rise + 120, "#4a86cf", "#a9cdeb", 0, 1],         // 낮
    [set - 90, "#4a86cf", "#a9cdeb", 0, 1],
    [set - 30, "#5b7dbd", "#f2b77a", 0, 0.8],         // 해 질 녘 (금빛)
    [set, "#3b3f86", "#ef7a4f", 0, 0.5],              // 노을
    [set + 25, "#252a64", "#b4506a", 0.2, 0.28],      // 붉은 여운
    [set + 55, "#111736", "#3a2f5c", 0.7, 0.1],       // 땅거미
    [set + 90, ...NIGHT],
    [1440, ...NIGHT],
  ];
}

function skyNow() {
  const { min, doy } = skyClock();
  const { rise, set } = sunTimes(doy);
  const st = skyStops(rise, set);
  let i = 0;
  while (i < st.length - 2 && min >= st[i + 1][0]) i++;
  const a = st[i], b = st[i + 1];
  const t = b[0] > a[0] ? Math.min(1, Math.max(0, (min - a[0]) / (b[0] - a[0]))) : 0;
  return {
    min, rise, set,
    top: mixHex(a[1], b[1], t),
    bottom: mixHex(a[2], b[2], t),
    stars: a[3] + (b[3] - a[3]) * t,
    amb: a[4] + (b[4] - a[4]) * t,
  };
}

function mixHex(h1, h2, t) {
  const a = parseInt(h1.slice(1), 16), b = parseInt(h2.slice(1), 16);
  const c = [16, 8, 0].map((sh) => Math.round(((a >> sh) & 255) + ((((b >> sh) & 255) - ((a >> sh) & 255)) * t)));
  return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
}

function drawSky(W, sky) {
  const bands = 20;
  for (let i = 0; i < bands; i++) {
    tx.fillStyle = mix(sky.top, sky.bottom, Math.pow(i / (bands - 1), 1.4));
    tx.fillRect(0, Math.floor((i * GROUND) / bands), W, Math.ceil(GROUND / bands) + 1);
  }

  if (sky.stars > 0.02) {
    for (let k = 0; k < blocks; k++) {
      for (const s of stars) {
        const tw = (Math.sin((frame + s.p) / 30) + 1) / 2;
        tx.fillStyle = `rgba(255,255,240,${(0.25 + tw * 0.6) * sky.stars})`;
        tx.fillRect(Math.round(s.x + k * BLOCK_W), Math.round(s.y), tw > 0.85 ? 2 : 1, tw > 0.85 ? 2 : 1);
      }
    }
  }

  // 해·달은 구름이 많을수록 가려짐
  tx.globalAlpha = 1 - (wx.cloud / 100) * 0.85;

  // 해: 해 뜰 때 왼쪽 지평선 → 한낮 꼭대기 → 해 질 때 오른쪽 지평선
  const span = (from, to, v) => (v - from) / (to - from);
  const horizon = 175, top = 34;
  const sunT = span(sky.rise, sky.set, sky.min);
  if (sunT > -0.04 && sunT < 1.04) {
    const x = 24 + sunT * (BLOCK_W - 48);
    const y = horizon - Math.sin(Math.max(0, Math.min(1, sunT)) * Math.PI) * (horizon - top);
    const low = 1 - Math.sin(Math.max(0, Math.min(1, sunT)) * Math.PI);  // 지평선 가까울수록 붉게
    tx.fillStyle = rgba(mixHex("#fff1b8", "#ff8a4c", low), 0.18);
    pixelCircle(Math.round(x), Math.round(y), 20);
    // 🌅 해 뜨는 순간 (앞뒤 5분): 햇살이 퍼짐
    if (Math.abs(sky.min - sky.rise) < 5) {
      const k = 1 - Math.abs(sky.min - sky.rise) / 5;
      tx.fillStyle = `rgba(255,214,150,${0.12 * k})`;
      for (let i = 0; i < 9; i++) {
        const a = -Math.PI + (i / 8) * Math.PI + Math.sin(frame / 90 + i) * 0.03;
        tx.beginPath();
        tx.moveTo(x, y);
        tx.lineTo(x + Math.cos(a - 0.05) * 420, y + Math.sin(a - 0.05) * 420);
        tx.lineTo(x + Math.cos(a + 0.05) * 420, y + Math.sin(a + 0.05) * 420);
        tx.closePath();
        tx.fill();
      }
    }
    tx.fillStyle = mixHex("#fff4c2", "#ff9a5a", low);
    pixelCircle(Math.round(x), Math.round(y), 11);
  }

  // 달: 해 지고 나서 떠서 해 뜨기 전에 짐
  const nightLen = 1440 - sky.set + sky.rise;
  const sinceSet = (sky.min - sky.set + 1440) % 1440;
  const moonT = sinceSet / nightLen;
  if (moonT > 0 && moonT < 1) {
    const x = 24 + moonT * (BLOCK_W - 48);
    const y = horizon - Math.sin(moonT * Math.PI) * (horizon - top - 10);
    const fade = Math.min(1, Math.min(moonT, 1 - moonT) * 8);
    tx.fillStyle = `rgba(246,239,201,${fade})`;
    pixelCrescent(Math.round(x), Math.round(y), 12, 7, -4, 10);
  }
  tx.globalAlpha = 1;

  drawClouds(W, sky);
}

// 초승달: 큰 원에서 옆으로 비킨 작은 원을 뺀 모양 (투명도를 줘도 얼룩이 안 생기게 직접 계산)
function pixelCrescent(cx, cy, r, ox, oy, r2) {
  for (let y = -r; y <= r; y += 2) {
    const w = Math.floor(Math.sqrt(r * r - y * y));
    let a = cx - w, b = cx + w;
    const dy = y - oy;
    if (Math.abs(dy) < r2) {
      const w2 = Math.floor(Math.sqrt(r2 * r2 - dy * dy));
      const c0 = cx + ox - w2, c1 = cx + ox + w2;
      if (c0 > a) tx.fillRect(a, cy + y, Math.min(b, c0) - a, 2);
      if (c1 < b) tx.fillRect(Math.max(a, c1), cy + y, b - Math.max(a, c1), 2);
      continue;
    }
    tx.fillRect(a, cy + y, b - a, 2);
  }
}

function pixelCircle(cx, cy, r) {
  for (let y = -r; y <= r; y += 2) {
    const w = Math.floor(Math.sqrt(r * r - y * y));
    tx.fillRect(cx - w, cy + y, w * 2, 2);
  }
}

// ---------- 동네 ----------
function drawFarCity(W, sky) {
  // 멀리 있는 건물 실루엣 (불 꺼진 장식, 사람 아님)
  tx.fillStyle = mix(sky.bottom, "#05070d", 0.72 - amb * 0.35);
  let x = 0, i = 0;
  while (x < W) {
    const w = 18 + Math.floor(rand(i + 100) * 26);
    const h = 40 + Math.floor(rand(i + 200) * 90);
    tx.fillRect(x, GROUND - h, w, h);
    x += w + Math.floor(rand(i + 300) * 4);
    i++;
  }
}

function drawBuilding(g, bx) {
  const top = ROOF_Y;
  // 벽
  tx.fillStyle = mixHex("#222738", "#6b7591", amb);
  tx.fillRect(bx, top, BW, GROUND - top);
  tx.fillStyle = mixHex("#2b3147", "#828ca8", amb);
  tx.fillRect(bx, top, 3, GROUND - top);
  tx.fillStyle = mixHex("#1a1e2c", "#58617c", amb);
  tx.fillRect(bx + BW - 3, top, 3, GROUND - top);

  // 옥상
  const roof = mixHex("#2b3147", "#5d6682", amb);
  tx.fillStyle = roof;
  tx.fillRect(bx - 2, top - 3, BW + 4, 3);
  const kind = g % 3;
  tx.fillStyle = roof;
  if (kind === 0) {
    tx.fillRect(bx + 50, top - 15, 16, 12);           // 물탱크
    tx.fillRect(bx + 52, top - 17, 12, 2);
  } else if (kind === 1) {
    tx.fillRect(bx + 18, top - 22, 2, 19);            // 안테나
    tx.fillRect(bx + 13, top - 18, 12, 2);
    if (Math.floor(frame / 40) % 2 === 0) {
      tx.fillStyle = "#ff5a5a";
      tx.fillRect(bx + 18, top - 24, 2, 2);
    }
  } else {
    for (let i = 0; i < BW; i += 6) tx.fillRect(bx + i, top - 8, 2, 5); // 난간
    tx.fillRect(bx, top - 8, BW, 2);
  }

  // 동 번호 (현관 옆 표지판)
  tx.fillStyle = "#2f3550";
  tx.fillRect(bx + 4, GROUND - 11, 24, 9);
  tx.fillStyle = "#aab2cc";
  tx.font = "bold 7px -apple-system, 'Noto Sans KR', sans-serif";
  tx.textAlign = "center";
  tx.textBaseline = "middle";
  tx.fillText(`${101 + g}동`, bx + 16, GROUND - 6.5);

  // 현관 (밤에는 더 환하게)
  tx.fillStyle = "#151925";
  tx.fillRect(bx + BW / 2 - 8, GROUND - 12, 16, 12);
  tx.fillStyle = `rgba(255, 200, 87, ${0.3 + nightLevel() * 0.45})`;
  tx.fillRect(bx + BW / 2 - 6, GROUND - 10, 12, 10);
}

function drawGround(W) {
  tx.fillStyle = mixHex("#121520", "#4a4f5c", amb);
  tx.fillRect(0, GROUND, W, H - GROUND);
  tx.fillStyle = "#2a2f40";
  for (let x = 6; x < W; x += 24) tx.fillRect(x, GROUND + 20, 12, 2);

  // 인도 (건물 앞 좁은 길 — 사람들이 걸어 다니는 곳)
  tx.fillStyle = mixHex("#1b1f2c", "#6a707e", amb);
  tx.fillRect(0, GROUND, W, 4);

  // 가로등 — 해가 지면 켜지고, 깊은 밤일수록 환하게 (편의점이 생기면 그 자리 가로등은 빼기)
  const store = townDone("편의점");
  const park = townDone("놀이터");
  const night = nightLevel();
  for (let x = 120; x < W; x += 122) {
    if (store && x === 242) continue;
    if (park && x === 120) continue;
    if (night > 0) {
      // 빛 기둥
      tx.fillStyle = `rgba(255, 214, 140, ${0.05 + night * 0.16})`;
      tx.beginPath();
      tx.moveTo(x - 2, GROUND - 40);
      tx.lineTo(x - 20, GROUND + 4);
      tx.lineTo(x + 18, GROUND + 4);
      tx.closePath();
      tx.fill();
      // 바닥에 고인 빛
      tx.fillStyle = `rgba(255, 214, 140, ${night * 0.22})`;
      tx.beginPath();
      tx.ellipse(x, GROUND + 3, 24, 5, 0, 0, Math.PI * 2);
      tx.fill();
      // 전구 주변 번짐
      tx.fillStyle = `rgba(255, 226, 160, ${night * 0.25})`;
      pixelCircle(x, GROUND - 41, 7);
    }
    tx.fillStyle = mixHex("#3a4058", "#5d6478", amb);
    tx.fillRect(x - 1, GROUND - 40, 2, 40);
    tx.fillStyle = night > 0 ? mixHex("#ffd78a", "#fff3cf", night) : "#9aa0ad";
    tx.fillRect(x - 3, GROUND - 42, 6, 3);
  }
}

// 0(낮) ~ 1(깊은 밤): 가로등·현관 불빛 세기
function nightLevel() {
  return Math.max(0, Math.min(1, (0.62 - amb) / 0.45));
}

// ---------- 🚶 들어오고 나가는 사람들 ----------
// 누가 들어오면: 길에서 걸어와 자기 동 현관으로 들어간 뒤 → 그 창문에 불이 켜짐
// 누가 나가면: 불이 꺼지고 → 현관에서 나와 길로 걸어감
// (실제로 들어오고 나가는 순간에만 나타나요. 옷 색 = 그 사람 조명 색)
const SKINS = ["#f1c9a5", "#e0ac7e", "#c68a5e", "#f5d6bd"];
const HAIRS = ["#2b2220", "#4a3326", "#1b1c22", "#7a5534", "#c9c3b8"];
const walkers = [];
const arriving = new Set();     // 아직 걸어오는 중인 창문 (도착하면 불이 켜짐)
const movedFrom = new Set();    // 이사 간 옛 자리 (나가는 사람으로 그리지 않기)

function doorX(n) {
  const { block, b } = slotOf(n);
  return block * BLOCK_W + BX[b] + BW / 2;
}

function makeWalker(n, c, x, v, mode, tx) {
  return {
    n, c, x, v, mode, tx, age: 0,
    fade: mode === "in" ? 1 : 0,
    skin: SKINS[Math.floor(rand(n * 11) * SKINS.length)],
    hair: HAIRS[Math.floor(rand(n * 17) * HAIRS.length)],
    // 나간 사람: 2~4분 동안 동네를 서성이다가 떠남
    life: (120 + Math.random() * 120) * 60,
    rest: 0, turnAt: 0,
  };
}

function blockEdges(n) {
  const { block } = slotOf(n);
  return [block * BLOCK_W - 8, (block + 1) * BLOCK_W + 8];
}

function walkIn(n, c, fromX) {
  const door = doorX(n);
  // 서성이던 사람이 다시 들어오면: 그 자리에서 바로 현관으로
  const wanderer = walkers.find((w) => w.n === n && w.mode === "out");
  if (wanderer) {
    Object.assign(wanderer, { mode: "in", tx: door, v: 0.9, c, rest: 0, task: null, hidden: false, fade: 1 });
    arriving.add(n);
    return;
  }
  if (walkers.some((w) => w.n === n && w.mode === "in")) return;
  let x = fromX;
  if (x === undefined) {
    // 화면(그 구역) 왼쪽 끝이나 오른쪽 끝 중 가까운 쪽에서 걸어 들어옴
    const [left, right] = blockEdges(n);
    x = door - left < right - door ? left : right;
  }
  arriving.add(n);
  walkers.push(makeWalker(n, c, x, 1.1, "in", door));
}

function walkOut(n, c) {
  walkers.push(makeWalker(n, c, doorX(n), 0, "out"));
  // 너무 많이 서성이면 가장 오래된 사람부터 먼저 떠나게
  const outs = walkers.filter((w) => w.mode === "out" && !w.leaving);
  if (outs.length > 15) outs[0].leaving = true;
}

// 서성이는 사람의 할 일: 🛝 그네 타기 / 🏪 편의점 들르기 (101~103동 구역에서만)
function pickTask(w) {
  if (slotOf(w.n).block !== 0 || Math.random() > 0.3) return false;
  const opts = [];
  const swingTaken = walkers.some((v) => v !== w && v.task && v.task.kind === "swing");
  if (townDone("놀이터") && !swingTaken) opts.push({ kind: "swing", x: 107 });
  if (townDone("편의점")) opts.push({ kind: "store", x: 254 });
  if (!opts.length) return false;
  w.task = { ...opts[Math.floor(Math.random() * opts.length)], on: false, t: 0 };
  return true;
}

function doTask(w) {
  const t = w.task;
  if (!t.on) {
    // 목적지까지 걸어가기
    const d = t.x - w.x;
    if (Math.abs(d) > 1) { w.x += Math.sign(d) * Math.min(0.5, Math.abs(d)); return true; }
    w.x = t.x;
    t.on = true;
    t.t = t.kind === "swing" ? 300 + Math.random() * 300 : 180 + Math.random() * 240;
    return false;
  }
  t.t--;
  if (t.kind === "store") {
    // 들어가서 잠시 안 보이다가 다시 나옴
    w.fade = t.t > 20 ? Math.max(0, w.fade - 1 / 10) : Math.min(1, w.fade + 1 / 10);
    w.hidden = w.fade <= 0;
  }
  if (t.t <= 0) {
    w.task = null;
    w.hidden = false;
    w.turnAt = frame + 60;
    w.v = (Math.random() < 0.5 ? -1 : 1) * 0.3;
  }
  return false;
}

// 그네 탄 모습: 의자에 앉아 다리를 앞으로
function drawSwinger(w, night) {
  const sw = swingSway();
  const x = 106 + sw, y = GROUND - 8;                 // 의자 위
  const shade = (hex) => mix(hex, "#0b0d14", Math.max(0, night * 0.15 - 0.15 * night));
  tx.globalAlpha = Math.max(0, Math.min(1, w.fade));
  tx.fillStyle = shade("#2a2e3c");
  tx.fillRect(x + 1, y, 4, 2);                          // 앞으로 뻗은 다리
  tx.fillStyle = shade(COLORS[w.c] || COLORS[0]);
  tx.fillRect(x - 2, y - 5, 4, 5);                      // 몸
  tx.fillStyle = shade(w.skin);
  tx.fillRect(x - 2, y - 8, 3, 3);                      // 얼굴
  tx.fillStyle = shade(w.hair);
  tx.fillRect(x - 2, y - 9, 3, 1);
  tx.globalAlpha = 1;
}

function drawWalkers() {
  const night = nightLevel();
  const W = blocks * BLOCK_W;
  for (let i = walkers.length - 1; i >= 0; i--) {
    const w = walkers[i];
    w.age++;
    let walking = true;
    if (w.mode === "in") {
      if (Math.abs(w.tx - w.x) > 1 && w.age < 900) {
        w.x += Math.sign(w.tx - w.x) * Math.min(Math.abs(w.v), Math.abs(w.tx - w.x));
      } else {
        // 현관 앞 도착 → 스르륵 들어가고 불 켜기
        walking = false;
        w.x = w.tx;
        w.fade -= 1 / 14;
        if (w.fade <= 0) {
          walkers.splice(i, 1);
          arriving.delete(w.n);
          pops.set(w.n, frame);
          if (w.n === myNo) lightAt = frame;
          continue;
        }
      }
    } else {
      w.fade = Math.min(1, w.fade + 1 / 14);
      if (!w.leaving && w.age > w.life && !(w.task && w.task.on)) { w.leaving = true; w.task = null; w.hidden = false; }
      const [left, right] = blockEdges(w.n);
      if (w.leaving) {
        // 가까운 끝 쪽으로 걸어가다 화면 밖으로
        if (!w.v || w.rest > 0) { w.v = (w.x - left < right - w.x ? -1 : 1) * 0.7; w.rest = 0; }
        w.x += w.v;
        if (w.x < left - 4 || w.x > right + 4) { walkers.splice(i, 1); continue; }
      } else if (w.rest > 0) {
        // 가만히 서 있기
        w.rest--;
        walking = false;
      } else if (w.task) {
        walking = doTask(w);
      } else {
        // 천천히 왔다 갔다 (가끔 그네를 타거나 편의점에 들름)
        if (frame >= w.turnAt && pickTask(w)) {
          walking = doTask(w);
        } else if (frame >= w.turnAt) {
          if (Math.random() < 0.4) { w.rest = 60 + Math.random() * 180; w.v = 0; }
          else w.v = (Math.random() < 0.5 ? -1 : 1) * (0.25 + Math.random() * 0.3);
          w.turnAt = frame + 60 + Math.random() * 240;
        }
        w.x += w.v;
        if (w.x < left + 12) { w.x = left + 12; w.v = Math.abs(w.v); }
        if (w.x > right - 12) { w.x = right - 12; w.v = -Math.abs(w.v); }
        if (!w.v) walking = false;
      }
    }

    if (w.hidden) continue;                              // 편의점 안에 들어가 있는 중
    if (w.task && w.task.kind === "swing" && w.task.on) { drawSwinger(w, night); continue; }

    const x = Math.round(w.x), y = GROUND + 3;          // 발 위치
    const step = walking ? Math.floor(frame / 8) % 2 : 0;
    const m = (((x - 120) % 122) + 122) % 122;          // 가로등 아래면 덜 어둡게
    const lit = night > 0 && Math.min(m, 122 - m) < 18 ? 0.25 * night : 0;
    const shade = (hex) => mix(hex, "#0b0d14", Math.max(0, night * 0.15 - lit));
    tx.globalAlpha = Math.max(0, Math.min(1, w.fade));
    // 키 13칸: 머리카락 1 + 얼굴 3 + 몸 5 + 다리 4
    tx.fillStyle = shade("#2a2e3c");                     // 다리 (걸을 때 번갈아)
    if (!walking) { tx.fillRect(x - 2, y - 4, 2, 4); tx.fillRect(x + 1, y - 4, 2, 4); }   // 서 있기
    else if (step) { tx.fillRect(x - 2, y - 4, 2, 4); tx.fillRect(x + 1, y - 3, 2, 3); }
    else { tx.fillRect(x - 2, y - 3, 2, 3); tx.fillRect(x + 1, y - 4, 2, 4); }
    tx.fillStyle = shade(COLORS[w.c] || COLORS[0]);      // 몸 (옷 = 그 사람 조명 색)
    tx.fillRect(x - 2, y - 9, 5, 5);
    tx.fillStyle = shade(w.skin);                         // 얼굴
    tx.fillRect(x - 1, y - 12, 3, 3);
    tx.fillStyle = shade(w.hair);                         // 머리카락
    tx.fillRect(x - 1, y - 13, 3, 1);
    tx.fillRect(x - 1, y - 12, 1, 1);
    tx.globalAlpha = 1;
  }
}

// 그네 흔들림 (그네 의자와 그네 탄 사람이 같이 움직이게)
function swingSway() {
  const rider = walkers.some((w) => w.task && w.task.kind === "swing" && w.task.on);
  return Math.round(Math.sin(frame / (rider ? 22 : 30)) * (rider ? 4 : 2));
}

// ---------- 🎉 단지 목표가 생기는 순간 ----------
// 접속해 있으면: "다 같이 켠 불로 ○○가 생겼어요!" + 반짝임
// 나중에 들어왔으면: 지난번에 본 것과 비교해서 "새로 생겼어요" 한 번
const GOAL_SEEN_KEY = "awake-goals-seen";
let goalsReady = false;
let goalsKnown = null;           // 지금까지 확인한 달성 목록
const sparkles = [];             // 생기는 순간 반짝이

const GOAL_SPOT = {
  "놀이터": { x: 119, y: GROUND - 12 },
  "편의점": { x: 242, y: GROUND - 14 },
  "별똥별": { x: 180, y: 60 },
  "버스": { x: 180, y: GROUND + 10 },
};

function checkGoals() {
  if (!goalsReady || !myNo) return;
  const done = TOWN_GOALS.filter((g) => townDone(g.name)).map((g) => g.name);
  if (goalsKnown === null) {
    // 처음 확인: 지난 방문 기록과 비교
    let seen = null;
    try { seen = JSON.parse(localStorage.getItem(GOAL_SEEN_KEY)); } catch (e) {}
    goalsKnown = new Set(done);
    if (Array.isArray(seen)) {
      const fresh = done.filter((n) => !seen.includes(n));
      if (fresh.length) {
        const names = fresh.map((n) => { const g = TOWN_GOALS.find((t) => t.name === n); return `${g.icon} ${g.name}`; });
        showToast(`새로 생겼어요: ${names.join(" · ")}`);
        fresh.forEach(sparkleAt);
      }
    }
    saveGoalsSeen(done);
    return;
  }
  for (const n of done) {
    if (goalsKnown.has(n)) continue;
    goalsKnown.add(n);
    const g = TOWN_GOALS.find((t) => t.name === n);
    showToast(`다 같이 켠 불로 ${g.icon} ${g.name}${/[가-힣]$/.test(g.name) && (g.name.charCodeAt(g.name.length - 1) - 0xac00) % 28 ? "이" : "가"} 생겼어요!`);
    sparkleAt(n);
    if (navigator.vibrate) navigator.vibrate([30, 40, 30]);
    saveGoalsSeen(done);
  }
}

function saveGoalsSeen(done) {
  try { localStorage.setItem(GOAL_SEEN_KEY, JSON.stringify(done)); } catch (e) {}
}

function sparkleAt(name) {
  const spot = GOAL_SPOT[name];
  if (!spot) return;
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * Math.PI * 2, sp = 0.4 + Math.random() * 1.3;
    sparkles.push({ x: spot.x, y: spot.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.6, life: 70 + Math.random() * 50, age: 0,
      c: ["#fcd34d", "#fff7d6", "#ff8fb1", "#8ec5ff"][i % 4] });
  }
}

function drawSparkles() {
  for (let i = sparkles.length - 1; i >= 0; i--) {
    const p = sparkles[i];
    p.age++;
    if (p.age > p.life) { sparkles.splice(i, 1); continue; }
    p.x += p.vx; p.y += p.vy; p.vy += 0.025;
    tx.globalAlpha = 1 - p.age / p.life;
    tx.fillStyle = p.c;
    const big = p.age % 20 < 10;
    tx.fillRect(Math.round(p.x), Math.round(p.y), big ? 2 : 1, big ? 2 : 1);
    tx.globalAlpha = 1;
  }
}

// ---------- 단지 공동 목표로 생기는 것들 ----------
function drawTownExtras(sky) {
  // 🛝 놀이터 (101동과 102동 사이): 그네 + 미끄럼틀 + 모래밭 + 작은 공원등
  if (townDone("놀이터")) {
    const night = nightLevel();
    const metal = mixHex("#4a5270", "#6f7894", amb);
    // 모래밭
    tx.fillStyle = mixHex("#5a4a34", "#c9a96b", amb);
    tx.fillRect(97, GROUND - 2, 44, 3);
    // 공원등 (밤에 놀이터를 비춤)
    if (night > 0) {
      tx.fillStyle = `rgba(255, 220, 150, ${0.06 + night * 0.14})`;
      tx.beginPath();
      tx.moveTo(118, GROUND - 26);
      tx.lineTo(100, GROUND + 3);
      tx.lineTo(138, GROUND + 3);
      tx.closePath();
      tx.fill();
    }
    tx.fillStyle = metal;
    tx.fillRect(118, GROUND - 26, 1, 26);
    tx.fillStyle = night > 0 ? "#fff0c4" : "#9aa0ad";
    tx.fillRect(116, GROUND - 28, 5, 2);
    // 그네 (기둥 2개 + 위 막대 + 줄 + 의자)
    tx.fillStyle = metal;
    tx.fillRect(99, GROUND - 20, 2, 20);
    tx.fillRect(113, GROUND - 20, 2, 20);
    tx.fillRect(99, GROUND - 21, 16, 2);
    const sw = swingSway();
    tx.fillRect(104 + sw, GROUND - 19, 1, 11);
    tx.fillRect(109 + sw, GROUND - 19, 1, 11);
    tx.fillStyle = "#e0795a";
    tx.fillRect(103 + sw, GROUND - 8, 8, 2);
    // 미끄럼틀 (사다리 + 위 발판 + 미끄러지는 판)
    tx.fillStyle = metal;
    tx.fillRect(137, GROUND - 18, 2, 18);
    for (let k = 0; k < 5; k++) tx.fillRect(135, GROUND - 3 - k * 3, 4, 1);
    tx.fillRect(132, GROUND - 18, 7, 2);
    tx.fillStyle = "#e9b949";
    for (let k = 0; k < 13; k++) tx.fillRect(131 - k, GROUND - 17 + Math.round(k * 1.25), 2, 2);
  }

  // 🏪 편의점 (102동과 103동 사이)
  if (townDone("편의점")) {
    tx.fillStyle = "rgba(255, 246, 207, 0.12)";
    tx.fillRect(214, GROUND - 4, 54, 8);
    tx.fillStyle = "#2d3348";
    tx.fillRect(222, GROUND - 26, 40, 26);
    tx.fillStyle = "#3fb37f";
    tx.fillRect(222, GROUND - 26, 40, 4);             // 간판 띠
    tx.fillStyle = "#fff6cf";
    tx.fillRect(225, GROUND - 19, 22, 13);            // 유리창
    tx.fillRect(250, GROUND - 19, 9, 19);             // 문
    tx.fillStyle = "#c9a96b";
    for (let k = 0; k < 3; k++) tx.fillRect(227 + k * 7, GROUND - 13, 4, 2); // 진열대
    tx.fillStyle = "#ffffff";
    tx.font = "bold 4px -apple-system, sans-serif";
    tx.textAlign = "center";
    tx.textBaseline = "middle";
    tx.fillText("24", 242, GROUND - 24);
  }

  // 🌠 새벽 3시 ~ 3시 15분: 별똥별비 (그 시간에 켜져 있는 사람만 볼 수 있음)
  if (isMeteorTime() && sky.stars > 0.15) {
    for (let lane = 0; lane < 4; lane++) {
      const cyc = (frame + lane * 37) % 110;
      if (cyc >= 34) continue;
      const seed = Math.floor((frame + lane * 37) / 110) * 7 + lane;
      const sx = 20 + rand(seed + 950) * (blocks * BLOCK_W - 80), sy = 6 + rand(seed + 951) * 70;
      const t = cyc / 34;
      for (let k = 0; k < 12; k++) {
        tx.fillStyle = `rgba(255,255,240,${(1 - k / 12) * (1 - t) * sky.stars})`;
        tx.fillRect(Math.round(sx + t * 80 - k * 3), Math.round(sy + t * 40 - k * 1.5), 2, 1);
      }
    }
  }

  // 🌠 별똥별 (밤하늘에서 가끔)
  if (townDone("별똥별") && sky.stars > 0) {
    const cyc = frame % 540;
    if (cyc < 36) {
      const seed = Math.floor(frame / 540);
      const sx = 60 + rand(seed + 900) * 220, sy = 14 + rand(seed + 901) * 50;
      const t = cyc / 36;
      for (let k = 0; k < 10; k++) {
        tx.fillStyle = `rgba(255,255,240,${(1 - k / 10) * (1 - t) * sky.stars})`;
        tx.fillRect(Math.round(sx + t * 70 - k * 3), Math.round(sy + t * 35 - k * 1.5), 2, 1);
      }
    }
  }

  // 🚌 버스 (가끔 지나감)
  if (townDone("버스")) {
    const W = blocks * BLOCK_W;
    const cyc = frame % 1500;
    const bxp = -40 + cyc * 0.8;
    if (bxp < W + 40) {
      const by = GROUND + 5;
      tx.fillStyle = "#3d8be0";
      tx.fillRect(bxp, by, 36, 13);
      tx.fillStyle = "#fff3c4";
      for (let k = 0; k < 4; k++) tx.fillRect(bxp + 3 + k * 7, by + 2, 5, 5);
      tx.fillStyle = "#ffe08a";
      tx.fillRect(bxp + 34, by + 8, 2, 3);            // 전조등
      tx.fillStyle = "#0b0d14";
      tx.fillRect(bxp + 5, by + 12, 5, 3);
      tx.fillRect(bxp + 26, by + 12, 5, 3);
    }
  }
}

// ---------- 창문 ----------
function drawWindow(n) {
  const { x, y } = winPos(n);
  const st = stateOf(n);
  const mine = n === myNo;

  // 창틀
  const offC = mixHex("#1c2131", "#3e4a66", amb);   // 불 꺼진 유리 (낮엔 하늘이 비쳐 밝게)
  tx.fillStyle = mixHex("#171b28", "#4a5370", amb);
  tx.fillRect(x - 1, y - 1, WIN_W + 2, WIN_H + 2);

  if (st.kind === "off") {
    tx.fillStyle = offC;
    tx.fillRect(x, y, WIN_W, WIN_H);
    tx.fillStyle = mixHex("#232a3d", "#7f97bd", amb);
    tx.fillRect(x, y, WIN_W, 2);
    hourWaveGlow(x, y);
    return;
  }

  const color = COLORS[st.c] || COLORS[0];
  // 잠깐 다른 앱에 간 사람(3분 유예)은 깜빡깜빡
  const blinkOff = st.kind === "on" && st.a && Math.floor(frame / 28) % 2 === 1;
  if (st.kind === "on" && !blinkOff) {
    // 은은한 빛 번짐 (숨 쉬듯)
    const breathe = (0.16 + Math.sin(frame / 50 + n) * 0.04) * (1 - amb * 0.7);
    tx.fillStyle = rgba(color, breathe);
    tx.fillRect(x - 4, y - 4, WIN_W + 8, WIN_H + 8);
    tx.fillStyle = color;
    tx.fillRect(x, y, WIN_W, WIN_H);
    tx.fillStyle = "rgba(255,255,255,0.35)";
    tx.fillRect(x + 1, y + 1, 3, 4);
  } else {
    // 흔적: 최근 24시간 안에 다녀간 창문은 희미하게
    tx.fillStyle = mix(color, offC, 0.72);
    tx.fillRect(x, y, WIN_W, WIN_H);
  }

  // ⭐ 집중 세션을 끝까지 해낸 창문: 오른쪽 위에 작은 별 (많을수록 색이 진해짐)
  if (st.st > 0) {
    const sc = st.st >= 30 ? "#ff9f43" : st.st >= 10 ? "#fcd34d" : "#fff7d6";
    tx.fillStyle = st.kind === "on" ? sc : mix(sc, offC, 0.5);
    tx.fillRect(x + WIN_W - 1, y - 4, 1, 3);
    tx.fillRect(x + WIN_W - 2, y - 3, 3, 1);
  }
  // 🎯 지금 집중 세션 중인 창문: 아래에 노란 밑줄
  if (st.kind === "on" && st.f) {
    tx.fillStyle = "#fcd34d";
    tx.fillRect(x, y + WIN_H + 1, WIN_W, 1);
  }

  // 오래 켜둔 창문 꾸미기 (총 켜둔 시간)
  const hrs = (st.h || 0) / 3600;
  const dim = st.kind === "on" ? 0 : 0.5;
  const at = (name) => GROWTH.find((g) => g.name === name).h;   // 위 GROWTH 숫자만 바꾸면 그림도 따라감
  if (hrs >= at("커튼")) {
    tx.fillStyle = mix(color, "#3b1f3a", 0.55 + dim * 0.3);
    tx.fillRect(x, y, 2, WIN_H);
    tx.fillRect(x + WIN_W - 2, y, 2, WIN_H);
    tx.fillRect(x, y, WIN_W, 1);
  }
  if (hrs >= at("새싹") && hrs < at("화분")) {
    // 🌱 새싹
    tx.fillStyle = mix("#5fbf5a", "#1c2131", dim);
    tx.fillRect(x + 6, y + WIN_H - 3, 1, 3);
    tx.fillRect(x + 5, y + WIN_H - 4, 1, 1);
    tx.fillRect(x + 7, y + WIN_H - 5, 1, 2);
  }
  if (hrs >= at("화분")) {
    tx.fillStyle = mix("#5fbf5a", "#1c2131", dim);
    tx.fillRect(x + 6, y + WIN_H - 6, 1, 2);
    tx.fillRect(x + 7, y + WIN_H - 7, 2, 2);
    tx.fillRect(x + 5, y + WIN_H - 7, 1, 1);
    tx.fillStyle = mix("#b0643a", "#1c2131", dim);
    tx.fillRect(x + 5, y + WIN_H - 3, 4, 3);
  }
  if (hrs >= at("고양이")) drawCat(x, y, n, dim, offC);
  if (hrs >= at("꼬마전구")) {
    // ✨ 꼬마전구 (반짝반짝)
    const bulbs = ["#ff6b6b", "#ffd93d", "#6bcBff", "#9BE38A"];
    for (let k = 0; k < 5; k++) {
      const on = (Math.floor(frame / 15) + k) % 3 !== 0;
      tx.fillStyle = on ? bulbs[k % 4] : "#3a3f55";
      tx.fillRect(x + k * 2, y + 1 + (k % 2), 1, 1);
    }
  }

  if (mine && st.kind === "on" && !closeUpMode) {
    tx.strokeStyle = "rgba(255,255,255,0.9)";
    tx.lineWidth = 1;
    tx.strokeRect(x - 2.5, y - 2.5, WIN_W + 5, WIN_H + 5);
  }
  hourWaveGlow(x, y);
}

// 🐈 창가의 고양이: 창문마다 종류가 정해져 있어서(번호로 결정) 모두에게 같은 고양이가 보여요
const CATS = [
  { name: "까망이", body: "#1b1c22", eye: "#f5d142" },
  { name: "치즈", body: "#f0a04b", stripe: "#c06f2a", eye: "#3b2a1a" },
  { name: "회색이", body: "#8a8f9c", stripe: "#6b707c", eye: "#9be38a" },
  { name: "흰둥이", body: "#f2f0ea", eye: "#4aa3ff" },
  { name: "턱시도", body: "#1b1c22", chest: "#f2f0ea", eye: "#9be38a" },
  { name: "삼색이", body: "#f2f0ea", patchA: "#f0a04b", patchB: "#1b1c22", eye: "#3b2a1a" },
  { name: "샴", body: "#e8d8be", mask: "#5a4031", eye: "#4aa3ff" },
];

function catOf(n) {
  return CATS[Math.floor(rand(n * 7 + 3) * CATS.length)];
}

function drawCat(x, y, n, dim, offC) {
  const cat = catOf(n);
  const c = (hex) => (dim ? mix(hex, offC, dim) : hex);
  const px = (dx, dy, w = 1, h = 1) => tx.fillRect(x + dx, y + dy, w, h);
  // 앉아 있는 모습 (창문 왼쪽 아래, 가로 5칸 × 세로 7칸)
  tx.fillStyle = c(cat.body);
  px(0, 5); px(4, 5);                 // 귀
  px(0, 6, 5, 3);                     // 머리
  px(0, 9, 4, 3);                     // 몸
  px(4, 10, 1, 2);                    // 꼬리
  if (cat.stripe) {                   // 줄무늬 (이마 + 몸)
    tx.fillStyle = c(cat.stripe);
    px(2, 6); px(1, 10); px(3, 10);
  }
  if (cat.chest) {                    // 턱시도: 하얀 가슴·입가
    tx.fillStyle = c(cat.chest);
    px(1, 9, 2, 3); px(2, 8);
  }
  if (cat.patchA) {                   // 삼색이: 얼룩
    tx.fillStyle = c(cat.patchA);
    px(0, 5); px(0, 6, 2, 1); px(3, 10, 1, 2);
    tx.fillStyle = c(cat.patchB);
    px(4, 5); px(3, 6, 2, 1); px(0, 10);
  }
  if (cat.mask) {                     // 샴: 진한 얼굴·귀·꼬리
    tx.fillStyle = c(cat.mask);
    px(0, 5); px(4, 5); px(1, 7, 3, 2); px(4, 10, 1, 2);
  }
  // 눈 (가끔 깜빡) + 분홍 코
  const blink = (frame + n * 37) % 260 < 7;
  tx.fillStyle = c(blink ? (cat.mask || cat.body) : cat.eye);
  px(1, 7); px(3, 7);
  tx.fillStyle = c("#f29bb0");
  px(2, 8);
}

// ✨ 정각 파도: 매 정각, 단지 전체 창문에 왼쪽에서 오른쪽으로 불빛이 지나감
function hourWaveGlow(x, y) {
  const t = frame - hourWaveAt;
  if (t < 0 || t > 220) return;
  const W = blocks * BLOCK_W;
  const wx = (t / 180) * (W + 80) - 40 - (GROUND - y) * 0.15;   // 살짝 기울어진 파도
  const k = 1 - Math.abs(x - wx) / 26;
  if (k <= 0) return;
  tx.fillStyle = `rgba(255,236,170,${k * 0.75})`;
  tx.fillRect(x, y, WIN_W, WIN_H);
}

function drawEffects() {
  // 불이 켜지는 순간 반짝
  for (const [n, start] of pops) {
    const t = (frame - start) / 36;
    if (t > 1) { pops.delete(n); continue; }
    const { x, y } = winPos(n);
    const st = stateOf(n);
    const color = COLORS[st.c] || COLORS[0];
    const r = 4 + t * 16;
    tx.strokeStyle = rgba(color, 1 - t);
    tx.lineWidth = 2;
    tx.strokeRect(x - r, y - r, WIN_W + r * 2, WIN_H + r * 2);
  }

  // 내 불이 켜지는 순간 (딸깍)
  if (myNo && lightAt >= 0 && frame - lightAt < 50) {
    const t = (frame - lightAt) / 50;
    const { x, y } = winPos(myNo);
    tx.fillStyle = `rgba(255,255,255,${0.9 * (1 - t)})`;
    tx.fillRect(x - 2, y - 2, WIN_W + 4, WIN_H + 4);
    tx.fillStyle = rgba(COLORS[look.c], 0.35 * (1 - t));
    tx.fillRect(x - 14 * t - 4, y - 14 * t - 4, WIN_W + 28 * t + 8, WIN_H + 28 * t + 8);
  }

  // 날아가는 👋
  for (let i = waves.length - 1; i >= 0; i--) {
    const w = waves[i];
    const t = (frame - w.start) / 70;
    if (t > 1.35) { waves.splice(i, 1); continue; }
    const to = winPos(w.to);
    const tox = to.x + WIN_W / 2, toy = to.y + WIN_H / 2;
    if (t <= 1) {
      const from = w.from ? winPos(w.from) : { x: tox, y: 0 };
      const fx = from.x + WIN_W / 2, fy = from.y + WIN_H / 2;
      const cx = (fx + tox) / 2, cy = Math.min(fy, toy) - 70;
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const px = (1 - e) * (1 - e) * fx + 2 * (1 - e) * e * cx + e * e * tox;
      const py = (1 - e) * (1 - e) * fy + 2 * (1 - e) * e * cy + e * e * toy;
      tx.save();
      tx.translate(px, py);
      tx.rotate(Math.sin(frame / 4) * 0.35);
      tx.font = "16px 'Apple Color Emoji', 'Noto Color Emoji', sans-serif";
      tx.textAlign = "center";
      tx.textBaseline = "middle";
      tx.fillText("👋", 0, 0);
      tx.restore();
    } else {
      // 도착: 창문이 반짝
      const k = (t - 1) / 0.35;
      tx.strokeStyle = `rgba(255,255,255,${1 - k})`;
      tx.lineWidth = 2;
      const r = 3 + k * 14;
      tx.strokeRect(to.x - r, to.y - r, WIN_W + r * 2, WIN_H + r * 2);
    }
  }

  // 누른 창문 표시
  if (selectedN) {
    const { x, y } = winPos(selectedN);
    const on = Math.floor(frame / 20) % 2 === 0;
    tx.strokeStyle = on ? "#fcd34d" : "rgba(252,211,77,0.4)";
    tx.lineWidth = 1.5;
    tx.strokeRect(x - 3.5, y - 3.5, WIN_W + 7, WIN_H + 7);
  }

  // 내 창문 이름표
  if (myNo && stateOf(myNo).kind === "on") {
    const { x, y } = winPos(myNo);
    const bob = Math.round(Math.sin(frame / 25) * 1.5);
    tx.fillStyle = "#fcd34d";
    tx.beginPath();
    tx.moveTo(x + WIN_W / 2 - 3, y - 8 + bob);
    tx.lineTo(x + WIN_W / 2 + 3, y - 8 + bob);
    tx.lineTo(x + WIN_W / 2, y - 4 + bob);
    tx.closePath();
    tx.fill();
    tx.font = "bold 9px -apple-system, 'Noto Sans KR', sans-serif";
    const label = "나";
    const lw = tx.measureText(label).width + 8;
    roundRect(x + WIN_W / 2 - lw / 2, y - 20 + bob, lw, 12, 6);
    tx.fill();
    tx.fillStyle = "#2a1f00";
    tx.textAlign = "center";
    tx.textBaseline = "middle";
    tx.fillText(label, x + WIN_W / 2, y - 13.5 + bob);
  }
}

function roundRect(x, y, w, h, r) {
  tx.beginPath();
  tx.moveTo(x + r, y);
  tx.arcTo(x + w, y, x + w, y + h, r);
  tx.arcTo(x + w, y + h, x, y + h, r);
  tx.arcTo(x, y + h, x, y, r);
  tx.arcTo(x, y, x + w, y, r);
  tx.closePath();
}

// ---------- 그리기 ----------
function sizeCanvas() {
  const total = Math.max(dbTotal, myNo || 0, ...online.keys(), 1);
  const need = Math.max(1, Math.ceil(total / PER_BLOCK));
  if (need === blocks && town.width === need * BLOCK_W * 2) return;
  blocks = need;
  town.width = blocks * BLOCK_W * 2;
  town.height = H * 2;
  town.style.width = `${blocks * 100}%`;
  tx.setTransform(2, 0, 0, 2, 0, 0);
}

function draw() {
  const W = blocks * BLOCK_W;
  const sky = skyNow();
  // 흐리면 하늘이 회색빛으로, 별은 가려지고, 조금 어둑해짐
  const oc = wx.cloud / 100;
  const gray = mixHex("#1b1f2c", "#9aa2b1", sky.amb);
  sky.top = mixHex(sky.top, gray, oc * 0.55);
  sky.bottom = mixHex(sky.bottom, gray, oc * 0.45);
  sky.stars *= Math.pow(1 - oc, 2);
  amb = sky.amb * (1 - oc * 0.25);
  drawSky(W, sky);
  drawFarCity(W, sky);
  drawGround(W);
  drawTownExtras(sky);
  for (let k = 0; k < blocks; k++) {
    for (let b = 0; b < 3; b++) drawBuilding(k * 3 + b, k * BLOCK_W + BX[b]);
  }
  for (let n = 1; n <= blocks * PER_BLOCK; n++) drawWindow(n);
  drawWalkers();
  drawSparkles();
  drawWeatherFront(W);
  drawEffects();
}

function loop() {
  frame++;
  draw();
  drawCloseUps();
  requestAnimationFrame(loop);
}

// 🔍 창문 가까이 보기: 큰 그림에서 창문 주변을 잘라 확대 (꾸미기가 잘 보이게)
const myView = $("myView"), myViewCtx = myView.getContext("2d");
const peekView = $("peekView"), peekViewCtx = peekView.getContext("2d");

let closeUpMode = false;

// 창문 하나만 벽과 함께 크게 다시 그리기 (큰 그림과 같은 함수로 그려서 꾸미기가 똑같이 보임)
function closeUp(g, cv, n, cw, ch) {
  const { x, y } = winPos(n);
  const sx = x + WIN_W / 2 - cw / 2, sy = y + WIN_H / 2 - ch / 2 - 1;
  const k = cv.width / cw;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.imageSmoothingEnabled = false;
  g.fillStyle = mixHex("#222738", "#6b7591", amb);      // 건물 벽
  g.fillRect(0, 0, cv.width, cv.height);
  g.setTransform(k, 0, 0, k, -sx * k, -sy * k);
  const saved = tx;
  tx = g;
  closeUpMode = true;
  try { drawWindow(n); } finally { tx = saved; closeUpMode = false; }
}

function drawCloseUps() {
  if (myNo && !mineEl.hidden && frame % 2 === 0) closeUp(myViewCtx, myView, myNo, 22, 25);
  if (selectedN && !peekEl.hidden) closeUp(peekViewCtx, peekView, selectedN, 18, 21);
}

// ---------- 글자 갱신 ----------
function updateCounts() {
  if (!db) {
    nowCountEl.textContent = "준비 중이에요 🛠️";
    dayCountEl.textContent = "";
    return;
  }
  if (connected || realtimeFailed) {
    nowCountEl.innerHTML = `지금 깨어 있는 사람 <b>${Math.max(online.size, myNo ? 1 : 0)}</b>명`;
  } else {
    nowCountEl.textContent = myNo ? "내 창문에 불을 켰어요 · 이웃 찾는 중…" : "불 켜는 중…";
  }
  const visited = new Set([...recent.keys(), ...online.keys()]);
  dayCountEl.textContent = visited.size
    ? `최근 24시간 동안 ${visited.size}명이 다녀갔어요`
    : "";
}

function hms(sec) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), x = sec % 60;
  return [h, m, x].map((v) => String(v).padStart(2, "0")).join(":");
}

function dur(sec) {
  // 3시간 12분 / 42분 / 1분 미만
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  if (h && m) return `${h}시간 ${m}분`;
  if (h) return `${h}시간`;
  if (m) return `${m}분`;
  return "1분 미만";
}

function updateMine() {
  if (!myNo) { mineEl.hidden = true; findBtn.hidden = true; return; }
  mineEl.hidden = false;
  findBtn.hidden = false;
  $("myAddr").textContent = addr(myNo);
  const w = wavesToday();
  $("myWaves").textContent = w ? `오늘 받은 👋 ${w}` : "";
  tick();
}

// 1초마다: 타이머, 창문 성장, 단지 목표, 무드등 시계
function tick() {
  const extra = liveExtra();
  if (myNo) {
    const total = myTotal + extra;
    const hrs = total / 3600;
    const next = GROWTH.find((g) => hrs < g.h);
    const lines = [`지금까지 총 <b>${dur(total)}</b> 켜 뒀어요`];
    lines.push(next
      ? `다음 꾸미기 ${next.icon} ${next.name}까지 ${dur(Math.ceil(next.h * 3600 - total))}`
      : "꾸미기를 모두 모았어요");
    $("growth").innerHTML = lines.join("<br>");
  }
  updateGoal();
  updateWeatherLabel();
  updateHud(extra);
  updateFocus();
  checkMoments();
  checkGoals();
}

// 정보판을 누르면 시계만 남기고 접기 (기기에 기억)
const HUD_KEY = "awake-hud";
const hudEl = $("hud");
try { if (localStorage.getItem(HUD_KEY) === "min") hudEl.classList.add("is-collapsed"); } catch (e) {}

function toggleHud() {
  const min = hudEl.classList.toggle("is-collapsed");
  try { localStorage.setItem(HUD_KEY, min ? "min" : "full"); } catch (e) {}
  fitMood();
}

// 화면 켜 두기: 시계·아래 글줄을 빼고 남은 높이에 맞춰 그림을 최대한 크게 (그림 비율 3:4)
function fitMood() {
  if (!moodOn) return;
  const topPad = 64, gap = 18, bar = 44, bottomPad = 20;
  const availH = window.innerHeight - topPad - hudEl.offsetHeight - gap - bar - bottomPad;
  const w = Math.max(180, Math.min(window.innerWidth - 24, availH * (BLOCK_W / H)));
  document.body.style.setProperty("--mood-w", `${Math.floor(w)}px`);
}

window.addEventListener("resize", fitMood);

hudEl.addEventListener("click", toggleHud);
hudEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleHud(); }
});

// 하늘 위 정보판: 시계·날짜 / 해 뜨고 지기까지 / 오늘 켜둔 시간
// (서울 시각 — 하늘 색과 같은 기준이라 ?sky= 옵션도 따라감)
function updateHud(extra) {
  const { min, doy } = skyClock();
  const m = Math.floor(min);
  $("hudClock").textContent = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

  const k = new Date(Date.now() + tzOffset() * 60000);
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  $("hudDate").textContent = `${k.getUTCMonth() + 1}월 ${k.getUTCDate()}일 (${days[k.getUTCDay()]})`;

  const { rise, set } = sunTimes(doy);
  let sun;
  if (min < rise) sun = `해 뜨기까지 ${dur(Math.round((rise - min) * 60))}`;
  else if (min < set) sun = `해 지기까지 ${dur(Math.round((set - min) * 60))}`;
  else sun = `내일 해 뜨기까지 ${dur(Math.round((1440 - min + sunTimes(doy + 1).rise) * 60))}`;
  $("hudSun").textContent = sun;

  $("hudTimer").innerHTML = myNo ? `오늘 불 켜둔 시간 <b>${hms(myToday + extra)}</b>` : "";
  $("hudFocus").innerHTML = sessionGoal ? `집중 세션 <b>${hms(sessionLeft())}</b> 남음` : "";
}

function updateGoal() {
  const box = $("goal");
  if (!db || !myNo) { box.hidden = true; return; }
  const hrs = (townSec + liveExtra()) / 3600;
  const next = TOWN_GOALS.find((g) => hrs < g.h);
  const done = TOWN_GOALS.filter((g) => hrs >= g.h);
  box.hidden = false;

  if (!next) {
    $("goalTitle").textContent = "단지 목표를 모두 이뤘어요 🎉";
    $("goalCount").textContent = `${hrs.toFixed(1)}시간`;
    $("goalFill").style.width = "100%";
    $("goalNext").textContent = `생긴 것: ${done.map((g) => `${g.icon} ${g.name}`).join(" · ")} · 다음 목표 준비 중 🛠️`;
    return;
  }
  const prev = done.length ? done[done.length - 1].h : 0;
  $("goalTitle").textContent = `다 같이 켠 불로 ${next.icon} ${next.name} 짓는 중`;
  $("goalCount").textContent = `${hrs.toFixed(1)} / ${next.h}시간`;
  $("goalFill").style.width = `${Math.min(100, Math.max(0, ((hrs - prev) / (next.h - prev)) * 100))}%`;
  const later = TOWN_GOALS.filter((g) => g.h > next.h).map((g) => `${g.icon} ${g.h}시간`);
  const lines = [];
  if (done.length) lines.push(`생긴 것: ${done.map((g) => `${g.icon} ${g.name}`).join(" · ")}`);
  if (later.length) lines.push(`다음: ${later.join(" · ")}`);
  $("goalNext").innerHTML = lines.join("<br>");
}

function renderOptions() {
  const colors = $("colors"), statuses = $("statuses");
  colors.innerHTML = statuses.innerHTML = "";
  COLORS.forEach((c, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "swatch" + (look.c === i ? " is-on" : "");
    b.style.background = c;
    b.setAttribute("aria-label", `조명 ${COLOR_NAMES[i]}`);
    b.setAttribute("aria-pressed", look.c === i);
    b.addEventListener("click", () => changeLook({ c: i }));
    colors.append(b);
  });
  STATUS_CHIPS.forEach((label, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip" + (look.s === i ? " is-on" : "");
    b.textContent = label;
    b.setAttribute("aria-pressed", look.s === i);
    b.addEventListener("click", () => changeLook({ s: i }));
    statuses.append(b);
  });
}

// ---------- 창문 누르기 ----------
town.addEventListener("click", (e) => {
  const rect = town.getBoundingClientRect();
  const lx = ((e.clientX - rect.left) / rect.width) * blocks * BLOCK_W;
  const ly = ((e.clientY - rect.top) / rect.height) * H;
  const n = numberAt(lx, ly);
  if (!n) { closePeek(); return; }
  if (n === myNo) { closePeek(); pops.set(n, frame); return; }   // 내 창문 정보는 아래 '내 창문'에 이미 있음
  openPeek(n);
});

function isEmptyHouse(n) {
  return n !== myNo && !taken.has(n) && !online.has(n) && !recent.has(n);
}

function openPeek(n) {
  if (selectedN !== n) resetMoveBtn();
  selectedN = n;
  const st = stateOf(n);
  peekAddr.textContent = addr(n);
  waveBtn.hidden = true;
  moveBtn.hidden = true;

  if (n === myNo) {
    peekAddr.textContent = `${addr(n)} · 내 창문`;
    peekState.textContent = STATUS_TEXT[look.s];
  } else if (st.kind === "on") {
    peekState.textContent = `${STATUS_TEXT[st.s] || STATUS_TEXT[0]} · ${st.a ? "잠깐 자리 비움" : st.f ? "집중하는 중" : "지금 깨어 있어요"}`
      + (st.st ? ` · 별 ${st.st}개` : "");
    waveBtn.hidden = false;
    waveBtn.disabled = false;
  } else if (st.kind === "ember") {
    peekState.textContent = `${ago(st.t)}에 불을 껐어요`;
  } else if (!isEmptyHouse(n)) {
    peekState.textContent = "오늘은 불이 꺼져 있어요";
  } else {
    peekState.textContent = "아직 아무도 살지 않는 집이에요";
    moveBtn.hidden = !myNo;
  }
  peekEl.hidden = false;
}

function closePeek() {
  selectedN = null;
  peekEl.hidden = true;
  resetMoveBtn();
}

// ---------- 🏠 이사하기 ----------
const moveBtn = $("moveBtn");

function resetMoveBtn() {
  moveArm = null;
  clearTimeout(resetMoveBtn.timer);
  moveBtn.textContent = "🏠 여기로 이사";
  moveBtn.classList.remove("is-armed");
  moveBtn.disabled = false;
}

moveBtn.addEventListener("click", async () => {
  const to = selectedN;
  if (!to || !myNo || !db) return;
  if (moveArm !== to) {
    // 실수로 이사하지 않게 한 번 더 누르기
    moveArm = to;
    moveBtn.textContent = "한 번 더 누르면 이사해요";
    moveBtn.classList.add("is-armed");
    clearTimeout(resetMoveBtn.timer);
    resetMoveBtn.timer = setTimeout(resetMoveBtn, 3000);
    return;
  }
  moveBtn.disabled = true;
  const { data, error } = await db.rpc("move_window", { p_player_id: getPlayerId(), p_seat: to }).single();
  resetMoveBtn();
  if (error || !data) {
    const msg = error && /[가-힣]/.test(error.message || "") ? error.message : "이사하지 못했어요 😢";
    showToast(msg);
    loadWindows();
    return;
  }
  const from = myNo;
  myNo = Number(data.my_window_no);
  taken.delete(from);
  taken.add(myNo);
  if (recent.has(from)) { recent.set(myNo, recent.get(from)); recent.delete(from); }
  if (channel && connected) channel.send({ type: "broadcast", event: "move", payload: { from, to: myNo } });
  walkIn(myNo, look.c, doorX(from));   // 옛집 현관에서 새집 현관까지 걸어가기
  updateMine();
  closePeek();
  showToast(`${addr(myNo)}로 이사했어요`);
  await rejoinRoom();
  loadWindows();
});

function onMove({ from, to }) {
  if (!Number.isInteger(from) || !Number.isInteger(to) || to === myNo) return;
  if (recent.has(from)) { recent.set(to, recent.get(from)); recent.delete(from); }
  taken.delete(from);
  taken.add(to);
  movedFrom.add(from);
  walkIn(to, (recent.get(to) || {}).c || 0, doorX(from));
  if (selectedN === from || selectedN === to) openPeek(selectedN);
}

// ---------- 👋 손 흔들기 ----------
waveBtn.addEventListener("click", async () => {
  const to = selectedN;
  if (!to || !myNo) return;
  if (!connected) {
    showToast(realtimeFailed ? "실시간 연결이 안 돼서 👋를 보낼 수 없어요" : "이웃 찾는 중이에요. 잠시만요");
    return;
  }
  if (!online.has(to)) {
    showToast("방금 불이 꺼졌어요");
    openPeek(to);
    return;
  }
  const now = Date.now();
  if (now - lastWaveAt < WAVE_COOLDOWN_MS) {
    showToast("잠깐 뒤에 다시 보낼 수 있어요");
    return;
  }
  lastWaveAt = now;
  waveBtn.disabled = true;
  setTimeout(() => (waveBtn.disabled = false), WAVE_COOLDOWN_MS);

  waves.push({ from: myNo, to, start: frame });
  await channel.send({ type: "broadcast", event: "wave", payload: { from: myNo, to } });
  showToast(`${addr(to)}에 👋 보냈어요`);
});

function onWave({ from, to }) {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from === myNo) return;
  waves.push({ from, to, start: frame });
  if (to === myNo) {
    addWaveToday();
    updateMine();
    showToast(`👋 ${addr(from)}에서 손을 흔들었어요`);
    if (navigator.vibrate) navigator.vibrate(30);
  }
}

// ---------- 내 창문 찾기 ----------
findBtn.addEventListener("click", () => {
  if (!myNo) return;
  const { x } = winPos(myNo);
  const ratio = x / (blocks * BLOCK_W);
  scroller.scrollTo({ left: ratio * scroller.scrollWidth - scroller.clientWidth / 2, behavior: "smooth" });
  closePeek();
  pops.set(myNo, frame);
});

// ---------- 조명·상태 바꾸기 ----------
let lookTimer = null;
function changeLook(patch) {
  Object.assign(look, patch);
  saveLook();
  renderOptions();
  if (myNo) {
    pops.set(myNo, frame);
    if (selectedN === myNo) openPeek(myNo);
    if (tracking) track();
  }
  clearTimeout(lookTimer);
  lookTimer = setTimeout(lightWindow, 800);
}

// ---------- 기기 고유번호 ----------
let memoryPlayerId = null;

function makeId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function getPlayerId() {
  try {
    let id = localStorage.getItem(PLAYER_KEY);
    if (!id) {
      id = makeId();
      localStorage.setItem(PLAYER_KEY, id);
    }
    return id;
  } catch (e) {
    if (!memoryPlayerId) memoryPlayerId = makeId();
    return memoryPlayerId;
  }
}

// ---------- DB ----------
async function lightWindow() {
  if (!db) return false;
  const { data, error } = await db
    .rpc("light_window", { p_player_id: getPlayerId(), p_color: look.c, p_status: look.s })
    .single();
  if (error || !data) {
    console.error(error);
    const msg = error && /[가-힣]/.test(error.message || "") ? error.message : "불을 켜지 못했어요 😢";
    showToast(msg);
    return false;
  }
  const first = myNo === null;
  myNo = Number(data.my_window_no);
  myTotal = Number(data.my_total_sec) || 0;
  myToday = Number(data.my_today_sec) || 0;
  townSec = Math.max(townSec, Number(data.town_sec) || 0);
  myStars = Number(data.my_stars) || 0;
  const hadGoal = sessionGoal;
  sessionGoal = data.my_session_goal ? Number(data.my_session_goal) : null;
  sessionSec = Number(data.my_session_sec) || 0;
  syncedAt = performance.now();
  counting = document.visibilityState === "visible";
  sessionClosing = false;
  if (data.session_result === "done") onSessionDone(hadGoal);
  else if (data.session_result === "failed") {
    showToast("3분 넘게 나가 있어서 집중 세션이 끝났어요");
  }
  if (hadGoal !== sessionGoal && tracking) track();
  updateFocus();
  renderDays();
  if (first) {
    walkIn(myNo, look.c);     // 걸어 들어가서 불 켜기 (도착하면 딸깍)
    showToast(`${addr(myNo)}에 불을 켰어요`);
  }
  sizeCanvas();
  updateMine();
  return true;
}

async function loadWindows() {
  if (!db) return;
  const { data, error } = await db.rpc("get_windows");
  if (error || !data) { console.error(error); return; }
  dbTotal = Number(data.total) || 0;
  taken = new Set((data.taken || []).map(Number));
  townSec = Number(data.town_sec) || townSec;
  recent = new Map(data.windows.map((w) => [Number(w.n), { c: w.c, s: w.s, h: Number(w.h) || 0, t: w.t, st: Number(w.st) || 0 }]));
  if (realtimeFailed) {
    // 실시간 연결이 안 되면: 최근 6분 안에 기록이 있는 창문을 깨어 있는 걸로 표시
    const cut = Date.now() - FALLBACK_AWAKE_MS;
    online = new Map();
    for (const [n, w] of recent) if (new Date(w.t).getTime() > cut) online.set(n, { c: w.c, s: w.s });
  }
  sizeCanvas();
  updateCounts();
}

// ---------- 실시간: 지금 깨어 있는 사람 ----------
function joinRoom() {
  if (!db || !myNo || channel) return;
  const ch = (channel = db.channel(ROOM, {
    config: { presence: { key: String(myNo) }, broadcast: { self: false } },
  }));

  let firstSync = true;
  channel
    .on("presence", { event: "sync" }, () => {
      if (ch !== channel) return;   // 이사 전에 쓰던 채널이면 무시
      const state = channel.presenceState();
      const next = new Map();
      for (const key of Object.keys(state)) {
        const meta = state[key][state[key].length - 1] || {};
        const n = Number(meta.w);
        if (!Number.isInteger(n) || n < 1 || String(n) !== key) continue;
        next.set(n, {
          c: clampInt(meta.c, COLORS.length),
          s: clampInt(meta.s, STATUS_CHIPS.length),
          a: meta.a === 1,      // 잠깐 자리 비움 (깜빡임)
          f: meta.f === 1,      // 집중 세션 중
        });
      }
      for (const n of next.keys()) {
        if (!online.has(n) && !firstSync && n !== myNo) walkIn(n, next.get(n).c);
        if (!online.has(n) && !firstSync && n !== myNo && next.size <= 30) {
          showToast(`${addr(n)}에 불이 켜졌어요`);
        }
      }
      for (const n of online.keys()) {
        if (!next.has(n)) {
          recent.set(n, { ...(recent.get(n) || {}), ...online.get(n), t: new Date().toISOString() });
          if (movedFrom.has(n)) movedFrom.delete(n);
          else if (n !== myNo && !arriving.has(n)) walkOut(n, online.get(n).c);
        }
      }
      firstSync = false;
      online = next;
      rememberNeighbors();
      sizeCanvas();
      updateCounts();
      if (selectedN) openPeek(selectedN);
    })
    .on("broadcast", { event: "wave" }, ({ payload }) => onWave(payload || {}))
    .on("broadcast", { event: "move" }, ({ payload }) => onMove(payload || {}))
    .subscribe(async (status, err) => {
      if (ch !== channel) return;
      console.log("[awake] 실시간 연결:", status, err || "");
      if (status === "SUBSCRIBED") {
        connected = true;
        realtimeFailed = false;
        if (document.visibilityState === "visible") await track();
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        connected = false;
        tracking = false;
        realtimeFailed = true;
        loadWindows();
      }
      updateCounts();
    });

  // 10초 안에 연결이 안 되면 DB 기록으로 대신 세기
  setTimeout(() => {
    if (ch === channel && !connected && !realtimeFailed) {
      console.warn("[awake] 실시간 연결 시간 초과");
      realtimeFailed = true;
      loadWindows();
    }
  }, 10000);
}

// 이사하면 실시간 채널의 내 이름표(자리 번호)가 바뀌므로 다시 들어가기
async function rejoinRoom() {
  if (channel) {
    try { await db.removeChannel(channel); } catch (e) {}
  }
  channel = null;
  connected = false;
  tracking = false;
  joinRoom();
}

function clampInt(v, max) {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n < max ? n : 0;
}

async function track() {
  if (!channel || !connected) return;
  tracking = true;
  await channel.track({ w: myNo, c: look.c, s: look.s, a: away ? 1 : 0, f: sessionGoal ? 1 : 0 });
}

async function untrack() {
  if (!channel || !tracking) return;
  tracking = false;
  await channel.untrack();
}

// 다른 앱에 가면: 3분 동안은 창문이 깜빡이며 기다려 주고, 그 뒤엔 불이 꺼짐
document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState === "visible") {
    clearTimeout(awayTimer);
    const gone = leftAt ? Date.now() - leftAt : 0;
    const hadSession = !!sessionGoal;
    away = false;
    leftAt = 0;
    await lightWindow();
    await track();
    loadWindows();
    if (moodOn) lockScreen();
    if (gone > 5000 && gone < AWAY_GRACE_MS && hadSession && sessionGoal) showToast("돌아왔네요. 불은 그대로 켜져 있어요");
  } else {
    // 나가기 직전까지의 시간을 적립하고, 3분 동안은 "잠깐 자리 비움"으로 표시
    counting = false;
    away = true;
    leftAt = Date.now();
    lightWindow();
    await track();
    clearTimeout(awayTimer);
    awayTimer = setTimeout(untrack, AWAY_GRACE_MS);
  }
});

// ---------- 🌃 무드등 모드 (전체화면 + 화면 꺼짐 방지 + 시계) ----------
async function lockScreen() {
  if (!("wakeLock" in navigator)) return false;
  try {
    wakeLock = await navigator.wakeLock.request("screen");
    return true;
  } catch (e) {
    wakeLock = null;
    return false;
  }
}

function releaseLock() {
  if (wakeLock) wakeLock.release().catch(() => {});
  wakeLock = null;
}

$("moodBtn").addEventListener("click", async () => {
  moodOn = true;
  document.body.classList.add("is-mood");
  requestAnimationFrame(fitMood);
  $("moodTop").hidden = false;
  closePeek();
  tick();
  try {
    if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
  } catch (e) {}
  const locked = await lockScreen();
  showToast(locked ? "화면이 꺼지지 않게 켜 둘게요" : "화면 자동 꺼짐은 폰 설정에서 바꿔 주세요");
  if (myNo && blocks > 1) findBtn.click();
});

function exitMood() {
  moodOn = false;
  document.body.classList.remove("is-mood");
  $("moodTop").hidden = true;
  releaseLock();
  if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
}

$("moodExit").addEventListener("click", exitMood);

// ---------- ♪ 잔잔한 소리 ----------
const soundBtn = $("soundBtn");
let soundPaused = false;   // 다른 탭에 가서 잠깐 멈춘 상태

function updateSoundBtn() {
  const playing = window.Sound && Sound.isOn();
  soundBtn.textContent = playing ? "♪ 소리 끄기" : "♪ 소리 켜기";
  soundBtn.classList.toggle("is-on", !!playing);
  soundBtn.setAttribute("aria-pressed", playing ? "true" : "false");
}

soundBtn.addEventListener("click", async (e) => {
  e.stopPropagation();
  if (!window.Sound) return;
  if (Sound.isOn()) Sound.stop();
  else await Sound.start();
  updateSoundBtn();
});

// 지난번에 켜 뒀다면: 브라우저 규칙상 화면을 한 번 눌러야 소리가 나요
if (window.Sound && Sound.wanted()) {
  const resume = async () => {
    if (!Sound.isOn()) await Sound.start();
    updateSoundBtn();
  };
  document.addEventListener("pointerdown", resume, { once: true });
}

// 다른 탭으로 가면 소리도 멈추고, 돌아오면 다시
document.addEventListener("visibilitychange", async () => {
  if (!window.Sound) return;
  if (document.visibilityState === "hidden" && Sound.isOn()) {
    Sound.stop(false);
    soundPaused = true;
  } else if (document.visibilityState === "visible" && soundPaused) {
    soundPaused = false;
    await Sound.start();
  }
  updateSoundBtn();
});

// ---------- 공유 ----------
$("shareBtn").addEventListener("click", openCard);

// ---------- 🎯 집중 세션 ----------
function sessionLeft() {
  if (!sessionGoal) return 0;
  return Math.max(0, sessionGoal - sessionSec - liveExtra());
}

function updateFocus() {
  const box = $("focus");
  if (!db || !myNo) { box.hidden = true; return; }
  box.hidden = false;
  const running = !!sessionGoal;
  box.classList.toggle("is-running", running);
  $("focusPick").hidden = running;
  $("focusRun").hidden = !running;
  if (running) {
    const left = sessionLeft();
    const label = sessionGoal >= 3600 ? `${sessionGoal / 3600}시간` : `${sessionGoal / 60}분`;
    $("focusTitle").textContent = `${label} 집중 중`;
    $("focusLeft").textContent = hms(left);
    $("focusFill").style.width = `${Math.min(100, ((sessionGoal - left) / sessionGoal) * 100)}%`;
    $("focusInfo").textContent = "다른 앱은 3분까지 괜찮아요 · 그 이상 나가면 실패";
    // 화면상 시간이 다 되면 서버에 확인 (서버가 별을 줌)
    if (left <= 0 && !sessionClosing) {
      sessionClosing = true;
      lightWindow();
    }
  } else {
    $("focusTitle").textContent = "집중 세션";
    $("focusLeft").textContent = myStars ? `별 ${myStars}개` : "";
    $("focusInfo").textContent = "끝까지 켜 두면 내 창문에 별이 생겨요 · 3분 넘게 나가면 실패";
  }
}

document.querySelectorAll("#focusPick [data-min]").forEach((b) => {
  b.addEventListener("click", async () => {
    if (!db || !myNo) return;
    await lightWindow();   // 지금까지 시간 먼저 정리
    const { data, error } = await db
      .rpc("start_session", { p_player_id: getPlayerId(), p_minutes: Number(b.dataset.min) })
      .single();
    if (error || !data) {
      showToast(error && /[가-힣]/.test(error.message || "") ? error.message : "시작하지 못했어요 😢");
      return;
    }
    sessionGoal = Number(data.my_session_goal);
    sessionSec = 0;
    syncedAt = performance.now();
    track();
    updateFocus();
    showToast(`${b.textContent} 집중 시작! 화면을 켜 두면 시간이 쌓여요`);
  });
});

let stopArmed = false;
$("focusStop").addEventListener("click", async () => {
  const btn = $("focusStop");
  if (!stopArmed) {
    stopArmed = true;
    btn.textContent = "정말 그만둘까요?";
    btn.classList.add("is-armed");
    setTimeout(() => { stopArmed = false; btn.textContent = "그만두기"; btn.classList.remove("is-armed"); }, 3000);
    return;
  }
  stopArmed = false;
  btn.textContent = "그만두기";
  btn.classList.remove("is-armed");
  await db.rpc("stop_session", { p_player_id: getPlayerId() });
  sessionGoal = null;
  sessionSec = 0;
  track();
  updateFocus();
  showToast("집중 세션을 그만뒀어요");
});

function onSessionDone(goal) {
  const label = goal >= 3600 ? `${goal / 3600}시간` : `${(goal || 0) / 60}분`;
  showToast(`⭐ ${label} 집중 성공! 내 창문에 별이 생겼어요`);
  pops.set(myNo, frame);
  lightAt = frame;
  if (navigator.vibrate) navigator.vibrate([40, 60, 40]);
  loadMyDays();
  setTimeout(openCard, 1600);
}

// ---------- 🤝 함께 깨어 있던 이웃 (오늘 밤, 이 기기 기준) ----------
const NB_KEY = "awake-neighbors";

function nightKey() {
  // 서버와 같은 기준: 한국 시각 새벽 6시에 하루가 바뀜
  return new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10);
}

function loadNeighbors() {
  try {
    const v = JSON.parse(localStorage.getItem(NB_KEY));
    if (v && v.d === nightKey() && Array.isArray(v.n)) return new Set(v.n);
  } catch (e) {}
  return new Set();
}

function rememberNeighbors() {
  if (!myNo || document.visibilityState !== "visible") return;
  const set = loadNeighbors();
  const before = set.size;
  for (const n of online.keys()) if (n !== myNo) set.add(n);
  if (set.size === before) return;
  try { localStorage.setItem(NB_KEY, JSON.stringify({ d: nightKey(), n: [...set].slice(-500) })); } catch (e) {}
}

// ---------- 📅 불빛 달력 (최근 12주) ----------
async function loadMyDays() {
  if (!db) return;
  const { data, error } = await db.rpc("get_my_days", { p_player_id: getPlayerId() });
  if (error || !Array.isArray(data)) return;
  myDays = new Map(data.map((d) => [String(d.d).slice(0, 10), { s: Number(d.s) || 0, st: Number(d.st) || 0 }]));
  renderDays();
}

function dayLevel(sec) {
  if (sec <= 0) return 0;
  if (sec < 10 * 60) return 1;
  if (sec < 30 * 60) return 2;
  if (sec < 60 * 60) return 3;
  return 4;
}

function renderDays() {
  const box = $("days");
  if (!db || !myNo) { box.hidden = true; return; }
  box.hidden = false;
  const today = nightKey();
  const base = new Date(today + "T00:00:00Z");
  const grid = $("daysGrid");
  const cells = [];
  let lit = 0, stars = 0;
  for (let i = 83; i >= 0; i--) {
    const d = new Date(base.getTime() - i * 86400000).toISOString().slice(0, 10);
    const rec = myDays.get(d) || { s: 0, st: 0 };
    const sec = d === today ? Math.max(rec.s, myToday + liveExtra()) : rec.s;
    if (sec >= 600) lit++;
    stars += rec.st;
    const [, mm, dd] = d.split("-").map(Number);
    cells.push(`<div class="day lv${dayLevel(sec)}${rec.st ? " has-star" : ""}${d === today ? " is-today" : ""}" title="${mm}월 ${dd}일 · ${sec ? dur(sec) : "꺼짐"}${rec.st ? ` · 별 ${rec.st}` : ""}"></div>`);
  }
  grid.innerHTML = cells.join("");

  // 연속 기록: 10분 이상 켠 날이 이어진 수 (오늘 아직 10분 전이면 어제부터 셈)
  let streak = 0;
  for (let i = 0; i < 84; i++) {
    const d = new Date(base.getTime() - i * 86400000).toISOString().slice(0, 10);
    const sec = d === today ? Math.max((myDays.get(d) || {}).s || 0, myToday + liveExtra()) : (myDays.get(d) || {}).s || 0;
    if (sec >= 600) streak++;
    else if (i === 0) continue;
    else break;
  }
  $("daysSum").innerHTML = `연속 <b>${streak}일</b> · 12주 중 ${lit}일`;
  renderDays.streak = streak;
}

// ---------- 🌠 그 순간에만 보이는 장면 ----------
function isMeteorTime() {
  const m = skyClock().min;
  return m >= 180 && m < 195;
}

function checkMoments() {
  if (!myNo) return;   // 불을 켠 뒤부터
  const { min, doy } = skyClock();
  const hour = Math.floor(min / 60) % 24;
  // 정각 파도 (매 정각 첫 1분 동안 한 번)
  if (min % 60 < 1 && lastWaveHour !== hour) {
    lastWaveHour = hour;
    hourWaveAt = frame;
    showToast(`${hour}시 정각 · 단지에 불빛 파도가 지나가요`);
  }
  const key = nightKey();
  const once = (name, text) => {
    const k = `awake-moment-${name}`;
    try {
      if (localStorage.getItem(k) === key) return;
      localStorage.setItem(k, key);
    } catch (e) {}
    showToast(text);
  };
  if (isMeteorTime()) once("meteor", "새벽 3시, 별똥별이 쏟아지고 있어요");
  const { rise } = sunTimes(doy);
  if (Math.abs(min - rise) < 5) once("sunrise", "해가 떠요. 밤새 불 켜 둔 사람들, 수고했어요");
}

// ---------- 🖼️ 오늘 기록 카드 (1080×1920, 인스타 스토리 크기) ----------
let cardBlob = null;

function cardFont(weight, size) {
  return `${weight} ${size}px "Pretendard Variable", Pretendard, -apple-system, "Noto Sans KR", sans-serif`;
}

async function makeCard() {
  const c = document.createElement("canvas");
  c.width = 1080;
  c.height = 1920;
  const g = c.getContext("2d");
  g.fillStyle = "#0b0d14";
  g.fillRect(0, 0, 1080, 1920);

  // 내 창문이 있는 구역의 지금 풍경
  const block = myNo ? Math.floor((myNo - 1) / PER_BLOCK) : 0;
  g.imageSmoothingEnabled = false;
  g.drawImage(town, block * BLOCK_W * 2, 0, BLOCK_W * 2, H * 2, 0, 140, 1080, 1440);

  // 위 띠
  const k = new Date(Date.now() + tzOffset() * 60000);
  g.fillStyle = "rgba(8,11,22,0.55)";
  g.fillRect(0, 140, 1080, 120);
  g.fillStyle = "#f2f4f8";
  g.font = cardFont(800, 46);
  g.textBaseline = "middle";
  g.fillText("지금 깨어 있는 사람", 56, 200);
  g.font = cardFont(600, 34);
  g.fillStyle = "#c3c9d6";
  g.textAlign = "right";
  g.fillText(`${k.getUTCMonth() + 1}월 ${k.getUTCDate()}일`, 1024, 200);
  g.textAlign = "left";

  // 아래 기록
  const extra = liveExtra();
  const nb = loadNeighbors().size;
  const today = nightKey();
  const starsToday = (myDays.get(today) || {}).st || 0;
  let y = 1660;
  g.fillStyle = "#fcd34d";
  g.font = cardFont(800, 64);
  g.fillText(myNo ? addr(myNo) : "", 56, y);
  y += 96;
  g.fillStyle = "#c9ccd2";
  g.font = cardFont(600, 36);
  g.fillText("오늘 불 켜둔 시간", 56, y);
  g.fillStyle = "#f2f4f8";
  g.font = cardFont(800, 52);
  g.textAlign = "right";
  g.fillText(hms(myToday + extra), 1024, y);
  g.textAlign = "left";
  y += 76;
  const facts = [
    nb ? `함께 깨어 있던 이웃 ${nb}명` : "오늘은 조용히 혼자 깨어 있었어요",
    starsToday ? `집중 세션 성공 ${starsToday}번` : null,
    renderDays.streak ? `연속 ${renderDays.streak}일째` : null,
  ].filter(Boolean);
  g.fillStyle = "#e3e7ef";
  g.font = cardFont(600, 36);
  g.fillText(facts.join(" · "), 56, y);

  g.fillStyle = "#6b7390";
  g.font = cardFont(600, 28);
  g.fillText("ge323.github.io/gongjakso/awake", 56, 1880);

  return new Promise((res) => c.toBlob((b) => res(b), "image/png"));
}

async function openCard() {
  if (!myNo) return;
  try { if (document.fonts) await document.fonts.ready; } catch (e) {}
  cardBlob = await makeCard();
  if (!cardBlob) { showToast("카드를 만들지 못했어요 😢"); return; }
  const img = $("cardImg");
  if (img.src) URL.revokeObjectURL(img.src);
  img.src = URL.createObjectURL(cardBlob);
  $("cardModal").hidden = false;
}

$("cardClose").addEventListener("click", () => { $("cardModal").hidden = true; });
$("cardModal").addEventListener("click", (e) => { if (e.target.id === "cardModal") $("cardModal").hidden = true; });

$("cardSave").addEventListener("click", () => {
  if (!cardBlob) return;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(cardBlob);
  a.download = `깨어있는사람-${nightKey()}.png`;
  a.click();
});

$("cardShare").addEventListener("click", async () => {
  if (!cardBlob) return;
  const url = "https://ge323.github.io/gongjakso/awake/";
  const text = `🌙 ${myNo ? addr(myNo) : ""}에서 오늘 ${dur(myToday + liveExtra())} 불 켜 뒀어요\n같이 깨어 있어요 👉 ${url}`;
  const file = new File([cardBlob], "awake.png", { type: "image/png" });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], text });
      return;
    }
    if (navigator.share) {
      await navigator.share({ title: "지금 깨어 있는 사람", text });
      return;
    }
  } catch (e) {
    if (e.name === "AbortError") return;
  }
  try {
    await navigator.clipboard.writeText(text);
    showToast("문구를 복사했어요. 이미지는 저장해서 같이 올려 주세요");
  } catch (e) {
    showToast("공유가 안 되는 브라우저예요. 이미지 저장을 눌러 주세요");
  }
});

// 알림이 겹치면 덮어쓰지 않고 차례대로 (최대 3개 대기)
const toastQueue = [];
let toastBusy = false;

function showToast(message) {
  if (toastBusy) {
    if (toastQueue[toastQueue.length - 1] !== message && toastQueue.length < 3) toastQueue.push(message);
    return;
  }
  toastBusy = true;
  toastEl.textContent = message;
  toastEl.classList.add("is-show");
  setTimeout(() => {
    toastEl.classList.remove("is-show");
    setTimeout(() => {
      toastBusy = false;
      if (toastQueue.length) showToast(toastQueue.shift());
    }, 260);
  }, 2200);
}

// ---------- 시작 ----------
(async function start() {
  sizeCanvas();
  renderOptions();
  updateCounts();
  requestAnimationFrame(loop);
  // 하늘 기준 위치: 처음이면 물어보고, 전에 허용했으면 조용히 새로고침, 거절했으면 서울
  const asked = loadPlace();
  updateSkyWhere();
  loadWeather();
  setInterval(loadWeather, WEATHER_MS);
  if (asked === null) setTimeout(() => askLocation(false), 1200);
  else if (asked === "geo") askLocation(false);
  tick();
  setInterval(tick, 1000);
  if (!db) return;
  const ok = await lightWindow();
  await loadWindows();
  goalsReady = true;
  loadMyDays();
  if (ok) {
    joinRoom();
    // 내 창문이 화면 밖이면 보이게
    if (blocks > 1) findBtn.click();
  }
  setInterval(() => { if (document.visibilityState === "visible") lightWindow(); }, HEARTBEAT_MS);
  setInterval(loadWindows, REFRESH_MS);
})();
