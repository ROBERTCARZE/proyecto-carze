/* ==========================================================================
   FIREBASE-BRIDGE.JS
   --------------------------------------------------------------------------
   finanzas.js es un script clásico (no módulo ES) — probablemente por la
   librería xlsx.js que consume, o por funciones globales que necesita para
   los onclick="" del HTML — así que no puede hacer `import` directo del
   SDK de Firebase ni de firebase-config.js/auth-guard.js.

   Este puente sí es un módulo: importa la app ya centralizada en
   firebase-config.js, activa auth-guard.js (verificación de sesión +
   window.cerrarSesion), y expone lo necesario en window.__* para que
   finanzas.js (y cualquier otro script clásico) lo consuma exactamente
   igual que antes con finanzas-auth.js — mismo patrón que ya usa
   carzecito-bridge.js para el asistente.

   Reemplaza a finanzas-auth.js. Va en el <head>, ANTES de
   <script src="finanzas.js">.
   ========================================================================== */
import "./auth-guard.js";
import { db, auth } from "./firebase-config.js";
import { collection, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";
import { signOut } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";

window.__db         = db;
window.__auth       = auth;
window.__collection = collection;
window.__doc        = doc;
window.__setDoc     = setDoc;
window.__onSnapshot = onSnapshot;
window.__signOut    = signOut;
