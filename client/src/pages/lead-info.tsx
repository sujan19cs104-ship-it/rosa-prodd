import { useEffect, useMemo, useState } from "react";
import Layout from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Line, LineChart, Pie, PieChart, XAxis, YAxis, CartesianGrid, Cell } from "recharts";
import { useQueryClient } from "@tanstack/react-query";

const shiftOptions = [
  { value: "morning", label: "Morning" },
  { value: "evening", label: "Evening" },
];

const sourceOptions = ["Instagram", "Facebook", "Website", "GMaps", "Others"];

function numberOrZero(v: string | number | undefined) {
  if (v === undefined || v === null || v === "") return 0;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return isNaN(n as number) ? 0 : (n as number);
}

export default function LeadInfoPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState<string>(today);
  const [shift, setShift] = useState<string>("morning");
  const [source, setSource] = useState<string>("Instagram");
  const [totalLeads, setTotalLeads] = useState<string>("");
  const [goodLeads, setGoodLeads] = useState<string>("");
  const [badLeads, setBadLeads] = useState<string>("");
  const [callsMade, setCallsMade] = useState<string>("");
  const [description, setDescription] = useState<string>("");

  const [filterStart, setFilterStart] = useState<string>(today);
  const [filterEnd, setFilterEnd] = useState<string>(today);
  const [filterSource, setFilterSource] = useState<string>("all");
  // Pagination for entries table
  const [entriesPage, setEntriesPage] = useState(1);

  const leadListQuery = useQuery({
    queryKey: ["/api/lead-infos", filterStart || "", filterEnd || "", filterSource || ""],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (filterStart) qs.append("startDate", filterStart);
      if (filterEnd) qs.append("endDate", filterEnd);
      if (filterSource && filterSource !== 'all') qs.append("source", filterSource);
      const res = await fetch(`/api/lead-infos?${qs.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const statsQuery = useQuery({
    queryKey: ["/api/lead-infos/stats", filterStart || "", filterEnd || "", filterSource || "all"],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (filterStart) qs.append("startDate", filterStart);
      if (filterEnd) qs.append("endDate", filterEnd);
      if (filterSource && filterSource !== 'all') qs.append("source", filterSource);
      const res = await fetch(`/api/lead-infos?${qs.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      const rows = await res.json();
      // Derive stats client-side when filterSource is applied to keep API simple
      const total = { totalLeads: 0, goodLeads: 0, badLeads: 0, callsMade: 0 } as any;
      const byDate = new Map<string, { totalLeads: number; goodLeads: number; badLeads: number; callsMade: number }>();
      for (const r of rows as any[]) {
        total.totalLeads += Number(r.totalLeads || 0);
        total.goodLeads += Number(r.goodLeads || 0);
        total.badLeads += Number(r.badLeads || 0);
        total.callsMade += Number(r.callsMade || 0);
        const d = r.date as string;
        const curr = byDate.get(d) || { totalLeads: 0, goodLeads: 0, badLeads: 0, callsMade: 0 };
        curr.totalLeads += Number(r.totalLeads || 0);
        curr.goodLeads += Number(r.goodLeads || 0);
        curr.badLeads += Number(r.badLeads || 0);
        curr.callsMade += Number(r.callsMade || 0);
        byDate.set(d, curr);
      }
      const series = Array.from(byDate.entries()).sort((a,b) => a[0].localeCompare(b[0])).map(([date, v]) => ({ date, ...v }));
      return { total, series };
    },
  });

  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: async () => {
      const body = {
        date,
        shift,
        source,
        totalLeads: numberOrZero(totalLeads),
        goodLeads: numberOrZero(goodLeads),
        badLeads: numberOrZero(badLeads),
        callsMade: numberOrZero(callsMade),
        description: description || undefined,
      };
      const res = await apiRequest("POST", "/api/lead-infos", body);
      return res.json();
    },
    onSuccess: () => {
      leadListQuery.refetch();
      statsQuery.refetch();
      toast({ title: "Saved", description: "Lead info saved successfully" });
      // Clear input fields after save
      setTotalLeads("");
      setGoodLeads("");
      setBadLeads("");
      setCallsMade("");
      setDescription("");
    },
    onError: async (err: any) => {
      toast({ title: "Error", description: err?.message || "Failed to save lead info", variant: "destructive" });
    }
  });

  // Inline component to alert if yesterday data is missing
  function MissingYesterdayAlert() {
    const { toast } = useToast();
    const [checked, setChecked] = useState(false);
    const yesterday = new Date(Date.now() - 24*60*60*1000).toISOString().slice(0,10);
    const query = useQuery({
      queryKey: ["/api/lead-infos", "yesterday-check", yesterday],
      queryFn: async () => {
        const res = await fetch(`/api/lead-infos?startDate=${yesterday}&endDate=${yesterday}`, { credentials: 'include' });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      }
    });

    useEffect(() => {
      if (!checked && query.data) {
        const rows = Array.isArray(query.data) ? query.data : (query.data?.rows || []);
        const hasData = (rows || []).length > 0;
        if (!hasData) {
          toast({ title: "Heads up", description: `No lead info found for ${yesterday}. Please add yesterday's data.`, variant: 'destructive' });
        }
        setChecked(true);
      }
    }, [query.data, checked]);
    return null;
  }

  const totals = useMemo(() => {
    const s = statsQuery.data?.total || { totalLeads: 0, goodLeads: 0, badLeads: 0, callsMade: 0 };
    return s;
  }, [statsQuery.data]);

  const series = statsQuery.data?.series || [];
  const pieData = useMemo(() => {
    const goodLeads = Number(totals.goodLeads || 0);
    const badLeads = Number(totals.badLeads || 0);
    
    // If both are 0, show a placeholder
    if (goodLeads === 0 && badLeads === 0) {
      return [
        { name: 'Good', value: 1 },
        { name: 'Bad', value: 1 },
      ];
    }
    
    return [
      { name: 'Good', value: goodLeads },
      { name: 'Bad', value: badLeads },
    ];
  }, [totals.goodLeads, totals.badLeads]);

  function downloadCSV() {
    const qs = new URLSearchParams();
    if (filterStart) qs.append("startDate", filterStart);
    if (filterEnd) qs.append("endDate", filterEnd);
    if (filterSource) qs.append("source", filterSource);
    const url = `/api/lead-infos/export?${qs.toString()}`;
    window.open(url, '_blank');
  }

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Alert for missing yesterday's data */}
        <MissingYesterdayAlert />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Record Lead Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="date">Date</Label>
                  <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
                <div>
                  <Label>Shift</Label>
                  <Select value={shift} onValueChange={setShift}>
                    <SelectTrigger><SelectValue placeholder="Shift" /></SelectTrigger>
                    <SelectContent>
                      {shiftOptions.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Source</Label>
                  <Select value={source} onValueChange={setSource}>
                    <SelectTrigger><SelectValue placeholder="Source" /></SelectTrigger>
                    <SelectContent>
                      {sourceOptions.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div>
                  <Label>Total Leads</Label>
                  <Input inputMode="numeric" value={totalLeads} onChange={(e) => setTotalLeads(e.target.value)} />
                </div>
                <div>
                  <Label>Good Leads</Label>
                  <Input inputMode="numeric" value={goodLeads} onChange={(e) => setGoodLeads(e.target.value)} />
                </div>
                <div>
                  <Label>Bad Leads</Label>
                  <Input inputMode="numeric" value={badLeads} onChange={(e) => setBadLeads(e.target.value)} />
                </div>
                <div>
                  <Label>Calls Made</Label>
                  <Input inputMode="numeric" value={callsMade} onChange={(e) => setCallsMade(e.target.value)} />
                </div>
              </div>

              <div>
                <Label>Description</Label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional notes" />
              </div>

              <Button onClick={() => createMutation.mutate()} disabled={createMutation.isLoading} className="bg-rosae-red hover:bg-rosae-dark-red">
                {createMutation.isLoading ? "Saving..." : "Save"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Filters & Totals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Start</Label>
                  <Input type="date" value={filterStart} onChange={(e) => setFilterStart(e.target.value)} />
                </div>
                <div>
                  <Label>End</Label>
                  <Input type="date" value={filterEnd} onChange={(e) => setFilterEnd(e.target.value)} />
                </div>
                <div>
                  <Label>Source</Label>
                  <Select value={filterSource} onValueChange={setFilterSource}>
                    <SelectTrigger><SelectValue placeholder="All sources" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {sourceOptions.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="grid grid-cols-4 gap-4 text-white flex-1">
                  <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 shadow-md"><CardContent className="p-4">
                    <div className="text-gray-400 text-xs">Total Leads</div>
                    <div className="text-2xl font-semibold">{totals.totalLeads || 0}</div>
                  </CardContent></Card>
                  <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 shadow-md"><CardContent className="p-4">
                    <div className="text-gray-400 text-xs">Good Leads</div>
                    <div className="text-2xl font-semibold">{totals.goodLeads || 0}</div>
                  </CardContent></Card>
                  <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 shadow-md"><CardContent className="p-4">
                    <div className="text-gray-400 text-xs">Bad Leads</div>
                    <div className="text-2xl font-semibold">{totals.badLeads || 0}</div>
                  </CardContent></Card>
                  <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 shadow-md"><CardContent className="p-4">
                    <div className="text-gray-400 text-xs">Calls Made</div>
                    <div className="text-2xl font-semibold">{totals.callsMade || 0}</div>
                  </CardContent></Card>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <Button variant="outline" onClick={() => { setFilterStart(""); setFilterEnd(""); setFilterSource("all"); }}>Clear Filters</Button>
                  <Button onClick={downloadCSV} className="bg-rosae-red hover:bg-rosae-dark-red">Export CSV</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Charts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-gray-900 border-gray-700">
                <CardHeader><CardTitle className="text-white">Daily Total Leads</CardTitle></CardHeader>
                <CardContent>
                  <ChartContainer config={{ total: { label: 'Total Leads', color: 'hsl(var(--chart-1))' } }}>
                    <LineChart data={series} margin={{ left: 12, right: 12 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fill: '#9CA3AF' }} />
                      <YAxis tick={{ fill: '#9CA3AF' }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line type="monotone" dataKey="totalLeads" stroke="var(--color-total)" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              <Card className="bg-gray-900 border-gray-700">
                <CardHeader><CardTitle className="text-white">Good vs Bad Leads</CardTitle></CardHeader>
                <CardContent className="flex items-center justify-center">
                  {totals.goodLeads === 0 && totals.badLeads === 0 ? (
                    <div className="text-gray-400 text-center py-8">
                      <p>No lead data available</p>
                      <p className="text-sm">Add some lead entries to see the chart</p>
                    </div>
                  ) : (
                    <ChartContainer config={{ Good: { color: '#22c55e' }, Bad: { color: '#ef4444' } }} className="h-[300px] w-full">
                      <PieChart width={300} height={300}>
                        <Pie 
                          data={pieData} 
                          dataKey="value" 
                          nameKey="name" 
                          cx="50%" 
                          cy="50%" 
                          outerRadius={80}
                          innerRadius={40}
                          label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(1)}%)`}
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.name === 'Good' ? '#22c55e' : '#ef4444'} />
                          ))}
                        </Pie>
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <ChartLegend content={<ChartLegendContent />} />
                      </PieChart>
                    </ChartContainer>
                  )}
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Entries</CardTitle>
          </CardHeader>
          <CardContent>
            {leadListQuery.isLoading ? (
              <div className="text-gray-400">Loading...</div>
            ) : (
              <div className="overflow-x-auto space-y-3">
                {/* Simple client-side pagination: show first 10 entries by default */}
                {(() => {
                  const rows = Array.isArray(leadListQuery.data) ? leadListQuery.data : (leadListQuery.data?.rows || []);
                  const page = entriesPage;
                  const pageSize = 10;
                  const total = rows.length;
                  const totalPages = Math.max(1, Math.ceil(total / pageSize));
                  const start = (page - 1) * pageSize;
                  const pageRows = rows.slice(start, start + pageSize);
                  return (
                    <>
                      <table className="w-full">
                        <thead>
                          <tr className="text-left text-gray-400 text-sm border-b border-gray-600">
                            <th className="py-2">Date</th>
                            <th className="py-2">Shift</th>
                            <th className="py-2">Source</th>
                            <th className="py-2">Total</th>
                            <th className="py-2">Good</th>
                            <th className="py-2">Bad</th>
                            <th className="py-2">Calls</th>
                            <th className="py-2">Description</th>
                          </tr>
                        </thead>
                        <tbody className="text-white">
                          {pageRows.map((r: any) => (
                            <tr key={r.id} className="border-b border-gray-700">
                              <td className="py-2">{r.date}</td>
                              <td className="py-2 capitalize">{r.shift}</td>
                              <td className="py-2">{r.source}</td>
                              <td className="py-2">{r.totalLeads}</td>
                              <td className="py-2">{r.goodLeads}</td>
                              <td className="py-2">{r.badLeads}</td>
                              <td className="py-2">{r.callsMade}</td>
                              <td className="py-2 text-gray-300">{r.description || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="flex items-center justify-between text-sm text-gray-300">
                        <span>Page {page} of {totalPages}</span>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" className="border-gray-600 text-gray-300" onClick={() => setEntriesPage(Math.max(1, page - 1))} disabled={page <= 1}>Prev</Button>
                          <Button variant="outline" size="sm" className="border-gray-600 text-gray-300" onClick={() => setEntriesPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages}>Next</Button>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}