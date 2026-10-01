import React from 'react';
import { useNavigate, useParams } from "react-router-dom";
import Header from '../components/Header';
import { 
  ClipboardCheck, 
  ShieldCheck, 
  CheckCircle2, 
  AlertOctagon, 
  SearchCheck,
  FileCheck
} from 'lucide-react';
import { useLineSet } from '../context/LineSetContext.jsx';

const QC = () => {
  const navigate = useNavigate();
  const { shopId } = useParams();
  const { clearLineSet, setLineSet } = useLineSet();

  React.useEffect(() => {
    clearLineSet();

    setLineSet({
      machineShop: shopId,
      lineCode: "",
      partName: "",
      partNo: "",
      machineNo: ""
    });
  }, [shopId]);


  return (
    <div className="min-h-screen w-full bg-[#2d2d2d] flex flex-col relative font-sans">
      <Header />

      <div className="flex-1 flex flex-col items-center px-6 py-12 relative z-10">
        <div className="mb-12 text-center">
          <p className="text-sm md:text-base font-black text-[#ff9100] tracking-[0.3em] uppercase mb-2">
            Machine Shop-{shopId}
          </p>
          <h2 className="text-2xl md:text-3xl font-black text-white tracking-[0.2em] uppercase mb-3">
            Quality Controller (QC) Control Panel
          </h2>
          <div className="w-20 h-1.5 bg-gradient-to-r from-orange-600 via-[#ff9100] to-orange-600 mx-auto rounded-full"></div>
        </div>
      </div>
    </div>
  );
};

export default QC;