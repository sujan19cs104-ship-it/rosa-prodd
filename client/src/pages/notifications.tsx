import Layout from "@/components/layout";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

export default function NotificationsPage() {
  const { data: notifications } = useQuery<any[]>({ queryKey: ["/api/notifications"] });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("PATCH", `/api/notifications/${id}/read`, { isRead: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  return (
    <Layout>
      <div className="p-6">
        <Card className="bg-rosae-dark-gray border-gray-600">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white">Notifications</h2>
              {notifications && notifications.some((n: any) => !n.isRead) && (
                <Button
                  variant="outline"
                  onClick={async () => {
                    for (const n of notifications) {
                      if (!n.isRead) await markRead.mutateAsync(n.id);
                    }
                  }}
                >
                  Mark all as read
                </Button>
              )}
            </div>

            <div className="space-y-3">
              {(notifications || []).map((n: any) => (
                <div key={n.id} className={`flex items-center justify-between p-3 rounded border ${n.isRead ? 'bg-gray-800 border-gray-700' : 'bg-gray-900 border-gray-600'}`}>
                  <div>
                    <div className="text-white font-medium">{n.title}</div>
                    {n.body && <div className="text-gray-300 text-sm">{n.body}</div>}
                    <div className="text-gray-500 text-xs mt-1">{new Date(n.createdAt).toLocaleString()}</div>
                  </div>
                  <div>
                    {n.isRead ? (
                      <span className="text-green-400 text-sm flex items-center"><CheckCircle2 className="w-4 h-4 mr-1"/> Read</span>
                    ) : (
                      <Button size="sm" onClick={() => markRead.mutate(n.id)}>Mark read</Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}