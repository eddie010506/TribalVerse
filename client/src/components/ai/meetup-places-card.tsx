import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAIRecommendations, type MeetupPlace } from "@/hooks/use-ai-recommendations";
import { Loader2, MapPin, RefreshCw, Utensils, Star, MapIcon } from "lucide-react";
import { useEffect } from "react";

export function MeetupPlacesCard({ roomId }: { roomId: number }) {
  const { 
    meetupPlaces, 
    getMeetupRecommendations,
    refreshMeetupPlaces,
    isLoadingMeetupPlaces, 
    hasActiveMeetupPlaces 
  } = useAIRecommendations();

  // Load recommendations when component mounts
  useEffect(() => {
    if (!hasActiveMeetupPlaces && roomId) {
      getMeetupRecommendations(roomId);
    }
  }, [getMeetupRecommendations, hasActiveMeetupPlaces, roomId]);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2">
          <Utensils className="h-5 w-5" />
          Recommended Restaurants
        </CardTitle>
        <CardDescription>
          Top-rated restaurants near 321 Golf Club Rd, Pleasant Hill, CA
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoadingMeetupPlaces ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : meetupPlaces.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-muted-foreground mb-4">
              No restaurant suggestions available yet. This feature requires an active chat room with at least 20 messages.
            </p>
            <Button onClick={() => refreshMeetupPlaces(roomId)} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Get Suggestions
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {meetupPlaces.map((place, index) => (
              <RestaurantItem
                key={index}
                place={place}
              />
            ))}
            <div className="text-center pt-2">
              <Button 
                onClick={() => refreshMeetupPlaces(roomId)} 
                variant="outline" 
                size="sm"
              >
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

function RestaurantItem({ place }: { place: MeetupPlace }) {
  // Extract rating if available
  const ratingMatch = place.description ? place.description.match(/Rating: (\d+\.\d+)/) : null;
  const rating = ratingMatch ? ratingMatch[1] : place.rating || null;
  
  // Parse cuisine types from description
  const cuisineMatch = place.description ? place.description.match(/\(([^)]+)\)/) : null;
  const cuisines = cuisineMatch ? cuisineMatch[1].split(', ') : [];
  
  // Clean description by removing the rating and cuisine parts
  const cleanDescription = place.description 
    ? place.description
        .replace(/\([^)]+\)/, '')
        .replace(/- Rating: \d+\.\d+\/5/, '')
        .trim()
    : '';
  
  return (
    <div className="p-4 rounded-lg border bg-card hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start">
        <h3 className="text-md font-medium">{place.name}</h3>
        {rating && (
          <div className="flex items-center gap-1 bg-yellow-100 px-2 py-0.5 rounded text-yellow-700">
            <Star className="h-3.5 w-3.5 fill-yellow-500 text-yellow-500" />
            <span className="text-xs font-medium">{rating}</span>
          </div>
        )}
      </div>
      
      <div className="mt-1 flex flex-wrap gap-1">
        {cuisines.map((cuisine: string, i: number) => (
          <Badge key={i} variant="outline" className="text-xs">
            {cuisine}
          </Badge>
        ))}
      </div>
      
      <p className="text-sm mt-2 text-muted-foreground">{cleanDescription}</p>
      <p className="text-sm mt-2">{place.reasonToVisit}</p>
    </div>
  );
}