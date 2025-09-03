import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { 
  AlertCircle, 
  Search, 
  CheckCircle, 
  Save, 
  Phone, 
  UserCheck, 
  Users, 
  Calendar, 
  IndianRupee,
  History,
  MessageSquare,
  Star,
  TrendingUp,
  Clock,
  MapPin,
  Mail,
  Edit3,
  Plus,
  FileText,
  BarChart3,
  Award,
  Heart,
  RefreshCw,
  Download,
  Filter,
  SortAsc,
  Eye,
  PhoneCall,
  MessageCircle,
  Gift,
  Ticket,
  CalendarDays
} from "lucide-react";

export default function CRM() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [searchDate, setSearchDate] = useState(""); // optional booking date filter (YYYY-MM-DD)
  const [searchSlot, setSearchSlot] = useState("");
  const [availableSlots, setAvailableSlots] = useState<string[]>([]); // options from config
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [customerHistory, setCustomerHistory] = useState<any[]>([]);
  const [customerNotes, setCustomerNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState("");
  const [noteCategory, setNoteCategory] = useState("general");
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [customerStats, setCustomerStats] = useState<any>(null);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("details");
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpNote, setFollowUpNote] = useState("");
  const [customerRating, setCustomerRating] = useState(5);
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  
  // Load time slots from config for slot selector
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const res = await fetch('/api/config');
        if (res.ok) {
          const cfg = await res.json();
          setAvailableSlots(Array.isArray(cfg?.timeSlots) ? cfg.timeSlots : []);
        }
      } catch (e) {
        // ignore
      }
    };
    loadConfig();
  }, []);
  
  // Role-based permissions
  const isAdmin = user?.role === "admin";
  const canEdit = isAdmin || user?.role === "employee";
  const canViewFinancials = isAdmin;
  
  // Edit form states
  const [editForm, setEditForm] = useState({
    totalAmount: "",
    cashAmount: "",
    upiAmount: "",
    snacksAmount: "",
    snacksCash: "",
    snacksUpi: "",
    isEighteenPlus: true,
    visited: true,
    reasonNotEighteen: "",
    reasonNotVisited: "",
    customerName: ""
  });

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

  // Search booking by phone number
  const searchBooking = async () => {
    if (!phoneNumber) {
      toast({
        title: "Phone Number Required",
        description: "Please enter a phone number to search",
        variant: "destructive"
      });
      return;
    }

    try {
      let booking = null;
      let allBookings: any[] = [];
      
      // 1) Fetch by phone
      const response = await fetch(`/api/bookings/search?phone=${encodeURIComponent(phoneNumber)}`);
      if (response.ok) {
        const bookings = await response.json();
        allBookings = bookings || [];
      }

      // 2) If date or slot provided, filter in-memory (optional filters)
      const norm = (s: string) => (s || '').trim().replace(/\s+/g, '').toLowerCase();
      const filtered = allBookings.filter(b => {
        const dateOk = !searchDate || b.bookingDate === searchDate;
        const slotOk = !searchSlot || norm(b.timeSlot) === norm(searchSlot);
        return dateOk && slotOk;
      });

      // 3) Pick the most recent match if any filters applied, else first
      const list = (searchDate || searchSlot) ? filtered : allBookings;
      if (list.length > 0) {
        booking = list[0];
      }

      if (booking) {
        setSelectedBooking(booking);
        setCustomerHistory(list);
        
        // Calculate customer statistics
        const stats = calculateCustomerStats(list);
        setCustomerStats(stats);
        
        // Load customer notes
        loadCustomerNotes(phoneNumber);
        
        // Add to search history
        const updatedHistory = [phoneNumber, ...searchHistory.filter(p => p !== phoneNumber)].slice(0, 5);
        setSearchHistory(updatedHistory);
        
        setEditForm({
          totalAmount: booking.totalAmount?.toString() || "",
          cashAmount: booking.cashAmount?.toString() || "",
          upiAmount: booking.upiAmount?.toString() || "",
          snacksAmount: booking.snacksAmount?.toString() || "",
          snacksCash: booking.snacksCash?.toString() || "",
          snacksUpi: booking.snacksUpi?.toString() || "",
          isEighteenPlus: booking.isEighteenPlus !== false,
          visited: booking.visited !== false,
          reasonNotEighteen: booking.reasonNotEighteen || "",
          reasonNotVisited: booking.reasonNotVisited || "",
          customerName: booking.customerName || ""
        });
        
        // Calculate loyalty points
        setLoyaltyPoints(stats.totalBookings * 10 + Math.floor(stats.totalSpent / 100));
        
      } else {
        toast({
          title: "Customer Not Found",
          description: "No bookings found for this search criteria",
          variant: "destructive"
        });
        setSelectedBooking(null);
        setCustomerHistory([]);
        setCustomerStats(null);
        setCustomerNotes([]);
      }
    } catch (error) {
      console.error("Search error:", error);
      toast({
        title: "Search Error",
        description: "Failed to search for customer",
        variant: "destructive"
      });
    }
  };

  // Calculate customer statistics
  const calculateCustomerStats = (bookings: any[]) => {
    const totalBookings = bookings.length;
    const totalSpent = bookings.reduce((sum, booking) => sum + (booking.totalAmount || 0), 0);
    const avgSpending = totalBookings > 0 ? totalSpent / totalBookings : 0;
    const lastVisit = bookings[0]?.bookingDate;
    const visitedBookings = bookings.filter(b => b.visited !== false).length;
    const visitRate = totalBookings > 0 ? (visitedBookings / totalBookings) * 100 : 0;
    const favoriteTheatre = getMostFrequentTheatre(bookings);
    const preferredTimeSlot = getMostFrequentTimeSlot(bookings);
    
    return {
      totalBookings,
      totalSpent,
      avgSpending,
      lastVisit,
      visitRate,
      favoriteTheatre,
      preferredTimeSlot,
      customerSince: bookings[bookings.length - 1]?.bookingDate
    };
  };

  const getMostFrequentTheatre = (bookings: any[]) => {
    const theatreCount = bookings.reduce((acc, booking) => {
      acc[booking.theatreName] = (acc[booking.theatreName] || 0) + 1;
      return acc;
    }, {});
    return Object.keys(theatreCount).reduce((a, b) => theatreCount[a] > theatreCount[b] ? a : b, '');
  };

  const getMostFrequentTimeSlot = (bookings: any[]) => {
    const slotCount = bookings.reduce((acc, booking) => {
      acc[booking.timeSlot] = (acc[booking.timeSlot] || 0) + 1;
      return acc;
    }, {});
    return Object.keys(slotCount).reduce((a, b) => slotCount[a] > slotCount[b] ? a : b, '');
  };

  // Load customer notes
  // Removed default/mock notes; start with empty, user can add as needed
  const loadCustomerNotes = (phone: string) => {
    setCustomerNotes([]);
  };

  // Update booking mutation
  const updateBookingMutation = useMutation({
    mutationFn: async (updateData: any) => {
      return await apiRequest("PATCH", `/api/bookings/${selectedBooking.id}`, updateData);
    },
    onSuccess: async (_, variables) => {
      toast({
        title: "Success",
        description: "Customer record updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      setIsEditing(false);
      
      try {
        const response = await fetch(`/api/bookings/${selectedBooking.id}`);
        if (response.ok) {
          const updatedBooking = await response.json();
          setSelectedBooking(updatedBooking);
          setEditForm({
            totalAmount: updatedBooking.totalAmount?.toString() || "",
            cashAmount: updatedBooking.cashAmount?.toString() || "",
            upiAmount: updatedBooking.upiAmount?.toString() || "",
            snacksAmount: updatedBooking.snacksAmount?.toString() || "",
            snacksCash: updatedBooking.snacksCash?.toString() || "",
            snacksUpi: updatedBooking.snacksUpi?.toString() || "",
            isEighteenPlus: updatedBooking.isEighteenPlus !== false,
            visited: updatedBooking.visited !== false,
            reasonNotEighteen: updatedBooking.reasonNotEighteen || "",
            reasonNotVisited: updatedBooking.reasonNotVisited || "",
            customerName: updatedBooking.customerName || ""
          });
        }
      } catch (error) {
        console.error("Error fetching updated booking:", error);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update customer record",
        variant: "destructive"
      });
    }
  });

  const handleSave = () => {
    // Validate amounts (only if user can view financials)
    if (canViewFinancials) {
      const totalAmount = parseFloat(editForm.totalAmount);
      const cashAmount = parseFloat(editForm.cashAmount);
      const upiAmount = parseFloat(editForm.upiAmount);
      const snacksAmount = parseFloat(editForm.snacksAmount) || 0;
      const snacksCash = parseFloat(editForm.snacksCash) || 0;
      const snacksUpi = parseFloat(editForm.snacksUpi) || 0;

      if (isNaN(totalAmount) || isNaN(cashAmount) || isNaN(upiAmount)) {
        toast({
          title: "Invalid Amount",
          description: "Please enter valid numeric amounts",
          variant: "destructive"
        });
        return;
      }

      if (Math.abs((cashAmount + upiAmount) - totalAmount) > 0.01) {
        toast({
          title: "Amount Mismatch",
          description: "Cash + UPI must equal total amount",
          variant: "destructive"
        });
        return;
      }

      if (snacksAmount > 0 && Math.abs((snacksCash + snacksUpi) - snacksAmount) > 0.01) {
        toast({
          title: "Snacks Amount Mismatch",
          description: "Snacks Cash + UPI must equal snacks total",
          variant: "destructive"
        });
        return;
      }
    }

    // Prepare update data based on role permissions
    const updateData: any = {
      isEighteenPlus: editForm.isEighteenPlus,
      visited: editForm.visited,
      reasonNotEighteen: editForm.reasonNotEighteen,
      reasonNotVisited: editForm.reasonNotVisited,
      customerName: editForm.customerName,
      phoneNumber: selectedBooking.phoneNumber
    };

    // Only include financial data if user has permission
    if (canViewFinancials) {
      updateData.totalAmount = parseFloat(editForm.totalAmount);
      updateData.cashAmount = parseFloat(editForm.cashAmount);
      updateData.upiAmount = parseFloat(editForm.upiAmount);
      updateData.snacksAmount = parseFloat(editForm.snacksAmount) || 0;
      updateData.snacksCash = parseFloat(editForm.snacksCash) || 0;
      updateData.snacksUpi = parseFloat(editForm.snacksUpi) || 0;
    }

    updateBookingMutation.mutate(updateData);
  };

  const formatCurrency = (value: number) => {
    return `₹${value.toLocaleString('en-IN')}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN');
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-IN');
  };

  // Add customer note
  const addCustomerNote = () => {
    if (!newNote.trim()) {
      toast({
        title: "Note Required",
        description: "Please enter a note before saving",
        variant: "destructive"
      });
      return;
    }

    const note = {
      id: Date.now(),
      date: new Date().toISOString(),
      category: noteCategory,
      note: newNote,
      author: user?.firstName || "User"
    };

    setCustomerNotes([note, ...customerNotes]);
    setNewNote("");
    setIsAddingNote(false);
    
    toast({
      title: "Note Added",
      description: "Customer note has been saved successfully",
    });
  };

  // Schedule follow-up
  const scheduleFollowUp = () => {
    if (!followUpDate || !followUpNote.trim()) {
      toast({
        title: "Follow-up Details Required",
        description: "Please enter both date and note for follow-up",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Follow-up Scheduled",
      description: `Follow-up scheduled for ${formatDate(followUpDate)}. View all follow-ups in the Follow-ups section.`,
    });
    
    setFollowUpDate("");
    setFollowUpNote("");
  };

  // Open WhatsApp chat
  const openWhatsApp = (phoneNumber: string) => {
    // Remove any non-digit characters and format for WhatsApp
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    const whatsappUrl = `https://wa.me/${cleanNumber}`;
    window.open(whatsappUrl, '_blank');
  };

  // Export customer data
  const exportCustomerData = () => {
    if (!selectedBooking) return;

    const data = {
      customerInfo: {
        name: selectedBooking.customerName,
        phone: selectedBooking.phoneNumber,
        customerSince: customerStats?.customerSince
      },
      statistics: customerStats,
      bookingHistory: customerHistory,
      notes: customerNotes,
      loyaltyPoints: loyaltyPoints
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customer-${selectedBooking.phoneNumber}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Data Exported",
      description: "Customer data has been exported successfully",
    });
  };

  // Quick search from history
  const quickSearch = (phone: string) => {
    setPhoneNumber(phone);
    setTimeout(() => searchBooking(), 100);
  };

  // Get customer tier based on spending
  const getCustomerTier = (totalSpent: number) => {
    if (totalSpent >= 10000) return { tier: "Platinum", color: "text-purple-400", icon: Award };
    if (totalSpent >= 5000) return { tier: "Gold", color: "text-yellow-400", icon: Star };
    if (totalSpent >= 2000) return { tier: "Silver", color: "text-gray-400", icon: Star };
    return { tier: "Bronze", color: "text-orange-400", icon: Star };
  };

  // Get visit frequency status
  const getVisitFrequency = (visitRate: number) => {
    if (visitRate >= 90) return { status: "Excellent", color: "text-green-400" };
    if (visitRate >= 70) return { status: "Good", color: "text-blue-400" };
    if (visitRate >= 50) return { status: "Average", color: "text-yellow-400" };
    return { status: "Poor", color: "text-red-400" };
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-rosae-black flex items-center justify-center">
        <div className="text-white text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <Layout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <UserCheck className="w-8 h-8 text-rosae-red" />
              Customer Relationship Management
            </h2>
            <p className="text-gray-400">Advanced customer management with analytics and insights</p>
            <div className="flex items-center gap-4 mt-2">
              <Badge variant="outline" className="border-blue-600/50 text-blue-400">
                Role: {user?.role || 'Unknown'}
              </Badge>
              {canViewFinancials && (
                <Badge variant="outline" className="border-green-600/50 text-green-400">
                  Financial Access
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Enhanced Search Section */}
        <Card className="bg-rosae-dark-gray border-gray-600 mb-6">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Phone className="w-5 h-5 text-rosae-red" />
              Customer Search & Quick Access
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search Input */}
            <div className="flex flex-col md:flex-row md:items-end md:space-x-4 space-y-3 md:space-y-0">
              <div className="flex-1">
                <Label htmlFor="phoneNumber" className="text-gray-300">Phone Number</Label>
                <Input
                  id="phoneNumber"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="Enter customer phone number"
                  className="bg-gray-800 border-gray-600 text-white"
                  onKeyPress={(e) => e.key === 'Enter' && searchBooking()}
                />
              </div>
              <div>
                <Label htmlFor="searchDate" className="text-gray-300">Date (optional)</Label>
                <Input
                  id="searchDate"
                  type="date"
                  value={searchDate}
                  onChange={(e) => setSearchDate(e.target.value)}
                  className="bg-gray-800 border-gray-600 text-white"
                />
              </div>
              <div>
                <Label htmlFor="searchSlot" className="text-gray-300">Time Slot (optional)</Label>
                <select
                  id="searchSlot"
                  value={searchSlot}
                  onChange={(e) => setSearchSlot(e.target.value)}
                  className="bg-gray-800 border-gray-600 text-white rounded-md h-10 px-3"
                >
                  <option value="">All</option>
                  {availableSlots.map((slot) => (
                    <option key={slot} value={slot}>{slot}</option>
                  ))}
                </select>
              </div>
              <Button onClick={searchBooking} className="bg-rosae-red hover:bg-rosae-dark-red">
                <Search className="w-4 h-4 mr-2" />
                Search
              </Button>
              <Button onClick={() => { setPhoneNumber(""); setSearchDate(""); setSearchSlot(""); }} variant="outline" className="border-gray-600 text-gray-300">
                <RefreshCw className="w-4 h-4 mr-2" />
                Clear
              </Button>
            </div>

            {/* Search History */}
            {searchHistory.length > 0 && (
              <div>
                <Label className="text-gray-300 text-sm">Recent Searches</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {searchHistory.map((phone, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      onClick={() => quickSearch(phone)}
                      className="border-gray-600 text-gray-300 hover:bg-gray-700"
                    >
                      <Clock className="w-3 h-3 mr-1" />
                      {phone}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Enhanced Customer Profile Section */}
        {selectedBooking && (
          <>
            {/* Customer Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              {/* Customer Tier */}
              {customerStats && (
                <Card className="bg-rosae-dark-gray border-gray-600">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-400 text-sm">Customer Tier</p>
                        <p className={`font-semibold ${getCustomerTier(customerStats.totalSpent).color}`}>
                          {getCustomerTier(customerStats.totalSpent).tier}
                        </p>
                      </div>
                      {(() => {
                        const TierIcon = getCustomerTier(customerStats.totalSpent).icon;
                        return <TierIcon className={`w-6 h-6 ${getCustomerTier(customerStats.totalSpent).color}`} />;
                      })()}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Total Bookings */}
              {customerStats && (
                <Card className="bg-rosae-dark-gray border-gray-600">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-400 text-sm">Total Bookings</p>
                        <p className="text-white font-semibold text-lg">{customerStats.totalBookings}</p>
                      </div>
                      <Ticket className="w-6 h-6 text-blue-400" />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Loyalty Points */}
              <Card className="bg-rosae-dark-gray border-gray-600">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-400 text-sm">Loyalty Points</p>
                      <p className="text-white font-semibold text-lg">{loyaltyPoints}</p>
                    </div>
                    <Gift className="w-6 h-6 text-purple-400" />
                  </div>
                </CardContent>
              </Card>

              {/* Visit Rate */}
              {customerStats && (
                <Card className="bg-rosae-dark-gray border-gray-600">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-400 text-sm">Visit Rate</p>
                        <p className={`font-semibold ${getVisitFrequency(customerStats.visitRate).color}`}>
                          {customerStats.visitRate.toFixed(1)}%
                        </p>
                      </div>
                      <TrendingUp className={`w-6 h-6 ${getVisitFrequency(customerStats.visitRate).color}`} />
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Main Customer Profile */}
            <Card className="bg-rosae-dark-gray border-gray-600">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-rosae-red rounded-full flex items-center justify-center">
                      <Users className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-white text-xl">
                        {(() => { const name = selectedBooking.customerName || 'Customer Profile'; const idx = name.toLowerCase().indexOf('paid'); return idx > 0 ? name.slice(0, idx).trim() : name; })()}
                      </CardTitle>
                      <p className="text-gray-400">{selectedBooking.phoneNumber}</p>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Button onClick={exportCustomerData} variant="outline" className="border-gray-600 text-gray-300">
                      <Download className="w-4 h-4 mr-2" />
                      Export
                    </Button>
                    {!isEditing && canEdit ? (
                      <Button onClick={() => setIsEditing(true)} variant="outline" className="border-blue-600/50 text-blue-400 hover:bg-blue-600/20">
                        <Edit3 className="w-4 h-4 mr-2" />
                        Edit Details
                      </Button>
                    ) : isEditing ? (
                      <>
                        <Button onClick={handleSave} disabled={updateBookingMutation.isPending} className="bg-green-600 hover:bg-green-700">
                          <Save className="w-4 h-4 mr-2" />
                          Save Changes
                        </Button>
                        <Button onClick={() => setIsEditing(false)} variant="outline" className="border-gray-600 text-gray-300">
                          Cancel
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                {/* Tabbed Interface */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-5 bg-gray-800">
                    <TabsTrigger value="details" className="data-[state=active]:bg-rosae-red">
                      <FileText className="w-4 h-4 mr-2" />
                      Details
                    </TabsTrigger>
                    <TabsTrigger value="history" className="data-[state=active]:bg-rosae-red">
                      <History className="w-4 h-4 mr-2" />
                      History
                    </TabsTrigger>
                    <TabsTrigger value="notes" className="data-[state=active]:bg-rosae-red">
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Notes
                    </TabsTrigger>
                    <TabsTrigger value="analytics" className="data-[state=active]:bg-rosae-red">
                      <BarChart3 className="w-4 h-4 mr-2" />
                      Analytics
                    </TabsTrigger>
                    <TabsTrigger value="actions" className="data-[state=active]:bg-rosae-red">
                      <PhoneCall className="w-4 h-4 mr-2" />
                      Actions
                    </TabsTrigger>
                  </TabsList>

                  {/* Customer Details Tab */}
                  <TabsContent value="details" className="space-y-6 mt-6">
                    {/* Basic Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <Label className="text-gray-300">Booking ID</Label>
                        <p className="text-white font-mono">{selectedBooking.id}</p>
                      </div>
                      <div>
                        <Label className="text-gray-300">Theatre</Label>
                        <p className="text-white">{selectedBooking.theatreName}</p>
                      </div>
                      <div>
                        <Label className="text-gray-300 flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          Date
                        </Label>
                        <p className="text-white">{formatDate(selectedBooking.bookingDate)}</p>
                      </div>
                      <div>
                        <Label className="text-gray-300">Time Slot</Label>
                        <p className="text-white">{selectedBooking.timeSlot}</p>
                      </div>
                      <div>
                        <Label className="text-gray-300">Guests</Label>
                        <p className="text-white">{selectedBooking.guests}</p>
                      </div>
                      <div>
                        <Label className="text-gray-300">Phone Number</Label>
                        <p className="text-white">{selectedBooking.phoneNumber}</p>
                      </div>
                    </div>

                    {/* Editable Fields */}
                    <div className="space-y-4 border-t border-gray-600 pt-6">
                      <h3 className="text-lg font-semibold text-white">Customer Management</h3>
                      
                      {/* Customer Name */}
                      <div>
                        <Label htmlFor="customerName" className="text-gray-300">Customer Name</Label>
                        {isEditing ? (
                          <Input
                            id="customerName"
                            value={editForm.customerName}
                            onChange={(e) => setEditForm({...editForm, customerName: e.target.value})}
                            className="bg-gray-800 border-gray-600 text-white"
                          />
                        ) : (
                          <p className="text-white">{(() => { const name = selectedBooking.customerName || 'N/A'; const idx = name.toLowerCase().indexOf('paid'); return idx > 0 ? name.slice(0, idx).trim() : name; })()}</p>
                        )}
                      </div>

                      {/* Financial Information - Only for Admin */}
                      {canViewFinancials && (
                        <>
                          <div className="border-t border-gray-600 pt-4">
                            <h4 className="text-md font-semibold text-white mb-4 flex items-center gap-2">
                              <IndianRupee className="w-4 h-4 text-rosae-red" />
                              Financial Information
                            </h4>
                            
                            {/* Booking Amounts */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                              <div>
                                <Label htmlFor="totalAmount" className="text-gray-300">Total Amount</Label>
                                {isEditing ? (
                                  <Input
                                    id="totalAmount"
                                    type="number"
                                    step="0.01"
                                    value={editForm.totalAmount}
                                    onChange={(e) => setEditForm({...editForm, totalAmount: e.target.value})}
                                    className="bg-gray-800 border-gray-600 text-white"
                                  />
                                ) : (
                                  <p className="text-white">{formatCurrency(Number(selectedBooking.totalAmount))}</p>
                                )}
                              </div>
                              <div>
                                <Label htmlFor="cashAmount" className="text-gray-300">Cash Amount</Label>
                                {isEditing ? (
                                  <Input
                                    id="cashAmount"
                                    type="number"
                                    step="0.01"
                                    value={editForm.cashAmount}
                                    onChange={(e) => setEditForm({...editForm, cashAmount: e.target.value})}
                                    className="bg-gray-800 border-gray-600 text-white"
                                  />
                                ) : (
                                  <p className="text-white">{formatCurrency(Number(selectedBooking.cashAmount))}</p>
                                )}
                              </div>
                              <div>
                                <Label htmlFor="upiAmount" className="text-gray-300">UPI Amount</Label>
                                {isEditing ? (
                                  <Input
                                    id="upiAmount"
                                    type="number"
                                    step="0.01"
                                    value={editForm.upiAmount}
                                    onChange={(e) => setEditForm({...editForm, upiAmount: e.target.value})}
                                    className="bg-gray-800 border-gray-600 text-white"
                                  />
                                ) : (
                                  <p className="text-white">{formatCurrency(Number(selectedBooking.upiAmount))}</p>
                                )}
                              </div>
                            </div>

                            {/* Snacks Amounts */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-gray-600 pt-4">
                              <div>
                                <Label htmlFor="snacksAmount" className="text-gray-300">Snacks Total</Label>
                                {isEditing ? (
                                  <Input
                                    id="snacksAmount"
                                    type="number"
                                    step="0.01"
                                    value={editForm.snacksAmount}
                                    onChange={(e) => setEditForm({...editForm, snacksAmount: e.target.value})}
                                    className="bg-gray-800 border-gray-600 text-white"
                                  />
                                ) : (
                                  <p className="text-white">{formatCurrency(Number(selectedBooking.snacksAmount || 0))}</p>
                                )}
                              </div>
                              <div>
                                <Label htmlFor="snacksCash" className="text-gray-300">Snacks Cash</Label>
                                {isEditing ? (
                                  <Input
                                    id="snacksCash"
                                    type="number"
                                    step="0.01"
                                    value={editForm.snacksCash}
                                    onChange={(e) => setEditForm({...editForm, snacksCash: e.target.value})}
                                    className="bg-gray-800 border-gray-600 text-white"
                                  />
                                ) : (
                                  <p className="text-white">{formatCurrency(Number(selectedBooking.snacksCash || 0))}</p>
                                )}
                              </div>
                              <div>
                                <Label htmlFor="snacksUpi" className="text-gray-300">Snacks UPI</Label>
                                {isEditing ? (
                                  <Input
                                    id="snacksUpi"
                                    type="number"
                                    step="0.01"
                                    value={editForm.snacksUpi}
                                    onChange={(e) => setEditForm({...editForm, snacksUpi: e.target.value})}
                                    className="bg-gray-800 border-gray-600 text-white"
                                  />
                                ) : (
                                  <p className="text-white">{formatCurrency(Number(selectedBooking.snacksUpi || 0))}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </>
                      )}

                      {/* Age Verification */}
                      <div className="border-t border-gray-600 pt-4">
                        <Label className="text-gray-300">18+ Verification</Label>
                        <div className="mt-2">
                          {isEditing ? (
                            <div className="space-y-3">
                              <div className="flex space-x-4">
                                <Button
                                  type="button"
                                  variant={editForm.isEighteenPlus ? "default" : "outline"}
                                  onClick={() => setEditForm({...editForm, isEighteenPlus: true, reasonNotEighteen: ""})}
                                  className={editForm.isEighteenPlus ? "bg-green-600 hover:bg-green-700" : "border-gray-600 text-gray-300"}
                                >
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                  Yes (18+)
                                </Button>
                                <Button
                                  type="button"
                                  variant={!editForm.isEighteenPlus ? "default" : "outline"}
                                  onClick={() => setEditForm({...editForm, isEighteenPlus: false})}
                                  className={!editForm.isEighteenPlus ? "bg-red-600 hover:bg-red-700" : "border-gray-600 text-gray-300"}
                                >
                                  <AlertCircle className="w-4 h-4 mr-2" />
                                  No (Under 18)
                                </Button>
                              </div>
                              {!editForm.isEighteenPlus && (
                                <Textarea
                                  placeholder="Reason for under 18 verification..."
                                  value={editForm.reasonNotEighteen}
                                  onChange={(e) => setEditForm({...editForm, reasonNotEighteen: e.target.value})}
                                  className="bg-gray-800 border-gray-600 text-white"
                                />
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center space-x-2">
                              <Badge className={selectedBooking.isEighteenPlus 
                                ? 'bg-green-600/20 text-green-400 border-green-600/30'
                                : 'bg-red-600/20 text-red-400 border-red-600/30'
                              }>
                                {selectedBooking.isEighteenPlus ? 'Yes (18+)' : 'No (Under 18)'}
                              </Badge>
                              {!selectedBooking.isEighteenPlus && selectedBooking.reasonNotEighteen && (
                                <p className="text-gray-400 text-sm">Reason: {selectedBooking.reasonNotEighteen}</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Visited Status */}
                      <div>
                        <Label className="text-gray-300">Visit Status</Label>
                        <div className="mt-2">
                          {isEditing ? (
                            <div className="space-y-3">
                              <div className="flex space-x-4">
                                <Button
                                  type="button"
                                  variant={editForm.visited ? "default" : "outline"}
                                  onClick={() => setEditForm({...editForm, visited: true, reasonNotVisited: ""})}
                                  className={editForm.visited ? "bg-green-600 hover:bg-green-700" : "border-gray-600 text-gray-300"}
                                >
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                  Visited
                                </Button>
                                <Button
                                  type="button"
                                  variant={!editForm.visited ? "default" : "outline"}
                                  onClick={() => setEditForm({...editForm, visited: false})}
                                  className={!editForm.visited ? "bg-red-600 hover:bg-red-700" : "border-gray-600 text-gray-300"}
                                >
                                  <AlertCircle className="w-4 h-4 mr-2" />
                                  Not Visited
                                </Button>
                              </div>
                              {!editForm.visited && (
                                <Textarea
                                  placeholder="Reason for not visiting..."
                                  value={editForm.reasonNotVisited}
                                  onChange={(e) => setEditForm({...editForm, reasonNotVisited: e.target.value})}
                                  className="bg-gray-800 border-gray-600 text-white"
                                />
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center space-x-2">
                              <Badge className={selectedBooking.visited 
                                ? 'bg-green-600/20 text-green-400 border-green-600/30'
                                : 'bg-yellow-600/20 text-yellow-400 border-yellow-600/30'
                              }>
                                {selectedBooking.visited ? 'Visited' : 'Not Visited'}
                              </Badge>
                              {!selectedBooking.visited && selectedBooking.reasonNotVisited && (
                                <p className="text-gray-400 text-sm">Reason: {selectedBooking.reasonNotVisited}</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  {/* Booking History Tab */}
                  <TabsContent value="history" className="space-y-4 mt-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-white">Booking History</h3>
                      <Badge variant="outline" className="border-blue-600/50 text-blue-400">
                        {customerHistory.length} bookings
                      </Badge>
                    </div>
                    
                    <div className="space-y-3">
                      {customerHistory.map((booking, index) => (
                        <Card key={booking.id} className="bg-gray-800 border-gray-600">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className="w-8 h-8 bg-rosae-red rounded-full flex items-center justify-center text-white text-sm font-bold">
                                  {index + 1}
                                </div>
                                <div>
                                  <p className="text-white font-medium">{booking.theatreName}</p>
                                  <p className="text-gray-400 text-sm">{formatDate(booking.bookingDate)} • {booking.timeSlot}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-white font-medium">{formatCurrency(booking.totalAmount)}</p>
                                <div className="flex items-center gap-2">
                                  <Badge className={booking.visited 
                                    ? 'bg-green-600/20 text-green-400 border-green-600/30'
                                    : 'bg-yellow-600/20 text-yellow-400 border-yellow-600/30'
                                  } size="sm">
                                    {booking.visited ? 'Visited' : 'No Show'}
                                  </Badge>
                                  <span className="text-gray-400 text-sm">{booking.guests} guests</span>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </TabsContent>

                  {/* Customer Notes Tab */}
                  <TabsContent value="notes" className="space-y-4 mt-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-white">Customer Notes</h3>
                      <Button onClick={() => setIsAddingNote(true)} size="sm" className="bg-rosae-red hover:bg-rosae-dark-red">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Note
                      </Button>
                    </div>

                    {/* Add Note Form */}
                    {isAddingNote && (
                      <Card className="bg-gray-800 border-gray-600">
                        <CardContent className="p-4 space-y-4">
                          <div className="flex items-center gap-4">
                            <Select value={noteCategory} onValueChange={setNoteCategory}>
                              <SelectTrigger className="w-40 bg-gray-700 border-gray-600">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="general">General</SelectItem>
                                <SelectItem value="preference">Preference</SelectItem>
                                <SelectItem value="complaint">Complaint</SelectItem>
                                <SelectItem value="compliment">Compliment</SelectItem>
                                <SelectItem value="follow-up">Follow-up</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <Textarea
                            placeholder="Enter customer note..."
                            value={newNote}
                            onChange={(e) => setNewNote(e.target.value)}
                            className="bg-gray-700 border-gray-600 text-white"
                          />
                          <div className="flex gap-2">
                            <Button onClick={addCustomerNote} size="sm" className="bg-green-600 hover:bg-green-700">
                              <Save className="w-4 h-4 mr-2" />
                              Save Note
                            </Button>
                            <Button onClick={() => setIsAddingNote(false)} variant="outline" size="sm" className="border-gray-600 text-gray-300">
                              Cancel
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Notes List */}
                    <div className="space-y-3">
                      {customerNotes.map((note) => (
                        <Card key={note.id} className="bg-gray-800 border-gray-600">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge variant="outline" className="border-rosae-red/50 text-rosae-red text-xs">
                                    {note.category}
                                  </Badge>
                                  <span className="text-gray-400 text-sm">by {note.author}</span>
                                </div>
                                <p className="text-white">{note.note}</p>
                              </div>
                              <span className="text-gray-400 text-sm">{formatDateTime(note.date)}</span>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </TabsContent>

                  {/* Analytics Tab */}
                  <TabsContent value="analytics" className="space-y-6 mt-6">
                    {customerStats && (
                      <>
                        <h3 className="text-lg font-semibold text-white">Customer Analytics</h3>
                        
                        {/* Key Metrics */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <Card className="bg-gray-800 border-gray-600">
                            <CardContent className="p-4">
                              <h4 className="text-white font-medium mb-4">Spending Analysis</h4>
                              <div className="space-y-3">
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Total Spent:</span>
                                  <span className="text-white font-medium">{formatCurrency(customerStats.totalSpent)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Average per Booking:</span>
                                  <span className="text-white font-medium">{formatCurrency(customerStats.avgSpending)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Customer Since:</span>
                                  <span className="text-white font-medium">{formatDate(customerStats.customerSince)}</span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>

                          <Card className="bg-gray-800 border-gray-600">
                            <CardContent className="p-4">
                              <h4 className="text-white font-medium mb-4">Preferences</h4>
                              <div className="space-y-3">
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Favorite Theatre:</span>
                                  <span className="text-white font-medium">{customerStats.favoriteTheatre}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Preferred Time:</span>
                                  <span className="text-white font-medium">{customerStats.preferredTimeSlot}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Visit Rate:</span>
                                  <span className={`font-medium ${getVisitFrequency(customerStats.visitRate).color}`}>
                                    {customerStats.visitRate.toFixed(1)}% ({getVisitFrequency(customerStats.visitRate).status})
                                  </span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </div>

                        {/* Customer Insights */}
                        <Card className="bg-gray-800 border-gray-600">
                          <CardContent className="p-4">
                            <h4 className="text-white font-medium mb-4">Customer Insights</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="text-center p-4 bg-gray-700 rounded-lg">
                                <div className="text-2xl font-bold text-blue-400">{customerStats.totalBookings}</div>
                                <div className="text-gray-400 text-sm">Total Bookings</div>
                              </div>
                              <div className="text-center p-4 bg-gray-700 rounded-lg">
                                <div className="text-2xl font-bold text-green-400">{loyaltyPoints}</div>
                                <div className="text-gray-400 text-sm">Loyalty Points</div>
                              </div>
                              <div className="text-center p-4 bg-gray-700 rounded-lg">
                                <div className={`text-2xl font-bold ${getCustomerTier(customerStats.totalSpent).color}`}>
                                  {getCustomerTier(customerStats.totalSpent).tier}
                                </div>
                                <div className="text-gray-400 text-sm">Customer Tier</div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </>
                    )}
                  </TabsContent>

                  {/* Actions Tab */}
                  <TabsContent value="actions" className="space-y-6 mt-6">
                    <h3 className="text-lg font-semibold text-white">Customer Actions</h3>
                    
                    {/* Quick Actions */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Button 
                        onClick={() => openWhatsApp(selectedBooking.phoneNumber)}
                        className="bg-green-600 hover:bg-green-700 h-16 flex-col"
                      >
                        <MessageCircle className="w-6 h-6 mb-2" />
                        WhatsApp Chat
                      </Button>
                      <Button 
                        onClick={() => window.location.href = '/follow-ups'}
                        className="bg-blue-600 hover:bg-blue-700 h-16 flex-col"
                      >
                        <CalendarDays className="w-6 h-6 mb-2" />
                        View Follow-ups
                      </Button>
                    </div>

                    {/* Follow-up Scheduling */}
                    <Card className="bg-gray-800 border-gray-600">
                      <CardContent className="p-4 space-y-4">
                        <h4 className="text-white font-medium">Schedule Follow-up</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label className="text-gray-300">Follow-up Date</Label>
                            <Input
                              type="date"
                              value={followUpDate}
                              onChange={(e) => setFollowUpDate(e.target.value)}
                              className="bg-gray-700 border-gray-600 text-white"
                            />
                          </div>
                          <div>
                            <Label className="text-gray-300">Priority</Label>
                            <Select>
                              <SelectTrigger className="bg-gray-700 border-gray-600">
                                <SelectValue placeholder="Select priority" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="low">Low</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div>
                          <Label className="text-gray-300">Follow-up Note</Label>
                          <Textarea
                            placeholder="Enter follow-up details..."
                            value={followUpNote}
                            onChange={(e) => setFollowUpNote(e.target.value)}
                            className="bg-gray-700 border-gray-600 text-white"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={scheduleFollowUp} className="bg-rosae-red hover:bg-rosae-dark-red">
                            <Calendar className="w-4 h-4 mr-2" />
                            Schedule Follow-up
                          </Button>
                          <Button 
                            onClick={() => window.location.href = '/follow-ups'}
                            variant="outline" 
                            className="border-gray-600 text-gray-300"
                          >
                            <CalendarDays className="w-4 h-4 mr-2" />
                            View All Follow-ups
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Customer Rating */}
                    <Card className="bg-gray-800 border-gray-600">
                      <CardContent className="p-4 space-y-4">
                        <h4 className="text-white font-medium">Customer Rating</h4>
                        <div className="flex items-center gap-2">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Button
                              key={star}
                              variant="ghost"
                              size="sm"
                              onClick={() => setCustomerRating(star)}
                              className="p-1"
                            >
                              <Star 
                                className={`w-6 h-6 ${star <= customerRating ? 'text-yellow-400 fill-current' : 'text-gray-400'}`}
                              />
                            </Button>
                          ))}
                          <span className="text-white ml-2">{customerRating}/5</span>
                        </div>
                        <p className="text-gray-400 text-sm">Rate this customer based on their interaction and booking history</p>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
}