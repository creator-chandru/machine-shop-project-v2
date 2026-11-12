import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLineSet } from "../context/LineSetContext.jsx";
import { FileDown, Calendar, X } from "lucide-react";
import Header from '../components/Header';

const SHIFTS = ["I", "II", "III"];

const initialFormData = {
  formCode: "QF/07/MPD-48",
  revision: "00",
  revisionDate: "24.09.2025",
  title: "CHECK LIST FOR ROBOT TO MANUAL AND MANUAL TO ROBOT CNC OPERATION",
  company: "SAKTHI AUTO"
};

const robotToManualChecks = [
  { sNo: 1, text: "Ensure the ROBOT to Safe or Home Position Without disturbance to operator." },
  { sNo: 2, text: "Ensure Emergency Button pressed on Both Teach Pendant Panel & control panel and then key to be removed, Then Switch off the Robot." },
  { sNo: 3, text: "Verify the CNC machine robot Keep Relay are disabled (Turning,Drilling,VMC Machine) through electrical maintenance team." },
  { sNo: 4, text: "Verify All incomplete machining part to be completed in the cell by manual operation." },
  { sNo: 5, text: "Ensure the CNC Machine program in 'M30' Command before 'Robot Calling' Program." },
  { sNo: 6, text: "Perform JSV and manually run CNC operations. Check the first part as per work instructions." }
];

const manualToRobotChecks = [
  { sNo: 1, text: "Ensure the robot Switched on and Emergency Button released on Both Teach pendant & Control pannel and place the key after take robot home position." },
  { sNo: 2, text: "Ensure the CNC machine is enabled robot keep Relay (Turning,Drilling,VMC) through electrical maintenance team." },
  { sNo: 3, text: "Ensure the 'M30' command is removed CNC machine program before 'Robot Calling' command." },
  { sNo: 4, text: "Ensure all part in Bore checking locators & Qualifying Fixtures are removed." },
  { sNo: 5, text: "Check the ROBOT Calling Program is Enabled and Ready to Unload Signal to robot." },
  { sNo: 6, text: "Follow Jsv and Run the ROBOT Cycle with 10% of Rapid. Robot Cycle runs smoothly, then Start Production with Robot Continuous cycle." }
];

const notesList = [
  "1. ✓ - good",
  "2. Verification should be carried out before the start of the first part trail."
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

export default function RobotManualTransitionCheckSheet() {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const { lineSet, setLineSet } = useLineSet();

  const [headerInfo, setHeaderInfo] = useState({
    lineCode: "",
    partName: "",
    partNo: "",
    date: getTodayISODate(),
    shift: "I"
  });

  const [lineMappings, setLineMappings] = useState([]);
  const [loadingLines, setLoadingLines] = useState(true);
  const [approverUsers, setApproverUsers] = useState([]);

  const [rToMChecks, setRToMChecks] = useState(robotToManualChecks.map(c => ({ ...c, status: '' })));
  const [mToRChecks, setMToRChecks] = useState(manualToRobotChecks.map(c => ({ ...c, status: '' })));

  const [verifiedBy, setVerifiedBy] = useState('');
  const [approvedBy, setApprovedBy] = useState('');
  const [isLocked, setIsLocked] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [toast, setToast] = useState({ message: '', type: '' });

  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfFromDate, setPdfFromDate] = useState('');
  const [pdfToDate, setPdfToDate] = useState('');
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const [qfHistory, setQfHistory] = useState([]);
  const [qfValue, setQfValue] = useState("QF/07/MPD-48, Rev.No: 00 dt 24.09.2025");

  const currentUser = JSON.parse(localStorage.getItem('user'))?.username || 'Unknown';

  const triggerToast = (message, type = 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: '', type: '' }), 4000);
  };

 // ✅ FETCH QF HISTORY ON MOUNT
  useEffect(() => {
    const fetchQf = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const baseUrl = process.env.REACT_APP_API_URL || "";

        // Direct call to the global QF history endpoint matching FORM_QF_TABLES key "robot-manual"
        let res = await fetch(`${baseUrl}/api/qf-values/history/robot-manual`, { headers });
        
        if (!res.ok) {
          res = await fetch(`${baseUrl}/api/robot-manual/qf-history`, { headers });
        }

        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setQfHistory(data);
          }
        }
      } catch (err) {
        console.error("Failed to load Robot Manual QF history:", err);
      }
    };
    fetchQf();
  }, []);

  useEffect(() => {
    let currentQf = "QF/07/MPD-48, Rev.No: 00 dt 24.09.2025";
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

        const mappingRes = await fetch(`${process.env.REACT_APP_API_URL}/api/mappings/${shopId}/lines`, { headers });
        if (mappingRes.ok) setLineMappings(await mappingRes.json());

        const appRes = await fetch(`${process.env.REACT_APP_API_URL}/api/robot-manual/approver/users`, { headers });
        if (appRes.ok) {
          const d = await appRes.json();
          setApproverUsers(d.approverList || []);
        }
      } catch (err) {
        triggerToast("Failed to load line mappings", "error");
      } finally {
        setLoadingLines(false);
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
        partNo: lineSet.partNo || ""
      }));
    }
  }, [lineSet]);

  const handleLineChange = (lineCode) => {
    const mapping = lineMappings.find((m) => m.lineCode === lineCode);
    setHeaderInfo(prev => ({
      ...prev,
      lineCode,
      partName: mapping?.partSet || "",
      partNo: mapping?.idSet || ""
    }));
    setLineSet({ machineShop: shopId, lineCode, partName: mapping?.partSet || "", partNo: mapping?.idSet || "" });
  };

  useEffect(() => {
    const fetchSaved = async () => {
      if (!shopId || !headerInfo.lineCode || !headerInfo.date || !headerInfo.shift) {
        setRToMChecks(robotToManualChecks.map(c => ({ ...c, status: '' })));
        setMToRChecks(manualToRobotChecks.map(c => ({ ...c, status: '' })));
        setVerifiedBy('');
        setApprovedBy('');
        setIsLocked(false);
        return;
      }
      try {
        const token = localStorage.getItem('token');
        const params = new URLSearchParams({
          machineShop: shopId,
          lineCode: headerInfo.lineCode,
          date: headerInfo.date,
          shift: headerInfo.shift
        });
        const res = await fetch(`${process.env.REACT_APP_API_URL}/api/robot-manual?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error();
        const rows = await res.json();
        if (!rows || rows.length === 0) {
          setRToMChecks(robotToManualChecks.map(c => ({ ...c, status: '' })));
          setMToRChecks(manualToRobotChecks.map(c => ({ ...c, status: '' })));
          setVerifiedBy('');
          setApprovedBy('');
          setIsLocked(false);
          return;
        }

        const rtmMap = new Map();
        const mtrMap = new Map();
        rows.forEach(r => {
          if (r.sectionType === 'ROBOT_TO_MANUAL') rtmMap.set(r.sNo, r.status);
          else mtrMap.set(r.sNo, r.status);
        });

        setRToMChecks(robotToManualChecks.map(c => ({ ...c, status: rtmMap.get(c.sNo) || '' })));
        setMToRChecks(manualToRobotChecks.map(c => ({ ...c, status: mtrMap.get(c.sNo) || '' })));

        const first = rows[0];
        setVerifiedBy(first.verifiedBy || '');
        let aSign = first.approvedBy || '';
        if (aSign.startsWith('Pending [')) aSign = aSign.replace('Pending [', '').replace(']', '');
        setApprovedBy(aSign);
        setIsLocked(Boolean(first.verifiedBy && first.approvedBy?.startsWith('Approved (')));
      } catch (e) {}
    };
    fetchSaved();
  }, [shopId, headerInfo.lineCode, headerInfo.date, headerInfo.shift]);

  const handleVerify = () => {
    if (isLocked) return;
    if (!headerInfo.lineCode) {
      triggerToast("Select Line Code first.", "error");
      return;
    }
    const hasAny = [...rToMChecks, ...mToRChecks].some(c => Boolean(c.status));
    if (!hasAny) {
      triggerToast("Please perform checks before verifying.", "error");
      return;
    }
    setVerifiedBy(currentUser);
    triggerToast("Verified successfully", "success");
  };

  const handleSave = async () => {
    if (!headerInfo.lineCode || !headerInfo.date || !headerInfo.shift) {
      triggerToast("Please select Line, Date and Shift.", "error");
      return;
    }
    if (!verifiedBy) {
      triggerToast("VERIFIED BY signature is required.", "error");
      return;
    }
    if (!approvedBy) {
      triggerToast("APPROVED BY is required.", "error");
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const token = localStorage.getItem('token');
      const payload = {
        header: { ...headerInfo, machineShop: shopId },
        rToMChecks,
        mToRChecks,
        verifiedBy,
        approvedBy
      };

      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/robot-manual`, {
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
      triggerToast("Please select both dates.", "error");
      return;
    }
    setIsDownloadingPdf(true);
    try {
      const token = localStorage.getItem("token");
      const params = new URLSearchParams({ fromDate: pdfFromDate, toDate: pdfToDate, shopId: String(shopId || 3) });
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/robot-manual/report?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to download report");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Robot_Manual_Transition_${pdfFromDate}_to_${pdfToDate}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setShowPdfModal(false);
      triggerToast("PDF downloaded!", "success");
    } catch (err) {
      triggerToast(err.message, "error");
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#2d2d2d] flex flex-col items-center justify-center p-6 pb-20">
      <Header />
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: '' })} />

      {/* Date Modal */}
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
            <select className="w-full border border-gray-300 p-2 rounded text-sm font-semibold bg-white" value={headerInfo.lineCode} onChange={e => handleLineChange(e.target.value)} disabled={loadingLines}>
              <option value="">Select Line Code</option>
              {lineMappings.map(m => (<option key={m.lineCode} value={m.lineCode}>{m.lineCode}</option>))}
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
          <div>
            <label className="font-bold text-gray-700 block mb-1 text-sm">Shift</label>
            <select className="w-full border p-2 rounded text-sm font-semibold bg-white" value={headerInfo.shift} onChange={e => setHeaderInfo(p => ({ ...p, shift: e.target.value }))}>
              {SHIFTS.map(s => <option key={s} value={s}>Shift {s}</option>)}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-800 text-sm">
            <thead>
              <tr className="bg-gray-100 text-gray-800 font-bold">
                <th className="border border-gray-800 p-2 w-16 text-center">S.NO</th>
                <th className="border border-gray-800 p-2 text-left px-4">CHECK POINTS DESCRIPTION</th>
                <th className="border border-gray-800 p-2 w-32 text-center">STATUS</th>
              </tr>
            </thead>
            <tbody>
              {/* SECTION 1 */}
              <tr className="bg-gray-200">
                <td colSpan={3} className="border border-gray-800 p-2 font-bold text-gray-800 text-center tracking-wide">
                  CHECK LIST FOR ROBOT TO MANUAL CNC OPERATION
                </td>
              </tr>
              {rToMChecks.map((item, idx) => (
                <tr key={`rtm-${idx}`}>
                  <td className="border border-gray-800 p-2 text-center font-bold">{item.sNo}</td>
                  <td className="border border-gray-800 p-2 px-4 font-medium">{item.text}</td>
                  <td className="border border-gray-800 p-0">
                    <select
                      value={item.status}
                      onChange={e => setRToMChecks(p => p.map(c => c.sNo === item.sNo ? { ...c, status: e.target.value } : c))}
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

              {/* SECTION 2 */}
              <tr className="bg-gray-200">
                <td colSpan={3} className="border border-gray-800 p-2 font-bold text-gray-800 text-center tracking-wide">
                  CHECK LIST FOR MANUAL CNC OPERATION TO ROBOT
                </td>
              </tr>
              {mToRChecks.map((item, idx) => (
                <tr key={`mtr-${idx}`}>
                  <td className="border border-gray-800 p-2 text-center font-bold">{item.sNo}</td>
                  <td className="border border-gray-800 p-2 px-4 font-medium">{item.text}</td>
                  <td className="border border-gray-800 p-0">
                    <select
                      value={item.status}
                      onChange={e => setMToRChecks(p => p.map(c => c.sNo === item.sNo ? { ...c, status: e.target.value } : c))}
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

              {/* VERIFIED BY */}
              <tr>
                <td colSpan={2} className="border border-gray-800 p-2 px-4 font-bold bg-gray-50">VERIFIED BY:</td>
                <td className="border border-gray-800 p-2 text-center bg-gray-50/30">
                  {verifiedBy ? (
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] font-bold text-green-600">Verified ✓</span>
                      <span className="text-xs font-black uppercase">{verifiedBy}</span>
                    </div>
                  ) : (
                    <button type="button" onClick={handleVerify} disabled={isLocked} className="text-[10px] font-bold px-3 py-1.5 rounded uppercase bg-orange-500 hover:bg-orange-600 text-white cursor-pointer">
                      Verify
                    </button>
                  )}
                </td>
              </tr>

              {/* APPROVED BY */}
              <tr>
                <td colSpan={2} className="border border-gray-800 p-2 px-4 font-bold bg-gray-50">APPROVED BY:</td>
                <td className="border border-gray-800 p-0 h-10 bg-gray-50/30">
                  {approvedBy?.startsWith('Approved (') ? (
                    <div className="flex flex-col items-center justify-center py-1">
                      <span className="text-[9px] font-bold text-green-600">Approved ✓</span>
                      <span className="text-[10px] font-black uppercase">{approvedBy.replace('Approved (', '').replace(')', '')}</span>
                    </div>
                  ) : (
                    <select
                      className="w-full h-full text-center px-1 outline-none bg-transparent font-medium cursor-pointer text-xs"
                      value={approvedBy}
                      onChange={e => setApprovedBy(e.target.value)}
                      disabled={isLocked}
                    >
                      <option value="">-- Assign Approver --</option>
                      {approverUsers.map((u, i) => (
                        <option key={i} value={u.username || u.name}>{(u.username || u.name).toUpperCase()}</option>
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