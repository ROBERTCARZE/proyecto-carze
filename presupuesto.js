/* ==========================================================================
   PRESUPUESTO.JS — Lógica del módulo de Presupuesto
   CARZE Contratistas Generales S.A.C.
   --------------------------------------------------------------------------
   Extraído de presupuesto.html tal cual estaba (mismo comportamiento, cero
   cambios de lógica) — undécimo módulo separado. Usa window.jspdf (cargado
   como script clásico en el HTML) dentro de generarPDF().
   ========================================================================== */
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";
import { getFirestore, collection, query, orderBy, onSnapshot, doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";

const firebaseConfig={
    apiKey:"AIzaSyAk1FGQia36Y2G08L-_mscMv5JnozmPYa0",
    authDomain:"gestioncarze.firebaseapp.com",
    projectId:"gestioncarze",
    storageBucket:"gestioncarze.firebasestorage.app",
    messagingSenderId:"487407475826",
    appId:"1:487407475826:web:32185a60f0123a5d25f6eb"
};
const app=initializeApp(firebaseConfig);
const auth=getAuth(app);
const db=getFirestore(app);

// ── SESIÓN (igual que el resto de módulos) ──────────────────────
onAuthStateChanged(auth, function(user){
    if(!user){ window.location.replace('index.html'); return; }
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
    function p2(v){return v<10?'0'+v:String(v);}
    document.getElementById('fechaHoy').textContent=
        p2(hoyD.getDate())+' '+['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][hoyD.getMonth()]+' '+hoyD.getFullYear();
});

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

// ── HELPERS ───────────────────────────────────────────────────
function esc(v){return(v!=null&&v!==''&&v!=='-'&&v!=='—')?String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'):'—';}
function fmt(n){return parseFloat(n||0).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2});}
function docLink(nombre,link){
    if(!nombre||nombre==='-'||nombre==='—') return '<span class="muted-cell">—</span>';
    if(link&&link!=='-'&&link!=='—')
        return '<a class="doc-link" href="'+String(link).replace(/"/g,'&quot;')+'" target="_blank" rel="noopener">'+String(nombre).replace(/</g,'&lt;')+'</a>';
    return String(nombre).replace(/</g,'&lt;');
}
function pillEstado(e){
    var k=(e||'').toLowerCase();
    var c={pendiente:'pendiente',observado:'observado'}[k]||'pendiente';
    return '<span class="pill '+c+'"><span class="pill-dot"></span>'+esc(e)+'</span>';
}
function fmtFechaCorta(f){
    if(!f) return '—';
    var p=String(f).split('-');
    if(p.length!==3) return String(f);
    return p[2]+'/'+p[1]+'/'+p[0];
}
function diasEntre(f1,f2){
    if(!f1||!f2) return null;
    var d1=new Date(f1+'T00:00:00'), d2=new Date(f2+'T00:00:00');
    var diff=Math.round((d2-d1)/86400000)+1; // inclusivo
    return diff>0?diff:null;
}
function claveDoc(origen,id){ return (origen==='cotizacion'?'cot_':'cert_')+id; }
function sumaPresupuesto(presu){
    if(!presu||!presu.categorias) return 0;
    var t=0;
    presu.categorias.forEach(function(c){
        (c.lineas||[]).forEach(function(l){ t+=parseFloat(l.monto)||0; });
    });
    return t;
}

// ── CACHÉ EN MEMORIA (para poder cruzar datos de las 3 colecciones) ──
var cacheCot=[], cacheCert=[], cachePresu={};

function escucharColeccion(nombreCol, setCache){
    var q=query(collection(db,nombreCol), orderBy('num','desc'));
    onSnapshot(q, function(snap){
        var data=[];
        snap.forEach(function(d){
            var r=d.data(); r._id=d.id;
            var est=(r.estado||'').toLowerCase();
            if(est!=='pendiente' && est!=='observado') return; // solo pendiente/observado
            data.push(r);
        });
        setCache(data);
        renderAll();
    }, function(err){
        console.error('Error leyendo '+nombreCol+':', err);
    });
}
escucharColeccion('cotizaciones', function(d){ cacheCot=d; });
escucharColeccion('certificados', function(d){ cacheCert=d; });

onSnapshot(collection(db,'presupuestos'), function(snap){
    var map={};
    snap.forEach(function(d){ map[d.id]=d.data(); });
    cachePresu=map;
    renderAll();
}, function(err){ console.error('Error leyendo presupuestos:', err); });

function renderAll(){
    renderTabla('tablaCot','countCot',cacheCot,'cotizacion');
    renderTabla('tablaCert','countCert',cacheCert,'certificado');
}

// ── RENDER DE TABLA ───────────────────────────────────────────
function renderTabla(tbodyId, countId, data, origen){
    var tbody=document.getElementById(tbodyId);
    var countEl=document.getElementById(countId);
    if(!data.length){
        tbody.innerHTML='<tr class="empty-row"><td colspan="10">Sin proyectos activos por ahora.</td></tr>';
        countEl.textContent='0 registros';
        return;
    }
    countEl.textContent=data.length+' registro'+(data.length!==1?'s':'');

    // Los proyectos con Presupuesto ya "Finalizado" (fechaFin registrada) van
    // al final de la tabla — el resto (sin iniciar / en proceso) conserva su
    // orden normal arriba. Se usa un ordenamiento estable, así que dentro de
    // cada grupo no se altera el orden que ya traían.
    var conFinal=[], sinFinal=[];
    data.forEach(function(row){
        var docId=claveDoc(origen,row._id);
        var presu=cachePresu[docId];
        (presu && presu.fechaFin ? conFinal : sinFinal).push(row);
    });
    data = sinFinal.concat(conFinal);

    var html='';
    data.forEach(function(row){
        var est=(row.estado||'').toLowerCase();
        var docId=claveDoc(origen,row._id);
        var presu=cachePresu[docId];
        var finalizado = !!(presu && presu.fechaFin);
        var cls = finalizado ? 'row-finalizado' : ({pendiente:'row-pendiente',observado:'row-observado'}[est]||'');
        var costos=presu?sumaPresupuesto(presu):null;
        var sub=parseFloat(row.subtotal)||0;

        var celdaCostos='<span class="muted-cell">—</span>';
        var celdaRentab='<span class="muted-cell">—</span>';
        if(presu && costos!=null){
            celdaCostos='S/ '+fmt(costos);
            if(sub>0){
                var rentPct=((sub-costos)/sub*100);
                var dias=diasEntre(presu.fechaInicio,presu.fechaFin);
                var titleTxt='';
                if(dias){
                    var rentDia=(sub-costos)/dias;
                    titleTxt='Margen por día: S/ '+fmt(rentDia)+' ('+dias+' día'+(dias!==1?'s':'')+')';
                }
                celdaRentab='<span class="pct '+(rentPct>=0?'pos':'neg')+'" title="'+titleTxt+'">'+rentPct.toFixed(1)+'%</span>';
            }
        }

        var btnLabel='📊 Presupuesto', btnCls='activo';
        if(presu && presu.fechaFin){ btnLabel='✅ Finalizado'; btnCls='final'; }
        else if(presu){ btnLabel='✏️ En proceso'; btnCls='proceso'; }

        var pdfDisabled = !(presu && presu.fechaFin);
        var pdfBtn = pdfDisabled
            ? '<button class="btn-mini" title="Disponible cuando el proyecto tenga fecha de fin registrada" disabled>📄 PDF</button>'
            : '<button class="btn-mini final" title="Generar informe de cierre en PDF" onclick="generarPDF(\''+origen+'\',\''+row._id+'\')">📄 PDF</button>';

        html+='<tr class="'+cls+'">'+
            '<td>'+esc(row.num)+'</td>'+
            '<td>'+esc(row.cliente)+'</td>'+
            '<td>'+esc(row.zona)+'</td>'+
            '<td style="white-space:normal;min-width:180px" title="'+(row.desc||'')+'">'+esc(row.desc)+'</td>'+
            '<td>'+docLink(row.cotNombre,row.cotLink)+'</td>'+
            '<td>S/ '+fmt(row.subtotal)+'</td>'+
            '<td>'+pillEstado(row.estado)+'</td>'+
            '<td>'+celdaCostos+'</td>'+
            '<td>'+celdaRentab+'</td>'+
            '<td>'+
                '<button class="btn-mini '+btnCls+'" onclick="abrirModalPresupuesto(\''+origen+'\',\''+row._id+'\')">'+btnLabel+'</button>'+
                pdfBtn+
            '</td>'+
        '</tr>';
    });
    tbody.innerHTML=html;
}

// ── MODAL DE PRESUPUESTO ──────────────────────────────────────
var DEFAULT_CATEGORIAS=['Costos Directos','Costos Indirectos','Personal','Transporte','Logística'];
var modalState=null; // {docId, origen, proyectoId, cliente, desc, subtotal, esNuevo, categorias:[{nombre,lineas:[{concepto,monto}]}]}

function abrirModalPresupuesto(origen, proyectoId){
    var lista = origen==='cotizacion' ? cacheCot : cacheCert;
    var row = lista.find(function(r){ return r._id===proyectoId; });
    if(!row){ return; }
    var docId=claveDoc(origen,proyectoId);
    var existente=cachePresu[docId];

    modalState={
        docId:docId, origen:origen, proyectoId:proyectoId,
        cliente:row.cliente, desc:row.desc, subtotal:parseFloat(row.subtotal)||0,
        esNuevo: !existente,
        fechaInicio: existente?(existente.fechaInicio||''):'',
        fechaFin: existente?(existente.fechaFin||''):'',
        duracionEstimada: existente&&existente.duracionEstimada!=null?String(existente.duracionEstimada):'',
        categorias: existente&&existente.categorias&&existente.categorias.length
            ? JSON.parse(JSON.stringify(existente.categorias))
            : DEFAULT_CATEGORIAS.map(function(n){return {nombre:n,lineas:[]};})
    };

    document.getElementById('modalPresuTitulo').textContent='Presupuesto — '+row.cliente;
    document.getElementById('modalPresuSub').textContent=(row.desc||'')+' · Cotizado: S/ '+fmt(row.subtotal);
    document.getElementById('presuFechaInicio').value=modalState.fechaInicio;
    document.getElementById('presuFechaFin').value=modalState.fechaFin;
    document.getElementById('presuDuracionEst').value=modalState.duracionEstimada;
    sincronizarCandadoDuracion();

    renderCategoriasModal();
    document.getElementById('overlayPresu').classList.add('open');
    document.body.style.overflow='hidden';
}
window.abrirModalPresupuesto=abrirModalPresupuesto;

function cerrarModalPresupuesto(){
    document.getElementById('overlayPresu').classList.remove('open');
    document.body.style.overflow='';
    modalState=null;
}
window.cerrarModalPresupuesto=cerrarModalPresupuesto;

function overlayClickPresu(e){
    if(e.target.id==='overlayPresu') cerrarModalPresupuesto();
}
window.overlayClickPresu=overlayClickPresu;

function renderCategoriasModal(){
    var cont=document.getElementById('categoriasContainer');
    var html='';
    modalState.categorias.forEach(function(cat,i){
        html+='<div class="cat-block">'+
            '<div class="cat-head">'+
                '<input class="cat-name" value="'+String(cat.nombre).replace(/"/g,'&quot;')+'" oninput="renombrarCategoria('+i+',this.value)">'+
                '<span class="cat-subtotal" id="catSub'+i+'">S/ 0.00</span>'+
                '<button class="cat-del" onclick="eliminarCategoria('+i+')" title="Eliminar categoría">🗑️</button>'+
            '</div>'+
            '<div class="cat-lineas" id="catLineas'+i+'">';
        cat.lineas.forEach(function(linea,j){
            html+='<div class="linea-row">'+
                '<input class="linea-concepto" placeholder="Concepto" value="'+String(linea.concepto||'').replace(/"/g,'&quot;')+'" oninput="actualizarLinea('+i+','+j+',\'concepto\',this.value)">'+
                '<input class="linea-monto" type="number" step="0.01" placeholder="0.00" value="'+(linea.monto||'')+'" oninput="actualizarLinea('+i+','+j+',\'monto\',this.value)">'+
                '<button class="linea-del" onclick="eliminarLinea('+i+','+j+')">✕</button>'+
            '</div>';
        });
        html+='</div>'+
            '<button class="cat-add-linea" onclick="agregarLinea('+i+')">+ Línea</button>'+
        '</div>';
    });
    cont.innerHTML=html;
    actualizarSubtotales();
}

function agregarCategoria(){
    var nombre=prompt('Nombre de la nueva categoría (ej. Materiales/Insumos, Maquinaria/Equipos, Técnicos de Apoyo, Imprevistos):');
    if(!nombre||!nombre.trim()) return;
    modalState.categorias.push({nombre:nombre.trim(),lineas:[]});
    renderCategoriasModal();
}
window.agregarCategoria=agregarCategoria;

function eliminarCategoria(i){
    if(!confirm('¿Eliminar la categoría "'+modalState.categorias[i].nombre+'" y todas sus líneas?')) return;
    modalState.categorias.splice(i,1);
    renderCategoriasModal();
}
window.eliminarCategoria=eliminarCategoria;

function renombrarCategoria(i,valor){
    modalState.categorias[i].nombre=valor;
}
window.renombrarCategoria=renombrarCategoria;

function agregarLinea(i){
    modalState.categorias[i].lineas.push({concepto:'',monto:''});
    renderCategoriasModal();
}
window.agregarLinea=agregarLinea;

function eliminarLinea(i,j){
    modalState.categorias[i].lineas.splice(j,1);
    renderCategoriasModal();
}
window.eliminarLinea=eliminarLinea;

function actualizarLinea(i,j,campo,valor){
    modalState.categorias[i].lineas[j][campo]=valor;
    actualizarSubtotales();
}
window.actualizarLinea=actualizarLinea;

function sincronizarCandadoDuracion(){
    var inputDur=document.getElementById('presuDuracionEst');
    var tag=document.getElementById('duracionAutoTag');
    var diasReales=diasEntre(modalState.fechaInicio, modalState.fechaFin);
    if(diasReales){
        inputDur.value=diasReales;
        inputDur.readOnly=true;
        inputDur.classList.add('finput-auto');
        tag.style.display='inline';
        modalState.duracionEstimada=String(diasReales);
    }else{
        inputDur.readOnly=false;
        inputDur.classList.remove('finput-auto');
        tag.style.display='none';
    }
}

function recalcularPresupuesto(){
    modalState.fechaInicio=document.getElementById('presuFechaInicio').value;
    modalState.fechaFin=document.getElementById('presuFechaFin').value;
    if(!document.getElementById('presuDuracionEst').readOnly){
        modalState.duracionEstimada=document.getElementById('presuDuracionEst').value;
    }
    sincronizarCandadoDuracion();
    actualizarSubtotales();
}
window.recalcularPresupuesto=recalcularPresupuesto;

function actualizarSubtotales(){
    var granTotal=0;
    modalState.categorias.forEach(function(cat,i){
        var sub=0;
        cat.lineas.forEach(function(l){ sub+=parseFloat(l.monto)||0; });
        granTotal+=sub;
        var elSub=document.getElementById('catSub'+i);
        if(elSub) elSub.textContent='S/ '+fmt(sub);
    });

    var sub=modalState.subtotal||0;
    var rentBruta=sub-granTotal;
    var rentPct=sub>0?(rentBruta/sub*100):0;
    var dias=diasEntre(modalState.fechaInicio, modalState.fechaFin);
    var rentDia=dias?(rentBruta/dias):null;
    var estDias=parseFloat(modalState.duracionEstimada)||null;

    var notaTxt='';
    if(!modalState.fechaInicio){
        notaTxt='Ingresa la fecha de inicio para calcular la duración y el margen por día.';
    } else if(!dias){
        notaTxt='Falta la fecha de fin para calcular la duración total y el margen por día.';
    } else {
        notaTxt='Duración total del proyecto: '+dias+' día'+(dias!==1?'s':'')+'.';
    }

    document.getElementById('resumenPresu').innerHTML=
        '<div class="resumen-item"><div class="resumen-label">Costos Totales</div><div class="resumen-valor">S/ '+fmt(granTotal)+'</div></div>'+
        '<div class="resumen-item"><div class="resumen-label">Rentabilidad</div><div class="resumen-valor '+(rentBruta>=0?'pos':'neg')+'">S/ '+fmt(rentBruta)+'</div></div>'+
        '<div class="resumen-item"><div class="resumen-label">Rentabilidad %</div><div class="resumen-valor '+(rentPct>=0?'pos':'neg')+'">'+rentPct.toFixed(1)+'%</div></div>'+
        '<div class="resumen-item"><div class="resumen-label">Margen por día</div><div class="resumen-valor '+(rentDia!=null&&rentDia>=0?'pos':rentDia!=null?'neg':'')+'">'+(rentDia!=null?('S/ '+fmt(rentDia)):'—')+'</div></div>'+
        (notaTxt?'<div class="resumen-nota">'+notaTxt+'</div>':'');
}

async function guardarPresupuesto(){
    if(!modalState.fechaInicio){
        alert('Ingresa la fecha de inicio del proyecto antes de guardar.');
        return;
    }
    var btn=document.getElementById('btnGuardarPresu');
    btn.disabled=true; btn.textContent='Guardando…';

    var dataDoc={
        origen: modalState.origen,
        proyectoId: modalState.proyectoId,
        fechaInicio: modalState.fechaInicio,
        fechaFin: modalState.fechaFin||null,
        duracionEstimada: modalState.duracionEstimada?parseFloat(modalState.duracionEstimada):null,
        categorias: modalState.categorias,
        updatedAt: serverTimestamp()
    };
    if(modalState.esNuevo) dataDoc.createdAt=serverTimestamp();

    try{
        await setDoc(doc(db,'presupuestos',modalState.docId), dataDoc, {merge:!modalState.esNuevo});
        cerrarModalPresupuesto();
    }catch(err){
        console.error(err);
        alert('No se pudo guardar el presupuesto. Intenta de nuevo.');
    }finally{
        btn.disabled=false; btn.textContent='Guardar Presupuesto';
    }
}
window.guardarPresupuesto=guardarPresupuesto;

document.addEventListener('keydown', function(e){
    if(e.key==='Escape') cerrarModalPresupuesto();
});

// ── GENERACIÓN DE PDF (informe de cierre por proyecto) ────────────
function cargarLogoDataURL(){
    return new Promise(function(resolve){
        var img=new Image();
        img.onload=function(){
            try{
                var canvas=document.createElement('canvas');
                canvas.width=img.naturalWidth; canvas.height=img.naturalHeight;
                canvas.getContext('2d').drawImage(img,0,0);
                resolve({url:canvas.toDataURL('image/png'), w:img.naturalWidth, h:img.naturalHeight});
            }catch(e){ resolve(null); }
        };
        img.onerror=function(){ resolve(null); };
        img.src='img/logo_carze_1.png';
    });
}

// Century Gothic es una fuente comercial (Monotype) y no se puede incrustar
// legalmente en el PDF. Usamos "Poppins" (licencia libre SIL OFL), una
// geométrica muy cercana visualmente, cargada e incrustada en el momento.
var FUENTE_CACHE=null;
function arrayBufferABase64(buffer){
    var binary=''; var bytes=new Uint8Array(buffer);
    for(var i=0;i<bytes.byteLength;i++) binary+=String.fromCharCode(bytes[i]);
    return btoa(binary);
}
async function cargarFuentePoppins(doc){
    if(FUENTE_CACHE){
        doc.addFileToVFS('Poppins-Regular.ttf', FUENTE_CACHE.regular);
        doc.addFont('Poppins-Regular.ttf','Poppins','normal');
        doc.addFileToVFS('Poppins-Bold.ttf', FUENTE_CACHE.bold);
        doc.addFont('Poppins-Bold.ttf','Poppins','bold');
        return true;
    }
    try{
        var base='https://raw.githubusercontent.com/google/fonts/main/ofl/poppins/';
        var respR=await fetch(base+'Poppins-Regular.ttf');
        var respB=await fetch(base+'Poppins-Bold.ttf');
        var regular=arrayBufferABase64(await respR.arrayBuffer());
        var bold=arrayBufferABase64(await respB.arrayBuffer());
        FUENTE_CACHE={regular:regular, bold:bold};
        doc.addFileToVFS('Poppins-Regular.ttf', regular);
        doc.addFont('Poppins-Regular.ttf','Poppins','normal');
        doc.addFileToVFS('Poppins-Bold.ttf', bold);
        doc.addFont('Poppins-Bold.ttf','Poppins','bold');
        return true;
    }catch(e){
        console.warn('No se pudo cargar Poppins, se usará la fuente por defecto.', e);
        return false;
    }
}

function analisisNarrativo(d){
    var frases=[];
    frases.push('El proyecto generó un ingreso de S/ '+fmt(d.subtotal)+' y un costo ejecutado de S/ '+fmt(d.costos)+
        ', obteniendo una utilidad de S/ '+fmt(d.utilidad)+' y una rentabilidad de '+d.rentPct.toFixed(2)+'%.');
    if(d.dias){
        frases.push('La ejecución se realizó en '+d.dias+' día'+(d.dias!==1?'s':'')+' calendario, alcanzando una utilidad promedio diaria de S/ '+fmt(d.rentDia)+'.');
    }
    var cats=d.categorias.filter(function(c){return c.subtotal>0;}).sort(function(a,b){return b.subtotal-a.subtotal;});
    if(cats.length && d.costos>0){
        var p1=(cats[0].subtotal/d.costos*100).toFixed(2);
        if(cats.length>1){
            var p2=(cats[1].subtotal/d.costos*100).toFixed(2);
            frases.push('La categoría de "'+cats[0].nombre+'" representó el principal costo del proyecto ('+p1+'%), seguida por "'+cats[1].nombre+'" ('+p2+'%).');
        }else{
            frases.push('La categoría de "'+cats[0].nombre+'" concentró la totalidad de los costos registrados del proyecto.');
        }
    }
    return frases.join(' ');
}

function conclusionTexto(d, dominante){
    var base;
    if(d.costos===0) return 'Aún no se han registrado costos de ejecución para este proyecto.';
    if(d.rentPct>=40) base='El proyecto fue altamente rentable y ejecutado eficientemente. No se evidencian sobrecostos relevantes respecto a lo cotizado.';
    else if(d.rentPct>=20) base='El proyecto presentó una rentabilidad saludable, dentro de los márgenes esperados para este tipo de trabajos.';
    else if(d.rentPct>=0)  base='El proyecto presentó una rentabilidad ajustada. Se recomienda revisar los rubros de mayor costo en proyectos similares.';
    else base='El proyecto cerró con pérdidas respecto a lo cotizado. Se recomienda un análisis detallado de las causas del sobrecosto antes de asumir proyectos similares.';
    if(dominante){
        base+=' El principal componente del costo fue "'+dominante.nombre+'", por lo que este rubro merece especial atención en el control de proyectos de similar naturaleza.';
    }
    return base;
}

// Recomendaciones adaptadas al tipo de proyecto: cuál rubro domina el costo,
// cuánto duró, y qué tan rentable resultó. Así dos proyectos distintos no
// generan siempre el mismo texto.
function listaRecomendaciones(d, dominante){
    var recs=[];

    if(dominante){
        var n=dominante.nombre.toLowerCase();
        if(n.indexOf('directo')>-1 || n.indexOf('material')>-1 || n.indexOf('insumo')>-1){
            recs.push('Negociar mejores precios con proveedores de materiales, principal componente del costo en este proyecto.');
        }else if(n.indexOf('personal')>-1 || n.indexOf('mano de obra')>-1 || n.indexOf('técnic')>-1 || n.indexOf('tecnic')>-1){
            recs.push('Evaluar la asignación de horas de personal, ya que la mano de obra representó el mayor costo de este proyecto.');
        }else if(n.indexOf('transporte')>-1 || n.indexOf('logíst')>-1 || n.indexOf('logist')>-1){
            recs.push('Optimizar rutas y proveedores de transporte/logística, principal rubro de costo en este proyecto.');
        }else if(n.indexOf('maquinaria')>-1 || n.indexOf('equipo')>-1){
            recs.push('Evaluar la conveniencia de alquilar frente a adquirir maquinaria o equipos, dado su peso en el costo total.');
        }else{
            recs.push('Prestar especial atención al rubro "'+dominante.nombre+'", principal componente del costo de este proyecto.');
        }
    }else{
        recs.push('Negociar mejores precios con proveedores.');
    }

    recs.push('Mantener el control detallado de gastos por rubro.');

    if(d.dias){
        if(d.dias<=2) recs.push('Replicar el enfoque de ejecución rápida usado en este proyecto en trabajos de alcance similar.');
        else recs.push('Registrar horas-hombre a lo largo de la ejecución para medir productividad.');
    }

    if(d.rentPct<20 && d.rentPct>=0){
        recs.push('Evaluar renegociar el alcance o el precio cotizado en proyectos de características similares.');
    }
    if(d.rentPct<0){
        recs.push('Realizar un análisis de causa raíz de los sobrecostos antes de aceptar proyectos similares.');
    }
    return recs;
}

async function generarPDF(origen, proyectoId){
    var lista = origen==='cotizacion' ? cacheCot : cacheCert;
    var row = lista.find(function(r){ return r._id===proyectoId; });
    if(!row){ return; }
    var docId=claveDoc(origen,proyectoId);
    var presu=cachePresu[docId];
    if(!presu || !presu.fechaFin){
        alert('Este proyecto aún no está finalizado (falta la fecha de fin en su presupuesto).');
        return;
    }

    var categorias=(presu.categorias||[]).map(function(c){
        var sub=0;
        (c.lineas||[]).forEach(function(l){ sub+=parseFloat(l.monto)||0; });
        return {nombre:c.nombre, lineas:c.lineas||[], subtotal:sub};
    });
    var costos=categorias.reduce(function(a,c){return a+c.subtotal;},0);
    var subtotal=parseFloat(row.subtotal)||0;
    var utilidad=subtotal-costos;
    var rentPct=subtotal>0?(utilidad/subtotal*100):0;
    var dias=diasEntre(presu.fechaInicio,presu.fechaFin);
    var rentDia=dias?(utilidad/dias):null;
    var dominante=categorias.filter(function(c){return c.subtotal>0;}).sort(function(a,b){return b.subtotal-a.subtotal;})[0]||null;

    var datos={subtotal:subtotal,costos:costos,utilidad:utilidad,rentPct:rentPct,dias:dias,rentDia:rentDia,categorias:categorias};

    var jsPDFLib = window.jspdf.jsPDF;
    var doc = new jsPDFLib({unit:'mm', format:'a4'});

    var tieneFuente = await cargarFuentePoppins(doc);
    var FR = tieneFuente ? 'Poppins' : 'helvetica';
    doc.setLineHeightFactor(1.5);

    var pageW=210, marginL=16, marginR=16, contentW=pageW-marginL-marginR;
    var y=20;
    var COL_NAVY=[26,58,107], COL_TXT=[30,41,59], COL_MUTED=[100,116,139], COL_GREEN=[22,163,74], COL_RED=[220,38,38];
    var PT2MM=0.352778;
    function altoLinea(sizePt){ return sizePt*1.5*PT2MM; }

    function checkPageBreak(espacio){
        if(y+espacio>280){ doc.addPage(); y=20; }
    }
    function linea(x1,yy,x2,yy2,gris){
        doc.setDrawColor(gris?225:26, gris?232:58, gris?240:107);
        doc.setLineWidth(gris?0.2:0.6);
        doc.line(x1,yy,x2,yy2);
    }
    function parrafo(texto, sizePt){
        doc.setFont(FR,'normal'); doc.setFontSize(sizePt); doc.setTextColor(COL_TXT[0],COL_TXT[1],COL_TXT[2]);
        var lineHeight=altoLinea(sizePt);
        var lineas=doc.splitTextToSize(texto, contentW);
        lineas.forEach(function(ln,i){
            checkPageBreak(lineHeight);
            var esUltima = i===lineas.length-1;
            doc.text(ln, marginL, y, esUltima?{}:{maxWidth:contentW, align:'justify'});
            y+=lineHeight;
        });
        return lineas.length;
    }

    // ── ENCABEZADO (logo vertical: se dimensiona por alto, no por ancho, para no invadir el texto) ──
    var logo = await cargarLogoDataURL();
    var logoBoxH = 24; // alto reservado para el logo
    var tituloX = marginL;
    if(logo){
        var logoH=logoBoxH, logoW=logoH*(logo.w/logo.h);
        if(logoW>28){ logoW=28; logoH=logoW*(logo.h/logo.w); } // por si el logo fuera ancho en vez de vertical
        doc.addImage(logo.url,'PNG', marginL, y-4, logoW, logoH);
        tituloX = marginL+logoW+7;
    }
    doc.setFont(FR,'bold'); doc.setFontSize(14); doc.setTextColor(COL_NAVY[0],COL_NAVY[1],COL_NAVY[2]);
    doc.text('INFORME FINANCIERO DE', tituloX, y+2, {maxWidth: pageW-tituloX-marginR});
    doc.text('CIERRE DE PROYECTO', tituloX, y+8, {maxWidth: pageW-tituloX-marginR});
    doc.setFont(FR,'normal'); doc.setFontSize(9); doc.setTextColor(COL_MUTED[0],COL_MUTED[1],COL_MUTED[2]);
    doc.text('CARZE Contratistas Generales S.A.C.', tituloX, y+14);
    y += Math.max(logoBoxH, 18) + 4;
    linea(marginL,y,pageW-marginR,y,false);
    y+=9;

    // ── DATOS DEL PROYECTO ──
    doc.setFontSize(11);
    doc.setFont(FR,'bold'); doc.setTextColor(COL_TXT[0],COL_TXT[1],COL_TXT[2]);
    doc.text('Proyecto:', marginL, y);
    doc.setFont(FR,'normal');
    var descLines=doc.splitTextToSize(row.desc||'—', contentW-24);
    doc.text(descLines, marginL+24, y);
    y+=descLines.length*altoLinea(11)+3;

    doc.setFont(FR,'bold'); doc.text('Cliente:', marginL, y);
    doc.setFont(FR,'normal'); doc.text(String(row.cliente||'—'), marginL+18, y);
    doc.setFont(FR,'bold'); doc.text('Zona:', marginL+82, y);
    doc.setFont(FR,'normal'); doc.text(String(row.zona||'—'), marginL+95, y);
    doc.setFont(FR,'bold'); doc.text('Cotización:', marginL+132, y);
    doc.setFont(FR,'normal'); doc.text(String(row.cotNombre||row.num||'—'), marginL+155, y);
    y+=11;

    // ── I. ESTRUCTURA DE COSTOS ──
    checkPageBreak(20);
    doc.setFont(FR,'bold'); doc.setFontSize(12); doc.setTextColor(COL_NAVY[0],COL_NAVY[1],COL_NAVY[2]);
    doc.text('I. Estructura de Costos Incurridos', marginL, y);
    y+=3; linea(marginL,y,pageW-marginR,y,true); y+=7;

    doc.setFontSize(11);
    categorias.forEach(function(cat){
        if(!cat.lineas.length) return;
        checkPageBreak(10+cat.lineas.length*altoLinea(9.5));
        doc.setFont(FR,'bold'); doc.setFontSize(11); doc.setTextColor(COL_TXT[0],COL_TXT[1],COL_TXT[2]);
        doc.text(cat.nombre, marginL, y);
        doc.text('S/ '+fmt(cat.subtotal), pageW-marginR, y, {align:'right'});
        y+=altoLinea(11)*0.72;
        doc.setFont(FR,'normal'); doc.setFontSize(9.5); doc.setTextColor(COL_MUTED[0],COL_MUTED[1],COL_MUTED[2]);
        cat.lineas.forEach(function(l){
            checkPageBreak(altoLinea(9.5));
            doc.text(String(l.concepto||'—'), marginL+5, y);
            doc.text('S/ '+fmt(l.monto), pageW-marginR, y, {align:'right'});
            y+=altoLinea(9.5)*0.68;
        });
        y+=2;
    });
    checkPageBreak(10);
    linea(marginL,y,pageW-marginR,y,true); y+=6;
    doc.setFont(FR,'bold'); doc.setFontSize(11.5); doc.setTextColor(COL_NAVY[0],COL_NAVY[1],COL_NAVY[2]);
    doc.text('TOTAL', marginL, y);
    doc.text('S/ '+fmt(costos), pageW-marginR, y, {align:'right'});
    y+=12;

    // ── II. ANÁLISIS FINANCIERO ──
    checkPageBreak(55);
    doc.setFont(FR,'bold'); doc.setFontSize(12); doc.setTextColor(COL_NAVY[0],COL_NAVY[1],COL_NAVY[2]);
    doc.text('II. Análisis Financiero', marginL, y);
    y+=3; linea(marginL,y,pageW-marginR,y,true); y+=8;

    var filas=[
        ['Ingreso cotizado','S/ '+fmt(subtotal), null],
        ['Costo total de ejecución','S/ '+fmt(costos), null],
        ['Utilidad','S/ '+fmt(utilidad), utilidad>=0?COL_GREEN:COL_RED],
        ['Rentabilidad', rentPct.toFixed(2)+'%', rentPct>=0?COL_GREEN:COL_RED],
        ['Fecha de inicio', fmtFechaCorta(presu.fechaInicio), null],
        ['Fecha de fin', fmtFechaCorta(presu.fechaFin), null],
        ['Duración del proyecto', dias?(dias+' día'+(dias!==1?'s':'')):'—', null]
    ];
    doc.setFontSize(11);
    filas.forEach(function(f){
        checkPageBreak(7);
        doc.setFont(FR,'normal'); doc.setTextColor(COL_TXT[0],COL_TXT[1],COL_TXT[2]);
        doc.text(f[0], marginL, y);
        doc.setFont(FR,'bold');
        if(f[2]) doc.setTextColor(f[2][0],f[2][1],f[2][2]); else doc.setTextColor(COL_TXT[0],COL_TXT[1],COL_TXT[2]);
        doc.text(f[1], pageW-marginR, y, {align:'right'});
        y+=7;
    });
    y+=4;

    parrafo(analisisNarrativo(datos), 11);
    y+=6;

    // ── III. CONCLUSIONES Y RECOMENDACIONES ──
    checkPageBreak(30);
    doc.setFont(FR,'bold'); doc.setFontSize(12); doc.setTextColor(COL_NAVY[0],COL_NAVY[1],COL_NAVY[2]);
    doc.text('III. Conclusiones y Recomendaciones', marginL, y);
    y+=3; linea(marginL,y,pageW-marginR,y,true); y+=8;

    parrafo(conclusionTexto(datos, dominante), 11);
    y+=5;

    doc.setFont(FR,'normal'); doc.setFontSize(11); doc.setTextColor(COL_TXT[0],COL_TXT[1],COL_TXT[2]);
    listaRecomendaciones(datos, dominante).forEach(function(rec){
        var lh=altoLinea(11);
        var recLines=doc.splitTextToSize(rec, contentW-7);
        checkPageBreak(recLines.length*lh);
        doc.text('\u2022', marginL, y);
        recLines.forEach(function(ln,i){
            doc.text(ln, marginL+5, y+i*lh);
        });
        y+=recLines.length*lh+1;
    });

    // ── PIE DE PÁGINA (todas las páginas) ──
    var totalPaginas=doc.internal.getNumberOfPages();
    for(var p=1;p<=totalPaginas;p++){
        doc.setPage(p);
        doc.setFont(FR,'normal'); doc.setFontSize(7.5); doc.setTextColor(COL_MUTED[0],COL_MUTED[1],COL_MUTED[2]);
        doc.text('Generado automáticamente por el Sistema de Gestión CARZE — '+new Date().toLocaleDateString('es-PE'), marginL, 290);
        doc.text('Página '+p+' de '+totalPaginas, pageW-marginR, 290, {align:'right'});
    }

    var nombreArchivo='Informe_'+String(row.cliente||'Proyecto').replace(/[^a-zA-Z0-9]+/g,'_')+'_'+String(row.num||proyectoId)+'.pdf';
    doc.save(nombreArchivo);
}
window.generarPDF=generarPDF;
