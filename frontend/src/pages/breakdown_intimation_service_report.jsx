import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, FileDown, Calendar, X } from "lucide-react";
import Header from "../components/Header";

const formMeta = {
  formCode: "QF/07/MRO-10",
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
      ? "bg-red-600"
      : type === "success"
      ? "bg-green-600"
      : "bg-orange-600";

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 ${bgColor} text-white px-5 py-3 rounded-lg shadow-2xl flex items-center gap-3 transition-all transform animate-bounce`}
    >
      <span className="text-sm font-semibold">{message}</span>
      <button
        onClick={onClose}
        className="ml-2 font-bold text-lg leading-none hover:text-gray-200 focus:outline-none"
      >
        ×
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
    <div className="min-h-screen bg-[#2d2d2d] flex flex-col items-center justify-center p-4 sm:p-6 pb-20 font-sans">
      <Header />
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: "", type: "" })} />

      {/* Date Range Modal for PDF Download */}
      {showPdfModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md border-2 border-gray-100">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-orange-500" />
                <h3 className="text-lg font-bold text-gray-800 uppercase tracking-wide">
                  Download Report by Date Range
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPdfModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="font-bold text-gray-700 block mb-1 text-xs uppercase tracking-wider">From Date</label>
                <input
                  type="date"
                  className="w-full border border-gray-300 p-2.5 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm font-semibold bg-white"
                  value={pdfFromDate}
                  onChange={(e) => setPdfFromDate(e.target.value)}
                />
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1 text-xs uppercase tracking-wider">To Date</label>
                <input
                  type="date"
                  className="w-full border border-gray-300 p-2.5 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm font-semibold bg-white"
                  value={pdfToDate}
                  onChange={(e) => setPdfToDate(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowPdfModal(false)}
                className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-gray-600 hover:bg-gray-100 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDownloadPdfRange}
                disabled={isDownloadingPdf}
                className="flex items-center gap-2 bg-gray-800 hover:bg-gray-900 disabled:bg-gray-400 text-white px-5 py-2 rounded font-bold text-xs uppercase tracking-wider shadow transition-colors cursor-pointer"
              >
                <FileDown className="w-4 h-4" />
                {isDownloadingPdf ? "Downloading..." : "Download Report"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white w-full max-w-[95rem] rounded-xl p-6 sm:p-8 shadow-2xl overflow-x-auto border-4 border-gray-100 space-y-6">
        
        {/* TOP HEADER */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-200 pb-4 gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="p-1 text-gray-600 hover:text-orange-600 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
              title="Back"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <span className="text-2xl sm:text-3xl font-black text-gray-900 tracking-wider block">
                {formMeta.company}
              </span>
              <h1 className="text-base sm:text-lg font-black text-gray-800 uppercase tracking-wide">
                {formMeta.title}
              </h1>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowPdfModal(true)}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider shadow transition-colors cursor-pointer"
          >
            <FileDown className="w-4 h-4" /> Preview PDF
          </button>
        </div>

        {/* 1. BASIC INFORMATION & CATEGORY OF COMPLAINT */}
        <div className="border-2 border-gray-800 p-4 bg-white space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <label className="font-bold text-gray-800 w-32 whitespace-nowrap">Plant Name :</label>
                <input
                  type="text"
                  placeholder="e.g. MS - IV"
                  className="flex-1 border-b border-gray-400 focus:border-orange-500 outline-none px-2 py-0.5 font-medium bg-transparent"
                  value={basicInfo.plantName}
                  onChange={(e) => handleBasicInfoChange("plantName", e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="font-bold text-gray-800 w-32 whitespace-nowrap">Line No :</label>
                <input
                  type="text"
                  placeholder="e.g. MV-201 / V.W. 2084 - Ist"
                  className="flex-1 border-b border-gray-400 focus:border-orange-500 outline-none px-2 py-0.5 font-medium bg-transparent"
                  value={basicInfo.lineNo}
                  onChange={(e) => handleBasicInfoChange("lineNo", e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="font-bold text-gray-800 w-32 whitespace-nowrap">Machine No :</label>
                <input
                  type="text"
                  placeholder="e.g. CM - 261"
                  className="flex-1 border-b border-gray-400 focus:border-orange-500 outline-none px-2 py-0.5 font-medium bg-transparent"
                  value={basicInfo.machineNo}
                  onChange={(e) => handleBasicInfoChange("machineNo", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <label className="font-bold text-gray-800 w-24 whitespace-nowrap">Date :</label>
                <input
                  type="date"
                  className="flex-1 border-b border-gray-400 focus:border-orange-500 outline-none px-2 py-0.5 font-medium bg-transparent"
                  value={basicInfo.date}
                  onChange={(e) => handleBasicInfoChange("date", e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="font-bold text-gray-800 w-24 whitespace-nowrap">Shift :</label>
                <select
                  className="flex-1 border-b border-gray-400 focus:border-orange-500 outline-none px-2 py-0.5 font-semibold bg-transparent cursor-pointer"
                  value={basicInfo.shift}
                  onChange={(e) => handleBasicInfoChange("shift", e.target.value)}
                >
                  <option value="I">I</option>
                  <option value="II">II</option>
                  <option value="III">III</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="font-bold text-gray-800 w-24 whitespace-nowrap">Time :</label>
                <input
                  type="text"
                  placeholder="e.g. 6:40 pm"
                  className="flex-1 border-b border-gray-400 focus:border-orange-500 outline-none px-2 py-0.5 font-medium bg-transparent"
                  value={basicInfo.time}
                  onChange={(e) => handleBasicInfoChange("time", e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6 pt-2 border-t border-gray-200 text-sm">
            <span className="font-bold text-gray-800">Category of Complaint :</span>
            <label className="inline-flex items-center gap-2 cursor-pointer font-semibold text-gray-700">
              <input
                type="checkbox"
                checked={basicInfo.category.mechanical}
                onChange={() => handleCategoryChange("mechanical")}
                className="w-4 h-4 text-orange-600 rounded border-gray-400 focus:ring-orange-500 cursor-pointer"
              />
              Mechanical
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer font-semibold text-gray-700">
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

        {/* 2. NATURE OF FAILURE */}
        <div className="border-2 border-gray-800 p-3 bg-white space-y-2">
          <span className="font-bold text-gray-900 text-sm block">Nature of Failure :</span>
          <textarea
            rows={2}
            placeholder="Describe the nature of failure (e.g. Spindle motor lock alarm)..."
            className="w-full border border-gray-300 p-2 rounded text-sm outline-none focus:border-orange-500 bg-gray-50/50 resize-y"
            value={natureOfFailure.description}
            onChange={(e) => setNatureOfFailure((prev) => ({ ...prev, description: e.target.value }))}
          />
          <div className="flex justify-end items-center gap-4 pt-1 text-xs">
            <div className="flex items-center gap-3">
              <span className="font-bold text-gray-800">Incharge Signature :</span>
              {natureOfFailure.inchargeSignature ? (
                <div className="flex flex-col items-center justify-center bg-gray-50 px-4 py-1.5 border border-gray-300 rounded">
                  <span className="text-[10px] font-bold text-green-600 uppercase">
                    Approved By ✓
                  </span>
                  <span className="text-xs font-black text-gray-900 uppercase">
                    {natureOfFailure.inchargeSignature}
                  </span>
                </div>
              ) : isShiftIncharge ? (
                <button
                  type="button"
                  onClick={handleApproveIncharge}
                  className="bg-orange-500 hover:bg-orange-600 text-white text-[11px] font-bold px-4 py-1.5 rounded shadow hover:scale-105 transition-all uppercase tracking-wider cursor-pointer"
                >
                  Approve
                </button>
              ) : (
                <span className="text-gray-400 text-xs italic">
                  Pending Shift Incharge
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 3. MAINTENANCE TEAM OBSERVATION */}
        <div className="border-2 border-gray-800 p-3 bg-white space-y-2">
          <div className="flex justify-between items-center border-b border-gray-200 pb-1 text-xs">
            <span className="font-bold text-gray-900 text-sm">Maintenance Team Observation :</span>
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-800">Work Start Time :</span>
              <input
                type="text"
                placeholder="e.g. 6:50 pm"
                className="border-b border-gray-400 outline-none px-2 py-0.5 font-medium w-32 text-center bg-transparent focus:border-orange-500"
                value={observation.workStartTime}
                onChange={(e) => setObservation((prev) => ({ ...prev, workStartTime: e.target.value }))}
              />
            </div>
          </div>
          <textarea
            rows={2}
            placeholder="Record team observations (e.g. Checking time spindle motor lock alarm)..."
            className="w-full border border-gray-300 p-2 rounded text-sm outline-none focus:border-orange-500 bg-gray-50/50 resize-y"
            value={observation.description}
            onChange={(e) => setObservation((prev) => ({ ...prev, description: e.target.value }))}
          />
        </div>

        {/* 4. CORRECTIVE ACTION */}
        <div className="border-2 border-gray-800 p-3 bg-white space-y-2">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-gray-200 pb-1.5 text-xs">
            <span className="font-bold text-gray-900 text-sm">Corrective action :</span>
            <div className="flex items-center border border-gray-800 divide-x divide-gray-800 font-bold">
              {["Electrical", "Mechanical", "Service"].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setCorrectiveAction((prev) => ({ ...prev, actionType: type }))}
                  className={`px-4 py-1 transition-colors ${
                    correctiveAction.actionType === type
                      ? "bg-orange-500 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
          <textarea
            rows={2}
            placeholder="Details of corrective action taken..."
            className="w-full border border-gray-300 p-2 rounded text-sm outline-none focus:border-orange-500 bg-gray-50/50 resize-y"
            value={correctiveAction.description}
            onChange={(e) => setCorrectiveAction((prev) => ({ ...prev, description: e.target.value }))}
          />
        </div>

        {/* 5. WORK COMPLETED STATUS & MACHINE PERFORMANCE REPORT */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border-2 border-gray-800 p-3 bg-white space-y-3">
            <span className="font-bold text-gray-900 text-sm block border-b border-gray-200 pb-1">
              Work Completed status :
            </span>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-800 w-16">Date :</span>
                <input
                  type="date"
                  className="flex-1 border-b border-gray-400 outline-none px-2 py-0.5 font-medium bg-transparent focus:border-orange-500"
                  value={workCompleted.date}
                  onChange={(e) => setWorkCompleted((prev) => ({ ...prev, date: e.target.value }))}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-800 w-16">Time :</span>
                <input
                  type="text"
                  placeholder="e.g. 7:05 pm"
                  className="flex-1 border-b border-gray-400 outline-none px-2 py-0.5 font-medium bg-transparent focus:border-orange-500"
                  value={workCompleted.time}
                  onChange={(e) => setWorkCompleted((prev) => ({ ...prev, time: e.target.value }))}
                />
              </div>

              <div className="flex flex-col gap-1 pt-1 border-t border-gray-100">
                <span className="font-bold text-gray-800">Production Engineer Signature :</span>
                {workCompleted.signature ? (
                  <div className="flex flex-col items-center justify-center bg-gray-50 p-2 border border-gray-300 rounded">
                    <span className="text-[10px] font-bold text-green-600 uppercase">Approved By ✓</span>
                    <span className="text-xs font-black text-gray-900 uppercase">
                      approved by {workCompleted.signature}
                    </span>
                  </div>
                ) : isPE ? (
                  <div className="flex flex-col items-center gap-1">
                    <button
                      type="button"
                      onClick={handleApprovePeWork}
                      className="bg-green-600 hover:bg-green-700 text-white text-[11px] font-bold px-4 py-1.5 rounded shadow uppercase tracking-wider cursor-pointer"
                    >
                      Approve PE
                    </button>
                    {workCompleted.assignedPe && (
                      <span className="text-[10px] text-gray-500 font-semibold uppercase">
                        (Assigned: {workCompleted.assignedPe})
                      </span>
                    )}
                  </div>
                ) : isSavedRecord ? (
                  <div className="text-center">
                    <span className="text-red-600 text-xs font-bold uppercase">pending</span>
                    {workCompleted.assignedPe && (
                      <span className="text-[10px] font-bold text-gray-500 uppercase block">
                        (Assigned: {workCompleted.assignedPe})
                      </span>
                    )}
                  </div>
                ) : (
                  <select
                    className="w-full bg-white border border-gray-300 p-1.5 rounded font-bold text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-orange-500 text-center cursor-pointer"
                    value={workCompleted.assignedPe || ""}
                    onChange={(e) => setWorkCompleted((prev) => ({ ...prev, assignedPe: e.target.value }))}
                  >
                    <option value="">-- Select Production Engineer --</option>
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
          </div>

          <div className="border-2 border-gray-800 p-3 bg-white space-y-3">
            <span className="font-bold text-gray-900 text-sm block border-b border-gray-200 pb-1">
              Machine Performance Report :
            </span>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-800 w-16">Date :</span>
                <input
                  type="date"
                  className="flex-1 border-b border-gray-400 outline-none px-2 py-0.5 font-medium bg-transparent focus:border-orange-500"
                  value={performanceReport.date}
                  onChange={(e) => setPerformanceReport((prev) => ({ ...prev, date: e.target.value }))}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-800 w-16">Time :</span>
                <input
                  type="text"
                  placeholder="e.g. 7:00 pm"
                  className="flex-1 border-b border-gray-400 outline-none px-2 py-0.5 font-medium bg-transparent focus:border-orange-500"
                  value={performanceReport.time}
                  onChange={(e) => setPerformanceReport((prev) => ({ ...prev, time: e.target.value }))}
                />
              </div>

              <div className="flex flex-col gap-1 pt-1 border-t border-gray-100">
                <span className="font-bold text-gray-800">Production Engineer Signature :</span>
                {performanceReport.signature ? (
                  <div className="flex flex-col items-center justify-center bg-gray-50 p-2 border border-gray-300 rounded">
                    <span className="text-[10px] font-bold text-green-600 uppercase">Approved By ✓</span>
                    <span className="text-xs font-black text-gray-900 uppercase">
                      approved by {performanceReport.signature}
                    </span>
                  </div>
                ) : isPE ? (
                  <div className="flex flex-col items-center gap-1">
                    <button
                      type="button"
                      onClick={handleApprovePePerformance}
                      className="bg-green-600 hover:bg-green-700 text-white text-[11px] font-bold px-4 py-1.5 rounded shadow uppercase tracking-wider cursor-pointer"
                    >
                      Approve PE
                    </button>
                    {performanceReport.assignedPe && (
                      <span className="text-[10px] text-gray-500 font-semibold uppercase">
                        (Assigned: {performanceReport.assignedPe})
                      </span>
                    )}
                  </div>
                ) : isSavedRecord ? (
                  <div className="text-center">
                    <span className="text-red-600 text-xs font-bold uppercase">pending</span>
                    {performanceReport.assignedPe && (
                      <span className="text-[10px] font-bold text-gray-500 uppercase block">
                        (Assigned: {performanceReport.assignedPe})
                      </span>
                    )}
                  </div>
                ) : (
                  <select
                    className="w-full bg-white border border-gray-300 p-1.5 rounded font-bold text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-orange-500 text-center cursor-pointer"
                    value={performanceReport.assignedPe || ""}
                    onChange={(e) => setPerformanceReport((prev) => ({ ...prev, assignedPe: e.target.value }))}
                  >
                    <option value="">-- Select Production Engineer --</option>
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
        </div>

        {/* 6. TIME LOSS IN MINUTES TABLE */}
        <div className="border-2 border-gray-800 p-4 bg-white space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-gray-900 text-sm">Time Loss in Minutes :</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-800 text-xs text-center table-fixed">
              <thead className="bg-gray-100 font-bold text-gray-800">
                <tr>
                  <th className="border border-gray-800 p-2 w-28 bg-gray-50">Metric</th>
                  <th className="border border-gray-800 p-2">TD</th>
                  <th className="border border-gray-800 p-2">WM</th>
                  <th className="border border-gray-800 p-2">SS</th>
                  <th className="border border-gray-800 p-2">SP</th>
                  <th className="border border-gray-800 p-2">OT</th>
                  <th className="border border-gray-800 p-2 bg-orange-50 text-orange-900">AT</th>
                  <th className="border border-gray-800 p-2 bg-red-50 text-red-900">TT</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-800 p-2 font-bold text-left bg-gray-50">From</td>
                  {timeLossCols.map((col) => (
                    <td key={`from-${col}`} className="border border-gray-800 p-0">
                      <input
                        type="text"
                        placeholder="HH:MM"
                        className="w-full h-full text-center outline-none bg-transparent py-1.5 px-1 font-medium"
                        value={timeLoss.from[col]}
                        onChange={(e) => handleTimeLossChange("from", col, e.target.value)}
                      />
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="border border-gray-800 p-2 font-bold text-left bg-gray-50">To</td>
                  {timeLossCols.map((col) => (
                    <td key={`to-${col}`} className="border border-gray-800 p-0">
                      <input
                        type="text"
                        placeholder="HH:MM"
                        className="w-full h-full text-center outline-none bg-transparent py-1.5 px-1 font-medium"
                        value={timeLoss.to[col]}
                        onChange={(e) => handleTimeLossChange("to", col, e.target.value)}
                      />
                    </td>
                  ))}
                </tr>
                <tr className="bg-gray-50/50 font-semibold">
                  <td className="border border-gray-800 p-2 font-bold text-left bg-gray-50">Time Loss (Mins)</td>
                  {timeLossCols.map((col) => (
                    <td key={`tl-${col}`} className="border border-gray-800 p-0">
                      <input
                        type="text"
                        placeholder="0"
                        className="w-full h-full text-center outline-none bg-transparent py-1.5 px-1 font-bold text-gray-900"
                        value={timeLoss.timeLoss[col]}
                        onChange={(e) => handleTimeLossChange("timeLoss", col, e.target.value)}
                      />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-2 pt-2 text-xs">
            <span className="font-bold text-gray-800 whitespace-nowrap">Details of OT :</span>
            <input
              type="text"
              placeholder="Enter details of OT (if applicable)..."
              className="flex-1 border-b border-gray-400 outline-none px-2 py-0.5 font-medium bg-transparent focus:border-orange-500"
              value={timeLoss.detailsOfOt}
              onChange={(e) => setTimeLoss((prev) => ({ ...prev, detailsOfOt: e.target.value }))}
            />
          </div>
        </div>

        {/* 7. WORK ATTENDED BY TABLE */}
        <div className="border-2 border-gray-800 p-4 bg-white space-y-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-900 text-sm">Work attended by :</span>
              <span className="text-[11px] bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full font-semibold">
                {workers.length} {workers.length === 1 ? "Person" : "Persons"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAddWorker}
                className="inline-flex items-center gap-1 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-3 py-1 rounded transition-colors shadow hover:cursor-pointer"
              >
                + Add Row
              </button>
              {workers.length > 1 && (
                <button
                  type="button"
                  onClick={handleRemoveWorker}
                  className="inline-flex items-center gap-1 bg-gray-600 hover:bg-gray-700 text-white text-xs font-bold px-2.5 py-1 rounded transition-colors shadow hover:cursor-pointer"
                >
                  − Delete Row
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-800 text-xs text-center table-fixed">
              <thead className="bg-gray-100 font-bold text-gray-800">
                <tr>
                  <th className="border border-gray-800 p-2 w-[18%]">EMP. NO.</th>
                  <th className="border border-gray-800 p-2 text-left px-3 w-[36%]">EMPLOYEE NAME</th>
                  <th className="border border-gray-800 p-2 w-[15%]">FROM</th>
                  <th className="border border-gray-800 p-2 w-[15%]">TO</th>
                  <th className="border border-gray-800 p-2 w-[16%]">TIME</th>
                </tr>
              </thead>
              <tbody>
                {workers.map((w, idx) => (
                  <tr key={`worker-${idx}`} className="h-8">
                    <td className="border border-gray-800 p-0">
                      <input
                        type="text"
                        placeholder="EMP No"
                        className="w-full h-full text-center outline-none bg-transparent py-1 px-1 font-medium"
                        value={w.empNo}
                        onChange={(e) => handleWorkerChange(idx, "empNo", e.target.value)}
                      />
                    </td>
                    <td className="border border-gray-800 p-0">
                      <input
                        type="text"
                        placeholder="Employee Name"
                        className="w-full h-full text-left px-3 outline-none bg-transparent py-1 font-medium"
                        value={w.employeeName}
                        onChange={(e) => handleWorkerChange(idx, "employeeName", e.target.value)}
                      />
                    </td>
                    <td className="border border-gray-800 p-0">
                      <input
                        type="text"
                        placeholder="HH:MM"
                        className="w-full h-full text-center outline-none bg-transparent py-1 px-1 font-medium"
                        value={w.from}
                        onChange={(e) => handleWorkerChange(idx, "from", e.target.value)}
                      />
                    </td>
                    <td className="border border-gray-800 p-0">
                      <input
                        type="text"
                        placeholder="HH:MM"
                        className="w-full h-full text-center outline-none bg-transparent py-1 px-1 font-medium"
                        value={w.to}
                        onChange={(e) => handleWorkerChange(idx, "to", e.target.value)}
                      />
                    </td>
                    <td className="border border-gray-800 p-0">
                      <input
                        type="text"
                        placeholder="e.g. 10 mins"
                        className="w-full h-full text-center outline-none bg-transparent py-1 px-1 font-medium"
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
        <div className="border-2 border-gray-800 p-4 bg-white space-y-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-900 text-sm">Spares Consumed :</span>
              <span className="text-[11px] bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full font-semibold">
                {spares.length} {spares.length === 1 ? "Item" : "Items"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAddSpare}
                className="inline-flex items-center gap-1 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-3 py-1 rounded transition-colors shadow hover:cursor-pointer"
              >
                + Add Row
              </button>
              {spares.length > 1 && (
                <button
                  type="button"
                  onClick={handleRemoveSpare}
                  className="inline-flex items-center gap-1 bg-gray-600 hover:bg-gray-700 text-white text-xs font-bold px-2.5 py-1 rounded transition-colors shadow hover:cursor-pointer"
                >
                  − Delete Row
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-800 text-xs text-center table-fixed">
              <thead className="bg-gray-100 font-bold text-gray-800">
                <tr>
                  <th className="border border-gray-800 p-2 w-[12%]">SL. NO.</th>
                  <th className="border border-gray-800 p-2 w-[24%]">ITEM CODE</th>
                  <th className="border border-gray-800 p-2 text-left px-3 w-[44%]">DESCRIPTION</th>
                  <th className="border border-gray-800 p-2 w-[20%]">QUANTITY</th>
                </tr>
              </thead>
              <tbody>
                {spares.map((s, idx) => (
                  <tr key={`spare-${idx}`} className="h-8">
                    <td className="border border-gray-800 p-0 font-semibold text-gray-700">{idx + 1}</td>
                    <td className="border border-gray-800 p-0">
                      <input
                        type="text"
                        placeholder="Item Code"
                        className="w-full h-full text-center outline-none bg-transparent py-1 px-1 font-medium"
                        value={s.itemCode}
                        onChange={(e) => handleSpareChange(idx, "itemCode", e.target.value)}
                      />
                    </td>
                    <td className="border border-gray-800 p-0">
                      <input
                        type="text"
                        placeholder="Description of spare"
                        className="w-full h-full text-left px-3 outline-none bg-transparent py-1 font-medium"
                        value={s.description}
                        onChange={(e) => handleSpareChange(idx, "description", e.target.value)}
                      />
                    </td>
                    <td className="border border-gray-800 p-0">
                      <input
                        type="text"
                        placeholder="Qty"
                        className="w-full h-full text-center outline-none bg-transparent py-1 px-1 font-medium"
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
        <div className="border-2 border-gray-800 p-3 bg-white space-y-2">
          <span className="font-bold text-gray-900 text-xs block uppercase tracking-wide">
            LEGEND FOR ABBREVIATIONS :
          </span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-xs text-gray-700 font-medium">
            <div className="space-y-1">
              <div><strong className="text-gray-900">TD :</strong> TRANSITION DELAY</div>
              <div><strong className="text-gray-900">WM :</strong> MANPOWER SHORTAGE</div>
              <div><strong className="text-gray-900">SS :</strong> DELAY IN STORES SERVICES</div>
              <div><strong className="text-gray-900">SP :</strong> DOWN FOR SPARES</div>
            </div>
            <div className="space-y-1">
              <div><strong className="text-gray-900">OT :</strong> OTHERS</div>
              <div><strong className="text-gray-900">AT :</strong> ACTUAL TIME (WORKED)</div>
              <div><strong className="text-gray-900">TT :</strong> TOTAL DOWN TIME</div>
            </div>
          </div>
        </div>

        {/* 10. FOOTER & SUBMIT BUTTON */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pt-4 border-t border-gray-300 gap-4">
          <div className="text-xs text-gray-600 font-semibold">
            {formMeta.formCode}, Rev. No.:{formMeta.revision} dt {formMeta.revisionDate}
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white px-10 py-3 rounded font-bold transition-colors shadow-lg hover:cursor-pointer uppercase tracking-wider text-sm"
          >
            {isSaving ? "SAVING..." : isPE ? "SUBMIT PE APPROVAL" : "SUBMIT FOR VERIFICATION"}
          </button>
        </div>
      </div>
    </div>
  );
}