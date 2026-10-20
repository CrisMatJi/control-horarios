import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

type Toast = { texto: string; accion?: { label: string; fn: () => void } };
const Ctx = createContext<(t: Toast) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [t, setT] = useState<Toast | null>(null);
  const timer = useRef<number>();
  const mostrar = useCallback((nuevo: Toast) => {
    setT(nuevo);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setT(null), nuevo.accion ? 8000 : 4000);
  }, []);
  return (
    <Ctx.Provider value={mostrar}>
      {children}
      {t && (
        <div className="toast" role="status">
          <span>{t.texto}</span>
          {t.accion && (
            <button className="btn" onClick={() => { t.accion!.fn(); setT(null); }}>{t.accion.label}</button>
          )}
        </div>
      )}
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
