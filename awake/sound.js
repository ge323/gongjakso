// 🌙 지금 깨어 있는 사람 — 잔잔한 소리 (브라우저에서 직접 연주, 음원 파일 없음)
// · 느린 화음(패드) + 가끔 떨어지는 오르골 같은 음 + 날씨 소리(비·바람·천둥)
// · 밤에는 더 느리고 어둡게, 낮에는 조금 밝게 (script.js의 amb·wx 값을 읽어요)

const Sound = (() => {
  const KEY = "awake-sound";
  let ctx = null, master = null, verb = null, padBus = null, padFilter = null;
  let rainGain = null, windGain = null, rainFilter = null;
  let on = false, chordTimer = null, noteTimer = null, weatherTimer = null;
  let step = 0;

  // 화음 진행 (MIDI 번호): Fmaj7 → Em7 → Dm9 → Cmaj7
  const CHORDS = [
    [53, 57, 60, 64],
    [52, 55, 59, 62],
    [50, 53, 57, 60, 64],
    [48, 52, 55, 59],
  ];
  // 오르골 음: 다장조 5음 음계 (높은 쪽)
  const BELL = [72, 74, 76, 79, 81, 84, 86, 88];

  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const light = () => (typeof amb === "number" ? amb : 0);           // 0 밤 ~ 1 낮
  const weather = () => (typeof wx === "object" && wx) || { kind: "clear", power: 0 };

  function makeNoise(seconds) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    return buf;
  }

  // 잔향(리버브): 점점 작아지는 잡음으로 공간감 만들기
  function makeReverb(seconds) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    const conv = ctx.createConvolver();
    conv.buffer = buf;
    return conv;
  }

  function build() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    verb = makeReverb(4.5);
    const verbGain = ctx.createGain();
    verbGain.gain.value = 0.55;
    verb.connect(verbGain).connect(master);

    // 화음은 부드럽게 깎아서 (로우패스) 천천히 숨 쉬듯 움직이게
    padFilter = ctx.createBiquadFilter();
    padFilter.type = "lowpass";
    padFilter.Q.value = 0.6;
    padBus = ctx.createGain();
    padBus.gain.value = 0.9;
    padBus.connect(padFilter);
    padFilter.connect(master);
    padFilter.connect(verb);
    const lfo = ctx.createOscillator();
    const lfoAmt = ctx.createGain();
    lfo.frequency.value = 0.05;
    lfoAmt.gain.value = 180;
    lfo.connect(lfoAmt).connect(padFilter.frequency);
    lfo.start();

    // 빗소리: 잡음을 고음 쪽만 남겨서
    const noise = makeNoise(4);
    const rain = ctx.createBufferSource();
    rain.buffer = noise;
    rain.loop = true;
    rainFilter = ctx.createBiquadFilter();
    rainFilter.type = "bandpass";
    rainFilter.frequency.value = 2600;
    rainFilter.Q.value = 0.4;
    rainGain = ctx.createGain();
    rainGain.gain.value = 0;
    rain.connect(rainFilter).connect(rainGain).connect(master);
    rain.start();

    // 바람(눈·안개·흐림): 잡음을 저음 쪽만 남기고 천천히 출렁이게
    const wind = ctx.createBufferSource();
    wind.buffer = noise;
    wind.loop = true;
    wind.playbackRate.value = 0.5;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = "lowpass";
    windFilter.frequency.value = 420;
    windGain = ctx.createGain();
    windGain.gain.value = 0;
    const wLfo = ctx.createOscillator();
    const wAmt = ctx.createGain();
    wLfo.frequency.value = 0.08;
    wAmt.gain.value = 160;
    wLfo.connect(wAmt).connect(windFilter.frequency);
    wLfo.start();
    wind.connect(windFilter).connect(windGain).connect(master);
    wind.start();
  }

  // ---------- 화음 ----------
  function playChord() {
    const t = ctx.currentTime;
    const dark = 1 - light();
    const len = 10 + dark * 5;                      // 밤일수록 느리게 (10~15초)
    padFilter.frequency.setTargetAtTime(650 + light() * 1000, t, 2);

    const chord = CHORDS[step % CHORDS.length];
    step++;
    const notes = [chord[0] - 12, ...chord];        // 맨 아래 베이스 한 음 추가
    notes.forEach((m, i) => {
      const g = ctx.createGain();
      const peak = i === 0 ? 0.055 : 0.032;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(peak, t + 3.5);
      g.gain.setValueAtTime(peak, t + len - 1);
      g.gain.linearRampToValueAtTime(0, t + len + 4);
      g.connect(padBus);
      // 살짝 어긋난 두 소리를 겹쳐서 따뜻하게 (크기를 다르게 해서 "웅웅" 울렁임은 약하게)
      // 베이스는 울렁임이 크게 들려서 한 소리만
      const layers = i === 0 ? [[0, 1]] : [[-3, 1], [3, 0.5]];
      layers.forEach(([cents, amp]) => {
        const o = ctx.createOscillator();
        const a = ctx.createGain();
        a.gain.value = amp;
        o.type = i === 0 ? "sine" : "triangle";
        o.frequency.value = hz(m);
        o.detune.value = cents;
        o.connect(a).connect(g);
        o.start(t);
        o.stop(t + len + 4.5);
      });
    });
    chordTimer = setTimeout(playChord, len * 1000);
  }

  // ---------- 오르골 음 ----------
  function playBell() {
    const t = ctx.currentTime;
    const chord = CHORDS[(step + CHORDS.length - 1) % CHORDS.length];
    // 지금 화음과 잘 어울리는 음 위주로
    const fits = BELL.filter((m) => chord.some((c) => (m - c) % 12 === 0));
    const pool = Math.random() < 0.75 && fits.length ? fits : BELL;
    const m = pool[Math.floor(Math.random() * pool.length)];

    const o = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o2.type = "sine";
    o.frequency.value = hz(m);
    o2.frequency.value = hz(m) * 2.01;              // 맑은 배음
    const g2 = ctx.createGain();
    g2.gain.value = 0.18;
    const vol = 0.028 + Math.random() * 0.018;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0008, t + 3.2);
    o.connect(g);
    o2.connect(g2).connect(g);
    g.connect(master);
    g.connect(verb);
    o.start(t); o2.start(t);
    o.stop(t + 3.3); o2.stop(t + 3.3);

    // 밤엔 띄엄띄엄, 낮엔 조금 더 자주. 가끔 두 음을 이어서
    const gap = 1.8 + Math.random() * 3.5 + (1 - light()) * 2.5;
    noteTimer = setTimeout(playBell, (Math.random() < 0.18 ? 0.35 : gap) * 1000);
  }

  // ---------- 날씨 소리 ----------
  function updateWeather() {
    if (!ctx) return;
    const w = weather(), t = ctx.currentTime;
    const wet = w.kind === "rain" || w.kind === "drizzle" || w.kind === "thunder";
    const rainVol = wet ? 0.025 + (w.power || 0.5) * 0.045 : 0;
    const windVol = w.kind === "snow" ? 0.05 : (w.kind === "fog" || w.kind === "overcast") ? 0.025 : 0;
    rainGain.gain.setTargetAtTime(rainVol, t, 1.5);
    windGain.gain.setTargetAtTime(windVol, t, 2);
    rainFilter.frequency.setTargetAtTime(w.kind === "drizzle" ? 3400 : 2400, t, 1);
  }

  // 천둥: 번개 칠 때 script.js가 불러요 (번쩍 → 조금 뒤 우르릉)
  function thunder() {
    if (!on || !ctx) return;
    const t = ctx.currentTime + 0.6 + Math.random() * 0.8;
    const src = ctx.createBufferSource();
    src.buffer = makeNoise(4);
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 140;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.32, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.001, t + 3.6);
    src.connect(f).connect(g).connect(master);
    src.start(t);
    src.stop(t + 3.8);
  }

  // 🎆 불꽃 터지는 소리: 멀리서 들리는 '퐁' (소리를 켰을 때만)
  function pop() {
    if (!on || !ctx) return;
    const t = ctx.currentTime + 0.25 + Math.random() * 0.35;   // 빛보다 소리가 살짝 늦게
    const src = ctx.createBufferSource();
    src.buffer = makeNoise(1.2);
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 380 + Math.random() * 200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
    src.connect(f).connect(g).connect(master);
    src.start(t);
    src.stop(t + 1.2);
  }

  // ---------- 켜기 / 끄기 ----------
  async function start() {
    if (on) return;
    if (!ctx) build();
    if (ctx.state === "suspended") await ctx.resume();
    on = true;
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(0.8, t + 3);   // 천천히 커지게
    playChord();
    noteTimer = setTimeout(playBell, 2500);
    updateWeather();
    weatherTimer = setInterval(updateWeather, 5000);
    save(true);
  }

  function stop(remember = true) {
    if (!on) return;
    on = false;
    clearTimeout(chordTimer);
    clearTimeout(noteTimer);
    clearInterval(weatherTimer);
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(0, t + 1.2);   // 천천히 작아지게
    if (remember) save(false);
  }

  function save(v) {
    try { localStorage.setItem(KEY, v ? "on" : "off"); } catch (e) {}
  }

  function wanted() {
    try { return localStorage.getItem(KEY) === "on"; } catch (e) { return false; }
  }

  // 테스트용: 소리를 녹음할 수 있게 출력 연결
  function tap() {
    if (!ctx) build();
    const dest = ctx.createMediaStreamDestination();
    master.connect(dest);
    return dest.stream;
  }

  return { start, stop, thunder, pop, wanted, tap, isOn: () => on };
})();

// script.js에서 window.Sound로 찾을 수 있게
window.Sound = Sound;
