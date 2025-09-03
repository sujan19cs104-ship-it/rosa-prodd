import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Shield, Users, Settings, TrendingUp, Plus, X, Edit, Trash2 } from "lucide-react";

interface Config {
  theatres: string[];
  timeSlots: string[];
}

export default function AdminPanel() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
  const [newTheatre, setNewTheatre] = useState('');
  const [newTimeSlot, setNewTimeSlot] = useState('');

  // Redirect to home if not authenticated or not admin
  useEffect(() => {
    if (!isLoading && (!isAuthenticated || user?.role !== 'admin')) {
      toast({
        title: "Unauthorized",
        description: "Admin access required. Redirecting...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/";
      }, 1500);
      return;
    }
  }, [isAuthenticated, isLoading, user, toast]);

  const { data: users, isLoading: isUsersLoading } = useQuery<any[]>({
    queryKey: ["/api/users"],
    enabled: user?.role === 'admin',
  });

  const { data: config, isLoading: isConfigLoading } = useQuery<Config>({
    queryKey: ["/api/config"],
    enabled: user?.role === 'admin',
  });

  const updateConfigMutation = useMutation({
    mutationFn: async (config: Config) => {
      return await apiRequest("POST", `/api/config`, config);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/config"] });
      toast({
        title: "Configuration updated",
        description: "Theatre and time slot settings have been saved.",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to update configuration",
        variant: "destructive",
      });
    },
  });

  const updateUserRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      return await apiRequest("PATCH", `/api/admin/users/${userId}/role`, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Success",
        description: "User role updated successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to update user role",
        variant: "destructive",
      });
    },
  });

  const handleAddTheatre = () => {
    if (!newTheatre.trim()) {
      toast({
        title: "Error",
        description: "Please enter a theatre name",
        variant: "destructive",
      });
      return;
    }

    if (config) {
      const updatedConfig = {
        ...config,
        theatres: [...config.theatres, newTheatre.trim()]
      };
      updateConfigMutation.mutate(updatedConfig);
      setNewTheatre('');
    }
  };

  const handleAddTimeSlot = () => {
    if (!newTimeSlot.trim()) {
      toast({
        title: "Error",
        description: "Please enter a time slot",
        variant: "destructive",
      });
      return;
    }

    if (config) {
      const updatedConfig = {
        ...config,
        timeSlots: [...config.timeSlots, newTimeSlot.trim()]
      };
      updateConfigMutation.mutate(updatedConfig);
      setNewTimeSlot('');
    }
  };

  const handleRemoveTheatre = (theatre: string) => {
    if (config) {
      const updatedConfig = {
        ...config,
        theatres: config.theatres.filter(t => t !== theatre)
      };
      updateConfigMutation.mutate(updatedConfig);
    }
  };

  const handleRemoveTimeSlot = (timeSlot: string) => {
    if (config) {
      const updatedConfig = {
        ...config,
        timeSlots: config.timeSlots.filter(t => t !== timeSlot)
      };
      updateConfigMutation.mutate(updatedConfig);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-rosae-black flex items-center justify-center">
        <div className="text-white text-lg">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-rosae-black flex items-center justify-center">
        <div className="text-white text-lg">Access Denied - Admin Only</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-rosae-black">
      <Sidebar />
      <div className="flex-1 p-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center">
                <Shield className="mr-3 h-8 w-8 text-rosae-red" />
                Admin Panel
              </h1>
              <p className="text-gray-400">Manage users, roles, and system settings</p>
            </div>
          </div>

          {/* Admin Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="bg-rosae-dark-gray border-gray-600">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm">Total Users</p>
                    <p className="text-2xl font-bold text-white">
                      {isUsersLoading ? "..." : users?.length || 0}
                    </p>
                  </div>
                  <Users className="w-8 h-8 text-rosae-red" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-rosae-dark-gray border-gray-600">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm">Theatres</p>
                    <p className="text-2xl font-bold text-white">
                      {isConfigLoading ? "..." : config?.theatres.length || 0}
                    </p>
                  </div>
                  <Settings className="w-8 h-8 text-blue-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-rosae-dark-gray border-gray-600">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm">Time Slots</p>
                    <p className="text-2xl font-bold text-white">
                      {isConfigLoading ? "..." : config?.timeSlots.length || 0}
                    </p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-green-400" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Configuration Management */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Theatre Management */}
            <Card className="bg-rosae-dark-gray border-gray-600">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <Settings className="w-5 h-5 mr-2 text-blue-400" />
                  Theatre Management
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex space-x-2">
                  <Input
                    placeholder="Enter theatre name"
                    value={newTheatre}
                    onChange={(e) => setNewTheatre(e.target.value)}
                    className="bg-gray-800 border-gray-600 text-white"
                  />
                  <Button
                    onClick={handleAddTheatre}
                    disabled={updateConfigMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                
                <div className="space-y-2">
                  {config?.theatres.map((theatre, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                      <span className="text-white">{theatre}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRemoveTheatre(theatre)}
                        className="border-red-600 text-red-400 hover:bg-red-600/20"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Time Slot Management */}
            <Card className="bg-rosae-dark-gray border-gray-600">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <TrendingUp className="w-5 h-5 mr-2 text-green-400" />
                  Time Slot Management
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex space-x-2">
                  <Input
                    placeholder="Enter time slot (e.g., 10:00 AM - 12:00 PM)"
                    value={newTimeSlot}
                    onChange={(e) => setNewTimeSlot(e.target.value)}
                    className="bg-gray-800 border-gray-600 text-white"
                  />
                  <Button
                    onClick={handleAddTimeSlot}
                    disabled={updateConfigMutation.isPending}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                
                <div className="space-y-2">
                  {config?.timeSlots.map((timeSlot, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                      <span className="text-white">{timeSlot}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRemoveTimeSlot(timeSlot)}
                        className="border-red-600 text-red-400 hover:bg-red-600/20"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* User Management */}
          <Card className="bg-rosae-dark-gray border-gray-600 mt-8">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <Users className="w-5 h-5 mr-2 text-rosae-red" />
                User Management
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isUsersLoading ? (
                <div className="text-center py-8">
                  <div className="text-gray-400">Loading users...</div>
                </div>
              ) : (
                <div className="space-y-4">
                  {users?.map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
                      <div>
                        <p className="text-white font-medium">
                          {user.firstName} {user.lastName}
                        </p>
                        <p className="text-gray-400 text-sm">{user.email}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge 
                          className={user.role === 'admin' 
                            ? 'bg-red-500/20 text-red-400' 
                            : 'bg-blue-500/20 text-blue-400'
                          }
                        >
                          {user.role}
                        </Badge>
                        <Select
                          value={user.role}
                          onValueChange={(role) => updateUserRoleMutation.mutate({ userId: user.id, role })}
                        >
                          <SelectTrigger className="w-32 bg-gray-700 border-gray-600">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-800 border-gray-600">
                            <SelectItem value="employee">Employee</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}