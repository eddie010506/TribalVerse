import { db } from '../server/db';
import { users } from '../shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Create a demo video account with a fixed password
 */
async function createDemoVideo() {
  try {
    console.log("Creating demo video account...");
    
    // Check if demovideo user exists
    const existingUser = await db.select().from(users).where(eq(users.username, 'demovideo'));
    
    if (existingUser.length) {
      console.log('Demo video user already exists, updating password...');
      
      // Set a simple password: password123
      const fixedPassword = 'bb60cd4163b5af91fa6117e3b2c1e07d17bf94f9fa864f0af91454ad14c3fccafe82ab7f9c68c2e30a62d0db4e3d6d8d3c6fbc6d85b12ea7b7bd0bc0e22aaa3.7ad7daec9a9d33d01d1eeff4c7ab7a9f';
      
      await db.update(users)
        .set({ 
          password: fixedPassword, 
          emailVerified: true,
          hobbies: '',
          interests: '',
          currentActivities: '',
          favoriteFood: ''
        })
        .where(eq(users.username, 'demovideo'));
        
      console.log('Password updated for demovideo');
      return;
    }
    
    // Create a new demo video user with a fixed, known password
    await db.insert(users).values({
      username: 'demovideo',
      password: 'bb60cd4163b5af91fa6117e3b2c1e07d17bf94f9fa864f0af91454ad14c3fccafe82ab7f9c68c2e30a62d0db4e3d6d8d3c6fbc6d85b12ea7b7bd0bc0e22aaa3.7ad7daec9a9d33d01d1eeff4c7ab7a9f', // password123
      email: 'demovideo@stanford.edu',
      emailVerified: true,
      profilePicture: 'https://i.pravatar.cc/150?u=demovideo',
      hobbies: '',
      interests: '',
      currentActivities: '',
      favoriteFood: ''
    });
    
    console.log('Created demovideo user with password: password123');
    
  } catch (error) {
    console.error('Error creating demo video account:', error);
  } finally {
    process.exit(0);
  }
}

// Run the script
createDemoVideo();