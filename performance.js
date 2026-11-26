
/*
 * NIGER BEAUTE - OPTIMISATION
 */

(() => {
  "use strict";

  if (window.__nigerBeautePerformanceLoaded) return;
  window.__nigerBeautePerformanceLoaded = true;

  function optimizeImages() {
    const images = document.querySelectorAll("img");

    images.forEach((img, index) => {
      img.decoding = "async";

      // Les deux premières images restent prioritaires.
      // Les suivantes se chargent progressivement.
      if (index >= 2 && !img.hasAttribute("loading")) {
        img.loading = "lazy";
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", optimizeImages);
  } else {
    optimizeImages();
  }

  // Prend aussi en compte les images ajoutées dynamiquement.
  const observer = new MutationObserver(() => {
    optimizeImages();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
})();
