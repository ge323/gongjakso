/* 💐 bouquet/bouquet.js — 꽃 그림 + 화면 동작 (이 파일 하나만 있으면 됨) */

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
    iris: ['#eee9fb', '#ab9ee4', '#6f5fbf'],
    stat: ['#f3ebfb', '#cbb3e8', '#9d80c9'],
    aster: ['#f6effc', '#d2b9ee', '#a27fd0'],
    frost: ['#ffffff', '#f3eef8', '#cbbfdc'],
    ivy: ['#d8e8c9', '#89af71', '#5a8148'],
  };

  const WRAPS = {
    cream: ['#fffcf6', '#f1e8d8'],
    kraft: ['#f6e9d4', '#e2cba8'],
    blush: ['#fff2f1', '#f5d3d5'],
    sage: ['#f3f7ef', '#d3dfcb'],
    lavender: ['#f8f5fc', '#ddd3ec'],
    sky: ['#e6f2fd', '#b3d2ef'],
    butter: ['#fffbe8', '#f6e7ae'],
    black: ['#4b4747', '#262323'],
  };
  const WRAP_NAMES = { cream: '크림', kraft: '크라프트', blush: '연분홍', sage: '세이지', lavender: '라벤더', sky: '하늘색', butter: '연노랑', black: '검정' };

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
      `<feDisplacementMap in="SourceGraphic" in2="n" scale="2.5" xChannelSelector="R" yChannelSelector="G" result="d"/>` +
      `<feGaussianBlur in="d" stdDeviation=".28" result="b"/>` +
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

  // 필터 없이 그려야 폰에서 또렷함 (필터는 저해상도로 뭉개짐)
  const wc = inner => `<g>${inner}</g>`;
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


  /* ---------- 추가 꽃 (생김새는 실제 꽃의 특징대로) ---------- */
  // 아이리스: 위로 선 꽃잎(standard) 3장 + 아래로 처진 꽃잎(fall) 3장, 처진 꽃잎에 노란 무늬
  const iris = () => {
    const c = PAL.iris[2], g = 'url(#l-iris)', r = 'url(#g-iris)';
    return wc(
      P('M0-6C-12-14-12-36 0-42C12-36 12-14 0-6Z', r, c) +
      P('M-4-6C-20-10-26-30-16-38C-8-30-4-18-4-6Z', g, c) +
      P('M4-6C20-10 26-30 16-38C8-30 4-18 4-6Z', g, c) +
      P('M-2-2C-20-6-36 4-32 20C-24 22-10 12-2 2Z', r, c) +
      P('M2-2C20-6 36 4 32 20C24 22 10 12 2 2Z', r, c) +
      P('M-6 0C-10 14-6 28 0 30C6 28 10 14 6 0Z', r, c) +
      `<path d="M-12 3C-17 6-21 9-23 13M12 3C17 6 21 9 23 13M0 5L0 18" fill="none" stroke="#f3cf5c" stroke-width="2.6" stroke-linecap="round"/>` +
      `<path d="M0 30L0 40" stroke="${PAL.leaf[1]}" stroke-width="2"/>`
    );
  };

  // 스타티스: 가지 끝마다 종이 같은 보라 꽃받침이 뭉쳐 있고, 가운데 작은 흰 꽃
  const statice = rnd => {
    let st = '', fl = '';
    for (let i = 0; i < 5; i++) {
      const ex = f1(-28 + i * 14 + (rnd() - .5) * 6), ey = f1(-14 - rnd() * 22 - (i % 2) * 8);
      st += `<path d="M0 34Q${f1(ex * .4)} 10 ${ex} ${ey}" fill="none" stroke="${PAL.sage[1]}" stroke-width="1.2"/>`;
      for (let j = 0; j < 7; j++) {
        const x = f1(ex + (rnd() - .5) * 12), y = f1(ey + (rnd() - .5) * 9);
        fl += `<path d="M${x} ${f1(y - 3.4)}l3 1.6-.4 3.4-2.6 1.6-2.6-1.6-.4-3.4z" fill="url(#g-stat)" stroke="${PAL.stat[2]}" stroke-width=".5" stroke-opacity=".6"/>`;
        if (j % 2) fl += `<circle cx="${x}" cy="${y}" r=".9" fill="#fff"/>`;
      }
    }
    return wc(st + fl);
  };

  // 과꽃: 가늘고 긴 꽃잎이 여러 겹, 가운데 노란 꽃술
  const chinaAster = rnd => wc(`<g transform="scale(1 .9)">` +
    ring(26, petal(25, 3.2), 'url(#l-aster)', { r0: 7, rot: rnd() * 14, stroke: PAL.aster[2] }) +
    ring(22, petal(18, 2.8), 'url(#l-aster)', { r0: 6, rot: 7, stroke: PAL.aster[2] }) +
    ring(16, petal(11, 2.4), 'url(#g-aster)', { r0: 5, rot: 3, stroke: PAL.aster[2] }) +
    `<circle r="6.5" fill="url(#g-yel)" stroke="${PAL.yel[2]}" stroke-width=".7" stroke-opacity=".5"/></g>`);

  // 공작초: 가지마다 작은 흰 꽃(가운데 노랑)이 여러 송이
  const frostOne = () => ring(14, petal(8, 1.8), 'url(#l-frost)', { r0: 2.4, stroke: PAL.frost[2] }) +
    `<circle r="2.6" fill="url(#g-yel)"/>`;
  const frostAster = rnd => {
    let st = '', fl = '';
    for (let i = 0; i < 11; i++) {
      const a = (-160 + rnd() * 140) * Math.PI / 180, r = 14 + rnd() * 22;
      const x = f1(Math.cos(a) * r), y = f1(Math.sin(a) * r * .9 - 4);
      st += `<path d="M0 34Q${f1(x * .5)} ${f1(y * .3 + 10)} ${x} ${y}" fill="none" stroke="${PAL.sage[1]}" stroke-width=".9"/>`;
      fl += `<g transform="translate(${x} ${y}) rotate(${f1(rnd() * 60)}) scale(${f1(.85 + rnd() * .35)})">${frostOne()}</g>`;
    }
    return wc(st + fl);
  };

  // 카모마일: 흰 혀꽃이 살짝 뒤로 젖혀지고, 가운데가 볼록한 노란 꽃
  const chamOne = () => ring(16, petal(13, 3), 'url(#l-wht)', { r0: 6, stroke: '#b9bfae' }) +
    `<ellipse rx="7" ry="6" fill="url(#g-yel)" stroke="${PAL.yel[2]}" stroke-width=".8" stroke-opacity=".45"/>` +
    `<ellipse cy="-1.5" rx="4.5" ry="3" fill="#fff6c6" opacity=".6"/>`;
  const chamomile = rnd => wc(
    `<path d="M-20 4Q-8 24 0 34M18-2Q8 22 0 34M2-16Q2 10 0 34" fill="none" stroke="${PAL.leaf[1]}" stroke-width="1.5"/>` +
    [[-20, 2, .95], [18, -4, .9], [2, -18, 1.05]].map(([x, y, k]) =>
      `<g transform="translate(${x} ${y}) rotate(${f1((rnd() - .5) * 30)}) scale(${k} ${f1(k * .82)})">${chamOne()}</g>`).join(''));

  // 아이비 (곁들임): 3~5갈래로 갈라진 잎이 덩굴에
  const IVY = 'M0 0C-4-2-10-2-12-6C-8-8-8-12-6-14C-4-12-2-14 0-18C2-14 4-12 6-14C8-12 8-8 12-6C10-2 4-2 0 0Z';
  const ivy = rnd => {
    let s = `<path d="M0 44C-10 20 10 0-4-24C-12-38 0-46-6-54" fill="none" stroke="${PAL.ivy[2]}" stroke-width="1.3"/>`;
    [[-2, 30, 1], [3, 14, -1], [2, 0, 1], [-4, -16, -1], [-7, -32, 1], [-5, -48, -1]].forEach(([x, y, side], i) => {
      const k = f1(1.1 - i * .09), a = f1(side * (50 + rnd() * 20));
      s += `<g transform="translate(${x} ${y}) rotate(${a}) scale(${k})"><path d="${IVY}" fill="url(#l-ivy)" stroke="${PAL.ivy[2]}" stroke-width=".7" stroke-opacity=".5"/>` +
        `<path d="M0 0L0-15M0-4L-8-7M0-4L8-7" fill="none" stroke="#fff" stroke-width=".7" stroke-opacity=".55"/></g>`;
    });
    return wc(s);
  };

  /* ---------- 꽃 목록 ---------- */
  // stemAt: 줄기가 붙는 위치 (꽃 그림 기준)
  const FLOWERS = [
    { id: 'red_rose', name: '빨간 장미', meaning: '열렬한 사랑', moods: ['love'], draw: rose('red'), stemAt: [0, 33] },
    { id: 'lisianthus', name: '리시안셔스', meaning: '변치 않는 사랑', moods: ['love'], draw: lisianthus, stemAt: [0, 30] },
    { id: 'red_tulip', name: '빨간 튤립', meaning: '사랑의 고백', moods: ['love'], draw: tulip, stemAt: [0, 34], vis: .9 },
    { id: 'pink_rose', name: '분홍 장미', meaning: '사랑의 맹세', moods: ['love'], draw: rose('pink'), stemAt: [0, 33] },
    { id: 'carnation', name: '카네이션', meaning: '사랑, 감사', moods: ['thanks', 'love'], draw: carnation, stemAt: [0, 40] },
    { id: 'sunflower', name: '해바라기', meaning: '기다림, 동경', moods: ['miss'], draw: sunflower, vis: .92 },
    { id: 'freesia', name: '프리지아', meaning: '천진난만', moods: ['cheer', 'congrats'], draw: freesia, stemAt: [-26, 16], spray: true },
    { id: 'gerbera', name: '거베라', meaning: '신비', moods: [], draw: gerbera },
    { id: 'lily_valley', name: '은방울꽃', meaning: '다시 찾은 행복', moods: ['comfort'], draw: lilyValley, stemAt: [-6, 30], spray: true, vis: .95 },
    { id: 'daisy', name: '데이지', meaning: '평화, 희망', moods: ['comfort', 'cheer'], draw: daisy, spray: true, vis: .95 },
    { id: 'forget_me_not', name: '물망초', meaning: '나를 잊지 마세요', moods: ['miss'], draw: forgetMeNot, spray: true, vis: .92 },
    { id: 'ranunculus', name: '라넌큘러스', meaning: '매력', moods: ['congrats'], draw: ranunculus, stemAt: [0, 30] },
    { id: 'iris', name: '아이리스', meaning: '좋은 소식', moods: ['congrats', 'cheer'], draw: iris, stemAt: [0, 40] },
    { id: 'statice', name: '스타티스', meaning: '변치 않는 마음', moods: ['love', 'miss'], draw: statice, stemAt: [0, 34], spray: true },
    { id: 'china_aster', name: '과꽃', meaning: '믿는 마음, 추억', moods: ['miss', 'cheer'], draw: chinaAster, vis: .95 },
    { id: 'frost_aster', name: '공작초', meaning: '항상 좋은 기분, 안부', moods: ['cheer', 'miss'], draw: frostAster, stemAt: [0, 34], spray: true },
    { id: 'chamomile', name: '카모마일', meaning: '역경에 굴하지 않는 강인함', moods: ['cheer', 'comfort'], draw: chamomile, stemAt: [0, 34], spray: true },
    { id: 'gyp', name: '안개꽃', meaning: '맑은 마음', filler: true, draw: gyp, stemAt: [0, 44] },
    { id: 'eucalyptus', name: '유칼립투스', meaning: '', filler: true, draw: eucalyptus, stemAt: [0, 46] },
    { id: 'ivy', name: '아이비', meaning: '우정', filler: true, draw: ivy, stemAt: [0, 44] },
  ];
  const byId = Object.fromEntries(FLOWERS.map(f => [f.id, f]));

  /* ---------- 꽃다발 배치 (viewBox 0 50 400 450) ---------- */
  const B = { x: 200, y: 368 }; // 리본 묶는 자리
  const DOME = { x: 200, y: 222, r: 100 };

  // 둥근 돔 안의 자리 (단위 원 기준). 앞쪽 가운데 → 양옆 → 위쪽 순서
  const SLOTS = {
    1: [[0, 0]],
    2: [[-.42, .12], [.42, -.1]],
    3: [[0, .22], [-.56, -.18], [.56, -.24]],
    4: [[0, .3], [-.56, -.04], [.56, -.1], [0, -.56]],
    5: [[0, .3], [-.6, .16], [.6, .1], [-.3, -.5], [.32, -.54]],
    6: [[0, .16], [-.62, .3], [.62, .28], [-.56, -.38], [.56, -.4], [0, -.7]],
    7: [[0, .1], [-.6, .38], [.6, .36], [-.72, -.24], [.72, -.28], [-.28, -.7], [.3, -.72]],
  };
  // 송이 수가 적을수록 한 송이를 크게 → 항상 비슷한 크기의 꽃다발
  const SIZE = [1.75, 1.6, 1.5, 1.42, 1.35, 1.28, 1.22];

  function backWrap(k) {
    const back = 'M182 372L34 212Q50 150 118 124Q200 96 282 124Q350 150 366 212L218 372Z';
    const inner = 'M184 372L66 214Q90 164 140 148Q200 128 260 148Q310 164 334 214L216 372Z';
    return wc(`<path d="${back}" fill="url(#wp-${k})" stroke="${LINE}" stroke-opacity=".5" stroke-width=".9"/>` +
      `<path d="${inner}" fill="#8a6d55" fill-opacity=".06"/>` +
      `<path d="M60 180Q120 136 200 124" fill="none" stroke="#fff" stroke-width="3" stroke-opacity=".7" stroke-linecap="round"/>`);
  }

  function frontWrap(k) {
    const tissue = 'M46 258Q120 300 200 292Q280 300 354 254L232 372L168 372Z';
    const L = 'M182 374L50 270Q130 306 236 320L220 374Z';
    const R = 'M218 374L350 266Q272 308 164 324L180 374Z';
    const skirt = 'M181 368L219 368L238 466Q228 474 218 467Q207 476 197 468Q186 475 175 467L162 470Z';
    const ln = `stroke="${LINE}" stroke-opacity=".55" stroke-width=".9" stroke-linejoin="round"`;
    return wc(`<path d="${tissue}" fill="#fff" fill-opacity=".5" stroke="${LINE}" stroke-opacity=".3" stroke-width=".8"/>`) +
      wc(`<path d="${skirt}" fill="url(#wp-${k})" ${ln}/>` +
        `<path d="M200 372L200 470L218 467L238 466L219 368Z" fill="#8a6d55" fill-opacity=".06"/>` +
        `<path d="${L}" fill="url(#wp-${k})" ${ln}/>` +
        `<path d="${R}" fill="url(#wp-${k})" ${ln}/>` +
        `<path d="${R}" fill="#8a6d55" fill-opacity=".05"/>` +
        `<path d="M66 276Q140 306 226 318M336 274Q266 310 178 324" fill="none" stroke="#fff" stroke-width="3" stroke-opacity=".7" stroke-linecap="round"/>` +
        `<path d="M110 300L190 368M292 298L212 368M190 380L184 462" fill="none" stroke="${LINE}" stroke-opacity=".25" stroke-width=".8"/>`);
  }

  // 가느다란 잎 줄기 (루스커스 같은 느낌)
  function sprig(adeg, len, type, rnd) {
    const a = adeg * Math.PI / 180;
    const tx = B.x + Math.cos(a) * len, ty = B.y + Math.sin(a) * len;
    const bend = (rnd() - .5) * 36, nx = -Math.sin(a), ny = Math.cos(a);
    const cx = (B.x + tx) / 2 + nx * bend, cy = (B.y + ty) / 2 + ny * bend;
    const leafD = type === 'sage' ? 'M0 0C6-3 18-3.5 27 0C18 3.5 6 3 0 0Z' : 'M0 0C5-6 15-7 24 0C15 7 5 6 0 0Z';
    const pal = type === 'sage' ? 'sage' : 'leaf';
    let s = `<path d="M${B.x} ${B.y}Q${f1(cx)} ${f1(cy)} ${f1(tx)} ${f1(ty)}" fill="none" stroke="${PAL.leaf[1]}" stroke-width="1.5"/>`;
    let side = 1;
    for (let t = .5; t <= 1.001; t += .075, side = -side) {
      const u = 1 - t;
      const x = u * u * B.x + 2 * u * t * cx + t * t * tx, y = u * u * B.y + 2 * u * t * cy + t * t * ty;
      const dx = 2 * u * (cx - B.x) + 2 * t * (tx - cx), dy = 2 * u * (cy - B.y) + 2 * t * (ty - cy);
      const ang = t > .97 ? deg(Math.atan2(dy, dx)) : deg(Math.atan2(dy, dx)) + side * 42;
      s += `<path d="${leafD}" transform="translate(${f1(x)} ${f1(y)}) rotate(${f1(ang)}) scale(${f1(1.1 - t * .35)})" fill="url(#l-${pal})" fill-opacity=".9" stroke="${PAL[pal][2]}" stroke-width=".7" stroke-opacity=".4"/>`;
    }
    return s;
  }

  // 잎 한 장 (꽃 뒤에 받침)
  const leafAt = (x, y, a, k) =>
    `<path d="M0 0C8-10 22-11 34 0C22 11 8 10 0 0Z" transform="translate(${f1(x)} ${f1(y)}) rotate(${f1(a)}) scale(${f1(k)})" fill="url(#l-leaf)" fill-opacity=".9" stroke="${PAL.leaf[2]}" stroke-width=".8" stroke-opacity=".4"/>` +
    `<path d="M3 0L30 0" transform="translate(${f1(x)} ${f1(y)}) rotate(${f1(a)}) scale(${f1(k)})" stroke="#fff" stroke-width="1" stroke-opacity=".4"/>`;

  function compose(st) {
    const rnd = rng(hash(st.flowers.join(',') + st.wrap));
    const picked = st.flowers.filter(id => byId[id] && !byId[id].filler).slice(0, 7);
    const fills = st.flowers.filter(id => byId[id] && byId[id].filler).slice(0, 4);
    // 큰 꽃(주인공 역할)은 앞·안쪽, 송이 꽃(프리지아·은방울꽃·물망초·데이지)은 위·바깥쪽
    const mains = [...picked.filter(id => !byId[id].spray), ...picked.filter(id => byId[id].spray)];
    const n = mains.length;
    const slots = SLOTS[n] || [];
    const base = SIZE[n - 1] || 1.3;

    const M = mains.map((id, i) => {
      const [ux, uy] = slots[i];
      const x = DOME.x + ux * DOME.r + (rnd() - .5) * 8;
      const y = DOME.y + uy * DOME.r * .85 + (rnd() - .5) * 8;
      const s = base * (byId[id].vis || 1) * (i === 0 && n > 1 ? 1.08 : 1) * (.96 + rnd() * .08);
      return { id, x, y, s, rot: ux * 18 + (rnd() - .5) * 10 }; // 바깥쪽 꽃은 바깥으로 살짝 기울게
    });

    let out = backWrap(st.wrap);

    // 1) 잎 (항상 깔아서 빈틈 채우기)
    let green = '';
    for (let i = 0; i < 9; i++) {
      const a = -140 + i * 100 / 8 + (rnd() - .5) * 6;
      const len = 165 + 70 * Math.sin(-a * Math.PI / 180) + (rnd() - .5) * 14;
      green += sprig(a, len, i % 2 ? 'sage' : 'leaf', rnd);
    }
    out += wc(green);

    // 2) 곁들임: 돔 가장자리, 꽃 사이로 삐져나오게
    const FILL_ANG = [-148, -32, -118, -62, -165, -15, -90, -100];
    out += fills.flatMap(id => [id, id]).map((id, i) => {
      const a = (FILL_ANG[i] + (rnd() - .5) * 10) * Math.PI / 180;
      const x = DOME.x + Math.cos(a) * DOME.r * 1.02, y = DOME.y + Math.sin(a) * DOME.r * .95;
      const rot = deg(Math.atan2(y - B.y, x - B.x)) + 90;
      return `<g transform="translate(${f1(x)} ${f1(y)}) rotate(${f1(rot)}) scale(${f1(.95 + rnd() * .15)})"><g class="fh" data-id="${id}" style="--d:${f1(-rnd() * 4)}s">${byId[id].draw(rnd)}</g></g>`;
    }).join('');

    // 3) 꽃 줄기 + 꽃마다 바깥쪽으로 받친 잎 3장
    out += wc(M.map(it => {
      const [sx, sy] = byId[it.id].stemAt || [0, 8];
      const x0 = it.x + sx * it.s, y0 = it.y + sy * it.s;
      const stem = `<path d="M${f1(x0)} ${f1(y0)}Q${f1(x0 + (B.x - x0) * .35)} ${f1(y0 + (B.y - y0) * .55)} ${f1(B.x + (x0 - B.x) * .08)} ${B.y}" fill="none" stroke="${PAL.leaf[1]}" stroke-width="2.4"/>`;
      const dir = it.x === DOME.x && it.y >= DOME.y ? 90 : deg(Math.atan2(it.y - DOME.y - 20, it.x - DOME.x));
      const leaves = [-48, 0, 44].map(o => {
        const a = dir + o + (rnd() - .5) * 14, r = 26 * it.s;
        return leafAt(it.x + Math.cos(a * Math.PI / 180) * r, it.y + Math.sin(a * Math.PI / 180) * r, a, it.s * .85);
      }).join('');
      return stem + leaves;
    }).join(''));

    // 4) 꽃: 뒤(위)부터 앞(아래)으로, 주인공은 맨 앞
    const order = n ? [...M.slice(1).sort((a, b) => a.y - b.y), M[0]] : [];
    out += order.map(it => `<g transform="translate(${f1(it.x)} ${f1(it.y)}) rotate(${f1(it.rot)}) scale(${f1(it.s)})"><g class="fh" data-id="${it.id}" style="--d:${f1(-rnd() * 4)}s">${byId[it.id].draw(rnd)}</g></g>`).join('');

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

  // 누르면 떨어지는 꽃잎 색
  const PETAL = {
    red_rose: PAL.red[1], lisianthus: PAL.lis[2], red_tulip: PAL.tulip[1], pink_rose: PAL.pink[1],
    carnation: PAL.carn[1], sunflower: PAL.sun[1], freesia: PAL.free[1], gerbera: PAL.ger[1],
    lily_valley: '#ffffff', daisy: '#ffffff', forget_me_not: PAL.blue[1], ranunculus: PAL.ranu[1],
    gyp: '#ffffff', eucalyptus: PAL.euca[1],
    iris: PAL.iris[1], statice: PAL.stat[1], china_aster: PAL.aster[1], frost_aster: '#ffffff', chamomile: '#ffffff', ivy: PAL.ivy[1],
  };

  return { PETAL, MOODS, FLOWERS, byId, WRAPS, WRAP_NAMES, RIBBONS, RIBBON_NAMES, defs, compose, ribbon, guide, isInfinity, head };
})();

/* 💐 bouquet/script.js — 만들기(리본 묶기) + 받기(리본 풀기) */
(() => {
  'use strict';

  const SB_URL = 'https://mamunluhjcrmharnrqdz.supabase.co';
  const SB_KEY = 'sb_publishable_eh0u-VyFBgXRSovoBPrgsQ_F2pYPjWU';

  const SITE = 'https://ge323.github.io/gongjakso/bouquet/';
  const OG_IMAGE = SITE + 'og-image.png';
  // 카카오 JavaScript 키 (developers.kakao.com → 내 애플리케이션 → 앱 키). 비어 있으면 카카오톡 버튼을 숨김
  const KAKAO_KEY = '';
  const KAKAO_SDK = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js';

  const F = window.Flowers;
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const MAX_MAIN = 7, MAX_FILL = 4;
  const STEPS = ['flowers', 'wrap', 'letter', 'ribbon', 'done'];

  document.body.insertAdjacentHTML('afterbegin', F.defs());

  const svg = $('#bq'), body = $('#bq-body'), rib = $('#bq-ribbon'), gd = $('#bq-guide');
  const drawP = $('#bq-draw'), drawH = $('#bq-draw-hl'), hint = $('#hint');

  const st = { flowers: [], wrap: 'cream', ribbon: 'pink', to: '', from: '', letter: '', pub: false, nick: '' };
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
      st.pub = $('#pub').checked;
      st.nick = st.pub ? $('#nick').value.trim() : '';
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
      .map(id => { const fl = F.byId[id]; return `<li>${flowerSvg(fl)}<p><b>${fl.name}</b>${fl.meaning ? `<span>${fl.meaning}</span>` : ''}</p></li>`; })
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
      // 리본이 풀리는 순간 종이폭죽 팡!
      const p = svg.createSVGPoint();
      p.x = B_X; p.y = B_Y;
      const o = p.matrixTransform(svg.getScreenCTM());
      popSound();
      buzz(40);
      confetti(o.x, o.y);
    }, 300);
    setTimeout(() => {
      const card = $('#card');
      card.hidden = false;
      $('#again').hidden = false;
      requestAnimationFrame(() => card.classList.add('show'));
      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 1100);
  }

  /* ----- 종이폭죽 ----- */
  const B_X = 200, B_Y = 368; // 리본 매듭 자리 (그림 좌표)

  // "팡" 소리: 짧은 잡음을 아주 빠르게 줄임 (음원 파일 없이)
  function popSound() {
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      const len = Math.floor(ac.sampleRate * .18), buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4);
      const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
      src.buffer = buf;
      f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = .7;
      g.gain.value = .5;
      src.connect(f).connect(g).connect(ac.destination);
      src.start();
    } catch { }
  }

  function confetti(ox, oy) {
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const cv = document.createElement('canvas');
    cv.className = 'confetti';
    document.body.appendChild(cv);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = innerWidth, H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    const ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);

    // 리본 색 + 꽃다발에 들어간 꽃 색 + 금색
    const colors = [F.RIBBONS[st.ribbon], '#f6c7cf', '#fbe39a', '#cfe3c2', '#cbdcf5', '#e9dcf5', '#f3b6a8', '#e6c47e'];
    const N = reduce ? 30 : 140;
    const parts = [];
    for (let i = 0; i < N; i++) {
      const a = (-90 + (Math.random() - .5) * 150) * Math.PI / 180; // 위쪽 부채꼴로
      const sp = 7 + Math.random() * 9;
      parts.push({
        x: ox, y: oy,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2,
        w: 7 + Math.random() * 6, h: 4 + Math.random() * 5,
        r: Math.random() * Math.PI, vr: (Math.random() - .5) * .3,
        flip: Math.random() * Math.PI, vf: .1 + Math.random() * .2,
        shape: Math.random() < .55 ? 'paper' : Math.random() < .6 ? 'petal' : 'dot',
        c: colors[i % colors.length],
      });
    }

    const t0 = performance.now(), LIFE = 2600;
    (function frame(now) {
      const t = now - t0;
      ctx.clearRect(0, 0, W, H);
      ctx.globalAlpha = t > LIFE - 700 ? Math.max(0, (LIFE - t) / 700) : 1;
      for (const p of parts) {
        p.vx *= .985; p.vy = p.vy * .985 + .28; // 공기 저항 + 중력
        p.x += p.vx + Math.sin(p.flip) * .6; p.y += p.vy;
        p.r += p.vr; p.flip += p.vf;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.scale(1, Math.cos(p.flip)); // 종이가 팔랑팔랑 뒤집힘
        ctx.fillStyle = p.c;
        if (p.shape === 'paper') ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        else {
          ctx.beginPath();
          if (p.shape === 'petal') ctx.ellipse(0, 0, p.w * .6, p.h * .45 + 1, 0, 0, Math.PI * 2);
          else ctx.arc(0, 0, p.h * .5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      if (t < LIFE) requestAnimationFrame(frame);
      else cv.remove();
    })(t0);
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
  /* ================= 받은 꽃 누르기: 흔들림 + 하트 + 꽃말 ================= */
  const PLUCK = [523, 587, 659, 784, 880, 1047, 1175];
  function pluck() {
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
      o.type = 'triangle';
      o.frequency.value = PLUCK[Math.floor(Math.random() * PLUCK.length)];
      g.gain.setValueAtTime(.09, t);
      g.gain.exponentialRampToValueAtTime(.0001, t + .6);
      o.connect(g).connect(ac.destination);
      o.start(t); o.stop(t + .65);
    } catch { }
  }

  function hearts(x, y) {
    const colors = ['#f4a3b5', '#f7c6cf', '#e7798a', '#f6d27a', '#c8b5e3'];
    const n = 5 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const el = document.createElement('span');
      el.className = 'heart';
      el.textContent = Math.random() < .8 ? '♥' : '✿';
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      el.style.color = colors[Math.floor(Math.random() * colors.length)];
      el.style.setProperty('--dx', ((Math.random() - .5) * 90).toFixed(0) + 'px');
      el.style.setProperty('--dy', (-60 - Math.random() * 60).toFixed(0) + 'px');
      el.style.setProperty('--r', ((Math.random() - .5) * 50).toFixed(0) + 'deg');
      el.style.fontSize = (12 + Math.random() * 10).toFixed(0) + 'px';
      el.style.animationDelay = (i * 40) + 'ms';
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 1400 + i * 40);
    }
  }

  // 꽃잎이 팔랑팔랑 떨어짐
  function petals(x, y, color) {
    const n = 3 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) {
      const el = document.createElement('span');
      el.className = 'petal';
      el.style.left = (x + (Math.random() - .5) * 30) + 'px';
      el.style.top = (y + (Math.random() - .5) * 20) + 'px';
      el.style.background = color;
      el.style.setProperty('--dx', ((Math.random() - .5) * 80).toFixed(0) + 'px');
      el.style.setProperty('--dy', (110 + Math.random() * 90).toFixed(0) + 'px');
      el.style.setProperty('--r', ((Math.random() - .5) * 540).toFixed(0) + 'deg');
      el.style.animationDelay = (60 + i * 70) + 'ms';
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 2000 + i * 70);
    }
  }

  let tipT;
  function tip(x, y, fl) {
    let t = $('#tip');
    if (!t) { t = document.createElement('div'); t.id = 'tip'; document.body.appendChild(t); }
    t.innerHTML = `<b>${fl.name}</b> · ${fl.meaning}`;
    t.style.left = Math.min(Math.max(x, 100), innerWidth - 100) + 'px';
    t.style.top = (y - 46) + 'px';
    t.classList.remove('show');
    void t.offsetWidth;
    t.classList.add('show');
    clearTimeout(tipT);
    tipT = setTimeout(() => t.classList.remove('show'), 1600);
  }

  svg.addEventListener('click', e => {
    if (mode !== 'view') return;
    const g = e.target.closest('.fh');
    if (!g) return;
    g.classList.remove('tap');
    void g.getBoundingClientRect(); // 연달아 눌러도 다시 흔들리게
    g.classList.add('tap');
    g.addEventListener('animationend', () => g.classList.remove('tap'), { once: true });
    hearts(e.clientX, e.clientY);
    petals(e.clientX, e.clientY, F.PETAL[g.dataset.id] || '#f7c6cf');
    pluck();
    buzz(10);
  });

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
        p_public: st.pub,
        p_nickname: st.nick,
      });
      shareUrl = `${pageBase()}?b=${id}`;
      $('#link').value = shareUrl;
      $('#preview').href = shareUrl;
      $('#shop-go').hidden = !st.pub;
      sending = false;
      go(STEPS.indexOf('done'));
      if (KAKAO_KEY) kakaoReady = prepareKakao(); // 미리 준비해 두면 버튼 누르자마자 열림
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

  /* ================= 공유 ================= */
  // 내 PC에서 파일로 열었을 때도 실제 사이트 주소로 링크를 만듦
  const pageBase = () =>
    location.protocol === 'file:' || /^(localhost|127\.)/.test(location.hostname)
      ? SITE
      : location.origin + location.pathname;
  let shareUrl = '', kakaoReady = null;
  const shareTitle = () => `${st.to}님께 도착한 꽃다발이 있어요 💐`;
  const SHARE_DESC = '리본을 풀어 꽃과 편지를 확인해 보세요';

  $('#copy').addEventListener('click', async () => {
    const text = `${shareTitle()}\n${SHARE_DESC}\n${shareUrl}`;
    try { await navigator.clipboard.writeText(text); }
    catch { $('#link').select(); document.execCommand('copy'); }
    toast('메시지와 링크를 복사했어요');
  });

  if (!navigator.share) $('#share').hidden = true;
  $('#share').addEventListener('click', async () => {
    try { await navigator.share({ title: shareTitle(), text: `${shareTitle()}\n${SHARE_DESC}`, url: shareUrl }); } catch { }
  });

  // 지금 꽃다발 그림을 PNG 파일로 (카카오톡 미리보기용)
  async function bouquetFile() {
    const W = 800;
    const c = svg.cloneNode(true);
    c.querySelector('#bq-guide').innerHTML = '';
    c.querySelectorAll('#bq-draw, #bq-draw-hl').forEach(el => el.remove());
    c.removeAttribute('class');
    c.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    c.setAttribute('width', W);
    c.setAttribute('height', W);
    c.setAttribute('viewBox', '-25 50 450 450');
    c.insertAdjacentHTML('afterbegin', `<rect x="-25" y="50" width="450" height="450" fill="#f7f1e8"/>` + $('svg.defs defs').outerHTML);
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(c));
    await img.decode();
    const cv = document.createElement('canvas');
    cv.width = cv.height = W;
    cv.getContext('2d').drawImage(img, 0, 0, W, W);
    const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
    return new File([blob], 'bouquet.png', { type: 'image/png' });
  }

  function loadKakao() {
    return new Promise((ok, no) => {
      if (window.Kakao) return ok();
      const s = document.createElement('script');
      s.src = KAKAO_SDK;
      s.crossOrigin = 'anonymous';
      s.onload = ok;
      s.onerror = no;
      document.head.appendChild(s);
    });
  }

  // SDK 불러오기 + 꽃다발 그림 올리기 → 미리보기 이미지 주소
  async function prepareKakao() {
    await loadKakao();
    if (!Kakao.isInitialized()) Kakao.init(KAKAO_KEY);
    try {
      const r = await Kakao.Share.uploadImage({ file: [await bouquetFile()] });
      return r.infos.original.url;
    } catch {
      return OG_IMAGE;
    }
  }

  if (!KAKAO_KEY) $('#kakao').hidden = true;
  $('#kakao').addEventListener('click', async () => {
    let imageUrl;
    try { imageUrl = await (kakaoReady || (kakaoReady = prepareKakao())); }
    catch { kakaoReady = null; return toast('카카오톡을 불러오지 못했어요'); }
    const link = { mobileWebUrl: shareUrl, webUrl: shareUrl };
    Kakao.Share.sendDefault({
      objectType: 'feed',
      content: { title: shareTitle(), description: SHARE_DESC, imageUrl, imageWidth: 800, imageHeight: 800, link },
      buttons: [{ title: '꽃다발 열어보기', link }],
    });
  });


  /* ================= 모두의 꽃집 (원하는 사람만 꽃다발 그림 자랑) ================= */
  const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const HEARTS_KEY = 'bouquet-hearts';
  const myHearts = () => { try { return new Set(JSON.parse(localStorage.getItem(HEARTS_KEY) || '[]')); } catch { return new Set(); } };
  const saveHeart = g => { try { const h = myHearts(); h.add(g); localStorage.setItem(HEARTS_KEY, JSON.stringify([...h].slice(-500))); } catch { } };
  let shopBefore = null;

  const copyUrl = b => `./?f=${encodeURIComponent(b.flowers.join(','))}&w=${encodeURIComponent(b.wrap)}&r=${encodeURIComponent(b.ribbon)}`;

  function shopCard(b) {
    const hearted = b.mine || myHearts().has(b.g);
    const svgBody = F.compose({ flowers: b.flowers, wrap: b.wrap }) + F.ribbon(b.ribbon, 2);
    return `<div class="shop-card"><svg viewBox="0 50 400 450" aria-hidden="true">${svgBody}</svg>` +
      `<div class="meta"><span class="nick">${esc(b.nickname || '익명')}</span>` +
      `<button type="button" class="love${hearted ? ' on' : ''}" data-g="${esc(b.g)}" aria-label="예뻐요">💗 <b>${b.hearts}</b></button></div>` +
      `<a class="copy" href="${copyUrl(b)}">따라 만들기</a></div>`;
  }

  async function loadShop() {
    $('#shop-more').hidden = true;
    let list = [];
    try {
      list = await rpc('list_public_bouquets', { p_player_id: playerId(), p_before: shopBefore, p_limit: 12 }) || [];
    } catch {
      if (!shopBefore) { $('#shop-empty').textContent = '불러오지 못했어요. 잠시 후 새로고침해 주세요'; $('#shop-empty').hidden = false; }
      return;
    }
    list = list.filter(b => Array.isArray(b.flowers) && b.flowers.every(id => F.byId[id]) && F.WRAPS[b.wrap] && F.RIBBONS[b.ribbon]);
    if (!shopBefore && !list.length) $('#shop-empty').hidden = false;
    $('#shop-grid').insertAdjacentHTML('beforeend', list.map(shopCard).join(''));
    if (list.length) shopBefore = list[list.length - 1].created_at;
    $('#shop-more').hidden = list.length < 12;
  }

  async function openShop() {
    mode = 'shop';
    document.body.classList.add('shopping');
    $('.stage').hidden = true;
    $('#shop').hidden = false;
    rpc('bouquet_stats', {}).then(s => {
      if (s && s.total) $('#shop-count').textContent = `지금까지 꽃다발 ${s.total.toLocaleString()}개 · 자랑 ${s.public.toLocaleString()}개`;
    }).catch(() => { });
    await loadShop();
  }

  $('#shop-more').addEventListener('click', loadShop);
  $('#shop-grid').addEventListener('click', async e => {
    const btn = e.target.closest('.love');
    if (!btn || btn.classList.contains('on')) return;
    const g = btn.dataset.g, num = btn.querySelector('b');
    btn.classList.add('on');
    num.textContent = Number(num.textContent) + 1;
    saveHeart(g);
    pluck();
    buzz(10);
    try {
      const n = await rpc('heart_bouquet', { p_player_id: playerId(), p_gallery_id: g });
      if (typeof n === 'number') num.textContent = n;
    } catch { }
  });

  $('#pub').addEventListener('change', e => { $('#nick').hidden = !e.target.checked; });

  // 따라 만들기: 주소의 꽃 구성으로 시작
  function applyCopy(q) {
    const ids = (q.get('f') || '').split(',').filter(id => F.byId[id]);
    let m = 0, f = 0;
    for (const id of ids) {
      if (F.byId[id].filler ? f < MAX_FILL : m < MAX_MAIN) { st.flowers.push(id); F.byId[id].filler ? f++ : m++; }
    }
    if (F.WRAPS[q.get('w')]) st.wrap = q.get('w');
    if (F.RIBBONS[q.get('r')]) st.ribbon = q.get('r');
  }

  /* ================= 시작 ================= */
  const query = new URLSearchParams(location.search);
  const bid = query.get('b');
  if (bid) {
    view(bid);
  } else if (query.has('shop')) {
    openShop();
  } else {
    if (query.has('f')) applyCopy(query);
    $('#maker').hidden = false;
    renderMoods();
    renderGrid();
    renderSwatches();
    drawP.setAttribute('stroke', F.RIBBONS[st.ribbon]);
    drawBouquet();
    go(0);
    updateCards();
  }
})();
