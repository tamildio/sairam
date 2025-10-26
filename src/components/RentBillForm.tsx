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
    lastMonthReading: NaN,
    currentMonthReading: NaN,
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
    console.log("🚀 FORM SUBMIT TRIGGERED");
    console.log("📋 Form data:", formData);
    console.log("🔍 Form validation check:", {
      hasDate: !!formData.date,
      hasTenantName: !!formData.tenantName,
      currentMonthReading: formData.currentMonthReading,
      isValid: !!(formData.date && formData.tenantName && !isNaN(formData.currentMonthReading) && formData.currentMonthReading >= 0)
    });
    
    // Validate form data
    if (!formData.date || !formData.tenantName || isNaN(formData.currentMonthReading) || formData.currentMonthReading < 0) {
      console.log("❌ Form validation failed:", {
        date: formData.date,
        tenantName: formData.tenantName,
        currentMonthReading: formData.currentMonthReading
      });
      toast.error("Please fill in all required fields (Current Month Reading is required)");
      return;
    }

    console.log("✅ Form validation passed, setting isSubmitting to true");
    setIsSubmitting(true);

    try {
      const lastReading = isNaN(formData.lastMonthReading) ? 0 : formData.lastMonthReading;
      const unitsConsumed = formData.currentMonthReading - lastReading;
      const ebCharges = unitsConsumed * formData.ebRatePerUnit;
      const totalAmount = formData.rentAmount + ebCharges;

      console.log("🧮 Calculated values:", {
        unitsConsumed,
        ebCharges,
        totalAmount
      });

      const receiptData = {
        receipt_date: formData.date,
        tenant_name: formData.tenantName,
        eb_reading_last_month: lastReading,
        eb_reading_this_month: formData.currentMonthReading,
        eb_rate_per_unit: formData.ebRatePerUnit,
        units_consumed: unitsConsumed,
        eb_charges: ebCharges,
        rent_amount: formData.rentAmount,
        total_amount: totalAmount,
        received_date: null,
      };

      console.log("📤 Sending receipt data to API:", receiptData);

      const receipt = await createReceipt(receiptData);

      console.log("✅ Receipt created successfully:", receipt);
      console.log("📞 Calling onGenerate with:", { formData, receiptId: receipt.id });
      
      toast.success("Receipt generated!");
      onGenerate(formData, receipt.id);
    } catch (error) {
      console.error("❌ Error creating receipt:", error);
      console.error("❌ Error details:", {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      toast.error(`Failed to save receipt: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      console.log("🏁 Setting isSubmitting to false");
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: keyof BillData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: field === 'tenantName' || field === 'date' ? value : (value === '' ? NaN : parseFloat(value))
    }));
    
    // If date changes, update the last month reading for the current tenant
    if (field === 'date' && formData.tenantName) {
      handleTenantSelect(formData.tenantName);
    }
  };

  const handleTenantSelect = async (tenantName: string) => {
    const tenant = TENANTS.find(t => t.name === tenantName);
    if (tenant) {
      setFormData(prev => ({
        ...prev,
        tenantName: tenant.name,
        rentAmount: tenant.rent
      }));

      // Get the most recent reading for this tenant
      try {
        // Get all receipts for this tenant, ordered by date (newest first)
        const receipts = await fetchReceipts(undefined, tenant.name);
        
        if (receipts.length > 0) {
          // Get the most recent reading (first receipt since they're ordered by date)
          const latestReceipt = receipts[0];
          
          setFormData(prev => ({
            ...prev,
            lastMonthReading: latestReceipt.eb_reading_this_month,
          }));
        } else {
          setFormData(prev => ({
            ...prev,
            lastMonthReading: NaN,
          }));
        }
      } catch (error) {
        console.error('Error fetching latest reading:', error);
        setFormData(prev => ({
          ...prev,
          lastMonthReading: NaN,
        }));
      }
    }
  };

  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="date">Receipt Date</Label>
            <div className="relative">
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => handleChange('date', e.target.value)}
                required
                className="pl-10 w-full"
              />
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ebRate">EB Rate per Unit (₹)</Label>
            <Input
              id="ebRate"
              type="number"
              inputMode="decimal"
              step="0.01"
              value={formData.ebRatePerUnit}
              onChange={(e) => handleChange('ebRatePerUnit', e.target.value)}
              placeholder="5.00"
              required
            />
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="lastMonth">Last Month EB Reading</Label>
            <Input
              id="lastMonth"
              type="number"
              inputMode="numeric"
              value={isNaN(formData.lastMonthReading) ? '' : formData.lastMonthReading}
              onChange={(e) => handleChange('lastMonthReading', e.target.value)}
              placeholder="Enter reading"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="currentMonth">Current Month EB Reading</Label>
            <Input
              id="currentMonth"
              type="number"
              inputMode="numeric"
              value={isNaN(formData.currentMonthReading) ? '' : formData.currentMonthReading}
              onChange={(e) => handleChange('currentMonthReading', e.target.value)}
              placeholder="Enter reading"
              required
            />
          </div>
        </div>



        <Button 
          type="submit" 
          className="w-full" 
          disabled={isSubmitting}
          onClick={(e) => {
            console.log("🖱️ Generate Bill button clicked");
            console.log("🖱️ Event:", e);
            console.log("🖱️ isSubmitting:", isSubmitting);
          }}
        >
          {isSubmitting ? "Saving..." : "Generate Bill"}
        </Button>
      </form>
    </Card>
  );
};
