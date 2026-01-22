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

export default function AuthButton({ user, profile }: AuthButtonProps) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [message, setMessage] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');

    const redirectUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${redirectUrl}/auth/callback`,
      },
    });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage('Check your email for the magic link!');
      setEmail('');
    }
    setIsLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  // Logged out state - show Login button
  if (!user) {
    return (
      <>
        <button
          className="bg-white text-gray-700 border border-gray-200 px-4 py-1.5 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
          onClick={() => setShowModal(true)}
        >
          Login
        </button>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setShowModal(false)}
            />

            {/* Modal content */}
            <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-800">Login</h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              {/* Body */}
              <div className="px-6 py-6">
                <form onSubmit={handleLogin}>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email
                    </label>
                    <input
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>

                  {message && (
                    <div
                      className={`mb-4 px-4 py-3 rounded-lg text-sm ${
                        message.includes('Check')
                          ? 'bg-green-50 text-green-700 border border-green-200'
                          : 'bg-red-50 text-red-700 border border-red-200'
                      }`}
                    >
                      {message}
                    </div>
                  )}

                  <button
                    className={`w-full py-3 px-4 bg-primary hover:bg-primary-hover text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 ${
                      isLoading ? 'opacity-70 cursor-not-allowed' : ''
                    }`}
                    type="submit"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                        Sending...
                      </>
                    ) : (
                      'Send Magic Link'
                    )}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // Logged in state - show email dropdown
  return (
    <div className="relative">
      <button
        className="bg-white text-gray-700 border border-gray-200 px-4 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 hover:bg-gray-50 transition-colors"
        onClick={() => setShowDropdown(!showDropdown)}
        onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
      >
        {user.email}
        <span className="material-symbols-outlined text-sm">expand_more</span>
      </button>

      {/* Dropdown menu */}
      {showDropdown && (
        <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden z-50">
          <div className="px-4 py-3 text-xs text-gray-400 border-b border-gray-100 bg-gray-50/50">
            {isPaidUser(profile) ? 'Pro Account' : 'Free Account'}
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
