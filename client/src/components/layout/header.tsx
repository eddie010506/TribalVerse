import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { MessageSquare } from 'lucide-react';
import { Link } from 'wouter';

export function Header() {
  const { user, logoutMutation } = useAuth();

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
        <div className="flex items-center">
          <Link href="/">
            <a className="flex items-center">
              <MessageSquare className="h-8 w-8 text-primary" />
              <span className="ml-2 text-xl font-semibold text-neutral-800">ChatterBox</span>
            </a>
          </Link>
        </div>
        
        {user ? (
          <div className="flex items-center gap-4">
            <span className="text-sm text-neutral-600">
              Hello, <span className="font-medium">{user.username}</span>
            </span>
            <Button variant="outline" size="sm" onClick={handleLogout} disabled={logoutMutation.isPending}>
              {logoutMutation.isPending ? 'Logging out...' : 'Logout'}
            </Button>
          </div>
        ) : (
          <Link href="/auth">
            <a className="text-primary hover:text-primary-dark font-medium">
              Sign in
            </a>
          </Link>
        )}
      </div>
    </header>
  );
}
