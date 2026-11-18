/*
 * DACION — cabeçalho legível sobre a foto do topo.
 *
 * Enquanto o cabeçalho (fixo) está em cima da foto da página inicial, a
 * página ganha a classe "header-on-photo" e o cabeçalho usa a mesma cor
 * clara do nome DACION (ver dacion-theme.css). Ao rolar para fora da foto,
 * ou em outras páginas, volta à cor normal do tema.
 */
(function () {
  var root = document.documentElement;
  var queued = false;

  function photoBottom() {
    var hero = document.querySelector(".home-hero");
    if (!hero) return 0;
    var r = hero.getBoundingClientRect();
    var cs = getComputedStyle(hero, "::before");
    var h = parseFloat(cs.height) || 0;
    var top = parseFloat(cs.marginTop) || 0;
    // só a parte ainda opaca da foto conta (embaixo ela se dissolve no fundo)
    var solid = parseFloat(getComputedStyle(hero).getPropertyValue("--hero-solid")) || 1;
    return r.top + top + h * solid; // fim da parte opaca da foto, em relação à janela
  }

  function update() {
    queued = false;
    var header = document.querySelector(".site-header .header-inner");
    var headerBottom = header ? header.getBoundingClientRect().bottom : 0;
    root.classList.toggle("header-on-photo", photoBottom() > headerBottom * 0.6);
  }

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  }

  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  window.addEventListener("popstate", schedule);
  // O site troca de página sem recarregar: observa quando o conteúdo muda.
  function watch() {
    var app = document.getElementById("root");
    if (!app) return;
    new MutationObserver(schedule).observe(app, { childList: true, subtree: true });
    schedule();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", watch);
  else watch();
})();
