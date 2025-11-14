import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { RentBillPreview } from "@/components/RentBillPreview";
import { BillData } from "@/components/RentBillForm";
import { Trash2, Receipt } from "lucide-react";
import { getReceiptsCountForMonth } from "@/lib/api";

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

interface ReceiptDetailViewProps {
  receipt: ReceiptRecord | null;
  onBack: () => void;
  onDelete: (receiptId: string) => void;
  onRecordPayment?: (receiptId: string, tenantName: string, totalAmount: number) => void;
}

export const ReceiptDetailView = ({ 
  receipt, 
  onBack, 
  onDelete,
  onRecordPayment
}: ReceiptDetailViewProps) => {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [receiptsCount, setReceiptsCount] = useState<number | null>(null);

  if (!receipt) return null;

  // Calculate receipts count for Tenant EB Used records
  useEffect(() => {
    if (receipt.tenant_name === 'Tenant EB Used') {
      getReceiptsCountForMonth(receipt.receipt_date)
        .then(count => setReceiptsCount(count))
        .catch(error => {
          console.error('Error calculating receipts count:', error);
          setReceiptsCount(0);
        });
    }
  }, [receipt]);

  const handleDelete = () => {
    onDelete(receipt.id);
    setIsDeleteDialogOpen(false);
    onBack();
  };

  // Check if this is an EB bill paid record
  const isEbBillPaid = receipt.tenant_name === 'EB bill paid';
  const isTenantEbBill = receipt.tenant_name === 'Tenant EB bill';
  const isTenantEbUsed = receipt.tenant_name === 'Tenant EB Used';
  
  // Debug logging
  console.log('ReceiptDetailView - receipt:', receipt);
  console.log('ReceiptDetailView - isEbBillPaid:', isEbBillPaid);
  console.log('ReceiptDetailView - isTenantEbBill:', isTenantEbBill);
  console.log('ReceiptDetailView - isTenantEbUsed:', isTenantEbUsed);

  if (isEbBillPaid) {
    // EB bill paid record - consistent card layout
    return (
      <div className="space-y-4">
        <Card className="p-6 md:p-8">
          <div className="space-y-6">
            {/* Header Section */}
            <div className="bg-secondary/50 p-4 rounded-lg">
              <div className="mb-4">
                <p className="text-invoice-label text-sm uppercase tracking-wide">Record Type</p>
                <p className="text-xl font-bold mt-1">{receipt.tenant_name}</p>
              </div>
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-invoice-label text-sm uppercase tracking-wide">Receipt Date</p>
                  <p className="text-lg font-semibold mt-1">{format(new Date(receipt.receipt_date), 'MMM dd, yyyy')}</p>
                </div>
                {receipt.received_date && receipt.received_date !== '1970-01-01' && (
                  <div className="text-right">
                    <p className="text-invoice-label text-sm uppercase tracking-wide">Paid Date</p>
                    <p className="text-lg font-semibold mt-1 text-green-600">{format(new Date(receipt.received_date), 'MMM dd, yyyy')}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Details Table */}
            <div className="border border-invoice-border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-secondary">
                  <tr>
                    <th className="text-left p-3 md:p-4 text-sm font-semibold">Description</th>
                    <th className="text-right p-3 md:p-4 text-sm font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-invoice-border">
                  <tr>
                    <td className="p-3 md:p-4">
                      <p className="font-medium">EB Bill Payment</p>
                      <p className="text-sm text-invoice-label mt-1">
                        Units Consumed: {receipt.units_consumed.toFixed(0)}
                      </p>
                    </td>
                    <td className="p-3 md:p-4 text-right font-medium">₹{receipt.eb_charges.toFixed(2)}</td>
                  </tr>
                </tbody>
                <tfoot className="bg-invoice-total/10 border-t-2 border-invoice-total">
                  <tr>
                    <td className="p-3 md:p-4 font-bold text-base md:text-lg">TOTAL AMOUNT</td>
                    <td className="p-3 md:p-4 text-right font-bold text-xl md:text-2xl text-invoice-total">
                      ₹{receipt.total_amount.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </Card>
        
        <div className="flex justify-center">
          <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="flex items-center gap-2">
                <Trash2 className="h-4 w-4" />
                Delete Record
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the EB bill payment record dated{" "}
                  <strong>{format(new Date(receipt.receipt_date), 'MMM dd, yyyy')}</strong>.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete Record
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    );
  }

  if (isTenantEbBill) {
    // Simple view for Tenant EB bill records
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-primary mb-2">Tenant EB Bill Summary</h2>
          <p className="text-muted-foreground">Aggregated EB charges from all tenants</p>
        </div>
        
        <div className="bg-card rounded-lg border p-6 space-y-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Month</p>
            <p className="text-xl font-semibold">{format(new Date(receipt.receipt_date), 'MMMM yyyy')}</p>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-sm text-muted-foreground">Total Units</p>
              <p className="text-2xl font-bold">{receipt.units_consumed.toFixed(0)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total EB Charges</p>
              <p className="text-2xl font-bold text-primary">₹{receipt.eb_charges.toFixed(2)}</p>
            </div>
          </div>
        </div>
        
        <div className="flex justify-center">
          <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="flex items-center gap-2">
                <Trash2 className="h-4 w-4" />
                Delete Record
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the Tenant EB bill record for{" "}
                  <strong>{format(new Date(receipt.receipt_date), 'MMMM yyyy')}</strong>.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete Record
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    );
  }

  if (isTenantEbUsed) {
    // Tenant EB Used record - consistent card layout
    return (
      <div className="space-y-4">
        <Card className="p-6 md:p-8">
          <div className="space-y-6">
            {/* Header Section */}
            <div className="bg-secondary/50 p-4 rounded-lg">
              <div className="mb-4">
                <p className="text-invoice-label text-sm uppercase tracking-wide">Record Type</p>
                <p className="text-xl font-bold mt-1">{receipt.tenant_name}</p>
              </div>
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-invoice-label text-sm uppercase tracking-wide">Receipt Date</p>
                  <p className="text-lg font-semibold mt-1">{format(new Date(receipt.receipt_date), 'MMM dd, yyyy')}</p>
                </div>
                <div className="text-right">
                  <p className="text-invoice-label text-sm uppercase tracking-wide">Receipts Count</p>
                  <p className="text-lg font-semibold mt-1">
                    {receiptsCount !== null ? receiptsCount : 'Calculating...'}
                  </p>
                </div>
              </div>
            </div>

            {/* Details Table */}
            <div className="border border-invoice-border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-secondary">
                  <tr>
                    <th className="text-left p-3 md:p-4 text-sm font-semibold">Description</th>
                    <th className="text-right p-3 md:p-4 text-sm font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-invoice-border">
                  <tr>
                    <td className="p-3 md:p-4">
                      <p className="font-medium">Tenant EB Usage</p>
                      <p className="text-sm text-invoice-label mt-1">
                        Total Units Consumed: {receipt.units_consumed.toFixed(0)}
                      </p>
                      <p className="text-sm text-invoice-label">
                        From {receiptsCount !== null ? receiptsCount : 'Calculating...'} tenant receipts
                      </p>
                    </td>
                    <td className="p-3 md:p-4 text-right font-medium">₹{receipt.eb_charges.toFixed(2)}</td>
                  </tr>
                </tbody>
                <tfoot className="bg-invoice-total/10 border-t-2 border-invoice-total">
                  <tr>
                    <td className="p-3 md:p-4 font-bold text-base md:text-lg">TOTAL AMOUNT</td>
                    <td className="p-3 md:p-4 text-right font-bold text-xl md:text-2xl text-invoice-total">
                      ₹{receipt.total_amount.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </Card>
        
        <div className="flex justify-center">
          <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="flex items-center gap-2">
                <Trash2 className="h-4 w-4" />
                Delete Record
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the Tenant EB Used record for{" "}
                  <strong>{format(new Date(receipt.receipt_date), 'MMMM yyyy')}</strong>.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete Record
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    );
  }

  // Regular tenant receipt - show full preview
  // Only show this for actual tenant receipts, not EB records
  if (isEbBillPaid || isTenantEbBill || isTenantEbUsed) {
    console.error('EB record reached regular receipt section - this should not happen');
    return (
      <div className="space-y-4">
        <Card className="p-6">
          <div className="text-center">
            <h2 className="text-xl font-bold text-red-600 mb-2">Error</h2>
            <p className="text-muted-foreground">This record type is not supported in the regular receipt view.</p>
          </div>
        </Card>
      </div>
    );
  }

  // Calculate if EB charges were included in the total
  // If total_amount equals rent_amount, EB charges were excluded
  // If total_amount equals rent_amount + eb_charges, EB charges were included
  const expectedTotalWithEb = receipt.rent_amount + receipt.eb_charges;
  const includeEbFee = Math.abs(receipt.total_amount - expectedTotalWithEb) < 0.01; // Use small epsilon for float comparison

  const billData: BillData = {
    date: receipt.receipt_date,
    tenantName: receipt.tenant_name,
    lastMonthReading: receipt.eb_reading_last_month,
    currentMonthReading: receipt.eb_reading_this_month,
    rentAmount: receipt.rent_amount,
    ebRatePerUnit: receipt.units_consumed > 0 ? receipt.eb_charges / receipt.units_consumed : 0,
    includeEbFee: includeEbFee,
  };

  return (
    <div className="space-y-4">
      <RentBillPreview 
        data={billData} 
        receivedDate={receipt.received_date}
        paymentMode={receipt.payment_mode}
      />
      
      <div className="flex justify-center gap-4">
        {(!receipt.received_date || receipt.received_date === '1970-01-01') && (
          <Button 
            onClick={() => {
              if (onRecordPayment) {
                onRecordPayment(receipt.id, receipt.tenant_name, receipt.total_amount);
              }
            }}
            className="flex items-center gap-2"
          >
            <Receipt className="h-4 w-4" />
            Record Payment
          </Button>
        )}
        
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="flex items-center gap-2">
              <Trash2 className="h-4 w-4" />
              Delete Receipt
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the receipt for{" "}
                <strong>{receipt.tenant_name}</strong> dated{" "}
                <strong>{format(new Date(receipt.receipt_date), 'MMM dd, yyyy')}</strong>.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete Receipt
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};
