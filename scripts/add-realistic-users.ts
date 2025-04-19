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
 * Our realistic user profiles
 */
const realisticUsers = [
  {
    username: "alex_smith",
    password: "pass123",
    email: "alex.smith@berkeley.edu",
    profilePicture: "https://i.pravatar.cc/150?u=alex_smith",
    hobbies: "Photography, Hiking, Reading",
    interests: "Artificial Intelligence, Environmental Science, Modern Art",
    currentActivities: "Research assistant at the Computer Science department, Volunteer at campus sustainability club",
    favoriteFood: "Thai curry, Sushi, Homemade pasta"
  },
  {
    username: "emma_johnson",
    password: "pass123",
    email: "emma.j@stanford.edu",
    profilePicture: "https://i.pravatar.cc/150?u=emma_johnson",
    hobbies: "Piano, Yoga, Documentary filmmaking",
    interests: "Neuroscience, Classical literature, Jazz music",
    currentActivities: "President of debate club, Working on research paper about cognitive development",
    favoriteFood: "Mediterranean mezze, Seafood paella, Dark chocolate"
  },
  {
    username: "michael_wang",
    password: "pass123",
    email: "mwang@mit.edu",
    profilePicture: "https://i.pravatar.cc/150?u=michael_wang",
    hobbies: "Basketball, Chess, Cooking",
    interests: "Quantum computing, Financial markets, Urban planning",
    currentActivities: "Internship at tech startup, Captain of intramural basketball team",
    favoriteFood: "Szechuan hot pot, Dim sum, Korean BBQ"
  },
  {
    username: "sofia_garcia",
    password: "pass123",
    email: "sgarcia@ucla.edu",
    profilePicture: "https://i.pravatar.cc/150?u=sofia_garcia",
    hobbies: "Salsa dancing, Poetry writing, Painting",
    interests: "Latin American literature, Public health, Sustainability",
    currentActivities: "Volunteering at local clinic, Editor for campus literary magazine",
    favoriteFood: "Authentic tacos, Ceviche, Churros with chocolate"
  },
  {
    username: "james_wilson",
    password: "pass123",
    email: "jwilson@nyu.edu",
    profilePicture: "https://i.pravatar.cc/150?u=james_wilson",
    hobbies: "DJing, Street photography, Skateboarding",
    interests: "Urban culture, Electronic music, Documentary films",
    currentActivities: "Working part-time at record store, Running a podcast about city life",
    favoriteFood: "New York pizza, Craft burgers, Ethiopian cuisine"
  },
  {
    username: "olivia_chen",
    password: "pass123",
    email: "ochen@cornell.edu",
    profilePicture: "https://i.pravatar.cc/150?u=olivia_chen",
    hobbies: "Figure skating, Violin, Baking",
    interests: "Molecular biology, Classical music, French cinema",
    currentActivities: "Research in biochemistry lab, Teaching assistant for introductory biology",
    favoriteFood: "Japanese ramen, Fresh pastries, Matcha desserts"
  },
  {
    username: "noah_patel",
    password: "pass123",
    email: "npatel@umich.edu",
    profilePicture: "https://i.pravatar.cc/150?u=noah_patel",
    hobbies: "Rock climbing, Podcast hosting, Coffee roasting",
    interests: "Renewable energy, Machine learning, Contemporary fiction",
    currentActivities: "Leading clean energy student initiative, Developing ML algorithm for class project",
    favoriteFood: "Indian street food, Wood-fired pizza, Specialty coffee"
  },
  {
    username: "ava_robinson",
    password: "pass123",
    email: "arobinson@columbia.edu",
    profilePicture: "https://i.pravatar.cc/150?u=ava_robinson",
    hobbies: "Modern dance, Political activism, Vintage shopping",
    interests: "International relations, Gender studies, Contemporary art",
    currentActivities: "Interning at non-profit, Choreographing for dance troupe",
    favoriteFood: "Vegan cuisine, Middle Eastern mezze, Farm-to-table salads"
  },
  {
    username: "ethan_nguyen",
    password: "pass123",
    email: "enguyen@ucdavis.edu",
    profilePicture: "https://i.pravatar.cc/150?u=ethan_nguyen",
    hobbies: "Mountain biking, Gardening, Amateur astronomy",
    interests: "Agricultural science, Sustainable farming, Ecology",
    currentActivities: "Working at campus farm, Researching soil conservation",
    favoriteFood: "Farm-fresh vegetables, Vietnamese pho, Artisanal cheese"
  },
  {
    username: "zoe_miller",
    password: "pass123",
    email: "zmiller@uw.edu",
    profilePicture: "https://i.pravatar.cc/150?u=zoe_miller",
    hobbies: "Pottery, Hiking, Volunteering",
    interests: "Marine biology, Climate activism, Indigenous art",
    currentActivities: "Field research in marine ecosystems, Organizing climate awareness events",
    favoriteFood: "Sustainable seafood, Pacific Northwest cuisine, Foraged mushroom dishes"
  }
];

/**
 * Main function to add realistic users
 */
async function addRealisticUsers() {
  console.log("Adding realistic users to the database...");
  
  try {
    // Hash passwords and create users
    for (const userData of realisticUsers) {
      const hashedPassword = await hashPassword(userData.password);
      
      // Check if user already exists
      const existingUser = await db.select().from(users).where(eq(users.username, userData.username));
      
      if (existingUser.length === 0) {
        await db.insert(users).values({
          ...userData,
          password: hashedPassword,
          emailVerified: true
        });
        console.log(`Added user: ${userData.username}`);
      } else {
        console.log(`User ${userData.username} already exists, skipping`);
      }
    }
    
    console.log("Successfully added realistic users!");
  } catch (error) {
    console.error("Error adding users:", error);
  } finally {
    // Close the database connection
    process.exit(0);
  }
}

// Run the function
addRealisticUsers();