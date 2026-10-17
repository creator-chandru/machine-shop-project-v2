import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import Header from "../components/Header";
import EditPartMapping from "../components/EditPartMapping";
import JobSetupMasterConfigurator from "../components/jobSetupMasterConfigurator.jsx";
import AddPartSetModal from "../components/AddPartSetModal.jsx";
import { 
  RefreshCw, 
  Loader, 
  X, 
  FileSpreadsheet, 
  FileText, 
  FileSearch, 
  ClipboardCheck, 
  Settings2, 
  Layers, 
  ChevronRight,
  BookOpen, 
  UserCheck,
  Building2,
  SlidersHorizontal,
  CheckCircle2,
  Plus
} from "lucide-react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const API_URL = process.env.REACT_APP_API_URL || "";

const Hof = () => {
  const { shopId } = useParams();

  const [activeFormType, setActiveFormType] = useState("daily-production"); // "daily-production" | "significant" | "8d-report" | "job-setup" | "job-setup-master" | "operator-observation"
  const [pendingReports, setPendingReports] = useState([]);
  const [pendingSignificantReports, setPendingSignificantReports] = useState([]);
  const [pendingEightDReports, setPendingEightDReports] = useState([]);
  const [pendingJobSetupReports, setPendingJobSetupReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [isAddPartSetOpen, setIsAddPartSetOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // QF Manager States
  const [isQfManagerOpen, setIsQfManagerOpen] = useState(false);
  const [qfSettings, setQfSettings] = useState([]);
  const [savingId, setSavingId] = useState(null);

  const currentUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  })();
  const currentHOF = currentUser.username || currentUser.employeeId || "hof";

  const [pendingObservationReports, setPendingObservationReports] = useState([]);

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-GB");
  };

  const fetchPendingReports = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${API_URL}/api/daily-production-report/hof/${encodeURIComponent(currentHOF)}?shopId=${shopId || 3}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setPendingReports(Array.isArray(data) ? data : []);
      } else {
        setPendingReports([]);
      }
    } catch (err) {
      toast.error("Failed to load pending HOF approval reports.");
      setPendingReports([]);
    }
  };

  const fetchPendingSignificantReports = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${process.env.REACT_APP_API_URL || "http://localhost:5000"}/api/significant-event-pending/hof/${encodeURIComponent(currentHOF)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setPendingSignificantReports(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      toast.error("Failed to load Pending Significant Event Reports.");
    }
  };

  const fetchPendingEightDReports = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${API_URL}/api/8d-report/hof/${encodeURIComponent(currentHOF)}?shopId=${shopId || 3}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setPendingEightDReports(Array.isArray(data) ? data : []);
      } else {
        setPendingEightDReports([]);
      }
    } catch (err) {
      toast.error("Failed to load Pending 8D Reports.");
      setPendingEightDReports([]);
    }
  };

  const fetchPendingJobSetupReports = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${API_URL}/api/job-setup-verification/hof/${encodeURIComponent(currentHOF)}?shopId=${shopId || 3}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setPendingJobSetupReports(Array.isArray(data) ? data : []);
      } else {
        setPendingJobSetupReports([]);
      }
    } catch (err) {
      toast.error("Failed to load Pending Job Setup Verifications.");
      setPendingJobSetupReports([]);
    }
  };

  const fetchPendingObservationReports = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${API_URL}/api/operator-observation-sheet/pending/hof/${encodeURIComponent(currentHOF)}?shopId=${shopId || 3}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setPendingObservationReports(Array.isArray(data) ? data : []);
      } else {
        setPendingObservationReports([]);
      }
    } catch (err) {
      toast.error("Failed to load Pending Observation Reports.");
      setPendingObservationReports([]);
    }
  };

  // Fetch QF Settings
  const fetchQfSettings = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/qf-values`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setQfSettings(data);
      }
    } catch (error) {
      toast.error("Failed to load QF values.");
    }
  };

  // Update specific QF Setting
  const handleSaveSingleQfSetting = async (setting) => {
    setSavingId(setting.formName);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/qf-values`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ setting })
      });
      if (res.ok) {
        toast.success(`${setting.formName.replace('-', ' ')} QF updated!`);
        fetchQfSettings();
      } else {
        toast.error("Failed to save QF value.");
      }
    } catch (error) {
      toast.error("Failed to save QF value.");
    }
    setSavingId(null);
  };

  useEffect(() => {
    if (activeFormType === "significant") {
      fetchPendingSignificantReports();
    } else if (activeFormType === "8d-report") {
      fetchPendingEightDReports();
    } else if (activeFormType === "job-setup") {
      fetchPendingJobSetupReports();
    } else if (activeFormType === "daily-production") {
      fetchPendingReports();
    } else if (activeFormType === "operator-observation") {
      fetchPendingObservationReports();
    }
  }, [shopId, activeFormType]);

  const handleOpenReviewModal = async (report) => {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setSelectedReport(report);
    setPdfUrl(null);
    setIsPdfLoading(true);

    try {
      const rawDate = report.reportDate || report.checkDate || report.recordDate;
      let isoDate = rawDate;
      if (rawDate && rawDate.includes("/")) {
        const parts = rawDate.split("/");
        if (parts.length === 3) {
          isoDate = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
        }
      } else if (rawDate && rawDate.includes("T")) {
        isoDate = rawDate.split("T")[0];
      }

      const token = localStorage.getItem("token");
      let reportPath = "";
      const params = new URLSearchParams();

      if (activeFormType === "significant") {
        params.append("lineCode", report.lineCode || "");
        params.append("partName", report.partName || "");
        params.append("date", isoDate);
        params.append("event", report.event || "");
        params.append("shift", report.shift || "I");
        reportPath = `${process.env.REACT_APP_API_URL || "http://localhost:5000"}/api/significant-event-report?${params.toString()}`;
      } else if (activeFormType === "8d-report") {
        params.append("shopId", String(report.machineShop || shopId || 3));
        params.append("date", isoDate);
        params.append("shift", report.shift || "1ST");
        params.append("partNo", report.partNo || "");
        params.append("customer", report.customer || "");
        reportPath = `${API_URL}/api/8d-report/pdf?${params.toString()}`;
      } else if (activeFormType === "job-setup") {
        params.append("partName", report.partName || "");
        params.append("date", isoDate);
        params.append("shopId", String(report.machineShop || shopId || 3));
        params.append("shift", report.shift || "");
        params.append("operationNo", report.operationNo || "");
        reportPath = `${API_URL}/api/job-setup-verification/report?${params.toString()}`;
      } else if (activeFormType === "operator-observation") {
        params.append("machineShop", String(report.machineShop || shopId || 3));
        params.append("employeeCode", report.employeeCode);
        params.append("testDate", isoDate);
        reportPath = `${API_URL}/api/operator-observation-sheet/report?${params.toString()}`;
      } else {
        params.append("lineCode", report.lineCode);
        params.append("date", isoDate);
        params.append("shopId", String(report.machineShop || shopId || 3));
        if (report.shift) {
          params.append("shift", report.shift);
        }
        reportPath = `${API_URL}/api/daily-production-report/report?${params.toString()}`;
      }

      const res = await fetch(reportPath, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Report request failed");

      const blob = await res.blob();
      setPdfUrl(URL.createObjectURL(blob));
    } catch (err) {
      toast.error("Failed to generate report preview.");
    }
    setIsPdfLoading(false);
  };

  const submitHofSignature = async () => {
    try {
      const rawDate = selectedReport.reportDate || selectedReport.checkDate || selectedReport.recordDate;
      let isoDate = rawDate;
      if (rawDate && rawDate.includes("/")) {
        const parts = rawDate.split("/");
        if (parts.length === 3) {
          isoDate = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
        }
      }

      let signEndpoint = "";
      let payload = {};

      if (activeFormType === "significant") {
        signEndpoint = `${process.env.REACT_APP_API_URL || "http://localhost:5000"}/api/significant-event-sign`;
        payload = {
          role: "hof",
          username: currentHOF,
          lineCode: selectedReport.lineCode,
          partName: selectedReport.partName,
          recordDate: isoDate,
          event: selectedReport.event,
          shift: selectedReport.shift || "I",
        };
      } else if (activeFormType === "8d-report") {
        signEndpoint = `${API_URL}/api/8d-report/sign-hof`;
        payload = {
          partNo: selectedReport.partNo,
          date: isoDate,
          shift: selectedReport.shift || "1ST",
          signature: currentHOF,
          hofUsername: currentHOF,
        };
      } else if (activeFormType === "job-setup") {
        signEndpoint = `${API_URL}/api/job-setup-verification/sign-hof`;
        payload = {
          id: selectedReport.id,
          signature: currentHOF,
          username: currentHOF,
        };
      } else if (activeFormType === "operator-observation") {
        signEndpoint = `${API_URL}/api/operator-observation-sheet/sign-hof`;
        payload = {
          employeeCode: selectedReport.employeeCode,
          date: isoDate,
          signature: currentHOF,
        };
      } else {
        signEndpoint = `${API_URL}/api/daily-production-report/sign-hof`;
        payload = {
          lineCode: selectedReport.lineCode,
          date: isoDate,
          shift: selectedReport.shift || "I",
          signature: currentHOF,
          hofUsername: currentHOF,
        };
      }

      const res = await fetch(signEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Approval failed");

      toast.success("Report approved successfully!", { autoClose: 2000 });

      setTimeout(() => {
        setSelectedReport(null);
        if (activeFormType === "significant") {
          fetchPendingSignificantReports();
        } else if (activeFormType === "8d-report") {
          fetchPendingEightDReports();
        } else if (activeFormType === "job-setup") {
          fetchPendingJobSetupReports();
        } else if (activeFormType === "operator-observation") {
          fetchPendingObservationReports();
        } else {
          fetchPendingReports();
        }
      }, 1500);
    } catch (err) {
      toast.error("Failed to save HOF approval.");
    }
  };

  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    await Promise.all([
      fetchPendingReports(),
      fetchPendingSignificantReports(),
      fetchPendingEightDReports(),
      fetchPendingJobSetupReports(),
      fetchPendingObservationReports()
    ]);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  return (
    <div className="min-h-screen w-full bg-[#2d2d2d] font-sans text-gray-100 pb-16 selection:bg-[#ff9100]/30 selection:text-white">
      <Header />
      <ToastContainer position="top-right" autoClose={2000} theme="dark" />

      {/* Main Page Content */}
      <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
        
        {/* Primary Verification Workspace Card */}
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden text-gray-800">
          
          {/* Card Topbar: Header, Logged In Info, and Controls */}
          <div className="px-6 py-5 border-b border-gray-200 bg-gray-50 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl md:text-2xl font-black text-gray-900 uppercase tracking-tight">
                  HOF Dashboard
                </h1>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase bg-[#ff9100]/15 text-[#ff9100] border border-[#ff9100]/30 shadow-sm">
                  <Building2 className="w-3.5 h-3.5" />
                  Machine Shop - {shopId || 3}
                </span>
              </div>
              <p className="text-xs text-gray-500 font-medium">
                Review and digitally verify daily production reports, significant events, 8D analyses, and job setup checks.
              </p>
            </div>

            <div className="flex items-center gap-3 self-start md:self-auto">
              <div className="flex items-center gap-2.5 bg-white border border-gray-300 px-3.5 py-1.5 rounded-xl shadow-sm text-xs">
                <UserCheck className="w-4 h-4 text-orange-600" />
                <span className="font-semibold text-gray-500">HOF:</span>
                <span className="font-extrabold text-gray-800 uppercase">{currentHOF}</span>
              </div>

              <button
                type="button"
                onClick={handleRefreshAll}
                className="p-2.5 bg-white hover:bg-gray-100 text-gray-600 hover:text-orange-600 rounded-xl border border-gray-300 shadow-sm transition-all cursor-pointer group"
                title="Refresh Records"
              >
                <RefreshCw className={`w-4 h-4 transition-transform duration-500 ${isRefreshing ? "animate-spin text-orange-600" : ""}`} />
              </button>
            </div>
          </div>

          {/* Navigation Tab Bar and Management Actions */}
          <div className="px-6 py-4 border-b border-gray-200 bg-white flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            
            {/* Segmented Form Selection Tabs */}
            <div className="inline-flex p-1 bg-gray-100 rounded-xl gap-1 border border-gray-200 flex-wrap">
              <button
                onClick={() => setActiveFormType("daily-production")}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-bold text-xs md:text-sm transition-all cursor-pointer ${
                  activeFormType === "daily-production"
                    ? "bg-orange-500 text-white shadow-md"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/60"
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                Daily Production
                {pendingReports.length > 0 && (
                  <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ml-1 ${
                    activeFormType === "daily-production" ? "bg-white text-orange-600" : "bg-gray-300 text-gray-800"
                  }`}>
                    {pendingReports.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveFormType("significant")}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-bold text-xs md:text-sm transition-all cursor-pointer ${
                  activeFormType === "significant"
                    ? "bg-orange-500 text-white shadow-md"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/60"
                }`}
              >
                <FileText className="w-4 h-4" />
                Significant Events
                {pendingSignificantReports.length > 0 && (
                  <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ml-1 ${
                    activeFormType === "significant" ? "bg-white text-orange-600" : "bg-gray-300 text-gray-800"
                  }`}>
                    {pendingSignificantReports.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveFormType("8d-report")}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-bold text-xs md:text-sm transition-all cursor-pointer ${
                  activeFormType === "8d-report"
                    ? "bg-orange-500 text-white shadow-md"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/60"
                }`}
              >
                <FileSearch className="w-4 h-4" />
                8D Problem Solving
                {pendingEightDReports.length > 0 && (
                  <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ml-1 ${
                    activeFormType === "8d-report" ? "bg-white text-orange-600" : "bg-gray-300 text-gray-800"
                  }`}>
                    {pendingEightDReports.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveFormType("job-setup")}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-bold text-xs md:text-sm transition-all cursor-pointer ${
                  activeFormType === "job-setup"
                    ? "bg-orange-500 text-white shadow-md"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/60"
                }`}
              >
                <ClipboardCheck className="w-4 h-4" />
                Job Setup
                {pendingJobSetupReports.length > 0 && (
                  <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ml-1 ${
                    activeFormType === "job-setup" ? "bg-white text-orange-600" : "bg-gray-300 text-gray-800"
                  }`}>
                    {pendingJobSetupReports.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveFormType("operator-observation")}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-bold text-xs md:text-sm transition-all cursor-pointer ${
                  activeFormType === "operator-observation"
                    ? "bg-orange-500 text-white shadow-md"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/60"
                }`}
              >
                <UserCheck className="w-4 h-4" />
                Operator Observations
                {pendingObservationReports.length > 0 && (
                  <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ml-1 ${
                    activeFormType === "operator-observation" ? "bg-white text-orange-600" : "bg-gray-300 text-gray-800"
                  }`}>
                    {pendingObservationReports.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveFormType("job-setup-master")}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-bold text-xs md:text-sm transition-all cursor-pointer ${
                  activeFormType === "job-setup-master"
                    ? "bg-orange-500 text-white shadow-md"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/60"
                }`}
              >
                <Settings2 className="w-4 h-4" />
                Job Setup Config
              </button>
            </div>

            {/* Quick Management Action Buttons */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                onClick={() => {
                  fetchQfSettings();
                  setIsQfManagerOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-gray-700 bg-gray-50 border border-gray-300 hover:border-[#ff9100] hover:text-[#ff9100] hover:bg-amber-50/50 shadow-sm transition-all cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#ff9100]" />
                Manage QF Values
              </button>
            </div>
          </div>

          {/* Section Body */}
          <div className="p-6 md:p-8">
            
            {/* TAB CONTENT: Daily Production */}
            {activeFormType === "daily-production" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-2">
                  <div>
                    <h3 className="text-base font-extrabold text-gray-900 uppercase tracking-wide">
                      Pending Daily Production Reports
                    </h3>
                    <p className="text-xs text-gray-500">Requires Head of Facility verification and sign-off for recorded shop output.</p>
                  </div>
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                    Total: {pendingReports.length}
                  </span>
                </div>

                {pendingReports.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 px-4 bg-gray-50/70 rounded-2xl border border-dashed border-gray-300 text-center space-y-3">
                    <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm">
                      <CheckCircle2 className="w-7 h-7" />
                    </div>
                    <h4 className="text-base font-bold text-gray-800">No Daily Production Reports Pending</h4>
                    <p className="text-xs text-gray-500 max-w-sm">All daily production records for this shop have been verified.</p>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm bg-white">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-900 text-slate-200 text-xs uppercase tracking-wider font-semibold">
                            <th className="py-3.5 px-4 font-bold w-16 text-center">ID</th>
                            <th className="py-3.5 px-4 font-bold">Date</th>
                            <th className="py-3.5 px-4 font-bold">Line Code</th>
                            <th className="py-3.5 px-4 font-bold">Shift</th>
                            <th className="py-3.5 px-4 font-bold">Part Details</th>
                            <th className="py-3.5 px-4 font-bold">Shift Incharge</th>
                            <th className="py-3.5 px-4 font-bold">QC Status</th>
                            <th className="py-3.5 px-4 font-bold text-right pr-6">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 text-sm">
                          {pendingReports.map((report) => (
                            <tr key={report.id} className="hover:bg-orange-50/30 transition-colors">
                              <td className="py-4 px-4 text-center font-bold text-gray-400 font-mono text-xs">
                                #{report.id}
                              </td>
                              <td className="py-4 px-4 font-medium text-gray-800 text-xs">
                                {formatDate(report.reportDate)}
                              </td>
                              <td className="py-4 px-4 font-extrabold text-gray-900">
                                <span className="px-2.5 py-1 rounded-md bg-gray-100 border border-gray-300 font-mono text-xs">
                                  {report.lineCode}
                                </span>
                              </td>
                              <td className="py-4 px-4 font-semibold text-gray-700 text-xs">
                                {report.shift || "I"}
                              </td>
                              <td className="py-4 px-4 font-semibold text-gray-800">
                                {report.partName || "N/A"}
                              </td>
                              <td className="py-4 px-4 text-gray-600 text-xs">
                                {report.shiftInchargeName || "Shift Incharge"}
                              </td>
                              <td className="py-4 px-4">
                                {report.verifiedByQcSignature && report.verifiedByQcSignature !== "Pending" ? (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-300">
                                    ✓ QC Verified
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800 border border-yellow-300">
                                    Pending QC
                                  </span>
                                )}
                              </td>
                              <td className="py-4 px-4 text-right pr-6">
                                <button
                                  onClick={() => handleOpenReviewModal(report)}
                                  className="inline-flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white px-4 py-2 rounded-xl font-bold text-xs tracking-wider uppercase shadow-md shadow-orange-500/20 transition-all cursor-pointer"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  Review & Sign
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: Significant Event Records */}
            {activeFormType === "significant" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-2">
                  <div>
                    <h3 className="text-base font-extrabold text-gray-900 uppercase tracking-wide">
                      Pending Significant Event Records
                    </h3>
                    <p className="text-xs text-gray-500">Unusual events, equipment downtime, or material changes requiring HOF sign-off.</p>
                  </div>
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                    Total: {pendingSignificantReports.length}
                  </span>
                </div>

                {pendingSignificantReports.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 px-4 bg-gray-50/70 rounded-2xl border border-dashed border-gray-300 text-center space-y-3">
                    <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm">
                      <CheckCircle2 className="w-7 h-7" />
                    </div>
                    <h4 className="text-base font-bold text-gray-800">No Significant Events Pending</h4>
                    <p className="text-xs text-gray-500 max-w-sm">No unresolved significant event records requiring HOF approval.</p>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm bg-white">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-900 text-slate-200 text-xs uppercase tracking-wider font-semibold">
                            <th className="py-3.5 px-4 font-bold">Date</th>
                            <th className="py-3.5 px-4 font-bold">Line Code</th>
                            <th className="py-3.5 px-4 font-bold">Part Name</th>
                            <th className="py-3.5 px-4 font-bold">Event Details</th>
                            <th className="py-3.5 px-4 font-bold text-right pr-6">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 text-sm">
                          {pendingSignificantReports.map((report, idx) => (
                            <tr key={`sig-${idx}`} className="hover:bg-orange-50/30 transition-colors">
                              <td className="py-4 px-4 font-medium text-gray-800 text-xs">
                                {formatDate(report.recordDate)}
                              </td>
                              <td className="py-4 px-4 font-extrabold text-orange-700">
                                <span className="px-2.5 py-1 rounded-md bg-orange-50 border border-orange-200 font-mono text-xs">
                                  {report.lineCode}
                                </span>
                              </td>
                              <td className="py-4 px-4 font-semibold text-gray-800">
                                {report.partName || "N/A"}
                              </td>
                              <td className="py-4 px-4 text-gray-600 text-xs">
                                {report.event || "N/A"}
                              </td>
                              <td className="py-4 px-4 text-right pr-6">
                                <button
                                  onClick={() => handleOpenReviewModal(report)}
                                  className="inline-flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white px-4 py-2 rounded-xl font-bold text-xs tracking-wider uppercase shadow-md shadow-orange-500/20 transition-all cursor-pointer"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  Review & Sign
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: 8D Problem Solving Reports */}
            {activeFormType === "8d-report" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-2">
                  <div>
                    <h3 className="text-base font-extrabold text-gray-900 uppercase tracking-wide">
                      Pending 8D Problem Solving Reports
                    </h3>
                    <p className="text-xs text-gray-500">Corrective action reports requiring managerial evaluation and sign-off.</p>
                  </div>
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                    Total: {pendingEightDReports.length}
                  </span>
                </div>

                {pendingEightDReports.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 px-4 bg-gray-50/70 rounded-2xl border border-dashed border-gray-300 text-center space-y-3">
                    <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm">
                      <CheckCircle2 className="w-7 h-7" />
                    </div>
                    <h4 className="text-base font-bold text-gray-800">No 8D Reports Pending</h4>
                    <p className="text-xs text-gray-500 max-w-sm">All 8D problem solving workflows for this facility are cleared.</p>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm bg-white">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-900 text-slate-200 text-xs uppercase tracking-wider font-semibold">
                            <th className="py-3.5 px-4 font-bold w-16 text-center">ID</th>
                            <th className="py-3.5 px-4 font-bold">Date</th>
                            <th className="py-3.5 px-4 font-bold">Customer</th>
                            <th className="py-3.5 px-4 font-bold">Part No</th>
                            <th className="py-3.5 px-4 font-bold">Part Name</th>
                            <th className="py-3.5 px-4 font-bold">Shift</th>
                            <th className="py-3.5 px-4 font-bold">QC Status</th>
                            <th className="py-3.5 px-4 font-bold text-right pr-6">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 text-sm">
                          {pendingEightDReports.map((report) => (
                            <tr key={`8d-${report.id}`} className="hover:bg-orange-50/30 transition-colors">
                              <td className="py-4 px-4 text-center font-bold text-gray-400 font-mono text-xs">
                                #{report.id}
                              </td>
                              <td className="py-4 px-4 font-medium text-gray-800 text-xs">
                                {formatDate(report.reportDate)}
                              </td>
                              <td className="py-4 px-4 font-bold text-gray-800">
                                {report.customer || "N/A"}
                              </td>
                              <td className="py-4 px-4 font-mono text-xs font-semibold text-gray-700">
                                {report.partNo || "N/A"}
                              </td>
                              <td className="py-4 px-4 text-gray-800 font-medium">
                                {report.partName || "N/A"}
                              </td>
                              <td className="py-4 px-4 font-semibold text-gray-700 text-xs">
                                Shift {report.shift || "1ST"}
                              </td>
                              <td className="py-4 px-4">
                                {report.verifiedByQcSignature && report.verifiedByQcSignature !== "Pending" ? (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-300">
                                    ✓ QC Verified
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800 border border-yellow-300">
                                    Pending QC
                                  </span>
                                )}
                              </td>
                              <td className="py-4 px-4 text-right pr-6">
                                <button
                                  onClick={() => handleOpenReviewModal(report)}
                                  className="inline-flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white px-4 py-2 rounded-xl font-bold text-xs tracking-wider uppercase shadow-md shadow-orange-500/20 transition-all cursor-pointer"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  Review & Sign
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: Job Setup Verification */}
            {activeFormType === "job-setup" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-2">
                  <div>
                    <h3 className="text-base font-extrabold text-gray-900 uppercase tracking-wide">
                      Pending Job Setup Verifications
                    </h3>
                    <p className="text-xs text-gray-500">Machine setup, setter validations, and inspector confirmations.</p>
                  </div>
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                    Total: {pendingJobSetupReports.length}
                  </span>
                </div>

                {pendingJobSetupReports.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 px-4 bg-gray-50/70 rounded-2xl border border-dashed border-gray-300 text-center space-y-3">
                    <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm">
                      <CheckCircle2 className="w-7 h-7" />
                    </div>
                    <h4 className="text-base font-bold text-gray-800">No Job Setup Reports Pending</h4>
                    <p className="text-xs text-gray-500 max-w-sm">All line machine tooling and setup checklists are current.</p>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm bg-white">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-900 text-slate-200 text-xs uppercase tracking-wider font-semibold">
                            <th className="py-3.5 px-4 font-bold w-16 text-center">ID</th>
                            <th className="py-3.5 px-4 font-bold">Date</th>
                            <th className="py-3.5 px-4 font-bold">Part Name</th>
                            <th className="py-3.5 px-4 font-bold">Operation No</th>
                            <th className="py-3.5 px-4 font-bold">Shift</th>
                            <th className="py-3.5 px-4 font-bold">Setter</th>
                            <th className="py-3.5 px-4 font-bold">Inspector Status</th>
                            <th className="py-3.5 px-4 font-bold text-right pr-6">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 text-sm">
                          {pendingJobSetupReports.map((report) => (
                            <tr key={`js-${report.id}`} className="hover:bg-orange-50/30 transition-colors">
                              <td className="py-4 px-4 text-center font-bold text-gray-400 font-mono text-xs">
                                #{report.id}
                              </td>
                              <td className="py-4 px-4 font-medium text-gray-800 text-xs">
                                {formatDate(report.reportDate)}
                              </td>
                              <td className="py-4 px-4 font-bold text-gray-800">
                                {report.partName || "N/A"}
                              </td>
                              <td className="py-4 px-4 font-semibold text-gray-700 text-xs">
                                {report.operationNo || "N/A"}
                              </td>
                              <td className="py-4 px-4 font-semibold text-gray-700 text-xs">
                                {report.shift || "1st"}
                              </td>
                              <td className="py-4 px-4 text-gray-600 text-xs">
                                {report.shiftInchargeName || "Shift Incharge"}
                              </td>
                              <td className="py-4 px-4">
                                <div className="flex flex-wrap gap-1.5">
                                  {report.verifiedByQcSignature && report.verifiedByQcSignature !== "Pending" ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-700 border border-green-300">
                                      ✓ QC
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-yellow-100 text-yellow-800 border border-yellow-300">
                                      Pending QC
                                    </span>
                                  )}
                                  {report.hofInspectionSignature && report.hofInspectionSignature !== "Pending" ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-700 border border-green-300">
                                      ✓ HOF-INSPN
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-yellow-100 text-yellow-800 border border-yellow-300">
                                      Pending HOF-INSPN
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-4 px-4 text-right pr-6">
                                <button
                                  onClick={() => handleOpenReviewModal(report)}
                                  className="inline-flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white px-4 py-2 rounded-xl font-bold text-xs tracking-wider uppercase shadow-md shadow-orange-500/20 transition-all cursor-pointer"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  Review & Sign
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: Operator Observations */}
            {activeFormType === "operator-observation" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-2">
                  <div>
                    <h3 className="text-base font-extrabold text-gray-900 uppercase tracking-wide">
                      Pending Operator Observations
                    </h3>
                    <p className="text-xs text-gray-500">Observation and technical adherence records requiring facility sign-off.</p>
                  </div>
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                    Total: {pendingObservationReports.length}
                  </span>
                </div>

                {pendingObservationReports.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 px-4 bg-gray-50/70 rounded-2xl border border-dashed border-gray-300 text-center space-y-3">
                    <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm">
                      <CheckCircle2 className="w-7 h-7" />
                    </div>
                    <h4 className="text-base font-bold text-gray-800">No Operator Observations Pending</h4>
                    <p className="text-xs text-gray-500 max-w-sm">All operator observation sheets have been reviewed.</p>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm bg-white">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-900 text-slate-200 text-xs uppercase tracking-wider font-semibold">
                            <th className="py-3.5 px-4 font-bold">Date</th>
                            <th className="py-3.5 px-4 font-bold">Employee Code</th>
                            <th className="py-3.5 px-4 font-bold">Employee Name</th>
                            <th className="py-3.5 px-4 font-bold">Shop ID</th>
                            <th className="py-3.5 px-4 font-bold text-right pr-6">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 text-sm">
                          {pendingObservationReports.map((report, idx) => (
                            <tr key={`obs-${idx}`} className="hover:bg-orange-50/30 transition-colors">
                              <td className="py-4 px-4 font-medium text-gray-800 text-xs">
                                {formatDate(report.reportDate)}
                              </td>
                              <td className="py-4 px-4 font-mono text-xs font-bold text-orange-700">
                                {report.employeeCode}
                              </td>
                              <td className="py-4 px-4 font-bold text-gray-800">
                                {report.employeeName}
                              </td>
                              <td className="py-4 px-4 text-gray-600 text-xs font-semibold">
                                Shop {report.machineShop}
                              </td>
                              <td className="py-4 px-4 text-right pr-6">
                                <button
                                  onClick={() => handleOpenReviewModal(report)}
                                  className="inline-flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white px-4 py-2 rounded-xl font-bold text-xs tracking-wider uppercase shadow-md shadow-orange-500/20 transition-all cursor-pointer"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  Review & Sign
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: Set Job Verification Set Up */}
            {activeFormType === "job-setup-master" && (
              <div className="pt-2">
                <JobSetupMasterConfigurator shopId={shopId} />
              </div>
            )}
          </div>
        </div>

        {/* BOTTOM SECTION: Line & Part Configurations & Part Set Registration */}
        <div className="space-y-6">
          
          {/* Component 1: Line & Part Mappings Container */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden text-gray-800">
            <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/70 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-orange-50 border border-orange-100 text-orange-600 shadow-sm">
                  <Settings2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-gray-900 tracking-wide uppercase">
                    Line & Part Mappings
                  </h2>
                  <p className="text-xs text-gray-500">
                    Configure machine routing, active toolings, and part number mappings for Machine Shop - {shopId || 3}
                  </p>
                </div>
              </div>
              <span className="self-start sm:self-auto px-3 py-1 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Matrix Active
              </span>
            </div>
            
            <div className="p-6 md:p-8">
              <EditPartMapping shopId={shopId} />
            </div>
          </div>

          {/* Component 2: Part Set Registration Card (Matching White Enterprise Theme) */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden text-gray-800">
            <div className="px-6 py-5 bg-gray-50/70 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[#ff9100] shadow-sm">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-extrabold text-gray-900 tracking-wide uppercase">
                      Part Set Registration
                    </h2>
                    <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase rounded-full bg-orange-100 text-orange-800 border border-orange-200">
                      Shop - {shopId || 3}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Register and configure new Part IDs and Part Names for machine shop inspection setups.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsAddPartSetOpen(true)}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#ff9100] hover:bg-[#e68200] active:scale-95 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md shadow-orange-500/20 transition-all cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" strokeWidth={2.5} />
                Add New Part Set
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Add Part Set Modal */}
      <AddPartSetModal
        isOpen={isAddPartSetOpen}
        onClose={() => setIsAddPartSetOpen(false)}
        defaultShopId={shopId || "3"}
      />

      {/* QF MANAGER MODAL */}
      {isQfManagerOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-[#2a2a2a] border border-[#444] w-full max-w-4xl rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col max-h-[85vh]">
            
            <div className="bg-gradient-to-r from-orange-600 to-[#ff9100] px-6 py-4 flex items-center justify-between shrink-0 shadow-md">
              <div className="flex items-center gap-3">
                <div className="bg-black/25 p-2 rounded-lg shadow-inner">
                  <SlidersHorizontal size={20} className="text-white" />
                </div>
                <div>
                  <h2 className="text-base font-black text-white uppercase tracking-wider leading-tight">
                    Manage QF Document Numbers
                  </h2>
                  <p className="text-[11px] text-white/80 font-medium">Configure format standards and revision dates</p>
                </div>
              </div>
              <button
                onClick={() => setIsQfManagerOpen(false)}
                className="text-white/70 hover:text-white bg-black/20 hover:bg-black/40 p-2 rounded-xl transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto bg-[#222] flex-1">
              {qfSettings.length === 0 ? (
                <div className="text-center text-gray-500 py-12 font-bold uppercase tracking-wider text-sm">
                  No QF Settings Found.
                </div>
              ) : (
                <div className="space-y-4">
                  {qfSettings.map((setting) => (
                    <div key={setting.formName} className="bg-[#2c2c2c] p-5 rounded-2xl border border-[#404040] flex flex-col md:flex-row gap-4 items-end">
                      <div className="flex-1 w-full">
                        <label className="block text-[11px] font-black uppercase tracking-wider text-[#ff9100] mb-2">
                          {setting.formName.replace(/-/g, ' ')} - QF Code
                        </label>
                        <input 
                          type="text" 
                          value={setting.qfValue} 
                          onChange={(e) => {
                            const val = e.target.value;
                            setQfSettings((prev) =>
                              prev.map((s) => (s.formName === setting.formName ? { ...s, qfValue: val } : s))
                            );
                          }}
                          className="w-full bg-[#1b1b1b] border border-[#444] p-3 rounded-xl text-gray-200 font-mono text-sm focus:outline-none focus:border-[#ff9100] shadow-inner"
                        />
                      </div>
                      <div className="w-full md:w-1/4">
                        <label className="block text-[11px] font-black uppercase tracking-wider text-[#ff9100] mb-2">
                          Effective Date
                        </label>
                        <input 
                          type="date" 
                          value={setting.date ? setting.date.split('T')[0] : ''} 
                          onChange={(e) => {
                            const val = e.target.value;
                            setQfSettings((prev) =>
                              prev.map((s) => (s.formName === setting.formName ? { ...s, date: val } : s))
                            );
                          }}
                          className="w-full bg-[#1b1b1b] border border-[#444] p-3 rounded-xl text-gray-200 font-mono text-sm focus:outline-none focus:border-[#ff9100] shadow-inner [color-scheme:dark]"
                        />
                      </div>
                      <button 
                        onClick={() => handleSaveSingleQfSetting(setting)} 
                        disabled={savingId === setting.formName}
                        className="bg-orange-600 hover:bg-orange-500 active:scale-95 text-white font-black text-xs uppercase tracking-wider px-6 py-3 rounded-xl transition-all shadow-md flex justify-center items-center gap-2 disabled:opacity-50 cursor-pointer shrink-0"
                      >
                        {savingId === setting.formName ? <Loader className="w-4 h-4 animate-spin" /> : "Update"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* FULL-SCREEN SPLIT REVIEW MODAL */}
      {selectedReport && (
        <div className="fixed inset-0 z-[8000] bg-slate-950/90 backdrop-blur-md flex flex-col overflow-hidden animate-fade-in">
          <div className="bg-slate-900 text-white px-8 py-4 flex justify-between items-center shrink-0 border-b border-slate-800 shadow-xl z-10">
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-xl bg-orange-500/20 text-[#ff9100]">
                <FileText className="w-5 h-5" />
              </span>
              <div>
                <h3 className="font-extrabold text-lg tracking-wide uppercase text-[#ff9100] leading-tight">
                  Review & Sign {
                    activeFormType === "significant"
                      ? "Significant Event Record"
                      : activeFormType === "8d-report"
                      ? "8D Problem Solving Report (HOF)"
                      : activeFormType === "job-setup"
                      ? "Job Setup Verification (HOF-PRODN)"
                      : activeFormType === "operator-observation"
                      ? "Operator Observation Sheet"
                      : "Daily Production Report (HOF)"
                  }
                </h3>
                <p className="text-xs text-gray-400">Examine PDF report details before recording official HOF digital sign-off</p>
              </div>
            </div>
            <button
              onClick={() => {
                if (pdfUrl) URL.revokeObjectURL(pdfUrl);
                setSelectedReport(null);
                setPdfUrl(null);
              }}
              className="text-gray-400 hover:text-white bg-slate-800 hover:bg-slate-700 p-2 rounded-xl transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            <div className="flex-1 h-full bg-[#3d4144] relative flex items-center justify-center">
              {isPdfLoading && (
                <Loader className="animate-spin text-white w-10 h-10 absolute" />
              )}
              {pdfUrl && (
                <iframe
                  src={`${pdfUrl}#toolbar=0&view=FitH`}
                  className="w-full h-full border-none relative z-10"
                  title="PDF Preview"
                />
              )}
            </div>

            <div className="w-full lg:w-[420px] bg-slate-900 text-gray-100 border-l border-slate-800 flex flex-col shrink-0 shadow-2xl z-10 overflow-y-auto">
              <div className="p-7 flex-1 flex flex-col justify-between">
                <div className="space-y-5">
                  <h4 className="text-xs font-black text-[#ff9100] tracking-widest uppercase">Report Metadata</h4>
                  
                  <div className="bg-slate-800/80 p-5 rounded-2xl border border-slate-700/80 shadow-inner flex flex-col gap-3 text-sm">
                    {selectedReport.lineCode && (
                      <div className="flex justify-between items-center border-b border-slate-700/60 pb-2">
                        <span className="text-xs font-bold text-gray-400 uppercase">Line Code</span>
                        <span className="font-mono font-bold text-white bg-slate-700/50 px-2 py-0.5 rounded text-xs">{selectedReport.lineCode}</span>
                      </div>
                    )}
                    {selectedReport.customer && (
                      <div className="flex justify-between items-center border-b border-slate-700/60 pb-2">
                        <span className="text-xs font-bold text-gray-400 uppercase">Customer</span>
                        <span className="font-bold text-white">{selectedReport.customer}</span>
                      </div>
                    )}
                    {selectedReport.partNo && (
                      <div className="flex justify-between items-center border-b border-slate-700/60 pb-2">
                        <span className="text-xs font-bold text-gray-400 uppercase">Part No</span>
                        <span className="font-mono text-xs font-bold text-gray-200">{selectedReport.partNo}</span>
                      </div>
                    )}
                    <div className="flex flex-col gap-1 border-b border-slate-700/60 pb-2">
                      <span className="text-xs font-bold text-gray-400 uppercase">Part Details</span>
                      <span className="font-bold text-gray-100 text-xs leading-relaxed">{selectedReport.partName || "N/A"}</span>
                    </div>
                    {activeFormType === "job-setup" && selectedReport.operationNo && (
                      <div className="flex justify-between items-center border-b border-slate-700/60 pb-2">
                        <span className="text-xs font-bold text-gray-400 uppercase">Operation No</span>
                        <span className="font-bold text-white">{selectedReport.operationNo}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center border-b border-slate-700/60 pb-2">
                      <span className="text-xs font-bold text-gray-400 uppercase">Date</span>
                      <span className="text-gray-300 font-medium">{formatDate(selectedReport.reportDate || selectedReport.recordDate)}</span>
                    </div>
                    {selectedReport.shift && (
                      <div className="flex justify-between items-center border-b border-slate-700/60 pb-2">
                        <span className="text-xs font-bold text-gray-400 uppercase">Shift</span>
                        <span className="text-white font-bold">{selectedReport.shift}</span>
                      </div>
                    )}
                    {activeFormType === "significant" && selectedReport.event && (
                      <div className="flex flex-col gap-1 border-b border-slate-700/60 pb-2">
                        <span className="text-xs font-bold text-gray-400 uppercase">Event</span>
                        <span className="text-gray-200 text-xs leading-relaxed">{selectedReport.event}</span>
                      </div>
                    )}
                    {activeFormType !== "significant" && (
                      <div className="flex justify-between items-center pt-1">
                        <span className="text-xs font-bold text-gray-400 uppercase">Shift Incharge</span>
                        <span className="text-gray-300 font-medium">{selectedReport.shiftInchargeName || "Shift Incharge"}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-6">
                  <button
                    onClick={submitHofSignature}
                    className="w-full bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 active:scale-98 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-emerald-900/40 transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Approve Report
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Hof;