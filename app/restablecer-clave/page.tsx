"use client";
import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { verifyPasswordResetCode, confirmPasswordReset } from "firebase/auth";
import { auth } from "@/firebase";
import LogoFiabono from "@/components/LogoFiabono";
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, ArrowLeft, KeyRound, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";

function RestablecerClaveContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const oobCode = searchParams.get("oobCode") || "";

  const [verificando, setVerificando] = useState(true);
  const [emailUsuario, setEmailUsuario] = useState("");
  const [codigoInvalido, setCodigoInvalido] = useState(false);
  const [mensajeError, setMensajeError] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [mostrarConfirmPassword, setMostrarConfirmPassword] = useState(false);

  const [guardando, setGuardando] = useState(false);
  const [exito, setExito] = useState(false);

  useEffect(() => {
    // Forzar modo oscuro a nivel de documento para controles nativos del navegador (balas de password blancas en Chromium)
    document.documentElement.classList.add("dark");
    document.documentElement.style.colorScheme = "dark";
    return () => {
      document.documentElement.style.colorScheme = "";
    };
  }, []);

  useEffect(() => {
    if (!oobCode) {
      setVerificando(false);
      setCodigoInvalido(true);
      setMensajeError("No se proporcionó un código de recuperación válido.");
      return;
    }

    const verificarCodigo = async () => {
      try {
        const email = await verifyPasswordResetCode(auth, oobCode);
        setEmailUsuario(email);
        setVerificando(false);
      } catch (err: any) {
        console.error("Error al verificar código de recuperación:", err);
        setVerificando(false);
        setCodigoInvalido(true);
        if (err.code === "auth/expired-action-code") {
          setMensajeError("Este enlace de recuperación ha expirado. Por favor solicita uno nuevo.");
        } else if (err.code === "auth/invalid-action-code") {
          setMensajeError("Este enlace ya fue utilizado o no es válido. Por favor solicita uno nuevo.");
        } else {
          setMensajeError("Ocurrió un error al validar el enlace. Intenta solicitar uno nuevo.");
        }
      }
    };

    verificarCodigo();
  }, [oobCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Las contraseñas no coinciden.");
      return;
    }

    setGuardando(true);
    try {
      await confirmPasswordReset(auth, oobCode, password);
      setExito(true);
      toast.success("Contraseña actualizada exitosamente.");
    } catch (err: any) {
      console.error("Error al confirmar nueva contraseña:", err);
      toast.error(err.message || "Error al actualizar la contraseña.");
    } finally {
      setGuardando(false);
    }
  };

  const passwordsCoinciden = password && confirmPassword && password === confirmPassword;
  const longitudValida = password.length >= 6;

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden text-slate-100" style={{ colorScheme: 'dark' }}>
      {/* Luces de fondo sutiles */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Cabecera / Logo Oficial */}
      <div className="mb-6 z-10 text-center">
        <div className="inline-block cursor-pointer hover:opacity-90 transition-opacity" onClick={() => router.push('/')}>
          <LogoFiabono variant="dark" size={36} />
        </div>
      </div>

      <div className="w-full max-w-md bg-slate-900/95 border border-slate-800 rounded-[2.5rem] p-6 sm:p-9 shadow-2xl backdrop-blur-xl relative z-10">
        {/* ESTADO 1: VERIFICANDO ENLACE */}
        {verificando && (
          <div className="text-center py-12 space-y-4">
            <div className="w-12 h-12 border-3 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto" />
            <h3 className="text-lg font-black text-white">Validando enlace de seguridad...</h3>
            <p className="text-xs text-slate-400">Estamos verificando tu código de recuperación con Fiabono.</p>
          </div>
        )}

        {/* ESTADO 2: CÓDIGO INVÁLIDO O EXPIRADO */}
        {!verificando && codigoInvalido && (
          <div className="text-center py-4 space-y-5 animate-in fade-in duration-200">
            <div className="w-16 h-16 bg-rose-500/15 border border-rose-500/30 text-rose-400 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
              <AlertCircle size={32} />
            </div>
            <div>
              <h3 className="text-xl font-black text-white mb-2">Enlace no disponible</h3>
              <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
                {mensajeError}
              </p>
            </div>
            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => router.push('/?recuperar=1')}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl text-xs transition active:scale-98 shadow-md shadow-blue-600/20 cursor-pointer"
              >
                Solicitar un nuevo enlace
              </button>
              <button
                type="button"
                onClick={() => router.push('/')}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Volver al inicio
              </button>
            </div>
          </div>
        )}

        {/* ESTADO 3: ÉXITO - CONTRASEÑA ACTUALIZADA */}
        {!verificando && !codigoInvalido && exito && (
          <div className="text-center py-4 space-y-5 animate-in fade-in duration-200">
            <div className="w-16 h-16 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
              <CheckCircle2 size={34} />
            </div>
            <div>
              <h3 className="text-2xl font-black text-white mb-2">Contraseña Actualizada</h3>
              <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
                Tu nueva contraseña ha sido guardada exitosamente. Ya puedes iniciar sesión con tus nuevas credenciales.
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => router.push('/?login=1')}
                className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black rounded-xl text-sm transition active:scale-98 shadow-lg shadow-blue-600/25 cursor-pointer"
              >
                Iniciar Sesión en Fiabono
              </button>
            </div>
          </div>
        )}

        {/* ESTADO 4: FORMULARIO DE NUEVA CONTRASEÑA */}
        {!verificando && !codigoInvalido && !exito && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="text-center">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-blue-600/30">
                <KeyRound size={26} />
              </div>
              <h3 className="text-2xl font-black text-white mb-1">Crea tu Nueva Contraseña</h3>
              <p className="text-xs text-slate-300">
                Restableciendo acceso para:{" "}
                <span className="font-bold text-blue-400 block mt-0.5">{emailUsuario}</span>
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <style dangerouslySetInnerHTML={{ __html: `
                .pwd-input {
                  color-scheme: dark !important;
                  color: #ffffff !important;
                  -webkit-text-fill-color: #ffffff !important;
                  caret-color: #ffffff !important;
                }
                .pwd-input::placeholder {
                  color: #94a3b8 !important;
                  -webkit-text-fill-color: #94a3b8 !important;
                  opacity: 1 !important;
                }
                .pwd-input:-webkit-autofill,
                .pwd-input:-webkit-autofill:hover, 
                .pwd-input:-webkit-autofill:focus {
                  -webkit-box-shadow: 0 0 0px 1000px #1e293b inset !important;
                  -webkit-text-fill-color: #ffffff !important;
                  caret-color: #ffffff !important;
                  color-scheme: dark !important;
                }
              `}} />

              {/* Campo 1: Nueva Contraseña */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-100 mb-1.5 ml-1">
                  Nueva Contraseña
                </label>
                <div className="relative">
                  <input
                    type={mostrarPassword ? "text" : "password"}
                    required
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    style={{ color: '#ffffff', WebkitTextFillColor: '#ffffff', caretColor: '#ffffff', fontSize: '16px', colorScheme: 'dark' }}
                    className="pwd-input w-full p-4 pr-12 bg-slate-800/90 border border-slate-700 focus:border-blue-500 focus:bg-slate-800 rounded-2xl outline-none font-bold text-base transition text-white placeholder:text-slate-400 caret-white shadow-inner"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarPassword(!mostrarPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer p-1.5 transition-colors"
                  >
                    {mostrarPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              {/* Campo 2: Confirmar Contraseña */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-100 mb-1.5 ml-1">
                  Confirmar Nueva Contraseña
                </label>
                <div className="relative">
                  <input
                    type={mostrarConfirmPassword ? "text" : "password"}
                    required
                    placeholder="Repite tu nueva contraseña"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    style={{ color: '#ffffff', WebkitTextFillColor: '#ffffff', caretColor: '#ffffff', fontSize: '16px', colorScheme: 'dark' }}
                    className={`pwd-input w-full p-4 pr-12 rounded-2xl outline-none font-bold text-base transition text-white placeholder:text-slate-400 caret-white shadow-inner ${
                      confirmPassword && !passwordsCoinciden
                        ? 'bg-rose-950/20 border-2 border-rose-500/80 focus:border-rose-500'
                        : passwordsCoinciden
                        ? 'bg-emerald-950/20 border-2 border-emerald-500/80 focus:border-emerald-500'
                        : 'bg-slate-800/90 border border-slate-700 focus:border-blue-500 focus:bg-slate-800'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarConfirmPassword(!mostrarConfirmPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer p-1.5 transition-colors"
                  >
                    {mostrarConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>

                {/* Validaciones visuales */}
                <div className="mt-2.5 space-y-1.5 text-xs font-bold ml-1">
                  <div className={`flex items-center gap-2 ${longitudValida ? 'text-emerald-400' : 'text-slate-400'}`}>
                    <div className={`w-2 h-2 rounded-full ${longitudValida ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                    <span>Mínimo 6 caracteres</span>
                  </div>
                  {confirmPassword && (
                    <div className={`flex items-center gap-2 ${passwordsCoinciden ? 'text-emerald-400' : 'text-rose-400'}`}>
                      <div className={`w-2 h-2 rounded-full ${passwordsCoinciden ? 'bg-emerald-400' : 'bg-rose-500'}`} />
                      <span>{passwordsCoinciden ? 'Las contraseñas coinciden' : 'Las contraseñas no coinciden'}</span>
                    </div>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={guardando || !longitudValida || !passwordsCoinciden}
                style={guardando || !longitudValida || !passwordsCoinciden ? { color: '#cbd5e1' } : {}}
                className={`w-full py-4 text-sm font-black rounded-2xl transition-all mt-4 flex items-center justify-center gap-2 shadow-lg ${
                  guardando || !longitudValida || !passwordsCoinciden
                    ? 'bg-slate-800/90 text-slate-300 border border-slate-700 cursor-not-allowed shadow-none opacity-80'
                    : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-600/30 active:scale-98 cursor-pointer'
                }`}
              >
                {guardando ? (
                  <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <ShieldCheck size={19} />
                )}
                <span>{guardando ? "Guardando cambios..." : "Guardar Contraseña e Ingresar"}</span>
              </button>
            </form>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => router.push('/')}
                className="text-xs font-bold text-slate-500 hover:text-slate-300 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft size={13} /> Volver a Fiabono
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 text-center text-xs text-slate-600 z-10">
        Fiabono Cloud Platform &bull; fiabono.com
      </div>
    </div>
  );
}

export default function RestablecerClavePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <RestablecerClaveContent />
    </Suspense>
  );
}
