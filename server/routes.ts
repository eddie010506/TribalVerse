import express, { type Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer } from "ws";
import WebSocket from "ws";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import multer from "multer";
import path from "path";
import fs from "fs";
import { insertChatRoomSchema, insertMessageSchema } from "@shared/schema";
import { z } from "zod";
import { randomBytes } from "crypto";
import { sendVerificationEmail } from "./email";

// Configure multer for image uploads
const uploadsDir = path.join(process.cwd(), "uploads");
const profileUploadsDir = path.join(uploadsDir, "profiles");
const messageUploadsDir = path.join(uploadsDir, "messages");

// Create directories if they don't exist
[uploadsDir, profileUploadsDir, messageUploadsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure multer for message image uploads
const messageStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, messageUploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// Configure multer for profile picture uploads
const profileStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, profileUploadsDir);
  },
  filename: function (req, file, cb) {
    // Use user ID for profile pictures for better organization
    const userId = req.user?.id || 'unknown';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `profile_${userId}_${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

// Shared file filter for images
const imageFileFilter = (req: any, file: any, cb: any) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'));
  }
};

// Different upload instances for different purposes
const uploadMessageImage = multer({ 
  storage: messageStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: imageFileFilter
});

const uploadProfilePicture = multer({
  storage: profileStorage,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB limit for profile pictures
  },
  fileFilter: imageFileFilter
});

// Use the message uploader for the general upload route (backward compatibility)
const upload = uploadMessageImage;

// Auth middleware
const isAuthenticated = (req: Request, res: Response, next: Function) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
};

// Email verification middleware
const isEmailVerified = (req: Request, res: Response, next: Function) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  if (!req.user.emailVerified) {
    return res.status(403).json({ 
      message: "Email verification required",
      requiresVerification: true
    });
  }
  
  next();
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication routes
  setupAuth(app);
  
  // Serve uploaded files
  app.use('/uploads', express.static(uploadsDir));

  // User profile API
  app.get("/api/profile", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Filter out the password for security
      const { password, ...userProfile } = user;
      res.json(userProfile);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user profile" });
    }
  });
  
  // Get any user's profile by ID
  app.get("/api/users/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Check if the current user is following this user
      const isFollowing = await storage.isFollowing(req.user!.id, userId);
      
      // Return limited profile data for security
      const limitedProfile = {
        id: user.id,
        username: user.username,
        profilePicture: user.profilePicture,
        hobbies: user.hobbies,
        interests: user.interests,
        currentActivities: user.currentActivities,
        isFollowing,
      };
      
      res.json(limitedProfile);
    } catch (error) {
      console.error("Error fetching user profile:", error);
      res.status(500).json({ message: "Failed to fetch user profile" });
    }
  });

  // Update user profile
  app.patch("/api/profile", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      
      // Validate incoming data
      const profileSchema = z.object({
        hobbies: z.string().optional(),
        interests: z.string().optional(),
        currentActivities: z.string().optional(),
      });
      
      const validatedData = profileSchema.parse(req.body);
      const updatedUser = await storage.updateUserProfile(userId, validatedData);
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Filter out the password for security
      const { password, ...userProfile } = updatedUser;
      res.json(userProfile);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid profile data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update user profile" });
    }
  });
  
  // Upload profile picture
  app.post("/api/profile/picture", isAuthenticated, uploadProfilePicture.single('picture'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No picture uploaded" });
      }
      
      const userId = req.user!.id;
      const relativePath = path.relative(process.cwd(), req.file.path).replace(/\\/g, '/');
      const profilePicturePath = `/${relativePath}`;
      
      // Update user profile with the new profile picture
      const updatedUser = await storage.updateUserProfile(userId, {
        profilePicture: profilePicturePath
      });
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Filter out sensitive data
      const { password, ...userProfile } = updatedUser;
      res.json({ 
        ...userProfile,
        message: "Profile picture updated successfully" 
      });
    } catch (error) {
      console.error("Error uploading profile picture:", error);
      res.status(500).json({ message: "Failed to update profile picture" });
    }
  });

  // Follow a user
  app.post("/api/users/:id/follow", isAuthenticated, isEmailVerified, async (req, res) => {
    try {
      const followingId = parseInt(req.params.id);
      if (isNaN(followingId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      const followerId = req.user!.id;
      
      // Don't allow following yourself
      if (followerId === followingId) {
        return res.status(400).json({ message: "You cannot follow yourself" });
      }
      
      // Check if target user exists
      const targetUser = await storage.getUser(followingId);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Follow the user
      const follow = await storage.followUser(followerId, followingId);
      if (!follow) {
        return res.status(400).json({ message: "Failed to follow user or already following" });
      }
      
      res.status(201).json({ 
        message: `You are now following ${targetUser.username}`,
        following: true
      });
    } catch (error) {
      console.error("Error following user:", error);
      res.status(500).json({ message: "Failed to follow user" });
    }
  });
  
  // Unfollow a user
  app.delete("/api/users/:id/follow", isAuthenticated, async (req, res) => {
    try {
      const followingId = parseInt(req.params.id);
      if (isNaN(followingId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      const followerId = req.user!.id;
      
      // Check if target user exists
      const targetUser = await storage.getUser(followingId);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Unfollow the user
      const success = await storage.unfollowUser(followerId, followingId);
      if (!success) {
        return res.status(400).json({ message: "Failed to unfollow user" });
      }
      
      res.json({ 
        message: `You have unfollowed ${targetUser.username}`,
        following: false
      });
    } catch (error) {
      console.error("Error unfollowing user:", error);
      res.status(500).json({ message: "Failed to unfollow user" });
    }
  });

  // Get followers for a user
  app.get("/api/users/:id/followers", isAuthenticated, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      const followers = await storage.getFollowers(userId);
      res.json(followers);
    } catch (error) {
      console.error("Error getting followers:", error);
      res.status(500).json({ message: "Failed to get followers" });
    }
  });
  
  // Get users that a user is following
  app.get("/api/users/:id/following", isAuthenticated, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      const following = await storage.getFollowing(userId);
      res.json(following);
    } catch (error) {
      console.error("Error getting following users:", error);
      res.status(500).json({ message: "Failed to get following users" });
    }
  });

  // Update user email
  app.patch("/api/profile/email", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      
      // Validate incoming data
      const emailSchema = z.object({
        email: z.string()
          .email("Invalid email address")
          .refine(email => email.toLowerCase().endsWith('.edu'), {
            message: "Only .edu email addresses are allowed"
          }),
      });
      
      const { email } = emailSchema.parse(req.body);
      
      // Check if email is already in use
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser && existingUser.id !== userId) {
        return res.status(400).json({ message: "Email is already in use" });
      }
      
      // Generate a verification token
      const verificationToken = randomBytes(32).toString('hex');
      
      // Update user with new email and token
      const updatedUser = await storage.updateUserProfile(userId, {
        email,
        emailVerified: false,
        verificationToken,
      });
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Send verification email
      try {
        await sendVerificationEmail(email, updatedUser.username, verificationToken);
      } catch (emailError) {
        console.error("Failed to send verification email:", emailError);
        // Continue anyway, as we've updated the user's email
      }
      
      // Filter out sensitive data
      const { password, verificationToken: token, ...userProfile } = updatedUser;
      res.json(userProfile);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid email", errors: error.errors });
      }
      console.error("Failed to update email:", error);
      res.status(500).json({ message: "Failed to update email" });
    }
  });

  // Notifications API
  app.get("/api/notifications", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const notifications = await storage.getNotifications(userId);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });
  
  // Get unread notification count
  app.get("/api/notifications/count", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const count = await storage.getUnreadNotificationCount(userId);
      res.json({ count });
    } catch (error) {
      console.error("Error getting notification count:", error);
      res.status(500).json({ message: "Failed to get notification count" });
    }
  });
  
  // Mark a notification as read
  app.patch("/api/notifications/:id", isAuthenticated, async (req, res) => {
    try {
      const notificationId = parseInt(req.params.id);
      if (isNaN(notificationId)) {
        return res.status(400).json({ message: "Invalid notification ID" });
      }
      
      const success = await storage.markNotificationAsRead(notificationId);
      if (!success) {
        return res.status(400).json({ message: "Failed to mark notification as read" });
      }
      
      res.json({ message: "Notification marked as read" });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });
  
  // Mark all notifications as read
  app.patch("/api/notifications", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const success = await storage.markAllNotificationsAsRead(userId);
      if (!success) {
        return res.status(400).json({ message: "Failed to mark all notifications as read" });
      }
      
      res.json({ message: "All notifications marked as read" });
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({ message: "Failed to mark all notifications as read" });
    }
  });

  // Chat rooms API
  app.get("/api/rooms", isAuthenticated, async (req, res) => {
    try {
      const rooms = await storage.getChatRooms();
      res.json(rooms);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch chat rooms" });
    }
  });

  app.post("/api/rooms", isAuthenticated, isEmailVerified, async (req, res) => {
    try {
      const validatedData = insertChatRoomSchema.parse({
        ...req.body,
        creatorId: req.user!.id
      });
      
      const room = await storage.createChatRoom(validatedData);
      res.status(201).json(room);
    } catch (error) {
      res.status(400).json({ message: "Invalid room data" });
    }
  });

  app.get("/api/rooms/:id", isAuthenticated, async (req, res) => {
    try {
      const roomId = parseInt(req.params.id);
      if (isNaN(roomId)) {
        return res.status(400).json({ message: "Invalid room ID" });
      }
      
      const room = await storage.getChatRoom(roomId);
      if (!room) {
        return res.status(404).json({ message: "Room not found" });
      }
      
      res.json(room);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch room" });
    }
  });

  // Messages API
  app.get("/api/rooms/:id/messages", isAuthenticated, async (req, res) => {
    try {
      const roomId = parseInt(req.params.id);
      if (isNaN(roomId)) {
        return res.status(400).json({ message: "Invalid room ID" });
      }
      
      const messages = await storage.getMessagesByRoomId(roomId);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.post("/api/upload", isAuthenticated, isEmailVerified, upload.single('image'), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    
    // Return the file path that can be used to access the image
    const filePath = `/uploads/${req.file.filename}`;
    res.json({ url: filePath });
  });

  // Create HTTP server
  const httpServer = createServer(app);

  // Setup WebSocket server
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  // Map clients to rooms
  const clients = new Map<WebSocket, { userId: number, username: string }>();

  wss.on('connection', (ws) => {
    // Handle WebSocket connection
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        // Handle different message types
        switch (data.type) {
          case 'auth':
            // Authenticate user
            if (data.userId && data.username) {
              clients.set(ws, { userId: data.userId, username: data.username });
            }
            break;
            
          case 'message':
            // Validate and save message
            if (data.content && data.roomId) {
              const clientInfo = clients.get(ws);
              if (!clientInfo) {
                ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }));
                return;
              }
              
              try {
                // Check if the user's email is verified before allowing messages
                const user = await storage.getUser(clientInfo.userId);
                if (!user || !user.emailVerified) {
                  ws.send(JSON.stringify({ 
                    type: 'error', 
                    error: 'email_verification_required',
                    message: 'Email verification required to send messages' 
                  }));
                  return;
                }
                
                const validatedData = insertMessageSchema.parse({
                  content: data.content,
                  imageUrl: data.imageUrl || null,
                  userId: clientInfo.userId,
                  roomId: data.roomId
                });
                
                const newMessage = await storage.createMessage(validatedData);
                
                // Get user with profile picture
                const userInfo = await storage.getUser(clientInfo.userId);
                
                // Broadcast to all clients in the same room
                const messageWithUser = {
                  ...newMessage,
                  user: {
                    id: clientInfo.userId,
                    username: clientInfo.username,
                    profilePicture: userInfo?.profilePicture
                  }
                };
                
                wss.clients.forEach((client) => {
                  if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({
                      type: 'new_message',
                      roomId: data.roomId,
                      message: messageWithUser
                    }));
                  }
                });
              } catch (error) {
                ws.send(JSON.stringify({ type: 'error', message: 'Invalid message data' }));
              }
            }
            break;
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
    });
  });

  return httpServer;
}
