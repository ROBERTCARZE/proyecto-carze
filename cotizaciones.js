/* ==========================================================================
   COTIZACIONES.JS — Lógica del módulo de Cotizaciones
   CARZE Contratistas Generales S.A.C.
   --------------------------------------------------------------------------
   Extraído de cotizaciones.html tal cual estaba (mismo comportamiento, cero
   cambios de lógica) — décimo módulo separado.
   ========================================================================== */
import { initializeApp }    from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";
import { getFirestore, collection, query, orderBy,
         onSnapshot, addDoc, updateDoc, deleteDoc, getDocs,
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
const COL     = 'cotizaciones';
const COL_ZONAS = 'zonas';

var zonas = [];
const ZONAS_BASE = ['Cajamarca','Chiclayo','Pucallpa','Chepén','Pacasmayo','Piura','Sullana','Trujillo','Chulucanas','Chimbote','Ferreñafe','Huánuco'];

// ── ESTADO ────────────────────────────────────────────────────
var datos          = [];
var datosFiltrados = [];
var filaEdit       = null;
var filaSelec      = null;
var pagActual      = 1;
var tamPag         = 10;
var sortCol        = null;
var sortAsc        = true;
var uploadState    = {};

const DOC_FIELDS = [
    {key:'cot',  emoji:'📋', label:'Cotización',           hint:'Ej: EG07-167'},
    {key:'inf',  emoji:'📄', label:'Informe',              hint:'Nombre del informe'},
    {key:'acta', emoji:'✅', label:'Acta',                 hint:'Nombre del acta'},
    {key:'guia', emoji:'🚚', label:'Guía',                 hint:'Nombre de la guía'},
    {key:'oc',   emoji:'🛒', label:'Orden de Compra (OC)', hint:'Nombre de la OC'},
    {key:'fact', emoji:'🧾', label:'Factura',              hint:'Nombre de la factura'},
];

// ── SESIÓN ────────────────────────────────────────────────────
(function(){
    if(sessionStorage.getItem('carze_logged')!=='true') window.location.replace('index.html');
})();

window.addEventListener('DOMContentLoaded', function(){
    var nombre = sessionStorage.getItem('carze_nombre') || 'Usuario';
    document.getElementById('userName').textContent  = nombre;
    document.getElementById('avatarInitials').textContent =
        nombre.split(' ').map(function(p){return p[0]||'';}).slice(0,2).join('').toUpperCase() || 'U';
    document.getElementById('fFecha').value = hoy();
    cargarZonas();
    buildDocFields();
    iniciarListener();
});

// ── LISTENER TIEMPO REAL ──────────────────────────────────────
function iniciarListener(){
    document.getElementById('tablaBody').innerHTML =
        '<tr><td colspan="15" style="text-align:center;padding:28px;color:var(--muted);font-size:.8rem">⏳ Conectando...</td></tr>';
    const q = query(collection(db, COL), orderBy('num','asc'));
    onSnapshot(q, function(snap){
        datos = snap.docs.map(function(d){ var r=d.data(); r._id=d.id; return r; });
        actualizarContadores(datos);
        poblarFiltroMeses();
        aplicarFiltros();
    }, function(err){ toast('Error: '+err.message,'err'); });
}

// ── HELPERS ───────────────────────────────────────────────────
function hoy(){var d=new Date();return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate());}
function p2(n){return n<10?'0'+n:String(n);}
function fmt(n){return parseFloat(n||0).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2});}
function esc(v){return(v!=null&&v!==''&&v!=='-'&&v!=='—')?String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'):'—';}
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
    t.textContent=msg; t.className='toast '+(tipo||'ok'); t.classList.add('show');
    setTimeout(function(){t.classList.remove('show');},3200);
}
function docLink(nombre,link){
    if(!nombre||nombre==='-'||nombre==='—') return '<span style="color:#94a3b8">—</span>';
    if(link&&link!=='-'&&link!=='—')
        return '<a class="doc-link" href="'+String(link).replace(/"/g,'&quot;')+'" target="_blank" rel="noopener">'+
               String(nombre).replace(/</g,'&lt;')+'</a>';
    return String(nombre).replace(/</g,'&lt;');
}
function pillEstado(e){
    var k=(e||'').toLowerCase();
    var c={pendiente:'pendiente',facturado:'facturado',anulado:'anulado',observado:'observado'}[k]||'pendiente';
    return '<span class="pill '+c+'"><span class="pill-dot"></span>'+esc(e)+'</span>';
}

// ── FILTROS ───────────────────────────────────────────────────
function aplicarFiltros(){
    var q  = document.getElementById('searchInput').value.toLowerCase().trim();
    var est= document.getElementById('filterEstado').value;
    var mes= document.getElementById('filterMes').value; // 'YYYY-MM'
    if(!est) document.querySelectorAll('.sc').forEach(function(c){c.classList.remove('active-filter');});
    datosFiltrados = datos.filter(function(r){
        var mQ = !q||Object.values(r).some(function(v){return String(v).toLowerCase().includes(q);});
        var mE = !est||(r.estado||'').toLowerCase()===est.toLowerCase();
        var mM = !mes||String(r.fecha||'').substring(0,7)===mes;
        return mQ&&mE&&mM;
    });
    if(sortCol) aplicarOrden();
    pagActual=1; renderTabla(datosFiltrados);
}
window.aplicarFiltros = aplicarFiltros;

// Arma el selector solo con los meses que realmente tienen registros.
var MESES_LARGO=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
function poblarFiltroMeses(){
    var sel=document.getElementById('filterMes');
    var valorPrevio=sel.value;
    var mesesSet={};
    datos.forEach(function(r){
        var mk=String(r.fecha||'').substring(0,7);
        if(mk.match(/^\d{4}-\d{2}$/)) mesesSet[mk]=true;
    });
    var meses=Object.keys(mesesSet).sort().reverse();
    var html='<option value="">Todos los meses</option>';
    meses.forEach(function(mk){
        var p=mk.split('-');
        html+='<option value="'+mk+'">'+MESES_LARGO[parseInt(p[1],10)-1]+' '+p[0]+'</option>';
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
window.filtrarPorEstado = filtrarPorEstado;

function ordenar(col){
    if(sortCol===col){sortAsc=!sortAsc;}else{sortCol=col;sortAsc=true;}
    document.querySelectorAll('.sort-icon').forEach(function(i){i.textContent='↕';});
    var ic=document.getElementById('sort-'+col); if(ic) ic.textContent=sortAsc?'↑':'↓';
    aplicarOrden(); pagActual=1; renderTabla(datosFiltrados);
}
window.ordenar = ordenar;

function aplicarOrden(){
    datosFiltrados.sort(function(a,b){
        var va=a[sortCol]||'',vb=b[sortCol]||'';
        if(sortCol==='subtotal'){return sortAsc?parseFloat(va)-parseFloat(vb):parseFloat(vb)-parseFloat(va);}
        if(sortCol==='num'){return sortAsc?parseInt(va)-parseInt(vb):parseInt(vb)-parseInt(va);}
        if(sortCol==='fecha'){va=normF(String(va));vb=normF(String(vb));}
        va=String(va).toLowerCase();vb=String(vb).toLowerCase();
        return sortAsc?va.localeCompare(vb):vb.localeCompare(va);
    });
}

// ── RENDER TABLA ──────────────────────────────────────────────
function renderTabla(data){
    var tbody=document.getElementById('tablaBody');
    var empty=document.getElementById('emptyState');
    var count=document.getElementById('tableCount');
    var pag  =document.getElementById('paginacion');
    tbody.innerHTML='';
    if(!data||!data.length){empty.style.display='flex';count.textContent='0 registros';pag.style.display='none';return;}
    empty.style.display='none';
    count.textContent=data.length+' registro'+(data.length!==1?'s':'');
    var totalP=Math.ceil(data.length/tamPag);
    if(pagActual>totalP) pagActual=1;
    var ini=(pagActual-1)*tamPag, fin=Math.min(ini+tamPag,data.length);
    data.slice(ini,fin).forEach(function(row){
        var est=(row.estado||'').toLowerCase();
        var cls={pendiente:'row-pendiente',facturado:'row-facturado',anulado:'row-anulado',observado:'row-observado'}[est]||'';
        var tr=document.createElement('tr');
        tr.className=cls; tr.dataset.docId=row._id;
        tr.onclick=function(e){if(!e.target.classList.contains('btn-del'))seleccionar(this,row._id);};
        tr.innerHTML=
            '<td>'+esc(row.num)+'</td>'+
            '<td>'+fmtF(row.fecha)+'</td>'+
            '<td>'+esc(row.zona)+'</td>'+
            '<td>'+esc(row.cliente)+'</td>'+
            '<td style="white-space:normal;min-width:180px" title="'+(row.desc||'')+'">'+esc(row.desc)+'</td>'+
            '<td>'+docLink(row.cotNombre,row.cotLink)+'</td>'+
            '<td>'+docLink(row.infNombre,row.infLink)+'</td>'+
            '<td>'+docLink(row.actaNombre,row.actaLink)+'</td>'+
            '<td>'+docLink(row.guiaNombre,row.guiaLink)+'</td>'+
            '<td>'+docLink(row.ocNombre,row.ocLink)+'</td>'+
            '<td>'+esc(row.hes)+'</td>'+
            '<td>'+docLink(row.factNombre,row.factLink)+'</td>'+
            '<td>S/ '+fmt(row.subtotal)+'</td>'+
            '<td>'+pillEstado(row.estado)+'</td>'+
            '<td><button class="btn-del" onclick="pedirEliminar(\''+row._id+'\',\''+esc(row.cliente)+'\')">🗑️</button></td>';
        tbody.appendChild(tr);
    });
    if(data.length>tamPag){
        pag.style.display='flex';
        document.getElementById('pagInfo').textContent='Mostrando '+(ini+1)+'-'+fin+' de '+data.length;
        renderPags(totalP);
    } else { pag.style.display='none'; }
    filaSelec=null; document.getElementById('btnEditar').disabled=true;
}

function renderPags(total){
    var c=document.getElementById('pagBtns'); c.innerHTML='';
    var prev=document.createElement('button');
    prev.className='pag-btn';prev.textContent='‹';prev.disabled=pagActual===1;
    prev.onclick=function(){if(pagActual>1){pagActual--;renderTabla(datosFiltrados);}};
    c.appendChild(prev);
    var rng=[];
    for(var i=1;i<=total;i++){
        if(i===1||i===total||Math.abs(i-pagActual)<=2) rng.push(i);
        else if(rng[rng.length-1]!=='…') rng.push('…');
    }
    rng.forEach(function(p){
        if(p==='…'){var s=document.createElement('button');s.className='pag-btn';s.textContent='…';s.disabled=true;c.appendChild(s);return;}
        var b=document.createElement('button');
        b.className='pag-btn'+(p===pagActual?' active':'');b.textContent=p;
        b.onclick=(function(pp){return function(){pagActual=pp;renderTabla(datosFiltrados);};})(p);
        c.appendChild(b);
    });
    var next=document.createElement('button');
    next.className='pag-btn';next.textContent='›';next.disabled=pagActual===total;
    next.onclick=function(){if(pagActual<total){pagActual++;renderTabla(datosFiltrados);}};
    c.appendChild(next);
}

function cambiarTamano(val){tamPag=parseInt(val);pagActual=1;renderTabla(datosFiltrados);}
window.cambiarTamano = cambiarTamano;

function actualizarContadores(data){
    var e={pendiente:{c:0,m:0},facturado:{c:0,m:0},anulado:{c:0,m:0},observado:{c:0,m:0}};
    data.forEach(function(r){var k=(r.estado||'').toLowerCase();if(e[k]){e[k].c++;e[k].m+=parseFloat(r.subtotal)||0;}});
    ['pendiente','facturado','anulado','observado'].forEach(function(k){
        document.getElementById('cnt-'+k).textContent=e[k].c;
        document.getElementById('mnt-'+k).textContent='S/ '+fmt(e[k].m);
    });
}

function seleccionar(tr,docId){
    document.querySelectorAll('#tablaBody tr').forEach(function(r){r.classList.remove('row-selected');});
    tr.classList.add('row-selected'); filaSelec=docId;
    document.getElementById('btnEditar').disabled=false;
}

// ── GESTIÓN DOCUMENTAL ────────────────────────────────────────
function buildDocFields(){
    var cont=document.getElementById('docFields'); if(!cont) return;
    cont.innerHTML='';
    DOC_FIELDS.forEach(function(f){
        var d=document.createElement('div');
        d.className='doc-section'; d.style.marginBottom='10px';
        d.innerHTML=
            '<div class="doc-section-label"><span>'+f.emoji+'</span>'+f.label+'</div>'+
            '<div class="upload-box" id="box-'+f.key+'">'+
                '<input type="file" accept=".pdf,.png,.jpg,.jpeg" onchange="handleFile(event,\''+f.key+'\')">'+
                '<div class="upload-label">'+
                    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>'+
                    '<span>Click para subir PDF</span>'+
                '</div>'+
                '<div class="upload-name" id="uname-'+f.key+'" style="display:none;font-size:.71rem;color:var(--azul2);font-weight:600;margin-top:3px"></div>'+
                '<div class="upload-prog" id="uprog-'+f.key+'" style="display:none;height:3px;background:var(--border);border-radius:3px;margin-top:5px;overflow:hidden">'+
                    '<div id="uprogfill-'+f.key+'" style="height:100%;background:linear-gradient(90deg,var(--azul),var(--naranja));border-radius:3px;width:0%;transition:width .2s"></div>'+
                '</div>'+
                '<div id="ust-'+f.key+'" style="font-size:.62rem;margin-top:2px"></div>'+
            '</div>'+
            '<div id="exist-'+f.key+'" style="display:none;font-size:.68rem;color:var(--azul2);margin-top:4px;align-items:center;gap:5px">'+
                '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>'+
                '<a id="existlink-'+f.key+'" href="#" target="_blank" rel="noopener" style="color:var(--azul2);text-decoration:underline;max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></a>'+
                '<span onclick="removeDoc(\''+f.key+'\')" style="cursor:pointer;color:#dc2626;font-size:.65rem;margin-left:auto;padding:1px 6px;border:1px solid #fecaca;border-radius:4px;background:#fff1f2">✕ Quitar</span>'+
            '</div>';
        cont.appendChild(d);
    });
}

function handleFile(event, key){
    var file=event.target.files[0]; if(!file) return;
    var ext=file.name.split('.').pop();
    var num=document.getElementById('fNum').value||'doc';
    var path='cotizaciones/'+num+'_'+key+'_'+Date.now()+'.'+ext;
    var storRef=sRef(storage,path);
    document.getElementById('uname-'+key).textContent=file.name;
    document.getElementById('uname-'+key).style.display='block';
    document.getElementById('uprog-'+key).style.display='block';
    var fill=document.getElementById('uprogfill-'+key);
    var st=document.getElementById('ust-'+key);
    st.style.color='var(--azul2)'; st.textContent='Subiendo...';
    var task=uploadBytesResumable(storRef,file);
    task.on('state_changed',
        function(snap){fill.style.width=Math.round(snap.bytesTransferred/snap.totalBytes*100)+'%';},
        function(err){st.style.color='#dc2626';st.textContent='Error: '+err.message;},
        function(){
            getDownloadURL(task.snapshot.ref).then(function(url){
                uploadState[key]={nombre:file.name,url:url};
                st.style.color='#16a34a'; st.textContent='✓ Subido correctamente';
                var eDiv=document.getElementById('exist-'+key);
                var eLink=document.getElementById('existlink-'+key);
                eLink.href=url; eLink.textContent=file.name;
                eDiv.style.display='flex';
            });
        }
    );
}
window.handleFile = handleFile;

function removeDoc(key){
    delete uploadState[key];
    document.getElementById('exist-'+key).style.display='none';
    document.getElementById('uname-'+key).style.display='none';
    document.getElementById('uprog-'+key).style.display='none';
    document.getElementById('ust-'+key).textContent='';
    var inp=document.getElementById('box-'+key).querySelector('input[type=file]');
    if(inp) inp.value='';
}
window.removeDoc = removeDoc;

function resetDocs(){uploadState={};DOC_FIELDS.forEach(function(f){removeDoc(f.key);});}

function cargarDocsExistentes(row){
    resetDocs();
    DOC_FIELDS.forEach(function(f){
        var nombre=row[f.key+'Nombre'], url=row[f.key+'Link'];
        if(nombre&&nombre!=='-'&&url&&url!=='-'){
            uploadState[f.key]={nombre:nombre,url:url};
            var eDiv=document.getElementById('exist-'+f.key);
            var eLink=document.getElementById('existlink-'+f.key);
            if(eDiv&&eLink){eLink.href=url;eLink.textContent=nombre;eDiv.style.display='flex';}
        }
    });
}

function gDoc(key){return(uploadState[key]&&uploadState[key].nombre)?uploadState[key].nombre:'-';}
function gLink(key){return(uploadState[key]&&uploadState[key].url)?uploadState[key].url:'-';}

// ── CÁLCULOS ──────────────────────────────────────────────────
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
window.calcular = calcular;

function genNum(){
    if(!datos.length){document.getElementById('fNum').value='001';return;}
    var max=Math.max.apply(null,datos.map(function(r){return parseInt(r.num)||0;}));
    document.getElementById('fNum').value=String(max+1).padStart(3,'0');
}

// ── MODAL ─────────────────────────────────────────────────────
function abrirModal(){
    filaEdit=null; limpiar(); resetDocs(); genNum();
    document.getElementById('fFecha').value=hoy();
    document.getElementById('modalTitle').innerHTML='Nueva <span>Cotización</span>';
    document.getElementById('btnGuardarTxt').textContent='INGRESAR';
    document.getElementById('overlay').classList.add('open');
}
window.abrirModal = abrirModal;

function editarSeleccionado(){
    if(!filaSelec) return;
    var row=datos.find(function(r){return r._id===filaSelec;}); if(!row) return;
    filaEdit=row._id; llenar(row);
    document.getElementById('modalTitle').innerHTML='Editar <span>Cotización</span>';
    document.getElementById('btnGuardarTxt').textContent='ACTUALIZAR';
    document.getElementById('overlay').classList.add('open');
    cargarDocsExistentes(row); calcular();
}
window.editarSeleccionado = editarSeleccionado;

function llenar(r){
    document.getElementById('fNum').value     =r.num||'';
    document.getElementById('fFecha').value   =normF(String(r.fecha||''));
    document.getElementById('fDesc').value    =r.desc||'';
    document.getElementById('fCliente').value =r.cliente||'';
    document.getElementById('fZona').value    =r.zona||'';
    document.getElementById('fEstado').value  =r.estado||'';
    document.getElementById('fHES').value     =r.hes&&r.hes!=='-'?r.hes:'';
    document.getElementById('fSubTotal').value=r.subtotal||'';
    document.getElementById('fCondicion').value='';
}

function limpiar(){
    ['fNum','fFecha','fDesc','fHES','fSubTotal','fIGV','fTotal','fDetraccion','fIngresoNeto']
        .forEach(function(id){document.getElementById(id).value='';});
    ['fCliente','fZona','fEstado','fCondicion']
        .forEach(function(id){document.getElementById(id).value='';});
}

function cerrarModal(){document.getElementById('overlay').classList.remove('open');}
window.cerrarModal = cerrarModal;
function overlayClick(e){if(e.target===document.getElementById('overlay'))cerrarModal();}
window.overlayClick = overlayClick;

// ── GUARDAR ───────────────────────────────────────────────────
async function guardar(){
    var fecha  =document.getElementById('fFecha').value;
    var desc   =document.getElementById('fDesc').value.trim();
    var cliente=document.getElementById('fCliente').value;
    var zona   =document.getElementById('fZona').value;
    var estado =document.getElementById('fEstado').value;
    var sub    =document.getElementById('fSubTotal').value;
    var cond   =document.getElementById('fCondicion').value;
    if(!fecha||!desc||!cliente||!zona||!estado||!sub||!cond){
        toast('Completa todos los campos obligatorios (*)','err'); return;
    }
    var btn=document.getElementById('btnGuardar');
    var txt=document.getElementById('btnGuardarTxt');
    btn.disabled=true; txt.innerHTML='<span class="spinner"></span>';
    var docData={
        num:       document.getElementById('fNum').value,
        fecha:fecha, zona:zona, cliente:cliente, desc:desc,
        cotNombre: gDoc('cot'),  cotLink:  gLink('cot'),
        infNombre: gDoc('inf'),  infLink:  gLink('inf'),
        actaNombre:gDoc('acta'), actaLink: gLink('acta'),
        guiaNombre:gDoc('guia'), guiaLink: gLink('guia'),
        ocNombre:  gDoc('oc'),   ocLink:   gLink('oc'),
        hes:       document.getElementById('fHES').value.trim()||'-',
        factNombre:gDoc('fact'), factLink: gLink('fact'),
        subtotal:  parseFloat(sub)||0,
        estado:estado, updatedAt:serverTimestamp()
    };
    try{
        if(filaEdit){
            await updateDoc(doc(db,COL,filaEdit),docData);
            toast('Cotización actualizada ✓','ok');
        } else {
            docData.createdAt=serverTimestamp();
            await addDoc(collection(db,COL),docData);
            toast('Cotización guardada ✓','ok');
        }
        btn.disabled=false; txt.textContent=filaEdit?'ACTUALIZAR':'INGRESAR';
        cerrarModal();
    } catch(err){
        btn.disabled=false; txt.textContent=filaEdit?'ACTUALIZAR':'INGRESAR';
        toast('Error: '+err.message,'err');
    }
}
window.guardar = guardar;

// ── ELIMINAR ──────────────────────────────────────────────────
var pendingDel=null;
function pedirEliminar(docId,cliente){
    pendingDel=docId;
    document.getElementById('confirmMsg').textContent='Se eliminará la cotización de "'+cliente+'". Esta acción no se puede deshacer.';
    document.getElementById('confirmOverlay').classList.add('open');
    document.getElementById('confirmOkBtn').onclick=ejecutarEliminar;
}
window.pedirEliminar = pedirEliminar;
function cerrarConfirm(){document.getElementById('confirmOverlay').classList.remove('open');pendingDel=null;}
window.cerrarConfirm = cerrarConfirm;
async function ejecutarEliminar(){
    if(!pendingDel) return; cerrarConfirm();
    try{await deleteDoc(doc(db,COL,pendingDel));toast('Cotización eliminada','warn');}
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
    document.getElementById('pdfTotalRegistros').textContent='Total: '+datosFiltrados.length+' registros';
    var e2={Pendiente:{c:0,m:0},Facturado:{c:0,m:0},Anulado:{c:0,m:0},Observado:{c:0,m:0}};
    datosFiltrados.forEach(function(r){var k=r.estado||'';if(e2[k]){e2[k].c++;e2[k].m+=parseFloat(r.subtotal)||0;}});
    var cols={Pendiente:'#f59e0b',Facturado:'#16a34a',Anulado:'#9333ea',Observado:'#dc2626'};
    var res='';
    Object.keys(e2).forEach(function(k){
        res+='<div style="display:flex;align-items:center;gap:6px"><span style="width:8px;height:8px;border-radius:50%;background:'+cols[k]+';display:inline-block"></span>'+
             '<span style="font-size:7.5pt;font-weight:700;color:#1e293b">'+k+':</span>'+
             '<span style="font-size:7.5pt;color:#64748b">'+e2[k].c+' — S/ '+fmt(e2[k].m)+'</span></div>';
    });
    document.getElementById('pdfResumen').innerHTML=res;
    var pg=pagActual, tm=tamPag;
    tamPag=99999; pagActual=1; renderTabla(datosFiltrados);
    setTimeout(function(){window.print();tamPag=tm;pagActual=pg;renderTabla(datosFiltrados);},300);
}
window.generarPDF = generarPDF;


// ── ZONAS ─────────────────────────────────────────────────────
async function cargarZonas(){
    try {
        const snap = await getDocs(collection(db, COL_ZONAS));
        if(snap.empty){
            for(var z of ZONAS_BASE){
                await addDoc(collection(db, COL_ZONAS), {nombre:z});
            }
            zonas = [...ZONAS_BASE];
        } else {
            zonas = snap.docs.map(function(d){return d.data().nombre;});
            zonas.sort();
        }
    } catch(e){ zonas = [...ZONAS_BASE]; }
    poblarSelectZona();
}

function poblarSelectZona(){
    var sel = document.getElementById('fZona');
    var valorActual = sel.value;
    sel.innerHTML = '<option value="">— Seleccionar —</option>';
    zonas.forEach(function(z){
        var op = document.createElement('option');
        op.value = z; op.textContent = z;
        sel.appendChild(op);
    });
    if(valorActual) sel.value = valorActual;
}

function abrirModalZona(){
    document.getElementById('zonaInput').value = '';
    var overlay = document.getElementById('zonaOverlay');
    var modal   = document.getElementById('zonaModal');
    overlay.style.opacity='1'; overlay.style.pointerEvents='all';
    modal.style.transform='translateY(0) scale(1)';
    modal.style.opacity='1';
    setTimeout(function(){ document.getElementById('zonaInput').focus(); }, 200);
}
window.abrirModalZona = abrirModalZona;

function cerrarModalZona(){
    var overlay = document.getElementById('zonaOverlay');
    var modal   = document.getElementById('zonaModal');
    overlay.style.opacity='0'; overlay.style.pointerEvents='none';
    modal.style.opacity='0'; modal.style.transform='translateY(20px) scale(.97)';
}
window.cerrarModalZona = cerrarModalZona;

async function guardarZona(){
    var nombre = document.getElementById('zonaInput').value.trim();
    if(!nombre){ toast('Escribe el nombre de la zona','err'); return; }
    if(zonas.map(function(z){return z.toLowerCase();}).includes(nombre.toLowerCase())){
        toast('Esa zona ya existe','warn'); return;
    }
    var btn = document.getElementById('zonaBtnTxt');
    btn.innerHTML = '<span class="spinner"></span>';
    try {
        await addDoc(collection(db, COL_ZONAS), {nombre: nombre});
        zonas.push(nombre); zonas.sort();
        poblarSelectZona();
        document.getElementById('fZona').value = nombre;
        toast('Zona "'+nombre+'" agregada ✓','ok');
        cerrarModalZona();
    } catch(err){ toast('Error: '+err.message,'err'); }
    btn.textContent = 'GUARDAR ZONA';
}
window.guardarZona = guardarZona;

function cerrarSesion(){
        signOut(auth).then(function(){
            sessionStorage.clear();
            window.location.replace('index.html');
        }).catch(function(){
            sessionStorage.clear();
            window.location.replace('index.html');
        });
    }
window.cerrarSesion = cerrarSesion;

document.addEventListener('keydown',function(e){if(e.key==='Escape'){cerrarModal();cerrarConfirm();}});
