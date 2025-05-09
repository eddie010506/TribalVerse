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
import { useAIProfileSetup, resetProfileSetupState } from "@/hooks/use-ai-profile-setup";
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
      console.log("Checking profile completeness for:", user.username);
      
      // Reset profile setup state for testing - this ensures the dialog appears
      // when a profile is empty, regardless of previous localStorage settings
      if (!user.hobbies || !user.interests || !user.currentActivities || !user.favoriteFood) {
        console.log("Profile is incomplete - resetting localStorage state");
        resetProfileSetupState();
      }
      
      // Check if profile is incomplete
      const profileIncomplete = !isProfileComplete();
      console.log("Profile is incomplete:", profileIncomplete);
      
      // Force dialog to appear for any user with an incomplete profile
      if (profileIncomplete) {
        // For demo accounts, always show the dialog
        const isDemoAccount = user.username.includes('demovideo');
        if (isDemoAccount) {
          console.log("Demo account with incomplete profile - showing setup dialog");
          setShowProfileSetup(true);
          return;
        }
        
        // For regular users, only check skip time
        const lastSkippedTime = localStorage.getItem('profileSetupSkippedAt');
        
        if (lastSkippedTime) {
          // If it was skipped less than 24 hours ago, don't show again
          const skippedTimestamp = parseInt(lastSkippedTime, 10);
          const currentTime = Date.now();
          const hoursSinceSkipped = (currentTime - skippedTimestamp) / (1000 * 60 * 60);
          
          if (hoursSinceSkipped < 24) {
            console.log("Dialog was skipped less than 24 hours ago - not showing");
            return;
          }
        }
        
        // Show the profile setup dialog
        console.log("Showing profile setup dialog");
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
