import { User } from "@shared/schema";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { Link } from "wouter";

interface FollowListProps {
  users: Partial<User>[];
  isLoading: boolean;
  emptyMessage: string;
  title: string;
}

export function FollowList({
  users,
  isLoading,
  emptyMessage,
  title,
}: FollowListProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center my-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">{title}</h3>
      
      {users.length === 0 ? (
        <Card className="p-6 text-center text-muted-foreground">
          {emptyMessage}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {users.map((user) => (
            <Card key={user.id} className="p-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage
                    src={user.profilePicture || undefined}
                    alt={user.username || "User"}
                  />
                  <AvatarFallback>
                    {user.username?.substring(0, 2).toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <Link href={`/user/${user.id}`}>
                  <span className="font-medium hover:underline cursor-pointer">
                    {user.username}
                  </span>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}