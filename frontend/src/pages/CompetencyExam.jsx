import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLineSet } from "../context/LineSetContext.jsx";
import { FileDown, Lock, X, ArrowLeft, CheckCircle2, Calendar, HelpCircle, Clock } from "lucide-react";
import Header from '../components/Header';

const API_BASE = process.env.REACT_APP_API_URL 
  ? `${process.env.REACT_APP_API_URL}/api` 
  : "http://localhost:5000/api";

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
    <div className={`fixed bottom-6 right-6 z-50 ${bgColor} text-white px-5 py-3.5 rounded-xl shadow-2xl flex items-center gap-3 transition-all animate-bounce border border-black/10`}>
      <span className="text-sm font-semibold tracking-wide">{message}</span>
      <button onClick={onClose} className="ml-2 p-1 font-bold text-lg leading-none hover:text-gray-200 focus:outline-none transition-colors">
        <X className="w-4 h-4" />
      </button>
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

  // Shift Incharges (Supervisors) state
  const [shiftInchargeUsers, setShiftInchargeUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [isEvaluatorLocked, setIsEvaluatorLocked] = useState(false);

  const [answers, setAnswers] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [toast, setToast] = useState({ message: '', type: '' });

  // Date range download modal states
  const [showRangeModal, setShowRangeModal] = useState(false);
  const [rangeFromDate, setRangeFromDate] = useState(getTodayISODate());
  const [rangeToDate, setRangeToDate] = useState(getTodayISODate());
  const [isDownloadingRange, setIsDownloadingRange] = useState(false);

  const triggerToast = (message, type = 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: '', type: '' }), 4000);
  };

  // 1. Fetch registered Shift Incharges
  useEffect(() => {
    const fetchUsers = async () => {
      setLoadingUsers(true);
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_BASE}/competency-exam/shift-incharges`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (!res.ok) throw new Error("Failed to load Shift Incharges");
        const data = await res.json();
        setShiftInchargeUsers(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Shift Incharges error:", error);
        setShiftInchargeUsers(["Shift Incharge 1", "Shift Incharge 2"]);
      } finally {
        setLoadingUsers(false);
      }
    };
    fetchUsers();
  }, []);

  // 2. Fetch Questions Dynamically
  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_BASE}/competency-exam/questions`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (!res.ok) throw new Error("Failed to fetch questions");
        const data = await res.json();
        setQuestions(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to load questions:", err);
        triggerToast("Failed to load exam questions.", "error");
      } finally {
        setLoadingQuestions(false);
      }
    };
    fetchQuestions();
  }, []);

  // Sync context line if provided
  useEffect(() => {
    if (lineSet && lineSet.lineCode) {
      setHeaderInfo((prev) => ({
        ...prev,
        line: lineSet.lineCode || ""
      }));
    }
  }, [lineSet]);

  const handleHeaderChange = (field, val) => {
    setHeaderInfo((prev) => ({ ...prev, [field]: val }));
    if (field === 'line' && setLineSet) {
      setLineSet((prev) => ({ ...prev, lineCode: val }));
    }
  };

  const handleOptionChange = (qId, optionKey) => {
    setAnswers((prev) => ({ ...prev, [qId]: optionKey }));
  };

  // Download Date-Range Multi-Record PDF
  const handleDownloadRangePdf = async () => {
    if (!rangeFromDate || !rangeToDate) {
      triggerToast("Please select both From Date and To Date.", "error");
      return;
    }

    setIsDownloadingRange(true);
    try {
      const token = localStorage.getItem("token");
      const queryParams = new URLSearchParams({
        fromDate: rangeFromDate,
        toDate: rangeToDate
      });

      const url = `${API_BASE}/competency-exam/report?${queryParams.toString()}`;
      const response = await fetch(url, {
        method: "GET",
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("No records found in this date range.");
        }
        throw new Error("Failed to generate date-range PDF.");
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `Competency_Report_${rangeFromDate}_to_${rangeToDate}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      setShowRangeModal(false);
      triggerToast("Date range report downloaded successfully!", "success");
    } catch (err) {
      triggerToast(err.message || "Failed to download range report", "error");
    } finally {
      setIsDownloadingRange(false);
    }
  };

  const handleSave = async () => {
    if (!headerInfo.employeeNo || !headerInfo.employeeName || !headerInfo.line || !headerInfo.examDate) {
      triggerToast("Please fill all mandatory header fields.", "error");
      return;
    }

    if (!headerInfo.evaluatedBy || headerInfo.evaluatedBy.trim() === "") {
      triggerToast("Please choose the Shift Incharge (Supervisor) for evaluation.", "error");
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

      const res = await fetch(`${API_BASE}/competency-exam`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          ...(token ? { Authorization: `Bearer ${token}` } : {}) 
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) { 
        const result = await res.json().catch(() => ({})); 
        throw new Error(result.error || 'Save failed'); 
      }

      setIsSaving(false);
      setSaveSuccess(true);
      setIsEvaluatorLocked(true);

      triggerToast("Exam submitted to supervisor! Evaluator locked.", "success");
      await new Promise((resolve) => setTimeout(resolve, 2000));
      if (shopId) navigate(`/operator/${shopId}`);
    } catch (err) {
      setIsSaving(false);
      triggerToast(err.message || 'Failed to save exam.', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-[#2d2d2d] flex flex-col items-center justify-start p-3 sm:p-6 lg:p-8 font-sans antialiased">
      <Header />
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: '' })} />

      {/* Progress / Save Modal */}
      {(isSaving || saveSuccess) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl px-8 sm:px-12 py-8 text-center border border-gray-100 max-w-sm w-full">
            {isSaving ? (
              <>
                <div className="w-12 h-12 border-4 border-gray-200 border-t-orange-500 rounded-full animate-spin mx-auto mb-4"></div>
                <h2 className="text-lg font-bold text-gray-900 tracking-wide">Submitting to Supervisor...</h2>
                <p className="text-xs text-gray-500 mt-1 font-medium">Please wait while the exam is being processed</p>
              </>
            ) : (
              <>
                <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h2 className="text-lg font-bold text-green-800 tracking-wide">Exam Submitted Successfully</h2>
                <p className="text-xs text-gray-500 mt-1 font-medium">Evaluator locked. Redirecting to dashboard...</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Main Container Card */}
      <div className="bg-white w-full max-w-7xl rounded-2xl p-4 sm:p-8 lg:p-10 shadow-2xl border border-gray-200/80 space-y-7 my-4">
        
        {/* TOP HEADER */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-200 pb-5 gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <button
              type="button"
              onClick={() => navigate(shopId ? `/operator/${shopId}` : -1)}
              className="p-2 text-gray-600 hover:text-orange-600 hover:bg-orange-50 rounded-xl transition-all cursor-pointer border border-gray-200 shadow-sm"
              title="Go Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <span className="text-xs font-black text-orange-600 tracking-widest uppercase block mb-0.5">
                SAKTHI AUTO COMPONENT LIMITED
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-gray-900 uppercase tracking-wide">
                LEVEL 3 COMPETENCY QUALIFICATION
              </h2>
              <div className="text-xs text-gray-500 font-semibold mt-1 flex flex-wrap items-center gap-2">
                <span className="bg-gray-100 px-2 py-0.5 rounded border border-gray-200 font-bold text-gray-700">
                  VTL & HTL MACHINE
                </span>
                <span>•</span>
                <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-gray-400" /> Time: 1 Hour</span>
                <span>•</span>
                <span className="flex items-center gap-1"><HelpCircle className="w-3.5 h-3.5 text-gray-400" /> Questions: {questions.length}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 self-stretch sm:self-auto">
            <button
              type="button"
              onClick={() => setShowRangeModal(true)}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider shadow hover:shadow-md transition-all cursor-pointer"
            >
              <FileDown className="w-4 h-4" /> Download Range Report
            </button>
          </div>
        </div>

        {/* 1. CANDIDATE & EXAM METADATA CARD */}
        <div className="bg-white rounded-xl border border-gray-300 p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-200 pb-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
              <span className="font-extrabold text-gray-900 text-xs sm:text-sm uppercase tracking-wide">
                Candidate Information & Incharge Selection
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs sm:text-sm">
            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-gray-700 uppercase tracking-wider text-[11px]">Emp No</label>
              <input
                type="text"
                placeholder="e.g. 710125"
                className="border border-gray-300 rounded-lg p-2.5 font-medium bg-gray-50/50 focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all"
                value={headerInfo.employeeNo}
                onChange={(e) => handleHeaderChange('employeeNo', e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-gray-700 uppercase tracking-wider text-[11px]">Name</label>
              <input
                type="text"
                placeholder="e.g. M. NAGARAJAN"
                className="border border-gray-300 rounded-lg p-2.5 font-medium bg-gray-50/50 focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all"
                value={headerInfo.employeeName}
                onChange={(e) => handleHeaderChange('employeeName', e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-gray-700 uppercase tracking-wider text-[11px]">Line Code</label>
              <input
                type="text"
                placeholder="e.g. LINE-01"
                className="border border-gray-300 rounded-lg p-2.5 font-medium bg-gray-50/50 focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all"
                value={headerInfo.line}
                onChange={(e) => handleHeaderChange('line', e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="font-bold text-gray-700 uppercase tracking-wider text-[11px]">
                  Shift Incharge <span className="text-red-500">*</span>
                </label>
                {isEvaluatorLocked && (
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" /> Locked
                  </span>
                )}
              </div>
              <select
                className={`w-full border p-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                  isEvaluatorLocked 
                    ? "bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed" 
                    : "bg-gray-50/50 border-gray-300 text-gray-800 focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none cursor-pointer"
                }`}
                value={headerInfo.evaluatedBy}
                onChange={(e) => {
                  if (!isEvaluatorLocked) {
                    handleHeaderChange('evaluatedBy', e.target.value);
                  }
                }}
                disabled={isEvaluatorLocked || loadingUsers}
              >
                <option value="">{loadingUsers ? "Loading Supervisors..." : "-- Select Shift Incharge --"}</option>
                {shiftInchargeUsers.map((name, idx) => (
                  <option key={idx} value={name}>{name}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-gray-700 uppercase tracking-wider text-[11px]">Date of Joining (DOJ)</label>
              <input
                type="date"
                className="border border-gray-300 rounded-lg p-2.5 font-medium bg-gray-50/50 focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all cursor-pointer"
                value={headerInfo.doj}
                onChange={(e) => handleHeaderChange('doj', e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-gray-700 uppercase tracking-wider text-[11px]">Exam Date</label>
              <input
                type="date"
                className="border border-gray-300 rounded-lg p-2.5 font-medium bg-gray-50/50 focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all cursor-pointer"
                value={headerInfo.examDate}
                onChange={(e) => handleHeaderChange('examDate', e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="font-bold text-gray-700 uppercase tracking-wider text-[11px]">Qualification</label>
              <input
                type="text"
                placeholder="e.g. Diploma / ITI / BE"
                className="border border-gray-300 rounded-lg p-2.5 font-medium bg-gray-50/50 focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all"
                value={headerInfo.qualification}
                onChange={(e) => handleHeaderChange('qualification', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* 2. QUESTIONS CONTAINER */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-gray-200 pb-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
              <span className="font-extrabold text-gray-900 text-xs sm:text-sm uppercase tracking-wide">
                Examination Questionnaire
              </span>
            </div>
            <span className="text-xs text-gray-500 font-medium">Answered: {Object.keys(answers).length} / {questions.length}</span>
          </div>

          {loadingQuestions ? (
            <div className="p-10 text-center bg-gray-50 rounded-xl border border-gray-200">
              <div className="w-8 h-8 border-3 border-gray-300 border-t-orange-500 rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-gray-500 text-sm font-semibold">Loading examination questions...</p>
            </div>
          ) : questions.length === 0 ? (
            <div className="p-10 text-center bg-gray-50 rounded-xl border border-gray-200">
              <HelpCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500 text-sm font-medium">No questions configured yet by HOD.</p>
            </div>
          ) : (
            questions.map((q, index) => {
              const isAnswered = Boolean(answers[q.id]);
              return (
                <div 
                  key={q.id} 
                  className={`p-4 sm:p-5 rounded-xl border transition-all ${
                    isAnswered 
                      ? 'border-gray-300 bg-white shadow-sm' 
                      : 'border-orange-200 bg-orange-50/20'
                  }`}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-100 text-gray-700 font-black text-xs flex items-center justify-center border border-gray-200">
                      {index + 1}
                    </span>
                    <p className="font-extrabold text-gray-900 text-xs sm:text-sm leading-relaxed pt-0.5">
                      {q.text}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 ml-0 sm:ml-9">
                    {(Array.isArray(q.options) ? q.options : []).map((opt, idx) => {
                      const optionKey = String.fromCharCode(65 + idx);
                      const isSelected = answers[q.id] === optionKey;
                      return (
                        <label
                          key={idx}
                          className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer text-xs font-bold transition-all ${
                            isSelected 
                              ? 'border-orange-500 bg-orange-50/80 text-orange-950 shadow-sm ring-1 ring-orange-500/30' 
                              : 'border-gray-200 hover:border-gray-300 bg-gray-50/40 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`question-${q.id}`}
                            value={optionKey}
                            checked={isSelected}
                            onChange={() => handleOptionChange(q.id, optionKey)}
                            className="w-4 h-4 text-orange-600 focus:ring-orange-500 cursor-pointer"
                          />
                          <span className="leading-snug">{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 3. EVALUATION STATUS & SUBMIT BAR */}
        <div className="bg-gray-50/80 rounded-xl border border-gray-300 p-5 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
          <div className="flex-1">
            <span className="font-bold text-gray-700 block mb-1 text-xs uppercase tracking-wider">
              Assigned Supervisor For Evaluation
            </span>
            <div className="p-3 bg-white rounded-lg border border-gray-300 text-xs sm:text-sm font-black text-gray-800 flex items-center justify-between shadow-sm">
              <span>{headerInfo.evaluatedBy || "None Selected Yet"}</span>
              {isEvaluatorLocked && (
                <span className="text-xs text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded font-bold flex items-center gap-1 uppercase tracking-wider">
                  <Lock className="w-3.5 h-3.5" /> Locked
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || saveSuccess}
            className="w-full md:w-auto bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white px-9 py-3.5 rounded-xl font-black transition-all shadow-lg hover:shadow-orange-500/25 cursor-pointer uppercase tracking-wider text-xs sm:text-sm active:scale-95"
          >
            {isSaving ? "SAVING..." : saveSuccess ? "SUBMITTED ✓" : "SUBMIT FOR EVALUATION"}
          </button>
        </div>
      </div>

      {/* DATE RANGE MODAL FOR DOWNLOADING MULTI-RECORD REPORTS */}
      {showRangeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-7 w-full max-w-md border border-gray-100">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-200">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 rounded-lg">
                  <Calendar className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 uppercase tracking-wide">
                    Download Exam Reports
                  </h3>
                  <p className="text-xs text-gray-500">Filter records across selected date span</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRangeModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="font-semibold text-gray-700 block mb-1 text-xs uppercase tracking-wider">From Date</label>
                <input
                  type="date"
                  value={rangeFromDate}
                  onChange={(e) => setRangeFromDate(e.target.value)}
                  className="w-full border border-gray-300 p-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-sm font-semibold bg-white transition-all shadow-sm"
                />
              </div>

              <div>
                <label className="font-semibold text-gray-700 block mb-1 text-xs uppercase tracking-wider">To Date</label>
                <input
                  type="date"
                  value={rangeToDate}
                  onChange={(e) => setRangeToDate(e.target.value)}
                  className="w-full border border-gray-300 p-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-sm font-semibold bg-white transition-all shadow-sm"
                />
              </div>
            </div>

            <div className="flex justify-end items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowRangeModal(false)}
                className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDownloadRangePdf}
                disabled={isDownloadingRange}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white px-5 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider shadow hover:shadow-md transition-all cursor-pointer"
              >
                <FileDown className="w-4 h-4" />
                {isDownloadingRange ? "Generating..." : "Download PDF"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}