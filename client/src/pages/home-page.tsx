import { useQuery } from '@tanstack/react-query';
import { ChatRoom } from '@shared/schema';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { RoomList } from '@/components/chat/room-list';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import { PlusCircle, Mail } from 'lucide-react';
import { RoomInvitations, AcceptedRooms } from '@/components/social/room-invitations';
import { useRoomInvitations } from '@/hooks/use-room-invitations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export default function HomePage() {
  const {
    data: rooms,
    isLoading,
    error,
  } = useQuery<ChatRoom[]>({
    queryKey: ['/api/rooms'],
  });

  const { receivedInvitations, isLoadingReceived } = useRoomInvitations();
  const hasPendingInvitations = receivedInvitations.some(inv => inv.status === 'pending');

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

        <div className="grid gap-6 md:grid-cols-3 lg:grid-cols-4">
          <div className="md:col-span-2 lg:col-span-3">
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
          </div>

          <div className="space-y-6">
            {/* Room Invitations */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center">
                  <Mail className="h-5 w-5 mr-2 text-primary" />
                  <CardTitle className="text-lg">Room Invitations</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <RoomInvitations />
                <AcceptedRooms />
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
