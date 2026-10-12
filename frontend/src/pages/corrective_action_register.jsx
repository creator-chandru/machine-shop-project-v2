import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FileDown, Plus, Trash2, ArrowLeft, Calendar, X } from 'lucide-react';
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
  date: "",
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

  // Fetch the Product Engineers that can receive a register for approval.
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
    // Fresh row creation - does not inherit prior row values
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
        } catch {
          // Fall back to default error message
        }
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

    // Validate empty rows
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
    <div className="min-h-screen bg-[#2d2d2d] flex flex-col items-center justify-center p-6 pb-20">
      <Header />

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
                <h2 className="text-xl font-bold text-gray-800">Saving Register Data...</h2>
                <p className="text-gray-500 mt-2 text-sm">Validating entries and routing approval</p>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold text-green-800">Data Saved Successfully</h2>
                <p className="text-gray-500 mt-2 text-sm">Redirecting to dashboard...</p>
              </>
            )}
          </div>
        </div>
      )}

      <div className="bg-white w-full max-w-[98rem] rounded-xl p-8 shadow-2xl overflow-x-auto border-4 border-gray-100 space-y-6">
        {/* Header Block & PDF Export */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-200 pb-4 gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="p-1 text-gray-600 hover:text-orange-600 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
                title="Back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <span className="text-xs font-bold text-orange-600 tracking-wider uppercase">
                {formMeta.company}
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-gray-800 uppercase tracking-wide">
              {formMeta.title}
            </h2>
            <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-2">
              <span>Form Code: {formMeta.formCode}</span>
              <span>|</span>
              <span>Revision: {formMeta.revision}</span>
              <span>|</span>
              <span>Revision Date: {formMeta.revisionDate}</span>
              <span>|</span>
              <span className="font-bold text-orange-600">Shop ID: {actualShopId}</span>
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
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider shadow transition-colors cursor-pointer"
          >
            <FileDown className="w-4 h-4" /> Download PDF
          </button>
        </div>

        {/* Entries Table Toolbar */}
        <div className="flex justify-between items-center mb-1 px-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">
              Action Register Entries
            </span>
            <span className="text-[11px] bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full font-semibold">
              {entries.length} Rows
            </span>
          </div>

          {!isSavedRecord && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAddRow}
                className="inline-flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-3 py-1.5 rounded transition-colors shadow cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Row
              </button>

              {entries.length > 1 && (
                <button
                  type="button"
                  onClick={handleDeleteLastRow}
                  className="inline-flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-3 py-1.5 rounded transition-colors shadow cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete Row
                </button>
              )}
            </div>
          )}
        </div>

        {/* Main Register Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border-2 border-gray-800 text-xs text-center min-w-[1300px]">
            <thead>
              <tr className="bg-gray-100 text-gray-800 font-bold">
                <th className="border border-gray-800 p-2 w-28">DATE</th>
                <th className="border border-gray-800 p-2 text-left px-3 min-w-[200px]">PART NAME</th>
                <th className="border border-gray-800 p-2 text-left px-3 min-w-[180px]">PROBLEM DESCRIPTION</th>
                <th className="border border-gray-800 p-2 w-32">PROBLEM CATEGORY (A/B/C/D/E)</th>
                <th className="border border-gray-800 p-2 w-16">QTY</th>
                <th className="border border-gray-800 p-2 text-left px-3 min-w-[180px]">ROOT CAUSE</th>
                <th className="border border-gray-800 p-2 text-left px-3 min-w-[180px]">CORRECTIVE ACTION</th>
                <th className="border border-gray-800 p-2 w-24">RESULT</th>
                <th className="border border-gray-800 p-2 w-32">SIGNATURE</th>
              </tr>
            </thead>

            <tbody>
              {entries.map((row, idx) => (
                <tr key={`entry-${idx}`} className="hover:bg-gray-50 h-12">
                  {/* DATE */}
                  <td className="border border-gray-800 p-1">
                    <input
                      type="date"
                      disabled={isSavedRecord}
                      className="w-full text-center bg-transparent outline-none p-1 font-medium disabled:text-gray-700"
                      value={row.date || ''}
                      onChange={(e) => handleRowChange(idx, 'date', e.target.value)}
                    />
                  </td>

                  {/* PART NAME */}
                  <td className="border border-gray-800 p-1 text-left">
                    <select
                      disabled={isSavedRecord}
                      className="w-full text-left px-2 bg-transparent outline-none p-1 font-semibold uppercase cursor-pointer disabled:text-gray-700"
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
                      <div className="text-[9px] text-gray-400 px-2">Loading parts...</div>
                    )}
                  </td>

                  {/* PROBLEM DESCRIPTION */}
                  <td className="border border-gray-800 p-1">
                    <textarea
                      rows={2}
                      disabled={isSavedRecord}
                      placeholder="Enter description"
                      className="w-full text-left px-2 bg-transparent outline-none p-1 resize-none uppercase disabled:text-gray-700"
                      value={row.problemDescription || ''}
                      onChange={(e) => handleRowChange(idx, 'problemDescription', e.target.value)}
                    />
                  </td>

                  {/* CATEGORY (Blank by default) */}
                  <td className="border border-gray-800 p-1">
                    <select
                      disabled={isSavedRecord}
                      className="w-full text-center bg-transparent outline-none p-1 font-bold cursor-pointer disabled:text-gray-700"
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

                  {/* QUANTITY */}
                  <td className="border border-gray-800 p-1">
                    <input
                      type="number"
                      min={1}
                      disabled={isSavedRecord}
                      className="w-full text-center bg-transparent outline-none p-1 font-medium disabled:text-gray-700"
                      value={row.quantity ?? 1}
                      onChange={(e) =>
                        handleRowChange(idx, 'quantity', parseInt(e.target.value, 10) || 1)
                      }
                    />
                  </td>

                  {/* ROOT CAUSE */}
                  <td className="border border-gray-800 p-1">
                    <textarea
                      rows={2}
                      disabled={isSavedRecord}
                      placeholder="Root cause"
                      className="w-full text-left px-2 bg-transparent outline-none p-1 resize-none uppercase disabled:text-gray-700"
                      value={row.rootCause || ''}
                      onChange={(e) => handleRowChange(idx, 'rootCause', e.target.value)}
                    />
                  </td>

                  {/* CORRECTIVE ACTION */}
                  <td className="border border-gray-800 p-1">
                    <textarea
                      rows={2}
                      disabled={isSavedRecord}
                      placeholder="Corrective action"
                      className="w-full text-left px-2 bg-transparent outline-none p-1 resize-none uppercase disabled:text-gray-700"
                      value={row.correctiveAction || ''}
                      onChange={(e) => handleRowChange(idx, 'correctiveAction', e.target.value)}
                    />
                  </td>

                  {/* RESULT */}
                  <td className="border border-gray-800 p-1">
                    <select
                      disabled={isSavedRecord}
                      className="w-full text-center bg-transparent outline-none p-1 font-bold cursor-pointer disabled:text-gray-700"
                      value={row.result || "OK"}
                      onChange={(e) => handleRowChange(idx, 'result', e.target.value)}
                    >
                      <option value="OK">OK</option>
                      <option value="NOT OK">NOT OK</option>
                    </select>
                  </td>

                  {/* SIGNATURE & APPROVAL */}
                  <td className="border border-gray-800 p-1 text-center bg-gray-50/40">
                    {row.signature ? (
                      <div className="flex flex-col items-center justify-center animate-in fade-in duration-200">
                        <span className="text-[10px] font-bold text-green-600 leading-tight">
                          Approved ✓
                        </span>
                        <span
                          className="text-xs font-black text-gray-900 uppercase truncate max-w-[100px]"
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
                        className="w-full min-w-[140px] text-center bg-transparent outline-none p-1 text-[10px] font-bold text-orange-700 cursor-pointer disabled:text-gray-700"
                      >
                        <option value="">Select Product Engineer</option>
                        {productEngineers.map((engineer, peIndex) => {
                          const username = engineer.username || engineer.employeeId || engineer.name || '';
                          return username ? <option key={`${username}-${peIndex}`} value={username}>{engineer.name || username}</option> : null;
                        })}
                      </select>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Date Range Modal for PDF Download */}
        {showPdfModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md border-2 border-gray-100 animate-in fade-in">
              <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-orange-500" />
                  <h3 className="text-lg font-bold text-gray-800 uppercase tracking-wide">
                    Download PDF by Date Range
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPdfModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="font-bold text-gray-700 block mb-1 text-xs uppercase tracking-wider">
                    From Date
                  </label>
                  <input
                    type="date"
                    className="w-full border border-gray-300 p-2.5 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm font-semibold bg-white"
                    value={pdfFromDate}
                    onChange={(e) => setPdfFromDate(e.target.value)}
                  />
                </div>

                <div>
                  <label className="font-bold text-gray-700 block mb-1 text-xs uppercase tracking-wider">
                    To Date
                  </label>
                  <input
                    type="date"
                    className="w-full border border-gray-300 p-2.5 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm font-semibold bg-white"
                    value={pdfToDate}
                    onChange={(e) => setPdfToDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPdfModal(false)}
                  className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-gray-600 hover:bg-gray-100 rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPdfRange}
                  disabled={isDownloadingPdf}
                  className="flex items-center gap-2 bg-gray-800 hover:bg-gray-900 disabled:bg-gray-400 text-white px-5 py-2 rounded font-bold text-xs uppercase tracking-wider shadow transition-colors cursor-pointer"
                >
                  <FileDown className="w-4 h-4" />
                  {isDownloadingPdf ? "Downloading..." : "Download PDF"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="border-2 border-gray-800 rounded-lg overflow-hidden mt-6">
          <div className="px-3 py-1.5 font-bold text-gray-800 text-xs border-b border-gray-800 bg-gray-100 uppercase tracking-wide">
            Note: The Problem Category to be mentioned as A or B or C or D or E
          </div>
          <div className="p-3 text-xs text-gray-700 space-y-1.5 bg-white font-medium">
            {formMeta.categoryLegend.map((item) => (
              <div key={item.code} className="flex gap-2">
                <span className="font-bold text-gray-900 w-6">{item.code} -</span>
                <span>{item.description}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Save Actions */}
        <div className="flex justify-end gap-4 mt-6 pt-4 border-t border-gray-300">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || saveSuccess || isSavedRecord}
            className={`px-10 py-3 rounded font-bold transition-colors shadow-lg uppercase tracking-wider text-sm flex items-center gap-2 ${
              isSavedRecord
                ? 'bg-gray-400 text-white cursor-not-allowed'
                : 'bg-orange-500 hover:bg-orange-600 text-white cursor-pointer'
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