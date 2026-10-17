import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FileDown, Plus, Trash2, ArrowLeft, Calendar, X, CheckCircle2, Info } from 'lucide-react';
import Header from '../components/Header';

const formMeta = {
  formCode: "QF/08/MRO-04",
  revision: "03",
  revisionDate: "20.08.2024",
  title: "CORRECTIVE ACTION REGISTER",
  company: "SAKTHI AUTO",
  categoryLegend: [
    { code: "A", description: "More than 5 parts in same defect in a single day (Machining)" },
    { code: "B", description: "Repeated rejections" },
    { code: "C", description: "A single defect in Customer specified characteristics (Special / Critical / Safety Characteristics)" },
    { code: "D", description: "A single defect due to Crack and part broken." },
    { code: "E", description: "Any new defect occurred." }
  ]
};

const createFreshRow = () => ({
  date: new Date().toISOString().split('T')[0],
  partName: "",
  problemDescription: "",
  problemCategory: "",
  quantity: 1,
  rootCause: "",
  correctiveAction: "",
  result: "OK",
  signature: ""
});

const Toast = ({ message, type, onClose }) => {
  if (!message) return null;

  const bgColor =
    type === 'error'
      ? 'bg-red-600'
      : type === 'success'
        ? 'bg-green-600'
        : 'bg-orange-600';

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 ${bgColor} text-white px-5 py-3.5 rounded-xl shadow-2xl flex items-center gap-3 transition-all animate-bounce border border-black/10`}
    >
      <span className="text-sm font-semibold tracking-wide">{message}</span>
      <button
        onClick={onClose}
        className="ml-2 p-1 font-bold text-lg leading-none hover:text-gray-200 focus:outline-none transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export default function CorrectiveActionRegister() {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const actualShopId = shopId || '3';

  const [partNameOptions, setPartNameOptions] = useState([]);
  const [loadingPartNames, setLoadingPartNames] = useState(false);
  const [productEngineers, setProductEngineers] = useState([]);
  const [entries, setEntries] = useState([createFreshRow()]);

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [toast, setToast] = useState({ message: '', type: '' });
  const [isSavedRecord, setIsSavedRecord] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfFromDate, setPdfFromDate] = useState("");
  const [pdfToDate, setPdfToDate] = useState("");
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  // Dynamic QF States
  const [qfHistory, setQfHistory] = useState([]);
  const [qfValue, setQfValue] = useState("QF/08/MRO-04, Rev. No.:03 dt 20.08.2024");

  const triggerToast = (message, type = 'error') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast({ message: '', type: '' });
    }, 4000);
  };

  // Fetch Part Names
  useEffect(() => {
    const fetchPartNames = async () => {
      try {
        setLoadingPartNames(true);
        const token = localStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const res = await fetch(
          `${process.env.REACT_APP_API_URL || ""}/api/corrective-action-register/part-names/${actualShopId}`,
          { headers }
        );

        if (!res.ok) return;

        const data = await res.json();
        let receivedPartNames = [];

        if (Array.isArray(data)) {
          receivedPartNames = data;
        } else if (data && Array.isArray(data.partNames)) {
          receivedPartNames = data.partNames;
        } else if (data && Array.isArray(data.data)) {
          receivedPartNames = data.data;
        }

        const cleanedPartNames = receivedPartNames
          .map((part) => {
            if (typeof part === 'string') return part;
            if (part && typeof part === 'object' && typeof part.partName === 'string') {
              return part.partName;
            }
            return null;
          })
          .filter(Boolean);

        if (cleanedPartNames.length > 0) {
          setPartNameOptions(cleanedPartNames);
        }
      } catch (err) {
        console.warn('Part names fetch error, using fallback list:', err);
      } finally {
        setLoadingPartNames(false);
      }
    };

    fetchPartNames();
  }, [actualShopId]);

  // Fetch QF History on Mount
  useEffect(() => {
    const fetchQfHistory = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(
          `${process.env.REACT_APP_API_URL || ""}/api/qf-values/history/corrective-action-register`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} }
        );

        if (res.ok) {
          const historyData = await res.json();
          setQfHistory(historyData);
        }
      } catch (err) {
        console.error("Failed to load QF history", err);
      }
    };
    fetchQfHistory();
  }, []);

  // Calculate QF based on selected Date (Effective Date Logic)
  useEffect(() => {
    let currentQf = "QF/08/MRO-04, Rev. No.:03 dt 20.08.2024";
    const targetRowDate = entries[0]?.date;

    if (targetRowDate && qfHistory.length > 0) {
      const selectedDate = new Date(targetRowDate);
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
  }, [entries, qfHistory]);

  // Fetch Product Engineers
  useEffect(() => {
    const fetchProductEngineers = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(
          `${process.env.REACT_APP_API_URL || ""}/api/corrective-action-register/product-engineers`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} }
        );
        if (!res.ok) throw new Error('Unable to load Product Engineers');
        const data = await res.json();
        setProductEngineers(Array.isArray(data.peList) ? data.peList : []);
      } catch (err) {
        console.warn('Product Engineer fetch error:', err);
        triggerToast('Unable to load Product Engineers. Please try again.', 'error');
      }
    };

    fetchProductEngineers();
  }, []);

  const handleRowChange = (index, field, val) => {
    if (isSavedRecord) return;
    setEntries((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [field]: val
      };
      return updated;
    });
  };

  const handleAddRow = () => {
    if (isSavedRecord) return;
    setEntries((prev) => [...prev, createFreshRow()]);
  };

  const handleDeleteLastRow = () => {
    if (isSavedRecord) return;
    if (entries.length <= 1) {
      triggerToast("Form must have at least one entry.", "error");
      return;
    }
    setEntries((prev) => prev.slice(0, -1));
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
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const params = new URLSearchParams({
        fromDate: pdfFromDate,
        toDate: pdfToDate,
        shopId: String(actualShopId)
      });

      const res = await fetch(
        `${process.env.REACT_APP_API_URL || ""}/api/corrective-action-register/report?${params.toString()}`,
        { headers }
      );

      if (!res.ok) {
        let errorMessage = "PDF report generation failed";
        try {
          const errorData = await res.json();
          if (errorData.message) errorMessage = errorData.message;
        } catch {}
        throw new Error(errorMessage);
      }

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `Corrective_Action_Register_${pdfFromDate}_to_${pdfToDate}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);

      setShowPdfModal(false);
      triggerToast("PDF generated and downloaded!", "success");
    } catch (err) {
      console.error("PDF generation error:", err);
      triggerToast(err.message || "Failed to generate PDF", "error");
    } finally { setIsDownloadingPdf(false); }
  };

  const handleSave = async () => {
    if (isSavedRecord) {
      triggerToast("This record has already been submitted and locked.", "error");
      return;
    }

    const emptyEntries = entries.some(
      (e) =>
        !e.date ||
        !e.partName ||
        !e.problemDescription ||
        !e.problemCategory ||
        !e.rootCause ||
        !e.correctiveAction
    );

    if (emptyEntries) {
      triggerToast(
        "Please fill in Date, Part Name, Problem Description, Category, Root Cause, and Corrective Action for all rows.",
        "error"
      );
      return;
    }

    if (entries.some((e) => !e.date)) {
      triggerToast("Please select the Date for every row.", "error");
      return;
    }
    if (entries.some((e) => !e.partName)) {
      triggerToast("Please select the Part Name for every row.", "error");
      return;
    }
    if (entries.some((e) => !e.productEngineer)) {
      triggerToast("Please select a Product Engineer in the Signature field for every row.", "error");
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);

    const cleanEntries = entries.map((entry) => ({
      date: entry.date,
      partName:
        typeof entry.partName === 'object' && entry.partName !== null
          ? entry.partName.partName || ""
          : entry.partName || "",
      problemDescription: entry.problemDescription || "",
      problemCategory: entry.problemCategory || "",
      quantity:
        entry.quantity === "" || entry.quantity === null || entry.quantity === undefined
          ? 1
          : Number(entry.quantity),
      rootCause: entry.rootCause || "",
      correctiveAction: entry.correctiveAction || "",
      result: entry.result || "OK",
      signature: entry.signature || "",
      productEngineer: entry.productEngineer || ""
    }));

    const payload = {
      machineShop: Number(actualShopId),
      recordDate: cleanEntries[0]?.date || "",
      partName: cleanEntries[0]?.partName || "",
      entries: cleanEntries,
      formCode: formMeta.formCode,
      revision: formMeta.revision,
      revisionDate: formMeta.revisionDate
    };

    try {
      const token = localStorage.getItem('token');
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      };

      const res = await fetch(
        `${process.env.REACT_APP_API_URL || ""}/api/corrective-action-register`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        }
      );

      let responseData = null;
      try {
        responseData = await res.json();
      } catch {
        responseData = null;
      }

      if (!res.ok) {
        throw new Error(
          responseData?.message || responseData?.error || `Save failed (${res.status})`
        );
      }

      setIsSavedRecord(true);
      setSaveSuccess(true);
      triggerToast("Corrective Action Register submitted and routed for Product Engineer approval!", "success");

      await new Promise((resolve) => setTimeout(resolve, 1500));
      navigate(`/shift-incharge/${actualShopId}`);
    } catch (err) {
      console.error('Save error:', err);
      triggerToast(err.message || 'Failed to save register.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#2d2d2d] flex flex-col items-center justify-start p-3 sm:p-6 lg:p-8 font-sans antialiased">
      <Header />

      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ message: '', type: '' })}
      />

      {/* Progress / Save Modal */}
      {(isSaving || saveSuccess) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl px-8 sm:px-12 py-8 text-center border border-gray-100 max-w-sm w-full">
            {isSaving ? (
              <>
                <div className="w-12 h-12 border-4 border-gray-200 border-t-orange-500 rounded-full animate-spin mx-auto mb-4"></div>
                <h2 className="text-lg font-bold text-gray-900 tracking-wide">Saving Register Data...</h2>
                <p className="text-xs text-gray-500 mt-1 font-medium">Validating entries and routing for approval</p>
              </>
            ) : (
              <>
                <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h2 className="text-lg font-bold text-green-800 tracking-wide">Data Saved Successfully</h2>
                <p className="text-xs text-gray-500 mt-1 font-medium">Redirecting to dashboard...</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Main Container Card */}
      <div className="bg-white w-full max-w-[98rem] rounded-2xl p-4 sm:p-8 lg:p-10 shadow-2xl border border-gray-200/80 space-y-7 my-4">
        
        {/* TOP HEADER */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-200 pb-5 gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="p-2 text-gray-600 hover:text-orange-600 hover:bg-orange-50 rounded-xl transition-all cursor-pointer border border-gray-200 shadow-sm"
              title="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <span className="text-xs font-black text-orange-600 tracking-widest uppercase block mb-0.5">
                {formMeta.company}
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-gray-900 uppercase tracking-wide">
                {formMeta.title}
              </h2>
              <div className="text-xs text-gray-500 font-semibold mt-1 flex flex-wrap items-center gap-2">
                <span>{qfValue}</span>
                <span>•</span>
                <span className="bg-orange-50 text-orange-800 font-bold px-2 py-0.5 rounded border border-orange-200">
                  Shop ID: {actualShopId}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              const today = new Date().toISOString().split('T')[0];
              setPdfFromDate(today);
              setPdfToDate(today);
              setShowPdfModal(true);
            }}
            className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider shadow hover:shadow-md transition-all cursor-pointer self-stretch sm:self-auto justify-center"
          >
            <FileDown className="w-4 h-4 text-orange-400" /> Download PDF
          </button>
        </div>

        {/* Action Register Table Section */}
        <div className="bg-white rounded-xl border border-gray-300 p-5 space-y-4 shadow-sm">
          
          {/* Entries Toolbar */}
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-gray-200 pb-2">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
              <span className="font-extrabold text-gray-900 text-xs sm:text-sm uppercase tracking-wide">
                Action Register Entries
              </span>
              <span className="text-[11px] bg-orange-100 text-orange-800 px-2.5 py-0.5 rounded-full font-bold">
                {entries.length} {entries.length === 1 ? "Record" : "Records"}
              </span>
            </div>

            {!isSavedRecord && (
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={handleAddRow}
                  className="inline-flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all shadow hover:shadow-md cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Row
                </button>

                {entries.length > 1 && (
                  <button
                    type="button"
                    onClick={handleDeleteLastRow}
                    className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all shadow hover:shadow-md cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete Row
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Main Register Table */}
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="w-full border-collapse text-xs text-center min-w-[1300px]">
              <thead className="bg-gray-100/80 text-gray-800 font-extrabold border-b border-gray-200 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-3 w-32 text-center">DATE</th>
                  <th className="p-3 text-left px-3 min-w-[210px] border-l border-gray-200">PART NAME</th>
                  <th className="p-3 text-left px-3 min-w-[200px] border-l border-gray-200">PROBLEM DESCRIPTION</th>
                  <th className="p-3 w-32 border-l border-gray-200 text-center">CATEGORY (A-E)</th>
                  <th className="p-3 w-20 border-l border-gray-200 text-center">QTY</th>
                  <th className="p-3 text-left px-3 min-w-[200px] border-l border-gray-200">ROOT CAUSE</th>
                  <th className="p-3 text-left px-3 min-w-[200px] border-l border-gray-200">CORRECTIVE ACTION</th>
                  <th className="p-3 w-24 border-l border-gray-200 text-center">RESULT</th>
                  <th className="p-3 w-36 border-l border-gray-200 text-center">SIGNATURE</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200">
                {entries.map((row, idx) => (
                  <tr key={`entry-${idx}`} className="hover:bg-gray-50/60 transition-colors">
                    {/* Date */}
                    <td className="p-1.5">
                      <input
                        type="date"
                        disabled={isSavedRecord}
                        className="w-full text-center bg-transparent outline-none p-1.5 font-medium rounded-lg focus:bg-white border border-transparent focus:border-gray-300 disabled:text-gray-700 cursor-pointer"
                        value={row.date || ''}
                        onChange={(e) => handleRowChange(idx, 'date', e.target.value)}
                      />
                    </td>

                    {/* Part Name */}
                    <td className="p-1.5 text-left border-l border-gray-200">
                      <select
                        disabled={isSavedRecord}
                        className="w-full text-left px-2 bg-transparent outline-none p-1.5 font-bold uppercase rounded-lg focus:bg-white border border-transparent focus:border-gray-300 cursor-pointer disabled:text-gray-700"
                        value={
                          typeof row.partName === 'object'
                            ? row.partName?.partName || ''
                            : row.partName || ''
                        }
                        onChange={(e) => handleRowChange(idx, 'partName', e.target.value)}
                      >
                        <option value="">Select Part Name</option>
                        {partNameOptions.map((part, pIdx) => {
                          const partNameStr =
                            typeof part === 'object' && part !== null ? part.partName || '' : String(part);
                          if (!partNameStr) return null;
                          return (
                            <option key={`${partNameStr}-${pIdx}`} value={partNameStr}>
                              {partNameStr}
                            </option>
                          );
                        })}
                      </select>
                      {loadingPartNames && (
                        <div className="text-[10px] text-gray-400 px-2 italic">Loading available parts...</div>
                      )}
                    </td>

                    {/* Problem Description */}
                    <td className="p-1.5 border-l border-gray-200">
                      <textarea
                        rows={2}
                        disabled={isSavedRecord}
                        placeholder="Enter description..."
                        className="w-full text-left px-2 bg-transparent outline-none p-1.5 resize-y uppercase rounded-lg focus:bg-white border border-transparent focus:border-gray-300 disabled:text-gray-700 font-medium"
                        value={row.problemDescription || ''}
                        onChange={(e) => handleRowChange(idx, 'problemDescription', e.target.value)}
                      />
                    </td>

                    {/* Problem Category */}
                    <td className="p-1.5 border-l border-gray-200">
                      <select
                        disabled={isSavedRecord}
                        className="w-full text-center bg-transparent outline-none p-1.5 font-black text-gray-900 rounded-lg focus:bg-white border border-transparent focus:border-gray-300 cursor-pointer disabled:text-gray-700"
                        value={row.problemCategory || ""}
                        onChange={(e) => handleRowChange(idx, 'problemCategory', e.target.value)}
                      >
                        <option value="">Select</option>
                        <option value="A">A</option>
                        <option value="B">B</option>
                        <option value="C">C</option>
                        <option value="D">D</option>
                        <option value="E">E</option>
                      </select>
                    </td>

                    {/* Quantity */}
                    <td className="p-1.5 border-l border-gray-200">
                      <input
                        type="number"
                        min={1}
                        disabled={isSavedRecord}
                        className="w-full text-center bg-transparent outline-none p-1.5 font-black text-gray-900 rounded-lg focus:bg-white border border-transparent focus:border-gray-300 disabled:text-gray-700"
                        value={row.quantity ?? 1}
                        onChange={(e) =>
                          handleRowChange(idx, 'quantity', parseInt(e.target.value, 10) || 1)
                        }
                      />
                    </td>

                    {/* Root Cause */}
                    <td className="p-1.5 border-l border-gray-200">
                      <textarea
                        rows={2}
                        disabled={isSavedRecord}
                        placeholder="Detail root cause..."
                        className="w-full text-left px-2 bg-transparent outline-none p-1.5 resize-y uppercase rounded-lg focus:bg-white border border-transparent focus:border-gray-300 disabled:text-gray-700 font-medium"
                        value={row.rootCause || ''}
                        onChange={(e) => handleRowChange(idx, 'rootCause', e.target.value)}
                      />
                    </td>

                    {/* Corrective Action */}
                    <td className="p-1.5 border-l border-gray-200">
                      <textarea
                        rows={2}
                        disabled={isSavedRecord}
                        placeholder="Detail corrective action..."
                        className="w-full text-left px-2 bg-transparent outline-none p-1.5 resize-y uppercase rounded-lg focus:bg-white border border-transparent focus:border-gray-300 disabled:text-gray-700 font-medium"
                        value={row.correctiveAction || ''}
                        onChange={(e) => handleRowChange(idx, 'correctiveAction', e.target.value)}
                      />
                    </td>

                    {/* Result */}
                    <td className="p-1.5 border-l border-gray-200">
                      <select
                        disabled={isSavedRecord}
                        className={`w-full text-center bg-transparent outline-none p-1.5 font-black rounded-lg focus:bg-white border border-transparent focus:border-gray-300 cursor-pointer disabled:text-gray-700 ${
                          row.result === 'OK' ? 'text-green-700' : 'text-red-700'
                        }`}
                        value={row.result || "OK"}
                        onChange={(e) => handleRowChange(idx, 'result', e.target.value)}
                      >
                        <option value="OK">OK</option>
                        <option value="NOT OK">NOT OK</option>
                      </select>
                    </td>

                    {/* Signature */}
                    <td className="p-1.5 text-center bg-gray-50/50 border-l border-gray-200">
                      {row.signature ? (
                        <div className="flex flex-col items-center justify-center p-1 bg-green-50 border border-green-200 rounded-lg">
                          <span className="text-[10px] font-bold text-green-700 uppercase tracking-wider">
                            Approved ✓
                          </span>
                          <span
                            className="text-xs font-black text-gray-900 uppercase truncate max-w-[110px]"
                            title={row.signature}
                          >
                            {row.signature}
                          </span>
                        </div>
                      ) : (
                        <select
                          disabled={isSavedRecord}
                          value={row.productEngineer || ''}
                          onChange={(e) => handleRowChange(idx, 'productEngineer', e.target.value)}
                          className="w-full min-w-[130px] text-center bg-white border border-gray-300 outline-none p-1.5 rounded-lg text-xs font-bold text-orange-700 cursor-pointer disabled:text-gray-700 focus:ring-1 focus:ring-orange-500 shadow-sm"
                        >
                          <option value="">Select PE Incharge</option>
                          {productEngineers.map((engineer, peIndex) => {
                            const username = engineer.username || engineer.employeeId || engineer.name || '';
                            return username ? (
                              <option key={`${username}-${peIndex}`} value={username}>
                                {engineer.name || username}
                              </option>
                            ) : null;
                          })}
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Date Range Modal for PDF Download */}
        {showPdfModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-7 w-full max-w-md border border-gray-100">
              <div className="flex justify-between items-center mb-5 pb-3 border-b border-gray-200">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-orange-50 rounded-lg">
                    <Calendar className="w-5 h-5 text-orange-500" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900 uppercase tracking-wide">
                      Download PDF by Date Range
                    </h3>
                    <p className="text-xs text-gray-500">Filter register records by date range</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPdfModal(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="font-semibold text-gray-700 block mb-1 text-xs uppercase tracking-wider">
                    From Date
                  </label>
                  <input
                    type="date"
                    className="w-full border border-gray-300 p-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm font-semibold bg-white transition-all shadow-sm"
                    value={pdfFromDate}
                    onChange={(e) => setPdfFromDate(e.target.value)}
                  />
                </div>

                <div>
                  <label className="font-semibold text-gray-700 block mb-1 text-xs uppercase tracking-wider">
                    To Date
                  </label>
                  <input
                    type="date"
                    className="w-full border border-gray-300 p-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm font-semibold bg-white transition-all shadow-sm"
                    value={pdfToDate}
                    onChange={(e) => setPdfToDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPdfModal(false)}
                  className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPdfRange}
                  disabled={isDownloadingPdf}
                  className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-400 text-white px-5 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider shadow hover:shadow-md transition-all cursor-pointer"
                >
                  <FileDown className="w-4 h-4" />
                  {isDownloadingPdf ? "Downloading..." : "Download PDF"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Legend Card */}
        <div className="bg-gray-50/70 rounded-xl border border-gray-200 p-4 space-y-2.5">
          <div className="flex items-center gap-1.5 text-gray-800">
            <Info className="w-4 h-4 text-orange-500" />
            <span className="font-extrabold text-xs uppercase tracking-wider">
              Problem Category Definition (Codes A - E)
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-gray-700 font-medium">
            {formMeta.categoryLegend.map((item) => (
              <div key={item.code} className="flex items-start gap-2 bg-white p-2 rounded-lg border border-gray-200/80 shadow-xs">
                <span className="font-black text-orange-600 bg-orange-50 px-2 py-0.5 rounded border border-orange-200/70 text-[11px]">
                  {item.code}
                </span>
                <span className="leading-snug pt-0.5">{item.description}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Save Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t border-gray-200">
          <span className="text-xs text-gray-500 font-semibold text-center sm:text-left">{qfValue}</span>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || saveSuccess || isSavedRecord}
            className={`w-full sm:w-auto px-9 py-3.5 rounded-xl font-black transition-all shadow-lg uppercase tracking-wider text-xs sm:text-sm flex items-center justify-center gap-2 active:scale-95 ${
              isSavedRecord
                ? 'bg-gray-400 text-white cursor-not-allowed'
                : 'bg-orange-500 hover:bg-orange-600 hover:shadow-orange-500/25 text-white cursor-pointer'
            }`}
          >
            {isSaving
              ? "SAVING..."
              : saveSuccess || isSavedRecord
                ? "RECORD SUBMITTED ✓"
                : "SAVE & CONTINUE"}
          </button>
        </div>
      </div>
    </div>
  );
}