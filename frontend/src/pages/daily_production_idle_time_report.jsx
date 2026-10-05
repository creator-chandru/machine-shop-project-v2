import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useLineSet } from "../context/LineSetContext.jsx";
import Header from '../components/Header';
import { FileDown } from "lucide-react";

const initialFormData = {
  formCode: "QF/07/MPD-10",
  revision: "00",
  revisionDate: "01.07.2021",
  title: "DAILY PRODUCTION & IDLE TIME REPORT",
  company: "SAKTHI AUTO",
};

const LOSS_REASONS = [
  { id: 1, category: "MAN", name: "Want of Man power", rowSpan: 2, isFirst: true },
  { id: 2, category: "MAN", name: "Efficiency", isFirst: false },
  { id: 3, category: "MACHINE", name: "M/c Breakdown", rowSpan: 2, isFirst: true },
  { id: 4, category: "MACHINE", name: "Preventive maintenance", isFirst: false },
  { id: 5, category: "MATERIAL", name: "Want of load", rowSpan: 3, isFirst: true },
  { id: 6, category: "MATERIAL", name: "Want of cutting tool", isFirst: false },
  { id: 7, category: "MATERIAL", name: "Want of jig & fig", isFirst: false },
  { id: 8, category: "METHOD", name: "Process correction", rowSpan: 2, isFirst: true },
  { id: 9, category: "METHOD", name: "Casting Adjustment", isFirst: false },
  { id: 10, category: "MEASUREMENT", name: "Want of inspection Delay", rowSpan: 1, isFirst: true },
  { id: 11, category: "OTHERS", name: "Tool change", rowSpan: 3, isFirst: true },
  { id: 12, category: "OTHERS", name: "Want of Power", isFirst: false },
  { id: 13, category: "OTHERS", name: "Want of schedule", isFirst: false },
];

const getTodayISODate = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const createEmptyLineColumn = (
  lineCode = "",
  partName = "",
  brakeType = ""
) => ({
  lineCode,
  partName,
  brakeType,

  capacity: {
    shift1: "",
    shift2: "",
    shift3: "",
  },

  actualProd: {
    lh: {
      shift1: "",
      shift2: "",
      shift3: "",
    },
    rh: {
      shift1: "",
      shift2: "",
      shift3: "",
    },
  },

  manpower: {
    shift1: "",
    shift2: "",
    shift3: "",
  },

  losses: LOSS_REASONS.reduce((acc, loss) => {
    acc[`loss_${loss.id}`] = {
      shift1: "",
      shift2: "",
      shift3: "",
    };

    return acc;
  }, {}),
});

// Toast notification component
const Toast = ({ message, type, onClose }) => {
  if (!message) return null;

  const bgColor =
    type === 'error'
      ? 'bg-red-600'
      : type === 'success'
        ? 'bg-green-600'
        : 'bg-orange-600';

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 ${bgColor} text-white px-5 py-3 rounded-lg shadow-2xl flex items-center gap-3 transition-all transform animate-bounce`}
    >
      <span className="text-sm font-semibold">
        {message}
      </span>

      <button
        onClick={onClose}
        className="ml-2 font-bold text-lg leading-none hover:text-gray-200 focus:outline-none"
      >
        ×
      </button>
    </div>
  );
};

export default function DailyProductionIdleTimeReport() {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const { lineSet, setLineSet } = useLineSet();

  const [machineShopDetails, setMachineShopDetails] = useState([]);
  const [lineMappings, setLineMappings] = useState([]);
  const [inchargeUsers, setInchargeUsers] = useState([]);
  const [peUsers, setPeUsers] = useState([]);
  const [reportDate, setReportDate] =
    useState(getTodayISODate());

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [toast, setToast] = useState({
    message: '',
    type: ''
  });

  const currentUser =
    JSON.parse(localStorage.getItem('user'))?.username ||
    'Unknown';

  const triggerToast = (
    message,
    type = 'error'
  ) => {
    setToast({
      message,
      type
    });

    setTimeout(() => {
      setToast({
        message: '',
        type: ''
      });
    }, 4000);
  };

  const [lineColumns, setLineColumns] =
    useState([
      createEmptyLineColumn(
        lineSet?.lineCode || "",
        lineSet?.partName || ""
      ),
    ]);

  const [signatures, setSignatures] =
    useState({
      sectionInchargeSign: {
        shift1: "",
        shift2: "",
        shift3: "",
      },

      shiftOfficerSign: {
        shift1: "",
        shift2: "",
        shift3: "",
      },
    });

  // Fetch machine shop details + line mappings + users
  useEffect(() => {
    const fetchData = async () => {
      try {
        const token =
          localStorage.getItem("token");

        const headers = token
          ? {
            Authorization:
              `Bearer ${token}`
          }
          : {};

        // Fetch Machine Shop Details
        const detailsRes =
          await fetch(
            `${process.env.REACT_APP_API_URL || ""}/api/machine-shop/${shopId}/details`,
            { headers }
          );

        if (detailsRes.ok) {
          const detailsData =
            await detailsRes.json();

          setMachineShopDetails(
            detailsData
          );
        }

        // Fetch Line Mappings
        const mappingRes =
          await fetch(
            `${process.env.REACT_APP_API_URL || ""}/api/mappings/${shopId}/lines`,
            { headers }
          );

        if (mappingRes.ok) {
          const mappingData =
            await mappingRes.json();

          setLineMappings(
            mappingData
          );
        }

        // Fetch Users for Section Incharge & Product Engineer
        const usersRes =
          await fetch(
            `${process.env.REACT_APP_API_URL || ""}/api/daily-production-idle-time/pe/users`,
            { headers }
          );

        if (usersRes.ok) {
          const uData =
            await usersRes.json();

          setInchargeUsers(
            uData.inchargeList ||
            uData.allUsers ||
            []
          );

          setPeUsers(
            uData.peList ||
            uData.allUsers ||
            []
          );
        }

      } catch (error) {
        console.error(
          "Error fetching line & shop details:",
          error
        );
      }
    };

    if (shopId) {
      fetchData();
    }
  }, [shopId]);

  // Fetch saved report data whenever shopId or reportDate changes
  useEffect(() => {
    const fetchSavedReport = async () => {
      if (!shopId || !reportDate) return;

      try {
        const token =
          localStorage.getItem("token");

        const headers = token
          ? {
            Authorization:
              `Bearer ${token}`
          }
          : {};

        const res =
          await fetch(
            `${process.env.REACT_APP_API_URL || ""}/api/daily-production-idle-time?shopId=${shopId}&date=${reportDate}`,
            { headers }
          );

        if (res.ok) {
          const data =
            await res.json();

          if (
            data.exists &&
            Array.isArray(data.lineColumns) &&
            data.lineColumns.length > 0
          ) {
            setLineColumns(
              data.lineColumns
            );

            if (data.signatures) {
              setSignatures({
                sectionInchargeSign:
                  data.signatures
                    .sectionInchargeSign ||
                  {
                    shift1: "",
                    shift2: "",
                    shift3: "",
                  },

                shiftOfficerSign:
                  data.signatures
                    .shiftOfficerSign ||
                  {
                    shift1: "",
                    shift2: "",
                    shift3: "",
                  },
              });
            }
          }
        }

      } catch (err) {
        console.error(
          "Error loading saved idle time report:",
          err
        );
      }
    };

    fetchSavedReport();

  }, [shopId, reportDate]);

  // ============================================================
  // DOWNLOAD PDF
  // ============================================================

  const handleDownloadPdf = async () => {
    if (!reportDate) {
      triggerToast(
        "Please select the report date.",
        "error"
      );
      return;
    }

    if (!shopId && !lineSet?.machineShop) {
      triggerToast(
        "Machine Shop is not available.",
        "error"
      );
      return;
    }

    const validLines =
      lineColumns
        .map(
          (col) => col.lineCode
        )
        .filter(Boolean);

    if (validLines.length === 0) {
      triggerToast(
        "Please select at least one Line Code.",
        "error"
      );
      return;
    }

    try {
      const token =
        localStorage.getItem("token");

      const params =
        new URLSearchParams({
          date: reportDate,
          shopId: String(
            shopId ||
            lineSet?.machineShop ||
            3
          ),
        });

      const res =
        await fetch(
          `${process.env.REACT_APP_API_URL || ""
          }/api/daily-production-idle-time/report?${params.toString()}`,
          {
            method: "GET",

            headers: token
              ? {
                Authorization:
                  `Bearer ${token}`,
              }
              : {},
          }
        );

      if (!res.ok) {
        let message =
          "Report request failed";

        try {
          const errorData =
            await res.json();

          message =
            errorData?.error ||
            errorData?.message ||
            message;

        } catch (e) {
          // Server did not return JSON
        }

        throw new Error(message);
      }

      const contentType =
        res.headers.get(
          "content-type"
        ) || "";

      if (
        !contentType.includes(
          "application/pdf"
        )
      ) {
        throw new Error(
          "Server did not return a PDF file."
        );
      }

      const blob =
        await res.blob();

      if (
        !blob ||
        blob.size === 0
      ) {
        throw new Error(
          "The generated PDF is empty."
        );
      }

      const blobUrl =
        URL.createObjectURL(
          blob
        );

      const link =
        document.createElement(
          "a"
        );

      link.href = blobUrl;

      link.download =
        `Daily_Production_Idle_Time_${reportDate}_MS-${shopId ||
        lineSet?.machineShop ||
        3
        }.pdf`;

      document.body.appendChild(
        link
      );

      link.click();

      document.body.removeChild(
        link
      );

      setTimeout(() => {
        URL.revokeObjectURL(
          blobUrl
        );
      }, 1000);

      triggerToast(
        "PDF generated and downloaded!",
        "success"
      );

    } catch (err) {
      console.error(
        "PDF generation failed:",
        err
      );

      triggerToast(
        err.message ||
        "Failed to generate PDF",
        "error"
      );
    }
  };

  // Helper to extract capacity directly from line mappings
  const getLineCapacity =
    (targetLineCode) => {
      const mapping =
        lineMappings.find(
          (m) =>
            m.lineCode
              ?.trim()
              .toLowerCase() ===
            targetLineCode
              ?.trim()
              .toLowerCase()
        );

      if (!mapping)
        return null;

      return {
        shift1:
          mapping.shift1Quantity ??
          "",

        shift2:
          mapping.shift2Quantity ??
          "",

        shift3:
          mapping.shift3Quantity ??
          "",
      };
    };

  // Sync with LineSetContext whenever it changes or mappings are loaded
  useEffect(() => {
    if (
      lineSet?.lineCode &&
      lineMappings.length > 0
    ) {
      const capacity =
        getLineCapacity(
          lineSet.lineCode
        );

      setLineColumns(
        (prev) => {
          if (
            prev.length > 0 &&
            (
              !prev[0].lineCode ||
              prev[0].lineCode ===
              lineSet.lineCode
            )
          ) {
            const next = [
              ...prev
            ];

            next[0] = {
              ...next[0],

              lineCode:
                lineSet.lineCode ||
                next[0].lineCode,

              partName:
                lineSet.partName ||
                next[0].partName,

              capacity:
                capacity ||
                next[0].capacity,
            };

            return next;
          }

          return prev;
        }
      );
    }
  }, [
    lineSet,
    lineMappings
  ]);

  const lineCodes =
    lineMappings.length > 0
      ? lineMappings.map(
        (m) => m.lineCode
      )
      : [
        ...new Set(
          machineShopDetails
            .map(
              (item) =>
                item.lineCode
            )
            .filter(Boolean)
        )
      ];

  const handleLineMetaChange = (
    colIdx,
    field,
    val
  ) => {
    setLineColumns(
      (prev) => {
        const next = [
          ...prev
        ];

        if (
          field === "lineCode"
        ) {
          const mapping =
            lineMappings.find(
              (m) =>
                m.lineCode ===
                val
            );

          const autoPartName =
            mapping?.partSet ||
            machineShopDetails.find(
              (item) =>
                item.lineCode ===
                val
            )?.partName ||
            "";

          const capacity =
            mapping
              ? {
                shift1:
                  mapping.shift1Quantity ??
                  "",

                shift2:
                  mapping.shift2Quantity ??
                  "",

                shift3:
                  mapping.shift3Quantity ??
                  "",
              }
              : {
                shift1: "",
                shift2: "",
                shift3: "",
              };

          next[colIdx] = {
            ...next[colIdx],

            lineCode: val,

            partName:
              autoPartName,

            capacity:
              capacity,
          };

          if (
            colIdx === 0 &&
            setLineSet
          ) {
            setLineSet(
              (prevLineSet) => ({
                ...prevLineSet,

                machineShop:
                  shopId ||
                  lineSet?.machineShop ||
                  "3",

                lineCode:
                  val,

                partName:
                  autoPartName,

                partNo:
                  mapping?.idSet ||
                  prevLineSet?.partNo ||
                  "",
              })
            );
          }

        } else {
          next[colIdx] = {
            ...next[colIdx],

            [field]: val,
          };
        }

        return next;
      }
    );
  };

  const handleActualProdChange = (
    colIdx,
    arm,
    shift,
    val
  ) => {
    if (val !== "") {
      const capVal =
        lineColumns[colIdx]
          ?.capacity?.[shift];

      const capNum =
        parseFloat(capVal);

      const enteredVal =
        parseFloat(val);

      if (
        capVal === "" ||
        isNaN(capNum) ||
        capNum <= 0
      ) {
        triggerToast(
          `Please enter the Capacity for Shift ${shift === "shift1"
            ? "I"
            : shift === "shift2"
              ? "II"
              : "III"
          } first.`,
          "error"
        );

        return;
      }

      if (
        !isNaN(enteredVal) &&
        enteredVal > capNum
      ) {
        triggerToast(
          `Actual production (${enteredVal}) cannot exceed capacity (${capNum}) for Shift ${shift === "shift1"
            ? "I"
            : shift === "shift2"
              ? "II"
              : "III"
          }!`,
          "error"
        );

        return;
      }
    }

    setLineColumns(
      (prev) => {
        const next = [
          ...prev
        ];

        next[colIdx] = {
          ...next[colIdx],

          actualProd: {
            ...next[colIdx]
              .actualProd,

            [arm]: {
              ...next[colIdx]
                .actualProd[
              arm
              ],

              [shift]: val,
            },
          },
        };

        return next;
      }
    );
  };

  const handleManpowerChange = (
    colIdx,
    shift,
    val
  ) => {
    setLineColumns(
      (prev) => {
        const next = [
          ...prev
        ];

        next[colIdx] = {
          ...next[colIdx],

          manpower: {
            ...next[colIdx]
              .manpower,

            [shift]: val,
          },
        };

        return next;
      }
    );
  };

  const handleLossChange = (
    colIdx,
    lossId,
    shift,
    val
  ) => {
    if (val !== "") {
      const enteredVal =
        parseFloat(val);

      if (
        isNaN(enteredVal) ||
        enteredVal < 0
      ) {
        triggerToast(
          "Loss value cannot be negative!",
          "error"
        );

        return;
      }

      const shiftName =
        shift === "shift1"
          ? "I"
          : shift === "shift2"
            ? "II"
            : "III";

      const capVal =
        lineColumns[colIdx]
          ?.capacity?.[shift];

      const capNum =
        parseFloat(capVal);

      if (
        capVal === "" ||
        isNaN(capNum) ||
        capNum <= 0
      ) {
        triggerToast(
          `Please enter the Capacity for Shift ${shiftName} first before entering Loss values.`,
          "error"
        );

        return;
      }

      if (
        enteredVal > capNum
      ) {
        triggerToast(
          `Loss value (${enteredVal}) cannot exceed capacity (${capNum}) for Shift ${shiftName}!`,
          "error"
        );

        return;
      }

      const otherLossesTotal =
        LOSS_REASONS.reduce(
          (acc, loss) => {
            if (
              loss.id ===
              lossId
            ) {
              return acc;
            }

            const currentVal =
              parseFloat(
                lineColumns[
                  colIdx
                ]?.losses?.[
                `loss_${loss.id}`
                ]?.[shift]
              ) || 0;

            return (
              acc +
              currentVal
            );
          },
          0
        );

      const projectedTotal =
        otherLossesTotal +
        enteredVal;

      if (
        projectedTotal >
        capNum
      ) {
        triggerToast(
          `Total Loss (${projectedTotal}) cannot exceed capacity (${capNum}) for Shift ${shiftName}!`,
          "error"
        );

        return;
      }
    }

    setLineColumns(
      (prev) => {
        const next = [
          ...prev
        ];

        next[colIdx] = {
          ...next[colIdx],

          losses: {
            ...next[colIdx]
              .losses,

            [`loss_${lossId}`]: {
              ...next[colIdx]
                .losses[
              `loss_${lossId}`
              ],

              [shift]: val,
            },
          },
        };

        return next;
      }
    );
  };

  const handleSignatureChange = (
    field,
    subField,
    val
  ) => {
    setSignatures(
      (prev) => ({
        ...prev,

        [field]: {
          ...prev[field],

          [subField]: val,
        },
      })
    );
  };

  const handleShiftOfficerApprove = (
    shift
  ) => {
    handleSignatureChange(
      "shiftOfficerSign",
      shift,
      currentUser
    );

    triggerToast(
      "Form approved by Shift Officer",
      "success"
    );
  };

  const handleAddColumn = () => {
    setLineColumns(
      (prev) => [
        ...prev,
        createEmptyLineColumn(),
      ]
    );
  };

  const handleRemoveColumn = () => {
    setLineColumns(
      (prev) =>
        prev.length > 1
          ? prev.slice(0, -1)
          : prev
    );
  };

  const sumValues = (
    ...vals
  ) =>
    vals.reduce(
      (
        sum,
        v
      ) =>
        sum +
        (parseFloat(v) ||
          0),
      0
    ) || "";

  const calcTotalLoss = (
    col,
    shift
  ) => {
    return (
      LOSS_REASONS.reduce(
        (acc, loss) => {
          const val =
            parseFloat(
              col.losses[
              `loss_${loss.id}`
              ]?.[shift]
            ) || 0;

          return (
            acc + val
          );
        },
        0
      ) || ""
    );
  };

  const handleSave =
    async () => {
      if (
        !lineColumns[0]
          ?.lineCode
      ) {
        triggerToast(
          "Please select Line code.",
          "error"
        );

        return;
      }

      for (
        let i = 0;
        i <
        lineColumns.length;
        i++
      ) {
        const col =
          lineColumns[i];

        for (
          const shift of [
            "shift1",
            "shift2",
            "shift3",
          ]
        ) {
          const shiftName =
            shift ===
              "shift1"
              ? "I"
              : shift ===
                "shift2"
                ? "II"
                : "III";

          const cap =
            parseFloat(
              col.capacity[
              shift
              ]
            ) || 0;

          const lh =
            parseFloat(
              col.actualProd
                .lh[shift]
            ) || 0;

          const rh =
            parseFloat(
              col.actualProd
                .rh[shift]
            ) || 0;

          if (
            lh > 0 &&
            (
              !col.capacity[
              shift
              ] ||
              lh > cap
            )
          ) {
            triggerToast(
              `Line ${i + 1} (Shift ${shiftName}): Actual LH production cannot exceed capacity.`,
              "error"
            );

            return;
          }

          if (
            rh > 0 &&
            (
              !col.capacity[
              shift
              ] ||
              rh > cap
            )
          ) {
            triggerToast(
              `Line ${i + 1} (Shift ${shiftName}): Actual RH production cannot exceed capacity.`,
              "error"
            );

            return;
          }

          const totalLoss =
            parseFloat(
              calcTotalLoss(
                col,
                shift
              )
            ) || 0;

          if (
            totalLoss > 0 &&
            (
              !col.capacity[
              shift
              ] ||
              totalLoss > cap
            )
          ) {
            triggerToast(
              `Line ${i + 1} (Shift ${shiftName}): Total Loss cannot exceed capacity.`,
              "error"
            );

            return;
          }
        }
      }

      const hasSecInchargeSign =
        Object.values(
          signatures
            .sectionInchargeSign
        ).some(Boolean);

      const hasShiftOfficerSign =
        Object.values(
          signatures
            .shiftOfficerSign
        ).some(Boolean);

      if (
        !hasSecInchargeSign &&
        !hasShiftOfficerSign
      ) {
        triggerToast(
          "Please assign a Product Engineer or click 'Approve' to sign before saving.",
          "error"
        );

        return;
      }

      setIsSaving(true);
      setSaveSuccess(false);

      const payload = {
        machineShop:
          shopId ||
          lineSet?.machineShop ||
          3,

        date:
          reportDate,

        lineColumns,

        signatures,
      };

      try {
        const token =
          localStorage.getItem(
            "token"
          );

        const res =
          await fetch(
            `${process.env.REACT_APP_API_URL}/api/daily-production-idle-time`,
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",

                ...(token
                  ? {
                    Authorization:
                      `Bearer ${token}`,
                  }
                  : {}),
              },

              body:
                JSON.stringify(
                  payload
                ),
            }
          );

        if (!res.ok) {
          throw new Error(
            "Save failed"
          );
        }

        if (
          setLineSet &&
          lineColumns[0]
            ?.lineCode
        ) {
          setLineSet(
            (prev) => ({
              ...prev,

              machineShop:
                shopId ||
                lineSet?.machineShop ||
                "3",

              lineCode:
                lineColumns[0]
                  .lineCode,

              partName:
                lineColumns[0]
                  .partName ||
                prev?.partName ||
                "",
            })
          );
        }

        setIsSaving(false);
        setSaveSuccess(true);

        await new Promise(
          (resolve) =>
            setTimeout(
              resolve,
              2000
            )
        );

        navigate(
          `/operator/${shopId || 3
          }`
        );

      } catch (err) {
        console.error(
          "Save error:",
          err
        );

        setIsSaving(false);

        triggerToast(
          "Failed to save report.",
          "error"
        );
      }
    };

  return (
    <div className="min-h-screen bg-[#2d2d2d] flex flex-col items-center justify-center p-6 pb-20">

      <Header />

      <Toast
        message={
          toast.message
        }
        type={
          toast.type
        }
        onClose={() =>
          setToast({
            message: '',
            type: ''
          })
        }
      />

      {/* SAVING MODAL */}
      {(isSaving ||
        saveSuccess) && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">

            <div className="bg-white rounded-xl shadow-2xl px-10 py-8 text-center">

              {isSaving ? (
                <>
                  <div className="w-10 h-10 border-4 border-gray-300 border-t-orange-500 rounded-full animate-spin mx-auto mb-5"></div>

                  <h2 className="text-xl font-bold text-gray-800">
                    Saving Data...
                  </h2>
                </>
              ) : (
                <h2 className="text-xl font-bold text-green-800">
                  Data Saved Successfully
                </h2>
              )}

            </div>
          </div>
        )}

      {/* MAIN CONTAINER */}
      <div className="bg-white w-full max-w-[92rem] rounded-xl p-8 shadow-2xl overflow-x-auto border-4 border-gray-100">

        {/* HEADER AREA */}
        <div className="flex justify-between items-center mb-6 border-b border-gray-200 pb-4">

          <div>

            <span className="text-xs font-bold text-orange-600 tracking-wider uppercase block mb-1">
              {initialFormData.company}
            </span>

            <h2 className="text-2xl font-bold text-gray-800 uppercase tracking-wide">
              {initialFormData.title}
            </h2>

            <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-2">

              <span>
                Form Code:
                {" "}
                {initialFormData.formCode}
              </span>

              |

              <span>
                Revision:
                {" "}
                {initialFormData.revision}
              </span>

              |

              <span>
                Revision Date:
                {" "}
                {initialFormData.revisionDate}
              </span>

            </div>

          </div>

          <button
            type="button"
            onClick={
              handleDownloadPdf
            }
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider shadow transition-colors cursor-pointer"
          >
            <FileDown className="w-4 h-4" />

            Download Report
          </button>

        </div>

        {/* CONTROLS */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">

          <div className="flex items-center gap-4">

            <div>

              <label className="font-bold text-gray-700 block mb-1 text-sm">
                Date
              </label>

              <input
                type="date"
                className="border border-gray-300 p-2 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm font-semibold bg-white"
                value={
                  reportDate
                }
                onChange={(e) =>
                  setReportDate(
                    e.target.value
                  )
                }
              />

            </div>

          </div>

          <div className="flex items-center gap-2">

            <button
              type="button"
              onClick={
                handleAddColumn
              }
              className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-4 py-2 rounded shadow transition-all uppercase tracking-wider"
            >
              + Add Column
            </button>

            {lineColumns.length >
              1 && (
                <button
                  type="button"
                  onClick={
                    handleRemoveColumn
                  }
                  className="bg-gray-700 hover:bg-gray-800 text-white text-xs font-bold px-3 py-2 rounded shadow transition-all uppercase"
                >
                  − Remove Column
                </button>
              )}

          </div>

        </div>

        {/* TABLE */}
        <div className="overflow-x-auto">

          <table className="w-full border-collapse border border-gray-800 text-sm text-center">

            <thead className="bg-gray-100 text-gray-800 font-bold">

              {/* LINE CODE ROW */}
              <tr>

                <th
                  colSpan={3}
                  className="border border-gray-800 p-2 text-left px-3 w-[420px] min-w-[420px]"
                >
                  Line Code
                </th>

                {lineColumns.map(
                  (
                    col,
                    globalIdx
                  ) => (
                    <th
                      key={`lc-${globalIdx}`}
                      colSpan={4}
                      className="border border-gray-800 p-0 bg-white min-w-[340px]"
                    >

                      <select
                        className="w-full h-full text-center outline-none bg-transparent py-2 font-bold cursor-pointer"
                        value={
                          col.lineCode ||
                          ""
                        }
                        onChange={(
                          e
                        ) =>
                          handleLineMetaChange(
                            globalIdx,
                            "lineCode",
                            e.target.value
                          )
                        }
                      >

                        <option value="">
                          Select Line Code
                        </option>

                        {lineCodes.map(
                          (
                            lineCode
                          ) => (
                            <option
                              key={
                                lineCode
                              }
                              value={
                                lineCode
                              }
                            >
                              {
                                lineCode
                              }
                            </option>
                          )
                        )}

                      </select>

                    </th>
                  )
                )}

              </tr>

              {/* PART NAME ROW */}
              <tr>

                <th
                  colSpan={3}
                  className="border border-gray-800 p-2 text-left px-3"
                >
                  Part Name
                </th>

                {lineColumns.map(
                  (
                    col,
                    globalIdx
                  ) => (
                    <th
                      key={`pn-${globalIdx}`}
                      colSpan={4}
                      className="border border-gray-800 p-0 bg-gray-50"
                    >

                      <input
                        type="text"
                        readOnly
                        className="w-full h-full text-center outline-none bg-transparent py-2 font-semibold text-gray-700"
                        value={
                          col.partName ||
                          ""
                        }
                        placeholder="Auto-filled"
                      />

                    </th>
                  )
                )}

              </tr>

              {/* ABS / NABS ROW */}
              <tr>

                <th
                  colSpan={3}
                  className="border border-gray-800 p-2 text-left px-3"
                >
                  ABS / NABS
                </th>

                {lineColumns.map(
                  (
                    col,
                    globalIdx
                  ) => (
                    <th
                      key={`bt-${globalIdx}`}
                      colSpan={4}
                      className="border border-gray-800 p-0 bg-white"
                    >

                      <select
                        className="w-full h-full text-center outline-none bg-transparent py-2 font-semibold cursor-pointer"
                        value={
                          col.brakeType ||
                          ""
                        }
                        onChange={(
                          e
                        ) =>
                          handleLineMetaChange(
                            globalIdx,
                            "brakeType",
                            e.target.value
                          )
                        }
                      >

                        <option value="">
                          Select
                        </option>

                        <option value="ABS">
                          ABS
                        </option>

                        <option value="NABS">
                          NABS
                        </option>

                      </select>

                    </th>
                  )
                )}

              </tr>

              {/* SHIFT HEADERS */}
              <tr>

                <th className="border border-gray-800 p-2 w-14">
                  Sl No
                </th>

                <th className="border border-gray-800 p-2 w-32">
                  Category
                </th>

                <th className="border border-gray-800 p-2 text-left px-3 w-72">
                  Parameters / Loss Description
                </th>

                {lineColumns.map(
                  (_, globalIdx) => (
                    <React.Fragment
                      key={`sh-${globalIdx}`}
                    >

                      <th className="border border-gray-800 p-2 w-24">
                        Shift I
                      </th>

                      <th className="border border-gray-800 p-2 w-24">
                        Shift II
                      </th>

                      <th className="border border-gray-800 p-2 w-24">
                        Shift III
                      </th>

                      <th className="border border-gray-800 p-2 w-24 bg-gray-200">
                        Total (T)
                      </th>

                    </React.Fragment>
                  )
                )}

              </tr>

              {/* CAPACITY QTY ROW */}
              <tr className="bg-white">

                <td
                  colSpan={3}
                  className="border border-gray-800 p-2 text-left px-3 font-bold bg-gray-50 text-gray-800"
                >
                  CAPACITY QTY IN SETS
                </td>

                {lineColumns.map(
                  (
                    col,
                    globalIdx
                  ) => (
                    <React.Fragment
                      key={`cap-${globalIdx}`}
                    >

                      {[
                        "shift1",
                        "shift2",
                        "shift3",
                      ].map(
                        (
                          shift
                        ) => (
                          <td
                            key={
                              shift
                            }
                            className="border border-gray-800 p-0"
                          >

                            <input
                              type="number"
                              className="w-full h-full text-center outline-none bg-transparent py-2 font-semibold"
                              value={
                                col
                                  .capacity[
                                shift
                                ]
                              }
                              readOnly
                              placeholder="0"
                            />

                          </td>
                        )
                      )}

                      <td className="border border-gray-800 p-2 font-bold bg-gray-100 text-gray-800">

                        {sumValues(
                          col
                            .capacity
                            .shift1,

                          col
                            .capacity
                            .shift2,

                          col
                            .capacity
                            .shift3
                        )}

                      </td>

                    </React.Fragment>
                  )
                )}

              </tr>

            </thead>

            <tbody>

              {/* ACTUAL PROD QTY: LH */}
              <tr>

                <td
                  rowSpan={2}
                  colSpan={2}
                  className="border border-gray-800 p-2 text-left px-3 font-bold bg-gray-50 align-middle"
                >
                  ACTUAL PROD QTY
                </td>

                <td className="border border-gray-800 p-2 text-left px-3 font-medium bg-gray-50">
                  LH
                </td>

                {lineColumns.map(
                  (
                    col,
                    globalIdx
                  ) => (
                    <React.Fragment
                      key={`lh-${globalIdx}`}
                    >

                      {[
                        "shift1",
                        "shift2",
                        "shift3",
                      ].map(
                        (
                          shift
                        ) => (
                          <td
                            key={
                              shift
                            }
                            className="border border-gray-800 p-0"
                          >

                            <input
                              type="number"
                              min="0"
                              max={
                                col
                                  .capacity[
                                shift
                                ] ||
                                undefined
                              }
                              className="w-full h-full text-center outline-none bg-transparent py-2 font-semibold"
                              value={
                                col
                                  .actualProd
                                  .lh[
                                shift
                                ]
                              }
                              onChange={(
                                e
                              ) =>
                                handleActualProdChange(
                                  globalIdx,
                                  "lh",
                                  shift,
                                  e.target
                                    .value
                                )
                              }
                            />

                          </td>
                        )
                      )}

                      <td className="border border-gray-800 p-2 font-bold bg-gray-100">

                        {sumValues(
                          col
                            .actualProd
                            .lh
                            .shift1,

                          col
                            .actualProd
                            .lh
                            .shift2,

                          col
                            .actualProd
                            .lh
                            .shift3
                        )}

                      </td>

                    </React.Fragment>
                  )
                )}

              </tr>

              {/* ACTUAL PROD QTY: RH */}
              <tr>

                <td className="border border-gray-800 p-2 text-left px-3 font-medium bg-gray-50">
                  RH
                </td>

                {lineColumns.map(
                  (
                    col,
                    globalIdx
                  ) => (
                    <React.Fragment
                      key={`rh-${globalIdx}`}
                    >

                      {[
                        "shift1",
                        "shift2",
                        "shift3",
                      ].map(
                        (
                          shift
                        ) => (
                          <td
                            key={
                              shift
                            }
                            className="border border-gray-800 p-0"
                          >

                            <input
                              type="number"
                              min="0"
                              max={
                                col
                                  .capacity[
                                shift
                                ] ||
                                undefined
                              }
                              className="w-full h-full text-center outline-none bg-transparent py-2 font-semibold"
                              value={
                                col
                                  .actualProd
                                  .rh[
                                shift
                                ]
                              }
                              onChange={(
                                e
                              ) =>
                                handleActualProdChange(
                                  globalIdx,
                                  "rh",
                                  shift,
                                  e.target
                                    .value
                                )
                              }
                            />

                          </td>
                        )
                      )}

                      <td className="border border-gray-800 p-2 font-bold bg-gray-100">

                        {sumValues(
                          col
                            .actualProd
                            .rh
                            .shift1,

                          col
                            .actualProd
                            .rh
                            .shift2,

                          col
                            .actualProd
                            .rh
                            .shift3
                        )}

                      </td>

                    </React.Fragment>
                  )
                )}

              </tr>

              {/* NO OF MANPOWER */}
              <tr>

                <td
                  colSpan={3}
                  className="border border-gray-800 p-2 text-left px-3 font-bold bg-gray-50"
                >
                  NO OF MANPOWER (UTILIZED)
                </td>

                {lineColumns.map(
                  (
                    col,
                    globalIdx
                  ) => (
                    <React.Fragment
                      key={`mp-${globalIdx}`}
                    >

                      {[
                        "shift1",
                        "shift2",
                        "shift3",
                      ].map(
                        (
                          shift
                        ) => (
                          <td
                            key={
                              shift
                            }
                            className="border border-gray-800 p-0"
                          >

                            <input
                              type="number"
                              min="0"
                              className="w-full h-full text-center outline-none bg-transparent py-2 font-semibold"
                              value={
                                col
                                  .manpower[
                                shift
                                ]
                              }
                              onChange={(
                                e
                              ) =>
                                handleManpowerChange(
                                  globalIdx,
                                  shift,
                                  e.target
                                    .value
                                )
                              }
                            />

                          </td>
                        )
                      )}

                      <td className="border border-gray-800 p-2 font-bold bg-gray-100">

                        {sumValues(
                          col
                            .manpower
                            .shift1,

                          col
                            .manpower
                            .shift2,

                          col
                            .manpower
                            .shift3
                        )}

                      </td>

                    </React.Fragment>
                  )
                )}

              </tr>

              {/* LOSS REASONS */}
              {LOSS_REASONS.map(
                (loss) => (
                  <tr
                    key={`loss-row-${loss.id}`}
                  >

                    <td className="border border-gray-800 p-2 font-medium">
                      {loss.id}
                    </td>

                    {loss.isFirst && (
                      <td
                        rowSpan={
                          loss.rowSpan
                        }
                        className="border border-gray-800 p-2 font-bold bg-gray-100 text-gray-800 align-middle"
                      >
                        {
                          loss.category
                        }
                      </td>
                    )}

                    <td className="border border-gray-800 p-2 text-left px-3 text-gray-900 font-medium">
                      {loss.name}
                    </td>

                    {lineColumns.map(
                      (
                        col,
                        globalIdx
                      ) => (
                        <React.Fragment
                          key={`l-${loss.id}-${globalIdx}`}
                        >

                          {[
                            "shift1",
                            "shift2",
                            "shift3",
                          ].map(
                            (
                              shift
                            ) => (
                              <td
                                key={
                                  shift
                                }
                                className="border border-gray-800 p-0"
                              >

                                <input
                                  type="number"
                                  min="0"
                                  className="w-full h-full text-center outline-none bg-transparent py-2 font-semibold"
                                  value={
                                    col
                                      .losses[
                                    `loss_${loss.id}`
                                    ]?.[
                                    shift
                                    ]
                                  }
                                  onChange={(
                                    e
                                  ) =>
                                    handleLossChange(
                                      globalIdx,
                                      loss.id,
                                      shift,
                                      e.target
                                        .value
                                    )
                                  }
                                />

                              </td>
                            )
                          )}

                          <td className="border border-gray-800 p-2 font-bold bg-gray-100">

                            {sumValues(
                              col
                                .losses[
                                `loss_${loss.id}`
                              ]?.shift1,

                              col
                                .losses[
                                `loss_${loss.id}`
                              ]?.shift2,

                              col
                                .losses[
                                `loss_${loss.id}`
                              ]?.shift3
                            )}

                          </td>

                        </React.Fragment>
                      )
                    )}

                  </tr>
                )
              )}

              {/* TOTAL LOSS ROW */}
              <tr className="font-bold bg-gray-100 text-gray-900">

                <td
                  colSpan={3}
                  className="border border-gray-800 p-2 text-left px-3"
                >
                  Total Loss (mins)
                </td>

                {lineColumns.map(
                  (
                    col,
                    globalIdx
                  ) => (
                    <React.Fragment
                      key={`tot-loss-${globalIdx}`}
                    >

                      <td className="border border-gray-800 p-2">
                        {
                          calcTotalLoss(
                            col,
                            "shift1"
                          ) || 0
                        }
                      </td>

                      <td className="border border-gray-800 p-2">
                        {
                          calcTotalLoss(
                            col,
                            "shift2"
                          ) || 0
                        }
                      </td>

                      <td className="border border-gray-800 p-2">
                        {
                          calcTotalLoss(
                            col,
                            "shift3"
                          ) || 0
                        }
                      </td>

                      <td className="border border-gray-800 p-2 bg-gray-200 font-extrabold">

                        {sumValues(
                          calcTotalLoss(
                            col,
                            "shift1"
                          ),

                          calcTotalLoss(
                            col,
                            "shift2"
                          ),

                          calcTotalLoss(
                            col,
                            "shift3"
                          )
                        ) || 0}

                      </td>

                    </React.Fragment>
                  )
                )}

              </tr>

              {/* SECTION INCHARGE SIGNATURE */}
              <tr>

                <td
                  colSpan={3}
                  className="border border-gray-800 p-2 text-left px-3 font-bold bg-gray-50 text-gray-700"
                >
                  Section Incharge Signature (Send to PE)
                </td>

                {[
                  "shift1",
                  "shift2",
                  "shift3",
                ].map(
                  (
                    s,
                    idx
                  ) => {

                    const peSign =
                      signatures
                        .sectionInchargeSign[
                      s
                      ] || "";

                    const isApproved =
                      peSign.startsWith(
                        "Approved ("
                      );

                    return (
                      <td
                        key={`sis-${s}`}
                        colSpan={Math.max(
                          1,
                          Math.floor(
                            (lineColumns.length *
                              4) /
                            3
                          )
                        )}
                        className="border border-gray-800 p-0 h-10 bg-gray-50/40"
                      >

                        <div className="flex items-center justify-between px-2 py-1">

                          <span className="font-bold text-gray-600 text-xs whitespace-nowrap mr-2">

                            Shift{" "}
                            {[
                              "I",
                              "II",
                              "III",
                            ][idx]}
                            :

                          </span>

                          {isApproved ? (
                            <div className="flex flex-col items-center justify-center py-1">

                              <span className="text-[10px] font-bold text-green-600 mb-0.5">
                                Approved By PE ✓
                              </span>

                              <span className="text-xs font-black uppercase text-gray-800">
                                {peSign
                                  .replace(
                                    "Approved (",
                                    ""
                                  )
                                  .replace(
                                    ")",
                                    ""
                                  )}
                              </span>

                            </div>
                          ) : (
                            <select
                              className="w-full h-full text-center px-1 outline-none bg-transparent font-medium cursor-pointer text-xs"
                              value={
                                peSign.startsWith(
                                  "Pending ["
                                )
                                  ? peSign
                                    .replace(
                                      "Pending [",
                                      ""
                                    )
                                    .replace(
                                      "]",
                                      ""
                                    )
                                  : peSign
                              }
                              onChange={(
                                e
                              ) =>
                                handleSignatureChange(
                                  "sectionInchargeSign",
                                  s,
                                  e.target
                                    .value
                                )
                              }
                            >

                              <option value="">
                                -- Send to Product Engineer --
                              </option>

                              {peUsers.map(
                                (
                                  pe,
                                  pIdx
                                ) => {

                                  const uname =
                                    pe.username ||
                                    pe.employeeId ||
                                    pe.name;

                                  return (
                                    <option
                                      key={
                                        pIdx
                                      }
                                      value={
                                        uname
                                      }
                                    >
                                      {uname.toUpperCase()}
                                    </option>
                                  );
                                }
                              )}

                            </select>
                          )}

                        </div>

                      </td>
                    );
                  }
                )}

              </tr>

              {/* SHIFT OFFICER SIGNATURE */}
              <tr>

                <td
                  colSpan={3}
                  className="border border-gray-800 p-2 text-left px-3 font-bold bg-gray-50 text-gray-700"
                >
                  Shift Officer Signature
                </td>

                {[
                  "shift1",
                  "shift2",
                  "shift3",
                ].map(
                  (
                    s,
                    idx
                  ) => {

                    const signVal =
                      signatures
                        .shiftOfficerSign[
                      s
                      ] || "";

                    return (
                      <td
                        key={`sos-${s}`}
                        colSpan={Math.max(
                          1,
                          Math.floor(
                            (lineColumns.length *
                              4) /
                            3
                          )
                        )}
                        className="border border-gray-800 p-2 align-middle text-center bg-gray-50/30"
                      >

                        <div className="flex items-center justify-between px-2">

                          <span className="font-bold text-gray-600 text-xs whitespace-nowrap mr-2">

                            Shift{" "}
                            {[
                              "I",
                              "II",
                              "III",
                            ][idx]}
                            :

                          </span>

                          {signVal ? (
                            <div className="flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300">

                              <span className="text-xs font-bold text-green-600 mb-0.5">
                                Approved By ✓
                              </span>

                              <span className="text-sm font-black text-gray-900 uppercase">
                                {signVal
                                  .replace(
                                    "Pending [",
                                    ""
                                  )
                                  .replace(
                                    "]",
                                    ""
                                  )
                                  .replace(
                                    "Approved (",
                                    ""
                                  )
                                  .replace(
                                    ")",
                                    ""
                                  )}
                              </span>

                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                handleShiftOfficerApprove(
                                  s
                                )
                              }
                              className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-4 py-1.5 rounded shadow transition-all hover:scale-105 uppercase tracking-widest cursor-pointer"
                            >
                              Approve
                            </button>
                          )}

                        </div>

                      </td>
                    );
                  }
                )}

              </tr>

            </tbody>

          </table>

        </div>

        {/* NOTES & INSTRUCTIONS */}
        <div className="border-2 border-gray-800 flex flex-col mt-4">

          <div className="px-2 py-1 font-bold text-gray-800 text-sm border-b border-gray-800 bg-gray-100">
            Notes / Instructions:
          </div>

          <ol className="list-decimal list-inside p-3 text-xs text-gray-700 space-y-1.5 leading-relaxed bg-white">

            <li>
              TOOL CHANGE LOSSES TIME ABOVE 20 MINS ONLY MENTION THE LOSS.
            </li>

            <li>
              During set-up change, the production and idle time parameters should be verified and recorded.
            </li>

          </ol>

        </div>

        {/* SAVE BUTTON */}
        <div className="flex justify-end gap-4 mt-6 pt-4 border-t border-gray-300">

          <button
            type="button"
            onClick={
              handleSave
            }
            disabled={
              isSaving ||
              saveSuccess
            }
            className="bg-gray-800 hover:bg-gray-900 disabled:bg-gray-400 text-white px-10 py-3 rounded font-bold transition-colors shadow-lg hover:cursor-pointer uppercase tracking-wider text-sm"
          >
            {isSaving
              ? "SAVING..."
              : saveSuccess
                ? "SAVED ✓"
                : "SAVE & CONTINUE"}
          </button>

        </div>

      </div>

    </div>
  );
}