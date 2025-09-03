import { useEffect, useMemo, useState } from "react";
import Layout from "@/components/layout";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, CheckCircle2, XCircle, IndianRupee, Phone, CalendarDays, Clock } from "lucide-react";

export default function RefundsPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  // Search state (reuses CRM-like search)
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState("");
  const [timeSlot, setTimeSlot] = useState("");

  // Load time slots from config for dropdowns
  const { data: config } = useQuery<any>({
    queryKey: ["/api/config"],
    staleTime: 5 * 60 * 1000,
  });

  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [refundAmount, setRefundAmount] = useState<string>("");
  const [refundReason, setRefundReason] = useState<string>("");

  const isAdmin = useMemo(() => (user?.email === "admin@rosae.com" || user?.role === "admin"), [user]);

  // Search bookings by phone (and optionally filter by date/time after fetch)
  const { data: searchResults = [], refetch: refetchSearch, isFetching: searching, isError: searchError } = useQuery({
    queryKey: ["/api/bookings/search", phone, date, timeSlot],
    enabled: false,
    queryFn: async () => {
      if (!phone) return [] as any[];
      const res = await apiRequest("GET", `/api/bookings/search?phone=${encodeURIComponent(phone)}`);
      const json = await res.json();
      const arr = Array.isArray(json) ? json : [];
      return arr
        .filter((b: any) => (date ? String(b.bookingDate).trim() === String(date).trim() : true))
        .filter((b: any) => (timeSlot && timeSlot !== 'all' ? String(b.timeSlot).trim().toLowerCase() === String(timeSlot).trim().toLowerCase() : true))
        .sort((a: any, b: any) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
    }
  });

  const submitRequest = useMutation({
    mutationFn: async (payload: { bookingId: string; amount: number; reason: string }) => {
      return apiRequest("POST", `/api/bookings/${payload.bookingId}/refund-request`, payload);
    },
    onSuccess: () => {
      toast({ title: "Refund request sent" });
      queryClient.invalidateQueries({ queryKey: ["/api/refund-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      setRefundAmount("");
      setRefundReason("");
    },
    onError: () => toast({ title: "Failed to send refund request", variant: "destructive" })
  });

  const approveReq = useMutation({
    mutationFn: async (id: string) => apiRequest("PATCH", `/api/refund-requests/${id}/approve`, {}),
    onSuccess: () => {
      toast({ title: "Refund approved" });
      queryClient.invalidateQueries({ queryKey: ["/api/refund-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      // Notify dashboard to refresh analytics
      window.dispatchEvent(new CustomEvent('refunds:changed'));
    },
    onError: () => toast({ title: "Failed to approve", variant: "destructive" })
  });

  const rejectReq = useMutation({
    mutationFn: async (id: string) => apiRequest("PATCH", `/api/refund-requests/${id}/reject`, {}),
    onSuccess: () => {
      toast({ title: "Refund rejected" });
      queryClient.invalidateQueries({ queryKey: ["/api/refund-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      // Notify dashboard to refresh analytics
      window.dispatchEvent(new CustomEvent('refunds:changed'));
    },
    onError: () => toast({ title: "Failed to reject", variant: "destructive" })
  });

  const { data: refundRequests = [] } = useQuery({
    queryKey: ["/api/refund-requests"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/refund-requests");
      const json = await res.json();
      return Array.isArray(json) ? json : [];
    },
  });

  const onSearch = async () => {
    if (!phone) {
      toast({ title: "Enter phone number", variant: "destructive" });
      return;
    }
    try {
      const res = await refetchSearch();
      const arr = Array.isArray(res.data) ? res.data : [];
      if (arr.length === 0) {
        toast({ title: "No results found" });
      }
    } catch (e: any) {
      toast({ title: "Search failed", description: e?.message || "", variant: "destructive" });
    }
  };

  const onSubmitRefund = () => {
    if (!selectedBooking) return;
    const amt = Number(refundAmount);
    if (!isFinite(amt) || amt <= 0) {
      toast({ title: "Enter valid refund amount", variant: "destructive" });
      return;
    }
    if (!refundReason.trim()) {
      toast({ title: "Enter refund reason", variant: "destructive" });
      return;
    }
    submitRequest.mutate({ bookingId: selectedBooking.id, amount: amt, reason: refundReason.trim() });
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Refunds</h2>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Find Booking</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label>Phone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9876543210" />
              </div>
              <div>
                <Label>Date</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div>
                <Label>Time Slot</Label>
                <Select value={timeSlot} onValueChange={setTimeSlot}>
                  <SelectTrigger className="bg-gray-800 border-gray-600">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {(config?.timeSlots || ['10:00 AM','1:00 PM','4:00 PM','7:00 PM']).map((slot: string) => (
                      <SelectItem key={slot} value={slot}>{slot}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2">
                <Button onClick={onSearch} disabled={searching}> <Search className="w-4 h-4 mr-2"/> Search</Button>
                <Button
                  variant="outline"
                  onClick={() => { setPhone(''); setDate(''); setTimeSlot(''); setSelectedBooking(null); }}
                  className="border-gray-600"
                >
                  <XCircle className="w-4 h-4 mr-1"/> Clear
                </Button>
              </div>
            </div>

            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Slot</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Refund</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.isArray(searchResults) && searchResults.length > 0 ? (
                    searchResults.map((b: any) => (
                      <TableRow key={b.id} className={b.refundStatus === 'approved' ? 'bg-red-950/30' : ''}>
                        <TableCell>{b.customerName}</TableCell>
                        <TableCell>{b.phoneNumber}</TableCell>
                        <TableCell>{b.bookingDate}</TableCell>
                        <TableCell>{b.timeSlot}</TableCell>
                        <TableCell>₹{Number(b.totalAmount||0).toLocaleString('en-IN')}</TableCell>
                        <TableCell>{b.refundStatus !== 'none' ? `₹${Number(b.refundAmount||0).toLocaleString('en-IN')}` : '—'}</TableCell>
                        <TableCell>
                          {b.refundStatus === 'approved' && <Badge variant="outline" className="border-green-600 text-green-400">Approved</Badge>}
                          {b.refundStatus === 'pending' && <Badge variant="outline" className="border-yellow-600 text-yellow-400">Pending</Badge>}
                          {b.refundStatus === 'rejected' && <Badge variant="outline" className="border-red-600 text-red-400">Rejected</Badge>}
                          {b.refundStatus === 'none' && <Badge variant="secondary">None</Badge>}
                        </TableCell>
                        <TableCell>
                          <Button size="sm" onClick={() => setSelectedBooking(b)}>Select</Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-gray-400">{searching ? 'Searching…' : 'No results'}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Create Refund Request</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedBooking ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="flex items-center gap-2"><Phone className="w-4 h-4"/> {selectedBooking.phoneNumber}</div>
                  <div className="flex items-center gap-2"><CalendarDays className="w-4 h-4"/> {selectedBooking.bookingDate}</div>
                  <div className="flex items-center gap-2"><Clock className="w-4 h-4"/> {selectedBooking.timeSlot}</div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>Refund Amount (₹)</Label>
                    <Input value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} placeholder="0" />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Reason</Label>
                    <Textarea rows={2} value={refundReason} onChange={(e) => setRefundReason(e.target.value)} placeholder="Reason for refund" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={onSubmitRefund} disabled={submitRequest.isPending}>Submit Request</Button>
                </div>
              </>
            ) : (
              <div className="text-gray-400 text-sm">Select a booking from search results above to create a refund request.</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending Refund Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Booking</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {refundRequests.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.bookingId}</TableCell>
                      <TableCell>₹{Number(r.amount||0).toLocaleString('en-IN')}</TableCell>
                      <TableCell className="max-w-[360px] truncate" title={r.reason}>{r.reason}</TableCell>
                      <TableCell>
                        {r.status === 'approved' && <Badge variant="outline" className="border-green-600 text-green-400">Approved</Badge>}
                        {r.status === 'pending' && <Badge variant="outline" className="border-yellow-600 text-yellow-400">Pending</Badge>}
                        {r.status === 'rejected' && <Badge variant="outline" className="border-red-600 text-red-400">Rejected</Badge>}
                      </TableCell>
                      <TableCell className="flex gap-2">
                        {isAdmin && r.status === 'pending' && (
                          <>
                            <Button size="sm" variant="default" onClick={() => approveReq.mutate(r.id)}><CheckCircle2 className="w-4 h-4 mr-1"/>Approve</Button>
                            <Button size="sm" variant="destructive" onClick={() => rejectReq.mutate(r.id)}><XCircle className="w-4 h-4 mr-1"/>Reject</Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}