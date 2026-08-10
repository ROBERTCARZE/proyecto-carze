/* ==========================================================================
   PRONTO_PAGO.JS — Lógica del módulo de Pronto Pago
   CARZE Contratistas Generales S.A.C.
   --------------------------------------------------------------------------
   Extraído de pronto_pago.html tal cual estaba (mismo comportamiento, cero
   cambios de lógica) — módulo 14, el último de los grandes.
   ========================================================================== */
import { initializeApp }    from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";
import { getFirestore, collection, query, where,
         onSnapshot, updateDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";
import { getStorage, ref as sRef,
         uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-storage.js";

const firebaseConfig={
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

var datos=[], datosFiltrados=[], editId=null;
var uploadData={nombre:null,url:null};

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
    iniciarListener();
});

// ── LISTENER — solo facturas Cobradas con ncTipo Factoring ───
function iniciarListener(){
    var q=query(
        collection(db,'facturas'),
        where('estado','==','Cobrada'),
        where('ncTipo','==','Factoring')
    );
    onSnapshot(q,function(snap){
        datos=snap.docs.map(function(d){var r=d.data();r._id=d.id;return r;});
        // Ordenar por fecha emisión descendente
        datos.sort(function(a,b){
            return String(b.fechaEmision||'').localeCompare(String(a.fechaEmision||''));
        });
        poblarFiltroCliente();
        aplicarFiltros();
        calcularKPIs();
    },function(err){
        toast('Error cargando datos: '+err.message,'err');
    });
}

// ── HELPERS ──────────────────────────────────────────────────
function fmt(n){return parseFloat(n||0).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2});}
function esc(v){return v!=null&&v!==''&&v!=='-'?String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;'):'—';}
function fmtF(v){
    if(!v||v==='-'||v==='—') return '—';
    var s=String(v).trim();
    if(s.match(/^\d{4}-\d{2}-\d{2}/)){var p=s.substring(0,10).split('-');return p[2]+'/'+p[1]+'/'+p[0];}
    return s;
}
function toast(msg,tipo){
    var t=document.getElementById('toast');
    t.textContent=msg;t.className='toast '+(tipo||'ok');t.classList.add('show');
    setTimeout(function(){t.classList.remove('show');},3000);
}

// ── KPIs ──────────────────────────────────────────────────────
function calcularKPIs(){
    var totalDescuento=0, totalNeto=0, conPDF=0;
    datos.forEach(function(r){
        var descuento=parseFloat(r.ncImporte)||0;
        var total=parseFloat(r.total)||0;
        totalDescuento+=descuento;
        totalNeto+=(total-descuento);
        if(r.bancoPDFLink&&r.bancoPDFLink!=='-') conPDF++;
    });
    document.getElementById('kCount').textContent=datos.length;
    document.getElementById('kDescuento').textContent='S/ '+fmt(totalDescuento);
    document.getElementById('kNeto').textContent='S/ '+fmt(totalNeto);
    document.getElementById('kConPDF').textContent=conPDF;
}

// ── POBLAR FILTRO CLIENTE ─────────────────────────────────────
function poblarFiltroCliente(){
    var clientes=[...new Set(datos.map(function(r){return r.cliente||r.razonSocial||'';}).filter(Boolean))].sort();
    var sel=document.getElementById('filterCliente');
    var cur=sel.value;
    sel.innerHTML='<option value="">Todos los clientes</option>';
    clientes.forEach(function(c){var op=document.createElement('option');op.value=c;op.textContent=c;sel.appendChild(op);});
    if(cur) sel.value=cur;
}

// ── FILTROS ───────────────────────────────────────────────────
function aplicarFiltros(){
    var q   =document.getElementById('searchInput').value.toLowerCase().trim();
    var cli =document.getElementById('filterCliente').value;
    var pdf =document.getElementById('filterPDF').value;

    datosFiltrados=datos.filter(function(r){
        var factNum=(r.serie||'')+'-'+(r.numFact||'');
        var mQ=!q||[factNum,r.cliente,r.razonSocial,r.ruc,r.ncNumero,r.ref].some(function(v){return String(v||'').toLowerCase().includes(q);});
        var mC=!cli||(r.cliente||r.razonSocial||'')=== cli;
        var tienePDF=r.bancoPDFLink&&r.bancoPDFLink!=='-';
        var mP=!pdf||(pdf==='con'?tienePDF:!tienePDF);
        return mQ&&mC&&mP;
    });

    document.getElementById('tableCount').textContent=datosFiltrados.length+' registro'+(datosFiltrados.length!==1?'s':'');
    renderTabla();
}
window.aplicarFiltros=aplicarFiltros;

// ── RENDER TABLA ──────────────────────────────────────────────
function renderTabla(){
    var tbody=document.getElementById('tablaBody');
    var empty=document.getElementById('emptyState');
    tbody.innerHTML='';
    if(!datosFiltrados.length){empty.style.display='flex';return;}
    empty.style.display='none';

    datosFiltrados.forEach(function(row){
        var factNum=(row.serie||'')+(row.serie&&row.numFact?'-':'')+(row.numFact||'');
        var descuento=parseFloat(row.ncImporte)||0;
        var total=parseFloat(row.total)||0;
        var neto=total-descuento;
        var tienePDF=row.bancoPDFLink&&row.bancoPDFLink!=='-';

        var tr=document.createElement('tr');
        tr.innerHTML=
          '<td style="font-weight:800;color:var(--azul)">'+esc(factNum)+'</td>'+
          '<td>'+fmtF(row.fechaEmision)+'</td>'+
          '<td style="max-width:140px;overflow:hidden;text-overflow:ellipsis">'+esc(row.cliente||row.razonSocial)+'</td>'+
          '<td style="font-family:monospace;font-size:.72rem">'+esc(row.ruc)+'</td>'+
          '<td style="font-weight:700;color:var(--azul2)">S/ '+fmt(total)+'</td>'+
          '<td style="font-size:.73rem;font-weight:700;color:var(--morado)">'+esc(row.ncNumero)+'</td>'+
          '<td style="font-weight:700;color:var(--rojo)">− S/ '+fmt(descuento)+'</td>'+
          '<td style="font-weight:800;color:var(--verde)">S/ '+fmt(neto)+'</td>'+
          '<td>'+
            (row.factLink&&row.factLink!=='-'?
              '<a href="'+row.factLink+'" target="_blank" rel="noopener" class="doc-link">'+esc(row.factNombre||'Ver PDF')+'</a>':
              '<span style="color:#94a3b8;font-size:.72rem">—</span>')+
          '</td>'+
          '<td>'+
            (tienePDF?
              '<a href="'+row.bancoPDFLink+'" target="_blank" rel="noopener" class="doc-link" style="color:var(--verde)">'+
                '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align:middle;margin-right:3px"><polyline points="20 6 9 17 4 12"/></svg>'+
                esc(row.bancoPDFNombre||'Ver PDF')+'</a>':
              '<span style="font-size:.68rem;color:#94a3b8;font-style:italic">Sin subir</span>')+
          '</td>'+
          '<td>'+
            '<button onclick="abrirModal(\''+row._id+'\')" style="'+
              'display:inline-flex;align-items:center;gap:5px;padding:5px 12px;border-radius:8px;border:1.5px solid '+(tienePDF?'var(--verde)':'var(--naranja)')+';'+
              'background:'+(tienePDF?'#f0fdf4':'#fff7ed')+';color:'+(tienePDF?'var(--verde)':'var(--naranja)')+';'+
              'font-family:inherit;font-size:.7rem;font-weight:700;cursor:pointer;transition:all .2s">'+
              (tienePDF?'✏️ Reemplazar':'📤 Subir PDF')+
            '</button>'+
          '</td>';
        tbody.appendChild(tr);
    });
}

// ── MODAL UPLOAD ──────────────────────────────────────────────
function abrirModal(id){
    editId=id;
    uploadData={nombre:null,url:null};
    resetUploadUI();
    var row=datos.find(function(r){return r._id===id;});
    if(!row) return;
    var factNum=(row.serie||'')+'-'+(row.numFact||'');
    var descuento=parseFloat(row.ncImporte)||0;
    var total=parseFloat(row.total)||0;
    document.getElementById('detFactura').textContent=factNum;
    document.getElementById('detCliente').textContent=row.cliente||row.razonSocial||'—';
    document.getElementById('detTotal').textContent='S/ '+fmt(total);
    document.getElementById('detNC').textContent=row.ncNumero||'—';
    document.getElementById('detDescuento').textContent='− S/ '+fmt(descuento);
    document.getElementById('detNeto').textContent='S/ '+fmt(total-descuento);
    document.getElementById('fReferencia').value=row.bancoPDFRef||'';
    // Si ya tiene PDF, mostrarlo
    if(row.bancoPDFLink&&row.bancoPDFLink!=='-'){
        uploadData={nombre:row.bancoPDFNombre,url:row.bancoPDFLink};
        document.getElementById('uploadDoneName').textContent=row.bancoPDFNombre||'PDF banco';
        document.getElementById('uploadDone').style.display='flex';
    }
    document.getElementById('overlay').classList.add('open');
}
window.abrirModal=abrirModal;

function cerrarModal(){document.getElementById('overlay').classList.remove('open'); editId=null;}
window.cerrarModal=cerrarModal;

function resetUploadUI(){
    document.getElementById('uploadProg').style.display='none';
    document.getElementById('uploadProgFill').style.width='0%';
    document.getElementById('uploadStatus').style.display='none';
    document.getElementById('uploadStatus').textContent='';
    document.getElementById('uploadDone').style.display='none';
    document.getElementById('uploadDoneName').textContent='';
    uploadData={nombre:null,url:null};
    var inp=document.getElementById('uploadArea').querySelector('input[type=file]');
    if(inp) inp.value='';
}

// ── UPLOAD PDF ────────────────────────────────────────────────
function handleUpload(event){
    var file=event.target.files[0]; if(!file) return;
    if(file.type!=='application/pdf'){toast('Solo se aceptan archivos PDF','err');return;}
    var path='factoring/'+Date.now()+'_'+file.name.replace(/\s/g,'_');
    var storRef=sRef(storage,path);
    var prog=document.getElementById('uploadProg');
    var fill=document.getElementById('uploadProgFill');
    var status=document.getElementById('uploadStatus');
    prog.style.display='block';
    status.style.display='block';
    status.style.color='var(--azul2)';
    status.textContent='Subiendo...';
    var task=uploadBytesResumable(storRef,file);
    task.on('state_changed',
        function(snap){fill.style.width=Math.round(snap.bytesTransferred/snap.totalBytes*100)+'%';},
        function(err){status.style.color='var(--rojo)';status.textContent='Error: '+err.message;},
        function(){
            getDownloadURL(task.snapshot.ref).then(function(url){
                uploadData={nombre:file.name,url:url};
                status.style.color='var(--verde)';status.textContent='✓ Subido correctamente';
                document.getElementById('uploadDone').style.display='flex';
                document.getElementById('uploadDoneName').textContent=file.name;
                toast('PDF subido correctamente ✓','ok');
            });
        }
    );
}
window.handleUpload=handleUpload;

function removeUpload(){
    resetUploadUI();
    uploadData={nombre:null,url:null};
}
window.removeUpload=removeUpload;

// ── GUARDAR PDF EN FIRESTORE ──────────────────────────────────
async function guardarPDF(){
    if(!editId) return;
    if(!uploadData.url){toast('Primero sube el PDF del banco','err');return;}
    var btn=document.getElementById('btnGuardar');
    var txt=document.getElementById('btnGuardarTxt');
    btn.disabled=true; txt.innerHTML='<span class="spinner"></span>';
    try{
        await updateDoc(doc(db,'facturas',editId),{
            bancoPDFNombre: uploadData.nombre,
            bancoPDFLink:   uploadData.url,
            bancoPDFRef:    document.getElementById('fReferencia').value.trim()||'-',
            updatedAt: serverTimestamp()
        });
        toast('PDF guardado correctamente ✓','ok');
        btn.disabled=false; txt.textContent='GUARDAR';
        cerrarModal();
    }catch(err){
        btn.disabled=false; txt.textContent='GUARDAR';
        toast('Error: '+err.message,'err');
    }
}
window.guardarPDF=guardarPDF;

// ── EXPORTAR EXCEL ────────────────────────────────────────────
function exportarExcel(){
    if(!datos.length){toast('No hay datos para exportar','warn');return;}
    var rows=[['Factura','Fecha Emisión','Cliente','RUC','Total Factura','N° Nota Crédito','Descuento Factoring','Monto Neto','Con PDF Banco','Referencia PDF']];
    datos.forEach(function(r){
        var factNum=(r.serie||'')+'-'+(r.numFact||'');
        var descuento=parseFloat(r.ncImporte)||0;
        var total=parseFloat(r.total)||0;
        rows.push([
            factNum, r.fechaEmision,
            r.cliente||r.razonSocial, r.ruc,
            total, r.ncNumero, descuento, total-descuento,
            (r.bancoPDFLink&&r.bancoPDFLink!=='-'?'Sí':'No'),
            r.bancoPDFRef||'-'
        ]);
    });
    var wb=XLSX.utils.book_new();
    var ws=XLSX.utils.aoa_to_sheet(rows);
    ws['!cols']=[{wch:14},{wch:13},{wch:22},{wch:14},{wch:14},{wch:16},{wch:18},{wch:14},{wch:12},{wch:25}];
    XLSX.utils.book_append_sheet(wb,ws,'Factoring');
    XLSX.writeFile(wb,'CARZE_Factoring.xlsx');
    toast('Excel generado ✓','ok');
}
window.exportarExcel=exportarExcel;

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
document.addEventListener('keydown',function(e){if(e.key==='Escape')cerrarModal();});
