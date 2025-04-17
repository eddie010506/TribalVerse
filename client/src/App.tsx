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
import { ProtectedRoute } from "./lib/protected-route";
import { AuthProvider } from "@/hooks/use-auth";
import { RoomInvitationsProvider } from "@/hooks/use-room-invitations";
import { useAIProfileSetup } from "@/hooks/use-ai-profile-setup";
import { useEffect } from "react";

// ProfileCheckRouter component to check if profile is complete and redirect if needed
function ProfileCheckRouter() {
  const { isProfileComplete, isLoading } = useAIProfileSetup();
  const [location] = useLocation();
  
  // Note: We've removed the AI chat page redirection since that page no longer exists
  // AI recommendations are now integrated into relevant pages

  return (
    <Switch>
      <ProtectedRoute path="/" component={PostsPage} />
      <Route path="/posts">
        <Redirect to="/" />
      </Route>
      <ProtectedRoute path="/chat" component={HomePage} />
      <ProtectedRoute path="/rooms/:id" component={ChatRoom} />
      <ProtectedRoute path="/create-room" component={CreateRoom} />
      <ProtectedRoute path="/profile" component={ProfilePage} />
      <ProtectedRoute path="/users/:id" component={UserProfilePage} />
      <ProtectedRoute path="/create-post" component={CreatePostPage} />
      <Route path="/auth" component={AuthPage} />
      <Route component={NotFound} />
    </Switch>
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
