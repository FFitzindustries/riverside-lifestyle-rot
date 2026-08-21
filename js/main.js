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

/* ---- Portal-Hero: eine Zone wählen, dann in sie hineinfahren ----
   Der Panel-Block oben steigt aus, wenn .panels fehlt; dieser hier greift nur
   im Portal-Modus. Beide Bauarten des Heros schließen sich gegenseitig aus. */
(function () {
  'use strict';

  var hero = document.querySelector('.hero--portal');
  var scene = hero && hero.querySelector('.portal__scene');
  if (!hero || !scene) return;

  var zones = [].slice.call(scene.querySelectorAll('.zone'));
  if (!zones.length) return;

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var cards = window.matchMedia('(max-width: 920px)');
  var coarse = window.matchMedia('(hover: none)');
  var diving = false;
  var blackout = null;

  // Zoomziel je Marke, in Prozent des Bildes: die Fahrt soll auf der Handlung
  // landen, nicht auf dem Schild darüber.
  var TARGET = { ink: '16% 58%', gastro: '50% 52%', beauty: '82% 55%' };

  function focus(zone) {
    if (diving) return;
    zones.forEach(function (z) { z.classList.toggle('is-active', z === zone); });
    scene.classList.toggle('is-focused', !!zone);
    hero.classList.toggle('is-focused', !!zone);
  }

  function dive(zone) {
    diving = true;
    zones.forEach(function (z) { z.classList.toggle('is-active', z === zone); });
    hero.classList.add('is-focused', 'is-diving');
    scene.classList.add('is-focused', 'is-diving');

    if (cards.matches) {
      zone.classList.add('is-diving');
    } else {
      scene.style.transformOrigin = TARGET[zone.getAttribute('data-brand')] || '50% 50%';
    }

    if (!blackout) {
      blackout = document.createElement('div');
      blackout.className = 'portal-blackout';
      document.body.appendChild(blackout);
    }
    // Erst im nächsten Frame einschalten, sonst überspringt der Browser den Übergang.
    window.requestAnimationFrame(function () { blackout.classList.add('is-on'); });

    var href = zone.getAttribute('href');
    window.setTimeout(function () { window.location.href = href; }, cards.matches ? 900 : 1050);
  }

  zones.forEach(function (zone) {
    zone.addEventListener('mouseenter', function () { if (!cards.matches) focus(zone); });
    zone.addEventListener('focus', function () { if (!cards.matches) focus(zone); });

    zone.addEventListener('click', function (ev) {
      // Modifier-Klicks gehören dem Browser: neuer Tab, Fenster, Download.
      if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey || ev.button !== 0) return;
      // Ohne Animation bleibt der Link ein Link.
      if (reduced.matches) return;
      // Im Kartenlayout steht schon alles offen, der erste Tipp führt hinein.
      // Im Weitwinkel-Layout deckt ein Tipp ohne Mauszeiger erst die Zone auf.
      if (!cards.matches && coarse.matches && !zone.classList.contains('is-active')) {
        ev.preventDefault();
        focus(zone);
        return;
      }
      ev.preventDefault();
      dive(zone);
    });
  });

  scene.addEventListener('mouseleave', function () { if (!cards.matches) focus(null); });

  // Zurück aus dem bfcache: die Bühne steht sonst schwarz und halb weggezoomt da.
  window.addEventListener('pageshow', function (ev) {
    if (!ev.persisted) return;
    diving = false;
    hero.classList.remove('is-focused', 'is-diving');
    scene.classList.remove('is-focused', 'is-diving');
    scene.style.transformOrigin = '';
    zones.forEach(function (z) { z.classList.remove('is-diving', 'is-active'); });
    if (blackout) blackout.classList.remove('is-on');
  });
})();
