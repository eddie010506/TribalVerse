import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRoute } from 'wouter';
import { ChatRoom, MessageWithUser } from '@shared/schema';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { MessageList } from '@/components/chat/message-list';
import { ChatInput } from '@/components/chat/chat-input';
import { useWebSocket } from '@/hooks/use-websocket';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Users, Info } from 'lucide-react';
import { Link } from 'wouter';

export default function ChatRoomPage() {
  // Get room id from URL
  const [match, params] = useRoute('/rooms/:id');
  const roomId = params?.id ? parseInt(params.id) : undefined;
  
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
        <div className="bg-white rounded-lg shadow-sm border flex flex-col h-[calc(100vh-200px)]">
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
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <span className={`inline-block rounded-full h-2 w-2 ${
                connected ? 'bg-green-500' : 'bg-red-500'
              }`}></span>
              <span className="text-sm text-gray-500">
                {connected ? 'Connected' : 'Disconnected'}
              </span>
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
      </main>
      
      <Footer />
    </div>
  );
}
