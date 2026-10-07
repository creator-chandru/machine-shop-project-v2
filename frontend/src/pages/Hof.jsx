import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import Header from "../components/Header";
import EditPartMapping from "../components/EditPartMapping";
import { RefreshCw, Loader, X, FileSpreadsheet, FileText } from "lucide-react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const Hof = () => {
  const { shopId } = useParams();

  const [activeFormType, setActiveFormType] = useState("daily-production"); // "daily-production" | "significant"
  const [pendingReports, setPendingReports] = useState([]);
  const [pendingSignificantReports, setPendingSignificantReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [isPdfLoading, setIsPdfLoading] = useState(false);

  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  const currentHOF = currentUser.username || currentUser.employeeId || "hof";

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-GB");
  };

  const fetchPendingReports = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${process.env.REACT_APP_API_URL || ""}/api/daily-production-report/hof/${encodeURIComponent(currentHOF)}?shopId=${shopId || 3}`,
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

  useEffect(() => {
    if (activeFormType === "significant") {
      fetchPendingSignificantReports();
    } else {
      fetchPendingReports();
    }
  }, [shopId, activeFormType]);

  const handleOpenReviewModal = async (report) => {
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

      // IF SIGNIFICANT EVENT
      if (activeFormType === "significant") {
        params.append("lineCode", report.lineCode || "");
        params.append("partName", report.partName || "");
        params.append("date", isoDate);
        params.append("event", report.event || "");
        params.append("shift", report.shift || "I");
        reportPath = `${process.env.REACT_APP_API_URL || "http://localhost:5000"}/api/significant-event-report?${params.toString()}`;
      } 
      // IF DAILY PRODUCTION
      else {
        params.append("lineCode", report.lineCode);
        params.append("date", isoDate);
        params.append("shopId", String(report.machineShop || shopId || 3));
        if (report.shift) {
          params.append("shift", report.shift);
        }
        reportPath = `${process.env.REACT_APP_API_URL || ""}/api/daily-production-report/report?${params.toString()}`;
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
      } else {
        signEndpoint = `${process.env.REACT_APP_API_URL || ""}/api/daily-production-report/sign-hof`;
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
        } else {
          fetchPendingReports();
        }
      }, 1500);
    } catch (err) {
      toast.error("Failed to save HOF approval.");
    }
  };

  return (
    <>
      <Header />
      <ToastContainer position="top-right" autoClose={2000} />

      <div className="min-h-screen w-full bg-[#2d2d2d] font-sans p-8 space-y-8">
        <h1 className="text-3xl font-black text-white tracking-widest uppercase text-center mb-2">
          HOF Dashboard
        </h1>
        <p className="text-gray-400 text-center mb-8">Managing Machine Shop - {shopId}</p>

        {/* Pending Approvals Table Card */}
        <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-2xl p-8 border-t-4 border-orange-500">
          <div className="flex justify-between items-center mb-6 border-b pb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                HOF Verification Dashboard
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Machine Shop-{shopId || 3} Approvals
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  fetchPendingReports();
                  fetchPendingSignificantReports();
                }}
                className="p-2 text-gray-500 hover:text-orange-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                title="Refresh"
              >
                <RefreshCw className="w-5 h-5" />
              </button>

              <span className="bg-orange-100 text-orange-800 px-4 py-2 rounded font-bold uppercase shadow-sm text-xs">
                Logged in: {currentHOF}
              </span>
            </div>
          </div>

          {/* Form Selection Tabs */}
          <div className="flex gap-4 mb-6">
            <button
              onClick={() => setActiveFormType("daily-production")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm transition-all cursor-pointer ${
                activeFormType === "daily-production"
                  ? "bg-orange-500 text-white shadow-md"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              Daily Production Reports
            </button>
            
            <button
              onClick={() => setActiveFormType("significant")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm transition-all cursor-pointer ${
                activeFormType === "significant"
                  ? "bg-orange-500 text-white shadow-md"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <FileText className="w-4 h-4" />
              Significant Event Records
              {pendingSignificantReports.length > 0 && (
                <span className="bg-white text-orange-500 text-[11px] font-extrabold px-2 py-0.5 rounded-full ml-1">
                  {pendingSignificantReports.length}
                </span>
              )}
            </button>
          </div>

          {/* TAB CONTENT: Daily Production */}
          {activeFormType === "daily-production" && (
            <div>
              {pendingReports.length === 0 ? (
                <p className="text-gray-500 italic py-6">No Daily Production reports pending your review.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse border border-gray-300">
                    <thead className="bg-gray-800 text-white text-xs">
                      <tr>
                        <th className="p-3 border border-gray-300 w-16 text-center">ID</th>
                        <th className="p-3 border border-gray-300">Date</th>
                        <th className="p-3 border border-gray-300">Line Code</th>
                        <th className="p-3 border border-gray-300">Shift</th>
                        <th className="p-3 border border-gray-300">Part Details</th>
                        <th className="p-3 border border-gray-300">Shift Incharge</th>
                        <th className="p-3 border border-gray-300">QC Status</th>
                        <th className="p-3 border border-gray-300 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs">
                      {pendingReports.map((report) => (
                        <tr key={report.id} className="hover:bg-gray-50">
                          <td className="p-3 border border-gray-300 text-center font-bold text-gray-400">
                            #{report.id}
                          </td>
                          <td className="p-3 border border-gray-300 font-medium">
                            {formatDate(report.reportDate)}
                          </td>
                          <td className="p-3 border border-gray-300 font-bold">
                            {report.lineCode}
                          </td>
                          <td className="p-3 border border-gray-300 font-semibold">
                            {report.shift || "I"}
                          </td>
                          <td className="p-3 border border-gray-300">
                            {report.partName || "N/A"}
                          </td>
                          <td className="p-3 border border-gray-300">
                            {report.shiftInchargeName || "Shift Incharge"}
                          </td>
                          <td className="p-3 border border-gray-300">
                            {report.verifiedByQcSignature && report.verifiedByQcSignature !== "Pending" ? (
                              <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">
                                ✓ QC Verified
                              </span>
                            ) : (
                              <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-bold">
                                Pending QC
                              </span>
                            )}
                          </td>
                          <td className="p-3 border border-gray-300 text-center">
                            <button
                              onClick={() => handleOpenReviewModal(report)}
                              className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-1.5 rounded font-bold text-xs shadow transition-colors cursor-pointer"
                            >
                              Review & Sign
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB CONTENT: Significant Event Records */}
          {activeFormType === "significant" && (
            <div>
              {pendingSignificantReports.length === 0 ? (
                <p className="text-gray-500 italic py-6">
                  No Significant Event Records pending your review.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse border border-gray-300">
                    <thead className="bg-gray-800 text-white text-xs uppercase tracking-wider">
                      <tr>
                        <th className="p-3 border border-gray-300">Date</th>
                        <th className="p-3 border border-gray-300">Line Name</th>
                        <th className="p-3 border border-gray-300">Part Name</th>
                        <th className="p-3 border border-gray-300">Event</th>
                        <th className="p-3 border border-gray-300 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {pendingSignificantReports.map((report, idx) => (
                        <tr key={`sig-${idx}`} className="hover:bg-orange-50/40 transition-colors">
                          <td className="p-3 border border-gray-300 font-bold">
                            {formatDate(report.recordDate)}
                          </td>
                          <td className="p-3 border border-gray-300 font-bold text-orange-700">
                            {report.lineCode}
                          </td>
                          <td className="p-3 border border-gray-300">
                            {report.partName || "N/A"}
                          </td>
                          <td className="p-3 border border-gray-300 text-gray-600">
                            {report.event || "N/A"}
                          </td>
                          <td className="p-3 border border-gray-300 text-center">
                            <button
                              onClick={() => handleOpenReviewModal(report)}
                              className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-1.5 rounded-lg font-bold text-xs shadow transition-colors cursor-pointer"
                            >
                              Review & Sign
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Existing Part Mapping Component */}
        <div className="max-w-6xl mx-auto">
          <EditPartMapping shopId={shopId} />
        </div>
      </div>

      {/* FULL-SCREEN SPLIT REVIEW MODAL */}
      {selectedReport && (
        <div className="fixed inset-0 z-[9999] bg-white flex flex-col overflow-hidden animate-fade-in">
          <div className="bg-gray-900 text-white px-6 py-4 flex justify-between items-center shrink-0 shadow-md z-10">
            <h3 className="font-bold text-xl uppercase tracking-wider">
              Review & Sign {activeFormType === "significant" ? "Significant Event Record" : "Daily Production Report (HOF)"}
            </h3>
            <button
              onClick={() => {
                setSelectedReport(null);
                setPdfUrl(null);
              }}
              className="text-gray-400 hover:text-red-400 transition-colors cursor-pointer"
            >
              <X size={28} />
            </button>
          </div>
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            <div className="flex-1 h-full bg-[#525659] relative flex items-center justify-center">
              {isPdfLoading && (
                <Loader className="animate-spin text-white w-12 h-12 absolute" />
              )}
              {pdfUrl && (
                <iframe
                  src={`${pdfUrl}#toolbar=0&view=FitH`}
                  className="w-full h-full border-none relative z-10"
                  title="PDF Preview"
                />
              )}
            </div>
            <div className="w-full lg:w-[400px] bg-gray-50 border-l border-gray-300 flex flex-col shrink-0 shadow-2xl z-10 overflow-y-auto">
              <div className="p-6 flex-1 flex flex-col">
                <div className="bg-orange-100 p-4 rounded-xl border border-orange-200 mb-6 text-sm flex flex-col gap-2 shadow-sm text-orange-900">
                  <p>
                    <span className="font-bold">Line Code:</span> {selectedReport.lineCode}
                  </p>
                  <p>
                    <span className="font-bold">Part Details:</span> {selectedReport.partName || "N/A"}
                  </p>
                  <p>
                    <span className="font-bold">Date:</span> {formatDate(selectedReport.reportDate || selectedReport.recordDate)}
                  </p>
                  
                  {selectedReport.shift && (
                    <p>
                      <span className="font-bold">Shift:</span> {selectedReport.shift}
                    </p>
                  )}

                  {activeFormType === "significant" && selectedReport.event && (
                    <p>
                      <span className="font-bold">Event:</span> {selectedReport.event}
                    </p>
                  )}

                  {activeFormType !== "significant" && (
                    <p>
                      <span className="font-bold">Shift Incharge:</span>{" "}
                      {selectedReport.shiftInchargeName || "Shift Incharge"}
                    </p>
                  )}
                </div>

                <div className="mt-auto">
                  <button
                    onClick={submitHofSignature}
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-black text-lg uppercase tracking-wider shadow-lg transition-transform hover:-translate-y-1 cursor-pointer"
                  >
                    Approve Report
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Hof;