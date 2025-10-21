import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Receipt, ArrowRight } from "lucide-react";
import { format } from "date-fns";

interface ReceiptRecord {
  id: string;
  receipt_date: string;
  tenant_name: string;
  total_amount: number;
  received_date: string;
  created_at: string;
}

export const RecentReceipts = () => {
  const [receipts, setReceipts] = useState<ReceiptRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchReceipts();

    // Subscribe to new receipts
    const channel = supabase
      .channel('receipts-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'rent_receipts'
        },
        () => {
          fetchReceipts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchReceipts = async () => {
    try {
      const { data, error } = await supabase
        .from('rent_receipts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      setReceipts(data || []);
    } catch (error) {
      console.error("Error fetching receipts:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Recent Receipts</h3>
          <div className="text-sm text-muted-foreground">Loading...</div>
        </div>
      </Card>
    );
  }

  if (receipts.length === 0) {
    return (
      <Card className="p-6">
        <div className="space-y-4 text-center">
          <Receipt className="h-12 w-12 mx-auto text-muted-foreground/40" />
          <div>
            <h3 className="text-lg font-semibold mb-2">No Receipts Yet</h3>
            <p className="text-sm text-muted-foreground">
              Generate your first receipt to see it here
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Recent Receipts</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/history')}
            className="gap-1"
          >
            View More <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-2">
          {receipts.map((receipt) => (
            <div
              key={receipt.id}
              className="flex items-center justify-between p-3 rounded-lg border hover:bg-secondary/50 transition-colors"
            >
              <div className="flex-1">
                <div className="font-medium">{receipt.tenant_name}</div>
                <div className="text-sm text-muted-foreground">
                  Receipt: {format(new Date(receipt.receipt_date), 'MMM dd, yyyy')} • 
                  Received: {format(new Date(receipt.received_date), 'MMM dd, yyyy')}
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold">₹{receipt.total_amount.toFixed(2)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
};
