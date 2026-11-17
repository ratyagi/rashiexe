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
