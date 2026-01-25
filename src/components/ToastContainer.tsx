/**
 * ToastContainer - Manages and displays toast notifications
 * Provides context for adding/removing toasts
 */

import { useState, useCallback, useEffect } from 'react';
import Toast, { type ToastType } from './Toast';
import './ToastContainer.css';

export interface ToastData {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  autoDismiss?: number;
}

interface ToastContainerProps {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
  maxToasts?: number;
}

// Context for toast management (can be exported if needed elsewhere)
let toastCallbacks: Array<(toast: ToastData) => void> = [];

// Export showToast function for global use
export function showToast(toast: Omit<ToastData, 'id'>) {
  const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const toastData: ToastData = { ...toast, id };
  toastCallbacks.forEach((cb) => cb(toastData));
}

export default function ToastContainer({
  position = 'top-right',
  maxToasts = 5,
}: ToastContainerProps) {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const addToast = useCallback((toast: ToastData) => {
    setToasts((prev) => {
      const newToasts = [toast, ...prev].slice(0, maxToasts);
      return newToasts;
    });
  }, [maxToasts]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    toastCallbacks.push(addToast);
    return () => {
      toastCallbacks = toastCallbacks.filter((cb) => cb !== addToast);
    };
  }, [addToast]);

  if (toasts.length === 0) return null;

  return (
    <div className={`toast-container toast-container-${position}`} aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          id={toast.id}
          type={toast.type}
          title={toast.title}
          message={toast.message}
          autoDismiss={toast.autoDismiss}
          onDismiss={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
}
