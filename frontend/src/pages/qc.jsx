import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Header from "../components/Header";
import { ClipboardCheck, RefreshCw, Loader, X } from "lucide-react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const QC = () => {
  const navigate = useNavigate();
  const { shopId } = useParams();

  const [pendingReports, setPendingReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [isPdfLoading, setIsPdfLoading] = useState(false);

  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  const currentQC = currentUser.username || currentUser.employeeId || "qc";

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-GB");
  };

  const fetchPendingReports = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${process.env.REACT_APP_API_URL}/api/tool-change-record/qc/${encodeURIComponent(currentQC)}?shopId=${shopId || 3}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setPendingReports(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      toast.error("Failed to load Tool Change Reports.");
    }
  };

  useEffect(() => {
    fetchPendingReports();
  }, [shopId]);

  // Open Full-screen split review modal with the backend-generated PDF
  const handleOpenReviewModal = async (report) => {
    setSelectedReport(report);
    setPdfUrl(null);
    setIsPdfLoading(true);

    try {
      const rawDate = report.reportDate || report.checkDate;
      let isoDate = rawDate;
      if (rawDate && rawDate.includes('/')) {
        const parts = rawDate.split('/');
        if (parts.length === 3) {
          isoDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      } else if (rawDate && rawDate.includes('T')) {
        isoDate = rawDate.split('T')[0];
      }

      const token = localStorage.getItem("token");
      const params = new URLSearchParams({
        lineCode: report.lineCode,
        date: isoDate,
        shopId: String(report.machineShop || shopId || 3),
      });

      const res = await fetch(
        `${process.env.REACT_APP_API_URL || ""}/api/tool-change-record/report?${params.toString()}`,
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

  const submitQcSignature = async () => {
    try {
      const rawDate = selectedReport.reportDate || selectedReport.checkDate;
      let isoDate = rawDate;
      if (rawDate && rawDate.includes('/')) {
        const parts = rawDate.split('/');
        if (parts.length === 3) {
          isoDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }

      const res = await fetch(
        `${process.env.REACT_APP_API_URL || ""}/api/tool-change-record/sign-qc`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({
            lineCode: selectedReport.lineCode,
            date: isoDate,
            machineNo: selectedReport.machineNo,
            signature: currentQC,
            qcUsername: currentQC,
          }),
        }
      );

      if (!res.ok) throw new Error("Approval failed");

      // Show 2-second success toast message
      toast.success("Tool Change Record approved successfully!", { autoClose: 2000 });

      // Vanish request after 1.5 seconds
      setTimeout(() => {
        setSelectedReport(null);
        fetchPendingReports();
      }, 1500);
    } catch (err) {
      toast.error("Failed to save QC approval.");
    }
  };

  return (
    <>
      <Header />
      <ToastContainer position="top-right" autoClose={2000} />

      <div className="min-h-screen bg-[#2d2d2d] p-10 space-y-10">
        <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-2xl p-8 border-t-4 border-orange-500">
          <div className="flex justify-between items-center mb-6 border-b pb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                Tool Change Record Approvals
              </h1>
              <p className="text-xs text-gray-500 mt-1">
                Machine Shop-{shopId || 3} Pending QC Verification
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={fetchPendingReports}
                className="p-2 text-gray-500 hover:text-orange-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                title="Refresh"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
              <span className="bg-orange-100 text-orange-800 px-4 py-2 rounded font-bold uppercase shadow-sm">
                Logged in: {currentQC}
              </span>
            </div>
          </div>

          {pendingReports.length === 0 ? (
            <p className="text-gray-500 italic py-6">No Tool Change records pending your review.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse border border-gray-300">
                <thead className="bg-gray-800 text-white">
                  <tr>
                    <th className="p-3 border border-gray-300 w-20 text-center">ID</th>
                    <th className="p-3 border border-gray-300">Date</th>
                    <th className="p-3 border border-gray-300">Line Code</th>
                    <th className="p-3 border border-gray-300">Part Name</th>
                    <th className="p-3 border border-gray-300">Shift Incharge</th>
                    <th className="p-3 border border-gray-300">Status</th>
                    <th className="p-3 border border-gray-300 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingReports.map((report) => (
                    <tr key={report.id} className="hover:bg-gray-50">
                      <td className="p-3 border border-gray-300 text-center font-bold text-gray-400">
                        #{report.id}
                      </td>
                      <td className="p-3 border border-gray-300 font-medium">
                        {formatDate(report.reportDate)}
                      </td>
                      <td className="p-3 border border-gray-300 font-bold">
                        {report.lineCode}
                      </td>
                      <td className="p-3 border border-gray-300">
                        {report.partName || "N/A"}
                      </td>
                      <td className="p-3 border border-gray-300">
                        {report.toolChangedBySignature || "Shift Incharge"}
                      </td>
                      <td className="p-3 border border-gray-300">
                        {report.verifiedByQcSignature && report.verifiedByQcSignature !== "Pending" ? (
                          <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">
                            ✓ Signed
                          </span>
                        ) : (
                          <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">
                            Pending Review
                          </span>
                        )}
                      </td>
                      <td className="p-3 border border-gray-300 text-center">
                        {(!report.verifiedByQcSignature || report.verifiedByQcSignature === "Pending") && (
                          <button
                            onClick={() => handleOpenReviewModal(report)}
                            className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-1.5 rounded font-bold text-sm shadow transition-colors"
                          >
                            Review & Sign
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* FULL-SCREEN SPLIT MODAL */}
      {selectedReport && (
        <div className="fixed inset-0 z-[9999] bg-white flex flex-col overflow-hidden animate-fade-in">
          <div className="bg-gray-900 text-white px-6 py-4 flex justify-between items-center shrink-0 shadow-md z-10">
            <h3 className="font-bold text-xl uppercase tracking-wider">
              Review & Sign Tool Change Record
            </h3>
            <button
              onClick={() => {
                setSelectedReport(null);
                setPdfUrl(null);
              }}
              className="text-gray-400 hover:text-red-400 transition-colors"
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
                <div className="bg-orange-100 p-4 rounded-xl border border-orange-200 mb-6 text-sm flex flex-col gap-2 shadow-sm text-orange-900">
                  <p>
                    <span className="font-bold">Line Code:</span> {selectedReport.lineCode}
                  </p>
                  <p>
                    <span className="font-bold">Part Name:</span> {selectedReport.partName || "N/A"}
                  </p>
                  <p>
                    <span className="font-bold">Date:</span> {formatDate(selectedReport.reportDate)}
                  </p>
                  <p>
                    <span className="font-bold">Shift Incharge:</span>{" "}
                    {selectedReport.toolChangedBySignature || "Shift Incharge"}
                  </p>
                </div>

                <div className="mt-auto">
                  <button
                    onClick={submitQcSignature}
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-black text-lg uppercase tracking-wider shadow-lg transition-transform hover:-translate-y-1"
                  >
                    Approve Report
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default QC;