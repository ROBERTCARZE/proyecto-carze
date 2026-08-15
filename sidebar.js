/* ==========================================================================
   SIDEBAR.JS — Menú lateral centralizado
   CARZE Contratistas Generales S.A.C.
   --------------------------------------------------------------------------
   Uso: agregar en cada página del ERP, justo después de <body>:
   <script src="sidebar.js"></script>

   Qué hace:
   - Inyecta el CSS del sidebar (ya no vive en cada HTML).
   - Inyecta el <aside class="sidebar"> con los módulos agrupados por categoría
     (encabezados fijos, sin numeración, sin colapsar — estructura plana).
   - Detecta automáticamente en qué página está el usuario y marca ese link
     como "active" (comparando contra window.location.pathname).
   - Inyecta el favicon (ícono de pestaña) en las 14 páginas.
   - RESPONSIVE: en tablet/celular convierte el sidebar en un cajón deslizante
     con botón hamburguesa, y agrega reglas para que las cuadrículas de
     tarjetas (KPIs, gráficos, resúmenes) se acomoden solas a 1-2 columnas.
     Aplica automáticamente a cualquier página que use las clases ya
     estandarizadas (.kpi-row, .chart-row, .table-wrap, etc.), sin tocar
     el CSS propio de cada módulo.

   PARA AGREGAR UN MÓDULO NUEVO: solo agrega una línea en NAV_CONFIG más abajo.
   No hay que tocar ningún archivo .html nunca más.

   PARA CAMBIAR DISEÑO/COLOR/ORDEN DEL SIDEBAR: se edita solo este archivo,
   y el cambio se refleja en las 13 páginas al instante.
   ========================================================================== */

(function () {
  'use strict';

  /* ---------------------------------------------------------------------
     1. CONFIGURACIÓN DE NAVEGACIÓN
     Agrupada por categoría. Para agregar un módulo nuevo, copia una línea
     dentro del grupo que corresponda (o crea un grupo nuevo).
  --------------------------------------------------------------------- */
  var NAV_CONFIG = [
    {
      categoria: null, // sin encabezado — queda "suelto" arriba del todo
      items: [
        { href: 'dashboard.html', label: 'Dashboard', icon: '📊' }
      ]
    },
    {
      categoria: 'Ciclo Comercial',
      items: [
        { href: 'cotizaciones.html', label: 'Cotizaciones', icon: '📋' },
        { href: 'certificados.html', label: 'Certificados', icon: '🏅' },
        { href: 'presupuesto.html',  label: 'Presupuesto',  icon: '📈' }
      ]
    },
    {
      categoria: 'Gestión Financiera',
      items: [
        { href: 'facturas.html',     label: 'Facturas',              icon: '🧾' },
        { href: 'finanzas.html',     label: 'Finanzas',              icon: '💰' },
        { href: 'caja_diaria.html',  label: 'Caja Diaria',           icon: '💵' },
        { href: 'flujo_caja.html',   label: 'Flujo de Caja',         icon: '💹' },
        { href: 'pronto_pago.html',  label: 'Pronto Pago',           icon: '⏰' },
        { href: 'impuestos.html',    label: 'Impuestos',             icon: '🏛️' }
      ]
    },
    {
      categoria: 'Operaciones y Control',
      items: [
        { href: 'personal.html',     label: 'Personal',              icon: '👥' },
        { href: 'eventos.html',      label: 'Eventos',                icon: '📅' },
        { href: 'vencimientos.html', label: 'Vencimiento y Alertas', icon: '🚨' },
        { href: 'seguimiento.html',  label: 'Seguimiento',           icon: '🔍' }
      ]
    },
    {
      categoria: 'Sistema',
      items: [
        { href: 'respaldo.html', label: 'Respaldo de Datos', icon: '🗄️' }
      ]
    }
  ];

  // Expuesto para que otros scripts (ej. carzecito.js) reutilicen el mismo
  // mapa de páginas sin duplicarlo. No tocar el nombre de esta variable.
  window.CARZE_NAV = NAV_CONFIG;

  var LOGO_SRC = 'img/logo_carze_1.png';
  var LOGO_ALT = 'CARZE';
  var LOGO_SUB = 'Contratistas Generales';

  /* ---------------------------------------------------------------------
     2. CSS DEL SIDEBAR (antes duplicado en cada HTML, ahora vive aquí)
  --------------------------------------------------------------------- */
  var CSS = '' +
    '@import url("https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap");' +
    '.sidebar{font-family:"Plus Jakarta Sans",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif !important;position:fixed;top:0;left:0;bottom:0;width:var(--sw);background:var(--white);border-right:1px solid var(--border);display:flex;flex-direction:column;z-index:50;overflow-y:auto;scrollbar-width:none}' +
    '.sidebar::-webkit-scrollbar{display:none}' +
    '.sidebar-logo{padding:20px 20px 16px;border-bottom:1px solid var(--border);display:flex;flex-direction:column;align-items:center;gap:4px}' +
    '.sidebar-logo img{width:115px}' +
    '.sidebar-logo span{font-family:"Plus Jakarta Sans",sans-serif !important;font-size:.58rem;color:var(--muted);letter-spacing:.12em;text-transform:uppercase;font-weight:600}' +
    '.sidebar-nav{padding:12px 10px;flex:1}' +
    '.nav-item{font-family:"Plus Jakarta Sans",sans-serif !important;display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:9px;cursor:pointer;text-decoration:none;color:var(--muted);font-size:.76rem;font-weight:600;letter-spacing:.04em;text-transform:uppercase;transition:all .18s;margin-bottom:2px}' +
    '.nav-item:hover{background:var(--light);color:var(--txt)}' +
    '.nav-item.active{background:linear-gradient(90deg,rgba(249,115,22,.1),rgba(249,115,22,.04));color:var(--naranja);border-left:3px solid var(--naranja);padding-left:9px}' +
    '.nav-icon{font-size:1rem;flex-shrink:0;width:20px;text-align:center}' +
    '.nav-cat{padding:14px 12px 6px}' +
    '.nav-cat:first-child{padding-top:4px}' +
    '.nav-cat-label{font-family:"Plus Jakarta Sans",sans-serif !important;font-size:.62rem;font-weight:800;color:#94a3b8;letter-spacing:.09em;text-transform:uppercase}' +

    /* HERRAMIENTAS (ojo privacidad / modo nocturno) */
    '.sidebar-footer{display:flex;gap:8px;padding:14px 16px;border-top:1px solid var(--border);flex-shrink:0}' +
    '.sidebar-tool-btn{font-family:"Plus Jakarta Sans",sans-serif !important;flex:1;display:flex;align-items:center;justify-content:center;padding:9px 0;border-radius:9px;border:1.5px solid var(--border);background:var(--light);color:var(--muted);cursor:pointer;transition:all .18s}' +
    '.sidebar-tool-btn:hover{border-color:var(--naranja);color:var(--naranja)}' +
    '.sidebar-tool-btn.crz-tool-active{background:rgba(249,115,22,.12);border-color:var(--naranja);color:var(--naranja)}' +
    '.sidebar-tool-btn svg{width:16px;height:16px;pointer-events:none}' +

    /* MODO NOCTURNO — se activa con :root[data-theme="dark"], que tiene mayor
       especificidad que el :root{...} de cada módulo, así que sobreescribe sus
       variables (--bg, --white, --txt, etc.) sin tocar ningún HTML */
    ':root[data-theme="dark"]{--bg:#0f172a;--white:#1e293b;--light:#16213a;--border:#334155;--txt:#e2e8f0;--muted:#94a3b8;--verde2:#14532d;--rojo2:#450a0a;--amarillo2:#422006}' +
    ':root[data-theme="dark"] .doc-si{background:#14532d;color:#86efac;border-color:#166534}' +
    ':root[data-theme="dark"] .doc-no{background:#1e293b;color:#64748b;border-color:#334155}' +
    ':root[data-theme="dark"] img.mascota,:root[data-theme="dark"] .sidebar-logo img{filter:brightness(.95)}' +

    /* RESPONSIVE */
    '/* Botón hamburguesa (oculto en escritorio) */' +
    '.crz-menu-toggle{display:none;position:fixed;top:14px;left:14px;z-index:80;width:42px;height:42px;border-radius:10px;background:var(--naranja,#f97316);color:#fff;border:none;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(0,0,0,.22);cursor:pointer}' +
    '.crz-menu-toggle svg{width:20px;height:20px;pointer-events:none}' +

    '/* Fondo oscuro detrás del sidebar cuando está abierto en móvil */' +
    '.crz-overlay-mobile{display:none;position:fixed;inset:0;background:rgba(15,23,42,.5);z-index:65;opacity:0;pointer-events:none;transition:opacity .25s}' +
    '.crz-overlay-mobile.crz-open{opacity:1;pointer-events:all}' +

    '/* Tablet y celular: sidebar pasa a ser un cajón (drawer) que se desliza */' +
    '@media (max-width:980px){' +
      '.crz-menu-toggle{display:flex}' +
      '.sidebar{transform:translateX(-100%);transition:transform .28s ease;z-index:70;box-shadow:0 0 30px rgba(0,0,0,.28)}' +
      '.sidebar.crz-open{transform:translateX(0)}' +
      '.main{margin-left:0 !important}' +
      '.crz-overlay-mobile{display:block}' +
      '.kpi-row,.chart-row,.modulos-row,.atencion-grid,.bottom-row,.semaforo-row,.fgrid3,.resumen-presu{grid-template-columns:repeat(2,1fr) !important}' +
    '}' +

    '/* Celular: todo a una sola columna, topbar y modales se adaptan */' +
    '@media (max-width:620px){' +
      '.kpi-row,.chart-row,.modulos-row,.atencion-grid,.bottom-row,.semaforo-row,.fgrid3,.resumen-presu{grid-template-columns:1fr !important}' +
      '.topbar{flex-direction:column;align-items:flex-start !important;gap:8px;padding:12px 16px !important}' +
      '.topbar-right{width:100%;justify-content:space-between !important}' +
      '.fecha-badge{display:none !important}' +
      '.content{padding:14px 12px !important}' +
      '.period-bar{padding:8px 12px !important;gap:6px !important}' +
      '.modal{width:96% !important;max-height:94vh !important}' +
      'table{font-size:.68rem !important}' +
      '.topbar-left h1{font-size:1.05rem !important}' +
      '.main{height:100dvh !important}' +
    '}' +

    '.table-scroll{-webkit-overflow-scrolling:touch}';

  /* ---------------------------------------------------------------------
     3. UTILIDADES
  --------------------------------------------------------------------- */
  function paginaActual() {
    var partes = window.location.pathname.split('/');
    return (partes[partes.length - 1] || 'dashboard.html').toLowerCase();
  }

  /* ---------------------------------------------------------------------
     3.1 PRIVACIDAD — oculta valores sensibles (KPIs) en cualquier módulo.
     Para que un valor se pueda ocultar, su elemento debe tener la clase
     "kpi-value" o el atributo "data-kpi" (agrégalo al elemento que muestra
     el número/monto en cada módulo; el contenedor .kpi-row no hace falta
     tocarlo, ya se usa solo como referencia de layout).
  --------------------------------------------------------------------- */
  var PRIVACY_KEY = 'carze_privacy_on';
  var KPI_SELECTOR = '[data-kpi], .kpi-value';
  var privacyMaskingLock = false;

  function aplicarPrivacidad(on) {
    privacyMaskingLock = true;
    document.querySelectorAll(KPI_SELECTOR).forEach(function (el) {
      if (on) {
        if (el.dataset.kpiOriginal === undefined) el.dataset.kpiOriginal = el.textContent;
        el.textContent = '••••';
      } else if (el.dataset.kpiOriginal !== undefined) {
        el.textContent = el.dataset.kpiOriginal;
        delete el.dataset.kpiOriginal;
      }
    });
    document.documentElement.classList.toggle('crz-privacy-on', on);
    privacyMaskingLock = false;
  }

  function setPrivacidad(on) {
    aplicarPrivacidad(on);
    localStorage.setItem(PRIVACY_KEY, on ? '1' : '0');
    var btn = document.getElementById('crzPrivacyToggle');
    if (btn) {
      btn.innerHTML = on ? ICON_EYE_OFF : ICON_EYE_OPEN;
      btn.classList.toggle('crz-tool-active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.title = on ? 'Mostrar KPIs' : 'Ocultar KPIs';
    }
  }

  // Vuelve a enmascarar KPIs que se rendericen después (ej. datos que llegan
  // de Firestore tras el primer render), sin entrar en loop con sus propios
  // cambios (privacyMaskingLock).
  var kpiObserver = new MutationObserver(function () {
    if (privacyMaskingLock) return;
    if (document.documentElement.classList.contains('crz-privacy-on')) {
      aplicarPrivacidad(true);
    }
  });

  /* ---------------------------------------------------------------------
     3.2 MODO NOCTURNO — sigue el sistema operativo por defecto; si el
     usuario lo cambia manualmente, esa preferencia se guarda y ya no sigue
     al sistema hasta que la vuelva a cambiar.
  --------------------------------------------------------------------- */
  var THEME_KEY = 'carze_theme';

  function prefiereOscuroSistema() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function temaInicial() {
    var guardado = localStorage.getItem(THEME_KEY);
    if (guardado === 'light' || guardado === 'dark') return guardado;
    return prefiereOscuroSistema() ? 'dark' : 'light';
  }

  function aplicarTema(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    var btn = document.getElementById('crzThemeToggle');
    if (btn) {
      btn.innerHTML = theme === 'dark' ? ICON_SUN : ICON_MOON;
      btn.classList.toggle('crz-tool-active', theme === 'dark');
      btn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
      btn.title = theme === 'dark' ? 'Modo claro' : 'Modo nocturno';
    }
  }

  function toggleTema() {
    var actual = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    var nuevo = actual === 'dark' ? 'light' : 'dark';
    localStorage.setItem(THEME_KEY, nuevo); // anulación manual, ya no sigue al sistema
    aplicarTema(nuevo);
  }

  /* ---------------------------------------------------------------------
     4. CONSTRUCCIÓN DEL HTML
  --------------------------------------------------------------------- */
  function construirNav(paginaActiva) {
    var html = '';

    NAV_CONFIG.forEach(function (grupo) {
      if (grupo.categoria) {
        html += '<div class="nav-cat"><span class="nav-cat-label">' + grupo.categoria + '</span></div>';
      }

      grupo.items.forEach(function (item) {
        var activo = item.href.toLowerCase() === paginaActiva;
        html += '<a href="' + item.href + '" class="nav-item' + (activo ? ' active' : '') + '">' +
                  '<span class="nav-icon">' + item.icon + '</span>' + item.label +
                '</a>';
      });
    });

    return html;
  }

  // Íconos de las herramientas del footer (ojo = privacidad, luna/sol = tema)
  var ICON_EYE_OPEN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  var ICON_EYE_OFF  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.86 21.86 0 0 1 5.06-6.06M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.86 21.86 0 0 1-3.22 4.43M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
  var ICON_MOON     = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  var ICON_SUN      = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="6.42"/></svg>';

  function construirSidebar() {
    var pagina = paginaActual();
    var nav = construirNav(pagina);

    return '' +
      '<button class="crz-menu-toggle" id="crzMenuToggle" aria-label="Abrir menú">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/></svg>' +
      '</button>' +
      '<div class="crz-overlay-mobile" id="crzOverlayMobile"></div>' +
      '<aside class="sidebar" id="crzSidebar">' +
        '<div class="sidebar-logo">' +
          '<img src="' + LOGO_SRC + '" alt="' + LOGO_ALT + '">' +
          '<span>' + LOGO_SUB + '</span>' +
        '</div>' +
        '<nav class="sidebar-nav">' + nav + '</nav>' +
        '<div class="sidebar-footer">' +
          '<button type="button" class="sidebar-tool-btn" id="crzPrivacyToggle" title="Ocultar/mostrar KPIs" aria-pressed="false">' + ICON_EYE_OPEN + '</button>' +
          '<button type="button" class="sidebar-tool-btn" id="crzThemeToggle" title="Modo nocturno" aria-pressed="false">' + ICON_MOON + '</button>' +
        '</div>' +
      '</aside>';
  }

  /* ---------------------------------------------------------------------
     5. INYECCIÓN EN EL DOM
  --------------------------------------------------------------------- */
  function inyectarFavicon() {
    if (document.querySelector('link[rel~="icon"]')) return;

    var enlaces = [
      { rel: 'icon', type: 'image/png', sizes: '16x16',  href: 'img/favicon-16.png' },
      { rel: 'icon', type: 'image/png', sizes: '32x32',  href: 'img/favicon-32.png' },
      { rel: 'icon', type: 'image/png', sizes: '192x192', href: 'img/favicon-192.png' },
      { rel: 'icon', type: 'image/png', sizes: '512x512', href: 'img/favicon-512.png' },
      { rel: 'apple-touch-icon', sizes: '180x180', href: 'img/apple-touch-icon.png' },
      { rel: 'shortcut icon', href: 'img/favicon.ico' }
    ];
    enlaces.forEach(function (attrs) {
      var link = document.createElement('link');
      Object.keys(attrs).forEach(function (k) { link.setAttribute(k, attrs[k]); });
      document.head.appendChild(link);
    });
  }

  function inyectar() {
    var style = document.createElement('style');
    style.id = 'sidebar-styles';
    style.textContent = CSS;
    document.head.appendChild(style);

    inyectarFavicon();

    document.body.insertAdjacentHTML('afterbegin', construirSidebar());

    var btnToggle = document.getElementById('crzMenuToggle');
    var sidebarEl = document.getElementById('crzSidebar');
    var overlayEl = document.getElementById('crzOverlayMobile');

    function abrirMenuMovil() {
      sidebarEl.classList.add('crz-open');
      overlayEl.classList.add('crz-open');
    }
    function cerrarMenuMovil() {
      sidebarEl.classList.remove('crz-open');
      overlayEl.classList.remove('crz-open');
    }

    if (btnToggle) {
      btnToggle.addEventListener('click', function () {
        if (sidebarEl.classList.contains('crz-open')) cerrarMenuMovil();
        else abrirMenuMovil();
      });
    }

    if (overlayEl) {
      overlayEl.addEventListener('click', cerrarMenuMovil);
    }

    // Tema: aplica el guardado o el del sistema operativo
    aplicarTema(temaInicial());

    // Si el usuario NO anuló manualmente el tema, seguir los cambios del
    // sistema operativo en vivo (ej. si su PC pasa a modo oscuro a las 8pm)
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
        if (!localStorage.getItem(THEME_KEY)) aplicarTema(e.matches ? 'dark' : 'light');
      });
    }

    var btnTema = document.getElementById('crzThemeToggle');
    if (btnTema) btnTema.addEventListener('click', toggleTema);

    // Privacidad: aplica el estado guardado y observa cambios futuros en la
    // página (para re-enmascarar KPIs que carguen después, ej. desde Firestore)
    setPrivacidad(localStorage.getItem(PRIVACY_KEY) === '1');
    kpiObserver.observe(document.body, { childList: true, subtree: true, characterData: true });

    var btnPrivacidad = document.getElementById('crzPrivacyToggle');
    if (btnPrivacidad) {
      btnPrivacidad.addEventListener('click', function () {
        setPrivacidad(!document.documentElement.classList.contains('crz-privacy-on'));
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inyectar);
  } else {
    inyectar();
  }
})();