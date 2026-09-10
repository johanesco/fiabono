import React from 'react';
import Link from 'next/link';
import { ShieldCheck, ArrowLeft, Receipt, CheckCircle2, Lock, Eye, FileText, Database, Shield, Trash2, AlertTriangle } from 'lucide-react';

export const metadata = {
  title: 'Política de Tratamiento de Datos Personales | Fiabono',
  description: 'Política de protección y privacidad de datos personales de Fiabono conforme a la Ley Estatutaria 1581 de 2012 de Colombia.',
};

export default function PrivacidadPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#020617] text-slate-900 dark:text-slate-100 font-sans transition-colors duration-300">
      {/* HEADER NAVEGACIÓN */}
      <header className="sticky top-0 bg-white/85 dark:bg-[#0f172a]/85 backdrop-blur-2xl border-b border-slate-200/60 dark:border-slate-800/60 z-50 px-4 sm:px-8 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-tr from-emerald-600 to-teal-500 rounded-xl flex items-center justify-center shadow-md shadow-emerald-500/25">
              <Receipt size={18} className="text-white" />
            </div>
            <span className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
              Fiabono<span className="text-emerald-600 dark:text-emerald-400">.com</span>
            </span>
          </Link>

          <Link 
            href="/" 
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors bg-slate-100 dark:bg-slate-800/80 px-3.5 py-2 rounded-xl"
          >
            <ArrowLeft size={16} />
            <span>Volver al Inicio</span>
          </Link>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        {/* ENCABEZADO */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 font-black text-xs uppercase tracking-wider mb-3 border border-blue-200/50">
            <ShieldCheck size={14} /> Habeas Data Colombia (Ley 1581)
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-slate-900 dark:text-white mb-4">
            Política de Privacidad y Tratamiento de Datos
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
            En cumplimiento de la Ley Estatutaria 1581 de 2012 y el Decreto Reglamentario 1377 de 2013 de Colombia
          </p>
        </div>

        {/* TARJETA GARANTÍA DE PRIVACIDAD */}
        <div className="bg-blue-50/60 dark:bg-blue-950/20 border-2 border-blue-200 dark:border-blue-800/50 p-6 rounded-3xl mb-12 text-left space-y-3">
          <div className="flex items-center gap-2 text-blue-900 dark:text-blue-300 font-black text-sm uppercase tracking-wider">
            <Lock size={18} className="text-blue-600" />
            <span>Los 4 Compromisos Éticos de Fiabono:</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-medium">
            <div className="flex items-start gap-2 bg-white/70 dark:bg-slate-900/60 p-3 rounded-2xl border border-blue-100 dark:border-blue-900/30">
              <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
              <span><strong>Jamás vendemos tus datos:</strong> Ni listas de clientes ni balances de ventas son comercializados con terceros ni burós.</span>
            </div>
            <div className="flex items-start gap-2 bg-white/70 dark:bg-slate-900/60 p-3 rounded-2xl border border-blue-100 dark:border-blue-900/30">
              <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
              <span><strong>No rastreamos apps externas:</strong> No accedemos a tus otras aplicaciones, ubicación GPS invasiva ni hábitos privados.</span>
            </div>
            <div className="flex items-start gap-2 bg-white/70 dark:bg-slate-900/60 p-3 rounded-2xl border border-blue-100 dark:border-blue-900/30">
              <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
              <span><strong>Eliminación Total en la App:</strong> Puedes borrar tu cuenta y todo tu historial en 1 clic desde tu Perfil cuando quieras.</span>
            </div>
            <div className="flex items-start gap-2 bg-white/70 dark:bg-slate-900/60 p-3 rounded-2xl border border-blue-100 dark:border-blue-900/30">
              <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
              <span><strong>Aislamiento Estricto:</strong> La información de tu comercio está aislada criptográficamente en Google Cloud.</span>
            </div>
          </div>
        </div>

        {/* ARTÍCULOS DETALLADOS */}
        <div className="bg-white dark:bg-[#0f172a] p-6 sm:p-10 rounded-[2.5rem] border border-slate-200/80 dark:border-slate-800/80 shadow-md text-left space-y-8 text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
          
          {/* SECCIÓN 1 */}
          <section className="space-y-2">
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span className="text-blue-600">1.</span> Identificación del Responsable del Tratamiento
            </h2>
            <p>
              La plataforma <strong>Fiabono</strong> (en adelante, &ldquo;Fiabono&rdquo;), accesible a través de <code>fiabono.com</code>, con domicilio principal en la República de Colombia, actúa como Responsable del tratamiento de los datos personales de los usuarios titulares de las cuentas y como Encargado del tratamiento respecto de los datos de terceros ingresados por los comerciantes para la generación de comprobantes.
            </p>
            <p>
              Canal oficial para peticiones, consultas y quejas de Habeas Data: <strong>fiabono.app@gmail.com</strong>.
            </p>
          </section>

          {/* SECCIÓN 2 */}
          <section className="space-y-2">
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span className="text-blue-600">2.</span> Marco Legal Aplicable
            </h2>
            <p>
              La presente Política se rige bajo la Constitución Política de Colombia (Artículo 15), la <strong>Ley Estatutaria 1581 de 2012</strong>, el <strong>Decreto Reglamentario 1377 de 2013</strong> y las directrices emitidas por la Superintendencia de Industria y Comercio (SIC) en materia de protección de datos personales y Habeas Data.
            </p>
          </section>

          {/* SECCIÓN 3 */}
          <section className="space-y-2">
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span className="text-blue-600">3.</span> Datos Personales que Recolectamos
            </h2>
            <p>Fiabono recolecta las siguientes categorías de información:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>Datos de Registro del Comerciante:</strong> Nombre completo, correo electrónico, nombre comercial del establecimiento, número de teléfono/WhatsApp y credenciales de autenticación protegidas (mediante Firebase Auth de Google).
              </li>
              <li>
                <strong>Datos Operativos del Comercio:</strong> Catálogo de productos, precios, fotos de prendas de plan separe, registros de ventas, abonos, cuentas fiadas y saldo pendiente.
              </li>
              <li>
                <strong>Datos de Clientes del Comercio:</strong> Nombre, número de teléfono celular (para el despacho de recibos por WhatsApp) y cupo de crédito otorgado por el comerciante.
              </li>
            </ul>
          </section>

          {/* SECCIÓN 4 */}
          <section className="space-y-2">
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span className="text-blue-600">4.</span> Finalidades Específicas del Tratamiento
            </h2>
            <p>La información suministrada se tratará única y exclusivamente para los siguientes fines:</p>
            <ol className="list-decimal pl-5 space-y-1.5">
              <li>Habilitar la operación, sincronización en tiempo real y persistencia segura de la información contable y de mostrador del usuario.</li>
              <li>Generar comprobantes mercantiles digitales accesibles mediante enlace público único verificado (ruta <code>/t/[id]</code>) para entrega al consumidor final.</li>
              <li>Permitir la apertura automatizada del chat de WhatsApp en el dispositivo del usuario con el texto preformateado del comprobante de pago o abono.</li>
              <li>Prestar soporte técnico, atención al cliente y notificaciones sobre el estado de la suscripción o mejoras de la Plataforma.</li>
              <li>Cumplir con los requerimientos legales y regulatorios aplicables en Colombia.</li>
            </ol>
            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-xl text-emerald-800 dark:text-emerald-300 text-xs font-bold">
              ✓ Prohibición estricta: Fiabono NO comercializa, no arrienda, no transfiere ni vende bases de datos a agencias de publicidad, centrales de riesgo crediticio ni terceros.
            </div>
          </section>

          {/* SECCIÓN 5 */}
          <section className="space-y-2">
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span className="text-blue-600">5.</span> Derecho de Supresión y Eliminación Total de Datos (Directo en la App)
            </h2>
            <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2">
              <p className="font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                <Trash2 size={16} className="text-rose-500" /> Eliminación de Cuenta Autogestionada
              </p>
              <p className="text-xs">
                En cualquier momento, el Comerciante titular puede solicitar y ejecutar la <strong>eliminación permanente e inmediata de su cuenta y de todos sus datos asociados</strong> directamente desde la sección <strong>Perfil &gt; Zona de Privacidad y Eliminación de Cuenta</strong> dentro de la aplicación.
              </p>
              <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 rounded-xl text-rose-700 dark:text-rose-300 text-xs space-y-1">
                <p className="font-bold flex items-center gap-1">
                  <AlertTriangle size={14} /> Consecuencia del borrado definitivo:
                </p>
                <p>
                  Al confirmar la eliminación, se borran irreversiblemente todos los productos, clientes, movimientos de caja, historial de fiados, fotos de prendas y comprobantes. <strong>Si en el futuro el usuario decide registrarse nuevamente con el mismo correo electrónico o cuenta de Google, ingresará como un negocio completamente nuevo desde cero y no encontrará ningún registro anterior</strong>, garantizando que sus datos fueron suprimidos al 100%.
                </p>
              </div>
            </div>
          </section>

          {/* SECCIÓN 6 */}
          <section className="space-y-2">
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span className="text-blue-600">6.</span> Derechos de los Titulares (Derechos ARCO)
            </h2>
            <p>
              Conforme al Artículo 8 de la Ley 1581 de 2012, usted y sus clientes tienen derecho a:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Conocer, actualizar y rectificar</strong> sus datos personales frente a información inexacta, incompleta o fraccionada.</li>
              <li><strong>Solicitar prueba</strong> de la autorización otorgada para el tratamiento.</li>
              <li><strong>Ser informado</strong> previa solicitud respecto del uso que se le ha dado a sus datos.</li>
              <li><strong>Revocar la autorización</strong> o solicitar la supresión del dato cuando no medie un deber legal o contractual de permanecer en la base de datos.</li>
              <li><strong>Presentar quejas</strong> ante la Superintendencia de Industria y Comercio (SIC) por infracciones a la ley.</li>
            </ul>
          </section>

          {/* SECCIÓN 7 */}
          <section className="space-y-2">
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span className="text-blue-600">7.</span> Seguridad Técnica y Almacenamiento
            </h2>
            <p>
              Fiabono implementa altos estándares de ciberseguridad industrial para prevenir la adulteración, pérdida, consulta o acceso no autorizado a los datos:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Cifrado en tránsito y en reposo mediante certificados SSL/TLS con encriptación de 256 bits.</li>
              <li>Bases de datos distribuidas en Cloud Firestore (Google Cloud Platform) con reglas de seguridad granulares que aíslan estrictamente los datos de cada comercio mediante identificadores únicos de cuenta.</li>
              <li>Copias de respaldo redundantes continuas para salvaguardar la integridad de las operaciones comerciales.</li>
            </ul>
          </section>

          {/* SECCIÓN 8 */}
          <section className="space-y-2">
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span className="text-blue-600">8.</span> Procedimiento para el Ejercicio de Derechos
            </h2>
            <p>
              Para peticiones formales, el titular podrá enviar una solicitud al correo <strong>fiabono.app@gmail.com</strong> indicando su nombre completo, documento de identificación, correo electrónico asociado a la cuenta y la descripción clara del requerimiento. Las consultas serán atendidas en un término máximo de diez (10) días hábiles y los reclamos en quince (15) días hábiles, conforme a los plazos fijados por la Ley 1581 de 2012.
            </p>
          </section>

          {/* SECCIÓN 9 */}
          <section className="space-y-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span className="text-blue-600">9.</span> Vigencia y Actualizaciones
            </h2>
            <p>
              Esta Política de Tratamiento entra en vigencia a partir de su publicación en septiembre de 2026. Cualquier modificación sustancial en las finalidades del tratamiento será notificada oportunamente a los usuarios a través del sitio web antes de su entrada en vigor.
            </p>
          </section>

        </div>

        {/* PIE DE PÁGINA */}
        <div className="mt-12 text-center">
          <Link 
            href="/" 
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm px-6 py-3 rounded-xl shadow-lg shadow-emerald-600/25 transition-transform active:scale-95"
          >
            <ArrowLeft size={16} /> Volver a la página principal
          </Link>
        </div>
      </main>
    </div>
  );
}
