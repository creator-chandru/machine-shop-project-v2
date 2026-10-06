import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FileDown, Plus, Trash2 } from 'lucide-react';
import Header from '../components/Header';

// ============================================================
// DEFAULT FALLBACK PART NAMES
// ============================================================

const fallbackPartNames = [
  "YNC ESP KNUCKLE LH U/P",
  "YNC ESP KNUCKLE RH U/P",
  "ARM, ASSY STRG INTERMEDIATE LH Y9T",
  "ARM, ASSY STRG INTERMEDIATE RH Y9T",
  "KNU-STRG-FR LH – (MY19)",
  "KNU-STRG-FR RH – (MY19)",
  "YTA KNUCKLE LH U/P",
  "YTA KNUCKLE RH U/P",
  "KNUCKLE STRG FR LH J92",
  "KNUCKLE STRG FR RH J92",
  "STR. KNUCKLE HOUSING LH (MPV)",
  "STR. KNUCKLE HOUSING RH (MPV)",
  "PIVOT SUSPENSION LH (78)",
  "PIVOT SUSPENSION RH (78)",
  "KNUCKLE STEERING LH Y1K U/P",
  "KNUCKLE STEERING RH Y1K U/P",
  "KNUCKLE STREEING LH YHB U/P",
  "KNUCKLE STREEING RH YHB U/P",
  "KNUCKLE STEERING LH (YG8) U/P",
  "KNUCKLE STEERING RH (YG8) U/P",
  "KNUCKLE,L FR SUBASSY(31XA)",
  "KNUCKLE,R FR SUBASSY(31XA)",
  "KNUCKLE LH 20M UNPAINTED",
  "KNUCKLE RH 20M UNPAINTED",
  "KNUCKLE ASSY STR. LH (Y9T) ABS U/P",
  "KNUCKLE ASSY STR. RH (Y9T) ABS U/P",
  "DIFFERENTIAL CASE YRA",
  "STEERING KNUCKLE LH CC21E",
  "STEERING KNUCKLE RH CC21E",
  "KNUCKLE STG. LH ABS PASSENGER (BOLERO ABS)",
  "KNUCKLE STG. RH ABS PASSENGER (BOLERO ABS)",
  "KNUCKLE STEERING LH (XD/YBA) U/P ABS",
  "KNUCKLE STEERING RH (XD/YBA) U/P ABS"
];

// ============================================================
// INITIAL FORM DATA
// ============================================================

const initialFormData = {
  formCode: "QF/08/MRO-04",
  revision: "03",
  revisionDate: "20.08.2024",
  title: "CORRECTIVE ACTION REGISTER",
  company: "SAKTHI AUTO",

  header: {
    date: new Date().toISOString().split('T')[0]
  },

  categoryLegend: [
    {
      code: "A",
      description:
        "More than 5 parts in same defect in a single day (Machining)"
    },
    {
      code: "B",
      description:
        "Repeated rejections"
    },
    {
      code: "C",
      description:
        "A single defect in Customer specified characteristics (Special / Critical / Safety Characteristics)"
    },
    {
      code: "D",
      description:
        "A single defect due to Crack and part broken."
    },
    {
      code: "E",
      description:
        "Any new defect occurred."
    }
  ]
};

// ============================================================
// TOAST
// ============================================================

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

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function CorrectiveActionRegister() {

  const { shopId } = useParams();
  const navigate = useNavigate();

  const actualShopId = shopId || '3';

  // ==========================================================
  // STATE
  // ==========================================================

  const [headerInfo, setHeaderInfo] = useState({
    ...initialFormData.header
  });

  const [partNameOptions, setPartNameOptions] =
    useState(fallbackPartNames);

  const [loadingPartNames, setLoadingPartNames] =
    useState(false);

  const [entries, setEntries] = useState([
    {
      date: new Date().toISOString().split('T')[0],
      partName: fallbackPartNames[0],
      problemDescription: "",
      problemCategory: "E",
      quantity: 1,
      rootCause: "",
      correctiveAction: "",
      result: "OK",
      signature: ""
    }
  ]);

  const [isSaving, setIsSaving] =
    useState(false);

  const [saveSuccess, setSaveSuccess] =
    useState(false);

  const [toast, setToast] =
    useState({
      message: '',
      type: ''
    });

  const [isSavedRecord, setIsSavedRecord] =
    useState(false);

  const lookupSeqRef = useRef(0);

  const currentUser =
    JSON.parse(localStorage.getItem('user'))?.username ||
    'Unknown';

  // ==========================================================
  // TOAST
  // ==========================================================

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

  // ==========================================================
  // FETCH PART NAMES
  // ==========================================================

  useEffect(() => {

    const fetchPartNames = async () => {

      try {

        setLoadingPartNames(true);

        const token =
          localStorage.getItem('token');

        const headers = token
          ? {
              Authorization:
                `Bearer ${token}`
            }
          : {};

        const res = await fetch(
          `${process.env.REACT_APP_API_URL || ""}/api/corrective-action-register/part-names/${actualShopId}`,
          {
            headers
          }
        );

        if (!res.ok) {
          console.warn(
            "Part names API failed:",
            res.status
          );

          return;
        }

        const contentType =
          res.headers.get("content-type");

        if (
          !contentType ||
          !contentType.includes("application/json")
        ) {
          console.warn(
            "Part names response is not JSON"
          );

          return;
        }

        const data =
          await res.json();

     

        // ------------------------------------------------------
        // HANDLE DIFFERENT BACKEND RESPONSE FORMATS
        // ------------------------------------------------------

        let receivedPartNames = [];

        if (Array.isArray(data)) {

          receivedPartNames = data;

        } else if (
          data &&
          Array.isArray(data.partNames)
        ) {

          receivedPartNames =
            data.partNames;

        } else if (
          data &&
          Array.isArray(data.data)
        ) {

          receivedPartNames =
            data.data;
        }

        // ------------------------------------------------------
        // CONVERT OBJECTS TO STRINGS
        //
        // Supports:
        // "ABC"
        //
        // AND:
        // { partName: "ABC" }
        // ------------------------------------------------------

        const cleanedPartNames =
          receivedPartNames
            .map((part) => {

              if (
                typeof part === 'string'
              ) {
                return part;
              }

              if (
                part &&
                typeof part === 'object' &&
                typeof part.partName === 'string'
              ) {
                return part.partName;
              }

              return null;
            })
            .filter(Boolean);

       

        if (
          cleanedPartNames.length > 0
        ) {

          setPartNameOptions(
            cleanedPartNames
          );

          // If the current first row contains an
          // old fallback value, keep it if possible.
          setEntries((prev) =>
            prev.map((entry) => {

              if (!entry.partName) {
                return {
                  ...entry,
                  partName:
                    cleanedPartNames[0]
                };
              }

              return entry;
            })
          );
        }

      } catch (err) {

        console.warn(
          'Part names fetch error, using fallback list:',
          err
        );

      } finally {

        setLoadingPartNames(false);
      }
    };

    fetchPartNames();

  }, [actualShopId]);

  // ==========================================================
  // FETCH EXISTING RECORD
  // ==========================================================

  useEffect(() => {

    const checkExistingRecord = async () => {

      if (!headerInfo.date) {
        return;
      }

      const seq =
        ++lookupSeqRef.current;

      try {

        const token =
          localStorage.getItem('token');

        const headers = token
          ? {
              Authorization:
                `Bearer ${token}`
            }
          : {};

        const params =
          new URLSearchParams({
            machineShop: actualShopId,
            date: headerInfo.date
          });

        const res = await fetch(
          `${process.env.REACT_APP_API_URL || ""}/api/corrective-action-register/record?${params.toString()}`,
          {
            headers
          }
        );

        if (
          seq !== lookupSeqRef.current
        ) {
          return;
        }

        if (!res.ok) {
          return;
        }

        const contentType =
          res.headers.get("content-type");

        if (
          !contentType ||
          !contentType.includes("application/json")
        ) {
          return;
        }

        const record =
          await res.json();

        if (
          seq !== lookupSeqRef.current
        ) {
          return;
        }

        if (
          record &&
          Array.isArray(record.entries) &&
          record.entries.length > 0
        ) {

          setIsSavedRecord(true);

          // --------------------------------------------------
          // ALSO NORMALIZE PART NAME OBJECTS IF RETURNED
          // --------------------------------------------------

          const normalizedEntries =
            record.entries.map((entry) => ({
              ...entry,

              partName:
                typeof entry.partName === 'object' &&
                entry.partName !== null
                  ? entry.partName.partName || ""
                  : entry.partName || "",

              signature:
                entry.signature ||
                entry.operatorSignature ||
                ""
            }));

          setEntries(
            normalizedEntries
          );

          triggerToast(
            "Existing register entries loaded for this date.",
            "success"
          );

        } else {

          setIsSavedRecord(false);
        }

      } catch (err) {

        console.warn(
          'Check existing record error:',
          err
        );
      }
    };

    checkExistingRecord();

  }, [
    actualShopId,
    headerInfo.date
  ]);

  // ==========================================================
  // ROW CHANGE
  // ==========================================================

  const handleRowChange = (
    index,
    field,
    val
  ) => {

    setEntries(prev => {

      const updated = [...prev];

      updated[index] = {
        ...updated[index],
        [field]: val
      };

      return updated;
    });
  };

  // ==========================================================
  // ADD ROW
  // ==========================================================

  const handleAddRow = () => {

    setEntries(prev => [

      ...prev,

      {
        date:
          headerInfo.date ||
          new Date()
            .toISOString()
            .split('T')[0],

        partName:
          partNameOptions.length > 0
            ? partNameOptions[0]
            : "",

        problemDescription: "",

        problemCategory: "E",

        quantity: 1,

        rootCause: "",

        correctiveAction: "",

        result: "OK",

        signature: ""
      }

    ]);
  };

  // ==========================================================
  // DELETE LAST ROW
  // ==========================================================

  const handleDeleteLastRow = () => {

    if (entries.length <= 1) {

      triggerToast(
        "Form must have at least one entry.",
        "error"
      );

      return;
    }

    setEntries(prev =>
      prev.slice(0, -1)
    );
  };

  // ==========================================================
  // APPROVE ROW
  // ==========================================================

  const handleApproveRowSignature = (
    index
  ) => {

    setEntries(prev => {

      const updated = [...prev];

      updated[index] = {
        ...updated[index],
        signature: currentUser
      };

      return updated;
    });

    triggerToast(
      `Row ${index + 1} signed by ${currentUser}`,
      "success"
    );
  };

  // ==========================================================
  // DOWNLOAD PDF
  // ==========================================================

  const handleDownloadPdf = async () => {

    if (!headerInfo.date) {

      triggerToast(
        "Please select a Date first.",
        "error"
      );

      return;
    }

    if (!isSavedRecord) {

      triggerToast(
        "No saved record found for this date. Save before downloading.",
        "error"
      );

      return;
    }

    try {

      const token =
        localStorage.getItem("token");

      const headers = token
        ? {
            Authorization:
              `Bearer ${token}`
          }
        : {};

      const params =
        new URLSearchParams({
          date: headerInfo.date,
          shopId: String(actualShopId)
        });

      const res = await fetch(
        `${process.env.REACT_APP_API_URL || ""}/api/corrective-action-register/report?${params.toString()}`,
        {
          headers
        }
      );

      if (!res.ok) {

        let errorMessage =
          "PDF report request failed";

        try {

          const errorData =
            await res.json();

          if (errorData.message) {
            errorMessage =
              errorData.message;
          }

        } catch {
          // Ignore JSON parsing error
        }

        throw new Error(
          errorMessage
        );
      }

      const blob =
        await res.blob();

      const blobUrl =
        URL.createObjectURL(blob);

      const link =
        document.createElement("a");

      link.href =
        blobUrl;

      link.download =
        `Corrective_Action_Register_${headerInfo.date}.pdf`;

      document.body.appendChild(link);

      link.click();

      document.body.removeChild(link);

      setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
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

  // ==========================================================
  // SAVE
  // ==========================================================

  const handleSave = async () => {

    // --------------------------------------------------------
    // VALIDATE
    // --------------------------------------------------------

    const emptyEntries =
      entries.some(
        e =>
          !e.partName ||
          !e.problemDescription ||
          !e.rootCause ||
          !e.correctiveAction
      );

    if (emptyEntries) {

      triggerToast(
        "Please select Part Name, and fill in Problem Description, Root Cause, and Corrective Action for all rows.",
        "error"
      );

      return;
    }

    const unsignedEntries =
      entries.some(
        e => !e.signature
      );

    if (unsignedEntries) {

      triggerToast(
        "Please sign all rows before saving.",
        "error"
      );

      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);

    // --------------------------------------------------------
    // NORMALIZE ENTRIES BEFORE SENDING
    // --------------------------------------------------------

    const cleanEntries =
      entries.map((entry) => ({

        date:
          entry.date ||
          headerInfo.date,

        partName:
          typeof entry.partName === 'object' &&
          entry.partName !== null
            ? entry.partName.partName || ""
            : entry.partName || "",

        problemDescription:
          entry.problemDescription || "",

        problemCategory:
          entry.problemCategory || "E",

        quantity:
          entry.quantity === "" ||
          entry.quantity === null ||
          entry.quantity === undefined
            ? 1
            : Number(entry.quantity),

        rootCause:
          entry.rootCause || "",

        correctiveAction:
          entry.correctiveAction || "",

        result:
          entry.result || "OK",

        signature:
          entry.signature || "",

        // Backend can use these if needed
        operatorSignature:
          entry.operatorSignature ||
          entry.signature ||
          "",

        shiftInchargeSignature:
          entry.shiftInchargeSignature ||
          null

      }));

    // --------------------------------------------------------
    // PAYLOAD
    //
    // IMPORTANT:
    // Backend expects machineShop + recordDate + entries
    // --------------------------------------------------------

    const payload = {

      machineShop:
        Number(actualShopId),

      lineCode:
        null,

      recordDate:
        headerInfo.date,

      entries:
        cleanEntries,

      formCode:
        initialFormData.formCode,

      revision:
        initialFormData.revision,

      revisionDate:
        initialFormData.revisionDate
    };

  
  

    try {

      const token =
        localStorage.getItem('token');

      const headers = {

        'Content-Type':
          'application/json',

        ...(token
          ? {
              Authorization:
                `Bearer ${token}`
            }
          : {})
      };

      const res =
        await fetch(
          `${process.env.REACT_APP_API_URL || ""}/api/corrective-action-register`,
          {
            method: 'POST',
            headers,
            body:
              JSON.stringify(payload)
          }
        );

      // ------------------------------------------------------
      // READ SERVER RESPONSE
      // ------------------------------------------------------

      let responseData = null;

      try {

        responseData =
          await res.json();

      } catch {
        responseData = null;
      }

     

      if (!res.ok) {

        throw new Error(
          responseData?.message ||
          responseData?.error ||
          `Save failed (${res.status})`
        );
      }

      // ------------------------------------------------------
      // SUCCESS
      // ------------------------------------------------------

      setIsSavedRecord(true);

      setSaveSuccess(true);

      triggerToast(
        "Corrective Action Register saved successfully!",
        "success"
      );

      await new Promise(
        resolve =>
          setTimeout(
            resolve,
            1500
          )
      );

      navigate(
        `/operator/${actualShopId}/dashboard`
      );

    } catch (err) {

      console.error(
        'Save error:',
        err
      );

      triggerToast(
        err.message ||
        'Failed to save register.',
        'error'
      );

    } finally {

      setIsSaving(false);
    }
  };

  // ==========================================================
  // JSX
  // ==========================================================

  return (

    <div className="min-h-screen bg-[#2d2d2d] flex flex-col items-center justify-center p-6 pb-20">

      <Header />

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

      {(isSaving || saveSuccess) && (

        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">

          <div className="bg-white rounded-xl shadow-2xl px-10 py-8 text-center">

            {isSaving ? (

              <>
                <div className="w-10 h-10 border-4 border-gray-300 border-t-orange-500 rounded-full animate-spin mx-auto mb-5"></div>

                <h2 className="text-xl font-bold text-gray-800">
                  Saving Register Data...
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

      <div className="bg-white w-full max-w-[95rem] rounded-xl p-8 shadow-2xl overflow-x-auto border-4 border-gray-100">

        {/* ====================================================
            HEADER
        ==================================================== */}

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
                Rev No: {initialFormData.revision}
              </span>

              |

              <span>
                Rev Date: {initialFormData.revisionDate}
              </span>

            </div>

          </div>

          <button
            type="button"
            onClick={handleDownloadPdf}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider shadow transition-colors cursor-pointer"
          >
            <FileDown className="w-4 h-4" />
            Download PDF
          </button>

        </div>

        {/* ====================================================
            CONTROLS
        ==================================================== */}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6">

          <div>

            <label className="font-bold text-gray-700 block mb-1 text-sm">
              Date
            </label>

            <input
              type="date"
              className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm font-semibold bg-white"
              value={headerInfo.date}
              onChange={(e) =>
                setHeaderInfo(prev => ({
                  ...prev,
                  date: e.target.value
                }))
              }
            />

          </div>

          {/* ROW MANAGEMENT */}

          <div className="flex items-end gap-2 col-span-1 md:col-span-2">

            <button
              type="button"
              onClick={handleAddRow}
              className="flex-1 flex items-center justify-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-3 rounded text-xs transition-colors uppercase tracking-wider cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Row
            </button>

            <button
              type="button"
              onClick={handleDeleteLastRow}
              className="flex-1 flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-3 rounded text-xs transition-colors uppercase tracking-wider cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Row
            </button>

          </div>

        </div>

        {/* ====================================================
            TABLE
        ==================================================== */}

        <div className="overflow-x-auto">

          <table className="w-full border-collapse border border-gray-800 text-xs text-center">

            <thead className="bg-gray-100 text-gray-800 font-bold">

              <tr>

                <th className="border border-gray-800 p-2 w-28">
                  DATE
                </th>

                <th className="border border-gray-800 p-2 text-left px-3 min-w-[220px]">
                  PART NAME
                </th>

                <th className="border border-gray-800 p-2 text-left px-3 min-w-[180px]">
                  PROBLEM DESCRIPTION
                </th>

                <th className="border border-gray-800 p-2 w-28">
                  PROBLEM CATEGORY (A/B/C/D/E)
                </th>

                <th className="border border-gray-800 p-2 w-20">
                  QUANTITY
                </th>

                <th className="border border-gray-800 p-2 text-left px-3 min-w-[190px]">
                  ROOT CAUSE
                </th>

                <th className="border border-gray-800 p-2 text-left px-3 min-w-[190px]">
                  CORRECTIVE ACTION
                </th>

                <th className="border border-gray-800 p-2 w-20">
                  RESULT
                </th>

                <th className="border border-gray-800 p-2 w-28">
                  SIGNATURE
                </th>

              </tr>

            </thead>

            <tbody>

              {entries.map((row, idx) => (

                <tr
                  key={`entry-${idx}`}
                  className="hover:bg-gray-50"
                >

                  {/* DATE */}

                  <td className="border border-gray-800 p-1">

                    <input
                      type="date"
                      className="w-full text-center bg-transparent outline-none p-1 font-medium"
                      value={row.date || ''}
                      onChange={(e) =>
                        handleRowChange(
                          idx,
                          'date',
                          e.target.value
                        )
                      }
                    />

                  </td>

                  {/* =================================================
                      PART NAME
                      FIXED: ALWAYS RENDER STRING
                  ================================================= */}

                  <td className="border border-gray-800 p-1">

                    <select
                      className="w-full text-left px-2 bg-transparent outline-none p-1 font-semibold uppercase cursor-pointer"
                      value={
                        typeof row.partName === 'object'
                          ? row.partName?.partName || ''
                          : row.partName || ''
                      }
                      onChange={(e) =>
                        handleRowChange(
                          idx,
                          'partName',
                          e.target.value
                        )
                      }
                    >

                      <option value="">
                        Select Part Name
                      </option>

                      {partNameOptions.map(
                        (part, pIdx) => {

                          // ------------------------------------------
                          // Convert backend object -> string
                          // ------------------------------------------

                          const partName =
                            typeof part === 'object' &&
                            part !== null
                              ? part.partName || ''
                              : String(part);

                          if (!partName) {
                            return null;
                          }

                          return (

                            <option
                              key={`${partName}-${pIdx}`}
                              value={partName}
                            >
                              {partName}
                            </option>

                          );
                        }
                      )}

                    </select>

                    {loadingPartNames && (

                      <div className="text-[9px] text-gray-400 mt-1">
                        Loading part names...
                      </div>

                    )}

                  </td>

                  {/* PROBLEM DESCRIPTION */}

                  <td className="border border-gray-800 p-1">

                    <textarea
                      rows={2}
                      placeholder="Describe problem"
                      className="w-full text-left px-2 bg-transparent outline-none p-1 resize-y uppercase"
                      value={
                        row.problemDescription || ''
                      }
                      onChange={(e) =>
                        handleRowChange(
                          idx,
                          'problemDescription',
                          e.target.value
                        )
                      }
                    />

                  </td>

                  {/* CATEGORY */}

                  <td className="border border-gray-800 p-1">

                    <select
                      className="w-full text-center bg-transparent outline-none p-1 font-bold cursor-pointer"
                      value={
                        row.problemCategory || "E"
                      }
                      onChange={(e) =>
                        handleRowChange(
                          idx,
                          'problemCategory',
                          e.target.value
                        )
                      }
                    >

                      <option value="A">A</option>
                      <option value="B">B</option>
                      <option value="C">C</option>
                      <option value="D">D</option>
                      <option value="E">E</option>

                    </select>

                  </td>

                  {/* QUANTITY */}

                  <td className="border border-gray-800 p-1">

                    <input
                      type="number"
                      min={1}
                      className="w-full text-center bg-transparent outline-none p-1 font-medium"
                      value={
                        row.quantity ?? 1
                      }
                      onChange={(e) =>
                        handleRowChange(
                          idx,
                          'quantity',
                          parseInt(
                            e.target.value,
                            10
                          ) || 1
                        )
                      }
                    />

                  </td>

                  {/* ROOT CAUSE */}

                  <td className="border border-gray-800 p-1">

                    <textarea
                      rows={2}
                      placeholder="Enter root cause"
                      className="w-full text-left px-2 bg-transparent outline-none p-1 resize-y uppercase"
                      value={
                        row.rootCause || ''
                      }
                      onChange={(e) =>
                        handleRowChange(
                          idx,
                          'rootCause',
                          e.target.value
                        )
                      }
                    />

                  </td>

                  {/* CORRECTIVE ACTION */}

                  <td className="border border-gray-800 p-1">

                    <textarea
                      rows={2}
                      placeholder="Enter corrective action"
                      className="w-full text-left px-2 bg-transparent outline-none p-1 resize-y uppercase"
                      value={
                        row.correctiveAction || ''
                      }
                      onChange={(e) =>
                        handleRowChange(
                          idx,
                          'correctiveAction',
                          e.target.value
                        )
                      }
                    />

                  </td>

                  {/* RESULT */}

                  <td className="border border-gray-800 p-1">

                    <select
                      className="w-full text-center bg-transparent outline-none p-1 font-bold cursor-pointer"
                      value={
                        row.result || "OK"
                      }
                      onChange={(e) =>
                        handleRowChange(
                          idx,
                          'result',
                          e.target.value
                        )
                      }
                    >

                      <option value="OK">
                        OK
                      </option>

                      <option value="NOT OK">
                        NOT OK
                      </option>

                    </select>

                  </td>

                  {/* SIGNATURE */}

                  <td className="border border-gray-800 p-1 text-center bg-gray-50/30">

                    {row.signature ? (

                      <div className="flex flex-col items-center justify-center animate-in fade-in duration-200">

                        <span className="text-[10px] font-bold text-green-600 leading-tight">
                          Approved ✓
                        </span>

                        <span
                          className="text-xs font-extrabold text-gray-900 uppercase truncate max-w-[90px]"
                          title={row.signature}
                        >
                          {row.signature}
                        </span>

                      </div>

                    ) : (

                      <button
                        type="button"
                        onClick={() =>
                          handleApproveRowSignature(idx)
                        }
                        className="bg-orange-500 hover:bg-orange-600 text-white text-[11px] font-bold px-3 py-1 rounded shadow transition-all hover:scale-105 uppercase tracking-wider cursor-pointer"
                      >
                        Approve
                      </button>

                    )}

                  </td>

                </tr>

              ))}

            </tbody>

          </table>

        </div>

        {/* ====================================================
            NOTES / LEGEND
        ==================================================== */}

        <div className="border-2 border-gray-800 flex flex-col mt-6">

          <div className="px-3 py-1.5 font-bold text-gray-800 text-xs border-b border-gray-800 bg-gray-100">

            Note: The Problem Category to be mentioned as A or B or C or D or E

          </div>

          <div className="p-3 text-xs text-gray-700 space-y-1.5 bg-white font-medium">

            {initialFormData.categoryLegend.map(
              item => (

                <div
                  key={item.code}
                  className="flex gap-2"
                >

                  <span className="font-bold text-gray-900 w-6">
                    {item.code} -
                  </span>

                  <span>
                    {item.description}
                  </span>

                </div>

              )
            )}

          </div>

        </div>

        {/* ====================================================
            SAVE BUTTON
        ==================================================== */}

        <div className="flex justify-end gap-4 mt-6 pt-4 border-t border-gray-300">

          <button
            type="button"
            onClick={handleSave}
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