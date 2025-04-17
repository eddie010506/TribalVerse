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
 * Generate a random user with hobbies and interests
 */
function generateRandomUser(index: number) {
  const username = `user${index}`;
  const email = `${username}@university.edu`;
  
  // List of possible hobbies
  const hobbies = [
    'Reading', 'Writing', 'Drawing', 'Painting', 'Photography', 'Hiking', 
    'Camping', 'Cycling', 'Swimming', 'Running', 'Yoga', 'Meditation', 
    'Cooking', 'Baking', 'Gardening', 'Traveling', 'Gaming', 'Programming', 
    'Dancing', 'Singing', 'Playing guitar', 'Playing piano', 'Chess', 
    'Woodworking', 'Knitting', 'Sewing', 'Pottery', 'Sculpting', 
    'Bird watching', 'Stargazing', 'Fishing', 'Rock climbing', 'Skiing', 
    'Snowboarding', 'Surfing', 'Sailing', 'Kayaking', 'Tennis', 'Golf', 
    'Basketball', 'Soccer', 'Volleyball', 'Football', 'Baseball', 'Bowling'
  ];
  
  // List of possible interests
  const interests = [
    'Artificial Intelligence', 'Machine Learning', 'Web Development', 'Mobile Apps', 
    'Blockchain', 'Cryptocurrency', 'Robotics', 'Space Exploration', 'Astronomy', 
    'Physics', 'Chemistry', 'Biology', 'Medicine', 'Psychology', 'Philosophy', 
    'History', 'Art History', 'Literature', 'Creative Writing', 'Poetry', 
    'Environmental Science', 'Climate Change', 'Sustainability', 'Renewable Energy', 
    'Politics', 'Economics', 'Finance', 'Business', 'Entrepreneurship', 
    'Marketing', 'Graphic Design', 'UI/UX Design', 'Architecture', 'Interior Design', 
    'Fashion', 'Film Making', 'Photography', 'Music Production', 'Jazz', 'Classical Music', 
    'Rock Music', 'Hip Hop', 'Electronic Music', 'Cooking', 'Baking', 'Nutrition', 
    'Fitness', 'Yoga', 'Meditation', 'Mental Health', 'Self-improvement'
  ];
  
  // Activities
  const activities = [
    'Studying for finals', 'Working on research projects', 'Attending workshops',
    'Going to the campus gym', 'Participating in clubs', 'Attending lectures',
    'Volunteering', 'Part-time job', 'Internship', 'Campus activities',
    'Working on side projects', 'Learning new skills', 'Preparing for grad school',
    'Job hunting', 'Taking online courses', 'Attending networking events',
    'Participating in hackathons', 'Joining study groups', 'Tutoring', 'Mentoring'
  ];
  
  // Randomly select 2-5 hobbies
  const userHobbies = [];
  const numHobbies = Math.floor(Math.random() * 4) + 2; // 2-5 hobbies
  for (let i = 0; i < numHobbies; i++) {
    const randomHobby = hobbies[Math.floor(Math.random() * hobbies.length)];
    if (!userHobbies.includes(randomHobby)) {
      userHobbies.push(randomHobby);
    }
  }
  
  // Randomly select 2-5 interests
  const userInterests = [];
  const numInterests = Math.floor(Math.random() * 4) + 2; // 2-5 interests
  for (let i = 0; i < numInterests; i++) {
    const randomInterest = interests[Math.floor(Math.random() * interests.length)];
    if (!userInterests.includes(randomInterest)) {
      userInterests.push(randomInterest);
    }
  }
  
  // Randomly select 1-3 activities
  const userActivities = [];
  const numActivities = Math.floor(Math.random() * 3) + 1; // 1-3 activities
  for (let i = 0; i < numActivities; i++) {
    const randomActivity = activities[Math.floor(Math.random() * activities.length)];
    if (!userActivities.includes(randomActivity)) {
      userActivities.push(randomActivity);
    }
  }
  
  return {
    username,
    email,
    password: 'password123', // Will be hashed
    hobbies: userHobbies.join(', '),
    interests: userInterests.join(', '),
    currentActivities: userActivities.join(', '),
    emailVerified: true,
    verificationToken: null,
    profilePicture: null,
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

/**
 * Main function to seed users
 */
async function seedUsers(count: number) {
  console.log(`Starting to seed ${count} users...`);
  
  // Generate user data
  const usersToCreate = [];
  for (let i = 2; i <= count + 1; i++) { // Start from 2 to avoid conflicts with existing user (id=1)
    const userData = generateRandomUser(i);
    // Hash the password
    userData.password = await hashPassword(userData.password);
    usersToCreate.push(userData);
  }
  
  // Insert users in batches to avoid overwhelming the database
  const batchSize = 10;
  for (let i = 0; i < usersToCreate.length; i += batchSize) {
    const batch = usersToCreate.slice(i, i + batchSize);
    await db.insert(users).values(batch);
    console.log(`Inserted users ${i + 1} to ${Math.min(i + batchSize, usersToCreate.length)}`);
  }
  
  console.log(`Successfully seeded ${count} users!`);
}

// Execute with the desired number of users
const userCount = 100;
seedUsers(userCount)
  .then(() => {
    console.log('Database seeding completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error seeding database:', error);
    process.exit(1);
  });