import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";
import { toast } from "sonner";
import { createReceipt, fetchReceipts } from "@/lib/api";

const TENANTS = [
  { name: "Sudhaagar", rent: 2500 },
  { name: "Rajalakshmi", rent: 3500 },
  { name: "Babu", rent: 3500 },
];

interface RentBillFormProps {
  onGenerate: (data: BillData, receiptId: string) => void;
}

export interface BillData {
  date: string;
  tenantName: string;
  lastMonthReading: number;
  currentMonthReading: number;
  rentAmount: number;
  ebRatePerUnit: number;
}

export const RentBillForm = ({ onGenerate }: RentBillFormProps) => {
  const [formData, setFormData] = useState<BillData>({
    date: new Date().toISOString().split('T')[0],
    tenantName: TENANTS[0].name,
    lastMonthReading: 0,
    currentMonthReading: 0,
    rentAmount: TENANTS[0].rent,
    ebRatePerUnit: 7,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load the initial tenant's last reading on mount
  useEffect(() => {
    handleTenantSelect(TENANTS[0].name);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const unitsConsumed = formData.currentMonthReading - formData.lastMonthReading;
      const ebCharges = unitsConsumed * formData.ebRatePerUnit;
      const totalAmount = formData.rentAmount + ebCharges;

      const receipt = await createReceipt({
        receipt_date: formData.date,
        tenant_name: formData.tenantName,
        eb_reading_last_month: formData.lastMonthReading,
        eb_reading_this_month: formData.currentMonthReading,
        eb_rate_per_unit: formData.ebRatePerUnit,
        units_consumed: unitsConsumed,
        eb_charges: ebCharges,
        rent_amount: formData.rentAmount,
        total_amount: totalAmount,
        received_date: null,
      });

      toast.success("Receipt generated!");
      onGenerate(formData, receipt.id);
    } catch (error) {
      toast.error("Failed to save receipt");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: keyof BillData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: field === 'tenantName' || field === 'date' ? value : parseFloat(value) || 0
    }));
  };

  const handleTenantSelect = async (tenantName: string) => {
    const tenant = TENANTS.find(t => t.name === tenantName);
    if (tenant) {
      setFormData(prev => ({
        ...prev,
        tenantName: tenant.name,
        rentAmount: tenant.rent
      }));

      // Fetch the most recent reading for this tenant
      try {
        const receipts = await fetchReceipts(1, tenant.name);

        if (receipts.length > 0 && receipts[0].eb_reading_this_month) {
          setFormData(prev => ({
            ...prev,
            lastMonthReading: receipts[0].eb_reading_this_month,
          }));
        }
      } catch (error) {
        // Silently fail - last month reading stays at 0
      }
    }
  };

  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="date">Receipt Date</Label>
          <div className="relative">
            <Input
              id="date"
              type="date"
              value={formData.date}
              onChange={(e) => handleChange('date', e.target.value)}
              required
              className="pl-10 w-auto"
            />
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        <div className="space-y-3">
          <Label>Select Tenant</Label>
          <div className="grid gap-2">
            {TENANTS.map((tenant) => (
              <div
                key={tenant.name}
                onClick={() => handleTenantSelect(tenant.name)}
                className={`flex items-center justify-between border rounded-lg p-4 hover:bg-secondary/50 transition-colors cursor-pointer ${
                  formData.tenantName === tenant.name 
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20' 
                    : 'border-border'
                }`}
              >
                <span className="font-medium text-lg">
                  {tenant.name}
                </span>
                <span className="text-lg font-semibold text-primary">
                  ₹{tenant.rent}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="lastMonth">Last Month EB Reading</Label>
            <Input
              id="lastMonth"
              type="number"
              value={formData.lastMonthReading}
              onChange={(e) => handleChange('lastMonthReading', e.target.value)}
              placeholder="0"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="currentMonth">Current Month EB Reading</Label>
            <Input
              id="currentMonth"
              type="number"
              value={formData.currentMonthReading}
              onChange={(e) => handleChange('currentMonthReading', e.target.value)}
              placeholder="0"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ebRate">EB Rate per Unit (₹)</Label>
          <Input
            id="ebRate"
            type="number"
            step="0.01"
            value={formData.ebRatePerUnit}
            onChange={(e) => handleChange('ebRatePerUnit', e.target.value)}
            placeholder="5.00"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="rent">Rent Amount (₹)</Label>
          <Input
            id="rent"
            type="number"
            value={formData.rentAmount}
            onChange={(e) => handleChange('rentAmount', e.target.value)}
            placeholder="0"
            required
            className="bg-secondary/50"
            disabled
          />
          <p className="text-xs text-muted-foreground">Auto-filled based on selected tenant</p>
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Generate Bill"}
        </Button>
      </form>
    </Card>
  );
};
