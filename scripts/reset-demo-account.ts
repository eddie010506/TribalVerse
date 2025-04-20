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
 * Creates or resets a demo user account with a simple password
 */
async function resetDemoAccount() {
  try {
    console.log('Starting demo account setup...');
    
    // Check if the demo user exists
    const existingUser = await db.select().from(users).where(eq(users.username, 'demouser'));
    
    // Generate a hashed password for "password123"
    const hashedPassword = await hashPassword("password123");
    console.log(`Generated hash for password123: ${hashedPassword}`);
    
    if (existingUser.length > 0) {
      console.log('Demo user exists, updating password and verifying email...');
      
      // Update the demo user
      await db.update(users)
        .set({
          password: hashedPassword,
          emailVerified: true,
          email: 'demouser@stanford.edu'
        })
        .where(eq(users.username, 'demouser'));
        
      console.log('Demo user updated successfully!');
    } else {
      console.log('Creating new demo user...');
      
      // Create the demo user
      await db.insert(users).values({
        username: 'demouser',
        password: hashedPassword,
        email: 'demouser@stanford.edu',
        emailVerified: true,
        profilePicture: 'https://i.pravatar.cc/150?u=demouser',
        hobbies: '',
        interests: '',
        currentActivities: '',
        favoriteFood: ''
      });
      
      console.log('Demo user created successfully!');
    }
    
    // Also create/update the demo video account
    const existingDemoVideo = await db.select().from(users).where(eq(users.username, 'demovideo'));
    const videoPassword = await hashPassword("password123");
    
    if (existingDemoVideo.length > 0) {
      console.log('Demo video user exists, updating password and verifying email...');
      
      // Update the demo video user
      await db.update(users)
        .set({
          password: videoPassword,
          emailVerified: true,
          email: 'demovideo@stanford.edu'
        })
        .where(eq(users.username, 'demovideo'));
        
      console.log('Demo video user updated successfully!');
    } else {
      console.log('Creating new demo video user...');
      
      // Create the demo video user
      await db.insert(users).values({
        username: 'demovideo',
        password: videoPassword,
        email: 'demovideo@stanford.edu',
        emailVerified: true,
        profilePicture: 'https://i.pravatar.cc/150?u=demovideo',
        hobbies: '',
        interests: '',
        currentActivities: '',
        favoriteFood: ''
      });
      
      console.log('Demo video user created successfully!');
    }
    
    console.log('Demo accounts setup complete!');
    console.log('You can now log in with:');
    console.log('Username: demouser');
    console.log('Password: password123');
    console.log('-- or --');
    console.log('Username: demovideo');
    console.log('Password: password123');
    
  } catch (error) {
    console.error('Error setting up demo account:', error);
  } finally {
    process.exit(0);
  }
}

// Run the function
resetDemoAccount();