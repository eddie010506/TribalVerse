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
  description: string;
  reasonToVisit: string;
  rating?: string;
  priceRange?: string;
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

  // Track if a request is in progress to prevent duplicate calls
  const requestInProgressRef = useRef<boolean>(false);
  
  // Get similar users based on your profile
  const getSimilarUsersMutation = useMutation({
    mutationFn: async () => {
      // Prevent repeated calls when we already know there are no recommendations or a request is in progress
      if (requestInProgressRef.current) {
        return { users: [] };
      }
      
      const now = Date.now();
      if (noRecommendationsRef.current && 
          (now - lastEmptyResultTime.current < RETRY_THRESHOLD)) {
        return { users: [] };
      }
      
      // Mark that a request is in progress
      requestInProgressRef.current = true;
      
      try {
        const response = await apiRequest('GET', '/api/ai/similar-users');
        if (!response.ok) {
          // Handle rate limit errors specially
          if (response.status === 429) {
            throw new Error("Rate limit exceeded. Please try again in a minute.");
          }
          throw new Error(`Error: ${response.statusText}`);
        }
        return await response.json();
      } finally {
        // Clear the in-progress flag when done, regardless of success/failure
        // Add a small delay to prevent immediate retries
        setTimeout(() => {
          requestInProgressRef.current = false;
        }, 500);
      }
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
      // Mark that we've tried and failed
      noRecommendationsRef.current = true;
      lastEmptyResultTime.current = Date.now();
      
      toast({
        title: 'Error',
        description: `Failed to get similar users: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  // Track if a meetup request is in progress
  const meetupRequestInProgressRef = useRef<boolean>(false);
  // Track rooms with no recommendations
  const noMeetupRecsForRoomRef = useRef<Record<number, number>>({});

  // Get meetup place recommendations for a chat room
  const getMeetupRecommendationsMutation = useMutation({
    mutationFn: async (roomId: number) => {
      // Prevent repeated calls when a request is in progress
      if (meetupRequestInProgressRef.current) {
        return { places: [] };
      }
      
      // Check if this room already tried and got empty results within threshold
      const now = Date.now();
      const lastEmptyTime = noMeetupRecsForRoomRef.current[roomId] || 0;
      if (lastEmptyTime && (now - lastEmptyTime < RETRY_THRESHOLD)) {
        return { places: [] };
      }
      
      // Mark that a request is in progress
      meetupRequestInProgressRef.current = true;
      
      try {
        const response = await apiRequest('GET', `/api/ai/meetup-recommendations/${roomId}`);
        if (!response.ok) {
          // Handle rate limit errors specially
          if (response.status === 429) {
            throw new Error("Rate limit exceeded. Please try again in a minute.");
          }
          throw new Error(`Error: ${response.statusText}`);
        }
        return await response.json();
      } finally {
        // Clear the in-progress flag with a small delay to prevent immediate retries
        setTimeout(() => {
          meetupRequestInProgressRef.current = false;
        }, 500);
      }
    },
    onSuccess: (data, roomId) => {
      if (data.places && Array.isArray(data.places)) {
        setMeetupPlaces(data.places);
        
        // If no results, mark that we've tried this room and got empty results
        if (data.places.length === 0) {
          noMeetupRecsForRoomRef.current[roomId] = Date.now();
        } else {
          // Reset if we get results
          delete noMeetupRecsForRoomRef.current[roomId];
        }
      } else {
        setMeetupPlaces([]);
        // Mark that we've tried and got empty results
        noMeetupRecsForRoomRef.current[roomId] = Date.now();
      }
    },
    onError: (error: Error, roomId) => {
      // Mark that we've tried and failed
      noMeetupRecsForRoomRef.current[roomId] = Date.now();
      
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
  
  // Manual refresh function for meetup places
  const refreshMeetupPlaces = (roomId: number) => {
    // Clear the cached "empty" state for this room
    delete noMeetupRecsForRoomRef.current[roomId];
    getMeetupRecommendationsMutation.mutate(roomId);
  };

  return {
    similarUsers,
    meetupPlaces,
    getSimilarUsers: () => getSimilarUsersMutation.mutate(),
    refreshSimilarUsers,
    getMeetupRecommendations: (roomId: number) => getMeetupRecommendationsMutation.mutate(roomId),
    refreshMeetupPlaces,
    isLoadingSimilarUsers: getSimilarUsersMutation.isPending,
    isLoadingMeetupPlaces: getMeetupRecommendationsMutation.isPending,
    hasActiveSimilarUsers: similarUsers.length > 0,
    hasActiveMeetupPlaces: meetupPlaces.length > 0,
    noRecommendationsAvailable: noRecommendationsRef.current,
    clearSimilarUsers: () => setSimilarUsers([]),
    clearMeetupPlaces: () => setMeetupPlaces([]),
  };
}