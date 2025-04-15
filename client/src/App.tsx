import { Switch, Route, Redirect } from "wouter";
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
import AIChatPage from "@/pages/ai-chat-page";
import { ProtectedRoute } from "./lib/protected-route";
import { AuthProvider } from "@/hooks/use-auth";
import { RoomInvitationsProvider } from "@/hooks/use-room-invitations";

function Router() {
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
      <ProtectedRoute path="/ai-chat" component={AIChatPage} />
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
          <Router />
          <Toaster />
        </RoomInvitationsProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
