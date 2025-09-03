import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { isUnauthorizedError } from "@/lib/authUtils";
import Layout from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BookingModal } from "@/components/booking-modal";
import { useState, useMemo } from "react";
import { 
  IndianRupee, 
  Ticket, 
  Banknote, 
  CreditCard,
  TrendingUp,
  ArrowUp,
  RotateCcw,
  Target,
  Bell,
  Sparkles,
  Clock
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend
} from "recharts";

export default function Dashboard() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();
  const queryClient = useQueryClient();
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [goalAmount, setGoalAmount] = useState("");
  const [showCelebration, setShowCelebration] = useState(false);

  // Redirect to home if not authenticated
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
  }, [isAuthenticated, isLoading, toast]);

  // Refresh dashboard analytics when refunds change elsewhere in the app
  useEffect(() => {
    const handler = () => {
      // re-fetch queries used by this dashboard
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/daily-revenue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/payment-methods"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/time-slots"] });
    };
    window.addEventListener('refunds:changed', handler);
    return () => window.removeEventListener('refunds:changed', handler);
  }, []);

  // Month filter (defaults to current month)
  const [month, setMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM
  });

  const getMonthRange = (ym: string) => {
    const [y, m] = ym.split('-').map(Number);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0);
    const toIso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().split('T')[0];
    return { startDate: toIso(start), endDate: toIso(end) };
  };

  const monthRange = getMonthRange(month);

  const { data: dailyRevenue, isLoading: isDailyRevenueLoading, error: dailyRevenueError } = useQuery<any[]>({
    queryKey: ["/api/analytics/daily-revenue", monthRange],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('startDate', monthRange.startDate);
      params.set('endDate', monthRange.endDate);
      const res = await fetch(`/api/analytics/daily-revenue?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    }
  });

  const { data: paymentMethods, isLoading: isPaymentMethodsLoading, error: paymentMethodsError } = useQuery<any>({
    queryKey: ["/api/analytics/payment-methods", monthRange],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('startDate', monthRange.startDate);
      params.set('endDate', monthRange.endDate);
      const res = await fetch(`/api/analytics/payment-methods?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) return { cash: 0, upi: 0 };
      return res.json();
    }
  });

  const { data: timeSlots, isLoading: isTimeSlotsLoading, error: timeSlotsError } = useQuery<any[]>({
    queryKey: ["/api/analytics/time-slots", monthRange],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('startDate', monthRange.startDate);
      params.set('endDate', monthRange.endDate);
      const res = await fetch(`/api/analytics/time-slots?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    }
  });

  const { data: recentBookings, isLoading: isRecentBookingsLoading, error: recentBookingsError } = useQuery<any[]>({
    queryKey: ["/api/bookings", { page: 1, pageSize: 20 }],
    queryFn: async ({ queryKey }) => {
      const [, params] = queryKey as any;
      const search = new URLSearchParams({ page: String(params.page), pageSize: String(params.pageSize) });
      const res = await fetch(`/api/bookings?${search.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load recent bookings');
      return res.json();
    },
  });

  // Revenue progress query
  const { data: revenueProgress, isLoading: isRevenueProgressLoading } = useQuery({
    queryKey: ["/api/revenue/progress", month],
    queryFn: async () => {
      const res = await fetch(`/api/revenue/progress?month=${month}`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  // Notifications query
  const { data: notifications, isLoading: isNotificationsLoading } = useQuery({
    queryKey: ["/api/notifications"],
    queryFn: async () => {
      const res = await fetch("/api/notifications", { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Set monthly goal mutation
  const setGoalMutation = useMutation({
    mutationFn: async (data: { month: string; goalAmount: number }) => {
      const res = await fetch("/api/revenue/goal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/revenue/progress", month] });
      toast({ title: "Success", description: "Monthly goal set successfully!" });
      setIsGoalModalOpen(false);
      setGoalAmount("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Mark notification as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const res = await fetch(`/api/notifications/${notificationId}/read`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  // Handle errors
  useEffect(() => {
    const errors = [dailyRevenueError, paymentMethodsError, timeSlotsError, recentBookingsError];
    errors.forEach(error => {
      if (error && isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
      }
    });
  }, [dailyRevenueError, paymentMethodsError, timeSlotsError, recentBookingsError, toast]);

  // Check for goal achievement and trigger celebration
  useEffect(() => {
    if (revenueProgress && revenueProgress.progress >= 100 && !showCelebration) {
      setShowCelebration(true);
      toast({
        title: "🎉 Congratulations!",
        description: "We reached our target 🎉",
        duration: 5000,
      });
      // Hide celebration after 5 seconds
      setTimeout(() => setShowCelebration(false), 5000);
    }
  }, [revenueProgress, showCelebration, toast]);

  // Helper functions
  const handleSetGoal = () => {
    if (!goalAmount || isNaN(Number(goalAmount)) || Number(goalAmount) <= 0) {
      toast({ title: "Error", description: "Please enter a valid goal amount", variant: "destructive" });
      return;
    }
    setGoalMutation.mutate({ month, goalAmount: Number(goalAmount) });
  };

  const unreadNotifications = notifications?.filter((n: any) => !n.isRead) || [];
  const isAdmin = user?.role === 'admin';
  


  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-800 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="relative">
            <div className="w-20 h-20 rounded-full border-4 border-neutral-700 border-t-rosae-red animate-spin" />
            <img src="/rosae-logo.jpg" alt="ROSAE" className="w-8 h-8 rounded absolute inset-0 m-auto shadow" />
          </div>
          <p className="mt-4 text-neutral-400 text-sm tracking-wide">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  // Calculate selected month stats
  const safeDaily = Array.isArray(dailyRevenue) ? dailyRevenue : [];
  const monthTotalRevenue = safeDaily.reduce((sum: number, d: any) => sum + (Number(d.revenue) || 0), 0);
  const monthTotalBookings = safeDaily.reduce((sum: number, d: any) => sum + (Number(d.bookings) || 0), 0);
  const monthRefundedCount = safeDaily.reduce((sum: number, d: any) => sum + (Number(d.refunded) || 0), 0);
  const firstHalf = safeDaily.slice(0, Math.floor(safeDaily.length / 2));
  const secondHalf = safeDaily.slice(Math.floor(safeDaily.length / 2));

  // Add goal target to daily revenue data for chart
  const dailyRevenueWithGoal = useMemo(() => {
    if (!dailyRevenue || !revenueProgress?.goal) return dailyRevenue || [];
    
    const daysInMonth = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0).getDate();
    const dailyGoalTarget = revenueProgress.goal.goalAmount / daysInMonth;
    
    return (dailyRevenue || []).map((day: any) => ({
      ...day,
      goalTarget: dailyGoalTarget
    }));
  }, [dailyRevenue, revenueProgress, month]);
  const firstHalfRevenue = firstHalf.reduce((s: number, d: any) => s + (Number(d.revenue) || 0), 0);
  const secondHalfRevenue = secondHalf.reduce((s: number, d: any) => s + (Number(d.revenue) || 0), 0);
  const revenueChange = firstHalfRevenue > 0 ? ((secondHalfRevenue - firstHalfRevenue) / firstHalfRevenue) * 100 : 0;

  const cashAmount = paymentMethods?.cash || 0;
  const upiAmount = paymentMethods?.upi || 0;
  const totalPayments = cashAmount + upiAmount;
  const cashPercentage = totalPayments > 0 ? (cashAmount / totalPayments) * 100 : 0;
  const upiPercentage = totalPayments > 0 ? (upiAmount / totalPayments) * 100 : 0;

  const pieData = [
    { name: 'Cash', value: cashPercentage, amount: cashAmount },
    { name: 'UPI', value: upiPercentage, amount: upiAmount },
  ];

  const COLORS = ['#10B981', '#8B5CF6'];

  const formatCurrency = (value: number) => {
    return `₹${value.toLocaleString('en-IN')}`;
  };

  return (
    <Layout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-white" data-testid="text-page-title">Dashboard Overview</h2>
            <p className="text-gray-400">Welcome back, manage your theatre operations</p>
          </div>
          <div className="flex items-center space-x-4">
            {/* Notifications Bell */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="relative">
                  <Bell className="w-5 h-5 text-gray-400" />
                  {unreadNotifications.length > 0 && (
                    <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center bg-red-500 text-xs">
                      {unreadNotifications.length}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 bg-rosae-dark-gray border-gray-600">
                <div className="p-2">
                  <h3 className="font-semibold text-white mb-2">Notifications</h3>
                  {notifications && notifications.length > 0 ? (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {notifications.slice(0, 5).map((notification: any) => (
                        <DropdownMenuItem
                          key={notification.id}
                          className={`p-3 cursor-pointer ${!notification.isRead ? 'bg-blue-500/10' : ''}`}
                          onClick={() => !notification.isRead && markAsReadMutation.mutate(notification.id)}
                        >
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <p className="font-medium text-white text-sm">{notification.title}</p>
                              {!notification.isRead && <div className="w-2 h-2 bg-blue-500 rounded-full"></div>}
                            </div>
                            <p className="text-gray-400 text-xs mt-1">{notification.body}</p>
                            <p className="text-gray-500 text-xs mt-1">
                              {new Date(notification.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </DropdownMenuItem>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-400 text-sm">No notifications</p>
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="flex items-center space-x-2">
              <label className="text-gray-400 text-sm">Month</label>
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="bg-rosae-dark-gray border border-gray-600 text-white rounded px-2 py-1"
              />
            </div>

            {/* Set Monthly Goal Button (Admin Only) */}
            {isAdmin && (
              <Dialog open={isGoalModalOpen} onOpenChange={setIsGoalModalOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700">
                    <Target className="mr-2 w-4 h-4" />
                    Set Monthly Goal
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-rosae-dark-gray border-gray-600">
                  <DialogHeader>
                    <DialogTitle className="text-white">Set Monthly Revenue Goal</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="goal-amount" className="text-gray-300">Goal Amount (₹)</Label>
                      <Input
                        id="goal-amount"
                        type="number"
                        placeholder="e.g., 100000"
                        value={goalAmount}
                        onChange={(e) => setGoalAmount(e.target.value)}
                        className="bg-gray-800 border-gray-600 text-white"
                      />
                    </div>
                    <div className="flex justify-end space-x-2">
                      <Button variant="outline" onClick={() => setIsGoalModalOpen(false)}>
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleSetGoal}
                        disabled={setGoalMutation.isLoading}
                        className="bg-rosae-red hover:bg-rosae-dark-red"
                      >
                        {setGoalMutation.isLoading ? "Setting..." : "Set Goal"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}

            <Button 
              onClick={() => setIsBookingModalOpen(true)}
              className="bg-rosae-red hover:bg-rosae-dark-red px-6 py-2"
              data-testid="button-quick-booking"
            >
              <Ticket className="mr-2 w-4 h-4" />
              Quick Booking
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-rosae-dark-gray border-gray-600">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Selected Month Revenue</p>
                  <p className="text-3xl font-bold text-white" data-testid="text-month-revenue">
                    {formatCurrency(monthTotalRevenue)}
                  </p>
                  <p className="text-green-400 text-sm mt-1">
                    <ArrowUp className="inline w-3 h-3 mr-1" />
                    {revenueChange >= 0 ? '+' : ''}{revenueChange.toFixed(1)}% vs first half
                  </p>
                </div>
                <div className="w-12 h-12 bg-rosae-red/20 rounded-lg flex items-center justify-center">
                  <IndianRupee className="text-rosae-red text-xl" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-rosae-dark-gray border-gray-600">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Selected Month Bookings</p>
                  <p className="text-3xl font-bold text-white" data-testid="text-month-bookings">
                    {monthTotalBookings}
                  </p>
                  <p className="text-green-400 text-sm mt-1">
                    <TrendingUp className="inline w-3 h-3 mr-1" />
                    Total this month
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <Ticket className="text-blue-400 text-xl" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-rosae-dark-gray border-gray-600">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Cash Payments</p>
                  <p className="text-3xl font-bold text-white" data-testid="text-cash-payments">
                    {formatCurrency(cashAmount)}
                  </p>
                  <p className="text-gray-400 text-sm mt-1">{cashPercentage.toFixed(1)}% of total</p>
                </div>
                <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                  <Banknote className="text-green-400 text-xl" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-rosae-dark-gray border-gray-600">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Refunds</p>
                  <p className="text-3xl font-bold text-white" data-testid="text-month-refunds">
                    {monthRefundedCount}
                  </p>
                  <p className="text-gray-400 text-sm mt-1">Approved refunds this month</p>
                </div>
                <div className="w-12 h-12 bg-red-500/20 rounded-lg flex items-center justify-center">
                  <RotateCcw className="text-red-400 text-xl" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Enhanced Revenue Goal Progress Section */}
        {revenueProgress && revenueProgress.goal && (
          <Card className="relative bg-gradient-to-br from-rosae-dark-gray via-gray-800 to-rosae-dark-gray border border-gray-600 shadow-2xl mb-8 overflow-hidden">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-pulse"></div>
            <CardContent className="p-8 relative">
              {/* Header Section */}
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-rosae-red to-red-600 rounded-xl flex items-center justify-center shadow-lg">
                    <Target className="text-white w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white">Monthly Revenue Goal</h3>
                    <p className="text-gray-400 text-sm">Track your progress towards success</p>
                  </div>
                </div>
                {showCelebration && (
                  <div className="flex items-center space-x-3 animate-bounce bg-gradient-to-r from-yellow-400/20 to-green-400/20 px-4 py-2 rounded-full border border-yellow-400/30">
                    <Sparkles className="text-yellow-400 w-6 h-6 animate-spin" />
                    <span className="text-yellow-400 font-bold text-lg">🎉 Congratulations! Target Achieved! 🎉</span>
                    <Sparkles className="text-yellow-400 w-6 h-6 animate-spin" />
                  </div>
                )}
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-400 text-sm font-medium">Current Revenue</p>
                      <p className="text-2xl font-bold text-white">{formatCurrency(revenueProgress.currentRevenue)}</p>
                    </div>
                    <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                      <TrendingUp className="text-blue-400 w-5 h-5" />
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-400 text-sm font-medium">Target Goal</p>
                      <p className="text-2xl font-bold text-white">{formatCurrency(revenueProgress.goal.goalAmount)}</p>
                    </div>
                    <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                      <Target className="text-green-400 w-5 h-5" />
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-400 text-sm font-medium">Remaining</p>
                      <p className="text-2xl font-bold text-white">
                        {formatCurrency(Math.max(0, revenueProgress.goal.goalAmount - revenueProgress.currentRevenue))}
                      </p>
                    </div>
                    <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                      <Clock className="text-orange-400 w-5 h-5" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Enhanced Progress Bar with Tortoise */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold text-white">Progress Tracker</span>
                  <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                    revenueProgress.progress >= 100 ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 
                    revenueProgress.progress >= 75 ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                    revenueProgress.progress >= 50 ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : 
                    'bg-red-500/20 text-red-400 border border-red-500/30'
                  }`}>
                    {revenueProgress.progress.toFixed(1)}% Complete
                  </span>
                </div>
                
                {/* Custom Progress Track */}
                <div className="relative bg-gray-700 rounded-full h-12 overflow-hidden shadow-inner">
                  {/* Background gradient */}
                  <div className="absolute inset-0 bg-gradient-to-r from-gray-700 via-gray-600 to-gray-700"></div>
                  
                  {/* Progress fill with gradient */}
                  <div 
                    className={`absolute top-0 left-0 h-full transition-all duration-2000 ease-out rounded-full ${
                      revenueProgress.progress >= 100 
                        ? 'bg-gradient-to-r from-green-500 via-green-400 to-green-500 shadow-lg shadow-green-500/30' 
                        : revenueProgress.progress >= 75
                        ? 'bg-gradient-to-r from-blue-500 via-blue-400 to-blue-500 shadow-lg shadow-blue-500/30'
                        : revenueProgress.progress >= 50
                        ? 'bg-gradient-to-r from-yellow-500 via-yellow-400 to-yellow-500 shadow-lg shadow-yellow-500/30'
                        : 'bg-gradient-to-r from-red-500 via-red-400 to-red-500 shadow-lg shadow-red-500/30'
                    }`}
                    style={{ width: `${Math.min(revenueProgress.progress, 100)}%` }}
                  >
                    {/* Animated shine effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
                  </div>
                  
                  {/* Tortoise with enhanced animation */}
                  <div 
                    className="absolute top-1/2 transform -translate-y-1/2 transition-all duration-2000 ease-out z-10"
                    style={{ 
                      left: `${Math.min(Math.max(revenueProgress.progress, 2), 95)}%`,
                      transform: 'translateX(-50%) translateY(-50%)'
                    }}
                  >
                    <div className="relative">
                      <span className="text-3xl drop-shadow-lg animate-bounce">🐢</span>
                      {revenueProgress.progress >= 100 && (
                        <div className="absolute -top-8 -left-4 animate-bounce">
                          <span className="text-2xl">🎉</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Progress milestones */}
                  <div className="absolute inset-0 flex justify-between items-center px-2">
                    {[25, 50, 75, 100].map((milestone) => (
                      <div 
                        key={milestone}
                        className={`w-1 h-8 rounded-full ${
                          revenueProgress.progress >= milestone ? 'bg-white/60' : 'bg-gray-500/40'
                        }`}
                        style={{ marginLeft: milestone === 25 ? '23%' : milestone === 50 ? '23%' : milestone === 75 ? '23%' : '0%' }}
                      />
                    ))}
                  </div>
                </div>

                {/* Status and Motivation */}
                <div className="flex items-center justify-between bg-gray-800/30 rounded-xl p-4 border border-gray-700">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full animate-pulse ${
                      revenueProgress.progress >= 100 ? 'bg-green-400' : 
                      revenueProgress.progress >= 50 ? 'bg-yellow-400' : 'bg-red-400'
                    }`}></div>
                    <span className="text-white font-medium">
                      {revenueProgress.progress >= 100 ? '🎯 Excellent! Target Achieved!' : 
                       revenueProgress.progress >= 75 ? '🚀 Almost There! Keep Going!' :
                       revenueProgress.progress >= 50 ? '⚡ Great Progress! On Track!' : 
                       revenueProgress.progress >= 25 ? '💪 Good Start! Push Forward!' :
                       '🔥 Let\'s Get Started!'}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-400 text-sm">Days Remaining</p>
                    <p className="text-white font-bold">
                      {new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate()} days
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Daily Revenue Chart */}
          <Card className="bg-rosae-dark-gray border-gray-600">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-white" data-testid="text-daily-revenue-title">Daily Revenue</h3>
              </div>
              <div className="h-64">
                {isDailyRevenueLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <img src="/spinner.gif" alt="Loading" className="w-10 h-10" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyRevenue}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="date" stroke="#9CA3AF" />
                      <YAxis yAxisId="left" stroke="#9CA3AF" tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`} />
                      <YAxis yAxisId="right" orientation="right" stroke="#9CA3AF" />
                      <Tooltip formatter={(value: any, name: string) => {
                        if (name === 'revenue') return [formatCurrency(Number(value)), 'Revenue'];
                        if (name === 'refunded') return [Number(value), 'Refunded'];
                        return [value, name];
                      }} />
                      <Legend />
                      <Bar yAxisId="left" dataKey="revenue" name="Revenue" fill="#DC2626" radius={[4, 4, 0, 0]} />
                      <Bar yAxisId="right" dataKey="refunded" name="Refunded" fill="#6B7280" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Payment Methods Pie Chart */}
          <Card className="bg-rosae-dark-gray border-gray-600">
            <CardContent className="p-6">
              <h3 className="text-xl font-semibold text-white mb-6" data-testid="text-payment-methods-title">Payment Methods</h3>
              <div className="h-64">
                {isPaymentMethodsLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="w-10 h-10 border-4 border-gray-600 border-t-rosae-red rounded-full animate-spin" aria-label="Loading"></div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        innerRadius={40}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number, name) => [`${value.toFixed(1)}%`, name]} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Revenue vs Goal Line Chart */}
        {revenueProgress && revenueProgress.goal && (
          <Card className="bg-rosae-dark-gray border-gray-600 mb-8">
            <CardContent className="p-6">
              <h3 className="text-xl font-semibold text-white mb-6">Revenue vs Goal Trend</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyRevenueWithGoal}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="date" stroke="#9CA3AF" />
                    <YAxis stroke="#9CA3AF" tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(value: any, name: string) => {
                      if (name === 'revenue') return [formatCurrency(Number(value)), 'Daily Revenue'];
                      if (name === 'goal') return [formatCurrency(Number(value)), 'Daily Goal Target'];
                      return [value, name];
                    }} />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="revenue" 
                      name="Daily Revenue"
                      stroke="#DC2626" 
                      strokeWidth={2} 
                      dot={{ fill: '#DC2626', strokeWidth: 2, r: 4 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="goalTarget" 
                      name="Daily Goal Target"
                      stroke="#10B981" 
                      strokeWidth={2} 
                      strokeDasharray="5 5"
                      dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Bookings & Time Slot Performance */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Bookings */}
          <div className="lg:col-span-2">
            <Card className="bg-rosae-dark-gray border-gray-600">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold text-white" data-testid="text-recent-bookings-title">Recent Bookings</h3>
                  <Button 
                    variant="ghost" 
                    className="text-rosae-red hover:text-rosae-dark-red"
                    onClick={() => window.location.href = "/bookings"}
                    data-testid="button-view-all-bookings"
                  >
                    View All
                  </Button>
                </div>
                <div className="overflow-x-auto">
                  {isRecentBookingsLoading ? (
                    <div className="flex items-center justify-center h-32 text-gray-400">Loading...</div>
                  ) : recentBookings && recentBookings.length > 0 ? (
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-gray-400 text-sm border-b border-gray-600">
                          <th className="pb-3">Theatre</th>
                          <th className="pb-3">Time</th>
                          <th className="pb-3">Guests</th>
                          <th className="pb-3">Amount</th>
                          <th className="pb-3">Payment</th>
                        </tr>
                      </thead>
                      <tbody className="text-white">
                        {recentBookings.slice(0, 5).map((booking: any) => (
                          <tr key={booking.id} className="border-b border-gray-700" data-testid={`row-booking-${booking.id}`}>
                            <td className="py-3">{booking.theatreName}</td>
                            <td className="py-3 text-gray-300">{booking.timeSlot}</td>
                            <td className="py-3">{booking.guests}</td>
                            <td className="py-3 font-medium">{formatCurrency(Number(booking.totalAmount))}</td>
                            <td className="py-3">
                              <span className="px-2 py-1 bg-green-600/20 text-green-400 rounded-full text-xs">
                                {Number(booking.cashAmount) > 0 && Number(booking.upiAmount) > 0 ? 'Mixed' : 
                                 Number(booking.cashAmount) > 0 ? 'Cash' : 'UPI'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="text-center py-8 text-gray-400">No bookings found</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Time Slot Performance */}
          <Card className="bg-rosae-dark-gray border-gray-600">
            <CardContent className="p-6">
              <h3 className="text-xl font-semibold text-white mb-6" data-testid="text-time-slot-performance-title">Time Slot Performance</h3>
              <div className="space-y-4">
                {isTimeSlotsLoading ? (
                  <div className="flex items-center justify-center h-32 text-gray-400">Loading...</div>
                ) : timeSlots && timeSlots.length > 0 ? (
                  timeSlots.map((slot: any) => {
                    const maxRevenue = Math.max(...timeSlots.map((s: any) => s.revenue));
                    const occupancyPercentage = maxRevenue > 0 ? (slot.revenue / maxRevenue) * 100 : 0;
                    
                    return (
                      <div key={slot.timeSlot} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg" data-testid={`card-slot-${slot.timeSlot}`}>
                        <div>
                          <p className="text-white font-medium">{slot.timeSlot}</p>
                          <p className="text-gray-400 text-sm">{slot.bookings} bookings</p>
                        </div>
                        <div className="text-right">
                          <p className="text-white font-medium">{formatCurrency(slot.revenue)}</p>
                          <div className="w-16 bg-gray-700 rounded-full h-2 mt-1">
                            <div 
                              className="bg-rosae-red h-2 rounded-full" 
                              style={{ width: `${occupancyPercentage}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-gray-400">No time slot data available</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <BookingModal 
          isOpen={isBookingModalOpen} 
          onClose={() => setIsBookingModalOpen(false)} 
        />
      </div>
    </Layout>
  );
}
