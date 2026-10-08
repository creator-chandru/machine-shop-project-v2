import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Header from "../components/Header";
import {
  RefreshCw,
  Loader,
  X,
  FileText,
  Activity,
  Clock,
  FileSpreadsheet,
  Users,
  FileSearch,
} from "lucide-react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const ProductEngineer = () => {
  const navigate = useNavigate();
  const { shopId } = useParams();

  // ============================================================
  // TAB STATE
  // ============================================================
  const [activeTab, setActiveTab] = useState("airgap"); // "airgap" | "idletime" | "dailyproduction" | "significant" | "operatorallotment" | "eightd"

  // ============================================================
  // PENDING REPORT STATES
  // ============================================================
  const [pendingAirGapReports, setPendingAirGapReports] = useState([]);
  const [pendingIdleTimeReports, setPendingIdleTimeReports] = useState([]);
  const [pendingDailyProdReports, setPendingDailyProdReports] = useState([]);
  const [pendingSignificantReports, setPendingSignificantReports] = useState([]);
  const [pendingOperatorAllotments, setPendingOperatorAllotments] = useState([]);
  const [pendingEightDReports, setPendingEightDReports] = useState([]);

  // ============================================================
  // PDF REVIEW MODAL STATE
  // ============================================================
  const [selectedReport, setSelectedReport] = useState(null);
  const [reviewReportType, setReviewReportType] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [isPdfLoading, setIsPdfLoading] = useState(false);

  // ============================================================
  // CURRENT PRODUCT ENGINEER
  // ============================================================
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  const currentPE = currentUser.username || currentUser.employeeId || "Product Engineer";

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-GB");
  };

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

  // ============================================================
  // FETCHERS
  // ============================================================
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

  const fetchPendingSignificantReports = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${process.env.REACT_APP_API_URL || "http://localhost:5000"}/api/significant-event-pending/pe/${encodeURIComponent(currentPE)}`,
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

  const fetchPendingOperatorAllotments = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${process.env.REACT_APP_API_URL || "http://localhost:5000"}/api/operator-allotment/pe/pending/${encodeURIComponent(currentPE)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setPendingOperatorAllotments(Array.isArray(data.records) ? data.records : []);
      }
    } catch (err) {
      toast.error("Failed to load Pending Operator Allotments.");
    }
  };

  const fetchPendingEightDReports = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${process.env.REACT_APP_API_URL || ""}/api/8d-report/pe/${encodeURIComponent(currentPE)}?shopId=${shopId || 3}`,
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
    }
  };

  const fetchAllReports = () => {
    fetchPendingAirGapReports();
    fetchPendingIdleTimeReports();
    fetchPendingDailyProdReports();
    fetchPendingSignificantReports();
    fetchPendingOperatorAllotments();
    fetchPendingEightDReports();
  };

  useEffect(() => {
    fetchAllReports();
  }, [shopId, currentPE]);

  // ============================================================
  // OPEN PDF REVIEW MODAL
  // ============================================================
  const handleOpenReviewModal = async (report, type) => {
    setSelectedReport(report);
    setReviewReportType(type);
    setPdfUrl(null);
    setIsPdfLoading(true);

    try {
      const token = localStorage.getItem("token");
      let apiUrl = "";
      const isoDate = normalizeDate(report.reportDate || report.checkDate || report.recordDate || report.date);

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
      } else if (type === "significant") {
        const params = new URLSearchParams({
          lineCode: report.lineCode || "",
          partName: report.partName || "",
          date: isoDate,
          event: report.event || "",
          shift: report.shift || "",
        });
        apiUrl = `${process.env.REACT_APP_API_URL || "http://localhost:5000"}/api/significant-event-report?${params.toString()}`;
      } else if (type === "operatorallotment") {
        const params = new URLSearchParams({
          lineCode: report.lineCode,
          date: isoDate,
        });
        apiUrl = `${process.env.REACT_APP_API_URL || "http://localhost:5000"}/api/operator-allotment/report?${params.toString()}`;
      } else if (type === "eightd") {
        const params = new URLSearchParams({
          shopId: String(report.machineShop || shopId || 3),
          date: isoDate,
          shift: report.shift || "1ST",
          partNo: report.partNo || "",
          customer: report.customer || "",
        });
        apiUrl = `${process.env.REACT_APP_API_URL || ""}/api/8d-report/pdf?${params.toString()}`;
      } else {
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
        if (res.status === 404) throw new Error("No data recorded for this specific date.");
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

  // ============================================================
  // SUBMIT PE SIGNATURE
  // ============================================================
  const submitPESignature = async () => {
    if (!selectedReport || !reviewReportType) return;

    try {
      const token = localStorage.getItem("token");
      let endpoint = "";
      let payload = {};
      const isoDate = normalizeDate(selectedReport.reportDate || selectedReport.checkDate || selectedReport.recordDate || selectedReport.date);

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
      } else if (reviewReportType === "significant") {
        endpoint = `${process.env.REACT_APP_API_URL || "http://localhost:5000"}/api/significant-event-sign`;
        payload = {
          role: "pe",
          username: currentPE,
          lineCode: selectedReport.lineCode,
          partName: selectedReport.partName,
          recordDate: isoDate,
          event: selectedReport.event,
          shift: selectedReport.shift,
        };
      } else if (reviewReportType === "operatorallotment") {
        endpoint = `${process.env.REACT_APP_API_URL || "http://localhost:5000"}/api/operator-allotment/pe/sign`;
        payload = {
          id: selectedReport.id,
          peSignature: currentPE,
        };
      } else if (reviewReportType === "eightd") {
        endpoint = `${process.env.REACT_APP_API_URL || ""}/api/8d-report/sign-pe`;
        payload = {
          partNo: selectedReport.partNo,
          date: isoDate,
          shift: selectedReport.shift || "1ST",
          signature: currentPE,
          peUsername: currentPE,
        };
      } else {
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
          : reviewReportType === "significant"
          ? "Significant Event Record verified and approved successfully!"
          : reviewReportType === "operatorallotment"
          ? "Operator Allotment Sheet verified and approved successfully!"
          : reviewReportType === "eightd"
          ? "8D Problem Solving Report verified and approved successfully!"
          : "Daily Production Report verified and approved successfully!";

      toast.success(successMsg, { autoClose: 2000 });

      setTimeout(() => {
        closeReviewModal();
        fetchAllReports();
      }, 1500);
    } catch (err) {
      toast.error(err.message || "Failed to save PE verification.");
    }
  };

  const closeReviewModal = () => {
    setSelectedReport(null);
    setReviewReportType(null);
    setPdfUrl(null);
  };

  // ============================================================
  // UI
  // ============================================================
  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <ToastContainer />

      <div className="p-6">
        {/* PAGE HEADER */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-800">
              Product Engineer Verification
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Review and verify pending production records
            </p>
          </div>
          <button
            onClick={fetchAllReports}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

        {/* TABS */}
        <div className="bg-white border-b border-gray-200 rounded-t-xl px-4 pt-2">
          <div className="flex items-center gap-1 overflow-x-auto">
            <button
              onClick={() => setActiveTab("airgap")}
              className={`flex items-center gap-2 py-3 px-5 font-bold text-sm rounded-t-lg transition-all cursor-pointer border-b-2 ${
                activeTab === "airgap" ? "border-blue-600 text-blue-600 bg-blue-50/50" : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>Air Gap Sensor Checksheets</span>
              {pendingAirGapReports.length > 0 && (
                <span className="bg-blue-600 text-white text-[11px] font-extrabold px-2 py-0.5 rounded-full">
                  {pendingAirGapReports.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("idletime")}
              className={`flex items-center gap-2 py-3 px-5 font-bold text-sm rounded-t-lg transition-all cursor-pointer border-b-2 ${
                activeTab === "idletime" ? "border-orange-600 text-orange-600 bg-orange-50/50" : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>Idle Time Reports</span>
              {pendingIdleTimeReports.length > 0 && (
                <span className="bg-orange-600 text-white text-[11px] font-extrabold px-2 py-0.5 rounded-full">
                  {pendingIdleTimeReports.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("dailyproduction")}
              className={`flex items-center gap-2 py-3 px-5 font-bold text-sm rounded-t-lg transition-all cursor-pointer border-b-2 ${
                activeTab === "dailyproduction" ? "border-green-600 text-green-600 bg-green-50/50" : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
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
              onClick={() => setActiveTab("significant")}
              className={`flex items-center gap-2 py-3 px-5 font-bold text-sm rounded-t-lg transition-all cursor-pointer border-b-2 ${
                activeTab === "significant" ? "border-purple-600 text-purple-600 bg-purple-50/50" : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Significant Event Records</span>
              {pendingSignificantReports.length > 0 && (
                <span className="bg-purple-600 text-white text-[11px] font-extrabold px-2 py-0.5 rounded-full">
                  {pendingSignificantReports.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("operatorallotment")}
              className={`flex items-center gap-2 py-3 px-5 font-bold text-sm rounded-t-lg transition-all cursor-pointer border-b-2 ${
                activeTab === "operatorallotment" ? "border-teal-600 text-teal-600 bg-teal-50/50" : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Operator Allotment Sheets</span>
              {pendingOperatorAllotments.length > 0 && (
                <span className="bg-teal-600 text-white text-[11px] font-extrabold px-2 py-0.5 rounded-full">
                  {pendingOperatorAllotments.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("eightd")}
              className={`flex items-center gap-2 py-3 px-5 font-bold text-sm rounded-t-lg transition-all cursor-pointer border-b-2 ${
                activeTab === "eightd" ? "border-amber-600 text-amber-600 bg-amber-50/50" : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              <FileSearch className="w-4 h-4" />
              <span>8D Problem Solving Reports</span>
              {pendingEightDReports.length > 0 && (
                <span className="bg-amber-600 text-white text-[11px] font-extrabold px-2 py-0.5 rounded-full">
                  {pendingEightDReports.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* CONTENT */}
        <div className="bg-white rounded-b-xl shadow-sm p-5">
          {/* AIR GAP */}
          {activeTab === "airgap" && (
            <div>
              {pendingAirGapReports.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                  <Activity className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                  <p className="text-gray-500 font-semibold">No Air Gap Sensor Checksheets pending your review.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse border border-gray-300">
                    <thead className="bg-gray-800 text-white text-xs uppercase tracking-wider">
                      <tr>
                        <th className="p-3 border border-gray-300">Date</th>
                        <th className="p-3 border border-gray-300">Line Name</th>
                        <th className="p-3 border border-gray-300">Part No</th>
                        <th className="p-3 border border-gray-300">Part Name</th>
                        <th className="p-3 border border-gray-300 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {pendingAirGapReports.map((report, idx) => (
                        <tr key={`ag-${report.id ?? idx}`} className="hover:bg-blue-50/40 transition-colors">
                          <td className="p-3 border border-gray-300 font-bold">
                            {formatDate(report.reportDate || report.checkDate || report.date)}
                          </td>
                          <td className="p-3 border border-gray-300 font-bold text-blue-700">{report.lineCode}</td>
                          <td className="p-3 border border-gray-300">{report.partNo || "N/A"}</td>
                          <td className="p-3 border border-gray-300">{report.partName || "N/A"}</td>
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

          {/* IDLE TIME */}
          {activeTab === "idletime" && (
            <div>
              {pendingIdleTimeReports.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                  <Clock className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                  <p className="text-gray-500 font-semibold">No Idle Time Reports pending your review.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse border border-gray-300">
                    <thead className="bg-gray-800 text-white text-xs uppercase tracking-wider">
                      <tr>
                        <th className="p-3 border border-gray-300">Date</th>
                        <th className="p-3 border border-gray-300">Line Name</th>
                        <th className="p-3 border border-gray-300">Submitted By</th>
                        <th className="p-3 border border-gray-300 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {pendingIdleTimeReports.map((report, idx) => (
                        <tr key={`it-${report.id ?? `${report.machineShop}-${report.lineCode}-${report.reportDate}-${idx}`}`} className="hover:bg-orange-50/40 transition-colors">
                          <td className="p-3 border border-gray-300 font-bold">
                            {formatDate(report.reportDate || report.checkDate || report.date)}
                          </td>
                          <td className="p-3 border border-gray-300 font-bold text-orange-700">{report.lineCode}</td>
                          <td className="p-3 border border-gray-300 uppercase">{report.submittedBy || "Shift Incharge"}</td>
                          <td className="p-3 border border-gray-300 text-center">
                            <button
                              onClick={() => handleOpenReviewModal(report, "idletime")}
                              className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-1.5 rounded-lg font-bold text-xs shadow transition-colors cursor-pointer"
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

          {/* DAILY PRODUCTION */}
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
                        <th className="p-3 border border-gray-300">Date</th>
                        <th className="p-3 border border-gray-300">Line Name</th>
                        <th className="p-3 border border-gray-300">Shift</th>
                        <th className="p-3 border border-gray-300 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {pendingDailyProdReports.map((report, idx) => (
                        <tr key={`dp-${report.id ?? idx}`} className="hover:bg-green-50/40 transition-colors">
                          <td className="p-3 border border-gray-300 font-bold">
                            {formatDate(report.reportDate || report.checkDate || report.date)}
                          </td>
                          <td className="p-3 border border-gray-300 font-bold text-green-700">{report.lineCode}</td>
                          <td className="p-3 border border-gray-300">{report.shift || "N/A"}</td>
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

          {/* SIGNIFICANT EVENT RECORDS */}
          {activeTab === "significant" && (
            <div>
              {pendingSignificantReports.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                  <FileText className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                  <p className="text-gray-500 font-semibold">No Significant Event Records pending your review.</p>
                </div>
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
                        <tr key={`sig-${idx}`} className="hover:bg-purple-50/40 transition-colors">
                          <td className="p-3 border border-gray-300 font-bold">{formatDate(report.recordDate)}</td>
                          <td className="p-3 border border-gray-300 font-bold text-purple-700">{report.lineCode}</td>
                          <td className="p-3 border border-gray-300">{report.partName || "N/A"}</td>
                          <td className="p-3 border border-gray-300 text-gray-600">{report.event || "N/A"}</td>
                          <td className="p-3 border border-gray-300 text-center">
                            <button
                              onClick={() => handleOpenReviewModal(report, "significant")}
                              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-1.5 rounded-lg font-bold text-xs shadow transition-colors cursor-pointer"
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

          {/* OPERATOR ALLOTMENT SHEETS */}
          {activeTab === "operatorallotment" && (
            <div>
              {pendingOperatorAllotments.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                  <Users className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                  <p className="text-gray-500 font-semibold">No Operator Allotment Sheets pending your review.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse border border-gray-300">
                    <thead className="bg-gray-800 text-white text-xs uppercase tracking-wider">
                      <tr>
                        <th className="p-3 border border-gray-300">Date</th>
                        <th className="p-3 border border-gray-300">Line Name</th>
                        <th className="p-3 border border-gray-300">Shift</th>
                        <th className="p-3 border border-gray-300">Product Engineer</th>
                        <th className="p-3 border border-gray-300 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {pendingOperatorAllotments.map((report, idx) => (
                        <tr key={`oa-${report.id ?? idx}`} className="hover:bg-teal-50/40 transition-colors">
                          <td className="p-3 border border-gray-300 font-bold">
                            {formatDate(report.recordDate || report.date)}
                          </td>
                          <td className="p-3 border border-gray-300 font-bold text-teal-700">{report.lineCode}</td>
                          <td className="p-3 border border-gray-300">Shift {report.shift || "N/A"}</td>
                          <td className="p-3 border border-gray-300">{report.productEngineer || "N/A"}</td>
                          <td className="p-3 border border-gray-300 text-center">
                            <button
                              onClick={() => handleOpenReviewModal(report, "operatorallotment")}
                              className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-1.5 rounded-lg font-bold text-xs shadow transition-colors cursor-pointer"
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

          {/* 8D PROBLEM SOLVING REPORTS */}
          {activeTab === "eightd" && (
            <div>
              {pendingEightDReports.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                  <FileSearch className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                  <p className="text-gray-500 font-semibold">No 8D Problem Solving Reports pending your review.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse border border-gray-300">
                    <thead className="bg-gray-800 text-white text-xs uppercase tracking-wider">
                      <tr>
                        <th className="p-3 border border-gray-300">Date</th>
                        <th className="p-3 border border-gray-300">Customer</th>
                        <th className="p-3 border border-gray-300">Part No</th>
                        <th className="p-3 border border-gray-300">Part Name</th>
                        <th className="p-3 border border-gray-300">Shift</th>
                        <th className="p-3 border border-gray-300 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {pendingEightDReports.map((report) => (
                        <tr key={`8d-${report.id}`} className="hover:bg-amber-50/40 transition-colors">
                          <td className="p-3 border border-gray-300 font-bold">
                            {formatDate(report.reportDate)}
                          </td>
                          <td className="p-3 border border-gray-300 font-semibold">{report.customer || "N/A"}</td>
                          <td className="p-3 border border-gray-300 font-mono text-xs">{report.partNo || "N/A"}</td>
                          <td className="p-3 border border-gray-300">{report.partName || "N/A"}</td>
                          <td className="p-3 border border-gray-300">Shift {report.shift || "1ST"}</td>
                          <td className="p-3 border border-gray-300 text-center">
                            <button
                              onClick={() => handleOpenReviewModal(report, "eightd")}
                              className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-1.5 rounded-lg font-bold text-xs shadow transition-colors cursor-pointer"
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

      {/* ==========================================================
          FULL SCREEN PDF REVIEW MODAL
      ========================================================== */}
      {selectedReport && (
        <div className="fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white w-full h-full max-w-[1600px] rounded-xl shadow-2xl overflow-hidden flex flex-col">
            
            {/* MODAL HEADER */}
            <div className="h-[58px] min-h-[58px] bg-[#111827] flex items-center justify-between px-6 border-b-2 border-gray-400 shrink-0">
              <h2 className="text-white text-lg font-extrabold tracking-wide uppercase">
                {reviewReportType === "airgap"
                  ? "REVIEW & SIGN AIR GAP CHECKSHEET"
                  : reviewReportType === "dailyproduction"
                  ? "REVIEW & SIGN DAILY PRODUCTION REPORT"
                  : reviewReportType === "significant"
                  ? "REVIEW & SIGN SIGNIFICANT EVENT RECORD"
                  : reviewReportType === "operatorallotment"
                  ? "REVIEW & SIGN OPERATOR ALLOTMENT SHEET"
                  : reviewReportType === "eightd"
                  ? "REVIEW & SIGN 8D PROBLEM SOLVING REPORT"
                  : "REVIEW & SIGN IDLE TIME REPORT"}
              </h2>
              <button
                onClick={closeReviewModal}
                className="text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-8 h-8" />
              </button>
            </div>

            {/* MAIN CONTENT SPLIT */}
            <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden bg-gray-100">
              
              {/* LEFT SIDE - PDF PREVIEW */}
              <div className="flex-1 h-full relative flex items-center justify-center border-r border-gray-300 bg-[#525659]">
                {isPdfLoading ? (
                  <div className="text-center">
                    <Loader className="w-12 h-12 animate-spin mx-auto text-white mb-4" />
                    <p className="text-white font-semibold text-lg">Generating report preview...</p>
                  </div>
                ) : pdfUrl ? (
                  <iframe
                    src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                    title="Report PDF Preview"
                    className="w-full h-full border-none relative z-10"
                  />
                ) : (
                  <div className="text-center">
                    <FileText className="w-14 h-14 mx-auto text-gray-400 mb-3" />
                    <p className="text-gray-400 font-semibold">Unable to load PDF preview.</p>
                  </div>
                )}
              </div>

              {/* RIGHT SIDE - REVIEW PANEL */}
              <div className="w-full lg:w-[400px] min-w-[360px] bg-white flex flex-col shrink-0 overflow-y-auto">
                <div className="flex-1 p-6 flex flex-col">
                  
                  {/* INFORMATION CARD */}
                  <div className="bg-orange-50 p-5 rounded-xl border border-orange-200 mb-6 text-sm flex flex-col gap-3 shadow-sm text-orange-900">
                    {selectedReport.lineCode && (
                      <p><span className="font-extrabold">Line Code:</span> {selectedReport.lineCode}</p>
                    )}

                    {selectedReport.customer && (
                      <p><span className="font-extrabold">Customer:</span> {selectedReport.customer}</p>
                    )}
                    
                    {(selectedReport.partName || selectedReport.partNo) && (
                      <p>
                        <span className="font-extrabold">Part Details:</span> {selectedReport.partName || "N/A"}
                        {selectedReport.partNo && ` (${selectedReport.partNo})`}
                      </p>
                    )}
                    
                    <p>
                      <span className="font-extrabold">Date:</span> {formatDate(selectedReport.reportDate || selectedReport.checkDate || selectedReport.recordDate || selectedReport.date)}
                    </p>
                    
                    {selectedReport.shift && (
                      <p><span className="font-extrabold">Shift:</span> Shift {selectedReport.shift}</p>
                    )}

                    {reviewReportType === "operatorallotment" && selectedReport.productEngineer && (
                      <p><span className="font-extrabold">Assigned PE:</span> {selectedReport.productEngineer}</p>
                    )}
                    
                    {reviewReportType === "significant" && selectedReport.event && (
                      <p><span className="font-extrabold">Event:</span> {selectedReport.event}</p>
                    )}

                    {reviewReportType !== "significant" && reviewReportType !== "operatorallotment" && reviewReportType !== "eightd" && (
                      <p><span className="font-extrabold">Shift Incharge:</span> {selectedReport.shiftInchargeName || "Shift Incharge"}</p>
                    )}
                  </div>

                  {/* VERIFICATION MESSAGE */}
                  <div className="mb-6 bg-gray-50 border border-gray-200 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 leading-relaxed">
                      Please review the complete report shown on the left before approving this record.
                    </p>
                  </div>

                  <p className="text-xs text-gray-500 leading-5 mb-6">
                    By clicking <strong>APPROVE REPORT</strong>, you confirm that you have reviewed the report and verified the information provided.
                  </p>

                  <div className="mt-auto">
                    <button
                      onClick={submitPESignature}
                      disabled={isPdfLoading || !pdfUrl}
                      className="w-full bg-[#10b981] hover:bg-[#059669] text-white py-4 rounded-xl font-black text-lg uppercase tracking-wider shadow-lg transition-transform hover:-translate-y-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isPdfLoading ? "LOADING..." : "APPROVE REPORT"}
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductEngineer;