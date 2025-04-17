import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Send, User, Bot, CheckCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAIProfileSetup } from '@/hooks/use-ai-profile-setup';
import { Dialog, DialogContent } from '@/components/ui/dialog';

interface ProfileSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfileSetupDialog({ open, onOpenChange }: ProfileSetupDialogProps) {
  const [inputValue, setInputValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const { 
    messages, 
    isLoading, 
    setupComplete,
    isSubmittingProfile,
    initializeConversation, 
    sendMessage,
    analyzeAndUpdateProfile
  } = useAIProfileSetup();

  useEffect(() => {
    if (open && messages.length === 0) {
      initializeConversation();
    }
  }, [open, messages.length, initializeConversation]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input after loading
  useEffect(() => {
    if (!isLoading && inputRef.current && messages.length > 0) {
      inputRef.current.focus();
    }
  }, [isLoading, messages.length]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !isLoading) {
      sendMessage(inputValue);
      setInputValue('');
    }
  };

  const handleFinish = () => {
    analyzeAndUpdateProfile();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-0 gap-0 h-[80vh] max-h-[700px] flex flex-col">
        <Card className="border-0 flex flex-col h-full">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              AI Profile Setup Assistant
            </CardTitle>
            <CardDescription>
              Chat with the AI to set up your profile. It will help you identify your hobbies, interests, and current activities.
            </CardDescription>
          </CardHeader>
          
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            <CardContent className="px-2 pt-0 pb-3 space-y-4">
              {messages.length === 0 && isLoading && (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              )}
              
              {messages.map((msg, i) => (
                <div 
                  key={i} 
                  className={`flex items-start gap-3 ${
                    msg.role === 'assistant' ? 'justify-start' : 'justify-end'
                  }`}
                >
                  {msg.role === 'assistant' && (
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary/10 text-primary">AI</AvatarFallback>
                      <AvatarImage src="/ai-avatar.png" />
                    </Avatar>
                  )}
                  
                  <div 
                    className={`rounded-lg px-4 py-2 max-w-[80%] ${
                      msg.role === 'assistant'
                        ? 'bg-muted text-foreground'
                        : 'bg-primary text-primary-foreground'
                    }`}
                  >
                    {msg.content}
                  </div>
                  
                  {msg.role === 'user' && (
                    <Avatar className="h-8 w-8">
                      <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                      <AvatarImage src="/user-avatar.png" />
                    </Avatar>
                  )}
                </div>
              ))}
              
              {isLoading && messages.length > 0 && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>AI is typing...</span>
                </div>
              )}
            </CardContent>
          </ScrollArea>
          
          <CardFooter className="pt-4 border-t flex flex-col gap-3">
            {!setupComplete ? (
              <>
                <form onSubmit={handleSubmit} className="flex w-full gap-2">
                  <Input
                    placeholder="Type your message..."
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    disabled={isLoading || isSubmittingProfile}
                    ref={inputRef}
                    className="flex-1"
                  />
                  <Button 
                    type="submit" 
                    size="icon" 
                    disabled={!inputValue.trim() || isLoading || isSubmittingProfile}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
                
                <div className="flex justify-between items-center w-full">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => onOpenChange(false)}
                    disabled={isSubmittingProfile}
                  >
                    Skip for now
                  </Button>
                  
                  <Button 
                    size="sm"
                    onClick={handleFinish}
                    disabled={messages.length < 3 || isLoading || isSubmittingProfile}
                    className="gap-2"
                  >
                    {isSubmittingProfile ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4" />
                    )}
                    {isSubmittingProfile ? 'Updating profile...' : 'Generate profile'}
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center py-4 text-green-600 font-medium flex items-center justify-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Profile updated successfully!
              </div>
            )}
          </CardFooter>
        </Card>
      </DialogContent>
    </Dialog>
  );
}