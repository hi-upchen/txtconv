'use client';

import LoginPanel from './LoginPanel';

interface LoginDialogProps {
  onClose: () => void;
  /** Optional line under the heading, e.g. why this feature needs a login. */
  description?: string;
}

/**
 * Modal that wraps the login panel.
 * Clicking the backdrop or the close button calls onClose.
 */
export default function LoginDialog({ onClose, description }: LoginDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[340px] mx-4 p-6">
        <button
          type="button"
          onClick={onClose}
          aria-label="關閉"
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <span className="material-symbols-outlined text-xl" aria-hidden="true">close</span>
        </button>
        <LoginPanel description={description} />
      </div>
    </div>
  );
}
