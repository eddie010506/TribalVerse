import { useState } from 'react';
import { Send, Loader2, Bot } from 'lucide-react';
import { format } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAIChat, type Message } from '@/hooks/use-ai-chat';
import { useAuth } from '@/hooks/use-auth';
import { Header } from '../components/layout/header';
import { Footer } from '../components/layout/footer';

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
  const { messages, isInitializing, sendMessage, isSending } = useAIChat();
  const { user } = useAuth();
  
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
  
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow container max-w-3xl py-6 px-4 mx-auto flex flex-col">
        <div className="flex items-center mb-6">
          <Bot className="h-6 w-6 mr-2 text-primary" />
          <h1 className="text-3xl font-bold">AI Assistant</h1>
        </div>
        
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
              placeholder="Ask me anything..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-grow min-h-[60px] max-h-[120px]"
              disabled={isInitializing || isSending}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isInitializing || isSending}
              className="h-[60px] w-[60px] rounded-full p-0 flex-shrink-0"
            >
              {isSending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>
          
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Powered by Claude AI from Anthropic
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}