import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import Header from "../components/Header";
import { ClipboardCheck, RefreshCw, Loader, X } from "lucide-react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const HofInspection = () => {
  const { shopId } = useParams();

  const [pendingReports, setPendingReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [isPdfLoading, setIsPdfLoading] = useState(false);

  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  const currentRoleName = currentUser.username || currentUser.employeeId || "HOF Inspection";

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-GB");
  };

  const fetchPendingReports = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${process.env.REACT_APP_API_URL || ""}/api/job-setup-verification/hof-inspn/${encodeURIComponent(currentRoleName)}?shopId=${shopId || 3}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setPendingReports(Array.isArray(data) ? data : []);
      } else {
        setPendingReports([]);
      }
    } catch (err) {
      toast.error("Failed to load pending Job Setup Verifications.");
      setPendingReports([]);
    }
  };

  useEffect(() => {
    fetchPendingReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId]);

  const refreshData = () => {
    toast.info("Refreshing data...", { autoClose: 1000 });
    fetchPendingReports();
  };

  const handleOpenReviewModal = async (report) => {
    setSelectedReport(report);
    setPdfUrl(null);
    setIsPdfLoading(true);

    try {
      const rawDate = report.reportDate;
      let isoDate = rawDate;
      if (rawDate && rawDate.includes("/")) {
        const parts = rawDate.split("/");
        if (parts.length === 3) {
          isoDate = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
        }
      } else if (rawDate && rawDate.includes("T")) {
        isoDate = rawDate.split("T")[0];
      }

      const token = localStorage.getItem("token");
      const params = new URLSearchParams({
        partName: report.partName || "",
        date: isoDate,
        shopId: String(report.machineShop || shopId || 3),
      });

      const res = await fetch(
        `${process.env.REACT_APP_API_URL || ""}/api/job-setup-verification/report?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!res.ok) throw new Error("Report request failed");

      const blob = await res.blob();
      setPdfUrl(URL.createObjectURL(blob));
    } catch (err) {
      toast.error("Failed to generate report preview.");
    }
    setIsPdfLoading(false);
  };

  const submitSignature = async () => {
    try {
      const res = await fetch(
        `${process.env.REACT_APP_API_URL || ""}/api/job-setup-verification/sign-hof-inspn`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({
            id: selectedReport.id,
            signature: currentRoleName,
            username: currentRoleName,
          }),
        }
      );

      if (!res.ok) throw new Error("Approval failed");

      toast.success("Report approved successfully!", { autoClose: 2000 });

      setTimeout(() => {
        setSelectedReport(null);
        setPdfUrl(null);
        fetchPendingReports();
      }, 1500);
    } catch (err) {
      toast.error("Failed to save HOF Inspection approval.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <ToastContainer position="top-right" autoClose={2000} />

      <div className="p-6">
        {/* PAGE HEADER */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-800 uppercase tracking-tight">
              HOF Inspection Dashboard
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Machine Shop-{shopId || 3} Pending Authorizations
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <span className="bg-indigo-100 text-indigo-800 px-4 py-2 rounded-lg font-bold text-xs uppercase shadow-sm">
              Logged in: {currentRoleName}
            </span>
            <button
              onClick={refreshData}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors cursor-pointer shadow-sm"
            >
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
          </div>
        </div>

        {/* CONTENT CONTAINER */}
        <div className="bg-white rounded-xl shadow-sm p-6 border-t-4 border-indigo-600 min-h-[400px]">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Job Setup Verification</h2>

          {pendingReports.length === 0 ? (
            <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-300">
              <ClipboardCheck className="w-14 h-14 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 font-semibold text-lg">
                No reports pending your review.
              </p>
              <p className="text-gray-400 text-sm mt-1">
                Pending records will appear here once submitted.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse border border-gray-300">
                <thead className="bg-gray-800 text-white text-xs uppercase tracking-wider">
                  <tr>
                    <th className="p-3 border border-gray-300 w-16 text-center">ID</th>
                    <th className="p-3 border border-gray-300">Date</th>
                    <th className="p-3 border border-gray-300">Part Name</th>
                    <th className="p-3 border border-gray-300">Operation No</th>
                    <th className="p-3 border border-gray-300">Shift</th>
                    <th className="p-3 border border-gray-300">Setter</th>
                    <th className="p-3 border border-gray-300">Inspector (QC)</th>
                    <th className="p-3 border border-gray-300 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {pendingReports.map((report) => (
                    <tr key={`js-${report.id}`} className="hover:bg-indigo-50/40 transition-colors">
                      <td className="p-3 border border-gray-300 text-center font-bold text-gray-400">
                        #{report.id}
                      </td>
                      <td className="p-3 border border-gray-300 font-bold">
                        {formatDate(report.reportDate)}
                      </td>
                      <td className="p-3 border border-gray-300 font-bold">
                        {report.partName || "N/A"}
                      </td>
                      <td className="p-3 border border-gray-300 font-semibold">
                        {report.operationNo || "N/A"}
                      </td>
                      <td className="p-3 border border-gray-300 font-semibold">
                        {report.shift || "1st"}
                      </td>
                      <td className="p-3 border border-gray-300">
                        {report.shiftInchargeName || "Shift Incharge"}
                      </td>
                      <td className="p-3 border border-gray-300">
                        {report.verifiedByQcSignature && report.verifiedByQcSignature !== "Pending" ? (
                          <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">
                            ✓ QC Verified
                          </span>
                        ) : (
                          <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-bold">
                            Pending QC
                          </span>
                        )}
                      </td>
                      <td className="p-3 border border-gray-300 text-center">
                        <button
                          onClick={() => handleOpenReviewModal(report)}
                          className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-1.5 rounded-lg font-bold text-xs shadow transition-colors cursor-pointer"
                        >
                          Review & Sign
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

      {/* FULL-SCREEN SPLIT REVIEW MODAL */}
      {selectedReport && (
        <div className="fixed inset-0 z-[9999] bg-white flex flex-col overflow-hidden animate-fade-in">
          <div className="bg-gray-900 text-white px-6 py-4 flex justify-between items-center shrink-0 shadow-md z-10">
            <h3 className="font-bold text-xl uppercase tracking-wider">
              Review & Sign Job Setup Verification (HOF-INSPN)
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
              {isPdfLoading && (
                <Loader className="animate-spin text-white w-12 h-12 absolute" />
              )}
              {pdfUrl && (
                <iframe
                  src={`${pdfUrl}#toolbar=0&view=FitH`}
                  className="w-full h-full border-none relative z-10"
                  title="PDF Preview"
                />
              )}
            </div>
            <div className="w-full lg:w-[400px] bg-gray-50 border-l border-gray-300 flex flex-col shrink-0 shadow-2xl z-10 overflow-y-auto">
              <div className="p-6 flex-1 flex flex-col">
                <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-200 mb-6 text-sm flex flex-col gap-2 shadow-sm text-indigo-900">
                  <p>
                    <span className="font-bold">Part Details:</span> {selectedReport.partName || "N/A"}
                  </p>
                  {selectedReport.operationNo && (
                    <p>
                      <span className="font-bold">Operation No:</span> {selectedReport.operationNo}
                    </p>
                  )}
                  <p>
                    <span className="font-bold">Date:</span> {formatDate(selectedReport.reportDate)}
                  </p>
                  {selectedReport.shift && (
                    <p>
                      <span className="font-bold">Shift:</span> {selectedReport.shift}
                    </p>
                  )}
                  <p>
                    <span className="font-bold">Shift Incharge:</span>{" "}
                    {selectedReport.shiftInchargeName || "Shift Incharge"}
                  </p>
                </div>

                <div className="mt-auto">
                  <button
                    onClick={submitSignature}
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-black text-lg uppercase tracking-wider shadow-lg transition-transform hover:-translate-y-1 cursor-pointer"
                  >
                    Approve Report
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

export default HofInspection;
