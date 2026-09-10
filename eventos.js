/* ==========================================================================
   EVENTOS.JS — Lógica del módulo de Eventos
   CARZE Contratistas Generales S.A.C.
   --------------------------------------------------------------------------
   Extraído de eventos.html tal cual estaba (mismo comportamiento, cero
   cambios de lógica) — primer módulo piloto de la separación HTML/JS.
   ========================================================================== */
import "./auth-guard.js";
import { db } from "./firebase-config.js";
import { collection, onSnapshot,
         addDoc, updateDoc, deleteDoc,
         doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";

const COL='eventos';

var eventos=[], editId=null, tipoActual=null;
var calAnio=new Date().getFullYear(), calMes=new Date().getMonth();
var diaSeleccionado=null;

const TIPO_META={
    reunion:   {label:'Reunión',       emoji:'🔵',cls:'tipo-reunion',  color:'#1e40af', bg:'#eff6ff'},
    visita:    {label:'Visita Técnica', emoji:'🟠',cls:'tipo-visita',   color:'#c2410c', bg:'#fff7ed'},
    documentos:{label:'Documentos',    emoji:'🟢',cls:'tipo-documentos',color:'#15803d', bg:'#dcfce7'},
    ejecucion: {label:'Ejecución',     emoji:'🟡',cls:'tipo-ejecucion', color:'#b45309', bg:'#fef3c7'},
    pago:      {label:'Pago / Cobro',  emoji:'🔴',cls:'tipo-pago',     color:'#dc2626', bg:'#fee2e2'},
    pendiente: {label:'Pendiente',     emoji:'🟣',cls:'tipo-pendiente', color:'#9333ea', bg:'#faf5ff'},
    otro:      {label:'Otro',          emoji:'⚫',cls:'tipo-otro',      color:'#475569', bg:'#f1f5f9'},
};
const MESES=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DIAS_DOW=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

// ── SESIÓN ────────────────────────────────────────────────────
// Verificar autenticación Firebase real

window.addEventListener('DOMContentLoaded',function(){
    var n=sessionStorage.getItem('carze_nombre')||'Usuario';
    document.getElementById('userName').textContent=n;
    document.getElementById('avatarInitials').textContent=
        n.split(' ').map(function(p){return p[0]||'';}).slice(0,2).join('').toUpperCase()||'U';
    renderDOW();
    renderCalendario();
    iniciarListener();
});

function iniciarListener(){
    onSnapshot(collection(db,COL),function(snap){
        eventos=snap.docs.map(function(d){var r=d.data();r._id=d.id;return r;});
        // Auto-marcar vencidos
        var hoyStr=hoy();
        eventos.forEach(function(ev){
            if(ev.estado==='pendiente'&&ev.fecha<hoyStr){
                updateDoc(doc(db,COL,ev._id),{estado:'vencido'});
                ev.estado='vencido';
            }
        });
        renderCalendario();
        renderPanel();
    });
}

// ── HELPERS ──────────────────────────────────────────────────
function hoy(){var d=new Date();return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate());}
function p2(n){return n<10?'0'+n:String(n);}
function fmtF(v){if(!v)return '—';var p=v.split('-');return p[2]+'/'+p[1]+'/'+p[0];}
function toast(msg,tipo){var t=document.getElementById('toast');t.textContent=msg;t.className='toast '+(tipo||'ok');t.classList.add('show');setTimeout(function(){t.classList.remove('show');},3000);}

function eventosDia(fechaStr){
    return eventos.filter(function(ev){return ev.fecha===fechaStr;});
}
function eventosMes(anio,mes){
    var prefix=anio+'-'+p2(mes+1);
    return eventos.filter(function(ev){return String(ev.fecha||'').startsWith(prefix);})
                  .sort(function(a,b){return String(a.fecha).localeCompare(String(b.fecha));});
}

// ── RENDER DÍAS SEMANA ────────────────────────────────────────
function renderDOW(){
    var c=document.getElementById('calDow');
    c.innerHTML=DIAS_DOW.map(function(d,i){
        return '<div class="cal-dow'+(i===0||i===6?' fin':'')+'">'+d+'</div>';
    }).join('');
}

// ── RENDER CALENDARIO ─────────────────────────────────────────
function renderCalendario(){
    var hoyD=new Date(); hoyD.setHours(0,0,0,0);
    var hoyStr=hoy();

    document.getElementById('calMesLabel').innerHTML=
        MESES[calMes]+' <span>'+calAnio+'</span>';

    var primerDia=new Date(calAnio,calMes,1).getDay(); // 0=dom
    var diasMes=new Date(calAnio,calMes+1,0).getDate();
    var grid=document.getElementById('calGrid');
    grid.innerHTML='';

    // Días del mes anterior
    var diasAnt=new Date(calAnio,calMes,0).getDate();
    for(var i=0;i<primerDia;i++){
        var d=diasAnt-primerDia+1+i;
        var div=document.createElement('div');
        div.className='cal-day otro-mes';
        div.innerHTML='<div class="cal-day-num">'+d+'</div>';
        grid.appendChild(div);
    }

    // Días del mes actual
    for(var d2=1;d2<=diasMes;d2++){
        var fechaStr=calAnio+'-'+p2(calMes+1)+'-'+p2(d2);
        var esDomingo=(new Date(calAnio,calMes,d2).getDay()===0);
        var esSabado =(new Date(calAnio,calMes,d2).getDay()===6);
        var esHoy=fechaStr===hoyStr;
        var evsDia=eventosDia(fechaStr);

        var div2=document.createElement('div');
        var cls='cal-day';
        if(esHoy) cls+=' hoy';
        if(esDomingo||esSabado) cls+=' fin-semana';
        if(evsDia.length>0) cls+=' tiene-eventos';
        div2.className=cls;
        div2.onclick=(function(f){return function(){abrirModal(f);};})(fechaStr);

        var html='<div class="cal-day-num">'+d2+'</div>';
        // Mostrar hasta 3 eventos
        evsDia.slice(0,3).forEach(function(ev){
            var meta=TIPO_META[ev.tipo]||TIPO_META.otro;
            var opacity=ev.estado==='realizado'?'opacity:.6':'';
            html+='<div class="cal-evento-dot" style="background:'+meta.bg+';color:'+meta.color+';'+opacity+'" '+
                'onclick="event.stopPropagation();abrirEditar(\''+ev._id+'\')" title="'+ev.titulo+'">'+
                meta.emoji+' '+ev.titulo+'</div>';
        });
        if(evsDia.length>3){
            html+='<div style="font-size:.64rem;color:var(--muted);font-weight:700">+'+( evsDia.length-3)+' más</div>';
        }
        html+='<div class="cal-add-btn" onclick="event.stopPropagation();abrirModal(\''+fechaStr+'\')">+</div>';
        div2.innerHTML=html;
        grid.appendChild(div2);
    }

    // Días del mes siguiente
    var totalCeldas=primerDia+diasMes;
    var resto=totalCeldas%7===0?0:7-(totalCeldas%7);
    for(var k=1;k<=resto;k++){
        var div3=document.createElement('div');
        div3.className='cal-day otro-mes';
        div3.innerHTML='<div class="cal-day-num">'+k+'</div>';
        grid.appendChild(div3);
    }
}

// ── PANEL LATERAL ─────────────────────────────────────────────
function renderPanel(){
    var evsMes=eventosMes(calAnio,calMes);
    var mesLabel=MESES[calMes]+' '+calAnio;
    document.getElementById('panelTitle').textContent='Eventos — '+mesLabel;
    document.getElementById('panelSub').textContent=evsMes.length+' evento'+(evsMes.length!==1?'s':'');

    var body=document.getElementById('panelBody');
    if(!evsMes.length){
        body.innerHTML='<div class="panel-empty"><div class="ei">📅</div><p>No hay eventos en '+mesLabel+'.<br>Haz click en un día del calendario para agregar.</p></div>';
        return;
    }

    var html='';
    evsMes.forEach(function(ev){
        var meta=TIPO_META[ev.tipo]||TIPO_META.otro;
        var estCls=ev.estado==='realizado'?'est-realizado':ev.estado==='vencido'?'est-vencido':'est-pendiente';
        var estTxt=ev.estado==='realizado'?'✅ Realizado':ev.estado==='vencido'?'⚠️ Vencido':'⏳ Pendiente';
        html+='<div class="evento-card" style="border-left-color:'+meta.color+'" onclick="abrirEditar(\''+ev._id+'\')">'+
            '<div class="evento-card-head">'+
                '<div class="evento-card-title">'+meta.emoji+' '+ev.titulo+'</div>'+
                '<div class="evento-card-fecha">'+fmtF(ev.fecha)+(ev.hora?' · '+ev.hora:'')+'</div>'+
            '</div>'+
            '<span class="evento-card-tipo '+meta.cls+'">'+meta.label+'</span>'+
            (ev.desc&&ev.desc!=='-'?'<div class="evento-card-desc">'+ev.desc+'</div>':'')+
            '<div class="evento-card-foot">'+
                '<span class="estado-badge '+estCls+'">'+estTxt+'</span>'+
                '<div class="ev-actions">'+
                    '<button class="ev-btn" onclick="event.stopPropagation();toggleEstado(\''+ev._id+'\',\''+ev.estado+'\')" title="Cambiar estado">🔄</button>'+
                    '<button class="ev-btn" onclick="event.stopPropagation();pedirEliminar(\''+ev._id+'\',\''+ev.titulo+'\')" title="Eliminar">🗑️</button>'+
                '</div>'+
            '</div>'+
        '</div>';
    });
    body.innerHTML=html;
}

// ── NAVEGACIÓN CALENDARIO ─────────────────────────────────────
function cambiarMes(dir){
    calMes+=dir;
    if(calMes>11){calMes=0;calAnio++;}
    if(calMes<0){calMes=11;calAnio--;}
    renderCalendario();
    renderPanel();
}
function irHoy(){calAnio=new Date().getFullYear();calMes=new Date().getMonth();renderCalendario();renderPanel();}
window.cambiarMes=cambiarMes;
window.irHoy=irHoy;

// ── MODAL ─────────────────────────────────────────────────────
function setTipo(tipo){
    tipoActual=tipo;
    document.querySelectorAll('.tipo-opt').forEach(function(el){
        el.className='tipo-opt'+(el.dataset.tipo===tipo?' sel sel-'+tipo:'');
    });
}
window.setTipo=setTipo;

function abrirModal(fecha){
    editId=null; limpiar();
    if(fecha) document.getElementById('eFecha').value=fecha;
    document.getElementById('modalTitle').innerHTML='Nuevo <span>Evento</span>';
    document.getElementById('btnGuardarTxt').textContent='GUARDAR';
    document.getElementById('overlay').classList.add('open');
    setTimeout(function(){document.getElementById('eTitulo').focus();},200);
}
window.abrirModal=abrirModal;

function abrirEditar(id){
    var ev=eventos.find(function(e){return e._id===id;}); if(!ev) return;
    editId=id; limpiar();
    setTipo(ev.tipo||'otro');
    document.getElementById('eTitulo').value=ev.titulo||'';
    document.getElementById('eFecha').value=ev.fecha||'';
    document.getElementById('eHora').value=ev.hora||'';
    document.getElementById('eDesc').value=ev.desc&&ev.desc!=='-'?ev.desc:'';
    document.getElementById('eEstado').value=ev.estado||'pendiente';
    document.getElementById('modalTitle').innerHTML='Editar <span>Evento</span>';
    document.getElementById('btnGuardarTxt').textContent='ACTUALIZAR';
    document.getElementById('overlay').classList.add('open');
}
window.abrirEditar=abrirEditar;

function cerrarModal(){document.getElementById('overlay').classList.remove('open');editId=null;}
window.cerrarModal=cerrarModal;

function limpiar(){
    tipoActual=null;
    document.querySelectorAll('.tipo-opt').forEach(function(el){el.className='tipo-opt';});
    ['eTitulo','eHora','eDesc'].forEach(function(id){document.getElementById(id).value='';});
    document.getElementById('eFecha').value=hoy();
    document.getElementById('eEstado').value='pendiente';
}

// ── GUARDAR ───────────────────────────────────────────────────
async function guardar(){
    if(!tipoActual){toast('Selecciona el tipo de evento','err');return;}
    var titulo=document.getElementById('eTitulo').value.trim();
    var fecha =document.getElementById('eFecha').value;
    if(!titulo||!fecha){toast('Título y fecha son obligatorios','err');return;}
    var btn=document.getElementById('btnGuardar');
    var txt=document.getElementById('btnGuardarTxt');
    btn.disabled=true;txt.innerHTML='<span class="spinner"></span>';
    var docData={
        tipo:tipoActual, titulo:titulo, fecha:fecha,
        hora:document.getElementById('eHora').value||'-',
        desc:document.getElementById('eDesc').value.trim()||'-',
        estado:document.getElementById('eEstado').value||'pendiente',
        updatedAt:serverTimestamp()
    };
    try{
        if(editId){
            await updateDoc(doc(db,COL,editId),docData);
            toast('Evento actualizado ✓','ok');
        } else {
            docData.createdAt=serverTimestamp();
            await addDoc(collection(db,COL),docData);
            toast('Evento guardado ✓','ok');
            // Navegar al mes del evento
            var parts=fecha.split('-');
            calAnio=parseInt(parts[0]); calMes=parseInt(parts[1])-1;
        }
        btn.disabled=false;txt.textContent=editId?'ACTUALIZAR':'GUARDAR';
        cerrarModal();
    }catch(err){btn.disabled=false;txt.textContent=editId?'ACTUALIZAR':'GUARDAR';toast('Error: '+err.message,'err');}
}
window.guardar=guardar;

// ── TOGGLE ESTADO ─────────────────────────────────────────────
async function toggleEstado(id,estadoActual){
    var nuevo=estadoActual==='pendiente'?'realizado':estadoActual==='realizado'?'pendiente':'realizado';
    try{await updateDoc(doc(db,COL,id),{estado:nuevo,updatedAt:serverTimestamp()});toast('Estado cambiado ✓','ok');}
    catch(err){toast('Error: '+err.message,'err');}
}
window.toggleEstado=toggleEstado;

// ── ELIMINAR ─────────────────────────────────────────────────
var pendingDel=null;
function pedirEliminar(id,titulo){
    pendingDel=id;
    document.getElementById('confirmMsg').textContent='Se eliminará "'+titulo+'". Esta acción no se puede deshacer.';
    document.getElementById('confirmOverlay').classList.add('open');
    document.getElementById('confirmOkBtn').onclick=ejecutarEliminar;
}
window.pedirEliminar=pedirEliminar;
function cerrarConfirm(){document.getElementById('confirmOverlay').classList.remove('open');pendingDel=null;}
window.cerrarConfirm=cerrarConfirm;
async function ejecutarEliminar(){
    if(!pendingDel)return;
    var idAEliminar=pendingDel;
    cerrarConfirm();
    try{await deleteDoc(doc(db,COL,idAEliminar));toast('Evento eliminado','warn');}
    catch(err){toast('Error: '+err.message,'err');}
}

// ── EXPORTAR PDF (calendario del mes, A4 horizontal) ──────────
function hexToRgb(hex){
    hex=String(hex).replace('#','');
    if(hex.length===3){hex=hex.split('').map(function(c){return c+c;}).join('');}
    var num=parseInt(hex,16);
    return {r:(num>>16)&255,g:(num>>8)&255,b:num&255};
}

async function generarPDF(){
    if(!window.jspdf||!window.jspdf.jsPDF){toast('No se pudo cargar el generador de PDF','err');return;}
    var btn=document.getElementById('btnPdf');
    var btnHtml=btn?btn.innerHTML:null;
    if(btn){btn.disabled=true;btn.innerHTML='<span class="spinner"></span> Generando...';}
    try{
        var jsPDF=window.jspdf.jsPDF;
        var pdf=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
        var pageW=297, pageH=210, margin=8;
        var usableW=pageW-margin*2;

        // Cabecera
        pdf.setFont('helvetica','bold');
        pdf.setFontSize(15);
        pdf.setTextColor(26,58,107);
        pdf.text('Agenda de Eventos',margin,margin+4);
        pdf.setFont('helvetica','normal');
        pdf.setFontSize(9);
        pdf.setTextColor(100,116,139);
        pdf.text('CARZE Contratistas Generales S.A.C.',margin,margin+9);

        pdf.setFont('helvetica','bold');
        pdf.setFontSize(13);
        pdf.setTextColor(249,115,22);
        pdf.text(MESES[calMes]+' '+calAnio,pageW-margin,margin+4,{align:'right'});

        // Leyenda de tipos (arriba a la derecha)
        var tiposArr=Object.keys(TIPO_META);
        pdf.setFontSize(7);
        pdf.setFont('helvetica','normal');
        var medidas=tiposArr.map(function(k){return pdf.getTextWidth(TIPO_META[k].label)+7.5;});
        var totalLeyW=medidas.reduce(function(a,b){return a+b;},0);
        var curX=pageW-margin-totalLeyW;
        var leyY=margin+9;
        tiposArr.forEach(function(k,i){
            var meta=TIPO_META[k];
            var rgb=hexToRgb(meta.color);
            pdf.setFillColor(rgb.r,rgb.g,rgb.b);
            pdf.roundedRect(curX,leyY-2.4,3,3,.5,.5,'F');
            pdf.setTextColor(71,85,105);
            pdf.text(meta.label,curX+4.2,leyY);
            curX+=medidas[i];
        });

        var dowH=6;
        var gridTop=margin+14;
        var gridBottom=pageH-margin-4;
        var availH=gridBottom-gridTop-dowH;
        var colW=usableW/7;

        // Construir las celdas del mes (con relleno de mes ant/sig para completar semanas)
        var primerDia=new Date(calAnio,calMes,1).getDay();
        var diasMes=new Date(calAnio,calMes+1,0).getDate();
        var diasAnt=new Date(calAnio,calMes,0).getDate();
        var celdas=[];
        for(var i=0;i<primerDia;i++){ celdas.push({num:diasAnt-primerDia+1+i,fecha:null,otro:true}); }
        for(var d=1;d<=diasMes;d++){ celdas.push({num:d,fecha:calAnio+'-'+p2(calMes+1)+'-'+p2(d),otro:false}); }
        var sig=1;
        while(celdas.length%7!==0){ celdas.push({num:sig++,fecha:null,otro:true}); }
        var semanas=[];
        for(var s=0;s<celdas.length;s+=7){ semanas.push(celdas.slice(s,s+7)); }

        // Calcula, para un tamaño de fuente dado, la altura que necesita cada semana
        var padX=1.6, padTop=5.6, padGap=1;
        function calcularAlturas(fs){
            var lineH=fs*0.42;
            var alturasSemana=semanas.map(function(semana){
                var maxAltura=15;
                semana.forEach(function(celda){
                    if(celda.otro) return;
                    var evs=eventosDia(celda.fecha);
                    var h=padTop;
                    evs.forEach(function(ev){
                        var txt=(ev.hora&&ev.hora!=='-'?ev.hora+' · ':'')+ev.titulo;
                        var lines=pdf.splitTextToSize(txt,colW-padX*2-2.2);
                        h+=lines.length*lineH+padGap+1.3;
                    });
                    if(h>maxAltura) maxAltura=h;
                });
                return maxAltura;
            });
            var total=alturasSemana.reduce(function(a,b){return a+b;},0);
            return {alturas:alturasSemana,total:total,lineH:lineH};
        }

        var fontSize=7.6;
        var calc=calcularAlturas(fontSize);
        while(calc.total>availH && fontSize>4.6){
            fontSize-=0.3;
            calc=calcularAlturas(fontSize);
        }
        var factor=calc.total>availH?(availH/calc.total):1;
        var lineH=calc.lineH;

        // Encabezado de días de la semana
        var y=gridTop;
        DIAS_DOW.forEach(function(dname,i){
            var x=margin+i*colW;
            pdf.setFontSize(7.6);
            pdf.setFont('helvetica','bold');
            if(i===0||i===6) pdf.setTextColor(220,38,38); else pdf.setTextColor(100,116,139);
            pdf.text(dname.toUpperCase(),x+colW/2,y+dowH-1.8,{align:'center'});
        });
        y+=dowH;

        var hoyStr=hoy();
        semanas.forEach(function(semana,si){
            var alturaFila=calc.alturas[si]*factor;
            semana.forEach(function(celda,ci){
                var x=margin+ci*colW;
                if(celda.otro){ pdf.setFillColor(248,250,252); pdf.rect(x,y,colW,alturaFila,'F'); }
                pdf.setDrawColor(228,232,239);
                pdf.setLineWidth(0.15);
                pdf.rect(x,y,colW,alturaFila);

                pdf.setFont('helvetica','bold');
                pdf.setFontSize(fontSize+0.6);
                if(celda.otro){
                    pdf.setTextColor(190,197,206);
                    pdf.text(String(celda.num),x+4.4,y+5.4,{align:'center'});
                } else if(celda.fecha===hoyStr){
                    pdf.setFillColor(249,115,22);
                    pdf.circle(x+4.4,y+4.4,2.6,'F');
                    pdf.setTextColor(255,255,255);
                    pdf.text(String(celda.num),x+4.4,y+5.4,{align:'center'});
                } else {
                    pdf.setTextColor(30,41,59);
                    pdf.text(String(celda.num),x+4.4,y+5.4,{align:'center'});
                }

                if(!celda.otro){
                    var evs=eventosDia(celda.fecha);
                    var yy=y+padTop*factor;
                    pdf.setFontSize(fontSize);
                    evs.forEach(function(ev){
                        var meta=TIPO_META[ev.tipo]||TIPO_META.otro;
                        var txt=(ev.hora&&ev.hora!=='-'?ev.hora+' · ':'')+ev.titulo;
                        var lines=pdf.splitTextToSize(txt,colW-padX*2-2.2);
                        var boxH=lines.length*lineH*factor+1.2;
                        var rgbBg=hexToRgb(meta.bg), rgbC=hexToRgb(meta.color);
                        pdf.setFillColor(rgbBg.r,rgbBg.g,rgbBg.b);
                        pdf.setDrawColor(rgbC.r,rgbC.g,rgbC.b);
                        pdf.setLineWidth(0.15);
                        pdf.roundedRect(x+1.2,yy,colW-2.4,boxH,.5,.5,'FD');
                        pdf.setTextColor(rgbC.r,rgbC.g,rgbC.b);
                        pdf.setFont('helvetica','bold');
                        pdf.text(lines,x+1.2+padX*0.75,yy+lineH*factor*0.8,{lineHeightFactor:1.12});
                        yy+=boxH+padGap*factor;
                    });
                }
            });
            y+=alturaFila;
        });

        pdf.setFont('helvetica','normal');
        pdf.setFontSize(7);
        pdf.setTextColor(148,163,184);
        pdf.text('Generado el '+new Date().toLocaleDateString('es-PE')+' — Agenda de Eventos CARZE',margin,pageH-margin+2);

        pdf.save('Agenda_'+MESES[calMes]+'_'+calAnio+'.pdf');
        toast('PDF generado ✓','ok');
    }catch(err){
        console.error(err);
        toast('Error al generar PDF: '+err.message,'err');
    }finally{
        if(btn){btn.disabled=false;btn.innerHTML=btnHtml;}
    }
}
window.generarPDF=generarPDF;

document.addEventListener('keydown',function(e){if(e.key==='Escape'){cerrarModal();cerrarConfirm();}});
