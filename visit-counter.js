// 공작소 방문자 수 — 모든 페이지에서 불러도 됨
// 숫자는 id="visit-count" 요소가 있는 페이지(메인)에만 표시
(() => {
  const SUPABASE_URL = "https://mamunluhjcrmharnrqdz.supabase.co";
  const SUPABASE_KEY = "sb_publishable_eh0u-VyFBgXRSovoBPrgsQ_F2pYPjWU";

  const ID_KEY = "gongjakso-visitor";
  // 각 게임이 쓰던 기기 ID — 같은 사람을 한 번만 세기 위해 사용
  const OLD_KEYS = ["stop-at-10-player", "pixel-fish-player", "awake-player"];
  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const makeId = () =>
    (window.crypto && crypto.randomUUID && crypto.randomUUID()) ||
    "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });

  let id = null;
  let oldIds = [];
  try {
    oldIds = OLD_KEYS.map((k) => localStorage.getItem(k)).filter(
      (v) => v && UUID_RE.test(v),
    );
    id = localStorage.getItem(ID_KEY);
    if (!id || !UUID_RE.test(id)) {
      id = oldIds[0] || makeId(); // 게임을 해 본 기기면 그 ID를 이어 씀
      localStorage.setItem(ID_KEY, id);
    }
    oldIds = [...new Set(oldIds)].filter((v) => v !== id);
  } catch (e) {
    id = null; // 저장 막힌 브라우저: 세지는 않고 숫자만 보여줌
    oldIds = [];
  }

  fetch(SUPABASE_URL + "/rest/v1/rpc/visit_site", {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ p_player_id: id, p_old_ids: oldIds }),
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      const el = document.getElementById("visit-count");
      if (!d || !el) return;
      const n = (v) => Number(v).toLocaleString("ko-KR");
      el.textContent = `누적 ${n(d.total)}명 · 오늘 ${n(d.today)}명`;
      el.hidden = false;
    })
    .catch(() => {});
})();
