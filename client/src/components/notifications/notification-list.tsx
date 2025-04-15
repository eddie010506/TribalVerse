import { Notification } from "@shared/schema";
import { Loader2, User, MessageSquare, Heart, Bell } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { useNotifications } from "@/hooks/use-notifications";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

interface NotificationListProps {
  notifications: Notification[];
  isLoading: boolean;
}

export function NotificationList({ notifications, isLoading }: NotificationListProps) {
  const { markAsRead } = useNotifications();
  const [, navigate] = useLocation();

  if (isLoading) {
    return (
      <div className="p-4 h-80 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p>No notifications yet</p>
      </div>
    );
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "follow":
        return <User className="h-4 w-4 text-blue-500" />;
      case "message":
        return <MessageSquare className="h-4 w-4 text-green-500" />;
      case "like":
        return <Heart className="h-4 w-4 text-red-500" />;
      default:
        return <Bell className="h-4 w-4 text-primary" />;
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    
    // Navigate based on notification type
    if (notification.entityType === "message" && notification.entityId) {
      navigate(`/rooms/${notification.entityId}`);
    } else if (notification.entityType === "user" && notification.entityId) {
      navigate(`/users/${notification.entityId}`);
    }
  };

  return (
    <ScrollArea className="h-[400px]">
      <div className="divide-y">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`p-4 hover:bg-muted cursor-pointer ${
              !notification.isRead ? "bg-muted/50" : ""
            }`}
            onClick={() => handleNotificationClick(notification)}
          >
            <div className="flex gap-3">
              <div className="mt-0.5">
                {getNotificationIcon(notification.type)}
              </div>
              <div className="flex-1">
                <p className="text-sm">{notification.message}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {notification.createdAt 
                    ? format(new Date(notification.createdAt), "MMM d, yyyy 'at' h:mm a") 
                    : "Just now"}
                </p>
              </div>
              {!notification.isRead && (
                <div className="w-2 h-2 rounded-full bg-primary mt-1" />
              )}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}