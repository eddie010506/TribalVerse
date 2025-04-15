import { useState, useCallback } from 'react';
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
  const [isInitializing, setIsInitializing] = useState(true);
  const [customSystemInstruction, setCustomSystemInstruction] = useState<string | null>(null);
  const { toast } = useToast();

  // Initialize AI conversation
  const initAI = useCallback(async (systemInstruction?: string) => {
    setIsInitializing(true);
    
    try {
      const endpoint = systemInstruction 
        ? '/api/ai/initialize-custom' 
        : '/api/ai/initialize';
      
      const response = await apiRequest(
        systemInstruction ? 'POST' : 'GET', 
        endpoint, 
        systemInstruction ? { systemInstruction } : undefined
      );
      
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
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to initialize AI conversation: ${(error as Error).message}`,
        variant: 'destructive',
      });
      throw error;
    } finally {
      setIsInitializing(false);
    }
  }, [toast]);

  // Automatic initialization if no custom system instruction
  const {
    data: initData,
    isLoading: isAutoInitializing,
    isError: isInitError,
    error: initError,
  } = useQuery({
    queryKey: ['/api/ai/initialize'],
    queryFn: async () => {
      // Skip auto-initialization if we're using custom instructions
      if (customSystemInstruction !== null) {
        return null;
      }
      return await initAI();
    },
    // Don't refetch on window focus
    refetchOnWindowFocus: false,
    enabled: customSystemInstruction === null,
  });

  // Manual initialization with custom system instruction
  const initialize = useCallback(async (systemInstruction: string) => {
    setCustomSystemInstruction(systemInstruction);
    return await initAI(systemInstruction);
  }, [initAI]);

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
        systemInstruction: customSystemInstruction,
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
    isInitializing: isInitializing || isAutoInitializing,
    isInitError,
    initError,
    sendMessage: (message: string) => sendMessageMutation.mutate(message),
    isSending: sendMessageMutation.isPending,
    initialize,
  };
}