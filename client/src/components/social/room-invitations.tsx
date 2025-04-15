import { useRoomInvitations } from "@/hooks/use-room-invitations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, X, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export function RoomInvitations() {
  const { 
    receivedInvitations, 
    isLoadingReceived,
    respondToInvitationMutation,
  } = useRoomInvitations();

  // Handle accepting an invitation
  const handleAccept = (invitationId: number) => {
    respondToInvitationMutation.mutate({ 
      invitationId, 
      status: 'accepted' 
    });
  };

  // Handle declining an invitation
  const handleDecline = (invitationId: number) => {
    respondToInvitationMutation.mutate({ 
      invitationId, 
      status: 'declined' 
    });
  };

  // Get initials for avatar fallback
  const getInitials = (name: string) => {
    return name.charAt(0).toUpperCase();
  };

  // Format date from string
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, 'MMM dd, yyyy');
    } catch (error) {
      return 'Unknown date';
    }
  };

  if (isLoadingReceived) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (receivedInvitations.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        <p>No pending room invitations</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {receivedInvitations
        .filter(invitation => invitation.status === 'pending')
        .map((invitation) => (
          <Card key={invitation.id} className="overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-medium">
                  {invitation.room?.name || 'Unknown Room'}
                </CardTitle>
                <Badge variant="outline">Invitation</Badge>
              </div>
            </CardHeader>
            <CardContent className="pb-4 pt-0">
              <p className="text-sm text-muted-foreground mb-2">
                {invitation.room?.description || 'No description'}
              </p>
              
              <div className="flex items-center gap-2 mb-4">
                <Avatar className="h-6 w-6">
                  <AvatarImage 
                    src={invitation.inviter?.profilePicture || undefined} 
                    alt={invitation.inviter?.username || 'User'} 
                  />
                  <AvatarFallback>
                    {getInitials(invitation.inviter?.username || 'U')}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm">
                  <span className="font-medium">{invitation.inviter?.username}</span>
                  {' '}invited you on {formatDate(invitation.createdAt)}
                </span>
              </div>
              
              <div className="flex justify-end gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleDecline(invitation.id)}
                  disabled={respondToInvitationMutation.isPending}
                >
                  <X className="mr-1 h-4 w-4" />
                  Decline
                </Button>
                <Button 
                  size="sm"
                  onClick={() => handleAccept(invitation.id)}
                  disabled={respondToInvitationMutation.isPending}
                >
                  <Check className="mr-1 h-4 w-4" />
                  Accept
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
    </div>
  );
}

export function AcceptedRooms() {
  const { receivedInvitations, isLoadingReceived } = useRoomInvitations();
  
  const acceptedInvitations = receivedInvitations.filter(
    invitation => invitation.status === 'accepted'
  );
  
  if (isLoadingReceived) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }
  
  if (acceptedInvitations.length === 0) {
    return null;
  }
  
  return (
    <div className="mt-6">
      <h3 className="text-sm font-medium text-muted-foreground mb-3">Recently Joined Rooms</h3>
      <div className="space-y-2">
        {acceptedInvitations.slice(0, 3).map((invitation) => (
          <Card key={invitation.id} className="overflow-hidden">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-medium">{invitation.room?.name}</h4>
                </div>
                <Link href={`/rooms/${invitation.roomId}`}>
                  <Button variant="secondary" size="sm">
                    Join
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}