import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { MessageSquare, User, FileText } from 'lucide-react';
import { Link } from 'wouter';
import { NotificationBell } from '@/components/notifications/notification-bell';

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
            <div className="flex items-center cursor-pointer">
              <MessageSquare className="h-8 w-8 text-primary" />
              <span className="ml-2 text-xl font-semibold text-neutral-800">ChatterBox</span>
            </div>
          </Link>
        </div>
        
        {user ? (
          <div className="flex items-center gap-4">
            <NotificationBell />
            <Link href="/posts">
              <div className="flex items-center text-sm text-neutral-600 cursor-pointer hover:text-primary">
                <FileText className="h-4 w-4 mr-1" />
                <span className="font-medium">Posts</span>
              </div>
            </Link>
            <Link href="/profile">
              <div className="flex items-center text-sm text-neutral-600 cursor-pointer hover:text-primary">
                <User className="h-4 w-4 mr-1" />
                <span className="font-medium">{user.username}</span>
              </div>
            </Link>
            <Button variant="outline" size="sm" onClick={handleLogout} disabled={logoutMutation.isPending}>
              {logoutMutation.isPending ? 'Logging out...' : 'Logout'}
            </Button>
          </div>
        ) : (
          <Link href="/auth">
            <div className="text-primary hover:text-primary-dark font-medium cursor-pointer">
              Sign in
            </div>
          </Link>
        )}
      </div>
    </header>
  );
}
