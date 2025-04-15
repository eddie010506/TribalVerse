import Anthropic from '@anthropic-ai/sdk';

// the newest Anthropic model is "claude-3-7-sonnet-20250219" which was released February 24, 2025
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Sends a message to Claude AI and gets a response
 */
export async function sendMessageToAI(
  message: string, 
  conversationHistory?: Array<{ role: 'user' | 'assistant', content: string }>
): Promise<string> {
  try {
    // Format conversation history for Anthropic API
    const messages = conversationHistory || [];
    
    // Add the current message
    messages.push({ role: 'user', content: message });

    // Send the message to Claude
    const response: any = await anthropic.messages.create({
      model: 'claude-3-7-sonnet-20250219',
      max_tokens: 1024,
      messages,
      system: "You are a friendly and helpful AI assistant in a chat room for educational purposes. You help students with homework, research, and general knowledge questions. Be concise, helpful, and educational in your responses. Avoid any harmful or inappropriate content."
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
 * Initializes a conversation with Claude AI
 */
export async function initializeAIConversation(): Promise<string> {
  try {
    const response: any = await anthropic.messages.create({
      model: 'claude-3-7-sonnet-20250219',
      max_tokens: 1024,
      messages: [{ role: 'user', content: 'Hello, can you introduce yourself?' }],
      system: "You are a friendly and helpful AI assistant in a chat room for educational purposes. You help students with homework, research, and general knowledge questions. Be concise, helpful, and educational in your responses. Avoid any harmful or inappropriate content. Your introduction should be brief (2-3 sentences max) and welcoming."
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