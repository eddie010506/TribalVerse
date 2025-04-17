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
const PROFILE_SETUP_INSTRUCTION = "You are a helpful AI assistant designed to help new users set up their profile. Your goal is to have a friendly conversation with the user to help them identify their hobbies, interests, and current activities. Ask questions one at a time, be conversational, and listen to their responses. Don't overwhelm them with too many questions at once. After gathering enough information, suggest a concise summary of their hobbies, interests, and current activities that they can use for their profile. The summary for each category should be 1-3 sentences maximum and highlight key points.";

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
  otherUsers: Array<{
    id: number;
    username: string;
    hobbies: string | null;
    interests: string | null;
    currentActivities: string | null;
  }>
): Promise<{ users: Array<{ id: number; username: string; matchReason: string; profilePicture?: string | null; }> }> {
  try {
    const prompt = `
I need to find users with similar interests and hobbies to a target user. 

Target user's hobbies: "${userHobbies}"
Target user's interests: "${userInterests}"

Here are the other users with their hobbies and interests:
${otherUsers.map(user => `
User ID: ${user.id}
Username: ${user.username}
Hobbies: ${user.hobbies || 'Not specified'}
Interests: ${user.interests || 'Not specified'}
Current Activities: ${user.currentActivities || 'Not specified'}
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
      system: "You are a data analysis assistant that specializes in finding patterns and similarities between users based on their hobbies and interests. Always respond with valid JSON only, no explanations or additional text."
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
): Promise<{ hobbies: string; interests: string; currentActivities: string } | null> {
  try {
    const analysisPrompt = `
Based on our conversation so far, please analyze what you've learned about me and create a concise summary for my profile in these three categories:
1. Hobbies
2. Interests 
3. Current Activities

For each category, provide 1-3 sentences that capture the essence of what I've shared.
`;
    
    // Add the analysis request to the conversation
    const messages = [...conversationHistory];
    messages.push({ role: 'user', content: analysisPrompt });
    
    const response: any = await anthropic.messages.create({
      model: 'claude-3-7-sonnet-20250219',
      max_tokens: 1024,
      messages,
      system: "You are a profile analysis assistant. Based on the conversation, extract the user's hobbies, interests, and current activities. Format your response to clearly label each section. Be concise and accurate."
    });

    if (!response.content || response.content.length === 0) {
      throw new Error('Unexpected response format from Anthropic API');
    }

    const aiResponse = response.content[0].text;
    
    // Process the AI response to extract the sections - using simpler regex to avoid incompatibility
    const hobbiesSectionRegex = /(Hobbies|1\.?)\s+([\s\S]*?)(Interests|2\.?)/i;
    const interestsSectionRegex = /(Interests|2\.?)\s+([\s\S]*?)(Current Activities|3\.?)/i;
    const activitiesSectionRegex = /(Current Activities|3\.?)\s+([\s\S]*?)($|\n\n)/i;
    
    const hobbiesMatch = hobbiesSectionRegex.exec(aiResponse);
    const interestsMatch = interestsSectionRegex.exec(aiResponse);
    const activitiesMatch = activitiesSectionRegex.exec(aiResponse);
    
    if (hobbiesMatch && interestsMatch && activitiesMatch) {
      return {
        hobbies: hobbiesMatch[2].trim(),
        interests: interestsMatch[2].trim(),
        currentActivities: activitiesMatch[2].trim()
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
  chatParticipantCount: number
): Promise<{ places: Array<{ name: string; description: string; reasonToVisit: string; }> }> {
  try {
    const prompt = `
I need to suggest places for students to meet up based on their interests and their chat room topic.

Chat room name: "${chatRoomName}"
Number of participants: ${chatParticipantCount}
Collective interests: "${interests}"
Current activities: "${activities}"

Please suggest 3-5 potential places on or near a college campus where these students could meet up based on their interests and the chat topic. Provide the results as a JSON object with a "places" array like this:
{
  "places": [
    {
      "name": string (name of the place),
      "description": string (brief description of the place),
      "reasonToVisit": string (why this place matches their interests/activities)
    },
    ...
  ]
}
`;

    const response: any = await anthropic.messages.create({
      model: 'claude-3-7-sonnet-20250219',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
      system: "You are a campus recommendation assistant that helps students find suitable places to meet up based on their interests and activities. Always respond with valid JSON only, no explanations or additional text."
    });

    // Return the AI's recommendations
    if (response.content && response.content.length > 0) {
      try {
        const jsonResponse = JSON.parse(response.content[0].text);
        // Ensure we return an object with a places array
        return {
          places: Array.isArray(jsonResponse) ? jsonResponse.map(place => ({
            name: place.name,
            description: place.type || place.description || "",
            reasonToVisit: place.reason || place.reasonToVisit || ""
          })) : (jsonResponse.places || [])
        };
      } catch (parseError) {
        console.error('Error parsing JSON response:', parseError);
        return { places: [] };
      }
    } else {
      throw new Error('Unexpected response format from Anthropic API');
    }
  } catch (error) {
    console.error('Error recommending meetup places:', error);
    return { places: [] };
  }
}