import { useQuery } from '@tanstack/react-query';
import { ChatRoom } from '@shared/schema';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { RoomList } from '@/components/chat/room-list';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import { PlusCircle, Mail, FileText, Users } from 'lucide-react';
import { RoomInvitations, AcceptedRooms } from '@/components/social/room-invitations';
import { useRoomInvitations } from '@/hooks/use-room-invitations';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { usePosts, PostsProvider } from '@/hooks/use-posts';
import { SimilarUsersCard } from '@/components/ai/similar-users-card';

// Component to show recent posts on the homepage
function RecentPosts() {
  const { posts, isLoading, isError } = usePosts();
  
  if (isLoading) {
    return (
      <div className="p-4 text-center">
        <div className="animate-pulse flex space-x-4">
          <div className="flex-1 space-y-4 py-1">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  if (isError) {
    return (
      <div className="p-4 text-center text-red-500">
        Failed to load recent posts.
      </div>
    );
  }
  
  if (posts.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        No recent posts. Check the Posts page to create one!
      </div>
    );
  }
  
  // Show only the 3 most recent posts
  const recentPosts = posts.slice(0, 3);
  
  return (
    <div className="space-y-3">
      {recentPosts.map(post => (
        <div key={post.id} className="p-3 border rounded-md hover:bg-gray-50">
          <div className="flex items-center mb-2">
            <div className="font-medium">{post.user.username}</div>
            <div className="mx-2 text-gray-300">•</div>
            <div className="text-xs text-gray-500">
              {new Date(post.createdAt).toLocaleDateString()}
            </div>
          </div>
          <p className="text-sm line-clamp-2">{post.content}</p>
          {post.imageUrl && (
            <div className="mt-2">
              <img 
                src={post.imageUrl} 
                alt="Post attachment"
                className="h-16 w-auto object-cover rounded"
              />
            </div>
          )}
        </div>
      ))}
      <div className="text-center">
        <Link href="/posts">
          <Button variant="link" className="text-primary">
            View all posts
          </Button>
        </Link>
      </div>
    </div>
  );
}

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
            <h1 className="text-3xl font-bold text-neutral-800">Tribal Room</h1>
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
            
            {/* AI Recommendations Card */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center">
                  <Users className="h-5 w-5 mr-2 text-primary" />
                  <CardTitle className="text-lg">AI Recommendations</CardTitle>
                </div>
                <CardDescription>
                  Find people with similar interests
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SimilarUsersCard />
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
