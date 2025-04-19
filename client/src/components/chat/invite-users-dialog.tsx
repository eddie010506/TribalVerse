import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { UserSearch, User } from '../social/user-search';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Loader2, UserPlus } from 'lucide-react';

interface InviteUsersDialogProps {
  roomId: number;
  roomName: string;
}

export function InviteUsersDialog({ roomId, roomName }: InviteUsersDialogProps) {
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const inviteMutation = useMutation({
    mutationFn: async (selectedUserId: number) => {
      const res = await apiRequest(
        'POST',
        '/api/room-invitations',
        { roomId, userId: selectedUserId }
      );
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to send invitation');
      }
      
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/room-invitations/sent'] });
      toast({
        title: 'Invitations sent',
        description: 'All invitations have been sent successfully.',
        variant: 'default',
      });
      setSelectedUsers([]);
      setOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to send invitations',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSelectUser = (user: User) => {
    setSelectedUsers((prevUsers) => [...prevUsers, user]);
  };

  const handleRemoveUser = (userId: number) => {
    setSelectedUsers((prevUsers) => prevUsers.filter((user) => user.id !== userId));
  };

  const handleSendInvitations = async () => {
    if (selectedUsers.length === 0) {
      toast({
        title: 'No users selected',
        description: 'Please select at least one user to invite.',
        variant: 'destructive',
      });
      return;
    }

    // Send invitations one by one
    for (const user of selectedUsers) {
      await inviteMutation.mutateAsync(user.id);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="ml-2">
          <UserPlus className="h-4 w-4 mr-1" />
          Invite
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Invite Users to {roomName}</DialogTitle>
          <DialogDescription>
            Search for users by username or ID to invite them to this chat room.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <UserSearch
            onSelectUser={handleSelectUser}
            selectedUsers={selectedUsers}
            onRemoveUser={handleRemoveUser}
            placeholder="Search for users to invite..."
          />
        </div>
        
        <DialogFooter>
          <Button
            onClick={() => setOpen(false)}
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSendInvitations}
            disabled={selectedUsers.length === 0 || inviteMutation.isPending}
          >
            {inviteMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              'Send Invitations'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}