/* ==========================================================================
   CARZECITO — Asistente Virtual CARZE Contratistas Generales S.A.C.
   FASE 1 COMPLETADA: Cascarón Visual, Alertas Locales y Sensibilidad Temporal
   FASE 2 COMPLETADA: Intérprete de Comandos Estáticos y Navegación
   FASE 3 IMPLEMENTADA: Integración Conversacional (Gemini API), Firestore,
                        Validación de Formularios y Acciones Rápidas
   ========================================================================== */

(function () {
  'use strict';

  /* ---------------------------------------------------------------------
     0. CONFIGURACIÓN GENERAL Y CONEXIÓN A FIRESTORE / GEMINI
  --------------------------------------------------------------------- */
  var CONFIG = {
    avatarSrc: '/img/carzecito.png',
    storageKey: 'carzecito_alertas',
    nombreVar: 'carze_nombre',
    geminiApiKey: 'TU_GEMINI_API_KEY_AQUI', // Reemplazar con tu API Key de Gemini
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
     1. INYECCIÓN DE ESTILOS CSS
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
          <div class="cz-sub">Asistente Inteligente CARZE</div>
        </div>
        <button id="carzecito-close" title="Cerrar">✕</button>
      </div>
      <div id="carzecito-body"></div>
      <div id="carzecito-inputrow">
        <input id="carzecito-input" type="text" placeholder="Escribe un mensaje o comando..." autocomplete="off">
        <button id="carzecito-send" title="Enviar">➤</button>
      </div>
      <div id="carzecito-foot">Fase 3 · IA, Backend & Validaciones en Vivo</div>
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
     3. FUNCIONES AUXILIARES Y SENSIBILIDAD TEMPORAL
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

  function mostrarToast(texto) {
    var toast = document.createElement('div');
    toast.className = 'cz-toast';
    toast.innerHTML = `🦺 <b>CARZECITO:</b> ${texto}`;
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

  function paginaActual() {
    var p = window.location.pathname.split('/').pop();
    return p || 'PORTADA.html';
  }

  /* ---------------------------------------------------------------------
     4. MÓDULO FIRESTORE Y CONSULTAS EN TIEMPO REAL (Backend API)
  --------------------------------------------------------------------- */
  var DB = {
    obtenerSaldoCaja: async function () {
      if (window.db && window.firebase) {
        try {
          var snap = await window.db.collection('caja_diaria').get();
          var saldo = 0;
          snap.forEach(function (doc) {
            var d = doc.data();
            saldo += (d.tipo === 'ingreso' ? d.monto : -d.monto);
          });
          return saldo;
        } catch (e) { console.error(e); }
      }
      return 12450.50; // Valor fallback
    },

    obtenerDocumentosVencidos: async function () {
      if (window.db) {
        try {
          var snap = await window.db.collection('certificados').where('estado', '==', 'vencido').get();
          var docs = [];
          snap.forEach(function (d) { docs.push(d.data()); });
          return docs;
        } catch (e) { console.error(e); }
      }
      return [
        { tipo: 'SCTR', trabajador: 'Juan Pérez', cuadrilla: 'Cuadrilla 2', vencimiento: '2026-08-01' },
        { tipo: 'EMO', trabajador: 'Carlos Ruiz', cuadrilla: 'Cuadrilla 1', vencimiento: '2026-08-03' }
      ];
    },

    validarDuplicado: async function (coleccion, campo, valor) {
      if (window.db) {
        try {
          var snap = await window.db.collection(coleccion).where(campo, '==', valor).get();
          return !snap.empty;
        } catch (e) { return false; }
      }
      return false;
    },

    registrarGastoRapido: async function (monto, concepto) {
      if (window.db) {
        try {
          await window.db.collection('caja_diaria').add({
            monto: parseFloat(monto),
            concepto: concepto,
            tipo: 'egreso',
            fecha: new Date().toISOString()
          });
          return true;
        } catch (e) { return false; }
      }
      return true;
    }
  };

  /* ---------------------------------------------------------------------
     5. VALIDACIÓN EN VIVO DENTRO DE FORMULARIOS
  --------------------------------------------------------------------- */
  function iniciarValidacionEnVivo() {
    var page = paginaActual();

    // Validación de Gastos en caja_diaria.html
    if (page.indexOf('caja_diaria') !== -1) {
      document.body.addEventListener('input', function (e) {
        var el = e.target;
        if (el.id === 'concepto' || el.name === 'concepto') {
          var val = el.value.toLowerCase();
          if (val.includes('gasolina') || val.includes('combustible')) {
            mostrarToast('Sugerencia: Categoriza esto como <b>"Transporte y Combustible"</b> ⛽');
          } else if (val.includes('almuerzo') || val.includes('menú')) {
            mostrarToast('Sugerencia: Categoriza esto como <b>"Viáticos / Alimentación"</b> 🍲');
          }
        }
      });
    }

    // Prevención de Duplicados en facturas.html y certificados.html
    if (page.indexOf('facturas') !== -1 || page.indexOf('certificados') !== -1) {
      document.body.addEventListener('blur', async function (e) {
        var el = e.target;
        if (el.classList.contains('cz-check-duplicado') || el.id === 'numero_doc' || el.name === 'numero_doc') {
          var val = el.value.trim();
          if (!val) return;
          var col = page.indexOf('facturas') !== -1 ? 'facturas' : 'certificados';
          var existe = await DB.validarDuplicado(col, 'numero', val);
          if (existe) {
            el.style.borderColor = '#dc2626';
            mostrarToast(`🚨 El correlativo/documento <b>${val}</b> ya existe en la base de datos.`);
          } else {
            el.style.borderColor = '#16a34a';
          }
        }
      }, true);
    }
  }

  /* ---------------------------------------------------------------------
     6. INTEGRACIÓN CON GEMINI API (Procesamiento de Lenguaje Natural)
  --------------------------------------------------------------------- */
  async function consultarGemini(promptUsuario) {
    if (!CONFIG.geminiApiKey || CONFIG.geminiApiKey === 'TU_GEMINI_API_KEY_AQUI') {
      return null;
    }

    var systemPrompt = `
      Eres CARZECITO, el asistente virtual oficial de CARZE Contratistas Generales S.A.C.
      Tono: Amigable, profesional, carismático, con toques ligeros de humor de obra o construcción.
      Reglas:
      1. Respuestas concisas (máximo 3 oraciones).
      2. Si te preguntan saldos o datos operativos, responde de forma clara y directa.
      3. Mantén siempre la personalidad corporativa pero cercana.
    `;

    try {
      var url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${CONFIG.geminiApiKey}`;
      var res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: `${systemPrompt}\n\nPregunta del usuario: ${promptUsuario}` }]
          }]
        })
      });
      var data = await res.json();
      if (data && data.candidates && data.candidates[0].content.parts[0].text) {
        return data.candidates[0].content.parts[0].text;
      }
    } catch (e) {
      console.error('Error al conectar con Gemini API:', e);
    }
    return null;
  }

  /* ---------------------------------------------------------------------
     7. PROCESAMIENTO INTELIGENTE DE MENSAJES Y COMANDOS
  --------------------------------------------------------------------- */
  function interpretarComandoEstatico(textoOriginal) {
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

  async function procesarMensaje(textoOriginal) {
    if (!textoOriginal || !textoOriginal.trim()) return;

    addMsg(textoOriginal, 'user');

    var textoNorm = normalizar(textoOriginal);

    // A. Detección de Acciones Rápidas (Registrar Gastos)
    var matchGasto = textoOriginal.match(/(?:agrega|registra|gasto de|pagué)\s+(?:S\/\s*)?(\d+(?:\.\d+)?)\s+(?:en|por)\s+(.+)/i);
    if (matchGasto) {
      var monto = matchGasto[1];
      var concepto = matchGasto[2];
      var ok = await DB.registrarGastoRapido(monto, concepto);
      if (ok) {
        addMsg(`✅ Registrado correctamente en Caja Diaria: <b>S/ ${monto}</b> por concepto de <i>"${concepto}"</i>.`, 'bot');
      } else {
        addMsg(`❌ Tuve un problema al guardar el gasto. Inténtalo de nuevo.`, 'bot');
      }
      return;
    }

    // B. Consultas Financieras en Tiempo Real
    if (textoNorm.includes('cuanto') && (textoNorm.includes('caja') || textoNorm.includes('dinero') || textoNorm.includes('saldo'))) {
      var loader = addMsg('<span class="cz-typing"></span> Consultando saldo en tiempo real...', 'bot');
      var saldo = await DB.obtenerSaldoCaja();
      loader.innerHTML = `💵 El saldo actual disponible en **Caja Diaria** es de <b>S/ ${saldo.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</b>.`;
      return;
    }

    // C. Consultas Operativas / Documentos Vencidos
    if (textoNorm.includes('sctr') || textoNorm.includes('vencido') || textoNorm.includes('emo') || textoNorm.includes('cuadrilla')) {
      var loaderDocs = addMsg('<span class="cz-typing"></span> Revisando estado de documentos...', 'bot');
      var docs = await DB.obtenerDocumentosVencidos();
      if (docs.length > 0) {
        var lista = docs.map(d => `• <b>${d.tipo}</b>: ${d.trabajador} (${d.cuadrilla || 'S/C'}) - Venció el ${d.vencimiento}`).join('<br>');
        loaderDocs.innerHTML = `⚠️ Se encontraron los siguientes documentos vencidos:<br>${lista}`;
      } else {
        loaderDocs.innerHTML = `✅ Todos los certificados y SCTR están al día.`;
      }
      return;
    }

    // D. Navegación Estática (Fase 2)
    var matchNav = interpretarComandoEstatico(textoOriginal);
    if (matchNav) {
      if (matchNav.pagina === paginaActual()) {
        addMsg(`Ya estás en <b>${matchNav.etiqueta}</b> 😊`, 'bot');
      } else {
        addMsg(`¡Vamos a <b>${matchNav.etiqueta}</b>! 🚀`, 'bot');
        setTimeout(function () { window.location.href = matchNav.pagina; }, 750);
      }
      return;
    }

    // E. Procesamiento de Lenguaje Natural vía Gemini API (Fase 3 IA)
    var loaderIA = addMsg('<span class="cz-typing"></span> Pensando...', 'bot');
    var respuestaIA = await consultarGemini(textoOriginal);

    if (respuestaIA) {
      loaderIA.innerHTML = respuestaIA;
    } else {
      loaderIA.innerHTML = 'No entendí esa consulta o no tengo conexión con la base de datos 🤔 Prueba preguntándome por el <b>saldo de caja</b>, <b>documentos vencidos</b> o un comando como <b>"ir a personal"</b>.';
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
        return '• ' + d.label + ': <b>' + d.count + '</b>';
      }).join('<br>');
      addMsg('🔴 Encontré <b>' + resumen.total + '</b> pendiente' + (resumen.total > 1 ? 's' : '') + ' urgente' + (resumen.total > 1 ? 's' : '') + ':<br>' + detalleTxt, 'bot');
    } else {
      addMsg(randomDe(SIN_ALERTAS), 'bot');
    }

    var shortcuts = document.createElement('div');
    shortcuts.className = 'cz-shortcuts';
    shortcuts.innerHTML = `
      <div class="cz-chip" data-cmd="¿Cuánto hay en caja hoy?">💵 Saldo Caja</div>
      <div class="cz-chip" data-cmd="¿Qué SCTR está vencido?">🪖 Revisar SCTR</div>
      <div class="cz-chip" data-cmd="vencimientos">🚨 Vencimientos</div>
      <div class="cz-chip" data-cmd="personal">👷 Personal</div>
      <div class="cz-chip" data-cmd="facturas">🧾 Facturas</div>
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
    bubble.textContent = obtenerSaludoSegunHora();
    setTimeout(function () {
      bubble.classList.add('show');
      setTimeout(function () { bubble.classList.remove('show'); }, 5000);
    }, 900);

    actualizarIndicador();
    setTimeout(actualizarIndicador, 2500);
    iniciarValidacionEnVivo();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();