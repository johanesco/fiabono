"use client";

import { Toaster, ToastBar, toast } from "react-hot-toast";

export default function AppToaster() {
  return (
    <Toaster
      position="bottom-center"
      gutter={8}
      containerStyle={{ bottom: 24, zIndex: 2147483647 }}
      toastOptions={{
        duration: 2200,
        className: "!rounded-full !py-2 !px-4 !bg-slate-900/95 dark:!bg-slate-800/95 !text-white !backdrop-blur-xl !border !border-white/10 dark:!border-slate-700/60 !shadow-xl !shadow-black/25 !text-xs sm:!text-sm !font-bold select-none cursor-pointer active:scale-95 transition-transform",
        style: {
          WebkitBackdropFilter: "blur(16px)",
        },
        success: {
          duration: 2200,
          iconTheme: {
            primary: '#10b981',
            secondary: '#ffffff',
          },
        },
        error: {
          duration: 3500,
          iconTheme: {
            primary: '#f43f5e',
            secondary: '#ffffff',
          },
        },
      }}
    >
      {(t) => (
        <div
          onClick={() => toast.dismiss(t.id)}
          className="cursor-pointer active:scale-95 transition-transform"
          title="Toca para cerrar"
        >
          <ToastBar toast={t} />
        </div>
      )}
    </Toaster>
  );
}
