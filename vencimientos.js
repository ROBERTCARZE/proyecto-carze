/* ==========================================================================
   VENCIMIENTOS.JS — Lógica del módulo de Vencimientos y Alertas
   CARZE Contratistas Generales S.A.C.
   --------------------------------------------------------------------------
   Extraído de vencimientos.html tal cual estaba (mismo comportamiento, cero
   cambios de lógica) — octavo módulo separado.
   ========================================================================== */
import { initializeApp }  from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";
import { getFirestore, collection, query, where,
         onSnapshot, orderBy, getDocs,
         addDoc, updateDoc, deleteDoc, setDoc, doc } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";

const firebaseConfig={
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

// Estado global
var dataFacturas=[], dataImpuestos=[], dataCaja=[];

// Préstamos desde finanzas (hardcoded — misma data que finanzas.html)
const MESES_ES=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

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
    iniciarListeners();
    iniciarListenerCompromisos();
    iniciarListenerAjustesMes();
    renderPrestamos(); // static data
});

// ── HELPERS ──────────────────────────────────────────────────
function hoy(){var d=new Date();return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate());}
function p2(n){return n<10?'0'+n:String(n);}
function fmt(n){return parseFloat(n||0).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2});}
function fmtF(v){if(!v||v==='-')return '—';var s=String(v).trim();if(s.match(/^\d{4}-\d{2}-\d{2}/)){var p=s.split('-');return p[2]+'/'+p[1]+'/'+p[0];}return v;}
function toast(msg,tipo){var t=document.getElementById('toast');t.textContent=msg;t.className='toast '+(tipo||'ok');t.classList.add('show');setTimeout(function(){t.classList.remove('show');},3000);}

function diasHasta(fechaStr){
    if(!fechaStr||fechaStr==='-') return null;
    var s=String(fechaStr).trim().substring(0,10);
    if(!s.match(/^\d{4}-\d{2}-\d{2}/)) return null;
    var venc=new Date(s+'T00:00:00'), hoyD=new Date();
    hoyD.setHours(0,0,0,0);
    return Math.round((venc-hoyD)/(1000*60*60*24));
}

function nivelDias(dias){
    if(dias===null) return 'info';
    if(dias<0)  return 'urgente';
    if(dias<=7) return 'urgente';
    if(dias<=15) return 'proximo';
    return 'ok';
}

function textoFecha(dias){
    if(dias===null) return '—';
    if(dias<0)  return 'Venció hace '+Math.abs(dias)+' día'+(Math.abs(dias)!==1?'s':'');
    if(dias===0) return '⚠️ Vence HOY';
    if(dias===1) return '⚠️ Vence MAÑANA';
    return 'Vence en '+dias+' día'+(dias!==1?'s':'');
}

function pillNivel(nivel){
    var map={urgente:'pill-urgente',proximo:'pill-proximo',ok:'pill-ok',info:'pill-info'};
    var txt={urgente:'🔴 URGENTE',proximo:'🟡 PRÓXIMO',ok:'🟢 AL DÍA',info:'ℹ️ INFO'};
    return '<span class="alert-pill '+map[nivel]+'">'+txt[nivel]+'</span>';
}

function alertCard(nivel,titulo,subtitulo,monto,fecha){
    return '<div class="alert-card nivel-'+nivel+'">'+
        pillNivel(nivel)+
        '<div class="alert-content">'+
            '<div class="alert-title">'+titulo+'</div>'+
            '<div class="alert-sub">'+subtitulo+'</div>'+
        '</div>'+
        '<div class="alert-right">'+
            (monto?'<div class="alert-monto">'+monto+'</div>':'')+
            '<div class="alert-fecha">'+fecha+'</div>'+
        '</div>'+
    '</div>';
}

function emptyOk(msg){
    return '<div class="empty-sec"><span style="color:var(--verde)">✅</span> '+msg+'</div>';
}

// ── LISTENERS FIREBASE ────────────────────────────────────────
function iniciarListeners(){
    // Facturas emitidas / vencidas
    onSnapshot(
        query(collection(db,'facturas'),
              where('estado','in',['Emitida','Vencida'])),
        function(snap){
            dataFacturas=snap.docs.map(function(d){var r=d.data();r._id=d.id;return r;});
            renderFacturas();
            actualizarSemaforo();
            if(document.getElementById('presuMesSel')) renderPresupuestoMensual();
        }
    );

    // Impuestos pendientes
    onSnapshot(
        query(collection(db,'impuestos_declaraciones'),
              where('estado','==','pendiente')),
        function(snap){
            dataImpuestos=snap.docs.map(function(d){var r=d.data();r._id=d.id;return r;});
            renderImpuestos();
            actualizarSemaforo();
        }
    );

    // Caja diaria
    onSnapshot(
        query(collection(db,'caja_diaria'),orderBy('fecha','asc')),
        function(snap){
            dataCaja=snap.docs.map(function(d){var r=d.data();r._id=d.id;return r;});
            renderCaja();
            actualizarSemaforo();
            if(document.getElementById('presuMesSel')) renderPresupuestoMensual();
        }
    );

    // Préstamos / Cuotas (colección real "prestamos", ya no hardcodeado)
    onSnapshot(
        collection(db,'prestamos'),
        function(snap){
            PRESTAMOS_BASE_VEN=snap.docs.map(function(d){var r=d.data();r._id=d.id;return r;});
            PRESTAMOS_BASE_VEN.sort(function(a,b){return (a.id||0)-(b.id||0);});
            renderPrestamos();
            actualizarSemaforo();
            if(document.getElementById('presuMesSel')) renderPresupuestoMensual();
        }
    );
}

// ── FACTURAS ─────────────────────────────────────────────────
function renderFacturas(){
    var cont=document.getElementById('alertasFacturas');
    if(!dataFacturas.length){
        cont.innerHTML=emptyOk('Todas las facturas están cobradas o al día');
        document.getElementById('badgeFacturas').className='sec-badge badge-ok';
        document.getElementById('badgeFacturas').textContent='✅ Sin alertas';
        return;
    }

    // Ordenar: vencidas primero, luego por días restantes
    var sorted=[...dataFacturas].sort(function(a,b){
        var da=diasHasta(a.fechaVenc)||0, db2=diasHasta(b.fechaVenc)||0;
        return da-db2;
    });

    var html=''; var urgentes=0,proximos=0;
    sorted.forEach(function(r){
        var dias=diasHasta(r.fechaVenc);
        var nivel=nivelDias(dias);
        if(nivel==='urgente') urgentes++;
        if(nivel==='proximo') proximos++;
        var factNum=(r.serie||'')+'-'+(r.numFact||'');
        var cliente=r.cliente||r.razonSocial||'—';
        var monto='S/ '+fmt(r.total);
        html+=alertCard(nivel,
            factNum+' — '+cliente,
            'OC: '+(r.oc||'—')+' · Estado: '+r.estado,
            monto,
            textoFecha(dias)+' ('+fmtF(r.fechaVenc)+')'
        );
    });

    cont.innerHTML=html;
    var total=sorted.length;
    var badgeEl=document.getElementById('badgeFacturas');
    if(urgentes>0){badgeEl.className='sec-badge badge-urgente';badgeEl.textContent='🔴 '+urgentes+' urgente'+(urgentes>1?'s':'');}
    else if(proximos>0){badgeEl.className='sec-badge badge-proximo';badgeEl.textContent='🟡 '+proximos+' próximo'+(proximos>1?'s':'');}
    else{badgeEl.className='sec-badge badge-ok';badgeEl.textContent='✅ '+total;}
}

// ── PRÉSTAMOS — ahora en vivo desde Firestore (colección "prestamos") ──
// FUENTE ÚNICA DE VERDAD: los mismos PRESTAMOS_BASE + estados de finanzas.html
// Así cualquier cambio en finanzas se refleja aquí automáticamente.

// Préstamos: ahora se cargan en vivo desde Firestore (colección "prestamos"),
// ya no están hardcodeados aquí. Ver iniciarListeners().
var PRESTAMOS_BASE_VEN=[];

function renderPrestamos(){
    var cont=document.getElementById('alertasPrestamos');

    var html=''; var urgentes=0,proximos=0,alDias=0;

    PRESTAMOS_BASE_VEN.forEach(function(p){
        var cuotas=p.cuotas||[];

        // 2. Buscar la primera cuota NO pagada (la próxima obligación real)
        var proxCuota=null;
        for(var i=0;i<cuotas.length;i++){
            if(cuotas[i].estado!=='Pagado'){proxCuota=cuotas[i];break;}
        }

        // Todo pagado
        if(!proxCuota){
            html+=alertCard('ok',p.nombre,'Todas las cuotas pagadas ✓','S/ '+fmt(p.cuotaAmt),'✅ Al día');
            alDias++; return;
        }

        // 3. Calcular días hasta la fecha real de esa cuota
        var dias=diasHasta(proxCuota.fecha);
        var mes_label=MESES_ES[parseInt(proxCuota.fecha.split('-')[1])-1]+' '+proxCuota.fecha.split('-')[0];

        // 4. Nivel: urgente solo si la fecha ya venció O vence en ≤7 días
        //    Si está pendiente pero su fecha es futura (>7 días) → ok/proximo
        var nivel;
        if(dias===null) nivel='info';
        else if(dias<0) nivel='urgente';       // ya venció sin pagar
        else if(dias<=7) nivel='urgente';      // vence esta semana
        else if(dias<=15) nivel='proximo';     // vence pronto
        else nivel='ok';                       // está al día, todavía no vence

        if(nivel==='urgente') urgentes++;
        else if(nivel==='proximo') proximos++;
        else alDias++;

        // Texto descriptivo del estado
        var subTxt;
        if(dias!==null&&dias<0){
            subTxt='Cuota de '+mes_label+' VENCIDA SIN PAGAR';
        } else if(dias!==null&&dias<=7){
            subTxt='Cuota de '+mes_label+' — vence muy pronto';
        } else if(dias!==null&&dias<=15){
            subTxt='Cuota de '+mes_label+' — próxima a vencer';
        } else {
            subTxt='Cuota de '+mes_label+' — al día';
        }

        html+=alertCard(nivel,p.nombre,subTxt,'S/ '+fmt(proxCuota.cuota),
            textoFecha(dias)+' ('+fmtF(proxCuota.fecha)+')');
    });

    cont.innerHTML=html||'<div class="empty-sec">✅ Todos los préstamos al día</div>';
    var badgeEl=document.getElementById('badgePrestamos');
    if(urgentes>0){badgeEl.className='sec-badge badge-urgente';badgeEl.textContent='🔴 '+urgentes+' urgente'+(urgentes>1?'s':'');}
    else if(proximos>0){badgeEl.className='sec-badge badge-proximo';badgeEl.textContent='🟡 '+proximos+' próximo'+(proximos>1?'s':'');}
    else{badgeEl.className='sec-badge badge-ok';badgeEl.textContent='✅ Todas al día';}
}

// ── IMPUESTOS ─────────────────────────────────────────────────
function renderImpuestos(){
    var cont=document.getElementById('alertasImpuestos');
    if(!dataImpuestos.length){
        cont.innerHTML=emptyOk('Todas las declaraciones están pagadas');
        document.getElementById('badgeImpuestos').className='sec-badge badge-ok';
        document.getElementById('badgeImpuestos').textContent='✅ Al día';
        return;
    }

    var html=''; var urgentes=0;
    dataImpuestos.forEach(function(r){
        // Fecha de presentación como referencia
        var dias=diasHasta(r.fechaPres);
        var nivel=dias!==null&&dias<0?'urgente':'proximo';
        if(nivel==='urgente') urgentes++;
        html+=alertCard(nivel,
            'Declaración '+r.periodo,
            'PDT 0621 · IGV: S/ '+fmt(r.igvPagar)+' · Renta: S/ '+fmt(r.rentaPagar)+' · Planilla: S/ '+fmt(r.totalPlanilla),
            'Total: S/ '+fmt(r.totalPagar),
            dias!==null&&dias<0?'⚠️ Presentación vencida ('+fmtF(r.fechaPres)+')':'Pendiente de pago'
        );
    });

    cont.innerHTML=html;
    var badgeEl=document.getElementById('badgeImpuestos');
    if(urgentes>0){badgeEl.className='sec-badge badge-urgente';badgeEl.textContent='🔴 '+urgentes+' pendiente'+(urgentes>1?'s':'');}
    else{badgeEl.className='sec-badge badge-proximo';badgeEl.textContent='🟡 '+dataImpuestos.length+' pendiente'+(dataImpuestos.length>1?'s':'');}
}

// ── CAJA ──────────────────────────────────────────────────────
function renderCaja(){
    var cont=document.getElementById('alertasCaja');
    var umbral=parseFloat(document.getElementById('umbralCaja').value)||500;
    var ing=0,eg=0;
    dataCaja.forEach(function(r){
        var m=parseFloat(r.monto)||0;
        if(r.tipo==='ingreso') ing+=m; else eg+=m;
    });
    var saldo=ing-eg;

    // Update umbral info
    var umbralInfo=document.getElementById('umbralSaldoInfo');
    umbralInfo.textContent='Saldo actual: S/ '+fmt(saldo);
    umbralInfo.style.background=saldo<umbral?'#fee2e2':'#dcfce7';
    umbralInfo.style.border='1px solid '+(saldo<umbral?'#fecaca':'#bbf7d0');
    umbralInfo.style.color=saldo<umbral?'#dc2626':'#15803d';

    var badgeEl=document.getElementById('badgeCaja');
    if(saldo<0){
        badgeEl.className='sec-badge badge-urgente';
        badgeEl.textContent='🔴 Saldo negativo';
        cont.innerHTML=alertCard('urgente',
            'Saldo de Caja Negativo',
            'Los egresos superan los ingresos registrados en Caja Diaria',
            'S/ '+fmt(saldo),
            '⚠️ Atención inmediata requerida'
        );
    } else if(saldo<umbral){
        badgeEl.className='sec-badge badge-urgente';
        badgeEl.textContent='🔴 Saldo bajo';
        cont.innerHTML=alertCard('urgente',
            'Saldo por Debajo del Umbral',
            'Saldo actual S/ '+fmt(saldo)+' está por debajo del umbral configurado S/ '+fmt(umbral),
            'S/ '+fmt(saldo),
            '⚠️ Considera ingresar fondos'
        );
    } else if(saldo<umbral*1.5){
        badgeEl.className='sec-badge badge-proximo';
        badgeEl.textContent='🟡 Saldo moderado';
        cont.innerHTML=alertCard('proximo',
            'Saldo Próximo al Umbral de Alerta',
            'Saldo actual S/ '+fmt(saldo)+' · Umbral: S/ '+fmt(umbral),
            'S/ '+fmt(saldo),
            'Monitorear de cerca'
        );
    } else {
        badgeEl.className='sec-badge badge-ok';
        badgeEl.textContent='✅ S/ '+fmt(saldo);
        cont.innerHTML=emptyOk('Saldo de caja saludable: S/ '+fmt(saldo));
    }
    actualizarSemaforo();
}

// ── PROCESAR TODO (cuando cambia umbral) ──────────────────────
function procesarTodo(){renderCaja();}
window.procesarTodo=procesarTodo;

// ── SEMÁFORO GLOBAL ───────────────────────────────────────────
function actualizarSemaforo(){
    var urgentes=0, proximos=0, oks=0;

    // Facturas
    dataFacturas.forEach(function(r){
        var n=nivelDias(diasHasta(r.fechaVenc));
        if(n==='urgente') urgentes++;
        else if(n==='proximo') proximos++;
        else oks++;
    });

    // Impuestos pendientes
    urgentes+=dataImpuestos.length;

    // Caja
    var umbral=parseFloat(document.getElementById('umbralCaja').value)||500;
    var ing=0,eg=0;
    dataCaja.forEach(function(r){var m=parseFloat(r.monto)||0;if(r.tipo==='ingreso')ing+=m;else eg+=m;});
    var saldo=ing-eg;
    if(saldo<0) urgentes++;
    else if(saldo<umbral) urgentes++;
    else oks++;

    // Préstamos — cuotas del mes
    var hoyD=new Date(); var mesActual=hoyD.getMonth()+1; var anioActual=hoyD.getFullYear();
    var fechaCuota=anioActual+'-'+p2(mesActual)+'-01';
    var diasCuota=diasHasta(fechaCuota);
    if(diasCuota!==null&&diasCuota<=7) urgentes+=10;
    else if(diasCuota!==null&&diasCuota<=15) proximos+=10;
    else oks+=10;

    var total=urgentes+proximos+oks;
    document.getElementById('semUrgente').textContent=urgentes;
    document.getElementById('semProximo').textContent=proximos;
    document.getElementById('semOk').textContent=oks;
    document.getElementById('semTotal').textContent=total;
}

// ── PESTAÑAS ─────────────────────────────────────────────────
var tabVencActual='alertas';
function cambiarTabVenc(tab){
    tabVencActual=tab;
    document.getElementById('vistaAlertas').style.display = tab==='alertas'?'block':'none';
    document.getElementById('vistaCompromisos').style.display = tab==='compromisos'?'block':'none';
    document.getElementById('tabAlertas').classList.toggle('active', tab==='alertas');
    document.getElementById('tabCompromisos').classList.toggle('active', tab==='compromisos');
    if(tab==='compromisos') renderPresupuestoMensual();
}
window.cambiarTabVenc=cambiarTabVenc;

// ── COMPROMISOS ──────────────────────────────────────────────
var COL_COMP='compromisos';
var dataCompromisos=[];
var compEditId=null;

var CAT_COMP_INFO={
    Personal:   {icon:'👥', color:'#1a3a6b', bg:'#eff6ff'},
    Servicios:  {icon:'💡', color:'#a16207', bg:'#fef9c3'},
    Seguros:    {icon:'🛡️', color:'#166534', bg:'#dcfce7'},
    Alquileres: {icon:'🏠', color:'#9333ea', bg:'#f3e8ff'},
    Otros:      {icon:'📦', color:'#64748b', bg:'#f1f5f9'}
};

function iniciarListenerCompromisos(){
    onSnapshot(collection(db,COL_COMP), function(snap){
        dataCompromisos=snap.docs.map(function(d){var r=d.data();r._id=d.id;return r;});
        dataCompromisos.sort(function(a,b){return (a.concepto||'').localeCompare(b.concepto||'');});
        renderCompromisos();
    }, function(err){ toast('Error cargando compromisos: '+err.message,'err'); });
}

function renderCompromisos(){
    var tbody=document.getElementById('bodyCompromisos');
    var empty=document.getElementById('emptyCompromisos');
    document.getElementById('cntCompromisos').textContent=dataCompromisos.filter(function(c){return c.activo!==false;}).length;

    if(!dataCompromisos.length){
        tbody.innerHTML=''; empty.style.display='flex';
        return;
    }
    empty.style.display='none';

    var html='';
    dataCompromisos.forEach(function(c){
        var cat=CAT_COMP_INFO[c.categoria]||CAT_COMP_INFO.Otros;
        var duracionTxt = (c.duracion&&c.duracion.tipo==='plazo')
            ? '⏳ '+c.duracion.meses+' meses (desde '+labelMesVenc(c.duracion.fechaInicio)+')'
            : '♾️ Indefinido';
        var activo = c.activo!==false;
        html+='<tr class="'+(activo?'':'inactivo')+'">'+
            '<td style="font-weight:700">'+esc(c.concepto)+'</td>'+
            '<td><span class="cat-chip" style="background:'+cat.bg+';color:'+cat.color+'">'+cat.icon+' '+esc(c.categoria)+'</span></td>'+
            '<td>S/ '+fmt(c.montoEstimado)+'</td>'+
            '<td>Cada '+esc(c.diaPago)+'</td>'+
            '<td><span class="dur-chip">'+duracionTxt+'</span></td>'+
            '<td><span class="estado-chip '+(activo?'activo':'inactivo')+'">'+(activo?'✓ Activo':'⏸ Inactivo')+'</span></td>'+
            '<td>'+
                '<button class="btn-accion-comp" onclick="abrirModalCompromiso(\''+c._id+'\')" title="Editar">✏️</button>'+
                '<button class="btn-accion-comp" onclick="toggleActivoCompromiso(\''+c._id+'\')" title="'+(activo?'Desactivar':'Activar')+'">'+(activo?'⏸':'▶️')+'</button>'+
                '<button class="btn-accion-comp" onclick="eliminarCompromiso(\''+c._id+'\')" title="Eliminar">🗑️</button>'+
            '</td>'+
        '</tr>';
    });
    tbody.innerHTML=html;
    if(document.getElementById('presuMesSel')) renderPresupuestoMensual();
}

function labelMesVenc(mesStr){
    if(!mesStr) return '—';
    var p=mesStr.split('-');
    return MESES_ES[parseInt(p[1],10)-1]+' '+p[0];
}

function esc(v){return(v!=null&&v!=='')?String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;'):'—';}

function toggleDuracionPlazo(){
    var esPlazo=document.getElementById('mcDuracionTipo').value==='plazo';
    document.getElementById('mcPlazoWrap').style.display=esPlazo?'grid':'none';
}
window.toggleDuracionPlazo=toggleDuracionPlazo;

function abrirModalCompromiso(id){
    compEditId=id||null;
    var titulo=document.getElementById('modalCompTitulo');
    if(compEditId){
        var c=dataCompromisos.find(function(x){return x._id===compEditId;});
        if(!c){ compEditId=null; }
        else{
            document.getElementById('mcConcepto').value=c.concepto||'';
            document.getElementById('mcCategoria').value=c.categoria||'Otros';
            document.getElementById('mcMonto').value=c.montoEstimado||'';
            document.getElementById('mcDia').value=c.diaPago||'';
            var esPlazo=c.duracion&&c.duracion.tipo==='plazo';
            document.getElementById('mcDuracionTipo').value=esPlazo?'plazo':'indefinido';
            document.getElementById('mcPlazoMeses').value=esPlazo?c.duracion.meses:'';
            document.getElementById('mcPlazoInicio').value=esPlazo?c.duracion.fechaInicio:'';
            titulo.textContent='Editar Compromiso';
        }
    }
    if(!compEditId){
        document.getElementById('mcConcepto').value='';
        document.getElementById('mcCategoria').value='Personal';
        document.getElementById('mcMonto').value='';
        document.getElementById('mcDia').value='';
        document.getElementById('mcDuracionTipo').value='indefinido';
        document.getElementById('mcPlazoMeses').value='';
        document.getElementById('mcPlazoInicio').value='';
        titulo.textContent='Nuevo Compromiso';
    }
    toggleDuracionPlazo();
    document.getElementById('overlayComp').classList.add('open');
}
window.abrirModalCompromiso=abrirModalCompromiso;

function cerrarModalCompromiso(){
    document.getElementById('overlayComp').classList.remove('open');
    compEditId=null;
}
window.cerrarModalCompromiso=cerrarModalCompromiso;

async function guardarCompromiso(){
    var concepto=document.getElementById('mcConcepto').value.trim();
    var categoria=document.getElementById('mcCategoria').value;
    var monto=parseFloat(document.getElementById('mcMonto').value)||0;
    var dia=parseInt(document.getElementById('mcDia').value,10)||0;
    var tipoDur=document.getElementById('mcDuracionTipo').value;

    if(!concepto){ toast('Ingresa el concepto del compromiso','err'); return; }
    if(monto<=0){ toast('Ingresa un monto válido','err'); return; }
    if(dia<1||dia>31){ toast('El día de pago debe estar entre 1 y 31','err'); return; }

    var duracion={tipo:'indefinido'};
    if(tipoDur==='plazo'){
        var meses=parseInt(document.getElementById('mcPlazoMeses').value,10)||0;
        var inicio=document.getElementById('mcPlazoInicio').value;
        if(meses<1){ toast('Ingresa el número de meses del plazo','err'); return; }
        if(!inicio){ toast('Ingresa el mes de inicio del plazo','err'); return; }
        duracion={tipo:'plazo', meses:meses, fechaInicio:inicio};
    }

    var btn=document.getElementById('btnGuardarComp');
    btn.disabled=true; btn.textContent='Guardando…';

    var docData={
        concepto:concepto, categoria:categoria, montoEstimado:monto,
        diaPago:dia, duracion:duracion,
        activo: compEditId ? (dataCompromisos.find(function(x){return x._id===compEditId;})||{}).activo!==false : true,
        updatedAt: new Date().toISOString()
    };

    try{
        if(compEditId){
            await updateDoc(doc(db,COL_COMP,compEditId), docData);
            toast('Compromiso actualizado ✓','ok');
        }else{
            await addDoc(collection(db,COL_COMP), docData);
            toast('Compromiso registrado ✓','ok');
        }
        cerrarModalCompromiso();
    }catch(err){
        toast('Error: '+err.message,'err');
    }finally{
        btn.disabled=false; btn.textContent='Guardar';
    }
}
window.guardarCompromiso=guardarCompromiso;

async function toggleActivoCompromiso(id){
    var c=dataCompromisos.find(function(x){return x._id===id;});
    if(!c) return;
    try{
        await updateDoc(doc(db,COL_COMP,id), {activo: c.activo===false});
        toast(c.activo===false?'Compromiso activado ✓':'Compromiso desactivado ✓','ok');
    }catch(err){ toast('Error: '+err.message,'err'); }
}
window.toggleActivoCompromiso=toggleActivoCompromiso;

async function eliminarCompromiso(id){
    var c=dataCompromisos.find(function(x){return x._id===id;});
    if(!c) return;
    if(!confirm('¿Eliminar el compromiso "'+c.concepto+'"? Esta acción no se puede deshacer.')) return;
    try{
        await deleteDoc(doc(db,COL_COMP,id));
        toast('Compromiso eliminado ✓','ok');
    }catch(err){ toast('Error: '+err.message,'err'); }
}
window.eliminarCompromiso=eliminarCompromiso;

// ── PRESUPUESTO MENSUAL ──────────────────────────────────────
var COL_AJUSTES='compromisos_montos_mes'; // 1 doc por compromiso+mes, solo el monto real
var dataAjustesMes={}; // {'compId_YYYY-MM': {montoReal}}

function iniciarListenerAjustesMes(){
    onSnapshot(collection(db,COL_AJUSTES), function(snap){
        var mapa={};
        snap.forEach(function(d){ mapa[d.id]=d.data(); });
        dataAjustesMes=mapa;
        renderPresupuestoMensual();
    }, function(err){ console.error('Error cargando ajustes de mes:', err); });
}

function mesKeyVenc(fecha){ return String(fecha||'').substring(0,7); }
function sumarMesVenc(mesStr,n){
    var p=mesStr.split('-'); var y=parseInt(p[0],10),m=parseInt(p[1],10)-1+n;
    var d=new Date(y,m,1); return d.getFullYear()+'-'+p2(d.getMonth()+1);
}

// ¿Le toca a este compromiso pagarse en el mes "mk"?
function compromisoAplicaAlMes(c, mk){
    if(c.activo===false) return false;
    if(!c.duracion || c.duracion.tipo!=='plazo') return true; // indefinido: todos los meses
    if(!c.duracion.fechaInicio || !c.duracion.meses) return false;
    var inicio=c.duracion.fechaInicio;
    // índice de mk respecto al inicio (0 = mismo mes que el inicio)
    var pi=inicio.split('-'), pm=mk.split('-');
    var idx=(parseInt(pm[0],10)-parseInt(pi[0],10))*12 + (parseInt(pm[1],10)-parseInt(pi[1],10));
    return idx>=0 && idx<c.duracion.meses;
}

function montoCompromisoDelMes(c, mk){
    var ajuste=dataAjustesMes[c._id+'_'+mk];
    return (ajuste && ajuste.montoReal!=null && ajuste.montoReal!=='') ? parseFloat(ajuste.montoReal)||0 : (parseFloat(c.montoEstimado)||0);
}

async function guardarAjusteMes(compId, mk, valor){
    try{
        await setDoc(doc(db,COL_AJUSTES,compId+'_'+mk),
            {montoReal: valor===''?null:parseFloat(valor)||0, compromisoId:compId, mes:mk},
            {merge:true});
        toast('Monto del mes actualizado ✓','ok');
    }catch(err){ toast('Error: '+err.message,'err'); }
}
window.guardarAjusteMes=guardarAjusteMes;

function renderPresupuestoMensual(){
    var sel=document.getElementById('presuMesSel');
    if(!sel.value){
        // Por defecto: el próximo mes calendario
        var hoyD=new Date();
        var prox=new Date(hoyD.getFullYear(), hoyD.getMonth()+1, 1);
        sel.value=prox.getFullYear()+'-'+p2(prox.getMonth()+1);
    }
    var mk=sel.value;
    var mkAnterior=sumarMesVenc(mk,-1);

    // 1) Saldo de Caja al cierre del mes ANTERIOR al seleccionado
    //    (todo movimiento con fecha <= último día de ese mes anterior)
    var limite=sumarMesVenc(mk,0)+'-00'; // menor que el primer día del mes seleccionado
    var saldoCaja=0;
    dataCaja.forEach(function(r){
        if(String(r.fecha||'') < (mk+'-01')){
            var m=parseFloat(r.monto)||0;
            saldoCaja += (r.tipo==='ingreso') ? m : -m;
        }
    });

    // 2) Facturas por Cobrar del mes (Emitidas + Vencidas, por su fecha de
    //    vencimiento) — usamos Ingreso Neto, no el bruto.
    var facturasDelMes=dataFacturas.filter(function(r){ return mesKeyVenc(r.fechaVenc)===mk; });
    var totalFacturas=facturasDelMes.reduce(function(s,r){
        var neto=(r.ingresoNeto!=null&&r.ingresoNeto!=='')?parseFloat(r.ingresoNeto):parseFloat(r.total);
        return s+(neto||0);
    },0);

    // 3) Compromisos que le tocan a este mes
    var compromisosDelMes=dataCompromisos.filter(function(c){ return compromisoAplicaAlMes(c,mk); });
    var totalCompromisos=compromisosDelMes.reduce(function(s,c){ return s+montoCompromisoDelMes(c,mk); },0);

    // 4) Cuotas de préstamos que vencen este mes y siguen sin pagar
    var cuotasDelMes=[];
    PRESTAMOS_BASE_VEN.forEach(function(p){
        (p.cuotas||[]).forEach(function(c){
            if(c.estado==='Pagado') return;
            if(mesKeyVenc(c.fecha)!==mk) return;
            cuotasDelMes.push({nombre:p.nombre, monto:parseFloat(c.cuota||c.apagar||0)||0, fecha:c.fecha});
        });
    });
    var totalCuotas=cuotasDelMes.reduce(function(s,c){ return s+c.monto; },0);

    var totalDisponible=saldoCaja+totalFacturas;
    var totalObligaciones=totalCompromisos+totalCuotas;
    var resultado=totalDisponible-totalObligaciones;
    var pctCobertura=totalObligaciones>0 ? (totalDisponible/totalObligaciones*100) : 100;

    // Pintar tarjetas
    document.getElementById('pmSaldoCaja').textContent='S/ '+fmt(saldoCaja);
    document.getElementById('pmFacturas').textContent='S/ '+fmt(totalFacturas)+' ('+facturasDelMes.length+')';
    document.getElementById('pmTotalDisponible').textContent='S/ '+fmt(totalDisponible);
    document.getElementById('pmCompromisos').textContent='S/ '+fmt(totalCompromisos)+' ('+compromisosDelMes.length+')';
    document.getElementById('pmCuotas').textContent='S/ '+fmt(totalCuotas)+' ('+cuotasDelMes.length+')';
    document.getElementById('pmTotalObligaciones').textContent='S/ '+fmt(totalObligaciones);

    var card=document.getElementById('pmResultadoCard');
    var label=document.getElementById('pmResultadoLabel');
    var monto=document.getElementById('pmResultadoMonto');
    card.className='presu-resultado '+(pctCobertura>=100?'cubierto':pctCobertura>=80?'ajustado':'falta');
    if(resultado>=0){
        label.textContent='✅ Cubierto — te sobran de margen';
        monto.textContent='S/ '+fmt(resultado);
    }else{
        label.textContent='⚠️ No cubre — te falta';
        monto.textContent='S/ '+fmt(Math.abs(resultado));
    }

    // Detalle de compromisos (con input de ajuste real por mes)
    var contComp=document.getElementById('pmListaCompromisos');
    if(!compromisosDelMes.length){
        contComp.innerHTML='<div class="pm-empty">Sin compromisos este mes.</div>';
    }else{
        var htmlComp='';
        compromisosDelMes.forEach(function(c){
            var ajuste=dataAjustesMes[c._id+'_'+mk];
            var valorActual=(ajuste&&ajuste.montoReal!=null)?ajuste.montoReal:'';
            htmlComp+='<div class="pm-item">'+
                '<span class="pm-item-nombre" title="'+esc(c.concepto)+'">'+esc(c.concepto)+'</span>'+
                '<input class="pm-ajuste-input" type="number" step="0.01" placeholder="'+fmt(c.montoEstimado)+'" value="'+valorActual+'" '+
                    'onblur="guardarAjusteMes(\''+c._id+'\',\''+mk+'\',this.value)" title="Monto real de este mes (vacío = usa el estimado)">'+
            '</div>';
        });
        contComp.innerHTML=htmlComp;
    }

    // Detalle de cuotas de préstamos
    var contCuotas=document.getElementById('pmListaCuotas');
    if(!cuotasDelMes.length){
        contCuotas.innerHTML='<div class="pm-empty">Sin cuotas de préstamos este mes.</div>';
    }else{
        var htmlCuotas='';
        cuotasDelMes.sort(function(a,b){return a.fecha.localeCompare(b.fecha);});
        cuotasDelMes.forEach(function(c){
            htmlCuotas+='<div class="pm-item">'+
                '<span class="pm-item-nombre" title="'+esc(c.nombre)+'">'+esc(c.nombre)+'</span>'+
                '<span class="pm-item-monto">S/ '+fmt(c.monto)+'</span>'+
            '</div>';
        });
        contCuotas.innerHTML=htmlCuotas;
    }
}
window.renderPresupuestoMensual=renderPresupuestoMensual;

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
