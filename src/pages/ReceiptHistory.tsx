import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Receipt } from "lucide-react";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ReceiptRecord {
  id: string;
  receipt_date: string;
  tenant_name: string;
  eb_reading_last_month: number;
  eb_reading_this_month: number;
  units_consumed: number;
  eb_charges: number;
  rent_amount: number;
  total_amount: number;
  received_date: string;
  created_at: string;
}

const ReceiptHistory = () => {
  const [receipts, setReceipts] = useState<ReceiptRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchAllReceipts();
  }, []);

  const fetchAllReceipts = async () => {
    try {
      const { data, error } = await supabase
        .from('rent_receipts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReceipts(data || []);
    } catch (error) {
      console.error("Error fetching receipts:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-7xl mx-auto py-8 px-4">
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/')}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <h1 className="text-3xl font-bold">Receipt History</h1>
          </div>

          <Card className="p-6">
            {loading ? (
              <div className="text-center py-8">
                <div className="text-muted-foreground">Loading receipts...</div>
              </div>
            ) : receipts.length === 0 ? (
              <div className="text-center py-12">
                <Receipt className="h-16 w-16 mx-auto mb-4 text-muted-foreground/40" />
                <h3 className="text-lg font-semibold mb-2">No Receipts Found</h3>
                <p className="text-muted-foreground mb-4">
                  You haven't generated any receipts yet
                </p>
                <Button onClick={() => navigate('/')}>
                  Generate First Receipt
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Receipt Date</TableHead>
                      <TableHead>Tenant</TableHead>
                      <TableHead className="text-right">EB Units</TableHead>
                      <TableHead className="text-right">EB Charges</TableHead>
                      <TableHead className="text-right">Rent</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Received Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {receipts.map((receipt) => (
                      <TableRow key={receipt.id}>
                        <TableCell>
                          {format(new Date(receipt.receipt_date), 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell className="font-medium">
                          {receipt.tenant_name}
                        </TableCell>
                        <TableCell className="text-right">
                          {receipt.units_consumed.toFixed(0)}
                        </TableCell>
                        <TableCell className="text-right">
                          ₹{receipt.eb_charges.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          ₹{receipt.rent_amount.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          ₹{receipt.total_amount.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {format(new Date(receipt.received_date), 'MMM dd, yyyy')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ReceiptHistory;
