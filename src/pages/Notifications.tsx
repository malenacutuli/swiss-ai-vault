import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Bell, BellRing, Check } from "@/icons";
import { useState } from "react";
import {
  useNotifications,
  useMarkAsRead,
  useMarkAllAsRead,
  type Notification as NotificationType,
} from "@/hooks/useNotifications";
import { formatDistanceToNow, isToday, isYesterday, parseISO } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

function groupNotificationsByDate(notifications: NotificationType[]) {
  const groups: { label: string; notifications: NotificationType[] }[] = [];
  const today: NotificationType[] = [];
  const yesterday: NotificationType[] = [];
  const older: NotificationType[] = [];

  notifications.forEach((n) => {
    const date = parseISO(n.created_at);
    if (isToday(date)) {
      today.push(n);
    } else if (isYesterday(date)) {
      yesterday.push(n);
    } else {
      older.push(n);
    }
  });

  if (today.length > 0) groups.push({ label: "Today", notifications: today });
  if (yesterday.length > 0) groups.push({ label: "Yesterday", notifications: yesterday });
  if (older.length > 0) groups.push({ label: "Older", notifications: older });

  return groups;
}

const Notifications = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { data: notifications, isLoading } = useNotifications();
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();

  const handleEnableBrowserNotifications = async () => {
    if ("Notification" in window) {
      const permission = await window.Notification.requestPermission();
      if (permission === "granted") {
        new window.Notification("Notifications enabled!", {
          body: "You will now receive browser notifications.",
        });
      }
    }
  };

  const groups = notifications ? groupNotificationsByDate(notifications) : [];
  const hasUnread = notifications?.some((n) => !n.is_read);

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full bg-background">
        <DashboardSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
        <SidebarInset className="flex-1">
          <DashboardHeader sidebarCollapsed={sidebarCollapsed} />
          <main className="flex-1 p-6">
            <div className="max-w-3xl mx-auto">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
                  <Bell className="h-6 w-6" />
                  Notifications
                </h1>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    onClick={handleEnableBrowserNotifications}
                    className="gap-2"
                  >
                    <BellRing className="h-4 w-4" />
                    Enable Browser Notifications
                  </Button>
                  {hasUnread && (
                    <Button
                      variant="outline"
                      onClick={() => markAllAsRead.mutate()}
                      disabled={markAllAsRead.isPending}
                      className="gap-2"
                    >
                      <Check className="h-4 w-4" />
                      Mark all as read
                    </Button>
                  )}
                </div>
              </div>

              {/* Notifications List */}
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : groups.length === 0 ? (
                <Card className="p-8 text-center">
                  <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">
                    No notifications yet
                  </h3>
                  <p className="text-muted-foreground">
                    You'll see notifications here when there's activity on your account.
                  </p>
                </Card>
              ) : (
                <div className="space-y-6">
                  {groups.map((group) => (
                    <div key={group.label}>
                      <h2 className="text-sm font-medium text-muted-foreground mb-3">
                        {group.label}
                      </h2>
                      <div className="space-y-2">
                        {group.notifications.map((notification) => (
                          <NotificationItem
                            key={notification.id}
                            notification={notification}
                            onMarkAsRead={() => markAsRead.mutate(notification.id)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

function NotificationItem({
  notification,
  onMarkAsRead,
}: {
  notification: NotificationType;
  onMarkAsRead: () => void;
}) {
  const timeAgo = formatDistanceToNow(parseISO(notification.created_at), {
    addSuffix: false,
  });

  return (
    <Card
      className={`p-4 transition-colors ${
        !notification.is_read ? "bg-primary/5 border-primary/20" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Unread indicator */}
        <div className="pt-1">
          {!notification.is_read && (
            <span className="block h-2 w-2 rounded-full bg-primary" />
          )}
          {notification.is_read && <span className="block h-2 w-2" />}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-medium text-foreground">{notification.title}</h3>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {timeAgo} ago
            </span>
          </div>
          {notification.message && (
            <p className="text-sm text-muted-foreground mt-1">
              {notification.message}
            </p>
          )}
          {!notification.is_read && (
            <button
              onClick={onMarkAsRead}
              className="text-xs text-primary hover:underline mt-2"
            >
              Mark as read
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}

export default Notifications;
