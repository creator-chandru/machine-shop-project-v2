import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useLineSet } from "../context/LineSetContext.jsx";
import { ArrowLeft, FileDown } from "lucide-react";
import Header from "../components/Header";

const INITIAL_ROWS = 1;

const formMeta = {
  formCode: "QF/07/MPD-10",
  revision: "00",
  revisionDate: "01.07.2021",
  title: "DAILY PRODUCTION REPORT (MACHINE SHOP)",
  company: "SAKTHI AUTO",
};

const getTodayISODate = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const createEmptyRow = (defaultPartNameNo = "") => ({
  machineNo: "",
  machineName: "",
  partNameNo: defaultPartNameNo,
  operationDescription: "",
  operatorName: "",
  produced: "",
  accepted: "",
  holdNonConformance: "",
  reasonForHold: {
    casting: "",
    castingQty: "",
    machining: "",
    machiningQty: "",
  },
  mcStopTimeReason: "",
  time: {
    from: "",
    to: "",
  },
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

export default function DailyProductionReport() {
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
  const isHOF = currentUserRole === "hof" || currentUserRole === "headfacility" || currentUserRole === "headofproduction";

  const isReadOnlyApprover = isQC || isHOF;

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [machineDetails, setMachineDetails] = useState([]);
  const [lineMappings, setLineMappings] = useState([]);
  const [loadingMachineDetails, setLoadingMachineDetails] = useState(true);
  const [qcUsers, setQcUsers] = useState([]);
  const [hofUsers, setHofUsers] = useState([]);
  const [isSavedRecord, setIsSavedRecord] = useState(false);

  const [toast, setToast] = useState({ message: "", type: "" });
  const isSavedRecordRef = useRef(false);
  const lookupSeqRef = useRef(0);
  const didInitialLookupRef = useRef(false);

  useEffect(() => {
    isSavedRecordRef.current = isSavedRecord;
  }, [isSavedRecord]);

  const triggerToast = (message, type = "error") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast({ message: "", type: "" });
    }, 4000);
  };

  // 1. Header Information
  const [header, setHeader] = useState({
    date: getTodayISODate(),
    shift: "I",
    shiftInchargeName: isShiftIncharge && currentUsername !== "Unknown" ? currentUsername : "",
    lineCode: "",
    partName: "",
    partNo: "",
    partTraceabilityMachining: "",
    assignedQc: "",
    assignedHof: "",
  });

  // 2. Production Rows
  const [rows, setRows] = useState(
    Array.from({ length: INITIAL_ROWS }, () => createEmptyRow())
  );

  // 3. Signatures
  const [signatures, setSignatures] = useState({
    shiftSupervisorProduction: "",
    shiftSupervisorQuality: "",
    productionEngineer: "",
    hofProduction: "",
  });

  // Load record data helper
  const loadRecordData = (record) => {
    if (!record) return;
    setIsSavedRecord(true);

    if (record.header) {
      setHeader({
        date: record.header.date || getTodayISODate(),
        shift: record.header.shift || "I",
        shiftInchargeName:
          record.header.shiftInchargeName ||
          (isShiftIncharge && currentUsername !== "Unknown" ? currentUsername : ""),
        lineCode: record.header.lineCode || "",
        partName: record.header.partName || "",
        partNo: record.header.partNo || "",
        partTraceabilityMachining: record.header.partTraceabilityMachining || "",
        assignedQc: record.header.assignedQc || "",
        assignedHof: record.header.assignedHof || "",
      });
    }

    if (record.rows && record.rows.length > 0) {
      setRows(record.rows);
    }

    if (record.signatures) {
      setSignatures({
        shiftSupervisorProduction: record.signatures.shiftSupervisorProduction || "",
        shiftSupervisorQuality: record.signatures.shiftSupervisorQuality || "",
        productionEngineer: record.signatures.productionEngineer || "",
        hofProduction: record.signatures.hofProduction || "",
      });
    }
  };

  // Fetch QC and HOF list for dropdowns
  useEffect(() => {
    const fetchApprovers = async () => {
      try {
        const token = localStorage.getItem("token");
        const headers = { Authorization: `Bearer ${token}` };

        // QC List
        const qcRes = await fetch(
          `${process.env.REACT_APP_API_URL || ""}/api/daily-production-report/incharges`,
          { headers }
        );
        if (qcRes.ok) {
          const data = await qcRes.json();
          setQcUsers(data.qcList || []);
        } else {
          setQcUsers([{ name: "qc", username: "qc" }, { name: "qc1", username: "qc1" }]);
        }

        // HOF List
        const hofRes = await fetch(
          `${process.env.REACT_APP_API_URL || ""}/api/daily-production-report/hof-incharges`,
          { headers }
        );
        if (hofRes.ok) {
          const data = await hofRes.json();
          setHofUsers(data.hofList || []);
        } else {
          setHofUsers([{ name: "hof", username: "hof" }]);
        }
      } catch (err) {
        setQcUsers([{ name: "qc", username: "qc" }, { name: "qc1", username: "qc1" }]);
        setHofUsers([{ name: "hof", username: "hof" }]);
      }
    };
    fetchApprovers();
  }, []);

  // Fetch Part Traceability
  const fetchPartTraceability = async (lineCode, date, shift) => {
    if (!lineCode || !date || !shift) return;

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${process.env.REACT_APP_API_URL || ""}/api/daily-production-report/traceability?lineCode=${encodeURIComponent(
          lineCode
        )}&date=${encodeURIComponent(date)}&shift=${encodeURIComponent(shift)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!response.ok) throw new Error("Failed to fetch Part Traceability");
      const data = await response.json();

      if (data.partTraceability) {
        setHeader((prev) => ({
          ...prev,
          partTraceabilityMachining: data.partTraceability,
        }));
      }
    } catch (err) {
      console.error("Part Traceability fetch error:", err);
    }
  };

  // Check existing submitted record
  const checkExistingRecord = async (lineCode, date, shift = "I") => {
    if (!lineCode || !date) return;

    const seq = ++lookupSeqRef.current;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${process.env.REACT_APP_API_URL || ""}/api/daily-production-report?machineShop=${shopId || 3}&lineCode=${encodeURIComponent(
          lineCode
        )}&date=${encodeURIComponent(date)}&shift=${encodeURIComponent(shift)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (seq !== lookupSeqRef.current) return;

      if (res.ok) {
        const data = await res.json();
        if (seq !== lookupSeqRef.current) return;
        const found = Array.isArray(data) && data.length > 0 ? data[0] : null;
        if (found && found.rows && found.rows.length > 0) {
          loadRecordData(found);
        } else {
          if (isSavedRecordRef.current) {
            setIsSavedRecord(false);
            setRows([createEmptyRow()]);
            setSignatures({
              shiftSupervisorProduction: "",
              shiftSupervisorQuality: "",
              productionEngineer: "",
              hofProduction: "",
            });
            setHeader((prev) => ({
              ...prev,
              shiftInchargeName: isShiftIncharge && currentUsername !== "Unknown" ? currentUsername : "",
            }));
          }
        }
      }
    } catch (err) {
      console.error("Check existing report error:", err);
    }
  };

  // Navigation State checking
  useEffect(() => {
    if (location.state?.record) {
      loadRecordData(location.state.record);
    } else {
      const qRecordDate = searchParams.get("date");
      const qLineCode = searchParams.get("lineCode");
      if (qRecordDate && qLineCode) {
        checkExistingRecord(qLineCode, qRecordDate, searchParams.get("shift") || "I");
      }
    }
  }, [location.state, searchParams]);

  // Sync with LineSetContext
  useEffect(() => {
    if (didInitialLookupRef.current || !lineSet?.lineCode) return;
    didInitialLookupRef.current = true;
    if (location.state?.record || searchParams.get("date")) return;
    checkExistingRecord(lineSet.lineCode, header.date, header.shift);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineSet]);

  useEffect(() => {
    if (lineSet) {
      const newLineCode = lineSet.lineCode || header.lineCode;
      const autoPartName = lineSet.partName || header.partName;
      const autoPartNo = lineSet.partNo || header.partNo;
      const defaultPartNameNo = autoPartName && autoPartNo ? `${autoPartName} / ${autoPartNo}` : "";

      setHeader((prev) => ({
        ...prev,
        lineCode: lineSet.lineCode || prev.lineCode,
        partName: lineSet.partName || prev.partName,
        partNo: lineSet.partNo || prev.partNo,
      }));

      if (defaultPartNameNo) {
        setRows((prev) =>
          prev.map((r) => ({
            ...r,
            partNameNo: r.partNameNo || defaultPartNameNo,
          }))
        );
      }

      if (newLineCode) {
        fetchPartTraceability(newLineCode, header.date, header.shift);
      }
    }
  }, [lineSet]);

  // Master details
  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!shopId) return;
        const token = localStorage.getItem("token");
        const headers = { Authorization: `Bearer ${token}` };

        const res = await fetch(`${process.env.REACT_APP_API_URL || ""}/api/machine-shop/${shopId}/details`, { headers });
        if (!res.ok) throw new Error(`Failed to fetch Machine Shop ${shopId} details`);
        const data = await res.json();
        setMachineDetails(data);

        const mappingRes = await fetch(`${process.env.REACT_APP_API_URL || ""}/api/mappings/${shopId}/lines`, { headers });
        if (!mappingRes.ok) throw new Error("Failed to fetch line mappings");
        const mappingData = await mappingRes.json();
        setLineMappings(mappingData);
      } catch (err) {
        console.error("Data fetch error:", err);
        triggerToast("Failed to load required data.", "error");
      } finally {
        setLoadingMachineDetails(false);
      }
    };
    fetchData();
  }, [shopId]);

  const lineCodes =
    lineMappings.length > 0
      ? lineMappings.map((m) => m.lineCode)
      : [...new Set(machineDetails.map((item) => item.lineCode).filter(Boolean))];

  const machineOptionsRaw = machineDetails.filter((item) => item.lineCode === header.lineCode);
  const machineOptions = Array.from(new Set(machineOptionsRaw.map((m) => m.machineNo).filter(Boolean))).map(
    (machineNo) => machineOptionsRaw.find((m) => m.machineNo === machineNo)
  );

  const handleHeaderChange = (field, val) => {
    if (isReadOnlyApprover) return;
    setHeader((prev) => ({ ...prev, [field]: val }));

    if (field === "lineCode") {
      const mapping = lineMappings.find((m) => m.lineCode === val);
      const autoPartName = mapping?.partSet || "";
      const autoPartNo = mapping?.idSet || "";
      const defaultPartNameNo = autoPartName && autoPartNo ? `${autoPartName} / ${autoPartNo}` : "";

      setHeader((prev) => ({
        ...prev,
        lineCode: val,
        partName: autoPartName,
        partNo: autoPartNo,
      }));

      setRows([createEmptyRow(defaultPartNameNo)]);

      if (setLineSet) {
        setLineSet((prev) => ({
          ...prev,
          machineShop: shopId || "3",
          lineCode: val,
          partName: autoPartName,
          partNo: autoPartNo,
        }));
      }

      checkExistingRecord(val, header.date, header.shift);
    }

    if (field === "lineCode" || field === "date" || field === "shift") {
      const targetLineCode = field === "lineCode" ? val : header.lineCode;
      const targetDate = field === "date" ? val : header.date;
      const targetShift = field === "shift" ? val : header.shift;

      if (targetLineCode && targetDate && targetShift) {
        fetchPartTraceability(targetLineCode, targetDate, targetShift);
        if (field !== "lineCode") {
          checkExistingRecord(targetLineCode, targetDate, targetShift);
        }
      }
    }
  };

  const handleRowChange = (rowIdx, field, subField, val) => {
    if (isReadOnlyApprover) return;
    setRows((prev) => {
      const next = [...prev];
      if (subField) {
        next[rowIdx] = {
          ...next[rowIdx],
          [field]: { ...next[rowIdx][field], [subField]: val },
        };
      } else {
        next[rowIdx] = { ...next[rowIdx], [field]: val };
      }

      if (field === "machineNo") {
        const selectedMachine = machineOptions.find((m) => m.machineNo === val);
        if (selectedMachine) {
          next[rowIdx].machineName = selectedMachine.machineType || "";
        }
      }
      return next;
    });
  };

  const handleSignatureChange = (field, val) => {
    if (isReadOnlyApprover) return;
    setSignatures((prev) => ({ ...prev, [field]: val }));
  };

  const currentPartNameNo =
    header.partName && header.partNo ? `${header.partName} / ${header.partNo}` : "";

  const handleAddRow = () => {
    if (isReadOnlyApprover) return;
    setRows((prev) => [...prev, createEmptyRow(currentPartNameNo)]);
  };

  const handleRemoveRow = () => {
    if (isReadOnlyApprover) return;
    setRows((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  };

  // Shift Incharge Approves "Shift Supervisor (Production)"
  const handleApproveSupervisorProduction = () => {
    setSignatures((prev) => ({
      ...prev,
      shiftSupervisorProduction: currentUsername || "Approved",
    }));
    setHeader((prev) => ({
      ...prev,
      shiftInchargeName: prev.shiftInchargeName || currentUsername,
    }));
    triggerToast("Production supervisor approved successfully.", "success");
  };

  // QC Approves "Shift Supervisor (Quality)"
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

  // HOF Approves "HOF - Production"
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
    if (!isSavedRecord) {
      triggerToast("No saved record found for this date. Submit the form first to preview.", "error");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const params = new URLSearchParams({
        lineCode: header.lineCode,
        date: header.date,
        shift: header.shift,
        shopId: String(shopId || 3),
      });

      const res = await fetch(
        `${process.env.REACT_APP_API_URL || ""}/api/daily-production-report/report?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!res.ok) throw new Error("Report request failed");

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `Daily_Production_Report_${header.lineCode}_${header.date}_${header.shift}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);

      triggerToast("PDF generated and downloaded!", "success");
    } catch (err) {
      console.error("PDF generation failed:", err);
      triggerToast("Failed to generate PDF", "error");
    }
  };

  const handleSave = async () => {
    if (!header.lineCode) {
      triggerToast("Please select a Line Code in the header before saving.", "error");
      return;
    }

    if (isShiftIncharge) {
      if (!signatures.shiftSupervisorProduction) {
        triggerToast("Please click 'Approve' under SHIFT SUPERVISOR (PRODUCTION) before submitting.", "error");
        return;
      }
      if (!header.assignedQc) {
        triggerToast("Please select a QC in 'SHIFT SUPERVISOR (QUALITY)'.", "error");
        return;
      }
      if (!header.assignedHof) {
        triggerToast("Please select a HOF in 'HOF - PRODUCTION'.", "error");
        return;
      }
    }

    if (isQC && (!signatures.shiftSupervisorQuality || signatures.shiftSupervisorQuality === "Pending")) {
      triggerToast("Please click 'Approve QC' before completing verification.", "error");
      return;
    }

    if (isHOF && (!signatures.hofProduction || signatures.hofProduction === "Pending")) {
      triggerToast("Please click 'Approve HOF' before completing approval.", "error");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      triggerToast("Authentication token missing. Please log in again.", "error");
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);

    const payload = {
      header: { 
        ...header, 
        machineShop: shopId,
        shiftInchargeName: header.shiftInchargeName || currentUsername
      },
      rows,
      signatures: {
        ...signatures,
        shiftSupervisorQuality: isQC ? currentUsername : signatures.shiftSupervisorQuality || "Pending",
        hofProduction: isHOF ? currentUsername : signatures.hofProduction || "Pending",
      },
      status: (signatures.shiftSupervisorQuality && signatures.hofProduction) ? "Completed" : "Submitted",
    };

    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL || ""}/api/daily-production-report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Server returned ${res.status}: ${errorText}`);
      }

      if (setLineSet) {
        setLineSet((prev) => ({
          ...prev,
          machineShop: shopId || "3",
          lineCode: header.lineCode,
          partName: header.partName,
          partNo: header.partNo,
        }));
      }

      setIsSaving(false);
      setSaveSuccess(true);
      setIsSavedRecord(true);

      triggerToast("Record saved and submitted successfully!", "success");
      await new Promise((resolve) => setTimeout(resolve, 1500));

      navigate(
        isQC
          ? `/qc/${shopId || 3}`
          : isHOF
          ? `/hof/${shopId || 3}`
          : `/operator/${shopId || 3}/daily-production-idle-time-report`
      );
    } catch (err) {
      console.error("Save error:", err);
      setIsSaving(false);
      triggerToast(`Failed to save report. Error: ${err.message}`, "error");
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

  const isHofApproved = Boolean(
    signatures.hofProduction &&
      signatures.hofProduction !== "Pending" &&
      signatures.hofProduction !== ""
  );

  return (
    <div className="min-h-screen bg-[#2d2d2d] flex flex-col items-center justify-center p-6 pb-20">
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
                    ? "Submitting for QC & HOF Verification"
                    : isQC
                    ? "Completing QC Verification"
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

      <div className="bg-white w-full max-w-[98rem] rounded-xl p-8 shadow-2xl overflow-x-auto border-4 border-gray-100 space-y-6">
        {/* Card Header & PDF Preview */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-200 pb-4 gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <button
                type="button"
                onClick={() =>
                  navigate(
                    isQC
                      ? `/qc/${shopId || 3}`
                      : isHOF
                      ? `/hof/${shopId || 3}`
                      : `/shift-incharge/${shopId || 3}`
                  )
                }
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
              <span>Revision: {formMeta.revision}</span>
              <span>|</span>
              <span className="font-bold text-orange-600">Shop ID: {shopId}</span>
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

        {/* SUB-HEADER */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 bg-orange-50 border border-orange-200 p-4 rounded-lg">
          <div>
            <label className="font-bold text-gray-700 block mb-1 text-sm">Line Code</label>
            <select
              className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm font-semibold bg-white cursor-pointer disabled:bg-gray-100"
              value={header.lineCode}
              onChange={(e) => handleHeaderChange("lineCode", e.target.value)}
              disabled={loadingMachineDetails || isReadOnlyApprover}
            >
              <option value="">{loadingMachineDetails ? "Loading..." : "Select Line Code"}</option>
              {lineCodes.map((lc) => (
                <option key={lc} value={lc}>
                  {lc}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-bold text-gray-700 block mb-1 text-sm">Part Traceability - Machining</label>
            <input
              type="text"
              className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm font-semibold bg-white disabled:bg-gray-100"
              value={header.partTraceabilityMachining}
              disabled={isReadOnlyApprover}
              onChange={(e) => handleHeaderChange("partTraceabilityMachining", e.target.value)}
              placeholder="Auto-generated / Enter Traceability"
            />
          </div>

          <div>
            <label className="font-bold text-gray-700 block mb-1 text-sm">Date</label>
            <input
              type="date"
              className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm font-semibold bg-white cursor-pointer disabled:bg-gray-100"
              value={header.date}
              disabled={isReadOnlyApprover}
              onChange={(e) => handleHeaderChange("date", e.target.value)}
            />
          </div>

          <div>
            <label className="font-bold text-gray-700 block mb-1 text-sm">Shift</label>
            <select
              className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm font-semibold bg-white cursor-pointer disabled:bg-gray-100"
              value={header.shift}
              disabled={isReadOnlyApprover}
              onChange={(e) => handleHeaderChange("shift", e.target.value)}
            >
              <option value="I">I</option>
              <option value="II">II</option>
              <option value="III">III</option>
            </select>
          </div>

          <div>
            <label className="font-bold text-gray-700 block mb-1 text-sm">Shift Incharge Name</label>
            <input
              type="text"
              className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm font-semibold bg-white disabled:bg-gray-100"
              value={header.shiftInchargeName}
              disabled={isReadOnlyApprover}
              onChange={(e) => handleHeaderChange("shiftInchargeName", e.target.value)}
              placeholder="Enter name"
            />
          </div>
        </div>

        {/* MAIN PRODUCTION TABLE */}
        <div className="pt-2">
          {!isReadOnlyApprover && (
            <div className="flex justify-between items-center mb-2 px-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                  Production Log Entries
                </span>
                <span className="text-[11px] bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full font-semibold">
                  {rows.length} Rows
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAddRow}
                  className="inline-flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold px-4 py-2 rounded transition-colors shadow hover:cursor-pointer"
                >
                  + Add Row
                </button>
                {rows.length > 1 && (
                  <button
                    type="button"
                    onClick={handleRemoveRow}
                    className="inline-flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-3 py-2 rounded transition-colors shadow hover:cursor-pointer"
                  >
                    − Delete Row
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full border-collapse border-2 border-gray-800 text-xs text-center min-w-[1400px]">
              <thead>
                <tr className="bg-gray-100 text-gray-800 font-bold">
                  <th rowSpan={2} className="border border-gray-800 p-1 w-[6%]">
                    Machine<br />No.
                  </th>
                  <th rowSpan={2} className="border border-gray-800 p-1 w-[7%]">
                    Machine<br />Name
                  </th>
                  <th rowSpan={2} className="border border-gray-800 p-1 w-[12%]">
                    Part Name /<br />Part No
                  </th>
                  <th rowSpan={2} className="border border-gray-800 p-1 w-[10%]">
                    Operation<br />Description
                  </th>
                  <th rowSpan={2} className="border border-gray-800 p-1 w-[8%]">
                    Operator<br />Name
                  </th>
                  <th rowSpan={2} className="border border-gray-800 p-1 w-[5%]">
                    Produced
                  </th>
                  <th rowSpan={2} className="border border-gray-800 p-1 w-[5%]">
                    Accepted
                  </th>
                  <th rowSpan={2} className="border border-gray-800 p-1 w-[6%]">
                    Hold as<br />Non-conf.
                  </th>
                  <th colSpan={4} className="border border-gray-800 p-1 w-[20%] bg-gray-200">
                    REASON FOR HOLD
                  </th>
                  <th rowSpan={2} className="border border-gray-800 p-1 w-[13%]">
                    M/C Stop time & Reason<br />Details of significant event
                  </th>
                  <th colSpan={2} className="border border-gray-800 p-1 w-[8%] bg-gray-200">
                    Time
                  </th>
                </tr>
                <tr className="bg-gray-50 text-gray-800 font-bold text-[11px]">
                  <th className="border border-gray-800 p-1 w-[7%]">Casting</th>
                  <th className="border border-gray-800 p-1 w-[3%]">Qty</th>
                  <th className="border border-gray-800 p-1 w-[7%]">Machining</th>
                  <th className="border border-gray-800 p-1 w-[3%]">Qty</th>
                  <th className="border border-gray-800 p-1 w-[4%]">FROM</th>
                  <th className="border border-gray-800 p-1 w-[4%]">TO</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rIdx) => (
                  <tr key={`prod-row-${rIdx}`} className="h-10 hover:bg-gray-50">
                    <td className="border border-gray-800 p-0">
                      <select
                        className="w-full h-full text-center outline-none bg-transparent py-1 px-0.5 font-medium cursor-pointer text-[11px] disabled:text-gray-700"
                        value={row.machineNo}
                        onChange={(e) => handleRowChange(rIdx, "machineNo", null, e.target.value)}
                        disabled={!header.lineCode || isReadOnlyApprover}
                      >
                        <option value="">Select</option>
                        {machineOptions.map((machine, index) => (
                          <option
                            key={machine.id || `${machine.machineNo}-${index}`}
                            value={machine.machineNo}
                          >
                            {machine.machineNo}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="border border-gray-800 p-0 bg-gray-50">
                      <input
                        type="text"
                        readOnly
                        className="w-full h-full text-center outline-none bg-transparent py-1 px-1 font-medium text-[11px] text-gray-500"
                        value={row.machineName}
                        placeholder="Auto-fill"
                      />
                    </td>
                    <td className="border border-gray-800 p-0 bg-gray-50">
                      <input
                        type="text"
                        readOnly
                        className="w-full h-full text-center outline-none bg-transparent py-1 px-1 font-medium text-[11px] text-gray-700"
                        value={row.partNameNo}
                        placeholder="Auto-filled"
                      />
                    </td>
                    <td className="border border-gray-800 p-0">
                      <input
                        type="text"
                        disabled={isReadOnlyApprover}
                        className="w-full h-full text-center outline-none bg-transparent py-1 px-1 font-medium disabled:text-gray-700"
                        value={row.operationDescription}
                        onChange={(e) => handleRowChange(rIdx, "operationDescription", null, e.target.value)}
                      />
                    </td>
                    <td className="border border-gray-800 p-0">
                      <input
                        type="text"
                        disabled={isReadOnlyApprover}
                        className="w-full h-full text-center outline-none bg-transparent py-1 px-1 font-medium disabled:text-gray-700"
                        value={row.operatorName}
                        onChange={(e) => handleRowChange(rIdx, "operatorName", null, e.target.value)}
                      />
                    </td>
                    <td className="border border-gray-800 p-0">
                      <input
                        type="number"
                        disabled={isReadOnlyApprover}
                        className="w-full h-full text-center outline-none bg-transparent py-1 px-0.5 font-medium disabled:text-gray-700"
                        value={row.produced}
                        onChange={(e) => handleRowChange(rIdx, "produced", null, e.target.value)}
                      />
                    </td>
                    <td className="border border-gray-800 p-0">
                      <input
                        type="number"
                        disabled={isReadOnlyApprover}
                        className="w-full h-full text-center outline-none bg-transparent py-1 px-0.5 font-medium disabled:text-gray-700"
                        value={row.accepted}
                        onChange={(e) => handleRowChange(rIdx, "accepted", null, e.target.value)}
                      />
                    </td>
                    <td className="border border-gray-800 p-0">
                      <input
                        type="text"
                        disabled={isReadOnlyApprover}
                        className="w-full h-full text-center outline-none bg-transparent py-1 px-0.5 font-medium disabled:text-gray-700"
                        value={row.holdNonConformance}
                        onChange={(e) => handleRowChange(rIdx, "holdNonConformance", null, e.target.value)}
                      />
                    </td>
                    <td className="border border-gray-800 p-0">
                      <input
                        type="text"
                        disabled={isReadOnlyApprover}
                        className="w-full h-full text-center outline-none bg-transparent py-1 px-1 font-medium disabled:text-gray-700"
                        value={row.reasonForHold.casting}
                        onChange={(e) => handleRowChange(rIdx, "reasonForHold", "casting", e.target.value)}
                      />
                    </td>
                    <td className="border border-gray-800 p-0">
                      <input
                        type="number"
                        disabled={isReadOnlyApprover}
                        className="w-full h-full text-center outline-none bg-transparent py-1 px-0.5 font-medium disabled:text-gray-700"
                        value={row.reasonForHold.castingQty}
                        onChange={(e) => handleRowChange(rIdx, "reasonForHold", "castingQty", e.target.value)}
                      />
                    </td>
                    <td className="border border-gray-800 p-0">
                      <input
                        type="text"
                        disabled={isReadOnlyApprover}
                        className="w-full h-full text-center outline-none bg-transparent py-1 px-1 font-medium disabled:text-gray-700"
                        value={row.reasonForHold.machining}
                        onChange={(e) => handleRowChange(rIdx, "reasonForHold", "machining", e.target.value)}
                      />
                    </td>
                    <td className="border border-gray-800 p-0">
                      <input
                        type="number"
                        disabled={isReadOnlyApprover}
                        className="w-full h-full text-center outline-none bg-transparent py-1 px-0.5 font-medium disabled:text-gray-700"
                        value={row.reasonForHold.machiningQty}
                        onChange={(e) => handleRowChange(rIdx, "reasonForHold", "machiningQty", e.target.value)}
                      />
                    </td>
                    <td className="border border-gray-800 p-0">
                      <input
                        type="text"
                        disabled={isReadOnlyApprover}
                        className="w-full h-full text-center outline-none bg-transparent py-1 px-1 font-medium disabled:text-gray-700"
                        placeholder="Reason / Details"
                        value={row.mcStopTimeReason}
                        onChange={(e) => handleRowChange(rIdx, "mcStopTimeReason", null, e.target.value)}
                      />
                    </td>
                    <td className="border border-gray-800 p-0">
                      <input
                        type="time"
                        disabled={isReadOnlyApprover}
                        className="w-full h-full text-center outline-none bg-transparent py-1 px-0.5 font-medium text-[11px] disabled:text-gray-700"
                        value={row.time.from}
                        onChange={(e) => handleRowChange(rIdx, "time", "from", e.target.value)}
                      />
                    </td>
                    <td className="border border-gray-800 p-0">
                      <input
                        type="time"
                        disabled={isReadOnlyApprover}
                        className="w-full h-full text-center outline-none bg-transparent py-1 px-0.5 font-medium text-[11px] disabled:text-gray-700"
                        value={row.time.to}
                        onChange={(e) => handleRowChange(rIdx, "time", "to", e.target.value)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* SIGNATURES TABLE */}
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
                        className="w-full bg-white border border-gray-300 p-1.5 rounded font-bold text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-orange-500 text-center"
                        value={header.assignedQc || ""}
                        onChange={(e) => handleHeaderChange("assignedQc", e.target.value)}
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
                <td className="border border-gray-800 p-2">
                  <input
                    type="text"
                    disabled={isReadOnlyApprover}
                    placeholder="Sign / Name"
                    className="w-full h-full text-center outline-none font-medium bg-transparent px-2 disabled:text-gray-700"
                    value={signatures.productionEngineer}
                    onChange={(e) => handleSignatureChange("productionEngineer", e.target.value)}
                  />
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
                        className="w-full bg-white border border-gray-300 p-1.5 rounded font-bold text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-orange-500 text-center"
                        value={header.assignedHof || ""}
                        onChange={(e) => handleHeaderChange("assignedHof", e.target.value)}
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

        {/* Submit Actions */}
        <div className="flex justify-end items-end mt-6 pt-4 border-t border-gray-300">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || saveSuccess}
            className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white px-10 py-3 rounded font-bold transition-colors shadow-lg hover:cursor-pointer flex items-center gap-2 uppercase tracking-wider text-sm"
          >
            {isSaving
              ? "SAVING..."
              : saveSuccess
              ? "SAVED ✓"
              : isQC
              ? "Submit QC Approval"
              : isHOF
              ? "Submit HOF Approval"
              : "Submit for Verification"}
          </button>
        </div>
      </div>
    </div>
  );
}