/* ==========================================================================
   CARZECITO — Asistente Virtual CARZE Contratistas Generales S.A.C.
   FASE 1 COMPLETADA: Cascarón Visual, Alertas Locales y Sensibilidad Temporal
   FASE 2 INCLUIDA: Intérprete de Comandos Estáticos y Navegación
   ========================================================================== */

(function () {
  'use strict';

  /* ---------------------------------------------------------------------
     0. CONFIGURACIÓN GENERAL
  --------------------------------------------------------------------- */
  var CONFIG = {
    avatarSrc: 'img/carzecito.png',
    storageKey: 'carzecito_alertas',
    nombreVar: 'carze_nombre',
    badgesVencimientos: {
      badgeFacturas:  'Facturas',
      badgePrestamos: 'Préstamos/Cuotas',
      badgeImpuestos: 'Impuestos',
    }
  };

  var MAPA_PAGINAS = [
    { pagina: 'PORTADA.html',      etiqueta: 'Portada',              claves: ['portada', 'inicio', 'home', 'principal'] },
    { pagina: 'dashboard.html',    etiqueta: 'Dashboard',            claves: ['dashboard', 'panel general', 'panel', 'resumen general'] },
    { pagina: 'cotizaciones.html', etiqueta: 'Cotizaciones',         claves: ['cotizaciones', 'cotizacion', 'presupuestos', 'presupuesto'] },
    { pagina: 'certificados.html', etiqueta: 'Certificados',         claves: ['certificados', 'certificado', 'sctr', 'emo', 'examenes medicos', 'acreditaciones'] },
    { pagina: 'flujo_caja.html',   etiqueta: 'Flujo de Caja',        claves: ['flujo de caja', 'flujo'] },
    { pagina: 'caja_diaria.html',  etiqueta: 'Caja Diaria',          claves: ['caja diaria', 'caja', 'gastos diarios', 'efectivo'] },
    { pagina: 'finanzas.html',     etiqueta: 'Finanzas',             claves: ['finanzas', 'financiero', 'estado financiero'] },
    { pagina: 'facturas.html',     etiqueta: 'Facturas',             claves: ['facturas', 'factura', 'cobranza', 'cobranzas'] },
    { pagina: 'impuestos.html',    etiqueta: 'Impuestos',            claves: ['impuestos', 'impuesto', 'sunat', 'tributos'] },
    { pagina: 'personal.html',     etiqueta: 'Personal',             claves: ['personal', 'trabajadores', 'empleados', 'cuadrillas', 'cuadrilla'] },
    { pagina: 'seguimiento.html',  etiqueta: 'Seguimiento de Obras', claves: ['seguimiento', 'obras', 'obra', 'proyectos', 'proyecto', 'avance de obra'] },
    { pagina: 'eventos.html',      etiqueta: 'Eventos',              claves: ['eventos', 'evento', 'calendario', 'agenda'] },
    { pagina: 'pronto_pago.html',  etiqueta: 'Pronto Pago',          claves: ['pronto pago', 'descuento pronto pago'] },
    { pagina: 'vencimientos.html', etiqueta: 'Vencimientos y Alertas', claves: ['vencimientos', 'vencimiento', 'alertas', 'alerta', 'urgentes', 'urgente'] },
  ];

  var SIN_ALERTAS = [
    'Por ahora todo está en orden por acá. ✅',
    'No detecto pendientes urgentes en este momento. 👍',
    'Todo tranquilo en la obra, sigamos avanzando. 🟢',
  ];

  /* ---------------------------------------------------------------------
     1. INYECCIÓN DE ESTILOS CSS (Fase 1)
  --------------------------------------------------------------------- */
  var css = `
    #carzecito-root{position:fixed;bottom:22px;right:22px;z-index:99999;font-family:'Plus Jakarta Sans','Segoe UI',sans-serif}
    #carzecito-fab{width:66px;height:66px;border-radius:50%;background:linear-gradient(135deg,#1a3a6b,#1e40af);border:3px solid #f97316;cursor:pointer;box-shadow:0 6px 20px rgba(10,15,30,.35);display:flex;align-items:center;justify-content:center;position:relative;transition:transform .2s ease,box-shadow .2s ease;padding:0;overflow:visible;outline:none}
    #carzecito-fab:hover{transform:translateY(-3px) scale(1.04);box-shadow:0 10px 26px rgba(10,15,30,.45)}
    #carzecito-fab img{width:100%;height:100%;border-radius:50%;object-fit:cover;object-position:top center}
    #carzecito-fab.bounce{animation:carzecito-bounce 1.8s ease-in-out infinite}
    @keyframes carzecito-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
    #carzecito-dot{position:absolute;top:-2px;right:-2px;width:18px;height:18px;background:#dc2626;border:2px solid #fff;border-radius:50%;display:none;align-items:center;justify-content:center;font-size:.6rem;font-weight:800;color:#fff}
    #carzecito-dot.show{display:flex}
    #carzecito-bubble{position:absolute;bottom:78px;right:0;background:#fff;border-radius:14px 14px 4px 14px;padding:10px 14px;box-shadow:0 8px 24px rgba(10,15,30,.18);font-size:.78rem;color:#1e293b;font-weight:600;width:max-content;max-width:260px;opacity:0;transform:translateY(8px);transition:all .25s ease;pointer-events:none}
    #carzecito-bubble.show{opacity:1;transform:translateY(0)}
    #carzecito-panel{position:absolute;bottom:78px;right:0;width:330px;max-height:460px;background:#fff;border-radius:16px;box-shadow:0 16px 48px rgba(10,15,30,.28);display:none;flex-direction:column;overflow:hidden;border:1px solid #e2e8f0}
    #carzecito-panel.open{display:flex}
    #carzecito-head{background:linear-gradient(135deg,#1a3a6b,#1e40af);padding:14px 16px;display:flex;align-items:center;gap:10px;color:#fff}
    #carzecito-head img{width:38px;height:38px;border-radius:50%;object-fit:cover;object-position:top center;border:2px solid #f97316}
    #carzecito-head .cz-title{font-weight:800;font-size:.95rem;line-height:1.1}
    #carzecito-head .cz-sub{font-size:.68rem;color:rgba(255,255,255,.7);text-transform:uppercase;letter-spacing:.06em}
    #carzecito-close{margin-left:auto;background:rgba(255,255,255,.12);border:none;color:#fff;width:26px;height:26px;border-radius:50%;cursor:pointer;font-size:.85rem;display:flex;align-items:center;justify-content:center}
    #carzecito-close:hover{background:rgba(255,255,255,.22)}
    #carzecito-body{padding:14px;overflow-y:auto;flex:1;background:#f8fafc;display:flex;flex-direction:column}
    .cz-msg{background:#fff;border:1px solid #e2e8f0;border-radius:12px 12px 12px 4px;padding:10px 12px;font-size:.8rem;color:#334155;margin-bottom:10px;line-height:1.4;word-break:break-word}
    .cz-msg b{color:#1a3a6b}
    .cz-msg.cz-msg-user{background:#eff6ff;border-color:#bfdbfe;align-self:flex-end;border-radius:12px 12px 4px 12px;color:#1e40af}
    .cz-shortcuts{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}
    .cz-chip{background:#fff;border:1.5px solid #f97316;color:#ea580c;font-size:.72rem;font-weight:700;padding:6px 10px;border-radius:20px;cursor:pointer;transition:all .15s}
    .cz-chip:hover{background:#f97316;color:#fff}
    #carzecito-inputrow{display:flex;gap:6px;padding:10px 12px;border-top:1px solid #e2e8f0;background:#fff}
    #carzecito-input{flex:1;border:1.5px solid #e2e8f0;border-radius:20px;padding:8px 14px;font-size:.78rem;outline:none;font-family:inherit}
    #carzecito-input:focus{border-color:#f97316}
    #carzecito-send{background:#1a3a6b;border:none;color:#fff;width:34px;height:34px;border-radius:50%;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:.85rem}
    #carzecito-send:hover{background:#1e40af}
    #carzecito-foot{padding:6px 14px;font-size:.62rem;color:#94a3b8;text-align:center;border-top:1px solid #e2e8f0;background:#fff}
    @media (max-width:480px){#carzecito-panel{width:calc(100vw - 32px);right:-10px}}
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
        <img src="${CONFIG.avatarSrc}" alt="CARZECITO" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'><circle cx=\'50\' cy=\'50\' r=\'50\' fill=\'%231a3a6b\'/><text x=\'50%\' y=\'55%\' font-size=\'40\' text-anchor=\'middle\' fill=\'%23fff\' dominant-baseline=\'middle\'>🦺</text></svg>'">
        <div>
          <div class="cz-title">CARZECITO</div>
          <div class="cz-sub">Asistente CARZE</div>
        </div>
        <button id="carzecito-close" title="Cerrar">✕</button>
      </div>
      <div id="carzecito-body"></div>
      <div id="carzecito-inputrow">
        <input id="carzecito-input" type="text" placeholder="Ej: ir a personal, ver caja..." autocomplete="off">
        <button id="carzecito-send" title="Enviar">➤</button>
      </div>
      <div id="carzecito-foot">Fase 1 · Cascarón Visual e Interfaz Local</div>
    </div>
    <button id="carzecito-fab" title="CARZECITO">
      <img src="${CONFIG.avatarSrc}" alt="CARZECITO" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'><circle cx=\'50\' cy=\'50\' r=\'50\' fill=\'%231a3a6b\'/><text x=\'50%\' y=\'55%\' font-size=\'40\' text-anchor=\'middle\' fill=\'%23fff\' dominant-baseline=\'middle\'>🦺</text></svg>'">
      <span id="carzecito-dot"></span>
    </button>
  `;
  document.body.appendChild(root);

  var fab      = document.getElementById('carzecito-fab');
  var panel    = document.getElementById('carzecito-panel');
  var bubble   = document.getElementById('carzecito-bubble');
  var body     = document.getElementById('carzecito-body');
  var dot      = document.getElementById('carzecito-dot');
  var closeBtn = document.getElementById('carzecito-close');
  var input    = document.getElementById('carzecito-input');
  var sendBtn  = document.getElementById('carzecito-send');

  /* ---------------------------------------------------------------------
     3. SENSIBILIDAD TEMPORAL Y ALERTAS LOCALES (Fase 1)
  --------------------------------------------------------------------- */
  function nombreUsuario() {
    try {
      var n = sessionStorage.getItem(CONFIG.nombreVar);
      return n ? n.split(' ')[0] : 'Robert';
    } catch (e) { return 'Robert'; }
  }

  function obtenerSaludoSegunHora() {
    var hora = new Date().getHours();
    var nombre = nombreUsuario();

    if (hora >= 5 && hora < 12) {
      return `¡Buenos días, ${nombre}! ☕ Casco listo para coordinar la obra.`;
    } else if (hora >= 12 && hora < 17) {
      return `¡Buenas tardes, ${nombre}! 🦺 ¿Todo en orden con las revisiones?`;
    } else if (hora >= 17 && hora < 19) {
      return `¡Pasamos las 5:00 PM, ${nombre}! ☕ ¿Un cafecito antes de cerrar el día?`;
    } else {
      return `¡Hola ${nombre}! 🌙 Ya es tarde, dime qué pendientes dejamos listos.`;
    }
  }

  function randomDe(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function addMsg(html, esUsuario) {
    var div = document.createElement('div');
    div.className = 'cz-msg' + (esUsuario ? ' cz-msg-user' : '');
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
    var enVivo = escanearVencimientos();
    if (enVivo) return enVivo;
    return leerAlertasGuardadas();
  }

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
     4. NAVEGACIÓN Y COMANDOS (Fase 2)
  --------------------------------------------------------------------- */
  function normalizar(txt) {
    return (txt || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function paginaActual() {
    var p = window.location.pathname.split('/').pop();
    return p || 'PORTADA.html';
  }

  function interpretarComando(textoOriginal) {
    var texto = normalizar(textoOriginal);
    if (!texto) return null;
    var mejor = null;
    var mejorLargo = 0;

    MAPA_PAGINAS.forEach(function (entrada) {
      entrada.claves.forEach(function (clave) {
        if (texto.indexOf(clave) !== -1 && clave.length > mejorLargo) {
          mejor = entrada;
          mejorLargo = clave.length;
        }
      });
    });
    return mejor;
  }

  function procesarComando(textoOriginal) {
    if (!textoOriginal || !textoOriginal.trim()) return;

    addMsg(textoOriginal, true);

    var match = interpretarComando(textoOriginal);

    if (!match) {
      addMsg(
        'No reconocí ese comando 🤔 Prueba algo como: <b>"ir a personal"</b>, ' +
        '<b>"ver caja"</b> o <b>"vencimientos"</b>.'
      );
      return;
    }

    if (match.pagina === paginaActual()) {
      addMsg('Ya estás en <b>' + match.etiqueta + '</b> 😊');
      return;
    }

    addMsg('¡Vamos a <b>' + match.etiqueta + '</b>! 🚀');
    setTimeout(function () {
      window.location.href = match.pagina;
    }, 750);
  }

  /* ---------------------------------------------------------------------
     5. RENDERIZADO DEL PANEL
  --------------------------------------------------------------------- */
  function renderPanel() {
    body.innerHTML = '';
    
    addMsg(`¡Hola! 🦺 ${obtenerSaludoSegunHora()}`);

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
      <div class="cz-chip" data-cmd="vencimientos">🚨 Vencimientos</div>
      <div class="cz-chip" data-cmd="caja diaria">💵 Caja diaria</div>
      <div class="cz-chip" data-cmd="cotizaciones">📋 Cotizaciones</div>
      <div class="cz-chip" data-cmd="sctr">🪖 Certificados</div>
      <div class="cz-chip" data-cmd="personal">👷 Personal</div>
      <div class="cz-chip" data-cmd="facturas">🧾 Facturas</div>
    `;
    body.appendChild(shortcuts);

    body.querySelectorAll('.cz-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        procesarComando(chip.getAttribute('data-cmd'));
      });
    });
  }

  /* ---------------------------------------------------------------------
     6. EVENTOS E INICIO
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

  function enviarDesdeInput() {
    var val = input.value;
    input.value = '';
    procesarComando(val);
  }

  sendBtn.addEventListener('click', enviarDesdeInput);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') enviarDesdeInput();
  });

  function init() {
    bubble.textContent = obtenerSaludoSegunHora();
    setTimeout(function () {
      bubble.classList.add('show');
      setTimeout(function () { bubble.classList.remove('show'); }, 5000);
    }, 900);

    actualizarIndicador();
    setTimeout(actualizarIndicador, 2500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();