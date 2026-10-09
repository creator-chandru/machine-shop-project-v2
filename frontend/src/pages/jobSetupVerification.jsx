import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useLineSet } from "../context/LineSetContext.jsx";
import { ArrowLeft, FileDown, Save } from "lucide-react";
import Header from "../components/Header";

const API = process.env.REACT_APP_API_URL || "";

const formMeta = {
  formCode: "QF/07/MPD-03",
  revision: "03",
  revisionDate: "31.01.2025",
  title: "RECORD OF JOB SETUP VERIFICATION",
  company: "SAKTHI AUTO",
};

const getTodayISODate = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const REASONS = [
  "Item change",
  "M/c change",
  "Fixture change",
  "Significant M/c Breakdown",
  "Operation change",
  "Preventive maintenance",
  "Every 3 months JSV to be done for continuous running line",
];

// keeps disabled (locked) fields readable
const lockedTextCls =
  "[&_input:disabled]:text-gray-900 [&_select:disabled]:text-gray-900 [&_textarea:disabled]:text-gray-900";

const emptySignatures = { inspector: "", shiftIncharge: "", hofInspection: "", hofProduction: "" };

const Toast = ({ message, type, onClose }) => {
  if (!message) return null;
  const bgColor =
    type === "error" ? "bg-red-600" : type === "success" ? "bg-green-600" : "bg-orange-600";
  return (
    <div className={`fixed bottom-6 right-6 z-50 ${bgColor} text-white px-5 py-3 rounded-lg shadow-2xl flex items-center gap-3 animate-bounce`}>
      <span className="text-sm font-semibold">{message}</span>
      <button onClick={onClose} className="ml-2 font-bold text-lg leading-none hover:text-gray-200 focus:outline-none">×</button>
    </div>
  );
};

export default function JobSetupVerification() {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { lineSet, setLineSet } = useLineSet();

  // Role extraction
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  const currentUsername = currentUser?.username || currentUser?.employeeId || "Unknown";
  const currentUserRole = (currentUser?.role || "").toLowerCase();

  const isShiftIncharge =
    currentUserRole === "shiftincharge" ||
    currentUserRole === "supervisor" ||
    currentUserRole === "operator" ||
    currentUserRole === "";

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSavedRecord, setIsSavedRecord] = useState(false);
  const [specsMissing, setSpecsMissing] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "" });

  // Master Data Dropdowns
  const [partSets, setPartSets] = useState([]);
  const [machineDetails, setMachineDetails] = useState([]);
  const [lineMappings, setLineMappings] = useState([]);
  const [loadingMasterData, setLoadingMasterData] = useState(true);

  // Approver dropdown users
  const [qcUsers, setQcUsers] = useState([]);
  const [hofInspnUsers, setHofInspnUsers] = useState([]);
  const [hofUsers, setHofUsers] = useState([]);

  const isSavedRef = useRef(false);
  const rowsRef = useRef([]);
  const lookupSeqRef = useRef(0);

  const triggerToast = (message, type = "error") => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: "", type: "" }), 4000);
  };

  const buildFreshForm = ({ partName = "", partNo = "", date = getTodayISODate() } = {}) => ({
    id: null,
    machineShop: shopId || "3",
    partName,
    partNo,
    operationNo: "",
    operationDescription: "",
    date,
    shift: "1st",
    setterName: isShiftIncharge && currentUsername !== "Unknown" ? currentUsername : "",
    selectedReasons: ["Item change"],
    settingStartedAt: "",
    inspectionTimeStage: "",
    settingFinishedAt: "",
    settingTime: "",
    inspectionTimeMetrology: "",
    totalTime: "",
    runningItem: "",
    runningMachineNo: "",
    runningFixtureNo: "",
    runningOperationChange: "",
    runningSignificantBreakdown: "",
    runningMcNo: "",
    runningDetail: "",
    changeToItem: "",
    changeToMachineNo: "",
    changeToFixtureNo: "",
    changeToOperationChange: "",
    changeToSignificantBreakdown: "",
    assignedQc: "",
    assignedHofInspection: "",
    assignedHof: "",
  });

  // 1. Basic Form Information
  const [form, setForm] = useState(() => buildFreshForm());

  // 2. Inspection rows - ONLY loaded from the master (control + specification); no add / delete
  const [rows, setRows] = useState([]);

  // 3. Signatures State
  const [signatures, setSignatures] = useState(emptySignatures);

  useEffect(() => {
    isSavedRef.current = isSavedRecord;
  }, [isSavedRecord]);

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem("token");
        const headers = { Authorization: `Bearer ${token}` };

        if (shopId) {
          // Fetch from M{shopId}PartSets endpoint
          const partRes = await fetch(`${API}/api/job-setup-verification/parts/${shopId}`, { headers }).catch(() => null);
          if (partRes && partRes.ok) {
            const partData = await partRes.json();
            setPartSets(partData || []);
          }

          const res = await fetch(`${API}/api/machine-shop/${shopId}/details`, { headers }).catch(() => null);
          if (res && res.ok) {
            const data = await res.json();
            setMachineDetails(data || []);
          }
          const mappingRes = await fetch(`${API}/api/mappings/${shopId}/lines`, { headers }).catch(() => null);
          if (mappingRes && mappingRes.ok) {
            const mappingData = await mappingRes.json();
            setLineMappings(mappingData || []);
          }
        }

        const [qcRes, hofInspnRes, hofRes] = await Promise.all([
          fetch(`${API}/api/daily-production-report/incharges`, { headers }).catch(() => null),
          fetch(`${API}/api/job-setup-verification/hof-inspection-users`, { headers }).catch(() => null),
          fetch(`${API}/api/daily-production-report/hof-incharges`, { headers }).catch(() => null),
        ]);

        if (qcRes && qcRes.ok) {
          const data = await qcRes.json();
          setQcUsers(data.qcList || []);
        } else {
          setQcUsers([{ username: "qc" }, { username: "qc1" }]);
        }

        if (hofInspnRes && hofInspnRes.ok) {
          const data = await hofInspnRes.json();
          setHofInspnUsers(data.hofInspectionList || []);
        } else {
          setHofInspnUsers([{ username: "hofinspection" }]);
        }

        if (hofRes && hofRes.ok) {
          const data = await hofRes.json();
          setHofUsers(data.hofList || []);
        } else {
          setHofUsers([{ username: "hof" }]);
        }
      } catch (err) {
        console.error("Master fetch error:", err);
      } finally {
        setLoadingMasterData(false);
      }
    };
    fetchData();
  }, [shopId]);

// Derive distinct Part Names from M{shopId}PartSets
  const partOptions = Array.from(
    new Set(
      partSets.length > 0
        ? partSets.map((p) => p.partName).filter(Boolean)
        : [
            ...machineDetails.map((m) => m.partName).filter(Boolean),
            ...lineMappings.map((m) => m.partSet).filter(Boolean)
          ]
    )
  );
  const operationOptions = [
    "OP-010",
    "OP-020",
    "OP-020 A & OP-20B",
    "OP-030",
    "OP-030A",
    "OP-040",
    "OP-050",
    "OP-060",
    "OP-070",
    "OP-080",
    "OP-090",
  ];

  // Automatic calculation of Setting Time & Total Time
  useEffect(() => {
    if (isSavedRecord) return;
    if (form.settingStartedAt && form.settingFinishedAt) {
      try {
        const [startH, startM] = form.settingStartedAt.split(":").map(Number);
        const [finH, finM] = form.settingFinishedAt.split(":").map(Number);
        if (!isNaN(startH) && !isNaN(finH)) {
          let diffMin = (finH * 60 + (finM || 0)) - (startH * 60 + (startM || 0));
          if (diffMin < 0) diffMin += 24 * 60;
          const hrs = (diffMin / 60).toFixed(2);
          const settingTimeStr = `${hrs} hrs`;

          const metroMatch = String(form.inspectionTimeMetrology).match(/([0-9.]+)/);
          const metroHrs = metroMatch ? parseFloat(metroMatch[1]) : 0;
          const totalTimeStr = `${(parseFloat(hrs) + metroHrs).toFixed(2)} hrs`;

          setForm((prev) => ({
            ...prev,
            settingTime: settingTimeStr,
            totalTime: totalTimeStr,
          }));
        }
      } catch (e) {}
    }
  }, [form.settingStartedAt, form.settingFinishedAt, form.inspectionTimeMetrology, isSavedRecord]);

  // Load an already-submitted record (locked, read only)
  const loadRecordData = (record) => {
    if (!record) return;
    setIsSavedRecord(true);
    setSaveSuccess(true);
    setSpecsMissing(false);
    setForm({
      id: record.Id,
      machineShop: record.MachineShop || shopId || "3",
      partName: record.PartName || "",
      partNo: record.PartNo || "",
      operationNo: record.OperationNo || "",
      operationDescription: record.OperationDescription || "",
      date: record.ReportDateStr || (record.ReportDate ? String(record.ReportDate).split("T")[0] : getTodayISODate()),
      shift: record.Shift || "1st",
      setterName: record.SetterName || "",
      selectedReasons: record.ReasonForSetup ? record.ReasonForSetup.split(",") : ["Item change"],
      settingStartedAt: record.SettingStartedAt || "",
      inspectionTimeStage: record.InspectionTimeStage || "",
      settingFinishedAt: record.SettingFinishedAt || "",
      settingTime: record.SettingTime || "",
      inspectionTimeMetrology: record.InspectionTimeMetrology || "",
      totalTime: record.TotalTime || "",
      runningItem: record.RunningItem || "",
      runningMachineNo: record.RunningMachineNo || "",
      runningFixtureNo: record.RunningFixtureNo || "",
      runningOperationChange: record.RunningOperationChange || "",
      runningSignificantBreakdown: record.RunningSignificantBreakdown || "",
      runningMcNo: record.RunningMcNo || "",
      runningDetail: record.RunningDetail || "",
      changeToItem: record.ChangeToItem || "",
      changeToMachineNo: record.ChangeToMachineNo || "",
      changeToFixtureNo: record.ChangeToFixtureNo || "",
      changeToOperationChange: record.ChangeToOperationChange || "",
      changeToSignificantBreakdown: record.ChangeToSignificantBreakdown || "",
      assignedQc: record.AssignedQc || "",
      assignedHofInspection: record.AssignedHofInspection || "",
      assignedHof: record.AssignedHofProduction || "",
    });

    if (record.ActualInspectionData) {
      try {
        const parsed =
          typeof record.ActualInspectionData === "string"
            ? JSON.parse(record.ActualInspectionData)
            : record.ActualInspectionData;
        if (Array.isArray(parsed)) setRows(parsed);
      } catch (e) {}
    }

    setSignatures({
      inspector: record.Sign_Inspector || "",
      shiftIncharge: record.Sign_ShiftIncharge || "",
      hofInspection: record.Sign_HofInspection || "",
      hofProduction: record.Sign_HofProduction || "",
    });
  };

  // Load the master Control + Specification rows for a part (by part name only)
  const fetchControlSpecifications = async (partName, seq) => {
    if (!partName) {
      setRows([]);
      setSpecsMissing(false);
      return;
    }
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${API}/api/job-setup-verification/specifications?partName=${encodeURIComponent(partName)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (seq !== undefined && seq !== lookupSeqRef.current) return;
      if (res.ok) {
        const data = await res.json();
        const specs = Array.isArray(data.specifications) ? data.specifications : [];
        setRows(
          specs.map((spec, idx) => ({
            slNo: idx + 1,
            controlName: spec.controlName || "",
            specification: spec.specification || "",
            LH1: "",
            RH1: "",
            LH2: "",
            RH2: "",
            LH3: "",
            RH3: "",
            status: "OK",
            remarks: "",
          }))
        );
        setSpecsMissing(specs.length === 0);
        if (specs.length > 0) {
          triggerToast(`Loaded ${specs.length} Control Specifications.`, "success");
        } else {
          triggerToast("No control specifications are set for this part. Ask HOD / HOF to set them up.", "info");
        }
      }
    } catch (err) {
      console.error("Fetch specs error:", err);
    }
  };

  // Look for a filled record for part + date. Found -> locked. Not found -> fresh form.
  const loadSelection = async (partName, partNo, date, forceSpecs = false) => {
    if (!partName || !date) return;
    const seq = ++lookupSeqRef.current;
    let record = null;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${API}/api/job-setup-verification/record?partName=${encodeURIComponent(partName)}&date=${encodeURIComponent(date)}&shopId=${shopId || 3}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        record = data.record || null;
      }
    } catch (err) {
      console.error("Record lookup error:", err);
    }
    if (seq !== lookupSeqRef.current) return;

    if (record) {
      loadRecordData(record);
      return;
    }

    const wasSaved = isSavedRef.current;
    if (wasSaved) {
      setForm(buildFreshForm({ partName, partNo, date }));
      setSignatures(emptySignatures);
    }
    setIsSavedRecord(false);
    setSaveSuccess(false);

    if (forceSpecs || wasSaved || rowsRef.current.length === 0) {
      await fetchControlSpecifications(partName, seq);
    }
  };

  // Part change
  // Part change
  const handlePartNameChange = (val) => {
    const matchedPartSet = partSets.find((p) => p.partName === val);
    const matchedMachine = machineDetails.find((m) => m.partName === val);
    const partNoVal = matchedPartSet?.partId || matchedMachine?.partNo || "";

    setForm((prev) => ({ ...prev, partName: val, partNo: partNoVal }));
    if (setLineSet) {
      setLineSet((prev) => ({ ...prev, partName: val, partNo: partNoVal }));
    }
    if (!val) {
      lookupSeqRef.current += 1;
      setRows([]);
      setSpecsMissing(false);
      if (isSavedRef.current) {
        setForm(buildFreshForm({ partName: "", partNo: "", date: form.date }));
        setSignatures(emptySignatures);
        setIsSavedRecord(false);
        setSaveSuccess(false);
      }
      return;
    }
    loadSelection(val, partNoVal, form.date, true);
  };

  // Date change
  const handleDateChange = (val) => {
    setForm((prev) => ({ ...prev, date: val }));
    if (form.partName && val) {
      loadSelection(form.partName, form.partNo, val, false);
    }
  };

  // Sync with LineSetContext if active (initial part selection)
  useEffect(() => {
    if (lineSet?.partName && !form.partName) {
      setForm((prev) => ({
        ...prev,
        partName: lineSet.partName || prev.partName,
        partNo: lineSet.partNo || prev.partNo,
      }));
      loadSelection(lineSet.partName, lineSet.partNo || "", form.date, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineSet]);

  // URL params lookup
  useEffect(() => {
    const qPart = searchParams.get("partName");
    const qDate = searchParams.get("date");
    if (qPart) {
      const dateVal = qDate || getTodayISODate();
      setForm((prev) => ({ ...prev, partName: qPart, date: dateVal }));
      loadSelection(qPart, "", dateVal, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const updateRow = (idx, field, val) => {
    if (isSavedRecord) return;
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: val } : r)));
  };

  // PDF Download Handler
  const handleDownloadPdf = async () => {
    if (!form.partName || !form.date) {
      triggerToast("Please select Part Name and Date to preview PDF.", "error");
      return;
    }
    if (!isSavedRecord) {
      triggerToast("No saved record found for this part and date. Submit the form first to preview.", "error");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const params = new URLSearchParams({
        shopId: String(shopId || 3),
        partName: form.partName,
        date: form.date,
      });

      const res = await fetch(`${API}/api/job-setup-verification/report?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("PDF report generation failed");

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `Job_Setup_Verification_${form.partName}_${form.date}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);

      triggerToast("PDF generated and downloaded successfully!", "success");
    } catch (err) {
      console.error("PDF generation failed:", err);
      triggerToast("Failed to generate PDF", "error");
    }
  };

  // Shift Incharge signs directly
  const handleApproveShiftIncharge = () => {
    if (isSavedRecord) return;
    if (!isShiftIncharge) {
      triggerToast("Only Shift Incharge can approve this.", "error");
      return;
    }
    setSignatures((prev) => ({ ...prev, shiftIncharge: currentUsername }));
    triggerToast("Shift Incharge Approved!", "success");
  };

  // Save Verification Record
  const handleSaveVerification = async () => {
    if (isSavedRecord) return;

    if (!form.partName) {
      triggerToast("Please select a Part Name.", "error");
      return;
    }
    if (!isShiftIncharge) {
      triggerToast("Only Shift Incharge can submit this record.", "error");
      return;
    }
    if (rows.length === 0) {
      triggerToast("No control specifications are set for this part. Ask HOD / HOF to set them up.", "error");
      return;
    }
    if (!signatures.shiftIncharge) {
      triggerToast("Please click 'Approve Incharge' under SHIFT INCHARGE before submitting.", "error");
      return;
    }
    if (!form.assignedQc) {
      triggerToast("Please select a QC in 'INSPECTOR'.", "error");
      return;
    }
    if (!form.assignedHofInspection) {
      triggerToast("Please select a HOF in 'HOF-INSPN'.", "error");
      return;
    }
    if (!form.assignedHof) {
      triggerToast("Please select a HOF in 'HOF-PRODN'.", "error");
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);

    const payload = {
      ...form,
      machineShop: shopId || "3",
      reasonForSetup: form.selectedReasons.join(","),
      actualInspectionData: rows,
      controlSpecifications: rows.map((r) => ({
        slNo: r.slNo,
        controlName: r.controlName,
        specification: r.specification,
      })),
      signatures: {
        shiftIncharge: signatures.shiftIncharge,
      },
    };

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/api/job-setup-verification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        setIsSaving(false);
        triggerToast(errBody.error || "Save operation failed", "error");
        if (res.status === 409) {
          // someone already filled this part + date -> show the locked record
          loadSelection(form.partName, form.partNo, form.date, false);
        }
        return;
      }

      const result = await res.json();

      setIsSaving(false);
      setSaveSuccess(true);
      setIsSavedRecord(true);
      setSignatures((prev) => ({
        ...prev,
        inspector: "Pending",
        hofInspection: "Pending",
        hofProduction: "Pending",
      }));
      if (result.id) setForm((prev) => ({ ...prev, id: result.id }));
      triggerToast("Job Setup Verification submitted for QC, HOF-INSPN & HOF approval!", "success");
    } catch (err) {
      setIsSaving(false);
      triggerToast(err.message || "Failed to save verification record", "error");
    }
  };

  const isApproved = (v) => Boolean(v && String(v).trim() !== "" && String(v).toLowerCase() !== "pending");
  const isInspectorApproved = isApproved(signatures.inspector);
  const isShiftInchargeApproved = isApproved(signatures.shiftIncharge);
  const isHofInspectionApproved = isApproved(signatures.hofInspection);
  const isHofProductionApproved = isApproved(signatures.hofProduction);

  // Shared cell for the three approver columns (approved / pending after save / dropdown before save)
  const renderApproverCell = ({ approved, signedBy, assigned, field, users, placeholder }) => {
    if (approved) {
      return (
        <div className="flex flex-col items-center justify-center animate-in fade-in duration-200">
          <span className="text-[10px] font-bold text-green-600 uppercase">Approved By ✓</span>
          <span className="text-xs font-black text-gray-900 uppercase">approved by {signedBy}</span>
        </div>
      );
    }
    if (isSavedRecord) {
      return (
        <div className="flex flex-col items-center justify-center">
          <span className="text-red-600 text-xs font-bold uppercase">pending</span>
          {assigned && (
            <span className="text-[10px] font-bold text-gray-500 uppercase mt-0.5">(Assigned: {assigned})</span>
          )}
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center gap-1 w-full">
        <select
          className="w-full bg-white border border-gray-300 p-1.5 rounded font-bold text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-orange-500 text-center"
          value={form[field] || ""}
          onChange={(e) => setForm({ ...form, [field]: e.target.value })}
        >
          <option value="">{placeholder}</option>
          {users.map((u, i) => {
            const uname = u.username || u.employeeId || u.name;
            return (
              <option key={`${uname}-${i}`} value={uname}>
                {String(uname).toUpperCase()}
              </option>
            );
          })}
        </select>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#2d2d2d] flex flex-col items-center justify-start p-3 sm:p-5 md:p-8 pb-20 w-full">
      <Header />
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: "", type: "" })} />

      {/* SAVING OVERLAY */}
      {isSaving && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl px-10 py-8 text-center">
            <div className="w-10 h-10 border-4 border-gray-300 border-t-orange-500 rounded-full animate-spin mx-auto mb-4"></div>
            <h2 className="text-lg font-bold text-gray-800">Saving Job Setup Verification...</h2>
          </div>
        </div>
      )}

      {/* MAIN DOCUMENT CARD */}
      <div className={`bg-white w-full max-w-[98rem] rounded-xl p-4 sm:p-6 md:p-8 shadow-2xl border-4 border-gray-100 space-y-6 ${lockedTextCls}`}>

        {/* CARD HEADER & PDF PREVIEW */}
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

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="flex items-center gap-2 bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider shadow transition-colors cursor-pointer"
            >
              <FileDown className="w-4 h-4" /> Preview PDF
            </button>
          </div>
        </div>

        {/* SECTION 1: REASON FOR JOB SETUP */}
        <fieldset disabled={isSavedRecord} className="border border-gray-800 p-3 bg-gray-50 text-xs rounded min-w-0">
          <span className="font-bold text-gray-900 uppercase block mb-1.5">Reason for job setup:</span>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {REASONS.map((r) => (
              <label key={r} className="flex items-center gap-1.5 cursor-pointer font-medium text-gray-800">
                <input
                  type="checkbox"
                  checked={form.selectedReasons.includes(r)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setForm({ ...form, selectedReasons: [...form.selectedReasons, r] });
                    } else {
                      setForm({ ...form, selectedReasons: form.selectedReasons.filter((item) => item !== r) });
                    }
                  }}
                  className="rounded text-orange-600 focus:ring-orange-500"
                />
                <span>{r}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* SECTION 2: BASIC INFO & TIME TRACKING GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-2 border border-gray-800 text-xs rounded overflow-hidden">
          {/* Left Column: Job Information */}
          <div className="p-3.5 border-b lg:border-b-0 lg:border-r border-gray-800 space-y-2.5 bg-white">

            {/* Part Name Dropdown (always selectable - switches the record) */}
            <div className="flex items-center">
              <label className="w-36 font-bold text-gray-800">Part Name:</label>
              <select
                className="flex-1 border-b border-gray-400 p-1 font-bold text-gray-900 bg-white outline-none uppercase cursor-pointer"
                value={form.partName}
                onChange={(e) => handlePartNameChange(e.target.value)}
              >
                <option value="">{loadingMasterData ? "Loading Parts..." : "-- Select Part Name --"}</option>
                {partOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="w-36 font-bold text-gray-800">Date / Shift:</label>
              <div className="flex-1 flex gap-2">
                <input
                  type="date"
                  className="border-b border-gray-400 p-1 font-semibold outline-none flex-1"
                  value={form.date}
                  onChange={(e) => handleDateChange(e.target.value)}
                />
                <select
                  className="border-b border-gray-400 p-1 font-bold bg-transparent outline-none w-28"
                  value={form.shift}
                  disabled={isSavedRecord}
                  onChange={(e) => setForm({ ...form, shift: e.target.value })}
                >
                  <option value="1st">1st Shift</option>
                  <option value="2nd">2nd Shift</option>
                  <option value="3rd">3rd Shift</option>
                </select>
              </div>
            </div>

            <fieldset disabled={isSavedRecord} className="space-y-2.5 min-w-0">
              <div className="flex items-center">
                <label className="w-36 font-bold text-gray-800">Setter Name:</label>
                <input
                  type="text"
                  placeholder="Enter Setter Name"
                  className="flex-1 border-b border-gray-400 p-1 font-semibold uppercase outline-none"
                  value={form.setterName}
                  onChange={(e) => setForm({ ...form, setterName: e.target.value })}
                />
              </div>

              {/* Operation No Dropdown */}
              <div className="flex items-center">
                <label className="w-36 font-bold text-gray-800">Operation No:</label>
                <div className="flex-1 flex gap-2">
                  <select
                    className="w-full border-b border-gray-400 p-1 font-bold text-orange-700 bg-white uppercase outline-none cursor-pointer"
                    value={form.operationNo}
                    onChange={(e) => setForm({ ...form, operationNo: e.target.value })}
                  >
                    <option value="">-- Select Operation No --</option>
                    {operationOptions.map((op) => (
                      <option key={op} value={op}>
                        {op}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-start">
                <label className="w-36 font-bold text-gray-800 pt-1">Operation Description:</label>
                <textarea
                  rows={2}
                  placeholder="Enter Operation Description"
                  className="flex-1 border border-gray-300 p-1.5 font-medium outline-none rounded uppercase text-[11px]"
                  value={form.operationDescription}
                  onChange={(e) => setForm({ ...form, operationDescription: e.target.value })}
                />
              </div>
            </fieldset>
          </div>

          {/* Right Column: Time Tracking */}
          <fieldset disabled={isSavedRecord} className="p-3.5 space-y-2 bg-orange-50/40 min-w-0">
            <div className="flex items-center justify-between">
              <span className="font-bold text-gray-800">a) Setting Started at :</span>
              <input
                type="time"
                className="w-40 border border-gray-300 p-1 font-semibold bg-white rounded text-center outline-none"
                value={form.settingStartedAt}
                onChange={(e) => setForm({ ...form, settingStartedAt: e.target.value })}
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="font-bold text-gray-800">b) Inspection time (Stage) :</span>
              <input
                type="text"
                placeholder="e.g. 30 min's"
                className="w-40 border border-gray-300 p-1 font-semibold bg-white rounded text-center outline-none"
                value={form.inspectionTimeStage}
                onChange={(e) => setForm({ ...form, inspectionTimeStage: e.target.value })}
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="font-bold text-gray-800">c) Setting Finished at :</span>
              <input
                type="time"
                className="w-40 border border-gray-300 p-1 font-semibold bg-white rounded text-center outline-none"
                value={form.settingFinishedAt}
                onChange={(e) => setForm({ ...form, settingFinishedAt: e.target.value })}
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="font-bold text-gray-800">d) Setting Time (c-a) :</span>
              <input
                type="text"
                readOnly
                placeholder="Auto-calculated"
                className="w-40 border border-gray-300 p-1 font-bold text-orange-700 bg-gray-100 rounded text-center"
                value={form.settingTime}
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="font-bold text-gray-800">e) Inspection Time (Metrology) :</span>
              <input
                type="text"
                placeholder="e.g. 1.30 hrs"
                className="w-40 border border-gray-300 p-1 font-semibold bg-white rounded text-center outline-none"
                value={form.inspectionTimeMetrology}
                onChange={(e) => setForm({ ...form, inspectionTimeMetrology: e.target.value })}
              />
            </div>

            <div className="flex items-center justify-between border-t border-gray-300 pt-1.5">
              <span className="font-black text-gray-900 uppercase">f) Total time (d+e) :</span>
              <input
                type="text"
                readOnly
                placeholder="Auto-calculated"
                className="w-40 border-2 border-orange-500 p-1 font-black text-orange-800 bg-orange-100 rounded text-center"
                value={form.totalTime}
              />
            </div>
          </fieldset>
        </div>

        {/* SECTION 3: DETAILS OF SETTING CHANGE */}
        <div className="border border-gray-800 text-xs overflow-x-auto rounded">
          <fieldset disabled={isSavedRecord} className="min-w-0">
            <table className="w-full border-collapse text-center min-w-[750px]">
              <thead>
                <tr className="bg-gray-100 font-bold border-b border-gray-800">
                  <th className="border-r border-gray-800 p-2 w-[16%] text-left font-black">Details of setting change:</th>
                  <th className="border-r border-gray-800 p-2 w-[20%]">Item Name</th>
                  <th className="border-r border-gray-800 p-2 w-[12%]">Machine No</th>
                  <th className="border-r border-gray-800 p-2 w-[12%]">Fixture No</th>
                  <th className="border-r border-gray-800 p-2 w-[16%]">operation change</th>
                  <th className="p-2 w-[24%]">Significant B/downs</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-800">
                  <td className="border-r border-gray-800 p-1.5 font-bold text-left bg-gray-50">Running item</td>
                  <td className="border-r border-gray-800 p-0">
                    <input
                      type="text"
                      placeholder="Running Item Name"
                      className="w-full h-full p-1.5 text-center outline-none font-medium"
                      value={form.runningItem}
                      onChange={(e) => setForm({ ...form, runningItem: e.target.value })}
                    />
                  </td>
                  <td className="border-r border-gray-800 p-0">
                    <input
                      type="text"
                      placeholder="M/C No"
                      className="w-full h-full p-1.5 text-center outline-none font-medium"
                      value={form.runningMachineNo}
                      onChange={(e) => setForm({ ...form, runningMachineNo: e.target.value })}
                    />
                  </td>
                  <td className="border-r border-gray-800 p-0">
                    <input
                      type="text"
                      placeholder="Fixture No"
                      className="w-full h-full p-1.5 text-center outline-none font-medium"
                      value={form.runningFixtureNo}
                      onChange={(e) => setForm({ ...form, runningFixtureNo: e.target.value })}
                    />
                  </td>
                  <td className="border-r border-gray-800 p-0">
                    <input
                      type="text"
                      placeholder="Operation Change Details"
                      className="w-full h-full p-1.5 text-center outline-none font-medium"
                      value={form.runningOperationChange}
                      onChange={(e) => setForm({ ...form, runningOperationChange: e.target.value })}
                    />
                  </td>
                  <td className="p-0">
                    <input
                      type="text"
                      placeholder="Breakdown Details"
                      className="w-full h-full p-1.5 text-center outline-none font-medium"
                      value={form.runningSignificantBreakdown}
                      onChange={(e) => setForm({ ...form, runningSignificantBreakdown: e.target.value })}
                    />
                  </td>
                </tr>
                <tr>
                  <td className="border-r border-gray-800 p-1.5 font-bold text-left bg-gray-50">Change to</td>
                  <td className="border-r border-gray-800 p-0">
                    <input
                      type="text"
                      placeholder="Change To Item Name"
                      className="w-full h-full p-1.5 text-center outline-none font-medium"
                      value={form.changeToItem}
                      onChange={(e) => setForm({ ...form, changeToItem: e.target.value })}
                    />
                  </td>
                  <td className="border-r border-gray-800 p-0">
                    <input
                      type="text"
                      placeholder="M/C No"
                      className="w-full h-full p-1.5 text-center outline-none font-medium"
                      value={form.changeToMachineNo}
                      onChange={(e) => setForm({ ...form, changeToMachineNo: e.target.value })}
                    />
                  </td>
                  <td className="border-r border-gray-800 p-0">
                    <input
                      type="text"
                      placeholder="Fixture No"
                      className="w-full h-full p-1.5 text-center outline-none font-medium"
                      value={form.changeToFixtureNo}
                      onChange={(e) => setForm({ ...form, changeToFixtureNo: e.target.value })}
                    />
                  </td>
                  <td className="border-r border-gray-800 p-0">
                    <input
                      type="text"
                      placeholder="Operation Change Details"
                      className="w-full h-full p-1.5 text-center outline-none font-medium"
                      value={form.changeToOperationChange}
                      onChange={(e) => setForm({ ...form, changeToOperationChange: e.target.value })}
                    />
                  </td>
                  <td className="p-0">
                    <input
                      type="text"
                      placeholder="Breakdown Details"
                      className="w-full h-full p-1.5 text-center outline-none font-medium"
                      value={form.changeToSignificantBreakdown}
                      onChange={(e) => setForm({ ...form, changeToSignificantBreakdown: e.target.value })}
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </fieldset>
        </div>

        {/* INSTRUCTION BAR */}
        <div className="bg-orange-100 border border-orange-300 p-2 text-xs font-semibold text-orange-950 text-center rounded">
          ⚠️ Before setting change clear all the running items after completion of all operation from the hand.
        </div>

        {/* SECTION 4: ACTUAL VALUES INSPECTION TABLE (rows come from the part's master specifications) */}
        <div className="space-y-2">
          <div className="flex justify-between items-center px-1">
            <span className="font-black text-gray-900 uppercase text-xs">
              ACTUAL VALUES (Minimum two pieces required) — {rows.length} Rows
            </span>
            {isSavedRecord && (
              <span className="text-[11px] font-bold text-green-700 bg-green-100 px-2.5 py-1 rounded-full uppercase">
                Submitted · Locked
              </span>
            )}
          </div>

          <div className="overflow-x-auto max-h-[600px] border-2 border-gray-800 rounded">
            <fieldset disabled={isSavedRecord} className="min-w-0">
              <table className="w-full border-collapse text-xs text-center min-w-[1250px]">
                <thead className="sticky top-0 z-20 bg-gray-100 border-b-2 border-gray-800">
                  <tr className="font-bold text-gray-800">
                    <th rowSpan={2} className="border border-gray-800 p-2 w-[4%]">Sl.No</th>
                    <th rowSpan={2} className="border border-gray-800 p-2 w-[18%]">Control</th>
                    <th rowSpan={2} className="border border-gray-800 p-2 w-[22%]">Control Specification (Refer W.I)</th>
                    <th colSpan={2} className="border border-gray-800 p-1 w-[14%] bg-gray-200">First piece</th>
                    <th colSpan={2} className="border border-gray-800 p-1 w-[14%] bg-gray-200">Second Piece</th>
                    <th colSpan={2} className="border border-gray-800 p-1 w-[14%] bg-gray-200">Third Piece</th>
                    <th rowSpan={2} className="border border-gray-800 p-2 w-[7%]">Status</th>
                    <th rowSpan={2} className="border border-gray-800 p-2 w-[7%]">Remarks</th>
                  </tr>
                  <tr className="bg-gray-50 text-[11px] font-bold">
                    <th className="border border-gray-800 p-1">LH 1</th>
                    <th className="border border-gray-800 p-1">RH 1</th>
                    <th className="border border-gray-800 p-1">LH 2</th>
                    <th className="border border-gray-800 p-1">RH 2</th>
                    <th className="border border-gray-800 p-1">LH 3</th>
                    <th className="border border-gray-800 p-1">RH 3</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={11} className="border border-gray-800 p-6 text-gray-500 italic font-semibold">
                        {!form.partName
                          ? "Select a Part Name to load its control specifications."
                          : specsMissing
                          ? "No control specifications are set for this part. Please ask HOD / HOF to set them up."
                          : "Loading..."}
                      </td>
                    </tr>
                  )}
                  {rows.map((r, idx) => (
                    <tr key={`row-${idx}`} className="h-9 hover:bg-orange-50/30">
                      <td className="border border-gray-800 p-1 font-bold bg-gray-50">{r.slNo || idx + 1}</td>

                      {/* Control Name (from master, read only) */}
                      <td className="border border-gray-800 p-0 text-left px-1.5 font-bold uppercase text-[11px] bg-gray-50/50">
                        <input
                          type="text"
                          readOnly
                          className="w-full bg-transparent font-bold outline-none uppercase"
                          value={r.controlName}
                        />
                      </td>

                      {/* Control Specification (from master, read only) */}
                      <td className="border border-gray-800 p-0 text-left px-1.5 font-bold text-gray-900 bg-gray-50/80">
                        <input
                          type="text"
                          readOnly
                          className="w-full bg-transparent font-semibold outline-none text-gray-900"
                          value={r.specification}
                        />
                      </td>

                      {/* Actual Values LH1 to RH3 (filled by shift incharge) */}
                      {["LH1", "RH1", "LH2", "RH2", "LH3", "RH3"].map((f) => (
                        <td key={f} className="border border-gray-800 p-0">
                          <input
                            type="text"
                            placeholder="-"
                            className="w-full h-full text-center p-1 outline-none font-semibold"
                            value={r[f]}
                            onChange={(e) => updateRow(idx, f, e.target.value)}
                          />
                        </td>
                      ))}

                      {/* OK / NOT OK Status */}
                      <td className="border border-gray-800 p-1">
                        <select
                          className={`w-full text-center font-bold text-xs p-1 rounded outline-none ${
                            r.status === "OK" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                          }`}
                          value={r.status || "OK"}
                          onChange={(e) => updateRow(idx, "status", e.target.value)}
                        >
                          <option value="OK">OK</option>
                          <option value="NOT OK">NOT OK</option>
                        </select>
                      </td>

                      {/* Remarks */}
                      <td className="border border-gray-800 p-0">
                        <input
                          type="text"
                          placeholder="Remarks"
                          className="w-full h-full p-1 text-center outline-none font-medium text-[11px]"
                          value={r.remarks}
                          onChange={(e) => updateRow(idx, "remarks", e.target.value)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </fieldset>
          </div>
        </div>

        {/* SECTION 5: NOTES SECTION */}
        <div className="border border-gray-800 p-3 bg-gray-50 text-[11px] space-y-1 rounded">
          <span className="font-bold text-gray-900 block">Note:</span>
          <p>1. For setting trial prefer rejected components should be marked with pink paint identification. If pink colour component is not available, put red paint mark on the line part with proper higher authority approval so as to use it. The same should be verified and disposed.</p>
          <p>2. To identify control specification refer JSV parameter in relevant work instruction (process sheet). Do statistical approval for special characteristics for 3 subgroups.</p>
          <p>3. Keep the set up part with proper traceability, and if found any deviation reactivity is applied.</p>
          <p>4. After Regular holiday product conformance will done by inprocess gauges and final inspection gauges.</p>
          <p>5. Error proofs and Process parameters should be verified during set-up change.</p>
        </div>

        {/* SECTION 6: SIGNATURES BLOCK */}
        <div className="overflow-x-auto mt-6">
          <table className="w-full border-collapse border-2 border-gray-800 text-xs text-center min-w-[800px]">
            <thead>
              <tr className="bg-gray-100 text-gray-800 font-bold">
                <th className="border border-gray-800 p-3 w-1/4 uppercase">INSPECTOR</th>
                <th className="border border-gray-800 p-3 w-1/4 uppercase">SHIFT INCHARGE</th>
                <th className="border border-gray-800 p-3 w-1/4 uppercase">HOF-INSPN (QUALITY)</th>
                <th className="border border-gray-800 p-3 w-1/4 uppercase">HOF-PRODN (PRODUCTION)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="h-16">
                {/* 1. Inspector -> sent to QC */}
                <td className="border border-gray-800 p-2 text-center align-middle bg-gray-50/40">
                  {renderApproverCell({
                    approved: isInspectorApproved,
                    signedBy: signatures.inspector,
                    assigned: form.assignedQc,
                    field: "assignedQc",
                    users: qcUsers,
                    placeholder: "-- Select QC --",
                  })}
                </td>

                {/* 2. Shift Incharge -> signs directly */}
                <td className="border border-gray-800 p-2 text-center align-middle bg-gray-50/40">
                  {isShiftInchargeApproved ? (
                    <div className="flex flex-col items-center justify-center animate-in fade-in duration-200">
                      <span className="text-[10px] font-bold text-green-600 uppercase">
                        Approved By ✓
                      </span>
                      <span className="text-xs font-black text-gray-900 uppercase">
                        approved by {signatures.shiftIncharge}
                      </span>
                    </div>
                  ) : isShiftIncharge ? (
                    <button
                      type="button"
                      onClick={handleApproveShiftIncharge}
                      className="bg-orange-500 hover:bg-orange-600 text-white text-[11px] font-bold px-4 py-1.5 rounded shadow hover:scale-105 transition-all uppercase tracking-wider cursor-pointer"
                    >
                      Approve Incharge
                    </button>
                  ) : (
                    <span className="text-gray-400 text-xs italic">Pending Shift Incharge</span>
                  )}
                </td>

                {/* 3. HOF-INSPN (new role) */}
                <td className="border border-gray-800 p-2 text-center align-middle bg-gray-50/40">
                  {renderApproverCell({
                    approved: isHofInspectionApproved,
                    signedBy: signatures.hofInspection,
                    assigned: form.assignedHofInspection,
                    field: "assignedHofInspection",
                    users: hofInspnUsers,
                    placeholder: "-- Select HOF-INSPN --",
                  })}
                </td>

                {/* 4. HOF-PRODN -> sent to HOF */}
                <td className="border border-gray-800 p-2 text-center align-middle bg-gray-50/40">
                  {renderApproverCell({
                    approved: isHofProductionApproved,
                    signedBy: signatures.hofProduction,
                    assigned: form.assignedHof,
                    field: "assignedHof",
                    users: hofUsers,
                    placeholder: "-- Select HOF --",
                  })}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* BOTTOM ACTIONS */}
        <div className="flex justify-between items-center pt-4 border-t border-gray-300">
          <span className="text-xs text-gray-500 font-semibold">{formMeta.formCode}, Rev.No: {formMeta.revision} dt {formMeta.revisionDate}</span>
          <button
            type="button"
            onClick={handleSaveVerification}
            disabled={isSaving || saveSuccess || isSavedRecord}
            className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white px-10 py-3 rounded font-bold shadow-lg flex items-center gap-2 uppercase tracking-wider text-sm transition-colors cursor-pointer"
          >
            <Save className="w-4 h-4" /> {isSaving ? "SAVING..." : saveSuccess || isSavedRecord ? "SAVED ✓" : "Save Verification Record"}
          </button>
        </div>
      </div>
    </div>
  );
}
