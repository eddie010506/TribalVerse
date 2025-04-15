import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ProfileData {
  id: number;
  username: string;
  email: string | null;
  emailVerified: boolean;
  hobbies: string | null;
  interests: string | null;
  currentActivities: string | null;
  profilePicture: string | null;
}

export function useAIProfileSetup() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isProfileComplete, setIsProfileComplete] = useState<boolean | null>(null);

  // Fetch profile data
  const { data: profile, isLoading } = useQuery<ProfileData>({
    queryKey: ["/api/profile"],
    enabled: !!user,
  });

  // Check if the profile is complete (has hobbies, interests, and currentActivities)
  useEffect(() => {
    if (profile) {
      const hasHobbies = !!profile.hobbies && profile.hobbies.trim() !== "";
      const hasInterests = !!profile.interests && profile.interests.trim() !== "";
      const hasActivities = !!profile.currentActivities && profile.currentActivities.trim() !== "";
      
      // Profile is considered complete if at least two of the three fields are filled
      setIsProfileComplete(
        (hasHobbies && hasInterests) || 
        (hasHobbies && hasActivities) || 
        (hasInterests && hasActivities)
      );
    }
  }, [profile]);

  // Mutation to update profile with AI-suggested data
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
        description: "Your profile has been updated with your preferences!",
      });
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

  // Function to redirect to AI chat for profile setup
  const redirectToProfileSetup = () => {
    setLocation("/ai-chat?setup=profile");
  };

  // Function to update profile from AI chat
  const updateProfileFromAI = (data: {
    hobbies?: string;
    interests?: string;
    currentActivities?: string;
  }) => {
    updateProfileMutation.mutate(data);
  };

  return {
    isProfileComplete,
    isLoading,
    profile,
    redirectToProfileSetup,
    updateProfileFromAI,
    isPending: updateProfileMutation.isPending,
  };
}