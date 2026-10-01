import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLineSet } from '../context/LineSetContext';
import Header from '../components/Header';

const initialFormData = {
  formCode: "QF/07/MPD-13",
  revision: "12",
  revisionDate: "31.01.2025",
  title: "CHECK LIST FOR PRE OPERATION AND PROCESS PARAMETERS",
  company: "SAKTHI AUTO",

  header: {
    lineCode: "",
    partName: "",
    partNo: "",
    machineNo: "",
    opNo: "",
    date: ""
  },

  parameters: [
    { slNo: 1, label: "System pressure", unit: "KGF/CM2", specification: "", specEditable: true, checkMethod: "PRESSURE GAUGE", hasSubRows: false },
    { slNo: 2, label: "Clamping pressure", unit: "KGF/CM2", specification: "", specEditable: true, checkMethod: "PRESSURE GAUGE", hasSubRows: false },
    { slNo: 3, label: "Orientation pressure", unit: "KGF/CM2", specification: "", specEditable: true, checkMethod: "PRESSURE GAUGE", hasSubRows: false },
    { slNo: 4, label: "PROGRAM NO", unit: "", specification: "", specEditable: true, checkMethod: "VISUAL", hasSubRows: false },
    { slNo: 5, label: "Hydraulic oil level", unit: "", note: "[Above the minimum level]", specification: "", specEditable: false, checkMethod: "LEVEL INDICATOR", hasSubRows: true, subRows: ["BEFORE", "AFTER"] },
    { slNo: 6, label: "Coolant oil level", unit: "", note: "[Above the minimum level]", specification: "", specEditable: false, checkMethod: "LEVEL INDICATOR", hasSubRows: true, subRows: ["BEFORE", "AFTER"] },
    { slNo: 7, label: "Lub oil Level", unit: "", note: "[Above the minimum level]", specification: "", specEditable: false, checkMethod: "LEVEL INDICATOR", hasSubRows: true, subRows: ["BEFORE", "AFTER"] },
    { slNo: 8, label: "Coolant oil ratio", unit: "", specification: "[3 TO 5]", specEditable: false, checkMethod: "REFRACTO METER", hasSubRows: true, subRows: ["BEFORE", "AFTER"] },
    { slNo: 9, label: "Air pressure Level", unit: "", specification: "MINIMUM 4 BAR", specEditable: false, checkMethod: "PRESSURE GAUGE", hasSubRows: false },
    { slNo: 10, label: "Fixture Condition", unit: "", specification: "Check - Dent, Damage, Orientation, Clamp & nut screw not to be in loose condition.", specEditable: false, checkMethod: "VISUAL", hasSubRows: false },
    { slNo: 11, label: "Andon Tower Lamp Condition", unit: "", specification: "Free from damage & Check indication light working condition", specEditable: false, checkMethod: "VISUAL", hasSubRows: false },
    { slNo: 12, label: "Double Hand switches, Limit switches, Safety sensors", unit: "", specification: "Good Working condition", specEditable: false, checkMethod: "Operate", hasSubRows: false }
  ],

  notes: [
    "Coolant TOP UP should be done ONLY in Ist shift. If there is any abnormalities or special requirement for coolant Top-up during OTHER SHIFTS, COOLANT COULD be Topped-up with proper approval and should be recorded in the respective LINE's LOG NOTE. After top-up, the coolant tank cover should be in closed condition.",
    "If any of the OIL Level is observed MINIMUM, then TOP UP the oil upto MIDDLE Level in the machine.",
    "If Coolant ratio is found to be less, add more. If the ratio is high, add more water for the ration 1:20.",
    "If Orientation is not available in the fixture, then mark NA.",
    "USE THE FOLLOWING ABBREVIATIONS: MIN - Minimum, MID - Middle, MAX - Maximum, NA - Not Applicable, NP - No Production",
    "During set-up change, the pre-operation and process parameters should be verified and recorded."
  ]
};

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

export default function PreOperationChecklist() {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const { lineSet, setLineSet } = useLineSet();
  
  const [headerInfo, setHeaderInfo] = useState({ ...initialFormData.header });
  const [values, setValues] = useState({});
  const [specifications, setSpecifications] = useState({});
  
  // State for signatures
  const [signatures, setSignatures] = useState({});
  
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [toast, setToast] = useState({ message: '', type: '' });

  // Get current logged in user name for auto-approval
  const currentUser = JSON.parse(localStorage.getItem('user'))?.username || 'Unknown';

  const triggerToast = (message, type = 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: '', type: '' }), 4000);
  };

  const [machineDetails, setMachineDetails] = useState([]);
  const [lineMappings, setLineMappings] = useState([]);
  const [loadingMachineDetails, setLoadingMachineDetails] = useState(true);

  // ==========================================================
  // DYNAMIC RENDER-TIME VALIDATION
  // ==========================================================
  const getValidationError = (slNo) => {
    if (![1, 2, 3].includes(slNo)) return null;
    
    const val = values[slNo];
    if (!val) return null;

    const spec = specifications[slNo] !== undefined 
      ? specifications[slNo] 
      : initialFormData.parameters.find(p => p.slNo === slNo)?.specification;
      
    if (!spec) return null;

    const parsedVal = parseFloat(val);
    if (isNaN(parsedVal)) return null;

    const rangeMatch = spec.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
    if (rangeMatch) {
      const min = parseFloat(rangeMatch[1]);
      const max = parseFloat(rangeMatch[2]);
      if (parsedVal < min) return `Min: ${min}`;
      if (parsedVal > max) return `Max: ${max}`;
    }
    
    return null;
  };

  // ==========================================================
  // FETCH MACHINE DETAILS & MAPPINGS
  // ==========================================================
  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!shopId) return;

        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };
        const machineRes = await fetch(`${process.env.REACT_APP_API_URL}/api/machine-shop/${shopId}/pre-operation-details`, { headers });
        if (machineRes.ok) {
          const machineData = await machineRes.json();
          setMachineDetails(machineData);
        }

        const mappingRes = await fetch(`${process.env.REACT_APP_API_URL}/api/mappings/${shopId}/lines`, { headers });
        if (mappingRes.ok) {
          const mappingData = await mappingRes.json();
          setLineMappings(mappingData);
        }
      } catch (err) {
        console.error('Data fetch error:', err);
        triggerToast('Failed to load required data.', 'error');
      } finally {
        setLoadingMachineDetails(false);
      }
    };
    fetchData();
  }, [shopId]);

  // ==========================================================
  // AUTO-FILL LATEST MACHINE PARAMETERS (slNo: 1, 2, 3, 4)
  // ==========================================================
  useEffect(() => {
    const fetchLatestParams = async () => {
      if (!shopId || !headerInfo.lineCode || !headerInfo.machineNo) return;

      try {
        const token = localStorage.getItem('token');
        
        const res = await fetch(
          `${process.env.REACT_APP_API_URL}/api/machine-shop/${shopId}/latest-params?lineCode=${headerInfo.lineCode}&machineNo=${headerInfo.machineNo}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (res.ok) {
          const data = await res.json();
          
          if (data && data.length > 0) {
            setSpecifications(prev => {
              const newSpecs = { ...prev };
              data.forEach(item => {
                newSpecs[item.slNo] = item.specification || '';
              });
              return newSpecs;
            });

            triggerToast("Latest specifications loaded.", "success");
          }
        }
      } catch (err) {
        console.error('Failed to fetch latest parameters:', err);
      }
    };

    fetchLatestParams();
  }, [shopId, headerInfo.lineCode, headerInfo.machineNo]);

  // ==========================================================
  // SYNC SHARED LINE SET
  // ==========================================================
  useEffect(() => {
    setHeaderInfo((prev) => ({
      ...prev,
      lineCode: lineSet?.lineCode || "",
      partName: lineSet?.partName || "",
      partNo: lineSet?.partNo || "",
      machineNo: lineSet?.machineNo || ""
    }));
  }, [lineSet]);

  // ==========================================================
  // OPTIONS CALCULATION
  // ==========================================================
  const lineCodes = lineMappings.length > 0 
    ? lineMappings.map(m => m.lineCode)
    : [...new Set(machineDetails.map(item => item.lineCode).filter(Boolean))];

  const machineOptionsRaw = machineDetails.filter((item) => item.lineCode === headerInfo.lineCode);
  
  const machineOptions = Array.from(new Set(machineOptionsRaw.map(m => m.machineNo)))
    .map(mNo => machineOptionsRaw.find(m => m.machineNo === mNo));

  // ==========================================================
  // HANDLERS
  // ==========================================================
  const handleHeaderChange = (field, val) => {
    setHeaderInfo((prev) => ({ ...prev, [field]: val }));
  };

  const handleLineChange = (lineCode) => {
    const mapping = lineMappings.find(m => m.lineCode === lineCode);
    const autoPartName = mapping?.partSet || "";
    const autoPartNo = mapping?.idSet || "";

    setValues({});
    setSpecifications({});
    setSignatures({}); // Reset signatures on line change

    setLineSet({
      machineShop: shopId,
      lineCode,
      partName: autoPartName,
      partNo: autoPartNo,
      machineNo: ""
    });
  };

  const handleMachineChange = (machineNo) => {
    setLineSet({
      machineShop: shopId,
      lineCode: headerInfo.lineCode,
      partName: headerInfo.partName,
      partNo: headerInfo.partNo,
      machineNo
    });
  };

  const handleSpecificationChange = (slNo, val) => {
    setSpecifications((prev) => ({ ...prev, [slNo]: val }));
  };

  const handleValueChange = (slNo, subRow, val) => {
    setValues((prev) => {
      if (subRow) {
        return { ...prev, [slNo]: { ...(prev[slNo] || {}), [subRow]: val } };
      }
      return { ...prev, [slNo]: val };
    });
  };

  // Button handler for auto-assigning the logged-in user to the signatures
  const handleApproveSignatures = () => {
    setSignatures({
      "Operator": currentUser,
      "Shift Incharge": currentUser
    });
    triggerToast("Form approved successfully", "success");
  };

  const handleSave = async () => {
    if (!lineSet.lineCode || !lineSet.partNo || !lineSet.machineNo) {
      triggerToast("Please select Line code and Machine No.", "error");
      return;
    }

    const hasErrors = [1, 2, 3].some(slNo => getValidationError(slNo) !== null);
    if (hasErrors) {
      triggerToast("Please fix the value ranges before saving.", "error");
      return;
    }

    // Ensure signatures are filled before saving
    if (!signatures["Operator"] || !signatures["Shift Incharge"]) {
      triggerToast("Please click 'Approve' to sign the form before saving.", "error");
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);

    const payload = {
      header: {
        ...headerInfo,
        machineShop: shopId,
        lineCode: lineSet.lineCode,
        partName: lineSet.partName,
        partNo: lineSet.partNo,
        machineNo: lineSet.machineNo
      },
      lineSet: { ...lineSet },
      values,
      signatures,
      specifications,
      parameters: initialFormData.parameters
    };

    try {
      const token = localStorage.getItem('token');

      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/pre-operation-checklist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Save failed');

      setLineSet({ ...lineSet, machineShop: shopId });

      setSaveSuccess(true);
      await new Promise(resolve => setTimeout(resolve, 2000));
      navigate(`/operator/${shopId}/error-proofing-checksheet`);

    } catch (err) {
      console.error('Save error:', err);
      triggerToast(err.message || 'Failed to save checklist.', 'error');
    } finally {
      setIsSaving(false);
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
        
        {/* HEADER AREA */}
        <div className="flex justify-between items-center mb-6 border-b border-gray-200 pb-4">
          <div>
            <span className="text-xs font-bold text-orange-600 tracking-wider uppercase block mb-1">{initialFormData.company}</span>
            <h2 className="text-2xl font-bold text-gray-800 uppercase tracking-wide">{initialFormData.title}</h2>
            <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-2">
              <span>Form Code: {initialFormData.formCode}</span> |
              <span>Revision: {initialFormData.revision}</span> |
              <span>Revision Date: {initialFormData.revisionDate}</span>
            </div>
          </div>
        </div>

        {/* CONTROLS */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
          <div>
            <label className="font-bold text-gray-700 block mb-1 text-sm">Line Code</label>
            <select
              className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm font-semibold bg-white"
              value={headerInfo.lineCode}
              onChange={(e) => handleLineChange(e.target.value)}
              disabled={loadingMachineDetails}
            >
              <option value="">{loadingMachineDetails ? "Loading..." : "Select Line Code"}</option>
              {lineCodes.map((lineCode) => (
                <option key={lineCode} value={lineCode}>{lineCode}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-bold text-gray-700 block mb-1 text-sm">Part No (Auto-filled)</label>
            <input 
              type="text"
              readOnly
              className="w-full border border-gray-300 p-2 rounded text-sm font-semibold bg-gray-100"
              value={headerInfo.partNo || ""}
              placeholder="Select line first"
            />
          </div>

          <div>
            <label className="font-bold text-gray-700 block mb-1 text-sm">Part Name (Auto-filled)</label>
            <input 
              type="text"
              readOnly
              className="w-full border border-gray-300 p-2 rounded text-sm font-semibold bg-gray-100"
              value={headerInfo.partName || ""}
              placeholder="Select line first"
            />
          </div>

          <div>
            <label className="font-bold text-gray-700 block mb-1 text-sm">Machine No</label>
            <select
              className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm font-semibold bg-white"
              value={headerInfo.machineNo}
              onChange={(e) => handleMachineChange(e.target.value)}
              disabled={!headerInfo.lineCode}
            >
              <option value="">Select Machine</option>
              {machineOptions.map((machine, index) => (
                <option key={index} value={machine.machineNo}>
                  {machine.machineNo} {machine.machineType ? ` - ${machine.machineType}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-bold text-gray-700 block mb-1 text-sm">OP No</label>
            <select
              className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm font-semibold bg-white"
              value={headerInfo.opNo}
              onChange={(e) => handleHeaderChange('opNo', e.target.value)}
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

          <div>
            <label className="font-bold text-gray-700 block mb-1 text-sm">Date</label>
            <input
              type="date"
              className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm font-semibold bg-white"
              value={headerInfo.date}
              onChange={(e) => handleHeaderChange('date', e.target.value)}
            />
          </div>
        </div>

        {/* TABLE */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-800 text-sm text-center">
            <thead className="bg-gray-100 text-gray-800 font-bold">
              <tr>
                <th className="border border-gray-800 p-2 w-16">Sl No</th>
                <th className="border border-gray-800 p-2 text-left px-3">Parameters</th>
                <th className="border border-gray-800 p-2 text-left px-3">Specification</th>
                <th className="border border-gray-800 p-2 w-28">Unit</th>
                <th className="border border-gray-800 p-2 w-36">Check Method</th>
                <th className="border border-gray-800 p-2 w-24">Condition</th>
                <th className="border border-gray-800 p-2 w-48">Value</th>
              </tr>
            </thead>
            <tbody>
              {initialFormData.parameters.map((param) => {
                
                const errorMsg = getValidationError(param.slNo);

                if (param.hasSubRows) {
                  return (
                    <React.Fragment key={`param-${param.slNo}`}>
                      {param.subRows.map((subRow, subIdx) => {
                        const cellValue = values[param.slNo]?.[subRow] || '';
                        return (
                          <tr key={`param-${param.slNo}-${subRow}`}>
                            {subIdx === 0 && (
                              <>
                                <td rowSpan={param.subRows.length} className="border border-gray-800 p-2 font-medium">{param.slNo}</td>
                                <td rowSpan={param.subRows.length} className="border border-gray-800 p-2 text-left px-3">
                                  <span className="font-medium">{param.label}</span>
                                  {param.note && <span className="text-xs text-gray-500 block mt-0.5">{param.note}</span>}
                                </td>
                                <td rowSpan={param.subRows.length} className="border border-gray-800 p-2 text-left px-3 text-gray-700">
                                  {param.specEditable ? (
                                    <input type="text" className="w-full h-full text-center outline-none bg-transparent py-1" value={specifications[param.slNo] || ''} onChange={(e) => handleSpecificationChange(param.slNo, e.target.value)} placeholder="Enter spec" />
                                  ) : (param.specification || '-')}
                                </td>
                                <td rowSpan={param.subRows.length} className="border border-gray-800 p-2 text-gray-700">{param.unit || '-'}</td>
                                <td rowSpan={param.subRows.length} className="border border-gray-800 p-2 text-gray-700">{param.checkMethod}</td>
                              </>
                            )}
                            <td className="border border-gray-800 p-2 bg-gray-50 font-semibold text-gray-600">{subRow}</td>
                            <td className="border border-gray-800 p-0">
                              {[5, 6, 7].includes(param.slNo) ? (
                                <select className="w-full h-full text-center outline-none bg-transparent py-2 cursor-pointer" value={cellValue} onChange={(e) => handleValueChange(param.slNo, subRow, e.target.value)}>
                                  <option value=""></option>
                                  <option value="MIN">MIN</option>
                                  <option value="MID">MID</option>
                                  <option value="MAX">MAX</option>
                                </select>
                              ) : (
                                <input type="text" className="w-full h-full text-center outline-none bg-transparent py-2" value={cellValue} onChange={(e) => handleValueChange(param.slNo, subRow, e.target.value)} />
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                }

                const cellValue = values[param.slNo] || '';
                return (
                  <tr key={`param-${param.slNo}`}>
                    <td className="border border-gray-800 p-2 font-medium">{param.slNo}</td>
                    <td className="border border-gray-800 p-2 text-left px-3">
                      <span className="font-medium">{param.label}</span>
                      {param.note && <span className="text-xs text-gray-500 block mt-0.5">{param.note}</span>}
                    </td>
                    <td className="border border-gray-800 p-2 text-left px-3 text-gray-700">
                      {param.specEditable ? (
                        <input type="text" className="w-full h-full text-center outline-none bg-transparent py-1" value={specifications[param.slNo] || ''} onChange={(e) => handleSpecificationChange(param.slNo, e.target.value)} placeholder="Enter spec" />
                      ) : (param.specification || '-')}
                    </td>
                    <td className="border border-gray-800 p-2 text-gray-700">{param.unit || '-'}</td>
                    <td className="border border-gray-800 p-2 text-gray-700">{param.checkMethod}</td>
                    <td className="border border-gray-800 p-2 text-gray-400">-</td>
                    <td className="border border-gray-800 p-0 relative align-middle">
                      {[4, 10, 11, 12].includes(param.slNo) ? (
                        <select className="w-full h-full text-center outline-none bg-transparent py-2 cursor-pointer" value={cellValue} onChange={(e) => handleValueChange(param.slNo, null, e.target.value)}>
                          <option value=""></option>
                          <option value="OK">OK</option>
                          <option value="NOT OK">NOT OK</option>
                        </select>
                      ) : (
                        <div className="flex flex-col items-center justify-center p-1 relative">
                          <input 
                            type="text" 
                            className={`w-full text-center outline-none bg-transparent py-1 ${errorMsg ? 'border-2 border-orange-500 rounded' : ''}`} 
                            value={cellValue} 
                            onChange={(e) => handleValueChange(param.slNo, null, e.target.value)} 
                          />
                          {errorMsg && (
                            <span className="text-red-500 text-xs font-bold w-full text-left pl-1">
                              {errorMsg}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}

              {/* Operator Signature Row */}
              <tr>
                <td colSpan={6} className="border border-gray-800 p-2 text-left px-3 font-bold bg-gray-50 text-gray-700">
                  Operator Signature
                </td>
                <td rowSpan={2} className="border border-gray-800 p-2 align-middle text-center bg-gray-50/30">
                  {signatures["Operator"] ? (
                    <div className="flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300">
                      <span className="text-xs font-bold text-green-600 mb-1">Approved By ✓</span>
                      <span className="text-sm font-black text-gray-900 uppercase">{signatures["Operator"]}</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleApproveSignatures}
                      className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-6 py-2 rounded shadow transition-all hover:scale-105 uppercase tracking-widest"
                    >
                      Approve
                    </button>
                  )}
                </td>
              </tr>

              {/* Shift Incharge Signature Row */}
              <tr>
                <td colSpan={6} className="border border-gray-800 p-2 text-left px-3 font-bold bg-gray-50 text-gray-700">
                  Shift Incharge Signature
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* NOTES & SAVE */}
        <div className="border-2 border-gray-800 flex flex-col mt-4">
          <div className="px-2 py-1 font-bold text-gray-800 text-sm border-b border-gray-800 bg-gray-100">Notes / Instructions:</div>
          <ol className="list-decimal list-inside p-3 text-xs text-gray-700 space-y-1.5 leading-relaxed bg-white">
            {initialFormData.notes.map((note, idx) => <li key={`note-${idx}`}>{note}</li>)}
          </ol>
        </div>

        <div className="flex justify-end gap-4 mt-6 pt-4 border-t border-gray-300">
          <button 
            type="button" 
            onClick={handleSave} 
            disabled={isSaving || saveSuccess} 
            className="bg-gray-800 hover:bg-gray-900 disabled:bg-gray-400 text-white px-10 py-3 rounded font-bold transition-colors shadow-lg hover:cursor-pointer uppercase tracking-wider text-sm"
          >
            {isSaving ? "SAVING..." : saveSuccess ? "SAVED ✓" : "SAVE & CONTINUE"}
          </button>
        </div>
      </div>
    </div>
  );
}