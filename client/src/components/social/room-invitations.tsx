import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useRoomInvitations } from '@/hooks/use-room-invitations';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CheckCircle, XCircle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

export function RoomInvitations() {
  const { receivedInvitations, respondToInvitationMutation } = useRoomInvitations();
  const { toast } = useToast();
  const [respondingToId, setRespondingToId] = useState<number | null>(null);

  // Only show pending invitations
  const pendingInvitations = receivedInvitations.filter(
    invitation => invitation.status === 'pending'
  );

  const handleAccept = async (invitationId: number) => {
    setRespondingToId(invitationId);
    try {
      await respondToInvitationMutation.mutateAsync({
        invitationId,
        status: 'accepted'
      });
      toast({
        title: 'Invitation accepted',
        description: 'You have joined the chat room!',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to accept invitation',
        variant: 'destructive',
      });
    } finally {
      setRespondingToId(null);
    }
  };

  const handleDecline = async (invitationId: number) => {
    setRespondingToId(invitationId);
    try {
      await respondToInvitationMutation.mutateAsync({
        invitationId,
        status: 'declined'
      });
      toast({
        title: 'Invitation declined',
        description: 'The invitation has been declined',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to decline invitation',
        variant: 'destructive',
      });
    } finally {
      setRespondingToId(null);
    }
  };

  if (pendingInvitations.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-2">
        No pending invitations
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {pendingInvitations.map(invitation => (
        <div key={invitation.id} className="border rounded-md p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarFallback>
                {invitation.inviter?.username?.charAt(0) || '?'}
              </AvatarFallback>
              <AvatarImage 
                src={invitation.inviter?.profilePicture || undefined} 
                alt={invitation.inviter?.username || ''} 
              />
            </Avatar>
            <span className="text-sm font-medium">
              {invitation.inviter?.username || 'Someone'} invited you to join
            </span>
          </div>
          
          <div className="font-medium">
            {invitation.room?.name || 'A chat room'}
          </div>
          
          {invitation.room?.description && (
            <p className="text-xs text-muted-foreground">
              {invitation.room.description}
            </p>
          )}
          
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => handleDecline(invitation.id)}
              disabled={respondingToId === invitation.id}
            >
              <XCircle className="mr-1 h-4 w-4" />
              Decline
            </Button>
            <Button
              variant="default"
              size="sm"
              className="h-8"
              onClick={() => handleAccept(invitation.id)}
              disabled={respondingToId === invitation.id}
            >
              <CheckCircle className="mr-1 h-4 w-4" />
              Accept
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function AcceptedRooms() {
  const { receivedInvitations } = useRoomInvitations();
  
  // Only show accepted invitations
  const acceptedInvitations = receivedInvitations.filter(
    invitation => invitation.status === 'accepted'
  );
  
  if (acceptedInvitations.length === 0) {
    return null;
  }
  
  return (
    <div className="mt-4 pt-4 border-t">
      <h4 className="text-sm font-medium mb-2">Recently Joined</h4>
      <div className="space-y-2">
        {acceptedInvitations.map(invitation => (
          <Link key={invitation.id} href={`/room/${invitation.roomId}`}>
            <div className="flex items-center gap-2 p-2 rounded-md hover:bg-accent cursor-pointer">
              <div className="font-medium text-sm">
                {invitation.room?.name || 'Chat room'}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}