import { useQuery } from '@tanstack/react-query';
import { ChatRoom } from '@shared/schema';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { RoomList } from '@/components/chat/room-list';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import { PlusCircle } from 'lucide-react';

export default function HomePage() {
  const {
    data: rooms,
    isLoading,
    error,
  } = useQuery<ChatRoom[]>({
    queryKey: ['/api/rooms'],
  });

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-neutral-800">Chat Rooms</h1>
            <p className="text-neutral-600 mt-1">
              Join an existing room or create your own
            </p>
          </div>
          
          <Link href="/create-room">
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Create Room
            </Button>
          </Link>
        </div>
        
        {error ? (
          <div className="bg-red-50 p-4 rounded-md text-red-600">
            Failed to load chat rooms. Please try again later.
          </div>
        ) : (
          <RoomList 
            rooms={rooms || []} 
            isLoading={isLoading} 
          />
        )}
      </main>
      
      <Footer />
    </div>
  );
}
