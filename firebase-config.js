/* ==========================================================================
   FIREBASE-CONFIG.JS — Configuración e inicialización única de Firebase
   CARZE Contratistas Generales S.A.C.
   --------------------------------------------------------------------------
   Punto único de verdad para app / auth / db / storage.

   Antes: 13 archivos (.js) repetían este mismo bloque de configuración,
   con la misma apiKey copiada a mano en cada uno.

   Ahora: cada módulo importa lo que necesite desde aquí, por ejemplo:

       import { auth, db } from "./firebase-config.js";
       import { storage }  from "./firebase-config.js"; // solo si sube archivos

   getApps()/getApp() evita reinicializar la app si este módulo llega a
   importarse más de una vez en la misma página (no debería pasar, pero
   es una salvaguarda gratuita).
   ========================================================================== */
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
import { getAuth }      from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";
import { getStorage }   from "https://www.gstatic.com/firebasejs/11.8.1/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyAk1FGQia36Y2G08L-_mscMv5JnozmPYa0",
    authDomain: "gestioncarze.firebaseapp.com",
    projectId: "gestioncarze",
    storageBucket: "gestioncarze.firebasestorage.app",
    messagingSenderId: "487407475826",
    appId: "1:487407475826:web:32185a60f0123a5d25f6eb"
};

export const app     = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth    = getAuth(app);
export const db      = getFirestore(app);
export const storage = getStorage(app);
