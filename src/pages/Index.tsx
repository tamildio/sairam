import { useState } from "react";
import { RentBillForm, BillData } from "@/components/RentBillForm";
import { RentBillPreview } from "@/components/RentBillPreview";
import { FileText, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
const Index = () => {
  const [billData, setBillData] = useState<BillData | null>(null);
  const [showBill, setShowBill] = useState(false);
  const handleGenerate = (data: BillData) => {
    setBillData(data);
    setShowBill(true);
  };
  const handleBack = () => {
    setShowBill(false);
  };
  return <div className="min-h-screen bg-background">
      <div className="container max-w-6xl mx-auto py-4 md:py-8 px-4">
        

        {/* Mobile: Show either form or bill */}
        <div className="md:hidden">
          {!showBill ? <RentBillForm onGenerate={handleGenerate} /> : <div className="space-y-4">
              <Button onClick={handleBack} variant="outline" className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Form
              </Button>
              {billData && <RentBillPreview data={billData} />}
            </div>}
        </div>

        {/* Desktop: Show both side by side */}
        <div className="hidden md:grid md:grid-cols-2 gap-8">
          <div>
            <RentBillForm onGenerate={setBillData} />
          </div>

          <div>
            {billData ? <RentBillPreview data={billData} /> : <div className="h-full flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <FileText className="h-16 w-16 mx-auto mb-4 opacity-20" />
                  <p className="text-lg">Fill in the form to generate a receipt</p>
                </div>
              </div>}
          </div>
        </div>
      </div>
    </div>;
};
export default Index;