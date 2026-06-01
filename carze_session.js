// ── CARZE SESSION MANAGER ─────────────────────────────
// Incluir en todas las páginas del sistema con:
// <script src="carze_session.js"></script>

function carze_getUsuario() {
    return sessionStorage.getItem('carze_usuario') || 'Usuario';
}
function carze_getRol() {
    return sessionStorage.getItem('carze_rol') || '';
}
function carze_getIniciales() {
    var nombre = carze_getUsuario();
    var partes  = nombre.split(' ');
    if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase();
    return nombre.slice(0,2).toUpperCase();
}

// Inyecta la topbar en el elemento con id="topbar-placeholder"
function carze_renderTopbar(mostrarDashboard) {
    var nombre    = carze_getUsuario();
    var rol       = carze_getRol();
    var iniciales = carze_getIniciales();
    var dashBtn   = mostrarDashboard !== false
        ? '<a href="1. DASHBORD.html" style="display:flex;align-items:center;gap:7px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px 14px;text-decoration:none;color:#334155;font-size:0.82rem;font-weight:600;transition:all 0.2s;" onmouseover="this.style.background=\'#1a3a6b\';this.style.color=\'white\';this.style.borderColor=\'#1a3a6b\'" onmouseout="this.style.background=\'#f8fafc\';this.style.color=\'#334155\';this.style.borderColor=\'#e2e8f0\'"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>Dashboard</a>'
        : '';
    var html = '<div style="background:white;padding:10px 30px;display:flex;justify-content:space-between;align-items:center;box-shadow:0 2px 8px rgba(0,0,0,0.07);border-bottom:1px solid #f1f5f9;position:sticky;top:0;z-index:100;">'
        + '<div style="display:flex;align-items:center;gap:10px;">'
        + '<div style="width:36px;height:36px;background:#1a3a6b;border-radius:50%;display:flex;align-items:center;justify-content:center;"><span style="color:white;font-weight:700;font-size:0.82rem;">'+iniciales+'</span></div>'
        + '<div><div style="font-size:0.72rem;color:#94a3b8;font-weight:500;">Usuario</div>'
        + '<div style="font-size:0.86rem;font-weight:700;color:#334155;">'+nombre+'</div>'
        + (rol ? '<div style="font-size:0.72rem;color:#64748b;font-weight:500;">'+rol+'</div>' : '')
        + '</div>'
        + '<div style="display:flex;align-items:center;gap:5px;background:#f0fdf4;border:1px solid #86efac;border-radius:20px;padding:4px 10px;margin-left:6px;">'
        + '<div style="width:8px;height:8px;background:#16a34a;border-radius:50%;animation:pulso 2s ease-in-out infinite;"></div>'
        + '<span style="font-size:0.72rem;font-weight:600;color:#16a34a;">En línea</span></div></div>'
        + '<div style="display:flex;gap:10px;">' + dashBtn
        + '<button onclick="carze_cerrarSesion()" style="display:flex;align-items:center;gap:7px;background:#fff1f2;border:1px solid #fda4af;border-radius:8px;padding:8px 14px;cursor:pointer;color:#dc2626;font-size:0.82rem;font-weight:600;transition:all 0.2s;" onmouseover="this.style.background=\'#dc2626\';this.style.color=\'white\'" onmouseout="this.style.background=\'#fff1f2\';this.style.color=\'#dc2626\'">'
        + '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>Cerrar Sesión</button>'
        + '</div></div>';
    var el = document.getElementById('topbar-placeholder');
    if (el) el.innerHTML = html;
}

function carze_cerrarSesion() {
    if (confirm('¿Estás seguro que deseas cerrar sesión?')) {
        sessionStorage.clear();
        window.location.href = 'index.html';
    }
}

// Animación pulso (inyectar si no existe)
(function(){
    if (!document.getElementById('carze-styles')) {
        var s = document.createElement('style');
        s.id  = 'carze-styles';
        s.textContent = '@keyframes pulso{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.85)}}';
        document.head.appendChild(s);
    }
})();
