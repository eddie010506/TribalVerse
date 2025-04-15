import { createContext, ReactNode, useContext } from "react";
import { useQuery, useMutation, QueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, getQueryFn, queryClient } from "../lib/queryClient";
import { Post, PostWithUser } from "../types";

type PostsContextType = {
  posts: PostWithUser[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  createPostMutation: any;
  deletePostMutation: any;
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

  return (
    <PostsContext.Provider
      value={{
        posts,
        isLoading,
        isError,
        error,
        createPostMutation,
        deletePostMutation,
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

export function useUserPosts(userId: number) {
  const { toast } = useToast();
  
  return useQuery<PostWithUser[], Error>({
    queryKey: ["/api/users", userId, "posts"],
    queryFn: getQueryFn({ on401: "throw" }),
    staleTime: 60 * 1000, // 1 minute
    retry: 1,
    onError: (error: Error) => {
      toast({
        title: "Error fetching posts",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}