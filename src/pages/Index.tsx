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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { fetchReceipts, updateReceipt, deleteReceipt, createReceipt, getReceiptsCountForMonth } from "@/lib/api";
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
  receipts_count?: number; // Count of receipts used for aggregation
  created_at: string;
}

const Index = () => {
  const [billData, setBillData] = useState<BillData | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [showBill, setShowBill] = useState(false);
  const [receipts, setReceipts] = useState<ReceiptRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [receiptsCountMap, setReceiptsCountMap] = useState<Record<string, number>>({});
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
  const [selectedEbBill, setSelectedEbBill] = useState<ReceiptRecord | null>(null);
  const [ebPaymentModal, setEbPaymentModal] = useState<{
    isOpen: boolean;
    ebAmount: string;
    unitsConsumed: string;
    paymentDate: string;
    unitsRecordedDate: string;
  }>({
    isOpen: false,
    ebAmount: "",
    unitsConsumed: "",
    paymentDate: "",
    unitsRecordedDate: "",
  });
  const navigate = useNavigate();

  const handleGenerate = (data: BillData, id: string) => {
    console.log("🎯 handleGenerate called with:", { data, id });
    console.log("📊 Setting state:", {
      billData: data,
      receiptId: id || null,
      showBill: true
    });
    setBillData(data);
    setReceiptId(id || null);
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

  const handleEbBillClick = (ebBill: ReceiptRecord) => {
    setSelectedEbBill(ebBill);
  };

  const handleBackToEbBills = () => {
    setSelectedEbBill(null);
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

  const handleEbPaymentClick = () => {
    const today = new Date().toISOString().split('T')[0];
    setEbPaymentModal({
      isOpen: true,
      ebAmount: "",
      unitsConsumed: "",
      paymentDate: today,
      unitsRecordedDate: today,
    });
  };

  const handleEbPaymentConfirm = async () => {
    const ebAmount = parseFloat(ebPaymentModal.ebAmount);
    const unitsConsumed = parseFloat(ebPaymentModal.unitsConsumed);

    if (isNaN(ebAmount) || isNaN(unitsConsumed) || ebAmount <= 0 || unitsConsumed <= 0) {
      toast.error("Please enter valid EB amount and units consumed");
      return;
    }

    if (!ebPaymentModal.paymentDate || !ebPaymentModal.unitsRecordedDate) {
      toast.error("Please select both payment date and units recorded date");
      return;
    }

    try {
      // Create a special receipt for EB bill payment
      const ebReceipt = {
        receipt_date: ebPaymentModal.unitsRecordedDate, // Use units recorded date
        tenant_name: "EB bill paid",
        eb_reading_last_month: 0,
        eb_reading_this_month: unitsConsumed,
        units_consumed: unitsConsumed,
        eb_rate_per_unit: ebAmount / unitsConsumed, // Calculate rate per unit
        eb_charges: ebAmount,
        rent_amount: 0,
        total_amount: ebAmount,
        received_date: ebPaymentModal.paymentDate, // Use payment date
        payment_mode: "manual",
      };

      await createReceipt(ebReceipt);
      toast.success("EB bill payment recorded successfully!");
      loadReceipts();
      setEbPaymentModal({
        isOpen: false,
        ebAmount: "",
        unitsConsumed: "",
        paymentDate: "",
        unitsRecordedDate: "",
      });
    } catch (error) {
      toast.error("Failed to record EB bill payment");
    }
  };

  const handleEbPaymentModalClose = () => {
    setEbPaymentModal({
      isOpen: false,
      ebAmount: "",
      unitsConsumed: "",
      paymentDate: "",
      unitsRecordedDate: "",
    });
  };




  useEffect(() => {
    loadReceipts();
  }, []);

  // Calculate receipts count for Tenant EB Used records
  useEffect(() => {
    const tenantEbUsedReceipts = receipts.filter(receipt => receipt.tenant_name === 'Tenant EB Used');
    
    tenantEbUsedReceipts.forEach(async (receipt) => {
      try {
        const count = await getReceiptsCountForMonth(receipt.receipt_date);
        setReceiptsCountMap(prev => ({
          ...prev,
          [receipt.id]: count
        }));
      } catch (error) {
        console.error('Error calculating receipts count for', receipt.id, error);
        setReceiptsCountMap(prev => ({
          ...prev,
          [receipt.id]: 0
        }));
      }
    });
  }, [receipts]);


  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-[540px] mx-auto py-4 px-4">

        <Tabs defaultValue="generate" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="generate">Generate Bill</TabsTrigger>
            <TabsTrigger value="receipts">Receipts</TabsTrigger>
            <TabsTrigger value="eb">EB</TabsTrigger>
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
                  onRecordPayment={handleRecordPayment}
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
                ) : receipts.filter(receipt => receipt.tenant_name !== "EB bill paid" && receipt.tenant_name !== "Tenant EB Used").length === 0 ? (
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
                receipts
                  .filter(receipt => receipt.tenant_name !== "EB bill paid" && receipt.tenant_name !== "Tenant EB Used")
                  .map((receipt) => (
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
                      </div>
                    </Card>
                  ))
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="eb">
            {selectedEbBill ? (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Button onClick={handleBackToEbBills} variant="outline" className="flex-1">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to EB Bills
                  </Button>
                </div>
                <ReceiptDetailView
                  receipt={selectedEbBill}
                  onBack={handleBackToEbBills}
                  onDelete={handleDeleteReceipt}
                  onRecordPayment={handleRecordPayment}
                />
              </div>
            ) : (
              <div className="space-y-4">
                {/* Record EB Payment Button */}
                <div className="flex justify-center">
                  <Button onClick={handleEbPaymentClick} className="flex items-center gap-2">
                    <Receipt className="h-4 w-4" />
                    Record EB Bill Payment
                  </Button>
                </div>

                {loading ? (
                <Card className="p-6">
                  <div className="text-center py-8">
                    <div className="text-muted-foreground">Loading EB data...</div>
                  </div>
                </Card>
              ) : receipts.filter(receipt => receipt.tenant_name === "EB bill paid" || receipt.tenant_name === "Tenant EB Used").length === 0 ? (
                <Card className="p-6">
                  <div className="text-center py-12">
                    <Receipt className="h-16 w-16 mx-auto mb-4 text-muted-foreground/40" />
                    <h3 className="text-lg font-semibold mb-2">No EB Records Found</h3>
                    <p className="text-muted-foreground mb-4">
                      No EB bill payments or usage records yet
                    </p>
                  </div>
                </Card>
              ) : (
                <div className="space-y-4">
                  {/* Filter EB bills and Tenant EB Used records */}
                  {receipts
                    .filter(receipt => receipt.tenant_name === "EB bill paid" || receipt.tenant_name === "Tenant EB Used")
                    .sort((a, b) => new Date(b.receipt_date).getTime() - new Date(a.receipt_date).getTime())
                    .map((receipt) => (
                      <Card 
                        key={receipt.id} 
                        className="p-4 sm:p-6 cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => handleEbBillClick(receipt)}
                      >
                        <div className="space-y-4">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <h3 className="font-semibold text-lg">{receipt.tenant_name}</h3>
                              <p className="text-sm text-muted-foreground">
                                Units Recorded: {format(new Date(receipt.receipt_date), 'MMM dd, yyyy')}
                              </p>
                            </div>
                            <Badge variant="outline" className="text-lg font-semibold">
                              ₹{receipt.total_amount.toFixed(2)}
                            </Badge>
                          </div>

                          {receipt.tenant_name === "Tenant EB Used" ? (
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-muted-foreground">Units Consumed</p>
                                <p className="font-medium">{receipt.units_consumed.toFixed(0)}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Receipts Count</p>
                                <p className="font-medium">{receiptsCountMap[receipt.id] ?? 'Calculating...'}</p>
                              </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-muted-foreground">Units Consumed</p>
                                <p className="font-medium">{receipt.units_consumed.toFixed(0)}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Paid date</p>
                                {receipt.received_date && receipt.received_date !== '1970-01-01' ? (
                                  <p className="font-medium text-primary">
                                    {format(new Date(receipt.received_date), 'MMM dd, yyyy')}
                                  </p>
                                ) : (
                                  <Badge variant="secondary">Pending</Badge>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </Card>
                    ))}
                </div>
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

      {/* EB Payment Modal */}
      <Dialog open={ebPaymentModal.isOpen} onOpenChange={handleEbPaymentModalClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record EB Bill Payment (Bi-monthly)</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="unitsRecordedDate">Units Recorded Date</Label>
              <Input
                id="unitsRecordedDate"
                type="date"
                value={ebPaymentModal.unitsRecordedDate}
                onChange={(e) => setEbPaymentModal(prev => ({ ...prev, unitsRecordedDate: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentDate">Payment Date</Label>
              <Input
                id="paymentDate"
                type="date"
                value={ebPaymentModal.paymentDate}
                onChange={(e) => setEbPaymentModal(prev => ({ ...prev, paymentDate: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="unitsConsumed">Units Consumed</Label>
              <Input
                id="unitsConsumed"
                type="number"
                step="0.01"
                placeholder="Enter units consumed"
                value={ebPaymentModal.unitsConsumed}
                onChange={(e) => setEbPaymentModal(prev => ({ ...prev, unitsConsumed: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ebAmount">EB Amount (₹)</Label>
              <Input
                id="ebAmount"
                type="number"
                step="0.01"
                placeholder="Enter EB amount"
                value={ebPaymentModal.ebAmount}
                onChange={(e) => setEbPaymentModal(prev => ({ ...prev, ebAmount: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleEbPaymentModalClose}>
              Cancel
            </Button>
            <Button onClick={handleEbPaymentConfirm}>
              Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


    </div>
  );
};
export default Index;