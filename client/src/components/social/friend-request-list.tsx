import { FriendRequest, User } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, UserCheck, UserX } from "lucide-react";
import { Link } from "wouter";

// Extended FriendRequest type that includes sender info
type FriendRequestWithUser = FriendRequest & {
  sender?: Pick<User, 'id' | 'username' | 'profilePicture'>;
};

interface FriendRequestListProps {
  requests: FriendRequestWithUser[];
  isLoading: boolean;
  onAccept: (requestId: number) => void;
  onReject: (requestId: number) => void;
}

export function FriendRequestList({
  requests,
  isLoading,
  onAccept,
  onReject,
}: FriendRequestListProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center my-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <Card className="p-6 text-center text-muted-foreground">
        No friend requests at the moment.
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {requests.map((request) => (
        <Card key={request.id} className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage
                  src={request.sender?.profilePicture || undefined}
                  alt={request.sender?.username || "User"}
                />
                <AvatarFallback>
                  {request.sender?.username?.substring(0, 2).toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <div>
                <Link href={`/user/${request.senderId}`}>
                  <span className="font-medium hover:underline cursor-pointer">
                    {request.sender?.username || "User"}
                  </span>
                </Link>
                <p className="text-sm text-muted-foreground">
                  Sent you a friend request
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-1"
                onClick={() => onAccept(request.id)}
              >
                <UserCheck className="h-4 w-4" />
                Accept
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-1 text-destructive"
                onClick={() => onReject(request.id)}
              >
                <UserX className="h-4 w-4" />
                Reject
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}