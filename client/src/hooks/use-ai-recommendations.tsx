import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';

export interface SimilarUser {
  id: number;
  username: string;
  matchReason: string;
}

export interface MeetupPlace {
  name: string;
  type: string;
  reason: string;
}

export function useAIRecommendations() {
  const { toast } = useToast();
  const [similarUsers, setSimilarUsers] = useState<SimilarUser[]>([]);
  const [meetupPlaces, setMeetupPlaces] = useState<MeetupPlace[]>([]);

  // Get similar users based on your profile
  const getSimilarUsersMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('GET', '/api/ai/similar-users');
      if (!response.ok) {
        // Handle rate limit errors specially
        if (response.status === 429) {
          throw new Error("Rate limit exceeded. Please try again in a minute.");
        }
        throw new Error(`Error: ${response.statusText}`);
      }
      return await response.json();
    },
    onSuccess: (data) => {
      setSimilarUsers(data);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to get similar users: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  // Get meetup place recommendations for a chat room
  const getMeetupRecommendationsMutation = useMutation({
    mutationFn: async (roomId: number) => {
      const response = await apiRequest('GET', `/api/ai/meetup-recommendations/${roomId}`);
      if (!response.ok) {
        // Handle rate limit errors specially
        if (response.status === 429) {
          throw new Error("Rate limit exceeded. Please try again in a minute.");
        }
        throw new Error(`Error: ${response.statusText}`);
      }
      return await response.json();
    },
    onSuccess: (data) => {
      setMeetupPlaces(data);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to get meetup recommendations: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  return {
    similarUsers,
    meetupPlaces,
    getSimilarUsers: () => getSimilarUsersMutation.mutate(),
    getMeetupRecommendations: (roomId: number) => getMeetupRecommendationsMutation.mutate(roomId),
    isLoadingSimilarUsers: getSimilarUsersMutation.isPending,
    isLoadingMeetupPlaces: getMeetupRecommendationsMutation.isPending,
    hasActiveSimilarUsers: similarUsers.length > 0,
    hasActiveMeetupPlaces: meetupPlaces.length > 0,
    clearSimilarUsers: () => setSimilarUsers([]),
    clearMeetupPlaces: () => setMeetupPlaces([]),
  };
}