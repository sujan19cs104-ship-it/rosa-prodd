import { useEffect, useMemo, useState } from "react";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Download, FileText, Filter, Printer, Search, Trash2, Edit3, X } from "lucide-react";

const REASONS = ["Cancellation", "Refund", "Technical Issue", "Other"] as const;

type Ticket = {
  id: string;
  bookingId: string;
  timeSlot?: string | null;
  reason: string;
  notes?: string | null;
  status: string;
  createdAt: string;
};

type TicketsResponse = {
  tickets: Ticket[];
  pagination: { total: number; page: number; pageSize: number; totalPages: number };
};

export default function CustomerTicketsPage() {
  const { toast } = useToast();

  // Create form state
  const [phoneNumber, setPhoneNumber] = useState("");
  const [bookingDate, setBookingDate] = useState(""); // YYYY-MM-DD
  const [timeSlot, setTimeSlot] = useState("");
  const [reason, setReason] = useState<string>("");
  const [otherText, setOtherText] = useState("");
  const [notes, setNotes] = useState("");

  // Filters/pagination
  const [searchPhone, setSearchPhone] = useState("");
  const [filterReason, setFilterReason] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [timeSlotFilter, setTimeSlotFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const queryKey = useMemo(() => [
    "/api/tickets",
    { page, pageSize, phone: searchPhone, reason: filterReason, timeSlot: timeSlotFilter, startDate: dateFrom, endDate: dateTo }
  ], [page, pageSize, searchPhone, filterReason, timeSlotFilter, dateFrom, dateTo]);

  // Load configuration for time slots
  const configQuery = useQuery<any>({
    queryKey: ["/api/config"],
    queryFn: async () => {
      const res = await fetch('/api/config', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load configuration');
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const timeSlotOptions: string[] = (configQuery.data?.timeSlots || ['10:00 AM','1:00 PM','4:00 PM','7:00 PM']);

  const { data, isFetching } = useQuery<TicketsResponse>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      if (searchPhone) params.set("phoneNumber", searchPhone);
      if (filterReason && filterReason !== 'all') params.set("reason", filterReason);
      if (timeSlotFilter && timeSlotFilter !== 'all') params.set("timeSlot", timeSlotFilter);
      if (dateFrom && dateTo) { params.set("startDate", dateFrom); params.set("endDate", dateTo); }
      const res = await fetch(`/api/tickets?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load tickets");
      return res.json();
    }
  });

  // Create ticket
  const createMutation = useMutation({
    mutationFn: async () => {
      const payload: any = { phoneNumber, bookingDate, timeSlot: timeSlot || undefined, reason: reason === "Other" ? "Other" : reason, notes: notes || undefined };
      // Attach optional other text to notes if Other
      if (reason === "Other" && otherText) {
        payload.notes = payload.notes ? `${payload.notes}\nOther: ${otherText}` : `Other: ${otherText}`;
      }
      return apiRequest("POST", "/api/tickets", payload);
    },
    onSuccess: () => {
      toast({ title: "Ticket created", description: "Customer ticket saved successfully" });
      setPhoneNumber(""); setBookingDate(""); setTimeSlot(""); setReason(""); setOtherText(""); setNotes("");
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
    },
    onError: (e: any) => {
      toast({ title: "Failed", description: e?.message || "Could not create ticket", variant: "destructive" });
    }
  });

  // Update ticket
  const updateMutation = useMutation({
    mutationFn: async (vars: { id: string; reason?: string; notes?: string; status?: string }) => {
      return apiRequest("PATCH", `/api/tickets/${vars.id}`, vars);
    },
    onSuccess: () => {
      toast({ title: "Updated", description: "Ticket updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
    },
    onError: (e: any) => toast({ title: "Update failed", description: e?.message || "Could not update", variant: "destructive" })
  });

  // Soft delete
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/tickets/${id}`),
    onSuccess: () => { toast({ title: "Deleted", description: "Ticket deleted" }); queryClient.invalidateQueries({ queryKey: ["/api/tickets"] }); },
    onError: (e: any) => toast({ title: "Delete failed", description: e?.message || "Could not delete", variant: "destructive" })
  });

  const onExportCSV = () => {
    const tickets = data?.tickets || [];
    const rows = [
      ["ID", "Booking ID", "Reason", "Notes", "Status", "Created At"],
      ...tickets.map(t => [t.id, t.bookingId, t.reason, (t.notes || "").replace(/\n/g, " "), t.status, t.createdAt])
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tickets_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onPrint = () => {
    window.print();
  };

  const handleCreate = () => {
    if (!phoneNumber.trim()) {
      toast({ title: "Phone number required", description: "Enter a valid phone number", variant: "destructive" });
      return;
    }
    if (!bookingDate) {
      toast({ title: "Booking date required", description: "Select the booking date", variant: "destructive" });
      return;
    }
    // timeSlot no longer required
    if (!reason) {
      toast({ title: "Reason required", description: "Select a reason", variant: "destructive" });
      return;
    }
    createMutation.mutate();
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <Card className="bg-rosae-dark-gray text-white">
          <CardHeader>
            <CardTitle>Customer Tickets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              <div>
                <Label>Customer Phone Number</Label>
                <Input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="e.g. 9876543210" className="bg-gray-800 border-gray-700 text-white" />
              </div>
              <div>
                <Label>Booking Date</Label>
                <Input type="date" value={bookingDate} onChange={(e) => setBookingDate(e.target.value)} className="bg-gray-800 border-gray-700 text-white" />
              </div>
              <div>
                <Label>Time Slot (optional)</Label>
                <Select value={timeSlot} onValueChange={setTimeSlot}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue placeholder="Select time slot" />
                  </SelectTrigger>
                  <SelectContent>
                    {timeSlotOptions.map((ts: string) => (
                      <SelectItem key={ts} value={ts}>{ts}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Reason</Label>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue placeholder="Select reason" />
                  </SelectTrigger>
                  <SelectContent>
                    {REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {reason === "Other" && (
                <div>
                  <Label>Other (optional)</Label>
                  <Input value={otherText} onChange={(e) => setOtherText(e.target.value)} className="bg-gray-800 border-gray-700 text-white" />
                </div>
              )}
              <div className="md:col-span-1 flex items-end">
                <Button onClick={handleCreate} className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Creating...' : 'Create Ticket'}
                </Button>
              </div>
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="bg-gray-800 border-gray-700 text-white" rows={3} />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-rosae-dark-gray text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Tickets</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onExportCSV}><Download className="w-4 h-4 mr-2" />CSV</Button>
              <Button variant="outline" onClick={onPrint}><Printer className="w-4 h-4 mr-2" />Print</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
              <div className="md:col-span-2">
                <Label>Search Phone Number</Label>
                <div className="flex gap-2">
                  <Input value={searchPhone} onChange={(e) => setSearchPhone(e.target.value)} placeholder="e.g. 9876543210" className="bg-gray-800 border-gray-700 text-white" />
                  <Button variant="secondary" onClick={() => { setPage(1); queryClient.invalidateQueries({ queryKey: ["/api/tickets"] }); }}><Search className="w-4 h-4" /></Button>
                  <Button variant="outline" onClick={() => { setSearchPhone(''); setFilterReason('all'); setDateFrom(''); setDateTo(''); setTimeSlotFilter('all'); setPage(1); queryClient.invalidateQueries({ queryKey: ["/api/tickets"] }); }}>
                    <X className="w-4 h-4 mr-1" /> Clear
                  </Button>
                </div>
              </div>
              <div>
                <Label>Reason</Label>
                <Select value={filterReason} onValueChange={setFilterReason}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Time Slot</Label>
                <Select value={timeSlotFilter} onValueChange={setTimeSlotFilter}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {timeSlotOptions.map(ts => (
                      <SelectItem key={ts} value={ts}>{ts}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>From</Label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="bg-gray-800 border-gray-700 text-white" />
              </div>
              <div>
                <Label>To</Label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="bg-gray-800 border-gray-700 text-white" />
              </div>
              <div className="flex items-end gap-2">
                <Button variant="secondary" onClick={() => { setPage(1); queryClient.invalidateQueries({ queryKey: ["/api/tickets"] }); }}><Filter className="w-4 h-4 mr-2" />Apply</Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left bg-gray-800">
                    <th className="p-3">Ticket ID</th>
                    <th className="p-3">Booking</th>
                    <th className="p-3">Time Slot</th>
                    <th className="p-3">Reason</th>
                    <th className="p-3">Notes</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Created</th>
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.tickets || []).map(t => (
                    <tr key={t.id} className="border-t border-gray-700 hover:bg-gray-800/40">
                      <td className="p-3 whitespace-nowrap text-gray-300">{t.id.slice(0, 8)}</td>
                      <td className="p-3 whitespace-nowrap">{t.bookingId}</td>
                      <td className="p-3 whitespace-nowrap">{t.timeSlot || '-'}</td>
                      <td className="p-3 whitespace-nowrap">{t.reason}</td>
                      <td className="p-3 max-w-[340px] truncate" title={t.notes || ''}>{t.notes}</td>
                      <td className="p-3">
                        <Select value={t.status} onValueChange={(v) => updateMutation.mutate({ id: t.id, status: v })}>
                          <SelectTrigger className="w-[130px] bg-gray-800 border-gray-700 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {['open','in_progress','resolved','closed'].map(s => (
                              <SelectItem key={s} value={s}>{s.replace('_',' ')}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-3 whitespace-nowrap">{new Date(t.createdAt).toLocaleString()}</td>
                      <td className="p-3 space-x-2">
                        <Button size="sm" variant="secondary" onClick={() => updateMutation.mutate({ id: t.id, reason: t.reason, notes: t.notes || undefined })}>
                          <Edit3 className="w-4 h-4 mr-1" /> Edit
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => deleteMutation.mutate(t.id)}>
                          <Trash2 className="w-4 h-4 mr-1" /> Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 items-stretch justify-between mt-4">
              <div className="flex items-center justify-between text-gray-300">
                <div className="text-sm">Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, data?.pagination.total || 0)} of {data?.pagination.total || 0} entries</div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-400">Per page:</span>
                  <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
                    <SelectTrigger className="w-[90px] bg-gray-800 border-gray-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[10, 20, 50, 100].map(s => <SelectItem key={s} value={String(s)}>{s}/page</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Button variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700" disabled={page <= 1} onClick={() => setPage(1)}>First</Button>
                  <Button variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</Button>
                  <div className="flex items-center gap-1">
                    {(() => {
                      const totalPages = data?.pagination.totalPages || 1;
                      const maxVisible = 5;
                      let start = Math.max(1, page - Math.floor(maxVisible / 2));
                      let end = Math.min(totalPages, start + maxVisible - 1);
                      if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);
                      const buttons: any[] = [];
                      if (start > 1) {
                        buttons.push(<Button key={1} variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700" onClick={() => setPage(1)}>1</Button>);
                        if (start > 2) buttons.push(<span key="e1" className="text-gray-400 px-2">...</span>);
                      }
                      for (let i = start; i <= end; i++) {
                        buttons.push(
                          <Button key={i} variant={i === page ? 'default' : 'outline'} className={i === page ? 'bg-rosae-red hover:bg-rosae-dark-red' : 'border-gray-600 text-gray-300 hover:bg-gray-700'} onClick={() => setPage(i)}>{i}</Button>
                        );
                      }
                      if (end < totalPages) {
                        if (end < totalPages - 1) buttons.push(<span key="e2" className="text-gray-400 px-2">...</span>);
                        buttons.push(<Button key={totalPages} variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700" onClick={() => setPage(totalPages)}>{totalPages}</Button>);
                      }
                      return buttons;
                    })()}
                  </div>
                  <Button variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700" disabled={!data || page >= (data.pagination.totalPages || 1)} onClick={() => setPage((p) => p + 1)}>Next</Button>
                  <Button variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700" disabled={!data || page >= (data.pagination.totalPages || 1)} onClick={() => setPage(data?.pagination.totalPages || 1)}>Last</Button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400">Go to page:</span>
                  <input
                    type="number"
                    min={1}
                    max={data?.pagination.totalPages || 1}
                    value={page}
                    onChange={(e) => {
                      const total = data?.pagination.totalPages || 1;
                      const v = Math.max(1, Math.min(total, Number(e.target.value) || 1));
                      setPage(v);
                    }}
                    className="bg-gray-800 border border-gray-600 text-white text-sm rounded px-2 py-1 w-16 text-center"
                  />
                  <span className="text-sm text-gray-400">of {data?.pagination.totalPages || 1}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}