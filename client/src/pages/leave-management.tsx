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
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar, User, CheckCircle, XCircle, Clock } from "lucide-react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

// Local minimal schema to ensure client-side submit works regardless of shared schema changes
const leaveFormSchema = z.object({
  leaveType: z.string().min(1, "Leave type is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  partialDay: z.string().optional(),
  reason: z.string().min(1, "Reason is required"),
  keysHolderName: z.string().optional(),
  coverageByName: z.string().optional(),
});

export default function LeaveManagement() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);

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

  const form = useForm({
    resolver: zodResolver(leaveFormSchema),
    defaultValues: {
      leaveType: "PTO",
      startDate: "",
      endDate: "",
      partialDay: undefined,
      reason: "",
      keysHolderName: "",
      coverageByName: "",
    },
  });

  const { data: leaveApplications, isLoading: isLeaveLoading, error: leaveError } = useQuery<any[]>({
    queryKey: ["/api/leave-applications"],
  });

  const { data: leaveTypes } = useQuery<any[]>({ queryKey: ["/api/leave-types"] });
  const { data: balances } = useQuery<any[]>({ queryKey: ["/api/leave-balances"] });
  const { data: notifications } = useQuery<any[]>({ queryKey: ["/api/notifications"] });

  // Handle leave applications error
  useEffect(() => {
    if (leaveError && isUnauthorizedError(leaveError)) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [leaveError, toast]);

  const createLeaveMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/leave-applications", data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Leave application submitted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/leave-applications"] });
      setIsLeaveModalOpen(false);
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
        description: error.message || "Failed to submit leave application",
        variant: "destructive",
      });
    },
  });

  const updateLeaveStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiRequest("PATCH", `/api/leave-applications/${id}/status`, { status });
    },
    onSuccess: (_, { status }) => {
      toast({
        title: "Success",
        description: `Leave application ${status} successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/leave-applications"] });
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
        description: error.message || "Failed to update leave status",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: any) => {
    // Submit only the fields the server expects and ignore removed fields
    const payload = {
      leaveType: data.leaveType,
      startDate: data.startDate,
      endDate: data.endDate,
      partialDay: data.partialDay || undefined,
      reason: data.reason,
      keysHolderName: data.keysHolderName || undefined,
      coverageByName: data.coverageByName || undefined,
    };
    createLeaveMutation.mutate(payload);
  };

  const handleStatusUpdate = (id: string, status: string) => {
    updateLeaveStatusMutation.mutate({ id, status });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-rosae-black flex items-center justify-center">
        <div className="text-white text-lg">Loading...</div>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-600/20 text-green-400';
      case 'rejected':
        return 'bg-red-600/20 text-red-400';
      default:
        return 'bg-yellow-600/20 text-yellow-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="w-4 h-4" />;
      case 'rejected':
        return <XCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const isAdmin = user?.role === 'admin';
  const pendingApplications = leaveApplications?.filter((app: any) => app.status === 'pending') || [];
  const myApplications = leaveApplications?.filter((app: any) => app.userId === user?.id) || [];

  return (
    <Layout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-white" data-testid="text-page-title">Leave Management</h2>
            <p className="text-gray-400">Manage leave applications and approvals</p>
            {balances && balances.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {balances.map((b: any) => (
                  <span key={`${b.leaveTypeCode}-${b.year}`} className="text-xs bg-gray-800 text-gray-200 px-2 py-1 rounded border border-gray-600">
                    {b.leaveTypeCode}: {Number(b.allocated) - Number(b.used)} left of {Number(b.allocated)}
                  </span>
                ))}
              </div>
            )}
          </div>
          <Dialog open={isLeaveModalOpen} onOpenChange={setIsLeaveModalOpen}>
            <DialogTrigger asChild>
              <Button 
                className="bg-rosae-red hover:bg-rosae-dark-red px-6 py-2"
                data-testid="button-apply-leave"
              >
                <Plus className="mr-2 w-4 h-4" />
                Apply for Leave
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-rosae-dark-gray border-gray-600 text-white">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-white">Apply for Leave</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="leaveType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-300">Leave Type</FormLabel>
                          <FormControl>
                            <select
                              className="bg-gray-800 border border-gray-600 text-white rounded px-3 py-2 w-full"
                              data-testid="select-leave-type"
                              {...field}
                            >
                              {(leaveTypes || [{ code: 'PTO', name: 'Paid Time Off' }]).map((t: any) => (
                                <option key={t.code} value={t.code}>{t.name}</option>
                              ))}
                            </select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="startDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-300">Start Date</FormLabel>
                          <FormControl>
                            <Input
                              type="date"
                              className="bg-gray-800 border-gray-600 text-white"
                              data-testid="input-start-date"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="endDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-300">End Date</FormLabel>
                          <FormControl>
                            <Input
                              type="date"
                              className="bg-gray-800 border-gray-600 text-white"
                              data-testid="input-end-date"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="partialDay"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-300">Partial Day</FormLabel>
                          <FormControl>
                            <select
                              className="bg-gray-800 border border-gray-600 text-white rounded px-3 py-2 w-full"
                              data-testid="select-partial-day"
                              {...field}
                            >
                              <option value="">Full Day</option>
                              <option value="AM">AM</option>
                              <option value="PM">PM</option>
                              <option value="HOURS">Hours</option>
                            </select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="keysHolderName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-300">Keys Holder (name or select)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., Kumar"
                              className="bg-gray-800 border-gray-600 text-white"
                              data-testid="input-keys-holder"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="coverageByName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-300">Coverage By (name or select)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., Priya"
                              className="bg-gray-800 border-gray-600 text-white"
                              data-testid="input-coverage-by"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="reason"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-300">Reason</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Please provide a reason for your leave..."
                            className="bg-gray-800 border-gray-600 text-white resize-none"
                            rows={4}
                            data-testid="textarea-reason"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Removed Comp-Off and Manager Override options per request */}

                  <div className="flex justify-end space-x-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsLeaveModalOpen(false)}
                      className="border-gray-600 text-gray-300 hover:bg-gray-700"
                      data-testid="button-cancel-leave"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={createLeaveMutation.isPending}
                      className="bg-rosae-red hover:bg-rosae-dark-red"
                      data-testid="button-submit-leave"
                    >
                      {createLeaveMutation.isPending ? "Submitting..." : "Submit Application"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Admin Section - Pending Approvals */}
        {isAdmin && (
          <Card className="bg-rosae-dark-gray border-gray-600 mb-8">
            <CardContent className="p-6">
              <h3 className="text-xl font-semibold text-white mb-6 flex items-center" data-testid="text-pending-approvals-title">
                <Clock className="w-5 h-5 mr-2 text-yellow-400" />
                Pending Approvals ({pendingApplications.length})
              </h3>
              {isLeaveLoading ? (
                <div className="flex items-center justify-center h-32 text-gray-400">Loading...</div>
              ) : pendingApplications.length > 0 ? (
                <div className="space-y-4">
                  {pendingApplications.map((application: any) => (
                    <div key={application.id} className="bg-gray-800 rounded-lg p-4 border border-gray-700" data-testid={`card-pending-${application.id}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center mb-2">
                            <User className="w-4 h-4 text-gray-400 mr-2" />
                            <span className="font-medium text-white">Employee ID: {application.userId}</span>
                          </div>
                          <div className="flex items-center mb-2">
                            <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                            <span className="text-gray-300">
                              {formatDate(application.startDate)} - {formatDate(application.endDate)}
                            </span>
                          </div>
                          <p className="text-gray-400 text-sm">{application.reason}</p>
                        </div>
                        <div className="flex space-x-2 ml-4">
                          <Button
                            size="sm"
                            onClick={() => handleStatusUpdate(application.id, 'approved')}
                            disabled={updateLeaveStatusMutation.isPending}
                            className="bg-green-600 hover:bg-green-700 text-white"
                            data-testid={`button-approve-${application.id}`}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStatusUpdate(application.id, 'rejected')}
                            disabled={updateLeaveStatusMutation.isPending}
                            className="border-red-600 text-red-400 hover:bg-red-600/10"
                            data-testid={`button-reject-${application.id}`}
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">No pending applications</div>
              )}
            </CardContent>
          </Card>
        )}

        {/* My Applications */}
        <Card className="bg-rosae-dark-gray border-gray-600 mb-8">
          <CardContent className="p-6">
            <h3 className="text-xl font-semibold text-white mb-6" data-testid="text-my-applications-title">My Leave Applications</h3>
            {isLeaveLoading ? (
              <div className="flex items-center justify-center h-32 text-gray-400">Loading...</div>
            ) : myApplications.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-gray-400 text-sm border-b border-gray-600">
                      <th className="pb-3">Start Date</th>
                      <th className="pb-3">End Date</th>
                      <th className="pb-3">Reason</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3">Applied On</th>
                    </tr>
                  </thead>
                  <tbody className="text-white">
                    {myApplications.map((application: any) => (
                      <tr key={application.id} className="border-b border-gray-700" data-testid={`row-application-${application.id}`}>
                        <td className="py-4">{formatDate(application.startDate)}</td>
                        <td className="py-4">{formatDate(application.endDate)}</td>
                        <td className="py-4 text-gray-300 max-w-xs truncate">{application.reason}</td>
                        <td className="py-4">
                          <Badge className={`${getStatusColor(application.status)} flex items-center w-fit`}>
                            {getStatusIcon(application.status)}
                            <span className="ml-1 capitalize">{application.status}</span>
                          </Badge>
                        </td>
                        <td className="py-4 text-gray-400">{formatDate(application.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-16">
                <Calendar className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">No Leave Applications</h3>
                <p className="text-gray-400 mb-6">You haven't applied for any leave yet</p>
                <Button 
                  onClick={() => setIsLeaveModalOpen(true)}
                  className="bg-rosae-red hover:bg-rosae-dark-red"
                  data-testid="button-apply-first-leave"
                >
                  <Plus className="mr-2 w-4 h-4" />
                  Apply for Leave
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* All Applications (Admin View) */}
        {isAdmin && (
          <Card className="bg-rosae-dark-gray border-gray-600">
            <CardContent className="p-6">
              <h3 className="text-xl font-semibold text-white mb-6" data-testid="text-all-applications-title">All Leave Applications</h3>
              {isLeaveLoading ? (
                <div className="flex items-center justify-center h-32 text-gray-400">Loading...</div>
              ) : leaveApplications && leaveApplications.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-gray-400 text-sm border-b border-gray-600">
                        <th className="pb-3">Employee</th>
                        <th className="pb-3">Start Date</th>
                        <th className="pb-3">End Date</th>
                        <th className="pb-3">Reason</th>
                        <th className="pb-3">Status</th>
                        <th className="pb-3">Applied On</th>
                      </tr>
                    </thead>
                    <tbody className="text-white">
                      {leaveApplications.map((application: any) => (
                        <tr key={application.id} className="border-b border-gray-700" data-testid={`row-all-application-${application.id}`}>
                          <td className="py-4 font-medium">{application.userId}</td>
                          <td className="py-4">{formatDate(application.startDate)}</td>
                          <td className="py-4">{formatDate(application.endDate)}</td>
                          <td className="py-4 text-gray-300 max-w-xs truncate">{application.reason}</td>
                          <td className="py-4">
                            <Badge className={`${getStatusColor(application.status)} flex items-center w-fit`}>
                              {getStatusIcon(application.status)}
                              <span className="ml-1 capitalize">{application.status}</span>
                            </Badge>
                          </td>
                          <td className="py-4 text-gray-400">{formatDate(application.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">No leave applications found</div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
