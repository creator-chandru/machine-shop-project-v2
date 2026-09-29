import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLineSet } from "../context/LineSetContext.jsx";
import Header from '../components/Header';

const initialFormData = {
  formCode: "QF/06/ADM-14",
  revision: "00",
  revisionDate: "01.03.2019",
  title: "SKILL EVALUATION - PRACTICAL PRODUCTION AND QUALITY",
  company: "SAKTHI AUTO COMPONENT LIMITED"
};

const getTodayISODate = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const createEmptyRow = () => ({
  rowDate: getTodayISODate(),
  proTarget: "",
  proAchieved: "",
  targetAchievedPercent: "",
  qtyOk: "",
  qtyRejected: "",
  rejectionPercent: "",
  evaluatorSignature: "",
  efficiency: "",
  remarks: ""
});

const initialCriteria = [
  { level: "LEVEL - 2", proAchievedPercent: "", qualityLevelAchievedPercent: "", remarks: "" },
  { level: "LEVEL - 3", proAchievedPercent: "", qualityLevelAchievedPercent: "", remarks: "" },
  { level: "LEVEL - 4", proAchievedPercent: "", qualityLevelAchievedPercent: "", remarks: "" }
];

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

export default function SkillEvaluationPractical() {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const { lineSet, setLineSet } = useLineSet();

  const [headerInfo, setHeaderInfo] = useState({
    name: "",
    empNo: "",
    skillLevel: "",
    topLevel: "LEVEL - 3",
    partName: "",
    operationNo: "",
    evaluationFromDate: getTodayISODate(),
    evaluationToDate: getTodayISODate(),
    machineNo: ""
  });

  const [rows, setRows] = useState([
    createEmptyRow(),
    createEmptyRow(),
    createEmptyRow(),
    createEmptyRow(),
    createEmptyRow()
  ]);

  const [evaluationCriteria, setEvaluationCriteria] = useState(initialCriteria);

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [toast, setToast] = useState({ message: '', type: '' });

  const triggerToast = (message, type = 'error') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast({ message: '', type: '' });
    }, 4000);
  };

  useEffect(() => {
    if (lineSet) {
      setHeaderInfo((prev) => ({
        ...prev,
        partName: lineSet.partName || prev.partName,
        machineNo: lineSet.machineNo || prev.machineNo
      }));
    }
  }, [lineSet]);

  const handleHeaderChange = (field, val) => {
    setHeaderInfo((prev) => ({
      ...prev,
      [field]: val
    }));
  };

  const handleRowChange = (index, field, val) => {
    setRows((prev) => {
      const next = [...prev];
      const updatedRow = { ...next[index], [field]: val };

      const target = parseFloat(updatedRow.proTarget);
      const achieved = parseFloat(updatedRow.proAchieved);
      const qtyOk = parseFloat(updatedRow.qtyOk);
      const qtyRej = parseFloat(updatedRow.qtyRejected);

      if (field === 'proTarget' || field === 'proAchieved') {
        if (!isNaN(target) && target > 0 && !isNaN(achieved)) {
          updatedRow.targetAchievedPercent = `${((achieved / target) * 100).toFixed(0)}%`;
        }
      }

      if (field === 'qtyOk' || field === 'qtyRejected') {
        if (!isNaN(qtyRej) && (qtyOk || qtyRej)) {
          const totalProduced = (qtyOk || 0) + qtyRej;
          if (totalProduced > 0) {
            updatedRow.rejectionPercent = `${((qtyRej / totalProduced) * 100).toFixed(1)}%`;
          }
        }
      }

      next[index] = updatedRow;
      return next;
    });
  };

  const handleCriteriaChange = (index, field, val) => {
    setEvaluationCriteria((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: val };
      return next;
    });
  };

  const handleAddRow = () => {
    setRows((prev) => [...prev, createEmptyRow()]);
  };

  const handleRemoveRow = () => {
    setRows((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  };

  const totalProTarget = rows.reduce((sum, r) => sum + (parseFloat(r.proTarget) || 0), 0);
  const totalProAchieved = rows.reduce((sum, r) => sum + (parseFloat(r.proAchieved) || 0), 0);
  const totalTargetPercent = totalProTarget > 0 ? `${((totalProAchieved / totalProTarget) * 100).toFixed(0)}%` : "-";
  const totalQtyOk = rows.reduce((sum, r) => sum + (parseFloat(r.qtyOk) || 0), 0);
  const totalQtyRejected = rows.reduce((sum, r) => sum + (parseFloat(r.qtyRejected) || 0), 0);
  const totalRejectionPercent = (totalQtyOk + totalQtyRejected) > 0 
    ? `${((totalQtyRejected / (totalQtyOk + totalQtyRejected)) * 100).toFixed(1)}%` 
    : "-";

  const handleSave = async () => {
    if (!headerInfo.name || !headerInfo.empNo || !headerInfo.partName) {
      triggerToast("Please fill Name, Emp No, and Part Name before proceeding.", "error");
      return;
    }

    const filledRows = rows.filter(r => r.rowDate && (r.proTarget || r.proAchieved || r.evaluatorSignature));
    if (filledRows.length === 0) {
      triggerToast("Please enter at least one evaluation row before saving.", "error");
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);

    const payload = {
      header: {
        ...headerInfo,
        machineShop: shopId || 3,
        totalProTarget,
        totalProAchieved,
        totalTargetPercent,
        totalQtyOk,
        totalQtyRejected,
        totalRejectionPercent
      },
      rows: filledRows,
      evaluationCriteria
    };

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/skill-evaluation-practical`, {
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

      setIsSaving(false);
      setSaveSuccess(true);

      await new Promise((resolve) => setTimeout(resolve, 2000));
      navigate(`/operator/${shopId || 3}`);
    } catch (err) {
      console.error('Save error:', err);
      setIsSaving(false);
      triggerToast(err.message || 'Failed to save evaluation form.', 'error');
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
                <h2 className="text-xl font-bold text-gray-800">Saving Data...</h2>
                <p className="text-gray-500 mt-2">Please wait</p>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold text-green-800">Data Saved Successfully</h2>
                <p className="text-gray-500 mt-2">Loading next step...</p>
              </>
            )}
          </div>
        </div>
      )}

      <div className="bg-white w-full max-w-[92rem] rounded-xl p-8 shadow-2xl overflow-x-auto border-4 border-gray-100">
        
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
          <div className="bg-gray-100 border border-gray-300 rounded px-4 py-2 text-right">
            <label className="text-xs font-bold text-gray-500 uppercase block">Grade / Level</label>
            <input
              type="text"
              className="bg-transparent font-extrabold text-gray-800 text-base text-right outline-none w-28"
              value={headerInfo.topLevel}
              onChange={(e) => handleHeaderChange('topLevel', e.target.value)}
              placeholder="LEVEL - 3"
            />
          </div>
        </div>

        {/* Header Metadata Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
          
          {/* Left Column */}
          <div className="space-y-3">
            <div className="flex items-center">
              <label className="w-32 font-bold text-gray-700 text-sm">NAME -</label>
              <input
                type="text"
                className="flex-1 border border-gray-300 p-2 rounded text-sm font-semibold bg-white focus:ring-1 focus:ring-orange-500 outline-none"
                placeholder="e.g. M. Nagarajan"
                value={headerInfo.name}
                onChange={(e) => handleHeaderChange('name', e.target.value)}
              />
            </div>

            <div className="flex items-center">
              <label className="w-32 font-bold text-gray-700 text-sm">EMP.NO -</label>
              <input
                type="text"
                className="flex-1 border border-gray-300 p-2 rounded text-sm font-semibold bg-white focus:ring-1 focus:ring-orange-500 outline-none"
                placeholder="e.g. 710125"
                value={headerInfo.empNo}
                onChange={(e) => handleHeaderChange('empNo', e.target.value)}
              />
            </div>

            <div className="flex items-center">
              <label className="w-32 font-bold text-gray-700 text-sm">SKILL LEVEL -</label>
              <input
                type="text"
                className="flex-1 border border-gray-300 p-2 rounded text-sm font-semibold bg-white focus:ring-1 focus:ring-orange-500 outline-none"
                placeholder="e.g. 3"
                value={headerInfo.skillLevel}
                onChange={(e) => handleHeaderChange('skillLevel', e.target.value)}
              />
            </div>

            <div className="flex items-center">
              <label className="w-32 font-bold text-gray-700 text-sm">PART NAME -</label>
              <input
                type="text"
                className="flex-1 border border-gray-300 p-2 rounded text-sm font-semibold bg-white focus:ring-1 focus:ring-orange-500 outline-none"
                placeholder="e.g. CC21E SK"
                value={headerInfo.partName}
                onChange={(e) => handleHeaderChange('partName', e.target.value)}
              />
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-3">
            <div className="flex items-center">
              <label className="w-40 font-bold text-gray-700 text-sm">OPERATION NO -</label>
              <input
                type="text"
                className="flex-1 border border-gray-300 p-2 rounded text-sm font-semibold bg-white focus:ring-1 focus:ring-orange-500 outline-none"
                placeholder="e.g. OP 20, OP 30, OP 40"
                value={headerInfo.operationNo}
                onChange={(e) => handleHeaderChange('operationNo', e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="w-40 font-bold text-gray-700 text-sm">EVAL. DATES -</label>
              <div className="flex items-center gap-2 flex-1">
                <span className="text-xs font-bold text-gray-500">FROM:</span>
                <input
                  type="date"
                  className="flex-1 border border-gray-300 p-1.5 rounded text-xs font-semibold bg-white focus:ring-1 focus:ring-orange-500 outline-none"
                  value={headerInfo.evaluationFromDate}
                  onChange={(e) => handleHeaderChange('evaluationFromDate', e.target.value)}
                />
                <span className="text-xs font-bold text-gray-500">TO:</span>
                <input
                  type="date"
                  className="flex-1 border border-gray-300 p-1.5 rounded text-xs font-semibold bg-white focus:ring-1 focus:ring-orange-500 outline-none"
                  value={headerInfo.evaluationToDate}
                  onChange={(e) => handleHeaderChange('evaluationToDate', e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center">
              <label className="w-40 font-bold text-gray-700 text-sm">MACHINE.NO -</label>
              <input
                type="text"
                className="flex-1 border border-gray-300 p-2 rounded text-sm font-semibold bg-white focus:ring-1 focus:ring-orange-500 outline-none"
                placeholder="e.g. CN561, CN562, CN563"
                value={headerInfo.machineNo}
                onChange={(e) => handleHeaderChange('machineNo', e.target.value)}
              />
            </div>
          </div>

        </div>

        {/* Action Toolbar */}
        <div className="flex justify-between items-center mb-2 px-1">
          <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">
            Evaluation Log Entries
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAddRow}
              className="inline-flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-4 py-1.5 rounded transition-colors shadow hover:cursor-pointer"
            >
              <span className="text-sm font-bold leading-none">+</span> Add Row
            </button>
            {rows.length > 1 && (
              <button
                type="button"
                onClick={handleRemoveRow}
                className="inline-flex items-center gap-1 bg-gray-600 hover:bg-gray-700 text-white text-xs font-bold px-3 py-1.5 rounded transition-colors shadow hover:cursor-pointer"
              >
                <span className="text-sm font-bold leading-none">−</span> Delete Row
              </button>
            )}
          </div>
        </div>

        {/* Main Practical Evaluation Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-800 text-sm text-center">
            <thead className="bg-gray-100 text-gray-800 font-bold">
              <tr>
                <th className="border border-gray-800 p-2 w-32">DATE</th>
                <th className="border border-gray-800 p-2 w-28">PRO TARGET</th>
                <th className="border border-gray-800 p-2 w-28">PRO ACHIEVED</th>
                <th className="border border-gray-800 p-2 w-32">TARGET ACHIEVED IN %</th>
                <th className="border border-gray-800 p-2 w-24">QTY OK</th>
                <th className="border border-gray-800 p-2 w-24">QTY REJECTED</th>
                <th className="border border-gray-800 p-2 w-28">REJECTION %</th>
                <th className="border border-gray-800 p-2 w-36">EVALUATOR SIGNATURE</th>
                <th className="border border-gray-800 p-2 w-28">EFFICIENCY</th>
                <th className="border border-gray-800 p-2 min-w-[120px]">REMARKS</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={`eval-row-${idx}`} className="hover:bg-orange-50/20">
                  <td className="border border-gray-800 p-0">
                    <input
                      type="date"
                      className="w-full h-full text-center px-1 py-2 outline-none bg-transparent font-medium"
                      value={row.rowDate}
                      onChange={(e) => handleRowChange(idx, 'rowDate', e.target.value)}
                    />
                  </td>
                  <td className="border border-gray-800 p-0">
                    <input
                      type="number"
                      placeholder="140"
                      className="w-full h-full text-center px-2 py-2 outline-none bg-transparent font-medium"
                      value={row.proTarget}
                      onChange={(e) => handleRowChange(idx, 'proTarget', e.target.value)}
                    />
                  </td>
                  <td className="border border-gray-800 p-0">
                    <input
                      type="number"
                      placeholder="134"
                      className="w-full h-full text-center px-2 py-2 outline-none bg-transparent font-medium"
                      value={row.proAchieved}
                      onChange={(e) => handleRowChange(idx, 'proAchieved', e.target.value)}
                    />
                  </td>
                  <td className="border border-gray-800 p-0">
                    <input
                      type="text"
                      placeholder="96%"
                      className="w-full h-full text-center px-2 py-2 outline-none bg-transparent font-semibold"
                      value={row.targetAchievedPercent}
                      onChange={(e) => handleRowChange(idx, 'targetAchievedPercent', e.target.value)}
                    />
                  </td>
                  <td className="border border-gray-800 p-0">
                    <input
                      type="number"
                      placeholder="134"
                      className="w-full h-full text-center px-2 py-2 outline-none bg-transparent font-medium"
                      value={row.qtyOk}
                      onChange={(e) => handleRowChange(idx, 'qtyOk', e.target.value)}
                    />
                  </td>
                  <td className="border border-gray-800 p-0">
                    <input
                      type="text"
                      placeholder="-"
                      className="w-full h-full text-center px-2 py-2 outline-none bg-transparent font-medium"
                      value={row.qtyRejected}
                      onChange={(e) => handleRowChange(idx, 'qtyRejected', e.target.value)}
                    />
                  </td>
                  <td className="border border-gray-800 p-0">
                    <input
                      type="text"
                      placeholder="-"
                      className="w-full h-full text-center px-2 py-2 outline-none bg-transparent font-medium"
                      value={row.rejectionPercent}
                      onChange={(e) => handleRowChange(idx, 'rejectionPercent', e.target.value)}
                    />
                  </td>
                  <td className="border border-gray-800 p-0">
                    <input
                      type="text"
                      placeholder="Sign / Initial"
                      className="w-full h-full text-center px-2 py-2 outline-none bg-transparent font-medium italic"
                      value={row.evaluatorSignature}
                      onChange={(e) => handleRowChange(idx, 'evaluatorSignature', e.target.value)}
                    />
                  </td>
                  <td className="border border-gray-800 p-0">
                    <input
                      type="text"
                      className="w-full h-full text-center px-2 py-2 outline-none bg-transparent font-medium"
                      value={row.efficiency}
                      onChange={(e) => handleRowChange(idx, 'efficiency', e.target.value)}
                    />
                  </td>
                  <td className="border border-gray-800 p-0">
                    <input
                      type="text"
                      className="w-full h-full px-3 py-2 outline-none bg-transparent font-medium text-left"
                      value={row.remarks}
                      onChange={(e) => handleRowChange(idx, 'remarks', e.target.value)}
                    />
                  </td>
                </tr>
              ))}

              {/* TOTAL ROW */}
              <tr className="bg-gray-100 font-bold">
                <td className="border border-gray-800 p-2 text-center uppercase tracking-wider">TOTAL</td>
                <td className="border border-gray-800 p-2">{totalProTarget || ""}</td>
                <td className="border border-gray-800 p-2">{totalProAchieved || ""}</td>
                <td className="border border-gray-800 p-2">{totalTargetPercent}</td>
                <td className="border border-gray-800 p-2">{totalQtyOk || ""}</td>
                <td className="border border-gray-800 p-2">{totalQtyRejected || "-"}</td>
                <td className="border border-gray-800 p-2">{totalRejectionPercent}</td>
                <td className="border border-gray-800 p-2 bg-gray-200"></td>
                <td className="border border-gray-800 p-2 bg-gray-200"></td>
                <td className="border border-gray-800 p-2 bg-gray-200"></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Note section */}
        <div className="border border-gray-800 bg-gray-50 px-4 py-2 mt-2 text-xs font-semibold text-gray-800 uppercase">
          NOTE : FOR SKILL EVALUATION, REJECTION OF THE PROCESS EVALUATED IS ONLY ACCOUNTABLE. REJECTION OF EARLIER STAGE OPERATIONS ARE NOT ACCOUNTABLE
        </div>

        {/* Acceptance Target Level & Evaluation Criteria Table */}
        <div className="mt-6 border-2 border-gray-800">
          <div className="bg-gray-100 border-b border-gray-800 px-4 py-2 font-bold text-gray-800 text-sm flex justify-between items-center">
            <span>ACCEPTANCE TARGET LEVEL</span>
            <span className="text-xs uppercase text-gray-600">EVALUATION CRITERIA</span>
          </div>

          <table className="w-full border-collapse text-sm text-center">
            <thead className="bg-gray-50 font-bold text-gray-700 border-b border-gray-800">
              <tr>
                <th className="border-r border-gray-800 p-2 w-48">LEVEL</th>
                <th className="border-r border-gray-800 p-2">PRO ACHIEVED IN %</th>
                <th className="border-r border-gray-800 p-2">QUALITY LEVEL ACHIEVED IN %</th>
                <th className="p-2 w-64">REMARKS (PASS/FAIL)</th>
              </tr>
            </thead>
            <tbody>
              {evaluationCriteria.map((crit, idx) => (
                <tr key={`crit-${idx}`} className="border-b border-gray-800 last:border-b-0 font-medium">
                  <td className="border-r border-gray-800 p-2 font-bold bg-gray-50">{crit.level}</td>
                  <td className="border-r border-gray-800 p-0">
                    <input
                      type="text"
                      placeholder="e.g. 94%"
                      className="w-full h-full text-center px-3 py-2 outline-none bg-transparent"
                      value={crit.proAchievedPercent}
                      onChange={(e) => handleCriteriaChange(idx, 'proAchievedPercent', e.target.value)}
                    />
                  </td>
                  <td className="border-r border-gray-800 p-0">
                    <input
                      type="text"
                      placeholder="e.g. 100%"
                      className="w-full h-full text-center px-3 py-2 outline-none bg-transparent"
                      value={crit.qualityLevelAchievedPercent}
                      onChange={(e) => handleCriteriaChange(idx, 'qualityLevelAchievedPercent', e.target.value)}
                    />
                  </td>
                  <td className="p-0">
                    <input
                      type="text"
                      placeholder="e.g. Pass"
                      className="w-full h-full text-center px-3 py-2 outline-none bg-transparent font-semibold"
                      value={crit.remarks}
                      onChange={(e) => handleCriteriaChange(idx, 'remarks', e.target.value)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer & Submit Button */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-6 pt-4 border-t border-gray-300">
          <span className="text-xs text-gray-500 font-semibold">
            {initialFormData.formCode}, Rev.No:{initialFormData.revision}, {initialFormData.revisionDate}
          </span>

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