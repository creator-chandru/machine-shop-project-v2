import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import Header from "../components/Header";
import { 
  ClipboardCheck, 
  RefreshCw, 
  Loader, 
  X,
  Building2,
  UserCheck,
  CheckCircle2,
  FileText
} from "lucide-react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const HofInspection = () => {
  const { shopId } = useParams();

  const [pendingReports, setPendingReports] = useState([]);
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
  const currentRoleName = currentUser.username || currentUser.employeeId || "HOF Inspection";

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
        `${process.env.REACT_APP_API_URL || ""}/api/job-setup-verification/hof-inspn/${encodeURIComponent(currentRoleName)}?shopId=${shopId || 3}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setPendingReports(Array.isArray(data) ? data : []);
      } else {
        setPendingReports([]);
      }
    } catch (err) {
      toast.error("Failed to load pending Job Setup Verifications.");
      setPendingReports([]);
    }
  };

  useEffect(() => {
    fetchPendingReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId]);

  const refreshData = async () => {
    setIsRefreshing(true);
    toast.info("Refreshing data...", { autoClose: 1000 });
    await fetchPendingReports();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleOpenReviewModal = async (report) => {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setSelectedReport(report);
    setPdfUrl(null);
    setIsPdfLoading(true);

    try {
      const rawDate = report.reportDate;
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
      const params = new URLSearchParams({
        partName: report.partName || "",
        date: isoDate,
        shopId: String(report.machineShop || shopId || 3),
      });

      const res = await fetch(
        `${process.env.REACT_APP_API_URL || ""}/api/job-setup-verification/report?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!res.ok) throw new Error("Report request failed");

      const blob = await res.blob();
      setPdfUrl(URL.createObjectURL(blob));
    } catch (err) {
      toast.error("Failed to generate report preview.");
    }
    setIsPdfLoading(false);
  };

  const submitSignature = async () => {
    try {
      const res = await fetch(
        `${process.env.REACT_APP_API_URL || ""}/api/job-setup-verification/sign-hof-inspn`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({
            id: selectedReport.id,
            signature: currentRoleName,
            username: currentRoleName,
          }),
        }
      );

      if (!res.ok) throw new Error("Approval failed");

      toast.success("Report approved successfully!", { autoClose: 2000 });

      setTimeout(() => {
        if (pdfUrl) URL.revokeObjectURL(pdfUrl);
        setSelectedReport(null);
        setPdfUrl(null);
        fetchPendingReports();
      }, 1500);
    } catch (err) {
      toast.error("Failed to save HOF Inspection approval.");
    }
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
                  HOF Inspection Dashboard
                </h1>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-sm">
                  <Building2 className="w-3.5 h-3.5" />
                  Machine Shop - {shopId || 3}
                </span>
              </div>
              <p className="text-xs text-gray-500 font-medium">
                Review and authorize line job setup verifications for machine shop operations.
              </p>
            </div>

            <div className="flex items-center gap-3 self-start md:self-auto">
              <div className="flex items-center gap-2.5 bg-white border border-gray-300 px-3.5 py-1.5 rounded-xl shadow-sm text-xs">
                <UserCheck className="w-4 h-4 text-indigo-600" />
                <span className="font-semibold text-gray-500">HOF-INSPN:</span>
                <span className="font-extrabold text-gray-800 uppercase">{currentRoleName}</span>
              </div>

              <button
                type="button"
                onClick={refreshData}
                className="p-2.5 bg-white hover:bg-gray-100 text-gray-600 hover:text-indigo-600 rounded-xl border border-gray-300 shadow-sm transition-all cursor-pointer group"
                title="Refresh Records"
              >
                <RefreshCw className={`w-4 h-4 transition-transform duration-500 ${isRefreshing ? "animate-spin text-indigo-600" : ""}`} />
              </button>
            </div>
          </div>

          {/* Section Body */}
          <div className="p-6 md:p-8">
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-2">
                <div>
                  <h3 className="text-base font-extrabold text-gray-900 uppercase tracking-wide">
                    Job Setup Verification Authorizations
                  </h3>
                  <p className="text-xs text-gray-500">Inspector verification and sign-off required prior to production runs.</p>
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
                  <h4 className="text-base font-bold text-gray-800">No Job Setup Authorizations Pending</h4>
                  <p className="text-xs text-gray-500 max-w-sm">All pending job setup records for this shop have been verified.</p>
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
                          <th className="py-3.5 px-4 font-bold">Inspector (QC)</th>
                          <th className="py-3.5 px-4 font-bold text-right pr-6">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 text-sm">
                        {pendingReports.map((report) => (
                          <tr key={`js-${report.id}`} className="hover:bg-indigo-50/30 transition-colors">
                            <td className="py-4 px-4 text-center font-bold text-gray-400 font-mono text-xs">
                              #{report.id}
                            </td>
                            <td className="py-4 px-4 font-medium text-gray-800 text-xs">
                              {formatDate(report.reportDate)}
                            </td>
                            <td className="py-4 px-4 font-bold text-gray-900">
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
                                className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white px-4 py-2 rounded-xl font-bold text-xs tracking-wider uppercase shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
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
          </div>
        </div>
      </div>

      {/* FULL-SCREEN SPLIT REVIEW MODAL */}
      {selectedReport && (
        <div className="fixed inset-0 z-[8000] bg-slate-950/90 backdrop-blur-md flex flex-col overflow-hidden animate-fade-in">
          <div className="bg-slate-900 text-white px-8 py-4 flex justify-between items-center shrink-0 border-b border-slate-800 shadow-xl z-10">
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
                <ClipboardCheck className="w-5 h-5" />
              </span>
              <div>
                <h3 className="font-extrabold text-lg tracking-wide uppercase text-indigo-400 leading-tight">
                  Review & Sign Job Setup Verification (HOF-INSPN)
                </h3>
                <p className="text-xs text-gray-400">Examine PDF report details before recording official inspection authorization</p>
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
                  <h4 className="text-xs font-black text-indigo-400 tracking-widest uppercase">Report Metadata</h4>
                  
                  <div className="bg-slate-800/80 p-5 rounded-2xl border border-slate-700/80 shadow-inner flex flex-col gap-3 text-sm">
                    <div className="flex flex-col gap-1 border-b border-slate-700/60 pb-2">
                      <span className="text-xs font-bold text-gray-400 uppercase">Part Details</span>
                      <span className="font-bold text-gray-100 text-xs leading-relaxed">{selectedReport.partName || "N/A"}</span>
                    </div>

                    {selectedReport.operationNo && (
                      <div className="flex justify-between items-center border-b border-slate-700/60 pb-2">
                        <span className="text-xs font-bold text-gray-400 uppercase">Operation No</span>
                        <span className="font-bold text-white">{selectedReport.operationNo}</span>
                      </div>
                    )}

                    <div className="flex justify-between items-center border-b border-slate-700/60 pb-2">
                      <span className="text-xs font-bold text-gray-400 uppercase">Date</span>
                      <span className="text-gray-300 font-medium">{formatDate(selectedReport.reportDate)}</span>
                    </div>

                    {selectedReport.shift && (
                      <div className="flex justify-between items-center border-b border-slate-700/60 pb-2">
                        <span className="text-xs font-bold text-gray-400 uppercase">Shift</span>
                        <span className="text-white font-bold">{selectedReport.shift}</span>
                      </div>
                    )}

                    <div className="flex justify-between items-center pt-1">
                      <span className="text-xs font-bold text-gray-400 uppercase">Shift Incharge</span>
                      <span className="text-gray-300 font-medium">{selectedReport.shiftInchargeName || "Shift Incharge"}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-6">
                  <button
                    onClick={submitSignature}
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

export default HofInspection;