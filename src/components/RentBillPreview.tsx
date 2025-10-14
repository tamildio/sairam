import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { BillData } from "./RentBillForm";

interface RentBillPreviewProps {
  data: BillData;
}

export const RentBillPreview = ({ data }: RentBillPreviewProps) => {
  const unitsConsumed = data.currentMonthReading - data.lastMonthReading;
  const ebCharges = unitsConsumed * data.ebRatePerUnit;
  const totalAmount = data.rentAmount + ebCharges;

  const handlePrint = () => {
    window.print();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { 
      day: '2-digit', 
      month: 'long', 
      year: 'numeric' 
    });
  };

  return (
    <div className="space-y-4">
      <Card className="p-8 print:shadow-none" id="bill-preview">
        <div className="border-b-4 border-invoice-header pb-4 mb-6">
          <h1 className="text-3xl font-bold text-invoice-header">RENT RECEIPT</h1>
          <p className="text-muted-foreground mt-1">Payment Receipt</p>
        </div>

        <div className="space-y-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-invoice-label text-sm uppercase tracking-wide">Receipt Date</p>
              <p className="text-lg font-semibold mt-1">{formatDate(data.date)}</p>
            </div>
          </div>

          <div className="bg-secondary/50 p-4 rounded-lg">
            <p className="text-invoice-label text-sm uppercase tracking-wide">Tenant Name</p>
            <p className="text-xl font-bold mt-1">{data.tenantName}</p>
          </div>

          <div className="border border-invoice-border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-secondary">
                <tr>
                  <th className="text-left p-4 text-sm font-semibold">Description</th>
                  <th className="text-right p-4 text-sm font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-invoice-border">
                <tr>
                  <td className="p-4">
                    <p className="font-medium">Monthly Rent</p>
                  </td>
                  <td className="p-4 text-right font-medium">₹{data.rentAmount.toFixed(2)}</td>
                </tr>
                <tr>
                  <td className="p-4">
                    <p className="font-medium">Electricity Charges</p>
                    <p className="text-sm text-invoice-label mt-1">
                      Last Reading: {data.lastMonthReading} units
                    </p>
                    <p className="text-sm text-invoice-label">
                      Current Reading: {data.currentMonthReading} units
                    </p>
                    <p className="text-sm text-invoice-label">
                      Units Consumed: {unitsConsumed} × ₹{data.ebRatePerUnit.toFixed(2)}
                    </p>
                  </td>
                  <td className="p-4 text-right font-medium">₹{ebCharges.toFixed(2)}</td>
                </tr>
              </tbody>
              <tfoot className="bg-invoice-total/10 border-t-2 border-invoice-total">
                <tr>
                  <td className="p-4 font-bold text-lg">TOTAL AMOUNT</td>
                  <td className="p-4 text-right font-bold text-2xl text-invoice-total">
                    ₹{totalAmount.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="pt-4 border-t border-invoice-border">
            <p className="text-sm text-invoice-label">
              This is a computer-generated receipt and does not require a signature.
            </p>
          </div>
        </div>
      </Card>

      <Button onClick={handlePrint} className="w-full print:hidden" size="lg">
        <Printer className="mr-2 h-5 w-5" />
        Print Receipt
      </Button>
    </div>
  );
};
