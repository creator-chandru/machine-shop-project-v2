import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLineSet } from "../context/LineSetContext.jsx";
import { FileDown } from "lucide-react";
import Header from '../components/Header';

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
  const { lineSet, setLineSet } = useLineSet();

  const [questions, setQuestions] = useState([]);
  const [loadingQuestions, setLoadingQuestions] = useState(true);

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

  // Fetch Questions Dynamically
  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${process.env.REACT_APP_API_URL}/api/competency-exam/questions`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("Failed to fetch questions");
        const data = await res.json();
        setQuestions(data);
      } catch (err) {
        triggerToast("Failed to load exam questions.", "error");
      } finally {
        setLoadingQuestions(false);
      }
    };
    fetchQuestions();
  }, []);

  useEffect(() => {
    if (lineSet && lineSet.lineCode) {
      setHeaderInfo((prev) => ({
        ...prev,
        line: lineSet.lineCode || ""
      }));
    }
  }, [lineSet]);

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

  const handleLineChange = (lineCode) => {
    setHeaderInfo((prev) => ({ ...prev, line: lineCode }));
    setLineSet({ machineShop: shopId, lineCode });
  };

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
      triggerToast("Please answer all questions before submitting.", "error");
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
              <span>Total Questions: {questions.length}</span>
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
              onChange={(e) => handleLineChange(e.target.value)}
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
          {loadingQuestions ? (
            <p className="text-gray-500 italic py-6 text-center">Loading exam questions...</p>
          ) : questions.length === 0 ? (
            <p className="text-gray-500 italic py-6 text-center">No questions configured yet by HOD.</p>
          ) : (
            questions.map((q, index) => (
              <div key={q.id} className="p-4 border border-gray-300 rounded-lg bg-white shadow-sm">
                <p className="font-bold text-gray-800 text-sm mb-3">{index + 1}. {q.text}</p>
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
            ))
          )}
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
            className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white px-10 py-3 rounded font-bold uppercase tracking-wide text-sm shadow cursor-pointer"
          >
            {isSaving ? "SAVING..." : saveSuccess ? "SAVED ✓" : "SAVE & CONTINUE"}
          </button>
        </div>
      </div>
    </div>
  );
}