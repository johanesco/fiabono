// scripts/scheduler.js
// Run: TIMEZONE=America/Bogota node scripts/scheduler.js

const admin = require('firebase-admin');
const { DateTime } = require('luxon');

// Initialize admin SDK. Local testing requires GOOGLE_APPLICATION_CREDENTIALS env var
if (!admin.apps.length) {
  try {
    admin.initializeApp();
  } catch (e) {
    console.error('Failed to initialize admin SDK:', e);
    process.exit(1);
  }
}

const db = admin.firestore();

function getCurrentInZone(tz) {
  if (tz) return DateTime.now().setZone(tz);
  return DateTime.now();
}

function mapDayIndexToLabel(dt) {
  // Luxon weekday: 1 = Monday ... 7 = Sunday
  const map = ['Lun','Mar','Mie','Jue','Vie','Sab','Dom'];
  return map[dt.weekday - 1];
}

(async () => {
  try {
    const TZ = process.env.TIMEZONE || null; // e.g. 'America/Bogota'
    const now = getCurrentInZone(TZ);
    const dayLabel = mapDayIndexToLabel(now);
    const hhmm = now.toFormat('HH:mm');
    console.log(`Running scheduler at ${now.toISO()} zone=${TZ || DateTime.local().zoneName}`);

    const usuariosSnap = await db.collection('usuarios').where('horariosActividad', '!=', null).get();
    console.log(`Found ${usuariosSnap.size} usuarios with horariosActividad`);

    const batch = db.batch();
    let updates = 0;

    usuariosSnap.forEach(doc => {
      const data = doc.data();
      const horarios = data.horariosActividad || [];
      const manualOverride = data.manualOverride === true;
      let deberiaEstarActivo = false;

      if (!manualOverride) {
        for (const h of horarios) {
          if (!h.activoAuto) continue;
          const dias = h.dias || [];
          if (!dias.includes(dayLabel)) continue;
          const inicio = h.inicio || '00:00';
          const fin = h.fin || '23:59';
          if (inicio <= hhmm && hhmm < fin) { deberiaEstarActivo = true; break; }
        }
      } else {
        // skip modifications when manual override
        return;
      }

      const actualActivo = data.activo === undefined ? false : !!data.activo;
      if (actualActivo !== deberiaEstarActivo) {
        const ref = db.doc(`usuarios/${doc.id}`);
        batch.update(ref, { activo: deberiaEstarActivo });
        updates++;
      }
    });

    if (updates > 0) {
      await batch.commit();
      console.log(`Committed ${updates} updates.`);
    } else {
      console.log('No updates necessary.');
    }
  } catch (e) {
    console.error('Scheduler error:', e);
    process.exit(1);
  }
})();
