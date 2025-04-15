import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { insertChatRoomSchema, InsertChatRoom, ChatRoom } from '@shared/schema';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardContent, 
  CardFooter 
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, UserPlus, MessageSquareText, CheckCircle2 } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Link } from 'wouter';
import { UserSearch, User as UserSearchResult } from '@/components/social/user-search';

// Room creation schema with validation
const createRoomSchema = insertChatRoomSchema.pick({
  name: true,
  description: true,
}).extend({
  name: z.string().min(3, 'Room name must be at least 3 characters').max(50, 'Room name must be less than 50 characters'),
  description: z.string().max(200, 'Description must be less than 200 characters').optional(),
});

export default function CreateRoom() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [selectedUsers, setSelectedUsers] = useState<UserSearchResult[]>([]);
  const [isSelfChatMode, setIsSelfChatMode] = useState(false);
  
  // Form setup
  const form = useForm<z.infer<typeof createRoomSchema>>({
    resolver: zodResolver(createRoomSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });
  
  // Create room mutation
  const createRoomMutation = useMutation({
    mutationFn: async (data: z.infer<typeof createRoomSchema>) => {
      const roomData = {
        ...data,
        creatorId: user!.id,
        invitees: selectedUsers.map(user => user.id)
      };
      
      const res = await apiRequest('POST', '/api/rooms', roomData);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to create room');
      }
      return res.json() as Promise<ChatRoom>;
    },
    onSuccess: (newRoom) => {
      queryClient.invalidateQueries({ queryKey: ['/api/rooms'] });
      toast({
        title: 'Room created',
        description: selectedUsers.length > 0 
          ? `"${newRoom.name}" has been created and invitations sent.`
          : `"${newRoom.name}" has been created successfully.`,
      });
      navigate(`/rooms/${newRoom.id}`);
    },
    onError: (error) => {
      toast({
        title: 'Failed to create room',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive',
      });
    },
  });
  
  // Handle adding a user to invite
  const handleSelectUser = (user: UserSearchResult) => {
    if (!selectedUsers.some(selected => selected.id === user.id)) {
      setSelectedUsers(prev => [...prev, user]);
    }
  };
  
  // Handle removing a user from the invite list
  const handleRemoveUser = (userId: number) => {
    setSelectedUsers(prev => prev.filter(user => user.id !== userId));
  };
  
  // Set up default values for self-chat mode
  const setupSelfChatMode = () => {
    if (!isSelfChatMode) {
      // Switching to self-chat mode
      setIsSelfChatMode(true);
      // Set a default name if empty
      if (!form.getValues('name')) {
        form.setValue('name', 'My Personal Notes');
      }
      // Set a default description if empty
      if (!form.getValues('description')) {
        form.setValue('description', 'A private space for my thoughts and notes');
      }
      // Clear any selected users
      setSelectedUsers([]);
    } else {
      // Switching back to regular mode
      setIsSelfChatMode(false);
    }
  };

  // Form submission handler
  const onSubmit = (values: z.infer<typeof createRoomSchema>) => {
    // In self-chat mode, we don't require inviting users
    if (!isSelfChatMode && selectedUsers.length === 0) {
      form.setError("root", { 
        type: "manual", 
        message: "You must invite at least one user" 
      });
      return;
    }
    
    // For self-chat mode, create a room without invitees
    createRoomMutation.mutate(values);
  };
  
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Link href="/">
            <Button variant="ghost" className="mb-6">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to rooms
            </Button>
          </Link>
          
          <Card className="border shadow-sm">
            <CardHeader>
              <CardTitle className="text-2xl font-bold">Create a new room</CardTitle>
              <CardDescription>
                Create a new chat room for you and others to message in
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  {form.formState.errors.root && (
                    <div className="bg-destructive/10 p-3 rounded-md text-destructive text-sm font-medium">
                      {form.formState.errors.root.message}
                    </div>
                  )}
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Room Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter room name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description (optional)</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Enter room description" 
                            className="resize-none" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <Separator className="my-4" />
                  
                  <div className="space-y-3">
                    <div className="flex items-center">
                      <UserPlus className="h-5 w-5 mr-2 text-muted-foreground" />
                      <h3 className="text-lg font-medium">Invite users</h3>
                    </div>
                    <FormDescription>
                      Search for users to invite to your new chat room (required)
                    </FormDescription>
                    
                    <UserSearch 
                      onSelectUser={handleSelectUser}
                      selectedUsers={selectedUsers}
                      onRemoveUser={handleRemoveUser}
                      placeholder="Search for users to invite..."
                    />
                    {selectedUsers.length === 0 && form.formState.isSubmitted && (
                      <p className="text-sm font-medium text-destructive">
                        You must invite at least one user
                      </p>
                    )}
                  </div>
                  
                  <div className="flex justify-end space-x-2 pt-4">
                    <Link href="/">
                      <Button variant="outline" type="button">
                        Cancel
                      </Button>
                    </Link>
                    
                    <Button 
                      type="submit" 
                      disabled={createRoomMutation.isPending}
                    >
                      {createRoomMutation.isPending ? (
                        <>
                          <span>Creating</span>
                          <span className="ml-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        </>
                      ) : (
                        "Create Room"
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
