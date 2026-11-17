import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";
const Context = createContext<(message: string, error?: boolean) => void>(
  () => {},
);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{
    message: string;
    error: boolean;
    id: number;
  } | null>(null);
  function notify(message: string, error = false) {
    const id = Date.now();
    setToast({ message, error, id });
    setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 5500);
  }
  return (
    <Context.Provider value={notify}>
      {children}
      {toast && (
        <div
          role={toast.error ? "alert" : "status"}
          className={"toast " + (toast.error ? "toast-error" : "")}
        >
          {toast.error ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
          <span>{toast.message}</span>
          <button aria-label="Dismiss message" onClick={() => setToast(null)}>
            <X size={18} />
          </button>
        </div>
      )}
    </Context.Provider>
  );
}
export const useToast = () => useContext(Context);
