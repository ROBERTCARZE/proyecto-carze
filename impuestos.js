/* ==========================================================================
   IMPUESTOS.JS — Lógica del módulo de Impuestos
   CARZE Contratistas Generales S.A.C.
   --------------------------------------------------------------------------
   Extraído de impuestos.html tal cual estaba (mismo comportamiento, cero
   cambios de lógica) — cuarto módulo separado.
   ========================================================================== */
import { initializeApp }    from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";
import { getFirestore, collection, query, orderBy,
         onSnapshot, addDoc, updateDoc, deleteDoc, setDoc,
         doc, serverTimestamp }  from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";
import { getStorage, ref as sRef,
         uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-storage.js";

const firebaseConfig = {
    apiKey:"AIzaSyAk1FGQia36Y2G08L-_mscMv5JnozmPYa0",
    authDomain:"gestioncarze.firebaseapp.com",
    projectId:"gestioncarze",
    storageBucket:"gestioncarze.firebasestorage.app",
    messagingSenderId:"487407475826",
    appId:"1:487407475826:web:32185a60f0123a5d25f6eb"
};
const app     = initializeApp(firebaseConfig);
const db      = getFirestore(app);
    const auth = getAuth(app);
const storage = getStorage(app);
const COL_DECL = 'impuestos_declaraciones';
const COL_DETR_DEP = 'detracciones_depositos'; // 1 doc por factura, solo la fecha de depósito
const COL_MOV = 'impuestos_detracciones'; // reutiliza la colección/permiso que ya existía

var declData = [];
var facturasData = [];   // leído en vivo de 'facturas', solo lectura
var depositosData = {};  // {facturaId: {fechaDeposito}}
var movData = [];        // ingresos/egresos manuales de la cuenta de detracciones
var editDeclId = null;
var uploadDeclData = {nombre:null,url:null};
var tabActual = 'decl';

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
    document.getElementById('avatarInitials').textContent=n.split(' ').map(function(p){return p[0]||'';}).slice(0,2).join('').toUpperCase()||'U';
    document.getElementById('dFechaPres').value=hoy();
    iniciarListeners();
});

function iniciarListeners(){
    onSnapshot(query(collection(db,COL_DECL),orderBy('periodo_orden','desc')),function(snap){
        declData=snap.docs.map(function(d){var r=d.data();r._id=d.id;return r;});
        renderDecl();
        calcularKPIs();
    },function(err){toast('Error declaraciones: '+err.message,'err');});

    // Facturas — solo lectura, para sacar las que tienen detracción.
    // No se duplica nada: Serie, RUC, Razón Social, Total, Desc. Ley
    // siempre se leen en vivo desde aquí.
    onSnapshot(collection(db,'facturas'),function(snap){
        facturasData=snap.docs.map(function(d){var r=d.data();r._id=d.id;return r;});
        poblarFiltroMesesDetr();
        renderDetr();
    },function(err){toast('Error facturas: '+err.message,'err');});

    // Solo guarda la fecha de depósito por factura — un doc chiquito por
    // factura, nada del resto de sus datos.
    onSnapshot(collection(db,COL_DETR_DEP),function(snap){
        depositosData={};
        snap.forEach(function(d){ depositosData[d.id]=d.data(); });
        renderDetr();
    },function(err){toast('Error depósitos: '+err.message,'err');});

    // Movimientos manuales de ingreso/egreso de la cuenta de detracciones
    onSnapshot(query(collection(db,COL_MOV),orderBy('fecha','asc')),function(snap){
        movData=snap.docs.map(function(d){var r=d.data();r._id=d.id;return r;});
        renderMov();
    },function(err){toast('Error movimientos: '+err.message,'err');});
}

// ── HELPERS ───────────────────────────────────────────────────
function hoy(){var d=new Date();return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate());}
function p2(n){return n<10?'0'+n:String(n);}
function fmt(n){return parseFloat(n||0).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2});}
function esc(v){return v!=null&&v!==''?String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;'):'—';}
function n(id){return parseFloat(document.getElementById(id).value)||0;}
function fmtF(v){if(!v||v==='-')return '—';var s=String(v).trim();if(s.match(/^\d{4}-\d{2}-\d{2}/)){var p=s.substring(0,10).split('-');return p[2]+'/'+p[1]+'/'+p[0];}return s;}
function periodoOrden(p){
    var meses={enero:1,febrero:2,marzo:3,abril:4,mayo:5,junio:6,julio:7,agosto:8,septiembre:9,octubre:10,noviembre:11,diciembre:12};
    var parts=String(p||'').toLowerCase().split(' ');
    var mes=meses[parts[0]]||0, anio=parseInt(parts[1])||0;
    return anio*100+mes;
}

function toast(msg,tipo){
    var t=document.getElementById('toast');
    t.textContent=msg;t.className='toast '+(tipo||'ok');t.classList.add('show');
    setTimeout(function(){t.classList.remove('show');},3200);
}

// ── CAMBIAR TAB ───────────────────────────────────────────────
function cambiarTab(tab){
    tabActual=tab;
    document.getElementById('vistaDecl').style.display=tab==='decl'?'block':'none';
    document.getElementById('vistaDetr').style.display=tab==='detr'?'block':'none';
    document.getElementById('tabDecl').classList.toggle('active',tab==='decl');
    document.getElementById('tabDetr').classList.toggle('active',tab==='detr');
}
window.cambiarTab=cambiarTab;

// ── CÁLCULO MODAL DECLARACIÓN ─────────────────────────────────
function calcularDecl(){
    var igvPagar = n('dIGVVentas') - n('dIGVCompras');
    // Negativo = saldo a favor (no forzar a 0)
    document.getElementById('dIGVPagar').value = igvPagar.toFixed(2);
    // Color visual del campo IGV a Pagar
    var igvInput = document.getElementById('dIGVPagar');
    igvInput.style.color = igvPagar < 0 ? 'var(--verde)' : 'var(--txt)';
    igvInput.style.fontWeight = igvPagar < 0 ? '800' : '';

    var planilla = n('dEssalud') + n('dSNP') + n('dRenta4ta');
    document.getElementById('dTotalPlanilla').value = fmt(planilla);

    var igv      = n('dIGVPagar');         // puede ser negativo
    var renta    = n('dRentaPagar');
    // Saldo a favor del período anterior (se ingresa como positivo)
    // Si es positivo (saldo a favor anterior), se RESTA al igv actual
    // Si igv actual ya es negativo, se ACUMULA (suma algebraica)
    var saldoAnt = n('dSaldoFavorAnterior'); // positivo = tengo crédito a favor

    // IGV neto = IGV actual + saldo favor anterior (ambos con signo real)
    // saldoAnt es un crédito → se resta al IGV a pagar
    var igvNeto = igv - saldoAnt; // si igv=-2000 y saldoAnt=1000 → igvNeto=-3000
    // Si igvNeto < 0 → saldo a favor acumulado, IGV a pagar = 0
    var igvAPagar = igvNeto < 0 ? 0 : igvNeto;
    var saldoAcum = igvNeto < 0 ? Math.abs(igvNeto) : 0; // crédito que arrastra

    // Total general: solo paga IGV si igvNeto > 0
    var total = igvAPagar + renta + planilla;

    // ── Resumen visual ────────────────────────────────────────
    // IGV a Pagar este mes
    if(igv < 0){
        document.getElementById('resIGV').innerHTML =
            '<span style="color:var(--verde);font-weight:800">− S/ '+fmt(Math.abs(igv))+
            ' <small style="font-size:.58rem;font-weight:600">(saldo a favor)</small></span>';
    } else {
        document.getElementById('resIGV').textContent = 'S/ '+fmt(igv);
        document.getElementById('resIGV').style.color = 'var(--azul2)';
    }

    // Saldo favor anterior aplicado
    if(saldoAnt > 0){
        document.getElementById('resSaldoFavor').innerHTML =
            '<span style="color:var(--verde);font-weight:800">− S/ '+fmt(saldoAnt)+'</span>';
    } else {
        document.getElementById('resSaldoFavor').textContent = '—';
    }

    // IGV Neto resultante
    if(igvNeto <= 0){
        document.getElementById('resIGVNeto').innerHTML =
            '<span style="color:var(--verde);font-weight:800">Saldo a favor: S/ '+fmt(saldoAcum)+'</span>';
    } else {
        document.getElementById('resIGVNeto').innerHTML =
            '<span style="color:var(--azul2);font-weight:800">A pagar: S/ '+fmt(igvNeto)+'</span>';
    }

    document.getElementById('resRenta').textContent     = 'S/ '+fmt(renta);
    document.getElementById('resPlanilla').textContent  = 'S/ '+fmt(planilla);
    document.getElementById('resTotal').textContent     = 'S/ '+fmt(total);
}
window.calcularDecl=calcularDecl;

// ── KPIs DECLARACIONES ────────────────────────────────────────
function calcularKPIs(){
    var igv=0,renta=0,planilla=0;
    declData.forEach(function(r){
        // Usar igvNeto (ya descuenta saldo anterior) para KPI real
        var igvReal = r.igvNeto !== undefined ? r.igvNeto : (parseFloat(r.igvPagar)||0)-(parseFloat(r.saldoFavorAnterior)||0);
        igv      += igvReal;
        renta    += parseFloat(r.rentaPagar)||0;
        planilla += parseFloat(r.totalPlanilla)||0;
    });
    var total = igv + renta + planilla;
    var kigv = document.getElementById('kIGV');
    kigv.textContent = (igv<0?'':'') + 'S/ '+fmt(igv);
    kigv.style.color = igv<0 ? 'var(--verde)' : 'var(--naranja)';
    document.getElementById('kRenta').textContent    = 'S/ '+fmt(renta);
    document.getElementById('kPlanilla').textContent = 'S/ '+fmt(planilla);
    var ktot = document.getElementById('kTotal');
    ktot.textContent = 'S/ '+fmt(total);
    ktot.style.color = total<0 ? 'var(--verde)' : 'var(--morado)';
}

// ── KPIs DETRACCIONES (ahora desde Facturas + fechas de depósito) ──
function facturasConDetraccion(){
    // Las facturas Anuladas no representan una detracción real por cobrar/depositar
    // (el negocio no se concretó), así que no deben sumar en ningún KPI ni tabla.
    return facturasData.filter(function(r){
        return (parseFloat(r.detraccion)||0) > 0 && (r.estado||'').toLowerCase()!=='anulada';
    });
}
function calcularKPIsDetr(){
    var lista=facturasConDetraccion();
    var total=0, depSuma=0, depCant=0, pendSuma=0, pendCant=0;

    // Si hay un mes elegido en el filtro, la tarjeta "Depositado" se calcula
    // sobre ESE mes (no siempre el mes real de hoy).
    var mesSel=document.getElementById('filterMesDetr').value;
    var mesRef=mesSel||mesActualStr();
    var mesSuma=0, mesCant=0;

    lista.forEach(function(r){
        var monto=parseFloat(r.detraccion)||0;
        total+=monto;
        var dep=depositosData[r._id];
        if(dep && dep.fechaDeposito){
            depSuma+=monto; depCant++;
            if(String(dep.fechaDeposito).substring(0,7)===mesRef){ mesSuma+=monto; mesCant++; }
        } else {
            pendSuma+=monto; pendCant++;
        }
    });

    document.getElementById('dTotalDetr').textContent='S/ '+fmt(total);
    document.getElementById('dTotalDetrSub').textContent=lista.length+' factura'+(lista.length!==1?'s':'')+' con detracción';
    document.getElementById('dDepositadas').textContent='S/ '+fmt(depSuma);
    document.getElementById('dDepositadasSub').textContent=depCant+' factura'+(depCant!==1?'s':'');
    document.getElementById('dPendientesDep').textContent='S/ '+fmt(pendSuma);
    document.getElementById('dPendientesDepSub').textContent=pendCant+' factura'+(pendCant!==1?'s':'');
    document.getElementById('dDepositadoMes').textContent='S/ '+fmt(mesSuma);
    document.getElementById('dDepositadoMesSub').textContent=mesCant+' depósito'+(mesCant!==1?'s':'')+(mesSel?'':' este mes');
    document.getElementById('dDepositadoMesLabel').textContent = mesSel
        ? 'Depositado en '+MESES_LARGO_DETR[parseInt(mesSel.split('-')[1],10)-1]+' '+mesSel.split('-')[0]
        : 'Depositado este Mes';
}
function mesActualStr(){var h=new Date();return h.getFullYear()+'-'+p2(h.getMonth()+1);}

// ── RENDER DECLARACIONES ──────────────────────────────────────
function renderDecl(){
    var tbody=document.getElementById('bodyDecl');
    var empty=document.getElementById('emptyDecl');
    tbody.innerHTML='';
    if(!declData.length){empty.style.display='flex';return;}
    empty.style.display='none';
    declData.forEach(function(r){
        var estCls = r.estado==='pagado'?'p-pagado':r.estado==='favor'?'p-favor':'p-pendiente';
        var estTxt = r.estado==='pagado'?'Pagado':r.estado==='favor'?'Saldo a Favor':'Pendiente';
        var constancia = r.constNombre&&r.constNombre!=='-'
            ? '<a href="'+r.constLink+'" target="_blank" rel="noopener" style="color:var(--azul2);font-size:.72rem;font-weight:600;text-decoration:underline">'+esc(r.constNombre)+'</a>'
            : '<span style="color:#94a3b8">—</span>';
        var tr=document.createElement('tr');
        tr.innerHTML=
            '<td>'+esc(r.periodo)+'</td>'+
            '<td>'+fmtF(r.fechaPres)+'</td>'+
            '<td>S/ '+fmt(r.ventasNetas)+'</td>'+
            '<td>S/ '+fmt(r.comprasNetas||0)+'</td>'+
            '<td>S/ '+fmt(r.igvVentas)+'</td>'+
            '<td>S/ '+fmt(r.igvCompras)+'</td>'+
            '<td style="font-weight:700;color:'+(r.igvPagar<0?'#16a34a':'#dc2626')+'">'+(r.igvPagar<0?'− S/ '+fmt(Math.abs(r.igvPagar)):'S/ '+fmt(r.igvPagar))+'</td>'+
            '<td style="color:#16a34a;font-weight:700">'+(r.saldoFavorAnterior>0?'− S/ '+fmt(r.saldoFavorAnterior):'—')+'</td>'+
            '<td style="font-weight:800;color:'+(((r.igvPagar||0)-(r.saldoFavorAnterior||0))<0?'#16a34a':'#dc2626')+'">'+((r.igvNeto!==undefined?r.igvNeto:(r.igvPagar||0)-(r.saldoFavorAnterior||0))<0?'✅ Saldo a Favor: S/ '+fmt(Math.abs(r.igvNeto!==undefined?r.igvNeto:(r.igvPagar||0)-(r.saldoFavorAnterior||0))):'🔴 A Pagar: S/ '+fmt(r.igvNeto!==undefined?r.igvNeto:(r.igvPagar||0)-(r.saldoFavorAnterior||0)))+'</td>'+
            '<td style="font-weight:700;color:var(--verde)">S/ '+fmt(r.rentaPagar)+'</td>'+
            '<td>S/ '+fmt(r.totalPlanilla)+'</td>'+
            '<td style="font-weight:800;color:var(--naranja)">S/ '+fmt(r.totalPagar)+'</td>'+
            '<td>'+(parseFloat(r.pagadoDetraccion)>0?'<span style="color:var(--morado);font-weight:700">S/ '+fmt(r.pagadoDetraccion)+'</span>':'<span style="color:#94a3b8">—</span>')+'</td>'+
            '<td><span class="pill-estado '+estCls+'"><span class="pill-dot"></span>'+estTxt+'</span></td>'+
            '<td>'+constancia+'</td>'+
            '<td style="display:flex;gap:6px">'+
                '<button class="btn btn-edit" style="padding:4px 10px;font-size:.7rem" onclick="editarDecl(\''+r._id+'\')">✏️</button>'+
                '<button class="btn-del" onclick="pedirEliminar(\''+r._id+'\',\'decl\',\''+esc(r.periodo)+'\')">🗑️</button>'+
            '</td>';
        tbody.appendChild(tr);
    });
}

// ── RENDER DETRACCIONES ───────────────────────────────────────
function renderDetr(){
    var tbody=document.getElementById('bodyDetr');
    var empty=document.getElementById('emptyDetr');
    var mesSel=document.getElementById('filterMesDetr').value;
    var busq=document.getElementById('buscarNumFactDetr').value.trim().toLowerCase();

    calcularKPIsDetr(); // las tarjetas KPI dependen del mes elegido en el filtro,
                         // así que se recalculan cada vez que se redibuja la tabla.

    var lista=facturasConDetraccion().filter(function(r){
        var mM=!mesSel || String(r.fechaEmision||'').substring(0,7)===mesSel;
        var mB=!busq || String(r.numFact||'').toLowerCase().includes(busq);
        return mM&&mB;
    });
    // Más recientes primero
    lista.sort(function(a,b){
        var df=String(b.fechaEmision||'').localeCompare(String(a.fechaEmision||''));
        if(df!==0) return df;
        // Mismo día: desempatar por número de factura (de mayor a menor)
        return (parseInt(b.numFact,10)||0)-(parseInt(a.numFact,10)||0);
    });

    tbody.innerHTML='';
    if(!lista.length){
        empty.style.display='flex';
        empty.querySelector('p').textContent = (mesSel||busq)
            ? 'No se encontraron facturas con esos filtros.'
            : 'No hay facturas con detracción registradas todavía.';
        return;
    }
    empty.style.display='none';

    lista.forEach(function(r,i){
        var dep=depositosData[r._id]||{};
        var tr=document.createElement('tr');
        tr.innerHTML=
            '<td>'+(i+1)+'</td>'+
            '<td>'+fmtF(r.fechaEmision)+'</td>'+
            '<td>'+esc(r.serie)+'-'+esc(r.numFact)+'</td>'+
            '<td>'+esc(r.ruc)+'</td>'+
            '<td style="max-width:220px;overflow:hidden;text-overflow:ellipsis">'+esc(r.razonSocial)+'</td>'+
            '<td style="font-weight:700">S/ '+fmt(r.total)+'</td>'+
            '<td style="color:var(--naranja);font-weight:700">S/ '+fmt(r.detraccion)+'</td>'+
            '<td><input class="finput" type="date" style="padding:6px 8px;font-size:.75rem" value="'+(dep.fechaDeposito||'')+'" onblur="guardarFechaDeposito(\''+r._id+'\',this.value)"></td>';
        tbody.appendChild(tr);
    });
}

// Se guarda en un documento chiquito y aparte por factura — no se toca ni
// se duplica nada de la factura original.
async function guardarFechaDeposito(facturaId, fecha){
    try{
        await setDoc(doc(db,COL_DETR_DEP,facturaId), {fechaDeposito:fecha||null, updatedAt:serverTimestamp()}, {merge:true});
        toast('Fecha de depósito guardada ✓','ok');
    }catch(err){ toast('Error: '+err.message,'err'); }
}
window.guardarFechaDeposito=guardarFechaDeposito;

// Arma el selector de meses solo con los meses que realmente tienen
// facturas con detracción.
var MESES_LARGO_DETR=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
var filtroMesDetrInicializado=false;
function poblarFiltroMesesDetr(){
    var sel=document.getElementById('filterMesDetr');
    var valorPrevio=sel.value;
    var mesesSet={};
    facturasConDetraccion().forEach(function(r){
        var mk=String(r.fechaEmision||'').substring(0,7);
        if(mk.match(/^\d{4}-\d{2}$/)) mesesSet[mk]=true;
    });
    var meses=Object.keys(mesesSet).sort().reverse(); // más reciente primero
    var html='<option value="">Todos los meses</option>';
    meses.forEach(function(mk){
        var p=mk.split('-');
        html+='<option value="'+mk+'">'+MESES_LARGO_DETR[parseInt(p[1],10)-1]+' '+p[0]+'</option>';
    });
    sel.innerHTML=html;

    if(!filtroMesDetrInicializado && meses.length){
        // Primera carga: arrancar mostrando solo el mes más reciente (menos
        // filas de entrada, más liviano de leer), sin perder el resto de
        // meses — siguen disponibles en el desplegable para consultarlos.
        sel.value=meses[0];
        filtroMesDetrInicializado=true;
    } else if(meses.includes(valorPrevio)){
        sel.value=valorPrevio;
    }
}
window.renderDetr=renderDetr;

// ── MOVIMIENTOS DE LA CUENTA (ingreso/egreso manual, saldo automático) ──
function renderMov(){
    var tbody=document.getElementById('bodyMov');
    var empty=document.getElementById('emptyMov');
    tbody.innerHTML='';

    if(!movData.length){
        empty.style.display='flex';
        document.getElementById('saldoMovBadge').textContent='Saldo: S/ 0.00';
        return;
    }
    empty.style.display='none';

    // El saldo es automático: se recalcula acumulando ingresos y egresos en
    // orden cronológico (el listener ya trae los datos ordenados por fecha).
    var saldo=0;
    movData.forEach(function(r){
        var ing=parseFloat(r.ingreso)||0, eg=parseFloat(r.egreso)||0;
        saldo += ing - eg;
        var tr=document.createElement('tr');
        tr.innerHTML=
            '<td>'+fmtF(r.fecha)+'</td>'+
            '<td><span class="pill-tipo '+(ing>0?'ingreso':'egreso')+'">'+(ing>0?'📥 Ingreso':'📤 Egreso')+'</span></td>'+
            '<td>'+esc(r.desc)+'</td>'+
            '<td class="mov-ingreso">'+(ing>0?'+ S/ '+fmt(ing):'—')+'</td>'+
            '<td class="mov-egreso">'+(eg>0?'− S/ '+fmt(eg):'—')+'</td>'+
            '<td style="font-weight:800;color:'+(saldo<0?'#dc2626':'var(--azul)')+'">S/ '+fmt(saldo)+'</td>'+
            '<td>'+
                '<button class="btn-edit-mini" onclick="abrirModalMov(\''+r._id+'\')" title="Editar">✏️</button>'+
                '<button class="btn-del" onclick="pedirEliminar(\''+r._id+'\',\'mov\',\''+esc(r.desc)+'\')" title="Eliminar">🗑️</button>'+
            '</td>';
        tbody.appendChild(tr);
    });

    document.getElementById('saldoMovBadge').textContent='Saldo: S/ '+fmt(saldo);
    document.getElementById('saldoMovBadge').style.color = saldo<0 ? '#dc2626' : 'var(--azul)';
}

var movEditId=null; // si no es null, guardarMov() actualiza en vez de crear

function abrirModalMov(id){
    movEditId = id || null;
    var titulo=document.getElementById('movModalTitulo');
    var btnTxt=document.getElementById('btnGuardarMovTxt');

    if(movEditId){
        var r=movData.find(function(m){return m._id===movEditId;});
        if(!r){ movEditId=null; }
        else{
            document.getElementById('movFecha').value=r.fecha||'';
            document.getElementById('movTipo').value=(parseFloat(r.ingreso)||0)>0?'ingreso':'egreso';
            document.getElementById('movDesc').value=r.desc||'';
            document.getElementById('movMonto').value=(parseFloat(r.ingreso)||0)>0?r.ingreso:r.egreso;
            titulo.innerHTML='Editar <span>Movimiento</span>';
            btnTxt.textContent='GUARDAR CAMBIOS';
        }
    }
    if(!movEditId){
        document.getElementById('movFecha').value='';
        document.getElementById('movTipo').value='ingreso';
        document.getElementById('movDesc').value='';
        document.getElementById('movMonto').value='';
        titulo.innerHTML='Registrar <span>Movimiento</span>';
        btnTxt.textContent='REGISTRAR';
    }
    document.getElementById('overlayMov').classList.add('open');
}
window.abrirModalMov=abrirModalMov;

function cerrarModalMov(){document.getElementById('overlayMov').classList.remove('open');movEditId=null;}
window.cerrarModalMov=cerrarModalMov;

async function guardarMov(){
    var fecha=document.getElementById('movFecha').value;
    var tipo=document.getElementById('movTipo').value;
    var desc=document.getElementById('movDesc').value.trim();
    var monto=parseFloat(document.getElementById('movMonto').value)||0;
    if(!fecha){toast('Ingresa la fecha del movimiento','err');return;}
    if(!desc){toast('Ingresa una descripción','err');return;}
    if(monto<=0){toast('Ingresa un monto válido','err');return;}

    var btn=document.getElementById('btnGuardarMov');
    var txt=document.getElementById('btnGuardarMovTxt');
    btn.disabled=true;txt.innerHTML='<span class="spinner"></span>';

    var docData={
        fecha:fecha, desc:desc,
        ingreso: tipo==='ingreso'?monto:0,
        egreso:  tipo==='egreso'?monto:0,
        updatedAt:serverTimestamp()
    };
    try{
        if(movEditId){
            await updateDoc(doc(db,COL_MOV,movEditId),docData);
            toast('Movimiento actualizado ✓','ok');
        }else{
            docData.createdAt=serverTimestamp();
            await addDoc(collection(db,COL_MOV),docData);
            toast('Movimiento registrado ✓','ok');
        }
        btn.disabled=false;txt.textContent=movEditId?'GUARDAR CAMBIOS':'REGISTRAR';
        cerrarModalMov();
    }catch(err){
        btn.disabled=false;txt.textContent=movEditId?'GUARDAR CAMBIOS':'REGISTRAR';
        toast('Error: '+err.message,'err');
    }
}
window.guardarMov=guardarMov;

// ── MODAL DECLARACIÓN ─────────────────────────────────────────
function abrirModalDecl(){
    editDeclId=null; limpiarDecl();
    // Auto-fill saldo a favor del período anterior
    autoFillSaldoFavor();
    document.getElementById('titleDecl').innerHTML='Nueva <span>Declaración</span>';
    document.getElementById('btnGuardarDeclTxt').textContent='REGISTRAR';
    document.getElementById('overlayDecl').classList.add('open');
}

function autoFillSaldoFavor(){
    // Buscar la última declaración guardada y ver si tiene saldo a favor (igvNeto < 0)
    if(!declData.length) return;
    // Ordenar por periodo_orden descendente para tomar el más reciente
    var sorted = [...declData].sort(function(a,b){return (b.periodo_orden||0)-(a.periodo_orden||0);});
    var ultima = sorted[0];
    if(!ultima) return;
    var igvNeto = ultima.igvNeto !== undefined ? ultima.igvNeto : (ultima.igvPagar||0)-(ultima.saldoFavorAnterior||0);
    if(igvNeto < 0){
        // Hay saldo a favor: pre-llenar con el valor acumulado
        var saldoAFavor = Math.abs(igvNeto);
        document.getElementById('dSaldoFavorAnterior').value = saldoAFavor.toFixed(2);
        calcularDecl();
        // Mostrar aviso visual
        var campo = document.getElementById('dSaldoFavorAnterior');
        campo.style.background = '#f0fdf4';
        campo.title = 'Auto-llenado desde período anterior: '+ultima.periodo;
    }
}
window.abrirModalDecl=abrirModalDecl;

function editarDecl(id){
    var r=declData.find(function(x){return x._id===id;}); if(!r) return;
    editDeclId=id;
    document.getElementById('dPeriodo').value=r.periodo||'';
    document.getElementById('dFechaPres').value=r.fechaPres||'';
    document.getElementById('dVentasNetas').value=r.ventasNetas||'';
    document.getElementById('dComprasNetas').value=r.comprasNetas||'';
    document.getElementById('dSaldoFavorAnterior').value=r.saldoFavorAnterior||'';
    document.getElementById('dIGVVentas').value=r.igvVentas||'';
    document.getElementById('dIGVCompras').value=r.igvCompras||'';
    document.getElementById('dIGVPagar').value=r.igvPagar||'';
    document.getElementById('dIngresosNetos').value=r.ingresosNetos||'';
    document.getElementById('dRentaPagar').value=r.rentaPagar||'';
    document.getElementById('dEssalud').value=r.essalud||'';
    document.getElementById('dSNP').value=r.snp||'';
    document.getElementById('dRenta4ta').value=r.renta4ta||'';
    document.getElementById('dPagadoDetraccion').value=r.pagadoDetraccion||'';
    document.getElementById('dEstado').value=r.estado||'';
    document.getElementById('dObs').value=r.obs||'';
    calcularDecl();
    // Archivo
    removeFileDecl();
    if(r.constNombre&&r.constNombre!=='-'){
        uploadDeclData={nombre:r.constNombre,url:r.constLink};
        document.getElementById('existlinkDecl').href=r.constLink;
        document.getElementById('existlinkDecl').textContent=r.constNombre;
        document.getElementById('existDecl').style.display='flex';
    }
    document.getElementById('titleDecl').innerHTML='Editar <span>Declaración</span>';
    document.getElementById('btnGuardarDeclTxt').textContent='ACTUALIZAR';
    document.getElementById('overlayDecl').classList.add('open');
}
window.editarDecl=editarDecl;

function cerrarModalDecl(){document.getElementById('overlayDecl').classList.remove('open');}
window.cerrarModalDecl=cerrarModalDecl;

function limpiarDecl(){
    ['dPeriodo','dEstado'].forEach(function(id){document.getElementById(id).value='';});
    ['dVentasNetas','dComprasNetas','dIGVVentas','dIGVCompras','dIGVPagar','dIngresosNetos',
     'dRentaPagar','dEssalud','dSNP','dRenta4ta','dTotalPlanilla',
     'dSaldoFavorAnterior','dPagadoDetraccion','dObs'].forEach(function(id){document.getElementById(id).value='';});
    document.getElementById('dFechaPres').value=hoy();
    ['resIGV','resRenta','resPlanilla','resTotal'].forEach(function(id){document.getElementById(id).textContent='S/ 0';});
    document.getElementById('resSaldoFavor').textContent='—';
    document.getElementById('resIGVNeto').textContent='—';
    removeFileDecl();
}

// ── UPLOAD DECLARACIÓN ────────────────────────────────────────
function handleFileDecl(event){
    var file=event.target.files[0]; if(!file) return;
    var periodo=document.getElementById('dPeriodo').value.replace(/ /g,'_')||'doc';
    var path='impuestos/'+periodo+'_'+Date.now()+'.pdf';
    var storRef=sRef(storage,path);
    document.getElementById('unameDecl').textContent=file.name;
    document.getElementById('unameDecl').style.display='block';
    document.getElementById('uprogDecl').style.display='block';
    var fill=document.getElementById('uprogfillDecl');
    var st=document.getElementById('ustDecl');
    st.style.color='var(--azul2)';st.textContent='Subiendo...';
    var task=uploadBytesResumable(storRef,file);
    task.on('state_changed',
        function(snap){fill.style.width=Math.round(snap.bytesTransferred/snap.totalBytes*100)+'%';},
        function(err){st.style.color='#dc2626';st.textContent='Error: '+err.message;},
        function(){
            getDownloadURL(task.snapshot.ref).then(function(url){
                uploadDeclData={nombre:file.name,url:url};
                st.style.color='#16a34a';st.textContent='✓ Subido';
                document.getElementById('existlinkDecl').href=url;
                document.getElementById('existlinkDecl').textContent=file.name;
                document.getElementById('existDecl').style.display='flex';
            });
        }
    );
}
window.handleFileDecl=handleFileDecl;

function removeFileDecl(){
    uploadDeclData={nombre:null,url:null};
    document.getElementById('existDecl').style.display='none';
    document.getElementById('unameDecl').style.display='none';
    document.getElementById('uprogDecl').style.display='none';
    document.getElementById('ustDecl').textContent='';
    var inp=document.getElementById('boxConstancia').querySelector('input[type=file]');
    if(inp) inp.value='';
}
window.removeFileDecl=removeFileDecl;

// ── GUARDAR DECLARACIÓN ───────────────────────────────────────
async function guardarDecl(){
    var periodo=document.getElementById('dPeriodo').value;
    var estado =document.getElementById('dEstado').value;
    var fechaPres=document.getElementById('dFechaPres').value;
    if(!periodo||!estado||!fechaPres){toast('Completa los campos obligatorios (*)','err');return;}
    var btn=document.getElementById('btnGuardarDecl');
    var txt=document.getElementById('btnGuardarDeclTxt');
    btn.disabled=true;txt.innerHTML='<span class="spinner"></span>';
    var planilla=n('dEssalud')+n('dSNP')+n('dRenta4ta');
    var totalPagar=n('dIGVPagar')+n('dRentaPagar')+planilla;
    var docData={
        periodo:periodo, fechaPres:fechaPres,
        ventasNetas:n('dVentasNetas'), igvVentas:n('dIGVVentas'),
        comprasNetas:n('dComprasNetas'),
        igvCompras:n('dIGVCompras'),   igvPagar:n('dIGVPagar'),
        saldoFavorAnterior:n('dSaldoFavorAnterior'),
        igvNeto:(n('dIGVPagar')-n('dSaldoFavorAnterior')),
        ingresosNetos:n('dIngresosNetos'), rentaPagar:n('dRentaPagar'),
        essalud:n('dEssalud'), snp:n('dSNP'), renta4ta:n('dRenta4ta'),
        totalPlanilla:planilla, totalPagar:totalPagar,
        pagadoDetraccion:n('dPagadoDetraccion'),
        estado:estado, obs:document.getElementById('dObs').value.trim()||'-',
        constNombre:uploadDeclData.nombre||'-', constLink:uploadDeclData.url||'-',
        periodo_orden:periodoOrden(periodo),
        updatedAt:serverTimestamp()
    };
    try{
        if(editDeclId){
            await updateDoc(doc(db,COL_DECL,editDeclId),docData);
            toast('Declaración actualizada ✓','ok');
        } else {
            docData.createdAt=serverTimestamp();
            await addDoc(collection(db,COL_DECL),docData);
            toast('Declaración registrada ✓','ok');
        }
        btn.disabled=false;txt.textContent=editDeclId?'ACTUALIZAR':'REGISTRAR';
        cerrarModalDecl();
    }catch(err){btn.disabled=false;txt.textContent=editDeclId?'ACTUALIZAR':'REGISTRAR';toast('Error: '+err.message,'err');}
}
window.guardarDecl=guardarDecl;

// ── ELIMINAR ─────────────────────────────────────────────────
var pendingDel=null, pendingDelCol=null;
function pedirEliminar(id,col,nombre){
    pendingDel=id;
    pendingDelCol = col==='mov' ? COL_MOV : COL_DECL;
    document.getElementById('confirmMsg').textContent='Se eliminará el registro "'+nombre+'". Esta acción no se puede deshacer.';
    document.getElementById('confirmOverlay').classList.add('open');
    document.getElementById('confirmOkBtn').onclick=ejecutarEliminar;
}
window.pedirEliminar=pedirEliminar;
function cerrarConfirm(){document.getElementById('confirmOverlay').classList.remove('open');pendingDel=null;}
window.cerrarConfirm=cerrarConfirm;
async function ejecutarEliminar(){
    if(!pendingDel) return; cerrarConfirm();
    try{await deleteDoc(doc(db,pendingDelCol,pendingDel));toast('Registro eliminado','warn');}
    catch(err){toast('Error: '+err.message,'err');}
}

// ── EXPORTAR EXCEL DECLARACIONES ─────────────────────────────
function exportarExcelDecl(){
    if(!declData.length){toast('No hay declaraciones para exportar','warn');return;}
    var rows=[['Período','F. Presentación','Ventas Netas','Compras Netas','IGV Ventas','IGV Compras','IGV a Pagar','Renta a Pagar','EsSalud','SNP','Renta 4ta','Total Planilla','Saldo Favor Ant.','Total Pagado','Pagado c/Detracción','Estado','Observaciones']];
    declData.forEach(function(r){
        rows.push([r.periodo,r.fechaPres,r.ventasNetas,r.comprasNetas||0,r.igvVentas,r.igvCompras,r.igvPagar,r.rentaPagar,r.essalud,r.snp,r.renta4ta,r.totalPlanilla,r.saldoFavorAnterior||0,r.totalPagar,r.pagadoDetraccion,r.estado,r.obs]);
    });
    var wb=XLSX.utils.book_new();
    var ws=XLSX.utils.aoa_to_sheet(rows);
    ws['!cols']=[{wch:15},{wch:15},{wch:14},{wch:12},{wch:12},{wch:12},{wch:12},{wch:10},{wch:10},{wch:12},{wch:14},{wch:13},{wch:18},{wch:12},{wch:20}];
    XLSX.utils.book_append_sheet(wb,ws,'Declaraciones');
    XLSX.writeFile(wb,'CARZE_Impuestos_'+new Date().getFullYear()+'.xlsx');
    toast('Excel generado ✓','ok');
}
window.exportarExcelDecl=exportarExcelDecl;

function exportarExcelDetr(){
    var mesSel=document.getElementById('filterMesDetr').value;
    var lista=facturasConDetraccion().filter(function(r){
        return !mesSel || String(r.fechaEmision||'').substring(0,7)===mesSel;
    });
    if(!lista.length){toast('No hay facturas con detracción para exportar','warn');return;}
    lista.sort(function(a,b){
        var df=String(b.fechaEmision||'').localeCompare(String(a.fechaEmision||''));
        if(df!==0) return df;
        // Mismo día: desempatar por número de factura (de mayor a menor)
        return (parseInt(b.numFact,10)||0)-(parseInt(a.numFact,10)||0);
    });

    var rows=[['N°','F. Emisión','Serie','RUC','Razón Social','Total','Desc. Ley','F. Depósito']];
    lista.forEach(function(r,i){
        var dep=depositosData[r._id]||{};
        rows.push([i+1, r.fechaEmision, r.serie+'-'+r.numFact, r.ruc, r.razonSocial, r.total, r.detraccion, dep.fechaDeposito||'Pendiente']);
    });
    var wb=XLSX.utils.book_new();
    var ws=XLSX.utils.aoa_to_sheet(rows);
    ws['!cols']=[{wch:5},{wch:12},{wch:14},{wch:13},{wch:30},{wch:12},{wch:12},{wch:14}];
    XLSX.utils.book_append_sheet(wb,ws,'Detracciones');
    XLSX.writeFile(wb,'CARZE_Detracciones_'+new Date().getFullYear()+'.xlsx');
    toast('Excel generado ✓','ok');
}
window.exportarExcelDetr=exportarExcelDetr;

// ── EXPORTAR PDF ──────────────────────────────────────────────
function exportarPDF(){
    if(!declData.length){toast('No hay declaraciones para exportar','warn');return;}
    var ahora=new Date();
    document.getElementById('pdfFechaGen').textContent=p2(ahora.getDate())+'/'+p2(ahora.getMonth()+1)+'/'+ahora.getFullYear()+'  '+p2(ahora.getHours())+':'+p2(ahora.getMinutes());
    document.getElementById('pdfUsuarioGen').textContent='Usuario: '+(sessionStorage.getItem('carze_nombre')||'—');
    window.print();
}
window.exportarPDF=exportarPDF;

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

document.addEventListener('keydown',function(e){if(e.key==='Escape'){cerrarModalDecl();cerrarConfirm();}});
