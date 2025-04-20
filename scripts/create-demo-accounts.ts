import { db } from '../server/db';
import { users } from '../shared/schema';
import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

/**
 * Hash a password for secure storage
 */
async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString('hex')}.${salt}`;
}

/**
 * Demo user profiles to create
 */
const demoUsers = [
  {
    username: "demovideo1",
    password: "demovideo123",
    email: "demovideo1@stanford.edu",
    emailVerified: true,
    profilePicture: "https://i.pravatar.cc/150?u=demovideo1",
    hobbies: "",
    interests: "",
    currentActivities: "",
    favoriteFood: ""
  },
  {
    username: "demovideo2",
    password: "demovideo123",
    email: "demovideo2@stanford.edu",
    emailVerified: true,
    profilePicture: "https://i.pravatar.cc/150?u=demovideo2",
    hobbies: "",
    interests: "",
    currentActivities: "",
    favoriteFood: ""
  }
];

/**
 * Create demo video accounts
 */
async function createDemoAccounts() {
  try {
    console.log("Creating demo video accounts...");
    
    for (const user of demoUsers) {
      // Check if user already exists
      const existingUser = await db.query.users.findFirst({
        where: (u, { eq }) => eq(u.username, user.username)
      });
      
      if (existingUser) {
        console.log(`User ${user.username} already exists, skipping...`);
        continue;
      }
      
      // Hash password
      const hashedPassword = await hashPassword(user.password);
      
      // Insert user
      await db.insert(users).values({
        ...user,
        password: hashedPassword
      });
      
      console.log(`Created user: ${user.username}`);
    }
    
    console.log("Demo accounts created successfully!");
  } catch (error) {
    console.error("Error creating demo accounts:", error);
  } finally {
    process.exit(0);
  }
}

// Run the script
createDemoAccounts();