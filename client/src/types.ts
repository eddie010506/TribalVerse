export interface User {
  id: number;
  username: string;
  email: string | null;
  profilePicture: string | null;
  hobbies: string | null;
  interests: string | null;
  currentActivities: string | null;
  emailVerified: boolean;
}

export interface Post {
  id: number;
  userId: number;
  content: string;
  imageUrl: string | null;
  visibility: 'public' | 'followers' | 'friends';
  autoDeleteAt: string | null;
  createdAt: string;
}

export interface PostWithUser extends Post {
  user: {
    id: number;
    username: string;
    profilePicture: string | null;
  };
}

export interface ChatRoom {
  id: number;
  name: string;
  description: string | null;
  creatorId: number;
  isSelfChat: boolean;
  createdAt: string;
}

export interface Message {
  id: number;
  content: string;
  imageUrl: string | null;
  userId: number;
  roomId: number;
  createdAt: string;
}

export interface MessageWithUser extends Message {
  user: {
    id: number;
    username: string;
    profilePicture?: string | null;
  };
}