/* 💐 bouquet/flowers.js — 꽃 데이터 + 수채화풍 SVG 그리기 */
window.Flowers = (() => {
  'use strict';

  const MOODS = [
    { id: 'all', name: '전체' },
    { id: 'love', name: '사랑' },
    { id: 'thanks', name: '감사' },
    { id: 'cheer', name: '응원' },
    { id: 'comfort', name: '위로' },
    { id: 'congrats', name: '축하' },
    { id: 'miss', name: '그리움' },
  ];

  // [밝은 곳, 중간, 진한 곳] — 파스텔 수채 톤
  const PAL = {
    red: ['#fbc4c6', '#e7798a', '#bf4a63'],
    pink: ['#fff0f0', '#f8c3c9', '#e397a6'],
    lis: ['#fdfaff', '#ebdff3', '#ad8ac6'],
    tulip: ['#fdd0c6', '#f29a8c', '#d8706a'],
    carn: ['#fde0e2', '#f5a5b2', '#dc7189'],
    sun: ['#fff4bd', '#fad66a', '#e9ae34'],
    sunC: ['#b8916a', '#80603f', '#5b4029'],
    free: ['#fffbe6', '#fbe9a0', '#f0cd63'],
    ger: ['#ffe6d6', '#ffb68f', '#f28c62'],
    wht: ['#ffffff', '#f8f6f0', '#dcdfd2'],
    blue: ['#eaf3ff', '#b7d4f4', '#86ade0'],
    ranu: ['#fff8f1', '#ffdcc6', '#f2ad8f'],
    leaf: ['#c7dcb2', '#93b780', '#6a9461'],
    euca: ['#e1eae3', '#bccec3', '#91aa9d'],
    yel: ['#fff6cc', '#f9de7a', '#e8b93c'],
    sage: ['#e4ecdb', '#bacdaf', '#8fa88a'],
  };

  const WRAPS = {
    cream: ['#fffcf6', '#f1e8d8'],
    kraft: ['#f6e9d4', '#e2cba8'],
    blush: ['#fff2f1', '#f5d3d5'],
    sage: ['#f3f7ef', '#d3dfcb'],
    lavender: ['#f8f5fc', '#ddd3ec'],
  };
  const WRAP_NAMES = { cream: '크림', kraft: '크라프트', blush: '연분홍', sage: '세이지', lavender: '라벤더' };

  const RIBBONS = {
    pink: '#f4b3c0',
    red: '#e3707f',
    white: '#fbf8f2',
    gold: '#e6c47e',
    navy: '#7486ae',
    lilac: '#c8b5e3',
  };
  const RIBBON_NAMES = { pink: '분홍', red: '빨강', white: '흰색', gold: '금색', navy: '남색', lilac: '라일락' };

  const LINE = '#9c8c80'; // 포장지·리본의 연한 선

  /* ---------- 도구 ---------- */
  const f1 = n => +n.toFixed(1);
  const deg = r => r * 180 / Math.PI;

  function mix(hex, to, t) {
    const a = parseInt(hex.slice(1), 16), b = parseInt(to.slice(1), 16);
    return '#' + [16, 8, 0]
      .map(s => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t).toString(16).padStart(2, '0'))
      .join('');
  }

  // 같은 꽃다발은 언제 열어도 같은 모양이 되도록 고정 난수(seeded random) 사용
  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash(str) {
    let h = 2166136261;
    for (const ch of str) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  /* ---------- 공용 그라데이션·필터 ---------- */
  function defs() {
    let s = '';
    for (const [k, [a, b, c]] of Object.entries(PAL)) {
      s += `<radialGradient id="g-${k}" cx=".5" cy=".45" r=".62"><stop offset="0" stop-color="${a}"/><stop offset=".55" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></radialGradient>`;
      // 아래(꽃잎 밑동) 진하게 → 위(가장자리) 밝게
      s += `<linearGradient id="l-${k}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${c}"/><stop offset=".5" stop-color="${b}"/><stop offset="1" stop-color="${a}"/></linearGradient>`;
    }
    for (const [k, [a, b]] of Object.entries(WRAPS)) {
      s += `<linearGradient id="wp-${k}" x1="0" y1="0" x2=".3" y2="1"><stop offset="0" stop-color="${a}"/><stop offset=".6" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
    }
    for (const [k, c] of Object.entries(RIBBONS)) {
      const d = mix(c, '#000000', .12), l = mix(c, '#ffffff', .4);
      s += `<linearGradient id="rb-${k}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${d}"/><stop offset=".45" stop-color="${c}"/><stop offset=".55" stop-color="${l}"/><stop offset="1" stop-color="${c}"/></linearGradient>`;
    }
    // 수채 물감: 가장자리가 살짝 번지고, 부드럽게 흐려지고, 종이 위 물감 알갱이가 보임
    s += `<filter id="wc" x="-20%" y="-20%" width="140%" height="140%">` +
      `<feTurbulence type="fractalNoise" baseFrequency=".03" numOctaves="3" seed="7" result="n"/>` +
      `<feDisplacementMap in="SourceGraphic" in2="n" scale="3" xChannelSelector="R" yChannelSelector="G" result="d"/>` +
      `<feGaussianBlur in="d" stdDeviation=".45" result="b"/>` +
      `<feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="3" result="g"/>` +
      `<feColorMatrix in="g" type="matrix" values="0 0 0 0 .6  0 0 0 0 .45  0 0 0 0 .4  .3 0 0 0 -.13" result="gr"/>` +
      `<feComposite in="gr" in2="b" operator="in" result="gm"/>` +
      `<feMerge><feMergeNode in="b"/><feMergeNode in="gm"/></feMerge></filter>`;
    return `<svg class="defs" width="0" height="0" aria-hidden="true"><defs>${s}</defs></svg>`;
  }

  /* ---------- 붓질 도구 ---------- */
  // 반투명 물감 면 + 같은 색 계열의 진한 테두리 (겹치면 자연스럽게 진해짐)
  const P = (d, fill, edge, op = .93) =>
    `<path d="${d}" fill="${fill}" fill-opacity="${op}" stroke="${edge}" stroke-width="1" stroke-opacity=".45" stroke-linejoin="round"/>`;
  const hl = d => `<path d="${d}" fill="none" stroke="#fff" stroke-width="1.5" stroke-opacity=".55" stroke-linecap="round"/>`;

  const petal = (L, W) => `M0 0C${f1(W)} ${f1(-L * .25)} ${f1(W * .9)} ${f1(-L * .95)} 0 ${f1(-L)}C${f1(-W * .9)} ${f1(-L * .95)} ${f1(-W)} ${f1(-L * .25)} 0 0Z`;
  const round = (L, W) => `M0 0C${f1(W * 1.25)} ${f1(-L * .15)} ${f1(W * 1.1)} ${f1(-L * 1.08)} 0 ${f1(-L)}C${f1(-W * 1.1)} ${f1(-L * 1.08)} ${f1(-W * 1.25)} ${f1(-L * .15)} 0 0Z`;

  function ring(n, d, fill, o = {}) {
    const { r0 = 0, rot = 0, stroke = 'none', op = .93 } = o;
    let s = '';
    for (let i = 0; i < n; i++) {
      const tr = `rotate(${f1(rot + i * 360 / n)})` + (r0 ? ` translate(0 ${-r0})` : '');
      s += `<path d="${d}" transform="${tr}" fill="${fill}" fill-opacity="${op}" stroke="${stroke}" stroke-width=".9" stroke-opacity=".4"/>`;
    }
    return s;
  }

  // 위로 물결치는 가장자리 (카네이션·리시안셔스 꽃잎 끝)
  function crinkle(x1, y1, cx, cy, x2, y2, n, amp, rnd) {
    const q = (t, a, b, c) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * b + t * t * c;
    let d = '';
    for (let i = 1; i <= n; i++) {
      const t = i / n, m = (i - .5) / n;
      d += `Q${f1(q(m, x1, cx, x2))} ${f1(q(m, y1, cy, y2) - amp * (.6 + rnd() * .8))} ${f1(q(t, x1, cx, x2))} ${f1(q(t, y1, cy, y2))}`;
    }
    return d;
  }

  const wc = inner => `<g filter="url(#wc)">${inner}</g>`;
  const calyx = (y = 26) => `<path d="M-9 ${y}C-15 ${y + 7}-21 ${y + 7}-25 ${y + 5}C-17 ${y + 2}-13 ${y}-8 ${y - 2}ZM9 ${y}C15 ${y + 7} 21 ${y + 7} 25 ${y + 5}C17 ${y + 2} 13 ${y} 8 ${y - 2}Z" fill="url(#l-leaf)" fill-opacity=".9" stroke="${PAL.leaf[2]}" stroke-width=".8" stroke-opacity=".4"/>`;

  /* ---------- 꽃 (옆·비스듬히 본 모습, 가운데 0,0) ---------- */
  // 장미: 컵 모양으로 감싼 꽃잎
  const rose = k => () => {
    const c = PAL[k][2], g = `url(#l-${k})`;
    return wc(
      P('M-30-6C-36-30-12-42 0-36C12-42 36-30 30-6C20 0-20 0-30-6Z', `url(#g-${k})`, c) +
      P('M-17-15C-19-31-4-36 2-33C10-36 20-28 17-15C12-4-12-4-17-15Z', PAL[k][1], c, .95) +
      `<path d="M-9-22C-3-29 7-27 9-19M-6-15C-2-21 5-21 7-15" fill="none" stroke="${c}" stroke-width="1.1" stroke-opacity=".5" stroke-linecap="round"/>` +
      P('M-33-10C-42 12-24 32-2 33C-14 20-18 2-8-14C-18-17-28-15-33-10Z', g, c) +
      P('M33-10C42 12 24 32 2 33C14 20 18 2 8-14C18-17 28-15 33-10Z', g, c) +
      P('M-24-2C-14-11 14-11 24-2C26 21 9 33 0 33C-9 33-26 21-24-2Z', g, c) +
      hl('M-16-4C-8-9 8-9 16-4') + hl('M-27-12C-31-2-29 8-22 16') +
      calyx(30)
    );
  };

  const lisianthus = rnd => {
    const c = PAL.lis[2], g = 'url(#g-lis)';
    return wc(
      P(`M-32-6${crinkle(-32, -6, 0, -42, 32, -6, 9, 3, rnd)}C24 6-24 6-32-6Z`, g, c) +
      `<ellipse cy="-12" rx="13" ry="5" fill="#e3e9b8" fill-opacity=".8"/>` +
      P('M-32-6C-36 14-16 30 0 30C-6 16-8 0-2-8C-14-4-24-4-32-6Z', g, c) +
      P('M32-6C36 14 16 30 0 30C6 16 8 0 2-8C14-4 24-4 32-6Z', g, c) +
      P('M-17 0C-17 20-6 30 0 30C6 30 17 20 17 0C9 6-9 6-17 0Z', g, c) +
      hl('M-10 6C-5 10 5 10 10 6') + calyx(28)
    );
  };

  const tulipOne = () => {
    const g = 'url(#l-tulip)', c = PAL.tulip[2];
    return P('M0 22C-22 20-24-14 0-38C24-14 22 20 0 22Z', 'url(#g-tulip)', c) +
      P('M3 23C-22 22-28-8-18-33C-6-24 4-6 3 23Z', g, c) +
      P('M-3 23C22 22 28-8 18-33C6-24-4-6-3 23Z', g, c) +
      hl('M-13-18C-11-5-7 6-3 15');
  };
  // 튤립은 세 송이를 한 묶음으로
  const tulip = rnd => wc(
    `<path d="M-26 2Q-12 24 0 34M26 4Q12 24 0 34" fill="none" stroke="${PAL.leaf[1]}" stroke-width="2"/>` +
    `<g transform="translate(-26 -16) rotate(${f1(-20 + rnd() * 6)}) scale(.78)">${tulipOne()}</g>` +
    `<g transform="translate(26 -14) rotate(${f1(16 + rnd() * 6)}) scale(.78)">${tulipOne()}</g>` +
    `<g transform="translate(0 6)">${tulipOne()}</g>`
  );

  // 카네이션: 옆에서 본 주름 꽃잎 3겹 + 초록 꽃받침
  const carnation = rnd => {
    const c = PAL.carn[2], g = 'url(#g-carn)';
    return wc(
      P(`M-30 2${crinkle(-30, 2, 0, -46, 30, 2, 10, 4.5, rnd)}C20 16-20 16-30 2Z`, g, c) +
      P(`M-27 9${crinkle(-27, 9, 0, -30, 27, 9, 9, 4, rnd)}C18 21-18 21-27 9Z`, g, c) +
      P(`M-22 15${crinkle(-22, 15, 0, -8, 22, 15, 8, 3.5, rnd)}C14 25-14 25-22 15Z`, g, c) +
      P('M-8 20C-8 32-4 38 0 40C4 38 8 32 8 20Z', 'url(#l-leaf)', PAL.leaf[2], .9)
    );
  };

  // 라넌큘러스: 공 모양 + 겹겹이 쌓인 얇은 꽃잎
  const ranunculus = () => {
    const c = PAL.ranu[2];
    let s = P('M-28 2C-30-28 30-28 28 2C28 26-28 26-28 2Z', 'url(#g-ranu)', c);
    for (let i = 0; i < 6; i++) {
      const y = -16 + i * 7, w = 10 + i * 3.6;
      s += P(`M${f1(-w)} ${y}Q0 ${y + 13} ${f1(w)} ${y}Q0 ${y + 6} ${f1(-w)} ${y}Z`, 'url(#l-ranu)', c, .9);
    }
    return wc(s + `<ellipse cy="-19" rx="5" ry="2.5" fill="#d3e0a3" fill-opacity=".85"/>` + calyx(24));
  };

  const sunflower = rnd => {
    let dots = '';
    for (let i = 0; i < 34; i++) {
      const a = i * 2.39996, r = Math.sqrt(i / 34) * 12;
      dots += `<circle cx="${f1(Math.cos(a) * r)}" cy="${f1(Math.sin(a) * r)}" r="1.1" fill="#4a3220" fill-opacity=".35"/>`;
    }
    return wc(`<g transform="scale(1 .88)">` +
      ring(16, petal(24, 7.5), 'url(#l-sun)', { r0: 13, rot: rnd() * 22, stroke: PAL.sun[2] }) +
      ring(16, petal(20, 6.5), 'url(#l-sun)', { r0: 12, rot: 11 + rnd() * 6, stroke: PAL.sun[2] }) +
      `<circle r="16" fill="url(#g-sunC)" fill-opacity=".92"/>` + dots + `</g>`);
  };

  const gerbera = rnd => wc(`<g transform="scale(1 .88)">` +
    ring(22, petal(25, 5), 'url(#l-ger)', { r0: 9, rot: rnd() * 16, stroke: PAL.ger[2] }) +
    ring(18, petal(15, 4), 'url(#l-ger)', { r0: 8, rot: 9, stroke: PAL.ger[2] }) +
    `<circle r="10" fill="#f6d27a"/><circle r="6.5" fill="#8a6440" fill-opacity=".9"/></g>`);

  const daisy = rnd => wc(`<g transform="scale(1 .9)">` +
    ring(20, petal(25, 5.4), 'url(#l-wht)', { r0: 6, rot: rnd() * 18, stroke: '#b9bfae', op: .95 }) +
    `<circle r="8" fill="url(#g-yel)"/></g>`);

  const freesiaSpray = rnd => {
    let s = `<path d="M-26 16C-14-6 6-18 32-17" fill="none" stroke="${PAL.leaf[1]}" stroke-width="2" stroke-linecap="round"/>`;
    [[-20, 4, 1], [-8, -7, 1], [5, -13, .9], [17, -16, .7], [28, -17, .5]].forEach(([x, y, k]) => {
      if (k >= .7) {
        s += `<g transform="translate(${x} ${y - 7}) rotate(${f1(-20 + rnd() * 20)}) scale(${k})">` +
          ring(6, round(10, 6), 'url(#g-free)', { rot: rnd() * 60, stroke: PAL.free[2] }) +
          `<circle r="2.4" fill="#efc451"/></g>`;
      } else {
        s += `<ellipse cx="${x}" cy="${y - 3}" rx="${f1(6 * k)}" ry="3" transform="rotate(-12 ${x} ${y - 3})" fill="url(#l-free)" stroke="${PAL.free[2]}" stroke-width=".6" stroke-opacity=".5"/>`;
      }
    });
    return s;
  };
  const freesia = rnd => wc(freesiaSpray(rnd) + `<g transform="translate(4 -16) scale(-.85 .85)">${freesiaSpray(rnd)}</g>`);

  const BELL = 'M-6-4C-6-11 6-11 6-4C6 0 8 3 6 4C4 2 2 5 0 3C-2 5-4 2-6 4C-8 3-6 0-6-4Z';
  const lilyArch = () => {
    const g = PAL.leaf[1];
    let s = `<path d="M-26 26C-20-18 8-34 32-22" fill="none" stroke="${g}" stroke-width="1.6" stroke-linecap="round"/>`;
    [[-19, -6, 1.05], [-9, -19, 1], [3, -26, .95], [15, -27, .85], [25, -24, .7]].forEach(([x, y, k]) => {
      s += `<path d="M${x} ${y}q1 4 0 7" fill="none" stroke="${g}" stroke-width="1"/>` +
        `<path d="${BELL}" transform="translate(${x} ${y + 13}) scale(${k})" fill="url(#g-wht)" stroke="#aab49d" stroke-width=".8" stroke-opacity=".7"/>`;
    });
    return s;
  };
  const lilyValley = () => wc(
    P('M-6 30C-32 4-28-26-10-40C-4-18-2 4-6 30Z', 'url(#l-leaf)', PAL.leaf[2], .85) +
    P('M2 30C26 6 24-20 10-32C6-14 4 6 2 30Z', 'url(#l-leaf)', PAL.leaf[2], .8) +
    lilyArch() + `<g transform="translate(6 -10) scale(-.85 .85)">${lilyArch()}</g>`);

  const forgetMeNot = rnd => {
    let s = '';
    for (let i = 0; i < 17; i++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 29;
      const x = f1(Math.cos(a) * r), y = f1(Math.sin(a) * r * .85), k = f1(.75 + rnd() * .35);
      let p = '';
      for (let j = 0; j < 5; j++) {
        const b = j * 72 * Math.PI / 180;
        p += `<circle cx="${f1(Math.sin(b) * 4.4)}" cy="${f1(-Math.cos(b) * 4.4)}" r="4.4" fill="url(#g-blue)" fill-opacity=".9" stroke="${PAL.blue[2]}" stroke-width=".6" stroke-opacity=".45"/>`;
      }
      s += `<g transform="translate(${x} ${y}) scale(${k})">${p}<circle r="1.9" fill="#fbe38a"/></g>`;
    }
    return wc(s);
  };

  const gyp = rnd => {
    let b = '', s = '';
    for (let i = 0; i < 9; i++) {
      const ex = f1((rnd() - .5) * 80), ey = f1(-10 - rnd() * 40);
      b += `<path d="M0 44Q${f1(ex * .3)} ${f1(ey * .2 + 20)} ${ex} ${ey}" fill="none" stroke="#9fb48f" stroke-width=".8"/>`;
      for (let j = 0; j < 5; j++) {
        s += `<circle cx="${f1(ex + (rnd() - .5) * 12)}" cy="${f1(ey + (rnd() - .5) * 10)}" r="${f1(1.7 + rnd() * 1.2)}" fill="#fffefa" stroke="#d3d8c8" stroke-width=".6"/>`;
      }
    }
    return wc(b + s);
  };

  const eucalyptus = () => {
    let s = `<path d="M0 46C-5 16 5-14-2-52" fill="none" stroke="#91a69a" stroke-width="1.5"/>`;
    for (let i = 0; i < 6; i++) {
      const y = 34 - i * 15, k = 1 - i * .1, x = f1(Math.sin(i) * 2);
      for (const sx of [-1, 1]) {
        s += `<ellipse cx="${f1(x + sx * 9 * k)}" cy="${y}" rx="${f1(8.5 * k)}" ry="${f1(7 * k)}" fill="url(#g-euca)" fill-opacity=".9" stroke="${PAL.euca[2]}" stroke-width=".7" stroke-opacity=".5"/>`;
      }
    }
    return wc(s);
  };

  /* ---------- 꽃 목록 ---------- */
  // stemAt: 줄기가 붙는 위치 (꽃 그림 기준)
  const FLOWERS = [
    { id: 'red_rose', name: '빨간 장미', meaning: '열렬한 사랑', moods: ['love'], draw: rose('red'), stemAt: [0, 33] },
    { id: 'lisianthus', name: '리시안셔스', meaning: '변치 않는 사랑', moods: ['love'], draw: lisianthus, stemAt: [0, 30] },
    { id: 'red_tulip', name: '빨간 튤립', meaning: '사랑의 고백', moods: ['love'], draw: tulip, stemAt: [0, 34] },
    { id: 'pink_rose', name: '분홍 장미', meaning: '감사, 행복한 사랑', moods: ['thanks', 'love'], draw: rose('pink'), stemAt: [0, 33] },
    { id: 'carnation', name: '카네이션', meaning: '존경과 감사', moods: ['thanks'], draw: carnation, stemAt: [0, 40] },
    { id: 'sunflower', name: '해바라기', meaning: '당신만을 바라봐요', moods: ['cheer'], draw: sunflower },
    { id: 'freesia', name: '프리지아', meaning: '새로운 시작', moods: ['cheer', 'congrats'], draw: freesia, stemAt: [-26, 16] },
    { id: 'gerbera', name: '거베라', meaning: '희망', moods: ['cheer'], draw: gerbera },
    { id: 'lily_valley', name: '은방울꽃', meaning: '다시 찾아올 행복', moods: ['comfort'], draw: lilyValley, stemAt: [-6, 30] },
    { id: 'daisy', name: '데이지', meaning: '평화, 희망', moods: ['comfort'], draw: daisy },
    { id: 'forget_me_not', name: '물망초', meaning: '나를 잊지 마세요', moods: ['miss'], draw: forgetMeNot },
    { id: 'ranunculus', name: '라넌큘러스', meaning: '빛나는 매력', moods: ['congrats'], draw: ranunculus, stemAt: [0, 30] },
    { id: 'gyp', name: '안개꽃', meaning: '맑은 마음', filler: true, draw: gyp, stemAt: [0, 44] },
    { id: 'eucalyptus', name: '유칼립투스', meaning: '추억', filler: true, draw: eucalyptus, stemAt: [0, 46] },
  ];
  const byId = Object.fromEntries(FLOWERS.map(f => [f.id, f]));

  /* ---------- 꽃다발 배치 (viewBox 0 0 400 580) ---------- */
  const B = { x: 200, y: 368 }; // 리본 묶는 자리
  const DOME = { x: 200, y: 210 };
  const LAYOUTS = {
    1: [[200, 222, 1.7]],
    2: [[172, 228, 1.5], [236, 200, 1.42]],
    3: [[200, 200, 1.45], [146, 244, 1.32], [256, 242, 1.32]],
    4: [[202, 236, 1.42], [146, 198, 1.3], [258, 194, 1.3], [204, 146, 1.22]],
    5: [[200, 240, 1.4], [140, 216, 1.26], [262, 212, 1.26], [168, 150, 1.2], [236, 146, 1.2]],
    6: [[200, 236, 1.38], [136, 238, 1.22], [266, 234, 1.22], [150, 166, 1.18], [252, 162, 1.18], [200, 124, 1.1]],
    7: [[200, 232, 1.34], [134, 256, 1.16], [266, 254, 1.16], [124, 188, 1.14], [276, 184, 1.14], [166, 132, 1.1], [236, 128, 1.1]],
  };
  // 곁들임 하나를 고르면 두 군데에 꽂힘
  const FILL_SLOTS = [[106, 160], [296, 154], [200, 92], [150, 104], [254, 100], [80, 236], [322, 230], [200, 300]];

  function backWrap(k) {
    const back = 'M182 372L30 198Q44 144 110 122Q200 92 290 122Q356 144 370 198L218 372Z';
    const inner = 'M184 372L64 204Q90 158 140 144Q200 126 260 144Q310 158 336 204L216 372Z';
    return wc(`<path d="${back}" fill="url(#wp-${k})" stroke="${LINE}" stroke-opacity=".5" stroke-width=".9"/>` +
      `<path d="${inner}" fill="#8a6d55" fill-opacity=".06"/>` +
      `<path d="M58 176Q120 132 200 122" fill="none" stroke="#fff" stroke-width="3" stroke-opacity=".7" stroke-linecap="round"/>`);
  }

  function frontWrap(k) {
    const tissue = 'M48 280Q120 316 200 306Q280 316 352 276L236 372L164 372Z';
    const L = 'M160 566L177 372L42 294Q130 330 236 326L224 372L206 566Z';
    const R = 'M240 566L223 372L358 290Q262 336 164 330L176 372L196 566Z';
    const ln = `stroke="${LINE}" stroke-opacity=".55" stroke-width=".9" stroke-linejoin="round"`;
    return wc(`<path d="${tissue}" fill="#fff" fill-opacity=".5" stroke="${LINE}" stroke-opacity=".3" stroke-width=".8"/>`) +
      wc(`<path d="${L}" fill="url(#wp-${k})" ${ln}/>` +
        `<path d="${R}" fill="url(#wp-${k})" ${ln}/>` +
        `<path d="${R}" fill="#8a6d55" fill-opacity=".06"/>` +
        `<path d="M62 300Q140 326 228 324M340 298Q262 332 180 332" fill="none" stroke="#fff" stroke-width="3" stroke-opacity=".7" stroke-linecap="round"/>` +
        `<path d="M201 384L203 560M98 312L180 368M300 310L222 368" fill="none" stroke="${LINE}" stroke-opacity=".28" stroke-width=".8"/>`);
  }

  // 가느다란 잎 줄기 (루스커스 같은 느낌)
  function sprig(adeg, len, type, rnd) {
    const a = adeg * Math.PI / 180;
    const tx = B.x + Math.cos(a) * len, ty = B.y + Math.sin(a) * len;
    const bend = (rnd() - .5) * 40, nx = -Math.sin(a), ny = Math.cos(a);
    const cx = (B.x + tx) / 2 + nx * bend, cy = (B.y + ty) / 2 + ny * bend;
    const leafD = type === 'sage' ? 'M0 0C6-3 18-3.5 27 0C18 3.5 6 3 0 0Z' : 'M0 0C5-6 15-7 24 0C15 7 5 6 0 0Z';
    const pal = type === 'sage' ? 'sage' : 'leaf';
    let s = `<path d="M${B.x} ${B.y}Q${f1(cx)} ${f1(cy)} ${f1(tx)} ${f1(ty)}" fill="none" stroke="${PAL.leaf[1]}" stroke-width="1.5"/>`;
    let side = 1;
    for (let t = .45; t <= 1.001; t += .08, side = -side) {
      const u = 1 - t;
      const x = u * u * B.x + 2 * u * t * cx + t * t * tx, y = u * u * B.y + 2 * u * t * cy + t * t * ty;
      const dx = 2 * u * (cx - B.x) + 2 * t * (tx - cx), dy = 2 * u * (cy - B.y) + 2 * t * (ty - cy);
      const ang = t > .97 ? deg(Math.atan2(dy, dx)) : deg(Math.atan2(dy, dx)) + side * 42;
      s += `<path d="${leafD}" transform="translate(${f1(x)} ${f1(y)}) rotate(${f1(ang)}) scale(${f1(1.1 - t * .35)})" fill="url(#l-${pal})" fill-opacity=".88" stroke="${PAL[pal][2]}" stroke-width=".7" stroke-opacity=".4"/>`;
    }
    return s;
  }

  // 넓적한 잎 (튤립 잎 같은 느낌)
  function blade(adeg, len, rnd) {
    const w = 11 + rnd() * 4, L = len;
    return `<path d="M0 0C${f1(w)} ${f1(-L * .3)} ${f1(w * .8)} ${f1(-L * .75)} ${f1(w * .2)} ${f1(-L)}C${f1(-w * .6)} ${f1(-L * .7)} ${f1(-w)} ${f1(-L * .3)} 0 0Z" transform="translate(${B.x} ${B.y - 10}) rotate(${f1(adeg + 90)})" fill="url(#l-leaf)" fill-opacity=".85" stroke="${PAL.leaf[2]}" stroke-width=".9" stroke-opacity=".4"/>` +
      `<path d="M0 0Q${f1(w * .1)} ${f1(-L * .5)} ${f1(w * .2)} ${f1(-L * .95)}" transform="translate(${B.x} ${B.y - 10}) rotate(${f1(adeg + 90)})" fill="none" stroke="#fff" stroke-width="1.2" stroke-opacity=".45"/>`;
  }

  function compose(st) {
    const rnd = rng(hash(st.flowers.join(',') + st.wrap));
    const mains = st.flowers.filter(id => byId[id] && !byId[id].filler).slice(0, 7);
    const fills = st.flowers.filter(id => byId[id] && byId[id].filler).slice(0, 4);
    const lay = LAYOUTS[mains.length] || [];
    const M = mains.map((id, i) => ({ id, x: lay[i][0], y: lay[i][1], s: lay[i][2], rot: (rnd() - .5) * 20 }));
    const Fi = fills.flatMap(id => [id, id]).map((id, i) => {
      const [x, y] = FILL_SLOTS[i];
      return { id, x, y, s: .95 + rnd() * .15, rot: deg(Math.atan2(y - B.y, x - B.x)) + 90 + (rnd() - .5) * 10 };
    });
    const head = it => `<g transform="translate(${it.x} ${it.y}) rotate(${f1(it.rot)}) scale(${f1(it.s)})">${byId[it.id].draw(rnd)}</g>`;

    let out = backWrap(st.wrap);

    // 1) 잎 (항상 깔아서 풍성하게)
    let green = '';
    [-138, -112, -68, -42].forEach(a => { green += blade(a + (rnd() - .5) * 10, 150 + rnd() * 30, rnd); });
    const N = 7;
    for (let i = 0; i < N; i++) {
      const a = -146 + i * 112 / (N - 1) + (rnd() - .5) * 8;
      const len = 140 + 90 * Math.sin(-a * Math.PI / 180) + (rnd() - .5) * 20;
      green += sprig(a, len, i % 2 ? 'sage' : 'leaf', rnd);
    }
    out += wc(green);

    // 2) 곁들임
    out += Fi.map(head).join('');

    // 3) 꽃 줄기 + 꽃 뒤에 받친 잎
    out += wc(M.map(it => {
      const [sx, sy] = byId[it.id].stemAt || [0, 8];
      const x0 = it.x + sx * it.s, y0 = it.y + sy * it.s;
      const stem = `<path d="M${f1(x0)} ${f1(y0)}Q${f1(x0 + (B.x - x0) * .35)} ${f1(y0 + (B.y - y0) * .55)} ${f1(B.x + (x0 - B.x) * .08)} ${B.y}" fill="none" stroke="${PAL.leaf[1]}" stroke-width="2.4"/>`;
      const dir = deg(Math.atan2(it.y - DOME.y, (it.x - DOME.x) || .01));
      const leaves = [-40, 36].map(o => {
        const a = (dir + o + (rnd() - .5) * 16) * Math.PI / 180, r = 28 * it.s;
        return `<path d="M0 0C7-9 20-10 32 0C20 10 7 9 0 0Z" transform="translate(${f1(it.x + Math.cos(a) * r)} ${f1(it.y + Math.sin(a) * r)}) rotate(${f1(deg(a))}) scale(${f1(it.s * .9)})" fill="url(#l-leaf)" fill-opacity=".85" stroke="${PAL.leaf[2]}" stroke-width=".8" stroke-opacity=".4"/>`;
      }).join('');
      return stem + leaves;
    }).join(''));

    // 4) 꽃 (주인공은 맨 앞)
    const order = M.length ? [...M.slice(1).sort((a, b) => a.y - b.y), M[0]] : [];
    out += order.map(head).join('');

    // 5) 아래로 삐져나온 줄기 다발
    let stems = '';
    for (let i = 0; i < 11; i++) {
      const x = 188 + i * 2.4 + (rnd() - .5) * 2, ex = 176 + i * 4.8;
      stems += `<path d="M${f1(x)} ${B.y}L${f1(ex)} 574" fill="none" stroke="${PAL.leaf[1]}" stroke-width="2.6"/>`;
    }
    out += wc(stems);

    return out + frontWrap(st.wrap);
  }

  /* ---------- 리본 ---------- */
  // stage 1: 감기(띠 + 매듭) / stage 2: 나비 리본 + 꼬리
  function ribbon(k, stage) {
    if (!stage) return '';
    const f = `url(#rb-${k})`, dk = mix(RIBBONS[k], '#5a3a30', .45);
    const a = `fill="${f}" stroke="${dk}" stroke-opacity=".6" stroke-width=".9" stroke-linejoin="round"`;
    const band = `<path class="rb-band" d="M174 360Q200 367 226 360L227 376Q200 383 173 376Z" ${a}/>`;
    const knot = `<ellipse class="rb-knot" cx="200" cy="368" rx="8" ry="9" ${a}/>`;
    if (stage < 2) return band + knot;
    const loop = 'M200 368C178 342 138 344 145 368C150 392 180 386 200 368Z';
    const shade = `<path d="M199 366C184 354 160 352 156 364" fill="none" stroke="${dk}" stroke-width="1.6" opacity=".35"/>`;
    const tail = 'M197 372C190 400 178 426 165 454L174 449L179 460C191 432 199 404 203 374Z';
    const mir = 'transform="translate(400 0) scale(-1 1)"';
    return band +
      `<g class="rb-tails"><path class="rb-tail l" d="${tail}" ${a}/><g ${mir}><path class="rb-tail r" d="${tail}" ${a}/></g></g>` +
      `<g class="rb-loops"><path d="${loop}" ${a}/>${shade}<g ${mir}><path d="${loop}" ${a}/>${shade}</g></g>` +
      knot;
  }

  // ∞ 안내 점선 (레니스케이트 곡선)
  function guide() {
    const a = 74;
    let d = '';
    for (let i = 0; i <= 72; i++) {
      const t = i / 72 * Math.PI * 2, s = Math.sin(t), den = 1 + s * s;
      const x = B.x + a * Math.cos(t) / den, y = B.y + a * 1.35 * s * Math.cos(t) / den;
      d += (i ? 'L' : 'M') + f1(x) + ' ' + f1(y);
    }
    return `<path class="guide" d="${d}Z"/>`;
  }

  // ∞ 판별: 왼쪽·오른쪽 고리를 위아래로 돌고, 가운데(교차점)를 지나 반대편으로 넘어갔는지
  function isInfinity(pts) {
    if (pts.length < 16) return false;
    let minX = Infinity, maxX = -Infinity, crossC = 0, last = null;
    const box = { Lt: 0, Lb: 0, Rt: 0, Rb: 0 }, sides = [];
    for (const p of pts) {
      const dx = p.x - B.x, dy = p.y - B.y;
      if (Math.abs(dx) > 150 || Math.abs(dy) > 100) continue;
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      let side = null;
      if (dx < -26) side = 'L';
      else if (dx > 26) side = 'R';
      else if (Math.abs(dx) < 16 && Math.abs(dy) < 24) side = 'C';
      if (side === 'L') { if (dy < -7) box.Lt = 1; if (dy > 7) box.Lb = 1; }
      if (side === 'R') { if (dy < -7) box.Rt = 1; if (dy > 7) box.Rb = 1; }
      if (side && side !== last) {
        if (side === 'C') crossC++; else sides.push(side);
        last = side;
      }
    }
    let switches = 0;
    for (let i = 1; i < sides.length; i++) if (sides[i] !== sides[i - 1]) switches++;
    return maxX - minX >= 90 && box.Lt && box.Lb && box.Rt && box.Rb && switches >= 1 && crossC >= 1;
  }

  const head = id => byId[id].draw(rng(hash(id)));

  return { MOODS, FLOWERS, byId, WRAPS, WRAP_NAMES, RIBBONS, RIBBON_NAMES, defs, compose, ribbon, guide, isInfinity, head };
})();
