/* ==========================================================================
   PORTADA.JS — Lógica de UI (panel de control, sesión, logout)
   CARZE Contratistas Generales S.A.C.
   --------------------------------------------------------------------------
   Extraído de PORTADA.html tal cual estaba (mismo comportamiento, cero
   cambios de lógica). Script CLÁSICO (no module) — a propósito, para que
   abrirPanel(), cerrarPanel(), cerrarSesion() etc. sigan siendo funciones
   globales accesibles desde los onclick="" del HTML, igual que antes.
   ========================================================================== */
    // ── PROTECCIÓN DE SESIÓN ──────────────────────────────────────────
    (function() {
        if (sessionStorage.getItem('carze_logged') !== 'true') {
            window.location.replace('index.html');
        }
    })();

    // ── DATOS DE USUARIO ─────────────────────────────────────────────
    window.addEventListener('DOMContentLoaded', function() {
        var nombre = sessionStorage.getItem('carze_nombre') || 'Usuario';
        document.getElementById('userName').textContent = nombre;
        var iniciales = nombre.split(' ').map(function(p){ return p[0]; }).slice(0,2).join('').toUpperCase();
        document.getElementById('avatarInitials').textContent = iniciales || 'U';
    });

    // ── PANEL DE CONTROL ─────────────────────────────────────────────
    function abrirPanel() {
        document.getElementById('modalOverlay').classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    function cerrarPanel() {
        document.getElementById('modalOverlay').classList.remove('open');
        document.body.style.overflow = '';
    }

    function cerrarPanelOutside(e) {
        if (e.target === document.getElementById('modalOverlay')) cerrarPanel();
    }

    // ESC para cerrar modal
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') cerrarPanel();
    });

    // ── CERRAR SESIÓN ─────────────────────────────────────────────────
    function cerrarSesion() {
        sessionStorage.removeItem('carze_logged');
        sessionStorage.removeItem('carze_nombre');
        sessionStorage.removeItem('carze_rol');
        window.location.replace('index.html');
    }
