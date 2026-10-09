import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import Header from "../components/Header";
import EditPartMapping from "../components/EditPartMapping";
import JobSetupMasterConfigurator from "../components/jobSetupMasterConfigurator";
import { RefreshCw, Loader, X, ClipboardList, Settings2 } from "lucide-react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const Hod = () => {
  const { shopId } = useParams();

  const [activeTab, setActiveTab] = useState("four-m"); // "four-m" | "job-setup-master"
  const [pendingReports, setPendingReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [isPdfLoading, setIsPdfLoading] = useState(false);

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

  useEffect(() => {
    fetchPendingReports();
  }, [shopId, currentHOD]);

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
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({
            lineCode: selectedReport.lineCode,
            partName: selectedReport.partName,
            signature: currentHOD
          }),
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

  return (
    <div className="min-h-screen w-full bg-[#2d2d2d] font-sans pb-10">
      <Header />
      <ToastContainer position="top-right" autoClose={2000} />
      <div className="p-8 max-w-7xl mx-auto">

        <h1 className="text-3xl font-black text-white tracking-widest uppercase text-center mb-2">
          HOD Dashboard
        </h1>
        <p className="text-gray-400 text-center mb-8">Managing Machine Shop - {shopId}</p>

        {/* Pending Reports Section */}
        <div className="bg-white rounded-xl shadow-2xl p-8 mb-8 border-t-4 border-indigo-500">
          <div className="flex justify-between items-center mb-6 border-b pb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-800">
                {activeTab === "four-m" ? "Pending 4M Checksheets" : "Set Job Verification Set Up"}
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={fetchPendingReports} className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-gray-100 rounded-lg transition-colors" title="Refresh">
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
          </div>

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
                          <td className="p-3 border border-gray-300 text-gray-500 text-sm">Last Entry: {report.reportDate}</td>
                          <td className="p-3 border border-gray-300 text-center">
                            <button
                              onClick={() => handleOpenReviewModal(report)}
                              className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-1.5 rounded font-bold text-sm shadow transition-colors"
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

        {/* Existing Part Mapping Component */}
        <div className="bg-white rounded-xl shadow-2xl p-8 border-t-4 border-gray-500">
            <h2 className="text-xl font-bold text-gray-800 mb-6 border-b pb-4">Line & Part Mappings</h2>
            <EditPartMapping shopId={shopId} />
        </div>

      </div>

      {/* FULL-SCREEN SPLIT MODAL FOR REVIEW */}
      {selectedReport && (
        <div className="fixed inset-0 z-[9999] bg-white flex flex-col overflow-hidden animate-fade-in">
          <div className="bg-gray-900 text-white px-6 py-4 flex justify-between items-center shrink-0 shadow-md z-10">
            <h3 className="font-bold text-xl uppercase tracking-wider">
              Verify 4M Checksheet
            </h3>
            <button onClick={() => { setSelectedReport(null); setPdfUrl(null); }} className="text-gray-400 hover:text-red-400 transition-colors">
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
                  <button onClick={submitHODSignature} className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-black text-lg uppercase tracking-wider shadow-lg transition-transform hover:-translate-y-1">
                    Verify & Approve
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
