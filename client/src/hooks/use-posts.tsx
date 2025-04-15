import { createContext, ReactNode, useContext } from "react";
import { useQuery, useMutation, useQueryClient, UseMutationResult } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, getQueryFn, queryClient } from "../lib/queryClient";

// Define types inline to avoid import issues
export interface Post {
  id: number;
  userId: number;
  content: string;
  imageUrl: string | null;
  visibility: 'public' | 'followers' | 'friends';
  autoDeleteAt: string | null;
  createdAt: string;
}

export interface Comment {
  id: number;
  content: string;
  userId: number;
  postId: number;
  createdAt: string;
  user: {
    id: number;
    username: string;
    profilePicture: string | null;
  };
}

export interface PostWithUser extends Post {
  user: {
    id: number;
    username: string;
    profilePicture: string | null;
  };
  comments?: Comment[];
  commentCount?: number;
  likeCount?: number;
  isLikedByCurrentUser?: boolean;
}

type PostsContextType = {
  posts: PostWithUser[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  createPostMutation: any;
  deletePostMutation: any;
  likePostMutation: any;
  unlikePostMutation: any;
  createCommentMutation: any;
  deleteCommentMutation: any;
  getPostComments: (postId: number) => Promise<Comment[]>;
};

type CreatePostData = {
  content: string;
  imageUrl?: string;
  visibility: 'public' | 'followers' | 'friends';
  autoDeleteHours?: number;
};

export const PostsContext = createContext<PostsContextType | null>(null);

export function PostsProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();

  const {
    data: posts = [],
    isLoading,
    isError,
    error,
  } = useQuery<PostWithUser[], Error>({
    queryKey: ["/api/posts"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const createPostMutation = useMutation({
    mutationFn: async (data: CreatePostData) => {
      const res = await apiRequest("POST", "/api/posts", data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create post");
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      toast({
        title: "Post created",
        description: "Your post has been created successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error creating post",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deletePostMutation = useMutation({
    mutationFn: async (postId: number) => {
      const res = await apiRequest("DELETE", `/api/posts/${postId}`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to delete post");
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      toast({
        title: "Post deleted",
        description: "Your post has been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error deleting post",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const likePostMutation = useMutation({
    mutationFn: async (postId: number) => {
      const res = await apiRequest("POST", `/api/posts/${postId}/like`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to like post");
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error liking post",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const unlikePostMutation = useMutation({
    mutationFn: async (postId: number) => {
      const res = await apiRequest("DELETE", `/api/posts/${postId}/like`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to unlike post");
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error unliking post",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createCommentMutation = useMutation({
    mutationFn: async ({ postId, content }: { postId: number, content: string }) => {
      const res = await apiRequest("POST", `/api/posts/${postId}/comments`, { content });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to add comment");
      }
      return await res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/posts", variables.postId, "comments"] });
      toast({
        title: "Comment added",
        description: "Your comment has been added successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error adding comment",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async ({ commentId, postId }: { commentId: number, postId: number }) => {
      const res = await apiRequest("DELETE", `/api/comments/${commentId}`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to delete comment");
      }
      return await res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/posts", variables.postId, "comments"] });
      toast({
        title: "Comment deleted",
        description: "Your comment has been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error deleting comment",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Function to fetch comments for a specific post
  const getPostComments = async (postId: number): Promise<Comment[]> => {
    try {
      const response = await fetch(`/api/posts/${postId}/comments`);
      if (!response.ok) {
        throw new Error('Failed to fetch comments');
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching comments:', error);
      return [];
    }
  };

  return (
    <PostsContext.Provider
      value={{
        posts,
        isLoading,
        isError,
        error,
        createPostMutation,
        deletePostMutation,
        likePostMutation,
        unlikePostMutation,
        createCommentMutation,
        deleteCommentMutation,
        getPostComments,
      }}
    >
      {children}
    </PostsContext.Provider>
  );
}

export function usePosts() {
  const context = useContext(PostsContext);
  if (!context) {
    throw new Error("usePosts must be used within a PostsProvider");
  }
  return context;
}