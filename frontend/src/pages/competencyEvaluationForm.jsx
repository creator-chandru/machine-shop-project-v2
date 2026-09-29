import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '../components/Header';

const initialFormData = {
  formCode: "QF/06/ADM - 04",
  revisionDate: "01.11.2018",
  title: "COMPETENCY EVALUATION FORM",
  subtitle: "(PRACTICAL) - VTL & HTL",
  company: "SAKTHI AUTO COMPONENT LIMITED",
  level: "LEVEL - 3"
};

const INITIAL_QUESTIONS = [
  { qNo: 1, questionText: "DOES THE OPERATOR PERFORM HAND OVER TAKE OVER PROPERLY", ok: "", partial: "", notOk: "" },
  { qNo: 2, questionText: "DOES THE OPERATOR FOLLOW START STOP PROCEDURE", ok: "", partial: "", notOk: "" },
  { qNo: 3, questionText: "DOES THE OPERATOR FOLLOW 5S IN HIS MACHINE AREA", ok: "", partial: "", notOk: "" },
  { qNo: 4, questionText: "DOES THE OPERATOR REFER WORK INSTRUCTION DURING RUNNING THE MACHINE", ok: "", partial: "", notOk: "" },
  { qNo: 5, questionText: "DOES THE OPERATOR REFER PROCESS SHEET DURING CHECKING COMPONENT", ok: "", partial: "", notOk: "" },
  { qNo: 6, questionText: "DOES THE OPERATOR CHECK PART AS PER THE FREQUENCY IN PROCESS SHEET", ok: "", partial: "", notOk: "" },
  { qNo: 7, questionText: "DOES THE OPERATOR CHANGE TOOLS AS PER TOOL LIFE", ok: "", partial: "", notOk: "" },
  { qNo: 8, deliberate: "", questionText: "DOES THE OPERATOR FOLLOW REACTION PLAN DURING NC PART PRODUCED", ok: "", partial: "", notOk: "" },
  { qNo: 9, questionText: "DOES THE OPERATOR FOLLOW NC HANDLING PROCEDURE", ok: "", partial: "", notOk: "" },
  { qNo: 10, questionText: "DOES THE OPERATOR CHECK AND FILL PRE-OPERATION CHECK SHEET", ok: "", partial: "", notOk: "" },
  { qNo: 11, questionText: "DOES THE OPERATOR PERFORM SIGNIFICANT EVENT RECORD DURING TOOL CHANGE", ok: "", partial: "", notOk: "" },
  { qNo: 12, questionText: "DOES THE OPERATOR FOLLOW CALIBRATION STATUS", ok: "", partial: "", notOk: "" },
  { qNo: 13, questionText: "DOES THE OPERATOR FOLLOW SAFETY RULES AND WEAR PPE AS PER PLAN", ok: "", partial: "", notOk: "" },
  { qNo: 14, questionText: "DOES THE OPERATOR INFORM INCHARGE DURING UNUSUAL SITUATION", ok: "", partial: "", notOk: "" },
  { qNo: 15, questionText: "DOES THE OPERATOR FOLLOW UNUSUAL SITUATION MANAGEMENT PROCEDURE", ok: "", partial: "", notOk: "" },
  { qNo: 16, questionText: "DOES THE OPERATOR AWARE OF MARU A", ok: "", partial: "", notOk: "" },
  { qNo: 17, questionText: "DOES THE OPERATOR AWARE OF THE CONSEQUENCES IN FAILURE OF MARU A PARAMETER", ok: "", partial: "", notOk: "" },
  { qNo: 18, questionText: "DOES THE OPERATOR AWARE OF AIR GAP SENSOR", ok: "", partial: "", notOk: "" },
  { qNo: 19, questionText: "DOES THE OPERATOR CHECK VISUAL DEFECTS", ok: "", partial: "", notOk: "" },
  { qNo: 20, questionText: "DOES THE OPERATOR AWARE OF PREVIOUS QUALITY PROBLEM AND CORRECTIVE ACTION", ok: "", partial: "", notOk: "" }
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

export default function CompetencyEvaluationForm() {
  const { shopId } = useParams();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('front'); // 'front' | 'back'

  // Header State
  const [headerInfo, setHeaderInfo] = useState({
    name: "",
    employeeNo: "",
    qualification: "",
    date: getTodayISODate(),
    doj: "",
    line: "",
    levelBadge: "LEVEL - 3"
  });

  // Questions State
  const [questions, setQuestions] = useState(INITIAL_QUESTIONS);

  // Overall Mark & Result State (Back Page)
  const [writtenExamMark, setWrittenExamMark] = useState("");
  const [status, setStatus] = useState(""); // "" | "PASS" | "FAIL"

  // Signatures State
  const [signatures, setSignatures] = useState({
    inchargeSign: "",
    evaluatedBy: "",
    hodSign: ""
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
    setHeaderInfo((prev) => ({ ...prev, [field]: val }));
  };

  // Dropdown Single-Select Handler per Row
  const handleDropdownChange = (qIndex, selectedCol, value) => {
    setQuestions((prev) => {
      const next = [...prev];
      const current = { ...next[qIndex] };

      if (value === "") {
        current[selectedCol] = "";
      } else {
        // Clear all columns first, then set the selected one
        current.ok = "";
        current.partial = "";
        current.notOk = "";
        current[selectedCol] = value;
      }

      next[qIndex] = current;
      return next;
    });
  };

  // Calculate Practical Exam Score
  // OK with "✓" = 2 marks, PARTIAL with "✓" = 1 mark, NOT OK with "✓" = 0 mark
  const practicalExamMark = questions.reduce((sum, q) => {
    if (q.ok === "✓") return sum + 2;
    if (q.partial === "✓") return sum + 1;
    return sum;
  }, 0);

  const practicalPercentage = `${((practicalExamMark / 40) * 100).toFixed(0)}%`;
  const writtenPercentage = writtenExamMark !== "" ? `${((parseFloat(writtenExamMark) / 100) * 100).toFixed(0)}%` : "";

  const handleSave = async () => {
    if (!headerInfo.name || !headerInfo.employeeNo) {
      triggerToast("Please fill Employee Name and Employee No before saving.", "error");
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);

    // Map questions with computed score
    const processedQuestions = questions.map((q) => {
      let rating = "";
      let mark = null;

      if (q.ok === "✓") { rating = "OK"; mark = 2; }
      else if (q.partial === "✓") { rating = "PARTIAL"; mark = 1; }
      else if (q.notOk === "✓") { rating = "NOT OK"; mark = 0; }
      else if (q.ok === "X" || q.partial === "X" || q.notOk === "X") { rating = "FAIL"; mark = 0; }

      return {
        qNo: q.qNo,
        questionText: q.questionText,
        rating,
        mark
      };
    });

    const payload = {
      header: {
        ...headerInfo,
        machineShop: shopId || 3
      },
      questions: processedQuestions,
      overallMark: {
        writtenExamMark: writtenExamMark || 0,
        writtenExamPercentage: writtenPercentage,
        practicalExamMark,
        practicalExamPercentage: practicalPercentage,
        status
      },
      signatures
    };

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/competency-evaluation-form`, {
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
      triggerToast(err.message || 'Failed to save Competency Evaluation Form.', 'error');
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
        
        {/* Navigation Tabs between Front Page & Back Page */}
        <div className="flex gap-2 mb-6 border-b border-gray-300 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('front')}
            className={`px-6 py-2.5 rounded-t-lg font-bold text-sm transition-colors ${
              activeTab === 'front'
                ? 'bg-orange-500 text-white shadow'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            FRONT PAGE : PRACTICAL QUESTIONS
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('back')}
            className={`px-6 py-2.5 rounded-t-lg font-bold text-sm transition-colors ${
              activeTab === 'back'
                ? 'bg-orange-500 text-white shadow'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            BACK PAGE : EVALUATION CRITERIA & OVERALL RESULT
          </button>
        </div>

        {/* FRONT PAGE VIEW */}
        {activeTab === 'front' && (
          <div>
            {/* Front Header */}
            <div className="border-2 border-gray-800 mb-6">
              <div className="grid grid-cols-12 divide-x-2 divide-gray-800 border-b-2 border-gray-800">
                <div className="col-span-3 p-3 flex items-center justify-center">
                  <span className="font-extrabold text-sm text-gray-800 uppercase text-center">
                    {initialFormData.company}
                  </span>
                </div>
                <div className="col-span-6 p-3 text-center">
                  <h2 className="text-lg font-extrabold text-gray-900 uppercase">
                    {initialFormData.title}
                  </h2>
                  <h3 className="text-xs font-bold text-gray-700 uppercase">
                    {initialFormData.subtitle}
                  </h3>
                </div>
                <div className="col-span-3 p-3 flex items-center justify-center bg-gray-50">
                  <span className="font-extrabold text-gray-900 text-base">
                    {initialFormData.level}
                  </span>
                </div>
              </div>

              {/* Meta Input Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x-2 divide-gray-800 p-3 text-sm font-semibold">
                <div className="space-y-2 pr-2">
                  <div className="flex items-center">
                    <label className="w-36 text-gray-700">NAME :</label>
                    <input
                      type="text"
                      className="flex-1 border-b border-gray-400 focus:border-orange-500 outline-none px-2 py-0.5"
                      value={headerInfo.name}
                      onChange={(e) => handleHeaderChange('name', e.target.value)}
                    />
                  </div>
                  <div className="flex items-center">
                    <label className="w-36 text-gray-700">EMPLOYEE NO :</label>
                    <input
                      type="text"
                      className="flex-1 border-b border-gray-400 focus:border-orange-500 outline-none px-2 py-0.5"
                      value={headerInfo.employeeNo}
                      onChange={(e) => handleHeaderChange('employeeNo', e.target.value)}
                    />
                  </div>
                  <div className="flex items-center">
                    <label className="w-36 text-gray-700">QUALIFICATION :</label>
                    <input
                      type="text"
                      className="flex-1 border-b border-gray-400 focus:border-orange-500 outline-none px-2 py-0.5"
                      value={headerInfo.qualification}
                      onChange={(e) => handleHeaderChange('qualification', e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2 pl-2">
                  <div className="flex items-center">
                    <label className="w-32 text-gray-700">DATE :</label>
                    <input
                      type="date"
                      className="flex-1 border-b border-gray-400 focus:border-orange-500 outline-none px-2 py-0.5 bg-transparent"
                      value={headerInfo.date}
                      onChange={(e) => handleHeaderChange('date', e.target.value)}
                    />
                  </div>
                  <div className="flex items-center">
                    <label className="w-32 text-gray-700">DOJ :</label>
                    <input
                      type="date"
                      className="flex-1 border-b border-gray-400 focus:border-orange-500 outline-none px-2 py-0.5 bg-transparent"
                      value={headerInfo.doj}
                      onChange={(e) => handleHeaderChange('doj', e.target.value)}
                    />
                  </div>
                  <div className="flex items-center">
                    <label className="w-32 text-gray-700">LINE :</label>
                    <input
                      type="text"
                      className="flex-1 border-b border-gray-400 focus:border-orange-500 outline-none px-2 py-0.5"
                      value={headerInfo.line}
                      onChange={(e) => handleHeaderChange('line', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Questions Table */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border-2 border-gray-800 text-sm">
                <thead>
                  <tr className="bg-gray-200 text-gray-900 font-bold">
                    <th rowSpan={3} className="border border-gray-800 p-2 w-16 text-center">S.NO</th>
                    <th rowSpan={3} className="border border-gray-800 p-2 text-left px-4">QUESTIONS</th>
                    <th colSpan={3} className="border border-gray-800 p-1 text-center uppercase tracking-wider">MARKS</th>
                  </tr>
                  <tr className="bg-gray-100 text-gray-900 font-extrabold text-center">
                    <th className="border border-gray-800 p-1 w-24">2</th>
                    <th className="border border-gray-800 p-1 w-24">1</th>
                    <th className="border border-gray-800 p-1 w-24">0</th>
                  </tr>
                  <tr className="bg-gray-100 text-gray-900 font-bold text-center">
                    <th className="border border-gray-800 p-1">OK</th>
                    <th className="border border-gray-800 p-1">PARTIAL</th>
                    <th className="border border-gray-800 p-1">NOT OK</th>
                  </tr>
                </thead>
                <tbody>
                  {questions.map((q, qIdx) => (
                    <tr key={`q-${q.qNo}`} className="hover:bg-gray-50">
                      <td className="border border-gray-800 p-2 text-center font-bold">{q.qNo}</td>
                      <td className="border border-gray-800 px-4 py-2 font-medium text-gray-800">{q.questionText}</td>

                      {/* Dropdown for OK (2) */}
                      <td className="border border-gray-800 p-0 text-center">
                        <select
                          value={q.ok}
                          onChange={(e) => handleDropdownChange(qIdx, 'ok', e.target.value)}
                          className="w-full h-full min-h-[34px] text-center font-bold text-base text-gray-900 bg-transparent outline-none cursor-pointer"
                        >
                          <option value=""></option>
                          <option value="✓">✓</option>
                          <option value="X">X</option>
                        </select>
                      </td>

                      {/* Dropdown for PARTIAL (1) */}
                      <td className="border border-gray-800 p-0 text-center">
                        <select
                          value={q.partial}
                          onChange={(e) => handleDropdownChange(qIdx, 'partial', e.target.value)}
                          className="w-full h-full min-h-[34px] text-center font-bold text-base text-gray-900 bg-transparent outline-none cursor-pointer"
                        >
                          <option value=""></option>
                          <option value="✓">✓</option>
                          <option value="X">X</option>
                        </select>
                      </td>

                      {/* Dropdown for NOT OK (0) */}
                      <td className="border border-gray-800 p-0 text-center">
                        <select
                          value={q.notOk}
                          onChange={(e) => handleDropdownChange(qIdx, 'notOk', e.target.value)}
                          className="w-full h-full min-h-[34px] text-center font-bold text-base text-gray-900 bg-transparent outline-none cursor-pointer"
                        >
                          <option value=""></option>
                          <option value="✓">✓</option>
                          <option value="X">X</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Front Page Footer Notes & Signatures */}
            <div className="mt-6 border-2 border-gray-800 p-4 bg-white text-xs font-bold text-gray-800 space-y-1">
              <div>Note:- 1) NOT OK & PARTIAL SHOULD BE TAKEN TO RETRAINING</div>
              <div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;2) PRODUCTION TARGET ACHIEVED SHOULD BE 85%</div>
              <div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;3) QUALITY LEVEL 90% ABOVE SHOULD BE PASSED TO LEVEL-3</div>

              <div className="grid grid-cols-2 gap-4 pt-6 border-t border-gray-300 mt-4 text-sm font-semibold">
                <div className="flex items-center gap-2">
                  <label>INCHARGE SIGN :</label>
                  <input
                    type="text"
                    placeholder="Sign"
                    className="flex-1 border-b border-gray-400 outline-none px-2 py-0.5"
                    value={signatures.inchargeSign}
                    onChange={(e) => setSignatures((prev) => ({ ...prev, inchargeSign: e.target.value }))}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label>EVALUATED BY :</label>
                  <input
                    type="text"
                    placeholder="Sign"
                    className="flex-1 border-b border-gray-400 outline-none px-2 py-0.5"
                    value={signatures.evaluatedBy}
                    onChange={(e) => setSignatures((prev) => ({ ...prev, evaluatedBy: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* BACK PAGE VIEW */}
        {activeTab === 'back' && (
          <div className="space-y-6">
            
            {/* Criteria Header */}
            <div className="border-2 border-gray-800 flex justify-between items-center bg-gray-200 px-4 py-2 font-extrabold text-gray-900">
              <span className="text-base uppercase">EVALUATION CRITERIA</span>
              <span className="text-base uppercase bg-white border border-gray-800 px-3 py-0.5 rounded">LEVEL - 3</span>
            </div>

            {/* Written Exam Criteria Table (Fixed) */}
            <div className="border-2 border-gray-800">
              <div className="bg-gray-100 font-extrabold text-sm px-4 py-2 border-b-2 border-gray-800">
                WRITTEN EXAM
              </div>
              <table className="w-full border-collapse text-sm text-left">
                <thead className="bg-gray-50 border-b border-gray-800 font-bold">
                  <tr>
                    <th className="p-2 border-r border-gray-800 w-16 text-center">S.NO</th>
                    <th className="p-2 border-r border-gray-800">DESCRIPTION</th>
                    <th className="p-2 w-48 text-center">DETAILS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800 font-medium">
                  <tr><td className="p-2 border-r border-gray-800 text-center font-bold">1</td><td className="p-2 border-r border-gray-800">NUMBER OF QUESTIONS</td><td className="p-2 text-center font-bold">20</td></tr>
                  <tr><td className="p-2 border-r border-gray-800 text-center font-bold">2</td><td className="p-2 border-r border-gray-800">EACH QUESTION MARK</td><td className="p-2 text-center font-bold">5</td></tr>
                  <tr><td className="p-2 border-r border-gray-800 text-center font-bold">3</td><td className="p-2 border-r border-gray-800">TOTAL MARKS (20*5)</td><td className="p-2 text-center font-bold">100</td></tr>
                  <tr><td className="p-2 border-r border-gray-800 text-center font-bold">4</td><td className="p-2 border-r border-gray-800">PASS MARK</td><td className="p-2 text-center font-bold">80</td></tr>
                  <tr><td className="p-2 border-r border-gray-800 text-center font-bold">5</td><td className="p-2 border-r border-gray-800">PASS MARK CRITERIA</td><td className="p-2 text-center font-bold">80%</td></tr>
                </tbody>
              </table>
            </div>

            {/* Practical Exam Criteria Table (Fixed) */}
            <div className="border-2 border-gray-800">
              <div className="bg-gray-100 font-extrabold text-sm px-4 py-2 border-b-2 border-gray-800">
                PRACTICAL EXAM
              </div>
              <table className="w-full border-collapse text-sm text-left">
                <thead className="bg-gray-50 border-b border-gray-800 font-bold">
                  <tr>
                    <th className="p-2 border-r border-gray-800 w-16 text-center">S.NO</th>
                    <th className="p-2 border-r border-gray-800">DESCRIPTION</th>
                    <th className="p-2 w-48 text-center">DETAILS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800 font-medium">
                  <tr><td className="p-2 border-r border-gray-800 text-center font-bold">1</td><td className="p-2 border-r border-gray-800">NUMBER OF QUESTIONS</td><td className="p-2 text-center font-bold">20</td></tr>
                  <tr><td className="p-2 border-r border-gray-800 text-center font-bold">2</td><td className="p-2 border-r border-gray-800">EACH QUESTION MARK</td><td className="p-2 text-center font-bold">2</td></tr>
                  <tr><td className="p-2 border-r border-gray-800 text-center font-bold">3</td><td className="p-2 border-r border-gray-800">TOTAL MARKS (20*2)</td><td className="p-2 text-center font-bold">40</td></tr>
                  <tr><td className="p-2 border-r border-gray-800 text-center font-bold">4</td><td className="p-2 border-r border-gray-800">PASS MARK</td><td className="p-2 text-center font-bold">36</td></tr>
                  <tr><td className="p-2 border-r border-gray-800 text-center font-bold">5</td><td className="p-2 border-r border-gray-800">PASS MARK CRITERIA</td><td className="p-2 text-center font-bold">90%</td></tr>
                </tbody>
              </table>
            </div>

            {/* Overall Mark Table with Status Dropdown */}
            <div className="border-2 border-gray-800">
              <div className="bg-gray-100 font-extrabold text-sm px-4 py-2 border-b-2 border-gray-800 uppercase">
                OVERALL MARK
              </div>
              <table className="w-full border-collapse text-sm text-left">
                <thead className="bg-gray-50 border-b border-gray-800 font-bold">
                  <tr>
                    <th className="p-2 border-r border-gray-800 w-16 text-center">S.NO</th>
                    <th className="p-2 border-r border-gray-800">DESCRIPTION</th>
                    <th className="p-2 border-r border-gray-800 w-48 text-center">MARK</th>
                    <th className="p-2 w-48 text-center">PERCENTAGE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800 font-medium">
                  <tr>
                    <td className="p-2 border-r border-gray-800 text-center font-bold">1</td>
                    <td className="p-2 border-r border-gray-800 font-semibold">SCORED MARK IN WRITTEN EXAM</td>
                    <td className="p-0 border-r border-gray-800">
                      <input
                        type="number"
                        placeholder="e.g. 85 (out of 100)"
                        className="w-full h-full text-center p-2 outline-none font-bold"
                        value={writtenExamMark}
                        onChange={(e) => setWrittenExamMark(e.target.value)}
                      />
                    </td>
                    <td className="p-2 text-center font-extrabold text-gray-800">{writtenPercentage || "-"}</td>
                  </tr>
                  <tr>
                    <td className="p-2 border-r border-gray-800 text-center font-bold">2</td>
                    <td className="p-2 border-r border-gray-800 font-semibold">SCORED MARK IN PRACTICAL EXAM</td>
                    <td className="p-2 border-r border-gray-800 text-center font-extrabold text-gray-900 bg-gray-50">
                      {practicalExamMark} (out of 40)
                    </td>
                    <td className="p-2 text-center font-extrabold text-gray-800 bg-gray-50">{practicalPercentage}</td>
                  </tr>

                  {/* Status Dropdown Row */}
                  <tr className="bg-gray-100 font-extrabold">
                    <td colSpan={2} className="p-3 text-right uppercase text-sm border-r border-gray-800">
                      STATUS :
                    </td>
                    <td colSpan={2} className="p-1 text-center">
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className="w-48 border-2 border-gray-800 p-1.5 rounded font-extrabold text-sm outline-none cursor-pointer bg-white text-center"
                      >
                        <option value="">Select Status</option>
                        <option value="PASS" className="text-green-700 font-bold">PASS</option>
                        <option value="FAIL" className="text-red-700 font-bold">FAIL</option>
                      </select>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Back Page Signatures */}
            <div className="border-2 border-gray-800 p-4 bg-white">
              <div className="grid grid-cols-2 gap-8 text-sm font-semibold">
                <div className="flex items-center gap-2">
                  <label className="w-36">INCHARGE SIGN :</label>
                  <input
                    type="text"
                    placeholder="Sign"
                    className="flex-1 border-b border-gray-400 outline-none px-2 py-0.5"
                    value={signatures.inchargeSign}
                    onChange={(e) => setSignatures((prev) => ({ ...prev, inchargeSign: e.target.value }))}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="w-32">HOD SIGN :</label>
                  <input
                    type="text"
                    placeholder="Sign"
                    className="flex-1 border-b border-gray-400 outline-none px-2 py-0.5"
                    value={signatures.hodSign}
                    onChange={(e) => setSignatures((prev) => ({ ...prev, hodSign: e.target.value }))}
                  />
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Global Save Button & Meta */}
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