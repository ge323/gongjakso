/* 💐 bouquet/script.js — 만들기(리본 묶기) + 받기(리본 풀기) */
(() => {
  'use strict';

  const SB_URL = 'https://mamunluhjcrmharnrqdz.supabase.co';
  const SB_KEY = 'sb_publishable_eh0u-VyFBgXRSovoBPrgsQ_F2pYPjWU'
  const F = window.Flowers;
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const MAX_MAIN = 7, MAX_FILL = 4;
  const STEPS = ['flowers', 'wrap', 'letter', 'ribbon', 'done'];

  document.body.insertAdjacentHTML('afterbegin', F.defs());

  const svg = $('#bq'), body = $('#bq-body'), rib = $('#bq-ribbon'), gd = $('#bq-guide');
  const drawP = $('#bq-draw'), drawH = $('#bq-draw-hl'), hint = $('#hint');

  const st = { flowers: [], wrap: 'cream', ribbon: 'pink', to: '', from: '', letter: '' };
  let mode = 'make', mood = 'all', step = 0, tie = 0, fails = 0, sending = false;
  let pts = null, pull = null, opened = false;

  /* ---------- 공용 ---------- */
  let toastT;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove('show'), 2200);
  }

  function playerId() {
    try {
      let id = localStorage.getItem('bouquet-player');
      if (!id) { id = crypto.randomUUID(); localStorage.setItem('bouquet-player', id); }
      return id;
    } catch { return crypto.randomUUID(); }
  }

  async function rpc(fn, args) {
    const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SB_KEY },
      body: JSON.stringify(args),
    });
    const j = await r.json().catch(() => null);
    if (!r.ok) throw new Error((j && (j.message || j.hint)) || `HTTP ${r.status}`);
    return j;
  }

  // 오르골 같은 짧은 소리 (음원 파일 없이 Web Audio로)
  let ac;
  function chime(notes) {
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      const t0 = ac.currentTime;
      notes.forEach((f, i) => {
        const o = ac.createOscillator(), g = ac.createGain(), t = t0 + i * .12;
        o.type = 'sine';
        o.frequency.value = f;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(.12, t + .01);
        g.gain.exponentialRampToValueAtTime(.0001, t + 1.2);
        o.connect(g).connect(ac.destination);
        o.start(t);
        o.stop(t + 1.3);
      });
    } catch { /* 소리 없이 진행 */ }
  }
  const buzz = p => { try { navigator.vibrate && navigator.vibrate(p); } catch { } };

  function svgPt(e) {
    const p = svg.createSVGPoint();
    p.x = e.clientX; p.y = e.clientY;
    return p.matrixTransform(svg.getScreenCTM().inverse());
  }

  function drawBouquet() { body.innerHTML = F.compose(st); }
  function drawRibbon(stage, anim) {
    rib.dataset.stage = stage;
    rib.classList.toggle('anim', !!anim);
    rib.innerHTML = F.ribbon(st.ribbon, stage);
  }

  const flowerSvg = fl => `<svg viewBox="${fl.filler ? '-56 -56 112 112' : '-46 -46 92 92'}" aria-hidden="true">${F.head(fl.id)}</svg>`;

  /* ================= 만들기 ================= */
  function counts() {
    let m = 0, f = 0;
    st.flowers.forEach(id => (F.byId[id].filler ? f++ : m++));
    return { m, f };
  }

  function renderMoods() {
    $('#moods').innerHTML = F.MOODS
      .map(m => `<button class="chip${m.id === mood ? ' on' : ''}" data-mood="${m.id}">${m.name}</button>`)
      .join('');
  }

  const cardHTML = fl =>
    `<div class="fl" data-id="${fl.id}" role="button" tabindex="0">${flowerSvg(fl)}<b>${fl.name}</b><span>${fl.meaning}</span><i class="n"></i><button type="button" class="minus" aria-label="${fl.name} 빼기">−</button></div>`;

  function renderGrid() {
    const list = F.FLOWERS.filter(f => !f.filler && (mood === 'all' || f.moods.includes(mood)));
    $('#grid').innerHTML = list.map(cardHTML).join('');
    if (!$('#grid-fill').children.length) {
      $('#grid-fill').innerHTML = F.FLOWERS.filter(f => f.filler).map(cardHTML).join('');
    }
    updateCards();
  }

  function updateCards() {
    $$('.fl').forEach(el => {
      const n = st.flowers.filter(x => x === el.dataset.id).length;
      el.classList.toggle('on', n > 0);
      el.querySelector('.n').textContent = n || '';
    });
    const { m, f } = counts();
    $('#count').textContent = `꽃 ${m}/${MAX_MAIN} · 곁들임 ${f}/${MAX_FILL}`;
    setHint();
    updateNav();
  }

  function addFlower(id) {
    const fl = F.byId[id], c = counts();
    if (fl.filler ? c.f >= MAX_FILL : c.m >= MAX_MAIN) {
      return toast(fl.filler ? `곁들임은 ${MAX_FILL}개까지예요` : `꽃은 ${MAX_MAIN}송이까지예요`);
    }
    st.flowers.push(id);
    updateCards();
    drawBouquet();
  }

  function removeFlower(id) {
    const i = st.flowers.lastIndexOf(id);
    if (i >= 0) st.flowers.splice(i, 1);
    updateCards();
    drawBouquet();
  }

  function renderSwatches() {
    $('#sw-wrap').innerHTML = Object.entries(F.WRAPS)
      .map(([k, [a, b]]) => `<button class="sw${k === st.wrap ? ' on' : ''}" data-wrap="${k}" style="background:linear-gradient(${a},${b})" aria-label="${F.WRAP_NAMES[k]}"></button>`)
      .join('');
    $('#sw-ribbon').innerHTML = Object.entries(F.RIBBONS)
      .map(([k, c]) => `<button class="sw${k === st.ribbon ? ' on' : ''}" data-ribbon="${k}" style="background:${c}" aria-label="${F.RIBBON_NAMES[k]}"></button>`)
      .join('');
  }

  function setHint() {
    if (mode !== 'make') return;
    const name = STEPS[step];
    hint.textContent =
      name === 'flowers' ? (st.flowers.length ? '' : '꽃을 눌러 담아 보세요. 처음 고른 꽃이 가운데에 와요') :
      name === 'ribbon' ? ['∞를 그려 리본을 감아 주세요', '한 번 더 그려 나비 리본을 만들어요', '다 묶었어요'][tie] :
      '';
  }

  function updateNav() {
    const name = STEPS[step], nx = $('#next');
    nx.textContent = sending ? '보내는 중…' : name === 'ribbon' ? '보내기' : '다음';
    nx.disabled = sending || (name === 'flowers' && counts().m < 1) || (name === 'ribbon' && tie < 2);
  }

  function go(i) {
    step = i;
    const name = STEPS[i];
    $$('#maker [data-step]').forEach(s => { s.hidden = s.dataset.step !== name; });
    $('#nav').hidden = name === 'done';
    $('#prev').hidden = i === 0;
    $('#count').hidden = name !== 'flowers';
    const drawing = name === 'ribbon' && tie < 2;
    svg.classList.toggle('drawing', drawing);
    gd.innerHTML = drawing ? F.guide() : '';
    gd.classList.toggle('strong', fails >= 2);
    setHint();
    updateNav();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  $('#maker').addEventListener('click', e => {
    const minus = e.target.closest('.minus');
    if (minus) return removeFlower(minus.closest('.fl').dataset.id);
    const fl = e.target.closest('.fl');
    if (fl) return addFlower(fl.dataset.id);
    const mo = e.target.closest('[data-mood]');
    if (mo) { mood = mo.dataset.mood; renderMoods(); renderGrid(); return; }
    const w = e.target.closest('[data-wrap]');
    if (w) { st.wrap = w.dataset.wrap; renderSwatches(); drawBouquet(); return; }
    const r = e.target.closest('[data-ribbon]');
    if (r) { st.ribbon = r.dataset.ribbon; renderSwatches(); drawRibbon(tie, false); drawP.setAttribute('stroke', F.RIBBONS[st.ribbon]); }
  });
  $('#maker').addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('fl')) { e.preventDefault(); addFlower(e.target.dataset.id); }
  });

  $('#letter').addEventListener('input', e => { $('#len').textContent = e.target.value.length; });

  $('#prev').addEventListener('click', () => go(step - 1));
  $('#next').addEventListener('click', () => {
    const name = STEPS[step];
    if (name === 'letter') {
      st.to = $('#to').value.trim();
      st.letter = $('#letter').value.trim();
      st.from = $('#from').value.trim();
      if (!st.to || !st.letter || !st.from) return toast('받는 사람, 편지, 보내는 사람을 모두 적어 주세요');
    }
    if (name === 'ribbon') return send();
    go(step + 1);
  });

  /* ----- 리본 묶기: ∞ 그리기 ----- */
  function paintStroke() {
    const d = pts.map((p, i) => (i ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join('');
    for (const el of [drawP, drawH]) { el.setAttribute('d', d); el.classList.remove('fade'); }
  }

  function clearStroke() {
    drawP.classList.add('fade');
    drawH.classList.add('fade');
    setTimeout(() => { if (!pts) { drawP.setAttribute('d', ''); drawH.setAttribute('d', ''); } }, 450);
  }

  function tieUp() {
    tie = Math.min(2, tie + 1);
    drawRibbon(tie, true);
    chime(tie === 1 ? [784, 988] : [784, 988, 1319]);
    buzz(tie === 2 ? [20, 40, 30] : 25);
    if (tie >= 2) {
      gd.innerHTML = '';
      svg.classList.remove('drawing');
      $('#auto').hidden = true;
    }
    setHint();
    updateNav();
  }

  function missStroke() {
    fails++;
    gd.classList.remove('shake');
    void gd.getBoundingClientRect(); // 흔들기 애니메이션 다시 시작
    gd.classList.add('shake');
    gd.classList.toggle('strong', fails >= 2);
    hint.textContent = '점선을 따라 ∞를 그려 주세요';
    if (fails >= 3) $('#auto').hidden = false;
    buzz(15);
  }

  $('#auto').addEventListener('click', tieUp);

  /* ================= 받기 ================= */
  function fillCard() {
    $('#c-to').textContent = `To. ${st.to}`;
    $('#c-from').textContent = `From. ${st.from}`;
    $('#c-letter').textContent = st.letter;
    $('#c-flowers').innerHTML = [...new Set(st.flowers)]
      .filter(id => F.byId[id])
      .map(id => { const fl = F.byId[id]; return `<li>${flowerSvg(fl)}<b>${fl.name}</b><span>${fl.meaning}</span></li>`; })
      .join('');
  }

  function applyPull(dy) {
    const k = Math.min(dy / 100, 1);
    rib.style.transform = `translateY(${(dy * .25).toFixed(1)}px)`;
    const loops = rib.querySelector('.rb-loops'), tail = rib.querySelector('.rb-tail.r');
    if (loops) loops.style.transform = `scale(${(1 - k * .35).toFixed(3)})`;
    if (tail) tail.style.transform = `scaleY(${(1 + k * .7).toFixed(3)})`;
  }

  function untie() {
    if (opened) return;
    opened = true;
    gd.innerHTML = '';
    hint.textContent = '';
    $('#open-btn').hidden = true;
    svg.classList.remove('drawing');
    rib.classList.remove('spring');
    rib.style.transform = '';
    rib.querySelectorAll('[style]').forEach(el => { el.style.transform = ''; });
    rib.classList.add('untie');
    chime([1047, 1319, 1568, 2093]);
    buzz([20, 40, 20]);
    setTimeout(() => {
      const card = $('#card');
      card.hidden = false;
      $('#again').hidden = false;
      requestAnimationFrame(() => card.classList.add('show'));
      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 750);
  }

  async function view(id) {
    mode = 'view';
    document.body.classList.add('viewing');
    $('#viewer').hidden = false;
    hint.textContent = '불러오는 중…';
    let b;
    try {
      b = await rpc('get_bouquet', { p_id: id });
    } catch {
      hint.textContent = '';
      $('#missing').textContent = '불러오지 못했어요. 잠시 후 새로고침해 주세요';
      $('#missing').hidden = false;
      return;
    }
    if (!b) {
      hint.textContent = '';
      $('#missing').textContent = '꽃다발을 찾을 수 없어요';
      $('#missing').hidden = false;
      $('#again').hidden = false;
      return;
    }
    Object.assign(st, { flowers: b.flowers, wrap: b.wrap, ribbon: b.ribbon, to: b.to, from: b.from, letter: b.letter });
    $('#to-line').textContent = `To. ${st.to}`;
    drawBouquet();
    drawRibbon(2, false);
    fillCard();
    svg.classList.add('drawing');
    gd.innerHTML = '<circle class="pulse" cx="231" cy="456" r="8"/>';
    hint.textContent = '리본 끝을 아래로 당겨 풀어 보세요';
    setTimeout(() => { if (!opened) $('#open-btn').hidden = false; }, 8000);
  }

  $('#open-btn').addEventListener('click', untie);

  /* ================= 포인터 (그리기 / 당기기) ================= */
  svg.addEventListener('pointerdown', e => {
    if (mode === 'make') {
      if (STEPS[step] !== 'ribbon' || tie >= 2) return;
      pts = [svgPt(e)];
      paintStroke();
    } else {
      if (opened) return;
      const p = svgPt(e);
      if (Math.hypot(p.x - 200, p.y - 410) > 120) return;
      pull = { y0: p.y, dy: 0 };
      rib.classList.remove('spring');
    }
    svg.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  svg.addEventListener('pointermove', e => {
    if (pts) { pts.push(svgPt(e)); paintStroke(); }
    else if (pull) { pull.dy = Math.max(0, Math.min(150, svgPt(e).y - pull.y0)); applyPull(pull.dy); }
  });

  function pointerEnd() {
    if (pts) {
      const ok = F.isInfinity(pts);
      pts = null;
      clearStroke();
      ok ? tieUp() : missStroke();
    } else if (pull) {
      const dy = pull.dy;
      pull = null;
      if (dy >= 85) untie();
      else { rib.classList.add('spring'); applyPull(0); }
    }
  }
  svg.addEventListener('pointerup', pointerEnd);
  svg.addEventListener('pointercancel', pointerEnd);

  /* ================= 보내기 ================= */
  async function send() {
    if (sending) return;
    sending = true;
    updateNav();
    try {
      const id = await rpc('save_bouquet', {
        p_player_id: playerId(),
        p_flowers: st.flowers,
        p_wrap: st.wrap,
        p_ribbon: st.ribbon,
        p_to: st.to,
        p_from: st.from,
        p_letter: st.letter,
      });
      const url = `${location.origin}${location.pathname}?b=${id}`;
      $('#link').value = url;
      $('#preview').href = url;
      sending = false;
      go(STEPS.indexOf('done'));
    } catch (err) {
      const m = String(err.message);
      toast(m.includes('too_many') ? '오늘은 더 보낼 수 없어요. 내일 다시 보내 주세요'
        : m.includes('bad_text') ? '쓸 수 없는 단어가 들어 있어요'
        : '보내지 못했어요. 잠시 후 다시 해 주세요');
    } finally {
      sending = false;
      updateNav();
    }
  }

  $('#copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('#link').value); }
    catch { $('#link').select(); document.execCommand('copy'); }
    toast('링크를 복사했어요');
  });
  if (!navigator.share) $('#share').hidden = true;
  $('#share').addEventListener('click', async () => {
    try { await navigator.share({ title: '꽃다발이 도착했어요', url: $('#link').value }); } catch { }
  });

  /* ================= 시작 ================= */
  const bid = new URLSearchParams(location.search).get('b');
  if (bid) {
    view(bid);
  } else {
    $('#maker').hidden = false;
    renderMoods();
    renderGrid();
    renderSwatches();
    drawP.setAttribute('stroke', F.RIBBONS[st.ribbon]);
    drawBouquet();
    go(0);
  }
})();
