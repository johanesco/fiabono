// lib/firebase-admin.ts
// Singleton seguro para inicializar Firebase Admin SDK en Next.js (App Router y Route Handlers)

import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';

let adminApp: App | undefined;
let adminDb: Firestore | undefined;
let adminAuth: Auth | undefined;

export function getAdminApp(): App {
  if (!adminApp) {
    if (getApps().length > 0) {
      adminApp = getApps()[0];
    } else {
      const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
      const rawKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

      if (!projectId || !clientEmail || !rawKey) {
        throw new Error('Faltan credenciales de Firebase Admin SDK en variables de entorno.');
      }

      adminApp = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey: rawKey.replace(/\\n/g, '\n'),
        }),
      });
    }
  }
  return adminApp;
}

export function getAdminDb(): Firestore {
  if (!adminDb) {
    adminDb = getFirestore(getAdminApp());
  }
  return adminDb;
}

export function getAdminAuth(): Auth {
  if (!adminAuth) {
    adminAuth = getAuth(getAdminApp());
  }
  return adminAuth;
}