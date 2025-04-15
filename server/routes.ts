import express, { type Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import WebSocket, { WebSocketServer } from "ws";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import multer from "multer";
import path from "path";
import fs from "fs";
import { pool } from "./db";
import { insertChatRoomSchema, insertMessageSchema } from "@shared/schema";
import { z } from "zod";
import { randomBytes } from "crypto";
import { sendVerificationEmail } from "./email";
import { 
  sendMessageToAI, 
  initializeAIConversation, 
  initializeCustomAIConversation,
  findSimilarUsers,
  recommendMeetupPlaces
} from "./anthropic";

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
      
      // Create a notification for the followed user
      await storage.createNotification({
        userId: followingId,
        type: "follow",
        message: `${req.user!.username} started following you`,
        actorId: followerId,
        entityType: "user",
        entityId: followerId
      });
      
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

  // Get user profile by ID
  app.get("/api/users/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      // Get the user
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if the current user is following this user
      const currentUserId = req.user!.id;
      const isFollowing = await storage.isFollowing(currentUserId, userId);
      
      // Return a filtered profile without sensitive information
      const { password, verificationToken, email, emailVerified, ...publicProfile } = user;
      
      res.json({
        ...publicProfile,
        isFollowing
      });
    } catch (error) {
      console.error("Error fetching user profile:", error);
      res.status(500).json({ message: "Failed to fetch user profile" });
    }
  });

  // Follow a user
  app.post("/api/users/:id/follow", isAuthenticated, async (req, res) => {
    try {
      const followingId = parseInt(req.params.id);
      if (isNaN(followingId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      const followerId = req.user!.id;
      
      // Prevent following yourself
      if (followerId === followingId) {
        return res.status(400).json({ message: "Cannot follow yourself" });
      }
      
      const follow = await storage.followUser(followerId, followingId);
      if (!follow) {
        return res.status(400).json({ message: "Already following or unable to follow" });
      }
      
      // Create a notification for the followed user
      await storage.createNotification({
        userId: followingId,
        type: "follow",
        message: `${req.user!.username} started following you`,
        actorId: followerId,
        entityType: "user",
        entityId: followerId
      });
      
      res.json({ message: "Successfully followed user", follow });
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
      
      const success = await storage.unfollowUser(followerId, followingId);
      if (!success) {
        return res.status(400).json({ message: "Not following or unable to unfollow" });
      }
      
      res.json({ message: "Successfully unfollowed user" });
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

  // User search API
  app.get("/api/users/search", isAuthenticated, async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query || query.length < 2) {
        return res.status(400).json({ message: "Search query must be at least 2 characters" });
      }
      
      // Search users with raw SQL query
      const result = await pool.query(`
        SELECT id, username, profile_picture as "profilePicture"
        FROM users 
        WHERE username ILIKE $1 
        AND id != $2
        LIMIT 10
      `, [`%${query}%`, req.user!.id]);
      
      res.json(result.rows);
    } catch (error) {
      console.error("Error searching users:", error);
      res.status(500).json({ message: "Failed to search users" });
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
  
  // Friend Request API
  
  // Get received friend requests
  app.get("/api/friend-requests/received", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const requests = await storage.getReceivedFriendRequests(userId);
      res.json(requests);
    } catch (error) {
      console.error("Error fetching received friend requests:", error);
      res.status(500).json({ message: "Failed to fetch received friend requests" });
    }
  });
  
  // Get sent friend requests
  app.get("/api/friend-requests/sent", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const requests = await storage.getSentFriendRequests(userId);
      res.json(requests);
    } catch (error) {
      console.error("Error fetching sent friend requests:", error);
      res.status(500).json({ message: "Failed to fetch sent friend requests" });
    }
  });
  
  // Send a friend request
  app.post("/api/friend-requests", isAuthenticated, isEmailVerified, async (req, res) => {
    try {
      const requesterId = req.user!.id;
      const { receiverId } = req.body;
      
      if (requesterId === receiverId) {
        return res.status(400).json({ message: "Cannot send friend request to yourself" });
      }
      
      // Check if receiver exists
      const receiver = await storage.getUser(receiverId);
      if (!receiver) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Check if friend request already exists
      const existingRequests = await storage.getFriendRequests(requesterId);
      const existingRequest = existingRequests.find(
        req => req.receiverId === receiverId || req.senderId === receiverId
      );
      
      if (existingRequest) {
        if (existingRequest.status === 'pending') {
          return res.status(400).json({ message: "A friend request already exists between these users" });
        } else if (existingRequest.status === 'accepted') {
          return res.status(400).json({ message: "You are already friends with this user" });
        }
      }
      
      // Create friend request
      const friendRequest = await storage.createFriendRequest({
        senderId: requesterId,
        receiverId
      });
      
      // Create notification for receiver
      await storage.createNotification({
        userId: receiverId,
        type: "friend_request",
        message: `${req.user!.username} sent you a friend request`,
        actorId: requesterId,
        entityType: "friend_request",
        entityId: friendRequest.id
      });
      
      // Send a refresh_notifications WebSocket event
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'refresh_notifications'
          }));
        }
      });
      
      res.status(201).json(friendRequest);
    } catch (error) {
      console.error("Error sending friend request:", error);
      res.status(500).json({ message: "Failed to send friend request" });
    }
  });
  
  // Respond to a friend request (accept or reject)
  app.patch("/api/friend-requests/:id", isAuthenticated, async (req, res) => {
    try {
      const requestId = parseInt(req.params.id);
      const userId = req.user!.id;
      const { status } = req.body;
      
      if (status !== 'accepted' && status !== 'rejected') {
        return res.status(400).json({ message: "Status must be 'accepted' or 'rejected'" });
      }
      
      // Check if request exists and user is the receiver
      const requests = await storage.getReceivedFriendRequests(userId);
      const request = requests.find(req => req.id === requestId);
      
      if (!request) {
        return res.status(404).json({ message: "Friend request not found or you're not authorized to respond" });
      }
      
      // Update request status
      const updatedRequest = await storage.respondToFriendRequest(requestId, status);
      if (!updatedRequest) {
        return res.status(400).json({ message: "Failed to respond to friend request" });
      }
      
      // Create notification for sender
      await storage.createNotification({
        userId: request.senderId,
        type: "friend_request_response",
        message: status === 'accepted' 
          ? `${req.user!.username} accepted your friend request` 
          : `${req.user!.username} declined your friend request`,
        actorId: userId,
        entityType: "friend_request",
        entityId: requestId
      });
      
      // Send a refresh_notifications WebSocket event
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'refresh_notifications'
          }));
        }
      });
      
      res.json(updatedRequest);
    } catch (error) {
      console.error("Error responding to friend request:", error);
      res.status(500).json({ message: "Failed to respond to friend request" });
    }
  });
  
  // Routes for the follow API for the hooks
  // Get followers
  app.get("/api/follows/followers", isAuthenticated, async (req, res) => {
    try {
      const userId = req.query.userId ? parseInt(req.query.userId as string) : req.user!.id;
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
  
  // Get following
  app.get("/api/follows/following", isAuthenticated, async (req, res) => {
    try {
      const userId = req.query.userId ? parseInt(req.query.userId as string) : req.user!.id;
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      const following = await storage.getFollowing(userId);
      res.json(following);
    } catch (error) {
      console.error("Error getting following:", error);
      res.status(500).json({ message: "Failed to get following" });
    }
  });
  
  // Check if following a user
  app.get("/api/follows/is-following", isAuthenticated, async (req, res) => {
    try {
      const targetUserId = parseInt(req.query.userId as string);
      if (isNaN(targetUserId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      const currentUserId = req.user!.id;
      const isFollowing = await storage.isFollowing(currentUserId, targetUserId);
      
      res.json(isFollowing);
    } catch (error) {
      console.error("Error checking follow status:", error);
      res.status(500).json({ message: "Failed to check follow status" });
    }
  });
  
  // Follow a user
  app.post("/api/follows", isAuthenticated, isEmailVerified, async (req, res) => {
    try {
      const followerId = req.user!.id;
      const { followingId } = req.body;
      
      if (!followingId || isNaN(followingId)) {
        return res.status(400).json({ message: "Invalid user ID to follow" });
      }
      
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
      
      // Create notification for followed user
      await storage.createNotification({
        userId: followingId,
        type: "follow",
        message: `${req.user!.username} started following you`,
        actorId: followerId,
        entityType: "user",
        entityId: followerId
      });
      
      // Send a refresh_notifications WebSocket event
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'refresh_notifications'
          }));
        }
      });
      
      res.status(201).json(follow);
    } catch (error) {
      console.error("Error following user:", error);
      res.status(500).json({ message: "Failed to follow user" });
    }
  });
  
  // Unfollow a user
  app.delete("/api/follows/:followingId", isAuthenticated, async (req, res) => {
    try {
      const followingId = parseInt(req.params.followingId);
      const followerId = req.user!.id;
      
      if (isNaN(followingId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      // Check if target user exists
      const targetUser = await storage.getUser(followingId);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Unfollow the user
      const success = await storage.unfollowUser(followerId, followingId);
      if (!success) {
        return res.status(400).json({ message: "Not following or failed to unfollow" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error unfollowing user:", error);
      res.status(500).json({ message: "Failed to unfollow user" });
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
      // Check if this is a self-chat room
      const isSelfChat = Boolean(req.body.isSelfChat);
      
      const validatedData = insertChatRoomSchema.parse({
        ...req.body,
        creatorId: req.user!.id,
        isSelfChat: isSelfChat
      });
      
      const room = await storage.createChatRoom(validatedData);
      
      // For self-chat rooms, we don't need to send invitations
      // If invitees were provided and not a self-chat, send invitations
      if (!isSelfChat && req.body.invitees && Array.isArray(req.body.invitees)) {
        const inviterId = req.user!.id;
        const roomId = room.id;
        
        // Send invitations to all invitees
        for (const inviteeId of req.body.invitees) {
          // Skip if invitee ID is invalid
          if (typeof inviteeId !== 'number' || isNaN(inviteeId)) continue;
          
          // Skip if invitee is the creator
          if (inviteeId === inviterId) continue;
          
          // Check if user exists
          const invitee = await storage.getUser(inviteeId);
          if (!invitee) continue;
          
          // Create the invitation
          await storage.createRoomInvitation({
            roomId,
            inviterId,
            inviteeId
          });
        }
        
        // Send a refresh_notifications WebSocket event
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'refresh_notifications'
            }));
          }
        });
      }
      
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
  
  // Delete a chat room (only the creator can delete it)
  app.delete("/api/rooms/:id", isAuthenticated, isEmailVerified, async (req, res) => {
    try {
      const roomId = parseInt(req.params.id);
      if (isNaN(roomId)) {
        return res.status(400).json({ message: "Invalid room ID" });
      }
      
      const userId = req.user!.id;
      
      // Check if room exists first
      const room = await storage.getChatRoom(roomId);
      if (!room) {
        return res.status(404).json({ message: "Room not found" });
      }
      
      // Check if user is the creator
      if (room.creatorId !== userId) {
        return res.status(403).json({ message: "You do not have permission to delete this room" });
      }
      
      const success = await storage.deleteChatRoom(roomId, userId);
      
      if (!success) {
        return res.status(500).json({ message: "Failed to delete chat room" });
      }
      
      res.json({ message: "Chat room deleted successfully" });
    } catch (error) {
      console.error("Error deleting chat room:", error);
      res.status(500).json({ message: "Failed to delete chat room" });
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

  // Room invitation API routes
  app.get("/api/room-invitations/received", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const invitations = await storage.getReceivedRoomInvitations(userId);
      
      // Enhance invitations with room and inviter info
      const enhancedInvitations = await Promise.all(
        invitations.map(async (invitation) => {
          const room = await storage.getChatRoom(invitation.roomId);
          const inviter = await storage.getUser(invitation.inviterId);
          
          return {
            ...invitation,
            room: room ? {
              id: room.id,
              name: room.name,
              description: room.description
            } : null,
            inviter: inviter ? {
              id: inviter.id,
              username: inviter.username,
              profilePicture: inviter.profilePicture
            } : null
          };
        })
      );
      
      res.json(enhancedInvitations);
    } catch (error) {
      console.error("Error getting received room invitations:", error);
      res.status(500).json({ message: "Failed to get received room invitations" });
    }
  });
  
  app.get("/api/room-invitations/sent", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const invitations = await storage.getSentRoomInvitations(userId);
      
      // Enhance invitations with room and invitee info
      const enhancedInvitations = await Promise.all(
        invitations.map(async (invitation) => {
          const room = await storage.getChatRoom(invitation.roomId);
          const invitee = await storage.getUser(invitation.inviteeId);
          
          return {
            ...invitation,
            room: room ? {
              id: room.id,
              name: room.name,
              description: room.description
            } : null,
            invitee: invitee ? {
              id: invitee.id,
              username: invitee.username,
              profilePicture: invitee.profilePicture
            } : null
          };
        })
      );
      
      res.json(enhancedInvitations);
    } catch (error) {
      console.error("Error getting sent room invitations:", error);
      res.status(500).json({ message: "Failed to get sent room invitations" });
    }
  });
  
  app.post("/api/room-invitations", isAuthenticated, isEmailVerified, async (req, res) => {
    try {
      const { roomId, inviteeId } = req.body;
      const inviterId = req.user!.id;
      
      if (!roomId || isNaN(roomId) || !inviteeId || isNaN(inviteeId)) {
        return res.status(400).json({ message: "Invalid room ID or invitee ID" });
      }
      
      // Check if room exists
      const room = await storage.getChatRoom(roomId);
      if (!room) {
        return res.status(404).json({ message: "Room not found" });
      }
      
      // Check if user is the room creator or has permission to invite
      if (room.creatorId !== inviterId) {
        return res.status(403).json({ message: "You don't have permission to invite users to this room" });
      }
      
      // Check if invitee exists
      const invitee = await storage.getUser(inviteeId);
      if (!invitee) {
        return res.status(404).json({ message: "Invitee not found" });
      }
      
      // Don't allow inviting self
      if (inviterId === inviteeId) {
        return res.status(400).json({ message: "You cannot invite yourself" });
      }
      
      // Create the invitation
      const invitation = await storage.createRoomInvitation({
        roomId,
        inviterId,
        inviteeId
      });
      
      // Send a refresh_notifications WebSocket event
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'refresh_notifications'
          }));
        }
      });
      
      res.status(201).json(invitation);
    } catch (error) {
      console.error("Error creating room invitation:", error);
      res.status(500).json({ message: "Failed to create room invitation" });
    }
  });
  
  app.patch("/api/room-invitations/:id", isAuthenticated, async (req, res) => {
    try {
      const invitationId = parseInt(req.params.id);
      const userId = req.user!.id;
      const { status } = req.body;
      
      if (isNaN(invitationId)) {
        return res.status(400).json({ message: "Invalid invitation ID" });
      }
      
      if (status !== 'accepted' && status !== 'declined') {
        return res.status(400).json({ message: "Status must be 'accepted' or 'declined'" });
      }
      
      // Get the invitation to check if this user is the invitee
      const invitations = await storage.getReceivedRoomInvitations(userId);
      const invitation = invitations.find(inv => inv.id === invitationId);
      
      if (!invitation) {
        return res.status(404).json({ 
          message: "Invitation not found or you're not authorized to respond" 
        });
      }
      
      // Update the invitation status
      const updatedInvitation = await storage.respondToRoomInvitation(invitationId, status);
      if (!updatedInvitation) {
        return res.status(400).json({ message: "Failed to respond to invitation" });
      }
      
      // Send a refresh_notifications WebSocket event
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'refresh_notifications'
          }));
        }
      });
      
      res.json(updatedInvitation);
    } catch (error) {
      console.error("Error responding to room invitation:", error);
      res.status(500).json({ message: "Failed to respond to room invitation" });
    }
  });

  app.post("/api/upload", isAuthenticated, isEmailVerified, upload.single('image'), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    
    // Return the file path that can be used to access the image
    const filePath = `/uploads/messages/${req.file.filename}`;
    res.json({ url: filePath });
  });

  // Posts API Routes
  app.get("/api/posts", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const posts = await storage.getPosts(userId);
      res.json(posts);
    } catch (error) {
      console.error("Error getting posts:", error);
      res.status(500).json({ message: "Failed to fetch posts" });
    }
  });

  app.get("/api/users/:userId/posts", isAuthenticated, async (req, res) => {
    try {
      const targetUserId = parseInt(req.params.userId);
      const currentUserId = req.user!.id;
      
      if (isNaN(targetUserId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      const posts = await storage.getPostsByUser(targetUserId, currentUserId);
      res.json(posts);
    } catch (error) {
      console.error("Error getting user posts:", error);
      res.status(500).json({ message: "Failed to fetch user posts" });
    }
  });

  app.post("/api/posts", isAuthenticated, isEmailVerified, async (req, res) => {
    try {
      const { content, imageUrl, visibility, autoDeleteHours } = req.body;
      const userId = req.user!.id;
      
      // Validate post data
      if (!content) {
        return res.status(400).json({ message: "Content is required" });
      }
      
      // Validate visibility
      if (visibility && !['public', 'followers', 'friends'].includes(visibility)) {
        return res.status(400).json({ message: "Invalid visibility value" });
      }
      
      // Set up auto-deletion if specified
      let autoDeleteAt = null;
      if (autoDeleteHours && !isNaN(Number(autoDeleteHours))) {
        const hours = Number(autoDeleteHours);
        if (hours > 0) {
          autoDeleteAt = new Date();
          autoDeleteAt.setHours(autoDeleteAt.getHours() + hours);
        }
      }
      
      const post = await storage.createPost({
        userId,
        content,
        imageUrl: imageUrl || null,
        visibility: visibility || 'public',
        autoDeleteAt
      });
      
      res.status(201).json(post);
    } catch (error) {
      console.error("Error creating post:", error);
      res.status(500).json({ message: "Failed to create post" });
    }
  });

  app.delete("/api/posts/:id", isAuthenticated, async (req, res) => {
    try {
      const postId = parseInt(req.params.id);
      const userId = req.user!.id;
      
      if (isNaN(postId)) {
        return res.status(400).json({ message: "Invalid post ID" });
      }
      
      const success = await storage.deletePost(postId, userId);
      
      if (!success) {
        return res.status(403).json({ message: "You don't have permission to delete this post or the post doesn't exist" });
      }
      
      res.json({ message: "Post deleted successfully" });
    } catch (error) {
      console.error("Error deleting post:", error);
      res.status(500).json({ message: "Failed to delete post" });
    }
  });

  // Post comment routes
  app.get("/api/posts/:id/comments", isAuthenticated, async (req, res) => {
    try {
      const postId = parseInt(req.params.id);
      if (isNaN(postId)) {
        return res.status(400).json({ message: "Invalid post ID" });
      }
      
      const comments = await storage.getPostComments(postId);
      res.json(comments);
    } catch (error) {
      console.error("Error fetching post comments:", error);
      res.status(500).json({ message: "Failed to fetch comments" });
    }
  });
  
  app.post("/api/posts/:id/comments", isAuthenticated, isEmailVerified, async (req, res) => {
    try {
      const postId = parseInt(req.params.id);
      if (isNaN(postId)) {
        return res.status(400).json({ message: "Invalid post ID" });
      }
      
      const { content } = req.body;
      if (!content || !content.trim()) {
        return res.status(400).json({ message: "Comment content is required" });
      }
      
      const userId = req.user!.id;
      const comment = await storage.createComment({
        content,
        userId,
        postId
      });
      
      res.status(201).json(comment);
    } catch (error) {
      console.error("Error creating comment:", error);
      res.status(500).json({ message: "Failed to create comment" });
    }
  });
  
  app.delete("/api/comments/:id", isAuthenticated, async (req, res) => {
    try {
      const commentId = parseInt(req.params.id);
      if (isNaN(commentId)) {
        return res.status(400).json({ message: "Invalid comment ID" });
      }
      
      const userId = req.user!.id;
      const result = await storage.deleteComment(commentId, userId);
      
      if (!result) {
        return res.status(403).json({ message: "Not authorized to delete this comment or comment not found" });
      }
      
      res.json({ message: "Comment deleted successfully" });
    } catch (error) {
      console.error("Error deleting comment:", error);
      res.status(500).json({ message: "Failed to delete comment" });
    }
  });
  
  // Post like routes
  app.post("/api/posts/:id/like", isAuthenticated, async (req, res) => {
    try {
      const postId = parseInt(req.params.id);
      if (isNaN(postId)) {
        return res.status(400).json({ message: "Invalid post ID" });
      }
      
      const userId = req.user!.id;
      const like = await storage.likePost(userId, postId);
      
      if (!like) {
        return res.status(400).json({ message: "Already liked this post" });
      }
      
      res.status(201).json(like);
    } catch (error) {
      console.error("Error liking post:", error);
      res.status(500).json({ message: "Failed to like post" });
    }
  });
  
  app.delete("/api/posts/:id/like", isAuthenticated, async (req, res) => {
    try {
      const postId = parseInt(req.params.id);
      if (isNaN(postId)) {
        return res.status(400).json({ message: "Invalid post ID" });
      }
      
      const userId = req.user!.id;
      const result = await storage.unlikePost(userId, postId);
      
      if (!result) {
        return res.status(400).json({ message: "Not liked this post or error occurred" });
      }
      
      res.json({ message: "Post unliked successfully" });
    } catch (error) {
      console.error("Error unliking post:", error);
      res.status(500).json({ message: "Failed to unlike post" });
    }
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
              
              // Get room info for better notification context
              const room = await storage.getChatRoom(data.roomId);
              
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
                
                // Get users who are in the room to send notifications
                // For simplicity, let's get all users with recent messages in the room
                const messages = await storage.getMessagesByRoomId(data.roomId);
                const userIds = new Set<number>();
                
                messages.forEach(msg => {
                  if (msg.userId !== clientInfo.userId) { // Don't notify the sender
                    userIds.add(msg.userId);
                  }
                });
                
                // Create notifications for each user
                Array.from(userIds).forEach(async (userId) => {
                  await storage.createNotification({
                    userId,
                    type: "message",
                    message: `${clientInfo.username} sent a message in ${room?.name || 'a chat room'}`,
                    actorId: clientInfo.userId,
                    entityType: "message",
                    entityId: newMessage.id
                  });
                });
                
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
                    
                    // Also send a refresh notifications event to all clients
                    client.send(JSON.stringify({
                      type: 'refresh_notifications'
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

  // AI Chatbot API Routes
  app.post("/api/ai/chat", isAuthenticated, async (req, res) => {
    try {
      const { message, conversationHistory, systemInstruction } = req.body;
      
      if (!message || typeof message !== 'string' || message.trim() === '') {
        return res.status(400).json({ message: "Message is required" });
      }
      
      // Validate conversation history if present
      if (conversationHistory && (!Array.isArray(conversationHistory) || 
          !conversationHistory.every(item => 
            item && typeof item === 'object' && 
            (item.role === 'user' || item.role === 'assistant') && 
            typeof item.content === 'string'))) {
        return res.status(400).json({ message: "Invalid conversation history format" });
      }
      
      // Get AI response with optional custom system instruction
      const aiResponse = await sendMessageToAI(message, conversationHistory, systemInstruction);
      
      res.json({ response: aiResponse });
    } catch (error) {
      console.error("Error in AI chat:", error);
      res.status(500).json({ message: "Failed to communicate with AI" });
    }
  });
  
  // Initialize AI conversation with default instructions
  app.get("/api/ai/initialize", isAuthenticated, async (req, res) => {
    try {
      const introduction = await initializeAIConversation();
      res.json({ introduction });
    } catch (error) {
      console.error("Error initializing AI conversation:", error);
      res.status(500).json({ message: "Failed to initialize AI conversation" });
    }
  });
  
  // Initialize AI conversation with custom instructions
  app.post("/api/ai/initialize-custom", isAuthenticated, async (req, res) => {
    try {
      const { systemInstruction } = req.body;
      
      if (!systemInstruction || typeof systemInstruction !== 'string') {
        return res.status(400).json({ message: "System instruction is required" });
      }
      
      const introduction = await initializeCustomAIConversation(systemInstruction);
      res.json({ introduction });
    } catch (error) {
      console.error("Error initializing custom AI conversation:", error);
      res.status(500).json({ message: "Failed to initialize custom AI conversation" });
    }
  });
  
  // Get similar users based on interests/hobbies
  app.get("/api/ai/similar-users", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      
      // Get current user
      const currentUser = await storage.getUser(userId);
      if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Make sure user has interests and hobbies
      if (!currentUser.hobbies && !currentUser.interests) {
        return res.status(400).json({ 
          message: "You need to set up your hobbies and interests first",
          isProfileComplete: false
        });
      }
      
      // Get all users except current user
      const allUsers = await storage.getAllUsersExcept(userId);
      
      // Find similar users using AI
      const similarUsers = await findSimilarUsers(
        currentUser.hobbies || "",
        currentUser.interests || "",
        allUsers.map((u: any) => ({
          id: u.id,
          username: u.username,
          hobbies: u.hobbies,
          interests: u.interests,
          currentActivities: u.currentActivities
        }))
      );
      
      res.json(similarUsers);
    } catch (error: any) {
      console.error("Error finding similar users:", error);
      
      // Check for rate limit errors
      if (error.status === 429 || (error.error && error.error.type === 'rate_limit_error')) {
        res.status(429).json({ 
          message: "Rate limit exceeded. Please try again in a minute.",
          retryAfter: parseInt(error.headers?.['retry-after'] || '60')
        });
      } else {
        res.status(500).json({ message: "Failed to find similar users" });
      }
    }
  });
  
  // Get meetup place recommendations for a chat room
  app.get("/api/ai/meetup-recommendations/:roomId", isAuthenticated, async (req, res) => {
    try {
      const roomId = parseInt(req.params.roomId);
      if (isNaN(roomId)) {
        return res.status(400).json({ message: "Invalid room ID" });
      }
      
      // Get the chat room
      const room = await storage.getChatRoom(roomId);
      if (!room) {
        return res.status(404).json({ message: "Chat room not found" });
      }
      
      // Get messages to analyze room activity
      const messages = await storage.getMessagesByRoomId(roomId);
      
      // Get all participants
      const seenParticipantIds = new Map<number, boolean>();
      messages.forEach(m => {
        seenParticipantIds.set(m.userId, true);
      });
      const participantIds = Array.from(seenParticipantIds.keys());
      const chatParticipantCount = participantIds.length;
      
      // Only make recommendations for active rooms with multiple participants
      if (messages.length < 20 || chatParticipantCount < 2) {
        return res.status(400).json({
          message: "The chat room needs to be more active to get meetup recommendations",
          isActive: false
        });
      }
      
      // Get participant profiles
      const participants = [];
      for (const pid of participantIds) {
        const user = await storage.getUser(pid);
        if (user) {
          participants.push(user);
        }
      }
      
      // Combine interests and activities
      const allInterests = participants
        .map(p => p.interests)
        .filter(Boolean)
        .join(", ");
        
      const allActivities = participants
        .map(p => p.currentActivities)
        .filter(Boolean)
        .join(", ");
      
      // Get meetup recommendations using AI
      const recommendations = await recommendMeetupPlaces(
        allInterests,
        allActivities,
        room.name,
        chatParticipantCount
      );
      
      res.json(recommendations);
    } catch (error: any) {
      console.error("Error getting meetup recommendations:", error);
      
      // Check for rate limit errors
      if (error.status === 429 || (error.error && error.error.type === 'rate_limit_error')) {
        res.status(429).json({ 
          message: "Rate limit exceeded. Please try again in a minute.",
          retryAfter: parseInt(error.headers?.['retry-after'] || '60')
        });
      } else {
        res.status(500).json({ message: "Failed to get meetup recommendations" });
      }
    }
  });

  return httpServer;
}
