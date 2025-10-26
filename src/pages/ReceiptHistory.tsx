import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Receipt, LogOut } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { fetchReceipts, updateReceipt, deleteReceipt } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { ReceiptDetailView } from "@/components/ReceiptDetailView";

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
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptRecord | null>(null);
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
    // Logout functionality removed for development
    console.log("Logout clicked - no action needed in development mode");
  };

  const handleDeleteReceipt = async (receiptId: string) => {
    try {
      await deleteReceipt(receiptId);
      toast.success("Receipt deleted successfully!");
      loadReceipts();
    } catch (error) {
      toast.error("Failed to delete receipt");
    }
  };

  const handleReceiptClick = (receipt: ReceiptRecord) => {
    setSelectedReceipt(receipt);
  };

  const handleBackToList = () => {
    setSelectedReceipt(null);
  };

  // If a receipt is selected, show the detail view
  if (selectedReceipt) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container max-w-7xl mx-auto py-8 px-4">
          <ReceiptDetailView
            receipt={selectedReceipt}
            onBack={handleBackToList}
            onDelete={handleDeleteReceipt}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-7xl mx-auto py-8 px-4">
        <div className="space-y-6">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/')}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>

          <div className="space-y-4">
            {loading ? (
              <Card className="p-6">
                <div className="text-center py-8">
                  <div className="text-muted-foreground">Loading receipts...</div>
                </div>
              </Card>
            ) : receipts.length === 0 ? (
              <Card className="p-6">
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
              </Card>
            ) : (
              receipts.map((receipt) => (
                <Card 
                  key={receipt.id} 
                  className="p-4 sm:p-6 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleReceiptClick(receipt)}
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold text-lg">{receipt.tenant_name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(receipt.receipt_date), 'MMM dd, yyyy')}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-lg font-semibold">
                        ₹{receipt.total_amount.toFixed(2)}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground">Last Reading</p>
                        <p className="font-medium">{receipt.eb_reading_last_month.toFixed(0)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Current Reading</p>
                        <p className="font-medium">{receipt.eb_reading_this_month.toFixed(0)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Units Consumed</p>
                        <p className="font-medium">{receipt.units_consumed.toFixed(0)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">EB Charges</p>
                        <p className="font-medium">₹{receipt.eb_charges.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Rent Amount</p>
                        <p className="font-medium">₹{receipt.rent_amount.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Payment Status</p>
                        {receipt.received_date ? (
                          <p className="font-medium text-primary">
                            {format(new Date(receipt.received_date), 'MMM dd, yyyy')}
                          </p>
                        ) : (
                          <Badge variant="secondary">Pending</Badge>
                        )}
                      </div>
                    </div>

                    {!receipt.received_date && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="w-full"
                        onClick={() => handleRecordPayment(receipt.id)}
                      >
                        Record Payment
                      </Button>
                    )}
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReceiptHistory;
