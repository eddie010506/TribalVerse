import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useState, useRef } from 'react';

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
  // Track if we already tried to get users with no results (to avoid infinite API calls)
  const noRecommendationsRef = useRef<boolean>(false);
  const lastEmptyResultTime = useRef<number>(0);
  
  // Time threshold before retrying empty results (12 hours in milliseconds)
  const RETRY_THRESHOLD = 12 * 60 * 60 * 1000; 

  // Get similar users based on your profile
  const getSimilarUsersMutation = useMutation({
    mutationFn: async () => {
      // Prevent repeated calls when we already know there are no recommendations
      const now = Date.now();
      if (noRecommendationsRef.current && 
          (now - lastEmptyResultTime.current < RETRY_THRESHOLD)) {
        return { users: [] };
      }
      
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
      if (data.users && Array.isArray(data.users)) {
        setSimilarUsers(data.users);
        
        // If no results, mark that we've tried and got empty results
        if (data.users.length === 0) {
          noRecommendationsRef.current = true;
          lastEmptyResultTime.current = Date.now();
        } else {
          // Reset if we get results
          noRecommendationsRef.current = false;
        }
      } else {
        setSimilarUsers([]);
        // Mark that we've tried and got empty results
        noRecommendationsRef.current = true;
        lastEmptyResultTime.current = Date.now();
      }
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
      if (data.places && Array.isArray(data.places)) {
        setMeetupPlaces(data.places);
      } else {
        setMeetupPlaces([]);
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to get meetup recommendations: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  // Manual refresh function that resets the no-recommendations flag
  const refreshSimilarUsers = () => {
    noRecommendationsRef.current = false;
    getSimilarUsersMutation.mutate();
  };

  return {
    similarUsers,
    meetupPlaces,
    getSimilarUsers: () => getSimilarUsersMutation.mutate(),
    refreshSimilarUsers,
    getMeetupRecommendations: (roomId: number) => getMeetupRecommendationsMutation.mutate(roomId),
    isLoadingSimilarUsers: getSimilarUsersMutation.isPending,
    isLoadingMeetupPlaces: getMeetupRecommendationsMutation.isPending,
    hasActiveSimilarUsers: similarUsers.length > 0,
    hasActiveMeetupPlaces: meetupPlaces.length > 0,
    noRecommendationsAvailable: noRecommendationsRef.current,
    clearSimilarUsers: () => setSimilarUsers([]),
    clearMeetupPlaces: () => setMeetupPlaces([]),
  };
}