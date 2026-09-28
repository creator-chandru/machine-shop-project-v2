import React, { useState } from 'react';

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
  const [headerInfo, setHeaderInfo] = useState({
    line: "",
    partName: ""
  });

  const [rows, setRows] = useState([emptyRow()]);
  const [hodSign, setHodSign] = useState("");

  const handleHeaderChange = (field, val) => {
    setHeaderInfo((prev) => ({
      ...prev,
      [field]: val
    }));
  };

  // Add a new row
  const handleAddRow = () => {
    setRows((prev) => [...prev, emptyRow()]);
  };

  // Delete the last row if more than 1 exists
  const handleRemoveRow = () => {
    setRows((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  };

  const handleRowChange = (rowIdx, field, val) => {
    setRows((prev) => {
      const next = [...prev];
      next[rowIdx] = { ...next[rowIdx], [field]: val };
      return next;
    });
  };

  const handleSave = async () => {
    const payload = {
      headerInfo: headerInfo,
      rows: rows.map((r) => ({
        ...r,
        dateShift: `${r.date || ''} ${r.shift || ''}`.trim() || r.date || r.dateShift
      })),
      hodSign: hodSign
    };

    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/four-m-change-monitoring`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Save failed');

      const data = await res.json();
      alert(data.message || "CheckSheet saved successfully");
    } catch (err) {
      console.error('Save error: ', err);
      alert('Failed to save checksheet. Check console for details.');
    }
  };

  return (
    <div className="min-h-screen bg-[#2d2d2d] flex flex-col items-center justify-center p-6 pb-20">
      <div className="bg-white w-full max-w-[95rem] rounded-xl p-8 shadow-2xl overflow-x-auto border-4 border-gray-100">

        {/* Card Header */}
        <div className="flex justify-between items-center mb-6 border-b border-gray-200 pb-4">
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

        {/* Header Meta Fields (Line & Part Name) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div>
            <label htmlFor="header-line" className="font-bold text-gray-700 block mb-1 text-sm">
              Line:
            </label>
            <input
              id="header-line"
              type="text"
              className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm font-semibold bg-white"
              placeholder="Enter Line"
              value={headerInfo.line}
              onChange={(e) => handleHeaderChange('line', e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="header-partName" className="font-bold text-gray-700 block mb-1 text-sm">
              Part Name:
            </label>
            <input
              id="header-partName"
              type="text"
              className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm font-semibold bg-white"
              placeholder="Enter Part Name"
              value={headerInfo.partName}
              onChange={(e) => handleHeaderChange('partName', e.target.value)}
            />
          </div>
        </div>

        {/* Action Toolbar with "+ Add Row" Button BEFORE the Table */}
        <div className="flex justify-between items-center mb-2 px-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">
              Checksheet Items
            </span>
            <span className="text-[11px] bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full font-semibold">
              {rows.length} {rows.length === 1 ? 'Row' : 'Rows'}
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

        {/* Main Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border-2 border-gray-800 text-xs text-center">
            <thead className="bg-gray-100 text-gray-800 font-bold">
              <tr>
                <th className="border border-gray-800 p-2 w-28">Date</th>
                <th className="border border-gray-800 p-2 w-20">Shift</th>
                <th className="border border-gray-800 p-2 w-24">M/c. No</th>
                <th className="border border-gray-800 p-2 w-28">Type of<br />4M</th>
                <th className="border border-gray-800 p-2 text-left px-3 min-w-[200px]">Description</th>
                <th className="border border-gray-800 p-2 w-24">First Part</th>
                <th className="border border-gray-800 p-2 w-24">Last Part</th>
                <th className="border border-gray-800 p-2 w-32">
                  Inspection Frequency<br />
                  <span className="text-[10px] font-normal text-gray-600 block mt-0.5">
                    N - Normal / I - Increase
                  </span>
                </th>
                <th className="border border-gray-800 p-2 w-28">Retro<br />checking</th>
                <th className="border border-gray-800 p-2 w-28">Quarantine</th>
                <th className="border border-gray-800 p-2 w-32">Part<br />Identification</th>
                <th className="border border-gray-800 p-2 w-36">Internal<br />Communication</th>
                <th className="border border-gray-800 p-2 w-28">Incharge<br />Sign</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rIdx) => (
                <tr key={`row-${rIdx}`} className="h-9">
                  {/* Date */}
                  <td className="border border-gray-800 p-0">
                    <input
                      type="date"
                      className="w-full h-full text-center outline-none bg-transparent py-1.5 px-1 font-medium"
                      aria-label={`Row ${rIdx + 1} Date`}
                      value={row.date}
                      onChange={(e) => handleRowChange(rIdx, 'date', e.target.value)}
                    />
                  </td>

                  {/* Shift Dropdown */}
                  <td className="border border-gray-800 p-0">
                    <select
                      value={row.shift}
                      aria-label={`Row ${rIdx + 1} Shift`}
                      className="w-full h-full text-center outline-none bg-transparent py-1.5 cursor-pointer font-bold text-sm"
                      onChange={(e) => handleRowChange(rIdx, 'shift', e.target.value)}
                    >
                      <option value="I">I</option>
                      <option value="II">II</option>
                      <option value="III">III</option>
                    </select>
                  </td>

                  {/* M/c. No */}
                  <td className="border border-gray-800 p-0">
                    <input
                      type="text"
                      className="w-full h-full text-center outline-none bg-transparent py-1.5 px-1 font-medium"
                      aria-label={`Row ${rIdx + 1} M/c. No`}
                      value={row.mcNo}
                      onChange={(e) => handleRowChange(rIdx, 'mcNo', e.target.value)}
                    />
                  </td>

                  {/* Type of 4M */}
                  <td className="border border-gray-800 p-0">
                    <input
                      type="text"
                      className="w-full h-full text-center outline-none bg-transparent py-1.5 px-1 font-medium"
                      aria-label={`Row ${rIdx + 1} Type of 4M`}
                      placeholder="Man/M/c/Mat/Meth"
                      value={row.typeOf4M}
                      onChange={(e) => handleRowChange(rIdx, 'typeOf4M', e.target.value)}
                    />
                  </td>

                  {/* Description (Left Aligned Writable) */}
                  <td className="border border-gray-800 p-0">
                    <input
                      type="text"
                      className="w-full h-full text-left px-3 outline-none bg-transparent py-1.5 font-medium"
                      aria-label={`Row ${rIdx + 1} Description`}
                      value={row.description}
                      onChange={(e) => handleRowChange(rIdx, 'description', e.target.value)}
                    />
                  </td>

                  {/* First Part Dropdown */}
                  <td className="border border-gray-800 p-0">
                    <select
                      value={row.firstPart}
                      aria-label={`Row ${rIdx + 1} First Part`}
                      className="w-full h-full text-center outline-none bg-transparent py-1.5 cursor-pointer font-bold text-sm"
                      onChange={(e) => handleRowChange(rIdx, 'firstPart', e.target.value)}
                    >
                      <option value=""></option>
                      <option value="✓">✓</option>
                      <option value="X">X</option>
                    </select>
                  </td>

                  {/* Last Part Dropdown */}
                  <td className="border border-gray-800 p-0">
                    <select
                      value={row.lastPart}
                      aria-label={`Row ${rIdx + 1} Last Part`}
                      className="w-full h-full text-center outline-none bg-transparent py-1.5 cursor-pointer font-bold text-sm"
                      onChange={(e) => handleRowChange(rIdx, 'lastPart', e.target.value)}
                    >
                      <option value=""></option>
                      <option value="✓">✓</option>
                      <option value="X">X</option>
                    </select>
                  </td>

                  {/* Inspection Frequency Dropdown */}
                  <td className="border border-gray-800 p-0">
                    <select
                      value={row.inspectionFrequency}
                      aria-label={`Row ${rIdx + 1} Inspection Frequency`}
                      className="w-full h-full text-center outline-none bg-transparent py-1.5 cursor-pointer font-bold text-sm"
                      onChange={(e) => handleRowChange(rIdx, 'inspectionFrequency', e.target.value)}
                    >
                      <option value=""></option>
                      <option value="N">N</option>
                      <option value="I">I</option>
                    </select>
                  </td>

                  {/* Retro checking Dropdown */}
                  <td className="border border-gray-800 p-0">
                    <select
                      value={row.retroChecking}
                      aria-label={`Row ${rIdx + 1} Retro checking`}
                      className="w-full h-full text-center outline-none bg-transparent py-1.5 cursor-pointer font-bold text-sm"
                      onChange={(e) => handleRowChange(rIdx, 'retroChecking', e.target.value)}
                    >
                      <option value=""></option>
                      <option value="✓">✓</option>
                      <option value="X">X</option>
                    </select>
                  </td>

                  {/* Quarantine Dropdown */}
                  <td className="border border-gray-800 p-0">
                    <select
                      value={row.quarantine}
                      aria-label={`Row ${rIdx + 1} Quarantine`}
                      className="w-full h-full text-center outline-none bg-transparent py-1.5 cursor-pointer font-bold text-sm"
                      onChange={(e) => handleRowChange(rIdx, 'quarantine', e.target.value)}
                    >
                      <option value=""></option>
                      <option value="✓">✓</option>
                      <option value="X">X</option>
                    </select>
                  </td>

                  {/* Part Identification Dropdown */}
                  <td className="border border-gray-800 p-0">
                    <select
                      value={row.partIdentification}
                      aria-label={`Row ${rIdx + 1} Part Identification`}
                      className="w-full h-full text-center outline-none bg-transparent py-1.5 cursor-pointer font-bold text-sm"
                      onChange={(e) => handleRowChange(rIdx, 'partIdentification', e.target.value)}
                    >
                      <option value=""></option>
                      <option value="✓">✓</option>
                      <option value="X">X</option>
                    </select>
                  </td>

                  {/* Internal Communication Dropdown */}
                  <td className="border border-gray-800 p-0">
                    <select
                      value={row.internalCommunication}
                      aria-label={`Row ${rIdx + 1} Internal Communication`}
                      className="w-full h-full text-center outline-none bg-transparent py-1.5 cursor-pointer font-bold text-sm"
                      onChange={(e) => handleRowChange(rIdx, 'internalCommunication', e.target.value)}
                    >
                      <option value=""></option>
                      <option value="✓">✓</option>
                      <option value="X">X</option>
                    </select>
                  </td>

                  {/* Incharge Sign */}
                  <td className="border border-gray-800 p-0">
                    <input
                      type="text"
                      className="w-full h-full text-center outline-none bg-transparent py-1.5 px-1 font-medium"
                      aria-label={`Row ${rIdx + 1} Incharge Sign`}
                      value={row.inchargeSign}
                      onChange={(e) => handleRowChange(rIdx, 'inchargeSign', e.target.value)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer: Form Code & HOD Sign */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mt-5 pt-3 gap-3">
          <div className="text-xs text-gray-600 font-semibold">
            {formMeta.formCode}, Rev.No: {formMeta.revision}, {formMeta.revisionDate}
          </div>

          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-800 text-sm">HOD Sign :</span>
            <input
              type="text"
              className="border-b border-gray-800 outline-none px-2 py-1 text-sm font-semibold text-center w-52 bg-transparent focus:border-orange-500"
              placeholder="Enter HOD Signature"
              aria-label="HOD Signature"
              value={hodSign}
              onChange={(e) => setHodSign(e.target.value)}
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