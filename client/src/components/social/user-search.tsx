import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Card, 
  CardContent
} from '@/components/ui/card';
import { Loader2, Search, UserPlus, Check, X } from 'lucide-react';

export interface User {
  id: number;
  username: string;
  profilePicture: string | null;
}

interface UserSearchProps {
  onSelectUser: (user: User) => void;
  selectedUsers: User[];
  onRemoveUser?: (userId: number) => void;
  placeholder?: string;
}

export function UserSearch({ 
  onSelectUser, 
  selectedUsers,
  onRemoveUser,
  placeholder = "Search for users..." 
}: UserSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Search for users when query is at least 2 characters
  const {
    data: searchResults = [],
    isLoading,
  } = useQuery<User[], Error>({
    queryKey: ['/api/users/search', searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2 || !isSearching) {
        return [];
      }
      const res = await apiRequest('GET', `/api/users/search?q=${encodeURIComponent(searchQuery)}`);
      if (!res.ok) {
        throw new Error('Failed to search users');
      }
      const data = await res.json();
      return data;
    },
    enabled: searchQuery.length >= 2 && isSearching,
  });

  // Handle search input changes
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    setIsSearching(false);
  };

  // Handle search initiation
  const handleSearch = () => {
    if (searchQuery.length >= 2) {
      setIsSearching(true);
    }
  };

  // Handle key press (Enter to search)
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // Check if user is already selected
  const isUserSelected = (userId: number) => {
    return selectedUsers.some(user => user.id === userId);
  };

  // Get first letter of username for avatar fallback
  const getInitial = (username: string) => {
    return username.charAt(0).toUpperCase();
  };

  return (
    <div className="w-full space-y-4">
      <div className="flex space-x-2">
        <Input
          placeholder={placeholder}
          value={searchQuery}
          onChange={handleSearchChange}
          onKeyPress={handleKeyPress}
          className="flex-grow"
        />
        <Button 
          onClick={handleSearch} 
          type="button" 
          variant="outline"
          disabled={searchQuery.length < 2 || isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Selected Users */}
      {selectedUsers.length > 0 && (
        <div className="flex flex-wrap gap-2 p-2 border rounded-md bg-muted/30">
          {selectedUsers.map(user => (
            <div 
              key={user.id}
              className="flex items-center gap-1 px-2 py-1 bg-primary-foreground rounded-full"
            >
              <Avatar className="h-5 w-5">
                <AvatarImage src={user.profilePicture || undefined} alt={user.username} />
                <AvatarFallback>{getInitial(user.username)}</AvatarFallback>
              </Avatar>
              <span className="text-xs font-medium">{user.username}</span>
              {onRemoveUser && (
                <button 
                  type="button"
                  onClick={() => onRemoveUser(user.id)}
                  className="ml-1 rounded-full hover:bg-muted p-0.5 focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Search Results */}
      {isSearching && searchResults.length > 0 && (
        <Card className="shadow-md">
          <CardContent className="p-2 max-h-60 overflow-y-auto">
            <ul className="space-y-1">
              {searchResults.map(user => {
                const selected = isUserSelected(user.id);
                return (
                  <li key={user.id}>
                    <div className="flex items-center justify-between p-2 rounded-md hover:bg-accent">
                      <div className="flex items-center space-x-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={user.profilePicture || undefined} alt={user.username} />
                          <AvatarFallback>{getInitial(user.username)}</AvatarFallback>
                        </Avatar>
                        <span>{user.username}</span>
                      </div>
                      <Button
                        variant={selected ? "secondary" : "outline"}
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onSelectUser(user)}
                        disabled={selected}
                      >
                        {selected ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <UserPlus className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {isSearching && searchQuery.length >= 2 && searchResults.length === 0 && !isLoading && (
        <p className="text-sm text-muted-foreground p-2">No users found</p>
      )}
    </div>
  );
}