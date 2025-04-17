import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAIRecommendations, type SimilarUser } from "@/hooks/use-ai-recommendations";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Users, RefreshCw } from "lucide-react";
import { useEffect } from "react";
import { Link } from "wouter";

export function SimilarUsersCard() {
  const { 
    similarUsers, 
    getSimilarUsers,
    refreshSimilarUsers,
    isLoadingSimilarUsers, 
    hasActiveSimilarUsers,
    noRecommendationsAvailable
  } = useAIRecommendations();

  // Automatically load recommendations when component mounts - but only once
  useEffect(() => {
    if (!hasActiveSimilarUsers && !noRecommendationsAvailable) {
      getSimilarUsers();
    }
  }, [getSimilarUsers, hasActiveSimilarUsers, noRecommendationsAvailable]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2">
          <Users className="h-5 w-5" />
          People You Might Know
        </CardTitle>
        <CardDescription>
          Algorithm-powered recommendations based on your interests
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoadingSimilarUsers ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : similarUsers.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-muted-foreground mb-4">
              No recommendations available yet. Make sure your profile is complete with hobbies and interests.
            </p>
            <Button onClick={() => refreshSimilarUsers()} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Recommendations
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {similarUsers.map((user) => (
              <SimilarUserItem key={user.id} user={user} />
            ))}
            <div className="text-center pt-2">
              <Button onClick={() => refreshSimilarUsers()} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Recommendations
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SimilarUserItem({ user }: { user: SimilarUser }) {
  return (
    <div className="flex items-start space-x-4 p-3 rounded-lg border">
      <Avatar>
        <AvatarFallback>
          {user.username.substring(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <Link href={`/user/${user.id}`}>
          <span className="text-sm font-medium cursor-pointer hover:underline">@{user.username}</span>
        </Link>
        <p className="text-sm text-muted-foreground">{user.matchReason}</p>
      </div>
    </div>
  );
}