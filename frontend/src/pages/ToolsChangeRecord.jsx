import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useLineSet } from "../context/LineSetContext.jsx";
import { ArrowLeft } from "lucide-react";
import Header from "../components/Header";

const CHUNK_SIZE = 3;
const INITIAL_SECTIONS = 1;
const INITIAL_ROWS = 1;

const formMeta = {
  formCode: "QF/07/MPD-32",
  revision: "02",
  revisionDate: "10.01.2023",
  title: "TOOL CHANGE RECORD",
  company: "SAKTHI AUTO",
  applicableEvents:
    "New cutting tool (Tool holder, Drill, Reamer, Tap, Milling cutters, Milling inserts, Spot facing cutter etc,.), Tool change after tool regrinding / tool repair.",
};

const getTodayISODate = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const createEmptySection = (
  defaultMachineNo = "",
  defaultDate = "",
  numRows = INITIAL_ROWS
) => ({
  partTraceability: "",
  toolDescription: "",
  mcNo: defaultMachineNo,
  opNo: "",
  date: defaultDate || getTodayISODate(),
  shift: "I",
  from: "",
  to: "",
  rows: Array.from({ length: numRows }, () => ({
    controlSpec: "",
    before: "",
    after: "",
  })),
  toolChangedBy: {
    signature: "",
  },
  verifiedByQc: {
    signature: "",
  },
});

// Toast notification component
const Toast = ({ message, type, onClose }) => {
  if (!message) return null;

  const bgColor =
    type === "error"
      ? "bg-red-600"
      : type === "success"
      ? "bg-green-600"
      : "bg-orange-600";

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 ${bgColor} text-white px-5 py-3 rounded-lg shadow-2xl flex items-center gap-3 transition-all transform animate-bounce`}
    >
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

export default function ToolChangeRecord() {
  const { shopId } = useParams();
  const navigate = useNavigate();

  const { lineSet, setLineSet } = useLineSet();

  const [headerInfo, setHeaderInfo] = useState({
    lineCode: "",
    partName: "",
    partNo: "",
    machineNo: "",
    opNo: "",
    date: getTodayISODate(),
  });

  const [machineDetails, setMachineDetails] = useState([]);
  const [loadingMachineDetails, setLoadingMachineDetails] =
    useState(true);

  const [sections, setSections] = useState(
    Array.from({ length: INITIAL_SECTIONS }, () =>
      createEmptySection("", getTodayISODate(), INITIAL_ROWS)
    )
  );

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Toast state
  const [toast, setToast] = useState({
    message: "",
    type: "",
  });

  const triggerToast = (message, type = "error") => {
    setToast({ message, type });

    setTimeout(() => {
      setToast({
        message: "",
        type: "",
      });
    }, 4000);
  };

  // Fetch Part Traceability from backend
  const fetchPartTraceability = async (
    lineCode,
    date,
    shift,
    secIdx
  ) => {
    if (!lineCode || !date || !shift) {
      return;
    }

    try {
      const token = localStorage.getItem("token");

      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/tool-change-record/traceability?lineCode=${encodeURIComponent(
          lineCode
        )}&date=${encodeURIComponent(
          date
        )}&shift=${encodeURIComponent(shift)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch Part Traceability");
      }

      const data = await response.json();

      setSections((prev) =>
        prev.map((sec, idx) =>
          idx === secIdx
            ? {
                ...sec,
                partTraceability: data.partTraceability || "",
              }
            : sec
        )
      );
    } catch (err) {
      console.error("Part Traceability fetch error:", err);
    }
  };

  // Sync with LineSetContext whenever it changes
  useEffect(() => {
    if (lineSet) {
      const newLineCode =
        lineSet.lineCode || headerInfo.lineCode;

      setHeaderInfo((prev) => ({
        ...prev,
        lineCode: lineSet.lineCode || prev.lineCode,
        partName: lineSet.partName || prev.partName,
        partNo: lineSet.partNo || prev.partNo,
        machineNo: lineSet.machineNo || prev.machineNo,
      }));

      if (lineSet.machineNo) {
        setSections((prev) => {
          if (prev.length > 0 && !prev[0].mcNo) {
            const next = [...prev];

            next[0] = {
              ...next[0],
              mcNo: lineSet.machineNo,
            };

            return next;
          }

          return prev;
        });
      }

      if (newLineCode) {
        sections.forEach((sec, idx) => {
          fetchPartTraceability(
            newLineCode,
            sec.date || headerInfo.date,
            sec.shift,
            idx
          );
        });
      }
    }
  }, [lineSet]);

  // Fetch machine details for Machine Shop 3
  useEffect(() => {
    const fetchMachineDetails = async () => {
      try {
        if (shopId !== "3") {
          setMachineDetails([]);
          return;
        }

        const token = localStorage.getItem("token");

        const res = await fetch(
          `${process.env.REACT_APP_API_URL}/api/machine-shop/3/pre-operation-details`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!res.ok) {
          throw new Error(
            "Failed to fetch Machine Shop 3 details"
          );
        }

        const data = await res.json();

        setMachineDetails(data);
      } catch (err) {
        console.error(
          "Machine details fetch error:",
          err
        );
      } finally {
        setLoadingMachineDetails(false);
      }
    };

    fetchMachineDetails();
  }, [shopId]);

  // Line Code options
  const lineCodes = [
    ...new Set(
      machineDetails
        .map((item) => item.lineCode)
        .filter(Boolean)
    ),
  ];

  // Details belonging to selected Line Code
  const selectedLineDetails = machineDetails.filter(
    (item) =>
      item.lineCode === headerInfo.lineCode
  );

  // Part No options based on selected Line Code
  const partOptions = [
    ...new Map(
      selectedLineDetails
        .filter((item) => item.partNo)
        .map((item) => [item.partNo, item])
    ).values(),
  ];

  /*
   * MACHINE NUMBER OPTIONS
   *
   * Machine numbers are now fetched based ONLY on
   * the selected Line Code.
   *
   * Part No is not required for selecting M/C No.
   */
  const machineOptions = [
    ...new Map(
      machineDetails
        .filter(
          (item) =>
            item.lineCode === headerInfo.lineCode &&
            item.machineNo
        )
        .map((item) => [
          item.machineNo,
          item,
        ])
    ).values(),
  ];

  const handleHeaderChange = (field, val) => {
    setHeaderInfo((prev) => ({
      ...prev,
      [field]: val,
    }));
  };

  // Header date change handler
  const handleDateChange = (newDate) => {
    setHeaderInfo((prev) => ({
      ...prev,
      date: newDate,
    }));

    setSections((prev) =>
      prev.map((sec) => ({
        ...sec,
        date: newDate,
      }))
    );

    if (headerInfo.lineCode) {
      sections.forEach((sec, idx) => {
        fetchPartTraceability(
          headerInfo.lineCode,
          newDate,
          sec.shift,
          idx
        );
      });
    }
  };

  // Line Code change handler
  const handleLineChange = (lineCode) => {
    setHeaderInfo((prev) => ({
      ...prev,
      lineCode,
      partNo: "",
      partName: "",
      machineNo: "",
    }));

    // Clear M/C No from all table sections
    setSections((prev) =>
      prev.map((sec) => ({
        ...sec,
        mcNo: "",
      }))
    );

    setLineSet({
      machineShop: shopId || "3",
      lineCode,
      partName: "",
      partNo: "",
      machineNo: "",
    });

    sections.forEach((sec, idx) => {
      fetchPartTraceability(
        lineCode,
        sec.date || headerInfo.date,
        sec.shift,
        idx
      );
    });
  };

  const handlePartNoChange = (partNo) => {
    const selectedPart = machineDetails.find(
      (item) =>
        item.lineCode === headerInfo.lineCode &&
        item.partNo === partNo
    );

    const partName =
      selectedPart?.partName || "";

    setHeaderInfo((prev) => ({
      ...prev,
      partNo,
      partName,
      machineNo: "",
    }));

    setLineSet({
      machineShop: shopId || "3",
      lineCode: headerInfo.lineCode,
      partName,
      partNo,
      machineNo: "",
    });
  };

  const handleMachineChange = (machineNo) => {
    setHeaderInfo((prev) => ({
      ...prev,
      machineNo,
    }));

    setLineSet({
      machineShop: shopId || "3",
      lineCode: headerInfo.lineCode,
      partName: headerInfo.partName,
      partNo: headerInfo.partNo,
      machineNo,
    });

    setSections((prev) => {
      const next = [...prev];

      if (next.length > 0) {
        next[0] = {
          ...next[0],
          mcNo: machineNo,
        };
      }

      return next;
    });
  };

  // Add a new section / column
  const handleAddColumn = () => {
    const currentNumRows =
      sections[0]?.rows?.length || INITIAL_ROWS;

    const defaultDate =
      headerInfo.date || getTodayISODate();

    const defaultShift = "I";
    const newIdx = sections.length;

    setSections((prev) => [
      ...prev,
      createEmptySection(
        headerInfo.machineNo,
        defaultDate,
        currentNumRows
      ),
    ]);

    if (headerInfo.lineCode) {
      fetchPartTraceability(
        headerInfo.lineCode,
        defaultDate,
        defaultShift,
        newIdx
      );
    }
  };

  // Delete the last section / column
  const handleRemoveColumn = () => {
    setSections((prev) =>
      prev.length > 1
        ? prev.slice(0, -1)
        : prev
    );
  };

  const handleSectionMetaChange = (
    secIdx,
    field,
    val
  ) => {
    setSections((prev) =>
      prev.map((sec, idx) =>
        idx === secIdx
          ? {
              ...sec,
              [field]: val,
            }
          : sec
      )
    );

    // Keep header machine number in sync with
    // the first table M/C NO
    if (field === "mcNo" && secIdx === 0) {
      setHeaderInfo((prev) => ({
        ...prev,
        machineNo: val,
      }));

      setLineSet({
        machineShop: shopId || "3",
        lineCode: headerInfo.lineCode,
        partName: headerInfo.partName,
        partNo: headerInfo.partNo,
        machineNo: val,
      });
    }

    if (field === "date" || field === "shift") {
      const currentSection =
        sections[secIdx];

      const date =
        field === "date"
          ? val
          : currentSection?.date ||
            headerInfo.date;

      const shift =
        field === "shift"
          ? val
          : currentSection?.shift || "I";

      fetchPartTraceability(
        headerInfo.lineCode,
        date,
        shift,
        secIdx
      );
    }
  };

  const handleCellChange = (
    secIdx,
    rowIdx,
    field,
    val
  ) => {
    setSections((prev) => {
      const next = [...prev];
      const updatedRows = [
        ...next[secIdx].rows,
      ];

      updatedRows[rowIdx] = {
        ...updatedRows[rowIdx],
        [field]: val,
      };

      next[secIdx] = {
        ...next[secIdx],
        rows: updatedRows,
      };

      return next;
    });
  };

  const handleSignatureChange = (
    secIdx,
    sigType,
    field,
    val
  ) => {
    setSections((prev) => {
      const next = [...prev];

      next[secIdx] = {
        ...next[secIdx],
        [sigType]: {
          ...next[secIdx][sigType],
          [field]: val,
        },
      };

      return next;
    });
  };

  // Add a new row to all sections
  const handleAddRow = () => {
    setSections((prev) =>
      prev.map((sec) => ({
        ...sec,
        rows: [
          ...sec.rows,
          {
            controlSpec: "",
            before: "",
            after: "",
          },
        ],
      }))
    );
  };

  // Delete the last row
  const handleRemoveRow = () => {
    setSections((prev) => {
      if (prev[0]?.rows?.length <= 1) {
        return prev;
      }

      return prev.map((sec) => ({
        ...sec,
        rows: sec.rows.slice(0, -1),
      }));
    });
  };

  const handleSave = async () => {
    if (!headerInfo.lineCode) {
      triggerToast(
        "Please select or enter a Line Code.",
        "error"
      );
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);

    const payload = {
      header: {
        machineShop: parseInt(
          shopId ||
            lineSet?.machineShop ||
            3,
          10
        ),
        lineCode: headerInfo.lineCode,
        partName: headerInfo.partName,
        partNo: headerInfo.partNo,
        machineNo: headerInfo.machineNo,
        opNo: headerInfo.opNo,
        date: headerInfo.date,
      },
      sections,
    };

    try {
      const token =
        localStorage.getItem("token");

      const res = await fetch(
        `${process.env.REACT_APP_API_URL}/api/tool-change-record`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        const errorData =
          await res.json().catch(() => ({}));

        throw new Error(
          errorData.error || "Save failed"
        );
      }

      setLineSet({
        machineShop: shopId || "3",
        lineCode: headerInfo.lineCode,
        partName: headerInfo.partName,
        partNo: headerInfo.partNo,
        machineNo: headerInfo.machineNo,
      });

      setIsSaving(false);
      setSaveSuccess(true);

      await new Promise((resolve) =>
        setTimeout(resolve, 2000)
      );

      navigate(
        `/operator/${
          shopId || 3
        }/daily-production-report`
      );
    } catch (err) {
      console.error(
        "Save error:",
        err
      );

      setIsSaving(false);

      triggerToast(
        err.message ||
          "Failed to save tool change record.",
        "error"
      );
    }
  };

  // Split sections into chunks of at most 3 columns
  const getSectionChunks = (
    allSections
  ) => {
    const chunks = [];

    for (
      let i = 0;
      i < allSections.length;
      i += CHUNK_SIZE
    ) {
      const chunk = allSections
        .slice(i, i + CHUNK_SIZE)
        .map((sec, localIdx) => ({
          sec,
          globalIdx: i + localIdx,
        }));

      chunks.push(chunk);
    }

    return chunks;
  };

  const sectionChunks =
    getSectionChunks(sections);

  return (
    <div className="min-h-screen bg-[#2d2d2d] flex flex-col items-center justify-center p-6 pb-20">
      <Header />

      {/* Toast Notification */}
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

      {/* Saving and Success Modals */}
      {(isSaving || saveSuccess) && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl px-10 py-8 text-center">
            {isSaving ? (
              <>
                <div className="w-10 h-10 border-4 border-gray-300 border-t-orange-500 rounded-full animate-spin mx-auto mb-5"></div>

                <h2 className="text-xl font-bold text-gray-800">
                  Saving Data...
                </h2>

                <p className="text-gray-500 mt-2">
                  Please wait
                </p>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold text-green-800">
                  Data Saved Successfully
                </h2>

                <p className="text-gray-500 mt-2">
                  Loading next form...
                </p>
              </>
            )}
          </div>
        </div>
      )}

      <div className="bg-white w-full max-w-[95rem] rounded-xl p-8 shadow-2xl overflow-x-auto border-4 border-gray-100 space-y-6">
        {/* Top Navigation & Card Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-200 pb-4 gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <button
                type="button"
                onClick={() =>
                  navigate(
                    `/operator/${shopId || 3}`
                  )
                }
                className="p-1 text-gray-600 hover:text-orange-600 hover:bg-gray-100 rounded-full transition-colors"
                title="Back to Operator Menu"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              <span className="text-xs font-bold text-orange-600 tracking-wider uppercase">
                {formMeta.company}
              </span>
            </div>

            <h2 className="text-2xl font-bold text-gray-800 uppercase tracking-wide">
              {formMeta.title}
            </h2>

            <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-2">
              <span>
                Form Code: {formMeta.formCode}
              </span>

              <span>|</span>

              <span>
                Revision: {formMeta.revision}
              </span>

              <span>|</span>

              <span>
                Revision Date:{" "}
                {formMeta.revisionDate}
              </span>
            </div>
          </div>
        </div>

        {/* Header Form Selector Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
          {/* LINE CODE */}
          <div>
            <label
              htmlFor="header-lineCode"
              className="font-bold text-gray-700 block mb-1 text-xs uppercase"
            >
              Line Code
            </label>

            {lineCodes.length > 0 ? (
              <select
                id="header-lineCode"
                className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm font-semibold bg-white"
                value={headerInfo.lineCode}
                onChange={(e) =>
                  handleLineChange(
                    e.target.value
                  )
                }
              >
                <option value="">
                  Select Line Code
                </option>

                {lineCodes.map(
                  (lineCode) => (
                    <option
                      key={lineCode}
                      value={lineCode}
                    >
                      {lineCode}
                    </option>
                  )
                )}
              </select>
            ) : (
              <input
                id="header-lineCode"
                type="text"
                className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm font-semibold bg-white"
                placeholder="Enter Line Code"
                value={headerInfo.lineCode}
                onChange={(e) =>
                  handleLineChange(
                    e.target.value
                  )
                }
              />
            )}
          </div>

          {/* PART NO */}
          <div>
            <label
              htmlFor="header-partNo"
              className="font-bold text-gray-700 block mb-1 text-xs uppercase"
            >
              Part No
            </label>

            {partOptions.length > 0 ? (
              <select
                id="header-partNo"
                className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm font-semibold bg-white"
                value={headerInfo.partNo}
                onChange={(e) =>
                  handlePartNoChange(
                    e.target.value
                  )
                }
                disabled={
                  !headerInfo.lineCode
                }
              >
                <option value="">
                  {headerInfo.lineCode
                    ? "Select Part No"
                    : "Select Line First"}
                </option>

                {partOptions.map(
                  (part) => (
                    <option
                      key={part.partNo}
                      value={part.partNo}
                    >
                      {part.partNo}
                    </option>
                  )
                )}
              </select>
            ) : (
              <input
                id="header-partNo"
                type="text"
                className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm font-semibold bg-white"
                placeholder="Enter Part No"
                value={headerInfo.partNo}
                onChange={(e) =>
                  handleHeaderChange(
                    "partNo",
                    e.target.value
                  )
                }
              />
            )}
          </div>

          {/* PART NAME */}
          <div>
            <label
              htmlFor="header-partName"
              className="font-bold text-gray-700 block mb-1 text-xs uppercase"
            >
              Part Name
            </label>

            <input
              id="header-partName"
              type="text"
              className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm font-semibold bg-white"
              value={headerInfo.partName}
              placeholder="Enter or select part name"
              onChange={(e) =>
                handleHeaderChange(
                  "partName",
                  e.target.value
                )
              }
            />
          </div>

          {/* DATE */}
          <div>
            <label
              htmlFor="header-date"
              className="font-bold text-gray-700 block mb-1 text-xs uppercase"
            >
              Date
            </label>

            <input
              id="header-date"
              type="date"
              className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm font-semibold bg-white"
              value={headerInfo.date}
              onChange={(e) =>
                handleDateChange(
                  e.target.value
                )
              }
            />
          </div>
        </div>

        {/* Top Action Bar */}
        <div className="flex flex-wrap justify-between items-center px-1 gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">
              Tool Change Columns
            </span>

            <span className="text-[11px] bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full font-semibold">
              {sections.length}{" "}
              {sections.length === 1
                ? "Column"
                : "Columns"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAddColumn}
              className="inline-flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-4 py-1.5 rounded transition-colors shadow hover:cursor-pointer"
            >
              <span className="text-sm font-bold leading-none">
                +
              </span>{" "}
              Add Column
            </button>

            {sections.length > 1 && (
              <button
                type="button"
                onClick={
                  handleRemoveColumn
                }
                className="inline-flex items-center gap-1 bg-gray-600 hover:bg-gray-700 text-white text-xs font-bold px-3 py-1.5 rounded transition-colors shadow hover:cursor-pointer"
              >
                <span className="text-sm font-bold leading-none">
                  −
                </span>{" "}
                Delete Column
              </button>
            )}
          </div>
        </div>

        {/* Specification Rows Action Bar */}
        <div className="flex flex-wrap justify-between items-center px-1 gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">
              Specification & Dimensions
            </span>

            <span className="text-[11px] bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full font-semibold">
              {sections[0]?.rows?.length ||
                1}{" "}
              {(sections[0]?.rows?.length ||
                1) === 1
                ? "Row"
                : "Rows"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAddRow}
              className="inline-flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-4 py-1.5 rounded transition-colors shadow hover:cursor-pointer"
            >
              <span className="text-sm font-bold leading-none">
                +
              </span>{" "}
              Add Row
            </button>

            {(sections[0]?.rows
              ?.length || 1) > 1 && (
              <button
                type="button"
                onClick={
                  handleRemoveRow
                }
                className="inline-flex items-center gap-1 bg-gray-600 hover:bg-gray-700 text-white text-xs font-bold px-3 py-1.5 rounded transition-colors shadow hover:cursor-pointer"
              >
                <span className="text-sm font-bold leading-none">
                  −
                </span>{" "}
                Delete Row
              </button>
            )}
          </div>
        </div>

        {/* TOOL CHANGE BLOCKS */}
        <div className="space-y-8">
          {sectionChunks.map(
            (chunk, chunkIdx) => (
              <div
                key={`chunk-${chunkIdx}`}
                className="space-y-2"
              >
                {sectionChunks.length >
                  1 && (
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-xs font-bold text-orange-600 uppercase tracking-wider">
                      Block{" "}
                      {chunkIdx + 1}
                    </span>

                    <span className="text-xs text-gray-500">
                      (Columns{" "}
                      {chunk[0].globalIdx +
                        1}
                      {chunk.length > 1
                        ? ` to ${
                            chunk[
                              chunk.length -
                                1
                            ].globalIdx +
                            1
                          }`
                        : ""}
                      )
                    </span>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border-2 border-gray-800 text-xs text-center table-fixed bg-white">
                    <tbody>
                      {/* PART TRACEABILITY */}
                      <tr>
                        {chunk.map(
                          ({
                            sec,
                            globalIdx,
                          }) => (
                            <td
                              key={`hdr-traceability-${globalIdx}`}
                              colSpan={3}
                              className="border border-gray-800 p-1.5 text-left font-normal bg-white"
                            >
                              <div className="flex items-center gap-1">
                                <span className="font-bold text-gray-800 whitespace-nowrap">
                                  PART TRACEABILITY :
                                </span>

                                <input
                                  type="text"
                                  className="w-full outline-none font-medium px-1 bg-transparent border-b border-transparent focus:border-orange-400"
                                  value={
                                    sec.partTraceability
                                  }
                                  placeholder="Enter / Generate Traceability"
                                  onChange={(
                                    e
                                  ) =>
                                    handleSectionMetaChange(
                                      globalIdx,
                                      "partTraceability",
                                      e.target
                                        .value
                                    )
                                  }
                                />
                              </div>
                            </td>
                          )
                        )}
                      </tr>

                      {/* TOOL DESCRIPTION */}
                      <tr>
                        {chunk.map(
                          ({
                            sec,
                            globalIdx,
                          }) => (
                            <td
                              key={`hdr-desc-${globalIdx}`}
                              colSpan={3}
                              className="border border-gray-800 p-1.5 text-left font-normal bg-white"
                            >
                              <div className="flex items-center gap-1">
                                <span className="font-bold text-gray-800 whitespace-nowrap">
                                  TOOL DESCRIPTION :
                                </span>

                                <input
                                  type="text"
                                  className="w-full outline-none font-medium px-1 bg-transparent border-b border-transparent focus:border-orange-400"
                                  value={
                                    sec.toolDescription
                                  }
                                  placeholder="Enter Tool Description"
                                  onChange={(
                                    e
                                  ) =>
                                    handleSectionMetaChange(
                                      globalIdx,
                                      "toolDescription",
                                      e.target
                                        .value
                                    )
                                  }
                                />
                              </div>
                            </td>
                          )
                        )}
                      </tr>

                      {/* M/C NO & OP NO */}
                      <tr>
                        {chunk.map(
                          ({
                            sec,
                            globalIdx,
                          }) => (
                            <td
                              key={`hdr-mcop-${globalIdx}`}
                              colSpan={3}
                              className="border border-gray-800 p-1 font-normal bg-white"
                            >
                              <div className="grid grid-cols-2 divide-x divide-gray-800">
                                {/* M/C NO */}
                                <div className="flex items-center px-1 gap-1">
                                  <span className="font-bold text-gray-800 whitespace-nowrap">
                                    M/C NO :
                                  </span>

                                  {machineOptions.length >
                                  0 ? (
                                    <select
                                      className="w-full outline-none font-medium text-center bg-transparent cursor-pointer"
                                      value={
                                        sec.mcNo
                                      }
                                      onChange={(
                                        e
                                      ) =>
                                        handleSectionMetaChange(
                                          globalIdx,
                                          "mcNo",
                                          e.target
                                            .value
                                        )
                                      }
                                    >
                                      <option value="">
                                        Select M/C
                                      </option>

                                      {machineOptions.map(
                                        (
                                          m
                                        ) => (
                                          <option
                                            key={
                                              m.id
                                            }
                                            value={
                                              m.machineNo
                                            }
                                          >
                                            {
                                              m.machineNo
                                            }
                                          </option>
                                        )
                                      )}
                                    </select>
                                  ) : (
                                    <input
                                      type="text"
                                      className="w-full outline-none font-medium text-center bg-transparent"
                                      placeholder={
                                        headerInfo.lineCode
                                          ? "No M/C found"
                                          : "Select Line First"
                                      }
                                      value={
                                        sec.mcNo
                                      }
                                      onChange={(
                                        e
                                      ) =>
                                        handleSectionMetaChange(
                                          globalIdx,
                                          "mcNo",
                                          e.target
                                            .value
                                        )
                                      }
                                    />
                                  )}
                                </div>

                                {/* OP NO */}
                                <div className="flex items-center px-1 gap-1">
                                  <span className="font-bold text-gray-800 whitespace-nowrap">
                                    OP NO :
                                  </span>

                                  <select
                                    id="header-opNo"
                                    className="w-full outline-none font-medium text-center bg-transparent"
                                    value={
                                      headerInfo.opNo
                                    }
                                    onChange={(
                                      e
                                    ) =>
                                      setHeaderInfo(
                                        (
                                          prev
                                        ) => ({
                                          ...prev,
                                          opNo: e
                                            .target
                                            .value,
                                        })
                                      )
                                    }
                                  >
                                    <option value="">
                                      Select OP No
                                    </option>

                                    <option value="20">
                                      20
                                    </option>

                                    <option value="30">
                                      30
                                    </option>

                                    <option value="40">
                                      40
                                    </option>

                                    <option value="50">
                                      50
                                    </option>

                                    <option value="60">
                                      60
                                    </option>

                                    <option value="70">
                                      70
                                    </option>
                                  </select>
                                </div>
                              </div>
                            </td>
                          )
                        )}
                      </tr>

                      {/* DATE & SHIFT */}
                      <tr>
                        {chunk.map(
                          ({
                            sec,
                            globalIdx,
                          }) => (
                            <td
                              key={`hdr-dateshift-${globalIdx}`}
                              colSpan={3}
                              className="border border-gray-800 p-1 font-normal bg-white"
                            >
                              <div className="grid grid-cols-2 divide-x divide-gray-800">
                                <div className="flex items-center px-1 gap-1">
                                  <span className="font-bold text-gray-800 whitespace-nowrap">
                                    DATE :
                                  </span>

                                  <input
                                    type="date"
                                    className="w-full outline-none font-medium text-center bg-transparent"
                                    value={
                                      sec.date
                                    }
                                    onChange={(
                                      e
                                    ) =>
                                      handleSectionMetaChange(
                                        globalIdx,
                                        "date",
                                        e.target
                                          .value
                                      )
                                    }
                                  />
                                </div>

                                <div className="flex items-center px-1 gap-1">
                                  <span className="font-bold text-gray-800 whitespace-nowrap">
                                    SHIFT :
                                  </span>

                                  <select
                                    className="w-full outline-none font-medium text-center bg-transparent cursor-pointer"
                                    value={
                                      sec.shift
                                    }
                                    onChange={(
                                      e
                                    ) =>
                                      handleSectionMetaChange(
                                        globalIdx,
                                        "shift",
                                        e.target
                                          .value
                                      )
                                    }
                                  >
                                    <option value="I">
                                      I
                                    </option>

                                    <option value="II">
                                      II
                                    </option>

                                    <option value="III">
                                      III
                                    </option>
                                  </select>
                                </div>
                              </div>
                            </td>
                          )
                        )}
                      </tr>

                      {/* FROM & TO TIME */}
                      <tr>
                        {chunk.map(
                          ({
                            sec,
                            globalIdx,
                          }) => (
                            <td
                              key={`hdr-fromto-${globalIdx}`}
                              colSpan={3}
                              className="border border-gray-800 p-1 font-normal bg-white"
                            >
                              <div className="grid grid-cols-2 divide-x divide-gray-800">
                                <div className="flex items-center px-1 gap-1">
                                  <span className="font-bold text-gray-800 whitespace-nowrap">
                                    FROM :
                                  </span>

                                  <input
                                    type="time"
                                    className="w-full outline-none font-medium text-center bg-transparent"
                                    value={
                                      sec.from
                                    }
                                    onChange={(
                                      e
                                    ) =>
                                      handleSectionMetaChange(
                                        globalIdx,
                                        "from",
                                        e.target
                                          .value
                                      )
                                    }
                                  />
                                </div>

                                <div className="flex items-center px-1 gap-1">
                                  <span className="font-bold text-gray-800 whitespace-nowrap">
                                    TO :
                                  </span>

                                  <input
                                    type="time"
                                    className="w-full outline-none font-medium text-center bg-transparent"
                                    value={
                                      sec.to
                                    }
                                    onChange={(
                                      e
                                    ) =>
                                      handleSectionMetaChange(
                                        globalIdx,
                                        "to",
                                        e.target
                                          .value
                                      )
                                    }
                                  />
                                </div>
                              </div>
                            </td>
                          )
                        )}
                      </tr>

                      {/* CONTROL SPEC / BEFORE / AFTER HEADER */}
                      <tr className="bg-gray-100 text-gray-800 font-bold">
                        {chunk.map(
                          ({
                            globalIdx,
                          }) => (
                            <React.Fragment
                              key={`subcols-${globalIdx}`}
                            >
                              <th className="border border-gray-800 p-1.5 w-[11%]">
                                CONTROL SPEC
                              </th>

                              <th className="border border-gray-800 p-1.5 w-[7%]">
                                BEFORE
                              </th>

                              <th className="border border-gray-800 p-1.5 w-[7%]">
                                AFTER
                              </th>
                            </React.Fragment>
                          )
                        )}
                      </tr>

                      {/* SPECIFICATION DATA ROWS */}
                      {sections[0]?.rows.map(
                        (_, rIdx) => (
                          <tr
                            key={`data-row-${chunkIdx}-${rIdx}`}
                            className="h-8"
                          >
                            {chunk.map(
                              ({
                                sec,
                                globalIdx,
                              }) => {
                                const rowData =
                                  sec.rows[
                                    rIdx
                                  ] || {
                                    controlSpec:
                                      "",
                                    before:
                                      "",
                                    after:
                                      "",
                                  };

                                return (
                                  <React.Fragment
                                    key={`cell-${globalIdx}-${rIdx}`}
                                  >
                                    {/* CONTROL SPEC */}
                                    <td className="border border-gray-800 p-0">
                                      <input
                                        type="text"
                                        className="w-full h-full text-center outline-none bg-transparent py-1 px-1"
                                        placeholder="Specification"
                                        aria-label={`Column ${
                                          globalIdx +
                                          1
                                        } Row ${
                                          rIdx +
                                          1
                                        } Control Spec`}
                                        value={
                                          rowData.controlSpec
                                        }
                                        onChange={(
                                          e
                                        ) =>
                                          handleCellChange(
                                            globalIdx,
                                            rIdx,
                                            "controlSpec",
                                            e
                                              .target
                                              .value
                                          )
                                        }
                                      />
                                    </td>

                                    {/* BEFORE */}
                                    <td className="border border-gray-800 p-0">
                                      <input
                                        type="text"
                                        className="w-full h-full text-center outline-none bg-transparent py-1 px-1"
                                        placeholder="Before"
                                        aria-label={`Column ${
                                          globalIdx +
                                          1
                                        } Row ${
                                          rIdx +
                                          1
                                        } Before`}
                                        value={
                                          rowData.before
                                        }
                                        onChange={(
                                          e
                                        ) =>
                                          handleCellChange(
                                            globalIdx,
                                            rIdx,
                                            "before",
                                            e
                                              .target
                                              .value
                                          )
                                        }
                                      />
                                    </td>

                                    {/* AFTER */}
                                    <td className="border border-gray-800 p-0">
                                      <input
                                        type="text"
                                        className="w-full h-full text-center outline-none bg-transparent py-1 px-1"
                                        placeholder="After"
                                        aria-label={`Column ${
                                          globalIdx +
                                          1
                                        } Row ${
                                          rIdx +
                                          1
                                        } After`}
                                        value={
                                          rowData.after
                                        }
                                        onChange={(
                                          e
                                        ) =>
                                          handleCellChange(
                                            globalIdx,
                                            rIdx,
                                            "after",
                                            e
                                              .target
                                              .value
                                          )
                                        }
                                      />
                                    </td>
                                  </React.Fragment>
                                );
                              }
                            )}
                          </tr>
                        )
                      )}

                      {/* TOOL CHANGED BY */}
                      <tr>
                        {chunk.map(
                          ({
                            sec,
                            globalIdx,
                          }) => (
                            <React.Fragment
                              key={`tc-sig-${globalIdx}`}
                            >
                              <td className="border border-gray-800 p-1 font-bold text-gray-800 bg-gray-50 align-middle w-[11%]">
                                TOOL CHANGED BY
                              </td>

                              <td
                                colSpan={2}
                                className="border border-gray-800 p-0 text-left w-[14%]"
                              >
                                <div className="flex items-center px-2 py-1 gap-1">
                                  <input
                                    type="text"
                                    className="w-full outline-none font-medium bg-transparent"
                                    placeholder="Signature"
                                    value={
                                      sec
                                        .toolChangedBy
                                        ?.signature ||
                                      ""
                                    }
                                    onChange={(
                                      e
                                    ) =>
                                      handleSignatureChange(
                                        globalIdx,
                                        "toolChangedBy",
                                        "signature",
                                        e
                                          .target
                                          .value
                                      )
                                    }
                                  />
                                </div>
                              </td>
                            </React.Fragment>
                          )
                        )}
                      </tr>

                      {/* VERIFIED BY QC */}
                      <tr>
                        {chunk.map(
                          ({
                            sec,
                            globalIdx,
                          }) => (
                            <React.Fragment
                              key={`qc-sig-${globalIdx}`}
                            >
                              <td className="border border-gray-800 p-1 font-bold text-gray-800 bg-gray-50 align-middle w-[11%]">
                                VERIFIED BY QC
                              </td>

                              <td
                                colSpan={2}
                                className="border border-gray-800 p-0 text-left w-[14%]"
                              >
                                <div className="flex items-center px-2 py-1 gap-1">
                                  <input
                                    type="text"
                                    className="w-full outline-none font-medium bg-transparent"
                                    placeholder="Signature"
                                    value={
                                      sec
                                        .verifiedByQc
                                        ?.signature ||
                                      ""
                                    }
                                    onChange={(
                                      e
                                    ) =>
                                      handleSignatureChange(
                                        globalIdx,
                                        "verifiedByQc",
                                        "signature",
                                        e
                                          .target
                                          .value
                                      )
                                    }
                                  />
                                </div>
                              </td>
                            </React.Fragment>
                          )
                        )}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}
        </div>

        {/* Applicable Events Box */}
        <div className="border-2 border-gray-800 p-3 bg-white">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="font-bold text-gray-800 whitespace-nowrap text-xs">
              Applicable Events:
            </span>

            <span className="text-xs text-gray-700">
              {formMeta.applicableEvents}
            </span>
          </div>
        </div>

        {/* SAVE BUTTON */}
        <div className="flex justify-end gap-4 pt-4 border-t border-gray-300">
          <button
            type="button"
            onClick={handleSave}
            className="bg-orange-500 hover:bg-orange-600 text-white px-10 py-3 rounded font-bold transition-colors shadow-lg hover:cursor-pointer flex items-center gap-2"
          >
            Save & Continue
          </button>
        </div>
      </div>
    </div>
  );
}