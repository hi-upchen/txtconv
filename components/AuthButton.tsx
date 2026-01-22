'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '@/types/user';
import { isPaidUser } from '@/lib/auth';

interface AuthButtonProps {
  user: User | null;
  profile: Profile | null;
}

type ModalState = 'closed' | 'login' | 'check-email';

export default function AuthButton({ user, profile }: AuthButtonProps) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [modalState, setModalState] = useState<ModalState>('closed');
  const [errorMessage, setErrorMessage] = useState('');
  const [sentEmail, setSentEmail] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const supabase = createClient();

  const closeModal = () => {
    setModalState('closed');
    setErrorMessage('');
    setEmail('');
    setSentEmail('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage('');

    const redirectUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${redirectUrl}/auth/callback`,
      },
    });

    if (error) {
      setErrorMessage(error.message);
    } else {
      setSentEmail(email);
      setEmail('');
      setModalState('check-email');
    }
    setIsLoading(false);
  };

  const handleResendEmail = async () => {
    if (!sentEmail) return;
    setIsLoading(true);

    const redirectUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    await supabase.auth.signInWithOtp({
      email: sentEmail,
      options: {
        emailRedirectTo: `${redirectUrl}/auth/callback`,
      },
    });
    setIsLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const getSubscriptionLabel = (): string => {
    if (!isPaidUser(profile)) return 'Free';
    if (profile?.license_type === 'lifetime') return 'Lifetime Plan';
    return 'Monthly Plan';
  };

  // Logged out state - show Login button
  if (!user) {
    return (
      <>
        <button
          className="bg-white text-gray-700 border border-gray-200 px-4 py-1.5 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
          onClick={() => setModalState('login')}
        >
          Login
        </button>

        {/* Login Modal */}
        {modalState === 'login' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeModal} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[340px] mx-4 p-6">
              <button onClick={closeModal} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
              <h2 className="text-xl font-semibold text-gray-800 mb-1">登入 / 註冊</h2>
              <p className="text-sm text-gray-500 mb-5">輸入電子信箱，我們將寄送登入連結給您</p>
              <form onSubmit={handleLogin}>
                <input
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors mb-3"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                {errorMessage && (
                  <div className="mb-3 px-3 py-2 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">
                    {errorMessage}
                  </div>
                )}
                <button
                  className={`w-full py-2.5 bg-primary hover:bg-primary-hover text-white font-medium rounded-lg transition-colors ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                  type="submit"
                  disabled={isLoading}
                >
                  {isLoading ? '傳送中...' : '寄送魔術連結'}
                </button>
              </form>
              <p className="text-xs text-gray-400 text-center mt-4">無須密碼，安全便捷</p>
            </div>
          </div>
        )}

        {/* Check Email Modal */}
        {modalState === 'check-email' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeModal} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[320px] mx-4 p-6 text-center">
              <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-primary text-3xl">check_circle</span>
              </div>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">請檢查您的信箱</h2>
              <p className="text-sm text-gray-500 mb-5">
                我們已將登入連結寄送至<br />
                <span className="font-medium text-gray-700">{sentEmail}</span>
              </p>
              <button
                onClick={closeModal}
                className="w-full py-2.5 bg-primary hover:bg-primary-hover text-white font-medium rounded-lg transition-colors mb-3"
              >
                我知道了
              </button>
              <button
                onClick={handleResendEmail}
                className="text-sm text-gray-500 hover:text-primary transition-colors"
                disabled={isLoading}
              >
                {isLoading ? '傳送中...' : '沒收到信？重新寄送'}
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Logged in state - show email dropdown
  const paid = isPaidUser(profile);

  return (
    <div className="relative">
      <button
        className="bg-white text-gray-700 border border-gray-200 px-4 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 hover:bg-gray-50 transition-colors"
        onClick={() => setShowDropdown(!showDropdown)}
        onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
      >
        {user.email}
        <span className="material-symbols-outlined text-sm">{showDropdown ? 'expand_less' : 'expand_more'}</span>
      </button>

      {/* Dropdown menu */}
      {showDropdown && (
        <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Current Subscription</div>
            <div className="flex items-center gap-1.5">
              {paid && <span className="material-symbols-outlined text-primary text-base">verified</span>}
              <span className={`text-sm font-medium ${paid ? 'text-gray-800' : 'text-gray-500'}`}>
                {getSubscriptionLabel()}
              </span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-base">logout</span>
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
