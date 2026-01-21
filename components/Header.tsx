import type { User } from '@supabase/supabase-js';
import type { Profile } from '@/types/user';
import AuthButton from './AuthButton';

interface HeaderProps {
  user: User | null;
  profile: Profile | null;
}

export default function Header({ user, profile }: HeaderProps) {
  return (
    <nav className="navbar" role="navigation" aria-label="main navigation">
      <div className="container">
        <div className="navbar-brand">
          <a className="navbar-item" href="/">
            <strong>txtconv</strong>
          </a>
        </div>

        <div className="navbar-end">
          <div className="navbar-item">
            <div className="buttons">
              <AuthButton user={user} profile={profile} />
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
