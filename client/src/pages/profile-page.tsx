import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import React, { useState } from "react";
import { Loader2, Save, Edit } from "lucide-react";
import { useLocation } from "wouter";

interface ProfileData {
  id: number;
  username: string;
  hobbies: string | null;
  interests: string | null;
  currentActivities: string | null;
}

export default function ProfilePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  
  // State for edit mode
  const [isEditing, setIsEditing] = useState(false);
  
  // Form fields state
  const [hobbies, setHobbies] = useState("");
  const [interests, setInterests] = useState("");
  const [currentActivities, setCurrentActivities] = useState("");

  // Query to fetch profile data
  const {
    data: profile,
    isLoading,
    error,
  } = useQuery<ProfileData>({
    queryKey: ["/api/profile"],
  });

  // Effect to update form fields when profile data changes
  React.useEffect(() => {
    if (profile) {
      setHobbies(profile.hobbies || "");
      setInterests(profile.interests || "");
      setCurrentActivities(profile.currentActivities || "");
    }
  }, [profile]);

  // Mutation to update profile
  const updateProfileMutation = useMutation({
    mutationFn: async (profileData: {
      hobbies?: string;
      interests?: string;
      currentActivities?: string;
    }) => {
      const res = await apiRequest("PATCH", "/api/profile", profileData);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
    },
    onError: (error) => {
      toast({
        title: "Update failed",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-2xl font-bold text-destructive">Error loading profile</h1>
        <p className="text-gray-500">{error.message}</p>
        <Button className="mt-4" onClick={() => setLocation("/")}>
          Go back home
        </Button>
      </div>
    );
  }

  const handleSave = () => {
    updateProfileMutation.mutate({
      hobbies,
      interests,
      currentActivities,
    });
  };

  const handleCancel = () => {
    // Reset form values to original data
    setHobbies(profile?.hobbies || "");
    setInterests(profile?.interests || "");
    setCurrentActivities(profile?.currentActivities || "");
    setIsEditing(false);
  };

  return (
    <div className="container mx-auto py-10 px-4 md:px-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Your Profile</h1>
        
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-2xl">@{user?.username}</CardTitle>
            <CardDescription>
              Your personal information and preferences
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold mb-2">Hobbies</h3>
              {isEditing ? (
                <div className="space-y-2">
                  <Label htmlFor="hobbies">What do you enjoy doing?</Label>
                  <Textarea
                    id="hobbies"
                    placeholder="e.g., Photography, Gaming, Reading"
                    value={hobbies}
                    onChange={(e) => setHobbies(e.target.value)}
                    className="min-h-[100px]"
                  />
                </div>
              ) : (
                <p className="text-gray-700 whitespace-pre-wrap">
                  {profile?.hobbies || "No hobbies added yet"}
                </p>
              )}
            </div>
            
            <Separator />
            
            <div>
              <h3 className="text-xl font-semibold mb-2">Interests</h3>
              {isEditing ? (
                <div className="space-y-2">
                  <Label htmlFor="interests">What topics interest you?</Label>
                  <Textarea
                    id="interests"
                    placeholder="e.g., Technology, Art, Science"
                    value={interests}
                    onChange={(e) => setInterests(e.target.value)}
                    className="min-h-[100px]"
                  />
                </div>
              ) : (
                <p className="text-gray-700 whitespace-pre-wrap">
                  {profile?.interests || "No interests added yet"}
                </p>
              )}
            </div>
            
            <Separator />
            
            <div>
              <h3 className="text-xl font-semibold mb-2">Current Activities</h3>
              {isEditing ? (
                <div className="space-y-2">
                  <Label htmlFor="currentActivities">What are you working on currently?</Label>
                  <Textarea
                    id="currentActivities"
                    placeholder="e.g., Learning Spanish, Building a website"
                    value={currentActivities}
                    onChange={(e) => setCurrentActivities(e.target.value)}
                    className="min-h-[100px]"
                  />
                </div>
              ) : (
                <p className="text-gray-700 whitespace-pre-wrap">
                  {profile?.currentActivities || "No current activities added yet"}
                </p>
              )}
            </div>
          </CardContent>
          
          <CardFooter className="flex justify-end">
            {isEditing ? (
              <div className="space-x-2">
                <Button variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleSave} 
                  disabled={updateProfileMutation.isPending}
                >
                  {updateProfileMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Profile
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <Button onClick={() => setIsEditing(true)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit Profile
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}