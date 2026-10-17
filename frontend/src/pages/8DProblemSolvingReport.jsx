import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { ArrowLeft, FileDown, Plus, Trash2, CheckCircle2, AlertTriangle, Info, Clock, Check } from 'lucide-react';
import Header from '../components/Header';

const formMeta = {
  formCode: "QF/08/CAT-05",
  revision: "02",
  revisionDate: "25.11.2024",
  title: "8D Problem Solving Report",
  company: "SAKTHI AUTO",
};

const SPECIAL_CHARS = ["Ø", "±", "°", "×", "≤", "≥", "⌀", "⊥", "∥", "√", "Ra", "~", "'", '"', "µm", "R", "C"];

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
      ? "bg-red-600 border-red-700"
      : type === "success"
      ? "bg-green-600 border-green-700"
      : type === "info"
      ? "bg-blue-600 border-blue-700"
      : "bg-orange-600 border-orange-700";

  return (
    <div className={`fixed bottom-6 right-6 z-50 ${bgColor} text-white px-5 py-3.5 rounded-xl shadow-2xl flex items-center gap-3 animate-bounce border`}>
      <span className="text-sm font-semibold tracking-wide">{message}</span>
      <button onClick={onClose} className="ml-2 font-bold text-lg leading-none hover:text-gray-200 focus:outline-none">×</button>
    </div>
  );
};

const StatusQuadrantIcon = ({ level = 1, onChange, editable = true }) => {
  return (
    <div 
      className={`inline-flex items-center justify-center select-none ${editable ? 'cursor-pointer hover:scale-110 transition-transform' : 'cursor-default opacity-80'}`}
      onClick={() => {
        if (!editable) return;
        const next = (level % 4) + 1;
        onChange?.(next);
      }}
      title={`Level ${level}/4 (Click to change)`}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" className="transform -rotate-90">
        {level >= 4 ? (
          <circle cx="12" cy="12" r="10" stroke="#1f2937" strokeWidth="1.5" fill="#16a34a" />
        ) : (
          <>
            <circle cx="12" cy="12" r="10" stroke="#1f2937" strokeWidth="1.5" fill="none" />
            <line x1="12" y1="2" x2="12" y2="22" stroke="#1f2937" strokeWidth="1" />
            <line x1="2" y1="12" x2="22" y2="12" stroke="#1f2937" strokeWidth="1" />
            {level >= 1 && <path d="M12,12 L22,12 A10,10 0 0,0 12,2 Z" fill="#2563eb" />}
            {level >= 2 && <path d="M12,12 L12,22 A10,10 0 0,0 22,12 Z" fill="#2563eb" />}
            {level >= 3 && <path d="M12,12 L2,12 A10,10 0 0,0 12,22 Z" fill="#2563eb" />}
          </>
        )}
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

  const isFormLocked = isSavedRecord || isReadOnlyApprover;

  // Master Data Dropdowns
  const [partSets, setPartSets] = useState([]);
  const [loadingPartSets, setLoadingPartSets] = useState(true);
  const [qcUsers, setQcUsers] = useState([]);
  const [peUsers, setPeUsers] = useState([]);
  const [hofUsers, setHofUsers] = useState([]);

  // Dynamic QF States
  const [qfHistory, setQfHistory] = useState([]);
  const [qfValue, setQfValue] = useState("QF/08/CAT-05, Rev.No: 02 dt 25.11.2024");

  const lookupSeqRef = useRef(0);
  const problemDescRef = useRef(null);

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
    category: "",
    problemFoundBy: "",
    problemFoundByOther: "",
    assignedQc: "",
    assignedPe: "",
    assignedHof: "",
  });

  // 1. Team Members
  const [teamMembers, setTeamMembers] = useState(["", "", "", "", "", ""]);

  // 2. Problem Scope & Emergency Actions
  const [problemScope, setProblemScope] = useState("");
  const [emergencyActions, setEmergencyActions] = useState({
    qualityAlert: false,
    segregationCustomerQty: "",
    segregationCustomerNotOk: "",
    segregationFGQty: "",
    segregationFGNotOk: "",
    segregationWIPQty: "",
    segregationWIPNotOk: "",
    customerVisitRequired: "",
  });

  // 2a. Problem Description
  const [problemDescription, setProblemDescription] = useState("");

  // 2b. Process Flow
  const [processFlow, setProcessFlow] = useState([""]);

  // 3. Interim Containment Actions
  const [interimActions, setInterimActions] = useState([
    { action: "", who: "", dueDate: "", breakPoint: "" },
    { action: "", who: "", dueDate: "", breakPoint: "" },
    { action: "", who: "", dueDate: "", breakPoint: "" },
  ]);

  // 4. Fishbone Diagram
  const [fishbone, setFishbone] = useState({
    man: [{ text: "", side: "left" }],
    machine: [{ text: "", side: "left" }],
    method: [{ text: "", side: "left" }],
    material: [{ text: "", side: "left" }],
    problem: "",
  });

  // 4a. Validation Rows
  const [validationRows, setValidationRows] = useState([
    { testSimulation: "", verification: "", date: "", significant: "", remarks: "" },
    { testSimulation: "", verification: "", date: "", significant: "", remarks: "" },
  ]);

  // 4b. 5-Why
  const [fiveWhy, setFiveWhy] = useState({
    occurrence: { why1: "", why2: "", why3: "", why4: "", why5: "", rootCause: "" },
    detection: { why1: "", why2: "", why3: "", why4: "", why5: "", rootCause: "" },
    system: { why1: "", why2: "", why3: "", why4: "", why5: "", rootCause: "" },
    pfmeaIncluded: "",
    pfmeaRpn: "",
  });

  // 5. Solution
  const [solution, setSolution] = useState({
    developingSolution: "",
    trialRun: "",
    trialRunDate: "",
    trialRunSequence: "",
  });

  // 6. Corrective Actions (2 Occurrence, 2 Detection, 2 System)
  const [correctiveActions, setCorrectiveActions] = useState([
    { type: "Occurrence", action: "", who: "", dueDate: "", breakPoint: "", status: 1 },
    { type: "Occurrence", action: "", who: "", dueDate: "", breakPoint: "", status: 1 },
    { type: "Detection", action: "", who: "", dueDate: "", breakPoint: "", status: 1 },
    { type: "Detection", action: "", who: "", dueDate: "", breakPoint: "", status: 1 },
    { type: "System", action: "", who: "", dueDate: "", breakPoint: "", status: 1 },
    { type: "System", action: "", who: "", dueDate: "", breakPoint: "", status: 1 },
  ]);

  // 7. Verification, Effectiveness & Closure Sign-off
  const [verification, setVerification] = useState({
    q1: "",
    q2: "",
    q3: "",
    q4: "",
    q5: "",
    q6: "",
    lessonsLearned: "",
    issueResolved: "",
    dateClosed: "",
    assignedTo: "",
    trackingNo: "",
    effectiveness: [
      { month: "", rejQty: "", rejPct: "" },
      { month: "", rejQty: "", rejPct: "" },
      { month: "", rejQty: "", rejPct: "" },
    ],
    horizontalDeployment: "",
    closureSignOff: [
      { shift: "1ST", teamMembers: "", teamLeader: "", prodQualityHead: "" },
      { shift: "2ND", teamMembers: "", teamLeader: "", prodQualityHead: "" },
      { shift: "3RD", teamMembers: "", teamLeader: "", prodQualityHead: "" },
    ],
  });

  // 8. System Digital Approvals
  const [signatures, setSignatures] = useState({
    shiftSupervisorProduction: "",
    shiftSupervisorQuality: "",
    productionEngineer: "",
    hofProduction: "",
  });

  // Special symbol insertion into Problem Description
  const insertSymbol = (e, char) => {
    e.preventDefault();
    if (isFormLocked) return;
    const textarea = problemDescRef.current;
    if (!textarea) {
      setProblemDescription((prev) => (prev || "") + char);
      return;
    }
    const start = textarea.selectionStart ?? problemDescription.length;
    const end = textarea.selectionEnd ?? problemDescription.length;
    const currentVal = problemDescription || "";
    const newVal = currentVal.substring(0, start) + char + currentVal.substring(end);
    setProblemDescription(newVal);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + char.length, start + char.length);
    }, 0);
  };

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

  // Fetch QF History on Mount
  useEffect(() => {
    const fetchQfHistory = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(
          `${process.env.REACT_APP_API_URL || ""}/api/qf-values/history/eight-d-report`,
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
    let currentQf = "QF/08/CAT-05, Rev.No: 02 dt 25.11.2024";

    if (header.date && qfHistory.length > 0) {
      const selectedDate = new Date(header.date);
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
  }, [header.date, qfHistory]);

  const resetFormToBlank = (keepDate, keepShift, keepPartName, keepPartNo) => {
    setIsSavedRecord(false);
    setProblemScope("");
    setEmergencyActions({
      qualityAlert: false,
      segregationCustomerQty: "",
      segregationCustomerNotOk: "",
      segregationFGQty: "",
      segregationFGNotOk: "",
      segregationWIPQty: "",
      segregationWIPNotOk: "",
      customerVisitRequired: "",
    });
    setProblemDescription("");
    setTeamMembers(["", "", "", "", "", ""]);
    setProcessFlow([""]);
    setInterimActions([
      { action: "", who: "", dueDate: "", breakPoint: "" },
      { action: "", who: "", dueDate: "", breakPoint: "" },
      { action: "", who: "", dueDate: "", breakPoint: "" },
    ]);
    setFishbone({
      man: [{ text: "", side: "left" }],
      machine: [{ text: "", side: "left" }],
      method: [{ text: "", side: "left" }],
      material: [{ text: "", side: "left" }],
      problem: "",
    });
    setValidationRows([
      { testSimulation: "", verification: "", date: "", significant: "", remarks: "" },
      { testSimulation: "", verification: "", date: "", significant: "", remarks: "" },
    ]);
    setFiveWhy({
      occurrence: { why1: "", why2: "", why3: "", why4: "", why5: "", rootCause: "" },
      detection: { why1: "", why2: "", why3: "", why4: "", why5: "", rootCause: "" },
      system: { why1: "", why2: "", why3: "", why4: "", why5: "", rootCause: "" },
      pfmeaIncluded: "",
      pfmeaRpn: "",
    });
    setSolution({ developingSolution: "", trialRun: "", trialRunDate: "", trialRunSequence: "" });
    setCorrectiveActions([
      { type: "Occurrence", action: "", who: "", dueDate: "", breakPoint: "", status: 1 },
      { type: "Occurrence", action: "", who: "", dueDate: "", breakPoint: "", status: 1 },
      { type: "Detection", action: "", who: "", dueDate: "", breakPoint: "", status: 1 },
      { type: "Detection", action: "", who: "", dueDate: "", breakPoint: "", status: 1 },
      { type: "System", action: "", who: "", dueDate: "", breakPoint: "", status: 1 },
      { type: "System", action: "", who: "", dueDate: "", breakPoint: "", status: 1 },
    ]);
    setVerification({
      q1: "", q2: "", q3: "", q4: "", q5: "", q6: "",
      lessonsLearned: "", issueResolved: "", dateClosed: "", assignedTo: "", trackingNo: "",
      effectiveness: [
        { month: "", rejQty: "", rejPct: "" },
        { month: "", rejQty: "", rejPct: "" },
        { month: "", rejQty: "", rejPct: "" },
      ],
      horizontalDeployment: "",
      closureSignOff: [
        { shift: "1ST", teamMembers: "", teamLeader: "", prodQualityHead: "" },
        { shift: "2ND", teamMembers: "", teamLeader: "", prodQualityHead: "" },
        { shift: "3RD", teamMembers: "", teamLeader: "", prodQualityHead: "" },
      ],
    });
    setSignatures({
      shiftSupervisorProduction: "",
      shiftSupervisorQuality: "",
      productionEngineer: "",
      hofProduction: "",
    });
    setHeader((prev) => ({
      ...prev,
      date: keepDate !== undefined ? keepDate : prev.date,
      shift: keepShift !== undefined ? keepShift : prev.shift,
      partName: keepPartName !== undefined ? keepPartName : "",
      partNo: keepPartNo !== undefined ? keepPartNo : "",
      customer: "",
      category: "",
      problemFoundBy: "",
      problemFoundByOther: "",
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
    if (record.processFlow && record.processFlow.length > 0) setProcessFlow(record.processFlow);
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
    if (record.verification) {
      setVerification((prev) => ({
        ...prev,
        ...record.verification,
        effectiveness: record.verification.effectiveness && record.verification.effectiveness.length > 0
          ? record.verification.effectiveness
          : [
              { month: "", rejQty: "", rejPct: "" },
              { month: "", rejQty: "", rejPct: "" },
              { month: "", rejQty: "", rejPct: "" },
            ],
        closureSignOff: record.verification.closureSignOff && record.verification.closureSignOff.length > 0
          ? record.verification.closureSignOff
          : [
              { shift: "1ST", teamMembers: "", teamLeader: "", prodQualityHead: "" },
              { shift: "2ND", teamMembers: "", teamLeader: "", prodQualityHead: "" },
              { shift: "3RD", teamMembers: "", teamLeader: "", prodQualityHead: "" },
            ],
      }));
    }
    if (record.signatures) {
      setSignatures({
        shiftSupervisorProduction: record.signatures.shiftSupervisorProduction || record.signatures.teamLeader || record.signatures.shiftIncharge || "",
        shiftSupervisorQuality: record.signatures.shiftSupervisorQuality || record.signatures.qualityHead || "",
        productionEngineer: record.signatures.productionEngineer || record.signatures.productionHead || "",
        hofProduction: record.signatures.hofProduction || "",
      });
    }
  };

  const checkExistingRecord = async (partNo, date, shift, partName) => {
    if (!partNo || !date) return;

    const seq = ++lookupSeqRef.current;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${process.env.REACT_APP_API_URL || ""}/api/8d-report?machineShop=${shopId || 3}&partNo=${encodeURIComponent(partNo)}&date=${encodeURIComponent(date)}&shift=${encodeURIComponent(shift || "1ST")}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (seq !== lookupSeqRef.current) return;

      if (res.ok) {
        const data = await res.json();
        if (seq !== lookupSeqRef.current) return;

        if (Array.isArray(data) && data.length > 0) {
          loadRecordData(data[0]);
          triggerToast("Existing 8D record loaded (Form locked for editing).", "info");
        } else {
          setIsSavedRecord(false);
        }
      } else {
        setIsSavedRecord(false);
      }
    } catch (err) {
      console.error("Failed to check existing 8D report:", err);
      setIsSavedRecord(false);
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
        checkExistingRecord(qPart, qDate, qShift, header.partName);
      }
    }
  }, [location.state, searchParams]);

  const handlePartManualChange = (field, value) => {
    setHeader((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === "partName") {
        const matched = partSets.find(
          (p) => p.PartName && p.PartName.trim().toLowerCase() === value.trim().toLowerCase()
        );
        if (matched && !prev.partNo) {
          updated.partNo = matched.PartNo;
        }
      } else if (field === "partNo") {
        const matched = partSets.find(
          (p) => p.PartNo && p.PartNo.trim().toLowerCase() === value.trim().toLowerCase()
        );
        if (matched && !prev.partName) {
          updated.partName = matched.PartName;
        }
      }
      return updated;
    });
  };

  const handlePartSelectChange = (type, value) => {
    if (!value) return;
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

    resetFormToBlank(header.date, header.shift, nextPartName, nextPartNo);
    if (nextPartNo && header.date) {
      checkExistingRecord(nextPartNo, header.date, header.shift, nextPartName);
    }
  };

  const handlePartBlur = () => {
    if (header.partNo && header.date && !isSavedRecord) {
      checkExistingRecord(header.partNo, header.date, header.shift, header.partName);
    }
  };

  const handleHeaderDateOrShiftChange = (field, val) => {
    const nextDate = field === "date" ? val : header.date;
    const nextShift = field === "shift" ? val : header.shift;

    resetFormToBlank(nextDate, nextShift, header.partName, header.partNo);
    if (header.partNo && nextDate) {
      checkExistingRecord(header.partNo, nextDate, nextShift, header.partName);
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
      triggerToast("PDF generated successfully!", "success");
    } catch (err) {
      triggerToast(err.message || "PDF Download Failed", "error");
    }
  };

  const handleSave = async () => {
    if (!header.partNo || !header.partName) {
      triggerToast("Please enter Part Name and Part No.", "error");
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
    <div className="min-h-screen bg-[#2d2d2d] flex flex-col items-center justify-start p-3 sm:p-6 lg:p-8 font-sans antialiased">
      <Header />
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: "", type: "" })} />

      {/* Progress / Save Modal */}
      {(isSaving || saveSuccess) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl px-8 sm:px-12 py-8 text-center border border-gray-100 max-w-sm w-full">
            {isSaving ? (
              <>
                <div className="w-12 h-12 border-4 border-gray-200 border-t-orange-500 rounded-full animate-spin mx-auto mb-4"></div>
                <h2 className="text-lg font-bold text-gray-900 tracking-wide">Saving 8D Report...</h2>
                <p className="text-xs text-gray-500 mt-1 font-medium">
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
                <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h2 className="text-lg font-bold text-green-800 tracking-wide">Report Saved Successfully</h2>
                <p className="text-xs text-gray-500 mt-1 font-medium">Redirecting to dashboard...</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Main Container Card */}
      <div className="bg-white w-full max-w-[98rem] rounded-2xl p-4 sm:p-8 lg:p-10 shadow-2xl border border-gray-200/80 space-y-7 my-4">
        
        {/* TOP HEADER */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-200 pb-5 gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="p-2 text-gray-600 hover:text-orange-600 hover:bg-orange-50 rounded-xl transition-all cursor-pointer border border-gray-200 shadow-sm"
              title="Go Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-orange-600 tracking-widest uppercase">
                  {formMeta.company}
                </span>
                {isSavedRecord && (
                  <span className="text-[10px] bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded-full uppercase border border-red-200">
                    Locked Record
                  </span>
                )}
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-gray-900 uppercase tracking-wide mt-0.5">
                {formMeta.title}
              </h2>
              <div className="text-xs text-gray-500 font-semibold mt-1 flex flex-wrap items-center gap-2">
                <span>{qfValue}</span>
                <span>•</span>
                <span className="bg-orange-50 text-orange-800 font-bold px-2 py-0.5 rounded border border-orange-200">
                  Shop ID: {shopId || 3}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 self-stretch sm:self-auto">
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider shadow hover:shadow-md transition-all cursor-pointer"
            >
              <FileDown className="w-4 h-4 text-orange-400" /> Preview PDF (2-Page)
            </button>
          </div>
        </div>

        {/* METADATA GRID CARD */}
        <div className="bg-orange-50/50 rounded-xl border border-orange-200 p-5 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 border-b border-orange-200/80 pb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
            <span className="font-extrabold text-orange-950 text-xs sm:text-sm uppercase tracking-wide">
              Problem Tracking Parameters
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs sm:text-sm">
            <div className="space-y-3">
              <div>
                <label className="font-bold text-gray-700 block mb-1 text-[11px] uppercase tracking-wider">Date & Shift</label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    className="w-1/2 border border-gray-300 p-2 rounded-lg font-semibold bg-white cursor-pointer focus:outline-none focus:border-orange-500 transition-all"
                    value={header.date}
                    onChange={(e) => handleHeaderDateOrShiftChange("date", e.target.value)}
                  />
                  <select
                    className="w-1/2 border border-gray-300 p-2 rounded-lg font-bold bg-white cursor-pointer focus:outline-none focus:border-orange-500 transition-all"
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
                <label className="font-bold text-gray-700 block mb-1 text-[11px] uppercase tracking-wider">Customer</label>
                <input
                  type="text"
                  disabled={isFormLocked}
                  className="w-full border border-gray-300 p-2 rounded-lg font-semibold bg-white disabled:bg-gray-100 disabled:text-gray-700 focus:outline-none focus:border-orange-500 transition-all"
                  placeholder="e.g. STELLANTIS"
                  value={header.customer}
                  onChange={(e) => setHeader({ ...header, customer: e.target.value })}
                />
              </div>
            </div>

            {/* PART NAME & PART NUMBER */}
            <div className="space-y-3">
              <div>
                <label className="font-bold text-gray-700 block mb-1 text-[11px] uppercase tracking-wider">Part Name</label>
                <div className="space-y-1.5">
                  <input
                    type="text"
                    list="partNameList"
                    disabled={isFormLocked}
                    placeholder="Type or select Part Name"
                    className="w-full border border-gray-300 p-2 rounded-lg font-bold bg-white disabled:bg-gray-100 disabled:text-gray-700 text-xs focus:outline-none focus:border-orange-500 transition-all"
                    value={header.partName}
                    onChange={(e) => handlePartManualChange("partName", e.target.value)}
                    onBlur={handlePartBlur}
                  />
                  <datalist id="partNameList">
                    {partSets.map((ps, idx) => (
                      <option key={`pndl-${ps.Id || idx}`} value={ps.PartName}>
                        {ps.PartNo ? `(${ps.PartNo})` : ""}
                      </option>
                    ))}
                  </datalist>
                  <select
                    disabled={isFormLocked || loadingPartSets}
                    className="w-full border border-gray-300 p-1.5 rounded-lg font-medium bg-white text-xs cursor-pointer disabled:bg-gray-100 text-gray-700 focus:outline-none"
                    value={partSets.some((p) => p.PartName === header.partName) ? header.partName : ""}
                    onChange={(e) => handlePartSelectChange("partName", e.target.value)}
                  >
                    <option value="">{loadingPartSets ? "Loading Part Names..." : "-- Quick Select Part Name --"}</option>
                    {partSets.map((ps, idx) => (
                      <option key={`pname-${ps.Id || idx}`} value={ps.PartName}>
                        {ps.PartName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1 text-[11px] uppercase tracking-wider">Part No.</label>
                <div className="space-y-1.5">
                  <input
                    type="text"
                    list="partNoList"
                    disabled={isFormLocked}
                    placeholder="Type or select Part No"
                    className="w-full border border-gray-300 p-2 rounded-lg font-bold bg-white disabled:bg-gray-100 disabled:text-gray-700 text-xs focus:outline-none focus:border-orange-500 transition-all"
                    value={header.partNo}
                    onChange={(e) => handlePartManualChange("partNo", e.target.value)}
                    onBlur={handlePartBlur}
                  />
                  <datalist id="partNoList">
                    {partSets.map((ps, idx) => (
                      <option key={`pnodl-${ps.Id || idx}`} value={ps.PartNo}>
                        {ps.PartName ? `(${ps.PartName})` : ""}
                      </option>
                    ))}
                  </datalist>
                  <select
                    disabled={isFormLocked || loadingPartSets}
                    className="w-full border border-gray-300 p-1.5 rounded-lg font-medium bg-white text-xs cursor-pointer disabled:bg-gray-100 text-gray-700 focus:outline-none"
                    value={partSets.some((p) => p.PartNo === header.partNo) ? header.partNo : ""}
                    onChange={(e) => handlePartSelectChange("partNo", e.target.value)}
                  >
                    <option value="">{loadingPartSets ? "Loading Part Numbers..." : "-- Quick Select Part No --"}</option>
                    {partSets.map((ps, idx) => (
                      <option key={`pno-${ps.Id || idx}`} value={ps.PartNo}>
                        {ps.PartNo}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="font-bold text-gray-700 block mb-1 text-[11px] uppercase tracking-wider">Category</label>
                <div className="grid grid-cols-3 gap-1.5 text-center font-bold">
                  {["Safety", "Quality", "Delivery", "People", "Cost", "Other"].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      disabled={isFormLocked}
                      onClick={() => setHeader({ ...header, category: cat })}
                      className={`py-1.5 px-2 border rounded-lg text-xs transition-all ${
                        header.category === cat
                          ? "bg-orange-600 text-white border-orange-600 shadow-sm"
                          : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
                      } disabled:opacity-80 disabled:cursor-not-allowed`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1 text-[11px] uppercase tracking-wider">Problem Found By</label>
                <div className="flex gap-3 items-center flex-wrap pt-0.5">
                  {["Verification Station", "Maintenance", "Production", "Customer", "Other"].map((p) => (
                    <label key={p} className={`flex items-center gap-1.5 font-bold text-gray-800 text-xs ${isFormLocked ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}>
                      <input
                        type="radio"
                        disabled={isFormLocked}
                        name="problemFoundBy"
                        checked={header.problemFoundBy === p}
                        onChange={() => setHeader({ ...header, problemFoundBy: p })}
                        className="w-3.5 h-3.5 text-orange-600 focus:ring-orange-500"
                      />
                      {p}
                    </label>
                  ))}
                </div>
                {header.problemFoundBy === "Other" && (
                  <input
                    type="text"
                    disabled={isFormLocked}
                    placeholder="Specify who found problem..."
                    className="mt-2 w-full border border-gray-300 p-2 rounded-lg font-semibold bg-white disabled:bg-gray-100 focus:outline-none focus:border-orange-500"
                    value={header.problemFoundByOther || ""}
                    onChange={(e) => setHeader({ ...header, problemFoundByOther: e.target.value })}
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* (1) TEAM MEMBERS */}
        <div className="bg-white rounded-xl border border-gray-300 p-5 space-y-3 shadow-sm">
          <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
            <span className="font-extrabold text-gray-900 text-xs sm:text-sm uppercase tracking-wide">
              (1) 8D Problem Solving Team Members
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {teamMembers.map((member, idx) => (
              <input
                key={`member-${idx}`}
                type="text"
                disabled={isFormLocked}
                placeholder={`Member ${idx + 1}`}
                className="border border-gray-300 p-2.5 rounded-lg text-xs font-semibold bg-gray-50/50 focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all disabled:bg-gray-100 disabled:text-gray-700"
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-300 p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-200 pb-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
                <span className="font-extrabold text-gray-900 text-xs sm:text-sm uppercase tracking-wide">
                  (2) Problem Scope & Containment
                </span>
              </div>
              <div className="flex gap-4 text-xs font-bold text-gray-800">
                {["New", "Repeated", "Reopened"].map((sc) => (
                  <label key={sc} className={`flex items-center gap-1.5 ${isFormLocked ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}>
                    <input
                      type="radio"
                      disabled={isFormLocked}
                      name="problemScope"
                      checked={problemScope === sc}
                      onChange={() => setProblemScope(sc)}
                      className="w-3.5 h-3.5 text-orange-600 focus:ring-orange-500"
                    />
                    {sc}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <span className="text-xs font-bold text-gray-700 block mb-2 uppercase tracking-wider text-[11px]">Emergency Response Action:</span>
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="checkbox"
                  id="qualityAlert"
                  disabled={isFormLocked}
                  checked={emergencyActions.qualityAlert}
                  onChange={(e) => setEmergencyActions({ ...emergencyActions, qualityAlert: e.target.checked })}
                  className="w-4 h-4 text-orange-600 rounded border-gray-300 focus:ring-orange-500 cursor-pointer"
                />
                <label htmlFor="qualityAlert" className="text-xs font-bold text-gray-800 cursor-pointer select-none">
                  Quality Alert Issued
                </label>
              </div>

              {/* Segregation Table */}
              <div className="overflow-x-auto border border-gray-200 rounded-lg mb-3">
                <table className="w-full text-xs text-center">
                  <thead className="bg-gray-100 font-extrabold text-gray-800 uppercase tracking-wider text-[11px] border-b border-gray-200">
                    <tr>
                      <th className="p-2 text-left">Segregation Scope</th>
                      <th className="p-2 border-l border-gray-200">Quantity</th>
                      <th className="p-2 border-l border-gray-200">Not OK</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    <tr>
                      <td className="p-2 font-bold text-left bg-gray-50 text-gray-700">Customer</td>
                      <td className="p-1 border-l border-gray-200">
                        <input
                          type="text"
                          disabled={isFormLocked}
                          placeholder="0"
                          className="w-full text-center p-1.5 bg-transparent font-medium outline-none focus:bg-white rounded disabled:bg-gray-100 disabled:text-gray-700"
                          value={emergencyActions.segregationCustomerQty}
                          onChange={(e) => setEmergencyActions({ ...emergencyActions, segregationCustomerQty: e.target.value })}
                        />
                      </td>
                      <td className="p-1 border-l border-gray-200">
                        <input
                          type="text"
                          disabled={isFormLocked}
                          placeholder="0"
                          className="w-full text-center p-1.5 bg-transparent font-medium outline-none focus:bg-white rounded disabled:bg-gray-100 disabled:text-gray-700"
                          value={emergencyActions.segregationCustomerNotOk}
                          onChange={(e) => setEmergencyActions({ ...emergencyActions, segregationCustomerNotOk: e.target.value })}
                        />
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2 font-bold text-left bg-gray-50 text-gray-700">FG</td>
                      <td className="p-1 border-l border-gray-200">
                        <input
                          type="text"
                          disabled={isFormLocked}
                          placeholder="0"
                          className="w-full text-center p-1.5 bg-transparent font-medium outline-none focus:bg-white rounded disabled:bg-gray-100 disabled:text-gray-700"
                          value={emergencyActions.segregationFGQty}
                          onChange={(e) => setEmergencyActions({ ...emergencyActions, segregationFGQty: e.target.value })}
                        />
                      </td>
                      <td className="p-1 border-l border-gray-200">
                        <input
                          type="text"
                          disabled={isFormLocked}
                          placeholder="0"
                          className="w-full text-center p-1.5 bg-transparent font-medium outline-none focus:bg-white rounded disabled:bg-gray-100 disabled:text-gray-700"
                          value={emergencyActions.segregationFGNotOk}
                          onChange={(e) => setEmergencyActions({ ...emergencyActions, segregationFGNotOk: e.target.value })}
                        />
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2 font-bold text-left bg-gray-50 text-gray-700">WIP / Line</td>
                      <td className="p-1 border-l border-gray-200">
                        <input
                          type="text"
                          disabled={isFormLocked}
                          placeholder="0"
                          className="w-full text-center p-1.5 bg-transparent font-medium outline-none focus:bg-white rounded disabled:bg-gray-100 disabled:text-gray-700"
                          value={emergencyActions.segregationWIPQty}
                          onChange={(e) => setEmergencyActions({ ...emergencyActions, segregationWIPQty: e.target.value })}
                        />
                      </td>
                      <td className="p-1 border-l border-gray-200">
                        <input
                          type="text"
                          disabled={isFormLocked}
                          placeholder="0"
                          className="w-full text-center p-1.5 bg-transparent font-medium outline-none focus:bg-white rounded disabled:bg-gray-100 disabled:text-gray-700"
                          value={emergencyActions.segregationWIPNotOk}
                          onChange={(e) => setEmergencyActions({ ...emergencyActions, segregationWIPNotOk: e.target.value })}
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="flex items-center gap-4 text-xs font-bold text-gray-800">
                <span>Is Customer visit required?</span>
                <label className={`flex items-center gap-1.5 ${isFormLocked ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}>
                  <input
                    type="radio"
                    disabled={isFormLocked}
                    name="visit"
                    checked={emergencyActions.customerVisitRequired === "Yes"}
                    onChange={() => setEmergencyActions({ ...emergencyActions, customerVisitRequired: "Yes" })}
                    className="w-3.5 h-3.5 text-orange-600 focus:ring-orange-500"
                  />
                  Yes
                </label>
                <label className={`flex items-center gap-1.5 ${isFormLocked ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}>
                  <input
                    type="radio"
                    disabled={isFormLocked}
                    name="visit"
                    checked={emergencyActions.customerVisitRequired === "No"}
                    onChange={() => setEmergencyActions({ ...emergencyActions, customerVisitRequired: "No" })}
                    className="w-3.5 h-3.5 text-orange-600 focus:ring-orange-500"
                  />
                  No
                </label>
              </div>
            </div>

            {/* (2a) Problem Description */}
            <div className="pt-3 border-t border-gray-200 space-y-2">
              <span className="text-xs font-extrabold text-gray-900 block uppercase tracking-wider">
                (2a) Problem Description:
              </span>

              {!isFormLocked && (
                <div className="bg-orange-50/70 border border-orange-200 p-2.5 rounded-xl flex flex-wrap items-center gap-1.5 text-xs shadow-inner">
                  <span className="font-extrabold text-orange-950 uppercase tracking-wider text-[10px] mr-1">
                    Insert Symbol:
                  </span>
                  {SPECIAL_CHARS.map((char) => (
                    <button
                      key={char}
                      type="button"
                      onMouseDown={(e) => insertSymbol(e, char)}
                      className="bg-white hover:bg-orange-500 hover:text-white border border-gray-300 rounded px-2.5 py-1 font-bold text-gray-800 shadow-xs transition-all cursor-pointer text-xs"
                    >
                      {char}
                    </button>
                  ))}
                </div>
              )}

              <textarea
                ref={problemDescRef}
                rows={3}
                disabled={isFormLocked}
                className="w-full border border-gray-300 p-3 rounded-lg text-xs bg-gray-50/40 focus:bg-white font-medium outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 disabled:bg-gray-100 disabled:text-gray-700 transition-all resize-y"
                placeholder="Describe the problem in detail (use symbols toolbar above if needed)..."
                value={problemDescription}
                onChange={(e) => setProblemDescription(e.target.value)}
              />
            </div>
          </div>

          {/* (2b) Process Flow */}
          <div className="bg-white rounded-xl border border-gray-300 p-5 space-y-3 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center border-b border-gray-200 pb-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
                  <span className="font-extrabold text-gray-900 text-xs sm:text-sm uppercase tracking-wide">
                    (2b) Sketch / Process Flow
                  </span>
                </div>
                {!isFormLocked && (
                  <button
                    type="button"
                    onClick={() => setProcessFlow([...processFlow, ""])}
                    className="inline-flex items-center gap-1 text-xs font-bold text-orange-600 hover:text-orange-700 bg-orange-50 px-2.5 py-1 rounded-lg border border-orange-200 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Step
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 p-3.5 bg-gray-50/60 border border-gray-200 rounded-xl min-h-[160px] max-w-full overflow-hidden">
                {processFlow.map((step, sIdx) => {
                  const charCount = (step || "").length;
                  const boxWidth = Math.min(220, Math.max(90, charCount * 8.5 + 24));

                  return (
                    <React.Fragment key={`step-${sIdx}`}>
                      <div
                        style={{ width: `${boxWidth}px`, maxWidth: "100%" }}
                        className="relative group border-2 border-gray-800 rounded-xl px-2.5 py-2 text-[11px] font-black text-center bg-white flex items-center justify-center transition-all shadow-sm box-border"
                      >
                        <textarea
                          rows={1}
                          disabled={isFormLocked}
                          placeholder={`Step ${sIdx + 1}`}
                          value={step}
                          onChange={(e) => {
                            const updated = [...processFlow];
                            updated[sIdx] = e.target.value;
                            setProcessFlow(updated);
                          }}
                          onInput={(e) => {
                            e.target.style.height = "auto";
                            e.target.style.height = `${e.target.scrollHeight}px`;
                          }}
                          ref={(el) => {
                            if (el) {
                              el.style.height = "auto";
                              el.style.height = `${el.scrollHeight}px`;
                            }
                          }}
                          className="w-full bg-transparent text-center outline-none text-[11px] font-bold uppercase disabled:text-gray-700 resize-none overflow-hidden leading-tight [overflow-wrap:anywhere] break-all px-0.5"
                        />
                        {!isFormLocked && processFlow.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setProcessFlow(processFlow.filter((_, i) => i !== sIdx))}
                            className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-4 h-4 text-[10px] hidden group-hover:flex items-center justify-center shadow z-10 cursor-pointer"
                          >
                            ×
                          </button>
                        )}
                      </div>
                      {sIdx < processFlow.length - 1 && (
                        <span className="text-gray-400 font-black select-none">→</span>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
            <span className="text-[11px] text-gray-500 italic mt-2">
              * Process step sequence. Arrows indicate flow direction.
            </span>
          </div>
        </div>

        {/* (3) INTERIM CONTAINMENT ACTION */}
        <div className="bg-white rounded-xl border border-gray-300 p-5 space-y-4 shadow-sm">
          <div className="flex justify-between items-center border-b border-gray-200 pb-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
              <span className="font-extrabold text-gray-900 text-xs sm:text-sm uppercase tracking-wide">
                (3) Interim Containment Action
              </span>
            </div>
            {!isFormLocked && (
              <button
                type="button"
                onClick={() => setInterimActions([...interimActions, { action: "", who: "", dueDate: "", breakPoint: "" }])}
                className="inline-flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all shadow cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Row
              </button>
            )}
          </div>

          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="w-full text-xs text-center min-w-[700px]">
              <thead className="bg-gray-100 font-extrabold text-gray-800 border-b border-gray-200 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-3 w-[45%] text-left">Action Description</th>
                  <th className="p-3 w-[20%] border-l border-gray-200">Who</th>
                  <th className="p-3 w-[15%] border-l border-gray-200">Due Date</th>
                  <th className="p-3 w-[15%] border-l border-gray-200">Break Point</th>
                  {!isFormLocked && <th className="p-3 w-[5%] border-l border-gray-200">Del</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {interimActions.map((row, idx) => (
                  <tr key={`interim-${idx}`} className="hover:bg-gray-50/50">
                    <td className="p-2 text-left">
                      <input
                        type="text"
                        disabled={isFormLocked}
                        placeholder="Enter containment action..."
                        className="w-full outline-none font-medium text-xs px-2 py-1 bg-transparent focus:bg-white rounded disabled:bg-gray-100 disabled:text-gray-700"
                        value={row.action}
                        onChange={(e) => {
                          const updated = [...interimActions];
                          updated[idx].action = e.target.value;
                          setInterimActions(updated);
                        }}
                      />
                    </td>
                    <td className="p-1 border-l border-gray-200">
                      <input
                        type="text"
                        disabled={isFormLocked}
                        placeholder="Responsibility"
                        className="w-full text-center outline-none font-medium text-xs py-1 bg-transparent focus:bg-white rounded disabled:bg-gray-100 disabled:text-gray-700"
                        value={row.who}
                        onChange={(e) => {
                          const updated = [...interimActions];
                          updated[idx].who = e.target.value;
                          setInterimActions(updated);
                        }}
                      />
                    </td>
                    <td className="p-1 border-l border-gray-200">
                      <input
                        type="date"
                        disabled={isFormLocked}
                        className="w-full text-center outline-none font-medium text-xs bg-transparent py-1 cursor-pointer disabled:bg-gray-100 disabled:text-gray-700"
                        value={row.dueDate}
                        onChange={(e) => {
                          const updated = [...interimActions];
                          updated[idx].dueDate = e.target.value;
                          setInterimActions(updated);
                        }}
                      />
                    </td>
                    <td className="p-1 border-l border-gray-200">
                      <input
                        type="date"
                        disabled={isFormLocked}
                        className="w-full text-center outline-none font-medium text-xs bg-transparent py-1 cursor-pointer disabled:bg-gray-100 disabled:text-gray-700"
                        value={row.breakPoint}
                        onChange={(e) => {
                          const updated = [...interimActions];
                          updated[idx].breakPoint = e.target.value;
                          setInterimActions(updated);
                        }}
                      />
                    </td>
                    {!isFormLocked && (
                      <td className="p-1 border-l border-gray-200">
                        <button
                          type="button"
                          onClick={() => setInterimActions(interimActions.filter((_, i) => i !== idx))}
                          className="text-red-500 hover:text-red-700 p-1 cursor-pointer"
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
        </div>

        {/* (4) ROOT CAUSE ANALYSIS - ISHIKAWA CAUSE & EFFECT */}
        <div className="bg-white rounded-xl border border-gray-300 p-5 space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-gray-200 pb-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
              <span className="font-extrabold text-gray-900 text-xs sm:text-sm uppercase tracking-wide">
                (4) Root Cause Analysis - Cause & Effect Diagram (4M)
              </span>
            </div>
            <span className="text-xs text-gray-500 italic">
              * Arrow chip (← / →) toggles orientation toward the spine.
            </span>
          </div>

          <div className="w-full bg-gray-50/60 border border-gray-300 rounded-xl p-4 overflow-x-auto min-h-[380px] flex items-center justify-center">
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

              {/* Problem Head Circle */}
              <circle cx="780" cy="190" r="58" stroke="#1f2937" strokeWidth="2.5" fill="#f9fafb" />
              <text x="780" y="125" textAnchor="middle" fontWeight="bold" fontSize="11" fill="#1f2937">PROBLEM</text>
              <foreignObject x="730" y="152" width="100" height="75">
                <div xmlns="http://www.w3.org/1999/xhtml" className="text-[10px] font-bold text-center text-gray-800 leading-tight">
                  {fishbone.problem || "PROBLEM"}
                </div>
              </foreignObject>
            </svg>
          </div>

          {/* FISHBONE CAUSES + PROBLEM CIRCLE EDITABLE COLUMNS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 text-xs">
            {["man", "machine", "method", "material"].map((cat) => (
              <div key={cat} className="border border-gray-300 p-3 rounded-xl bg-gray-50/50 space-y-2">
                <div className="flex justify-between items-center border-b border-gray-200 pb-1.5">
                  <span className="font-extrabold uppercase text-gray-800 text-[11px]">{cat} Causes</span>
                  {!isFormLocked && (
                    <button
                      type="button"
                      onClick={() => addFishboneCause(cat)}
                      className="text-orange-600 font-bold hover:text-orange-700 text-xs cursor-pointer"
                    >
                      + Add
                    </button>
                  )}
                </div>
                {fishbone[cat].map((causeObj, cIdx) => {
                  const text = typeof causeObj === "string" ? causeObj : causeObj.text;
                  const side = typeof causeObj === "string" ? "left" : causeObj.side;
                  return (
                    <div key={`${cat}-${cIdx}`} className="flex gap-1.5 items-center">
                      <input
                        type="text"
                        disabled={isFormLocked}
                        className="border border-gray-300 p-1.5 rounded-lg w-full text-xs font-medium bg-white focus:outline-none focus:border-orange-500 disabled:bg-gray-100 disabled:text-gray-700"
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
                            className="text-xs bg-white border border-gray-300 hover:bg-gray-100 px-1.5 py-1 rounded font-mono font-bold text-gray-700 cursor-pointer"
                          >
                            {side === "left" ? "←" : "→"}
                          </button>
                          <button
                            type="button"
                            onClick={() => removeFishboneCause(cat, cIdx)}
                            className="text-red-500 hover:text-red-700 font-bold text-sm px-1 cursor-pointer"
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

            {/* Editable Problem Circle Column */}
            <div className="border border-gray-300 p-3 rounded-xl bg-gray-50/50 space-y-2">
              <div className="flex justify-between items-center border-b border-gray-200 pb-1.5">
                <span className="font-extrabold uppercase text-gray-800 text-[11px]">Problem (Circle)</span>
              </div>
              <textarea
                rows={3}
                disabled={isFormLocked}
                className="border border-gray-300 p-2 rounded-lg w-full text-xs font-medium bg-white disabled:bg-gray-100 disabled:text-gray-700 resize-none outline-none focus:border-orange-500"
                value={fishbone.problem || ""}
                placeholder="Enter problem statement inside circle..."
                onChange={(e) => setFishbone((prev) => ({ ...prev, problem: e.target.value }))}
              />
            </div>
          </div>
        </div>

        {/* (4a) VALIDATION OF POTENTIAL CAUSES */}
        <div className="bg-white rounded-xl border border-gray-300 p-5 space-y-4 shadow-sm">
          <div className="flex justify-between items-center border-b border-gray-200 pb-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
              <span className="font-extrabold text-gray-900 text-xs sm:text-sm uppercase tracking-wide">
                (4a) Validation of Potential Causes
              </span>
            </div>
            {!isFormLocked && (
              <button
                type="button"
                onClick={() => setValidationRows([...validationRows, { testSimulation: "", verification: "", date: "", significant: "", remarks: "" }])}
                className="inline-flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all shadow cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Row
              </button>
            )}
          </div>

          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="w-full text-xs border-collapse text-center min-w-[750px]">
              <thead className="bg-gray-100 font-extrabold text-gray-800 uppercase tracking-wider text-[11px] border-b border-gray-200">
                <tr>
                  <th className="p-3 w-[25%] text-left">Test / Simulation</th>
                  <th className="p-3 w-[38%] border-l border-gray-200 text-left">Verification of Possible Causes</th>
                  <th className="p-3 w-[12%] border-l border-gray-200">Date</th>
                  <th className="p-3 w-[15%] border-l border-gray-200">Significant</th>
                  <th className="p-3 w-[10%] border-l border-gray-200">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {validationRows.map((row, idx) => (
                  <tr key={`val-${idx}`} className="hover:bg-gray-50/50">
                    <td className="p-2 text-left">
                      <input
                        type="text"
                        disabled={isFormLocked}
                        placeholder="Simulation / test conducted"
                        className="w-full font-semibold text-xs outline-none p-1 bg-transparent focus:bg-white rounded disabled:bg-gray-100 disabled:text-gray-700"
                        value={row.testSimulation}
                        onChange={(e) => {
                          const updated = [...validationRows];
                          updated[idx].testSimulation = e.target.value;
                          setValidationRows(updated);
                        }}
                      />
                    </td>
                    <td className="p-2 text-left border-l border-gray-200">
                      <input
                        type="text"
                        disabled={isFormLocked}
                        placeholder="Outcome of verification"
                        className="w-full font-medium text-xs outline-none p-1 bg-transparent focus:bg-white rounded disabled:bg-gray-100 disabled:text-gray-700"
                        value={row.verification}
                        onChange={(e) => {
                          const updated = [...validationRows];
                          updated[idx].verification = e.target.value;
                          setValidationRows(updated);
                        }}
                      />
                    </td>
                    <td className="p-1 border-l border-gray-200">
                      <input
                        type="date"
                        disabled={isFormLocked}
                        className="w-full text-center font-medium text-xs outline-none bg-transparent py-1 cursor-pointer disabled:bg-gray-100 disabled:text-gray-700"
                        value={row.date}
                        onChange={(e) => {
                          const updated = [...validationRows];
                          updated[idx].date = e.target.value;
                          setValidationRows(updated);
                        }}
                      />
                    </td>
                    <td className="p-1 border-l border-gray-200">
                      <select
                        disabled={isFormLocked}
                        className={`w-full text-center font-extrabold text-xs p-1.5 rounded-lg outline-none cursor-pointer border border-transparent focus:border-gray-300 disabled:bg-gray-100 ${
                          row.significant === "SIGNIFICANT" ? "text-red-600 bg-red-50" : "text-gray-700 bg-transparent"
                        }`}
                        value={row.significant}
                        onChange={(e) => {
                          const updated = [...validationRows];
                          updated[idx].significant = e.target.value;
                          setValidationRows(updated);
                        }}
                      >
                        <option value="">-- Select --</option>
                        <option value="INSIGNIFICANT">INSIGNIFICANT</option>
                        <option value="SIGNIFICANT">SIGNIFICANT</option>
                      </select>
                    </td>
                    <td className="p-1 border-l border-gray-200">
                      <input
                        type="text"
                        disabled={isFormLocked}
                        placeholder="Remarks"
                        className="w-full font-medium text-xs outline-none p-1 bg-transparent focus:bg-white rounded disabled:bg-gray-100 disabled:text-gray-700"
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
        </div>

        {/* (4b) 5-WHY ROOT CAUSE ANALYSIS */}
        <div className="bg-white rounded-xl border border-gray-300 p-5 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
            <span className="font-extrabold text-gray-900 text-xs sm:text-sm uppercase tracking-wide">
              (4b) Root Cause Analysis (5-Why Analysis)
            </span>
          </div>

          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="w-full text-xs text-center min-w-[900px]">
              <thead className="bg-gray-100 font-extrabold text-gray-800 border-b border-gray-200 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-3 w-[10%]">Level</th>
                  <th className="p-3 w-[18%] border-l border-gray-200">Why-1</th>
                  <th className="p-3 w-[18%] border-l border-gray-200">Why-2</th>
                  <th className="p-3 w-[18%] border-l border-gray-200">Why-3</th>
                  <th className="p-3 w-[18%] border-l border-gray-200">Why-4</th>
                  <th className="p-3 w-[18%] border-l border-gray-200">Why-5</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {["occurrence", "detection", "system"].map((type) => (
                  <React.Fragment key={type}>
                    <tr>
                      <td className="p-3 font-black uppercase bg-gray-50 text-gray-800">{type}</td>
                      {[1, 2, 3, 4, 5].map((w) => (
                        <td key={`${type}-w${w}`} className="p-1 border-l border-gray-200">
                          <textarea
                            rows={2}
                            disabled={isFormLocked}
                            placeholder={`Why ${w}...`}
                            className="w-full text-xs font-medium p-1.5 outline-none resize-none bg-transparent focus:bg-white rounded disabled:bg-gray-100 disabled:text-gray-700"
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
                    <tr className="bg-orange-50/40">
                      <td colSpan={6} className="p-2.5 text-left border-t border-gray-200">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-orange-950 uppercase text-[11px] whitespace-nowrap">
                            Root Cause ({type}):
                          </span>
                          <input
                            type="text"
                            disabled={isFormLocked}
                            className="flex-1 bg-white border border-orange-200 p-1.5 rounded font-bold text-xs text-gray-900 outline-none focus:border-orange-500 disabled:bg-gray-100 disabled:text-gray-700"
                            placeholder={`Definitive root cause for ${type}...`}
                            value={fiveWhy[type].rootCause || ""}
                            onChange={(e) =>
                              setFiveWhy({
                                ...fiveWhy,
                                [type]: { ...fiveWhy[type], rootCause: e.target.value },
                              })
                            }
                          />
                        </div>
                      </td>
                    </tr>
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-6 pt-2 text-xs font-bold text-gray-800 bg-gray-50/60 p-3 rounded-lg border border-gray-200">
            <span>PREDICT: Was this failure mode included in the PFMEA?</span>
            <label className={`flex items-center gap-1.5 ${isFormLocked ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}>
              <input
                type="radio"
                disabled={isFormLocked}
                name="pfmea"
                checked={fiveWhy.pfmeaIncluded === "YES"}
                onChange={() => setFiveWhy({ ...fiveWhy, pfmeaIncluded: "YES" })}
                className="w-3.5 h-3.5 text-orange-600 focus:ring-orange-500"
              />
              YES
            </label>
            <label className={`flex items-center gap-1.5 ${isFormLocked ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}>
              <input
                type="radio"
                disabled={isFormLocked}
                name="pfmea"
                checked={fiveWhy.pfmeaIncluded === "NO"}
                onChange={() => setFiveWhy({ ...fiveWhy, pfmeaIncluded: "NO" })}
                className="w-3.5 h-3.5 text-orange-600 focus:ring-orange-500"
              />
              NO
            </label>
            {fiveWhy.pfmeaIncluded === "YES" && (
              <div className="flex items-center gap-2">
                <span>If &quot;Yes&quot;, What was the RPN #:</span>
                <input
                  type="text"
                  disabled={isFormLocked}
                  placeholder="Enter RPN"
                  className="border border-gray-300 p-1.5 rounded-lg text-xs font-semibold bg-white disabled:bg-gray-100 disabled:text-gray-700 focus:outline-none focus:border-orange-500"
                  value={fiveWhy.pfmeaRpn}
                  onChange={(e) => setFiveWhy({ ...fiveWhy, pfmeaRpn: e.target.value })}
                />
              </div>
            )}
          </div>
        </div>

        {/* (5) DEVELOPING SOLUTION & (5a) TRIAL RUN */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-300 p-5 space-y-3 shadow-sm">
            <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
              <span className="font-extrabold text-gray-900 text-xs sm:text-sm uppercase tracking-wide">
                (5) Developing Solution
              </span>
            </div>
            <textarea
              rows={3}
              disabled={isFormLocked}
              className="w-full border border-gray-300 p-3 rounded-lg text-xs bg-gray-50/40 focus:bg-white font-medium outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 disabled:bg-gray-100 disabled:text-gray-700 transition-all resize-y"
              placeholder="Detail the developed solution..."
              value={solution.developingSolution}
              onChange={(e) => setSolution({ ...solution, developingSolution: e.target.value })}
            />
          </div>

          <div className="bg-white rounded-xl border border-gray-300 p-5 space-y-3 shadow-sm">
            <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
              <span className="font-extrabold text-gray-900 text-xs sm:text-sm uppercase tracking-wide">
                (5a) Trial Run (Confirmation Trial)
              </span>
            </div>
            <textarea
              rows={2}
              disabled={isFormLocked}
              className="w-full border border-gray-300 p-2.5 rounded-lg text-xs bg-gray-50/40 focus:bg-white font-medium outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 disabled:bg-gray-100 disabled:text-gray-700 transition-all resize-y"
              placeholder="Confirmation trial to test proposed solution..."
              value={solution.trialRun}
              onChange={(e) => setSolution({ ...solution, trialRun: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider block mb-1">Date</label>
                <input
                  type="date"
                  disabled={isFormLocked}
                  className="w-full border border-gray-300 p-2 rounded-lg text-xs bg-gray-50/40 focus:bg-white font-semibold cursor-pointer disabled:bg-gray-100 disabled:text-gray-700"
                  value={solution.trialRunDate}
                  onChange={(e) => setSolution({ ...solution, trialRunDate: e.target.value })}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider block mb-1">Sequence #&apos;s</label>
                <input
                  type="text"
                  disabled={isFormLocked}
                  placeholder="Sequence numbers"
                  className="w-full border border-gray-300 p-2 rounded-lg text-xs bg-gray-50/40 focus:bg-white font-semibold disabled:bg-gray-100 disabled:text-gray-700"
                  value={solution.trialRunSequence}
                  onChange={(e) => setSolution({ ...solution, trialRunSequence: e.target.value })}
                />
              </div>
            </div>
          </div>
        </div>

        {/* (6) PERMANENT CORRECTIVE ACTIONS */}
        <div className="bg-white rounded-xl border border-gray-300 p-5 space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-gray-200 pb-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
              <span className="font-extrabold text-gray-900 text-xs sm:text-sm uppercase tracking-wide">
                (6) Permanent Corrective Actions
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-gray-600 bg-gray-50 px-3 py-1 rounded-lg border border-gray-200">
              <span className="font-bold text-gray-800">Status:</span>
              <span className="flex items-center gap-1"><StatusQuadrantIcon level={1} editable={false} /> 1-Identified</span>
              <span className="flex items-center gap-1"><StatusQuadrantIcon level={2} editable={false} /> 2-Implemented</span>
              <span className="flex items-center gap-1"><StatusQuadrantIcon level={3} editable={false} /> 3-Feedback</span>
              <span className="flex items-center gap-1"><StatusQuadrantIcon level={4} editable={false} /> 4-Closed</span>
            </div>
          </div>

          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="w-full text-xs text-center min-w-[750px]">
              <thead className="bg-gray-100 font-extrabold text-gray-800 border-b border-gray-200 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-3 w-[12%]">Type</th>
                  <th className="p-3 w-[46%] text-left border-l border-gray-200">Action Plan</th>
                  <th className="p-3 w-[16%] border-l border-gray-200">Who</th>
                  <th className="p-3 w-[11%] border-l border-gray-200">Due Date</th>
                  <th className="p-3 w-[11%] border-l border-gray-200">Break Point</th>
                  <th className="p-3 w-[4%] border-l border-gray-200">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {correctiveActions.map((row, idx) => (
                  <tr key={`pca-${idx}`} className="hover:bg-gray-50/50">
                    <td className="p-2.5 font-bold uppercase bg-gray-50 text-gray-800">{row.type}</td>
                    <td className="p-2 text-left border-l border-gray-200">
                      <input
                        type="text"
                        disabled={isFormLocked}
                        className="w-full outline-none font-medium text-xs px-2 py-1 bg-transparent focus:bg-white rounded disabled:bg-gray-100 disabled:text-gray-700"
                        value={row.action}
                        placeholder={`Enter ${row.type} action plan...`}
                        onChange={(e) => {
                          const updated = [...correctiveActions];
                          updated[idx].action = e.target.value;
                          setCorrectiveActions(updated);
                        }}
                      />
                    </td>
                    <td className="p-1 border-l border-gray-200">
                      <input
                        type="text"
                        disabled={isFormLocked}
                        placeholder="Responsibility"
                        className="w-full text-center outline-none font-medium text-xs py-1 bg-transparent focus:bg-white rounded disabled:bg-gray-100 disabled:text-gray-700"
                        value={row.who}
                        onChange={(e) => {
                          const updated = [...correctiveActions];
                          updated[idx].who = e.target.value;
                          setCorrectiveActions(updated);
                        }}
                      />
                    </td>
                    <td className="p-1 border-l border-gray-200">
                      <input
                        type="date"
                        disabled={isFormLocked}
                        className="w-full text-center outline-none font-medium text-xs bg-transparent py-1 cursor-pointer disabled:bg-gray-100 disabled:text-gray-700"
                        value={row.dueDate}
                        onChange={(e) => {
                          const updated = [...correctiveActions];
                          updated[idx].dueDate = e.target.value;
                          setCorrectiveActions(updated);
                        }}
                      />
                    </td>
                    <td className="p-1 border-l border-gray-200">
                      <input
                        type="date"
                        disabled={isFormLocked}
                        className="w-full text-center outline-none font-medium text-xs bg-transparent py-1 cursor-pointer disabled:bg-gray-100 disabled:text-gray-700"
                        value={row.breakPoint}
                        onChange={(e) => {
                          const updated = [...correctiveActions];
                          updated[idx].breakPoint = e.target.value;
                          setCorrectiveActions(updated);
                        }}
                      />
                    </td>
                    <td className="p-1 border-l border-gray-200">
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
        </div>

        {/* (7) VERIFICATION & RESOLUTION QUESTIONS */}
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-300 p-5 space-y-3 shadow-sm">
              <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
                <span className="font-extrabold text-gray-900 text-xs sm:text-sm uppercase tracking-wide">
                  (7) Verification & Resolution Questions
                </span>
              </div>
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-100 font-extrabold text-center uppercase tracking-wider text-[11px] border-b border-gray-200">
                    <tr>
                      <th className="p-2.5 text-left">Audit Check Criteria</th>
                      <th className="p-2.5 w-10 border-l border-gray-200">Y</th>
                      <th className="p-2.5 w-10 border-l border-gray-200">N</th>
                      <th className="p-2.5 w-12 border-l border-gray-200">N/A</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {[
                      { key: "q1", text: "Has the Drawing been updated?" },
                      { key: "q2", text: "Has the Work instruction, SOP/PFD been updated?" },
                      { key: "q3", text: "Has the Product Quality Standard been updated?" },
                      { key: "q4", text: "Have Prints, Check Sheets or other forms been updated?" },
                      { key: "q5", text: "Have the PFMEA and Control Plans been updated?" },
                      { key: "q6", text: "The results/changes were communicated to all affected Team Members?" },
                    ].map((q) => (
                      <tr key={q.key} className="hover:bg-gray-50/50">
                        <td className="p-2 font-medium text-gray-800">{q.text}</td>
                        {["Y", "N", "N/A"].map((opt) => (
                          <td key={opt} className="p-2 text-center border-l border-gray-200">
                            <input
                              type="radio"
                              disabled={isFormLocked}
                              name={q.key}
                              checked={verification[q.key] === opt}
                              onChange={() => setVerification({ ...verification, [q.key]: opt })}
                              className="w-3.5 h-3.5 text-orange-600 focus:ring-orange-500 cursor-pointer"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-300 p-5 space-y-3 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 border-b border-gray-200 pb-2 mb-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
                  <span className="font-extrabold text-gray-900 text-xs sm:text-sm uppercase tracking-wide">
                    (7a) Lessons Learned
                  </span>
                </div>
                <textarea
                  rows={5}
                  disabled={isFormLocked}
                  className="w-full border border-gray-300 p-3 rounded-lg text-xs bg-gray-50/40 focus:bg-white font-medium outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 disabled:bg-gray-100 disabled:text-gray-700 transition-all resize-y"
                  placeholder="Document key insights gained..."
                  value={verification.lessonsLearned}
                  onChange={(e) => setVerification({ ...verification, lessonsLearned: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* ISSUE RESOLVED SATISFACTORILY BAR */}
          <div className="bg-gray-50/80 rounded-xl border border-gray-300 p-4 flex flex-wrap items-center justify-between gap-4 text-xs font-semibold shadow-sm">
            <div className="flex items-center gap-4">
              <span className="font-bold text-gray-900">Issue Resolved satisfactorily?</span>
              <label className={`flex items-center gap-1.5 font-bold ${isFormLocked ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}>
                <input
                  type="radio"
                  disabled={isFormLocked}
                  name="issueResolved"
                  checked={verification.issueResolved === "Yes"}
                  onChange={() => setVerification({ ...verification, issueResolved: "Yes" })}
                  className="w-3.5 h-3.5 text-orange-600 focus:ring-orange-500"
                />
                Yes
              </label>
              <label className={`flex items-center gap-1.5 font-bold ${isFormLocked ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}>
                <input
                  type="radio"
                  disabled={isFormLocked}
                  name="issueResolved"
                  checked={verification.issueResolved === "No"}
                  onChange={() => setVerification({ ...verification, issueResolved: "No" })}
                  className="w-3.5 h-3.5 text-orange-600 focus:ring-orange-500"
                />
                No
              </label>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-700">Date Closed:</span>
              <input
                type="date"
                disabled={isFormLocked}
                className="border border-gray-300 p-1.5 rounded-lg text-xs bg-white disabled:bg-gray-100 disabled:text-gray-700 cursor-pointer outline-none focus:border-orange-500"
                value={verification.dateClosed || ""}
                onChange={(e) => setVerification({ ...verification, dateClosed: e.target.value })}
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-700">Assigned To:</span>
              <input
                type="text"
                disabled={isFormLocked}
                placeholder="Assigned person"
                className="border border-gray-300 p-1.5 rounded-lg text-xs bg-white disabled:bg-gray-100 disabled:text-gray-700 w-36 outline-none focus:border-orange-500"
                value={verification.assignedTo || ""}
                onChange={(e) => setVerification({ ...verification, assignedTo: e.target.value })}
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-700">Tracking #:</span>
              <input
                type="text"
                disabled={isFormLocked}
                placeholder="Tracking number"
                className="border border-gray-300 p-1.5 rounded-lg text-xs bg-white disabled:bg-gray-100 disabled:text-gray-700 w-36 outline-none focus:border-orange-500"
                value={verification.trackingNo || ""}
                onChange={(e) => setVerification({ ...verification, trackingNo: e.target.value })}
              />
            </div>
          </div>

          {/* (7b) EFFECTIVENESS & (7c) HORIZONTAL DEPLOYMENT */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-300 p-5 space-y-3 shadow-sm">
              <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
                <span className="font-extrabold text-gray-900 text-xs sm:text-sm uppercase tracking-wide">
                  (7b) Effectiveness Monitoring (up to 3 months)
                </span>
              </div>
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="w-full text-center text-xs">
                  <thead className="bg-gray-100 font-extrabold uppercase tracking-wider text-[11px] border-b border-gray-200">
                    <tr>
                      <th className="p-2.5 w-1/4 text-left">Metric</th>
                      <th className="p-2.5 w-1/4 border-l border-gray-200">Month 1</th>
                      <th className="p-2.5 w-1/4 border-l border-gray-200">Month 2</th>
                      <th className="p-2.5 w-1/4 border-l border-gray-200">Month 3</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    <tr>
                      <td className="p-2 font-bold bg-gray-50 text-left text-gray-700">Month</td>
                      {[0, 1, 2].map((idx) => (
                        <td key={`month-${idx}`} className="p-1 border-l border-gray-200">
                          <input
                            type="text"
                            disabled={isFormLocked}
                            placeholder={`Month ${idx + 1}`}
                            className="w-full text-center outline-none text-xs font-semibold p-1 bg-transparent focus:bg-white rounded disabled:bg-gray-100 disabled:text-gray-700"
                            value={verification.effectiveness?.[idx]?.month || ""}
                            onChange={(e) => {
                              const eff = [...(verification.effectiveness || [{ month: "", rejQty: "", rejPct: "" }, { month: "", rejQty: "", rejPct: "" }, { month: "", rejQty: "", rejPct: "" }])];
                              eff[idx] = { ...eff[idx], month: e.target.value };
                              setVerification({ ...verification, effectiveness: eff });
                            }}
                          />
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="p-2 font-bold bg-gray-50 text-left text-gray-700">Rej Qty</td>
                      {[0, 1, 2].map((idx) => (
                        <td key={`rejQty-${idx}`} className="p-1 border-l border-gray-200">
                          <input
                            type="text"
                            disabled={isFormLocked}
                            placeholder="0"
                            className="w-full text-center outline-none text-xs font-semibold p-1 bg-transparent focus:bg-white rounded disabled:bg-gray-100 disabled:text-gray-700"
                            value={verification.effectiveness?.[idx]?.rejQty || ""}
                            onChange={(e) => {
                              const eff = [...(verification.effectiveness || [{ month: "", rejQty: "", rejPct: "" }, { month: "", rejQty: "", rejPct: "" }, { month: "", rejQty: "", rejPct: "" }])];
                              eff[idx] = { ...eff[idx], rejQty: e.target.value };
                              setVerification({ ...verification, effectiveness: eff });
                            }}
                          />
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="p-2 font-bold bg-gray-50 text-left text-gray-700">Rej %</td>
                      {[0, 1, 2].map((idx) => (
                        <td key={`rejPct-${idx}`} className="p-1 border-l border-gray-200">
                          <input
                            type="text"
                            disabled={isFormLocked}
                            placeholder="0%"
                            className="w-full text-center outline-none text-xs font-semibold p-1 bg-transparent focus:bg-white rounded disabled:bg-gray-100 disabled:text-gray-700"
                            value={verification.effectiveness?.[idx]?.rejPct || ""}
                            onChange={(e) => {
                              const eff = [...(verification.effectiveness || [{ month: "", rejQty: "", rejPct: "" }, { month: "", rejQty: "", rejPct: "" }, { month: "", rejQty: "", rejPct: "" }])];
                              eff[idx] = { ...eff[idx], rejPct: e.target.value };
                              setVerification({ ...verification, effectiveness: eff });
                            }}
                          />
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-300 p-5 space-y-3 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 border-b border-gray-200 pb-2 mb-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
                  <span className="font-extrabold text-gray-900 text-xs sm:text-sm uppercase tracking-wide">
                    (7c) Horizontal Deployment
                  </span>
                </div>
                <textarea
                  rows={4}
                  disabled={isFormLocked}
                  className="w-full border border-gray-300 p-3 rounded-lg text-xs bg-gray-50/40 focus:bg-white font-medium outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 disabled:bg-gray-100 disabled:text-gray-700 transition-all resize-y"
                  placeholder="Detail horizontal expansion to other lines/machines..."
                  value={verification.horizontalDeployment || ""}
                  onChange={(e) => setVerification({ ...verification, horizontalDeployment: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* (8) CLOSURE SIGN-OFF SECTION */}
          <div className="bg-white rounded-xl border border-gray-300 p-5 space-y-3 shadow-sm">
            <div className="flex justify-between items-center border-b border-gray-200 pb-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
                <span className="font-extrabold text-gray-900 text-xs sm:text-sm uppercase tracking-wide">
                  (8) Closure Sign-off Matrix
                </span>
              </div>
              <span className="font-bold text-gray-500 uppercase tracking-wider text-[11px]">Shift-wise Approvals</span>
            </div>

            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full text-center text-xs min-w-[700px]">
                <thead className="bg-gray-100 font-extrabold text-gray-800 uppercase tracking-wider text-[11px] border-b border-gray-200">
                  <tr>
                    <th className="p-3 w-[15%]">Shift</th>
                    <th className="p-3 w-[45%] text-left border-l border-gray-200">Team Members Involved</th>
                    <th className="p-3 w-[20%] border-l border-gray-200">Team / Group Leader</th>
                    <th className="p-3 w-[20%] border-l border-gray-200">Production / Quality Head</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {(verification.closureSignOff || [
                    { shift: "1ST", teamMembers: "", teamLeader: "", prodQualityHead: "" },
                    { shift: "2ND", teamMembers: "", teamLeader: "", prodQualityHead: "" },
                    { shift: "3RD", teamMembers: "", teamLeader: "", prodQualityHead: "" },
                  ]).map((row, sIdx) => (
                    <tr key={`closure-${sIdx}`} className="hover:bg-gray-50/50">
                      <td className="p-2 font-bold bg-gray-50 text-gray-800">
                        <input
                          type="text"
                          disabled={isFormLocked}
                          className="w-full text-center outline-none text-xs font-bold bg-transparent disabled:bg-gray-100 disabled:text-gray-700"
                          value={row.shift || ""}
                          placeholder={`Shift ${sIdx + 1}`}
                          onChange={(e) => {
                            const cso = [...(verification.closureSignOff || [])];
                            cso[sIdx] = { ...cso[sIdx], shift: e.target.value };
                            setVerification({ ...verification, closureSignOff: cso });
                          }}
                        />
                      </td>
                      <td className="p-1 text-left border-l border-gray-200">
                        <input
                          type="text"
                          disabled={isFormLocked}
                          className="w-full outline-none text-xs px-2 py-1 bg-transparent focus:bg-white rounded disabled:bg-gray-100 disabled:text-gray-700"
                          placeholder="Names of team members involved..."
                          value={row.teamMembers || ""}
                          onChange={(e) => {
                            const cso = [...(verification.closureSignOff || [])];
                            cso[sIdx] = { ...cso[sIdx], teamMembers: e.target.value };
                            setVerification({ ...verification, closureSignOff: cso });
                          }}
                        />
                      </td>
                      <td className="p-1 border-l border-gray-200">
                        <input
                          type="text"
                          disabled={isFormLocked}
                          className="w-full text-center outline-none text-xs py-1 bg-transparent focus:bg-white rounded disabled:bg-gray-100 disabled:text-gray-700"
                          placeholder="Signature / Name"
                          value={row.teamLeader || ""}
                          onChange={(e) => {
                            const cso = [...(verification.closureSignOff || [])];
                            cso[sIdx] = { ...cso[sIdx], teamLeader: e.target.value };
                            setVerification({ ...verification, closureSignOff: cso });
                          }}
                        />
                      </td>
                      <td className="p-1 border-l border-gray-200">
                        <input
                          type="text"
                          disabled={isFormLocked}
                          className="w-full text-center outline-none text-xs py-1 bg-transparent focus:bg-white rounded disabled:bg-gray-100 disabled:text-gray-700"
                          placeholder="Signature / Name"
                          value={row.prodQualityHead || ""}
                          onChange={(e) => {
                            const cso = [...(verification.closureSignOff || [])];
                            cso[sIdx] = { ...cso[sIdx], prodQualityHead: e.target.value };
                            setVerification({ ...verification, closureSignOff: cso });
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* SYSTEM DIGITAL SIGNATURES & VERIFICATION WORKFLOW */}
        <div className="bg-white rounded-xl border border-gray-300 p-5 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
            <span className="font-extrabold text-gray-900 text-xs sm:text-sm uppercase tracking-wide">
              Authorization & Multi-Role Verification Matrix
            </span>
          </div>

          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="w-full text-xs text-center min-w-[800px]">
              <thead>
                <tr className="bg-gray-100 font-extrabold text-gray-800 uppercase tracking-wider text-[11px] border-b border-gray-200">
                  <th className="p-3 w-1/4">SHIFT SUPERVISOR (PRODUCTION)</th>
                  <th className="p-3 w-1/4 border-l border-gray-200">SHIFT SUPERVISOR (QUALITY)</th>
                  <th className="p-3 w-1/4 border-l border-gray-200">PRODUCTION ENGINEER</th>
                  <th className="p-3 w-1/4 border-l border-gray-200">HOF - PRODUCTION</th>
                </tr>
              </thead>
              <tbody>
                <tr className="h-20">
                  {/* 1. Shift Supervisor (Production) */}
                  <td className="p-3 text-center align-middle bg-gray-50/30">
                    {isSupervisorProductionApproved ? (
                      <div className="flex flex-col items-center justify-center animate-in fade-in duration-200">
                        <span className="text-[10px] font-bold text-green-600 uppercase tracking-wider">
                          Approved By ✓
                        </span>
                        <span className="text-xs font-black text-gray-900 uppercase mt-0.5">
                          {signatures.shiftSupervisorProduction}
                        </span>
                      </div>
                    ) : isShiftIncharge ? (
                      <button
                        type="button"
                        onClick={handleApproveSupervisorProduction}
                        className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-5 py-2 rounded-lg shadow hover:shadow-md transition-all uppercase tracking-wider cursor-pointer"
                      >
                        Approve
                      </button>
                    ) : (
                      <span className="text-gray-400 text-xs italic font-medium">
                        Pending Shift Incharge
                      </span>
                    )}
                  </td>

                  {/* 2. Shift Supervisor (Quality) */}
                  <td className="p-3 text-center align-middle bg-gray-50/30 border-l border-gray-200">
                    {isQcApproved ? (
                      <div className="flex flex-col items-center justify-center animate-in fade-in duration-200">
                        <span className="text-[10px] font-bold text-green-600 uppercase tracking-wider">
                          Approved By ✓
                        </span>
                        <span className="text-xs font-black text-gray-900 uppercase mt-0.5">
                          approved by {signatures.shiftSupervisorQuality}
                        </span>
                      </div>
                    ) : isQC ? (
                      <div className="flex flex-col items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={handleApproveQc}
                          className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-5 py-2 rounded-lg shadow uppercase tracking-wider cursor-pointer transition-all"
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
                        <span className="text-red-600 text-xs font-bold uppercase tracking-wider">
                          pending
                        </span>
                        {header.assignedQc && (
                          <span className="text-[10px] font-bold text-gray-500 uppercase mt-0.5">
                            (Assigned: {header.assignedQc})
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1 w-full max-w-xs mx-auto">
                        <select
                          className="w-full bg-white border border-gray-300 p-2 rounded-lg font-bold text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-center disabled:bg-gray-100 cursor-pointer transition-all"
                          value={header.assignedQc || ""}
                          onChange={(e) => setHeader({ ...header, assignedQc: e.target.value })}
                          disabled={isSavedRecord}
                        >
                          <option value="">-- Select QC Incharge --</option>
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
                  <td className="p-3 text-center align-middle bg-gray-50/30 border-l border-gray-200">
                    {isPeApproved ? (
                      <div className="flex flex-col items-center justify-center animate-in fade-in duration-200">
                        <span className="text-[10px] font-bold text-green-600 uppercase tracking-wider">
                          Approved By ✓
                        </span>
                        <span className="text-xs font-black text-gray-900 uppercase mt-0.5">
                          approved by {signatures.productionEngineer}
                        </span>
                      </div>
                    ) : isPE ? (
                      <div className="flex flex-col items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={handleApprovePe}
                          className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-5 py-2 rounded-lg shadow uppercase tracking-wider cursor-pointer transition-all"
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
                        <span className="text-red-600 text-xs font-bold uppercase tracking-wider">
                          pending
                        </span>
                        {header.assignedPe && (
                          <span className="text-[10px] font-bold text-gray-500 uppercase mt-0.5">
                            (Assigned: {header.assignedPe})
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1 w-full max-w-xs mx-auto">
                        <select
                          className="w-full bg-white border border-gray-300 p-2 rounded-lg font-bold text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-center disabled:bg-gray-100 cursor-pointer transition-all"
                          value={header.assignedPe || ""}
                          onChange={(e) => setHeader({ ...header, assignedPe: e.target.value })}
                          disabled={isSavedRecord}
                        >
                          <option value="">-- Select PE Incharge --</option>
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
                  <td className="p-3 text-center align-middle bg-gray-50/30 border-l border-gray-200">
                    {isHofApproved ? (
                      <div className="flex flex-col items-center justify-center animate-in fade-in duration-200">
                        <span className="text-[10px] font-bold text-green-600 uppercase tracking-wider">
                          Approved By ✓
                        </span>
                        <span className="text-xs font-black text-gray-900 uppercase mt-0.5">
                          approved by {signatures.hofProduction}
                        </span>
                      </div>
                    ) : isHOF ? (
                      <div className="flex flex-col items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={handleApproveHof}
                          className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-5 py-2 rounded-lg shadow uppercase tracking-wider cursor-pointer transition-all"
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
                        <span className="text-red-600 text-xs font-bold uppercase tracking-wider">
                          pending
                        </span>
                        {header.assignedHof && (
                          <span className="text-[10px] font-bold text-gray-500 uppercase mt-0.5">
                            (Assigned: {header.assignedHof})
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1 w-full max-w-xs mx-auto">
                        <select
                          className="w-full bg-white border border-gray-300 p-2 rounded-lg font-bold text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-center disabled:bg-gray-100 cursor-pointer transition-all"
                          value={header.assignedHof || ""}
                          onChange={(e) => setHeader({ ...header, assignedHof: e.target.value })}
                          disabled={isSavedRecord}
                        >
                          <option value="">-- Select HOF Incharge --</option>
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
        </div>

        {/* SUBMIT BUTTON */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t border-gray-200">
          <span className="text-xs text-gray-500 font-semibold text-center sm:text-left">{qfValue}</span>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || saveSuccess || (isSavedRecord && isShiftIncharge)}
            className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white px-9 py-3.5 rounded-xl font-black shadow-lg hover:shadow-orange-500/25 flex items-center justify-center gap-2 uppercase tracking-wider text-xs sm:text-sm transition-all cursor-pointer active:scale-95"
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