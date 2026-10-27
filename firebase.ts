import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";
import { getAuth } from "firebase/auth"; 
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "build-placeholder-key",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "fiabono.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "fiabono",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "fiabono.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "000000000000",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:000000000000:web:000000000000"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
// MODO OFFLINE (Fase 1): en el navegador, Firestore guarda una copia local en IndexedDB.
// Así clientes, inventario, separes, etc. se pueden consultar aunque se caiga el internet,
// y las lecturas se sienten más rápidas. En el servidor (SSR) se usa la instancia normal.
function crearFirestore(): Firestore {
  if (typeof window === "undefined") return getFirestore(app);
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(), // Soporta varias pestañas abiertas a la vez
      }),
    });
  } catch {
    // Ya inicializado (recarga en caliente) o IndexedDB no disponible (ej. modo incógnito antiguo)
    return getFirestore(app);
  }
}

export const db = crearFirestore();
export const auth = getAuth(app);
export const storage = getStorage(app);
