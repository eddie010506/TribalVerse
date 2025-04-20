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
// We need to access the constant
import { default as Anthropic } from '@anthropic-ai/sdk';

import { 
  sendMessageToAI, 
  initializeAIConversation, 
  initializeCustomAIConversation,
  findSimilarUsers,
  recommendMeetupPlaces,
  initializeProfileSetup,
  analyzeProfileSetupConversation
} from "./anthropic";

// Profile setup instructions for guiding new users
const PROFILE_SETUP_INSTRUCTION = "You are a helpful AI assistant designed to help new users set up their profile. Your goal is to have a friendly conversation with the user to help them identify their hobbies, interests, and current activities. Ask questions one at a time, be conversational, and listen to their responses. Don't overwhelm them with too many questions at once. After gathering enough information, suggest a concise summary of their hobbies, interests, and current activities that they can use for their profile. The summary for each category should be 1-3 sentences maximum and highlight key points.";

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

// Clean up expired recommendations from cache - runs every hour
function scheduleRecommendationCleanup() {
  const cleanupInterval = 60 * 60 * 1000; // 1 hour
  
  async function cleanup() {
    try {
      await storage.clearExpiredUserRecommendations();
      await storage.clearExpiredPlaceRecommendations();
      console.log("Cleaned up expired recommendations", new Date().toISOString());
    } catch (error) {
      console.error("Error cleaning up recommendations:", error);
    }
  }
  
  // Run immediately
  cleanup();
  
  // Schedule periodic cleanup
  setInterval(cleanup, cleanupInterval);
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Schedule recommendation cache cleanup
  scheduleRecommendationCleanup();
  // Setup authentication routes
  setupAuth(app);
  
  // Serve uploaded files
  app.use('/uploads', express.static(uploadsDir));
  
  // Dedicated search API with a path that can't be confused with user IDs
  app.get("/api/user-search", isAuthenticated, async (req, res) => {
    try {
      const query = req.query.q as string | undefined;
      
      // Better logging to help debug
      console.log("User search API called with query:", query, "from user ID:", req.user?.id);
      
      // Return empty results if no query provided
      if (!query || query.trim() === '') {
        console.log("Empty query, returning empty results");
        return res.json([]);
      }
      
      // Use the dedicated search method from storage
      const results = await storage.searchUsers(query, req.user?.id || 0);
      
      console.log(`Search API returned ${results.length} results for query "${query}"`);
      res.json(results);
    } catch (error) {
      console.error("Error searching users:", error);
      res.status(500).json({ message: "Failed to search users" });
    }
  });

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
        favoriteFood: z.string().optional(),
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

  // We're removing this route and creating it with a different path

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
      const userId = req.user!.id;
      
      // Get rooms created by the user
      const userCreatedRooms = await storage.getChatRoomsByCreatorId(userId);
      
      // Get rooms the user has been invited to and accepted
      const acceptedInvitationRooms = await storage.getRoomsUserHasAccessTo(userId);
      
      // Combine the lists, ensuring no duplicates
      const allRoomIds = new Set();
      const allRooms = [];
      
      // Add user created rooms first
      for (const room of userCreatedRooms) {
        allRoomIds.add(room.id);
        allRooms.push(room);
      }
      
      // Add invitation rooms if not already included
      for (const room of acceptedInvitationRooms) {
        if (!allRoomIds.has(room.id)) {
          allRoomIds.add(room.id);
          allRooms.push(room);
        }
      }
      
      res.json(allRooms);
    } catch (error) {
      console.error("Error fetching chat rooms:", error);
      res.status(500).json({ message: "Failed to fetch chat rooms" });
    }
  });

  app.post("/api/rooms", isAuthenticated, isEmailVerified, async (req, res) => {
    try {
      // Check if this is a self-chat room
      const isSelfChat = Boolean(req.body.isSelfChat);
      const isPublic = Boolean(req.body.isPublic);
      
      // A room cannot be both self-chat and public
      if (isSelfChat && isPublic) {
        return res.status(400).json({ message: "A room cannot be both self-chat and public" });
      }
      
      // Parse category and tags for public rooms
      let category = req.body.category || null;
      let tags = req.body.tags || null;
      
      // Validate category and tags for public rooms
      if (isPublic) {
        if (!category) {
          return res.status(400).json({ message: "Public rooms require a category" });
        }
        
        // Normalize category (lowercase, trim)
        category = category.trim().toLowerCase();
        
        // Validate tags if provided
        if (tags) {
          // Convert comma-separated tags to normalized format
          if (typeof tags === 'string') {
            tags = tags.split(',')
              .map((tag: string) => tag.trim().toLowerCase())
              .filter((tag: string) => tag.length > 0)
              .join(',');
          }
        }
      }
      
      const validatedData = insertChatRoomSchema.parse({
        ...req.body,
        creatorId: req.user!.id,
        isSelfChat: isSelfChat,
        isPublic: isPublic,
        category: category,
        tags: tags
      });
      
      const room = await storage.createChatRoom(validatedData);
      
      // Handle invitations for private rooms
      if (!isSelfChat && !isPublic && req.body.invitees && Array.isArray(req.body.invitees)) {
        const senderId = req.user!.id;
        const roomId = room.id;
        
        // Send invitations to all invitees
        for (const receiverId of req.body.invitees) {
          // Skip if receiver ID is invalid
          if (typeof receiverId !== 'number' || isNaN(receiverId)) continue;
          
          // Skip if receiver is the creator
          if (receiverId === senderId) continue;
          
          // Check if user exists
          const receiver = await storage.getUser(receiverId);
          if (!receiver) continue;
          
          // Create the invitation
          await storage.createRoomInvitation({
            roomId,
            senderId,
            receiverId
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
      
      // For public rooms, generate AI-based recommendations for similar users
      if (isPublic) {
        try {
          // Get user profile for matching
          const creator = await storage.getUser(req.user!.id);
          
          // Only proceed if we have sufficient profile data
          if (creator && (creator.interests || creator.hobbies || creator.currentActivities)) {
            // Schedule this to run in the background so we don't block room creation
            setTimeout(async () => {
              try {
                // Get users with similar interests based on user profile and room details
                const allUsers = await storage.getAllUsersExcept(req.user!.id);
                
                // Combine room details and creator profile for better matching
                const userInterests = creator.interests || '';
                const userHobbies = creator.hobbies || '';
                const userActivities = creator.currentActivities || '';
                const roomName = room.name;
                const roomDescription = room.description || '';
                const roomCategory = room.category || '';
                const roomTags = room.tags || '';
                
                // Get up to 10 users who might be interested in this room
                const potentialUsers = allUsers.slice(0, 10);
                
                // Generate room recommendations for these users
                for (const user of potentialUsers) {
                  // Skip users without interests
                  if (!user.interests && !user.hobbies && !user.currentActivities) continue;
                  
                  // Compare interests and generate a match reason
                  const userProfile = {
                    interests: user.interests || '',
                    hobbies: user.hobbies || '',
                    activities: user.currentActivities || ''
                  };
                  
                  const roomProfile = {
                    name: roomName,
                    description: roomDescription,
                    category: roomCategory,
                    tags: roomTags
                  };
                  
                  let matchReason = '';
                  
                  // Simple matching logic - will be improved with AI in the future
                  if (userProfile.interests.toLowerCase().includes(roomCategory.toLowerCase())) {
                    matchReason = `This room's topic matches your interests`;
                  } else if (userProfile.hobbies.toLowerCase().includes(roomCategory.toLowerCase())) {
                    matchReason = `This room involves one of your hobbies`;
                  } else if (roomTags && roomTags.split(',').some(tag => 
                    userProfile.interests.toLowerCase().includes(tag.toLowerCase()) || 
                    userProfile.hobbies.toLowerCase().includes(tag.toLowerCase())
                  )) {
                    matchReason = `This room has tags related to your interests`;
                  } else {
                    matchReason = `You might find this room interesting`;
                  }
                  
                  // Create recommendation with expiration (24h from now)
                  const expiresAt = new Date();
                  expiresAt.setHours(expiresAt.getHours() + 24);
                  
                  // For public rooms, we need to generate room recommendations
                  // instead of user recommendations
                  await storage.createRoomRecommendation({
                    userId: user.id,
                    roomId: room.id,
                    matchReason,
                    expiresAt
                  });
                }
              } catch (error) {
                console.error("Error generating room recommendations:", error);
              }
            }, 100); // Small delay to not block response
          }
        } catch (error) {
          console.error("Error setting up room recommendations:", error);
          // Don't fail room creation if recommendation generation fails
        }
      }
      
      res.status(201).json(room);
    } catch (error) {
      console.error("Error creating room:", error);
      res.status(400).json({ message: "Invalid room data" });
    }
  });

  app.get("/api/rooms/:id", isAuthenticated, async (req, res) => {
    try {
      const roomId = parseInt(req.params.id);
      const userId = req.user!.id;
      
      if (isNaN(roomId)) {
        return res.status(400).json({ message: "Invalid room ID" });
      }
      
      const room = await storage.getChatRoom(roomId);
      if (!room) {
        return res.status(404).json({ message: "Room not found" });
      }
      
      // Check if user has access to this room
      // 1. User is the creator
      if (room.creatorId === userId) {
        return res.json(room);
      }
      
      // 2. Room is a self-chat - only accessible by creator
      if (room.isSelfChat) {
        return res.status(403).json({ message: "You do not have permission to access this room" });
      }
      
      // 3. Room is public and user is a member
      if (room.isPublic) {
        const isMember = await storage.isRoomMember(userId, roomId);
        if (!isMember) {
          return res.status(403).json({ 
            message: "You need to join this public room first",
            isPublic: true
          });
        }
        return res.json(room);
      }
      
      // 4. User has an accepted invitation for a private room
      const invitations = await storage.getReceivedRoomInvitations(userId);
      const hasAcceptedInvitation = invitations.some(
        inv => inv.roomId === roomId && inv.status === 'accepted'
      );
      
      if (!hasAcceptedInvitation) {
        return res.status(403).json({ message: "You do not have permission to access this room" });
      }
      
      res.json(room);
    } catch (error) {
      console.error("Error fetching room:", error);
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
      const userId = req.user!.id;
      
      if (isNaN(roomId)) {
        return res.status(400).json({ message: "Invalid room ID" });
      }
      
      // Check if room exists
      const room = await storage.getChatRoom(roomId);
      if (!room) {
        return res.status(404).json({ message: "Room not found" });
      }
      
      // Check if user has access to this room
      // 1. User is the creator
      if (room.creatorId !== userId) {
        // 2. Room is a self-chat - only accessible by creator
        if (room.isSelfChat) {
          return res.status(403).json({ message: "You do not have permission to access this room" });
        }
        
        // 3. For public rooms, check membership
        if (room.isPublic) {
          const isMember = await storage.isRoomMember(userId, roomId);
          if (!isMember) {
            return res.status(403).json({ 
              message: "You need to join this public room first",
              isPublic: true
            });
          }
        } else {
          // 4. For private rooms, check for an accepted invitation
          const invitations = await storage.getReceivedRoomInvitations(userId);
          const hasAcceptedInvitation = invitations.some(
            inv => inv.roomId === roomId && inv.status === 'accepted'
          );
          
          if (!hasAcceptedInvitation) {
            return res.status(403).json({ message: "You do not have permission to access this room" });
          }
        }
      }
      
      const messages = await storage.getMessagesByRoomId(roomId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching room messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  // Room invitation API routes
  app.get("/api/room-invitations/received", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const invitations = await storage.getReceivedRoomInvitations(userId);
      
      // Enhance invitations with room and sender info
      const enhancedInvitations = await Promise.all(
        invitations.map(async (invitation) => {
          const room = await storage.getChatRoom(invitation.roomId);
          const sender = await storage.getUser(invitation.senderId);
          
          return {
            ...invitation,
            room: room ? {
              id: room.id,
              name: room.name,
              description: room.description
            } : null,
            sender: sender ? {
              id: sender.id,
              username: sender.username,
              profilePicture: sender.profilePicture
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
      
      // Enhance invitations with room and receiver info
      const enhancedInvitations = await Promise.all(
        invitations.map(async (invitation) => {
          const room = await storage.getChatRoom(invitation.roomId);
          const receiver = await storage.getUser(invitation.receiverId);
          
          return {
            ...invitation,
            room: room ? {
              id: room.id,
              name: room.name,
              description: room.description
            } : null,
            receiver: receiver ? {
              id: receiver.id,
              username: receiver.username,
              profilePicture: receiver.profilePicture
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
      const { roomId, userId } = req.body;
      const senderId = req.user!.id;
      
      if (!roomId || isNaN(roomId) || !userId || isNaN(userId)) {
        return res.status(400).json({ message: "Invalid room ID or user ID" });
      }
      
      // Check if room exists
      const room = await storage.getChatRoom(roomId);
      if (!room) {
        return res.status(404).json({ message: "Room not found" });
      }
      
      // Don't allow invitations to self chat rooms
      if (room.isSelfChat) {
        return res.status(403).json({ message: "Cannot invite users to a self chat room" });
      }
      
      // Check if the receiver exists
      const receiver = await storage.getUser(userId);
      if (!receiver) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Don't allow inviting self
      if (senderId === userId) {
        return res.status(400).json({ message: "You cannot invite yourself" });
      }
      
      // Check if invitation already exists
      const sentInvitations = await storage.getSentRoomInvitations(senderId);
      const existingInvitation = sentInvitations.find(
        inv => inv.roomId === roomId && inv.receiverId === userId && inv.status === 'pending'
      );
      
      if (existingInvitation) {
        return res.status(400).json({ message: "You have already invited this user to this room" });
      }
      
      // Create the invitation
      const invitation = await storage.createRoomInvitation({
        senderId: senderId,
        receiverId: userId,
        roomId: roomId,
        status: 'pending'
      });
      
      // Create notification for receiver
      await storage.createNotification({
        userId: userId,
        type: "room_invitation",
        message: `${req.user!.username} invited you to join "${room.name}"`,
        actorId: senderId,
        entityType: "room_invitation",
        entityId: invitation.id
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
      
      // Get the invitation to check if this user is the receiver
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
  
  // Initialize AI profile setup conversation
  app.get("/api/ai/initialize-profile-setup", isAuthenticated, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const introduction = await initializeProfileSetup(req.user.username);
      res.json({ introduction });
    } catch (error) {
      console.error("Error initializing profile setup:", error);
      res.status(500).json({ message: "Failed to initialize profile setup" });
    }
  });
  
  // Send message to AI during profile setup
  app.post("/api/ai/message", isAuthenticated, async (req, res) => {
    try {
      const { message, conversationHistory } = req.body;
      
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ message: "Valid message is required" });
      }
      
      if (!conversationHistory || !Array.isArray(conversationHistory)) {
        return res.status(400).json({ message: "Valid conversation history is required" });
      }
      
      const reply = await sendMessageToAI(message, conversationHistory, PROFILE_SETUP_INSTRUCTION);
      res.json({ reply });
    } catch (error) {
      console.error("Error sending message to AI:", error);
      res.status(500).json({ message: "Failed to get response from AI" });
    }
  });
  
  // Analyze profile setup conversation to extract profile data
  app.post("/api/ai/analyze-profile", isAuthenticated, async (req, res) => {
    try {
      const { conversationHistory } = req.body;
      
      if (!conversationHistory || !Array.isArray(conversationHistory)) {
        return res.status(400).json({ message: "Valid conversation history is required" });
      }
      
      const profileData = await analyzeProfileSetupConversation(conversationHistory);
      
      if (!profileData) {
        return res.status(422).json({ message: "Failed to extract profile data from conversation" });
      }
      
      res.json(profileData);
    } catch (error) {
      console.error("Error analyzing profile setup conversation:", error);
      res.status(500).json({ message: "Failed to analyze profile setup conversation" });
    }
  });
  
  // Get similar users based on interests/hobbies (algorithm-based approach)
  app.get("/api/ai/similar-users", isAuthenticated, async (req, res) => {
    try {
      // Add a small delay to prevent excessive API calls (100-150ms)
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 50));
      
      const userId = req.user!.id;
      
      // Get current user
      const currentUser = await storage.getUser(userId);
      if (!currentUser) {
        return res.status(404).json({ message: "User not found", users: [] });
      }
      
      // Make sure user has basic profile information
      const hasHobbies = !!currentUser.hobbies;
      const hasInterests = !!currentUser.interests;
      const hasFavoriteFood = !!currentUser.favoriteFood;
      
      // Check if profile is sufficiently complete for recommendations
      if (!hasHobbies && !hasInterests && !hasFavoriteFood) {
        return res.status(400).json({ 
          message: "You need to complete your profile with hobbies, interests, or favorite food preferences",
          isProfileComplete: false,
          users: []
        });
      }
      
      // First check if we have cached recommendations
      const cachedRecommendations = await storage.getSimilarUserRecommendations(userId);
      
      if (cachedRecommendations.length > 0) {
        // Return cached recommendations
        const recommendedUsers = await Promise.all(
          cachedRecommendations.map(async (rec) => {
            const user = await storage.getUser(rec.recommendedUserId);
            if (!user) return null;
            
            return {
              id: user.id,
              username: user.username,
              profilePicture: user.profilePicture,
              matchReason: rec.matchReason || "Similar interests"
            };
          })
        );
        
        // Filter out null values (in case a user was deleted)
        const validUsers = recommendedUsers.filter(user => user !== null);
        
        return res.json({
          users: validUsers,
          fromCache: true
        });
      }
      
      // No cached recommendations, get all users except current user
      const allUsers = await storage.getAllUsersExcept(userId);
      
      // User's interests, hobbies, and favorite foods
      const userHobbies = (currentUser.hobbies || "").toLowerCase().split(",").map((h: string) => h.trim()).filter((h: string) => h);
      const userInterests = (currentUser.interests || "").toLowerCase().split(",").map((i: string) => i.trim()).filter((i: string) => i);
      const userFavoriteFoods = (currentUser.favoriteFood || "").toLowerCase().split(",").map((f: string) => f.trim()).filter((f: string) => f);
      
      // Algorithm-based similarity calculation
      const scoredUsers = allUsers
        .map((otherUser: any) => {
          // Calculate similarity score
          let score = 0;
          let matchReasons: string[] = [];
          
          // Parse other user's hobbies, interests, and favorite foods
          const otherHobbies = (otherUser.hobbies || "").toLowerCase().split(",").map((h: string) => h.trim()).filter((h: string) => h);
          const otherInterests = (otherUser.interests || "").toLowerCase().split(",").map((i: string) => i.trim()).filter((i: string) => i);
          const otherFavoriteFoods = (otherUser.favoriteFood || "").toLowerCase().split(",").map((f: string) => f.trim()).filter((f: string) => f);
          
          // Calculate hobby matches
          const hobbyMatches = userHobbies.filter(hobby => otherHobbies.some((oh: string) => oh.includes(hobby) || hobby.includes(oh)));
          score += hobbyMatches.length * 2; // Hobbies are weighted higher
          
          if (hobbyMatches.length > 0) {
            if (hobbyMatches.length === 1) {
              matchReasons.push(`Shares hobby: ${hobbyMatches[0]}`);
            } else {
              matchReasons.push(`Shares ${hobbyMatches.length} hobbies including ${hobbyMatches.slice(0, 2).join(", ")}`);
            }
          }
          
          // Calculate interest matches
          const interestMatches = userInterests.filter(interest => otherInterests.some((oi: string) => oi.includes(interest) || interest.includes(oi)));
          score += interestMatches.length;
          
          if (interestMatches.length > 0) {
            if (interestMatches.length === 1) {
              matchReasons.push(`Similar interest: ${interestMatches[0]}`);
            } else {
              matchReasons.push(`Shares ${interestMatches.length} interests including ${interestMatches.slice(0, 2).join(", ")}`);
            }
          }
          
          // Calculate favorite food matches
          const foodMatches = userFavoriteFoods.filter(food => otherFavoriteFoods.some((of: string) => of.includes(food) || food.includes(of)));
          score += foodMatches.length * 1.5; // Food preferences are weighted between hobbies and interests
          
          if (foodMatches.length > 0) {
            if (foodMatches.length === 1) {
              matchReasons.push(`Similar food taste: ${foodMatches[0]}`);
            } else {
              matchReasons.push(`Shares ${foodMatches.length} favorite foods including ${foodMatches.slice(0, 2).join(", ")}`);
            }
          }
          
          // Generate match reason
          let matchReason = matchReasons.length > 0 
            ? matchReasons.join(". ") 
            : "Recommended based on profile similarity";
          
          return {
            user: otherUser,
            score,
            matchReason
          };
        })
        .filter(item => item.score > 0) // Only keep users with some similarity
        .sort((a, b) => b.score - a.score) // Sort by highest score first
        .slice(0, 5); // Get top 5 matches
      
      // Format the results - always return {users: [...]} format
      const users = scoredUsers.map(item => ({
        id: item.user.id,
        username: item.user.username,
        profilePicture: item.user.profilePicture,
        matchReason: item.matchReason
      }));
      
      // Cache the recommendations if we have any
      if (users.length > 0) {
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24); // Cache for 24 hours
        
        // Delete existing recommendations first
        await pool.query('DELETE FROM user_recommendations WHERE user_id = $1', [userId]);
        
        // Save each recommendation to the cache
        await Promise.all(users.map(async (user: any) => {
          await storage.createUserRecommendation({
            userId,
            recommendedUserId: user.id,
            matchReason: user.matchReason,
            expiresAt
          });
        }));
      }
      
      // Return in consistent format
      return res.json({ users });
    } catch (error: any) {
      console.error("Error in similar users route:", error);
      res.status(500).json({ 
        message: "Failed to find similar users", 
        users: [] 
      });
    }
  });
  
  // Get meetup place recommendations for a chat room
  app.get("/api/ai/meetup-recommendations/:roomId", isAuthenticated, async (req, res) => {
    try {
      // Add a small delay to prevent excessive API calls (100-150ms)
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 50));
      
      const roomId = parseInt(req.params.roomId);
      if (isNaN(roomId)) {
        return res.status(400).json({ message: "Invalid room ID", places: [] });
      }
      
      // Get the chat room
      const room = await storage.getChatRoom(roomId);
      if (!room) {
        return res.status(404).json({ 
          message: "Chat room not found",
          places: [] 
        });
      }
      
      // First check if we have cached recommendations
      const cachedRecommendations = await storage.getPlaceRecommendations(roomId);
      
      if (cachedRecommendations.length > 0) {
        // Transform cached recommendations to expected format
        return res.json({
          places: cachedRecommendations.map(rec => ({
            name: rec.placeName || rec.name || '',
            description: rec.description || rec.type || '',
            reasonToVisit: rec.reason || '',
            rating: rec.rating || '',
            priceRange: rec.priceRange || ''
          })),
          fromCache: true
        });
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
          isActive: false,
          places: []
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
      
      // Combine interests, activities, and food preferences
      const allInterests = participants
        .map(p => p.interests)
        .filter(Boolean)
        .join(", ");
        
      const allActivities = participants
        .map(p => p.currentActivities)
        .filter(Boolean)
        .join(", ");
        
      const allFoodPreferences = participants
        .map(p => p.favoriteFood)
        .filter(Boolean)
        .join(", ");
      
      try {
        // Get meetup recommendations using AI with food preferences
        const recommendations = await recommendMeetupPlaces(
          allInterests,
          allActivities,
          room.name,
          chatParticipantCount,
          allFoodPreferences
        );
        
        // Cache the recommendations
        if (recommendations.places && recommendations.places.length > 0) {
          const expiresAt = new Date();
          expiresAt.setHours(expiresAt.getHours() + 24); // Cache for 24 hours
          
          // Save each recommendation to the cache
          await Promise.all(recommendations.places.map(async (place: any) => {
            try {
              await storage.createPlaceRecommendation({
                roomId,
                placeName: place.name,
                name: place.name,
                description: place.description || '',
                reason: place.reasonToVisit || '',
                rating: place.rating || '',
                priceRange: place.priceRange || '',
                expiresAt
              });
            } catch (error) {
              console.error("Error creating place recommendation:", error, place);
            }
          }));
        }
        
        return res.json(recommendations);
      } catch (error: any) {
        console.error("Error getting meetup recommendations with AI:", error);
        
        // Check for rate limit errors
        if (error.status === 429 || (error.error && error.error.type === 'rate_limit_error')) {
          return res.status(429).json({ 
            message: "Rate limit exceeded. Please try again in a minute.",
            retryAfter: parseInt(error.headers?.['retry-after'] || '60')
          });
        } else {
          // Return empty result on other errors
          return res.json({ 
            places: [], 
            message: "No recommendations available at this time. Please try again later."
          });
        }
      }
    } catch (error: any) {
      console.error("Error in meetup recommendations route:", error);
      res.status(500).json({ 
        message: "Failed to get meetup recommendations", 
        places: [] 
      });
    }
  });

  // Public chat rooms API
  app.get("/api/public-rooms", isAuthenticated, async (req, res) => {
    try {
      // Get all public chat rooms
      const publicRooms = await storage.getPublicChatRooms();
      
      // Get the user's joined rooms to mark which ones they're already in
      const userId = req.user!.id;
      const userMemberships = await storage.getRoomMembershipsForUser(userId);
      const userRoomIds = new Set(userMemberships.map(m => m.roomId));
      
      // Add a 'isMember' property to each room
      const roomsWithMemberStatus = publicRooms.map(room => ({
        ...room,
        isMember: room.creatorId === userId || userRoomIds.has(room.id)
      }));
      
      res.json(roomsWithMemberStatus);
    } catch (error) {
      console.error("Error fetching public chat rooms:", error);
      res.status(500).json({ message: "Failed to fetch public chat rooms" });
    }
  });
  
  // Get AI room recommendations
  app.get("/api/public-rooms/recommendations", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      
      // Check if user has a complete profile for better recommendations
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Check if user has interests, hobbies, or activities defined
      const hasProfile = Boolean(user.interests || user.hobbies || user.currentActivities);
      
      // Get recommended public rooms for this user
      const recommendations = await storage.getRoomRecommendations(userId);
      
      // Get detailed room info for each recommendation
      const detailedRecommendations = await Promise.all(
        recommendations.map(async (rec) => {
          const room = await storage.getChatRoom(rec.roomId);
          if (!room) return null;
          
          return {
            ...room,
            matchReason: rec.matchReason
          };
        })
      );
      
      // Filter out null values (in case a room was deleted)
      const validRecommendations = detailedRecommendations.filter(r => r !== null);
      
      res.json({
        rooms: validRecommendations,
        isProfileComplete: hasProfile,
        message: hasProfile ? 
          "Here are some rooms that match your interests" : 
          "Complete your profile to get better recommendations"
      });
    } catch (error) {
      console.error("Error fetching room recommendations:", error);
      res.status(500).json({ 
        message: "Failed to fetch room recommendations", 
        rooms: [] 
      });
    }
  });
  
  // Join a public room
  app.post("/api/public-rooms/:id/join", isAuthenticated, isEmailVerified, async (req, res) => {
    try {
      const roomId = parseInt(req.params.id);
      if (isNaN(roomId)) {
        return res.status(400).json({ message: "Invalid room ID" });
      }
      
      const userId = req.user!.id;
      
      // Check if room exists and is public
      const room = await storage.getChatRoom(roomId);
      if (!room) {
        return res.status(404).json({ message: "Room not found" });
      }
      
      if (!room.isPublic) {
        return res.status(403).json({ message: "This room is not public" });
      }
      
      // Check if user is already a member
      const isMember = await storage.isRoomMember(userId, roomId);
      if (isMember) {
        return res.status(400).json({ message: "You are already a member of this room" });
      }
      
      // Join the room
      const membership = await storage.joinPublicRoom(userId, roomId);
      if (!membership) {
        return res.status(500).json({ message: "Failed to join room" });
      }
      
      // Create notification for room creator
      if (room.creatorId !== userId) {
        const user = await storage.getUser(userId);
        await storage.createNotification({
          userId: room.creatorId,
          type: 'room_join',
          actorId: userId,
          entityId: roomId,
          entityType: 'chat_room',
          message: `${user?.username || 'Someone'} joined your room "${room.name}"`,
          isRead: false,
        });
      }
      
      res.status(200).json({ message: "Successfully joined room", roomId, membership });
    } catch (error) {
      console.error("Error joining public room:", error);
      res.status(500).json({ message: "Failed to join room" });
    }
  });
  
  // Leave a room
  app.post("/api/rooms/:id/leave", isAuthenticated, async (req, res) => {
    try {
      const roomId = parseInt(req.params.id);
      if (isNaN(roomId)) {
        return res.status(400).json({ message: "Invalid room ID" });
      }
      
      const userId = req.user!.id;
      
      // Check if room exists
      const room = await storage.getChatRoom(roomId);
      if (!room) {
        return res.status(404).json({ message: "Room not found" });
      }
      
      // Creator cannot leave their own room
      if (room.creatorId === userId) {
        return res.status(400).json({ message: "You cannot leave a room you created" });
      }
      
      // Check if user is a member
      const isMember = await storage.isRoomMember(userId, roomId);
      if (!isMember) {
        return res.status(400).json({ message: "You are not a member of this room" });
      }
      
      // Leave the room
      const success = await storage.leaveRoom(userId, roomId);
      if (!success) {
        return res.status(500).json({ message: "Failed to leave room" });
      }
      
      res.status(200).json({ message: "Successfully left room" });
    } catch (error) {
      console.error("Error leaving room:", error);
      res.status(500).json({ message: "Failed to leave room" });
    }
  });
  
  // Get room members
  app.get("/api/rooms/:id/members", isAuthenticated, async (req, res) => {
    try {
      const roomId = parseInt(req.params.id);
      if (isNaN(roomId)) {
        return res.status(400).json({ message: "Invalid room ID" });
      }
      
      const userId = req.user!.id;
      
      // Check if room exists
      const room = await storage.getChatRoom(roomId);
      if (!room) {
        return res.status(404).json({ message: "Room not found" });
      }
      
      // Check if user has access to this room
      const hasAccess = await storage.isRoomMember(userId, roomId);
      if (!hasAccess && !room.isPublic) {
        return res.status(403).json({ message: "You do not have permission to access this room" });
      }
      
      // Get room members
      const members = await storage.getRoomMembers(roomId);
      res.json(members);
    } catch (error) {
      console.error("Error fetching room members:", error);
      res.status(500).json({ message: "Failed to fetch room members" });
    }
  });

  return httpServer;
}
