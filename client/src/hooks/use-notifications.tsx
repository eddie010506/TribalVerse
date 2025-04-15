import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Notification } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

export function useNotifications() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const userId = user?.id;

  const {
    data: notifications = [],
    isLoading,
    error,
  } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    enabled: !!userId,
  });

  const { data: unreadCount = 0 } = useQuery<number>({
    queryKey: ["/api/notifications/unread-count"],
    enabled: !!userId,
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: number) => {
      const res = await apiRequest("POST", `/api/notifications/${notificationId}/mark-read`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to mark notification as read: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/notifications/mark-all-read");
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to mark all notifications as read: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const toggleNotifications = () => {
    setNotificationsOpen(!notificationsOpen);
  };

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    notificationsOpen,
    toggleNotifications,
    markAsRead: markAsReadMutation.mutate,
    markAllAsRead: markAllAsReadMutation.mutate,
  };
}