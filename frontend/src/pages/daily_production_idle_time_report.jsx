import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useLineSet } from "../context/LineSetContext.jsx";
import Header from '../components/Header';

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

  const bgColor = type === 'error' ? 'bg-red-600' : type === 'success' ? 'bg-green-600' : 'bg-orange-600';

  return (
    <div className={`fixed bottom-6 right-6 z-50 ${bgColor} text-white px-5 py-3 rounded-lg shadow-2xl flex items-center gap-3 transition-all transform animate-bounce`}>
      <span className="text-sm font-semibold">{message}</span>
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
  const [partQuantities, setPartQuantities] = useState([]);
  const [reportDate, setReportDate] = useState(getTodayISODate());

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Toast state
  const [toast, setToast] = useState({ message: '', type: '' });

  const triggerToast = (message, type = 'error') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast({ message: '', type: '' });
    }, 4000);
  };

  const [lineColumns, setLineColumns] = useState([
    createEmptyLineColumn(
      lineSet?.lineCode || "",
      lineSet?.partName || ""
    ),
  ]);

  const [signatures, setSignatures] = useState({
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

    teamLeaderSign: "",
  });

  // Fetch machine shop details
  useEffect(() => {
    const fetchMachineShopDetails = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await fetch(
          `${process.env.REACT_APP_API_URL}/api/machine-shop/${shopId}/details`,
          {
            headers: {
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          }
        );

        if (!response.ok) {
          throw new Error("Failed to fetch machine shop details");
        }

        const data = await response.json();
        setMachineShopDetails(data);
      } catch (error) {
        console.error("Error fetching machine shop details:", error);
      }
    };

    if (shopId) {
      fetchMachineShopDetails();
    }
  }, [shopId]);

  // Sync with LineSetContext whenever it changes
  useEffect(() => {
    if (lineSet?.lineCode) {
      setLineColumns((prev) => {
        if (prev.length > 0) {
          const next = [...prev];
          next[0] = {
            ...next[0],
            lineCode: lineSet.lineCode || next[0].lineCode,
            partName: lineSet.partName || next[0].partName,
          };
          return next;
        }
        return prev;
      });
    }
  }, [lineSet]);

  useEffect(() => {
    const fetchPartQuantities = async () => {
      try {
        const token = localStorage.getItem("token");

        const response = await fetch(
          `${process.env.REACT_APP_API_URL}/api/machine-shop/${shopId}/part-quantities`,
          {
            headers: {
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          }
        );

        if (!response.ok) {
          throw new Error("Failed to fetch part quantities");
        }

        setPartQuantities(await response.json());
      } catch (error) {
        console.error("Error fetching part quantities:", error);
        setPartQuantities([]);
      }
    };

    if (shopId) {
      fetchPartQuantities();
    }
  }, [shopId]);

  const getPartCapacity = (partName) => {
    const selectedPart = partQuantities.find(
      (part) =>
        part.partName?.trim().toLowerCase() ===
        partName?.trim().toLowerCase()
    );

    if (!selectedPart) return null;

    return {
      shift1: selectedPart.shift1Quantity ?? 0,
      shift2: selectedPart.shift2Quantity ?? 0,
      shift3: selectedPart.shift3Quantity ?? 0,
    };
  };

  const handleLineMetaChange = (colIdx, field, val) => {
    setLineColumns((prev) => {
      const next = [...prev];

      next[colIdx] = {
        ...next[colIdx],
        [field]: val,
      };

      if (field === "lineCode") {
        next[colIdx].partName = "";
        next[colIdx].capacity = {
          shift1: "",
          shift2: "",
          shift3: "",
        };
      }

      if (field === "partName") {
        const capacity = getPartCapacity(val);

        next[colIdx].capacity = capacity || {
          shift1: "",
          shift2: "",
          shift3: "",
        };
      }

      return next;
    });

    if (colIdx === 0 && setLineSet) {
      if (field === "lineCode") {
        setLineSet((prev) => ({
          ...prev,
          machineShop: shopId || lineSet?.machineShop || "3",
          lineCode: val,
          partName: "",
        }));
      } else if (field === "partName") {
        setLineSet((prev) => ({
          ...prev,
          partName: val,
        }));
      }
    }
  };

  const handleCapacityChange = (colIdx, shift, val) => {
    const newCap = parseFloat(val);

    if (val !== "" && !isNaN(newCap)) {
      const currentLh = parseFloat(
        lineColumns[colIdx]?.actualProd?.lh?.[shift]
      );

      const currentRh = parseFloat(
        lineColumns[colIdx]?.actualProd?.rh?.[shift]
      );

      if (
        (!isNaN(currentLh) && currentLh > newCap) ||
        (!isNaN(currentRh) && currentRh > newCap)
      ) {
        triggerToast(
          `Capacity cannot be less than the already entered Actual Production Quantity for Shift ${
            shift === "shift1"
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

    setLineColumns((prev) => {
      const next = [...prev];

      next[colIdx] = {
        ...next[colIdx],

        capacity: {
          ...next[colIdx].capacity,
          [shift]: val,
        },
      };

      return next;
    });
  };

  const handleActualProdChange = (colIdx, arm, shift, val) => {
    if (val !== "") {
      const capVal = lineColumns[colIdx]?.capacity?.[shift];

      const capNum = parseFloat(capVal);
      const enteredVal = parseFloat(val);

      if (capVal === "" || isNaN(capNum) || capNum <= 0) {
        triggerToast(
          `Please enter the Capacity for Shift ${
            shift === "shift1"
              ? "I"
              : shift === "shift2"
              ? "II"
              : "III"
          } first before entering Actual Production Quantity.`,
          "error"
        );

        return;
      }

      if (!isNaN(enteredVal) && enteredVal > capNum) {
        triggerToast(
          `Actual production quantity (${enteredVal}) cannot exceed the capacity (${capNum}) for Shift ${
            shift === "shift1"
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

    setLineColumns((prev) => {
      const next = [...prev];

      next[colIdx] = {
        ...next[colIdx],

        actualProd: {
          ...next[colIdx].actualProd,

          [arm]: {
            ...next[colIdx].actualProd[arm],
            [shift]: val,
          },
        },
      };

      return next;
    });
  };

  const handleManpowerChange = (colIdx, shift, val) => {
    setLineColumns((prev) => {
      const next = [...prev];

      next[colIdx] = {
        ...next[colIdx],

        manpower: {
          ...next[colIdx].manpower,
          [shift]: val,
        },
      };

      return next;
    });
  };

  const handleLossChange = (colIdx, lossId, shift, val) => {
    setLineColumns((prev) => {
      const next = [...prev];

      next[colIdx] = {
        ...next[colIdx],

        losses: {
          ...next[colIdx].losses,

          [`loss_${lossId}`]: {
            ...next[colIdx].losses[`loss_${lossId}`],
            [shift]: val,
          },
        },
      };

      return next;
    });
  };

  const handleSignatureChange = (field, subField, val) => {
    setSignatures((prev) => {
      if (subField) {
        return {
          ...prev,

          [field]: {
            ...prev[field],
            [subField]: val,
          },
        };
      }

      return {
        ...prev,
        [field]: val,
      };
    });
  };

  const handleAddColumn = () => {
    setLineColumns((prev) => [
      ...prev,
      createEmptyLineColumn(),
    ]);
  };

  const handleRemoveColumn = () => {
    setLineColumns((prev) =>
      prev.length > 1 ? prev.slice(0, -1) : prev
    );
  };

  const CHUNK_SIZE = 5;

  const getColumnChunks = (allCols) => {
    const chunks = [];

    for (let i = 0; i < allCols.length; i += CHUNK_SIZE) {
      const chunk = allCols
        .slice(i, i + CHUNK_SIZE)
        .map((col, localIdx) => ({
          col,
          globalIdx: i + localIdx,
        }));

      chunks.push(chunk);
    }

    return chunks;
  };

  const columnChunks = getColumnChunks(lineColumns);

  const sumValues = (...vals) =>
    vals.reduce(
      (sum, v) => sum + (parseFloat(v) || 0),
      0
    ) || "";

  const calcTotalLoss = (col, shift) => {
    return (
      LOSS_REASONS.reduce((acc, loss) => {
        const val =
          parseFloat(
            col.losses[`loss_${loss.id}`]?.[shift]
          ) || 0;

        return acc + val;
      }, 0) || ""
    );
  };

  const handleSave = async () => {
    for (let i = 0; i < lineColumns.length; i++) {
      const col = lineColumns[i];

      for (const shift of [
        "shift1",
        "shift2",
        "shift3",
      ]) {
        const shiftName =
          shift === "shift1"
            ? "I"
            : shift === "shift2"
            ? "II"
            : "III";

        const cap =
          parseFloat(col.capacity[shift]) || 0;

        const lh =
          parseFloat(
            col.actualProd.lh[shift]
          ) || 0;

        const rh =
          parseFloat(
            col.actualProd.rh[shift]
          ) || 0;

        if (
          lh > 0 &&
          (!col.capacity[shift] || lh > cap)
        ) {
          triggerToast(
            `Line ${i + 1} (Shift ${shiftName}): Actual LH production (${lh}) cannot exceed capacity (${cap})!`,
            "error"
          );

          return;
        }

        if (
          rh > 0 &&
          (!col.capacity[shift] || rh > cap)
        ) {
          triggerToast(
            `Line ${i + 1} (Shift ${shiftName}): Actual RH production (${rh}) cannot exceed capacity (${cap})!`,
            "error"
          );

          return;
        }
      }
    }

    setIsSaving(true);
    setSaveSuccess(false);

    const payload = {
      machineShop: shopId || lineSet?.machineShop || 3,
      date: reportDate,
      lineColumns,
      signatures,
    };

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${process.env.REACT_APP_API_URL}/api/daily-production-idle-time`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        throw new Error("Save failed");
      }

      // Update LineSetContext
      if (setLineSet && lineColumns[0]?.lineCode) {
        setLineSet((prev) => ({
          ...prev,
          machineShop: shopId || lineSet?.machineShop || "3",
          lineCode: lineColumns[0].lineCode,
          partName: lineColumns[0].partName || prev?.partName || "",
        }));
      }

      setIsSaving(false);
      setSaveSuccess(true);

      // Keep success message visible for 2 seconds
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Navigate to Operator home
      navigate(`/operator/${shopId || 3}`);
    } catch (err) {
      console.error("Save error:", err);
      setIsSaving(false);
      triggerToast("Failed to save report. Check console for details.", "error");
    }
  };

  return (
    <div className="min-h-screen bg-[#2d2d2d] flex flex-col items-center justify-center p-4 pt-0 sm:p-6 pb-20">
      <Header />

      {/* Toast Notification */}
      <Toast 
        message={toast.message} 
        type={toast.type} 
        onClose={() => setToast({ message: '', type: '' })} 
      />

      {/* Saving and Success Modals */}
      {(isSaving || saveSuccess) && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl px-10 py-8 text-center">
            {isSaving ? (
              <>
                <div className="w-10 h-10 border-4 border-gray-300 border-t-orange-500 rounded-full animate-spin mx-auto mb-5"></div>
                <h2 className="text-xl font-bold text-gray-800">Saving Data...</h2>
                <p className="text-gray-500 mt-2">Please wait</p>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold text-green-800">Data Saved Successfully</h2>
                <p className="text-gray-500 mt-2">Returning to Operator Menu...</p>
              </>
            )}
          </div>
        </div>
      )}

      <div className="bg-white w-full max-w-[99rem] rounded-xl p-6 sm:p-8 shadow-2xl overflow-x-auto border-4 border-gray-100 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b-2 border-gray-300 pb-5 gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-sm font-extrabold text-orange-600 tracking-widest uppercase bg-orange-50 px-2.5 py-0.5 rounded border border-orange-200">
                SAKTHI AUTO
              </span>

              <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                OUTPUT ONLY
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-gray-900 tracking-tight uppercase leading-tight">
              DAILY PRODUCTION & IDLE TIME REPORT
            </h1>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-gray-50 border-2 border-gray-800 p-2.5 rounded shadow-sm">
            <div className="flex items-center gap-2">
              <label className="text-xs font-black text-gray-800 uppercase tracking-wide">
                DATE :
              </label>

              <input
                type="date"
                className="bg-white border border-gray-300 rounded px-2 py-1 text-xs font-bold text-gray-800 outline-none focus:border-orange-500"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center px-1">
          <div className="flex items-center gap-2"></div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAddColumn}
              className="inline-flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-4 py-1.5 rounded transition-colors shadow hover:cursor-pointer"
            >
              <span className="text-sm font-bold leading-none">+</span>
              Add Line Column
            </button>

            {lineColumns.length > 1 && (
              <button
                type="button"
                onClick={handleRemoveColumn}
                className="inline-flex items-center gap-1 bg-gray-600 hover:bg-gray-700 text-white text-xs font-bold px-3 py-1.5 rounded transition-colors shadow hover:cursor-pointer"
              >
                <span className="text-sm font-bold leading-none">−</span>
                Delete Column
              </button>
            )}
          </div>
        </div>

        <div className="space-y-8">
          {columnChunks.map((chunk, chunkIdx) => (
            <div key={`chunk-${chunkIdx}`} className="space-y-2">
              {columnChunks.length > 1 && (
                <div className="flex items-center gap-2 px-1">
                  <span className="text-xs font-bold text-orange-600 uppercase tracking-wider">
                    Table {chunkIdx + 1}
                  </span>

                  <span className="text-xs text-gray-500 font-semibold">
                    (Production Lines {chunk[0].globalIdx + 1}
                    {chunk.length > 1
                      ? ` to ${chunk[chunk.length - 1].globalIdx + 1}`
                      : ""}
                    )
                  </span>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full border-collapse border-2 border-gray-800 text-xs text-center table-fixed">
                  <thead>
                    <tr>
                      <th
                        colSpan={3}
                        className="border border-gray-800 p-1.5 bg-gray-100 text-left font-bold w-64"
                      >
                        LINE CODE
                      </th>

                      {chunk.map(({ col, globalIdx }) => (
                        <th
                          key={`lc-${globalIdx}`}
                          colSpan={4}
                          className="border border-gray-800 p-0 bg-white"
                        >
                          <select
                            className="w-full h-full text-center font-bold text-gray-800 outline-none bg-transparent py-1.5 focus:bg-orange-50/50 cursor-pointer"
                            value={col.lineCode || ""}
                            onChange={(e) => {
                              handleLineMetaChange(
                                globalIdx,
                                "lineCode",
                                e.target.value
                              );
                            }}
                          >
                            <option value="">Select Line Code</option>

                            {[
                              ...new Set(
                                machineShopDetails
                                  .map((item) => item.lineCode)
                                  .filter(Boolean)
                              ),
                            ].map((lineCode) => (
                              <option key={lineCode} value={lineCode}>
                                {lineCode}
                              </option>
                            ))}
                          </select>
                        </th>
                      ))}
                    </tr>

                    <tr>
                      <th
                        colSpan={3}
                        className="border border-gray-800 p-1.5 bg-gray-100 text-left font-bold"
                      >
                        PART NAME
                      </th>

                      {chunk.map(({ col, globalIdx }) => (
                        <th
                          key={`pn-${globalIdx}`}
                          colSpan={4}
                          className="border border-gray-800 p-0 bg-white"
                        >
                          <select
                            className="w-full h-full text-center font-bold text-gray-800 outline-none bg-transparent py-1.5 focus:bg-orange-50/50 cursor-pointer"
                            value={col.partName || ""}
                            onChange={(e) =>
                              handleLineMetaChange(
                                globalIdx,
                                "partName",
                                e.target.value
                              )
                            }
                            disabled={!col.lineCode}
                          >
                            <option value="">Select Part Name</option>

                            {[
                              ...new Set(
                                machineShopDetails
                                  .filter((item) => item.lineCode === col.lineCode)
                                  .map((item) => item.partName)
                                  .filter(Boolean)
                              ),
                            ].map((partName) => (
                              <option key={partName} value={partName}>
                                {partName}
                              </option>
                            ))}
                          </select>
                        </th>
                      ))}
                    </tr>

                    <tr>
                      <th
                        colSpan={3}
                        className="border border-gray-800 p-1.5 bg-gray-100 text-left font-bold"
                      >
                        ABS / NABS
                      </th>

                      {chunk.map(({ col, globalIdx }) => (
                        <th
                          key={`bt-${globalIdx}`}
                          colSpan={4}
                          className="border border-gray-800 p-0 bg-white"
                        >
                          <select
                            className="w-full h-full text-center font-bold text-gray-800 outline-none bg-transparent py-1.5 focus:bg-orange-50/50 cursor-pointer"
                            value={col.brakeType || ""}
                            onChange={(e) =>
                              handleLineMetaChange(
                                globalIdx,
                                "brakeType",
                                e.target.value
                              )
                            }
                          >
                            <option value="">Select</option>
                            <option value="ABS">ABS</option>
                            <option value="NABS">NABS</option>
                          </select>
                        </th>
                      ))}
                    </tr>

                    <tr className="bg-gray-100 font-bold text-[11px]">
                      <th className="border border-gray-800 p-1 w-10">S.No.</th>

                      <th
                        colSpan={2}
                        className="border border-gray-800 p-1 text-left px-2"
                      >
                        SHIFT
                      </th>

                      {chunk.map(({ globalIdx }) => (
                        <React.Fragment key={`sh-hdr-${globalIdx}`}>
                          <th className="border border-gray-800 p-1 w-14">I</th>
                          <th className="border border-gray-800 p-1 w-14">II</th>
                          <th className="border border-gray-800 p-1 w-14">III</th>
                          <th className="border border-gray-800 p-1 w-16 bg-gray-200">
                            T
                          </th>
                        </React.Fragment>
                      ))}
                    </tr>

                    <tr className="bg-white">
                      <td
                        colSpan={3}
                        className="border border-gray-800 p-1 text-left font-bold bg-gray-50 px-2"
                      >
                        CAPACITY QTY IN SETS
                      </td>

                      {chunk.map(({ col, globalIdx }) => (
                        <React.Fragment key={`cap-${globalIdx}`}>
                          {["shift1", "shift2", "shift3"].map((shift) => (
                            <td key={shift} className="border border-gray-800 p-0">
                              <input
                                type="number"
                                min="0"
                                placeholder="0"
                                className="w-full h-full text-center font-semibold outline-none py-1"
                                value={col.capacity[shift]}
                                readOnly
                              />
                            </td>
                          ))}

                          <td className="border border-gray-800 p-1 font-bold bg-gray-100 text-gray-800">
                            {sumValues(
                              col.capacity.shift1,
                              col.capacity.shift2,
                              col.capacity.shift3
                            )}
                          </td>
                        </React.Fragment>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    <tr>
                      <td
                        rowSpan={2}
                        colSpan={2}
                        className="border border-gray-800 p-1 font-bold text-left bg-gray-50 px-2 align-middle"
                      >
                        ACTUAL PROD QTY
                      </td>

                      <td className="border border-gray-800 p-1 font-bold bg-gray-100 w-10">
                        LH
                      </td>

                      {chunk.map(({ col, globalIdx }) => (
                        <React.Fragment key={`lh-${globalIdx}`}>
                          {["shift1", "shift2", "shift3"].map((shift) => (
                            <td key={shift} className="border border-gray-800 p-0">
                              <input
                                type="number"
                                min="0"
                                max={col.capacity[shift] || undefined}
                                placeholder="0"
                                className="w-full h-full text-center outline-none py-1 font-medium"
                                value={col.actualProd.lh[shift]}
                                onChange={(e) =>
                                  handleActualProdChange(
                                    globalIdx,
                                    "lh",
                                    shift,
                                    e.target.value
                                  )
                                }
                              />
                            </td>
                          ))}

                          <td className="border border-gray-800 p-1 font-bold bg-gray-100">
                            {sumValues(
                              col.actualProd.lh.shift1,
                              col.actualProd.lh.shift2,
                              col.actualProd.lh.shift3
                            )}
                          </td>
                        </React.Fragment>
                      ))}
                    </tr>

                    <tr>
                      <td className="border border-gray-800 p-1 font-bold bg-gray-100 w-10">
                        RH
                      </td>

                      {chunk.map(({ col, globalIdx }) => (
                        <React.Fragment key={`rh-${globalIdx}`}>
                          {["shift1", "shift2", "shift3"].map((shift) => (
                            <td key={shift} className="border border-gray-800 p-0">
                              <input
                                type="number"
                                min="0"
                                max={col.capacity[shift] || undefined}
                                placeholder="0"
                                className="w-full h-full text-center outline-none py-1 font-medium"
                                value={col.actualProd.rh[shift]}
                                onChange={(e) =>
                                  handleActualProdChange(
                                    globalIdx,
                                    "rh",
                                    shift,
                                    e.target.value
                                  )
                                }
                              />
                            </td>
                          ))}

                          <td className="border border-gray-800 p-1 font-bold bg-gray-100">
                            {sumValues(
                              col.actualProd.rh.shift1,
                              col.actualProd.rh.shift2,
                              col.actualProd.rh.shift3
                            )}
                          </td>
                        </React.Fragment>
                      ))}
                    </tr>

                    <tr className="bg-gray-50">
                      <td
                        colSpan={3}
                        className="border border-gray-800 p-1 font-bold text-left px-2"
                      >
                        NO OF MANPOWER (UTILIZED)
                      </td>

                      {chunk.map(({ col, globalIdx }) => (
                        <React.Fragment key={`mp-${globalIdx}`}>
                          {["shift1", "shift2", "shift3"].map((shift) => (
                            <td key={shift} className="border border-gray-800 p-0">
                              <input
                                type="number"
                                min="0"
                                placeholder="0"
                                className="w-full h-full text-center outline-none py-1 font-medium bg-transparent"
                                value={col.manpower[shift]}
                                onChange={(e) =>
                                  handleManpowerChange(
                                    globalIdx,
                                    shift,
                                    e.target.value
                                  )
                                }
                              />
                            </td>
                          ))}

                          <td className="border border-gray-800 p-1 font-bold bg-gray-200">
                            {sumValues(
                              col.manpower.shift1,
                              col.manpower.shift2,
                              col.manpower.shift3
                            )}
                          </td>
                        </React.Fragment>
                      ))}
                    </tr>

                    {LOSS_REASONS.map((loss) => (
                      <tr
                        key={`loss-row-${loss.id}`}
                        className="hover:bg-gray-50/50"
                      >
                        <td className="border border-gray-800 p-1 font-bold text-gray-700">
                          {loss.id}
                        </td>

                        {loss.isFirst && (
                          <td
                            rowSpan={loss.rowSpan}
                            className="border border-gray-800 p-1 font-bold text-gray-800 bg-gray-100 align-middle text-[11px] tracking-wider"
                          >
                            {loss.category}
                          </td>
                        )}

                        <td className="border border-gray-800 p-1 text-left px-2 font-medium text-gray-800">
                          {loss.name}
                        </td>

                        {chunk.map(({ col, globalIdx }) => (
                          <React.Fragment key={`l-${loss.id}-${globalIdx}`}>
                            {["shift1", "shift2", "shift3"].map((shift) => (
                              <td key={shift} className="border border-gray-800 p-0">
                                <input
                                  type="number"
                                  min="0"
                                  className="w-full h-full text-center outline-none py-1 bg-transparent"
                                  value={col.losses[`loss_${loss.id}`]?.[shift]}
                                  onChange={(e) =>
                                    handleLossChange(
                                      globalIdx,
                                      loss.id,
                                      shift,
                                      e.target.value
                                    )
                                  }
                                />
                              </td>
                            ))}

                            <td className="border border-gray-800 p-1 font-bold bg-gray-100 text-gray-800">
                              {sumValues(
                                col.losses[`loss_${loss.id}`]?.shift1,
                                col.losses[`loss_${loss.id}`]?.shift2,
                                col.losses[`loss_${loss.id}`]?.shift3
                              )}
                            </td>
                          </React.Fragment>
                        ))}
                      </tr>
                    ))}

                    <tr className="bg-gray-200 font-extrabold text-gray-900">
                      <td
                        colSpan={3}
                        className="border border-gray-800 p-1.5 text-left px-2"
                      >
                        Total Loss (mins)
                      </td>

                      {chunk.map(({ col, globalIdx }) => (
                        <React.Fragment key={`tot-loss-${globalIdx}`}>
                          <td className="border border-gray-800 p-1">
                            {calcTotalLoss(col, "shift1")}
                          </td>

                          <td className="border border-gray-800 p-1">
                            {calcTotalLoss(col, "shift2")}
                          </td>

                          <td className="border border-gray-800 p-1">
                            {calcTotalLoss(col, "shift3")}
                          </td>

                          <td className="border border-gray-800 p-1 bg-gray-300">
                            {sumValues(
                              calcTotalLoss(col, "shift1"),
                              calcTotalLoss(col, "shift2"),
                              calcTotalLoss(col, "shift3")
                            )}
                          </td>
                        </React.Fragment>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>

        <div className="overflow-x-auto pt-2">
          <table className="w-full border-collapse border-2 border-gray-800 text-xs text-center table-fixed">
            <tbody>
              <tr>
                <td className="border border-gray-800 p-1.5 font-bold bg-gray-100 text-left w-48">
                  SECTION INCHARGE SIGN
                </td>

                {["shift1", "shift2", "shift3"].map((s, idx) => (
                  <td key={`sis-${s}`} className="border border-gray-800 p-0">
                    <div className="flex items-center px-2 py-1">
                      <span className="font-bold text-gray-600 text-[11px] mr-1 whitespace-nowrap">
                        SHIFT-{["I", "II", "III"][idx]}:
                      </span>

                      <input
                        type="text"
                        placeholder="Signature"
                        className="w-full outline-none font-medium bg-transparent text-center"
                        value={signatures.sectionInchargeSign[s]}
                        onChange={(e) =>
                          handleSignatureChange(
                            "sectionInchargeSign",
                            s,
                            e.target.value
                          )
                        }
                      />
                    </div>
                  </td>
                ))}

                <td
                  className="border border-gray-800 p-0 w-80 text-left align-middle"
                  rowSpan={2}
                >
                  <div className="flex items-center px-3 py-2 gap-2">
                    <span className="font-bold text-gray-800 whitespace-nowrap">
                      TEAM LEADER SIGN :
                    </span>

                    <input
                      type="text"
                      placeholder="Signature"
                      className="w-full outline-none font-medium bg-transparent border-b border-gray-300 focus:border-orange-500 py-1"
                      value={signatures.teamLeaderSign}
                      onChange={(e) =>
                        handleSignatureChange(
                          "teamLeaderSign",
                          null,
                          e.target.value
                        )
                      }
                    />
                  </div>
                </td>
              </tr>

              <tr>
                <td className="border border-gray-800 p-1.5 font-bold bg-gray-100 text-left">
                  SHIFT OFFICER SIGN
                </td>

                {["shift1", "shift2", "shift3"].map((s, idx) => (
                  <td key={`sos-${s}`} className="border border-gray-800 p-0">
                    <div className="flex items-center px-2 py-1">
                      <span className="font-bold text-gray-600 text-[11px] mr-1 whitespace-nowrap">
                        SHIFT-{["I", "II", "III"][idx]}:
                      </span>

                      <input
                        type="text"
                        placeholder="Signature"
                        className="w-full outline-none font-medium bg-transparent text-center"
                        value={signatures.shiftOfficerSign[s]}
                        onChange={(e) =>
                          handleSignatureChange(
                            "shiftOfficerSign",
                            s,
                            e.target.value
                          )
                        }
                      />
                    </div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        <div className="border border-gray-800 p-2 bg-yellow-50 text-[11px] font-bold text-gray-800 flex items-center justify-center">
          NOTE : TOOL CHANGE LOSSES TIME ABOVE 20 MINS ONLY MENTION THE LOSS
        </div>

        <div className="flex justify-end gap-4 pt-4 border-t border-gray-300">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || saveSuccess}
            className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white px-10 py-3 rounded font-bold transition-colors shadow-lg hover:cursor-pointer text-sm tracking-wider uppercase"
          >
            {isSaving ? "SAVING..." : saveSuccess ? "SAVED ✓" : "SAVE REPORT"}
          </button>
        </div>
      </div>
    </div>
  );
}