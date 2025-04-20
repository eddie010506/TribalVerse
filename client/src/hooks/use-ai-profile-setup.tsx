import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

export function useAIProfileSetup() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);
  const [isSubmittingProfile, setIsSubmittingProfile] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  // Start a profile setup conversation
  const initializeConversation = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await apiRequest('GET', '/api/ai/initialize-profile-setup');
      const data = await response.json();

      if (data.introduction) {
        const initialMessage: Message = { role: 'assistant', content: data.introduction };
        setMessages([initialMessage]);
      } else {
        throw new Error('Failed to initialize AI conversation');
      }
    } catch (error) {
      console.error('Error initializing AI conversation:', error);
      toast({
        title: 'Error',
        description: 'Failed to start AI profile setup. Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Send a message in the conversation
  const sendMessage = useCallback(async (messageText: string) => {
    if (!messageText.trim()) return;
    
    // Add user message to the conversation
    const userMessage: Message = { role: 'user', content: messageText };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setIsLoading(true);
    
    try {
      const response = await apiRequest('POST', '/api/ai/message', {
        message: messageText,
        conversationHistory: messages,
      });
      
      const data = await response.json();
      
      if (data.reply) {
        // Add AI response to messages
        const aiMessage: Message = { role: 'assistant', content: data.reply };
        setMessages([...updatedMessages, aiMessage]);
      } else {
        throw new Error('Invalid response from AI');
      }
    } catch (error) {
      console.error('Error sending message to AI:', error);
      toast({
        title: 'Error',
        description: 'Failed to get a response. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [messages, toast]);

  // Analyze conversation and update profile
  const analyzeAndUpdateProfile = useCallback(async () => {
    if (messages.length < 2) {
      toast({
        title: 'Not enough conversation',
        description: 'Please have a longer conversation with the AI to get better profile suggestions.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmittingProfile(true);
    try {
      // First, analyze the conversation
      console.log('Sending conversation for analysis:', messages);
      const analysisResponse = await apiRequest('POST', '/api/ai/analyze-profile', {
        conversationHistory: messages,
      });
      
      let profileData;
      if (!analysisResponse.ok) {
        const errorData = await analysisResponse.json();
        throw new Error(`Analysis failed: ${errorData.message || 'Unknown error'}`);
      } else {
        profileData = await analysisResponse.json();
      }
      console.log('Profile data received:', profileData);
      
      if (!profileData || !profileData.hobbies || !profileData.interests || !profileData.currentActivities) {
        throw new Error('Failed to extract complete profile information');
      }
      
      // Create profile update data
      const profileUpdateData = {
        hobbies: profileData.hobbies,
        interests: profileData.interests,
        currentActivities: profileData.currentActivities,
        favoriteFood: profileData.favoriteFood || "Not specified",
      };
      
      console.log('Updating profile with data:', profileUpdateData);
      
      // Then update the user profile
      const updateResponse = await apiRequest('PATCH', '/api/profile', profileUpdateData);
      
      let updatedProfile;
      if (!updateResponse.ok) {
        const errorData = await updateResponse.json();
        throw new Error(`Profile update failed: ${errorData.message || 'Unknown error'}`);
      } else {
        updatedProfile = await updateResponse.json();
      }
      console.log('Profile updated successfully:', updatedProfile);
      
      // Update cache
      queryClient.setQueryData(['/api/profile'], updatedProfile);
      queryClient.setQueryData(['/api/user'], (oldData: any) => {
        if (oldData) {
          return {
            ...oldData,
            hobbies: profileData.hobbies,
            interests: profileData.interests,
            currentActivities: profileData.currentActivities,
            favoriteFood: profileData.favoriteFood || "Not specified",
          };
        }
        return oldData;
      });
      
      // Mark profile setup as completed in localStorage
      localStorage.setItem('profileSetupCompleted', 'true');
      
      // Show success message
      toast({
        title: 'Profile Updated',
        description: 'Your profile has been updated with the AI-generated suggestions including your favorite food.',
      });
      
      setSetupComplete(true);
      
      // Redirect to profile page after a short delay to ensure UI updates
      setTimeout(() => {
        setLocation('/profile');
      }, 500);
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast({
        title: 'Update Failed',
        description: `Failed to update your profile: ${error.message || 'Unknown error'}. Please try again or update your profile manually.`,
        variant: 'destructive',
      });
    } finally {
      setIsSubmittingProfile(false);
    }
  }, [messages, toast, queryClient, setLocation]);

  // Detect if user has already completed profile
  const isProfileComplete = useCallback(() => {
    if (!user) return false;
    
    // For the demovideo account, check if this specific session has already completed setup
    if (user.username === 'demovideo' || user.username === 'demovideos') {
      // Check if we've already completed the profile setup in this session
      const completedSetup = localStorage.getItem('profileSetupCompleted');
      if (completedSetup === 'true') {
        return true;
      }
      return false;
    }
    
    const hasHobbies = !!user.hobbies;
    const hasInterests = !!user.interests;
    const hasActivities = !!user.currentActivities;
    
    return hasHobbies && hasInterests && hasActivities;
  }, [user]);

  return {
    messages,
    isLoading,
    setupComplete,
    isSubmittingProfile,
    initializeConversation,
    sendMessage,
    analyzeAndUpdateProfile,
    isProfileComplete,
  };
}