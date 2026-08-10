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

window.addEventListener('carze_auth_ready',function(){
    var n=sessionStorage.getItem('carze_nombre')||'Usuario';
    document.getElementById('userName').textContent=n;
    document.getElementById('avatarInitials').textContent=n.split(' ').map(function(p){return p[0]||'';}).slice(0,2).join('').toUpperCase()||'U';
    cargarPrestamosDesdeFirestore();
});

function renderKPIs(){
    var totC=0,totPag=0,totPend=0,totCuota=0,activos=0;
    PRESTAMOS.forEach(function(p){
        totC+=p.totalCredito; totPag+=p.totalPagado; totPend+=p.totalPendiente;
        // Un préstamo ya Completado (sin cuotas restantes) no debe seguir
        // sumando en "préstamos activos" ni en la cuota mensual — ya no
        // representa un pago pendiente cada mes.
        var restante=(p.totalCuotas||0)-(p.cuotasPagadas||0);
        if(restante>0){ activos++; totCuota+=p.cuotaAmt; }
    });
    var pct=totC>0?Math.round(totPag/totC*100):0;
    document.getElementById('kTotal').textContent='S/ '+fmt(totC);
    document.getElementById('kTotalSub').textContent=activos+' préstamo'+(activos!==1?'s':'')+' activo'+(activos!==1?'s':'')+(PRESTAMOS.length>activos?' ('+(PRESTAMOS.length-activos)+' completado'+((PRESTAMOS.length-activos)!==1?'s':'')+')':'');
    document.getElementById('kPend').textContent='S/ '+fmt(totPend);
    document.getElementById('kPag').textContent='S/ '+fmt(totPag);
    document.getElementById('kPagPct').textContent=pct+'% del total cancelado';
    document.getElementById('kCuota').textContent='S/ '+fmt(totCuota);
}

function renderResumen(){
    var grid=document.getElementById('resumenGrid');
    grid.innerHTML='';
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
        } else {
            cells+='<td>S/ '+fmt(c.cuota)+'</td><td>S/ '+fmt(c.apagar||c.cuota)+'</td><td>'+fmtF(c.fecha)+'</td><td>'+pill+'</td>';
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
    toast(c.estado==='Pagado'?'Cuota '+cuota_n+' marcada como Pagada ✓':'Cuota '+cuota_n+' marcada como Pendiente','ok');
}
window.toggleEstado=toggleEstado;

function cerrarModal(){document.getElementById('overlay').classList.remove('open');}
window.cerrarModal=cerrarModal;

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
        else row=[c.n,c.cuota,c.apagar||c.cuota,c.fecha,c.estado];
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
document.addEventListener('keydown',function(e){if(e.key==='Escape')cerrarModal();});
