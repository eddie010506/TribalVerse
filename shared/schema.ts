import { pgTable, text, serial, integer, boolean, timestamp, unique, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// User schema
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email"),
  emailVerified: boolean("email_verified").default(false),
  verificationToken: text("verification_token"),
  profilePicture: text("profile_picture"),
  hobbies: text("hobbies"),
  interests: text("interests"),
  currentActivities: text("current_activities"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
  profilePicture: true,
  hobbies: true,
  interests: true,
  currentActivities: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// User relations
export const usersRelations = relations(users, ({ many }) => ({
  chatRooms: many(chatRooms),
  messages: many(messages),
  sentFriendRequests: many(friendRequests, { relationName: "sender" }),
  receivedFriendRequests: many(friendRequests, { relationName: "receiver" }),
  followers: many(follows, { relationName: "following" }),
  following: many(follows, { relationName: "follower" }),
  notifications: many(notifications, { relationName: "user" }),
  actorNotifications: many(notifications, { relationName: "actor" }),
  sentRoomInvitations: many(roomInvitations, { relationName: "inviter" }),
  receivedRoomInvitations: many(roomInvitations, { relationName: "invitee" }),
  posts: many(posts),
}));

// Chat room schema
export const chatRooms = pgTable("chat_rooms", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  creatorId: integer("creator_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  isSelfChat: boolean("is_self_chat").default(false),
});

export const insertChatRoomSchema = createInsertSchema(chatRooms).pick({
  name: true,
  description: true,
  creatorId: true,
  isSelfChat: true,
});

export type InsertChatRoom = z.infer<typeof insertChatRoomSchema>;
export type ChatRoom = typeof chatRooms.$inferSelect;

// Chat room relations
export const chatRoomsRelations = relations(chatRooms, ({ one, many }) => ({
  creator: one(users, {
    fields: [chatRooms.creatorId],
    references: [users.id],
  }),
  messages: many(messages),
  invitations: many(roomInvitations),
}));

// Message schema
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  imageUrl: text("image_url"),
  userId: integer("user_id").notNull(),
  roomId: integer("room_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMessageSchema = createInsertSchema(messages).pick({
  content: true,
  imageUrl: true,
  userId: true,
  roomId: true,
});

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

// Message relations
export const messagesRelations = relations(messages, ({ one }) => ({
  user: one(users, {
    fields: [messages.userId],
    references: [users.id],
  }),
  room: one(chatRooms, {
    fields: [messages.roomId],
    references: [chatRooms.id],
  }),
}));

// Message with user info for display
export type MessageWithUser = Message & {
  user: {
    id: number;
    username: string;
    profilePicture?: string | null;
  };
};

// Friend requests schema
export const friendRequests = pgTable("friend_requests", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id").notNull().references(() => users.id),
  receiverId: integer("receiver_id").notNull().references(() => users.id),
  status: text("status").notNull().default("pending"), // pending, accepted, rejected
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertFriendRequestSchema = createInsertSchema(friendRequests).pick({
  senderId: true,
  receiverId: true,
});

export type InsertFriendRequest = z.infer<typeof insertFriendRequestSchema>;
export type FriendRequest = typeof friendRequests.$inferSelect;

// Friend requests relations
export const friendRequestsRelations = relations(friendRequests, ({ one }) => ({
  sender: one(users, {
    fields: [friendRequests.senderId],
    references: [users.id],
  }),
  receiver: one(users, {
    fields: [friendRequests.receiverId],
    references: [users.id],
  }),
}));

// Follows schema
export const follows = pgTable("follows", {
  id: serial("id").primaryKey(),
  followerId: integer("follower_id").notNull().references(() => users.id),
  followingId: integer("following_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertFollowSchema = createInsertSchema(follows).pick({
  followerId: true,
  followingId: true,
});

export type InsertFollow = z.infer<typeof insertFollowSchema>;
export type Follow = typeof follows.$inferSelect;

// Follows relations
export const followsRelations = relations(follows, ({ one }) => ({
  follower: one(users, {
    fields: [follows.followerId],
    references: [users.id],
  }),
  following: one(users, {
    fields: [follows.followingId],
    references: [users.id],
  }),
}));

// Notifications schema
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  type: text("type").notNull(), // friend_request, follow, message, etc.
  actorId: integer("actor_id").references(() => users.id), // Who triggered the notification
  entityId: integer("entity_id"), // ID of the related entity (friend request, message, etc.)
  entityType: text("entity_type"), // Type of the related entity
  message: text("message").notNull(),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertNotificationSchema = createInsertSchema(notifications).pick({
  userId: true,
  type: true,
  actorId: true,
  entityId: true,
  entityType: true,
  message: true,
  isRead: true,
});

export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

// Notifications relations
export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  actor: one(users, {
    fields: [notifications.actorId],
    references: [users.id],
  }),
}));

// Room Invitations schema
export const roomInvitations = pgTable("room_invitations", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull().references(() => chatRooms.id),
  inviterId: integer("inviter_id").notNull().references(() => users.id),
  inviteeId: integer("invitee_id").notNull().references(() => users.id),
  status: text("status").notNull().default("pending"), // pending, accepted, declined
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertRoomInvitationSchema = createInsertSchema(roomInvitations).pick({
  roomId: true,
  inviterId: true,
  inviteeId: true,
});

export type InsertRoomInvitation = z.infer<typeof insertRoomInvitationSchema>;
export type RoomInvitation = typeof roomInvitations.$inferSelect;

// Room Invitations relations
export const roomInvitationsRelations = relations(roomInvitations, ({ one }) => ({
  room: one(chatRooms, {
    fields: [roomInvitations.roomId],
    references: [chatRooms.id],
  }),
  inviter: one(users, {
    fields: [roomInvitations.inviterId],
    references: [users.id],
  }),
  invitee: one(users, {
    fields: [roomInvitations.inviteeId],
    references: [users.id],
  }),
}));

// Posts schema
export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  imageUrl: text("image_url"),
  visibility: text("visibility").notNull().default("public"), // public, followers, friends
  autoDeleteAt: timestamp("auto_delete_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPostSchema = createInsertSchema(posts).pick({
  userId: true,
  content: true,
  imageUrl: true,
  visibility: true,
  autoDeleteAt: true,
});

export type InsertPost = z.infer<typeof insertPostSchema>;
export type Post = typeof posts.$inferSelect;

// Post relations
export const postsRelations = relations(posts, ({ one, many }) => ({
  user: one(users, {
    fields: [posts.userId],
    references: [users.id],
  }),
  comments: many(comments),
  likes: many(postLikes),
}));

// Post with user info for display
export type PostWithUser = Post & {
  user: {
    id: number;
    username: string;
    profilePicture?: string | null;
  };
  comments?: Comment[];
  likes?: PostLike[];
  commentCount?: number;
  likeCount?: number;
  isLikedByCurrentUser?: boolean;
};

// Comments table
export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  postId: integer("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCommentSchema = createInsertSchema(comments).pick({
  content: true,
  userId: true,
  postId: true,
});

export type InsertComment = z.infer<typeof insertCommentSchema>;
export type Comment = typeof comments.$inferSelect;

// Comment relations
export const commentsRelations = relations(comments, ({ one }) => ({
  user: one(users, {
    fields: [comments.userId],
    references: [users.id],
  }),
  post: one(posts, {
    fields: [comments.postId],
    references: [posts.id],
  }),
}));

// Comment with user info for display
export type CommentWithUser = Comment & {
  user: {
    id: number;
    username: string;
    profilePicture?: string | null;
  };
};

// Post likes table
export const postLikes = pgTable("post_likes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  postId: integer("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  uniqueUserPost: unique().on(t.userId, t.postId),
}));

export const insertPostLikeSchema = createInsertSchema(postLikes).pick({
  userId: true,
  postId: true,
});

export type InsertPostLike = z.infer<typeof insertPostLikeSchema>;
export type PostLike = typeof postLikes.$inferSelect;

// Post like relations
export const postLikesRelations = relations(postLikes, ({ one }) => ({
  user: one(users, {
    fields: [postLikes.userId],
    references: [users.id],
  }),
  post: one(posts, {
    fields: [postLikes.postId],
    references: [posts.id],
  }),
}));

// User recommendations table to cache algorithm-based recommendations
export const userRecommendations = pgTable("user_recommendations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  recommendedUserId: integer("recommended_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  matchReason: text("match_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});

export const insertUserRecommendationSchema = createInsertSchema(userRecommendations).pick({
  userId: true,
  recommendedUserId: true,
  matchReason: true,
  expiresAt: true,
});

export type InsertUserRecommendation = z.infer<typeof insertUserRecommendationSchema>;
export type UserRecommendation = typeof userRecommendations.$inferSelect;

export const userRecommendationsRelations = relations(userRecommendations, ({ one }) => ({
  user: one(users, {
    fields: [userRecommendations.userId],
    references: [users.id],
  }),
  recommendedUser: one(users, {
    fields: [userRecommendations.recommendedUserId],
    references: [users.id],
  }),
}));

// Place recommendations table to cache AI recommendations
export const placeRecommendations = pgTable("place_recommendations", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull().references(() => chatRooms.id, { onDelete: "cascade" }),
  placeName: text("place_name").notNull(),
  description: text("description"),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});

export const insertPlaceRecommendationSchema = createInsertSchema(placeRecommendations).pick({
  roomId: true,
  placeName: true,
  description: true,
  reason: true,
  expiresAt: true,
});

export type InsertPlaceRecommendation = z.infer<typeof insertPlaceRecommendationSchema>;
export type PlaceRecommendation = typeof placeRecommendations.$inferSelect;

export const placeRecommendationsRelations = relations(placeRecommendations, ({ one }) => ({
  room: one(chatRooms, {
    fields: [placeRecommendations.roomId],
    references: [chatRooms.id],
  }),
}));

