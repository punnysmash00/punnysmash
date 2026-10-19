/* Punny Smash — interazioni del sito
   - stato aperto/chiuso calcolato sugli orari reali (fuso Europe/Rome)
   - evidenzia il giorno corrente nella tabella orari
   - menu mobile, lightbox della galleria, anno nel footer               */

(function () {
  "use strict";

  /* ---------------------------------------------------------------- orari
     [apertura, chiusura] in minuti dalla mezzanotte del giorno di apertura.
     19:00 = 1140 · 02:00 = 26*60 · 05:00 = 29*60                            */
  var HOURS = {
    0: [1140, 1560], // domenica    19:00 → 02:00
    1: [1140, 1560], // lunedì
    2: [1140, 1560], // martedì
    3: [1140, 1560], // mercoledì
    4: [1140, 1560], // giovedì
    5: [1140, 1740], // venerdì     19:00 → 05:00
    6: [1140, 1740]  // sabato
  };
  var DAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  var DAY_NAME = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];

  function romanNow() {
    var parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Rome",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).formatToParts(new Date());
    var out = {};
    parts.forEach(function (p) { out[p.type] = p.value; });
    var hour = parseInt(out.hour, 10) % 24;
    var minute = parseInt(out.minute, 10);
    return { day: DAY_INDEX[out.weekday] ?? 1, minutes: hour * 60 + minute };
  }

  function hhmm(minutesFromMidnight) {
    var m = ((minutesFromMidnight % 1440) + 1440) % 1440;
    return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
  }

  function openState() {
    var now = romanNow();
    var today = HOURS[now.day];
    var prevClose = HOURS[(now.day + 6) % 7][1];

    // Sessione della sera precedente ancora aperta (dopo mezzanotte).
    if (now.minutes + 1440 < prevClose) {
      return { open: true, until: prevClose - 1440, day: (now.day + 6) % 7 };
    }
    // Sessione di stasera già iniziata.
    if (now.minutes >= today[0]) {
      return { open: true, until: today[1] - 1440, day: now.day };
    }
    // Chiuso: prossima apertura alle 19:00, oggi se non sono ancora passate.
    return { open: false, opensAt: today[0], nextDay: false, day: now.day };
  }

  function renderStatus() {
    var state = openState();
    var pill = document.querySelector("[data-status-pill]");

    if (pill) {
      var open = state.open;
      pill.hidden = false;
      pill.classList.toggle("is-open", open);
      pill.classList.toggle("is-closed", !open);
      pill.textContent = open
        ? "Aperto adesso · fino alle " + hhmm(state.until)
        : "Chiuso · apre " + (romanNow().minutes < state.opensAt ? "oggi" : "domani") + " alle 19:00";
    }

    // Evidenzia il giorno corrente in tabella (dopo mezzanotte resta il giorno di chiusura).
    var todayIndex = state.open ? state.day : romanNow().day;
    var rows = document.querySelectorAll("#hours tr[data-day]");
    Array.prototype.forEach.call(rows, function (row) {
      row.classList.toggle("is-today", row.getAttribute("data-day") === String(todayIndex));
    });
  }

  /* ------------------------------------------------------------ menu mobile */
  var toggle = document.getElementById("navToggle");
  var nav = document.getElementById("nav");

  if (toggle && nav) {
    var closeNav = function (refocus) {
      if (!nav.classList.contains("is-open")) return;
      nav.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Apri il menu di navigazione");
      if (refocus) toggle.focus();
    };

    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "Chiudi il menu di navigazione" : "Apri il menu di navigazione");
    });
    nav.addEventListener("click", function (event) {
      if (event.target.closest("a")) closeNav(false);
    });
    document.addEventListener("click", function (event) {
      if (!event.target.closest(".topbar")) closeNav(false);
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeNav(true);
    });
  }

  /* ------------------------------------------------------------- scroll spy */
  var sections = document.querySelectorAll("main section[id]");
  var navLinks = nav ? Array.prototype.slice.call(nav.querySelectorAll("a[href^='#']")) : [];

  if (sections.length && navLinks.length && "IntersectionObserver" in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        navLinks.forEach(function (link) {
          link.classList.toggle("is-current", link.getAttribute("href") === "#" + entry.target.id);
        });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    Array.prototype.forEach.call(sections, function (section) { observer.observe(section); });
  }

  /* --------------------------------------------------------------- lightbox */
  var lightbox = document.getElementById("lightbox");
  var lightboxImg = document.getElementById("lightboxImg");
  var lastFocus = null;

  function closeLightbox() {
    if (!lightbox || lightbox.hidden) return;
    lightbox.hidden = true;
    lightboxImg.removeAttribute("src");
    document.body.style.overflow = "";
    if (lastFocus) lastFocus.focus();
  }

  if (lightbox && lightboxImg) {
    document.addEventListener("click", function (event) {
      var btn = event.target.closest(".shot__btn");
      if (btn) {
        lastFocus = btn;
        lightboxImg.src = btn.getAttribute("data-full");
        lightboxImg.alt = btn.querySelector("img") ? btn.querySelector("img").alt : "";
        lightbox.hidden = false;
        document.body.style.overflow = "hidden";
        lightbox.querySelector(".lightbox__close").focus();
        return;
      }
      if (event.target === lightbox || event.target.classList.contains("lightbox__close")) {
        closeLightbox();
      }
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeLightbox();
    });
  }

  /* ------------------------------------- recensioni: movimento continuo ----
     Nastro che scorre a velocità costante: le card vengono duplicate una
     volta così il ritorno all'inizio non si vede. Si ferma solo mentre si
     tiene premuto su una recensione (e con "prefers-reduced-motion").       */
  var track = document.querySelector(".reviews");

  if (track && track.children.length) {
    var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    var SPEED_PX_S = 34;      // px al secondo: lento, sempre in movimento
    var loopWidth = 0;        // larghezza di un giro completo (card originali + gap)
    var pos = 0;              // posizione corrente del nastro
    var holding = false;      // dito/mouse premuto su una recensione
    var onScreen = false;     // sezione visibile
    var lastTime = 0;

    var originals = 0;        // quante card ci sono prima delle copie
    var started = false;

    function measureLoop() {
      if (!originals) return;
      loopWidth = track.children[originals].offsetLeft - track.children[0].offsetLeft;
    }

    function buildLoop() {
      originals = track.children.length;
      Array.prototype.forEach.call(track.children, function (card) {
        var clone = card.cloneNode(true);
        clone.setAttribute("aria-hidden", "true"); // solo decorativo: non va letto due volte
        track.appendChild(clone);
      });
      measureLoop();
    }

    // Il nastro si prepara solo quando la sezione si avvicina: al load non
    // serve a niente clonare card e forzare un layout fuori schermo.
    function start() {
      if (started || reducedMotion.matches) return;
      started = true;
      buildLoop();
      lastTime = 0;
      window.requestAnimationFrame(frame);
    }

    function scrollable() {
      return loopWidth > 8 && track.scrollWidth - track.clientWidth > 8;
    }

    function frame(now) {
      window.requestAnimationFrame(frame);
      if (!lastTime) { lastTime = now; return; }
      var delta = (now - lastTime) / 1000;
      lastTime = now;

      if (reducedMotion.matches || document.hidden || !onScreen || !scrollable()) return;

      // Fermo (dito giù o inerzia in corso): seguo la posizione reale del nastro.
      if (holding || now < resumeAt) {
        pos = track.scrollLeft;
        return;
      }

      pos = track.scrollLeft + SPEED_PX_S * delta;
      if (pos >= loopWidth) pos -= loopWidth;      // riparte senza stacco visibile
      track.scrollLeft = pos;
    }

    if (!reducedMotion.matches) {
      if ("IntersectionObserver" in window) {
        new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            onScreen = entry.isIntersecting;
            if (entry.isIntersecting) start();
          });
        }, { rootMargin: "300px 0px", threshold: 0 }).observe(track);
      } else {
        onScreen = true;
        start();
      }

      // Le card cambiano larghezza col viewport: ricalcolo il giro.
      var resizeTimer = 0;
      window.addEventListener("resize", function () {
        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(function () {
          if (!started) return;
          measureLoop();
          pos = track.scrollLeft;
          lastTime = 0;
        }, 250);
      });
    }

    // Stop finché si tiene premuto; alla release riprende da dov'è.
    // Col mouse (o penna) mentre tieni premuto puoi anche trascinare il nastro;
    // col dito lo spostamento orizzontale resta quello nativo del browser.
    var dragging = false;
    var dragStartX = 0;
    var dragStartScroll = 0;
    var resumeAt = 0;          // quando ripartire dopo il gesto (inerzia compresa)
    var SETTLE_MS = 400;

    function holdStart(event) {
      holding = true;
      if (event && event.pointerType && event.pointerType !== "touch" && event.button === 0) {
        dragging = true;
        dragStartX = event.clientX;
        dragStartScroll = track.scrollLeft;
        track.classList.add("is-dragging");
        if (track.setPointerCapture) {
          try { track.setPointerCapture(event.pointerId); } catch (error) { /* niente capture: si trascina lo stesso */ }
        }
        if (event.cancelable) event.preventDefault();
      }
    }

    function holdEnd(event) {
      // Su touch il browser invia pointercancel appena il gesto diventa uno
      // scroll: NON è la fine del gesto, il dito è ancora giù. Si riparte
      // solo a touchend/touchcancel (o quando si alza il mouse/penna).
      if (event && event.type === "pointercancel" && event.pointerType === "touch") return;
      holding = false;
      dragging = false;
      track.classList.remove("is-dragging");
      pos = track.scrollLeft;
      resumeAt = window.performance.now() + SETTLE_MS; // lascia finire l'inerzia
      lastTime = 0;
    }

    track.addEventListener("pointerdown", holdStart);
    track.addEventListener("touchstart", function () { holding = true; }, { passive: true });
    window.addEventListener("pointermove", function (event) {
      if (!dragging) return;
      track.scrollLeft = dragStartScroll - (event.clientX - dragStartX);
      if (event.cancelable) event.preventDefault();
    });
    // Il rilascio può avvenire anche fuori dal nastro: ascolto la finestra.
    window.addEventListener("pointerup", holdEnd);
    window.addEventListener("pointercancel", holdEnd);
    window.addEventListener("touchend", holdEnd, { passive: true });
    window.addEventListener("touchcancel", holdEnd, { passive: true });
    window.addEventListener("blur", holdEnd);
    document.addEventListener("visibilitychange", holdEnd);
    // Rotellina/trackpad: si riprende dalla posizione che ha scelto l'utente.
    track.addEventListener("wheel", function () { pos = track.scrollLeft; }, { passive: true });
  }

  /* --------------------------------------- mappa: carica avvicinandosi ---- */
  var mapBox = document.querySelector("[data-map]");
  var mapBtn = document.querySelector("[data-map-load]");
  var mapObserver = null;

  if (mapBox) {
    var loadMap = function (focusFrame) {
      if (mapBox.querySelector("iframe")) return;   // già caricata
      var frame = document.createElement("iframe");
      frame.title = "Mappa: Punny Smash, Corso Umberto I 34, Cava de' Tirreni";
      frame.src = "https://maps.google.com/maps?q=40.6970526,14.7102268&z=17&hl=it&output=embed";
      frame.referrerPolicy = "no-referrer-when-downgrade";
      frame.addEventListener("load", function () {
        frame.classList.add("is-ready");            // solo ora la mappa si mostra
        var facade = mapBox.querySelector(".mapfacade");
        if (facade) facade.remove();
      });
      mapBox.appendChild(frame);
      if (mapObserver) { mapObserver.disconnect(); mapObserver = null; }
      if (focusFrame) frame.focus();
    };

    if (mapBtn) mapBtn.addEventListener("click", function () { loadMap(true); });

    if ("IntersectionObserver" in window) {
      // Margine ampio: la mappa parte ~1,5 schermate prima di entrare in vista,
      // così quando la raggiungi è già caricata e non si vede il segnaposto.
      mapObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) { if (entry.isIntersecting) loadMap(false); });
      }, { rootMargin: "1500px 0px", threshold: 0 });
      mapObserver.observe(mapBox);
    } else {
      loadMap(false);   // browser senza IntersectionObserver: come prima
    }
  }

  /* ------------------------------------------------------------------ anno */
  var year = document.querySelector("[data-year]");
  if (year) year.textContent = String(new Date().getFullYear());

  /* ------------------------------------------------------------------ init */
  renderStatus();
  window.setInterval(renderStatus, 60000);
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) renderStatus();
  });
})();
