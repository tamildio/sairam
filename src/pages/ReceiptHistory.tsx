import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Receipt, LogOut } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { fetchReceipts, updateReceipt } from "@/lib/api";
import { clearSession } from "@/lib/auth";
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
    loadReceipts();
  }, []);

  const loadReceipts = async () => {
    try {
      const data = await fetchReceipts();
      setReceipts(data || []);
    } catch (error) {
      // Error handled by API layer
    } finally {
      setLoading(false);
    }
  };

  const handleRecordPayment = async (receiptId: string) => {
    const paymentDate = format(new Date(), 'yyyy-MM-dd');
    
    try {
      await updateReceipt(receiptId, { received_date: paymentDate });
      toast.success("Payment date recorded successfully!");
      loadReceipts();
    } catch (error) {
      toast.error("Failed to record payment date");
    }
  };

  const handleLogout = () => {
    clearSession();
    navigate('/login');
    toast.success("Logged out successfully");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-7xl mx-auto py-8 px-4">
        <div className="space-y-6">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
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
                      <TableHead className="text-right">Last Reading</TableHead>
                      <TableHead className="text-right">Current Reading</TableHead>
                      <TableHead className="text-right">Units</TableHead>
                      <TableHead className="text-right">EB Charges</TableHead>
                      <TableHead className="text-right">Rent</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Payment Date</TableHead>
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
                          {receipt.eb_reading_last_month.toFixed(0)}
                        </TableCell>
                        <TableCell className="text-right">
                          {receipt.eb_reading_this_month.toFixed(0)}
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
                          {receipt.received_date 
                            ? format(new Date(receipt.received_date), 'MMM dd, yyyy')
                            : <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleRecordPayment(receipt.id)}
                              >
                                Record Payment
                              </Button>
                          }
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
