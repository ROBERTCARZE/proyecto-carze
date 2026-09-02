/* ==========================================================================
   FINANZAS.JS — Lógica de UI del módulo de Finanzas
   CARZE Contratistas Generales S.A.C.
   --------------------------------------------------------------------------
   Extraído de finanzas.html tal cual estaba (mismo comportamiento, cero
   cambios de lógica). Script CLÁSICO (no module) a propósito, para que sus
   funciones (cerrarSesion, cerrarModal, etc.) sigan siendo accesibles
   desde los onclick="" del HTML, igual que antes.
   ========================================================================== */
// Auth verificado por Firebase — ver módulo auth en <head>

// ── Préstamos: ahora vienen de Firestore (colección "prestamos"), ────
// ── ya NO están hardcodeados aquí. Se sincronizan en tiempo real. ────
let PRESTAMOS = [];
let _prestamosCargados = false;

function cargarPrestamosDesdeFirestore(){
    var col = window.__collection(window.__db, 'prestamos');
    window.__onSnapshot(col, function(snapshot){
        var lista = [];
        snapshot.forEach(function(docSnap){
            var data = docSnap.data();
            data._docId = docSnap.id; // id real del documento en Firestore
            // IMPORTANTE: recalcular siempre desde las cuotas reales, nunca
            // confiar en los totales que hayan quedado guardados — así, si
            // por lo que sea quedaron desactualizados (ej. un guardado viejo),
            // se autocorrigen solos en vez de pisar el cambio recién hecho.
            recalcPrestamo(data);
            lista.push(data);
        });
        // Mantener el mismo orden por id que tenía el array original
        lista.sort(function(a,b){ return (a.id||0) - (b.id||0); });
        PRESTAMOS = lista;
        _prestamosCargados = true;
        renderKPIs();
        renderVencimientos();
        renderResumen();
        // Si el modal del cronograma está abierto, "modalPrestamo" apunta a un
        // objeto de la lista VIEJA (antes de este refresco). Hay que
        // reapuntarlo al objeto nuevo (mismo id) o el modal se queda mostrando
        // datos huérfanos que ya no se actualizan con los siguientes cambios.
        if(modalPrestamo){
            var actualizado=PRESTAMOS.find(function(x){return x.id===modalPrestamo.id;});
            if(actualizado){ modalPrestamo=actualizado; renderModalContent(); }
        }
    }, function(err){
        console.error('Error leyendo préstamos de Firestore:', err);
        toast('No se pudieron cargar los préstamos. Revisa tu conexión.', 'error');
    });
}

// Guarda el estado actualizado de UN préstamo específico en Firestore
// (en vez de guardar los 10 en localStorage cada vez, como antes).
function guardarEstadoEnFirestore(prestamo){
    var refDoc = window.__doc(window.__db, 'prestamos', prestamo._docId || String(prestamo.id));
    window.__setDoc(refDoc, prestamo, { merge: true }).catch(function(err){
        console.error('Error guardando estado en Firestore:', err);
        toast('No se pudo guardar el cambio. Intenta de nuevo.', 'error');
    });
}
function recalcPrestamo(p){
    p.cuotasPagadas = p.cuotas.filter(function(c){return c.estado==='Pagado';}).length;
    p.totalPagado   = Math.round(p.cuotas.filter(function(c){return c.estado==='Pagado';}).reduce(function(s,c){return s+(c.cuota||c.apagar||0);},0)*100)/100;
    p.totalPendiente= Math.round(p.cuotas.filter(function(c){return c.estado!=='Pagado';}).reduce(function(s,c){return s+(c.cuota||c.apagar||0);},0)*100)/100;
}

// ── HELPERS ──────────────────────────────────────────────────
function fmt(n){return parseFloat(n||0).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2});}
function fmtF(v){if(!v||v===''||v==='None')return '—';var p=String(v).split('-');if(p.length===3)return p[2]+'/'+p[1]+'/'+p[0];return v;}
function toast(msg,tipo){var t=document.getElementById('toast');t.textContent=msg;t.className='toast '+(tipo||'ok');t.classList.add('show');setTimeout(function(){t.classList.remove('show');},2800);}

// Tipos de préstamo con formato bancario propio (llegaron de la migración
// inicial y conservan su desglose original: amortización, interés, etc).
// Cualquier préstamo NUEVO importado desde Excel usa tipo:'importado' y
// se renderiza de forma 100% genérica a partir de p.cols + c.extra.
var TIPOS_CONOCIDOS=['interbank_emp','stander','derrama','interbank_per','mibanco_emp','simple'];

window.addEventListener('carze_auth_ready',function(){
    var n=sessionStorage.getItem('carze_nombre')||'Usuario';
    document.getElementById('userName').textContent=n;
    document.getElementById('avatarInitials').textContent=n.split(' ').map(function(p){return p[0]||'';}).slice(0,2).join('').toUpperCase()||'U';
    cargarPrestamosDesdeFirestore();
});

// Devuelve la cuota "vigente" de un préstamo: la más próxima que aún no
// está Pagada (por fecha ascendente). Null si el préstamo ya está 100%
// pagado. Se usa tanto para el KPI "Cuota Mensual Total" como para la
// tabla de Próximos Vencimientos — así ambos quedan siempre sincronizados
// y bajan/suben juntos, sin lógica de "ciclo" aparte.
function proximaCuotaDe(p){
    var pend=p.cuotas.filter(function(c){return c.estado!=='Pagado';});
    if(!pend.length) return null;
    pend.sort(function(a,b){ return (a.fecha||'').localeCompare(b.fecha||''); });
    return pend[0];
}

function renderKPIs(){
    var totC=0,totPag=0,totPend=0,totCuota=0,activos=0;
    PRESTAMOS.forEach(function(p){
        totC+=p.totalCredito; totPag+=p.totalPagado; totPend+=p.totalPendiente;
        // Un préstamo ya Completado (sin cuotas restantes) no debe seguir
        // sumando en "préstamos activos" ni en la cuota mensual — ya no
        // representa un pago pendiente cada mes.
        var restante=(p.totalCuotas||0)-(p.cuotasPagadas||0);
        if(restante>0) activos++;
        // Cuota Mensual Total = suma de las cuotas VIGENTES (la próxima
        // pendiente de cada préstamo). Baja apenas se paga una cuota, y
        // sube de nuevo automáticamente al mes siguiente porque ahí
        // aparece la nueva cuota vigente de cada préstamo.
        var prox=proximaCuotaDe(p);
        if(prox) totCuota+=prox.cuota||0;
    });
    var pct=totC>0?Math.round(totPag/totC*100):0;
    document.getElementById('kTotal').textContent='S/ '+fmt(totC);
    document.getElementById('kTotalSub').textContent=activos+' préstamo'+(activos!==1?'s':'')+' activo'+(activos!==1?'s':'')+(PRESTAMOS.length>activos?' ('+(PRESTAMOS.length-activos)+' completado'+((PRESTAMOS.length-activos)!==1?'s':'')+')':'');
    document.getElementById('kPend').textContent='S/ '+fmt(totPend);
    document.getElementById('kPag').textContent='S/ '+fmt(totPag);
    document.getElementById('kPagPct').textContent=pct+'% del total cancelado';
    document.getElementById('kCuota').textContent='S/ '+fmt(totCuota);
}

// ── TABLA: PRÓXIMOS VENCIMIENTOS ─────────────────────────────
function renderVencimientos(){
    var tbody=document.getElementById('tbodyVencimientos');
    var wrap=document.getElementById('vencWrap');
    var empty=document.getElementById('emptyVenc');

    var filas=PRESTAMOS.map(function(p){
        return {p:p, c:proximaCuotaDe(p)};
    }).filter(function(x){ return x.c; });

    filas.sort(function(a,b){ return (a.c.fecha||'').localeCompare(b.c.fecha||''); });

    if(!filas.length){
        tbody.innerHTML='';
        wrap.querySelector('.table-scroll').style.display='none';
        empty.style.display=_prestamosCargados?'flex':'none';
        return;
    }
    wrap.querySelector('.table-scroll').style.display='';
    empty.style.display='none';

    var hoy=new Date(); hoy.setHours(0,0,0,0);
    tbody.innerHTML=filas.map(function(x){
        var p=x.p, c=x.c;
        var fechaObj=c.fecha?new Date(c.fecha+'T00:00:00'):null;
        var claseFecha='';
        if(fechaObj){
            if(fechaObj<hoy) claseFecha='venc-vencida';
            else if(fechaObj.getTime()===hoy.getTime()) claseFecha='venc-hoy';
        }
        var pill='<span class="pill-pend toggle-estado" onclick="toggleEstado('+p.id+','+c.n+')" title="Click para marcar como Pagado">⏳ Pendiente</span>';
        return '<tr class="'+claseFecha+'">'+
            '<td style="font-weight:700;color:var(--azul)">'+p.entidad+' <span style="font-weight:500;color:var(--muted)">— '+p.nombre+'</span></td>'+
            '<td>S/ '+fmt(c.cuota)+'</td>'+
            '<td>'+fmtF(c.fecha)+'</td>'+
            '<td>'+pill+'</td>'+
        '</tr>';
    }).join('');
}

function renderResumen(){
    var grid=document.getElementById('resumenGrid');
    grid.innerHTML='';
    if(_prestamosCargados && !PRESTAMOS.length){
        grid.innerHTML='<div style="grid-column:1/-1;padding:50px;text-align:center;color:var(--muted)">'+
            '<div style="font-size:2.4rem;opacity:.3;margin-bottom:8px">💳</div>'+
            '<p style="font-size:.85rem">Aún no hay créditos registrados. Usa "Importar Excel" para agregar el primero.</p></div>';
        return;
    }
    PRESTAMOS.forEach(function(p,i){
        var pct=p.totalCredito>0?Math.round(p.totalPagado/p.totalCredito*100):0;
        var rest=p.totalCuotas-p.cuotasPagadas;
        var div=document.createElement('div');
        div.className='loan-card';
        div.style.animationDelay=(i*0.06)+'s';
        div.innerHTML=
          '<div class="loan-top">'+
            '<div class="loan-top-row">'+
              '<div class="loan-nombre" onclick="editarNombre('+p.id+',this)" title="Click para editar">'+p.nombre+' ✏️</div>'+
              '<span class="loan-badge '+(rest>0?'badge-activo':'badge-pagado')+'">'+(rest>0?'Activo':'Completado')+'</span>'+
            '</div>'+
            '<div class="loan-meta">'+p.entidad+' · '+p.totalCuotas+' cuotas · <strong>S/ '+fmt(p.cuotaAmt)+'</strong> c/u</div>'+
            '<div class="prog-label"><span>Progreso</span><span style="color:'+p.color+';font-weight:800">'+pct+'%</span></div>'+
            '<div class="prog-bg"><div class="prog-fill" style="width:'+pct+'%;background:'+p.color+'"></div></div>'+
          '</div>'+
          '<div class="loan-stats">'+
            '<div class="loan-stat"><div class="stat-label">Pagado</div><div class="stat-val v-pag">S/ '+fmt(p.totalPagado)+'</div></div>'+
            '<div class="loan-stat"><div class="stat-label">Pendiente</div><div class="stat-val v-pend">S/ '+fmt(p.totalPendiente)+'</div></div>'+
            '<div class="loan-stat"><div class="stat-label">Cuotas</div><div class="stat-val v-cuot">'+p.cuotasPagadas+'/'+p.totalCuotas+'</div></div>'+
          '</div>'+
          '<div class="loan-foot">'+
            '<span style="font-size:.7rem;color:var(--muted)">Cuota mensual</span>'+
            '<div style="display:flex;align-items:center;gap:8px">'+
              '<span class="cuota-badge">S/ '+fmt(p.cuotaAmt)+'</span>'+
              '<button class="ver-btn" onclick="abrirCronograma('+p.id+')">Ver Cronograma ›</button>'+
            '</div>'+
          '</div>';
        grid.appendChild(div);
    });
}

// ── EDITAR NOMBRE ─────────────────────────────────────────────
function editarNombre(id,el){
    var p=PRESTAMOS.find(function(x){return x.id===id;}); if(!p) return;
    var inp=document.createElement('input');
    inp.value=p.nombre;
    inp.style.cssText='font-family:inherit;font-size:.88rem;font-weight:800;color:var(--azul);border:1.5px solid var(--naranja);border-radius:6px;padding:2px 8px;outline:none;width:220px';
    el.replaceWith(inp); inp.focus(); inp.select();
    function save(){var v=inp.value.trim()||p.nombre;p.nombre=v;renderResumen();toast('Nombre actualizado ✓','ok');}
    inp.addEventListener('blur',save);
    inp.addEventListener('keydown',function(e){if(e.key==='Enter')save();if(e.key==='Escape'){p.nombre=p.nombre;renderResumen();}});
}
window.editarNombre=editarNombre;

// ── CRONOGRAMA MODAL ──────────────────────────────────────────
var modalPrestamo=null, filtroEstado='all';

function abrirCronograma(id){
    modalPrestamo=PRESTAMOS.find(function(x){return x.id===id;}); if(!modalPrestamo) return;
    filtroEstado='all';
    document.getElementById('feAll').className='fe-btn active-all';
    document.getElementById('fePag').className='fe-btn';
    document.getElementById('fePend').className='fe-btn';
    renderModalContent();
    document.getElementById('overlay').classList.add('open');
}
window.abrirCronograma=abrirCronograma;

function filtrarEstado(f){
    filtroEstado=f;
    document.getElementById('feAll').className='fe-btn'+(f==='all'?' active-all':'');
    document.getElementById('fePag').className='fe-btn'+(f==='Pagado'?' active-pag':'');
    document.getElementById('fePend').className='fe-btn'+(f==='Pendiente'?' active-pend':'');
    renderCronTabla();
}
window.filtrarEstado=filtrarEstado;

function renderModalContent(){
    var p=modalPrestamo;
    var pct=p.totalCredito>0?Math.round(p.totalPagado/p.totalCredito*100):0;
    document.getElementById('modalTitle').innerHTML=p.nombre+' <span>— Cronograma</span>';
    document.getElementById('modalSub').textContent=p.entidad+' · '+p.totalCuotas+' cuotas · '+pct+'% pagado';
    // KPIs
    document.getElementById('modalKpis').innerHTML=
        mkpi('Total Crédito','S/ '+fmt(p.totalCredito),p.color)+
        mkpi('Total Pagado','S/ '+fmt(p.totalPagado),'#16a34a')+
        mkpi('Total Pendiente','S/ '+fmt(p.totalPendiente),'#dc2626')+
        mkpi('Cuotas Pagadas',p.cuotasPagadas+' / '+p.totalCuotas,'#1e40af')+
        mkpi('Cuotas Restantes',(p.totalCuotas-p.cuotasPagadas),'#f59e0b');
    // Thead
    document.getElementById('cronThead').innerHTML=p.cols.map(function(c){return '<th>'+c+'</th>';}).join('');
    renderCronTabla();
}

function mkpi(label,val,color){
    return '<div class="mkpi"><div class="mkpi-label">'+label+'</div><div class="mkpi-val" style="color:'+color+'">'+val+'</div></div>';
}

function renderCronTabla(){
    var p=modalPrestamo;
    var cuotas=filtroEstado==='all'?p.cuotas:p.cuotas.filter(function(c){return c.estado===filtroEstado;});
    var tbody=document.getElementById('cronTbody');
    tbody.innerHTML='';
    cuotas.forEach(function(c){
        var tr=document.createElement('tr');
        tr.className=c.estado==='Pagado'?'r-pag':'r-pend';
        var pill=c.estado==='Pagado'
            ? '<span class="pill-pag toggle-estado" onclick="toggleEstado('+p.id+','+c.n+')" title="Click para marcar como Pendiente">✓ Pagado</span>'
            : '<span class="pill-pend toggle-estado" onclick="toggleEstado('+p.id+','+c.n+')" title="Click para marcar como Pagado">⏳ Pendiente</span>';
        var cells='<td>'+c.n+'</td>';
        var tipo=p.tipo;
        if(tipo==='interbank_emp'){
            cells+='<td>'+fmtF(c.fecha)+'</td><td>S/ '+fmt(c.saldo)+'</td><td>S/ '+fmt(c.amort)+'</td><td>S/ '+fmt(c.int)+'</td><td>S/ '+fmt(c.desgrav)+'</td><td style="font-weight:700">S/ '+fmt(c.cuota)+'</td><td>'+pill+'</td>';
        } else if(tipo==='stander'){
            cells+='<td>S/ '+fmt(c.capital)+'</td><td>S/ '+fmt(c.int)+'</td><td style="font-weight:700">S/ '+fmt(c.cuota)+'</td><td>'+fmtF(c.fecha)+'</td><td>'+pill+'</td>';
        } else if(tipo==='derrama'){
            cells+='<td>'+fmtF(c.fecha)+'</td><td>S/ '+fmt(c.capital)+'</td><td>S/ '+fmt(c.int)+'</td><td>S/ '+fmt(c.desgrav)+'</td><td>S/ '+fmt(c.comision)+'</td><td style="font-weight:700">S/ '+fmt(c.cuota)+'</td><td>'+pill+'</td>';
        } else if(tipo==='interbank_per'){
            cells+='<td>S/ '+fmt(c.amort)+'</td><td>S/ '+fmt(c.int)+'</td><td>S/ '+fmt(c.seguro)+'</td><td style="font-weight:700">S/ '+fmt(c.cuota)+'</td><td>'+fmtF(c.fecha)+'</td><td>'+pill+'</td>';
        } else if(tipo==='mibanco_emp'){
            cells+='<td>'+fmtF(c.fecha)+'</td><td>S/ '+fmt(c.cuota_base)+'</td><td>S/ '+fmt(c.int)+'</td><td>S/ '+fmt(c.comision)+'</td><td style="font-weight:700">S/ '+fmt(c.cuota)+'</td><td>'+pill+'</td>';
        } else if(tipo==='simple'){
            cells+='<td>S/ '+fmt(c.cuota)+'</td><td>S/ '+fmt(c.apagar||c.cuota)+'</td><td>'+fmtF(c.fecha)+'</td><td>'+pill+'</td>';
        } else {
            // Genérico (préstamos importados desde Excel): recorre p.cols
            // dinámicamente. Estructura fija: [0]=N° [1]=Fecha ... [len-2]=Cuota Total [len-1]=Estado
            cells+='<td>'+fmtF(c.fecha)+'</td>';
            for(var ci=2; ci<p.cols.length-2; ci++){
                var colName=p.cols[ci];
                var val=(c.extra&&c.extra[colName]!=null)?c.extra[colName]:0;
                cells+='<td>S/ '+fmt(val)+'</td>';
            }
            cells+='<td style="font-weight:700">S/ '+fmt(c.cuota)+'</td><td>'+pill+'</td>';
        }
        tr.innerHTML=cells;
        tbody.appendChild(tr);
    });
    var pag=p.cuotas.filter(function(c){return c.estado==='Pagado';}).length;
    var pend=p.cuotas.filter(function(c){return c.estado!=='Pagado';}).length;
    document.getElementById('modalFootInfo').textContent=
        p.cuotas.length+' cuotas · '+pag+' pagadas · '+pend+' pendientes · Mostrando '+cuotas.length;
}

// ── TOGGLE ESTADO CUOTA ───────────────────────────────────────
function toggleEstado(prestamo_id, cuota_n){
    var p=PRESTAMOS.find(function(x){return x.id===prestamo_id;}); if(!p) return;
    var c=p.cuotas.find(function(x){return x.n===cuota_n;}); if(!c) return;
    c.estado = c.estado==='Pagado'?'Pendiente':'Pagado';
    recalcPrestamo(p);
    guardarEstadoEnFirestore(p);
    renderModalContent();
    renderResumen();
    renderKPIs();
    renderVencimientos();
    toast(c.estado==='Pagado'?'Cuota '+cuota_n+' marcada como Pagada ✓':'Cuota '+cuota_n+' marcada como Pendiente','ok');
}
window.toggleEstado=toggleEstado;

function cerrarModal(){document.getElementById('overlay').classList.remove('open');}
window.cerrarModal=cerrarModal;

// ── IMPORTAR EXCEL ───────────────────────────────────────────
// Plantilla esperada (una hoja = un préstamo completo):
//  Fila1: Nombre del préstamo | <valor>
//  Fila2: Entidad financiera  | <valor>
//  Fila3: Color (opcional)    | <valor hex, ej #0033a0>
//  Fila4: Monto total (opc.)  | <número; si vacío, se calcula solo>
//  Fila5: (vacía)
//  Fila6: encabezados -> N° | Fecha | ...columnas libres... | Cuota Total | Estado
//  Fila7+: datos de cada cuota
var IMP_SWATCHES=['#f97316','#0033a0','#7c3aed','#0891b2','#f59e0b','#dc2626','#16a34a','#475569'];
var _importPendiente=null; // {nombre,entidad,color,totalCredito,cols,cuotas}

function excelFechaATexto(v){
    if(v instanceof Date && !isNaN(v)){
        return v.getFullYear()+'-'+String(v.getMonth()+1).padStart(2,'0')+'-'+String(v.getDate()).padStart(2,'0');
    }
    if(typeof v==='string'){
        var s=v.trim();
        // dd/mm/aaaa -> aaaa-mm-dd
        var m=s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
        if(m) return m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0');
        if(/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        return s;
    }
    return '';
}

function onExcelSeleccionado(evt){
    var file=evt.target.files && evt.target.files[0];
    evt.target.value=''; // permite volver a elegir el mismo archivo después
    if(!file) return;
    var reader=new FileReader();
    reader.onload=function(e){
        try{
            var wb=XLSX.read(new Uint8Array(e.target.result),{type:'array',cellDates:true});
            var wsName=wb.SheetNames[0];
            var ws=wb.Sheets[wsName];
            var rows=XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:''});
            procesarFilasExcel(rows,file.name);
        }catch(err){
            console.error('Error leyendo Excel:',err);
            mostrarErrorImportar('No se pudo leer el archivo. Verifica que sea un .xlsx válido.');
        }
    };
    reader.onerror=function(){ mostrarErrorImportar('No se pudo abrir el archivo.'); };
    reader.readAsArrayBuffer(file);
}
window.onExcelSeleccionado=onExcelSeleccionado;

function procesarFilasExcel(rows,nombreArchivo){
    if(!rows || rows.length<7){
        mostrarErrorImportar('El archivo no tiene el formato esperado (faltan filas). Revisa la plantilla: nombre, entidad, color, monto, fila vacía, encabezados y cuotas.');
        return;
    }
    var nombre=String(rows[0][1]||'').trim();
    var entidad=String(rows[1][1]||'').trim();
    var color=String(rows[2][1]||'').trim();
    var totalManual=parseFloat(rows[3][1]);
    var headers=(rows[5]||[]).map(function(h){return String(h||'').trim();}).filter(function(h){return h!=='';});

    if(!nombre){ mostrarErrorImportar('Falta el "Nombre del préstamo" en la fila 1.'); return; }
    if(!entidad){ mostrarErrorImportar('Falta la "Entidad financiera" en la fila 2.'); return; }
    if(headers.length<4){ mostrarErrorImportar('La fila de encabezados (fila 6) debe tener al menos: N°, Fecha, Cuota Total, Estado.'); return; }
    if(!/^n/i.test(headers[0])){ mostrarErrorImportar('La primera columna de la fila 6 debe ser "N°".'); return; }
    if(!/fecha/i.test(headers[1])){ mostrarErrorImportar('La segunda columna de la fila 6 debe ser "Fecha".'); return; }
    if(!/estado/i.test(headers[headers.length-1])){ mostrarErrorImportar('La última columna de la fila 6 debe ser "Estado".'); return; }

    var dataRows=rows.slice(6).filter(function(r){return r && r.some(function(v){return v!=='' && v!=null;});});
    if(!dataRows.length){ mostrarErrorImportar('No se encontraron filas de cuotas después de los encabezados.'); return; }

    var cuotas=[]; var totalCuotaMonto=0; var erroresFila=[];
    dataRows.forEach(function(r,idx){
        var n=parseInt(r[0]);
        var fecha=excelFechaATexto(r[1]);
        var cuotaTotal=parseFloat(r[headers.length-2]);
        var estadoRaw=String(r[headers.length-1]||'').trim().toLowerCase();
        var estado=/pag/.test(estadoRaw)?'Pagado':'Pendiente';
        if(!n || isNaN(cuotaTotal)){ erroresFila.push('Fila '+(idx+7)+' de la hoja'); return; }
        var extra={};
        for(var ci=2; ci<headers.length-2; ci++){
            var v=parseFloat(r[ci]);
            extra[headers[ci]]=isNaN(v)?0:v;
        }
        cuotas.push({n:n,fecha:fecha,cuota:Math.round(cuotaTotal*100)/100,estado:estado,extra:extra});
        totalCuotaMonto+=cuotaTotal;
    });

    if(erroresFila.length){
        mostrarErrorImportar('Hay '+erroresFila.length+' fila(s) con datos incompletos o inválidos (N° o Cuota Total). Revisa: '+erroresFila.slice(0,5).join(', ')+(erroresFila.length>5?'...':''));
        return;
    }

    var totalCredito=(!isNaN(totalManual) && totalManual>0) ? totalManual : Math.round(totalCuotaMonto*100)/100;

    _importPendiente={
        nombre:nombre, entidad:entidad,
        color:/^#[0-9a-f]{6}$/i.test(color)?color:IMP_SWATCHES[0],
        totalCredito:totalCredito,
        cols:headers,
        cuotas:cuotas,
        archivo:nombreArchivo
    };
    mostrarPreviewImportar();
}

function mostrarErrorImportar(msg){
    _importPendiente=null;
    document.getElementById('impSub').textContent='Revisa el archivo e intenta de nuevo';
    document.getElementById('impBody').innerHTML='<div style="background:#fef2f2;border:1.5px solid #fecaca;border-radius:10px;padding:14px 16px;font-size:.8rem;color:#b91c1c;line-height:1.5">⚠️ '+msg+'</div>';
    document.getElementById('impFootInfo').textContent='';
    document.getElementById('btnConfirmarImportar').style.display='none';
    document.getElementById('overlayImportar').classList.add('open');
}

function mostrarPreviewImportar(){
    var d=_importPendiente;
    document.getElementById('impSub').textContent=d.archivo;
    var pagadas=d.cuotas.filter(function(c){return c.estado==='Pagado';}).length;
    var head='<tr>'+d.cols.map(function(h){return '<th>'+h+'</th>';}).join('')+'</tr>';
    var filasPreview=d.cuotas.slice(0,5);
    var body=filasPreview.map(function(c){
        var extraVals=d.cols.slice(2,-2).map(function(h){return '<td>S/ '+fmt(c.extra[h])+'</td>';}).join('');
        return '<tr class="'+(c.estado==='Pagado'?'r-pag':'r-pend')+'"><td>'+c.n+'</td><td>'+fmtF(c.fecha)+'</td>'+extraVals+'<td style="font-weight:700">S/ '+fmt(c.cuota)+'</td><td>'+c.estado+'</td></tr>';
    }).join('');
    var masFilas=d.cuotas.length>5?'<tr><td colspan="'+d.cols.length+'" style="text-align:center;color:var(--muted);font-style:italic">… y '+(d.cuotas.length-5)+' cuota(s) más</td></tr>':'';

    document.getElementById('impBody').innerHTML=
        '<div class="frow-2" style="margin-bottom:16px">'+
          '<div><div style="font-size:.68rem;color:var(--muted);font-weight:700;margin-bottom:2px">PRÉSTAMO</div><div style="font-size:.85rem;font-weight:800;color:var(--azul)">'+d.nombre+'</div></div>'+
          '<div><div style="font-size:.68rem;color:var(--muted);font-weight:700;margin-bottom:2px">ENTIDAD</div><div style="font-size:.85rem;font-weight:700">'+d.entidad+'</div></div>'+
        '</div>'+
        '<div class="frow-2" style="margin-bottom:16px">'+
          '<div><div style="font-size:.68rem;color:var(--muted);font-weight:700;margin-bottom:2px">CUOTAS DETECTADAS</div><div style="font-size:.85rem;font-weight:700">'+d.cuotas.length+' ('+pagadas+' pagadas)</div></div>'+
          '<div><div style="font-size:.68rem;color:var(--muted);font-weight:700;margin-bottom:2px">MONTO TOTAL</div><div style="font-size:.85rem;font-weight:700">S/ '+fmt(d.totalCredito)+'</div></div>'+
        '</div>'+
        '<div style="border:1px solid var(--border);border-radius:10px;overflow:auto;max-height:220px">'+
          '<table class="cron-table"><thead>'+head+'</thead><tbody>'+body+masFilas+'</tbody></table>'+
        '</div>';
    document.getElementById('impFootInfo').textContent='Revisa que las cuotas y el estado se hayan leído bien antes de confirmar.';
    document.getElementById('btnConfirmarImportar').style.display='';
    document.getElementById('overlayImportar').classList.add('open');
}

function cerrarModalImportar(){
    document.getElementById('overlayImportar').classList.remove('open');
    _importPendiente=null;
}
window.cerrarModalImportar=cerrarModalImportar;

async function confirmarImportarExcel(){
    if(!_importPendiente) return;
    var d=_importPendiente;
    var maxId=PRESTAMOS.reduce(function(m,p){return Math.max(m,p.id||0);},0);
    var nuevoId=maxId+1;

    var nuevoPrestamo={
        id:nuevoId,
        nombre:d.nombre,
        entidad:d.entidad,
        color:d.color,
        totalCredito:d.totalCredito,
        cuotaAmt:d.cuotas.length?d.cuotas[0].cuota:0,
        totalCuotas:d.cuotas.length,
        cuotasPagadas:0,
        totalPagado:0,
        totalPendiente:0,
        cols:d.cols,
        tipo:'importado',
        cuotas:d.cuotas
    };
    recalcPrestamo(nuevoPrestamo);

    var btn=document.getElementById('btnConfirmarImportar');
    var txt=document.getElementById('btnConfirmarImportarTxt');
    btn.disabled=true; var prevTxt=txt.textContent; txt.innerHTML='<span class="spinner"></span>';
    try{
        var refDoc=window.__doc(window.__db,'prestamos',String(nuevoId));
        await window.__setDoc(refDoc,nuevoPrestamo);
        toast('Préstamo "'+d.nombre+'" importado ✓','ok');
        cerrarModalImportar();
    }catch(err){
        console.error('Error importando crédito:',err);
        toast('No se pudo guardar el préstamo. Intenta de nuevo.','err');
    }finally{
        btn.disabled=false; txt.textContent=prevTxt;
    }
}
window.confirmarImportarExcel=confirmarImportarExcel;

// ── EXPORTAR PDF (reporte horizontal) ────────────────────────
function colsMediasDe(p){
    if(TIPOS_CONOCIDOS.indexOf(p.tipo)>=0) return p.cols.slice(1,-1); // header ya definido a mano por tipo
    return p.cols.slice(1,-1); // Fecha + columnas libres + Cuota Total (sin N° ni Estado)
}
function valoresFilaPDF(p,c){
    // Devuelve los valores en el mismo orden que colsMediasDe(p), como texto "S/ x.xx" o fecha
    if(TIPOS_CONOCIDOS.indexOf(p.tipo)>=0){
        if(p.tipo==='interbank_emp') return [fmtF(c.fecha),'S/ '+fmt(c.saldo),'S/ '+fmt(c.amort),'S/ '+fmt(c.int),'S/ '+fmt(c.desgrav),'S/ '+fmt(c.cuota)];
        if(p.tipo==='stander') return ['S/ '+fmt(c.capital),'S/ '+fmt(c.int),'S/ '+fmt(c.cuota),fmtF(c.fecha)];
        if(p.tipo==='derrama') return [fmtF(c.fecha),'S/ '+fmt(c.capital),'S/ '+fmt(c.int),'S/ '+fmt(c.desgrav),'S/ '+fmt(c.comision),'S/ '+fmt(c.cuota)];
        if(p.tipo==='interbank_per') return ['S/ '+fmt(c.amort),'S/ '+fmt(c.int),'S/ '+fmt(c.seguro),'S/ '+fmt(c.cuota),fmtF(c.fecha)];
        if(p.tipo==='mibanco_emp') return [fmtF(c.fecha),'S/ '+fmt(c.cuota_base),'S/ '+fmt(c.int),'S/ '+fmt(c.comision),'S/ '+fmt(c.cuota)];
        if(p.tipo==='simple') return ['S/ '+fmt(c.cuota),'S/ '+fmt(c.apagar||c.cuota),fmtF(c.fecha)];
    }
    var out=[fmtF(c.fecha)];
    for(var ci=2; ci<p.cols.length-2; ci++){ out.push('S/ '+fmt((c.extra&&c.extra[p.cols[ci]]!=null)?c.extra[p.cols[ci]]:0)); }
    out.push('S/ '+fmt(c.cuota));
    return out;
}

function proximaCuotaPendiente(p){
    var pend=p.cuotas.filter(function(c){return c.estado!=='Pagado';}).sort(function(a,b){return (a.fecha||'').localeCompare(b.fecha||'');});
    return pend.length?fmtF(pend[0].fecha):'—';
}

function exportarPDF(){
    if(!PRESTAMOS.length){ toast('No hay préstamos para exportar','warn'); return; }
    var totC=0,totPag=0,totPend=0,totCuota=0;
    PRESTAMOS.forEach(function(p){ totC+=p.totalCredito; totPag+=p.totalPagado; totPend+=p.totalPendiente;
        var restante=(p.totalCuotas||0)-(p.cuotasPagadas||0);
        if(restante>0) totCuota+=p.cuotaAmt;
    });
    var pct=totC>0?Math.round(totPag/totC*100):0;
    var hoy=new Date();
    var fechaTxt=String(hoy.getDate()).padStart(2,'0')+'/'+String(hoy.getMonth()+1).padStart(2,'0')+'/'+hoy.getFullYear();

    var html='';
    html+='<div class="pr-header"><div><div class="t1">Reporte de Finanzas</div><div class="t2">Cronogramas de crédito · CARZE Contratistas Generales S.A.C.</div></div><div class="t3">Generado el '+fechaTxt+'</div></div>';

    html+='<div class="pr-kpis">'+
        '<div class="pr-kpi"><div class="lb">Total Créditos</div><div class="vl" style="color:#1e40af">S/ '+fmt(totC)+'</div></div>'+
        '<div class="pr-kpi"><div class="lb">Total Pendiente</div><div class="vl" style="color:#dc2626">S/ '+fmt(totPend)+'</div></div>'+
        '<div class="pr-kpi"><div class="lb">Total Pagado</div><div class="vl" style="color:#16a34a">S/ '+fmt(totPag)+' ('+pct+'%)</div></div>'+
        '<div class="pr-kpi"><div class="lb">Cuota Mensual Total</div><div class="vl" style="color:#f59e0b">S/ '+fmt(totCuota)+'</div></div>'+
    '</div>';

    html+='<div class="pr-section-title">Resumen <span>Comparativo</span></div>';
    html+='<table class="pr-table"><thead><tr><th>Préstamo</th><th>Entidad</th><th>Cuotas</th><th>Cuota Mensual</th><th>Próx. Pago</th><th>Pagado</th><th>Pendiente</th><th>% Avance</th></tr></thead><tbody>';
    PRESTAMOS.forEach(function(p){
        var pp=p.totalCredito>0?Math.round(p.totalPagado/p.totalCredito*100):0;
        html+='<tr><td style="font-weight:700">'+p.nombre+'</td><td>'+p.entidad+'</td><td>'+p.cuotasPagadas+'/'+p.totalCuotas+'</td><td>S/ '+fmt(p.cuotaAmt)+'</td><td>'+proximaCuotaPendiente(p)+'</td><td>S/ '+fmt(p.totalPagado)+'</td><td>S/ '+fmt(p.totalPendiente)+'</td><td>'+pp+'%</td></tr>';
    });
    html+='</tbody></table>';

    PRESTAMOS.forEach(function(p){
        var pp=p.totalCredito>0?Math.round(p.totalPagado/p.totalCredito*100):0;
        html+='<div class="pr-prestamo-block">';
        html+='<div class="pr-prestamo-head"><h3>'+p.nombre+'</h3><span class="meta">'+p.entidad+' · '+p.totalCuotas+' cuotas · '+pp+'% pagado</span></div>';
        var colsMed=colsMediasDe(p);
        html+='<table class="pr-table"><thead><tr><th>N°</th>'+colsMed.map(function(h){return '<th>'+h+'</th>';}).join('')+'<th>Estado</th></tr></thead><tbody>';
        p.cuotas.forEach(function(c){
            var vals=valoresFilaPDF(p,c);
            html+='<tr class="'+(c.estado==='Pagado'?'r-pag':'')+'"><td>'+c.n+'</td>'+vals.map(function(v){return '<td>'+v+'</td>';}).join('')+'<td><span class="pr-badge-pill '+(c.estado==='Pagado'?'pr-badge-pag':'pr-badge-pend')+'">'+c.estado+'</span></td></tr>';
        });
        html+='</tbody></table></div>';
    });

    document.getElementById('printReport').innerHTML=html;
    document.body.classList.add('printing');
    setTimeout(function(){
        window.print();
    },80);
}
window.exportarPDF=exportarPDF;
window.addEventListener('afterprint',function(){
    document.body.classList.remove('printing');
    document.getElementById('printReport').innerHTML='';
});

// ── EXPORTAR ──────────────────────────────────────────────────
function exportarResumen(){
    var rows=[['Préstamo','Entidad','Total Crédito','Total Pagado','Total Pendiente','Cuotas Total','Cuotas Pagadas','Cuotas Restantes','Cuota Mensual','% Pagado']];
    var totC=0,totP=0,totPend=0,totCu=0;
    PRESTAMOS.forEach(function(p){
        var pct=p.totalCredito>0?Math.round(p.totalPagado/p.totalCredito*100):0;
        rows.push([p.nombre,p.entidad,p.totalCredito,p.totalPagado,p.totalPendiente,p.totalCuotas,p.cuotasPagadas,p.totalCuotas-p.cuotasPagadas,p.cuotaAmt,pct+'%']);
        totC+=p.totalCredito;totP+=p.totalPagado;totPend+=p.totalPendiente;totCu+=p.cuotaAmt;
    });
    rows.push([]);rows.push(['TOTALES','',totC,totP,totPend,'','','',totCu,'']);
    var wb=XLSX.utils.book_new();
    var ws=XLSX.utils.aoa_to_sheet(rows);
    ws['!cols']=[{wch:30},{wch:18},{wch:14},{wch:14},{wch:14},{wch:12},{wch:14},{wch:14},{wch:14},{wch:10}];
    XLSX.utils.book_append_sheet(wb,ws,'Resumen');
    XLSX.writeFile(wb,'CARZE_Finanzas_Resumen.xlsx');
    toast('Excel generado ✓','ok');
}
window.exportarResumen=exportarResumen;

function exportarCronograma(){
    if(!modalPrestamo) return;
    var p=modalPrestamo;
    var rows=[p.cols];
    p.cuotas.forEach(function(c){
        var row=[c.n];
        if(p.tipo==='interbank_emp') row=[c.n,c.fecha,c.saldo,c.amort,c.int,c.desgrav,c.cuota,c.estado];
        else if(p.tipo==='stander') row=[c.n,c.capital,c.int,c.cuota,c.fecha,c.estado];
        else if(p.tipo==='derrama') row=[c.n,c.fecha,c.capital,c.int,c.desgrav,c.comision,c.cuota,c.estado];
        else if(p.tipo==='interbank_per') row=[c.n,c.amort,c.int,c.seguro,c.cuota,c.fecha,c.estado];
        else if(p.tipo==='mibanco_emp') row=[c.n,c.fecha,c.cuota_base,c.int,c.comision,c.cuota,c.estado];
        else if(p.tipo==='simple') row=[c.n,c.cuota,c.apagar||c.cuota,c.fecha,c.estado];
        else{
            row=[c.n,c.fecha];
            for(var ci=2; ci<p.cols.length-2; ci++){ row.push((c.extra&&c.extra[p.cols[ci]]!=null)?c.extra[p.cols[ci]]:0); }
            row.push(c.cuota,c.estado);
        }
        rows.push(row);
    });
    var wb=XLSX.utils.book_new();
    var ws=XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb,ws,'Cronograma');
    XLSX.writeFile(wb,'CARZE_'+p.nombre.replace(/ /g,'_')+'.xlsx');
    toast('Excel generado ✓','ok');
}
window.exportarCronograma=exportarCronograma;

function cerrarSesion(){
    if(window.__auth && window.__signOut){
        window.__signOut(window.__auth).finally(function(){
            sessionStorage.clear();
            window.location.replace('index.html');
        });
    } else {
        sessionStorage.clear();
        window.location.replace('index.html');
    }
}
window.cerrarSesion=cerrarSesion;
document.addEventListener('keydown',function(e){
    if(e.key==='Escape'){ cerrarModal(); cerrarModalImportar(); }
});
