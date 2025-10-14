import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "lucide-react";

const TENANTS = [
  { name: "Sudhaagar", rent: 2500 },
  { name: "Rajalakshmi", rent: 3500 },
  { name: "Babu", rent: 3500 },
];

interface RentBillFormProps {
  onGenerate: (data: BillData) => void;
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
    tenantName: "",
    lastMonthReading: 0,
    currentMonthReading: 0,
    rentAmount: 0,
    ebRatePerUnit: 5,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onGenerate(formData);
  };

  const handleChange = (field: keyof BillData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: field === 'tenantName' || field === 'date' ? value : parseFloat(value) || 0
    }));
  };

  const handleTenantSelect = (tenantName: string) => {
    const tenant = TENANTS.find(t => t.name === tenantName);
    if (tenant) {
      setFormData(prev => ({
        ...prev,
        tenantName: tenant.name,
        rentAmount: tenant.rent
      }));
    }
  };

  return (
    <Card className="p-6">
      <h2 className="text-2xl font-bold text-foreground mb-6">Bill Details</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="date">Receipt Date</Label>
          <div className="relative">
            <Input
              id="date"
              type="date"
              value={formData.date}
              onChange={(e) => handleChange('date', e.target.value)}
              required
              className="pl-10"
            />
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="tenantName">Select Tenant</Label>
          <Select value={formData.tenantName} onValueChange={handleTenantSelect} required>
            <SelectTrigger>
              <SelectValue placeholder="Choose a tenant" />
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

        <Button type="submit" className="w-full">
          Generate Bill
        </Button>
      </form>
    </Card>
  );
};
