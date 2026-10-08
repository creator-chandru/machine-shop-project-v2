import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { ArrowLeft, FileDown, Plus, Trash2, CheckCircle2 } from "lucide-react";
import Header from "../components/Header";

const formMeta = {
  formCode: "QF/08/CAT-05",
  revision: "02",
  revisionDate: "25.11.2024",
  title: "8D Problem Solving Report",
  company: "SAKTHI AUTO",
};

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
    <div className={`fixed bottom-6 right-6 z-50 ${bgColor} text-white px-5 py-3 rounded-lg shadow-2xl flex items-center gap-3 animate-bounce`}>
      <span className="text-sm font-semibold">{message}</span>
      <button onClick={onClose} className="ml-2 font-bold text-lg leading-none hover:text-gray-200">×</button>
    </div>
  );
};

const StatusQuadrantIcon = ({ level = 1, onChange, editable = true }) => {
  return (
    <div 
      className={`inline-flex items-center justify-center select-none ${editable ? 'cursor-pointer' : 'cursor-default opacity-80'}`}
      onClick={() => {
        if (!editable) return;
        const next = (level % 4) + 1;
        onChange?.(next);
      }}
      title={`Level ${level}/4`}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" className="transform -rotate-90">
        <circle cx="12" cy="12" r="10" stroke="#1f2937" strokeWidth="1.5" fill="none" />
        <line x1="12" y1="2" x2="12" y2="22" stroke="#1f2937" strokeWidth="1" />
        <line x1="2" y1="12" x2="22" y2="12" stroke="#1f2937" strokeWidth="1" />
        {level >= 1 && <path d="M12,12 L22,12 A10,10 0 0,0 12,2 Z" fill="#2563eb" />}
        {level >= 2 && <path d="M12,12 L12,22 A10,10 0 0,0 22,12 Z" fill="#2563eb" />}
        {level >= 3 && <path d="M12,12 L2,12 A10,10 0 0,0 12,22 Z" fill="#2563eb" />}
        {level >= 4 && <path d="M12,12 L12,2 A10,10 0 0,0 2,12 Z" fill="#16a34a" />}
      </svg>
    </div>
  );
};

export default function EightDProblemSolvingReport() {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Role extraction
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  const currentUsername = currentUser?.username || currentUser?.employeeId || "Unknown";
  const currentUserRole = (currentUser?.role || "").toLowerCase();

  const isShiftIncharge =
    currentUserRole === "shiftincharge" ||
    currentUserRole === "supervisor" ||
    currentUserRole === "operator" ||
    currentUserRole === "";
  const isQC = currentUserRole === "qc" || currentUserRole === "qualitycontroller";
  const isPE =
    currentUserRole === "pe" ||
    currentUserRole === "productengineer" ||
    currentUserRole === "productionengineer";
  const isHOF =
    currentUserRole === "hof" ||
    currentUserRole === "headfacility" ||
    currentUserRole === "headofproduction";

  const isReadOnlyApprover = isQC || isPE || isHOF;

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSavedRecord, setIsSavedRecord] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "" });

  // When saved record exists or role is approver, everything becomes non-editable
  const isFormLocked = isSavedRecord || isReadOnlyApprover;

  // Master Data Dropdowns
  const [partSets, setPartSets] = useState([]);
  const [loadingPartSets, setLoadingPartSets] = useState(true);
  const [qcUsers, setQcUsers] = useState([]);
  const [peUsers, setPeUsers] = useState([]);
  const [hofUsers, setHofUsers] = useState([]);

  const triggerToast = (message, type = "error") => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: "", type: "" }), 4000);
  };

  // Header State
  const [header, setHeader] = useState({
    date: getTodayISODate(),
    shift: "1ST",
    customer: "",
    partName: "",
    partNo: "",
    category: "Quality",
    problemFoundBy: "Production",
    problemFoundByOther: "",
    assignedQc: "",
    assignedPe: "",
    assignedHof: "",
  });

  // 1. Team Members
  const [teamMembers, setTeamMembers] = useState(["", "", "", "", "", ""]);

  // 2. Problem Scope & Emergency Actions
  const [problemScope, setProblemScope] = useState("New");
  const [emergencyActions, setEmergencyActions] = useState({
    qualityAlert: false,
    segregationCustomerQty: "",
    segregationCustomerNotOk: "",
    segregationFGQty: "",
    segregationFGNotOk: "",
    segregationWIPQty: "",
    segregationWIPNotOk: "",
    customerVisitRequired: "No",
  });

  // 2a. Problem Description
  const [problemDescription, setProblemDescription] = useState("");

  // 2b. Process Flow
  const [processFlow, setProcessFlow] = useState([
    "OP10 RECEIVING INSPECTION",
    "OP20 TURNING A&B",
    "OP30 SBA MILLING & DRILLING",
    "OP40 & OP50 TRA MILLING & DRILLING",
    "OP60 CA MILLING & DRILLING",
    "OP70 KPA SIDE MILLING & DRILLING",
    "OP80 MACHINE TRACEABILITY",
    "OP90 ONLINE INSPECTION",
  ]);

  // 3. Interim Containment Actions
  const [interimActions, setInterimActions] = useState([
    { action: "", who: "", dueDate: getTodayISODate(), breakPoint: getTodayISODate() },
  ]);

  // 4. Fishbone Diagram
  const [fishbone, setFishbone] = useState({
    man: [
      { text: "WRONG PROGRAM CHANGED", side: "left" },
      { text: "WRONG OFFSET GIVEN", side: "right" },
      { text: "WRONG TOOL CHANGE", side: "left" }
    ],
    machine: [
      { text: "Z AXIS VARIATION", side: "left" },
      { text: "POOR COOLANT FLOW", side: "right" },
      { text: "TOOL SHAKE", side: "left" }
    ],
    method: [
      { text: "TOOL FACE OUT", side: "left" },
      { text: "JIG/FIX LOOSE", side: "right" },
      { text: "CUTTER MOUNTING LOOSEN", side: "left" }
    ],
    material: [
      { text: "PART HARDNESS PROBLEM", side: "left" }
    ],
    problem: "ABS DISTANCE UNDER SIZE PROBLEM",
  });

  // 4a. Validation Rows
  const [validationRows, setValidationRows] = useState([
    { testSimulation: "WRONG PROGRAM CHANGED", verification: "EXISTING PROGRAM NO VERIFIED WITH SOP FOUND OK", date: getTodayISODate(), significant: "INSIGNIFICANT", remarks: "" },
    { testSimulation: "TOOL FACE OUT", verification: "ABS MILLING CUTTER RUN OUT (0.1MM) FACE OUT NOTIFIED", date: getTodayISODate(), significant: "SIGNIFICANT", remarks: "" },
  ]);

  // 4b. 5-Why
  const [fiveWhy, setFiveWhy] = useState({
    occurrence: {
      why1: "TOOL FACE OUT (ABS MILLING CUTTER)",
      why2: "INSERT SEATING AREA BURR STICKED",
      why3: "WHILE INSERT CHANGE CUTTER POCKET NOT CLEANED PROPERLY",
      why4: "INCHARGE AWARENESS LOW",
      why5: "LACK OF AWARENESS",
      rootCause: "INCHARGE AWARENESS LOW DUE TO LACK OF AWARENESS",
    },
    detection: {
      why1: "THIS PARTICULAR NG PART NOT IDENTIFIED BY INCHARGE AFTER TOOL CHANGE",
      why2: "TOOL CHANGE REPORT NOT FOLLOWED ON TIME",
      why3: "INCHARGE AWARENESS LOW",
      why4: "LACK OF AWARENESS",
      why5: "",
      rootCause: "TOOL CHANGE PROTOCOL NOT ADHERED TO RIGIDLY",
    },
    system: {
      why1: "", why2: "", why3: "", why4: "", why5: "", rootCause: "",
    },
    pfmeaIncluded: "NO",
    pfmeaRpn: "",
  });

  // 5. Solution
  const [solution, setSolution] = useState({
    developingSolution: "",
    trialRun: "",
    trialRunDate: getTodayISODate(),
    trialRunSequence: "",
  });

  // 6. Corrective Actions
  const [correctiveActions, setCorrectiveActions] = useState([
    { type: "Occurrence", action: "EVERY MILLING INSERT CHANGED, INSERT FACE OUT CHECKED IN PRESETTER UNIT SYSTEM INTRODUCED", who: "LINE INCHARGES", dueDate: getTodayISODate(), breakPoint: getTodayISODate(), status: 4 },
    { type: "Detection", action: "AFTER TOOL CHANGE PART QUALIFY MUST BE CHECKED AS PER PROCESS SHEET AND RECORD IN TOOL CHANGE RECORD", who: "LINE INCHARGES", dueDate: getTodayISODate(), breakPoint: getTodayISODate(), status: 4 },
    { type: "System", action: "", who: "", dueDate: "", breakPoint: "", status: 1 },
  ]);

  // 7. Verification Questions
  const [verification, setVerification] = useState({
    q1: "N/A",
    q2: "Y",
    q3: "Y",
    q4: "Y",
    q5: "Y",
    q6: "Y",
    lessonsLearned: "",
    issueResolved: "Yes",
    dateClosed: getTodayISODate(),
    assignedTo: "",
    trackingNo: "",
    effectiveness: [
      { month: "Jun-26", rejQty: "0", rejPct: "0%" },
      { month: "Jul-26", rejQty: "0", rejPct: "0%" },
      { month: "Aug-26", rejQty: "0", rejPct: "0%" },
    ],
    horizontalDeployment: "",
  });

  // 8. Signatures
  const [signatures, setSignatures] = useState({
    shiftSupervisorProduction: "",
    shiftSupervisorQuality: "",
    productionEngineer: "",
    hofProduction: "",
  });

  // Fetch Part Sets from M3PartSets and Approver lists
  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        const token = localStorage.getItem("token");
        const headers = { Authorization: `Bearer ${token}` };

        const partRes = await fetch(`${process.env.REACT_APP_API_URL || ""}/api/8d-report/part-sets`, { headers });
        if (partRes.ok) {
          const pData = await partRes.json();
          setPartSets(pData || []);
        }

        const [qcRes, peRes, hofRes] = await Promise.all([
          fetch(`${process.env.REACT_APP_API_URL || ""}/api/daily-production-report/incharges`, { headers }),
          fetch(`${process.env.REACT_APP_API_URL || ""}/api/daily-production-report/pe-incharges`, { headers }),
          fetch(`${process.env.REACT_APP_API_URL || ""}/api/daily-production-report/hof-incharges`, { headers })
        ]);

        if (qcRes.ok) {
          const data = await qcRes.json();
          setQcUsers(data.qcList || []);
        }
        if (peRes.ok) {
          const data = await peRes.json();
          setPeUsers(data.peList || []);
        }
        if (hofRes.ok) {
          const data = await hofRes.json();
          setHofUsers(data.hofList || []);
        }
      } catch (err) {
        console.error("Master data fetch error:", err);
      } finally {
        setLoadingPartSets(false);
      }
    };
    fetchMasterData();
  }, []);

  const resetFormToBlank = (keepDate, keepShift, keepPartName, keepPartNo) => {
    setIsSavedRecord(false);
    setProblemScope("New");
    setEmergencyActions({
      qualityAlert: false,
      segregationCustomerQty: "",
      segregationCustomerNotOk: "",
      segregationFGQty: "",
      segregationFGNotOk: "",
      segregationWIPQty: "",
      segregationWIPNotOk: "",
      customerVisitRequired: "No",
    });
    setProblemDescription("");
    setTeamMembers(["", "", "", "", "", ""]);
    setInterimActions([{ action: "", who: "", dueDate: getTodayISODate(), breakPoint: getTodayISODate() }]);
    setSolution({ developingSolution: "", trialRun: "", trialRunDate: getTodayISODate(), trialRunSequence: "" });
    setSignatures({ shiftSupervisorProduction: "", shiftSupervisorQuality: "", productionEngineer: "", hofProduction: "" });
    setHeader((prev) => ({
      ...prev,
      date: keepDate || prev.date,
      shift: keepShift || prev.shift,
      partName: keepPartName || prev.partName,
      partNo: keepPartNo || prev.partNo,
      customer: "",
      assignedQc: "",
      assignedPe: "",
      assignedHof: "",
    }));
  };

  const loadRecordData = (record) => {
    if (!record) return;
    setIsSavedRecord(true);
    if (record.header) setHeader((prev) => ({ ...prev, ...record.header }));
    if (record.teamMembers) setTeamMembers(record.teamMembers);
    if (record.problemScope) setProblemScope(record.problemScope);
    if (record.emergencyActions) setEmergencyActions(record.emergencyActions);
    if (record.problemDescription) setProblemDescription(record.problemDescription);
    if (record.processFlow) setProcessFlow(record.processFlow);
    if (record.interimActions) setInterimActions(record.interimActions);
    if (record.fishbone) {
      const normalize = (list = []) =>
        list.map((item, idx) => (typeof item === "string" ? { text: item, side: idx % 2 === 0 ? "left" : "right" } : item));
      setFishbone({
        man: normalize(record.fishbone.man),
        machine: normalize(record.fishbone.machine),
        method: normalize(record.fishbone.method),
        material: normalize(record.fishbone.material),
        problem: record.fishbone.problem || "",
      });
    }
    if (record.validationRows) setValidationRows(record.validationRows);
    if (record.fiveWhy) setFiveWhy(record.fiveWhy);
    if (record.solution) setSolution(record.solution);
    if (record.correctiveActions) setCorrectiveActions(record.correctiveActions);
    if (record.verification) setVerification(record.verification);
    if (record.signatures) {
      setSignatures({
        shiftSupervisorProduction: record.signatures.shiftSupervisorProduction || record.signatures.teamLeader || record.signatures.shiftIncharge || "",
        shiftSupervisorQuality: record.signatures.shiftSupervisorQuality || record.signatures.qualityHead || "",
        productionEngineer: record.signatures.productionEngineer || record.signatures.productionHead || "",
        hofProduction: record.signatures.hofProduction || "",
      });
    }
  };

  // Check Existing Record (Date + Shift + PartNo)
  const checkExistingRecord = async (partNo, date, shift) => {
    if (!partNo || !date) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${process.env.REACT_APP_API_URL || ""}/api/8d-report?machineShop=${shopId || 3}&partNo=${encodeURIComponent(partNo)}&date=${encodeURIComponent(date)}&shift=${encodeURIComponent(shift || "1ST")}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          loadRecordData(data[0]);
          triggerToast("Existing 8D record loaded (Form is locked for editing).", "info");
        } else {
          setIsSavedRecord(false);
        }
      }
    } catch (err) {
      console.error("Failed to check existing 8D report:", err);
    }
  };

  useEffect(() => {
    if (location.state?.record) {
      loadRecordData(location.state.record);
    } else {
      const qPart = searchParams.get("partNo");
      const qDate = searchParams.get("date");
      const qShift = searchParams.get("shift") || "1ST";
      if (qPart && qDate) {
        checkExistingRecord(qPart, qDate, qShift);
      }
    }
  }, [location.state, searchParams]);

  const handlePartChange = (type, value) => {
    let nextPartName = header.partName;
    let nextPartNo = header.partNo;

    if (type === "partName") {
      nextPartName = value;
      const matched = partSets.find((p) => p.PartName === value);
      if (matched) nextPartNo = matched.PartNo;
    } else if (type === "partNo") {
      nextPartNo = value;
      const matched = partSets.find((p) => p.PartNo === value);
      if (matched) nextPartName = matched.PartName;
    }

    setHeader((prev) => ({
      ...prev,
      partName: nextPartName,
      partNo: nextPartNo,
    }));

    if (nextPartNo && header.date) {
      checkExistingRecord(nextPartNo, header.date, header.shift);
    }
  };

  const handleHeaderDateOrShiftChange = (field, val) => {
    const nextHeader = { ...header, [field]: val };
    setHeader(nextHeader);
    if (nextHeader.partNo && nextHeader.date) {
      checkExistingRecord(nextHeader.partNo, nextHeader.date, nextHeader.shift);
    }
  };

  const addFishboneCause = (category, side = "left") => {
    if (isFormLocked) return;
    setFishbone((prev) => ({
      ...prev,
      [category]: [...prev[category], { text: "", side }],
    }));
  };

  const updateFishboneCause = (category, index, val) => {
    if (isFormLocked) return;
    setFishbone((prev) => {
      const updated = [...prev[category]];
      updated[index] = { ...updated[index], text: val };
      return { ...prev, [category]: updated };
    });
  };

  const toggleFishboneCauseSide = (category, index) => {
    if (isFormLocked) return;
    setFishbone((prev) => {
      const updated = [...prev[category]];
      const currentSide = updated[index]?.side || "left";
      updated[index] = { ...updated[index], side: currentSide === "left" ? "right" : "left" };
      return { ...prev, [category]: updated };
    });
  };

  const removeFishboneCause = (category, index) => {
    if (isFormLocked) return;
    setFishbone((prev) => {
      const updated = prev[category].filter((_, i) => i !== index);
      return { ...prev, [category]: updated };
    });
  };

  const handleApproveSupervisorProduction = () => {
    setSignatures((prev) => ({
      ...prev,
      shiftSupervisorProduction: currentUsername || "Approved",
    }));
    triggerToast("Production supervisor approved successfully.", "success");
  };

  const handleApproveQc = () => {
    if (!isQC) {
      triggerToast("Only QC can verify this record.", "error");
      return;
    }
    if (header.assignedQc && header.assignedQc.toLowerCase() !== currentUsername.toLowerCase()) {
      triggerToast(`Assigned to QC: ${header.assignedQc.toUpperCase()}`, "error");
      return;
    }
    setSignatures((prev) => ({
      ...prev,
      shiftSupervisorQuality: currentUsername,
    }));
    triggerToast("QC Verification Approved!", "success");
  };

  const handleApprovePe = () => {
    if (!isPE) {
      triggerToast("Only Production Engineer can approve this record.", "error");
      return;
    }
    if (header.assignedPe && header.assignedPe.toLowerCase() !== currentUsername.toLowerCase()) {
      triggerToast(`Assigned to PE: ${header.assignedPe.toUpperCase()}`, "error");
      return;
    }
    setSignatures((prev) => ({
      ...prev,
      productionEngineer: currentUsername,
    }));
    triggerToast("Production Engineer Approved!", "success");
  };

  const handleApproveHof = () => {
    if (!isHOF) {
      triggerToast("Only HOF can approve this record.", "error");
      return;
    }
    if (header.assignedHof && header.assignedHof.toLowerCase() !== currentUsername.toLowerCase()) {
      triggerToast(`Assigned to HOF: ${header.assignedHof.toUpperCase()}`, "error");
      return;
    }
    setSignatures((prev) => ({
      ...prev,
      hofProduction: currentUsername,
    }));
    triggerToast("HOF Production Approved!", "success");
  };

  const handleDownloadPdf = async () => {
    if (!header.partNo || !header.date) {
      triggerToast("Please select Date, Shift, and Part No. first to preview PDF.", "error");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const params = new URLSearchParams({
        shopId: String(shopId || 3),
        date: header.date,
        shift: header.shift,
        partNo: header.partNo,
        customer: header.customer || "",
      });

      const res = await fetch(
        `${process.env.REACT_APP_API_URL || ""}/api/8d-report/pdf?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "Failed to generate PDF");
      }

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `8D_Report_${header.partNo.replace(/[\/\\?%*:|"<>]/g, '_')}_${header.date}_${header.shift}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      triggerToast("Single-page PDF preview ready!", "success");
    } catch (err) {
      triggerToast(err.message || "PDF Download Failed", "error");
    }
  };

  const handleSave = async () => {
    if (!header.partNo || !header.partName) {
      triggerToast("Please select Part Name and Part No.", "error");
      return;
    }

    if (isShiftIncharge && !isSavedRecord) {
      if (!signatures.shiftSupervisorProduction) {
        triggerToast("Please click 'Approve' under SHIFT SUPERVISOR (PRODUCTION) before submitting.", "error");
        return;
      }
      if (!header.assignedQc) {
        triggerToast("Please select a QC in 'SHIFT SUPERVISOR (QUALITY)'.", "error");
        return;
      }
      if (!header.assignedPe) {
        triggerToast("Please select a PE in 'PRODUCTION ENGINEER'.", "error");
        return;
      }
      if (!header.assignedHof) {
        triggerToast("Please select a HOF in 'HOF - PRODUCTION'.", "error");
        return;
      }
    }

    const token = localStorage.getItem("token");
    if (!token) {
      triggerToast("Authentication token missing. Please log in again.", "error");
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);

    const payload = {
      header: { ...header, machineShop: shopId || "3" },
      teamMembers,
      problemScope,
      emergencyActions,
      problemDescription,
      processFlow,
      interimActions,
      fishbone,
      validationRows,
      fiveWhy,
      solution,
      correctiveActions,
      verification,
      signatures: {
        shiftSupervisorProduction: signatures.shiftSupervisorProduction || currentUsername,
        shiftSupervisorQuality: isQC ? currentUsername : signatures.shiftSupervisorQuality || "Pending",
        productionEngineer: isPE ? currentUsername : signatures.productionEngineer || "Pending",
        hofProduction: isHOF ? currentUsername : signatures.hofProduction || "Pending",
        teamLeader: signatures.shiftSupervisorProduction || currentUsername,
        productionHead: signatures.productionEngineer || "Pending",
        qualityHead: signatures.shiftSupervisorQuality || "Pending",
      },
    };

    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL || ""}/api/8d-report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Save operation failed");

      setIsSaving(false);
      setSaveSuccess(true);
      setIsSavedRecord(true);
      triggerToast("8D Problem Solving Report saved successfully!", "success");

      setTimeout(() => {
        navigate(
          isQC
            ? `/qc/${shopId || 3}`
            : isPE
            ? `/production-engineer/${shopId || 3}`
            : isHOF
            ? `/hof/${shopId || 3}`
            : `/shift-incharge/${shopId || 3}`
        );
      }, 1200);
    } catch (err) {
      setIsSaving(false);
      triggerToast(err.message || "Failed to save record", "error");
    }
  };

  const isSupervisorProductionApproved = Boolean(
    signatures.shiftSupervisorProduction &&
      signatures.shiftSupervisorProduction !== "Pending" &&
      signatures.shiftSupervisorProduction !== ""
  );

  const isQcApproved = Boolean(
    signatures.shiftSupervisorQuality &&
      signatures.shiftSupervisorQuality !== "Pending" &&
      signatures.shiftSupervisorQuality !== ""
  );

  const isPeApproved = Boolean(
    signatures.productionEngineer &&
      signatures.productionEngineer !== "Pending" &&
      signatures.productionEngineer !== ""
  );

  const isHofApproved = Boolean(
    signatures.hofProduction &&
      signatures.hofProduction !== "Pending" &&
      signatures.hofProduction !== ""
  );

  return (
    <div className="min-h-screen bg-[#2d2d2d] flex flex-col items-center justify-center p-4 md:p-6 pb-20">
      <Header />
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: "", type: "" })} />

      {(isSaving || saveSuccess) && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl px-10 py-8 text-center">
            {isSaving ? (
              <>
                <div className="w-10 h-10 border-4 border-gray-300 border-t-orange-500 rounded-full animate-spin mx-auto mb-5"></div>
                <h2 className="text-xl font-bold text-gray-800">Saving Data...</h2>
                <p className="text-gray-500 mt-2">
                  {isShiftIncharge
                    ? "Submitting for QC, PE & HOF Verification"
                    : isQC
                    ? "Completing QC Verification"
                    : isPE
                    ? "Completing PE Verification"
                    : "Completing HOF Approval"}
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

      <div className="bg-white w-full max-w-[98rem] rounded-xl p-6 md:p-8 shadow-2xl border-4 border-gray-100 space-y-6">
        
        {/* TOP HEADER */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-200 pb-4 gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="p-1 text-gray-600 hover:text-orange-600 hover:bg-gray-100 rounded-full transition-colors"
                title="Back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <span className="text-xs font-bold text-orange-600 tracking-wider uppercase">
                {formMeta.company}
              </span>
              {isSavedRecord && (
                <span className="text-[10px] bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded uppercase">
                  Locked (Existing Record)
                </span>
              )}
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-gray-800 uppercase tracking-wide">
              {formMeta.title}
            </h2>
            <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-2">
              <span>Form Code: {formMeta.formCode}</span>
              <span>|</span>
              <span>Revision: {formMeta.revision} ({formMeta.revisionDate})</span>
              <span>|</span>
              <span className="font-bold text-orange-600">Shop ID: {shopId || 3}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDownloadPdf}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider shadow transition-colors"
          >
            <FileDown className="w-4 h-4" /> Preview PDF (1-Page)
          </button>
        </div>

        {/* METADATA GRID */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-orange-50 border border-orange-200 p-4 rounded-lg text-xs">
          <div className="space-y-2">
            <div>
              <label className="font-bold text-gray-700 block mb-1">Date & Shift</label>
              <div className="flex gap-2">
                <input
                  type="date"
                  className="w-1/2 border border-gray-300 p-1.5 rounded font-semibold bg-white"
                  value={header.date}
                  onChange={(e) => handleHeaderDateOrShiftChange("date", e.target.value)}
                />
                <select
                  className="w-1/2 border border-gray-300 p-1.5 rounded font-semibold bg-white"
                  value={header.shift}
                  onChange={(e) => handleHeaderDateOrShiftChange("shift", e.target.value)}
                >
                  <option value="1ST">1ST SHIFT</option>
                  <option value="2ND">2ND SHIFT</option>
                  <option value="3RD">3RD SHIFT</option>
                </select>
              </div>
            </div>

            <div>
              <label className="font-bold text-gray-700 block mb-1">Customer</label>
              <input
                type="text"
                disabled={isFormLocked}
                className="w-full border border-gray-300 p-1.5 rounded font-semibold bg-white disabled:bg-gray-100 disabled:text-gray-700"
                placeholder="e.g. STELLANTIS"
                value={header.customer}
                onChange={(e) => setHeader({ ...header, customer: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div>
              <label className="font-bold text-gray-700 block mb-1">Part Name</label>
              <select
                disabled={loadingPartSets}
                className="w-full border border-gray-300 p-1.5 rounded font-semibold bg-white cursor-pointer disabled:bg-gray-100 text-xs"
                value={header.partName}
                onChange={(e) => handlePartChange("partName", e.target.value)}
              >
                <option value="">{loadingPartSets ? "Loading Part Names..." : "-- Select Part Name --"}</option>
                {partSets.map((ps, idx) => (
                  <option key={`pname-${ps.Id || idx}`} value={ps.PartName}>
                    {ps.PartName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-bold text-gray-700 block mb-1">Part No.</label>
              <select
                disabled={loadingPartSets}
                className="w-full border border-gray-300 p-1.5 rounded font-semibold bg-white cursor-pointer disabled:bg-gray-100 text-xs"
                value={header.partNo}
                onChange={(e) => handlePartChange("partNo", e.target.value)}
              >
                <option value="">{loadingPartSets ? "Loading Part Numbers..." : "-- Select Part No --"}</option>
                {partSets.map((ps, idx) => (
                  <option key={`pno-${ps.Id || idx}`} value={ps.PartNo}>
                    {ps.PartNo}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <div>
              <label className="font-bold text-gray-700 block mb-1">Category</label>
              <div className="grid grid-cols-3 gap-1 text-center font-bold">
                {["Safety", "Quality", "Delivery", "People", "Cost", "Other"].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    disabled={isFormLocked}
                    onClick={() => setHeader({ ...header, category: cat })}
                    className={`py-1 px-2 border rounded ${
                      header.category === cat
                        ? "bg-orange-600 text-white border-orange-600"
                        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
                    } disabled:opacity-80 disabled:cursor-not-allowed`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="font-bold text-gray-700 block mb-1">Problem Found By</label>
              <div className="flex gap-2 items-center flex-wrap">
                {["Verification Station", "Maintenance", "Production", "Customer"].map((p) => (
                  <label key={p} className={`flex items-center gap-1 font-semibold ${isFormLocked ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}>
                    <input
                      type="radio"
                      disabled={isFormLocked}
                      name="problemFoundBy"
                      checked={header.problemFoundBy === p}
                      onChange={() => setHeader({ ...header, problemFoundBy: p })}
                    />
                    {p}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* (1) TEAM MEMBERS */}
        <div className="border border-gray-300 p-4 rounded-lg bg-gray-50">
          <h3 className="text-xs font-bold uppercase text-gray-800 mb-2 tracking-wide">(1) Team Members:</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            {teamMembers.map((member, idx) => (
              <input
                key={`member-${idx}`}
                type="text"
                disabled={isFormLocked}
                placeholder={`Member ${idx + 1}`}
                className="border border-gray-300 p-1.5 rounded text-xs font-medium bg-white disabled:bg-gray-100 disabled:text-gray-700"
                value={member}
                onChange={(e) => {
                  const updated = [...teamMembers];
                  updated[idx] = e.target.value;
                  setTeamMembers(updated);
                }}
              />
            ))}
          </div>
        </div>

        {/* (2) PROBLEM SCOPE & (2b) PROCESS FLOW */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="border border-gray-300 p-4 rounded-lg space-y-3 bg-gray-50">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-xs font-bold uppercase text-gray-800">(2) Problem Scope:</h3>
              <div className="flex gap-4 text-xs font-semibold">
                {["New", "Repeated", "Reopened"].map((sc) => (
                  <label key={sc} className={`flex items-center gap-1 ${isFormLocked ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}>
                    <input
                      type="radio"
                      disabled={isFormLocked}
                      name="problemScope"
                      checked={problemScope === sc}
                      onChange={() => setProblemScope(sc)}
                    />
                    {sc}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <span className="text-xs font-bold text-gray-700 block mb-1">Emergency Response Action:</span>
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  id="qualityAlert"
                  disabled={isFormLocked}
                  checked={emergencyActions.qualityAlert}
                  onChange={(e) => setEmergencyActions({ ...emergencyActions, qualityAlert: e.target.checked })}
                />
                <label htmlFor="qualityAlert" className="text-xs font-semibold text-gray-700 cursor-pointer">
                  Quality Alert Issued
                </label>
              </div>

              {/* Segregation Table */}
              <table className="w-full text-xs border border-gray-300 text-center mb-2">
                <thead className="bg-gray-200 font-bold">
                  <tr>
                    <th className="border p-1">Segregation</th>
                    <th className="border p-1">Quantity</th>
                    <th className="border p-1">Not OK</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border p-1 font-semibold text-left">Customer</td>
                    <td className="border p-0">
                      <input
                        type="text"
                        disabled={isFormLocked}
                        className="w-full text-center p-1 bg-white outline-none disabled:bg-gray-100 disabled:text-gray-700"
                        value={emergencyActions.segregationCustomerQty}
                        onChange={(e) => setEmergencyActions({ ...emergencyActions, segregationCustomerQty: e.target.value })}
                      />
                    </td>
                    <td className="border p-0">
                      <input
                        type="text"
                        disabled={isFormLocked}
                        className="w-full text-center p-1 bg-white outline-none disabled:bg-gray-100 disabled:text-gray-700"
                        value={emergencyActions.segregationCustomerNotOk}
                        onChange={(e) => setEmergencyActions({ ...emergencyActions, segregationCustomerNotOk: e.target.value })}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="border p-1 font-semibold text-left">FG</td>
                    <td className="border p-0">
                      <input
                        type="text"
                        disabled={isFormLocked}
                        className="w-full text-center p-1 bg-white outline-none disabled:bg-gray-100 disabled:text-gray-700"
                        value={emergencyActions.segregationFGQty}
                        onChange={(e) => setEmergencyActions({ ...emergencyActions, segregationFGQty: e.target.value })}
                      />
                    </td>
                    <td className="border p-0">
                      <input
                        type="text"
                        disabled={isFormLocked}
                        className="w-full text-center p-1 bg-white outline-none disabled:bg-gray-100 disabled:text-gray-700"
                        value={emergencyActions.segregationFGNotOk}
                        onChange={(e) => setEmergencyActions({ ...emergencyActions, segregationFGNotOk: e.target.value })}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="border p-1 font-semibold text-left">WIP / Line</td>
                    <td className="border p-0">
                      <input
                        type="text"
                        disabled={isFormLocked}
                        className="w-full text-center p-1 bg-white outline-none disabled:bg-gray-100 disabled:text-gray-700"
                        value={emergencyActions.segregationWIPQty}
                        onChange={(e) => setEmergencyActions({ ...emergencyActions, segregationWIPQty: e.target.value })}
                      />
                    </td>
                    <td className="border p-0">
                      <input
                        type="text"
                        disabled={isFormLocked}
                        className="w-full text-center p-1 bg-white outline-none disabled:bg-gray-100 disabled:text-gray-700"
                        value={emergencyActions.segregationWIPNotOk}
                        onChange={(e) => setEmergencyActions({ ...emergencyActions, segregationWIPNotOk: e.target.value })}
                      />
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="flex items-center gap-4 text-xs font-semibold">
                <span>Is Customer visit required?</span>
                <label className={`flex items-center gap-1 ${isFormLocked ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}>
                  <input
                    type="radio"
                    disabled={isFormLocked}
                    name="visit"
                    checked={emergencyActions.customerVisitRequired === "Yes"}
                    onChange={() => setEmergencyActions({ ...emergencyActions, customerVisitRequired: "Yes" })}
                  />
                  Yes
                </label>
                <label className={`flex items-center gap-1 ${isFormLocked ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}>
                  <input
                    type="radio"
                    disabled={isFormLocked}
                    name="visit"
                    checked={emergencyActions.customerVisitRequired === "No"}
                    onChange={() => setEmergencyActions({ ...emergencyActions, customerVisitRequired: "No" })}
                  />
                  No
                </label>
              </div>
            </div>

            <div className="pt-2 border-t">
              <h3 className="text-xs font-bold uppercase text-gray-800 mb-1">(2a) Problem Description:</h3>
              <textarea
                rows={3}
                disabled={isFormLocked}
                className="w-full border border-gray-300 p-2 rounded text-xs bg-white font-medium outline-none focus:ring-1 focus:ring-orange-500 disabled:bg-gray-100 disabled:text-gray-700"
                placeholder="Describe the problem in detail..."
                value={problemDescription}
                onChange={(e) => setProblemDescription(e.target.value)}
              />
            </div>
          </div>

          {/* (2b) Process Flow */}
          <div className="border border-gray-300 p-4 rounded-lg bg-gray-50 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-xs font-bold uppercase text-gray-800">(2b) Sketch / Process Flow:</h3>
                {!isFormLocked && (
                  <button
                    type="button"
                    onClick={() => setProcessFlow([...processFlow, "NEW OP"])}
                    className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Step
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 p-3 bg-white border border-gray-200 rounded min-h-[140px]">
                {processFlow.map((step, sIdx) => (
                  <React.Fragment key={`step-${sIdx}`}>
                    <div className="relative group border-2 border-gray-800 rounded px-2 py-1 text-[11px] font-bold text-center bg-gray-50 min-w-[90px] max-w-[140px]">
                      <input
                        type="text"
                        disabled={isFormLocked}
                        value={step}
                        onChange={(e) => {
                          const updated = [...processFlow];
                          updated[sIdx] = e.target.value;
                          setProcessFlow(updated);
                        }}
                        className="w-full bg-transparent text-center outline-none text-[10px] font-bold uppercase disabled:text-gray-700"
                      />
                      {!isFormLocked && processFlow.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setProcessFlow(processFlow.filter((_, i) => i !== sIdx))}
                          className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-4 h-4 text-[10px] hidden group-hover:flex items-center justify-center shadow"
                        >
                          ×
                        </button>
                      )}
                    </div>
                    {sIdx < processFlow.length - 1 && (
                      <span className="text-gray-500 font-bold">→</span>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
            <span className="text-[10px] text-gray-400 italic mt-2">
              * Process step sequence. Arrows indicate flow direction.
            </span>
          </div>
        </div>

        {/* (3) INTERIM CONTAINMENT ACTION */}
        <div className="border border-gray-300 p-4 rounded-lg bg-gray-50">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-xs font-bold uppercase text-gray-800">(3) Interim containment action:</h3>
            {!isFormLocked && (
              <button
                type="button"
                onClick={() => setInterimActions([...interimActions, { action: "", who: "", dueDate: getTodayISODate(), breakPoint: getTodayISODate() }])}
                className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Row
              </button>
            )}
          </div>

          <table className="w-full text-xs border border-gray-300 text-center">
            <thead className="bg-gray-200 font-bold">
              <tr>
                <th className="border p-2 w-[50%]">Action Description</th>
                <th className="border p-2 w-[20%]">Who</th>
                <th className="border p-2 w-[15%]">Due Date</th>
                <th className="border p-2 w-[15%]">Break Point</th>
                {!isFormLocked && <th className="border p-2 w-[5%]">Del</th>}
              </tr>
            </thead>
            <tbody>
              {interimActions.map((row, idx) => (
                <tr key={`interim-${idx}`} className="bg-white">
                  <td className="border p-1 text-left">
                    <input
                      type="text"
                      disabled={isFormLocked}
                      className="w-full outline-none font-medium text-xs px-1 disabled:bg-gray-100 disabled:text-gray-700"
                      value={row.action}
                      onChange={(e) => {
                        const updated = [...interimActions];
                        updated[idx].action = e.target.value;
                        setInterimActions(updated);
                      }}
                    />
                  </td>
                  <td className="border p-1">
                    <input
                      type="text"
                      disabled={isFormLocked}
                      className="w-full text-center outline-none font-medium text-xs disabled:bg-gray-100 disabled:text-gray-700"
                      value={row.who}
                      onChange={(e) => {
                        const updated = [...interimActions];
                        updated[idx].who = e.target.value;
                        setInterimActions(updated);
                      }}
                    />
                  </td>
                  <td className="border p-1">
                    <input
                      type="date"
                      disabled={isFormLocked}
                      className="w-full text-center outline-none font-medium text-xs bg-transparent disabled:bg-gray-100 disabled:text-gray-700"
                      value={row.dueDate}
                      onChange={(e) => {
                        const updated = [...interimActions];
                        updated[idx].dueDate = e.target.value;
                        setInterimActions(updated);
                      }}
                    />
                  </td>
                  <td className="border p-1">
                    <input
                      type="date"
                      disabled={isFormLocked}
                      className="w-full text-center outline-none font-medium text-xs bg-transparent disabled:bg-gray-100 disabled:text-gray-700"
                      value={row.breakPoint}
                      onChange={(e) => {
                        const updated = [...interimActions];
                        updated[idx].breakPoint = e.target.value;
                        setInterimActions(updated);
                      }}
                    />
                  </td>
                  {!isFormLocked && (
                    <td className="border p-1">
                      <button
                        type="button"
                        onClick={() => setInterimActions(interimActions.filter((_, i) => i !== idx))}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-3.5 h-3.5 mx-auto" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* (4) ROOT CAUSE ANALYSIS - ISHIKAWA CAUSE & EFFECT */}
        <div className="border border-gray-300 p-4 rounded-lg bg-gray-50 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold uppercase text-gray-800">
              (4) Root cause analysis - Cause & Effect Diagram (4M with Bi-directional Arrows):
            </h3>
            <span className="text-[11px] text-gray-500 italic">
              * Arrow chip (← / →) toggles direction toward the central bone.
            </span>
          </div>

          <div className="w-full bg-white border-2 border-gray-800 rounded-lg p-4 overflow-x-auto min-h-[380px] flex items-center justify-center">
            <svg viewBox="0 0 920 380" className="w-full max-w-[880px] h-auto select-none">
              <defs>
                <marker id="arrow-spine" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#1f2937" />
                </marker>
                <marker id="arrow-left" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#4b5563" />
                </marker>
                <marker id="arrow-right" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                  <path d="M 10 0 L 0 5 L 10 10 z" fill="#4b5563" />
                </marker>
              </defs>

              <line x1="40" y1="190" x2="710" y2="190" stroke="#1f2937" strokeWidth="3.5" markerEnd="url(#arrow-spine)" />

              {/* MAN */}
              <line x1="160" y1="50" x2="270" y2="190" stroke="#1f2937" strokeWidth="2.5" />
              <text x="140" y="42" fontWeight="bold" fontSize="13" fill="#1f2937">MAN</text>
              {fishbone.man.map((cObj, i) => {
                const text = typeof cObj === "string" ? cObj : cObj.text;
                const side = typeof cObj === "string" ? "left" : cObj.side;
                const boneX = 180 + i * 28;
                const boneY = 80 + i * 28;
                const isLeft = side === "left";
                const startX = isLeft ? boneX - 95 : boneX + 95;

                return (
                  <g key={`man-${i}`}>
                    <line
                      x1={startX}
                      y1={boneY}
                      x2={boneX}
                      y2={boneY}
                      stroke="#4b5563"
                      strokeWidth="1.5"
                      markerEnd={isLeft ? "url(#arrow-left)" : "url(#arrow-right)"}
                    />
                    <text
                      x={isLeft ? startX - 6 : startX + 6}
                      y={boneY - 2}
                      textAnchor={isLeft ? "end" : "start"}
                      fontSize="9"
                      fontWeight="bold"
                      fill="#374151"
                    >
                      {text || "..."}
                    </text>
                  </g>
                );
              })}

              {/* MACHINE */}
              <line x1="410" y1="50" x2="520" y2="190" stroke="#1f2937" strokeWidth="2.5" />
              <text x="390" y="42" fontWeight="bold" fontSize="13" fill="#1f2937">MACHINE</text>
              {fishbone.machine.map((cObj, i) => {
                const text = typeof cObj === "string" ? cObj : cObj.text;
                const side = typeof cObj === "string" ? "left" : cObj.side;
                const boneX = 430 + i * 28;
                const boneY = 80 + i * 28;
                const isLeft = side === "left";
                const startX = isLeft ? boneX - 95 : boneX + 95;

                return (
                  <g key={`mach-${i}`}>
                    <line
                      x1={startX}
                      y1={boneY}
                      x2={boneX}
                      y2={boneY}
                      stroke="#4b5563"
                      strokeWidth="1.5"
                      markerEnd={isLeft ? "url(#arrow-left)" : "url(#arrow-right)"}
                    />
                    <text
                      x={isLeft ? startX - 6 : startX + 6}
                      y={boneY - 2}
                      textAnchor={isLeft ? "end" : "start"}
                      fontSize="9"
                      fontWeight="bold"
                      fill="#374151"
                    >
                      {text || "..."}
                    </text>
                  </g>
                );
              })}

              {/* METHOD */}
              <line x1="160" y1="330" x2="270" y2="190" stroke="#1f2937" strokeWidth="2.5" />
              <text x="135" y="348" fontWeight="bold" fontSize="13" fill="#1f2937">METHOD</text>
              {fishbone.method.map((cObj, i) => {
                const text = typeof cObj === "string" ? cObj : cObj.text;
                const side = typeof cObj === "string" ? "left" : cObj.side;
                const boneX = 180 + i * 28;
                const boneY = 300 - i * 28;
                const isLeft = side === "left";
                const startX = isLeft ? boneX - 95 : boneX + 95;

                return (
                  <g key={`meth-${i}`}>
                    <line
                      x1={startX}
                      y1={boneY}
                      x2={boneX}
                      y2={boneY}
                      stroke="#4b5563"
                      strokeWidth="1.5"
                      markerEnd={isLeft ? "url(#arrow-left)" : "url(#arrow-right)"}
                    />
                    <text
                      x={isLeft ? startX - 6 : startX + 6}
                      y={boneY - 2}
                      textAnchor={isLeft ? "end" : "start"}
                      fontSize="9"
                      fontWeight="bold"
                      fill="#374151"
                    >
                      {text || "..."}
                    </text>
                  </g>
                );
              })}

              {/* MATERIAL */}
              <line x1="410" y1="330" x2="520" y2="190" stroke="#1f2937" strokeWidth="2.5" />
              <text x="385" y="348" fontWeight="bold" fontSize="13" fill="#1f2937">MATERIAL</text>
              {fishbone.material.map((cObj, i) => {
                const text = typeof cObj === "string" ? cObj : cObj.text;
                const side = typeof cObj === "string" ? "left" : cObj.side;
                const boneX = 430 + i * 28;
                const boneY = 300 - i * 28;
                const isLeft = side === "left";
                const startX = isLeft ? boneX - 95 : boneX + 95;

                return (
                  <g key={`mat-${i}`}>
                    <line
                      x1={startX}
                      y1={boneY}
                      x2={boneX}
                      y2={boneY}
                      stroke="#4b5563"
                      strokeWidth="1.5"
                      markerEnd={isLeft ? "url(#arrow-left)" : "url(#arrow-right)"}
                    />
                    <text
                      x={isLeft ? startX - 6 : startX + 6}
                      y={boneY - 2}
                      textAnchor={isLeft ? "end" : "start"}
                      fontSize="9"
                      fontWeight="bold"
                      fill="#374151"
                    >
                      {text || "..."}
                    </text>
                  </g>
                );
              })}

              {/* Problem Head */}
              <circle cx="780" cy="190" r="58" stroke="#1f2937" strokeWidth="2.5" fill="#f9fafb" />
              <text x="780" y="125" textAnchor="middle" fontWeight="bold" fontSize="11" fill="#1f2937">PROBLEM</text>
              <foreignObject x="730" y="152" width="100" height="75">
                <div xmlns="http://www.w3.org/1999/xhtml" className="text-[10px] font-bold text-center text-gray-800 leading-tight">
                  {fishbone.problem}
                </div>
              </foreignObject>
            </svg>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            {["man", "machine", "method", "material"].map((cat) => (
              <div key={cat} className="border border-gray-300 p-2.5 rounded bg-white space-y-1.5">
                <div className="flex justify-between items-center border-b pb-1">
                  <span className="font-bold uppercase text-gray-700">{cat} Causes</span>
                  {!isFormLocked && (
                    <button
                      type="button"
                      onClick={() => addFishboneCause(cat)}
                      className="text-orange-600 font-bold hover:text-orange-700 text-[11px]"
                    >
                      + Add
                    </button>
                  )}
                </div>
                {fishbone[cat].map((causeObj, cIdx) => {
                  const text = typeof causeObj === "string" ? causeObj : causeObj.text;
                  const side = typeof causeObj === "string" ? "left" : causeObj.side;
                  return (
                    <div key={`${cat}-${cIdx}`} className="flex gap-1 items-center">
                      <input
                        type="text"
                        disabled={isFormLocked}
                        className="border border-gray-200 p-1 rounded w-full text-[11px] font-medium disabled:bg-gray-100 disabled:text-gray-700"
                        value={text}
                        placeholder={`Enter ${cat} cause`}
                        onChange={(e) => updateFishboneCause(cat, cIdx, e.target.value)}
                      />
                      {!isFormLocked && (
                        <>
                          <button
                            type="button"
                            onClick={() => toggleFishboneCauseSide(cat, cIdx)}
                            title="Toggle branch arrow orientation"
                            className="text-xs bg-gray-100 hover:bg-gray-200 px-1 py-0.5 rounded font-mono font-bold text-gray-700"
                          >
                            {side === "left" ? "←" : "→"}
                          </button>
                          <button
                            type="button"
                            onClick={() => removeFishboneCause(cat, cIdx)}
                            className="text-red-500 hover:text-red-700 text-xs px-1"
                          >
                            ×
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* (4a) VALIDATION OF POTENTIAL CAUSES */}
        <div className="border border-gray-300 p-4 rounded-lg bg-gray-50">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-xs font-bold uppercase text-gray-800">(4a) Validation of Potential Causes:</h3>
            {!isFormLocked && (
              <button
                type="button"
                onClick={() => setValidationRows([...validationRows, { testSimulation: "", verification: "", date: getTodayISODate(), significant: "INSIGNIFICANT", remarks: "" }])}
                className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Row
              </button>
            )}
          </div>

          <table className="w-full text-xs border border-gray-300 text-center">
            <thead className="bg-gray-200 font-bold">
              <tr>
                <th className="border p-2 w-[25%]">Test / Simulation</th>
                <th className="border p-2 w-[40%]">Verification of Possible causes</th>
                <th className="border p-2 w-[12%]">Date</th>
                <th className="border p-2 w-[13%]">Significant</th>
                <th className="border p-2 w-[10%]">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {validationRows.map((row, idx) => (
                <tr key={`val-${idx}`} className="bg-white">
                  <td className="border p-1">
                    <input
                      type="text"
                      disabled={isFormLocked}
                      className="w-full font-semibold text-xs outline-none disabled:bg-gray-100 disabled:text-gray-700"
                      value={row.testSimulation}
                      onChange={(e) => {
                        const updated = [...validationRows];
                        updated[idx].testSimulation = e.target.value;
                        setValidationRows(updated);
                      }}
                    />
                  </td>
                  <td className="border p-1">
                    <input
                      type="text"
                      disabled={isFormLocked}
                      className="w-full font-medium text-xs outline-none disabled:bg-gray-100 disabled:text-gray-700"
                      value={row.verification}
                      onChange={(e) => {
                        const updated = [...validationRows];
                        updated[idx].verification = e.target.value;
                        setValidationRows(updated);
                      }}
                    />
                  </td>
                  <td className="border p-1">
                    <input
                      type="date"
                      disabled={isFormLocked}
                      className="w-full text-center font-medium text-xs outline-none bg-transparent disabled:bg-gray-100 disabled:text-gray-700"
                      value={row.date}
                      onChange={(e) => {
                        const updated = [...validationRows];
                        updated[idx].date = e.target.value;
                        setValidationRows(updated);
                      }}
                    />
                  </td>
                  <td className="border p-1">
                    <select
                      disabled={isFormLocked}
                      className={`w-full text-center font-bold text-xs p-0.5 rounded disabled:bg-gray-100 ${
                        row.significant === "SIGNIFICANT" ? "text-red-600 bg-red-50" : "text-gray-700"
                      }`}
                      value={row.significant}
                      onChange={(e) => {
                        const updated = [...validationRows];
                        updated[idx].significant = e.target.value;
                        setValidationRows(updated);
                      }}
                    >
                      <option value="INSIGNIFICANT">INSIGNIFICANT</option>
                      <option value="SIGNIFICANT">SIGNIFICANT</option>
                    </select>
                  </td>
                  <td className="border p-1">
                    <input
                      type="text"
                      disabled={isFormLocked}
                      className="w-full font-medium text-xs outline-none disabled:bg-gray-100 disabled:text-gray-700"
                      value={row.remarks}
                      onChange={(e) => {
                        const updated = [...validationRows];
                        updated[idx].remarks = e.target.value;
                        setValidationRows(updated);
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* (4b) 5-WHY ROOT CAUSE ANALYSIS */}
        <div className="border border-gray-300 p-4 rounded-lg bg-gray-50 space-y-3">
          <h3 className="text-xs font-bold uppercase text-gray-800">
            (4b) Root Cause Analysis (5-Why Analysis):
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-xs border border-gray-300 text-center min-w-[900px]">
              <thead className="bg-gray-200 font-bold">
                <tr>
                  <th className="border p-2 w-[10%]">Analysis</th>
                  <th className="border p-2 w-[18%]">Why-1</th>
                  <th className="border p-2 w-[18%]">Why-2</th>
                  <th className="border p-2 w-[18%]">Why-3</th>
                  <th className="border p-2 w-[18%]">Why-4</th>
                  <th className="border p-2 w-[18%]">Why-5</th>
                </tr>
              </thead>
              <tbody>
                {["occurrence", "detection", "system"].map((type) => (
                  <React.Fragment key={type}>
                    <tr className="bg-white">
                      <td className="border p-2 font-bold uppercase bg-gray-100">{type}</td>
                      {[1, 2, 3, 4, 5].map((w) => (
                        <td key={`${type}-w${w}`} className="border p-1">
                          <textarea
                            rows={2}
                            disabled={isFormLocked}
                            className="w-full text-xs font-medium p-1 outline-none resize-none bg-transparent disabled:bg-gray-100 disabled:text-gray-700"
                            value={fiveWhy[type][`why${w}`] || ""}
                            onChange={(e) =>
                              setFiveWhy({
                                ...fiveWhy,
                                [type]: { ...fiveWhy[type], [`why${w}`]: e.target.value },
                              })
                            }
                          />
                        </td>
                      ))}
                    </tr>
                    <tr className="bg-orange-50/50">
                      <td colSpan={6} className="border p-1.5 text-left font-semibold text-gray-700">
                        <span className="font-bold text-orange-800 uppercase mr-2">Root cause ({type}):</span>
                        <input
                          type="text"
                          disabled={isFormLocked}
                          className="w-[80%] bg-transparent border-b border-orange-300 font-bold text-xs text-gray-800 outline-none disabled:bg-gray-100 disabled:text-gray-700"
                          placeholder={`Definitive root cause for ${type}...`}
                          value={fiveWhy[type].rootCause || ""}
                          onChange={(e) =>
                            setFiveWhy({
                              ...fiveWhy,
                              [type]: { ...fiveWhy[type], rootCause: e.target.value },
                            })
                          }
                        />
                      </td>
                    </tr>
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-6 pt-2 text-xs font-bold text-gray-800">
            <span>PREDICT: Was this failure mode included in the PFMEA?</span>
            <label className={`flex items-center gap-1 ${isFormLocked ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}>
              <input
                type="radio"
                disabled={isFormLocked}
                name="pfmea"
                checked={fiveWhy.pfmeaIncluded === "YES"}
                onChange={() => setFiveWhy({ ...fiveWhy, pfmeaIncluded: "YES" })}
              />
              YES
            </label>
            <label className={`flex items-center gap-1 ${isFormLocked ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}>
              <input
                type="radio"
                disabled={isFormLocked}
                name="pfmea"
                checked={fiveWhy.pfmeaIncluded === "NO"}
                onChange={() => setFiveWhy({ ...fiveWhy, pfmeaIncluded: "NO" })}
              />
              NO
            </label>
            {fiveWhy.pfmeaIncluded === "YES" && (
              <div className="flex items-center gap-2">
                <span>If &quot;Yes&quot;, What was the RPN #:</span>
                <input
                  type="text"
                  disabled={isFormLocked}
                  className="border border-gray-300 p-1 rounded text-xs font-semibold bg-white disabled:bg-gray-100 disabled:text-gray-700"
                  value={fiveWhy.pfmeaRpn}
                  onChange={(e) => setFiveWhy({ ...fiveWhy, pfmeaRpn: e.target.value })}
                />
              </div>
            )}
          </div>
        </div>

        {/* (5) DEVELOPING SOLUTION & (5a) TRIAL RUN */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-gray-300 p-4 rounded-lg bg-gray-50">
            <h3 className="text-xs font-bold uppercase text-gray-800 mb-2">(5) Developing Solution:</h3>
            <textarea
              rows={3}
              disabled={isFormLocked}
              className="w-full border border-gray-300 p-2 rounded text-xs bg-white font-medium outline-none disabled:bg-gray-100 disabled:text-gray-700"
              placeholder="Detail the developed solution..."
              value={solution.developingSolution}
              onChange={(e) => setSolution({ ...solution, developingSolution: e.target.value })}
            />
          </div>

          <div className="border border-gray-300 p-4 rounded-lg bg-gray-50 space-y-2">
            <h3 className="text-xs font-bold uppercase text-gray-800">(5a) Trial Run (Confirmation Trial):</h3>
            <textarea
              rows={2}
              disabled={isFormLocked}
              className="w-full border border-gray-300 p-2 rounded text-xs bg-white font-medium outline-none disabled:bg-gray-100 disabled:text-gray-700"
              placeholder="e.g. AFTER INSERT CHANGED CONTINUOUSLY 10 SETS QF VERIFIED OK"
              value={solution.trialRun}
              onChange={(e) => setSolution({ ...solution, trialRun: e.target.value })}
            />
            <div className="flex gap-2">
              <div className="w-1/2">
                <label className="text-[10px] font-bold text-gray-600 block">Date</label>
                <input
                  type="date"
                  disabled={isFormLocked}
                  className="w-full border border-gray-300 p-1 rounded text-xs bg-white font-medium disabled:bg-gray-100 disabled:text-gray-700"
                  value={solution.trialRunDate}
                  onChange={(e) => setSolution({ ...solution, trialRunDate: e.target.value })}
                />
              </div>
              <div className="w-1/2">
                <label className="text-[10px] font-bold text-gray-600 block">Sequence #&apos;s</label>
                <input
                  type="text"
                  disabled={isFormLocked}
                  className="w-full border border-gray-300 p-1 rounded text-xs bg-white font-medium disabled:bg-gray-100 disabled:text-gray-700"
                  value={solution.trialRunSequence}
                  onChange={(e) => setSolution({ ...solution, trialRunSequence: e.target.value })}
                />
              </div>
            </div>
          </div>
        </div>

        {/* (6) PERMANENT CORRECTIVE ACTIONS */}
        <div className="border border-gray-300 p-4 rounded-lg bg-gray-50 space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold uppercase text-gray-800">(6) Permanent Corrective Actions:</h3>
            <div className="flex items-center gap-3 text-[11px] font-semibold text-gray-600">
              <span>Status Legend:</span>
              <span className="flex items-center gap-1"><StatusQuadrantIcon level={1} editable={false} /> 1 - Identified</span>
              <span className="flex items-center gap-1"><StatusQuadrantIcon level={2} editable={false} /> 2 - Implemented</span>
              <span className="flex items-center gap-1"><StatusQuadrantIcon level={3} editable={false} /> 3 - Feedback</span>
              <span className="flex items-center gap-1"><StatusQuadrantIcon level={4} editable={false} /> 4 - Closed</span>
            </div>
          </div>

          <table className="w-full text-xs border border-gray-300 text-center">
            <thead className="bg-gray-200 font-bold">
              <tr>
                <th className="border p-2 w-[12%]">Type</th>
                <th className="border p-2 w-[48%]">Action Plan</th>
                <th className="border p-2 w-[15%]">Who</th>
                <th className="border p-2 w-[10%]">Due Date</th>
                <th className="border p-2 w-[10%]">Break Point</th>
                <th className="border p-2 w-[5%]">Status</th>
              </tr>
            </thead>
            <tbody>
              {correctiveActions.map((row, idx) => (
                <tr key={`pca-${idx}`} className="bg-white">
                  <td className="border p-2 font-bold uppercase bg-gray-50">{row.type}</td>
                  <td className="border p-1 text-left">
                    <input
                      type="text"
                      disabled={isFormLocked}
                      className="w-full outline-none font-medium text-xs px-1 disabled:bg-gray-100 disabled:text-gray-700"
                      value={row.action}
                      placeholder={`Enter ${row.type} action`}
                      onChange={(e) => {
                        const updated = [...correctiveActions];
                        updated[idx].action = e.target.value;
                        setCorrectiveActions(updated);
                      }}
                    />
                  </td>
                  <td className="border p-1">
                    <input
                      type="text"
                      disabled={isFormLocked}
                      className="w-full text-center outline-none font-medium text-xs disabled:bg-gray-100 disabled:text-gray-700"
                      value={row.who}
                      onChange={(e) => {
                        const updated = [...correctiveActions];
                        updated[idx].who = e.target.value;
                        setCorrectiveActions(updated);
                      }}
                    />
                  </td>
                  <td className="border p-1">
                    <input
                      type="date"
                      disabled={isFormLocked}
                      className="w-full text-center outline-none font-medium text-xs bg-transparent disabled:bg-gray-100 disabled:text-gray-700"
                      value={row.dueDate}
                      onChange={(e) => {
                        const updated = [...correctiveActions];
                        updated[idx].dueDate = e.target.value;
                        setCorrectiveActions(updated);
                      }}
                    />
                  </td>
                  <td className="border p-1">
                    <input
                      type="date"
                      disabled={isFormLocked}
                      className="w-full text-center outline-none font-medium text-xs bg-transparent disabled:bg-gray-100 disabled:text-gray-700"
                      value={row.breakPoint}
                      onChange={(e) => {
                        const updated = [...correctiveActions];
                        updated[idx].breakPoint = e.target.value;
                        setCorrectiveActions(updated);
                      }}
                    />
                  </td>
                  <td className="border p-1">
                    <StatusQuadrantIcon
                      editable={!isFormLocked}
                      level={row.status || 1}
                      onChange={(newLevel) => {
                        const updated = [...correctiveActions];
                        updated[idx].status = newLevel;
                        setCorrectiveActions(updated);
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* (7) VERIFICATION & RESOLUTION QUESTIONS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="border border-gray-300 p-4 rounded-lg bg-gray-50 space-y-2 text-xs">
            <h3 className="font-bold uppercase text-gray-800">(7) Verification & Resolution Questions:</h3>
            <table className="w-full border border-gray-300 text-left bg-white">
              <thead className="bg-gray-200 font-bold text-center">
                <tr>
                  <th className="p-1.5 border">Question</th>
                  <th className="p-1.5 border w-10">Y</th>
                  <th className="p-1.5 border w-10">N</th>
                  <th className="p-1.5 border w-10">N/A</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { key: "q1", text: "Has the Drawing been updated?" },
                  { key: "q2", text: "Has the Work instruction, SOP/PFD been updated?" },
                  { key: "q3", text: "Has the Product Quality Standard been updated?" },
                  { key: "q4", text: "Have Prints, Check Sheets or other forms been updated?" },
                  { key: "q5", text: "Have the PFMEA and Control Plans been updated?" },
                  { key: "q6", text: "The results/changes were communicated to all affected Team Members?" },
                ].map((q) => (
                  <tr key={q.key} className="border-b">
                    <td className="p-1.5 font-medium border-r">{q.text}</td>
                    {["Y", "N", "N/A"].map((opt) => (
                      <td key={opt} className="p-1.5 text-center border-r">
                        <input
                          type="radio"
                          disabled={isFormLocked}
                          name={q.key}
                          checked={verification[q.key] === opt}
                          onChange={() => setVerification({ ...verification, [q.key]: opt })}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border border-gray-300 p-4 rounded-lg bg-gray-50 flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-bold uppercase text-gray-800 mb-2">(7a) Lessons Learned:</h3>
              <textarea
                rows={4}
                disabled={isFormLocked}
                className="w-full border border-gray-300 p-2 rounded text-xs bg-white font-medium outline-none disabled:bg-gray-100 disabled:text-gray-700"
                placeholder="Document key insights gained..."
                value={verification.lessonsLearned}
                onChange={(e) => setVerification({ ...verification, lessonsLearned: e.target.value })}
              />
            </div>

            <div className="pt-2 border-t mt-2">
              <h3 className="text-xs font-bold uppercase text-gray-800 mb-1">(7c) Horizontal Deployment:</h3>
              <textarea
                rows={3}
                disabled={isFormLocked}
                className="w-full border border-gray-300 p-2 rounded text-xs bg-white font-medium outline-none disabled:bg-gray-100 disabled:text-gray-700"
                placeholder="Detail horizontal expansion to other lines/machines..."
                value={verification.horizontalDeployment}
                onChange={(e) => setVerification({ ...verification, horizontalDeployment: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* (8) SIGNATURES TABLE */}
        <div className="overflow-x-auto mt-6">
          <table className="w-full border-collapse border-2 border-gray-800 text-xs text-center min-w-[800px]">
            <thead>
              <tr className="bg-gray-100 text-gray-800 font-bold">
                <th className="border border-gray-800 p-3 w-1/4">SHIFT SUPERVISOR (PRODUCTION)</th>
                <th className="border border-gray-800 p-3 w-1/4">SHIFT SUPERVISOR (QUALITY)</th>
                <th className="border border-gray-800 p-3 w-1/4">PRODUCTION ENGINEER</th>
                <th className="border border-gray-800 p-3 w-1/4">HOF - PRODUCTION</th>
              </tr>
            </thead>
            <tbody>
              <tr className="h-16">
                {/* 1. Shift Supervisor (Production) */}
                <td className="border border-gray-800 p-2 text-center align-middle bg-gray-50/40">
                  {isSupervisorProductionApproved ? (
                    <div className="flex flex-col items-center justify-center animate-in fade-in duration-200">
                      <span className="text-[10px] font-bold text-green-600 uppercase">
                        Approved By ✓
                      </span>
                      <span className="text-xs font-black text-gray-900 uppercase">
                        {signatures.shiftSupervisorProduction}
                      </span>
                    </div>
                  ) : isShiftIncharge ? (
                    <button
                      type="button"
                      onClick={handleApproveSupervisorProduction}
                      className="bg-orange-500 hover:bg-orange-600 text-white text-[11px] font-bold px-4 py-1.5 rounded shadow hover:scale-105 transition-all uppercase tracking-wider cursor-pointer"
                    >
                      Approve
                    </button>
                  ) : (
                    <span className="text-gray-400 text-xs italic">
                      Pending Shift Incharge
                    </span>
                  )}
                </td>

                {/* 2. Shift Supervisor (Quality) */}
                <td className="border border-gray-800 p-2 text-center align-middle bg-gray-50/40">
                  {isQcApproved ? (
                    <div className="flex flex-col items-center justify-center animate-in fade-in duration-200">
                      <span className="text-[10px] font-bold text-green-600 uppercase">
                        Approved By ✓
                      </span>
                      <span className="text-xs font-black text-gray-900 uppercase">
                        approved by {signatures.shiftSupervisorQuality}
                      </span>
                    </div>
                  ) : isQC ? (
                    <div className="flex flex-col items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={handleApproveQc}
                        className="bg-green-600 hover:bg-green-700 text-white text-[11px] font-bold px-4 py-1.5 rounded shadow hover:scale-105 transition-all uppercase tracking-wider cursor-pointer"
                      >
                        Approve QC
                      </button>
                      {header.assignedQc && (
                        <span className="text-[10px] text-gray-500 font-semibold uppercase">
                          (Assigned: {header.assignedQc})
                        </span>
                      )}
                    </div>
                  ) : isSavedRecord ? (
                    <div className="flex flex-col items-center justify-center">
                      <span className="text-red-600 text-xs font-bold uppercase">
                        pending
                      </span>
                      {header.assignedQc && (
                        <span className="text-[10px] font-bold text-gray-500 uppercase mt-0.5">
                          (Assigned: {header.assignedQc})
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1 w-full">
                      <select
                        className="w-full bg-white border border-gray-300 p-1.5 rounded font-bold text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-orange-500 text-center disabled:bg-gray-100"
                        value={header.assignedQc || ""}
                        onChange={(e) => setHeader({ ...header, assignedQc: e.target.value })}
                        disabled={isSavedRecord}
                      >
                        <option value="">-- Select QC --</option>
                        {qcUsers.map((qc, qIdx) => {
                          const uname = qc.username || qc.employeeId || qc.name;
                          return (
                            <option key={`${uname}-${qIdx}`} value={uname}>
                              {uname.toUpperCase()}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  )}
                </td>

                {/* 3. Production Engineer */}
                <td className="border border-gray-800 p-2 text-center align-middle bg-gray-50/40">
                  {isPeApproved ? (
                    <div className="flex flex-col items-center justify-center animate-in fade-in duration-200">
                      <span className="text-[10px] font-bold text-green-600 uppercase">
                        Approved By ✓
                      </span>
                      <span className="text-xs font-black text-gray-900 uppercase">
                        approved by {signatures.productionEngineer}
                      </span>
                    </div>
                  ) : isPE ? (
                    <div className="flex flex-col items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={handleApprovePe}
                        className="bg-green-600 hover:bg-green-700 text-white text-[11px] font-bold px-4 py-1.5 rounded shadow hover:scale-105 transition-all uppercase tracking-wider cursor-pointer"
                      >
                        Approve PE
                      </button>
                      {header.assignedPe && (
                        <span className="text-[10px] text-gray-500 font-semibold uppercase">
                          (Assigned: {header.assignedPe})
                        </span>
                      )}
                    </div>
                  ) : isSavedRecord ? (
                    <div className="flex flex-col items-center justify-center">
                      <span className="text-red-600 text-xs font-bold uppercase">
                        pending
                      </span>
                      {header.assignedPe && (
                        <span className="text-[10px] font-bold text-gray-500 uppercase mt-0.5">
                          (Assigned: {header.assignedPe})
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1 w-full">
                      <select
                        className="w-full bg-white border border-gray-300 p-1.5 rounded font-bold text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-orange-500 text-center disabled:bg-gray-100"
                        value={header.assignedPe || ""}
                        onChange={(e) => setHeader({ ...header, assignedPe: e.target.value })}
                        disabled={isSavedRecord}
                      >
                        <option value="">-- Select PE --</option>
                        {peUsers.map((pe, pIdx) => {
                          const uname = pe.username || pe.employeeId || pe.name;
                          return (
                            <option key={`${uname}-${pIdx}`} value={uname}>
                              {uname.toUpperCase()}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  )}
                </td>

                {/* 4. HOF - Production */}
                <td className="border border-gray-800 p-2 text-center align-middle bg-gray-50/40">
                  {isHofApproved ? (
                    <div className="flex flex-col items-center justify-center animate-in fade-in duration-200">
                      <span className="text-[10px] font-bold text-green-600 uppercase">
                        Approved By ✓
                      </span>
                      <span className="text-xs font-black text-gray-900 uppercase">
                        approved by {signatures.hofProduction}
                      </span>
                    </div>
                  ) : isHOF ? (
                    <div className="flex flex-col items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={handleApproveHof}
                        className="bg-green-600 hover:bg-green-700 text-white text-[11px] font-bold px-4 py-1.5 rounded shadow hover:scale-105 transition-all uppercase tracking-wider cursor-pointer"
                      >
                        Approve HOF
                      </button>
                      {header.assignedHof && (
                        <span className="text-[10px] text-gray-500 font-semibold uppercase">
                          (Assigned: {header.assignedHof})
                        </span>
                      )}
                    </div>
                  ) : isSavedRecord ? (
                    <div className="flex flex-col items-center justify-center">
                      <span className="text-red-600 text-xs font-bold uppercase">
                        pending
                      </span>
                      {header.assignedHof && (
                        <span className="text-[10px] font-bold text-gray-500 uppercase mt-0.5">
                          (Assigned: {header.assignedHof})
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1 w-full">
                      <select
                        className="w-full bg-white border border-gray-300 p-1.5 rounded font-bold text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-orange-500 text-center disabled:bg-gray-100"
                        value={header.assignedHof || ""}
                        onChange={(e) => setHeader({ ...header, assignedHof: e.target.value })}
                        disabled={isSavedRecord}
                      >
                        <option value="">-- Select HOF --</option>
                        {hofUsers.map((h, hIdx) => {
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

        {/* SUBMIT BUTTON */}
        <div className="flex justify-end pt-4 border-t border-gray-300">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || saveSuccess || (isSavedRecord && isShiftIncharge)}
            className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white px-10 py-3 rounded font-bold transition-colors shadow-lg flex items-center gap-2 uppercase tracking-wider text-sm hover:cursor-pointer"
          >
            {isSaving
              ? "SAVING..."
              : saveSuccess
              ? "SAVED ✓"
              : isQC
              ? "Submit QC Approval"
              : isPE
              ? "Submit PE Approval"
              : isHOF
              ? "Submit HOF Approval"
              : isSavedRecord
              ? "Record Already Submitted"
              : "Submit for Verification"}
          </button>
        </div>
      </div>
    </div>
  );
}