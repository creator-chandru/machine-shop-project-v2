import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Header from "../components/Header";
import { FileDown, Calendar, X, ArrowLeft } from "lucide-react";

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
    <div className="min-h-screen bg-[#2d2d2d] flex flex-col items-center justify-center p-6 pb-20">
      <Header />

      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ message: "", type: "" })}
      />

      {showPdfModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md border-2 border-gray-100 animate-in fade-in">
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
                className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="font-bold text-gray-700 block mb-1 text-xs uppercase tracking-wider">
                  From Date
                </label>
                <input
                  type="date"
                  className="w-full border border-gray-300 p-2.5 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm font-semibold bg-white"
                  value={pdfFromDate}
                  onChange={(e) => setPdfFromDate(e.target.value)}
                />
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1 text-xs uppercase tracking-wider">
                  To Date
                </label>
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
                className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-gray-600 hover:bg-gray-100 rounded transition-colors cursor-pointer"
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

      {(isSaving || saveSuccess) && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl px-10 py-8 text-center">
            {isSaving ? (
              <>
                <div className="w-10 h-10 border-4 border-gray-300 border-t-orange-500 rounded-full animate-spin mx-auto mb-5"></div>
                <h2 className="text-xl font-bold text-gray-800">Saving Data...</h2>
                <p className="text-gray-500 mt-2">
                  {isHOD ? "Completing HOD Approval..." : "Submitting for HOD Approval..."}
                </p>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold text-green-800">Data Saved Successfully</h2>
                <p className="text-gray-500 mt-2">Redirecting...</p>
              </>
            )}
          </div>
        </div>
      )}

      <div className="bg-white w-full max-w-[92rem] rounded-xl p-8 shadow-2xl overflow-x-auto border-4 border-gray-100 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-200 pb-4 gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <button
                type="button"
                onClick={() => navigate(isHOD ? `/hod/${shopId || 3}` : `/operator/${shopId || 3}`)}
                className="p-1 text-gray-600 hover:text-orange-600 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
                title="Back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <span className="text-xs font-bold text-orange-600 tracking-wider uppercase">
                {initialFormData.company}
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-gray-800 uppercase tracking-wide">
              {initialFormData.title}
            </h2>
            <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-2 font-bold">
              <span>{qfValue}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowPdfModal(true)}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider shadow transition-colors cursor-pointer"
          >
            <FileDown className="w-4 h-4" /> Download PDF
          </button>
        </div>

        <div className="flex gap-2 border-b border-gray-300 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab("front")}
            className={`px-6 py-2.5 rounded-t-lg font-bold text-sm transition-colors cursor-pointer ${
              activeTab === "front"
                ? "bg-orange-500 text-white shadow"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            FRONT PAGE : PRACTICAL QUESTIONS
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("back")}
            className={`px-6 py-2.5 rounded-t-lg font-bold text-sm transition-colors cursor-pointer ${
              activeTab === "back"
                ? "bg-orange-500 text-white shadow"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            BACK PAGE : EVALUATION CRITERIA & OVERALL RESULT
          </button>
        </div>

        {activeTab === "front" && (
          <div>
            <div className="border-2 border-gray-800 mb-6">
              <div className="grid grid-cols-12 divide-x-2 divide-gray-800 border-b-2 border-gray-800">
                <div className="col-span-3 p-3 flex items-center justify-center">
                  <span className="font-extrabold text-sm text-gray-800 uppercase text-center">
                    {initialFormData.company}
                  </span>
                </div>
                <div className="col-span-6 p-3 text-center">
                  <h2 className="text-lg font-extrabold text-gray-900 uppercase">
                    {initialFormData.title}
                  </h2>
                  <h3 className="text-xs font-bold text-gray-700 uppercase">
                    {initialFormData.subtitle}
                  </h3>
                </div>
                <div className="col-span-3 p-3 flex items-center justify-center bg-gray-50">
                  <span className="font-extrabold text-gray-900 text-base">
                    {initialFormData.level}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x-2 divide-gray-800 p-3 text-sm font-semibold">
                <div className="space-y-2 pr-2">
                  <div className="flex items-center">
                    <label className="w-36 text-gray-700">NAME :</label>
                    <input
                      type="text"
                      disabled={isHOD}
                      className="flex-1 border-b border-gray-400 focus:border-orange-500 outline-none px-2 py-0.5 disabled:bg-gray-100"
                      value={headerInfo.name}
                      onChange={(e) => handleHeaderChange("name", e.target.value)}
                      placeholder="Enter operator name"
                    />
                  </div>
                  <div className="flex items-center">
                    <label className="w-36 text-gray-700">EMPLOYEE NO :</label>
                    <input
                      type="text"
                      disabled={isHOD}
                      className="flex-1 border-b border-gray-400 focus:border-orange-500 outline-none px-2 py-0.5 disabled:bg-gray-100"
                      value={headerInfo.employeeNo}
                      onChange={(e) => handleHeaderChange("employeeNo", e.target.value)}
                      placeholder="Enter employee number"
                    />
                  </div>
                  <div className="flex items-center">
                    <label className="w-36 text-gray-700">QUALIFICATION :</label>
                    <input
                      type="text"
                      disabled={isHOD}
                      className="flex-1 border-b border-gray-400 focus:border-orange-500 outline-none px-2 py-0.5 disabled:bg-gray-100"
                      value={headerInfo.qualification}
                      onChange={(e) => handleHeaderChange("qualification", e.target.value)}
                      placeholder="Enter qualification"
                    />
                  </div>
                </div>

                <div className="space-y-2 pl-2">
                  <div className="flex items-center">
                    <label className="w-32 text-gray-700">DATE :</label>
                    <input
                      type="date"
                      disabled={isHOD}
                      className="flex-1 border-b border-gray-400 focus:border-orange-500 outline-none px-2 py-0.5 bg-transparent cursor-pointer disabled:bg-gray-100"
                      value={headerInfo.date}
                      onChange={(e) => handleHeaderChange("date", e.target.value)}
                    />
                  </div>
                  <div className="flex items-center">
                    <label className="w-32 text-gray-700">DOJ :</label>
                    <input
                      type="date"
                      disabled={isHOD}
                      className="flex-1 border-b border-gray-400 focus:border-orange-500 outline-none px-2 py-0.5 bg-transparent cursor-pointer disabled:bg-gray-100"
                      value={headerInfo.doj}
                      onChange={(e) => handleHeaderChange("doj", e.target.value)}
                    />
                  </div>
                  <div className="flex items-center">
                    <label className="w-32 text-gray-700">LINE :</label>
                    <input
                      type="text"
                      disabled={isHOD}
                      className="flex-1 border-b border-gray-400 focus:border-orange-500 outline-none px-2 py-0.5 disabled:bg-gray-100"
                      value={headerInfo.line}
                      onChange={(e) => handleHeaderChange("line", e.target.value)}
                      placeholder="Enter line"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse border-2 border-gray-800 text-sm">
                <thead>
                  <tr className="bg-gray-200 text-gray-900 font-bold">
                    <th rowSpan={3} className="border border-gray-800 p-2 w-16 text-center">
                      S.NO
                    </th>
                    <th rowSpan={3} className="border border-gray-800 p-2 text-left px-4">
                      QUESTIONS
                    </th>
                    <th colSpan={3} className="border border-gray-800 p-1 text-center uppercase tracking-wider">
                      MARKS
                    </th>
                  </tr>
                  <tr className="bg-gray-100 text-gray-900 font-extrabold text-center">
                    <th className="border border-gray-800 p-1 w-24">2</th>
                    <th className="border border-gray-800 p-1 w-24">1</th>
                    <th className="border border-gray-800 p-1 w-24">0</th>
                  </tr>
                  <tr className="bg-gray-100 text-gray-900 font-bold text-center">
                    <th className="border border-gray-800 p-1">OK</th>
                    <th className="border border-gray-800 p-1">PARTIAL</th>
                    <th className="border border-gray-800 p-1">NOT OK</th>
                  </tr>
                </thead>
                <tbody>
                  {questions.map((q, qIdx) => (
                    <tr key={`q-${q.qNo}`} className="hover:bg-gray-50">
                      <td className="border border-gray-800 p-2 text-center font-bold">
                        {q.qNo}
                      </td>
                      <td className="border border-gray-800 px-4 py-2 font-medium text-gray-800">
                        {q.questionText}
                      </td>

                      <td className="border border-gray-800 p-0 text-center">
                        <select
                          value={q.ok}
                          disabled={isHOD}
                          onChange={(e) => handleDropdownChange(qIdx, "ok", e.target.value)}
                          className="w-full h-full min-h-[34px] text-center font-bold text-base text-gray-900 bg-transparent outline-none cursor-pointer disabled:cursor-not-allowed"
                        >
                          <option value=""></option>
                          <option value="✓">✓</option>
                          <option value="X">X</option>
                        </select>
                      </td>

                      <td className="border border-gray-800 p-0 text-center">
                        <select
                          value={q.partial}
                          disabled={isHOD}
                          onChange={(e) => handleDropdownChange(qIdx, "partial", e.target.value)}
                          className="w-full h-full min-h-[34px] text-center font-bold text-base text-gray-900 bg-transparent outline-none cursor-pointer disabled:cursor-not-allowed"
                        >
                          <option value=""></option>
                          <option value="✓">✓</option>
                          <option value="X">X</option>
                        </select>
                      </td>

                      <td className="border border-gray-800 p-0 text-center">
                        <select
                          value={q.notOk}
                          disabled={isHOD}
                          onChange={(e) => handleDropdownChange(qIdx, "notOk", e.target.value)}
                          className="w-full h-full min-h-[34px] text-center font-bold text-base text-gray-900 bg-transparent outline-none cursor-pointer disabled:cursor-not-allowed"
                        >
                          <option value=""></option>
                          <option value="✓">✓</option>
                          <option value="X">X</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 border-2 border-gray-800 p-4 bg-white text-xs font-bold text-gray-800 space-y-1">
              <div>Note:- 1) NOT OK & PARTIAL SHOULD BE TAKEN TO RETRAINING</div>
              <div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;2) PRODUCTION TARGET ACHIEVED SHOULD BE 85%</div>
              <div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;3) QUALITY LEVEL 90% ABOVE SHOULD BE PASSED TO LEVEL-3</div>

              <div className="pt-6 border-t border-gray-300 mt-4">
                <div className="max-w-md mx-auto border-2 border-gray-800 rounded-lg overflow-hidden">
                  <div className="bg-gray-100 p-2 text-center text-xs font-bold text-gray-800 uppercase tracking-wide border-b border-gray-800">
                    INCHARGE SIGN (EVALUATED BY)
                  </div>
                  <div className="p-3 bg-gray-50/50 flex flex-col items-center justify-center min-h-[60px]">
                    {isInchargeApproved ? (
                      <div className="flex flex-col items-center justify-center animate-in fade-in duration-200">
                        <span className="text-[10px] font-bold text-green-600 uppercase">
                          Approved By ✓
                        </span>
                        <span className="text-xs font-black text-gray-900 uppercase">
                          {signatures.inchargeSign}
                        </span>
                      </div>
                    ) : isShiftIncharge ? (
                      <button
                        type="button"
                        onClick={handleApproveIncharge}
                        className="bg-orange-500 hover:bg-orange-600 text-white text-[11px] font-bold px-6 py-2 rounded shadow hover:scale-105 transition-all uppercase tracking-wider cursor-pointer"
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
            </div>

            <div className="flex justify-end items-center mt-6 pt-4 border-t border-gray-300">
              <button
                type="button"
                onClick={() => setActiveTab("back")}
                className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 rounded font-bold transition-colors shadow-lg hover:cursor-pointer uppercase tracking-wider text-sm flex items-center gap-2"
              >
                GO TO PAGE 2 →
              </button>
            </div>
          </div>
        )}

        {activeTab === "back" && (
          <div className="space-y-6">
            <div className="border-2 border-gray-800 flex justify-between items-center bg-gray-200 px-4 py-2 font-extrabold text-gray-900">
              <span className="text-base uppercase">EVALUATION CRITERIA</span>
              <span className="text-base uppercase bg-white border border-gray-800 px-3 py-0.5 rounded">
                LEVEL - 3
              </span>
            </div>

            <div className="border-2 border-gray-800">
              <div className="bg-gray-100 font-extrabold text-sm px-4 py-2 border-b-2 border-gray-800">
                WRITTEN EXAM
              </div>
              <table className="w-full border-collapse text-sm text-left">
                <thead className="bg-gray-50 border-b border-gray-800 font-bold">
                  <tr>
                    <th className="p-2 border-r border-gray-800 w-16 text-center">S.NO</th>
                    <th className="p-2 border-r border-gray-800">DESCRIPTION</th>
                    <th className="p-2 w-48 text-center">DETAILS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800 font-medium">
                  <tr>
                    <td className="p-2 border-r border-gray-800 text-center font-bold">1</td>
                    <td className="p-2 border-r border-gray-800">NUMBER OF QUESTIONS</td>
                    <td className="p-2 text-center font-bold">20</td>
                  </tr>
                  <tr>
                    <td className="p-2 border-r border-gray-800 text-center font-bold">2</td>
                    <td className="p-2 border-r border-gray-800">EACH QUESTION MARK</td>
                    <td className="p-2 text-center font-bold">5</td>
                  </tr>
                  <tr>
                    <td className="p-2 border-r border-gray-800 text-center font-bold">3</td>
                    <td className="p-2 border-r border-gray-800">TOTAL MARKS (20*5)</td>
                    <td className="p-2 text-center font-bold">100</td>
                  </tr>
                  <tr>
                    <td className="p-2 border-r border-gray-800 text-center font-bold">4</td>
                    <td className="p-2 border-r border-gray-800">PASS MARK</td>
                    <td className="p-2 text-center font-bold">80</td>
                  </tr>
                  <tr>
                    <td className="p-2 border-r border-gray-800 text-center font-bold">5</td>
                    <td className="p-2 border-r border-gray-800">PASS MARK CRITERIA</td>
                    <td className="p-2 text-center font-bold">80%</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="border-2 border-gray-800">
              <div className="bg-gray-100 font-extrabold text-sm px-4 py-2 border-b-2 border-gray-800">
                PRACTICAL EXAM
              </div>
              <table className="w-full border-collapse text-sm text-left">
                <thead className="bg-gray-50 border-b border-gray-800 font-bold">
                  <tr>
                    <th className="p-2 border-r border-gray-800 w-16 text-center">S.NO</th>
                    <th className="p-2 border-r border-gray-800">DESCRIPTION</th>
                    <th className="p-2 w-48 text-center">DETAILS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800 font-medium">
                  <tr>
                    <td className="p-2 border-r border-gray-800 text-center font-bold">1</td>
                    <td className="p-2 border-r border-gray-800">NUMBER OF QUESTIONS</td>
                    <td className="p-2 text-center font-bold">20</td>
                  </tr>
                  <tr>
                    <td className="p-2 border-r border-gray-800 text-center font-bold">2</td>
                    <td className="p-2 border-r border-gray-800">EACH QUESTION MARK</td>
                    <td className="p-2 text-center font-bold">2</td>
                  </tr>
                  <tr>
                    <td className="p-2 border-r border-gray-800 text-center font-bold">3</td>
                    <td className="p-2 border-r border-gray-800">TOTAL MARKS (20*2)</td>
                    <td className="p-2 text-center font-bold">40</td>
                  </tr>
                  <tr>
                    <td className="p-2 border-r border-gray-800 text-center font-bold">4</td>
                    <td className="p-2 border-r border-gray-800">PASS MARK</td>
                    <td className="p-2 text-center font-bold">36</td>
                  </tr>
                  <tr>
                    <td className="p-2 border-r border-gray-800 text-center font-bold">5</td>
                    <td className="p-2 border-r border-gray-800">PASS MARK CRITERIA</td>
                    <td className="p-2 text-center font-bold">90%</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="border-2 border-gray-800">
              <div className="bg-gray-100 font-extrabold text-sm px-4 py-2 border-b-2 border-gray-800 uppercase">
                OVERALL MARK
              </div>
              <table className="w-full border-collapse text-sm text-left">
                <thead className="bg-gray-50 border-b border-gray-800 font-bold">
                  <tr>
                    <th className="p-2 border-r border-gray-800 w-16 text-center">S.NO</th>
                    <th className="p-2 border-r border-gray-800">DESCRIPTION</th>
                    <th className="p-2 border-r border-gray-800 w-48 text-center">MARK</th>
                    <th className="p-2 w-48 text-center">PERCENTAGE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800 font-medium">
                  <tr>
                    <td className="p-2 border-r border-gray-800 text-center font-bold">1</td>
                    <td className="p-2 border-r border-gray-800 font-semibold">
                      SCORED MARK IN WRITTEN EXAM
                    </td>
                    <td className="p-0 border-r border-gray-800">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        disabled={isHOD}
                        placeholder="e.g. 85 (out of 100)"
                        className="w-full h-full text-center p-2 outline-none font-bold bg-transparent disabled:bg-gray-50"
                        value={writtenExamMark}
                        onChange={handleMarkChange(setWrittenExamMark, 100, "Written exam mark")}
                        onKeyDown={blockInvalidMarkKeys}
                      />
                    </td>
                    <td className="p-2 text-center font-extrabold text-gray-800 bg-gray-50">
                      {writtenPercentage || "-"}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2 border-r border-gray-800 text-center font-bold">2</td>
                    <td className="p-2 border-r border-gray-800 font-semibold">
                      SCORED MARK IN PRACTICAL EXAM
                    </td>
                    <td className="p-0 border-r border-gray-800">
                      <input
                        type="number"
                        min="0"
                        max="40"
                        disabled={isHOD}
                        placeholder="e.g. 36 (out of 40)"
                        className="w-full h-full text-center p-2 outline-none font-bold bg-transparent disabled:bg-gray-50"
                        value={practicalExamMark}
                        onChange={handleMarkChange(setPracticalExamMark, 40, "Practical exam mark")}
                        onKeyDown={blockInvalidMarkKeys}
                      />
                    </td>
                    <td className="p-2 text-center font-extrabold text-gray-800 bg-gray-50">
                      {practicalPercentage || "-"}
                    </td>
                  </tr>

                  <tr className="bg-gray-100 font-extrabold">
                    <td colSpan={2} className="p-3 text-right uppercase text-sm border-r border-gray-800">
                      STATUS :
                    </td>
                    <td colSpan={2} className="p-1 text-center">
                      <select
                        value={status}
                        disabled={isHOD}
                        onChange={(e) => setStatus(e.target.value)}
                        className="w-48 border-2 border-gray-800 p-1.5 rounded font-extrabold text-sm outline-none cursor-pointer bg-white text-center disabled:bg-gray-100"
                      >
                        <option value="">Select Status</option>
                        <option value="PASS" className="text-green-700 font-bold">
                          PASS
                        </option>
                        <option value="FAIL" className="text-red-700 font-bold">
                          FAIL
                        </option>
                      </select>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse border-2 border-gray-800 text-xs text-center min-w-[600px]">
                <thead>
                  <tr className="bg-gray-100 text-gray-800 font-bold">
                    <th className="border border-gray-800 p-3 w-1/2">
                      INCHARGE SIGN (EVALUATED BY)
                    </th>
                    <th className="border border-gray-800 p-3 w-1/2">
                      HOD SIGN
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="h-16">
                    <td className="border border-gray-800 p-2 text-center align-middle bg-gray-50/40">
                      {isInchargeApproved ? (
                        <div className="flex flex-col items-center justify-center animate-in fade-in duration-200">
                          <span className="text-[10px] font-bold text-green-600 uppercase">
                            Approved By ✓
                          </span>
                          <span className="text-xs font-black text-gray-900 uppercase">
                            {signatures.inchargeSign}
                          </span>
                        </div>
                      ) : isShiftIncharge ? (
                        <button
                          type="button"
                          onClick={handleApproveIncharge}
                          className="bg-orange-500 hover:bg-orange-600 text-white text-[11px] font-bold px-5 py-1.5 rounded shadow hover:scale-105 transition-all uppercase tracking-wider cursor-pointer"
                        >
                          Approve
                        </button>
                      ) : (
                        <span className="text-gray-400 text-xs italic">
                          Pending Shift Incharge
                        </span>
                      )}
                    </td>

                    <td className="border border-gray-800 p-2 text-center align-middle bg-gray-50/40">
                      {isHodApproved ? (
                        <div className="flex flex-col items-center justify-center animate-in fade-in duration-200">
                          <span className="text-[10px] font-bold text-green-600 uppercase">
                            Approved By ✓
                          </span>
                          <span className="text-xs font-black text-gray-900 uppercase">
                            approved by {signatures.hodSign}
                          </span>
                        </div>
                      ) : isHOD ? (
                        <div className="flex flex-col items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={handleApproveHod}
                            className="bg-green-600 hover:bg-green-700 text-white text-[11px] font-bold px-4 py-1.5 rounded shadow hover:scale-105 transition-all uppercase tracking-wider cursor-pointer"
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
                          <span className="text-red-600 text-xs font-bold uppercase">
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
                            className="w-full bg-white border border-gray-300 p-1.5 rounded font-bold text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-orange-500 text-center disabled:bg-gray-100 cursor-pointer"
                            value={headerInfo.assignedHod || ""}
                            onChange={(e) => handleHeaderChange("assignedHod", e.target.value)}
                            disabled={isSavedRecord}
                          >
                            <option value="">-- Select HOD --</option>
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

            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-6 pt-4 border-t border-gray-300">
              <span className="text-xs text-gray-500 font-semibold">
                {qfValue}
              </span>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab("front")}
                  className="px-6 py-3 border border-gray-400 hover:bg-gray-100 rounded font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer text-gray-700"
                >
                  ← Back to Page 1
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving || saveSuccess}
                  className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white px-10 py-3 rounded font-bold transition-colors shadow-lg hover:cursor-pointer uppercase tracking-wider text-sm"
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