import React from "react";
import { useParams } from "react-router-dom";
import Header from "../components/Header";
import { ClipboardCheck, RefreshCw } from "lucide-react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const HofInspection = () => {
  const { shopId } = useParams();

  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  const currentRoleName = currentUser.username || currentUser.employeeId || "HOF Inspection";

  const refreshData = () => {
    toast.info("Refreshing data...", { autoClose: 1000 });
    // Add your fetch functions here later
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
          
          <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-300">
            <ClipboardCheck className="w-14 h-14 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-semibold text-lg">
              No reports pending your review.
            </p>
            <p className="text-gray-400 text-sm mt-1">
              Pending records will appear here once submitted.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default HofInspection;