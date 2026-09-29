import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLineSet } from "../context/LineSetContext.jsx";
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
  {
    masterPosition: "*LH-NOGO #RH-NOGO",
    expectedStatus: "OFF/RED/NO SIGNAL"
  },
  {
    masterPosition: "LH-GO RH-NOGO",
    expectedStatus: "OFF/RED/NO SIGNAL"
  },
  {
    masterPosition: "LH-NOGO RH-GO",
    expectedStatus: "OFF/RED/NO SIGNAL"
  },
  {
    masterPosition: "*LH-GO #RH-GO",
    expectedStatus: "ON / GREEN SIGNAL"
  }
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
  const [loadingMachineDetails, setLoadingMachineDetails] = useState(true);

  const [blocks, setBlocks] = useState(
    Array.from({ length: INITIAL_BLOCKS }, () => createEmptyBlock())
  );

  const [shiftProdSignatures, setShiftProdSignatures] = useState({});
  const [lockedShifts, setLockedShifts] = useState({ I: false, II: false, III: false });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Toast state
  const [toast, setToast] = useState({ message: '', type: '' });

  const triggerToast = (message, type = 'error') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast({ message: '', type: '' });
    }, 4000);
  };

  // Sync with LineSetContext whenever it changes
  useEffect(() => {
    if (lineSet) {
      setHeaderInfo((prev) => ({
        ...prev,
        lineCode: lineSet.lineCode || "",
        partName: lineSet.partName || "",
        partNo: lineSet.partNo || "",
        machineNo: lineSet.machineNo || ""
      }));

      // Pre-fill the machineNo in the first block if not already populated
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

  // Fetch machine details for shopId (like Pre-Operation Checklist)
  useEffect(() => {
    const fetchMachineDetails = async () => {
      try {
        if (shopId !== "3") {
          setMachineDetails([]);
          return;
        }

        const token = localStorage.getItem("token");

        const res = await fetch(
          `${process.env.REACT_APP_API_URL}/api/machine-shop/3/pre-operation-details`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );

        if (!res.ok) {
          throw new Error("Failed to fetch Machine Shop 3 details");
        }

        const data = await res.json();
        setMachineDetails(data);
      } catch (err) {
  console.error("Machine details fetch error:", err);
  triggerToast("Failed to load Machine Shop 3 details.", "error");
} finally {
  setLoadingMachineDetails(false);
}
    };

    fetchMachineDetails();
  }, [shopId]);

  // Derived options (same as Pre-Operation / Error Proofing)
  const lineCodes = [
    ...new Set(
      machineDetails
        .map((item) => item.lineCode)
        .filter(Boolean)
    )
  ];

  const selectedLineDetails = machineDetails.filter(
    (item) => item.lineCode === headerInfo.lineCode
  );

  const partOptions = [
    ...new Map(
      selectedLineDetails
        .filter((item) => item.partNo)
        .map((item) => [item.partNo, item])
    ).values()
  ];

  const selectedPartDetails = machineDetails.filter(
    (item) =>
      item.lineCode === headerInfo.lineCode &&
      item.partNo === headerInfo.partNo
  );

  const machineOptions = selectedPartDetails;

  const handleHeaderChange = (field, val) => {
    setHeaderInfo((prev) => ({
      ...prev,
      [field]: val
    }));
  };

  const handleLineChange = (lineCode) => {
    setHeaderInfo((prev) => ({
      ...prev,
      lineCode,
      partNo: "",
      partName: "",
      machineNo: ""
    }));

    setLineSet({
      machineShop: shopId,
      lineCode,
      partName: "",
      partNo: "",
      machineNo: ""
    });
  };

  const handlePartNoChange = (partNo) => {
    const selectedPart = machineDetails.find(
      (item) =>
        item.lineCode === headerInfo.lineCode &&
        item.partNo === partNo
    );

    const partName = selectedPart?.partName || "";

    setHeaderInfo((prev) => ({
      ...prev,
      partNo,
      partName,
      machineNo: ""
    }));

    setLineSet({
      machineShop: shopId,
      lineCode: headerInfo.lineCode,
      partName,
      partNo,
      machineNo: ""
    });
  };

  // Fetch saved Air Gap data whenever the selected date/header changes.
  // Previously saved shifts are loaded and locked; unrecorded shifts stay editable.
  useEffect(() => {
    const fetchSavedAirGapData = async () => {
      if (!shopId || !headerInfo.lineCode || !headerInfo.partNo || !headerInfo.date) {
        return;
      }

      try {
        const token = localStorage.getItem('token');
        const params = new URLSearchParams({
          machineShop: shopId,
          lineCode: headerInfo.lineCode,
          partNo: headerInfo.partNo,
          date: headerInfo.date
        });

        const res = await fetch(
          `${process.env.REACT_APP_API_URL}/api/air-gap-sensor?${params.toString()}`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );

        if (!res.ok) {
          throw new Error('Failed to fetch saved Air Gap data');
        }

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
          if (SHIFTS.includes(shift)) {
            shiftsFound[shift] = true;
          }

          const key = `${row.machineNo || ''}__${row.errorProofNo || ''}`;

          if (!blockMap.has(key)) {
            blockMap.set(key, createEmptyBlock(row.machineNo || ''));
          }

          const block = blockMap.get(key);
          block.machineNo = row.machineNo || '';
          block.errorProofNo = row.errorProofNo || '';

          const dateChecks = block.dailyChecks[headerInfo.date] || {};
          const paramIdx = block.parameters.findIndex(
            (param) => param.masterPosition === row.parameter
          );

          if (paramIdx !== -1 && SHIFTS.includes(shift)) {
            dateChecks[paramIdx] = {
              ...(dateChecks[paramIdx] || {}),
              [shift]: row.status || ''
            };
          }

          block.dailyChecks[headerInfo.date] = dateChecks;

          if (SHIFTS.includes(shift)) {
            const dateSigns = block.lineInchargeSignatures[headerInfo.date] || {};
            dateSigns[shift] = row.lineInchargeSignature || '';
            block.lineInchargeSignatures[headerInfo.date] = dateSigns;

            productionSigns[shift] = row.productionSignature || '';
          }
        }

        setBlocks(Array.from(blockMap.values()));
        setLockedShifts(shiftsFound);
        setShiftProdSignatures({
          [headerInfo.date]: productionSigns
        });
      } catch (err) {
        console.error('Saved Air Gap data fetch error:', err);
      }
    };

    fetchSavedAirGapData();
  }, [shopId, headerInfo.lineCode, headerInfo.partNo, headerInfo.date]);

  // Add a new block
  const handleAddBlock = () => {
    setBlocks(prev => [
      ...prev,
      createEmptyBlock("")
    ]);
  };

  // Delete the last block if more than 1 exists
  const handleRemoveBlock = () => {
    setBlocks((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  };

  const handleCheckChange = (blockIdx, paramIdx, shift, val) => {
    if (lockedShifts[shift]) return;

    setBlocks((prev) => {
      const next = [...prev];
      const currentBlock = next[blockIdx];
      const dateChecks = currentBlock.dailyChecks[headerInfo.date] || {};
      const paramShifts = dateChecks[paramIdx] || {};

      next[blockIdx] = {
        ...currentBlock,
        dailyChecks: {
          ...currentBlock.dailyChecks,
          [headerInfo.date]: {
            ...dateChecks,
            [paramIdx]: {
              ...paramShifts,
              [shift]: val
            }
          }
        }
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
      setHeaderInfo((prev) => ({
        ...prev,
        machineNo: val
      }));
      setLineSet({
        machineShop: shopId,
        lineCode: headerInfo.lineCode,
        partName: headerInfo.partName,
        partNo: headerInfo.partNo,
        machineNo: val
      });
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
        lineInchargeSignatures: {
          ...currentBlock.lineInchargeSignatures,
          [headerInfo.date]: {
            ...dateSigns,
            [shift]: val
          }
        }
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

  const handleSave = async () => {
    if (!headerInfo.lineCode || !headerInfo.partNo || !headerInfo.partName) {
      triggerToast("Please select Line Code, Part No, and Part Name before proceeding.", "error");
      return;
    }

    // Only unlocked shifts that are fully filled are saved.
    // This prevents empty Shift II/III rows from being created.
    const date = headerInfo.date;
    const completeShifts = SHIFTS.filter((shift) => {
      if (lockedShifts[shift]) return false;

      const productionSignature = shiftProdSignatures?.[date]?.[shift] || '';

      return blocks.length > 0 && blocks.every((block) => {
        const dateChecks = block.dailyChecks?.[date] || {};
        const lineSignature = block.lineInchargeSignatures?.[date]?.[shift] || '';

        const allParametersRecorded = block.parameters.every((_, paramIdx) =>
          Boolean(dateChecks?.[paramIdx]?.[shift])
        );

        return Boolean(
          block.machineNo &&
          allParametersRecorded &&
          lineSignature &&
          productionSignature
        );
      });
    });

    if (completeShifts.length === 0) {
      triggerToast(
        "Please complete at least one unrecorded shift (all parameter statuses and signatures) before saving.",
        "error"
      );
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);

    const payload = {
      header: {
        ...headerInfo,
        lineCode: headerInfo.lineCode,
        partName: headerInfo.partName,
        partNo: headerInfo.partNo,
        machineShop: shopId,
        date: headerInfo.date
      },
      blocks,
      shiftProdSignatures
    };

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/air-gap-sensor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Save failed');
      }

      const savedShifts = data.savedShifts || completeShifts;
      setLockedShifts((prev) => {
        const next = { ...prev };
        savedShifts.forEach((shift) => {
          next[shift] = true;
        });
        return next;
      });

      // Update LineSetContext with the latest selection
      setLineSet({
        machineShop: shopId,
        lineCode: headerInfo.lineCode,
        partName: headerInfo.partName,
        partNo: headerInfo.partNo,
        machineNo: blocks[0]?.machineNo || headerInfo.machineNo || ""
      });

      setIsSaving(false);
      setSaveSuccess(true);

      // Keep success message visible for 2 seconds
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Navigate to Tool Change Record form
      navigate(`/operator/${shopId}/tool-change-record`);

    } catch (err) {
      console.error('Save error:', err);
      setIsSaving(false);
      triggerToast(err.message || 'Failed to save checksheet. Check console for details.', 'error');
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

      {(isSaving || saveSuccess) && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">

          <div className="bg-white rounded-xl shadow-2xl px-10 py-8 text-center">

            {isSaving ? (
              <>
                <div className="w-10 h-10 border-4 border-gray-300 border-t-orange-500 rounded-full animate-spin mx-auto mb-5"></div>

                <h2 className="text-xl font-bold text-gray-800">
                  Saving Data...
                </h2>

                <p className="text-gray-500 mt-2">
                  Please wait
                </p>
              </>
            ) : (
              <>

                <h2 className="text-xl font-bold text-green-800">
                  Data Saved Successfully
                </h2>

                <p className="text-gray-500 mt-2">
                  Loading next form...
                </p>
              </>
            )}

          </div>

        </div>
      )}

      <div className="bg-white w-full max-w-[90rem] rounded-xl p-8 shadow-2xl overflow-x-auto border-4 border-gray-100">

        {/* Card Header */}
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
              <span>|</span>
              <span>Revision Date: {initialFormData.revisionDate}</span>
            </div>
          </div>
        </div>

        {/* Header Meta Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div>
            <label htmlFor="header-lineCode" className="font-bold text-gray-700 block mb-1 text-sm">
              Line Code
            </label>
            <select
              id="header-lineCode"
              className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm font-semibold bg-white"
              value={headerInfo.lineCode}
              onChange={(e) => handleLineChange(e.target.value)}
              disabled={loadingMachineDetails}
            >
              <option value="">
                {loadingMachineDetails ? "Loading..." : "Select Line Code"}
              </option>
              {lineCodes.map((lineCode) => (
                <option key={lineCode} value={lineCode}>
                  {lineCode}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="header-partNo" className="font-bold text-gray-700 block mb-1 text-sm">
              Part No
            </label>
            <select
              id="header-partNo"
              className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm font-semibold bg-white"
              value={headerInfo.partNo}
              onChange={(e) => handlePartNoChange(e.target.value)}
              disabled={!headerInfo.lineCode}
            >
              <option value="">
                {headerInfo.lineCode ? "Select Part No" : "Select Line Code First"}
              </option>
              {partOptions.map((part) => (
                <option key={part.partNo} value={part.partNo}>
                  {part.partNo}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="header-partName" className="font-bold text-gray-700 block mb-1 text-sm">
              Part Name
            </label>
            <input
              id="header-partName"
              type="text"
              readOnly
              className="w-full border border-gray-300 p-2 rounded text-sm font-semibold bg-gray-100"
              value={headerInfo.partName}
              placeholder="Auto-filled"
            />
          </div>

          <div>
            <label htmlFor="header-date" className="font-bold text-gray-700 block mb-1 text-sm">
              Date
            </label>
            <input
              id="header-date"
              type="date"
              className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm font-semibold bg-white"
              value={headerInfo.date}
              onChange={(e) => handleHeaderChange('date', e.target.value)}
            />
          </div>
        </div>

        {/* Action Toolbar with "+ Add Row" Button BEFORE the Table */}
        <div className="flex justify-between items-center mb-2 px-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">
              Checksheet Items
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAddBlock}
              className="inline-flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-4 py-1.5 rounded transition-colors shadow hover:cursor-pointer"
            >
              <span className="text-sm font-bold leading-none">+</span> Add Row
            </button>

            {blocks.length > 1 && (
              <button
                type="button"
                onClick={handleRemoveBlock}
                className="inline-flex items-center gap-1 bg-gray-600 hover:bg-gray-700 text-white text-xs font-bold px-3 py-1.5 rounded transition-colors shadow hover:cursor-pointer"
              >
                <span className="text-sm font-bold leading-none">−</span> Delete Row
              </button>
            )}
          </div>
        </div>

        {/* Main Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-800 text-sm text-center">
            <thead className="bg-gray-100 text-gray-800 font-bold">
              <tr>
                <th rowSpan={2} className="border border-gray-800 p-2 w-40">
                  Machine No
                </th>
                <th rowSpan={2} className="border border-gray-800 p-2 w-40">
                  Error Proof No
                </th>
                <th rowSpan={2} className="border border-gray-800 p-2 text-left px-3">
                  Parameter (Master Position)
                </th>
                <th rowSpan={2} className="border border-gray-800 p-2 w-64 text-left px-3">
                  Expected Status
                </th>
                <th colSpan={3} className="border border-gray-800 p-2">
                  Status
                </th>
              </tr>
              <tr>
                {SHIFTS.map((shift) => (
                  <th key={`shift-${shift}`} className="border border-gray-800 p-2 w-24">
                    Shift {shift}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {blocks.map((block, bIdx) => (
                <React.Fragment key={`block-${bIdx}`}>
                  {block.parameters.map((param, pIdx) => {
                    const blockChecks = block.dailyChecks[headerInfo.date] || {};
                    const paramShifts = blockChecks[pIdx] || {};

                    return (
                      <tr key={`block-${bIdx}-param-${pIdx}`}>
                        {pIdx === 0 && (
                          <>
                            <td rowSpan={4} className="border border-gray-800 p-0 font-medium">
                              <select
                                className="w-full h-full text-center outline-none bg-transparent py-2 cursor-pointer font-medium"
                                aria-label={`Block ${bIdx + 1} Machine No`}
                                value={block.machineNo}
                                onChange={(e) => handleBlockMetaChange(bIdx, 'machineNo', e.target.value)}
                                disabled={!headerInfo.partNo}
                              >
                                <option value="">
                                  {headerInfo.partNo ? "Select Machine" : "Select Part No"}
                                </option>
                                {machineOptions.map((machine) => (
                                  <option key={machine.id} value={machine.machineNo}>
                                    {machine.machineNo}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td rowSpan={4} className="border border-gray-800 p-0">
                              <input
                                type="text"
                                className="w-full h-full text-center px-3 outline-none bg-transparent py-2 font-medium"
                                aria-label={`Block ${bIdx + 1} Error Proof No`}
                                placeholder="Error Proof No"
                                value={block.errorProofNo}
                                onChange={(e) => handleBlockMetaChange(bIdx, 'errorProofNo', e.target.value)}
                              />
                            </td>
                          </>
                        )}

                        {/* Parameter (Master Position) - Non-editable */}
                        <td className="border border-gray-800 p-0">
                          <div className="px-3 py-2 text-left text-gray-800 font-medium">
                            {param.masterPosition}
                          </div>
                        </td>

                        {/* Expected Status - Non-Editable */}
                        <td className="border border-gray-800 p-0">
                          <div className="px-3 py-2 text-left text-gray-800 font-medium">
                            {param.expectedStatus}
                          </div>
                        </td>

                        {/* Shift Status Dropdown */}
                        {SHIFTS.map((shift) => {
                          const val = paramShifts[shift] || "";
                          return (
                            <td key={`check-${bIdx}-${pIdx}-${shift}`} className="border border-gray-800 p-0">
                              <select
                                value={val}
                                onChange={(e) => handleCheckChange(bIdx, pIdx, shift, e.target.value)}
                                aria-label={`Status for ${param.masterPosition} Shift ${shift}`}
                                className="w-full h-full min-h-[38px] text-center font-bold text-base bg-transparent outline-none cursor-pointer"
                                disabled={lockedShifts[shift]}
                              >
                                <option value=""></option>
                                <option value="✓">✓</option>
                                <option value="X">X</option>
                              </select>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}

                  {/* LINE INCHARGE SIGNATURE Row */}
                  <tr>
                    <td colSpan={4} className="border border-gray-800 p-2 text-left px-3 font-bold bg-gray-50 text-gray-700">
                      Line Incharge Signature
                    </td>
                    {SHIFTS.map((shift) => (
                      <td key={`line-sign-${bIdx}-${shift}`} className="border border-gray-800 p-0">
                        <input
                          type="text"
                          className="w-full h-full text-center px-2 outline-none bg-transparent py-2 font-medium"
                          aria-label={`Block ${bIdx + 1} Line Incharge Signature Shift ${shift}`}
                          placeholder="Sign"
                          value={block.lineInchargeSignatures[headerInfo.date]?.[shift] || ""}
                          onChange={(e) => handleLineInchargeSignChange(bIdx, shift, e.target.value)}
                          disabled={lockedShifts[shift]}
                        />
                      </td>
                    ))}
                  </tr>
                </React.Fragment>
              ))}

              {/* SHIFT PRODUCTION INCHARGE SIGNATURE Row */}
              <tr>
                <td colSpan={4} className="border border-gray-800 p-2 text-left px-3 font-bold bg-gray-50 text-gray-700">
                  Shift Production Incharge Signature
                </td>
                {SHIFTS.map((shift) => (
                  <td key={`prod-sign-${shift}`} className="border border-gray-800 p-0">
                    <input
                      type="text"
                      className="w-full h-full text-center px-2 outline-none bg-transparent py-2 font-medium"
                      aria-label={`Shift Production Incharge Signature Shift ${shift}`}
                      placeholder="Sign"
                      value={shiftProdSignatures[headerInfo.date]?.[shift] || ""}
                      onChange={(e) => handleShiftProdSignChange(shift, e.target.value)}
                      disabled={lockedShifts[shift]}
                    />
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Notes & Legend Section */}
        <div className="border-2 border-gray-800 flex flex-col mt-4">
          <div className="px-2 py-1 font-bold text-gray-800 text-sm border-b border-gray-800 bg-gray-100">
            Note:
          </div>
          <div className="p-3 text-xs text-gray-700 space-y-1.5 leading-relaxed bg-white">
            <ol className="list-[lower-alpha] list-inside space-y-1">
              {notesList.map((note, idx) => (
                <li key={`note-${idx}`}>{note}</li>
              ))}
            </ol>
            <div className="pt-2 border-t border-gray-200 font-semibold text-gray-800">
              {legendText}
            </div>
          </div>
        </div>

        {/* Footer Meta Code & Save Button */}
        <div className="flex justify-end flex-col sm:flex-row justify-end items-center gap-4 mt-6 pt-4 border-t border-gray-300">

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || saveSuccess}
            className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white px-10 py-3 rounded font-bold transition-colors shadow-lg hover:cursor-pointer"
          >
            {isSaving
              ? "SAVING..."
              : saveSuccess
              ? "SAVED ✓"
              : "SAVE & CONTINUE"
            }
          </button>
        </div>

      </div>
    </div>
  );
}