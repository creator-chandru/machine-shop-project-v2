import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLineSet } from "../context/LineSetContext.jsx";
import Header from '../components/Header';

const INITIAL_ROWS = 1;

const initialFormData = {
  formCode: "QF/07/MPD-09",
  revision: "04",
  revisionDate: "31.01.2025",
  title: "ERROR PROOFING CHECK SHEET",
  company: "SAKTHI AUTO",

  header: {
    line: "",
    partName: "",
    partNo: "",
    date: ""
  },

  signatures: {
    roles: ["Operator", "Shift Incharge"]
  },

  notes: [
    "If the Error Proof verification fails, follow the reaction plan for error proof failure as per WI/07/MPD-271 during checking.",
    "Inform the concerned department, correct the failure, and then check the first part.",
    "Error proof verification should be conducted and recorded during setup changes, major breakdowns, and any fixture issues in the respective machines/fixtures."
  ]
};

const emptyRow = () => ({
  machineNo: "",
  errorProofNo: "",
  errorProofName: "",
  value: ""
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

export default function ErrorProofingCheckSheet() {
  const { shopId } = useParams();
  const navigate = useNavigate();

  const { lineSet, setLineSet } = useLineSet();

  const [headerInfo, setHeaderInfo] = useState({
    lineCode: "",
    partName: "",
    partNo: "",
    machineNo: "",
    date: ""
  });

  // Toast state
  const [toast, setToast] = useState({
    message: '',
    type: ''
  });

  // Get current logged in user name for auto-approval
  const currentUser = JSON.parse(localStorage.getItem('user'))?.username || 'Unknown';

  const triggerToast = (message, type = 'error') => {
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

  // ==========================================================
  // SYNC LINE SET CONTEXT
  // ==========================================================
  useEffect(() => {
    if (lineSet) {
      setHeaderInfo((prev) => ({
        ...prev,
        lineCode: lineSet.lineCode || "",
        partName: lineSet.partName || "",
        partNo: lineSet.partNo || "",
        machineNo: lineSet.machineNo || ""
      }));
    }
  }, [lineSet]);

  // ==========================================================
  // MACHINE DETAILS
  // ==========================================================
  const [machineDetails, setMachineDetails] = useState([]);
  const [lineMappings, setLineMappings] = useState([]);
  const [loadingMachineDetails, setLoadingMachineDetails] = useState(true);

  // ==========================================================
  // FETCH MACHINE DETAILS + LINE MAPPINGS
  // ==========================================================
  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!shopId) return;

        const token = localStorage.getItem("token");

        const headers = {
          Authorization: `Bearer ${token}`
        };

        // Fetch machine details
        const machineRes = await fetch(
          `${process.env.REACT_APP_API_URL}/api/machine-shop/${shopId}/pre-operation-details`,
          {
            headers
          }
        );

        if (!machineRes.ok) {
          throw new Error("Failed to fetch Machine Shop details");
        }

        const machineData = await machineRes.json();

        setMachineDetails(machineData);

        // Fetch line mappings
        const mappingRes = await fetch(
          `${process.env.REACT_APP_API_URL}/api/mappings/${shopId}/lines`,
          {
            headers
          }
        );

        if (!mappingRes.ok) {
          throw new Error("Failed to fetch line mappings");
        }

        const mappingData = await mappingRes.json();

        setLineMappings(mappingData);

      } catch (err) {
        console.error("Data fetch error:", err);

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

  // ==========================================================
  // LINE CODE OPTIONS
  // ==========================================================
  const lineCodes =
    lineMappings.length > 0
      ? lineMappings.map((m) => m.lineCode)
      : [
          ...new Set(
            machineDetails
              .map((item) => item.lineCode)
              .filter(Boolean)
          )
        ];

  // ==========================================================
  // MACHINE OPTIONS
  // IMPORTANT:
  // Machine options depend ONLY on Line Code.
  // ==========================================================
  const machineOptionsRaw = machineDetails.filter(
    (item) => item.lineCode === headerInfo.lineCode
  );

  // Remove duplicate machine numbers
  const machineOptions = Array.from(
    new Set(
      machineOptionsRaw
        .map((m) => m.machineNo)
        .filter(Boolean)
    )
  ).map((machineNo) =>
    machineOptionsRaw.find(
      (m) => m.machineNo === machineNo
    )
  );

  // ==========================================================
  // ROWS
  // Each row maintains its own machineNo.
  // ==========================================================
  const [rows, setRows] = useState(
    Array.from(
      { length: INITIAL_ROWS },
      () => emptyRow()
    )
  );

  const [signatures, setSignatures] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // ==========================================================
  // HEADER CHANGE
  // ==========================================================
  const handleHeaderChange = (field, val) => {
    setHeaderInfo((prev) => ({
      ...prev,
      [field]: val
    }));

    if (field === "date") {
      return;
    }
  };

  // ==========================================================
  // LINE CODE CHANGE
  // ==========================================================
  const handleLineChange = (lineCode) => {
    const mapping = lineMappings.find(
      (m) => m.lineCode === lineCode
    );

    const autoPartName = mapping?.partSet || "";
    const autoPartNo = mapping?.idSet || "";

    setHeaderInfo((prev) => ({
      ...prev,
      lineCode,
      partName: autoPartName,
      partNo: autoPartNo,
      machineNo: ""
    }));
    
    // Clear signatures when line changes
    setSignatures({});

    setLineSet({
      machineShop: shopId,
      lineCode,
      partName: autoPartName,
      partNo: autoPartNo,
      machineNo: ""
    });
  };

  // ==========================================================
  // ROW CHANGE
  // ==========================================================
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

  // ==========================================================
  // SIGNATURE APPROVAL
  // ==========================================================
  const handleApproveSignatures = () => {
    setSignatures({
      "Operator": currentUser,
      "Shift Incharge": currentUser
    });
    triggerToast("Form approved successfully", "success");
  };

  // ==========================================================
  // ADD ROW
  // ==========================================================
  const handleAddRow = () => {
    setRows((prev) => [
      ...prev,
      emptyRow()
    ]);
  };

  // ==========================================================
  // REMOVE LAST ROW
  // ==========================================================
  const handleRemoveRow = () => {
    setRows((prev) =>
      prev.length > 1
        ? prev.slice(0, -1)
        : prev
    );
  };

  // ==========================================================
  // SAVE
  // ==========================================================
  const handleSave = async () => {
    // Validate signatures
    if (!signatures["Operator"] || !signatures["Shift Incharge"]) {
      triggerToast("Please click 'Approve' to sign the form before saving.", "error");
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);

    const payload = {
      header: {
        ...headerInfo,
        machineShop: lineSet?.machineShop || shopId,
        lineCode: headerInfo.lineCode,
        partName: headerInfo.partName,
        partNo: headerInfo.partNo,
        machineNo: headerInfo.machineNo
      },
      rows,
      signatures
    };

    try {
      const token = localStorage.getItem('token');

      const res = await fetch(
        `${process.env.REACT_APP_API_URL}/api/error-proofing-checksheet`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        }
      );

      if (!res.ok) {
        throw new Error('Save failed');
      }

      // Update LineSetContext with latest selection
      setLineSet({
        machineShop: shopId,
        lineCode: headerInfo.lineCode,
        partName: headerInfo.partName,
        partNo: headerInfo.partNo,
        machineNo: headerInfo.machineNo
      });

      // Hide Saving
      setIsSaving(false);

      // Show success
      setSaveSuccess(true);

      // Keep success message visible for 2 seconds
      await new Promise(
        resolve => setTimeout(resolve, 2000)
      );

      // Go to Form 3
      navigate(
        `/operator/${shopId}/air-gap-sensor`
      );

    } catch (err) {
      console.error('Save error:', err);
      setIsSaving(false);

      triggerToast(
        err.message ||
          'Failed to save checksheet. Check console for details.',
        'error'
      );
    }
  };

  return (
    <div className="min-h-screen bg-[#2d2d2d] flex flex-col items-center justify-center p-6 pb-20">

      <Header />

      {/* Toast Notification */}
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() =>
          setToast({
            message: '',
            type: ''
          })
        }
      />

      {/* Saving / Success Overlay */}
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

      <div className="bg-white w-full max-w-[90rem] rounded-xl p-8 shadow-2xl overflow-x-auto border-4 border-gray-100">

        {/* Card Header */}
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
                Form Code: {initialFormData.formCode}
              </span>

              <span>|</span>

              <span>
                Revision: {initialFormData.revision}
              </span>

              <span>|</span>

              <span>
                Revision Date: {initialFormData.revisionDate}
              </span>

            </div>

          </div>

        </div>

        {/* Header Meta Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">

          {/* LINE CODE */}
          <div>

            <label
              htmlFor="header-lineCode"
              className="font-bold text-gray-700 block mb-1 text-sm"
            >
              LineCode
            </label>

            <select
              id="header-lineCode"
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

          {/* PART NO - AUTO FILLED */}
          <div>

            <label
              htmlFor="header-partNo"
              className="font-bold text-gray-700 block mb-1 text-sm"
            >
              Part No
            </label>

            <input
              id="header-partNo"
              type="text"
              readOnly
              className="w-full border border-gray-300 p-2 rounded text-sm font-semibold bg-gray-100"
              value={headerInfo.partNo}
              placeholder="Auto-filled"
            />

          </div>

          {/* PART NAME - AUTO FILLED */}
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

          {/* DATE */}
          <div>

            <label
              htmlFor="header-date"
              className="font-bold text-gray-700 block mb-1 text-sm"
            >
              Date
            </label>

            <input
              id="header-date"
              type="date"
              className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm font-semibold bg-white"
              value={headerInfo.date}
              onChange={(e) =>
                handleHeaderChange(
                  'date',
                  e.target.value
                )
              }
            />

          </div>

        </div>

        {/* Action Toolbar */}
        <div className="flex justify-between items-center mb-2 px-1">

          <div className="flex items-center gap-2">

            <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">
              Checksheet Items
            </span>

            <span className="text-[11px] bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full font-semibold">
              {rows.length}{' '}
              {rows.length === 1
                ? 'Row'
                : 'Rows'}
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

        {/* Main Table */}
        <div className="overflow-x-auto">

          <table className="w-full border-collapse border border-gray-800 text-sm text-center">

            <thead className="bg-gray-100 text-gray-800 font-bold">

              <tr>
                <th className="border border-gray-800 p-2 w-16">Sl No</th>
                <th className="border border-gray-800 p-2 w-40">Machine No</th>
                <th className="border border-gray-800 p-2 w-44">Error Proof No</th>
                <th className="border border-gray-800 p-2 text-left px-3">Error Proof Name</th>
                <th className="border border-gray-800 p-2 w-48">Value</th>
              </tr>

            </thead>

            <tbody>

              {/* ==================================================
                  CHECKSHEET ROWS
                  ================================================== */}

              {rows.map((row, rIdx) => (

                <tr key={`row-${rIdx}`}>

                  {/* SL NO */}
                  <td className="border border-gray-800 p-2 font-medium text-gray-700">
                    {rIdx + 1}
                  </td>

                  {/* MACHINE NO */}
                  <td className="border border-gray-800 p-0">

                    <select
                      className="w-full h-full text-center outline-none bg-transparent py-2 cursor-pointer"
                      aria-label={`Row ${rIdx + 1} Machine No`}
                      value={row.machineNo}
                      onChange={(e) =>
                        handleRowChange(
                          rIdx,
                          "machineNo",
                          e.target.value
                        )
                      }
                      disabled={!headerInfo.lineCode}
                    >

                      <option value="">
                        {headerInfo.lineCode
                          ? "Select Machine"
                          : "Select Line Code"}
                      </option>

                      {machineOptions.map(
                        (machine, index) => (
                          <option
                            key={
                              machine.id ||
                              `${machine.machineNo}-${index}`
                            }
                            value={machine.machineNo}
                          >
                            {machine.machineNo}
                          </option>
                        )
                      )}

                    </select>

                  </td>

                  {/* ERROR PROOF NO */}
                  <td className="border border-gray-800 p-0">

                    <input
                      type="text"
                      className="w-full h-full text-center outline-none bg-transparent py-2"
                      aria-label={`Row ${rIdx + 1} Error Proof No`}
                      value={row.errorProofNo}
                      onChange={(e) =>
                        handleRowChange(
                          rIdx,
                          'errorProofNo',
                          e.target.value
                        )
                      }
                    />

                  </td>

                  {/* ERROR PROOF NAME */}
                  <td className="border border-gray-800 p-0">

                    <input
                      type="text"
                      className="w-full h-full text-left px-3 outline-none bg-transparent py-2"
                      aria-label={`Row ${rIdx + 1} Error Proof Name`}
                      value={row.errorProofName}
                      onChange={(e) =>
                        handleRowChange(
                          rIdx,
                          'errorProofName',
                          e.target.value
                        )
                      }
                    />

                  </td>

                  {/* VALUE */}
                  <td className="border border-gray-800 p-0">

                    <select
                      value={row.value}
                      aria-label={`Row ${rIdx + 1} value`}
                      className="w-full h-full text-center outline-none bg-transparent py-2 cursor-pointer font-bold"
                      onChange={(e) =>
                        handleRowChange(
                          rIdx,
                          'value',
                          e.target.value
                        )
                      }
                    >

                      <option value=""></option>
                      <option value="✓">✓</option>
                      <option value="X">X</option>

                    </select>

                  </td>

                </tr>

              ))}

              {/* ==================================================
                  SIGNATURE ROWS
                  ================================================== */}
              <tr>
                <td colSpan={4} className="border border-gray-800 p-2 text-left px-3 font-bold bg-gray-50 text-gray-700">
                  Operator Signature
                </td>
                <td rowSpan={2} className="border border-gray-800 p-2 align-middle text-center bg-gray-50/30">
                  {signatures["Operator"] ? (
                    <div className="flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300">
                      <span className="text-xs font-bold text-green-600 mb-1">Approved By ✓</span>
                      <span className="text-sm font-black text-gray-900 uppercase">{signatures["Operator"]}</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleApproveSignatures}
                      className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-6 py-2 rounded shadow transition-all hover:scale-105 uppercase tracking-widest"
                    >
                      Approve
                    </button>
                  )}
                </td>
              </tr>
              <tr>
                <td colSpan={4} className="border border-gray-800 p-2 text-left px-3 font-bold bg-gray-50 text-gray-700">
                  Shift Incharge Signature
                </td>
              </tr>

            </tbody>

          </table>

        </div>

        {/* Notes Section */}
        <div className="border-2 border-gray-800 flex flex-col mt-4">

          <div className="px-2 py-1 font-bold text-gray-800 text-sm border-b border-gray-800 bg-gray-100">
            Note:
          </div>

          <ol className="list-decimal list-inside p-3 text-xs text-gray-700 space-y-1.5 leading-relaxed bg-white">

            {initialFormData.notes.map(
              (note, idx) => (

                <li key={`note-${idx}`}>
                  {note}
                </li>

              )
            )}

          </ol>

        </div>

        {/* Save Button */}
        <div className="flex justify-end gap-4 mt-6 pt-4 border-t border-gray-300">

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || saveSuccess}
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