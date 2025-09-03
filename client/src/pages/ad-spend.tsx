import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Download, Printer, IndianRupee, Filter, Search, TrendingUp, TrendingDown, Minus, Target } from "lucide-react";

// Helpers
const INR = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const safeDiv = (num: number, den: number) => den > 0 ? (num / den) : NaN;
const fmtPct = (v: number) => isFinite(v) ? `${(v*100).toFixed(1)}%` : "—";
const fmt = (v: number) => isFinite(v) ? v.toFixed(2) : "—";

// Professional KPI Card Component
const KpiCard = ({ title, value, subtitle, trend, icon: Icon }: { 
  title: string; 
  value: string; 
  subtitle?: string; 
  trend?: 'up' | 'down' | 'neutral';
  icon?: any;
}) => (
  <Card className="bg-gradient-to-br from-rosae-dark-gray to-gray-800 border border-gray-600 hover:border-rosae-red/50 transition-all duration-300">
    <CardContent className="p-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide">{title}</h3>
        {Icon && <Icon className="w-5 h-5 text-rosae-red" />}
      </div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-2xl font-bold text-white mb-1">{value}</p>
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

export default function AdSpendPage() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { toast } = useToast();

  // Check if user is admin
  if (isAuthenticated && user && user.role !== 'admin') {
    return (
      <div className="flex min-h-screen bg-rosae-black text-white">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-rosae-red mb-4">Access Denied</h1>
            <p className="text-gray-400">Only administrators can access the Ad Spend page.</p>
          </div>
        </div>
      </div>
    );
  }

  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    campaignName: "",
    maxCpl: "",
    platform: "all",
  });

  const { data: rows, isLoading: isDataLoading, error } = useQuery<any[]>({
    queryKey: ["/api/ad-spends", filters],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (filters.startDate) qs.set("startDate", filters.startDate);
      if (filters.endDate) qs.set("endDate", filters.endDate);
      if (filters.campaignName) qs.set("campaignName", filters.campaignName);
      if (filters.platform && filters.platform !== "all") qs.set("platform", filters.platform);
      if (filters.maxCpl) qs.set("maxCpl", filters.maxCpl);
      const res = await apiRequest("GET", `/api/ad-spends?${qs.toString()}`);
      return res.json();
    },
    refetchOnWindowFocus: false,
    staleTime: 30000,
  });

  // Handle errors with useEffect
  useEffect(() => {
    if (error) {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "You are logged out. Logging in again...", variant: "destructive" });
        setTimeout(() => (window.location.href = "/api/login"), 500);
        return;
      }
      toast({ title: "Error", description: (error as any).message || "Failed to load ad spends", variant: "destructive" });
    }
  }, [error, toast]);

  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      try {
        const response = await apiRequest("POST", "/api/ad-spends", payload);
        return response.json();
      } catch (error: any) {
        // Parse error message from the response
        const errorMessage = error.message || "Failed to save ad spend";
        
        // Try to extract more specific error details
        if (errorMessage.includes(":")) {
          const parts = errorMessage.split(":");
          if (parts.length > 1) {
            try {
              const errorData = JSON.parse(parts.slice(1).join(":").trim());
              throw new Error(errorData.details || errorData.message || errorMessage);
            } catch {
              // If parsing fails, use the original message
              throw new Error(errorMessage);
            }
          }
        }
        
        throw new Error(errorMessage);
      }
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Ad spend saved successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/ad-spends"] });
    },
    onError: (error: any) => {
      console.error("Create ad spend error:", error);
      toast({ 
        title: "Error", 
        description: error.message || "Failed to save ad spend", 
        variant: "destructive" 
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, update }: { id: string; update: any }) => {
      try {
        const response = await apiRequest("PATCH", `/api/ad-spends/${id}`, update);
        return response.json();
      } catch (error: any) {
        // Parse error message from the response
        const errorMessage = error.message || "Failed to update ad spend";
        
        // Try to extract more specific error details
        if (errorMessage.includes(":")) {
          const parts = errorMessage.split(":");
          if (parts.length > 1) {
            try {
              const errorData = JSON.parse(parts.slice(1).join(":").trim());
              throw new Error(errorData.details || errorData.message || errorMessage);
            } catch {
              // If parsing fails, use the original message
              throw new Error(errorMessage);
            }
          }
        }
        
        throw new Error(errorMessage);
      }
    },
    onSuccess: () => {
      toast({ title: "Updated", description: "Ad spend updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/ad-spends"] });
    },
    onError: (error: any) => {
      console.error("Update ad spend error:", error);
      toast({ 
        title: "Error", 
        description: error.message || "Failed to update ad spend", 
        variant: "destructive" 
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/ad-spends/${id}`),
    onSuccess: () => {
      toast({ title: "Deleted", description: "Ad spend deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/ad-spends"] });
    },
  });

  // Derived totals for KPI cards
  const { totalSpend, totalLeads, goodLeads, badLeads, sales, revenue } = useMemo(() => {
    const list = Array.isArray(rows) ? rows : [];
    return {
      totalSpend: list.reduce((s, r) => s + Number(r.adSpend || 0), 0),
      totalLeads: list.reduce((s, r) => s + Number(r.totalLeads || 0), 0),
      goodLeads: list.reduce((s, r) => s + Number(r.goodLeads || 0), 0),
      badLeads: list.reduce((s, r) => s + Number(r.badLeads || 0), 0),
      sales: list.reduce((s, r) => s + Number(r.salesCount || 0), 0),
      revenue: list.reduce((s, r) => s + Number(r.revenue || 0), 0),
    };
  }, [rows]);

  const CPL = safeDiv(totalSpend, totalLeads);
  const CPQL = safeDiv(totalSpend, goodLeads);
  const CPA = safeDiv(totalSpend, sales);
  const ROAS = safeDiv(revenue, totalSpend);

  // Form state
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>({
    date: new Date().toISOString().slice(0, 10),
    platform: "Meta Ads",
    campaignName: "",
    adSetName: "",
    adName: "",
    adSpend: "",
    totalLeads: "",
    goodLeads: "",
    badLeads: "",
    salesCount: "",
    revenue: "",
    impressions: "",
    clicks: "",
  });

  const resetForm = () => {
    setForm({
      date: new Date().toISOString().slice(0, 10),
      platform: "Meta Ads",
      campaignName: "",
      adSetName: "",
      adName: "",
      adSpend: "",
      totalLeads: "",
      goodLeads: "",
      badLeads: "",
      salesCount: "",
      revenue: "",
      impressions: "",
      clicks: "",
    });
    setEditingId(null);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!form.date || !form.campaignName || !form.platform) {
      toast({ 
        title: "Validation Error", 
        description: "Please fill in all required fields (Date, Campaign Name, Platform)", 
        variant: "destructive" 
      });
      return;
    }

    // Validate numeric fields
    const adSpend = Number(form.adSpend || 0);
    const totalLeads = Number(form.totalLeads || 0);
    const goodLeads = Number(form.goodLeads || 0);
    const badLeads = Number(form.badLeads || 0);

    if (isNaN(adSpend) || adSpend < 0) {
      toast({ 
        title: "Validation Error", 
        description: "Ad Spend must be a valid positive number", 
        variant: "destructive" 
      });
      return;
    }

    if (isNaN(totalLeads) || totalLeads < 0) {
      toast({ 
        title: "Validation Error", 
        description: "Total Leads must be a valid positive number", 
        variant: "destructive" 
      });
      return;
    }

    if (isNaN(goodLeads) || goodLeads < 0) {
      toast({ 
        title: "Validation Error", 
        description: "Good Leads must be a valid positive number", 
        variant: "destructive" 
      });
      return;
    }

    if (isNaN(badLeads) || badLeads < 0) {
      toast({ 
        title: "Validation Error", 
        description: "Bad Leads must be a valid positive number", 
        variant: "destructive" 
      });
      return;
    }

    // Validate that good + bad leads don't exceed total leads
    if (goodLeads + badLeads > totalLeads) {
      toast({ 
        title: "Validation Error", 
        description: "Good Leads + Bad Leads cannot exceed Total Leads", 
        variant: "destructive" 
      });
      return;
    }

    const payload: any = {
      date: form.date,
      platform: form.platform,
      campaignName: form.campaignName.trim(),
      adSpend,
      totalLeads,
      goodLeads,
      badLeads,
    };

    // Add optional string fields only if they have values
    if (form.adSetName?.trim()) {
      payload.adSetName = form.adSetName.trim();
    }
    if (form.adName?.trim()) {
      payload.adName = form.adName.trim();
    }

    // Add optional numeric fields only if they have values
    if (form.salesCount && form.salesCount !== "") {
      payload.salesCount = Number(form.salesCount);
    }
    if (form.revenue && form.revenue !== "") {
      payload.revenue = Number(form.revenue);
    }
    if (form.impressions && form.impressions !== "") {
      payload.impressions = Number(form.impressions);
    }
    if (form.clicks && form.clicks !== "") {
      payload.clicks = Number(form.clicks);
    }

    // Debug logging
    console.log("Submitting payload:", payload);

    // Additional validation for optional numeric fields
    if (payload.salesCount !== undefined && (isNaN(payload.salesCount) || payload.salesCount < 0)) {
      toast({ 
        title: "Validation Error", 
        description: "Sales Count must be a valid positive number", 
        variant: "destructive" 
      });
      return;
    }

    if (payload.revenue !== undefined && (isNaN(payload.revenue) || payload.revenue < 0)) {
      toast({ 
        title: "Validation Error", 
        description: "Revenue must be a valid positive number", 
        variant: "destructive" 
      });
      return;
    }

    if (payload.impressions !== undefined && (isNaN(payload.impressions) || payload.impressions < 0)) {
      toast({ 
        title: "Validation Error", 
        description: "Impressions must be a valid positive number", 
        variant: "destructive" 
      });
      return;
    }

    if (payload.clicks !== undefined && (isNaN(payload.clicks) || payload.clicks < 0)) {
      toast({ 
        title: "Validation Error", 
        description: "Clicks must be a valid positive number", 
        variant: "destructive" 
      });
      return;
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, update: payload });
    } else {
      createMutation.mutate(payload);
    }
    setFormOpen(false);
    resetForm();
  };

  const handleEdit = (row: any) => {
    setEditingId(row.id);
    setFormOpen(true);
    setForm({
      date: row.date,
      platform: row.platform || "Meta Ads",
      campaignName: row.campaignName || "",
      adSetName: row.adSetName || "",
      adName: row.adName || "",
      adSpend: String(row.adSpend ?? ""),
      totalLeads: String(row.totalLeads ?? ""),
      goodLeads: String(row.goodLeads ?? ""),
      badLeads: String(row.badLeads ?? ""),
      salesCount: String(row.salesCount ?? ""),
      revenue: String(row.revenue ?? ""),
      impressions: String(row.impressions ?? ""),
      clicks: String(row.clicks ?? ""),
    });
  };

  const handleExport = async (format: "csv" | "xlsx" | "pdf") => {
    // Client-side export for now. Could be moved server-side if needed.
    const list = Array.isArray(rows) ? rows : [];

    if (format === "csv" || format === "xlsx") {
      const headers = [
        "Date","Platform","Campaign Name","Ad Set Name","Ad Name","Ad Spend","Total Leads","Good Leads","Bad Leads","Sales Count","Revenue","CPL","Good %","Bad %","CPQL","Conv %","CPA","ROAS"
      ];
      const csv = [headers.join(",")].concat(
        list.map(r => {
          const cpl = safeDiv(r.adSpend, r.totalLeads);
          const goodPct = safeDiv(r.goodLeads, r.totalLeads);
          const badPct = safeDiv(r.badLeads, r.totalLeads);
          const cpql = safeDiv(r.adSpend, r.goodLeads);
          const conv = safeDiv(r.salesCount || 0, r.goodLeads);
          const cpa = safeDiv(r.adSpend, r.salesCount || 0);
          const roas = safeDiv(r.revenue || 0, r.adSpend);
          return [
            r.date, r.platform || "Meta Ads", r.campaignName || "", r.adSetName || "", r.adName || "",
            r.adSpend, r.totalLeads, r.goodLeads, r.badLeads, r.salesCount ?? "", r.revenue ?? "",
            isFinite(cpl) ? cpl.toFixed(2) : "—",
            isFinite(goodPct) ? (goodPct*100).toFixed(1) : "—",
            isFinite(badPct) ? (badPct*100).toFixed(1) : "—",
            isFinite(cpql) ? cpql.toFixed(2) : "—",
            isFinite(conv) ? (conv*100).toFixed(1) : "—",
            isFinite(cpa) ? cpa.toFixed(2) : "—",
            isFinite(roas) ? roas.toFixed(2) : "—",
          ].join(",");
        })
      ).join("\n");

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ad_spends.${format === "xlsx" ? "csv" : "csv"}`; // CSV compatible with Excel
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Exported", description: "Export completed" });
      return;
    }

    if (format === "pdf") {
      window.print();
      return;
    }
  };

  const handlePrint = () => {
    const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const logo = "ROSAE"; // Inline placeholder
    const list = Array.isArray(rows) ? rows : [];

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Ad Spend Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #e11d48; text-align: center; margin-bottom: 10px; }
            .meta { text-align: center; margin-bottom: 20px; color: #555; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 8px; border-bottom: 1px solid #ddd; font-size: 12px; }
            th { background: #f4f4f4; text-align: left; }
          </style>
        </head>
        <body>
          <h1>${logo} - Ad Spend Report</h1>
          <div class="meta">
            Date Range: ${filters.startDate || 'Any'} to ${filters.endDate || 'Any'} | Campaign: ${filters.campaignName || 'All'} | Platform: ${filters.platform === 'all' || !filters.platform ? 'All' : filters.platform} | Printed at: ${now}
          </div>
          <table>
            <thead>
              <tr>
                <th>Date</th><th>Platform</th><th>Campaign</th><th>Ad Set</th><th>Ad</th><th>Spend</th><th>Leads</th><th>Good</th><th>Bad</th><th>Sales</th><th>Revenue</th><th>CPL</th><th>CPQL</th><th>CPA</th><th>ROAS</th>
              </tr>
            </thead>
            <tbody>
              ${list.map(r => {
                const cpl = safeDiv(r.adSpend, r.totalLeads);
                const cpql = safeDiv(r.adSpend, r.goodLeads);
                const cpa = safeDiv(r.adSpend, r.salesCount || 0);
                const roas = safeDiv(r.revenue || 0, r.adSpend);
                return `<tr>
                  <td>${r.date}</td><td>${r.platform || ''}</td><td>${r.campaignName || ''}</td><td>${r.adSetName || ''}</td><td>${r.adName || ''}</td>
                  <td>${INR(r.adSpend)}</td><td>${r.totalLeads}</td><td>${r.goodLeads}</td><td>${r.badLeads}</td><td>${r.salesCount ?? ''}</td><td>${r.revenue ?? ''}</td>
                  <td>${isFinite(cpl) ? cpl.toFixed(2) : '—'}</td><td>${isFinite(cpql) ? cpql.toFixed(2) : '—'}</td><td>${isFinite(cpa) ? cpa.toFixed(2) : '—'}</td><td>${isFinite(roas) ? roas.toFixed(2) : '—'}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.onafterprint = () => printWindow.close();
  };

  if (isLoading) {
    return <div className="min-h-screen bg-rosae-black text-white flex items-center justify-center">Loading...</div>;
  }
  if (!isAuthenticated) {
    window.location.href = "/api/login";
    return null;
  }

  const list = Array.isArray(rows) ? rows : [];

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-rosae-black via-gray-900 to-rosae-black text-white">
      <Sidebar />
      <div className="flex-1 p-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
              Ad Spend Management
            </h1>
            <p className="text-gray-400 mt-1">Track and analyze your advertising investments</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button 
              className="bg-gradient-to-r from-rosae-red to-red-600 hover:from-rosae-dark-red hover:to-red-700 shadow-lg hover:shadow-rosae-red/25 transition-all duration-300" 
              onClick={() => setFormOpen(true)}
            >
              <Plus className="w-4 h-4 mr-2" /> New Entry
            </Button>
            <Button 
              variant="secondary" 
              className="bg-gray-700 hover:bg-gray-600 border-gray-600 hover:border-gray-500 transition-all duration-300"
              onClick={() => handleExport("csv")}
            >
              <Download className="w-4 h-4 mr-2"/> Export
            </Button>
            <Button 
              variant="outline" 
              className="border-gray-600 hover:border-rosae-red hover:bg-rosae-red/10 transition-all duration-300"
              onClick={handlePrint}
            >
              <Printer className="w-4 h-4 mr-2"/> Print
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <KpiCard 
            title="Total Spend" 
            value={INR(totalSpend)} 
            subtitle="Total advertising investment"
            icon={IndianRupee}
            trend="neutral"
          />
          <KpiCard 
            title="Total Leads" 
            value={`${totalLeads}`} 
            subtitle="All leads generated"
            trend="up"
          />
          <KpiCard 
            title="Good Leads" 
            value={`${goodLeads}`} 
            subtitle={`${fmtPct(safeDiv(goodLeads, totalLeads))} of total`}
            trend="up"
          />
          <KpiCard 
            title="CPL" 
            value={isFinite(CPL) ? INR(CPL) : "—"} 
            subtitle="Cost per lead"
            trend={CPL > 100 ? "down" : "up"}
          />
          <KpiCard 
            title="CPQL" 
            value={isFinite(CPQL) ? INR(CPQL) : "—"} 
            subtitle="Cost per qualified lead"
            trend={CPQL > 200 ? "down" : "up"}
          />
          <KpiCard 
            title="Sales" 
            value={`${sales}`} 
            subtitle={`${fmtPct(safeDiv(sales, goodLeads))} conversion`}
            trend="up"
          />
          <KpiCard 
            title="CPA" 
            value={isFinite(CPA) ? INR(CPA) : "—"} 
            subtitle="Cost per acquisition"
            trend={CPA > 500 ? "down" : "up"}
          />
          <KpiCard 
            title="ROAS" 
            value={isFinite(ROAS) ? `${fmt(ROAS)}x` : "—"} 
            subtitle="Return on ad spend"
            trend={ROAS > 2 ? "up" : ROAS > 1 ? "neutral" : "down"}
          />
        </div>

        {/* Filters */}
        <Card className="bg-gradient-to-r from-gray-800 to-gray-700 border border-gray-600 shadow-xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="w-5 h-5 text-rosae-red" />
              <h3 className="text-lg font-semibold">Filters & Search</h3>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-300">Date From</Label>
                <Input 
                  type="date" 
                  value={filters.startDate} 
                  onChange={e => setFilters(f => ({...f, startDate: e.target.value}))}
                  className="bg-gray-700 border-gray-600 focus:border-rosae-red focus:ring-rosae-red/20 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-300">Date To</Label>
                <Input 
                  type="date" 
                  value={filters.endDate} 
                  onChange={e => setFilters(f => ({...f, endDate: e.target.value}))}
                  className="bg-gray-700 border-gray-600 focus:border-rosae-red focus:ring-rosae-red/20 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-300">Campaign</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input 
                    placeholder="Search campaigns..." 
                    value={filters.campaignName} 
                    onChange={e => setFilters(f => ({...f, campaignName: e.target.value}))}
                    className="pl-10 bg-gray-700 border-gray-600 focus:border-rosae-red focus:ring-rosae-red/20 text-white"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-300">Platform</Label>
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
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-300">Max CPL (₹)</Label>
                <Input 
                  type="number" 
                  step="0.01" 
                  placeholder="e.g., 150" 
                  value={filters.maxCpl} 
                  onChange={e => setFilters(f => ({...f, maxCpl: e.target.value}))}
                  className="bg-gray-700 border-gray-600 focus:border-rosae-red focus:ring-rosae-red/20 text-white"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="bg-gray-800 border border-gray-600 shadow-xl">
          <CardContent className="p-0">
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-gradient-to-r from-gray-700 to-gray-600">
                  <tr>
                    {['Date','Platform','Campaign','Ad Set','Ad','Spend','Leads','Good','Bad','CPL','Good %','Bad %','CPQL','Sales','Conv %','CPA','Revenue','ROAS','Actions'].map(h => (
                      <th key={h} className="text-left p-4 font-semibold text-gray-200 border-b border-gray-600">{h}</th>
                    ))}
                  </tr>
                </thead>
            <tbody>
              {list.map((r) => {
                const cpl = safeDiv(r.adSpend, r.totalLeads);
                const goodPct = safeDiv(r.goodLeads, r.totalLeads);
                const badPct = safeDiv(r.badLeads, r.totalLeads);
                const cpql = safeDiv(r.adSpend, r.goodLeads);
                const conv = safeDiv(r.salesCount || 0, r.goodLeads);
                const cpa = safeDiv(r.adSpend, r.salesCount || 0);
                const roas = safeDiv(r.revenue || 0, r.adSpend);
                return (
                  <tr key={r.id} className="border-b border-gray-700 hover:bg-gray-700/50 transition-colors duration-200">
                    <td className="p-4 whitespace-nowrap font-medium">{r.date}</td>
                    <td className="p-4 whitespace-nowrap">
                      <span className="px-2 py-1 bg-blue-600/20 text-blue-300 rounded-full text-xs">
                        {r.platform || 'Meta Ads'}
                      </span>
                    </td>
                    <td className="p-4 font-medium text-gray-200">{r.campaignName}</td>
                    <td className="p-4 text-gray-300">{r.adSetName || '—'}</td>
                    <td className="p-4 text-gray-300">{r.adName || '—'}</td>
                    <td className="p-4 font-semibold text-green-400">{INR(r.adSpend)}</td>
                    <td className="p-4 text-center">{r.totalLeads}</td>
                    <td className="p-4 text-center text-green-400">{r.goodLeads}</td>
                    <td className="p-4 text-center text-red-400">{r.badLeads}</td>
                    <td className="p-4 font-medium">{isFinite(cpl) ? INR(cpl) : '—'}</td>
                    <td className="p-4 text-green-400">{fmtPct(goodPct)}</td>
                    <td className="p-4 text-red-400">{fmtPct(badPct)}</td>
                    <td className="p-4 font-medium">{isFinite(cpql) ? INR(cpql) : '—'}</td>
                    <td className="p-4 text-center">{r.salesCount ?? '—'}</td>
                    <td className="p-4 text-blue-400">{fmtPct(conv)}</td>
                    <td className="p-4 font-medium">{isFinite(cpa) ? INR(cpa) : '—'}</td>
                    <td className="p-4 font-semibold text-green-400">{r.revenue ? INR(r.revenue) : '—'}</td>
                    <td className="p-4 font-bold text-yellow-400">{isFinite(roas) ? `${fmt(roas)}x` : '—'}</td>
                    <td className="p-4 whitespace-nowrap space-x-2">
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        onClick={() => handleEdit(r)}
                        className="bg-blue-600 hover:bg-blue-700 text-white border-0"
                      >
                        Edit
                      </Button>
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        onClick={() => deleteMutation.mutate(r.id)}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {list.length === 0 && (
                <tr>
                  <td className="p-12 text-center text-gray-400" colSpan={19}>
                    <div className="flex flex-col items-center gap-3">
                      <Target className="w-12 h-12 text-gray-500" />
                      <p className="text-lg font-medium">No ad spend records found</p>
                      <p className="text-sm text-gray-500">Start by adding your first ad spend entry</p>
                      <Button 
                        className="mt-2 bg-rosae-red hover:bg-rosae-dark-red" 
                        onClick={() => setFormOpen(true)}
                      >
                        <Plus className="w-4 h-4 mr-2" /> Add First Entry
                      </Button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Modal */}
        <Dialog open={formOpen} onOpenChange={setFormOpen}>
          <DialogContent className="bg-gradient-to-br from-gray-800 to-gray-700 text-white border border-gray-600 max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader className="pb-4 border-b border-gray-600">
              <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                {editingId ? 'Edit Ad Spend Entry' : 'New Ad Spend Entry'}
              </DialogTitle>
              <p className="text-gray-400 text-sm">
                {editingId ? 'Update your advertising spend data' : 'Add new advertising spend data with automatic metric calculations'}
              </p>
            </DialogHeader>
            <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-300">Date *</Label>
                <Input 
                  type="date" 
                  value={form.date} 
                  onChange={e => setForm({ ...form, date: e.target.value })} 
                  required 
                  className="bg-gray-700 border-gray-600 focus:border-rosae-red focus:ring-rosae-red/20 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-300">Platform *</Label>
                <Select value={form.platform} onValueChange={(v) => setForm({ ...form, platform: v })}>
                  <SelectTrigger className="bg-gray-700 border-gray-600 focus:border-rosae-red text-white">
                    <SelectValue placeholder="Select Platform" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-700 border-gray-600 text-white">
                    <SelectItem value="Meta Ads" className="text-white hover:bg-gray-600 focus:bg-gray-600">Meta Ads</SelectItem>
                    <SelectItem value="Google Ads" className="text-white hover:bg-gray-600 focus:bg-gray-600">Google Ads</SelectItem>
                    <SelectItem value="LinkedIn Ads" className="text-white hover:bg-gray-600 focus:bg-gray-600">LinkedIn Ads</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label className="text-sm font-medium text-gray-300">Campaign Name *</Label>
                <Input 
                  value={form.campaignName} 
                  onChange={e => setForm({ ...form, campaignName: e.target.value })} 
                  required 
                  placeholder="Enter campaign name"
                  className="bg-gray-700 border-gray-600 focus:border-rosae-red focus:ring-rosae-red/20 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-300">Ad Set Name</Label>
                <Input 
                  value={form.adSetName} 
                  onChange={e => setForm({ ...form, adSetName: e.target.value })} 
                  placeholder="Enter ad set name"
                  className="bg-gray-700 border-gray-600 focus:border-rosae-red focus:ring-rosae-red/20 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-300">Ad Name</Label>
                <Input 
                  value={form.adName} 
                  onChange={e => setForm({ ...form, adName: e.target.value })} 
                  placeholder="Enter ad name"
                  className="bg-gray-700 border-gray-600 focus:border-rosae-red focus:ring-rosae-red/20 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-300">Ad Spend (₹) *</Label>
                <Input 
                  type="number" 
                  step="0.01" 
                  value={form.adSpend} 
                  onChange={e => setForm({ ...form, adSpend: e.target.value })} 
                  required 
                  placeholder="0.00"
                  className="bg-gray-700 border-gray-600 focus:border-rosae-red focus:ring-rosae-red/20 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-300">Total Leads *</Label>
                <Input 
                  type="number" 
                  value={form.totalLeads} 
                  onChange={e => setForm({ ...form, totalLeads: e.target.value })} 
                  required 
                  placeholder="0"
                  className="bg-gray-700 border-gray-600 focus:border-rosae-red focus:ring-rosae-red/20 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-300">Good Leads *</Label>
                <Input 
                  type="number" 
                  value={form.goodLeads} 
                  onChange={e => setForm({ ...form, goodLeads: e.target.value })} 
                  required 
                  placeholder="0"
                  className="bg-gray-700 border-gray-600 focus:border-rosae-red focus:ring-rosae-red/20 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-300">Bad Leads *</Label>
                <Input 
                  type="number" 
                  value={form.badLeads} 
                  onChange={e => setForm({ ...form, badLeads: e.target.value })} 
                  required 
                  placeholder="0"
                  className="bg-gray-700 border-gray-600 focus:border-rosae-red focus:ring-rosae-red/20 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-300">Sales Count</Label>
                <Input 
                  type="number" 
                  value={form.salesCount} 
                  onChange={e => setForm({ ...form, salesCount: e.target.value })} 
                  placeholder="0"
                  className="bg-gray-700 border-gray-600 focus:border-rosae-red focus:ring-rosae-red/20 text-white"
                />
                <p className="text-xs text-gray-500">Optional - for CPA and conversion rate calculations</p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-300">Revenue (₹)</Label>
                <Input 
                  type="number" 
                  step="0.01" 
                  value={form.revenue} 
                  onChange={e => setForm({ ...form, revenue: e.target.value })} 
                  placeholder="0.00"
                  className="bg-gray-700 border-gray-600 focus:border-rosae-red focus:ring-rosae-red/20 text-white"
                />
                <p className="text-xs text-gray-500">Optional - for ROAS calculations</p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-300">Impressions</Label>
                <Input 
                  type="number" 
                  value={form.impressions} 
                  onChange={e => setForm({ ...form, impressions: e.target.value })} 
                  placeholder="0"
                  className="bg-gray-700 border-gray-600 focus:border-rosae-red focus:ring-rosae-red/20 text-white"
                />
                <p className="text-xs text-gray-500">Optional - for CTR calculations</p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-300">Clicks</Label>
                <Input 
                  type="number" 
                  value={form.clicks} 
                  onChange={e => setForm({ ...form, clicks: e.target.value })} 
                  placeholder="0"
                  className="bg-gray-700 border-gray-600 focus:border-rosae-red focus:ring-rosae-red/20 text-white"
                />
                <p className="text-xs text-gray-500">Optional - for CTR and CPC calculations</p>
              </div>

              {/* Live metrics preview */}
              <div className="md:col-span-2 bg-gradient-to-r from-gray-700 to-gray-600 p-6 rounded-lg border border-gray-500">
                <h4 className="text-lg font-semibold mb-4 text-rosae-red">Live Metrics Preview</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <p className="text-xs text-gray-400 uppercase tracking-wide">CPL</p>
                    <p className="text-lg font-bold text-white">{isFinite(safeDiv(Number(form.adSpend||0), Number(form.totalLeads||0))) ? INR(safeDiv(Number(form.adSpend||0), Number(form.totalLeads||0))) : "—"}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-400 uppercase tracking-wide">Good %</p>
                    <p className="text-lg font-bold text-green-400">{fmtPct(safeDiv(Number(form.goodLeads||0), Number(form.totalLeads||0)))}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-400 uppercase tracking-wide">CPQL</p>
                    <p className="text-lg font-bold text-white">{isFinite(safeDiv(Number(form.adSpend||0), Number(form.goodLeads||0))) ? INR(safeDiv(Number(form.adSpend||0), Number(form.goodLeads||0))) : "—"}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-400 uppercase tracking-wide">ROAS</p>
                    <p className="text-lg font-bold text-yellow-400">{isFinite(safeDiv(Number(form.revenue||0), Number(form.adSpend||0))) ? `${fmt(safeDiv(Number(form.revenue||0), Number(form.adSpend||0)))}x` : "—"}</p>
                  </div>
                </div>
              </div>

              <div className="md:col-span-2 flex justify-end gap-3 pt-4 border-t border-gray-600">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => { setFormOpen(false); resetForm(); }}
                  className="border-gray-600 hover:border-gray-500 hover:bg-gray-700"
                >
                  Cancel
                </Button>
                <Button 
                  className="bg-gradient-to-r from-rosae-red to-red-600 hover:from-rosae-dark-red hover:to-red-700 shadow-lg" 
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {createMutation.isPending || updateMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      {editingId ? 'Updating...' : 'Saving...'}
                    </>
                  ) : (
                    editingId ? 'Update Entry' : 'Save Entry'
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-gray-400">{label}</div>
      <div className="font-medium">{value || '—'}</div>
    </div>
  );
}