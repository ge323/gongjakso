// ⏱️ 딱 10초 | 아이디어 공작소 #1

// ---------- 🔑 Supabase 설정 (본인 프로젝트 값으로 교체) ----------
// Supabase 대시보드 → Project Settings → API 에서 복사
// 이 키는 "공개용" 키라 코드에 넣어도 됩니다. (secret / service_role 키는 절대 넣지 마세요!)
const SUPABASE_URL = "https://mamunluhjcrmharnrqdz.supabase.co";
const SUPABASE_KEY = "sb_publishable_eh0u-VyFBgXRSovoBPrgsQ_F2pYPjWU";

// ---------- 게임 설정 ----------
const TARGET = 10; // 목표 시간 (초)
const VISIBLE_TIME = 3; // 타이머가 보이는 시간 (초)
const RESTART_GUARD = 700; // 멈춘 직후 실수로 다시 시작되는 것 방지 (ms)
const BEST_KEY = "stop-at-10-best";
const NICK_KEY = "stop-at-10-nickname";
const PLAYER_KEY = "stop-at-10-player";
const MAX_NICK = 12;

// 등급표 (오차 기준)
const GRADES = [
  { max: 0, label: "👑 완벽한 10초" },
  { max: 0.01, label: "🏆 인간 시계" },
  { max: 0.1, label: "🔥 고수" },
  { max: 0.5, label: "🙂 평범한 인간" },
  { max: 1, label: "😅 조금 급했네요" },
  { max: Infinity, label: "⏰ 시계 새로 사세요" },
];

// ---------- 요소 ----------
const $ = (id) => document.getElementById(id);
const timerEl = $("timer");
const hintEl = $("hint");
const resultEl = $("result");
const gradeEl = $("grade");
const diffEl = $("diff");
const bestEl = $("best");
const mainBtn = $("mainBtn");
const shareBtn = $("shareBtn");
const toastEl = $("toast");
const rankForm = $("rankForm");
const nicknameInput = $("nickname");
const submitBtn = $("submitBtn");
const myRankEl = $("myRank");
const rankListEl = $("rankList");
const refreshBtn = $("refreshBtn");
const hofEl = $("hof");

// ---------- DB 연결 ----------
const db =
  SUPABASE_URL && SUPABASE_KEY && window.supabase
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
    : null;

// ---------- 상태 ----------
// idle(대기) → running(진행) → result(결과)
let state = "idle";
let startTime = 0;
let stoppedAt = 0;
let rafId = null;
let lastResult = null;
let myLastEntry = null; // 방금 등록한 내 기록 (랭킹에서 강조용)

// ---------- 게임 흐름 ----------

function startGame(pressedAt) {
  state = "running";
  startTime = pressedAt;
  lastResult = null;

  timerEl.textContent = "0.00";
  timerEl.classList.remove("is-hidden", "is-result");
  resultEl.hidden = true;
  shareBtn.hidden = true;
  rankForm.hidden = true;
  myRankEl.hidden = true;
  nicknameInput.blur();

  hintEl.textContent = "3초 뒤 타이머가 사라집니다";
  mainBtn.textContent = "STOP";
  mainBtn.classList.add("is-stop");

  tick();
}

function tick() {
  const elapsed = (performance.now() - startTime) / 1000;

  if (elapsed < VISIBLE_TIME) {
    timerEl.textContent = elapsed.toFixed(2);
  } else if (!timerEl.classList.contains("is-hidden")) {
    timerEl.textContent = "?.??";
    timerEl.classList.add("is-hidden");
    hintEl.textContent = "이제부턴 감으로! 🙈";
  }

  rafId = requestAnimationFrame(tick);
}

function stopGame(pressedAt) {
  // 소수점 셋째 자리로 맞춤 (화면·랭킹·등급 모두 같은 숫자 사용)
  const elapsed = Math.round(pressedAt - startTime) / 1000;
  cancelAnimationFrame(rafId);

  state = "result";
  stoppedAt = pressedAt;
  showResult(elapsed);
}

function showResult(elapsed) {
  const diff = Math.round((elapsed - TARGET) * 1000) / 1000;
  const absDiff = Math.abs(diff);
  const grade = GRADES.find((g) => absDiff <= g.max).label;

  lastResult = { elapsed, diff, grade, submitted: false };

  timerEl.textContent = elapsed.toFixed(3);
  timerEl.classList.remove("is-hidden");
  timerEl.classList.add("is-result");

  gradeEl.textContent = grade;
  diffEl.textContent = `오차 ${formatDiff(diff)}초`;
  bestEl.textContent = updateBest(elapsed, absDiff);

  resultEl.hidden = false;
  shareBtn.hidden = false;
  hintEl.textContent = "";

  // 랭킹 등록 폼 표시 (DB 연결된 경우만)
  if (db) {
    rankForm.hidden = false;
    submitBtn.disabled = false;
    submitBtn.textContent = "랭킹 등록";
    nicknameInput.value = loadNickname();
  }

  mainBtn.textContent = "다시 도전";
  mainBtn.classList.remove("is-stop");
}

// ---------- 최고 기록 (내 브라우저에 저장) ----------

function updateBest(elapsed, absDiff) {
  let best = null;
  try {
    best = JSON.parse(localStorage.getItem(BEST_KEY));
  } catch (e) {
    best = null;
  }

  const isNewBest = !best || absDiff < best.absDiff;

  if (isNewBest) {
    try {
      localStorage.setItem(BEST_KEY, JSON.stringify({ elapsed, absDiff }));
    } catch (e) {
      // 저장이 막힌 환경(시크릿 모드 등)은 무시
    }
    return best ? "🎉 최고 기록 갱신!" : "첫 기록이 저장되었어요";
  }

  return `내 최고 기록: ${best.elapsed.toFixed(3)}초`;
}

// 오차 표시: +0.012 / -0.002 / ±0.000
function formatDiff(diff) {
  const sign = diff > 0 ? "+" : diff < 0 ? "-" : "±";
  return `${sign}${Math.abs(diff).toFixed(3)}`;
}

function loadNickname() {
  try {
    return localStorage.getItem(NICK_KEY) || "";
  } catch (e) {
    return "";
  }
}

function saveNickname(name) {
  try {
    localStorage.setItem(NICK_KEY, name);
  } catch (e) {}
}

// ---------- 기기 고유번호 (같은 사람 구분용) ----------
// 기기·브라우저마다 한 번 만들어 저장. 이 번호로 "내 기록"을 찾아 최고 기록만 남김
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
    // 저장이 막힌 환경(시크릿 모드 등)에서는 이번 접속 동안만 유지
    if (!memoryPlayerId) memoryPlayerId = makeId();
    return memoryPlayerId;
  }
}

// ---------- 랭킹 ----------

async function loadRanking() {
  if (!db) {
    renderRankMessage("랭킹 준비 중이에요 🛠️");
    return;
  }

  loadHallOfFame();

  const { data, error } = await db
    .from("rankings")
    .select("id, nickname, elapsed, abs_diff")
    .order("abs_diff", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(10);

  if (error) {
    console.error(error);
    renderRankMessage("랭킹을 불러오지 못했어요 😢");
    return;
  }

  if (!data.length) {
    renderRankMessage("아직 기록이 없어요. 첫 번째 주인공이 되어보세요!");
    return;
  }

  renderRanking(data);
}

async function loadHallOfFame() {
  const { data, error } = await db
    .from("hall_of_fame")
    .select("nickname, elapsed, achieved_at")
    .eq("title", "first_perfect_10")
    .maybeSingle();

  if (error || !data) {
    hofEl.hidden = true;
    return;
  }

  const date = new Date(data.achieved_at);
  const dateText = `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}`;

  // 닉네임은 사용자가 입력한 값이라 textContent로만 넣기
  hofEl.innerHTML = `
    <span class="hof-crown">👑</span>
    <div class="hof-info">
      <p class="hof-title">최초 완벽한 10초 달성</p>
      <p class="hof-name"></p>
    </div>
    <div class="hof-meta"><b></b><span></span></div>`;
  hofEl.querySelector(".hof-name").textContent = data.nickname;
  hofEl.querySelector(".hof-meta b").textContent =
    `${Number(data.elapsed).toFixed(3)}초`;
  hofEl.querySelector(".hof-meta span").textContent = dateText;
  hofEl.hidden = false;
}

function renderRankMessage(message) {
  rankListEl.innerHTML = "";
  const li = document.createElement("li");
  li.className = "rank-empty";
  li.textContent = message;
  rankListEl.appendChild(li);
}

function renderRanking(rows) {
  const medals = ["🥇", "🥈", "🥉"];
  rankListEl.innerHTML = "";

  rows.forEach((row, i) => {
    const li = document.createElement("li");
    li.className = "rank-item";
    if (myLastEntry && row.id === myLastEntry.id) li.classList.add("is-me");

    const pos = document.createElement("span");
    pos.className = "rank-pos";
    pos.textContent = medals[i] || `${i + 1}`;

    // 닉네임은 사용자가 입력한 값이라 반드시 textContent로 넣기 (해킹 방지)
    const name = document.createElement("span");
    name.className = "rank-name";
    name.textContent = row.nickname;

    const time = document.createElement("span");
    time.className = "rank-time";
    time.textContent = `${Number(row.elapsed).toFixed(3)}초`;

    li.append(pos, name, time);
    rankListEl.appendChild(li);
  });
}

async function submitScore(e) {
  e.preventDefault();
  if (!db || !lastResult || lastResult.submitted) return;

  const nickname = nicknameInput.value.trim().slice(0, MAX_NICK);
  if (!nickname) {
    showToast("닉네임을 입력해주세요");
    nicknameInput.focus();
    return;
  }

  const elapsed = Number(lastResult.elapsed.toFixed(3));
  if (elapsed < 1 || elapsed > 60) {
    showToast("1~60초 사이 기록만 등록할 수 있어요");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "등록 중...";

  // DB 함수가 알아서 처리: 처음이면 추가 / 더 잘했으면 교체 / 아니면 기존 기록 유지
  const { data, error } = await db
    .rpc("submit_score", {
      p_player_id: getPlayerId(),
      p_nickname: nickname,
      p_elapsed: elapsed,
    })
    .single();

  if (error) {
    console.error(error);
    showToast("등록에 실패했어요. 다시 시도해주세요 😢");
    submitBtn.disabled = false;
    submitBtn.textContent = "랭킹 등록";
    return;
  }

  lastResult.submitted = true;
  myLastEntry = { id: data.rank_id };
  saveNickname(nickname);

  // 내 순위 = 내 최고 기록보다 오차가 작은 기록 수 + 1
  const { count } = await db
    .from("rankings")
    .select("id", { count: "exact", head: true })
    .lt("abs_diff", data.best_abs_diff);

  const rankText = typeof count === "number" ? ` 전체 ${count + 1}위` : "";
  const best = Number(data.best_elapsed).toFixed(3);
  const messages = {
    new: `🎉 ${nickname}님 랭킹 등록!${rankText}`,
    improved: `🔥 최고 기록 갱신! ${best}초,${rankText}`,
    kept: `기존 최고 기록 ${best}초가 유지돼요.${rankText}`,
  };

  rankForm.hidden = true;
  myRankEl.hidden = false;
  myRankEl.textContent = data.is_first_perfect
    ? `👑 최초 완벽한 10초! ${nickname}님이 명예의 전당에 올랐어요`
    : messages[data.result] || "랭킹에 반영되었어요!";

  await loadRanking();
}

// ---------- 공유 ----------

async function shareResult() {
  if (!lastResult) return;

  const { elapsed, diff, grade } = lastResult;
  const url = "https://ge323.github.io/gongjakso/stop-at-10/";
  const text =
    `⏱️ 딱 10초 도전!\n` +
    `내 기록: ${elapsed.toFixed(3)}초 (오차 ${formatDiff(diff)}초)\n` +
    `${grade}\n\n👉 ${url}`;

  // 모바일: 공유 시트 / PC: 클립보드 복사
  if (navigator.share) {
    try {
      await navigator.share({ title: "딱 10초", text });
      return;
    } catch (e) {
      if (e.name === "AbortError") return; // 사용자가 공유 취소
    }
  }

  try {
    await navigator.clipboard.writeText(text);
    showToast("결과가 복사되었어요! 댓글에 인증해주세요 ✍️");
  } catch (e) {
    showToast("복사에 실패했어요 😢");
  }
}

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("is-show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toastEl.classList.remove("is-show"), 2000);
}

// ---------- 입력 처리 ----------
// ---------- 입력 처리 ----------

// 누른 순간의 시간: 브라우저가 기록한 이벤트 발생 시각(e.timeStamp)을 우선 사용
// → 화면을 그리느라 처리가 늦어져도 실제로 누른 순간 기준으로 측정됨
function pressTime(e) {
  const t = e && e.timeStamp;
  const now = performance.now();
  return t > 0 && t <= now && now - t < 1000 ? t : now;
}

function handleAction(e) {
  const t = pressTime(e);
  if (state === "running") {
    stopGame(t);
  } else {
    // 멈춘 직후 연타로 바로 재시작되는 것 방지
    if (state === "result" && t - stoppedAt < RESTART_GUARD) return;
    startGame(t);
  }
}

// pointerdown: click보다 반응이 빨라서 기록 정확도가 올라감
mainBtn.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  handleAction(e);
});

// PC: 스페이스바 / 엔터 (닉네임 입력 중에는 동작 안 함)
document.addEventListener("keydown", (e) => {
  if (document.activeElement === nicknameInput) return;
  if ((e.code === "Space" || e.code === "Enter") && !e.repeat) {
    e.preventDefault();
    handleAction(e);
  }
});

shareBtn.addEventListener("click", shareResult);
rankForm.addEventListener("submit", submitScore);
refreshBtn.addEventListener("click", loadRanking);

// 첫 화면에서 랭킹 불러오기
loadRanking();
