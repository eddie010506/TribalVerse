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

// Configure multer for image uploads
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage_config = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage_config,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Auth middleware
const isAuthenticated = (req: Request, res: Response, next: Function) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication routes
  setupAuth(app);
  
  // Serve uploaded files
  app.use('/uploads', express.static(uploadDir));

  // Chat rooms API
  app.get("/api/rooms", isAuthenticated, async (req, res) => {
    try {
      const rooms = await storage.getChatRooms();
      res.json(rooms);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch chat rooms" });
    }
  });

  app.post("/api/rooms", isAuthenticated, async (req, res) => {
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

  app.post("/api/upload", isAuthenticated, upload.single('image'), (req, res) => {
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
                const validatedData = insertMessageSchema.parse({
                  content: data.content,
                  imageUrl: data.imageUrl || null,
                  userId: clientInfo.userId,
                  roomId: data.roomId
                });
                
                const newMessage = await storage.createMessage(validatedData);
                
                // Broadcast to all clients in the same room
                const messageWithUser = {
                  ...newMessage,
                  user: {
                    id: clientInfo.userId,
                    username: clientInfo.username
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
