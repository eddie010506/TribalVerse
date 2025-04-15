import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { MessageWithUser } from '@shared/schema';
import { queryClient } from '@/lib/queryClient';

type WebSocketMessage = {
  type: 'auth' | 'message' | 'new_message' | 'refresh_notifications' | 'error';
  roomId?: number;
  content?: string;
  imageUrl?: string;
  message?: MessageWithUser;
  error?: string;
};

export function useWebSocket(roomId?: number) {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<MessageWithUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  // Initialize WebSocket connection
  useEffect(() => {
    if (!user) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setConnected(true);
      setError(null);
      
      // Send authentication message
      ws.send(JSON.stringify({
        type: 'auth',
        userId: user.id,
        username: user.username
      }));
    };

    ws.onclose = () => {
      setConnected(false);
    };

    ws.onerror = (e) => {
      setError('WebSocket connection error');
      setConnected(false);
    };

    ws.onmessage = (event) => {
      try {
        const data: WebSocketMessage = JSON.parse(event.data);
        
        if (data.type === 'new_message' && data.message && data.roomId === roomId) {
          setMessages(prev => [...prev, data.message!]);
        } else if (data.type === 'refresh_notifications') {
          // Refresh notifications
          queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
          queryClient.invalidateQueries({ queryKey: ['/api/notifications/count'] });
        } else if (data.type === 'error') {
          setError(data.error || 'An error occurred');
        }
      } catch (e) {
        console.error('Error parsing WebSocket message:', e);
      }
    };

    setSocket(ws);

    // Clean up on unmount
    return () => {
      ws.close();
    };
  }, [user, roomId]);

  // Function to send chat message
  const sendMessage = useCallback((content: string, imageUrl?: string) => {
    if (!socket || !connected || !roomId) {
      setError('Cannot send message: not connected');
      return false;
    }

    try {
      socket.send(JSON.stringify({
        type: 'message',
        roomId,
        content,
        imageUrl
      }));
      return true;
    } catch (e) {
      setError('Failed to send message');
      return false;
    }
  }, [socket, connected, roomId]);

  return { 
    connected, 
    messages, 
    sendMessage, 
    error, 
    setMessages 
  };
}
