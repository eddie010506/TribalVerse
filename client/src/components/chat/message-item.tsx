import { MessageWithUser } from '@shared/schema';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/use-auth';
import { Link } from 'wouter';

interface MessageItemProps {
  message: MessageWithUser;
}

export function MessageItem({ message }: MessageItemProps) {
  const { user } = useAuth();
  const isCurrentUser = user?.id === message.user.id;
  
  // Format date
  const formattedTime = message.createdAt instanceof Date
    ? format(message.createdAt, 'h:mm a')
    : 'Unknown time';
  
  return (
    <div className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`flex ${isCurrentUser ? 'flex-row-reverse' : 'flex-row'} max-w-[80%]`}>
        <Avatar className="h-8 w-8 mt-1">
          <AvatarFallback className={isCurrentUser ? 'bg-primary text-white' : 'bg-gray-300'}>
            {message.user.username.substring(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        
        <div className={`mx-2 ${isCurrentUser ? 'text-right' : 'text-left'}`}>
          <Card className={`p-3 inline-block ${isCurrentUser ? 'bg-primary text-white' : 'bg-gray-100'}`}>
            <div className="text-sm mb-1">
              {message.content}
            </div>
            
            {message.imageUrl && (
              <div className="mt-2">
                <img 
                  src={message.imageUrl} 
                  alt="Shared image" 
                  className="max-w-full rounded-md max-h-64 object-contain"
                />
              </div>
            )}
          </Card>
          
          <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
            <span>{message.user.username}</span>
            <span>•</span>
            <span>{formattedTime}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
