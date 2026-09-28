import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

const formMeta = {
  formCode: "QF / 07 / MPD-36",
  revision: "01",
  revisionDate: "13.03.2019",
  title: "4M CHANGE MONITORING CHECK SHEET",
  company: "SAKTHI AUTO"
};

const emptyRow = () => ({
  date: "",
  shift: "I",
  dateShift: "",
  mcNo: "",
  typeOf4M: "",
  description: "",
  firstPart: "",
  lastPart: "",
  inspectionFrequency: "",
  retroChecking: "",
  quarantine: "",
  partIdentification: "",
  internalCommunication: "",
  inchargeSign: ""
});

export default function FourMChangeMonitoringCheckSheet() {
  const { shopId } = useParams();

  const [headerInfo, setHeaderInfo] = useState({
    machineShop: shopId || "",
    lineCode: "",
    partName: "",
    partNo: "",
    machineNo: ""
  });

  const [machineDetails, setMachineDetails] = useState([]);
  const [loadingMachineDetails, setLoadingMachineDetails] = useState(true);

  const [rows, setRows] = useState([emptyRow()]);
  const [hodSign, setHodSign] = useState("");

  // ============================================================
  // FETCH MACHINE SHOP DETAILS
  // Same pattern as AirGapSensorCheckSheet
  // ============================================================
  useEffect(() => {
    const fetchMachineDetails = async () => {
      try {
        if (shopId !== "3") {
          setMachineDetails([]);
          return;
        }

        const token = localStorage.getItem("token");

        const response = await fetch(
          `${process.env.REACT_APP_API_URL}/api/machine-shop/3/pre-operation-details`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );

        if (!response.ok) {
          throw new Error("Failed to fetch Machine Shop 3 details");
        }

        const data = await response.json();

        setMachineDetails(data);
      } catch (error) {
        console.error(
          "Error fetching machine shop details:",
          error
        );
      } finally {
        setLoadingMachineDetails(false);
      }
    };

    fetchMachineDetails();
  }, [shopId]);

  // ============================================================
  // DERIVED OPTIONS
  // Same pattern as AirGapSensorCheckSheet
  // ============================================================

  // Line Code options
  const lineCodes = [
    ...new Set(
      machineDetails
        .map((item) => item.lineCode)
        .filter(Boolean)
    )
  ];

  // Details for selected Line Code
  const selectedLineDetails = machineDetails.filter(
    (item) => item.lineCode === headerInfo.lineCode
  );

  // Part No options for selected Line Code
  const partOptions = [
    ...new Map(
      selectedLineDetails
        .filter((item) => item.partNo)
        .map((item) => [item.partNo, item])
    ).values()
  ];

  // Details for selected Line Code + Part No
  const selectedPartDetails = machineDetails.filter(
    (item) =>
      item.lineCode === headerInfo.lineCode &&
      item.partNo === headerInfo.partNo
  );

  // Machine No options
  const machineOptions = selectedPartDetails;

  // ============================================================
  // HEADER CHANGE
  // ============================================================
  const handleHeaderChange = (field, val) => {
    setHeaderInfo((prev) => ({
      ...prev,
      [field]: val
    }));
  };

  // ============================================================
  // LINE CODE CHANGE
  // ============================================================
  const handleLineCodeChange = (lineCode) => {
    setHeaderInfo((prev) => ({
      ...prev,
      lineCode,
      partNo: "",
      partName: "",
      machineNo: ""
    }));

    // Reset machine number in all existing rows
    setRows((prev) =>
      prev.map((row) => ({
        ...row,
        mcNo: ""
      }))
    );
  };

  // ============================================================
  // PART NO CHANGE
  // ============================================================
  const handlePartNoChange = (partNo) => {
    const selectedPart = machineDetails.find(
      (item) =>
        item.lineCode === headerInfo.lineCode &&
        item.partNo === partNo
    );

    const partName = selectedPart?.partName || "";

    setHeaderInfo((prev) => ({
      ...prev,
      partNo,
      partName,
      machineNo: ""
    }));

    // Reset machine number in all existing rows
    setRows((prev) =>
      prev.map((row) => ({
        ...row,
        mcNo: ""
      }))
    );
  };

  // ============================================================
  // MACHINE NO CHANGE
  // Machine No is now selected directly inside table
  // ============================================================
  const handleMachineNoChange = (rowIdx, machineNo) => {
    handleRowChange(rowIdx, "mcNo", machineNo);

    // Keep headerInfo.machineNo internally for the existing
    // save functionality and payload structure.
    setHeaderInfo((prev) => ({
      ...prev,
      machineNo
    }));
  };

  // ============================================================
  // ADD ROW
  // ============================================================
  const handleAddRow = () => {
    setRows((prev) => [...prev, emptyRow()]);
  };

  // ============================================================
  // DELETE LAST ROW
  // ============================================================
  const handleRemoveRow = () => {
    setRows((prev) =>
      prev.length > 1 ? prev.slice(0, -1) : prev
    );
  };

  // ============================================================
  // ROW CHANGE
  // ============================================================
  const handleRowChange = (rowIdx, field, val) => {
    setRows((prev) => {
      const next = [...prev];

      next[rowIdx] = {
        ...next[rowIdx],
        [field]: val
      };

      return next;
    });
  };

  // ============================================================
  // SAVE
  // ============================================================
  const handleSave = async () => {
    if (!headerInfo.machineShop) {
      alert("Machine shop is missing.");
      return;
    }

    if (!headerInfo.lineCode) {
      alert("Please select a Line Code.");
      return;
    }

    if (!headerInfo.partNo) {
      alert("Please select a Part No.");
      return;
    }

    if (!headerInfo.partName) {
      alert("Part Name is missing.");
      return;
    }

    // Since Machine No is now inside the table,
    // get the selected Machine No from the rows.
    const selectedMachineNo =
      rows.find((row) => row.mcNo)?.mcNo || "";

    if (!selectedMachineNo) {
      alert("Please select a Machine No.");
      return;
    }

    const payload = {
      headerInfo: {
        machineShop: Number(headerInfo.machineShop),
        lineCode: headerInfo.lineCode,
        partName: headerInfo.partName,
        partNo: headerInfo.partNo,
        machineNo: selectedMachineNo
      },

      rows: rows.map((r, index) => ({
        ...r,

        slNo: index + 1,

        dateShift:
          `${r.date || ""} ${r.shift || ""}`.trim() ||
          r.date ||
          r.dateShift
      })),

      hodSign: hodSign
    };

    try {
      const token = localStorage.getItem("token");

      const res = await fetch(
        `${process.env.REACT_APP_API_URL}/api/four-m-change-monitoring`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        }
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);

        throw new Error(
          errorData?.message || "Save failed"
        );
      }

      const data = await res.json();

      alert(
        data.message ||
          "CheckSheet saved successfully"
      );
    } catch (err) {
      console.error("Save error:", err);

      alert(
        err.message ||
          "Failed to save checksheet. Check console for details."
      );
    }
  };

  return (
    <div className="min-h-screen bg-[#2d2d2d] flex flex-col items-center justify-center p-6 pb-20">

      <div className="bg-white w-full max-w-[95rem] rounded-xl p-8 shadow-2xl overflow-x-auto border-4 border-gray-100">

        {/* ======================================================
            CARD HEADER
        ====================================================== */}

        <div className="flex justify-between items-center mb-6 border-b border-gray-200 pb-4">

          <div>

            <span className="text-xs font-bold text-orange-600 tracking-wider uppercase block mb-1">
              {formMeta.company}
            </span>

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
                Revision Date: {formMeta.revisionDate}
              </span>

            </div>

          </div>

        </div>

        {/* ======================================================
            HEADER META FIELDS
        ====================================================== */}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6">

          {/* LINE CODE */}

          <div>
            <label
              htmlFor="header-lineCode"
              className="font-bold text-gray-700 block mb-1 text-sm"
            >
              Line Code
            </label>

            <select
              id="header-lineCode"
              className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm font-semibold bg-white"
              value={headerInfo.lineCode}
              onChange={(e) =>
                handleLineCodeChange(e.target.value)
              }
              disabled={loadingMachineDetails}
            >
              <option value="">
                {loadingMachineDetails
                  ? "Loading..."
                  : "Select Line Code"}
              </option>

              {lineCodes.map((lineCode) => (
                <option
                  key={lineCode}
                  value={lineCode}
                >
                  {lineCode}
                </option>
              ))}
            </select>
          </div>

          {/* PART NO */}

          <div>
            <label
              htmlFor="header-partNo"
              className="font-bold text-gray-700 block mb-1 text-sm"
            >
              Part No
            </label>

            <select
              id="header-partNo"
              className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm font-semibold bg-white"
              value={headerInfo.partNo}
              onChange={(e) =>
                handlePartNoChange(e.target.value)
              }
              disabled={!headerInfo.lineCode}
            >
              <option value="">
                {headerInfo.lineCode
                  ? "Select Part No"
                  : "Select Line Code First"}
              </option>

              {partOptions.map((part) => (
                <option
                  key={part.partNo}
                  value={part.partNo}
                >
                  {part.partNo}
                </option>
              ))}
            </select>
          </div>

          {/* PART NAME */}

          <div>
            <label
              htmlFor="header-partName"
              className="font-bold text-gray-700 block mb-1 text-sm"
            >
              Part Name
            </label>

            <input
              id="header-partName"
              type="text"
              readOnly
              className="w-full border border-gray-300 p-2 rounded text-sm font-semibold bg-gray-100"
              value={headerInfo.partName}
              placeholder="Auto-filled"
            />
          </div>

        </div>

        {/* ======================================================
            ACTION TOOLBAR
        ====================================================== */}

        <div className="flex justify-between items-center mb-2 px-1">

          <div className="flex items-center gap-2">

            <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">
              Checksheet Items
            </span>

            <span className="text-[11px] bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full font-semibold">
              {rows.length}{" "}
              {rows.length === 1 ? "Row" : "Rows"}
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
              </span>
              Add Row
            </button>

            {rows.length > 1 && (
              <button
                type="button"
                onClick={handleRemoveRow}
                className="inline-flex items-center gap-1 bg-gray-600 hover:bg-gray-700 text-white text-xs font-bold px-3 py-1.5 rounded transition-colors shadow hover:cursor-pointer"
              >
                <span className="text-sm font-bold leading-none">
                  −
                </span>
                Delete Row
              </button>
            )}

          </div>

        </div>

        {/* ======================================================
            MAIN TABLE
        ====================================================== */}

        <div className="overflow-x-auto">

          <table className="w-full border-collapse border-2 border-gray-800 text-xs text-center">

            <thead className="bg-gray-100 text-gray-800 font-bold">

              <tr>

                <th className="border border-gray-800 p-2 w-28">
                  Date
                </th>

                <th className="border border-gray-800 p-2 w-20">
                  Shift
                </th>

                <th className="border border-gray-800 p-2 w-24">
                  M/c. No
                </th>

                <th className="border border-gray-800 p-2 w-28">
                  Type of
                  <br />
                  4M
                </th>

                <th className="border border-gray-800 p-2 text-left px-3 min-w-[200px]">
                  Description
                </th>

                <th className="border border-gray-800 p-2 w-24">
                  First Part
                </th>

                <th className="border border-gray-800 p-2 w-24">
                  Last Part
                </th>

                <th className="border border-gray-800 p-2 w-32">
                  Inspection Frequency
                  <br />
                  <span className="text-[10px] font-normal text-gray-600 block mt-0.5">
                    N - Normal / I - Increase
                  </span>
                </th>

                <th className="border border-gray-800 p-2 w-28">
                  Retro
                  <br />
                  checking
                </th>

                <th className="border border-gray-800 p-2 w-28">
                  Quarantine
                </th>

                <th className="border border-gray-800 p-2 w-32">
                  Part
                  <br />
                  Identification
                </th>

                <th className="border border-gray-800 p-2 w-36">
                  Internal
                  <br />
                  Communication
                </th>

                <th className="border border-gray-800 p-2 w-28">
                  Incharge
                  <br />
                  Sign
                </th>

              </tr>

            </thead>

            <tbody>

              {rows.map((row, rIdx) => (

                <tr
                  key={`row-${rIdx}`}
                  className="h-9"
                >

                  {/* DATE */}

                  <td className="border border-gray-800 p-0">
                    <input
                      type="date"
                      className="w-full h-full text-center outline-none bg-transparent py-1.5 px-1 font-medium"
                      value={row.date}
                      onChange={(e) =>
                        handleRowChange(
                          rIdx,
                          "date",
                          e.target.value
                        )
                      }
                    />
                  </td>

                  {/* SHIFT */}

                  <td className="border border-gray-800 p-0">
                    <select
                      value={row.shift}
                      className="w-full h-full text-center outline-none bg-transparent py-1.5 cursor-pointer font-bold text-sm"
                      onChange={(e) =>
                        handleRowChange(
                          rIdx,
                          "shift",
                          e.target.value
                        )
                      }
                    >
                      <option value="I">I</option>
                      <option value="II">II</option>
                      <option value="III">III</option>
                    </select>
                  </td>

                  {/* MACHINE NO */}

                  <td className="border border-gray-800 p-0">

                    <select
                      value={row.mcNo}
                      className="w-full h-full text-center outline-none bg-transparent py-1.5 cursor-pointer font-bold text-sm"
                      onChange={(e) =>
                        handleMachineNoChange(
                          rIdx,
                          e.target.value
                        )
                      }
                      disabled={!headerInfo.partNo}
                    >

                      <option value="">
                        {headerInfo.partNo
                          ? "Select"
                          : "Select Part No"}
                      </option>

                      {machineOptions.map((machine) => (
                        <option
                          key={machine.id}
                          value={machine.machineNo}
                        >
                          {machine.machineNo}
                        </option>
                      ))}

                    </select>

                  </td>

                  {/* TYPE OF 4M */}

                  <td className="border border-gray-800 p-0">
                    <input
                      type="text"
                      className="w-full h-full text-center outline-none bg-transparent py-1.5 px-1 font-medium"
                      placeholder="Man/M/c/Mat/Meth"
                      value={row.typeOf4M}
                      onChange={(e) =>
                        handleRowChange(
                          rIdx,
                          "typeOf4M",
                          e.target.value
                        )
                      }
                    />
                  </td>

                  {/* DESCRIPTION */}

                  <td className="border border-gray-800 p-0">
                    <input
                      type="text"
                      className="w-full h-full text-left px-3 outline-none bg-transparent py-1.5 font-medium"
                      value={row.description}
                      onChange={(e) =>
                        handleRowChange(
                          rIdx,
                          "description",
                          e.target.value
                        )
                      }
                    />
                  </td>

                  {/* FIRST PART */}

                  <td className="border border-gray-800 p-0">
                    <select
                      value={row.firstPart}
                      className="w-full h-full text-center outline-none bg-transparent py-1.5 cursor-pointer font-bold text-sm"
                      onChange={(e) =>
                        handleRowChange(
                          rIdx,
                          "firstPart",
                          e.target.value
                        )
                      }
                    >
                      <option value=""></option>
                      <option value="✓">✓</option>
                      <option value="X">X</option>
                    </select>
                  </td>

                  {/* LAST PART */}

                  <td className="border border-gray-800 p-0">
                    <select
                      value={row.lastPart}
                      className="w-full h-full text-center outline-none bg-transparent py-1.5 cursor-pointer font-bold text-sm"
                      onChange={(e) =>
                        handleRowChange(
                          rIdx,
                          "lastPart",
                          e.target.value
                        )
                      }
                    >
                      <option value=""></option>
                      <option value="✓">✓</option>
                      <option value="X">X</option>
                    </select>
                  </td>

                  {/* INSPECTION FREQUENCY */}

                  <td className="border border-gray-800 p-0">
                    <select
                      value={row.inspectionFrequency}
                      className="w-full h-full text-center outline-none bg-transparent py-1.5 cursor-pointer font-bold text-sm"
                      onChange={(e) =>
                        handleRowChange(
                          rIdx,
                          "inspectionFrequency",
                          e.target.value
                        )
                      }
                    >
                      <option value=""></option>
                      <option value="N">N</option>
                      <option value="I">I</option>
                    </select>
                  </td>

                  {/* RETRO CHECKING */}

                  <td className="border border-gray-800 p-0">
                    <select
                      value={row.retroChecking}
                      className="w-full h-full text-center outline-none bg-transparent py-1.5 cursor-pointer font-bold text-sm"
                      onChange={(e) =>
                        handleRowChange(
                          rIdx,
                          "retroChecking",
                          e.target.value
                        )
                      }
                    >
                      <option value=""></option>
                      <option value="✓">✓</option>
                      <option value="X">X</option>
                    </select>
                  </td>

                  {/* QUARANTINE */}

                  <td className="border border-gray-800 p-0">
                    <select
                      value={row.quarantine}
                      className="w-full h-full text-center outline-none bg-transparent py-1.5 cursor-pointer font-bold text-sm"
                      onChange={(e) =>
                        handleRowChange(
                          rIdx,
                          "quarantine",
                          e.target.value
                        )
                      }
                    >
                      <option value=""></option>
                      <option value="✓">✓</option>
                      <option value="X">X</option>
                    </select>
                  </td>

                  {/* PART IDENTIFICATION */}

                  <td className="border border-gray-800 p-0">
                    <select
                      value={row.partIdentification}
                      className="w-full h-full text-center outline-none bg-transparent py-1.5 cursor-pointer font-bold text-sm"
                      onChange={(e) =>
                        handleRowChange(
                          rIdx,
                          "partIdentification",
                          e.target.value
                        )
                      }
                    >
                      <option value=""></option>
                      <option value="✓">✓</option>
                      <option value="X">X</option>
                    </select>
                  </td>

                  {/* INTERNAL COMMUNICATION */}

                  <td className="border border-gray-800 p-0">
                    <select
                      value={row.internalCommunication}
                      className="w-full h-full text-center outline-none bg-transparent py-1.5 cursor-pointer font-bold text-sm"
                      onChange={(e) =>
                        handleRowChange(
                          rIdx,
                          "internalCommunication",
                          e.target.value
                        )
                      }
                    >
                      <option value=""></option>
                      <option value="✓">✓</option>
                      <option value="X">X</option>
                    </select>
                  </td>

                  {/* INCHARGE SIGN */}

                  <td className="border border-gray-800 p-0">
                    <input
                      type="text"
                      className="w-full h-full text-center outline-none bg-transparent py-1.5 px-1 font-medium"
                      value={row.inchargeSign}
                      onChange={(e) =>
                        handleRowChange(
                          rIdx,
                          "inchargeSign",
                          e.target.value
                        )
                      }
                    />
                  </td>

                </tr>

              ))}

            </tbody>

          </table>

        </div>

        {/* ======================================================
            FOOTER
        ====================================================== */}

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mt-5 pt-3 gap-3">

          <div className="text-xs text-gray-600 font-semibold">
            {formMeta.formCode}, Rev.No:{" "}
            {formMeta.revision},{" "}
            {formMeta.revisionDate}
          </div>

          <div className="flex items-center gap-2">

            <span className="font-bold text-gray-800 text-sm">
              HOD Sign :
            </span>

            <input
              type="text"
              className="border-b border-gray-800 outline-none px-2 py-1 text-sm font-semibold text-center w-52 bg-transparent focus:border-orange-500"
              placeholder="Enter HOD Signature"
              value={hodSign}
              onChange={(e) =>
                setHodSign(e.target.value)
              }
            />

          </div>

          <div className="flex justify-end gap-4 mt-6 pt-4 border-t border-gray-300">

            <button
              type="button"
              onClick={handleSave}
              className="bg-orange-500 hover:bg-orange-600 text-white px-10 py-3 rounded font-bold transition-colors shadow-lg hover:cursor-pointer"
            >
              Save & continue
            </button>

          </div>

        </div>

      </div>

    </div>
  );
}