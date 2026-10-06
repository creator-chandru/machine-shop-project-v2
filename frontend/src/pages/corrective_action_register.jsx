import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Save
} from 'lucide-react';

import Header from '../components/Header';
import { useLineSet } from '../context/LineSetContext';

// ============================================================
// INITIAL FORM
// ============================================================

const initialForm = {
  departmentSection: '',
  reportDate: new Date().toISOString().split('T')[0],
  jfWhdReferenceNo: '',
  shiftTime: '',

  natureOfProblem: '',
  receivedBy: '',
  actionIntimatedBy: '',

  actionTakenDetails: '',
  toolingObservation: '',
  actionTakenBy: '',

  workStartedAt: '',
  workCompletedAt: '',
  timeLost: '',

  correctiveActionFeedback: '',
  feedbackGivenBy: '',

  reasonForUndueDelay: '',

  workAndSparesDetails: '',

  mexMydouJf: '',

  preventiveAction: ''
};

// ============================================================
// CHECKLIST
// ============================================================

const defaultChecklistItems = [
  'History book',
  'Flage History Card',
  'Chuck',
  'History Card',
  'J/F Inspection Plan',
  'Tooling Manual',
  'Informed to Design',
  '',
  '',
  '',
  '',
  ''
];

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
      className={`fixed bottom-6 right-6 z-[100] ${bgColor} text-white px-5 py-3 rounded-lg shadow-2xl flex items-center gap-3 animate-bounce`}
    >
      <span className="text-sm font-semibold">
        {message}
      </span>

      <button
        type="button"
        onClick={onClose}
        className="ml-2 font-bold text-lg leading-none hover:text-gray-200"
      >
        ×
      </button>
    </div>
  );
};

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function JigFixtureIssueIntimation() {

  const { shopId } = useParams();
  const navigate = useNavigate();

  const { lineSet } = useLineSet();

  const actualShopId = shopId || '3';

  // ==========================================================
  // PAGE
  // ==========================================================

  const [currentPage, setCurrentPage] = useState(1);

  // ==========================================================
  // FORM
  // ==========================================================

  const [form, setForm] = useState(initialForm);

  // ==========================================================
  // MACHINE DETAILS
  // ==========================================================

  const [machineDetails, setMachineDetails] = useState([]);

  const [loadingMachineDetails, setLoadingMachineDetails] =
    useState(false);

  // ==========================================================
  // STOCK CARDS
  // ==========================================================

  const [stockCards, setStockCards] = useState([
    {
      tableNo: 1,
      slNo: 1,
      stockCardNo: '',
      qty: '',
      sign: ''
    },
    {
      tableNo: 1,
      slNo: 2,
      stockCardNo: '',
      qty: '',
      sign: ''
    },
    {
      tableNo: 1,
      slNo: 3,
      stockCardNo: '',
      qty: '',
      sign: ''
    },
    {
      tableNo: 1,
      slNo: 4,
      stockCardNo: '',
      qty: '',
      sign: ''
    },
    {
      tableNo: 1,
      slNo: 5,
      stockCardNo: '',
      qty: '',
      sign: ''
    },

    {
      tableNo: 2,
      slNo: 1,
      stockCardNo: '',
      qty: '',
      sign: ''
    },
    {
      tableNo: 2,
      slNo: 2,
      stockCardNo: '',
      qty: '',
      sign: ''
    },
    {
      tableNo: 2,
      slNo: 3,
      stockCardNo: '',
      qty: '',
      sign: ''
    },
    {
      tableNo: 2,
      slNo: 4,
      stockCardNo: '',
      qty: '',
      sign: ''
    },
    {
      tableNo: 2,
      slNo: 5,
      stockCardNo: '',
      qty: '',
      sign: ''
    }
  ]);

  // ==========================================================
  // CHECKLIST
  // ==========================================================

  const [checklist, setChecklist] = useState(
    defaultChecklistItems.map((item, index) => ({
      slNo: index + 1,
      checklistItem: item,
      status: ''
    }))
  );

  // ==========================================================
  // SIGNATURE
  // ==========================================================

  const [signatures, setSignatures] = useState({
    'Shift Incharge': ''
  });

  // ==========================================================
  // SAVE STATE
  // ==========================================================

  const [isSaving, setIsSaving] = useState(false);

  const [saveSuccess, setSaveSuccess] = useState(false);

  // ==========================================================
  // TOAST
  // ==========================================================

  const [toast, setToast] = useState({
    message: '',
    type: ''
  });

  // ==========================================================
  // CURRENT USER
  // ==========================================================

  const currentUser =
    JSON.parse(localStorage.getItem('user'))?.username ||
    'Unknown';

  // ==========================================================
  // TOAST FUNCTION
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
  // FETCH MACHINE DETAILS
  // ==========================================================

  useEffect(() => {

    const fetchMachineDetails = async () => {

      try {

        setLoadingMachineDetails(true);

        const token =
          localStorage.getItem('token');

        const headers = token
          ? {
              Authorization:
                `Bearer ${token}`
            }
          : {};

        const res = await fetch(
          `${process.env.REACT_APP_API_URL || ''}/api/jig-fixture-issue/machine-details`,
          {
            headers
          }
        );

        if (!res.ok) {
          throw new Error(
            'Failed to fetch machine details'
          );
        }

        const data = await res.json();

        setMachineDetails(
          Array.isArray(data)
            ? data
            : []
        );

      } catch (err) {

        console.error(
          'Machine details fetch error:',
          err
        );

        triggerToast(
          'Unable to load machine details.',
          'error'
        );

      } finally {

        setLoadingMachineDetails(false);

      }

    };

    fetchMachineDetails();

  }, []);

  // ==========================================================
  // LINE SET SYNC
  // ==========================================================

  useEffect(() => {

    if (lineSet?.lineCode) {

      setForm(prev => ({
        ...prev,
        departmentSection:
          lineSet.lineCode
      }));

    }

  }, [lineSet?.lineCode]);

  // ==========================================================
  // FORM CHANGE
  // ==========================================================

  const handleChange = (
    field,
    value
  ) => {

    setForm(prev => ({
      ...prev,
      [field]: value
    }));

  };

  // ==========================================================
  // STOCK CARD CHANGE
  // ==========================================================

  const handleStockCardChange = (
    tableNo,
    slNo,
    field,
    value
  ) => {

    setStockCards(prev =>
      prev.map(card => {

        if (
          card.tableNo === tableNo &&
          card.slNo === slNo
        ) {

          return {
            ...card,
            [field]: value
          };

        }

        return card;

      })
    );

  };

  // ==========================================================
  // ADD STOCK CARD ROW
  // ==========================================================

  const handleAddStockRow = (
    tableNo
  ) => {

    setStockCards(prev => {

      const tableRows =
        prev.filter(
          row => row.tableNo === tableNo
        );

      const nextSlNo =
        tableRows.length + 1;

      return [
        ...prev,
        {
          tableNo,
          slNo: nextSlNo,
          stockCardNo: '',
          qty: '',
          sign: ''
        }
      ];

    });

  };

  // ==========================================================
  // DELETE STOCK CARD ROW
  // ==========================================================

  const handleDeleteStockRow = (
    tableNo
  ) => {

    setStockCards(prev => {

      const tableRows =
        prev.filter(
          row => row.tableNo === tableNo
        );

      if (tableRows.length <= 1) {
        return prev;
      }

      const lastRow =
        tableRows[tableRows.length - 1];

      return prev.filter(
        row =>
          !(
            row.tableNo === tableNo &&
            row.slNo === lastRow.slNo
          )
      );

    });

  };

  // ==========================================================
  // SIGN STOCK CARD
  // ==========================================================

  const handleStockSign = (
    tableNo,
    slNo
  ) => {

    setStockCards(prev =>
      prev.map(card => {

        if (
          card.tableNo === tableNo &&
          card.slNo === slNo
        ) {

          return {
            ...card,
            sign: currentUser
          };

        }

        return card;

      })
    );

  };

  // ==========================================================
  // CHECKLIST CHANGE
  // ==========================================================

  const handleChecklistChange = (
    slNo,
    field,
    value
  ) => {

    setChecklist(prev =>
      prev.map(item => {

        if (item.slNo === slNo) {

          return {
            ...item,
            [field]: value
          };

        }

        return item;

      })
    );

  };

  // ==========================================================
  // ADD CHECKLIST ROW
  // ==========================================================

  const handleAddChecklistRow = () => {

    setChecklist(prev => [

      ...prev,

      {
        slNo: prev.length + 1,
        checklistItem: '',
        status: ''
      }

    ]);

  };

  // ==========================================================
  // DELETE CHECKLIST ROW
  // ==========================================================

  const handleDeleteChecklistRow = () => {

    if (checklist.length <= 12) {

      triggerToast(
        'The standard checklist contains 12 rows.',
        'error'
      );

      return;
    }

    setChecklist(prev =>
      prev.slice(0, -1)
    );

  };

  // ==========================================================
  // APPROVE SHIFT INCHARGE
  // ==========================================================

  const handleApprove = () => {

    setSignatures(prev => ({
      ...prev,
      'Shift Incharge':
        currentUser
    }));

    triggerToast(
      `Approved by ${currentUser}`,
      'success'
    );

  };

  // ==========================================================
  // VALIDATION
  // ==========================================================

  const validateForm = () => {

    if (!actualShopId) {

      triggerToast(
        'Machine Shop is required.',
        'error'
      );

      return false;

    }

    if (!form.reportDate) {

      triggerToast(
        'Please select the report date.',
        'error'
      );

      setCurrentPage(1);

      return false;

    }

    if (
      !form.departmentSection &&
      !lineSet?.lineCode
    ) {

      triggerToast(
        'Department / Section or Line Code is required.',
        'error'
      );

      setCurrentPage(1);

      return false;

    }

    if (!signatures['Shift Incharge']) {

      triggerToast(
        'Please get Shift Incharge approval before saving.',
        'error'
      );

      setCurrentPage(2);

      return false;

    }

    return true;

  };

  // ==========================================================
  // SAVE
  // ==========================================================

  const handleSave = async () => {

    if (!validateForm()) {
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);

    const payload = {

      header: {

        ...form,

        machineShop:
          Number(actualShopId),

        lineCode:
          lineSet?.lineCode ||
          form.departmentSection

      },

      stockCards,

      checklist,

      signatures

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
          `${process.env.REACT_APP_API_URL || ''}/api/jig-fixture-issue`,
          {
            method: 'POST',
            headers,
            body:
              JSON.stringify(payload)
          }
        );

      let responseData = null;

      try {

        responseData =
          await res.json();

      } catch {
        responseData = null;
      }

      if (!res.ok) {

        throw new Error(
          responseData?.error ||
          responseData?.message ||
          `Save failed (${res.status})`
        );

      }

      setSaveSuccess(true);

      triggerToast(
        'Jig & Fixture Issue Intimation saved successfully!',
        'success'
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
        'Jig & Fixture save error:',
        err
      );

      triggerToast(
        err.message ||
        'Failed to save Jig & Fixture Issue Intimation.',
        'error'
      );

    } finally {

      setIsSaving(false);

    }

  };

  // ==========================================================
  // STOCK TABLE
  // ==========================================================

  const renderStockTable = (
    tableNo
  ) => {

    const rows =
      stockCards.filter(
        row =>
          row.tableNo === tableNo
      );

    return (

      <div className="border-2 border-gray-800">

        <div className="flex justify-between items-center bg-gray-100 border-b-2 border-gray-800 px-3 py-2">

          <span className="font-bold text-xs uppercase">
            Stock Card {tableNo}
          </span>

          <div className="flex gap-1">

            <button
              type="button"
              onClick={() =>
                handleAddStockRow(tableNo)
              }
              className="flex items-center gap-1 bg-orange-500 hover:bg-orange-600 text-white px-2 py-1 rounded text-[10px] font-bold uppercase"
            >
              <Plus className="w-3 h-3" />
              Add
            </button>

            <button
              type="button"
              onClick={() =>
                handleDeleteStockRow(tableNo)
              }
              className="flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-[10px] font-bold uppercase"
            >
              <Trash2 className="w-3 h-3" />
              Delete
            </button>

          </div>

        </div>

        <table className="w-full border-collapse text-xs">

          <thead>

            <tr className="bg-gray-50">

              <th className="border border-gray-800 p-2 w-12">
                S.No
              </th>

              <th className="border border-gray-800 p-2">
                Stock Card No
              </th>

              <th className="border border-gray-800 p-2 w-20">
                Qty
              </th>

              <th className="border border-gray-800 p-2 w-28">
                Sign
              </th>

            </tr>

          </thead>

          <tbody>

            {rows.map(row => (

              <tr key={`${tableNo}-${row.slNo}`}>

                <td className="border border-gray-800 p-1 text-center font-bold">
                  {row.slNo}
                </td>

                <td className="border border-gray-800 p-1">

                  <input
                    type="text"
                    value={row.stockCardNo || ''}
                    onChange={e =>
                      handleStockCardChange(
                        tableNo,
                        row.slNo,
                        'stockCardNo',
                        e.target.value
                      )
                    }
                    className="w-full p-2 outline-none bg-transparent uppercase"
                    placeholder="Stock Card No"
                  />

                </td>

                <td className="border border-gray-800 p-1">

                  <input
                    type="number"
                    value={row.qty || ''}
                    onChange={e =>
                      handleStockCardChange(
                        tableNo,
                        row.slNo,
                        'qty',
                        e.target.value
                      )
                    }
                    className="w-full p-2 text-center outline-none bg-transparent"
                  />

                </td>

                <td className="border border-gray-800 p-1 text-center">

                  {row.sign ? (

                    <div className="flex flex-col items-center">

                      <span className="text-green-600 font-bold text-[10px]">
                        Signed ✓
                      </span>

                      <span className="text-[10px] font-bold truncate max-w-[80px]">
                        {row.sign}
                      </span>

                    </div>

                  ) : (

                    <button
                      type="button"
                      onClick={() =>
                        handleStockSign(
                          tableNo,
                          row.slNo
                        )
                      }
                      className="bg-orange-500 hover:bg-orange-600 text-white px-2 py-1 rounded text-[10px] font-bold uppercase"
                    >
                      Sign
                    </button>

                  )}

                </td>

              </tr>

            ))}

          </tbody>

        </table>

      </div>

    );

  };

  // ==========================================================
  // CHECKLIST TABLE
  // ==========================================================

  const renderChecklistTable = (
    start,
    end
  ) => {

    const rows =
      checklist.slice(start, end);

    return (

      <div className="border-2 border-gray-800">

        <div className="bg-gray-100 border-b-2 border-gray-800 px-3 py-2 font-bold text-xs uppercase">
          Check List for Data Entry
        </div>

        <table className="w-full border-collapse text-xs">

          <thead>

            <tr>

              <th className="border border-gray-800 p-2 w-12">
                S.No
              </th>

              <th className="border border-gray-800 p-2 text-left">
                Checklist Item
              </th>

              <th className="border border-gray-800 p-2 w-20">
                Status
              </th>

            </tr>

          </thead>

          <tbody>

            {rows.map(item => (

              <tr key={item.slNo}>

                <td className="border border-gray-800 p-1 text-center font-bold">
                  {item.slNo}
                </td>

                <td className="border border-gray-800 p-1">

                  {item.slNo <= 7 &&
                  item.checklistItem ? (

                    <span className="block p-1 font-medium">
                      {item.checklistItem}
                    </span>

                  ) : (

                    <input
                      type="text"
                      value={
                        item.checklistItem || ''
                      }
                      onChange={e =>
                        handleChecklistChange(
                          item.slNo,
                          'checklistItem',
                          e.target.value
                        )
                      }
                      className="w-full p-1 outline-none bg-transparent"
                      placeholder="Enter item"
                    />

                  )}

                </td>

                <td className="border border-gray-800 p-1">

                  <select
                    value={
                      item.status || ''
                    }
                    onChange={e =>
                      handleChecklistChange(
                        item.slNo,
                        'status',
                        e.target.value
                      )
                    }
                    className="w-full p-1 text-center outline-none bg-transparent font-bold"
                  >

                    <option value="">
                      -
                    </option>

                    <option value="YES">
                      YES
                    </option>

                    <option value="NO">
                      NO
                    </option>

                    <option value="NA">
                      N/A
                    </option>

                  </select>

                </td>

              </tr>

            ))}

          </tbody>

        </table>

      </div>

    );

  };

  // ==========================================================
  // PAGE NAVIGATION
  // ==========================================================

  const renderPageNavigation = () => (

    <div className="w-full max-w-[95rem] mb-4">

      <div className="bg-white rounded-xl shadow-xl p-2">

        <div className="grid grid-cols-2 gap-2">

          <button
            type="button"
            onClick={() =>
              setCurrentPage(1)
            }
            className={`py-3 px-4 rounded-lg font-bold text-sm uppercase tracking-wider transition-colors ${
              currentPage === 1
                ? 'bg-orange-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Page 1 — Issue / Action Details
          </button>

          <button
            type="button"
            onClick={() =>
              setCurrentPage(2)
            }
            className={`py-3 px-4 rounded-lg font-bold text-sm uppercase tracking-wider transition-colors ${
              currentPage === 2
                ? 'bg-orange-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Page 2 — Stock / Checklist
          </button>

        </div>

      </div>

    </div>

  );

  // ==========================================================
  // PAGE 1
  // ==========================================================

  const renderPage1 = () => (

    <div className="bg-white w-full max-w-[95rem] rounded-xl p-8 shadow-2xl border-4 border-gray-100">

      {/* ====================================================
          HEADER
      ==================================================== */}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 border-b border-gray-200 pb-4 gap-4">

        <div>

          <span className="text-xs font-bold text-orange-600 tracking-wider uppercase block mb-1">
            SAKTHI AUTO COMPONENT LIMITED
          </span>

          <h2 className="text-2xl font-bold text-gray-800 uppercase tracking-wide">
            TOOLING CORRECTIVE ACTION INTIMATION SLIP
          </h2>

          <div className="text-xs text-gray-500 mt-1">
            Jig & Fixture Issue Intimation
          </div>

        </div>

        <div className="text-right text-xs font-semibold text-gray-600">

          <div>
            Machine Shop:
            <span className="font-bold text-gray-900 ml-1">
              {actualShopId}
            </span>
          </div>

          {loadingMachineDetails && (
            <div className="text-orange-500 mt-1">
              Loading machine details...
            </div>
          )}

        </div>

      </div>

      {/* ====================================================
          BASIC INFORMATION
      ==================================================== */}

      <div className="border-2 border-gray-800">

        <div className="grid grid-cols-1 md:grid-cols-2">

          <div className="border-b md:border-r border-gray-800 p-3">

            <label className="block text-xs font-bold text-gray-700 mb-1">
              Department / Section
            </label>

            <input
              type="text"
              value={
                form.departmentSection || ''
              }
              onChange={e =>
                handleChange(
                  'departmentSection',
                  e.target.value
                )
              }
              className="w-full p-2 outline-none bg-transparent border-b border-gray-300 font-semibold uppercase"
              placeholder="Department / Section"
            />

          </div>

          <div className="border-b border-gray-800 p-3">

            <label className="block text-xs font-bold text-gray-700 mb-1">
              Date
            </label>

            <input
              type="date"
              value={
                form.reportDate || ''
              }
              onChange={e =>
                handleChange(
                  'reportDate',
                  e.target.value
                )
              }
              className="w-full p-2 outline-none bg-transparent border-b border-gray-300 font-semibold"
            />

          </div>

          <div className="border-b md:border-r border-gray-800 p-3">

            <label className="block text-xs font-bold text-gray-700 mb-1">
              JF / WHD Reference No
            </label>

            <input
              type="text"
              value={
                form.jfWhdReferenceNo || ''
              }
              onChange={e =>
                handleChange(
                  'jfWhdReferenceNo',
                  e.target.value
                )
              }
              className="w-full p-2 outline-none bg-transparent border-b border-gray-300 font-semibold uppercase"
              placeholder="Reference No"
            />

          </div>

          <div className="border-b border-gray-800 p-3">

            <label className="block text-xs font-bold text-gray-700 mb-1">
              Shift / Time
            </label>

            <input
              type="text"
              value={
                form.shiftTime || ''
              }
              onChange={e =>
                handleChange(
                  'shiftTime',
                  e.target.value
                )
              }
              className="w-full p-2 outline-none bg-transparent border-b border-gray-300 font-semibold"
              placeholder="Shift / Time"
            />

          </div>

        </div>

      </div>

      {/* ====================================================
          NATURE OF PROBLEM
      ==================================================== */}

      <div className="border-2 border-gray-800 border-t-0">

        <div className="px-3 py-2 bg-gray-100 border-b border-gray-800">

          <span className="font-bold text-xs uppercase">
            Nature of Problem / Reasons for Action Required
          </span>

        </div>

        <textarea
          rows={6}
          value={
            form.natureOfProblem || ''
          }
          onChange={e =>
            handleChange(
              'natureOfProblem',
              e.target.value
            )
          }
          className="w-full p-3 outline-none resize-y uppercase text-sm"
          placeholder="Enter nature of problem / reason for action required"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 border-t border-gray-800">

          <div className="md:border-r border-gray-800 p-3">

            <label className="block text-xs font-bold mb-1">
              Received By
            </label>

            <input
              type="text"
              value={
                form.receivedBy || ''
              }
              onChange={e =>
                handleChange(
                  'receivedBy',
                  e.target.value
                )
              }
              className="w-full p-2 border-b border-gray-300 outline-none uppercase"
            />

          </div>

          <div className="p-3">

            <label className="block text-xs font-bold mb-1">
              Action Intimated By
            </label>

            <input
              type="text"
              value={
                form.actionIntimatedBy || ''
              }
              onChange={e =>
                handleChange(
                  'actionIntimatedBy',
                  e.target.value
                )
              }
              className="w-full p-2 border-b border-gray-300 outline-none uppercase"
            />

          </div>

        </div>

      </div>

      {/* ====================================================
          ACTION TAKEN
      ==================================================== */}

      <div className="border-2 border-gray-800 border-t-0">

        <div className="px-3 py-2 bg-gray-100 border-b border-gray-800">

          <span className="font-bold text-xs uppercase">
            Details of Action Taken
          </span>

        </div>

        <textarea
          rows={6}
          value={
            form.actionTakenDetails || ''
          }
          onChange={e =>
            handleChange(
              'actionTakenDetails',
              e.target.value
            )
          }
          className="w-full p-3 outline-none resize-y uppercase text-sm"
          placeholder="Enter details of action taken"
        />

      </div>

      {/* ====================================================
          OBSERVATION
      ==================================================== */}

      <div className="border-2 border-gray-800 border-t-0">

        <div className="px-3 py-2 bg-gray-100 border-b border-gray-800">

          <span className="font-bold text-xs uppercase">
            Details of Observation of the Toolings
          </span>

        </div>

        <textarea
          rows={6}
          value={
            form.toolingObservation || ''
          }
          onChange={e =>
            handleChange(
              'toolingObservation',
              e.target.value
            )
          }
          className="w-full p-3 outline-none resize-y uppercase text-sm"
          placeholder="Enter tooling observation"
        />

        <div className="border-t border-gray-800 p-3">

          <label className="block text-xs font-bold mb-1">
            Action Taken By
          </label>

          <input
            type="text"
            value={
              form.actionTakenBy || ''
            }
            onChange={e =>
              handleChange(
                'actionTakenBy',
                e.target.value
              )
            }
            className="w-full p-2 border-b border-gray-300 outline-none uppercase"
          />

        </div>

      </div>

      {/* ====================================================
          WORK TIMING
      ==================================================== */}

      <div className="border-2 border-gray-800 border-t-0">

        <div className="grid grid-cols-1 md:grid-cols-3">

          <div className="md:border-r border-gray-800 p-3">

            <label className="block text-xs font-bold mb-1">
              Work Started At
            </label>

            <input
              type="datetime-local"
              value={
                form.workStartedAt || ''
              }
              onChange={e =>
                handleChange(
                  'workStartedAt',
                  e.target.value
                )
              }
              className="w-full p-2 outline-none border-b border-gray-300"
            />

          </div>

          <div className="md:border-r border-gray-800 p-3">

            <label className="block text-xs font-bold mb-1">
              Work Completed At
            </label>

            <input
              type="datetime-local"
              value={
                form.workCompletedAt || ''
              }
              onChange={e =>
                handleChange(
                  'workCompletedAt',
                  e.target.value
                )
              }
              className="w-full p-2 outline-none border-b border-gray-300"
            />

          </div>

          <div className="p-3">

            <label className="block text-xs font-bold mb-1">
              Time Lost
            </label>

            <input
              type="text"
              value={
                form.timeLost || ''
              }
              onChange={e =>
                handleChange(
                  'timeLost',
                  e.target.value
                )
              }
              className="w-full p-2 outline-none border-b border-gray-300"
              placeholder="Time lost"
            />

          </div>

        </div>

      </div>

      {/* ====================================================
          FEEDBACK
      ==================================================== */}

      <div className="border-2 border-gray-800 border-t-0">

        <div className="px-3 py-2 bg-gray-100 border-b border-gray-800">

          <span className="font-bold text-xs uppercase">
            Feedback on Corrective Action
          </span>

        </div>

        <textarea
          rows={5}
          value={
            form.correctiveActionFeedback || ''
          }
          onChange={e =>
            handleChange(
              'correctiveActionFeedback',
              e.target.value
            )
          }
          className="w-full p-3 outline-none resize-y uppercase text-sm"
          placeholder="Enter feedback on corrective action"
        />

        <div className="border-t border-gray-800 p-3">

          <label className="block text-xs font-bold mb-1">
            Feedback Given By
          </label>

          <input
            type="text"
            value={
              form.feedbackGivenBy || ''
            }
            onChange={e =>
              handleChange(
                'feedbackGivenBy',
                e.target.value
              )
            }
            className="w-full p-2 outline-none border-b border-gray-300 uppercase"
          />

        </div>

      </div>

      {/* ====================================================
          DELAY
      ==================================================== */}

      <div className="border-2 border-gray-800 border-t-0">

        <div className="px-3 py-2 bg-gray-100 border-b border-gray-800">

          <span className="font-bold text-xs uppercase">
            Reason for Undue Delay
          </span>

        </div>

        <textarea
          rows={4}
          value={
            form.reasonForUndueDelay || ''
          }
          onChange={e =>
            handleChange(
              'reasonForUndueDelay',
              e.target.value
            )
          }
          className="w-full p-3 outline-none resize-y uppercase text-sm"
          placeholder="Enter reason for undue delay"
        />

      </div>

      {/* ====================================================
          WORK + SPARES
      ==================================================== */}

      <div className="border-2 border-gray-800 border-t-0">

        <div className="px-3 py-2 bg-gray-100 border-b border-gray-800">

          <span className="font-bold text-xs uppercase">
            Details of Work Attended By & Details of Spares Consumed
          </span>

        </div>

        <textarea
          rows={5}
          value={
            form.workAndSparesDetails || ''
          }
          onChange={e =>
            handleChange(
              'workAndSparesDetails',
              e.target.value
            )
          }
          className="w-full p-3 outline-none resize-y uppercase text-sm"
          placeholder="Enter work attended and spares consumed"
        />

      </div>

      {/* ====================================================
          MEX / MYDOU / J&F
      ==================================================== */}

      <div className="border-2 border-gray-800 border-t-0 p-3">

        <label className="block text-xs font-bold mb-1">
          M.Ex / MYDOU / J&F
        </label>

        <input
          type="text"
          value={
            form.mexMydouJf || ''
          }
          onChange={e =>
            handleChange(
              'mexMydouJf',
              e.target.value
            )
          }
          className="w-full p-2 outline-none border-b border-gray-300 uppercase"
          placeholder="Enter details"
        />

      </div>

      {/* ====================================================
          FOOTER
      ==================================================== */}

      <div className="flex justify-between items-center mt-4 text-xs text-gray-500 font-semibold">

        <span>
          QF / 07 / MTD - 08
        </span>

        <span>
          01.07.2013
        </span>

      </div>

      {/* ====================================================
          PAGE BUTTON
      ==================================================== */}

      <div className="flex justify-end mt-6 pt-4 border-t border-gray-300">

        <button
          type="button"
          onClick={() =>
            setCurrentPage(2)
          }
          className="flex items-center gap-2 bg-gray-800 hover:bg-gray-900 text-white px-8 py-3 rounded font-bold uppercase tracking-wider text-sm shadow-lg"
        >
          Next Page
          <ChevronRight className="w-4 h-4" />
        </button>

      </div>

    </div>

  );

  // ==========================================================
  // PAGE 2
  // ==========================================================

  const renderPage2 = () => (

    <div className="bg-white w-full max-w-[95rem] rounded-xl p-8 shadow-2xl border-4 border-gray-100">

      {/* ====================================================
          PAGE HEADER
      ==================================================== */}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 border-b border-gray-200 pb-4 gap-4">

        <div>

          <span className="text-xs font-bold text-orange-600 tracking-wider uppercase block mb-1">
            SAKTHI AUTO COMPONENT LIMITED
          </span>

          <h2 className="text-2xl font-bold text-gray-800 uppercase tracking-wide">
            JIG & FIXTURE ISSUE INTIMATION
          </h2>

          <div className="text-xs text-gray-500 mt-1">
            Stock Card / Checklist / Preventive Action
          </div>

        </div>

        <div className="text-right text-xs">

          <div className="font-bold text-gray-700">
            Date
          </div>

          <div className="font-semibold text-gray-900">
            {form.reportDate || '-'}
          </div>

        </div>

      </div>

      {/* ====================================================
          STOCK CARD TABLES
      ==================================================== */}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {renderStockTable(1)}

        {renderStockTable(2)}

      </div>

      {/* ====================================================
          CHECKLIST
      ==================================================== */}

      <div className="mt-6">

        <div className="flex justify-between items-center mb-2">

          <h3 className="font-bold text-gray-800 text-sm uppercase">
            Check List for Data Entry
          </h3>

          <div className="flex gap-2">

            <button
              type="button"
              onClick={handleAddChecklistRow}
              className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded text-xs font-bold uppercase"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Row
            </button>

            <button
              type="button"
              onClick={handleDeleteChecklistRow}
              className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded text-xs font-bold uppercase"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Row
            </button>

          </div>

        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {renderChecklistTable(0, 6)}

          {renderChecklistTable(6, checklist.length)}

        </div>

      </div>

      {/* ====================================================
          PREVENTIVE ACTION
      ==================================================== */}

      <div className="border-2 border-gray-800 mt-6">

        <div className="px-3 py-2 bg-gray-100 border-b border-gray-800">

          <span className="font-bold text-xs uppercase">
            Details Of Preventive Action Required & Taken
          </span>

        </div>

        <textarea
          rows={8}
          value={
            form.preventiveAction || ''
          }
          onChange={e =>
            handleChange(
              'preventiveAction',
              e.target.value
            )
          }
          className="w-full p-4 outline-none resize-y uppercase text-sm"
          placeholder="Enter details of preventive action required and taken"
        />

      </div>

      {/* ====================================================
          SHIFT INCHARGE APPROVAL
      ==================================================== */}

      <div className="border-2 border-gray-800 mt-6">

        <div className="px-3 py-2 bg-gray-100 border-b border-gray-800">

          <span className="font-bold text-xs uppercase">
            Shift Incharge Approval
          </span>

        </div>

        <div className="p-5 flex flex-col sm:flex-row justify-between items-center gap-4">

          <div>

            <div className="text-xs text-gray-500 uppercase font-semibold">
              Approval Status
            </div>

            {signatures['Shift Incharge'] ? (

              <div className="flex items-center gap-2 mt-1">

                <CheckCircle2 className="w-5 h-5 text-green-600" />

                <div>

                  <div className="text-sm font-bold text-green-600">
                    Approved
                  </div>

                  <div className="text-xs font-bold text-gray-800 uppercase">
                    {signatures['Shift Incharge']}
                  </div>

                </div>

              </div>

            ) : (

              <div className="text-sm font-semibold text-gray-500 mt-1">
                Awaiting Shift Incharge approval
              </div>

            )}

          </div>

          {!signatures['Shift Incharge'] && (

            <button
              type="button"
              onClick={handleApprove}
              className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded font-bold uppercase tracking-wider text-xs shadow"
            >
              Approve
            </button>

          )}

        </div>

      </div>

      {/* ====================================================
          BOTTOM CONTROLS
      ==================================================== */}

      <div className="flex flex-col sm:flex-row justify-between gap-3 mt-6 pt-5 border-t border-gray-300">

        <button
          type="button"
          onClick={() =>
            setCurrentPage(1)
          }
          className="flex items-center justify-center gap-2 bg-gray-600 hover:bg-gray-700 text-white px-8 py-3 rounded font-bold uppercase tracking-wider text-sm shadow"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Page 1
        </button>

        <button
          type="button"
          onClick={handleSave}
          disabled={
            isSaving ||
            saveSuccess
          }
          className="flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-900 disabled:bg-gray-400 text-white px-10 py-3 rounded font-bold uppercase tracking-wider text-sm shadow-lg"
        >

          <Save className="w-4 h-4" />

          {isSaving
            ? 'SAVING...'
            : saveSuccess
              ? 'SAVED ✓'
              : 'SAVE & CONTINUE'}

        </button>

      </div>

    </div>

  );

  // ==========================================================
  // MAIN RETURN
  // ==========================================================

  return (

    <div className="min-h-screen bg-[#2d2d2d] flex flex-col items-center p-6 pb-20">

      <Header />

      {/* ====================================================
          TOAST
      ==================================================== */}

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

      {/* ====================================================
          SAVE OVERLAY
      ==================================================== */}

      {(isSaving || saveSuccess) && (

        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[90]">

          <div className="bg-white rounded-xl shadow-2xl px-10 py-8 text-center">

            {isSaving ? (

              <>

                <div className="w-10 h-10 border-4 border-gray-300 border-t-orange-500 rounded-full animate-spin mx-auto mb-5"></div>

                <h2 className="text-xl font-bold text-gray-800">
                  Saving Jig & Fixture Data...
                </h2>

              </>

            ) : (

              <>

                <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-3" />

                <h2 className="text-xl font-bold text-green-800">
                  Data Saved Successfully
                </h2>

              </>

            )}

          </div>

        </div>

      )}

      {/* ====================================================
          PAGE SELECTOR
      ==================================================== */}

      <div className="w-full max-w-[95rem] mt-4 mb-4">

        <div className="bg-white rounded-xl shadow-xl p-2">

          <div className="grid grid-cols-2 gap-2">

            <button
              type="button"
              onClick={() =>
                setCurrentPage(1)
              }
              className={`py-3 px-4 rounded-lg font-bold text-sm uppercase tracking-wider transition-colors ${
                currentPage === 1
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Page 1 — Issue / Action Details
            </button>

            <button
              type="button"
              onClick={() =>
                setCurrentPage(2)
              }
              className={`py-3 px-4 rounded-lg font-bold text-sm uppercase tracking-wider transition-colors ${
                currentPage === 2
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Page 2 — Stock / Checklist
            </button>

          </div>

        </div>

      </div>

      {/* ====================================================
          PAGE CONTENT
      ==================================================== */}

      {currentPage === 1
        ? renderPage1()
        : renderPage2()}

    </div>

  );

}