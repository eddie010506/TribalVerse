import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Redirect, Link as WouterLink } from 'wouter';
import { MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { insertUserSchema } from '@shared/schema';
import { Footer } from '@/components/layout/footer';

// Login schema
const loginSchema = insertUserSchema.pick({
  username: true,
  password: true,
});

// Registration schema
const registerSchema = insertUserSchema.pick({
  username: true,
  password: true,
  email: true,
}).extend({
  confirmPassword: z.string(),
  email: z.string()
    .email("Invalid email address")
    .refine(email => email.toLowerCase().endsWith('.edu'), {
      message: "Only .edu email addresses are allowed"
    }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export default function AuthPage() {
  const { user, loginMutation, registerMutation } = useAuth();
  const [activeTab, setActiveTab] = useState<string>("signin");

  // Form hooks for login
  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  // Form hooks for registration
  const registerForm = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      password: "",
      confirmPassword: "",
      email: "",
    },
  });

  // Handle login form submission
  const onLoginSubmit = (values: z.infer<typeof loginSchema>) => {
    loginMutation.mutate(values);
  };

  // Handle registration form submission
  const onRegisterSubmit = (values: z.infer<typeof registerSchema>) => {
    const { confirmPassword, ...userData } = values;
    registerMutation.mutate(userData);
  };

  // If user is already logged in, redirect to home page
  if (user) {
    return <Redirect to="/" />;
  }

  return (
    <div className="flex flex-col min-h-screen">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <MessageSquare className="h-8 w-8 text-primary" />
            <span className="ml-2 text-xl font-semibold text-neutral-800">TribalVerse</span>
          </div>
          <div>
            <WouterLink href="#" className="text-primary hover:text-blue-700 font-medium">
              About
            </WouterLink>
          </div>
        </div>
      </header>

      <main className="flex-grow flex flex-col md:flex-row">
        <div className="flex-1 flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
          <div className="max-w-md w-full">
            <Tabs 
              value={activeTab} 
              onValueChange={setActiveTab} 
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>
              
              <TabsContent value="signin">
                <Card className="border shadow-sm">
                  <CardHeader className="text-center">
                    <CardTitle className="text-2xl font-bold text-neutral-800">
                      Sign in to TribalVerse
                    </CardTitle>
                    <CardDescription>
                      Connect and chat with friends
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Form {...loginForm}>
                      <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                        <FormField
                          control={loginForm.control}
                          name="username"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Username</FormLabel>
                              <FormControl>
                                <Input placeholder="Enter your username" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={loginForm.control}
                          name="password"
                          render={({ field }) => (
                            <FormItem>
                              <div className="flex items-center justify-between">
                                <FormLabel>Password</FormLabel>
                                <WouterLink href="#" className="text-sm text-primary hover:text-blue-700">
                                  Forgot password?
                                </WouterLink>
                              </div>
                              <FormControl>
                                <Input type="password" placeholder="Enter your password" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <div className="flex items-center space-x-2">
                          <Checkbox id="remember" />
                          <label
                            htmlFor="remember"
                            className="text-sm text-neutral-600 cursor-pointer"
                          >
                            Remember me
                          </label>
                        </div>
                        
                        <Button 
                          type="submit" 
                          className="w-full" 
                          disabled={loginMutation.isPending}
                        >
                          {loginMutation.isPending ? (
                            <>
                              <span>Signing in</span>
                              <span className="ml-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            </>
                          ) : (
                            "Sign in"
                          )}
                        </Button>
                      </form>
                    </Form>
                  </CardContent>
                  <CardFooter className="flex justify-center">
                    <p className="text-sm text-neutral-600">
                      Don't have an account?{" "}
                      <button 
                        type="button" 
                        className="font-medium text-primary hover:text-blue-700"
                        onClick={() => setActiveTab("signup")}
                      >
                        Sign up
                      </button>
                    </p>
                  </CardFooter>
                </Card>
              </TabsContent>
              
              <TabsContent value="signup">
                <Card className="border shadow-sm">
                  <CardHeader className="text-center">
                    <CardTitle className="text-2xl font-bold text-neutral-800">
                      Create an account
                    </CardTitle>
                    <CardDescription>
                      Join TribalVerse to start chatting
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Form {...registerForm}>
                      <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
                        <FormField
                          control={registerForm.control}
                          name="username"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Username</FormLabel>
                              <FormControl>
                                <Input placeholder="Choose a username" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={registerForm.control}
                          name="password"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Password</FormLabel>
                              <FormControl>
                                <Input type="password" placeholder="Create a password" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={registerForm.control}
                          name="confirmPassword"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Confirm Password</FormLabel>
                              <FormControl>
                                <Input type="password" placeholder="Confirm your password" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={registerForm.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email Address</FormLabel>
                              <FormControl>
                                <Input 
                                  type="email" 
                                  placeholder="Enter your .edu email address" 
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                              <p className="text-xs text-amber-600 mt-1">
                                Only educational (.edu) email addresses are allowed. Email verification is required to create rooms and post messages.
                              </p>
                            </FormItem>
                          )}
                        />
                        
                        <Button 
                          type="submit" 
                          className="w-full" 
                          disabled={registerMutation.isPending}
                        >
                          {registerMutation.isPending ? (
                            <>
                              <span>Creating account</span>
                              <span className="ml-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            </>
                          ) : (
                            "Sign up"
                          )}
                        </Button>
                      </form>
                    </Form>
                  </CardContent>
                  <CardFooter className="flex justify-center">
                    <p className="text-sm text-neutral-600">
                      Already have an account?{" "}
                      <button 
                        type="button" 
                        className="font-medium text-primary hover:text-blue-700"
                        onClick={() => setActiveTab("signin")}
                      >
                        Sign in
                      </button>
                    </p>
                  </CardFooter>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
        
        <div className="flex-1 bg-primary p-8 flex flex-col justify-center items-center text-white hidden md:flex">
          <div className="max-w-md text-center">
            <MessageSquare className="h-16 w-16 mx-auto mb-6" />
            <h2 className="text-3xl font-bold mb-4">Connect with friends in TribalVerse</h2>
            <p className="text-lg text-blue-100 mb-8">
              Create chat rooms, share messages and images, and stay connected with your favorite people.
            </p>
            <div className="flex justify-center space-x-4">
              <div className="bg-white/10 p-4 rounded-lg">
                <h3 className="font-bold mb-1">Create Rooms</h3>
                <p className="text-sm text-blue-100">Make spaces for your topics</p>
              </div>
              <div className="bg-white/10 p-4 rounded-lg">
                <h3 className="font-bold mb-1">Share Images</h3>
                <p className="text-sm text-blue-100">Express with visuals</p>
              </div>
              <div className="bg-white/10 p-4 rounded-lg">
                <h3 className="font-bold mb-1">Real-time Chat</h3>
                <p className="text-sm text-blue-100">Instant communication</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
