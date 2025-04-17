import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAIRecommendations, type MeetupPlace } from "@/hooks/use-ai-recommendations";
import { Loader2, MapPin, RefreshCw, Coffee, Library, School, Utensils, Building, MapIcon } from "lucide-react";
import { useEffect } from "react";

const placeTypeIcons: Record<string, React.ReactNode> = {
  "cafe": <Coffee className="h-4 w-4" />,
  "library": <Library className="h-4 w-4" />,
  "restaurant": <Utensils className="h-4 w-4" />,
  "campus": <School className="h-4 w-4" />,
  "building": <Building className="h-4 w-4" />,
  "default": <MapPin className="h-4 w-4" />
};

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

  const getIconForPlaceType = (type: string) => {
    const lowerType = type.toLowerCase();
    
    for (const [key, icon] of Object.entries(placeTypeIcons)) {
      if (lowerType.includes(key)) {
        return icon;
      }
    }
    
    return placeTypeIcons.default;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2">
          <MapIcon className="h-5 w-5" />
          Suggested Meetup Places
        </CardTitle>
        <CardDescription>
          AI-powered meetup recommendations for this chat room
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
              No meetup suggestions available yet. This feature requires an active chat room with at least 20 messages.
            </p>
            <Button onClick={() => refreshMeetupPlaces(roomId)} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Get Suggestions
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {meetupPlaces.map((place, index) => (
              <MeetupPlaceItem
                key={index}
                place={place}
                icon={getIconForPlaceType(place.type)}
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

function MeetupPlaceItem({ place, icon }: { place: MeetupPlace; icon: React.ReactNode }) {
  return (
    <div className="flex items-start space-x-4 p-3 rounded-lg border bg-card">
      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-medium">{place.name}</h3>
        <p className="text-xs text-muted-foreground">{place.type}</p>
        <p className="text-sm mt-1">{place.reason}</p>
      </div>
    </div>
  );
}