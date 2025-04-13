import { users, chatRooms, messages } from "@shared/schema";
import type { User, InsertUser, ChatRoom, InsertChatRoom, Message, InsertMessage, MessageWithUser } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Chat room methods
  getChatRooms(): Promise<ChatRoom[]>;
  getChatRoom(id: number): Promise<ChatRoom | undefined>;
  createChatRoom(room: InsertChatRoom): Promise<ChatRoom>;
  
  // Message methods
  getMessagesByRoomId(roomId: number): Promise<MessageWithUser[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  
  // Session store
  sessionStore: session.SessionStore;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private chatRooms: Map<number, ChatRoom>;
  private messages: Map<number, Message>;
  sessionStore: session.SessionStore;
  currentUserId: number;
  currentChatRoomId: number;
  currentMessageId: number;

  constructor() {
    this.users = new Map();
    this.chatRooms = new Map();
    this.messages = new Map();
    this.currentUserId = 1;
    this.currentChatRoomId = 1;
    this.currentMessageId = 1;
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // 24 hours
    });
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username.toLowerCase() === username.toLowerCase(),
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Chat room methods
  async getChatRooms(): Promise<ChatRoom[]> {
    return Array.from(this.chatRooms.values());
  }

  async getChatRoom(id: number): Promise<ChatRoom | undefined> {
    return this.chatRooms.get(id);
  }

  async createChatRoom(insertRoom: InsertChatRoom): Promise<ChatRoom> {
    const id = this.currentChatRoomId++;
    const room: ChatRoom = { 
      ...insertRoom, 
      id, 
      createdAt: new Date() 
    };
    this.chatRooms.set(id, room);
    return room;
  }

  // Message methods
  async getMessagesByRoomId(roomId: number): Promise<MessageWithUser[]> {
    const roomMessages = Array.from(this.messages.values())
      .filter(message => message.roomId === roomId)
      .sort((a, b) => {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });

    // Enrich messages with user data
    return Promise.all(roomMessages.map(async (message) => {
      const user = await this.getUser(message.userId);
      return {
        ...message,
        user: {
          id: user?.id || 0,
          username: user?.username || 'Unknown User'
        }
      };
    }));
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const id = this.currentMessageId++;
    const message: Message = { 
      ...insertMessage, 
      id, 
      createdAt: new Date() 
    };
    this.messages.set(id, message);
    return message;
  }
}

export const storage = new MemStorage();
