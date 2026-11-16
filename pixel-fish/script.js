// 🐟 픽셀 어항 | 아이디어 공작소 #2

// ---------- 🔑 Supabase 설정 (딱 10초와 같은 프로젝트) ----------
// 공개용(Publishable) 키라 코드에 넣어도 됩니다. Secret 키는 절대 넣지 마세요!
const SUPABASE_URL = "https://mamunluhjcrmharnrqdz.supabase.co";
const SUPABASE_KEY = "sb_publishable_eh0u-VyFBgXRSovoBPrgsQ_F2pYPjWU";

// ---------- 설정 ----------
const SHOW_LIMIT = 50;          // 어항에 보여줄 최대 물고기 수 (최근 순)
const REFRESH_MS = 30000;       // 새 물고기 확인 주기 (30초)
const PLAYER_KEY = "pixel-fish-player";
const W = 360;                  // 어항 논리 크기 (캔버스는 2배로 그려서 선명하게)
const H = 270;
const SAND_Y = 250;
const FISH_P = 4;                // 어항 속 물고기 픽셀 크기

// 색 팔레트 (DB에는 0~7 번호로 저장)
const COLORS = [
  "#F5B83D", // 노랑
  "#FF7A59", // 주황
  "#ED6A8F", // 분홍
  "#9D8CF0", // 보라
  "#5AA9F0", // 하늘
  "#3CC9A0", // 민트
  "#8FD14F", // 연두
  "#EDEBE6", // 하양
];

const SHAPE_NAMES = ["동글이", "날쌘이", "복어"];
const PATTERN_NAMES = ["없음", "줄무늬", "점박이", "배색"];

// 물고기 픽셀 모양 (오른쪽을 보는 기준)
// B: 몸, F: 지느러미, T: 꼬리, E: 눈, .: 빈칸
const SHAPES = [
  [
    "....FFF......",
    "...BBBBBB....",
    "T.BBBBBBBBB..",
    "TTBBBBBBBEBB.",
    "TTTBBBBBBBBBB",
    "TTBBBBBBBBBB.",
    "T.BBBBBBBBB..",
    "...BBBBBB....",
    ".....FF......",
  ],
  [
    ".....FFF.....",
    "T..BBBBBBB...",
    "TT.BBBBBBBEB.",
    "TTTBBBBBBBBBB",
    "TT.BBBBBBBBB.",
    "T..BBBBBBB...",
    "......FF.....",
  ],
  [
    "....F.F....",
    "...BBBBB...",
    "..BBBBBBB..",
    "T.BBBBBBEB.",
    "TTBBBBBBBBB",
    "TTBBBBBBBBB",
    "TTBBBBBBBBB",
    "T.BBBBBBBB.",
    "..BBBBBBB..",
    "...BBBBB...",
    "....F.F....",
  ],
];

// 사용하면 안 되는 단어 (DB에서도 똑같이 검사함)
const BANNED = [
  "시발", "씨발", "씨바", "ㅅㅂ", "ㅆㅂ", "병신", "ㅂㅅ", "좆", "존나", "개새", "새끼",
  "애미", "니미", "미친놈", "미친년", "fuck", "shit", "bitch",
];

// ---------- 요소 ----------
const $ = (id) => document.getElementById(id);
const tank = $("tank");
const tx = tank.getContext("2d");
const preview = $("preview");
const px = preview.getContext("2d");
const countEl = $("count");
const infoEl = $("info");
const openBtn = $("openEditor");
const shareBtn = $("shareBtn");
const editorEl = $("editor");
const nameInput = $("fishName");
const msgInput = $("fishMsg");
const saveBtn = $("saveBtn");
const randomBtn = $("randomBtn");
const previewName = $("previewName");
const toastEl = $("toast");

tx.scale(2, 2);
px.scale(2, 2);
tx.imageSmoothingEnabled = false;
px.imageSmoothingEnabled = false;

// ---------- DB 연결 ----------
const keyOk = /^[\x21-\x7e]+$/.test(SUPABASE_KEY); // 한글 안내 문구가 남아 있으면 연결 안 함
const db =
  SUPABASE_URL && keyOk && window.supabase
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
    : null;

// ---------- 상태 ----------
let frame = 0;
let swimmers = [];       // 어항 속 물고기들
let myFishId = null;
let myFish = null;       // 내 물고기 데이터 (수정할 때 사용)
let selected = null;     // 눌러서 말풍선이 뜬 물고기
let selectedUntil = 0;
const draft = { shape: 0, body: 0, fin: 1, pattern: 0 };

const bubbles = Array.from({ length: 14 }, () => ({
  x: Math.random() * W,
  y: Math.random() * SAND_Y,
  s: Math.random() * 0.35 + 0.15,
}));

// ---------- 색 도우미 ----------
function shade(hex, amt) {
  // amt > 0 밝게, amt < 0 어둡게
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const t = amt > 0 ? 255 : 0, p = Math.abs(amt);
  r = Math.round(r + (t - r) * p);
  g = Math.round(g + (t - g) * p);
  b = Math.round(b + (t - b) * p);
  return `rgb(${r},${g},${b})`;
}

// ---------- 물고기 그리기 ----------
function fishSize(shape, P) {
  const rows = SHAPES[shape];
  return { w: rows[0].length * P, h: rows.length * P };
}

function cellColor(f, ch, r, k, rows) {
  const body = COLORS[f.body_color];
  const fin = COLORS[f.fin_color];
  if (ch === "E") return "#1b1b1b";
  if (ch === "F" || ch === "T") return fin;
  const cols = rows[0].length;
  const mid = Math.floor(rows.length / 2);
  if (f.pattern === 1 && k % 3 === 1 && k >= 3 && k <= cols - 4) return shade(body, -0.28);
  if (f.pattern === 2 && (r * 5 + k * 3) % 7 === 0) return shade(body, 0.5);
  if (f.pattern === 3 && r > mid) return shade(body, 0.45);
  return body;
}

function drawFish(ctx, f, x, y, P, dir, wiggle) {
  const rows = SHAPES[f.shape];
  const cols = rows[0].length;
  const cells = [];
  for (let r = 0; r < rows.length; r++) {
    for (let k = 0; k < cols; k++) {
      const ch = rows[r][k];
      if (ch === ".") continue;
      if (wiggle && ch === "T" && k === 0) continue; // 꼬리 흔들기
      const cx = dir > 0 ? k : cols - 1 - k;
      cells.push([Math.round(x + cx * P), Math.round(y + r * P), ch, r, k]);
    }
  }
  // 테두리 (픽셀 아트 느낌)
  ctx.fillStyle = "rgba(10, 20, 35, 0.55)";
  const o = Math.max(1, P / 3);
  for (const [cx, cy] of cells) ctx.fillRect(cx - o, cy - o, P + o * 2, P + o * 2);
  // 몸
  for (const [cx, cy, ch, r, k] of cells) {
    ctx.fillStyle = cellColor(f, ch, r, k, rows);
    ctx.fillRect(cx, cy, P, P);
  }
}

// ---------- 어항 그리기 ----------
function drawTankBackground() {
  tx.fillStyle = "#123a5c";
  tx.fillRect(0, 0, W, H);

  // 깊이감 (아래로 갈수록 진하게)
  tx.fillStyle = "#0f3150";
  tx.fillRect(0, 150, W, SAND_Y - 150);
  tx.fillStyle = "#0c2945";
  tx.fillRect(0, 205, W, SAND_Y - 205);

  // 수면 물결
  tx.fillStyle = "#1d5582";
  for (let i = 0; i < W; i += 8) {
    tx.fillRect(i, Math.round(10 + Math.sin((frame + i) / 22) * 2), 8, 3);
  }

  // 모래
  tx.fillStyle = "#c9a96b";
  tx.fillRect(0, SAND_Y, W, H - SAND_Y);
  tx.fillStyle = "#b08e52";
  for (let i = 0; i < W; i += 14) tx.fillRect(i + ((i / 14) % 2) * 5, SAND_Y + 6, 5, 3);

  // 돌
  tx.fillStyle = "#5f6b78";
  tx.fillRect(250, SAND_Y - 12, 28, 12);
  tx.fillRect(256, SAND_Y - 18, 16, 6);
  tx.fillStyle = "#74818f";
  tx.fillRect(258, SAND_Y - 16, 6, 3);

  // 해초
  const weeds = [[24, 7], [32, 5], [300, 8], [308, 6], [316, 4], [160, 4]];
  tx.fillStyle = "#3B8A2E";
  weeds.forEach(([wx, len], i) => {
    for (let h = 0; h < len; h++) {
      const sway = Math.round(Math.sin((frame + h * 10 + i * 20) / 35) * 2);
      tx.fillRect(wx + sway, SAND_Y - (h + 1) * 6, 4, 6);
    }
  });

  // 물방울
  tx.fillStyle = "rgba(255, 255, 255, 0.45)";
  bubbles.forEach((b) => {
    b.y -= b.s;
    if (b.y < 14) {
      b.y = SAND_Y - 4;
      b.x = Math.random() * W;
    }
    tx.fillRect(Math.round(b.x), Math.round(b.y), 2, 2);
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawLabel(text, cx, top, mine) {
  tx.font = "bold 9px -apple-system, 'Noto Sans KR', sans-serif";
  const w = tx.measureText(text).width + 10;
  const x = Math.min(Math.max(cx - w / 2, 2), W - w - 2);
  const y = Math.max(top - 15, 2);
  tx.fillStyle = mine ? "#4ade80" : "rgba(15, 17, 21, 0.75)";
  roundRect(tx, x, y, w, 13, 6);
  tx.fill();
  tx.fillStyle = mine ? "#0b1a10" : "#ffffff";
  tx.textAlign = "left";
  tx.textBaseline = "middle";
  tx.fillText(text, x + 5, y + 7);
}

function updateSwimmer(s) {
  const { w, h } = fishSize(s.data.shape, FISH_P);
  if (s.entering) {
    s.y += 2.2;
    if (s.y >= s.baseY) {
      s.y = s.baseY;
      s.entering = false;
      for (let i = 0; i < 8; i++) {
        bubbles.push({ x: s.x + Math.random() * w, y: s.y + h, s: Math.random() * 0.6 + 0.4 });
      }
      if (bubbles.length > 40) bubbles.splice(0, bubbles.length - 40);
    }
    return;
  }
  s.x += s.vx;
  if (s.x < 6) { s.x = 6; s.vx = Math.abs(s.vx); }
  if (s.x > W - w - 6) { s.x = W - w - 6; s.vx = -Math.abs(s.vx); }
  if (Math.random() < 0.002) s.vx = -s.vx;
  s.y = s.baseY + Math.sin(frame / 40 + s.phase) * 4;
}

function drawTank() {
  drawTankBackground();

  for (const s of swimmers) {
    updateSwimmer(s);
    const dir = s.vx > 0 ? 1 : -1;
    const wiggle = Math.floor((frame + s.phase * 10) / 12) % 2 === 0;
    drawFish(tx, s.data, s.x, s.y, FISH_P, dir, wiggle);
  }

  // 이름표: 내 물고기는 항상, 누른 물고기는 잠깐
  for (const s of swimmers) {
    const { w } = fishSize(s.data.shape, FISH_P);
    const mine = s.data.id === myFishId;
    if (mine) drawLabel(`⭐ ${s.data.name}`, s.x + w / 2, s.y, true);
    else if (s === selected && frame < selectedUntil) drawLabel(s.data.name, s.x + w / 2, s.y, false);
  }

  if (swimmers.length === 0) {
    tx.fillStyle = "rgba(255,255,255,0.7)";
    tx.font = "bold 12px -apple-system, 'Noto Sans KR', sans-serif";
    tx.textAlign = "center";
    tx.textBaseline = "middle";
    tx.fillText("어항이 비어 있어요. 첫 물고기가 되어주세요!", W / 2, H / 2 - 10);
  }
}

// ---------- 미리보기 그리기 ----------
function drawPreview() {
  const PW = 240, PH = 150, P = 8;
  px.fillStyle = "#123a5c";
  px.fillRect(0, 0, PW, PH);
  const { w, h } = fishSize(draft.shape, P);
  const bob = Math.sin(frame / 25) * 3;
  const wiggle = Math.floor(frame / 12) % 2 === 0;
  drawFish(px, { ...draftAsFish() }, (PW - w) / 2, (PH - h) / 2 + bob, P, 1, wiggle);
}

function draftAsFish() {
  return { shape: draft.shape, body_color: draft.body, fin_color: draft.fin, pattern: draft.pattern };
}

// ---------- 애니메이션 ----------
function loop() {
  frame++;
  drawTank();
  if (!editorEl.hidden) drawPreview();
  requestAnimationFrame(loop);
}

// ---------- 어항에 물고기 넣기 ----------
function makeSwimmer(data, entering) {
  const { w, h } = fishSize(data.shape, FISH_P);
  const baseY = 24 + Math.random() * (SAND_Y - h - 16 - 24); // 수면 아래 ~ 모래 위 사이 어디든
  const speed = (Math.random() * 0.45 + 0.25) * (Math.random() < 0.5 ? -1 : 1);
  return {
    data,
    x: 6 + Math.random() * (W - w - 12),
    y: entering ? -h - 4 : baseY,
    baseY,
    vx: speed,
    phase: Math.random() * 10,
    entering,
  };
}

function mergeFish(list) {
  const byId = new Map(swimmers.map((s) => [s.data.id, s]));
  const next = [];
  for (const data of list) {
    const old = byId.get(data.id);
    if (old) {
      old.data = data; // 모습이 바뀌었으면 반영
      next.push(old);
    } else {
      next.push(makeSwimmer(data, swimmers.length > 0)); // 처음 로딩 이후 새로 온 물고기는 위에서 퐁당
    }
  }
  swimmers = next;
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

// ---------- DB 불러오기 ----------
async function loadFish() {
  if (!db) {
    countEl.textContent = "어항 준비 중 🛠️";
    return;
  }

  const [listRes, countRes] = await Promise.all([
    db.from("fish")
      .select("id, name, message, shape, body_color, fin_color, pattern, updated_at")
      .order("updated_at", { ascending: false })
      .limit(SHOW_LIMIT),
    db.from("fish").select("id", { count: "exact", head: true }),
  ]);

  if (listRes.error) {
    console.error(listRes.error);
    countEl.textContent = "어항을 불러오지 못했어요 😢";
    return;
  }

  const list = listRes.data;
  // 내 물고기가 최근 50마리에 없으면 따로 넣어주기
  if (myFish && !list.some((f) => f.id === myFish.id)) list.push(myFish);
  mergeFish(list);

  const total = typeof countRes.count === "number" ? countRes.count : list.length;
  countEl.textContent = `지금 어항에 🐟 ${total}마리`;
}

async function loadMyFish() {
  if (!db) return;
  const { data, error } = await db.rpc("get_my_fish", { p_player_id: getPlayerId() }).maybeSingle();
  if (error || !data) return;

  myFishId = data.fish_id;
  myFish = {
    id: data.fish_id,
    name: data.name,
    message: data.message,
    shape: data.shape,
    body_color: data.body_color,
    fin_color: data.fin_color,
    pattern: data.pattern,
  };
  Object.assign(draft, {
    shape: data.shape,
    body: data.body_color,
    fin: data.fin_color,
    pattern: data.pattern,
  });
  nameInput.value = data.name;
  msgInput.value = data.message;
  openBtn.textContent = "🎨 내 물고기 다시 꾸미기";
  shareBtn.hidden = false;
  renderOptions();
}

// ---------- 물고기 누르기 ----------
function showInfo(s) {
  infoEl.innerHTML = "";
  const b = document.createElement("b");
  b.textContent = s.data.id === myFishId ? `⭐ ${s.data.name} (내 물고기)` : s.data.name;
  const msg = document.createElement("span");
  msg.textContent = ` : ${s.data.message || "…(말없이 헤엄치는 중)"}`;
  infoEl.append(b, msg);
  infoEl.hidden = false;
}

tank.addEventListener("click", (e) => {
  const rect = tank.getBoundingClientRect();
  const mx = ((e.clientX - rect.left) / rect.width) * W;
  const my = ((e.clientY - rect.top) / rect.height) * H;

  for (let i = swimmers.length - 1; i >= 0; i--) {
    const s = swimmers[i];
    const { w, h } = fishSize(s.data.shape, FISH_P);
    if (mx > s.x - 6 && mx < s.x + w + 6 && my > s.y - 6 && my < s.y + h + 6) {
      selected = s;
      selectedUntil = frame + 240;
      showInfo(s);
      return;
    }
  }
});

// ---------- 꾸미기 화면 ----------
function makeChip(label, on, onClick) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "chip" + (on ? " is-on" : "");
  b.textContent = label;
  b.setAttribute("aria-pressed", on);
  b.addEventListener("click", onClick);
  return b;
}

function makeSwatch(color, on, label, onClick) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "swatch" + (on ? " is-on" : "");
  b.style.background = color;
  b.setAttribute("aria-label", label);
  b.setAttribute("aria-pressed", on);
  b.addEventListener("click", onClick);
  return b;
}

const COLOR_NAMES = ["노랑", "주황", "분홍", "보라", "하늘", "민트", "연두", "하양"];

function renderOptions() {
  const shapes = $("shapes"), bodies = $("bodyColors"), fins = $("finColors"), patterns = $("patterns");
  shapes.innerHTML = bodies.innerHTML = fins.innerHTML = patterns.innerHTML = "";

  SHAPE_NAMES.forEach((n, i) =>
    shapes.append(makeChip(n, draft.shape === i, () => { draft.shape = i; renderOptions(); })));
  COLORS.forEach((c, i) =>
    bodies.append(makeSwatch(c, draft.body === i, `몸 색 ${COLOR_NAMES[i]}`, () => { draft.body = i; renderOptions(); })));
  COLORS.forEach((c, i) =>
    fins.append(makeSwatch(c, draft.fin === i, `지느러미 색 ${COLOR_NAMES[i]}`, () => { draft.fin = i; renderOptions(); })));
  PATTERN_NAMES.forEach((n, i) =>
    patterns.append(makeChip(n, draft.pattern === i, () => { draft.pattern = i; renderOptions(); })));
}

function updatePreviewName() {
  const name = nameInput.value.trim();
  const msg = msgInput.value.trim();
  previewName.textContent = (name || "이름 없는 물고기") + (msg ? ` : ${msg}` : "");
}

function hasBanned(text) {
  const t = text.toLowerCase().replace(/[\s._\-]/g, "");
  return BANNED.some((w) => t.includes(w));
}

openBtn.addEventListener("click", () => {
  editorEl.hidden = !editorEl.hidden;
  if (!editorEl.hidden) {
    renderOptions();
    updatePreviewName();
    editorEl.scrollIntoView({ behavior: "smooth", block: "start" });
  }
});

randomBtn.addEventListener("click", () => {
  draft.shape = Math.floor(Math.random() * SHAPES.length);
  draft.body = Math.floor(Math.random() * COLORS.length);
  draft.fin = Math.floor(Math.random() * COLORS.length);
  draft.pattern = Math.floor(Math.random() * PATTERN_NAMES.length);
  renderOptions();
});

nameInput.addEventListener("input", updatePreviewName);
msgInput.addEventListener("input", updatePreviewName);

saveBtn.addEventListener("click", async () => {
  const name = nameInput.value.trim();
  const message = msgInput.value.trim();

  if (!name) {
    showToast("물고기 이름을 입력해주세요");
    nameInput.focus();
    return;
  }
  if (hasBanned(name) || hasBanned(message)) {
    showToast("사용할 수 없는 단어가 있어요");
    return;
  }
  if (!db) {
    showToast("어항 준비 중이에요 🛠️");
    return;
  }

  saveBtn.disabled = true;
  saveBtn.textContent = "넣는 중…";

  const { data, error } = await db
    .rpc("save_fish", {
      p_player_id: getPlayerId(),
      p_name: name,
      p_message: message,
      p_shape: draft.shape,
      p_body: draft.body,
      p_fin: draft.fin,
      p_pattern: draft.pattern,
    })
    .single();

  saveBtn.disabled = false;
  saveBtn.textContent = "🫧 어항에 넣기";

  if (error) {
    console.error(error);
    const msg = /[가-힣]/.test(error.message || "") ? error.message : "넣지 못했어요. 다시 시도해주세요 😢";
    showToast(msg);
    return;
  }

  myFishId = data.fish_id;
  myFish = {
    id: data.fish_id, name, message,
    shape: draft.shape, body_color: draft.body, fin_color: draft.fin, pattern: draft.pattern,
  };

  // 내 물고기는 새로 퐁당 들어오게
  swimmers = swimmers.filter((s) => s.data.id !== myFishId);
  swimmers.push(makeSwimmer(myFish, true));
  await loadFish();

  editorEl.hidden = true;
  openBtn.textContent = "🎨 내 물고기 다시 꾸미기";
  shareBtn.hidden = false;
  document.querySelector(".tank-wrap").scrollIntoView({ behavior: "smooth", block: "start" });
  showToast(data.result === "new" ? "퐁당! 어항에 들어갔어요 🫧" : "내 물고기를 새로 꾸몄어요 🎨");
});

// ---------- 공유 ----------
shareBtn.addEventListener("click", async () => {
  const url = "https://ge323.github.io/gongjakso/pixel-fish/";
  const name = myFish ? myFish.name : "내 물고기";
  const text = `🐟 픽셀 어항에 '${name}'가 살고 있어요!\n찾아와서 같이 헤엄쳐요 🫧\n\n👉 ${url}`;

  if (navigator.share) {
    try {
      await navigator.share({ title: "픽셀 어항", text });
      return;
    } catch (e) {
      if (e.name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    showToast("복사했어요! 친구에게 보내보세요 💌");
  } catch (e) {
    showToast("복사에 실패했어요 😢");
  }
});

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("is-show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toastEl.classList.remove("is-show"), 2200);
}

// ---------- 시작 ----------
(async function start() {
  renderOptions();
  requestAnimationFrame(loop);
  await loadMyFish();
  await loadFish();
  if (db) setInterval(loadFish, REFRESH_MS);
})();
