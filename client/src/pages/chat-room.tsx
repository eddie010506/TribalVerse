import { useEffect, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useRoute, useLocation } from 'wouter';
import { ChatRoom, MessageWithUser } from '@shared/schema';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { MessageList } from '@/components/chat/message-list';
import { ChatInput } from '@/components/chat/chat-input';
import { InviteUsersDialog } from '@/components/chat/invite-users-dialog';
import { useWebSocket } from '@/hooks/use-websocket';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { apiRequest, queryClient } from '@/lib/queryClient';
import { ArrowLeft, Users, Info, Trash2, MapPin, UserPlus, Utensils } from 'lucide-react';
import { Link } from 'wouter';
import { RestaurantRecommendationsDialog } from '@/components/ai/restaurant-recommendations-dialog';
import { SimilarUsersCard } from '@/components/ai/similar-users-card';

export default function ChatRoomPage() {
  // Get room id from URL
  const [match, params] = useRoute('/rooms/:id');
  const roomId = params?.id ? parseInt(params.id) : undefined;
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  // Fetch room data
  const {
    data: room,
    isLoading: isRoomLoading,
    error: roomError,
  } = useQuery<ChatRoom>({
    queryKey: [`/api/rooms/${roomId}`],
    enabled: !!roomId,
  });
  
  // Fetch messages
  const {
    data: initialMessages,
    isLoading: isMessagesLoading,
    error: messagesError,
  } = useQuery<MessageWithUser[]>({
    queryKey: [`/api/rooms/${roomId}/messages`],
    enabled: !!roomId,
  });
  
  // WebSocket connection for real-time messaging
  const { connected, messages, sendMessage, setMessages } = useWebSocket(roomId);
  
  // Initialize messages from fetched data
  useEffect(() => {
    if (initialMessages) {
      setMessages(initialMessages);
    }
  }, [initialMessages, setMessages]);
  
  // Handle sending message
  const handleSendMessage = (content: string, imageUrl?: string) => {
    return sendMessage(content, imageUrl);
  };
  
  // Delete Room Mutation
  const deleteRoomMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('DELETE', `/api/rooms/${roomId}`);
      if (!res.ok) {
        throw new Error('Failed to delete chat room');
      }
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Chat room deleted successfully',
      });
      // Invalidate and redirect
      queryClient.invalidateQueries({ queryKey: ['/api/rooms'] });
      navigate('/');
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete the chat room',
        variant: 'destructive',
      });
    }
  });
  
  // Check if current user is the room creator
  const isRoomCreator = room && user && room.creatorId === user.id;
  
  if (!roomId) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-grow flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Invalid Room</h2>
            <p className="mb-6">The room you're trying to access doesn't exist.</p>
            <Link href="/">
              <Button>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Home
              </Button>
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }
  
  const isLoading = isRoomLoading || isMessagesLoading;
  const error = roomError || messagesError;
  
  if (error) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-grow flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Error</h2>
            <p className="mb-6">Failed to load the chat room. Please try again later.</p>
            <Link href="/">
              <Button>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Home
              </Button>
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }
  
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-grow flex flex-col container mx-auto px-4 py-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-3 bg-white rounded-lg shadow-sm border flex flex-col h-[calc(100vh-200px)]">
          {/* Room header */}
          <div className="border-b p-4 flex items-center justify-between">
            <div className="flex items-center">
              <Link href="/">
                <a className="mr-3 text-gray-500 hover:text-gray-700">
                  <ArrowLeft className="h-5 w-5" />
                </a>
              </Link>
              
              <div>
                <h2 className="text-lg font-semibold">{room?.name || 'Loading...'}</h2>
                <p className="text-sm text-gray-500">{room?.description || ''}</p>
                <p className="text-xs text-gray-400">Tribal Room</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Connection status */}
              <div className="flex items-center gap-2">
                <span className={`inline-block rounded-full h-2 w-2 ${
                  connected ? 'bg-green-500' : 'bg-red-500'
                }`}></span>
                <span className="text-sm text-gray-500">
                  {connected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              
              {/* Invite users button (shown to all users) */}
              {room && !room.isSelfChat && (
                <InviteUsersDialog roomId={roomId} roomName={room?.name || "Tribal Room"} />
              )}
              
              {/* Delete room button (only shown to room creator) */}
              {isRoomCreator && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-red-500 border-red-200 hover:bg-red-50"
                  onClick={() => setIsDeleteDialogOpen(true)}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete Room
                </Button>
              )}
            </div>
          </div>
          
          {/* Messages */}
          <MessageList 
            messages={messages} 
            isLoading={isLoading} 
          />
          
          {/* Chat input */}
          <ChatInput 
            onSendMessage={handleSendMessage}
            disabled={!connected}
          />
          </div>
          
          {/* AI Recommendations Sidebar */}
          <div className="hidden md:block md:col-span-1 space-y-4">
            {/* Similar Users Recommendations */}
            <SimilarUsersCard />
            
            {/* Restaurant Recommendations */}
            {roomId && room && !room.isSelfChat && (
              <div className="bg-white rounded-lg shadow-sm border p-4">
                <h3 className="text-lg font-semibold mb-3">Food & Dining</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Find great restaurants near your school for meetups with friends
                </p>
                <RestaurantRecommendationsDialog roomId={roomId} />
              </div>
            )}
          </div>
        </div>
      </main>
      
      <Footer />
      
      {/* Delete Room Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this chat room?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. All messages in this room will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-red-500 hover:bg-red-600"
              onClick={() => deleteRoomMutation.mutate()}
              disabled={deleteRoomMutation.isPending}
            >
              {deleteRoomMutation.isPending ? 'Deleting...' : 'Delete Room'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
