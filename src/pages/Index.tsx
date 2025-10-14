import { useState } from "react";
import { RentBillForm, BillData } from "@/components/RentBillForm";
import { RentBillPreview } from "@/components/RentBillPreview";
import { FileText } from "lucide-react";

const Index = () => {
  const [billData, setBillData] = useState<BillData | null>(null);

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-6xl mx-auto py-8 px-4">
        <header className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <div className="bg-primary/10 p-3 rounded-full">
              <FileText className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Rent Bill Generator
          </h1>
          <p className="text-muted-foreground text-lg">
            Create professional rent receipts with electricity charges
          </p>
        </header>

        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <RentBillForm onGenerate={setBillData} />
          </div>

          <div>
            {billData ? (
              <RentBillPreview data={billData} />
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <FileText className="h-16 w-16 mx-auto mb-4 opacity-20" />
                  <p className="text-lg">Fill in the form to generate a receipt</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #bill-preview, #bill-preview * {
            visibility: visible;
          }
          #bill-preview {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default Index;
