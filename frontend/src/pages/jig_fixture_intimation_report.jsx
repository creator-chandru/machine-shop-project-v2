import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { useLineSet } from '../context/LineSetContext';


// ============================================================
// INITIAL FORM
// ============================================================

const initialForm = {
    departmentSection: '',
    reportDate: '',
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

const checklistItems = [
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
            className={`
                fixed bottom-6 right-6 z-[100]
                ${bgColor}
                text-white px-5 py-3 rounded-lg
                shadow-2xl flex items-center gap-3
            `}
        >

            <span className="text-sm font-semibold">
                {message}
            </span>

            <button
                type="button"
                onClick={onClose}
                className="ml-2 font-bold text-lg"
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


    // ========================================================
    // PAGE STATE
    // ========================================================

    const [currentPage, setCurrentPage] = useState(1);


    // ========================================================
    // FORM STATE
    // ========================================================

    const [form, setForm] = useState(initialForm);

    const [machineDetails, setMachineDetails] = useState([]);

    const [loading, setLoading] = useState(true);

    const [isSaving, setIsSaving] = useState(false);

    const [saveSuccess, setSaveSuccess] = useState(false);

    const [toast, setToast] = useState({
        message: '',
        type: ''
    });


    // ========================================================
    // CURRENT USER
    // ========================================================

    const currentUser =
        JSON.parse(
            localStorage.getItem('user') || '{}'
        )?.username || 'Unknown';


    // ========================================================
    // STOCK CARDS
    // ========================================================

    const [stockCards, setStockCards] = useState([

        {
            id: 1,
            tableNo: 1,
            slNo: 1,
            stockCardNo: '',
            qty: '',
            sign: ''
        },

        {
            id: 2,
            tableNo: 1,
            slNo: 2,
            stockCardNo: '',
            qty: '',
            sign: ''
        },

        {
            id: 3,
            tableNo: 1,
            slNo: 3,
            stockCardNo: '',
            qty: '',
            sign: ''
        },

        {
            id: 4,
            tableNo: 1,
            slNo: 4,
            stockCardNo: '',
            qty: '',
            sign: ''
        },

        {
            id: 5,
            tableNo: 1,
            slNo: 5,
            stockCardNo: '',
            qty: '',
            sign: ''
        },

        {
            id: 6,
            tableNo: 2,
            slNo: 1,
            stockCardNo: '',
            qty: '',
            sign: ''
        },

        {
            id: 7,
            tableNo: 2,
            slNo: 2,
            stockCardNo: '',
            qty: '',
            sign: ''
        },

        {
            id: 8,
            tableNo: 2,
            slNo: 3,
            stockCardNo: '',
            qty: '',
            sign: ''
        },

        {
            id: 9,
            tableNo: 2,
            slNo: 4,
            stockCardNo: '',
            qty: '',
            sign: ''
        },

        {
            id: 10,
            tableNo: 2,
            slNo: 5,
            stockCardNo: '',
            qty: '',
            sign: ''
        }

    ]);


    // ========================================================
    // CHECKLIST STATE
    // ========================================================

    const [checklist, setChecklist] = useState(
        checklistItems.map((item, index) => ({
            slNo: index + 1,
            checklistItem: item,
            status: ''
        }))
    );


    // ========================================================
    // SHIFT INCHARGE SIGNATURE
    // ========================================================

    const [signatures, setSignatures] = useState({
        "Shift Incharge": ''
    });


    // ========================================================
    // TOAST
    // ========================================================

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


    // ========================================================
    // SHIFT INCHARGE APPROVAL
    // ========================================================

    const handleApprove = () => {

        setSignatures({
            "Shift Incharge": currentUser
        });

        triggerToast(
            'Shift Incharge approved successfully.',
            'success'
        );
    };


    // ========================================================
    // LOAD MACHINE DETAILS
    // ========================================================

    useEffect(() => {

        const fetchData = async () => {

            try {

                const token =
                    localStorage.getItem('token');

                const res = await fetch(
                    `${process.env.REACT_APP_API_URL}/api/jig-fixture-issue/machine-details`,
                    {
                        headers: {
                            Authorization:
                                `Bearer ${token}`
                        }
                    }
                );

                if (!res.ok) {

                    throw new Error(
                        'Failed to load machine data'
                    );

                }

                const data =
                    await res.json();

                setMachineDetails(data);

            } catch (err) {

                console.error(
                    'Machine details error:',
                    err
                );

                triggerToast(
                    'Failed to load machine details.',
                    'error'
                );

            } finally {

                setLoading(false);

            }

        };

        fetchData();

    }, []);


    // ========================================================
    // SYNC LINE SET
    // ========================================================

    useEffect(() => {

        if (!lineSet) return;

        setForm(prev => ({
            ...prev,

            departmentSection:
                lineSet.lineCode || ''
        }));

    }, [lineSet]);


    // ========================================================
    // FORM CHANGE
    // ========================================================

    const handleChange = (
        field,
        value
    ) => {

        setForm(prev => ({
            ...prev,
            [field]: value
        }));

    };


    // ========================================================
    // STOCK CARD CHANGE
    // ========================================================

    const handleStockChange = (
        id,
        field,
        value
    ) => {

        setStockCards(prev =>
            prev.map(row =>
                row.id === id
                    ? {
                        ...row,
                        [field]: value
                    }
                    : row
            )
        );

    };


    // ========================================================
    // ADD STOCK ROW
    // ========================================================

    const addStockRow = (tableNo) => {

        setStockCards(prev => {

            const tableRows =
                prev.filter(
                    row => row.tableNo === tableNo
                );

            const maxId =
                prev.length > 0
                    ? Math.max(
                        ...prev.map(row => row.id)
                    )
                    : 0;

            const newRow = {

                id: maxId + 1,

                tableNo,

                slNo:
                    tableRows.length + 1,

                stockCardNo: '',

                qty: '',

                sign: ''

            };

            return [
                ...prev,
                newRow
            ];

        });

    };


    // ========================================================
    // SIGN STOCK ROW
    // ========================================================

    const signStockRow = (id) => {

        setStockCards(prev =>
            prev.map(row =>
                row.id === id
                    ? {
                        ...row,
                        sign: currentUser
                    }
                    : row
            )
        );

        triggerToast(
            'Stock card signed successfully.',
            'success'
        );

    };


    // ========================================================
    // CHECKLIST STATUS CHANGE
    // ========================================================

    const handleChecklistChange = (
        index,
        value
    ) => {

        setChecklist(prev => {

            const copy = [...prev];

            copy[index] = {
                ...copy[index],
                status: value
            };

            return copy;

        });

    };


    // ========================================================
    // CHECKLIST ITEM CHANGE
    // ========================================================

    const handleChecklistItemChange = (
        index,
        value
    ) => {

        setChecklist(prev => {

            const copy = [...prev];

            copy[index] = {
                ...copy[index],
                checklistItem: value
            };

            return copy;

        });

    };


    // ========================================================
    // PAGE NAVIGATION
    // ========================================================

    const goToPage = (page) => {

        if (page < 1 || page > 2) return;

        setCurrentPage(page);

        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });

    };


    const nextPage = () => {

        if (currentPage < 2) {
            goToPage(currentPage + 1);
        }

    };


    const previousPage = () => {

        if (currentPage > 1) {
            goToPage(currentPage - 1);
        }

    };


    // ========================================================
    // VALIDATION
    // ========================================================

    const validateForm = () => {

        if (!shopId) {

            triggerToast(
                'Machine shop is missing.',
                'error'
            );

            return false;
        }


        if (!form.reportDate) {

            triggerToast(
                'Please select the date.',
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
                'Please select Department / Section.',
                'error'
            );

            setCurrentPage(1);

            return false;
        }


        if (!signatures["Shift Incharge"]) {

            triggerToast(
                'Please get Shift Incharge approval before saving.',
                'error'
            );

            setCurrentPage(2);

            return false;
        }


        return true;

    };


    // ========================================================
    // SAVE FORM
    // ========================================================

    const handleSave = async () => {

        if (!validateForm()) return;


        setIsSaving(true);

        setSaveSuccess(false);


        const payload = {

            header: {

                ...form,

                machineShop:
                    Number(shopId),

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


            const res = await fetch(
                `${process.env.REACT_APP_API_URL}/api/jig-fixture-issue`,
                {

                    method: 'POST',

                    headers: {

                        'Content-Type':
                            'application/json',

                        Authorization:
                            `Bearer ${token}`

                    },

                    body:
                        JSON.stringify(
                            payload
                        )

                }
            );


            const data =
                await res.json();


            if (!res.ok) {

                throw new Error(
                    data.error ||
                    data.message ||
                    'Save failed'
                );

            }


            setSaveSuccess(true);


            triggerToast(
                'Data saved successfully.',
                'success'
            );


            await new Promise(
                resolve =>
                    setTimeout(
                        resolve,
                        2000
                    )
            );


            navigate(
                `/operator/${shopId}`
            );


        } catch (err) {

            console.error(
                'Save error:',
                err
            );


            triggerToast(
                err.message ||
                'Failed to save form.',
                'error'
            );


        } finally {

            setIsSaving(false);

        }

    };


    // ========================================================
    // RENDER STOCK TABLE
    // ========================================================

    const renderStockTable = (
        tableNo
    ) => {

        const rows =
            stockCards.filter(
                item =>
                    item.tableNo === tableNo
            );


        return (

            <div className="border-2 border-gray-800">

                {/* TABLE TITLE */}

                <div className="bg-gray-100 border-b-2 border-gray-800 p-2 font-bold text-center">
                    Stock Card {tableNo}
                </div>


                {/* TABLE */}

                <table className="w-full border-collapse border border-gray-800 text-sm">

                    <thead>

                        <tr>

                            <th className="border border-gray-800 p-2">
                                S.No
                            </th>

                            <th className="border border-gray-800 p-2">
                                Stock Card No
                            </th>

                            <th className="border border-gray-800 p-2">
                                Qty
                            </th>

                            <th className="border border-gray-800 p-2">
                                Sign
                            </th>

                        </tr>

                    </thead>


                    <tbody>

                        {rows.map(row => (

                            <tr key={row.id}>

                                <td className="border border-gray-800 p-2 text-center">
                                    {row.slNo}
                                </td>


                                <td className="border border-gray-800 p-0">

                                    <input
                                        type="text"
                                        className="w-full p-2 outline-none text-center"
                                        value={
                                            row.stockCardNo
                                        }
                                        onChange={e =>
                                            handleStockChange(
                                                row.id,
                                                'stockCardNo',
                                                e.target.value
                                            )
                                        }
                                    />

                                </td>


                                <td className="border border-gray-800 p-0">

                                    <input
                                        type="text"
                                        className="w-full p-2 outline-none text-center"
                                        value={
                                            row.qty
                                        }
                                        onChange={e =>
                                            handleStockChange(
                                                row.id,
                                                'qty',
                                                e.target.value
                                            )
                                        }
                                    />

                                </td>


                                <td className="border border-gray-800 p-2 text-center">

                                    {row.sign ? (

                                        <div>

                                            <div className="text-green-600 font-bold">
                                                Signed ✓
                                            </div>

                                            <div className="text-xs font-bold mt-1 uppercase">
                                                {row.sign}
                                            </div>

                                        </div>

                                    ) : (

                                        <button
                                            type="button"
                                            onClick={() =>
                                                signStockRow(
                                                    row.id
                                                )
                                            }
                                            className="bg-green-600 hover:bg-green-700 text-white px-4 py-1 rounded font-bold"
                                        >
                                            SIGN
                                        </button>

                                    )}

                                </td>

                            </tr>

                        ))}

                    </tbody>

                </table>


                {/* ADD ROW */}

                <div className="p-2 flex justify-end">

                    <button
                        type="button"
                        onClick={() =>
                            addStockRow(
                                tableNo
                            )
                        }
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-bold"
                    >
                        + ADD ROW
                    </button>

                </div>

            </div>

        );

    };


    // ========================================================
    // CHECKLIST TABLE
    // ========================================================

    const renderChecklistTable = (
        startIndex,
        endIndex
    ) => {

        const rows =
            checklist.slice(
                startIndex,
                endIndex
            );


        return (

            <table className="w-full border-collapse border border-gray-800">

                <thead>

                    <tr className="bg-gray-100">

                        <th className="border border-gray-800 p-2 w-16">
                            S.No
                        </th>

                        <th className="border border-gray-800 p-2 text-left">
                            Item
                        </th>

                        <th className="border border-gray-800 p-2 w-28">
                            Status
                        </th>

                    </tr>

                </thead>


                <tbody>

                    {rows.map((item, localIndex) => {

                        const index =
                            startIndex +
                            localIndex;

                        return (

                            <tr key={item.slNo}>

                                <td className="border border-gray-800 p-2 text-center">
                                    {item.slNo}
                                </td>


                                <td className="border border-gray-800 p-2">

                                    {item.slNo < 8 ? (

                                        item.checklistItem

                                    ) : (

                                        <input
                                            type="text"
                                            className="w-full outline-none border-b border-gray-300 p-1"
                                            placeholder="Enter item"
                                            value={
                                                item.checklistItem
                                            }
                                            onChange={e =>
                                                handleChecklistItemChange(
                                                    index,
                                                    e.target.value
                                                )
                                            }
                                        />

                                    )}

                                </td>


                                <td className="border border-gray-800 p-0">

                                    <select
                                        className="w-full p-2 outline-none"
                                        value={
                                            item.status
                                        }
                                        onChange={e =>
                                            handleChecklistChange(
                                                index,
                                                e.target.value
                                            )
                                        }
                                    >

                                        <option value="">
                                            Select
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

                        );

                    })}

                </tbody>

            </table>

        );

    };


    // ========================================================
    // PAGE SELECTOR
    // ========================================================

    const renderPageSelector = () => {

        return (

            <div className="w-full max-w-[90rem] mb-4">

                <div className="bg-white rounded-xl shadow-xl border-2 border-gray-300 p-3">

                    <div className="flex items-center justify-between gap-4">

                        {/* BACK */}

                        <button
                            type="button"
                            onClick={previousPage}
                            disabled={currentPage === 1}
                            className={`
                                px-5 py-2 rounded-lg font-bold
                                transition
                                ${
                                    currentPage === 1
                                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                        : 'bg-gray-700 hover:bg-gray-800 text-white'
                                }
                            `}
                        >
                            ← BACK
                        </button>


                        {/* PAGE BUTTONS */}

                        <div className="flex items-center gap-2">

                            <button
                                type="button"
                                onClick={() =>
                                    goToPage(1)
                                }
                                className={`
                                    px-8 py-2 rounded-lg
                                    font-bold border-2
                                    transition
                                    ${
                                        currentPage === 1
                                            ? 'bg-orange-500 border-orange-500 text-white'
                                            : 'bg-white border-gray-400 text-gray-700 hover:bg-gray-100'
                                    }
                                `}
                            >
                                PAGE 1
                            </button>


                            <button
                                type="button"
                                onClick={() =>
                                    goToPage(2)
                                }
                                className={`
                                    px-8 py-2 rounded-lg
                                    font-bold border-2
                                    transition
                                    ${
                                        currentPage === 2
                                            ? 'bg-orange-500 border-orange-500 text-white'
                                            : 'bg-white border-gray-400 text-gray-700 hover:bg-gray-100'
                                    }
                                `}
                            >
                                PAGE 2
                            </button>

                        </div>


                        {/* NEXT */}

                        <button
                            type="button"
                            onClick={nextPage}
                            disabled={currentPage === 2}
                            className={`
                                px-5 py-2 rounded-lg font-bold
                                transition
                                ${
                                    currentPage === 2
                                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                        : 'bg-orange-500 hover:bg-orange-600 text-white'
                                }
                            `}
                        >
                            NEXT →
                        </button>

                    </div>


                    {/* CURRENT PAGE LABEL */}

                    <div className="text-center mt-2 text-sm text-gray-600 font-semibold">
                        {currentPage === 1
                            ? 'Tooling Corrective Action Intimation Slip'
                            : 'Stock Card / Checklist / Preventive Action'
                        }
                    </div>

                </div>

            </div>

        );

    };


    // ========================================================
    // PAGE 1
    // ========================================================

    const renderPageOne = () => {

        return (

            <div className="bg-white w-full max-w-[90rem] rounded-xl shadow-2xl border-4 border-gray-100 p-6">

                {/* ==================================================
                    FORM HEADER
                ================================================== */}

                <div className="border-2 border-gray-800">

                    {/* TOP HEADER */}

                    <div className="grid grid-cols-12">

                        {/* COMPANY */}

                        <div className="col-span-3 border-r-2 border-gray-800 p-4">

                            <div className="font-bold text-xl">
                                SAKTHI
                            </div>

                            <div className="font-bold">
                                AUTO COMPONENT
                            </div>

                            <div className="font-bold">
                                LIMITED
                            </div>

                        </div>


                        {/* TITLE */}

                        <div className="col-span-7 border-r-2 border-gray-800 p-4 flex items-center justify-center">

                            <h1 className="text-xl md:text-2xl font-bold text-center">

                                TOOLING CORRECTIVE
                                <br />

                                ACTION INTIMATION SLIP

                            </h1>

                        </div>


                        {/* SERIAL NUMBER */}

                        <div className="col-span-2 p-4">

                            <div className="font-semibold text-sm">
                                Sl. No.
                            </div>

                            <input
                                type="text"
                                className="w-full mt-2 border-b border-gray-500 outline-none text-center"
                                placeholder=""
                            />

                        </div>

                    </div>


                    {/* ROW 1 */}

                    <div className="grid grid-cols-2 border-t-2 border-gray-800">

                        <div className="border-r-2 border-gray-800 p-2">

                            <label className="font-semibold">
                                Department / Section :
                            </label>

                            <input
                                type="text"
                                className="ml-2 border-b border-gray-500 outline-none"
                                value={
                                    form.departmentSection
                                }
                                onChange={e =>
                                    handleChange(
                                        'departmentSection',
                                        e.target.value
                                    )
                                }
                            />

                        </div>


                        <div className="p-2">

                            <label className="font-semibold">
                                Date :
                            </label>

                            <input
                                type="date"
                                className="ml-2 border border-gray-300 p-1"
                                value={
                                    form.reportDate
                                }
                                onChange={e =>
                                    handleChange(
                                        'reportDate',
                                        e.target.value
                                    )
                                }
                            />

                        </div>

                    </div>


                    {/* ROW 2 */}

                    <div className="grid grid-cols-2 border-t border-gray-800">

                        <div className="border-r-2 border-gray-800 p-2">

                            <label className="font-semibold">
                                JF/WHD Reference No :
                            </label>

                            <input
                                type="text"
                                className="ml-2 border-b border-gray-500 outline-none"
                                value={
                                    form.jfWhdReferenceNo
                                }
                                onChange={e =>
                                    handleChange(
                                        'jfWhdReferenceNo',
                                        e.target.value
                                    )
                                }
                            />

                        </div>


                        <div className="p-2">

                            <label className="font-semibold">
                                Shift / Time :
                            </label>

                            <input
                                type="time"
                                className="ml-2 border-b border-gray-500 outline-none"
                                value={
                                    form.shiftTime
                                }
                                onChange={e =>
                                    handleChange(
                                        'shiftTime',
                                        e.target.value
                                    )
                                }
                            />

                        </div>

                    </div>

                </div>


                {/* ==================================================
                    NATURE OF PROBLEM
                ================================================== */}

                <div className="border-2 border-gray-800 border-t-0 p-3">

                    <label className="font-bold block">
                        Nature of Problem
                    </label>

                    <label className="font-bold block">
                        Reasons for Action Required :
                    </label>

                    <textarea
                        className="w-full min-h-[145px] mt-2 border border-gray-300 p-3 resize-y outline-none"
                        value={
                            form.natureOfProblem
                        }
                        onChange={e =>
                            handleChange(
                                'natureOfProblem',
                                e.target.value
                            )
                        }
                    />


                    <div className="grid grid-cols-2 mt-3">

                        <div>

                            <label className="font-semibold">
                                Received by :
                            </label>

                            <input
                                type="text"
                                className="ml-2 border-b border-gray-500 outline-none"
                                value={
                                    form.receivedBy
                                }
                                onChange={e =>
                                    handleChange(
                                        'receivedBy',
                                        e.target.value
                                    )
                                }
                            />

                        </div>


                        <div className="text-right">

                            <label className="font-semibold">
                                Action Intimated By :
                            </label>

                            <input
                                type="text"
                                className="ml-2 border-b border-gray-500 outline-none"
                                value={
                                    form.actionIntimatedBy
                                }
                                onChange={e =>
                                    handleChange(
                                        'actionIntimatedBy',
                                        e.target.value
                                    )
                                }
                            />

                        </div>

                    </div>

                </div>


                {/* ==================================================
                    ACTION TAKEN
                ================================================== */}

                <div className="border-2 border-gray-800 border-t-0 p-3">

                    <label className="font-bold">
                        Details of Action Taken :
                    </label>

                    <textarea
                        className="w-full min-h-[150px] mt-2 border border-gray-300 p-3 resize-y outline-none"
                        value={
                            form.actionTakenDetails
                        }
                        onChange={e =>
                            handleChange(
                                'actionTakenDetails',
                                e.target.value
                            )
                        }
                    />

                </div>


                {/* ==================================================
                    OBSERVATION
                ================================================== */}

                <div className="border-2 border-gray-800 border-t-0 p-3">

                    <label className="font-bold">
                        Details of Observation of the Toolings :
                    </label>

                    <textarea
                        className="w-full min-h-[150px] mt-2 border border-gray-300 p-3 resize-y outline-none"
                        value={
                            form.toolingObservation
                        }
                        onChange={e =>
                            handleChange(
                                'toolingObservation',
                                e.target.value
                            )
                        }
                    />


                    <div className="flex justify-end mt-2">

                        <label className="font-semibold">
                            Action Taken By :
                        </label>

                        <input
                            type="text"
                            className="ml-2 border-b border-gray-500 outline-none"
                            value={
                                form.actionTakenBy
                            }
                            onChange={e =>
                                handleChange(
                                    'actionTakenBy',
                                    e.target.value
                                )
                            }
                        />

                    </div>

                </div>


                {/* ==================================================
                    WORK DETAILS
                ================================================== */}

                <div className="border-2 border-gray-800 border-t-0">

                    <div className="grid grid-cols-3">

                        <div className="border-r border-gray-800 p-2">

                            <label className="font-semibold">
                                Work Started at :
                            </label>

                            <input
                                type="datetime-local"
                                className="w-full mt-2 border border-gray-300 p-2"
                                value={
                                    form.workStartedAt
                                }
                                onChange={e =>
                                    handleChange(
                                        'workStartedAt',
                                        e.target.value
                                    )
                                }
                            />

                        </div>


                        <div className="border-r border-gray-800 p-2">

                            <label className="font-semibold">
                                Work Completed at :
                            </label>

                            <input
                                type="datetime-local"
                                className="w-full mt-2 border border-gray-300 p-2"
                                value={
                                    form.workCompletedAt
                                }
                                onChange={e =>
                                    handleChange(
                                        'workCompletedAt',
                                        e.target.value
                                    )
                                }
                            />

                        </div>


                        <div className="p-2">

                            <label className="font-semibold">
                                Time Lost :
                            </label>

                            <input
                                type="text"
                                className="w-full mt-2 border border-gray-300 p-2"
                                value={
                                    form.timeLost
                                }
                                onChange={e =>
                                    handleChange(
                                        'timeLost',
                                        e.target.value
                                    )
                                }
                            />

                        </div>

                    </div>

                </div>


                {/* ==================================================
                    FEEDBACK
                ================================================== */}

                <div className="border-2 border-gray-800 border-t-0 p-3">

                    <label className="font-bold">
                        Feedback on Corrective Action :
                    </label>

                    <textarea
                        className="w-full min-h-[130px] mt-2 border border-gray-300 p-3"
                        value={
                            form.correctiveActionFeedback
                        }
                        onChange={e =>
                            handleChange(
                                'correctiveActionFeedback',
                                e.target.value
                            )
                        }
                    />

                    <div className="flex justify-end mt-2">

                        <label className="font-semibold">
                            Feedback Given By :
                        </label>

                        <input
                            type="text"
                            className="ml-2 border-b border-gray-500 outline-none"
                            value={
                                form.feedbackGivenBy
                            }
                            onChange={e =>
                                handleChange(
                                    'feedbackGivenBy',
                                    e.target.value
                                )
                            }
                        />

                    </div>

                </div>


                {/* ==================================================
                    DELAY
                ================================================== */}

                <div className="border-2 border-gray-800 border-t-0 p-3">

                    <label className="font-bold">
                        Reason for Undue Delay :
                    </label>

                    <textarea
                        className="w-full min-h-[120px] mt-2 border border-gray-300 p-3"
                        value={
                            form.reasonForUndueDelay
                        }
                        onChange={e =>
                            handleChange(
                                'reasonForUndueDelay',
                                e.target.value
                            )
                        }
                    />

                </div>


                {/* ==================================================
                    WORK / SPARES
                ================================================== */}

                <div className="border-2 border-gray-800 border-t-0 p-3">

                    <label className="font-bold">
                        Details of work attended by & Details of spares Consumed :
                    </label>

                    <textarea
                        className="w-full min-h-[160px] mt-2 border border-gray-300 p-3"
                        value={
                            form.workAndSparesDetails
                        }
                        onChange={e =>
                            handleChange(
                                'workAndSparesDetails',
                                e.target.value
                            )
                        }
                    />

                </div>


                {/* ==================================================
                    M.EX / MYDOU / J&F
                ================================================== */}

                <div className="border-2 border-gray-800 border-t-0 p-3">

                    <label className="font-bold">
                        M.Ex / MYDOU / J&F :
                    </label>

                    <input
                        type="text"
                        className="ml-3 border-b border-gray-500 outline-none"
                        value={
                            form.mexMydouJf
                        }
                        onChange={e =>
                            handleChange(
                                'mexMydouJf',
                                e.target.value
                            )
                        }
                    />

                </div>


                {/* PAGE NAVIGATION */}

                <div className="flex justify-end mt-5">

                    <button
                        type="button"
                        onClick={nextPage}
                        className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 rounded-lg font-bold shadow-lg"
                    >
                        NEXT → PAGE 2
                    </button>

                </div>

            </div>

        );

    };


    // ========================================================
    // PAGE 2
    // ========================================================

    const renderPageTwo = () => {

        return (

            <div className="bg-white w-full max-w-[90rem] rounded-xl shadow-2xl border-4 border-gray-100 p-6">

                {/* ==================================================
                    PAGE TITLE
                ================================================== */}

                <div className="border-2 border-gray-800 p-3 mb-5">

                    <div className="text-center font-bold text-xl">
                        TOOLING CORRECTIVE ACTION INTIMATION SLIP
                    </div>

                    <div className="text-center text-sm text-gray-600 mt-1">
                        Page 2 - Stock Card / Checklist / Preventive Action
                    </div>

                </div>


                {/* ==================================================
                    STOCK CARDS
                ================================================== */}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                    <div>
                        {renderStockTable(1)}
                    </div>

                    <div>
                        {renderStockTable(2)}
                    </div>

                </div>


                {/* ==================================================
                    CHECKLIST
                ================================================== */}

                <div className="mt-8">

                    <div className="font-bold text-xl mb-3">
                        Check List For Data Entry
                    </div>


                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                        {/* 1 - 6 */}

                        <div>

                            {renderChecklistTable(
                                0,
                                6
                            )}

                        </div>


                        {/* 7 - 12 */}

                        <div>

                            {renderChecklistTable(
                                6,
                                12
                            )}

                        </div>

                    </div>

                </div>


                {/* ==================================================
                    PREVENTIVE ACTION
                ================================================== */}

                <div className="mt-8 border-2 border-gray-800">

                    <div className="border-b-2 border-gray-800 p-3 font-bold">

                        Details Of Preventive Action Required & Taken

                    </div>

                    <textarea
                        className="w-full min-h-[250px] p-4 outline-none resize-y"
                        value={
                            form.preventiveAction
                        }
                        onChange={e =>
                            handleChange(
                                'preventiveAction',
                                e.target.value
                            )
                        }
                    />

                </div>


                {/* ==================================================
                    SHIFT INCHARGE APPROVAL
                ================================================== */}

                <div className="mt-8 border-2 border-gray-800">

                    <div className="p-5">

                        <div className="font-bold text-lg">
                            Shift Incharge Signature
                        </div>


                        {!signatures["Shift Incharge"] ? (

                            <div className="mt-4">

                                <button
                                    type="button"
                                    onClick={
                                        handleApprove
                                    }
                                    className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded font-bold"
                                >
                                    APPROVE
                                </button>

                            </div>

                        ) : (

                            <div className="mt-4">

                                <span className="text-green-600 font-bold">
                                    Approved ✓
                                </span>

                                <div className="mt-1 font-black uppercase">
                                    {
                                        signatures[
                                            "Shift Incharge"
                                        ]
                                    }
                                </div>

                            </div>

                        )}

                    </div>

                </div>


                {/* ==================================================
                    PAGE NAVIGATION + SAVE
                ================================================== */}

                <div className="flex justify-between items-center gap-4 mt-6 pt-4 border-t border-gray-300">

                    <button
                        type="button"
                        onClick={previousPage}
                        className="bg-gray-700 hover:bg-gray-800 text-white px-8 py-3 rounded-lg font-bold shadow-lg"
                    >
                        ← BACK TO PAGE 1
                    </button>


                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={
                            isSaving ||
                            saveSuccess
                        }
                        className="bg-gray-800 hover:bg-gray-900 disabled:bg-gray-400 text-white px-10 py-3 rounded-lg font-bold shadow-lg uppercase tracking-wider"
                    >

                        {isSaving
                            ? 'SAVING...'
                            : saveSuccess
                                ? 'SAVED ✓'
                                : 'SAVE & CONTINUE'
                        }

                    </button>

                </div>

            </div>

        );

    };


    // ========================================================
    // MAIN UI
    // ========================================================

    return (

        <div className="min-h-screen bg-[#2d2d2d] flex flex-col items-center p-6 pb-20">

            <Header />


            {/* ==================================================
                TOAST
            ================================================== */}

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


            {/* ==================================================
                SAVE LOADING
            ================================================== */}

            {(isSaving || saveSuccess) && (

                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[90]">

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


            {/* ==================================================
                PAGE SELECTOR
            ================================================== */}

            {renderPageSelector()}


            {/* ==================================================
                PAGE CONTENT
            ================================================== */}

            {currentPage === 1
                ? renderPageOne()
                : renderPageTwo()
            }

        </div>

    );

}