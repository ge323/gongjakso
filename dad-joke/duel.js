// ⏱️ 60초 아재개그 퀴즈 — 혼자 도전 / 1:1 대결
// 같은 문제 순서를 각자 속도로 풀고, 60초 동안 많이 맞힌 사람이 승리
// 시간·채점은 서버(dj_room_*, dj_solo_*)가 하고, 화면은 상태를 받아 그림
(() => {
  const $ = s => document.querySelector(s);
  const ERR = {
    bad_name: '닉네임을 확인해 주세요 (1~10자)',
    room_gone: '방이 사라졌어요',
    room_full: '이미 대결이 시작된 방이에요',
    own_room: '내가 만든 방이에요',
    limit: '오늘은 너무 많이 했어요. 내일 또 와 주세요!',
  };
  const errText = e => {
    const m = (e && e.message) || '';
    const k = Object.keys(ERR).find(k => m.includes(k));
    return k ? ERR[k] : '연결이 불안정해요. 잠시 후 다시 해 주세요';
  };
  async function call(fn, args) {
    const { data, error } = await db.rpc(fn, args);
    if (error) throw error;
    return data;
  }

  // ---------- 상태 ----------
  let room = null;          // 방 번호
  let mode = null;          // 'solo' | 'duel'
  let st = null;            // 마지막 서버 상태
  let offset = 0;           // 서버 시각 - 내 시각
  let myIdx = 0, myQ = null, myScore = 0;
  let pollT = null, listT = null, drawT = null;
  let busy = false;
  let lastCount = '';
  let kicked = 0;           // 카운트다운 0초에 한 번만 바로 확인
  let pendingCode = (new URLSearchParams(location.search).get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);

  const views = ['duelLobby', 'duelWait', 'duelGame', 'duelDone'];
  function view(id) { views.forEach(v => { $('#' + v).hidden = v !== id; }); }
  const now = () => Date.now() + offset;

  const nameBox = $('#duelName');
  try { nameBox.value = localStorage.getItem('dad-joke-name') || ''; } catch {}
  function myName() {
    const n = nameBox.value.trim();
    if (!n) { toast('닉네임을 먼저 적어 주세요'); nameBox.focus(); return null; }
    try { localStorage.setItem('dad-joke-name', n); } catch {}
    return n;
  }

  // 누가 들어왔을 때 알림 (소리 + 진동 + 탭 제목)
  let ac;
  function unlockAudio() {
    try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); ac.resume(); } catch {}
  }
  function beep(freqs, gap = .14) {
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      freqs.forEach((f, i) => {
        const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + i * gap;
        o.frequency.value = f;
        g.gain.setValueAtTime(.0001, t);
        g.gain.exponentialRampToValueAtTime(.22, t + .02);
        g.gain.exponentialRampToValueAtTime(.0001, t + .28);
        o.connect(g).connect(ac.destination);
        o.start(t); o.stop(t + .3);
      });
    } catch {}
  }
  function ding() {
    beep([660, 880]);
    vibrate([80, 60, 80]);
    const base = document.title;
    let n = 0;
    const t = setInterval(() => {
      document.title = n % 2 ? base : '🥊 상대가 들어왔어요!';
      if (++n > 8 || !document.hidden) { clearInterval(t); document.title = base; }
    }, 700);
  }

  // ---------- 대기실 ----------
  async function loadBest() {
    try {
      const b = await call('dj_solo_best', { p_player: PLAYER });
      $('#myBest').textContent = b && b.plays ? `내 최고 기록 ${b.best}개` : '';
    } catch {}
  }
  async function loadList() {
    if (room || $('#duelLobby').hidden || !$('#tab-duel').classList.contains('on')) return;
    try {
      const list = await call('dj_room_list', {});
      const ul = $('#roomList');
      ul.innerHTML = '';
      list.forEach(r => {
        const li = document.createElement('li');
        const m = Math.floor(r.waited / 60);
        li.innerHTML = '<span class="host"></span><span class="wait"></span><button class="btn-join">참가</button>';
        li.querySelector('.host').textContent = r.host;
        li.querySelector('.wait').textContent = m ? `${m}분째 대기` : '방금 열림';
        li.querySelector('button').addEventListener('click', () => join(r.code));
        ul.append(li);
      });
      $('#roomEmpty').hidden = list.length > 0;
      $('#roomCount').textContent = list.length ? list.length : '';
    } catch {}
  }
  function startList() { stopList(); loadList(); listT = setInterval(loadList, 3000); }
  function stopList() { clearInterval(listT); listT = null; }

  function renderInvite() {
    $('#inviteCard').hidden = !pendingCode;
    $('#inviteCode').textContent = pendingCode;
    $('#inviteJoin').hidden = !pendingCode;
    $('#duelCreate').hidden = !!pendingCode;
  }
  function toLobby() {
    clearTimeout(pollT); clearInterval(drawT); drawT = null;
    room = null; st = null; mode = null;
    view('duelLobby');
    renderInvite();
    loadBest();
    startList();
  }

  async function solo() {
    if (busy) return;
    unlockAudio();
    busy = true;
    try {
      room = await call('dj_solo_start', { p_player: PLAYER });
      mode = 'solo';
      enterRoom();
    } catch (e) { toast(errText(e)); }
    busy = false;
  }
  async function create() {
    const n = myName();
    if (!n || busy) return;
    unlockAudio();
    busy = true;
    try {
      room = await call('dj_room_create', { p_player: PLAYER, p_name: n });
      mode = 'duel';
      enterRoom();
    } catch (e) { toast(errText(e)); }
    busy = false;
  }
  async function join(code) {
    const n = myName();
    if (!n || busy) return;
    unlockAudio();
    busy = true;
    try {
      room = await call('dj_room_join', { p_player: PLAYER, p_name: n, p_code: code });
      mode = 'duel';
      pendingCode = '';
      clearRoomParam();
      enterRoom();
    } catch (e) {
      toast(errText(e));
      if (code === pendingCode) { pendingCode = ''; clearRoomParam(); renderInvite(); }
      loadList();
    }
    busy = false;
  }
  function clearRoomParam() {
    if (location.search.includes('room=')) history.replaceState(null, '', location.pathname);
  }

  // ---------- 방 ----------
  function enterRoom() {
    stopList();
    st = null; myIdx = 0; myQ = null; myScore = 0; lastCount = '';
    setMsg('', '');
    $('#gInput').value = '';
    poll();
    clearInterval(drawT);
    drawT = setInterval(draw, 100);
  }
  async function poll() {
    clearTimeout(pollT);
    if (!room) return;
    const code = room;
    try {
      const s = await call('dj_room_state', { p_player: PLAYER, p_code: code });
      if (code !== room) return;
      offset = s.now - Date.now();
      const prev = st;
      st = s;
      mode = s.mode;
      if (prev && prev.phase === 'waiting' && s.phase !== 'waiting') ding();
      // 서버가 더 앞서 있으면 (새로고침 등) 따라감
      if (s.phase === 'playing' && (s.idx > myIdx || myQ === null)) {
        myIdx = s.idx; myQ = s.q; myScore = s.my_score;
      }
      draw();
    } catch (e) {
      if ((e.message || '').includes('not_in_room')) { toLobby(); return; }
    }
    if (!st) { pollT = setTimeout(poll, 1000); return; }
    if (st.phase === 'done') {
      // 끝난 뒤: 1:1은 '한 판 더' 신호만 천천히 확인, 혼자 도전은 멈춤
      if (st.mode === 'duel') pollT = setTimeout(poll, 2000);
      return;
    }
    const active = ['countdown', 'playing'].includes(st.phase);
    pollT = setTimeout(poll, active ? 700 : document.hidden ? 3000 : 1500);
  }
  async function leave() {
    if (room) { try { await call('dj_room_leave', { p_player: PLAYER, p_code: room }); } catch {} }
    toLobby();
  }
  // 창을 닫을 때 방 정리
  window.addEventListener('pagehide', () => {
    if (!room) return;
    try {
      fetch(`${SB_URL}/rest/v1/rpc/dj_room_leave`, {
        method: 'POST', keepalive: true,
        headers: { 'Content-Type': 'application/json', apikey: SB_KEY },
        body: JSON.stringify({ p_player: PLAYER, p_code: room }),
      });
    } catch {}
  });

  // ---------- 그리기 ----------
  function setMsg(text, cls) {
    const m = $('#gMsg');
    m.textContent = text;
    m.className = 'msg ' + (cls || '');
  }
  function draw() {
    if (!st) return;
    const s = st;
    if (s.phase === 'waiting') { view('duelWait'); $('#waitCode').textContent = room; return; }
    if (s.phase === 'closed') { toLobby(); toast('방이 닫혔어요'); return; }
    if (s.phase === 'done') { drawDone(s); return; }

    view('duelGame');
    const solo = s.mode === 'solo';
    $('#gameBoard').classList.toggle('solo', solo);
    $('#meName').textContent = solo ? '맞힌 개수' : s.my_name;
    $('#meScore').textContent = Math.max(myScore, s.my_score);
    $('#oppName').textContent = solo ? '' : s.opp_name;
    $('#oppScore').textContent = solo ? '' : s.opp_score;

    const cnt = $('#gCount'), form = $('#gForm'), skip = $('#gSkip');
    if (s.phase === 'countdown') {
      // 0초가 되면 다음 확인을 기다리지 않고 바로 상태를 받아 시작
      if (s.start - now() <= 0 && kicked !== s.start) { kicked = s.start; poll(); }
      const left = Math.max(1, Math.ceil((s.start - now()) / 1000));
      cnt.hidden = false;
      if (lastCount !== String(left)) {
        lastCount = String(left);
        cnt.textContent = left;
        cnt.classList.remove('tick'); void cnt.offsetWidth; cnt.classList.add('tick');
        beep([440], 0);
      }
      $('#gQ').textContent = '';
      $('#gTime').textContent = '60초';
      $('#gTimer').style.width = '100%';
      form.hidden = true; skip.hidden = true;
      if (!$('#gMsg').textContent) setMsg('곧 시작해요!', '');
      return;
    }

    // playing
    if (!cnt.hidden) {
      cnt.hidden = true;
      setMsg('', '');
      beep([880], 0);
      setTimeout(() => $('#gInput').focus({ preventScroll: true }), 30);
    }
    const left = Math.max(0, s.end - now());
    $('#gTimer').style.width = `${left / 600}%`;
    $('#gTimer').classList.toggle('hurry', left < 10000);
    $('#gTime').textContent = `${Math.ceil(left / 1000)}초`;
    $('#gQ').textContent = myQ || '준비한 문제를 다 풀었어요! 👏';
    const over = left <= 0 || !myQ;
    form.hidden = over; skip.hidden = over;
    if (left <= 0 && !$('#gMsg').classList.contains('end')) {
      setMsg('끝!', 'end');
      poll();
    }
  }

  function drawDone(s) {
    clearInterval(drawT); drawT = null;
    view('duelDone');
    const solo = s.mode === 'solo';
    const me = s.my_score, op = s.opp_score;
    let title, cls, line, sub = '';
    if (solo) {
      title = s.new_best ? '신기록! 🎉' : `${me}개 맞혔어요`;
      cls = s.new_best ? 'win' : '';
      line = s.new_best ? `60초 동안 ${me}개` : `내 최고 기록 ${s.best || me}개`;
    } else {
      if (s.done_reason === 'opp_left') { title = '상대가 나갔어요. 승리!'; cls = 'win'; }
      else if (s.done_reason === 'me_left') { title = '대결에서 나왔어요'; cls = ''; }
      else if (me > op) { title = '승리! 🎉'; cls = 'win'; }
      else if (me < op) { title = '아쉽게 졌어요'; cls = 'lose'; }
      else { title = '무승부!'; cls = ''; }
      line = `${s.my_name} ${me} : ${op} ${s.opp_name}`;
    }
    $('#doneTitle').textContent = title;
    $('#doneTitle').className = 'done-title ' + cls;
    $('#doneScore').textContent = line;
    $('#doneSub').textContent = sub;

    const again = $('#againBtn');
    again.classList.remove('blink');
    if (solo) {
      again.textContent = '다시 도전';
      again.hidden = false;
    } else if (s.done_reason === 'opp_left' || s.done_reason === 'me_left') {
      again.hidden = true;
    } else {
      again.hidden = false;
      if (s.next_room && s.next_host === 'opp') {
        again.textContent = '상대가 한 판 더 원해요! 참가하기';
        again.classList.add('blink');
      } else {
        again.textContent = '한 판 더';
      }
    }
    $('#toLobby').textContent = solo ? '처음으로' : '대기실로';
  }

  async function again() {
    if (!room || busy || !st) return;
    if (st.mode === 'solo') { room = null; return solo(); }
    busy = true;
    try {
      const code = await call('dj_room_rematch', { p_player: PLAYER, p_code: room });
      room = code;
      mode = 'duel';
      enterRoom();
    } catch (e) { toast(errText(e)); }
    busy = false;
  }

  // ---------- 답 내기 / 넘기기 ----------
  async function submit(e) {
    e.preventDefault();
    const inp = $('#gInput');
    const text = inp.value.trim();
    if (!text || !room || busy) return;
    busy = true;
    try {
      const r = await call('dj_room_answer', { p_player: PLAYER, p_code: room, p_text: text });
      if (r.r === 'correct') {
        myIdx = r.idx; myQ = r.q; myScore = r.score;
        inp.value = '';
        setMsg(`정답! ${r.a}`, 'good');
        const sc = $('#meScore');
        sc.classList.remove('bump'); void sc.offsetWidth; sc.classList.add('bump');
        beep([660, 990], .08);
        vibrate(30);
      } else if (r.r === 'wrong') {
        setMsg('오답!', 'bad');
        inp.select();
        const card = $('#gameCard');
        card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake');
        vibrate([40, 40, 40]);
      } else if (r.r === 'wait') {
        setMsg('잠깐! 0.8초 뒤에 다시 내 주세요', 'bad');
      } else {
        poll();
      }
      draw();
    } catch (err) { toast(errText(err)); }
    busy = false;
    inp.focus({ preventScroll: true });
  }
  async function skipQ() {
    if (!room || busy) return;
    busy = true;
    try {
      const r = await call('dj_room_skip', { p_player: PLAYER, p_code: room });
      if (r.r === 'skip') {
        myIdx = r.idx; myQ = r.q;
        $('#gInput').value = '';
        setMsg(`넘김 · 정답은 "${r.a}"`, '');
        draw();
      }
    } catch (err) { toast(errText(err)); }
    busy = false;
    $('#gInput').focus({ preventScroll: true });
  }

  async function invite() {
    const url = `${location.origin}${location.pathname}?room=${room}`;
    const text = `아재개그 1:1 대결 한 판 할래? 🥊\n${url}`;
    if (navigator.share) {
      try { await navigator.share({ text }); return; } catch {}
    }
    try { await navigator.clipboard.writeText(text); toast('초대 링크를 복사했어요'); }
    catch { prompt('이 링크를 보내 주세요', url); }
  }

  // ---------- 버튼 ----------
  $('#soloBtn').addEventListener('click', solo);
  $('#duelCreate').addEventListener('click', create);
  $('#inviteJoin').addEventListener('click', () => join(pendingCode));
  $('#inviteBtn').addEventListener('click', invite);
  $('#cancelWait').addEventListener('click', leave);
  $('#gForm').addEventListener('submit', submit);
  $('#gSkip').addEventListener('mousedown', e => e.preventDefault());   // 키보드가 내려가지 않게
  $('#gSkip').addEventListener('click', skipQ);
  $('#againBtn').addEventListener('click', again);
  $('#toLobby').addEventListener('click', leave);
  $('#quitGame').addEventListener('click', () => {
    const b = $('#quitGame');
    if (!b.dataset.sure) {
      b.dataset.sure = '1';
      b.textContent = mode === 'duel' ? '정말 나갈까요? (기권)' : '정말 그만할까요?';
      setTimeout(() => { delete b.dataset.sure; b.textContent = '나가기'; }, 3000);
      return;
    }
    delete b.dataset.sure;
    b.textContent = '나가기';
    leave();
  });

  // 탭을 열 때 / 닫을 때
  window.duelTabOpened = () => {
    if (room) return;
    toLobby();
  };
  window.duelTabClosed = () => { if (!room) stopList(); };

  // 초대 링크로 들어왔으면 이 탭부터
  if (pendingCode) showTab('duel');
})();
