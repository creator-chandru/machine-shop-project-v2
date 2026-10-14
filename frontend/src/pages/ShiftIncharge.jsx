import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from "react-router-dom";
import Header from '../components/Header';
import { 
  ClipboardCheck, 
  PenLine, 
  ShieldCheck, 
  RefreshCw, 
  FileClock, 
  Wrench, 
  FileText, 
  Clock, 
  AlertTriangle, 
  BadgeCheck, 
  SearchCheck,
  FileCheck,
  X,
  Loader
} from 'lucide-react';
import { useLineSet } from '../context/LineSetContext.jsx';

const ShiftIncharge = () => {
  const navigate = useNavigate();
  const { shopId } = useParams();
  const { clearLineSet, setLineSet } = useLineSet();

  // Verification & Exam Reports Modal States
  const [isReportsModalOpen, setIsReportsModalOpen] = useState(false);
  const [examReports, setExamReports] = useState([]);
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [selectedExam, setSelectedExam] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "success" });

  const showToast = (message, type = "success") => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (!toast.message) return;
    const timer = setTimeout(() => setToast({ message: "", type: "success" }), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  const currentIncharge = currentUser.username || currentUser.fullName || currentUser.name || currentUser.employeeId || "Shift Incharge";

  useEffect(() => {
    clearLineSet();

    setLineSet({
      machineShop: shopId,
      lineCode: "",
      partName: "",
      partNo: "",
      machineNo: ""
    });
  }, [shopId]);

  // Fetch only Pending Submissions assigned to this supervisor
  const fetchExamReports = async () => {
    setIsLoadingReports(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${process.env.REACT_APP_API_URL}/api/competency-exam/reports?shiftIncharge=${encodeURIComponent(currentIncharge)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setExamReports(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Failed to fetch exam reports:", err);
    } finally {
      setIsLoadingReports(false);
    }
  };

  const handleOpenReportsModal = () => {
    fetchExamReports();
    setIsReportsModalOpen(true);
  };

  // Open Full-Screen Split Verification Modal with PDF Preview
  const handleOpenReviewModal = async (exam) => {
    setSelectedExam(exam);
    setPdfUrl(null);
    setIsPdfLoading(true);

    try {
      const token = localStorage.getItem("token");
      const params = new URLSearchParams({
        employeeNo: exam.employeeNo,
        line: exam.line,
        examDate: exam.examDate
      });

      const res = await fetch(
        `${process.env.REACT_APP_API_URL}/api/competency-exam/report?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!res.ok) throw new Error("Report request failed");

      const blob = await res.blob();
      setPdfUrl(URL.createObjectURL(blob));
    } catch (err) {
      console.error("Failed to generate PDF preview:", err);
      showToast("Failed to load PDF report.", "error");
      setSelectedExam(null);
    } finally {
      setIsPdfLoading(false);
    }
  };

  // Supervisor Approves: Immediately Erased from the supervisor's pending queue!
  const submitVerification = async () => {
    if (!selectedExam) return;
    setIsVerifying(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/competency-exam/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          employeeNo: selectedExam.employeeNo,
          line: selectedExam.line,
          examDate: selectedExam.examDate,
          verifiedBy: currentIncharge
        })
      });

      if (!res.ok) throw new Error("Verification failed");

      // Instantly remove (erase) the approved exam from the supervisor's active list
      setExamReports((prev) => prev.filter(item => 
        !(item.employeeNo === selectedExam.employeeNo && item.line === selectedExam.line && item.examDate === selectedExam.examDate)
      ));

      showToast("Exam report approved successfully! Removed from pending queue.");
      setSelectedExam(null);
      setPdfUrl(null);
      fetchExamReports();
    } catch (err) {
      showToast("Failed to verify exam record.", "error");
    } finally {
      setIsVerifying(false);
    }
  };

  const buttons = [
    { name: "Pre-Operation Checklist", path: `/shift-incharge/${shopId}/pre-operation-checklist`, icon: ClipboardCheck },
    { name: "level 1-maintenance", path: `/shift-incharge/${shopId}/level1-maintenance`, icon: ClipboardCheck },
    { name: "Error-Proofing CheckSheet", path: `/shift-incharge/${shopId}/error-proofing-checksheet`, icon: ShieldCheck },
    { name: "Air-Gap-Sensor CheckSheet", path: `/shift-incharge/${shopId}/air-gap-sensor`, icon: PenLine },
    { name: "4M-Change-Monitoring CheckSheet", path: `/shift-incharge/${shopId}/four-m-change-monitoring`, icon: RefreshCw },
    { name: "Record Of Significant Event", path: `/shift-incharge/${shopId}/significant-event-record`, icon: FileClock },
    { name: "Tool Change Record", path: `/shift-incharge/${shopId}/tool-change-record`, icon: Wrench },
    { name: "Daily Production Report", path: `/shift-incharge/${shopId}/daily-production-report`, icon: FileText },
    { name: "Daily Production Idle Time Report", path: `/shift-incharge/${shopId}/daily-production-idle-time-report`, icon: Clock },
    { name: "Breakdown Intimation / Service Report", path: `/shift-incharge/${shopId}/breakdown-intimation-service-report`, icon: AlertTriangle },
    //{ name: "Skill Evaluation - Practical Production and Quantity", path: `/shift-incharge/${shopId}/skill-evaluation-practical`, icon: BadgeCheck },
    { name: "Operator Observation Sheet", path: `/shift-incharge/${shopId}/operator-observation-sheet`, icon: SearchCheck },
    { name: "Competency Evaluation Form", path: `/shift-incharge/${shopId}/competency-evaluation-form`, icon: ShieldCheck },
    { name: "Corrective Action Register", path: `/shift-incharge/${shopId}/corrective-action-register`, icon: ClipboardCheck },
    { name: "Jig / Fixture Issue Intimation Report", path: `/shift-incharge/${shopId}/jig-fixture-intimation-report`, icon: Wrench },
    { name: "8D Problem Solving Report", path: `/shift-incharge/${shopId}/8d-problem-solving-report`, icon: Clock },
    { name: "Operator Allotment", path: `/shift-incharge/${shopId}/operator-allotment`, icon: ClipboardCheck },
    { name: "Job Setup Verification", path: `/shift-incharge/${shopId}/job-setup-verification`, icon: ShieldCheck },
    { name: "Operator Observation Plan", path :`/shift-incharge/${shopId}/operator-observation-plan`, icon : FileCheck}
  ];

  return (
    <div className="min-h-screen w-full bg-[#2d2d2d] flex flex-col relative font-sans">
      <Header />

      {toast.message && (
        <div role="status" className={`fixed top-6 right-6 z-[9000] flex items-center gap-3 rounded-lg px-5 py-3 text-sm font-bold text-white shadow-2xl ${toast.type === "error" ? "bg-red-600" : "bg-green-600"}`}>
          <span>{toast.message}</span>
          <button type="button" onClick={() => setToast({ message: "", type: "success" })} aria-label="Close notification" className="text-white hover:text-gray-200">
            <X size={18} />
          </button>
        </div>
      )}

      <div className="flex-1 flex flex-col items-center px-6 py-12 relative z-10">
        <div className="mb-10 text-center relative max-w-[1400px] w-full">
          <p className="text-sm md:text-base font-black text-[#ff9100] tracking-[0.3em] uppercase mb-2">
            Machine Shop-{shopId}
          </p>
          <h2 className="text-2xl md:text-3xl font-black text-white tracking-[0.2em] uppercase mb-3">
            Shift Incharge Control Panel
          </h2>
          <div className="w-20 h-1.5 bg-gradient-to-r from-orange-600 via-[#ff9100] to-orange-600 mx-auto rounded-full mb-5"></div>

          {/* Small Exam Reports Button for Shift Incharge */}
          <div className="flex justify-center items-center gap-3">
            <button
              onClick={handleOpenReportsModal}
              className="flex items-center gap-2 bg-[#ff9100] hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 cursor-pointer"
            >
              <FileCheck className="w-4 h-4" />
              Exam Reports
              {examReports.length > 0 && (
                <span className="bg-white text-orange-600 px-1.5 py-0.2 rounded-full text-[10px] font-black">
                  {examReports.length}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-[1400px] w-full pb-10">
          {buttons.map((btn) => {
            const Icon = btn.icon;
            return (
              <button
                key={btn.path}
                onClick={() => navigate(btn.path)}
                className="
                  group relative flex flex-col items-center justify-center p-8 
                  bg-[#383838] border border-[#4a4a4a] rounded-2xl
                  shadow-[0_8px_20px_rgba(0,0,0,0.3)]
                  hover:border-transparent hover:bg-gradient-to-br hover:from-[#ff9100] hover:to-[#e68200] 
                  hover:shadow-[0_15px_30px_rgba(255,145,0,0.3)]
                  hover:-translate-y-1.5 active:translate-y-0
                  transition-all duration-300 ease-out cursor-pointer
                "
              >
                <div className="mb-5 p-4 bg-[#2d2d2d] group-hover:bg-white/20 rounded-full border border-[#4a4a4a] group-hover:border-white/30 shadow-inner transition-colors duration-300">
                  <Icon className="w-8 h-8 text-[#ff9100] group-hover:text-white transition-colors duration-300" strokeWidth={2.5} />
                </div>
                <span className="text-[15px] font-bold text-gray-200 group-hover:text-white text-center tracking-wide leading-snug">
                  {btn.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* PENDING EXAM REPORTS MODAL FOR SHIFT INCHARGE */}
      {isReportsModalOpen && (
        <div className="fixed inset-0 z-[7000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#383838] border border-[#4a4a4a] w-full max-w-5xl rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col max-h-[85vh]">
            <div className="bg-gradient-to-r from-orange-600 to-[#ff9100] px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-black/20 p-2 rounded-lg">
                  <FileCheck size={20} className="text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white uppercase tracking-widest leading-tight">
                    Pending Competency Exam Reports
                  </h2>
                  <p className="text-xs text-orange-100 font-semibold">
                    Supervisor Queue: {currentIncharge}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={fetchExamReports}
                  className="text-white/80 hover:text-white bg-black/20 p-2 rounded-lg transition-colors cursor-pointer"
                  title="Refresh Reports"
                >
                  <RefreshCw size={18} className={isLoadingReports ? "animate-spin" : ""} />
                </button>
                <button
                  onClick={() => setIsReportsModalOpen(false)}
                  className="text-white/80 hover:text-white bg-black/20 p-2 rounded-lg transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto bg-[#2d2d2d] flex-1">
              {isLoadingReports ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-3">
                  <Loader className="w-8 h-8 animate-spin text-[#ff9100]" />
                  <span className="text-sm font-semibold">Loading pending submissions...</span>
                </div>
              ) : examReports.length === 0 ? (
                <p className="text-center text-gray-400 py-12 font-medium">
                  No exam submissions pending your evaluation.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-[#4a4a4a]">
                  <table className="w-full text-left border-collapse bg-[#222]">
                    <thead className="bg-[#1a1a1a] text-gray-300 text-xs uppercase tracking-wider">
                      <tr>
                        <th className="p-3 border-b border-[#3a3a3a]">Emp No</th>
                        <th className="p-3 border-b border-[#3a3a3a]">Name</th>
                        <th className="p-3 border-b border-[#3a3a3a]">Line</th>
                        <th className="p-3 border-b border-[#3a3a3a]">Exam Date</th>
                        <th className="p-3 border-b border-[#3a3a3a] text-center">Score</th>
                        <th className="p-3 border-b border-[#3a3a3a] text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-[#333]">
                      {examReports.map((report) => (
                        <tr key={report.id} className="hover:bg-[#2a2a2a] transition-colors">
                          <td className="p-3 font-bold text-white">{report.employeeNo}</td>
                          <td className="p-3 text-gray-300">{report.employeeName || "N/A"}</td>
                          <td className="p-3 text-gray-300">{report.line}</td>
                          <td className="p-3 text-gray-400 text-xs">{report.examDate}</td>
                          <td className="p-3 text-center">
                            <span className={`font-extrabold text-xs px-2.5 py-1 rounded-full ${report.score >= 70 ? 'bg-green-900/60 text-green-300' : 'bg-red-900/60 text-red-300'}`}>
                              {report.score} / 100
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => handleOpenReviewModal(report)}
                              className="bg-[#ff9100] hover:bg-orange-600 text-white px-3.5 py-1.5 rounded-lg font-bold text-xs uppercase tracking-wider shadow transition-colors cursor-pointer"
                            >
                              Review & Verify
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* FULL-SCREEN SPLIT MODAL FOR REVIEW & VERIFY */}
      {selectedExam && (
        <div className="fixed inset-0 z-[8000] bg-white flex flex-col overflow-hidden animate-fade-in">
          <div className="bg-gray-900 text-white px-6 py-4 flex justify-between items-center shrink-0 shadow-md z-10">
            <div className="flex items-center gap-3">
              <FileCheck className="text-orange-400 w-6 h-6" />
              <h3 className="font-bold text-lg uppercase tracking-wider">
                Verify Competency Exam - {selectedExam.employeeNo} ({selectedExam.employeeName})
              </h3>
            </div>
            <button
              onClick={() => { setSelectedExam(null); setPdfUrl(null); }}
              className="text-gray-400 hover:text-red-400 transition-colors cursor-pointer"
            >
              <X size={26} />
            </button>
          </div>

          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            {/* Left: Document PDF Preview */}
            <div className="flex-1 h-full bg-[#525659] relative flex items-center justify-center">
              {isPdfLoading && <Loader className="animate-spin text-white w-12 h-12 absolute" />}
              {pdfUrl && (
                <iframe
                  src={`${pdfUrl}#toolbar=0&view=FitH`}
                  className="w-full h-full border-none relative z-10"
                  title="Competency Exam PDF Preview"
                />
              )}
            </div>

            {/* Right: Verification Details & Action */}
            <div className="w-full lg:w-[400px] bg-gray-50 border-l border-gray-300 flex flex-col shrink-0 shadow-2xl z-10 overflow-y-auto">
              <div className="p-6 flex-1 flex flex-col">
                <h4 className="text-xs font-black uppercase tracking-widest text-orange-600 mb-3">
                  Verification Overview
                </h4>

                <div className="bg-white p-4 rounded-xl border border-gray-200 mb-6 text-sm flex flex-col gap-2.5 shadow-sm text-gray-800">
                  <p><span className="font-bold text-gray-500">Employee No:</span> <span className="font-extrabold">{selectedExam.employeeNo}</span></p>
                  <p><span className="font-bold text-gray-500">Employee Name:</span> <span className="font-semibold">{selectedExam.employeeName || 'N/A'}</span></p>
                  <p><span className="font-bold text-gray-500">Line Code:</span> <span className="font-semibold">{selectedExam.line}</span></p>
                  <p><span className="font-bold text-gray-500">Exam Date:</span> <span className="font-semibold">{selectedExam.examDate}</span></p>
                  <p>
                    <span className="font-bold text-gray-500">Exam Score:</span>{' '}
                    <span className={`font-extrabold ${selectedExam.score >= 70 ? 'text-green-600' : 'text-red-600'}`}>
                      {selectedExam.score} / 100 ({selectedExam.score >= 70 ? 'PASS' : 'FAIL'})
                    </span>
                  </p>
                  <p><span className="font-bold text-gray-500">Supervisor:</span> <span className="font-semibold">{currentIncharge}</span></p>
                </div>

                <div className="mt-auto pt-6 border-t border-gray-200">
                  <button
                    onClick={submitVerification}
                    disabled={isVerifying}
                    className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white py-4 rounded-xl font-black text-base uppercase tracking-wider shadow-lg transition-transform hover:-translate-y-0.5 cursor-pointer flex items-center justify-center gap-2"
                  >
                    {isVerifying ? (
                      <>
                        <Loader className="w-5 h-5 animate-spin" />
                        <span>Approving...</span>
                      </>
                    ) : (
                      "Verify & Approve"
                    )}
                  </button>
                  <p className="text-[11px] text-gray-500 mt-2 text-center">
                    Once approved, this exam report will be removed from your pending queue.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShiftIncharge;