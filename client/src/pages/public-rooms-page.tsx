import { useQuery, useMutation } from '@tanstack/react-query';
import { ChatRoom } from '@shared/schema';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Button } from '@/components/ui/button';
import { Link, useLocation } from 'wouter';
import { Plus, Compass, Users, Tag, Globe, PlusCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';
import { useEffect, useState } from 'react';

type PublicRoomWithMemberStatus = ChatRoom & {
  isMember: boolean;
}

type RoomRecommendation = ChatRoom & {
  matchReason: string;
}

type RoomRecommendationsResponse = {
  rooms: RoomRecommendation[];
  isProfileComplete: boolean;
  message: string;
}

// Component to display a single public room card
function PublicRoomCard({ room, onJoin }: { 
  room: PublicRoomWithMemberStatus, 
  onJoin: (roomId: number) => void 
}) {
  const [, navigate] = useLocation();
  const categoryTags = room.tags?.split(',').filter(Boolean) || [];
  
  // View room if already a member, join if not
  const handleRoomAction = () => {
    if (room.isMember) {
      navigate(`/rooms/${room.id}`);
    } else {
      onJoin(room.id);
    }
  };
  
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg">{room.name}</CardTitle>
          <Badge variant={room.isMember ? "secondary" : "outline"}>
            {room.isMember ? "Joined" : "Open"}
          </Badge>
        </div>
        <CardDescription>
          {room.category && (
            <Badge variant="outline" className="mr-2 bg-gray-50">
              {room.category}
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">
            {room.totalMembers || 1} {(room.totalMembers || 1) === 1 ? 'member' : 'members'}
          </span>
        </CardDescription>
      </CardHeader>
      
      <CardContent className="flex-grow">
        {room.description && (
          <p className="text-sm text-gray-600 mb-2 line-clamp-2">{room.description}</p>
        )}
        
        {categoryTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {categoryTags.map((tag, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
      
      <CardFooter className="pt-2">
        <Button 
          onClick={handleRoomAction} 
          className="w-full"
          variant={room.isMember ? "secondary" : "default"}
        >
          {room.isMember ? 'Enter Room' : 'Join Room'}
        </Button>
      </CardFooter>
    </Card>
  );
}

// Component to display recommended public rooms
function RecommendedRooms() {
  const {
    data,
    isLoading,
    error,
  } = useQuery<RoomRecommendationsResponse>({
    queryKey: ['/api/public-rooms/recommendations'],
  });

  const joinRoomMutation = useMutation({
    mutationFn: async (roomId: number) => {
      const response = await apiRequest('POST', `/api/public-rooms/${roomId}/join`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/public-rooms/recommendations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/public-rooms'] });
      toast({
        title: "Success!",
        description: "You've joined the room",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to join room",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleJoinRoom = (roomId: number) => {
    joinRoomMutation.mutate(roomId);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-3/4" />
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 p-4 rounded-md text-red-600">
        Failed to load recommendations. Please try again later.
      </div>
    );
  }

  if (!data?.rooms?.length) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-4">
            <Users className="h-12 w-12 mx-auto text-gray-300 mb-2" />
            <h3 className="text-lg font-medium">{data?.message || "No recommendations found"}</h3>
            <p className="text-sm text-gray-500 mt-1">
              {data?.isProfileComplete 
                ? "Try joining some public rooms that interest you" 
                : "Complete your profile to get personalized recommendations"}
            </p>
            
            {!data?.isProfileComplete && (
              <Button variant="outline" className="mt-4" asChild>
                <Link href="/profile">Complete Profile</Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Recommended for you</h2>
      </div>
      
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        {data.rooms.map((room) => (
          <div key={room.id} className="flex flex-col">
            <PublicRoomCard 
              room={{...room, isMember: false}} 
              onJoin={handleJoinRoom} 
            />
            <p className="text-sm text-gray-500 mt-1 italic">
              {room.matchReason}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PublicRoomsPage() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<PublicRoomWithMemberStatus[]>([]);
  const [, navigate] = useLocation();
  
  const {
    data: rooms = [],
    isLoading,
    error,
  } = useQuery<PublicRoomWithMemberStatus[]>({
    queryKey: ['/api/public-rooms'],
  });
  
  useEffect(() => {
    if (rooms && rooms.length > 0 && searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      
      const results = rooms.filter(room => {
        const nameMatch = room.name.toLowerCase().includes(lowerSearch);
        const descMatch = room.description?.toLowerCase().includes(lowerSearch);
        const categoryMatch = room.category?.toLowerCase().includes(lowerSearch);
        const tagsMatch = room.tags?.toLowerCase().includes(lowerSearch);
        
        return nameMatch || descMatch || categoryMatch || tagsMatch;
      });
      
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  }, [searchTerm, rooms]);
  
  const joinRoomMutation = useMutation({
    mutationFn: async (roomId: number) => {
      const response = await apiRequest('POST', `/api/public-rooms/${roomId}/join`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/public-rooms'] });
      toast({
        title: "Success!",
        description: "You've joined the room",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to join room",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const handleJoinRoom = (roomId: number) => {
    joinRoomMutation.mutate(roomId);
  };
  
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-neutral-800">Public Rooms</h1>
            <p className="text-neutral-600 mt-1">
              Find and join rooms based on your interests
            </p>
          </div>
          
          <div className="flex space-x-2">
            <Link href="/chat">
              <Button variant="outline">
                My Rooms
              </Button>
            </Link>
            
            <Link href="/create-room">
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" />
                Create Room
              </Button>
            </Link>
          </div>
        </div>
        
        <div className="grid gap-8 md:grid-cols-3 lg:grid-cols-4">
          <div className="md:col-span-2 lg:col-span-3 space-y-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <Compass className="h-5 w-5 mr-2 text-primary" />
                  Discover Rooms
                </CardTitle>
                <CardDescription>Find public rooms to join</CardDescription>
              </CardHeader>
              
              <CardContent>
                <div className="mb-4">
                  <Input
                    placeholder="Search for rooms by name, category, or tags..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full"
                  />
                </div>
                
                {isLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Skeleton className="h-40" />
                    <Skeleton className="h-40" />
                    <Skeleton className="h-40" />
                    <Skeleton className="h-40" />
                  </div>
                ) : error ? (
                  <div className="bg-red-50 p-4 rounded-md text-red-600">
                    Failed to load public rooms. Please try again later.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(searchTerm ? searchResults : rooms).map((room) => (
                      <PublicRoomCard
                        key={room.id}
                        room={room}
                        onJoin={handleJoinRoom}
                      />
                    ))}
                    
                    {(searchTerm && searchResults.length === 0) && (
                      <div className="col-span-2 text-center py-8">
                        <p className="text-gray-500">No rooms found matching "{searchTerm}"</p>
                      </div>
                    )}
                    
                    {(!searchTerm && rooms.length === 0) && (
                      <div className="col-span-2 text-center py-8">
                        <Globe className="h-12 w-12 mx-auto text-gray-300 mb-2" />
                        <p className="text-gray-500">No public rooms available right now</p>
                        <Button variant="outline" className="mt-4" asChild>
                          <Link href="/create-room">Create the first one</Link>
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center">
                  <Tag className="h-5 w-5 mr-2 text-primary" />
                  <CardTitle className="text-lg">Popular Categories</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {isLoading ? (
                    <>
                      <Skeleton className="h-6 w-3/4" />
                      <Skeleton className="h-6 w-1/2" />
                      <Skeleton className="h-6 w-2/3" />
                    </>
                  ) : (
                    <>
                      {/* Extract and display unique categories from available rooms */}
                      {Array.from(new Set(rooms.map(room => room.category).filter(Boolean)))
                        .slice(0, 5)
                        .map(category => (
                          <Badge 
                            key={category} 
                            variant="secondary"
                            className="mr-2 mb-2 text-sm py-1 px-2 cursor-pointer"
                            onClick={() => setSearchTerm(category || '')}
                          >
                            {category}
                          </Badge>
                        ))}
                        
                      {/* If no categories found */}
                      {rooms.length > 0 && !rooms.some(room => room.category) && (
                        <p className="text-sm text-gray-500">No categories yet</p>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
            
            {/* AI Recommendations Card */}
            <RecommendedRooms />
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}