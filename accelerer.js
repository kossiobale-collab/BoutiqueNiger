/* accelerer.js — Niger Beauté
 * À ajouter dans <head>, SANS defer, avant les autres scripts :
 *   <script src="accelerer.js"></script>
 * Ne modifie pas le code existant du site.
 */
(function () {
  'use strict';

  var TTL_DONNEES = 10 * 60 * 1000;   // garde les données produits 10 min en cache
  var IMAGES_PRIORITAIRES = 4;        // nombre d'images chargées en premier
  var DELAI_LENT = 10000;             // message "connexion lente" après 10 s
  var DELAI_RELOAD = 25000;           // bouton "Recharger" après 25 s

  /* 1) Cache des fichiers .json (liste de produits) : affichage quasi
        instantané aux visites suivantes, repli sur le cache si le réseau échoue */
  try {
    if (window.fetch && window.caches) {
      var _fetch = window.fetch.bind(window);
      window.fetch = function (input, init) {
        var url = typeof input === 'string' ? input : (input && input.url) || '';
        var method = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();
        if (method !== 'GET' || !/\.json(\?|#|$)/i.test(url)) return _fetch(input, init);
        return caches.open('nb-donnees').then(function (cache) {
          return cache.match(url).then(function (hit) {
            if (hit) {
              var t = parseInt(hit.headers.get('x-nb-time') || '0', 10);
              if (Date.now() - t < TTL_DONNEES) return hit;
            }
            return _fetch(input, init).then(function (rep) {
              if (rep && rep.ok) {
                var h = new Headers(rep.headers);
                h.set('x-nb-time', String(Date.now()));
                rep.clone().blob().then(function (b) {
                  cache.put(url, new Response(b, { status: 200, headers: h }));
                }).catch(function () {});
              }
              return rep;
            }).catch(function (e) {
              if (hit) return hit;
              throw e;
            });
          });
        }).catch(function () { return _fetch(input, init); });
      };
    }
  } catch (e) {}

  /* 2) Style : fond animé sous les images + squelette de chargement */
  var css = document.createElement('style');
  css.textContent =
    '@keyframes nbPulse{0%,100%{opacity:.55}50%{opacity:1}}' +
    'img{background:#ececec}' +
    'img:not([data-nb-ok]){animation:nbPulse 1.2s ease-in-out infinite}' +
    '#nb-chargement{padding:16px;text-align:center;font-family:inherit}' +
    '#nb-chargement p{margin:0 0 12px;font-weight:600}' +
    '#nb-chargement button{padding:10px 18px;border:0;border-radius:8px;cursor:pointer;font:inherit}' +
    '.nb-grille{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px}' +
    '.nb-carte{height:190px;border-radius:12px;background:#ececec;animation:nbPulse 1.2s ease-in-out infinite}';
  (document.head || document.documentElement).appendChild(css);

  /* 3) Optimisation des images (y compris celles ajoutées plus tard par le site) */
  var compteur = 0;
  var origines = {};

  function optimiser(img) {
    if (img.__nb) return;
    img.__nb = true;
    compteur++;
    img.decoding = 'async';
    if (compteur <= IMAGES_PRIORITAIRES) {
      img.loading = 'eager';
      if (compteur <= 2) img.setAttribute('fetchpriority', 'high');
    } else {
      img.loading = 'lazy';
    }
    var fini = function () { img.setAttribute('data-nb-ok', '1'); verifier(); };
    if (img.complete && img.naturalWidth > 0) fini();
    else {
      img.addEventListener('load', fini, { once: true });
      img.addEventListener('error', fini, { once: true });
    }
    // preconnect vers un éventuel autre serveur d'images
    try {
      var o = new URL(img.currentSrc || img.src, location.href).origin;
      if (o !== location.origin && !origines[o]) {
        origines[o] = 1;
        var l = document.createElement('link');
        l.rel = 'preconnect'; l.href = o; l.crossOrigin = '';
        document.head.appendChild(l);
      }
    } catch (e) {}
  }

  function scanner(racine) {
    if (!racine) return;
    if (racine.tagName === 'IMG') optimiser(racine);
    else if (racine.querySelectorAll) {
      var imgs = racine.querySelectorAll('img');
      for (var i = 0; i < imgs.length; i++) optimiser(imgs[i]);
    }
  }

  /* 4) Message "chargement" tant qu'aucun produit n'est affiché */
  var boite = null, timers = [];

  function catalogue() {
    return document.getElementById('catalogue') || document.querySelector('main') || document.body;
  }

  function produitsPresents() {
    var c = catalogue();
    return !!(c && c.querySelector('img'));
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
      boite.insertBefore(b, boite.querySelector('.nb-grille'));
    }, DELAI_RELOAD));
  }

  function verifier() {
    if (boite && produitsPresents()) {
      timers.forEach(clearTimeout);
      if (boite.parentNode) boite.parentNode.removeChild(boite);
      boite = null;
    }
  }

  function demarrer() {
    scanner(document.body);
    afficherChargement();
    new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var ajoutes = muts[i].addedNodes;
        for (var j = 0; j < ajoutes.length; j++) {
          if (ajoutes[j].nodeType === 1 && ajoutes[j] !== boite) scanner(ajoutes[j]);
        }
      }
      verifier();
    }).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer);
  else demarrer();
})();
                     
