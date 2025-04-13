import { MessageWithUser } from '@shared/schema';
import { MessageItem } from './message-item';
import { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';

interface MessageListProps {
  messages: MessageWithUser[];
  isLoading: boolean;
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (messages.length === 0) {
    return (
      <div className="text-center py-10 text-gray-500">
        <p>No messages yet. Be the first to say hello!</p>
      </div>
    );
  }
  
  return (
    <div className="flex-1 overflow-y-auto p-4">
      {messages.map((message) => (
        <MessageItem key={message.id} message={message} />
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
}
