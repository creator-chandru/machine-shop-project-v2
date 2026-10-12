import React, { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { useLineSet } from "../context/LineSetContext";
import { FileDown, Calendar, X } from "lucide-react";
import Header from "../components/Header";

// ============================================================
// API
// ============================================================

const API_BASE = "http://localhost:5000/api";

// ============================================================
// INITIAL FORM DATA
// ============================================================

const initialFormData = {
  formCode: "QF/07/MPD-47",
  revision: "01",
  revisionDate: "01.12.2025",
  title: "LEVEL 1 MAINTENANCE CHECK SHEET",
  company: "SAKTHI AUTO",

  header: {
    lineCode: "",
    partName: "",
    partNo: "",
    machineNo: "",
    opNo: "",
    date: "",
    productEngineer: "",
  },

  parameters: [
    {
      slNo: 1,
      label: "Spindle nose & face cleaning",
      specification: "No dust in spindle Tapper",
      checkMethod: "Cone cleanning tool",
    },
    {
      slNo: 2,
      label: "Drive key tightness",
      specification: "Drive key holding allen bolt should be tight",
      checkMethod: "Allen key",
    },
    {
      slNo: 3,
      label: "Spindle nose cleaning air flow",
      specification: "Air should come from inside spindle",
      checkMethod: "Operate",
    },
    {
      slNo: 4,
      label: "Tool clamp / declamp",
      specification: "Tool clamp / declamp Push button",
      checkMethod: "Operate",
    },
    {
      slNo: 5,
      label: "Index arm plunger Force (Two position)",
      specification: "Hand Pushing",
      checkMethod: "Operate",
    },
    {
      slNo: 6,
      label: "Machine cleaningness",
      specification:
        "i) No loose materials, rags, or debris on around the machine\n" +
        "ii) Dust free, no oil/grease on the floor",
      checkMethod: "Visual",
    },
    {
      slNo: 7,
      label: "Coolant Flow Condition",
      specification: "coolant should flow on cutting area",
      checkMethod: "Visual",
    },
    {
      slNo: 8,
      label: "Safety Parameters",
      specification:
        "i) Check auto door status\n" +
        "ii) Conveyor/motor/spindle motor are fully closed",
      checkMethod: "Visual",
    },
  ],

  notes: [
    "During set-up change/un usual situation the Level 1 Maintenance parameters should be verified.",
    "If found any deviation stop the machine and Inform to Maintenance through Breakdown intimation/Service Report QF/07/MRO-10.",
  ],
};

// ============================================================
// TOAST
// ============================================================

const Toast = ({ message, type, onClose }) => {
  if (!message) return null;

  const bgColor =
    type === "error" ? "bg-red-600" : "bg-green-600";

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 ${bgColor} text-white px-5 py-3 rounded-lg shadow-2xl flex items-center gap-3`}
    >
      <span className="text-sm font-semibold">
        {message}
      </span>

      <button
        onClick={onClose}
        className="ml-2 font-bold text-lg leading-none"
      >
        ×
      </button>
    </div>
  );
};

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function Level1MaintenanceChecksheet() {
  const { shopId } = useParams();

  const { lineSet, setLineSet } = useLineSet();

  const [headerInfo, setHeaderInfo] = useState({
    ...initialFormData.header,
  });

  const [values, setValues] = useState({});
  const [signatures, setSignatures] = useState({});

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [toast, setToast] = useState({
    message: "",
    type: "",
  });

  const lookupSeqRef = useRef(0);

  const currentUser =
    JSON.parse(localStorage.getItem("user") || "{}")
      ?.username || "Unknown";

  // ============================================================
  // PRODUCT ENGINEERS
  // ============================================================

  const [productEngineers, setProductEngineers] = useState([]);
  const [loadingPE, setLoadingPE] = useState(true);

  // ============================================================
  // PDF MODAL
  // ============================================================

  const [showPdfModal, setShowPdfModal] = useState(false);

  const [pdfFromDate, setPdfFromDate] = useState("");
  const [pdfToDate, setPdfToDate] = useState("");

  const [isDownloadingPdf, setIsDownloadingPdf] =
    useState(false);

  // ============================================================
  // MACHINE DETAILS
  // ============================================================

  const [machineDetails, setMachineDetails] = useState([]);
  const [lineMappings, setLineMappings] = useState([]);

  const [loadingMachineDetails, setLoadingMachineDetails] =
    useState(true);

  // ============================================================
  // TOAST FUNCTION
  // ============================================================

  const triggerToast = (message, type = "error") => {
    setToast({ message, type });

    setTimeout(() => {
      setToast({
        message: "",
        type: "",
      });
    }, 4000);
  };

  // ============================================================
  // FETCH PRODUCT ENGINEERS
  // ============================================================

  useEffect(() => {
    const fetchProductEngineers = async () => {
      try {
        setLoadingPE(true);

        const token = localStorage.getItem("token");

        const response = await fetch(
          `${API_BASE}/level1-maintenance-checklist/product-engineers`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error(
            "Failed to fetch Product Engineers"
          );
        }

        const data = await response.json();

        setProductEngineers(
          Array.isArray(data) ? data : []
        );
      } catch (error) {
        console.error(
          "Product Engineer fetch error:",
          error
        );

        triggerToast(
          "Failed to load Product Engineers.",
          "error"
        );
      } finally {
        setLoadingPE(false);
      }
    };

    fetchProductEngineers();
  }, []);

  // ============================================================
  // FETCH MACHINE DETAILS AND LINE MAPPINGS
  // ============================================================

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!shopId) return;

        const token = localStorage.getItem("token");

        const headers = {
          Authorization: `Bearer ${token}`,
        };

        const machineRes = await fetch(
          `${API_BASE}/machine-shop/${shopId}/pre-operation-details`,
          { headers }
        );

        if (machineRes.ok) {
          setMachineDetails(
            await machineRes.json()
          );
        }

        const mappingRes = await fetch(
          `${API_BASE}/mappings/${shopId}/lines`,
          { headers }
        );

        if (mappingRes.ok) {
          setLineMappings(
            await mappingRes.json()
          );
        }
      } catch (error) {
        console.error(
          "Data fetch error:",
          error
        );

        triggerToast(
          "Failed to load required data.",
          "error"
        );
      } finally {
        setLoadingMachineDetails(false);
      }
    };

    fetchData();
  }, [shopId]);

  // ============================================================
  // FETCH EXISTING RECORD
  // ============================================================

  useEffect(() => {
    const checkExistingRecord = async () => {
      if (
        !headerInfo.lineCode ||
        !headerInfo.machineNo ||
        !headerInfo.date
      ) {
        return;
      }

      const seq = ++lookupSeqRef.current;

      try {
        const token = localStorage.getItem("token");

        const params = new URLSearchParams({
          machineShop: shopId || "3",
          lineCode: headerInfo.lineCode,
          machineNo: headerInfo.machineNo,
          date: headerInfo.date,
        });

        const response = await fetch(
          `${API_BASE}/level1-maintenance-checklist/record?${params.toString()}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (seq !== lookupSeqRef.current) return;

        if (response.ok) {
          const record = await response.json();

          if (record && record.values) {
            setValues(record.values || {});

            setSignatures(
              record.signatures || {}
            );

            setHeaderInfo((prev) => ({
              ...prev,
              opNo: record.header?.opNo || "",
              productEngineer:
                record.header?.productEngineer || "",
            }));

            triggerToast(
              "Existing record loaded for this date.",
              "success"
            );
          } else {
            setValues({});
            setSignatures({});

            setHeaderInfo((prev) => ({
              ...prev,
              opNo: "",
              productEngineer: "",
            }));
          }
        }
      } catch (error) {
        console.error(
          "Check existing record error:",
          error
        );
      }
    };

    checkExistingRecord();
  }, [
    shopId,
    headerInfo.lineCode,
    headerInfo.machineNo,
    headerInfo.date,
  ]);

  // ============================================================
  // LINE SET
  // ============================================================

  useEffect(() => {
    setHeaderInfo((prev) => ({
      ...prev,
      lineCode: lineSet?.lineCode || "",
      partName: lineSet?.partName || "",
      partNo: lineSet?.partNo || "",
      machineNo: lineSet?.machineNo || "",
    }));
  }, [lineSet]);

  // ============================================================
  // LINE CODES
  // ============================================================

  const lineCodes =
    lineMappings.length > 0
      ? [
          ...new Set(
            lineMappings
              .map((m) => m.lineCode)
              .filter(Boolean)
          ),
        ]
      : [
          ...new Set(
            machineDetails
              .map((item) => item.lineCode)
              .filter(Boolean)
          ),
        ];

  // ============================================================
  // MACHINE OPTIONS
  // ============================================================

  const machineOptionsRaw = machineDetails.filter(
    (item) =>
      item.lineCode === headerInfo.lineCode
  );

  const machineOptions = Array.from(
    new Set(
      machineOptionsRaw.map((m) => m.machineNo)
    )
  ).map((machineNo) =>
    machineOptionsRaw.find(
      (m) => m.machineNo === machineNo
    )
  );

  // ============================================================
  // HEADER CHANGE
  // ============================================================

  const handleHeaderChange = (field, value) => {
    setHeaderInfo((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // ============================================================
  // LINE CHANGE
  // ============================================================

  const handleLineChange = (lineCode) => {
    const mapping = lineMappings.find(
      (m) => m.lineCode === lineCode
    );

    setValues({});
    setSignatures({});

    setHeaderInfo((prev) => ({
      ...prev,
      opNo: "",
      productEngineer: "",
    }));

    setLineSet({
      machineShop: shopId,
      lineCode,
      partName: mapping?.partSet || "",
      partNo: mapping?.idSet || "",
      machineNo: "",
    });
  };

  // ============================================================
  // MACHINE CHANGE
  // ============================================================

  const handleMachineChange = (machineNo) => {
    setValues({});
    setSignatures({});

    setHeaderInfo((prev) => ({
      ...prev,
      opNo: "",
      productEngineer: "",
    }));

    setLineSet({
      machineShop: shopId,
      lineCode: headerInfo.lineCode,
      partName: headerInfo.partName,
      partNo: headerInfo.partNo,
      machineNo,
    });
  };

  // ============================================================
  // VALUE CHANGE
  // ============================================================

  const handleValueChange = (slNo, value) => {
    setValues((prev) => ({
      ...prev,
      [slNo]: value,
    }));
  };

  // ============================================================
  // SHIFT INCHARGE APPROVAL
  // ============================================================

  const handleApproveShiftIncharge = () => {
    if (
      !headerInfo.lineCode ||
      !headerInfo.machineNo ||
      !headerInfo.date
    ) {
      triggerToast(
        "Please select Line Code, Machine No, and Date first.",
        "error"
      );

      return;
    }

    if (!headerInfo.productEngineer) {
      triggerToast(
        "Please select a Product Engineer before approval.",
        "error"
      );

      return;
    }

    setSignatures((prev) => ({
      ...prev,
      "Shift Incharge": currentUser,
    }));

    triggerToast(
      "Shift Incharge signature approved",
      "success"
    );
  };

  // ============================================================
  // DOWNLOAD PDF
  // ============================================================

  const handleDownloadPdfRange = async () => {
    if (!pdfFromDate || !pdfToDate) {
      triggerToast(
        "Please select both From Date and To Date.",
        "error"
      );

      return;
    }

    if (pdfFromDate > pdfToDate) {
      triggerToast(
        "From Date cannot be later than To Date.",
        "error"
      );

      return;
    }

    setIsDownloadingPdf(true);

    try {
      const token = localStorage.getItem("token");

      const params = new URLSearchParams({
        fromDate: pdfFromDate,
        toDate: pdfToDate,
        shopId: String(shopId || 3),
      });

      const response = await fetch(
        `${API_BASE}/level1-maintenance-checklist/report?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const contentType =
          response.headers.get("content-type") || "";

        let errorMessage =
          "Failed to download PDF report.";

        if (
          contentType.includes("application/json")
        ) {
          const errorData = await response.json();

          errorMessage =
            errorData.error ||
            errorData.message ||
            errorMessage;
        } else {
          const errorText = await response.text();

          if (errorText) {
            errorMessage = errorText;
          }
        }

        throw new Error(errorMessage);
      }

      const blob = await response.blob();

      const blobUrl =
        URL.createObjectURL(blob);

      const link = document.createElement("a");

      link.href = blobUrl;

      link.download =
        `Level1_Maintenance_Report_${pdfFromDate}_to_${pdfToDate}.pdf`;

      document.body.appendChild(link);

      link.click();

      document.body.removeChild(link);

      setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
      }, 1000);

      setShowPdfModal(false);

      triggerToast(
        "PDF generated successfully!",
        "success"
      );
    } catch (error) {
      triggerToast(
        error.message || "Failed to generate PDF",
        "error"
      );
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  // ============================================================
  // SAVE CHECKLIST
  // ============================================================

  const handleSave = async () => {
    if (
      !headerInfo.lineCode ||
      !headerInfo.machineNo ||
      !headerInfo.date
    ) {
      triggerToast(
        "Please select Line Code, Machine No, and Date.",
        "error"
      );

      return;
    }

    if (!headerInfo.productEngineer) {
      triggerToast(
        "Please select the Product Engineer.",
        "error"
      );

      return;
    }

    if (!signatures["Shift Incharge"]) {
      triggerToast(
        "Please approve the Shift Incharge signature before saving.",
        "error"
      );

      return;
    }

    setIsSaving(true);

    try {
      const token = localStorage.getItem("token");

      const payload = {
        header: {
          ...headerInfo,
          machineShop: shopId,
          lineCode: headerInfo.lineCode,
          partName: headerInfo.partName,
          partNo: headerInfo.partNo,
          machineNo: headerInfo.machineNo,
          productEngineer:
            headerInfo.productEngineer,
        },

        values,

        signatures: {
          "Shift Incharge":
            signatures["Shift Incharge"],
        },

        parameters: initialFormData.parameters,
      };

      const response = await fetch(
        `${API_BASE}/level1-maintenance-checklist`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },

          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({}));

        throw new Error(
          errorData.error ||
            errorData.message ||
            "Save failed"
        );
      }

      setSaveSuccess(true);

      setTimeout(() => {
        setSaveSuccess(false);
      }, 2000);

      setSignatures((prev) => ({
        ...prev,
        PE: `Pending [${headerInfo.productEngineer}]`,
      }));

      triggerToast(
        `Checklist saved successfully! Sent to ${headerInfo.productEngineer} for verification.`,
        "success"
      );
    } catch (error) {
      triggerToast(
        error.message ||
          "Failed to save checklist.",
        "error"
      );
    } finally {
      setIsSaving(false);
    }
  };

  // ============================================================
  // UI
  // ============================================================

  return (
    <div className="min-h-screen bg-[#2d2d2d] flex flex-col items-center justify-center p-6 pb-20">
      <Header />

      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() =>
          setToast({
            message: "",
            type: "",
          })
        }
      />

      {/* =====================================================
          PDF MODAL
      ===================================================== */}

      {showPdfModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md border-2 border-gray-100">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-orange-500" />

                <h3 className="text-lg font-bold text-gray-800 uppercase">
                  Download PDF by Date Range
                </h3>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowPdfModal(false)
                }
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="font-bold text-gray-700 block mb-1 text-xs uppercase">
                  From Date
                </label>

                <input
                  type="date"
                  className="w-full border p-2 rounded text-sm bg-white"
                  value={pdfFromDate}
                  onChange={(e) =>
                    setPdfFromDate(e.target.value)
                  }
                />
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1 text-xs uppercase">
                  To Date
                </label>

                <input
                  type="date"
                  className="w-full border p-2 rounded text-sm bg-white"
                  value={pdfToDate}
                  onChange={(e) =>
                    setPdfToDate(e.target.value)
                  }
                />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() =>
                  setShowPdfModal(false)
                }
                className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleDownloadPdfRange}
                disabled={isDownloadingPdf}
                className="flex items-center gap-2 bg-gray-800 hover:bg-gray-900 text-white px-5 py-2 rounded font-bold text-xs uppercase"
              >
                <FileDown className="w-4 h-4" />

                {isDownloadingPdf
                  ? "Downloading..."
                  : "Download PDF"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          MAIN FORM
      ===================================================== */}

      <div className="bg-white w-full max-w-[90rem] rounded-xl p-8 shadow-2xl overflow-x-auto border-4 border-gray-100">
        {/* HEADER AREA */}

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 border-b border-gray-200 pb-4 gap-4">
          <div>
            <span className="text-xs font-bold text-orange-600 tracking-wider uppercase block mb-1">
              {initialFormData.company}
            </span>

            <h2 className="text-2xl font-bold text-gray-800 uppercase tracking-wide">
              {initialFormData.title}
            </h2>

            <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-2">
              <span>
                Form Code: {initialFormData.formCode}
              </span>

              |

              <span>
                Rev: {initialFormData.revision}
              </span>

              |

              <span>
                Date: {initialFormData.revisionDate}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              setShowPdfModal(true)
            }
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider shadow cursor-pointer"
          >
            <FileDown className="w-4 h-4" />

            Download PDF
          </button>
        </div>

        {/* =====================================================
            CONTROLS
        ===================================================== */}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
          {/* LINE CODE */}

          <div>
            <label className="font-bold text-gray-700 block mb-1 text-sm">
              Line Code
            </label>

            <select
              className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm font-semibold bg-white"
              value={headerInfo.lineCode}
              onChange={(e) =>
                handleLineChange(e.target.value)
              }
              disabled={loadingMachineDetails}
            >
              <option value="">
                {loadingMachineDetails
                  ? "Loading..."
                  : "Select Line Code"}
              </option>

              {lineCodes.map((line) => (
                <option
                  key={line}
                  value={line}
                >
                  {line}
                </option>
              ))}
            </select>
          </div>

          {/* PART NO */}

          <div>
            <label className="font-bold text-gray-700 block mb-1 text-sm">
              Part No (Auto)
            </label>

            <input
              type="text"
              readOnly
              className="w-full border p-2 rounded text-sm bg-gray-100 font-semibold"
              value={headerInfo.partNo || ""}
            />
          </div>

          {/* PART NAME */}

          <div>
            <label className="font-bold text-gray-700 block mb-1 text-sm">
              Part Name (Auto)
            </label>

            <input
              type="text"
              readOnly
              className="w-full border p-2 rounded text-sm bg-gray-100 font-semibold"
              value={headerInfo.partName || ""}
            />
          </div>

          {/* MACHINE NO */}

          <div>
            <label className="font-bold text-gray-700 block mb-1 text-sm">
              Machine No
            </label>

            <select
              className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm font-semibold bg-white"
              value={headerInfo.machineNo}
              onChange={(e) =>
                handleMachineChange(e.target.value)
              }
              disabled={!headerInfo.lineCode}
            >
              <option value="">
                Select Machine
              </option>

              {machineOptions.map(
                (machine, index) => (
                  <option
                    key={index}
                    value={machine.machineNo}
                  >
                    {machine.machineNo}
                  </option>
                )
              )}
            </select>
          </div>

          {/* OP NO */}

          <div>
            <label className="font-bold text-gray-700 block mb-1 text-sm">
              OP No
            </label>

            <select
              className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm font-semibold bg-white"
              value={headerInfo.opNo}
              onChange={(e) =>
                handleHeaderChange(
                  "opNo",
                  e.target.value
                )
              }
            >
              <option value="">
                Select OP
              </option>

              <option value="20">20</option>
              <option value="30">30</option>
              <option value="40">40</option>
              <option value="50">50</option>
            </select>
          </div>

          {/* DATE */}

          <div>
            <label className="font-bold text-gray-700 block mb-1 text-sm">
              Date
            </label>

            <input
              type="date"
              className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm font-semibold bg-white"
              value={headerInfo.date}
              onChange={(e) =>
                handleHeaderChange(
                  "date",
                  e.target.value
                )
              }
            />
          </div>


        </div>

        {/* =====================================================
            CHECKLIST TABLE
        ===================================================== */}

        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-800 text-sm text-center">
            <thead className="bg-gray-100 text-gray-800 font-bold">
              <tr>
                <th className="border border-gray-800 p-2 w-16">
                  Sl No
                </th>

                <th className="border border-gray-800 p-2 text-left px-3">
                  Checking Parameters
                </th>

                <th className="border border-gray-800 p-2 text-left px-3">
                  Specification
                </th>

                <th className="border border-gray-800 p-2 w-48">
                  Check Method
                </th>

                <th className="border border-gray-800 p-2 w-48">
                  Value
                </th>
              </tr>
            </thead>

            <tbody>
              {initialFormData.parameters.map(
                (param) => {
                  const cellValue =
                    values[param.slNo] || "";

                  return (
                    <tr
                      key={`param-${param.slNo}`}
                    >
                      <td className="border border-gray-800 p-2 font-medium">
                        {param.slNo}
                      </td>

                      <td className="border border-gray-800 p-2 text-left px-3 font-medium">
                        {param.label}
                      </td>

                      <td className="border border-gray-800 p-2 text-left px-3 text-gray-700 whitespace-pre-line">
                        {param.specification}
                      </td>

                      <td className="border border-gray-800 p-2 text-gray-700">
                        {param.checkMethod}
                      </td>

                      <td className="border border-gray-800 p-0">
                        <select
                          className="w-full h-full text-center outline-none bg-transparent py-2.5 cursor-pointer font-bold"
                          value={cellValue}
                          onChange={(e) =>
                            handleValueChange(
                              param.slNo,
                              e.target.value
                            )
                          }
                        >
                          <option value=""></option>

                          <option value="OK">
                            OK
                          </option>

                          <option value="NOT OK">
                            NOT OK
                          </option>
                        </select>
                      </td>
                    </tr>
                  );
                }
              )}

              {/* SHIFT INCHARGE SIGNATURE */}
              <tr>
                <td
                  colSpan={4}
                  className="border border-gray-800 p-2 text-left px-3 font-bold bg-gray-50 text-gray-700"
                >
                  Shift Incharge Signature (Submit to Product Engineer)
                </td>
                <td className="border border-gray-800 p-2 align-middle text-center bg-gray-50/30">
                  {signatures["Shift Incharge"] ? (
                    <span className="text-xs font-bold text-green-600">
                      Approved By: {signatures["Shift Incharge"]}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleApproveShiftIncharge}
                      className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-4 py-1.5 rounded shadow cursor-pointer uppercase tracking-wider"
                    >
                      Approve
                    </button>
                  )}
                </td>

              </tr>
              {/* PRODUCT ENGINEER - SEPARATE ROW */}
              <tr>
                <td colSpan={4} className="border border-gray-800 p-2 text-left px-3 font-bold bg-gray-50 text-gray-700">
                  Product Engineer <span className="text-red-500">*</span>
                </td>
                <td className="border border-gray-800 p-2 bg-gray-50/30">
                  <select
                    className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm font-semibold bg-white"
                    value={headerInfo.productEngineer}
                    onChange={(e) =>
                      handleHeaderChange("productEngineer", e.target.value)
                    }
                    disabled={loadingPE || Boolean(signatures.PE?.startsWith("Approved ("))}
                  >
                    <option value="">
                      {loadingPE ? "Loading Product Engineers..." : "Select Product Engineer"}
                    </option>
                    {productEngineers.map((pe) => (
                      <option key={pe.id} value={pe.username}>
                        {pe.username}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* =====================================================
            NOTES
        ===================================================== */}

        <div className="border-2 border-gray-800 flex flex-col mt-4">
          <div className="px-2 py-1 font-bold text-gray-800 text-sm border-b border-gray-800 bg-gray-100">
            Note:
          </div>

          <ol className="list-decimal list-inside p-3 text-xs text-gray-700 space-y-1.5 bg-white">
            {initialFormData.notes.map(
              (note, index) => (
                <li
                  key={`note-${index}`}
                >
                  {note}
                </li>
              )
            )}
          </ol>
        </div>

        {/* =====================================================
            SAVE BUTTON
        ===================================================== */}

        <div className="flex justify-end gap-4 mt-6 pt-4 border-t border-gray-300">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="bg-gray-800 hover:bg-gray-900 disabled:bg-gray-400 text-white px-10 py-3 rounded font-bold transition-colors shadow-lg cursor-pointer uppercase tracking-wider text-sm"
          >
            {isSaving
              ? "SAVING..."
              : "SAVE & SEND TO PE"}
          </button>
        </div>
      </div>
    </div>
  );
}