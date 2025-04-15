import { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { usePosts, PostsProvider } from "@/hooks/use-posts";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Image, Trash2, Globe, Users, UserRound, Clock } from "lucide-react";
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
import type { PostWithUser } from "../types";

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
                value={autoDeleteHours?.toString() || ""} 
                onValueChange={(value) => setAutoDeleteHours(value ? parseInt(value) : undefined)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Never (default)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Never (default)</SelectItem>
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
  const { deletePostMutation } = usePosts();
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
          />
        )}
      </CardContent>
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
      <div className="container max-w-3xl py-6">
        <h1 className="text-3xl font-bold mb-6">Feed</h1>
        <CreatePostForm />
        <PostsFeed />
      </div>
    </PostsProvider>
  );
}