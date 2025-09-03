import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Layout from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BookingModal } from "@/components/booking-modal";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Calendar, Users, IndianRupee, Search, X, Edit, Trash2, Phone, ChevronLeft, ChevronRight, Printer } from "lucide-react";
import { ReviewModal } from '@/components/review-modal';

export default function Bookings() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<any>(null);
  const [deletingBooking, setDeletingBooking] = useState<any>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteComment, setDeleteComment] = useState("");
  const [reviewBooking, setReviewBooking] = useState<any>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  
  // Filter states
  const [dateFilter, setDateFilter] = useState("");
  const [phoneFilter, setPhoneFilter] = useState("");
  const [bookingDateFilter, setBookingDateFilter] = useState("");
  const [repeatCountFilter, setRepeatCountFilter] = useState("");
  const [filteredBookings, setFilteredBookings] = useState<any[]>([]);
  
  // Date range filter states
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");

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
  
  // Check URL parameters for actions
  useEffect(() => {
    // Check if the URL has an action parameter to open the booking modal
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action');
    
    if (action === 'new') {
      setIsBookingModalOpen(true);
      // Remove the action parameter from URL to prevent reopening the modal on refresh
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, []);

  const { data, isLoading: isBookingsLoading, refetch, error: bookingsError } = useQuery({
    queryKey: ["/api/bookings", currentPage, pageSize, dateFilter, phoneFilter, bookingDateFilter, repeatCountFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        pageSize: pageSize.toString(),
        ...(dateFilter && { dateFilter }),
        ...(phoneFilter && { phoneFilter }),
        ...(bookingDateFilter && { bookingDateFilter }),
        ...(repeatCountFilter && { repeatCountFilter })
      });
      const response = await fetch(`/api/bookings?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch bookings');
      }
      return response.json();
    },
  });

  // Edit booking mutation
  const editBookingMutation = useMutation({
    mutationFn: async (bookingData: any) => {
      return await apiRequest("PATCH", `/api/bookings/${editingBooking.id}`, bookingData);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Booking updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      setIsEditModalOpen(false);
      setEditingBooking(null);
      refetch();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update booking",
        variant: "destructive",
      });
    },
  });

  // Delete booking mutation
  const deleteBookingMutation = useMutation({
    mutationFn: async ({ bookingId, reason, comment }: { bookingId: string; reason: string; comment?: string }) => {
      return await apiRequest("DELETE", `/api/bookings/${bookingId}`, { reason, comment });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Booking deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      setIsDeleteModalOpen(false);
      setDeletingBooking(null);
      setDeleteReason("");
      setDeleteComment("");
      refetch();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete booking",
        variant: "destructive",
      });
    },
  });
  
  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [dateFilter, phoneFilter, bookingDateFilter]);

  // Handle booking errors
  useEffect(() => {
    if (bookingsError && isUnauthorizedError(bookingsError)) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [bookingsError, toast]);

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
    return new Date(dateString).toLocaleDateString('en-IN');
  };

  // Compute booking status considering refunds and payments
  const getBookingStatus = (booking: any) => {
    const total = Number(booking.totalAmount || 0);
    const paid = Number(booking.cashAmount || 0) + Number(booking.upiAmount || 0);
    const refundStatus = booking.refundStatus as string | undefined;
    const refundAmount = Number(booking.refundAmount || 0);

    if (refundStatus === 'approved' && refundAmount > 0) {
      if (refundAmount >= total - 0.01) return 'full_refund';
      return 'partial_refund';
    }
    if (refundStatus === 'pending') return 'refund_pending';

    if (paid >= total - 0.01) return 'full_payment';
    return 'partial_payment';
  };

  const getBookingStatusLabel = (status: string) => {
    switch (status) {
      case 'full_refund': return 'Full Refund';
      case 'partial_refund': return 'Partial Refund';
      case 'refund_pending': return 'Refund Pending';
      case 'full_payment': return 'FP'; // Full Payment
      case 'partial_payment': return 'PP'; // Partial Payment
      default: return '—';
    }
  };

  const getBookingStatusClass = (status: string) => {
    switch (status) {
      case 'full_refund': return 'bg-red-600/20 text-red-400 border-red-600/30';
      case 'partial_refund': return 'bg-yellow-600/20 text-yellow-400 border-yellow-600/30';
      case 'refund_pending': return 'bg-orange-600/20 text-orange-400 border-orange-600/30';
      case 'full_payment': return 'bg-green-600/20 text-green-400 border-green-600/30';
      case 'partial_payment': return 'bg-yellow-600/20 text-yellow-400 border-yellow-600/30';
      default: return 'bg-gray-600/20 text-gray-300 border-gray-600/30';
    }
  };

  const handleEditBooking = (booking: any) => {
    setEditingBooking(booking);
    setIsEditModalOpen(true);
  };

  const handleDeleteBooking = (booking: any) => {
    setDeletingBooking(booking);
    setIsDeleteModalOpen(true);
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const totalPages = data?.pagination?.totalPages || 0;
  const currentBookings = data?.bookings || [];

  // Print functionality
  const handlePrint = () => {
    let bookingsToPrint = currentBookings;
    
    // Apply date range filter if set
    if (startDateFilter && endDateFilter) {
      bookingsToPrint = currentBookings.filter((booking: any) => {
        const bookingDate = new Date(booking.bookingDate);
        const startDate = new Date(startDateFilter);
        const endDate = new Date(endDateFilter);
        return bookingDate >= startDate && bookingDate <= endDate;
      });
    }

    // Create print content
    const printContent = `
      <html>
        <head>
          <title>ROSAE Theatre Bookings Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #dc2626; text-align: center; margin-bottom: 20px; }
            .date-range { text-align: center; margin-bottom: 20px; color: #666; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .status { padding: 2px 8px; border-radius: 4px; font-size: 12px; }
            .yes { background-color: #dcfce7; color: #166534; }
            .no { background-color: #fecaca; color: #991b1b; }
            .partial { background-color: #fef3c7; color: #92400e; }
            .payment-full { background-color: #dcfce7; color: #166534; }
            .payment-partial { background-color: #fef3c7; color: #92400e; }
            .refund-full { background-color: #fecaca; color: #991b1b; }
            .refund-partial { background-color: #fde68a; color: #92400e; }
            .refund-pending { background-color: #ffedd5; color: #9a3412; }
            .footer { margin-top: 30px; text-align: center; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <h1>ROSAE Theatre Bookings Report</h1>
          ${startDateFilter && endDateFilter ? 
            `<div class="date-range">Date Range: ${formatDate(startDateFilter)} to ${formatDate(endDateFilter)}</div>` :
            `<div class="date-range">All Bookings</div>`
          }
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Customer Name</th>
                <th>Theatre</th>
                <th>Time Slot</th>
                <th>Guests</th>
                <th>Phone</th>
                <th>18+</th>
                <th>Visited</th>
                <th>Repeat Count</th>
                <th>Total Amount</th>
                <th>Cash</th>
                <th>UPI</th>
                <th>Snacks Total</th>
                <th>Snacks Cash</th>
                <th>Snacks UPI</th>
                <th>Created By</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${bookingsToPrint.map((booking: any) => {
                const total = Number(booking.totalAmount || 0);
                const paid = Number(booking.cashAmount || 0) + Number(booking.upiAmount || 0);
                const refundStatus = booking.refundStatus as string | undefined;
                const refundAmount = Number(booking.refundAmount || 0);
                let status = 'Partial Payment';
                if (refundStatus === 'approved' && refundAmount > 0) {
                  status = refundAmount >= total - 0.01 ? 'Full Refund' : 'Partial Refund';
                } else if (refundStatus === 'pending') {
                  status = 'Refund Pending';
                } else if (paid >= total - 0.01) {
                  status = 'Full Payment';
                }
                const statusClass = status === 'Full Refund' ? 'refund-full'
                  : status === 'Partial Refund' ? 'refund-partial'
                  : status === 'Refund Pending' ? 'refund-pending'
                  : status === 'Full Payment' ? 'payment-full'
                  : 'payment-partial';
                return `
                <tr>
                  <td>${formatDate(booking.bookingDate)}</td>
                  <td>${booking.customerName || 'N/A'}</td>
                  <td>${booking.theatreName}</td>
                  <td>${booking.timeSlot}</td>
                  <td>${booking.guests}</td>
                  <td>${booking.phoneNumber || 'N/A'}</td>
                  <td><span class="status ${booking.isEighteenPlus ? 'yes' : 'no'}">${booking.isEighteenPlus ? 'Yes' : 'No'}</span></td>
                  <td><span class="status ${booking.visited ? 'yes' : 'no'}">${booking.visited ? 'Yes' : 'No'}</span></td>
                  <td>${booking.repeatCount || 0}</td>
                  <td>${formatCurrency(Number(booking.totalAmount))}</td>
                  <td>${formatCurrency(Number(booking.cashAmount))}</td>
                  <td>${formatCurrency(Number(booking.upiAmount))}</td>
                  <td>${formatCurrency(Number(booking.snacksAmount || 0))}</td>
                  <td>${formatCurrency(Number(booking.snacksCash || 0))}</td>
                  <td>${formatCurrency(Number(booking.snacksUpi || 0))}</td>
                  <td>${(booking.createdByName || booking.createdByEmail || booking.createdBy) ?? 'System'}</td>
                  <td><span class="status ${statusClass}">${status}</span></td>
                </tr>`
              }).join('')}
            </tbody>
          </table>
          <div class="footer">
            Generated on ${new Date().toLocaleDateString('en-IN')} | Total Bookings: ${bookingsToPrint.length}
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }
  };

  return (
    <Layout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-white" data-testid="text-page-title">All Bookings</h2>
            <p className="text-gray-400">Manage and view all theatre bookings</p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              onClick={async () => {
                try {
                  const res = await fetch('/api/calendar/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
                  const data = await res.json();
                  if (!res.ok || !data.ok) throw new Error(data.message || 'Sync failed');
                  toast({ title: 'Sync complete', description: `Scanned ${data.scanned}, created ${data.created}` });
                  refetch();
                } catch (e: any) {
                  toast({ title: 'Sync failed', description: e?.message || 'Unable to sync', variant: 'destructive' });
                }
              }}
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2"
              data-testid="button-sync-calendar"
            >
              <Calendar className="mr-2 w-4 h-4" />
              Sync from Calendar
            </Button>
            <Button 
              onClick={() => setIsBookingModalOpen(true)}
              className="bg-rosae-red hover:bg-rosae-dark-red px-6 py-2"
              data-testid="button-new-booking"
            >
              <Plus className="mr-2 w-4 h-4" />
              New Booking
            </Button>
          </div>
        </div>
        
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {(dateFilter || phoneFilter || bookingDateFilter || repeatCountFilter || startDateFilter || endDateFilter) && (
            <div className="col-span-full flex justify-between items-center">
              <Button
                onClick={handlePrint}
                className="bg-rosae-red hover:bg-rosae-dark-red px-6 py-2"
                data-testid="button-print-bookings"
              >
                <Printer className="mr-2 w-4 h-4" />
                Print Bookings
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setDateFilter("");
                  setPhoneFilter("");
                  setBookingDateFilter("");
                  setRepeatCountFilter("");
                  setStartDateFilter("");
                  setEndDateFilter("");
                }}
                className="border-gray-600 text-gray-300 hover:bg-gray-700"
                data-testid="button-clear-all-filters"
              >
                Clear All Filters
              </Button>
            </div>
          )}
          <div className="relative">
            <Input
              type="date"
              placeholder="Filter by date"
              className="bg-gray-800 border-gray-600 text-white pr-10"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              data-testid="input-date-filter"
            />
            {dateFilter && (
              <button 
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                onClick={() => setDateFilter("")}
                data-testid="button-clear-date-filter"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <span className="text-xs text-gray-400 mt-1 block">Filter by created date</span>
          </div>
          
          <div className="relative">
            <Input
              type="text"
              placeholder="Filter by phone number"
              className="bg-gray-800 border-gray-600 text-white pr-10"
              value={phoneFilter}
              onChange={(e) => setPhoneFilter(e.target.value)}
              data-testid="input-phone-filter"
            />
            {phoneFilter && (
              <button 
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                onClick={() => setPhoneFilter("")}
                data-testid="button-clear-phone-filter"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <span className="text-xs text-gray-400 mt-1 block">Filter by phone number</span>
          </div>
          
          <div className="relative">
            <Input
              type="date"
              placeholder="Filter by booking date"
              className="bg-gray-800 border-gray-600 text-white pr-10"
              value={bookingDateFilter}
              onChange={(e) => setBookingDateFilter(e.target.value)}
              data-testid="input-booking-date-filter"
            />
            {bookingDateFilter && (
              <button 
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                onClick={() => setBookingDateFilter("")}
                data-testid="button-clear-booking-date-filter"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <span className="text-xs text-gray-400 mt-1 block">Filter by booking date</span>
          </div>
          
          <div className="relative">
            <Input
              type="number"
              placeholder="Filter by repeat count"
              className="bg-gray-800 border-gray-600 text-white pr-10"
              value={repeatCountFilter}
              onChange={(e) => setRepeatCountFilter(e.target.value)}
              data-testid="input-repeat-count-filter"
            />
            {repeatCountFilter && (
              <button 
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                onClick={() => setRepeatCountFilter("")}
                data-testid="button-clear-repeat-count-filter"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <span className="text-xs text-gray-400 mt-1 block">Filter by repeat count</span>
          </div>
          
          {/* Date range filters row */}
          <div className="col-span-full grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Input
                type="date"
                placeholder="Start date"
                className="bg-gray-800 border-gray-600 text-white pr-10"
                value={startDateFilter}
                onChange={(e) => setStartDateFilter(e.target.value)}
                data-testid="input-start-date-filter"
              />
              {startDateFilter && (
                <button 
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                  onClick={() => setStartDateFilter("")}
                  data-testid="button-clear-start-date-filter"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <span className="text-xs text-gray-400 mt-1 block">Date range start</span>
            </div>
            
            <div className="relative">
              <Input
                type="date"
                placeholder="End date"
                className="bg-gray-800 border-gray-600 text-white pr-10"
                value={endDateFilter}
                onChange={(e) => setEndDateFilter(e.target.value)}
                data-testid="input-end-date-filter"
              />
              {endDateFilter && (
                <button 
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                  onClick={() => setEndDateFilter("")}
                  data-testid="button-clear-end-date-filter"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <span className="text-xs text-gray-400 mt-1 block">Date range end</span>
            </div>
          </div>
        </div>

        <Card className="bg-rosae-dark-gray border-gray-600">
          <CardContent className="p-6">
            {isBookingsLoading ? (
              <div className="flex items-center justify-center h-64 text-gray-400">
                Loading bookings...
              </div>
            ) : currentBookings && currentBookings.length > 0 ? (
              <div className="space-y-6">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-gray-400 text-sm border-b border-gray-600">
                        <th className="pb-3">Date</th>
                        <th className="pb-3">Customer Name</th>
                        <th className="pb-3">Theatre</th>
                        <th className="pb-3">Time Slot</th>
                        <th className="pb-3">Guests</th>
                        <th className="pb-3">Phone</th>
                        <th className="pb-3">18+</th>
                        <th className="pb-3">Visited</th>
                        <th className="pb-3">Repeat</th>
                        <th className="pb-3">Total Amount</th>
                        <th className="pb-3">Cash</th>
                        <th className="pb-3">UPI</th>
                        <th className="pb-3">Created By</th>
                        <th className="pb-3">Payment Status</th>
                        <th className="pb-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="text-white">
                      {currentBookings.map((booking: any) => {
                        const status = getBookingStatus(booking);
                        return (
                        <tr key={booking.id} className="border-b border-gray-700 hover:bg-gray-800/30 transition-colors" data-testid={`row-booking-${booking.id}`}>
                          <td className="py-4">
                            <div className="flex items-center">
                              <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                              <span className="text-sm">{formatDate(booking.bookingDate)}</span>
                            </div>
                          </td>
                          <td className="py-4 font-medium">{(() => { const name = booking.customerName || 'N/A'; const idx = name.toLowerCase().indexOf('paid'); return idx > 0 ? name.slice(0, idx).trim() : name; })()}</td>
                          <td className="py-4 font-medium">{booking.theatreName}</td>
                          <td className="py-4 text-gray-300 text-sm">{booking.timeSlot}</td>
                          <td className="py-4">
                            <div className="flex items-center">
                              <Users className="w-4 h-4 text-gray-400 mr-2" />
                              <span className="font-medium">{booking.guests}</span>
                            </div>
                          </td>
                          <td className="py-4">
                            <span className="text-sm">{booking.phoneNumber || 'N/A'}</span>
                          </td>
                          <td className="py-4">
                            <Badge className={booking.isEighteenPlus 
                              ? 'bg-green-600/20 text-green-400 border-green-600/30'
                              : 'bg-red-600/20 text-red-400 border-red-600/30'
                            }>
                              {booking.isEighteenPlus ? 'Y' : 'N'}
                            </Badge>
                          </td>
                          <td className="py-4">
                            <Badge className={booking.visited 
                              ? 'bg-green-600/20 text-green-400 border-green-600/30'
                              : 'bg-yellow-600/20 text-yellow-400 border-yellow-600/30'
                            }>
                              {booking.visited ? 'Y' : 'N'}
                            </Badge>
                          </td>
                          <td className="py-4">
                            <Badge className='bg-blue-600/20 text-blue-400 border-blue-600/30'>
                              {booking.repeatCount || 0}
                            </Badge>
                          </td>
                          <td className="py-4 font-semibold">
                            <div className="flex items-center">
                              <IndianRupee className="w-4 h-4 text-rosae-red mr-1" />
                              <span className="text-lg">{formatCurrency(Number(booking.totalAmount))}</span>
                            </div>
                          </td>
                          <td className="py-4 text-green-400 font-medium">{formatCurrency(Number(booking.cashAmount))}</td>
                          <td className="py-4 text-purple-400 font-medium">{formatCurrency(Number(booking.upiAmount))}</td>
                          <td className="py-4 text-sm text-gray-300">
                            {(() => {
                              const creator = booking.createdByName || booking.createdByEmail || booking.createdBy;
                              // If created via webhook/calendar, createdBy is null -> show System
                              return creator ? creator : 'System';
                            })()}
                          </td>
                          <td className="py-4">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge className={getBookingStatusClass(status)}>
                                    {getBookingStatusLabel(status)}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <span>{status === 'partial_payment' ? 'Partial Payment' : status === 'full_payment' ? 'Full Payment' : getBookingStatusLabel(status)}</span>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </td>
                          <td className="py-4">
                            <div className="flex space-x-2">
                              {!booking.reviewFlag && (
                                <>
                                  {/* CRL button with tooltip */}
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={async () => {
                                            try {
                                              const res = await fetch('/api/reviews/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookingId: booking.id }) });
                                              const data = await res.json();
                                              if (!res.ok) throw new Error(data.message || 'Failed to create review link');
                                              const base = window.location.origin;
                                              const tokenLink = `${base}/reviews?token=${encodeURIComponent(data.token)}`;
                                              await navigator.clipboard.writeText(tokenLink);
                                              alert('Review link copied to clipboard.');
                                            } catch (e: any) {
                                              alert(e?.message || 'Failed to copy review link');
                                            }
                                          }}
                                          className="border-sky-600/40 text-sky-300 hover:bg-sky-600/15 hover:text-sky-200 gap-2"
                                          data-testid={`button-review-copy-${booking.id}`}
                                        >
                                          <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor' className='w-4 h-4'><path d='M7.5 3.75A3.75 3.75 0 0 0 3.75 7.5v8.25a3.75 3.75 0 0 0 3.75 3.75h8.25a3.75 3.75 0 0 0 3.75-3.75V7.5a3.75 3.75 0 0 0-3.75-3.75H7.5Z'/><path d='M7.5 7.5A3.75 3.75 0 0 1 11.25 3.75H18a.75.75 0 0 1 0 1.5h-6.75A2.25 2.25 0 0 0 9 7.5V14.25a.75.75 0 0 1-1.5 0V7.5Z'/></svg>
                                          CRL
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        Copy Review Link
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>

                                  {/* CWL button with tooltip */}
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={async () => {
                                            try {
                                              const res = await fetch('/api/reviews/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookingId: booking.id }) });
                                              const data = await res.json();
                                              if (!res.ok) throw new Error(data.message || 'Failed to create review link');
                                              const base = window.location.origin;
                                              const tokenLink = `${base}/reviews?token=${encodeURIComponent(data.token)}`;
                                              const message = `Hi ${booking.customerName || ''}, please leave a review here: ${tokenLink}`.trim();
                                              const phone = (booking.phoneNumber || '').replace(/\D/g, '');
                                              const wa = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}` : `https://wa.me/?text=${encodeURIComponent(message)}`;
                                              await navigator.clipboard.writeText(wa);
                                              alert('WhatsApp link copied to clipboard. You can paste it in WhatsApp now.');
                                            } catch (e: any) {
                                              alert(e?.message || 'Failed to copy WhatsApp link');
                                            }
                                          }}
                                          className="border-emerald-600/40 text-emerald-300 hover:bg-emerald-600/15 hover:text-emerald-200 gap-2"
                                          data-testid={`button-review-wa-${booking.id}`}
                                        >
                                          <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor' className='w-4 h-4'><path d='M12 2.25c-5.385 0-9.75 4.365-9.75 9.75 0 1.694.438 3.286 1.208 4.677L2.25 21.75l5.25-1.208A9.708 9.708 0 0 0 12 21.75c5.385 0 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm4.19 13.352c-.213.6-1.253 1.14-1.75 1.197-.474.055-1.105.078-1.783-.109-.412-.111-.943-.304-1.626-.593-2.86-1.231-4.71-4.098-4.852-4.291-.141-.194-1.16-1.545-1.16-2.947 0-1.402.73-2.089.99-2.379.26-.29.566-.363.754-.363.188 0 .377.002.542.01.175.01.41-.066.642.49.213.529.727 1.832.792 1.964.065.132.108.289.02.464-.085.175-.129.289-.254.445-.129.152-.273.34-.39.457-.13.132-.265.274-.115.537.149.263.664 1.09 1.43 1.766.984.872 1.816 1.144 2.079 1.273.263.129.418.111.576-.066.158-.175.66-.77.837-1.035.175-.263.35-.219.586-.132.234.087 1.48.695 1.734.82.254.126.421.188.484.29.065.1.065.597-.148 1.197Z'/></svg>
                                          CWL
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        Copy WhatsApp Link
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </>
                              )}
                              {booking.reviewFlag && (
                                <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-green-600/40 bg-green-500/10 text-green-300 shadow-sm">
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.528L9.53 12.53a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.154-.114l3.736-5.54Z" clipRule="evenodd" /></svg>
                                  Review submitted
                                </span>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditBooking(booking)}
                                className="border-blue-600/50 text-blue-400 hover:bg-blue-600/20"
                                data-testid={`button-edit-${booking.id}`}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeleteBooking(booking)}
                                className="border-red-600/50 text-red-400 hover:bg-red-600/20"
                                data-testid={`button-delete-${booking.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {totalPages > 0 && (
                  <div className="flex flex-col gap-3 items-stretch justify-between py-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-400">
                        Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, data?.pagination?.total || 0)} of {data?.pagination?.total || 0} bookings
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-400">Per page:</span>
                        <select
                          value={pageSize}
                          onChange={(e) => { const v = Number(e.target.value) || 10; setPageSize(v); handlePageChange(1); }}
                          className="bg-gray-800 border border-gray-600 text-white text-sm rounded px-2 py-1"
                        >
                          <option value={10}>10</option>
                          <option value={20}>20</option>
                          <option value={50}>50</option>
                          <option value={100}>100</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 justify-between">
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handlePageChange(1)}
                          disabled={currentPage === 1}
                          className="border-gray-600 text-gray-300 hover:bg-gray-700"
                        >
                          First
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handlePageChange(currentPage - 1)}
                          disabled={currentPage === 1}
                          className="border-gray-600 text-gray-300 hover:bg-gray-700"
                          data-testid="button-prev-page"
                        >
                          <ChevronLeft className="w-4 h-4" />
                          Previous
                        </Button>

                        <div className="flex items-center gap-1">
                          {(() => {
                            const maxVisible = 5;
                            const total = totalPages;
                            let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
                            let end = Math.min(total, start + maxVisible - 1);
                            if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);
                            const buttons: any[] = [];
                            if (start > 1) {
                              buttons.push(
                                <Button key={1} size="sm" variant="outline" onClick={() => handlePageChange(1)} className="border-gray-600 text-gray-300 hover:bg-gray-700">1</Button>
                              );
                              if (start > 2) buttons.push(<span key="e1" className="text-gray-400 px-2">...</span>);
                            }
                            for (let i = start; i <= end; i++) {
                              buttons.push(
                                <Button
                                  key={i}
                                  size="sm"
                                  variant={i === currentPage ? "default" : "outline"}
                                  onClick={() => handlePageChange(i)}
                                  className={i === currentPage ? "bg-rosae-red hover:bg-rosae-dark-red" : "border-gray-600 text-gray-300 hover:bg-gray-700"}
                                >
                                  {i}
                                </Button>
                              );
                            }
                            if (end < total) {
                              if (end < total - 1) buttons.push(<span key="e2" className="text-gray-400 px-2">...</span>);
                              buttons.push(
                                <Button key={total} size="sm" variant="outline" onClick={() => handlePageChange(total)} className="border-gray-600 text-gray-300 hover:bg-gray-700">{total}</Button>
                              );
                            }
                            return buttons;
                          })()}
                        </div>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handlePageChange(currentPage + 1)}
                          disabled={currentPage === totalPages}
                          className="border-gray-600 text-gray-300 hover:bg-gray-700"
                          data-testid="button-next-page"
                        >
                          Next
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handlePageChange(totalPages)}
                          disabled={currentPage === totalPages}
                          className="border-gray-600 text-gray-300 hover:bg-gray-700"
                        >
                          Last
                        </Button>
                      </div>

                      {/* Quick jump */}
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-400">Go to page:</span>
                        <input
                          type="number"
                          min={1}
                          max={totalPages}
                          value={currentPage}
                          onChange={(e) => {
                            const v = Math.max(1, Math.min(totalPages, Number(e.target.value) || 1));
                            handlePageChange(v);
                          }}
                          className="bg-gray-800 border border-gray-600 text-white text-sm rounded px-2 py-1 w-16 text-center"
                        />
                        <span className="text-sm text-gray-400">of {totalPages}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : data && data.bookings && Array.isArray(data.bookings) && data.bookings.length > 0 && currentBookings.length === 0 ? (
              <div className="text-center py-16">
                <Search className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">No Matching Bookings</h3>
                <p className="text-gray-400 mb-6">Try adjusting your filters</p>
                <Button 
                  onClick={() => {
                    setDateFilter("");
                    setPhoneFilter("");
                    setBookingDateFilter("");
                  }}
                  variant="outline"
                  className="border-gray-600 text-gray-300 hover:bg-gray-700"
                  data-testid="button-clear-filters"
                >
                  Clear All Filters
                </Button>
              </div>
            ) : (
              <div className="text-center py-16">
                <Calendar className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">No Bookings Found</h3>
                <p className="text-gray-400 mb-6">Start by creating your first theatre booking</p>
                <Button 
                  onClick={() => setIsBookingModalOpen(true)}
                  className="bg-rosae-red hover:bg-rosae-dark-red"
                  data-testid="button-create-first-booking"
                >
                  <Plus className="mr-2 w-4 h-4" />
                  Create First Booking
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <BookingModal 
          isOpen={isBookingModalOpen} 
          onClose={() => setIsBookingModalOpen(false)}
          onSuccess={() => {
            refetch();
            setIsBookingModalOpen(false);
          }}
        />

        {/* Review Modal */}
        {reviewBooking && (
          <ReviewModal
            open={isReviewModalOpen}
            onOpenChange={(v) => setIsReviewModalOpen(v)}
            booking={reviewBooking}
            onConfirmed={() => {
              setIsReviewModalOpen(false);
              setReviewBooking(null);
              queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
              refetch();
            }}
          />
        )}

        {/* Edit Booking Modal */}
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent className="bg-rosae-dark-gray border-gray-600 text-white max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Booking</DialogTitle>
              <DialogDescription className="text-gray-400">
                Update booking details for {editingBooking?.theatreName}
              </DialogDescription>
            </DialogHeader>
            
            {editingBooking && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-300">Number of Guests</label>
                  <Input
                    type="number"
                    value={editingBooking.guests}
                    onChange={(e) => setEditingBooking({
                      ...editingBooking,
                      guests: parseInt(e.target.value) || 1
                    })}
                    className="bg-gray-800 border-gray-600 text-white mt-1"
                    data-testid="input-edit-guests"
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-300">Phone Number</label>
                  <Input
                    type="tel"
                    value={editingBooking.phoneNumber || ''}
                    onChange={(e) => setEditingBooking({
                      ...editingBooking,
                      phoneNumber: e.target.value
                    })}
                    className="bg-gray-800 border-gray-600 text-white mt-1"
                    data-testid="input-edit-phone"
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-300">Cash Amount</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editingBooking.cashAmount}
                    onChange={(e) => {
                      const cashAmount = parseFloat(e.target.value) || 0;
                      const upiAmount = Math.max(0, editingBooking.totalAmount - cashAmount);
                      setEditingBooking({
                        ...editingBooking,
                        cashAmount,
                        upiAmount
                      });
                    }}
                    className="bg-gray-800 border-gray-600 text-white mt-1"
                    data-testid="input-edit-cash"
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-300">UPI Amount</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editingBooking.upiAmount}
                    onChange={(e) => {
                      const upiAmount = parseFloat(e.target.value) || 0;
                      const cashAmount = Math.max(0, editingBooking.totalAmount - upiAmount);
                      setEditingBooking({
                        ...editingBooking,
                        upiAmount,
                        cashAmount
                      });
                    }}
                    className="bg-gray-800 border-gray-600 text-white mt-1"
                    data-testid="input-edit-upi"
                  />
                </div>
              </div>
            )}
            
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsEditModalOpen(false)}
                className="border-gray-600 text-gray-300 hover:bg-gray-700"
                data-testid="button-cancel-edit"
              >
                Cancel
              </Button>
              <Button
                onClick={() => editBookingMutation.mutate(editingBooking)}
                disabled={editBookingMutation.isPending}
                className="bg-rosae-red hover:bg-rosae-dark-red"
                data-testid="button-save-edit"
              >
                {editBookingMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Booking Modal */}
        <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
          <DialogContent className="bg-rosae-dark-gray border-gray-600 text-white max-w-md">
            <DialogHeader>
              <DialogTitle>Delete Booking</DialogTitle>
              <DialogDescription className="text-gray-400">
                Are you sure you want to delete this booking? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-300">Reason for deletion *</label>
                <Select value={deleteReason} onValueChange={setDeleteReason}>
                  <SelectTrigger className="bg-gray-800 border-gray-600 text-white mt-1" data-testid="select-delete-reason">
                    <SelectValue placeholder="Select a reason" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-600">
                    <SelectItem value="Cancellation">Cancellation</SelectItem>
                    <SelectItem value="Reschedule">Reschedule</SelectItem>
                    <SelectItem value="By mistake">By mistake</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-300">Additional comments (optional)</label>
                <Textarea
                  value={deleteComment}
                  onChange={(e) => setDeleteComment(e.target.value)}
                  placeholder="Add any additional details..."
                  className="bg-gray-800 border-gray-600 text-white mt-1 resize-none"
                  rows={3}
                  data-testid="textarea-delete-comment"
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setDeleteReason('');
                  setDeleteComment('');
                }}
                className="border-gray-600 text-gray-300 hover:bg-gray-700"
                data-testid="button-cancel-delete"
              >
                Cancel
              </Button>
              <Button
                onClick={() => deleteBookingMutation.mutate({ 
                  bookingId: deletingBooking.id, 
                  reason: deleteReason, 
                  comment: deleteComment 
                })}
                disabled={!deleteReason || deleteBookingMutation.isPending}
                className="bg-red-600 hover:bg-red-700"
                data-testid="button-confirm-delete"
              >
                {deleteBookingMutation.isPending ? 'Deleting...' : 'Delete Booking'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
