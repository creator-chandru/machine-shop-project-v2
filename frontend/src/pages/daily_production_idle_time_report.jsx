import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";

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

const createEmptyLineColumn = (lineCode = "", lineName = "", partName = "") => ({
  lineCode,
  lineName,
  partName,
  capacity: { shift1: "", shift2: "", shift3: "" },
  actualProd: {
    lh: { shift1: "", shift2: "", shift3: "" },
    rh: { shift1: "", shift2: "", shift3: "" },
  },
  manpower: { shift1: "", shift2: "", shift3: "" },
  losses: LOSS_REASONS.reduce((acc, loss) => {
    acc[`loss_${loss.id}`] = { shift1: "", shift2: "", shift3: "" };
    return acc;
  }, {}),
});

export default function DailyProductionIdleTimeReport() {
  const { shopId } = useParams();

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  const [machineDetails, setMachineDetails] = useState([]);
  const [partQuantities, setPartQuantities] = useState([]); // <-- NEW STATE FOR QUANTITIES
  const [loadingMachineDetails, setLoadingMachineDetails] = useState(true);

  const [reportDate, setReportDate] = useState("");
  const [pageInfo, setPageInfo] = useState({ current: "01", total: "02" });

  const [lineColumns, setLineColumns] = useState([createEmptyLineColumn()]);

  const [signatures, setSignatures] = useState({
    sectionInchargeSign: { shift1: "", shift2: "", shift3: "" },
    sectionInchargeName: { shift1: "", shift2: "", shift3: "" },
    shiftOfficerSign: { shift1: "", shift2: "", shift3: "" },
    teamLeaderSign: "",
    teamLeaderName: "",
  });

// Fetch Master Data dynamically based on URL parameter
  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!shopId) return;
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };

        // 1. Fetch Line & Part Details
        const resDetails = await fetch(`http://localhost:5000/api/machine-shop/${shopId}/details`, { headers });
        if (!resDetails.ok) throw new Error(`Failed to fetch Machine Shop details`);
        setMachineDetails(await resDetails.json());

        // 2. Fetch Part Quantities for Auto-Fill
        const resQty = await fetch(`http://localhost:5000/api/machine-shop/${shopId}/part-quantities`, { headers });
        if (!resQty.ok) throw new Error(`Failed to fetch Part Quantities`);
        setPartQuantities(await resQty.json());

      } catch (err) {
        console.error('Master data fetch error:', err);
      } finally {
        setLoadingMachineDetails(false);
      }
    };
    fetchData();
  }, [shopId]);

// Derived options for dropdowns
  const uniqueLineCodes = [...new Set(machineDetails.map(item => item.lineCode).filter(Boolean))];

  const getPartsForLine = (lineCode) => {
    const parts = machineDetails.filter(item => item.lineCode === lineCode && item.partName);
    return [...new Map(parts.map(item => [item.partName, item])).values()];
  };

  const handleLineMetaChange = (colIdx, field, val) => {
    setLineColumns((prev) => {
      const next = [...prev];
      next[colIdx] = { ...next[colIdx], [field]: val };
      
      // Auto-reset dependent fields when line code changes
      if (field === "lineCode") {
        next[colIdx].partName = "";
        next[colIdx].capacity = { shift1: "", shift2: "", shift3: "" }; // Reset capacity
      }

      // Auto-fill capacity when part name is selected
      if (field === "partName") {
        const selectedPart = partQuantities.find(p => p.partName === val);
        if (selectedPart) {
          next[colIdx].capacity = {
            shift1: selectedPart.shift1Quantity ?? 0,
            shift2: selectedPart.shift2Quantity ?? 0,
            shift3: selectedPart.shift3Quantity ?? 0
          };
        } else {
          // Reset if part is deselected or not found
          next[colIdx].capacity = { shift1: "", shift2: "", shift3: "" };
        }
      }
      
      return next;
    });
  };

  const handleCapacityChange = (colIdx, shift, val) => {
    setLineColumns((prev) => {
      const next = [...prev];
      next[colIdx] = {
        ...next[colIdx],
        capacity: { ...next[colIdx].capacity, [shift]: val },
      };
      return next;
    });
  };

  const handleActualProdChange = (colIdx, arm, shift, val) => {
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

  const handleSignatureChange = (field, subField, val) => {
    setSignatures((prev) => {
      if (subField) {
        return {
          ...prev,
          [field]: { ...prev[field], [subField]: val },
        };
      }
      return { ...prev, [field]: val };
    });
  };

  const handleAddColumn = () => setLineColumns((prev) => [...prev, createEmptyLineColumn()]);
  const handleRemoveColumn = () => setLineColumns((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));

  const sumValues = (...vals) => vals.reduce((sum, v) => sum + (parseFloat(v) || 0), 0) || "";

  const calcTotalLoss = (col, shift) => {
    return (
      LOSS_REASONS.reduce((acc, loss) => {
        const val = parseFloat(col.losses[`loss_${loss.id}`]?.[shift]) || 0;
        return acc + val;
      }, 0) || ""
    );
  };

  const handleSave = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      alert("Authentication token missing. Please log in again.");
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);

    const payload = {
      machineShop: shopId,
      date: reportDate,
      pageInfo,
      lineColumns,
      signatures,
    };

    try {
      const res = await fetch("http://localhost:5000/api/daily-production-idle-time", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}` 
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Server returned ${res.status}: ${errorText}`);
      }

      setIsSaving(false);
      setSaveSuccess(true);
      
      // Wait to display success message, then hide it and clear form (no redirect)
      await new Promise(resolve => setTimeout(resolve, 2000));
      setSaveSuccess(false);
      
      setReportDate("");
      setLineColumns([createEmptyLineColumn()]);
      setSignatures({
        sectionInchargeSign: { shift1: "", shift2: "", shift3: "" },
        sectionInchargeName: { shift1: "", shift2: "", shift3: "" },
        shiftOfficerSign: { shift1: "", shift2: "", shift3: "" },
        teamLeaderSign: "",
        teamLeaderName: "",
      });

    } catch (err) {
      console.error("Save error:", err);
      setIsSaving(false);
      alert(`Failed to save report. Error: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#2d2d2d] flex flex-col items-center justify-center p-4 sm:p-6 pb-20">
      
      {/* Loading Overlay */}
      {(isSaving || saveSuccess) && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl px-10 py-8 text-center">
            {isSaving ? (
              <>
                <div className="w-10 h-10 border-4 border-gray-300 border-t-orange-500 rounded-full animate-spin mx-auto mb-5"></div>
                <h2 className="text-xl font-bold text-gray-800">Saving Data...</h2>
              </>
            ) : (
              <h2 className="text-xl font-bold text-green-800">Data Saved Successfully</h2>
            )}
          </div>
        </div>
      )}

      <div className="bg-white w-full max-w-[99rem] rounded-xl p-6 sm:p-8 shadow-2xl overflow-x-auto border-4 border-gray-100 space-y-6">

        {/* CARD HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b-2 border-gray-300 pb-5 gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-sm font-extrabold text-orange-600 tracking-widest uppercase bg-orange-50 px-2.5 py-0.5 rounded border border-orange-200">
                SAKTHI AUTO
              </span>
              <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                OUTPUT ONLY
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-gray-900 tracking-tight uppercase leading-tight">
              DAILY PRODUCTION & IDLE TIME REPORT
            </h1>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-gray-50 border-2 border-gray-800 p-2.5 rounded shadow-sm">
            <div className="flex items-center gap-2">
              <label className="text-xs font-black text-gray-800 uppercase tracking-wide">DATE :</label>
              <input
                type="date"
                className="bg-white border border-gray-300 rounded px-2 py-1 text-xs font-bold text-gray-800 outline-none focus:border-orange-500"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
              />
            </div>
            <div className="h-4 w-px bg-gray-300 hidden sm:block"></div>
            <div className="flex items-center gap-1.5 text-xs font-black text-gray-800">
              <span>PAGE</span>
              <input
                type="text"
                className="w-8 text-center bg-white border border-gray-300 rounded py-0.5 font-bold outline-none"
                value={pageInfo.current}
                onChange={(e) => setPageInfo((p) => ({ ...p, current: e.target.value }))}
              />
              <span>OF</span>
              <input
                type="text"
                className="w-8 text-center bg-white border border-gray-300 rounded py-0.5 font-bold outline-none"
                value={pageInfo.total}
                onChange={(e) => setPageInfo((p) => ({ ...p, total: e.target.value }))}
              />
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex justify-between items-center px-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Production Lines Configured</span>
            <span className="text-[11px] bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full font-bold">{lineColumns.length} Lines</span>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleAddColumn} className="inline-flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-4 py-1.5 rounded transition-colors shadow">
              <span className="text-sm font-bold leading-none">+</span> Add Line Column
            </button>
            {lineColumns.length > 1 && (
              <button type="button" onClick={handleRemoveColumn} className="inline-flex items-center gap-1 bg-gray-600 hover:bg-gray-700 text-white text-xs font-bold px-3 py-1.5 rounded transition-colors shadow">
                <span className="text-sm font-bold leading-none">−</span> Delete Column
              </button>
            )}
          </div>
        </div>

        {/* MAIN MATRIX REPORT TABLE */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border-2 border-gray-800 text-xs text-center table-fixed min-w-[1200px]">
            <thead>
              {/* LINE CODE */}
              <tr>
                <th colSpan={3} className="border border-gray-800 p-1.5 bg-gray-100 text-left font-bold w-64">LINE CODE</th>
                {lineColumns.map((col, cIdx) => (
                  <th key={`lc-${cIdx}`} colSpan={4} className="border border-gray-800 p-0 bg-white">
                    <select
                      className="w-full h-full text-center font-bold text-gray-800 outline-none bg-transparent py-1.5 cursor-pointer focus:bg-orange-50"
                      value={col.lineCode}
                      onChange={(e) => handleLineMetaChange(cIdx, "lineCode", e.target.value)}
                      disabled={loadingMachineDetails}
                    >
                      <option value="">{loadingMachineDetails ? "Loading..." : "Select Line Code"}</option>
                      {uniqueLineCodes.map(lc => <option key={lc} value={lc}>{lc}</option>)}
                    </select>
                  </th>
                ))}
              </tr>

              {/* LINE NAME */}
              <tr>
                <th colSpan={3} className="border border-gray-800 p-1.5 bg-gray-100 text-left font-bold">LINE NAME</th>
                {lineColumns.map((col, cIdx) => (
                  <th key={`ln-${cIdx}`} colSpan={4} className="border border-gray-800 p-0 bg-white">
                    <input
                      type="text"
                      placeholder="e.g. SK LINE-42"
                      className="w-full h-full text-center font-bold text-gray-800 outline-none bg-transparent py-1.5 focus:bg-orange-50"
                      value={col.lineName}
                      onChange={(e) => handleLineMetaChange(cIdx, "lineName", e.target.value)}
                    />
                  </th>
                ))}
              </tr>

              {/* PART NAME */}
              <tr>
                <th colSpan={3} className="border border-gray-800 p-1.5 bg-gray-100 text-left font-bold">PART NAME</th>
                {lineColumns.map((col, cIdx) => (
                  <th key={`pn-${cIdx}`} colSpan={4} className="border border-gray-800 p-0 bg-white">
                    <select
                      className="w-full h-full text-center font-bold text-gray-800 outline-none bg-transparent py-1.5 cursor-pointer focus:bg-orange-50"
                      value={col.partName}
                      onChange={(e) => handleLineMetaChange(cIdx, "partName", e.target.value)}
                      disabled={!col.lineCode}
                    >
                      <option value="">Select Part</option>
                      {getPartsForLine(col.lineCode).map(p => (
                        <option key={p.partName} value={p.partName}>{p.partName}</option>
                      ))}
                    </select>
                  </th>
                ))}
              </tr>

              {/* SHIFT HEADERS */}
              <tr className="bg-gray-100 font-bold text-[11px]">
                <th className="border border-gray-800 p-1 w-10">S.No.</th>
                <th colSpan={2} className="border border-gray-800 p-1 text-left px-2">SHIFT</th>
                {lineColumns.map((_, cIdx) => (
                  <React.Fragment key={`sh-hdr-${cIdx}`}>
                    <th className="border border-gray-800 p-1 w-14">I</th>
                    <th className="border border-gray-800 p-1 w-14">II</th>
                    <th className="border border-gray-800 p-1 w-14">III</th>
                    <th className="border border-gray-800 p-1 w-16 bg-gray-200">T</th>
                  </React.Fragment>
                ))}
              </tr>

              {/* CAPACITY QTY IN SETS */}
              <tr className="bg-white">
                <td colSpan={3} className="border border-gray-800 p-1 text-left font-bold bg-gray-50 px-2">CAPACITY QTY IN SETS</td>
                {lineColumns.map((col, cIdx) => (
                  <React.Fragment key={`cap-${cIdx}`}>
                    <td className="border border-gray-800 p-0"><input type="number" className="w-full h-full text-center font-semibold outline-none py-1" value={col.capacity.shift1} onChange={(e) => handleCapacityChange(cIdx, "shift1", e.target.value)} /></td>
                    <td className="border border-gray-800 p-0"><input type="number" className="w-full h-full text-center font-semibold outline-none py-1" value={col.capacity.shift2} onChange={(e) => handleCapacityChange(cIdx, "shift2", e.target.value)} /></td>
                    <td className="border border-gray-800 p-0"><input type="number" className="w-full h-full text-center font-semibold outline-none py-1" value={col.capacity.shift3} onChange={(e) => handleCapacityChange(cIdx, "shift3", e.target.value)} /></td>
                    <td className="border border-gray-800 p-1 font-bold bg-gray-100 text-gray-800">{sumValues(col.capacity.shift1, col.capacity.shift2, col.capacity.shift3)}</td>
                  </React.Fragment>
                ))}
              </tr>
            </thead>

            <tbody>
              {/* ACTUAL PROD QTY (LH) */}
              <tr>
                <td rowSpan={2} colSpan={2} className="border border-gray-800 p-1 font-bold text-left bg-gray-50 px-2 align-middle">ACTUAL PROD QTY</td>
                <td className="border border-gray-800 p-1 font-bold bg-gray-100 w-10">LH</td>
                {lineColumns.map((col, cIdx) => (
                  <React.Fragment key={`lh-${cIdx}`}>
                    <td className="border border-gray-800 p-0"><input type="number" className="w-full h-full text-center outline-none py-1 font-medium" value={col.actualProd.lh.shift1} onChange={(e) => handleActualProdChange(cIdx, "lh", "shift1", e.target.value)} /></td>
                    <td className="border border-gray-800 p-0"><input type="number" className="w-full h-full text-center outline-none py-1 font-medium" value={col.actualProd.lh.shift2} onChange={(e) => handleActualProdChange(cIdx, "lh", "shift2", e.target.value)} /></td>
                    <td className="border border-gray-800 p-0"><input type="number" className="w-full h-full text-center outline-none py-1 font-medium" value={col.actualProd.lh.shift3} onChange={(e) => handleActualProdChange(cIdx, "lh", "shift3", e.target.value)} /></td>
                    <td className="border border-gray-800 p-1 font-bold bg-gray-100">{sumValues(col.actualProd.lh.shift1, col.actualProd.lh.shift2, col.actualProd.lh.shift3)}</td>
                  </React.Fragment>
                ))}
              </tr>

              {/* ACTUAL PROD QTY (RH) */}
              <tr>
                <td className="border border-gray-800 p-1 font-bold bg-gray-100 w-10">RH</td>
                {lineColumns.map((col, cIdx) => (
                  <React.Fragment key={`rh-${cIdx}`}>
                    <td className="border border-gray-800 p-0"><input type="number" className="w-full h-full text-center outline-none py-1 font-medium" value={col.actualProd.rh.shift1} onChange={(e) => handleActualProdChange(cIdx, "rh", "shift1", e.target.value)} /></td>
                    <td className="border border-gray-800 p-0"><input type="number" className="w-full h-full text-center outline-none py-1 font-medium" value={col.actualProd.rh.shift2} onChange={(e) => handleActualProdChange(cIdx, "rh", "shift2", e.target.value)} /></td>
                    <td className="border border-gray-800 p-0"><input type="number" className="w-full h-full text-center outline-none py-1 font-medium" value={col.actualProd.rh.shift3} onChange={(e) => handleActualProdChange(cIdx, "rh", "shift3", e.target.value)} /></td>
                    <td className="border border-gray-800 p-1 font-bold bg-gray-100">{sumValues(col.actualProd.rh.shift1, col.actualProd.rh.shift2, col.actualProd.rh.shift3)}</td>
                  </React.Fragment>
                ))}
              </tr>

              {/* NO OF MANPOWER */}
              <tr className="bg-gray-50">
                <td colSpan={3} className="border border-gray-800 p-1 font-bold text-left px-2">NO OF MANPOWER (UTILIZED)</td>
                {lineColumns.map((col, cIdx) => (
                  <React.Fragment key={`mp-${cIdx}`}>
                    <td className="border border-gray-800 p-0"><input type="number" className="w-full h-full text-center outline-none py-1 font-medium bg-transparent" value={col.manpower.shift1} onChange={(e) => handleManpowerChange(cIdx, "shift1", e.target.value)} /></td>
                    <td className="border border-gray-800 p-0"><input type="number" className="w-full h-full text-center outline-none py-1 font-medium bg-transparent" value={col.manpower.shift2} onChange={(e) => handleManpowerChange(cIdx, "shift2", e.target.value)} /></td>
                    <td className="border border-gray-800 p-0"><input type="number" className="w-full h-full text-center outline-none py-1 font-medium bg-transparent" value={col.manpower.shift3} onChange={(e) => handleManpowerChange(cIdx, "shift3", e.target.value)} /></td>
                    <td className="border border-gray-800 p-1 font-bold bg-gray-200">{sumValues(col.manpower.shift1, col.manpower.shift2, col.manpower.shift3)}</td>
                  </React.Fragment>
                ))}
              </tr>

              {/* LOSSES */}
              {LOSS_REASONS.map((loss) => (
                <tr key={`loss-row-${loss.id}`} className="hover:bg-gray-50/50">
                  <td className="border border-gray-800 p-1 font-bold text-gray-700">{loss.id}</td>
                  {loss.isFirst && (
                    <td rowSpan={loss.rowSpan} className="border border-gray-800 p-1 font-bold text-gray-800 bg-gray-100 align-middle text-[11px] tracking-wider">{loss.category}</td>
                  )}
                  <td className="border border-gray-800 p-1 text-left px-2 font-medium text-gray-800">{loss.name}</td>
                  {lineColumns.map((col, cIdx) => (
                    <React.Fragment key={`l-${loss.id}-${cIdx}`}>
                      <td className="border border-gray-800 p-0"><input type="number" className="w-full h-full text-center outline-none py-1 bg-transparent" value={col.losses[`loss_${loss.id}`]?.shift1} onChange={(e) => handleLossChange(cIdx, loss.id, "shift1", e.target.value)} /></td>
                      <td className="border border-gray-800 p-0"><input type="number" className="w-full h-full text-center outline-none py-1 bg-transparent" value={col.losses[`loss_${loss.id}`]?.shift2} onChange={(e) => handleLossChange(cIdx, loss.id, "shift2", e.target.value)} /></td>
                      <td className="border border-gray-800 p-0"><input type="number" className="w-full h-full text-center outline-none py-1 bg-transparent" value={col.losses[`loss_${loss.id}`]?.shift3} onChange={(e) => handleLossChange(cIdx, loss.id, "shift3", e.target.value)} /></td>
                      <td className="border border-gray-800 p-1 font-bold bg-gray-100 text-gray-800">{sumValues(col.losses[`loss_${loss.id}`]?.shift1, col.losses[`loss_${loss.id}`]?.shift2, col.losses[`loss_${loss.id}`]?.shift3)}</td>
                    </React.Fragment>
                  ))}
                </tr>
              ))}

              {/* TOTAL LOSS ROW */}
              <tr className="bg-gray-200 font-extrabold text-gray-900">
                <td colSpan={3} className="border border-gray-800 p-1.5 text-left px-2">Total Loss (mins)</td>
                {lineColumns.map((col, cIdx) => (
                  <React.Fragment key={`tot-loss-${cIdx}`}>
                    <td className="border border-gray-800 p-1">{calcTotalLoss(col, "shift1")}</td>
                    <td className="border border-gray-800 p-1">{calcTotalLoss(col, "shift2")}</td>
                    <td className="border border-gray-800 p-1">{calcTotalLoss(col, "shift3")}</td>
                    <td className="border border-gray-800 p-1 bg-gray-300">{sumValues(calcTotalLoss(col, "shift1"), calcTotalLoss(col, "shift2"), calcTotalLoss(col, "shift3"))}</td>
                  </React.Fragment>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {/* SIGNATURES */}
        <div className="overflow-x-auto pt-2">
          <table className="w-full border-collapse border-2 border-gray-800 text-xs text-center table-fixed min-w-[800px]">
            <tbody>
              <tr>
                <td className="border border-gray-800 p-1.5 font-bold bg-gray-100 text-left w-48">SECTION INCHARGE SIGN</td>
                {["shift1", "shift2", "shift3"].map((s, idx) => (
                  <td key={`sis-${s}`} className="border border-gray-800 p-0">
                    <div className="flex items-center px-2 py-1">
                      <span className="font-bold text-gray-600 text-[11px] mr-1 whitespace-nowrap">SHIFT-{["I", "II", "III"][idx]}:</span>
                      <input type="text" placeholder="Signature" className="w-full outline-none font-medium bg-transparent text-center" value={signatures.sectionInchargeSign[s]} onChange={(e) => handleSignatureChange("sectionInchargeSign", s, e.target.value)} />
                    </div>
                  </td>
                ))}
                <td className="border border-gray-800 p-0 text-left" rowSpan={2}>
                  <div className="flex items-center px-3 py-1 gap-2">
                    <span className="font-bold text-gray-800 whitespace-nowrap">TEAM LEADER SIGN :</span>
                    <input type="text" placeholder="Sign" className="w-full outline-none font-medium bg-transparent border-b border-gray-300 focus:border-orange-500" value={signatures.teamLeaderSign} onChange={(e) => handleSignatureChange("teamLeaderSign", null, e.target.value)} />
                  </div>
                </td>
              </tr>
              <tr>
                <td className="border border-gray-800 p-1.5 font-bold bg-gray-100 text-left">SECTION INCHARGE NAME</td>
                {["shift1", "shift2", "shift3"].map((s, idx) => (
                  <td key={`sin-${s}`} className="border border-gray-800 p-0">
                    <div className="flex items-center px-2 py-1">
                      <span className="font-bold text-gray-600 text-[11px] mr-1 whitespace-nowrap">SHIFT-{["I", "II", "III"][idx]}:</span>
                      <input type="text" placeholder="Name" className="w-full outline-none font-medium bg-transparent text-center" value={signatures.sectionInchargeName[s]} onChange={(e) => handleSignatureChange("sectionInchargeName", s, e.target.value)} />
                    </div>
                  </td>
                ))}
              </tr>
              <tr>
                <td className="border border-gray-800 p-1.5 font-bold bg-gray-100 text-left">SHIFT OFFICER SIGN</td>
                {["shift1", "shift2", "shift3"].map((s, idx) => (
                  <td key={`sos-${s}`} className="border border-gray-800 p-0">
                    <div className="flex items-center px-2 py-1">
                      <span className="font-bold text-gray-600 text-[11px] mr-1 whitespace-nowrap">SHIFT-{["I", "II", "III"][idx]}:</span>
                      <input type="text" placeholder="Signature" className="w-full outline-none font-medium bg-transparent text-center" value={signatures.shiftOfficerSign[s]} onChange={(e) => handleSignatureChange("shiftOfficerSign", s, e.target.value)} />
                    </div>
                  </td>
                ))}
                <td className="border border-gray-800 p-0 text-left">
                  <div className="flex items-center px-3 py-1 gap-2">
                    <span className="font-bold text-gray-800 whitespace-nowrap">TEAM LEADER NAME :</span>
                    <input type="text" placeholder="Name" className="w-full outline-none font-medium bg-transparent border-b border-gray-300 focus:border-orange-500" value={signatures.teamLeaderName} onChange={(e) => handleSignatureChange("teamLeaderName", null, e.target.value)} />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="border border-gray-800 p-2 bg-yellow-50 text-[11px] font-bold text-gray-800 flex items-center justify-center">
          NOTE : TOOL CHANGE LOSSES TIME ABOVE 20 MINS ONLY MENTION THE LOSS
        </div>

        <div className="flex justify-end gap-4 pt-4 border-t border-gray-300">
          <button type="button" onClick={handleSave} disabled={isSaving || saveSuccess} className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white px-10 py-3 rounded font-bold transition-colors shadow-lg hover:cursor-pointer text-sm tracking-wider uppercase">
            {isSaving ? "SAVING..." : saveSuccess ? "SAVED ✓" : "SAVE REPORT"}
          </button>
        </div>

      </div>
    </div>
  );
}