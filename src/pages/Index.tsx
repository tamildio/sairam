import { Fragment, useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { RentBillForm, BillData } from "@/components/RentBillForm";
import { RentBillPreview } from "@/components/RentBillPreview";
import { PaymentModal } from "@/components/PaymentModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { fetchRecentTenantReceipts, fetchRecentEbRecords, monthsAgoStart, updateReceipt, deleteReceipt, createReceipt, computeEbReconciliation, EbReconciliationRound, EbRoundBill } from "@/lib/api";
import { format } from "date-fns";

interface ReceiptRecord {
  id: string;
  receipt_date: string;
  tenant_name: string;
  record_type: "receipt" | "eb_bill_paid" | "eb_bill_aggregate" | "eb_used_aggregate";
  eb_reading_last_month: number;
  eb_reading_this_month: number;
  eb_rate_per_unit: number;
  units_consumed: number;
  eb_charges: number;
  rent_amount: number;
  total_amount: number;
  received_date: string;
  payment_mode?: string | null;
  receipts_count?: number; // Count of receipts used for aggregation
  consumer_number?: string | null;
  receipt_no?: string | null;
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
  // Stored by key (not by object) so the detail view re-derives from fresh data after a save.
  const [selectedEbRoundKey, setSelectedEbRoundKey] = useState<string | null>(null);
  const [unmarkBill, setUnmarkBill] = useState<EbRoundBill | null>(null);
  // Only recent data is loaded up front to keep page loads fast; "load more" widens the window.
  const RECEIPTS_MONTHS_STEP = 2;
  const EB_MONTHS_STEP = 8; // ~4 bi-monthly reconciliation rounds
  const [receiptsMonths, setReceiptsMonths] = useState(RECEIPTS_MONTHS_STEP);
  const [receiptsHasMore, setReceiptsHasMore] = useState(true);
  const [receiptsVisibleMonths, setReceiptsVisibleMonths] = useState(1); // Receipts tab starts with one month
  const [ebRecords, setEbRecords] = useState<ReceiptRecord[]>([]);
  const [ebMonths, setEbMonths] = useState(EB_MONTHS_STEP);
  const [ebHasMore, setEbHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState<"receipts" | "eb" | null>(null);
  // The 3 fixed EB service connections for the house - not user-editable.
  const EB_CONSUMER_NUMBERS = ["09270003185", "092700031893", "09270003636"];

  const defaultEbServices = () =>
    EB_CONSUMER_NUMBERS.map(consumerNumber => ({ consumerNumber, unitsConsumed: "", ebAmount: "" }));

  const [isSavingEbPayment, setIsSavingEbPayment] = useState(false);
  const [ebPaymentModal, setEbPaymentModal] = useState<{
    isOpen: boolean;
    paymentDate: string;
    unitsRecordedDate: string;
    services: { consumerNumber: string; unitsConsumed: string; ebAmount: string }[];
  }>({
    isOpen: false,
    paymentDate: "",
    unitsRecordedDate: "",
    services: defaultEbServices(),
  });
  const navigate = useNavigate();

  // A round covers its billing month plus the month before it. The oldest loaded month
  // can't be fully reconciled (its neighbour isn't loaded), so rounds are only shown
  // once both of their months are inside the loaded window.
  const ebReconciliation = useMemo(() => {
    const oldestLoadedMonth = monthsAgoStart(ebMonths - 1).slice(0, 7);
    return computeEbReconciliation(ebRecords).filter((round) => round.periodKey > oldestLoadedMonth);
  }, [ebRecords, ebMonths]);

  const selectedEbRound = useMemo(
    () => ebReconciliation.find((r) => r.periodKey === selectedEbRoundKey) ?? null,
    [ebReconciliation, selectedEbRoundKey]
  );

  const paidNumbers = new Set(selectedEbRound?.bills.map((b) => b.consumerNumber));
  const unpaidServices = EB_CONSUMER_NUMBERS.filter((n) => !paidNumbers.has(n));
  const extraBillNumbers = (selectedEbRound?.bills ?? [])
    .map((b) => b.consumerNumber)
    .filter((n): n is string => !!n && !EB_CONSUMER_NUMBERS.includes(n));

  // Receipts tab: only the newest `receiptsVisibleMonths` calendar months that have receipts.
  const receiptMonthKeys = useMemo(
    () => Array.from(new Set(receipts.map((r) => r.receipt_date.slice(0, 7)))).sort().reverse(),
    [receipts]
  );
  const visibleReceipts = useMemo(() => {
    const visible = new Set(receiptMonthKeys.slice(0, receiptsVisibleMonths));
    return receipts.filter((r) => r.record_type === "receipt" && visible.has(r.receipt_date.slice(0, 7)));
  }, [receipts, receiptMonthKeys, receiptsVisibleMonths]);

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
      const [recent, eb] = await Promise.all([
        fetchRecentTenantReceipts(receiptsMonths),
        fetchRecentEbRecords(ebMonths),
      ]);
      setReceipts(recent);
      setEbRecords(eb);
    } catch (error) {
      // Error handled by API layer
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMoreReceipts = async () => {
    // Older months already fetched? Just reveal the next one - no API call.
    if (receiptsVisibleMonths < receiptMonthKeys.length) {
      setReceiptsVisibleMonths((v) => v + 1);
      return;
    }

    const nextMonths = receiptsMonths + RECEIPTS_MONTHS_STEP;
    setLoadingMore("receipts");
    try {
      const older = await fetchRecentTenantReceipts(nextMonths);
      setReceiptsHasMore(older.length > receipts.length);
      setReceipts(older);
      setReceiptsMonths(nextMonths);
      setReceiptsVisibleMonths((v) => v + 1);
    } catch (error) {
      toast.error("Failed to load older receipts");
    } finally {
      setLoadingMore(null);
    }
  };

  const handleLoadMoreEb = async () => {
    const nextMonths = ebMonths + EB_MONTHS_STEP;
    setLoadingMore("eb");
    try {
      const older = await fetchRecentEbRecords(nextMonths);
      setEbHasMore(older.length > ebRecords.length);
      setEbRecords(older);
      setEbMonths(nextMonths);
    } catch (error) {
      toast.error("Failed to load older EB records");
    } finally {
      setLoadingMore(null);
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

  const handleEbPaymentClick = () => {
    const today = new Date().toISOString().split('T')[0];
    setEbPaymentModal({
      isOpen: true,
      paymentDate: today,
      unitsRecordedDate: today,
      services: defaultEbServices(),
    });
  };

  // Opens the payment dialog for specific services of a reconciliation round.
  const openEbPaymentFor = (round: EbReconciliationRound, consumerNumbers: string[]) => {
    const today = new Date().toISOString().split("T")[0];
    const billingDate = today.slice(0, 7) === round.periodKey ? today : `${round.periodKey}-01`;
    setEbPaymentModal({
      isOpen: true,
      paymentDate: today,
      unitsRecordedDate: billingDate,
      services: defaultEbServices().filter((s) => consumerNumbers.includes(s.consumerNumber)),
    });
  };

  const handleConfirmUnmark = async () => {
    if (!unmarkBill) return;
    try {
      await deleteReceipt(unmarkBill.id);
      toast.success("Marked as not paid");
      loadReceipts();
    } catch (error) {
      toast.error("Failed to update payment");
    } finally {
      setUnmarkBill(null);
    }
  };

  const handleEbServiceChange = (index: number, field: "unitsConsumed" | "ebAmount", value: string) => {
    setEbPaymentModal(prev => ({
      ...prev,
      services: prev.services.map((s, i) => (i === index ? { ...s, [field]: value } : s)),
    }));
  };

  const handleEbPaymentConfirm = async () => {
    if (isSavingEbPayment) return;
    if (!ebPaymentModal.paymentDate || !ebPaymentModal.unitsRecordedDate) {
      toast.error("Please select both payment date and units recorded date");
      return;
    }

    // A service with both fields left blank had no bill this round - skip it.
    const filledServices = ebPaymentModal.services.filter(s => s.unitsConsumed.trim() || s.ebAmount.trim());

    if (filledServices.length === 0) {
      toast.error("Please enter units consumed and EB amount for at least one service");
      return;
    }

    for (const service of filledServices) {
      const ebAmount = parseFloat(service.ebAmount);
      const unitsConsumed = parseFloat(service.unitsConsumed);
      if (isNaN(ebAmount) || isNaN(unitsConsumed) || ebAmount < 0 || unitsConsumed < 0) {
        toast.error(`Please enter valid units consumed and EB amount for ${service.consumerNumber}`);
        return;
      }
    }

    // Guard against re-recording a bill that's already saved for the same month.
    const recordedMonth = ebPaymentModal.unitsRecordedDate.slice(0, 7);
    const alreadyRecorded = filledServices.find(service =>
      ebRecords.some(r =>
        r.record_type === "eb_bill_paid" &&
        r.consumer_number === service.consumerNumber &&
        r.receipt_date.slice(0, 7) === recordedMonth
      )
    );
    if (alreadyRecorded) {
      toast.error(`A payment for ${alreadyRecorded.consumerNumber} is already recorded for this month`);
      return;
    }

    setIsSavingEbPayment(true);
    try {
      for (const service of filledServices) {
        const ebAmount = parseFloat(service.ebAmount);
        const unitsConsumed = parseFloat(service.unitsConsumed);
        const ebReceipt = {
          receipt_date: ebPaymentModal.unitsRecordedDate, // Use units recorded date
          tenant_name: "EB bill paid",
          record_type: "eb_bill_paid" as const,
          eb_reading_last_month: 0,
          eb_reading_this_month: unitsConsumed,
          units_consumed: unitsConsumed,
          eb_rate_per_unit: unitsConsumed > 0 ? ebAmount / unitsConsumed : 0,
          eb_charges: ebAmount,
          rent_amount: 0,
          total_amount: ebAmount,
          received_date: ebPaymentModal.paymentDate, // Use payment date
          payment_mode: "manual",
          consumer_number: service.consumerNumber,
        };
        await createReceipt(ebReceipt);
      }

      toast.success(`Recorded ${filledServices.length} EB bill payment${filledServices.length !== 1 ? 's' : ''} successfully!`);
      loadReceipts();
      setEbPaymentModal({
        isOpen: false,
        paymentDate: "",
        unitsRecordedDate: "",
        services: defaultEbServices(),
      });
    } catch (error) {
      toast.error("Failed to record EB bill payment");
      loadReceipts();
    } finally {
      setIsSavingEbPayment(false);
    }
  };

  const handleEbPaymentModalClose = () => {
    setEbPaymentModal({
      isOpen: false,
      paymentDate: "",
      unitsRecordedDate: "",
      services: defaultEbServices(),
    });
  };




  useEffect(() => {
    loadReceipts();
  }, []);


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
                ) : visibleReceipts.length === 0 ? (
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
                visibleReceipts
                  .map((receipt, i, list) => (
                    <Fragment key={receipt.id}>
                    {(i === 0 || receipt.receipt_date.slice(0, 7) !== list[i - 1].receipt_date.slice(0, 7)) && (
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide pt-2">
                        {format(new Date(`${receipt.receipt_date.slice(0, 7)}-01`), 'MMMM yyyy')}
                      </h3>
                    )}
                    <Card 

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
                    </Fragment>
                  ))
                )}
                {!loading && (receiptsHasMore || receiptsVisibleMonths < receiptMonthKeys.length) && (
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={loadingMore === "receipts"}
                    onClick={handleLoadMoreReceipts}
                  >
                    {loadingMore === "receipts" ? "Loading..." : "Show previous month"}
                  </Button>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="eb">
            {selectedEbRound ? (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Button onClick={() => setSelectedEbRoundKey(null)} variant="outline" className="flex-1">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Reconciliation
                  </Button>
                </div>

                <Card className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-semibold">
                      {format(new Date(`${selectedEbRound.periodKey}-01`), 'MMMM yyyy')}
                    </h3>
                    <Badge variant="secondary">
                      {selectedEbRound.isPending ? "Awaiting bill" : `${selectedEbRound.billCount} bill${selectedEbRound.billCount !== 1 ? 's' : ''}`}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Paid to EB</p>
                      <p className="font-medium">
                        {selectedEbRound.isPending ? "—" : `₹${selectedEbRound.totalPaid.toFixed(2)}`}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Charged to Tenants</p>
                      <p className="font-medium">₹{selectedEbRound.totalCharged.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">
                        {selectedEbRound.isPending ? "Charged So Far" : "Difference"}
                      </p>
                      {selectedEbRound.isPending ? (
                        <p className="font-semibold">₹{selectedEbRound.totalCharged.toFixed(2)}</p>
                      ) : (
                        <p className={`font-semibold ${selectedEbRound.variance > 0 ? 'text-red-600' : selectedEbRound.variance < 0 ? 'text-green-600' : ''}`}>
                          {selectedEbRound.variance > 0 ? '+' : ''}₹{selectedEbRound.variance.toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>
                </Card>

                <Card className="p-6">
                  <h4 className="font-semibold mb-3">Tenant EB Usage by Month</h4>
                  {selectedEbRound.monthlyCharges.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No tenant EB usage recorded for this period</p>
                  ) : (
                    <div className="divide-y">
                      {selectedEbRound.monthlyCharges.map((m) => (
                        <div key={m.monthKey} className="py-2">
                          <div className="flex items-center justify-between text-sm">
                            <div>
                              <p className="font-medium">{format(new Date(`${m.monthKey}-01`), 'MMMM yyyy')}</p>
                              <p className="text-muted-foreground">{m.unitsConsumed.toFixed(0)} units consumed</p>
                            </div>
                            <p className="font-semibold">₹{m.amount.toFixed(2)}</p>
                          </div>
                          {m.tenants.length > 0 && (
                            <div className="mt-2 ml-3 pl-3 border-l-2 space-y-1">
                              {m.tenants.map((t, i) => (
                                <div key={`${t.tenantName}-${i}`} className="flex items-center justify-between text-xs text-muted-foreground">
                                  <span>{t.tenantName} • {t.unitsConsumed.toFixed(0)} units</span>
                                  <span>₹{t.amount.toFixed(2)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                <Card className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold">EB Bills by Service</h4>
                    {unpaidServices.length > 1 && (
                      <Button size="sm" onClick={() => openEbPaymentFor(selectedEbRound, unpaidServices)}>
                        Record {unpaidServices.length} unpaid
                      </Button>
                    )}
                  </div>
                  <div className="divide-y">
                    {[...EB_CONSUMER_NUMBERS, ...extraBillNumbers].map((consumerNumber) => {
                      const bill = selectedEbRound.bills.find((b) => b.consumerNumber === consumerNumber);
                      return (
                        <div key={consumerNumber} className="flex items-center justify-between gap-3 py-3 text-sm">
                          <div>
                            <p className="font-medium">{consumerNumber}</p>
                            {bill ? (
                              <p className="text-muted-foreground">
                                Paid • {bill.unitsConsumed.toFixed(0)} units
                                {bill.paidDate ? ` • ${format(new Date(bill.paidDate), 'MMM dd, yyyy')}` : ""}
                              </p>
                            ) : (
                              <p className="text-amber-600">Not paid</p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            {bill && <p className="font-semibold">₹{bill.amount.toFixed(2)}</p>}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                bill ? setUnmarkBill(bill) : openEbPaymentFor(selectedEbRound, [consumerNumber])
                              }
                            >
                              {bill ? "Mark unpaid" : "Mark paid"}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
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

                {ebReconciliation.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      EB Reconciliation
                    </h3>
                    {ebReconciliation.map((round) => (
                      <Card
                        key={round.periodKey}
                        className={`p-4 cursor-pointer hover:shadow-md transition-shadow ${round.isPending ? 'border-dashed' : ''}`}
                        onClick={() => setSelectedEbRoundKey(round.periodKey)}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold">
                            {format(new Date(`${round.periodKey}-01`), 'MMMM yyyy')}
                          </h4>
                          <Badge variant="secondary">
                            {round.isPending
                              ? "Awaiting bill"
                              : `${round.billCount} bill${round.billCount !== 1 ? 's' : ''}`}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-3 text-sm">
                          <div>
                            <p className="text-muted-foreground">Paid to EB</p>
                            <p className="font-medium">
                              {round.isPending ? "—" : `₹${round.totalPaid.toFixed(2)}`}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Charged to Tenants</p>
                            <p className="font-medium">₹{round.totalCharged.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">
                              {round.isPending ? "Charged So Far" : "Difference"}
                            </p>
                            {round.isPending ? (
                              <p className="font-semibold">₹{round.totalCharged.toFixed(2)}</p>
                            ) : (
                              <p className={`font-semibold ${round.variance > 0 ? 'text-red-600' : round.variance < 0 ? 'text-green-600' : ''}`}>
                                {round.variance > 0 ? '+' : ''}₹{round.variance.toFixed(2)}
                              </p>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                    {ebHasMore && (
                      <Button
                        variant="outline"
                        className="w-full"
                        disabled={loadingMore === "eb"}
                        onClick={handleLoadMoreEb}
                      >
                        {loadingMore === "eb" ? "Loading..." : "Show older records"}
                      </Button>
                    )}
                  </div>
                )}

                {loading && ebRecords.length === 0 ? (
                  <Card className="p-6">
                    <div className="text-center py-8">
                      <div className="text-muted-foreground">Loading EB data...</div>
                    </div>
                  </Card>
                ) : ebReconciliation.length === 0 && (
                  <Card className="p-6">
                    <div className="text-center py-12">
                      <Receipt className="h-16 w-16 mx-auto mb-4 text-muted-foreground/40" />
                      <h3 className="text-lg font-semibold mb-2">No EB Records Found</h3>
                      <p className="text-muted-foreground mb-4">
                        No EB bill payments or usage records yet
                      </p>
                    </div>
                  </Card>
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

      {/* Mark-unpaid confirmation */}
      <AlertDialog open={!!unmarkBill} onOpenChange={(open) => !open && setUnmarkBill(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark as not paid?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the recorded payment for {unmarkBill?.consumerNumber}
              {unmarkBill ? ` (₹${unmarkBill.amount.toFixed(2)})` : ""}. You can record it again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmUnmark}>Mark unpaid</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* EB Payment Modal */}
      <Dialog open={ebPaymentModal.isOpen} onOpenChange={handleEbPaymentModalClose}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record EB Bill Payment (Bi-monthly)</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-3">
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
            </div>

            <p className="text-xs text-muted-foreground">
              Both dates apply to every service below. Leave a row blank to skip it for this round.
            </p>

            <div className="rounded-lg border">
              <div className="grid grid-cols-[1fr_1fr_1fr] gap-2 px-3 py-2 text-xs text-muted-foreground uppercase tracking-wide border-b">
                <span>Cons Number</span>
                <span>Units</span>
                <span>Amount (₹)</span>
              </div>
              <div className="divide-y">
                {ebPaymentModal.services.map((service, index) => (
                  <div key={index} className="grid grid-cols-[1fr_1fr_1fr] gap-2 p-3 items-center">
                    <p className="text-sm font-medium">{service.consumerNumber}</p>
                    <Input
                      aria-label={`Units consumed for ${service.consumerNumber}`}
                      type="number"
                      step="0.01"
                      placeholder="Units"
                      value={service.unitsConsumed}
                      onChange={(e) => handleEbServiceChange(index, "unitsConsumed", e.target.value)}
                    />
                    <Input
                      aria-label={`EB amount for ${service.consumerNumber}`}
                      type="number"
                      step="0.01"
                      placeholder="Amount"
                      value={service.ebAmount}
                      onChange={(e) => handleEbServiceChange(index, "ebAmount", e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleEbPaymentModalClose}>
              Cancel
            </Button>
            <Button onClick={handleEbPaymentConfirm} disabled={isSavingEbPayment}>
              {isSavingEbPayment
                ? "Saving..."
                : `Record Payment${ebPaymentModal.services.filter(s => s.unitsConsumed.trim() || s.ebAmount.trim()).length > 1 ? "s" : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


    </div>
  );
};
export default Index;