/* ==========================================================================
   FLUJO_CAJA.JS — Lógica del módulo de Flujo de Caja
   CARZE Contratistas Generales S.A.C.
   --------------------------------------------------------------------------
   Extraído de flujo_caja.html tal cual estaba (mismo comportamiento, cero
   cambios de lógica) — módulo 13 separado.
   ========================================================================== */
import { initializeApp }   from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";
import { getFirestore, collection,
         onSnapshot, doc } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";

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

// ── CONFIG ───────────────────────────────────────────────────
const AÑO_ACTUAL = 2026;
const MES_FIN    = 12; // Diciembre

const CAT_LABELS={
    SCOTIABANK:'Scotiabank',INTERBANK:'Interbank',
    COSTOS_DIRECTOS:'Costos Directos',GASTOS_DE_PERSONAL:'Personal',
    LOGISTICA_Y_CAMPO:'Logística y Campo',FINANCIERO_CAJA:'Financiero / Caja',
    GASTOS_ADMINISTRATIVOS_Y_FIJOS:'Administrativo y Fijos',
    GASTOS_INDIRECTOS:'Gastos Indirectos',AHORRO:'Ahorro'
};
const CAT_TIPO={
    SCOTIABANK:'ingreso',INTERBANK:'ingreso',AHORRO:'neutro',
    COSTOS_DIRECTOS:'egreso',GASTOS_DE_PERSONAL:'egreso',
    LOGISTICA_Y_CAMPO:'egreso',FINANCIERO_CAJA:'egreso',
    GASTOS_ADMINISTRATIVOS_Y_FIJOS:'egreso',GASTOS_INDIRECTOS:'egreso'
};
const MESES_ES=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

var datos=[];
var flujoData={};

// ── CATEGORÍAS Y SUBCATEGORÍAS PERSONALIZADAS (Firestore) ──────
// Mismo documento compartido que usa Caja Diaria: caja_config/categorias
// { customCategorias:{ VALUE:{label,tipo,color,emoji} } }
// Así, cualquier categoría nueva que se cree desde el "+" de Caja Diaria
// aparece automáticamente aquí, con su nombre y su tipo correctos.
const configRef=doc(db,'caja_config','categorias');
var customCategorias={};

function iniciarConfigListener(){
    onSnapshot(configRef,function(snap){
        var data=snap.exists()?snap.data():{};
        customCategorias=data.customCategorias||{};
        Object.keys(customCategorias).forEach(function(val){
            CAT_LABELS[val]=customCategorias[val].label;
        });
        // Si ya se procesó el flujo, volver a renderizar con los nombres/tipos actualizados
        if(datos.length) procesarFlujo();
    },function(err){console.warn('No se pudo cargar categorías personalizadas:',err.message);});
}

// Tipo de una categoría (ingreso/egreso/neutro), con 3 niveles de resolución:
//  1) Mapa fijo CAT_TIPO (categorías originales del sistema)
//  2) Configuración guardada al crear la categoría desde el "+" (customCategorias)
//  3) Si no hay info (p.ej. datos antiguos o el doc de config no cargó aún),
//     se infiere según si esa categoría tuvo montos de ingreso, egreso o ambos.
function resolverTipoCategoria(cat,totales){
    if(CAT_TIPO[cat]) return CAT_TIPO[cat];
    if(customCategorias[cat]){
        var t=customCategorias[cat].tipo;
        return t==='ambos'?'neutro':(t||'egreso');
    }
    var t=totales||{ing:0,eg:0};
    if(t.ing>0 && !t.eg) return 'ingreso';
    if(t.eg>0 && !t.ing) return 'egreso';
    if(t.ing>0 && t.eg>0) return 'neutro';
    return 'egreso';
}

// Etiqueta legible de una categoría: usa CAT_LABELS/personalizadas si existen;
// si no, convierte el value técnico (p.ej. "CUSTOM_MARKETING_DIGITAL") en un
// texto presentable ("Marketing Digital") en vez de mostrarlo en crudo.
function labelCategoria(cat){
    if(CAT_LABELS[cat]) return CAT_LABELS[cat];
    return String(cat).replace(/^CUSTOM_/,'').replace(/_/g,' ').toLowerCase()
        .replace(/\b\w/g,function(c){return c.toUpperCase();});
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
    document.getElementById('avatarInitials').textContent=
        n.split(' ').map(function(p){return p[0]||'';}).slice(0,2).join('').toUpperCase()||'U';
    iniciarListener();
    iniciarConfigListener();
});

function iniciarListener(){
    onSnapshot(collection(db,'caja_diaria'),function(snap){
        datos=snap.docs.map(function(d){var r=d.data();r._id=d.id;return r;});
        datos.sort(function(a,b){return String(a.fecha||'').localeCompare(String(b.fecha||''));});
        procesarFlujo();
    },function(err){
        document.getElementById('loadingState').style.display='none';
        document.getElementById('emptyState').style.display='flex';
        toast('Error: '+err.message,'err');
    });
}

// ── HELPERS ──────────────────────────────────────────────────
function fmt(n){return parseFloat(n||0).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2});}
function p2(n){return n<10?'0'+n:String(n);}
function mesKey(fecha){return String(fecha||'').substring(0,7);}
function mesIdx(key){return parseInt(key.split('-')[1]||0)-1;}
function toast(msg,tipo){
    var t=document.getElementById('toast');
    t.textContent=msg;t.className='toast '+(tipo||'ok');t.classList.add('show');
    setTimeout(function(){t.classList.remove('show');},3200);
}

// ── PROCESAR FLUJO ────────────────────────────────────────────
function procesarFlujo(){
    if(!datos.length){
        document.getElementById('loadingState').style.display='none';
        document.getElementById('emptyState').style.display='flex';
        return;
    }

    // 1. Construir estructura mensual real
    // mesesReales: {'2026-01': {ing:X, eg:Y, cats:{CAT:{ing,eg,subs:{SUB:{ing,eg}}}}}}
    var mesesReales={};
    datos.forEach(function(r){
        var mk=mesKey(r.fecha);
        if(!mk) return;
        if(!mesesReales[mk]) mesesReales[mk]={ing:0,eg:0,cats:{}};
        var cat=r.categoria||'OTROS';
        var sub=r.subcategoria||'—';
        var monto=parseFloat(r.monto)||0;
        var esIng=r.tipo==='ingreso';
        if(esIng) mesesReales[mk].ing+=monto;
        else mesesReales[mk].eg+=monto;
        if(!mesesReales[mk].cats[cat]) mesesReales[mk].cats[cat]={ing:0,eg:0,subs:{}};
        if(esIng) mesesReales[mk].cats[cat].ing+=monto;
        else mesesReales[mk].cats[cat].eg+=monto;
        if(!mesesReales[mk].cats[cat].subs[sub]) mesesReales[mk].cats[cat].subs[sub]={ing:0,eg:0};
        if(esIng) mesesReales[mk].cats[cat].subs[sub].ing+=monto;
        else mesesReales[mk].cats[cat].subs[sub].eg+=monto;
    });

    // 2. Determinar meses reales disponibles
    var mesesKeys=Object.keys(mesesReales).sort();
    var mesActual=new Date().getFullYear()+'-'+p2(new Date().getMonth()+1);

    // 3. Calcular promedios últimos 3 meses reales para proyección
    var ultimos3=mesesKeys.slice(-3);
    var promIng=0, promEg=0;
    var promCats={};
    if(ultimos3.length>0){
        ultimos3.forEach(function(mk){
            promIng+=mesesReales[mk].ing;
            promEg +=mesesReales[mk].eg;
            Object.keys(mesesReales[mk].cats).forEach(function(cat){
                if(!promCats[cat]) promCats[cat]={ing:0,eg:0,subs:{}};
                promCats[cat].ing+=mesesReales[mk].cats[cat].ing;
                promCats[cat].eg +=mesesReales[mk].cats[cat].eg;
                Object.keys(mesesReales[mk].cats[cat].subs).forEach(function(sub){
                    if(!promCats[cat].subs[sub]) promCats[cat].subs[sub]={ing:0,eg:0};
                    promCats[cat].subs[sub].ing+=mesesReales[mk].cats[cat].subs[sub].ing;
                    promCats[cat].subs[sub].eg +=mesesReales[mk].cats[cat].subs[sub].eg;
                });
            });
        });
        var div=ultimos3.length;
        promIng/=div; promEg/=div;
        Object.keys(promCats).forEach(function(cat){
            promCats[cat].ing/=div; promCats[cat].eg/=div;
            Object.keys(promCats[cat].subs).forEach(function(sub){
                promCats[cat].subs[sub].ing/=div;
                promCats[cat].subs[sub].eg/=div;
            });
        });
    }

    // 4. Construir todos los meses del año hasta Diciembre
    // Detectar año y mes actual dinámicamente
    var hoyD=new Date();
    var anioHoy=hoyD.getFullYear();
    var mesHoy=hoyD.getMonth()+1;
    var mesActual=anioHoy+'-'+p2(mesHoy);
    // Usar AÑO_ACTUAL o el año de los datos (el más reciente)
    var anioUsar=AÑO_ACTUAL;
    // Si hay datos de otros años, incluirlos también
    var todosAnios=[...new Set(Object.keys(mesesReales).map(function(mk){return mk.split('-')[0];}))].sort();
    if(todosAnios.length>0) anioUsar=parseInt(todosAnios[todosAnios.length-1]);

    var todosMeses=[];
    // Incluir meses reales de todos los años + proyección hasta dic del año actual
    todosAnios.forEach(function(anio){
        for(var m=1;m<=12;m++){
            var mk2=anio+'-'+p2(m);
            if(mesesReales[mk2]) todosMeses.push(mk2);
        }
    });
    // Agregar meses futuros del año actual para proyección (si no están ya)
    for(var m=1;m<=MES_FIN;m++){
        var mk3=anioUsar+'-'+p2(m);
        if(todosMeses.indexOf(mk3)===-1) todosMeses.push(mk3);
    }
    todosMeses.sort();

    // 5. Llenar meses proyectados
    var mesesFlujo={};
    todosMeses.forEach(function(mk){
        var esReal=!!mesesReales[mk];
        var esFuturo=mk>mesActual;
        if(esReal){
            mesesFlujo[mk]={tipo:'real',data:mesesReales[mk]};
        } else if(esFuturo && ultimos3.length>0){
            // Proyección
            var dataProy={ing:promIng,eg:promEg,cats:{}};
            Object.keys(promCats).forEach(function(cat){
                dataProy.cats[cat]={ing:promCats[cat].ing,eg:promCats[cat].eg,subs:{}};
                Object.keys(promCats[cat].subs).forEach(function(sub){
                    dataProy.cats[cat].subs[sub]={ing:promCats[cat].subs[sub].ing,eg:promCats[cat].subs[sub].eg};
                });
            });
            mesesFlujo[mk]={tipo:'proyeccion',data:dataProy};
        }
    });

    flujoData={mesesFlujo:mesesFlujo,todosMeses:todosMeses,promIng:promIng,promEg:promEg};

    // 6. Actualizar UI
    document.getElementById('loadingState').style.display='none';
    document.getElementById('tablaFlujoContainer').style.display='block';

    actualizarKPIs(mesesFlujo,todosMeses);
    renderTabla(mesesFlujo,todosMeses);
}

// ── KPIs ──────────────────────────────────────────────────────
function actualizarKPIs(mesesFlujo,todosMeses){
    var ingReal=0,egReal=0,mesesConDatos=0;
    var saldoAcum=0,saldoFin=0;
    todosMeses.forEach(function(mk){
        var f=mesesFlujo[mk];
        if(!f) return;
        if(f.tipo==='real'){
            ingReal+=f.data.ing; egReal+=f.data.eg; mesesConDatos++;
            saldoAcum+=f.data.ing-f.data.eg;
        }
    });
    // Proyectar saldo final
    saldoFin=saldoAcum;
    todosMeses.forEach(function(mk){
        var f=mesesFlujo[mk];
        if(f&&f.tipo==='proyeccion') saldoFin+=f.data.ing-f.data.eg;
    });
    document.getElementById('kIngReal').textContent='S/ '+fmt(ingReal);
    document.getElementById('kEgReal').textContent='S/ '+fmt(egReal);
    document.getElementById('kSaldoAcum').textContent='S/ '+fmt(saldoAcum);
    document.getElementById('kSaldoAcum').style.color=saldoAcum>=0?'var(--azul2)':'var(--rojo)';
    document.getElementById('kProyFin').textContent='S/ '+fmt(saldoFin);
    document.getElementById('kProyFin').style.color=saldoFin>=0?'var(--amarillo)':'var(--rojo)';
    document.getElementById('kIngMeses').textContent=mesesConDatos+' mes'+(mesesConDatos!==1?'es':'')+ ' con datos reales';
}

// ── TABLA ─────────────────────────────────────────────────────
function renderTabla(mesesFlujo,todosMeses){
    var thead=document.getElementById('theadFlujo');
    var tbody=document.getElementById('tbodyFlujo');

    // Determinar qué meses tienen datos (real o proyección)
    var mesesActivos=todosMeses.filter(function(mk){return !!mesesFlujo[mk];});
    if(!mesesActivos.length){document.getElementById('emptyState').style.display='flex';document.getElementById('tablaFlujoContainer').style.display='none';return;}

    // THEAD
    var thRow='<tr><th style="min-width:200px">Concepto</th>';
    mesesActivos.forEach(function(mk){
        var f=mesesFlujo[mk];
        var mi=mesIdx(mk);
        var esProy=f.tipo==='proyeccion';
        thRow+='<th class="'+(esProy?'col-proy':'')+'" style="text-align:right;min-width:110px">'+
            MESES_ES[mi]+' <span class="'+(esProy?'badge-proy':'badge-real')+'">'+(esProy?'PROY':'REAL')+'</span></th>';
    });
    thRow+='<th style="text-align:right;min-width:120px">TOTAL AÑO</th></tr>';
    thead.innerHTML=thRow;

    // Recolectar todas las categorías y subcategorías (100% dinámico:
    // sale de los datos reales/proyectados, así que cualquier categoría o
    // subcategoría nueva creada en Caja Diaria aparece aquí automáticamente)
    var allCats={};
    var catTotales={};
    mesesActivos.forEach(function(mk){
        var f=mesesFlujo[mk];
        Object.keys(f.data.cats).forEach(function(cat){
            if(!allCats[cat]) allCats[cat]=new Set();
            if(!catTotales[cat]) catTotales[cat]={ing:0,eg:0};
            catTotales[cat].ing+=f.data.cats[cat].ing||0;
            catTotales[cat].eg +=f.data.cats[cat].eg||0;
            Object.keys(f.data.cats[cat].subs).forEach(function(sub){allCats[cat].add(sub);});
        });
    });

    // Separar ingresos y egresos (resolución robusta: fijo → personalizado → inferido)
    var catsIng=Object.keys(allCats).filter(function(c){
        var t=resolverTipoCategoria(c,catTotales[c]);
        return t==='ingreso'||t==='neutro';
    });
    var catsEg =Object.keys(allCats).filter(function(c){
        return resolverTipoCategoria(c,catTotales[c])==='egreso';
    });

    var rows='';

    // ── SALDO INICIAL (arrastrado del cierre del mes anterior) ──
    rows+=makeSaldoInicialRow(mesesActivos,mesesFlujo);

    // ── SECCIÓN INGRESOS ──
    rows+=makeSeccionRow('💚 INGRESOS',mesesActivos,mesesFlujo,'ing','cell-ing');
    catsIng.forEach(function(cat){
        var subs=Array.from(allCats[cat]);
        rows+=makeCatRow(cat,subs,mesesActivos,mesesFlujo,'ing');
    });
    rows+=makeTotalRow('TOTAL INGRESOS',mesesActivos,mesesFlujo,'ing','cell-ing');

    // ── SECCIÓN EGRESOS ──
    rows+=makeSeccionRow('🔴 EGRESOS',mesesActivos,mesesFlujo,'eg','cell-eg');
    catsEg.forEach(function(cat){
        var subs=Array.from(allCats[cat]);
        rows+=makeCatRow(cat,subs,mesesActivos,mesesFlujo,'eg');
    });
    rows+=makeTotalRow('TOTAL EGRESOS',mesesActivos,mesesFlujo,'eg','cell-eg');

    // ── SALDO FINAL (Saldo Inicial + Ingresos − Egresos, en cascada) ──
    rows+=makeSaldoFinalRow(mesesActivos,mesesFlujo);

    tbody.innerHTML=rows;
}

function makeSeccionRow(label,meses,flujo,campo,cls){
    var row='<tr class="row-cat" style="background:#f1f5f9"><td style="font-weight:800;font-size:.78rem;color:var(--azul);letter-spacing:.04em">'+label+'</td>';
    var total=0;
    meses.forEach(function(mk){
        var f=flujo[mk]; var val=f?f.data[campo]:0;
        total+=val||0;
        var esProy=f&&f.tipo==='proyeccion';
        row+='<td class="'+(esProy?'cell-proy ':'')+cls+'" style="text-align:right">'+(val?'S/ '+fmt(val):'—')+'</td>';
    });
    row+='<td class="'+cls+'" style="text-align:right;font-weight:800">S/ '+fmt(total)+'</td></tr>';
    return row;
}

function makeCatRow(cat,subs,meses,flujo,campo){
    var label=labelCategoria(cat);
    var rows='<tr class="row-cat"><td style="font-weight:700;font-size:.75rem">  '+label+'</td>';
    var totalCat=0;
    meses.forEach(function(mk){
        var f=flujo[mk];
        var val=f&&f.data.cats[cat]?f.data.cats[cat][campo]:0;
        totalCat+=val||0;
        var esProy=f&&f.tipo==='proyeccion';
        rows+='<td class="'+(esProy?'cell-proy ':'')+'" style="text-align:right;font-size:.74rem">'+(val?'S/ '+fmt(val):'—')+'</td>';
    });
    rows+='<td style="text-align:right;font-weight:700;font-size:.74rem">S/ '+fmt(totalCat)+'</td></tr>';
    // Subcategorías
    subs.forEach(function(sub){
        rows+='<tr class="row-sub"><td style="padding-left:32px;font-size:.71rem;color:var(--muted)">'+sub+'</td>';
        var totalSub=0;
        meses.forEach(function(mk){
            var f=flujo[mk];
            var val=f&&f.data.cats[cat]&&f.data.cats[cat].subs[sub]?f.data.cats[cat].subs[sub][campo]:0;
            totalSub+=val||0;
            var esProy=f&&f.tipo==='proyeccion';
            rows+='<td class="'+(esProy?'cell-proy':'')+'" style="text-align:right;font-size:.7rem;color:var(--muted)">'+(val?'S/ '+fmt(val):'—')+'</td>';
        });
        rows+='<td style="text-align:right;font-size:.7rem;color:var(--muted)">S/ '+fmt(totalSub)+'</td></tr>';
    });
    return rows;
}

function makeTotalRow(label,meses,flujo,campo,cls){
    var row='<tr class="row-total"><td>'+label+'</td>';
    var gran=0;
    meses.forEach(function(mk){
        var f=flujo[mk]; var val=f?f.data[campo]:0;
        gran+=val||0;
        var esProy=f&&f.tipo==='proyeccion';
        row+='<td class="'+(esProy?'cell-proy ':'')+cls+'" style="text-align:right;font-weight:800">S/ '+fmt(val||0)+'</td>';
    });
    row+='<td class="'+cls+'" style="text-align:right;font-weight:800">S/ '+fmt(gran)+'</td></tr>';
    return row;
}

// Saldo con el que arranca cada mes = el Saldo Final acumulado hasta el
// cierre del mes anterior. El primer mes que se muestra parte de S/ 0.00
// (no hay forma de saber el saldo real anterior al primer registro en
// Firebase, salvo que tú lo carges como un movimiento de "Saldo Inicial").
function makeSaldoInicialRow(meses,flujo){
    var row='<tr class="row-saldo" style="background:#eff6ff"><td style="font-weight:800;color:var(--azul2)">📊 SALDO INICIAL</td>';
    var acum=0;
    meses.forEach(function(mk){
        var f=flujo[mk];
        var esProy=f&&f.tipo==='proyeccion';
        var cls=acum>=0?(esProy?'cell-proy pos':'cell-pos'):(esProy?'cell-proy neg':'cell-neg');
        row+='<td class="'+cls+'" style="text-align:right;font-weight:700">S/ '+fmt(acum)+'</td>';
        acum+=f?(f.data.ing-f.data.eg):0;
    });
    row+='<td style="text-align:right;font-weight:700;color:var(--muted)">—</td></tr>';
    return row;
}

// Saldo Final = Saldo Inicial del mes + Ingresos − Egresos de ese mes.
// Se arrastra automáticamente como Saldo Inicial del mes siguiente
// (misma cascada que ves en la imagen de referencia).
function makeSaldoFinalRow(meses,flujo){
    var row='<tr class="row-saldo" style="background:#fffbeb"><td style="font-weight:800;color:#92400e">🏁 SALDO FINAL</td>';
    var acum=0;
    meses.forEach(function(mk){
        var f=flujo[mk];
        acum+=f?(f.data.ing-f.data.eg):0;
        var esProy=f&&f.tipo==='proyeccion';
        var cls=acum>=0?(esProy?'cell-proy pos':'cell-pos'):(esProy?'cell-proy neg':'cell-neg');
        row+='<td class="'+cls+'" style="text-align:right;font-weight:800">S/ '+fmt(acum)+'</td>';
    });
    // Columna "Total": no tiene sentido sumar saldos de distintos meses —
    // se muestra el saldo final más reciente (la posición de caja actual).
    row+='<td class="'+(acum>=0?'cell-pos':'cell-neg')+'" style="text-align:right;font-weight:800">S/ '+fmt(acum)+'</td></tr>';
    return row;
}

// ── EXPORTAR PDF ───────────────────────────────────────────────
function exportarPDF(){
    if(!Object.keys(flujoData).length){toast('No hay datos para exportar','warn');return;}
    // Actualizar fecha en cabecera PDF
    var ahora=new Date();
    var fechaStr=ahora.toLocaleDateString('es-PE',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
    var horaStr=ahora.toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'});
    var el=document.getElementById('pdfFecha');
    if(el) el.innerHTML='Generado: '+fechaStr+'<br>'+horaStr+'<br><strong style="color:#1a3a6b">Confidencial — Solo uso interno</strong>';
    // Lanzar impresión
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
