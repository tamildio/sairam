import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "lucide-react";
import { toast } from "sonner";
import { fetchReceipts } from "@/lib/api";

const TENANTS = [
  { name: "Sudhaagar", rent: 2500 },
  { name: "Rajalakshmi", rent: 3500 },
  { name: "Babu", rent: 3500 },
  { name: "Mani Saranya house", rent: 3000 },
  { name: "Harshan first house", rent: 3500 },
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
  includeEbFee?: boolean;
  // Receipt data for saving (optional, only when ready to save)
  receiptData?: {
    receipt_date: string;
    tenant_name: string;
    eb_reading_last_month: number;
    eb_reading_this_month: number;
    eb_rate_per_unit: number;
    units_consumed: number;
    eb_charges: number;
    rent_amount: number;
    total_amount: number;
    received_date: null;
  };
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
  const [includeEbFee, setIncludeEbFee] = useState(true);
  const [includeInEbUsed, setIncludeInEbUsed] = useState(true);

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
      // Calculate total amount: include EB charges only if checkbox is checked
      const totalAmount = includeEbFee 
        ? formData.rentAmount + ebCharges 
        : formData.rentAmount;

      console.log("🧮 Calculated values:", {
        unitsConsumed,
        ebCharges,
        totalAmount
      });

      // Prepare receipt data but don't save yet - will be saved when user clicks "Save & Download"
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
        include_in_eb_used: includeInEbUsed,
      };

      console.log("📋 Receipt data prepared (not saved yet):", receiptData);
      console.log("📋 Include in EB Used:", includeInEbUsed);
      console.log("📞 Calling onGenerate with prepared data");
      
      toast.success("Receipt generated! Click 'Save & Download' to save it.");
      // Pass the receipt data along with form data, but no receipt ID yet
      onGenerate({ ...formData, includeEbFee, receiptData }, '');
    } catch (error) {
      console.error("❌ Error preparing receipt:", error);
      console.error("❌ Error details:", {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      toast.error(`Failed to generate receipt: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

        <div className="space-y-2">
          <Label htmlFor="tenant">Select Tenant</Label>
          <Select
            value={formData.tenantName}
            onValueChange={(value) => handleTenantSelect(value)}
          >
            <SelectTrigger id="tenant" className="w-full">
              <SelectValue placeholder="Select a tenant" />
            </SelectTrigger>
            <SelectContent>
              {TENANTS.map((tenant) => (
                <SelectItem key={tenant.name} value={tenant.name}>
                  {tenant.name} - ₹{tenant.rent}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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

        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="includeEbFee"
              checked={includeEbFee}
              onCheckedChange={(checked) => setIncludeEbFee(checked === true)}
            />
            <Label
              htmlFor="includeEbFee"
              className="text-sm font-normal cursor-pointer"
            >
              Include EB charges in total amount
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="includeInEbUsed"
              checked={includeInEbUsed}
              onCheckedChange={(checked) => setIncludeInEbUsed(checked === true)}
            />
            <Label
              htmlFor="includeInEbUsed"
              className="text-sm font-normal cursor-pointer"
            >
              Include Unit Consumed in Tenant EB Used calculation
            </Label>
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
