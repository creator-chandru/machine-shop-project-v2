import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import Header from "../components/Header";
import EditPartMapping from "../components/EditPartMapping";
import JobSetupMasterConfigurator from "../components/jobSetupMasterConfigurator";
import AddPartSetModal from "../components/AddPartSetModal.jsx";
import {
  RefreshCw,
  Loader,
  X,
  ClipboardList,
  Settings2,
  Layers,
  ChevronRight,
  BookOpen,
  Award,
  CheckCircle2,
  UserCheck,
  Building2,
  SlidersHorizontal,
  FileCheck,
  Plus
} from "lucide-react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const API_URL = process.env.REACT_APP_API_URL || "";

const Hod = () => {
  const { shopId } = useParams();

  const [activeTab, setActiveTab] = useState("four-m"); // "four-m" | "job-setup-master" | "competency-eval"
  const [pendingReports, setPendingReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [isAddPartSetOpen, setIsAddPartSetOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Competency Evaluation Pending Reports & Review Modal
  const [pendingCompetencyReports, setPendingCompetencyReports] = useState([]);
  const [selectedCompetencyReport, setSelectedCompetencyReport] = useState(null);
  const [competencyPdfUrl, setCompetencyPdfUrl] = useState(null);
  const [isCompetencyPdfLoading, setIsCompetencyPdfLoading] = useState(false);

  // QF Manager States
  const [isQfManagerOpen, setIsQfManagerOpen] = useState(false);
  const [qfSettings, setQfSettings] = useState([]);
  const [savingId, setSavingId] = useState(null);

  // Competency Exam Manager States
  const [isCompetencyManagerOpen, setIsCompetencyManagerOpen] = useState(false);
  const [examQuestions, setExamQuestions] = useState([]);
  const [newQuestionText, setNewQuestionText] = useState("");
  const [newOptions, setNewOptions] = useState(["", "", ""]);
  const [newCorrectAnswer, setNewCorrectAnswer] = useState("A");

  const currentUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  })();
  const currentHOD = currentUser.username || currentUser.employeeId || "HOD";

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      if (competencyPdfUrl) URL.revokeObjectURL(competencyPdfUrl);
    };
  }, [pdfUrl, competencyPdfUrl]);

  const fetchPendingReports = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${API_URL}/api/four-m-change-monitoring/hod/pending/${encodeURIComponent(currentHOD)}?shopId=${shopId || 3}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setPendingReports(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      toast.error("Failed to load Pending 4M Reports.");
    }
  };

  // Fetch Pending Competency Evaluations for this HOD
  const fetchPendingCompetencyReports = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${API_URL}/api/competency-evaluation-form/hod/pending/${encodeURIComponent(currentHOD)}?shopId=${shopId || 3}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setPendingCompetencyReports(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      toast.error("Failed to load Pending Competency Evaluations.");
    }
  };

  // Fetch QF Settings
  const fetchQfSettings = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/qf-values`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setQfSettings(data);
      }
    } catch (error) {
      toast.error("Failed to load QF values.");
    }
  };

  // Update specific QF Setting
  const handleSaveSingleQfSetting = async (setting) => {
    setSavingId(setting.formName);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/qf-values`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ setting })
      });
      if (res.ok) {
        toast.success(`${setting.formName.replace("-", " ")} QF updated!`);
        fetchQfSettings();
      } else {
        toast.error("Failed to save QF value.");
      }
    } catch (error) {
      toast.error("Failed to save QF value.");
    }
    setSavingId(null);
  };

  // Fetch Competency Exam Questions
  const fetchCompetencyQuestions = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/competency-exam/questions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setExamQuestions(data);
      }
    } catch (err) {
      toast.error("Failed to load competency exam questions.");
    }
  };

  const handleAddCompetencyQuestion = async (e) => {
    e.preventDefault();
    if (!newQuestionText.trim() || newOptions.some((opt) => !opt.trim())) {
      toast.error("Please fill in the question and all options.");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/competency-exam/questions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          questionText: newQuestionText,
          options: newOptions,
          correctAnswer: newCorrectAnswer
        })
      });

      if (res.ok) {
        toast.success("Question added successfully!");
        setNewQuestionText("");
        setNewOptions(["", "", ""]);
        setNewCorrectAnswer("A");
        fetchCompetencyQuestions();
      } else {
        toast.error("Failed to add question.");
      }
    } catch (err) {
      toast.error("Failed to add question.");
    }
  };

  const handleDeleteCompetencyQuestion = async (id) => {
    if (!window.confirm("Are you sure you want to remove this question?")) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/competency-exam/questions/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        toast.success("Question removed successfully!");
        fetchCompetencyQuestions();
      } else {
        toast.error("Failed to remove question.");
      }
    } catch (err) {
      toast.error("Failed to remove question.");
    }
  };

  useEffect(() => {
    fetchPendingReports();
    fetchPendingCompetencyReports();
  }, [shopId, currentHOD]);

  // Open 4M Review Modal
  const handleOpenReviewModal = async (report) => {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setSelectedReport(report);
    setPdfUrl(null);
    setIsPdfLoading(true);

    try {
      const token = localStorage.getItem("token");
      const targetDate = report.reportDate ? String(report.reportDate).split(" ")[0] : new Date().toISOString().split("T")[0];

      const params = new URLSearchParams({
        fromDate: targetDate,
        toDate: targetDate,
        shopId: String(report.machineShop || shopId || 3)
      });

      const res = await fetch(
        `${API_URL}/api/four-m-change-monitoring/report?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!res.ok) {
        if (res.status === 404) throw new Error("No data recorded for this selection.");
        throw new Error("Report request failed");
      }

      const blob = await res.blob();
      setPdfUrl(URL.createObjectURL(blob));
    } catch (err) {
      toast.error(err.message || "Failed to generate PDF preview.");
      setSelectedReport(null);
    }
    setIsPdfLoading(false);
  };

  const submitHODSignature = async () => {
    try {
      const res = await fetch(
        `${API_URL}/api/four-m-change-monitoring/hod/sign`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`
          },
          body: JSON.stringify({
            lineCode: selectedReport.lineCode,
            partName: selectedReport.partName,
            signature: currentHOD
          })
        }
      );

      if (!res.ok) throw new Error("Approval failed");

      toast.success("4M Checksheet verified successfully!", { autoClose: 2000 });

      setTimeout(() => {
        setSelectedReport(null);
        fetchPendingReports();
      }, 1500);
    } catch (err) {
      toast.error("Failed to save HOD verification.");
    }
  };

  // Open Competency Evaluation Review Modal
  const handleOpenCompetencyReviewModal = async (report) => {
    if (competencyPdfUrl) URL.revokeObjectURL(competencyPdfUrl);
    setSelectedCompetencyReport(report);
    setCompetencyPdfUrl(null);
    setIsCompetencyPdfLoading(true);

    try {
      const token = localStorage.getItem("token");
      const params = new URLSearchParams({
        employeeNo: report.employeeNo,
        date: report.evalDate,
        shopId: String(report.machineShop || shopId || 3)
      });

      const res = await fetch(
        `${API_URL}/api/competency-evaluation-form/report?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!res.ok) {
        if (res.status === 404) throw new Error("No evaluation found for this selection.");
        throw new Error("Report preview failed");
      }

      const blob = await res.blob();
      setCompetencyPdfUrl(URL.createObjectURL(blob));
    } catch (err) {
      toast.error(err.message || "Failed to generate Evaluation PDF preview.");
      setSelectedCompetencyReport(null);
    }
    setIsCompetencyPdfLoading(false);
  };

  // Submit HOD Signature for Competency Evaluation
  const submitCompetencyHodSignature = async () => {
    try {
      const res = await fetch(
        `${API_URL}/api/competency-evaluation-form/sign-hod`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`
          },
          body: JSON.stringify({
            employeeNo: selectedCompetencyReport.employeeNo,
            date: selectedCompetencyReport.evalDate,
            signature: currentHOD
          })
        }
      );

      if (!res.ok) throw new Error("Approval failed");

      toast.success("Competency Evaluation verified & approved successfully!", { autoClose: 2000 });

      setTimeout(() => {
        setSelectedCompetencyReport(null);
        fetchPendingCompetencyReports();
      }, 1500);
    } catch (err) {
      toast.error("Failed to save HOD Competency approval.");
    }
  };

  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    await Promise.all([fetchPendingReports(), fetchPendingCompetencyReports()]);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  return (
    <div className="min-h-screen w-full bg-[#2d2d2d] font-sans text-gray-100 pb-16 selection:bg-[#ff9100]/30 selection:text-white">
      <Header />
      <ToastContainer position="top-right" autoClose={2000} theme="dark" />

      {/* Main Page Content */}
      <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
        
        {/* Primary Verification Workspace Card */}
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden text-gray-800">
          
          {/* Card Topbar: Header, Logged In Info, and Controls */}
          <div className="px-6 py-5 border-b border-gray-200 bg-gray-50 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl md:text-2xl font-black text-gray-900 uppercase tracking-tight">
                  HOD Dashboard
                </h1>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase bg-[#ff9100]/15 text-[#ff9100] border border-[#ff9100]/30 shadow-sm">
                  <Building2 className="w-3.5 h-3.5" />
                  Machine Shop - {shopId || 3}
                </span>
              </div>
              <p className="text-xs text-gray-500 font-medium">
                Review and digitally verify pending 4M change checksheets and operator competency evaluations.
              </p>
            </div>

            <div className="flex items-center gap-3 self-start md:self-auto">
              <div className="flex items-center gap-2.5 bg-white border border-gray-300 px-3.5 py-1.5 rounded-xl shadow-sm text-xs">
                <UserCheck className="w-4 h-4 text-indigo-600" />
                <span className="font-semibold text-gray-500">HOD:</span>
                <span className="font-extrabold text-gray-800 uppercase">{currentHOD}</span>
              </div>

              <button
                onClick={handleRefreshAll}
                className="p-2.5 bg-white hover:bg-gray-100 text-gray-600 hover:text-indigo-600 rounded-xl border border-gray-300 shadow-sm transition-all cursor-pointer group"
                title="Refresh Records"
              >
                <RefreshCw className={`w-4 h-4 transition-transform duration-500 ${isRefreshing ? "animate-spin text-indigo-600" : ""}`} />
              </button>
            </div>
          </div>

          {/* Navigation Tab Bar and Management Actions */}
          <div className="px-6 py-4 border-b border-gray-200 bg-white flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            
            {/* Segmented Tab Switcher */}
            <div className="inline-flex p-1 bg-gray-100 rounded-xl gap-1 border border-gray-200 flex-wrap">
              <button
                onClick={() => setActiveTab("four-m")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs md:text-sm transition-all cursor-pointer ${
                  activeTab === "four-m"
                    ? "bg-indigo-600 text-white shadow-md"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/60"
                }`}
              >
                <ClipboardList className="w-4 h-4" />
                4M Checksheets
                {pendingReports.length > 0 && (
                  <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ml-1 ${
                    activeTab === "four-m" ? "bg-white text-indigo-600" : "bg-gray-300 text-gray-800"
                  }`}>
                    {pendingReports.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab("competency-eval")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs md:text-sm transition-all cursor-pointer ${
                  activeTab === "competency-eval"
                    ? "bg-indigo-600 text-white shadow-md"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/60"
                }`}
              >
                <Award className="w-4 h-4" />
                Competency Evaluations
                {pendingCompetencyReports.length > 0 && (
                  <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ml-1 ${
                    activeTab === "competency-eval" ? "bg-white text-indigo-600" : "bg-gray-300 text-gray-800"
                  }`}>
                    {pendingCompetencyReports.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab("job-setup-master")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs md:text-sm transition-all cursor-pointer ${
                  activeTab === "job-setup-master"
                    ? "bg-indigo-600 text-white shadow-md"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/60"
                }`}
              >
                <Settings2 className="w-4 h-4" />
                Job Setup Config
              </button>
            </div>

            {/* Quick Management Action Buttons */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                onClick={() => {
                  fetchCompetencyQuestions();
                  setIsCompetencyManagerOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-gray-700 bg-gray-50 border border-gray-300 hover:border-indigo-500 hover:text-indigo-600 hover:bg-indigo-50/50 shadow-sm transition-all cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                Manage Questions
              </button>

              <button
                onClick={() => {
                  fetchQfSettings();
                  setIsQfManagerOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-gray-700 bg-gray-50 border border-gray-300 hover:border-[#ff9100] hover:text-[#ff9100] hover:bg-amber-50/50 shadow-sm transition-all cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#ff9100]" />
                Manage QF Values
              </button>
            </div>
          </div>

          {/* Section Body */}
          <div className="p-6 md:p-8">
            
            {/* TAB 1: 4M Checksheets */}
            {activeTab === "four-m" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-2">
                  <div>
                    <h3 className="text-base font-extrabold text-gray-900 uppercase tracking-wide">
                      Pending 4M Quality Checksheets
                    </h3>
                    <p className="text-xs text-gray-500">Requires HOD digital sign-off and verification for line change approvals.</p>
                  </div>
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                    Total: {pendingReports.length}
                  </span>
                </div>

                {pendingReports.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 px-4 bg-gray-50/70 rounded-2xl border border-dashed border-gray-300 text-center space-y-3">
                    <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm">
                      <CheckCircle2 className="w-7 h-7" />
                    </div>
                    <h4 className="text-base font-bold text-gray-800">No 4M Checksheets Pending</h4>
                    <p className="text-xs text-gray-500 max-w-sm">All 4M change reports for this machine shop are reviewed and cleared by HOD.</p>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm bg-white">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-900 text-slate-200 text-xs uppercase tracking-wider font-semibold">
                            <th className="py-3.5 px-4 font-bold">Line Code</th>
                            <th className="py-3.5 px-4 font-bold">Part Identification</th>
                            <th className="py-3.5 px-4 font-bold">Submission Batch</th>
                            <th className="py-3.5 px-4 font-bold text-center">Status</th>
                            <th className="py-3.5 px-4 font-bold text-right pr-6">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 text-sm">
                          {pendingReports.map((report, idx) => (
                            <tr key={idx} className="hover:bg-indigo-50/30 transition-colors">
                              <td className="py-4 px-4 font-extrabold text-gray-900">
                                <span className="px-2.5 py-1 rounded-md bg-gray-100 border border-gray-300 font-mono text-xs">
                                  {report.lineCode}
                                </span>
                              </td>
                              <td className="py-4 px-4 font-semibold text-gray-800">
                                {report.partName}
                              </td>
                              <td className="py-4 px-4 text-gray-500 text-xs font-medium">
                                Last Entry: {report.reportDate}
                              </td>
                              <td className="py-4 px-4 text-center">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                  Pending Sign
                                </span>
                              </td>
                              <td className="py-4 px-4 text-right pr-6">
                                <button
                                  onClick={() => handleOpenReviewModal(report)}
                                  className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white px-4 py-2 rounded-xl font-bold text-xs tracking-wider uppercase shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
                                >
                                  <FileCheck className="w-3.5 h-3.5" />
                                  Review & Sign
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: Competency Evaluations */}
            {activeTab === "competency-eval" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-2">
                  <div>
                    <h3 className="text-base font-extrabold text-gray-900 uppercase tracking-wide">
                      Pending Operator Competency Evaluations
                    </h3>
                    <p className="text-xs text-gray-500">Examine written & practical scores before issuing official HOD verification stamp.</p>
                  </div>
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                    Total: {pendingCompetencyReports.length}
                  </span>
                </div>

                {pendingCompetencyReports.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 px-4 bg-gray-50/70 rounded-2xl border border-dashed border-gray-300 text-center space-y-3">
                    <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm">
                      <CheckCircle2 className="w-7 h-7" />
                    </div>
                    <h4 className="text-base font-bold text-gray-800">No Evaluations Pending</h4>
                    <p className="text-xs text-gray-500 max-w-sm">All operator competency evaluations have been reviewed and approved.</p>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm bg-white">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-900 text-slate-200 text-xs uppercase tracking-wider font-semibold">
                            <th className="py-3.5 px-4 font-bold">Emp No</th>
                            <th className="py-3.5 px-4 font-bold">Operator Name</th>
                            <th className="py-3.5 px-4 font-bold">Qualification</th>
                            <th className="py-3.5 px-4 font-bold">Line</th>
                            <th className="py-3.5 px-4 font-bold">Eval Date</th>
                            <th className="py-3.5 px-4 font-bold text-center">Score (W / P)</th>
                            <th className="py-3.5 px-4 font-bold text-center">Status</th>
                            <th className="py-3.5 px-4 font-bold text-right pr-6">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 text-sm">
                          {pendingCompetencyReports.map((report, idx) => (
                            <tr key={idx} className="hover:bg-indigo-50/30 transition-colors">
                              <td className="py-4 px-4 font-extrabold text-gray-900 font-mono text-xs">
                                {report.employeeNo}
                              </td>
                              <td className="py-4 px-4 font-bold text-gray-800">{report.name}</td>
                              <td className="py-4 px-4 text-gray-600 text-xs">{report.qualification || "-"}</td>
                              <td className="py-4 px-4 text-gray-600 text-xs font-semibold">{report.line || "-"}</td>
                              <td className="py-4 px-4 text-gray-500 text-xs">{report.evalDate}</td>
                              <td className="py-4 px-4 text-center text-xs font-mono font-bold text-indigo-700">
                                {report.writtenExamMark ?? "-"} / {report.practicalExamMark ?? "-"}
                              </td>
                              <td className="py-4 px-4 text-center">
                                <span
                                  className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-extrabold uppercase tracking-wide border ${
                                    report.status === "PASS"
                                      ? "bg-green-100 text-green-800 border-green-300"
                                      : report.status === "FAIL"
                                      ? "bg-red-100 text-red-800 border-red-300"
                                      : "bg-gray-100 text-gray-700 border-gray-300"
                                  }`}
                                >
                                  {report.status || "Pending"}
                                </span>
                              </td>
                              <td className="py-4 px-4 text-right pr-6">
                                <button
                                  onClick={() => handleOpenCompetencyReviewModal(report)}
                                  className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white px-4 py-2 rounded-xl font-bold text-xs tracking-wider uppercase shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
                                >
                                  <FileCheck className="w-3.5 h-3.5" />
                                  Verify
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: Job Setup Master */}
            {activeTab === "job-setup-master" && (
              <div className="pt-2">
                <JobSetupMasterConfigurator shopId={shopId} />
              </div>
            )}
          </div>
        </div>

        {/* BOTTOM SECTION: Line & Part Configurations & Part Set Registration */}
        <div className="space-y-6">
          
          {/* Component 1: Line & Part Mappings Container */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden text-gray-800">
            <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/70 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 shadow-sm">
                  <Settings2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-gray-900 tracking-wide uppercase">
                    Line & Part Mappings
                  </h2>
                  <p className="text-xs text-gray-500">
                    Configure machine routing, active toolings, and part number mappings for Machine Shop - {shopId || 3}
                  </p>
                </div>
              </div>
              <span className="self-start sm:self-auto px-3 py-1 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Matrix Active
              </span>
            </div>
            
            <div className="p-6 md:p-8">
              <EditPartMapping shopId={shopId} />
            </div>
          </div>

          {/* Component 2: Part Set Registration Card (Cohesive White Enterprise Theme) */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden text-gray-800">
            <div className="px-6 py-5 bg-gray-50/70 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[#ff9100] shadow-sm">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-extrabold text-gray-900 tracking-wide uppercase">
                      Part Set Registration
                    </h2>
                    <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase rounded-full bg-orange-100 text-orange-800 border border-orange-200">
                      Shop - {shopId || 3}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Register and configure new Part IDs and Part Names for machine shop inspection setups.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsAddPartSetOpen(true)}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#ff9100] hover:bg-[#e68200] active:scale-95 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md shadow-orange-500/20 transition-all cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" strokeWidth={2.5} />
                Add New Part Set
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <AddPartSetModal
        isOpen={isAddPartSetOpen}
        onClose={() => setIsAddPartSetOpen(false)}
        defaultShopId={shopId || "3"}
      />

      {/* COMPETENCY EXAM QUESTION MANAGER MODAL */}
      {isCompetencyManagerOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-[#2a2a2a] border border-[#444] w-full max-w-4xl rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-[#ff9100] px-6 py-4 flex items-center justify-between shrink-0 shadow-md">
              <div className="flex items-center gap-3">
                <div className="bg-black/25 p-2 rounded-lg shadow-inner">
                  <BookOpen size={20} className="text-white" />
                </div>
                <div>
                  <h2 className="text-base font-black text-white uppercase tracking-wider leading-tight">
                    Manage Competency Exam Questions
                  </h2>
                  <p className="text-[11px] text-white/80 font-medium">Add, update, or remove theoretical exam questions</p>
                </div>
              </div>
              <button
                onClick={() => setIsCompetencyManagerOpen(false)}
                className="text-white/70 hover:text-white bg-black/20 hover:bg-black/40 p-2 rounded-xl transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto bg-[#222222] flex-1 space-y-6">
              <form onSubmit={handleAddCompetencyQuestion} className="bg-[#2c2c2c] p-5 rounded-2xl border border-[#444] space-y-4 shadow-inner">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <Plus className="w-4 h-4 text-[#ff9100]" />
                    Register New Question
                  </h3>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1.5">Question Text</label>
                  <input
                    type="text"
                    value={newQuestionText}
                    onChange={(e) => setNewQuestionText(e.target.value)}
                    placeholder="Enter full technical question text..."
                    className="w-full bg-[#1b1b1b] border border-[#4a4a4a] p-3 rounded-xl text-gray-200 text-sm focus:outline-none focus:border-[#ff9100] transition-colors"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {newOptions.map((opt, idx) => (
                    <div key={idx}>
                      <label className="block text-xs font-bold text-gray-400 mb-1">
                        Option {String.fromCharCode(65 + idx)}
                      </label>
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => {
                          const updated = [...newOptions];
                          updated[idx] = e.target.value;
                          setNewOptions(updated);
                        }}
                        placeholder={`Option ${String.fromCharCode(65 + idx)} description`}
                        className="w-full bg-[#1b1b1b] border border-[#4a4a4a] p-2.5 rounded-xl text-gray-200 text-xs focus:outline-none focus:border-[#ff9100] transition-colors"
                      />
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center pt-2">
                  <div className="w-1/3">
                    <label className="block text-xs font-bold text-gray-400 mb-1">Correct Answer Key</label>
                    <select
                      value={newCorrectAnswer}
                      onChange={(e) => setNewCorrectAnswer(e.target.value)}
                      className="w-full bg-[#1b1b1b] border border-[#4a4a4a] p-2.5 rounded-xl text-gray-200 text-xs focus:outline-none focus:border-[#ff9100] cursor-pointer"
                    >
                      <option value="A">Option A</option>
                      <option value="B">Option B</option>
                      <option value="C">Option C</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-black text-xs uppercase tracking-wider px-6 py-2.5 rounded-xl transition-all shadow-md cursor-pointer mt-5"
                  >
                    Add Question
                  </button>
                </div>
              </form>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-black text-gray-300 uppercase tracking-wider">
                    Existing Questions Bank ({examQuestions.length})
                  </h3>
                </div>
                {examQuestions.length === 0 ? (
                  <p className="text-center text-gray-500 py-8 font-medium text-sm">No exam questions added yet.</p>
                ) : (
                  examQuestions.map((q, idx) => (
                    <div key={q.id} className="bg-[#2c2c2c] p-4 rounded-xl border border-[#404040] flex justify-between items-start gap-4 hover:border-gray-500 transition-colors">
                      <div className="space-y-1.5">
                        <p className="font-bold text-white text-sm">
                          <span className="text-[#ff9100] mr-1.5">Q{idx + 1}.</span> {q.text}
                        </p>
                        <div className="text-xs text-gray-400 flex flex-wrap gap-3 pt-1">
                          {q.options.map((opt, oIdx) => {
                            const isCorrect = String.fromCharCode(65 + oIdx) === q.correctAnswer;
                            return (
                              <span
                                key={oIdx}
                                className={`px-2 py-0.5 rounded text-xs ${
                                  isCorrect ? "bg-green-500/20 text-green-400 border border-green-500/30 font-bold" : "bg-[#1f1f1f] text-gray-300"
                                }`}
                              >
                                {String.fromCharCode(65 + oIdx)}: {opt}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteCompetencyQuestion(q.id)}
                        className="bg-red-500/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/30 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0"
                      >
                        Remove
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QF MANAGER MODAL */}
      {isQfManagerOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-[#2a2a2a] border border-[#444] w-full max-w-4xl rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col max-h-[85vh]">
            
            <div className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-[#ff9100] px-6 py-4 flex items-center justify-between shrink-0 shadow-md">
              <div className="flex items-center gap-3">
                <div className="bg-black/25 p-2 rounded-lg shadow-inner">
                  <SlidersHorizontal size={20} className="text-white" />
                </div>
                <div>
                  <h2 className="text-base font-black text-white uppercase tracking-wider leading-tight">
                    Manage QF Document Numbers
                  </h2>
                  <p className="text-[11px] text-white/80 font-medium">Configure format standards and revision dates</p>
                </div>
              </div>
              <button
                onClick={() => setIsQfManagerOpen(false)}
                className="text-white/70 hover:text-white bg-black/20 hover:bg-black/40 p-2 rounded-xl transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto bg-[#222] flex-1">
              {qfSettings.length === 0 ? (
                <div className="text-center text-gray-500 py-12 font-bold uppercase tracking-wider text-sm">
                  No QF Settings Found.
                </div>
              ) : (
                <div className="space-y-4">
                  {qfSettings.map((setting) => (
                    <div key={setting.formName} className="bg-[#2c2c2c] p-5 rounded-2xl border border-[#404040] flex flex-col md:flex-row gap-4 items-end">
                      <div className="flex-1 w-full">
                        <label className="block text-[11px] font-black uppercase tracking-wider text-[#ff9100] mb-2">
                          {setting.formName.replace(/-/g, " ")} - QF Code
                        </label>
                        <input
                          type="text"
                          value={setting.qfValue}
                          onChange={(e) => {
                            const val = e.target.value;
                            setQfSettings((prev) =>
                              prev.map((s) => (s.formName === setting.formName ? { ...s, qfValue: val } : s))
                            );
                          }}
                          className="w-full bg-[#1b1b1b] border border-[#444] p-3 rounded-xl text-gray-200 font-mono text-sm focus:outline-none focus:border-[#ff9100] shadow-inner"
                        />
                      </div>
                      <div className="w-full md:w-1/4">
                        <label className="block text-[11px] font-black uppercase tracking-wider text-[#ff9100] mb-2">
                          Effective Date
                        </label>
                        <input
                          type="date"
                          value={setting.date ? setting.date.split("T")[0] : ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setQfSettings((prev) =>
                              prev.map((s) => (s.formName === setting.formName ? { ...s, date: val } : s))
                            );
                          }}
                          className="w-full bg-[#1b1b1b] border border-[#444] p-3 rounded-xl text-gray-200 font-mono text-sm focus:outline-none focus:border-[#ff9100] shadow-inner [color-scheme:dark]"
                        />
                      </div>
                      <button
                        onClick={() => handleSaveSingleQfSetting(setting)}
                        disabled={savingId === setting.formName}
                        className="bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-black text-xs uppercase tracking-wider px-6 py-3 rounded-xl transition-all shadow-md flex justify-center items-center gap-2 disabled:opacity-50 cursor-pointer shrink-0"
                      >
                        {savingId === setting.formName ? <Loader className="w-4 h-4 animate-spin" /> : "Update"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* FULL-SCREEN SPLIT MODAL FOR 4M REVIEW */}
      {selectedReport && (
        <div className="fixed inset-0 z-[8000] bg-slate-950/90 backdrop-blur-md flex flex-col overflow-hidden animate-fade-in">
          <div className="bg-slate-900 text-white px-8 py-4 flex justify-between items-center shrink-0 border-b border-slate-800 shadow-xl z-10">
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
                <ClipboardList className="w-5 h-5" />
              </span>
              <div>
                <h3 className="font-extrabold text-lg tracking-wide uppercase text-indigo-400 leading-tight">
                  Verify 4M Checksheet
                </h3>
                <p className="text-xs text-gray-400">Review generated technical sheet before recording digital sign-off</p>
              </div>
            </div>
            <button
              onClick={() => {
                if (pdfUrl) URL.revokeObjectURL(pdfUrl);
                setSelectedReport(null);
                setPdfUrl(null);
              }}
              className="text-gray-400 hover:text-white bg-slate-800 hover:bg-slate-700 p-2 rounded-xl transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            <div className="flex-1 h-full bg-[#3d4144] relative flex items-center justify-center">
              {isPdfLoading && <Loader className="animate-spin text-white w-10 h-10 absolute" />}
              {pdfUrl && (
                <iframe src={`${pdfUrl}#toolbar=0&view=FitH`} className="w-full h-full border-none relative z-10" title="PDF Preview" />
              )}
            </div>
            
            <div className="w-full lg:w-[420px] bg-slate-900 text-gray-100 border-l border-slate-800 flex flex-col shrink-0 shadow-2xl z-10 overflow-y-auto">
              <div className="p-7 flex-1 flex flex-col justify-between">
                <div className="space-y-5">
                  <h4 className="text-xs font-black text-indigo-400 tracking-widest uppercase">Report Metadata</h4>
                  
                  <div className="bg-slate-800/80 p-5 rounded-2xl border border-slate-700/80 shadow-inner flex flex-col gap-3.5">
                    <div className="flex justify-between items-center border-b border-slate-700/60 pb-3">
                      <span className="text-xs font-bold text-gray-400 uppercase">Line Code</span>
                      <span className="text-sm font-extrabold text-white font-mono bg-slate-700/50 px-2 py-0.5 rounded">
                        {selectedReport.lineCode}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 pt-1">
                      <span className="text-xs font-bold text-gray-400 uppercase">Part Name</span>
                      <span className="text-sm font-bold text-gray-100 leading-relaxed">{selectedReport.partName}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-6">
                  <button
                    onClick={submitHODSignature}
                    className="w-full bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 active:scale-98 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-emerald-900/40 transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Verify & Approve Checksheet
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FULL-SCREEN SPLIT MODAL FOR COMPETENCY EVALUATION REVIEW */}
      {selectedCompetencyReport && (
        <div className="fixed inset-0 z-[8000] bg-slate-950/90 backdrop-blur-md flex flex-col overflow-hidden animate-fade-in">
          <div className="bg-slate-900 text-white px-8 py-4 flex justify-between items-center shrink-0 border-b border-slate-800 shadow-xl z-10">
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
                <Award className="w-5 h-5" />
              </span>
              <div>
                <h3 className="font-extrabold text-lg tracking-wide uppercase text-indigo-400 leading-tight">
                  Verify Competency Evaluation Form
                </h3>
                <p className="text-xs text-gray-400">Check written and practical assessment details before approval</p>
              </div>
            </div>
            <button
              onClick={() => {
                if (competencyPdfUrl) URL.revokeObjectURL(competencyPdfUrl);
                setSelectedCompetencyReport(null);
                setCompetencyPdfUrl(null);
              }}
              className="text-gray-400 hover:text-white bg-slate-800 hover:bg-slate-700 p-2 rounded-xl transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            <div className="flex-1 h-full bg-[#3d4144] relative flex items-center justify-center">
              {isCompetencyPdfLoading && <Loader className="animate-spin text-white w-10 h-10 absolute" />}
              {competencyPdfUrl && (
                <iframe
                  src={`${competencyPdfUrl}#toolbar=0&view=FitH`}
                  className="w-full h-full border-none relative z-10"
                  title="Competency Evaluation PDF Preview"
                />
              )}
            </div>

            <div className="w-full lg:w-[420px] bg-slate-900 text-gray-100 border-l border-slate-800 flex flex-col shrink-0 shadow-2xl z-10 overflow-y-auto">
              <div className="p-7 flex-1 flex flex-col justify-between">
                <div className="space-y-5">
                  <h4 className="text-xs font-black text-indigo-400 tracking-widest uppercase">Evaluation Details</h4>
                  
                  <div className="bg-slate-800/80 p-5 rounded-2xl border border-slate-700/80 shadow-inner flex flex-col gap-3 text-sm">
                    <div className="flex justify-between items-center border-b border-slate-700/60 pb-2">
                      <span className="text-xs font-bold text-gray-400 uppercase">Operator Name</span>
                      <span className="font-bold text-white">{selectedCompetencyReport.name}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-slate-700/60 pb-2">
                      <span className="text-xs font-bold text-gray-400 uppercase">Employee No</span>
                      <span className="font-mono font-bold text-white bg-slate-700/50 px-2 py-0.5 rounded text-xs">
                        {selectedCompetencyReport.employeeNo}
                      </span>
                    </div>
                    <div className="flex justify-between items-center border-b border-slate-700/60 pb-2">
                      <span className="text-xs font-bold text-gray-400 uppercase">Evaluation Date</span>
                      <span className="text-gray-300">{selectedCompetencyReport.evalDate}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-slate-700/60 pb-2">
                      <span className="text-xs font-bold text-gray-400 uppercase">Line</span>
                      <span className="text-gray-200 font-semibold">{selectedCompetencyReport.line || "-"}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-slate-700/60 pb-2">
                      <span className="text-xs font-bold text-gray-400 uppercase">Written Exam</span>
                      <span className="font-bold text-indigo-300 font-mono">
                        {selectedCompetencyReport.writtenExamMark ?? "-"} ({selectedCompetencyReport.writtenExamPercentage || "-"})
                      </span>
                    </div>
                    <div className="flex justify-between items-center border-b border-slate-700/60 pb-2">
                      <span className="text-xs font-bold text-gray-400 uppercase">Practical Exam</span>
                      <span className="font-bold text-indigo-300 font-mono">
                        {selectedCompetencyReport.practicalExamMark ?? "-"} ({selectedCompetencyReport.practicalExamPercentage || "-"})
                      </span>
                    </div>
                    <div className="flex justify-between items-center border-b border-slate-700/60 pb-2">
                      <span className="text-xs font-bold text-gray-400 uppercase">Status</span>
                      <span
                        className={`px-2.5 py-0.5 rounded text-xs font-black uppercase tracking-wider ${
                          selectedCompetencyReport.status === "PASS"
                            ? "bg-green-500/20 text-green-400 border border-green-500/30"
                            : selectedCompetencyReport.status === "FAIL"
                            ? "bg-red-500/20 text-red-400 border border-red-500/30"
                            : "bg-gray-700 text-gray-300"
                        }`}
                      >
                        {selectedCompetencyReport.status || "Pending"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-1">
                      <span className="text-xs font-bold text-gray-400 uppercase">Evaluated By</span>
                      <span className="text-gray-300 font-medium">{selectedCompetencyReport.inchargeSign || "-"}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-6">
                  <button
                    onClick={submitCompetencyHodSignature}
                    className="w-full bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 active:scale-98 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-emerald-900/40 transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Verify & Approve HOD
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Hod;