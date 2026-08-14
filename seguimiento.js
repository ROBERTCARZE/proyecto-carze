/* ==========================================================================
   SEGUIMIENTO.JS — Lógica del módulo de Seguimiento
   CARZE Contratistas Generales S.A.C.
   --------------------------------------------------------------------------
   Extraído de seguimiento.html tal cual estaba (mismo comportamiento, cero
   cambios de lógica) — quinto módulo separado.
   ========================================================================== */
import { initializeApp }    from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";
import { getFirestore, collection, onSnapshot, getDocs,
         addDoc, updateDoc, setDoc, doc, query, orderBy } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey:"AIzaSyAk1FGQia36Y2G08L-_mscMv5JnozmPYa0",
    authDomain:"gestioncarze.firebaseapp.com",
    projectId:"gestioncarze",
    storageBucket:"gestioncarze.firebasestorage.app",
    messagingSenderId:"487407475826",
    appId:"1:487407475826:web:32185a60f0123a5d25f6eb"
};
const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);
    const auth = getAuth(app);

// ── ESTADO ────────────────────────────────────────────────────
var datosCot  = [];
var datosCert = [];
var seguData  = {}; // {docId: {responsable, ...}}
var responsables = [];

// ── CIERRE DE PROYECTOS: datos sin filtrar por estado (necesitamos
//    encontrar el proyecto de origen sin importar si ya está Facturado) ──
var todasCot  = [];
var todasCert = [];
var datosPresu = [];
var tabActual = 'cot';
var filtCot  = [];
var filtCert = [];

const RESP_BASE = [
    'Hector Ramirez','Jorge Hurtado','Pedro Morello','Gianmarcos Valencia',
    'Pablo Aranda','Jhonatan Martos','Joan Chinchay','Antonella Noriega',
    'Yeinner Guerrero','Gerardo Inga','Victor Porta','Denner Salcedo',
    'Kenneth Esteban','Diana Ogawa'
];
const ESTADOS_PENDIENTES = ['pendiente','observado'];

// ── SESIÓN ────────────────────────────────────────────────────
// Verificar autenticación Firebase real
    onAuthStateChanged(auth, function(user){
        if(!user){
            window.location.replace('index.html');
            return;
        }
        // Mantener nombre en sessionStorage para mostrar en UI
        if(!sessionStorage.getItem('carze_nombre') && user.email){
            var nombres = {
                'proyectos@carzesac.com': 'Jans Carrillo',
                'logistica@carzesac.com': 'Edwduar Carrillo',
                'informes@carzesac.com':  'Jhonny Carrillo',
                'robertcz@carzesac.com':  'Robert Carrillo Zeña',
            };
            sessionStorage.setItem('carze_logged','true');
            sessionStorage.setItem('carze_nombre', nombres[user.email]||user.email.split('@')[0]);
            sessionStorage.setItem('carze_uid',    user.uid);
            sessionStorage.setItem('carze_email',  user.email);
        }
    });

window.addEventListener('DOMContentLoaded', function(){
    var n=sessionStorage.getItem('carze_nombre')||'Usuario';
    document.getElementById('userName').textContent=n;
    document.getElementById('avatarInitials').textContent=
        n.split(' ').map(function(p){return p[0]||'';}).slice(0,2).join('').toUpperCase()||'U';
    cargarResponsables();
    iniciarListeners();
});

// ── RESPONSABLES ──────────────────────────────────────────────
async function cargarResponsables(){
    try {
        const snap = await getDocs(collection(db,'responsables'));
        if(snap.empty){
            for(var r of RESP_BASE) await addDoc(collection(db,'responsables'),{nombre:r});
            responsables = [...RESP_BASE];
        } else {
            responsables = snap.docs.map(function(d){return d.data().nombre;});
            responsables.sort();
        }
    } catch(e){ responsables=[...RESP_BASE]; }
    poblarSelectResp();
}

function poblarSelectResp(){
    var sel = document.getElementById('filterResp');
    var cur = sel.value;
    sel.innerHTML = '<option value="">Todos los responsables</option>';
    responsables.forEach(function(r){
        var op=document.createElement('option');
        op.value=r; op.textContent=r; sel.appendChild(op);
    });
    if(cur) sel.value=cur;
    // poblar también los selects inline de las tablas
    renderTablas();
}

function abrirModalResp(){
    document.getElementById('respInput').value='';
    document.getElementById('overlay').classList.add('open');
    setTimeout(function(){document.getElementById('respInput').focus();},200);
}
window.abrirModalResp=abrirModalResp;

function cerrarModalResp(){document.getElementById('overlay').classList.remove('open');}
window.cerrarModalResp=cerrarModalResp;

async function guardarResp(){
    var nombre=document.getElementById('respInput').value.trim();
    if(!nombre){toast('Escribe el nombre','err');return;}
    if(responsables.map(function(r){return r.toLowerCase();}).includes(nombre.toLowerCase())){
        toast('Ya existe','warn');return;
    }
    var btn=document.getElementById('respBtnTxt');
    btn.innerHTML='<span class="spinner"></span>';
    try{
        await addDoc(collection(db,'responsables'),{nombre:nombre});
        responsables.push(nombre); responsables.sort();
        poblarSelectResp();
        toast('"'+nombre+'" agregado ✓','ok');
        cerrarModalResp();
    }catch(err){toast('Error: '+err.message,'err');}
    btn.textContent='GUARDAR';
}
window.guardarResp=guardarResp;

// ── LISTENERS TIEMPO REAL ─────────────────────────────────────
function iniciarListeners(){
    // Seguimiento metadata
    onSnapshot(collection(db,'seguimiento'), function(snap){
        seguData={};
        snap.docs.forEach(function(d){seguData[d.id]=d.data();});
        renderTablas();
    });

    // Cotizaciones — solo pendientes/observados
    onSnapshot(query(collection(db,'cotizaciones'),orderBy('num','asc')), function(snap){
        datosCot = snap.docs
            .map(function(d){var r=d.data();r._id=d.id;return r;})
            .filter(function(r){return ESTADOS_PENDIENTES.includes((r.estado||'').toLowerCase());});
        poblarFiltrosSelect();
        aplicarFiltros();
    });

    // Certificados — solo pendientes/observados
    onSnapshot(query(collection(db,'certificados'),orderBy('num','asc')), function(snap){
        datosCert = snap.docs
            .map(function(d){var r=d.data();r._id=d.id;return r;})
            .filter(function(r){return ESTADOS_PENDIENTES.includes((r.estado||'').toLowerCase());});
        poblarFiltrosSelect();
        aplicarFiltros();
    });

    // Cotizaciones — TODAS (sin filtrar estado), para Cierre de Proyectos
    onSnapshot(collection(db,'cotizaciones'), function(snap){
        todasCot = snap.docs.map(function(d){var r=d.data();r._id=d.id;return r;});
        renderCierre(); actualizarContadorCierre();
    });
    // Certificados — TODOS (sin filtrar estado), para Cierre de Proyectos
    onSnapshot(collection(db,'certificados'), function(snap){
        todasCert = snap.docs.map(function(d){var r=d.data();r._id=d.id;return r;});
        renderCierre(); actualizarContadorCierre();
    });
    // Presupuestos — para saber qué proyectos ya están Finalizados
    onSnapshot(collection(db,'presupuestos'), function(snap){
        datosPresu = snap.docs.map(function(d){return d.data();});
        renderCierre(); actualizarContadorCierre();
    });
}

// ── POBLAR FILTROS ZONA / CLIENTE ─────────────────────────────
function poblarFiltrosSelect(){
    var todos = datosCot.concat(datosCert);
    var zonas   = [...new Set(todos.map(function(r){return r.zona||'';}).filter(Boolean))].sort();
    var clientes= [...new Set(todos.map(function(r){return r.cliente||'';}).filter(Boolean))].sort();

    var sz=document.getElementById('filterZona');
    var sc=document.getElementById('filterCliente');
    var vz=sz.value, vc=sc.value;

    sz.innerHTML='<option value="">Todas las zonas</option>';
    zonas.forEach(function(z){var o=document.createElement('option');o.value=z;o.textContent=z;sz.appendChild(o);});
    sz.value=vz;

    sc.innerHTML='<option value="">Todos los clientes</option>';
    clientes.forEach(function(c){var o=document.createElement('option');o.value=c;o.textContent=c;sc.appendChild(o);});
    sc.value=vc;
}

// ── FILTROS ───────────────────────────────────────────────────
function aplicarFiltros(){
    var q   = document.getElementById('searchInput').value.toLowerCase().trim();
    var resp= document.getElementById('filterResp').value;
    var zona= document.getElementById('filterZona').value;
    var cli = document.getElementById('filterCliente').value;

    function filtrar(arr){
        return arr.filter(function(r){
            var seg = seguData[r._id]||{};
            var mQ  = !q||[r.num,r.zona,r.cliente,r.desc,r.cotNombre,r.certNombre,seg.responsable].some(function(v){return String(v||'').toLowerCase().includes(q);});
            var mR  = !resp||(seg.responsable||'')=== resp;
            var mZ  = !zona||(r.zona||'')===zona;
            var mC  = !cli ||(r.cliente||'')===cli;
            return mQ&&mR&&mZ&&mC;
        });
    }

    filtCot  = filtrar(datosCot);
    filtCert = filtrar(datosCert);

    document.getElementById('cntCot').textContent  = filtCot.length;
    document.getElementById('cntCert').textContent = filtCert.length;
    document.getElementById('badgeCot').textContent  = filtCot.length+' pendiente'+(filtCot.length!==1?'s':'');
    document.getElementById('badgeCert').textContent = filtCert.length+' pendiente'+(filtCert.length!==1?'s':'');

    renderTablas();
}
window.aplicarFiltros=aplicarFiltros;

// ── CAMBIAR TAB ───────────────────────────────────────────────
function cambiarTab(tab){
    tabActual=tab;
    document.getElementById('vistaCot').style.display        = tab==='cot'?'block':'none';
    document.getElementById('vistaCert').style.display       = tab==='cert'?'block':'none';
    document.getElementById('vistaCierre').style.display     = tab==='cierre'?'block':'none';
    document.getElementById('vistaPendientes').style.display = tab==='pendientes'?'block':'none';
    ['cot','cert','cierre','pendientes'].forEach(function(t){
        document.getElementById('tab'+t.charAt(0).toUpperCase()+t.slice(1)).classList.toggle('active',t===tab);
    });
    renderTablas();
}
window.cambiarTab=cambiarTab;

// ── HELPERS ───────────────────────────────────────────────────
function hoy(){var d=new Date();return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate());}
function p2(n){return n<10?'0'+n:String(n);}
function fmt(n){return parseFloat(n||0).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2});}
function esc(v){return v!=null&&v!==''&&v!=='-'?String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;'):'—';}
function fmtF(v){if(!v||v==='-'||v==='—')return '—';var s=String(v).trim();if(s.match(/^\d{4}-\d{2}-\d{2}/)){var p=s.substring(0,10).split('-');return p[2]+'/'+p[1]+'/'+p[0];}return s;}

function diasDesde(fecha){
    if(!fecha||fecha==='-') return null;
    var s=String(fecha).trim();
    var base=s.match(/^\d{4}-\d{2}-\d{2}/)?s.substring(0,10):s.split('/').length===3?s.split('/')[2]+'-'+s.split('/')[1]+'-'+s.split('/')[0]:null;
    if(!base) return null;
    var d=new Date(base+'T00:00:00'), h=new Date(); h.setHours(0,0,0,0);
    return Math.round((h-d)/(1000*60*60*24));
}

function diasEntre(f1,f2){
    if(!f1||!f2) return null;
    var d1=new Date(String(f1).substring(0,10)+'T00:00:00');
    var d2=new Date(String(f2).substring(0,10)+'T00:00:00');
    return Math.round((d2-d1)/(1000*60*60*24));
}

function diasBadge(dias){
    if(dias===null) return '—';
    if(dias<=15) return '<span class="dias-ok">'+dias+' días</span>';
    if(dias<=30) return '<span class="dias-warn">'+dias+' días</span>';
    return '<span class="dias-late">'+dias+' días</span>';
}

function tieneDoc(v){return v&&v!=='-'&&v!=='—'&&v!=='0'&&v!==0;}

function docBadge(v){
    return tieneDoc(v)
        ? '<span class="doc-badge doc-si">✅ Sí</span>'
        : '<span class="doc-badge doc-no">➖ No</span>';
}

// Muestra el N° real de cotización (ej. DL-124-2026.pdf) como link, no solo
// un Sí/No — para no tener que ir a otro módulo a buscarlo.
function refCotizacion(nombre, link){
    if(!tieneDoc(nombre)) return '<span style="color:#cbd5e1">—</span>';
    if(tieneDoc(link)) return '<a href="'+String(link).replace(/"/g,'&quot;')+'" target="_blank" rel="noopener" class="ref-cot-link">'+esc(nombre)+'</a>';
    return '<span class="ref-cot-link" style="cursor:default">'+esc(nombre)+'</span>';
}

// avance: campos a verificar para cot vs cert
function calcAvanceCot(r){
    var checks=[tieneDoc(r.cotNombre),tieneDoc(r.infNombre),tieneDoc(r.actaNombre),tieneDoc(r.ocNombre),tieneDoc(r.hes)&&r.hes!=='0'];
    var ok=checks.filter(Boolean).length;
    return {ok:ok,total:checks.length,pct:Math.round(ok/checks.length*100)};
}
function calcAvanceCert(r){
    var checks=[tieneDoc(r.certNombre),tieneDoc(r.infNombre),tieneDoc(r.actaNombre),tieneDoc(r.ocNombre),tieneDoc(r.hes)&&r.hes!=='0'];
    var ok=checks.filter(Boolean).length;
    return {ok:ok,total:checks.length,pct:Math.round(ok/checks.length*100)};
}

function progColor(pct){
    if(pct===100) return '#16a34a';
    if(pct>=60)   return '#f59e0b';
    return '#dc2626';
}

function respSelect(docId, currentResp){
    var html='<select class="resp-select" onchange="guardarResp2(\''+docId+'\',this.value)">';
    html+='<option value="">— Asignar —</option>';
    responsables.forEach(function(r){
        html+='<option value="'+r+'"'+(r===currentResp?' selected':'')+'>'+r+'</option>';
    });
    html+='</select>';
    return html;
}

async function guardarResp2(docId, resp){
    try{
        await setDoc(doc(db,'seguimiento',docId),{responsable:resp},{merge:true});
        toast('Responsable actualizado ✓','ok');
    }catch(err){toast('Error: '+err.message,'err');}
}
window.guardarResp2=guardarResp2;

function toast(msg,tipo){
    var t=document.getElementById('toast');
    t.textContent=msg;t.className='toast '+(tipo||'ok');t.classList.add('show');
    setTimeout(function(){t.classList.remove('show');},2800);
}

// ── CIERRE DE PROYECTOS ─────────────────────────────────────────
// Construye la lista de proyectos ya Finalizados en Presupuesto (con
// fechaFin registrada), cruzando con los datos de origen (Cotización o
// Certificado) y con el responsable ya asignado en Seguimiento — nada
// de esto se duplica, todo se lee en vivo desde su módulo original.
function proyectosCerrados(){
    var out=[];
    datosPresu.forEach(function(p){
        if(!p.fechaFin) return; // solo proyectos ya finalizados
        var lista = p.origen==='cotizacion' ? todasCot : todasCert;
        var orig = lista.find(function(r){return r._id===p.proyectoId;});
        if(!orig) return;
        var seg = seguData[orig._id] || {};
        out.push({
            id: orig._id, origen: p.origen,
            num: orig.num, zona: orig.zona, cliente: orig.cliente, desc: orig.desc,
            cotNombre: orig.cotNombre, cotLink: orig.cotLink,
            subtotal: orig.subtotal, responsable: seg.responsable||'',
            fechaEnvioDoc: seg.fechaEnvioDoc||'', contacto1: seg.contacto1||'',
            contactoUlt: seg.contactoUlt||'', observacionCierre: seg.observacionCierre||'',
            cerrado: !!seg.cerrado, fechaCierre: seg.fechaCierre||'',
            fechaFin: p.fechaFin
        });
    });
    out.sort(function(a,b){return (b.fechaFin||'').localeCompare(a.fechaFin||'');});
    return out;
}

function actualizarContadorCierre(){
    var n=proyectosCerrados().length;
    document.getElementById('cntCierre').textContent=n;
    document.getElementById('badgeCierre').textContent=n+' finalizado'+(n!==1?'s':'');
}

function renderCierre(){
    var lista=proyectosCerrados();
    window.__cierreCache=lista;
    var tbody=document.getElementById('bodyCierre');
    var empty=document.getElementById('emptyCierre');
    if(!lista.length){
        tbody.innerHTML=''; empty.style.display='block';
        return;
    }
    empty.style.display='none';

    // Los servicios ya "Cerrados" van al final, sin alterar el orden de
    // los que siguen pendientes/en proceso arriba (orden estable).
    var pendientes=[], cerrados=[];
    lista.forEach(function(r){ (r.cerrado?cerrados:pendientes).push(r); });
    lista=pendientes.concat(cerrados);

    var html='';
    lista.forEach(function(r){
        var dias=diasEntre(r.contacto1, r.contactoUlt);
        var diasHtml = dias!==null
            ? '<span class="dias-badge ok">'+dias+' día'+(dias!==1?'s':'')+'</span>'
            : '<span class="dias-badge sindatos">—</span>';

        var alertaHtml='';
        if(r.cerrado){
            // Servicio cerrado: ya no se sigue contando el tiempo sin respuesta,
            // por más días reales que pasen desde hoy.
            alertaHtml=' <span class="dias-badge cerrado" title="Cerrado el '+fmtF(r.fechaCierre)+'">🔒 Cerrado</span>';
        }else{
            // Alerta: más de 3 días sin actualizar el Último Contacto (respecto a hoy)
            var diasSinContacto = r.contactoUlt ? diasDesde(r.contactoUlt) : null;
            var alerta = diasSinContacto!==null && diasSinContacto>3;
            alertaHtml = alerta
                ? ' <span class="dias-badge alerta" title="Sin actualizar hace '+diasSinContacto+' días">⚠️ '+diasSinContacto+'d sin respuesta</span>'
                : '';
        }

        var btnCierre = r.cerrado
            ? '<button class="btn-cierre reabrir" onclick="toggleCierreServicio(\''+r.id+'\',false)" title="Reabrir seguimiento">🔓</button>'
            : '<button class="btn-cierre" onclick="toggleCierreServicio(\''+r.id+'\',true)" title="Cerrar servicio (detiene el conteo de días)">🔒</button>';

        html+='<tr'+(r.cerrado?' class="fila-cerrada"':'')+'>'+
            '<td>'+esc(r.num)+'</td>'+
            '<td>'+esc(r.zona)+'</td>'+
            '<td>'+esc(r.cliente)+'</td>'+
            '<td style="white-space:normal;min-width:170px">'+esc(r.desc)+'</td>'+
            '<td>'+refCotizacion(r.cotNombre,r.cotLink)+'</td>'+
            '<td>S/ '+fmt(r.subtotal)+'</td>'+
            '<td><span class="resp-readonly'+(r.responsable?' asignado':'')+'">'+(r.responsable||'Sin asignar')+'</span></td>'+
            '<td><input class="cierre-input" type="date" value="'+(r.fechaEnvioDoc||'')+'" '+(r.cerrado?'disabled':'')+' onblur="guardarCampoCierre(\''+r.id+'\',\'fechaEnvioDoc\',this.value)"></td>'+
            '<td><input class="cierre-input" type="date" value="'+(r.contacto1||'')+'" '+(r.cerrado?'disabled':'')+' onblur="guardarCampoCierre(\''+r.id+'\',\'contacto1\',this.value)"></td>'+
            '<td><input class="cierre-input" type="date" value="'+(r.contactoUlt||'')+'" '+(r.cerrado?'disabled':'')+' onblur="guardarCampoCierre(\''+r.id+'\',\'contactoUlt\',this.value)"></td>'+
            '<td>'+diasHtml+alertaHtml+'</td>'+
            '<td><input class="cierre-input cierre-obs" type="text" placeholder="Ej: No respondió el correo" value="'+String(r.observacionCierre||'').replace(/"/g,'&quot;')+'" '+(r.cerrado?'disabled':'')+' onblur="guardarCampoCierre(\''+r.id+'\',\'observacionCierre\',this.value)"></td>'+
            '<td style="white-space:nowrap">'+
                '<button class="btn-mail" onclick="enviarCorreoProyecto(\''+r.id+'\')" title="Copiar mensaje y abrir Zoho Mail">✉️</button> '+
                btnCierre+
            '</td>'+
        '</tr>';
    });
    tbody.innerHTML=html;
}

// Cierra (o reabre) el seguimiento de un servicio. Al cerrar, se guarda la
// fecha de cierre — de ahí en adelante el conteo de "días sin respuesta" se
// congela y deja de sumar días reales, aunque pase el tiempo. No se borra
// ni se toca ningún otro dato: solo se agregan 2 campos (cerrado, fechaCierre)
// al mismo documento de seguimiento que ya existía.
async function toggleCierreServicio(id, cerrar){
    if(cerrar && !confirm('¿Cerrar el seguimiento de este servicio?\n\nDejará de contar los días sin respuesta. Puedes reabrirlo cuando quieras.')) return;
    try{
        var data = cerrar
            ? {cerrado:true, fechaCierre: hoy()}
            : {cerrado:false, fechaCierre:''};
        await setDoc(doc(db,'seguimiento',id), data, {merge:true});
        toast(cerrar?'Servicio cerrado ✓':'Servicio reabierto ✓','ok');
    }catch(err){ toast('Error: '+err.message,'err'); }
}
window.toggleCierreServicio=toggleCierreServicio;

async function guardarCampoCierre(docId, campo, valor){
    try{
        var data={}; data[campo]=valor;
        await setDoc(doc(db,'seguimiento',docId), data, {merge:true});
        toast('Guardado ✓','ok');
    }catch(err){ toast('Error: '+err.message,'err'); }
}
window.guardarCampoCierre=guardarCampoCierre;

function textoCorreoProyecto(r){
    var asunto='Seguimiento cierre de proyecto — '+(r.cliente||'')+' ('+(r.num||'')+')';
    var cuerpo=
        'Para: robertcz@carzesac.com\n'+
        'Asunto: '+asunto+'\n\n'+
        'Proyecto: '+(r.desc||'—')+'\n'+
        'Cliente: '+(r.cliente||'—')+'\n'+
        'Zona: '+(r.zona||'—')+'\n'+
        'Sub Total: S/ '+fmt(r.subtotal)+'\n'+
        'Responsable: '+(r.responsable||'Sin asignar')+'\n'+
        'Fecha de envío de documentos: '+fmtF(r.fechaEnvioDoc)+'\n'+
        '1er Contacto: '+fmtF(r.contacto1)+'\n'+
        'Último Contacto: '+fmtF(r.contactoUlt)+'\n'+
        (r.observacionCierre?('Observación: '+r.observacionCierre+'\n'):'')+
        '\n(Mensaje generado desde el módulo de Seguimiento — CARZE)';
    return {asunto:asunto, cuerpo:cuerpo};
}

async function enviarCorreoProyecto(id){
    var r=(window.__cierreCache||[]).find(function(x){return x.id===id;});
    if(!r) return;
    var msg=textoCorreoProyecto(r);
    var textoCompleto=msg.cuerpo;

    try{
        await navigator.clipboard.writeText(textoCompleto);
        toast('Mensaje copiado ✓ — se abrió Zoho Mail, solo pega y envía','ok');
    }catch(e){
        toast('Se abrió Zoho Mail (no se pudo copiar el mensaje automáticamente, cópialo manualmente)','err');
    }
    window.open('https://mail.zoho.com/zm/#mail/compose','_blank');
}
window.enviarCorreoProyecto=enviarCorreoProyecto;

// ── RENDER TABLAS ─────────────────────────────────────────────
function renderTablas(){
    if(tabActual==='cot') renderTablaCot();
    else if(tabActual==='cert') renderTablaCert();
    else if(tabActual==='cierre') renderCierre();
    actualizarContadorCierre();
}

function filaTabla(r, calcFn, docField){
    var seg=seguData[r._id]||{};
    var av=calcFn(r);
    var dias=diasDesde(r.fecha);
    var docVal = docField==='cot'?r.cotNombre:r.certNombre;
    return '<tr>'+
        '<td>'+esc(r.num)+'</td>'+
        '<td>'+esc(r.zona)+'</td>'+
        '<td>'+esc(r.cliente)+'</td>'+
        '<td class="desc-col">'+esc(r.desc)+'</td>'+
        '<td>'+refCotizacion(r.cotNombre,r.cotLink)+'</td>'+
        '<td>'+docBadge(docVal)+'</td>'+
        '<td>'+docBadge(r.infNombre)+'</td>'+
        '<td>'+docBadge(r.actaNombre)+'</td>'+
        '<td>S/ '+fmt(r.subtotal)+'</td>'+
        '<td>'+docBadge(r.ocNombre)+'</td>'+
        '<td>'+docBadge(r.hes&&r.hes!=='0'?r.hes:null)+'</td>'+
        '<td>'+diasBadge(dias)+'</td>'+
        '<td class="prog-cell">'+
            '<span class="prog-txt" style="color:'+progColor(av.pct)+'">'+av.pct+'%</span>'+
            '<div class="prog-bar-bg"><div class="prog-bar-fill" style="width:'+av.pct+'%;background:'+progColor(av.pct)+'"></div></div>'+
        '</td>'+
        '<td>'+respSelect(r._id, seg.responsable||'')+'</td>'+
        '<td><span style="font-size:.65rem;font-weight:700;padding:3px 8px;border-radius:20px;background:#fef9c3;color:#a16207;border:1px solid #fde68a">'+esc(r.estado)+'</span></td>'+
    '</tr>';
}

function renderTablaCot(){
    var tbody=document.getElementById('bodyCot');
    var empty=document.getElementById('emptyCot');
    tbody.innerHTML='';
    if(!filtCot.length){empty.style.display='block';return;}
    empty.style.display='none';
    filtCot.forEach(function(r){tbody.innerHTML+=filaTabla(r,calcAvanceCot,'cot');});
}

function renderTablaCert(){
    var tbody=document.getElementById('bodyCert');
    var empty=document.getElementById('emptyCert');
    tbody.innerHTML='';
    if(!filtCert.length){empty.style.display='block';return;}
    empty.style.display='none';
    filtCert.forEach(function(r){tbody.innerHTML+=filaTabla(r,calcAvanceCert,'cert');});
}

function cerrarSesion(){
        signOut(auth).then(function(){
            sessionStorage.clear();
            window.location.replace('index.html');
        }).catch(function(){
            sessionStorage.clear();
            window.location.replace('index.html');
        });
    }
window.cerrarSesion=cerrarSesion;

// ── EXPORTAR PDF ──────────────────────────────────────────────
function generarPDF(){
    var btn = document.getElementById('btnPDF');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Generando...';

    try {
        var { jsPDF } = window.jspdf;
        var doc = new jsPDF({ orientation:'landscape', unit:'mm', format:'a4' });

        var hoyStr = new Date().toLocaleDateString('es-PE',{day:'2-digit',month:'2-digit',year:'numeric'});
        var nombreUsuario = sessionStorage.getItem('carze_nombre') || 'Usuario';

        // Paleta de colores
        var azul   = [26, 58, 107];
        var naranja = [249, 115, 22];
        var gris   = [248, 250, 252];
        var bordeg = [228, 232, 239];

        var pageW = 297, pageH = 210;

        function dibujarCabecera(tipo){
            // Franja superior
            doc.setFillColor(azul[0], azul[1], azul[2]);
            doc.rect(0, 0, pageW, 22, 'F');
            // Acento naranja
            doc.setFillColor(naranja[0], naranja[1], naranja[2]);
            doc.rect(0, 22, pageW, 2, 'F');

            // Título izquierda
            doc.setFont('helvetica','bold');
            doc.setFontSize(13);
            doc.setTextColor(255,255,255);
            doc.text('CARZE Contratistas Generales S.A.C.', 12, 10);
            doc.setFontSize(8);
            doc.setFont('helvetica','normal');
            doc.setTextColor(200, 210, 230);
            doc.text('Seguimiento de Proyectos — '+tipo, 12, 16);

            // Fecha + usuario derecha
            doc.setFontSize(7.5);
            doc.setTextColor(200, 210, 230);
            doc.text('Fecha: '+hoyStr, pageW - 12, 10, {align:'right'});
            doc.text('Generado por: '+nombreUsuario, pageW - 12, 16, {align:'right'});
        }

        function dibujarPie(){
            var totalPages = doc.internal.getNumberOfPages();
            for(var i=1; i<=totalPages; i++){
                doc.setPage(i);
                doc.setFillColor(245,247,250);
                doc.rect(0, pageH - 8, pageW, 8, 'F');
                doc.setFont('helvetica','normal');
                doc.setFontSize(7);
                doc.setTextColor(100,116,139);
                doc.text('CARZE Contratistas Generales S.A.C. — Reporte Seguimiento de Proyectos — '+hoyStr, 12, pageH - 2.5);
                doc.text('Página '+i+' de '+totalPages, pageW - 12, pageH - 2.5, {align:'right'});
            }
        }

        function resumenEstado(datos, calcFn){
            var total = datos.length;
            var c0=0, c60=0, c100=0, sinResp=0;
            var subtotal = 0;
            datos.forEach(function(r){
                var av = calcFn(r);
                var seg = seguData[r._id]||{};
                if(av.pct===100) c100++;
                else if(av.pct>=60) c60++;
                else c0++;
                if(!seg.responsable) sinResp++;
                subtotal += parseFloat(r.subtotal||0);
            });
            return {total:total, c0:c0, c60:c60, c100:c100, sinResp:sinResp, subtotal:subtotal};
        }

        function tablaBadge(v){
            return (v && v!=='-' && v!=='—' && v!=='0' && v!==0) ? 'Sí' : 'No';
        }

        function pctColor(pct){
            if(pct===100) return [22,163,74];
            if(pct>=60)   return [245,158,11];
            return [220,38,38];
        }

        // ──────────────────────────────────────────────────────
        // PÁGINA 1: RESUMEN EJECUTIVO
        // ──────────────────────────────────────────────────────
        dibujarCabecera('Resumen Ejecutivo');

        var sumCot  = resumenEstado(filtCot,  calcAvanceCot);
        var sumCert = resumenEstado(filtCert, calcAvanceCert);
        var totalItems = sumCot.total + sumCert.total;
        var totalSub   = sumCot.subtotal + sumCert.subtotal;

        var y = 32;

        // Subtítulo sección
        doc.setFont('helvetica','bold');
        doc.setFontSize(9);
        doc.setTextColor(azul[0], azul[1], azul[2]);
        doc.text('RESUMEN EJECUTIVO', 12, y);
        y += 7;

        // Tarjetas resumen — 4 columnas
        var cards = [
            {label:'Total Proyectos',    valor: totalItems,       sub:'cotizaciones + certificados', color:[26,58,107]},
            {label:'Cotizaciones',        valor: sumCot.total,     sub:sumCot.sinResp+' sin responsable', color:[249,115,22]},
            {label:'Certificados',        valor: sumCert.total,    sub:sumCert.sinResp+' sin responsable', color:[22,163,74]},
            {label:'Subtotal Acumulado',  valor:'S/ '+parseFloat(totalSub).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2}), sub:'monto total pendiente', color:[245,158,11]},
        ];

        var cw = (pageW - 24 - 9) / 4;
        cards.forEach(function(c, i){
            var cx = 12 + i*(cw+3);
            doc.setFillColor(c.color[0], c.color[1], c.color[2]);
            doc.roundedRect(cx, y, cw, 22, 2, 2, 'F');
            doc.setFont('helvetica','bold');
            doc.setFontSize(15);
            doc.setTextColor(255,255,255);
            doc.text(String(c.valor), cx + cw/2, y + 10, {align:'center'});
            doc.setFontSize(7.5);
            doc.setFont('helvetica','bold');
            doc.text(c.label, cx + cw/2, y + 16, {align:'center'});
            doc.setFontSize(6.5);
            doc.setFont('helvetica','normal');
            doc.setTextColor(220,230,250);
            doc.text(c.sub, cx + cw/2, y + 20, {align:'center'});
        });

        y += 28;

        // Progreso por sección — 2 mini tablas lado a lado
        var secW = (pageW - 24 - 6) / 2;

        function miniResumenTabla(titulo, sum, startX, startY){
            doc.setFont('helvetica','bold');
            doc.setFontSize(8);
            doc.setTextColor(azul[0], azul[1], azul[2]);
            doc.text(titulo, startX, startY);

            doc.autoTable({
                startY: startY + 3,
                tableWidth: secW,
                margin: {left: startX},
                head: [['Avance','Cantidad','% del total']],
                body: [
                    ['< 60% (Crítico)',    sum.c0,  sum.total?Math.round(sum.c0/sum.total*100)+'%':'0%'],
                    ['60–99% (En proceso)',sum.c60, sum.total?Math.round(sum.c60/sum.total*100)+'%':'0%'],
                    ['100% (Completo)',    sum.c100, sum.total?Math.round(sum.c100/sum.total*100)+'%':'0%'],
                    ['Sin responsable',   sum.sinResp, sum.total?Math.round(sum.sinResp/sum.total*100)+'%':'0%'],
                    ['TOTAL',             sum.total, '100%'],
                ],
                styles:{ fontSize:7.5, cellPadding:2.5, font:'helvetica' },
                headStyles:{ fillColor:azul, textColor:255, fontStyle:'bold', fontSize:7 },
                bodyStyles:{ textColor:[30,41,59] },
                alternateRowStyles:{ fillColor:gris },
                columnStyles:{ 1:{halign:'center'}, 2:{halign:'center'} },
                didParseCell: function(data){
                    if(data.section==='body'){
                        var txt = data.cell.raw;
                        if(txt==='< 60% (Crítico)')    data.cell.styles.textColor=[220,38,38];
                        if(txt==='60–99% (En proceso)') data.cell.styles.textColor=[180,120,0];
                        if(txt==='100% (Completo)')     data.cell.styles.textColor=[22,163,74];
                        if(data.row.index===4) data.cell.styles.fontStyle='bold';
                    }
                }
            });
            return doc.lastAutoTable.finalY;
        }

        var finalY1 = miniResumenTabla('Cotizaciones Pendientes',  sumCot,  12,       y);
        var finalY2 = miniResumenTabla('Certificados Pendientes', sumCert, 12+secW+6, y);

        y = Math.max(finalY1, finalY2) + 8;

        // Top 5 proyectos más antiguos
        var todosOrdenados = filtCot.concat(filtCert).map(function(r){
            return {r:r, dias: diasDesde(r.fecha)||0, seg: seguData[r._id]||{}, tipo: filtCot.includes(r)?'Cotiz.':'Certif.'};
        }).sort(function(a,b){return b.dias-a.dias;}).slice(0,5);

        if(todosOrdenados.length){
            doc.setFont('helvetica','bold');
            doc.setFontSize(8);
            doc.setTextColor(azul[0], azul[1], azul[2]);
            doc.text('TOP 5 PROYECTOS CON MÁS DÍAS PENDIENTES', 12, y);
            y += 3;

            doc.autoTable({
                startY: y,
                margin:{left:12, right:12},
                head:[['N°','Tipo','Zona','Cliente','Descripción','Días','Avance','Responsable']],
                body: todosOrdenados.map(function(item){
                    var r = item.r;
                    var av = filtCot.includes(r) ? calcAvanceCot(r) : calcAvanceCert(r);
                    return [r.num||'—', item.tipo, r.zona||'—', r.cliente||'—',
                            (r.desc||'').substring(0,55)+(r.desc&&r.desc.length>55?'…':''),
                            item.dias+' días', av.pct+'%', item.seg.responsable||'Sin asignar'];
                }),
                styles:{ fontSize:7.5, cellPadding:2.5 },
                headStyles:{ fillColor:azul, textColor:255, fontStyle:'bold', fontSize:7 },
                alternateRowStyles:{ fillColor:gris },
                columnStyles:{
                    0:{cellWidth:12, halign:'center'},
                    1:{cellWidth:16, halign:'center'},
                    2:{cellWidth:22},
                    3:{cellWidth:22},
                    4:{cellWidth:'auto'},
                    5:{cellWidth:18, halign:'center'},
                    6:{cellWidth:16, halign:'center'},
                    7:{cellWidth:32},
                },
                didParseCell: function(data){
                    if(data.section==='body' && data.column.index===5){
                        var d = parseInt(data.cell.raw);
                        data.cell.styles.textColor = d>60?[220,38,38]:d>30?[180,120,0]:[22,163,74];
                        data.cell.styles.fontStyle = 'bold';
                    }
                    if(data.section==='body' && data.column.index===6){
                        var p = parseInt(data.cell.raw);
                        data.cell.styles.textColor = pctColor(p);
                        data.cell.styles.fontStyle = 'bold';
                    }
                    if(data.section==='body' && data.column.index===7 && data.cell.raw==='Sin asignar'){
                        data.cell.styles.textColor = [220,38,38];
                    }
                }
            });
        }

        // ──────────────────────────────────────────────────────
        // PÁGINA 2: DETALLE COTIZACIONES
        // ──────────────────────────────────────────────────────
        if(filtCot.length){
            doc.addPage();
            dibujarCabecera('Cotizaciones');

            doc.setFont('helvetica','bold');
            doc.setFontSize(9);
            doc.setTextColor(azul[0], azul[1], azul[2]);
            doc.text('DETALLE COTIZACIONES PENDIENTES ('+filtCot.length+')', 12, 31);

            doc.autoTable({
                startY: 34,
                margin:{left:12, right:12},
                head:[['N°','Zona','Cliente','Descripción','COT','INF','ACTA','Sub Total','O.C.','HES','Días','Avance','Responsable','Estado']],
                body: filtCot.map(function(r){
                    var av  = calcAvanceCot(r);
                    var seg = seguData[r._id]||{};
                    var d   = diasDesde(r.fecha);
                    return [
                        r.num||'—', r.zona||'—', r.cliente||'—',
                        (r.desc||'').substring(0,50)+(r.desc&&r.desc.length>50?'…':''),
                        tablaBadge(r.cotNombre), tablaBadge(r.infNombre), tablaBadge(r.actaNombre),
                        'S/ '+fmt(r.subtotal),
                        tablaBadge(r.ocNombre), tablaBadge(r.hes&&r.hes!=='0'?r.hes:null),
                        d!==null?d+' d':'—', av.pct+'%',
                        seg.responsable||'Sin asignar', r.estado||'—'
                    ];
                }),
                styles:{fontSize:6.8, cellPadding:2},
                headStyles:{fillColor:azul, textColor:255, fontStyle:'bold', fontSize:6.5},
                alternateRowStyles:{fillColor:gris},
                columnStyles:{
                    0:{cellWidth:10, halign:'center'},
                    1:{cellWidth:18},
                    2:{cellWidth:20},
                    3:{cellWidth:'auto'},
                    4:{cellWidth:10, halign:'center'},
                    5:{cellWidth:10, halign:'center'},
                    6:{cellWidth:11, halign:'center'},
                    7:{cellWidth:20, halign:'right'},
                    8:{cellWidth:10, halign:'center'},
                    9:{cellWidth:10, halign:'center'},
                    10:{cellWidth:13, halign:'center'},
                    11:{cellWidth:13, halign:'center'},
                    12:{cellWidth:28},
                    13:{cellWidth:18, halign:'center'},
                },
                didParseCell: function(data){
                    if(data.section==='body'){
                        var ci = data.column.index;
                        // Días
                        if(ci===10){
                            var d2=parseInt(data.cell.raw);
                            if(!isNaN(d2)) data.cell.styles.textColor = d2>60?[220,38,38]:d2>30?[180,120,0]:[22,163,74];
                            data.cell.styles.fontStyle='bold';
                        }
                        // Avance
                        if(ci===11){
                            var p2=parseInt(data.cell.raw);
                            data.cell.styles.textColor=pctColor(p2);
                            data.cell.styles.fontStyle='bold';
                        }
                        // Sí / No badges
                        if([4,5,6,8,9].includes(ci)){
                            if(data.cell.raw==='Sí'){data.cell.styles.textColor=[22,163,74];data.cell.styles.fontStyle='bold';}
                            else {data.cell.styles.textColor=[148,163,184];}
                        }
                        // Sin asignar
                        if(ci===12 && data.cell.raw==='Sin asignar') data.cell.styles.textColor=[220,38,38];
                    }
                }
            });
        }

        // ──────────────────────────────────────────────────────
        // PÁGINA 3: DETALLE CERTIFICADOS
        // ──────────────────────────────────────────────────────
        if(filtCert.length){
            doc.addPage();
            dibujarCabecera('Certificados');

            doc.setFont('helvetica','bold');
            doc.setFontSize(9);
            doc.setTextColor(azul[0], azul[1], azul[2]);
            doc.text('DETALLE CERTIFICADOS PENDIENTES ('+filtCert.length+')', 12, 31);

            doc.autoTable({
                startY: 34,
                margin:{left:12, right:12},
                head:[['N°','Zona','Cliente','Descripción','CERT','INF','ACTA','Sub Total','O.C.','HES','Días','Avance','Responsable','Estado']],
                body: filtCert.map(function(r){
                    var av  = calcAvanceCert(r);
                    var seg = seguData[r._id]||{};
                    var d   = diasDesde(r.fecha);
                    return [
                        r.num||'—', r.zona||'—', r.cliente||'—',
                        (r.desc||'').substring(0,50)+(r.desc&&r.desc.length>50?'…':''),
                        tablaBadge(r.certNombre), tablaBadge(r.infNombre), tablaBadge(r.actaNombre),
                        'S/ '+fmt(r.subtotal),
                        tablaBadge(r.ocNombre), tablaBadge(r.hes&&r.hes!=='0'?r.hes:null),
                        d!==null?d+' d':'—', av.pct+'%',
                        seg.responsable||'Sin asignar', r.estado||'—'
                    ];
                }),
                styles:{fontSize:6.8, cellPadding:2},
                headStyles:{fillColor:azul, textColor:255, fontStyle:'bold', fontSize:6.5},
                alternateRowStyles:{fillColor:gris},
                columnStyles:{
                    0:{cellWidth:10, halign:'center'},
                    1:{cellWidth:18},
                    2:{cellWidth:20},
                    3:{cellWidth:'auto'},
                    4:{cellWidth:10, halign:'center'},
                    5:{cellWidth:10, halign:'center'},
                    6:{cellWidth:11, halign:'center'},
                    7:{cellWidth:20, halign:'right'},
                    8:{cellWidth:10, halign:'center'},
                    9:{cellWidth:10, halign:'center'},
                    10:{cellWidth:13, halign:'center'},
                    11:{cellWidth:13, halign:'center'},
                    12:{cellWidth:28},
                    13:{cellWidth:18, halign:'center'},
                },
                didParseCell: function(data){
                    if(data.section==='body'){
                        var ci = data.column.index;
                        if(ci===10){
                            var d2=parseInt(data.cell.raw);
                            if(!isNaN(d2)) data.cell.styles.textColor = d2>60?[220,38,38]:d2>30?[180,120,0]:[22,163,74];
                            data.cell.styles.fontStyle='bold';
                        }
                        if(ci===11){
                            var p2=parseInt(data.cell.raw);
                            data.cell.styles.textColor=pctColor(p2);
                            data.cell.styles.fontStyle='bold';
                        }
                        if([4,5,6,8,9].includes(ci)){
                            if(data.cell.raw==='Sí'){data.cell.styles.textColor=[22,163,74];data.cell.styles.fontStyle='bold';}
                            else {data.cell.styles.textColor=[148,163,184];}
                        }
                        if(ci===12 && data.cell.raw==='Sin asignar') data.cell.styles.textColor=[220,38,38];
                    }
                }
            });
        }

        // Pie en todas las páginas
        dibujarPie();

        // Descargar
        var fecha = new Date().toISOString().slice(0,10);
        doc.save('CARZE_Seguimiento_'+fecha+'.pdf');
        toast('PDF generado correctamente ✓','ok');

    } catch(err){
        toast('Error al generar PDF: '+err.message,'err');
        console.error(err);
    }

    btn.disabled = false;
    btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> PDF';
}
window.generarPDF = generarPDF;

document.addEventListener('keydown',function(e){if(e.key==='Escape')cerrarModalResp();});
