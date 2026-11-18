/*
 * Abertura da home — coreografia baseada na referência em vídeo.
 *
 * Linha do tempo (s):
 *   0.00  espaço negativo, contador em 000
 *   0.30  cartões (fotos reais dos produtos) empilham no centro, um a cada ~110ms,
 *         crescendo do centro com rotação/deslocamento próprios
 *   0.30  letras do logo sobem pela linha de base em ordem não linear
 *   0.30  contador 000 → 100 desacelerando até ~2.6s
 *   ~1.5  composição completa — permanece estável
 *   2.80  saída: contador cai, cartões recolhem do topo para a base
 *   3.25  letras do logo descem pela linha de base
 *   3.55  painel creme sobe revelando o site
 *   3.70  letras do hero sobem (bordas → centro), linha desenha, conteúdo entra
 *
 * Sem dependências: Web Animations API. Não altera o bundle do React.
 */
(function () {
  var root = document.documentElement;

  function abort() {
    root.classList.remove("ix-pending", "ix-running");
  }

  var path = location.pathname.replace(/\/+$/, "");
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (path !== "" || reduce || !root.animate) return abort();

  var RED = "#ff0001";
  var EASE = {
    expoOut: "cubic-bezier(0.16, 1, 0.3, 1)",
    cardIn: "cubic-bezier(0.22, 1, 0.36, 1)",
    expoIn: "cubic-bezier(0.7, 0, 0.84, 0)",
    inOut: "cubic-bezier(0.76, 0, 0.24, 1)",
    out: "cubic-bezier(0.33, 1, 0.68, 1)",
  };

  // Ordem de empilhamento da referência: chaveiro → camiseta escura → tote →
  // ... → camiseta branca no topo. Usa os produtos reais pelo nome (alt).
  var CARD_ORDER = [
    "Command + K",
    "Hello Week 002",
    "Neutral Grotesk",
    "Specimen No. HH01",
    "Red Dot Not Award",
    "Off by Design",
    "Gridlocked",
    "Kerned Confidence",
    "Whitespace Matters",
  ];
  // [rotação°, x%, y%, escala] por camada — profundidade irregular como na revista.
  var LAYOUT = [
    [10, -7, 1, 1.0],
    [-8, -4, 3, 1.02],
    [11, 4, -2, 0.98],
    [-6, 7, 3, 1.03],
    [7, -4, -3, 0.97],
    [-11, 5, 2, 1.01],
    [8, -6, 1, 1.0],
    [-4, 3, -2, 1.03],
    [-4, 0, 0, 1.0],
  ];

  var T = {
    start: 0.3,
    cardGap: 0.11,
    cardIn: 0.2,
    countEnd: 2.6,
    exit: 2.8,
    collapseGap: 0.085,
    wordOut: 3.25,
    panel: 3.55,
    panelDur: 0.6,
    hero: 3.7,
  };

  function ms(s) {
    return Math.round(s * 1000);
  }

  function anim(el, frames, start, dur, easing, fill) {
    return el.animate(frames, {
      delay: ms(start),
      duration: ms(dur),
      easing: easing,
      fill: fill || "both",
    });
  }

  function sized(src) {
    if (!/cdn\.shopify\.com/.test(src)) return src;
    return src + (src.indexOf("?") > -1 ? "&" : "?") + "width=640";
  }

  function waitFor(test, timeout) {
    return new Promise(function (resolve) {
      var t0 = performance.now();
      (function tick() {
        var v = test();
        if (v || performance.now() - t0 > timeout) return resolve(v);
        requestAnimationFrame(tick);
      })();
    });
  }

  function preload(urls, timeout) {
    var all = Promise.all(
      urls.map(function (u) {
        return new Promise(function (res) {
          var i = new Image();
          i.onload = i.onerror = res;
          i.src = u;
          if (i.decode) i.decode().then(res, res);
        });
      })
    );
    return Promise.race([all, new Promise(function (r) { setTimeout(r, timeout); })]);
  }

  function fontReady(timeout) {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.race([
      document.fonts.load('800 1em "Neue Haas"').catch(function () {}),
      new Promise(function (r) { setTimeout(r, timeout); }),
    ]);
  }

  // Envolve cada letra numa máscara de baseline. O espaço continua texto
  // normal para preservar a quebra de linha original.
  function splitLetters(text, target) {
    var glyphs = [];
    text.split(" ").forEach(function (part, w) {
      if (w > 0) target.appendChild(document.createTextNode(" "));
      if (!part) return;
      // Cada palavra fica inteira (nowrap) para não quebrar no meio.
      var word = document.createElement("span");
      word.style.whiteSpace = "nowrap";
      for (var i = 0; i < part.length; i++) {
        var m = document.createElement("span");
        m.className = "ix-mask";
        var g = document.createElement("span");
        g.className = "ix-glyph";
        g.textContent = part[i];
        m.appendChild(g);
        word.appendChild(m);
        glyphs.push(g);
      }
      target.appendChild(word);
    });
    return glyphs;
  }

  function run() {
    var hero = document.querySelector(".home-hero");
    var h1 = hero && hero.querySelector(".hero-logo-word");
    if (!h1) return abort();

    var imgs = Array.prototype.slice.call(
      document.querySelectorAll(".product-card img.product-image.primary")
    );
    var byAlt = {};
    imgs.forEach(function (i) {
      byAlt[i.alt] = i.getAttribute("src");
    });
    var sources = CARD_ORDER.map(function (n) { return byAlt[n]; }).filter(Boolean);
    // Se algum nome mudar, completa com os demais produtos reais.
    imgs.forEach(function (i) {
      var s = i.getAttribute("src");
      if (sources.length < LAYOUT.length && s && sources.indexOf(s) < 0) sources.push(s);
    });
    sources = sources.slice(0, LAYOUT.length).map(sized);
    if (sources.length < 3) return abort();

    var regEl = h1.querySelector(".hero-registered");
    var wordText = "";
    h1.childNodes.forEach(function (n) {
      if (n.nodeType === 3) wordText += n.nodeValue;
    });
    wordText = wordText.trim();

    Promise.all([preload(sources, 2500), fontReady(1500)]).then(function () {
      play(h1, regEl, wordText, sources);
    });
  }

  function play(h1, regEl, wordText, sources) {
    // ---------- cena de abertura ----------
    var overlay = document.createElement("div");
    overlay.className = "ix-overlay";
    overlay.setAttribute("aria-hidden", "true");
    var stage = document.createElement("div");
    stage.className = "ix-stage";
    overlay.appendChild(stage);

    var cards = sources.map(function (src, i) {
      var c = document.createElement("figure");
      c.className = "ix-card";
      c.style.zIndex = String(i + 1);
      var im = document.createElement("img");
      im.alt = "";
      im.src = src;
      c.appendChild(im);
      stage.appendChild(c);
      return c;
    });

    var word = document.createElement("div");
    word.className = "ix-word";
    var wordGlyphs = splitLetters(wordText.replace(/\s+/g, " "), word);
    var regMask = document.createElement("span");
    regMask.className = "ix-mask ix-reg";
    var regGlyph = document.createElement("span");
    regGlyph.className = "ix-glyph";
    regGlyph.textContent = "®";
    regMask.appendChild(regGlyph);
    word.appendChild(regMask);
    var counter = document.createElement("div");
    counter.className = "ix-counter";
    var counterTxt = document.createElement("span");
    counterTxt.textContent = "000";
    counter.appendChild(counterTxt);
    word.appendChild(counter);
    stage.appendChild(word);

    document.body.appendChild(overlay);
    root.classList.add("ix-running");
    root.classList.remove("ix-pending");

    // Cartões: crescem do centro da pilha (escala ~0.3), com rotação que se
    // assenta no ângulo final — cada um cobre o anterior.
    cards.forEach(function (c, i) {
      var L = LAYOUT[i];
      var end = "translate(-50%, -50%) translate(" + L[1] + "%, " + L[2] + "%) rotate(" + L[0] + "deg) scale(" + L[3] + ")";
      var from = "translate(-50%, -50%) translate(" + L[1] * 0.2 + "%, " + L[2] * 0.2 + "%) rotate(" + L[0] * 0.35 + "deg) scale(" + L[3] * 0.32 + ")";
      var t = T.start + i * T.cardGap;
      anim(c, [{ transform: from, opacity: 0 }, { transform: from, opacity: 1, offset: 0.08 }, { transform: end, opacity: 1 }], t, T.cardIn, EASE.cardIn);
    });

    // Letras do logo: ordem não linear (meio → pontas, primeira letra por último),
    // com intervalos irregulares como na referência.
    var n = wordGlyphs.length;
    var order = wordGlyphs
      .map(function (g, i) { return i; })
      .sort(function (a, b) {
        var ka = a === 0 ? 99 : Math.abs(a - (n - 1) * 0.55) + (a % 2) * 0.6;
        var kb = b === 0 ? 99 : Math.abs(b - (n - 1) * 0.55) + (b % 2) * 0.6;
        return ka - kb;
      });
    var letterTimes = [0.3, 0.38, 0.52, 0.7, 0.86, 1.0, 1.12, 1.24, 1.3, 1.36];
    var reveal = order.map(function (i) { return wordGlyphs[i]; });
    reveal.splice(Math.max(reveal.length - 1, 0), 0, regGlyph); // ® antes da primeira letra
    reveal.forEach(function (g, k) {
      var t = letterTimes[Math.min(k, letterTimes.length - 1)] + Math.max(0, k - letterTimes.length + 1) * 0.08;
      anim(g, [{ transform: "translateY(105%)" }, { transform: "translateY(0)" }], t, 0.32, EASE.expoOut);
    });

    // Contador 000 → 100, desacelerando.
    var c0 = performance.now() + ms(T.start);
    var cDur = ms(T.countEnd - T.start);
    (function count(now) {
      var p = Math.min(Math.max((now - c0) / cDur, 0), 1);
      var v = Math.round(100 * (1 - Math.pow(1 - p, 3)));
      counterTxt.textContent = ("00" + v).slice(-3);
      if (p < 1) requestAnimationFrame(count);
    })(performance.now());

    // ---------- saída ----------
    anim(counterTxt, [{ transform: "translateY(0)", opacity: 1 }, { transform: "translateY(60%)", opacity: 0 }], T.exit, 0.22, EASE.expoIn, "forwards");

    // Recolhe do topo para a base, cada vez mais rápido; o último encolhe até sumir.
    cards.slice().reverse().forEach(function (c, k) {
      var i = cards.length - 1 - k;
      var L = LAYOUT[i];
      var last = i === 0;
      var end = "translate(-50%, -50%) translate(" + L[1] + "%, " + L[2] + "%) rotate(" + L[0] + "deg) scale(" + L[3] + ")";
      var to = "translate(-50%, -50%) translate(" + L[1] * 0.2 + "%, " + L[2] * 0.2 + "%) rotate(" + L[0] * 0.6 + "deg) scale(" + (last ? 0.02 : 0.3) + ")";
      anim(c, [{ transform: end, opacity: 1 }, { transform: to, opacity: 1, offset: 0.92 }, { transform: to, opacity: 0 }],
        T.exit + k * T.collapseGap, last ? 0.32 : 0.2, EASE.expoIn, "forwards");
    });

    // Letras descem pela baseline, do centro para as pontas.
    wordGlyphs.concat([regGlyph]).map(function (g, i, arr) {
      return { g: g, d: Math.abs(i - (arr.length - 1) / 2) };
    }).sort(function (a, b) { return a.d - b.d; }).forEach(function (o, k) {
      anim(o.g, [{ transform: "translateY(0)" }, { transform: "translateY(105%)" }], T.wordOut + k * 0.035, 0.34, EASE.expoIn, "forwards");
    });

    // Painel creme sobe e revela o site.
    var lift = anim(overlay, [{ clipPath: "inset(0 0 0% 0)" }, { clipPath: "inset(0 0 100% 0)" }], T.panel, T.panelDur, EASE.inOut, "forwards");

    // ---------- entrada do hero ----------
    revealHero(h1, regEl, wordText);

    lift.finished.then(function () {
      overlay.remove();
      root.classList.remove("ix-running");
    });
  }

  function revealHero(h1, regEl, wordText) {
    var hero = h1.closest(".home-hero");
    var anims = [];

    // Troca o texto do h1 por letras mascaradas, mantendo o ® do React.
    var original = Array.prototype.filter.call(h1.childNodes, function (n) { return n.nodeType === 3; });
    var frag = document.createElement("span");
    frag.style.display = "contents";
    var glyphs = splitLetters(wordText, frag);
    original.forEach(function (n) { n.remove(); });
    h1.insertBefore(frag, regEl || null);

    // Pontas primeiro, centro por último (como O → U → T…F na referência).
    var w = h1.getBoundingClientRect();
    var cx = w.left + w.width / 2;
    var items = glyphs.map(function (g) {
      var r = g.getBoundingClientRect();
      return { g: g, d: Math.abs(r.left + r.width / 2 - cx) / (w.width / 2), x: r.left };
    }).sort(function (a, b) { return b.d - a.d || a.x - b.x; });
    items.forEach(function (o, k) {
      anims.push(anim(o.g, [{ transform: "translateY(102%)" }, { transform: "translateY(0)" }], T.hero + k * 0.055, 0.8, EASE.expoOut));
    });
    if (regEl) anims.push(anim(regEl, [{ opacity: 0, transform: "translateY(40%)" }, { opacity: 1, transform: "translateY(0)" }], T.hero + 0.5, 0.6, EASE.expoOut));

    var line = hero.querySelector(".hero-line");
    if (line) anims.push(anim(line, [{ transform: "scaleX(0)", transformOrigin: "0 50%" }, { transform: "scaleX(1)", transformOrigin: "0 50%" }], T.hero + 0.15, 1.0, EASE.expoOut));

    var bits = hero.querySelectorAll(".hero-caption, .hero-why h2, .hero-why p, .hero-actions a, .hero-year");
    Array.prototype.forEach.call(bits, function (el, k) {
      anims.push(anim(el, [{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "translateY(0)" }], T.hero + 0.35 + k * 0.05, 0.7, EASE.out));
    });

    var header = document.querySelector(".site-header");
    if (header) anims.push(anim(header, [{ opacity: 0 }, { opacity: 1 }], T.hero + 0.6, 0.6, EASE.out));

    var wraps = document.querySelectorAll(".catalog-first .product-image-wrap");
    Array.prototype.forEach.call(wraps, function (el, k) {
      anims.push(anim(el, [{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)" }], T.hero + 0.4 + k * 0.1, 0.9, EASE.inOut));
      var img = el.querySelector("img.primary");
      if (img) anims.push(anim(img, [{ transform: "scale(1.12)" }, { transform: "scale(1)" }], T.hero + 0.4 + k * 0.1, 1.3, EASE.expoOut));
    });
    var info = document.querySelectorAll(".catalog-first .product-info, .catalog-first .product-category");
    Array.prototype.forEach.call(info, function (el, k) {
      anims.push(anim(el, [{ opacity: 0 }, { opacity: 1 }], T.hero + 0.8 + k * 0.04, 0.5, EASE.out));
    });

    // As letras mascaradas ficam no lugar (devolver o texto original causaria
    // um pequeno salto de kerning); o React só mexe nesse nó se o texto mudar.
    return Promise.all(anims.map(function (a) { return a.finished; })).then(function () {
      anims.forEach(function (a) { a.cancel(); });
    }, function () {});
  }

  // Espera o React montar o hero e os cards antes de começar.
  waitFor(function () {
    return document.querySelector(".home-hero .hero-logo-word") &&
      document.querySelectorAll(".product-card img.product-image.primary").length >= 4;
  }, 4000).then(function (ok) {
    if (!ok) return abort();
    try { run(); } catch (e) { abort(); }
  });
})();
