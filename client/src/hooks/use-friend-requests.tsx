import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { FriendRequest } from "@shared/schema";

export function useFriendRequests() {
  const { toast } = useToast();
  
  // Get received friend requests
  const {
    data: receivedRequests = [],
    isLoading: receivedLoading,
    error: receivedError,
  } = useQuery<FriendRequest[], Error>({
    queryKey: ["/api/friend-requests/received"],
    staleTime: 30000,
  });

  // Get sent friend requests
  const {
    data: sentRequests = [],
    isLoading: sentLoading,
    error: sentError,
  } = useQuery<FriendRequest[], Error>({
    queryKey: ["/api/friend-requests/sent"],
    staleTime: 30000,
  });

  // Send a friend request
  const sendRequestMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await apiRequest("POST", "/api/friend-requests", { receiverId: userId });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/friend-requests/sent"] });
      toast({
        title: "Friend request sent",
        description: "Your friend request has been sent successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to send friend request: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Accept a friend request
  const acceptRequestMutation = useMutation({
    mutationFn: async (requestId: number) => {
      const res = await apiRequest("PATCH", `/api/friend-requests/${requestId}`, { status: "accepted" });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/friend-requests/received"] });
      toast({
        title: "Friend request accepted",
        description: "You are now friends!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to accept friend request: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Reject a friend request
  const rejectRequestMutation = useMutation({
    mutationFn: async (requestId: number) => {
      const res = await apiRequest("PATCH", `/api/friend-requests/${requestId}`, { status: "rejected" });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/friend-requests/received"] });
      toast({
        title: "Friend request rejected",
        description: "The friend request has been rejected",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to reject friend request: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  return {
    receivedRequests,
    sentRequests,
    isLoading: receivedLoading || sentLoading,
    error: receivedError || sentError,
    sendRequest: sendRequestMutation.mutate,
    acceptRequest: acceptRequestMutation.mutate,
    rejectRequest: rejectRequestMutation.mutate,
  };
}