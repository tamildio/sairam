import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (paymentDate: string, paymentMode: string) => void;
  tenantName: string;
  totalAmount: number;
}

const paymentModes = [
  { value: "kvb-amma", label: "KVB Amma" },
  { value: "cash", label: "Cash" },
  { value: "jack-gpay", label: "Jack GPay" },
];

export const PaymentModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  tenantName, 
  totalAmount 
}: PaymentModalProps) => {
  const [paymentDate, setPaymentDate] = useState<Date>(new Date());
  const [paymentMode, setPaymentMode] = useState<string>("kvb-amma");
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const handleConfirm = () => {
    const formattedDate = format(paymentDate, 'yyyy-MM-dd');
    onConfirm(formattedDate, paymentMode);
    onClose();
  };

  const handleCancel = () => {
    // Reset to defaults
    setPaymentDate(new Date());
    setPaymentMode("kvb-amma");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Payment Info */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Tenant:</span>
              <span className="text-sm">{tenantName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Amount:</span>
              <span className="text-sm font-semibold">₹{totalAmount.toFixed(2)}</span>
            </div>
          </div>

          {/* Payment Date */}
          <div className="space-y-2">
            <Label htmlFor="payment-date">Payment Date</Label>
            <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !paymentDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {paymentDate ? format(paymentDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={paymentDate}
                  onSelect={(date) => {
                    if (date) {
                      setPaymentDate(date);
                      setIsCalendarOpen(false);
                    }
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Payment Mode */}
          <div className="space-y-3">
            <Label>Payment Mode</Label>
            <RadioGroup value={paymentMode} onValueChange={setPaymentMode}>
              {paymentModes.map((mode) => (
                <div key={mode.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={mode.value} id={mode.value} />
                  <Label htmlFor={mode.value} className="text-sm font-normal">
                    {mode.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>
            Record Payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
