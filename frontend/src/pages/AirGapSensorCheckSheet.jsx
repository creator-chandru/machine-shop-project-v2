import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLineSet } from "../context/LineSetContext.jsx";
import { FileDown } from "lucide-react";
import Header from '../components/Header';

const SHIFTS = ["I", "II", "III"];
const INITIAL_BLOCKS = 1;

const initialFormData = {
  formCode: "QF/07/MPD-06",
  revision: "05",
  revisionDate: "10.07.2026",
  title: "AIR GAP SENSOR CHECK SHEET",
  company: "SAKTHI AUTO"
};

const defaultParameters = [
  { masterPosition: "*LH-NOGO #RH-NOGO", expectedStatus: "OFF/RED/NO SIGNAL" },
  { masterPosition: "LH-GO RH-NOGO", expectedStatus: "OFF/RED/NO SIGNAL" },
  { masterPosition: "LH-NOGO RH-GO", expectedStatus: "OFF/RED/NO SIGNAL" },
  { masterPosition: "*LH-GO #RH-GO", expectedStatus: "ON / GREEN SIGNAL" }
];

const notesList = [
  "If status OK - ✓  |  If status NOTOK – X",
  "Air gap sensor should be checked as per WI/07/MPD-266 (for digital), WI/07/MPD-266A (for Analog) during Ist shift and IInd & IIIrd shift should ensure the Air flow in the locator and recorded.",
  "If air gap sensor verification gets failed follow the reaction plan for Error proof failure WI/07/MPD-271.",
  "Error proof verification should be conducted and recorded during setup changes, major breakdowns, and any fixture issues in the respective machines/fixtures."
];

const legendText = "LEGEND: *-Applicable for single part fixture (LH), #-Applicable for single part fixture (RH), I ,II, III -Shift.";

const getTodayISODate = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const createEmptyBlock = (defaultMachineNo = "") => ({
  machineNo: defaultMachineNo,
  errorProofNo: "",
  parameters: defaultParameters.map((p) => ({ ...p })),
  dailyChecks: {},
  lineInchargeSignatures: {}
});

const Toast = ({ message, type, onClose }) => {
  if (!message) return null;
  const bgColor = type === 'error' ? 'bg-red-600' : type === 'success' ? 'bg-green-600' : 'bg-orange-600';
  return (
    <div className={`fixed bottom-6 right-6 z-50 ${bgColor} text-white px-5 py-3 rounded-lg shadow-2xl flex items-center gap-3 transition-all transform animate-bounce`}>
      <span className="text-sm font-semibold">{message}</span>
      <button onClick={onClose} className="ml-2 font-bold text-lg leading-none hover:text-gray-200 focus:outline-none">×</button>
    </div>
  );
};

export default function AirGapSensorCheckSheet() {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const { lineSet, setLineSet } = useLineSet();

  const [headerInfo, setHeaderInfo] = useState({
    lineCode: "",
    partName: "",
    partNo: "",
    machineNo: "",
    date: getTodayISODate()
  });

  const [machineDetails, setMachineDetails] = useState([]);
  const [lineMappings, setLineMappings] = useState([]);
  const [loadingMachineDetails, setLoadingMachineDetails] = useState(true);
  
  const [peUsers, setPeUsers] = useState([]);

  const [blocks, setBlocks] = useState(
    Array.from({ length: INITIAL_BLOCKS }, () => createEmptyBlock())
  );

  const [shiftProdSignatures, setShiftProdSignatures] = useState({});
  const [lockedShifts, setLockedShifts] = useState({ I: false, II: false, III: false });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [toast, setToast] = useState({ message: '', type: '' });

  const currentUser = JSON.parse(localStorage.getItem('user'))?.username || 'Unknown';

  const triggerToast = (message, type = 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: '', type: '' }), 4000);
  };

  useEffect(() => {
    if (lineSet) {
      setHeaderInfo((prev) => ({
        ...prev,
        lineCode: lineSet.lineCode || "",
        partName: lineSet.partName || "",
        partNo: lineSet.partNo || "",
        machineNo: lineSet.machineNo || ""
      }));
      if (lineSet.machineNo) {
        setBlocks((prev) => {
          if (prev.length > 0 && !prev[0].machineNo) {
            const next = [...prev];
            next[0] = { ...next[0], machineNo: lineSet.machineNo };
            return next;
          }
          return prev;
        });
      }
    }
  }, [lineSet]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!shopId) return;
        const token = localStorage.getItem("token");
        const headers = { Authorization: `Bearer ${token}` };

        const machineRes = await fetch(`${process.env.REACT_APP_API_URL}/api/machine-shop/${shopId}/pre-operation-details`, { headers });
        if (!machineRes.ok) throw new Error("Failed to fetch Machine Shop details");
        setMachineDetails(await machineRes.json());

        const mappingRes = await fetch(`${process.env.REACT_APP_API_URL}/api/mappings/${shopId}/lines`, { headers });
        if (!mappingRes.ok) throw new Error("Failed to fetch line mappings");
        setLineMappings(await mappingRes.json());

        const peRes = await fetch(`${process.env.REACT_APP_API_URL}/api/air-gap-sensor/pe/users`, { headers });
        if (peRes.ok) {
            const peData = await peRes.json();
            setPeUsers(peData.peList || []);
        }

      } catch (err) {
        triggerToast("Failed to load required data.", "error");
      } finally {
        setLoadingMachineDetails(false);
      }
    };
    fetchData();
  }, [shopId]);

  const lineCodes = lineMappings.length > 0
    ? lineMappings.map((m) => m.lineCode)
    : [...new Set(machineDetails.map((item) => item.lineCode).filter(Boolean))];

  const machineOptionsRaw = machineDetails.filter((item) => item.lineCode === headerInfo.lineCode);
  const machineOptions = Array.from(new Set(machineOptionsRaw.map((m) => m.machineNo).filter(Boolean)))
    .map((machineNo) => machineOptionsRaw.find((m) => m.machineNo === machineNo));

  const handleHeaderChange = (field, val) => {
    setHeaderInfo((prev) => ({ ...prev, [field]: val }));
  };

  const handleLineChange = (lineCode) => {
    const mapping = lineMappings.find((m) => m.lineCode === lineCode);
    const autoPartName = mapping?.partSet || "";
    const autoPartNo = mapping?.idSet || "";

    setHeaderInfo((prev) => ({
      ...prev, lineCode, partName: autoPartName, partNo: autoPartNo, machineNo: ""
    }));

    setLineSet({ machineShop: shopId, lineCode, partName: autoPartName, partNo: autoPartNo, machineNo: "" });
  };

  useEffect(() => {
    const fetchSavedAirGapData = async () => {
      if (!shopId || !headerInfo.lineCode || !headerInfo.partNo || !headerInfo.date) return;

      try {
        const token = localStorage.getItem('token');
        const params = new URLSearchParams({
          machineShop: shopId, lineCode: headerInfo.lineCode, partNo: headerInfo.partNo, date: headerInfo.date
        });

        const res = await fetch(`${process.env.REACT_APP_API_URL}/api/air-gap-sensor?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!res.ok) throw new Error('Failed to fetch saved Air Gap data');

        const savedRows = await res.json();

        if (!Array.isArray(savedRows) || savedRows.length === 0) {
          setLockedShifts({ I: false, II: false, III: false });
          setBlocks([createEmptyBlock(headerInfo.machineNo || '')]);
          setShiftProdSignatures({});
          return;
        }

        const shiftsFound = { I: false, II: false, III: false };
        const blockMap = new Map();
        const productionSigns = {};

        for (const row of savedRows) {
          const shift = row.shift;
          if (SHIFTS.includes(shift)) shiftsFound[shift] = true;

          const key = `${row.machineNo || ''}__${row.errorProofNo || ''}`;
          if (!blockMap.has(key)) blockMap.set(key, createEmptyBlock(row.machineNo || ''));

          const block = blockMap.get(key);
          block.machineNo = row.machineNo || '';
          block.errorProofNo = row.errorProofNo || '';

          const dateChecks = block.dailyChecks[headerInfo.date] || {};
          const paramIdx = block.parameters.findIndex((param) => param.masterPosition === row.parameter);

          if (paramIdx !== -1 && SHIFTS.includes(shift)) {
            dateChecks[paramIdx] = { ...(dateChecks[paramIdx] || {}), [shift]: row.status || '' };
          }
          block.dailyChecks[headerInfo.date] = dateChecks;

          if (SHIFTS.includes(shift)) {
            const dateSigns = block.lineInchargeSignatures[headerInfo.date] || {};
            dateSigns[shift] = row.lineInchargeSignature || '';
            block.lineInchargeSignatures[headerInfo.date] = dateSigns;
            
            let pSign = row.productionSignature || '';
            if (pSign.startsWith('Pending [')) {
                pSign = pSign.replace('Pending [', '').replace(']', '');
            }
            productionSigns[shift] = pSign; 
          }
        }

        setBlocks(Array.from(blockMap.values()));
        setLockedShifts(shiftsFound);
        setShiftProdSignatures({ [headerInfo.date]: productionSigns });
      } catch (err) {
        console.error('Saved Air Gap data fetch error:', err);
      }
    };
    fetchSavedAirGapData();
  }, [shopId, headerInfo.lineCode, headerInfo.partNo, headerInfo.date]);

  const handleAddBlock = () => setBlocks(prev => [...prev, createEmptyBlock("")]);
  const handleRemoveBlock = () => setBlocks((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));

  const handleCheckChange = (blockIdx, paramIdx, shift, val) => {
    if (lockedShifts[shift]) return;
    setBlocks((prev) => {
      const next = [...prev];
      const currentBlock = next[blockIdx];
      const dateChecks = currentBlock.dailyChecks[headerInfo.date] || {};
      const paramShifts = dateChecks[paramIdx] || {};
      next[blockIdx] = {
        ...currentBlock,
        dailyChecks: { ...currentBlock.dailyChecks, [headerInfo.date]: { ...dateChecks, [paramIdx]: { ...paramShifts, [shift]: val } } }
      };
      return next;
    });
  };

  const handleBlockMetaChange = (blockIdx, field, val) => {
    setBlocks((prev) => {
      const next = [...prev];
      next[blockIdx] = { ...next[blockIdx], [field]: val };
      return next;
    });

    if (field === "machineNo" && blockIdx === 0) {
      setHeaderInfo((prev) => ({ ...prev, machineNo: val }));
      setLineSet({ machineShop: shopId, lineCode: headerInfo.lineCode, partName: headerInfo.partName, partNo: headerInfo.partNo, machineNo: val });
    }
  };

  const handleLineInchargeSignChange = (blockIdx, shift, val) => {
    if (lockedShifts[shift]) return;
    setBlocks((prev) => {
      const next = [...prev];
      const currentBlock = next[blockIdx];
      const dateSigns = currentBlock.lineInchargeSignatures[headerInfo.date] || {};
      next[blockIdx] = {
        ...currentBlock,
        lineInchargeSignatures: { ...currentBlock.lineInchargeSignatures, [headerInfo.date]: { ...dateSigns, [shift]: val } }
      };
      return next;
    });
  };

  const handleShiftProdSignChange = (shift, val) => {
    if (lockedShifts[shift]) return;
    setShiftProdSignatures((prev) => {
      const dateSigns = prev[headerInfo.date] || {};
      return {
        ...prev,
        [headerInfo.date]: {
          ...dateSigns,
          [shift]: val
        }
      };
    });
  };

  const handleDownloadPdf = async () => {
    if (!headerInfo.lineCode || !headerInfo.partNo || !headerInfo.date) {
      triggerToast("Please ensure Line Code, Part No, and Date are selected.", "error");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      let isoDate = headerInfo.date;
      const queryParams = new URLSearchParams({
        lineCode: headerInfo.lineCode, partNo: headerInfo.partNo, date: isoDate, shopId: shopId || 3,
      });

      const url = `${process.env.REACT_APP_API_URL || ""}/api/air-gap-sensor/report?${queryParams.toString()}`;
      triggerToast("Downloading PDF from server...", "success");

      const response = await fetch(url, { method: "GET", headers: { Authorization: `Bearer ${token}` } });

      if (!response.ok) {
        if (response.status === 404) {
           throw new Error("No data recorded for this specific date.");
        }
        throw new Error("Failed to generate PDF from the server.");
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `Air_Gap_Checksheet_${headerInfo.lineCode}_${isoDate}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      triggerToast(err.message || "Failed to download PDF", "error");
    }
  };

  const handleSave = async () => {
    if (!headerInfo.lineCode || !headerInfo.partNo || !headerInfo.partName) {
      triggerToast("Please select Line Code before proceeding.", "error");
      return;
    }

    const date = headerInfo.date;
    const completeShifts = SHIFTS.filter((shift) => {
      if (lockedShifts[shift]) return false;
      return blocks.length > 0 && blocks.every((block) => {
        const dateChecks = block.dailyChecks?.[date] || {};
        const lineSignature = block.lineInchargeSignatures?.[date]?.[shift] || '';
        const allParametersRecorded = block.parameters.every((_, paramIdx) => Boolean(dateChecks?.[paramIdx]?.[shift]));
        
        return Boolean(block.machineNo && allParametersRecorded && lineSignature);
      });
    });

    if (completeShifts.length === 0) {
      triggerToast("Please complete all parameter statuses and line signature for at least one unrecorded shift.", "error");
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);

    const payload = {
      header: { ...headerInfo, machineShop: shopId },
      blocks,
      shiftProdSignatures
    };

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/air-gap-sensor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Save failed');

      const data = await res.json().catch(() => ({}));
      const savedShifts = data.savedShifts || completeShifts;
      
      setLockedShifts((prev) => {
        const next = { ...prev };
        savedShifts.forEach((shift) => { next[shift] = true; });
        return next;
      });

      setLineSet({
        machineShop: shopId, lineCode: headerInfo.lineCode, partName: headerInfo.partName,
        partNo: headerInfo.partNo, machineNo: blocks[0]?.machineNo || headerInfo.machineNo || ""
      });

      setIsSaving(false);
      setSaveSuccess(true);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      navigate(`/shift-incharge/${shopId}`);
    } catch (err) {
      setIsSaving(false);
      triggerToast(err.message || 'Failed to save checksheet.', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-[#2d2d2d] flex flex-col items-center justify-center p-6 pb-20">
      <Header />
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: '' })} />

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

      <div className="bg-white w-full max-w-[90rem] rounded-xl p-8 shadow-2xl overflow-x-auto border-4 border-gray-100">
        <div className="flex justify-between items-center mb-6 border-b border-gray-200 pb-4">
          <div>
            <span className="text-xs font-bold text-orange-600 tracking-wider uppercase block mb-1">
              {initialFormData.company}
            </span>
            <h2 className="text-2xl font-bold text-gray-800 uppercase tracking-wide">
              {initialFormData.title}
            </h2>
            <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-2">
              <span>Form Code: {initialFormData.formCode}</span>
              <span>|</span>
              <span>Revision: {initialFormData.revision}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider shadow transition-colors"
          >
            <FileDown className="w-4 h-4" /> Download Report
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div>
            <label className="font-bold text-gray-700 block mb-1 text-sm">Line Code</label>
            <select
              className="w-full border border-gray-300 p-2 rounded text-sm font-semibold bg-white"
              value={headerInfo.lineCode}
              onChange={(e) => handleLineChange(e.target.value)}
              disabled={loadingMachineDetails}
            >
              <option value="">{loadingMachineDetails ? "Loading..." : "Select Line Code"}</option>
              {lineCodes.map((lineCode) => (<option key={lineCode} value={lineCode}>{lineCode}</option>))}
            </select>
          </div>
          <div>
            <label className="font-bold text-gray-700 block mb-1 text-sm">Part No</label>
            <input type="text" readOnly className="w-full border border-gray-300 p-2 rounded text-sm font-semibold bg-gray-100" value={headerInfo.partNo} />
          </div>
          <div>
            <label className="font-bold text-gray-700 block mb-1 text-sm">Part Name</label>
            <input type="text" readOnly className="w-full border border-gray-300 p-2 rounded text-sm font-semibold bg-gray-100" value={headerInfo.partName} />
          </div>
          <div>
            <label className="font-bold text-gray-700 block mb-1 text-sm">Date</label>
            <input type="date" className="w-full border border-gray-300 p-2 rounded text-sm font-semibold bg-white" value={headerInfo.date} onChange={(e) => handleHeaderChange('date', e.target.value)} />
          </div>
        </div>

        <div className="flex justify-between items-center mb-2 px-1">
          <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Checksheet Items</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleAddBlock} className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-4 py-1.5 rounded">+ Add Row</button>
            {blocks.length > 1 && <button type="button" onClick={handleRemoveBlock} className="bg-gray-600 hover:bg-gray-700 text-white text-xs font-bold px-3 py-1.5 rounded">− Delete Row</button>}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-800 text-sm text-center">
            <thead className="bg-gray-100 text-gray-800 font-bold">
              <tr>
                <th rowSpan={2} className="border border-gray-800 p-2 w-40">Machine No</th>
                <th rowSpan={2} className="border border-gray-800 p-2 w-40">Error Proof No</th>
                <th rowSpan={2} className="border border-gray-800 p-2 text-left px-3">Parameter (Master Position)</th>
                <th rowSpan={2} className="border border-gray-800 p-2 w-64 text-left px-3">Expected Status</th>
                <th colSpan={3} className="border border-gray-800 p-2">Status</th>
              </tr>
              <tr>
                {SHIFTS.map((shift) => (<th key={shift} className="border border-gray-800 p-2 w-24">Shift {shift}</th>))}
              </tr>
            </thead>
            <tbody>
              {blocks.map((block, bIdx) => (
                <React.Fragment key={`block-${bIdx}`}>
                  {block.parameters.map((param, pIdx) => {
                    const paramShifts = block.dailyChecks[headerInfo.date]?.[pIdx] || {};
                    return (
                      <tr key={`block-${bIdx}-param-${pIdx}`}>
                        {pIdx === 0 && (
                          <>
                            <td rowSpan={4} className="border border-gray-800 p-0 font-medium">
                              <select className="w-full h-full text-center outline-none bg-transparent py-2" value={block.machineNo} onChange={(e) => handleBlockMetaChange(bIdx, 'machineNo', e.target.value)} disabled={!headerInfo.lineCode}>
                                <option value="">{headerInfo.lineCode ? "Select Machine" : "Select Line"}</option>
                                {machineOptions.map((m, i) => (<option key={i} value={m.machineNo}>{m.machineNo}</option>))}
                              </select>
                            </td>
                            <td rowSpan={4} className="border border-gray-800 p-0">
                              <input type="text" className="w-full h-full text-center px-3 outline-none bg-transparent py-2" placeholder="Error Proof No" value={block.errorProofNo} onChange={(e) => handleBlockMetaChange(bIdx, 'errorProofNo', e.target.value)} />
                            </td>
                          </>
                        )}
                        <td className="border border-gray-800 p-0"><div className="px-3 py-2 text-left text-gray-800 font-medium">{param.masterPosition}</div></td>
                        <td className="border border-gray-800 p-0"><div className="px-3 py-2 text-left text-gray-800 font-medium">{param.expectedStatus}</div></td>
                        {SHIFTS.map((shift) => (
                          <td key={shift} className="border border-gray-800 p-0">
                            <select value={paramShifts[shift] || ""} onChange={(e) => handleCheckChange(bIdx, pIdx, shift, e.target.value)} className="w-full h-full min-h-[38px] text-center font-bold text-base bg-transparent outline-none cursor-pointer" disabled={lockedShifts[shift]}>
                              <option value=""></option><option value="✓">✓</option><option value="X">X</option>
                            </select>
                          </td>
                        ))}
                      </tr>
                    );
                  })}

                  <tr>
                    <td colSpan={4} className="border border-gray-800 p-2 text-left px-3 font-bold bg-gray-50 text-gray-700">Line Incharge Signature</td>
                    {SHIFTS.map((shift) => {
                      const sign = block.lineInchargeSignatures[headerInfo.date]?.[shift] || "";
                      return (
                        <td key={`line-${shift}`} className="border border-gray-800 p-2 text-center bg-gray-50/30">
                          {sign ? (
                            <div className="flex flex-col items-center"><span className="text-[10px] font-bold text-green-600">Approved ✓</span><span className="text-xs font-black uppercase">{sign}</span></div>
                          ) : (
                            <button type="button" onClick={() => handleLineInchargeSignChange(bIdx, shift, currentUser)} disabled={lockedShifts[shift]} className={`text-[10px] font-bold px-3 py-1.5 rounded uppercase tracking-widest ${lockedShifts[shift] ? 'bg-gray-400 text-white' : 'bg-orange-500 hover:bg-orange-600 text-white'}`}>Approve</button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                </React.Fragment>
              ))}

              <tr>
                <td colSpan={4} className="border border-gray-800 p-2 text-left px-3 font-bold bg-gray-50 text-gray-700">
                    Shift Production Incharge Signature (PE)
                </td>
                {SHIFTS.map((shift) => {
                  const peSign = shiftProdSignatures[headerInfo.date]?.[shift] || "";
                  const isApproved = peSign.startsWith('Approved (');

                  return (
                    <td key={`pe-${shift}`} className="border border-gray-800 p-0 h-10 bg-gray-50/30">
                      {isApproved ? (
                        <div className="flex flex-col items-center justify-center py-1">
                          <span className="text-[9px] font-bold text-green-600 mb-0.5">Verified ✓</span>
                          <span className="text-[10px] font-black uppercase text-gray-800">
                            {peSign.replace('Approved (', '').replace(')', '')}
                          </span>
                        </div>
                      ) : (
                        <select
                          className="w-full h-full text-center px-1 outline-none bg-transparent font-medium cursor-pointer text-xs"
                          value={peSign}
                          onChange={(e) => handleShiftProdSignChange(shift, e.target.value)}
                          disabled={lockedShifts[shift]}
                        >
                          <option value="">-- Assign PE --</option>
                          {peUsers.map((pe, idx) => {
                            const uname = pe.username || pe.employeeId || pe.name;
                            return (
                              <option key={idx} value={uname}>
                                {uname.toUpperCase()}
                              </option>
                            );
                          })}
                        </select>
                      )}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>

        <div className="border-2 border-gray-800 flex flex-col mt-4">
          <div className="px-2 py-1 font-bold text-gray-800 text-sm border-b border-gray-800 bg-gray-100">Note:</div>
          <div className="p-3 text-xs text-gray-700 space-y-1.5 leading-relaxed bg-white">
            <ol className="list-[lower-alpha] list-inside space-y-1">
              {notesList.map((note, idx) => (<li key={`note-${idx}`}>{note}</li>))}
            </ol>
            <div className="pt-2 border-t border-gray-200 font-semibold text-gray-800">{legendText}</div>
          </div>
        </div>

        <div className="flex justify-end mt-6 pt-4 border-t border-gray-300">
          <button type="button" onClick={handleSave} disabled={isSaving || saveSuccess} className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white px-10 py-3 rounded font-bold">
            {isSaving ? "SAVING..." : saveSuccess ? "SAVED ✓" : "SAVE & CONTINUE"}
          </button>
        </div>
      </div>
    </div>
  );
}