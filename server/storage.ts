import { users, chatRooms, messages, follows, friendRequests, notifications } from "@shared/schema";
import type { 
  User, InsertUser, ChatRoom, InsertChatRoom, Message, InsertMessage, MessageWithUser,
  Follow, InsertFollow, FriendRequest, InsertFriendRequest, Notification, InsertNotification
} from "@shared/schema";
import session from "express-session";
import { db } from "./db";
import { eq, desc, count, and } from "drizzle-orm";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./db";

const PostgresStore = connectPgSimple(session);

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserProfile(userId: number, updates: Partial<Pick<User, 'hobbies' | 'interests' | 'currentActivities' | 'profilePicture'>>): Promise<User | undefined>;
  setVerificationToken(userId: number, token: string): Promise<boolean>;
  verifyEmail(token: string): Promise<User | undefined>;
  
  // Chat room methods
  getChatRooms(): Promise<ChatRoom[]>;
  getChatRoom(id: number): Promise<ChatRoom | undefined>;
  createChatRoom(room: InsertChatRoom): Promise<ChatRoom>;
  
  // Message methods
  getMessagesByRoomId(roomId: number): Promise<MessageWithUser[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  
  // Friend request methods
  getFriendRequests(userId: number): Promise<FriendRequest[]>;
  getSentFriendRequests(userId: number): Promise<FriendRequest[]>;
  getReceivedFriendRequests(userId: number): Promise<FriendRequest[]>;
  createFriendRequest(request: InsertFriendRequest): Promise<FriendRequest>;
  respondToFriendRequest(requestId: number, status: 'accepted' | 'rejected'): Promise<FriendRequest | undefined>;
  
  // Follow methods
  getFollowers(userId: number): Promise<Partial<User>[]>;
  getFollowing(userId: number): Promise<Partial<User>[]>;
  followUser(followerId: number, followingId: number): Promise<Follow | undefined>;
  unfollowUser(followerId: number, followingId: number): Promise<boolean>;
  isFollowing(followerId: number, followingId: number): Promise<boolean>;
  
  // Notification methods
  getNotifications(userId: number): Promise<Notification[]>;
  getUnreadNotificationCount(userId: number): Promise<number>;
  markNotificationAsRead(notificationId: number): Promise<boolean>;
  markAllNotificationsAsRead(userId: number): Promise<boolean>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  
  // Session store
  sessionStore: any;
}

export class DatabaseStorage implements IStorage {
  sessionStore: any;

  constructor() {
    this.sessionStore = new PostgresStore({
      pool,
      createTableIfMissing: true,
    });
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username));
    return user;
  }
  
  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }
  
  async setVerificationToken(userId: number, token: string): Promise<boolean> {
    try {
      await db
        .update(users)
        .set({ verificationToken: token })
        .where(eq(users.id, userId));
      return true;
    } catch (error) {
      console.error("Error setting verification token:", error);
      return false;
    }
  }
  
  async verifyEmail(token: string): Promise<User | undefined> {
    // Find user by token
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.verificationToken, token));
    
    if (!user) {
      return undefined;
    }
    
    // Update user to verified status
    const [updatedUser] = await db
      .update(users)
      .set({ 
        emailVerified: true,
        verificationToken: null 
      })
      .where(eq(users.id, user.id))
      .returning();
      
    return updatedUser;
  }

  async updateUserProfile(userId: number, updates: Partial<Pick<User, 'hobbies' | 'interests' | 'currentActivities' | 'email' | 'emailVerified' | 'verificationToken' | 'profilePicture'>>): Promise<User | undefined> {
    // Check if user exists first
    const existingUser = await this.getUser(userId);
    if (!existingUser) {
      return undefined;
    }

    // Update user profile
    const [updatedUser] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, userId))
      .returning();
    
    return updatedUser;
  }

  // Chat room methods
  async getChatRooms(): Promise<ChatRoom[]> {
    return await db.select().from(chatRooms);
  }

  async getChatRoom(id: number): Promise<ChatRoom | undefined> {
    const [room] = await db
      .select()
      .from(chatRooms)
      .where(eq(chatRooms.id, id));
    return room;
  }

  async createChatRoom(insertRoom: InsertChatRoom): Promise<ChatRoom> {
    const [room] = await db
      .insert(chatRooms)
      .values(insertRoom)
      .returning();
    return room;
  }

  // Message methods
  async getMessagesByRoomId(roomId: number): Promise<MessageWithUser[]> {
    // Get messages for the room
    const messagesData = await db
      .select()
      .from(messages)
      .where(eq(messages.roomId, roomId))
      .orderBy(messages.createdAt);

    // Enrich with user data
    const messageWithUsers = await Promise.all(
      messagesData.map(async (message) => {
        const [user] = await db
          .select({ 
            id: users.id, 
            username: users.username,
            profilePicture: users.profilePicture
          })
          .from(users)
          .where(eq(users.id, message.userId));

        return {
          ...message,
          user: {
            id: user?.id || 0,
            username: user?.username || "Unknown User",
            profilePicture: user?.profilePicture || null
          },
        };
      })
    );

    return messageWithUsers;
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const [message] = await db
      .insert(messages)
      .values(insertMessage)
      .returning();
    return message;
  }

  // Friend request methods
  async getFriendRequests(userId: number): Promise<FriendRequest[]> {
    const sentRequests = await this.getSentFriendRequests(userId);
    const receivedRequests = await this.getReceivedFriendRequests(userId);
    return [...sentRequests, ...receivedRequests];
  }

  async getSentFriendRequests(userId: number): Promise<FriendRequest[]> {
    return await db
      .select()
      .from(friendRequests)
      .where(eq(friendRequests.senderId, userId));
  }

  async getReceivedFriendRequests(userId: number): Promise<FriendRequest[]> {
    return await db
      .select()
      .from(friendRequests)
      .where(eq(friendRequests.receiverId, userId));
  }

  async createFriendRequest(request: InsertFriendRequest): Promise<FriendRequest> {
    // Check if request already exists
    const existingRequests = await db
      .select()
      .from(friendRequests)
      .where(eq(friendRequests.senderId, request.senderId));
      
    const existingRequest = existingRequests.find(r => r.receiverId === request.receiverId);
    if (existingRequest) {
      return existingRequest;
    }

    const [newRequest] = await db
      .insert(friendRequests)
      .values(request)
      .returning();
    
    // Create notification for the receiver
    const userResults = await db
      .select({ id: users.id, username: users.username })
      .from(users)
      .where(eq(users.id, request.senderId));
    
    const sender = userResults[0];
    if (sender) {
      await this.createNotification({
        userId: request.receiverId,
        type: 'friend_request',
        actorId: request.senderId,
        entityId: newRequest.id,
        entityType: 'friend_request',
        message: `${sender.username} sent you a friend request.`,
      });
    }
    
    return newRequest;
  }

  async respondToFriendRequest(requestId: number, status: 'accepted' | 'rejected'): Promise<FriendRequest | undefined> {
    const [request] = await db
      .select()
      .from(friendRequests)
      .where(eq(friendRequests.id, requestId));

    if (!request) {
      return undefined;
    }

    const [updatedRequest] = await db
      .update(friendRequests)
      .set({ 
        status,
        updatedAt: new Date(),
      })
      .where(eq(friendRequests.id, requestId))
      .returning();
    
    // Create notification for the sender
    const [receiver] = await db
      .select({ id: users.id, username: users.username })
      .from(users)
      .where(eq(users.id, request.receiverId));
    
    if (receiver) {
      await this.createNotification({
        userId: request.senderId,
        type: 'friend_request_response',
        actorId: request.receiverId,
        entityId: requestId,
        entityType: 'friend_request',
        message: `${receiver.username} ${status} your friend request.`,
      });
    }
    
    return updatedRequest;
  }

  // Follow methods
  async getFollowers(userId: number): Promise<Partial<User>[]> {
    const result = await db
      .select({
        id: users.id,
        username: users.username,
        profilePicture: users.profilePicture,
        email: users.email,
        emailVerified: users.emailVerified,
      })
      .from(follows)
      .innerJoin(users, eq(follows.followerId, users.id))
      .where(eq(follows.followingId, userId));
    
    return result;
  }

  async getFollowing(userId: number): Promise<Partial<User>[]> {
    const result = await db
      .select({
        id: users.id,
        username: users.username,
        profilePicture: users.profilePicture,
        email: users.email,
        emailVerified: users.emailVerified,
      })
      .from(follows)
      .innerJoin(users, eq(follows.followingId, users.id))
      .where(eq(follows.followerId, userId));
    
    return result;
  }

  async followUser(followerId: number, followingId: number): Promise<Follow | undefined> {
    // Don't allow following yourself
    if (followerId === followingId) {
      return undefined;
    }

    // Check if already following
    const isAlreadyFollowing = await this.isFollowing(followerId, followingId);
    if (isAlreadyFollowing) {
      return undefined;
    }

    const [follow] = await db
      .insert(follows)
      .values({
        followerId,
        followingId,
      })
      .returning();
    
    // Create notification for the followed user
    const [follower] = await db
      .select({ id: users.id, username: users.username })
      .from(users)
      .where(eq(users.id, followerId));
    
    if (follower) {
      await this.createNotification({
        userId: followingId,
        type: 'follow',
        actorId: followerId,
        entityId: followerId,
        entityType: 'user',
        message: `${follower.username} started following you.`,
      });
    }
    
    return follow;
  }

  async unfollowUser(followerId: number, followingId: number): Promise<boolean> {
    try {
      await pool.query(`
        DELETE FROM follows 
        WHERE "followerId" = $1 AND "followingId" = $2
      `, [followerId, followingId]);
      
      return true;
    } catch (error) {
      console.error("Error unfollowing user:", error);
      return false;
    }
  }

  async isFollowing(followerId: number, followingId: number): Promise<boolean> {
    try {
      const result = await pool.query(`
        SELECT * FROM follows 
        WHERE follower_id = $1 AND following_id = $2
        LIMIT 1
      `, [followerId, followingId]);
      
      return result.rows.length > 0;
    } catch (error) {
      console.error("Error checking if following:", error);
      return false;
    }
  }

  // Notification methods
  async getNotifications(userId: number): Promise<Notification[]> {
    return await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));
  }

  async getUnreadNotificationCount(userId: number): Promise<number> {
    try {
      const result = await pool.query(`
        SELECT COUNT(*) as count FROM notifications 
        WHERE user_id = $1 AND is_read = false
      `, [userId]);

      return parseInt(result.rows[0]?.count || '0');
    } catch (error) {
      console.error("Error getting unread notification count:", error);
      return 0;
    }
  }

  async markNotificationAsRead(notificationId: number): Promise<boolean> {
    try {
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(eq(notifications.id, notificationId));
      
      return true;
    } catch (error) {
      console.error("Error marking notification as read:", error);
      return false;
    }
  }

  async markAllNotificationsAsRead(userId: number): Promise<boolean> {
    try {
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(eq(notifications.userId, userId));
      
      return true;
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      return false;
    }
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [newNotification] = await db
      .insert(notifications)
      .values(notification)
      .returning();
    
    return newNotification;
  }
}

export const storage = new DatabaseStorage();
