// 🥊 1:1 아재개그 퀴즈 — 대기실 → 3·2·1 → 7문제 (먼저 맞히면 1점)
// 진행·채점은 서버(dj_room_*)가 하고, 화면은 0.5초마다 상태를 받아 그림
(() => {
  const $ = s => document.querySelector(s);
  const ERR = {
    bad_name: '닉네임을 확인해 주세요 (1~10자)',
    room_gone: '방이 사라졌어요',
    room_full: '이미 대결이 시작된 방이에요',
    own_room: '내가 만든 방이에요',
    limit: '오늘은 방을 너무 많이 만들었어요',
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
  let st = null;            // 마지막 서버 상태
  let offset = 0;           // 서버 시각 - 내 시각
  let pollT = null, listT = null, drawT = null;
  let busy = false;
  let lastKey = '';         // 문제가 바뀌었는지 확인용
  let lastPhase = '';
  let pendingCode = (new URLSearchParams(location.search).get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);

  const views = ['duelLobby', 'duelWait', 'duelGame', 'duelDone'];
  function view(id) { views.forEach(v => { $('#' + v).hidden = v !== id; }); }

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
  function ding() {
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      [660, 880].forEach((f, i) => {
        const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + i * .14;
        o.frequency.value = f;
        g.gain.setValueAtTime(.0001, t);
        g.gain.exponentialRampToValueAtTime(.25, t + .02);
        g.gain.exponentialRampToValueAtTime(.0001, t + .3);
        o.connect(g).connect(ac.destination);
        o.start(t); o.stop(t + .32);
      });
    } catch {}
    vibrate([80, 60, 80]);
    const base = document.title;
    let n = 0;
    const t = setInterval(() => {
      document.title = n % 2 ? base : '🥊 상대가 들어왔어요!';
      if (++n > 8 || !document.hidden) { clearInterval(t); document.title = base; }
    }, 700);
  }
  function unlockAudio() {
    try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); ac.resume(); } catch {}
  }

  // ---------- 대기실 ----------
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
  function startList() {
    stopList();
    loadList();
    listT = setInterval(loadList, 3000);
  }
  function stopList() { clearInterval(listT); listT = null; }

  function renderInvite() {
    $('#inviteCard').hidden = !pendingCode;
    $('#inviteCode').textContent = pendingCode;
    $('#inviteJoin').hidden = !pendingCode;
    $('#duelCreate').hidden = !!pendingCode;
  }

  async function create() {
    const n = myName();
    if (!n || busy) return;
    unlockAudio();
    busy = true;
    try {
      room = await call('dj_room_create', { p_player: PLAYER, p_name: n });
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
    st = null; lastKey = ''; lastPhase = '';
    poll();
    clearInterval(drawT);
    drawT = setInterval(draw, 100);
  }
  async function poll() {
    clearTimeout(pollT);
    if (!room) return;
    try {
      const s = await call('dj_room_state', { p_player: PLAYER, p_code: room });
      offset = s.now - Date.now();
      const prev = st;
      st = s;
      if (prev && prev.phase === 'waiting' && s.phase !== 'waiting') ding();
      draw();
    } catch (e) {
      if ((e.message || '').includes('not_in_room')) { leaveToLobby(); return; }
    }
    const fast = st && ['countdown', 'question', 'result'].includes(st.phase);
    pollT = setTimeout(poll, document.hidden && !fast ? 3000 : fast ? 500 : 1500);
  }
  function leaveToLobby() {
    clearTimeout(pollT); clearInterval(drawT);
    room = null; st = null;
    view('duelLobby');
    renderInvite();
    startList();
  }
  async function leave() {
    if (room) { try { await call('dj_room_leave', { p_player: PLAYER, p_code: room }); } catch {} }
    leaveToLobby();
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
  const now = () => Date.now() + offset;
  function draw() {
    if (!st) return;
    const s = st;

    if (s.phase === 'waiting') {
      view('duelWait');
      $('#waitCode').textContent = room;
      return;
    }
    if (s.phase === 'closed') { leaveToLobby(); toast('방이 닫혔어요'); return; }
    if (s.phase === 'done') { drawDone(s); return; }

    view('duelGame');
    $('#meName').textContent = s.my_name;
    $('#oppName').textContent = s.opp_name;
    $('#meScore').textContent = s.my_score;
    $('#oppScore').textContent = s.opp_score;

    const q = $('#gQ'), a = $('#gA'), cnt = $('#gCount'), form = $('#gForm'), pass = $('#gPass'), msg = $('#gMsg');

    if (s.phase === 'countdown') {
      const left = Math.max(1, Math.ceil((s.start - now()) / 1000));
      $('#gNo').textContent = '';
      q.textContent = '';
      a.textContent = '';
      cnt.hidden = false;
      if (cnt.textContent !== String(left)) {
        cnt.textContent = left;
        cnt.classList.remove('tick'); void cnt.offsetWidth; cnt.classList.add('tick');
      }
      form.hidden = true; pass.hidden = true; msg.textContent = '곧 시작해요!';
      $('#gTimer').style.width = '100%';
      lastPhase = s.phase;
      return;
    }

    cnt.hidden = true;
    $('#gNo').textContent = `${s.q_idx + 1} / ${s.q_total}`;
    const key = s.q_idx;
    if (key !== lastKey) {
      // 새 문제
      lastKey = key;
      q.textContent = s.q;
      $('#gInput').value = '';
      msg.textContent = '';
      msg.className = 'msg';
    }

    if (s.phase === 'question') {
      a.textContent = '';
      const left = Math.max(0, s.q_start + 30000 - now());
      $('#gTimer').style.width = `${left / 300}%`;
      form.hidden = !!s.my_pass;
      pass.hidden = !!s.my_pass;
      if (s.my_pass) {
        msg.className = 'msg';
        msg.textContent = s.opp_pass ? '' : '상대가 답을 고민하는 중…';
      } else if (s.opp_pass && !msg.classList.contains('bad')) {
        msg.className = 'msg';
        msg.textContent = '상대는 모르겠대요!';
      }
      if (lastPhase !== 'question' && !s.my_pass) setTimeout(() => $('#gInput').focus({ preventScroll: true }), 50);
    } else if (s.phase === 'result') {
      form.hidden = true; pass.hidden = true;
      $('#gTimer').style.width = '0%';
      if (a.textContent !== s.a) {
        a.textContent = s.a;
        a.classList.remove('pop'); void a.offsetWidth; a.classList.add('pop');
      }
      msg.className = 'msg ' + (s.winner === 1 ? 'good' : '');
      msg.textContent = s.winner === 1 ? '정답! +1점'
        : s.winner === 2 ? `${s.opp_name}님이 먼저 맞혔어요`
        : '둘 다 몰랐어요';
    }
    lastPhase = s.phase;
  }

  function drawDone(s) {
    clearInterval(drawT); drawT = null;
    view('duelDone');
    const me = s.my_score, op = s.opp_score;
    let title, cls;
    if (s.done_reason === 'opp_left') { title = '상대가 나갔어요. 승리!'; cls = 'win'; }
    else if (s.done_reason === 'me_left') { title = '대결에서 나왔어요'; cls = ''; }
    else if (me > op) { title = '승리! 🎉'; cls = 'win'; }
    else if (me < op) { title = '아쉽게 졌어요'; cls = 'lose'; }
    else { title = '무승부!'; cls = ''; }
    $('#doneTitle').textContent = title;
    $('#doneTitle').className = 'done-title ' + cls;
    $('#doneScore').textContent = `${s.my_name} ${me} : ${op} ${s.opp_name}`;
    const again = $('#againBtn');
    if (s.next_room && s.next_host === 'opp') {
      again.textContent = '상대가 한 판 더 원해요! 참가하기';
      again.classList.add('blink');
    } else if (s.next_room && s.next_host === 'me') {
      again.textContent = '상대를 기다리는 중…';
      again.classList.remove('blink');
    } else {
      again.textContent = '한 판 더';
      again.classList.remove('blink');
    }
    again.hidden = s.done_reason === 'opp_left' || s.done_reason === 'me_left';
  }

  async function rematch() {
    if (!room || busy) return;
    busy = true;
    try {
      const old = room;
      const code = await call('dj_room_rematch', { p_player: PLAYER, p_code: old });
      room = code;
      enterRoom();
    } catch (e) { toast(errText(e)); }
    busy = false;
  }

  // ---------- 답 내기 ----------
  async function submit(e) {
    e.preventDefault();
    const inp = $('#gInput');
    const text = inp.value.trim();
    if (!text || !room || busy) return;
    busy = true;
    const msg = $('#gMsg');
    try {
      const r = await call('dj_room_answer', { p_player: PLAYER, p_code: room, p_text: text });
      if (r === 'correct') {
        msg.className = 'msg good'; msg.textContent = '정답!';
        vibrate(30);
      } else if (r === 'wrong') {
        msg.className = 'msg bad'; msg.textContent = '오답!';
        inp.value = '';
        const card = $('#gameCard');
        card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake');
        vibrate([40, 40, 40]);
      } else if (r === 'wait') {
        msg.className = 'msg bad'; msg.textContent = '1초 뒤에 다시 내 주세요';
      }
    } catch (err) { toast(errText(err)); }
    busy = false;
    poll();
  }
  async function giveUp() {
    if (!room) return;
    try { await call('dj_room_pass', { p_player: PLAYER, p_code: room }); } catch {}
    poll();
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
  $('#duelCreate').addEventListener('click', create);
  $('#inviteJoin').addEventListener('click', () => join(pendingCode));
  $('#inviteBtn').addEventListener('click', invite);
  $('#cancelWait').addEventListener('click', leave);
  $('#gForm').addEventListener('submit', submit);
  $('#gPass').addEventListener('click', giveUp);
  $('#againBtn').addEventListener('click', rematch);
  $('#toLobby').addEventListener('click', leave);
  $('#quitGame').addEventListener('click', () => {
    if (confirmQuit()) leave();
  });
  function confirmQuit() {
    const b = $('#quitGame');
    if (b.dataset.sure) return true;
    b.dataset.sure = '1';
    b.textContent = '정말 나갈까요? (기권)';
    setTimeout(() => { delete b.dataset.sure; b.textContent = '나가기'; }, 3000);
    return false;
  }

  // 탭을 열 때 / 닫을 때
  window.duelTabOpened = () => {
    if (room) return;
    view('duelLobby');
    renderInvite();
    startList();
  };
  window.duelTabClosed = () => { if (!room) stopList(); };

  // 초대 링크로 들어왔으면 1:1 탭부터
  if (pendingCode) showTab('duel');
})();
