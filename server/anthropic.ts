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
const PROFILE_SETUP_INSTRUCTION = `You are a helpful AI assistant designed to help new users set up their profile. Your goal is to have a friendly conversation with the user to help them identify their hobbies, interests, current activities, and favorite foods. FAVORITE FOODS ARE EXTREMELY IMPORTANT.

Ask questions one at a time, be conversational, and listen to their responses. Don't overwhelm them with too many questions at once.

During the conversation, you MUST specifically ask these questions (one at a time) in this exact order:
1. Ask about their hobbies and what they enjoy doing in their free time
2. Ask about their main interests or what topics fascinate them
3. Ask about their current activities or projects they're working on
4. ** CRITICALLY IMPORTANT ** You MUST ask directly and explicitly "What are your favorite foods or cuisines?" as a standalone question. This must be a separate question on its own. NEVER skip this question even if the user mentions food elsewhere. NEVER combine this with other questions.

DO NOT PROCEED TO PROFILE CREATION UNTIL THE USER HAS ANSWERED THE FAVORITE FOOD QUESTION!

After gathering information about ALL FOUR CATEGORIES (hobbies, interests, activities AND favorite foods), ask if they're ready to create their profile. Then suggest a concise summary that includes all four categories. Your summary MUST include a dedicated section for favorite foods. Label each section clearly:
1. Hobbies: (summary)
2. Interests: (summary)
3. Current Activities: (summary)
4. Favorite Food: (summary)

The summary for each category should be 1-3 sentences maximum and highlight key points.

*** IMPORTANT: If at any point the user wants to complete their profile without answering all questions, tell them that they need to answer the remaining questions, especially about favorite foods, before proceeding. ***

REMINDER: Do not proceed to the profile summary until you have explicitly asked about favorite foods as a standalone question and received a response.`;

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
      system: `You are a profile analysis assistant. Your PRIMARY GOAL is to extract the user's hobbies, interests, current activities, and ESPECIALLY their favorite foods from the conversation.

FORMAT YOUR RESPONSE WITH EXACTLY THESE FOUR NUMBERED SECTIONS:
1. Hobbies: (extracted information)
2. Interests: (extracted information)
3. Current Activities: (extracted information)
4. Favorite Food: (extracted information)

ALL FOUR CATEGORIES ARE ABSOLUTELY REQUIRED - DO NOT SKIP ANY SECTION.

THE FAVORITE FOOD SECTION (#4) IS THE MOST CRITICAL PART OF YOUR RESPONSE:
- Carefully examine the entire conversation for ANY mention of foods, cuisines, restaurants, dishes, or eating preferences
- Include ALL food-related information in section 4
- If the user has mentioned multiple foods, list them all
- If you are uncertain about the user's food preferences, respond with: "Information incomplete: The user has not clearly stated their favorite foods. Please explicitly ask what their favorite foods or cuisines are before proceeding."
- DO NOT invent or assume any food preferences

Be precise and extract only information that was explicitly shared in the conversation. Do not make up or infer information that wasn't directly stated by the user.`
    });

    if (!response.content || response.content.length === 0) {
      throw new Error('Unexpected response format from Anthropic API');
    }

    const aiResponse = response.content[0].text;
    
    console.log('Analyzing AI response:', aiResponse);
    
    // Create a fallback mechanism in case the AI doesn't format the response correctly
    let hobbies = "Not specified";
    let interests = "Not specified";
    let currentActivities = "Not specified";
    let favoriteFood = "Not specified";
    
    // Try to extract each section with multiple fallback patterns
    try {
      // Hobbies section extraction
      const hobbiesPatterns = [
        /(Hobbies|1\.?)\s*:?\s*([\s\S]*?)(?=(Interests|2\.?|$))/i,
        /(?:^|\n)(?:Hobbies|1\.?)[\s:]*([^\n]+)/i
      ];
      
      for (const pattern of hobbiesPatterns) {
        const match = pattern.exec(aiResponse);
        if (match && match.length > 1) {
          const extractedText = match[match.length-1].trim();
          if (extractedText && extractedText.length > 5) {
            hobbies = extractedText;
            break;
          }
        }
      }
      
      // Interests section extraction
      const interestsPatterns = [
        /(Interests|2\.?)\s*:?\s*([\s\S]*?)(?=(Current Activities|3\.?|$))/i,
        /(?:^|\n)(?:Interests|2\.?)[\s:]*([^\n]+)/i
      ];
      
      for (const pattern of interestsPatterns) {
        const match = pattern.exec(aiResponse);
        if (match && match.length > 1) {
          const extractedText = match[match.length-1].trim();
          if (extractedText && extractedText.length > 5) {
            interests = extractedText;
            break;
          }
        }
      }
      
      // Current Activities section extraction
      const activitiesPatterns = [
        /(Current Activities|3\.?)\s*:?\s*([\s\S]*?)(?=(Favorite Food|4\.?|$))/i,
        /(?:^|\n)(?:Current Activities|3\.?)[\s:]*([^\n]+)/i
      ];
      
      for (const pattern of activitiesPatterns) {
        const match = pattern.exec(aiResponse);
        if (match && match.length > 1) {
          const extractedText = match[match.length-1].trim();
          if (extractedText && extractedText.length > 5) {
            currentActivities = extractedText;
            break;
          }
        }
      }
      
      // Favorite Food section extraction - higher priority than other sections
      const foodPatterns = [
        // Standard numbered/titled patterns
        /(Favorite Food|4\.?)\s*:?\s*([\s\S]*?)(?=$)/i,
        /(?:^|\n)(?:Favorite Food|4\.?)[\s:]*([^\n]+)/i,
        /(Favorite Food|Food preferences|Cuisine preferences):\s*([\s\S]*?)(?=\n\n|\n[A-Z0-9]|$)/i,
        /4\.\s*([\s\S]*?)(?=\n\n|\n[A-Z0-9]|$)/i,
        // Look for lines with food keywords
        /(?:^|\n)[^:]*(?:favorite food|cuisine|food preference|like to eat)[\s:]*([^\n]+)/i,
        // Match "I enjoy eating X" patterns
        /(?:I|you) (?:enjoy|love|like|prefer) (?:eating|cooking|having) (.*?)(?:\.|$)/i,
        // Match direct food mentions after food question
        /(?:food|cuisine|dish)[^:]*: (.*?)(?:\.|$)/i
      ];
      
      // First do an overall food-related check of the entire conversation
      let hasDiscussedFood = false;
      for (const message of conversationHistory) {
        if ((message.role === 'assistant' && 
            (message.content.toLowerCase().includes('favorite food') || 
             message.content.toLowerCase().includes('favorite cuisine'))) ||
            (message.role === 'user' && 
             (message.content.toLowerCase().includes('food') || 
              message.content.toLowerCase().includes('eat') ||
              message.content.toLowerCase().includes('cuisine') || 
              message.content.toLowerCase().includes('dish')))) {
          hasDiscussedFood = true;
          console.log('Food discussion detected in conversation');
          break;
        }
      }
      
      // Try to extract food from AI's response first
      for (const pattern of foodPatterns) {
        const match = pattern.exec(aiResponse);
        if (match && match.length > 1) {
          const extractedText = match[match.length-1].trim();
          if (extractedText && extractedText.length > 2 && 
              extractedText.toLowerCase() !== 'not specified' &&
              !extractedText.toLowerCase().includes('information incomplete')) {
            favoriteFood = extractedText;
            console.log('Food extraction matched with pattern:', pattern);
            console.log('Extracted food text:', extractedText);
            break;
          }
        }
      }
      
      // If we couldn't find favorite food in the AI response, look in user messages
      if (favoriteFood === "Not specified" && hasDiscussedFood) {
        // Look for user's response to the food question
        let foodQuestionFound = false;
        
        for (let i = 0; i < conversationHistory.length; i++) {
          const message = conversationHistory[i];
          
          // First find the assistant's question about food
          if (message.role === 'assistant' && 
              (message.content.toLowerCase().includes('favorite food') || 
               message.content.toLowerCase().includes('cuisine') ||
               message.content.toLowerCase().includes('what do you like to eat'))) {
            
            foodQuestionFound = true;
            
            // Then look for the user's response right after
            if (i + 1 < conversationHistory.length && conversationHistory[i + 1].role === 'user') {
              const userResponse = conversationHistory[i + 1].content;
              console.log('Found user response to food question:', userResponse);
              favoriteFood = userResponse;
              break;
            }
          }
        }
        
        // If we still didn't find anything, look for any food mentions in user messages
        if (favoriteFood === "Not specified" || favoriteFood.length > 200) {
          for (const message of conversationHistory) {
            if (message.role === 'user' && 
                (message.content.toLowerCase().includes('food') || 
                 message.content.toLowerCase().includes('eat') ||
                 message.content.toLowerCase().includes('cuisine') || 
                 message.content.toLowerCase().includes('dish'))) {
              console.log('Food mention found in user message:', message.content);
              
              // Extract a shorter snippet if the message is too long
              if (message.content.length > 100) {
                const foodIndex = message.content.toLowerCase().indexOf('food');
                const cuisineIndex = message.content.toLowerCase().indexOf('cuisine');
                const eatIndex = message.content.toLowerCase().indexOf('eat');
                const dishIndex = message.content.toLowerCase().indexOf('dish');
                
                // Find the first occurrence of a food-related word
                const indices = [foodIndex, cuisineIndex, eatIndex, dishIndex]
                  .filter(idx => idx !== -1);
                  
                if (indices.length > 0) {
                  const firstIndex = Math.min(...indices);
                  // Extract a snippet around the food mention
                  favoriteFood = message.content.substring(
                    Math.max(0, firstIndex - 10), 
                    Math.min(message.content.length, firstIndex + 50)
                  );
                } else {
                  favoriteFood = message.content;
                }
              } else {
                favoriteFood = message.content;
              }
              break;
            }
          }
        }
        
        // Still not found, try keywords in the AI response
        if (favoriteFood === "Not specified" && aiResponse.toLowerCase().includes("food")) {
          const foodKeywords = ["like to eat", "favorite food", "enjoy eating", "foods I like", "cuisine", "dish", "meal", "restaurant", "taste", "flavor", "delicious"];
          for (const keyword of foodKeywords) {
            if (aiResponse.toLowerCase().includes(keyword)) {
              const index = aiResponse.toLowerCase().indexOf(keyword);
              // Extract a larger snippet to get the full context
              const snippet = aiResponse.substring(Math.max(0, index - 50), Math.min(aiResponse.length, index + 150));
              favoriteFood = snippet.split(/\.|\n/)[0].trim() + '.';
              console.log('Food extraction matched with keyword:', keyword);
              console.log('Extracted food text from context:', favoriteFood);
              break;
            }
          }
        }
      }
      
      console.log('Extracted profile data:', { hobbies, interests, currentActivities, favoriteFood });
      
      return {
        hobbies,
        interests,
        currentActivities,
        favoriteFood
      };
    } catch (error) {
      console.error('Error during regex extraction:', error);
      
      // Provide basic fallback values if all else fails
      return {
        hobbies: "Not specified. Please update manually.",
        interests: "Not specified. Please update manually.",
        currentActivities: "Not specified. Please update manually.",
        favoriteFood: "Not specified. Please update manually."
      };
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
): Promise<{ places: Array<{ name: string; description: string; reasonToVisit: string; rating?: string; priceRange?: string; }> }> {
  try {
    // Real restaurant data near 321 Golf Club Rd, Pleasant Hill, CA 94523 with ratings over 4.0
    const restaurantData = [
      {
        name: "Zachary's Chicago Pizza",
        description: "Deep dish Chicago-style pizza restaurant",
        rating: "4.6",
        cuisine: "Pizza, Italian",
        address: "140 Crescent Dr, Pleasant Hill",
        priceRange: "$15-25"
      },
      {
        name: "Nama Sushi",
        description: "Japanese restaurant serving fresh sushi and traditional dishes",
        rating: "4.5",
        cuisine: "Japanese, Sushi",
        address: "1506 Contra Costa Blvd, Pleasant Hill",
        priceRange: "$25-40"
      },
      {
        name: "Slow Hand BBQ",
        description: "Texas-style barbecue restaurant with homemade sides",
        rating: "4.4",
        cuisine: "BBQ, American",
        address: "1941 Oak Park Blvd, Pleasant Hill",
        priceRange: "$15-25"
      },
      {
        name: "Limon Rotisserie",
        description: "Peruvian restaurant known for rotisserie chicken and ceviche",
        rating: "4.3",
        cuisine: "Peruvian, Latin American",
        address: "60 Crescent Dr, Pleasant Hill",
        priceRange: "$20-35"
      },
      {
        name: "Jack's Restaurant & Bar",
        description: "American restaurant with casual dining and diverse menu",
        rating: "4.2",
        cuisine: "American, Bar",
        address: "60 Crescent Dr, Pleasant Hill",
        priceRange: "$15-30"
      },
      {
        name: "Burma 2",
        description: "Burmese restaurant with authentic dishes",
        rating: "4.5",
        cuisine: "Burmese, Asian Fusion",
        address: "1616 N Main St, Walnut Creek",
        priceRange: "$15-25"
      },
      {
        name: "Yalla Mediterranean",
        description: "Fast-casual Mediterranean restaurant with fresh ingredients",
        rating: "4.3",
        cuisine: "Mediterranean, Middle Eastern",
        address: "1813 Mt Diablo Blvd, Walnut Creek",
        priceRange: "$10-18"
      },
      {
        name: "Millie's Kitchen",
        description: "Cozy breakfast and lunch spot with homemade specialties",
        rating: "4.4",
        cuisine: "American, Breakfast",
        address: "1018 Oak St, Clayton",
        priceRange: "$10-18"
      },
      {
        name: "Patxi's Pizza",
        description: "Chicago-style deep dish and thin crust pizza restaurant",
        rating: "4.3",
        cuisine: "Pizza, Italian",
        address: "185 Crescent Dr, Pleasant Hill",
        priceRange: "$15-25"
      },
      {
        name: "Koi Palace Express",
        description: "Authentic dim sum and Cantonese cuisine",
        rating: "4.2",
        cuisine: "Chinese, Dim Sum",
        address: "Pleasant Hill",
        priceRange: "$12-30"
      },
      {
        name: "Rooftop Restaurant & Bar",
        description: "Modern American cuisine with rooftop views",
        rating: "4.2",
        cuisine: "American, Bar",
        address: "1500 Mt Diablo Blvd, Walnut Creek",
        priceRange: "$30-60"
      },
      {
        name: "Babalou's Mediterranean",
        description: "Fresh Mediterranean cuisine with homemade pita bread",
        rating: "4.3",
        cuisine: "Mediterranean, Greek",
        address: "Downtown Pleasant Hill",
        priceRange: "$12-25"
      },
      {
        name: "Los Panchos Mexican Restaurant",
        description: "Family-owned Mexican restaurant with traditional recipes",
        rating: "4.4",
        cuisine: "Mexican",
        address: "5872 Pacheco Blvd, Pacheco",
        priceRange: "$12-22"
      },
      {
        name: "Yard House",
        description: "Modern American restaurant with extensive beer selection",
        rating: "4.1",
        cuisine: "American, Bar",
        address: "Broadway Plaza, Walnut Creek",
        priceRange: "$20-35"
      },
      {
        name: "Ramen Hiroshi",
        description: "Authentic Japanese ramen restaurant",
        rating: "4.4",
        cuisine: "Japanese, Ramen",
        address: "1633 Bonanza St, Walnut Creek",
        priceRange: "$12-20"
      },
      {
        name: "Ruth's Chris Steak House",
        description: "Upscale steakhouse chain known for sizzling steaks",
        rating: "4.4",
        cuisine: "Steakhouse, Fine Dining",
        address: "1553 Olympic Blvd, Walnut Creek",
        priceRange: "$40-80"
      },
      {
        name: "In-N-Out Burger",
        description: "Popular fast food burger chain with simple menu",
        rating: "4.5",
        cuisine: "Fast Food, Burgers",
        address: "570 Contra Costa Blvd, Pleasant Hill",
        priceRange: "$5-10"
      },
      {
        name: "Fleming's Prime Steakhouse",
        description: "Upscale steakhouse with fine wines",
        rating: "4.3",
        cuisine: "Steakhouse, Fine Dining",
        address: "1685 Mt. Diablo Blvd, Walnut Creek",
        priceRange: "$45-90"
      },
      {
        name: "Chipotle Mexican Grill",
        description: "Fast-casual Mexican restaurant with customizable options",
        rating: "4.0",
        cuisine: "Mexican, Fast Casual",
        address: "35 Crescent Dr, Pleasant Hill",
        priceRange: "$10-15"
      },
      {
        name: "P.F. Chang's",
        description: "Asian-themed restaurant chain with diverse menu",
        rating: "4.0",
        cuisine: "Chinese, Asian Fusion",
        address: "1330 Rosewood Dr, Walnut Creek",
        priceRange: "$18-30"
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
        rating: restaurant.rating,
        priceRange: restaurant.priceRange
      };
    });
    
    return { places: results };
  } catch (error) {
    console.error('Error recommending meetup places:', error);
    return { places: [] };
  }
}