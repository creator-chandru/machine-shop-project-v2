import React, { useState } from "react";

const INITIAL_ROWS = 1;

const formMeta = {
  formCode: "QF/07/MPD-02",
  revision: "07",
  revisionDate: "13.08.2024",
  title: "RECORD OF SIGNIFICANT EVENT (MACHINE SHOP)",
  company: "SAKTHI AUTO",
  applicableEvents:
    "Significant Machine Break Downs & Other unusual situation and applicable 4M change.",
};

const createEmptyRow = () => ({
  controlSpec: "",
  inspectionGauge: "",
  before: { part1: "", part2: "", part3: "" },
  after: { part1: "", part2: "", part3: "" },
});

export default function RecordOfSignificantEvent() {
  // 1. Header Information
  const [header, setHeader] = useState({
    month: "",
    partName: "",
    lineName: "",
    event: "",
    mcNo: "",
    opNo: "",
    date: "",
    shift: "I",
    from: "",
    to: "",
  });

  // 2. Traceability Information
  const [traceability, setTraceability] = useState({
    casting: {
      before: { part1: "", part2: "", part3: "" },
      after: { part1: "", part2: "", part3: "" },
    },
    machining: {
      before: { part1: "", part2: "", part3: "" },
      after: { part1: "", part2: "", part3: "" },
    },
  });

  // 3. Dynamic Measurement Rows
  const [rows, setRows] = useState(
    Array.from({ length: INITIAL_ROWS }, () => createEmptyRow())
  );

  // 4. Signatures
  const [signatures, setSignatures] = useState({
    prodnIncharge: "",
    qcIncharge: "",
    prodnHofSign: "",
  });

  // Handlers
  const handleHeaderChange = (field, val) => {
    setHeader((prev) => ({ ...prev, [field]: val }));
  };

  const handleTraceabilityChange = (type, timing, part, val) => {
    setTraceability((prev) => ({
      ...prev,
      [type]: {
        ...prev[type],
        [timing]: {
          ...prev[type][timing],
          [part]: val,
        },
      },
    }));
  };

  const handleRowChange = (rowIdx, field, subField, val) => {
    setRows((prev) => {
      const next = [...prev];
      if (subField) {
        next[rowIdx] = {
          ...next[rowIdx],
          [field]: {
            ...next[rowIdx][field],
            [subField]: val,
          },
        };
      } else {
        next[rowIdx] = {
          ...next[rowIdx],
          [field]: val,
        };
      }
      return next;
    });
  };

  const handleSignatureChange = (field, val) => {
    setSignatures((prev) => ({ ...prev, [field]: val }));
  };

  // Add new measurement row
  const handleAddRow = () => {
    setRows((prev) => [...prev, createEmptyRow()]);
  };

  // Remove last row
  const handleRemoveRow = () => {
    setRows((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  };

  // Save to Backend
  const handleSave = async () => {
    const payload = {
      header,
      traceability,
      rows,
      signatures,
    };

    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/significant-event-record`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Save failed");

      const data = await res.json();
      alert(data.message || "Record of Significant Event saved successfully!");
    } catch (err) {
      console.error("Save error:", err);
      alert("Failed to save record. Check console for details.");
    }
  };

  return (
    <div className="min-h-screen bg-[#2d2d2d] flex flex-col items-center justify-center p-6 pb-20">
      <div className="bg-white w-full max-w-[90rem] rounded-xl p-8 shadow-2xl overflow-x-auto border-4 border-gray-100 space-y-6">

        {/* Card Header & Month */}
        <div className="flex justify-between items-center border-b border-gray-200 pb-4">
          <div>
            <span className="text-xs font-bold text-orange-600 tracking-wider uppercase block mb-1">
              {formMeta.company}
            </span>
            <h2 className="text-2xl font-bold text-gray-800 uppercase tracking-wide">
              {formMeta.title}
            </h2>
            <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-2">
              <span>Form Code: {formMeta.formCode}</span>
              <span>|</span>
              <span>Revision: {formMeta.revision}</span>
              <span>|</span>
              <span>Revision Date: {formMeta.revisionDate}</span>
            </div>
          </div>

        </div>

        {/* ========================================================
            1. HEADER & EVENT DETAILS TABLE
        ======================================================== */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border-2 border-gray-800 text-xs text-center table-fixed">
            <tbody>
              {/* PART NAME */}
              <tr>
                <td colSpan={2} className="border border-gray-800 p-2 text-left bg-white">
                  <div className="flex items-center gap-2">
                    <label className="font-bold text-gray-800 whitespace-nowrap">
                      PART NAME :
                    </label>
                    <input
                      type="text"
                      className="w-full font-semibold text-gray-800 outline-none px-2 py-0.5 bg-transparent border-b border-gray-300 focus:border-orange-500"
                      value={header.partName}
                      onChange={(e) => handleHeaderChange("partName", e.target.value)}
                    />
                  </div>
                </td>
              </tr>

              {/* LINE NAME (DIRECTLY BELOW PART NAME) */}
              <tr>
                <td colSpan={2} className="border border-gray-800 p-2 text-left bg-white">
                  <div className="flex items-center gap-2">
                    <label className="font-bold text-gray-800 whitespace-nowrap">
                      LINE NAME :
                    </label>
                    <input
                      type="text"
                      className="w-full font-semibold text-gray-800 outline-none px-2 py-0.5 bg-transparent border-b border-gray-300 focus:border-orange-500"
                      value={header.lineName}
                      onChange={(e) => handleHeaderChange("lineName", e.target.value)}
                    />
                  </div>
                </td>
              </tr>

              {/* EVENT */}
              <tr>
                <td colSpan={2} className="border border-gray-800 p-2 text-left bg-white">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-800 whitespace-nowrap">
                      EVENT :
                    </span>
                    <input
                      type="text"
                      placeholder="Specify event details..."
                      className="w-full font-semibold text-gray-800 outline-none px-2 py-0.5 bg-transparent border-b border-transparent focus:border-orange-400"
                      value={header.event}
                      onChange={(e) => handleHeaderChange("event", e.target.value)}
                    />
                  </div>
                </td>
              </tr>

              {/* M/C NO & OP NO */}
              <tr>
                <td className="border border-gray-800 p-1 bg-white w-1/2">
                  <div className="flex items-center px-2 gap-2">
                    <span className="font-bold text-gray-800 whitespace-nowrap">M/C No :</span>
                    <input
                      type="text"
                      className="w-full outline-none font-medium text-center bg-transparent"
                      value={header.mcNo}
                      onChange={(e) => handleHeaderChange("mcNo", e.target.value)}
                    />
                  </div>
                </td>
                <td className="border border-gray-800 p-1 bg-white w-1/2">
                  <div className="flex items-center px-2 gap-2">
                    <span className="font-bold text-gray-800 whitespace-nowrap">OP No :</span>
                    <input
                      type="text"
                      className="w-full outline-none font-medium text-center bg-transparent"
                      value={header.opNo}
                      onChange={(e) => handleHeaderChange("opNo", e.target.value)}
                    />
                  </div>
                </td>
              </tr>

              {/* DATE & SHIFT */}
              <tr>
                <td className="border border-gray-800 p-1 bg-white w-1/2">
                  <div className="flex items-center px-2 gap-2">
                    <span className="font-bold text-gray-800 whitespace-nowrap">DATE :</span>
                    <input
                      type="date"
                      className="w-full outline-none font-medium text-center bg-transparent"
                      value={header.date}
                      onChange={(e) => handleHeaderChange("date", e.target.value)}
                    />
                  </div>
                </td>
                <td className="border border-gray-800 p-1 bg-white w-1/2">
                  <div className="flex items-center px-2 gap-2">
                    <span className="font-bold text-gray-800 whitespace-nowrap">SHIFT :</span>
                    <select
                      className="w-full outline-none font-medium text-center bg-transparent cursor-pointer"
                      value={header.shift}
                      onChange={(e) => handleHeaderChange("shift", e.target.value)}
                    >
                      <option value="I">I</option>
                      <option value="II">II</option>
                      <option value="III">III</option>
                    </select>
                  </div>
                </td>
              </tr>

              {/* FROM & TO TIME */}
              <tr>
                <td className="border border-gray-800 p-1 bg-white w-1/2">
                  <div className="flex items-center px-2 gap-2">
                    <span className="font-bold text-gray-800 whitespace-nowrap">FROM :</span>
                    <input
                      type="time"
                      className="w-full outline-none font-medium text-center bg-transparent"
                      value={header.from}
                      onChange={(e) => handleHeaderChange("from", e.target.value)}
                    />
                  </div>
                </td>
                <td className="border border-gray-800 p-1 bg-white w-1/2">
                  <div className="flex items-center px-2 gap-2">
                    <span className="font-bold text-gray-800 whitespace-nowrap">TO :</span>
                    <input
                      type="time"
                      className="w-full outline-none font-medium text-center bg-transparent"
                      value={header.to}
                      onChange={(e) => handleHeaderChange("to", e.target.value)}
                    />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ========================================================
            2. SINGLE CONTROL SPEC & MEASUREMENTS TABLE
        ======================================================== */}
        <div className="pt-2">

          {/* Action Toolbar with "+ Add Row" directly BEFORE the Measurements Table */}
          <div className="flex justify-between items-center mb-2 px-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                Inspection & Control Specifications
              </span>
              <span className="text-[11px] bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full font-semibold">
                {rows.length} {rows.length === 1 ? "Custom Row" : "Custom Rows"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAddRow}
                className="inline-flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-4 py-1.5 rounded transition-colors shadow hover:cursor-pointer"
              >
                <span className="text-sm font-bold leading-none">+</span> Add Row
              </button>

              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={handleRemoveRow}
                  className="inline-flex items-center gap-1 bg-gray-600 hover:bg-gray-700 text-white text-xs font-bold px-3 py-1.5 rounded transition-colors shadow hover:cursor-pointer"
                >
                  <span className="text-sm font-bold leading-none">−</span> Delete Row
                </button>
              )}
            </div>
          </div>

          {/* Single Control Spec Table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border-2 border-gray-800 text-xs text-center table-fixed">
              <thead>
                {/* Header Row 1 */}
                <tr className="bg-gray-100 text-gray-800 font-bold">
                  <th rowSpan={2} className="border border-gray-800 p-2 w-[22%]">
                    CONTROL SPEC
                  </th>
                  <th rowSpan={2} className="border border-gray-800 p-2 w-[24%]">
                    INSPECTION INSTRUMENT / GAUGE
                  </th>
                  <th colSpan={3} className="border border-gray-800 p-1.5 w-[27%] bg-gray-200">
                    BEFORE OCCURANCE
                  </th>
                  <th colSpan={3} className="border border-gray-800 p-1.5 w-[27%] bg-gray-200">
                    AFTER CORRECTION
                  </th>
                </tr>

                {/* Header Row 2 (Part 1, Part 2, Part 3) */}
                <tr className="bg-gray-50 text-gray-800 font-bold text-[11px]">
                  <th className="border border-gray-800 p-1 w-[9%]">PART 1</th>
                  <th className="border border-gray-800 p-1 w-[9%]">PART 2</th>
                  <th className="border border-gray-800 p-1 w-[9%]">PART 3</th>
                  <th className="border border-gray-800 p-1 w-[9%]">PART 1</th>
                  <th className="border border-gray-800 p-1 w-[9%]">PART 2</th>
                  <th className="border border-gray-800 p-1 w-[9%]">PART 3</th>
                </tr>
              </thead>

              <tbody>
                {/* 1) Part Traceability - Casting (date code) */}
                <tr className="h-8">
                  <td colSpan={2} className="border border-gray-800 px-3 py-1 text-left font-medium bg-gray-50">
                    1) Part Traceability - Casting (date code):
                  </td>
                  {["part1", "part2", "part3"].map((p) => (
                    <td key={`cast-b-${p}`} className="border border-gray-800 p-0">
                      <input
                        type="text"
                        className="w-full h-full text-center outline-none bg-transparent py-1 px-1"
                        value={traceability.casting.before[p]}
                        onChange={(e) =>
                          handleTraceabilityChange("casting", "before", p, e.target.value)
                        }
                      />
                    </td>
                  ))}
                  {["part1", "part2", "part3"].map((p) => (
                    <td key={`cast-a-${p}`} className="border border-gray-800 p-0">
                      <input
                        type="text"
                        className="w-full h-full text-center outline-none bg-transparent py-1 px-1"
                        value={traceability.casting.after[p]}
                        onChange={(e) =>
                          handleTraceabilityChange("casting", "after", p, e.target.value)
                        }
                      />
                    </td>
                  ))}
                </tr>

                {/* 2) Part Traceability - Machining */}
                <tr className="h-8">
                  <td colSpan={2} className="border border-gray-800 px-3 py-1 text-left font-medium bg-gray-50">
                    2) Part Traceability - Machining:
                  </td>
                  {["part1", "part2", "part3"].map((p) => (
                    <td key={`mach-b-${p}`} className="border border-gray-800 p-0">
                      <input
                        type="text"
                        className="w-full h-full text-center outline-none bg-transparent py-1 px-1"
                        value={traceability.machining.before[p]}
                        onChange={(e) =>
                          handleTraceabilityChange("machining", "before", p, e.target.value)
                        }
                      />
                    </td>
                  ))}
                  {["part1", "part2", "part3"].map((p) => (
                    <td key={`mach-a-${p}`} className="border border-gray-800 p-0">
                      <input
                        type="text"
                        className="w-full h-full text-center outline-none bg-transparent py-1 px-1"
                        value={traceability.machining.after[p]}
                        onChange={(e) =>
                          handleTraceabilityChange("machining", "after", p, e.target.value)
                        }
                      />
                    </td>
                  ))}
                </tr>

                {/* Dynamic Custom Data Rows */}
                {rows.map((row, rIdx) => (
                  <tr key={`data-row-${rIdx}`} className="h-8">
                    {/* CONTROL SPEC */}
                    <td className="border border-gray-800 p-0">
                      <input
                        type="text"
                        className="w-full h-full text-center outline-none bg-transparent py-1 px-2"
                        placeholder="Specification"
                        value={row.controlSpec}
                        onChange={(e) =>
                          handleRowChange(rIdx, "controlSpec", null, e.target.value)
                        }
                      />
                    </td>

                    {/* INSPECTION INSTRUMENT / GAUGE */}
                    <td className="border border-gray-800 p-0">
                      <input
                        type="text"
                        className="w-full h-full text-center outline-none bg-transparent py-1 px-2"
                        placeholder="Instrument / Gauge"
                        value={row.inspectionGauge}
                        onChange={(e) =>
                          handleRowChange(rIdx, "inspectionGauge", null, e.target.value)
                        }
                      />
                    </td>

                    {/* BEFORE OCCURANCE (PART 1, 2, 3) */}
                    {["part1", "part2", "part3"].map((p) => (
                      <td key={`b-${p}-${rIdx}`} className="border border-gray-800 p-0">
                        <input
                          type="text"
                          className="w-full h-full text-center outline-none bg-transparent py-1 px-1"
                          value={row.before[p]}
                          onChange={(e) =>
                            handleRowChange(rIdx, "before", p, e.target.value)
                          }
                        />
                      </td>
                    ))}

                    {/* AFTER CORRECTION (PART 1, 2, 3) */}
                    {["part1", "part2", "part3"].map((p) => (
                      <td key={`a-${p}-${rIdx}`} className="border border-gray-800 p-0">
                        <input
                          type="text"
                          className="w-full h-full text-center outline-none bg-transparent py-1 px-1"
                          value={row.after[p]}
                          onChange={(e) =>
                            handleRowChange(rIdx, "after", p, e.target.value)
                          }
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ========================================================
            3. SIGNATURES & APPLICABLE EVENTS TABLE
        ======================================================== */}
        <div className="overflow-x-auto pt-2">
          <table className="w-full border-collapse border-2 border-gray-800 text-xs text-center table-fixed">
            <tbody>
              {/* PRODN INCHARGE */}
              <tr>
                <td className="border border-gray-800 p-2 font-bold text-gray-800 bg-gray-50 text-left w-[25%]">
                  PRODN INCHARGE
                </td>
                <td className="border border-gray-800 p-0 text-left w-[75%]">
                  <input
                    type="text"
                    placeholder="Sign / Name"
                    className="w-full outline-none font-medium bg-transparent px-3 py-2"
                    value={signatures.prodnIncharge}
                    onChange={(e) => handleSignatureChange("prodnIncharge", e.target.value)}
                  />
                </td>
              </tr>

              {/* QC INCHARGE */}
              <tr>
                <td className="border border-gray-800 p-2 font-bold text-gray-800 bg-gray-50 text-left w-[25%]">
                  QC INCHARGE
                </td>
                <td className="border border-gray-800 p-0 text-left w-[75%]">
                  <input
                    type="text"
                    placeholder="Sign / Name"
                    className="w-full outline-none font-medium bg-transparent px-3 py-2"
                    value={signatures.qcIncharge}
                    onChange={(e) => handleSignatureChange("qcIncharge", e.target.value)}
                  />
                </td>
              </tr>

              {/* PRODN HOF SIGN */}
              <tr>
                <td className="border border-gray-800 p-2 font-bold text-gray-800 bg-gray-50 text-left w-[25%]">
                  PRODN HOF SIGN
                </td>
                <td className="border border-gray-800 p-0 text-left w-[75%]">
                  <input
                    type="text"
                    placeholder="Sign / Name"
                    className="w-full outline-none font-medium bg-transparent px-3 py-2"
                    value={signatures.prodnHofSign}
                    onChange={(e) => handleSignatureChange("prodnHofSign", e.target.value)}
                  />
                </td>
              </tr>

              {/* APPLICABLE EVENTS */}
              <tr>
                <td colSpan={2} className="border border-gray-800 p-2 text-left bg-white">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-bold text-gray-800 whitespace-nowrap text-xs">
                      Applicable Events:
                    </span>
                    <span className="text-xs text-gray-700">
                      {formMeta.applicableEvents}
                    </span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footer Meta Code */}
        <div className="text-xs text-gray-600 font-semibold pt-1">
          {formMeta.formCode}, Rev.No: {formMeta.revision} dt {formMeta.revisionDate}
        </div>

        {/* Save Button */}
        <div className="flex justify-end gap-4 pt-4 border-t border-gray-300">
          <button
            type="button"
            onClick={handleSave}
            className="bg-orange-500 hover:bg-orange-600 text-white px-10 py-3 rounded font-bold transition-colors shadow-lg hover:cursor-pointer"
          >
            Save
          </button>
        </div>

      </div>
    </div>
  );
}