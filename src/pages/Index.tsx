import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { RentBillForm, BillData } from "@/components/RentBillForm";
import { RentBillPreview } from "@/components/RentBillPreview";
import { RecentReceipts } from "@/components/RecentReceipts";
import { FileText, ArrowLeft, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clearSession } from "@/lib/auth";
import { toast } from "sonner";

const Index = () => {
  const [billData, setBillData] = useState<BillData | null>(null);
  const [showBill, setShowBill] = useState(false);
  const navigate = useNavigate();

  const handleGenerate = (data: BillData) => {
    setBillData(data);
    setShowBill(true);
  };

  const handleBack = () => {
    setShowBill(false);
  };

  const handleLogout = () => {
    clearSession();
    navigate('/login');
    toast.success("Logged out successfully");
  };

  return <div className="min-h-screen bg-background">
      <div className="container max-w-6xl mx-auto py-4 md:py-8 px-4">
        <div className="flex justify-end mb-4">
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
        

        {/* Mobile: Show either form or bill */}
        <div className="md:hidden space-y-6">
          {!showBill ? (
            <>
              <RentBillForm onGenerate={handleGenerate} />
              <RecentReceipts />
            </>
          ) : (
            <div className="space-y-4">
              <Button onClick={handleBack} variant="outline" className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Form
              </Button>
              {billData && <RentBillPreview data={billData} />}
            </div>
          )}
        </div>

        {/* Desktop: Show both side by side */}
        <div className="hidden md:grid md:grid-cols-2 gap-8">
          <div className="space-y-8">
            <RentBillForm onGenerate={setBillData} />
            <RecentReceipts />
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