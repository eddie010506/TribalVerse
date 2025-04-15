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
import React, { useState, useEffect } from "react";
import { Loader2, Save, Edit, Mail, CheckCircle, XCircle, SendHorizontal, AlertCircle, Users, UserCheck, Heart } from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFollows } from "@/hooks/use-follows";
import { useFriendRequests } from "@/hooks/use-friend-requests";
import { FriendRequestList } from "@/components/social/friend-request-list";
import { FollowList } from "@/components/social/follow-list";

// Social components for the different tabs
function SocialFriendRequests({ userId }: { userId?: number }) {
  const { receivedRequests, isLoading, acceptRequest, rejectRequest } = useFriendRequests();
  
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Friend Requests</h3>
      <FriendRequestList 
        requests={receivedRequests} 
        isLoading={isLoading} 
        onAccept={acceptRequest}
        onReject={rejectRequest}
      />
    </div>
  );
}

function SocialFollowers({ userId }: { userId?: number }) {
  const { followers, isLoading } = useFollows(userId);
  
  return (
    <FollowList 
      users={followers} 
      isLoading={isLoading}
      emptyMessage="You don't have any followers yet"
      title="People Following You"
    />
  );
}

function SocialFollowing({ userId }: { userId?: number }) {
  const { following, isLoading } = useFollows(userId);
  
  return (
    <FollowList 
      users={following} 
      isLoading={isLoading}
      emptyMessage="You aren't following anyone yet"
      title="People You Follow"
    />
  );
}

interface ProfileData {
  id: number;
  username: string;
  email: string | null;
  emailVerified: boolean;
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
  const [email, setEmail] = useState("");
  const [isEditingEmail, setIsEditingEmail] = useState(false);

  // Query to fetch profile data
  const {
    data: profile,
    isLoading,
    error,
  } = useQuery<ProfileData>({
    queryKey: ["/api/profile"],
  });

  // Effect to update form fields when profile data changes
  useEffect(() => {
    if (profile) {
      setHobbies(profile.hobbies || "");
      setInterests(profile.interests || "");
      setCurrentActivities(profile.currentActivities || "");
      setEmail(profile.email || "");
    }
  }, [profile]);
  
  // Check if verification was successful from URL
  const [match, params] = useRoute('/profile');
  const [showVerificationSuccess, setShowVerificationSuccess] = useState(false);
  
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('verified') === 'true') {
      setShowVerificationSuccess(true);
      // Clear the query parameter to prevent showing the success message again on refresh
      window.history.replaceState({}, document.title, '/profile');
    }
  }, []);

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
  
  // Mutation to update email
  const updateEmailMutation = useMutation({
    mutationFn: async (emailData: { email: string }) => {
      const res = await apiRequest("PATCH", "/api/profile/email", emailData);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Email updated",
        description: "Your email has been updated. Please verify your email.",
      });
      setIsEditingEmail(false);
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
    },
    onError: (error) => {
      toast({
        title: "Email update failed",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    },
  });
  
  // Mutation to send verification email
  const sendVerificationEmailMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/send-verification-email");
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Verification email sent",
        description: "Please check your inbox and click the verification link.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to send verification email",
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

  // Handle email verification functions
  const handleSaveEmail = () => {
    updateEmailMutation.mutate({ email });
  };
  
  const handleCancelEmail = () => {
    setEmail(profile?.email || "");
    setIsEditingEmail(false);
  };
  
  const handleSendVerificationEmail = () => {
    sendVerificationEmailMutation.mutate();
  };

  return (
    <div className="container mx-auto py-10 px-4 md:px-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Your Profile</h1>
        
        {showVerificationSuccess && (
          <Alert className="mb-6 bg-green-50 border-green-200">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800">Email verified successfully!</AlertTitle>
            <AlertDescription className="text-green-700">
              Your email has been verified. You can now create chat rooms and post messages.
            </AlertDescription>
          </Alert>
        )}
        
        {/* Email Verification Card */}
        <Card className="mb-8">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Verification
            </CardTitle>
            <CardDescription>
              Verify your email to create chat rooms and post messages
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <div className="flex items-center">
              <div className="flex-1">
                {profile?.emailVerified ? (
                  <div className="flex items-center text-green-600">
                    <CheckCircle className="h-5 w-5 mr-2" />
                    <span>Email verified</span>
                    <Badge className="ml-2 bg-green-100 text-green-800 hover:bg-green-200">Verified</Badge>
                  </div>
                ) : (
                  <div className="flex items-center text-amber-600">
                    <AlertCircle className="h-5 w-5 mr-2" />
                    <span>Email not verified</span>
                    {profile?.email && (
                      <Badge className="ml-2 bg-amber-100 text-amber-800 hover:bg-amber-200">Pending</Badge>
                    )}
                  </div>
                )}
              </div>
              
              {!isEditingEmail && !profile?.emailVerified && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setIsEditingEmail(true)}
                  disabled={updateEmailMutation.isPending}
                >
                  {profile?.email ? 'Change Email' : 'Add Email'}
                </Button>
              )}
            </div>
            
            {profile?.email && !profile.emailVerified && !isEditingEmail && (
              <div className="flex items-center gap-4 mt-2">
                <p className="text-sm text-gray-500">Email: {profile.email}</p>
                <Button 
                  size="sm" 
                  variant="secondary"
                  onClick={handleSendVerificationEmail}
                  disabled={sendVerificationEmailMutation.isPending}
                >
                  {sendVerificationEmailMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <SendHorizontal className="mr-2 h-3 w-3" />
                      Resend Verification
                    </>
                  )}
                </Button>
              </div>
            )}
            
            {isEditingEmail && (
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <div className="flex gap-2">
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter your .edu email address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                    <Button 
                      onClick={handleSaveEmail}
                      disabled={!email || !email.toLowerCase().endsWith('.edu') || updateEmailMutation.isPending}
                    >
                      {updateEmailMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Save"
                      )}
                    </Button>
                    <Button variant="outline" onClick={handleCancelEmail}>
                      Cancel
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-gray-500">
                    We'll send a verification email to this address.
                  </p>
                  <p className="text-sm font-medium text-amber-600">
                    Only educational (.edu) email addresses are allowed.
                  </p>
                </div>
              </div>
            )}
            
            {!profile?.emailVerified && !isEditingEmail && (
              <Alert className="bg-blue-50 border-blue-200">
                <AlertTitle className="text-blue-800">Verification Required</AlertTitle>
                <AlertDescription className="text-blue-700">
                  You need to verify your email address before you can create chat rooms or post messages.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
        
        {/* Social Interactions Card */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Users className="h-5 w-5" />
              Social Connections
            </CardTitle>
            <CardDescription>
              Your followers, friends, and friend requests
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <Tabs defaultValue="requests">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="requests" className="flex items-center gap-1">
                  <UserCheck className="h-4 w-4" />
                  Requests
                </TabsTrigger>
                <TabsTrigger value="followers" className="flex items-center gap-1">
                  <Heart className="h-4 w-4" />
                  Followers
                </TabsTrigger>
                <TabsTrigger value="following" className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  Following
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="requests" className="mt-4">
                <SocialFriendRequests userId={profile?.id} />
              </TabsContent>
              
              <TabsContent value="followers" className="mt-4">
                <SocialFollowers userId={profile?.id} />
              </TabsContent>
              
              <TabsContent value="following" className="mt-4">
                <SocialFollowing userId={profile?.id} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        
        {/* User Profile Card */}
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