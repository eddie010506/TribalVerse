import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import HomePage from "@/pages/home-page";
import ChatRoom from "@/pages/chat-room";
import CreateRoom from "@/pages/create-room";
import ProfilePage from "@/pages/profile-page";
import UserProfilePage from "@/pages/user-profile-page";
import PostsPage from "@/pages/posts-page";
import CreatePostPage from "@/pages/create-post-page";
import PublicRoomsPage from "@/pages/public-rooms-page";
import { ProtectedRoute } from "./lib/protected-route";
import { AuthProvider } from "@/hooks/use-auth";
import { RoomInvitationsProvider } from "@/hooks/use-room-invitations";
import { useAIProfileSetup } from "@/hooks/use-ai-profile-setup";
import { ProfileSetupDialog } from "@/components/ai/profile-setup-dialog";
import { useAuth } from "@/hooks/use-auth";
import { useState, useEffect } from "react";

// ProfileCheckRouter component to check if profile is complete and redirect if needed
function ProfileCheckRouter() {
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const { user } = useAuth();
  const { isProfileComplete, isLoading } = useAIProfileSetup();
  const [location] = useLocation();
  
  // Check if user is logged in and profile is incomplete
  useEffect(() => {
    if (
      user && 
      !isLoading && 
      location !== '/auth' && 
      location !== '/profile'
    ) {
      // Only check for session completion if the user is not a demo account
      // For demo accounts we'll handle this specifically below
      if (!user.username.includes('demovideo')) {
        const completedSetup = localStorage.getItem('profileSetupCompleted');
        if (completedSetup === 'true') {
          return; // Don't show profile setup if it's already been completed
        }
      }
      
      // For demo accounts, check more carefully
      const isDemoAccount = user.username === 'demovideo' || user.username === 'demovideos' || 
                          user.username === 'demovideo1' || user.username === 'demovideo2';
      
      if (isDemoAccount) {
        // For demo accounts, check if they've already completed setup in this session
        const demoCompleted = localStorage.getItem('profileSetupCompleted');
        if (demoCompleted === 'true') {
          return; // Don't show if completed
        }
        
        // Otherwise show the profile setup
        setShowProfileSetup(true);
        return;
      }
      
      // For regular users, check if profile is incomplete
      if (!isProfileComplete()) {
        // Check if we've shown the dialog recently and user chose to skip
        const lastSkippedTime = localStorage.getItem('profileSetupSkippedAt');
        
        if (lastSkippedTime) {
          // If it was skipped less than 24 hours ago, don't show again
          const skippedTimestamp = parseInt(lastSkippedTime, 10);
          const currentTime = Date.now();
          const hoursSinceSkipped = (currentTime - skippedTimestamp) / (1000 * 60 * 60);
          
          if (hoursSinceSkipped < 24) {
            // It's been less than 24 hours since the user skipped
            return;
          }
        }
        
        // Show the profile setup dialog
        setShowProfileSetup(true);
      }
    }
  }, [user, isLoading, location, isProfileComplete]);

  // Handle dialog close with a reason (completed or skipped)
  const handleDialogChange = (open: boolean) => {
    if (!open) {
      // If completed flag is present, don't record as skipped
      const completedSetup = localStorage.getItem('profileSetupCompleted');
      if (completedSetup !== 'true' && !isProfileComplete()) {
        localStorage.setItem('profileSetupSkippedAt', Date.now().toString());
      }
      setShowProfileSetup(false);
    }
  };

  return (
    <>
      {/* Profile setup dialog - shown for first-time users */}
      <ProfileSetupDialog open={showProfileSetup} onOpenChange={handleDialogChange} />
      
      <Switch>
        <ProtectedRoute path="/" component={PostsPage} />
        <Route path="/posts">
          <Redirect to="/" />
        </Route>
        <ProtectedRoute path="/chat" component={HomePage} />
        <ProtectedRoute path="/public-rooms" component={PublicRoomsPage} />
        <ProtectedRoute path="/rooms/:id" component={ChatRoom} />
        <ProtectedRoute path="/create-room" component={CreateRoom} />
        <ProtectedRoute path="/profile" component={ProfilePage} />
        <ProtectedRoute path="/users/:id" component={UserProfilePage} />
        <ProtectedRoute path="/create-post" component={CreatePostPage} />
        <Route path="/auth" component={AuthPage} />
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RoomInvitationsProvider>
          <ProfileCheckRouter />
          <Toaster />
        </RoomInvitationsProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
