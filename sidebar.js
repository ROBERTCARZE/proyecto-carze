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
    }
  ];

  var LOGO_SRC = 'img/logo_carze_1.png';
  var LOGO_ALT = 'CARZE';
  var LOGO_SUB = 'Contratistas Generales';

  /* ---------------------------------------------------------------------
     2. CSS DEL SIDEBAR (antes duplicado en cada HTML, ahora vive aquí)
  --------------------------------------------------------------------- */
  var CSS = '' +
    '.sidebar{position:fixed;top:0;left:0;bottom:0;width:var(--sw);background:var(--white);border-right:1px solid var(--border);display:flex;flex-direction:column;z-index:50;overflow-y:auto;scrollbar-width:none}' +
    '.sidebar::-webkit-scrollbar{display:none}' +
    '.sidebar-logo{padding:20px 20px 16px;border-bottom:1px solid var(--border);display:flex;flex-direction:column;align-items:center;gap:4px}' +
    '.sidebar-logo img{width:115px}' +
    '.sidebar-logo span{font-size:.58rem;color:var(--muted);letter-spacing:.12em;text-transform:uppercase;font-weight:600}' +
    '.sidebar-nav{padding:12px 10px;flex:1}' +
    '.nav-item{display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:9px;cursor:pointer;text-decoration:none;color:var(--muted);font-size:.76rem;font-weight:600;letter-spacing:.04em;text-transform:uppercase;transition:all .18s;margin-bottom:2px}' +
    '.nav-item:hover{background:var(--light);color:var(--txt)}' +
    '.nav-item.active{background:linear-gradient(90deg,rgba(249,115,22,.1),rgba(249,115,22,.04));color:var(--naranja);border-left:3px solid var(--naranja);padding-left:9px}' +
    '.nav-icon{font-size:1rem;flex-shrink:0;width:20px;text-align:center}' +
    '.nav-cat{padding:14px 12px 6px}' +
    '.nav-cat:first-child{padding-top:4px}' +
    '.nav-cat-label{font-size:.62rem;font-weight:800;color:#94a3b8;letter-spacing:.09em;text-transform:uppercase}' +

    /* ============================================================
       RESPONSIVE — inyectado centralizadamente para las 14 páginas.
       No requiere tocar el CSS propio de cada módulo: estas reglas
       comparten los mismos nombres de clase que ya usan todos
       (.main, .kpi-row, .table-wrap, etc.) y se cargan después,
       así que ganan el empate de especificidad sin necesitar tocar
       ningún archivo individual.
       ============================================================ */

    // Botón hamburguesa (oculto en escritorio)
    '.crz-menu-toggle{display:none;position:fixed;top:14px;left:14px;z-index:80;width:42px;height:42px;border-radius:10px;background:var(--naranja,#f97316);color:#fff;border:none;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(0,0,0,.22);cursor:pointer}' +
    '.crz-menu-toggle svg{width:20px;height:20px;pointer-events:none}' +

    // Fondo oscuro detrás del sidebar cuando está abierto en móvil
    '.crz-overlay-mobile{display:none;position:fixed;inset:0;background:rgba(15,23,42,.5);z-index:65;opacity:0;pointer-events:none;transition:opacity .25s}' +
    '.crz-overlay-mobile.crz-open{opacity:1;pointer-events:all}' +

    // Tablet y celular: sidebar pasa a ser un cajón (drawer) que se desliza
    '@media (max-width:980px){' +
      '.crz-menu-toggle{display:flex}' +
      '.sidebar{transform:translateX(-100%);transition:transform .28s ease;z-index:70;box-shadow:0 0 30px rgba(0,0,0,.28)}' +
      '.sidebar.crz-open{transform:translateX(0)}' +
      '.main{margin-left:0 !important}' +
      '.crz-overlay-mobile{display:block}' +
      '.kpi-row,.chart-row,.modulos-row,.atencion-grid,.bottom-row,.semaforo-row,.fgrid3,.resumen-presu{grid-template-columns:repeat(2,1fr) !important}' +
    '}' +

    // Celular: todo a una sola columna, topbar y modales se adaptan
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
      '</aside>';
  }

  /* ---------------------------------------------------------------------
     5. INYECCIÓN EN EL DOM
  --------------------------------------------------------------------- */
  function inyectarFavicon() {
    // Si la página ya trae su propio favicon manual, no lo pisamos.
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
    // CSS
    var style = document.createElement('style');
    style.id = 'sidebar-styles';
    style.textContent = CSS;
    document.head.appendChild(style);

    // Favicon (ícono de pestaña) — mismo para las 14 páginas
    inyectarFavicon();

    // HTML — se inserta como primer hijo del body para respetar el
    // z-index/posicionamiento fixed esperado por el resto de la página.
    document.body.insertAdjacentHTML('afterbegin', construirSidebar());

    // Menú móvil: abrir/cerrar el sidebar como cajón deslizante
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
    btnToggle.addEventListener('click', function () {
      if (sidebarEl.classList.contains('crz-open')) cerrarMenuMovil();
      else abrirMenuMovil();
    });
    overlayEl.addEventListener('click', cerrarMenuMovil);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inyectar);
  } else {
    inyectar();
  }
})();
