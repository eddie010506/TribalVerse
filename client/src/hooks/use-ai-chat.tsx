import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export type Message = {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
};

export function useAIChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const { toast } = useToast();

  // Initialize AI conversation
  const {
    data: initData,
    isLoading: isInitializing,
    isError: isInitError,
    error: initError,
  } = useQuery({
    queryKey: ['/api/ai/initialize'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/ai/initialize');
      const data = await response.json();
      
      // Add the AI's introduction as the first message
      if (data.introduction) {
        setMessages([{
          role: 'assistant',
          content: data.introduction,
          timestamp: new Date(),
        }]);
      }
      
      return data;
    },
    // Don't refetch on window focus
    refetchOnWindowFocus: false,
  });

  // Send message to AI and get response
  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      // Optimistically update UI with user message
      const userMessage: Message = {
        role: 'user',
        content: message,
        timestamp: new Date(),
      };
      
      // Add the current messages to state
      setMessages(prev => [...prev, userMessage]);
      
      // Send the message to the API
      const response = await apiRequest('POST', '/api/ai/chat', {
        message,
        conversationHistory: messages,
      });
      
      return await response.json();
    },
    onSuccess: (data) => {
      // Add AI response to messages
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to get response from AI: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  return {
    messages,
    isInitializing,
    isInitError,
    initError,
    sendMessage: (message: string) => sendMessageMutation.mutate(message),
    isSending: sendMessageMutation.isPending,
  };
}