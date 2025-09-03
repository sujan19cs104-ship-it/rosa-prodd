import { useEffect, useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, X, Edit, Save, Loader2 } from "lucide-react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const settingSchema = z.object({
  name: z.string().min(1, "Name is required"),
});

export default function AdminSettings() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();
  const [activeTab, setActiveTab] = useState("theaters");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  
  // State for each setting type
  const [theatres, setTheatres] = useState<string[]>([]);
  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<string[]>([]);
  const [expenseCreators, setExpenseCreators] = useState<string[]>([]);
  const [integrationSettings, setIntegrationSettings] = useState<{ calendarSyncEnabled: boolean; calendarId?: string; syncWindowDays?: number }>({ calendarSyncEnabled: true, calendarId: 'primary', syncWindowDays: 30 });
  
  // Fetch configuration from API
  const { data: configData, isLoading: isConfigLoading, error: configError } = useQuery({
    queryKey: ["/api/config"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/config");
      return await res.json();
    },
  });

  // Handle config errors with useEffect
  useEffect(() => {
    if (configError) {
      if (isUnauthorizedError(configError)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: (configError as any).message || "Failed to fetch configuration",
        variant: "destructive",
      });
    }
  }, [configError, toast]);
  
  // Update configuration when data is fetched
  useEffect(() => {
    if (configData) {
      setTheatres(configData.theatres || []);
      setTimeSlots(configData.timeSlots || []);
      setExpenseCategories(configData.expenseCategories || []);
      setExpenseCreators(configData.expenseCreators || []);
      setIntegrationSettings(configData.integrationSettings || { calendarSyncEnabled: true, calendarId: 'primary', syncWindowDays: 30 });
    }
  }, [configData]);
  
  // Mutation to update configuration
  const updateConfigMutation = useMutation({
    mutationFn: async (data: { theatres: string[], timeSlots: string[], expenseCategories: string[], expenseCreators: string[], integrationSettings?: any }) => {
      const res = await apiRequest("POST", "/api/config", data);
      return await res.json();
    },
    onSuccess: (data) => {
       // Update local state with the returned data
       setTheatres(data.theatres || []);
       setTimeSlots(data.timeSlots || []);
       setExpenseCategories(data.expenseCategories || []);
       setExpenseCreators(data.expenseCreators || []);
       setIntegrationSettings(data.integrationSettings || { calendarSyncEnabled: true, calendarId: 'primary', syncWindowDays: 30 });
      
      toast({
        title: "Success",
        description: "Configuration updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/config"] });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to update configuration",
        variant: "destructive",
      });
    },
  });
  
  // Form for adding new items
  const form = useForm({
    resolver: zodResolver(settingSchema),
    defaultValues: {
      name: "",
    },
  });

  // Redirect to home if not authenticated or not admin
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
    
    // Check if user is admin
    const isAdmin = user?.role === "admin" || (user as any)?.email === "admin@rosae.com";
    if (!isLoading && isAuthenticated && !isAdmin) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to access this page",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/";
      }, 500);
    }
  }, [isAuthenticated, isLoading, toast, user]);

  const handleAddItem = (data: { name: string }) => {
    const { name } = data;
    
    // Add to the appropriate list based on active tab
    let updatedConfig: any = { integrationSettings };
    
    switch (activeTab) {
      case "theaters":
        const updatedTheaters = [...theatres, name];
        setTheatres(updatedTheaters);
        updatedConfig = { theatres: updatedTheaters, timeSlots, expenseCategories, expenseCreators, integrationSettings };
        break;
      case "timeSlots":
        const updatedTimeSlots = [...timeSlots, name];
        setTimeSlots(updatedTimeSlots);
        updatedConfig = { theatres: theatres, timeSlots: updatedTimeSlots, expenseCategories, expenseCreators, integrationSettings };
        break;
      case "expenseCategories":
        const updatedExpenseCategories = [...expenseCategories, name];
        setExpenseCategories(updatedExpenseCategories);
        updatedConfig = { theatres: theatres, timeSlots, expenseCategories: updatedExpenseCategories, expenseCreators, integrationSettings };
        break;
      case "expenseCreators":
        const updatedExpenseCreators = [...expenseCreators, name];
        setExpenseCreators(updatedExpenseCreators);
        updatedConfig = { theatres: theatres, timeSlots, expenseCategories, expenseCreators: updatedExpenseCreators, integrationSettings };
        break;
    }
    
    // Update configuration on the server
    updateConfigMutation.mutate(updatedConfig);
    
    // Close dialog and reset form
    setIsAddDialogOpen(false);
    form.reset();
  };

  const handleDeleteItem = (type: string, index: number) => {
    let updatedConfig: any = { integrationSettings };
    
    switch (type) {
      case "theaters":
        const updatedTheaters = theatres.filter((_, i) => i !== index);
        setTheatres(updatedTheaters);
        updatedConfig = { theatres: updatedTheaters, timeSlots, expenseCategories, expenseCreators, integrationSettings };
        break;
      case "timeSlots":
        const updatedTimeSlots = timeSlots.filter((_, i) => i !== index);
        setTimeSlots(updatedTimeSlots);
        updatedConfig = { theatres: theatres, timeSlots: updatedTimeSlots, expenseCategories, expenseCreators, integrationSettings };
        break;
      case "expenseCategories":
        const updatedExpenseCategories = expenseCategories.filter((_, i) => i !== index);
        setExpenseCategories(updatedExpenseCategories);
        updatedConfig = { theatres: theatres, timeSlots, expenseCategories: updatedExpenseCategories, expenseCreators, integrationSettings };
        break;
      case "expenseCreators":
        const updatedExpenseCreators = expenseCreators.filter((_, i) => i !== index);
        setExpenseCreators(updatedExpenseCreators);
        updatedConfig = { theatres: theatres, timeSlots, expenseCategories, expenseCreators: updatedExpenseCreators, integrationSettings };
        break;
    }
    
    // Update configuration on the server
    updateConfigMutation.mutate(updatedConfig);
  };

  if (isLoading || isConfigLoading) {
    return (
      <div className="min-h-screen bg-rosae-black flex items-center justify-center">
        <div className="text-white text-lg flex items-center">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading...
        </div>
      </div>
    );
  }
  
  if (configError) {
    return (
      <div className="flex min-h-screen bg-rosae-black">
        <Sidebar />
        <div className="flex-1 p-6">
          <div className="bg-rosae-dark-gray border border-gray-600 rounded-lg p-6 text-white">
            <h2 className="text-2xl font-bold mb-4">Error Loading Configuration</h2>
            <p className="text-gray-300 mb-4">There was a problem loading the configuration data.</p>
            <Button
              onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/config"] })}
              className="bg-rosae-red hover:bg-rosae-dark-red"
            >
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-rosae-black">
      <Sidebar />
      <div className="flex-1">
        <div className="p-6">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold text-white">Admin Settings</h2>
              <p className="text-gray-400">Manage theater settings and configurations</p>
            </div>
          </div>
          
          <Card className="bg-rosae-dark-gray border-gray-600">
            <CardContent className="p-6">
              <Tabs defaultValue="theaters" value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="bg-gray-800 border-gray-600">
                  <TabsTrigger value="theaters" className="data-[state=active]:bg-rosae-red">Theaters</TabsTrigger>
                  <TabsTrigger value="timeSlots" className="data-[state=active]:bg-rosae-red">Time Slots</TabsTrigger>
                  <TabsTrigger value="expenseCategories" className="data-[state=active]:bg-rosae-red">Expense Categories</TabsTrigger>
                  <TabsTrigger value="expenseCreators" className="data-[state=active]:bg-rosae-red">Expense Creators</TabsTrigger>
                  <TabsTrigger value="integrations" className="data-[state=active]:bg-rosae-red">Integrations</TabsTrigger>
                </TabsList>
                
                <TabsContent value="theaters" className="mt-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold text-white">Theater Names</h3>
                    <Dialog open={isAddDialogOpen && activeTab === "theaters"} onOpenChange={(open) => setIsAddDialogOpen(open)}>
                      <DialogTrigger asChild>
                        <Button className="bg-rosae-red hover:bg-rosae-dark-red">
                          <Plus className="mr-2 w-4 h-4" />
                          Add Theater
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-gray-800 border-gray-600 text-white">
                        <DialogHeader>
                          <DialogTitle className="text-white">Add New Theater</DialogTitle>
                        </DialogHeader>
                        <Form {...form}>
                          <form onSubmit={form.handleSubmit(handleAddItem)} className="space-y-4">
                            <FormField
                              control={form.control}
                              name="name"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-gray-300">Theater Name</FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder="Enter theater name"
                                      className="bg-gray-700 border-gray-600 text-white"
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <div className="flex justify-end">
                              <Button type="submit" className="bg-rosae-red hover:bg-rosae-dark-red">
                                Save
                              </Button>
                            </div>
                          </form>
                        </Form>
                      </DialogContent>
                    </Dialog>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {theatres.map((theater, index) => (
                      <div key={index} className="flex items-center justify-between bg-gray-700 p-3 rounded-md">
                        <span className="text-white">{theater}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteItem("theaters", index)}
                          className="text-gray-400 hover:text-white hover:bg-gray-600"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </TabsContent>
                
                <TabsContent value="timeSlots" className="mt-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold text-white">Time Slots</h3>
                    <Dialog open={isAddDialogOpen && activeTab === "timeSlots"} onOpenChange={(open) => setIsAddDialogOpen(open)}>
                      <DialogTrigger asChild>
                        <Button className="bg-rosae-red hover:bg-rosae-dark-red">
                          <Plus className="mr-2 w-4 h-4" />
                          Add Time Slot
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-gray-800 border-gray-600 text-white">
                        <DialogHeader>
                          <DialogTitle className="text-white">Add New Time Slot</DialogTitle>
                        </DialogHeader>
                        <Form {...form}>
                          <form onSubmit={form.handleSubmit(handleAddItem)} className="space-y-4">
                            <FormField
                              control={form.control}
                              name="name"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-gray-300">Time Slot</FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder="Enter time slot (e.g., 10:00 AM - 12:00 PM)"
                                      className="bg-gray-700 border-gray-600 text-white"
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <div className="flex justify-end">
                              <Button type="submit" className="bg-rosae-red hover:bg-rosae-dark-red">
                                Save
                              </Button>
                            </div>
                          </form>
                        </Form>
                      </DialogContent>
                    </Dialog>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {timeSlots.map((timeSlot, index) => (
                      <div key={index} className="flex items-center justify-between bg-gray-700 p-3 rounded-md">
                        <span className="text-white">{timeSlot}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteItem("timeSlots", index)}
                          className="text-gray-400 hover:text-white hover:bg-gray-600"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </TabsContent>
                
                <TabsContent value="expenseCategories" className="mt-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold text-white">Expense Categories</h3>
                    <Dialog open={isAddDialogOpen && activeTab === "expenseCategories"} onOpenChange={(open) => setIsAddDialogOpen(open)}>
                      <DialogTrigger asChild>
                        <Button className="bg-rosae-red hover:bg-rosae-dark-red">
                          <Plus className="mr-2 w-4 h-4" />
                          Add Category
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-gray-800 border-gray-600 text-white">
                        <DialogHeader>
                          <DialogTitle className="text-white">Add New Expense Category</DialogTitle>
                        </DialogHeader>
                        <Form {...form}>
                          <form onSubmit={form.handleSubmit(handleAddItem)} className="space-y-4">
                            <FormField
                              control={form.control}
                              name="name"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-gray-300">Category Name</FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder="Enter category name"
                                      className="bg-gray-700 border-gray-600 text-white"
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <div className="flex justify-end">
                              <Button type="submit" className="bg-rosae-red hover:bg-rosae-dark-red">
                                Save
                              </Button>
                            </div>
                          </form>
                        </Form>
                      </DialogContent>
                    </Dialog>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {expenseCategories.map((category, index) => (
                      <div key={index} className="flex items-center justify-between bg-gray-700 p-3 rounded-md">
                        <span className="text-white">{category}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteItem("expenseCategories", index)}
                          className="text-gray-400 hover:text-white hover:bg-gray-600"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </TabsContent>
                
                <TabsContent value="expenseCreators" className="mt-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold text-white">Expense Creators</h3>
                    <Dialog open={isAddDialogOpen && activeTab === "expenseCreators"} onOpenChange={(open) => setIsAddDialogOpen(open)}>
                      <DialogTrigger asChild>
                        <Button className="bg-rosae-red hover:bg-rosae-dark-red">
                          <Plus className="mr-2 w-4 h-4" />
                          Add Creator
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-gray-800 border-gray-600 text-white">
                        <DialogHeader>
                          <DialogTitle className="text-white">Add New Expense Creator</DialogTitle>
                        </DialogHeader>
                        <Form {...form}>
                          <form onSubmit={form.handleSubmit(handleAddItem)} className="space-y-4">
                            <FormField
                              control={form.control}
                              name="name"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-gray-300">Creator Name</FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder="Enter creator name"
                                      className="bg-gray-700 border-gray-600 text-white"
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <div className="flex justify-end">
                              <Button type="submit" className="bg-rosae-red hover:bg-rosae-dark-red">
                                Save
                              </Button>
                            </div>
                          </form>
                        </Form>
                      </DialogContent>
                    </Dialog>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {expenseCreators.map((creator, index) => (
                      <div key={index} className="flex items-center justify-between bg-gray-700 p-3 rounded-md">
                        <span className="text-white">{creator}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteItem("expenseCreators", index)}
                          className="text-gray-400 hover:text-white hover:bg-gray-600"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                {/* Integrations tab */}
                <TabsContent value="integrations" className="mt-6">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                      <Card className="bg-gray-800 border-gray-600">
                        <CardHeader>
                          <CardTitle className="text-white">Google Calendar Sync</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-5 text-white">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">Enable scheduler</p>
                              <p className="text-sm text-gray-400">When enabled, the sync task can run every 3 minutes via Windows Task Scheduler</p>
                            </div>
                            <Switch
                              checked={!!integrationSettings?.calendarSyncEnabled}
                              onCheckedChange={(checked) => setIntegrationSettings((prev) => ({ ...prev, calendarSyncEnabled: checked }))}
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="calendarId" className="text-gray-300">Calendar ID</Label>
                              <Input
                                id="calendarId"
                                className="bg-gray-700 border-gray-600 text-white"
                                value={integrationSettings?.calendarId || ""}
                                onChange={(e) => setIntegrationSettings((prev) => ({ ...prev, calendarId: e.target.value }))}
                                placeholder="primary or your_calendar_id@group.calendar.google.com"
                              />
                            </div>
                            <div>
                              <Label htmlFor="syncDays" className="text-gray-300">Sync window (days)</Label>
                              <Input
                                id="syncDays"
                                type="number"
                                min={1}
                                className="bg-gray-700 border-gray-600 text-white"
                                value={integrationSettings?.syncWindowDays ?? 30}
                                onChange={(e) => setIntegrationSettings((prev) => ({ ...prev, syncWindowDays: Math.max(1, Number(e.target.value || 30)) }))}
                              />
                            </div>
                          </div>

                          <div className="flex justify-end">
                            <Button
                              onClick={() => updateConfigMutation.mutate({ theatres, timeSlots, expenseCategories, expenseCreators, integrationSettings })}
                              className="bg-rosae-red hover:bg-rosae-dark-red"
                            >
                              Save Integrations
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="lg:col-span-1">
                      <Card className="bg-gray-800 border-gray-600 overflow-hidden">
                        <CardHeader>
                          <CardTitle className="text-white">ROSAE</CardTitle>
                        </CardHeader>
                        <CardContent className="flex items-center justify-center p-6">
                          <img src="/rosae-logo.jpg" alt="ROSAE" className="rounded-md max-h-40 object-contain" />
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}