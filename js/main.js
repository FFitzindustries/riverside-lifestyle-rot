/* Riverside Lifestyle — Panel-Videos
   Desktop: Auto-Spotlight (nur aktives Panel spielt, wächst).
   Mobile: gestapelt, alle Panels spielen ihr Video, kein Wechsel, kein Springen. */
(function () {
  'use strict';

  // ---- Reveal-on-scroll für [data-reveal] ----
  var reveals = [].slice.call(document.querySelectorAll('[data-reveal]'));
  if (reveals.length) {
    var rm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (rm || !('IntersectionObserver' in window)) {
      reveals.forEach(function (el) { el.classList.add('in'); });
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
        });
      }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });
      reveals.forEach(function (el) { io.observe(el); });
    }
  }
})();

// ---- Mobile-Navigation (Hamburger) ----
(function () {
  'use strict';
  var nav = document.querySelector('.nav');
  var toggle = document.querySelector('.nav-toggle');
  if (!nav || !toggle) return;
  var links = nav.querySelector('.nav-links');

  function setOpen(open) {
    nav.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü öffnen');
  }
  toggle.addEventListener('click', function () { setOpen(!nav.classList.contains('open')); });
  if (links) {
    links.addEventListener('click', function (e) { if (e.target.closest('a')) setOpen(false); });
  }
})();

(function () {
  'use strict';

  var panelsWrap = document.querySelector('.panels');
  var panels = [].slice.call(document.querySelectorAll('.panel'));
  if (!panelsWrap || !panels.length) return;

  var isDesktop = window.matchMedia('(min-width: 921px)').matches;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- Auto-Spotlight: jedes Video spielt 10s, dann weiter (Desktop + Mobil).
  //      Mobil: Tap auf ein Panel leitet direkt zur jeweiligen Website weiter. ----
  var CYCLE = 10000, idx = 0, timer = null;

  function setActive(i) {
    idx = i;
    panels.forEach(function (p, k) {
      var active = k === i;
      p.classList.toggle('is-active', active);
      var v = p.querySelector('video');
      if (v) {
        if (active) { var pr = v.play(); if (pr && pr.catch) pr.catch(function () {}); }
        else v.pause();
      }
    });
  }
  function start() { if (reduced || timer) return; timer = setInterval(function () { setActive((idx + 1) % panels.length); }, CYCLE); }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }

  setActive(0);
  if (!reduced) {
    start();
    if (isDesktop) {
      panels.forEach(function (p, k) {
        p.addEventListener('mouseenter', function () { stop(); panelsWrap.classList.add('is-paused'); setActive(k); });
        p.addEventListener('mouseleave', function () { panelsWrap.classList.remove('is-paused'); start(); });
      });
    }
    document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else start(); });
  }
})();
