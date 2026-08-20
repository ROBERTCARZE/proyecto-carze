/* ==========================================================================
   PERSONAL.JS — Lógica del módulo de Personal
   CARZE Contratistas Generales S.A.C.
   --------------------------------------------------------------------------
   Extraído de personal.html tal cual estaba (mismo comportamiento, cero
   cambios de lógica) — sexto módulo separado.
   ========================================================================== */
import { initializeApp }    from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";
import { getFirestore, collection, query, orderBy,
         onSnapshot, addDoc, updateDoc, deleteDoc, setDoc, getDoc,
         getDocs, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-storage.js";

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
const storage = getStorage(app);
    const auth = getAuth(app);
const COL = 'personal';
const COL_SCTR = 'sctr';
const COL_CUENTAS = 'cuentas_bancarias';

if(window.pdfjsLib){
    pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}
var sctrPreviewData=null, sctrArchivoFile=null, sctrHistorialData=[], sctrListenerIniciado=false, pendingDelSCTR=null, pendingSCTRPreviewRefresh=false, pendingDetalleSCTRDocId=null;

var datos=[], datosFiltrados=[], tipoActual='Planilla', editId=null;
var sortCol=null, sortDir=1;

var cuentasData=[], editCuentaId=null, pendingDelCuenta=null;

// Entidades financieras autorizadas por la SBS (banca múltiple, financieras,
// cajas municipales y cajas rurales) — referencial a 2026, verificar cambios
// (fusiones/conversiones) en https://www.sbs.gob.pe
var BANCOS_PERU=[
    'Banco de Crédito del Perú (BCP)','BBVA Perú','Interbank','Scotiabank Perú',
    'Mibanco','BanBif (Banco Interamericano de Finanzas)','Banco Pichincha',
    'Banco Falabella','Banco Ripley','Compartamos Banco','Banco GNB Perú',
    'Banco de Comercio','Alfin Banco','Citibank del Perú','Banco Santander Perú',
    'Banco BCI Perú','ICBC Perú Bank','Bank of China (Perú)','Banco de la Nación',
    'InFinance XP (antes Financiera Oh!)','Financiera Confianza','Financiera Efectiva',
    'MAF Innovación Financiera (Mitsui Auto Finance)','Financiera Proempresa',
    'Financiera Qapaq','Financiera Surgir',
    'Caja Arequipa','Caja Huancayo','Caja Piura','Caja Cusco','Caja Trujillo',
    'Caja Ica','Caja Tacna','Caja Maynas','Caja Paita','Caja Del Santa',
    'Caja Metropolitana de Lima (CMCP)',
    'Caja Los Andes','Caja Prymera','Caja Incasur','Caja Cencosud Scotia',
    'Otro'
];
var BILLETERAS_PERU=[
    'Yape (BCP)','Plin (Interbank / BBVA / Scotiabank)','IzipayYA (antes Tunki - Interbank)',
    'Agora Pay','Sip (Intercorp)','Lukita','Ligo','Máximo','Prex Perú','Otro'
];

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
    document.getElementById('fFechaIngreso').value=hoy();
    document.getElementById('sctrMes').value=hoy().substring(0,7);
    cargarZonas();
    iniciarListener();
    iniciarListenerSCTR();
    poblarSelectsCuentas();
    iniciarListenerCuentas();
});

// ── TABS ─────────────────────────────────────────────────────
function cambiarTab(tab){
    document.getElementById('viewSCTR').style.display   = tab==='sctr'   ? '' : 'none';
    document.getElementById('viewCuentas').style.display= tab==='cuentas'? '' : 'none';
    document.getElementById('tabBtnSCTR').classList.toggle('active', tab==='sctr');
    document.getElementById('tabBtnCuentas').classList.toggle('active', tab==='cuentas');
}
window.cambiarTab=cambiarTab;

// ── ZONAS DESDE FIRESTORE ─────────────────────────────────────
async function cargarZonas(){
    try{
        const snap=await getDocs(collection(db,'zonas'));
        var sel=document.getElementById('fZona');
        snap.docs.forEach(function(d){
            var op=document.createElement('option');
            op.value=d.data().nombre; op.textContent=d.data().nombre;
            sel.appendChild(op);
        });
    }catch(e){}
}

function iniciarListener(){
    onSnapshot(query(collection(db,COL),orderBy('apellido','asc')),function(snap){
        datos=snap.docs.map(function(d){var r=d.data();r._id=d.id;return r;});
        poblarFiltrosCargo();
        aplicarFiltros();
        calcularKPIs();
        poblarDatalistNombres();
    },function(err){toast('Error: '+err.message,'err');});
}

// ── HELPERS ──────────────────────────────────────────────────
function hoy(){var d=new Date();return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate());}
function p2(n){return n<10?'0'+n:String(n);}
function esc(v){return v!=null&&v!==''?String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;'):'—';}
function fmtF(v){
    if(!v||v==='-') return '—';
    var s=String(v).trim();
    if(s.match(/^\d{4}-\d{2}-\d{2}/)){
        var p=s.substring(0,10).split('-');
        return p[2]+'/'+p[1]+'/'+p[0];
    }
    return s;
}
function toast(msg,tipo){
    var t=document.getElementById('toast');
    t.textContent=msg;t.className='toast '+(tipo||'ok');t.classList.add('show');
    setTimeout(function(){t.classList.remove('show');},3000);
}

function calcularEdad(){
    var v=document.getElementById('fFechaNac').value;
    if(!v){document.getElementById('fEdad').value='';return;}
    var nac=new Date(v), hoyD=new Date();
    var edad=hoyD.getFullYear()-nac.getFullYear();
    var m=hoyD.getMonth()-nac.getMonth();
    if(m<0||(m===0&&hoyD.getDate()<nac.getDate())) edad--;
    document.getElementById('fEdad').value=edad+' años';
}
window.calcularEdad=calcularEdad;

function calcEdadDesde(fechaNac){
    if(!fechaNac||fechaNac==='-') return '—';
    var nac=new Date(fechaNac), hoyD=new Date();
    var edad=hoyD.getFullYear()-nac.getFullYear();
    var m=hoyD.getMonth()-nac.getMonth();
    if(m<0||(m===0&&hoyD.getDate()<nac.getDate())) edad--;
    return edad;
}

function tiempoEnEmpresa(fechaIngreso){
    if(!fechaIngreso||fechaIngreso==='-') return '—';
    var ing=new Date(fechaIngreso), hoyD=new Date();
    var anios=hoyD.getFullYear()-ing.getFullYear();
    var meses=hoyD.getMonth()-ing.getMonth();
    if(meses<0){anios--;meses+=12;}
    if(anios>0 && meses>0) return anios+' año'+(anios>1?'s':'')+' y '+meses+' mes'+(meses>1?'es':'');
    if(anios>0) return anios+' año'+(anios>1?'s':'');
    if(meses>0) return meses+' mes'+(meses>1?'es':'');
    var dias=Math.floor((hoyD-ing)/(1000*60*60*24));
    return dias+' día'+(dias>1?'s':'');
}

function avatarColor(nombre){
    var colors=['#1e40af','#9333ea','#0891b2','#16a34a','#dc2626','#f59e0b','#c2410c','#0f766e'];
    var idx=0;
    for(var i=0;i<(nombre||'').length;i++) idx+=(nombre||'').charCodeAt(i);
    return colors[idx%colors.length];
}

// ── KPIs ──────────────────────────────────────────────────────
function calcularKPIs(){
    if(!document.getElementById('kTotal')) return; // el directorio ya no está en pantalla
    var activos=datos.filter(function(r){return r.estado==='Activo';}).length;
    var inactivos=datos.filter(function(r){return r.estado==='Inactivo';}).length;
    var planilla=datos.filter(function(r){return r.tipo==='Planilla';}).length;
    var temporales=datos.filter(function(r){return r.tipo==='Temporal';}).length;
    document.getElementById('kTotal').textContent=datos.length;
    document.getElementById('kActivos').textContent=activos;
    document.getElementById('kInactivos').textContent=inactivos;
    document.getElementById('kPlanilla').textContent=planilla;
    document.getElementById('kTemporales').textContent=temporales;
}

// ── FILTROS CARGO ─────────────────────────────────────────────
function poblarFiltrosCargo(){
    if(!document.getElementById('filterCargo')) return; // el directorio ya no está en pantalla
    var cargos=[...new Set(datos.map(function(r){return r.cargo||'';}).filter(Boolean))].sort();
    var sel=document.getElementById('filterCargo');
    var cur=sel.value;
    sel.innerHTML='<option value="">Todos los cargos</option>';
    cargos.forEach(function(c){var op=document.createElement('option');op.value=c;op.textContent=c;sel.appendChild(op);});
    if(cur) sel.value=cur;
}

// ── FILTROS ZONA ──────────────────────────────────────────────
function poblarFiltrosZona(datos){
    var zonas=[...new Set(datos.map(function(r){return r.zona||'';}).filter(Boolean))].sort();
    var sel=document.getElementById('filterZona');
    var cur=sel.value;
    sel.innerHTML='<option value="">Todas las zonas</option>';
    zonas.forEach(function(z){var op=document.createElement('option');op.value=z;op.textContent=z;sel.appendChild(op);});
    if(cur) sel.value=cur;
}

// ── APLICAR FILTROS ───────────────────────────────────────────
function aplicarFiltros(){
    if(!document.getElementById('searchInput')) return; // el directorio ya no está en pantalla
    var q    =document.getElementById('searchInput').value.toLowerCase().trim();
    var est  =document.getElementById('filterEstado').value;
    var tipo =document.getElementById('filterTipo').value;
    var cargo=document.getElementById('filterCargo').value;
    var zona =document.getElementById('filterZona').value;

    datosFiltrados=datos.filter(function(r){
        var mQ=!q||[r.nombre,r.apellido,r.dni,r.cargo,r.zona,r.telefono].some(function(v){return String(v||'').toLowerCase().includes(q);});
        var mE=!est||(r.estado||'')=== est;
        var mT=!tipo||(r.tipo||'')===tipo;
        var mC=!cargo||(r.cargo||'')===cargo;
        var mZ=!zona||(r.zona||'')===zona;
        return mQ&&mE&&mT&&mC&&mZ;
    });

    poblarFiltrosZona(datos);
    renderTabla();
}
window.aplicarFiltros=aplicarFiltros;

function setFiltroEstado(v){document.getElementById('filterEstado').value=v;aplicarFiltros();}
function setFiltroTipo(v){document.getElementById('filterTipo').value=v;aplicarFiltros();}
window.setFiltroEstado=setFiltroEstado;
window.setFiltroTipo=setFiltroTipo;

// ── ORDENAR ───────────────────────────────────────────────────
function ordenar(col){
    if(sortCol===col) sortDir*=-1;
    else{sortCol=col;sortDir=1;}
    datosFiltrados.sort(function(a,b){
        var va=a[col]||'', vb=b[col]||'';
        return String(va).localeCompare(String(vb))*sortDir;
    });
    renderTabla();
}
window.ordenar=ordenar;

// ── RENDER TABLA ──────────────────────────────────────────────
function renderTabla(){
    var tbody=document.getElementById('tablaBody');
    var empty=document.getElementById('emptyState');
    var count=document.getElementById('tableCount');
    tbody.innerHTML='';
    count.textContent=datosFiltrados.length+' persona'+(datosFiltrados.length!==1?'s':'');
    if(!datosFiltrados.length){empty.style.display='flex';return;}
    empty.style.display='none';

    datosFiltrados.forEach(function(r){
        var edad=calcEdadDesde(r.fnacimiento);
        var tiempo=tiempoEnEmpresa(r.fingreso);
        var nombreCompleto=(r.nombre||'')+' '+(r.apellido||'');
        var initials=((r.nombre||' ')[0]+(r.apellido||' ')[0]).toUpperCase();
        var color=avatarColor(nombreCompleto);
        var tr=document.createElement('tr');
        tr.innerHTML=
          '<td>'+
            '<div style="display:flex;align-items:center;gap:9px">'+
              '<div class="avatar-cell" style="background:'+color+'">'+initials+'</div>'+
              '<div>'+
                '<div style="font-weight:700;color:var(--txt)">'+esc(r.nombre)+' '+esc(r.apellido)+'</div>'+
              '</div>'+
            '</div>'+
          '</td>'+
          '<td style="font-family:monospace;letter-spacing:.05em;font-size:.78rem">'+esc(r.dni)+'</td>'+
          '<td style="font-weight:700;color:var(--azul2)">'+edad+(edad!=='—'?' años':'')+'</td>'+
          '<td>'+fmtF(r.fnacimiento)+'</td>'+
          '<td><span class="pill-cargo">'+esc(r.cargo)+'</span></td>'+
          '<td>'+
            (r.telefono&&r.telefono!=='-'?
              '<a href="tel:'+r.telefono+'" style="color:var(--azul2);font-weight:600;text-decoration:none;font-size:.76rem">📞 '+esc(r.telefono)+'</a>':
              '<span style="color:#94a3b8">—</span>')+
          '</td>'+
          '<td><span style="font-size:.73rem;font-weight:600;color:var(--muted)">📍 '+esc(r.zona)+'</span></td>'+
          '<td>'+fmtF(r.fingreso)+'</td>'+
          '<td style="font-size:.72rem;color:var(--muted);font-weight:600">'+tiempo+'</td>'+
          '<td><span class="pill '+(r.tipo==='Planilla'?'pill-planilla':'pill-temporal')+'">'+esc(r.tipo)+'</span></td>'+
          '<td>'+
            '<span class="pill '+(r.estado==='Activo'?'pill-activo':'pill-inactivo')+'" '+
              'style="cursor:pointer" onclick="toggleEstado(\''+r._id+'\',\''+r.estado+'\')" title="Click para cambiar estado">'+
              '<span class="pill-dot"></span>'+esc(r.estado)+
            '</span>'+
          '</td>'+
          '<td style="display:flex;gap:5px">'+
            '<button class="btn-edit-sm" onclick="editarPersona(\''+r._id+'\')">✏️</button>'+
            '<button class="btn-del" onclick="pedirEliminar(\''+r._id+'\',\''+esc(nombreCompleto)+'\')">🗑️</button>'+
          '</td>';
        tbody.appendChild(tr);
    });
}

// ── TOGGLE ESTADO ─────────────────────────────────────────────
async function toggleEstado(id, estadoActual){
    var nuevo=estadoActual==='Activo'?'Inactivo':'Activo';
    try{
        await updateDoc(doc(db,COL,id),{estado:nuevo,updatedAt:serverTimestamp()});
        toast('Estado cambiado a '+nuevo,'ok');
    }catch(err){toast('Error: '+err.message,'err');}
}
window.toggleEstado=toggleEstado;

// ── MODAL ─────────────────────────────────────────────────────
function setTipo(tipo){
    tipoActual=tipo;
    document.getElementById('btnPlanilla').className='tipo-btn t-planilla'+(tipo==='Planilla'?' active':'');
    document.getElementById('btnTemporal').className='tipo-btn t-temporal'+(tipo==='Temporal'?' active':'');
}
window.setTipo=setTipo;

function abrirModal(){
    editId=null; limpiar();
    document.getElementById('modalTitle').innerHTML='Nuevo <span>Personal</span>';
    document.getElementById('btnGuardarTxt').textContent='REGISTRAR';
    document.getElementById('overlay').classList.add('open');
}
window.abrirModal=abrirModal;

function editarPersona(id){
    var r=datos.find(function(x){return x._id===id;}); if(!r) return;
    editId=id; limpiar();
    setTipo(r.tipo||'Planilla');
    document.getElementById('fNombre').value=r.nombre||'';
    document.getElementById('fApellido').value=r.apellido||'';
    document.getElementById('fDNI').value=r.dni||'';
    document.getElementById('fTelefono').value=r.telefono||'';
    document.getElementById('fFechaNac').value=r.fnacimiento||'';
    document.getElementById('fCargo').value=r.cargo||'';
    document.getElementById('fZona').value=r.zona||'';
    document.getElementById('fFechaIngreso').value=r.fingreso||'';
    document.getElementById('fEstado').value=r.estado||'Activo';
    calcularEdad();
    document.getElementById('modalTitle').innerHTML='Editar <span>Personal</span>';
    document.getElementById('btnGuardarTxt').textContent='ACTUALIZAR';
    document.getElementById('overlay').classList.add('open');
}
window.editarPersona=editarPersona;

function cerrarModal(){document.getElementById('overlay').classList.remove('open');pendingSCTRPreviewRefresh=false;pendingDetalleSCTRDocId=null;}
window.cerrarModal=cerrarModal;

function limpiar(){
    ['fNombre','fApellido','fDNI','fTelefono','fEdad'].forEach(function(id){document.getElementById(id).value='';});
    ['fCargo','fZona','fEstado'].forEach(function(id){document.getElementById(id).value=id==='fEstado'?'Activo':'';});
    document.getElementById('fFechaNac').value='';
    document.getElementById('fFechaIngreso').value=hoy();
    setTipo('Planilla');
}

// ── GUARDAR ───────────────────────────────────────────────────
async function guardar(){
    var nombre  =document.getElementById('fNombre').value.trim();
    var apellido=document.getElementById('fApellido').value.trim();
    var dni     =document.getElementById('fDNI').value.trim();
    var cargo   =document.getElementById('fCargo').value;
    var zona    =document.getElementById('fZona').value;
    var fingreso=document.getElementById('fFechaIngreso').value;
    if(!nombre||!apellido||!dni||!cargo||!zona||!fingreso){toast('Completa los campos obligatorios (*)','err');return;}
    if(dni.length!==8){toast('El DNI debe tener 8 dígitos','err');return;}

    var btn=document.getElementById('btnGuardar');
    var txt=document.getElementById('btnGuardarTxt');
    btn.disabled=true; txt.innerHTML='<span class="spinner"></span>';

    var docData={
        nombre:nombre, apellido:apellido, dni:dni,
        telefono:document.getElementById('fTelefono').value.trim()||'-',
        fnacimiento:document.getElementById('fFechaNac').value||'-',
        cargo:cargo, zona:zona,
        fingreso:fingreso,
        tipo:tipoActual,
        estado:document.getElementById('fEstado').value||'Activo',
        updatedAt:serverTimestamp()
    };
    try{
        if(editId){
            await updateDoc(doc(db,COL,editId),docData);
            toast('Personal actualizado ✓','ok');
        } else {
            docData.createdAt=serverTimestamp();
            await addDoc(collection(db,COL),docData);
            toast(nombre+' '+apellido+' registrado ✓','ok');
        }
        if(pendingSCTRPreviewRefresh && sctrPreviewData){
            var emp=sctrPreviewData.empleados.find(function(x){return x.dni===dni;});
            if(emp){emp.nombre=nombre;emp.apellido=apellido;emp.encontrado=true;}
            renderPreviewSCTR();
            pendingSCTRPreviewRefresh=false;
        }
        if(pendingDetalleSCTRDocId){
            var registro=sctrHistorialData.find(function(x){return x._id===pendingDetalleSCTRDocId;});
            if(registro){
                var empD=(registro.empleados||[]).find(function(x){return x.dni===dni;});
                if(empD){
                    empD.nombre=nombre; empD.apellido=apellido; empD.encontrado=true;
                    try{ await updateDoc(doc(db,COL_SCTR,pendingDetalleSCTRDocId),{empleados:registro.empleados}); }catch(e){}
                }
                verDetalleSCTR(pendingDetalleSCTRDocId);
            }
            pendingDetalleSCTRDocId=null;
        }
        btn.disabled=false; txt.textContent=editId?'ACTUALIZAR':'REGISTRAR';
        cerrarModal();
    }catch(err){btn.disabled=false; txt.textContent=editId?'ACTUALIZAR':'REGISTRAR'; toast('Error: '+err.message,'err');}
}
window.guardar=guardar;

// ── SCTR: LECTURA DEL PDF ───────────────────────────────────────
async function extraerTextoPDF(file){
    var arrayBuffer=await file.arrayBuffer();
    var pdf=await pdfjsLib.getDocument({data:arrayBuffer}).promise;
    var textoCompleto='';
    for(var i=1;i<=pdf.numPages;i++){
        var page=await pdf.getPage(i);
        var content=await page.getTextContent();
        textoCompleto+=content.items.map(function(it){return it.str;}).join(' ')+' ';
    }
    return textoCompleto;
}

function fechaDDMMYYYYaISO(f){
    var p=f.split('/');
    return p[2]+'-'+p[1]+'-'+p[0];
}

// Extrae empleados (DNI + nombre tal cual aparece) y datos de la póliza.
// Ajustado al formato de constancias tipo MAPFRE: "N DNI 12345678 NOMBRE COMPLETO"
function parsearTextoSCTR(texto){
    texto=texto.replace(/\s+/g,' ').trim();
    var resultado={empleados:[],empresa:'',polizaPension:'',contratoSalud:'',vigenciaInicio:'',vigenciaFin:'',nroConstancia:''};

    var m;
    m=texto.match(/Nro\.?\s*De\s*Constancia\s*([A-Z0-9\/]+)/i);
    if(m) resultado.nroConstancia=m[1];

    m=texto.match(/nombre de la empresa\s+([A-ZÁÉÍÓÚÑ0-9.,&\s]+?)\s+bajo la P[óo]liza/i);
    if(m) resultado.empresa=m[1].trim();

    m=texto.match(/P[óo]liza de Pensiones No\.?\s*(\d+)/i);
    if(m) resultado.polizaPension=m[1];

    m=texto.match(/contrato de Salud No\.?\s*(\d+)/i);
    if(m) resultado.contratoSalud=m[1];

    m=texto.match(/vigencia del\s*(\d{2}\/\d{2}\/\d{4})\s*hasta el\s*(\d{2}\/\d{2}\/\d{4})/i);
    if(m){resultado.vigenciaInicio=fechaDDMMYYYYaISO(m[1]);resultado.vigenciaFin=fechaDDMMYYYYaISO(m[2]);}

    var re=/([A-ZÁÉÍÓÚÑÜ]+(?:\s[A-ZÁÉÍÓÚÑÜ]+)*)\s(\d{7,8})\s*DNI\s*\d{1,3}\b/g;
    var match;
    while((match=re.exec(texto))!==null){
        var nombreCompleto=match[1].trim().replace(/\s+/g,' ');
        var dni=match[2].trim();
        if(nombreCompleto.length>1) resultado.empleados.push({dni:dni,nombrePDF:nombreCompleto});
    }

    // Fallback: algunas aseguradoras exportan el texto en el orden visual "N DNI 12345678 NOMBRE"
    if(!resultado.empleados.length){
        var re2=/\d{1,3}\s*DNI\s*(\d{7,8})\s+([A-ZÁÉÍÓÚÑÜ\s]+?)(?=\s*\d{1,3}\s*DNI|\s*Se expide|\s*NOTA:|$)/g;
        var match2;
        while((match2=re2.exec(texto))!==null){
            var dni2=match2[1].trim();
            var nombre2=match2[2].trim().replace(/\s+/g,' ');
            if(nombre2.length>1) resultado.empleados.push({dni:dni2,nombrePDF:nombre2});
        }
    }
    return resultado;
}

// Cruza los DNI del PDF contra la colección "personal" ya cargada en memoria (var datos)
function cruzarConPersonal(empleadosPDF){
    return empleadosPDF.map(function(e){
        var encontrado=datos.find(function(p){return p.dni===e.dni;});
        return{
            dni:e.dni, nombrePDF:e.nombrePDF,
            nombre:encontrado?encontrado.nombre:'',
            apellido:encontrado?encontrado.apellido:'',
            encontrado:!!encontrado
        };
    });
}

async function manejarArchivoSCTR(event){
    var file=event.target.files[0];
    if(!file) return;
    if(file.type!=='application/pdf'){toast('Solo se aceptan archivos PDF','err');return;}
    sctrArchivoFile=file;
    document.getElementById('sctrFileName').textContent=file.name;
    toast('Leyendo documento...','ok');
    try{
        var texto=await extraerTextoPDF(file);
        var info=parsearTextoSCTR(texto);
        if(!info.empleados.length){
            toast('No se detectaron asegurados en el PDF. Verifica el formato del documento.','err');
            return;
        }
        info.empleados=cruzarConPersonal(info.empleados);
        sctrPreviewData=info;
        if(info.vigenciaInicio) document.getElementById('sctrMes').value=info.vigenciaInicio.substring(0,7);
        renderPreviewSCTR();
        toast(info.empleados.length+' asegurados detectados ✓','ok');
    }catch(err){
        toast('Error al leer el PDF: '+err.message,'err');
    }
}
window.manejarArchivoSCTR=manejarArchivoSCTR;

function renderPreviewSCTR(){
    if(!sctrPreviewData) return;
    document.getElementById('sctrPreview').style.display='block';
    var info=sctrPreviewData;
    document.getElementById('sctrMetaGrid').innerHTML=
        '<div><strong>N° Constancia</strong>'+esc(info.nroConstancia)+'</div>'+
        '<div><strong>Empresa</strong>'+esc(info.empresa)+'</div>'+
        '<div><strong>Póliza Pensión</strong>'+esc(info.polizaPension)+'</div>'+
        '<div><strong>Contrato Salud</strong>'+esc(info.contratoSalud)+'</div>'+
        '<div><strong>Vigencia desde</strong>'+fmtF(info.vigenciaInicio)+'</div>'+
        '<div><strong>Vigencia hasta</strong>'+fmtF(info.vigenciaFin)+'</div>';

    var tbody=document.getElementById('sctrPreviewBody');
    tbody.innerHTML='';
    info.empleados.forEach(function(e){
        var tr=document.createElement('tr');
        tr.innerHTML=
            '<td style="font-family:monospace;letter-spacing:.05em">'+esc(e.dni)+'</td>'+
            '<td>'+(e.encontrado?('<b>'+esc(e.nombre)+' '+esc(e.apellido)+'</b>'):'<span style="color:#94a3b8">—</span>')+'</td>'+
            '<td style="font-size:.72rem;color:var(--muted)">'+esc(e.nombrePDF)+'</td>'+
            '<td><span class="pill '+(e.encontrado?'pill-ok':'pill-warn')+'"><span class="pill-dot"></span>'+(e.encontrado?'En Personal':'No registrado')+'</span></td>'+
            '<td>'+(e.encontrado?'':'<button class="btn-edit-sm" onclick="registrarDesdeSCTR(\''+e.dni+'\',\''+esc(e.nombrePDF).replace(/'/g,"\\'")+'\')">➕ Registrar</button>')+'</td>';
        tbody.appendChild(tr);
    });
    document.getElementById('sctrPreviewCount').textContent=info.empleados.length+' persona'+(info.empleados.length!==1?'s':'');
}

function cancelarPreviewSCTR(){
    sctrPreviewData=null; sctrArchivoFile=null;
    document.getElementById('sctrPreview').style.display='none';
    document.getElementById('sctrFileInput').value='';
    document.getElementById('sctrFileName').textContent='';
    document.getElementById('sctrPrecioSalud').value='';
    document.getElementById('sctrPrecioPension').value='';
}
window.cancelarPreviewSCTR=cancelarPreviewSCTR;

// Registrar rápido a un asegurado del PDF que no existe en la BD de Personal,
// sin salir de la pantalla de SCTR. Precarga el modal de Personal con el DNI
// y una separación heurística apellidos/nombres (convención peruana: últimas
// 1-2 palabras son nombres, el resto apellidos), dejando que el usuario
// complete cargo/zona/fecha de ingreso y confirme.
// detalleDocId es opcional: si viene desde el modal de detalle de un mes ya
// guardado, al registrar se persiste también la corrección en ese documento.
function registrarDesdeSCTR(dni,nombrePDF,detalleDocId){
    var partes=nombrePDF.trim().split(/\s+/).filter(Boolean);
    var apellidos='', nombres='';
    if(partes.length>=3){
        apellidos=partes.slice(0,2).join(' ');
        nombres=partes.slice(2).join(' ');
    }else if(partes.length===2){
        apellidos=partes[0]; nombres=partes[1];
    }else{
        nombres=nombrePDF;
    }
    editId=null; limpiar();
    document.getElementById('fDNI').value=dni;
    document.getElementById('fNombre').value=nombres;
    document.getElementById('fApellido').value=apellidos;
    document.getElementById('modalTitle').innerHTML='Nuevo <span>Personal</span> (desde SCTR)';
    document.getElementById('btnGuardarTxt').textContent='REGISTRAR';
    pendingSCTRPreviewRefresh=!detalleDocId;
    pendingDetalleSCTRDocId=detalleDocId||null;
    document.getElementById('overlay').classList.add('open');
    toast('Verifica el nombre/apellido y completa cargo, zona y fecha de ingreso','warn');
}
window.registrarDesdeSCTR=registrarDesdeSCTR;

function mesLabel(yyyymm){
    var nombres=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    var p=yyyymm.split('-');
    return nombres[parseInt(p[1],10)-1]+' '+p[0];
}

// ── SCTR: GUARDAR ────────────────────────────────────────────
async function guardarSCTR(){
    if(!sctrPreviewData||!sctrArchivoFile){toast('Primero sube un PDF','err');return;}
    var mes=document.getElementById('sctrMes').value;
    if(!mes){toast('Selecciona el mes','err');return;}
    var precioSalud=parseFloat(document.getElementById('sctrPrecioSalud').value);
    var precioPension=parseFloat(document.getElementById('sctrPrecioPension').value);
    if(isNaN(precioSalud)||isNaN(precioPension)){toast('Completa los precios de SCTR Salud y Pensión','err');return;}

    var btn=document.getElementById('sctrBtnGuardar');
    var txt=document.getElementById('sctrBtnGuardarTxt');
    btn.disabled=true; txt.innerHTML='<span class="spinner"></span>';

    try{
        var storagePath='sctr/'+mes+'_'+Date.now()+'_'+sctrArchivoFile.name;
        var sref=ref(storage,storagePath);
        await uploadBytes(sref,sctrArchivoFile);
        var url=await getDownloadURL(sref);

        var info=sctrPreviewData;
        var docData={
            mes:mes, mesLabel:mesLabel(mes),
            empresa:info.empresa||'', nroConstancia:info.nroConstancia||'',
            polizaPension:info.polizaPension||'', contratoSalud:info.contratoSalud||'',
            vigenciaInicio:info.vigenciaInicio||'', vigenciaFin:info.vigenciaFin||'',
            precioSalud:precioSalud, precioPension:precioPension,
            totalAsegurados:info.empleados.length,
            empleados:info.empleados.map(function(e){
                return{dni:e.dni,nombre:e.nombre||'',apellido:e.apellido||'',nombrePDF:e.nombrePDF,encontrado:e.encontrado};
            }),
            archivoUrl:url, archivoPath:storagePath, archivoNombre:sctrArchivoFile.name,
            updatedAt:serverTimestamp()
        };

        var refDoc=doc(db,COL_SCTR,mes);
        var existente=await getDoc(refDoc);
        if(!existente.exists()) docData.createdAt=serverTimestamp();

        await setDoc(refDoc,docData);
        toast('SCTR de '+mesLabel(mes)+' guardado ✓','ok');
        cancelarPreviewSCTR();
    }catch(err){
        toast('Error al guardar: '+err.message,'err');
    }
    btn.disabled=false; txt.textContent='GUARDAR MES';
}
window.guardarSCTR=guardarSCTR;

// ── SCTR: HISTORIAL ──────────────────────────────────────────
function iniciarListenerSCTR(){
    onSnapshot(query(collection(db,COL_SCTR),orderBy('mes','desc')),function(snap){
        sctrHistorialData=snap.docs.map(function(d){var r=d.data();r._id=d.id;return r;});
        renderHistorialSCTR();
        renderAlertaSCTR();
    },function(err){
        toast('Error cargando historial SCTR: '+err.message,'err');
    });
}

// ── SCTR: ALERTA DE VENCIMIENTO ────────────────────────────────
// Revisa el SCTR del mes calendario actual: si no existe, si ya venció,
// o si está por vencer (5 días o menos), y pinta un banner permanente
// arriba del contenido (visible tanto en Directorio como en SCTR).
function renderAlertaSCTR(){
    var banner=document.getElementById('sctrAlertBanner');
    if(!banner) return;
    var hoyD=new Date();
    var mesActual=hoyD.getFullYear()+'-'+p2(hoyD.getMonth()+1);
    var r=sctrHistorialData.find(function(x){return x.mes===mesActual;});
    var clase, html;

    if(!r){
        clase='danger';
        html='<span>🔴</span><span style="flex:1">No has subido el SCTR de <b>'+mesLabel(mesActual)+'</b>. Sube la constancia cuanto antes: mientras tanto tu personal está trabajando sin cobertura de riesgo registrada.</span>';
    }else if(!r.vigenciaFin){
        clase='warn';
        html='<span>🟡</span><span style="flex:1">El SCTR de <b>'+esc(r.mesLabel||r.mes)+'</b> está guardado, pero no se detectó su fecha de vencimiento. Revísalo en el detalle.</span>';
    }else{
        var fin=new Date(r.vigenciaFin+'T23:59:59');
        var diffDias=Math.ceil((fin-hoyD)/(1000*60*60*24));
        if(diffDias<0){
            clase='danger';
            html='<span>🔴</span><span style="flex:1">El SCTR venció el <b>'+fmtF(r.vigenciaFin)+'</b> (hace '+Math.abs(diffDias)+' día'+(Math.abs(diffDias)!==1?'s':'')+'). Debes renovarlo cuanto antes.</span>';
        }else if(diffDias<=5){
            clase='warn';
            html='<span>🟡</span><span style="flex:1">El SCTR vence en <b>'+diffDias+' día'+(diffDias!==1?'s':'')+'</b> (el '+fmtF(r.vigenciaFin)+'). Prepara la renovación con la aseguradora.</span>';
        }else{
            clase='ok';
            html='<span>✅</span><span style="flex:1">SCTR vigente hasta el <b>'+fmtF(r.vigenciaFin)+'</b> — '+esc(r.totalAsegurados)+' asegurados.</span>';
        }
    }
    banner.className='sctr-alert '+clase;
    banner.innerHTML=html;
}

function poblarAniosSCTR(){
    var anioActual=new Date().getFullYear();
    var anios=new Set([anioActual]);
    sctrHistorialData.forEach(function(r){if(r.mes) anios.add(parseInt(r.mes.substring(0,4),10));});
    var lista=Array.from(anios).sort(function(a,b){return b-a;});
    var sel=document.getElementById('sctrAnioSelect');
    var cur=sel.value;
    sel.innerHTML='';
    lista.forEach(function(a){var op=document.createElement('option');op.value=a;op.textContent=a;sel.appendChild(op);});
    if(cur && lista.indexOf(parseInt(cur,10))!==-1) sel.value=cur; else sel.value=String(anioActual);
}

function renderHistorialSCTR(){
    poblarAniosSCTR();
    var anio=document.getElementById('sctrAnioSelect').value;
    var meses=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    var tbody=document.getElementById('sctrTablaBody');
    tbody.innerHTML='';
    meses.forEach(function(nombreMes,idx){
        var mm=(idx+1<10?'0':'')+(idx+1);
        var mesId=anio+'-'+mm;
        var r=sctrHistorialData.find(function(x){return x.mes===mesId;});
        var tr=document.createElement('tr');
        if(r){
            tr.innerHTML=
                '<td>'+(idx+1)+'</td>'+
                '<td style="font-weight:700">'+nombreMes+'</td>'+
                '<td style="text-align:center;font-weight:700;color:var(--azul2)">'+esc(r.totalAsegurados)+'</td>'+
                '<td>S/ '+Number(r.precioSalud||0).toFixed(2)+'</td>'+
                '<td>S/ '+Number(r.precioPension||0).toFixed(2)+'</td>'+
                '<td>'+fmtF(r.vigenciaInicio)+'</td>'+
                '<td>'+fmtF(r.vigenciaFin)+'</td>'+
                '<td style="text-align:center"><button class="btn-edit-sm" title="Ver detalle" onclick="verDetalleSCTR(\''+r._id+'\')">👁️</button></td>';
        }else{
            tr.innerHTML=
                '<td>'+(idx+1)+'</td>'+
                '<td style="font-weight:700;color:var(--muted)">'+nombreMes+'</td>'+
                '<td colspan="5" style="text-align:center;color:#cbd5e1">— sin datos —</td>'+
                '<td style="text-align:center;color:#cbd5e1">—</td>';
        }
        tbody.appendChild(tr);
    });
    renderGraficoSCTR(anio);
}

// ── SCTR: GRÁFICO DE GASTO MENSUAL (Salud + Pensión) ────────────
function renderGraficoSCTR(anio){
    var mesesCortos=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Set','Oct','Nov','Dic'];
    var mesesLargos=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    var valores=[], maxVal=0, maxIdx=-1;

    for(var i=0;i<12;i++){
        var mm=(i+1<10?'0':'')+(i+1);
        var r=sctrHistorialData.find(function(x){return x.mes===anio+'-'+mm;});
        var val=r?(Number(r.precioSalud||0)+Number(r.precioPension||0)):0;
        valores.push(val);
        if(val>maxVal){maxVal=val;maxIdx=i;}
    }

    var resumen=document.getElementById('sctrChartResumen');
    var cont=document.getElementById('sctrChartContainer');

    if(maxVal<=0){
        resumen.textContent='Aún no hay datos suficientes para graficar el año '+anio+'.';
        cont.innerHTML='';
        return;
    }

    resumen.innerHTML='Mes con mayor gasto en '+anio+': <b>'+mesesLargos[maxIdx]+'</b> — S/ '+maxVal.toFixed(2);

    var html='<div class="sctr-chart-bars">';
    valores.forEach(function(v,i){
        var pct=v>0?Math.max((v/maxVal)*100,4):2;
        var esMax=(i===maxIdx && v>0);
        html+='<div class="sctr-chart-col">'+
                (v>0?'<div class="sctr-chart-value">'+v.toFixed(0)+'</div>':'')+
                '<div class="sctr-chart-bar'+(esMax?' max':(v===0?' empty':''))+'" style="height:'+pct+'%" title="'+mesesLargos[i]+' '+anio+': S/ '+v.toFixed(2)+'"></div>'+
                '<div class="sctr-chart-label">'+mesesCortos[i]+'</div>'+
              '</div>';
    });
    html+='</div>';
    cont.innerHTML=html;
}

function verDetalleSCTR(id){
    var r=sctrHistorialData.find(function(x){return x._id===id;});
    if(!r) return;
    document.getElementById('sctrDetalleTitle').innerHTML='SCTR <span>'+esc(r.mesLabel||r.mes)+'</span>';
    document.getElementById('sctrDetalleMeta').innerHTML=
        '<div><strong>N° Constancia</strong>'+esc(r.nroConstancia)+'</div>'+
        '<div><strong>Empresa</strong>'+esc(r.empresa)+'</div>'+
        '<div><strong>Póliza Pensión</strong>'+esc(r.polizaPension)+'</div>'+
        '<div><strong>Contrato Salud</strong>'+esc(r.contratoSalud)+'</div>'+
        '<div><strong>Vigencia desde</strong>'+fmtF(r.vigenciaInicio)+'</div>'+
        '<div><strong>Vigencia hasta</strong>'+fmtF(r.vigenciaFin)+'</div>';
    document.getElementById('sctrDetalleSalud').textContent='S/ '+Number(r.precioSalud||0).toFixed(2);
    document.getElementById('sctrDetallePension').textContent='S/ '+Number(r.precioPension||0).toFixed(2);

    var tbody=document.getElementById('sctrDetalleBody');
    tbody.innerHTML='';
    (r.empleados||[]).forEach(function(e){
        var tr=document.createElement('tr');
        tr.innerHTML=
            '<td style="font-family:monospace;letter-spacing:.05em">'+esc(e.dni)+'</td>'+
            '<td>'+(e.encontrado?('<b>'+esc(e.nombre)+' '+esc(e.apellido)+'</b>'):('<span style="color:#94a3b8">'+esc(e.nombrePDF)+'</span>'))+'</td>'+
            '<td><span class="pill '+(e.encontrado?'pill-ok':'pill-warn')+'"><span class="pill-dot"></span>'+(e.encontrado?'En Personal':'No registrado')+'</span></td>'+
            '<td style="text-align:center">'+(e.encontrado?
                '<button class="btn-edit-sm" title="Editar en Personal" onclick="editarDesdeDetalleSCTR(\''+e.dni+'\')">✏️</button>':
                '<button class="btn-edit-sm" title="Registrar en Personal" onclick="registrarDesdeSCTR(\''+e.dni+'\',\''+esc(e.nombrePDF).replace(/'/g,"\\'")+'\',\''+r._id+'\')">➕</button>'
              )+'</td>';
        tbody.appendChild(tr);
    });
    document.getElementById('sctrDetalleCount').textContent=(r.empleados||[]).length+' persona'+((r.empleados||[]).length!==1?'s':'');
    document.getElementById('sctrDetalleVerPdf').onclick=function(){window.open(r.archivoUrl,'_blank');};
    document.getElementById('sctrDetalleEliminar').onclick=function(){cerrarDetalleSCTR();pedirEliminarSCTR(r._id,r.mesLabel||r.mes);};
    document.getElementById('sctrDetalleOverlay').classList.add('open');
}
window.verDetalleSCTR=verDetalleSCTR;

// Abre el registro existente en el formulario de Personal (editar cargo, zona, DNI, estado, etc.)
function editarDesdeDetalleSCTR(dni){
    var p=datos.find(function(x){return x.dni===dni;});
    if(!p){toast('No se encontró ese DNI en Personal','err');return;}
    cerrarDetalleSCTR();
    editarPersona(p._id);
}
window.editarDesdeDetalleSCTR=editarDesdeDetalleSCTR;

function cerrarDetalleSCTR(){document.getElementById('sctrDetalleOverlay').classList.remove('open');}
window.cerrarDetalleSCTR=cerrarDetalleSCTR;

function pedirEliminarSCTR(id,mesStr){
    pendingDelSCTR=id;
    document.getElementById('confirmMsg').textContent='Se eliminará el registro SCTR de "'+mesStr+'", incluyendo el PDF guardado. Esta acción no se puede deshacer.';
    document.getElementById('confirmOverlay').classList.add('open');
    document.getElementById('confirmOkBtn').onclick=ejecutarEliminarSCTR;
}
window.pedirEliminarSCTR=pedirEliminarSCTR;

async function ejecutarEliminarSCTR(){
    if(!pendingDelSCTR) return;
    try{
        var registro=sctrHistorialData.find(function(r){return r._id===pendingDelSCTR;});
        await deleteDoc(doc(db,COL_SCTR,pendingDelSCTR));
        if(registro&&registro.archivoPath){
            try{await deleteObject(ref(storage,registro.archivoPath));}catch(e){}
        }
        toast('Registro SCTR eliminado ✓','ok');
    }catch(err){toast('Error: '+err.message,'err');}
    cerrarConfirm();
    pendingDelSCTR=null;
}

// ── ELIMINAR ─────────────────────────────────────────────────
var pendingDel=null;
function pedirEliminar(id,nombre){
    pendingDel=id;
    document.getElementById('confirmMsg').textContent='Se eliminará el registro de "'+nombre+'". Esta acción no se puede deshacer.';
    document.getElementById('confirmOverlay').classList.add('open');
    document.getElementById('confirmOkBtn').onclick=ejecutarEliminar;
}
window.pedirEliminar=pedirEliminar;
function cerrarConfirm(){document.getElementById('confirmOverlay').classList.remove('open');pendingDel=null;}
window.cerrarConfirm=cerrarConfirm;
async function ejecutarEliminar(){
    if(!pendingDel) return; cerrarConfirm();
    try{await deleteDoc(doc(db,COL,pendingDel));toast('Registro eliminado','warn');}
    catch(err){toast('Error: '+err.message,'err');}
}

// ── EXPORTAR EXCEL ────────────────────────────────────────────
function exportarExcel(){
    if(!datos.length){toast('No hay personal para exportar','warn');return;}
    var rows=[['Nombres','Apellidos','DNI','Teléfono','F. Nacimiento','Edad','Cargo','Zona','F. Ingreso','Tiempo Empresa','Tipo','Estado']];
    datos.forEach(function(r){
        rows.push([
            r.nombre, r.apellido, r.dni, r.telefono,
            r.fnacimiento, calcEdadDesde(r.fnacimiento)+' años',
            r.cargo, r.zona, r.fingreso,
            tiempoEnEmpresa(r.fingreso),
            r.tipo, r.estado
        ]);
    });
    var wb=XLSX.utils.book_new();
    var ws=XLSX.utils.aoa_to_sheet(rows);
    ws['!cols']=[{wch:16},{wch:18},{wch:10},{wch:13},{wch:13},{wch:8},{wch:22},{wch:14},{wch:13},{wch:18},{wch:10},{wch:10}];
    XLSX.utils.book_append_sheet(wb,ws,'Personal');
    XLSX.writeFile(wb,'CARZE_Personal.xlsx');
    toast('Excel generado ✓','ok');
}
window.exportarExcel=exportarExcel;

// ══════════════════════════════════════════════════════════════
// REGISTRO DE NÚMEROS DE CUENTA
// ══════════════════════════════════════════════════════════════

function poblarSelectsCuentas(){
    var selE=document.getElementById('cEntidad');
    var selB=document.getElementById('cBilletera');
    if(selE){
        BANCOS_PERU.forEach(function(b){
            var op=document.createElement('option'); op.value=b; op.textContent=b; selE.appendChild(op);
        });
    }
    if(selB){
        BILLETERAS_PERU.forEach(function(b){
            var op=document.createElement('option'); op.value=b; op.textContent=b; selB.appendChild(op);
        });
    }
}

// Sugerencias de nombres a partir del personal ya registrado (datalist, no obliga a elegir)
function poblarDatalistNombres(){
    var dl=document.getElementById('listaNombresPersonal');
    if(!dl) return;
    dl.innerHTML='';
    datos.forEach(function(r){
        var nombreCompleto=((r.apellido||'')+' '+(r.nombre||'')).trim();
        if(!nombreCompleto) return;
        var op=document.createElement('option'); op.value=nombreCompleto; dl.appendChild(op);
    });
}

function toggleOtraEntidad(){
    var v=document.getElementById('cEntidad').value;
    document.getElementById('rowOtraEntidad').style.display = v==='Otro' ? '' : 'none';
}
window.toggleOtraEntidad=toggleOtraEntidad;

function toggleOtraBilletera(){
    var v=document.getElementById('cBilletera').value;
    document.getElementById('rowOtraBilletera').style.display = v==='Otro' ? '' : 'none';
}
window.toggleOtraBilletera=toggleOtraBilletera;

function iniciarListenerCuentas(){
    onSnapshot(query(collection(db,COL_CUENTAS),orderBy('nombreCompleto','asc')),function(snap){
        cuentasData=snap.docs.map(function(d){var r=d.data();r._id=d.id;return r;});
        renderCuentas();
    },function(err){
        // Si las reglas de Firestore no incluyen esta colección, mostramos un aviso claro
        // en vez de fallar en silencio.
        if(document.getElementById('cuentasBody')){
            toast('No se pudo cargar Cuentas Bancarias: '+err.message,'err');
        }
    });
}

function renderCuentas(){
    var tbody=document.getElementById('cuentasBody');
    if(!tbody) return;
    var q=(document.getElementById('buscarCuenta').value||'').toLowerCase().trim();
    var filtrado=cuentasData.filter(function(r){
        if(!q) return true;
        return [r.nombreCompleto,r.entidadFinanciera,r.numeroCuenta,r.cci,r.billeteraDigital,r.numero]
            .some(function(v){return String(v||'').toLowerCase().includes(q);});
    });
    tbody.innerHTML='';
    document.getElementById('cuentasCount').textContent=filtrado.length+' cuenta'+(filtrado.length!==1?'s':'');
    document.getElementById('cuentasEmptyState').style.display=filtrado.length?'none':'flex';

    filtrado.forEach(function(r,idx){
        var tr=document.createElement('tr');
        tr.innerHTML=
          '<td>'+(idx+1)+'</td>'+
          '<td style="font-weight:700;color:var(--txt)">'+esc(r.nombreCompleto)+'</td>'+
          '<td>'+esc(r.entidadFinanciera)+'</td>'+
          '<td style="font-family:monospace;letter-spacing:.03em">'+esc(r.numeroCuenta)+'</td>'+
          '<td style="font-family:monospace;letter-spacing:.03em">'+esc(r.cci)+'</td>'+
          '<td>'+esc(r.billeteraDigital)+'</td>'+
          '<td>'+esc(r.numero)+'</td>'+
          '<td style="display:flex;gap:5px">'+
            '<button class="btn-edit-sm" onclick="editarCuenta(\''+r._id+'\')">✏️</button>'+
            '<button class="btn-del" onclick="pedirEliminarCuenta(\''+r._id+'\',\''+esc(r.nombreCompleto).replace(/'/g,"\\'")+'\')">🗑️</button>'+
          '</td>';
        tbody.appendChild(tr);
    });
}
window.renderCuentas=renderCuentas;

function abrirModalCuenta(){
    editCuentaId=null;
    limpiarCuenta();
    poblarDatalistNombres();
    document.getElementById('modalCuentaTitle').innerHTML='Nueva <span>Cuenta Bancaria</span>';
    document.getElementById('btnGuardarCuentaTxt').textContent='REGISTRAR';
    document.getElementById('overlayCuenta').classList.add('open');
}
window.abrirModalCuenta=abrirModalCuenta;

function editarCuenta(id){
    var r=cuentasData.find(function(x){return x._id===id;}); if(!r) return;
    editCuentaId=id;
    limpiarCuenta();
    poblarDatalistNombres();
    document.getElementById('cNombre').value=r.nombreCompleto||'';
    var esOtraEntidad = r.entidadFinanciera && BANCOS_PERU.indexOf(r.entidadFinanciera)===-1;
    document.getElementById('cEntidad').value = esOtraEntidad ? 'Otro' : (r.entidadFinanciera||'');
    document.getElementById('cEntidadOtro').value = esOtraEntidad ? r.entidadFinanciera : '';
    toggleOtraEntidad();
    document.getElementById('cNumeroCuenta').value=r.numeroCuenta||'';
    document.getElementById('cCCI').value=r.cci||'';
    var esOtraBilletera = r.billeteraDigital && BILLETERAS_PERU.indexOf(r.billeteraDigital)===-1;
    document.getElementById('cBilletera').value = esOtraBilletera ? 'Otro' : (r.billeteraDigital||'');
    document.getElementById('cBilleteraOtro').value = esOtraBilletera ? r.billeteraDigital : '';
    toggleOtraBilletera();
    document.getElementById('cNumero').value=r.numero||'';
    document.getElementById('modalCuentaTitle').innerHTML='Editar <span>Cuenta Bancaria</span>';
    document.getElementById('btnGuardarCuentaTxt').textContent='ACTUALIZAR';
    document.getElementById('overlayCuenta').classList.add('open');
}
window.editarCuenta=editarCuenta;

function cerrarModalCuenta(){document.getElementById('overlayCuenta').classList.remove('open');}
window.cerrarModalCuenta=cerrarModalCuenta;

function limpiarCuenta(){
    ['cNombre','cEntidadOtro','cNumeroCuenta','cCCI','cBilleteraOtro','cNumero'].forEach(function(id){document.getElementById(id).value='';});
    document.getElementById('cEntidad').value='';
    document.getElementById('cBilletera').value='';
    document.getElementById('rowOtraEntidad').style.display='none';
    document.getElementById('rowOtraBilletera').style.display='none';
}

async function guardarCuenta(){
    var nombreCompleto=document.getElementById('cNombre').value.trim();
    if(!nombreCompleto){toast('Ingresa Apellidos y Nombres','err');return;}

    var entidad=document.getElementById('cEntidad').value;
    if(entidad==='Otro') entidad=document.getElementById('cEntidadOtro').value.trim();
    var billetera=document.getElementById('cBilletera').value;
    if(billetera==='Otro') billetera=document.getElementById('cBilleteraOtro').value.trim();

    var btn=document.getElementById('btnGuardarCuenta');
    var txt=document.getElementById('btnGuardarCuentaTxt');
    btn.disabled=true; txt.innerHTML='<span class="spinner"></span>';

    var docData={
        nombreCompleto:nombreCompleto,
        entidadFinanciera:entidad||'-',
        numeroCuenta:document.getElementById('cNumeroCuenta').value.trim()||'-',
        cci:document.getElementById('cCCI').value.trim()||'-',
        billeteraDigital:billetera||'-',
        numero:document.getElementById('cNumero').value.trim()||'-',
        updatedAt:serverTimestamp()
    };
    try{
        if(editCuentaId){
            await updateDoc(doc(db,COL_CUENTAS,editCuentaId),docData);
            toast('Cuenta actualizada ✓','ok');
        }else{
            docData.createdAt=serverTimestamp();
            await addDoc(collection(db,COL_CUENTAS),docData);
            toast('Cuenta registrada ✓','ok');
        }
        btn.disabled=false; txt.textContent=editCuentaId?'ACTUALIZAR':'REGISTRAR';
        cerrarModalCuenta();
    }catch(err){
        btn.disabled=false; txt.textContent=editCuentaId?'ACTUALIZAR':'REGISTRAR';
        toast('Error: '+err.message,'err');
    }
}
window.guardarCuenta=guardarCuenta;

function pedirEliminarCuenta(id,nombre){
    pendingDelCuenta=id;
    document.getElementById('confirmMsg').textContent='Se eliminará la cuenta bancaria de "'+nombre+'". Esta acción no se puede deshacer.';
    document.getElementById('confirmOverlay').classList.add('open');
    document.getElementById('confirmOkBtn').onclick=ejecutarEliminarCuenta;
}
window.pedirEliminarCuenta=pedirEliminarCuenta;

async function ejecutarEliminarCuenta(){
    if(!pendingDelCuenta) return; var id=pendingDelCuenta; cerrarConfirm();
    try{await deleteDoc(doc(db,COL_CUENTAS,id));toast('Cuenta eliminada','warn');}
    catch(err){toast('Error: '+err.message,'err');}
    pendingDelCuenta=null;
}

function exportarCuentasExcel(){
    if(!cuentasData.length){toast('No hay cuentas para exportar','warn');return;}
    var rows=[['Apellidos y Nombres','Entidad Financiera','Número de Cuenta','CCI','Billetera Digital','Número']];
    cuentasData.forEach(function(r){
        rows.push([r.nombreCompleto,r.entidadFinanciera,r.numeroCuenta,r.cci,r.billeteraDigital,r.numero]);
    });
    var wb=XLSX.utils.book_new();
    var ws=XLSX.utils.aoa_to_sheet(rows);
    ws['!cols']=[{wch:26},{wch:30},{wch:20},{wch:22},{wch:22},{wch:15}];
    XLSX.utils.book_append_sheet(wb,ws,'Cuentas');
    XLSX.writeFile(wb,'CARZE_Cuentas_Bancarias.xlsx');
    toast('Excel generado ✓','ok');
}
window.exportarCuentasExcel=exportarCuentasExcel;

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
