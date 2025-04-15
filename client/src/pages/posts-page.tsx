import { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { usePosts, PostsProvider, PostWithUser, PostComment } from "@/hooks/use-posts";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Image, Trash2, Globe, Users, UserRound, Clock, PlusCircle, Heart, MessageCircle, Send, X } from "lucide-react";
import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Link } from "wouter";
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';

function CreatePostForm() {
  const [content, setContent] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<"public" | "followers" | "friends">("public");
  const [autoDeleteHours, setAutoDeleteHours] = useState<number | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { createPostMutation } = usePosts();

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImage(file);

      // Create a preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!content.trim()) {
      toast({
        title: "Error",
        description: "Post content cannot be empty",
        variant: "destructive",
      });
      return;
    }

    // Upload image if present
    let imageUrl: string | undefined = undefined;
    if (image) {
      const formData = new FormData();
      formData.append("image", image);
      
      try {
        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        
        if (!response.ok) {
          throw new Error("Image upload failed");
        }
        
        const data = await response.json();
        imageUrl = data.url;
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to upload image",
          variant: "destructive",
        });
        return;
      }
    }
    
    // Create the post
    createPostMutation.mutate({
      content,
      imageUrl,
      visibility,
      autoDeleteHours,
    }, {
      onSuccess: () => {
        // Reset form
        setContent("");
        setImage(null);
        setImagePreview(null);
        setVisibility("public");
        setAutoDeleteHours(undefined);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    });
  };

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>Create Post</CardTitle>
        <CardDescription>Share what's on your mind</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="What's on your mind?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[100px]"
          />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Visibility</Label>
              <RadioGroup 
                defaultValue="public" 
                value={visibility}
                onValueChange={(value) => setVisibility(value as "public" | "followers" | "friends")}
                className="flex flex-col space-y-1"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="public" id="public" />
                  <Label htmlFor="public" className="flex items-center space-x-1 cursor-pointer">
                    <Globe className="h-4 w-4" />
                    <span>Public</span>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="followers" id="followers" />
                  <Label htmlFor="followers" className="flex items-center space-x-1 cursor-pointer">
                    <Users className="h-4 w-4" />
                    <span>Followers only</span>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="friends" id="friends" />
                  <Label htmlFor="friends" className="flex items-center space-x-1 cursor-pointer">
                    <UserRound className="h-4 w-4" />
                    <span>Friends only</span>
                  </Label>
                </div>
              </RadioGroup>
            </div>
            
            <div className="space-y-2">
              <Label className="flex items-center space-x-1">
                <Clock className="h-4 w-4" />
                <span>Auto-delete after</span>
              </Label>
              <Select 
                value={autoDeleteHours?.toString() || "0"} 
                onValueChange={(value) => setAutoDeleteHours(value === "0" ? undefined : parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Never (default)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Never (default)</SelectItem>
                  <SelectItem value="24">24 hours</SelectItem>
                  <SelectItem value="48">48 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="space-y-2">
            {imagePreview ? (
              <div className="relative">
                <img 
                  src={imagePreview} 
                  alt="Preview" 
                  className="rounded-md max-h-[200px] w-auto object-contain" 
                />
                <Button 
                  type="button" 
                  variant="destructive" 
                  size="icon"
                  className="absolute top-2 right-2"
                  onClick={handleRemoveImage}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                  ref={fileInputRef}
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full"
                >
                  <Image className="h-4 w-4 mr-2" />
                  Add Image
                </Button>
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            type="submit" 
            className="ml-auto" 
            disabled={createPostMutation.isPending || !content.trim()}
          >
            {createPostMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Posting...
              </>
            ) : "Post"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

function PostCard({ post }: { post: PostWithUser }) {
  const { user } = useAuth();
  const { 
    deletePostMutation, 
    likePostMutation, 
    unlikePostMutation,
    createCommentMutation,
    deleteCommentMutation,
    getPostComments
  } = usePosts();
  
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentContent, setCommentContent] = useState("");
  const [likeCount, setLikeCount] = useState(post.likeCount || 0);
  const [isLiked, setIsLiked] = useState(post.isLikedByCurrentUser || false);
  
  const isCurrentUserPost = user?.id === post.userId;
  
  // Format the date
  const formattedDate = format(new Date(post.createdAt), "MMM d, yyyy 'at' h:mm a");
  
  // Show auto-delete info if applicable
  const autoDeleteInfo = post.autoDeleteAt 
    ? `Auto-deletes on ${format(new Date(post.autoDeleteAt), "MMM d, yyyy 'at' h:mm a")}` 
    : null;

  const handleDelete = () => {
    deletePostMutation.mutate(post.id);
  };
  
  const handleLike = () => {
    if (isLiked) {
      // Optimistically update UI immediately for unlike
      setIsLiked(false);
      setLikeCount(prev => prev - 1);
      
      unlikePostMutation.mutate(post.id, {
        // If an error happens (and it's not just "not liked"), revert the UI
        onError: (error: Error) => {
          // Don't revert if it's a "not liked" error
          if (error.message !== "You have not liked this post") {
            setIsLiked(true);
            setLikeCount(prev => prev + 1);
          }
        }
      });
    } else {
      // Optimistically update UI immediately for like
      setIsLiked(true);
      setLikeCount(prev => prev + 1);
      
      likePostMutation.mutate(post.id, {
        // If an error happens (and it's not just "already liked"), revert the UI
        onError: (error: Error) => {
          // Don't revert if it's an "already liked" error
          if (error.message !== "Already liked this post") {
            setIsLiked(false);
            setLikeCount(prev => prev - 1);
          }
        }
      });
    }
  };
  
  const toggleComments = async () => {
    setShowComments(!showComments);
    
    if (!showComments && comments.length === 0) {
      setLoadingComments(true);
      try {
        const fetchedComments = await getPostComments(post.id);
        setComments(fetchedComments);
      } catch (error) {
        console.error("Error fetching comments:", error);
      } finally {
        setLoadingComments(false);
      }
    }
  };
  
  const handleAddComment = () => {
    if (!commentContent.trim()) return;
    
    createCommentMutation.mutate({
      postId: post.id,
      content: commentContent
    }, {
      onSuccess: (newComment: PostComment) => {
        // Add the user data to the comment for immediate display
        const commentWithUser = {
          ...newComment,
          user: {
            id: user!.id,
            username: user!.username,
            profilePicture: user!.profilePicture
          }
        };
        
        setComments(prev => [...prev, commentWithUser]);
        setCommentContent("");
      }
    });
  };
  
  const handleDeleteComment = (commentId: number) => {
    deleteCommentMutation.mutate({
      commentId,
      postId: post.id
    }, {
      onSuccess: () => {
        setComments(prev => prev.filter(comment => comment.id !== commentId));
      }
    });
  };

  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div className="flex items-center space-x-2">
            <Avatar>
              <AvatarImage src={post.user.profilePicture || undefined} />
              <AvatarFallback>
                {post.user.username.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <Link href={`/users/${post.user.id}`}>
                <CardTitle className="text-md hover:underline cursor-pointer">
                  {post.user.username}
                </CardTitle>
              </Link>
              <CardDescription className="text-xs">
                {formattedDate}
                {post.visibility !== "public" && (
                  <span className="ml-2">
                    {post.visibility === "followers" ? "• Followers only" : "• Friends only"}
                  </span>
                )}
                {autoDeleteInfo && (
                  <span className="ml-2 flex items-center text-amber-500">
                    <Clock className="h-3 w-3 mr-1" />
                    {autoDeleteInfo}
                  </span>
                )}
              </CardDescription>
            </div>
          </div>
          
          {isCurrentUserPost && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete your post. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>
                    {deletePostMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : "Delete"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <p className="whitespace-pre-wrap">{post.content}</p>
        {post.imageUrl && (
          <img 
            src={post.imageUrl} 
            alt="Post attachment" 
            className="mt-4 rounded-md max-h-[500px] w-auto object-contain"
            onError={(e) => {
              console.error("Image load error:", post.imageUrl);
              e.currentTarget.alt = "Image failed to load";
            }}
          />
        )}
      </CardContent>
      <div className="px-6 pb-4">
        {/* Like and Comment buttons */}
        <div className="flex items-center space-x-6 mt-2 mb-3">
          <Button 
            variant="ghost" 
            className="flex items-center space-x-1 p-0 h-auto"
            onClick={handleLike}
          >
            <Heart 
              className={`h-5 w-5 ${isLiked ? "fill-red-500 text-red-500" : "text-gray-500"}`} 
            />
            <span className="text-sm">{likeCount}</span>
          </Button>
          
          <Button 
            variant="ghost" 
            className="flex items-center space-x-1 p-0 h-auto"
            onClick={toggleComments}
          >
            <MessageCircle className="h-5 w-5 text-gray-500" />
            <span className="text-sm">{comments.length || post.commentCount || 0}</span>
          </Button>
        </div>
        
        {/* Comments section */}
        {showComments && (
          <div className="mt-4">
            <div className="border-t pt-4">
              <h3 className="font-medium mb-2">Comments</h3>
              
              {/* Comment list */}
              {loadingComments ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : comments.length > 0 ? (
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                  {comments.map((comment) => (
                    <div key={comment.id} className="flex items-start space-x-2 group">
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={comment.user.profilePicture || undefined} />
                        <AvatarFallback className="text-xs">
                          {comment.user.username.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 bg-muted p-2 rounded-md text-sm relative">
                        <div className="font-medium text-xs">
                          {comment.user.username}
                          <span className="ml-2 text-xs text-muted-foreground">
                            {format(new Date(comment.createdAt), "MMM d, 'at' h:mm a")}
                          </span>
                        </div>
                        <p>{comment.content}</p>
                        
                        {(user?.id === comment.userId || isCurrentUserPost) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleDeleteComment(comment.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm py-2">No comments yet</p>
              )}
              
              {/* Add comment form */}
              <div className="mt-4 flex items-center space-x-2">
                <Avatar className="h-7 w-7">
                  <AvatarImage src={user?.profilePicture || undefined} />
                  <AvatarFallback>
                    {user?.username.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 flex items-center space-x-2">
                  <Textarea
                    placeholder="Add a comment..."
                    value={commentContent}
                    onChange={(e) => setCommentContent(e.target.value)}
                    className="min-h-0 h-9 py-2 resize-none"
                  />
                  <Button 
                    size="icon" 
                    onClick={handleAddComment}
                    disabled={!commentContent.trim() || createCommentMutation.isPending}
                  >
                    {createCommentMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function PostsFeed() {
  const { posts, isLoading, isError } = usePosts();
  
  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  if (isError) {
    return (
      <div className="py-8 text-center">
        <p className="text-destructive">Failed to load posts. Please try again later.</p>
      </div>
    );
  }
  
  if (posts.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-muted-foreground">No posts yet. Be the first to post!</p>
      </div>
    );
  }
  
  return (
    <div>
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}

export default function PostsPage() {
  return (
    <PostsProvider>
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-grow container max-w-3xl py-6 px-4 mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold">Posts</h1>
            <Link href="/create-post">
              <Button className="rounded-full h-12 w-12 p-0 shadow-lg">
                <PlusCircle className="h-6 w-6" />
              </Button>
            </Link>
          </div>
          <PostsFeed />
        </main>
        <Footer />
      </div>
    </PostsProvider>
  );
}