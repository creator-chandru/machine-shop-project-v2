import React from 'react';
import { useNavigate, useParams } from "react-router-dom";
import Header from '../components/Header';
import { 
  ClipboardCheck, 
  PenLine, 
  ShieldCheck, 
  RefreshCw, 
  FileClock, 
  Wrench,
  FileText,
  Clock,
  AlertTriangle,
  BadgeCheck,
  SearchCheck
} from 'lucide-react';
import { useLineSet } from '../context/LineSetContext.jsx';

const ShiftIncharge = () => {
  const navigate = useNavigate();
  const { shopId } = useParams();
  const { clearLineSet, setLineSet } = useLineSet();

  React.useEffect(() => {
    clearLineSet();

    setLineSet({
      machineShop: shopId,
      lineCode : "",
      partName :"",
      partNo : "",
      machineNo : ""
    });
  }, [shopId]);

  const buttons = [
    { name: "Pre-Operation Checklist", path: `/shift-incharge/${shopId}/pre-operation-checklist`, icon: ClipboardCheck },
    { name: "Error-Proofing CheckSheet", path: `/shift-incharge/${shopId}/error-proofing-checksheet`, icon: ShieldCheck },
    { name: "Air-Gap-Sensor CheckSheet", path: `/shift-incharge/${shopId}/air-gap-sensor`, icon: PenLine },
    { name: "Four-M-Change-Monitoring CheckSheet", path: `/shift-incharge/${shopId}/four-m-change-monitoring`, icon: RefreshCw },
    { name: "Record Of Significant Event", path: `/shift-incharge/${shopId}/significant-event-record`, icon: FileClock },
    { name: "Tool Change Record", path: `/shift-incharge/${shopId}/tool-change-record`, icon: Wrench },
    { name: "Daily Production Report", path: `/shift-incharge/${shopId}/daily-production-report`, icon: FileText },
    { name: "Daily Production Idle Time Report", path: `/shift-incharge/${shopId}/daily-production-idle-time-report`, icon: Clock },
    { name: "Breakdown Intimation / Service Report", path: `/shift-incharge/${shopId}/breakdown-intimation-service-report`, icon: AlertTriangle },
    { name: "Skill Evaluation - Practical Production and Quantity", path: `/shift-incharge/${shopId}/skill-evaluation-practical`, icon: BadgeCheck },
    { name: "Operator Observation Sheet", path: `/shift-incharge/${shopId}/operator-observation-sheet`, icon: SearchCheck },
    { name: "Competency Evaluation Form", path: `/shift-incharge/${shopId}/competency-evaluation-form`, icon: ShieldCheck },
    { name: "Corrective Action Register", path: `/shift-incharge/${shopId}/corrective-action-register`, icon: ClipboardCheck },
    { name: "Jig / Fixture Issue Intimation Report", path: `/shift-incharge/${shopId}/jig-fixture-intimation-report`, icon: Wrench }
  ];

  return (
    <div className="min-h-screen w-full bg-[#2d2d2d] flex flex-col relative font-sans">
      <Header />

      <div className="flex-1 flex flex-col items-center px-6 py-12 relative z-10">
        <div className="mb-12 text-center">
          <p className="text-sm md:text-base font-black text-[#ff9100] tracking-[0.3em] uppercase mb-2">
            Machine Shop-{shopId}
          </p>
          <h2 className="text-2xl md:text-3xl font-black text-white tracking-[0.2em] uppercase mb-3">
            Shift Incharge Control Panel
          </h2>
          <div className="w-20 h-1.5 bg-gradient-to-r from-orange-600 via-[#ff9100] to-orange-600 mx-auto rounded-full"></div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-[1400px] w-full pb-10">
          {buttons.map((btn) => {
            const Icon = btn.icon;
            return (
              <button
                key={btn.path}
                onClick={() => navigate(btn.path)}
                className="
                  group relative flex flex-col items-center justify-center p-8 
                  bg-[#383838] border border-[#4a4a4a] rounded-2xl
                  shadow-[0_8px_20px_rgba(0,0,0,0.3)]
                  hover:border-transparent hover:bg-gradient-to-br hover:from-[#ff9100] hover:to-[#e68200] 
                  hover:shadow-[0_15px_30px_rgba(255,145,0,0.3)]
                  hover:-translate-y-1.5 active:translate-y-0
                  transition-all duration-300 ease-out cursor-pointer
                "
              >
                <div className="mb-5 p-4 bg-[#2d2d2d] group-hover:bg-white/20 rounded-full border border-[#4a4a4a] group-hover:border-white/30 shadow-inner transition-colors duration-300">
                  <Icon className="w-8 h-8 text-[#ff9100] group-hover:text-white transition-colors duration-300" strokeWidth={2.5} />
                </div>
                <span className="text-[15px] font-bold text-gray-200 group-hover:text-white text-center tracking-wide leading-snug">
                  {btn.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default ShiftIncharge