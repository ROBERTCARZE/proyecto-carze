/* ==========================================================================
   AUTH-GUARD.JS — Verificación de sesión + logout, en un solo lugar
   CARZE Contratistas Generales S.A.C.
   --------------------------------------------------------------------------
   Reemplaza:
     - finanzas-auth.js
     - portada-auth.js
     - el bloque onAuthStateChanged(...) que estaba copiado dentro de
       dashboard.js, caja_diaria.js, certificados.js, cotizaciones.js,
       eventos.js, facturas.js, flujo_caja.js, impuestos.js, personal.js,
       presupuesto.js, pronto_pago.js, seguimiento.js
     - la función cerrarSesion() que estaba copiada en esos mismos 12 archivos

   Uso: una sola línea al inicio de cada módulo de página:

       import "./auth-guard.js";

   No hace falta importar nada más de aquí — este archivo trabaja por
   efecto secundario: valida la sesión, llena sessionStorage y deja
   `window.cerrarSesion` disponible para el botón "Cerrar Sesión" del HTML.

   IMPORTANTE — corrige un bug real que existía antes:
   Los módulos de página se cargan como <script type="module">. Dentro de
   un módulo ES, `function cerrarSesion(){...}` NO se cuelga de `window`,
   así que el onclick="cerrarSesion()" del HTML fallaba silenciosamente
   (ReferenceError en consola) en dashboard, certificados, cotizaciones,
   eventos, facturas, flujo_caja, impuestos, personal, presupuesto,
   pronto_pago y seguimiento. Aquí se expone explícitamente en window,
   así que el botón vuelve a funcionar en todos esos módulos.
   ========================================================================== */
import { auth } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";

// Único lugar donde vive el directorio de usuarios.
// Para pasar a roles más adelante, este es el sitio donde se ampliaría
// (ej. { email, nombre, rol }) sin tocar ningún otro módulo.
const NOMBRES = {
    'proyectos@carzesac.com': 'Jans Carrillo',
    'logistica@carzesac.com': 'Edwduar Carrillo',
    'informes@carzesac.com':  'Jhonny Carrillo',
    'robertcz@carzesac.com':  'Robert Carrillo Zeña',
};

onAuthStateChanged(auth, function (user) {
    if (!user) {
        sessionStorage.clear();
        window.location.replace('index.html');
        return;
    }
    sessionStorage.setItem('carze_logged', 'true');
    sessionStorage.setItem('carze_nombre', NOMBRES[user.email] || user.email.split('@')[0]);
    sessionStorage.setItem('carze_uid', user.uid);
    sessionStorage.setItem('carze_email', user.email);

    // Señal opcional para módulos que necesiten esperar a que la sesión
    // esté lista antes de arrancar (mismo patrón que ya usaba finanzas-auth.js).
    window.dispatchEvent(new Event('carze_auth_ready'));
});

// Logout centralizado y expuesto globalmente para el onclick="cerrarSesion()" del HTML.
window.cerrarSesion = function () {
    signOut(auth).finally(function () {
        sessionStorage.clear();
        window.location.replace('index.html');
    });
};
