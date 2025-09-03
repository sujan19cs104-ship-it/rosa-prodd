import { useEffect, useState } from "react";
import Layout from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export default function LoginTrackerPage() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [email, setEmail] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.href = "/api/login";
      return;
    }
  }, [isAuthenticated, isLoading]);

  const fetchRows = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (email) params.append('email', email);
      params.append('page', String(page));
      params.append('pageSize', String(pageSize));
      const res = await fetch(`/api/login-tracker?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to load login tracker');
      }
      const data = await res.json();
      setRows(data.rows || data);
      if (data.pagination) setTotal(data.pagination.total || 0);
    } catch (e: any) {
      alert(e.message || 'Failed to load login tracker');
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRows(); }, [page, pageSize]);

  return (
    <Layout>
      <div className="p-6">
        {/* Header bar - match layout style */}
        <div className="flex items-center justify-between mb-6 bg-rosae-dark-gray border border-gray-700 rounded-lg px-4 py-3">
          <div>
            <h2 className="text-2xl font-bold text-white">Login Tracker</h2>
            <p className="text-gray-400 text-sm">Monitor user login/logout activity and session durations</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-sm text-gray-400">Total Records</div>
              <div className="text-xl font-semibold text-white">{total}</div>
            </div>
          </div>
        </div>

        <Card className="bg-rosae-dark-gray border-gray-600 mb-4">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm text-gray-400">Start Date</label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-gray-800 border-gray-600 text-white" />
              </div>
              <div>
                <label className="text-sm text-gray-400">End Date</label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-gray-800 border-gray-600 text-white" />
              </div>
              <div>
                <label className="text-sm text-gray-400">Email</label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" className="bg-gray-800 border-gray-600 text-white" />
              </div>
              <div className="flex items-end gap-2">
                <Button onClick={() => { setPage(1); fetchRows(); }} className="bg-rosae-red hover:bg-rosae-dark-red w-full" disabled={loading}>
                  {loading ? 'Loading...' : 'Apply Filters'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => { setStartDate(''); setEndDate(''); setEmail(''); setPage(1); setPageSize(20); fetchRows(); }}
                  className="border-gray-600"
                >
                  Clear
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-rosae-dark-gray border-gray-600">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-gray-400 text-sm border-b border-gray-600">
                    <th className="p-3">Login Time</th>
                    <th className="p-3">Logout Time</th>
                    <th className="p-3">Duration (min)</th>
                    <th className="p-3">User</th>
                    <th className="p-3">Email</th>
                    <th className="p-3">Name</th>
                    <th className="p-3">Device</th>
                    <th className="p-3">IP</th>
                    <th className="p-3">User Agent</th>
                  </tr>
                </thead>
                <tbody className="text-white">
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-6 text-center text-gray-400">No records</td>
                    </tr>
                  ) : rows.map((r: any) => (
                    <tr key={r.id} className="border-b border-gray-700">
                      <td className="p-3">{new Date(r.loginTime).toLocaleString()}</td>
                      <td className="p-3">{r.logoutTime ? new Date(r.logoutTime).toLocaleString() : '-'}</td>
                      <td className="p-3">{r.sessionDurationSec ? Math.round(r.sessionDurationSec / 60) : '-'}</td>
                      <td className="p-3">{r.userId}</td>
                      <td className="p-3">{r.email || '-'}</td>
                      <td className="p-3">{((r.firstName || '') + ' ' + (r.lastName || '')).trim() || '-'}</td>
                      <td className="p-3">{r.deviceType || '-'}</td>
                      <td className="p-3">{r.ipAddress || '-'}</td>
                      <td className="p-3 max-w-[380px] truncate" title={r.userAgent}>{r.userAgent || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Enhanced Pagination Controls */}
            {total > 0 && (
              <div className="p-4 border-t border-gray-600">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-gray-400">
                      Showing {Math.min((page - 1) * pageSize + 1, total)} to {Math.min(page * pageSize, total)} of {total} entries
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-400">Per page:</label>
                      <select
                        value={pageSize}
                        onChange={(e) => {
                          setPageSize(Number(e.target.value));
                          setPage(1);
                        }}
                        className="bg-gray-800 border border-gray-600 text-white text-sm rounded px-2 py-1"
                      >
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(1)}
                      disabled={page <= 1 || loading}
                      className="border-gray-600 text-gray-300 hover:bg-gray-700"
                    >
                      First
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(Math.max(1, page - 1))}
                      disabled={page <= 1 || loading}
                      className="border-gray-600 text-gray-300 hover:bg-gray-700"
                    >
                      Previous
                    </Button>
                    
                    <div className="flex items-center gap-1">
                      {(() => {
                        const totalPages = Math.ceil(total / pageSize);
                        const maxVisiblePages = 5;
                        let startPage = Math.max(1, page - Math.floor(maxVisiblePages / 2));
                        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
                        
                        if (endPage - startPage + 1 < maxVisiblePages) {
                          startPage = Math.max(1, endPage - maxVisiblePages + 1);
                        }
                        
                        const pages = [];
                        
                        if (startPage > 1) {
                          pages.push(
                            <Button
                              key={1}
                              variant="outline"
                              size="sm"
                              onClick={() => setPage(1)}
                              disabled={loading}
                              className="border-gray-600 text-gray-300 hover:bg-gray-700"
                            >
                              1
                            </Button>
                          );
                          if (startPage > 2) {
                            pages.push(<span key="ellipsis1" className="text-gray-400 px-2">...</span>);
                          }
                        }
                        
                        for (let i = startPage; i <= endPage; i++) {
                          pages.push(
                            <Button
                              key={i}
                              variant={i === page ? "default" : "outline"}
                              size="sm"
                              onClick={() => setPage(i)}
                              disabled={loading}
                              className={i === page 
                                ? "bg-rosae-red hover:bg-rosae-dark-red" 
                                : "border-gray-600 text-gray-300 hover:bg-gray-700"
                              }
                            >
                              {i}
                            </Button>
                          );
                        }
                        
                        if (endPage < totalPages) {
                          if (endPage < totalPages - 1) {
                            pages.push(<span key="ellipsis2" className="text-gray-400 px-2">...</span>);
                          }
                          pages.push(
                            <Button
                              key={totalPages}
                              variant="outline"
                              size="sm"
                              onClick={() => setPage(totalPages)}
                              disabled={loading}
                              className="border-gray-600 text-gray-300 hover:bg-gray-700"
                            >
                              {totalPages}
                            </Button>
                          );
                        }
                        
                        return pages;
                      })()}
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(Math.min(Math.ceil(total / pageSize), page + 1))}
                      disabled={page >= Math.ceil(total / pageSize) || loading}
                      className="border-gray-600 text-gray-300 hover:bg-gray-700"
                    >
                      Next
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(Math.ceil(total / pageSize))}
                      disabled={page >= Math.ceil(total / pageSize) || loading}
                      className="border-gray-600 text-gray-300 hover:bg-gray-700"
                    >
                      Last
                    </Button>
                  </div>
                </div>
                
                {/* Quick page jump */}
                <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-gray-700">
                  <span className="text-sm text-gray-400">Go to page:</span>
                  <input
                    type="number"
                    min={1}
                    max={Math.ceil(total / pageSize)}
                    value={page}
                    onChange={(e) => {
                      const newPage = Math.max(1, Math.min(Math.ceil(total / pageSize), Number(e.target.value) || 1));
                      setPage(newPage);
                    }}
                    className="bg-gray-800 border border-gray-600 text-white text-sm rounded px-2 py-1 w-16 text-center"
                  />
                  <span className="text-sm text-gray-400">of {Math.ceil(total / pageSize)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}