/* accelerer.js — Niger Beauté (version stable)
 * Ne modifie pas le code du site. Une seule ligne dans index.html,
 * juste après <head>, SANS defer :
 *   <script src="accelerer.js"></script>
 *
 * Ce que fait ce fichier :
 *  1. garde en cache 5 min la liste des produits (fichiers .json)
 *  2. charge en premier les 4 premières photos, les autres au fur et à mesure
 *  3. affiche "Chargement des produits…" tant qu'aucune photo produit n'est là
 * Il ne passe par AUCUN service extérieur et ne change jamais les adresses des photos.
 */
(function () {
  'use strict';

  var TTL_DONNEES = 5 * 60 * 1000;   // durée du cache des données
  var IMAGES_PRIORITAIRES = 4;       // photos chargées en premier
  var DELAI_AFFICHAGE = 400;         // le message n'apparaît qu'après 0,4 s
  var DELAI_LENT = 10000;            // texte "connexion lente" après 10 s
  var DELAI_RELOAD = 25000;          // bouton "Recharger" après 25 s

  /* 1) Cache des fichiers .json (si le site en utilise) */
  try {
    if (window.fetch && window.caches) {
      var _fetch = window.fetch.bind(window);
      window.fetch = function (input, init) {
        var url, method;
        try {
          url = typeof input === 'string' ? input : (input && input.url) || '';
          method = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();
        } catch (e) { return _fetch(input, init); }
        if (method !== 'GET' || !/\.json(\?|#|$)/i.test(url)) return _fetch(input, init);

        return caches.open('nb-donnees').catch(function () { return null; }).then(function (cache) {
          if (!cache) return _fetch(input, init);
          return cache.match(url).catch(function () { return null; }).then(function (hit) {
            if (hit) {
              var t = parseInt(hit.headers.get('x-nb-time') || '0', 10);
              if (Date.now() - t < TTL_DONNEES) return hit;
            }
            return _fetch(input, init).then(function (rep) {
              if (rep && rep.ok) {
                try {
                  var h = new Headers(rep.headers);
                  h.set('x-nb-time', String(Date.now()));
                  rep.clone().blob().then(function (b) {
                    return cache.put(url, new Response(b, { status: 200, headers: h }));
                  }).catch(function () {});
                } catch (e) {}
              }
              return rep;
            }).catch(function (e) {
              if (hit) return hit;   // réseau coupé : on affiche la dernière version connue
              throw e;
            });
          });
        });
      };
    }
  } catch (e) {}

  /* 2) Style (uniquement pour notre message et pour les photos en cours de chargement) */
  var css = document.createElement('style');
  css.textContent =
    '@keyframes nbPulse{0%,100%{opacity:.6}50%{opacity:1}}' +
    'img[data-nb-charge]{background:#ececec}' +
    '#nb-chargement{grid-column:1/-1;padding:16px;text-align:center;font-family:inherit}' +
    '#nb-chargement p{margin:0 0 12px;font-weight:600}' +
    '#nb-chargement button{padding:10px 18px;margin-bottom:12px;border:0;border-radius:8px;cursor:pointer;font:inherit}' +
    '.nb-grille{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px}' +
    '.nb-carte{height:190px;border-radius:12px;background:#ececec;animation:nbPulse 1.2s ease-in-out infinite}';
  (document.head || document.documentElement).appendChild(css);

  /* 3) Priorité de chargement des photos (sans toucher à leur adresse) */
  var compteur = 0;

  function optimiser(img) {
    if (img.__nb) return;
    var src = img.getAttribute('src');
    if (!src) return;                 // image vide (ex. zoom) : on n'y touche pas
    img.__nb = true;
    compteur++;
    try {
      img.decoding = 'async';
      if (compteur <= IMAGES_PRIORITAIRES) {
        img.loading = 'eager';
        if (compteur <= 2) img.setAttribute('fetchpriority', 'high');
      } else {
        img.loading = 'lazy';
      }
    } catch (e) {}
    if (!(img.complete && img.naturalWidth > 0)) {
      img.setAttribute('data-nb-charge', '1');
      var fini = function () { img.removeAttribute('data-nb-charge'); verifier(); };
      img.addEventListener('load', fini, { once: true });
      img.addEventListener('error', fini, { once: true });
    }
  }

  function scanner(racine) {
    if (!racine) return;
    if (racine.tagName === 'IMG') optimiser(racine);
    else if (racine.querySelectorAll) {
      var imgs = racine.querySelectorAll('img');
      for (var i = 0; i < imgs.length; i++) optimiser(imgs[i]);
    }
  }

  /* 4) Message "Chargement des produits…" */
  var boite = null, timers = [];

  function catalogue() { return document.getElementById('catalogue'); }

  function produitsPresents() {
    var c = catalogue();
    return !c || !!c.querySelector('img');   // pas de #catalogue : on n'affiche rien
  }

  function afficherChargement() {
    if (boite || produitsPresents()) return;
    boite = document.createElement('div');
    boite.id = 'nb-chargement';
    var cartes = '';
    for (var i = 0; i < 6; i++) cartes += '<div class="nb-carte"></div>';
    boite.innerHTML = '<p id="nb-msg">Chargement des produits… patientez un instant ⏳</p>' +
      '<div class="nb-grille">' + cartes + '</div>';
    catalogue().appendChild(boite);
    timers.push(setTimeout(function () {
      var m = document.getElementById('nb-msg');
      if (m) m.textContent = 'Connexion lente… les produits arrivent, merci de patienter.';
    }, DELAI_LENT));
    timers.push(setTimeout(function () {
      if (!boite) return;
      var b = document.createElement('button');
      b.textContent = 'Recharger la page';
      b.onclick = function () { location.reload(); };
      var g = boite.querySelector('.nb-grille');
      if (g) boite.insertBefore(b, g);
    }, DELAI_RELOAD));
  }

  function verifier() {
    if (boite && produitsPresents()) {
      for (var i = 0; i < timers.length; i++) clearTimeout(timers[i]);
      timers = [];
      if (boite.parentNode) boite.parentNode.removeChild(boite);
      boite = null;
    }
  }

  function demarrer() {
    scanner(document.body);
    setTimeout(afficherChargement, DELAI_AFFICHAGE);
    try {
      new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          var ajoutes = muts[i].addedNodes;
          for (var j = 0; j < ajoutes.length; j++) {
            var n = ajoutes[j];
            if (n.nodeType === 1 && n !== boite) scanner(n);
          }
        }
        verifier();
      }).observe(document.body, { childList: true, subtree: true });
    } catch (e) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer);
  else demarrer();
})();
          
