import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import { sendVerificationEmail } from "./email";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "chat-app-secret-key",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false);
        } else {
          return done(null, user);
        }
      } catch (error) {
        return done(error);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        return res.status(400).send("Username already exists");
      }

      // Check if email is already in use
      if (req.body.email) {
        const existingEmail = await storage.getUserByEmail(req.body.email);
        if (existingEmail) {
          return res.status(400).send("Email is already in use");
        }
      }

      // Create a verification token if email is provided
      let verificationToken = null;
      if (req.body.email) {
        verificationToken = randomBytes(32).toString('hex');
      }

      const user = await storage.createUser({
        ...req.body,
        password: await hashPassword(req.body.password),
        verificationToken
      });

      // Send verification email if email was provided
      if (req.body.email && verificationToken) {
        await sendVerificationEmail(
          req.body.email, 
          req.body.username, 
          verificationToken
        );
      }

      // Don't return the password hash
      const userWithoutPassword = { 
        id: user.id, 
        username: user.username,
        emailVerified: user.emailVerified
      };

      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json(userWithoutPassword);
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/login", passport.authenticate("local"), (req, res) => {
    // Don't return the password hash
    const { id, username } = req.user as SelectUser;
    res.status(200).json({ id, username });
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  // Email verification endpoint
  app.get("/api/verify-email", async (req, res) => {
    const { token } = req.query;
    
    if (!token || typeof token !== 'string') {
      return res.status(400).send("Invalid verification token");
    }
    
    try {
      const user = await storage.verifyEmail(token);
      
      if (!user) {
        return res.status(400).send("Invalid or expired verification token");
      }
      
      // If user is logged in, update their session
      if (req.isAuthenticated() && req.user.id === user.id) {
        req.login(user, (err) => {
          if (err) {
            console.error("Error updating user session:", err);
          }
        });
      }
      
      // Redirect to a success page or profile
      res.redirect('/profile?verified=true');
    } catch (error) {
      console.error("Error verifying email:", error);
      res.status(500).send("Error verifying email");
    }
  });
  
  // Send verification email for logged-in user
  app.post("/api/send-verification-email", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }
    
    const user = req.user as SelectUser;
    
    if (user.emailVerified) {
      return res.status(400).send("Email is already verified");
    }
    
    if (!user.email) {
      return res.status(400).send("No email address associated with this account");
    }
    
    try {
      // Generate a new token
      const verificationToken = randomBytes(32).toString('hex');
      
      // Update the user's verification token
      const success = await storage.setVerificationToken(user.id, verificationToken);
      
      if (!success) {
        return res.status(500).send("Error generating verification token");
      }
      
      // Send the verification email
      const emailSent = await sendVerificationEmail(
        user.email,
        user.username,
        verificationToken
      );
      
      if (!emailSent) {
        return res.status(500).send("Error sending verification email");
      }
      
      res.status(200).send("Verification email sent");
    } catch (error) {
      console.error("Error sending verification email:", error);
      res.status(500).send("Error sending verification email");
    }
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    // Don't return the password hash but include email and verification status
    const { id, username, email, emailVerified, hobbies, interests, currentActivities } = req.user as SelectUser;
    res.json({ 
      id, 
      username, 
      email, 
      emailVerified, 
      hobbies, 
      interests, 
      currentActivities 
    });
  });
}
