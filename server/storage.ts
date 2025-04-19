import { users, chatRooms, messages, follows, friendRequests, notifications, roomInvitations, posts, comments, postLikes, userRecommendations, placeRecommendations } from "@shared/schema";
import type { 
  User, InsertUser, ChatRoom, InsertChatRoom, Message, InsertMessage, MessageWithUser,
  Follow, InsertFollow, FriendRequest, InsertFriendRequest, Notification, InsertNotification,
  RoomInvitation, InsertRoomInvitation, Post, InsertPost, PostWithUser,
  Comment, InsertComment, CommentWithUser, PostLike, InsertPostLike,
  UserRecommendation, InsertUserRecommendation, PlaceRecommendation, InsertPlaceRecommendation
} from "@shared/schema";
import session from "express-session";
import { db } from "./db";
import { eq, ne, desc, count, and, gt, lt } from "drizzle-orm";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./db";

const PostgresStore = connectPgSimple(session);

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getAllUsersExcept(userId: number): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUserProfile(userId: number, updates: Partial<Pick<User, 'hobbies' | 'interests' | 'currentActivities' | 'profilePicture'>>): Promise<User | undefined>;
  setVerificationToken(userId: number, token: string): Promise<boolean>;
  verifyEmail(token: string): Promise<User | undefined>;
  
  // Chat room methods
  getChatRooms(): Promise<ChatRoom[]>;
  getChatRoom(id: number): Promise<ChatRoom | undefined>;
  createChatRoom(room: InsertChatRoom): Promise<ChatRoom>;
  deleteChatRoom(id: number, userId: number): Promise<boolean>;
  
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
  
  // Room invitation methods
  getSentRoomInvitations(userId: number): Promise<RoomInvitation[]>;
  getReceivedRoomInvitations(userId: number): Promise<RoomInvitation[]>;
  createRoomInvitation(invitation: InsertRoomInvitation): Promise<RoomInvitation>;
  respondToRoomInvitation(invitationId: number, status: 'accepted' | 'declined'): Promise<RoomInvitation | undefined>;
  
  // Post methods
  getPosts(currentUserId: number): Promise<PostWithUser[]>;
  getPostsByUser(userId: number, currentUserId: number): Promise<PostWithUser[]>;
  createPost(post: InsertPost): Promise<Post>;
  deletePost(postId: number, userId: number): Promise<boolean>;
  
  // Comment methods
  getPostComments(postId: number): Promise<CommentWithUser[]>;
  createComment(comment: InsertComment): Promise<Comment>;
  deleteComment(commentId: number, userId: number): Promise<boolean>;
  
  // Like methods
  likePost(userId: number, postId: number): Promise<PostLike | undefined>;
  unlikePost(userId: number, postId: number): Promise<boolean>;
  isPostLikedByUser(userId: number, postId: number): Promise<boolean>;
  getPostLikes(postId: number): Promise<number>;
  
  // Recommendation methods
  getSimilarUserRecommendations(userId: number): Promise<UserRecommendation[]>;
  createUserRecommendation(recommendation: InsertUserRecommendation): Promise<UserRecommendation>;
  clearExpiredUserRecommendations(): Promise<void>;
  getPlaceRecommendations(roomId: number): Promise<PlaceRecommendation[]>;
  createPlaceRecommendation(recommendation: InsertPlaceRecommendation): Promise<PlaceRecommendation>;
  clearExpiredPlaceRecommendations(): Promise<void>;
  
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
  
  async getAllUsersExcept(userId: number): Promise<User[]> {
    try {
      const result = await pool.query(`
        SELECT * FROM users 
        WHERE id != $1
      `, [userId]);
      
      return result.rows;
    } catch (error) {
      console.error("Error getting all users except:", error);
      return [];
    }
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

  async updateUserProfile(userId: number, updates: Partial<Pick<User, 'hobbies' | 'interests' | 'currentActivities' | 'email' | 'emailVerified' | 'verificationToken' | 'profilePicture' | 'favoriteFood'>>): Promise<User | undefined> {
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
  
  async deleteChatRoom(id: number, userId: number): Promise<boolean> {
    try {
      // First verify that the user is the creator of the room
      const room = await this.getChatRoom(id);
      if (!room || room.creatorId !== userId) {
        return false;
      }
      
      // Delete all messages in the room first
      await db
        .delete(messages)
        .where(eq(messages.roomId, id));
      
      // Delete all room invitations
      await db
        .delete(roomInvitations)
        .where(eq(roomInvitations.roomId, id));
      
      // Delete the room
      await db
        .delete(chatRooms)
        .where(eq(chatRooms.id, id));
      
      return true;
    } catch (error) {
      console.error("Error deleting chat room:", error);
      return false;
    }
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

  // Room invitation methods
  async getSentRoomInvitations(userId: number): Promise<RoomInvitation[]> {
    return await db
      .select()
      .from(roomInvitations)
      .where(eq(roomInvitations.inviterId, userId))
      .orderBy(desc(roomInvitations.createdAt));
  }

  async getReceivedRoomInvitations(userId: number): Promise<RoomInvitation[]> {
    return await db
      .select()
      .from(roomInvitations)
      .where(eq(roomInvitations.inviteeId, userId))
      .orderBy(desc(roomInvitations.createdAt));
  }

  async createRoomInvitation(invitation: InsertRoomInvitation): Promise<RoomInvitation> {
    // Check if invitation already exists
    const existingInvitations = await db
      .select()
      .from(roomInvitations)
      .where(
        and(
          eq(roomInvitations.roomId, invitation.roomId),
          eq(roomInvitations.inviterId, invitation.inviterId),
          eq(roomInvitations.inviteeId, invitation.inviteeId)
        )
      );

    if (existingInvitations.length > 0) {
      return existingInvitations[0];
    }

    const [newInvitation] = await db
      .insert(roomInvitations)
      .values(invitation)
      .returning();

    // Get inviter and room information for the notification
    const [inviter] = await db
      .select({
        id: users.id,
        username: users.username
      })
      .from(users)
      .where(eq(users.id, invitation.inviterId));

    const [room] = await db
      .select({
        id: chatRooms.id,
        name: chatRooms.name
      })
      .from(chatRooms)
      .where(eq(chatRooms.id, invitation.roomId));

    // Create a notification for the invitee
    if (inviter && room) {
      await this.createNotification({
        userId: invitation.inviteeId,
        type: 'room_invitation',
        actorId: invitation.inviterId,
        entityId: newInvitation.id,
        entityType: 'room_invitation',
        message: `${inviter.username} invited you to join the "${room.name}" chat room.`,
      });
    }

    return newInvitation;
  }

  async respondToRoomInvitation(invitationId: number, status: 'accepted' | 'declined'): Promise<RoomInvitation | undefined> {
    const [invitation] = await db
      .select()
      .from(roomInvitations)
      .where(eq(roomInvitations.id, invitationId));

    if (!invitation) {
      return undefined;
    }

    const [updatedInvitation] = await db
      .update(roomInvitations)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(roomInvitations.id, invitationId))
      .returning();

    // Get user and room information for the notification
    const [invitee] = await db
      .select({
        id: users.id,
        username: users.username
      })
      .from(users)
      .where(eq(users.id, invitation.inviteeId));

    const [room] = await db
      .select({
        id: chatRooms.id,
        name: chatRooms.name
      })
      .from(chatRooms)
      .where(eq(chatRooms.id, invitation.roomId));

    // Create a notification for the inviter about the response
    if (invitee && room) {
      await this.createNotification({
        userId: invitation.inviterId,
        type: 'room_invitation_response',
        actorId: invitation.inviteeId,
        entityId: invitationId,
        entityType: 'room_invitation',
        message: `${invitee.username} ${status === 'accepted' ? 'accepted' : 'declined'} your invitation to join "${room.name}" chat room.`,
      });
    }

    return updatedInvitation;
  }

  // Post methods
  async getPosts(currentUserId: number): Promise<PostWithUser[]> {
    // Get all posts the current user should be able to see
    const query = `
      SELECT p.*, u.username, u.profile_picture FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE 
        -- Public posts
        p.visibility = 'public'
        -- Posts from users the current user follows (if visibility is 'followers')
        OR (p.visibility = 'followers' AND EXISTS (
          SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = p.user_id
        ))
        -- Posts from users who are friends with the current user (if visibility is 'friends')
        OR (p.visibility = 'friends' AND EXISTS (
          SELECT 1 FROM friend_requests 
          WHERE ((sender_id = $1 AND receiver_id = p.user_id) OR (sender_id = p.user_id AND receiver_id = $1))
          AND status = 'accepted'
        ))
        -- User's own posts
        OR p.user_id = $1
        -- Don't show posts that should be auto-deleted
        AND (p.auto_delete_at IS NULL OR p.auto_delete_at > NOW())
      ORDER BY p.created_at DESC
    `;

    try {
      const result = await pool.query(query, [currentUserId]);
      
      return result.rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        content: row.content,
        imageUrl: row.image_url,
        visibility: row.visibility,
        autoDeleteAt: row.auto_delete_at,
        createdAt: row.created_at,
        user: {
          id: row.user_id,
          username: row.username,
          profilePicture: row.profile_picture
        }
      }));
    } catch (error) {
      console.error("Error getting posts:", error);
      return [];
    }
  }

  async getPostsByUser(userId: number, currentUserId: number): Promise<PostWithUser[]> {
    // Get posts by a specific user with visibility restrictions
    const query = `
      SELECT p.*, u.username, u.profile_picture FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.user_id = $1
      AND (
        -- Public posts
        p.visibility = 'public'
        -- Follower-only posts if currentUser follows the user
        OR (p.visibility = 'followers' AND EXISTS (
          SELECT 1 FROM follows WHERE follower_id = $2 AND following_id = $1
        ))
        -- Friend-only posts if currentUser is friends with the user
        OR (p.visibility = 'friends' AND EXISTS (
          SELECT 1 FROM friend_requests 
          WHERE ((sender_id = $2 AND receiver_id = $1) OR (sender_id = $1 AND receiver_id = $2))
          AND status = 'accepted'
        ))
        -- Allow users to see their own posts regardless of visibility
        OR $1 = $2
      )
      -- Don't show posts that should be auto-deleted
      AND (p.auto_delete_at IS NULL OR p.auto_delete_at > NOW())
      ORDER BY p.created_at DESC
    `;

    try {
      const result = await pool.query(query, [userId, currentUserId]);
      
      return result.rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        content: row.content,
        imageUrl: row.image_url,
        visibility: row.visibility,
        autoDeleteAt: row.auto_delete_at,
        createdAt: row.created_at,
        user: {
          id: row.user_id,
          username: row.username,
          profilePicture: row.profile_picture
        }
      }));
    } catch (error) {
      console.error("Error getting user posts:", error);
      return [];
    }
  }

  async createPost(post: InsertPost): Promise<Post> {
    const [newPost] = await db
      .insert(posts)
      .values(post)
      .returning();
    
    return newPost;
  }

  async deletePost(postId: number, userId: number): Promise<boolean> {
    try {
      // First verify that the user is the creator of the post
      const [post] = await db
        .select()
        .from(posts)
        .where(eq(posts.id, postId));
      
      if (!post || post.userId !== userId) {
        return false;
      }
      
      // Delete related comments
      await db
        .delete(comments)
        .where(eq(comments.postId, postId));
        
      // Delete related likes
      await db
        .delete(postLikes)
        .where(eq(postLikes.postId, postId));
      
      // Delete the post
      await db
        .delete(posts)
        .where(eq(posts.id, postId));
      
      return true;
    } catch (error) {
      console.error("Error deleting post:", error);
      return false;
    }
  }
  
  // Comment methods
  async getPostComments(postId: number): Promise<CommentWithUser[]> {
    const commentsData = await db
      .select()
      .from(comments)
      .where(eq(comments.postId, postId))
      .orderBy(comments.createdAt);
    
    const commentWithUsers = await Promise.all(
      commentsData.map(async (comment) => {
        const [user] = await db
          .select({ 
            id: users.id, 
            username: users.username,
            profilePicture: users.profilePicture
          })
          .from(users)
          .where(eq(users.id, comment.userId));

        return {
          ...comment,
          user: {
            id: user?.id || 0,
            username: user?.username || "Unknown User",
            profilePicture: user?.profilePicture || null
          },
        };
      })
    );

    return commentWithUsers;
  }

  async createComment(insertComment: InsertComment): Promise<Comment> {
    const [comment] = await db
      .insert(comments)
      .values(insertComment)
      .returning();
      
    // Create notification for post owner
    const [post] = await db
      .select()
      .from(posts)
      .where(eq(posts.id, insertComment.postId));
      
    if (post && post.userId !== insertComment.userId) {
      const [commenter] = await db
        .select({ id: users.id, username: users.username })
        .from(users)
        .where(eq(users.id, insertComment.userId));
      
      if (commenter) {
        await this.createNotification({
          userId: post.userId,
          type: 'comment',
          actorId: insertComment.userId,
          entityId: insertComment.postId,
          entityType: 'post',
          message: `${commenter.username} commented on your post.`,
        });
      }
    }
    
    return comment;
  }

  async deleteComment(commentId: number, userId: number): Promise<boolean> {
    try {
      // First verify that the user is the creator of the comment
      const [comment] = await db
        .select()
        .from(comments)
        .where(eq(comments.id, commentId));
      
      if (!comment || comment.userId !== userId) {
        return false;
      }
      
      // Delete the comment
      await db
        .delete(comments)
        .where(eq(comments.id, commentId));
      
      return true;
    } catch (error) {
      console.error("Error deleting comment:", error);
      return false;
    }
  }
  
  // Like methods
  async likePost(userId: number, postId: number): Promise<PostLike | undefined> {
    // Check if already liked
    const isAlreadyLiked = await this.isPostLikedByUser(userId, postId);
    if (isAlreadyLiked) {
      return undefined;
    }

    const [like] = await db
      .insert(postLikes)
      .values({
        userId,
        postId,
      })
      .returning();
    
    // Create notification for post owner
    const [post] = await db
      .select()
      .from(posts)
      .where(eq(posts.id, postId));
      
    if (post && post.userId !== userId) {
      const [liker] = await db
        .select({ id: users.id, username: users.username })
        .from(users)
        .where(eq(users.id, userId));
      
      if (liker) {
        await this.createNotification({
          userId: post.userId,
          type: 'like',
          actorId: userId,
          entityId: postId,
          entityType: 'post',
          message: `${liker.username} liked your post.`,
        });
      }
    }
    
    return like;
  }

  async unlikePost(userId: number, postId: number): Promise<boolean> {
    try {
      await db
        .delete(postLikes)
        .where(and(
          eq(postLikes.userId, userId),
          eq(postLikes.postId, postId)
        ));
      
      return true;
    } catch (error) {
      console.error("Error unliking post:", error);
      return false;
    }
  }

  async isPostLikedByUser(userId: number, postId: number): Promise<boolean> {
    const likes = await db
      .select()
      .from(postLikes)
      .where(and(
        eq(postLikes.userId, userId),
        eq(postLikes.postId, postId)
      ));
    
    return likes.length > 0;
  }

  async getPostLikes(postId: number): Promise<number> {
    const result = await db
      .select({ count: count() })
      .from(postLikes)
      .where(eq(postLikes.postId, postId));
    
    return result[0]?.count || 0;
  }

  // User recommendations methods
  async getSimilarUserRecommendations(userId: number): Promise<UserRecommendation[]> {
    return await db.select()
      .from(userRecommendations)
      .where(
        and(
          eq(userRecommendations.userId, userId),
          gt(userRecommendations.expiresAt, new Date())
        )
      );
  }

  async createUserRecommendation(recommendation: InsertUserRecommendation): Promise<UserRecommendation> {
    try {
      const [newRecommendation] = await db.insert(userRecommendations)
        .values(recommendation)
        .returning();
      
      return newRecommendation;
    } catch (error) {
      console.error("Error creating user recommendation:", error);
      throw error;
    }
  }

  async clearExpiredUserRecommendations(): Promise<void> {
    await db.delete(userRecommendations)
      .where(lt(userRecommendations.expiresAt, new Date()));
  }

  // Place recommendations methods
  async getPlaceRecommendations(roomId: number): Promise<PlaceRecommendation[]> {
    return await db.select()
      .from(placeRecommendations)
      .where(
        and(
          eq(placeRecommendations.roomId, roomId),
          gt(placeRecommendations.expiresAt, new Date())
        )
      );
  }

  async createPlaceRecommendation(recommendation: InsertPlaceRecommendation): Promise<PlaceRecommendation> {
    const [newRecommendation] = await db.insert(placeRecommendations)
      .values(recommendation)
      .returning();
    
    return newRecommendation;
  }

  async clearExpiredPlaceRecommendations(): Promise<void> {
    await db.delete(placeRecommendations)
      .where(lt(placeRecommendations.expiresAt, new Date()));
  }
}

export const storage = new DatabaseStorage();
