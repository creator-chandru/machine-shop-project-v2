import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLineSet } from '../context/LineSetContext';

const initialFormData = {
  formCode: "QF/07/MPD-13",
  revision: "12",
  revisionDate: "31.01.2025",
  title: "CHECK LIST FOR PRE OPERATION AND PROCESS PARAMETERS",
  company: "SAKTHI AUTO",

  header: {
    lineCode: "",
    partName: "",
    partNo: "",
    machineNo: "",
    opNo: "",
    date: ""
  },

  parameters: [
    {
      slNo: 1,
      label: "System pressure",
      unit: "KGF/CM2",
      specification: "",
      specEditable: true,
      checkMethod: "PRESSURE GAUGE",
      hasSubRows: false
    },
    {
      slNo: 2,
      label: "Clamping pressure",
      unit: "KGF/CM2",
      specification: "",
      specEditable: true,
      checkMethod: "PRESSURE GAUGE",
      hasSubRows: false
    },
    {
      slNo: 3,
      label: "Orientation pressure",
      unit: "KGF/CM2",
      specification: "",
      specEditable: true,
      checkMethod: "PRESSURE GAUGE",
      hasSubRows: false
    },
    {
      slNo: 4,
      label: "PROGRAM NO",
      unit: "",
      specification: "",
      specEditable: true,
      checkMethod: "VISUAL",
      hasSubRows: false
    },
    {
      slNo: 5,
      label: "Hydraulic oil level",
      unit: "",
      note: "[Above the minimum level]",
      specification: "",
      specEditable: false,
      checkMethod: "LEVEL INDICATOR",
      hasSubRows: true,
      subRows: ["BEFORE", "AFTER"]
    },
    {
      slNo: 6,
      label: "Coolant oil level",
      unit: "",
      note: "[Above the minimum level]",
      specification: "",
      specEditable: false,
      checkMethod: "LEVEL INDICATOR",
      hasSubRows: true,
      subRows: ["BEFORE", "AFTER"]
    },
    {
      slNo: 7,
      label: "Lub oil Level",
      unit: "",
      note: "[Above the minimum level]",
      specification: "",
      specEditable: false,
      checkMethod: "LEVEL INDICATOR",
      hasSubRows: true,
      subRows: ["BEFORE", "AFTER"]
    },
    {
      slNo: 8,
      label: "Coolant oil ratio",
      unit: "",
      specification: "[3 TO 5]",
      specEditable: false,
      checkMethod: "REFRACTO METER",
      hasSubRows: true,
      subRows: ["BEFORE", "AFTER"]
    },
    {
      slNo: 9,
      label: "Air pressure Level",
      unit: "",
      specification: "MINIMUM 4 BAR",
      specEditable: false,
      checkMethod: "PRESSURE GAUGE",
      hasSubRows: false
    },
    {
      slNo: 10,
      label: "Fixture Condition",
      unit: "",
      specification:
        "Check - Dent, Damage, Orientation, Clamp & nut screw not to be in loose condition.",
      specEditable: false,
      checkMethod: "VISUAL",
      hasSubRows: false
    },
    {
      slNo: 11,
      label: "Andon Tower Lamp Condition",
      unit: "",
      specification:
        "Free from damage & Check indication light working condition",
      specEditable: false,
      checkMethod: "VISUAL",
      hasSubRows: false
    },
    {
      slNo: 12,
      label:
        "Double Hand switches, Limit switches, Safety sensors",
      unit: "",
      specification: "Good Working condition",
      specEditable: false,
      checkMethod: "Operate",
      hasSubRows: false
    }
  ],

  signatures: {
    roles: ["Operator", "Shift Incharge"]
  },

  notes: [
    "Coolant TOP UP should be done ONLY in Ist shift. If there is any abnormalities or special requirement for coolant Top-up during OTHER SHIFTS, COOLANT COULD be Topped-up with proper approval and should be recorded in the respective LINE's LOG NOTE. After top-up, the coolant tank cover should be in closed condition.",
    "If any of the OIL Level is observed MINIMUM, then TOP UP the oil upto MIDDLE Level in the machine.",
    "If Coolant ratio is found to be less, add more. If the ratio is high, add more water for the ration 1:20.",
    "If Orientation is not available in the fixture, then mark NA.",
    "USE THE FOLLOWING ABBREVIATIONS: MIN - Minimum, MID - Middle, MAX - Maximum, NA - Not Applicable, NP - No Production",
    "During set-up change, the pre-operation and process parameters should be verified and recorded."
  ]
};


export default function PreOperationChecklist() {

  const { shopId } = useParams();
  const navigate = useNavigate();
  const {
    lineSet,
    setLineSet,
    clearLineSet,
    isLineSetComplete
  } = useLineSet();
  const [headerInfo, setHeaderInfo] =
    useState({ ...initialFormData.header});

  const [values, setValues] =
    useState({});

  const [signatures, setSignatures] =
    useState({});

  const [specifications, setSpecifications] =
    useState({});

    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);


  // ==========================================================
  // MACHINE SHOP 3 DATA
  // ==========================================================

  const [machineDetails, setMachineDetails] =
    useState([]);

  const [loadingMachineDetails, setLoadingMachineDetails] =
    useState(true);


  // ==========================================================
  // FETCH MACHINE SHOP 3 DATA
  // ==========================================================

  useEffect(() => {

    const fetchMachineDetails = async () => {

      try {
        if(shopId !=="3"){
          setMachineDetails([]);
          return;
        }

        const token = localStorage.getItem('token');
        const res = await fetch(
          'http://localhost:5000/api/machine-shop/3/pre-operation-details',
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );
        if (!res.ok) {
          throw new Error(
            'Failed to fetch Machine Shop 3 details'
          );
        }

        const data = await res.json();

        setMachineDetails(data);

      } catch (err) {
        console.error(
          'Machine details fetch error:',
          err
        );
        alert(
          'Failed to load Machine Shop 3 details.'
        );
      } finally {

        setLoadingMachineDetails(false);
      }
    };
    fetchMachineDetails();
  }, [shopId]);
// ==========================================================
// SYNC SHARED LINE SET
// ==========================================================

useEffect(() => {
  setHeaderInfo((prev) => ({
    ...prev,

    lineCode: lineSet?.lineCode || "",
    partName: lineSet?.partName || "",
    partNo: lineSet?.partNo || "",
    machineNo: lineSet?.machineNo || ""
  }));

}, [lineSet]);

  // ==========================================================
  // LINE CODE OPTIONS
  // ==========================================================

  const lineCodes = [
    ...new Set(
      machineDetails
        .map((item) => item.lineCode)
        .filter(Boolean)
    )
  ];


  // ==========================================================
  // SELECTED LINE DETAILS
  // ==========================================================

  const selectedLineDetails =
    machineDetails.filter(
      (item) =>
        item.lineCode === headerInfo.lineCode
    );


  // ==========================================================
  // PART OPTIONS
  // ==========================================================

  const partOptions = [
    ...new Map(
      selectedLineDetails
        .filter((item) => item.partNo)
        .map((item) => [
          item.partNo,
          {
            partNo: item.partNo,
            partName: item.partName || ""
          }
        ])
    ).values()
  ];


  // ==========================================================
  // SELECTED PART DETAILS
  // ==========================================================

  const selectedPartDetails =
    machineDetails.filter(
      (item) =>
        item.lineCode === headerInfo.lineCode &&
        (item.partNo || '') === headerInfo.partNo
    );
  const selectedPartMaster = selectedPartDetails[0] || null;


  // ==========================================================
  // MACHINE OPTIONS
  // ==========================================================

  const machineOptions =
    selectedPartDetails;


  // ==========================================================
  // HEADER CHANGE
  // ==========================================================

  const handleHeaderChange = (field, val) => {

    setHeaderInfo((prev) => ({

      ...prev,

      [field]: val

    }));
  };

// ==========================================================
// LINE SET HANDLERS
// ==========================================================

const handleLineChange = (lineCode) => {

  setLineSet({
    machineShop: shopId,
    lineCode,
    partName: "",
    partNo: "",
    machineNo: ""
  });

};

const handlePartNoChange = (partNo) => {
  const selectedPart =
    machineDetails.find(
      (item) =>
        item.lineCode === headerInfo.lineCode &&
        (item.partNo || "") === partNo
    );

  setLineSet({

    machineShop: shopId,

    lineCode:
      headerInfo.lineCode,

    partName:
      selectedPart?.partName || "",

    partNo,

    machineNo: ""
  });
};

const handleMachineChange = (machineNo) => {
  setLineSet({

    machineShop: shopId,

    lineCode:
      headerInfo.lineCode,

    partName:
      selectedPartMaster?.partName || "",

    partNo:
      headerInfo.partNo,

    machineNo
  });

};


const handleChangeLine = () => {
  clearLineSet();
};


  // ==========================================================
  // SPECIFICATION CHANGE
  // ==========================================================

  const handleSpecificationChange = (
    slNo,
    val
  ) => {

    setSpecifications((prev) => ({
      ...prev,
      [slNo]: val
    }));
  };


  // ==========================================================
  // VALUE CHANGE
  // ==========================================================

  const handleValueChange = (
    slNo,
    subRow,
    val
  ) => {

    setValues((prev) => {

      if (subRow) {

        const paramValues =
          prev[slNo] || {};


        return {

          ...prev,

          [slNo]: {

            ...paramValues,

            [subRow]: val

          }

        };
      }


      return {

        ...prev,

        [slNo]: val

      };
    });
  };


  // ==========================================================
  // SIGNATURE CHANGE
  // ==========================================================

  const handleSignatureChange = (
    role,
    val
  ) => {

    setSignatures((prev) => ({

      ...prev,

      [role]: val

    }));
  };


  // ==========================================================
  // SAVE
  // ==========================================================

  const handleSave = async () => {

    if (!isLineSetComplete) {
      alert("Please select Line code, Part No and Machine No before saving.");
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);

    const payload = {
      header: {
        ...headerInfo,
        machineShop: shopId,
        lineCode: lineSet.lineCode,
        partName: lineSet.partName,
        partNo: lineSet.partNo,
        machineNo: lineSet.machineNo
      },

      lineSet: {
        machineShop: lineSet.machineShop,
        lineCode: lineSet.lineCode,
        partName: lineSet.partName,
        partNo: lineSet.partNo,
        machineNo: lineSet.machineNo
      },

      values,
      signatures,
      specifications,
      parameters: initialFormData.parameters
    };

    try {

      const token = localStorage.getItem('token');
      const res = await fetch(
        'http://localhost:5000/api/pre-operation-checklist',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization' : `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        }
      );

      if (!res.ok) {
        throw new Error('Save failed');
      }

      const data = await res.json();

      // Update LineSetContext with the latest selection
      setLineSet({
        machineShop: shopId,
        lineCode: headerInfo.lineCode,
        partName: headerInfo.partName,
        partNo: headerInfo.partNo,
        machineNo: headerInfo.machineNo
      });

      // Hide "Saving..."
      setIsSaving(false);

      // Show success message
      setSaveSuccess(true);

      // Keep success message visible for 3 seconds
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Go to Form 2
      navigate(`/operator/${shopId}/error-proofing-checksheet`);

    } catch (err) {

      console.error('Save error:', err);

      setIsSaving(false);

      alert(
        'Failed to save checklist. Check console for details.'
      );
    }
  };


  return (

    <div className="min-h-screen bg-[#2d2d2d] flex flex-col items-center justify-center p-6 pb-20">
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


        {/* =====================================================
            CARD HEADER
        ====================================================== */}

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
                {' '}
                {initialFormData.formCode}
              </span>

              <span>|</span>

              <span>
                Revision:
                {' '}
                {initialFormData.revision}
              </span>

              <span>|</span>

              <span>
                Revision Date:
                {' '}
                {initialFormData.revisionDate}
              </span>

            </div>

          </div>

        </div>


        {/* =====================================================
            HEADER META FIELDS
        ====================================================== */}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">


          {/* ===================================================
              LINE CODE
          ==================================================== */}

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

              value={
                headerInfo.lineCode
              }


              onChange={(e) => handleLineChange(e.target.value)}

              disabled={loadingMachineDetails}

            >

              <option value="">

                {
                  loadingMachineDetails
                    ? "Loading..."
                    : "Select Line Code"
                }

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

          </div>

          {/* ===================================================
              PART NO
          ==================================================== */}

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
              value={
                headerInfo.partNo
              }

              onChange={(e) =>
                handlePartNoChange(e.target.value)
              }


              disabled={!headerInfo.lineCode}

            >

              <option value="">
                Select Part No
              </option>
              {partOptions
                .map(
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

          </div>

          {/* ===================================================
              PART NAME
          ==================================================== */}

          <div>

            <label
              htmlFor="header-partName"
              className="font-bold text-gray-700 block mb-1 text-sm"
            >
              Part Name
            </label>

            <input 
              id = "header-partName"
              type= "text"
              readOnly
              className = "w-full border border-gray-300 p-2 rounded text-sm font-semibold bg-gray-100"
              value = {headerInfo.partName || ""}
              placeholder = "Auto-filled"
              />

          </div>

          {/* ===================================================
              MACHINE NO
          ==================================================== */}

          <div>

            <label
              htmlFor="header-machineNo"
              className="font-bold text-gray-700 block mb-1 text-sm"
            >
              Machine No
            </label>


            <select
              id="header-machineNo"
              className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm font-semibold bg-white"
              value={
                headerInfo.machineNo
              }

              onChange={(e) => {
                handleMachineChange(e.target.value);
              }}


              disabled={
                !headerInfo.lineCode ||
                !headerInfo.partNo
              }

            >

              <option value="">
                Select Machine
              </option>


              {machineOptions.map(
                (machine) => (

                  <option

                    key={
                      machine.id
                    }

                    value={
                      machine.machineNo
                    }

                  >

                    {machine.machineNo}

                    {
                      machine.machineType
                        ? ` - ${machine.machineType}`
                        : ""
                    }

                  </option>

                )
              )}

            </select>

          </div>


          {/* ===================================================
              OP NO
          ==================================================== */}

          <div>

            <label
              htmlFor="header-opNo"
              className="font-bold text-gray-700 block mb-1 text-sm"
            >
              OP No
            </label>


            <input

              id="header-opNo"

              type="text"

              className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm font-semibold bg-white"

              value={
                headerInfo.opNo
              }

              onChange={(e) =>
                handleHeaderChange(
                  'opNo',
                  e.target.value
                )
              }

            />

          </div>


          {/* ===================================================
              DATE
          ==================================================== */}

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

              value={
                headerInfo.date
              }

              onChange={(e) =>
                handleHeaderChange(
                  'date',
                  e.target.value
                )
              }

            />

          </div>
        </div>

        {/* =====================================================
            LINE SET STATUS
        ====================================================== */}

        <div className="
          flex flex-wrap items-center justify-between
          gap-3 mb-6 p-3 rounded-lg
          bg-orange-50 border border-orange-200
        ">

          <div className="text-sm text-gray-700">

            <span className="font-bold">
              Selected Line Set:
            </span>

            {" "}

            {headerInfo.lineCode || "Not selected"}

            {headerInfo.partNo
              ? ` / ${headerInfo.partNo}`
              : ""}

            {headerInfo.machineNo
              ? ` / ${headerInfo.machineNo}`
              : ""}

          </div>


          {isLineSetComplete && (

            <button
              type="button"
              onClick={handleChangeLine}
              className="
                bg-gray-800 hover:bg-gray-700
                text-white px-4 py-2 rounded
                font-bold text-sm
                transition-colors
              "
            >
              Change Line
            </button>

          )}

        </div>


        {/* =====================================================
            MAIN TABLE
        ====================================================== */}

        <div className="overflow-x-auto">

          <table className="w-full border-collapse border border-gray-800 text-sm text-center">

            <thead className="bg-gray-100 text-gray-800 font-bold">

              <tr>

                <th className="border border-gray-800 p-2 w-16">
                  Sl No
                </th>

                <th className="border border-gray-800 p-2 text-left px-3">
                  Parameters
                </th>

                <th className="border border-gray-800 p-2 text-left px-3">
                  Specification
                </th>

                <th className="border border-gray-800 p-2 w-28">
                  Unit
                </th>

                <th className="border border-gray-800 p-2 w-36">
                  Check Method
                </th>

                <th className="border border-gray-800 p-2 w-24">
                  Condition
                </th>

                <th className="border border-gray-800 p-2 w-48">
                  Value
                </th>

              </tr>

            </thead>
            <tbody>

              {initialFormData.parameters.map(
                (param) => {

                  if (param.hasSubRows) {

                    return (

                      <React.Fragment
                        key={`param-${param.slNo}`}
                      >

                        {param.subRows.map(
                          (
                            subRow,
                            subIdx
                          ) => {

                            const cellValue =
                              values[param.slNo]?.[
                                subRow
                              ] || '';


                            return (

                              <tr
                                key={
                                  `param-${param.slNo}-${subRow}`
                                }
                              >

                                {subIdx === 0 && (

                                  <>

                                    <td
                                      rowSpan={
                                        param.subRows.length
                                      }
                                      className="border border-gray-800 p-2 font-medium"
                                    >
                                      {param.slNo}
                                    </td>


                                    <td
                                      rowSpan={
                                        param.subRows.length
                                      }
                                      className="border border-gray-800 p-2 text-left px-3"
                                    >

                                      <span className="font-medium">
                                        {param.label}
                                      </span>


                                      {param.note && (

                                        <span className="text-xs text-gray-500 block mt-0.5">
                                          {param.note}
                                        </span>

                                      )}

                                    </td>


                                    <td
                                      rowSpan={
                                        param.subRows.length
                                      }
                                      className="border border-gray-800 p-2 text-left px-3 text-gray-700"
                                    >

                                      {param.specEditable ? (

                                        <input

                                          type="text"

                                          className="w-full h-full text-center outline-none bg-transparent py-1"

                                          value={
                                            specifications[
                                              param.slNo
                                            ] || ''
                                          }

                                          onChange={(e) =>
                                            handleSpecificationChange(
                                              param.slNo,
                                              e.target.value
                                            )
                                          }

                                          placeholder="Enter spec"

                                        />

                                      ) : (

                                        param.specification ||
                                        '-'

                                      )}

                                    </td>


                                    <td
                                      rowSpan={
                                        param.subRows.length
                                      }
                                      className="border border-gray-800 p-2 text-gray-700"
                                    >
                                      {param.unit || '-'}
                                    </td>


                                    <td
                                      rowSpan={
                                        param.subRows.length
                                      }
                                      className="border border-gray-800 p-2 text-gray-700"
                                    >
                                      {param.checkMethod}
                                    </td>

                                  </>

                                )}


                                <td className="border border-gray-800 p-2 bg-gray-50 font-semibold text-gray-600">
                                  {subRow}
                                </td>


                                <td className="border border-gray-800 p-0">

                                  {[5, 6, 7].includes(param.slNo) ? (

                                    <select

                                      className="w-full h-full text-center outline-none bg-transparent py-2 cursor-pointer"

                                      aria-label={
                                        `${param.label} ${subRow} Value`
                                      }

                                      value={
                                        cellValue
                                      }

                                      onChange={(e) =>
                                        handleValueChange(
                                          param.slNo,
                                          subRow,
                                          e.target.value
                                        )
                                      }

                                    >

                                      <option value=""></option>

                                      <option value="MIN">MIN</option>

                                      <option value="MID">MID</option>

                                      <option value="MAX">MAX</option>

                                    </select>

                                  ) : (

                                    <input

                                      type="text"

                                      className="w-full h-full text-center outline-none bg-transparent py-2"

                                      aria-label={
                                        `${param.label} ${subRow} Value`
                                      }

                                      value={
                                        cellValue
                                      }

                                      onChange={(e) =>
                                        handleValueChange(
                                          param.slNo,
                                          subRow,
                                          e.target.value
                                        )
                                      }

                                    />

                                  )}

                                </td>

                              </tr>

                            );
                          }
                        )}

                      </React.Fragment>

                    );
                  }


                  const cellValue =
                    values[param.slNo] || '';


                  return (

                    <tr
                      key={`param-${param.slNo}`}
                    >

                      <td className="border border-gray-800 p-2 font-medium">
                        {param.slNo}
                      </td>


                      <td className="border border-gray-800 p-2 text-left px-3">

                        <span className="font-medium">
                          {param.label}
                        </span>


                        {param.note && (

                          <span className="text-xs text-gray-500 block mt-0.5">
                            {param.note}
                          </span>

                        )}

                      </td>


                      <td className="border border-gray-800 p-2 text-left px-3 text-gray-700">

                        {param.specEditable ? (

                          <input

                            type="text"

                            className="w-full h-full text-center outline-none bg-transparent py-1"

                            value={
                              specifications[
                                param.slNo
                              ] || ''
                            }

                            onChange={(e) =>
                              handleSpecificationChange(
                                param.slNo,
                                e.target.value
                              )
                            }

                            placeholder="Enter spec"

                          />

                        ) : (

                          param.specification ||
                          '-'

                        )}

                      </td>


                      <td className="border border-gray-800 p-2 text-gray-700">
                        {param.unit || '-'}
                      </td>


                      <td className="border border-gray-800 p-2 text-gray-700">
                        {param.checkMethod}
                      </td>


                      <td className="border border-gray-800 p-2 text-gray-400">
                        -
                      </td>


                      <td className="border border-gray-800 p-0">

                        {[4, 10, 11, 12].includes(param.slNo) ? (

                          <select

                            className="w-full h-full text-center outline-none bg-transparent py-2 cursor-pointer"

                            aria-label={
                              `${param.label} Value`
                            }

                            value={
                              cellValue
                            }

                            onChange={(e) =>
                              handleValueChange(
                                param.slNo,
                                null,
                                e.target.value
                              )
                            }

                          >

                            <option value=""></option>

                            <option value="OK">OK</option>

                            <option value="NOT OK">NOT OK</option>

                          </select>

                        ) : (

                          <input

                            type="text"

                            className="w-full h-full text-center outline-none bg-transparent py-2"

                            aria-label={
                              `${param.label} Value`
                            }

                            value={
                              cellValue
                            }

                            onChange={(e) =>
                              handleValueChange(
                                param.slNo,
                                null,
                                e.target.value
                              )
                            }

                          />

                        )}

                      </td>

                    </tr>

                  );

                }

              )}


              {/* =================================================
                  SIGNATURE ROWS
              ================================================== */}

              {initialFormData.signatures.roles.map(
                (role) => (

                  <tr
                    key={`sig-${role}`}
                  >

                    <td
                      colSpan={6}
                      className="border border-gray-800 p-2 text-left px-3 font-bold bg-gray-50 text-gray-700"
                    >
                      {role} Signature
                    </td>


                    <td className="border border-gray-800 p-0">

                      <input

                        type="text"

                        className="w-full h-full text-center outline-none bg-transparent py-2 font-medium"

                        aria-label={
                          `${role} Signature`
                        }

                        value={
                          signatures[role] ||
                          ''
                        }

                        onChange={(e) =>
                          handleSignatureChange(
                            role,
                            e.target.value
                          )
                        }

                      />

                    </td>

                  </tr>

                )
              )}

            </tbody>

          </table>

        </div>


        {/* =====================================================
            NOTES
        ====================================================== */}

        <div className="border-2 border-gray-800 flex flex-col mt-4">

          <div className="px-2 py-1 font-bold text-gray-800 text-sm border-b border-gray-800 bg-gray-100">
            Notes / Instructions:
          </div>


          <ol className="list-decimal list-inside p-3 text-xs text-gray-700 space-y-1.5 leading-relaxed bg-white">

            {initialFormData.notes.map(
              (note, idx) => (

                <li
                  key={`note-${idx}`}
                >
                  {note}
                </li>

              )
            )}

          </ol>

        </div>


        {/* =====================================================
            SAVE BUTTON
        ====================================================== */}

        <div className="flex justify-end gap-4 mt-6 pt-4 border-t border-gray-300">

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || saveSuccess}
            className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white px-10 py-3 rounded font-bold transition-colors shadow-lg hover:cursor-pointer"
          >
            {isSaving
              ? "SAVING..."
              : saveSuccess
              ? "SAVED ✓"
              : "SAVE & CONTINUE"
            }
          </button>

        </div>

      </div>

    </div>
  );
}