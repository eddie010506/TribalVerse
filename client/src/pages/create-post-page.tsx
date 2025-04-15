import { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { usePosts, PostsProvider } from "@/hooks/use-posts";
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Image, Trash2, Globe, Users, UserRound, Clock, ArrowLeft } from "lucide-react";
import { Link, useLocation } from "wouter";

function CreatePostForm() {
  const [content, setContent] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<"public" | "followers" | "friends">("public");
  const [autoDeleteHours, setAutoDeleteHours] = useState<number | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { createPostMutation } = usePosts();
  const [_, setLocation] = useLocation();

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
        
        // Show success message
        toast({
          title: "Success",
          description: "Your post has been created!",
        });
        
        // Navigate back to the posts page
        setTimeout(() => {
          setLocation('/');
        }, 500);
      }
    });
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center mb-2">
          <Link href="/">
            <Button variant="ghost" size="sm" className="mr-2">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Posts
            </Button>
          </Link>
        </div>
        <CardTitle>Create Post</CardTitle>
        <CardDescription>Share what's on your mind with your friends and followers</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="What's on your mind?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[150px]"
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
        <CardFooter className="flex justify-end">
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
            ) : "Create Post"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

export default function CreatePostPage() {
  return (
    <PostsProvider>
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-grow container mx-auto px-4 py-8">
          <CreatePostForm />
        </main>
        <Footer />
      </div>
    </PostsProvider>
  );
}