/* ==========================================================================
   CARZECITO — Asistente Virtual CARZE Contratistas Generales S.A.C.
   FASE 1: Cascarón Visual y Alertas Locales
   --------------------------------------------------------------------------
   Uso: agregar en cada página del ERP, justo antes de </body>:
   <script src="carzecito.js" defer></script>

   Requiere: img/carzecito.png (avatar del personaje) en la misma carpeta
   que las páginas HTML.

   No depende de ninguna librería externa. No modifica el HTML existente
   de la página: se auto-inyecta todo (CSS + estructura) vía JavaScript.
   ========================================================================== */

(function () {
  'use strict';

  /* ---------------------------------------------------------------------
     0. CONFIG
  --------------------------------------------------------------------- */
  var CONFIG = {
    avatarSrc: 'img/carzecito.png',
    storageKey: 'carzecito_alertas',      // clave compartida entre páginas (localStorage)
    nombreVar: 'carze_nombre',            // sessionStorage ya usado por el ERP
    // Páginas cuyo DOM ya calcula badges de "urgentes" que podemos leer.
    // { idBadge: etiqueta a mostrar en el resumen }
    badgesVencimientos: {
      badgeFacturas:  'Facturas',
      badgePrestamos: 'Préstamos/Cuotas',
      badgeImpuestos: 'Impuestos',
    }
  };

  var SALUDOS = [
    '¡Buenas, {nombre}! ¿Todo listo para avanzar obra hoy? 🦺',
    '¡{nombre}! Aquí ando, atento a los frentes de trabajo. 👷',
    'Hola {nombre}, revisando que nada se venza en el camino. 🔧',
    '¡{nombre}! Casco puesto y listo para ayudarte. ⚡',
    'Buen día {nombre}, vamos a mantener todo en orden hoy. 🏗️',
  ];

  var SIN_ALERTAS = [
    'Por ahora todo está en orden por acá. ✅',
    'No detecto pendientes urgentes en este momento. 👍',
    'Todo tranquilo, sigamos avanzando. 🟢',
  ];

  /* ---------------------------------------------------------------------
     1. ESTILOS (inyectados una sola vez)
  --------------------------------------------------------------------- */
  var css = `
    #carzecito-root{position:fixed;bottom:22px;right:22px;z-index:99999;font-family:'Plus Jakarta Sans','Segoe UI',sans-serif}
    #carzecito-fab{width:66px;height:66px;border-radius:50%;background:linear-gradient(135deg,#1a3a6b,#1e40af);border:3px solid #f97316;cursor:pointer;box-shadow:0 6px 20px rgba(10,15,30,.35);display:flex;align-items:center;justify-content:center;position:relative;transition:transform .2s ease,box-shadow .2s ease;padding:0;overflow:visible}
    #carzecito-fab:hover{transform:translateY(-3px) scale(1.04);box-shadow:0 10px 26px rgba(10,15,30,.45)}
    #carzecito-fab img{width:100%;height:100%;border-radius:50%;object-fit:cover;object-position:top center}
    #carzecito-fab.bounce{animation:carzecito-bounce 1.8s ease-in-out infinite}
    @keyframes carzecito-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
    #carzecito-dot{position:absolute;top:-2px;right:-2px;width:18px;height:18px;background:#dc2626;border:2px solid #fff;border-radius:50%;display:none;align-items:center;justify-content:center;font-size:.6rem;font-weight:800;color:#fff}
    #carzecito-dot.show{display:flex}
    #carzecito-bubble{position:absolute;bottom:78px;right:0;background:#fff;border-radius:14px 14px 4px 14px;padding:10px 14px;box-shadow:0 8px 24px rgba(10,15,30,.18);font-size:.78rem;color:#1e293b;font-weight:600;max-width:230px;opacity:0;transform:translateY(8px);transition:all .25s ease;pointer-events:none}
    #carzecito-bubble.show{opacity:1;transform:translateY(0)}
    #carzecito-panel{position:absolute;bottom:78px;right:0;width:320px;max-height:440px;background:#fff;border-radius:16px;box-shadow:0 16px 48px rgba(10,15,30,.28);display:none;flex-direction:column;overflow:hidden;border:1px solid #e2e8f0}
    #carzecito-panel.open{display:flex}
    #carzecito-head{background:linear-gradient(135deg,#1a3a6b,#1e40af);padding:14px 16px;display:flex;align-items:center;gap:10px;color:#fff}
    #carzecito-head img{width:38px;height:38px;border-radius:50%;object-fit:cover;object-position:top center;border:2px solid #f97316}
    #carzecito-head .cz-title{font-family:'Syne',sans-serif;font-weight:800;font-size:.95rem;line-height:1.1}
    #carzecito-head .cz-sub{font-size:.68rem;color:rgba(255,255,255,.6);text-transform:uppercase;letter-spacing:.06em}
    #carzecito-close{margin-left:auto;background:rgba(255,255,255,.12);border:none;color:#fff;width:26px;height:26px;border-radius:50%;cursor:pointer;font-size:.85rem;display:flex;align-items:center;justify-content:center}
    #carzecito-close:hover{background:rgba(255,255,255,.22)}
    #carzecito-body{padding:14px;overflow-y:auto;flex:1;background:#f8fafc}
    .cz-msg{background:#fff;border:1px solid #e2e8f0;border-radius:12px 12px 12px 4px;padding:10px 12px;font-size:.8rem;color:#334155;margin-bottom:10px;line-height:1.4}
    .cz-msg b{color:#1a3a6b}
    .cz-shortcuts{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}
    .cz-chip{background:#fff;border:1.5px solid #f97316;color:#ea580c;font-size:.72rem;font-weight:700;padding:7px 11px;border-radius:20px;cursor:pointer;transition:all .15s}
    .cz-chip:hover{background:#f97316;color:#fff}
    #carzecito-foot{padding:10px 14px;font-size:.62rem;color:#94a3b8;text-align:center;border-top:1px solid #e2e8f0;background:#fff}
  `;
  var styleTag = document.createElement('style');
  styleTag.id = 'carzecito-styles';
  styleTag.textContent = css;
  document.head.appendChild(styleTag);

  /* ---------------------------------------------------------------------
     2. ESTRUCTURA HTML DEL WIDGET
  --------------------------------------------------------------------- */
  var root = document.createElement('div');
  root.id = 'carzecito-root';
  root.innerHTML = `
    <div id="carzecito-bubble"></div>
    <div id="carzecito-panel">
      <div id="carzecito-head">
        <img src="${CONFIG.avatarSrc}" alt="CARZECITO">
        <div>
          <div class="cz-title">CARZECITO</div>
          <div class="cz-sub">Asistente CARZE</div>
        </div>
        <button id="carzecito-close" title="Cerrar">✕</button>
      </div>
      <div id="carzecito-body"></div>
      <div id="carzecito-foot">Fase 1 · Cascarón visual y alertas locales</div>
    </div>
    <button id="carzecito-fab" title="CARZECITO">
      <img src="${CONFIG.avatarSrc}" alt="CARZECITO">
      <span id="carzecito-dot"></span>
    </button>
  `;
  document.body.appendChild(root);

  var fab     = document.getElementById('carzecito-fab');
  var panel   = document.getElementById('carzecito-panel');
  var bubble  = document.getElementById('carzecito-bubble');
  var body    = document.getElementById('carzecito-body');
  var dot     = document.getElementById('carzecito-dot');
  var closeBtn= document.getElementById('carzecito-close');

  /* ---------------------------------------------------------------------
     3. HELPERS
  --------------------------------------------------------------------- */
  function nombreUsuario() {
    try {
      var n = sessionStorage.getItem(CONFIG.nombreVar);
      return n ? n.split(' ')[0] : 'Robert';
    } catch (e) { return 'Robert'; }
  }

  function randomDe(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function addMsg(html) {
    var div = document.createElement('div');
    div.className = 'cz-msg';
    div.innerHTML = html;
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
  }

  function leerAlertasGuardadas() {
    try {
      return JSON.parse(localStorage.getItem(CONFIG.storageKey) || '{}');
    } catch (e) { return {}; }
  }

  function guardarAlertas(obj) {
    try {
      localStorage.setItem(CONFIG.storageKey, JSON.stringify(obj));
    } catch (e) {}
  }

  /* ---------------------------------------------------------------------
     4. LECTURA LOCAL DE ALERTAS
     - Si estamos en vencimientos.html: lee los badges ya calculados por
       esa página y guarda el resumen en localStorage para otras páginas.
     - En cualquier otra página: lee lo último guardado (si existe).
  --------------------------------------------------------------------- */
  function escanearVencimientos() {
    var resumen = { total: 0, detalle: [], fecha: new Date().toISOString() };
    var huboLectura = false;

    Object.keys(CONFIG.badgesVencimientos).forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      huboLectura = true;
      var txt = el.textContent || '';
      var match = txt.match(/(\d+)/);
      var n = match ? parseInt(match[1], 10) : 0;
      if (txt.indexOf('🔴') !== -1 && n > 0) {
        resumen.total += n;
        resumen.detalle.push({ label: CONFIG.badgesVencimientos[id], count: n });
      }
    });

    if (huboLectura) {
      guardarAlertas(resumen);
      return resumen;
    }
    return null;
  }

  function obtenerResumenAlertas() {
    // Si esta página tiene los badges (vencimientos.html), léelos en vivo.
    var enVivo = escanearVencimientos();
    if (enVivo) return enVivo;
    // Si no, usa lo último que se haya guardado en cualquier visita anterior.
    return leerAlertasGuardadas();
  }

  /* ---------------------------------------------------------------------
     5. RENDER DEL PANEL
  --------------------------------------------------------------------- */
  function renderPanel() {
    body.innerHTML = '';
    var nombre = nombreUsuario();
    addMsg('¡Hola, <b>' + nombre + '</b>! Soy CARZECITO 🦺, tu asistente en el sistema.');

    var resumen = obtenerResumenAlertas();
    if (resumen && resumen.total > 0) {
      var detalleTxt = resumen.detalle.map(function (d) {
        return '• ' + d.label + ': <b>' + d.count + '</b>';
      }).join('<br>');
      addMsg('🔴 Encontré <b>' + resumen.total + '</b> pendiente' + (resumen.total > 1 ? 's' : '') + ' urgente' + (resumen.total > 1 ? 's' : '') + ':<br>' + detalleTxt);
    } else {
      addMsg(randomDe(SIN_ALERTAS));
    }

    var shortcuts = document.createElement('div');
    shortcuts.className = 'cz-shortcuts';
    shortcuts.innerHTML = `
      <div class="cz-chip" data-go="vencimientos.html">🚨 Ver vencimientos</div>
      <div class="cz-chip" data-go="caja_diaria.html">💵 Ver caja diaria</div>
      <div class="cz-chip" data-go="cotizaciones.html">📋 Ver cotizaciones</div>
    `;
    body.appendChild(shortcuts);
    body.querySelectorAll('.cz-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        window.location.href = chip.getAttribute('data-go');
      });
    });
  }

  /* ---------------------------------------------------------------------
     6. INDICADOR VISUAL EN EL BOTÓN (punto rojo si hay urgentes)
  --------------------------------------------------------------------- */
  function actualizarIndicador() {
    var resumen = obtenerResumenAlertas();
    if (resumen && resumen.total > 0) {
      dot.textContent = resumen.total > 9 ? '9+' : String(resumen.total);
      dot.classList.add('show');
      fab.classList.add('bounce');
    } else {
      dot.classList.remove('show');
      fab.classList.remove('bounce');
    }
  }

  /* ---------------------------------------------------------------------
     7. EVENTOS
  --------------------------------------------------------------------- */
  fab.addEventListener('click', function () {
    bubble.classList.remove('show');
    var isOpen = panel.classList.toggle('open');
    if (isOpen) renderPanel();
  });
  closeBtn.addEventListener('click', function () {
    panel.classList.remove('open');
  });
  document.addEventListener('click', function (e) {
    if (!root.contains(e.target)) panel.classList.remove('open');
  });

  /* ---------------------------------------------------------------------
     8. INICIO
     Se espera un momento a que las tablas/badges de Firestore terminen
     de renderizar antes de escanear la página.
  --------------------------------------------------------------------- */
  function init() {
    bubble.textContent = randomDe(SALUDOS).replace('{nombre}', nombreUsuario());
    setTimeout(function () {
      bubble.classList.add('show');
      setTimeout(function () { bubble.classList.remove('show'); }, 5000);
    }, 900);

    // Primer escaneo rápido (por si la data ya estaba en caché)
    actualizarIndicador();
    // Segundo escaneo tras dar tiempo a Firestore a responder
    setTimeout(actualizarIndicador, 2500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
