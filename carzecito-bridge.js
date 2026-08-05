/* ==========================================================================
   CARZECITO-BRIDGE.JS
   --------------------------------------------------------------------------
   carzecito.js es un script clásico (no un módulo ES), así que no puede
   hacer `import` directo del SDK de Firebase. Este puente sí es un módulo,
   reutiliza la app de Firebase que cada página ya inicializa (no duplica
   configuración ni credenciales) y deja las funciones necesarias colgadas
   de window.CZ_FIRESTORE para que carzecito.js las consuma.

   Requiere ir DESPUÉS del <script type="module"> de cada página que llama
   a initializeApp(), y ANTES de <script src="carzecito.js">.
   ========================================================================== */
import { getApps } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
import {
  getFirestore, collection, query, where, getDocs, addDoc,
  serverTimestamp, orderBy, limit
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";

var apps = getApps();
if (apps.length > 0) {
  var db = getFirestore(apps[0]);
  window.CZ_FIRESTORE = {
    db: db,
    collection: collection,
    query: query,
    where: where,
    getDocs: getDocs,
    addDoc: addDoc,
    serverTimestamp: serverTimestamp,
    orderBy: orderBy,
    limit: limit
  };
} else {
  console.warn('[CARZECITO] No se encontró una app de Firebase inicializada en esta página. El asistente funcionará solo con navegación, sin datos en vivo.');
}
