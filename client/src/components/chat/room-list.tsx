import { ChatRoom } from '@shared/schema';
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardContent 
} from '@/components/ui/card';
import { format } from 'date-fns';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { PlusCircle, Loader2 } from 'lucide-react';

interface RoomListProps {
  rooms: ChatRoom[];
  isLoading: boolean;
}

export function RoomList({ rooms, isLoading }: RoomListProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (rooms.length === 0) {
    return (
      <Card className="my-6">
        <CardContent className="pt-6 text-center">
          <p className="text-gray-500 mb-4">No chat rooms available.</p>
          <Link href="/create-room">
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Create a new room
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 my-6">
      {rooms.map((room) => (
        <Card key={room.id} className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">
              <Link href={`/rooms/${room.id}`}>
                <a className="text-primary hover:underline">{room.name}</a>
              </Link>
            </CardTitle>
            <CardDescription>
              Created {room.createdAt instanceof Date
                ? format(room.createdAt, 'MMM dd, yyyy')
                : 'Unknown date'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              {room.description || 'No description available.'}
            </p>
            <Link href={`/rooms/${room.id}`}>
              <Button variant="outline" size="sm" className="w-full">
                Join Chat
              </Button>
            </Link>
          </CardContent>
        </Card>
      ))}
      
      <Card className="border-dashed border-2 hover:border-primary transition-colors flex items-center justify-center">
        <CardContent className="text-center py-8">
          <Link href="/create-room">
            <Button variant="ghost" className="h-full">
              <PlusCircle className="mr-2 h-5 w-5" />
              Create new room
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
