'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '@/types/user';
import { isPaidUser } from '@/lib/auth';
import LoginPanel from './LoginPanel';

interface AuthButtonProps {
  user: User | null;
  profile: Profile | null;
}

export default function AuthButton({ user, profile }: AuthButtonProps) {
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const supabase = createClient();

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
          onClick={() => setIsLoginOpen(true)}
        >
          Login
        </button>

        {/* Login dialog. The panel owns the whole flow, including the code step. */}
        {isLoginOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsLoginOpen(false)} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[340px] mx-4 p-6">
              <button
                type="button"
                onClick={() => setIsLoginOpen(false)}
                aria-label="關閉"
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              >
                <span className="material-symbols-outlined text-xl" aria-hidden="true">close</span>
              </button>
              <LoginPanel />
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
