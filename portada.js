/* ==========================================================================
   PORTADA.JS — Lógica de UI (panel de control, sesión)
   CARZE Contratistas Generales S.A.C.
   --------------------------------------------------------------------------
   Script CLÁSICO (no module) — a propósito, para que abrirPanel(),
   cerrarPanel(), etc. sigan siendo funciones globales accesibles desde
   los onclick="" del HTML, igual que antes.

   cerrarSesion() ya NO se define aquí: ahora la expone auth-guard.js
   (cargado como módulo en el <head> de PORTADA.html, ver instrucciones
   de migración) y llama de verdad a signOut(auth) de Firebase, algo que
   la versión anterior de este archivo no hacía — solo limpiaba
   sessionStorage y dejaba la sesión de Firebase abierta de fondo.
   ========================================================================== */
    // ── PROTECCIÓN DE SESIÓN ──────────────────────────────────────────
    // Chequeo rápido y síncrono (evita el parpadeo de contenido protegido
    // mientras auth-guard.js resuelve el estado real de Firebase, que es
    // asíncrono). auth-guard.js sigue siendo la verificación autoritativa.
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

    // cerrarSesion() ahora la expone auth-guard.js globalmente (ver cabecera).
