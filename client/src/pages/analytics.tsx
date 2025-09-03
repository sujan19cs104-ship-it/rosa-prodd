import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { isUnauthorizedError } from "@/lib/authUtils";
import Layout from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart3, TrendingUp, PieChart } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  LineChart,
  Line,
  Area,
  AreaChart
} from "recharts";

export default function Analytics() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();

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
      const res = await fetch(`/api/analytics/daily-revenue?${params.toString()}`);
      return res.json();
    }
  });

  const { data: paymentMethods, isLoading: isPaymentMethodsLoading, error: paymentMethodsError } = useQuery<any>({
    queryKey: ["/api/analytics/payment-methods", monthRange],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('startDate', monthRange.startDate);
      params.set('endDate', monthRange.endDate);
      const res = await fetch(`/api/analytics/payment-methods?${params.toString()}`);
      return res.json();
    }
  });

  const { data: timeSlots, isLoading: isTimeSlotsLoading, error: timeSlotsError } = useQuery<any[]>({
    queryKey: ["/api/analytics/time-slots", monthRange],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('startDate', monthRange.startDate);
      params.set('endDate', monthRange.endDate);
      const res = await fetch(`/api/analytics/time-slots?${params.toString()}`);
      return res.json();
    }
  });

  // Handle errors
  useEffect(() => {
    const errors = [dailyRevenueError, paymentMethodsError, timeSlotsError];
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
  }, [dailyRevenueError, paymentMethodsError, timeSlotsError, toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-rosae-black flex items-center justify-center">
        <div className="text-white text-lg">Loading...</div>
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return `₹${value.toLocaleString('en-IN')}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', { 
      month: 'short', 
      day: 'numeric' 
    });
  };

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

  return (
    <Layout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-white" data-testid="text-page-title">Analytics Dashboard</h2>
            <p className="text-gray-400">Comprehensive data visualization and business insights</p>
          </div>
          <div className="flex items-center space-x-2">
            <label className="text-gray-400 text-sm">Month</label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="bg-rosae-dark-gray border border-gray-600 text-white rounded px-2 py-1"
            />
          </div>
        </div>

        {/* Revenue Trends */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Monthly Revenue Trend */}
          <Card className="bg-rosae-dark-gray border-gray-600">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-white flex items-center" data-testid="text-monthly-revenue-title">
                  <TrendingUp className="w-5 h-5 mr-2 text-rosae-red" />
                  Monthly Revenue Trend
                </h3>
              </div>
              <div className="h-80">
                {isDailyRevenueLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="w-10 h-10 border-4 border-gray-600 border-t-rosae-red rounded-full animate-spin" aria-label="Loading"></div>
                  </div>
                ) : dailyRevenue && dailyRevenue.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyRevenue}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#DC2626" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#DC2626" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis 
                        dataKey="date" 
                        stroke="#9CA3AF" 
                        tickFormatter={formatDate}
                      />
                      <YAxis 
                        stroke="#9CA3AF" 
                        tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`} 
                      />
                      <Tooltip 
                        formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                        labelFormatter={(label) => formatDate(label)}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="revenue" 
                        stroke="#DC2626" 
                        fillOpacity={1} 
                        fill="url(#colorRevenue)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">No revenue data available</div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Show Count vs Revenue */}
          <Card className="bg-rosae-dark-gray border-gray-600">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-white flex items-center" data-testid="text-shows-vs-revenue-title">
                  <BarChart3 className="w-5 h-5 mr-2 text-rosae-red" />
                  Daily Shows vs Revenue
                </h3>
              </div>
              <div className="h-80">
                {isDailyRevenueLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="w-10 h-10 border-4 border-gray-600 border-t-rosae-red rounded-full animate-spin" aria-label="Loading"></div>
                  </div>
                ) : dailyRevenue && dailyRevenue.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyRevenue}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis 
                        dataKey="date" 
                        stroke="#9CA3AF" 
                        tickFormatter={formatDate}
                      />
                      <YAxis 
                        yAxisId="bookings"
                        orientation="left"
                        stroke="#8B5CF6" 
                      />
                      <YAxis 
                        yAxisId="revenue"
                        orientation="right"
                        stroke="#DC2626" 
                        tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
                      />
                      <Tooltip 
                        formatter={(value: number, name: string) => [
                          name === 'revenue' ? formatCurrency(value) : value,
                          name === 'revenue' ? 'Revenue' : 'Bookings'
                        ]}
                        labelFormatter={(label) => formatDate(label)}
                      />
                      <Bar yAxisId="bookings" dataKey="bookings" fill="#8B5CF6" name="bookings" />
                      <Bar yAxisId="revenue" dataKey="revenue" fill="#DC2626" name="revenue" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">No data available</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payment Analysis & Time Slot Performance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Enhanced Payment Methods Breakdown */}
          <Card className="bg-rosae-dark-gray border-gray-600">
            <CardContent className="p-6">
              <h3 className="text-xl font-semibold text-white mb-6 flex items-center" data-testid="text-payment-breakdown-title">
                <PieChart className="w-5 h-5 mr-2 text-rosae-red" />
                Payment Methods Breakdown
              </h3>
              <div className="h-80">
                {isPaymentMethodsLoading ? (
                  <div className="flex items-center justify-center h-full text-gray-400">Loading...</div>
                ) : (
                  <div className="flex items-center justify-between h-full">
                    <div className="w-1/2">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            innerRadius={40}
                            dataKey="value"
                            label={({ name, value }) => `${name}: ${value.toFixed(1)}%`}
                          >
                            {pieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="w-1/2 pl-6">
                      <div className="space-y-4">
                        <div className="p-4 bg-gray-800 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-green-400 font-medium">Cash Payments</span>
                            <span className="text-white font-bold">{formatCurrency(cashAmount)}</span>
                          </div>
                          <div className="text-sm text-gray-400">{cashPercentage.toFixed(1)}% of total revenue</div>
                        </div>
                        <div className="p-4 bg-gray-800 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-purple-400 font-medium">UPI Payments</span>
                            <span className="text-white font-bold">{formatCurrency(upiAmount)}</span>
                          </div>
                          <div className="text-sm text-gray-400">{upiPercentage.toFixed(1)}% of total revenue</div>
                        </div>
                        <div className="p-4 bg-rosae-red/10 border border-rosae-red/20 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-rosae-red font-medium">Total Revenue</span>
                            <span className="text-white font-bold">{formatCurrency(totalPayments)}</span>
                          </div>
                          <div className="text-sm text-gray-400">Combined payment methods</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Time Slot Analysis */}
          <Card className="bg-rosae-dark-gray border-gray-600">
            <CardContent className="p-6">
              <h3 className="text-xl font-semibold text-white mb-6" data-testid="text-time-slot-analysis-title">Time Slot Performance Analysis</h3>
              <div className="h-80">
                {isTimeSlotsLoading ? (
                  <div className="flex items-center justify-center h-full text-gray-400">Loading...</div>
                ) : timeSlots && timeSlots.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={timeSlots} layout="horizontal">
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis 
                        type="number" 
                        stroke="#9CA3AF" 
                        tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
                      />
                      <YAxis type="category" dataKey="timeSlot" stroke="#9CA3AF" width={80} />
                      <Tooltip 
                        formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                      />
                      <Bar 
                        dataKey="revenue" 
                        fill="#DC2626" 
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">No time slot data available</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Guest Distribution Analysis */}
        {timeSlots && timeSlots.length > 0 && (
          <Card className="bg-rosae-dark-gray border-gray-600 mb-8">
            <CardContent className="p-6">
              <h3 className="text-xl font-semibold text-white mb-6" data-testid="text-guest-distribution-title">Guest Distribution by Time Slot</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timeSlots || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="timeSlot" stroke="#9CA3AF" />
                    <YAxis stroke="#9CA3AF" />
                    <Tooltip 
                      formatter={(value: number) => [value, 'Total Bookings']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="bookings" 
                      stroke="#DC2626" 
                      strokeWidth={3}
                      dot={{ fill: '#DC2626', strokeWidth: 2, r: 6 }}
                      activeDot={{ r: 8, stroke: '#DC2626', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
