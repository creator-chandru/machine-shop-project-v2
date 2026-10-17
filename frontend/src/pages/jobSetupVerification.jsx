import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useLineSet } from "../context/LineSetContext.jsx";
import { ArrowLeft, FileDown, Save, Plus, Trash2, ImagePlus, X, CheckCircle2, AlertTriangle, Clock, Info } from "lucide-react";
import Header from "../components/Header";
import {OPERATION_OPTIONS, blobToCompressedDataUrl, imageFromPasteEvent, imageFromClipboardApi} from "../components/specImage.jsx";
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

const SPECIAL_CHARS = ["Ø", "±", "°", "×", "≤", "≥", "⌀", "⊥", "∥", "√", "Ra", "~", "'", '"', "µm", "R", "C"];

const lockedTextCls =
  "[&_input:disabled]:text-gray-900 [&_select:disabled]:text-gray-900 [&_textarea:disabled]:text-gray-900";

const emptySignatures = { inspector: "", shiftIncharge: "", hofInspection: "", hofProduction: "" };

const createEmptyInspectionRow = (slNo = 1) => ({
  slNo, controlName: "", specification: "", image: "",
  LH1: "", RH1: "", LH2: "", RH2: "", LH3: "", RH3: "",
  status: "", remarks: "", isExisting: false,
});

const Toast = ({ message, type, onClose }) => {
  if (!message) return null;
  const bgColor =
    type === "error" ? "bg-red-600" : type === "success" ? "bg-green-600" : "bg-orange-600";
  return (
    <div className={`fixed bottom-6 right-6 z-50 ${bgColor} text-white px-5 py-3.5 rounded-xl shadow-2xl flex items-center gap-3 animate-bounce border border-black/10`}>
      <span className="text-sm font-semibold tracking-wide">{message}</span>
      <button onClick={onClose} className="ml-2 p-1 font-bold text-lg leading-none hover:text-gray-200 focus:outline-none transition-colors">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export default function JobSetupVerification() {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { lineSet, setLineSet } = useLineSet();

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
  const [previewImage, setPreviewImage] = useState(null);

  const [partSets, setPartSets] = useState([]);
  const [machineDetails, setMachineDetails] = useState([]);
  const [lineMappings, setLineMappings] = useState([]);
  const [loadingMasterData, setLoadingMasterData] = useState(true);

  const [qcUsers, setQcUsers] = useState([]);
  const [hofInspnUsers, setHofInspnUsers] = useState([]);
  const [hofUsers, setHofUsers] = useState([]);

  const [qfHistory, setQfHistory] = useState([]);
  const [qfValue, setQfValue] = useState("QF/07/MPD-03, Rev.No: 03 dt 31.01.2025");

  const isSavedRef = useRef(false);
  const rowsRef = useRef([]);
  const lookupSeqRef = useRef(0);
  const activeFieldRef = useRef({ idx: null, field: null, element: null });

  const triggerToast = (message, type = "error") => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: "", type: "" }), 4000);
  };

  const buildFreshForm = ({
    partName = "",
    partNo = "",
    date = getTodayISODate(),
    shift = "1st",
    operationNo = "",
  } = {}) => ({
    id: null,
    machineShop: shopId || "3",
    partName,
    partNo,
    operationNo,
    operationDescription: "",
    date,
    shift,
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

  const [form, setForm] = useState(() => buildFreshForm());
  const [rows, setRows] = useState([]);
  const [signatures, setSignatures] = useState(emptySignatures);

  useEffect(() => {
    isSavedRef.current = isSavedRecord;
  }, [isSavedRecord]);

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  useEffect(() => {
    const fetchQfHistory = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(
          `${API}/api/qf-values/history/job-setup-verification`,
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
    let currentQf = "QF/07/MPD-03, Rev.No: 03 dt 31.01.2025";

    if (form.date && qfHistory.length > 0) {
      const selectedDate = new Date(form.date);
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
  }, [form.date, qfHistory]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem("token");
        const headers = { Authorization: `Bearer ${token}` };

        if (shopId) {
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

  const partOptions = Array.from(
    new Set(
      partSets.length > 0
        ? partSets.map((p) => p.partName).filter(Boolean)
        : [
            ...machineDetails.map((m) => m.partName).filter(Boolean),
            ...lineMappings.map((m) => m.partSet).filter(Boolean),
          ]
    )
  );

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
        if (Array.isArray(parsed)) {
          setRows(parsed.map((r, i) => ({ ...r, slNo: i + 1, isExisting: true })));
        }
      } catch (e) {}
    }

    setSignatures({
      inspector: record.Sign_Inspector || "",
      shiftIncharge: record.Sign_ShiftIncharge || "",
      hofInspection: record.Sign_HofInspection || "",
      hofProduction: record.Sign_HofProduction || "",
    });
  };

  const fetchControlSpecifications = async (partName, operationNo, seq) => {
    if (!partName || !operationNo) {
      setRows([]);
      setSpecsMissing(false);
      return;
    }
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${API}/api/job-setup-verification/specifications?partName=${encodeURIComponent(partName)}&operationNo=${encodeURIComponent(operationNo)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (seq !== undefined && seq !== lookupSeqRef.current) return;
      if (res.ok) {
        const data = await res.json();
        const specs = Array.isArray(data.specifications) ? data.specifications : [];
        if (specs.length > 0) {
          setRows(
            specs.map((spec, idx) => ({
              slNo: idx + 1,
              controlName: spec.controlName || "",
              specification: spec.specification || "",
              image: spec.image || "",
              LH1: "", RH1: "", LH2: "", RH2: "", LH3: "", RH3: "",
              status: "",
              remarks: "",
              isExisting: true,
            }))
          );
          setSpecsMissing(false);
          triggerToast(`Loaded ${specs.length} Control Specifications.`, "success");
        } else {
          setRows([createEmptyInspectionRow(1)]);
          setSpecsMissing(true);
          triggerToast("No pre-configured specifications for this part & operation. You can add them below.", "info");
        }
      }
    } catch (err) {
      console.error("Fetch specs error:", err);
    }
  };

  const loadSelection = async (partName, partNo, date, shift, operationNo, forceSpecs = false) => {
    if (!partName || !date) return;
    const seq = ++lookupSeqRef.current;
    if (!operationNo) {
      setForm(buildFreshForm({ partName, partNo, date, shift, operationNo: "" }));
      setSignatures(emptySignatures);
      setIsSavedRecord(false);
      setSaveSuccess(false);
      setRows([]);
      setSpecsMissing(false);
      return;
    }
    let record = null;
    try {
      const token = localStorage.getItem("token");
      const params = new URLSearchParams({
        partName,
        date,
        shopId: String(shopId || 3),
      });
      if (shift) params.append("shift", shift);
      if (operationNo) params.append("operationNo", operationNo);

      const res = await fetch(`${API}/api/job-setup-verification/record?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
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

    setForm(buildFreshForm({ partName, partNo, date, shift, operationNo }));
    setSignatures(emptySignatures);
    setIsSavedRecord(false);
    setSaveSuccess(false);

    if (forceSpecs || isSavedRef.current || rowsRef.current.length === 0) {
      await fetchControlSpecifications(partName, operationNo, seq);
    } else {
      setRows((prev) =>
        prev.map((r, i) => ({
          ...r,
          slNo: i + 1,
          LH1: "",
          RH1: "",
          LH2: "",
          RH2: "",
          LH3: "",
          RH3: "",
          status: "",
          remarks: "",
        }))
      );
    }
  };

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
      setForm(buildFreshForm({ partName: "", partNo: "", date: form.date, shift: form.shift, operationNo: form.operationNo }));
      setSignatures(emptySignatures);
      setIsSavedRecord(false);
      setSaveSuccess(false);
      return;
    }
    loadSelection(val, partNoVal, form.date, form.shift, form.operationNo, true);
  };

  const handleDateChange = (val) => {
    setForm((prev) => ({ ...prev, date: val }));
    if (form.partName && val) {
      loadSelection(form.partName, form.partNo, val, form.shift, form.operationNo, false);
    }
  };

  const handleShiftChange = (val) => {
    setForm((prev) => ({ ...prev, shift: val }));
    if (form.partName && form.date) {
      loadSelection(form.partName, form.partNo, form.date, val, form.operationNo, false);
    }
  };

  const handleOperationNoChange = (val) => {
    setForm((prev) => ({ ...prev, operationNo: val }));
    if (form.partName && form.date) {
      loadSelection(form.partName, form.partNo, form.date, form.shift, val, true);
    }
  };

  useEffect(() => {
    if (lineSet?.partName && !form.partName) {
      setForm((prev) => ({
        ...prev,
        partName: lineSet.partName || prev.partName,
        partNo: lineSet.partNo || prev.partNo,
      }));
      loadSelection(lineSet.partName, lineSet.partNo || "", form.date, form.shift, form.operationNo, true);
    }
  }, [lineSet]);

  useEffect(() => {
    const qPart = searchParams.get("partName");
    const qDate = searchParams.get("date");
    const qShift = searchParams.get("shift");
    const qOp = searchParams.get("operationNo");
    if (qPart) {
      const dateVal = qDate || getTodayISODate();
      const shiftVal = qShift || "1st";
      const opVal = qOp || "";
      setForm((prev) => ({ ...prev, partName: qPart, date: dateVal, shift: shiftVal, operationNo: opVal }));
      loadSelection(qPart, "", dateVal, shiftVal, opVal, true);
    }
  }, [searchParams]);

  const updateRow = (idx, field, val) => {
    if (isSavedRecord) return;
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: val } : r)));
  };

  const insertSymbol = (e, char) => {
    e.preventDefault();
    if (isSavedRecord) return;
    const { idx, field, element } = activeFieldRef.current;
    if (idx === null || !field) {
      triggerToast("Click on a field in the inspection table first to insert a symbol.", "info");
      return;
    }
    const cur = rows[idx]?.[field] || "";
    const start = element && typeof element.selectionStart === "number" ? element.selectionStart : cur.length;
    const end = element && typeof element.selectionEnd === "number" ? element.selectionEnd : cur.length;
    const next = cur.slice(0, start) + char + cur.slice(end);
    updateRow(idx, field, next);

    setTimeout(() => {
      if (element) {
        element.focus();
        element.setSelectionRange(start + char.length, start + char.length);
      }
    }, 0);
  };

  const handleAddRow = () => {
    if (isSavedRecord) return;
    setRows((prev) => [...prev, createEmptyInspectionRow(prev.length + 1)]);
  };

  const attachImage = async (idx, blob) => {
    try {
      updateRow(idx, "image", await blobToCompressedDataUrl(blob));
    } catch (e) {
      triggerToast("Could not read the pasted image.", "error");
    }
  };

  const handleCellPaste = (e, idx) => {
    if (isSavedRecord || rows[idx]?.isExisting) return;
    const file = imageFromPasteEvent(e);
    if (file) {
      e.preventDefault();
      attachImage(idx, file);
    }
  };

  const handlePasteButton = async (idx) => {
    try {
      const blob = await imageFromClipboardApi();
      if (!blob) return triggerToast("No image found in the clipboard.", "info");
      attachImage(idx, blob);
    } catch (e) {
      triggerToast("Clipboard access blocked. Click the Specification box and press Ctrl+V instead.", "error");
    }
  };

  const handleDeleteRow = (idx) => {
    if (isSavedRecord) return;
    setRows((prev) => {
      const updated = prev.filter((_, i) => i !== idx);
      return updated.map((r, i) => ({ ...r, slNo: i + 1 }));
    });
  };

  const handleDownloadPdf = async () => {
    if (!form.partName || !form.date) {
      triggerToast("Please select Part Name and Date to preview PDF.", "error");
      return;
    }
    if (!isSavedRecord) {
      triggerToast("No saved record found for this setup. Submit the form first to preview.", "error");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const params = new URLSearchParams({
        shopId: String(shopId || 3),
        partName: form.partName,
        date: form.date,
        shift: form.shift,
        operationNo: form.operationNo,
      });

      const res = await fetch(`${API}/api/job-setup-verification/report?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("PDF report generation failed");

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `Job_Setup_Verification_${form.partName}_${form.date}_${form.shift}.pdf`;
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

  const handleApproveShiftIncharge = () => {
    if (isSavedRecord) return;
    if (!isShiftIncharge) {
      triggerToast("Only Shift Incharge can approve this.", "error");
      return;
    }
    if (!form.partName) {
      triggerToast("Please select Part Name before approving.", "error");
      return;
    }
    if (!form.date) {
      triggerToast("Please select Date before approving.", "error");
      return;
    }
    if (!form.shift) {
      triggerToast("Please select Shift before approving.", "error");
      return;
    }
    if (!form.operationNo) {
      triggerToast("Please select Operation No before approving.", "error");
      return;
    }

    setSignatures((prev) => ({ ...prev, shiftIncharge: currentUsername }));
    triggerToast("Shift Incharge Approved!", "success");
  };

  const handleSaveVerification = async () => {
    if (isSavedRecord) return;

    if (!form.partName) {
      triggerToast("Please select a Part Name.", "error");
      return;
    }
    if (!form.date) {
      triggerToast("Please select a Date.", "error");
      return;
    }
    if (!form.shift) {
      triggerToast("Please select a Shift.", "error");
      return;
    }
    if (!form.operationNo) {
      triggerToast("Please select an Operation No.", "error");
      return;
    }
    if (!isShiftIncharge) {
      triggerToast("Only Shift Incharge can submit this record.", "error");
      return;
    }

    const validRows = rows.filter((r) => r.controlName.trim() || r.specification.trim() || r.image);
    if (validRows.length === 0) {
      triggerToast("Please add at least one Control Specification.", "error");
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
      username: currentUsername,
      machineShop: shopId || "3",
      reasonForSetup: form.selectedReasons.join(","),
      actualInspectionData: validRows.map((r, i) => ({ ...r, slNo: i + 1 })),
      controlSpecifications: validRows.map((r, i) => ({
        slNo: i + 1,
        controlName: r.controlName.trim(),
        specification: r.specification.trim(),
        image: r.image || "",
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
          loadSelection(form.partName, form.partNo, form.date, form.shift, form.operationNo, false);
        }
        return;
      }

      const result = await res.json();

      setIsSaving(false);
      setSaveSuccess(true);
      setIsSavedRecord(true);
      setRows(validRows.map((r, i) => ({ ...r, slNo: i + 1, isExisting: true })));
      setSignatures((prev) => ({
        ...prev,
        inspector: "Pending",
        hofInspection: "Pending",
        hofProduction: "Pending",
      }));
      if (result.id) setForm((prev) => ({ ...prev, id: result.id }));
      triggerToast("Job Setup Verification submitted and Control Specifications updated!", "success");
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
          className="w-full bg-white border border-gray-300 p-2 rounded-lg font-bold text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-center cursor-pointer shadow-sm transition-all"
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
    <div className="min-h-screen bg-[#2d2d2d] flex flex-col items-center justify-start p-3 sm:p-6 lg:p-8 font-sans antialiased">
      <Header />
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: "", type: "" })} />

      {previewImage && (
        <div
          className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 cursor-zoom-out animate-in fade-in"
          onClick={() => setPreviewImage(null)}
        >
          <img src={previewImage} alt="Specification" className="max-h-full max-w-full object-contain bg-white rounded-xl shadow-2xl" />
        </div>
      )}

      {isSaving && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl px-8 sm:px-12 py-8 text-center border border-gray-100 max-w-sm w-full">
            <div className="w-12 h-12 border-4 border-gray-200 border-t-orange-500 rounded-full animate-spin mx-auto mb-4"></div>
            <h2 className="text-lg font-bold text-gray-900 tracking-wide">Saving Verification...</h2>
            <p className="text-xs text-gray-500 mt-1 font-medium">Please wait while the setup record is being saved</p>
          </div>
        </div>
      )}

      <div className={`bg-white w-full max-w-[98rem] rounded-2xl p-4 sm:p-8 lg:p-10 shadow-2xl border border-gray-200/80 space-y-7 my-4 ${lockedTextCls}`}>
        
        {/* TOP HEADER */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-200 pb-5 gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="p-2 text-gray-600 hover:text-orange-600 hover:bg-orange-50 rounded-xl transition-all cursor-pointer border border-gray-200 shadow-sm"
              title="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <span className="text-xs font-black text-orange-600 tracking-widest uppercase block mb-0.5">
                {formMeta.company}
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-gray-900 uppercase tracking-wide">
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
              <FileDown className="w-4 h-4 text-orange-400" /> Preview PDF
            </button>
          </div>
        </div>

        {/* 1. REASONS FOR SETUP */}
        <fieldset disabled={isSavedRecord} className="bg-white rounded-xl border border-gray-300 p-5 space-y-3 shadow-sm min-w-0">
          <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
            <span className="font-extrabold text-gray-900 text-xs sm:text-sm uppercase tracking-wide">
              Reason for Job Setup
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2.5 pt-1 text-xs sm:text-sm">
            {REASONS.map((r) => (
              <label key={r} className="flex items-center gap-2 cursor-pointer font-semibold text-gray-800 hover:text-orange-950 transition-colors select-none">
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
                  className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500 border-gray-300 cursor-pointer"
                />
                <span>{r}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* 2. PART & TIMING DETAILS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Basic Part Setup */}
          <div className="bg-white rounded-xl border border-gray-300 p-5 space-y-4 shadow-sm flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
                <span className="font-extrabold text-gray-900 text-xs sm:text-sm uppercase tracking-wide">
                  Setup Specifications
                </span>
              </div>

              <div className="space-y-3 text-xs sm:text-sm">
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-gray-700 uppercase tracking-wider text-[11px]">Part Name:</label>
                  <select
                    className="border border-gray-300 rounded-lg p-2.5 font-bold text-gray-900 bg-gray-50/50 focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none uppercase cursor-pointer transition-all"
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="font-bold text-gray-700 uppercase tracking-wider text-[11px]">Date:</label>
                    <input
                      type="date"
                      className="border border-gray-300 rounded-lg p-2.5 font-semibold bg-gray-50/50 focus:bg-white focus:border-orange-500 outline-none cursor-pointer transition-all"
                      value={form.date}
                      onChange={(e) => handleDateChange(e.target.value)}
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="font-bold text-gray-700 uppercase tracking-wider text-[11px]">Shift:</label>
                    <select
                      className="border border-gray-300 rounded-lg p-2.5 font-bold bg-gray-50/50 focus:bg-white focus:border-orange-500 outline-none cursor-pointer transition-all"
                      value={form.shift}
                      onChange={(e) => handleShiftChange(e.target.value)}
                    >
                      <option value="1st">1st Shift</option>
                      <option value="2nd">2nd Shift</option>
                      <option value="3rd">3rd Shift</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-bold text-gray-700 uppercase tracking-wider text-[11px]">Operation No:</label>
                  <select
                    className="w-full border border-gray-300 rounded-lg p-2.5 font-bold text-orange-700 bg-gray-50/50 focus:bg-white focus:border-orange-500 outline-none uppercase cursor-pointer transition-all"
                    value={form.operationNo}
                    onChange={(e) => handleOperationNoChange(e.target.value)}
                  >
                    <option value="">-- Select Operation No --</option>
                    {OPERATION_OPTIONS.map((op) => (
                      <option key={op} value={op}>
                        {op}
                      </option>
                    ))}
                  </select>
                </div>

                <fieldset disabled={isSavedRecord} className="space-y-3 min-w-0">
                  <div className="flex flex-col gap-1">
                    <label className="font-bold text-gray-700 uppercase tracking-wider text-[11px]">Setter Name:</label>
                    <input
                      type="text"
                      placeholder="Enter Setter Name"
                      className="border border-gray-300 rounded-lg p-2.5 font-semibold uppercase bg-gray-50/50 focus:bg-white focus:border-orange-500 outline-none transition-all"
                      value={form.setterName}
                      onChange={(e) => setForm({ ...form, setterName: e.target.value })}
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="font-bold text-gray-700 uppercase tracking-wider text-[11px]">Operation Description:</label>
                    <textarea
                      rows={2}
                      placeholder="Enter Operation Description..."
                      className="border border-gray-300 rounded-lg p-2.5 font-medium outline-none rounded uppercase text-xs bg-gray-50/50 focus:bg-white focus:border-orange-500 transition-all resize-y"
                      value={form.operationDescription}
                      onChange={(e) => setForm({ ...form, operationDescription: e.target.value })}
                    />
                  </div>
                </fieldset>
              </div>
            </div>
          </div>

          {/* Time Tracking Section */}
          <fieldset disabled={isSavedRecord} className="bg-orange-50/40 rounded-xl border border-orange-200 p-5 space-y-3.5 shadow-sm min-w-0 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-2 border-b border-orange-200 pb-2">
                <Clock className="w-4 h-4 text-orange-600" />
                <span className="font-extrabold text-orange-950 text-xs sm:text-sm uppercase tracking-wide">
                  Time Tracking Matrix
                </span>
              </div>

              <div className="space-y-2.5 text-xs sm:text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-gray-800">a) Setting Started at:</span>
                  <input
                    type="time"
                    className="w-40 border border-gray-300 p-2 font-semibold bg-white rounded-lg text-center outline-none focus:border-orange-500 shadow-sm"
                    value={form.settingStartedAt}
                    onChange={(e) => setForm({ ...form, settingStartedAt: e.target.value })}
                  />
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-gray-800">b) Inspection time (Stage):</span>
                  <input
                    type="text"
                    placeholder="e.g. 30 min's"
                    className="w-40 border border-gray-300 p-2 font-semibold bg-white rounded-lg text-center outline-none focus:border-orange-500 shadow-sm"
                    value={form.inspectionTimeStage}
                    onChange={(e) => setForm({ ...form, inspectionTimeStage: e.target.value })}
                  />
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-gray-800">c) Setting Finished at:</span>
                  <input
                    type="time"
                    className="w-40 border border-gray-300 p-2 font-semibold bg-white rounded-lg text-center outline-none focus:border-orange-500 shadow-sm"
                    value={form.settingFinishedAt}
                    onChange={(e) => setForm({ ...form, settingFinishedAt: e.target.value })}
                  />
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-gray-800">d) Setting Time (c-a):</span>
                  <input
                    type="text"
                    readOnly
                    placeholder="Auto-calculated"
                    className="w-40 border border-gray-300 p-2 font-bold text-orange-700 bg-gray-100 rounded-lg text-center"
                    value={form.settingTime}
                  />
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-gray-800">e) Inspection Time (Metrology):</span>
                  <input
                    type="text"
                    placeholder="e.g. 1.30 hrs"
                    className="w-40 border border-gray-300 p-2 font-semibold bg-white rounded-lg text-center outline-none focus:border-orange-500 shadow-sm"
                    value={form.inspectionTimeMetrology}
                    onChange={(e) => setForm({ ...form, inspectionTimeMetrology: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-orange-200 pt-3">
              <span className="font-black text-orange-950 uppercase text-xs sm:text-sm">f) Total time (d+e):</span>
              <input
                type="text"
                readOnly
                placeholder="Auto-calculated"
                className="w-40 border-2 border-orange-500 p-2 font-black text-orange-900 bg-orange-100 rounded-lg text-center shadow-inner"
                value={form.totalTime}
              />
            </div>
          </fieldset>
        </div>

        {/* 3. DETAILS OF SETTING CHANGE TABLE */}
        <div className="bg-white rounded-xl border border-gray-300 p-5 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
            <span className="font-extrabold text-gray-900 text-xs sm:text-sm uppercase tracking-wide">
              Details of Setting Change
            </span>
          </div>

          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <fieldset disabled={isSavedRecord} className="min-w-0">
              <table className="w-full border-collapse text-xs text-center min-w-[750px]">
                <thead>
                  <tr className="bg-gray-100 font-extrabold border-b border-gray-200 uppercase tracking-wider text-[11px] text-gray-800">
                    <th className="p-3 w-[16%] text-left">Setting Phase</th>
                    <th className="p-3 w-[20%] border-l border-gray-200">Item Name</th>
                    <th className="p-3 w-[12%] border-l border-gray-200">Machine No</th>
                    <th className="p-3 w-[12%] border-l border-gray-200">Fixture No</th>
                    <th className="p-3 w-[18%] border-l border-gray-200">Operation Change</th>
                    <th className="p-3 w-[22%] border-l border-gray-200">Significant Breakdown</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr className="hover:bg-gray-50/50">
                    <td className="p-2.5 font-bold text-left bg-gray-50/80 text-gray-800">Running item</td>
                    <td className="p-1 border-l border-gray-200">
                      <input
                        type="text"
                        placeholder="Running Item Name"
                        className="w-full p-2 text-center outline-none font-medium bg-transparent focus:bg-white rounded"
                        value={form.runningItem}
                        onChange={(e) => setForm({ ...form, runningItem: e.target.value })}
                      />
                    </td>
                    <td className="p-1 border-l border-gray-200">
                      <input
                        type="text"
                        placeholder="M/C No"
                        className="w-full p-2 text-center outline-none font-medium bg-transparent focus:bg-white rounded"
                        value={form.runningMachineNo}
                        onChange={(e) => setForm({ ...form, runningMachineNo: e.target.value })}
                      />
                    </td>
                    <td className="p-1 border-l border-gray-200">
                      <input
                        type="text"
                        placeholder="Fixture No"
                        className="w-full p-2 text-center outline-none font-medium bg-transparent focus:bg-white rounded"
                        value={form.runningFixtureNo}
                        onChange={(e) => setForm({ ...form, runningFixtureNo: e.target.value })}
                      />
                    </td>
                    <td className="p-1 border-l border-gray-200">
                      <input
                        type="text"
                        placeholder="Operation details"
                        className="w-full p-2 text-center outline-none font-medium bg-transparent focus:bg-white rounded"
                        value={form.runningOperationChange}
                        onChange={(e) => setForm({ ...form, runningOperationChange: e.target.value })}
                      />
                    </td>
                    <td className="p-1 border-l border-gray-200">
                      <input
                        type="text"
                        placeholder="Breakdown details"
                        className="w-full p-2 text-center outline-none font-medium bg-transparent focus:bg-white rounded"
                        value={form.runningSignificantBreakdown}
                        onChange={(e) => setForm({ ...form, runningSignificantBreakdown: e.target.value })}
                      />
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-50/50">
                    <td className="p-2.5 font-bold text-left bg-gray-50/80 text-gray-800">Change to</td>
                    <td className="p-1 border-l border-gray-200">
                      <input
                        type="text"
                        placeholder="Change To Item Name"
                        className="w-full p-2 text-center outline-none font-medium bg-transparent focus:bg-white rounded"
                        value={form.changeToItem}
                        onChange={(e) => setForm({ ...form, changeToItem: e.target.value })}
                      />
                    </td>
                    <td className="p-1 border-l border-gray-200">
                      <input
                        type="text"
                        placeholder="M/C No"
                        className="w-full p-2 text-center outline-none font-medium bg-transparent focus:bg-white rounded"
                        value={form.changeToMachineNo}
                        onChange={(e) => setForm({ ...form, changeToMachineNo: e.target.value })}
                      />
                    </td>
                    <td className="p-1 border-l border-gray-200">
                      <input
                        type="text"
                        placeholder="Fixture No"
                        className="w-full p-2 text-center outline-none font-medium bg-transparent focus:bg-white rounded"
                        value={form.changeToFixtureNo}
                        onChange={(e) => setForm({ ...form, changeToFixtureNo: e.target.value })}
                      />
                    </td>
                    <td className="p-1 border-l border-gray-200">
                      <input
                        type="text"
                        placeholder="Operation details"
                        className="w-full p-2 text-center outline-none font-medium bg-transparent focus:bg-white rounded"
                        value={form.changeToOperationChange}
                        onChange={(e) => setForm({ ...form, changeToOperationChange: e.target.value })}
                      />
                    </td>
                    <td className="p-1 border-l border-gray-200">
                      <input
                        type="text"
                        placeholder="Breakdown details"
                        className="w-full p-2 text-center outline-none font-medium bg-transparent focus:bg-white rounded"
                        value={form.changeToSignificantBreakdown}
                        onChange={(e) => setForm({ ...form, changeToSignificantBreakdown: e.target.value })}
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </fieldset>
          </div>
        </div>

        <div className="bg-orange-50 border border-orange-200 p-3 rounded-xl flex items-center gap-2.5 text-xs font-bold text-orange-950">
          <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0" />
          <span>Before setting change clear all running items after completion of all operation from hand.</span>
        </div>

        {/* 4. ACTUAL VALUES & CONTROL SPECIFICATIONS */}
        <div className="bg-white rounded-xl border border-gray-300 p-5 space-y-4 shadow-sm">
          
          {/* Symbol Bar */}
          {!isSavedRecord && (
            <div className="bg-orange-50/70 border border-orange-200 p-3 rounded-xl flex flex-wrap items-center gap-2 text-xs">
              <span className="font-extrabold text-orange-950 uppercase tracking-wider text-[11px] mr-1">
                Insert Symbol:
              </span>
              {SPECIAL_CHARS.map((char) => (
                <button
                  key={char}
                  type="button"
                  onMouseDown={(e) => insertSymbol(e, char)}
                  className="bg-white hover:bg-orange-500 hover:text-white border border-gray-300 rounded-lg px-2.5 py-1 font-bold text-gray-800 shadow-xs transition-all cursor-pointer"
                >
                  {char}
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-gray-200 pb-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
              <span className="font-extrabold text-gray-900 text-xs sm:text-sm uppercase tracking-wide">
                Actual Inspection Values (Minimum two pieces required)
              </span>
              <span className="text-[11px] bg-orange-100 text-orange-800 px-2.5 py-0.5 rounded-full font-bold">
                {rows.length} Rows
              </span>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              {!isSavedRecord && form.partName && (
                <button
                  type="button"
                  onClick={handleAddRow}
                  className="inline-flex items-center gap-1.5 bg-gray-900 hover:bg-gray-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow hover:shadow-md cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Control Row
                </button>
              )}
              {isSavedRecord && (
                <span className="text-[11px] font-bold text-green-700 bg-green-100 border border-green-200 px-2.5 py-1 rounded-full uppercase tracking-wider">
                  Submitted · Locked
                </span>
              )}
            </div>
          </div>

          <div className="overflow-x-auto border border-gray-200 rounded-lg max-h-[600px]">
            <fieldset disabled={isSavedRecord} className="min-w-0">
              <table className="w-full border-collapse text-xs text-center min-w-[1300px]">
                <thead className="sticky top-0 z-20 bg-gray-100 border-b border-gray-300 font-extrabold text-gray-800 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th rowSpan={2} className="p-2.5 w-[4%]">Sl.No</th>
                    <th rowSpan={2} className="p-2.5 w-[18%] border-l border-gray-200 text-left px-3">Control</th>
                    <th rowSpan={2} className="p-2.5 w-[22%] border-l border-gray-200 text-left px-3">Specification (Refer W.I)</th>
                    <th colSpan={2} className="p-1.5 w-[13%] border-l border-gray-200 bg-gray-200/50">First Piece</th>
                    <th colSpan={2} className="p-1.5 w-[13%] border-l border-gray-200 bg-gray-200/50">Second Piece</th>
                    <th colSpan={2} className="p-1.5 w-[13%] border-l border-gray-200 bg-gray-200/50">Third Piece</th>
                    <th rowSpan={2} className="p-2.5 w-[6%] border-l border-gray-200">Status</th>
                    <th rowSpan={2} className="p-2.5 w-[7%] border-l border-gray-200">Remarks</th>
                    {!isSavedRecord && <th rowSpan={2} className="p-2.5 w-[5%] border-l border-gray-200">Action</th>}
                  </tr>
                  <tr className="bg-gray-50 text-[11px] font-bold border-t border-gray-200">
                    <th className="p-1.5 border-l border-gray-200">LH 1</th>
                    <th className="p-1.5 border-l border-gray-200">RH 1</th>
                    <th className="p-1.5 border-l border-gray-200">LH 2</th>
                    <th className="p-1.5 border-l border-gray-200">RH 2</th>
                    <th className="p-1.5 border-l border-gray-200">LH 3</th>
                    <th className="p-1.5 border-l border-gray-200">RH 3</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={isSavedRecord ? 11 : 12} className="p-8 text-gray-500 italic font-semibold text-center">
                        {!form.partName ? "Select a Part Name to continue." : !form.operationNo ? "Select an Operation No to load its control specifications." : "No rows yet. Click 'Add Control Row' above to begin."}
                      </td>
                    </tr>
                  )}
                  {rows.map((r, idx) => {
                    const isControlLocked = isSavedRecord || r.isExisting;

                    return (
                      <tr key={`row-${idx}`} className="hover:bg-orange-50/20 transition-colors">
                        <td className="p-2 font-bold bg-gray-50/60 text-gray-600">{r.slNo || idx + 1}</td>

                        <td className={`p-1 text-left px-2 font-bold uppercase border-l border-gray-200 ${isControlLocked ? "bg-gray-50/40" : "bg-white"}`}>
                          <input
                            type="text"
                            readOnly={isControlLocked}
                            placeholder="Enter Control"
                            className={`w-full font-bold outline-none uppercase p-1.5 rounded ${isControlLocked ? "bg-transparent cursor-not-allowed text-gray-800" : "border border-orange-200 focus:bg-white"}`}
                            value={r.controlName}
                            onFocus={(e) => {
                              activeFieldRef.current = { idx, field: "controlName", element: e.target };
                            }}
                            onChange={(e) => updateRow(idx, "controlName", e.target.value)}
                          />
                        </td>

                        <td
                          className={`p-1 text-left px-2 font-bold text-gray-900 border-l border-gray-200 ${isControlLocked ? "bg-gray-50/40" : "bg-white"}`}
                          onPaste={(e) => handleCellPaste(e, idx)}
                        >
                          <input
                            type="text"
                            readOnly={isControlLocked}
                            placeholder="Enter Specification"
                            className={`w-full font-semibold outline-none text-gray-900 p-1.5 rounded ${isControlLocked ? "bg-transparent cursor-not-allowed text-gray-800" : "border border-orange-200 focus:bg-white"}`}
                            value={r.specification}
                            onFocus={(e) => {
                              activeFieldRef.current = { idx, field: "specification", element: e.target };
                            }}
                            onChange={(e) => updateRow(idx, "specification", e.target.value)}
                          />
                          {r.image && (
                            <div className="relative inline-block mt-1">
                              <img
                                src={r.image}
                                alt="Specification"
                                onClick={() => setPreviewImage(r.image)}
                                className="max-h-20 max-w-full object-contain border border-gray-300 rounded bg-white cursor-zoom-in shadow-xs"
                              />
                              {!isControlLocked && (
                                <button
                                  type="button"
                                  onClick={() => updateRow(idx, "image", "")}
                                  className="absolute -top-2 -right-2 bg-red-600 hover:bg-red-700 text-white rounded-full p-0.5 shadow cursor-pointer"
                                  title="Remove image"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          )}
                          {!isControlLocked && !r.image && (
                            <button
                              type="button"
                              onClick={() => handlePasteButton(idx)}
                              className="mt-1 inline-flex items-center gap-1 bg-white hover:bg-orange-500 hover:text-white border border-gray-300 rounded px-2 py-1 font-bold text-[10px] text-gray-700 uppercase shadow-xs transition-all cursor-pointer"
                              title="Paste image from clipboard"
                            >
                              <ImagePlus className="w-3 h-3" /> Paste Image
                            </button>
                          )}
                        </td>

                        {["LH1", "RH1", "LH2", "RH2", "LH3", "RH3"].map((f) => (
                          <td key={f} className="p-0 border-l border-gray-200">
                            <input
                              type="text"
                              placeholder="-"
                              className="w-full h-full text-center p-2 outline-none font-semibold bg-transparent focus:bg-white"
                              value={r[f]}
                              onFocus={(e) => {
                                activeFieldRef.current = { idx, field: f, element: e.target };
                              }}
                              onChange={(e) => updateRow(idx, f, e.target.value)}
                            />
                          </td>
                        ))}

                        <td className="p-1 border-l border-gray-200">
                          <select
                            className={`w-full text-center font-bold text-xs p-1.5 rounded-lg outline-none bg-white border border-gray-300 cursor-pointer ${
                              r.status === 'OK' ? 'text-green-700' : r.status === 'NOT OK' ? 'text-red-700' : 'text-gray-800'
                            }`}
                            value={r.status || ""}
                            onChange={(e) => updateRow(idx, "status", e.target.value)}
                          >
                            <option value="">--</option>
                            <option value="OK">OK</option>
                            <option value="NOT OK">NOT OK</option>
                          </select>
                        </td>

                        <td className="p-0 border-l border-gray-200">
                          <input
                            type="text"
                            placeholder="Remarks"
                            className="w-full h-full p-2 text-center outline-none font-medium text-[11px] bg-transparent focus:bg-white"
                            value={r.remarks}
                            onFocus={(e) => {
                              activeFieldRef.current = { idx, field: "remarks", element: e.target };
                            }}
                            onChange={(e) => updateRow(idx, "remarks", e.target.value)}
                          />
                        </td>

                        {!isSavedRecord && (
                          <td className="p-1 border-l border-gray-200">
                            {!r.isExisting ? (
                              <button
                                type="button"
                                onClick={() => handleDeleteRow(idx)}
                                className="text-red-500 hover:text-red-700 p-1 transition-colors cursor-pointer"
                                title="Delete row"
                              >
                                <Trash2 className="w-4 h-4 mx-auto" />
                              </button>
                            ) : (
                              <span className="text-[10px] text-gray-400 font-bold uppercase">Locked</span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </fieldset>
          </div>
        </div>

        {/* 5. NOTES CARD */}
        <div className="bg-gray-50/70 rounded-xl border border-gray-200 p-4 space-y-1.5 text-xs text-gray-700 font-medium">
          <div className="flex items-center gap-1.5 text-gray-900 font-extrabold uppercase tracking-wide pb-1">
            <Info className="w-4 h-4 text-orange-500" />
            <span>Process & Setup Directives:</span>
          </div>
          <p>1. For setting trial prefer rejected components should be marked with pink paint identification. If pink colour component is not available, put red paint mark on the line part with proper higher authority approval so as to use it. The same should be verified and disposed.</p>
          <p>2. To identify control specification refer JSV parameter in relevant work instruction (process sheet). Do statistical approval for special characteristics for 3 subgroups.</p>
          <p>3. Keep the set up part with proper traceability, and if found any deviation reactivity is applied.</p>
          <p>4. After Regular holiday product conformance will done by inprocess gauges and final inspection gauges.</p>
          <p>5. Error proofs and Process parameters should be verified during set-up change.</p>
        </div>

        {/* 6. APPROVAL ROUTING GRID */}
        <div className="bg-white rounded-xl border border-gray-300 p-5 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
            <span className="font-extrabold text-gray-900 text-xs sm:text-sm uppercase tracking-wide">
              Authorization & Sign-off Matrix
            </span>
          </div>

          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="w-full border-collapse text-xs text-center min-w-[800px]">
              <thead>
                <tr className="bg-gray-100 font-extrabold text-gray-800 border-b border-gray-200 uppercase tracking-wider text-[11px]">
                  <th className="p-3 w-1/4">INSPECTOR</th>
                  <th className="p-3 w-1/4 border-l border-gray-200">SHIFT INCHARGE</th>
                  <th className="p-3 w-1/4 border-l border-gray-200">HOF-INSPN (QUALITY)</th>
                  <th className="p-3 w-1/4 border-l border-gray-200">HOF-PRODN (PRODUCTION)</th>
                </tr>
              </thead>
              <tbody>
                <tr className="h-20">
                  <td className="p-3 text-center align-middle bg-gray-50/30">
                    {renderApproverCell({
                      approved: isInspectorApproved,
                      signedBy: signatures.inspector,
                      assigned: form.assignedQc,
                      field: "assignedQc",
                      users: qcUsers,
                      placeholder: "-- Select QC --",
                    })}
                  </td>

                  <td className="p-3 text-center align-middle bg-gray-50/30 border-l border-gray-200">
                    {isShiftInchargeApproved ? (
                      <div className="flex flex-col items-center justify-center animate-in fade-in duration-200">
                        <span className="text-[10px] font-bold text-green-600 uppercase tracking-wider">
                          Approved By ✓
                        </span>
                        <span className="text-xs font-black text-gray-900 uppercase mt-0.5">
                          approved by {signatures.shiftIncharge}
                        </span>
                      </div>
                    ) : isShiftIncharge ? (
                      <button
                        type="button"
                        onClick={handleApproveShiftIncharge}
                        className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-5 py-2 rounded-lg shadow hover:shadow-md transition-all uppercase tracking-wider cursor-pointer"
                      >
                        Approve Incharge
                      </button>
                    ) : (
                      <span className="text-gray-400 text-xs italic font-medium">Pending Shift Incharge</span>
                    )}
                  </td>

                  <td className="p-3 text-center align-middle bg-gray-50/30 border-l border-gray-200">
                    {renderApproverCell({
                      approved: isHofInspectionApproved,
                      signedBy: signatures.hofInspection,
                      assigned: form.assignedHofInspection,
                      field: "assignedHofInspection",
                      users: hofInspnUsers,
                      placeholder: "-- Select HOF-INSPN --",
                    })}
                  </td>

                  <td className="p-3 text-center align-middle bg-gray-50/30 border-l border-gray-200">
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
        </div>

        {/* 7. FOOTER SAVE ACTIONS */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t border-gray-200">
          <span className="text-xs text-gray-500 font-semibold text-center sm:text-left">{qfValue}</span>
          <button
            type="button"
            onClick={handleSaveVerification}
            disabled={isSaving || saveSuccess || isSavedRecord}
            className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white px-9 py-3.5 rounded-xl font-black shadow-lg hover:shadow-orange-500/25 flex items-center justify-center gap-2 uppercase tracking-wider text-xs sm:text-sm transition-all cursor-pointer active:scale-95"
          >
            <Save className="w-4 h-4" /> {isSaving ? "SAVING..." : saveSuccess || isSavedRecord ? "SAVED ✓" : "Save Verification Record"}
          </button>
        </div>
      </div>
    </div>
  );
}