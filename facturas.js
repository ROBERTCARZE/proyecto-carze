/* ==========================================================================
   FACTURAS.JS — Lógica del módulo de Facturas
   CARZE Contratistas Generales S.A.C.
   --------------------------------------------------------------------------
   Extraído de facturas.html tal cual estaba (mismo comportamiento, cero
   cambios de lógica) — tercer módulo separado, el más grande del sistema.
   ========================================================================== */
import { initializeApp }   from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";
import { getFirestore, collection, query, orderBy,
         onSnapshot, addDoc, updateDoc, deleteDoc, getDocs,
         doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";
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
const COL     = 'facturas';
const COL_COT  = 'cotizaciones';
const COL_CERT = 'certificados';
const COL_CLI  = 'clientes';

// Datos en memoria
var datosOC  = []; // todas las OC de cot + cert
var datosRef = []; // todas las cot + cert para referencia
var clientes = []; // colección clientes de Firestore
var refSeleccionadas = []; // chips de referencia seleccionados
var smModo = 'oc'; // 'oc' | 'ref'
var smFiltrados = [];

// Clientes base (precargados si Firestore está vacío)
const CLIENTES_BASE = [
    {nombre:'Sodimac',       razonSocial:'Tiendas del Mejoramiento del Hogar S.A.', ruc:'20112273922'},
    {nombre:'Maestro',       razonSocial:'Maestro Perú S.A.',                       ruc:'20337564373'},
    {nombre:'TopyTop',       razonSocial:'Trading Fashion Line S.A.',               ruc:'20501057682'},
    {nombre:'Footloose',     razonSocial:"Inversiones Rubin's S.A.C.",              ruc:'20427799973'},
    {nombre:'Falabella',     razonSocial:'Saga Falabella S.A.',                     ruc:'20100128056'},
    {nombre:'Tottus',        razonSocial:'Hipermercados Tottus S.A.',               ruc:'20508565934'},
    {nombre:'Open Plaza',    razonSocial:'Open Plaza S.A.',                         ruc:'20266409461'},
    {nombre:'Precio Uno',    razonSocial:'Precio Uno S.A.',                         ruc:'20602000001'},
    {nombre:'Oechsle',       razonSocial:'Tiendas Peruanas S.A.',                   ruc:'20493020618'},
    {nombre:'Oechsle Oriente',razonSocial:'Tiendas Peruanas Oriente S.A.C.',       ruc:'20600414276'},
    {nombre:'Samsung',       razonSocial:'Samsung Electronics Peru S.A.C.',         ruc:'20300263578'},
    {nombre:'Mall Plaza',    razonSocial:'Mall Plaza Perú S.A.C.',                  ruc:'20513669560'},
    {nombre:'Cheil Peru',    razonSocial:'Cheil Perú S.A.C.',                       ruc:'20602910696'},
    {nombre:'OL FM',         razonSocial:'Ol Facilities Management S.R.L.',         ruc:'20602579264'},
];

var datos=[],datosFiltrados=[],filaEdit=null,filaSelec=null;
var pagActual=1,tamPag=10,sortCol=null,sortAsc=true;
var uploadData={nombre:null,url:null};
var ncTipoActual=null;

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
    document.getElementById('fFechaEmision').value=hoy();
    cargarClientes();
    cargarOCyRef();
    iniciarListener();
});

function iniciarListener(){
    document.getElementById('tablaBody').innerHTML='<tr><td colspan="18" style="text-align:center;padding:28px;color:var(--muted);font-size:.8rem">⏳ Conectando...</td></tr>';
    const q=query(collection(db,COL),orderBy('num','asc'));
    onSnapshot(q,function(snap){
        datos=snap.docs.map(function(d){var r=d.data();r._id=d.id;return r;});
        verificarVencimientos();
        poblarFiltroMeses();
        aplicarFiltros(); // ya recalcula tabla + KPIs juntos, respetando el mes filtrado
    },function(err){toast('Error: '+err.message,'err');});
}

// ── HELPERS ───────────────────────────────────────────────────
function hoy(){var d=new Date();return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate());}
function p2(n){return n<10?'0'+n:String(n);}
function fmt(n){return parseFloat(n||0).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2});}
function esc(v){return(v!=null&&v!==''&&v!=='-')?String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'):'—';}
function fmtF(v){
    if(!v||v==='-'||v==='—') return '—';
    var s=String(v).trim();
    if(s.match(/^\d{4}-\d{2}-\d{2}/)){var p=s.substring(0,10).split('-');return p[2]+'/'+p[1]+'/'+p[0];}
    return s;
}
function normF(s){
    if(!s) return '';
    if(s.match(/^\d{4}-\d{2}-\d{2}/)) return s.substring(0,10);
    if(s.match(/^\d{2}\/\d{2}\/\d{4}/)){var p=s.split('/');return p[2]+'-'+p[1]+'-'+p[0];}
    return s;
}
function toast(msg,tipo){
    var t=document.getElementById('toast');
    t.textContent=msg;t.className='toast '+(tipo||'ok');t.classList.add('show');
    setTimeout(function(){t.classList.remove('show');},3200);
}

// ── VERIFICAR VENCIMIENTOS AUTOMÁTICO ────────────────────────
function verificarVencimientos(){
    var hoyStr=hoy();
    datos.forEach(function(r){
        if(r.estado==='Emitida'&&r.fechaVenc&&r.fechaVenc<hoyStr){
            // Auto-actualizar a Vencida en Firestore
            updateDoc(doc(db,COL,r._id),{estado:'Vencida',updatedAt:serverTimestamp()});
        }
    });
}

// ── DÍAS AL VENCIMIENTO ───────────────────────────────────────
function diasVenc(fechaVenc){
    if(!fechaVenc||fechaVenc==='-') return null;
    var hoyD=new Date(); hoyD.setHours(0,0,0,0);
    var vD=new Date(fechaVenc+'T00:00:00');
    return Math.round((vD-hoyD)/(1000*60*60*24));
}
function diasBadge(dias,estado){
    if(estado==='Cobrada'||estado==='Anulada') return '<span style="color:#94a3b8;font-size:.7rem">—</span>';
    if(dias===null) return '—';
    if(dias>15) return '<span class="dias-badge dias-ok">'+dias+' días</span>';
    if(dias>=0) return '<span class="dias-badge dias-warn">'+dias+' días</span>';
    return '<span class="dias-badge dias-late">'+Math.abs(dias)+' días vencida</span>';
}

// ── FILTROS ───────────────────────────────────────────────────
function aplicarFiltros(){
    var q=document.getElementById('searchInput').value.toLowerCase().trim();
    var est=document.getElementById('filterEstado').value;
    var mes=document.getElementById('filterMes').value; // formato 'YYYY-MM'
    if(!est) document.querySelectorAll('.sc').forEach(function(c){c.classList.remove('active-filter');});
    datosFiltrados=datos.filter(function(r){
        var mQ=!q||Object.values(r).some(function(v){return String(v).toLowerCase().includes(q);});
        var mE=!est||(r.estado||'').toLowerCase()===est.toLowerCase();
        var mM=!mes||String(r.fechaEmision||'').substring(0,7)===mes;
        return mQ&&mE&&mM;
    });
    if(sortCol) aplicarOrden();
    pagActual=1; renderTabla(datosFiltrados);

    // Las 4 tarjetas KPI muestran el desglose POR estado, así que se
    // recalculan con el mes (y la búsqueda) aplicados, pero SIN el filtro
    // de estado — si no, elegir "Cobrada" dejaría en S/0 a las otras 3.
    var datosParaKPI=datos.filter(function(r){
        var mQ=!q||Object.values(r).some(function(v){return String(v).toLowerCase().includes(q);});
        var mM=!mes||String(r.fechaEmision||'').substring(0,7)===mes;
        return mQ&&mM;
    });
    actualizarContadores(datosParaKPI);
}
window.aplicarFiltros=aplicarFiltros;

// Arma el selector de meses solo con los meses que realmente tienen
// facturas registradas (no una lista fija de 12 meses vacíos).
var MESES_LARGO=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
function poblarFiltroMeses(){
    var sel=document.getElementById('filterMes');
    var valorPrevio=sel.value;
    var mesesSet={};
    datos.forEach(function(r){
        var mk=String(r.fechaEmision||'').substring(0,7); // 'YYYY-MM'
        if(mk.match(/^\d{4}-\d{2}$/)) mesesSet[mk]=true;
    });
    var meses=Object.keys(mesesSet).sort().reverse(); // más reciente primero
    var html='<option value="">Todos los meses</option>';
    meses.forEach(function(mk){
        var p=mk.split('-');
        var label=MESES_LARGO[parseInt(p[1],10)-1]+' '+p[0];
        html+='<option value="'+mk+'">'+label+'</option>';
    });
    sel.innerHTML=html;
    if(meses.includes(valorPrevio)) sel.value=valorPrevio;
}

function filtrarPorEstado(estado,card){
    var sel=document.getElementById('filterEstado');
    if(sel.value===estado){sel.value='';}
    else{sel.value=estado;document.querySelectorAll('.sc').forEach(function(c){c.classList.remove('active-filter');});card.classList.add('active-filter');}
    aplicarFiltros();
}
window.filtrarPorEstado=filtrarPorEstado;

function ordenar(col){
    if(sortCol===col){sortAsc=!sortAsc;}else{sortCol=col;sortAsc=true;}
    document.querySelectorAll('.si').forEach(function(i){i.textContent='↕';});
    var ic=document.getElementById('si-'+col); if(ic) ic.textContent=sortAsc?'↑':'↓';
    aplicarOrden(); pagActual=1; renderTabla(datosFiltrados);
}
window.ordenar=ordenar;

function aplicarOrden(){
    datosFiltrados.sort(function(a,b){
        var va=a[sortCol]||'',vb=b[sortCol]||'';
        if(['subtotal','total','num','diasVenc'].includes(sortCol)){return sortAsc?parseFloat(va)-parseFloat(vb):parseFloat(vb)-parseFloat(va);}
        if(['fechaEmision','fechaVenc'].includes(sortCol)){va=normF(String(va));vb=normF(String(vb));}
        va=String(va).toLowerCase();vb=String(vb).toLowerCase();
        return sortAsc?va.localeCompare(vb):vb.localeCompare(va);
    });
}

// ── RENDER TABLA ─────────────────────────────────────────────
function renderTabla(data){
    var tbody=document.getElementById('tablaBody');
    var empty=document.getElementById('emptyState');
    var count=document.getElementById('tableCount');
    var pag=document.getElementById('paginacion');
    tbody.innerHTML='';
    if(!data||!data.length){empty.style.display='flex';count.textContent='0 registros';pag.style.display='none';return;}
    empty.style.display='none';
    count.textContent=data.length+' registro'+(data.length!==1?'s':'');
    var totalP=Math.ceil(data.length/tamPag);
    if(pagActual>totalP) pagActual=1;
    var ini=(pagActual-1)*tamPag,fin=Math.min(ini+tamPag,data.length);
    data.slice(ini,fin).forEach(function(row){
        var est=(row.estado||'').toLowerCase();
        var cls={emitida:'row-emitida',cobrada:'row-cobrada',anulada:'row-anulada',vencida:'row-vencida'}[est]||'';
        var dias=diasVenc(row.fechaVenc);
        var tr=document.createElement('tr');
        tr.className=cls; tr.dataset.docId=row._id;
        tr.onclick=function(e){if(!e.target.classList.contains('btn-del'))seleccionar(this,row._id);};

        var ncTxt='—';
        if(row.ncTipo&&row.ncTipo!=='-'){
            ncTxt='<span style="font-size:.68rem;font-weight:700;color:#9333ea">'+esc(row.ncTipo)+'</span>';
            if(row.ncImporte&&row.ncImporte!=='-') ncTxt+='<br><span style="font-size:.68rem;color:var(--muted)">S/ '+fmt(row.ncImporte)+'</span>';
            if(row.ncNumero&&row.ncNumero!=='-') ncTxt+='<br><span style="font-size:.65rem;color:var(--muted)">'+esc(row.ncNumero)+'</span>';
        }

        tr.innerHTML=
            '<td>'+esc(row.num)+'</td>'+
            '<td style="font-weight:700">'+esc(row.serie)+'-'+esc(row.numFact)+'</td>'+
            '<td>'+fmtF(row.fechaEmision)+'</td>'+
            '<td><span style="font-size:.7rem;background:var(--light);border:1px solid var(--border);padding:2px 7px;border-radius:20px">'+esc(row.condPago)+'</span></td>'+
            '<td>'+fmtF(row.fechaVenc)+'</td>'+
            '<td>'+diasBadge(dias,row.estado)+'</td>'+
            '<td>'+esc(row.ruc)+'</td>'+
            '<td style="max-width:150px;overflow:hidden;text-overflow:ellipsis">'+esc(row.razonSocial)+'</td>'+
            '<td style="max-width:120px;overflow:hidden;text-overflow:ellipsis;color:var(--azul2);font-size:.72rem">'+esc(row.ref)+'</td>'+
            '<td style="font-weight:700;color:var(--azul)">'+esc(row.oc)+'</td>'+
            '<td>S/ '+fmt(row.subtotal)+'</td>'+
            '<td>S/ '+fmt(row.igv)+'</td>'+
            '<td style="font-weight:700">S/ '+fmt(row.total)+'</td>'+
            '<td>S/ '+fmt(row.detraccion)+'</td>'+
            '<td style="font-weight:700;color:#16a34a">S/ '+fmt(row.ingresoNeto)+'</td>'+
            '<td>'+ncTxt+'</td>'+
            '<td>'+cellLink(row.factNombre,row.factLink)+'</td>'+
            '<td>'+pillEstado(row.estado,row.fechaPago)+'</td>'+
            '<td><button class="btn-del" onclick="pedirEliminar(\''+row._id+'\',\''+esc(row.serie)+'-'+esc(row.numFact)+'\')">🗑️</button></td>';
        tbody.appendChild(tr);
    });
    if(data.length>tamPag){pag.style.display='flex';document.getElementById('pagInfo').textContent='Mostrando '+(ini+1)+'-'+fin+' de '+data.length;renderPags(totalP);}
    else pag.style.display='none';
    filaSelec=null;
    document.getElementById('btnEditar').disabled=true;
    document.getElementById('btnNC').disabled=true;
}

function pillEstado(e,fechaPago){
    var k=(e||'').toLowerCase();
    var c={emitida:'emitida',cobrada:'cobrada',anulada:'anulada',vencida:'vencida'}[k]||'emitida';
    var check='';
    if(k==='cobrada'&&fechaPago&&fechaPago!=='-') check='<span class="pill-check" title="Cobro confirmado '+fmtF(fechaPago)+'">✓</span>';
    return '<span class="pill '+c+'"><span class="pill-dot"></span>'+esc(e)+'</span>'+check;
}

function renderPags(total){
    var c=document.getElementById('pagBtns');c.innerHTML='';
    var prev=document.createElement('button');
    prev.className='pag-btn';prev.textContent='‹';prev.disabled=pagActual===1;
    prev.onclick=function(){if(pagActual>1){pagActual--;renderTabla(datosFiltrados);}};c.appendChild(prev);
    var rng=[];
    for(var i=1;i<=total;i++){if(i===1||i===total||Math.abs(i-pagActual)<=2)rng.push(i);else if(rng[rng.length-1]!=='…')rng.push('…');}
    rng.forEach(function(p){
        if(p==='…'){var s=document.createElement('button');s.className='pag-btn';s.textContent='…';s.disabled=true;c.appendChild(s);return;}
        var b=document.createElement('button');b.className='pag-btn'+(p===pagActual?' active':'');b.textContent=p;
        b.onclick=(function(pp){return function(){pagActual=pp;renderTabla(datosFiltrados);};})(p);c.appendChild(b);
    });
    var next=document.createElement('button');
    next.className='pag-btn';next.textContent='›';next.disabled=pagActual===total;
    next.onclick=function(){if(pagActual<total){pagActual++;renderTabla(datosFiltrados);}};c.appendChild(next);
}
function cambiarTamano(val){tamPag=parseInt(val);pagActual=1;renderTabla(datosFiltrados);}
window.cambiarTamano=cambiarTamano;

function actualizarContadores(data){
    var e={emitida:{c:0,m:0,n:0},cobrada:{c:0,m:0,n:0},anulada:{c:0,m:0,n:0},vencida:{c:0,m:0,n:0}};
    data.forEach(function(r){
        var k=(r.estado||'').toLowerCase();
        if(e[k]){
            e[k].c++;
            e[k].m+=parseFloat(r.total)||0;
            // ingresoNeto: si la factura no tiene detracción registrada, el neto
            // es igual al total (no hay retención que descontar).
            e[k].n+=(r.ingresoNeto!=null && r.ingresoNeto!=='') ? (parseFloat(r.ingresoNeto)||0) : (parseFloat(r.total)||0);
        }
    });
    ['emitida','cobrada','anulada','vencida'].forEach(function(k){
        document.getElementById('cnt-'+k).textContent=e[k].c;
        document.getElementById('mnt-'+k).textContent='Neto: S/ '+fmt(e[k].n);
        document.getElementById('neto-'+k).innerHTML='Bruto: <b>S/ '+fmt(e[k].m)+'</b>';
    });
}

function seleccionar(tr,docId){
    document.querySelectorAll('#tablaBody tr').forEach(function(r){r.classList.remove('row-selected');});
    tr.classList.add('row-selected'); filaSelec=docId;
    document.getElementById('btnEditar').disabled=false;
    document.getElementById('btnNC').disabled=false;
}

// ── CÁLCULOS ─────────────────────────────────────────────────
function calcular(){
    var sub=parseFloat(document.getElementById('fSubTotal').value)||0;
    var cond=document.getElementById('fCondicion').value;
    var igv=Math.round(sub*0.18*100)/100;
    var total=Math.round((sub+igv)*100)/100;
    var det=0;
    if(cond==='Suministro') det=Math.round(total*0.03*100)/100;
    else if(cond==='Servicio') det=total>=700?Math.round(total*0.12):0;
    var neto=Math.round((total-det)*100)/100;
    document.getElementById('fIGV').value=fmt(igv);
    document.getElementById('fTotal').value=fmt(total);
    document.getElementById('fDetraccion').value=fmt(det);
    document.getElementById('fIngresoNeto').value=fmt(neto);
}
window.calcular=calcular;

function calcularVencimiento(){
    var fe=document.getElementById('fFechaEmision').value;
    var cond=document.getElementById('fCondPago').value;
    if(!fe||!cond||cond==='Contado'){document.getElementById('fFechaVenc').value=fe||'';return;}
    var dias=parseInt(cond)||0;
    var d=new Date(fe+'T00:00:00');
    d.setDate(d.getDate()+dias);
    document.getElementById('fFechaVenc').value=d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate());
}
window.calcularVencimiento=calcularVencimiento;

function genNum(){
    if(!datos.length){document.getElementById('fNum').value='001';return;}
    var max=Math.max.apply(null,datos.map(function(r){return parseInt(r.num)||0;}));
    document.getElementById('fNum').value=String(max+1).padStart(3,'0');
}

// ── NOTA DE CRÉDITO ───────────────────────────────────────────
function selNcTipo(tipo){
    ncTipoActual=tipo;
    document.getElementById('ncTipoFactoring').classList.toggle('selected',tipo==='Factoring');
    document.getElementById('ncTipoAnulacion').classList.toggle('selected',tipo==='Anulación');
    document.getElementById('ncImporteRow').style.display=tipo==='Factoring'?'block':'none';
    document.getElementById('ncTipoSelRow').style.display='block';
    document.getElementById('fNCTipo').value=tipo;
}
window.selNcTipo=selNcTipo;

// ── COBRO CONFIRMADO (fecha de pago / neto a cta. cte.) ───────
function toggleCobroBox(){
    var box=document.getElementById('cobroBox');
    var esCobrada=document.getElementById('fEstadoF').value==='Cobrada';
    box.style.display=esCobrada?'block':'none';
}
window.toggleCobroBox=toggleCobroBox;

function usarNetoCalculado(){
    var calc=document.getElementById('fIngresoNeto').value.replace(/,/g,'');
    document.getElementById('fNetoConfirmado').value=calc;
}
window.usarNetoCalculado=usarNetoCalculado;

function limpiarNC(){
    ncTipoActual=null;
    document.getElementById('ncTipoFactoring').classList.remove('selected');
    document.getElementById('ncTipoAnulacion').classList.remove('selected');
    document.getElementById('ncImporteRow').style.display='none';
    document.getElementById('ncTipoSelRow').style.display='none';
    document.getElementById('fNCTipo').value='';
    document.getElementById('fNCImporte').value='';
    document.getElementById('fNCNumero').value='';
}
window.limpiarNC=limpiarNC;

// ── UPLOAD ARCHIVO ────────────────────────────────────────────
function handleFile(event){
    var file=event.target.files[0]; if(!file) return;
    var ext=file.name.split('.').pop();
    var num=document.getElementById('fNum').value||'doc';
    var path='facturas/'+num+'_'+Date.now()+'.'+ext;
    var storRef=sRef(storage,path);
    document.getElementById('uname-factura').textContent=file.name;
    document.getElementById('uname-factura').style.display='block';
    document.getElementById('uprog-factura').style.display='block';
    var fill=document.getElementById('uprogfill-factura');
    var st=document.getElementById('ust-factura');
    st.style.color='var(--azul2)';st.textContent='Subiendo...';
    var task=uploadBytesResumable(storRef,file);
    task.on('state_changed',
        function(snap){fill.style.width=Math.round(snap.bytesTransferred/snap.totalBytes*100)+'%';},
        function(err){st.style.color='#dc2626';st.textContent='Error: '+err.message;},
        function(){
            getDownloadURL(task.snapshot.ref).then(function(url){
                uploadData={nombre:file.name,url:url};
                st.style.color='#16a34a';st.textContent='✓ Subido correctamente';
                var eDiv=document.getElementById('exist-factura');
                var eLink=document.getElementById('existlink-factura');
                eLink.href=url;eLink.textContent=file.name;eDiv.style.display='flex';
            });
        }
    );
}
window.handleFile=handleFile;

function removeFile(){
    uploadData={nombre:null,url:null};
    document.getElementById('exist-factura').style.display='none';
    document.getElementById('uname-factura').style.display='none';
    document.getElementById('uprog-factura').style.display='none';
    document.getElementById('ust-factura').textContent='';
    var inp=document.getElementById('box-factura').querySelector('input[type=file]');
    if(inp) inp.value='';
}
window.removeFile=removeFile;

// ── MODAL ─────────────────────────────────────────────────────
function abrirModal(){
    filaEdit=null; limpiar(); genNum();
    document.getElementById('fFechaEmision').value=hoy();
    document.getElementById('modalTitle').innerHTML='Nueva <span>Factura</span>';
    document.getElementById('btnGuardarTxt').textContent='INGRESAR';
    document.getElementById('overlay').classList.add('open');
}
window.abrirModal=abrirModal;

function editarSeleccionado(){
    if(!filaSelec) return;
    var row=datos.find(function(r){return r._id===filaSelec;}); if(!row) return;
    filaEdit=row._id; llenar(row);
    document.getElementById('modalTitle').innerHTML='Editar <span>Factura</span>';
    document.getElementById('btnGuardarTxt').textContent='ACTUALIZAR';
    document.getElementById('overlay').classList.add('open');
}
window.editarSeleccionado=editarSeleccionado;

function llenar(r){
    document.getElementById('fNum').value=r.num||'';
    document.getElementById('fSerie').value=r.serie||'';
    document.getElementById('fNumFact').value=r.numFact||'';
    document.getElementById('fFechaEmision').value=normF(String(r.fechaEmision||''));
    document.getElementById('fCondPago').value=r.condPago||'';
    document.getElementById('fFechaVenc').value=normF(String(r.fechaVenc||''));
    document.getElementById('fOC').value=r.oc&&r.oc!=='-'?r.oc:'';
    // Restore ref chips
    refSeleccionadas=[];
    if(r.ref&&r.ref!=='-'){
        r.ref.split(',').forEach(function(s){
            var t=s.trim();
            if(!t) return;
            var tipo=t.startsWith('CERT-')?'CERT':'COT';
            var num=t.replace('COT-','').replace('CERT-','');
            refSeleccionadas.push({ref:t,tipo:tipo,num:num,cliente:'',desc:''});
        });
    }
    renderRefChips();
    document.getElementById('fRef').value=r.ref&&r.ref!=='-'?r.ref:'';

    document.getElementById('fRUC').value=r.ruc||'';
    document.getElementById('fRazonSocial').value=r.razonSocial||'';
    document.getElementById('fCliente').value=r.cliente||'';
    document.getElementById('fEstadoF').value=r.estado||'';
    document.getElementById('fSubTotal').value=r.subtotal||'';
    document.getElementById('fCondicion').value=r.condicion||'';
    calcular();
    // Cobro confirmado
    document.getElementById('fFechaPago').value=r.fechaPago&&r.fechaPago!=='-'?normF(String(r.fechaPago)):'';
    document.getElementById('fNetoConfirmado').value=r.netoConfirmado&&r.netoConfirmado!=='-'?r.netoConfirmado:'';
    toggleCobroBox();
    // NC
    limpiarNC();
    if(r.ncTipo&&r.ncTipo!=='-'){
        selNcTipo(r.ncTipo);
        document.getElementById('fNCImporte').value=r.ncImporte&&r.ncImporte!=='-'?r.ncImporte:'';
        document.getElementById('fNCNumero').value=r.ncNumero&&r.ncNumero!=='-'?r.ncNumero:'';
    }
    // Archivo
    removeFile();
    if(r.factNombre&&r.factNombre!=='-'&&r.factLink&&r.factLink!=='-'){
        uploadData={nombre:r.factNombre,url:r.factLink};
        document.getElementById('existlink-factura').href=r.factLink;
        document.getElementById('existlink-factura').textContent=r.factNombre;
        document.getElementById('exist-factura').style.display='flex';
    }
}

function limpiar(){
    ['fNum','fSerie','fNumFact','fFechaEmision','fFechaVenc','fOC','fRef',
     'fRUC','fRazonSocial','fSubTotal','fIGV','fTotal','fDetraccion','fIngresoNeto',
     'fFechaPago','fNetoConfirmado']
     .forEach(function(id){document.getElementById(id).value='';});
    ['fCondPago','fCliente','fEstadoF','fCondicion'].forEach(function(id){document.getElementById(id).value='';});
    limpiarNC(); removeFile();
    refSeleccionadas=[];
    renderRefChips();
    toggleCobroBox();
}

function cerrarModal(){document.getElementById('overlay').classList.remove('open');}
window.cerrarModal=cerrarModal;
function overlayClick(e){if(e.target===document.getElementById('overlay'))cerrarModal();}
window.overlayClick=overlayClick;

// ── NOTA DE CRÉDITO MODAL RÁPIDO (desde tabla) ────────────────
function abrirNC(){
    if(!filaSelec) return;
    editarSeleccionado();
    // Scroll al NC box
    setTimeout(function(){
        var nc=document.getElementById('ncBox');
        if(nc) nc.scrollIntoView({behavior:'smooth',block:'center'});
    },400);
}
window.abrirNC=abrirNC;

// ── GUARDAR ───────────────────────────────────────────────────
async function guardar(){
    var serie=document.getElementById('fSerie').value.trim();
    var numFact=document.getElementById('fNumFact').value.trim();
    var fechaE=document.getElementById('fFechaEmision').value;
    var condPago=document.getElementById('fCondPago').value;
    var ruc=document.getElementById('fRUC').value.trim();
    var razonSocial=document.getElementById('fRazonSocial').value.trim();
    var estado=document.getElementById('fEstadoF').value;
    var sub=document.getElementById('fSubTotal').value;
    var cond=document.getElementById('fCondicion').value;
    var oc=document.getElementById('fOC').value.trim();

    if(!serie||!numFact||!fechaE||!condPago||!ruc||!razonSocial||!estado||!sub||!cond||!oc){
        toast('Completa todos los campos obligatorios (*)','err'); return;
    }

    var btn=document.getElementById('btnGuardar');
    var txt=document.getElementById('btnGuardarTxt');
    btn.disabled=true; txt.innerHTML='<span class="spinner"></span>';

    var igv=parseFloat(document.getElementById('fIGV').value.replace(/,/g,''))||0;
    var total=parseFloat(document.getElementById('fTotal').value.replace(/,/g,''))||0;
    var det=parseFloat(document.getElementById('fDetraccion').value.replace(/,/g,''))||0;
    var neto=parseFloat(document.getElementById('fIngresoNeto').value.replace(/,/g,''))||0;
    var fechaPago=document.getElementById('fFechaPago').value;
    var netoConfirmado=document.getElementById('fNetoConfirmado').value;

    if(estado==='Cobrada'&&(!fechaPago||!netoConfirmado)){
        btn.disabled=false; txt.textContent=filaEdit?'ACTUALIZAR':'INGRESAR';
        toast('Registra Fecha de Pago y Neto Ingresado para marcar como Cobrada','err'); return;
    }

    var docData={
        num:   document.getElementById('fNum').value,
        serie: serie, numFact: numFact,
        fechaEmision: fechaE,
        condPago: condPago,
        fechaVenc: document.getElementById('fFechaVenc').value||'-',
        oc: oc,
        ref: document.getElementById('fRef').value.trim()||'-',
        ruc: ruc, razonSocial: razonSocial,
        cliente: document.getElementById('fCliente').value||'-',
        estado: estado, condicion: cond,
        subtotal: parseFloat(sub)||0,
        igv: igv, total: total, detraccion: det, ingresoNeto: neto,
        fechaPago: fechaPago||'-',
        netoConfirmado: netoConfirmado?parseFloat(netoConfirmado):'-',
        ncTipo:    ncTipoActual||'-',
        ncImporte: document.getElementById('fNCImporte').value||'-',
        ncNumero:  document.getElementById('fNCNumero').value.trim()||'-',
        factNombre: uploadData.nombre||'-',
        factLink:   uploadData.url||'-',
        updatedAt: serverTimestamp()
    };

    try{
        if(filaEdit){
            await updateDoc(doc(db,COL,filaEdit),docData);
            toast('Factura actualizada ✓','ok');
        } else {
            docData.createdAt=serverTimestamp();
            await addDoc(collection(db,COL),docData);
            toast('Factura guardada ✓','ok');
        }
        btn.disabled=false; txt.textContent=filaEdit?'ACTUALIZAR':'INGRESAR';
        cerrarModal();
    } catch(err){
        btn.disabled=false; txt.textContent=filaEdit?'ACTUALIZAR':'INGRESAR';
        toast('Error: '+err.message,'err');
    }
}
window.guardar=guardar;

// ── ELIMINAR ─────────────────────────────────────────────────
var pendingDel=null;
function pedirEliminar(docId,nombre){
    pendingDel=docId;
    document.getElementById('confirmMsg').textContent='Se eliminará la factura "'+nombre+'". Esta acción no se puede deshacer.';
    document.getElementById('confirmOverlay').classList.add('open');
    document.getElementById('confirmOkBtn').onclick=ejecutarEliminar;
}
window.pedirEliminar=pedirEliminar;
function cerrarConfirm(){document.getElementById('confirmOverlay').classList.remove('open');pendingDel=null;}
window.cerrarConfirm=cerrarConfirm;
async function ejecutarEliminar(){
    if(!pendingDel) return; cerrarConfirm();
    try{await deleteDoc(doc(db,COL,pendingDel));toast('Factura eliminada','warn');}
    catch(err){toast('Error: '+err.message,'err');}
}

// ── PDF ───────────────────────────────────────────────────────
function generarPDF(){
    if(!datosFiltrados.length){toast('No hay registros para exportar','warn');return;}
    var ahora=new Date();
    var fs=p2(ahora.getDate())+'/'+p2(ahora.getMonth()+1)+'/'+ahora.getFullYear()+
           '  '+p2(ahora.getHours())+':'+p2(ahora.getMinutes())+':'+p2(ahora.getSeconds());
    document.getElementById('pdfFechaGen').textContent=fs;
    document.getElementById('pdfUsuarioGen').textContent='Usuario: '+(sessionStorage.getItem('carze_nombre')||'—');
    document.getElementById('pdfTotalReg').textContent='Total: '+datosFiltrados.length+' facturas';
    var e2={Emitida:{c:0,m:0},Cobrada:{c:0,m:0},Anulada:{c:0,m:0},Vencida:{c:0,m:0}};
    datosFiltrados.forEach(function(r){var k=r.estado||'';if(e2[k]){e2[k].c++;e2[k].m+=parseFloat(r.total)||0;}});
    var cols={Emitida:'#3b82f6',Cobrada:'#16a34a',Anulada:'#9333ea',Vencida:'#dc2626'};
    var res='';
    Object.keys(e2).forEach(function(k){
        res+='<div style="display:flex;align-items:center;gap:6px"><span style="width:8px;height:8px;border-radius:50%;background:'+cols[k]+';display:inline-block"></span>'+
             '<span style="font-size:7.5pt;font-weight:700;color:#1e293b">'+k+':</span>'+
             '<span style="font-size:7.5pt;color:#64748b">'+e2[k].c+' — S/ '+fmt(e2[k].m)+'</span></div>';
    });
    document.getElementById('pdfResumen').innerHTML=res;
    var pg=pagActual,tm=tamPag;
    tamPag=99999;pagActual=1;renderTabla(datosFiltrados);
    setTimeout(function(){window.print();tamPag=tm;pagActual=pg;renderTabla(datosFiltrados);},300);
}
window.generarPDF=generarPDF;


// ── CARGAR CLIENTES DESDE FIRESTORE ──────────────────────────
async function cargarClientes(){
    try {
        const snap = await getDocs(collection(db, COL_CLI));
        if(snap.empty){
            // Primera vez: sembrar clientes base en Firestore
            for(var cli of CLIENTES_BASE){
                await addDoc(collection(db, COL_CLI), cli);
            }
            clientes = [...CLIENTES_BASE];
        } else {
            clientes = snap.docs.map(function(d){var r=d.data();r._id=d.id;return r;});
        }
    } catch(e){
        clientes = [...CLIENTES_BASE];
    }
    poblarSelectCliente();
}

function poblarSelectCliente(){
    var sel = document.getElementById('fCliente');
    var valorActual = sel.value;
    sel.innerHTML = '<option value="">— Seleccionar (opcional) —</option>';
    clientes.sort(function(a,b){return a.nombre.localeCompare(b.nombre);});
    clientes.forEach(function(cli){
        var op = document.createElement('option');
        op.value = cli.nombre;
        op.textContent = cli.nombre;
        op.dataset.ruc = cli.ruc;
        op.dataset.razon = cli.razonSocial;
        sel.appendChild(op);
    });
    if(valorActual) sel.value = valorActual;
}

function autoRellenarCliente(){
    var sel = document.getElementById('fCliente');
    var op = sel.options[sel.selectedIndex];
    if(op && op.dataset.ruc){
        document.getElementById('fRUC').value = op.dataset.ruc;
        document.getElementById('fRazonSocial').value = op.dataset.razon;
    }
}
window.autoRellenarCliente = autoRellenarCliente;

// ── MODAL NUEVO CLIENTE ───────────────────────────────────────
function abrirModalCliente(){
    document.getElementById('ncNombre').value='';
    document.getElementById('ncRazonSocial').value='';
    document.getElementById('ncRUC').value='';
    document.getElementById('clienteOverlay').classList.add('open');
}
window.abrirModalCliente = abrirModalCliente;

function cerrarModalCliente(){
    document.getElementById('clienteOverlay').classList.remove('open');
}
window.cerrarModalCliente = cerrarModalCliente;

async function guardarCliente(){
    var nombre = document.getElementById('ncNombre').value.trim();
    var razon  = document.getElementById('ncRazonSocial').value.trim();
    var ruc    = document.getElementById('ncRUC').value.trim();
    if(!nombre||!razon||!ruc){ toast('Completa todos los datos del cliente','err'); return; }
    var btn = document.getElementById('ncBtnTxt');
    btn.innerHTML = '<span class="spinner"></span>';
    try {
        var newCli = {nombre:nombre, razonSocial:razon, ruc:ruc};
        var ref2 = await addDoc(collection(db, COL_CLI), newCli);
        newCli._id = ref2.id;
        clientes.push(newCli);
        poblarSelectCliente();
        document.getElementById('fCliente').value = nombre;
        document.getElementById('fRUC').value = ruc;
        document.getElementById('fRazonSocial').value = razon;
        toast('Cliente guardado correctamente ✓','ok');
        cerrarModalCliente();
    } catch(err){ toast('Error: '+err.message,'err'); }
    btn.textContent = 'GUARDAR CLIENTE';
}
window.guardarCliente = guardarCliente;

// ── CARGAR OC Y REF DESDE COT + CERT ─────────────────────────
async function cargarOCyRef(){
    try {
        const [snapCot, snapCert] = await Promise.all([
            getDocs(collection(db, COL_COT)),
            getDocs(collection(db, COL_CERT))
        ]);
        datosOC=[];datosRef=[];
        snapCot.docs.forEach(function(d){
            var r=d.data();
            // Ref: usar cotNombre (ej: DL-195-2025.pdf)
            if(r.cotNombre&&r.cotNombre!=='-')
                datosRef.push({cotNombre:r.cotNombre,cotLink:r.cotLink,num:r.num,tipo:'COT',cliente:r.cliente,desc:r.desc});
            // OC: usar ocNombre (ej: 6001686247.pdf)
            if(r.ocNombre&&r.ocNombre!=='-')
                datosOC.push({ocNombre:r.ocNombre,ocLink:r.ocLink,tipo:'COT',num:r.num,cliente:r.cliente});
        });
        snapCert.docs.forEach(function(d){
            var r=d.data();
            // Ref: usar cotNombre (campo cotización en certificados)
            if(r.cotNombre&&r.cotNombre!=='-')
                datosRef.push({cotNombre:r.cotNombre,cotLink:r.cotLink,num:r.num,tipo:'CERT',cliente:r.cliente,desc:r.desc});
            // OC: usar ocNombre
            if(r.ocNombre&&r.ocNombre!=='-')
                datosOC.push({ocNombre:r.ocNombre,ocLink:r.ocLink,tipo:'CERT',num:r.num,cliente:r.cliente});
        });
    } catch(e){ console.warn('Error cargando OC/Ref:',e); }
}

// ── BUSCADOR MODAL ────────────────────────────────────────────
function abrirBuscadorOC(){
    smModo='oc';
    document.getElementById('smTitle').innerHTML='Buscar <span>Orden de Compra</span>';
    document.getElementById('smSearchInput').value='';
    smFiltrados=[...datosOC];
    renderSmTabla();
    document.getElementById('searchOverlay').classList.add('open');
    setTimeout(function(){document.getElementById('smSearchInput').focus();},200);
}
window.abrirBuscadorOC = abrirBuscadorOC;

function abrirBuscadorRef(){
    smModo='ref';
    document.getElementById('smTitle').innerHTML='Buscar <span>Cotización / Certificado</span>';
    document.getElementById('smSearchInput').value='';
    smFiltrados=[...datosRef];
    renderSmTabla();
    document.getElementById('searchOverlay').classList.add('open');
    setTimeout(function(){document.getElementById('smSearchInput').focus();},200);
}
window.abrirBuscadorRef = abrirBuscadorRef;

function cerrarBuscador(){
    document.getElementById('searchOverlay').classList.remove('open');
}
window.cerrarBuscador = cerrarBuscador;

function filtrarBuscador(){
    var q=document.getElementById('smSearchInput').value.toLowerCase().trim();
    var src=smModo==='oc'?datosOC:datosRef;
    smFiltrados=q?src.filter(function(r){return Object.values(r).some(function(v){return String(v).toLowerCase().includes(q);});}):src;
    renderSmTabla();
}
window.filtrarBuscador = filtrarBuscador;

function renderSmTabla(){
    var thead=document.getElementById('smThead');
    var tbody=document.getElementById('smTbody');
    var empty=document.getElementById('smEmpty');
    var footer=document.getElementById('smFooter');
    tbody.innerHTML='';

    if(smModo==='oc'){
        thead.innerHTML='<tr><th>O.C.</th><th>Tipo</th><th>N° Ref</th><th>Cliente</th></tr>';
        if(!smFiltrados.length){empty.style.display='block';footer.textContent='';return;}
        empty.style.display='none';
        footer.textContent=smFiltrados.length+' orden'+(smFiltrados.length!==1?'es':'');
        smFiltrados.forEach(function(r){
            var tr=document.createElement('tr');
            tr.title='Click para seleccionar esta OC';
            tr.onclick=function(){
                document.getElementById('fOC').value=r.ocNombre;
                cerrarBuscador();
                toast('OC "'+r.ocNombre+'" seleccionada','ok');
            };
            var ocDisplay = (r.ocLink&&r.ocLink!=='-')
                ? '<a href="'+r.ocLink+'" target="_blank" rel="noopener" style="color:var(--azul2);font-weight:700;text-decoration:underline" onclick="event.stopPropagation()">'+esc(r.ocNombre)+'</a>'
                : '<span style="font-weight:700;color:var(--azul)">'+esc(r.ocNombre)+'</span>';
            tr.innerHTML=
                '<td>'+ocDisplay+'</td>'+
                '<td><span class="sm-tag '+(r.tipo==='COT'?'cot':'cert')+'">'+r.tipo+'</span></td>'+
                '<td>'+esc(r.num)+'</td>'+
                '<td>'+esc(r.cliente)+'</td>';
            tbody.appendChild(tr);
        });
    } else {
        thead.innerHTML='<tr><th>Cotización</th><th>Tipo</th><th>N° Ref</th><th>Cliente</th><th>Descripción</th></tr>';
        if(!smFiltrados.length){empty.style.display='block';footer.textContent='';return;}
        empty.style.display='none';
        footer.textContent=smFiltrados.length+' registro'+(smFiltrados.length!==1?'s':'');
        smFiltrados.forEach(function(r){
            var tr=document.createElement('tr');
            var prefijo=r.tipo==='COT'?'COT-':'CERT-';
            var refStr=r.cotNombre; // usar el nombre real: DL-195-2025.pdf
            tr.title='Click para agregar esta referencia';
            tr.onclick=function(){agregarRefChip(refStr,r.tipo,r.num,r.cliente,r.desc);};
            var cotDisplay = (r.cotLink&&r.cotLink!=='-')
                ? '<a href="'+r.cotLink+'" target="_blank" rel="noopener" style="color:var(--azul2);font-weight:700;text-decoration:underline" onclick="event.stopPropagation()">'+esc(r.cotNombre)+'</a>'
                : '<span style="font-weight:700;color:var(--azul)">'+esc(r.cotNombre)+'</span>';
            tr.innerHTML=
                '<td>'+cotDisplay+'</td>'+
                '<td><span class="sm-tag '+(r.tipo==='COT'?'cot':'cert')+'">'+r.tipo+'</span></td>'+
                '<td>'+esc(r.num)+'</td>'+
                '<td>'+esc(r.cliente)+'</td>'+
                '<td style="max-width:180px;overflow:hidden;text-overflow:ellipsis">'+esc(r.desc)+'</td>';
            tbody.appendChild(tr);
        });
    }
}

function pillEstado2(e){
    var map={pendiente:'#f59e0b',facturado:'#16a34a',anulado:'#9333ea',observado:'#dc2626',emitida:'#3b82f6',cobrada:'#16a34a',vencida:'#dc2626'};
    var k=(e||'').toLowerCase();
    var col=map[k]||'#64748b';
    return '<span style="font-size:.62rem;font-weight:700;padding:2px 8px;border-radius:20px;background:'+col+'22;color:'+col+';border:1px solid '+col+'44">'+esc(e)+'</span>';
}

// ── REF CHIPS ─────────────────────────────────────────────────
function agregarRefChip(refStr,tipo,num,cliente,desc){
    if(refSeleccionadas.find(function(r){return r.ref===refStr;})){
        toast('Ya fue agregada','warn'); return;
    }
    refSeleccionadas.push({ref:refStr,tipo:tipo,num:num,cliente:cliente,desc:desc});
    actualizarRefInput();
    renderRefChips();
    cerrarBuscador();
    toast(refStr+' agregada ✓','ok');
}

function actualizarRefInput(){
    document.getElementById('fRef').value=refSeleccionadas.map(function(r){return r.ref;}).join(', ');
}

function renderRefChips(){
    var cont=document.getElementById('refChips');
    cont.innerHTML='';
    refSeleccionadas.forEach(function(r,i){
        var span=document.createElement('span');
        span.className='ref-chip '+(r.tipo==='COT'?'cot':'cert');
        span.innerHTML=r.ref+'<span class="ref-chip-rm" onclick="quitarRef('+i+')">✕</span>';
        cont.appendChild(span);
    });
}

function quitarRef(i){
    refSeleccionadas.splice(i,1);
    actualizarRefInput();
    renderRefChips();
}
window.quitarRef = quitarRef;

// ── CLICKEABLE EN TABLA (links documentos) ────────────────────
function cellLink(nombre,link){
    if(!nombre||nombre==='-'||nombre==='—') return '<span style="color:#94a3b8">—</span>';
    if(link&&link!=='-'&&link!=='—')
        return '<a class="doc-link" href="'+String(link).replace(/"/g,'&quot;')+'" target="_blank" rel="noopener">'+
               String(nombre).replace(/</g,'&lt;')+'</a>';
    return String(nombre).replace(/</g,'&lt;');
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

document.addEventListener('keydown',function(e){if(e.key==='Escape'){cerrarModal();cerrarConfirm();cerrarBuscador();cerrarModalCliente();}});
