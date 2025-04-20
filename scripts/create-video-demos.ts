import { db } from '../server/db';
import { users } from '../shared/schema';
import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';
import { eq } from 'drizzle-orm';

const scryptAsync = promisify(scrypt);

/**
 * Hash a password for secure storage
 */
async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

/**
 * Creates or resets video demo accounts
 */
async function createVideoDemos() {
  try {
    console.log('Creating video demo accounts...');
    
    // Define the demo accounts
    const demoAccounts = [
      {
        username: 'demovideo1',
        email: 'demovideo1@stanford.edu',
        profilePicture: 'https://i.pravatar.cc/150?u=demovideo1'
      },
      {
        username: 'demovideo2',
        email: 'demovideo2@stanford.edu',
        profilePicture: 'https://i.pravatar.cc/150?u=demovideo2'
      }
    ];
    
    // Generate a hashed password for "password123"
    const hashedPassword = await hashPassword("password123");
    console.log(`Generated hash for password123: ${hashedPassword}`);
    
    // Create or update each account
    for (const account of demoAccounts) {
      const existingUser = await db.select().from(users).where(eq(users.username, account.username));
      
      if (existingUser.length > 0) {
        console.log(`Updating ${account.username}...`);
        
        // Update the user
        await db.update(users)
          .set({
            password: hashedPassword,
            emailVerified: true,
            email: account.email
          })
          .where(eq(users.username, account.username));
          
        console.log(`${account.username} updated successfully!`);
      } else {
        console.log(`Creating new user ${account.username}...`);
        
        // Create the user
        await db.insert(users).values({
          username: account.username,
          password: hashedPassword,
          email: account.email,
          emailVerified: true,
          profilePicture: account.profilePicture,
          hobbies: '',
          interests: '',
          currentActivities: '',
          favoriteFood: ''
        });
        
        console.log(`${account.username} created successfully!`);
      }
    }
    
    console.log('Video demo accounts setup complete!');
    console.log('You can now log in with:');
    console.log('Username: demovideo1');
    console.log('Password: password123');
    console.log('-- or --');
    console.log('Username: demovideo2');
    console.log('Password: password123');
    
  } catch (error) {
    console.error('Error setting up video demo accounts:', error);
  } finally {
    process.exit(0);
  }
}

// Run the function
createVideoDemos();