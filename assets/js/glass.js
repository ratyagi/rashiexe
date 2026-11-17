/*
 * glass.js: the moving parts of the Liquid Glass theme.
 *
 *  1. Colour field   the slowly drifting light behind the glass.
 *  2. Pointer light  each glass surface catches light where the pointer is.
 *  3. Tab droplet    the glass bubble behind the active tab stretches and
 *                    slides, like a drop of liquid, when you switch tabs.
 *  4. Appearance     light / dark / follow the system, remembered per visitor.
 *  5. Lens           in Chromium, the tab bar bends what scrolls beneath it.
 */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- 1. Colour field ---------- */
  const field = document.createElement('div');
  field.className = 'liquid-bg';
  field.setAttribute('aria-hidden', 'true');
  field.innerHTML = '<i></i><i></i><i></i><i></i><i></i>';
  document.body.prepend(field);

  /* ---------- 1b. Scenes: a starry sky (dark) and a beach from above (light) ----------
   * Both are drawn in code so they stay sharp at any size and weigh nothing.
   * CSS shows the one that matches the current appearance.
   */
  const isDark = () => {
    const t = document.documentElement.getAttribute('data-theme');
    return t ? t === 'dark' : !window.matchMedia('(prefers-color-scheme: light)').matches;
  };

  // Night sky: stars at three depths that twinkle, plus a rare shooting star.
  const sky = document.createElement('canvas');
  sky.className = 'scene-stars';
  sky.setAttribute('aria-hidden', 'true');
  field.after(sky);
  const sctx = sky.getContext('2d');
  let stars = [], meteor = null, W = 0, H = 0, dpr = 1;
  function sizeSky() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    sky.width = W * dpr; sky.height = H * dpr;
    sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.min(420, Math.round((W * H) / 4200));
    stars = Array.from({ length: n }, () => {
      const depth = Math.random();
      return {
        x: Math.random() * W, y: Math.random() * H,
        r: depth < 0.75 ? 0.4 + depth * 0.6 : 0.9 + depth * 0.9,
        a: 0.35 + depth * 0.6, tw: Math.random() * Math.PI * 2, sp: 0.6 + Math.random() * 1.6,
        hue: Math.random() < 0.15 ? '255, 220, 190' : Math.random() < 0.3 ? '190, 215, 255' : '255, 255, 255',
      };
    });
  }
  function drawSky(t) {
    sctx.clearRect(0, 0, W, H);
    for (const st of stars) {
      const a = reduceMotion.matches ? st.a : st.a * (0.65 + 0.35 * Math.sin(t * st.sp + st.tw));
      sctx.fillStyle = `rgba(${st.hue}, ${a.toFixed(3)})`;
      sctx.beginPath(); sctx.arc(st.x, st.y, st.r, 0, Math.PI * 2); sctx.fill();
      if (st.r > 1.4) {  // the brightest stars get a soft halo
        sctx.fillStyle = `rgba(${st.hue}, ${(a * 0.12).toFixed(3)})`;
        sctx.beginPath(); sctx.arc(st.x, st.y, st.r * 4, 0, Math.PI * 2); sctx.fill();
      }
    }
    if (reduceMotion.matches) return;
    if (!meteor && Math.random() < 0.0015) {
      meteor = { x: Math.random() * W * 0.7 + W * 0.2, y: Math.random() * H * 0.3, t0: t };
    }
    if (meteor) {
      const k = (t - meteor.t0) / 0.9;
      if (k > 1) { meteor = null; return; }
      const x = meteor.x - k * 260, y = meteor.y + k * 130;
      const g = sctx.createLinearGradient(x, y, x + 120, y - 60);
      g.addColorStop(0, `rgba(255, 255, 255, ${(1 - k).toFixed(3)})`);
      g.addColorStop(1, 'rgba(255, 255, 255, 0)');
      sctx.strokeStyle = g; sctx.lineWidth = 1.6; sctx.lineCap = 'round';
      sctx.beginPath(); sctx.moveTo(x, y); sctx.lineTo(x + 120, y - 60); sctx.stroke();
    }
  }
  sizeSky();
  window.addEventListener('resize', sizeSky);
  // Twinkling is slow, so 24 redraws a second look the same as 60 and the glass
  // panels above have to re-blur the sky less than half as often.
  let lastSky = -1;
  (function loop(now) {
    if (!document.hidden && isDark() && now - lastSky > 1000 / 24) { drawSky(now / 1000); lastSky = now; }
    if (!reduceMotion.matches) requestAnimationFrame(loop);
  })(0);
  if (reduceMotion.matches) {
    window.addEventListener('resize', () => isDark() && drawSky(0));
    new MutationObserver(() => isDark() && drawSky(0)).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  // Beach from above: sea, a lacy line of foam that washes in and out, wet sand, dry sand.
  const beach = document.createElement('div');
  beach.className = 'scene-beach';
  beach.setAttribute('aria-hidden', 'true');
  // The shoreline: one irregular curve across the scene.
  const shore = (y, amp, seed) => {
    const pts = [];
    for (let x = -100; x <= 2500; x += 50) {
      pts.push([x, y + Math.sin(x / 150 + seed) * amp + Math.sin(x / 53 + seed * 2.3) * amp * 0.4 + Math.sin(x / 23 + seed) * amp * 0.15]);
    }
    return pts.map(([x, yy], i) => `${i ? 'L' : 'M'}${x} ${yy.toFixed(1)}`).join(' ');
  };
  const line = shore(600, 22, 1.7);
  // Each layer is rendered once as an image, then only moved. Noise filters are
  // slow to recalculate, so they must never sit inside something that animates.
  const svgImg = (body, cls) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2400 1000" preserveAspectRatio="xMidYMid slice">${body}</svg>`;
    return `<img class="${cls}" alt="" src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}">`;
  };
  const sand = `
    <defs>
      <linearGradient id="sand" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#c9ad80"/><stop offset=".55" stop-color="#d9c098"/><stop offset="1" stop-color="#efdcbb"/>
      </linearGradient>
      <filter id="grain" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="11"/>
        <feColorMatrix type="matrix" values="0 0 0 0 .45  0 0 0 0 .33  0 0 0 0 .2  0 0 0 .35 -.08"/>
      </filter>
    </defs>
    <rect width="2400" height="1000" fill="url(#sand)"/>
    <rect width="2400" height="1000" filter="url(#grain)" opacity=".7"/>
    <path d="${shore(640, 26, 1.7)} V1100 H-100 Z" fill="#b89a6c" opacity=".3"/>`;
  const sea = `
    <defs>
      <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#0d5f78"/><stop offset=".35" stop-color="#1e8fa6"/>
        <stop offset=".52" stop-color="#4cc2c6"/><stop offset=".6" stop-color="#9fe0d8"/>
      </linearGradient>
      <linearGradient id="laceMask" x1="0" y1="0" x2="0" y2="1">
        <stop offset=".3" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".55"/>
        <stop offset=".6" stop-color="#fff" stop-opacity="1"/><stop offset=".64" stop-color="#fff" stop-opacity="0"/>
      </linearGradient>
      <mask id="laceArea"><rect width="2400" height="1000" fill="url(#laceMask)"/></mask>
      <filter id="lace" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.006 0.03" numOctaves="4" seed="7"/>
        <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 -9 5.2"/>
      </filter>
      <filter id="foamEdge" x="-5%" y="-50%" width="110%" height="200%">
        <feTurbulence type="fractalNoise" baseFrequency="0.02 0.06" numOctaves="3" seed="3" result="n"/>
        <feDisplacementMap in="SourceGraphic" in2="n" scale="38" xChannelSelector="R" yChannelSelector="G"/>
        <feGaussianBlur stdDeviation="1.2"/>
      </filter>
    </defs>
    <path d="${line} L2500 -100 L-100 -100 Z" fill="url(#sea)"/>
    <rect width="2400" height="1000" filter="url(#lace)" mask="url(#laceArea)" opacity=".75"/>
    <path d="${line}" fill="none" stroke="#fff" stroke-width="30" stroke-linecap="round" filter="url(#foamEdge)" opacity=".95"/>
    <path d="${shore(615, 24, 1.9)}" fill="none" stroke="#fff" stroke-width="10" filter="url(#foamEdge)" opacity=".6"/>`;
  beach.innerHTML = svgImg(sand, 'beach-sand') + svgImg(sea, 'beach-sea');
  sky.after(beach);

  /* ---------- 2. Pointer light ---------- */
  const GLASS = '.sidebar, article, .navbar, .testimonials-modal, .filter-select, .content-card, .service-item, .engagement-post-item > a, .icon-box, .info_more-btn, .form-btn, .mapbox, .project-img, .clients-item';
  let raf = 0, last = null;
  window.addEventListener('pointermove', (e) => {
    last = e;
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      // Light up the surface under the pointer and the panel it sits in.
      let el = last.target instanceof Element ? last.target.closest(GLASS) : null;
      for (let i = 0; el && i < 3; i++) {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--gx', `${((last.clientX - r.left) / r.width) * 100}%`);
        el.style.setProperty('--gy', `${((last.clientY - r.top) / r.height) * 100}%`);
        el = el.parentElement ? el.parentElement.closest(GLASS) : null;
      }
    });
  }, { passive: true });

  /* ---------- 4. Appearance ---------- */
  const MODES = ['auto', 'light', 'dark'];
  const ICON = { auto: 'contrast-outline', light: 'sunny-outline', dark: 'moon-outline' };
  const LABEL = { auto: 'Appearance: follows your system', light: 'Appearance: light', dark: 'Appearance: dark' };
  let mode = 'auto';
  try { mode = localStorage.getItem('appearance') || 'auto'; } catch (_) { /* storage blocked */ }
  function applyMode() {
    if (mode === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', mode);
    const btn = $('.theme-toggle');
    if (btn) {
      btn.setAttribute('aria-label', `${LABEL[mode]}. Click to change.`);
      btn.title = LABEL[mode];
      btn.innerHTML = `<ion-icon name="${ICON[mode]}"></ion-icon>`;
    }
  }

  /* ---------- 3. Tab droplet ---------- */
  function initNav() {
    const list = $('.navbar-list');
    if (!list) return;

    // The appearance toggle lives at the end of the tab bar.
    const li = document.createElement('li');
    li.className = 'navbar-item';
    li.innerHTML = '<button class="theme-toggle" type="button"></button>';
    list.appendChild(li);
    $('.theme-toggle', li).addEventListener('click', () => {
      mode = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
      try { localStorage.setItem('appearance', mode); } catch (_) { /* ignore */ }
      applyMode();
    });
    applyMode();

    const drop = document.createElement('span');
    drop.className = 'nav-drop';
    drop.setAttribute('aria-hidden', 'true');
    list.prepend(drop);

    let cur = null;
    const geom = (a) => ({ x: a.offsetLeft, w: a.offsetWidth });
    function place(g) { drop.style.setProperty('--x', `${g.x}px`); drop.style.setProperty('--w', `${g.w}px`); }

    function moveTo(link, animate) {
      const to = geom(link);
      if (!cur || !animate || reduceMotion.matches) { place(to); cur = to; return; }
      // Stretch to cover both tabs first, then settle on the new one, like a drop of liquid.
      const from = cur;
      const left = Math.min(from.x, to.x), right = Math.max(from.x + from.w, to.x + to.w);
      drop.classList.add('is-stretching');
      place({ x: left, w: right - left });
      setTimeout(() => { drop.classList.remove('is-stretching'); place(to); }, 200);
      cur = to;
    }

    const active = () => $('.navbar-link.active', list) || $('.navbar-link', list);
    $$('[data-nav-link]', list).forEach((a) => a.addEventListener('click', () => requestAnimationFrame(() => moveTo(active(), true))));
    window.addEventListener('resize', () => moveTo(active(), false));
    if (document.fonts) document.fonts.ready.then(() => moveTo(active(), false));
    moveTo(active(), false);
  }

  /* ---------- 5. Lens (Chromium only) ---------- */
  // A displacement map that pulls the backdrop inward near the edges of the
  // capsule, the way thick glass bends light. Other browsers keep plain blur.
  function initLens() {
    const brands = (navigator.userAgentData && navigator.userAgentData.brands) || [];
    if (!brands.some((b) => /Chromium/i.test(b.brand))) return;
    const bar = $('.navbar');
    if (!bar) return;

    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.position = 'absolute';
    svg.innerHTML = `
      <filter id="liquid-lens" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
        <feImage result="map" preserveAspectRatio="none"/>
        <feDisplacementMap in="SourceGraphic" in2="map" scale="34" xChannelSelector="R" yChannelSelector="G"/>
      </filter>`;
    document.body.appendChild(svg);
    const img = svg.querySelector('feImage');

    function build() {
      const w = Math.round(bar.offsetWidth), h = Math.round(bar.offsetHeight);
      if (!w || !h) return;
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const g = c.getContext('2d');
      const data = g.createImageData(w, h);
      const r = h / 2, band = Math.min(r, 20);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          // Nearest point on the capsule's centre line, and the distance to the edge.
          const cx = Math.max(r, Math.min(w - r, x)), cy = r;
          let dx = x - cx, dy = y - cy;
          const dist = Math.hypot(dx, dy) || 1;
          const edge = r - dist;
          let k = edge < band ? Math.pow(1 - Math.max(0, edge) / band, 2) : 0;
          dx /= dist; dy /= dist;
          const i = (y * w + x) * 4;
          data.data[i] = 128 - dx * k * 127;
          data.data[i + 1] = 128 - dy * k * 127;
          data.data[i + 2] = 128;
          data.data[i + 3] = 255;
        }
      }
      g.putImageData(data, 0, 0);
      img.setAttribute('href', c.toDataURL());
      img.setAttribute('width', w); img.setAttribute('height', h);
    }
    build();
    document.documentElement.classList.add('has-lens');
    let t;
    window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(build, 150); });
    if (document.fonts) document.fonts.ready.then(build);
  }

  /*
   * A glass panel's backdrop blur traps position:fixed children inside the
   * panel. The testimonial pop-up lives inside the About panel, so move it to
   * the page so it covers the whole screen. script.js keeps working: it holds
   * references to the elements, not to where they sit.
   */
  function freeModal() {
    const modal = $('[data-modal-container]');
    if (modal && modal.parentElement !== document.body) document.body.appendChild(modal);
  }

  // The lens (initLens) bent the text under the tab bar and made it hard to read, so it is off.
  /*
   * Resume: show the first few roles and put the rest behind "See more".
   * Change SHOW to show more or fewer roles before the button.
   */
  function initSeeMore() {
    const SHOW = 4;
    const heading = $$('.resume .timeline h3').find((h) => h.textContent.trim() === 'Experience');
    if (!heading) return;
    const list = $('.timeline-list', heading.closest('.timeline'));
    const items = $$('.timeline-item', list);
    if (items.length <= SHOW) return;
    const hidden = items.slice(SHOW);
    hidden.forEach((li) => li.classList.add('is-collapsed'));
    list.id = list.id || 'experience-list';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'see-more-btn';
    btn.setAttribute('aria-controls', list.id);
    const label = (open) => {
      btn.setAttribute('aria-expanded', String(open));
      btn.innerHTML = open
        ? 'See less <ion-icon name="chevron-up-outline"></ion-icon>'
        : `See ${hidden.length} more <ion-icon name="chevron-down-outline"></ion-icon>`;
    };
    label(false);
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') !== 'true';
      hidden.forEach((li) => li.classList.toggle('is-collapsed', !open));
      label(open);
      if (!open) heading.scrollIntoView({ block: 'start', behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    });
    list.insertAdjacentElement('afterend', btn);
  }

  function start() { freeModal(); initNav(); initSeeMore(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
