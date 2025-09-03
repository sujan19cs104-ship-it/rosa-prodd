import { useEffect, useMemo, useState } from "react";
import Layout from "@/components/layout";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch as Toggle } from "@/components/ui/switch";
import { Download, Filter } from "lucide-react";

function RowItem({ row, pendingOnly, onSave, notify, isFollowUpPending }: { row: any; pendingOnly: boolean; onSave: (p: { bookingId: string; collected: boolean; reason?: string }) => void; notify: (msg: string, variant?: 'destructive' | 'default') => void; isFollowUpPending?: boolean }) {
  const booking = pendingOnly ? row : row;
  const [isCollected, setIsCollected] = useState(true);
  const [reason, setReason] = useState("");

  useEffect(() => {
    // Initialize from server values when available (works for both views)
    if (typeof row.collected === 'boolean') setIsCollected(!!row.collected);
    if (typeof row.reason === 'string') setReason(row.reason || "");
  }, [row?.id, row?.bookingId, row?.collected, row?.reason]);

  // Always prefer row.bookingId if present (All view), fallback to booking.id (Pending view)
  const bookingId = (row?.bookingId || booking?.id);

  return (
    <div className="grid grid-cols-6 gap-2 p-3 items-center">
      <div className="text-white truncate" title={(booking?.customerName || row?.customerName || '') as string}>{booking?.customerName || row?.customerName || '-'}</div>
      <div className="text-white">{booking?.theatreName || row?.theatreName || '-'}</div>
      <div className="text-white">{booking?.timeSlot || row?.timeSlot || '-'}</div>
      <div className="text-white">{booking?.bookingDate || row?.bookingDate || '-'}</div>
      <div className="flex items-center gap-2">
        <Toggle checked={isCollected} onCheckedChange={(v) => setIsCollected(!!v)} />
        <Badge variant={isCollected ? 'default' : 'destructive'}>{isCollected ? 'Yes' : 'No'}</Badge>
        {!isCollected && isFollowUpPending && (
          <Badge className="bg-yellow-600/20 text-yellow-300 border-yellow-600/40">Follow-up created</Badge>
        )}
      </div>
      <div>
        {!isCollected ? (
          <Input placeholder="Reason (required)" className="bg-gray-800 border-gray-600 text-white" value={reason} onChange={(e) => setReason(e.target.value)} />
        ) : (
          <span className="text-gray-400 text-sm">-</span>
        )}
      </div>
      <div className="col-span-6 flex justify-end p-2 pt-0">
        <Button size="sm" onClick={() => {
          if (!isCollected && !reason.trim()) { notify('Reason required', 'destructive'); return; }
          onSave({ bookingId, collected: isCollected, reason: isCollected ? undefined : reason.trim() });
        }}>Save</Button>
      </div>
    </div>
  );
}

export default function FeedbackManagementPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();

  const [filters, setFilters] = useState<{ collected?: string; theatreName?: string; date?: string; timeSlot?: string }>({});
  const [pendingOnly, setPendingOnly] = useState(true);

  // Load time slots from config for dropdowns
  const { data: config } = useQuery<any>({
    queryKey: ["/api/config"],
    staleTime: 5 * 60 * 1000,
  });
  const timeSlotOptions: string[] = (config?.timeSlots || ['10:00 AM','1:00 PM','4:00 PM','7:00 PM']);

  // Redirect to login if needed
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({ title: "Unauthorized", description: "You are logged out. Logging in again...", variant: "destructive" });
      setTimeout(() => { window.location.href = "/api/login"; }, 500);
    }
  }, [isAuthenticated, isLoading, toast]);

  const queryKey = useMemo(() => [pendingOnly ? "/api/feedbacks/pending" : "/api/feedbacks", filters], [pendingOnly, filters]);

  const { data, isLoading: isDataLoading } = useQuery<any>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (!pendingOnly && filters.collected) params.set("collected", filters.collected);
      if (filters.theatreName) params.set("theatreName", filters.theatreName);
      if (filters.date) params.set("date", filters.date);
      if (filters.timeSlot) params.set("timeSlot", filters.timeSlot);
      const url = `${pendingOnly ? "/api/feedbacks/pending" : "/api/feedbacks"}?${params.toString()}&ts=${Date.now()}`;
      const res = await fetch(url, { credentials: 'include', cache: 'no-store', headers: { 'Cache-Control': 'no-store' } });
      return res.json();
    }
  });

  // Fetch follow-ups to show inline status
  const followUpsQuery = useQuery<any>({
    queryKey: ["/api/follow-ups", { type: "feedback", status: "pending" }],
    queryFn: async () => {
      const res = await fetch(`/api/follow-ups?type=feedback&status=pending&ts=${Date.now()}`, { credentials: 'include', cache: 'no-store', headers: { 'Cache-Control': 'no-store' } });
      return res.json();
    }
  });

  const saveFeedback = useMutation({
    mutationFn: async (payload: { bookingId: string; collected: boolean; reason?: string }) => {
      return apiRequest("POST", "/api/feedbacks", payload);
    },
    onSuccess: (_res, variables) => {
      // Refresh lists (current and all feedback queries) and follow-ups
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey?.[0] || '').startsWith('/api/feedbacks') });
      queryClient.refetchQueries({ predicate: (q) => String(q.queryKey?.[0] || '').startsWith('/api/feedbacks') });
      queryClient.invalidateQueries({ queryKey: ["/api/follow-ups"] });
      toast({
        title: "Saved",
        description: variables.collected
          ? "Feedback updated"
          : "Feedback marked as 'No' and follow-up created",
      });
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e?.message || "Failed", variant: "destructive" });
    }
  });

  const rows = pendingOnly ? (data?.rows || []) : (data?.rows || []);
  const followUpByBookingId = useMemo(() => {
    const map = new Map<string, any>();
    const rows = followUpsQuery?.data?.rows || [];
    for (const r of rows) {
      if (r.bookingId) map.set(r.bookingId, r);
    }
    return map;
  }, [followUpsQuery?.data]);

  // Pagination (client-side)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedRows = rows.slice(startIndex, endIndex);

  return (
    <Layout>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">Feedback Management</h2>
            <p className="text-gray-400">Collect and track customer feedback</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={async () => {
              const params = new URLSearchParams();
              if (filters.collected) params.set("collected", filters.collected);
              if (filters.theatreName) params.set("theatreName", filters.theatreName);
              if (filters.date) params.set("date", filters.date);
              if (filters.timeSlot) params.set("timeSlot", filters.timeSlot);
              const url = `/api/feedbacks/export?${params.toString()}`;
              window.open(url, '_blank');
            }}>
              <Download className="w-4 h-4 mr-2"/> Export CSV
            </Button>
            <Button variant={pendingOnly ? "default" : "outline"} onClick={() => { setPendingOnly(p => !p); setFilters({}); }}>
              <Filter className="w-4 h-4 mr-2"/>
              {pendingOnly ? 'Pending' : 'All'}
            </Button>
          </div>
        </div>

        <Card className="bg-rosae-dark-gray border-gray-600">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Collected</label>
                <Select
                  value={filters.collected ?? 'all'}
                  onValueChange={(v) => setFilters(f => ({ ...f, collected: v === 'all' ? undefined : v }))}
                >
                  <SelectTrigger className="bg-gray-800 border-gray-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="true">Yes</SelectItem>
                    <SelectItem value="false">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Theatre</label>
                <Input className="bg-gray-800 border-gray-600 text-white" placeholder="e.g., Theatre 1" value={filters.theatreName || ''} onChange={(e) => setFilters(f => ({ ...f, theatreName: e.target.value || undefined }))} />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Date</label>
                <Input type="date" className="bg-gray-800 border-gray-600 text-white" value={filters.date || ''} onChange={(e) => setFilters(f => ({ ...f, date: e.target.value || undefined }))} />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Time Slot</label>
                <Select
                  value={filters.timeSlot ?? 'all'}
                  onValueChange={(v) => setFilters(f => ({ ...f, timeSlot: v === 'all' ? undefined : v }))}
                >
                  <SelectTrigger className="bg-gray-800 border-gray-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {timeSlotOptions.map((slot) => (
                      <SelectItem key={slot} value={slot}>{slot}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-rosae-dark-gray border-gray-600">
          <CardContent className="p-0">
            <div className="divide-y divide-gray-700">
              <div className="grid grid-cols-6 gap-2 p-3 text-gray-400 text-sm">
                <div>Customer</div>
                <div>Theatre</div>
                <div>Time Slot</div>
                <div>Date</div>
                <div>Collected</div>
                <div>Reason</div>
              </div>
              {(paginatedRows || []).map((row: any) => (
                <RowItem
                  key={(row?.id || row?.bookingId) + (row?.bookingId || '')}
                  row={row}
                  pendingOnly={pendingOnly}
                  onSave={(payload) => saveFeedback.mutate(payload)}
                  notify={(msg, variant?) => toast({ title: msg, variant: variant as any })}
                  isFollowUpPending={!!followUpByBookingId.get(row?.id || row?.bookingId)}
                />
              ))}
              {(!rows || rows.length === 0) && (
                <div className="p-6 text-gray-400">No records</div>
              )}
              {rows && rows.length > 0 && (
                <div className="flex flex-col gap-3 items-stretch justify-between px-4 py-3 text-gray-300">
                  <div className="flex items-center justify-between">
                    <div>
                      Showing {startIndex + 1}-{Math.min(endIndex, total)} of {total} entries
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-400">Rows per page:</span>
                      <select
                        value={pageSize}
                        onChange={(e) => { const v = Number(e.target.value); setPageSize(v); setCurrentPage(1); }}
                        className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-gray-200"
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
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}