import { useEffect } from "react";
import Layout from "@/components/layout";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export default function AdminLeavePage() {
  const { toast } = useToast();

  const { data: leaveTypes } = useQuery<any[]>({ queryKey: ["/api/leave-types"] });
  const { data: users } = useQuery<any[]>({ queryKey: ["/api/admin/users"] });

  const upsertType = useMutation({
    mutationFn: async (payload: any) => {
      await apiRequest("POST", "/api/config/leave-type", payload);
    },
    onSuccess: () => {
      toast({ title: "Saved", description: "Leave type saved" });
      queryClient.invalidateQueries({ queryKey: ["/api/leave-types"] });
    },
    onError: (error: any) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "Please login again", variant: "destructive" });
        setTimeout(() => (window.location.href = "/api/login"), 500);
        return;
      }
      toast({ title: "Error", description: error.message || "Failed to save", variant: "destructive" });
    },
  });

  const setBalance = useMutation({
    mutationFn: async (payload: { userId: string; leaveTypeCode: string; year: number; allocated: number }) => {
      await apiRequest("POST", "/api/admin/leave-balance", payload);
    },
    onSuccess: () => {
      toast({ title: "Saved", description: "Leave balance updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update balance", variant: "destructive" });
    },
  });

  return (
    <Layout>
      <div className="p-6 space-y-8">
        <Card className="bg-rosae-dark-gray border-gray-600">
          <CardContent className="p-6 space-y-4">
            <h2 className="text-2xl font-bold text-white">Leave Types</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {(leaveTypes || []).map((t: any) => (
                <div key={t.id} className="bg-gray-800 border border-gray-700 rounded p-3 space-y-2">
                  <div className="text-sm text-gray-300">Code</div>
                  <div className="text-white font-medium">{t.code}</div>
                  <div className="text-sm text-gray-300">Name</div>
                  <div className="text-white">{t.name}</div>
                  <div className="text-sm text-gray-300">Default Annual</div>
                  <div className="text-white">{t.defaultAnnual}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4">
              <Input placeholder="Code (e.g., PTO)" className="bg-gray-800 border-gray-600 text-white" id="lt-code" />
              <Input placeholder="Name" className="bg-gray-800 border-gray-600 text-white" id="lt-name" />
              <Input placeholder="Default Annual" type="number" className="bg-gray-800 border-gray-600 text-white" id="lt-default" />
              <Button
                className="bg-rosae-red hover:bg-rosae-dark-red"
                onClick={() => {
                  const code = (document.getElementById("lt-code") as HTMLInputElement).value.trim();
                  const name = (document.getElementById("lt-name") as HTMLInputElement).value.trim();
                  const def = Number((document.getElementById("lt-default") as HTMLInputElement).value || 0);
                  if (!code || !name) {
                    toast({ title: "Missing", description: "Code and Name are required", variant: "destructive" });
                    return;
                  }
                  upsertType.mutate({ code, name, defaultAnnual: def });
                }}
              >
                Add / Update Type
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-rosae-dark-gray border-gray-600">
          <CardContent className="p-6 space-y-4">
            <h2 className="text-2xl font-bold text-white">Per-user Leave Balances</h2>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <select id="lb-user" className="bg-gray-800 border border-gray-600 text-white rounded px-3 py-2">
                <option value="">Select user</option>
                {(users || []).map((u: any) => (
                  <option key={u.id} value={u.id}>{u.firstName || ''} {u.lastName || ''} ({u.email})</option>
                ))}
              </select>
              <select id="lb-type" className="bg-gray-800 border border-gray-600 text-white rounded px-3 py-2">
                <option value="">Leave type</option>
                {(leaveTypes || []).map((t: any) => (
                  <option key={t.code} value={t.code}>{t.name} ({t.code})</option>
                ))}
              </select>
              <Input id="lb-year" placeholder="Year" type="number" className="bg-gray-800 border-gray-600 text-white" defaultValue={new Date().getFullYear()} />
              <Input id="lb-allocated" placeholder="Allocated" type="number" className="bg-gray-800 border-gray-600 text-white" />
              <Button
                onClick={() => {
                  const userId = (document.getElementById("lb-user") as HTMLSelectElement).value;
                  const leaveTypeCode = (document.getElementById("lb-type") as HTMLSelectElement).value;
                  const year = Number((document.getElementById("lb-year") as HTMLInputElement).value);
                  const allocated = Number((document.getElementById("lb-allocated") as HTMLInputElement).value);
                  if (!userId || !leaveTypeCode || !year || isNaN(allocated)) {
                    toast({ title: "Missing", description: "All fields are required", variant: "destructive" });
                    return;
                  }
                  setBalance.mutate({ userId, leaveTypeCode, year, allocated });
                }}
              >
                Set Balance
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}