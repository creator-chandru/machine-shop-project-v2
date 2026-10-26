import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLineSet } from "../context/LineSetContext.jsx";
import { FileDown, Calendar, X } from "lucide-react";
import Header from '../components/Header';

const initialFormData = {
  formCode: "QF / 07 / MPD – 46",
  revision: "00",
  revisionDate: "01.03.2025",
  title: "ROBOT CONTROLS VERIFICATION CHECK LIST",
  company: "SAKTHI AUTO"
};

const defaultParameters = [
  // 1-6 Daily
  { sNo: 1, freq: 'DAILY', parameter: "PROGRAM NUMBER", spec: "-", method: "VISUAL" },
  { sNo: 2, freq: 'DAILY', parameter: "PART HOLDING GRIPPER UNIT - GRIPPER TIGHTNESS", spec: "GRIPPER TIGHTNESS", method: "ALLEN KEY" },
  { sNo: 3, freq: 'DAILY', parameter: "PART HOLDING GRIPPER UNIT - GRIPPER PAD WEARNESS", spec: "GRIPPER PAD WEARNESS", method: "MASTER RING" },
  { sNo: 4, freq: 'DAILY', parameter: "AIR PRESSURE LEVEL", spec: "MINIMUM 5 BAR", method: "PRESSURE GAUGE" },
  { sNo: 5, freq: 'DAILY', parameter: "CONVEYOR SENSOR WORKING CONDITION", spec: "PHOTO ELECTRIC SENSOR", method: "OPERATE" },
  { sNo: 6, freq: 'DAILY', parameter: "ANDON TOWER LAMP CONDITION", spec: "FREE FROM DAMAGE & CHECK INDICATION LIGHT WORKING CONDITION", method: "VISUAL" },
  // 7-12 Weekly
  { sNo: 7, freq: 'WEEKLY', parameter: "ROBOT CONTROL PANEL EMERGENCY SWITCH WORKING CONDITION", spec: "EMERGENCY PUSH BUTTON", method: "OPERATE" },
  { sNo: 8, freq: 'WEEKLY', parameter: "FENCING DOOR PENTANT BOX EMERGENCY SWITCH WORKING CONDITION", spec: "EMERGENCY PUSH BUTTON", method: "OPERATE" },
  { sNo: 9, freq: 'WEEKLY', parameter: "FENCING FRONT DOOR LIMIT SWITCH / KEY WORKING", spec: "-", method: "OPERATE" },
  { sNo: 10, freq: 'WEEKLY', parameter: "GRIPPER - 1 OPEN & CLOSE SENSOR", spec: "METAL PROXIMITY SENSOR", method: "MASTER RING" },
  { sNo: 11, freq: 'WEEKLY', parameter: "GRIPPER - 2 OPEN & CLOSE SENSOR", spec: "METAL PROXIMITY SENSOR", method: "MASTER RING" },
  { sNo: 12, freq: 'WEEKLY', parameter: "AIR GAUGE WORKING CONDITION", spec: "AS PER WORK INSTRUCTION", method: "OPERATE" }
];

const notesList = [
  "1) FREQUENCY : SI NUMBER 01 ~ 06 / DAILY 1ST SHIFT & DURING JOB SET-UP, SI NUMBER 07 ~ 12 / WEEKLY (EVERY MONDAY) & DURING JOB SET-UP.",
  "2) '✓' WORKING IN GOOD CONDITION. 'X' NOT WORKING (INFORM TO HOF-PRODUCTION).",
  "3) IF VERIFICATION GETS FAILED, DURING CHECKING INFORM TO HOF PRODUCTION & MAINTENANCE."
];

const getTodayISODate = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const Toast = ({ message, type, onClose }) => {
  if (!message) return null;
  const bgColor = type === 'error' ? 'bg-red-600' : type === 'success' ? 'bg-green-600' : 'bg-orange-600';
  return (
    <div className={`fixed bottom-6 right-6 z-50 ${bgColor} text-white px-5 py-3 rounded-lg shadow-2xl flex items-center gap-3 transition-all transform animate-bounce`}>
      <span className="text-sm font-semibold">{message}</span>
      <button onClick={onClose} className="ml-2 font-bold text-lg leading-none hover:text-gray-200">×</button>
    </div>
  );
};

export default function RobotControlsVerificationCheckSheet() {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const { lineSet, setLineSet } = useLineSet();

  const [headerInfo, setHeaderInfo] = useState({
    lineCode: "",
    machineNo: "",
    partName: "",
    partNo: "",
    date: getTodayISODate()
  });

  const [machineDetails, setMachineDetails] = useState([]);
  const [lineMappings, setLineMappings] = useState([]);
  const [loadingMachines, setLoadingMachines] = useState(true);
  const [hofUsers, setHofUsers] = useState([]);

  const [items, setItems] = useState(defaultParameters.map(p => ({ ...p, status: '' })));
  const [lineInchargeSignature, setLineInchargeSignature] = useState('');
  const [hofSignature, setHofSignature] = useState('');
  const [isLocked, setIsLocked] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [toast, setToast] = useState({ message: '', type: '' });

  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfFromDate, setPdfFromDate] = useState('');
  const [pdfToDate, setPdfToDate] = useState('');
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const [qfHistory, setQfHistory] = useState([]);
  const [qfValue, setQfValue] = useState("QF / 07 / MPD – 46, Rev.No: 00, dt: 01.03.2025");

  const currentUser = JSON.parse(localStorage.getItem('user'))?.username || 'Unknown';

  const triggerToast = (message, type = 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: '', type: '' }), 4000);
  };

  useEffect(() => {
    const fetchQf = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${process.env.REACT_APP_API_URL}/api/qf-values/history/robot-controls`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) setQfHistory(await res.json());
      } catch (err) {}
    };
    fetchQf();
  }, []);

  useEffect(() => {
    let currentQf = "QF / 07 / MPD – 46, Rev.No: 00, dt: 01.03.2025";
    if (headerInfo.date && qfHistory.length > 0) {
      const selectedDate = new Date(headerInfo.date);
      selectedDate.setHours(0, 0, 0, 0);
      for (let qf of qfHistory) {
        if (!qf.date) continue;
        const qfDate = new Date(qf.date);
        qfDate.setHours(0, 0, 0, 0);
        if (qfDate <= selectedDate) {
          currentQf = qf.qfValue;
          break;
        }
      }
    }
    setQfValue(currentQf);
  }, [headerInfo.date, qfHistory]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!shopId) return;
        const token = localStorage.getItem("token");
        const headers = { Authorization: `Bearer ${token}` };

        const machineRes = await fetch(`${process.env.REACT_APP_API_URL}/api/machine-shop/${shopId}/pre-operation-details`, { headers });
        if (machineRes.ok) setMachineDetails(await machineRes.json());

        const mappingRes = await fetch(`${process.env.REACT_APP_API_URL}/api/mappings/${shopId}/lines`, { headers });
        if (mappingRes.ok) setLineMappings(await mappingRes.json());

        const hofRes = await fetch(`${process.env.REACT_APP_API_URL}/api/robot-controls/hof/users`, { headers });
        if (hofRes.ok) {
          const d = await hofRes.json();
          setHofUsers(d.hofList || []);
        }
      } catch (err) {
        triggerToast("Failed to load details", "error");
      } finally {
        setLoadingMachines(false);
      }
    };
    fetchData();
  }, [shopId]);

  useEffect(() => {
    if (lineSet) {
      setHeaderInfo(prev => ({
        ...prev,
        lineCode: lineSet.lineCode || "",
        partName: lineSet.partName || "",
        partNo: lineSet.partNo || "",
        machineNo: lineSet.machineNo || ""
      }));
    }
  }, [lineSet]);

  const lineCodes = lineMappings.length > 0
    ? lineMappings.map(m => m.lineCode)
    : [...new Set(machineDetails.map(m => m.lineCode).filter(Boolean))];

  const machineOptions = machineDetails
    .filter(m => m.lineCode === headerInfo.lineCode)
    .map(m => m.machineNo)
    .filter((v, i, a) => v && a.indexOf(v) === i);

  const handleLineChange = (lineCode) => {
    const mapping = lineMappings.find((m) => m.lineCode === lineCode);
    setHeaderInfo(prev => ({
      ...prev,
      lineCode,
      machineNo: "",
      partName: mapping?.partSet || "",
      partNo: mapping?.idSet || ""
    }));
    setLineInchargeSignature('');
    setHofSignature('');
    setIsLocked(false);
    setItems(defaultParameters.map(p => ({ ...p, status: '' })));
  };

  useEffect(() => {
    const fetchSaved = async () => {
      if (!shopId || !headerInfo.lineCode || !headerInfo.machineNo || !headerInfo.date) {
        setItems(defaultParameters.map(p => ({ ...p, status: '' })));
        setLineInchargeSignature('');
        setHofSignature('');
        setIsLocked(false);
        return;
      }
      try {
        const token = localStorage.getItem('token');
        const params = new URLSearchParams({
          machineShop: shopId,
          lineCode: headerInfo.lineCode,
          machineNo: headerInfo.machineNo,
          date: headerInfo.date
        });
        const res = await fetch(`${process.env.REACT_APP_API_URL}/api/robot-controls?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error();
        const rows = await res.json();
        if (!rows || rows.length === 0) {
          setItems(defaultParameters.map(p => ({ ...p, status: '' })));
          setLineInchargeSignature('');
          setHofSignature('');
          setIsLocked(false);
          return;
        }

        const map = new Map(rows.map(r => [r.sNo, r.status]));
        setItems(defaultParameters.map(p => ({ ...p, status: map.get(p.sNo) || '' })));

        const first = rows[0];
        setLineInchargeSignature(first.lineInchargeSignature || '');
        let hSign = first.hofSignature || '';
        if (hSign.startsWith('Pending [')) hSign = hSign.replace('Pending [', '').replace(']', '');
        setHofSignature(hSign);
        setIsLocked(Boolean(first.lineInchargeSignature && first.hofSignature?.startsWith('Approved (')));
      } catch (e) {}
    };
    fetchSaved();
  }, [shopId, headerInfo.lineCode, headerInfo.machineNo, headerInfo.date]);

  const handleLineApprove = () => {
    if (isLocked) return;
    if (!headerInfo.lineCode || !headerInfo.machineNo) {
      triggerToast("Select Line Code and Machine No first.", "error");
      return;
    }
    // Items 1-6 are Daily (required). 7-12 are Weekly.
    const dailyFilled = items.filter(i => i.freq === 'DAILY').every(i => Boolean(i.status));
    if (!dailyFilled) {
      triggerToast("Please complete all daily check parameters (1 to 6) before approving.", "error");
      return;
    }
    setLineInchargeSignature(currentUser);
    triggerToast("Line Incharge approved", "success");
  };

  const handleSave = async () => {
    if (!headerInfo.lineCode || !headerInfo.machineNo || !headerInfo.date) {
      triggerToast("Please fill all header information.", "error");
      return;
    }
    if (!lineInchargeSignature) {
      triggerToast("Line Incharge approval is required.", "error");
      return;
    }
    if (!hofSignature) {
      triggerToast("Please assign HOF - Production.", "error");
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const token = localStorage.getItem('token');
      const payload = {
        header: { ...headerInfo, machineShop: shopId },
        items,
        lineInchargeSignature,
        hofSignature
      };

      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/robot-controls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("Save failed");

      setIsSaving(false);
      setSaveSuccess(true);
      await new Promise(r => setTimeout(r, 1500));
      navigate(`/shift-incharge/${shopId}`);
    } catch (err) {
      setIsSaving(false);
      triggerToast(err.message || "Failed to save", "error");
    }
  };

  const handleDownloadPdfRange = async () => {
    if (!pdfFromDate || !pdfToDate) {
      triggerToast("Select both dates.", "error");
      return;
    }
    setIsDownloadingPdf(true);
    try {
      const token = localStorage.getItem("token");
      const params = new URLSearchParams({ fromDate: pdfFromDate, toDate: pdfToDate, shopId: String(shopId || 3) });
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/robot-controls/report?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to download PDF report");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Robot_Controls_Report_${pdfFromDate}_to_${pdfToDate}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setShowPdfModal(false);
      triggerToast("PDF downloaded!", "success");
    } catch (e) {
      triggerToast(e.message, "error");
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#2d2d2d] flex flex-col items-center justify-center p-6 pb-20">
      <Header />
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: '' })} />

      {/* Date Range Modal */}
      {showPdfModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4 pb-2 border-b">
              <h3 className="text-lg font-bold">Download Report by Date Range</h3>
              <button onClick={() => setShowPdfModal(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4 mb-6">
              <div>
                <label className="font-bold text-xs">From Date</label>
                <input type="date" className="w-full border p-2 rounded" value={pdfFromDate} onChange={e => setPdfFromDate(e.target.value)} />
              </div>
              <div>
                <label className="font-bold text-xs">To Date</label>
                <input type="date" className="w-full border p-2 rounded" value={pdfToDate} onChange={e => setPdfToDate(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowPdfModal(false)} className="px-4 py-2 text-xs font-bold">Cancel</button>
              <button onClick={handleDownloadPdfRange} disabled={isDownloadingPdf} className="bg-gray-800 text-white px-5 py-2 rounded text-xs font-bold">
                {isDownloadingPdf ? "Downloading..." : "Download"}
              </button>
            </div>
          </div>
        </div>
      )}

      {(isSaving || saveSuccess) && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 text-center">
            {isSaving ? <h2 className="text-xl font-bold">Saving...</h2> : <h2 className="text-xl font-bold text-green-700">Saved Successfully!</h2>}
          </div>
        </div>
      )}

      <div className="bg-white w-full max-w-[90rem] rounded-xl p-8 shadow-2xl border-4 border-gray-100">
        <div className="flex justify-between items-center mb-6 border-b pb-4">
          <div>
            <span className="text-xs font-bold text-orange-600 tracking-wider uppercase block mb-1">{initialFormData.company}</span>
            <h2 className="text-2xl font-bold text-gray-800 uppercase tracking-wide">{initialFormData.title}</h2>
            <div className="text-xs text-gray-500 mt-1 font-bold">{qfValue}</div>
          </div>
          <button type="button" onClick={() => setShowPdfModal(true)} className="flex items-center gap-2 bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-lg font-bold text-xs uppercase shadow">
            <FileDown className="w-4 h-4" /> Download Report
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div>
            <label className="font-bold text-gray-700 block mb-1 text-sm">Line Code</label>
            <select className="w-full border p-2 rounded text-sm font-semibold bg-white" value={headerInfo.lineCode} onChange={e => handleLineChange(e.target.value)} disabled={loadingMachines}>
              <option value="">Select Line Code</option>
              {lineCodes.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="font-bold text-gray-700 block mb-1 text-sm">M/C Number</label>
            <select className="w-full border p-2 rounded text-sm font-semibold bg-white" value={headerInfo.machineNo} onChange={e => setHeaderInfo(p => ({ ...p, machineNo: e.target.value }))} disabled={!headerInfo.lineCode}>
              <option value="">Select Machine</option>
              {machineOptions.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="font-bold text-gray-700 block mb-1 text-sm">Part No</label>
            <input type="text" readOnly className="w-full border p-2 rounded text-sm bg-gray-100 font-semibold" value={headerInfo.partNo} />
          </div>
          <div>
            <label className="font-bold text-gray-700 block mb-1 text-sm">Part Name</label>
            <input type="text" readOnly className="w-full border p-2 rounded text-sm bg-gray-100 font-semibold" value={headerInfo.partName} />
          </div>
          <div>
            <label className="font-bold text-gray-700 block mb-1 text-sm">Date</label>
            <input type="date" className="w-full border p-2 rounded text-sm font-semibold bg-white" value={headerInfo.date} onChange={e => setHeaderInfo(p => ({ ...p, date: e.target.value }))} />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-800 text-sm">
            <thead>
              <tr className="bg-gray-100 text-gray-800 font-bold">
                <th className="border border-gray-800 p-2 w-16 text-center">S.NO</th>
                <th className="border border-gray-800 p-2 text-left px-4">CHECKING PARAMETERS</th>
                <th className="border border-gray-800 p-2 text-left px-4 w-72">SPECIFICATION</th>
                <th className="border border-gray-800 p-2 text-left px-4 w-48">CHECK METHOD</th>
                <th className="border border-gray-800 p-2 w-32 text-center">STATUS</th>
              </tr>
            </thead>
            <tbody>
              {/* Daily Section */}
              <tr className="bg-orange-50/50">
                <td colSpan={5} className="border border-gray-800 p-2 font-bold text-orange-950 uppercase text-xs">
                  Daily 1st Shift & During Job Set-up (Items 01 - 06)
                </td>
              </tr>
              {items.slice(0, 6).map((item) => (
                <tr key={item.sNo}>
                  <td className="border border-gray-800 p-2 text-center font-bold">{item.sNo}</td>
                  <td className="border border-gray-800 p-2 px-4 font-medium">{item.parameter}</td>
                  <td className="border border-gray-800 p-2 px-4 text-xs font-semibold">{item.spec}</td>
                  <td className="border border-gray-800 p-2 px-4 text-xs font-semibold">{item.method}</td>
                  <td className="border border-gray-800 p-0">
                    <select
                      value={item.status}
                      onChange={e => setItems(p => p.map(c => c.sNo === item.sNo ? { ...c, status: e.target.value } : c))}
                      className="w-full h-full min-h-[38px] text-center font-bold text-base bg-transparent outline-none cursor-pointer"
                      disabled={isLocked}
                    >
                      <option value=""></option>
                      <option value="✓">✓</option>
                      <option value="X">X</option>
                    </select>
                  </td>
                </tr>
              ))}

              {/* Weekly Section */}
              <tr className="bg-orange-50/50">
                <td colSpan={5} className="border border-gray-800 p-2 font-bold text-orange-950 uppercase text-xs">
                  Weekly (Every Monday) & During Job Set-up (Items 07 - 12)
                </td>
              </tr>
              {items.slice(6, 12).map((item) => (
                <tr key={item.sNo}>
                  <td className="border border-gray-800 p-2 text-center font-bold">{item.sNo}</td>
                  <td className="border border-gray-800 p-2 px-4 font-medium">{item.parameter}</td>
                  <td className="border border-gray-800 p-2 px-4 text-xs font-semibold">{item.spec}</td>
                  <td className="border border-gray-800 p-2 px-4 text-xs font-semibold">{item.method}</td>
                  <td className="border border-gray-800 p-0">
                    <select
                      value={item.status}
                      onChange={e => setItems(p => p.map(c => c.sNo === item.sNo ? { ...c, status: e.target.value } : c))}
                      className="w-full h-full min-h-[38px] text-center font-bold text-base bg-transparent outline-none cursor-pointer"
                      disabled={isLocked}
                    >
                      <option value=""></option>
                      <option value="✓">✓</option>
                      <option value="X">X</option>
                    </select>
                  </td>
                </tr>
              ))}

              {/* Line Incharge */}
              <tr>
                <td colSpan={4} className="border border-gray-800 p-2 px-4 font-bold bg-gray-50">CHECKED BY LINE INCHARGE</td>
                <td className="border border-gray-800 p-2 text-center bg-gray-50/30">
                  {lineInchargeSignature ? (
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] font-bold text-green-600">Checked ✓</span>
                      <span className="text-xs font-black uppercase">{lineInchargeSignature}</span>
                    </div>
                  ) : (
                    <button type="button" onClick={handleLineApprove} disabled={isLocked} className="text-[10px] font-bold px-3 py-1.5 rounded uppercase bg-orange-500 hover:bg-orange-600 text-white cursor-pointer">
                      Approve
                    </button>
                  )}
                </td>
              </tr>

              {/* HOF Production */}
              <tr>
                <td colSpan={4} className="border border-gray-800 p-2 px-4 font-bold bg-gray-50">VERIFIED BY HOF - PRODUCTION</td>
                <td className="border border-gray-800 p-0 h-10 bg-gray-50/30">
                  {hofSignature?.startsWith('Approved (') ? (
                    <div className="flex flex-col items-center justify-center py-1">
                      <span className="text-[9px] font-bold text-green-600">Verified ✓</span>
                      <span className="text-[10px] font-black uppercase">{hofSignature.replace('Approved (', '').replace(')', '')}</span>
                    </div>
                  ) : (
                    <select
                      className="w-full h-full text-center px-1 outline-none bg-transparent font-medium cursor-pointer text-xs"
                      value={hofSignature}
                      onChange={e => setHofSignature(e.target.value)}
                      disabled={isLocked}
                    >
                      <option value="">-- Assign HOF --</option>
                      {hofUsers.map((h, i) => (
                        <option key={i} value={h.username || h.name}>{(h.username || h.name).toUpperCase()}</option>
                      ))}
                    </select>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="border-2 border-gray-800 flex flex-col mt-4">
          <div className="px-2 py-1 font-bold text-gray-800 text-sm border-b border-gray-800 bg-gray-100">Note:</div>
          <div className="p-3 text-xs text-gray-700 space-y-1 font-medium bg-white">
            {notesList.map((n, i) => <div key={i}>{n}</div>)}
          </div>
        </div>

        <div className="flex justify-end mt-6 pt-4 border-t border-gray-300">
          <button type="button" onClick={handleSave} disabled={isSaving || saveSuccess} className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white px-10 py-3 rounded font-bold cursor-pointer">
            {isSaving ? "SAVING..." : saveSuccess ? "SAVED ✓" : "SAVE & CONTINUE"}
          </button>
        </div>
      </div>
    </div>
  );
}