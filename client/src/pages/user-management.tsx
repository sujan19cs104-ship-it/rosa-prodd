import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Layout from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Users, Shield, User, Clock, Plus, Eye, Trash2, Edit, EyeOff, Key } from "lucide-react";

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role?: 'admin' | 'employee';
  createdAt?: string;
  updatedAt?: string;
}

interface CreateUserData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'employee';
}

export default function UserManagement() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [createUserData, setCreateUserData] = useState<CreateUserData>({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    role: 'employee'
  });
  const [editUserData, setEditUserData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    role: 'employee' as 'admin' | 'employee'
  });
  const [showPassword, setShowPassword] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'employee'>('all');
  const [isResetPasswordDialogOpen, setIsResetPasswordDialogOpen] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Check if user is admin
  const isAdmin = user?.role === 'admin' || user?.email === 'admin@rosae.com' || user?.email === 'rosaeleisure@gmail.com';

  // Redirect to home if not authenticated or not admin
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
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
    
    if (!isLoading && isAuthenticated && user && !isAdmin) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to access user management.",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/";
      }, 1000);
      return;
    }
  }, [isAuthenticated, isLoading, user, isAdmin, toast]);

  // Fetch all users
  const { data: usersResponse, isLoading: usersLoading, error: usersError } = useQuery<{rows: User[], pagination: any}>({
    queryKey: ["/api/users"],
    enabled: isAuthenticated && isAdmin,
    retry: 1
  });

  const users = usersResponse?.rows || [];

  // Filter users based on search term and role filter
  const filteredUsers = users.filter((user: User) => {
    const matchesSearch = searchTerm === '' || 
      user.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    
    return matchesSearch && matchesRole;
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (userData: CreateUserData) => {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create user');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "User created successfully",
        description: "The new user account has been created.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsCreateDialogOpen(false);
      setCreateUserData({
        email: '',
        password: '',
        firstName: '',
        lastName: '',
        role: 'employee'
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Edit user mutation
  const editUserMutation = useMutation({
    mutationFn: async ({ userId, userData }: { userId: string, userData: any }) => {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update user');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "User updated successfully",
        description: "The user account has been updated.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsEditDialogOpen(false);
      setEditingUser(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete user');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "User deleted successfully",
        description: "The user account has been removed.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    createUserMutation.mutate(createUserData);
  };

  const handleEditUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    editUserMutation.mutate({ 
      userId: editingUser.id, 
      userData: editUserData 
    });
  };

  const openEditDialog = (user: User) => {
    setEditingUser(user);
    setEditUserData({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email,
      role: user.role || 'employee'
    });
    setIsEditDialogOpen(true);
  };

  // Reset password mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async ({ userId, password }: { userId: string, password: string }) => {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to reset password');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Password reset successfully",
        description: "The user's password has been updated.",
      });
      setIsResetPasswordDialogOpen(false);
      setResetPasswordUser(null);
      setNewPassword('');
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to reset password",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const openResetPasswordDialog = (user: User) => {
    setResetPasswordUser(user);
    setNewPassword('');
    setIsResetPasswordDialogOpen(true);
  };

  const openDeleteDialog = (user: User) => {
    setUserToDelete(user);
    setDeleteConfirmText('');
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToDelete || deleteConfirmText !== 'DELETE') return;
    deleteUserMutation.mutate(userToDelete.id);
    setIsDeleteDialogOpen(false);
    setUserToDelete(null);
    setDeleteConfirmText('');
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordUser || !newPassword) return;
    resetPasswordMutation.mutate({ 
      userId: resetPasswordUser.id, 
      password: newPassword 
    });
  };

  if (isLoading || usersLoading) {
    return (
      <div className="min-h-screen bg-rosae-black flex items-center justify-center">
        <div className="text-white text-lg">Loading...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <Layout>
        <div className="p-6">
          <div className="flex items-center justify-center min-h-[400px]">
            <Card className="bg-rosae-dark-gray border-gray-600 max-w-md">
              <CardContent className="p-8 text-center">
                <Shield className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">Access Restricted</h3>
                <p className="text-gray-400">
                  You need administrator privileges to access user management features.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </Layout>
    );
  }

  if (usersError) {
    return (
      <Layout>
        <div className="p-6">
          <div className="flex items-center justify-center min-h-[400px]">
            <Card className="bg-rosae-dark-gray border-gray-600 max-w-md">
              <CardContent className="p-8 text-center">
                <div className="text-red-400 text-xl mb-4">⚠️</div>
                <h3 className="text-xl font-semibold text-white mb-2">Error Loading Users</h3>
                <p className="text-gray-400 mb-4">
                  Failed to load user data. Please try again.
                </p>
                <Button 
                  onClick={() => window.location.reload()} 
                  className="bg-rosae-red hover:bg-rosae-red/90"
                >
                  Retry
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </Layout>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Layout>
      <div className="p-6">
        {/* Header bar - match layout style */}
        <div className="flex items-center justify-between mb-6 bg-rosae-dark-gray border border-gray-700 rounded-lg px-4 py-3">
          <div>
            <h2 className="text-2xl font-bold text-white">User Management</h2>
            <p className="text-gray-400 text-sm">Create and manage employee accounts and permissions</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm text-gray-400">Total Users</div>
              <div className="text-xl font-semibold text-white">{users.length}</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-400">Active Users</div>
              <div className="text-xl font-semibold text-green-400">{users.filter(u => u.active !== false).length}</div>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="border-blue-500 text-blue-400">
              <Shield className="w-3 h-3 mr-1" />
              Admin Panel
            </Badge>
            <Badge variant="outline" className="border-green-500 text-green-400">
              {filteredUsers.length} Users Shown
            </Badge>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-rosae-red hover:bg-rosae-red/90">
                <Plus className="w-4 h-4 mr-2" />
                Create Employee
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-rosae-dark-gray border-gray-600 text-white sm:max-w-[600px] rounded-xl">
              <DialogHeader>
                <DialogTitle className="text-xl font-semibold text-white flex items-center">
                  <Plus className="w-5 h-5 mr-2 text-rosae-red" />
                  Create New Employee Account
                </DialogTitle>
                <DialogDescription className="text-gray-400">
                  Add a new employee to the system with their login credentials and role permissions.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName" className="text-white">First Name</Label>
                    <Input
                      id="firstName"
                      value={createUserData.firstName}
                      onChange={(e) => setCreateUserData({ ...createUserData, firstName: e.target.value })}
                      required
                      className="bg-gray-800 border-gray-600 text-white"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName" className="text-white">Last Name</Label>
                    <Input
                      id="lastName"
                      value={createUserData.lastName}
                      onChange={(e) => setCreateUserData({ ...createUserData, lastName: e.target.value })}
                      required
                      className="bg-gray-800 border-gray-600 text-white"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="email" className="text-white">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={createUserData.email}
                    onChange={(e) => setCreateUserData({ ...createUserData, email: e.target.value })}
                    required
                    className="bg-gray-800 border-gray-600 text-white"
                  />
                </div>
                <div>
                  <Label htmlFor="password" className="text-white">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={createUserData.password}
                      onChange={(e) => setCreateUserData({ ...createUserData, password: e.target.value })}
                      required
                      minLength={8}
                      className="bg-gray-800 border-gray-600 text-white pr-12"
                      placeholder="Enter secure password"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-300 transition-colors"
                       onClick={() => setShowPassword(!showPassword)}
                     >
                       {showPassword ? (
                         <EyeOff className="h-5 w-5" />
                       ) : (
                         <Eye className="h-5 w-5" />
                       )}
                     </button>
                   </div>
                   <div className="mt-2">
                     <p className="text-xs text-gray-400">Password requirements:</p>
                     <ul className="text-xs text-gray-400 mt-1 space-y-1">
                       <li className={`flex items-center ${createUserData.password.length >= 8 ? 'text-green-400' : 'text-gray-400'}`}>
                         <div className={`w-1.5 h-1.5 rounded-full mr-2 ${createUserData.password.length >= 8 ? 'bg-green-400' : 'bg-gray-400'}`}></div>
                         At least 8 characters
                       </li>
                       <li className={`flex items-center ${/[A-Z]/.test(createUserData.password) ? 'text-green-400' : 'text-gray-400'}`}>
                         <div className={`w-1.5 h-1.5 rounded-full mr-2 ${/[A-Z]/.test(createUserData.password) ? 'bg-green-400' : 'bg-gray-400'}`}></div>
                         One uppercase letter
                       </li>
                       <li className={`flex items-center ${/[0-9]/.test(createUserData.password) ? 'text-green-400' : 'text-gray-400'}`}>
                         <div className={`w-1.5 h-1.5 rounded-full mr-2 ${/[0-9]/.test(createUserData.password) ? 'bg-green-400' : 'bg-gray-400'}`}></div>
                         One number
                       </li>
                     </ul>
                   </div>
                 </div>
                <div>
                  <Label htmlFor="role" className="text-white">Role</Label>
                  <Select
                    value={createUserData.role}
                    onValueChange={(value: 'admin' | 'employee') => 
                      setCreateUserData({ ...createUserData, role: value })
                    }
                  >
                    <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-600">
                      <SelectItem value="employee">Employee</SelectItem>
                      <SelectItem value="admin">Administrator</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                    className="border-gray-600 text-gray-300 hover:bg-gray-700"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      createUserMutation.isPending || 
                      createUserData.password.length < 8 ||
                      !/[A-Z]/.test(createUserData.password) ||
                      !/[0-9]/.test(createUserData.password) ||
                      !createUserData.email ||
                      !createUserData.firstName ||
                      !createUserData.lastName
                    }
                    className="bg-rosae-red hover:bg-rosae-red/90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {createUserMutation.isPending ? (
                      <div className="flex items-center">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        Creating...
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <Plus className="w-4 h-4 mr-2" />
                        Create User
                      </div>
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* Edit User Dialog */}
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="bg-rosae-dark-gray border-gray-600 text-white sm:max-w-[500px] rounded-xl">
              <DialogHeader>
                <DialogTitle className="text-xl font-semibold text-white flex items-center">
                  <Edit className="w-5 h-5 mr-2 text-blue-400" />
                  Edit User: {editingUser?.firstName} {editingUser?.lastName}
                </DialogTitle>
                <DialogDescription className="text-gray-400">
                  Update user information and role permissions.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleEditUser} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-firstName" className="text-white">First Name</Label>
                    <Input
                      id="edit-firstName"
                      type="text"
                      value={editUserData.firstName}
                      onChange={(e) => setEditUserData({ ...editUserData, firstName: e.target.value })}
                      className="bg-gray-800 border-gray-600 text-white"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-lastName" className="text-white">Last Name</Label>
                    <Input
                      id="edit-lastName"
                      type="text"
                      value={editUserData.lastName}
                      onChange={(e) => setEditUserData({ ...editUserData, lastName: e.target.value })}
                      className="bg-gray-800 border-gray-600 text-white"
                      required
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="edit-email" className="text-white">Email</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={editUserData.email}
                    onChange={(e) => setEditUserData({ ...editUserData, email: e.target.value })}
                    className="bg-gray-800 border-gray-600 text-white"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="edit-role" className="text-white">Role</Label>
                  <Select
                    value={editUserData.role}
                    onValueChange={(value: 'admin' | 'employee') => 
                      setEditUserData({ ...editUserData, role: value })
                    }
                  >
                    <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-600">
                      <SelectItem value="employee">Employee</SelectItem>
                      <SelectItem value="admin">Administrator</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsEditDialogOpen(false)}
                    className="border-gray-600 text-gray-300 hover:bg-gray-700"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={editUserMutation.isPending || !editUserData.firstName || !editUserData.lastName || !editUserData.email}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {editUserMutation.isPending ? (
                      <div className="flex items-center">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        Updating...
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <Edit className="w-4 h-4 mr-2" />
                        Update User
                      </div>
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* Reset Password Dialog */}
          <Dialog open={isResetPasswordDialogOpen} onOpenChange={setIsResetPasswordDialogOpen}>
            <DialogContent className="bg-rosae-dark-gray border-gray-600 text-white sm:max-w-[450px] rounded-xl">
              <DialogHeader>
                <DialogTitle className="text-xl font-semibold text-white flex items-center">
                  <Key className="w-5 h-5 mr-2 text-yellow-400" />
                  Reset Password
                </DialogTitle>
                <DialogDescription className="text-gray-400">
                  Reset password for <span className="text-white font-medium">{resetPasswordUser?.firstName} {resetPasswordUser?.lastName}</span>
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <Label htmlFor="new-password" className="text-white">New Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="bg-gray-800 border-gray-600 text-white"
                    placeholder="Enter new password"
                    required
                    minLength={6}
                  />
                  <p className="text-xs text-gray-400 mt-1">Password must be at least 6 characters long</p>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsResetPasswordDialogOpen(false)}
                    className="border-gray-600 text-gray-300 hover:bg-gray-700"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={resetPasswordMutation.isPending || !newPassword || newPassword.length < 6}
                    className="bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {resetPasswordMutation.isPending ? (
                      <div className="flex items-center">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        Resetting...
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <Key className="w-4 h-4 mr-2" />
                        Reset Password
                      </div>
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* Delete Confirmation Dialog */}
          <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <DialogContent className="bg-rosae-dark-gray border-gray-600 text-white sm:max-w-[500px] rounded-xl">
              <DialogHeader>
                <DialogTitle className="text-xl font-semibold text-white flex items-center">
                  <Trash2 className="w-5 h-5 mr-2 text-red-400" />
                  Delete User Account
                </DialogTitle>
                <DialogDescription className="text-gray-400">
                  This action will permanently delete <span className="text-white font-medium">{userToDelete?.firstName} {userToDelete?.lastName}</span>'s account.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <Alert className="border-red-600 bg-red-600/10">
                  <AlertDescription className="text-red-400">
                    <strong>Warning:</strong> This action cannot be undone. The user will:
                    <ul className="mt-2 space-y-1 list-disc list-inside">
                      <li>Lose access to the system immediately</li>
                      <li>Have their account permanently deactivated</li>
                      <li>Be unable to log in or recover their data</li>
                    </ul>
                  </AlertDescription>
                </Alert>
                <form onSubmit={handleDeleteUser} className="space-y-4">
                  <div>
                    <Label htmlFor="delete-confirm" className="text-white">
                      Type <span className="font-mono bg-gray-800 px-2 py-1 rounded text-red-400">DELETE</span> to confirm:
                    </Label>
                    <Input
                      id="delete-confirm"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      className="bg-gray-800 border-gray-600 text-white mt-2"
                      placeholder="Type DELETE to confirm"
                      required
                    />
                  </div>
                  <div className="flex justify-end space-x-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsDeleteDialogOpen(false);
                        setUserToDelete(null);
                        setDeleteConfirmText('');
                      }}
                      className="border-gray-600 text-gray-300 hover:bg-gray-700"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={deleteUserMutation.isPending || deleteConfirmText !== 'DELETE'}
                      className="bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {deleteUserMutation.isPending ? (
                        <div className="flex items-center">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                          Deleting...
                        </div>
                      ) : (
                        <div className="flex items-center">
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete User
                        </div>
                      )}
                    </Button>
                  </div>
                </form>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search and Filter Controls */}
        <Card className="bg-gray-800/50 border-gray-700 mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <Label className="text-gray-300 text-sm mb-2 block">Search Users</Label>
                <Input
                  placeholder="Search by name, email, or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-gray-800 border-gray-600 text-white placeholder-gray-400"
                />
              </div>
              <div className="w-full sm:w-48">
                <Label className="text-gray-300 text-sm mb-2 block">Filter by Role</Label>
                <Select value={roleFilter} onValueChange={(value: 'all' | 'admin' | 'employee') => setRoleFilter(value)}>
                  <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-600">
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="admin">Administrators</SelectItem>
                    <SelectItem value="employee">Employees</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchTerm('');
                    setRoleFilter('all');
                  }}
                  className="border-gray-600 text-gray-300 hover:bg-gray-700"
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card className="bg-rosae-dark-gray border-gray-600">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Users className="w-5 h-5 mr-2" />
              All Users ({filteredUsers.length} of {users.length})
            </CardTitle>
            <CardDescription className="text-gray-400">
              Manage user accounts and their permissions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {usersLoading ? (
              <div className="text-center py-8">
                <div className="text-gray-400">Loading users...</div>
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                <p className="text-gray-400">No users found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-600">
                      <TableHead className="text-gray-300">User</TableHead>
                      <TableHead className="text-gray-300">Email</TableHead>
                      <TableHead className="text-gray-300">Role</TableHead>
                      <TableHead className="text-gray-300">Created</TableHead>
                      <TableHead className="text-gray-300">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user.id} className="border-gray-600">
                        <TableCell className="text-white">
                          <div className="flex items-center space-x-3">
                            <div className="relative">
                              <div className="w-8 h-8 bg-rosae-red/20 rounded-full flex items-center justify-center">
                                <User className="w-4 h-4 text-rosae-red" />
                              </div>
                              {/* Status indicator */}
                              <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-rosae-dark-gray ${
                                user.active !== false ? 'bg-green-500' : 'bg-red-500'
                              }`} title={user.active !== false ? 'Active' : 'Inactive'}></div>
                            </div>
                            <div>
                              <div className="font-medium">
                                {user.firstName && user.lastName 
                                  ? `${user.firstName} ${user.lastName}`
                                  : 'Unknown User'
                                }
                              </div>
                              <div className="text-sm text-gray-400">ID: {user.id}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-white">{user.email}</TableCell>
                        <TableCell>
                          <Badge 
                            className={user.role === 'admin' 
                              ? 'bg-red-500/20 text-red-400' 
                              : 'bg-blue-500/20 text-blue-400'
                            }
                          >
                            {user.role === 'admin' ? 'Administrator' : 'Employee'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-gray-400">
                          {user.createdAt ? formatDate(user.createdAt) : 'Unknown'}
                        </TableCell>
                                                 <TableCell>
                           <div className="flex items-center space-x-2">
                             <Button
                               size="sm"
                               variant="outline"
                               className="border-gray-600 text-gray-300 hover:bg-gray-700"
                               onClick={() => {
                                 // Show user details in a modal or alert
                                 const userDetails = `
Name: ${user.firstName} ${user.lastName}
Email: ${user.email}
Role: ${user.role}
ID: ${user.id}
Created: ${user.createdAt ? formatDate(user.createdAt) : 'Unknown'}
                                 `.trim();
                                 
                                 toast({
                                   title: "User Details",
                                   description: userDetails,
                                 });
                               }}
                             >
                               <Eye className="w-4 h-4" />
                             </Button>
                             <Button
                               size="sm"
                               variant="outline"
                               className="border-gray-600 text-gray-300 hover:bg-gray-700"
                               onClick={() => openEditDialog(user)}
                               disabled={editUserMutation.isPending}
                               title="Edit User"
                             >
                               <Edit className="w-4 h-4" />
                             </Button>
                             <Button
                               size="sm"
                               variant="outline"
                               className="border-yellow-600 text-yellow-400 hover:bg-yellow-600/20"
                               onClick={() => openResetPasswordDialog(user)}
                               disabled={resetPasswordMutation.isPending}
                               title="Reset Password"
                             >
                               <Key className="w-4 h-4" />
                             </Button>
                             <Button
                               size="sm"
                               variant="outline"
                               className="border-red-600 text-red-400 hover:bg-red-600/20"
                               onClick={() => {
                                 if (user.role === 'admin') {
                                   toast({
                                     title: "Cannot Delete Admin",
                                     description: "Admin users cannot be deleted for security reasons",
                                     variant: "destructive",
                                   });
                                   return;
                                 }
                                 
                                 if (user.id === 'admin-001') {
                                   toast({
                                     title: "Cannot Delete Primary Admin",
                                     description: "The primary admin account cannot be deleted",
                                     variant: "destructive",
                                   });
                                   return;
                                 }
                                 
                                 openDeleteDialog(user);
                               }}
                               disabled={deleteUserMutation.isPending || user.role === 'admin'}
                             >
                               <Trash2 className="w-4 h-4" />
                             </Button>
                           </div>
                         </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Admin Capabilities */}
        <Card className="bg-rosae-dark-gray border-gray-600 mt-6">
          <CardContent className="p-6">
            <h3 className="text-xl font-semibold text-white mb-6 flex items-center">
              <Shield className="w-5 h-5 mr-2 text-rosae-red" />
              Administrator Capabilities
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-white">User Management</h4>
                <ul className="space-y-2 text-gray-300">
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-green-400 rounded-full mr-3"></div>
                    Create new employee accounts
                  </li>
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-green-400 rounded-full mr-3"></div>
                    View all user records and activities
                  </li>
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-green-400 rounded-full mr-3"></div>
                    Manage user roles and permissions
                  </li>
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-green-400 rounded-full mr-3"></div>
                    Monitor employee performance
                  </li>
                </ul>
              </div>
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-white">Data Access</h4>
                <ul className="space-y-2 text-gray-300">
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-blue-400 rounded-full mr-3"></div>
                    View all bookings from all employees
                  </li>
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-blue-400 rounded-full mr-3"></div>
                    Access all expense records
                  </li>
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-blue-400 rounded-full mr-3"></div>
                    Generate comprehensive reports
                  </li>
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-blue-400 rounded-full mr-3"></div>
                    Export data for analysis
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
