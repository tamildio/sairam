import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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

interface ReceiptDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  receipt: ReceiptRecord | null;
  onDelete: (receiptId: string) => void;
}

export const ReceiptDetailModal = ({ 
  isOpen, 
  onClose, 
  receipt, 
  onDelete 
}: ReceiptDetailModalProps) => {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  if (!receipt) return null;

  const handleDelete = () => {
    onDelete(receipt.id);
    setIsDeleteDialogOpen(false);
    onClose();
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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Receipt Preview</DialogTitle>
        </DialogHeader>
        
        <div className="py-4">
          <RentBillPreview 
            data={billData} 
            receivedDate={receipt.received_date}
            paymentMode={receipt.payment_mode}
          />
        </div>

        <DialogFooter className="gap-2">
          <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="flex items-center gap-2">
                <Trash2 className="h-4 w-4" />
                Delete
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
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
