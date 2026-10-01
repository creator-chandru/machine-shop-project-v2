import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useLineSet } from "../context/LineSetContext.jsx";
import { ArrowLeft } from "lucide-react";
import Header from "../components/Header";

const CHUNK_SIZE = 3;
const INITIAL_SECTIONS = 1;
const INITIAL_ROWS = 1;

const formMeta = {
  formCode: "QF/07/MPD-32",
  revision: "02",
  revisionDate: "10.01.2023",
  title: "TOOL CHANGE RECORD",
  company: "SAKTHI AUTO",
  applicableEvents:
    "New cutting tool (Tool holder, Drill, Reamer, Tap, Milling cutters, Milling inserts, Spot facing cutter etc,.), Tool change after tool regrinding / tool repair.",
};

const getTodayISODate = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const createEmptySection = (
  defaultMachineNo = "",
  defaultDate = "",
  numRows = INITIAL_ROWS
) => ({
  partTraceability: "",
  toolDescription: "",
  mcNo: defaultMachineNo,
  opNo: "",
  date: defaultDate || getTodayISODate(),
  shift: "I",
  from: "",
  to: "",
  assignedQc: "", // QC chosen by Shift Incharge
  rows: Array.from({ length: numRows }, () => ({
    nominalValue: "",
    operatorSymbol: "±",
    toleranceValue: "",
    controlSpec: "",
    before: "",
    after: "",
  })),
  toolChangedBy: {
    signature: "",
  },
  verifiedByQc: {
    signature: "",
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

export default function ToolChangeRecord() {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const { lineSet, setLineSet } = useLineSet();

  // Role extraction
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  const currentUsername = currentUser?.username || currentUser?.employeeId || "Unknown";
  const currentUserRole = (currentUser?.role || "").toLowerCase();

  const isShiftIncharge = currentUserRole === "shiftincharge";
  const isQC = currentUserRole === "qc" || currentUserRole === "qualitycontroller";

  const [headerInfo, setHeaderInfo] = useState({
    lineCode: "",
    partName: "",
    partNo: "",
    machineNo: "",
    opNo: "",
    date: getTodayISODate(),
  });

  const [machineDetails, setMachineDetails] = useState([]);
  const [lineMappings, setLineMappings] = useState([]);
  const [loadingMachineDetails, setLoadingMachineDetails] = useState(true);
  const [qcUsers, setQcUsers] = useState([]);

  const [sections, setSections] = useState(
    Array.from({ length: INITIAL_SECTIONS }, () =>
      createEmptySection("", getTodayISODate(), INITIAL_ROWS)
    )
  );

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "" });

  const triggerToast = (message, type = "error") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast({ message: "", type: "" });
    }, 4000);
  };

  // Fetch QC user accounts for the dropdown
  useEffect(() => {
    const fetchQcList = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${process.env.REACT_APP_API_URL}/api/users/qc`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json();
          setQcUsers(data);
        } else {
          setQcUsers([{ username: "qc", employeeId: "qc" }]);
        }
      } catch (err) {
        setQcUsers([{ username: "qc", employeeId: "qc" }]);
      }
    };
    fetchQcList();
  }, []);

  // Fetch Part Traceability
  const fetchPartTraceability = async (lineCode, date, shift, secIdx) => {
    if (!lineCode || !date || !shift) return;

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/tool-change-record/traceability?lineCode=${encodeURIComponent(
          lineCode
        )}&date=${encodeURIComponent(date)}&shift=${encodeURIComponent(shift)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) throw new Error("Failed to fetch Part Traceability");

      const data = await response.json();
      setSections((prev) =>
        prev.map((sec, idx) =>
          idx === secIdx
            ? { ...sec, partTraceability: data.partTraceability || "" }
            : sec
        )
      );
    } catch (err) {
      console.error("Part Traceability fetch error:", err);
    }
  };

  // Sync with LineSetContext
  useEffect(() => {
    if (lineSet) {
      const newLineCode = lineSet.lineCode || headerInfo.lineCode;

      setHeaderInfo((prev) => ({
        ...prev,
        lineCode: lineSet.lineCode || prev.lineCode,
        partName: lineSet.partName || prev.partName,
        partNo: lineSet.partNo || prev.partNo,
        machineNo: lineSet.machineNo || prev.machineNo,
      }));

      if (lineSet.machineNo) {
        setSections((prev) => {
          if (prev.length > 0 && !prev[0].mcNo) {
            const next = [...prev];
            next[0] = { ...next[0], mcNo: lineSet.machineNo };
            return next;
          }
          return prev;
        });
      }

      if (newLineCode) {
        sections.forEach((sec, idx) => {
          fetchPartTraceability(
            newLineCode,
            sec.date || headerInfo.date,
            sec.shift,
            idx
          );
        });
      }
    }
  }, [lineSet]);

  // Fetch machine details + mappings
  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!shopId) return;

        const token = localStorage.getItem("token");
        const headers = { Authorization: `Bearer ${token}` };

        const machineRes = await fetch(
          `${process.env.REACT_APP_API_URL}/api/machine-shop/${shopId}/pre-operation-details`,
          { headers }
        );
        if (!machineRes.ok) throw new Error("Failed to fetch Machine Shop details");
        const machineData = await machineRes.json();
        setMachineDetails(machineData);

        const mappingRes = await fetch(
          `${process.env.REACT_APP_API_URL}/api/mappings/${shopId}/lines`,
          { headers }
        );
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

  const machineOptionsRaw = machineDetails.filter(
    (item) => item.lineCode === headerInfo.lineCode
  );

  const machineOptions = Array.from(
    new Set(machineOptionsRaw.map((m) => m.machineNo).filter(Boolean))
  ).map((machineNo) => machineOptionsRaw.find((m) => m.machineNo === machineNo));

  const handleDateChange = (newDate) => {
    if (isQC) return; // QC cannot modify form header
    setHeaderInfo((prev) => ({ ...prev, date: newDate }));
    setSections((prev) => prev.map((sec) => ({ ...sec, date: newDate })));

    if (headerInfo.lineCode) {
      sections.forEach((sec, idx) => {
        fetchPartTraceability(headerInfo.lineCode, newDate, sec.shift, idx);
      });
    }
  };

  const handleLineChange = (lineCode) => {
    if (isQC) return; // QC cannot modify form header
    const mapping = lineMappings.find((m) => m.lineCode === lineCode);
    const autoPartName = mapping?.partSet || "";
    const autoPartNo = mapping?.idSet || "";

    setHeaderInfo((prev) => ({
      ...prev,
      lineCode,
      partName: autoPartName,
      partNo: autoPartNo,
      machineNo: "",
    }));

    setSections((prev) => prev.map((sec) => ({ ...sec, mcNo: "" })));

    setLineSet({
      machineShop: shopId || "3",
      lineCode,
      partName: autoPartName,
      partNo: autoPartNo,
      machineNo: "",
    });

    sections.forEach((sec, idx) => {
      fetchPartTraceability(lineCode, sec.date || headerInfo.date, sec.shift, idx);
    });
  };

  const handleAddColumn = () => {
    if (isQC) return;
    const currentNumRows = sections[0]?.rows?.length || INITIAL_ROWS;
    const defaultDate = headerInfo.date || getTodayISODate();
    const defaultShift = "I";
    const newIdx = sections.length;

    setSections((prev) => [
      ...prev,
      createEmptySection(headerInfo.machineNo, defaultDate, currentNumRows),
    ]);

    if (headerInfo.lineCode) {
      fetchPartTraceability(headerInfo.lineCode, defaultDate, defaultShift, newIdx);
    }
  };

  const handleRemoveColumn = () => {
    if (isQC) return;
    setSections((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  };

  const handleSectionMetaChange = (secIdx, field, val) => {
    if (isQC) return; // QC cannot edit metadata
    setSections((prev) =>
      prev.map((sec, idx) => (idx === secIdx ? { ...sec, [field]: val } : sec))
    );

    if (field === "mcNo" && secIdx === 0) {
      setHeaderInfo((prev) => ({ ...prev, machineNo: val }));
      setLineSet({
        machineShop: shopId || "3",
        lineCode: headerInfo.lineCode,
        partName: headerInfo.partName,
        partNo: headerInfo.partNo,
        machineNo: val,
      });
    }

    if (field === "date" || field === "shift") {
      const currentSection = sections[secIdx];
      const date = field === "date" ? val : currentSection?.date || headerInfo.date;
      const shift = field === "shift" ? val : currentSection?.shift || "I";
      fetchPartTraceability(headerInfo.lineCode, date, shift, secIdx);
    }
  };

  const handleCellChange = (secIdx, rowIdx, field, val) => {
    if (isQC) return; // QC cannot edit table cell contents

    setSections((prev) => {
      const next = [...prev];
      const updatedRows = [...next[secIdx].rows];
      const targetRow = { ...updatedRows[rowIdx], [field]: val };

      if (
        field === "nominalValue" ||
        field === "operatorSymbol" ||
        field === "toleranceValue"
      ) {
        const nominal = field === "nominalValue" ? val : targetRow.nominalValue || "";
        const symbol = field === "operatorSymbol" ? val : targetRow.operatorSymbol || "±";
        const tolerance = field === "toleranceValue" ? val : targetRow.toleranceValue || "";

        targetRow.controlSpec =
          nominal && tolerance
            ? `${nominal} ${symbol} ${tolerance}`
            : nominal
            ? `${nominal} ${symbol}`
            : tolerance
            ? `${symbol} ${tolerance}`
            : "";
      }

      updatedRows[rowIdx] = targetRow;
      next[secIdx] = { ...next[secIdx], rows: updatedRows };
      return next;
    });
  };

  // Shift Incharge Approves Tool Changed By
  const handleApproveToolChangedBy = (secIdx) => {
    if (!isShiftIncharge) {
      triggerToast("Only the Shift Incharge can sign here.", "error");
      return;
    }

    setSections((prev) =>
      prev.map((sec, idx) =>
        idx === secIdx
          ? { ...sec, toolChangedBy: { signature: currentUsername } }
          : sec
      )
    );
    triggerToast("Tool change signed successfully.", "success");
  };

  // QC Approves Verified By QC
  const handleApproveQc = (secIdx) => {
    if (!isQC) {
      triggerToast("Only QC can verify this record.", "error");
      return;
    }

    const sec = sections[secIdx];
    if (sec.assignedQc && sec.assignedQc.toLowerCase() !== currentUsername.toLowerCase()) {
      triggerToast(`Assigned to QC: ${sec.assignedQc.toUpperCase()}`, "error");
      return;
    }

    setSections((prev) =>
      prev.map((s, idx) =>
        idx === secIdx
          ? { ...s, verifiedByQc: { signature: currentUsername } }
          : s
      )
    );
    triggerToast("QC Verification Approved!", "success");
  };

  const handleAddRow = () => {
    if (isQC) return;
    setSections((prev) =>
      prev.map((sec) => ({
        ...sec,
        rows: [
          ...sec.rows,
          {
            nominalValue: "",
            operatorSymbol: "±",
            toleranceValue: "",
            controlSpec: "",
            before: "",
            after: "",
          },
        ],
      }))
    );
  };

  const handleRemoveRow = () => {
    if (isQC) return;
    setSections((prev) => {
      if (prev[0]?.rows?.length <= 1) return prev;
      return prev.map((sec) => ({
        ...sec,
        rows: sec.rows.slice(0, -1),
      }));
    });
  };

  const handleSave = async () => {
    if (!headerInfo.lineCode) {
      triggerToast("Please select Line Code.", "error");
      return;
    }

    // Validation for Shift Incharge
    if (isShiftIncharge) {
      const unapprovedToolChange = sections.some((sec) => !sec.toolChangedBy?.signature);
      if (unapprovedToolChange) {
        triggerToast("Please click 'Approve' under TOOL CHANGED BY before submitting.", "error");
        return;
      }

      const unassignedQc = sections.some((sec) => !sec.assignedQc);
      if (unassignedQc) {
        triggerToast("Please select a QC in 'VERIFIED BY QC' for all columns.", "error");
        return;
      }
    }

    // Validation for QC
    if (isQC) {
      const missingQcApproval = sections.some((sec) => !sec.verifiedByQc?.signature);
      if (missingQcApproval) {
        triggerToast("Please click 'Approve QC' before completing verification.", "error");
        return;
      }
    }

    setIsSaving(true);
    setSaveSuccess(false);

    const processedSections = sections.map((sec) => ({
      ...sec,
      rows: sec.rows.map((row) => ({
        ...row,
        controlSpec:
          row.controlSpec ||
          (row.nominalValue && row.toleranceValue
            ? `${row.nominalValue} ${row.operatorSymbol || "±"} ${row.toleranceValue}`
            : row.nominalValue || ""),
      })),
    }));

    const payload = {
      header: {
        machineShop: parseInt(shopId || lineSet?.machineShop || 3, 10),
        lineCode: headerInfo.lineCode,
        partName: headerInfo.partName,
        partNo: headerInfo.partNo,
        machineNo: headerInfo.machineNo,
        opNo: headerInfo.opNo,
        date: headerInfo.date,
      },
      sections: processedSections,
    };

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/tool-change-record`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Save failed");
      }

      setLineSet({
        machineShop: shopId || "3",
        lineCode: headerInfo.lineCode,
        partName: headerInfo.partName,
        partNo: headerInfo.partNo,
        machineNo: headerInfo.machineNo,
      });

      setIsSaving(false);
      setSaveSuccess(true);

      await new Promise((resolve) => setTimeout(resolve, 2000));
      navigate(
        isQC
          ? `/qc/${shopId || 3}`
          : `/shift-incharge/${shopId || 3}/daily-production-report`
      );
    } catch (err) {
      console.error("Save error:", err);
      setIsSaving(false);
      triggerToast(err.message || "Failed to save tool change record.", "error");
    }
  };

  const getSectionChunks = (allSections) => {
    const chunks = [];
    for (let i = 0; i < allSections.length; i += CHUNK_SIZE) {
      const chunk = allSections.slice(i, i + CHUNK_SIZE).map((sec, localIdx) => ({
        sec,
        globalIdx: i + localIdx,
      }));
      chunks.push(chunk);
    }
    return chunks;
  };

  const sectionChunks = getSectionChunks(sections);

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
                  {isShiftIncharge ? "Submitting for QC Verification" : "Completing QC Verification"}
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

      <div className="bg-white w-full max-w-[95rem] rounded-xl p-8 shadow-2xl overflow-x-auto border-4 border-gray-100 space-y-6">
        {/* Top Navigation */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-200 pb-4 gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <button
                type="button"
                onClick={() => navigate(isQC ? `/qc/${shopId || 3}` : `/shift-incharge/${shopId || 3}`)}
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
            </div>
          </div>
        </div>

        {/* Header Form Selector Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
          <div>
            <label className="font-bold text-gray-700 block mb-1 text-xs uppercase">
              Line Code
            </label>
            <select
              className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm font-semibold bg-white disabled:bg-gray-100"
              value={headerInfo.lineCode}
              onChange={(e) => handleLineChange(e.target.value)}
              disabled={loadingMachineDetails || isQC}
            >
              <option value="">{loadingMachineDetails ? "Loading..." : "Select Line Code"}</option>
              {lineCodes.map((lineCode) => (
                <option key={lineCode} value={lineCode}>{lineCode}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-bold text-gray-700 block mb-1 text-xs uppercase">
              Part No
            </label>
            <input
              type="text"
              readOnly
              className="w-full border border-gray-300 p-2 rounded text-sm font-semibold bg-gray-100"
              value={headerInfo.partNo}
              placeholder="Auto-filled"
            />
          </div>

          <div>
            <label className="font-bold text-gray-700 block mb-1 text-xs uppercase">
              Part Name
            </label>
            <input
              type="text"
              readOnly
              className="w-full border border-gray-300 p-2 rounded text-sm font-semibold bg-gray-100"
              value={headerInfo.partName}
              placeholder="Auto-filled"
            />
          </div>

          <div>
            <label className="font-bold text-gray-700 block mb-1 text-xs uppercase">
              Date
            </label>
            <input
              type="date"
              className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm font-semibold bg-white disabled:bg-gray-100"
              value={headerInfo.date}
              onChange={(e) => handleDateChange(e.target.value)}
              disabled={isQC}
            />
          </div>
        </div>

        {/* Action Controls for Columns and Rows (Hidden/Disabled for QC) */}
        {!isQC && (
          <div className="flex flex-wrap justify-between items-center px-1 gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                Tool Change Columns
              </span>
              <span className="text-[11px] bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full font-semibold">
                {sections.length} {sections.length === 1 ? "Column" : "Columns"}
              </span>
              <button
                type="button"
                onClick={handleAddColumn}
                className="inline-flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-3 py-1.5 rounded transition-colors shadow"
              >
                + Add Column
              </button>
              {sections.length > 1 && (
                <button
                  type="button"
                  onClick={handleRemoveColumn}
                  className="inline-flex items-center gap-1 bg-gray-600 hover:bg-gray-700 text-white text-xs font-bold px-3 py-1.5 rounded transition-colors shadow"
                >
                  − Delete Column
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                Rows
              </span>
              <button
                type="button"
                onClick={handleAddRow}
                className="inline-flex items-center gap-1 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-3 py-1.5 rounded transition-colors shadow"
              >
                + Add Row
              </button>
              {(sections[0]?.rows?.length || 1) > 1 && (
                <button
                  type="button"
                  onClick={handleRemoveRow}
                  className="inline-flex items-center gap-1 bg-gray-600 hover:bg-gray-700 text-white text-xs font-bold px-3 py-1.5 rounded transition-colors shadow"
                >
                  − Delete Row
                </button>
              )}
            </div>
          </div>
        )}

        {/* Tool Change Form Block */}
        <div className="space-y-8">
          {sectionChunks.map((chunk, chunkIdx) => (
            <div key={`chunk-${chunkIdx}`} className="space-y-2">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border-2 border-gray-800 text-xs text-center table-fixed bg-white">
                  <tbody>
                    {/* PART TRACEABILITY */}
                    <tr>
                      {chunk.map(({ sec, globalIdx }) => (
                        <td
                          key={`hdr-traceability-${globalIdx}`}
                          colSpan={3}
                          className="border border-gray-800 p-1.5 text-left font-normal bg-white"
                        >
                          <div className="flex items-center gap-1">
                            <span className="font-bold text-gray-800 whitespace-nowrap">
                              PART TRACEABILITY :
                            </span>
                            <input
                              type="text"
                              disabled={isQC}
                              className="w-full outline-none font-medium px-1 bg-transparent border-b border-transparent focus:border-orange-400 disabled:text-gray-700"
                              value={sec.partTraceability}
                              placeholder={isQC ? "-" : "Enter / Generate Traceability"}
                              onChange={(e) =>
                                handleSectionMetaChange(
                                  globalIdx,
                                  "partTraceability",
                                  e.target.value
                                )
                              }
                            />
                          </div>
                        </td>
                      ))}
                    </tr>

                    {/* TOOL DESCRIPTION */}
                    <tr>
                      {chunk.map(({ sec, globalIdx }) => (
                        <td
                          key={`hdr-desc-${globalIdx}`}
                          colSpan={3}
                          className="border border-gray-800 p-1.5 text-left font-normal bg-white"
                        >
                          <div className="flex items-center gap-1">
                            <span className="font-bold text-gray-800 whitespace-nowrap">
                              TOOL DESCRIPTION :
                            </span>
                            <input
                              type="text"
                              disabled={isQC}
                              className="w-full outline-none font-medium px-1 bg-transparent border-b border-transparent focus:border-orange-400 disabled:text-gray-700"
                              value={sec.toolDescription}
                              placeholder={isQC ? "-" : "Enter Tool Description"}
                              onChange={(e) =>
                                handleSectionMetaChange(
                                  globalIdx,
                                  "toolDescription",
                                  e.target.value
                                )
                              }
                            />
                          </div>
                        </td>
                      ))}
                    </tr>

                    {/* M/C NO & OP NO */}
                    <tr>
                      {chunk.map(({ sec, globalIdx }) => (
                        <td
                          key={`hdr-mcop-${globalIdx}`}
                          colSpan={3}
                          className="border border-gray-800 p-1 font-normal bg-white"
                        >
                          <div className="grid grid-cols-2 divide-x divide-gray-800">
                            <div className="flex items-center px-1 gap-1">
                              <span className="font-bold text-gray-800 whitespace-nowrap">
                                M/C NO :
                              </span>
                              <select
                                className="w-full outline-none font-medium text-center bg-transparent cursor-pointer disabled:text-gray-700"
                                value={sec.mcNo}
                                onChange={(e) =>
                                  handleSectionMetaChange(globalIdx, "mcNo", e.target.value)
                                }
                                disabled={!headerInfo.lineCode || isQC}
                              >
                                <option value="">Select M/C</option>
                                {machineOptions.map((m, index) => (
                                  <option key={m.id || index} value={m.machineNo}>
                                    {m.machineNo}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="flex items-center px-1 gap-1">
                              <span className="font-bold text-gray-800 whitespace-nowrap">
                                OP NO :
                              </span>
                              <select
                                className="w-full outline-none font-medium text-center bg-transparent cursor-pointer disabled:text-gray-700"
                                value={sec.opNo || headerInfo.opNo}
                                disabled={isQC}
                                onChange={(e) =>
                                  handleSectionMetaChange(globalIdx, "opNo", e.target.value)
                                }
                              >
                                <option value="">Select OP</option>
                                <option value="20">20</option>
                                <option value="30">30</option>
                                <option value="40">40</option>
                                <option value="50">50</option>
                                <option value="60">60</option>
                                <option value="70">70</option>
                              </select>
                            </div>
                          </div>
                        </td>
                      ))}
                    </tr>

                    {/* DATE & SHIFT */}
                    <tr>
                      {chunk.map(({ sec, globalIdx }) => (
                        <td
                          key={`hdr-dateshift-${globalIdx}`}
                          colSpan={3}
                          className="border border-gray-800 p-1 font-normal bg-white"
                        >
                          <div className="grid grid-cols-2 divide-x divide-gray-800">
                            <div className="flex items-center px-1 gap-1">
                              <span className="font-bold text-gray-800 whitespace-nowrap">
                                DATE :
                              </span>
                              <input
                                type="date"
                                disabled={isQC}
                                className="w-full outline-none font-medium text-center bg-transparent disabled:text-gray-700"
                                value={sec.date}
                                onChange={(e) =>
                                  handleSectionMetaChange(globalIdx, "date", e.target.value)
                                }
                              />
                            </div>
                            <div className="flex items-center px-1 gap-1">
                              <span className="font-bold text-gray-800 whitespace-nowrap">
                                SHIFT :
                              </span>
                              <select
                                className="w-full outline-none font-medium text-center bg-transparent cursor-pointer disabled:text-gray-700"
                                value={sec.shift}
                                disabled={isQC}
                                onChange={(e) =>
                                  handleSectionMetaChange(globalIdx, "shift", e.target.value)
                                }
                              >
                                <option value="I">I</option>
                                <option value="II">II</option>
                                <option value="III">III</option>
                              </select>
                            </div>
                          </div>
                        </td>
                      ))}
                    </tr>

                    {/* FROM & TO TIME */}
                    <tr>
                      {chunk.map(({ sec, globalIdx }) => (
                        <td
                          key={`hdr-fromto-${globalIdx}`}
                          colSpan={3}
                          className="border border-gray-800 p-1 font-normal bg-white"
                        >
                          <div className="grid grid-cols-2 divide-x divide-gray-800">
                            <div className="flex items-center px-1 gap-1">
                              <span className="font-bold text-gray-800 whitespace-nowrap">
                                FROM :
                              </span>
                              <input
                                type="time"
                                disabled={isQC}
                                className="w-full outline-none font-medium text-center bg-transparent disabled:text-gray-700"
                                value={sec.from}
                                onChange={(e) =>
                                  handleSectionMetaChange(globalIdx, "from", e.target.value)
                                }
                              />
                            </div>
                            <div className="flex items-center px-1 gap-1">
                              <span className="font-bold text-gray-800 whitespace-nowrap">
                                TO :
                              </span>
                              <input
                                type="time"
                                disabled={isQC}
                                className="w-full outline-none font-medium text-center bg-transparent disabled:text-gray-700"
                                value={sec.to}
                                onChange={(e) =>
                                  handleSectionMetaChange(globalIdx, "to", e.target.value)
                                }
                              />
                            </div>
                          </div>
                        </td>
                      ))}
                    </tr>

                    {/* COLUMN HEADERS */}
                    <tr className="bg-gray-100 text-gray-800 font-bold">
                      {chunk.map(({ globalIdx }) => (
                        <React.Fragment key={`subcols-${globalIdx}`}>
                          <th className="border border-gray-800 p-1.5 w-[14%]">
                            CONTROL SPEC
                          </th>
                          <th className="border border-gray-800 p-1.5 w-[5.5%]">
                            BEFORE
                          </th>
                          <th className="border border-gray-800 p-1.5 w-[5.5%]">
                            AFTER
                          </th>
                        </React.Fragment>
                      ))}
                    </tr>

                    {/* DATA ROWS */}
                    {sections[0]?.rows.map((_, rIdx) => (
                      <tr key={`data-row-${chunkIdx}-${rIdx}`} className="h-8">
                        {chunk.map(({ sec, globalIdx }) => {
                          const rowData = sec.rows[rIdx] || {};
                          return (
                            <React.Fragment key={`cell-${globalIdx}-${rIdx}`}>
                              <td className="border border-gray-800 p-0.5">
                                <div className="flex items-center justify-center gap-1 w-full h-full px-1">
                                  <input
                                    type="number"
                                    step="any"
                                    disabled={isQC}
                                    className="w-[45%] h-full text-center outline-none bg-transparent py-1 font-medium border-b border-gray-300 focus:border-orange-500 disabled:border-transparent disabled:text-gray-800"
                                    placeholder="100.5"
                                    value={rowData.nominalValue ?? ""}
                                    onChange={(e) =>
                                      handleCellChange(
                                        globalIdx,
                                        rIdx,
                                        "nominalValue",
                                        e.target.value
                                      )
                                    }
                                  />
                                  <select
                                    disabled={isQC}
                                    className="w-[25%] h-full text-center outline-none bg-gray-50 border border-gray-300 rounded cursor-pointer font-bold text-xs py-0.5 disabled:border-transparent disabled:bg-transparent disabled:text-gray-800"
                                    value={rowData.operatorSymbol || "±"}
                                    onChange={(e) =>
                                      handleCellChange(
                                        globalIdx,
                                        rIdx,
                                        "operatorSymbol",
                                        e.target.value
                                      )
                                    }
                                  >
                                    <option value="±">±</option>
                                    <option value="+">+</option>
                                    <option value="-">-</option>
                                  </select>
                                  <input
                                    type="number"
                                    step="any"
                                    disabled={isQC}
                                    className="w-[30%] h-full text-center outline-none bg-transparent py-1 font-medium border-b border-gray-300 focus:border-orange-500 disabled:border-transparent disabled:text-gray-800"
                                    placeholder="5.3"
                                    value={rowData.toleranceValue ?? ""}
                                    onChange={(e) =>
                                      handleCellChange(
                                        globalIdx,
                                        rIdx,
                                        "toleranceValue",
                                        e.target.value
                                      )
                                    }
                                  />
                                </div>
                              </td>
                              <td className="border border-gray-800 p-0">
                                <input
                                  type="text"
                                  disabled={isQC}
                                  className="w-full h-full text-center outline-none bg-transparent py-1 px-1 font-medium disabled:text-gray-800"
                                  placeholder="Before"
                                  value={rowData.before}
                                  onChange={(e) =>
                                    handleCellChange(
                                      globalIdx,
                                      rIdx,
                                      "before",
                                      e.target.value
                                    )
                                  }
                                />
                              </td>
                              <td className="border border-gray-800 p-0">
                                <input
                                  type="text"
                                  disabled={isQC}
                                  className="w-full h-full text-center outline-none bg-transparent py-1 px-1 font-medium disabled:text-gray-800"
                                  placeholder="After"
                                  value={rowData.after}
                                  onChange={(e) =>
                                    handleCellChange(
                                      globalIdx,
                                      rIdx,
                                      "after",
                                      e.target.value
                                    )
                                  }
                                />
                              </td>
                            </React.Fragment>
                          );
                        })}
                      </tr>
                    ))}

                    {/* TOOL CHANGED BY (SHIFT INCHARGE APPROVAL) */}
                    <tr>
                      {chunk.map(({ sec, globalIdx }) => (
                        <React.Fragment key={`tc-sig-${globalIdx}`}>
                          <td className="border border-gray-800 p-2 font-bold text-gray-800 bg-gray-50 align-middle w-[14%]">
                            TOOL CHANGED BY
                          </td>
                          <td
                            colSpan={2}
                            className="border border-gray-800 p-2 text-center align-middle bg-gray-50/40 w-[11%]"
                          >
                            {sec.toolChangedBy?.signature ? (
                              <div className="flex flex-col items-center justify-center animate-in fade-in duration-200">
                                <span className="text-[10px] font-bold text-green-600 uppercase">
                                  Approved By ✓
                                </span>
                                <span className="text-xs font-black text-gray-900 uppercase">
                                  {sec.toolChangedBy.signature}
                                </span>
                              </div>
                            ) : isShiftIncharge ? (
                              <button
                                type="button"
                                onClick={() => handleApproveToolChangedBy(globalIdx)}
                                className="bg-orange-500 hover:bg-orange-600 text-white text-[11px] font-bold px-4 py-1.5 rounded shadow hover:scale-105 transition-all uppercase tracking-wider"
                              >
                                Approve
                              </button>
                            ) : (
                              <span className="text-gray-400 text-xs italic">
                                Pending Shift Incharge
                              </span>
                            )}
                          </td>
                        </React.Fragment>
                      ))}
                    </tr>

                    {/* VERIFIED BY QC (DROPDOWN + APPROVAL WORKFLOW) */}
                    <tr>
                      {chunk.map(({ sec, globalIdx }) => (
                        <React.Fragment key={`qc-sig-${globalIdx}`}>
                          <td className="border border-gray-800 p-2 font-bold text-gray-800 bg-gray-50 align-middle w-[14%]">
                            VERIFIED BY QC
                          </td>
                          <td
                            colSpan={2}
                            className="border border-gray-800 p-2 text-center align-middle bg-gray-50/40 w-[11%]"
                          >
                            {/* CASE 1: QC has already approved */}
                            {sec.verifiedByQc?.signature ? (
                              <div className="flex flex-col items-center justify-center animate-in fade-in duration-200">
                                <span className="text-[10px] font-bold text-green-600 uppercase">
                                  Approved By ✓
                                </span>
                                <span className="text-xs font-black text-gray-900 uppercase">
                                  {sec.verifiedByQc.signature}
                                </span>
                              </div>
                            ) : isQC ? (
                              /* CASE 2: QC is logged in and needs to approve */
                              <div className="flex flex-col items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleApproveQc(globalIdx)}
                                  className="bg-green-600 hover:bg-green-700 text-white text-[11px] font-bold px-4 py-1.5 rounded shadow hover:scale-105 transition-all uppercase tracking-wider"
                                >
                                  Approve QC
                                </button>
                                {sec.assignedQc && (
                                  <span className="text-[10px] text-gray-500 font-semibold uppercase">
                                    (Assigned: {sec.assignedQc})
                                  </span>
                                )}
                              </div>
                            ) : isShiftIncharge && !sec.toolChangedBy?.signature ? (
                              /* CASE 3: Shift Incharge is selecting the QC before signing */
                              <div className="flex flex-col items-center gap-1 w-full">
                                <select
                                  className="w-full bg-white border border-gray-300 p-1.5 rounded font-bold text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-orange-500 text-center"
                                  value={sec.assignedQc || ""}
                                  onChange={(e) =>
                                    handleSectionMetaChange(globalIdx, "assignedQc", e.target.value)
                                  }
                                >
                                  <option value="">-- Select QC --</option>
                                  {qcUsers.map((qc, qIdx) => {
                                    const uname = qc.username || qc.employeeId;
                                    return (
                                      <option key={`${uname}-${qIdx}`} value={uname}>
                                        {uname.toUpperCase()} {qc.name ? `(${qc.name})` : ""}
                                      </option>
                                    );
                                  })}
                                </select>
                              </div>
                            ) : (
                              /* CASE 4: Form submitted by Shift Incharge, awaiting QC approval */
                              <div className="flex flex-col items-center justify-center">
                                <span className="text-orange-600 text-xs font-bold uppercase animate-pulse">
                                  Pending Approval
                                </span>
                                {sec.assignedQc && (
                                  <span className="text-[11px] font-extrabold text-gray-800 uppercase mt-0.5">
                                    [{sec.assignedQc}]
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                        </React.Fragment>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>

        {/* Applicable Events Box */}
        <div className="border-2 border-gray-800 p-3 bg-white">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="font-bold text-gray-800 whitespace-nowrap text-xs">
              Applicable Events:
            </span>
            <span className="text-xs text-gray-700">
              {formMeta.applicableEvents}
            </span>
          </div>
        </div>

        {/* Save / Submit Action Button */}
        <div className="flex justify-end gap-4 pt-4 border-t border-gray-300">
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
              : "Submit for QC Verification"}
          </button>
        </div>
      </div>
    </div>
  );
}