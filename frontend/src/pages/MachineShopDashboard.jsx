import React from 'react';
import { useNavigate } from "react-router-dom";
import Header from '../components/Header';
import { Factory } from 'lucide-react';

const MachineShopDashboard = () => {
  const navigate = useNavigate();

  const user = JSON.parse(localStorage.getItem("user"));
  
  // Safely convert to lowercase and remove spaces
  const role = user?.role?.toLowerCase().replace(/\s+/g, '');

  const roleBasePath = {
    admin: "/admin",
    shiftincharge: "/shift-incharge",
    operator: "/operator",
    hod: "/hod",
    hof: "/hof",
    productengineer: "/product-engineer",
    gm: "/gm",
    qc: "/qc",
    hofinspection: "/hof-inspection" // <-- Added mapping for HOF Inspection
  };

  const machineShops = [
    { name: "Machine Shop-1", id: "1", icon: Factory },
    { name: "Machine Shop-2", id: "2", icon: Factory },
    { name: "Machine Shop-3", id: "3", icon: Factory },
    { name: "Machine Shop-4", id: "4", icon: Factory },
    { name: "Machine Shop-5", id: "5", icon: Factory }
  ];

  return (
    <div className="min-h-screen w-full bg-[#2d2d2d] flex flex-col relative font-sans">
      <Header />

      <div className="flex-1 flex flex-col items-center px-6 py-12 relative z-10">
        <div className="mb-12 text-center">
          <h2 className="text-2xl md:text-3xl font-black text-white tracking-[0.2em] uppercase mb-3">
            Machine Shop Selection
          </h2>
          <div className="w-20 h-1.5 bg-gradient-to-r from-orange-600 via-[#ff9100] to-orange-600 mx-auto rounded-full"></div>
        </div>

        <div className="flex flex-wrap justify-center gap-6 max-w-[1200px] w-full pb-10">
          {machineShops.map((shop) => {
            const Icon = shop.icon;
            return (
              <button
                key={shop.id}
                onClick={() => navigate(`${roleBasePath[role] || "/"}/${shop.id}`)}
                className="
                  group relative flex flex-col items-center justify-center p-8 
                  w-full sm:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)] max-w-[380px]
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
                  {shop.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default MachineShopDashboard;