import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '../components/Header';

const initialFormData = {
  formCode: "QF / 07 / MPD - 15",
  revisionDate: "06-06-2018",
  title: "OPERATOR OBSERVATION SHEET",
  company: "SAKTHI AUTO COMPONENT LTD"
};

const RATING_COLUMNS = [
  { key: "followed", label: "Followed", defaultPoints: 5 },
  { key: "partiallyFollowed", label: "Partially Followed", defaultPoints: 3 },
  { key: "notFollowed", label: "Not Followed", defaultPoints: 1 },
  { key: "notAware", label: "Not Aware", defaultPoints: 0 }
];

const DEFAULT_SECTIONS = [
  {
    id: 1,
    title: "1. Work Instructions / Start Up",
    sectionMarks: "",
    columnTotals: { followed: "", partiallyFollowed: "", notFollowed: "", notAware: "" },
    items: [
      { slNo: 1, parameter: "Is the operator able to read & observe the work instruction.", followed: "", partiallyFollowed: "", notFollowed: "", notAware: "" },
      { slNo: 2, parameter: "Is the operator referring to the Work Instruction during machine operating.", followed: "", partiallyFollowed: "", notFollowed: "", notAware: "" },
      { slNo: 3, parameter: "Does the operator follow the material handling properly.", followed: "", partiallyFollowed: "", notFollowed: "", notAware: "" },
      { slNo: 4, parameter: "Does the operator follow the FIFO system.", followed: "", partiallyFollowed: "", notFollowed: "", notAware: "" }
    ]
  },
  {
    id: 2,
    title: "2. Operation Standard",
    sectionMarks: "",
    columnTotals: { followed: "", partiallyFollowed: "", notFollowed: "", notAware: "" },
    items: [
      { slNo: 1, parameter: "Does the operator know about Standard Operating Procedure.", followed: "", partiallyFollowed: "", notFollowed: "", notAware: "" },
      { slNo: 2, parameter: "Does the operator refer Standard Operating Procedure during work.", followed: "", partiallyFollowed: "", notFollowed: "", notAware: "" },
      { slNo: 3, parameter: "Does the operator Check the part as per the work instruction.", followed: "", partiallyFollowed: "", notFollowed: "", notAware: "" },
      { slNo: 4, parameter: "Is the operator changing the tool as per the work instruction.", followed: "", partiallyFollowed: "", notFollowed: "", notAware: "" }
    ]
  },
  {
    id: 3,
    title: "3. Non Conformity Management",
    sectionMarks: "",
    columnTotals: { followed: "", partiallyFollowed: "", notFollowed: "", notAware: "" },
    items: [
      { slNo: 1, parameter: "Does the operator refer Work Instructions for the NC Management during the shift?", followed: "", partiallyFollowed: "", notFollowed: "", notAware: "" },
      { slNo: 2, parameter: "Does the operator properly dispose the non conforming product.", followed: "", partiallyFollowed: "", notFollowed: "", notAware: "" },
      { slNo: 3, parameter: "Does the operator handle unusual situation component.", followed: "", partiallyFollowed: "", notFollowed: "", notAware: "" },
      { slNo: 4, parameter: "Does the operator refer limit samples / Work instruction / Process sheet / SOP", followed: "", partiallyFollowed: "", notFollowed: "", notAware: "" },
      { slNo: 5, parameter: "Does the operator properly informed to line supervisor regarding nc product.", followed: "", partiallyFollowed: "", notFollowed: "", notAware: "" }
    ]
  },
  {
    id: 4,
    title: "4. Abnormal Condition",
    sectionMarks: "",
    columnTotals: { followed: "", partiallyFollowed: "", notFollowed: "", notAware: "" },
    items: [
      { slNo: 1, parameter: "Reaction of the operator for the abnormal condition", followed: "", partiallyFollowed: "", notFollowed: "", notAware: "" }
    ]
  },
  {
    id: 5,
    title: "5. Record Keeping",
    sectionMarks: "",
    columnTotals: { followed: "", partiallyFollowed: "", notFollowed: "", notAware: "" },
    items: [
      { slNo: 1, parameter: "Does the operator fills operator check sheet at the record time ( Pre operation check sheet, Error proof verification)", followed: "", partiallyFollowed: "", notFollowed: "", notAware: "" },
      { slNo: 2, parameter: "Does the operator keeps record at designated area before or after the shift", followed: "", partiallyFollowed: "", notFollowed: "", notAware: "" }
    ]
  },
  {
    id: 6,
    title: "6. Start / Stop Procedure",
    sectionMarks: "",
    columnTotals: { followed: "", partiallyFollowed: "", notFollowed: "", notAware: "" },
    items: [
      { slNo: 1, parameter: "Does the operator follows Start / Stop Discipline", followed: "", partiallyFollowed: "", notFollowed: "", notAware: "" }
    ]
  },
  {
    id: 7,
    title: "7. Inspection",
    sectionMarks: "",
    columnTotals: { followed: "", partiallyFollowed: "", notFollowed: "", notAware: "" },
    items: [
      { slNo: 1, parameter: "Does the operator aware the inspection standard.", followed: "", partiallyFollowed: "", notFollowed: "", notAware: "" },
      { slNo: 2, parameter: "Does the operator properly check the component as per quality standard.", followed: "", partiallyFollowed: "", notFollowed: "", notAware: "" },
      { slNo: 3, parameter: "Handling of Guages", followed: "", partiallyFollowed: "", notFollowed: "", notAware: "" }
    ]
  },
  {
    id: 8,
    title: "8. Safety / PPE / 5s",
    sectionMarks: "",
    columnTotals: { followed: "", partiallyFollowed: "", notFollowed: "", notAware: "" },
    items: [
      { slNo: 1, parameter: "Does the operator wear the PPE", followed: "", partiallyFollowed: "", notFollowed: "", notAware: "" },
      { slNo: 2, parameter: "Does the operator properly clean the machine & Hand over to shift reliever.", followed: "", partiallyFollowed: "", notFollowed: "", notAware: "" }
    ]
  },
  {
    id: 9,
    title: "9. Change Management",
    sectionMarks: "",
    columnTotals: { followed: "", partiallyFollowed: "", notFollowed: "", notAware: "" },
    items: [
      { slNo: 1, parameter: "Does any temporary changes made in this process", followed: "", partiallyFollowed: "", notFollowed: "", notAware: "" },
      { slNo: 2, parameter: "Does any 4M changes in this process", followed: "", partiallyFollowed: "", notFollowed: "", notAware: "" },
      { slNo: 3, parameter: "Does any changes for customer request or internal requirement", followed: "", partiallyFollowed: "", notFollowed: "", notAware: "" }
    ]
  }
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
      <button onClick={onClose} className="ml-2 font-bold text-lg leading-none hover:text-gray-200 focus:outline-none">
        ×
      </button>
    </div>
  );
};

export default function OperatorObservationSheet() {
  const { shopId } = useParams();
  const navigate = useNavigate();

  const [headerInfo, setHeaderInfo] = useState({
    employeeName: "",
    employeeCode: "",
    department: "Production",
    testDate: getTodayISODate(),
    marksPercentage: "",
    method: "Practical & Demo"
  });

  const [sections, setSections] = useState(DEFAULT_SECTIONS);

  const [footerInfo, setFooterInfo] = useState({
    reviewDate: getTodayISODate(),
    reviewedBy: "",
    approvedBy: "",
    operatorFeedback: ""
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [toast, setToast] = useState({ message: '', type: '' });

  const triggerToast = (message, type = 'error') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast({ message: '', type: '' });
    }, 4000);
  };

  const handleHeaderChange = (field, val) => {
    // Validation for Marks % (0 - 100 with decimals)
    if (field === 'marksPercentage') {
      // Allow empty, or valid numbers between 0 and 100
      if (val === "" || /^\d*\.?\d*$/.test(val)) {
        const num = parseFloat(val);
        if (val === "" || (!isNaN(num) && num >= 0 && num <= 100)) {
          setHeaderInfo((prev) => ({ ...prev, [field]: val }));
        }
      }
      return;
    }

    setHeaderInfo((prev) => ({ ...prev, [field]: val }));
  };

  const handleFooterChange = (field, val) => {
    setFooterInfo((prev) => ({ ...prev, [field]: val }));
  };

  const handleCellChange = (secIdx, itemIdx, colKey, val) => {
    setSections((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      next[secIdx].items[itemIdx][colKey] = val;
      return next;
    });
  };

  const handleSectionMarksChange = (secIdx, val) => {
    setSections((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      next[secIdx].sectionMarks = val;
      return next;
    });
  };

  const handleColumnTotalChange = (secIdx, colKey, val) => {
    setSections((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      next[secIdx].columnTotals[colKey] = val;
      return next;
    });
  };

  const handleSave = async () => {
    if (!headerInfo.employeeName || !headerInfo.employeeCode) {
      triggerToast("Please fill Employee Name and Employee Code before saving.", "error");
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);

    const payload = {
      header: {
        ...headerInfo,
        machineShop: shopId || 3,
        marksPercentage: headerInfo.marksPercentage ? `${headerInfo.marksPercentage}%` : ""
      },
      sections,
      footer: footerInfo
    };

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/operator-observation-sheet`, {
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
      triggerToast(err.message || 'Failed to save Operator Observation Sheet.', 'error');
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
                <p className="text-gray-500 mt-2">Redirecting...</p>
              </>
            )}
          </div>
        </div>
      )}

      <div className="bg-white w-full max-w-[92rem] rounded-xl p-8 shadow-2xl overflow-x-auto border-4 border-gray-100">
        
        {/* Header Title Section */}
        <div className="flex justify-between items-center mb-6 border-b border-gray-200 pb-4">
          <div>
            <span className="text-xs font-bold text-orange-600 tracking-wider uppercase block mb-1">
              {initialFormData.company}
            </span>
            <h2 className="text-2xl font-bold text-gray-800 uppercase tracking-wide">
              {initialFormData.title}
            </h2>
          </div>
          <div className="text-xs text-gray-500 text-right">
            <span>Form Code: {initialFormData.formCode}</span>
            <span className="mx-2">|</span>
            <span>Date: {initialFormData.revisionDate}</span>
          </div>
        </div>

        {/* Top Information Box */}
        <div className="border-2 border-gray-800 mb-6 bg-white">
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x-2 divide-gray-800">
            
            {/* Left Header Box */}
            <div className="p-3 space-y-2 text-sm font-semibold">
              <div className="flex items-center">
                <label className="w-36 text-gray-700">Employee Name</label>
                <span className="mr-2">:</span>
                <input
                  type="text"
                  placeholder="e.g. M. NAGARAJAN"
                  className="flex-1 border-b border-gray-400 focus:border-orange-500 outline-none px-2 py-0.5"
                  value={headerInfo.employeeName}
                  onChange={(e) => handleHeaderChange('employeeName', e.target.value)}
                />
              </div>

              <div className="flex items-center">
                <label className="w-36 text-gray-700">Employee Code</label>
                <span className="mr-2">:</span>
                <input
                  type="text"
                  placeholder="e.g. 710125"
                  className="flex-1 border-b border-gray-400 focus:border-orange-500 outline-none px-2 py-0.5"
                  value={headerInfo.employeeCode}
                  onChange={(e) => handleHeaderChange('employeeCode', e.target.value)}
                />
              </div>

              <div className="flex items-center">
                <label className="w-36 text-gray-700">Department</label>
                <span className="mr-2">:</span>
                <input
                  type="text"
                  placeholder="Production"
                  className="flex-1 border-b border-gray-400 focus:border-orange-500 outline-none px-2 py-0.5"
                  value={headerInfo.department}
                  onChange={(e) => handleHeaderChange('department', e.target.value)}
                />
              </div>
            </div>

            {/* Right Header Box */}
            <div className="p-3 space-y-2 text-sm font-semibold">
              <div className="flex items-center">
                <label className="w-32 text-gray-700">Test Date</label>
                <span className="mr-2">:</span>
                <input
                  type="date"
                  className="flex-1 border-b border-gray-400 focus:border-orange-500 outline-none px-2 py-0.5 bg-transparent"
                  value={headerInfo.testDate}
                  onChange={(e) => handleHeaderChange('testDate', e.target.value)}
                />
              </div>

              {/* User Editable Marks % Input (0 - 100 with decimals) */}
              <div className="flex items-center">
                <label className="w-32 text-gray-700">Marks</label>
                <span className="mr-2">:</span>
                <div className="flex items-center flex-1">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g. 82.4"
                    className="w-28 border-b border-gray-400 focus:border-orange-500 outline-none px-2 py-0.5 font-extrabold text-gray-800"
                    value={headerInfo.marksPercentage}
                    onChange={(e) => handleHeaderChange('marksPercentage', e.target.value)}
                  />
                  <span className="ml-1 font-bold text-gray-700">%</span>
                </div>
              </div>

              <div className="flex items-center">
                <label className="w-32 text-gray-700">Method</label>
                <span className="mr-2">:</span>
                <input
                  type="text"
                  placeholder="Practical & Demo"
                  className="flex-1 border-b border-gray-400 focus:border-orange-500 outline-none px-2 py-0.5"
                  value={headerInfo.method}
                  onChange={(e) => handleHeaderChange('method', e.target.value)}
                />
              </div>
            </div>

          </div>
        </div>

        {/* Observation Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border-2 border-gray-800 text-sm">
            
            {/* Main Headers */}
            <thead className="bg-gray-100 text-gray-900 font-bold text-center">
              <tr>
                <th className="border border-gray-800 p-2 w-16">S.NO.</th>
                <th className="border border-gray-800 p-2 text-left px-4">PARAMETERS</th>
                {RATING_COLUMNS.map((col) => (
                  <th key={col.key} className="border border-gray-800 p-2 w-32 font-bold text-gray-900">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {sections.map((sec, secIdx) => {
                return (
                  <React.Fragment key={`sec-${sec.id}`}>
                    {/* Section Header Row with 5, 3, 1, 0 in dark black */}
                    <tr className="bg-gray-100 font-extrabold text-gray-900 text-sm">
                      <td colSpan={2} className="border border-gray-800 px-3 py-1.5 uppercase tracking-wide">
                        {sec.title}
                      </td>
                      {RATING_COLUMNS.map((col) => (
                        <td key={`sec-pt-${sec.id}-${col.key}`} className="border border-gray-800 p-1 text-center font-extrabold text-gray-900">
                          {col.defaultPoints}
                        </td>
                      ))}
                    </tr>

                    {/* Section Items with Dropdown Cells (Empty default, ✓, X in grey/black) */}
                    {sec.items.map((item, itemIdx) => (
                      <tr key={`item-${sec.id}-${item.slNo}`} className="hover:bg-gray-50">
                        <td className="border border-gray-800 p-2 text-center font-medium">
                          {item.slNo}
                        </td>
                        <td className="border border-gray-800 px-4 py-2 text-gray-800 font-medium">
                          {item.parameter}
                        </td>
                        {RATING_COLUMNS.map((col) => (
                          <td key={`cell-${sec.id}-${item.slNo}-${col.key}`} className="border border-gray-800 p-0 text-center">
                            <select
                              value={item[col.key] || ""}
                              onChange={(e) => handleCellChange(secIdx, itemIdx, col.key, e.target.value)}
                              className="w-full h-full min-h-[36px] text-center font-bold text-base text-gray-900 bg-transparent outline-none cursor-pointer"
                            >
                              <option value=""></option>
                              <option value="✓" className="text-gray-900 font-bold">✓</option>
                              <option value="X" className="text-gray-900 font-bold">X</option>
                            </select>
                          </td>
                        ))}
                      </tr>
                    ))}

                    {/* Manual User Entry for Marks and Column Totals */}
                    <tr className="bg-gray-50 font-bold text-xs text-gray-800">
                      <td className="border border-gray-800 px-2 py-1.5 text-center font-bold">
                        Marks :
                      </td>
                      <td className="border border-gray-800 px-4 py-1.5 flex justify-between items-center">
                        <input
                          type="text"
                          placeholder="Marks"
                          value={sec.sectionMarks || ""}
                          onChange={(e) => handleSectionMarksChange(secIdx, e.target.value)}
                          className="w-24 border border-gray-300 rounded px-2 py-0.5 text-sm font-extrabold text-gray-900 bg-white outline-none focus:ring-1 focus:ring-orange-500"
                        />
                        <span className="uppercase text-gray-700 font-bold text-xs">Total</span>
                      </td>
                      {RATING_COLUMNS.map((col) => (
                        <td key={`col-tot-${sec.id}-${col.key}`} className="border border-gray-800 p-0 text-center">
                          <input
                            type="text"
                            placeholder="Total"
                            value={sec.columnTotals[col.key] || ""}
                            onChange={(e) => handleColumnTotalChange(secIdx, col.key, e.target.value)}
                            className="w-full h-full text-center px-1 py-1 font-bold text-gray-900 bg-transparent outline-none"
                          />
                        </td>
                      ))}
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer Remarks / Feedback / Signatures */}
        <div className="mt-6 border-2 border-gray-800 bg-white">
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x-2 divide-gray-800 p-3 text-sm font-semibold">
            <div className="flex items-center gap-2">
              <label className="text-gray-700">Date:</label>
              <input
                type="date"
                className="border-b border-gray-400 outline-none px-2 py-0.5 bg-transparent"
                value={footerInfo.reviewDate}
                onChange={(e) => handleFooterChange('reviewDate', e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 px-2">
              <label className="text-gray-700">Reviewed By:</label>
              <input
                type="text"
                placeholder="Sign / Name"
                className="flex-1 border-b border-gray-400 outline-none px-2 py-0.5"
                value={footerInfo.reviewedBy}
                onChange={(e) => handleFooterChange('reviewedBy', e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 px-2">
              <label className="text-gray-700">Approved By:</label>
              <input
                type="text"
                placeholder="Sign / Name"
                className="flex-1 border-b border-gray-400 outline-none px-2 py-0.5"
                value={footerInfo.approvedBy}
                onChange={(e) => handleFooterChange('approvedBy', e.target.value)}
              />
            </div>
          </div>

          <div className="border-t-2 border-gray-800 bg-gray-50 px-4 py-2 text-xs font-bold text-gray-800">
            NOTE:- 75% More than score = GOOD
          </div>

          <div className="border-t-2 border-gray-800 p-3">
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Operator feed back :
            </label>
            <textarea
              rows={3}
              placeholder="Enter operator feedback or remarks..."
              className="w-full border border-gray-300 p-2 text-sm rounded outline-none focus:ring-1 focus:ring-orange-500 font-medium"
              value={footerInfo.operatorFeedback}
              onChange={(e) => handleFooterChange('operatorFeedback', e.target.value)}
            />
          </div>
        </div>

        {/* Action Button & Meta */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-6 pt-4 border-t border-gray-300">
          <span className="text-xs text-gray-500 font-semibold">
            {initialFormData.formCode}, {initialFormData.revisionDate}
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