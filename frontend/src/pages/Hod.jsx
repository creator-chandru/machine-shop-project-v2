import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import Header from "../components/Header";
import EditPartMapping from "../components/EditPartMapping";
import JobSetupMasterConfigurator from "../components/jobSetupMasterConfigurator";
import AddPartSetModal from "../components/AddPartSetModal.jsx";
import { RefreshCw, Loader, X, ClipboardList, Settings2, Layers, ChevronRight, BookOpen, Award } from "lucide-react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const Hod = () => {
  const { shopId } = useParams();

  const [activeTab, setActiveTab] = useState("four-m"); // "four-m" | "job-setup-master" | "competency-eval"
  const [pendingReports, setPendingReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [isAddPartSetOpen, setIsAddPartSetOpen] = useState(false);

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

  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  const currentHOD = currentUser.username || currentUser.employeeId || "HOD";

  const fetchPendingReports = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${process.env.REACT_APP_API_URL}/api/four-m-change-monitoring/hod/pending/${encodeURIComponent(currentHOD)}?shopId=${shopId || 3}`,
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
        `${process.env.REACT_APP_API_URL || ""}/api/competency-evaluation-form/hod/pending/${encodeURIComponent(currentHOD)}?shopId=${shopId || 3}`,
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
      const res = await fetch(`${process.env.REACT_APP_API_URL || ""}/api/qf-values`, {
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
      const res = await fetch(`${process.env.REACT_APP_API_URL || ""}/api/qf-values`, {
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
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/competency-exam/questions`, {
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
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/competency-exam/questions`, {
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
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/competency-exam/questions/${id}`, {
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
    setSelectedReport(report);
    setPdfUrl(null);
    setIsPdfLoading(true);

    try {
      const token = localStorage.getItem("token");
      const params = new URLSearchParams({
        lineCode: report.lineCode,
        partName: report.partName,
        shopId: String(report.machineShop || shopId || 3),
        hodSign: `Pending [${currentHOD}]`
      });

      const res = await fetch(
        `${process.env.REACT_APP_API_URL || ""}/api/four-m-change-monitoring/report?${params.toString()}`,
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
        `${process.env.REACT_APP_API_URL || ""}/api/four-m-change-monitoring/hod/sign`,
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
        `${process.env.REACT_APP_API_URL || ""}/api/competency-evaluation-form/report?${params.toString()}`,
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
        `${process.env.REACT_APP_API_URL || ""}/api/competency-evaluation-form/sign-hod`,
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

  return (
    <div className="min-h-screen w-full bg-[#2d2d2d] font-sans pb-10">
      <Header />
      <ToastContainer position="top-right" autoClose={2000} />
      <div className="p-8 max-w-7xl mx-auto space-y-8">
        <h1 className="text-3xl font-black text-white tracking-widest uppercase text-center mb-2">
          HOD Dashboard
        </h1>
        <p className="text-gray-400 text-center mb-8">Managing Machine Shop - {shopId}</p>

        {/* Pending Reports Section */}
        <div className="bg-white rounded-xl shadow-2xl p-8 border-t-4 border-indigo-500">
          <div className="flex justify-between items-center mb-6 border-b pb-4 flex-wrap gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-800">
                {activeTab === "four-m"
                  ? "Pending 4M Checksheets"
                  : activeTab === "competency-eval"
                  ? "Pending Competency Evaluations"
                  : "Set Job Verification Set Up"}
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  fetchPendingReports();
                  fetchPendingCompetencyReports();
                }}
                className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                title="Refresh"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
              <span className="bg-indigo-100 text-indigo-800 px-4 py-2 rounded font-bold uppercase shadow-sm">
                Logged in: {currentHOD}
              </span>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-4 mb-6 flex-wrap">
            <button
              onClick={() => setActiveTab("four-m")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm transition-all cursor-pointer ${
                activeTab === "four-m"
                  ? "bg-indigo-500 text-white shadow-md"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              4M Checksheets
              {pendingReports.length > 0 && (
                <span className="bg-white text-indigo-500 text-[11px] font-extrabold px-2 py-0.5 rounded-full ml-1">
                  {pendingReports.length}
                </span>
              )}
            </button>

            {/* Competency Evaluations Tab */}
            <button
              onClick={() => setActiveTab("competency-eval")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm transition-all cursor-pointer ${
                activeTab === "competency-eval"
                  ? "bg-indigo-500 text-white shadow-md"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <Award className="w-4 h-4" />
              Competency Evaluations
              {pendingCompetencyReports.length > 0 && (
                <span className="bg-white text-indigo-500 text-[11px] font-extrabold px-2 py-0.5 rounded-full ml-1">
                  {pendingCompetencyReports.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("job-setup-master")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm transition-all cursor-pointer ${
                activeTab === "job-setup-master"
                  ? "bg-indigo-500 text-white shadow-md"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <Settings2 className="w-4 h-4" />
              Set Job Verification Set Up
            </button>

            {/* COMPETENCY EXAM QUESTION MANAGER BUTTON */}
            <button
              onClick={() => {
                fetchCompetencyQuestions();
                setIsCompetencyManagerOpen(true);
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm transition-all cursor-pointer bg-gray-100 text-gray-700 hover:bg-gray-200"
            >
              <BookOpen className="w-4 h-4" />
              Manage Competency Exam
            </button>

            {/* QF MANAGER BUTTON */}
            <button
              onClick={() => {
                fetchQfSettings();
                setIsQfManagerOpen(true);
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm transition-all cursor-pointer bg-gray-100 text-gray-700 hover:bg-gray-200 ml-auto"
            >
              <BookOpen className="w-4 h-4" />
              Manage QF Values
            </button>
          </div>

          {/* Tab 1: 4M Checksheets */}
          {activeTab === "four-m" && (
            <>
              {pendingReports.length === 0 ? (
                <p className="text-gray-500 italic py-6">No 4M Checksheets pending your review.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse border border-gray-300">
                    <thead className="bg-gray-800 text-white">
                      <tr>
                        <th className="p-3 border border-gray-300">Line Code</th>
                        <th className="p-3 border border-gray-300">Part Name</th>
                        <th className="p-3 border border-gray-300">Submission Batch</th>
                        <th className="p-3 border border-gray-300 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingReports.map((report, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="p-3 border border-gray-300 font-bold">{report.lineCode}</td>
                          <td className="p-3 border border-gray-300">{report.partName}</td>
                          <td className="p-3 border border-gray-300 text-gray-500 text-sm">
                            Last Entry: {report.reportDate}
                          </td>
                          <td className="p-3 border border-gray-300 text-center">
                            <button
                              onClick={() => handleOpenReviewModal(report)}
                              className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-1.5 rounded font-bold text-sm shadow transition-colors cursor-pointer"
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
            </>
          )}

          {/* Tab 2: Competency Evaluations */}
          {activeTab === "competency-eval" && (
            <>
              {pendingCompetencyReports.length === 0 ? (
                <p className="text-gray-500 italic py-6">
                  No Competency Evaluations pending your review.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse border border-gray-300">
                    <thead className="bg-gray-800 text-white">
                      <tr>
                        <th className="p-3 border border-gray-300">Emp No</th>
                        <th className="p-3 border border-gray-300">Operator Name</th>
                        <th className="p-3 border border-gray-300">Qualification</th>
                        <th className="p-3 border border-gray-300">Line</th>
                        <th className="p-3 border border-gray-300">Evaluation Date</th>
                        <th className="p-3 border border-gray-300 text-center">Written / Practical</th>
                        <th className="p-3 border border-gray-300 text-center">Status</th>
                        <th className="p-3 border border-gray-300 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingCompetencyReports.map((report, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="p-3 border border-gray-300 font-bold">{report.employeeNo}</td>
                          <td className="p-3 border border-gray-300">{report.name}</td>
                          <td className="p-3 border border-gray-300">{report.qualification || "-"}</td>
                          <td className="p-3 border border-gray-300">{report.line || "-"}</td>
                          <td className="p-3 border border-gray-300 text-gray-600 text-sm">{report.evalDate}</td>
                          <td className="p-3 border border-gray-300 text-center text-sm font-semibold">
                            {report.writtenExamMark ?? "-"} / {report.practicalExamMark ?? "-"}
                          </td>
                          <td className="p-3 border border-gray-300 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                                report.status === "PASS"
                                  ? "bg-green-100 text-green-800"
                                  : report.status === "FAIL"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              {report.status || "Pending"}
                            </span>
                          </td>
                          <td className="p-3 border border-gray-300 text-center">
                            <button
                              onClick={() => handleOpenCompetencyReviewModal(report)}
                              className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-1.5 rounded font-bold text-sm shadow transition-colors cursor-pointer"
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
            </>
          )}

          {activeTab === "job-setup-master" && <JobSetupMasterConfigurator shopId={shopId} />}
        </div>

        {/* Existing Part Mapping & Add Part Sets Section */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-2xl p-8 border-t-4 border-gray-500">
            <h2 className="text-xl font-bold text-gray-800 mb-6 border-b pb-4">Line & Part Mappings</h2>
            <EditPartMapping shopId={shopId} />
          </div>

          <button
            type="button"
            onClick={() => setIsAddPartSetOpen(true)}
            className="w-full group relative flex items-center justify-between p-6 bg-[#383838] border border-[#4a4a4a] rounded-2xl shadow-[0_8px_20px_rgba(0,0,0,0.3)] hover:border-transparent hover:bg-gradient-to-r hover:from-[#ff9100] hover:to-[#e68200] hover:shadow-[0_12px_28px_rgba(255,145,0,0.3)] hover:-translate-y-1 active:translate-y-0 transition-all duration-300 ease-out cursor-pointer text-left"
          >
            <div className="flex items-center gap-5">
              <div className="p-4 bg-[#2d2d2d] group-hover:bg-white/20 rounded-xl border border-[#4a4a4a] group-hover:border-white/30 shadow-inner transition-colors duration-300">
                <Layers
                  className="w-7 h-7 text-[#ff9100] group-hover:text-white transition-colors duration-300"
                  strokeWidth={2.2}
                />
              </div>
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-wider">
                  Add Part Sets
                </h3>
                <p className="text-xs text-gray-400 group-hover:text-white/90 font-medium transition-colors">
                  Create and register new Part IDs and Part Names for Machine Shop - {shopId || 3}
                </p>
              </div>
            </div>

            <div className="p-2.5 rounded-full bg-white/5 group-hover:bg-white/20 transition-colors">
              <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-white group-hover:translate-x-1 transition-all" />
            </div>
          </button>
        </div>
      </div>

      <AddPartSetModal
        isOpen={isAddPartSetOpen}
        onClose={() => setIsAddPartSetOpen(false)}
        defaultShopId={shopId || "3"}
      />

      {/* COMPETENCY EXAM QUESTION MANAGER MODAL */}
      {isCompetencyManagerOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#383838] border border-[#4a4a4a] w-full max-w-4xl rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-gradient-to-r from-indigo-600 to-[#ff9100] px-6 py-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-black/20 p-2.5 rounded-lg shadow-inner">
                  <BookOpen size={22} className="text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white uppercase tracking-widest leading-tight">
                    Manage Competency Exam Questions
                  </h2>
                </div>
              </div>
              <button
                onClick={() => setIsCompetencyManagerOpen(false)}
                className="text-white/70 hover:text-white bg-black/20 p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto bg-[#2d2d2d] flex-1 space-y-6">
              <form onSubmit={handleAddCompetencyQuestion} className="bg-[#222] p-5 rounded-xl border border-[#4a4a4a] space-y-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Add New Question</h3>
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1">Question Text</label>
                  <input
                    type="text"
                    value={newQuestionText}
                    onChange={(e) => setNewQuestionText(e.target.value)}
                    placeholder="Enter question..."
                    className="w-full bg-[#1a1a1a] border border-[#4a4a4a] p-3 rounded-xl text-gray-200 text-sm focus:outline-none focus:border-[#ff9100]"
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
                        placeholder={`Option ${String.fromCharCode(65 + idx)} text`}
                        className="w-full bg-[#1a1a1a] border border-[#4a4a4a] p-2.5 rounded-xl text-gray-200 text-xs focus:outline-none focus:border-[#ff9100]"
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
                      className="w-full bg-[#1a1a1a] border border-[#4a4a4a] p-2.5 rounded-xl text-gray-200 text-xs focus:outline-none focus:border-[#ff9100]"
                    >
                      <option value="A">Option A</option>
                      <option value="B">Option B</option>
                      <option value="C">Option C</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-wider px-6 py-3 rounded-xl transition-all shadow-md cursor-pointer mt-5"
                  >
                    Add Question
                  </button>
                </div>
              </form>

              <div className="space-y-3">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Existing Questions ({examQuestions.length})
                </h3>
                {examQuestions.length === 0 ? (
                  <p className="text-center text-gray-500 py-6 font-medium">No questions added yet.</p>
                ) : (
                  examQuestions.map((q, idx) => (
                    <div key={q.id} className="bg-[#222] p-4 rounded-xl border border-[#4a4a4a] flex justify-between items-start gap-4">
                      <div>
                        <p className="font-bold text-white text-sm">
                          Q{idx + 1}. {q.text}
                        </p>
                        <div className="text-xs text-gray-400 mt-1 flex flex-wrap gap-3">
                          {q.options.map((opt, oIdx) => (
                            <span
                              key={oIdx}
                              className={String.fromCharCode(65 + oIdx) === q.correctAnswer ? "text-green-400 font-bold" : ""}
                            >
                              {String.fromCharCode(65 + oIdx)}: {opt}
                            </span>
                          ))}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteCompetencyQuestion(q.id)}
                        className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0"
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
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#383838] border border-[#4a4a4a] w-full max-w-4xl rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col max-h-[85vh]">
            <div className="bg-gradient-to-r from-indigo-600 to-[#ff9100] px-6 py-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-black/20 p-2.5 rounded-lg shadow-inner">
                  <BookOpen size={22} className="text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white uppercase tracking-widest leading-tight">
                    Manage QF Document Numbers
                  </h2>
                </div>
              </div>
              <button
                onClick={() => setIsQfManagerOpen(false)}
                className="text-white/70 hover:text-white bg-black/20 p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto bg-[#2d2d2d] flex-1">
              {qfSettings.length === 0 ? (
                <div className="text-center text-gray-500 py-10 font-black uppercase tracking-widest">
                  No QF Settings Found.
                </div>
              ) : (
                <div className="space-y-4">
                  {qfSettings.map((setting) => (
                    <div key={setting.formName} className="bg-[#222] p-5 rounded-xl border border-[#4a4a4a] flex flex-col md:flex-row gap-5 items-end">
                      <div className="flex-1 w-full">
                        <label className="block text-[10px] font-black uppercase tracking-widest text-[#ff9100] mb-2">
                          {setting.formName.replace(/-/g, " ")} - QF Value
                        </label>
                        <input
                          type="text"
                          value={setting.qfValue}
                          onChange={(e) => {
                            const newSettings = [...qfSettings];
                            const idx = newSettings.findIndex((s) => s.formName === setting.formName);
                            newSettings[idx].qfValue = e.target.value;
                            setQfSettings(newSettings);
                          }}
                          className="w-full bg-[#1a1a1a] border border-[#4a4a4a] p-3.5 rounded-xl text-gray-200 font-mono text-sm focus:outline-none focus:border-[#ff9100] shadow-inner"
                        />
                      </div>
                      <div className="w-full md:w-1/4">
                        <label className="block text-[10px] font-black uppercase tracking-widest text-[#ff9100] mb-2">
                          Effective Date
                        </label>
                        <input
                          type="date"
                          value={setting.date ? setting.date.split("T")[0] : ""}
                          onChange={(e) => {
                            const newSettings = [...qfSettings];
                            const idx = newSettings.findIndex((s) => s.formName === setting.formName);
                            newSettings[idx].date = e.target.value;
                            setQfSettings(newSettings);
                          }}
                          className="w-full bg-[#1a1a1a] border border-[#4a4a4a] p-3.5 rounded-xl text-gray-200 font-mono text-sm focus:outline-none focus:border-[#ff9100] shadow-inner [color-scheme:dark]"
                        />
                      </div>
                      <button
                        onClick={() => handleSaveSingleQfSetting(setting)}
                        disabled={savingId === setting.formName}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-wider px-6 py-3.5 rounded-xl transition-all shadow-md flex justify-center items-center gap-2 disabled:opacity-50 cursor-pointer"
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
        <div className="fixed inset-0 z-[8000] bg-white flex flex-col overflow-hidden animate-fade-in">
          <div className="bg-gray-900 text-white px-6 py-4 flex justify-between items-center shrink-0 shadow-md z-10">
            <h3 className="font-bold text-xl uppercase tracking-wider">
              Verify 4M Checksheet
            </h3>
            <button
              onClick={() => {
                setSelectedReport(null);
                setPdfUrl(null);
              }}
              className="text-gray-400 hover:text-red-400 transition-colors cursor-pointer"
            >
              <X size={28} />
            </button>
          </div>
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            <div className="flex-1 h-full bg-[#525659] relative flex items-center justify-center">
              {isPdfLoading && <Loader className="animate-spin text-white w-12 h-12 absolute" />}
              {pdfUrl && (
                <iframe src={`${pdfUrl}#toolbar=0&view=FitH`} className="w-full h-full border-none relative z-10" title="PDF Preview" />
              )}
            </div>
            <div className="w-full lg:w-[400px] bg-gray-50 border-l border-gray-300 flex flex-col shrink-0 shadow-2xl z-10 overflow-y-auto">
              <div className="p-6 flex-1 flex flex-col">
                <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-200 mb-6 text-sm flex flex-col gap-2 shadow-sm text-indigo-900">
                  <p><span className="font-bold">Line Code:</span> {selectedReport.lineCode}</p>
                  <p><span className="font-bold">Part Name:</span> {selectedReport.partName}</p>
                </div>

                <div className="mt-auto">
                  <button
                    onClick={submitHODSignature}
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-black text-lg uppercase tracking-wider shadow-lg transition-transform hover:-translate-y-1 cursor-pointer"
                  >
                    Verify & Approve
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FULL-SCREEN SPLIT MODAL FOR COMPETENCY EVALUATION REVIEW */}
      {selectedCompetencyReport && (
        <div className="fixed inset-0 z-[8000] bg-white flex flex-col overflow-hidden animate-fade-in">
          <div className="bg-gray-900 text-white px-6 py-4 flex justify-between items-center shrink-0 shadow-md z-10">
            <h3 className="font-bold text-xl uppercase tracking-wider">
              Verify Competency Evaluation Form
            </h3>
            <button
              onClick={() => {
                setSelectedCompetencyReport(null);
                setCompetencyPdfUrl(null);
              }}
              className="text-gray-400 hover:text-red-400 transition-colors cursor-pointer"
            >
              <X size={28} />
            </button>
          </div>
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            <div className="flex-1 h-full bg-[#525659] relative flex items-center justify-center">
              {isCompetencyPdfLoading && <Loader className="animate-spin text-white w-12 h-12 absolute" />}
              {competencyPdfUrl && (
                <iframe
                  src={`${competencyPdfUrl}#toolbar=0&view=FitH`}
                  className="w-full h-full border-none relative z-10"
                  title="Competency Evaluation PDF Preview"
                />
              )}
            </div>
            <div className="w-full lg:w-[400px] bg-gray-50 border-l border-gray-300 flex flex-col shrink-0 shadow-2xl z-10 overflow-y-auto">
              <div className="p-6 flex-1 flex flex-col">
                <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-200 mb-6 text-sm flex flex-col gap-2 shadow-sm text-indigo-900">
                  <p><span className="font-bold">Operator Name:</span> {selectedCompetencyReport.name}</p>
                  <p><span className="font-bold">Employee No:</span> {selectedCompetencyReport.employeeNo}</p>
                  <p><span className="font-bold">Evaluation Date:</span> {selectedCompetencyReport.evalDate}</p>
                  <p><span className="font-bold">Line:</span> {selectedCompetencyReport.line || "-"}</p>
                  <p><span className="font-bold">Written Exam:</span> {selectedCompetencyReport.writtenExamMark ?? "-"} ({selectedCompetencyReport.writtenExamPercentage || "-"})</p>
                  <p><span className="font-bold">Practical Exam:</span> {selectedCompetencyReport.practicalExamMark ?? "-"} ({selectedCompetencyReport.practicalExamPercentage || "-"})</p>
                  <p><span className="font-bold">Status:</span> {selectedCompetencyReport.status || "-"}</p>
                  <p><span className="font-bold">Evaluated By:</span> {selectedCompetencyReport.inchargeSign || "-"}</p>
                </div>

                <div className="mt-auto">
                  <button
                    onClick={submitCompetencyHodSignature}
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-black text-lg uppercase tracking-wider shadow-lg transition-transform hover:-translate-y-1 cursor-pointer"
                  >
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