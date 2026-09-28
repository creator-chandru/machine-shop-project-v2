import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useLineSet } from "../context/LineSetContext.jsx";
import Header from '../components/Header';

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

const createEmptyRow = () => ({
  machineNo: "",
  machineName: "",
  partNameNo: "",
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

// Toast notification component
const Toast = ({ message, type, onClose }) => {
  if (!message) return null;

  const bgColor = type === 'error' ? 'bg-red-600' : type === 'success' ? 'bg-green-600' : 'bg-orange-600';

  return (
    <div className={`fixed bottom-6 right-6 z-50 ${bgColor} text-white px-5 py-3 rounded-lg shadow-2xl flex items-center gap-3 transition-all transform animate-bounce`}>
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
  const { lineSet, setLineSet } = useLineSet();

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [machineDetails, setMachineDetails] = useState([]);
  const [loadingMachineDetails, setLoadingMachineDetails] = useState(true);

  // Toast state
  const [toast, setToast] = useState({ message: '', type: '' });

  const triggerToast = (message, type = 'error') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast({ message: '', type: '' });
    }, 4000);
  };

  // 1. Header Information (date defaults to today's date)
  const [header, setHeader] = useState({
    date: getTodayISODate(),
    shift: "I",
    shiftInchargeName: "",
    lineCode: "",
    partTraceabilityMachining: "",
  });

  // 2. Production Rows (Dynamic)
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

  // Fetch Part Traceability from backend
  const fetchPartTraceability = async (lineCode, date, shift) => {
    if (!lineCode || !date || !shift) {
      return;
    }

    try {
      const token = localStorage.getItem("token");

      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/daily-production-report/traceability?lineCode=${encodeURIComponent(
          lineCode
        )}&date=${encodeURIComponent(date)}&shift=${encodeURIComponent(shift)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch Part Traceability");
      }

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

  // Sync with LineSetContext whenever it changes
  useEffect(() => {
    if (lineSet) {
      const newLineCode = lineSet.lineCode || header.lineCode;
      setHeader((prev) => ({
        ...prev,
        lineCode: lineSet.lineCode || prev.lineCode,
      }));

      if (newLineCode) {
        fetchPartTraceability(
          newLineCode,
          header.date,
          header.shift
        );
      }
    }
  }, [lineSet]);

  // Fetch Master Data for the Specific Machine Shop
  useEffect(() => {
    const fetchMachineDetails = async () => {
      try {
        if (!shopId) return;
        const token = localStorage.getItem("token");
        const res = await fetch(`${process.env.REACT_APP_API_URL}/api/machine-shop/${shopId}/details`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!res.ok) throw new Error(`Failed to fetch Machine Shop ${shopId} details`);
        const data = await res.json();
        setMachineDetails(data);
      } catch (err) {
        console.error("Machine details fetch error:", err);
      } finally {
        setLoadingMachineDetails(false);
      }
    };
    fetchMachineDetails();
  }, [shopId]);

  // Derived Options based on selected Line Code
  const lineCodes = [...new Set(machineDetails.map((item) => item.lineCode).filter(Boolean))];
  const selectedLineDetails = machineDetails.filter((item) => item.lineCode === header.lineCode);

  const machineOptions = selectedLineDetails;
  const partOptions = [
    ...new Map(
      selectedLineDetails
        .filter((item) => item.partNo)
        .map((item) => [
          item.partNo,
          { partNo: item.partNo, partName: item.partName || "" },
        ])
    ).values(),
  ];

  // Handlers
  const handleHeaderChange = (field, val) => {
    setHeader((prev) => ({ ...prev, [field]: val }));

    // Reset rows and sync lineCode to context if line code changes
    if (field === "lineCode") {
      setRows([createEmptyRow()]);
      if (setLineSet) {
        setLineSet((prev) => ({
          ...prev,
          machineShop: shopId || "3",
          lineCode: val,
        }));
      }
    }

    // Trigger dynamic Part Traceability generation
    if (field === "lineCode" || field === "date" || field === "shift") {
      const targetLineCode = field === "lineCode" ? val : header.lineCode;
      const targetDate = field === "date" ? val : header.date;
      const targetShift = field === "shift" ? val : header.shift;

      if (targetLineCode && targetDate && targetShift) {
        fetchPartTraceability(targetLineCode, targetDate, targetShift);
      }
    }
  };

  const handleRowChange = (rowIdx, field, subField, val) => {
    setRows((prev) => {
      const next = [...prev];

      // Handle nested state for reasonForHold and time
      if (subField) {
        next[rowIdx] = {
          ...next[rowIdx],
          [field]: { ...next[rowIdx][field], [subField]: val },
        };
      } else {
        next[rowIdx] = { ...next[rowIdx], [field]: val };
      }

      // Auto-fill logic for Machine Name and Part Name based on dropdown selection
      if (field === "machineNo") {
        const selectedMachine = machineOptions.find((m) => m.machineNo === val);
        if (selectedMachine) {
          next[rowIdx].machineName = selectedMachine.machineType || "";
        }
      }

      if (field === "partNameNo") {
        const selectedPart = partOptions.find((p) => p.partNo === val);
        if (selectedPart) {
          next[rowIdx].partNameNo = `${selectedPart.partName} / ${selectedPart.partNo}`;
        }
      }

      return next;
    });
  };

  const handleSignatureChange = (field, val) => {
    setSignatures((prev) => ({ ...prev, [field]: val }));
  };

  const handleAddRow = () => setRows((prev) => [...prev, createEmptyRow()]);
  const handleRemoveRow = () => setRows((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));

  const handleSave = async () => {
    if (!header.lineCode) {
      triggerToast("Please select a Line Code in the header before saving.", "error");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      triggerToast("Authentication token missing or session expired. Please log in again.", "error");
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);

    const payload = {
      header: { ...header, machineShop: shopId },
      rows,
      signatures,
    };

    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/daily-production-report`, {
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

      // Update LineSetContext with the current lineCode and shopId
      if (setLineSet) {
        setLineSet((prev) => ({
          ...prev,
          machineShop: shopId || "3",
          lineCode: header.lineCode,
        }));
      }

      setIsSaving(false);
      setSaveSuccess(true);

      // Keep success message visible for 2 seconds
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Navigate to next form
      navigate(`/operator/${shopId || 3}/daily-production-idle-time-report`);
    } catch (err) {
      console.error("Save error:", err);
      setIsSaving(false);
      triggerToast(`Failed to save report. Error: ${err.message}`, "error");
    }
  };

  return (
    <div className="min-h-screen bg-[#2d2d2d] flex flex-col items-center justify-center p-6 pb-20">
      <Header />

      {/* Toast Notification */}
      <Toast 
        message={toast.message} 
        type={toast.type} 
        onClose={() => setToast({ message: '', type: '' })} 
      />

      {/* Saving and Success Modals */}
      {(isSaving || saveSuccess) && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
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
                <p className="text-gray-500 mt-2">Loading next form...</p>
              </>
            )}
          </div>
        </div>
      )}

      <div className="bg-white w-full max-w-[98rem] rounded-xl p-8 shadow-2xl overflow-x-auto border-4 border-gray-100 space-y-6">
        {/* Card Header */}
        <div className="border-b border-gray-200 pb-4">
          <span className="text-xs font-bold text-orange-600 tracking-wider uppercase block mb-1">
            {formMeta.company}
          </span>
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

        {/* SUB-HEADER: LINE NO, PART TRACEABILITY, DATE, SHIFT, SHIFT INCHARGE */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 bg-orange-50 border border-orange-200 p-4 rounded-lg">
          <div>
            <label className="font-bold text-gray-700 block mb-1 text-sm">Line Code</label>
            <select
              className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm font-semibold bg-white cursor-pointer"
              value={header.lineCode}
              onChange={(e) => handleHeaderChange("lineCode", e.target.value)}
              disabled={loadingMachineDetails}
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
              className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm font-semibold bg-white"
              value={header.partTraceabilityMachining}
              onChange={(e) => handleHeaderChange("partTraceabilityMachining", e.target.value)}
              placeholder="Auto-generated / Enter Traceability"
            />
          </div>

          <div>
            <label className="font-bold text-gray-700 block mb-1 text-sm">Date</label>
            <input
              type="date"
              className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm font-semibold bg-white cursor-pointer"
              value={header.date}
              onChange={(e) => handleHeaderChange("date", e.target.value)}
            />
          </div>

          <div>
            <label className="font-bold text-gray-700 block mb-1 text-sm">Shift</label>
            <select
              className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm font-semibold bg-white cursor-pointer"
              value={header.shift}
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
              className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm font-semibold bg-white"
              value={header.shiftInchargeName}
              onChange={(e) => handleHeaderChange("shiftInchargeName", e.target.value)}
              placeholder="Enter name"
            />
          </div>
        </div>

        {/* MAIN PRODUCTION TABLE */}
        <div className="pt-2">
          <div className="flex justify-between items-center mb-2 px-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Production Log Entries</span>
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
                        className="w-full h-full text-center outline-none bg-transparent py-1 px-0.5 font-medium cursor-pointer text-[11px]"
                        value={row.machineNo}
                        onChange={(e) => handleRowChange(rIdx, "machineNo", null, e.target.value)}
                        disabled={!header.lineCode}
                      >
                        <option value="">Select</option>
                        {machineOptions.map((m) => (
                          <option key={`${m.id}-${m.machineNo}`} value={m.machineNo}>
                            {m.machineNo}
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
                    <td className="border border-gray-800 p-0">
                      <select
                        className="w-full h-full text-center outline-none bg-transparent py-1 px-1 font-medium cursor-pointer text-[11px]"
                        value={row.partNameNo ? row.partNameNo.split(" / ")[1] : ""}
                        onChange={(e) => handleRowChange(rIdx, "partNameNo", null, e.target.value)}
                        disabled={!header.lineCode}
                      >
                        <option value="">Select Part</option>
                        {partOptions.map((p) => (
                          <option key={p.partNo} value={p.partNo}>
                            {p.partName} / {p.partNo}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="border border-gray-800 p-0">
                      <input
                        type="text"
                        className="w-full h-full text-center outline-none bg-transparent py-1 px-1 font-medium"
                        value={row.operationDescription}
                        onChange={(e) => handleRowChange(rIdx, "operationDescription", null, e.target.value)}
                      />
                    </td>
                    <td className="border border-gray-800 p-0">
                      <input
                        type="text"
                        className="w-full h-full text-center outline-none bg-transparent py-1 px-1 font-medium"
                        value={row.operatorName}
                        onChange={(e) => handleRowChange(rIdx, "operatorName", null, e.target.value)}
                      />
                    </td>
                    <td className="border border-gray-800 p-0">
                      <input
                        type="number"
                        className="w-full h-full text-center outline-none bg-transparent py-1 px-0.5 font-medium"
                        value={row.produced}
                        onChange={(e) => handleRowChange(rIdx, "produced", null, e.target.value)}
                      />
                    </td>
                    <td className="border border-gray-800 p-0">
                      <input
                        type="number"
                        className="w-full h-full text-center outline-none bg-transparent py-1 px-0.5 font-medium"
                        value={row.accepted}
                        onChange={(e) => handleRowChange(rIdx, "accepted", null, e.target.value)}
                      />
                    </td>
                    <td className="border border-gray-800 p-0">
                      <input
                        type="text"
                        className="w-full h-full text-center outline-none bg-transparent py-1 px-0.5 font-medium"
                        value={row.holdNonConformance}
                        onChange={(e) => handleRowChange(rIdx, "holdNonConformance", null, e.target.value)}
                      />
                    </td>
                    <td className="border border-gray-800 p-0">
                      <input
                        type="text"
                        className="w-full h-full text-center outline-none bg-transparent py-1 px-1 font-medium"
                        value={row.reasonForHold.casting}
                        onChange={(e) => handleRowChange(rIdx, "reasonForHold", "casting", e.target.value)}
                      />
                    </td>
                    <td className="border border-gray-800 p-0">
                      <input
                        type="number"
                        className="w-full h-full text-center outline-none bg-transparent py-1 px-0.5 font-medium"
                        value={row.reasonForHold.castingQty}
                        onChange={(e) => handleRowChange(rIdx, "reasonForHold", "castingQty", e.target.value)}
                      />
                    </td>
                    <td className="border border-gray-800 p-0">
                      <input
                        type="text"
                        className="w-full h-full text-center outline-none bg-transparent py-1 px-1 font-medium"
                        value={row.reasonForHold.machining}
                        onChange={(e) => handleRowChange(rIdx, "reasonForHold", "machining", e.target.value)}
                      />
                    </td>
                    <td className="border border-gray-800 p-0">
                      <input
                        type="number"
                        className="w-full h-full text-center outline-none bg-transparent py-1 px-0.5 font-medium"
                        value={row.reasonForHold.machiningQty}
                        onChange={(e) => handleRowChange(rIdx, "reasonForHold", "machiningQty", e.target.value)}
                      />
                    </td>
                    <td className="border border-gray-800 p-0">
                      <input
                        type="text"
                        className="w-full h-full text-center outline-none bg-transparent py-1 px-1 font-medium"
                        placeholder="Reason / Details"
                        value={row.mcStopTimeReason}
                        onChange={(e) => handleRowChange(rIdx, "mcStopTimeReason", null, e.target.value)}
                      />
                    </td>
                    <td className="border border-gray-800 p-0">
                      <input
                        type="time"
                        className="w-full h-full text-center outline-none bg-transparent py-1 px-0.5 font-medium text-[11px]"
                        value={row.time.from}
                        onChange={(e) => handleRowChange(rIdx, "time", "from", e.target.value)}
                      />
                    </td>
                    <td className="border border-gray-800 p-0">
                      <input
                        type="time"
                        className="w-full h-full text-center outline-none bg-transparent py-1 px-0.5 font-medium text-[11px]"
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
              <tr className="h-14">
                <td className="border border-gray-800 p-0">
                  <input
                    type="text"
                    placeholder="Sign / Name"
                    className="w-full h-full text-center outline-none font-medium bg-transparent px-2"
                    value={signatures.shiftSupervisorProduction}
                    onChange={(e) => handleSignatureChange("shiftSupervisorProduction", e.target.value)}
                  />
                </td>
                <td className="border border-gray-800 p-0">
                  <input
                    type="text"
                    placeholder="Sign / Name"
                    className="w-full h-full text-center outline-none font-medium bg-transparent px-2"
                    value={signatures.shiftSupervisorQuality}
                    onChange={(e) => handleSignatureChange("shiftSupervisorQuality", e.target.value)}
                  />
                </td>
                <td className="border border-gray-800 p-0">
                  <input
                    type="text"
                    placeholder="Sign / Name"
                    className="w-full h-full text-center outline-none font-medium bg-transparent px-2"
                    value={signatures.productionEngineer}
                    onChange={(e) => handleSignatureChange("productionEngineer", e.target.value)}
                  />
                </td>
                <td className="border border-gray-800 p-0">
                  <input
                    type="text"
                    placeholder="Sign / Name"
                    className="w-full h-full text-center outline-none font-medium bg-transparent px-2"
                    value={signatures.hofProduction}
                    onChange={(e) => handleSignatureChange("hofProduction", e.target.value)}
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="flex justify-between items-end mt-6 pt-4 border-t border-gray-300">
          <div className="text-xs text-gray-600 font-semibold">
            {formMeta.formCode}, Rev.No: {formMeta.revision} dt {formMeta.revisionDate}
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || saveSuccess}
            className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white px-10 py-3 rounded font-bold transition-colors shadow-lg hover:cursor-pointer flex items-center gap-2"
          >
            Save & Continue
          </button>
        </div>
      </div>
    </div>
  );
}