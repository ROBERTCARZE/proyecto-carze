/* ==========================================================================
   FINANZAS-AUTH.JS — Verificación de sesión Firebase (módulo ES)
   CARZE Contratistas Generales S.A.C.
   --------------------------------------------------------------------------
   Extraído de finanzas.html tal cual estaba (mismo comportamiento, cero
   cambios de lógica). Expone window.__db, window.__auth, etc. para que
   finanzas.js (script clásico) los use, exactamente como antes.
   ========================================================================== */
import { initializeApp, getApps, getApp }       from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";
import { getFirestore, collection, doc, setDoc,
         onSnapshot } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";
const _cfg={
    apiKey:"AIzaSyAk1FGQia36Y2G08L-_mscMv5JnozmPYa0",
    authDomain:"gestioncarze.firebaseapp.com",
    projectId:"gestioncarze",
    storageBucket:"gestioncarze.firebasestorage.app",
    messagingSenderId:"487407475826",
    appId:"1:487407475826:web:32185a60f0123a5d25f6eb"
};
const _app  = getApps().length ? getApp() : initializeApp(_cfg);
const _auth = getAuth(_app);
const _db   = getFirestore(_app);
// Exponer Firestore al script clásico de abajo (mismo patrón que __auth/__signOut)
window.__db = _db;
window.__collection = collection;
window.__doc = doc;
window.__setDoc = setDoc;
window.__onSnapshot = onSnapshot;
const NOMBRES={
    'proyectos@carzesac.com':'Jans Carrillo',
    'logistica@carzesac.com':'Edwduar Carrillo',
    'informes@carzesac.com' :'Jhonny Carrillo',
    'robertcz@carzesac.com' :'Robert Carrillo Zeña',
};
onAuthStateChanged(_auth,function(user){
    if(!user){
        sessionStorage.clear();
        window.location.replace('index.html');
        return;
    }
    // Llenar sessionStorage para que el script principal lo lea
    sessionStorage.setItem('carze_logged','true');
    sessionStorage.setItem('carze_nombre', NOMBRES[user.email]||user.email.split('@')[0]);
    sessionStorage.setItem('carze_uid',    user.uid);
    sessionStorage.setItem('carze_email',  user.email);
    // Exponer signOut para el botón Cerrar Sesión
    window.__auth   = _auth;
    window.__signOut= signOut;
    // Señal para que el script principal arranque
    window.dispatchEvent(new Event('carze_auth_ready'));
});
