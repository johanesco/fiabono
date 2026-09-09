import React from 'react';
import Link from 'next/link';
import { ShieldCheck, ArrowLeft, Receipt, CheckCircle2, AlertCircle, FileText, Scale, Lock, DollarSign, Phone, RefreshCw } from 'lucide-react';

export const metadata = {
  title: 'Términos y Condiciones del Servicio | Fiabono',
  description: 'Términos y condiciones legales de uso de la plataforma Fiabono para gestión de ventas, fiados e inventario en Colombia.',
};

export default function TerminosPage() {
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
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-black text-xs uppercase tracking-wider mb-3 border border-emerald-200/50">
            <FileText size={14} /> Contrato de Software como Servicio (SaaS)
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-slate-900 dark:text-white mb-4">
            Términos y Condiciones
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
            Última actualización: Septiembre de 2026 • Válido para la República de Colombia
          </p>
        </div>

        {/* TARJETA RESUMEN EJECUTIVO */}
        <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border-2 border-emerald-200 dark:border-emerald-800/50 p-6 rounded-3xl mb-12 text-left space-y-3">
          <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-black text-sm uppercase tracking-wider">
            <ShieldCheck size={18} className="text-emerald-600" />
            <span>En resumen, las reglas de juego claras:</span>
          </div>
          <ul className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 space-y-2 font-medium">
            <li className="flex items-start gap-2">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
              <span><strong>Tus datos son 100% tuyos:</strong> Tus listas de clientes, deudas, precios y productos jamás se comparten ni se comercializan.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
              <span><strong>Cero contratos de permanencia:</strong> Eres libre de usar el plan gratis o cancelar cualquier suscripción en cualquier momento.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
              <span><strong>Herramienta de control interno:</strong> Fiabono te permite organizar tu negocio al instante. No somos banco, no prestamos dinero ni reportamos tus movimientos a la DIAN.</span>
            </li>
          </ul>
        </div>

        {/* ARTÍCULOS DETALLADOS */}
        <div className="bg-white dark:bg-[#0f172a] p-6 sm:p-10 rounded-[2.5rem] border border-slate-200/80 dark:border-slate-800/80 shadow-md text-left space-y-8 text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
          
          {/* SECCIÓN 1 */}
          <section className="space-y-2">
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span className="text-emerald-600">1.</span> Aceptación de los Términos
            </h2>
            <p>
              El presente documento establece los términos contractuales que rigen el acceso y uso de la plataforma de software como servicio (SaaS) denominada <strong>Fiabono</strong> (en adelante, la &ldquo;Plataforma&rdquo;), accesible a través de <code>fiabono.com</code> y sus aplicaciones web móviles derivadas.
            </p>
            <p>
              Al registrar una cuenta, acceder o hacer uso de cualquier funcionalidad de Fiabono, usted (en calidad de titular del comercio, administrador o usuario colaborador autorizado) manifiesta haber leído, comprendido y aceptado en su totalidad las condiciones aquí estipuladas. Si no está de acuerdo con estos términos, deberá abstenerse de utilizar la Plataforma y cancelar su cuenta de manera inmediata.
            </p>
          </section>

          {/* SECCIÓN 2 */}
          <section className="space-y-2">
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span className="text-emerald-600">2.</span> Descripción del Servicio y Funcionalidades
            </h2>
            <p>
              Fiabono es una solución tecnológica en la nube diseñada para la gestión operativa y el control interno de micronegocios, tiendas de barrio, almacenes de moda, calzado y comercios en general. Sus herramientas principales comprenden:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Punto de venta (POS) para registro ágil de ventas en mostrador.</li>
              <li>Módulo de registro y control de fiados (cuentas por cobrar) y asignación de cupos a clientes.</li>
              <li>Generación y envío de comprobantes de pago y extractos mediante enlaces web públicos seguros e integración con WhatsApp.</li>
              <li>Módulo de Plan Separe con registro fotográfico de mercancía, abonos progresivos y alertas de vencimiento.</li>
              <li>Control de inventario físico, catálogo y generador de etiquetas adhesivas con código QR.</li>
              <li>Reportes de caja del día, discriminación entre efectivo físico y transferencias electrónicas, y métricas de cartera.</li>
            </ul>
          </section>

          {/* SECCIÓN 3 */}
          <section className="space-y-2">
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span className="text-emerald-600">3.</span> Exclusión de Actividades Financieras y de Cobranza (No Somos Banco)
            </h2>
            <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-1.5">
              <p className="font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                <DollarSign size={16} className="text-emerald-600" /> Ausencia de Intermediación Financiera
              </p>
              <p className="text-xs">
                Fiabono es única y exclusivamente un software de registro y apoyo administrativo. Fiabono <strong>NO es una entidad bancaria, no capta dinero del público, no otorga créditos ni préstamos de dinero, no fija ni cobra tasas de interés, no compra cartera y no realiza gestión de cobro prejudicial ni judicial</strong>. Cualquier acuerdo de fiado, crédito o plazo pactado entre el Comerciante y sus clientes finales es una relación jurídica estrictamente privada entre ellos. Fiabono queda totalmente exonerada de cualquier responsabilidad por deudas incobrables, pérdidas económicas o incumplimientos de pago de los clientes del Comerciante.
              </p>
            </div>
          </section>

          {/* SECCIÓN 4 */}
          <section className="space-y-2">
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span className="text-emerald-600">4.</span> Exoneración Tributaria y Responsabilidad Fiscal (Escudo DIAN)
            </h2>
            <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-2xl space-y-1.5">
              <p className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                <AlertCircle size={16} /> Responsabilidad Exclusiva del Contribuyente
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Fiabono actúa como una herramienta de <strong>control interno y comprobantes mercantiles</strong> para facilitar la contabilidad operativa del negocio. Fiabono no comparte proactivamente la información ingresada por los usuarios con la Dirección de Impuestos y Aduanas Nacionales (DIAN) ni con secretarías de hacienda locales. Es responsabilidad única y exclusiva del Comerciante determinar su régimen tributario (responsable o no responsable de IVA), declarar sus ingresos reales, liquidar sus impuestos y emitir factura electrónica de venta cuando la ley colombiana así se lo exija. Fiabono no asume ninguna responsabilidad por sanciones, multas, cierres de establecimientos o investigaciones tributarias impuestas al Comerciante.
              </p>
            </div>
          </section>

          {/* SECCIÓN 5 */}
          <section className="space-y-2">
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span className="text-emerald-600">5.</span> Autorización sobre Contactos y Envíos de WhatsApp
            </h2>
            <p>
              Al registrar nombres, números de teléfono o datos de contacto de sus clientes en Fiabono con el fin de emitir comprobantes de venta, abonos o estados de cuenta por WhatsApp, <strong>el Comerciante declara y garantiza bajo la gravedad de juramento que cuenta con la autorización previa, expresa e informada de dichos titulares</strong> de acuerdo con la Ley 1581 de 2012 de Colombia.
            </p>
            <p>
              Cualquier queja, reclamo o acción por presunto envío de mensajes no deseados (SPAM) interpuesta por los clientes finales será responsabilidad exclusiva del Comerciante emisor.
            </p>
          </section>

          {/* SECCIÓN 6 */}
          <section className="space-y-2">
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span className="text-emerald-600">6.</span> Registro, Seguridad de Cuentas y Colaboradores
            </h2>
            <p>
              Para utilizar Fiabono se requiere una cuenta titular (Administrador). El titular declara que la información provista en el registro es veraz, completa y actualizada.
            </p>
            <p>
              <strong>Responsabilidad sobre colaboradores:</strong> El Administrador es el único responsable de configurar adecuadamente los permisos de acceso de sus colaboradores (horarios, visualización de costos, cierres de caja y contacto de clientes) y de la debida custodia de las contraseñas asignadas. Fiabono no responderá por transacciones o manipulaciones indebidas ejecutadas por usuarios autorizados por el titular.
            </p>
          </section>

          {/* SECCIÓN 7 */}
          <section className="space-y-2">
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span className="text-emerald-600">7.</span> Propiedad Intelectual vs. Propiedad de la Información
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                <p className="font-black text-slate-900 dark:text-white mb-1">Propiedad de Fiabono:</p>
                <p className="text-xs">El código fuente, arquitectura, diseño gráfico, logotipos, marcas comerciales y algoritmos son propiedad exclusiva de Fiabono, amparados por las leyes de propiedad intelectual y derechos de autor. Queda prohibida la ingeniería inversa o el web scraping.</p>
              </div>
              <div className="bg-emerald-50/50 dark:bg-emerald-950/30 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-800/50">
                <p className="font-black text-emerald-800 dark:text-emerald-300 mb-1">Propiedad del Comerciante:</p>
                <p className="text-xs">Todos los datos cargados por el usuario (inventario, catálogo, listado de clientes, deudas, comprobantes y reportes contables) son y seguirán siendo propiedad exclusiva del comercio usuario.</p>
              </div>
            </div>
          </section>

          {/* SECCIÓN 8 */}
          <section className="space-y-2">
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span className="text-emerald-600">8.</span> Planes, Tarifas y Cancelación
            </h2>
            <p>
              Fiabono ofrece un Plan Gratuito permanente con límites definidos de clientes y productos, así como planes avanzados (Comercio y PRO) con periodo de prueba sin costo de 14 días.
            </p>
            <p>
              <strong>Sin Permanencia:</strong> Las suscripciones se liquidan de forma mensual o anual según lo seleccionado por el usuario. No existe cláusula de permanencia mínima obligatoria. El usuario puede cancelar su suscripción en cualquier momento; el servicio permanecerá activo hasta la finalización del periodo facturado vigente.
            </p>
          </section>

          {/* SECCIÓN 9 */}
          <section className="space-y-2">
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span className="text-emerald-600">9.</span> Cláusula de Indemnidad
            </h2>
            <p>
              El Comerciante se compromete a defender, indemnizar y mantener indemne a Fiabono, sus socios, directores, empleados y proveedores tecnológicos frente a cualquier reclamo, demanda, daño, perjuicio, pérdida, costo o gasto (incluidos honorarios razonables de abogados) derivados de: (i) el uso indebido, fraudulento o ilícito de la Plataforma; (ii) la violación de estos Términos; (iii) el incumplimiento de normas tributarias, laborales o de protección al consumidor por parte del Comerciante; o (iv) la infracción de derechos de terceros o de las leyes de protección de datos personales.
            </p>
          </section>

          {/* SECCIÓN 10 */}
          <section className="space-y-2">
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span className="text-emerald-600">10.</span> Disponibilidad del Servicio y Terceros Proveedores
            </h2>
            <p>
              Fiabono opera sobre la infraestructura en la nube de Google Cloud y servicios de Firebase. Fiabono no garantiza la operatividad ininterrumpida ante fallas o caídas de operadores de telecomunicaciones locales, bloqueos de redes externas, interrupciones de la API de WhatsApp (Meta), fallas en el suministro eléctrico del comercio o incompatibilidad de dispositivos del usuario.
            </p>
          </section>

          {/* SECCIÓN 11 */}
          <section className="space-y-2">
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span className="text-emerald-600">11.</span> Modificación de los Términos (Documento Vivo)
            </h2>
            <p>
              Fiabono se reserva la facultad de modificar, actualizar o complementar estos Términos y Condiciones en cualquier momento conforme evolucione la Plataforma o el marco legal. Las modificaciones entrarán en vigor a partir del momento de su publicación en el sitio web con la indicación de la fecha de última actualización. La continuidad en el uso de la Plataforma tras la publicación de cambios implicará la aceptación plena de los términos modificados.
            </p>
          </section>

          {/* SECCIÓN 12 */}
          <section className="space-y-2">
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span className="text-emerald-600">12.</span> Arreglo Directo y Ley Aplicable
            </h2>
            <p>
              Estos Términos se rigen por las leyes de la República de Colombia. Cualquier diferencia, controversia o reclamación que surja entre las partes se someterá en primera instancia a un procedimiento de <strong>arreglo directo por un término de treinta (30) días hábiles</strong>. Si transcurrido dicho plazo no se llegare a un acuerdo, las partes acudirán a un centro de conciliación legalmente autorizado en la ciudad de domicilio de Fiabono en Colombia antes de acudir a cualquier instancia judicial ordinaria.
            </p>
          </section>

          {/* SECCIÓN 13 */}
          <section className="space-y-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span className="text-emerald-600">13.</span> Contacto y Notificaciones
            </h2>
            <p>
              Para cualquier consulta, aclaración o sugerencia sobre estos Términos, los usuarios pueden comunicarse con el equipo a través del correo oficial: <strong>fiabono.app@gmail.com</strong>.
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
