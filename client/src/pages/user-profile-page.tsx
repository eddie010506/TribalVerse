import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, UserPlus, UserMinus, ArrowLeft } from "lucide-react";

interface UserProfile {
  id: number;
  username: string;
  profilePicture: string | null;
  hobbies: string | null;
  interests: string | null;
  currentActivities: string | null;
  isFollowing: boolean;
}

export default function UserProfilePage() {
  const { id } = useParams<{ id: string }>();
  const userId = parseInt(id);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Fetch user profile
  const { 
    data: profile, 
    isLoading, 
    error 
  } = useQuery<UserProfile>({
    queryKey: [`/api/users/${userId}`],
    enabled: !isNaN(userId),
  });

  // Follow user mutation
  const followMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/users/${userId}/follow`);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Followed user",
        description: `You are now following ${profile?.username}`,
      });
      queryClient.invalidateQueries({ queryKey: [`/api/users/${userId}`] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to follow user",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Unfollow user mutation
  const unfollowMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", `/api/users/${userId}/follow`);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Unfollowed user",
        description: `You are no longer following ${profile?.username}`,
      });
      queryClient.invalidateQueries({ queryKey: [`/api/users/${userId}`] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to unfollow user",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Loading state
  if (isLoading || isNaN(userId)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Error state
  if (error || !profile) {
    return (
      <div className="container mx-auto py-10 px-4 md:px-6">
        <div className="max-w-3xl mx-auto">
          <Button 
            variant="ghost" 
            className="mb-4" 
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
          <Card>
            <CardHeader>
              <CardTitle>User Not Found</CardTitle>
              <CardDescription>
                The user profile you are looking for doesn't exist or you don't have permission to view it.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate("/")}>Return to Home</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Prevent viewing own profile with this component
  if (user?.id === profile.id) {
    navigate("/profile");
    return null;
  }

  const handleFollowToggle = () => {
    if (profile.isFollowing) {
      unfollowMutation.mutate();
    } else {
      followMutation.mutate();
    }
  };

  return (
    <div className="container mx-auto py-10 px-4 md:px-6">
      <div className="max-w-3xl mx-auto">
        <Button 
          variant="ghost" 
          className="mb-4" 
          onClick={() => navigate("/")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go Back
        </Button>
        
        <Card className="mb-8">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  {profile.profilePicture ? (
                    <AvatarImage src={profile.profilePicture} alt={profile.username} />
                  ) : (
                    <AvatarFallback className="text-lg">
                      {profile.username.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div>
                  <CardTitle className="text-2xl">@{profile.username}</CardTitle>
                  {profile.isFollowing && (
                    <Badge className="mt-1">Following</Badge>
                  )}
                </div>
              </div>
              
              <Button
                onClick={handleFollowToggle}
                variant={profile.isFollowing ? "outline" : "default"}
                disabled={followMutation.isPending || unfollowMutation.isPending}
              >
                {(followMutation.isPending || unfollowMutation.isPending) ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : profile.isFollowing ? (
                  <UserMinus className="h-4 w-4 mr-2" />
                ) : (
                  <UserPlus className="h-4 w-4 mr-2" />
                )}
                {profile.isFollowing ? "Unfollow" : "Follow"}
              </Button>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {(profile.hobbies || profile.interests || profile.currentActivities) ? (
              <>
                {profile.hobbies && (
                  <div>
                    <h3 className="text-xl font-semibold mb-2">Hobbies</h3>
                    <p className="text-gray-700 whitespace-pre-wrap">{profile.hobbies}</p>
                  </div>
                )}
                
                {profile.hobbies && profile.interests && <Separator />}
                
                {profile.interests && (
                  <div>
                    <h3 className="text-xl font-semibold mb-2">Interests</h3>
                    <p className="text-gray-700 whitespace-pre-wrap">{profile.interests}</p>
                  </div>
                )}
                
                {profile.interests && profile.currentActivities && <Separator />}
                
                {profile.currentActivities && (
                  <div>
                    <h3 className="text-xl font-semibold mb-2">Current Activities</h3>
                    <p className="text-gray-700 whitespace-pre-wrap">{profile.currentActivities}</p>
                  </div>
                )}
              </>
            ) : (
              <div className="py-8 text-center text-gray-500">
                This user hasn't added any profile information yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}