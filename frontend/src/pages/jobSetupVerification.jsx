import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useLineSet } from "../context/LineSetContext.jsx";
import { ArrowLeft, FileDown, Plus, Trash2, Edit3, Save, RefreshCw } from "lucide-react";
import Header from "../components/Header";

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

const SPECIAL_CHARS = ["Ø", "±", "°", "×", "≤", "≥", "⌀", "⊥", "∥", "√", "Ra", "~", "'", '"', "µm", "R", "C"];

const REASONS = [
  "Item change",
  "M/c change",
  "Fixture change",
  "Significant M/c Breakdown",
  "Operation change",
  "Preventive maintenance",
  "Every 3 months JSV to be done for continuous running line",
];

const INITIAL_ROWS_COUNT = 10;

const createEmptyRow = (slNo = 1) => ({
  slNo,
  controlName: "",
  specification: "",
  LH1: "",
  RH1: "",
  LH2: "",
  RH2: "",
  LH3: "",
  RH3: "",
  status: "OK",
  remarks: "",
});

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
  const location = useLocation();
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
  const isQC = currentUserRole === "qc" || currentUserRole === "qualitycontroller";
  const isPE =
    currentUserRole === "pe" ||
    currentUserRole === "productengineer" ||
    currentUserRole === "productionengineer";
  const isHOF =
    currentUserRole === "hof" ||
    currentUserRole === "headfacility" ||
    currentUserRole === "headofproduction";

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSavedRecord, setIsSavedRecord] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "" });
  const [configModalOpen, setConfigModalOpen] = useState(false);

  // Master Data Dropdowns
  const [machineDetails, setMachineDetails] = useState([]);
  const [lineMappings, setLineMappings] = useState([]);
  const [loadingMasterData, setLoadingMasterData] = useState(true);

  // Approver dropdown users
  const [qcUsers, setQcUsers] = useState([]);
  const [peUsers, setPeUsers] = useState([]);
  const [hofUsers, setHofUsers] = useState([]);

  // Active input ref tracking for special symbol insertion
  const activeInputInfoRef = useRef({ rowIndex: null, field: null, element: null });

  const triggerToast = (message, type = "error") => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: "", type: "" }), 4000);
  };

  // 1. Basic Form Information
  const [form, setForm] = useState({
    id: null,
    machineShop: shopId || "3",
    partName: "",
    partNo: "",
    operationNo: "",
    operationDescription: "",
    date: getTodayISODate(),
    shift: "1st",
    setterName: isShiftIncharge && currentUsername !== "Unknown" ? currentUsername : "",
    selectedReasons: ["Item change"],
    // Time tracking
    settingStartedAt: "",
    inspectionTimeStage: "",
    settingFinishedAt: "",
    settingTime: "",
    inspectionTimeMetrology: "",
    totalTime: "",
    // Details of setting change
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
    // Assigned Approvers
    assignedQc: "",
    assignedPe: "",
    assignedHof: "",
  });

  // 2. Dynamic Inspection Rows (10 Default Rows)
  const [rows, setRows] = useState(
    Array.from({ length: INITIAL_ROWS_COUNT }, (_, i) => createEmptyRow(i + 1))
  );

  // 3. Signatures State
  const [signatures, setSignatures] = useState({
    inspector: "",
    shiftIncharge: "",
    hofInspection: "",
    hofProduction: "",
  });

  // 4. Temporary Master Specs Configurator State
  const [masterSpecs, setMasterSpecs] = useState([]);

  // Fetch Master Data (Parts, Mappings, Operations, Approvers)
  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem("token");
        const headers = { Authorization: `Bearer ${token}` };

        // 1. Master Details
        if (shopId) {
          const res = await fetch(`${process.env.REACT_APP_API_URL || ""}/api/machine-shop/${shopId}/details`, { headers }).catch(() => null);
          if (res && res.ok) {
            const data = await res.json();
            setMachineDetails(data || []);
          }
          const mappingRes = await fetch(`${process.env.REACT_APP_API_URL || ""}/api/mappings/${shopId}/lines`, { headers }).catch(() => null);
          if (mappingRes && mappingRes.ok) {
            const mappingData = await mappingRes.json();
            setLineMappings(mappingData || []);
          }
        }

        // 2. Approver Users
        const [qcRes, peRes, hofRes] = await Promise.all([
          fetch(`${process.env.REACT_APP_API_URL || ""}/api/daily-production-report/incharges`, { headers }).catch(() => null),
          fetch(`${process.env.REACT_APP_API_URL || ""}/api/daily-production-report/pe-incharges`, { headers }).catch(() => null),
          fetch(`${process.env.REACT_APP_API_URL || ""}/api/daily-production-report/hof-incharges`, { headers }).catch(() => null),
        ]);

        if (qcRes && qcRes.ok) {
          const data = await qcRes.json();
          setQcUsers(data.qcList || []);
        } else {
          setQcUsers([{ username: "qc" }, { username: "qc1" }]);
        }

        if (peRes && peRes.ok) {
          const data = await peRes.json();
          setPeUsers(data.peList || []);
        } else {
          setPeUsers([{ username: "pe" }]);
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

  // Derive distinct Part Names from master data or line mappings
  const partOptions = Array.from(
    new Set([
      ...machineDetails.map((m) => m.partName).filter(Boolean),
      ...lineMappings.map((m) => m.partSet).filter(Boolean),
      "KNUCKLE - STRG, FR LH/RH(XBA MY19)",
      "PIVOT SUSPENSION GOA CC21 (078) LH/RH",
    ])
  );

  // Derive Operation Numbers based on selected Part or standard operations
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

  // Sync with LineSetContext if active
  useEffect(() => {
    if (lineSet?.partName && !form.partName) {
      setForm((prev) => ({
        ...prev,
        partName: lineSet.partName || prev.partName,
        partNo: lineSet.partNo || prev.partNo,
      }));
    }
  }, [lineSet]);

  // Automatic calculation of Setting Time & Total Time
  useEffect(() => {
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
  }, [form.settingStartedAt, form.settingFinishedAt, form.inspectionTimeMetrology]);

  // Insert Special Character (EXACTLY ONCE at cursor position)
  const handleInsertSymbol = (e, char) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const { rowIndex, field, element } = activeInputInfoRef.current;
    if (rowIndex === null || !field) {
      triggerToast("Click on a Control or Specification field first to insert symbol", "info");
      return;
    }

    setRows((prev) => {
      const updated = [...prev];
      const currentVal = updated[rowIndex]?.[field] || "";

      let start = currentVal.length;
      let end = currentVal.length;

      if (element && typeof element.selectionStart === "number") {
        start = element.selectionStart;
        end = element.selectionEnd;
      }

      const nextVal = currentVal.slice(0, start) + char + currentVal.slice(end);
      updated[rowIndex] = {
        ...updated[rowIndex],
        [field]: nextVal,
      };

      setTimeout(() => {
        if (element) {
          element.focus();
          element.setSelectionRange(start + char.length, start + char.length);
        }
      }, 0);

      return updated;
    });
  };

  // Load Record Data Helper
  const loadRecordData = (record) => {
    if (!record) return;
    setIsSavedRecord(true);
    setForm({
      id: record.Id,
      machineShop: record.MachineShop || shopId || "3",
      partName: record.PartName || "",
      partNo: record.PartNo || "",
      operationNo: record.OperationNo || "",
      operationDescription: record.OperationDescription || "",
      date: record.ReportDate ? String(record.ReportDate).split("T")[0] : getTodayISODate(),
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
      assignedQc: record.assignedQc || "",
      assignedPe: record.assignedPe || "",
      assignedHof: record.assignedHof || "",
    });

    if (record.ActualInspectionData) {
      try {
        const parsed = typeof record.ActualInspectionData === "string" ? JSON.parse(record.ActualInspectionData) : record.ActualInspectionData;
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRows(parsed);
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

  // Fetch Master Specifications when Part or Operation changes
  const fetchControlSpecifications = async (partName, operationNo) => {
    if (!partName || !operationNo) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${process.env.REACT_APP_API_URL || ""}/api/job-setup-verification/specifications?partName=${encodeURIComponent(partName)}&operationNo=${encodeURIComponent(operationNo)}&shopId=${shopId || 3}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        if (data.specifications && data.specifications.length > 0) {
          setRows(
            data.specifications.map((spec, idx) => ({
              slNo: spec.slNo || idx + 1,
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
          if (data.operationDescription) {
            setForm((prev) => ({ ...prev, operationDescription: data.operationDescription }));
          }
          triggerToast(`Loaded ${data.specifications.length} Master Control Specifications.`, "success");
        } else {
          triggerToast("No Master specifications found. You can enter them directly or click 'Configure Master'.", "info");
        }
      }
    } catch (err) {
      console.error("Fetch specs error:", err);
    }
  };

  // Dropdown change handlers
  const handlePartNameChange = (val) => {
    const matched = machineDetails.find((m) => m.partName === val);
    const partNoVal = matched?.partNo || form.partNo;
    setForm((prev) => ({ ...prev, partName: val, partNo: partNoVal }));
    if (setLineSet) {
      setLineSet((prev) => ({ ...prev, partName: val, partNo: partNoVal }));
    }
    if (val && form.operationNo) {
      fetchControlSpecifications(val, form.operationNo);
    }
  };

  const handleOperationNoChange = (val) => {
    setForm((prev) => ({ ...prev, operationNo: val }));
    if (form.partName && val) {
      fetchControlSpecifications(form.partName, val);
    }
  };

  // URL params lookup
  useEffect(() => {
    const qPart = searchParams.get("partName");
    const qOp = searchParams.get("operationNo");
    if (qPart && qOp) {
      setForm((prev) => ({ ...prev, partName: qPart, operationNo: qOp }));
      fetchControlSpecifications(qPart, qOp);
    }
  }, [searchParams]);

  // Open Master Spec Configurator
  const openMasterConfigurator = () => {
    if (!form.partName || !form.operationNo) {
      triggerToast("Please select Part Name and Operation No first.", "error");
      return;
    }
    setMasterSpecs(
      rows.map((r, i) => ({
        slNo: r.slNo || i + 1,
        controlName: r.controlName || "",
        specification: r.specification || "",
      }))
    );
    setConfigModalOpen(true);
  };

  // Save Master Specifications permanently
  const handleSaveMasterSpecs = async () => {
    if (!form.partName || !form.operationNo) {
      triggerToast("Part Name and Operation No are required.", "error");
      return;
    }
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${process.env.REACT_APP_API_URL || ""}/api/job-setup-verification/specifications`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          machineShop: form.machineShop,
          partName: form.partName,
          partNo: form.partNo,
          operationNo: form.operationNo,
          operationDescription: form.operationDescription,
          specifications: masterSpecs,
        }),
      });

      if (!res.ok) throw new Error("Failed to save Master Specifications");

      setRows(
        masterSpecs.map((s, idx) => ({
          slNo: s.slNo || idx + 1,
          controlName: s.controlName,
          specification: s.specification,
          LH1: rows[idx]?.LH1 || "",
          RH1: rows[idx]?.RH1 || "",
          LH2: rows[idx]?.LH2 || "",
          RH2: rows[idx]?.RH2 || "",
          LH3: rows[idx]?.LH3 || "",
          RH3: rows[idx]?.RH3 || "",
          status: rows[idx]?.status || "OK",
          remarks: rows[idx]?.remarks || "",
        }))
      );

      setConfigModalOpen(false);
      triggerToast("Master Specifications saved permanently for this Part & Operation!", "success");
    } catch (err) {
      triggerToast(err.message || "Failed to save specs", "error");
    }
  };

  // PDF Download Handler
  const handleDownloadPdf = async () => {
    if (!form.partName || !form.operationNo) {
      triggerToast("Please select Part Name and Operation No to preview PDF.", "error");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const params = new URLSearchParams({
        shopId: String(shopId || 3),
        partName: form.partName,
        operationNo: form.operationNo,
        date: form.date,
        shift: form.shift,
      });

      const res = await fetch(
        `${process.env.REACT_APP_API_URL || ""}/api/job-setup-verification/report?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!res.ok) throw new Error("PDF report generation failed");

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `Job_Setup_Verification_${form.partName}_${form.operationNo}_${form.date}.pdf`;
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

  // APPROVAL ACTIONS
  const handleApproveInspector = () => {
    setSignatures((prev) => ({ ...prev, inspector: currentUsername || "Approved" }));
    triggerToast("Inspector sign-off approved successfully.", "success");
  };

  const handleApproveShiftIncharge = () => {
    if (!isShiftIncharge) {
      triggerToast("Only Shift Incharge can approve this.", "error");
      return;
    }
    setSignatures((prev) => ({ ...prev, shiftIncharge: currentUsername }));
    triggerToast("Shift Incharge Approved!", "success");
  };

  const handleApproveHofInspection = () => {
    if (!isQC) {
      triggerToast("Only QC can verify this record.", "error");
      return;
    }
    if (form.assignedQc && form.assignedQc.toLowerCase() !== currentUsername.toLowerCase()) {
      triggerToast(`Assigned to QC: ${form.assignedQc.toUpperCase()}`, "error");
      return;
    }
    setSignatures((prev) => ({ ...prev, hofInspection: currentUsername }));
    triggerToast("HOF - Inspection (Quality) Approved!", "success");
  };

  const handleApproveHofProduction = () => {
    if (!isPE && !isHOF) {
      triggerToast("Only Production Engineer / HOF can approve this.", "error");
      return;
    }
    if (form.assignedHof && form.assignedHof.toLowerCase() !== currentUsername.toLowerCase()) {
      triggerToast(`Assigned to HOF: ${form.assignedHof.toUpperCase()}`, "error");
      return;
    }
    setSignatures((prev) => ({ ...prev, hofProduction: currentUsername }));
    triggerToast("HOF - Production Approved!", "success");
  };

  // Save Verification Record
  const handleSaveVerification = async () => {
    if (!form.partName || !form.operationNo) {
      triggerToast("Please select Part Name and Operation No.", "error");
      return;
    }

    if (isShiftIncharge) {
      if (!signatures.inspector) {
        triggerToast("Please click 'Approve' under INSPECTOR before submitting.", "error");
        return;
      }
      if (!form.assignedQc) {
        triggerToast("Please select a QC in 'HOF-INSPN'.", "error");
        return;
      }
      if (!form.assignedHof) {
        triggerToast("Please select a HOF in 'HOF-PRODN'.", "error");
        return;
      }
    }

    setIsSaving(true);
    setSaveSuccess(false);

    const payload = {
      ...form,
      reasonForSetup: form.selectedReasons.join(","),
      actualInspectionData: rows,
      controlSpecifications: rows.map((r) => ({
        slNo: r.slNo,
        controlName: r.controlName,
        specification: r.specification,
      })),
      signatures: {
        inspector: signatures.inspector || currentUsername,
        shiftIncharge: signatures.shiftIncharge || currentUsername,
        hofInspection: isQC ? currentUsername : signatures.hofInspection || "Pending",
        hofProduction: (isPE || isHOF) ? currentUsername : signatures.hofProduction || "Pending",
      },
    };

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${process.env.REACT_APP_API_URL || ""}/api/job-setup-verification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Save operation failed");
      const result = await res.json();

      setIsSaving(false);
      setSaveSuccess(true);
      setIsSavedRecord(true);
      if (result.id) setForm((prev) => ({ ...prev, id: result.id }));
      triggerToast("Job Setup Verification record saved successfully!", "success");
    } catch (err) {
      setIsSaving(false);
      triggerToast(err.message || "Failed to save verification record", "error");
    }
  };

  const isInspectorApproved = Boolean(signatures.inspector && signatures.inspector !== "Pending");
  const isShiftInchargeApproved = Boolean(signatures.shiftIncharge && signatures.shiftIncharge !== "Pending");
  const isHofInspectionApproved = Boolean(signatures.hofInspection && signatures.hofInspection !== "Pending");
  const isHofProductionApproved = Boolean(signatures.hofProduction && signatures.hofProduction !== "Pending");

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

      {/* MASTER SPECS CONFIGURATION MODAL */}
      {configModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden border-2 border-orange-500">
            <div className="p-4 bg-orange-600 text-white flex justify-between items-center">
              <div>
                <h3 className="font-bold text-base uppercase">Configure Control Specifications Master Template</h3>
                <p className="text-xs opacity-90">{form.partName || "Select Part"} | {form.operationNo || "Select Operation"}</p>
              </div>
              <button onClick={() => setConfigModalOpen(false)} className="text-white hover:text-gray-200 text-xl font-black">×</button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-3">
              <table className="w-full text-xs border border-gray-400 text-center">
                <thead className="bg-gray-100 font-bold sticky top-0">
                  <tr>
                    <th className="border border-gray-400 p-2 w-[8%]">Sl.No</th>
                    <th className="border border-gray-400 p-2 w-[42%]">Control</th>
                    <th className="border border-gray-400 p-2 w-[42%]">Control Specification (Refer W.I)</th>
                    <th className="border border-gray-400 p-2 w-[8%]">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {masterSpecs.map((spec, idx) => (
                    <tr key={`spec-${idx}`} className="bg-white">
                      <td className="border border-gray-400 p-1 font-bold">{idx + 1}</td>
                      <td className="border border-gray-400 p-1">
                        <input
                          type="text"
                          className="w-full p-1 font-semibold uppercase outline-none"
                          value={spec.controlName}
                          placeholder="e.g. BORE DIAMETER"
                          onChange={(e) => {
                            const updated = [...masterSpecs];
                            updated[idx].controlName = e.target.value;
                            setMasterSpecs(updated);
                          }}
                        />
                      </td>
                      <td className="border border-gray-400 p-1">
                        <input
                          type="text"
                          className="w-full p-1 font-semibold outline-none text-gray-900"
                          value={spec.specification}
                          placeholder="e.g. Ø77 +0.030 / +0.076"
                          onChange={(e) => {
                            const updated = [...masterSpecs];
                            updated[idx].specification = e.target.value;
                            setMasterSpecs(updated);
                          }}
                        />
                      </td>
                      <td className="border border-gray-400 p-1">
                        <button
                          type="button"
                          onClick={() => setMasterSpecs(masterSpecs.filter((_, i) => i !== idx))}
                          className="text-red-600 hover:text-red-800 font-bold"
                        >
                          <Trash2 className="w-4 h-4 mx-auto" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <button
                type="button"
                onClick={() => setMasterSpecs([...masterSpecs, { slNo: masterSpecs.length + 1, controlName: "", specification: "" }])}
                className="flex items-center gap-1 bg-gray-800 hover:bg-gray-900 text-white px-3 py-1.5 rounded font-bold text-xs"
              >
                <Plus className="w-3.5 h-3.5" /> Add Row
              </button>
            </div>

            <div className="p-3 bg-gray-100 border-t flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfigModalOpen(false)}
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveMasterSpecs}
                className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded font-bold text-xs uppercase"
              >
                Save Master Specifications
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAIN DOCUMENT CARD */}
      <div className="bg-white w-full max-w-[98rem] rounded-xl p-4 sm:p-6 md:p-8 shadow-2xl border-4 border-gray-100 space-y-6">
        
        {/* CARD HEADER & PDF PREVIEW (MATCHING EXAMPLE.JSX) */}
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
              onClick={openMasterConfigurator}
              className="flex items-center gap-1.5 bg-orange-600 hover:bg-orange-700 text-white px-3.5 py-2 rounded-lg font-bold text-xs uppercase tracking-wider shadow transition-colors cursor-pointer"
            >
              <Edit3 className="w-4 h-4" /> Configure Master
            </button>
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
        <div className="border border-gray-800 p-3 bg-gray-50 text-xs rounded">
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
        </div>

        {/* SECTION 2: BASIC INFO & TIME TRACKING GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-2 border border-gray-800 text-xs rounded overflow-hidden">
          {/* Left Column: Job Information */}
          <div className="p-3.5 border-b lg:border-b-0 lg:border-r border-gray-800 space-y-2.5 bg-white">
            
            {/* Part Name Dropdown */}
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
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
                <select
                  className="border-b border-gray-400 p-1 font-bold bg-transparent outline-none w-28"
                  value={form.shift}
                  onChange={(e) => setForm({ ...form, shift: e.target.value })}
                >
                  <option value="1st">1st Shift</option>
                  <option value="2nd">2nd Shift</option>
                  <option value="3rd">3rd Shift</option>
                </select>
              </div>
            </div>

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
                  onChange={(e) => handleOperationNoChange(e.target.value)}
                >
                  <option value="">-- Select Operation No --</option>
                  {operationOptions.map((op) => (
                    <option key={op} value={op}>
                      {op}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => fetchControlSpecifications(form.partName, form.operationNo)}
                  className="bg-gray-100 hover:bg-gray-200 border p-1 rounded font-bold text-[11px] flex items-center gap-1"
                  title="Reload Master Specifications"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
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
          </div>

          {/* Right Column: Time Tracking */}
          <div className="p-3.5 space-y-2 bg-orange-50/40">
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
          </div>
        </div>

        {/* SECTION 3: DETAILS OF SETTING CHANGE */}
        <div className="border border-gray-800 text-xs overflow-x-auto rounded">
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
        </div>

        {/* INSTRUCTION BAR */}
        <div className="bg-orange-100 border border-orange-300 p-2 text-xs font-semibold text-orange-950 text-center rounded">
          ⚠️ Before setting change clear all the running items after completion of all operation from the hand.
        </div>

        {/* SPECIAL CHARACTER TOOLBAR FOR ACTIVE INPUT */}
        <div className="bg-orange-50 border border-orange-200 p-2.5 rounded flex flex-wrap items-center gap-1.5 text-xs shadow-inner">
          <span className="font-bold text-gray-800 mr-2 uppercase text-[11px]">Insert Symbol to Control / Specification:</span>
          {SPECIAL_CHARS.map((char) => (
            <button
              key={char}
              type="button"
              onMouseDown={(e) => handleInsertSymbol(e, char)}
              className="bg-white hover:bg-orange-500 hover:text-white border border-gray-300 rounded px-2.5 py-1 font-bold text-gray-800 shadow-sm transition-all"
            >
              {char}
            </button>
          ))}
        </div>

        {/* SECTION 4: MAIN ACTUAL VALUES INSPECTION TABLE (10 DEFAULT ROWS, SUPPORTS 130+) */}
        <div className="space-y-2">
          <div className="flex justify-between items-center px-1">
            <span className="font-black text-gray-900 uppercase text-xs">
              ACTUAL VALUES (Minimum two pieces required) — {rows.length} Rows
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRows([...rows, createEmptyRow(rows.length + 1)])}
                className="bg-gray-800 hover:bg-gray-900 text-white text-xs font-bold px-3 py-1.5 rounded flex items-center gap-1 shadow cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Row
              </button>
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => setRows(rows.slice(0, -1))}
                  className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-3 py-1.5 rounded flex items-center gap-1 shadow cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Remove Row
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto max-h-[600px] border-2 border-gray-800 rounded">
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
                {rows.map((r, idx) => (
                  <tr key={`row-${idx}`} className="h-9 hover:bg-orange-50/30">
                    <td className="border border-gray-800 p-1 font-bold bg-gray-50">{r.slNo || idx + 1}</td>
                    
                    {/* Control Name */}
                    <td className="border border-gray-800 p-0 text-left px-1.5 font-bold uppercase text-[11px] bg-gray-50/50">
                      <input
                        type="text"
                        placeholder="e.g. BORE DIAMETER"
                        className="w-full bg-transparent font-bold outline-none uppercase"
                        value={r.controlName}
                        onFocus={(e) => {
                          activeInputInfoRef.current = { rowIndex: idx, field: "controlName", element: e.target };
                        }}
                        onChange={(e) => {
                          const updated = [...rows];
                          updated[idx].controlName = e.target.value;
                          setRows(updated);
                        }}
                      />
                    </td>

                    {/* Control Specification */}
                    <td className="border border-gray-800 p-0 text-left px-1.5 font-bold text-gray-900 bg-gray-50/80">
                      <input
                        type="text"
                        placeholder="e.g. Ø77 +0.030 / +0.076"
                        className="w-full bg-transparent font-semibold outline-none text-gray-900"
                        value={r.specification}
                        onFocus={(e) => {
                          activeInputInfoRef.current = { rowIndex: idx, field: "specification", element: e.target };
                        }}
                        onChange={(e) => {
                          const updated = [...rows];
                          updated[idx].specification = e.target.value;
                          setRows(updated);
                        }}
                      />
                    </td>

                    {/* Actual Values LH1 to RH3 */}
                    <td className="border border-gray-800 p-0">
                      <input
                        type="text"
                        placeholder="-"
                        className="w-full h-full text-center p-1 outline-none font-semibold"
                        value={r.LH1}
                        onChange={(e) => {
                          const updated = [...rows];
                          updated[idx].LH1 = e.target.value;
                          setRows(updated);
                        }}
                      />
                    </td>
                    <td className="border border-gray-800 p-0">
                      <input
                        type="text"
                        placeholder="-"
                        className="w-full h-full text-center p-1 outline-none font-semibold"
                        value={r.RH1}
                        onChange={(e) => {
                          const updated = [...rows];
                          updated[idx].RH1 = e.target.value;
                          setRows(updated);
                        }}
                      />
                    </td>
                    <td className="border border-gray-800 p-0">
                      <input
                        type="text"
                        placeholder="-"
                        className="w-full h-full text-center p-1 outline-none font-semibold"
                        value={r.LH2}
                        onChange={(e) => {
                          const updated = [...rows];
                          updated[idx].LH2 = e.target.value;
                          setRows(updated);
                        }}
                      />
                    </td>
                    <td className="border border-gray-800 p-0">
                      <input
                        type="text"
                        placeholder="-"
                        className="w-full h-full text-center p-1 outline-none font-semibold"
                        value={r.RH2}
                        onChange={(e) => {
                          const updated = [...rows];
                          updated[idx].RH2 = e.target.value;
                          setRows(updated);
                        }}
                      />
                    </td>
                    <td className="border border-gray-800 p-0">
                      <input
                        type="text"
                        placeholder="-"
                        className="w-full h-full text-center p-1 outline-none font-semibold"
                        value={r.LH3}
                        onChange={(e) => {
                          const updated = [...rows];
                          updated[idx].LH3 = e.target.value;
                          setRows(updated);
                        }}
                      />
                    </td>
                    <td className="border border-gray-800 p-0">
                      <input
                        type="text"
                        placeholder="-"
                        className="w-full h-full text-center p-1 outline-none font-semibold"
                        value={r.RH3}
                        onChange={(e) => {
                          const updated = [...rows];
                          updated[idx].RH3 = e.target.value;
                          setRows(updated);
                        }}
                      />
                    </td>

                    {/* OK / NOT OK Status */}
                    <td className="border border-gray-800 p-1">
                      <select
                        className={`w-full text-center font-bold text-xs p-1 rounded outline-none ${
                          r.status === "OK" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                        }`}
                        value={r.status || "OK"}
                        onChange={(e) => {
                          const updated = [...rows];
                          updated[idx].status = e.target.value;
                          setRows(updated);
                        }}
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
                        onChange={(e) => {
                          const updated = [...rows];
                          updated[idx].remarks = e.target.value;
                          setRows(updated);
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                {/* 1. Inspector / Operator */}
                <td className="border border-gray-800 p-2 text-center align-middle bg-gray-50/40">
                  {isInspectorApproved ? (
                    <div className="flex flex-col items-center justify-center animate-in fade-in duration-200">
                      <span className="text-[10px] font-bold text-green-600 uppercase">
                        Approved By ✓
                      </span>
                      <span className="text-xs font-black text-gray-900 uppercase">
                        {signatures.inspector}
                      </span>
                    </div>
                  ) : isShiftIncharge ? (
                    <button
                      type="button"
                      onClick={handleApproveInspector}
                      className="bg-orange-500 hover:bg-orange-600 text-white text-[11px] font-bold px-4 py-1.5 rounded shadow hover:scale-105 transition-all uppercase tracking-wider cursor-pointer"
                    >
                      Approve
                    </button>
                  ) : (
                    <span className="text-gray-400 text-xs italic">Pending Inspector</span>
                  )}
                </td>

                {/* 2. Shift Incharge */}
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

                {/* 3. HOF - Inspection (QC) */}
                <td className="border border-gray-800 p-2 text-center align-middle bg-gray-50/40">
                  {isHofInspectionApproved ? (
                    <div className="flex flex-col items-center justify-center animate-in fade-in duration-200">
                      <span className="text-[10px] font-bold text-green-600 uppercase">
                        Approved By ✓
                      </span>
                      <span className="text-xs font-black text-gray-900 uppercase">
                        approved by {signatures.hofInspection}
                      </span>
                    </div>
                  ) : isQC ? (
                    <div className="flex flex-col items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={handleApproveHofInspection}
                        className="bg-green-600 hover:bg-green-700 text-white text-[11px] font-bold px-4 py-1.5 rounded shadow hover:scale-105 transition-all uppercase tracking-wider cursor-pointer"
                      >
                        Approve QC
                      </button>
                      {form.assignedQc && (
                        <span className="text-[10px] text-gray-500 font-semibold uppercase">
                          (Assigned: {form.assignedQc})
                        </span>
                      )}
                    </div>
                  ) : isSavedRecord ? (
                    <div className="flex flex-col items-center justify-center">
                      <span className="text-red-600 text-xs font-bold uppercase">pending</span>
                      {form.assignedQc && (
                        <span className="text-[10px] font-bold text-gray-500 uppercase mt-0.5">
                          (Assigned: {form.assignedQc})
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1 w-full">
                      <select
                        className="w-full bg-white border border-gray-300 p-1.5 rounded font-bold text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-orange-500 text-center"
                        value={form.assignedQc || ""}
                        onChange={(e) => setForm({ ...form, assignedQc: e.target.value })}
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

                {/* 4. HOF - Production (PE / HOF) */}
                <td className="border border-gray-800 p-2 text-center align-middle bg-gray-50/40">
                  {isHofProductionApproved ? (
                    <div className="flex flex-col items-center justify-center animate-in fade-in duration-200">
                      <span className="text-[10px] font-bold text-green-600 uppercase">
                        Approved By ✓
                      </span>
                      <span className="text-xs font-black text-gray-900 uppercase">
                        approved by {signatures.hofProduction}
                      </span>
                    </div>
                  ) : (isPE || isHOF) ? (
                    <div className="flex flex-col items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={handleApproveHofProduction}
                        className="bg-green-600 hover:bg-green-700 text-white text-[11px] font-bold px-4 py-1.5 rounded shadow hover:scale-105 transition-all uppercase tracking-wider cursor-pointer"
                      >
                        Approve HOF
                      </button>
                      {form.assignedHof && (
                        <span className="text-[10px] text-gray-500 font-semibold uppercase">
                          (Assigned: {form.assignedHof})
                        </span>
                      )}
                    </div>
                  ) : isSavedRecord ? (
                    <div className="flex flex-col items-center justify-center">
                      <span className="text-red-600 text-xs font-bold uppercase">pending</span>
                      {form.assignedHof && (
                        <span className="text-[10px] font-bold text-gray-500 uppercase mt-0.5">
                          (Assigned: {form.assignedHof})
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1 w-full">
                      <select
                        className="w-full bg-white border border-gray-300 p-1.5 rounded font-bold text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-orange-500 text-center"
                        value={form.assignedHof || ""}
                        onChange={(e) => setForm({ ...form, assignedHof: e.target.value })}
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

        {/* BOTTOM ACTIONS */}
        <div className="flex justify-between items-center pt-4 border-t border-gray-300">
          <span className="text-xs text-gray-500 font-semibold">{formMeta.formCode}, Rev.No: {formMeta.revision} dt {formMeta.revisionDate}</span>
          <button
            type="button"
            onClick={handleSaveVerification}
            disabled={isSaving || saveSuccess}
            className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white px-10 py-3 rounded font-bold shadow-lg flex items-center gap-2 uppercase tracking-wider text-sm transition-colors cursor-pointer"
          >
            <Save className="w-4 h-4" /> {isSaving ? "SAVING..." : saveSuccess ? "SAVED ✓" : "Save Verification Record"}
          </button>
        </div>
      </div>
    </div>
  );
}