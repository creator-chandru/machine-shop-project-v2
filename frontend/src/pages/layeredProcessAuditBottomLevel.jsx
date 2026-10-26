import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLineSet } from "../context/LineSetContext.jsx";
import { FileDown, Calendar, X } from "lucide-react";
import Header from '../components/Header';

const initialFormData = {
  formCode: "QF/08/MRO - 18",
  revision: "02",
  revisionDate: "01.01.2022",
  title: "LAYERED PROCESS AUDIT - BOTTOM LEVEL",
  company: "SAKTHI AUTO"
};

const defaultCheckPoints = [
  { sNo: 1, checkPoint: "Is SOP/ Work Instruction Available?" },
  { sNo: 2, checkPoint: "Is Skill matrix available in shop floor?" },
  { sNo: 3, checkPoint: "Is the operator are wearing PPEs?" },
  { sNo: 4, checkPoint: "Verify the 5S implementation in Work Place? (Equipment / Machine Cleanliness, etc.,)" },
  { sNo: 5, checkPoint: "Is there Calibrated gauges are available in shop floor?" },
  { sNo: 6, checkPoint: "Is Identification system followed in shop floor?" },
  { sNo: 7, checkPoint: "Ensure the Error proof working condition?" },
  { sNo: 8, checkPoint: "Are Pre-operation checks point completed?" },
  { sNo: 9, checkPoint: "Is Quality checks performed ? (CC/SC Characteristics)" },
  { sNo: 10, checkPoint: "Are Quality alert visible on the floor?" },
  { sNo: 11, checkPoint: "Ensure the previous NC status? (if applicable)" },
  { sNo: 12, checkPoint: "Are all the process parameters followed as per SOP/WI?" }
];

const notesList = [
  "✓ : OK  |  X : NOT OK",
  "CA - Corrected during Audit",
  "NA - Not Applicable",
  "Remarks : If Nonconformity please write on NCR format"
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
      <button onClick={onClose} className="ml-2 font-bold text-lg leading-none hover:text-gray-200 focus:outline-none">×</button>
    </div>
  );
};

export default function LayeredProcessAuditBottomLevel() {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const { lineSet, setLineSet } = useLineSet();

  const [headerInfo, setHeaderInfo] = useState({
    lineCode: "",
    partName: "",
    partNo: "",
    date: getTodayISODate()
  });

  const [lineMappings, setLineMappings] = useState([]);
  const [loadingLines, setLoadingLines] = useState(true);
  const [hofUsers, setHofUsers] = useState([]);

  const [checks, setChecks] = useState(defaultCheckPoints.map(c => ({ ...c, status: '', remarks: '' })));
  const [supervisorSignature, setSupervisorSignature] = useState('');
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
  const [qfValue, setQfValue] = useState("QF/08/MRO - 18, Rev No: 02 dt 01.01.2022");

  const currentUser = JSON.parse(localStorage.getItem('user'))?.username || 'Unknown';

  const triggerToast = (message, type = 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: '', type: '' }), 4000);
  };

  useEffect(() => {
    const fetchQfHistory = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${process.env.REACT_APP_API_URL}/api/qf-values/history/lpa-bottom`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) setQfHistory(await res.json());
      } catch (err) {
        console.error("Failed to load QF history", err);
      }
    };
    fetchQfHistory();
  }, []);

  useEffect(() => {
    let currentQf = "QF/08/MRO - 18, Rev No: 02 dt 01.01.2022";
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
    } else if (qfHistory.length > 0) {
      currentQf = qfHistory[0].qfValue;
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

        const hofRes = await fetch(`${process.env.REACT_APP_API_URL}/api/lpa-bottom/hof/users`, { headers });
        if (hofRes.ok) {
          const d = await hofRes.json();
          setHofUsers(d.hofList || []);
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
    const autoPartName = mapping?.partSet || "";
    const autoPartNo = mapping?.idSet || "";

    setIsLocked(false);
    setSupervisorSignature('');
    setHofSignature('');
    setChecks(defaultCheckPoints.map(c => ({ ...c, status: '', remarks: '' })));

    setHeaderInfo(prev => ({ ...prev, lineCode, partName: autoPartName, partNo: autoPartNo }));
    setLineSet({ machineShop: shopId, lineCode, partName: autoPartName, partNo: autoPartNo });
  };

  useEffect(() => {
    const fetchSavedData = async () => {
      if (!shopId || !headerInfo.lineCode || !headerInfo.date) {
        setChecks(defaultCheckPoints.map(c => ({ ...c, status: '', remarks: '' })));
        setSupervisorSignature('');
        setHofSignature('');
        setIsLocked(false);
        return;
      }

      try {
        const token = localStorage.getItem('token');
        const params = new URLSearchParams({
          machineShop: shopId,
          lineCode: headerInfo.lineCode,
          date: headerInfo.date
        });

        const res = await fetch(`${process.env.REACT_APP_API_URL}/api/lpa-bottom?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("Failed to load records");

        const rows = await res.json();
        if (!Array.isArray(rows) || rows.length === 0) {
          setChecks(defaultCheckPoints.map(c => ({ ...c, status: '', remarks: '' })));
          setSupervisorSignature('');
          setHofSignature('');
          setIsLocked(false);
          return;
        }

        const map = new Map(rows.map(r => [r.sNo, r]));
        setChecks(defaultCheckPoints.map(c => {
          const match = map.get(c.sNo);
          return { ...c, status: match?.status || '', remarks: match?.remarks || '' };
        }));

        const first = rows[0];
        setSupervisorSignature(first.supervisorSignature || '');
        let hSign = first.hofSignature || '';
        if (hSign.startsWith('Pending [')) {
          hSign = hSign.replace('Pending [', '').replace(']', '');
        }
        setHofSignature(hSign);
        setIsLocked(Boolean(first.supervisorSignature && first.hofSignature?.startsWith('Approved (')));
      } catch (err) {
        console.error("Saved LPA data fetch error:", err);
      }
    };
    fetchSavedData();
  }, [shopId, headerInfo.lineCode, headerInfo.date]);

  const handleStatusChange = (sNo, val) => {
    if (isLocked) return;
    setChecks(prev => prev.map(c => c.sNo === sNo ? { ...c, status: val } : c));
  };

  const handleSupervisorApprove = () => {
    if (isLocked) return;
    if (!headerInfo.lineCode || !headerInfo.date) {
      triggerToast("Please select Process / Line Name and Date first.", "error");
      return;
    }
    const hasStatus = checks.every(c => Boolean(c.status));
    if (!hasStatus) {
      triggerToast("Please fill all check points before approving.", "error");
      return;
    }
    setSupervisorSignature(currentUser);
    triggerToast("Supervisor approved successfully", "success");
  };

  const handleSave = async () => {
    if (!headerInfo.lineCode || !headerInfo.date) {
      triggerToast("Please select Line and Date.", "error");
      return;
    }

    const hasAnyStatus = checks.some(c => Boolean(c.status));
    if (!hasAnyStatus) {
      triggerToast("Please complete at least one check point before saving.", "error");
      return;
    }

    if (!supervisorSignature) {
      triggerToast("Supervisor Signature is required.", "error");
      return;
    }

    if (!hofSignature) {
      triggerToast("Please assign Head of Facility (HOF).", "error");
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const token = localStorage.getItem('token');
      const payload = {
        header: { ...headerInfo, machineShop: shopId },
        checks,
        supervisorSignature,
        hofSignature
      };

      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/lpa-bottom`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("Failed to save data");

      setIsSaving(false);
      setSaveSuccess(true);
      await new Promise(r => setTimeout(r, 1500));
      navigate(`/shift-incharge/${shopId}`);
    } catch (err) {
      setIsSaving(false);
      triggerToast(err.message || "Failed to save checksheet", "error");
    }
  };

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
      const token = localStorage.getItem("token");
      const params = new URLSearchParams({
        fromDate: pdfFromDate,
        toDate: pdfToDate,
        shopId: String(shopId || 3)
      });
      const url = `${process.env.REACT_APP_API_URL}/api/lpa-bottom/report?${params.toString()}`;
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (response.status === 404) throw new Error("No records found for the selected date range.");
      if (!response.ok) throw new Error("Failed to download PDF report");

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `LPA_Bottom_Level_Report_${pdfFromDate}_to_${pdfToDate}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      setShowPdfModal(false);
      triggerToast("PDF generated and downloaded successfully!", "success");
    } catch (err) {
      triggerToast(err.message || "Failed to download PDF", "error");
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
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md border-2 border-gray-100 animate-in fade-in">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-orange-500" />
                <h3 className="text-lg font-bold text-gray-800 uppercase tracking-wide">Download Report by Date Range</h3>
              </div>
              <button type="button" onClick={() => setShowPdfModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4 mb-6">
              <div>
                <label className="font-bold text-gray-700 block mb-1 text-xs uppercase tracking-wider">From Date</label>
                <input type="date" className="w-full border border-gray-300 p-2.5 rounded text-sm font-semibold" value={pdfFromDate} onChange={e => setPdfFromDate(e.target.value)} />
              </div>
              <div>
                <label className="font-bold text-gray-700 block mb-1 text-xs uppercase tracking-wider">To Date</label>
                <input type="date" className="w-full border border-gray-300 p-2.5 rounded text-sm font-semibold" value={pdfToDate} onChange={e => setPdfToDate(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowPdfModal(false)} className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
              <button type="button" onClick={handleDownloadPdfRange} disabled={isDownloadingPdf} className="flex items-center gap-2 bg-gray-800 hover:bg-gray-900 disabled:bg-gray-400 text-white px-5 py-2 rounded font-bold text-xs uppercase tracking-wider">
                <FileDown className="w-4 h-4" />
                {isDownloadingPdf ? "Downloading..." : "Download Report"}
              </button>
            </div>
          </div>
        </div>
      )}

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
            <span className="text-xs font-bold text-orange-600 tracking-wider uppercase block mb-1">{initialFormData.company}</span>
            <h2 className="text-2xl font-bold text-gray-800 uppercase tracking-wide">{initialFormData.title}</h2>
            <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-2 font-bold">
              <span>{qfValue}</span>
            </div>
          </div>
          <button type="button" onClick={() => setShowPdfModal(true)} className="flex items-center gap-2 bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider shadow">
            <FileDown className="w-4 h-4" /> Download Report
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div>
            <label className="font-bold text-gray-700 block mb-1 text-sm">Process / Line Name</label>
            <select className="w-full border border-gray-300 p-2 rounded text-sm font-semibold bg-white" value={headerInfo.lineCode} onChange={e => handleLineChange(e.target.value)} disabled={loadingLines}>
              <option value="">{loadingLines ? "Loading..." : "Select Line Code"}</option>
              {lineMappings.map(m => (<option key={m.lineCode} value={m.lineCode}>{m.lineCode}</option>))}
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
            <input type="date" className="w-full border border-gray-300 p-2 rounded text-sm font-semibold bg-white" value={headerInfo.date} onChange={e => setHeaderInfo(prev => ({ ...prev, date: e.target.value }))} />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-800 text-sm text-center">
            <thead className="bg-gray-100 text-gray-800 font-bold">
              <tr>
                <th className="border border-gray-800 p-2 w-16">S.No</th>
                <th className="border border-gray-800 p-2 text-left px-4">Check Points</th>
                <th className="border border-gray-800 p-2 w-48">Status</th>
              </tr>
            </thead>
            <tbody>
              {checks.map(item => (
                <tr key={item.sNo}>
                  <td className="border border-gray-800 p-2 font-bold">{item.sNo}</td>
                  <td className="border border-gray-800 p-2 text-left px-4 font-medium text-gray-800">{item.checkPoint}</td>
                  <td className="border border-gray-800 p-0">
                    <select
                      value={item.status}
                      onChange={e => handleStatusChange(item.sNo, e.target.value)}
                      className="w-full h-full min-h-[38px] text-center font-bold text-base bg-transparent outline-none cursor-pointer"
                      disabled={isLocked}
                    >
                      <option value=""></option>
                      <option value="✓">✓ (OK)</option>
                      <option value="X">X (NOT OK)</option>
                      <option value="CA">CA (Corrected during Audit)</option>
                      <option value="NA">NA (Not Applicable)</option>
                    </select>
                  </td>
                </tr>
              ))}

              {/* Supervisor Sign */}
              <tr>
                <td colSpan={2} className="border border-gray-800 p-2 text-left px-4 font-bold bg-gray-50 text-gray-700">
                  Supervisor Sign
                </td>
                <td className="border border-gray-800 p-2 text-center bg-gray-50/30">
                  {supervisorSignature ? (
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] font-bold text-green-600">Approved ✓</span>
                      <span className="text-xs font-black uppercase">{supervisorSignature}</span>
                    </div>
                  ) : (
                    <button type="button" onClick={handleSupervisorApprove} disabled={isLocked} className="text-[10px] font-bold px-3 py-1.5 rounded uppercase tracking-widest bg-orange-500 hover:bg-orange-600 text-white cursor-pointer">
                      Approve
                    </button>
                  )}
                </td>
              </tr>

              {/* HOF Sign */}
              <tr>
                <td colSpan={2} className="border border-gray-800 p-2 text-left px-4 font-bold bg-gray-50 text-gray-700">
                  HOF Sign (Head of Facility)
                </td>
                <td className="border border-gray-800 p-0 h-10 bg-gray-50/30">
                  {hofSignature?.startsWith('Approved (') ? (
                    <div className="flex flex-col items-center justify-center py-1">
                      <span className="text-[9px] font-bold text-green-600 mb-0.5">Verified ✓</span>
                      <span className="text-[10px] font-black uppercase text-gray-800">
                        {hofSignature.replace('Approved (', '').replace(')', '')}
                      </span>
                    </div>
                  ) : (
                    <select
                      className="w-full h-full text-center px-1 outline-none bg-transparent font-medium cursor-pointer text-xs"
                      value={hofSignature}
                      onChange={e => setHofSignature(e.target.value)}
                      disabled={isLocked}
                    >
                      <option value="">-- Assign HOF --</option>
                      {hofUsers.map((h, idx) => {
                        const uname = h.username || h.employeeId || h.name;
                        return <option key={idx} value={uname}>{uname.toUpperCase()}</option>;
                      })}
                    </select>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="border-2 border-gray-800 flex flex-col mt-4">
          <div className="px-2 py-1 font-bold text-gray-800 text-sm border-b border-gray-800 bg-gray-100">Note:</div>
          <div className="p-3 text-xs text-gray-700 space-y-1.5 leading-relaxed bg-white">
            <ul className="list-disc list-inside space-y-1 font-medium">
              {notesList.map((note, idx) => (<li key={`note-${idx}`}>{note}</li>))}
            </ul>
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