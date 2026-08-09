/* ==========================================================================
   PORTADA-AUTH.JS — Verificación de sesión Firebase (módulo ES)
   CARZE Contratistas Generales S.A.C.
   --------------------------------------------------------------------------
   Extraído de PORTADA.html tal cual estaba (mismo comportamiento, cero
   cambios de lógica). Va en <head>, antes del <body>.
   ========================================================================== */
import { initializeApp }                       from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";

const firebaseConfig={
    apiKey:"AIzaSyAk1FGQia36Y2G08L-_mscMv5JnozmPYa0",
    authDomain:"gestioncarze.firebaseapp.com",
    projectId:"gestioncarze",
    storageBucket:"gestioncarze.firebasestorage.app",
    messagingSenderId:"487407475826",
    appId:"1:487407475826:web:32185a60f0123a5d25f6eb"
};
const _app  = initializeApp(firebaseConfig);
const _auth = getAuth(_app);
const NOMBRES = {
    'proyectos@carzesac.com':'Jans Carrillo',
    'logistica@carzesac.com':'Edwduar Carrillo',
    'informes@carzesac.com':'Jhonny Carrillo',
    'robertcz@carzesac.com':'Robert Carrillo Zeña',
};
onAuthStateChanged(_auth, function(user){
    if(!user){ window.location.replace('index.html'); return; }
    if(!sessionStorage.getItem('carze_nombre') && user.email){
        sessionStorage.setItem('carze_logged','true');
        sessionStorage.setItem('carze_nombre', NOMBRES[user.email]||user.email.split('@')[0]);
        sessionStorage.setItem('carze_uid', user.uid);
        sessionStorage.setItem('carze_email', user.email);
    }
});
window._authForSignOut = _auth;
window._signOutFn = signOut;
