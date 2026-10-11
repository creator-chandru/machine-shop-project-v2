import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import Header from "../components/Header";

import {
  RefreshCw,
  Loader,
  X,
  FileText,
  Activity,
  Clock,
  FileSpreadsheet,
  Users,
  FileSearch,
} from "lucide-react";

import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// ============================================================
// API CONFIGURATION
// ============================================================

const API_BASE = "http://localhost:5000/api";

// ============================================================
// PRODUCT ENGINEER DASHBOARD
// ============================================================

const ProductEngineer = () => {
  const { shopId } = useParams();

  // ============================================================
  // ACTIVE TAB
  // ============================================================

  const [activeTab, setActiveTab] = useState("airgap");

  // ============================================================
  // PENDING REPORT STATES
  // ============================================================

  const [pendingAirGapReports, setPendingAirGapReports] =
    useState([]);

  const [pendingIdleTimeReports, setPendingIdleTimeReports] =
    useState([]);

  const [pendingDailyProdReports, setPendingDailyProdReports] =
    useState([]);

  const [pendingSignificantReports, setPendingSignificantReports] =
    useState([]);

  const [pendingOperatorAllotments, setPendingOperatorAllotments] =
    useState([]);

  const [pendingEightDReports, setPendingEightDReports] =
    useState([]);

  const [pendingLevel1Reports, setPendingLevel1Reports] =
    useState([]);

  // ============================================================
  // PDF REVIEW MODAL STATES
  // ============================================================

  const [selectedReport, setSelectedReport] = useState(null);

  const [reviewReportType, setReviewReportType] = useState(null);

  const [pdfUrl, setPdfUrl] = useState(null);

  const [isPdfLoading, setIsPdfLoading] = useState(false);

  const [isApproving, setIsApproving] = useState(false);

  // ============================================================
  // CURRENT PRODUCT ENGINEER
  // ============================================================

  let currentUser = {};

  try {
    currentUser = JSON.parse(
      localStorage.getItem("user") || "{}"
    );
  } catch (error) {
    console.error("Invalid user information:", error);
  }

  const currentPE =
    currentUser.username ||
    currentUser.employeeId ||
    "";

  const currentShop = shopId || 3;

  // ============================================================
  // DATE FORMAT
  // ============================================================

  const formatDate = (dateStr) => {
    if (!dateStr) return "";

    const date = new Date(dateStr);

    if (Number.isNaN(date.getTime())) {
      return String(dateStr);
    }

    return date.toLocaleDateString("en-GB");
  };

  const normalizeDate = (rawDate) => {
    if (!rawDate) return "";

    let isoDate = String(rawDate);

    if (isoDate.includes("/")) {
      const parts = isoDate.split("/");

      if (parts.length === 3) {
        isoDate =
          `${parts[2]}-` +
          `${parts[1].padStart(2, "0")}-` +
          `${parts[0].padStart(2, "0")}`;
      }
    } else if (isoDate.includes("T")) {
      isoDate = isoDate.split("T")[0];
    }

    return isoDate;
  };

  const getReportDate = (report) => {
    return normalizeDate(
      report.checklistDate ||
        report.reportDate ||
        report.checkDate ||
        report.recordDate ||
        report.date
    );
  };

  // ============================================================
  // AUTH HEADERS
  // ============================================================

  const getAuthHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  });

  // ============================================================
  // FETCH PENDING AIR GAP SENSOR REPORTS
  // ============================================================

  const fetchPendingAirGapReports = async () => {
    try {
      if (!currentPE) return;

      const response = await fetch(
        `${API_BASE}/air-gap-sensor/pe/pending/${encodeURIComponent(
          currentPE
        )}?shopId=${currentShop}`,
        {
          headers: getAuthHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch Air Gap reports");
      }

      const data = await response.json();

      setPendingAirGapReports(
        Array.isArray(data) ? data : []
      );
    } catch (error) {
      console.error("Air Gap fetch error:", error);

      toast.error(
        "Failed to load Pending Air Gap Reports."
      );
    }
  };

  // ============================================================
  // FETCH PENDING IDLE TIME REPORTS
  // ============================================================

  const fetchPendingIdleTimeReports = async () => {
    try {
      if (!currentPE) return;

      const response = await fetch(
        `${API_BASE}/daily-production-idle-time/pe/pending/${encodeURIComponent(
          currentPE
        )}?shopId=${currentShop}`,
        {
          headers: getAuthHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch Idle Time reports");
      }

      const data = await response.json();

      setPendingIdleTimeReports(
        Array.isArray(data) ? data : []
      );
    } catch (error) {
      console.error("Idle Time fetch error:", error);

      toast.error(
        "Failed to load Pending Idle Time Reports."
      );
    }
  };

  // ============================================================
  // FETCH PENDING DAILY PRODUCTION REPORTS
  // ============================================================

  const fetchPendingDailyProdReports = async () => {
    try {
      if (!currentPE) return;

      const response = await fetch(
        `${API_BASE}/daily-production-report/pe/${encodeURIComponent(
          currentPE
        )}?shopId=${currentShop}`,
        {
          headers: getAuthHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error(
          "Failed to fetch Daily Production reports"
        );
      }

      const data = await response.json();

      setPendingDailyProdReports(
        Array.isArray(data) ? data : []
      );
    } catch (error) {
      console.error(
        "Daily Production fetch error:",
        error
      );

      toast.error(
        "Failed to load Pending Daily Production Reports."
      );
    }
  };

  // ============================================================
  // FETCH PENDING SIGNIFICANT EVENT REPORTS
  // ============================================================

  const fetchPendingSignificantReports = async () => {
    try {
      if (!currentPE) return;

      const response = await fetch(
        `${API_BASE}/significant-event-pending/pe/${encodeURIComponent(
          currentPE
        )}`,
        {
          headers: getAuthHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error(
          "Failed to fetch Significant Event reports"
        );
      }

      const data = await response.json();

      setPendingSignificantReports(
        Array.isArray(data) ? data : []
      );
    } catch (error) {
      console.error(
        "Significant Event fetch error:",
        error
      );

      toast.error(
        "Failed to load Pending Significant Event Reports."
      );
    }
  };

  // ============================================================
  // FETCH PENDING OPERATOR ALLOTMENT REPORTS
  // ============================================================

  const fetchPendingOperatorAllotments = async () => {
    try {
      if (!currentPE) return;

      const response = await fetch(
        `${API_BASE}/operator-allotment/pe/pending/${encodeURIComponent(
          currentPE
        )}`,
        {
          headers: getAuthHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error(
          "Failed to fetch Operator Allotment reports"
        );
      }

      const data = await response.json();

      setPendingOperatorAllotments(
        Array.isArray(data.records)
          ? data.records
          : []
      );
    } catch (error) {
      console.error(
        "Operator Allotment fetch error:",
        error
      );

      toast.error(
        "Failed to load Pending Operator Allotments."
      );
    }
  };

  // ============================================================
  // FETCH PENDING 8D REPORTS
  // ============================================================

  const fetchPendingEightDReports = async () => {
    try {
      if (!currentPE) return;

      const response = await fetch(
        `${API_BASE}/8d-report/pe/${encodeURIComponent(
          currentPE
        )}?shopId=${currentShop}`,
        {
          headers: getAuthHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch 8D reports");
      }

      const data = await response.json();

      setPendingEightDReports(
        Array.isArray(data) ? data : []
      );
    } catch (error) {
      console.error("8D fetch error:", error);

      setPendingEightDReports([]);

      toast.error(
        "Failed to load Pending 8D Reports."
      );
    }
  };

  // ============================================================
  // FETCH PENDING LEVEL 1 MAINTENANCE REPORTS
  // ============================================================
  //
  // IMPORTANT:
  // Only fetch reports assigned to the logged-in PE.
  //
  // Example:
  //
  // Logged-in PE = PE01
  //
  // Backend searches:
  //
  // peSignature = 'Pending [PE01]'
  //
  // ============================================================

  const fetchPendingLevel1Reports = async () => {
    try {
      if (!currentPE) {
        setPendingLevel1Reports([]);
        return;
      }

      const params = new URLSearchParams({
        shopId: String(currentShop),
        peUsername: currentPE,
      });

      const response = await fetch(
        `${API_BASE}/level1-maintenance-checklist/pe/pending?${params.toString()}`,
        {
          headers: getAuthHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error(
          "Failed to fetch Level 1 Maintenance reports"
        );
      }

      const data = await response.json();

      setPendingLevel1Reports(
        Array.isArray(data) ? data : []
      );
    } catch (error) {
      console.error(
        "Level 1 Maintenance fetch error:",
        error
      );

      setPendingLevel1Reports([]);

      toast.error(
        "Failed to load Pending Level 1 Maintenance Reports."
      );
    }
  };

  // ============================================================
  // FETCH ALL REPORTS
  // ============================================================

  const fetchAllReports = () => {
    fetchPendingAirGapReports();
    fetchPendingIdleTimeReports();
    fetchPendingDailyProdReports();
    fetchPendingSignificantReports();
    fetchPendingOperatorAllotments();
    fetchPendingEightDReports();
    fetchPendingLevel1Reports();
  };

  useEffect(() => {
    if (currentPE) {
      fetchAllReports();
    }
  }, [shopId, currentPE]);

  // ============================================================
  // OPEN PDF REVIEW MODAL
  // ============================================================

  const handleOpenReviewModal = async (report, type) => {
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
    }

    setSelectedReport(report);
    setReviewReportType(type);
    setPdfUrl(null);
    setIsPdfLoading(true);

    try {
      const isoDate = getReportDate(report);

      let apiUrl = "";

      // ========================================================
      // AIR GAP SENSOR
      // ========================================================

      if (type === "airgap") {
        const params = new URLSearchParams({
          lineCode: report.lineCode,
          partNo: report.partNo || "",
          date: isoDate,
          shopId: String(
            report.machineShop || currentShop
          ),
        });

        apiUrl =
          `${API_BASE}/air-gap-sensor/report?` +
          params.toString();
      }

      // ========================================================
      // IDLE TIME
      // ========================================================

      else if (type === "idletime") {
        const params = new URLSearchParams({
          lineCode: report.lineCode,
          date: isoDate,
          shopId: String(
            report.machineShop || currentShop
          ),
        });

        apiUrl =
          `${API_BASE}/daily-production-idle-time/report?` +
          params.toString();
      }

      // ========================================================
      // SIGNIFICANT EVENT
      // ========================================================

      else if (type === "significant") {
        const params = new URLSearchParams({
          lineCode: report.lineCode || "",
          partName: report.partName || "",
          date: isoDate,
          event: report.event || "",
          shift: report.shift || "",
        });

        apiUrl =
          `${API_BASE}/significant-event-report?` +
          params.toString();
      }

      // ========================================================
      // OPERATOR ALLOTMENT
      // ========================================================

      else if (type === "operatorallotment") {
        const params = new URLSearchParams({
          lineCode: report.lineCode,
          date: isoDate,
        });

        apiUrl =
          `${API_BASE}/operator-allotment/report?` +
          params.toString();
      }

      // ========================================================
      // 8D REPORT
      // ========================================================

      else if (type === "eightd") {
        const params = new URLSearchParams({
          shopId: String(
            report.machineShop || currentShop
          ),
          date: isoDate,
          shift: report.shift || "1ST",
          partNo: report.partNo || "",
          customer: report.customer || "",
        });

        apiUrl =
          `${API_BASE}/8d-report/pdf?` +
          params.toString();
      }

      // ========================================================
      // LEVEL 1 MAINTENANCE
      // ========================================================

      else if (type === "level1maintenance") {
        if (
          !report.lineCode ||
          !report.machineNo ||
          !isoDate
        ) {
          throw new Error(
            "Line Code, Machine No, and Date are required to generate the report."
          );
        }

        const params = new URLSearchParams({
          lineCode: report.lineCode,
          machineNo: report.machineNo,
          date: isoDate,
          shopId: String(
            report.machineShop || currentShop
          ),
        });

        apiUrl =
          `${API_BASE}/level1-maintenance-checklist/report?` +
          params.toString();
      }

      // ========================================================
      // DAILY PRODUCTION
      // ========================================================

      else {
        const params = new URLSearchParams({
          lineCode: report.lineCode,
          date: isoDate,
          shopId: String(
            report.machineShop || currentShop
          ),
        });

        if (report.shift) {
          params.append("shift", report.shift);
        }

        apiUrl =
          `${API_BASE}/daily-production-report/report?` +
          params.toString();
      }

      // ========================================================
      // FETCH PDF
      // ========================================================

      const response = await fetch(apiUrl, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(
            "No data recorded for this specific date."
          );
        }

        throw new Error("Report request failed");
      }

      const blob = await response.blob();

      const objectUrl = URL.createObjectURL(blob);

      setPdfUrl(objectUrl);
    } catch (error) {
      console.error("PDF preview error:", error);

      toast.error(
        error.message ||
          "Failed to generate PDF preview."
      );

      setSelectedReport(null);
      setReviewReportType(null);
    } finally {
      setIsPdfLoading(false);
    }
  };

  // ============================================================
  // CLOSE REVIEW MODAL
  // ============================================================

  const closeReviewModal = () => {
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
    }

    setSelectedReport(null);
    setReviewReportType(null);
    setPdfUrl(null);
    setIsPdfLoading(false);
  };

  // ============================================================
  // SUBMIT PRODUCT ENGINEER SIGNATURE
  // ============================================================

  const submitPESignature = async () => {
    if (
      !selectedReport ||
      !reviewReportType ||
      isApproving
    ) {
      return;
    }

    if (!currentPE) {
      toast.error(
        "Product Engineer username not found. Please log in again."
      );

      return;
    }

    setIsApproving(true);

    try {
      const isoDate = getReportDate(selectedReport);

      let endpoint = "";

      let payload = {};

      // ========================================================
      // AIR GAP SENSOR
      // ========================================================

      if (reviewReportType === "airgap") {
        endpoint =
          `${API_BASE}/air-gap-sensor/pe/sign`;

        payload = {
          lineCode: selectedReport.lineCode,
          partNo: selectedReport.partNo,
          date: isoDate,
          signature: currentPE,
        };
      }

      // ========================================================
      // IDLE TIME
      // ========================================================

      else if (reviewReportType === "idletime") {
        endpoint =
          `${API_BASE}/daily-production-idle-time/pe/sign`;

        payload = {
          lineCode: selectedReport.lineCode,
          date: isoDate,
          machineShop:
            selectedReport.machineShop ||
            currentShop,
          signature: currentPE,
          peUsername: currentPE,
        };
      }

      // ========================================================
      // SIGNIFICANT EVENT
      // ========================================================

      else if (reviewReportType === "significant") {
        endpoint =
          `${API_BASE}/significant-event-sign`;

        payload = {
          role: "pe",
          username: currentPE,
          lineCode: selectedReport.lineCode,
          partName: selectedReport.partName,
          recordDate: isoDate,
          event: selectedReport.event,
          shift: selectedReport.shift,
        };
      }

      // ========================================================
      // OPERATOR ALLOTMENT
      // ========================================================

      else if (
        reviewReportType === "operatorallotment"
      ) {
        endpoint =
          `${API_BASE}/operator-allotment/pe/sign`;

        payload = {
          id: selectedReport.id,
          peSignature: currentPE,
        };
      }

      // ========================================================
      // 8D REPORT
      // ========================================================

      else if (reviewReportType === "eightd") {
        endpoint =
          `${API_BASE}/8d-report/sign-pe`;

        payload = {
          partNo: selectedReport.partNo,
          date: isoDate,
          shift: selectedReport.shift || "1ST",
          signature: currentPE,
          peUsername: currentPE,
        };
      }

      // ========================================================
      // LEVEL 1 MAINTENANCE
      // ========================================================

      else if (
        reviewReportType === "level1maintenance"
      ) {
        endpoint =
          `${API_BASE}/level1-maintenance-checklist/pe/sign`;

        payload = {
          lineCode: selectedReport.lineCode,
          machineNo: selectedReport.machineNo,
          date: isoDate,
          machineShop:
            selectedReport.machineShop ||
            currentShop,
          signature: currentPE,
        };
      }

      // ========================================================
      // DAILY PRODUCTION
      // ========================================================

      else {
        endpoint =
          `${API_BASE}/daily-production-report/sign-pe`;

        payload = {
          lineCode: selectedReport.lineCode,
          date: isoDate,
          shift: selectedReport.shift || "I",
          signature: currentPE,
          peUsername: currentPE,
        };
      }

      // ========================================================
      // SEND APPROVAL REQUEST
      // ========================================================

      const response = await fetch(endpoint, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },

        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({}));

        throw new Error(
          errorData.error ||
            errorData.message ||
            "Approval failed"
        );
      }

      // ========================================================
      // SUCCESS MESSAGE
      // ========================================================

      const successMsg =
        reviewReportType === "airgap"
          ? "Air Gap Checksheet verified and approved successfully!"
          : reviewReportType === "idletime"
          ? "Daily Production & Idle Time Report verified and approved successfully!"
          : reviewReportType === "significant"
          ? "Significant Event Record verified and approved successfully!"
          : reviewReportType === "operatorallotment"
          ? "Operator Allotment Sheet verified and approved successfully!"
          : reviewReportType === "eightd"
          ? "8D Problem Solving Report verified and approved successfully!"
          : reviewReportType === "level1maintenance"
          ? "Level 1 Maintenance report verified and approved successfully!"
          : "Daily Production Report verified and approved successfully!";

      toast.success(successMsg, {
        autoClose: 2000,
      });

      // ========================================================
      // REFRESH PENDING REPORTS
      // ========================================================

      setTimeout(() => {
        closeReviewModal();
        fetchAllReports();
      }, 1500);
    } catch (error) {
      console.error("PE approval error:", error);

      toast.error(
        error.message ||
          "Failed to save PE verification."
      );
    } finally {
      setIsApproving(false);
    }
  };

  // ============================================================
  // TAB CONFIGURATION
  // ============================================================

  const tabs = [
    {
      id: "airgap",
      title: "Air Gap Sensor Checksheets",
      icon: Activity,
      reports: pendingAirGapReports,
      color: "blue",
    },
    {
      id: "idletime",
      title: "Idle Time Reports",
      icon: Clock,
      reports: pendingIdleTimeReports,
      color: "orange",
    },
    {
      id: "dailyproduction",
      title: "Daily Production Reports",
      icon: FileSpreadsheet,
      reports: pendingDailyProdReports,
      color: "green",
    },
    {
      id: "significant",
      title: "Significant Event Records",
      icon: FileText,
      reports: pendingSignificantReports,
      color: "purple",
    },
    {
      id: "operatorallotment",
      title: "Operator Allotment Sheets",
      icon: Users,
      reports: pendingOperatorAllotments,
      color: "teal",
    },
    {
      id: "eightd",
      title: "8D Problem Solving Reports",
      icon: FileSearch,
      reports: pendingEightDReports,
      color: "amber",
    },
    {
      id: "level1maintenance",
      title: "Level 1 Maintenance",
      icon: FileText,
      reports: pendingLevel1Reports,
      color: "indigo",
    },
  ];

  // ============================================================
  // ACTIVE TAB DATA
  // ============================================================

  const activeTabData = tabs.find(
    (tab) => tab.id === activeTab
  );

  const activeReports =
    activeTabData?.reports || [];

  // ============================================================
  // REPORT TABLE CONFIGURATION
  // ============================================================

  const getTableColumns = (type) => {
    switch (type) {
      case "airgap":
        return [
          {
            key: "date",
            label: "Date",
            render: (report) =>
              formatDate(
                report.checkDate ||
                  report.reportDate ||
                  report.date
              ),
          },
          {
            key: "lineCode",
            label: "Line Name",
          },
          {
            key: "partNo",
            label: "Part No",
          },
          {
            key: "partName",
            label: "Part Name",
          },
        ];

      case "idletime":
        return [
          {
            key: "date",
            label: "Date",
            render: (report) =>
              formatDate(
                report.reportDate ||
                  report.recordDate ||
                  report.date
              ),
          },
          {
            key: "lineCode",
            label: "Line Code",
          },
          {
            key: "partNo",
            label: "Part No",
          },
          {
            key: "partName",
            label: "Part Name",
          },
        ];

      case "dailyproduction":
        return [
          {
            key: "date",
            label: "Date",
            render: (report) =>
              formatDate(
                report.reportDate ||
                  report.recordDate ||
                  report.date
              ),
          },
          {
            key: "lineCode",
            label: "Line Code",
          },
          {
            key: "shift",
            label: "Shift",
          },
          {
            key: "partNo",
            label: "Part No",
          },
        ];

      case "significant":
        return [
          {
            key: "date",
            label: "Date",
            render: (report) =>
              formatDate(
                report.recordDate ||
                  report.date
              ),
          },
          {
            key: "lineCode",
            label: "Line Code",
          },
          {
            key: "partName",
            label: "Part Name",
          },
          {
            key: "event",
            label: "Event",
          },
          {
            key: "shift",
            label: "Shift",
          },
        ];

      case "operatorallotment":
        return [
          {
            key: "date",
            label: "Date",
            render: (report) =>
              formatDate(
                report.recordDate ||
                  report.date
              ),
          },
          {
            key: "lineCode",
            label: "Line Code",
          },
          {
            key: "productEngineer",
            label: "Product Engineer",
          },
        ];

      case "eightd":
        return [
          {
            key: "date",
            label: "Date",
            render: (report) =>
              formatDate(
                report.reportDate ||
                  report.recordDate ||
                  report.date
              ),
          },
          {
            key: "partNo",
            label: "Part No",
          },
          {
            key: "customer",
            label: "Customer",
          },
          {
            key: "shift",
            label: "Shift",
          },
        ];

      case "level1maintenance":
        return [
          {
            key: "date",
            label: "Date",
            render: (report) =>
              formatDate(report.checklistDate),
          },
          {
            key: "lineCode",
            label: "Line Code",
          },
          {
            key: "machineNo",
            label: "Machine No",
          },
          {
            key: "partNo",
            label: "Part No",
          },
          {
            key: "partName",
            label: "Part Name",
          },
        ];

      default:
        return [];
    }
  };

  const columns = getTableColumns(activeTab);

  // ============================================================
  // TAB COLORS
  // ============================================================

  const tabStyles = {
    airgap: {
      active:
        "border-blue-600 text-blue-600 bg-blue-50/50",
      badge: "bg-blue-600",
      button:
        "bg-blue-600 hover:bg-blue-700",
      row: "hover:bg-blue-50/40",
    },

    idletime: {
      active:
        "border-orange-600 text-orange-600 bg-orange-50/50",
      badge: "bg-orange-600",
      button:
        "bg-orange-600 hover:bg-orange-700",
      row: "hover:bg-orange-50/40",
    },

    dailyproduction: {
      active:
        "border-green-600 text-green-600 bg-green-50/50",
      badge: "bg-green-600",
      button:
        "bg-green-600 hover:bg-green-700",
      row: "hover:bg-green-50/40",
    },

    significant: {
      active:
        "border-purple-600 text-purple-600 bg-purple-50/50",
      badge: "bg-purple-600",
      button:
        "bg-purple-600 hover:bg-purple-700",
      row: "hover:bg-purple-50/40",
    },

    operatorallotment: {
      active:
        "border-teal-600 text-teal-600 bg-teal-50/50",
      badge: "bg-teal-600",
      button:
        "bg-teal-600 hover:bg-teal-700",
      row: "hover:bg-teal-50/40",
    },

    eightd: {
      active:
        "border-amber-600 text-amber-600 bg-amber-50/50",
      badge: "bg-amber-600",
      button:
        "bg-amber-600 hover:bg-amber-700",
      row: "hover:bg-amber-50/40",
    },

    level1maintenance: {
      active:
        "border-indigo-600 text-indigo-600 bg-indigo-50/50",
      badge: "bg-indigo-600",
      button:
        "bg-indigo-600 hover:bg-indigo-700",
      row: "hover:bg-indigo-50/40",
    },
  };

  // ============================================================
  // UI
  // ============================================================

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />

      <ToastContainer />

      <div className="p-6">
        {/* =====================================================
            PAGE HEADER
        ===================================================== */}

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-800">
              Product Engineer Verification
            </h1>

            <p className="text-sm text-gray-500 mt-1">
              Review and verify pending production records
            </p>
          </div>

          <button
            onClick={fetchAllReports}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />

            Refresh
          </button>
        </div>

        {/* =====================================================
            TABS
        ===================================================== */}

        <div className="bg-white border-b border-gray-200 rounded-t-xl px-4 pt-2">
          <div className="flex items-center gap-1 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;

              const isActive =
                activeTab === tab.id;

              const style =
                tabStyles[tab.id];

              return (
                <button
                  key={tab.id}
                  onClick={() =>
                    setActiveTab(tab.id)
                  }
                  className={`flex items-center gap-2 py-3 px-5 font-bold text-sm rounded-t-lg transition-all cursor-pointer border-b-2 whitespace-nowrap ${
                    isActive
                      ? style.active
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <Icon className="w-4 h-4" />

                  <span>
                    {tab.title}
                  </span>

                  {tab.reports.length > 0 && (
                    <span
                      className={`${style.badge} text-white text-[11px] font-extrabold px-2 py-0.5 rounded-full`}
                    >
                      {tab.reports.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* =====================================================
            CONTENT
        ===================================================== */}

        <div className="bg-white rounded-b-xl shadow-sm p-5">
          {activeReports.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
              {activeTabData && (
                <activeTabData.icon className="w-12 h-12 mx-auto text-gray-300 mb-2" />
              )}

              <p className="text-gray-500 font-semibold">
                No {activeTabData?.title || "reports"} pending your review.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse border border-gray-300">
                <thead className="bg-gray-800 text-white text-xs uppercase tracking-wider">
                  <tr>
                    {columns.map((column) => (
                      <th
                        key={column.key}
                        className="p-3 border border-gray-300"
                      >
                        {column.label}
                      </th>
                    ))}

                    <th className="p-3 border border-gray-300 text-center">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="text-sm">
                  {activeReports.map(
                    (report, index) => (
                      <tr
                        key={`${activeTab}-${index}`}
                        className={`${
                          tabStyles[activeTab]?.row ||
                          "hover:bg-gray-50"
                        } transition-colors`}
                      >
                        {columns.map((column) => {
                          const value = column.render
                            ? column.render(report)
                            : report[column.key];

                          return (
                            <td
                              key={column.key}
                              className="p-3 border border-gray-300"
                            >
                              {value || "N/A"}
                            </td>
                          );
                        })}

                        <td className="p-3 border border-gray-300 text-center">
                          <button
                            onClick={() =>
                              handleOpenReviewModal(
                                report,
                                activeTab
                              )
                            }
                            className={`${
                              tabStyles[activeTab]
                                ?.button ||
                              "bg-gray-800 hover:bg-gray-900"
                            } text-white px-4 py-1.5 rounded-lg font-bold text-xs shadow transition-colors cursor-pointer`}
                          >
                            Review & Verify
                          </button>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================
          FULL SCREEN PDF REVIEW MODAL
      ======================================================== */}

      {selectedReport && (
        <div className="fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white w-full h-full max-w-[1600px] rounded-xl shadow-2xl overflow-hidden flex flex-col">
            {/* =================================================
                MODAL HEADER
            ================================================= */}

            <div className="h-[58px] min-h-[58px] bg-[#111827] flex items-center justify-between px-6 border-b-2 border-gray-400 shrink-0">
              <h2 className="text-white text-lg font-extrabold tracking-wide uppercase">
                {reviewReportType === "airgap"
                  ? "REVIEW & SIGN AIR GAP CHECKSHEET"
                  : reviewReportType === "dailyproduction"
                  ? "REVIEW & SIGN DAILY PRODUCTION REPORT"
                  : reviewReportType === "significant"
                  ? "REVIEW & SIGN SIGNIFICANT EVENT RECORD"
                  : reviewReportType === "operatorallotment"
                  ? "REVIEW & SIGN OPERATOR ALLOTMENT SHEET"
                  : reviewReportType === "eightd"
                  ? "REVIEW & SIGN 8D PROBLEM SOLVING REPORT"
                  : reviewReportType === "level1maintenance"
                  ? "REVIEW & SIGN LEVEL 1 MAINTENANCE CHECK SHEET"
                  : "REVIEW & SIGN IDLE TIME REPORT"}
              </h2>

              <button
                onClick={closeReviewModal}
                className="text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-8 h-8" />
              </button>
            </div>

            {/* =================================================
                MAIN CONTENT
            ================================================= */}

            <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden bg-gray-100">
              {/* ===============================================
                  LEFT SIDE - PDF PREVIEW
              =============================================== */}

              <div className="flex-1 h-full relative flex items-center justify-center border-r border-gray-300 bg-[#525659]">
                {isPdfLoading ? (
                  <div className="text-center">
                    <Loader className="w-12 h-12 animate-spin mx-auto text-white mb-4" />

                    <p className="text-white font-semibold text-lg">
                      Generating report preview...
                    </p>
                  </div>
                ) : pdfUrl ? (
                  <iframe
                    src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                    title="Report PDF Preview"
                    className="w-full h-full border-none relative z-10"
                  />
                ) : (
                  <div className="text-center">
                    <FileText className="w-14 h-14 mx-auto text-gray-400 mb-3" />

                    <p className="text-gray-400 font-semibold">
                      Unable to load PDF preview.
                    </p>
                  </div>
                )}
              </div>

              {/* ===============================================
                  RIGHT SIDE - REVIEW PANEL
              =============================================== */}

              <div className="w-full lg:w-[400px] min-w-[360px] bg-white flex flex-col shrink-0 overflow-y-auto">
                <div className="flex-1 p-6 flex flex-col">
                  {/* ===========================================
                      INFORMATION CARD
                  =========================================== */}

                  <div className="bg-orange-50 p-5 rounded-xl border border-orange-200 mb-6 text-sm flex flex-col gap-3 shadow-sm text-orange-900">
                    {selectedReport.lineCode && (
                      <p>
                        <span className="font-extrabold">
                          Line Code:
                        </span>{" "}
                        {selectedReport.lineCode}
                      </p>
                    )}

                    {selectedReport.machineNo && (
                      <p>
                        <span className="font-extrabold">
                          Machine No:
                        </span>{" "}
                        {selectedReport.machineNo}
                      </p>
                    )}

                    {selectedReport.customer && (
                      <p>
                        <span className="font-extrabold">
                          Customer:
                        </span>{" "}
                        {selectedReport.customer}
                      </p>
                    )}

                    {(selectedReport.partName ||
                      selectedReport.partNo) && (
                      <p>
                        <span className="font-extrabold">
                          Part Details:
                        </span>{" "}
                        {selectedReport.partName ||
                          "N/A"}

                        {selectedReport.partNo &&
                          ` (${selectedReport.partNo})`}
                      </p>
                    )}

                    <p>
                      <span className="font-extrabold">
                        Date:
                      </span>{" "}
                      {formatDate(
                        selectedReport.reportDate ||
                          selectedReport.checkDate ||
                          selectedReport.recordDate ||
                          selectedReport.checklistDate ||
                          selectedReport.date
                      )}
                    </p>

                    {selectedReport.shift && (
                      <p>
                        <span className="font-extrabold">
                          Shift:
                        </span>{" "}
                        Shift {selectedReport.shift}
                      </p>
                    )}

                    {reviewReportType ===
                      "operatorallotment" &&
                      selectedReport.productEngineer && (
                        <p>
                          <span className="font-extrabold">
                            Assigned PE:
                          </span>{" "}
                          {
                            selectedReport.productEngineer
                          }
                        </p>
                      )}

                    {reviewReportType ===
                      "level1maintenance" && (
                      <p>
                        <span className="font-extrabold">
                          Assigned Product Engineer:
                        </span>{" "}
                        {currentPE}
                      </p>
                    )}

                    {reviewReportType ===
                      "significant" &&
                      selectedReport.event && (
                        <p>
                          <span className="font-extrabold">
                            Event:
                          </span>{" "}
                          {selectedReport.event}
                        </p>
                      )}

                    {reviewReportType !==
                      "significant" &&
                      reviewReportType !==
                        "operatorallotment" &&
                      reviewReportType !== "eightd" && (
                        <p>
                          <span className="font-extrabold">
                            Shift Incharge:
                          </span>{" "}
                          {selectedReport.shiftInchargeName ||
                            selectedReport.shiftInchargeSignature ||
                            "Shift Incharge"}
                        </p>
                      )}
                  </div>

                  {/* ===========================================
                      VERIFICATION MESSAGE
                  =========================================== */}

                  <div className="mb-6 bg-gray-50 border border-gray-200 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 leading-relaxed">
                      Please review the complete report shown
                      on the left before approving this record.
                    </p>
                  </div>

                  <p className="text-xs text-gray-500 leading-5 mb-6">
                    By clicking{" "}
                    <strong>APPROVE REPORT</strong>,
                    you confirm that you have reviewed the
                    report and verified the information
                    provided.
                  </p>

                  {/* ===========================================
                      APPROVE BUTTON
                  =========================================== */}

                  <div className="mt-auto">
                    <button
                      onClick={submitPESignature}
                      disabled={
                        isPdfLoading ||
                        !pdfUrl ||
                        isApproving
                      }
                      className="w-full bg-[#10b981] hover:bg-[#059669] text-white py-4 rounded-xl font-black text-lg uppercase tracking-wider shadow-lg transition-transform hover:-translate-y-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isPdfLoading
                        ? "LOADING..."
                        : isApproving
                        ? "APPROVING..."
                        : "APPROVE REPORT"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductEngineer;