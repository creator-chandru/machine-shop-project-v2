import { useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { ArrowLeft, LogOut, ChevronDown, Clock } from "lucide-react";
import logo from "../Assets/logo.png";

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // --- Initialize User & Clock ---
  useEffect(() => {
    const data = localStorage.getItem("user");
    if (data) setUser(JSON.parse(data));

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // --- Click Outside to Close Dropdown ---
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("user");
    navigate("/", { replace: true });
  };

  if (!user) return null;

  // --- Dynamic Dashboard Logic ---
  const dashboardPaths = ['/operator', '/hod', '/hof', '/admin', '/supervisor'];
  const isDashboard = dashboardPaths.includes(location.pathname);

  const handleBack = () => {
    const path = location.pathname;
    if(path === "/machine-shops"){
      navigate("/");
      return;
    }

    // 1. FORM → DASHBOARD
    // Matches: /shift-incharge/:shopId/:formName OR /operator/:shopId/:formName
    const formPattern = /^\/(operator|shift-incharge)\/([^/]+)\/.+/;
    const formMatch = path.match(formPattern);

    if (formMatch) {
      const [, roleSegment, shopId] = formMatch;

      // Operator dashboard has been scrapped.
      // Redirect old operator form routes to shift-incharge dashboard.
      const dashboardRole =
        roleSegment === "operator" ? "shift-incharge" : roleSegment;

      navigate(`/${dashboardRole}/${shopId}`);
      return;
    }

    // 2. DASHBOARD → MACHINE SHOPS
    // Matches: /shift-incharge/:shopId OR /operator/:shopId
    const dashboardPattern = /^\/(operator|shift-incharge)\/[^/]+$/;

    if (dashboardPattern.test(path)) {
      navigate("/machine-shops");
      return;
    }

    // Fallback
    navigate("/machine-shops");
  };

  const userInitial = user.username ? user.username.charAt(0).toUpperCase() : "U";

  return (
    <header className="sticky top-0 z-[100] w-full bg-[#050B14] border-b border-[#1A2634] shadow-[0_15px_40px_-10px_rgba(0,0,0,0.8)] relative">
      
      {/* 🌟 Isolated Background Layer */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1A2634_1px,transparent_1px),linear-gradient(to_bottom,#1A2634_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_100%_at_50%_0%,#000_70%,transparent_100%)] opacity-30"></div>
      </div>

      {/* 🌟 Top High-Visibility Glow Line */}
      <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-orange-600 via-[#ff9100] to-orange-600 shadow-[0_0_15px_rgba(255,145,0,0.5)]"></div>

      <div className="flex justify-between items-center px-5 md:px-8 h-[95px] max-w-[1920px] mx-auto relative z-10">
        
        {/* =========================================
            1. LEFT: TACTILE CONTROLS & LOGO
        ========================================= */}
        <div className="flex-1 flex justify-start items-center gap-6">
          {!isDashboard && (
            <button
              onClick={handleBack}
              className="group flex items-center justify-center w-12 h-12 bg-gradient-to-b from-[#162232] to-[#0A121C] hover:from-[#ff9100] hover:to-orange-600 text-gray-400 hover:text-white rounded-xl border border-[#213043] hover:border-transparent shadow-[inset_0_2px_4px_rgba(255,255,255,0.05),0_4px_10px_rgba(0,0,0,0.4)] transition-all duration-300"
              title="Return to Dashboard"
            >
              <ArrowLeft className="w-6 h-6 group-hover:-translate-x-1 group-active:scale-95 transition-all duration-300" />
            </button>
          )}
          
          <div className="flex items-center gap-5">
            <div className="bg-gradient-to-b from-gray-50 to-gray-300 p-2.5 rounded-xl flex items-center justify-center shadow-[inset_0_-3px_8px_rgba(0,0,0,0.2),0_5px_15px_rgba(0,0,0,0.5)] border-t-2 border-white cursor-pointer hover:brightness-110 transition-all duration-300">
              <img src={logo} alt="Sakthi Auto" className="h-8 md:h-12 w-auto object-contain drop-shadow-sm" />
            </div>
            
            <div className="hidden xl:flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-1.5 h-1.5 rounded-full bg-[#ff9100] shadow-[0_0_8px_rgba(255,145,0,0.8)] animate-pulse"></div>
                <span className="text-[11px] font-black text-[#ff9100] uppercase tracking-[0.35em] leading-none drop-shadow-md">
                  Sakthi Auto Component
                </span>
              </div>
              <h1 className="text-2xl font-black uppercase tracking-widest text-white leading-none flex items-center gap-3">
                <span className="bg-gradient-to-b from-white to-gray-400 bg-clip-text text-transparent">
                  {user.role}
                </span>
                <span className="text-[#1A2634] font-black text-2xl leading-none translate-y-[1px]">/</span> 
                <span className="text-gray-500 font-bold tracking-[0.25em]">PORTAL</span>
              </h1>
            </div>
          </div>
        </div>

        {/* =========================================
            2. CENTER: DIGITAL LED GAUGE PANEL
        ========================================= */}
        <div className="hidden lg:flex flex-shrink-0 flex-col items-center justify-center">
          <div className="bg-[#02050A] border border-[#1A2634] rounded-xl px-7 py-3.5 flex items-center gap-6 shadow-[inset_0_4px_25px_rgba(0,0,0,1),0_1px_1px_rgba(255,255,255,0.05)]">
            <div className="flex items-center gap-3">
              <Clock size={18} className="text-[#ff9100] drop-shadow-[0_0_8px_rgba(255,145,0,0.6)]" />
              <span className="text-xl font-bold text-[#ff9100] tracking-[0.15em] font-mono drop-shadow-[0_0_8px_rgba(255,145,0,0.5)]">
                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
            <div className="w-px h-7 bg-gradient-to-b from-transparent via-[#1A2634] to-transparent"></div>
            <span className="text-sm font-bold text-gray-400 uppercase tracking-[0.2em] font-mono">
              {currentTime.toLocaleDateString([], { weekday: 'short', month: 'short', day: '2-digit', year: 'numeric' })}
            </span>
          </div>
        </div>

        {/* =========================================
            3. RIGHT: USER PROFILE & SIMPLE DROPDOWN
        ========================================= */}
        <div className="flex-1 flex justify-end items-center relative z-[999]" ref={dropdownRef}>
          <div className="relative">
            
            {/* User Action Pill */}
            <button 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className={`group flex items-center gap-4 pl-2 pr-5 py-2 rounded-full border-2 transition-all duration-300 
                ${isDropdownOpen 
                  ? 'bg-[#101A28] border-[#ff9100] shadow-[0_0_20px_rgba(255,145,0,0.15)]' 
                  : 'bg-gradient-to-r from-[#0B121C] to-[#070D14] border-[#1A2634] hover:border-[#213043] shadow-[0_4px_15px_rgba(0,0,0,0.5)]'}
              `}
            >
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#ff9100] to-[#cc7400] flex items-center justify-center text-white font-black text-lg shadow-[inset_0_-2px_6px_rgba(0,0,0,0.4),0_0_10px_rgba(255,145,0,0.3)] border border-[#ffaa33] group-active:scale-95 transition-transform duration-200">
                {userInitial}
              </div>
              <div className="hidden md:flex flex-col text-left justify-center">
                <span className="text-[10px] text-[#8A9EB5] font-bold uppercase tracking-[0.3em] leading-none mb-1.5">
                  Welcome
                </span>
                <span className="text-[15px] text-gray-100 font-black tracking-wider leading-none capitalize group-hover:text-white transition-colors">
                  {user.username}
                </span>
              </div>
              <ChevronDown size={18} className={`text-gray-500 ml-2 transition-transform duration-300 hidden md:block ${isDropdownOpen ? 'rotate-180 text-[#ff9100]' : 'group-hover:text-gray-300'}`} />
            </button>

            {/* Clean & Bright Oval Logout Dropdown */}
            {isDropdownOpen && (
              <div className="absolute right-0 mt-4 w-52 bg-[#0A121C] border border-[#213043] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.9)] origin-top-right animate-in fade-in zoom-in-95 duration-200 z-[1000] p-3">
                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center justify-between px-5 py-3 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-800 hover:to-red-800 text-white rounded-full shadow-[0_0_15px_rgba(220,38,38,0.5)] hover:shadow-[0_0_25px_rgba(239,68,68,0.8)] transition-all duration-300 group"
                >
                  <span className="text-sm font-bold tracking-wider drop-shadow-md">Logout</span>
                  <LogOut size={18} className="group-hover:translate-x-1 transition-transform drop-shadow-md" /> 
                </button>
              </div>
            )}
            
          </div>
        </div>

      </div>
    </header>
  );
};

export default Header;