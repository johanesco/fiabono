const assert = require('node:assert/strict');
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require('@firebase/rules-unit-testing');
const { doc, setDoc, addDoc, collection, updateDoc, Timestamp } = require('firebase/firestore');
const fs = require('node:fs');

const PROJECT_ID = 'fiabono-rules-test';
let testEnv;

async function seedData() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore();
    await setDoc(doc(firestore, 'usuarios', 'admin-1'), {
      rol: 'admin',
      nombreUsuario: 'Admin',
      email: 'admin@test.local',
    });
    await setDoc(doc(firestore, 'usuarios', 'cajero-1'), {
      rol: 'cajero',
      adminId: 'admin-1',
      nombreUsuario: 'Cajero',
      activo: true,
      permisos: { abonar: true, ventaDirecta: true },
    });
    await setDoc(doc(firestore, 'clientes', 'cliente-1'), {
      usuarioId: 'admin-1',
      nombre: 'Cliente',
      celular: '3000000000',
      deudaTotal: 100,
    });
    await setDoc(doc(firestore, 'inventario', 'producto-1'), {
      usuarioId: 'admin-1',
      nombre: 'Producto',
      sku: 'P-1',
      stock: 10,
      precioVenta: 100,
      costoCompra: 50,
      categoria: 'General',
    });
  });
}

async function run() {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: fs.readFileSync('firestore.rules', 'utf8') },
  });
  await seedData();

  const cajero = testEnv.authenticatedContext('cajero-1', { email: 'cajero@test.local' }).firestore();
  const admin = testEnv.authenticatedContext('admin-1', { email: 'admin@test.local' }).firestore();
  const fecha = Timestamp.fromDate(new Date());

  await assertFails(addDoc(collection(cajero, 'movimientos'), {
    usuarioId: 'admin-1',
    tipo: 'venta',
    monto: 100,
    fecha,
  }));

  await assertSucceeds(addDoc(collection(cajero, 'movimientos'), {
    usuarioId: 'admin-1',
    tipo: 'ingreso_inventario',
    monto: 0,
    fecha,
  }));

  await assertFails(updateDoc(doc(cajero, 'clientes', 'cliente-1'), {
    deudaTotal: 0,
  }));

  await assertSucceeds(updateDoc(doc(cajero, 'clientes', 'cliente-1'), {
    nombre: 'Cliente actualizado',
  }));

  await assertFails(updateDoc(doc(cajero, 'inventario', 'producto-1'), {
    stock: 99,
  }));

  await assertFails(setDoc(doc(cajero, 'inventario', 'producto-2'), {
    usuarioId: 'admin-1',
    nombre: 'Producto no autorizado',
    stock: 1,
  }));

  await assertFails(setDoc(doc(cajero, 'separes', 'separe-1'), {
    usuarioId: 'admin-1',
    estado: 'activo',
    total: 100,
  }));

  await assertSucceeds(updateDoc(doc(cajero, 'inventario', 'producto-1'), {
    categoria: 'Ofertas',
  }));

  await assertFails(updateDoc(doc(admin, 'clientes', 'cliente-1'), {
    deudaTotal: 0,
  }));

  await assertFails(setDoc(doc(cajero, 'clientes', 'cliente-2'), {
    usuarioId: 'admin-1',
    nombre: 'Cliente no autorizado',
    deudaTotal: 0,
  }));

  await testEnv.cleanup();
  console.log('Firestore rules tests passed.');
}

run().catch(async (error) => {
  console.error(error);
  if (testEnv) await testEnv.cleanup();
  process.exitCode = 1;
});
