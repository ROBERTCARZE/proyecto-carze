/* ==========================================================================
   EVENTOS.JS — Lógica del módulo de Eventos
   CARZE Contratistas Generales S.A.C.
   --------------------------------------------------------------------------
   Extraído de eventos.html tal cual estaba (mismo comportamiento, cero
   cambios de lógica) — primer módulo piloto de la separación HTML/JS.
   ========================================================================== */
import { initializeApp }    from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";
import { getFirestore, collection, onSnapshot,
         addDoc, updateDoc, deleteDoc,
         doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";

const firebaseConfig={
    apiKey:"AIzaSyAk1FGQia36Y2G08L-_mscMv5JnozmPYa0",
    authDomain:"gestioncarze.firebaseapp.com",
    projectId:"gestioncarze",
    storageBucket:"gestioncarze.firebasestorage.app",
    messagingSenderId:"487407475826",
    appId:"1:487407475826:web:32185a60f0123a5d25f6eb"
};
const app=initializeApp(firebaseConfig);
const db =getFirestore(app);
    const auth = getAuth(app);
const COL='eventos';

var eventos=[], editId=null, tipoActual=null;
var calAnio=new Date().getFullYear(), calMes=new Date().getMonth();
var diaSeleccionado=null;

const TIPO_META={
    reunion:   {label:'Reunión',       emoji:'🔵',cls:'tipo-reunion',  color:'#1e40af', bg:'#eff6ff'},
    visita:    {label:'Visita Técnica', emoji:'🟠',cls:'tipo-visita',   color:'#c2410c', bg:'#fff7ed'},
    documentos:{label:'Documentos',    emoji:'🟢',cls:'tipo-documentos',color:'#15803d', bg:'#dcfce7'},
    pago:      {label:'Pago / Cobro',  emoji:'🔴',cls:'tipo-pago',     color:'#dc2626', bg:'#fee2e2'},
    pendiente: {label:'Pendiente',     emoji:'🟣',cls:'tipo-pendiente', color:'#9333ea', bg:'#faf5ff'},
    otro:      {label:'Otro',          emoji:'⚫',cls:'tipo-otro',      color:'#475569', bg:'#f1f5f9'},
};
const MESES=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DIAS_DOW=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

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

window.addEventListener('DOMContentLoaded',function(){
    var n=sessionStorage.getItem('carze_nombre')||'Usuario';
    document.getElementById('userName').textContent=n;
    document.getElementById('avatarInitials').textContent=
        n.split(' ').map(function(p){return p[0]||'';}).slice(0,2).join('').toUpperCase()||'U';
    renderDOW();
    renderCalendario();
    iniciarListener();
});

function iniciarListener(){
    onSnapshot(collection(db,COL),function(snap){
        eventos=snap.docs.map(function(d){var r=d.data();r._id=d.id;return r;});
        // Auto-marcar vencidos
        var hoyStr=hoy();
        eventos.forEach(function(ev){
            if(ev.estado==='pendiente'&&ev.fecha<hoyStr){
                updateDoc(doc(db,COL,ev._id),{estado:'vencido'});
                ev.estado='vencido';
            }
        });
        renderCalendario();
        renderPanel();
    });
}

// ── HELPERS ──────────────────────────────────────────────────
function hoy(){var d=new Date();return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate());}
function p2(n){return n<10?'0'+n:String(n);}
function fmtF(v){if(!v)return '—';var p=v.split('-');return p[2]+'/'+p[1]+'/'+p[0];}
function toast(msg,tipo){var t=document.getElementById('toast');t.textContent=msg;t.className='toast '+(tipo||'ok');t.classList.add('show');setTimeout(function(){t.classList.remove('show');},3000);}

function eventosDia(fechaStr){
    return eventos.filter(function(ev){return ev.fecha===fechaStr;});
}
function eventosMes(anio,mes){
    var prefix=anio+'-'+p2(mes+1);
    return eventos.filter(function(ev){return String(ev.fecha||'').startsWith(prefix);})
                  .sort(function(a,b){return String(a.fecha).localeCompare(String(b.fecha));});
}

// ── RENDER DÍAS SEMANA ────────────────────────────────────────
function renderDOW(){
    var c=document.getElementById('calDow');
    c.innerHTML=DIAS_DOW.map(function(d,i){
        return '<div class="cal-dow'+(i===0||i===6?' fin':'')+'">'+d+'</div>';
    }).join('');
}

// ── RENDER CALENDARIO ─────────────────────────────────────────
function renderCalendario(){
    var hoyD=new Date(); hoyD.setHours(0,0,0,0);
    var hoyStr=hoy();

    document.getElementById('calMesLabel').innerHTML=
        MESES[calMes]+' <span>'+calAnio+'</span>';

    var primerDia=new Date(calAnio,calMes,1).getDay(); // 0=dom
    var diasMes=new Date(calAnio,calMes+1,0).getDate();
    var grid=document.getElementById('calGrid');
    grid.innerHTML='';

    // Días del mes anterior
    var diasAnt=new Date(calAnio,calMes,0).getDate();
    for(var i=0;i<primerDia;i++){
        var d=diasAnt-primerDia+1+i;
        var div=document.createElement('div');
        div.className='cal-day otro-mes';
        div.innerHTML='<div class="cal-day-num">'+d+'</div>';
        grid.appendChild(div);
    }

    // Días del mes actual
    for(var d2=1;d2<=diasMes;d2++){
        var fechaStr=calAnio+'-'+p2(calMes+1)+'-'+p2(d2);
        var esDomingo=(new Date(calAnio,calMes,d2).getDay()===0);
        var esSabado =(new Date(calAnio,calMes,d2).getDay()===6);
        var esHoy=fechaStr===hoyStr;
        var evsDia=eventosDia(fechaStr);

        var div2=document.createElement('div');
        var cls='cal-day';
        if(esHoy) cls+=' hoy';
        if(esDomingo||esSabado) cls+=' fin-semana';
        if(evsDia.length>0) cls+=' tiene-eventos';
        div2.className=cls;
        div2.onclick=(function(f){return function(){abrirModal(f);};})(fechaStr);

        var html='<div class="cal-day-num">'+d2+'</div>';
        // Mostrar hasta 3 eventos
        evsDia.slice(0,3).forEach(function(ev){
            var meta=TIPO_META[ev.tipo]||TIPO_META.otro;
            var opacity=ev.estado==='realizado'?'opacity:.6':'';
            html+='<div class="cal-evento-dot" style="background:'+meta.bg+';color:'+meta.color+';'+opacity+'" '+
                'onclick="event.stopPropagation();abrirEditar(\''+ev._id+'\')" title="'+ev.titulo+'">'+
                meta.emoji+' '+ev.titulo+'</div>';
        });
        if(evsDia.length>3){
            html+='<div style="font-size:.58rem;color:var(--muted);font-weight:700">+'+( evsDia.length-3)+' más</div>';
        }
        html+='<div class="cal-add-btn" onclick="event.stopPropagation();abrirModal(\''+fechaStr+'\')">+</div>';
        div2.innerHTML=html;
        grid.appendChild(div2);
    }

    // Días del mes siguiente
    var totalCeldas=primerDia+diasMes;
    var resto=totalCeldas%7===0?0:7-(totalCeldas%7);
    for(var k=1;k<=resto;k++){
        var div3=document.createElement('div');
        div3.className='cal-day otro-mes';
        div3.innerHTML='<div class="cal-day-num">'+k+'</div>';
        grid.appendChild(div3);
    }
}

// ── PANEL LATERAL ─────────────────────────────────────────────
function renderPanel(){
    var evsMes=eventosMes(calAnio,calMes);
    var mesLabel=MESES[calMes]+' '+calAnio;
    document.getElementById('panelTitle').textContent='Eventos — '+mesLabel;
    document.getElementById('panelSub').textContent=evsMes.length+' evento'+(evsMes.length!==1?'s':'');

    var body=document.getElementById('panelBody');
    if(!evsMes.length){
        body.innerHTML='<div class="panel-empty"><div class="ei">📅</div><p>No hay eventos en '+mesLabel+'.<br>Haz click en un día del calendario para agregar.</p></div>';
        return;
    }

    var html='';
    evsMes.forEach(function(ev){
        var meta=TIPO_META[ev.tipo]||TIPO_META.otro;
        var estCls=ev.estado==='realizado'?'est-realizado':ev.estado==='vencido'?'est-vencido':'est-pendiente';
        var estTxt=ev.estado==='realizado'?'✅ Realizado':ev.estado==='vencido'?'⚠️ Vencido':'⏳ Pendiente';
        html+='<div class="evento-card" style="border-left-color:'+meta.color+'" onclick="abrirEditar(\''+ev._id+'\')">'+
            '<div class="evento-card-head">'+
                '<div class="evento-card-title">'+meta.emoji+' '+ev.titulo+'</div>'+
                '<div class="evento-card-fecha">'+fmtF(ev.fecha)+(ev.hora?' · '+ev.hora:'')+'</div>'+
            '</div>'+
            '<span class="evento-card-tipo '+meta.cls+'">'+meta.label+'</span>'+
            (ev.desc&&ev.desc!=='-'?'<div class="evento-card-desc">'+ev.desc+'</div>':'')+
            '<div class="evento-card-foot">'+
                '<span class="estado-badge '+estCls+'">'+estTxt+'</span>'+
                '<div class="ev-actions">'+
                    '<button class="ev-btn" onclick="event.stopPropagation();toggleEstado(\''+ev._id+'\',\''+ev.estado+'\')" title="Cambiar estado">🔄</button>'+
                    '<button class="ev-btn" onclick="event.stopPropagation();pedirEliminar(\''+ev._id+'\',\''+ev.titulo+'\')" title="Eliminar">🗑️</button>'+
                '</div>'+
            '</div>'+
        '</div>';
    });
    body.innerHTML=html;
}

// ── NAVEGACIÓN CALENDARIO ─────────────────────────────────────
function cambiarMes(dir){
    calMes+=dir;
    if(calMes>11){calMes=0;calAnio++;}
    if(calMes<0){calMes=11;calAnio--;}
    renderCalendario();
    renderPanel();
}
function irHoy(){calAnio=new Date().getFullYear();calMes=new Date().getMonth();renderCalendario();renderPanel();}
window.cambiarMes=cambiarMes;
window.irHoy=irHoy;

// ── MODAL ─────────────────────────────────────────────────────
function setTipo(tipo){
    tipoActual=tipo;
    document.querySelectorAll('.tipo-opt').forEach(function(el){
        el.className='tipo-opt'+(el.dataset.tipo===tipo?' sel sel-'+tipo:'');
    });
}
window.setTipo=setTipo;

function abrirModal(fecha){
    editId=null; limpiar();
    if(fecha) document.getElementById('eFecha').value=fecha;
    document.getElementById('modalTitle').innerHTML='Nuevo <span>Evento</span>';
    document.getElementById('btnGuardarTxt').textContent='GUARDAR';
    document.getElementById('overlay').classList.add('open');
    setTimeout(function(){document.getElementById('eTitulo').focus();},200);
}
window.abrirModal=abrirModal;

function abrirEditar(id){
    var ev=eventos.find(function(e){return e._id===id;}); if(!ev) return;
    editId=id; limpiar();
    setTipo(ev.tipo||'otro');
    document.getElementById('eTitulo').value=ev.titulo||'';
    document.getElementById('eFecha').value=ev.fecha||'';
    document.getElementById('eHora').value=ev.hora||'';
    document.getElementById('eDesc').value=ev.desc&&ev.desc!=='-'?ev.desc:'';
    document.getElementById('eEstado').value=ev.estado||'pendiente';
    document.getElementById('modalTitle').innerHTML='Editar <span>Evento</span>';
    document.getElementById('btnGuardarTxt').textContent='ACTUALIZAR';
    document.getElementById('overlay').classList.add('open');
}
window.abrirEditar=abrirEditar;

function cerrarModal(){document.getElementById('overlay').classList.remove('open');editId=null;}
window.cerrarModal=cerrarModal;

function limpiar(){
    tipoActual=null;
    document.querySelectorAll('.tipo-opt').forEach(function(el){el.className='tipo-opt';});
    ['eTitulo','eHora','eDesc'].forEach(function(id){document.getElementById(id).value='';});
    document.getElementById('eFecha').value=hoy();
    document.getElementById('eEstado').value='pendiente';
}

// ── GUARDAR ───────────────────────────────────────────────────
async function guardar(){
    if(!tipoActual){toast('Selecciona el tipo de evento','err');return;}
    var titulo=document.getElementById('eTitulo').value.trim();
    var fecha =document.getElementById('eFecha').value;
    if(!titulo||!fecha){toast('Título y fecha son obligatorios','err');return;}
    var btn=document.getElementById('btnGuardar');
    var txt=document.getElementById('btnGuardarTxt');
    btn.disabled=true;txt.innerHTML='<span class="spinner"></span>';
    var docData={
        tipo:tipoActual, titulo:titulo, fecha:fecha,
        hora:document.getElementById('eHora').value||'-',
        desc:document.getElementById('eDesc').value.trim()||'-',
        estado:document.getElementById('eEstado').value||'pendiente',
        updatedAt:serverTimestamp()
    };
    try{
        if(editId){
            await updateDoc(doc(db,COL,editId),docData);
            toast('Evento actualizado ✓','ok');
        } else {
            docData.createdAt=serverTimestamp();
            await addDoc(collection(db,COL),docData);
            toast('Evento guardado ✓','ok');
            // Navegar al mes del evento
            var parts=fecha.split('-');
            calAnio=parseInt(parts[0]); calMes=parseInt(parts[1])-1;
        }
        btn.disabled=false;txt.textContent=editId?'ACTUALIZAR':'GUARDAR';
        cerrarModal();
    }catch(err){btn.disabled=false;txt.textContent=editId?'ACTUALIZAR':'GUARDAR';toast('Error: '+err.message,'err');}
}
window.guardar=guardar;

// ── TOGGLE ESTADO ─────────────────────────────────────────────
async function toggleEstado(id,estadoActual){
    var nuevo=estadoActual==='pendiente'?'realizado':estadoActual==='realizado'?'pendiente':'realizado';
    try{await updateDoc(doc(db,COL,id),{estado:nuevo,updatedAt:serverTimestamp()});toast('Estado cambiado ✓','ok');}
    catch(err){toast('Error: '+err.message,'err');}
}
window.toggleEstado=toggleEstado;

// ── ELIMINAR ─────────────────────────────────────────────────
var pendingDel=null;
function pedirEliminar(id,titulo){
    pendingDel=id;
    document.getElementById('confirmMsg').textContent='Se eliminará "'+titulo+'". Esta acción no se puede deshacer.';
    document.getElementById('confirmOverlay').classList.add('open');
    document.getElementById('confirmOkBtn').onclick=ejecutarEliminar;
}
window.pedirEliminar=pedirEliminar;
function cerrarConfirm(){document.getElementById('confirmOverlay').classList.remove('open');pendingDel=null;}
window.cerrarConfirm=cerrarConfirm;
async function ejecutarEliminar(){
    if(!pendingDel)return;cerrarConfirm();
    try{await deleteDoc(doc(db,COL,pendingDel));toast('Evento eliminado','warn');}
    catch(err){toast('Error: '+err.message,'err');}
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
document.addEventListener('keydown',function(e){if(e.key==='Escape'){cerrarModal();cerrarConfirm();}});
