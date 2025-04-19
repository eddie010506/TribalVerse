import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { MessageSquare, User, FileText, Menu, Home, LogOut, Bot } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { useState, useEffect } from 'react';
import { 
  Sheet, 
  SheetContent, 
  SheetTrigger,
  SheetClose
} from '@/components/ui/sheet';

export function Header() {
  const { user, logoutMutation } = useAuth();
  // Use a constant to always show hamburger menu on mobile-sized screens
  const isMobileView = true; // This forces mobile view for all screen sizes as required
  const [location] = useLocation();

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  // Navigation items for the hamburger menu
  const navigationItems = user ? [
    { href: "/", icon: <FileText className="h-5 w-5 mr-3" />, label: "Posts", active: location === "/" },
    { href: "/chat", icon: <MessageSquare className="h-5 w-5 mr-3" />, label: "Chat Rooms", active: location === "/chat" },
    { href: "/profile", icon: <User className="h-5 w-5 mr-3" />, label: "Profile", active: location === "/profile" },
    { href: "/ai-chat", icon: <Bot className="h-5 w-5 mr-3" />, label: "AI Assistant", active: location === "/ai-chat" },
  ] : [];

  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
        <div className="flex items-center">
          <Link href="/">
            <div className="flex items-center cursor-pointer">
              <MessageSquare className="h-8 w-8 text-primary" />
              <span className="ml-2 text-xl font-semibold text-neutral-800">TribalVerse</span>
            </div>
          </Link>
        </div>
        
        {user ? (
          <>
            {isMobileView ? (
              <div className="flex items-center gap-3">
                <NotificationBell />
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="bg-primary-50 hover:bg-primary-100">
                      <Menu className="h-6 w-6 text-primary" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-[250px] sm:w-[300px]">
                    <div className="py-4">
                      <div className="flex items-center mb-6">
                        <User className="h-5 w-5 mr-2" />
                        <span className="font-medium">{user.username}</span>
                      </div>
                      <nav className="flex flex-col space-y-3 mb-6">
                        {navigationItems.map((item) => (
                          <SheetClose asChild key={item.href}>
                            <Link href={item.href}>
                              <div className={`flex items-center py-2 px-2 rounded-md ${item.active ? 'text-primary bg-primary/10' : 'text-neutral-600 hover:bg-neutral-100'}`}>
                                {item.icon}
                                <span>{item.label}</span>
                              </div>
                            </Link>
                          </SheetClose>
                        ))}
                      </nav>
                      <Button 
                        variant="outline" 
                        className="w-full flex items-center justify-center" 
                        onClick={handleLogout}
                        disabled={logoutMutation.isPending}
                      >
                        <LogOut className="h-4 w-4 mr-2" />
                        {logoutMutation.isPending ? 'Logging out...' : 'Logout'}
                      </Button>
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <NotificationBell />
                <Link href="/chat">
                  <div className="flex items-center text-sm text-neutral-600 cursor-pointer hover:text-primary">
                    <MessageSquare className="h-4 w-4 mr-1" />
                    <span className="font-medium">Chat Rooms</span>
                  </div>
                </Link>
                <Link href="/ai-chat">
                  <div className="flex items-center text-sm text-neutral-600 cursor-pointer hover:text-primary">
                    <Bot className="h-4 w-4 mr-1" />
                    <span className="font-medium">AI Assistant</span>
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
            )}
          </>
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