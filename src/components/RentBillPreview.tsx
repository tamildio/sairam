import { Card } from "@/components/ui/card";
import { BillData } from "./RentBillForm";

interface RentBillPreviewProps {
  data: BillData;
}

export const RentBillPreview = ({ data }: RentBillPreviewProps) => {
  const unitsConsumed = data.currentMonthReading - data.lastMonthReading;
  const ebCharges = unitsConsumed * data.ebRatePerUnit;
  const totalAmount = data.rentAmount + ebCharges;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { 
      day: '2-digit', 
      month: 'long', 
      year: 'numeric' 
    });
  };

  return (
    <Card className="p-6 md:p-8">
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
                <th className="text-left p-3 md:p-4 text-sm font-semibold">Description</th>
                <th className="text-right p-3 md:p-4 text-sm font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-invoice-border">
              <tr>
                <td className="p-3 md:p-4">
                  <p className="font-medium">Monthly Rent</p>
                </td>
                <td className="p-3 md:p-4 text-right font-medium">₹{data.rentAmount.toFixed(2)}</td>
              </tr>
              <tr>
                <td className="p-3 md:p-4">
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
                <td className="p-3 md:p-4 text-right font-medium">₹{ebCharges.toFixed(2)}</td>
              </tr>
            </tbody>
            <tfoot className="bg-invoice-total/10 border-t-2 border-invoice-total">
              <tr>
                <td className="p-3 md:p-4 font-bold text-base md:text-lg">TOTAL AMOUNT</td>
                <td className="p-3 md:p-4 text-right font-bold text-xl md:text-2xl text-invoice-total">
                  ₹{totalAmount.toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </Card>
  );
};
