import { Bell } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNotifications } from "@/hooks/use-notifications";
import { NotificationList } from "../notifications/notification-list";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const {
    notifications,
    unreadCount,
    isLoading,
    notificationsOpen,
    toggleNotifications,
    markAllAsRead,
  } = useNotifications();

  return (
    <Popover open={notificationsOpen} onOpenChange={toggleNotifications}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              className={cn(
                "absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center rounded-full",
                unreadCount > 0 ? "bg-red-500" : "bg-primary"
              )}
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-medium">Notifications</h3>
          {notifications.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllAsRead()}
              className="text-xs"
            >
              Mark all as read
            </Button>
          )}
        </div>
        <NotificationList
          notifications={notifications}
          isLoading={isLoading}
        />
      </PopoverContent>
    </Popover>
  );
}