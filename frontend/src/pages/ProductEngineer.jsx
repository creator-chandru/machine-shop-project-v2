import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Header from "../components/Header";
import { RefreshCw, Loader, X, FileText, Activity, Clock, FileSpreadsheet } from "lucide-react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const ProductEngineer = () => {
  const navigate = useNavigate();
  const { shopId } = useParams();

  const [activeTab, setActiveTab] = useState("airgap"); // "airgap" | "idletime" | "dailyproduction"

  // Air Gap reports
  const [pendingAirGapReports, setPendingAirGapReports] = useState([]);
  
  // Idle Time reports
  const [pendingIdleTimeReports, setPendingIdleTimeReports] = useState([]);

  // Daily Production reports
  const [pendingDailyProdReports, setPendingDailyProdReports] = useState([]);

  // Modal review state
  const [selectedReport, setSelectedReport] = useState(null);
  const [reviewReportType, setReviewReportType] = useState(null); // "airgap" | "idletime" | "dailyproduction"
  const [pdfUrl, setPdfUrl] = useState(null);
  const [isPdfLoading, setIsPdfLoading] = useState(false);

  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  const currentPE = currentUser.username || currentUser.employeeId || "Product Engineer";

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-GB");
  };

  // Fetch pending Air Gap Checksheets
  const fetchPendingAirGapReports = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${process.env.REACT_APP_API_URL || ""}/api/air-gap-sensor/pe/pending/${encodeURIComponent(currentPE)}?shopId=${shopId || 3}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setPendingAirGapReports(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      toast.error("Failed to load Pending Air Gap Reports.");
    }
  };

  // Fetch pending Idle Time Reports
  const fetchPendingIdleTimeReports = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${process.env.REACT_APP_API_URL || ""}/api/daily-production-idle-time/pe/pending/${encodeURIComponent(currentPE)}?shopId=${shopId || 3}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setPendingIdleTimeReports(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      toast.error("Failed to load Pending Idle Time Reports.");
    }
  };

  // Fetch pending Daily Production Reports
  const fetchPendingDailyProdReports = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${process.env.REACT_APP_API_URL || ""}/api/daily-production-report/pe/${encodeURIComponent(currentPE)}?shopId=${shopId || 3}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setPendingDailyProdReports(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      toast.error("Failed to load Pending Daily Production Reports.");
    }
  };

  const fetchAllReports = () => {
    fetchPendingAirGapReports();
    fetchPendingIdleTimeReports();
    fetchPendingDailyProdReports();
  };

  useEffect(() => {
    fetchAllReports();
  }, [shopId, currentPE]);

  const normalizeDate = (rawDate) => {
    if (!rawDate) return "";
    let isoDate = String(rawDate);
    if (isoDate.includes("/")) {
      const parts = isoDate.split("/");
      if (parts.length === 3) {
        isoDate = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
      }
    } else if (isoDate.includes("T")) {
      isoDate = isoDate.split("T")[0];
    }
    return isoDate;
  };

  // Open Full-screen split review modal with PDF
  const handleOpenReviewModal = async (report, type) => {
    setSelectedReport(report);
    setReviewReportType(type);
    setPdfUrl(null);
    setIsPdfLoading(true);

    try {
      const token = localStorage.getItem("token");
      let apiUrl = "";
      const isoDate = normalizeDate(report.reportDate || report.checkDate || report.date);

      if (type === "airgap") {
        const params = new URLSearchParams({
          lineCode: report.lineCode,
          partNo: report.partNo || "",
          date: isoDate,
          shopId: String(report.machineShop || shopId || 3),
        });
        apiUrl = `${process.env.REACT_APP_API_URL || ""}/api/air-gap-sensor/report?${params.toString()}`;
      } else if (type === "idletime") {
        const params = new URLSearchParams({
          lineCode: report.lineCode,
          date: isoDate,
          shopId: String(report.machineShop || shopId || 3),
        });
        apiUrl = `${process.env.REACT_APP_API_URL || ""}/api/daily-production-idle-time/report?${params.toString()}`;
      } else {
        // Daily Production Report
        const params = new URLSearchParams({
          lineCode: report.lineCode,
          date: isoDate,
          shopId: String(report.machineShop || shopId || 3),
        });
        if (report.shift) params.append("shift", report.shift);

        apiUrl = `${process.env.REACT_APP_API_URL || ""}/api/daily-production-report/report?${params.toString()}`;
      }

      const res = await fetch(apiUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        if (res.status === 404) {
          throw new Error("No data recorded for this specific date.");
        }
        throw new Error("Report request failed");
      }

      const blob = await res.blob();
      setPdfUrl(URL.createObjectURL(blob));
    } catch (err) {
      toast.error(err.message || "Failed to generate PDF preview.");
      setSelectedReport(null);
      setReviewReportType(null);
    }
    setIsPdfLoading(false);
  };

  // Submit PE Signature Approval
  const submitPESignature = async () => {
    if (!selectedReport || !reviewReportType) return;

    try {
      const token = localStorage.getItem("token");
      let endpoint = "";
      let payload = {};
      const isoDate = normalizeDate(selectedReport.reportDate || selectedReport.checkDate || selectedReport.date);

      if (reviewReportType === "airgap") {
        endpoint = `${process.env.REACT_APP_API_URL || ""}/api/air-gap-sensor/pe/sign`;
        payload = {
          lineCode: selectedReport.lineCode,
          partNo: selectedReport.partNo,
          date: isoDate,
          signature: currentPE,
        };
      } else if (reviewReportType === "idletime") {
        endpoint = `${process.env.REACT_APP_API_URL || ""}/api/daily-production-idle-time/pe/sign`;
        payload = {
          lineCode: selectedReport.lineCode,
          date: isoDate,
          machineShop: selectedReport.machineShop || shopId || 3,
          signature: currentPE,
          peUsername: currentPE,
        };
      } else {
        // Daily Production Report
        endpoint = `${process.env.REACT_APP_API_URL || ""}/api/daily-production-report/sign-pe`;
        payload = {
          lineCode: selectedReport.lineCode,
          date: isoDate,
          shift: selectedReport.shift || "I",
          signature: currentPE,
          peUsername: currentPE,
        };
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || "Approval failed");
      }

      const successMsg =
        reviewReportType === "airgap"
          ? "Air Gap Checksheet verified and approved successfully!"
          : reviewReportType === "idletime"
          ? "Daily Production & Idle Time Report verified and approved successfully!"
          : "Daily Production Report verified and approved successfully!";

      toast.success(successMsg, { autoClose: 2000 });

      setTimeout(() => {
        setSelectedReport(null);
        setReviewReportType(null);
        setPdfUrl(null);
        fetchAllReports();
      }, 1500);
    } catch (err) {
      toast.error(err.message || "Failed to save PE verification.");
    }
  };

  return (
    <>
      <Header />
      <ToastContainer position="top-right" autoClose={2000} />

      <div className="min-h-screen bg-[#2d2d2d] p-6 sm:p-10 space-y-6">
        <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-2xl p-6 sm:p-8 border-t-4 border-blue-500">
          
          {/* Top Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 border-b pb-4 gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-gray-800 uppercase tracking-tight">
                Product Engineer Verification Portal
              </h1>
              <p className="text-xs text-gray-500 mt-1">
                Machine Shop-{shopId || 3} Pending Authorizations
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={fetchAllReports}
                className="p-2.5 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer border border-gray-200 shadow-sm"
                title="Refresh All Pending Reports"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
              <span className="bg-blue-100 text-blue-800 px-4 py-2 rounded-lg font-bold text-xs uppercase shadow-sm">
                Logged in: {currentPE}
              </span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-gray-200 mb-6 gap-2 flex-wrap">
            <button
              onClick={() => setActiveTab("airgap")}
              className={`flex items-center gap-2 py-3 px-5 font-bold text-sm rounded-t-lg transition-all cursor-pointer border-b-2 ${
                activeTab === "airgap"
                  ? "border-blue-600 text-blue-600 bg-blue-50/50"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>Air Gap Sensor Checksheets</span>
              {pendingAirGapReports.length > 0 && (
                <span className="bg-red-500 text-white text-[11px] font-extrabold px-2 py-0.5 rounded-full">
                  {pendingAirGapReports.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("dailyproduction")}
              className={`flex items-center gap-2 py-3 px-5 font-bold text-sm rounded-t-lg transition-all cursor-pointer border-b-2 ${
                activeTab === "dailyproduction"
                  ? "border-green-600 text-green-600 bg-green-50/50"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Daily Production Reports</span>
              {pendingDailyProdReports.length > 0 && (
                <span className="bg-green-600 text-white text-[11px] font-extrabold px-2 py-0.5 rounded-full">
                  {pendingDailyProdReports.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("idletime")}
              className={`flex items-center gap-2 py-3 px-5 font-bold text-sm rounded-t-lg transition-all cursor-pointer border-b-2 ${
                activeTab === "idletime"
                  ? "border-orange-500 text-orange-600 bg-orange-50/50"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>Idle Time Reports</span>
              {pendingIdleTimeReports.length > 0 && (
                <span className="bg-orange-500 text-white text-[11px] font-extrabold px-2 py-0.5 rounded-full">
                  {pendingIdleTimeReports.length}
                </span>
              )}
            </button>
          </div>

          {/* TAB 1: Air Gap Sensor Reports */}
          {activeTab === "airgap" && (
            <div>
              {pendingAirGapReports.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                  <Activity className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                  <p className="text-gray-500 font-semibold">No Air Gap Checksheets pending your review.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse border border-gray-300">
                    <thead className="bg-gray-800 text-white text-xs uppercase tracking-wider">
                      <tr>
                        <th className="p-3 border border-gray-300">Date</th>
                        <th className="p-3 border border-gray-300">Line Code</th>
                        <th className="p-3 border border-gray-300">Part Name</th>
                        <th className="p-3 border border-gray-300">Part No</th>
                        <th className="p-3 border border-gray-300 text-center">Status</th>
                        <th className="p-3 border border-gray-300 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {pendingAirGapReports.map((report, idx) => (
                        <tr key={`ag-${idx}`} className="hover:bg-blue-50/40 transition-colors">
                          <td className="p-3 border border-gray-300 font-bold">
                            {formatDate(report.reportDate)}
                          </td>
                          <td className="p-3 border border-gray-300 font-bold text-blue-700">
                            {report.lineCode}
                          </td>
                          <td className="p-3 border border-gray-300">
                            {report.partName || "N/A"}
                          </td>
                          <td className="p-3 border border-gray-300">
                            {report.partNo || "N/A"}
                          </td>
                          <td className="p-3 border border-gray-300 text-center">
                            <span className="bg-red-100 text-red-700 px-2.5 py-1 rounded-full text-xs font-bold">
                              Pending Review
                            </span>
                          </td>
                          <td className="p-3 border border-gray-300 text-center">
                            <button
                              onClick={() => handleOpenReviewModal(report, "airgap")}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg font-bold text-xs shadow transition-colors cursor-pointer"
                            >
                              Review & Verify
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

          {/* TAB 2: Daily Production Reports */}
          {activeTab === "dailyproduction" && (
            <div>
              {pendingDailyProdReports.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                  <FileSpreadsheet className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                  <p className="text-gray-500 font-semibold">No Daily Production Reports pending your review.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse border border-gray-300">
                    <thead className="bg-gray-800 text-white text-xs uppercase tracking-wider">
                      <tr>
                        <th className="p-3 border border-gray-300 w-16 text-center">ID</th>
                        <th className="p-3 border border-gray-300">Date</th>
                        <th className="p-3 border border-gray-300">Line Code</th>
                        <th className="p-3 border border-gray-300">Shift</th>
                        <th className="p-3 border border-gray-300">Part Details</th>
                        <th className="p-3 border border-gray-300">Shift Incharge</th>
                        <th className="p-3 border border-gray-300 text-center">Status</th>
                        <th className="p-3 border border-gray-300 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {pendingDailyProdReports.map((report) => (
                        <tr key={`dp-${report.id}`} className="hover:bg-green-50/40 transition-colors">
                          <td className="p-3 border border-gray-300 text-center font-bold text-gray-400">
                            #{report.id}
                          </td>
                          <td className="p-3 border border-gray-300 font-bold">
                            {formatDate(report.reportDate)}
                          </td>
                          <td className="p-3 border border-gray-300 font-bold text-green-700">
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
                          <td className="p-3 border border-gray-300 text-center">
                            <span className="bg-red-100 text-red-700 px-2.5 py-1 rounded-full text-xs font-bold">
                              Pending PE Approval
                            </span>
                          </td>
                          <td className="p-3 border border-gray-300 text-center">
                            <button
                              onClick={() => handleOpenReviewModal(report, "dailyproduction")}
                              className="bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded-lg font-bold text-xs shadow transition-colors cursor-pointer"
                            >
                              Review & Verify
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

          {/* TAB 3: Daily Production & Idle Time Reports */}
          {activeTab === "idletime" && (
            <div>
              {pendingIdleTimeReports.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                  <Clock className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                  <p className="text-gray-500 font-semibold">No Daily Production & Idle Time Reports pending your review.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse border border-gray-300">
                    <thead className="bg-gray-800 text-white text-xs uppercase tracking-wider">
                      <tr>
                        <th className="p-3 border border-gray-300">Date</th>
                        <th className="p-3 border border-gray-300">Line Code</th>
                        <th className="p-3 border border-gray-300">Part Name</th>
                        <th className="p-3 border border-gray-300">Submitted By</th>
                        <th className="p-3 border border-gray-300 text-center">Shop</th>
                        <th className="p-3 border border-gray-300 text-center">Status</th>
                        <th className="p-3 border border-gray-300 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {pendingIdleTimeReports.map((report, idx) => (
                        <tr
                          key={`it-${report.id ?? `${report.machineShop}-${report.lineCode}-${report.reportDate}-${idx}`}`}
                          className="hover:bg-orange-50/40 transition-colors"
                        >
                          <td className="p-3 border border-gray-300 font-bold">
                            {formatDate(report.reportDate)}
                          </td>
                          <td className="p-3 border border-gray-300 font-bold text-orange-600">
                            {report.lineCode}
                          </td>
                          <td className="p-3 border border-gray-300">
                            {report.partName || "N/A"}
                          </td>
                          <td className="p-3 border border-gray-300 uppercase">
                            {report.submittedBy || "Shift Incharge"}
                          </td>
                          <td className="p-3 border border-gray-300 text-center font-bold text-gray-700">
                            MS-{report.machineShop || shopId || 3}
                          </td>
                          <td className="p-3 border border-gray-300 text-center">
                            <span className="bg-orange-100 text-orange-800 px-2.5 py-1 rounded-full text-xs font-bold">
                              Pending PE Approval
                            </span>
                          </td>
                          <td className="p-3 border border-gray-300 text-center">
                            <button
                              onClick={() => handleOpenReviewModal(report, "idletime")}
                              className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-1.5 rounded-lg font-bold text-xs shadow transition-colors cursor-pointer"
                            >
                              Review & Verify
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
      </div>

      {/* FULL-SCREEN SPLIT MODAL FOR PREVIEW & VERIFICATION */}
      {selectedReport && (
        <div className="fixed inset-0 z-[9999] bg-white flex flex-col overflow-hidden animate-fade-in">
          <div className="bg-gray-900 text-white px-6 py-4 flex justify-between items-center shrink-0 shadow-md z-10">
            <div className="flex items-center gap-3">
              <h3 className="font-bold text-lg sm:text-xl uppercase tracking-wider">
                {reviewReportType === "airgap"
                  ? "Verify Air Gap Checksheet"
                  : reviewReportType === "dailyproduction"
                  ? "Verify Daily Production Report"
                  : "Verify Daily Production & Idle Time Report"}
              </h3>
              <span className={`text-[11px] font-extrabold px-3 py-1 rounded-full uppercase ${
                reviewReportType === "airgap"
                  ? "bg-blue-600"
                  : reviewReportType === "dailyproduction"
                  ? "bg-green-600"
                  : "bg-orange-500"
              }`}>
                {reviewReportType === "airgap"
                  ? "Air Gap Checksheet"
                  : reviewReportType === "dailyproduction"
                  ? "Daily Production Report"
                  : "Idle Time Report"}
              </span>
            </div>
            <button
              onClick={() => {
                setSelectedReport(null);
                setReviewReportType(null);
                setPdfUrl(null);
              }}
              className="text-gray-400 hover:text-red-400 transition-colors cursor-pointer"
            >
              <X size={28} />
            </button>
          </div>

          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            {/* Left Preview Pane */}
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

            {/* Right Details and Approval Pane */}
            <div className="w-full lg:w-[420px] bg-gray-50 border-l border-gray-300 flex flex-col shrink-0 shadow-2xl z-10 overflow-y-auto">
              <div className="p-6 flex-1 flex flex-col">
                <div className={`p-4 rounded-xl border mb-6 text-sm flex flex-col gap-2.5 shadow-sm ${
                  reviewReportType === "airgap"
                    ? "bg-blue-50 border-blue-200 text-blue-900"
                    : reviewReportType === "dailyproduction"
                    ? "bg-green-50 border-green-200 text-green-950"
                    : "bg-orange-50 border-orange-200 text-orange-950"
                }`}>
                  <h4 className="font-black text-base uppercase border-b pb-2">
                    Report Summary
                  </h4>
                  <p>
                    <span className="font-bold">Line Code:</span> {selectedReport.lineCode}
                  </p>
                  <p>
                    <span className="font-bold">Part Details:</span> {selectedReport.partName || "N/A"}
                  </p>
                  {selectedReport.partNo && (
                    <p>
                      <span className="font-bold">Part No:</span> {selectedReport.partNo}
                    </p>
                  )}
                  <p>
                    <span className="font-bold">Date:</span> {formatDate(selectedReport.reportDate)}
                  </p>
                  {selectedReport.shift && (
                    <p>
                      <span className="font-bold">Shift:</span> {selectedReport.shift}
                    </p>
                  )}
                  {selectedReport.submittedBy && (
                    <p>
                      <span className="font-bold">Submitted By:</span> {selectedReport.submittedBy}
                    </p>
                  )}
                  <p>
                    <span className="font-bold">Machine Shop:</span> MS-{selectedReport.machineShop || shopId || 3}
                  </p>
                  <p>
                    <span className="font-bold">Assigned Reviewer:</span> {currentPE}
                  </p>
                </div>

                <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200 mb-6 text-xs text-yellow-900">
                  <p className="font-bold mb-1">Verification Confirmation</p>
                  <p>
                    By clicking <strong>Verify & Approve</strong>, your signature (<span className="font-bold">{currentPE}</span>) will be recorded permanently as the authorized Product Engineer for this report.
                  </p>
                </div>

                <div className="mt-auto pt-4">
                  <button
                    onClick={submitPESignature}
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-black text-lg uppercase tracking-wider shadow-lg transition-transform hover:-translate-y-1 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span>Verify & Approve</span>
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

export default ProductEngineer;
