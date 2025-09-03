import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Edit, 
  Trash2, 
  Copy, 
  Filter, 
  Printer, 
  Download, 
  IndianRupee,
  Calendar,
  TrendingUp,
  Banknote,
  CreditCard,
  Wallet,
  FileSpreadsheet,
  FileText,
  Eye,
  EyeOff
} from "lucide-react";
import { insertDailyIncomeSchema } from "@shared/schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

// Currency formatting helpers
const INR_FULL = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const INR_COMPACT = (n: number) => {
  const val = Number(n || 0);
  if (val >= 1_00_00_000) return `₹${(val / 1_00_00_000).toFixed(2)}Cr`; // Crores
  if (val >= 1_00_000) return `₹${(val / 1_00_000).toFixed(2)}L`; // Lakhs
  return `₹${val.toLocaleString('en-IN')}`;
};
const INR = (n: number, compact: boolean) => compact ? INR_COMPACT(n) : INR_FULL(n);
const safeDiv = (num: number, den: number) => den > 0 ? (num / den) : 0;
const fmt = (v: number) => isFinite(v) && v > 0 ? v.toFixed(2) : "—";

// Professional KPI Card Component
const KpiCard = ({ title, value, subtitle, icon: Icon, color = "text-white" }: { 
  title: string; 
  value: string; 
  subtitle?: string; 
  icon?: any;
  color?: string;
}) => (
  <Card className="kpi-card group">
    <CardContent className="p-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide group-hover:text-gray-300 transition-colors">{title}</h3>
        {Icon && <Icon className="w-6 h-6 text-rosae-red group-hover:scale-110 transition-transform duration-300" />}
      </div>
      <div className="flex items-end justify-between min-w-0">
        <div className="min-w-0">
          <p
            title={value}
            className={`text-2xl md:text-3xl font-bold mb-1 ${color} group-hover:scale-105 transition-transform duration-300 tabular-nums truncate leading-tight`}
          >
            {value}
          </p>
          {subtitle && <p className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors">{subtitle}</p>}
        </div>
      </div>
    </CardContent>
  </Card>
);

export default function DailyIncomePage() {
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingRecord, setDeletingRecord] = useState<any>(null);
  
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    paymentType: 'all'
  });

  // UX: compact currency toggle (default ON)
  const [compactCurrency, setCompactCurrency] = useState(true);

  const form = useForm({
    resolver: zodResolver(insertDailyIncomeSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      numberOfShows: 1,
      cashReceived: 0,
      upiReceived: 0,
      otherPayments: 0,
      notes: '',
    },
  });

  // Fetch daily income records
  const { data: records = [] } = useQuery<any[]>({
    queryKey: ["/api/daily-income", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.startDate) params.set('startDate', filters.startDate);
      if (filters.endDate) params.set('endDate', filters.endDate);
      if (filters.paymentType !== 'all') params.set('paymentType', filters.paymentType);
      
      const res = await apiRequest('GET', `/api/daily-income?${params.toString()}`);
      return res.json();
    }
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/daily-income", data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Daily income record created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/daily-income"] });
      form.reset();
      setIsModalOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create record",
        variant: "destructive",
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      await apiRequest("PUT", `/api/daily-income/${id}`, data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Daily income record updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/daily-income"] });
      form.reset();
      setEditingRecord(null);
      setIsModalOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update record",
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/daily-income/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Daily income record deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/daily-income"] });
      setIsDeleteModalOpen(false);
      setDeletingRecord(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete record",
        variant: "destructive",
      });
    },
  });

  // Calculate KPIs (include net after refunds if provided by server)
  const kpis = useMemo(() => {
    const totalShows = records.reduce((sum, r) => sum + Number((r.adjustedShows ?? r.numberOfShows) || 0), 0);
    const totalCash = records.reduce((sum, r) => sum + Number((r.adjustedCashReceived ?? r.cashReceived) || 0), 0);
    const totalUpi = records.reduce((sum, r) => sum + Number((r.adjustedUpiReceived ?? r.upiReceived) || 0), 0);
    const totalOther = records.reduce((sum, r) => sum + Number(r.otherPayments || 0), 0);

    // Gross and net totals (prefer adjustedRevenue if provided)
    const grossTotal = totalCash + totalUpi + totalOther;
    const totalRefunds = records.reduce((sum, r) => sum + Number(r.refundTotal || 0), 0);
    const adjustedSum = records.reduce((sum, r) => sum + Number(r.adjustedRevenue ?? 0), 0);
    const netTotal = Math.max(0, adjustedSum || (grossTotal - totalRefunds));

    const avgPerShow = safeDiv(netTotal, totalShows);

    return {
      totalShows,
      totalCash,
      totalUpi,
      totalOther,
      grossTotal,
      totalRefunds,
      netTotal,
      avgPerShow
    } as any;
  }, [records]);

  // Enhanced records with calculations
  const enhancedRecords = useMemo(() => {
    return records.map(record => {
      const cash = Number((record.adjustedCashReceived ?? record.cashReceived) || 0);
      const upi = Number((record.adjustedUpiReceived ?? record.upiReceived) || 0);
      const other = Number(record.otherPayments || 0);
      const grossIncome = cash + upi + other;
      const refund = Number(record.refundTotal || 0);
      const netIncome = Number(record.adjustedRevenue ?? Math.max(0, grossIncome - refund));
      const shows = Number((record.adjustedShows ?? record.numberOfShows ?? 0));
      const avgPerShow = safeDiv(netIncome, shows);
      
      return {
        ...record,
        totalIncome: grossIncome,
        netIncome,
        avgPerShow
      };
    });
  }, [records]);

  // Pagination (client-side)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const totalPages = Math.max(1, Math.ceil((enhancedRecords?.length || 0) / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedRecords = enhancedRecords.slice(startIndex, endIndex);

  const handleSubmit = (data: any) => {
    if (editingRecord) {
      updateMutation.mutate({ id: editingRecord.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (record: any) => {
    setEditingRecord(record);
    form.reset({
      date: record.date,
      numberOfShows: record.numberOfShows,
      cashReceived: record.cashReceived,
      upiReceived: record.upiReceived,
      otherPayments: record.otherPayments,
      notes: record.notes || '',
    });
    setIsModalOpen(true);
  };

  const handleDuplicate = (record: any) => {
    form.reset({
      date: new Date().toISOString().split('T')[0], // Today's date
      numberOfShows: record.numberOfShows,
      cashReceived: record.cashReceived,
      upiReceived: record.upiReceived,
      otherPayments: record.otherPayments,
      notes: record.notes || '',
    });
    setEditingRecord(null);
    setIsModalOpen(true);
  };

  const handleDelete = (record: any) => {
    setDeletingRecord(record);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    if (deletingRecord) {
      deleteMutation.mutate(deletingRecord.id);
    }
  };

  const handlePrint = () => {
    const printContent = document.createElement('div');
    printContent.innerHTML = `
      <div class="print-header">
        <h1 style="font-size: 24px; font-weight: bold; margin-bottom: 8px;">ROSAE Theatre Management</h1>
        <h2 style="font-size: 18px; margin-bottom: 16px;">Daily Income Report</h2>
        <p style="margin-bottom: 4px;">Generated on: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
        <p>Period: ${filters.startDate || 'All time'} ${filters.endDate ? `to ${filters.endDate}` : ''}</p>
      </div>
      
      <div class="print-kpi-grid">
        <div class="print-kpi-card">
          <h3>Total Shows</h3>
          <p style="font-size: 18px; font-weight: bold;">${kpis.totalShows}</p>
        </div>
        <div class="print-kpi-card">
          <h3>Total Cash</h3>
          <p style="font-size: 18px; font-weight: bold;">${INR(kpis.totalCash)}</p>
        </div>
        <div class="print-kpi-card">
          <h3>Total UPI</h3>
          <p style="font-size: 18px; font-weight: bold;">${INR(kpis.totalUpi)}</p>
        </div>
        <div class="print-kpi-card">
          <h3>Total Other</h3>
          <p style="font-size: 18px; font-weight: bold;">${INR(kpis.totalOther)}</p>
        </div>
        <div class="print-kpi-card">
          <h3>Grand Total</h3>
          <p style="font-size: 18px; font-weight: bold;">${INR(kpis.grandTotal)}</p>
        </div>
        <div class="print-kpi-card">
          <h3>Avg/Show</h3>
          <p style="font-size: 18px; font-weight: bold;">${INR(kpis.avgPerShow)}</p>
        </div>
      </div>
      
      <table class="print-table" style="width: 100%; margin-top: 20px;">
        <thead>
          <tr>
            <th>Date</th>
            <th>Shows</th>
            <th>Cash</th>
            <th>UPI</th>
            <th>Other</th>
            <th>Total</th>
            <th>Avg/Show</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          ${enhancedRecords.map(record => `
            <tr>
              <td>${formatDate(record.date)}</td>
              <td>${record.numberOfShows}</td>
              <td>${INR(record.cashReceived)}</td>
              <td>${INR(record.upiReceived)}</td>
              <td>${INR(record.otherPayments)}</td>
              <td>${INR(record.totalIncome)}</td>
              <td>${fmt(record.avgPerShow) !== "—" ? INR(record.avgPerShow) : "—"}</td>
              <td>${record.notes || "—"}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr style="font-weight: bold; background-color: #f5f5f5;">
            <td>TOTALS</td>
            <td>${kpis.totalShows}</td>
            <td>${INR(kpis.totalCash)}</td>
            <td>${INR(kpis.totalUpi)}</td>
            <td>${INR(kpis.totalOther)}</td>
            <td>${INR(kpis.grandTotal)}</td>
            <td>${INR(kpis.avgPerShow)}</td>
            <td>—</td>
          </tr>
        </tfoot>
      </table>
    `;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Daily Income Report</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              .print-header { margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #333; }
              .print-kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 30px; }
              .print-kpi-card { border: 1px solid #333; padding: 15px; text-align: center; border-radius: 5px; }
              .print-table { border-collapse: collapse; width: 100%; }
              .print-table th, .print-table td { border: 1px solid #333; padding: 8px; text-align: left; }
              .print-table th { background-color: #f0f0f0; font-weight: bold; }
              @media print { body { margin: 0; } }
            </style>
          </head>
          <body>
            ${printContent.innerHTML}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleExportCSV = () => {
    const headers = ['Date', 'Shows', 'Cash', 'UPI', 'Other', 'Total Income', 'Avg/Show', 'Notes'];
    // Export all filtered records (not just current page)
    const rows = enhancedRecords; 
    const csvData = [
      headers,
      ...rows.map(record => [
        formatDate(record.date),
        record.numberOfShows,
        record.cashReceived,
        record.upiReceived,
        record.otherPayments,
        record.totalIncome,
        fmt(record.avgPerShow) !== "—" ? record.avgPerShow : 0,
        record.notes || ''
      ]),
      ['TOTALS', kpis.totalShows, kpis.totalCash, kpis.totalUpi, kpis.totalOther, kpis.grandTotal, kpis.avgPerShow, '']
    ];
    
    const csvContent = csvData.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    const monthPart = (filters.startDate && filters.endDate && filters.startDate.slice(0,7) === filters.endDate.slice(0,7))
      ? filters.startDate.slice(0,7)
      : new Date().toISOString().split('T')[0].slice(0,7);
    link.setAttribute('download', `daily-income-${monthPart}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
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
              Daily Income Management
            </h1>
            <p className="text-gray-400 mt-1">Track and manage daily theatre income</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button 
              onClick={() => {
                setEditingRecord(null);
                form.reset();
                setIsModalOpen(true);
              }}
              className="btn-rosae-primary"
            >
              <Plus className="w-4 h-4 mr-2"/> Add Record
            </Button>
            <Button 
              variant="outline" 
              className="btn-rosae-outline"
              onClick={handlePrint}
            >
              <Printer className="w-4 h-4 mr-2"/> Print
            </Button>
            <Button 
              variant="outline" 
              className="border-gray-600 hover:border-green-500 hover:bg-green-500/10 hover:text-green-400 transition-all duration-300"
              onClick={handleExportCSV}
            >
              <FileSpreadsheet className="w-4 h-4 mr-2"/> Export CSV
            </Button>
            <div className="flex items-center gap-2 border border-gray-600 rounded px-3 py-2 text-sm">
              <EyeOff className="w-4 h-4 text-gray-400" />
              <span className="text-gray-300">Compact numbers</span>
              <input
                type="checkbox"
                className="accent-rosae-red"
                checked={compactCurrency}
                onChange={(e) => setCompactCurrency(e.target.checked)}
                title="Toggle compact INR format"
              />
            </div>
            <Button
              variant="outline"
              className="border-gray-600 hover:border-gray-500 hover:bg-gray-700/50"
              onClick={() => setFilters({ startDate: '', endDate: '', paymentType: 'all' })}
              title="Clear filters"
            >
              <Filter className="w-4 h-4 mr-2" /> Clear
            </Button>
            <Button 
              variant="outline" 
              className="border-gray-600 hover:border-blue-500 hover:bg-blue-500/10 hover:text-blue-400 transition-all duration-300"
              onClick={async () => {
                try {
                  // Sync all bookings across all dates by default
                  await apiRequest('POST', '/api/daily-income/sync', { mode: 'overwrite' });
                  toast({ title: 'Synced', description: 'Daily income synced from bookings' });
                  queryClient.invalidateQueries({ queryKey: ["/api/daily-income"] });
                } catch (e: any) {
                  toast({ title: 'Error', description: e?.message || 'Sync failed', variant: 'destructive' });
                }
              }}
            >
              <TrendingUp className="w-4 h-4 mr-2"/> Sync from Bookings
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="glass-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <Filter className="w-5 h-5 text-rosae-red" />
              <h3 className="text-lg font-semibold text-gradient">Advanced Filters</h3>
            </div>
            <div className="grid gap-6 md:grid-cols-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Start Date
                </Label>
                <Input 
                  type="date" 
                  value={filters.startDate} 
                  onChange={e => setFilters(f => ({...f, startDate: e.target.value}))}
                  className="rosae-input"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  End Date
                </Label>
                <Input 
                  type="date" 
                  value={filters.endDate} 
                  onChange={e => setFilters(f => ({...f, endDate: e.target.value}))}
                  className="rosae-input"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                  <Wallet className="w-4 h-4" />
                  Payment Type
                </Label>
                <Select value={filters.paymentType} onValueChange={(v) => setFilters(f => ({...f, paymentType: v}))}>
                  <SelectTrigger className="rosae-select">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-700 border-gray-600 text-white">
                    <SelectItem value="all" className="text-white hover:bg-gray-600 focus:bg-gray-600">All Types</SelectItem>
                    <SelectItem value="cash" className="text-white hover:bg-gray-600 focus:bg-gray-600">Cash Only</SelectItem>
                    <SelectItem value="upi" className="text-white hover:bg-gray-600 focus:bg-gray-600">UPI Only</SelectItem>
                    <SelectItem value="other" className="text-white hover:bg-gray-600 focus:bg-gray-600">Other Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-300">Quick Filters</Label>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const today = new Date().toISOString().split('T')[0];
                      setFilters(f => ({...f, startDate: today, endDate: today}));
                    }}
                    className="text-xs border-gray-600 hover:border-blue-500 hover:text-blue-400"
                  >
                    Today
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const today = new Date();
                      const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                      setFilters(f => ({
                        ...f, 
                        startDate: lastWeek.toISOString().split('T')[0], 
                        endDate: today.toISOString().split('T')[0]
                      }));
                    }}
                    className="text-xs border-gray-600 hover:border-blue-500 hover:text-blue-400"
                  >
                    7 Days
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
          <KpiCard 
            title="Total Shows" 
            value={`${kpis.totalShows}`} 
            subtitle="All shows"
            icon={Calendar}
            color="text-blue-400"
          />
          <KpiCard 
            title="Gross Cash" 
            value={INR(kpis.totalCash, compactCurrency)} 
            subtitle="Cash received (gross)"
            icon={Banknote}
            color="text-green-400"
          />
          <KpiCard 
            title="Gross UPI" 
            value={INR(kpis.totalUpi, compactCurrency)} 
            subtitle="UPI received (gross)"
            icon={CreditCard}
            color="text-purple-400"
          />
          <KpiCard 
            title="Other" 
            value={INR(kpis.totalOther, compactCurrency)} 
            subtitle="Other payments"
            icon={Wallet}
            color="text-orange-400"
          />
          <KpiCard 
            title="Net Total" 
            value={INR(kpis.netTotal, compactCurrency)} 
            subtitle={`Gross ${INR(kpis.grossTotal, compactCurrency)} − Refunds ${INR(kpis.totalRefunds, compactCurrency)}`}
            icon={IndianRupee}
            color="text-yellow-400"
          />
          <KpiCard 
            title="Avg/Show" 
            value={INR(kpis.avgPerShow, compactCurrency)} 
            subtitle="Average per show (net)"
            icon={TrendingUp}
            color="text-cyan-400"
          />
        </div>

        {/* Data Table */}
        <Card className="glass-card">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-bold text-gradient flex items-center gap-2">
                <IndianRupee className="w-6 h-6 text-rosae-red" />
                Daily Income Records
              </CardTitle>
              <div className="text-sm text-gray-400">
                {enhancedRecords.length} record{enhancedRecords.length !== 1 ? 's' : ''}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="professional-table">
                <TableHeader>
                  <TableRow className="border-gray-600">
                    <TableHead className="text-gray-300 font-semibold">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Date
                      </div>
                    </TableHead>
                    <TableHead className="text-gray-300 font-semibold text-center">Shows</TableHead>
                    <TableHead className="text-gray-300 font-semibold text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Banknote className="w-4 h-4" />
                        Cash
                      </div>
                    </TableHead>
                    <TableHead className="text-gray-300 font-semibold text-right">
                      <div className="flex items-center justify-end gap-2">
                        <CreditCard className="w-4 h-4" />
                        UPI
                      </div>
                    </TableHead>
                    <TableHead className="text-gray-300 font-semibold text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Wallet className="w-4 h-4" />
                        Other
                      </div>
                    </TableHead>
                    <TableHead className="text-gray-300 font-semibold text-right">
                      <div className="flex items-center justify-end gap-2">
                        <IndianRupee className="w-4 h-4" />
                        Gross Total
                      </div>
                    </TableHead>
                    <TableHead className="text-gray-300 font-semibold text-right">
                      <div className="flex items-center justify-end gap-2">
                        <IndianRupee className="w-4 h-4" />
                        Refunds
                      </div>
                    </TableHead>
                    <TableHead className="text-gray-300 font-semibold text-right">
                      <div className="flex items-center justify-end gap-2">
                        <IndianRupee className="w-4 h-4" />
                        Net Total
                      </div>
                    </TableHead>
                    <TableHead className="text-gray-300 font-semibold text-right">
                      <div className="flex items-center justify-end gap-2">
                        <TrendingUp className="w-4 h-4" />
                        Avg/Show
                      </div>
                    </TableHead>
                    <TableHead className="text-gray-300 font-semibold">Notes</TableHead>
                    <TableHead className="text-gray-300 font-semibold text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {enhancedRecords.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-12 text-gray-400">
                        <div className="flex flex-col items-center gap-3">
                          <IndianRupee className="w-12 h-12 text-gray-600" />
                          <p className="text-lg">No income records found</p>
                          <p className="text-sm">Add your first daily income record to get started</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedRecords.map((record) => (
                      <TableRow key={record.id} className="border-gray-600 group">
                        <TableCell className="text-white font-medium">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-rosae-red rounded-full opacity-60 group-hover:opacity-100 transition-opacity"></div>
                            {formatDate(record.date)}
                          </div>
                        </TableCell>
                        <TableCell className="text-white text-center">
                          <Badge className="rosae-badge-info">{record.adjustedShows ?? record.numberOfShows}</Badge>
                        </TableCell>
                        <TableCell className="text-green-400 font-medium text-right whitespace-nowrap tabular-nums">{INR(record.cashReceived, compactCurrency)}</TableCell>
                        <TableCell className="text-purple-400 font-medium text-right whitespace-nowrap tabular-nums">{INR(record.upiReceived, compactCurrency)}</TableCell>
                        <TableCell className="text-orange-400 font-medium text-right whitespace-nowrap tabular-nums">{INR(record.otherPayments, compactCurrency)}</TableCell>
                        <TableCell className="text-yellow-400 font-bold text-right text-lg whitespace-nowrap tabular-nums">{INR(record.totalIncome, compactCurrency)}</TableCell>
                        <TableCell className="text-red-400 font-bold text-right whitespace-nowrap tabular-nums">{INR(record.refundTotal || 0, compactCurrency)}</TableCell>
                        <TableCell className="text-green-300 font-bold text-right whitespace-nowrap tabular-nums">{INR(record.netIncome, compactCurrency)}</TableCell>
                        <TableCell className="text-cyan-400 font-medium text-right whitespace-nowrap tabular-nums">
                          {fmt(record.avgPerShow) !== "—" ? INR(record.avgPerShow, compactCurrency) : "—"}
                        </TableCell>
                        <TableCell className="text-gray-300 max-w-xs">
                          <div className="truncate" title={record.notes || ""}>
                            {record.notes || <span className="text-gray-500 italic">No notes</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEdit(record)}
                              className="text-blue-400 hover:text-blue-300 hover:bg-blue-400/10 h-8 w-8 p-0"
                              title="Edit record"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDuplicate(record)}
                              className="text-green-400 hover:text-green-300 hover:bg-green-400/10 h-8 w-8 p-0"
                              title="Duplicate record"
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(record)}
                              className="text-red-400 hover:text-red-300 hover:bg-red-400/10 h-8 w-8 p-0"
                              title="Delete record"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
                {enhancedRecords.length > 0 && (
                  <TableFooter>
                    <TableRow className="border-gray-600 bg-gradient-to-r from-gray-800/80 to-gray-700/80 hover:from-gray-800 hover:to-gray-700">
                      <TableCell className="text-white font-bold text-lg">TOTALS</TableCell>
                      <TableCell className="text-center">
                        <Badge className="rosae-badge-primary font-bold">{kpis.totalShows}</Badge>
                      </TableCell>
                      <TableCell className="text-green-400 font-bold text-right text-lg whitespace-nowrap tabular-nums">{INR(kpis.totalCash)}</TableCell>
                      <TableCell className="text-purple-400 font-bold text-right text-lg whitespace-nowrap tabular-nums">{INR(kpis.totalUpi)}</TableCell>
                      <TableCell className="text-orange-400 font-bold text-right text-lg whitespace-nowrap tabular-nums">{INR(kpis.totalOther)}</TableCell>
                      <TableCell className="text-yellow-400 font-bold text-right text-xl whitespace-nowrap tabular-nums">{INR(kpis.grossTotal)}</TableCell>
                      <TableCell className="text-red-400 font-bold text-right text-lg whitespace-nowrap tabular-nums">{INR(kpis.totalRefunds)}</TableCell>
                      <TableCell className="text-green-300 font-bold text-right text-xl whitespace-nowrap tabular-nums">{INR(kpis.netTotal)}</TableCell>
                      <TableCell className="text-cyan-400 font-bold text-right text-lg whitespace-nowrap tabular-nums">{INR(kpis.avgPerShow)}</TableCell>
                      <TableCell className="text-gray-400 text-center">—</TableCell>
                      <TableCell className="text-center">—</TableCell>
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </div>

            {/* Pagination controls */}
            {enhancedRecords.length > 0 && (
              <div className="flex flex-col gap-3 items-stretch justify-between px-4 py-3 text-gray-300">
                <div className="flex items-center justify-between">
                  <div>
                    Showing {startIndex + 1}-{Math.min(endIndex, enhancedRecords.length)} of {enhancedRecords.length} entries
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-400">Rows per page:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setPageSize(v);
                        setCurrentPage(1);
                      }}
                      className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-gray-200 focus:outline-none focus:ring-1 focus:ring-rosae-red"
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Button variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700" disabled={currentPage === 1} onClick={() => setCurrentPage(1)}>First</Button>
                    <Button variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700" disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>Previous</Button>
                    <div className="flex items-center gap-1">
                      {(() => {
                        const maxVisible = 5;
                        let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
                        let end = Math.min(totalPages, start + maxVisible - 1);
                        if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);
                        const buttons: any[] = [];
                        if (start > 1) {
                          buttons.push(<Button key={1} variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700" onClick={() => setCurrentPage(1)}>1</Button>);
                          if (start > 2) buttons.push(<span key="e1" className="text-gray-400 px-2">...</span>);
                        }
                        for (let i = start; i <= end; i++) {
                          buttons.push(
                            <Button key={i} variant={i === currentPage ? 'default' : 'outline'} className={i === currentPage ? 'bg-rosae-red hover:bg-rosae-dark-red' : 'border-gray-600 text-gray-300 hover:bg-gray-700'} onClick={() => setCurrentPage(i)}>{i}</Button>
                          );
                        }
                        if (end < totalPages) {
                          if (end < totalPages - 1) buttons.push(<span key="e2" className="text-gray-400 px-2">...</span>);
                          buttons.push(<Button key={totalPages} variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700" onClick={() => setCurrentPage(totalPages)}>{totalPages}</Button>);
                        }
                        return buttons;
                      })()}
                    </div>
                    <Button variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>Next</Button>
                    <Button variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700" disabled={currentPage === totalPages} onClick={() => setCurrentPage(totalPages)}>Last</Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-400">Go to page:</span>
                    <input
                      type="number"
                      min={1}
                      max={totalPages}
                      value={currentPage}
                      onChange={(e) => {
                        const v = Math.max(1, Math.min(totalPages, Number(e.target.value) || 1));
                        setCurrentPage(v);
                      }}
                      className="bg-gray-800 border border-gray-600 text-white text-sm rounded px-2 py-1 w-16 text-center"
                    />
                    <span className="text-sm text-gray-400">of {totalPages}</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add/Edit Modal */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="modal-content text-white max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader className="pb-6">
              <DialogTitle className="text-2xl font-bold text-gradient flex items-center gap-3">
                {editingRecord ? (
                  <>
                    <Edit className="w-6 h-6 text-blue-400" />
                    Edit Daily Income Record
                  </>
                ) : (
                  <>
                    <Plus className="w-6 h-6 text-green-400" />
                    Add New Daily Income Record
                  </>
                )}
              </DialogTitle>
              <p className="text-gray-400 mt-2">
                {editingRecord 
                  ? 'Update the income details for this date' 
                  : 'Enter the daily income details for your theatre'
                }
              </p>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8 form-professional">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-300 flex items-center gap-2 font-medium">
                          <Calendar className="w-4 h-4 text-rosae-red" />
                          Date
                        </FormLabel>
                        <FormControl>
                          <Input 
                            type="date" 
                            {...field}
                            className="rosae-input"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="numberOfShows"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-300 flex items-center gap-2 font-medium">
                          <Eye className="w-4 h-4 text-rosae-red" />
                          Number of Shows
                        </FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="1"
                            placeholder="e.g., 3"
                            {...field}
                            onChange={e => field.onChange(Number(e.target.value))}
                            className="rosae-input"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="cashReceived"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-300 flex items-center gap-2 font-medium">
                          <Banknote className="w-4 h-4 text-green-400" />
                          Cash Received (₹)
                        </FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            {...field}
                            onChange={e => field.onChange(Number(e.target.value))}
                            className="rosae-input"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="upiReceived"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-300 flex items-center gap-2 font-medium">
                          <CreditCard className="w-4 h-4 text-purple-400" />
                          UPI Received (₹)
                        </FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            {...field}
                            onChange={e => field.onChange(Number(e.target.value))}
                            className="rosae-input"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="otherPayments"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel className="text-gray-300 flex items-center gap-2 font-medium">
                          <Wallet className="w-4 h-4 text-orange-400" />
                          Other Payments (₹)
                        </FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="0"
                            step="0.01"
                            placeholder="0.00 (Optional - credit cards, cheques, etc.)"
                            {...field}
                            onChange={e => field.onChange(Number(e.target.value))}
                            className="rosae-input"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Live calculation preview */}
                <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-600">
                  <h4 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-rosae-red" />
                    Live Calculation Preview
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-400">Total Income</p>
                      <p className="text-yellow-400 font-bold">
                        {INR((form.watch('cashReceived') || 0) + (form.watch('upiReceived') || 0) + (form.watch('otherPayments') || 0))}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400">Avg per Show</p>
                      <p className="text-cyan-400 font-bold">
                        {form.watch('numberOfShows') > 0 
                          ? INR(((form.watch('cashReceived') || 0) + (form.watch('upiReceived') || 0) + (form.watch('otherPayments') || 0)) / form.watch('numberOfShows'))
                          : "—"
                        }
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400">Cash %</p>
                      <p className="text-green-400 font-bold">
                        {((form.watch('cashReceived') || 0) + (form.watch('upiReceived') || 0) + (form.watch('otherPayments') || 0)) > 0
                          ? `${(((form.watch('cashReceived') || 0) / ((form.watch('cashReceived') || 0) + (form.watch('upiReceived') || 0) + (form.watch('otherPayments') || 0))) * 100).toFixed(1)}%`
                          : "0%"
                        }
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400">UPI %</p>
                      <p className="text-purple-400 font-bold">
                        {((form.watch('cashReceived') || 0) + (form.watch('upiReceived') || 0) + (form.watch('otherPayments') || 0)) > 0
                          ? `${(((form.watch('upiReceived') || 0) / ((form.watch('cashReceived') || 0) + (form.watch('upiReceived') || 0) + (form.watch('otherPayments') || 0))) * 100).toFixed(1)}%`
                          : "0%"
                        }
                      </p>
                    </div>
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-300 flex items-center gap-2 font-medium">
                        <FileText className="w-4 h-4 text-rosae-red" />
                        Notes (Optional)
                      </FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field}
                          placeholder="Add any notes about this day's income, special events, or observations..."
                          rows={3}
                          className="rosae-input resize-none"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter className="gap-3 pt-6 border-t border-gray-600">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsModalOpen(false)}
                    className="border-gray-600 hover:border-gray-500 hover:bg-gray-700/50"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    className="btn-rosae-primary min-w-[120px]"
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {createMutation.isPending || updateMutation.isPending ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        {editingRecord ? 'Updating...' : 'Creating...'}
                      </div>
                    ) : (
                      editingRecord ? 'Update Record' : 'Create Record'
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Modal */}
        <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
          <DialogContent className="modal-content text-white max-w-md">
            <DialogHeader className="pb-4">
              <DialogTitle className="text-xl font-bold text-red-400 flex items-center gap-3">
                <Trash2 className="w-6 h-6" />
                Confirm Delete
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                <p className="text-gray-300 mb-2">
                  Are you sure you want to delete the income record for:
                </p>
                <div className="bg-gray-800/50 rounded p-3 space-y-1">
                  <p className="text-white font-medium">
                    📅 {deletingRecord && formatDate(deletingRecord.date)}
                  </p>
                  <p className="text-gray-400 text-sm">
                    💰 Total: {deletingRecord && INR(deletingRecord.cashReceived + deletingRecord.upiReceived + deletingRecord.otherPayments)}
                  </p>
                  <p className="text-gray-400 text-sm">
                    🎭 Shows: {deletingRecord && deletingRecord.numberOfShows}
                  </p>
                </div>
              </div>
              
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                <p className="text-yellow-400 text-sm flex items-center gap-2">
                  ⚠️ This action cannot be undone
                </p>
              </div>
            </div>

            <DialogFooter className="gap-3 pt-6 border-t border-gray-600">
              <Button 
                variant="outline" 
                onClick={() => setIsDeleteModalOpen(false)}
                className="border-gray-600 hover:border-gray-500 hover:bg-gray-700/50"
                disabled={deleteMutation.isPending}
              >
                Cancel
              </Button>
              <Button 
                onClick={confirmDelete}
                className="bg-red-600 hover:bg-red-700 min-w-[100px]"
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Deleting...
                  </div>
                ) : (
                  'Delete Record'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}