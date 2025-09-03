import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Layout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, IndianRupee, Calendar, Tag, Download, Printer, User, X, Loader2, Sun, Moon } from "lucide-react";
import { insertExpenseSchema } from "@shared/schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

// Default values will be replaced by configuration from API
const DEFAULT_EXPENSE_CATEGORIES = [
  "Utilities",
  "Maintenance",
  "Staff Salaries",
  "Equipment",
  "Marketing",
  "Rent",
  "Supplies",
  "Insurance",
  "Other"
];

const DEFAULT_EXPENSE_CREATORS = [
  "Kumar",
  "Rahul",
  "Priya",
  "Amit",
  "Sneha"
];

export default function Expenses() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedCreator, setSelectedCreator] = useState<string>("");
  const [dateRange, setDateRange] = useState<{ startDate: string; endDate: string }>({ startDate: "", endDate: "" });
  const [paidViaFilter, setPaidViaFilter] = useState<string>("");
  const printSectionRef = useRef<HTMLDivElement>(null);
  
  // Pagination: show recent 10 entries by default
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Reset to first page whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, selectedCreator, paidViaFilter, dateRange.startDate, dateRange.endDate]);
  
  // State for configuration data
  const [expenseCategories, setExpenseCategories] = useState<string[]>(DEFAULT_EXPENSE_CATEGORIES);
  const [expenseCreators, setExpenseCreators] = useState<string[]>(DEFAULT_EXPENSE_CREATORS);

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

  const form = useForm({
    resolver: zodResolver(insertExpenseSchema),
    defaultValues: {
      category: "",
      description: "",
      amount: "",
      expenseDate: new Date().toISOString().split('T')[0],
      creatorName: expenseCreators.length > 0 ? expenseCreators[0] : "",
      paidVia: "", // '', 'cash', 'upi', 'both'
      paidCash: "",
      paidUpi: "",
    },
  });
  
  // Update form default values when expense creators change
  useEffect(() => {
    if (expenseCreators.length > 0 && !form.getValues().creatorName) {
      form.setValue("creatorName", expenseCreators[0]);
    }
  }, [expenseCreators, form]);

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
      setExpenseCategories(configData.expenseCategories || DEFAULT_EXPENSE_CATEGORIES);
      setExpenseCreators(configData.expenseCreators || DEFAULT_EXPENSE_CREATORS);
    }
  }, [configData]);
  
  const { data: expenses, isLoading: isExpensesLoading, error: expensesError } = useQuery<any[]>({
    queryKey: ["/api/expenses"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/expenses");
      return await res.json();
    },
    retry: 1,
    refetchOnWindowFocus: false,
    staleTime: 30000,
  });

  // Handle expenses errors with useEffect
  useEffect(() => {
    if (expensesError) {
      if (isUnauthorizedError(expensesError)) {
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
        description: (expensesError as any).message || "Failed to load expenses",
        variant: "destructive",
      });
    }
  }, [expensesError, toast]);

  const createExpenseMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/expenses", data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Expense created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      setIsExpenseModalOpen(false);
      form.reset();
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
        description: error.message || "Failed to create expense",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: any) => {
    // Ensure all required fields are present and properly formatted
    const expenseData: any = {
      category: data.category,
      description: data.description,
      amount: parseFloat(data.amount),
      expenseDate: data.expenseDate,
      creatorName: data.creatorName,
    };
    
    // Optional paid via — record zero when a method is selected but amount left blank
    const via = data.paidVia as string;
    const cash = data.paidCash === '' || data.paidCash === undefined ? 0 : parseFloat(data.paidCash);
    const upi = data.paidUpi === '' || data.paidUpi === undefined ? 0 : parseFloat(data.paidUpi);

    // Set payment fields based on selection.
    // Do NOT send null for the unselected method to avoid it being coerced to 0 on the server.
    if (via === 'cash') {
      expenseData.paidCash = isNaN(cash) ? 0 : cash;
      expenseData.paidVia = 'cash';
    } else if (via === 'upi') {
      expenseData.paidUpi = isNaN(upi) ? 0 : upi;
      expenseData.paidVia = 'upi';
    } else if (via === 'both') {
      expenseData.paidCash = isNaN(cash) ? 0 : cash;
      expenseData.paidUpi = isNaN(upi) ? 0 : upi;
      expenseData.paidVia = 'both';
    }
    // If no payment method selected, leave both fields undefined
    
    createExpenseMutation.mutate(expenseData);
  };

  const handleExport = async (category?: string) => {
    try {
      const params = category ? `?category=${category}` : '';
      const response = await fetch(`/api/expenses/export${params}`, {
        credentials: 'include'
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `expenses${category ? `_${category}` : ''}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        toast({
          title: "Success",
          description: "Expenses exported successfully",
        });
      } else {
        throw new Error('Export failed');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export expenses",
        variant: "destructive",
      });
    }
  };

  const handlePrint = () => {
    let filteredExpenses = [...(expensesArray || [])];

    if (selectedCategory) {
      filteredExpenses = filteredExpenses.filter(expense => expense.category === selectedCategory);
    }

    if (selectedCreator) {
      filteredExpenses = filteredExpenses.filter(expense => expense.creatorName === selectedCreator);
    }

    if (dateRange.startDate) {
      filteredExpenses = filteredExpenses.filter(expense =>
        new Date(expense.expenseDate) >= new Date(dateRange.startDate));
    }

    if (dateRange.endDate) {
      filteredExpenses = filteredExpenses.filter(expense =>
        new Date(expense.expenseDate) <= new Date(dateRange.endDate));
    }

    const filteredTotal = filteredExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0);

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({
        title: "Error",
        description: "Could not open print window. Please check your popup blocker settings.",
        variant: "destructive",
      });
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Expense Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #e11d48; text-align: center; margin-bottom: 20px; }
            .filters { margin-bottom: 20px; padding: 10px; background-color: #f8f9fa; border-radius: 5px; }
            table { width: 100%; border-collapse: collapse; }
            th { background-color: #f1f1f1; text-align: left; padding: 10px; }
            td { padding: 10px; border-bottom: 1px solid #ddd; }
            .total { font-weight: bold; margin-top: 20px; text-align: right; font-size: 18px; }
            .date { color: #666; }
            .category { background-color: #e6f7ff; padding: 5px 10px; border-radius: 15px; display: inline-block; }
            .amount { font-weight: bold; color: #e11d48; }
          </style>
        </head>
        <body>
          <h1>Expense Report</h1>
          <div class="filters">
            <strong>Filters:</strong>
            ${selectedCategory ? `Category: ${selectedCategory}` : 'All Categories'} |
            ${selectedCreator ? `Created By: ${selectedCreator}` : 'All Creators'} |
            Date Range: ${dateRange.startDate ? new Date(dateRange.startDate).toLocaleDateString('en-IN') : 'Any'}
            to ${dateRange.endDate ? new Date(dateRange.endDate).toLocaleDateString('en-IN') : 'Any'}
          </div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Description</th>
                <th>Created By</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              ${filteredExpenses.map(expense => `
                <tr>
                  <td class="date">${formatDate(expense.expenseDate)}</td>
                  <td><span class="category">${expense.category}</span></td>
                  <td>${expense.description}</td>
                  <td>${expense.creatorName || 'Unknown'}</td>
                  <td class="amount">₹${Number(expense.amount).toLocaleString('en-IN')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="total">Total: ₹${filteredTotal.toLocaleString('en-IN')}</div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.onafterprint = function () {
      printWindow.close();
    };
  };

  const formatCurrency = (value: number) => {
    return `₹${value.toLocaleString('en-IN')}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN');
  };

  // Helper: derive display label for paid method from optional fields
  // Show label if fields are present, even when amount is 0 (user selected a method but left amount blank)
  const getPaidViaLabel = (expense: any) => {
    // Prefer explicit field if available
    if (expense.paidVia) {
      if (expense.paidVia === 'both') return 'U&C';
      if (expense.paidVia === 'cash') return 'Cash';
      if (expense.paidVia === 'upi') return 'UPI';
    }
    // Fallback to inference from amounts
    const hasCash = expense.paidCash !== undefined && expense.paidCash !== null;
    const hasUpi = expense.paidUpi !== undefined && expense.paidUpi !== null;
    if (hasCash && hasUpi) return 'U&C';
    if (hasCash) return 'Cash';
    if (hasUpi) return 'UPI';
    return '-';
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

  if (expensesError) {
    return (
      <div className="flex min-h-screen bg-rosae-black">
        <Sidebar />
        <div className="flex-1 p-6">
          <div className="bg-rosae-dark-gray border border-gray-600 rounded-lg p-6 text-white">
            <h2 className="text-2xl font-bold mb-4">Error Loading Expenses</h2>
            <p className="text-gray-300 mb-4">There was a problem loading the expenses data.</p>
            <Button
              onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/expenses"] })}
              className="bg-rosae-red hover:bg-rosae-dark-red"
            >
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const expensesArray = Array.isArray(expenses) ? expenses : [];

  const filteredExpenses = expensesArray.filter((expense: any) => {
    if (selectedCategory && expense.category !== selectedCategory) {
      return false;
    }

    if (selectedCreator && expense.creatorName !== selectedCreator) {
      return false;
    }

    if (dateRange.startDate && new Date(expense.expenseDate) < new Date(dateRange.startDate)) {
      return false;
    }

    if (dateRange.endDate && new Date(expense.expenseDate) > new Date(dateRange.endDate)) {
      return false;
    }

    if (paidViaFilter) {
      const label = expense.paidVia || getPaidViaLabel(expense).toLowerCase();
      if (paidViaFilter === 'both') {
        if (!(label === 'both' || label === 'u&c')) return false;
      } else {
        if (label !== paidViaFilter) return false;
      }
    }

    return true;
  });

  // Pagination calculations
  const totalExpensesCount = filteredExpenses.length;
  const totalPages = Math.max(1, Math.ceil(totalExpensesCount / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedExpenses = filteredExpenses.slice(startIndex, endIndex);

  const totalExpenses = filteredExpenses.reduce((sum: number, expense: any) => sum + Number(expense.amount), 0);

  const expensesByCategory = filteredExpenses.reduce((acc: any, expense: any) => {
    const category = expense.category;
    if (!acc[category]) {
      acc[category] = 0;
    }
    acc[category] += Number(expense.amount);
    return acc;
  }, {});

  return (
    <Layout>
      <div className="p-6">
        {/* Header bar - match layout style */}
        <div className="flex items-center justify-between mb-6 bg-rosae-dark-gray border border-gray-700 rounded-lg px-4 py-3">
          <div>
            <h2 className="text-2xl font-bold text-white" data-testid="text-page-title">Expense Management</h2>
            <p className="text-gray-400 text-sm">Track and manage all business expenses</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
              onClick={() => handleExport()}
              data-testid="button-export"
            >
              <Download className="mr-2 w-4 h-4" />
              Export CSV
            </Button>
            <Button
              variant="outline"
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
              onClick={handlePrint}
              data-testid="button-print"
            >
              <Printer className="mr-2 w-4 h-4" />
              Print
            </Button>
            <Dialog open={isExpenseModalOpen} onOpenChange={setIsExpenseModalOpen}>
              <DialogTrigger asChild>
                <Button className="bg-rosae-red hover:bg-rosae-dark-red px-6 py-2" data-testid="button-new-expense">
                  <Plus className="mr-2 w-4 h-4" />
                  New Expense
                </Button>
              </DialogTrigger>
                <DialogContent className="bg-rosae-dark-gray border-gray-600 text-white sm:max-w-[560px] rounded-xl">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-semibold text-white">Add New Expense</DialogTitle>
                  </DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="category"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-gray-300">Category</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger className="bg-gray-800 border-gray-600 text-white h-9" data-testid="select-category">
                                    <SelectValue placeholder="Select category" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent className="bg-gray-800 border-gray-600">
                                  {expenseCategories.map((category) => (
                                    <SelectItem key={category} value={category}>
                                      {category}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="amount"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-gray-300">Amount</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="1000"
                                  className="bg-gray-800 border-gray-600 text-white h-9"
                                  data-testid="input-amount"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="expenseDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-gray-300">Expense Date</FormLabel>
                              <FormControl>
                                <Input
                                  type="date"
                                  className="bg-gray-800 border-gray-600 text-white h-9"
                                  data-testid="input-expense-date"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="creatorName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-gray-300">Created By</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger className="bg-gray-800 border-gray-600 text-white h-9" data-testid="select-creator">
                                    <SelectValue placeholder="Select creator" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent className="bg-gray-800 border-gray-600">
                                  {expenseCreators.map((creator) => (
                                    <SelectItem key={creator} value={creator}>
                                      {creator}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Optional payment method section */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name="paidVia"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-gray-300">Paid Via (optional)</FormLabel>
                              <Select onValueChange={(v) => {
                                const mapped = v === '__NONE__' ? '' : v;
                                field.onChange(mapped);
                                // When switching mode, clear amounts to avoid stale values
                                if (mapped !== 'cash') form.setValue('paidCash', '');
                                if (mapped !== 'upi') form.setValue('paidUpi', '');
                              }} value={field.value === '' ? '__NONE__' : (field.value as string)}>
                                <FormControl>
                                  <SelectTrigger className="bg-gray-800 border-gray-600 text-white h-9">
                                    <SelectValue placeholder="Not specified" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent className="bg-gray-800 border-gray-600">
                                  <SelectItem value="__NONE__">Not specified</SelectItem>
                                  <SelectItem value="cash">Cash</SelectItem>
                                  <SelectItem value="upi">UPI</SelectItem>
                                  <SelectItem value="both">Both (split)</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        {(form.watch('paidVia') === 'cash' || form.watch('paidVia') === 'both') && (
                          <FormField
                            control={form.control}
                            name="paidCash"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-gray-300">Cash Amount</FormLabel>
                                <FormControl>
                                  <Input type="number" step="0.01" placeholder="0" className="bg-gray-800 border-gray-600 text-white h-9" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}
                        {(form.watch('paidVia') === 'upi' || form.watch('paidVia') === 'both') && (
                          <FormField
                            control={form.control}
                            name="paidUpi"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-gray-300">UPI Amount</FormLabel>
                                <FormControl>
                                  <Input type="number" step="0.01" placeholder="0" className="bg-gray-800 border-gray-600 text-white h-9" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}
                      </div>
                      {/* Ensure we persist paidVia explicitly for listing */}
                      <input type="hidden" value={form.watch('paidVia') || ''} readOnly />

                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-gray-300">Description</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Describe the expense..."
                                className="bg-gray-800 border-gray-600 text-white resize-none"
                                rows={3}
                                data-testid="textarea-description"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="flex justify-end gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsExpenseModalOpen(false)}
                          className="border-gray-600 text-gray-300 hover:bg-gray-700"
                          data-testid="button-cancel-expense"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          disabled={createExpenseMutation.isPending}
                          className="bg-rosae-red hover:bg-rosae-dark-red"
                          data-testid="button-save-expense"
                        >
                          {createExpenseMutation.isPending ? "Saving..." : "Save Expense"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
          </div>
        </div>

        {/* Filters card */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-end">
              <div className="w-48">
                <Label className="text-gray-300 mb-1 block">Category</Label>
                <Select
                  value={selectedCategory === "" ? "__ALL__" : selectedCategory}
                  onValueChange={(v) => setSelectedCategory(v === "__ALL__" ? "" : v)}
                >
                  <SelectTrigger className="bg-gray-800 border-gray-600 text-white h-9">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-600">
                    <SelectItem value="__ALL__">All Categories</SelectItem>
                    {expenseCategories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-48">
                <Label className="text-gray-300 mb-1 block">Created By</Label>
                <Select
                  value={selectedCreator === "" ? "__ALL__" : selectedCreator}
                  onValueChange={(v) => setSelectedCreator(v === "__ALL__" ? "" : v)}
                >
                  <SelectTrigger className="bg-gray-800 border-gray-600 text-white h-9">
                    <SelectValue placeholder="All Creators" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-600">
                    <SelectItem value="__ALL__">All Creators</SelectItem>
                    {expenseCreators.map((creator) => (
                      <SelectItem key={creator} value={creator}>
                        {creator}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-48">
                <Label className="text-gray-300 mb-1 block">Paid Via</Label>
                <Select
                  onValueChange={(v) => setPaidViaFilter(v === "__ALL__" ? "" : v)}
                  value={paidViaFilter === "" ? "__ALL__" : paidViaFilter}
                >
                  <SelectTrigger className="bg-gray-800 border-gray-600 text-white h-9">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-600">
                    <SelectItem value="__ALL__">All</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="both">U&C</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-44">
                <Label className="text-gray-300 mb-1 block">Start Date</Label>
                <Input
                  type="date"
                  className="bg-gray-800 border-gray-600 text-white h-9"
                  value={dateRange.startDate}
                  onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                />
              </div>
              <div className="w-44">
                <Label className="text-gray-300 mb-1 block">End Date</Label>
                <Input
                  type="date"
                  className="bg-gray-800 border-gray-600 text-white h-9"
                  value={dateRange.endDate}
                  onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                />
              </div>
              <div className="ml-auto">
                <Button
                  variant="outline"
                  className="border-gray-600 text-gray-300 hover:bg-gray-700"
                  onClick={() => {
                    setSelectedCategory("");
                    setSelectedCreator("");
                    setDateRange({ startDate: "", endDate: "" });
                  }}
                >
                  <X className="mr-2 w-4 h-4" />
                  Clear
                </Button>
              </div>
            </div>
          </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 shadow-md">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-xs uppercase tracking-wide">Total Expenses</p>
                    <p className="text-3xl font-semibold text-white mt-1" data-testid="text-total-expenses">
                      {formatCurrency(totalExpenses)}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-rosae-red/20 rounded-lg flex items-center justify-center">
                    <IndianRupee className="text-rosae-red text-xl" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 shadow-md">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-xs uppercase tracking-wide">Categories</p>
                    <p className="text-3xl font-semibold text-white mt-1" data-testid="text-categories-count">
                      {Object.keys(expensesByCategory).length}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                    <Tag className="text-blue-400 text-xl" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 shadow-md">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-xs uppercase tracking-wide">Total Entries</p>
                    <p className="text-3xl font-semibold text-white mt-1" data-testid="text-total-entries">
                      {filteredExpenses.length}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                    <Calendar className="text-green-400 text-xl" />
                  </div>
                </div>
              </CardContent>
            </Card>
        </div>

        <Card className="bg-rosae-dark-gray border-gray-600">
          <CardContent className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-white" data-testid="text-expenses-list-title">All Expenses</h3>
                {(selectedCategory || selectedCreator || dateRange.startDate || dateRange.endDate) && (
                  <div className="flex items-center space-x-2 text-sm text-gray-400">
                    <span>Filtered by:</span>
                    {selectedCategory && (
                      <span className="px-2 py-1 bg-blue-600/20 text-blue-400 rounded-full text-xs font-medium">
                        {selectedCategory}
                      </span>
                    )}
                    {selectedCreator && (
                      <span className="px-2 py-1 bg-purple-600/20 text-purple-400 rounded-full text-xs font-medium">
                        {selectedCreator}
                      </span>
                    )}
                    {(dateRange.startDate || dateRange.endDate) && (
                      <span className="px-2 py-1 bg-green-600/20 text-green-400 rounded-full text-xs font-medium">
                        {dateRange.startDate ? formatDate(dateRange.startDate) : 'Any'} - {dateRange.endDate ? formatDate(dateRange.endDate) : 'Any'}
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-gray-400 hover:text-white hover:bg-gray-700"
                      onClick={() => {
                        setSelectedCategory("");
                        setSelectedCreator("");
                        setDateRange({ startDate: "", endDate: "" });
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
              {isExpensesLoading ? (
                <div className="flex items-center justify-center h-64 text-gray-400">
                  Loading expenses...
                </div>
              ) : expensesArray.length > 0 ? (
                <div ref={printSectionRef}>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-gray-400 text-sm border-b border-gray-600">
                          <th className="pb-3">Date</th>
                          <th className="pb-3">Category</th>
                          <th className="pb-3">Description</th>
                          <th className="pb-3">Created By</th>
                          <th className="pb-3">Paid Via</th>
                          <th className="pb-3">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="text-white">
                        {paginatedExpenses.map((expense: any) => (
                          <tr key={expense.id} className="border-b border-gray-700 hover:bg-gray-800/50" data-testid={`row-expense-${expense.id}`}>
                            <td className="py-4">
                              <div className="flex items-center">
                                <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                                {formatDate(expense.expenseDate)}
                              </div>
                            </td>
                            <td className="py-4">
                              <span className="px-3 py-1 bg-blue-600/20 text-blue-400 rounded-full text-xs font-medium">
                                {expense.category}
                              </span>
                            </td>
                            <td className="py-4 text-gray-300 max-w-xs truncate">{expense.description}</td>
                            <td className="py-4 text-gray-300">{expense.creatorName || 'Unknown'}</td>
                            <td className="py-4 text-gray-300">{getPaidViaLabel(expense)}</td>
                            <td className="py-4 font-semibold">
                              <div className="flex items-center text-rosae-red">
                                <IndianRupee className="w-4 h-4 mr-1" />
                                {formatCurrency(Number(expense.amount))}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination controls */}
                  {totalPages > 0 && (
                    <div className="flex flex-col gap-3 items-stretch justify-between mt-4 text-gray-300">
                      <div className="flex items-center justify-between">
                        <div>
                          Showing {startIndex + 1}–{Math.min(endIndex, totalExpensesCount)} of {totalExpensesCount} entries
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-gray-400">Rows per page:</span>
                          <select
                            value={pageSize}
                            onChange={(e) => { const v = Number(e.target.value); setCurrentPage(1); /* pageSize fixed via const here - skip change */ }}
                            className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-gray-200"
                            disabled
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
                          <Button
                            variant="outline"
                            className="border-gray-600 text-gray-300 hover:bg-gray-700"
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          >
                            Previous
                          </Button>
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
                          <Button
                            variant="outline"
                            className="border-gray-600 text-gray-300 hover:bg-gray-700"
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          >
                            Next
                          </Button>
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
                </div>
              ) : (
                <div className="text-center py-16">
                  <IndianRupee className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">No Expenses Found</h3>
                  <p className="text-gray-400 mb-6">Start by recording your first expense</p>
                  <Button
                    onClick={() => setIsExpenseModalOpen(true)}
                    className="bg-rosae-red hover:bg-rosae-dark-red"
                    data-testid="button-create-first-expense"
                  >
                    <Plus className="mr-2 w-4 h-4" />
                    Add First Expense
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
      </div>
    </Layout>
  );
}
