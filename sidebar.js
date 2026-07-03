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
    '.nav-cat-label{font-size:.62rem;font-weight:800;color:#94a3b8;letter-spacing:.09em;text-transform:uppercase}';

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
      '<aside class="sidebar">' +
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
  function inyectar() {
    // CSS
    var style = document.createElement('style');
    style.id = 'sidebar-styles';
    style.textContent = CSS;
    document.head.appendChild(style);

    // HTML — se inserta como primer hijo del body para respetar el
    // z-index/posicionamiento fixed esperado por el resto de la página.
    document.body.insertAdjacentHTML('afterbegin', construirSidebar());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inyectar);
  } else {
    inyectar();
  }
})();
