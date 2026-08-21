const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { DateTime } = require('luxon');

admin.initializeApp();
const db = admin.firestore();

function mapDayIndexToLabel(dt) {
  const map = ['Lun','Mar','Mie','Jue','Vie','Sab','Dom'];
  return map[dt.weekday - 1];
}

exports.runScheduler = functions.https.onRequest(async (req, res) => {
  try {
    const TZ = process.env.TIMEZONE || 'UTC';
    const now = DateTime.now().setZone(TZ);
    const dayLabel = mapDayIndexToLabel(now);
    const hhmm = now.toFormat('HH:mm');

    const usuariosSnap = await db.collection('usuarios').where('horariosActividad', '!=', null).get();

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
      } else return;

      const actualActivo = data.activo === undefined ? false : !!data.activo;
      if (actualActivo !== deberiaEstarActivo) {
        const ref = db.doc(`usuarios/${doc.id}`);
        batch.update(ref, { activo: deberiaEstarActivo });
        updates++;
      }
    });

    if (updates > 0) await batch.commit();

    res.status(200).send({ ok: true, updated: updates });
  } catch (e) {
    console.error('Scheduler error:', e);
    res.status(500).send({ ok: false, error: e.toString() });
  }
});
