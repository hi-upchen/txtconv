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

  if (!user) {
    return (
      <>
        <button
          className="button is-light"
          onClick={() => setShowModal(true)}
        >
          Login
        </button>

        {showModal && (
          <div className={`modal ${showModal ? 'is-active' : ''}`}>
            <div className="modal-background" onClick={() => setShowModal(false)} />
            <div className="modal-card">
              <header className="modal-card-head">
                <p className="modal-card-title">Login</p>
                <button
                  className="delete"
                  aria-label="close"
                  onClick={() => setShowModal(false)}
                />
              </header>
              <section className="modal-card-body">
                <form onSubmit={handleLogin}>
                  <div className="field">
                    <label className="label">Email</label>
                    <div className="control">
                      <input
                        className="input"
                        type="email"
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  {message && (
                    <div className={`notification ${message.includes('Check') ? 'is-success' : 'is-danger'} is-light`}>
                      {message}
                    </div>
                  )}
                  <button
                    className={`button is-primary is-fullwidth ${isLoading ? 'is-loading' : ''}`}
                    type="submit"
                    disabled={isLoading}
                  >
                    Send Magic Link
                  </button>
                </form>
              </section>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className={`dropdown ${showDropdown ? 'is-active' : ''}`}>
      <div className="dropdown-trigger">
        <button
          className="button is-light"
          onClick={() => setShowDropdown(!showDropdown)}
        >
          <span>{user.email}</span>
          {isPaidUser(profile) && (
            <span className="tag is-warning ml-2">Pro</span>
          )}
          <span className="icon is-small">
            <i className="fas fa-angle-down" aria-hidden="true" />
          </span>
        </button>
      </div>
      <div className="dropdown-menu">
        <div className="dropdown-content">
          <div className="dropdown-item">
            <p className="is-size-7 has-text-grey">
              {isPaidUser(profile) ? 'Pro Account' : 'Free Account'}
            </p>
          </div>
          <hr className="dropdown-divider" />
          <a className="dropdown-item" onClick={handleLogout}>
            Logout
          </a>
        </div>
      </div>
    </div>
  );
}
