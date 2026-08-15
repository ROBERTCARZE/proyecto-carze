/* ==========================================================================
   DASHBOARD.JS — Lógica del módulo de Dashboard
   CARZE Contratistas Generales S.A.C.
   --------------------------------------------------------------------------
   Extraído de dashboard.html tal cual estaba (mismo comportamiento, cero
   cambios de lógica) — séptimo módulo separado.
   ========================================================================== */
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";
import { getFirestore, collection, query, where,
         onSnapshot, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";

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

// ── ESTADO GLOBAL ─────────────────────────────────────────────
var G={
    caja:[],facturas:[],cotizaciones:[],certificados:[],
    impuestos:[],impuestosTodas:[],personal:[],
    prestamos:[],presupuestos:[],detrDepositos:[],
    compromisos:[],ajustesMes:{}
};
var chartFlujo=null;

const CAT_LABELS={SCOTIABANK:'Scotiabank',INTERBANK:'Interbank',COSTOS_DIRECTOS:'Costos Directos',
    GASTOS_DE_PERSONAL:'Personal',LOGISTICA_Y_CAMPO:'Logística',FINANCIERO_CAJA:'Financiero',
    GASTOS_ADMINISTRATIVOS_Y_FIJOS:'Administrativo',GASTOS_INDIRECTOS:'Indirectos',AHORRO:'Ahorro'};
const CAT_COLORS={SCOTIABANK:'#c8102e',INTERBANK:'#0033a0',COSTOS_DIRECTOS:'#1e40af',
    GASTOS_DE_PERSONAL:'#9333ea',LOGISTICA_Y_CAMPO:'#f59e0b',FINANCIERO_CAJA:'#dc2626',
    GASTOS_ADMINISTRATIVOS_Y_FIJOS:'#475569',GASTOS_INDIRECTOS:'#ea580c',AHORRO:'#059669'};
const MESES=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const MESES_LARGO=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// ── PERÍODO SELECCIONADO (para comparaciones mes a mes) ────────
var PERIODO={actual:null, anterior:null};

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
    var hoyD=new Date();
    document.getElementById('fechaHoy').textContent=
        p2(hoyD.getDate())+' '+['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][hoyD.getMonth()]+' '+hoyD.getFullYear();

    PERIODO.actual=mesActualStr();
    PERIODO.anterior=sumarMes(PERIODO.actual,-1);
    actualizarInfoPeriodo();

    iniciarListeners();
});

// ── HELPERS ──────────────────────────────────────────────────
function p2(n){return n<10?'0'+n:String(n);}
function fmt(n,dec){dec=dec!==undefined?dec:2;return parseFloat(n||0).toLocaleString('es-PE',{minimumFractionDigits:dec,maximumFractionDigits:dec});}
function fmtK(n){var v=parseFloat(n||0);if(Math.abs(v)>=1000)return 'S/ '+fmt(v/1000,1)+'k';return 'S/ '+fmt(v,0);}
function mesKey(fecha){return String(fecha||'').substring(0,7);}
function diasHasta(v){if(!v||v==='-')return null;var s=String(v).trim().substring(0,10);if(!s.match(/^\d{4}-\d{2}-\d{2}/))return null;var d=new Date(s+'T00:00:00'),h=new Date();h.setHours(0,0,0,0);return Math.round((d-h)/(1000*60*60*24));}
function mesActualStr(){var h=new Date();return h.getFullYear()+'-'+p2(h.getMonth()+1);}
function sumarMes(mesStr,n){var p=mesStr.split('-');var y=parseInt(p[0]),m=parseInt(p[1])-1+n;var d=new Date(y,m,1);return d.getFullYear()+'-'+p2(d.getMonth()+1);}
function labelMes(mesStr){if(!mesStr)return '—';var p=mesStr.split('-');return MESES_LARGO[parseInt(p[1])-1]+' '+p[0];}
function pctCambio(actual,anterior){
    if(!anterior)return actual?{txt:'nuevo',cls:'trend-up'}:{txt:'0%',cls:'trend-eq'};
    var pct=((actual-anterior)/Math.abs(anterior))*100;
    if(Math.abs(pct)<1)return {txt:'≈ igual',cls:'trend-eq'};
    return {txt:(pct>0?'▲ ':'▼ ')+Math.abs(Math.round(pct))+'%', cls:pct>0?'trend-up':'trend-dn'};
}

// ── SELECTOR DE PERÍODO ─────────────────────────────────────────
function cambiarModoPeriodo(){
    var modo=document.getElementById('periodoModo').value;
    document.getElementById('periodoCustom').style.display = modo==='personalizado' ? 'inline-block' : 'none';
    document.getElementById('compararWrap').style.display  = modo==='comparar' ? 'inline-flex' : 'none';

    if(modo==='actual'){
        PERIODO.actual=mesActualStr(); PERIODO.anterior=sumarMes(PERIODO.actual,-1);
        actualizarInfoPeriodo(); renderTodo();
    }else if(modo==='anterior'){
        PERIODO.actual=sumarMes(mesActualStr(),-1); PERIODO.anterior=sumarMes(PERIODO.actual,-1);
        actualizarInfoPeriodo(); renderTodo();
    }else if(modo==='personalizado'){
        document.getElementById('periodoCustom').value=PERIODO.actual;
    }else if(modo==='comparar'){
        document.getElementById('periodoCompararA').value=PERIODO.anterior;
        document.getElementById('periodoCompararB').value=PERIODO.actual;
    }
}
window.cambiarModoPeriodo=cambiarModoPeriodo;

function recalcularPeriodo(){
    var modo=document.getElementById('periodoModo').value;
    if(modo==='personalizado'){
        var v=document.getElementById('periodoCustom').value;
        if(!v)return;
        PERIODO.actual=v; PERIODO.anterior=sumarMes(v,-1);
    }else if(modo==='comparar'){
        var a=document.getElementById('periodoCompararA').value;
        var b=document.getElementById('periodoCompararB').value;
        if(!a||!b)return;
        PERIODO.anterior=a; PERIODO.actual=b;
    }
    actualizarInfoPeriodo();
    renderTodo();
}
window.recalcularPeriodo=recalcularPeriodo;

function actualizarInfoPeriodo(){
    document.getElementById('periodoInfo').innerHTML=
        'Comparando <strong>'+labelMes(PERIODO.actual)+'</strong> vs <strong>'+labelMes(PERIODO.anterior)+'</strong>';
}

// Re-renderiza todo lo que depende del período seleccionado
function renderTodo(){
    renderAtencionYKPIs();
    generarComentarios();
}

// ── LISTENERS ────────────────────────────────────────────────
function iniciarListeners(){
    // Caja diaria
    onSnapshot(query(collection(db,'caja_diaria'),orderBy('fecha','asc')),function(snap){
        G.caja=snap.docs.map(function(d){return d.data();});
        renderGraficos(); renderAtencionYKPIs(); generarComentarios();
    });
    // Facturas
    onSnapshot(collection(db,'facturas'),function(snap){
        G.facturas=snap.docs.map(function(d){var r=d.data();r._id=d.id;return r;});
        renderAtencionYKPIs(); generarComentarios(); renderChartFacturas(); renderChartDetr();
        if(typeof renderGaugeCobertura==='function') renderGaugeCobertura();
    });
    // Depósitos de detracción (1 doc por factura, solo la fecha de depósito —
    // el resto de datos de la factura se leen de G.facturas, sin duplicar)
    onSnapshot(collection(db,'detracciones_depositos'),function(snap){
        G.detrDepositos=snap.docs.map(function(d){var r=d.data();r._id=d.id;return r;});
        renderChartDetr();
    });
    // Cotizaciones
    onSnapshot(collection(db,'cotizaciones'),function(snap){
        G.cotizaciones=snap.docs.map(function(d){var r=d.data(); r._pid=d.id; return r;});
        renderModuloCot(); generarComentarios(); renderAtencionYKPIs();
    });
    // Certificados
    onSnapshot(collection(db,'certificados'),function(snap){
        G.certificados=snap.docs.map(function(d){var r=d.data(); r._pid=d.id; return r;});
        renderModuloCert(); generarComentarios(); renderAtencionYKPIs();
    });
    // Impuestos — TODAS las declaraciones (para poder comparar por período,
    // ya no solo las pendientes)
    onSnapshot(collection(db,'impuestos_declaraciones'),function(snap){
        G.impuestosTodas=snap.docs.map(function(d){return d.data();});
        G.impuestos=G.impuestosTodas.filter(function(r){return r.estado==='pendiente';});
        renderAtencionYKPIs(); generarComentarios();
    });
    // Personal
    onSnapshot(collection(db,'personal'),function(snap){
        G.personal=snap.docs.map(function(d){return d.data();});
        generarComentarios();
    });
    // Préstamos — ahora en vivo desde Firestore (antes estaba hardcodeado)
    onSnapshot(collection(db,'prestamos'),function(snap){
        G.prestamos=snap.docs.map(function(d){return d.data();});
        renderAtencionYKPIs(); generarComentarios();
        if(typeof renderGaugeCobertura==='function') renderGaugeCobertura();
    });
    // Presupuestos (rentabilidad de proyectos)
    onSnapshot(collection(db,'presupuestos'),function(snap){
        G.presupuestos=snap.docs.map(function(d){return d.data();});
        renderAtencionYKPIs();
    });
    // Compromisos (Vencimientos → pestaña Compromisos) — para el velocímetro
    onSnapshot(collection(db,'compromisos'),function(snap){
        G.compromisos=snap.docs.map(function(d){var r=d.data();r._id=d.id;return r;});
        if(typeof renderGaugeCobertura==='function') renderGaugeCobertura();
    });
    onSnapshot(collection(db,'compromisos_montos_mes'),function(snap){
        var mapa={};
        snap.forEach(function(d){ mapa[d.id]=d.data(); });
        G.ajustesMes=mapa;
        if(typeof renderGaugeCobertura==='function') renderGaugeCobertura();
    });
}

// ── MÓDULO COTIZACIONES ───────────────────────────────────────
function renderModuloCot(){
    var pend=G.cotizaciones.filter(function(r){return (r.estado||'').toLowerCase()==='pendiente';});
    var totalPend=pend.reduce(function(s,r){return s+(parseFloat(r.subtotal)||0);},0);
    document.getElementById('kCotPendiente').textContent=pend.length;
    document.getElementById('kCotPendienteSub').textContent='S/ '+fmt(totalPend,0)+' por facturar';
    renderChartProduccion();
}

// ── MÓDULO CERTIFICADOS ───────────────────────────────────────
function renderModuloCert(){
    renderChartProduccion();
}

// ── GRÁFICOS ─────────────────────────────────────────────────
function renderGraficos(){
    var meses={};
    G.caja.forEach(function(r){
        var mk=mesKey(r.fecha);
        if(!meses[mk])meses[mk]={ing:0,eg:0};
        var m=parseFloat(r.monto)||0;
        if(r.tipo==='ingreso')meses[mk].ing+=m;else meses[mk].eg+=m;
    });
    var keys=Object.keys(meses).sort();
    var labels=keys.map(function(k){var p=k.split('-');return MESES[parseInt(p[1])-1]+' '+p[0];});
    var ingData=keys.map(function(k){return meses[k].ing;});
    var egData =keys.map(function(k){return meses[k].eg;});
    var saldoData=[];var acum=0;
    keys.forEach(function(k){acum+=meses[k].ing-meses[k].eg;saldoData.push(acum);});

    // Chart flujo
    if(chartFlujo)chartFlujo.destroy();
    chartFlujo=new Chart(document.getElementById('chartFlujo'),{
        type:'bar',
        data:{labels:labels,datasets:[
            {label:'Ingresos',data:ingData,backgroundColor:'rgba(22,163,74,.7)',borderRadius:5,borderSkipped:false,order:2},
            {label:'Egresos', data:egData, backgroundColor:'rgba(220,38,38,.65)',borderRadius:5,borderSkipped:false,order:2},
            {label:'Saldo Neto',data:saldoData,type:'line',borderColor:'#1e40af',backgroundColor:'rgba(30,64,175,.08)',
             borderWidth:2.5,pointBackgroundColor:'#1e40af',pointRadius:3,tension:0.3,fill:true,order:1,yAxisID:'y1'}
        ]},
        options:{responsive:true,maintainAspectRatio:false,
            plugins:{legend:{labels:{boxWidth:10,font:{size:10,family:'Verdana'}}},
                tooltip:{callbacks:{label:function(c){return ' '+c.dataset.label+': S/ '+fmt(c.parsed.y||0,0);}}}},
            scales:{
                x:{grid:{display:false},ticks:{font:{size:9,family:'Verdana'}}},
                y:{grid:{color:'rgba(0,0,0,.04)'},ticks:{font:{size:9,family:'Verdana'},callback:function(v){return 'S/'+Math.round(v/1000)+'k';}}},
                y1:{position:'right',grid:{display:false},ticks:{font:{size:9,family:'Verdana'},callback:function(v){return 'S/'+Math.round(v/1000)+'k';}}}
            }}
    });

    // Los gráficos de Utilidad, Rentabilidad e Impuestos por período
    // reemplazan al antiguo gráfico de "Distribución de Egresos" (dona),
    // que no comparaba mes a mes y quedó fuera del nuevo diseño.
    renderChartDetr();
    renderGaugeCobertura();
    renderTopGastos();
    renderChartFacturas();
}

// Devuelve, para cada proyecto de `presupuestos` que ya cerró (tiene fechaFin),
// {mesKey, subtotal, costos, utilidad, rentPct}
function proyectosCerrados(){
    var out=[];
    G.presupuestos.forEach(function(p){
        if(!p.fechaFin) return;
        var costos=0;
        (p.categorias||[]).forEach(function(c){(c.lineas||[]).forEach(function(l){costos+=parseFloat(l.monto)||0;});});
        var origLista = p.origen==='cotizacion' ? G.cotizaciones : G.certificados;
        var orig=origLista.find(function(r){return r._pid===p.proyectoId;});
        var subtotal=orig?parseFloat(orig.subtotal)||0:0;
        if(subtotal<=0 && costos<=0) return; // dato incompleto, se ignora
        out.push({mk:mesKey(p.fechaFin), subtotal:subtotal, costos:costos, utilidad:subtotal-costos,
            rentPct: subtotal>0?((subtotal-costos)/subtotal*100):0});
    });
    return out;
}
// Últimos N meses (incluye el actual), en orden cronológico
function ultimosMeses(n){
    var arr=[]; var m=mesActualStr();
    for(var i=n-1;i>=0;i--) arr.push(sumarMes(m,-i));
    return arr;
}

var chartDetr=null, chartFacturas=null, chartProduccion=null;

// Ingresos mensuales por Detracción: suma el monto de "detraccion" de las
// facturas cuyo DEPÓSITO cayó en cada mes (no la fecha de emisión — lo que
// importa aquí es cuándo entró el dinero). Se excluyen las Anuladas, igual
// que en el módulo de Impuestos.
function ingresoDetraccionDelMes(mk){
    var mapaFacturas={};
    G.facturas.forEach(function(f){ mapaFacturas[f._id]=f; });
    var total=0;
    G.detrDepositos.forEach(function(dep){
        if(!dep.fechaDeposito || mesKey(dep.fechaDeposito)!==mk) return;
        var f=mapaFacturas[dep._id];
        if(!f || (f.estado||'').toLowerCase()==='anulada') return;
        total+=parseFloat(f.detraccion)||0;
    });
    return total;
}

// Regresión lineal simple (mínimos cuadrados) para la línea de tendencia:
// una recta que resume hacia dónde va la serie, no solo repite los datos.
function calcularTendencia(valores){
    var n=valores.length;
    var sumX=0,sumY=0,sumXY=0,sumXX=0;
    valores.forEach(function(y,x){ sumX+=x; sumY+=y; sumXY+=x*y; sumXX+=x*x; });
    var denom=(n*sumXX - sumX*sumX);
    var m = denom!==0 ? (n*sumXY - sumX*sumY)/denom : 0;
    var b = (sumY - m*sumX)/n;
    return valores.map(function(_,x){ return m*x+b; });
}

function renderChartDetr(){
    var meses=ultimosMeses(8);
    var data=meses.map(function(mk){ return ingresoDetraccionDelMes(mk); });
    var tendencia=calcularTendencia(data);
    var labels=meses.map(function(k){var p=k.split('-');return MESES[parseInt(p[1])-1]+' '+p[0].substring(2);});

    // Subtítulo dinámico: si la tendencia sube o baja de un extremo a otro
    var subEl=document.getElementById('chartDetrSub');
    if(subEl && tendencia.length>1){
        var delta=tendencia[tendencia.length-1]-tendencia[0];
        var dir = Math.abs(delta)<1 ? 'estable' : (delta>0?'▲ en aumento':'▼ en baja');
        subEl.innerHTML='Depósitos recibidos por mes · Tendencia: <b style="color:'+(delta>=0?'#16a34a':'#dc2626')+'">'+dir+'</b>';
    }

    if(chartDetr)chartDetr.destroy();
    chartDetr=new Chart(document.getElementById('chartDetr'),{
        type:'bar',
        data:{labels:labels,datasets:[
            {type:'bar',label:'Depositado',data:data,
                backgroundColor:'rgba(249,115,22,.75)',borderRadius:5,borderSkipped:false,order:2},
            {type:'line',label:'Tendencia',data:tendencia,
                borderColor:'#1a3a6b',borderWidth:2,borderDash:[6,4],
                pointRadius:0,tension:0,fill:false,order:1}
        ]},
        options:{responsive:true,maintainAspectRatio:false,
            plugins:{legend:{display:true,position:'bottom',labels:{boxWidth:10,font:{size:9,family:'Verdana'}}},
                tooltip:{callbacks:{label:function(c){return ' '+c.dataset.label+': S/ '+fmt(c.parsed.y||0,0);}}}},
            scales:{
                x:{grid:{display:false},ticks:{font:{size:9,family:'Verdana'}}},
                y:{grid:{color:'rgba(0,0,0,.04)'},ticks:{font:{size:9,family:'Verdana'},callback:function(v){return 'S/'+Math.round(v/1000)+'k';}}}
            }}
    });
}

// Velocímetro de Cobertura del Próximo Mes — misma fórmula que el
// Presupuesto Mensual de Vencimientos: (Caja + Facturas por cobrar) contra
// (Compromisos + Cuotas de préstamos), siempre para el mes siguiente.
function compromisoAplicaAlMesDash(c, mk){
    if(c.activo===false) return false;
    if(!c.duracion || c.duracion.tipo!=='plazo') return true;
    if(!c.duracion.fechaInicio || !c.duracion.meses) return false;
    var pi=c.duracion.fechaInicio.split('-'), pm=mk.split('-');
    var idx=(parseInt(pm[0],10)-parseInt(pi[0],10))*12 + (parseInt(pm[1],10)-parseInt(pi[1],10));
    return idx>=0 && idx<c.duracion.meses;
}
function montoCompromisoDelMesDash(c, mk){
    var ajuste=G.ajustesMes[c._id+'_'+mk];
    return (ajuste && ajuste.montoReal!=null && ajuste.montoReal!=='') ? parseFloat(ajuste.montoReal)||0 : (parseFloat(c.montoEstimado)||0);
}

function renderGaugeCobertura(){
    var mkProx=sumarMes(mesActualStr(),1);

    var saldoCaja=0;
    G.caja.forEach(function(r){
        if(String(r.fecha||'')<(mkProx+'-01')){
            var m=parseFloat(r.monto)||0;
            saldoCaja += (r.tipo==='ingreso') ? m : -m;
        }
    });

    var facturasDelMes=G.facturas.filter(function(r){
        return (r.estado==='Emitida'||r.estado==='Vencida') && mesKey(r.fechaVenc)===mkProx;
    });
    var totalFacturas=facturasDelMes.reduce(function(s,r){
        var neto=(r.ingresoNeto!=null&&r.ingresoNeto!=='')?parseFloat(r.ingresoNeto):parseFloat(r.total);
        return s+(neto||0);
    },0);

    var compromisosDelMes=(G.compromisos||[]).filter(function(c){return compromisoAplicaAlMesDash(c,mkProx);});
    var totalCompromisos=compromisosDelMes.reduce(function(s,c){return s+montoCompromisoDelMesDash(c,mkProx);},0);

    var totalCuotas=0;
    G.prestamos.forEach(function(p){
        (p.cuotas||[]).forEach(function(c){
            if(c.estado==='Pagado') return;
            if(mesKey(c.fecha)!==mkProx) return;
            totalCuotas+=parseFloat(c.cuota||c.apagar||0)||0;
        });
    });

    var disponible=saldoCaja+totalFacturas;
    var obligaciones=totalCompromisos+totalCuotas;
    var pct=obligaciones>0 ? (disponible/obligaciones*100) : 100;
    var pctAguja=Math.max(0,Math.min(pct,150)); // tope visual en 150% para que la aguja no se pase de la escala

    // La escala del velocímetro va de 0° (izquierda, 0%) a 180° (derecha, 150%+)
    var angulo=-90+(pctAguja/150*180);
    var aguja=document.getElementById('gaugeAguja');
    if(aguja) aguja.style.transform='rotate('+angulo+'deg)';

    document.getElementById('gaugePct').textContent=pct.toFixed(0)+'%';
    var label=document.getElementById('gaugeLabel');
    if(pct>=100){ label.textContent='✅ Cubierto, con margen'; label.style.color='#16a34a'; }
    else if(pct>=80){ label.textContent='⚠️ Cubre, pero ajustado'; label.style.color='#d97706'; }
    else{ label.textContent='🔴 No cubre — falta dinero'; label.style.color='#dc2626'; }

    document.getElementById('gaugeDetalle').innerHTML=
        'Disponible: S/ '+fmt(disponible,0)+' · Obligaciones: S/ '+fmt(obligaciones,0);
    document.getElementById('gaugeSub').textContent='Proyección de '+labelMes(mkProx)+' · Caja + Facturas vs. Compromisos + Cuotas';
}

// Top Categorías de Gasto (mes actual) — agrupa los egresos de Caja Diaria
// por SUBCATEGORÍA (texto libre: "Vivienda", "Alimentación Mensual", etc.),
// que es el detalle real del gasto, no la categoría contable general.
var PALETA_GASTOS=['#1a3a6b','#0d9488','#f97316','#9333ea','#dc2626','#0891b2','#65a30d','#c026d3','#ea580c','#4338ca'];
function renderTopGastos(){
    var mesActual=mesActualStr();
    var mapa={};
    G.caja.forEach(function(r){
        if(r.tipo!=='egreso') return;
        if(mesKey(r.fecha)!==mesActual) return;
        var etiqueta=(r.subcategoria&&r.subcategoria!=='-'&&r.subcategoria!=='—') ? r.subcategoria : (CAT_LABELS[r.categoria]||r.categoria||'Otro');
        mapa[etiqueta]=(mapa[etiqueta]||0)+(parseFloat(r.monto)||0);
    });
    var lista=Object.keys(mapa).map(function(k){return {nombre:k,monto:mapa[k]};})
        .sort(function(a,b){return b.monto-a.monto;})
        .slice(0,5);

    var subEl=document.getElementById('topGastoSub');
    var cont=document.getElementById('topGastoList');
    if(subEl) subEl.textContent=labelMes(mesActual)+' · Datos reales de Caja Diaria';

    if(!lista.length){
        cont.innerHTML='<div class="top-gasto-empty">Sin egresos registrados este mes todavía.</div>';
        return;
    }
    var max=lista[0].monto;
    var html='';
    lista.forEach(function(item,i){
        var pct=max>0?Math.max((item.monto/max*100),6):0;
        var color=PALETA_GASTOS[i%PALETA_GASTOS.length];
        html+='<div class="top-gasto-row">'+
            '<div class="top-gasto-label" title="'+item.nombre+'">'+item.nombre+'</div>'+
            '<div class="top-gasto-barbg"><div class="top-gasto-bar" style="width:'+pct+'%;background:'+color+'"></div></div>'+
            '<div class="top-gasto-amt">S/ '+fmt(item.monto,0)+'</div>'+
        '</div>';
    });
    cont.innerHTML=html;
}

// Facturación mensual por estado (Emitida/Cobrada/Anulada/Vencida) + línea
// de total facturado (todo menos Anuladas) para comparar mes a mes de un
// vistazo cuál fue el mes de mayor facturación y por cuánto.
function totalFacturasDelMes(mk, estado){
    return G.facturas.filter(function(r){return mesKey(r.fechaEmision)===mk && r.estado===estado;})
        .reduce(function(s,r){
            // Usamos Ingreso Neto (total menos detracción), no el Sub Total + IGV —
            // es lo que de verdad entra a la cuenta.
            var neto=(r.ingresoNeto!=null && r.ingresoNeto!=='') ? parseFloat(r.ingresoNeto) : parseFloat(r.total);
            return s+(neto||0);
        },0);
}
function renderChartFacturas(){
    var meses=ultimosMeses(8);
    var emitida = meses.map(function(mk){return totalFacturasDelMes(mk,'Emitida');});
    var cobrada = meses.map(function(mk){return totalFacturasDelMes(mk,'Cobrada');});
    var anulada = meses.map(function(mk){return totalFacturasDelMes(mk,'Anulada');});
    var vencida = meses.map(function(mk){return totalFacturasDelMes(mk,'Vencida');});
    var totalFacturado = meses.map(function(mk,i){return emitida[i]+cobrada[i]+vencida[i];}); // sin Anuladas

    // Mes de mayor facturación, para resaltarlo en el subtítulo
    var maxIdx=0;
    totalFacturado.forEach(function(v,i){ if(v>totalFacturado[maxIdx]) maxIdx=i; });
    var labels=meses.map(function(k){var p=k.split('-');return MESES[parseInt(p[1])-1]+' '+p[0].substring(2);});
    if(totalFacturado[maxIdx]>0){
        document.querySelector('#chartFacturas').closest('.chart-card').querySelector('.chart-sub').innerHTML=
            'Emitida, Cobrada, Anulada y Vencida por mes (Ingreso Neto) · <b style="color:var(--naranja)">Mes de mayor facturación (neto): '+labels[maxIdx]+' (S/ '+fmt(totalFacturado[maxIdx],0)+')</b>';
    }

    if(chartFacturas)chartFacturas.destroy();
    chartFacturas=new Chart(document.getElementById('chartFacturas'),{
        type:'bar',
        data:{labels:labels,datasets:[
            {type:'bar',label:'Emitida',data:emitida,backgroundColor:'rgba(30,64,175,.75)',borderRadius:4,borderSkipped:false,order:2},
            {type:'bar',label:'Cobrada',data:cobrada,backgroundColor:'rgba(22,163,74,.75)',borderRadius:4,borderSkipped:false,order:2},
            {type:'bar',label:'Anulada',data:anulada,backgroundColor:'rgba(147,51,234,.65)',borderRadius:4,borderSkipped:false,order:2},
            {type:'bar',label:'Vencida',data:vencida,backgroundColor:'rgba(220,38,38,.75)',borderRadius:4,borderSkipped:false,order:2},
            {type:'line',label:'Ingreso Neto Total (sin Anuladas)',data:totalFacturado,
                borderColor:'#f97316',backgroundColor:'#f97316',borderWidth:2.5,
                pointBackgroundColor:'#f97316',pointRadius:4,pointHoverRadius:6,tension:0.25,fill:false,order:1}
        ]},
        options:{responsive:true,maintainAspectRatio:false,
            plugins:{legend:{position:'bottom',labels:{boxWidth:10,font:{size:9,family:'Verdana'}}},
                tooltip:{callbacks:{label:function(c){return ' '+c.dataset.label+': S/ '+fmt(c.parsed.y||0,0);}}}},
            scales:{
                x:{grid:{display:false},ticks:{font:{size:9,family:'Verdana'}}},
                y:{grid:{color:'rgba(0,0,0,.04)'},ticks:{font:{size:9,family:'Verdana'},callback:function(v){return 'S/'+Math.round(v/1000)+'k';}}}
            }}
    });
}

// Cantidad mensual de cotizaciones y certificados registrados (todas,
// sin filtrar por estado) según el mes de su fecha.
function delMes(lista, mk){
    return lista.filter(function(r){ return mesKey(r.fecha)===mk; });
}
function renderChartProduccion(){
    var meses=ultimosMeses(8);
    var cotCant=meses.map(function(mk){return delMes(G.cotizaciones,mk).length;});
    var certCant=meses.map(function(mk){return delMes(G.certificados,mk).length;});
    var labels=meses.map(function(k){var p=k.split('-');return MESES[parseInt(p[1])-1]+' '+p[0].substring(2);});

    var canvas=document.getElementById('chartProduccion');
    if(!canvas) return;
    if(chartProduccion)chartProduccion.destroy();
    chartProduccion=new Chart(canvas,{
        type:'bar',
        data:{labels:labels,datasets:[
            {type:'bar',label:'Cotizaciones',data:cotCant,backgroundColor:'rgba(30,64,175,.75)',borderRadius:4,borderSkipped:false,order:2},
            {type:'bar',label:'Certificados',data:certCant,backgroundColor:'rgba(22,163,74,.75)',borderRadius:4,borderSkipped:false,order:2},
            {type:'line',label:'Tendencia Cotizaciones',data:cotCant,
                borderColor:'#f97316',backgroundColor:'#f97316',borderWidth:2.5,
                pointBackgroundColor:'#f97316',pointRadius:4,pointHoverRadius:6,tension:0.25,fill:false,order:1},
            {type:'line',label:'Tendencia Certificados',data:certCant,
                borderColor:'#9333ea',backgroundColor:'#9333ea',borderWidth:2.5,
                pointBackgroundColor:'#9333ea',pointRadius:4,pointHoverRadius:6,tension:0.25,fill:false,order:1}
        ]},
        options:{responsive:true,maintainAspectRatio:false,
            plugins:{legend:{position:'bottom',labels:{boxWidth:10,font:{size:9,family:'Verdana'}}},
                tooltip:{callbacks:{label:function(c){return ' '+c.dataset.label+': '+(c.parsed.y||0);}}}},
            scales:{
                x:{grid:{display:false},ticks:{font:{size:9,family:'Verdana'}}},
                y:{beginAtZero:true,grid:{color:'rgba(0,0,0,.04)'},ticks:{font:{size:9,family:'Verdana'},precision:0}}
            }}
    });
}

// Utilidad real (de Presupuesto) de los proyectos cuyo cierre (fechaFin) cae
// en el mes `mk`. Función global: la usan tanto los KPIs como los
// comentarios de IA, para no duplicar la lógica.
function utilidadDelMes(mk){
    var u=0;
    G.presupuestos.forEach(function(p){
        if(!p.fechaFin || mesKey(p.fechaFin)!==mk) return;
        var costos=0;
        (p.categorias||[]).forEach(function(c){(c.lineas||[]).forEach(function(l){costos+=parseFloat(l.monto)||0;});});
        var origLista = p.origen==='cotizacion' ? G.cotizaciones : G.certificados;
        var orig=origLista.find(function(r){return r._pid===p.proyectoId;});
        var subtotal=orig?parseFloat(orig.subtotal)||0:0;
        u+=(subtotal-costos);
    });
    return u;
}

// ── PANEL UNIFICADO "NECESITA TU ATENCIÓN" + LOS 5 KPIs ─────────
// Reemplaza a las antiguas renderAlertas()/renderCuotasMes()/renderKPIsCaja().
// Todo lo que depende del período seleccionado se calcula aquí.
function renderAtencionYKPIs(){
    if(!PERIODO.actual) return;
    var actual=PERIODO.actual, anterior=PERIODO.anterior;

    // ---------- 1) SALDO DE CAJA (stock real + variación neta del período) ----------
    var ing=0,eg=0, ingP=0,egP=0;
    G.caja.forEach(function(r){
        var m=parseFloat(r.monto)||0, mk=mesKey(r.fecha);
        if(r.tipo==='ingreso') ing+=m; else eg+=m;
        if(mk===actual){ if(r.tipo==='ingreso') ingP+=m; else egP+=m; }
    });
    var ingAnt=0,egAnt=0;
    G.caja.forEach(function(r){var mk=mesKey(r.fecha); if(mk===anterior){var m=parseFloat(r.monto)||0; if(r.tipo==='ingreso')ingAnt+=m; else egAnt+=m;}});
    var saldoCaja=ing-eg;
    var netoActual=ingP-egP, netoAnterior=ingAnt-egAnt;
    var elSaldo=document.getElementById('kSaldoCaja');
    elSaldo.textContent='S/ '+fmt(saldoCaja,0);
    elSaldo.style.color=saldoCaja<500?'var(--rojo)':saldoCaja<2000?'var(--amarillo)':'var(--verde)';
    var dCaja=pctCambio(netoActual,netoAnterior);
    document.getElementById('kSaldoCajaSub').innerHTML='Movimiento neto '+labelMes(actual)+': <b>S/ '+fmt(netoActual,0)+'</b> <span class="kpi-trend-inline '+dCaja.cls+'">'+dCaja.txt+'</span>';

    // ---------- 2) UTILIDAD DE PROYECTOS (Presupuesto, por mes de cierre) ----------
    var utilActual=utilidadDelMes(actual), utilAnt=utilidadDelMes(anterior);
    document.getElementById('kUtilidad').textContent='S/ '+fmt(utilActual,0);
    var dUtil=pctCambio(utilActual,utilAnt);
    document.getElementById('kUtilidadSub').innerHTML=labelMes(actual)+' <span class="kpi-trend-inline '+dUtil.cls+'">'+dUtil.txt+'</span> vs '+labelMes(anterior);

    // ---------- 3) FACTURAS POR COBRAR (stock real + facturado en el período) ----------
    var pendientesTotal=G.facturas.filter(function(r){return r.estado==='Emitida'||r.estado==='Vencida';});
    var totalPendiente=pendientesTotal.reduce(function(s,r){return s+(parseFloat(r.total)||0);},0);
    document.getElementById('kFactPendiente').textContent='S/ '+fmt(totalPendiente,0);
    function facturadoDelMes(mk){
        return G.facturas.filter(function(r){return mesKey(r.fechaEmision)===mk;}).reduce(function(s,r){return s+(parseFloat(r.total)||0);},0);
    }
    var factActual=facturadoDelMes(actual), factAnt=facturadoDelMes(anterior);
    var dFact=pctCambio(factActual,factAnt);
    document.getElementById('kFactPendienteSub').innerHTML=pendientesTotal.length+' pendientes · Facturado '+labelMes(actual)+': S/'+fmt(factActual,0)+' <span class="kpi-trend-inline '+dFact.cls+'">'+dFact.txt+'</span>';

    // ---------- 4) DEUDA FINANCIERA (ahora en vivo desde Firestore) ----------
    var deudaTotal=0, cuotasActual=0, cuotasAnt=0;
    G.prestamos.forEach(function(p){
        (p.cuotas||[]).forEach(function(c){
            var monto=parseFloat(c.cuota||c.apagar||0)||0;
            if(c.estado!=='Pagado') deudaTotal+=monto;
            var mk=mesKey(c.fecha);
            if(mk===actual) cuotasActual+=monto;
            if(mk===anterior) cuotasAnt+=monto;
        });
    });
    document.getElementById('kDeuda').textContent='S/ '+fmt(deudaTotal,0);
    var dDeuda=pctCambio(cuotasActual,cuotasAnt);
    document.getElementById('kDeudaSub').innerHTML='Cuotas '+labelMes(actual)+': S/'+fmt(cuotasActual,0)+' <span class="kpi-trend-inline '+dDeuda.cls+'">'+dDeuda.txt+'</span>';

    // ---------- 5) IMPUESTOS POR PAGAR (stock pendiente actual + declarado en el período) ----------
    var impPendienteTotal=G.impuestos.reduce(function(s,r){return s+(parseFloat(r.totalPagar)||0);},0);
    document.getElementById('kImpuestos').textContent='S/ '+fmt(impPendienteTotal,0);
    function declaradoDelPeriodo(mk){
        return G.impuestosTodas.filter(function(r){return r.periodo===mk;}).reduce(function(s,r){return s+(parseFloat(r.totalPagar)||0);},0);
    }
    var impActual=declaradoDelPeriodo(actual), impAnt=declaradoDelPeriodo(anterior);
    var dImp=pctCambio(impActual,impAnt);
    document.getElementById('kImpuestosSub').innerHTML=G.impuestos.length+' pendientes · Declarado '+labelMes(actual)+': S/'+fmt(impActual,0)+' <span class="kpi-trend-inline '+dImp.cls+'">'+dImp.txt+'</span>';

    // ---------- PANEL "NECESITA TU ATENCIÓN" (todo lo urgente, unificado) ----------
    var items=[];
    G.facturas.filter(function(r){return r.estado==='Vencida';}).forEach(function(r){
        var dias=diasHasta(r.fechaVenc);
        items.push({nivel:'r',txt:'🧾 '+(r.serie||'')+'-'+(r.numFact||'')+' — '+(r.cliente||r.razonSocial||''),
            meta:'Factura vencida hace '+Math.abs(dias||0)+' días',amt:'S/ '+fmt(r.total||0,0),ord:-999+(dias||0)});
    });
    G.facturas.filter(function(r){return r.estado==='Emitida';}).forEach(function(r){
        var dias=diasHasta(r.fechaVenc);
        if(dias!==null&&dias<=7){
            items.push({nivel:'a',txt:'🧾 '+(r.serie||'')+'-'+(r.numFact||'')+' — '+(r.cliente||r.razonSocial||''),
                meta:'Factura vence en '+dias+' día'+(dias!==1?'s':''),amt:'S/ '+fmt(r.total||0,0),ord:dias});
        }
    });
    G.impuestos.forEach(function(r){
        var dias=diasHasta(r.fechaPres);
        items.push({nivel: (dias!==null&&dias<=3)?'r':'a', txt:'🏛️ Declaración '+r.periodo,
            meta: dias!==null ? ('Vence en '+dias+' día'+(dias!==1?'s':'')) : 'SUNAT pendiente de pago',
            amt:'S/ '+fmt(r.totalPagar||0,0), ord:-500+(dias||0)});
    });
    G.prestamos.forEach(function(p){
        (p.cuotas||[]).forEach(function(c){
            if(c.estado==='Pagado') return;
            var dias=diasHasta(c.fecha);
            if(dias!==null && dias<=7){
                items.push({nivel: dias<0?'r':'a', txt:'💳 Cuota '+(p.entidad||p.nombre||''),
                    meta: dias<0?('Cuota vencida hace '+Math.abs(dias)+' días'):('Cuota vence en '+dias+' día'+(dias!==1?'s':'')),
                    amt:'S/ '+fmt(c.cuota||c.apagar||0,2), ord:-700+dias});
            }
        });
    });
    G.presupuestos.forEach(function(p){
        if(!p.fechaFin) return;
        var dias=diasHasta(p.fechaFin);
        if(dias===null || dias<-30) return; // solo proyectos cerrados recientemente
        var costos=0;
        (p.categorias||[]).forEach(function(c){(c.lineas||[]).forEach(function(l){costos+=parseFloat(l.monto)||0;});});
        var origLista = p.origen==='cotizacion' ? G.cotizaciones : G.certificados;
        var orig=origLista.find(function(r){return r._pid===p.proyectoId;});
        var subtotal=orig?parseFloat(orig.subtotal)||0:0;
        var utilidad=subtotal-costos;
        if(subtotal>0 && utilidad<0){
            items.push({nivel:'r', txt:'📈 Proyecto con pérdida — '+(orig?orig.cliente:'Proyecto'),
                meta:'Rentabilidad negativa al cierre', amt:'S/ '+fmt(utilidad,0), ord:-600});
        }
    });
    if(saldoCaja<500){
        items.push({nivel:'r',txt:'💚 Saldo de Caja Bajo', meta:'S/ '+fmt(saldoCaja,0)+' disponible', amt:'⚠️ Atención', ord:-1000});
    }

    items.sort(function(a,b){return a.ord-b.ord;});
    var grid=document.getElementById('atencionGrid');
    var countEl=document.getElementById('atencionCount');
    var cardEl=document.getElementById('atencionCard');
    if(!items.length){
        grid.innerHTML='<div class="no-alerts" style="grid-column:1/-1">✅ Todo en orden — sin pendientes urgentes en este momento</div>';
        countEl.textContent='0'; countEl.classList.add('ok');
        cardEl.classList.remove('tiene-criticas');
        return;
    }
    countEl.textContent=items.length; countEl.classList.remove('ok');
    cardEl.classList.toggle('tiene-criticas', items.some(function(i){return i.nivel==='r';}));
    var html='';
    items.slice(0,8).forEach(function(a){
        html+='<div class="alert-item">'+
            '<div class="alert-dot dot-'+a.nivel+'"></div>'+
            '<div style="flex:1;min-width:0">'+
                '<div class="alert-txt" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+a.txt+'</div>'+
                '<div class="alert-meta">'+a.meta+'</div>'+
            '</div>'+
            '<div class="alert-amt">'+a.amt+'</div>'+
        '</div>';
    });
    grid.innerHTML=html;
}

// ── COMENTARIOS INTELIGENTES ──────────────────────────────────
function generarComentarios(){
    var comentarios=[];

    // ── Análisis Caja ──
    var ing=0,eg=0;
    G.caja.forEach(function(r){var m=parseFloat(r.monto)||0;if(r.tipo==='ingreso')ing+=m;else eg+=m;});
    var saldoCaja=ing-eg;
    var pctGasto=ing>0?Math.round(eg/ing*100):0;

    if(saldoCaja<0){
        comentarios.push({icon:'🚨',tipo:'alerta',tituloTipo:'ALERTA CRÍTICA',
            txt:'Tu saldo de caja es negativo (S/ '+fmt(saldoCaja,0)+'). Los egresos superan los ingresos. Revisa los movimientos recientes de inmediato.'});
    } else if(saldoCaja<500){
        comentarios.push({icon:'⚠️',tipo:'alerta',tituloTipo:'ALERTA',
            txt:'Saldo de caja bajo: S/ '+fmt(saldoCaja,0)+'. Considera programar un ingreso antes de los próximos pagos de planilla o cuotas.'});
    } else if(pctGasto>80){
        comentarios.push({icon:'📊',tipo:'sugerencia',tituloTipo:'SUGERENCIA',
            txt:'El '+pctGasto+'% de tus ingresos se destinan a egresos. Evalúa si hay categorías que pueden optimizarse, especialmente Costos Directos y Personal.'});
    } else {
        comentarios.push({icon:'💚',tipo:'positivo',tituloTipo:'POSITIVO',
            txt:'Saldo de caja saludable: S/ '+fmt(saldoCaja,0)+'. El ratio egresos/ingresos es del '+pctGasto+'%, dentro de un rango manejable.'});
    }

    // ── Análisis de Rentabilidad del Período seleccionado (nuevo, de Presupuesto) ──
    if(PERIODO.actual){
        var proysAll=proyectosCerrados();
        var delActual=proysAll.filter(function(p){return p.mk===PERIODO.actual;});
        var delAnterior=proysAll.filter(function(p){return p.mk===PERIODO.anterior;});
        if(delActual.length>0){
            var utilPeriodo=delActual.reduce(function(s,p){return s+p.utilidad;},0);
            var rentProm=delActual.reduce(function(s,p){return s+p.rentPct;},0)/delActual.length;
            var utilAnt=delAnterior.reduce(function(s,p){return s+p.utilidad;},0);
            var comparativo = delAnterior.length>0
                ? (utilPeriodo>=utilAnt ? ' Mejor resultado que '+labelMes(PERIODO.anterior)+' (S/ '+fmt(utilAnt,0)+').'
                                        : ' Por debajo de '+labelMes(PERIODO.anterior)+' (S/ '+fmt(utilAnt,0)+'), vale la pena revisar qué cambió.')
                : '';
            comentarios.push({icon:'📈', tipo: rentProm>=20?'positivo':(rentProm>=0?'sugerencia':'alerta'),
                tituloTipo:'RENTABILIDAD · '+labelMes(PERIODO.actual).toUpperCase(),
                txt: delActual.length+' proyecto'+(delActual.length!==1?'s':'')+' cerrado'+(delActual.length!==1?'s':'')+' en '+labelMes(PERIODO.actual)+
                    ', con una utilidad total de S/ '+fmt(utilPeriodo,0)+' (rentabilidad promedio '+rentProm.toFixed(1)+'%).'+comparativo});
        } else {
            comentarios.push({icon:'📈', tipo:'info', tituloTipo:'SIN CIERRES · '+labelMes(PERIODO.actual).toUpperCase(),
                txt:'No se cerró ningún proyecto en '+labelMes(PERIODO.actual)+' según Presupuesto. Si tienes proyectos en curso, recuerda registrar su fecha de fin al completarlos para verlos reflejados aquí.'});
        }
    }

    // ── Análisis Cotizaciones ──
    var cotPend=G.cotizaciones.filter(function(r){return (r.estado||'').toLowerCase()==='pendiente';});
    var cotPendMonto=cotPend.reduce(function(s,r){return s+(parseFloat(r.subtotal)||0);},0);
    if(cotPend.length>0){
        // Días promedio pendiente
        var hoyD=new Date(); hoyD.setHours(0,0,0,0);
        var diasProm=0;
        cotPend.forEach(function(r){
            if(r.fecha){var f=new Date(String(r.fecha).substring(0,10)+'T00:00:00');diasProm+=Math.round((hoyD-f)/(1000*60*60*24));}
        });
        diasProm=Math.round(diasProm/cotPend.length);
        if(diasProm>45){
            comentarios.push({icon:'⏰',tipo:'alerta',tituloTipo:'ATENCIÓN',
                txt:'Tienes '+cotPend.length+' cotizaciones pendientes con un promedio de '+diasProm+' días sin facturar (S/ '+fmt(cotPendMonto,0)+'). Considera hacer seguimiento activo.'});
        } else {
            comentarios.push({icon:'📋',tipo:'info',tituloTipo:'INFORMACIÓN',
                txt:'Hay '+cotPend.length+' cotizaciones pendientes por S/ '+fmt(cotPendMonto,0)+'. Promedio de '+diasProm+' días desde emisión. Módulo de Seguimiento puede ayudarte a priorizarlas.'});
        }
    }

    // ── Análisis Facturas ──
    var factVenc=G.facturas.filter(function(r){return r.estado==='Vencida';});
    var factEmit=G.facturas.filter(function(r){return r.estado==='Emitida';});
    var montoVenc=factVenc.reduce(function(s,r){return s+(parseFloat(r.total)||0);},0);
    var montoEmit=factEmit.reduce(function(s,r){return s+(parseFloat(r.total)||0);},0);
    if(factVenc.length>0){
        comentarios.push({icon:'🧾',tipo:'alerta',tituloTipo:'ALERTA COBRO',
            txt:factVenc.length+' factura'+(factVenc.length>1?'s':'')+' vencida'+(factVenc.length>1?'s':'')+' por cobrar: S/ '+fmt(montoVenc,0)+'. Contacta a los clientes para gestionar el pago a la brevedad.'});
    } else if(factEmit.length>0){
        var proxVenc=factEmit.filter(function(r){var d=diasHasta(r.fechaVenc);return d!==null&&d<=15;});
        if(proxVenc.length>0){
            comentarios.push({icon:'📅',tipo:'sugerencia',tituloTipo:'PRÓXIMO VENCIMIENTO',
                txt:proxVenc.length+' factura'+(proxVenc.length>1?'s':'')+' vence'+(proxVenc.length>1?'n':'')+' en los próximos 15 días (S/ '+fmt(proxVenc.reduce(function(s,r){return s+(parseFloat(r.total)||0);},0),0)+'). Prepara el seguimiento de cobro.'});
        }
    }

    // ── Análisis Impuestos ──
    if(G.impuestos.length>0){
        var totalImp=G.impuestos.reduce(function(s,r){return s+(parseFloat(r.totalPagar)||0);},0);
        var puedeConDetrac=saldoCaja>=totalImp;
        comentarios.push({icon:'🏛️',tipo:puedeConDetrac?'sugerencia':'alerta',tituloTipo:puedeConDetrac?'SUGERENCIA SUNAT':'ALERTA SUNAT',
            txt:G.impuestos.length+' declaración'+(G.impuestos.length>1?'es':'')+' SUNAT pendiente'+(G.impuestos.length>1?'s':'')+' por S/ '+fmt(totalImp,0)+
            (puedeConDetrac?'. Tu saldo de caja permite cubrirlo. Recuerda declarar antes de la fecha límite.':'. Verifica tu cuenta de detracciones para cubrir el pago.')});
    } else {
        comentarios.push({icon:'✅',tipo:'positivo',tituloTipo:'SUNAT AL DÍA',
            txt:'No tienes declaraciones SUNAT pendientes. ¡Excelente! Mantén el registro mensual actualizado para evitar multas.'});
    }

    // ── Análisis Personal ──
    if(G.personal.length>0){
        var activos=G.personal.filter(function(r){return r.estado==='Activo';}).length;
        var temporales=G.personal.filter(function(r){return r.tipo==='Temporal'&&r.estado==='Activo';}).length;
        comentarios.push({icon:'👥',tipo:'info',tituloTipo:'EQUIPO',
            txt:'Tienes '+activos+' persona'+(activos!==1?'s':'')+' activa'+(activos!==1?'s':'')+' en tu equipo, '+
            (temporales>0?temporales+' temporal'+(temporales>1?'es':'')+'. Recuerda actualizar los estados cuando termine cada servicio.':'todas en planilla.')});
    }

    // ── Análisis Cuotas vs Caja (ahora calculado en vivo desde G.prestamos) ──
    var mesRealActual=mesActualStr();
    var cuotaMesReal=0;
    G.prestamos.forEach(function(p){
        (p.cuotas||[]).forEach(function(c){
            if(mesKey(c.fecha)===mesRealActual) cuotaMesReal+=parseFloat(c.cuota||c.apagar||0)||0;
        });
    });
    if(cuotaMesReal>0){
        var cubiertas=saldoCaja>=cuotaMesReal;
        comentarios.push({icon:'💳',tipo:cubiertas?'positivo':'alerta',tituloTipo:cubiertas?'PRÉSTAMOS OK':'ATENCIÓN PRÉSTAMOS',
            txt:'Cuota total de préstamos este mes: S/ '+fmt(cuotaMesReal,2)+
            (cubiertas?'. Tu saldo de caja (S/ '+fmt(saldoCaja,0)+') cubre las cuotas sin problemas.':
            '. Tu saldo de caja (S/ '+fmt(saldoCaja,0)+') es insuficiente para cubrir todas las cuotas. Planifica ingresos.')});
    }

    // ── Tarjeta inteligente: tendencia de depósitos de Detracción ──
    var mesesDetr=ultimosMeses(8);
    var datosDetr=mesesDetr.map(function(mk){ return ingresoDetraccionDelMes(mk); });
    var tendenciaDetr=calcularTendencia(datosDetr);
    var totalDetr8m=datosDetr.reduce(function(s,v){return s+v;},0);
    if(totalDetr8m>0){
        var deltaDetr=tendenciaDetr[tendenciaDetr.length-1]-tendenciaDetr[0];
        var ultimoMesDetr=datosDetr[datosDetr.length-1];
        var mesAnteriorDetr=datosDetr[datosDetr.length-2]||0;
        var direccionTxt = Math.abs(deltaDetr)<1 ? 'se mantiene estable' : (deltaDetr>0?'muestra una tendencia al alza':'muestra una tendencia a la baja');
        comentarios.push({icon:'💹',tipo: deltaDetr>=0?'positivo':'sugerencia', tituloTipo:'TENDENCIA DETRACCIÓN',
            txt:'En los últimos '+mesesDetr.length+' meses, tus depósitos de detracción '+direccionTxt+'. '+
                'Este mes se depositó S/ '+fmt(ultimoMesDetr,0)+' (vs S/ '+fmt(mesAnteriorDetr,0)+' el mes anterior). Revisa el detalle en Impuestos → Cuenta de Detracciones.'});
    }

    // ── Tarjeta inteligente: categoría de gasto dominante del mes ──
    var mesActualGasto=mesActualStr();
    var mapaGasto={};
    G.caja.forEach(function(r){
        if(r.tipo!=='egreso' || mesKey(r.fecha)!==mesActualGasto) return;
        var etiqueta=(r.subcategoria&&r.subcategoria!=='-'&&r.subcategoria!=='—') ? r.subcategoria : (CAT_LABELS[r.categoria]||r.categoria||'Otro');
        mapaGasto[etiqueta]=(mapaGasto[etiqueta]||0)+(parseFloat(r.monto)||0);
    });
    var listaGasto=Object.keys(mapaGasto).map(function(k){return {nombre:k,monto:mapaGasto[k]};}).sort(function(a,b){return b.monto-a.monto;});
    if(listaGasto.length){
        var totalGastoMes=listaGasto.reduce(function(s,i){return s+i.monto;},0);
        var top=listaGasto[0];
        var pctTop=totalGastoMes>0?(top.monto/totalGastoMes*100):0;
        comentarios.push({icon:'🏆',tipo: pctTop>=40?'sugerencia':'info', tituloTipo:'GASTO PRINCIPAL DEL MES',
            txt:'"'+top.nombre+'" es tu mayor gasto en '+labelMes(mesActualGasto)+' con S/ '+fmt(top.monto,0)+
                ' ('+pctTop.toFixed(0)+'% de lo gastado este mes).'+
                (pctTop>=40?' Está bastante concentrado en una sola categoría — vale la pena revisar si se puede optimizar.':'')});
    }

    // Renderizar máximo 8 comentarios
    var html='';
    var tipoMap={alerta:'tipo-alerta',sugerencia:'tipo-sugerencia',positivo:'tipo-positivo',info:'tipo-info'};
    comentarios.slice(0,9).forEach(function(c){
        html+='<div class="ai-comment">'+
            '<div class="ai-comment-icon">'+c.icon+'</div>'+
            '<div class="ai-comment-tipo '+tipoMap[c.tipo]+'">'+c.tituloTipo+'</div>'+
            '<div class="ai-comment-txt">'+c.txt+'</div>'+
        '</div>';
    });
    document.getElementById('aiComments').innerHTML=html;
    if(PERIODO.actual){
        document.getElementById('aiHeadSub').textContent=
            'Interpretaciones automáticas en tiempo real · Período: '+labelMes(PERIODO.actual);
    }
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
