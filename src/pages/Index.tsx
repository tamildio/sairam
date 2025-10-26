import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { RentBillForm, BillData } from "@/components/RentBillForm";
import { RentBillPreview } from "@/components/RentBillPreview";
import { PaymentModal } from "@/components/PaymentModal";
import { ReceiptDetailView } from "@/components/ReceiptDetailView";
import { FileText, ArrowLeft, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { fetchReceipts, updateReceipt, deleteReceipt } from "@/lib/api";
import { format } from "date-fns";

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
  payment_mode?: string | null;
  created_at: string;
}

const Index = () => {
  const [billData, setBillData] = useState<BillData | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [showBill, setShowBill] = useState(false);
  const [receipts, setReceipts] = useState<ReceiptRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [paymentModal, setPaymentModal] = useState<{
    isOpen: boolean;
    receiptId: string | null;
    tenantName: string;
    totalAmount: number;
  }>({
    isOpen: false,
    receiptId: null,
    tenantName: "",
    totalAmount: 0,
  });
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptRecord | null>(null);
  const navigate = useNavigate();

  const handleGenerate = (data: BillData, id: string) => {
    console.log("🎯 handleGenerate called with:", { data, id });
    console.log("📊 Setting state:", {
      billData: data,
      receiptId: id,
      showBill: true
    });
    setBillData(data);
    setReceiptId(id);
    setShowBill(true);
    console.log("✅ State updated, bill should now be visible");
  };

  const handleBack = () => {
    setShowBill(false);
    setBillData(null);
    setReceiptId(null);
  };

  const handleSave = () => {
    setShowBill(false);
    setBillData(null);
    setReceiptId(null);
    loadReceipts();
    toast.success("Receipt saved to history!");
  };



  const loadReceipts = async () => {
    setLoading(true);
    try {
      const data = await fetchReceipts();
      setReceipts(data || []);
    } catch (error) {
      // Error handled by API layer
    } finally {
      setLoading(false);
    }
  };

  const handleRecordPayment = (receiptId: string, tenantName: string, totalAmount: number) => {
    setPaymentModal({
      isOpen: true,
      receiptId,
      tenantName,
      totalAmount,
    });
  };

  const handlePaymentConfirm = async (paymentDate: string, paymentMode: string) => {
    if (!paymentModal.receiptId) return;
    
    try {
      await updateReceipt(paymentModal.receiptId, { 
        received_date: paymentDate,
        payment_mode: paymentMode 
      });
      toast.success(`Payment recorded successfully! Mode: ${paymentMode}`);
      loadReceipts();
    } catch (error) {
      toast.error("Failed to record payment");
    }
  };

  const handlePaymentModalClose = () => {
    setPaymentModal({
      isOpen: false,
      receiptId: null,
      tenantName: "",
      totalAmount: 0,
    });
  };

  const handleReceiptClick = (receipt: ReceiptRecord) => {
    setSelectedReceipt(receipt);
  };

  const handleBackToReceipts = () => {
    setSelectedReceipt(null);
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

  useEffect(() => {
    loadReceipts();
  }, []);


  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-[540px] mx-auto py-4 px-4">

        <Tabs defaultValue="generate" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="generate">Generate Bill</TabsTrigger>
            <TabsTrigger value="receipts">Receipts</TabsTrigger>
          </TabsList>

          <TabsContent value="generate">
            {/* Mobile: Show either form or bill */}
            <div className="md:hidden space-y-6">
              {!showBill ? (
                <RentBillForm onGenerate={handleGenerate} />
              ) : (
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Button onClick={handleBack} variant="outline" className="flex-1">
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back to Form
                    </Button>
                  </div>
                  {billData && (
                    <RentBillPreview 
                      data={billData} 
                      receiptId={receiptId || undefined}
                      onSave={handleSave}
                    />
                  )}
                </div>
              )}
            </div>

            {/* Desktop: Show form or bill */}
            <div className="hidden md:block">
              {!showBill ? (
                <RentBillForm onGenerate={handleGenerate} />
              ) : (
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Button onClick={handleBack} variant="outline" className="flex-1">
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back to Form
                    </Button>
                  </div>
                  {billData && (
                    <RentBillPreview 
                      data={billData} 
                      receiptId={receiptId || undefined}
                      onSave={handleSave}
                    />
                  )}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="receipts">
            {selectedReceipt ? (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Button onClick={handleBackToReceipts} variant="outline" className="flex-1">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Receipts
                  </Button>
                </div>
                <ReceiptDetailView
                  receipt={selectedReceipt}
                  onBack={handleBackToReceipts}
                  onDelete={handleDeleteReceipt}
                />
              </div>
            ) : (
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
                            {receipt.received_date && receipt.received_date !== '1970-01-01' ? (
                              <p className="font-medium text-primary">
                                {format(new Date(receipt.received_date), 'MMM dd, yyyy')}
                              </p>
                            ) : (
                              <Badge variant="secondary">Pending</Badge>
                            )}
                          </div>
                        </div>

                        {(!receipt.received_date || receipt.received_date === '1970-01-01') && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="w-full"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRecordPayment(receipt.id, receipt.tenant_name, receipt.total_amount);
                            }}
                          >
                            Record Payment
                          </Button>
                        )}
                      </div>
                    </Card>
                  ))
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Payment Modal */}
      <PaymentModal
        isOpen={paymentModal.isOpen}
        onClose={handlePaymentModalClose}
        onConfirm={handlePaymentConfirm}
        tenantName={paymentModal.tenantName}
        totalAmount={paymentModal.totalAmount}
      />

    </div>
  );
};
export default Index;