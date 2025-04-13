import { users, chatRooms, messages } from "@shared/schema";
import type { User, InsertUser, ChatRoom, InsertChatRoom, Message, InsertMessage, MessageWithUser } from "@shared/schema";
import session from "express-session";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./db";

const PostgresStore = connectPgSimple(session);

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserProfile(userId: number, updates: Partial<Pick<User, 'hobbies' | 'interests' | 'currentActivities'>>): Promise<User | undefined>;
  
  // Chat room methods
  getChatRooms(): Promise<ChatRoom[]>;
  getChatRoom(id: number): Promise<ChatRoom | undefined>;
  createChatRoom(room: InsertChatRoom): Promise<ChatRoom>;
  
  // Message methods
  getMessagesByRoomId(roomId: number): Promise<MessageWithUser[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  
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

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUserProfile(userId: number, updates: Partial<Pick<User, 'hobbies' | 'interests' | 'currentActivities'>>): Promise<User | undefined> {
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
          .select({ id: users.id, username: users.username })
          .from(users)
          .where(eq(users.id, message.userId));

        return {
          ...message,
          user: {
            id: user?.id || 0,
            username: user?.username || "Unknown User",
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
}

export const storage = new DatabaseStorage();
