import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { User } from "@shared/schema";

export function useFollows(userId?: number) {
  const { toast } = useToast();

  // Get followers
  const {
    data: followers = [],
    isLoading: followersLoading,
    error: followersError,
  } = useQuery<Partial<User>[], Error>({
    queryKey: ["/api/follows/followers", userId],
    enabled: !!userId,
    staleTime: 30000,
  });

  // Get following
  const {
    data: following = [],
    isLoading: followingLoading,
    error: followingError,
  } = useQuery<Partial<User>[], Error>({
    queryKey: ["/api/follows/following", userId],
    enabled: !!userId,
    staleTime: 30000,
  });

  // Check if currently logged in user is following this user
  const {
    data: isFollowing,
    isLoading: isFollowingLoading,
  } = useQuery<boolean, Error>({
    queryKey: ["/api/follows/is-following", userId],
    enabled: !!userId,
    staleTime: 30000,
  });

  // Follow a user
  const followMutation = useMutation({
    mutationFn: async (targetUserId: number) => {
      const res = await apiRequest("POST", `/api/follows`, { followingId: targetUserId });
      return await res.json();
    },
    onSuccess: () => {
      // Invalidate relevant queries
      if (userId) {
        queryClient.invalidateQueries({ queryKey: ["/api/follows/followers", userId] });
        queryClient.invalidateQueries({ queryKey: ["/api/follows/is-following", userId] });
      }
      // Also invalidate current user's following list
      queryClient.invalidateQueries({ queryKey: ["/api/follows/following"] });
      
      toast({
        title: "Success",
        description: "You are now following this user",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to follow user: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Unfollow a user
  const unfollowMutation = useMutation({
    mutationFn: async (targetUserId: number) => {
      const res = await apiRequest("DELETE", `/api/follows/${targetUserId}`);
      return res.ok;
    },
    onSuccess: () => {
      // Invalidate relevant queries
      if (userId) {
        queryClient.invalidateQueries({ queryKey: ["/api/follows/followers", userId] });
        queryClient.invalidateQueries({ queryKey: ["/api/follows/is-following", userId] });
      }
      // Also invalidate current user's following list
      queryClient.invalidateQueries({ queryKey: ["/api/follows/following"] });
      
      toast({
        title: "Success",
        description: "You have unfollowed this user",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to unfollow user: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  return {
    followers,
    following,
    isFollowing: isFollowing || false,
    isLoading: followersLoading || followingLoading || isFollowingLoading,
    error: followersError || followingError,
    follow: followMutation.mutate,
    unfollow: unfollowMutation.mutate,
  };
}