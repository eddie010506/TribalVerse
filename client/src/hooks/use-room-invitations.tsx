import { createContext, ReactNode, useContext } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";
import { useToast } from "./use-toast";

// Define the types for room invitations
interface RoomInfo {
  id: number;
  name: string;
  description: string | null;
}

interface UserInfo {
  id: number;
  username: string;
  profilePicture: string | null;
}

export interface RoomInvitation {
  id: number;
  roomId: number;
  senderId: number;
  receiverId: number;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
  updatedAt: string;
  // Enhanced properties (from API)
  room?: RoomInfo;
  sender?: UserInfo;
  receiver?: UserInfo;
}

interface RoomInvitationsContextType {
  receivedInvitations: RoomInvitation[];
  sentInvitations: RoomInvitation[];
  isLoadingReceived: boolean;
  isLoadingSent: boolean;
  createInvitationMutation: any;
  respondToInvitationMutation: any;
  error: Error | null;
}

const RoomInvitationsContext = createContext<RoomInvitationsContextType | null>(null);

export function RoomInvitationsProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get received invitations
  const {
    data: receivedInvitations = [],
    error: receivedError,
    isLoading: isLoadingReceived,
  } = useQuery<RoomInvitation[], Error>({
    queryKey: ['/api/room-invitations/received'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/room-invitations/received');
      if (!res.ok) {
        throw new Error('Failed to fetch received invitations');
      }
      return await res.json();
    },
  });

  // Get sent invitations
  const {
    data: sentInvitations = [],
    error: sentError,
    isLoading: isLoadingSent,
  } = useQuery<RoomInvitation[], Error>({
    queryKey: ['/api/room-invitations/sent'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/room-invitations/sent');
      if (!res.ok) {
        throw new Error('Failed to fetch sent invitations');
      }
      return await res.json();
    },
  });

  // Create a new invitation
  const createInvitationMutation = useMutation({
    mutationFn: async ({ roomId, userId }: { roomId: number; userId: number }) => {
      const res = await apiRequest('POST', '/api/room-invitations', {
        roomId, 
        userId
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to create invitation');
      }
      return await res.json();
    },
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/room-invitations/sent'] });
      toast({
        title: 'Invitation sent',
        description: 'The user has been invited to join the room.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to send invitation',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Respond to an invitation (accept or decline)
  const respondToInvitationMutation = useMutation({
    mutationFn: async ({ 
      invitationId, 
      status 
    }: { 
      invitationId: number; 
      status: 'accepted' | 'declined' 
    }) => {
      const res = await apiRequest('PATCH', `/api/room-invitations/${invitationId}`, {
        status
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || `Failed to ${status} invitation`);
      }
      return await res.json();
    },
    onSuccess: (data, variables) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/room-invitations/received'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rooms'] });
      
      toast({
        title: variables.status === 'accepted' ? 'Invitation accepted' : 'Invitation declined',
        description: variables.status === 'accepted' 
          ? 'You have joined the room.'
          : 'You have declined the invitation.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to respond to invitation',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Combine errors
  const error = receivedError || sentError;

  return (
    <RoomInvitationsContext.Provider
      value={{
        receivedInvitations,
        sentInvitations,
        isLoadingReceived,
        isLoadingSent,
        createInvitationMutation,
        respondToInvitationMutation,
        error,
      }}
    >
      {children}
    </RoomInvitationsContext.Provider>
  );
}

export function useRoomInvitations() {
  const context = useContext(RoomInvitationsContext);
  if (!context) {
    throw new Error('useRoomInvitations must be used within a RoomInvitationsProvider');
  }
  return context;
}