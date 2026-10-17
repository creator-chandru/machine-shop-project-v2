import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Header from "../components/Header";
import { 
  ClipboardCheck, 
  RefreshCw, 
  Loader, 
  X, 
  FileSpreadsheet, 
  Wrench, 
  FileText,
  FileSearch,
  Building2,
  UserCheck,
  CheckCircle2
} from "lucide-react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const QC = () => {
  const navigate = useNavigate();
  const { shopId } = useParams();

  const [activeFormType, setActiveFormType] = useState("tool-change"); // "tool-change" | "daily-production" | "significant" | "8d-report" | "job-setup"
  const [pendingReports, setPendingReports] = useState([]);
  const [pendingSignificantReports, setPendingSignificantReports] = useState([]);
  const [pendingEightDReports, setPendingEightDReports] = useState([]);
  const [pendingJobSetupReports, setPendingJobSetupReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const currentUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  })();
  const currentQC = currentUser.username || currentUser.employeeId || "qc";

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
      const endpoint =
        activeFormType === "tool-change"
          ? `${process.env.REACT_APP_API_URL || ""}/api/tool-change-record/qc/${encodeURIComponent(currentQC)}?shopId=${shopId || 3}`
          : `${process.env.REACT_APP_API_URL || ""}/api/daily-production-report/qc/${encodeURIComponent(currentQC)}?shopId=${shopId || 3}`;

      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setPendingReports(Array.isArray(data) ? data : []);
      } else {
        setPendingReports([]);
      }
    } catch (err) {
      toast.error("Failed to load approval reports.");
      setPendingReports([]);
    }
  };

  const fetchPendingSignificantReports = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${process.env.REACT_APP_API_URL || "http://localhost:5000"}/api/significant-event-pending/qc/${encodeURIComponent(currentQC)}`,
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
        `${process.env.REACT_APP_API_URL || ""}/api/8d-report/qc/${encodeURIComponent(currentQC)}?shopId=${shopId || 3}`,
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
        `${process.env.REACT_APP_API_URL || ""}/api/job-setup-verification/qc/${encodeURIComponent(currentQC)}?shopId=${shopId || 3}`,
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

  useEffect(() => {
    if (activeFormType === "significant") {
      fetchPendingSignificantReports();
    } else if (activeFormType === "8d-report") {
      fetchPendingEightDReports();
    } else if (activeFormType === "job-setup") {
      fetchPendingJobSetupReports();
    } else {
      fetchPendingReports();
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
        params.append("shift", report.shift || "");
        reportPath = `${process.env.REACT_APP_API_URL || "http://localhost:5000"}/api/significant-event-report?${params.toString()}`;
      } else if (activeFormType === "8d-report") {
        params.append("shopId", String(report.machineShop || shopId || 3));
        params.append("date", isoDate);
        params.append("shift", report.shift || "1ST");
        params.append("partNo", report.partNo || "");
        params.append("customer", report.customer || "");
        reportPath = `${process.env.REACT_APP_API_URL || ""}/api/8d-report/pdf?${params.toString()}`;
      } else if (activeFormType === "job-setup") {
        params.append("partName", report.partName || "");
        params.append("date", isoDate);
        params.append("shopId", String(report.machineShop || shopId || 3));
        reportPath = `${process.env.REACT_APP_API_URL || ""}/api/job-setup-verification/report?${params.toString()}`;
      } else {
        params.append("lineCode", report.lineCode);
        params.append("date", isoDate);
        params.append("shopId", String(report.machineShop || shopId || 3));

        if (activeFormType === "daily-production" && report.shift) {
          params.append("shift", report.shift);
        }

        reportPath =
          activeFormType === "tool-change"
            ? `${process.env.REACT_APP_API_URL || ""}/api/tool-change-record/report?${params.toString()}`
            : `${process.env.REACT_APP_API_URL || ""}/api/daily-production-report/report?${params.toString()}`;
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

  const submitQcSignature = async () => {
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
          role: "qc",
          username: currentQC,
          lineCode: selectedReport.lineCode,
          partName: selectedReport.partName,
          recordDate: isoDate,
          event: selectedReport.event,
          shift: selectedReport.shift || "I",
        };
      } else if (activeFormType === "8d-report") {
        signEndpoint = `${process.env.REACT_APP_API_URL || ""}/api/8d-report/sign-qc`;
        payload = {
          partNo: selectedReport.partNo,
          date: isoDate,
          shift: selectedReport.shift || "1ST",
          signature: currentQC,
          qcUsername: currentQC,
        };
      } else if (activeFormType === "job-setup") {
        signEndpoint = `${process.env.REACT_APP_API_URL || ""}/api/job-setup-verification/sign-qc`;
        payload = {
          id: selectedReport.id,
          signature: currentQC,
          username: currentQC,
        };
      } else {
        signEndpoint =
          activeFormType === "tool-change"
            ? `${process.env.REACT_APP_API_URL || ""}/api/tool-change-record/sign-qc`
            : `${process.env.REACT_APP_API_URL || ""}/api/daily-production-report/sign-qc`;

        payload =
          activeFormType === "tool-change"
            ? {
                lineCode: selectedReport.lineCode,
                date: isoDate,
                machineNo: selectedReport.machineNo,
                signature: currentQC,
                qcUsername: currentQC,
              }
            : {
                lineCode: selectedReport.lineCode,
                date: isoDate,
                shift: selectedReport.shift || "I",
                signature: currentQC,
                qcUsername: currentQC,
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
        } else {
          fetchPendingReports();
        }
      }, 1500);
    } catch (err) {
      toast.error("Failed to save QC approval.");
    }
  };

  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    await Promise.all([
      fetchPendingReports(),
      fetchPendingSignificantReports(),
      fetchPendingEightDReports(),
      fetchPendingJobSetupReports()
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
                  QC Verification Dashboard
                </h1>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase bg-[#ff9100]/15 text-[#ff9100] border border-[#ff9100]/30 shadow-sm">
                  <Building2 className="w-3.5 h-3.5" />
                  Machine Shop - {shopId || 3}
                </span>
              </div>
              <p className="text-xs text-gray-500 font-medium">
                Review and digitally verify pending tool change records, daily production, significant events, and inspection checklists.
              </p>
            </div>

            <div className="flex items-center gap-3 self-start md:self-auto">
              <div className="flex items-center gap-2.5 bg-white border border-gray-300 px-3.5 py-1.5 rounded-xl shadow-sm text-xs">
                <UserCheck className="w-4 h-4 text-orange-600" />
                <span className="font-semibold text-gray-500">QC:</span>
                <span className="font-extrabold text-gray-800 uppercase">{currentQC}</span>
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

          {/* Form Selection Tabs */}
          <div className="px-6 py-4 border-b border-gray-200 bg-white">
            <div className="inline-flex p-1 bg-gray-100 rounded-xl gap-1 border border-gray-200 flex-wrap">
              <button
                onClick={() => setActiveFormType("tool-change")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs md:text-sm transition-all cursor-pointer ${
                  activeFormType === "tool-change"
                    ? "bg-orange-500 text-white shadow-md"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/60"
                }`}
              >
                <Wrench className="w-4 h-4" />
                Tool Change Records
              </button>

              <button
                onClick={() => setActiveFormType("daily-production")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs md:text-sm transition-all cursor-pointer ${
                  activeFormType === "daily-production"
                    ? "bg-orange-500 text-white shadow-md"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/60"
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                Daily Production Reports
              </button>

              <button
                onClick={() => setActiveFormType("significant")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs md:text-sm transition-all cursor-pointer ${
                  activeFormType === "significant"
                    ? "bg-orange-500 text-white shadow-md"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/60"
                }`}
              >
                <FileText className="w-4 h-4" />
                Significant Event Records
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
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs md:text-sm transition-all cursor-pointer ${
                  activeFormType === "8d-report"
                    ? "bg-orange-500 text-white shadow-md"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/60"
                }`}
              >
                <FileSearch className="w-4 h-4" />
                8D Problem Solving Reports
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
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs md:text-sm transition-all cursor-pointer ${
                  activeFormType === "job-setup"
                    ? "bg-orange-500 text-white shadow-md"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/60"
                }`}
              >
                <ClipboardCheck className="w-4 h-4" />
                Job Setup Verification
                {pendingJobSetupReports.length > 0 && (
                  <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ml-1 ${
                    activeFormType === "job-setup" ? "bg-white text-orange-600" : "bg-gray-300 text-gray-800"
                  }`}>
                    {pendingJobSetupReports.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Section Body */}
          <div className="p-6 md:p-8">
            
            {/* TAB CONTENT: Tool Change & Daily Production */}
            {(activeFormType === "tool-change" || activeFormType === "daily-production") && (
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-2">
                  <div>
                    <h3 className="text-base font-extrabold text-gray-900 uppercase tracking-wide">
                      Pending {activeFormType === "tool-change" ? "Tool Change Records" : "Daily Production Reports"}
                    </h3>
                    <p className="text-xs text-gray-500">Quality inspection verification and sign-off required.</p>
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
                    <h4 className="text-base font-bold text-gray-800">
                      No {activeFormType === "tool-change" ? "Tool Change" : "Daily Production"} Records Pending
                    </h4>
                    <p className="text-xs text-gray-500 max-w-sm">All entries for this category have been verified by QC.</p>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm bg-white">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-900 text-slate-200 text-xs uppercase tracking-wider font-semibold">
                            <th className="py-3.5 px-4 font-bold w-20 text-center">ID</th>
                            <th className="py-3.5 px-4 font-bold">Date</th>
                            <th className="py-3.5 px-4 font-bold">Line Code</th>
                            {activeFormType === "daily-production" && (
                              <th className="py-3.5 px-4 font-bold">Shift</th>
                            )}
                            <th className="py-3.5 px-4 font-bold">Part Details</th>
                            <th className="py-3.5 px-4 font-bold">Shift Incharge</th>
                            <th className="py-3.5 px-4 font-bold">Status</th>
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
                              {activeFormType === "daily-production" && (
                                <td className="py-4 px-4 font-semibold text-gray-700 text-xs">
                                  {report.shift || "I"}
                                </td>
                              )}
                              <td className="py-4 px-4 font-semibold text-gray-800">
                                {report.partName || "N/A"}
                              </td>
                              <td className="py-4 px-4 text-gray-600 text-xs">
                                {report.shiftInchargeName || report.toolChangedBySignature || "Shift Incharge"}
                              </td>
                              <td className="py-4 px-4">
                                {report.verifiedByQcSignature && report.verifiedByQcSignature !== "Pending" ? (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-300">
                                    ✓ Signed
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800 border border-yellow-300">
                                    Pending Review
                                  </span>
                                )}
                              </td>
                              <td className="py-4 px-4 text-right pr-6">
                                {(!report.verifiedByQcSignature || report.verifiedByQcSignature === "Pending") && (
                                  <button
                                    onClick={() => handleOpenReviewModal(report)}
                                    className="inline-flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white px-4 py-2 rounded-xl font-bold text-xs tracking-wider uppercase shadow-md shadow-orange-500/20 transition-all cursor-pointer"
                                  >
                                    <FileText className="w-3.5 h-3.5" />
                                    Review & Sign
                                  </button>
                                )}
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
                    <p className="text-xs text-gray-500">Examine recorded line and event disruptions before QC verification.</p>
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
                    <h4 className="text-base font-bold text-gray-800">No Significant Event Records Pending</h4>
                    <p className="text-xs text-gray-500 max-w-sm">All significant event entries have been reviewed.</p>
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
                    <p className="text-xs text-gray-500">Root cause and corrective action verification sheets.</p>
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
                    <p className="text-xs text-gray-500 max-w-sm">All 8D problem solving reports are approved.</p>
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
                            <th className="py-3.5 px-4 font-bold">Status</th>
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
                                {report.shift || "1ST"}
                              </td>
                              <td className="py-4 px-4">
                                {report.verifiedByQcSignature && report.verifiedByQcSignature !== "Pending" ? (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-300">
                                    ✓ Verified
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
                    <p className="text-xs text-gray-500">Quality Inspector tooling & part verification approval.</p>
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
                    <h4 className="text-base font-bold text-gray-800">No Job Setup Records Pending</h4>
                    <p className="text-xs text-gray-500 max-w-sm">All line machine tooling setups are verified.</p>
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
                            <th className="py-3.5 px-4 font-bold">Status</th>
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
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800 border border-yellow-300">
                                  Pending Review
                                </span>
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
          </div>
        </div>
      </div>

      {/* FULL-SCREEN SPLIT MODAL (Matching Dark Slate Theme) */}
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
                    activeFormType === "tool-change" 
                      ? "Tool Change Record" 
                      : activeFormType === "significant" 
                      ? "Significant Event Record" 
                      : activeFormType === "8d-report"
                      ? "8D Problem Solving Report"
                      : activeFormType === "job-setup"
                      ? "Job Setup Verification (Inspector)"
                      : "Daily Production Report"
                  }
                </h3>
                <p className="text-xs text-gray-400">Examine PDF report details before recording official QC verification sign-off</p>
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
                        <span className="text-gray-300 font-medium">{selectedReport.shiftInchargeName || selectedReport.toolChangedBySignature || "Shift Incharge"}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-6">
                  <button
                    onClick={submitQcSignature}
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

export default QC;