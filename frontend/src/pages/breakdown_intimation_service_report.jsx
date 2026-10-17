import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  FileDown,
  Calendar,
  X,
  Plus,
  Minus,
  CheckCircle2,
  Clock,
  Wrench,
  AlertTriangle,
  FileSpreadsheet,
  Info
} from "lucide-react";
import Header from "../components/Header";

const formMeta = {
  revision: "01",
  revisionDate: "01.04.2022",
  title: "BREAKDOWN INTIMATION / SERVICE REPORT",
  company: "SAKTHI AUTO",
};

const emptyWorkerRow = () => ({
  empNo: "",
  employeeName: "",
  from: "",
  to: "",
  time: "",
});

const emptySpareRow = (idx = 1) => ({
  slNo: idx,
  itemCode: "",
  description: "",
  quantity: "",
});

const Toast = ({ message, type, onClose }) => {
  if (!message) return null;

  const bgColor =
    type === "error"
      ? "bg-red-600 border-red-700"
      : type === "success"
      ? "bg-green-600 border-green-700"
      : "bg-orange-600 border-orange-700";

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 ${bgColor} text-white px-5 py-3.5 rounded-xl shadow-2xl flex items-center gap-3 border transition-all animate-bounce`}
    >
      <span className="text-sm font-semibold tracking-wide">{message}</span>
      <button
        onClick={onClose}
        className="ml-2 p-1 font-bold text-lg leading-none hover:text-gray-200 focus:outline-none transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export default function BreakdownIntimationServiceReport() {
  const { shopId } = useParams();
  const navigate = useNavigate();

  // Role extraction
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  const currentUsername = currentUser?.username || currentUser?.employeeId || "Unknown";
  const currentUserRole = (currentUser?.role || "").toLowerCase();

  const isShiftIncharge =
    currentUserRole === "shiftincharge" ||
    currentUserRole === "supervisor" ||
    currentUserRole === "operator" ||
    currentUserRole === "";
  const isPE =
    currentUserRole === "pe" ||
    currentUserRole === "productengineer" ||
    currentUserRole === "productionengineer";

  const [toast, setToast] = useState({ message: "", type: "" });
  const [peUsers, setPeUsers] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavedRecord, setIsSavedRecord] = useState(false);

  // PDF Date Range Modal States
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfFromDate, setPdfFromDate] = useState("");
  const [pdfToDate, setPdfToDate] = useState("");
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  // Dynamic QF States
  const [qfHistory, setQfHistory] = useState([]);
  const [qfValue, setQfValue] = useState("QF/07/MRO-10, Rev. No.:01 dt 01.04.2022");

  const triggerToast = (message, type = "error") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast({ message: "", type: "" });
    }, 4000);
  };

  // Plant / Machine info
  const [basicInfo, setBasicInfo] = useState({
    plantName: "",
    lineNo: "",
    machineNo: "",
    date: new Date().toISOString().split("T")[0],
    shift: "I",
    time: "",
    category: {
      mechanical: false,
      electrical: false,
    },
  });

  // Nature of failure
  const [natureOfFailure, setNatureOfFailure] = useState({
    description: "",
    inchargeSignature: "",
  });

  // Maintenance team observation
  const [observation, setObservation] = useState({
    workStartTime: "",
    description: "",
  });

  // Corrective action
  const [correctiveAction, setCorrectiveAction] = useState({
    actionType: "Electrical",
    description: "",
  });

  // Work completed status
  const [workCompleted, setWorkCompleted] = useState({
    date: "",
    time: "",
    assignedPe: "",
    signature: "",
  });

  // Machine performance report
  const [performanceReport, setPerformanceReport] = useState({
    date: "",
    time: "",
    assignedPe: "",
    signature: "",
  });

  // Time loss in minutes
  const [timeLoss, setTimeLoss] = useState({
    from: { td: "", wm: "", ss: "", sp: "", ot: "", at: "", tt: "" },
    to: { td: "", wm: "", ss: "", sp: "", ot: "", at: "", tt: "" },
    timeLoss: { td: "", wm: "", ss: "", sp: "", ot: "", at: "", tt: "" },
    detailsOfOt: "",
  });

  const [workers, setWorkers] = useState([emptyWorkerRow()]);
  const [spares, setSpares] = useState([emptySpareRow(1)]);

  // Fetch Production Engineers for dropdowns
  useEffect(() => {
    const fetchPeUsers = async () => {
      try {
        const token = localStorage.getItem("token");
        const headers = { Authorization: `Bearer ${token}` };
        const res = await fetch(
          `${process.env.REACT_APP_API_URL}/api/daily-production-report/pe-incharges`,
          { headers }
        );
        if (res.ok) {
          const data = await res.json();
          setPeUsers(data.peList || []);
        } else {
          setPeUsers([{ name: "pe", username: "pe" }]);
        }
      } catch (err) {
        setPeUsers([{ name: "pe", username: "pe" }]);
      }
    };
    fetchPeUsers();
  }, []);

  // Fetch QF History on Mount
  useEffect(() => {
    const fetchQfHistory = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(
          `${process.env.REACT_APP_API_URL || ""}/api/qf-values/history/breakdown-intimation-report`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (res.ok) {
          const historyData = await res.json();
          setQfHistory(historyData);
        }
      } catch (err) {
        console.error("Failed to load QF history", err);
      }
    };
    fetchQfHistory();
  }, []);

  // Calculate QF based on selected Date
  useEffect(() => {
    let currentQf = "QF/07/MRO-10, Rev. No.:01 dt 01.04.2022";

    if (basicInfo.date && qfHistory.length > 0) {
      const selectedDate = new Date(basicInfo.date);
      selectedDate.setHours(0, 0, 0, 0);

      for (let qf of qfHistory) {
        if (!qf.date) continue;
        const qfDate = new Date(qf.date);
        qfDate.setHours(0, 0, 0, 0);

        if (qfDate <= selectedDate) {
          currentQf = qf.qfValue;
          break;
        }
      }
    } else if (qfHistory.length > 0) {
      currentQf = qfHistory[0].qfValue;
    }

    setQfValue(currentQf);
  }, [basicInfo.date, qfHistory]);

  const handleBasicInfoChange = (field, val) => {
    setBasicInfo((prev) => ({
      ...prev,
      [field]: val,
    }));
  };

  const handleCategoryChange = (type) => {
    setBasicInfo((prev) => ({
      ...prev,
      category: {
        ...prev.category,
        [type]: !prev.category[type],
      },
    }));
  };

  const handleApproveIncharge = () => {
    if (!basicInfo.lineNo) {
      triggerToast("Please enter Line No before approving.", "error");
      return;
    }
    setNatureOfFailure((prev) => ({
      ...prev,
      inchargeSignature: currentUsername !== "Unknown" ? currentUsername : "Approved",
    }));
    triggerToast("Incharge approved successfully.", "success");
  };

  const handleApprovePeWork = () => {
    if (!isPE) {
      triggerToast("Only Production Engineer can sign this section.", "error");
      return;
    }
    setWorkCompleted((prev) => ({
      ...prev,
      signature: currentUsername,
    }));
    triggerToast("Work Completed section approved!", "success");
  };

  const handleApprovePePerformance = () => {
    if (!isPE) {
      triggerToast("Only Production Engineer can sign this section.", "error");
      return;
    }
    setPerformanceReport((prev) => ({
      ...prev,
      signature: currentUsername,
    }));
    triggerToast("Machine Performance section approved!", "success");
  };

  const handleTimeLossChange = (rowType, col, val) => {
    setTimeLoss((prev) => ({
      ...prev,
      [rowType]: {
        ...prev[rowType],
        [col]: val,
      },
    }));
  };

  const handleWorkerChange = (idx, field, val) => {
    setWorkers((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };
      return next;
    });
  };

  const handleAddWorker = () => setWorkers((prev) => [...prev, emptyWorkerRow()]);
  const handleRemoveWorker = () => setWorkers((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));

  const handleSpareChange = (idx, field, val) => {
    setSpares((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };
      return next;
    });
  };

  const handleAddSpare = () => setSpares((prev) => [...prev, emptySpareRow(prev.length + 1)]);
  const handleRemoveSpare = () => setSpares((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));

  // PDF Date Range Download Handler
  const handleDownloadPdfRange = async () => {
    if (!pdfFromDate || !pdfToDate) {
      triggerToast("Please select both From Date and To Date.", "error");
      return;
    }

    if (new Date(pdfFromDate) > new Date(pdfToDate)) {
      triggerToast("From Date cannot be later than To Date.", "error");
      return;
    }

    setIsDownloadingPdf(true);
    try {
      const token = localStorage.getItem("token");
      const params = new URLSearchParams({
        fromDate: pdfFromDate,
        toDate: pdfToDate,
        shopId: String(shopId || 3),
      });

      const res = await fetch(
        `${process.env.REACT_APP_API_URL}/api/breakdown-intimation-report/report?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.status === 404) {
        throw new Error("No records found for the selected date range.");
      }
      if (!res.ok) throw new Error("Report request failed");

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `Breakdown_Report_${pdfFromDate}_to_${pdfToDate}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);

      setShowPdfModal(false);
      triggerToast("PDF generated and downloaded!", "success");
    } catch (err) {
      console.error("PDF generation failed:", err);
      triggerToast(err.message || "Failed to generate PDF", "error");
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  // Save handler
  const handleSave = async () => {
    if (!basicInfo.lineNo || !basicInfo.lineNo.trim()) {
      triggerToast("Please enter Line No.", "error");
      return;
    }
    if (!basicInfo.date) {
      triggerToast("Please select Date.", "error");
      return;
    }
    if (!basicInfo.shift) {
      triggerToast("Please select Shift.", "error");
      return;
    }

    if (isShiftIncharge) {
      if (!natureOfFailure.inchargeSignature) {
        triggerToast("Please approve under 'Nature of Failure' before submitting.", "error");
        return;
      }
      if (!workCompleted.assignedPe) {
        triggerToast("Please select a Production Engineer for 'Work Completed Status'.", "error");
        return;
      }
      if (!performanceReport.assignedPe) {
        triggerToast("Please select a Production Engineer for 'Machine Performance Report'.", "error");
        return;
      }
    }

    const payload = {
      shopId: shopId || 3,
      basicInfo,
      natureOfFailure,
      observation,
      correctiveAction,
      workCompleted,
      performanceReport,
      timeLoss,
      workers,
      spares,
      status: workCompleted.signature && performanceReport.signature ? "Completed" : "Submitted",
    };

    setIsSaving(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${process.env.REACT_APP_API_URL}/api/breakdown-intimation-report`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Server returned ${res.status}: ${errorText}`);
      }

      setIsSaving(false);
      setIsSavedRecord(true);
      triggerToast("Breakdown Intimation / Service Report saved successfully!", "success");
    } catch (err) {
      console.error("Save error:", err);
      setIsSaving(false);
      triggerToast(`Failed to save report: ${err.message}`, "error");
    }
  };

  const timeLossCols = ["td", "wm", "ss", "sp", "ot", "at", "tt"];

  return (
    <div className="min-h-screen bg-[#2d2d2d] flex flex-col items-center justify-start p-3 sm:p-6 lg:p-8 font-sans antialiased">
      <Header />
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: "", type: "" })} />

      {/* Date Range Modal for PDF Download */}
      {showPdfModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-7 w-full max-w-md border border-gray-100">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-gray-200">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-orange-50 rounded-lg">
                  <Calendar className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 uppercase tracking-wide">
                    Download Report
                  </h3>
                  <p className="text-xs text-gray-500">Filter breakdown records by date range</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPdfModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="font-semibold text-gray-700 block mb-1 text-xs uppercase tracking-wider">
                  From Date
                </label>
                <input
                  type="date"
                  className="w-full border border-gray-300 p-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm font-semibold bg-white transition-all shadow-sm"
                  value={pdfFromDate}
                  onChange={(e) => setPdfFromDate(e.target.value)}
                />
              </div>

              <div>
                <label className="font-semibold text-gray-700 block mb-1 text-xs uppercase tracking-wider">
                  To Date
                </label>
                <input
                  type="date"
                  className="w-full border border-gray-300 p-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm font-semibold bg-white transition-all shadow-sm"
                  value={pdfToDate}
                  onChange={(e) => setPdfToDate(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowPdfModal(false)}
                className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDownloadPdfRange}
                disabled={isDownloadingPdf}
                className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-400 text-white px-5 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider shadow hover:shadow-md transition-all cursor-pointer"
              >
                <FileDown className="w-4 h-4" />
                {isDownloadingPdf ? "Generating..." : "Download PDF"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Form Container */}
      <div className="bg-white w-full max-w-7xl rounded-2xl p-4 sm:p-8 lg:p-10 shadow-2xl border border-gray-200/80 space-y-7 my-4">
        
        {/* TOP HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-200 pb-5 gap-4">
          <div className="flex items-start sm:items-center gap-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="p-2 text-gray-600 hover:text-orange-600 hover:bg-orange-50 rounded-xl transition-all cursor-pointer border border-gray-200 shadow-sm"
              title="Go Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-gray-900 tracking-wider">
                  {formMeta.company}
                </span>
                <span className="text-xs bg-gray-100 text-gray-600 font-bold px-2 py-0.5 rounded border border-gray-200">
                  REV: {formMeta.revision}
                </span>
              </div>
              <h1 className="text-sm sm:text-base font-extrabold text-gray-800 uppercase tracking-wide mt-0.5">
                {formMeta.title}
              </h1>
              <div className="text-xs text-gray-500 font-semibold mt-1">
                <span>{qfValue}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 self-stretch sm:self-auto">
            <button
              type="button"
              onClick={() => setShowPdfModal(true)}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider shadow hover:shadow-md transition-all cursor-pointer"
            >
              <FileDown className="w-4 h-4 text-orange-400" />
              Preview PDF
            </button>
          </div>
        </div>

        {/* 1. BASIC INFORMATION & CATEGORY */}
        <div className="bg-white rounded-xl border border-gray-300 p-5 space-y-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-200 pb-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
              <span className="font-extrabold text-gray-900 text-xs sm:text-sm uppercase tracking-wide">
                1. Basic Information
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs sm:text-sm">
            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-gray-700 uppercase tracking-wider text-[11px]">Plant Name</label>
              <input
                type="text"
                placeholder="e.g. MS - IV"
                className="border border-gray-300 rounded-lg p-2.5 font-medium bg-gray-50/50 focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all"
                value={basicInfo.plantName}
                onChange={(e) => handleBasicInfoChange("plantName", e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-gray-700 uppercase tracking-wider text-[11px]">Line No</label>
              <input
                type="text"
                placeholder="e.g. MV-201 / V.W. 2084 - Ist"
                className="border border-gray-300 rounded-lg p-2.5 font-medium bg-gray-50/50 focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all"
                value={basicInfo.lineNo}
                onChange={(e) => handleBasicInfoChange("lineNo", e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-gray-700 uppercase tracking-wider text-[11px]">Machine No</label>
              <input
                type="text"
                placeholder="e.g. CM - 261"
                className="border border-gray-300 rounded-lg p-2.5 font-medium bg-gray-50/50 focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all"
                value={basicInfo.machineNo}
                onChange={(e) => handleBasicInfoChange("machineNo", e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-gray-700 uppercase tracking-wider text-[11px]">Date</label>
              <input
                type="date"
                className="border border-gray-300 rounded-lg p-2.5 font-medium bg-gray-50/50 focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all cursor-pointer"
                value={basicInfo.date}
                onChange={(e) => handleBasicInfoChange("date", e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-gray-700 uppercase tracking-wider text-[11px]">Shift</label>
              <select
                className="border border-gray-300 rounded-lg p-2.5 font-semibold bg-gray-50/50 focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all cursor-pointer"
                value={basicInfo.shift}
                onChange={(e) => handleBasicInfoChange("shift", e.target.value)}
              >
                <option value="I">Shift I</option>
                <option value="II">Shift II</option>
                <option value="III">Shift III</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-gray-700 uppercase tracking-wider text-[11px]">Breakdown Time</label>
              <input
                type="text"
                placeholder="e.g. 6:40 pm"
                className="border border-gray-300 rounded-lg p-2.5 font-medium bg-gray-50/50 focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all"
                value={basicInfo.time}
                onChange={(e) => handleBasicInfoChange("time", e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 pt-3 border-t border-gray-200">
            <span className="font-bold text-gray-800 text-xs uppercase tracking-wider">
              Category of Complaint:
            </span>
            <div className="flex items-center gap-6">
              <label className="inline-flex items-center gap-2.5 cursor-pointer font-bold text-xs sm:text-sm text-gray-800 select-none">
                <input
                  type="checkbox"
                  checked={basicInfo.category.mechanical}
                  onChange={() => handleCategoryChange("mechanical")}
                  className="w-4 h-4 text-orange-600 rounded border-gray-400 focus:ring-orange-500 cursor-pointer"
                />
                Mechanical
              </label>
              <label className="inline-flex items-center gap-2.5 cursor-pointer font-bold text-xs sm:text-sm text-gray-800 select-none">
                <input
                  type="checkbox"
                  checked={basicInfo.category.electrical}
                  onChange={() => handleCategoryChange("electrical")}
                  className="w-4 h-4 text-orange-600 rounded border-gray-400 focus:ring-orange-500 cursor-pointer"
                />
                Electrical
              </label>
            </div>
          </div>
        </div>

        {/* 2. NATURE OF FAILURE */}
        <div className="bg-white rounded-xl border border-gray-300 p-5 space-y-3 shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-200 pb-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
              <span className="font-extrabold text-gray-900 text-xs sm:text-sm uppercase tracking-wide">
                2. Nature of Failure
              </span>
            </div>
          </div>

          <textarea
            rows={3}
            placeholder="Describe the nature of failure in detail..."
            className="w-full border border-gray-300 p-3 rounded-lg text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 bg-gray-50/40 focus:bg-white resize-y transition-all"
            value={natureOfFailure.description}
            onChange={(e) => setNatureOfFailure((prev) => ({ ...prev, description: e.target.value }))}
          />

          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pt-2 text-xs">
            <span className="text-gray-500 italic">Signature required by Shift Incharge upon verification</span>
            <div className="flex items-center gap-3 self-end sm:self-auto">
              <span className="font-bold text-gray-800">Incharge Approval:</span>
              {natureOfFailure.inchargeSignature ? (
                <div className="inline-flex items-center gap-1.5 bg-green-50 px-3.5 py-1.5 border border-green-300 rounded-lg">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span className="text-[11px] font-bold text-green-700 uppercase tracking-wider">
                    {natureOfFailure.inchargeSignature}
                  </span>
                </div>
              ) : isShiftIncharge ? (
                <button
                  type="button"
                  onClick={handleApproveIncharge}
                  className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-4 py-2 rounded-lg shadow hover:shadow-md transition-all uppercase tracking-wider cursor-pointer"
                >
                  Approve Sign
                </button>
              ) : (
                <span className="text-gray-400 text-xs font-semibold bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200">
                  Pending Shift Incharge
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 3 & 4. OBSERVATION & CORRECTIVE ACTION */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Observation */}
          <div className="bg-white rounded-xl border border-gray-300 p-5 space-y-3 shadow-sm flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b border-gray-200 pb-2 gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
                  <span className="font-extrabold text-gray-900 text-xs sm:text-sm uppercase tracking-wide">
                    3. Maintenance Observation
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-700 text-xs">Start Time:</span>
                  <input
                    type="text"
                    placeholder="e.g. 6:50 pm"
                    className="border border-gray-300 rounded-lg px-2.5 py-1 text-xs font-medium w-28 text-center bg-gray-50/50 focus:bg-white focus:border-orange-500 outline-none"
                    value={observation.workStartTime}
                    onChange={(e) => setObservation((prev) => ({ ...prev, workStartTime: e.target.value }))}
                  />
                </div>
              </div>
              <textarea
                rows={3}
                placeholder="Record technical team observations..."
                className="w-full border border-gray-300 p-3 rounded-lg text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 bg-gray-50/40 focus:bg-white resize-y transition-all"
                value={observation.description}
                onChange={(e) => setObservation((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>
          </div>

          {/* Corrective Action */}
          <div className="bg-white rounded-xl border border-gray-300 p-5 space-y-3 shadow-sm flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b border-gray-200 pb-2 gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
                  <span className="font-extrabold text-gray-900 text-xs sm:text-sm uppercase tracking-wide">
                    4. Corrective Action
                  </span>
                </div>
                <div className="inline-flex rounded-lg border border-gray-300 p-0.5 bg-gray-100 overflow-hidden self-start sm:self-auto">
                  {["Electrical", "Mechanical", "Service"].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setCorrectiveAction((prev) => ({ ...prev, actionType: type }))}
                      className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                        correctiveAction.actionType === type
                          ? "bg-orange-500 text-white shadow-sm"
                          : "text-gray-700 hover:text-gray-900"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                rows={3}
                placeholder="Details of corrective action implemented..."
                className="w-full border border-gray-300 p-3 rounded-lg text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 bg-gray-50/40 focus:bg-white resize-y transition-all"
                value={correctiveAction.description}
                onChange={(e) => setCorrectiveAction((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>
          </div>
        </div>

        {/* 5. WORK COMPLETED & MACHINE PERFORMANCE (PE APPROVALS) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Work Completed */}
          <div className="bg-white rounded-xl border border-gray-300 p-5 space-y-4 shadow-sm">
            <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
              <span className="font-extrabold text-gray-900 text-xs sm:text-sm uppercase tracking-wide">
                5. Work Completed Status
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="flex flex-col gap-1">
                <label className="font-bold text-gray-700 uppercase tracking-wider text-[10px]">Completion Date</label>
                <input
                  type="date"
                  className="border border-gray-300 rounded-lg p-2 font-medium bg-gray-50/50 focus:bg-white focus:border-orange-500 outline-none transition-all"
                  value={workCompleted.date}
                  onChange={(e) => setWorkCompleted((prev) => ({ ...prev, date: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="font-bold text-gray-700 uppercase tracking-wider text-[10px]">Completion Time</label>
                <input
                  type="text"
                  placeholder="e.g. 7:05 pm"
                  className="border border-gray-300 rounded-lg p-2 font-medium bg-gray-50/50 focus:bg-white focus:border-orange-500 outline-none transition-all"
                  value={workCompleted.time}
                  onChange={(e) => setWorkCompleted((prev) => ({ ...prev, time: e.target.value }))}
                />
              </div>
            </div>

            <div className="pt-3 border-t border-gray-100 flex flex-col gap-2">
              <span className="font-bold text-gray-700 text-xs uppercase tracking-wider">Production Engineer Sign</span>
              {workCompleted.signature ? (
                <div className="flex items-center justify-between bg-green-50 p-2.5 border border-green-300 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <span className="text-xs font-black text-gray-900 uppercase">
                      Approved by {workCompleted.signature}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-green-700 uppercase tracking-widest bg-green-200/50 px-2 py-0.5 rounded">
                    Verified
                  </span>
                </div>
              ) : isPE ? (
                <div className="flex items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleApprovePeWork}
                    className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-4 py-2 rounded-lg shadow uppercase tracking-wider cursor-pointer transition-all"
                  >
                    Approve as PE
                  </button>
                  {workCompleted.assignedPe && (
                    <span className="text-[11px] text-gray-500 font-semibold uppercase">
                      (Assigned: {workCompleted.assignedPe})
                    </span>
                  )}
                </div>
              ) : (
                <select
                  className="w-full bg-gray-50/50 border border-gray-300 p-2 rounded-lg font-bold text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 cursor-pointer"
                  value={workCompleted.assignedPe || ""}
                  onChange={(e) => setWorkCompleted((prev) => ({ ...prev, assignedPe: e.target.value }))}
                >
                  <option value="">-- Assign Production Engineer --</option>
                  {peUsers.map((pe, pIdx) => {
                    const uname = pe.username || pe.employeeId || pe.name;
                    return (
                      <option key={`work-pe-${uname}-${pIdx}`} value={uname}>
                        {uname.toUpperCase()}
                      </option>
                    );
                  })}
                </select>
              )}
            </div>
          </div>

          {/* Performance Report */}
          <div className="bg-white rounded-xl border border-gray-300 p-5 space-y-4 shadow-sm">
            <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
              <span className="font-extrabold text-gray-900 text-xs sm:text-sm uppercase tracking-wide">
                6. Machine Performance Report
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="flex flex-col gap-1">
                <label className="font-bold text-gray-700 uppercase tracking-wider text-[10px]">Verification Date</label>
                <input
                  type="date"
                  className="border border-gray-300 rounded-lg p-2 font-medium bg-gray-50/50 focus:bg-white focus:border-orange-500 outline-none transition-all"
                  value={performanceReport.date}
                  onChange={(e) => setPerformanceReport((prev) => ({ ...prev, date: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="font-bold text-gray-700 uppercase tracking-wider text-[10px]">Verification Time</label>
                <input
                  type="text"
                  placeholder="e.g. 7:00 pm"
                  className="border border-gray-300 rounded-lg p-2 font-medium bg-gray-50/50 focus:bg-white focus:border-orange-500 outline-none transition-all"
                  value={performanceReport.time}
                  onChange={(e) => setPerformanceReport((prev) => ({ ...prev, time: e.target.value }))}
                />
              </div>
            </div>

            <div className="pt-3 border-t border-gray-100 flex flex-col gap-2">
              <span className="font-bold text-gray-700 text-xs uppercase tracking-wider">Production Engineer Sign</span>
              {performanceReport.signature ? (
                <div className="flex items-center justify-between bg-green-50 p-2.5 border border-green-300 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <span className="text-xs font-black text-gray-900 uppercase">
                      Approved by {performanceReport.signature}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-green-700 uppercase tracking-widest bg-green-200/50 px-2 py-0.5 rounded">
                    Verified
                  </span>
                </div>
              ) : isPE ? (
                <div className="flex items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleApprovePePerformance}
                    className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-4 py-2 rounded-lg shadow uppercase tracking-wider cursor-pointer transition-all"
                  >
                    Approve as PE
                  </button>
                  {performanceReport.assignedPe && (
                    <span className="text-[11px] text-gray-500 font-semibold uppercase">
                      (Assigned: {performanceReport.assignedPe})
                    </span>
                  )}
                </div>
              ) : (
                <select
                  className="w-full bg-gray-50/50 border border-gray-300 p-2 rounded-lg font-bold text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 cursor-pointer"
                  value={performanceReport.assignedPe || ""}
                  onChange={(e) => setPerformanceReport((prev) => ({ ...prev, assignedPe: e.target.value }))}
                >
                  <option value="">-- Assign Production Engineer --</option>
                  {peUsers.map((pe, pIdx) => {
                    const uname = pe.username || pe.employeeId || pe.name;
                    return (
                      <option key={`perf-pe-${uname}-${pIdx}`} value={uname}>
                        {uname.toUpperCase()}
                      </option>
                    );
                  })}
                </select>
              )}
            </div>
          </div>
        </div>

        {/* 6. TIME LOSS IN MINUTES TABLE */}
        <div className="bg-white rounded-xl border border-gray-300 p-5 space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-gray-200 pb-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
              <span className="font-extrabold text-gray-900 text-xs sm:text-sm uppercase tracking-wide">
                7. Time Loss in Minutes
              </span>
            </div>
            <span className="text-xs text-gray-500 font-medium">Recorded down-time segments</span>
          </div>

          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="w-full border-collapse text-xs text-center min-w-[620px]">
              <thead className="bg-gray-100/80 font-bold text-gray-800 border-b border-gray-200">
                <tr>
                  <th className="p-2.5 w-32 bg-gray-50 text-left font-extrabold uppercase tracking-wider text-[11px]">Metric</th>
                  <th className="p-2.5 border-l border-gray-200">TD</th>
                  <th className="p-2.5 border-l border-gray-200">WM</th>
                  <th className="p-2.5 border-l border-gray-200">SS</th>
                  <th className="p-2.5 border-l border-gray-200">SP</th>
                  <th className="p-2.5 border-l border-gray-200">OT</th>
                  <th className="p-2.5 border-l border-gray-200 bg-orange-50 text-orange-950 font-black">AT</th>
                  <th className="p-2.5 border-l border-gray-200 bg-red-50 text-red-950 font-black">TT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <tr className="hover:bg-gray-50/50 transition-colors">
                  <td className="p-2 font-bold text-left bg-gray-50/80 text-gray-700">From</td>
                  {timeLossCols.map((col) => (
                    <td key={`from-${col}`} className="p-1 border-l border-gray-200">
                      <input
                        type="text"
                        placeholder="HH:MM"
                        className="w-full text-center outline-none bg-transparent py-1.5 px-1 font-medium focus:bg-white rounded"
                        value={timeLoss.from[col]}
                        onChange={(e) => handleTimeLossChange("from", col, e.target.value)}
                      />
                    </td>
                  ))}
                </tr>
                <tr className="hover:bg-gray-50/50 transition-colors">
                  <td className="p-2 font-bold text-left bg-gray-50/80 text-gray-700">To</td>
                  {timeLossCols.map((col) => (
                    <td key={`to-${col}`} className="p-1 border-l border-gray-200">
                      <input
                        type="text"
                        placeholder="HH:MM"
                        className="w-full text-center outline-none bg-transparent py-1.5 px-1 font-medium focus:bg-white rounded"
                        value={timeLoss.to[col]}
                        onChange={(e) => handleTimeLossChange("to", col, e.target.value)}
                      />
                    </td>
                  ))}
                </tr>
                <tr className="bg-orange-50/30 font-semibold">
                  <td className="p-2 font-bold text-left bg-gray-100 text-gray-900">Time Loss (Mins)</td>
                  {timeLossCols.map((col) => (
                    <td key={`tl-${col}`} className="p-1 border-l border-gray-200">
                      <input
                        type="text"
                        placeholder="0"
                        className="w-full text-center outline-none bg-transparent py-1.5 px-1 font-black text-gray-900 focus:bg-white rounded"
                        value={timeLoss.timeLoss[col]}
                        onChange={(e) => handleTimeLossChange("timeLoss", col, e.target.value)}
                      />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-1 text-xs">
            <span className="font-bold text-gray-800 uppercase tracking-wider whitespace-nowrap">Details of OT:</span>
            <input
              type="text"
              placeholder="Enter details of OT (if applicable)..."
              className="flex-1 border border-gray-300 rounded-lg p-2 font-medium bg-gray-50/50 focus:bg-white focus:border-orange-500 outline-none transition-all"
              value={timeLoss.detailsOfOt}
              onChange={(e) => setTimeLoss((prev) => ({ ...prev, detailsOfOt: e.target.value }))}
            />
          </div>
        </div>

        {/* 7. WORK ATTENDED BY TABLE */}
        <div className="bg-white rounded-xl border border-gray-300 p-5 space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-gray-200 pb-2">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
              <span className="font-extrabold text-gray-900 text-xs sm:text-sm uppercase tracking-wide">
                8. Work Attended By
              </span>
              <span className="text-[11px] bg-orange-100 text-orange-800 px-2.5 py-0.5 rounded-full font-bold">
                {workers.length} {workers.length === 1 ? "Staff" : "Staff Members"}
              </span>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={handleAddWorker}
                className="inline-flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all shadow hover:shadow-md cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Member
              </button>
              {workers.length > 1 && (
                <button
                  type="button"
                  onClick={handleRemoveWorker}
                  className="inline-flex items-center gap-1.5 bg-gray-600 hover:bg-gray-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all shadow hover:shadow-md cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5" /> Remove
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="w-full border-collapse text-xs text-center min-w-[640px]">
              <thead className="bg-gray-100/80 font-bold text-gray-800 border-b border-gray-200 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-2.5 w-[18%]">EMP. NO.</th>
                  <th className="p-2.5 text-left px-3 w-[36%] border-l border-gray-200">EMPLOYEE NAME</th>
                  <th className="p-2.5 w-[15%] border-l border-gray-200">FROM</th>
                  <th className="p-2.5 w-[15%] border-l border-gray-200">TO</th>
                  <th className="p-2.5 w-[16%] border-l border-gray-200">TIME</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {workers.map((w, idx) => (
                  <tr key={`worker-${idx}`} className="hover:bg-gray-50/50 transition-colors">
                    <td className="p-1">
                      <input
                        type="text"
                        placeholder="EMP No"
                        className="w-full text-center outline-none bg-transparent py-1.5 px-2 font-medium focus:bg-white rounded"
                        value={w.empNo}
                        onChange={(e) => handleWorkerChange(idx, "empNo", e.target.value)}
                      />
                    </td>
                    <td className="p-1 border-l border-gray-200">
                      <input
                        type="text"
                        placeholder="Employee Name"
                        className="w-full text-left px-3 outline-none bg-transparent py-1.5 font-medium focus:bg-white rounded"
                        value={w.employeeName}
                        onChange={(e) => handleWorkerChange(idx, "employeeName", e.target.value)}
                      />
                    </td>
                    <td className="p-1 border-l border-gray-200">
                      <input
                        type="text"
                        placeholder="HH:MM"
                        className="w-full text-center outline-none bg-transparent py-1.5 px-2 font-medium focus:bg-white rounded"
                        value={w.from}
                        onChange={(e) => handleWorkerChange(idx, "from", e.target.value)}
                      />
                    </td>
                    <td className="p-1 border-l border-gray-200">
                      <input
                        type="text"
                        placeholder="HH:MM"
                        className="w-full text-center outline-none bg-transparent py-1.5 px-2 font-medium focus:bg-white rounded"
                        value={w.to}
                        onChange={(e) => handleWorkerChange(idx, "to", e.target.value)}
                      />
                    </td>
                    <td className="p-1 border-l border-gray-200">
                      <input
                        type="text"
                        placeholder="Time"
                        className="w-full text-center outline-none bg-transparent py-1.5 px-2 font-medium focus:bg-white rounded"
                        value={w.time}
                        onChange={(e) => handleWorkerChange(idx, "time", e.target.value)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 8. SPARES CONSUMED TABLE */}
        <div className="bg-white rounded-xl border border-gray-300 p-5 space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-gray-200 pb-2">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
              <span className="font-extrabold text-gray-900 text-xs sm:text-sm uppercase tracking-wide">
                9. Spares Consumed
              </span>
              <span className="text-[11px] bg-orange-100 text-orange-800 px-2.5 py-0.5 rounded-full font-bold">
                {spares.length} {spares.length === 1 ? "Item" : "Items"}
              </span>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={handleAddSpare}
                className="inline-flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all shadow hover:shadow-md cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Spare
              </button>
              {spares.length > 1 && (
                <button
                  type="button"
                  onClick={handleRemoveSpare}
                  className="inline-flex items-center gap-1.5 bg-gray-600 hover:bg-gray-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all shadow hover:shadow-md cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5" /> Remove
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="w-full border-collapse text-xs text-center min-w-[640px]">
              <thead className="bg-gray-100/80 font-bold text-gray-800 border-b border-gray-200 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-2.5 w-[12%]">SL. NO.</th>
                  <th className="p-2.5 w-[24%] border-l border-gray-200">ITEM CODE</th>
                  <th className="p-2.5 text-left px-3 w-[44%] border-l border-gray-200">DESCRIPTION</th>
                  <th className="p-2.5 w-[20%] border-l border-gray-200">QUANTITY</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {spares.map((s, idx) => (
                  <tr key={`spare-${idx}`} className="hover:bg-gray-50/50 transition-colors">
                    <td className="p-2 font-bold text-gray-600 bg-gray-50/50">{idx + 1}</td>
                    <td className="p-1 border-l border-gray-200">
                      <input
                        type="text"
                        placeholder="Item Code"
                        className="w-full text-center outline-none bg-transparent py-1.5 px-2 font-medium focus:bg-white rounded"
                        value={s.itemCode}
                        onChange={(e) => handleSpareChange(idx, "itemCode", e.target.value)}
                      />
                    </td>
                    <td className="p-1 border-l border-gray-200">
                      <input
                        type="text"
                        placeholder="Description of spare"
                        className="w-full text-left px-3 outline-none bg-transparent py-1.5 font-medium focus:bg-white rounded"
                        value={s.description}
                        onChange={(e) => handleSpareChange(idx, "description", e.target.value)}
                      />
                    </td>
                    <td className="p-1 border-l border-gray-200">
                      <input
                        type="text"
                        placeholder="Qty"
                        className="w-full text-center outline-none bg-transparent py-1.5 px-2 font-medium focus:bg-white rounded"
                        value={s.quantity}
                        onChange={(e) => handleSpareChange(idx, "quantity", e.target.value)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 9. LEGEND FOR ABBREVIATIONS */}
        <div className="bg-gray-50/60 rounded-xl border border-gray-200 p-4 space-y-2.5">
          <div className="flex items-center gap-1.5 text-gray-700">
            <Info className="w-4 h-4 text-orange-500" />
            <span className="font-extrabold text-xs uppercase tracking-wider">
              Legend for Abbreviations
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-[11px] text-gray-600">
            <div><strong className="text-gray-900">TD:</strong> Transition Delay</div>
            <div><strong className="text-gray-900">WM:</strong> Manpower Shortage</div>
            <div><strong className="text-gray-900">SS:</strong> Delay in Stores Services</div>
            <div><strong className="text-gray-900">SP:</strong> Down for Spares</div>
            <div><strong className="text-gray-900">OT:</strong> Others</div>
            <div><strong className="text-gray-900">AT:</strong> Actual Time (Worked)</div>
            <div><strong className="text-gray-900">TT:</strong> Total Down Time</div>
          </div>
        </div>

        {/* 10. FOOTER & SUBMIT BUTTON */}
        <div className="flex flex-col sm:flex-row justify-between items-center pt-5 border-t border-gray-200 gap-4">
          <div className="text-xs text-gray-500 font-semibold text-center sm:text-left">
            <span>Form Ref: {qfValue}</span>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white px-8 py-3.5 rounded-xl font-black transition-all shadow-lg hover:shadow-orange-500/25 cursor-pointer uppercase tracking-wider text-xs sm:text-sm active:scale-95"
          >
            {isSaving ? "Saving Report..." : isPE ? "Submit PE Approval" : "Submit For Verification"}
          </button>
        </div>
      </div>
    </div>
  );
}