import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Header from "../components/Header";
import { FileDown, Calendar, X, ArrowLeft, CheckCircle2, ChevronRight, ChevronLeft, Award } from "lucide-react";

const initialFormData = {
  formCode: "QF/06/ADM - 04",
  revisionDate: "01.11.2018",
  title: "COMPETENCY EVALUATION FORM",
  subtitle: "(PRACTICAL) - VTL & HTL",
  company: "SAKTHI AUTO COMPONENT LIMITED",
  level: "LEVEL - 3"
};

const INITIAL_QUESTIONS = [
  { qNo: 1, questionText: "DOES THE OPERATOR PERFORM HAND OVER TAKE OVER PROPERLY", ok: "", partial: "", notOk: "" },
  { qNo: 2, questionText: "DOES THE OPERATOR FOLLOW START STOP PROCEDURE", ok: "", partial: "", notOk: "" },
  { qNo: 3, questionText: "DOES THE OPERATOR FOLLOW 5S IN HIS MACHINE AREA", ok: "", partial: "", notOk: "" },
  { qNo: 4, questionText: "DOES THE OPERATOR REFER WORK INSTRUCTION DURING RUNNING THE MACHINE", ok: "", partial: "", notOk: "" },
  { qNo: 5, questionText: "DOES THE OPERATOR REFER PROCESS SHEET DURING CHECKING COMPONENT", ok: "", partial: "", notOk: "" },
  { qNo: 6, questionText: "DOES THE OPERATOR CHECK PART AS PER THE FREQUENCY IN PROCESS SHEET", ok: "", partial: "", notOk: "" },
  { qNo: 7, questionText: "DOES THE OPERATOR CHANGE TOOLS AS PER TOOL LIFE", ok: "", partial: "", notOk: "" },
  { qNo: 8, questionText: "DOES THE OPERATOR FOLLOW REACTION PLAN DURING NC PART PRODUCED", ok: "", partial: "", notOk: "" },
  { qNo: 9, questionText: "DOES THE OPERATOR FOLLOW NC HANDLING PROCEDURE", ok: "", partial: "", notOk: "" },
  { qNo: 10, questionText: "DOES THE OPERATOR CHECK AND FILL PRE-OPERATION CHECK SHEET", ok: "", partial: "", notOk: "" },
  { qNo: 11, questionText: "DOES THE OPERATOR PERFORM SIGNIFICANT EVENT RECORD DURING TOOL CHANGE", ok: "", partial: "", notOk: "" },
  { qNo: 12, questionText: "DOES THE OPERATOR FOLLOW CALIBRATION STATUS", ok: "", partial: "", notOk: "" },
  { qNo: 13, questionText: "DOES THE OPERATOR FOLLOW SAFETY RULES AND WEAR PPE AS PER PLAN", ok: "", partial: "", notOk: "" },
  { qNo: 14, questionText: "DOES THE OPERATOR INFORM INCHARGE DURING UNUSUAL SITUATION", ok: "", partial: "", notOk: "" },
  { qNo: 15, questionText: "DOES THE OPERATOR FOLLOW UNUSUAL SITUATION MANAGEMENT PROCEDURE", ok: "", partial: "", notOk: "" },
  { qNo: 16, questionText: "DOES THE OPERATOR AWARE OF MARU A", ok: "", partial: "", notOk: "" },
  { qNo: 17, questionText: "DOES THE OPERATOR AWARE OF THE CONSEQUENCES IN FAILURE OF MARU A PARAMETER", ok: "", partial: "", notOk: "" },
  { qNo: 18, questionText: "DOES THE OPERATOR AWARE OF AIR GAP SENSOR", ok: "", partial: "", notOk: "" },
  { qNo: 19, questionText: "DOES THE OPERATOR CHECK VISUAL DEFECTS", ok: "", partial: "", notOk: "" },
  { qNo: 20, questionText: "DOES THE OPERATOR AWARE OF PREVIOUS QUALITY PROBLEM AND CORRECTIVE ACTION", ok: "", partial: "", notOk: "" }
];

const getTodayISODate = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

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
      className={`fixed bottom-6 right-6 z-50 ${bgColor} text-white px-5 py-3.5 rounded-xl shadow-2xl flex items-center gap-3 transition-all animate-bounce border border-black/10`}
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

export default function CompetencyEvaluationForm() {
  const { shopId } = useParams();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("front");

  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  const currentUsername = currentUser?.username || currentUser?.employeeId || "Unknown";
  const currentUserRole = (currentUser?.role || "").toLowerCase();

  const isShiftIncharge =
    currentUserRole === "shiftincharge" ||
    currentUserRole === "supervisor" ||
    currentUserRole === "operator" ||
    currentUserRole === "";
  const isHOD =
    currentUserRole === "hod" ||
    currentUserRole === "headfacility" ||
    currentUserRole === "headofproduction" ||
    currentUserRole === "hof";

  const [headerInfo, setHeaderInfo] = useState({
    name: "",
    employeeNo: "",
    qualification: "",
    date: getTodayISODate(),
    doj: "",
    line: "",
    levelBadge: "LEVEL - 3",
    assignedHod: ""
  });

  const [questions, setQuestions] = useState(INITIAL_QUESTIONS);
  const [writtenExamMark, setWrittenExamMark] = useState("");
  const [practicalExamMark, setPracticalExamMark] = useState("");
  const [status, setStatus] = useState("");

  const [signatures, setSignatures] = useState({
    inchargeSign: "",
    hodSign: ""
  });

  const [hodUsers, setHodUsers] = useState([]);
  const [isSavedRecord, setIsSavedRecord] = useState(false);

  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfFromDate, setPdfFromDate] = useState("");
  const [pdfToDate, setPdfToDate] = useState("");
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "" });

  const [qfHistory, setQfHistory] = useState([]);
  const [qfValue, setQfValue] = useState("QF/06/ADM - 04, Rev. Date: 01.11.2018");

  const triggerToast = (message, type = "error") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast({ message: "", type: "" });
    }, 4000);
  };

  useEffect(() => {
    const fetchHodList = async () => {
      try {
        const token = localStorage.getItem("token");
        const headers = { Authorization: `Bearer ${token}` };

        const res = await fetch(
          `${process.env.REACT_APP_API_URL || ""}/api/competency-evaluation-form/hod-incharges`,
          { headers }
        );

        if (res.ok) {
          const data = await res.json();
          setHodUsers(data.hodList || []);
        } else {
          const fallbackRes = await fetch(
            `${process.env.REACT_APP_API_URL || ""}/api/daily-production-report/hof-incharges`,
            { headers }
          );
          if (fallbackRes.ok) {
            const fbData = await fallbackRes.json();
            setHodUsers(fbData.hofList || []);
          } else {
            setHodUsers([{ name: "hod", username: "hod" }]);
          }
        }
      } catch (err) {
        setHodUsers([{ name: "hod", username: "hod" }]);
      }
    };
    fetchHodList();
  }, []);

  useEffect(() => {
    const fetchQfHistory = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(
          `${process.env.REACT_APP_API_URL || ""}/api/qf-values/history/competency-evaluation-form`,
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

  useEffect(() => {
    let currentQf = "QF/06/ADM - 04, Rev. Date: 01.11.2018";

    if (headerInfo.date && qfHistory.length > 0) {
      const selectedDate = new Date(headerInfo.date);
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
  }, [headerInfo.date, qfHistory]);

  const handleHeaderChange = (field, val) => {
    setHeaderInfo((prev) => ({ ...prev, [field]: val }));
  };

  const handleDropdownChange = (qIndex, selectedCol, value) => {
    if (isHOD) return;

    setQuestions((prev) => {
      const next = [...prev];
      const current = { ...next[qIndex] };

      if (value === "") {
        current[selectedCol] = "";
      } else {
        current.ok = "";
        current.partial = "";
        current.notOk = "";
        current[selectedCol] = value;
      }

      next[qIndex] = current;
      return next;
    });
  };

  const handleMarkChange = (setter, max, label) => (e) => {
    const raw = e.target.value;
    if (raw === "") {
      setter("");
      return;
    }
    const num = Number(raw);
    if (isNaN(num) || num < 0) return;
    if (num > max) {
      triggerToast(`${label} cannot exceed ${max} (100%).`, "error");
      return;
    }
    setter(String(Math.floor(num)));
  };

  const blockInvalidMarkKeys = (e) => {
    if (["e", "E", "+", "-", "."].includes(e.key)) e.preventDefault();
  };

  const writtenPercentage =
    writtenExamMark !== "" && !isNaN(writtenExamMark)
      ? `${((parseFloat(writtenExamMark) / 100) * 100).toFixed(0)}%`
      : "";

  const practicalPercentage =
    practicalExamMark !== "" && !isNaN(practicalExamMark)
      ? `${((parseFloat(practicalExamMark) / 40) * 100).toFixed(0)}%`
      : "";

  const handleApproveIncharge = () => {
    if (!headerInfo.name.trim() || !headerInfo.employeeNo.trim()) {
      triggerToast("Please enter Employee Name and Employee No before approving.", "error");
      return;
    }

    setSignatures((prev) => ({
      ...prev,
      inchargeSign: currentUsername || "Approved"
    }));
    triggerToast("Incharge approved successfully.", "success");
  };

  const handleApproveHod = () => {
    if (!isHOD) {
      triggerToast("Only HOD can approve this evaluation.", "error");
      return;
    }
    if (headerInfo.assignedHod && headerInfo.assignedHod.toLowerCase() !== currentUsername.toLowerCase()) {
      triggerToast(`Assigned to HOD: ${headerInfo.assignedHod.toUpperCase()}`, "error");
      return;
    }

    setSignatures((prev) => ({
      ...prev,
      hodSign: currentUsername || "Approved"
    }));
    triggerToast("HOD Approved successfully!", "success");
  };

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
        shopId: String(shopId || 3)
      });

      const res = await fetch(
        `${process.env.REACT_APP_API_URL || ""}/api/competency-evaluation-form/report?${params.toString()}`,
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
      link.download = `Competency_Evaluation_Report_${pdfFromDate}_to_${pdfToDate}.pdf`;
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

  const handleSave = async () => {
    if (!headerInfo.name.trim() || !headerInfo.employeeNo.trim()) {
      triggerToast("Please fill Employee Name and Employee No before submitting.", "error");
      return;
    }

    if (writtenExamMark !== "" && (Number(writtenExamMark) < 0 || Number(writtenExamMark) > 100)) {
      triggerToast("Written exam mark must be between 0 and 100.", "error");
      return;
    }
    if (practicalExamMark !== "" && (Number(practicalExamMark) < 0 || Number(practicalExamMark) > 40)) {
      triggerToast("Practical exam mark must be between 0 and 40.", "error");
      return;
    }

    if (isShiftIncharge) {
      if (!signatures.inchargeSign) {
        triggerToast("Please click 'Approve' under INCHARGE SIGN (EVALUATED BY) before submitting.", "error");
        return;
      }
      if (!headerInfo.assignedHod) {
        triggerToast("Please select HOD in HOD SIGN dropdown.", "error");
        return;
      }
    }

    if (isHOD && (!signatures.hodSign || signatures.hodSign === "Pending")) {
      triggerToast("Please click 'Approve HOD' before submitting approval.", "error");
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);

    const processedQuestions = questions.map((q) => {
      let rating = "";
      let mark = null;

      if (q.ok === "✓") {
        rating = "OK";
        mark = 2;
      } else if (q.partial === "✓") {
        rating = "PARTIAL";
        mark = 1;
      } else if (q.notOk === "✓") {
        rating = "NOT OK";
        mark = 0;
      } else if (q.ok === "X" || q.partial === "X" || q.notOk === "X") {
        rating = "FAIL";
        mark = 0;
      }

      return {
        qNo: q.qNo,
        questionText: q.questionText,
        rating,
        mark
      };
    });

    const payload = {
      header: {
        ...headerInfo,
        machineShop: shopId || 3
      },
      questions: processedQuestions,
      overallMark: {
        writtenExamMark: writtenExamMark !== "" ? parseInt(writtenExamMark, 10) : null,
        writtenExamPercentage: writtenPercentage,
        practicalExamMark: practicalExamMark !== "" ? parseInt(practicalExamMark, 10) : null,
        practicalExamPercentage: practicalPercentage,
        status: status || ""
      },
      signatures: {
        inchargeSign: signatures.inchargeSign || currentUsername,
        evaluatedBy: headerInfo.assignedHod || "",
        hodSign: isHOD ? currentUsername : signatures.hodSign || "Pending"
      }
    };

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${process.env.REACT_APP_API_URL || ""}/api/competency-evaluation-form`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Save failed");
      }

      setIsSaving(false);
      setSaveSuccess(true);
      setIsSavedRecord(true);

      triggerToast("Competency Evaluation saved successfully!", "success");
      await new Promise((resolve) => setTimeout(resolve, 1500));

      navigate(isHOD ? `/hod/${shopId || 3}` : `/shift-incharge/${shopId || 3}`);
    } catch (err) {
      console.error("Save error:", err);
      setIsSaving(false);
      triggerToast(err.message || "Failed to save Competency Evaluation Form.", "error");
    }
  };

  const isInchargeApproved = Boolean(
    signatures.inchargeSign &&
      signatures.inchargeSign !== "Pending" &&
      signatures.inchargeSign !== ""
  );

  const isHodApproved = Boolean(
    signatures.hodSign &&
      signatures.hodSign !== "Pending" &&
      signatures.hodSign !== ""
  );

  return (
    <div className="min-h-screen bg-[#2d2d2d] flex flex-col items-center justify-start p-3 sm:p-6 lg:p-8 font-sans antialiased">
      <Header />

      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ message: "", type: "" })}
      />

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
                    Download Evaluation Report
                  </h3>
                  <p className="text-xs text-gray-500">Filter records by date range</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPdfModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
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
                className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
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
                {isDownloadingPdf ? "Generating..." : "Download Report"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Progress / Save Modal */}
      {(isSaving || saveSuccess) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl px-8 sm:px-12 py-8 text-center border border-gray-100 max-w-sm w-full">
            {isSaving ? (
              <>
                <div className="w-12 h-12 border-4 border-gray-200 border-t-orange-500 rounded-full animate-spin mx-auto mb-4"></div>
                <h2 className="text-lg font-bold text-gray-900 tracking-wide">Saving Evaluation...</h2>
                <p className="text-xs text-gray-500 mt-1 font-medium">
                  {isHOD ? "Completing HOD Approval..." : "Submitting for HOD Approval..."}
                </p>
              </>
            ) : (
              <>
                <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h2 className="text-lg font-bold text-green-800 tracking-wide">Saved Successfully</h2>
                <p className="text-xs text-gray-500 mt-1 font-medium">Redirecting to dashboard...</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Main Container Card */}
      <div className="bg-white w-full max-w-7xl rounded-2xl p-4 sm:p-8 lg:p-10 shadow-2xl border border-gray-200/80 space-y-7 my-4">
        
        {/* TOP HEADER */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-200 pb-5 gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <button
              type="button"
              onClick={() => navigate(isHOD ? `/hod/${shopId || 3}` : `/operator/${shopId || 3}`)}
              className="p-2 text-gray-600 hover:text-orange-600 hover:bg-orange-50 rounded-xl transition-all cursor-pointer border border-gray-200 shadow-sm"
              title="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <span className="text-xs font-black text-orange-600 tracking-widest uppercase block mb-0.5">
                {initialFormData.company}
              </span>
              <div className="flex flex-wrap items-baseline gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-gray-900 uppercase tracking-wide">
                  {initialFormData.title}
                </h2>
                <span className="text-xs font-bold text-gray-500">
                  {initialFormData.subtitle}
                </span>
              </div>
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
              <FileDown className="w-4 h-4 text-orange-400" /> Download PDF
            </button>
          </div>
        </div>

        {/* TAB NAVIGATION */}
        <div className="flex flex-col sm:flex-row gap-2 border-b border-gray-200 pb-3">
          <button
            type="button"
            onClick={() => setActiveTab("front")}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === "front"
                ? "bg-orange-500 text-white shadow-md shadow-orange-500/20"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            <span>Page 1: Practical Questions</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("back")}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === "back"
                ? "bg-orange-500 text-white shadow-md shadow-orange-500/20"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            <span>Page 2: Evaluation & Result</span>
          </button>
        </div>

        {/* TAB 1: FRONT PAGE */}
        {activeTab === "front" && (
          <div className="space-y-6">
            
            {/* Operator Basic Info Card */}
            <div className="bg-white rounded-xl border border-gray-300 p-5 space-y-4 shadow-sm">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b border-gray-200 pb-2.5 gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
                  <span className="font-extrabold text-gray-900 text-xs sm:text-sm uppercase tracking-wide">
                    Operator Information
                  </span>
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-50 border border-orange-200 rounded-lg self-start sm:self-auto">
                  <Award className="w-4 h-4 text-orange-600" />
                  <span className="text-xs font-black text-orange-900 uppercase">
                    {initialFormData.level}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs sm:text-sm">
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-gray-700 uppercase tracking-wider text-[11px]">Name</label>
                  <input
                    type="text"
                    disabled={isHOD}
                    className="border border-gray-300 rounded-lg p-2.5 font-medium bg-gray-50/50 focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                    value={headerInfo.name}
                    onChange={(e) => handleHeaderChange("name", e.target.value)}
                    placeholder="Enter operator name"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-gray-700 uppercase tracking-wider text-[11px]">Employee No</label>
                  <input
                    type="text"
                    disabled={isHOD}
                    className="border border-gray-300 rounded-lg p-2.5 font-medium bg-gray-50/50 focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                    value={headerInfo.employeeNo}
                    onChange={(e) => handleHeaderChange("employeeNo", e.target.value)}
                    placeholder="Enter employee number"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-gray-700 uppercase tracking-wider text-[11px]">Qualification</label>
                  <input
                    type="text"
                    disabled={isHOD}
                    className="border border-gray-300 rounded-lg p-2.5 font-medium bg-gray-50/50 focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                    value={headerInfo.qualification}
                    onChange={(e) => handleHeaderChange("qualification", e.target.value)}
                    placeholder="Enter qualification"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-gray-700 uppercase tracking-wider text-[11px]">Evaluation Date</label>
                  <input
                    type="date"
                    disabled={isHOD}
                    className="border border-gray-300 rounded-lg p-2.5 font-medium bg-gray-50/50 focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all cursor-pointer disabled:bg-gray-100 disabled:cursor-not-allowed"
                    value={headerInfo.date}
                    onChange={(e) => handleHeaderChange("date", e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-gray-700 uppercase tracking-wider text-[11px]">Date of Joining (DOJ)</label>
                  <input
                    type="date"
                    disabled={isHOD}
                    className="border border-gray-300 rounded-lg p-2.5 font-medium bg-gray-50/50 focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all cursor-pointer disabled:bg-gray-100 disabled:cursor-not-allowed"
                    value={headerInfo.doj}
                    onChange={(e) => handleHeaderChange("doj", e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-gray-700 uppercase tracking-wider text-[11px]">Line</label>
                  <input
                    type="text"
                    disabled={isHOD}
                    className="border border-gray-300 rounded-lg p-2.5 font-medium bg-gray-50/50 focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                    value={headerInfo.line}
                    onChange={(e) => handleHeaderChange("line", e.target.value)}
                    placeholder="Enter line"
                  />
                </div>
              </div>
            </div>

            {/* Questions Table */}
            <div className="bg-white rounded-xl border border-gray-300 p-5 space-y-4 shadow-sm">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-gray-200 pb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
                  <span className="font-extrabold text-gray-900 text-xs sm:text-sm uppercase tracking-wide">
                    Practical Evaluation Questionnaire
                  </span>
                </div>
                <span className="text-xs text-gray-500 font-medium">Select ✓ for observed compliance rating</span>
              </div>

              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="w-full border-collapse text-xs sm:text-sm text-left min-w-[700px]">
                  <thead>
                    <tr className="bg-gray-100/80 text-gray-900 font-extrabold border-b border-gray-200 uppercase tracking-wider text-[11px]">
                      <th rowSpan={2} className="p-3 w-16 text-center">S.NO</th>
                      <th rowSpan={2} className="p-3 px-4 border-l border-gray-200">QUESTIONS</th>
                      <th colSpan={3} className="p-2 text-center border-l border-gray-200 bg-gray-200/50">
                        RATING CRITERIA (MARKS)
                      </th>
                    </tr>
                    <tr className="bg-gray-50 text-gray-800 font-bold text-center border-b border-gray-200 text-xs">
                      <th className="p-2 w-24 border-l border-gray-200 font-black">OK (2)</th>
                      <th className="p-2 w-24 border-l border-gray-200 font-black">PARTIAL (1)</th>
                      <th className="p-2 w-24 border-l border-gray-200 font-black">NOT OK (0)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {questions.map((q, qIdx) => (
                      <tr key={`q-${q.qNo}`} className="hover:bg-gray-50/60 transition-colors">
                        <td className="p-2.5 text-center font-bold text-gray-600 bg-gray-50/40">
                          {q.qNo}
                        </td>
                        <td className="px-4 py-2 text-gray-800 font-medium border-l border-gray-200 text-xs sm:text-sm">
                          {q.questionText}
                        </td>

                        <td className="p-1 border-l border-gray-200 text-center">
                          <select
                            value={q.ok}
                            disabled={isHOD}
                            onChange={(e) => handleDropdownChange(qIdx, "ok", e.target.value)}
                            className="w-full h-9 text-center font-extrabold text-sm text-green-700 bg-transparent rounded-lg outline-none focus:bg-green-50/50 cursor-pointer disabled:cursor-not-allowed transition-all"
                          >
                            <option value=""></option>
                            <option value="✓" className="text-green-700 font-black">✓</option>
                            <option value="X" className="text-red-700 font-black">X</option>
                          </select>
                        </td>

                        <td className="p-1 border-l border-gray-200 text-center">
                          <select
                            value={q.partial}
                            disabled={isHOD}
                            onChange={(e) => handleDropdownChange(qIdx, "partial", e.target.value)}
                            className="w-full h-9 text-center font-extrabold text-sm text-orange-700 bg-transparent rounded-lg outline-none focus:bg-orange-50/50 cursor-pointer disabled:cursor-not-allowed transition-all"
                          >
                            <option value=""></option>
                            <option value="✓" className="text-orange-700 font-black">✓</option>
                            <option value="X" className="text-red-700 font-black">X</option>
                          </select>
                        </td>

                        <td className="p-1 border-l border-gray-200 text-center">
                          <select
                            value={q.notOk}
                            disabled={isHOD}
                            onChange={(e) => handleDropdownChange(qIdx, "notOk", e.target.value)}
                            className="w-full h-9 text-center font-extrabold text-sm text-red-700 bg-transparent rounded-lg outline-none focus:bg-red-50/50 cursor-pointer disabled:cursor-not-allowed transition-all"
                          >
                            <option value=""></option>
                            <option value="✓" className="text-red-700 font-black">✓</option>
                            <option value="X" className="text-red-700 font-black">X</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Notes & Incharge Approval Section */}
            <div className="bg-white rounded-xl border border-gray-300 p-5 space-y-5 shadow-sm">
              <div className="bg-orange-50/70 border border-orange-200/80 rounded-xl p-4 text-xs font-bold text-orange-950 space-y-1.5">
                <div className="font-extrabold text-orange-900 uppercase tracking-wide mb-1">Evaluation Standards:</div>
                <div>1) NOT OK & PARTIAL should be scheduled for retraining</div>
                <div>2) Production target achievement threshold: Minimum 85%</div>
                <div>3) Quality level 90% and above required to qualify for Level-3 certification</div>
              </div>

              <div className="max-w-md mx-auto border border-gray-300 rounded-xl overflow-hidden shadow-sm">
                <div className="bg-gray-100/90 p-2.5 text-center text-xs font-extrabold text-gray-800 uppercase tracking-wider border-b border-gray-200">
                  Incharge Sign (Evaluated By)
                </div>
                <div className="p-4 bg-gray-50/50 flex flex-col items-center justify-center min-h-[70px]">
                  {isInchargeApproved ? (
                    <div className="flex flex-col items-center justify-center animate-in fade-in duration-200">
                      <span className="text-[10px] font-bold text-green-600 uppercase tracking-wider">
                        Approved By ✓
                      </span>
                      <span className="text-xs font-black text-gray-900 uppercase mt-0.5">
                        {signatures.inchargeSign}
                      </span>
                    </div>
                  ) : isShiftIncharge ? (
                    <button
                      type="button"
                      onClick={handleApproveIncharge}
                      className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-6 py-2 rounded-lg shadow hover:shadow-md transition-all uppercase tracking-wider cursor-pointer"
                    >
                      Approve Sign
                    </button>
                  ) : (
                    <span className="text-gray-400 text-xs italic font-medium">
                      Pending Shift Incharge Approval
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Page 1 Bottom Navigation */}
            <div className="flex justify-end items-center pt-2">
              <button
                type="button"
                onClick={() => setActiveTab("back")}
                className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg hover:shadow-orange-500/25 cursor-pointer uppercase tracking-wider text-xs sm:text-sm flex items-center justify-center gap-2"
              >
                <span>Proceed to Page 2</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: BACK PAGE */}
        {activeTab === "back" && (
          <div className="space-y-6">
            
            {/* Criteria Header */}
            <div className="bg-gray-100 rounded-xl border border-gray-300 px-5 py-3 flex justify-between items-center">
              <span className="text-xs sm:text-sm font-extrabold text-gray-900 uppercase tracking-wide">
                Evaluation Criteria Reference
              </span>
              <span className="text-xs font-black uppercase bg-white border border-gray-300 px-3 py-1 rounded-lg text-gray-800 shadow-sm">
                LEVEL - 3
              </span>
            </div>

            {/* Exam Criteria Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Written Exam Criteria */}
              <div className="bg-white rounded-xl border border-gray-300 p-5 space-y-3 shadow-sm">
                <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
                  <span className="font-extrabold text-gray-900 text-xs sm:text-sm uppercase tracking-wide">
                    Written Exam Criteria
                  </span>
                </div>
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="w-full border-collapse text-xs text-left">
                    <thead className="bg-gray-50 border-b border-gray-200 font-bold text-gray-700">
                      <tr>
                        <th className="p-2.5 w-12 text-center">S.NO</th>
                        <th className="p-2.5 border-l border-gray-200">DESCRIPTION</th>
                        <th className="p-2.5 w-24 text-center border-l border-gray-200">DETAILS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 font-medium">
                      <tr>
                        <td className="p-2 text-center font-bold text-gray-600 bg-gray-50/50">1</td>
                        <td className="p-2 border-l border-gray-200">Number of Questions</td>
                        <td className="p-2 text-center font-black border-l border-gray-200">20</td>
                      </tr>
                      <tr>
                        <td className="p-2 text-center font-bold text-gray-600 bg-gray-50/50">2</td>
                        <td className="p-2 border-l border-gray-200">Marks Per Question</td>
                        <td className="p-2 text-center font-black border-l border-gray-200">5</td>
                      </tr>
                      <tr>
                        <td className="p-2 text-center font-bold text-gray-600 bg-gray-50/50">3</td>
                        <td className="p-2 border-l border-gray-200">Total Marks (20 × 5)</td>
                        <td className="p-2 text-center font-black border-l border-gray-200">100</td>
                      </tr>
                      <tr>
                        <td className="p-2 text-center font-bold text-gray-600 bg-gray-50/50">4</td>
                        <td className="p-2 border-l border-gray-200">Pass Mark</td>
                        <td className="p-2 text-center font-black border-l border-gray-200 text-green-700">80</td>
                      </tr>
                      <tr>
                        <td className="p-2 text-center font-bold text-gray-600 bg-gray-50/50">5</td>
                        <td className="p-2 border-l border-gray-200">Pass Criteria</td>
                        <td className="p-2 text-center font-black border-l border-gray-200 text-green-700">80%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Practical Exam Criteria */}
              <div className="bg-white rounded-xl border border-gray-300 p-5 space-y-3 shadow-sm">
                <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
                  <span className="font-extrabold text-gray-900 text-xs sm:text-sm uppercase tracking-wide">
                    Practical Exam Criteria
                  </span>
                </div>
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="w-full border-collapse text-xs text-left">
                    <thead className="bg-gray-50 border-b border-gray-200 font-bold text-gray-700">
                      <tr>
                        <th className="p-2.5 w-12 text-center">S.NO</th>
                        <th className="p-2.5 border-l border-gray-200">DESCRIPTION</th>
                        <th className="p-2.5 w-24 text-center border-l border-gray-200">DETAILS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 font-medium">
                      <tr>
                        <td className="p-2 text-center font-bold text-gray-600 bg-gray-50/50">1</td>
                        <td className="p-2 border-l border-gray-200">Number of Questions</td>
                        <td className="p-2 text-center font-black border-l border-gray-200">20</td>
                      </tr>
                      <tr>
                        <td className="p-2 text-center font-bold text-gray-600 bg-gray-50/50">2</td>
                        <td className="p-2 border-l border-gray-200">Marks Per Question</td>
                        <td className="p-2 text-center font-black border-l border-gray-200">2</td>
                      </tr>
                      <tr>
                        <td className="p-2 text-center font-bold text-gray-600 bg-gray-50/50">3</td>
                        <td className="p-2 border-l border-gray-200">Total Marks (20 × 2)</td>
                        <td className="p-2 text-center font-black border-l border-gray-200">40</td>
                      </tr>
                      <tr>
                        <td className="p-2 text-center font-bold text-gray-600 bg-gray-50/50">4</td>
                        <td className="p-2 border-l border-gray-200">Pass Mark</td>
                        <td className="p-2 text-center font-black border-l border-gray-200 text-green-700">36</td>
                      </tr>
                      <tr>
                        <td className="p-2 text-center font-bold text-gray-600 bg-gray-50/50">5</td>
                        <td className="p-2 border-l border-gray-200">Pass Criteria</td>
                        <td className="p-2 text-center font-black border-l border-gray-200 text-green-700">90%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Overall Mark Entry Card */}
            <div className="bg-white rounded-xl border border-gray-300 p-5 space-y-4 shadow-sm">
              <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
                <span className="font-extrabold text-gray-900 text-xs sm:text-sm uppercase tracking-wide">
                  Overall Score Summary
                </span>
              </div>

              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="w-full border-collapse text-xs sm:text-sm text-left min-w-[500px]">
                  <thead className="bg-gray-100 font-bold text-gray-800 border-b border-gray-200 uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="p-2.5 w-12 text-center">S.NO</th>
                      <th className="p-2.5 px-3 border-l border-gray-200">EXAMINATION</th>
                      <th className="p-2.5 w-44 text-center border-l border-gray-200">SCORE</th>
                      <th className="p-2.5 w-36 text-center border-l border-gray-200">PERCENTAGE</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    <tr className="hover:bg-gray-50/50">
                      <td className="p-2 text-center font-bold text-gray-600 bg-gray-50/50">1</td>
                      <td className="p-2 px-3 border-l border-gray-200 font-semibold text-gray-800">
                        Written Examination (Max 100)
                      </td>
                      <td className="p-1 border-l border-gray-200">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          disabled={isHOD}
                          placeholder="e.g. 85"
                          className="w-full text-center p-2 outline-none font-bold bg-transparent focus:bg-white rounded-lg disabled:bg-gray-50 transition-all"
                          value={writtenExamMark}
                          onChange={handleMarkChange(setWrittenExamMark, 100, "Written exam mark")}
                          onKeyDown={blockInvalidMarkKeys}
                        />
                      </td>
                      <td className="p-2 text-center font-black text-gray-900 bg-gray-50/70 border-l border-gray-200">
                        {writtenPercentage || "-"}
                      </td>
                    </tr>
                    <tr className="hover:bg-gray-50/50">
                      <td className="p-2 text-center font-bold text-gray-600 bg-gray-50/50">2</td>
                      <td className="p-2 px-3 border-l border-gray-200 font-semibold text-gray-800">
                        Practical Examination (Max 40)
                      </td>
                      <td className="p-1 border-l border-gray-200">
                        <input
                          type="number"
                          min="0"
                          max="40"
                          disabled={isHOD}
                          placeholder="e.g. 36"
                          className="w-full text-center p-2 outline-none font-bold bg-transparent focus:bg-white rounded-lg disabled:bg-gray-50 transition-all"
                          value={practicalExamMark}
                          onChange={handleMarkChange(setPracticalExamMark, 40, "Practical exam mark")}
                          onKeyDown={blockInvalidMarkKeys}
                        />
                      </td>
                      <td className="p-2 text-center font-black text-gray-900 bg-gray-50/70 border-l border-gray-200">
                        {practicalPercentage || "-"}
                      </td>
                    </tr>
                    <tr className="bg-gray-100/70 font-extrabold border-t-2 border-gray-300">
                      <td colSpan={2} className="p-3 text-right uppercase text-xs tracking-wider text-gray-700">
                        Final Evaluation Status:
                      </td>
                      <td colSpan={2} className="p-2 border-l border-gray-200">
                        <div className="flex justify-center">
                          <select
                            value={status}
                            disabled={isHOD}
                            onChange={(e) => setStatus(e.target.value)}
                            className="w-48 border border-gray-300 p-2 rounded-lg font-black text-xs outline-none cursor-pointer bg-white text-center focus:border-orange-500 disabled:bg-gray-100 uppercase tracking-wider transition-all"
                          >
                            <option value="">Select Status</option>
                            <option value="PASS" className="text-green-700 font-bold">
                              PASS
                            </option>
                            <option value="FAIL" className="text-red-700 font-bold">
                              FAIL
                            </option>
                          </select>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Approval Table Card */}
            <div className="bg-white rounded-xl border border-gray-300 p-5 space-y-4 shadow-sm">
              <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
                <span className="font-extrabold text-gray-900 text-xs sm:text-sm uppercase tracking-wide">
                  Authorization & Approvals
                </span>
              </div>

              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="w-full border-collapse text-xs text-center min-w-[500px]">
                  <thead>
                    <tr className="bg-gray-100 font-extrabold text-gray-800 border-b border-gray-200 uppercase tracking-wider text-[11px]">
                      <th className="p-3 w-1/2">INCHARGE SIGN (EVALUATED BY)</th>
                      <th className="p-3 w-1/2 border-l border-gray-200">HOD SIGN</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="h-20">
                      <td className="p-3 text-center align-middle bg-gray-50/30">
                        {isInchargeApproved ? (
                          <div className="flex flex-col items-center justify-center animate-in fade-in duration-200">
                            <span className="text-[10px] font-bold text-green-600 uppercase tracking-wider">
                              Approved By ✓
                            </span>
                            <span className="text-xs font-black text-gray-900 uppercase mt-0.5">
                              {signatures.inchargeSign}
                            </span>
                          </div>
                        ) : isShiftIncharge ? (
                          <button
                            type="button"
                            onClick={handleApproveIncharge}
                            className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-6 py-2 rounded-lg shadow hover:shadow-md transition-all uppercase tracking-wider cursor-pointer"
                          >
                            Approve
                          </button>
                        ) : (
                          <span className="text-gray-400 text-xs italic font-medium">
                            Pending Shift Incharge
                          </span>
                        )}
                      </td>

                      <td className="p-3 text-center align-middle bg-gray-50/30 border-l border-gray-200">
                        {isHodApproved ? (
                          <div className="flex flex-col items-center justify-center animate-in fade-in duration-200">
                            <span className="text-[10px] font-bold text-green-600 uppercase tracking-wider">
                              Approved By ✓
                            </span>
                            <span className="text-xs font-black text-gray-900 uppercase mt-0.5">
                              approved by {signatures.hodSign}
                            </span>
                          </div>
                        ) : isHOD ? (
                          <div className="flex flex-col items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={handleApproveHod}
                              className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-5 py-2 rounded-lg shadow uppercase tracking-wider cursor-pointer transition-all"
                            >
                              Approve HOD
                            </button>
                            {headerInfo.assignedHod && (
                              <span className="text-[10px] text-gray-500 font-semibold uppercase">
                                (Assigned: {headerInfo.assignedHod})
                              </span>
                            )}
                          </div>
                        ) : isSavedRecord ? (
                          <div className="flex flex-col items-center justify-center">
                            <span className="text-red-600 text-xs font-bold uppercase tracking-wider">
                              pending
                            </span>
                            {headerInfo.assignedHod && (
                              <span className="text-[10px] font-bold text-gray-500 uppercase mt-0.5">
                                (Assigned: {headerInfo.assignedHod})
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-1 w-full max-w-xs mx-auto">
                            <select
                              className="w-full bg-white border border-gray-300 p-2 rounded-lg font-bold text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-center disabled:bg-gray-100 cursor-pointer transition-all"
                              value={headerInfo.assignedHod || ""}
                              onChange={(e) => handleHeaderChange("assignedHod", e.target.value)}
                              disabled={isSavedRecord}
                            >
                              <option value="">-- Select HOD Incharge --</option>
                              {hodUsers.map((h, hIdx) => {
                                const uname = h.username || h.employeeId || h.name;
                                return (
                                  <option key={`${uname}-${hIdx}`} value={uname}>
                                    {uname.toUpperCase()}
                                  </option>
                                );
                              })}
                            </select>
                          </div>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t border-gray-200">
              <span className="text-xs text-gray-500 font-semibold text-center sm:text-left">
                Form Ref: {qfValue}
              </span>

              <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setActiveTab("front")}
                  className="w-full sm:w-auto px-6 py-3 border border-gray-300 hover:bg-gray-100 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer text-gray-700 flex items-center justify-center gap-1.5"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Back to Page 1</span>
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving || saveSuccess}
                  className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white px-9 py-3.5 rounded-xl font-black transition-all shadow-lg hover:shadow-orange-500/25 cursor-pointer uppercase tracking-wider text-xs sm:text-sm active:scale-95"
                >
                  {isSaving
                    ? "SAVING..."
                    : saveSuccess
                    ? "SAVED ✓"
                    : isHOD
                    ? "Submit HOD Approval"
                    : "Submit for Verification"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}