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
  Building2,
  UserCheck,
  CheckCircle2,
  Check
} from "lucide-react";

import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// ============================================================
// API CONFIGURATION
// ============================================================

const API_BASE = process.env.REACT_APP_API_URL 
  ? `${process.env.REACT_APP_API_URL}/api` 
  : "http://localhost:5000/api";

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

  const [pendingAirGapReports, setPendingAirGapReports] = useState([]);
  const [pendingIdleTimeReports, setPendingIdleTimeReports] = useState([]);
  const [pendingDailyProdReports, setPendingDailyProdReports] = useState([]);
  const [pendingSignificantReports, setPendingSignificantReports] = useState([]);
  const [pendingOperatorAllotments, setPendingOperatorAllotments] = useState([]);
  const [pendingEightDReports, setPendingEightDReports] = useState([]);
  const [pendingLevel1Reports, setPendingLevel1Reports] = useState([]);
  const [pendingBreakdownReports, setPendingBreakdownReports] = useState([]);
  const [pendingCorrectiveActionReports, setPendingCorrectiveActionReports] = useState([]);

  // ============================================================
  // PDF REVIEW MODAL STATES
  // ============================================================

  const [selectedReport, setSelectedReport] = useState(null);
  const [reviewReportType, setReviewReportType] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ============================================================
  // CURRENT PRODUCT ENGINEER
  // ============================================================

  let currentUser = {};

  try {
    currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  } catch (error) {
    console.error("Invalid user information:", error);
  }

  const currentPE =
    currentUser.username || currentUser.employeeId || "";

  const currentShop = shopId || 3;

  // Revoke Blob URLs on unmount to prevent browser memory leaks
  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

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
      setPendingAirGapReports(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Air Gap fetch error:", error);
      toast.error("Failed to load Pending Air Gap Reports.");
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
      setPendingIdleTimeReports(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Idle Time fetch error:", error);
      toast.error("Failed to load Pending Idle Time Reports.");
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
        throw new Error("Failed to fetch Daily Production reports");
      }

      const data = await response.json();
      setPendingDailyProdReports(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Daily Production fetch error:", error);
      toast.error("Failed to load Pending Daily Production Reports.");
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
        throw new Error("Failed to fetch Significant Event reports");
      }

      const data = await response.json();
      setPendingSignificantReports(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Significant Event fetch error:", error);
      toast.error("Failed to load Pending Significant Event Reports.");
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
        throw new Error("Failed to fetch Operator Allotment reports");
      }

      const data = await response.json();
      setPendingOperatorAllotments(
        Array.isArray(data.records) ? data.records : []
      );
    } catch (error) {
      console.error("Operator Allotment fetch error:", error);
      toast.error("Failed to load Pending Operator Allotments.");
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
      setPendingEightDReports(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("8D fetch error:", error);
      setPendingEightDReports([]);
      toast.error("Failed to load Pending 8D Reports.");
    }
  };

  // ============================================================
  // FETCH PENDING LEVEL 1 MAINTENANCE REPORTS
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
        throw new Error("Failed to fetch Level 1 Maintenance reports");
      }

      const data = await response.json();
      setPendingLevel1Reports(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Level 1 Maintenance fetch error:", error);
      setPendingLevel1Reports([]);
      toast.error("Failed to load Pending Level 1 Maintenance Reports.");
    }
  };

  // ============================================================
  // FETCH PENDING BREAKDOWN REPORTS
  // ============================================================

  const fetchPendingBreakdownReports = async () => {
    try {
      if (!currentPE) return;
      const response = await fetch(
        `${API_BASE}/breakdown-intimation-report/pe/${encodeURIComponent(
          currentPE
        )}?shopId=${currentShop}`,
        { headers: getAuthHeaders() }
      );
      if (response.ok) {
        const data = await response.json();
        setPendingBreakdownReports(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Breakdown pending fetch error:", err);
      toast.error("Failed to load Pending Breakdown Reports.");
    }
  };

  // FETCH PENDING CORRECTIVE ACTION REGISTER ROWS
  const fetchPendingCorrectiveActionReports = async () => {
    try {
      if (!currentPE) return;
      const response = await fetch(
        `${API_BASE}/corrective-action-register/pe/${encodeURIComponent(currentPE)}?shopId=${currentShop}`,
        { headers: getAuthHeaders() }
      );
      if (!response.ok) throw new Error("Failed to fetch Corrective Action Register rows");
      const data = await response.json();
      setPendingCorrectiveActionReports(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Corrective Action Register fetch error:", error);
      toast.error("Failed to load Pending Corrective Action Register rows.");
    }
  };

  // ============================================================
  // FETCH ALL REPORTS
  // ============================================================

  const fetchAllReports = async () => {
    setIsRefreshing(true);
    await Promise.all([
      fetchPendingAirGapReports(),
      fetchPendingIdleTimeReports(),
      fetchPendingDailyProdReports(),
      fetchPendingSignificantReports(),
      fetchPendingOperatorAllotments(),
      fetchPendingEightDReports(),
      fetchPendingLevel1Reports(),
      fetchPendingBreakdownReports(),
      fetchPendingCorrectiveActionReports()
    ]);
    setTimeout(() => setIsRefreshing(false), 500);
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

      // AIR GAP SENSOR
      if (type === "airgap") {
        const params = new URLSearchParams({
          lineCode: report.lineCode,
          partNo: report.partNo || "",
          date: isoDate,
          shopId: String(report.machineShop || currentShop),
        });

        apiUrl = `${API_BASE}/air-gap-sensor/report?` + params.toString();
      }

      // IDLE TIME
      else if (type === "idletime") {
        const params = new URLSearchParams({
          lineCode: report.lineCode,
          fromDate: isoDate,
          toDate: isoDate,
          date: isoDate,
          shopId: String(report.machineShop || currentShop),
        });

        apiUrl = `${API_BASE}/daily-production-idle-time/report?` + params.toString();
      }

      // SIGNIFICANT EVENT
      else if (type === "significant") {
        const params = new URLSearchParams({
          lineCode: report.lineCode || "",
          partName: report.partName || "",
          date: isoDate,
          event: report.event || "",
          shift: report.shift || "",
        });

        apiUrl = `${API_BASE}/significant-event-report?` + params.toString();
      }

      // OPERATOR ALLOTMENT
      else if (type === "operatorallotment") {
        const params = new URLSearchParams({
          lineCode: report.lineCode,
          date: isoDate,
        });

        apiUrl = `${API_BASE}/operator-allotment/report?` + params.toString();
      }

      // 8D REPORT
      else if (type === "eightd") {
        const params = new URLSearchParams({
          shopId: String(report.machineShop || currentShop),
          date: isoDate,
          shift: report.shift || "1ST",
          partNo: report.partNo || "",
          customer: report.customer || "",
        });

        apiUrl = `${API_BASE}/8d-report/pdf?` + params.toString();
      }

      // LEVEL 1 MAINTENANCE
      else if (type === "level1maintenance") {
        if (!report.lineCode || !report.machineNo || !isoDate) {
          throw new Error(
            "Line Code, Machine No, and Date are required to generate the report."
          );
        }

        const params = new URLSearchParams({
          lineCode: report.lineCode,
          machineNo: report.machineNo,
          date: isoDate,
          shopId: String(report.machineShop || currentShop),
        });

        apiUrl =
          `${API_BASE}/level1-maintenance-checklist/report?` + params.toString();
      }

      // BREAKDOWN INTIMATION REPORT
      else if (type === "breakdown") {
        const params = new URLSearchParams({
          lineCode: report.lineCode || report.lineNo || "",
          date: isoDate,
        });
        apiUrl =
          `${API_BASE}/breakdown-intimation-report/report?` + params.toString();
      }

      // CORRECTIVE ACTION REGISTER
      else if (type === "correctiveaction") {
        const params = new URLSearchParams({
          shopId: String(report.machineShop || currentShop),
          fromDate: isoDate,
          toDate: isoDate,
          partName: report.partName || "",
        });
        apiUrl = `${API_BASE}/corrective-action-register/report?` + params.toString();
      }

      // DAILY PRODUCTION
      else {
        const params = new URLSearchParams({
          lineCode: report.lineCode,
          date: isoDate,
          shopId: String(report.machineShop || currentShop),
        });

        if (report.shift) {
          params.append("shift", report.shift);
        }

        apiUrl =
          `${API_BASE}/daily-production-report/report?` + params.toString();
      }

      // FETCH PDF
      const response = await fetch(apiUrl, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("No data recorded for this specific date.");
        }
        throw new Error("Report request failed");
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      setPdfUrl(objectUrl);
    } catch (error) {
      console.error("PDF preview error:", error);
      toast.error(error.message || "Failed to generate PDF preview.");
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
    if (!selectedReport || !reviewReportType || isApproving) {
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

      // AIR GAP SENSOR
      if (reviewReportType === "airgap") {
        endpoint = `${API_BASE}/air-gap-sensor/pe/sign`;
        payload = {
          lineCode: selectedReport.lineCode,
          partNo: selectedReport.partNo,
          date: isoDate,
          signature: currentPE,
        };
      }

      // IDLE TIME
      else if (reviewReportType === "idletime") {
        endpoint = `${API_BASE}/daily-production-idle-time/pe/sign`;
        payload = {
          lineCode: selectedReport.lineCode,
          date: isoDate,
          machineShop: selectedReport.machineShop || currentShop,
          signature: currentPE,
          peUsername: currentPE,
        };
      }

      // SIGNIFICANT EVENT
      else if (reviewReportType === "significant") {
        endpoint = `${API_BASE}/significant-event-sign`;
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

      // OPERATOR ALLOTMENT
      else if (reviewReportType === "operatorallotment") {
        endpoint = `${API_BASE}/operator-allotment/pe/sign`;
        payload = {
          id: selectedReport.id,
          peSignature: currentPE,
        };
      }

      // 8D REPORT
      else if (reviewReportType === "eightd") {
        endpoint = `${API_BASE}/8d-report/sign-pe`;
        payload = {
          partNo: selectedReport.partNo,
          date: isoDate,
          shift: selectedReport.shift || "1ST",
          signature: currentPE,
          peUsername: currentPE,
        };
      }

      // LEVEL 1 MAINTENANCE
      else if (reviewReportType === "level1maintenance") {
        endpoint = `${API_BASE}/level1-maintenance-checklist/pe/sign`;
        payload = {
          lineCode: selectedReport.lineCode,
          machineNo: selectedReport.machineNo,
          date: isoDate,
          machineShop: selectedReport.machineShop || currentShop,
          signature: currentPE,
        };
      }

      // BREAKDOWN INTIMATION REPORT
      else if (reviewReportType === "breakdown") {
        endpoint = `${API_BASE}/breakdown-intimation-report/sign-pe`;
        payload = {
          id: selectedReport.id,
          lineCode: selectedReport.lineCode || selectedReport.lineNo,
          date: isoDate,
          signature: currentPE,
          peUsername: currentPE,
        };
      }

      // CORRECTIVE ACTION REGISTER
      else if (reviewReportType === "correctiveaction") {
        endpoint = `${API_BASE}/corrective-action-register/sign-pe`;
        payload = { id: selectedReport.id, signature: currentPE, peUsername: currentPE };
      }

      // DAILY PRODUCTION
      else {
        endpoint = `${API_BASE}/daily-production-report/sign-pe`;
        payload = {
          lineCode: selectedReport.lineCode,
          date: isoDate,
          shift: selectedReport.shift || "I",
          signature: currentPE,
          peUsername: currentPE,
        };
      }

      // SEND APPROVAL REQUEST
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || errorData.message || "Approval failed"
        );
      }

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
          : reviewReportType === "breakdown"
          ? "Breakdown Intimation Report verified and approved successfully!"
          : reviewReportType === "correctiveaction"
          ? "Corrective Action Register row verified and approved successfully!"
          : "Daily Production Report verified and approved successfully!";

      toast.success(successMsg, {
        autoClose: 2000,
      });

      setTimeout(() => {
        closeReviewModal();
        fetchAllReports();
      }, 1500);
    } catch (error) {
      console.error("PE approval error:", error);
      toast.error(error.message || "Failed to save PE verification.");
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
    {
      id: "breakdown",
      title: "Breakdown Intimation Reports",
      icon: Activity,
      reports: pendingBreakdownReports,
      color: "rose",
    },
    {
      id: "correctiveaction",
      title: "Corrective Action Register",
      icon: FileText,
      reports: pendingCorrectiveActionReports,
      color: "orange",
    },
  ];

  // ============================================================
  // ACTIVE TAB DATA
  // ============================================================

  const activeTabData = tabs.find((tab) => tab.id === activeTab);
  const activeReports = activeTabData?.reports || [];

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
                report.checkDate || report.reportDate || report.date
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
                report.reportDate || report.recordDate || report.date
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
                report.reportDate || report.recordDate || report.date
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
              formatDate(report.recordDate || report.date),
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
              formatDate(report.recordDate || report.date),
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
                report.reportDate || report.recordDate || report.date
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
            render: (report) => formatDate(report.checklistDate),
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

      case "breakdown":
        return [
          {
            key: "date",
            label: "Date",
            render: (report) => formatDate(report.reportDate || report.date),
          },
          {
            key: "lineCode",
            label: "Line No",
            render: (report) => report.lineCode || report.lineNo || "N/A",
          },
          {
            key: "machineNo",
            label: "Machine No",
          },
          {
            key: "shift",
            label: "Shift",
          },
          {
            key: "shiftInchargeName",
            label: "Shift Incharge",
            render: (report) =>
              report.shiftInchargeName ||
              report.inchargeSignature ||
              "Shift Incharge",
          },
        ];

      case "correctiveaction":
        return [
          { key: "date", label: "Date", render: (report) => formatDate(report.recordDate) },
          { key: "lineCode", label: "Line Code" },
          { key: "partName", label: "Part Name" },
          { key: "problemCategory", label: "Category" },
          { key: "problemDescription", label: "Problem Description" },
        ];

      default:
        return [];
    }
  };

  const columns = getTableColumns(activeTab);

  // ============================================================
  // TAB STYLES
  // ============================================================

  const tabStyles = {
    airgap: {
      active: "bg-blue-600 text-white shadow-md",
      badge: "bg-white text-blue-600",
      button: "bg-blue-600 hover:bg-blue-700 shadow-blue-600/20",
      row: "hover:bg-blue-50/30",
    },
    idletime: {
      active: "bg-orange-500 text-white shadow-md",
      badge: "bg-white text-orange-600",
      button: "bg-orange-500 hover:bg-orange-600 shadow-orange-500/20",
      row: "hover:bg-orange-50/30",
    },
    dailyproduction: {
      active: "bg-emerald-600 text-white shadow-md",
      badge: "bg-white text-emerald-600",
      button: "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20",
      row: "hover:bg-emerald-50/30",
    },
    significant: {
      active: "bg-purple-600 text-white shadow-md",
      badge: "bg-white text-purple-600",
      button: "bg-purple-600 hover:bg-purple-700 shadow-purple-600/20",
      row: "hover:bg-purple-50/30",
    },
    operatorallotment: {
      active: "bg-teal-600 text-white shadow-md",
      badge: "bg-white text-teal-600",
      button: "bg-teal-600 hover:bg-teal-700 shadow-teal-600/20",
      row: "hover:bg-teal-50/30",
    },
    eightd: {
      active: "bg-amber-500 text-white shadow-md",
      badge: "bg-white text-amber-600",
      button: "bg-amber-500 hover:bg-amber-600 shadow-amber-500/20",
      row: "hover:bg-amber-50/30",
    },
    level1maintenance: {
      active: "bg-indigo-600 text-white shadow-md",
      badge: "bg-white text-indigo-600",
      button: "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20",
      row: "hover:bg-indigo-50/30",
    },
    breakdown: {
      active: "bg-rose-600 text-white shadow-md",
      badge: "bg-white text-rose-600",
      button: "bg-rose-600 hover:bg-rose-700 shadow-rose-600/20",
      row: "hover:bg-rose-50/30",
    },
    correctiveaction: {
      active: "bg-orange-600 text-white shadow-md",
      badge: "bg-white text-orange-600",
      button: "bg-orange-600 hover:bg-orange-700 shadow-orange-600/20",
      row: "hover:bg-orange-50/30",
    },
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
                  Product Engineer Verification
                </h1>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase bg-[#ff9100]/15 text-[#ff9100] border border-[#ff9100]/30 shadow-sm">
                  <Building2 className="w-3.5 h-3.5" />
                  Machine Shop - {currentShop}
                </span>
              </div>
              <p className="text-xs text-gray-500 font-medium">
                Review and digitally verify pending operational records, sensor checksheets, maintenance, and 8D reports.
              </p>
            </div>

            <div className="flex items-center gap-3 self-start md:self-auto">
              <div className="flex items-center gap-2.5 bg-white border border-gray-300 px-3.5 py-1.5 rounded-xl shadow-sm text-xs">
                <UserCheck className="w-4 h-4 text-blue-600" />
                <span className="font-semibold text-gray-500">PE:</span>
                <span className="font-extrabold text-gray-800 uppercase">{currentPE || "PE"}</span>
              </div>

              <button
                type="button"
                onClick={fetchAllReports}
                className="p-2.5 bg-white hover:bg-gray-100 text-gray-600 hover:text-blue-600 rounded-xl border border-gray-300 shadow-sm transition-all cursor-pointer group"
                title="Refresh Records"
              >
                <RefreshCw className={`w-4 h-4 transition-transform duration-500 ${isRefreshing ? "animate-spin text-blue-600" : ""}`} />
              </button>
            </div>
          </div>

          {/* Navigation Tab Bar */}
          <div className="px-6 py-4 border-b border-gray-200 bg-white">
            <div className="inline-flex p-1 bg-gray-100 rounded-xl gap-1 border border-gray-200 overflow-x-auto max-w-full">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                const style = tabStyles[tab.id] || {
                  active: "bg-gray-800 text-white",
                  badge: "bg-white text-gray-800",
                };

                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-bold text-xs md:text-sm transition-all cursor-pointer whitespace-nowrap ${
                      isActive
                        ? style.active
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/60"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.title}</span>

                    {tab.reports.length > 0 && (
                      <span
                        className={`${style.badge} text-[11px] font-black px-2 py-0.5 rounded-full ml-0.5`}
                      >
                        {tab.reports.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section Body */}
          <div className="p-6 md:p-8">
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-2">
                <div>
                  <h3 className="text-base font-extrabold text-gray-900 uppercase tracking-wide">
                    {activeTabData?.title || "Pending Records"}
                  </h3>
                  <p className="text-xs text-gray-500">Examine record details before recording official Product Engineer digital approval.</p>
                </div>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                  Total: {activeReports.length}
                </span>
              </div>

              {activeReports.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4 bg-gray-50/70 rounded-2xl border border-dashed border-gray-300 text-center space-y-3">
                  <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <h4 className="text-base font-bold text-gray-800">No {activeTabData?.title} Pending</h4>
                  <p className="text-xs text-gray-500 max-w-sm">All entries for this category have been verified and cleared by Product Engineering.</p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm bg-white">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-900 text-slate-200 text-xs uppercase tracking-wider font-semibold">
                          {columns.map((column) => (
                            <th key={column.key} className="py-3.5 px-4 font-bold">
                              {column.label}
                            </th>
                          ))}
                          <th className="py-3.5 px-4 font-bold text-right pr-6">
                            Action
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-gray-200 text-sm">
                        {activeReports.map((report, index) => (
                          <tr
                            key={`${activeTab}-${index}`}
                            className={`${
                              tabStyles[activeTab]?.row || "hover:bg-gray-50"
                            } transition-colors`}
                          >
                            {columns.map((column) => {
                              const value = column.render
                                ? column.render(report)
                                : report[column.key];

                              return (
                                <td
                                  key={column.key}
                                  className="py-4 px-4 text-gray-800 font-medium text-xs"
                                >
                                  {column.key === "lineCode" ? (
                                    <span className="px-2.5 py-1 rounded-md bg-gray-100 border border-gray-300 font-mono text-xs font-bold text-gray-900">
                                      {value || "N/A"}
                                    </span>
                                  ) : (
                                    value || "N/A"
                                  )}
                                </td>
                              );
                            })}

                            <td className="py-4 px-4 text-right pr-6">
                              <button
                                onClick={() =>
                                  handleOpenReviewModal(report, activeTab)
                                }
                                className={`${
                                  tabStyles[activeTab]?.button ||
                                  "bg-gray-800 hover:bg-gray-900"
                                } inline-flex items-center gap-1.5 active:scale-95 text-white px-4 py-2 rounded-xl font-bold text-xs tracking-wider uppercase shadow-md transition-all cursor-pointer`}
                              >
                                <FileText className="w-3.5 h-3.5" />
                                Review & Verify
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
          </div>
        </div>
      </div>

      {/* ========================================================
          FULL SCREEN PDF REVIEW MODAL (Unified Dark Layout)
      ======================================================== */}

      {selectedReport && (
        <div className="fixed inset-0 z-[8000] bg-slate-950/90 backdrop-blur-md flex flex-col overflow-hidden animate-fade-in">
          <div className="bg-slate-900 text-white px-8 py-4 flex justify-between items-center shrink-0 border-b border-slate-800 shadow-xl z-10">
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-xl bg-blue-500/20 text-blue-400">
                <FileText className="w-5 h-5" />
              </span>
              <div>
                <h3 className="font-extrabold text-lg tracking-wide uppercase text-blue-400 leading-tight">
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
                    : reviewReportType === "breakdown"
                    ? "REVIEW & SIGN BREAKDOWN INTIMATION REPORT"
                    : reviewReportType === "correctiveaction"
                    ? "REVIEW & SIGN CORRECTIVE ACTION REGISTER"
                    : "REVIEW & SIGN IDLE TIME REPORT"}
                </h3>
                <p className="text-xs text-gray-400">Examine PDF report details before recording official Product Engineer sign-off</p>
              </div>
            </div>
            <button
              onClick={closeReviewModal}
              className="text-gray-400 hover:text-white bg-slate-800 hover:bg-slate-700 p-2 rounded-xl transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            {/* Left Side: PDF Preview */}
            <div className="flex-1 h-full bg-[#3d4144] relative flex items-center justify-center">
              {isPdfLoading ? (
                <div className="text-center">
                  <Loader className="w-10 h-10 animate-spin mx-auto text-white mb-3" />
                  <p className="text-white font-semibold text-sm">
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
                  <FileText className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                  <p className="text-gray-400 font-semibold text-sm">
                    Unable to load PDF preview.
                  </p>
                </div>
              )}
            </div>

            {/* Right Side: Metadata Panel */}
            <div className="w-full lg:w-[420px] bg-slate-900 text-gray-100 border-l border-slate-800 flex flex-col shrink-0 shadow-2xl z-10 overflow-y-auto">
              <div className="p-7 flex-1 flex flex-col justify-between">
                <div className="space-y-5">
                  <h4 className="text-xs font-black text-blue-400 tracking-widest uppercase">Report Metadata</h4>

                  <div className="bg-slate-800/80 p-5 rounded-2xl border border-slate-700/80 shadow-inner flex flex-col gap-3 text-sm">
                    {(selectedReport.lineCode || selectedReport.lineNo) && (
                      <div className="flex justify-between items-center border-b border-slate-700/60 pb-2">
                        <span className="text-xs font-bold text-gray-400 uppercase">Line Code</span>
                        <span className="font-mono font-bold text-white bg-slate-700/50 px-2 py-0.5 rounded text-xs">
                          {selectedReport.lineCode || selectedReport.lineNo}
                        </span>
                      </div>
                    )}

                    {selectedReport.machineNo && (
                      <div className="flex justify-between items-center border-b border-slate-700/60 pb-2">
                        <span className="text-xs font-bold text-gray-400 uppercase">Machine No</span>
                        <span className="font-bold text-white">{selectedReport.machineNo}</span>
                      </div>
                    )}

                    {selectedReport.customer && (
                      <div className="flex justify-between items-center border-b border-slate-700/60 pb-2">
                        <span className="text-xs font-bold text-gray-400 uppercase">Customer</span>
                        <span className="font-bold text-white">{selectedReport.customer}</span>
                      </div>
                    )}

                    {(selectedReport.partName || selectedReport.partNo) && (
                      <div className="flex flex-col gap-1 border-b border-slate-700/60 pb-2">
                        <span className="text-xs font-bold text-gray-400 uppercase">Part Details</span>
                        <span className="font-bold text-gray-100 text-xs leading-relaxed">
                          {selectedReport.partName || "N/A"}
                          {selectedReport.partNo && ` (${selectedReport.partNo})`}
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between items-center border-b border-slate-700/60 pb-2">
                      <span className="text-xs font-bold text-gray-400 uppercase">Date</span>
                      <span className="text-gray-300 font-medium">
                        {formatDate(
                          selectedReport.reportDate ||
                            selectedReport.checkDate ||
                            selectedReport.recordDate ||
                            selectedReport.checklistDate ||
                            selectedReport.date
                        )}
                      </span>
                    </div>

                    {selectedReport.shift && (
                      <div className="flex justify-between items-center border-b border-slate-700/60 pb-2">
                        <span className="text-xs font-bold text-gray-400 uppercase">Shift</span>
                        <span className="text-white font-bold">Shift {selectedReport.shift}</span>
                      </div>
                    )}

                    {reviewReportType === "operatorallotment" && selectedReport.productEngineer && (
                      <div className="flex justify-between items-center border-b border-slate-700/60 pb-2">
                        <span className="text-xs font-bold text-gray-400 uppercase">Assigned PE</span>
                        <span className="text-gray-200">{selectedReport.productEngineer}</span>
                      </div>
                    )}

                    {reviewReportType === "correctiveaction" && (
                      <div className="flex justify-between items-center border-b border-slate-700/60 pb-2">
                        <span className="text-xs font-bold text-gray-400 uppercase">Assigned PE</span>
                        <span className="text-gray-200">{selectedReport.productEngineer || currentPE}</span>
                      </div>
                    )}

                    {(reviewReportType === "level1maintenance" || reviewReportType === "breakdown") && (
                      <div className="flex justify-between items-center border-b border-slate-700/60 pb-2">
                        <span className="text-xs font-bold text-gray-400 uppercase">Assigned PE</span>
                        <span className="text-gray-200">{currentPE}</span>
                      </div>
                    )}

                    {reviewReportType === "significant" && selectedReport.event && (
                      <div className="flex flex-col gap-1 border-b border-slate-700/60 pb-2">
                        <span className="text-xs font-bold text-gray-400 uppercase">Event</span>
                        <span className="text-gray-200 text-xs leading-relaxed">{selectedReport.event}</span>
                      </div>
                    )}

                    {reviewReportType !== "significant" &&
                      reviewReportType !== "operatorallotment" &&
                      reviewReportType !== "eightd" && (
                        <div className="flex justify-between items-center pt-1">
                          <span className="text-xs font-bold text-gray-400 uppercase">
                            {reviewReportType === "idletime" ? "Section Incharge" : "Shift Incharge"}
                          </span>
                          <span className="text-gray-300 font-medium">
                            {selectedReport.shiftInchargeName ||
                              selectedReport.shiftInchargeSignature ||
                              (reviewReportType === "idletime" ? "Section Incharge" : "Shift Incharge")}
                          </span>
                        </div>
                      )}
                  </div>
                </div>

                <div className="pt-6">
                  <button
                    onClick={submitPESignature}
                    disabled={isPdfLoading || !pdfUrl || isApproving}
                    className="w-full bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 active:scale-98 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-emerald-900/40 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isPdfLoading ? (
                      <>
                        <Loader className="w-4 h-4 animate-spin" />
                        LOADING...
                      </>
                    ) : isApproving ? (
                      <>
                        <Loader className="w-4 h-4 animate-spin" />
                        APPROVING...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        APPROVE REPORT
                      </>
                    )}
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

export default ProductEngineer;