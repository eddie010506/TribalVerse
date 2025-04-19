import Anthropic from '@anthropic-ai/sdk';

// the newest Anthropic model is "claude-3-7-sonnet-20250219" which was released February 24, 2025
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Default system instructions for general assistants
const DEFAULT_SYSTEM_INSTRUCTION = "You are a friendly and helpful AI assistant in a chat room for educational purposes. You help students with homework, research, and general knowledge questions. Be concise, helpful, and educational in your responses. Avoid any harmful or inappropriate content.";

// Default system instructions for introduction (first message)
const DEFAULT_INTRO_SYSTEM_INSTRUCTION = "You are a friendly and helpful AI assistant in a chat room for educational purposes. You help students with homework, research, and general knowledge questions. Be concise, helpful, and educational in your responses. Avoid any harmful or inappropriate content. Your introduction should be brief (2-3 sentences max) and welcoming.";

// Profile setup instructions for guiding new users
const PROFILE_SETUP_INSTRUCTION = "You are a helpful AI assistant designed to help new users set up their profile. Your goal is to have a friendly conversation with the user to help them identify their hobbies, interests, current activities, and favorite foods. Ask questions one at a time, be conversational, and listen to their responses. Don't overwhelm them with too many questions at once. Make sure to ask them about their favorite foods or cuisines they enjoy. After gathering enough information, suggest a concise summary of their hobbies, interests, current activities, and favorite foods that they can use for their profile. The summary for each category should be 1-3 sentences maximum and highlight key points.";

/**
 * Sends a message to Claude AI and gets a response
 */
export async function sendMessageToAI(
  message: string, 
  conversationHistory?: Array<{ role: 'user' | 'assistant', content: string }>,
  systemInstruction?: string
): Promise<string> {
  try {
    // Format conversation history for Anthropic API
    const messages = [...(conversationHistory || [])];
    
    // Add the current message
    messages.push({ role: 'user', content: message });

    // Send the message to Claude
    const response: any = await anthropic.messages.create({
      model: 'claude-3-7-sonnet-20250219',
      max_tokens: 1024,
      messages,
      system: systemInstruction || DEFAULT_SYSTEM_INSTRUCTION
    });

    // Return the AI's response
    if (response.content && response.content.length > 0) {
      return response.content[0].text;
    } else {
      throw new Error('Unexpected response format from Anthropic API');
    }
  } catch (error) {
    console.error('Error sending message to Claude:', error);
    throw new Error('Failed to communicate with AI assistant');
  }
}

/**
 * Initializes a conversation with Claude AI using default instructions
 */
export async function initializeAIConversation(): Promise<string> {
  return await initializeCustomAIConversation(DEFAULT_INTRO_SYSTEM_INSTRUCTION);
}

/**
 * Initializes a conversation with Claude AI using custom system instructions
 */
export async function initializeCustomAIConversation(systemInstruction: string): Promise<string> {
  try {
    const response: any = await anthropic.messages.create({
      model: 'claude-3-7-sonnet-20250219',
      max_tokens: 1024,
      messages: [{ role: 'user', content: 'Hello, can you introduce yourself?' }],
      system: systemInstruction
    });

    // Return the AI's introduction
    if (response.content && response.content.length > 0) {
      return response.content[0].text;
    } else {
      throw new Error('Unexpected response format from Anthropic API');
    }
  } catch (error) {
    console.error('Error initializing AI conversation:', error);
    throw new Error('Failed to initialize AI conversation');
  }
}

/**
 * Analyzes user profiles to recommend similar users
 */
export async function findSimilarUsers(
  userHobbies: string,
  userInterests: string,
  userFavoriteFood: string | null,
  otherUsers: Array<{
    id: number;
    username: string;
    hobbies: string | null;
    interests: string | null;
    currentActivities: string | null;
    favoriteFood: string | null;
  }>
): Promise<{ users: Array<{ id: number; username: string; matchReason: string; profilePicture?: string | null; }> }> {
  try {
    const prompt = `
I need to find users with similar interests, hobbies, and food preferences to a target user. 

Target user's hobbies: "${userHobbies}"
Target user's interests: "${userInterests}"
Target user's favorite food: "${userFavoriteFood || 'Not specified'}"

Here are the other users with their hobbies, interests, and food preferences:
${otherUsers.map(user => `
User ID: ${user.id}
Username: ${user.username}
Hobbies: ${user.hobbies || 'Not specified'}
Interests: ${user.interests || 'Not specified'}
Current Activities: ${user.currentActivities || 'Not specified'}
Favorite Food: ${user.favoriteFood || 'Not specified'}
`).join('\n')}

Please analyze the data and provide me with a JSON object containing an array called "users" with the top 3-5 most similar users (or fewer if there aren't that many good matches). For each match, include the user ID, username, and a brief explanation of why they're a good match. The format should be:
{
  "users": [
    {
      "id": number,
      "username": string,
      "matchReason": string (brief explanation of the match),
      "profilePicture": null
    },
    ...
  ]
}

Only include users that have some genuine similarity. If there are no good matches, return an object with an empty users array.
`;

    const response: any = await anthropic.messages.create({
      model: 'claude-3-7-sonnet-20250219',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
      system: "You are a data analysis assistant that specializes in finding patterns and similarities between users based on their hobbies, interests, and food preferences. Always respond with valid JSON only, no explanations or additional text."
    });

    // Return the AI's analysis
    if (response.content && response.content.length > 0) {
      try {
        const jsonResponse = JSON.parse(response.content[0].text);
        // Ensure we return an object with a users array 
        return {
          users: Array.isArray(jsonResponse) ? jsonResponse.map(user => ({
            ...user,
            profilePicture: null
          })) : (jsonResponse.users || [])
        };
      } catch (parseError) {
        console.error('Error parsing JSON response:', parseError);
        return { users: [] };
      }
    } else {
      throw new Error('Unexpected response format from Anthropic API');
    }
  } catch (error) {
    console.error('Error finding similar users:', error);
    return { users: [] };
  }
}

/**
 * Initializes a profile setup conversation with the AI
 */
export async function initializeProfileSetup(username: string): Promise<string> {
  try {
    const response: any = await anthropic.messages.create({
      model: 'claude-3-7-sonnet-20250219',
      max_tokens: 1024,
      messages: [{ 
        role: 'user', 
        content: `Hi, I'm ${username}. I'm a new user and need help setting up my profile.` 
      }],
      system: PROFILE_SETUP_INSTRUCTION
    });

    // Return the AI's introduction
    if (response.content && response.content.length > 0) {
      return response.content[0].text;
    } else {
      throw new Error('Unexpected response format from Anthropic API');
    }
  } catch (error) {
    console.error('Error initializing profile setup:', error);
    throw new Error('Failed to initialize profile setup conversation');
  }
}

/**
 * Analyzes a conversation with the user to extract profile information
 */
export async function analyzeProfileSetupConversation(
  conversationHistory: Array<{ role: 'user' | 'assistant', content: string }>
): Promise<{ hobbies: string; interests: string; currentActivities: string; favoriteFood: string | null } | null> {
  try {
    const analysisPrompt = `
Based on our conversation so far, please analyze what you've learned about me and create a concise summary for my profile in these four categories:
1. Hobbies
2. Interests 
3. Current Activities
4. Favorite Food

For each category, provide 1-3 sentences that capture the essence of what I've shared.
`;
    
    // Add the analysis request to the conversation
    const messages = [...conversationHistory];
    messages.push({ role: 'user', content: analysisPrompt });
    
    const response: any = await anthropic.messages.create({
      model: 'claude-3-7-sonnet-20250219',
      max_tokens: 1024,
      messages,
      system: "You are a profile analysis assistant. Based on the conversation, extract the user's hobbies, interests, current activities, and favorite foods. Format your response to clearly label each section. Be concise and accurate."
    });

    if (!response.content || response.content.length === 0) {
      throw new Error('Unexpected response format from Anthropic API');
    }

    const aiResponse = response.content[0].text;
    
    // Process the AI response to extract the sections - using simpler regex to avoid incompatibility
    const hobbiesSectionRegex = /(Hobbies|1\.?)\s+([\s\S]*?)(Interests|2\.?)/i;
    const interestsSectionRegex = /(Interests|2\.?)\s+([\s\S]*?)(Current Activities|3\.?)/i;
    const activitiesSectionRegex = /(Current Activities|3\.?)\s+([\s\S]*?)(Favorite Food|4\.?|$|\n\n)/i;
    const favoriteFoodRegex = /(Favorite Food|4\.?)\s+([\s\S]*?)($|\n\n)/i;
    
    const hobbiesMatch = hobbiesSectionRegex.exec(aiResponse);
    const interestsMatch = interestsSectionRegex.exec(aiResponse);
    const activitiesMatch = activitiesSectionRegex.exec(aiResponse);
    const favoriteFoodMatch = favoriteFoodRegex.exec(aiResponse);
    
    if (hobbiesMatch && interestsMatch && activitiesMatch) {
      return {
        hobbies: hobbiesMatch[2].trim(),
        interests: interestsMatch[2].trim(),
        currentActivities: activitiesMatch[2].trim(),
        favoriteFood: favoriteFoodMatch ? favoriteFoodMatch[2].trim() : null
      };
    } else {
      console.error('Failed to extract profile sections from AI response');
      return null;
    }
  } catch (error) {
    console.error('Error analyzing profile setup conversation:', error);
    return null;
  }
}

export async function recommendMeetupPlaces(
  interests: string,
  activities: string,
  chatRoomName: string,
  chatParticipantCount: number,
  foodPreferences?: string
): Promise<{ places: Array<{ name: string; description: string; reasonToVisit: string; rating?: string; }> }> {
  try {
    // Real restaurant data near 321 Golf Club Rd, Pleasant Hill, CA 94523 with ratings over 4.0
    const restaurantData = [
      {
        name: "Zachary's Chicago Pizza",
        description: "Deep dish Chicago-style pizza restaurant",
        rating: "4.6",
        cuisine: "Pizza, Italian",
        address: "140 Crescent Dr, Pleasant Hill"
      },
      {
        name: "Nama Sushi",
        description: "Japanese restaurant serving fresh sushi and traditional dishes",
        rating: "4.5",
        cuisine: "Japanese, Sushi",
        address: "1506 Contra Costa Blvd, Pleasant Hill"
      },
      {
        name: "Slow Hand BBQ",
        description: "Texas-style barbecue restaurant with homemade sides",
        rating: "4.4",
        cuisine: "BBQ, American",
        address: "1941 Oak Park Blvd, Pleasant Hill"
      },
      {
        name: "Limon Rotisserie",
        description: "Peruvian restaurant known for rotisserie chicken and ceviche",
        rating: "4.3",
        cuisine: "Peruvian, Latin American",
        address: "60 Crescent Dr, Pleasant Hill"
      },
      {
        name: "Jack's Restaurant & Bar",
        description: "American restaurant with casual dining and diverse menu",
        rating: "4.2",
        cuisine: "American, Bar",
        address: "60 Crescent Dr, Pleasant Hill"
      },
      {
        name: "Burma 2",
        description: "Burmese restaurant with authentic dishes",
        rating: "4.5",
        cuisine: "Burmese, Asian Fusion",
        address: "1616 N Main St, Walnut Creek"
      },
      {
        name: "Yalla Mediterranean",
        description: "Fast-casual Mediterranean restaurant with fresh ingredients",
        rating: "4.3",
        cuisine: "Mediterranean, Middle Eastern",
        address: "1813 Mt Diablo Blvd, Walnut Creek"
      },
      {
        name: "Millie's Kitchen",
        description: "Cozy breakfast and lunch spot with homemade specialties",
        rating: "4.4",
        cuisine: "American, Breakfast",
        address: "1018 Oak St, Clayton"
      },
      {
        name: "Patxi's Pizza",
        description: "Chicago-style deep dish and thin crust pizza restaurant",
        rating: "4.3",
        cuisine: "Pizza, Italian",
        address: "185 Crescent Dr, Pleasant Hill"
      },
      {
        name: "Koi Palace Express",
        description: "Authentic dim sum and Cantonese cuisine",
        rating: "4.2",
        cuisine: "Chinese, Dim Sum",
        address: "Pleasant Hill"
      },
      {
        name: "Rooftop Restaurant & Bar",
        description: "Modern American cuisine with rooftop views",
        rating: "4.2",
        cuisine: "American, Bar",
        address: "1500 Mt Diablo Blvd, Walnut Creek"
      },
      {
        name: "Babalou's Mediterranean",
        description: "Fresh Mediterranean cuisine with homemade pita bread",
        rating: "4.3",
        cuisine: "Mediterranean, Greek",
        address: "Downtown Pleasant Hill"
      },
      {
        name: "Los Panchos Mexican Restaurant",
        description: "Family-owned Mexican restaurant with traditional recipes",
        rating: "4.4",
        cuisine: "Mexican",
        address: "5872 Pacheco Blvd, Pacheco"
      },
      {
        name: "Yard House",
        description: "Modern American restaurant with extensive beer selection",
        rating: "4.1",
        cuisine: "American, Bar",
        address: "Broadway Plaza, Walnut Creek"
      },
      {
        name: "Ramen Hiroshi",
        description: "Authentic Japanese ramen restaurant",
        rating: "4.4",
        cuisine: "Japanese, Ramen",
        address: "1633 Bonanza St, Walnut Creek"
      }
    ];

    // Filter restaurants based on food preferences if provided
    let filteredRestaurants = [...restaurantData];
    if (foodPreferences) {
      const preferencesLower = foodPreferences.toLowerCase();
      filteredRestaurants = restaurantData.filter(restaurant => {
        return (
          restaurant.cuisine.toLowerCase().includes(preferencesLower) || 
          restaurant.description.toLowerCase().includes(preferencesLower)
        );
      });
      
      // If no matches after filtering, use the original list
      if (filteredRestaurants.length === 0) {
        filteredRestaurants = restaurantData;
      }
    }
    
    // Select 3-5 restaurants randomly from the filtered list
    const selectedCount = Math.min(Math.floor(Math.random() * 3) + 3, filteredRestaurants.length);
    const shuffled = filteredRestaurants.sort(() => 0.5 - Math.random());
    const selectedRestaurants = shuffled.slice(0, selectedCount);
    
    // Now create personalized reasons to visit based on interests, activities, and chat room name
    const results = selectedRestaurants.map(restaurant => {
      // Generate a personalized reason to visit based on user data and restaurant type
      let reasonToVisit = `A great place for the ${chatRoomName} group with ${chatParticipantCount} people.`;
      
      // Add more personalized details based on food preferences if available
      if (foodPreferences) {
        if (restaurant.cuisine.toLowerCase().includes(foodPreferences.toLowerCase())) {
          reasonToVisit += ` Specifically matches your group's preference for ${foodPreferences}.`;
        }
      }
      
      // Add details about the atmosphere based on group interests
      if (interests.toLowerCase().includes("study") || interests.toLowerCase().includes("academic")) {
        reasonToVisit += " Has a suitable atmosphere for discussion and group activities.";
      } else if (interests.toLowerCase().includes("music") || interests.toLowerCase().includes("art")) {
        reasonToVisit += " Features a nice ambiance that's perfect for creative conversations.";
      } else if (interests.toLowerCase().includes("sport") || interests.toLowerCase().includes("fitness")) {
        reasonToVisit += " Offers hearty options perfect for after sports or fitness activities.";
      }
      
      return {
        name: restaurant.name,
        description: `${restaurant.description} (${restaurant.cuisine}) - Rating: ${restaurant.rating}/5`,
        reasonToVisit,
        rating: restaurant.rating
      };
    });
    
    return { places: results };
  } catch (error) {
    console.error('Error recommending meetup places:', error);
    return { places: [] };
  }
}