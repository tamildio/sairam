import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { RentBillPreview } from "@/components/RentBillPreview";
import { BillData } from "@/components/RentBillForm";
import { Trash2 } from "lucide-react";

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

interface ReceiptDetailViewProps {
  receipt: ReceiptRecord | null;
  onBack: () => void;
  onDelete: (receiptId: string) => void;
}

export const ReceiptDetailView = ({ 
  receipt, 
  onBack, 
  onDelete 
}: ReceiptDetailViewProps) => {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  if (!receipt) return null;

  const handleDelete = () => {
    onDelete(receipt.id);
    setIsDeleteDialogOpen(false);
    onBack();
  };

  // Convert receipt to BillData format for the preview
  const billData: BillData = {
    date: receipt.receipt_date,
    tenantName: receipt.tenant_name,
    lastMonthReading: receipt.eb_reading_last_month,
    currentMonthReading: receipt.eb_reading_this_month,
    rentAmount: receipt.rent_amount,
    ebRatePerUnit: receipt.eb_charges / receipt.units_consumed,
  };

  return (
    <div className="space-y-4">
      <RentBillPreview 
        data={billData} 
        receivedDate={receipt.received_date}
        paymentMode={receipt.payment_mode}
      />
      
      <div className="flex justify-center">
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
