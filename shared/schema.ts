import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
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
  hobbies: text("hobbies"),
  interests: text("interests"),
  currentActivities: text("current_activities"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
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
}));

// Chat room schema
export const chatRooms = pgTable("chat_rooms", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  creatorId: integer("creator_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertChatRoomSchema = createInsertSchema(chatRooms).pick({
  name: true,
  description: true,
  creatorId: true,
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
  };
};
