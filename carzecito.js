/* ==========================================================================
   CARZECITO — Asistente Virtual CARZE Contratistas Generales S.A.C.
   FASE 1-2 COMPLETADAS: Cascarón visual, alertas locales, navegación.
   FASE 3 CORREGIDA: Gemini vía proxy seguro (sin key expuesta), Firestore
                      con SDK modular real (colecciones y campos verificados
                      contra los módulos del ERP), historial de conversación,
                      escape de HTML en todo lo que viene del usuario.
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
    // URL del Cloudflare Worker (ver gemini-proxy-worker.js). La API Key de
    // Gemini NUNCA va aquí ni en ningún archivo del frontend.
    proxyUrl: 'https://carzecito-gemini-proxy.robert-carrillo1925.workers.dev',
    maxHistorial: 6, // últimos N turnos que se envían a Gemini como contexto
    badgesVencimientos: {
      badgeFacturas:  'Facturas',
      badgePrestamos: 'Préstamos/Cuotas',
      badgeImpuestos: 'Impuestos',
    }
  };

  var SYSTEM_PROMPT =
    'Eres CARZECITO, el asistente virtual oficial de CARZE Contratistas Generales S.A.C., ' +
    'empresa de construcción y obras civiles. Tono: amigable, profesional, carismático, con ' +
    'toques ligeros de humor de obra. Reglas: 1) Respuestas concisas (máx 3 oraciones). ' +
    '2) Si preguntan por temas ajenos al negocio (política, entretenimiento, etc.), redirige ' +
    'con humor hacia los objetivos de CARZE. 3) No inventes cifras: si no tienes el dato exacto ' +
    'en el contexto de la conversación, dile al usuario que lo consulte en el módulo correspondiente.';

  /* Sinónimos de búsqueda por página. Los datos de página/etiqueta se toman
     de window.CARZE_NAV (definido en sidebar.js) para no duplicar la lista
     de módulos en dos archivos distintos. */
  var SINONIMOS = {
    'PORTADA.html':      ['portada', 'inicio', 'home', 'principal'],
    'dashboard.html':    ['dashboard', 'panel general', 'panel', 'resumen general'],
    'cotizaciones.html': ['cotizaciones', 'cotizacion', 'presupuestos de obra'],
    'certificados.html': ['certificados', 'certificado', 'valorizaciones', 'hes'],
    'presupuesto.html':  ['presupuesto general', 'presupuesto'],
    'facturas.html':     ['facturas', 'factura', 'cobranza', 'cobranzas'],
    'finanzas.html':     ['finanzas', 'financiero', 'estado financiero'],
    'caja_diaria.html':  ['caja diaria', 'caja', 'gastos diarios', 'efectivo'],
    'flujo_caja.html':   ['flujo de caja', 'flujo'],
    'pronto_pago.html':  ['pronto pago', 'descuento pronto pago'],
    'impuestos.html':    ['impuestos', 'impuesto', 'sunat', 'tributos'],
    'personal.html':     ['personal', 'trabajadores', 'empleados', 'cuadrillas', 'cuadrilla', 'sctr', 'emo'],
    'eventos.html':      ['eventos', 'evento', 'calendario', 'agenda'],
    'vencimientos.html': ['vencimientos', 'vencimiento', 'alertas', 'alerta', 'urgentes', 'urgente'],
    'seguimiento.html':  ['seguimiento', 'obras', 'obra', 'proyectos', 'proyecto', 'avance de obra']
  };

  function construirMapaPaginas() {
    var nav = window.CARZE_NAV; // viene de sidebar.js
    var mapa = [];
    if (nav && nav.length) {
      nav.forEach(function (grupo) {
        grupo.items.forEach(function (item) {
          mapa.push({
            pagina: item.href,
            etiqueta: item.label,
            claves: SINONIMOS[item.href] || [item.label.toLowerCase()]
          });
        });
      });
    } else {
      // Fallback por si sidebar.js no cargó (no debería pasar en producción)
      Object.keys(SINONIMOS).forEach(function (href) {
        mapa.push({ pagina: href, etiqueta: href.replace('.html', ''), claves: SINONIMOS[href] });
      });
    }
    return mapa;
  }

  var SIN_ALERTAS = [
    'Por ahora todo está en orden por acá. ✅',
    'No detecto pendientes urgentes en este momento. 👍',
    'Todo tranquilo en la obra, sigamos avanzando. 🟢',
  ];

  /* ---------------------------------------------------------------------
     1. CSS (sin cambios de diseño)
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
    #carzecito-panel{position:absolute;bottom:78px;right:0;width:340px;max-height:480px;background:#fff;border-radius:16px;box-shadow:0 16px 48px rgba(10,15,30,.28);display:none;flex-direction:column;overflow:hidden;border:1px solid #e2e8f0}
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
    .cz-msg.cz-msg-system{background:#fef3c7;border-color:#fde68a;color:#92400e;font-size:.75rem}
    .cz-shortcuts{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}
    .cz-chip{background:#fff;border:1.5px solid #f97316;color:#ea580c;font-size:.72rem;font-weight:700;padding:6px 10px;border-radius:20px;cursor:pointer;transition:all .15s}
    .cz-chip:hover{background:#f97316;color:#fff}
    #carzecito-inputrow{display:flex;gap:6px;padding:10px 12px;border-top:1px solid #e2e8f0;background:#fff}
    #carzecito-input{flex:1;border:1.5px solid #e2e8f0;border-radius:20px;padding:8px 14px;font-size:.78rem;outline:none;font-family:inherit}
    #carzecito-input:focus{border-color:#f97316}
    #carzecito-send{background:#1a3a6b;border:none;color:#fff;width:34px;height:34px;border-radius:50%;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:.85rem}
    #carzecito-send:hover{background:#1e40af}
    #carzecito-foot{padding:6px 14px;font-size:.62rem;color:#94a3b8;text-align:center;border-top:1px solid #e2e8f0;background:#fff}
    .cz-typing{display:inline-block;width:12px;height:12px;border:2px solid #1a3a6b;border-radius:50%;border-top-color:transparent;animation:cz-spin 0.8s linear infinite}
    @keyframes cz-spin{to{transform:rotate(360deg)}}
    .cz-toast{position:fixed;top:20px;right:20px;background:#1e293b;color:#fff;padding:12px 18px;border-radius:8px;box-shadow:0 10px 25px rgba(0,0,0,0.2);z-index:100000;font-size:.82rem;border-left:4px solid #f97316;display:flex;align-items:center;gap:8px;animation:cz-slide 0.3s ease-out}
    @keyframes cz-slide{from{transform:translateX(100%)}to{transform:translateX(0)}}
    @media (max-width:480px){#carzecito-panel{width:calc(100vw - 32px);right:-10px}}
  `;
  var styleTag = document.createElement('style');
  styleTag.id = 'carzecito-styles';
  styleTag.textContent = css;
  document.head.appendChild(styleTag);

  /* ---------------------------------------------------------------------
     2. HTML DEL WIDGET (sin cambios de estructura)
  --------------------------------------------------------------------- */
  var AVATAR_FALLBACK = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='50' fill='%231a3a6b'/><text x='50%25' y='55%25' font-size='40' text-anchor='middle' fill='%23fff' dominant-baseline='middle'>🦺</text></svg>";

  var root = document.createElement('div');
  root.id = 'carzecito-root';
  root.innerHTML = `
    <div id="carzecito-bubble"></div>
    <div id="carzecito-panel">
      <div id="carzecito-head">
        <img src="${CONFIG.avatarSrc}" alt="CARZECITO" onerror="this.onerror=null;this.src='${AVATAR_FALLBACK}'">
        <div>
          <div class="cz-title">CARZECITO</div>
          <div class="cz-sub">Asistente Inteligente CARZE</div>
        </div>
        <button id="carzecito-close" title="Cerrar">✕</button>
      </div>
      <div id="carzecito-body"></div>
      <div id="carzecito-inputrow">
        <input id="carzecito-input" type="text" placeholder="Escribe un mensaje o comando..." autocomplete="off">
        <button id="carzecito-send" title="Enviar">➤</button>
      </div>
      <div id="carzecito-foot">Fase 3 · IA, Firestore & Validaciones en Vivo</div>
    </div>
    <button id="carzecito-fab" title="CARZECITO">
      <img src="${CONFIG.avatarSrc}" alt="CARZECITO" onerror="this.onerror=null;this.src='${AVATAR_FALLBACK}'">
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

  /* Historial de conversación en memoria (no persiste entre páginas a
     propósito: cada módulo puede recibir preguntas de contexto distinto). */
  var historialChat = [];

  /* ---------------------------------------------------------------------
     3. UTILIDADES
  --------------------------------------------------------------------- */
  function nombreUsuario() {
    try {
      var n = sessionStorage.getItem(CONFIG.nombreVar);
      return n ? n.split(' ')[0] : 'Robert';
    } catch (e) { return 'Robert'; }
  }

  function escapeHTML(str) {
    var div = document.createElement('div');
    div.textContent = String(str == null ? '' : str);
    return div.innerHTML;
  }

  function obtenerSaludoSegunHora() {
    var hora = new Date().getHours();
    var nombre = escapeHTML(nombreUsuario());

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

  // html=true SOLO para mensajes generados por nosotros mismos (nunca con
  // texto crudo del usuario o de Gemini sin escapar antes).
  function addMsg(html, tipo) {
    var div = document.createElement('div');
    var clase = 'cz-msg';
    if (tipo === 'user') clase += ' cz-msg-user';
    if (tipo === 'system') clase += ' cz-msg-system';
    div.className = clase;
    div.innerHTML = html;
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
    return div;
  }

  function mostrarToast(html) {
    var toast = document.createElement('div');
    toast.className = 'cz-toast';
    toast.innerHTML = `🦺 <b>CARZECITO:</b> ${html}`;
    document.body.appendChild(toast);
    setTimeout(function () { toast.remove(); }, 4000);
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

  function normalizar(txt) {
    return (txt || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  var NOMBRES_MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  // Detecta un mes mencionado en texto normalizado ("agosto", "julio"...).
  // Si no encuentra ninguno, usa el mes actual.
  function detectarMes(textoNorm) {
    var hoy = new Date();
    for (var i = 0; i < NOMBRES_MES.length; i++) {
      if (textoNorm.indexOf(NOMBRES_MES[i]) !== -1) {
        var anio = hoy.getFullYear();
        // Si el mes mencionado es posterior al actual, asumimos que se refiere al año pasado
        if (i + 1 > hoy.getMonth() + 1) anio -= 1;
        var mm = String(i + 1).padStart(2, '0');
        return { valor: anio + '-' + mm, label: capitalizar(NOMBRES_MES[i]) + ' ' + anio };
      }
    }
    var mesActual = String(hoy.getMonth() + 1).padStart(2, '0');
    return { valor: hoy.getFullYear() + '-' + mesActual, label: capitalizar(NOMBRES_MES[hoy.getMonth()]) + ' ' + hoy.getFullYear() };
  }

  function capitalizar(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function paginaActual() {
    var p = window.location.pathname.split('/').pop();
    return p || 'PORTADA.html';
  }

  /* ---------------------------------------------------------------------
     4. FIRESTORE — colecciones y campos VERIFICADOS contra el HTML real
        de cada módulo (no inventados). Si window.CZ_FIRESTORE no existe
        (carzecito-bridge.js no cargó, o la página no usa Firebase),
        todas las funciones devuelven null y el chat lo indica con
        honestidad en vez de mostrar datos falsos.
  --------------------------------------------------------------------- */
  var DB = {
    disponible: function () {
      return !!(window.CZ_FIRESTORE && window.CZ_FIRESTORE.db);
    },

    // Colección real: 'caja_diaria', campos: tipo ('ingreso'|'egreso'), monto
    obtenerSaldoCaja: async function () {
      if (!this.disponible()) return null;
      var F = window.CZ_FIRESTORE;
      try {
        var snap = await F.getDocs(F.collection(F.db, 'caja_diaria'));
        var saldo = 0;
        snap.forEach(function (docSnap) {
          var d = docSnap.data();
          var monto = parseFloat(d.monto) || 0;
          saldo += (d.tipo === 'ingreso' ? monto : -monto);
        });
        return saldo;
      } catch (e) {
        console.error('[CARZECITO] Error leyendo caja_diaria:', e);
        return null;
      }
    },

    // Colección real: 'facturas', campos: serie, numFact
    validarDuplicadoFactura: async function (serie, numFact) {
      if (!this.disponible() || !numFact) return false;
      var F = window.CZ_FIRESTORE;
      try {
        var q = F.query(F.collection(F.db, 'facturas'), F.where('numFact', '==', numFact));
        var snap = await F.getDocs(q);
        return !snap.empty;
      } catch (e) {
        console.error('[CARZECITO] Error validando duplicado de factura:', e);
        return false;
      }
    },

    // Agrega datos REALES de caja_diaria + facturas para un mes ('YYYY-MM').
    // No usa Gemini aquí — solo matemática exacta en JS, como pide el Plan Maestro.
    obtenerReporteMensual: async function (mesStr) {
      if (!this.disponible()) return null;
      var F = window.CZ_FIRESTORE;
      try {
        var reporte = {
          mes: mesStr,
          caja: { ingresos: 0, egresos: 0, saldoNeto: 0, movimientos: 0, porCategoria: {} },
          facturas: { emitidas: 0, totalFacturado: 0, cobradas: 0, totalCobrado: 0, pendientes: 0, totalPendiente: 0, vencidas: 0 }
        };

        var snapCaja = await F.getDocs(F.collection(F.db, 'caja_diaria'));
        snapCaja.forEach(function (docSnap) {
          var d = docSnap.data();
          if (String(d.fecha || '').slice(0, 7) !== mesStr) return;
          var monto = parseFloat(d.monto) || 0;
          reporte.caja.movimientos++;
          if (d.tipo === 'ingreso') {
            reporte.caja.ingresos += monto;
          } else {
            reporte.caja.egresos += monto;
            var cat = d.categoria || 'Otros';
            reporte.caja.porCategoria[cat] = (reporte.caja.porCategoria[cat] || 0) + monto;
          }
        });
        reporte.caja.saldoNeto = reporte.caja.ingresos - reporte.caja.egresos;

        var snapFact = await F.getDocs(F.collection(F.db, 'facturas'));
        snapFact.forEach(function (docSnap) {
          var d = docSnap.data();
          if (String(d.fechaEmision || '').slice(0, 7) !== mesStr) return;
          var total = parseFloat(d.total) || 0;
          reporte.facturas.emitidas++;
          reporte.facturas.totalFacturado += total;
          if (d.estado === 'Cobrada') {
            reporte.facturas.cobradas++;
            reporte.facturas.totalCobrado += total;
          } else if (d.estado === 'Vencida') {
            reporte.facturas.vencidas++;
            reporte.facturas.totalPendiente += total;
          } else if (d.estado === 'Emitida') {
            reporte.facturas.pendientes++;
            reporte.facturas.totalPendiente += total;
          }
        });

        return reporte;
      } catch (e) {
        console.error('[CARZECITO] Error generando reporte mensual:', e);
        return null;
      }
    },

    // Registra un gasto respetando el esquema real de caja_diaria.
    // No asigna "num" correlativo (eso lo calcula caja_diaria.html al
    // renderizar); queda con num=null y el módulo debe tolerarlo o
    // recalcularlo — ver nota en el mensaje final para el usuario.
    registrarGastoRapido: async function (monto, concepto) {
      if (!this.disponible()) return false;
      var F = window.CZ_FIRESTORE;
      try {
        await F.addDoc(F.collection(F.db, 'caja_diaria'), {
          fecha: new Date().toISOString().slice(0, 10),
          tipo: 'egreso',
          categoria: 'Otros',
          subcategoria: '-',
          concepto: concepto,
          monto: parseFloat(monto) || 0,
          obs: 'Registrado vía CARZECITO',
          comprobante: null,
          comprobanteURL: null,
          createdAt: F.serverTimestamp()
        });
        return true;
      } catch (e) {
        console.error('[CARZECITO] Error registrando gasto:', e);
        return false;
      }
    }
  };

  /* ---------------------------------------------------------------------
     5. VALIDACIÓN EN VIVO DENTRO DE FORMULARIOS
  --------------------------------------------------------------------- */
  function iniciarValidacionEnVivo() {
    var page = paginaActual();

    // Sugerencia de categoría en caja_diaria.html
    if (page.indexOf('caja_diaria') !== -1) {
      document.body.addEventListener('input', function (e) {
        var el = e.target;
        if (el.id === 'mConcepto' || el.name === 'concepto') {
          var val = el.value.toLowerCase();
          if (val.indexOf('gasolina') !== -1 || val.indexOf('combustible') !== -1) {
            mostrarToast('Sugerencia: categorízalo como <b>"Transporte y Combustible"</b> ⛽');
          } else if (val.indexOf('almuerzo') !== -1 || val.indexOf('menú') !== -1) {
            mostrarToast('Sugerencia: categorízalo como <b>"Viáticos / Alimentación"</b> 🍲');
          }
        }
      });
    }

    // Prevención de duplicados en facturas.html (campo real: fNumFact)
    if (page.indexOf('facturas') !== -1) {
      document.body.addEventListener('blur', async function (e) {
        var el = e.target;
        if (el.id === 'fNumFact') {
          var val = el.value.trim();
          if (!val) return;
          var serieEl = document.getElementById('fSerie');
          var existe = await DB.validarDuplicadoFactura(serieEl ? serieEl.value : '', val);
          if (existe) {
            el.style.borderColor = '#dc2626';
            mostrarToast(`🚨 El N° de factura <b>${escapeHTML(val)}</b> ya existe en la base de datos.`);
          } else {
            el.style.borderColor = '#16a34a';
          }
        }
      }, true);
    }
  }

  /* ---------------------------------------------------------------------
     6. GEMINI — vía proxy (la key nunca toca el navegador)
  --------------------------------------------------------------------- */
  async function consultarGemini(promptUsuario) {
    if (!CONFIG.proxyUrl || CONFIG.proxyUrl.indexOf('TU-USUARIO') !== -1) {
      return { error: 'sin_configurar' };
    }

    try {
      var res = await fetch(CONFIG.proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt: SYSTEM_PROMPT,
          historial: historialChat.slice(-CONFIG.maxHistorial),
          mensaje: promptUsuario
        })
      });
      var data = await res.json();
      if (!res.ok || data.error) {
        console.error('[CARZECITO] Error del proxy:', data && data.error, '| Detalle:', data && data.detalle);
        return { error: 'proxy' };
      }
      return { texto: data.respuesta || null };
    } catch (e) {
      console.error('[CARZECITO] No se pudo contactar el proxy:', e);
      return { error: 'red' };
    }
  }

  /* ---------------------------------------------------------------------
     7. PROCESAMIENTO DE MENSAJES Y COMANDOS
  --------------------------------------------------------------------- */
  var MAPA_PAGINAS = null; // se construye en init(), cuando sidebar.js ya corrió

  function interpretarComandoEstatico(textoOriginal) {
    var texto = normalizar(textoOriginal);
    if (!texto || !MAPA_PAGINAS) return null;
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

  async function procesarMensaje(textoOriginal) {
    if (!textoOriginal || !textoOriginal.trim()) return;

    // El texto del usuario SIEMPRE se escapa antes de insertarse.
    addMsg(escapeHTML(textoOriginal), 'user');
    historialChat.push({ rol: 'user', texto: textoOriginal });

    var textoNorm = normalizar(textoOriginal);

    // A. Registro rápido de gasto: "gasto de 45 en gasolina"
    var matchGasto = textoOriginal.match(/(?:agrega|registra|gasto de|pagu[ée])\s+(?:s\/\s*)?(\d+(?:\.\d+)?)\s+(?:en|por)\s+(.+)/i);
    if (matchGasto) {
      var monto = matchGasto[1];
      var concepto = matchGasto[2].trim();
      if (!DB.disponible()) {
        addMsg('⚠️ No tengo conexión a la base de datos en esta página, así que no puedo registrar el gasto desde aquí. Ve a <b>Caja Diaria</b> para hacerlo directamente.', 'bot');
        return;
      }
      var ok = await DB.registrarGastoRapido(monto, concepto);
      var respuesta = ok
        ? `✅ Registrado en Caja Diaria: <b>S/ ${escapeHTML(monto)}</b> por <i>"${escapeHTML(concepto)}"</i>.`
        : '❌ Tuve un problema al guardar el gasto. Inténtalo de nuevo o hazlo directo en Caja Diaria.';
      addMsg(respuesta, 'bot');
      historialChat.push({ rol: 'bot', texto: respuesta.replace(/<[^>]+>/g, '') });
      return;
    }

    // B. Saldo de caja en tiempo real
    if (textoNorm.indexOf('cuanto') !== -1 && (textoNorm.indexOf('caja') !== -1 || textoNorm.indexOf('dinero') !== -1 || textoNorm.indexOf('saldo') !== -1)) {
      var loader = addMsg('<span class="cz-typing"></span> Consultando saldo en tiempo real...', 'bot');
      if (!DB.disponible()) {
        loader.innerHTML = '⚠️ No tengo conexión a la base de datos en esta página. Revisa el saldo directo en <b>Caja Diaria</b>.';
        return;
      }
      var saldo = await DB.obtenerSaldoCaja();
      if (saldo === null) {
        loader.innerHTML = '❌ No pude leer el saldo en este momento. Intenta de nuevo en unos segundos.';
      } else {
        loader.innerHTML = `💵 El saldo actual en <b>Caja Diaria</b> es de <b>S/ ${saldo.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</b>.`;
      }
      return;
    }

    // C. Vencimientos / SCTR / EMO: se lee lo que la propia página ya
    // calculó y muestra (badges), en vez de re-inventar la lógica de
    // negocio de vencimientos.html/personal.html desde cero.
    if (textoNorm.indexOf('sctr') !== -1 || textoNorm.indexOf('vencid') !== -1 || textoNorm.indexOf('emo') !== -1 || textoNorm.indexOf('vencimiento') !== -1) {
      var resumen = obtenerResumenAlertas();
      var page = paginaActual();
      if (resumen && resumen.total > 0) {
        var detalle = resumen.detalle.map(function (d) {
          return '• ' + escapeHTML(d.label) + ': <b>' + d.count + '</b>';
        }).join('<br>');
        addMsg('⚠️ Tengo <b>' + resumen.total + '</b> pendiente(s) detectado(s) en esta sesión:<br>' + detalle, 'bot');
      } else if (page.indexOf('personal') !== -1 || page.indexOf('vencimientos') !== -1) {
        addMsg('Estás en el módulo correcto — revisa las tarjetas de arriba, ahí está el detalle exacto por trabajador y fecha. Por ahora no detecto badges en rojo. 👍', 'bot');
      } else {
        addMsg('Para el detalle exacto de SCTR/EMO y vencimientos por trabajador, vamos mejor a <b>Personal</b> o <b>Vencimientos y Alertas</b> — ahí tengo la info real y verificada, no quiero darte un número inventado. 🦺', 'bot');
      }
      return;
    }

    // C.2 Reporte mensual: agrega datos reales primero, Gemini solo redacta
    if (textoNorm.indexOf('reporte') !== -1 || textoNorm.indexOf('resumen del mes') !== -1) {
      var mesObjetivo = detectarMes(textoNorm);
      var loaderRep = addMsg(`<span class="cz-typing"></span> Consolidando datos de ${escapeHTML(mesObjetivo.label)}...`, 'bot');

      if (!DB.disponible()) {
        loaderRep.innerHTML = '⚠️ No tengo conexión a la base de datos en esta página. Prueba desde el <b>Dashboard</b>.';
        return;
      }

      var rep = await DB.obtenerReporteMensual(mesObjetivo.valor);
      if (!rep) {
        loaderRep.innerHTML = '❌ No pude leer los datos del mes. Intenta de nuevo en unos segundos.';
        return;
      }

      // Si no hay conexión a Gemini configurada, mostramos el reporte "en crudo" igual (los números son reales)
      var datosTexto =
        `Caja Diaria (${mesObjetivo.label}): ingresos S/ ${rep.caja.ingresos.toFixed(2)}, ` +
        `egresos S/ ${rep.caja.egresos.toFixed(2)}, saldo neto S/ ${rep.caja.saldoNeto.toFixed(2)}, ` +
        `${rep.caja.movimientos} movimientos. Egresos por categoría: ` +
        Object.keys(rep.caja.porCategoria).map(function (c) { return c + ' S/ ' + rep.caja.porCategoria[c].toFixed(2); }).join(', ') + '. ' +
        `Facturas: ${rep.facturas.emitidas} emitidas por S/ ${rep.facturas.totalFacturado.toFixed(2)}, ` +
        `${rep.facturas.cobradas} cobradas (S/ ${rep.facturas.totalCobrado.toFixed(2)}), ` +
        `${rep.facturas.pendientes} pendientes y ${rep.facturas.vencidas} vencidas ` +
        `(total por cobrar S/ ${rep.facturas.totalPendiente.toFixed(2)}).`;

      var promptReporte =
        'Con ESTOS datos exactos, y SOLO estos, redacta un resumen ejecutivo breve (máx 4 líneas) para el dueño de la empresa. ' +
        'No agregues cifras que no estén aquí. Datos: ' + datosTexto;

      var resultadoRep = await consultarGemini(promptReporte);
      if (resultadoRep.texto) {
        loaderRep.innerHTML = `📊 <b>Reporte ${escapeHTML(mesObjetivo.label)}</b><br><br>${escapeHTML(resultadoRep.texto)}`;
      } else {
        // Fallback sin IA: mostramos los datos crudos, siguen siendo reales
        loaderRep.innerHTML = `📊 <b>Reporte ${escapeHTML(mesObjetivo.label)}</b><br><br>${escapeHTML(datosTexto)}`;
      }
      return;
    }

    // D. Navegación entre módulos
    var matchNav = interpretarComandoEstatico(textoOriginal);
    if (matchNav) {
      if (matchNav.pagina === paginaActual()) {
        addMsg(`Ya estás en <b>${escapeHTML(matchNav.etiqueta)}</b> 😊`, 'bot');
      } else {
        addMsg(`¡Vamos a <b>${escapeHTML(matchNav.etiqueta)}</b>! 🚀`, 'bot');
        setTimeout(function () { window.location.href = matchNav.pagina; }, 750);
      }
      return;
    }

    // E. Lenguaje natural vía Gemini (proxy)
    var loaderIA = addMsg('<span class="cz-typing"></span> Pensando...', 'bot');
    var resultado = await consultarGemini(textoOriginal);

    if (resultado.texto) {
      loaderIA.innerHTML = escapeHTML(resultado.texto);
      historialChat.push({ rol: 'bot', texto: resultado.texto });
    } else if (resultado.error === 'sin_configurar') {
      loaderIA.innerHTML = 'Todavía no tengo mi conexión de IA configurada (falta la URL del proxy en <code>CONFIG.proxyUrl</code>). Mientras tanto pregúntame por el <b>saldo de caja</b>, <b>vencimientos</b> o dime <b>"ir a personal"</b>.';
    } else {
      loaderIA.innerHTML = 'No pude conectarme a mi cerebro de IA en este momento 🤔 Prueba preguntándome por el <b>saldo de caja</b>, <b>vencimientos</b> o un comando como <b>"ir a personal"</b>.';
    }
  }

  /* ---------------------------------------------------------------------
     8. RENDERIZADO DEL PANEL
  --------------------------------------------------------------------- */
  function renderPanel() {
    body.innerHTML = '';

    addMsg(`¡Hola! 🦺 ${obtenerSaludoSegunHora()}`, 'bot');

    var resumen = obtenerResumenAlertas();
    if (resumen && resumen.total > 0) {
      var detalleTxt = resumen.detalle.map(function (d) {
        return '• ' + escapeHTML(d.label) + ': <b>' + d.count + '</b>';
      }).join('<br>');
      addMsg('🔴 Encontré <b>' + resumen.total + '</b> pendiente' + (resumen.total > 1 ? 's' : '') + ' urgente' + (resumen.total > 1 ? 's' : '') + ':<br>' + detalleTxt, 'bot');
    } else {
      addMsg(randomDe(SIN_ALERTAS), 'bot');
    }

    var shortcuts = document.createElement('div');
    shortcuts.className = 'cz-shortcuts';
    shortcuts.innerHTML = `
      <div class="cz-chip" data-cmd="¿Cuánto hay en caja hoy?">💵 Saldo Caja</div>
      <div class="cz-chip" data-cmd="vencimientos">🚨 Vencimientos</div>
      <div class="cz-chip" data-cmd="personal">👷 Personal</div>
      <div class="cz-chip" data-cmd="facturas">🧾 Facturas</div>
      <div class="cz-chip" data-cmd="Dame el reporte de este mes">📊 Reporte del Mes</div>
    `;
    body.appendChild(shortcuts);

    body.querySelectorAll('.cz-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        procesarMensaje(chip.getAttribute('data-cmd'));
      });
    });
  }

  /* ---------------------------------------------------------------------
     9. EVENTOS E INICIALIZACIÓN
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
    procesarMensaje(val);
  }

  sendBtn.addEventListener('click', enviarDesdeInput);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') enviarDesdeInput();
  });

  function init() {
    MAPA_PAGINAS = construirMapaPaginas();

    bubble.textContent = obtenerSaludoSegunHora().replace(/<[^>]+>/g, '');
    setTimeout(function () {
      bubble.classList.add('show');
      setTimeout(function () { bubble.classList.remove('show'); }, 5000);
    }, 900);

    actualizarIndicador();
    setTimeout(actualizarIndicador, 2500);
    iniciarValidacionEnVivo();
  }

  // sidebar.js corre en DOMContentLoaded también; nos aseguramos de correr
  // después para que window.CARZE_NAV ya exista.
  function initDiferido() {
    setTimeout(init, 0);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDiferido);
  } else {
    initDiferido();
  }
})();
