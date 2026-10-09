import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FileDown } from "lucide-react";
import Header from '../components/Header';

const questions = [
  { id: 1, text: "1. What is offset wear?", options: ["A) To compensate tool wear", "B) The machine distance from component zero to machine zero", "C) Both"] },
  { id: 2, text: "2. What is offset geometry?", options: ["A) To compensate tool wear", "B) The machine distance from component zero to machine zero", "C) Both"] },
  { id: 3, text: "3. What is over adjustment?", options: ["A) Giving frequent offset", "B) Adjusting the tool", "C) Adjusting the tool block"] },
  { id: 4, text: "4. Define types of feed?", options: ["A) mm per min", "B) mm per rev", "C) both mm per min and mm per rev"] },
  { id: 5, text: "5. What are the gauges used in your machine?", options: ["A) Bore dial gauge, plug gauge, snap gauge, width gauge,", "B) Slip gauge, height Vernier", "C) Surface tester"] },
  { id: 6, text: "6. What is least count?", options: ["A) Least possible value that can be measured by an equipment", "B) The last value that can be measured by an equipment", "C) Range of the equipment"] },
  { id: 7, text: "7. What is calibration?", options: ["A) Evaluating the status of a gauge in a standard room against the standard", "B) Finding out the status of a gauge in shop floor", "C) Checking the range of the gauge"] },
  { id: 8, text: "8. What is MARU A?", options: ["A) It denotes safety part and safety parameter", "B) It denotes tolerance", "C) It denotes dimension"] },
  { id: 9, text: "9. Define cutting speed formula?", options: ["A) VC = πdn / 1000", "B) D = VC * 1000 / πd", "C) None of the above"] },
  { id: 10, text: "10. Safety procedure to be followed in VTL & HTL machines.", options: ["A) As per work instruction for VTL & HTL", "B) As per work instruction for VMC & HMC", "C) Both"] },
  { id: 11, text: "11. Insert is made up of the following materials?", options: ["A) Carbide, Ceramic, Cbn, Cermet", "B) Carbide, Ceramic", "C) Cbn, Cermet"] },
  { id: 12, text: "12. Types of tool holders?", options: ["A) Boring bar, Facing bar, Grooving holder, Reverse boring bar", "B) Boring bar", "C) Facing bar"] },
  { id: 13, text: "13. Define turning basic principle?", options: ["A) Component rotate tool static", "B) Component static tool rotate", "C) Component and tool both rotate"] },
  { id: 14, text: "14. Define types of speed?", options: ["A) Constant speed and constant surface speed", "B) Constant speed", "C) constant surface speed"] },
  { id: 15, text: "15. Types of chuck we use?", options: ["A) Three Jaw Chuck, Four Jaw Chuck", "B) Pull Down Chuck, Face Clamp Chuck", "C) All the above"] },
  { id: 16, text: "16. Constant speed is used in", options: ["A) In constant diameter", "B) Variable diameter", "C) In both situation"] },
  { id: 17, text: "17. Constant surface speed is used in", options: ["A) Variable diameter", "B) Constant diameter", "C) In both situation"] },
  { id: 18, text: "18. Process flow diagram shows", options: ["A) The flow in which the line is running", "B) The flow of operation in a single machine", "C) All the above"] },
  { id: 19, text: "19. POKOYOKE is used to prevent", options: ["A) Misloading of component", "B) For easy loading of component", "C) For easy handling of component"] },
  { id: 20, text: "20. KAIZEN means", options: ["A) Continual improvement", "B) Small Improvement", "C) No Improvement"] }
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

export default function CompetencyExamVtlHtl() {
  const { shopId } = useParams();
  const navigate = useNavigate();

  const [headerInfo, setHeaderInfo] = useState({
    employeeNo: "",
    employeeName: "",
    line: "",
    doj: "",
    examDate: getTodayISODate(),
    qualification: "",
    evaluatedBy: ""
  });

  const [lineCodes, setLineCodes] = useState([]);
  const [loadingLines, setLoadingLines] = useState(true);
  const [answers, setAnswers] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [toast, setToast] = useState({ message: '', type: '' });

  const triggerToast = (message, type = 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: '', type: '' }), 4000);
  };

  // Fetch Line Codes
  useEffect(() => {
    const fetchLineCodes = async () => {
      try {
        const token = localStorage.getItem("token");
        const headers = { Authorization: `Bearer ${token}` };
        const url = shopId 
          ? `${process.env.REACT_APP_API_URL}/api/competency-exam/lines?shopId=${shopId}`
          : `${process.env.REACT_APP_API_URL}/api/competency-exam/lines`;

        const res = await fetch(url, { headers });
        if (!res.ok) throw new Error("Failed to fetch line codes");
        
        const data = await res.json();
        setLineCodes(data);
      } catch (err) {
        triggerToast("Failed to load line codes.", "error");
      } finally {
        setLoadingLines(false);
      }
    };
    fetchLineCodes();
  }, [shopId]);

  // Fetch Saved Exam Data on Same Line Code, Date, and Emp No
  useEffect(() => {
    const fetchSavedExamData = async () => {
      if (!headerInfo.employeeNo || !headerInfo.line || !headerInfo.examDate) return;

      try {
        const token = localStorage.getItem('token');
        const params = new URLSearchParams({
          employeeNo: headerInfo.employeeNo,
          line: headerInfo.line,
          examDate: headerInfo.examDate
        });

        const res = await fetch(`${process.env.REACT_APP_API_URL}/api/competency-exam?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!res.ok) {
          setAnswers({});
          return;
        }

        const data = await res.json();
        if (data) {
          setHeaderInfo((prev) => ({
            ...prev,
            employeeName: data.employeeName || "",
            doj: data.doj ? data.doj.split('T')[0] : "",
            qualification: data.qualification || "",
            evaluatedBy: data.evaluatedBy || ""
          }));
          setAnswers(JSON.parse(data.answers || '{}'));
          triggerToast("Fetched saved exam record.", "success");
        }
      } catch (err) {
        console.error('Fetch saved exam error:', err);
      }
    };

    fetchSavedExamData();
  }, [headerInfo.employeeNo, headerInfo.line, headerInfo.examDate]);

  const handleHeaderChange = (field, val) => {
    setHeaderInfo((prev) => ({ ...prev, [field]: val }));
  };

  const handleOptionChange = (qId, optionKey) => {
    setAnswers((prev) => ({ ...prev, [qId]: optionKey }));
  };

  const handleDownloadPdf = async () => {
    if (!headerInfo.employeeNo || !headerInfo.line || !headerInfo.examDate) {
      triggerToast("Please ensure Employee No, Line, and Date are selected.", "error");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const queryParams = new URLSearchParams({
        employeeNo: headerInfo.employeeNo,
        line: headerInfo.line,
        examDate: headerInfo.examDate
      });

      const url = `${process.env.REACT_APP_API_URL}/api/competency-exam/report?${queryParams.toString()}`;
      triggerToast("Downloading PDF from server...", "success");

      const response = await fetch(url, { method: "GET", headers: { Authorization: `Bearer ${token}` } });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("No data recorded for this specific date and line.");
        }
        throw new Error("Failed to generate PDF from the server.");
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `Competency_Exam_${headerInfo.employeeNo}_${headerInfo.examDate}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      triggerToast(err.message || "Failed to download PDF", "error");
    }
  };

  const handleSave = async () => {
    if (!headerInfo.employeeNo || !headerInfo.employeeName || !headerInfo.line || !headerInfo.examDate) {
      triggerToast("Please fill all mandatory header fields.", "error");
      return;
    }

    if (Object.keys(answers).length < questions.length) {
      triggerToast("Please answer all 20 questions before submitting.", "error");
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const token = localStorage.getItem('token');
      const payload = { header: headerInfo, answers };

      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/competency-exam`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Save failed');

      setIsSaving(false);
      setSaveSuccess(true);
      triggerToast("Exam saved successfully!", "success");
      await new Promise((resolve) => setTimeout(resolve, 2000));
      if (shopId) navigate(`/shift-incharge/${shopId}`);
    } catch (err) {
      setIsSaving(false);
      triggerToast(err.message || 'Failed to save exam.', 'error');
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
        <div className="flex justify-between items-center mb-6 border-b border-gray-200 pb-4">
          <div>
            <span className="text-xs font-bold text-orange-600 tracking-wider uppercase block mb-1">
              SAKTHI AUTO COMPONENT LIMITED
            </span>
            <h2 className="text-2xl font-bold text-gray-800 uppercase tracking-wide">
              LEVEL 3 COMPETENCY QUALIFICATION
            </h2>
            <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-2 font-semibold">
              <span>VTL & HTL MACHINE</span>
              <span>|</span>
              <span>Time: 1 Hour</span>
              <span>|</span>
              <span>Each Question: 5 Marks</span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider shadow transition-colors"
          >
            <FileDown className="w-4 h-4" /> Download Report
          </button>
        </div>

        {/* Header Information Form */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
          <div>
            <label className="font-bold text-gray-700 block mb-1 text-sm">Emp No</label>
            <input
              type="text"
              className="w-full border border-gray-300 p-2 rounded text-sm font-semibold bg-white"
              value={headerInfo.employeeNo}
              onChange={(e) => handleHeaderChange('employeeNo', e.target.value)}
            />
          </div>
          <div>
            <label className="font-bold text-gray-700 block mb-1 text-sm">Name</label>
            <input
              type="text"
              className="w-full border border-gray-300 p-2 rounded text-sm font-semibold bg-white"
              value={headerInfo.employeeName}
              onChange={(e) => handleHeaderChange('employeeName', e.target.value)}
            />
          </div>
          <div>
            <label className="font-bold text-gray-700 block mb-1 text-sm">Line Code</label>
            <select
              className="w-full border border-gray-300 p-2 rounded text-sm font-semibold bg-white"
              value={headerInfo.line}
              onChange={(e) => handleHeaderChange('line', e.target.value)}
              disabled={loadingLines}
            >
              <option value="">{loadingLines ? "Loading..." : "Select Line Code"}</option>
              {lineCodes.map((lineCode) => (
                <option key={lineCode} value={lineCode}>{lineCode}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="font-bold text-gray-700 block mb-1 text-sm">DOJ</label>
            <input
              type="date"
              className="w-full border border-gray-300 p-2 rounded text-sm font-semibold bg-white"
              value={headerInfo.doj}
              onChange={(e) => handleHeaderChange('doj', e.target.value)}
            />
          </div>
          <div>
            <label className="font-bold text-gray-700 block mb-1 text-sm">Date</label>
            <input
              type="date"
              className="w-full border border-gray-300 p-2 rounded text-sm font-semibold bg-white"
              value={headerInfo.examDate}
              onChange={(e) => handleHeaderChange('examDate', e.target.value)}
            />
          </div>
          <div>
            <label className="font-bold text-gray-700 block mb-1 text-sm">Qualification</label>
            <input
              type="text"
              className="w-full border border-gray-300 p-2 rounded text-sm font-semibold bg-white"
              value={headerInfo.qualification}
              onChange={(e) => handleHeaderChange('qualification', e.target.value)}
            />
          </div>
        </div>

        {/* Questions Block */}
        <div className="space-y-4">
          {questions.map((q) => (
            <div key={q.id} className="p-4 border border-gray-300 rounded-lg bg-white shadow-sm">
              <p className="font-bold text-gray-800 text-sm mb-3">{q.text}</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {q.options.map((opt, idx) => {
                  const optionKey = String.fromCharCode(65 + idx);
                  return (
                    <label
                      key={idx}
                      className={`flex items-center gap-2 p-2 border rounded cursor-pointer text-xs font-semibold ${
                        answers[q.id] === optionKey ? 'border-orange-500 bg-orange-50' : 'border-gray-200'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`question-${q.id}`}
                        value={optionKey}
                        checked={answers[q.id] === optionKey}
                        onChange={() => handleOptionChange(q.id, optionKey)}
                        className="text-orange-500 focus:ring-orange-400"
                      />
                      <span>{opt}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Footer Section */}
        <div className="mt-8 pt-4 border-t border-gray-300 flex flex-wrap justify-between items-center gap-4">
          <div className="w-full md:w-1/3">
            <label className="font-bold text-gray-700 block mb-1 text-sm">EVALUATED BY</label>
            <input
              type="text"
              className="w-full border border-gray-300 p-2 rounded text-sm font-semibold bg-white"
              value={headerInfo.evaluatedBy}
              onChange={(e) => handleHeaderChange('evaluatedBy', e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || saveSuccess}
            className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white px-10 py-3 rounded font-bold uppercase tracking-wide text-sm shadow"
          >
            {isSaving ? "SAVING..." : saveSuccess ? "SAVED ✓" : "SAVE & CONTINUE"}
          </button>
        </div>
      </div>
    </div>
  );
}