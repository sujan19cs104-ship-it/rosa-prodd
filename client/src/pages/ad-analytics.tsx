import { useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Printer, Filter, BarChart3, PieChart as PieChartIcon, Activity, Target, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

const INR = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const safeDiv = (num: number, den: number) => den > 0 ? (num / den) : NaN;
const fmt = (v: number) => isFinite(v) ? v.toFixed(2) : "—";
const fmtPct = (v: number) => isFinite(v) ? `${(v*100).toFixed(1)}%` : "—";
const COLORS = ['#22c55e','#ef4444'];

// Professional KPI Card Component for Analytics
const AnalyticsKpiCard = ({ title, value, subtitle, trend, icon: Icon, color = "text-white" }: { 
  title: string; 
  value: string; 
  subtitle?: string; 
  trend?: 'up' | 'down' | 'neutral';
  icon?: any;
  color?: string;
}) => (
  <Card className="bg-gradient-to-br from-rosae-dark-gray to-gray-800 border border-gray-600 hover:border-rosae-red/50 transition-all duration-300">
    <CardContent className="p-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide">{title}</h3>
        {Icon && <Icon className="w-5 h-5 text-rosae-red" />}
      </div>
      <div className="flex items-end justify-between">
        <div>
          <p className={`text-2xl font-bold mb-1 ${color}`}>{value}</p>
          {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
        </div>
        {trend && (
          <div className={`flex items-center ${
            trend === 'up' ? 'text-green-400' : 
            trend === 'down' ? 'text-red-400' : 'text-gray-400'
          }`}>
            {trend === 'up' && <TrendingUp className="w-4 h-4" />}
            {trend === 'down' && <TrendingDown className="w-4 h-4" />}
            {trend === 'neutral' && <Minus className="w-4 h-4" />}
          </div>
        )}
      </div>
    </CardContent>
  </Card>
);

export default function AdAnalyticsPage() {
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();

  // Check if user is admin
  if (isAuthenticated && user && user.role !== 'admin') {
    return (
      <div className="flex min-h-screen bg-rosae-black text-white">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-rosae-red mb-4">Access Denied</h1>
            <p className="text-gray-400">Only administrators can access the Ad Analytics page.</p>
          </div>
        </div>
      </div>
    );
  }

  const [filters, setFilters] = useState({
    range: 'last7',
    startDate: '',
    endDate: '',
    campaignName: '',
    platform: 'all'
  });

  const { data: rows } = useQuery<any[]>({
    queryKey: ["/api/ad-spends", filters],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (filters.campaignName) qs.set('campaignName', filters.campaignName);
      if (filters.platform && filters.platform !== "all") qs.set('platform', filters.platform);
      if (filters.range === 'custom') {
        if (filters.startDate) qs.set('startDate', filters.startDate);
        if (filters.endDate) qs.set('endDate', filters.endDate);
      } else {
        const today = new Date();
        const end = today.toISOString().slice(0,10);
        const start = new Date(today);
        if (filters.range === 'today') {
          // same day
        } else if (filters.range === 'yesterday') {
          start.setDate(today.getDate() - 1);
          (today as any).setDate(today.getDate() - 1);
        } else if (filters.range === 'last7') {
          start.setDate(today.getDate() - 7);
        } else if (filters.range === 'last30') {
          start.setDate(today.getDate() - 30);
        }
        const startStr = start.toISOString().slice(0,10);
        const endStr = (filters.range === 'yesterday' ? new Date(today).toISOString().slice(0,10) : end);
        qs.set('startDate', startStr);
        qs.set('endDate', endStr);
      }
      const res = await apiRequest('GET', `/api/ad-spends?${qs.toString()}`);
      return res.json();
    }
  });

  const list = Array.isArray(rows) ? rows : [];

  // KPIs
  const spend = list.reduce((s, r) => s + Number(r.adSpend||0), 0);
  const leads = list.reduce((s, r) => s + Number(r.totalLeads||0), 0);
  const good = list.reduce((s, r) => s + Number(r.goodLeads||0), 0);
  const bad = list.reduce((s, r) => s + Number(r.badLeads||0), 0);
  const sales = list.reduce((s, r) => s + Number(r.salesCount||0), 0);
  const revenue = list.reduce((s, r) => s + Number(r.revenue||0), 0);

  const CPL = safeDiv(spend, leads);
  const CPQL = safeDiv(spend, good);
  const CPA = safeDiv(spend, sales);
  const ROAS = safeDiv(revenue, spend);

  // Charts data
  const lineData = useMemo(() => {
    const byDate = new Map<string, any>();
    list.forEach(r => {
      const d = r.date;
      if (!byDate.has(d)) byDate.set(d, { date: d, CPL: 0, CPQL: 0, CPA: 0, spend: 0, leads: 0, good: 0, sales: 0 });
      const row = byDate.get(d);
      row.spend += Number(r.adSpend||0);
      row.leads += Number(r.totalLeads||0);
      row.good += Number(r.goodLeads||0);
      row.sales += Number(r.salesCount||0);
      row.CPL = safeDiv(row.spend, row.leads);
      row.CPQL = safeDiv(row.spend, row.good);
      row.CPA = safeDiv(row.spend, row.sales);
    });
    return Array.from(byDate.values()).sort((a,b) => a.date.localeCompare(b.date));
  }, [rows]);

  const barData = useMemo(() => {
    const byDate = new Map<string, any>();
    list.forEach(r => {
      const d = r.date;
      if (!byDate.has(d)) byDate.set(d, { date: d, Spend: 0, Leads: 0, GoodLeads: 0 });
      const row = byDate.get(d);
      row.Spend += Number(r.adSpend||0);
      row.Leads += Number(r.totalLeads||0);
      row.GoodLeads += Number(r.goodLeads||0);
    });
    return Array.from(byDate.values()).sort((a,b) => a.date.localeCompare(b.date));
  }, [rows]);

  const pieData = [
    { name: 'Good', value: good },
    { name: 'Bad', value: bad },
  ];

  const funnelSteps = useMemo(() => {
    // if available, take sum of impressions -> clicks -> leads -> good -> sales
    const imps = list.reduce((s, r) => s + Number(r.impressions||0), 0);
    const clicks = list.reduce((s, r) => s + Number(r.clicks||0), 0);
    return [
      { name: 'Impressions', value: imps },
      { name: 'Clicks', value: clicks },
      { name: 'Leads', value: leads },
      { name: 'Good Leads', value: good },
      { name: 'Sales', value: sales },
    ];
  }, [rows]);

  const handlePrint = () => {
    const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    window.print(); // Print charts with the page
  };

  if (!isAuthenticated) {
    window.location.href = "/api/login";
    return null;
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-rosae-black via-gray-900 to-rosae-black text-white">
      <Sidebar />
      <div className="flex-1 p-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
              Ad Analytics Dashboard
            </h1>
            <p className="text-gray-400 mt-1">Comprehensive insights into your advertising performance</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button 
              variant="outline" 
              className="border-gray-600 hover:border-rosae-red hover:bg-rosae-red/10 transition-all duration-300"
              onClick={handlePrint}
            >
              <Printer className="w-4 h-4 mr-2"/> Print Report
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="bg-gradient-to-r from-gray-800 to-gray-700 border border-gray-600 shadow-xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="w-5 h-5 text-rosae-red" />
              <h3 className="text-lg font-semibold">Analytics Filters</h3>
            </div>
            <div className="grid gap-4 md:grid-cols-6">
              <div className="md:col-span-2 space-y-2">
                <label className="text-sm font-medium text-gray-300">Time Range</label>
                <Select value={filters.range} onValueChange={(v) => setFilters(f => ({...f, range: v}))}>
                  <SelectTrigger className="bg-gray-700 border-gray-600 focus:border-rosae-red text-white">
                    <SelectValue placeholder="Select Range" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-700 border-gray-600 text-white">
                    <SelectItem value="today" className="text-white hover:bg-gray-600 focus:bg-gray-600">Today</SelectItem>
                    <SelectItem value="yesterday" className="text-white hover:bg-gray-600 focus:bg-gray-600">Yesterday</SelectItem>
                    <SelectItem value="last7" className="text-white hover:bg-gray-600 focus:bg-gray-600">Last 7 days</SelectItem>
                    <SelectItem value="last30" className="text-white hover:bg-gray-600 focus:bg-gray-600">Last 30 days</SelectItem>
                    <SelectItem value="custom" className="text-white hover:bg-gray-600 focus:bg-gray-600">Custom Range</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {filters.range === 'custom' && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">Start Date</label>
                    <Input 
                      type="date" 
                      value={filters.startDate} 
                      onChange={e => setFilters(f => ({...f, startDate: e.target.value}))}
                      className="bg-gray-700 border-gray-600 focus:border-rosae-red focus:ring-rosae-red/20 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">End Date</label>
                    <Input 
                      type="date" 
                      value={filters.endDate} 
                      onChange={e => setFilters(f => ({...f, endDate: e.target.value}))}
                      className="bg-gray-700 border-gray-600 focus:border-rosae-red focus:ring-rosae-red/20 text-white"
                    />
                  </div>
                </>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Campaign</label>
                <Input 
                  placeholder="Search campaigns..." 
                  value={filters.campaignName} 
                  onChange={e => setFilters(f => ({...f, campaignName: e.target.value}))}
                  className="bg-gray-700 border-gray-600 focus:border-rosae-red focus:ring-rosae-red/20 text-white"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Platform</label>
                <Select value={filters.platform} onValueChange={(v) => setFilters(f => ({...f, platform: v}))}>
                  <SelectTrigger className="bg-gray-700 border-gray-600 focus:border-rosae-red text-white">
                    <SelectValue placeholder="All Platforms" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-700 border-gray-600 text-white">
                  <SelectItem value="all" className="text-white hover:bg-gray-600 focus:bg-gray-600">All Platforms</SelectItem>
                  <SelectItem value="Meta Ads" className="text-white hover:bg-gray-600 focus:bg-gray-600">Meta Ads</SelectItem>
                  <SelectItem value="Google Ads" className="text-white hover:bg-gray-600 focus:bg-gray-600">Google Ads</SelectItem>
                  <SelectItem value="LinkedIn Ads" className="text-white hover:bg-gray-600 focus:bg-gray-600">LinkedIn Ads</SelectItem>
                </SelectContent>
              </Select>
            </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          <AnalyticsKpiCard 
            title="Total Spend" 
            value={INR(spend)} 
            subtitle="Advertising investment"
            icon={Target}
            color="text-green-400"
            trend="neutral"
          />
          <AnalyticsKpiCard 
            title="Total Leads" 
            value={`${leads}`} 
            subtitle="All leads generated"
            icon={Activity}
            trend="up"
          />
          <AnalyticsKpiCard 
            title="Good Leads" 
            value={`${good}`} 
            subtitle={`${fmtPct(safeDiv(good, leads))} of total`}
            color="text-green-400"
            trend="up"
          />
          <AnalyticsKpiCard 
            title="CPL" 
            value={isFinite(CPL) ? INR(CPL) : '—'} 
            subtitle="Cost per lead"
            trend={CPL > 100 ? "down" : "up"}
          />
          <AnalyticsKpiCard 
            title="CPQL" 
            value={isFinite(CPQL) ? INR(CPQL) : '—'} 
            subtitle="Cost per qualified lead"
            trend={CPQL > 200 ? "down" : "up"}
          />
          <AnalyticsKpiCard 
            title="Sales" 
            value={`${sales}`} 
            subtitle={`${fmtPct(safeDiv(sales, good))} conversion`}
            color="text-blue-400"
            trend="up"
          />
          <AnalyticsKpiCard 
            title="CPA" 
            value={isFinite(CPA) ? INR(CPA) : '—'} 
            subtitle="Cost per acquisition"
            trend={CPA > 500 ? "down" : "up"}
          />
          <AnalyticsKpiCard 
            title="Revenue" 
            value={INR(revenue)} 
            subtitle="Total revenue generated"
            color="text-green-400"
            trend="up"
          />
          <AnalyticsKpiCard 
            title="ROAS" 
            value={isFinite(ROAS) ? `${fmt(ROAS)}x` : '—'} 
            subtitle="Return on ad spend"
            color="text-yellow-400"
            trend={ROAS > 2 ? "up" : ROAS > 1 ? "neutral" : "down"}
          />
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Pie Chart Good vs Bad */}
          <Card className="bg-gradient-to-br from-gray-800 to-gray-700 border border-gray-600 shadow-xl">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <PieChartIcon className="w-5 h-5 text-rosae-red" />
                <h3 className="text-lg font-semibold">Lead Quality Distribution</h3>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={5}>
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value}`, 'Leads']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Bar Chart Spend vs Leads */}
          <Card className="bg-gradient-to-br from-gray-800 to-gray-700 border border-gray-600 shadow-xl">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-5 h-5 text-rosae-red" />
                <h3 className="text-lg font-semibold">Daily Performance</h3>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="date" stroke="#9CA3AF" />
                    <YAxis stroke="#9CA3AF" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#374151', 
                        border: '1px solid #6B7280',
                        borderRadius: '8px'
                      }}
                    />
                    <Legend />
                    <Bar dataKey="Spend" fill="#ef4444" name="Spend (₹)" />
                    <Bar dataKey="Leads" fill="#22c55e" name="Total Leads" />
                    <Bar dataKey="GoodLeads" fill="#3b82f6" name="Good Leads" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Line Chart CPL/CPQL/CPA over time */}
        <Card className="bg-gradient-to-br from-gray-800 to-gray-700 border border-gray-600 shadow-xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-5 h-5 text-rosae-red" />
              <h3 className="text-lg font-semibold">Cost Metrics Trends</h3>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="date" stroke="#9CA3AF" />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#374151', 
                      border: '1px solid #6B7280',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="CPL" stroke="#60a5fa" strokeWidth={3} dot={{ fill: '#60a5fa', strokeWidth: 2, r: 4 }} name="CPL (₹)" />
                  <Line type="monotone" dataKey="CPQL" stroke="#34d399" strokeWidth={3} dot={{ fill: '#34d399', strokeWidth: 2, r: 4 }} name="CPQL (₹)" />
                  <Line type="monotone" dataKey="CPA" stroke="#f59e0b" strokeWidth={3} dot={{ fill: '#f59e0b', strokeWidth: 2, r: 4 }} name="CPA (₹)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Bar Chart Spend vs Leads vs Good Leads */}
        <Card className="bg-rosae-dark-gray border border-gray-600">
          <CardContent className="p-4">
            <h3 className="text-lg font-semibold mb-2">Spend vs Leads vs Good Leads</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Spend" fill="#ef4444" />
                  <Bar dataKey="Leads" fill="#3b82f6" />
                  <Bar dataKey="GoodLeads" fill="#22c55e" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Funnel Chart (simple stacked bars) */}
        <Card className="bg-rosae-dark-gray border border-gray-600">
          <CardContent className="p-4">
            <h3 className="text-lg font-semibold mb-2">Funnel</h3>
            <div className="grid grid-cols-5 gap-3 text-center">
              {funnelSteps.map(step => (
                <div key={step.name} className="bg-gray-800 rounded p-3">
                  <div className="text-sm text-gray-300">{step.name}</div>
                  <div className="text-xl font-semibold">{step.value}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ title, value }: { title: string; value: string }) {
  return (
    <Card className="bg-rosae-dark-gray border border-gray-600">
      <CardContent className="p-4">
        <div className="text-sm text-gray-300">{title}</div>
        <div className="text-xl font-semibold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}