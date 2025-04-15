import { useState, useEffect, useRef } from 'react';
import { Send, Loader2, Bot, ArrowLeft, Save } from 'lucide-react';
import { format } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAIChat, type Message } from '@/hooks/use-ai-chat';
import { useAuth } from '@/hooks/use-auth';
import { useAIProfileSetup } from '@/hooks/use-ai-profile-setup';
import { Header } from '../components/layout/header';
import { Footer } from '../components/layout/footer';
import { useLocation } from 'wouter';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle } from 'lucide-react';

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`flex items-start gap-2 max-w-[80%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        <Avatar className="h-8 w-8 mt-1 flex-shrink-0">
          {isUser ? (
            <>
              <AvatarImage src={undefined} />
              <AvatarFallback>U</AvatarFallback>
            </>
          ) : (
            <>
              <AvatarFallback className="bg-purple-600 text-white">
                <Bot className="h-4 w-4" />
              </AvatarFallback>
            </>
          )}
        </Avatar>
        
        <div className={`rounded-lg p-3 ${
          isUser 
            ? 'bg-primary text-primary-foreground' 
            : 'bg-muted'
        }`}>
          <div className="text-sm whitespace-pre-wrap">
            {message.content}
          </div>
          {message.timestamp && (
            <div className={`text-xs mt-1 ${isUser ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
              {format(message.timestamp, 'h:mm a')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AIChatPage() {
  const [inputValue, setInputValue] = useState('');
  const { messages, isInitializing, sendMessage, isSending, initialize } = useAIChat();
  const { user } = useAuth();
  const { updateProfileFromAI, isPending: isProfileUpdating, profile } = useAIProfileSetup();
  const [, setLocation] = useLocation();
  
  // State for profile setup
  const [isProfileSetup, setIsProfileSetup] = useState(false);
  const [profileData, setProfileData] = useState<{
    hobbies: string | null;
    interests: string | null;
    currentActivities: string | null;
  }>({
    hobbies: null,
    interests: null,
    currentActivities: null,
  });
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);
  
  // Ref to track if we've sent the initial message
  const hasStartedSetupRef = useRef(false);
  
  // Check if this is a profile setup session
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const isSetup = urlParams.get('setup') === 'profile';
    setIsProfileSetup(isSetup);
    
    // If this is profile setup and we have a user, initialize the conversation specifically for profile
    if (isSetup && user && !hasStartedSetupRef.current && messages.length === 0) {
      hasStartedSetupRef.current = true;
      
      // Initialize with custom system instruction for profile setup
      initialize(
        `You are helping a new user set up their profile. First, introduce yourself and explain that you'll help them set up their profile by understanding their hobbies, interests, and current activities. Then, ask about their hobbies first. After they respond, ask about their interests. Finally, ask about their current activities or projects. Be conversational and friendly.`
      ).then(() => {
        // After initialization, send a message to get the conversation going
        sendMessage("Hi, I'm a new user and I'd like to set up my profile.");
      });
    }
  }, [user, messages.length, initialize, sendMessage]);
  
  // Effect to parse AI responses for profile data
  useEffect(() => {
    if (!isProfileSetup) return;
    
    // Only look at the last assistant message
    const lastAssistantMessage = [...messages].reverse().find(m => m.role === 'assistant');
    if (!lastAssistantMessage) return;
    
    // Check if the message contains profile data
    const content = lastAssistantMessage.content.toLowerCase();
    
    // If message suggests we have all information, update state
    if (messages.length >= 6 && !profileData.hobbies && content.includes('hobby') || content.includes('hobbies')) {
      // The user probably just described their hobbies in the previous message
      const userHobbiesMessage = messages[messages.length - 2];
      if (userHobbiesMessage && userHobbiesMessage.role === 'user') {
        setProfileData(prev => ({ ...prev, hobbies: userHobbiesMessage.content }));
      }
    }
    
    if (messages.length >= 8 && !profileData.interests && content.includes('interest')) {
      // The user probably just described their interests in the previous message
      const userInterestsMessage = messages[messages.length - 2];
      if (userInterestsMessage && userInterestsMessage.role === 'user') {
        setProfileData(prev => ({ ...prev, interests: userInterestsMessage.content }));
      }
    }
    
    if (messages.length >= 10 && !profileData.currentActivities && 
        (content.includes('current') || content.includes('activities') || content.includes('projects'))) {
      // The user probably just described their current activities in the previous message
      const userActivitiesMessage = messages[messages.length - 2];
      if (userActivitiesMessage && userActivitiesMessage.role === 'user') {
        setProfileData(prev => ({ ...prev, currentActivities: userActivitiesMessage.content }));
      }
    }
  }, [messages, isProfileSetup, profileData]);
  
  const handleSendMessage = () => {
    if (inputValue.trim() && !isSending) {
      sendMessage(inputValue.trim());
      setInputValue('');
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  const handleSaveProfile = () => {
    if (profileData.hobbies || profileData.interests || profileData.currentActivities) {
      updateProfileFromAI({
        hobbies: profileData.hobbies || undefined,
        interests: profileData.interests || undefined,
        currentActivities: profileData.currentActivities || undefined,
      });
      setShowSuccessAlert(true);
      
      // Auto-redirect after a delay
      setTimeout(() => {
        setLocation('/profile');
      }, 3000);
    }
  };
  
  const handleBack = () => {
    setLocation('/profile');
  };
  
  // Determine if we have enough data to save the profile
  const canSaveProfile = isProfileSetup && 
    (profileData.hobbies !== null || profileData.interests !== null || profileData.currentActivities !== null);
  
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow container max-w-3xl py-6 px-4 mx-auto flex flex-col">
        <div className="flex items-center mb-4">
          {isProfileSetup && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="mr-2"
              onClick={handleBack}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          )}
          <Bot className="h-6 w-6 mr-2 text-primary" />
          <h1 className="text-3xl font-bold">
            {isProfileSetup ? 'AI Profile Setup' : 'AI Assistant'}
          </h1>
          
          {isProfileSetup && canSaveProfile && (
            <Button
              variant="default"
              size="sm"
              className="ml-auto"
              onClick={handleSaveProfile}
              disabled={isProfileUpdating}
            >
              {isProfileUpdating ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              Save Profile
            </Button>
          )}
        </div>
        
        {isProfileSetup && (
          <div className="mb-4">
            <p className="text-sm text-muted-foreground">
              Chat with our AI assistant to set up your profile. It will ask about your hobbies, interests, and current activities.
            </p>
          </div>
        )}
        
        {showSuccessAlert && (
          <Alert className="mb-4 bg-green-50 border-green-200">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800">Profile updated successfully!</AlertTitle>
            <AlertDescription className="text-green-700">
              Your profile has been updated with your preferences. Redirecting to your profile page...
            </AlertDescription>
          </Alert>
        )}
        
        <div className="flex-grow overflow-hidden flex flex-col">
          <div className="flex-grow overflow-y-auto mb-4 p-4 border rounded-lg bg-background">
            {isInitializing ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-center">
                <div>
                  <Bot className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Start a conversation with your AI assistant</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message, index) => (
                  <MessageBubble key={index} message={message} />
                ))}
                {isSending && (
                  <div className="flex items-center justify-start mt-2">
                    <div className="bg-muted rounded-lg p-3">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          
          <div className="flex gap-2">
            <Textarea
              placeholder={isProfileSetup ? "Tell the AI about yourself..." : "Ask me anything..."}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-grow min-h-[60px] max-h-[120px]"
              disabled={isInitializing || isSending || showSuccessAlert}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isInitializing || isSending || showSuccessAlert}
              className="h-[60px] w-[60px] rounded-full p-0 flex-shrink-0"
            >
              {isSending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>
          
          {isProfileSetup && (
            <div className="mt-4 space-y-2">
              <h3 className="text-sm font-medium">Information collected so far:</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div className="p-2 border rounded">
                  <p className="text-xs text-muted-foreground">Hobbies</p>
                  <p className="text-sm">{profileData.hobbies || "Not yet provided"}</p>
                </div>
                <div className="p-2 border rounded">
                  <p className="text-xs text-muted-foreground">Interests</p>
                  <p className="text-sm">{profileData.interests || "Not yet provided"}</p>
                </div>
                <div className="p-2 border rounded">
                  <p className="text-xs text-muted-foreground">Current Activities</p>
                  <p className="text-sm">{profileData.currentActivities || "Not yet provided"}</p>
                </div>
              </div>
            </div>
          )}
          
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Powered by Claude AI from Anthropic
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}