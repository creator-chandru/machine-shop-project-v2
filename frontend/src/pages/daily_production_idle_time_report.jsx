import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FileDown, Calendar, X } from "lucide-react";
import { useLineSet } from "../context/LineSetContext.jsx";
import Header from '../components/Header';

const API = process.env.REACT_APP_API_URL || "";

const SHIFT_KEYS = ["shift1", "shift2", "shift3"];
const SHIFT_LABEL = { shift1: "I", shift2: "II", shift3: "III" };

const LOSS_REASONS = [
  { id: 1, category: "MAN", name: "Want of Man power", rowSpan: 2, isFirst: true },
  { id: 2, category: "MAN", name: "Efficiency", isFirst: false },
  { id: 3, category: "MACHINE", name: "M/c Breakdown", rowSpan: 2, isFirst: true },
  { id: 4, category: "MACHINE", name: "Preventive maintenance", isFirst: false },
  { id: 5, category: "MATERIAL", name: "Want of load", rowSpan: 3, isFirst: true },
  { id: 6, category: "MATERIAL", name: "Want of cutting tool", isFirst: false },
  { id: 7, category: "MATERIAL", name: "Want of jig & fig", isFirst: false },
  { id: 8, category: "METHOD", name: "Process correction", rowSpan: 2, isFirst: true },
  { id: 9, category: "METHOD", name: "Casting Adjustment", isFirst: false },
  { id: 10, category: "MEASUREMENT", name: "Want of inspection Delay", rowSpan: 1, isFirst: true },
  { id: 11, category: "OTHERS", name: "Tool change", rowSpan: 3, isFirst: true },
  { id: 12, category: "OTHERS", name: "Want of Power", isFirst: false },
  { id: 13, category: "OTHERS", name: "Want of schedule", isFirst: false },
];

const getTodayISODate = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getCurrentUser = () => {
  try {
    const u = JSON.parse(localStorage.getItem("user") || "{}");
    return u?.username || u?.employeeId || "Unknown";
  } catch {
    return "Unknown";
  }
};

const authHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const emptyShifts = () => ({ shift1: "", shift2: "", shift3: "" });

const createEmptyLineColumn = (lineCode = "", partName = "", capacity = null) => ({
  lineCode,
  partName,
  brakeType: "",
  locked: false,

  capacity: capacity ? { ...capacity } : emptyShifts(),

  actualProd: {
    lh: emptyShifts(),
    rh: emptyShifts(),
  },

  manpower: emptyShifts(),

  losses: LOSS_REASONS.reduce((acc, loss) => {
    acc[`loss_${loss.id}`] = emptyShifts();
    return acc;
  }, {}),

  signatures: emptyShifts(),
  assignedPe: emptyShifts(),
  peSign: emptyShifts(),
});

const hasVal = (v) => v !== "" && v != null;

const shiftHasData = (col, shift) =>
  hasVal(col.actualProd.lh[shift]) ||
  hasVal(col.actualProd.rh[shift]) ||
  hasVal(col.manpower[shift]) ||
  LOSS_REASONS.some((l) => hasVal(col.losses[`loss_${l.id}`]?.[shift]));

const sumLosses = (col, shift, excludeId = null) =>
  LOSS_REASONS.reduce((acc, l) => {
    if (l.id === excludeId) return acc;
    return acc + (parseFloat(col.losses[`loss_${l.id}`]?.[shift]) || 0);
  }, 0);

const Toast = ({ message, type, onClose }) => {
  if (!message) return null;

  const bgColor = type === 'error' ? 'bg-red-600' : type === 'success' ? 'bg-green-600' : 'bg-orange-600';

  return (
    <div className={`fixed bottom-6 right-6 left-6 sm:left-auto z-50 ${bgColor} text-white px-5 py-3 rounded-lg shadow-2xl flex items-center justify-between gap-3 transition-all transform`}>
      <span className="text-sm font-semibold">{message}</span>
      <button
        onClick={onClose}
        className="ml-2 font-bold text-2xl leading-none hover:text-gray-200 focus:outline-none px-2"
      >
        ×
      </button>
    </div>
  );
};

const calcChunkSize = () => {
  const w = typeof window !== "undefined" ? window.innerWidth : 1280;
  if (w >= 1536) return 4;
  if (w >= 1280) return 3;
  if (w >= 900) return 2;
  return 1;
};

const useChunkSize = () => {
  const [size, setSize] = useState(calcChunkSize);
  useEffect(() => {
    const onResize = () => setSize(calcChunkSize());
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);
  return size;
};

const sumValues = (...vals) =>
  vals.reduce((sum, v) => sum + (parseFloat(v) || 0), 0) || "";

const INPUT_BASE =
  "w-full h-full text-center outline-none py-2 text-sm sm:text-base disabled:bg-gray-100 disabled:text-gray-700 bg-transparent";

export default function DailyProductionIdleTimeReport() {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const { lineSet, setLineSet } = useLineSet();

  const currentUser = getCurrentUser();
  const chunkSize = useChunkSize();

  const [machineShopDetails, setMachineShopDetails] = useState([]);
  const [lineMappings, setLineMappings] = useState([]);
  const [peUsers, setPeUsers] = useState([]);
  const [loadingMaster, setLoadingMaster] = useState(true);

  const [reportDate, setReportDate] = useState(getTodayISODate());

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // PDF Date Range Modal States
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfFromDate, setPdfFromDate] = useState("");
  const [pdfToDate, setPdfToDate] = useState("");
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const [toast, setToast] = useState({ message: '', type: '' });

  const triggerToast = (message, type = 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: '', type: '' }), 4000);
  };

  const [lineColumns, setLineColumns] = useState([
    createEmptyLineColumn(lineSet?.lineCode || "", lineSet?.partName || ""),
  ]);

  const lineColumnsRef = useRef(lineColumns);
  const reportDateRef = useRef(reportDate);
  useEffect(() => { lineColumnsRef.current = lineColumns; }, [lineColumns]);
  const lineMappingsRef = useRef(lineMappings);
  const machineShopDetailsRef = useRef(machineShopDetails);
  useEffect(() => { lineMappingsRef.current = lineMappings; }, [lineMappings]);
  useEffect(() => { machineShopDetailsRef.current = machineShopDetails; }, [machineShopDetails]);
  useEffect(() => { reportDateRef.current = reportDate; }, [reportDate]);

  useEffect(() => {
    if (!shopId) return;

    const fetchJson = async (url) => {
      const res = await fetch(`${API}${url}`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`Request failed: ${url}`);
      return res.json();
    };

    const loadAll = async () => {
      try {
        setMachineShopDetails(await fetchJson(`/api/machine-shop/${shopId}/details`));
      } catch (e) {
        console.error(e);
      }

      try {
        const maps = await fetchJson(`/api/mappings/${shopId}/lines`);
        setLineMappings(Array.isArray(maps) ? maps : []);
      } catch (e) {
        console.error(e);
      }

      try {
        const pe = await fetchJson(`/api/daily-production-idle-time/pe/users`);
        setPeUsers(pe.peList || []);
      } catch (e) {
        console.error(e);
      }

      setLoadingMaster(false);
    };

    loadAll();
  }, [shopId]);

  useEffect(() => {
    if (lineSet?.lineCode) {
      setLineColumns((prev) => {
        if (prev.length > 0 && !prev[0].locked) {
          const next = [...prev];
          next[0] = {
            ...next[0],
            lineCode: lineSet.lineCode || next[0].lineCode,
            partName: lineSet.partName || next[0].partName,
          };
          return next;
        }
        return prev;
      });
    }
  }, [lineSet]);

  const lineCodes = [
    ...new Set(
      lineMappings.length > 0
        ? lineMappings.map((m) => m.lineCode).filter(Boolean)
        : machineShopDetails.map((i) => i.lineCode).filter(Boolean)
    ),
  ];

  const resolvePartForLine = (lineCode) => {
    if (!lineCode) return { partName: "", capacity: null };

    const norm = (v) => String(v || "").trim().toLowerCase();

    const mapping = lineMappingsRef.current.find(
      (m) => norm(m.lineCode) === norm(lineCode)
    );

    const partName =
      mapping?.partSet ||
      machineShopDetailsRef.current.find(
        (item) => norm(item.lineCode) === norm(lineCode) && item.partName
      )?.partName ||
      "";

    const capacity = mapping
      ? {
        shift1: mapping.shift1Quantity ?? "",
        shift2: mapping.shift2Quantity ?? "",
        shift3: mapping.shift3Quantity ?? "",
      }
      : null;

    return { partName, capacity };
  };

  useEffect(() => {
    if (!lineMappings.length) return;
    setLineColumns((prev) =>
      prev.map((c) => {
        if (c.locked || !c.lineCode) return c;
        const { partName, capacity } = resolvePartForLine(c.lineCode);
        return capacity ? { ...c, partName: partName || c.partName, capacity } : c;
      })
    );
  }, [lineMappings, machineShopDetails]);

  const freshFrom = (c) => {
    const { partName, capacity } = resolvePartForLine(c.lineCode);
    return createEmptyLineColumn(c.lineCode, partName || c.partName, capacity);
  };

  const applySavedOrFresh = async (lineCode, date) => {
    if (!lineCode || !shopId) return;

    let saved = null;
    try {
      const params = new URLSearchParams({ shopId, date, lineCode });
      const res = await fetch(`${API}/api/daily-production-idle-time?${params.toString()}`, {
        headers: authHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.exists && data.lineColumns?.[0]) {
          saved = data.lineColumns[0];
          // Ensure structure handles missing shift level assignedPe / peSign from old records
          if (!saved.assignedPe || typeof saved.assignedPe === 'string') saved.assignedPe = emptyShifts();
          if (!saved.peSign || typeof saved.peSign === 'string') saved.peSign = emptyShifts();
        }
      }
    } catch (err) {
      console.error("Saved idle time fetch error:", err);
    }

    if (reportDateRef.current !== date) return;

    setLineColumns((prev) =>
      prev.map((c) => {
        if (c.lineCode !== lineCode) return c;
        if (saved) {
          return { ...createEmptyLineColumn(), ...saved, locked: true };
        }
        return c.locked ? freshFrom(c) : c;
      })
    );
  };

  useEffect(() => {
    const first = lineColumnsRef.current[0];
    if (first?.lineCode) applySavedOrFresh(first.lineCode, reportDateRef.current);
  }, [shopId]);

  const handleDateChange = (val) => {
    if (!val) return;
    reportDateRef.current = val;
    setReportDate(val);

    const cols = lineColumnsRef.current;
    setLineColumns((prev) => prev.map((c) => (c.lineCode ? freshFrom(c) : c)));
    cols.filter((c) => c.lineCode).forEach((c) => applySavedOrFresh(c.lineCode, val));
  };

  const isEditableShift = (col, shift) => !col.locked && !col.signatures?.[shift];

  const handleLineCodeChange = (colIdx, lineCode) => {
    const current = lineColumnsRef.current[colIdx];
    if (!current || current.locked) return;

    if (
      lineCode &&
      lineColumnsRef.current.some((c, i) => i !== colIdx && c.lineCode === lineCode)
    ) {
      triggerToast(`Line ${lineCode} is already added in another column.`, "error");
      return;
    }

    const { partName, capacity } = resolvePartForLine(lineCode);

    setLineColumns((prev) => {
      const next = [...prev];
      next[colIdx] = createEmptyLineColumn(lineCode, partName, capacity);
      return next;
    });

    if (colIdx === 0 && setLineSet) {
      setLineSet((prev) => ({
        ...prev,
        machineShop: shopId || lineSet?.machineShop || "3",
        lineCode,
        partName,
        partNo:
          lineMappingsRef.current.find((m) => m.lineCode === lineCode)?.idSet ||
          prev?.partNo ||
          "",
      }));
    }

    if (lineCode) applySavedOrFresh(lineCode, reportDateRef.current);
  };

  const handleBrakeTypeChange = (colIdx, val) => {
    setLineColumns((prev) => {
      if (prev[colIdx]?.locked) return prev;
      const next = [...prev];
      next[colIdx] = { ...next[colIdx], brakeType: val };
      return next;
    });
  };

  const handleActualProdChange = (colIdx, arm, shift, val) => {
    const col = lineColumns[colIdx];
    if (!col || !isEditableShift(col, shift)) return;

    // Validation: Block values below 0 or above specific shift's Capacity Limit
    if (val !== "") {
      const numVal = parseFloat(val);
      const capLimit = parseFloat(col.capacity[shift]) || 0;
      
      if (numVal < 0) {
        triggerToast("Actual production cannot be less than 0.", "error");
        return;
      }
      if (numVal > capLimit) {
        triggerToast(`Actual production cannot exceed the Capacity Qty in Sets (${capLimit}).`, "error");
        return;
      }
    }

    setLineColumns((prev) => {
      const next = [...prev];
      next[colIdx] = {
        ...next[colIdx],
        actualProd: {
          ...next[colIdx].actualProd,
          [arm]: { ...next[colIdx].actualProd[arm], [shift]: val },
        },
      };
      return next;
    });
  };

  const handleManpowerChange = (colIdx, shift, val) => {
    const col = lineColumns[colIdx];
    if (!col || !isEditableShift(col, shift)) return;

    setLineColumns((prev) => {
      const next = [...prev];
      next[colIdx] = {
        ...next[colIdx],
        manpower: { ...next[colIdx].manpower, [shift]: val },
      };
      return next;
    });
  };

  const handleLossChange = (colIdx, lossId, shift, val) => {
    const col = lineColumns[colIdx];
    if (!col || !isEditableShift(col, shift)) return;

    // Validation: Block values below 0 or above specific shift's Capacity Limit
    if (val !== "") {
      const numVal = parseFloat(val);
      const capLimit = parseFloat(col.capacity[shift]) || 0;
      
      if (numVal < 0) {
        triggerToast("Loss value cannot be less than 0.", "error");
        return;
      }
      if (numVal > capLimit) {
        triggerToast(`Loss value cannot exceed the Capacity Qty in Sets (${capLimit}).`, "error");
        return;
      }
    }

    setLineColumns((prev) => {
      const next = [...prev];
      next[colIdx] = {
        ...next[colIdx],
        losses: {
          ...next[colIdx].losses,
          [`loss_${lossId}`]: {
            ...next[colIdx].losses[`loss_${lossId}`],
            [shift]: val,
          },
        },
      };
      return next;
    });
  };

  const handleApproveShift = (colIdx, shift) => {
    const col = lineColumns[colIdx];
    if (!col || col.locked) return;

    if (!col.lineCode) {
      triggerToast("Select Line Code before approving.", "error");
      return;
    }

    if (!shiftHasData(col, shift)) {
      triggerToast(`Enter data for Shift ${SHIFT_LABEL[shift]} before approving it.`, "error");
      return;
    }

    if (!col.assignedPe?.[shift]) {
      triggerToast(`Select Shift Officer (PE) for Shift ${SHIFT_LABEL[shift]} before approving.`, "error");
      return;
    }

    setLineColumns((prev) => {
      const next = [...prev];
      next[colIdx] = {
        ...next[colIdx],
        signatures: { ...next[colIdx].signatures, [shift]: currentUser },
      };
      return next;
    });
  };

  const handleRevokeShift = (colIdx, shift) => {
    setLineColumns((prev) => {
      if (prev[colIdx]?.locked) return prev;
      const next = [...prev];
      next[colIdx] = {
        ...next[colIdx],
        signatures: { ...next[colIdx].signatures, [shift]: "" },
      };
      return next;
    });
  };

  const handlePeChange = (colIdx, shift, val) => {
    setLineColumns((prev) => {
      if (prev[colIdx]?.locked) return prev;
      const next = [...prev];
      next[colIdx] = { 
        ...next[colIdx], 
        assignedPe: { ...next[colIdx].assignedPe, [shift]: val } 
      };
      return next;
    });
  };

  const handleAddColumn = () => {
    setLineColumns((prev) => [...prev, createEmptyLineColumn()]);
  };

  const handleRemoveColumn = () => {
    setLineColumns((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  };

  const columnChunks = (() => {
    const chunks = [];
    for (let i = 0; i < lineColumns.length; i += chunkSize) {
      chunks.push(
        lineColumns.slice(i, i + chunkSize).map((col, localIdx) => ({ col, globalIdx: i + localIdx }))
      );
    }
    return chunks;
  })();

  const calcTotalLoss = (col, shift) => sumLosses(col, shift) || "";

  // ------------------------------------------------------------
  // PDF Download (By Date Range Modal)
  // ------------------------------------------------------------
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
      const params = new URLSearchParams({
        fromDate: pdfFromDate,
        toDate: pdfToDate,
        shopId: String(shopId || 3),
      });

      const response = await fetch(`${API}/api/daily-production-idle-time/report?${params.toString()}`, {
        headers: authHeaders(),
      });

      if (response.status === 404) throw new Error("No data recorded for the selected date range.");
      if (!response.ok) throw new Error("Failed to generate PDF from the server.");

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `Idle_Time_Report_${pdfFromDate}_to_${pdfToDate}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      setShowPdfModal(false);
      triggerToast("PDF generated and downloaded!", "success");
    } catch (err) {
      triggerToast(err.message || "Failed to download PDF", "error");
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  // ------------------------------------------------------------
  // Save with signature allocation checks
  // ------------------------------------------------------------
  const validateColumn = (col, label) => {
    if (!col.partName) return `${label}: part name could not be determined for this line.`;

    let anyData = false;

    for (const shift of SHIFT_KEYS) {
      const name = SHIFT_LABEL[shift];
      if (shiftHasData(col, shift)) {
        anyData = true;
        if (!col.signatures[shift]) return `${label} (Shift ${name}): approve the shift (Section Incharge Sign) before submitting.`;
        if (!col.assignedPe[shift]) return `${label} (Shift ${name}): select the Shift Officer (PE) to send this report for approval.`;
      }
    }

    if (!anyData) return `${label}: enter production / loss data for at least one shift.`;
    return null;
  };

  const handleSave = async () => {
    const toSave = lineColumns
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => !c.locked && c.lineCode);

    if (toSave.length === 0) {
      triggerToast("Select a line code and enter data. Saved reports cannot be changed.", "error");
      return;
    }

    for (const { c, i } of toSave) {
      const msg = validateColumn(c, `Line ${i + 1}`);
      if (msg) {
        triggerToast(msg, "error");
        return;
      }
    }

    setIsSaving(true);
    setSaveSuccess(false);

    const payload = {
      machineShop: shopId || lineSet?.machineShop || 3,
      date: reportDate,
      lineColumns: toSave.map(({ c }) => ({
        lineCode: c.lineCode,
        partName: c.partName,
        brakeType: c.brakeType,
        capacity: c.capacity,
        actualProd: c.actualProd,
        manpower: c.manpower,
        losses: c.losses,
        signatures: c.signatures,
        assignedPe: c.assignedPe,
        peSign: c.peSign
      })),
    };

    try {
      const res = await fetch(`${API}/api/daily-production-idle-time`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Save failed");

      const savedLines = data.savedLines || toSave.map(({ c }) => c.lineCode);

      setLineColumns((prev) =>
        prev.map((c) =>
          savedLines.includes(c.lineCode) && !c.locked
            ? { ...c, locked: true, peSign: "Pending" }
            : c
        )
      );

      if (setLineSet && lineColumns[0]?.lineCode) {
        setLineSet((prev) => ({
          ...prev,
          machineShop: shopId || lineSet?.machineShop || "3",
          lineCode: lineColumns[0].lineCode,
          partName: lineColumns[0].partName || prev?.partName || "",
        }));
      }

      setIsSaving(false);
      setSaveSuccess(true);

      await new Promise((resolve) => setTimeout(resolve, 2000));
      navigate(`/shift-incharge/${shopId || 3}`);
    } catch (err) {
      console.error("Save error:", err);
      setIsSaving(false);
      triggerToast(err.message || "Failed to save report.", "error");
    }
  };

  const hasUnlockedColumn = lineColumns.some((c) => !c.locked && c.lineCode);

  return (
    <div className="min-h-screen bg-[#2d2d2d] flex flex-col items-center justify-center p-2 pt-0 sm:p-6 pb-20">
      <Header />

      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ message: '', type: '' })}
      />

      {/* Date Range Modal for PDF Download */}
      {showPdfModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md border-2 border-gray-100 animate-in fade-in">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-orange-500" />
                <h3 className="text-lg font-bold text-gray-800 uppercase tracking-wide">Download Report by Date Range</h3>
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

      {(isSaving || saveSuccess) && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl px-10 py-8 text-center">
            {isSaving ? (
              <>
                <div className="w-10 h-10 border-4 border-gray-300 border-t-orange-500 rounded-full animate-spin mx-auto mb-5"></div>
                <h2 className="text-xl font-bold text-gray-800">Saving Data...</h2>
                <p className="text-gray-500 mt-2">Please wait</p>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold text-green-800">Data Saved Successfully</h2>
                <p className="text-gray-500 mt-2">Sent to Shift Officer. Returning to Menu...</p>
              </>
            )}
          </div>
        </div>
      )}

      <div className="bg-white w-full max-w-[99rem] rounded-xl p-3 sm:p-6 lg:p-8 shadow-2xl border-4 border-gray-100 space-y-5">
        {/* Title + Download PDF button at top */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-200 pb-4 gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-1">
              <span className="text-xs font-bold text-orange-600 tracking-wider uppercase block">
                SAKTHI AUTO
              </span>
              <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                OUTPUT ONLY
              </span>
            </div>

            <h2 className="text-2xl font-bold text-gray-800 uppercase tracking-wide">
              DAILY PRODUCTION & IDLE TIME REPORT
            </h2>
          </div>

          <button
            type="button"
            onClick={() => setShowPdfModal(true)}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider shadow transition-colors cursor-pointer"
          >
            <FileDown className="w-4 h-4" /> Download PDF
          </button>
        </div>

        {/* Date Selector Row */}
        <div className="flex justify-end">
          <div className="flex items-center gap-2 bg-gray-50 border-2 border-gray-800 p-2 rounded shadow-sm w-full md:w-auto">
            <label className="text-xs font-black text-gray-800 uppercase tracking-wide">DATE :</label>
            <input
              type="date"
              className="flex-1 md:flex-none bg-white border border-gray-300 rounded px-2 py-1.5 text-sm font-bold text-gray-800 outline-none focus:border-orange-500"
              value={reportDate}
              onChange={(e) => handleDateChange(e.target.value)}
            />
          </div>
        </div>

        {/* Add / delete column */}
        <div className="flex flex-wrap justify-between items-center gap-2 px-1">
          <p className="text-[11px] sm:text-xs text-gray-500 font-semibold">
            Select the line code – part name and capacity load automatically. Saved reports load locked.
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAddColumn}
              className="inline-flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-4 py-2.5 rounded transition-colors shadow hover:cursor-pointer"
            >
              <span className="text-sm font-bold leading-none">+</span>
              Add Line Column
            </button>

            {lineColumns.length > 1 && (
              <button
                type="button"
                onClick={handleRemoveColumn}
                className="inline-flex items-center gap-1 bg-gray-600 hover:bg-gray-700 text-white text-xs font-bold px-3 py-2.5 rounded transition-colors shadow hover:cursor-pointer"
              >
                <span className="text-sm font-bold leading-none">−</span>
                Delete Column
              </button>
            )}
          </div>
        </div>

        <div className="space-y-8">
          {columnChunks.map((chunk, chunkIdx) => (
            <div key={`chunk-${chunkIdx}`} className="space-y-2">
              {columnChunks.length > 1 && (
                <div className="flex items-center gap-2 px-1">
                  <span className="text-xs font-bold text-orange-600 uppercase tracking-wider">
                    Table {chunkIdx + 1}
                  </span>
                  <span className="text-xs text-gray-500 font-semibold">
                    (Production Lines {chunk[0].globalIdx + 1}
                    {chunk.length > 1 ? ` to ${chunk[chunk.length - 1].globalIdx + 1}` : ""})
                  </span>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse border-2 border-gray-800 text-xs text-center table-fixed">
                  <thead>
                    <tr>
                      <th colSpan={3} className="border border-gray-800 p-1.5 bg-gray-100 text-left font-bold">
                        LINE CODE
                      </th>

                      {chunk.map(({ col, globalIdx }) => (
                        <th
                          key={`lc-${globalIdx}`}
                          colSpan={4}
                          className="border border-gray-800 p-0 bg-white"
                        >
                          <select
                            className="w-full h-full text-center font-bold text-gray-800 outline-none bg-transparent py-2.5 text-sm sm:text-base focus:bg-orange-50/50 cursor-pointer disabled:bg-gray-100 disabled:cursor-not-allowed"
                            value={col.lineCode || ""}
                            disabled={col.locked || loadingMaster}
                            onChange={(e) => handleLineCodeChange(globalIdx, e.target.value)}
                          >
                            <option value="">{loadingMaster ? "Loading..." : "Select Line Code"}</option>
                            {lineCodes.map((lineCode) => (
                              <option key={lineCode} value={lineCode}>
                                {lineCode}
                              </option>
                            ))}
                          </select>
                        </th>
                      ))}
                    </tr>

                    <tr>
                      <th colSpan={3} className="border border-gray-800 p-1.5 bg-gray-100 text-left font-bold">
                        PART NAME
                      </th>

                      {chunk.map(({ col, globalIdx }) => (
                        <th
                          key={`pn-${globalIdx}`}
                          colSpan={4}
                          className="border border-gray-800 p-0 bg-gray-50"
                        >
                          <input
                            type="text"
                            readOnly
                            placeholder="Auto-filled from line code"
                            className="w-full h-full text-center font-bold text-gray-800 outline-none bg-transparent py-2.5 text-sm sm:text-base"
                            value={col.partName || ""}
                          />
                        </th>
                      ))}
                    </tr>

                    <tr>
                      <th colSpan={3} className="border border-gray-800 p-1.5 bg-gray-100 text-left font-bold">
                        ABS / NABS
                      </th>

                      {chunk.map(({ col, globalIdx }) => (
                        <th
                          key={`bt-${globalIdx}`}
                          colSpan={4}
                          className="border border-gray-800 p-0 bg-white"
                        >
                          <select
                            className="w-full h-full text-center font-bold text-gray-800 outline-none bg-transparent py-2.5 text-sm sm:text-base focus:bg-orange-50/50 cursor-pointer disabled:bg-gray-100 disabled:cursor-not-allowed"
                            value={col.brakeType || ""}
                            disabled={col.locked}
                            onChange={(e) => handleBrakeTypeChange(globalIdx, e.target.value)}
                          >
                            <option value="">Select</option>
                            <option value="ABS">ABS</option>
                            <option value="NABS">NABS</option>
                          </select>
                        </th>
                      ))}
                    </tr>

                    <tr className="bg-gray-100 font-bold text-[11px]">
                      <th className="border border-gray-800 p-1 w-10">S.No.</th>
                      <th colSpan={2} className="border border-gray-800 p-1 text-left px-2">
                        SHIFT
                      </th>

                      {chunk.map(({ globalIdx }) => (
                        <React.Fragment key={`sh-hdr-${globalIdx}`}>
                          <th className="border border-gray-800 p-1">I</th>
                          <th className="border border-gray-800 p-1">II</th>
                          <th className="border border-gray-800 p-1">III</th>
                          <th className="border border-gray-800 p-1 bg-gray-200">T</th>
                        </React.Fragment>
                      ))}
                    </tr>

                    {/* Capacity */}
                    <tr className="bg-white">
                      <td
                        colSpan={3}
                        className="border border-gray-800 p-1 text-left font-bold bg-gray-50 px-2"
                      >
                        CAPACITY QTY IN SETS
                        <span className="block text-[9px] font-semibold text-gray-500 normal-case">
                          (set by HOD / HOF)
                        </span>
                      </td>

                      {chunk.map(({ col, globalIdx }) => (
                        <React.Fragment key={`cap-${globalIdx}`}>
                          {SHIFT_KEYS.map((shift) => (
                            <td key={shift} className="border border-gray-800 p-0 bg-gray-100">
                              <input
                                type="number"
                                placeholder="0"
                                className="w-full h-full text-center font-semibold outline-none py-2 text-sm sm:text-base bg-transparent cursor-not-allowed"
                                value={col.capacity[shift]}
                                readOnly
                                tabIndex={-1}
                              />
                            </td>
                          ))}

                          <td className="border border-gray-800 p-1 font-bold bg-gray-100 text-gray-800">
                            {sumValues(col.capacity.shift1, col.capacity.shift2, col.capacity.shift3)}
                          </td>
                        </React.Fragment>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    <tr>
                      <td
                        rowSpan={2}
                        colSpan={2}
                        className="border border-gray-800 p-1 font-bold text-left bg-gray-50 px-2 align-middle"
                      >
                        ACTUAL PROD QTY
                      </td>

                      <td className="border border-gray-800 p-1 font-bold bg-gray-100 w-10">LH</td>

                      {chunk.map(({ col, globalIdx }) => (
                        <React.Fragment key={`lh-${globalIdx}`}>
                          {SHIFT_KEYS.map((shift) => (
                            <td key={shift} className="border border-gray-800 p-0">
                              <input
                                type="number"
                                inputMode="numeric"
                                min="0"
                                max={col.capacity[shift] || 0}
                                placeholder="0"
                                className={`${INPUT_BASE} font-medium`}
                                value={col.actualProd.lh[shift]}
                                disabled={!isEditableShift(col, shift)}
                                onChange={(e) =>
                                  handleActualProdChange(globalIdx, "lh", shift, e.target.value)
                                }
                              />
                            </td>
                          ))}

                          <td className="border border-gray-800 p-1 font-bold bg-gray-100">
                            {sumValues(
                              col.actualProd.lh.shift1,
                              col.actualProd.lh.shift2,
                              col.actualProd.lh.shift3
                            )}
                          </td>
                        </React.Fragment>
                      ))}
                    </tr>

                    <tr>
                      <td className="border border-gray-800 p-1 font-bold bg-gray-100 w-10">RH</td>

                      {chunk.map(({ col, globalIdx }) => (
                        <React.Fragment key={`rh-${globalIdx}`}>
                          {SHIFT_KEYS.map((shift) => (
                            <td key={shift} className="border border-gray-800 p-0">
                              <input
                                type="number"
                                inputMode="numeric"
                                min="0"
                                max={col.capacity[shift] || 0}
                                placeholder="0"
                                className={`${INPUT_BASE} font-medium`}
                                value={col.actualProd.rh[shift]}
                                disabled={!isEditableShift(col, shift)}
                                onChange={(e) =>
                                  handleActualProdChange(globalIdx, "rh", shift, e.target.value)
                                }
                              />
                            </td>
                          ))}

                          <td className="border border-gray-800 p-1 font-bold bg-gray-100">
                            {sumValues(
                              col.actualProd.rh.shift1,
                              col.actualProd.rh.shift2,
                              col.actualProd.rh.shift3
                            )}
                          </td>
                        </React.Fragment>
                      ))}
                    </tr>

                    <tr className="bg-gray-50">
                      <td colSpan={3} className="border border-gray-800 p-1 font-bold text-left px-2">
                        NO OF MANPOWER (UTILIZED)
                      </td>

                      {chunk.map(({ col, globalIdx }) => (
                        <React.Fragment key={`mp-${globalIdx}`}>
                          {SHIFT_KEYS.map((shift) => (
                            <td key={shift} className="border border-gray-800 p-0">
                              <input
                                type="number"
                                inputMode="numeric"
                                min="0"
                                placeholder="0"
                                className={`${INPUT_BASE} font-medium`}
                                value={col.manpower[shift]}
                                disabled={!isEditableShift(col, shift)}
                                onChange={(e) =>
                                  handleManpowerChange(globalIdx, shift, e.target.value)
                                }
                              />
                            </td>
                          ))}

                          <td className="border border-gray-800 p-1 font-bold bg-gray-200">
                            {sumValues(col.manpower.shift1, col.manpower.shift2, col.manpower.shift3)}
                          </td>
                        </React.Fragment>
                      ))}
                    </tr>

                    {LOSS_REASONS.map((loss) => (
                      <tr key={`loss-row-${loss.id}`} className="hover:bg-gray-50/50">
                        <td className="border border-gray-800 p-1 font-bold text-gray-700">{loss.id}</td>

                        {loss.isFirst && (
                          <td
                            rowSpan={loss.rowSpan}
                            className="border border-gray-800 p-1 font-bold text-gray-800 bg-gray-100 align-middle text-[10px] sm:text-[11px] tracking-wider"
                          >
                            {loss.category}
                          </td>
                        )}

                        <td className="border border-gray-800 p-1 text-left px-2 font-medium text-gray-800">
                          {loss.name}
                        </td>

                        {chunk.map(({ col, globalIdx }) => (
                          <React.Fragment key={`l-${loss.id}-${globalIdx}`}>
                            {SHIFT_KEYS.map((shift) => (
                              <td key={shift} className="border border-gray-800 p-0">
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  min="0"
                                  max={col.capacity[shift] || 0}
                                  className={INPUT_BASE}
                                  value={col.losses[`loss_${loss.id}`]?.[shift]}
                                  disabled={!isEditableShift(col, shift)}
                                  onChange={(e) =>
                                    handleLossChange(globalIdx, loss.id, shift, e.target.value)
                                  }
                                />
                              </td>
                            ))}

                            <td className="border border-gray-800 p-1 font-bold bg-gray-100 text-gray-800">
                              {sumValues(
                                col.losses[`loss_${loss.id}`]?.shift1,
                                col.losses[`loss_${loss.id}`]?.shift2,
                                col.losses[`loss_${loss.id}`]?.shift3
                              )}
                            </td>
                          </React.Fragment>
                        ))}
                      </tr>
                    ))}

                    {/* Total loss */}
                    <tr className="bg-gray-200 font-extrabold text-gray-900">
                      <td colSpan={3} className="border border-gray-800 p-1.5 text-left px-2">
                        Total Loss
                      </td>

                      {chunk.map(({ col, globalIdx }) => (
                        <React.Fragment key={`tot-loss-${globalIdx}`}>
                          <td className="border border-gray-800 p-1">{calcTotalLoss(col, "shift1")}</td>
                          <td className="border border-gray-800 p-1">{calcTotalLoss(col, "shift2")}</td>
                          <td className="border border-gray-800 p-1">{calcTotalLoss(col, "shift3")}</td>
                          <td className="border border-gray-800 p-1 bg-gray-300">
                            {sumValues(
                              calcTotalLoss(col, "shift1"),
                              calcTotalLoss(col, "shift2"),
                              calcTotalLoss(col, "shift3")
                            )}
                          </td>
                        </React.Fragment>
                      ))}
                    </tr>

                    {/* Section Incharge Sign */}
                    <tr className="bg-gray-50">
                      <td colSpan={3} className="border border-gray-800 p-1.5 text-left px-2 font-bold">
                        SECTION INCHARGE SIGN
                        <span className="block text-[9px] font-semibold text-gray-500">
                          (approved by section incharge)
                        </span>
                      </td>

                      {chunk.map(({ col, globalIdx }) => (
                        <React.Fragment key={`sos-${globalIdx}`}>
                          {SHIFT_KEYS.map((shift) => {
                            const sign = col.signatures[shift];
                            return (
                              <td key={shift} className="border border-gray-800 p-1 align-middle">
                                {sign ? (
                                  <div className="flex flex-col items-center">
                                    <span className="text-[9px] font-bold text-green-600">Approved ✓</span>
                                    <span className="text-[10px] font-black uppercase break-all leading-tight">
                                      {sign}
                                    </span>
                                  </div>
                                ) : col.locked ? (
                                  <span className="text-gray-400">-</span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleApproveShift(globalIdx, shift)}
                                    className="bg-orange-500 hover:bg-orange-600 text-white text-[10px] font-bold px-2 py-2 rounded uppercase tracking-wider cursor-pointer w-full"
                                  >
                                    Approve
                                  </button>
                                )}
                              </td>
                            );
                          })}
                          <td className="border border-gray-800 p-1 bg-gray-100"></td>
                        </React.Fragment>
                      ))}
                    </tr>

                    {/* Shift Officer (PE) */}
                    <tr className="bg-gray-50">
                      <td colSpan={3} className="border border-gray-800 p-1.5 text-left px-2 font-bold">
                        SHIFT OFFICER SIGN (PE)
                        <span className="block text-[9px] font-semibold text-gray-500">
                          (sent to PE for approval)
                        </span>
                      </td>

                      {chunk.map(({ col, globalIdx }) => {
                        return (
                          <React.Fragment key={`pe-${globalIdx}`}>
                            {SHIFT_KEYS.map((shift) => {
                              const peApproved = /^Approved/i.test(col.peSign?.[shift] || "");
                              const peName = (col.peSign?.[shift] || "").replace(/^Approved \(/i, "").replace(/\)$/, "");
                              const shiftSigned = !!col.signatures?.[shift];

                              return (
                                <td key={shift} className="border border-gray-800 p-0 align-middle">
                                  {shiftSigned && peApproved ? (
                                    <div className="flex flex-col items-center py-1">
                                      <span className="text-[9px] font-bold text-green-600">Verified ✓</span>
                                      <span className="text-[9px] font-black uppercase text-gray-800 break-all px-1 leading-tight">{peName}</span>
                                    </div>
                                  ) : shiftSigned && col.assignedPe?.[shift] ? (
                                    <div className="flex flex-col items-center py-1">
                                      <span className="text-[9px] font-bold text-red-600">Pending PE</span>
                                      <span className="text-[9px] font-black uppercase text-gray-800 break-all px-1 leading-tight">
                                        {col.assignedPe[shift]}
                                      </span>
                                    </div>
                                  ) : (
                                    <select
                                      className="w-full h-full text-center px-0 outline-none bg-transparent font-semibold cursor-pointer text-[10px] sm:text-[11px] py-2"
                                      value={col.assignedPe?.[shift] || ""}
                                      disabled={shiftSigned} 
                                      onChange={(e) => handlePeChange(globalIdx, shift, e.target.value)}
                                    >
                                      <option value="">-- PE --</option>
                                      {peUsers.map((pe, idx) => {
                                        const uname = pe.username || pe.employeeId || pe.name;
                                        return (
                                          <option key={idx} value={uname}>
                                            {String(uname).toUpperCase()}
                                          </option>
                                        );
                                      })}
                                    </select>
                                  )}
                                </td>
                              );
                            })}
                            <td className="border border-gray-800 p-1 bg-gray-100"></td>
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>

        <div className="border border-gray-800 p-2 bg-yellow-50 text-[11px] font-bold text-gray-800 flex items-center justify-center text-center">
          NOTE : TOOL CHANGE LOSSES TIME ABOVE 20 MINS ONLY MENTION THE LOSS
        </div>

        <div className="flex justify-end gap-4 pt-4 border-t border-gray-300">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || saveSuccess || !hasUnlockedColumn}
            className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white px-10 py-3.5 rounded font-bold transition-colors shadow-lg hover:cursor-pointer disabled:cursor-not-allowed text-sm tracking-wider uppercase"
          >
            {isSaving ? "SAVING..." : saveSuccess ? "SAVED ✓" : "SUBMIT TO PE"}
          </button>
        </div>
      </div>
    </div>
  );
}