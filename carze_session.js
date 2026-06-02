// ── CARZE SESSION MANAGER v2 ──────────────────────────
// Sistema de sesión con expiración automática (8 horas)

const CARZE_SESSION_DURATION = 8 * 60 * 60 * 1000; // 8 horas en ms

function carze_login(nombre, rol) {
    const session = {
        nombre:    nombre,
        rol:       rol,
        timestamp: Date.now()
    };
    localStorage.setItem('carze_session', JSON.stringify(session));
}

function carze_getSession() {
    try {
        const raw = localStorage.getItem('carze_session');
        if (!raw) return null;
        const session = JSON.parse(raw);
        // Verificar expiración
        if (Date.now() - session.timestamp > CARZE_SESSION_DURATION) {
            localStorage.removeItem('carze_session');
            return null;
        }
        // Renovar timestamp en cada actividad
        session.timestamp = Date.now();
        localStorage.setItem('carze_session', JSON.stringify(session));
        return session;
    } catch(e) {
        localStorage.removeItem('carze_session');
        return null;
    }
}

function carze_getUsuario() {
    const s = carze_getSession();
    return s ? s.nombre : 'Usuario';
}

function carze_getRol() {
    const s = carze_getSession();
    return s ? s.rol : '';
}

function carze_getIniciales() {
    const nombre = carze_getUsuario();
    const partes = nombre.trim().split(' ');
    if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase();
    return nombre.slice(0, 2).toUpperCase();
}

function carze_checkSession() {
    if (!carze_getSession()) {
        window.location.href = 'index.html';
        return false;
    }
    return true;
}

function carze_cerrarSesion() {
    if (confirm('¿Estás seguro que deseas cerrar sesión?')) {
        localStorage.removeItem('carze_session');
        window.location.href = 'index.html';
    }
}

// ── TOPBAR ────────────────────────────────────────────
function carze_renderTopbar(mostrarDashboard) {
    const nombre    = carze_getUsuario();
    const rol       = carze_getRol();
    const iniciales = carze_getIniciales();

    const dashBtn = mostrarDashboard !== false
        ? `<a href="1. DASHBORD.html" class="topbar-btn topbar-btn-dash">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
            </svg>
            <span class="topbar-btn-txt">Dashboard</span>
           </a>`
        : '';

    const html = `
        <div class="carze-topbar">
            <div class="topbar-left">
                <button class="hamburger-btn" onclick="carze_toggleSidebar()" aria-label="Menú">
                    <span></span><span></span><span></span>
                </button>
                <div class="topbar-avatar">${iniciales}</div>
                <div class="topbar-info">
                    <div class="topbar-label">Usuario</div>
                    <div class="topbar-nombre">${nombre}</div>
                    ${rol ? `<div class="topbar-rol">${rol}</div>` : ''}
                </div>
                <div class="online-badge">
                    <div class="online-dot"></div>
                    <span>En línea</span>
                </div>
            </div>
            <div class="topbar-right">
                ${dashBtn}
                <button onclick="carze_cerrarSesion()" class="topbar-btn topbar-btn-logout">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                        <polyline points="16 17 21 12 16 7"/>
                        <line x1="21" y1="12" x2="9" y2="12"/>
                    </svg>
                    <span class="topbar-btn-txt">Cerrar Sesión</span>
                </button>
            </div>
        </div>`;

    const el = document.getElementById('topbar-placeholder');
    if (el) el.innerHTML = html;
}

// ── SIDEBAR TOGGLE ────────────────────────────────────
function carze_toggleSidebar() {
    const sidebar  = document.getElementById('sidebar');
    const overlay  = document.getElementById('sidebar-overlay');
    if (!sidebar) return;
    const isOpen = sidebar.classList.contains('sidebar-open');
    if (isOpen) {
        sidebar.classList.remove('sidebar-open');
        if (overlay) overlay.classList.remove('active');
    } else {
        sidebar.classList.add('sidebar-open');
        if (overlay) overlay.classList.add('active');
    }
}

// ── ESTILOS GLOBALES ──────────────────────────────────
(function injectStyles() {
    if (document.getElementById('carze-global-styles')) return;
    const s = document.createElement('style');
    s.id = 'carze-global-styles';
    s.textContent = `
        @keyframes pulso { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(.85)} }
        @keyframes flotar { 0%{transform:translateY(0)} 50%{transform:translateY(-15px)} 100%{transform:translateY(0)} }

        /* ── TOPBAR ── */
        .carze-topbar {
            background: white;
            padding: 10px 24px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.07);
            border-bottom: 1px solid #f1f5f9;
            position: sticky;
            top: 0;
            z-index: 100;
            gap: 10px;
        }
        .topbar-left  { display:flex; align-items:center; gap:10px; min-width:0; }
        .topbar-right { display:flex; align-items:center; gap:8px; flex-shrink:0; }
        .topbar-avatar {
            width:36px; height:36px; background:#1a3a6b; border-radius:50%;
            display:flex; align-items:center; justify-content:center;
            color:white; font-weight:700; font-size:0.82rem; flex-shrink:0;
        }
        .topbar-info { min-width:0; }
        .topbar-label  { font-size:0.72rem; color:#94a3b8; font-weight:500; }
        .topbar-nombre { font-size:0.86rem; font-weight:700; color:#334155; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .topbar-rol    { font-size:0.70rem; color:#64748b; }
        .online-badge  { display:flex; align-items:center; gap:5px; background:#f0fdf4; border:1px solid #86efac; border-radius:20px; padding:4px 10px; flex-shrink:0; }
        .online-badge span { font-size:0.72rem; font-weight:600; color:#16a34a; }
        .online-dot    { width:8px; height:8px; background:#16a34a; border-radius:50%; animation:pulso 2s ease-in-out infinite; flex-shrink:0; }

        .topbar-btn {
            display:flex; align-items:center; gap:6px;
            border-radius:8px; padding:8px 14px;
            font-size:0.82rem; font-weight:600;
            cursor:pointer; transition:all 0.2s;
            text-decoration:none; border:none; font-family:inherit;
        }
        .topbar-btn-dash {
            background:#f8fafc; border:1px solid #e2e8f0; color:#334155;
        }
        .topbar-btn-dash:hover { background:#1a3a6b; color:white; border-color:#1a3a6b; }
        .topbar-btn-logout { background:#fff1f2; border:1px solid #fda4af; color:#dc2626; }
        .topbar-btn-logout:hover { background:#dc2626; color:white; border-color:#dc2626; }

        /* ── HAMBURGER ── */
        .hamburger-btn {
            display:none; flex-direction:column; gap:5px; background:none; border:none;
            cursor:pointer; padding:6px; border-radius:6px; flex-shrink:0;
        }
        .hamburger-btn span {
            display:block; width:22px; height:2px; background:#334155; border-radius:2px; transition:all 0.3s;
        }
        .hamburger-btn:hover span { background:#f97316; }

        /* ── SIDEBAR OVERLAY ── */
        #sidebar-overlay {
            display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:999;
        }
        #sidebar-overlay.active { display:block; }

        /* ── SIDEBAR RESPONSIVE ── */
        .menu-link {
            display:flex; align-items:center; color:#64748b; text-decoration:none;
            padding:13px 28px; font-size:0.83rem; font-weight:700;
            transition:all 0.25s; border-left:5px solid transparent;
        }
        .menu-link img { width:22px; height:22px; margin-right:13px; object-fit:contain; }
        .menu-link:hover { background:#fff7ed; color:#f97316; border-left-color:#f97316; padding-left:36px; }
        .menu-link.activo { background:#eff6ff; color:#1a3a6b; border-left-color:#1a3a6b; }

        /* ── RESPONSIVE BREAKPOINTS ── */

        /* Tablet (≤1024px) */
        @media (max-width: 1024px) {
            #sidebar {
                transform: translateX(-100%);
                transition: transform 0.3s ease;
                z-index: 1000 !important;
            }
            #sidebar.sidebar-open { transform: translateX(0); }
            main, .dash-main {
                margin-left: 0 !important;
                width: 100% !important;
            }
            .hamburger-btn { display:flex !important; }
            .online-badge span { display:none; }
        }

        /* Móvil (≤640px) */
        @media (max-width: 640px) {
            .carze-topbar { padding: 8px 14px; }
            .topbar-btn-txt { display:none; }
            .topbar-btn { padding: 8px 10px; }
            .topbar-avatar { width:32px; height:32px; font-size:0.75rem; }
            .topbar-nombre { font-size:0.82rem; }
            .topbar-rol { display:none; }
            .online-badge { padding:4px 7px; }

            /* KPIs 2 columnas en móvil */
            .kpi-grid-responsive {
                grid-template-columns: repeat(2, 1fr) !important;
            }

            /* Tabla scroll horizontal */
            .table-responsive-wrap {
                overflow-x: auto;
                -webkit-overflow-scrolling: touch;
                border-radius: 8px;
            }
            .table-responsive-wrap table {
                min-width: 900px;
            }

            /* Contenido padding menor */
            .content-pad { padding: 16px !important; }
            .inner-card  { padding: 16px !important; }
        }

        /* Laptop (1025px - 1280px) */
        @media (min-width: 1025px) and (max-width: 1280px) {
            #sidebar { width: 230px !important; }
            main, .dash-main { margin-left: 230px !important; width: calc(100% - 230px) !important; }
            .menu-link { padding: 12px 20px; font-size: 0.78rem; }
            .menu-link img { width: 20px; height: 20px; margin-right: 10px; }
        }
    `;
    document.head.appendChild(s);
})();
