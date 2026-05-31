function crearMenuFlotante() {
    var overlay = document.createElement('div');
    overlay.id = 'modal-overlay';
    overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15, 23, 42, 0.85); backdrop-filter:blur(8px); display:flex; justify-content:center; align-items:center; z-index:9999;';

    var modal = document.createElement('div');
    modal.style.cssText = 'background:#ffffff; padding:30px; border-radius:20px; display:grid; grid-template-columns:repeat(3, 1fr); gap:15px; box-shadow:0 25px 50px rgba(0,0,0,0.5); max-width:900px;';

    // Lista basada exactamente en los nombres de tu carpeta img/
    var botones = [
        {txt: 'COTIZACIONES', icon: 'Cotizaciones.png', url: '3. COTIZACIONES.html'},
        {txt: 'CERTIFICADOS', icon: 'Certificados.png', url: '4. CERTIFICADOS.html'},
        {txt: 'FACTURAS', icon: 'Factura.png', url: '5. FACTURAS.html'},
        {txt: 'IMPUESTOS', icon: 'Impuestos.png', url: '6. IMPUESTOS.html'},
        {txt: 'PERSONAL', icon: 'Personal.png', url: '7. PERSONAL.html'},
        {txt: 'FINANZAS', icon: 'Finanzas.png', url: '8. FINANZAS.html'},
        {txt: 'PRONTO PAGO', icon: 'Pronto Pago.png', url: '9. PRONTO_PAGO.html'},
        {txt: 'CAJA DIARIA', icon: 'Caja Diaria.png', url: '10. CAJA_DIARIA.html'},
        {txt: 'FLUJO DE CAJA', icon: 'Flujo de Caja.png', url: '11. FLUJO_DE_CAJA.html'},
        {txt: 'VENCIMIENTO Y ALERTAS', icon: 'Vencimiento y Alerta.png', url: '12. VENCIMIENTO_ALERTAS.html'},
        {txt: 'SEGUIMIENTO', icon: 'Seguimiento.png', url: '13. SEGUIMIENTO.html'}
    ];

    for (var i = 0; i < botones.length; i++) {
        (function(b) {
            var btn = document.createElement('button');
            // Usamos img/ + el nombre exacto de tu carpeta
            btn.innerHTML = '<img src="img/' + b.icon + '" style="width:50px; height:50px; display:block; margin:0 auto 10px;">' + b.txt;
            btn.style.cssText = 'padding:20px; border:none; background:#f1f5f9; border-radius:12px; cursor:pointer; font-weight:600; color:#1e293b; transition:0.3s; font-size:0.8rem;';
            
            btn.onmouseover = function() { this.style.background = '#f97316'; this.style.color = 'white'; };
            btn.onmouseout = function() { this.style.background = '#f1f5f9'; this.style.color = '#1e293b'; };
            
            btn.onclick = function() { window.location.href = b.url; };
            modal.appendChild(btn);
        })(botones[i]);
    }

    overlay.onclick = function(e) { if(e.target === overlay) document.body.removeChild(overlay); };
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}