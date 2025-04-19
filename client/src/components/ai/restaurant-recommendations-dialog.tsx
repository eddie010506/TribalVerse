import { useState, useEffect } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAIRecommendations, type MeetupPlace } from "@/hooks/use-ai-recommendations";
import { Utensils, Star, DollarSign, RefreshCw, Loader2 } from "lucide-react";

interface PriceCategory {
  range: string;
  label: string;
  icon: React.ReactNode;
  restaurants: MeetupPlace[];
}

export function RestaurantRecommendationsDialog({ roomId }: { roomId: number }) {
  const { 
    meetupPlaces, 
    getMeetupRecommendations,
    refreshMeetupPlaces,
    isLoadingMeetupPlaces
  } = useAIRecommendations();

  const [open, setOpen] = useState(false);
  const [categorizedRestaurants, setCategorizedRestaurants] = useState<PriceCategory[]>([]);
  
  // Categorize restaurants by price range
  useEffect(() => {
    if (meetupPlaces.length > 0) {
      const budget: MeetupPlace[] = [];
      const midRange: MeetupPlace[] = [];
      const premium: MeetupPlace[] = [];
      
      // Split restaurants into price categories
      meetupPlaces.forEach(place => {
        // Use restaurant name and description to guess price category
        const name = place.name.toLowerCase();
        const desc = place.description?.toLowerCase() || '';
        
        // Simple heuristic based on keywords and restaurant types
        if (
          name.includes('fast') || 
          name.includes('express') || 
          desc.includes('fast') ||
          desc.includes('casual') ||
          desc.includes('budget')
        ) {
          budget.push(place);
        } else if (
          name.includes('fine') || 
          name.includes('premium') || 
          desc.includes('fine dining') ||
          desc.includes('upscale') ||
          desc.includes('premium')
        ) {
          premium.push(place);
        } else {
          midRange.push(place);
        }
      });
      
      setCategorizedRestaurants([
        {
          range: "budget",
          label: "$10-20",
          icon: <DollarSign className="h-4 w-4" />,
          restaurants: budget.length ? budget : meetupPlaces.slice(0, 2)
        },
        {
          range: "mid-range",
          label: "$20-30",
          icon: <><DollarSign className="h-4 w-4" /><DollarSign className="h-4 w-4" /></>,
          restaurants: midRange.length ? midRange : meetupPlaces.slice(2, 4)
        },
        {
          range: "premium",
          label: "$30+",
          icon: <><DollarSign className="h-4 w-4" /><DollarSign className="h-4 w-4" /><DollarSign className="h-4 w-4" /></>,
          restaurants: premium.length ? premium : meetupPlaces.slice(4, 6)
        }
      ]);
    }
  }, [meetupPlaces]);

  // Load recommendations when dialog is opened
  useEffect(() => {
    if (open && meetupPlaces.length === 0 && !isLoadingMeetupPlaces) {
      getMeetupRecommendations(roomId);
    }
  }, [open, roomId, meetupPlaces.length, getMeetupRecommendations, isLoadingMeetupPlaces]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <Utensils className="h-4 w-4" />
          <span>Restaurant Recommendations</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[625px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Utensils className="h-5 w-5" />
            Restaurant Recommendations
          </DialogTitle>
          <DialogDescription>
            Top-rated restaurants near 321 Golf Club Rd, Pleasant Hill, CA
          </DialogDescription>
        </DialogHeader>

        {isLoadingMeetupPlaces ? (
          <div className="flex justify-center py-12">
            <div className="flex flex-col items-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
              <p className="text-sm text-muted-foreground">Finding the best restaurants for your group...</p>
            </div>
          </div>
        ) : meetupPlaces.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-6">
              No restaurant suggestions available yet. This feature requires an active chat room with at least 20 messages.
            </p>
            <Button onClick={() => refreshMeetupPlaces(roomId)} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Get Suggestions
            </Button>
          </div>
        ) : (
          <Tabs defaultValue="budget">
            <TabsList className="w-full grid grid-cols-3">
              {categorizedRestaurants.map((category) => (
                <TabsTrigger key={category.range} value={category.range}>
                  <div className="flex items-center gap-1.5">
                    <div className="flex">{category.icon}</div>
                    <span>{category.label}</span>
                  </div>
                </TabsTrigger>
              ))}
            </TabsList>
            
            {categorizedRestaurants.map((category) => (
              <TabsContent key={category.range} value={category.range} className="mt-4 space-y-4">
                {category.restaurants.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    No restaurants in this price range
                  </div>
                ) : (
                  category.restaurants.map((restaurant, idx) => (
                    <RestaurantCard key={idx} place={restaurant} />
                  ))
                )}
              </TabsContent>
            ))}
          </Tabs>
        )}
        
        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Prices are estimated based on restaurant type
          </p>
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RestaurantCard({ place }: { place: MeetupPlace }) {
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
        <h3 className="text-md font-semibold">{place.name}</h3>
        {rating && (
          <div className="flex items-center gap-1 bg-yellow-100 px-2 py-0.5 rounded text-yellow-700">
            <Star className="h-3.5 w-3.5 fill-yellow-500 text-yellow-500" />
            <span className="text-xs font-medium">{rating}</span>
          </div>
        )}
      </div>
      
      <div className="mt-2 flex flex-wrap gap-1.5">
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