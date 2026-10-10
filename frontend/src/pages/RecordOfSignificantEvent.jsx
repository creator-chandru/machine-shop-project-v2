import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, FileDown } from "lucide-react";
import Header from "../components/Header";
const INITIAL_ROWS = 1;

const formMeta = {
  formCode: "QF/07/MPD-02",
  revision: "07",
  revisionDate: "13.08.2024",
  title: "RECORD OF SIGNIFICANT EVENT (MACHINE SHOP)",
  company: "SAKTHI AUTO",
  applicableEvents:
    "Significant Machine Break Downs & Other unusual situation and applicable 4M change.",
};

const OP_OPTIONS = ["20", "30", "40", "50", "60", "70"];

const getTodayISODate = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const createEmptyRow = () => ({
  controlSpec: "",
  inspectionGauge: "",
  before: { part1: "", part2: "", part3: "" },
  after: { part1: "", part2: "", part3: "" },
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

export default function RecordOfSignificantEvent() {
  const { shopId } = useParams();
  const navigate = useNavigate();

  const [machineDetails, setMachineDetails] = useState([]);
  const [lineMappings, setLineMappings] = useState([]);
  const [loadingMasterData, setLoadingMasterData] = useState(true);

  const [isSavedRecord, setIsSavedRecord] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "" });
  const lookupSeqRef = useRef(0);

  const triggerToast = (message, type = "error") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast({ message: "", type: "" });
    }, 4000);
  };

  // 1. Header Information
  const [header, setHeader] = useState({
    machineShop: parseInt(shopId, 10) || 3,
    month: "",
    lineCode: "",
    partName: "",
    event: "",
    mcNo: "",
    opNo: "",
    date: getTodayISODate(),
    shift: "I",
    from: "",
    to: "",
  });

  // 2. Traceability Information (Manual and auto-generated are editable)
  const [traceability, setTraceability] = useState({
    casting: {
      before: { part1: "", part2: "", part3: "" },
      after: { part1: "", part2: "", part3: "" },
    },
    machining: {
      before: { part1: "", part2: "", part3: "" },
      after: { part1: "", part2: "", part3: "" },
    },
  });

  // 3. Dynamic Measurement Rows
  const [rows, setRows] = useState(
    Array.from({ length: INITIAL_ROWS }, () => createEmptyRow())
  );

  // 4. Signatures
  const [signatures, setSignatures] = useState({
    prodnIncharge: "",
    qcIncharge: "",
    prodnHofSign: "",
  });

  const [peUsers, setPeUsers] = useState([]);
  const [qcUsers, setQcUsers] = useState([]);
  const [hofUsers, setHofUsers] = useState([]);

  // Load master data (details & mappings)
  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        if (!shopId) return;
        const token = localStorage.getItem("token");
        const headers = { Authorization: `Bearer ${token}` };

        const res = await fetch(
          `${process.env.REACT_APP_API_URL || "http://localhost:5000"}/api/machine-shop/${shopId}/details`,
          { headers }
        );
        if (res.ok) {
          const data = await res.json();
          setMachineDetails(data);
        }

        const mappingRes = await fetch(
          `${process.env.REACT_APP_API_URL || "http://localhost:5000"}/api/mappings/${shopId}/lines`,
          { headers }
        );
        if (mappingRes.ok) {
          const mappingData = await mappingRes.json();
          setLineMappings(mappingData);
        }
      } catch (err) {
        console.error("Master data fetch error:", err);
      } finally {
        setLoadingMasterData(false);
      }
    };
    fetchMasterData();
  }, [shopId]);

  // Fetch Users for Signatures
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(
          `${process.env.REACT_APP_API_URL || "http://localhost:5000"}/api/significant-event-users`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();

        if (Array.isArray(data)) {
          setPeUsers(data.filter((u) => u.role === "productengineer"));
          setQcUsers(data.filter((u) => u.role === "qc"));
          setHofUsers(data.filter((u) => u.role === "hof"));
        }
      } catch (error) {
        console.error("Error fetching users:", error);
      }
    };
    fetchUsers();
  }, []);

  const lineCodes =
    lineMappings.length > 0
      ? lineMappings.map((m) => m.lineCode)
      : [...new Set(machineDetails.map((item) => item.lineCode).filter(Boolean))];

  const machineOptionsRaw = machineDetails.filter(
    (item) => item.lineCode === header.lineCode
  );
  const machineOptions = Array.from(
    new Set(machineOptionsRaw.map((m) => m.machineNo).filter(Boolean))
  );

  // Auto-generate Machining Traceability
  const fetchMachiningTraceability = async (lineCode, date, shift) => {
    if (!lineCode || !date || !shift) return;

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${process.env.REACT_APP_API_URL || "http://localhost:5000"}/api/daily-production-report/traceability?lineCode=${encodeURIComponent(
          lineCode
        )}&date=${encodeURIComponent(date)}&shift=${encodeURIComponent(shift)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.ok) {
        const data = await res.json();
        if (data.partTraceability) {
          const generated = data.partTraceability;
          setTraceability((prev) => ({
            ...prev,
            machining: {
              before: { part1: generated, part2: generated, part3: generated },
              after: { part1: generated, part2: generated, part3: generated },
            },
          }));
        }
      }
    } catch (err) {
      console.error("Machining Traceability fetch error:", err);
    }
  };

  // Reset form to blank template state
  const resetFormState = (retainingLine = "", retainingMc = "", retainingDate = getTodayISODate(), retainingShift = "I") => {
    setIsSavedRecord(false);
    setHeader((prev) => ({
      ...prev,
      month: "",
      event: "",
      opNo: "",
      from: "",
      to: "",
      lineCode: retainingLine,
      mcNo: retainingMc,
      date: retainingDate,
      shift: retainingShift,
    }));
    setTraceability({
      casting: {
        before: { part1: "", part2: "", part3: "" },
        after: { part1: "", part2: "", part3: "" },
      },
      machining: {
        before: { part1: "", part2: "", part3: "" },
        after: { part1: "", part2: "", part3: "" },
      },
    });
    setRows(Array.from({ length: INITIAL_ROWS }, () => createEmptyRow()));
    setSignatures({
      prodnIncharge: "",
      qcIncharge: "",
      prodnHofSign: "",
    });
  };

  // ==========================================================
  // COMBO CHECK: lineCode + mcNo + date + shift
  // ==========================================================
  const checkExistingRecord = async (lineCode, mcNo, date, shift) => {
    if (!lineCode || !mcNo || !date || !shift) {
      resetFormState(lineCode, mcNo, date, shift);
      return;
    }

    const seq = ++lookupSeqRef.current;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${process.env.REACT_APP_API_URL || "http://localhost:5000"}/api/significant-event-record?lineCode=${encodeURIComponent(
          lineCode
        )}&mcNo=${encodeURIComponent(mcNo)}&date=${encodeURIComponent(date)}&shift=${encodeURIComponent(shift)}&machineShop=${encodeURIComponent(shopId || 3)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (seq !== lookupSeqRef.current) return;

      if (res.ok) {
        const data = await res.json();
        if (seq !== lookupSeqRef.current) return;

        if (Array.isArray(data) && data.length > 0) {
          const first = data[0];
          setIsSavedRecord(true);

          setHeader((prev) => ({
            ...prev,
            month: first.month || "",
            partName: first.partName || prev.partName,
            event: first.event || "",
            opNo: first.opNo || "",
            from: first.fromTime || "",
            to: first.toTime || "",
          }));

          setTraceability({
            casting: {
              before: {
                part1: first.castingBeforePart1 || "",
                part2: first.castingBeforePart2 || "",
                part3: first.castingBeforePart3 || "",
              },
              after: {
                part1: first.castingAfterPart1 || "",
                part2: first.castingAfterPart2 || "",
                part3: first.castingAfterPart3 || "",
              },
            },
            machining: {
              before: {
                part1: first.machiningBeforePart1 || "",
                part2: first.machiningBeforePart2 || "",
                part3: first.machiningBeforePart3 || "",
              },
              after: {
                part1: first.machiningAfterPart1 || "",
                part2: first.machiningAfterPart2 || "",
                part3: first.machiningAfterPart3 || "",
              },
            },
          });

          setRows(
            data.map((r) => ({
              controlSpec: r.controlSpec || "",
              inspectionGauge: r.inspectionGauge || "",
              before: {
                part1: r.beforePart1 || "",
                part2: r.beforePart2 || "",
                part3: r.beforePart3 || "",
              },
              after: {
                part1: r.afterPart1 || "",
                part2: r.afterPart2 || "",
                part3: r.afterPart3 || "",
              },
            }))
          );

          setSignatures({
            prodnIncharge: first.prodnIncharge?.replace(/^(Pending \[|Approved \()\vert{}(\]\vert{}\))$/g, "") || "",
            qcIncharge: first.qcIncharge?.replace(/^(Pending \[|Approved \()\vert{}(\]\vert{}\))$/g, "") || "",
            prodnHofSign: first.prodnHofSign?.replace(/^(Pending \[|Approved \()\vert{}(\]\vert{}\))$/g, "") || "",
          });
          triggerToast("Existing record loaded for this combo.", "success");
        } else {
          resetFormState(lineCode, mcNo, date, shift);
          fetchMachiningTraceability(lineCode, date, shift);
        }
      }
    } catch (err) {
      console.error("Check existing record error:", err);
    }
  };

  // Header change handler with combo refresh
  const handleHeaderChange = (field, val) => {
    let nextHeader = { ...header, [field]: val };

    if (field === "lineCode") {
      const mapping = lineMappings.find((m) => m.lineCode === val);
      const autoPartName =
        mapping?.partSet ||
        machineDetails.find((m) => m.lineCode === val)?.partName ||
        "";
      nextHeader.partName = autoPartName;
      nextHeader.mcNo = "";
    }

    setHeader(nextHeader);

    if (["lineCode", "mcNo", "date", "shift"].includes(field)) {
      checkExistingRecord(nextHeader.lineCode, nextHeader.mcNo, nextHeader.date, nextHeader.shift);
    }
  };

  const handleTraceabilityChange = (type, timing, part, val) => {
    if (isSavedRecord) return;
    setTraceability((prev) => ({
      ...prev,
      [type]: {
        ...prev[type],
        [timing]: {
          ...prev[type][timing],
          [part]: val,
        },
      },
    }));
  };

  const handleRowChange = (rowIdx, field, subField, val) => {
    if (isSavedRecord) return;
    setRows((prev) => {
      const next = [...prev];
      if (subField) {
        next[rowIdx] = {
          ...next[rowIdx],
          [field]: {
            ...next[rowIdx][field],
            [subField]: val,
          },
        };
      } else {
        next[rowIdx] = {
          ...next[rowIdx],
          [field]: val,
        };
      }
      return next;
    });
  };

  const handleSignatureChange = (field, val) => {
    if (isSavedRecord) return;
    setSignatures((prev) => ({ ...prev, [field]: val }));
  };

  const handleAddRow = () => {
    if (isSavedRecord) return;
    setRows((prev) => [...prev, createEmptyRow()]);
  };

  const handleRemoveRow = () => {
    if (isSavedRecord) return;
    setRows((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  };

  // Download PDF
  const handleDownloadPdf = async () => {
    if (!isSavedRecord) {
      triggerToast(
        "No saved record found for this Line Code, Machine No, and Date. Save or submit first to preview PDF.",
        "error"
      );
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const params = new URLSearchParams({
        lineCode: header.lineCode,
        mcNo: header.mcNo,
        date: header.date,
        shift: header.shift,
        partName: header.partName,
        event: header.event,
        shopId: String(shopId || 3),
      });

      const res = await fetch(
        `${process.env.REACT_APP_API_URL || "http://localhost:5000"}/api/significant-event-report?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!res.ok) throw new Error("Failed to generate PDF");

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `Significant_Event_${header.lineCode}_${header.mcNo}_${header.date}.pdf`;
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

  // Save handler with inner table checks removed
  const handleSave = async () => {
    // 1. Header validations
    if (!header.lineCode) {
      triggerToast("Please select Line Code.", "error");
      return;
    }
    if (!header.mcNo) {
      triggerToast("Please select M/C No.", "error");
      return;
    }
    if (!header.opNo) {
      triggerToast("Please select OP No.", "error");
      return;
    }
    if (!header.event || !header.event.trim()) {
      triggerToast("Please specify the Event description.", "error");
      return;
    }
    if (!header.date) {
      triggerToast("Please select Date.", "error");
      return;
    }
    if (!header.shift) {
      triggerToast("Please select Shift.", "error");
      return;
    }
    if (!header.from || !header.to) {
      triggerToast("Please enter both FROM and TO times.", "error");
      return;
    }

    // 2. Casting Traceability validations
    const cB = traceability.casting.before;
    const cA = traceability.casting.after;
    if (!cB.part1 || !cB.part2 || !cB.part3 || !cA.part1 || !cA.part2 || !cA.part3) {
      triggerToast("Please fill all Casting Traceability part codes (Before & After).", "error");
      return;
    }

    // 3. Machining Traceability validations
    const mB = traceability.machining.before;
    const mA = traceability.machining.after;
    if (!mB.part1 || !mB.part2 || !mB.part3 || !mA.part1 || !mA.part2 || !mA.part3) {
      triggerToast("Please fill all Machining Traceability part codes (Before & After).", "error");
      return;
    }

    // 4. Signature validations
    if (!signatures.prodnIncharge) {
      triggerToast("Please select Production Incharge signature before submitting.", "error");
      return;
    }
    if (!signatures.qcIncharge) {
      triggerToast("Please select QC Incharge signature before submitting.", "error");
      return;
    }
    if (!signatures.prodnHofSign) {
      triggerToast("Please select Production HOF signature before submitting.", "error");
      return;
    }

    const payload = {
      header,
      traceability,
      rows,
      signatures,
    };

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${process.env.REACT_APP_API_URL || "http://localhost:5000"}/api/significant-event-record`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) throw new Error("Save failed");

      const data = await res.json();
      setIsSavedRecord(true);
      triggerToast(data.message || "Record of Significant Event saved successfully!", "success");
    } catch (err) {
      console.error("Save error:", err);
      triggerToast("Failed to save record. Check console for details.", "error");
    }
  };

  return (
    <div className="min-h-screen bg-[#2d2d2d] flex flex-col items-center justify-center p-6 pb-20">
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ message: "", type: "" })}
      />
      <Header />
      <div className="bg-white w-full max-w-[90rem] rounded-xl p-8 shadow-2xl overflow-x-auto border-4 border-gray-100 space-y-6">
        {/* Card Header & PDF Preview */}
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
            <h2 className="text-2xl font-bold text-gray-800 uppercase tracking-wide">
              {formMeta.title}
            </h2>
            <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-2">
              <span>Form Code: {formMeta.formCode}</span>
              <span>|</span>
              <span>Revision: {formMeta.revision}</span>
              <span>|</span>
              <span>Revision Date: {formMeta.revisionDate}</span>
              <span>|</span>
              <span className="font-bold text-orange-600">Shop ID: {shopId}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDownloadPdf}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider shadow transition-colors cursor-pointer"
          >
            <FileDown className="w-4 h-4" /> Preview PDF
          </button>
        </div>

        {/* 1. HEADER & EVENT DETAILS TABLE */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border-2 border-gray-800 text-xs text-center table-fixed">
            <tbody>
              {/* LINE CODE & PART NAME */}
              <tr>
                <td className="border border-gray-800 p-2 text-left bg-white w-1/2">
                  <div className="flex items-center gap-2">
                    <label className="font-bold text-gray-800 whitespace-nowrap">
                      LINE CODE :
                    </label>
                    <select
                      className="w-full font-semibold text-gray-800 outline-none px-2 py-0.5 bg-transparent border-b border-gray-300 focus:border-orange-500 cursor-pointer"
                      value={header.lineCode}
                      onChange={(e) => handleHeaderChange("lineCode", e.target.value)}
                      disabled={loadingMasterData}
                    >
                      <option value="">
                        {loadingMasterData ? "Loading..." : "Select Line Code"}
                      </option>
                      {lineCodes.map((lc) => (
                        <option key={lc} value={lc}>
                          {lc}
                        </option>
                      ))}
                    </select>
                  </div>
                </td>

                <td className="border border-gray-800 p-2 text-left bg-gray-50 w-1/2">
                  <div className="flex items-center gap-2">
                    <label className="font-bold text-gray-800 whitespace-nowrap">
                      PART NAME :
                    </label>
                    <input
                      type="text"
                      readOnly
                      placeholder="Auto-filled from Line Code"
                      className="w-full font-semibold text-gray-700 outline-none px-2 py-0.5 bg-transparent cursor-not-allowed"
                      value={header.partName}
                    />
                  </div>
                </td>
              </tr>

              {/* EVENT */}
              <tr>
                <td colSpan={2} className="border border-gray-800 p-2 text-left bg-white">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-800 whitespace-nowrap">
                      EVENT :
                    </span>
                    <input
                      type="text"
                      placeholder="Specify event details..."
                      disabled={isSavedRecord}
                      className="w-full font-semibold text-gray-800 outline-none px-2 py-0.5 bg-transparent border-b border-transparent focus:border-orange-400 disabled:bg-gray-100"
                      value={header.event}
                      onChange={(e) => handleHeaderChange("event", e.target.value)}
                    />
                  </div>
                </td>
              </tr>

              {/* M/C NO & OP NO */}
              <tr>
                <td className="border border-gray-800 p-1 bg-white w-1/2">
                  <div className="flex items-center px-2 gap-2">
                    <span className="font-bold text-gray-800 whitespace-nowrap">
                      M/C No :
                    </span>
                    <select
                      className="w-full outline-none font-medium text-center bg-transparent cursor-pointer"
                      value={header.mcNo}
                      onChange={(e) => handleHeaderChange("mcNo", e.target.value)}
                      disabled={!header.lineCode}
                    >
                      <option value="">Select M/C No</option>
                      {machineOptions.map((mc, idx) => (
                        <option key={`${mc}-${idx}`} value={mc}>
                          {mc}
                        </option>
                      ))}
                    </select>
                  </div>
                </td>
                <td className="border border-gray-800 p-1 bg-white w-1/2">
                  <div className="flex items-center px-2 gap-2">
                    <span className="font-bold text-gray-800 whitespace-nowrap">
                      OP No :
                    </span>
                    <select
                      className="w-full outline-none font-medium text-center bg-transparent cursor-pointer disabled:bg-gray-100"
                      value={header.opNo}
                      disabled={isSavedRecord}
                      onChange={(e) => handleHeaderChange("opNo", e.target.value)}
                    >
                      <option value="">Select OP No</option>
                      {OP_OPTIONS.map((op) => (
                        <option key={op} value={op}>
                          {op}
                        </option>
                      ))}
                    </select>
                  </div>
                </td>
              </tr>

              {/* DATE & SHIFT */}
              <tr>
                <td className="border border-gray-800 p-1 bg-white w-1/2">
                  <div className="flex items-center px-2 gap-2">
                    <span className="font-bold text-gray-800 whitespace-nowrap">
                      DATE :
                    </span>
                    <input
                      type="date"
                      className="w-full outline-none font-medium text-center bg-transparent cursor-pointer"
                      value={header.date}
                      onChange={(e) => handleHeaderChange("date", e.target.value)}
                    />
                  </div>
                </td>
                <td className="border border-gray-800 p-1 bg-white w-1/2">
                  <div className="flex items-center px-2 gap-2">
                    <span className="font-bold text-gray-800 whitespace-nowrap">
                      SHIFT :
                    </span>
                    <select
                      className="w-full outline-none font-medium text-center bg-transparent cursor-pointer disabled:bg-gray-100"
                      value={header.shift}
                      disabled={isSavedRecord}
                      onChange={(e) => handleHeaderChange("shift", e.target.value)}
                    >
                      <option value="I">I</option>
                      <option value="II">II</option>
                      <option value="III">III</option>
                    </select>
                  </div>
                </td>
              </tr>

              {/* FROM & TO TIME */}
              <tr>
                <td className="border border-gray-800 p-1 bg-white w-1/2">
                  <div className="flex items-center px-2 gap-2">
                    <span className="font-bold text-gray-800 whitespace-nowrap">
                      FROM :
                    </span>
                    <input
                      type="time"
                      disabled={isSavedRecord}
                      className="w-full outline-none font-medium text-center bg-transparent disabled:bg-gray-100"
                      value={header.from}
                      onChange={(e) => handleHeaderChange("from", e.target.value)}
                    />
                  </div>
                </td>
                <td className="border border-gray-800 p-1 bg-white w-1/2">
                  <div className="flex items-center px-2 gap-2">
                    <span className="font-bold text-gray-800 whitespace-nowrap">
                      TO :
                    </span>
                    <input
                      type="time"
                      disabled={isSavedRecord}
                      className="w-full outline-none font-medium text-center bg-transparent disabled:bg-gray-100"
                      value={header.to}
                      onChange={(e) => handleHeaderChange("to", e.target.value)}
                    />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 2. MEASUREMENTS & SPECIFICATIONS TABLE */}
        <div className="pt-2">
          <div className="flex justify-between items-center mb-2 px-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                Inspection & Control Specifications
              </span>
              <span className="text-[11px] bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full font-semibold">
                {rows.length} {rows.length === 1 ? "Custom Row" : "Custom Rows"}
              </span>
            </div>

            {!isSavedRecord && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAddRow}
                  className="inline-flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-4 py-1.5 rounded transition-colors shadow hover:cursor-pointer"
                >
                  <span className="text-sm font-bold leading-none">+</span> Add Row
                </button>

                {rows.length > 1 && (
                  <button
                    type="button"
                    onClick={handleRemoveRow}
                    className="inline-flex items-center gap-1 bg-gray-600 hover:bg-gray-700 text-white text-xs font-bold px-3 py-1.5 rounded transition-colors shadow hover:cursor-pointer"
                  >
                    <span className="text-sm font-bold leading-none">−</span> Delete Row
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse border-2 border-gray-800 text-xs text-center table-fixed">
              <thead>
                <tr className="bg-gray-100 text-gray-800 font-bold">
                  <th rowSpan={2} className="border border-gray-800 p-2 w-[22%]">
                    CONTROL SPEC
                  </th>
                  <th rowSpan={2} className="border border-gray-800 p-2 w-[24%]">
                    INSPECTION INSTRUMENT / GAUGE
                  </th>
                  <th colSpan={3} className="border border-gray-800 p-1.5 w-[27%] bg-gray-200">
                    BEFORE OCCURANCE
                  </th>
                  <th colSpan={3} className="border border-gray-800 p-1.5 w-[27%] bg-gray-200">
                    AFTER CORRECTION
                  </th>
                </tr>

                <tr className="bg-gray-50 text-gray-800 font-bold text-[11px]">
                  <th className="border border-gray-800 p-1 w-[9%]">PART 1</th>
                  <th className="border border-gray-800 p-1 w-[9%]">PART 2</th>
                  <th className="border border-gray-800 p-1 w-[9%]">PART 3</th>
                  <th className="border border-gray-800 p-1 w-[9%]">PART 1</th>
                  <th className="border border-gray-800 p-1 w-[9%]">PART 2</th>
                  <th className="border border-gray-800 p-1 w-[9%]">PART 3</th>
                </tr>
              </thead>

              <tbody>
                {/* 1) Part Traceability - Casting (Manual Entry) */}
                <tr className="h-8">
                  <td colSpan={2} className="border border-gray-800 px-3 py-1 text-left font-medium bg-gray-50">
                    1) Part Traceability - Casting (date code):
                  </td>
                  {["part1", "part2", "part3"].map((p) => (
                    <td key={`cast-b-${p}`} className="border border-gray-800 p-0">
                      <input
                        type="text"
                        disabled={isSavedRecord}
                        placeholder="Manual"
                        className="w-full h-full text-center outline-none bg-transparent py-1 px-1 disabled:bg-gray-100 font-medium"
                        value={traceability.casting.before[p]}
                        onChange={(e) =>
                          handleTraceabilityChange("casting", "before", p, e.target.value)
                        }
                      />
                    </td>
                  ))}
                  {["part1", "part2", "part3"].map((p) => (
                    <td key={`cast-a-${p}`} className="border border-gray-800 p-0">
                      <input
                        type="text"
                        disabled={isSavedRecord}
                        placeholder="Manual"
                        className="w-full h-full text-center outline-none bg-transparent py-1 px-1 disabled:bg-gray-100 font-medium"
                        value={traceability.casting.after[p]}
                        onChange={(e) =>
                          handleTraceabilityChange("casting", "after", p, e.target.value)
                        }
                      />
                    </td>
                  ))}
                </tr>

                {/* 2) Part Traceability - Machining (Auto-Generated + Manually Editable) */}
                <tr className="h-8">
                  <td colSpan={2} className="border border-gray-800 px-3 py-1 text-left font-medium bg-gray-50">
                    2) Part Traceability - Machining:
                  </td>
                  {["part1", "part2", "part3"].map((p) => (
                    <td key={`mach-b-${p}`} className="border border-gray-800 p-0">
                      <input
                        type="text"
                        disabled={isSavedRecord}
                        placeholder="Auto / Edit"
                        className="w-full h-full text-center outline-none bg-transparent py-1 px-1 disabled:bg-gray-100 font-medium"
                        value={traceability.machining.before[p]}
                        onChange={(e) =>
                          handleTraceabilityChange("machining", "before", p, e.target.value)
                        }
                      />
                    </td>
                  ))}
                  {["part1", "part2", "part3"].map((p) => (
                    <td key={`mach-a-${p}`} className="border border-gray-800 p-0">
                      <input
                        type="text"
                        disabled={isSavedRecord}
                        placeholder="Auto / Edit"
                        className="w-full h-full text-center outline-none bg-transparent py-1 px-1 disabled:bg-gray-100 font-medium"
                        value={traceability.machining.after[p]}
                        onChange={(e) =>
                          handleTraceabilityChange("machining", "after", p, e.target.value)
                        }
                      />
                    </td>
                  ))}
                </tr>

                {/* Dynamic Custom Data Rows */}
                {rows.map((row, rIdx) => (
                  <tr key={`data-row-${rIdx}`} className="h-8">
                    {/* CONTROL SPEC */}
                    <td className="border border-gray-800 p-0">
                      <input
                        type="text"
                        disabled={isSavedRecord}
                        className="w-full h-full text-center outline-none bg-transparent py-1 px-2 disabled:bg-gray-100 font-medium"
                        placeholder="Specification"
                        value={row.controlSpec}
                        onChange={(e) =>
                          handleRowChange(rIdx, "controlSpec", null, e.target.value)
                        }
                      />
                    </td>

                    {/* INSPECTION INSTRUMENT / GAUGE */}
                    <td className="border border-gray-800 p-0">
                      <input
                        type="text"
                        disabled={isSavedRecord}
                        className="w-full h-full text-center outline-none bg-transparent py-1 px-2 disabled:bg-gray-100 font-medium"
                        placeholder="Instrument / Gauge"
                        value={row.inspectionGauge}
                        onChange={(e) =>
                          handleRowChange(rIdx, "inspectionGauge", null, e.target.value)
                        }
                      />
                    </td>

                    {/* BEFORE OCCURANCE (PART 1, 2, 3) */}
                    {["part1", "part2", "part3"].map((p) => (
                      <td key={`b-${p}-${rIdx}`} className="border border-gray-800 p-0">
                        <select
                          disabled={isSavedRecord}
                          className="w-full h-full text-center outline-none bg-transparent py-1 px-1 font-semibold cursor-pointer disabled:bg-gray-100"
                          value={row.before[p]}
                          onChange={(e) =>
                            handleRowChange(rIdx, "before", p, e.target.value)
                          }
                        >
                          <option value="">-</option>
                          <option value="OK">OK</option>
                          <option value="NOT OK">NOT OK</option>
                        </select>
                      </td>
                    ))}

                    {/* AFTER CORRECTION (PART 1, 2, 3) */}
                    {["part1", "part2", "part3"].map((p) => (
                      <td key={`a-${p}-${rIdx}`} className="border border-gray-800 p-0">
                        <select
                          disabled={isSavedRecord}
                          className="w-full h-full text-center outline-none bg-transparent py-1 px-1 font-semibold cursor-pointer disabled:bg-gray-100"
                          value={row.after[p]}
                          onChange={(e) =>
                            handleRowChange(rIdx, "after", p, e.target.value)
                          }
                        >
                          <option value="">-</option>
                          <option value="OK">OK</option>
                          <option value="NOT OK">NOT OK</option>
                        </select>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 3. SIGNATURES & APPLICABLE EVENTS TABLE */}
        <div className="overflow-x-auto pt-2">
          <table className="w-full border-collapse border-2 border-gray-800 text-xs text-center table-fixed">
            <tbody>
              {/* PRODN INCHARGE */}
              <tr>
                <td className="border border-gray-800 p-2 font-bold text-gray-800 bg-gray-50 text-left w-[25%]">
                  PRODN INCHARGE
                </td>
                <td className="border border-gray-800 p-0 text-left w-[75%]">
                  <select
                    disabled={isSavedRecord}
                    className="w-full outline-none font-medium bg-transparent px-3 py-2 cursor-pointer disabled:bg-gray-100"
                    value={signatures.prodnIncharge}
                    onChange={(e) => handleSignatureChange("prodnIncharge", e.target.value)}
                  >
                    <option value="">Select Prodn Incharge / PE</option>
                    {peUsers.map((u, i) => (
                      <option key={i} value={u.username}>
                        {u.username}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>

              {/* QC INCHARGE */}
              <tr>
                <td className="border border-gray-800 p-2 font-bold text-gray-800 bg-gray-50 text-left w-[25%]">
                  QC INCHARGE
                </td>
                <td className="border border-gray-800 p-0 text-left w-[75%]">
                  <select
                    disabled={isSavedRecord}
                    className="w-full outline-none font-medium bg-transparent px-3 py-2 cursor-pointer disabled:bg-gray-100"
                    value={signatures.qcIncharge}
                    onChange={(e) => handleSignatureChange("qcIncharge", e.target.value)}
                  >
                    <option value="">Select QC Incharge</option>
                    {qcUsers.map((u, i) => (
                      <option key={i} value={u.username}>
                        {u.username}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>

              {/* PRODN HOF SIGN */}
              <tr>
                <td className="border border-gray-800 p-2 font-bold text-gray-800 bg-gray-50 text-left w-[25%]">
                  PRODN HOF SIGN
                </td>
                <td className="border border-gray-800 p-0 text-left w-[75%]">
                  <select
                    disabled={isSavedRecord}
                    className="w-full outline-none font-medium bg-transparent px-3 py-2 cursor-pointer disabled:bg-gray-100"
                    value={signatures.prodnHofSign}
                    onChange={(e) => handleSignatureChange("prodnHofSign", e.target.value)}
                  >
                    <option value="">Select HOF</option>
                    {hofUsers.map((u, i) => (
                      <option key={i} value={u.username}>
                        {u.username}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>

              {/* APPLICABLE EVENTS */}
              <tr>
                <td colSpan={2} className="border border-gray-800 p-2 text-left bg-white">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-bold text-gray-800 whitespace-nowrap text-xs">
                      Applicable Events:
                    </span>
                    <span className="text-xs text-gray-700">
                      {formMeta.applicableEvents}
                    </span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footer Meta Code */}
        <div className="text-xs text-gray-600 font-semibold pt-1">
          {formMeta.formCode}, Rev.No: {formMeta.revision} dt {formMeta.revisionDate}
        </div>

        {/* Save Button */}
        <div className="flex justify-end gap-4 pt-4 border-t border-gray-300">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSavedRecord}
            className={`bg-orange-500 hover:bg-orange-600 text-white px-10 py-3 rounded font-bold transition-colors shadow-lg ${
              isSavedRecord ? "opacity-50 cursor-not-allowed" : "hover:cursor-pointer"
            }`}
          >
            {isSavedRecord ? "Saved" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}