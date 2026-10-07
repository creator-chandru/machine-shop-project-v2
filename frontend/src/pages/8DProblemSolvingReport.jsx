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

// Status Quadrant Icon (1: Identified, 2: Implemented, 3: Feedback, 4: Closed)
const StatusQuadrantIcon = ({ level = 1, onChange, editable = true }) => {
  return (
    <div 
      className={`inline-flex items-center justify-center cursor-pointer select-none`}
      onClick={() => {
        if (!editable) return;
        const next = (level % 4) + 1;
        onChange?.(next);
      }}
      title={`Click to cycle: Level ${level}/4`}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" className="transform -rotate-90">
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
  });

  // 1. Team Members (6 Slots)
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

  // 2b. Process Flow / Sketch Blocks
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

  // 4. Fishbone Cause & Effect Diagram (4M)
  const [fishbone, setFishbone] = useState({
    man: ["WRONG PROGRAM CHANGED", "WRONG OFFSET GIVEN", "WRONG TOOL CHANGE"],
    machine: ["Z AXIS VARIATION", "POOR COOLANT FLOW", "TOOL SHAKE"],
    method: ["TOOL FACE OUT", "JIG/FIX LOOSE", "CUTTER MOUNTING LOOSEN"],
    material: ["PART HARDNESS PROBLEM"],
    problem: "ABS DISTANCE UNDER SIZE PROBLEM",
  });

  // 4a. Validation of Potential Causes
  const [validationRows, setValidationRows] = useState([
    { testSimulation: "WRONG PROGRAM CHANGED", verification: "EXISTING PROGRAM NO VERIFIED WITH SOP FOUND OK", date: getTodayISODate(), significant: "INSIGNIFICANT", remarks: "" },
    { testSimulation: "TOOL FACE OUT", verification: "ABS MILLING CUTTER RUN OUT (0.1MM) FACE OUT NOTIFIED", date: getTodayISODate(), significant: "SIGNIFICANT", remarks: "" },
  ]);

  // 4b. 5-Why Analysis
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

  // 5 & 5a. Developing Solution & Trial Run
  const [solution, setSolution] = useState({
    developingSolution: "",
    trialRun: "",
    trialRunDate: getTodayISODate(),
    trialRunSequence: "",
  });

  // 6. Permanent Corrective Actions
  const [correctiveActions, setCorrectiveActions] = useState([
    { type: "Occurrence", action: "EVERY MILLING INSERT CHANGED, INSERT FACE OUT CHECKED IN PRESETTER UNIT SYSTEM INTRODUCED", who: "LINE INCHARGES", dueDate: getTodayISODate(), breakPoint: getTodayISODate(), status: 4 },
    { type: "Detection", action: "AFTER TOOL CHANGE PART QUALIFY MUST BE CHECKED AS PER PROCESS SHEET AND RECORD IN TOOL CHANGE RECORD", who: "LINE INCHARGES", dueDate: getTodayISODate(), breakPoint: getTodayISODate(), status: 4 },
    { type: "System", action: "", who: "", dueDate: "", breakPoint: "", status: 1 },
  ]);

  // 7. Verification Questions & Lessons
  const [verification, setVerification] = useState({
    q1: "N/A", // Drawing updated
    q2: "Y",   // Work instruction / SOP updated
    q3: "Y",   // Product Quality Standard updated
    q4: "Y",   // Prints / Check sheets updated
    q5: "Y",   // PFMEA updated
    q6: "Y",   // Changes communicated
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

  // 8. Signatures & Approvals
  const [signatures, setSignatures] = useState({
    teamLeader: "",
    productionHead: "",
    qualityHead: "",
    shiftIncharge: "",
  });

  // Load Record Data
  const loadRecordData = (record) => {
    if (!record) return;
    setIsSavedRecord(true);
    if (record.header) setHeader(record.header);
    if (record.teamMembers) setTeamMembers(record.teamMembers);
    if (record.problemScope) setProblemScope(record.problemScope);
    if (record.emergencyActions) setEmergencyActions(record.emergencyActions);
    if (record.problemDescription) setProblemDescription(record.problemDescription);
    if (record.processFlow) setProcessFlow(record.processFlow);
    if (record.interimActions) setInterimActions(record.interimActions);
    if (record.fishbone) setFishbone(record.fishbone);
    if (record.validationRows) setValidationRows(record.validationRows);
    if (record.fiveWhy) setFiveWhy(record.fiveWhy);
    if (record.solution) setSolution(record.solution);
    if (record.correctiveActions) setCorrectiveActions(record.correctiveActions);
    if (record.verification) setVerification(record.verification);
    if (record.signatures) setSignatures(record.signatures);
  };

  // Check Existing Record
  const checkExistingRecord = async (customer, partNo, date) => {
    if (!customer && !partNo) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${process.env.REACT_APP_API_URL || ""}/api/8d-report?machineShop=${shopId || 3}&customer=${encodeURIComponent(customer || "")}&partNo=${encodeURIComponent(partNo || "")}&date=${encodeURIComponent(date || "")}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          loadRecordData(data[0]);
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
      const qCust = searchParams.get("customer");
      if (qPart || qCust) {
        checkExistingRecord(qCust, qPart, header.date);
      }
    }
  }, [location.state, searchParams]);

  // Cause helper
  const addFishboneCause = (category) => {
    setFishbone((prev) => ({
      ...prev,
      [category]: [...prev[category], ""],
    }));
  };

  const updateFishboneCause = (category, index, val) => {
    setFishbone((prev) => {
      const updated = [...prev[category]];
      updated[index] = val;
      return { ...prev, [category]: updated };
    });
  };

  const removeFishboneCause = (category, index) => {
    setFishbone((prev) => {
      const updated = prev[category].filter((_, i) => i !== index);
      return { ...prev, [category]: updated };
    });
  };

  // PDF Preview
  const handleDownloadPdf = async () => {
    try {
      const token = localStorage.getItem("token");
      const params = new URLSearchParams({
        shopId: String(shopId || 3),
        date: header.date,
        customer: header.customer,
        partNo: header.partNo,
      });

      const res = await fetch(
        `${process.env.REACT_APP_API_URL || ""}/api/8d-report/pdf?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error("Failed to generate PDF");

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `8D_Report_${header.customer || "Auto"}_${header.partNo || "Part"}_${header.date}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      triggerToast("PDF generated successfully!", "success");
    } catch (err) {
      triggerToast("PDF Download Failed", "error");
    }
  };

  // Save / Submit
  const handleSave = async () => {
    if (!header.customer || !header.partNo) {
      triggerToast("Please enter Customer and Part No.", "error");
      return;
    }

    const token = localStorage.getItem("token");
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
        ...signatures,
        shiftIncharge: signatures.shiftIncharge || currentUsername,
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
    } catch (err) {
      setIsSaving(false);
      triggerToast(err.message || "Failed to save record", "error");
    }
  };

  return (
    <div className="min-h-screen bg-[#2d2d2d] flex flex-col items-center justify-center p-4 md:p-6 pb-20">
      <Header />
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: "", type: "" })} />

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
            <FileDown className="w-4 h-4" /> Preview PDF
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
                  onChange={(e) => setHeader({ ...header, date: e.target.value })}
                />
                <select
                  className="w-1/2 border border-gray-300 p-1.5 rounded font-semibold bg-white"
                  value={header.shift}
                  onChange={(e) => setHeader({ ...header, shift: e.target.value })}
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
                className="w-full border border-gray-300 p-1.5 rounded font-semibold bg-white"
                placeholder="e.g. STELLANTIS"
                value={header.customer}
                onChange={(e) => setHeader({ ...header, customer: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div>
              <label className="font-bold text-gray-700 block mb-1">Part Name</label>
              <input
                type="text"
                className="w-full border border-gray-300 p-1.5 rounded font-semibold bg-white"
                placeholder="e.g. PIVOT SUSPENSION GOA CC21 (078) LH / RH"
                value={header.partName}
                onChange={(e) => setHeader({ ...header, partName: e.target.value })}
              />
            </div>

            <div>
              <label className="font-bold text-gray-700 block mb-1">Part No.</label>
              <input
                type="text"
                className="w-full border border-gray-300 p-1.5 rounded font-semibold bg-white"
                placeholder="e.g. 9845800980 & 9845801180 / 001"
                value={header.partNo}
                onChange={(e) => setHeader({ ...header, partNo: e.target.value })}
              />
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
                    onClick={() => setHeader({ ...header, category: cat })}
                    className={`py-1 px-2 border rounded ${
                      header.category === cat
                        ? "bg-orange-600 text-white border-orange-600"
                        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
                    }`}
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
                  <label key={p} className="flex items-center gap-1 cursor-pointer font-semibold">
                    <input
                      type="radio"
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
                placeholder={`Member ${idx + 1}`}
                className="border border-gray-300 p-1.5 rounded text-xs font-medium bg-white"
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
          {/* 2 & 2a */}
          <div className="border border-gray-300 p-4 rounded-lg space-y-3 bg-gray-50">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-xs font-bold uppercase text-gray-800">(2) Problem Scope:</h3>
              <div className="flex gap-4 text-xs font-semibold">
                {["New", "Repeated", "Reopened"].map((sc) => (
                  <label key={sc} className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
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
                        className="w-full text-center p-1 bg-white outline-none"
                        value={emergencyActions.segregationCustomerQty}
                        onChange={(e) => setEmergencyActions({ ...emergencyActions, segregationCustomerQty: e.target.value })}
                      />
                    </td>
                    <td className="border p-0">
                      <input
                        type="text"
                        className="w-full text-center p-1 bg-white outline-none"
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
                        className="w-full text-center p-1 bg-white outline-none"
                        value={emergencyActions.segregationFGQty}
                        onChange={(e) => setEmergencyActions({ ...emergencyActions, segregationFGQty: e.target.value })}
                      />
                    </td>
                    <td className="border p-0">
                      <input
                        type="text"
                        className="w-full text-center p-1 bg-white outline-none"
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
                        className="w-full text-center p-1 bg-white outline-none"
                        value={emergencyActions.segregationWIPQty}
                        onChange={(e) => setEmergencyActions({ ...emergencyActions, segregationWIPQty: e.target.value })}
                      />
                    </td>
                    <td className="border p-0">
                      <input
                        type="text"
                        className="w-full text-center p-1 bg-white outline-none"
                        value={emergencyActions.segregationWIPNotOk}
                        onChange={(e) => setEmergencyActions({ ...emergencyActions, segregationWIPNotOk: e.target.value })}
                      />
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="flex items-center gap-4 text-xs font-semibold">
                <span>Is Customer visit required?</span>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name="visit"
                    checked={emergencyActions.customerVisitRequired === "Yes"}
                    onChange={() => setEmergencyActions({ ...emergencyActions, customerVisitRequired: "Yes" })}
                  />
                  Yes
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name="visit"
                    checked={emergencyActions.customerVisitRequired === "No"}
                    onChange={() => setEmergencyActions({ ...emergencyActions, customerVisitRequired: "No" })}
                  />
                  No
                </label>
              </div>
            </div>

            {/* (2a) Problem Description */}
            <div className="pt-2 border-t">
              <h3 className="text-xs font-bold uppercase text-gray-800 mb-1">(2a) Problem Description:</h3>
              <textarea
                rows={3}
                className="w-full border border-gray-300 p-2 rounded text-xs bg-white font-medium outline-none focus:ring-1 focus:ring-orange-500"
                placeholder="Describe the problem in detail (e.g. M3L017 CC21-SK ABS DISTANCE UNDER SIZE PROBLEM)..."
                value={problemDescription}
                onChange={(e) => setProblemDescription(e.target.value)}
              />
            </div>
          </div>

          {/* (2b) Process Flow Diagram Builder */}
          <div className="border border-gray-300 p-4 rounded-lg bg-gray-50 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-xs font-bold uppercase text-gray-800">(2b) Sketch / Process Flow:</h3>
                <button
                  type="button"
                  onClick={() => setProcessFlow([...processFlow, "NEW OP"])}
                  className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Step
                </button>
              </div>

              {/* Visual flow boxes */}
              <div className="flex flex-wrap items-center gap-2 p-3 bg-white border border-gray-200 rounded min-h-[140px]">
                {processFlow.map((step, sIdx) => (
                  <React.Fragment key={`step-${sIdx}`}>
                    <div className="relative group border-2 border-gray-800 rounded px-2 py-1 text-[11px] font-bold text-center bg-gray-50 min-w-[90px] max-w-[140px]">
                      <input
                        type="text"
                        value={step}
                        onChange={(e) => {
                          const updated = [...processFlow];
                          updated[sIdx] = e.target.value;
                          setProcessFlow(updated);
                        }}
                        className="w-full bg-transparent text-center outline-none text-[10px] font-bold uppercase"
                      />
                      {processFlow.length > 1 && (
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
              * Click and edit each process step box above. Arrows indicate flow direction.
            </span>
          </div>
        </div>

        {/* (3) INTERIM CONTAINMENT ACTION */}
        <div className="border border-gray-300 p-4 rounded-lg bg-gray-50">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-xs font-bold uppercase text-gray-800">(3) Interim containment action:</h3>
            <button
              type="button"
              onClick={() => setInterimActions([...interimActions, { action: "", who: "", dueDate: getTodayISODate(), breakPoint: getTodayISODate() }])}
              className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add Row
            </button>
          </div>

          <table className="w-full text-xs border border-gray-300 text-center">
            <thead className="bg-gray-200 font-bold">
              <tr>
                <th className="border p-2 w-[50%]">Action Description</th>
                <th className="border p-2 w-[20%]">Who</th>
                <th className="border p-2 w-[15%]">Due Date</th>
                <th className="border p-2 w-[15%]">Break Point</th>
                <th className="border p-2 w-[5%]">Del</th>
              </tr>
            </thead>
            <tbody>
              {interimActions.map((row, idx) => (
                <tr key={`interim-${idx}`} className="bg-white">
                  <td className="border p-1 text-left">
                    <input
                      type="text"
                      className="w-full outline-none font-medium text-xs px-1"
                      placeholder="e.g. All available parts are rechecked with qualifying fixture 100%"
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
                      className="w-full text-center outline-none font-medium text-xs"
                      placeholder="Person / Role"
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
                      className="w-full text-center outline-none font-medium text-xs bg-transparent"
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
                      className="w-full text-center outline-none font-medium text-xs bg-transparent"
                      value={row.breakPoint}
                      onChange={(e) => {
                        const updated = [...interimActions];
                        updated[idx].breakPoint = e.target.value;
                        setInterimActions(updated);
                      }}
                    />
                  </td>
                  <td className="border p-1">
                    <button
                      type="button"
                      onClick={() => setInterimActions(interimActions.filter((_, i) => i !== idx))}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-3.5 h-3.5 mx-auto" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* (4) ROOT CAUSE ANALYSIS - ISHIKAWA CAUSE & EFFECT DIAGRAM (4M) */}
        <div className="border border-gray-300 p-4 rounded-lg bg-gray-50 space-y-4">
          <h3 className="text-xs font-bold uppercase text-gray-800">
            (4) Root cause analysis - Cause & Effect Diagram (4M):
          </h3>

          {/* Interactive Fishbone SVG Canvas */}
          <div className="w-full bg-white border-2 border-gray-800 rounded-lg p-4 overflow-x-auto min-h-[380px] flex items-center justify-center">
            <svg viewBox="0 0 900 360" className="w-full max-w-[860px] h-auto select-none">
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#1f2937" />
                </marker>
              </defs>

              {/* Main Spine Spine Line */}
              <line x1="40" y1="180" x2="700" y2="180" stroke="#1f2937" strokeWidth="3" markerEnd="url(#arrow)" />

              {/* MAN Branch (Top Left) */}
              <line x1="160" y1="60" x2="260" y2="180" stroke="#1f2937" strokeWidth="2.5" />
              <text x="135" y="50" fontWeight="bold" fontSize="13" fill="#1f2937">MAN</text>
              {fishbone.man.map((cause, i) => (
                <g key={`man-${i}`}>
                  <line x1={200 + i * 20 - 90} y1={100 + i * 25} x2={200 + i * 20} y2={100 + i * 25} stroke="#4b5563" strokeWidth="1.5" markerEnd="url(#arrow)" />
                  <text x={200 + i * 20 - 95} y={97 + i * 25} textAnchor="end" fontSize="9" fontWeight="bold" fill="#374151">
                    {cause || "..."}
                  </text>
                </g>
              ))}

              {/* MACHINE Branch (Top Right) */}
              <line x1="400" y1="60" x2="500" y2="180" stroke="#1f2937" strokeWidth="2.5" />
              <text x="375" y="50" fontWeight="bold" fontSize="13" fill="#1f2937">MACHINE</text>
              {fishbone.machine.map((cause, i) => (
                <g key={`mach-${i}`}>
                  <line x1={440 + i * 20 - 90} y1={100 + i * 25} x2={440 + i * 20} y2={100 + i * 25} stroke="#4b5563" strokeWidth="1.5" markerEnd="url(#arrow)" />
                  <text x={440 + i * 20 - 95} y={97 + i * 25} textAnchor="end" fontSize="9" fontWeight="bold" fill="#374151">
                    {cause || "..."}
                  </text>
                </g>
              ))}

              {/* METHOD Branch (Bottom Left) */}
              <line x1="160" y1="300" x2="260" y2="180" stroke="#1f2937" strokeWidth="2.5" />
              <text x="125" y="320" fontWeight="bold" fontSize="13" fill="#1f2937">METHOD</text>
              {fishbone.method.map((cause, i) => (
                <g key={`meth-${i}`}>
                  <line x1={200 + i * 20 - 90} y1={260 - i * 25} x2={200 + i * 20} y2={260 - i * 25} stroke="#4b5563" strokeWidth="1.5" markerEnd="url(#arrow)" />
                  <text x={200 + i * 20 - 95} y={257 - i * 25} textAnchor="end" fontSize="9" fontWeight="bold" fill="#374151">
                    {cause || "..."}
                  </text>
                </g>
              ))}

              {/* MATERIAL Branch (Bottom Right) */}
              <line x1="400" y1="300" x2="500" y2="180" stroke="#1f2937" strokeWidth="2.5" />
              <text x="370" y="320" fontWeight="bold" fontSize="13" fill="#1f2937">MATERIAL</text>
              {fishbone.material.map((cause, i) => (
                <g key={`mat-${i}`}>
                  <line x1={440 + i * 20 - 90} y1={260 - i * 25} x2={440 + i * 20} y2={260 - i * 25} stroke="#4b5563" strokeWidth="1.5" markerEnd="url(#arrow)" />
                  <text x={440 + i * 20 - 95} y={257 - i * 25} textAnchor="end" fontSize="9" fontWeight="bold" fill="#374151">
                    {cause || "..."}
                  </text>
                </g>
              ))}

              {/* Problem Fish Head / Circle */}
              <circle cx="760" cy="180" r="60" stroke="#1f2937" strokeWidth="2.5" fill="#f9fafb" />
              <text x="760" y="105" textAnchor="middle" fontWeight="bold" fontSize="11" fill="#1f2937">PROBLEM</text>
              <foreignObject x="710" y="140" width="100" height="80">
                <div xmlns="http://www.w3.org/1999/xhtml" className="text-[10px] font-bold text-center text-gray-800 leading-tight">
                  {fishbone.problem}
                </div>
              </foreignObject>
            </svg>
          </div>

          {/* Cause Editor Input Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            {["man", "machine", "method", "material"].map((cat) => (
              <div key={cat} className="border border-gray-300 p-2.5 rounded bg-white space-y-1.5">
                <div className="flex justify-between items-center border-b pb-1">
                  <span className="font-bold uppercase text-gray-700">{cat} Causes</span>
                  <button
                    type="button"
                    onClick={() => addFishboneCause(cat)}
                    className="text-orange-600 font-bold hover:text-orange-700 text-[11px]"
                  >
                    + Add
                  </button>
                </div>
                {fishbone[cat].map((cause, cIdx) => (
                  <div key={`${cat}-${cIdx}`} className="flex gap-1 items-center">
                    <input
                      type="text"
                      className="border border-gray-200 p-1 rounded w-full text-[11px] font-medium"
                      value={cause}
                      placeholder={`Enter ${cat} cause`}
                      onChange={(e) => updateFishboneCause(cat, cIdx, e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => removeFishboneCause(cat, cIdx)}
                      className="text-red-500 hover:text-red-700 text-xs px-1"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* (4a) VALIDATION OF POTENTIAL CAUSES */}
        <div className="border border-gray-300 p-4 rounded-lg bg-gray-50">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-xs font-bold uppercase text-gray-800">(4a) Validation of Potential Causes:</h3>
            <button
              type="button"
              onClick={() => setValidationRows([...validationRows, { testSimulation: "", verification: "", date: getTodayISODate(), significant: "INSIGNIFICANT", remarks: "" }])}
              className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add Row
            </button>
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
                      className="w-full font-semibold text-xs outline-none"
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
                      className="w-full font-medium text-xs outline-none"
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
                      className="w-full text-center font-medium text-xs outline-none bg-transparent"
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
                      className={`w-full text-center font-bold text-xs p-0.5 rounded ${
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
                      className="w-full font-medium text-xs outline-none"
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
                            className="w-full text-xs font-medium p-1 outline-none resize-none bg-transparent"
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
                          className="w-[80%] bg-transparent border-b border-orange-300 font-bold text-xs text-gray-800 outline-none"
                          placeholder={`State definitive root cause for ${type}...`}
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

          {/* PFMEA Prediction */}
          <div className="flex flex-wrap items-center gap-6 pt-2 text-xs font-bold text-gray-800">
            <span>PREDICT: Was this failure mode included in the PFMEA?</span>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                name="pfmea"
                checked={fiveWhy.pfmeaIncluded === "YES"}
                onChange={() => setFiveWhy({ ...fiveWhy, pfmeaIncluded: "YES" })}
              />
              YES
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
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
                  className="border border-gray-300 p-1 rounded text-xs font-semibold bg-white"
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
              className="w-full border border-gray-300 p-2 rounded text-xs bg-white font-medium outline-none"
              placeholder="Detail the developed solution..."
              value={solution.developingSolution}
              onChange={(e) => setSolution({ ...solution, developingSolution: e.target.value })}
            />
          </div>

          <div className="border border-gray-300 p-4 rounded-lg bg-gray-50 space-y-2">
            <h3 className="text-xs font-bold uppercase text-gray-800">(5a) Trial Run (Confirmation Trial):</h3>
            <textarea
              rows={2}
              className="w-full border border-gray-300 p-2 rounded text-xs bg-white font-medium outline-none"
              placeholder="e.g. AFTER INSERT CHANGED CONTINUOUSLY 10 SETS QF VERIFIED OK"
              value={solution.trialRun}
              onChange={(e) => setSolution({ ...solution, trialRun: e.target.value })}
            />
            <div className="flex gap-2">
              <div className="w-1/2">
                <label className="text-[10px] font-bold text-gray-600 block">Date</label>
                <input
                  type="date"
                  className="w-full border border-gray-300 p-1 rounded text-xs bg-white font-medium"
                  value={solution.trialRunDate}
                  onChange={(e) => setSolution({ ...solution, trialRunDate: e.target.value })}
                />
              </div>
              <div className="w-1/2">
                <label className="text-[10px] font-bold text-gray-600 block">Sequence #&apos;s</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 p-1 rounded text-xs bg-white font-medium"
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
                      className="w-full outline-none font-medium text-xs px-1"
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
                      className="w-full text-center outline-none font-medium text-xs"
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
                      className="w-full text-center outline-none font-medium text-xs bg-transparent"
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
                      className="w-full text-center outline-none font-medium text-xs bg-transparent"
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

        {/* (7) VERIFICATION & RESOLUTION QUESTIONS + LESSONS */}
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
                className="w-full border border-gray-300 p-2 rounded text-xs bg-white font-medium outline-none"
                placeholder="Document key insights gained (e.g. IF INSERT NOT PROPERLY SEATED, IT AFFECTS PART QUALITY)..."
                value={verification.lessonsLearned}
                onChange={(e) => setVerification({ ...verification, lessonsLearned: e.target.value })}
              />
            </div>

            <div className="pt-2 border-t mt-2">
              <h3 className="text-xs font-bold uppercase text-gray-800 mb-1">(7c) Horizontal Deployment:</h3>
              <textarea
                rows={3}
                className="w-full border border-gray-300 p-2 rounded text-xs bg-white font-medium outline-none"
                placeholder="Detail horizontal expansion to other lines/machines..."
                value={verification.horizontalDeployment}
                onChange={(e) => setVerification({ ...verification, horizontalDeployment: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* (8) CLOSURE SIGN-OFF & APPROVALS */}
        <div className="border border-gray-300 p-4 rounded-lg bg-gray-50 space-y-4">
          <h3 className="text-xs font-bold uppercase text-gray-800">(8) Closure Sign-off & Approvals:</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-center">
            {/* 1. Shift Incharge / Team Leader */}
            <div className="border border-gray-300 p-3 rounded-lg bg-white space-y-2">
              <span className="font-bold block text-gray-700">Team Leader / Shift Incharge</span>
              {signatures.teamLeader ? (
                <div className="text-green-600 font-bold flex items-center justify-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> {signatures.teamLeader}
                </div>
              ) : isShiftIncharge ? (
                <button
                  type="button"
                  onClick={() => setSignatures({ ...signatures, teamLeader: currentUsername })}
                  className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-1.5 px-4 rounded shadow"
                >
                  Sign Off
                </button>
              ) : (
                <span className="text-gray-400 italic">Pending Leader</span>
              )}
            </div>

            {/* 2. Production Head (PE / HOF) */}
            <div className="border border-gray-300 p-3 rounded-lg bg-white space-y-2">
              <span className="font-bold block text-gray-700">Production Head / PE</span>
              {signatures.productionHead ? (
                <div className="text-green-600 font-bold flex items-center justify-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> {signatures.productionHead}
                </div>
              ) : isPE || isHOF ? (
                <button
                  type="button"
                  onClick={() => setSignatures({ ...signatures, productionHead: currentUsername })}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-1.5 px-4 rounded shadow"
                >
                  Approve Production
                </button>
              ) : (
                <span className="text-gray-400 italic">Pending Production</span>
              )}
            </div>

            {/* 3. Quality Head (QC) */}
            <div className="border border-gray-300 p-3 rounded-lg bg-white space-y-2">
              <span className="font-bold block text-gray-700">Quality Head / QC</span>
              {signatures.qualityHead ? (
                <div className="text-green-600 font-bold flex items-center justify-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> {signatures.qualityHead}
                </div>
              ) : isQC ? (
                <button
                  type="button"
                  onClick={() => setSignatures({ ...signatures, qualityHead: currentUsername })}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-1.5 px-4 rounded shadow"
                >
                  Approve Quality
                </button>
              ) : (
                <span className="text-gray-400 italic">Pending Quality</span>
              )}
            </div>
          </div>
        </div>

        {/* SUBMIT BUTTON */}
        <div className="flex justify-end pt-4 border-t border-gray-300">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || saveSuccess}
            className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white px-10 py-3 rounded font-bold transition-colors shadow-lg flex items-center gap-2 uppercase tracking-wider text-sm"
          >
            {isSaving ? "SAVING..." : saveSuccess ? "SAVED ✓" : "Save & Submit 8D Report"}
          </button>
        </div>
      </div>
    </div>
  );
}