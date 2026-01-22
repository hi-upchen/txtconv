import type { User } from '@supabase/supabase-js';
import type { Profile } from '@/types/user';
import AuthButton from './AuthButton';

interface HeaderProps {
  user: User | null;
  profile: Profile | null;
}

export default function Header({ user, profile }: HeaderProps) {
  return (
    <header className="bg-white border-b border-gray-100 py-3 px-6 flex items-center justify-between sticky top-0 z-50 shadow-sm">
      <a href="/" className="text-xl font-bold tracking-tight text-primary">
        txtconv
      </a>
      <AuthButton user={user} profile={profile} />
    </header>
  );
}
