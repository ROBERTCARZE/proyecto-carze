/* ==========================================================================
   CAJA_DIARIA.JS — Lógica del módulo de Caja Diaria
   CARZE Contratistas Generales S.A.C.
   --------------------------------------------------------------------------
   Extraído de caja_diaria.html tal cual estaba (mismo comportamiento, cero
   cambios de lógica) — segundo módulo separado, el de mayor uso diario.
   ========================================================================== */
import { initializeApp }    from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";
import { getFirestore, collection, query, orderBy,
         onSnapshot, addDoc, updateDoc, deleteDoc,
         doc, serverTimestamp, setDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";
import { getStorage, ref as sRef, uploadBytes, getDownloadURL }
         from "https://www.gstatic.com/firebasejs/11.8.1/firebase-storage.js";

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
const storage = getStorage(app);
const COL='caja_diaria';

var datos=[],datosFiltrados=[],tipoActual='egreso',editId=null;
var pagActual=1,tamPag=20,sortCol=null;
var archivoSeleccionado=null;

// Subcategorías por categoría
const SUBCATS={
    SCOTIABANK:['Factoring','Transferencia','Depósito en efectivo','Otros ingresos'],
    INTERBANK:['Factoring','Transferencia','Depósito en efectivo','Otros ingresos'],
    COSTOS_DIRECTOS:['Materiales e Insumos','Subcontratistas/Técnicos','Combustible y Lubricantes'],
    GASTOS_DE_PERSONAL:['Planilla y Sueldos','Seguros (SCTR/Vida)','Equipos de protección personal'],
    LOGISTICA_Y_CAMPO:['Viáticos y Alimentación','Pasajes y Traslados','Mensajería','Mantenimiento de activos'],
    FINANCIERO_CAJA:['Comisiones e ITF','Préstamos y Tarjetas','Liquidación de Crédito'],
    GASTOS_ADMINISTRATIVOS_Y_FIJOS:['Servicios y Alquiler','Salud y Legal','Útiles de oficina','Mantenimiento','Mensajería','Ajustes','Compra de facturas'],
    GASTOS_INDIRECTOS:['Alimentación y Viáticos','Pasajes y Combustible','Marketing','Legal y salud','Otro tipo de gastos'],
    AHORRO:['Caja Piura','Caja Cajamarca','Fondo de Emergencia','Otros Ahorros']
};

const CAT_COLORS={
    SCOTIABANK:'#c8102e',
    INTERBANK:'#0033a0',COSTOS_DIRECTOS:'#1e40af',GASTOS_DE_PERSONAL:'#9333ea',
    LOGISTICA_Y_CAMPO:'#f59e0b',FINANCIERO_CAJA:'#dc2626',
    GASTOS_ADMINISTRATIVOS_Y_FIJOS:'#475569',GASTOS_INDIRECTOS:'#ea580c',
    AHORRO:'#059669'
};
const CAT_LABELS={
    SCOTIABANK:'Scotiabank',
    INTERBANK:'Interbank',COSTOS_DIRECTOS:'Costos Directos',GASTOS_DE_PERSONAL:'Personal',
    LOGISTICA_Y_CAMPO:'Logística',FINANCIERO_CAJA:'Financiero',
    GASTOS_ADMINISTRATIVOS_Y_FIJOS:'Administrativo',GASTOS_INDIRECTOS:'Indirectos',
    AHORRO:'Ahorro'
};
// Tipo de movimiento al que aplica cada categoría base ('ingreso'|'egreso'|'ambos')
const CAT_TIPOS={
    SCOTIABANK:'ingreso',INTERBANK:'ingreso',AHORRO:'ambos',
    COSTOS_DIRECTOS:'egreso',GASTOS_DE_PERSONAL:'egreso',LOGISTICA_Y_CAMPO:'egreso',
    FINANCIERO_CAJA:'egreso',GASTOS_ADMINISTRATIVOS_Y_FIJOS:'egreso',GASTOS_INDIRECTOS:'egreso'
};

// ── CATEGORÍAS Y SUBCATEGORÍAS PERSONALIZADAS (Firestore) ──────
// Documento compartido: caja_config/categorias
// { customCategorias:{ VALUE:{label,tipo,color,emoji} }, customSubcats:{ VALUE:[..] } }
const configRef=doc(db,'caja_config','categorias');
var customCategorias={};   // {VALUE:{label,tipo,color,emoji}}
var customSubcats={};      // {VALUE:[subcat,...]}
var ncTipoSel='egreso';    // tipo elegido en el modal "Nueva categoría"
var ncColorSel=null;       // color elegido en el modal "Nueva categoría"
var nsCategoriaActual=null;// categoría objetivo del modal "Nueva subcategoría"

const SWATCHES=[
    {emoji:'🔴',color:'#dc2626'},{emoji:'🔵',color:'#1e40af'},{emoji:'💚',color:'#16a34a'},
    {emoji:'🟣',color:'#9333ea'},{emoji:'🟡',color:'#f59e0b'},{emoji:'🟠',color:'#ea580c'},
    {emoji:'⚫',color:'#475569'},{emoji:'🩵',color:'#0891b2'}
];

function catTipo(value){
    if(CAT_TIPOS[value]) return CAT_TIPOS[value];
    if(customCategorias[value]) return customCategorias[value].tipo||'ambos';
    return 'ambos';
}

function iniciarConfigListener(){
    onSnapshot(configRef,function(snap){
        var data=snap.exists()?snap.data():{};
        customCategorias=data.customCategorias||{};
        customSubcats=data.customSubcats||{};
        Object.keys(customCategorias).forEach(function(val){
            var c=customCategorias[val];
            SUBCATS[val]=customSubcats[val]||[];
            CAT_LABELS[val]=c.label;
            CAT_COLORS[val]=c.color||'#64748b';
        });
        Object.keys(customSubcats).forEach(function(val){
            if(!SUBCATS[val]) SUBCATS[val]=[];
            SUBCATS[val]=customSubcats[val]||[];
        });
        rebuildCategoriaOptions();
    },function(err){console.warn('No se pudo cargar categorías personalizadas:',err.message);});
}

// ── SESIÓN ───────────────────────────────────────────────────
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
    document.getElementById('mFecha').value=hoy();
    setTipo('egreso');
    iniciarListener();
    iniciarConfigListener();
});

function iniciarListener(){
    document.getElementById('tablaBody').innerHTML='<tr><td colspan="11" style="text-align:center;padding:28px;color:var(--muted);font-size:.8rem">⏳ Cargando...</td></tr>';
    onSnapshot(query(collection(db,COL),orderBy('fecha','asc')),function(snap){
        datos=snap.docs.map(function(d){var r=d.data();r._id=d.id;return r;});
        // Desempate: si dos movimientos tienen la misma fecha, se ordenan por
        // el campo "num" (orden real de registro), ya que Firestore no garantiza
        // un orden estable entre documentos con el mismo valor de "fecha".
        datos.sort(function(a,b){
            var fa=String(a.fecha||''),fb=String(b.fecha||'');
            if(fa!==fb) return fa<fb?-1:1;
            return (parseInt(a.num)||0)-(parseInt(b.num)||0);
        });
        poblarFiltroMes();
        aplicarFiltros();
        calcularKPIs();
        verificarAlerta();
    },function(err){toast('Error: '+err.message,'err');});
}

// ── HELPERS ──────────────────────────────────────────────────
function hoy(){var d=new Date();return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate());}
function p2(n){return n<10?'0'+n:String(n);}
function fmt(n){return parseFloat(n||0).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2});}
function esc(v){return v!=null&&v!==''&&v!=='-'?String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;'):'—';}
function fmtF(v){if(!v)return '—';var s=String(v).trim();if(s.match(/^\d{4}-\d{2}-\d{2}/)){var p=s.split('-');return p[2]+'/'+p[1]+'/'+p[0];}return s;}
function mesLabel(v){if(!v)return '';var p=String(v).split('-');var meses=['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];return (meses[parseInt(p[1])]||p[1])+' '+p[0];}

function toast(msg,tipo){
    var t=document.getElementById('toast');
    t.textContent=msg;t.className='toast '+(tipo||'ok');t.classList.add('show');
    setTimeout(function(){t.classList.remove('show');},3200);
}

// ── POBLAR FILTRO MES ─────────────────────────────────────────
function poblarFiltroMes(){
    var meses=[...new Set(datos.map(function(r){return String(r.fecha||'').substring(0,7);}))].sort();
    var sel=document.getElementById('filterMes');
    var cur=sel.value;
    sel.innerHTML='<option value="">Todos los meses</option>';
    meses.forEach(function(m){
        var op=document.createElement('option');
        op.value=m; op.textContent=mesLabel(m); sel.appendChild(op);
    });
    if(cur) sel.value=cur;
}

// ── FILTROS ───────────────────────────────────────────────────
function aplicarFiltros(){
    var q   =document.getElementById('searchInput').value.toLowerCase().trim();
    var mes =document.getElementById('filterMes').value;
    var cat =document.getElementById('filterCat').value;
    var tipo=document.getElementById('filterTipo').value;
    var desde=document.getElementById('filterFechaDesde').value; // 'YYYY-MM-DD'
    var hasta=document.getElementById('filterFechaHasta').value;
    datosFiltrados=datos.filter(function(r){
        var mQ=!q||[r.concepto,r.categoria,r.subcategoria,r.obs,r.comprobante].some(function(v){return String(v||'').toLowerCase().includes(q);});
        var mM=!mes||String(r.fecha||'').startsWith(mes);
        var mC=!cat||(r.categoria||'')===cat;
        var mT=!tipo||r.tipo===tipo;
        var fr=String(r.fecha||'');
        var mD=(!desde||fr>=desde)&&(!hasta||fr<=hasta);
        return mQ&&mM&&mC&&mT&&mD;
    });
    pagActual=1; renderTabla();
}
window.aplicarFiltros=aplicarFiltros;

// El rango de fechas filtra tanto un día exacto (Desde = Hasta) como
// cualquier rango arbitrario; se combina con el filtro de mes si ambos
// están activos, aunque lo normal es usar uno u otro.
function limpiarRangoFechas(){
    document.getElementById('filterFechaDesde').value='';
    document.getElementById('filterFechaHasta').value='';
    aplicarFiltros();
}
window.limpiarRangoFechas=limpiarRangoFechas;

function filtrarTipo(tipo){
    document.getElementById('filterTipo').value=tipo;
    aplicarFiltros();
}
window.filtrarTipo=filtrarTipo;

// ── KPIs ──────────────────────────────────────────────────────
function calcularKPIs(){
    var ing=0,eg=0,ingC=0,egC=0;
    datos.forEach(function(r){
        if(r.tipo==='ingreso'){ing+=parseFloat(r.monto)||0;ingC++;}
        else{eg+=parseFloat(r.monto)||0;egC++;}
    });
    var saldo=ing-eg;
    document.getElementById('kIngresos').textContent='S/ '+fmt(ing);
    document.getElementById('kEgresos').textContent='S/ '+fmt(eg);
    document.getElementById('kSaldo').textContent='S/ '+fmt(saldo);
    // Ahorros = suma de movimientos categoría AHORRO
    var ahorro=0;
    datos.forEach(function(r){
        if((r.categoria||'')==='AHORRO'){
            if(r.tipo==='ingreso') ahorro+=parseFloat(r.monto)||0;
            else ahorro-=parseFloat(r.monto)||0;
        }
    });
    document.getElementById('kTotal').textContent='S/ '+fmt(ahorro);
    document.getElementById('kMesActual').textContent=ahorro>=0?'Saldo en ahorros':'⚠ Ahorros negativos';
    document.getElementById('kIngCount').textContent=ingC+' movimientos';
    document.getElementById('kEgCount').textContent=egC+' movimientos';
    document.getElementById('kSaldoSub').textContent=saldo>=0?'Saldo positivo':'⚠ Saldo negativo';
    document.getElementById('kSaldo').style.color=saldo>=0?'var(--azul2)':'var(--rojo)';
}

// ── ALERTA SALDO ──────────────────────────────────────────────
function verificarAlerta(){
    var ing=0,eg=0;
    datos.forEach(function(r){if(r.tipo==='ingreso')ing+=parseFloat(r.monto)||0;else eg+=parseFloat(r.monto)||0;});
    var saldo=ing-eg;
    var umbral=parseFloat(document.getElementById('umbralInput').value)||500;
    var alertDiv=document.getElementById('alertaSaldo');
    if(saldo<umbral){
        alertDiv.classList.add('show');
        document.getElementById('alertaMsg').textContent='Saldo actual S/ '+fmt(saldo)+' está por debajo del umbral S/ '+fmt(umbral);
    } else {
        alertDiv.classList.remove('show');
    }
}
window.verificarAlerta=verificarAlerta;

// ── BREAKDOWN CATEGORÍAS ──────────────────────────────────────
function calcularCategorias(){
    var totales={};
    var totalEg=0;
    datos.forEach(function(r){
        if(r.tipo!=='ingreso'){
            var cat=r.categoria||'OTROS';
            totales[cat]=(totales[cat]||0)+(parseFloat(r.monto)||0);
            totalEg+=(parseFloat(r.monto)||0);
        }
    });
    var cont=document.getElementById('catGrid');
    cont.innerHTML='';
    Object.keys(totales).sort(function(a,b){return totales[b]-totales[a];}).forEach(function(cat){
        var amt=totales[cat];
        var pct=totalEg>0?Math.round(amt/totalEg*100):0;
        var color=CAT_COLORS[cat]||'#64748b';
        var label=CAT_LABELS[cat]||cat;
        var div=document.createElement('div');
        div.className='cat-card';
        div.innerHTML=
            '<div class="cat-card-title"><span style="width:8px;height:8px;border-radius:50%;background:'+color+';display:inline-block"></span>'+label+'</div>'+
            '<div class="cat-amount" style="color:'+color+'">S/ '+fmt(amt)+'</div>'+
            '<div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="font-size:.65rem;color:var(--muted)">'+pct+'% del total egresos</span></div>'+
            '<div class="cat-bar-bg"><div class="cat-bar-fill" style="width:'+pct+'%;background:'+color+'"></div></div>';
        cont.appendChild(div);
    });
}

// ── GRÁFICOS ──────────────────────────────────────────────────
function renderGraficos(){
    // Flujo mensual
    var meses={};
    datos.forEach(function(r){
        var m=String(r.fecha||'').substring(0,7);
        if(!meses[m]) meses[m]={ing:0,eg:0};
        if(r.tipo==='ingreso') meses[m].ing+=parseFloat(r.monto)||0;
        else meses[m].eg+=parseFloat(r.monto)||0;
    });
    var mKeys=Object.keys(meses).sort();
    var ingData=mKeys.map(function(m){return meses[m].ing;});
    var egData =mKeys.map(function(m){return meses[m].eg;});
    var labels =mKeys.map(mesLabel);

    if(chartFlujo) chartFlujo.destroy();
    chartFlujo=new Chart(document.getElementById('chartFlujo'),{
        type:'bar',
        data:{
            labels:labels,
            datasets:[
                {label:'Ingresos',data:ingData,backgroundColor:'rgba(22,163,74,.7)',borderRadius:4,borderSkipped:false},
                {label:'Egresos', data:egData, backgroundColor:'rgba(220,38,38,.65)',borderRadius:4,borderSkipped:false}
            ]
        },
        options:{responsive:true,maintainAspectRatio:false,
            plugins:{legend:{labels:{boxWidth:10,font:{size:11}}}},
            scales:{x:{grid:{display:false},ticks:{font:{size:10}}},
                    y:{grid:{color:'rgba(0,0,0,.05)'},ticks:{font:{size:10},callback:function(v){return 'S/'+Math.round(v/1000)+'k';}}}}}
    });

    // Dona egresos por categoría
    var catTotales={};
    datos.forEach(function(r){if(r.tipo!=='ingreso'){var c=CAT_LABELS[r.categoria]||r.categoria||'Otro';catTotales[c]=(catTotales[c]||0)+(parseFloat(r.monto)||0);}});
    var cKeys=Object.keys(catTotales);
    var cColors=cKeys.map(function(k){var orig=Object.keys(CAT_LABELS).find(function(c){return CAT_LABELS[c]===k;});return CAT_COLORS[orig]||'#94a3b8';});

    if(chartDona) chartDona.destroy();
    chartDona=new Chart(document.getElementById('chartDona'),{
        type:'doughnut',
        data:{labels:cKeys,datasets:[{data:cKeys.map(function(k){return catTotales[k];}),backgroundColor:cColors,borderWidth:0,hoverOffset:5}]},
        options:{responsive:true,maintainAspectRatio:false,cutout:'60%',
            plugins:{legend:{position:'bottom',labels:{boxWidth:10,padding:8,font:{size:10}}}}}
    });
}

// ── RENDER TABLA ──────────────────────────────────────────────
function renderTabla(){
    var tbody=document.getElementById('tablaBody');
    var empty=document.getElementById('emptyState');
    var count=document.getElementById('tableCount');
    var pag  =document.getElementById('paginacion');
    tbody.innerHTML='';

    if(!datosFiltrados.length){empty.style.display='flex';count.textContent='0 registros';pag.style.display='none';return;}
    empty.style.display='none';
    count.textContent=datosFiltrados.length+' registro'+(datosFiltrados.length!==1?'s':'');

    // Calcular saldos acumulados sobre datos filtrados
    var saldo=0;
    var saldos=datosFiltrados.map(function(r){
        if(r.tipo==='ingreso') saldo+=parseFloat(r.monto)||0;
        else saldo-=parseFloat(r.monto)||0;
        return saldo;
    });

    var totalP=Math.ceil(datosFiltrados.length/tamPag);
    if(pagActual>totalP) pagActual=1;
    var ini=(pagActual-1)*tamPag, fin=Math.min(ini+tamPag,datosFiltrados.length);

    datosFiltrados.slice(ini,fin).forEach(function(row,i){
        var realIdx=ini+i;
        var saldoVal=saldos[realIdx];
        var esTipo=row.tipo==='ingreso';
        var catColor=CAT_COLORS[row.categoria]||'#64748b';
        var catLabel=CAT_LABELS[row.categoria]||row.categoria||'—';
        var obsBadge=obsBadgeHTML(row.obs);
        var tr=document.createElement('tr');
        tr.className=esTipo?'ingreso-row':'egreso-row';
        tr.innerHTML=
            '<td>'+(realIdx+1)+'</td>'+
            '<td>'+fmtF(row.fecha)+'</td>'+
            '<td><span class="cat-pill" style="background:'+catColor+'22;color:'+catColor+';border:1px solid '+catColor+'44">'+catLabel+'</span></td>'+
            '<td style="font-size:.72rem">'+esc(row.subcategoria)+'</td>'+
            '<td style="max-width:220px;overflow:hidden;text-overflow:ellipsis" title="'+esc(row.concepto)+'">'+esc(row.concepto)+'</td>'+
            '<td class="ingreso-amt">'+(esTipo?'S/ '+fmt(row.monto):'—')+'</td>'+
            '<td class="egreso-amt">'+(!esTipo?'S/ '+fmt(row.monto):'—')+'</td>'+
            '<td class="'+(saldoVal>=0?'saldo-pos':'saldo-neg')+'">S/ '+fmt(saldoVal)+'</td>'+
            '<td>'+obsBadge+'</td>'+
            '<td>'+compHTML(row)+'</td>'+
            '<td style="display:flex;gap:4px">'+
                '<button class="btn-edit-sm" onclick="editarMovimiento(\''+row._id+'\')">✏️</button>'+
                '<button class="btn-del" onclick="pedirEliminar(\''+row._id+'\',\''+esc(row.concepto)+'\')">🗑️</button>'+
            '</td>';
        tbody.appendChild(tr);
    });

    if(datosFiltrados.length>tamPag){
        pag.style.display='flex';
        document.getElementById('pagInfo').textContent='Mostrando '+(ini+1)+'-'+fin+' de '+datosFiltrados.length;
        renderPags(totalP);
    } else { pag.style.display='none'; }
}

function obsBadgeHTML(obs){
    if(!obs||obs==='-') return '<span style="color:#94a3b8">—</span>';
    var s=String(obs).toUpperCase();
    var cls='';
    if(s.includes('PENDIENTE')) cls='obs-pendiente';
    else if(s.includes('RETIRO')) cls='obs-retiro';
    else if(s.includes('DEPÓSITO')||s.includes('DEPOSITO')) cls='obs-deposito';
    else if(s.includes('EXPEDIENTE')) cls='obs-expediente';
    else return '<span style="font-size:.72rem;color:var(--muted)">'+esc(obs)+'</span>';
    return '<span class="obs-badge '+cls+'">'+esc(obs)+'</span>';
}

function compHTML(row){
    var url=row.comprobanteURL&&row.comprobanteURL!=='-'?row.comprobanteURL:null;
    var nombre=row.comprobante&&row.comprobante!=='-'?String(row.comprobante):'';
    if(url){
        var su=url.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
        var sn=nombre.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
        var lbl=nombre.length>22?nombre.substring(0,20)+'…':(nombre||'Ver archivo');
        return '<button class="comp-chip" onclick="abrirVisor(\''+su+'\',\''+sn+'\')">'+
            '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>'+
            lbl+'</button>';
    }
    return nombre?'<span style="font-size:.7rem;color:var(--muted)">'+esc(nombre)+'</span>':'<span style="color:#94a3b8">—</span>';
}

function renderPags(total){
    var c=document.getElementById('pagBtns'); c.innerHTML='';
    var prev=document.createElement('button');prev.className='pag-btn';prev.textContent='‹';prev.disabled=pagActual===1;
    prev.onclick=function(){if(pagActual>1){pagActual--;renderTabla();}};c.appendChild(prev);
    var rng=[];
    for(var i=1;i<=total;i++){if(i===1||i===total||Math.abs(i-pagActual)<=2)rng.push(i);else if(rng[rng.length-1]!=='…')rng.push('…');}
    rng.forEach(function(p){
        if(p==='…'){var s=document.createElement('button');s.className='pag-btn';s.textContent='…';s.disabled=true;c.appendChild(s);return;}
        var b=document.createElement('button');b.className='pag-btn'+(p===pagActual?' active':'');b.textContent=p;
        b.onclick=(function(pp){return function(){pagActual=pp;renderTabla();};})(p);c.appendChild(b);
    });
    var next=document.createElement('button');next.className='pag-btn';next.textContent='›';next.disabled=pagActual===total;
    next.onclick=function(){if(pagActual<total){pagActual++;renderTabla();}};c.appendChild(next);
}
function cambiarTamano(val){tamPag=parseInt(val);pagActual=1;renderTabla();}
window.cambiarTamano=cambiarTamano;

// ── MODAL ─────────────────────────────────────────────────────
function setTipo(tipo){
    tipoActual=tipo;
    document.getElementById('btnIngreso').classList.toggle('active',tipo==='ingreso');
    document.getElementById('btnEgreso').classList.toggle('active',tipo==='egreso');
    // Filtrar categorías según tipo (incluye categorías personalizadas)
    var sel=document.getElementById('mCategoria');
    Array.from(sel.options).forEach(function(op){
        if(op.value===''){op.style.display='';return;}
        var ct=catTipo(op.value);
        op.style.display=(ct==='ambos'||ct===tipo)?'':'none';
    });
    if(sel.value && sel.options[sel.selectedIndex] && sel.options[sel.selectedIndex].style.display==='none'){
        sel.value='';
    }
    actualizarSubcat();
}
window.setTipo=setTipo;

function actualizarSubcat(){
    var cat=document.getElementById('mCategoria').value;
    var sel=document.getElementById('mSubcategoria');
    sel.innerHTML='<option value="">— Seleccionar —</option>';
    (SUBCATS[cat]||[]).forEach(function(s){var op=document.createElement('option');op.value=s;op.textContent=s;sel.appendChild(op);});
    var btnAddSub=document.getElementById('btnAddSubcat');
    if(btnAddSub) btnAddSub.disabled=!cat;
}
window.actualizarSubcat=actualizarSubcat;

// ── OPCIONES DINÁMICAS DE CATEGORÍA (personalizadas) ─────────────
function rebuildCategoriaOptions(){
    var sel=document.getElementById('mCategoria');
    var filterSel=document.getElementById('filterCat');
    if(sel){
        var valActual=sel.value;
        Array.from(sel.querySelectorAll('option[data-custom="1"]')).forEach(function(o){o.remove();});
        Object.keys(customCategorias).forEach(function(val){
            var c=customCategorias[val];
            var op=document.createElement('option');
            op.value=val; op.setAttribute('data-custom','1');
            op.textContent=(c.emoji||'🔘')+' '+c.label;
            sel.appendChild(op);
        });
        sel.value=valActual;
        setTipo(tipoActual);
    }
    if(filterSel){
        var fValActual=filterSel.value;
        Array.from(filterSel.querySelectorAll('option[data-custom="1"]')).forEach(function(o){o.remove();});
        Object.keys(customCategorias).forEach(function(val){
            var c=customCategorias[val];
            var op=document.createElement('option');
            op.value=val; op.setAttribute('data-custom','1');
            op.textContent=(c.emoji||'🔘')+' '+c.label;
            filterSel.appendChild(op);
        });
        filterSel.value=fValActual;
    }
}

// ── MODAL: NUEVA CATEGORÍA ────────────────────────────────────────
function pintarSwatches(){
    var row=document.getElementById('ncColorRow');
    row.innerHTML='';
    SWATCHES.forEach(function(s,i){
        var d=document.createElement('div');
        d.className='swatch'+(i===0?' sel':'');
        d.style.background=s.color;
        d.textContent=s.emoji;
        d.style.fontSize='.75rem';
        d.onclick=function(){
            Array.from(row.children).forEach(function(c){c.classList.remove('sel');});
            d.classList.add('sel');
            ncColorSel=s;
        };
        row.appendChild(d);
    });
    ncColorSel=SWATCHES[0];
}

function setNcTipo(tipo){
    ncTipoSel=tipo;
    document.getElementById('ncTipoIngreso').classList.toggle('active',tipo==='ingreso');
    document.getElementById('ncTipoEgreso').classList.toggle('active',tipo==='egreso');
    document.getElementById('ncTipoAmbos').classList.toggle('active',tipo==='ambos');
}
window.setNcTipo=setNcTipo;

function abrirModalCat(){
    document.getElementById('ncNombre').value='';
    pintarSwatches();
    // Preselecciona el tipo según el movimiento actual (ingreso/egreso)
    setNcTipo(tipoActual==='ingreso'?'ingreso':'egreso');
    document.getElementById('overlayCat').classList.add('open');
    setTimeout(function(){document.getElementById('ncNombre').focus();},150);
}
window.abrirModalCat=abrirModalCat;

function cerrarModalCat(){document.getElementById('overlayCat').classList.remove('open');}
window.cerrarModalCat=cerrarModalCat;

async function guardarNuevaCategoria(){
    var nombre=document.getElementById('ncNombre').value.trim();
    if(!nombre){toast('Escribe un nombre para la categoría','err');return;}
    if(!ncTipoSel){toast('Selecciona a qué tipo de movimiento aplica','err');return;}
    var color=ncColorSel||SWATCHES[0];
    // Genera un value único a partir del nombre
    var base=nombre.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
        .replace(/[^A-Z0-9]+/g,'_').replace(/^_+|_+$/g,'')||'CATEGORIA';
    var value='CUSTOM_'+base;
    if(customCategorias[value] || CAT_LABELS[value]){
        value=value+'_'+Date.now().toString(36).toUpperCase();
    }
    var btn=document.getElementById('btnGuardarCat');
    var txt=document.getElementById('btnGuardarCatTxt');
    btn.disabled=true; var prevTxt=txt.textContent; txt.innerHTML='<span class="spinner"></span>';
    try{
        await setDoc(configRef,{customCategorias:{}},{merge:true});
        await updateDoc(configRef,{
            ['customCategorias.'+value]:{label:nombre,tipo:ncTipoSel,color:color.color,emoji:color.emoji}
        });
        toast('Categoría "'+nombre+'" creada ✓','ok');
        cerrarModalCat();
        // Selecciona automáticamente la nueva categoría en el formulario
        setTimeout(function(){
            var sel=document.getElementById('mCategoria');
            if(sel.querySelector('option[value="'+value+'"]')){
                sel.value=value; actualizarSubcat();
            }
        },400);
    }catch(e){
        toast('Error al guardar: '+e.message,'err');
    }finally{
        btn.disabled=false; txt.textContent=prevTxt;
    }
}
window.guardarNuevaCategoria=guardarNuevaCategoria;

// ── MODAL: NUEVA SUBCATEGORÍA ─────────────────────────────────────
function abrirModalSubcat(){
    var cat=document.getElementById('mCategoria').value;
    if(!cat){toast('Primero selecciona una categoría','warn');return;}
    nsCategoriaActual=cat;
    document.getElementById('nsCategoriaLabel').value=CAT_LABELS[cat]||cat;
    document.getElementById('nsNombre').value='';
    document.getElementById('overlaySubcat').classList.add('open');
    setTimeout(function(){document.getElementById('nsNombre').focus();},150);
}
window.abrirModalSubcat=abrirModalSubcat;

function cerrarModalSubcat(){document.getElementById('overlaySubcat').classList.remove('open');}
window.cerrarModalSubcat=cerrarModalSubcat;

async function guardarNuevaSubcategoria(){
    var nombre=document.getElementById('nsNombre').value.trim();
    if(!nombre){toast('Escribe un nombre para la subcategoría','err');return;}
    if(!nsCategoriaActual){toast('No se encontró la categoría destino','err');return;}
    if((SUBCATS[nsCategoriaActual]||[]).indexOf(nombre)>=0){
        toast('Esa subcategoría ya existe','warn');return;
    }
    var btn=document.getElementById('btnGuardarSubcat');
    var txt=document.getElementById('btnGuardarSubcatTxt');
    btn.disabled=true; var prevTxt=txt.textContent; txt.innerHTML='<span class="spinner"></span>';
    try{
        await setDoc(configRef,{customSubcats:{}},{merge:true});
        await updateDoc(configRef,{
            ['customSubcats.'+nsCategoriaActual]:arrayUnion(nombre)
        });
        toast('Subcategoría "'+nombre+'" creada ✓','ok');
        cerrarModalSubcat();
        setTimeout(function(){
            var sel=document.getElementById('mSubcategoria');
            if(document.getElementById('mCategoria').value===nsCategoriaActual && sel.querySelector('option[value="'+CSS.escape(nombre)+'"]')){
                sel.value=nombre;
            }
        },400);
    }catch(e){
        toast('Error al guardar: '+e.message,'err');
    }finally{
        btn.disabled=false; txt.textContent=prevTxt;
    }
}
window.guardarNuevaSubcategoria=guardarNuevaSubcategoria;

function toggleObs(txt){
    var inp=document.getElementById('mObs');
    inp.value=inp.value===txt?'':txt;
}
window.toggleObs=toggleObs;

function abrirModal(){
    editId=null; limpiar();
    document.getElementById('modalTitle').innerHTML='Nuevo <span>Movimiento</span>';
    document.getElementById('btnGuardarTxt').textContent='REGISTRAR';
    document.getElementById('overlay').classList.add('open');
}
window.abrirModal=abrirModal;

function editarMovimiento(id){
    var r=datos.find(function(x){return x._id===id;}); if(!r) return;
    editId=id;
    setTipo(r.tipo||'egreso');
    document.getElementById('mFecha').value=r.fecha||'';
    document.getElementById('mMonto').value=r.monto||'';
    document.getElementById('mCategoria').value=r.categoria||'';
    actualizarSubcat();
    document.getElementById('mSubcategoria').value=r.subcategoria||'';
    document.getElementById('mConcepto').value=r.concepto||'';
    document.getElementById('mObs').value=r.obs&&r.obs!=='-'?r.obs:'';
    // Comprobante: si tiene URL es archivo subido, si no, texto manual
    archivoSeleccionado=null;
    document.getElementById('mComprobanteFile').value='';
    document.getElementById('uploadBar').style.display='none';
    document.getElementById('uploadBarFill').style.width='0%';
    if(r.comprobanteURL&&r.comprobanteURL!=='-'){
        document.getElementById('filePreviewName').textContent=r.comprobante||'Archivo adjunto';
        document.getElementById('filePreview').style.display='flex';
        document.getElementById('fileUploadLbl').textContent='Subir nuevo (reemplaza el actual)';
        document.getElementById('mComprobante').value='';
    } else {
        document.getElementById('filePreview').style.display='none';
        document.getElementById('fileUploadLbl').textContent='Subir imagen o PDF del comprobante';
        document.getElementById('mComprobante').value=r.comprobante&&r.comprobante!=='-'?r.comprobante:'';
    }
    document.getElementById('modalTitle').innerHTML='Editar <span>Movimiento</span>';
    document.getElementById('btnGuardarTxt').textContent='ACTUALIZAR';
    document.getElementById('overlay').classList.add('open');
}
window.editarMovimiento=editarMovimiento;

function cerrarModal(){document.getElementById('overlay').classList.remove('open');}
window.cerrarModal=cerrarModal;

function limpiar(){
    ['mMonto','mConcepto','mObs','mComprobante'].forEach(function(id){document.getElementById(id).value='';});
    ['mCategoria','mSubcategoria'].forEach(function(id){document.getElementById(id).value='';});
    document.getElementById('mFecha').value=hoy();
    setTipo('egreso');
    archivoSeleccionado=null;
    document.getElementById('mComprobanteFile').value='';
    document.getElementById('filePreview').style.display='none';
    document.getElementById('fileUploadLbl').textContent='Subir imagen o PDF del comprobante';
    document.getElementById('uploadBar').style.display='none';
    document.getElementById('uploadBarFill').style.width='0%';
}

// ── GUARDAR ───────────────────────────────────────────────────
async function guardar(){
    var fecha=document.getElementById('mFecha').value;
    var monto=parseFloat(document.getElementById('mMonto').value)||0;
    var cat  =document.getElementById('mCategoria').value;
    var subcat=document.getElementById('mSubcategoria').value;
    var concepto=document.getElementById('mConcepto').value.trim();
    if(!fecha||!monto||!cat||!concepto){toast('Completa los campos obligatorios (*)','err');return;}

    // Calcular número correlativo
    var maxNum=datos.length>0?Math.max.apply(null,datos.map(function(r){return parseInt(r.num)||0;})):0;
    var btn=document.getElementById('btnGuardar');
    var txt=document.getElementById('btnGuardarTxt');
    btn.disabled=true;txt.innerHTML='<span class="spinner"></span>';

    // ── Subir archivo si hay uno nuevo ──
    var existente=editId?datos.find(function(x){return x._id===editId;}):null;
    var comprobanteNombre=document.getElementById('mComprobante').value.trim()||'-';
    var comprobanteURL=(existente&&existente.comprobanteURL)||'-';

    if(archivoSeleccionado){
        try{
            var bar=document.getElementById('uploadBar');
            var fill=document.getElementById('uploadBarFill');
            bar.style.display='block'; fill.style.width='30%';
            var ext=archivoSeleccionado.name.split('.').pop().toLowerCase();
            var path='comprobantes/caja_'+Date.now()+'_'+Math.random().toString(36).slice(2)+'.'+ext;
            var fileRef=sRef(storage,path);
            await uploadBytes(fileRef,archivoSeleccionado);
            fill.style.width='80%';
            comprobanteURL=await getDownloadURL(fileRef);
            comprobanteNombre=archivoSeleccionado.name;
            fill.style.width='100%';
            setTimeout(function(){bar.style.display='none';fill.style.width='0%';},500);
        }catch(uploadErr){
            btn.disabled=false;txt.textContent=editId?'ACTUALIZAR':'REGISTRAR';
            toast('Error al subir archivo: '+uploadErr.message,'err');return;
        }
    }

    var docData={
        num:editId?undefined:maxNum+1,
        fecha:fecha,tipo:tipoActual,
        categoria:cat,subcategoria:subcat||'-',
        concepto:concepto,
        monto:monto,
        obs:document.getElementById('mObs').value.trim()||'-',
        comprobante:comprobanteNombre,
        comprobanteURL:comprobanteURL,
        updatedAt:serverTimestamp()
    };
    if(editId) delete docData.num;

    try{
        if(editId){
            await updateDoc(doc(db,COL,editId),docData);
            toast('Movimiento actualizado ✓','ok');
        } else {
            docData.createdAt=serverTimestamp();
            await addDoc(collection(db,COL),docData);
            toast('Movimiento registrado ✓','ok');
        }
        btn.disabled=false;txt.textContent=editId?'ACTUALIZAR':'REGISTRAR';
        cerrarModal();
    }catch(err){btn.disabled=false;txt.textContent=editId?'ACTUALIZAR':'REGISTRAR';toast('Error: '+err.message,'err');}
}
window.guardar=guardar;

// ── ELIMINAR ──────────────────────────────────────────────────
var pendingDel=null;
function pedirEliminar(id,concepto){
    pendingDel=id;
    document.getElementById('confirmMsg').textContent='Se eliminará "'+concepto+'". Esta acción no se puede deshacer.';
    document.getElementById('confirmOverlay').classList.add('open');
    document.getElementById('confirmOkBtn').onclick=ejecutarEliminar;
}
window.pedirEliminar=pedirEliminar;
function cerrarConfirm(){document.getElementById('confirmOverlay').classList.remove('open');pendingDel=null;}
window.cerrarConfirm=cerrarConfirm;
async function ejecutarEliminar(){
    if(!pendingDel) return; cerrarConfirm();
    try{await deleteDoc(doc(db,COL,pendingDel));toast('Movimiento eliminado','warn');}
    catch(err){toast('Error: '+err.message,'err');}
}

// ── EXPORTAR EXCEL ────────────────────────────────────────────
function exportarExcel(){
    if(!datosFiltrados.length){toast('No hay datos para exportar con los filtros actuales','warn');return;}
    var saldo=0;
    var rows=[['N°','Fecha','Tipo','Categoría','Subcategoría','Concepto','Ingreso','Egreso','Saldo','Observación','Comprobante']];
    datosFiltrados.forEach(function(r){
        var ing=r.tipo==='ingreso'?parseFloat(r.monto)||0:0;
        var eg =r.tipo!=='ingreso'?parseFloat(r.monto)||0:0;
        saldo+=ing-eg;
        rows.push([r.num,r.fecha,r.tipo,CAT_LABELS[r.categoria]||r.categoria,r.subcategoria,r.concepto,ing||'',eg||'',saldo,r.obs,r.comprobante]);
    });
    var wb=XLSX.utils.book_new();
    var ws=XLSX.utils.aoa_to_sheet(rows);
    ws['!cols']=[{wch:5},{wch:12},{wch:8},{wch:18},{wch:20},{wch:40},{wch:12},{wch:12},{wch:12},{wch:25},{wch:15}];
    XLSX.utils.book_append_sheet(wb,ws,'Caja Diaria');
    XLSX.writeFile(wb,'CARZE_Caja_Diaria_'+new Date().getFullYear()+'.xlsx');
    toast('Excel generado ✓','ok');
}
window.exportarExcel=exportarExcel;

function exportarPDF(){
    if(!datosFiltrados.length){toast('No hay datos para exportar','warn');return;}
    var ahora=new Date();
    var fechaStr=p2(ahora.getDate())+'/'+p2(ahora.getMonth()+1)+'/'+ahora.getFullYear()+'  '+p2(ahora.getHours())+':'+p2(ahora.getMinutes());
    var usuario=sessionStorage.getItem('carze_nombre')||'—';

    // Resumen de filtros activos (para dejar constancia de qué se exportó)
    var q=(document.getElementById('searchInput').value||'').trim();
    var mesSel=document.getElementById('filterMes');
    var mesTxt=mesSel.value?mesSel.options[mesSel.selectedIndex].text:'';
    var catSel=document.getElementById('filterCat');
    var catTxt=catSel.value?(catSel.options[catSel.selectedIndex].text):'';
    var tipoSel=document.getElementById('filterTipo').value;
    var tipoTxt=tipoSel==='ingreso'?'Solo ingresos':tipoSel==='egreso'?'Solo egresos':'';
    var desde=document.getElementById('filterFechaDesde').value;
    var hasta=document.getElementById('filterFechaHasta').value;
    var fechaTxt='';
    if(desde&&hasta) fechaTxt = desde===hasta ? ('Fecha: '+fmtF(desde)) : ('Del '+fmtF(desde)+' al '+fmtF(hasta));
    else if(desde) fechaTxt='Desde '+fmtF(desde);
    else if(hasta) fechaTxt='Hasta '+fmtF(hasta);
    var filtrosActivos=[mesTxt,catTxt,tipoTxt,fechaTxt,q?'Búsqueda: "'+q+'"':''].filter(Boolean);
    var filtrosTxt=filtrosActivos.length?filtrosActivos.join('  •  '):'Todos los movimientos registrados';

    var saldo=0,totIng=0,totEg=0;
    var filas=datosFiltrados.map(function(r,i){
        var ing=r.tipo==='ingreso'?parseFloat(r.monto)||0:0;
        var eg =r.tipo!=='ingreso'?parseFloat(r.monto)||0:0;
        saldo+=ing-eg; totIng+=ing; totEg+=eg;
        var catLabel=CAT_LABELS[r.categoria]||r.categoria||'—';
        var ic=ing?'color:#16a34a':'color:#cbd5e1';
        var ec=eg?'color:#dc2626':'color:#cbd5e1';
        var sc=saldo>=0?'color:#1e3a8a':'color:#dc2626';
        var bg=i%2===0?'#ffffff':'#f6f8fb';
        return '<tr style="background:'+bg+';page-break-inside:avoid;break-inside:avoid">'+
            '<td class="pdf-td" style="text-align:center;font-weight:700;color:#1a3a6b">'+(i+1)+'</td>'+
            '<td class="pdf-td" style="white-space:nowrap">'+fmtF(r.fecha)+'</td>'+
            '<td class="pdf-td">'+esc(catLabel)+'</td>'+
            '<td class="pdf-td">'+esc(r.subcategoria)+'</td>'+
            '<td class="pdf-td" style="word-break:break-word">'+esc(r.concepto)+'</td>'+
            '<td class="pdf-td" style="text-align:right;'+ic+';font-weight:700;white-space:nowrap">'+(ing?'S/ '+fmt(ing):'—')+'</td>'+
            '<td class="pdf-td" style="text-align:right;'+ec+';font-weight:700;white-space:nowrap">'+(eg?'S/ '+fmt(eg):'—')+'</td>'+
            '<td class="pdf-td" style="text-align:right;'+sc+';font-weight:800;white-space:nowrap">S/ '+fmt(saldo)+'</td>'+
            '<td class="pdf-td" style="font-size:6.4pt;word-break:break-word">'+esc(r.obs)+'</td>'+
            '<td class="pdf-td" style="font-size:6.4pt;word-break:break-word">'+esc(r.comprobante)+'</td>'+
        '</tr>';
    }).join('');

    document.getElementById('printArea').innerHTML=
        '<style>'+
            '#printArea *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}'+
            '#printArea table{width:100%;border-collapse:collapse;font-size:7.3pt;font-family:Arial,Helvetica,sans-serif}'+
            '#printArea thead{display:table-header-group}'+
            '#printArea tfoot{display:table-footer-group}'+
            '#printArea .pdf-td{padding:3.5px 5px;border-bottom:0.5px solid #e2e8f0;color:#1e293b;vertical-align:top}'+
            '#printArea .pdf-th{padding:6px 5px;text-align:left;color:#fff;font-size:7pt;font-weight:700;letter-spacing:.02em;text-transform:uppercase}'+
        '</style>'+
        '<div style="font-family:Arial,Helvetica,sans-serif;color:#1e293b">'+

            /* ── Encabezado (portada, una sola vez) ── */
            '<div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:8px;padding-bottom:8px;border-bottom:3px solid #1a3a6b">'+
                '<div style="display:flex;align-items:center;gap:10px">'+
                    '<div style="width:6px;align-self:stretch;background:linear-gradient(180deg,#f97316,#ea580c);border-radius:3px"></div>'+
                    '<div><div style="font-size:14pt;font-weight:800;color:#1a3a6b;line-height:1.15">CARZE Contratistas Generales S.A.C.</div>'+
                    '<div style="font-size:8.5pt;color:#64748b;margin-top:2px;font-weight:600;letter-spacing:.03em;text-transform:uppercase">Reporte de Caja Diaria</div></div>'+
                '</div>'+
                '<div style="text-align:right">'+
                    '<div style="font-size:8pt;font-weight:700;color:#1a3a6b">Generado: '+fechaStr+'</div>'+
                    '<div style="font-size:7.2pt;color:#64748b;margin-top:1px">Usuario: '+esc(usuario)+'</div>'+
                '</div>'+
            '</div>'+

            /* ── Barra de filtros aplicados ── */
            '<div style="display:flex;justify-content:space-between;align-items:center;background:#f1f5f9;border-radius:5px;padding:5px 10px;margin-bottom:8px;font-size:7pt;color:#475569">'+
                '<span><strong style="color:#1a3a6b">Filtros:</strong> '+esc(filtrosTxt)+'</span>'+
                '<span><strong style="color:#1a3a6b">'+datosFiltrados.length+'</strong> registro'+(datosFiltrados.length!==1?'s':'')+'</span>'+
            '</div>'+

            /* ── Tabla (encabezado se repite en cada hoja) ── */
            '<table>'+
            '<thead><tr style="background:#1a3a6b">'+
                '<th class="pdf-th" style="text-align:center;width:3%">N°</th>'+
                '<th class="pdf-th" style="width:7%">Fecha</th>'+
                '<th class="pdf-th" style="width:9%">Categoría</th>'+
                '<th class="pdf-th" style="width:11%">Subcategoría</th>'+
                '<th class="pdf-th" style="width:20%">Concepto</th>'+
                '<th class="pdf-th" style="text-align:right;width:8%">Ingreso</th>'+
                '<th class="pdf-th" style="text-align:right;width:8%">Egreso</th>'+
                '<th class="pdf-th" style="text-align:right;width:8%">Saldo</th>'+
                '<th class="pdf-th" style="width:13%">Observación</th>'+
                '<th class="pdf-th" style="width:13%">Comprobante</th>'+
            '</tr></thead>'+
            '<tfoot><tr><td colspan="10" style="padding:3px 2px 0;border-top:0.5px solid #e2e8f0"><div style="display:flex;justify-content:space-between;font-size:6pt;color:#94a3b8"><span>CARZE Contratistas Generales S.A.C. · Caja Diaria</span><span>'+fechaStr+'</span></div></td></tr></tfoot>'+
            '<tbody>'+filas+'</tbody>'+
            '</table>'+

            /* ── Resumen de totales (una sola vez, al final) ── */
            '<div style="page-break-inside:avoid;break-inside:avoid;margin-top:10px;display:flex;justify-content:flex-end">'+
                '<table style="width:260px;border-collapse:collapse;font-size:7.6pt">'+
                    '<tr><td style="padding:4px 8px;color:#64748b;font-weight:600">Total Ingresos</td><td style="padding:4px 8px;text-align:right;font-weight:800;color:#16a34a">S/ '+fmt(totIng)+'</td></tr>'+
                    '<tr><td style="padding:4px 8px;color:#64748b;font-weight:600">Total Egresos</td><td style="padding:4px 8px;text-align:right;font-weight:800;color:#dc2626">S/ '+fmt(totEg)+'</td></tr>'+
                    '<tr style="background:#1a3a6b"><td style="padding:6px 8px;color:#fff;font-weight:700;border-radius:4px 0 0 4px">SALDO FINAL</td><td style="padding:6px 8px;text-align:right;font-weight:800;color:'+(totIng-totEg>=0?'#4ade80':'#fca5a5')+';border-radius:0 4px 4px 0">S/ '+fmt(totIng-totEg)+'</td></tr>'+
                '</table>'+
            '</div>'+

            '<div style="margin-top:8px;font-size:6.3pt;color:#94a3b8;text-align:center">Documento generado automáticamente por el sistema CARZE — '+fechaStr+'</div>'+
        '</div>';
    window.print();
    setTimeout(function(){document.getElementById('printArea').innerHTML='';},1200);
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

// ── FILE UPLOAD HELPERS ───────────────────────────────────────
function onFileSelected(input){
    var file=input.files[0]; if(!file) return;
    if(file.size>5*1024*1024){toast('El archivo no debe superar 5 MB','err');input.value='';return;}
    archivoSeleccionado=file;
    document.getElementById('filePreviewName').textContent=file.name;
    document.getElementById('filePreview').style.display='flex';
    document.getElementById('fileUploadLbl').textContent='Archivo listo para subir';
    document.getElementById('mComprobante').value='';
}
window.onFileSelected=onFileSelected;

function removeFile(e){
    e.stopPropagation();
    archivoSeleccionado=null;
    document.getElementById('mComprobanteFile').value='';
    document.getElementById('filePreview').style.display='none';
    document.getElementById('fileUploadLbl').textContent='Subir imagen o PDF del comprobante';
}
window.removeFile=removeFile;

// ── VISOR COMPROBANTE ─────────────────────────────────────────
function abrirVisor(url,nombre){
    document.getElementById('visorTitulo').textContent=nombre||'Comprobante';
    document.getElementById('visorFname').textContent=nombre||'';
    document.getElementById('visorDl').href=url;
    document.getElementById('visorDl').download=nombre||'comprobante';
    var isImg=/\.(jpe?g|png|gif|webp|bmp|svg)(\?|$)/i.test(url)||/image\//i.test(nombre);
    var isPdf=/\.pdf(\?|$)/i.test(url)||/\.pdf$/i.test(nombre);
    var c=document.getElementById('visorContent');
    if(isImg){
        c.innerHTML='<img src="'+url+'" alt="Comprobante" class="visor-img">';
    } else {
        c.innerHTML='<a href="'+url+'" target="_blank" class="visor-pdf-btn">'+
            '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>'+
            (isPdf?'Abrir PDF en nueva pestaña':'Ver archivo adjunto')+'</a>';
    }
    document.getElementById('visorOv').classList.add('open');
}
window.abrirVisor=abrirVisor;

function cerrarVisor(){document.getElementById('visorOv').classList.remove('open');}
window.cerrarVisor=cerrarVisor;

document.addEventListener('keydown',function(e){if(e.key==='Escape'){cerrarModal();cerrarConfirm();cerrarVisor();}});
