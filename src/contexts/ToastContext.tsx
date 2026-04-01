/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { ToastType } from '../components/Toast';
import { ToastContainer } from '../components/Toast';
import { generateId } from '../utils/helpers';

type Toast = {
  id: string;
  message: string;
  type: ToastType;
};

interface ToastActionsContextType {
  addToast: (message: string, type: ToastType) => void;
  removeToast: (id: string) => void;
}

const ToastActionsContext = createContext<ToastActionsContextType | undefined>(undefined);
const ToastStateContext = createContext<Toast[] | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback((message: string, type: ToastType) => {
    const id = generateId();
    setToasts(prev => [...prev, { id, message, type }]);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  }, []);

  const actionsValue = useMemo(() => ({ addToast, removeToast }), [addToast, removeToast]);

  return (
    <ToastActionsContext.Provider value={actionsValue}>
      <ToastStateContext.Provider value={toasts}>{children}</ToastStateContext.Provider>
    </ToastActionsContext.Provider>
  );
}

export function useToastActions(): ToastActionsContextType {
  const ctx = useContext(ToastActionsContext);
  if (!ctx) throw new Error('useToastActions must be used within ToastProvider');
  return ctx;
}

export function useToastsState(): { toasts: Toast[] } {
  const ctx = useContext(ToastStateContext);
  if (!ctx) return { toasts: [] };
  return { toasts: ctx };
}

// Re-export container to keep usage consistent with App.tsx.
export { ToastContainer };

