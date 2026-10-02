import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Header from '../components/Header';
import { useLineSet } from '../context/LineSetContext';

const initialForm = {
    recordDate: '',
    lineCode: '',
    partName: '',
    partNo: '',
    machineNo: '',
    problemDescription: '',
    problemCategory: '',
    quantity: 1,
    rootCause: '',
    correctiveAction: '',
    result: ''
};

const CorrectiveActionRegister = () => {
    const { shopId } = useParams();
    const { lineSet, setLineSet } = useLineSet();

    const currentUser =
        JSON.parse(localStorage.getItem('user'))?.username ||
        'Unknown';

    // =========================================================
    // FORM
    // =========================================================
    const [formData, setFormData] = useState(initialForm);

    // =========================================================
    // MACHINE / LINE DATA
    // =========================================================
    const [machineDetails, setMachineDetails] = useState([]);
    const [lineMappings, setLineMappings] = useState([]);
    const [loadingMachineDetails, setLoadingMachineDetails] =
        useState(true);

    // =========================================================
    // RECORDS
    // =========================================================
    const [records, setRecords] = useState([]);
    const [loadingRecords, setLoadingRecords] = useState(false);

    // =========================================================
    // EDIT
    // =========================================================
    const [editingId, setEditingId] = useState(null);

    // =========================================================
    // DELETE
    // =========================================================
    const [deleteId, setDeleteId] = useState(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    // =========================================================
    // APPROVAL
    // =========================================================
    const [signatures, setSignatures] = useState({
        'Shift Incharge': ''
    });

    // =========================================================
    // FORM DISPLAY
    // =========================================================
    const [showForm, setShowForm] = useState(true);

    // =========================================================
    // TOAST
    // =========================================================
    const [toast, setToast] = useState({
        show: false,
        message: '',
        type: 'success'
    });

    // =========================================================
    // TOAST FUNCTION
    // =========================================================
    const triggerToast = (message, type = 'success') => {
        setToast({
            show: true,
            message,
            type
        });

        setTimeout(() => {
            setToast({
                show: false,
                message: '',
                type: 'success'
            });
        }, 3000);
    };

    // =========================================================
    // FETCH MACHINE DETAILS + LINE MAPPINGS
    // =========================================================
    useEffect(() => {
        const fetchData = async () => {
            try {
                if (!shopId) return;

                setLoadingMachineDetails(true);

                const token =
                    localStorage.getItem('token');

                const headers = {
                    Authorization: `Bearer ${token}`
                };

                // MACHINE DETAILS
                const machineRes = await fetch(
                    `${process.env.REACT_APP_API_URL}/api/machine-shop/${shopId}/pre-operation-details`,
                    {
                        headers
                    }
                );

                if (machineRes.ok) {
                    const machineData =
                        await machineRes.json();

                    setMachineDetails(
                        Array.isArray(machineData)
                            ? machineData
                            : []
                    );
                } else {
                    console.error(
                        'Failed to fetch machine details:',
                        machineRes.status
                    );

                    setMachineDetails([]);
                }

                // LINE MAPPINGS
                const mappingRes = await fetch(
                    `${process.env.REACT_APP_API_URL}/api/mappings/${shopId}/lines`,
                    {
                        headers
                    }
                );

                if (mappingRes.ok) {
                    const mappingData =
                        await mappingRes.json();

                    setLineMappings(
                        Array.isArray(mappingData)
                            ? mappingData
                            : []
                    );
                } else {
                    console.error(
                        'Failed to fetch line mappings:',
                        mappingRes.status
                    );

                    setLineMappings([]);
                }
            } catch (error) {
                console.error(
                    'Error fetching machine data:',
                    error
                );

                triggerToast(
                    'Failed to load machine and line details.',
                    'error'
                );
            } finally {
                setLoadingMachineDetails(false);
            }
        };

        fetchData();
    }, [shopId]);

    // =========================================================
    // FETCH CORRECTIVE ACTION RECORDS
    // =========================================================
    const fetchRecords = async () => {
        try {
            if (!shopId) return;

            setLoadingRecords(true);

            const token =
                localStorage.getItem('token');

            const response = await fetch(
                `${process.env.REACT_APP_API_URL}/api/corrective-actions/${shopId}`,
                {
                    headers: {
                        Authorization:
                            `Bearer ${token}`
                    }
                }
            );

            if (!response.ok) {
                throw new Error(
                    `Failed to fetch records: ${response.status}`
                );
            }

            const data =
                await response.json();

            setRecords(
                Array.isArray(data)
                    ? data
                    : []
            );
        } catch (error) {
            console.error(
                'Error fetching corrective action records:',
                error
            );

            triggerToast(
                'Failed to load corrective action records.',
                'error'
            );
        } finally {
            setLoadingRecords(false);
        }
    };

    useEffect(() => {
        fetchRecords();
    }, [shopId]);

    // =========================================================
    // LINE CODE OPTIONS
    // =========================================================
    const lineCodes =
        lineMappings.length > 0
            ? [
                  ...new Set(
                      lineMappings
                          .map(
                              (item) =>
                                  item.lineCode
                          )
                          .filter(Boolean)
                  )
              ]
            : [
                  ...new Set(
                      machineDetails
                          .map(
                              (item) =>
                                  item.lineCode
                          )
                          .filter(Boolean)
                  )
              ];

    // =========================================================
    // MACHINE OPTIONS BASED ON SELECTED LINE
    // =========================================================
    const machineOptionsRaw =
        machineDetails.filter(
            (item) =>
                item.lineCode ===
                formData.lineCode
        );

    const machineOptions =
        Array.from(
            new Set(
                machineOptionsRaw
                    .map(
                        (item) =>
                            item.machineNo
                    )
                    .filter(Boolean)
            )
        ).map((machineNo) =>
            machineOptionsRaw.find(
                (item) =>
                    item.machineNo ===
                    machineNo
            )
        );

    // =========================================================
    // SYNC WITH LINE SET
    // =========================================================
    useEffect(() => {
        if (!lineSet || editingId) return;

        setFormData((prev) => ({
            ...prev,

            lineCode:
                lineSet.lineCode ||
                prev.lineCode ||
                '',

            partName:
                lineSet.partName ||
                prev.partName ||
                '',

            partNo:
                lineSet.partNo ||
                prev.partNo ||
                '',

            machineNo:
                lineSet.machineNo ||
                prev.machineNo ||
                ''
        }));
    }, [lineSet, editingId]);

    // =========================================================
    // LINE CHANGE
    // =========================================================
    const handleLineChange = (lineCode) => {
        const mapping =
            lineMappings.find(
                (item) =>
                    item.lineCode ===
                    lineCode
            );

        const machineDetail =
            machineDetails.find(
                (item) =>
                    item.lineCode ===
                    lineCode
            );

        const autoPartName =
            mapping?.partSet ||
            machineDetail?.partName ||
            '';

        const autoPartNo =
            mapping?.idSet ||
            machineDetail?.partNo ||
            '';

        setFormData((prev) => ({
            ...prev,

            lineCode,

            partName:
                autoPartName,

            partNo:
                autoPartNo,

            machineNo: ''
        }));

        setLineSet({
            machineShop: shopId,
            lineCode,

            partName:
                autoPartName,

            partNo:
                autoPartNo,

            machineNo: ''
        });
    };

    // =========================================================
    // MACHINE CHANGE
    // =========================================================
    const handleMachineChange = (
        machineNo
    ) => {
        const selectedMachine =
            machineDetails.find(
                (item) =>
                    item.lineCode ===
                        formData.lineCode &&
                    item.machineNo ===
                        machineNo
            );

        const partName =
            formData.partName ||
            selectedMachine?.partName ||
            '';

        const partNo =
            formData.partNo ||
            selectedMachine?.partNo ||
            '';

        setFormData((prev) => ({
            ...prev,

            machineNo,

            partName,

            partNo
        }));

        setLineSet({
            machineShop: shopId,

            lineCode:
                formData.lineCode,

            partName,

            partNo,

            machineNo
        });
    };

    // =========================================================
    // INPUT CHANGE
    // =========================================================
    const handleChange = (e) => {
        const {
            name,
            value
        } = e.target;

        setFormData((prev) => ({
            ...prev,

            [name]: value
        }));
    };

    // =========================================================
    // SHIFT INCHARGE APPROVAL
    // =========================================================
    const handleApprove = () => {
        setSignatures({
            'Shift Incharge':
                currentUser
        });

        triggerToast(
            'Shift Incharge approval completed.',
            'success'
        );
    };

    // =========================================================
    // VALIDATION
    // =========================================================
    const validateForm = () => {
        if (!formData.recordDate) {
            triggerToast(
                'Please select the record date.',
                'error'
            );
            return false;
        }

        if (!formData.lineCode) {
            triggerToast(
                'Please select the Line Code.',
                'error'
            );
            return false;
        }

        if (!formData.partName) {
            triggerToast(
                'Part Name is required.',
                'error'
            );
            return false;
        }

        if (!formData.partNo) {
            triggerToast(
                'Part No is required.',
                'error'
            );
            return false;
        }

        if (!formData.machineNo) {
            triggerToast(
                'Please select the Machine No.',
                'error'
            );
            return false;
        }

        if (
            !formData.problemDescription.trim()
        ) {
            triggerToast(
                'Please enter the problem description.',
                'error'
            );
            return false;
        }

        if (!formData.problemCategory) {
            triggerToast(
                'Please select the problem category.',
                'error'
            );
            return false;
        }

        if (
            !formData.quantity ||
            Number(formData.quantity) <= 0
        ) {
            triggerToast(
                'Quantity must be greater than 0.',
                'error'
            );
            return false;
        }

        if (
            !signatures['Shift Incharge']
        ) {
            triggerToast(
                "Please click 'Approve' to complete Shift Incharge approval.",
                'error'
            );
            return false;
        }

        return true;
    };

    // =========================================================
    // SAVE / UPDATE
    // =========================================================
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) return;

        try {
            const token =
                localStorage.getItem('token');

            const payload = {
                machineShop:
                    shopId,

                lineCode:
                    formData.lineCode,

                partName:
                    formData.partName,

                partNo:
                    formData.partNo,

                machineNo:
                    formData.machineNo,

                recordDate:
                    formData.recordDate,

                problemDescription:
                    formData.problemDescription,

                problemCategory:
                    formData.problemCategory,

                quantity:
                    Number(
                        formData.quantity
                    ),

                rootCause:
                    formData.rootCause,

                correctiveAction:
                    formData.correctiveAction,

                result:
                    formData.result,

                shiftInchargeSignature:
                    signatures[
                        'Shift Incharge'
                    ]
            };

            const url = editingId
                ? `${process.env.REACT_APP_API_URL}/api/corrective-actions/${editingId}`
                : `${process.env.REACT_APP_API_URL}/api/corrective-actions`;

            const method = editingId
                ? 'PUT'
                : 'POST';

            const response =
                await fetch(
                    url,
                    {
                        method,

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
                await response.json();

            if (!response.ok) {
                throw new Error(
                    data?.message ||
                        data?.error ||
                        'Failed to save record.'
                );
            }

            triggerToast(
                editingId
                    ? 'Corrective Action record updated successfully.'
                    : 'Corrective Action record saved successfully.',
                'success'
            );

            resetForm();

            await fetchRecords();
        } catch (error) {
            console.error(
                'Save error:',
                error
            );

            triggerToast(
                error.message ||
                    'Failed to save Corrective Action record.',
                'error'
            );
        }
    };

    // =========================================================
    // EDIT RECORD
    // =========================================================
    const handleEdit = (record) => {
        setEditingId(
            record.id
        );

        setFormData({
            recordDate:
                record.recordDate
                    ? String(
                          record.recordDate
                      ).substring(
                          0,
                          10
                      )
                    : '',

            lineCode:
                record.lineCode ||
                '',

            partName:
                record.partName ||
                '',

            partNo:
                record.partNo ||
                '',

            machineNo:
                record.machineNo ||
                '',

            problemDescription:
                record.problemDescription ||
                '',

            problemCategory:
                record.problemCategory ||
                '',

            quantity:
                record.quantity !==
                    undefined &&
                record.quantity !==
                    null
                    ? record.quantity
                    : 1,

            rootCause:
                record.rootCause ||
                '',

            correctiveAction:
                record.correctiveAction ||
                '',

            result:
                record.result ||
                ''
        });

        setSignatures({
            'Shift Incharge':
                record.shiftInchargeSignature ||
                ''
        });

        setLineSet({
            machineShop:
                shopId,

            lineCode:
                record.lineCode ||
                '',

            partName:
                record.partName ||
                '',

            partNo:
                record.partNo ||
                '',

            machineNo:
                record.machineNo ||
                ''
        });

        setShowForm(true);

        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    };

    // =========================================================
    // OPEN DELETE CONFIRMATION
    // =========================================================
    const handleDeleteClick = (
        id
    ) => {
        setDeleteId(id);
    };

    // =========================================================
    // CANCEL DELETE
    // =========================================================
    const handleCancelDelete = () => {
        if (deleteLoading)
            return;

        setDeleteId(null);
    };

    // =========================================================
    // DELETE RECORD
    // =========================================================
    const handleDelete = async () => {
        if (!deleteId) return;

        try {
            setDeleteLoading(true);

            const token =
                localStorage.getItem(
                    'token'
                );

            const response =
                await fetch(
                    `${process.env.REACT_APP_API_URL}/api/corrective-actions/${deleteId}`,
                    {
                        method:
                            'DELETE',

                        headers: {
                            Authorization:
                                `Bearer ${token}`
                        }
                    }
                );

            let data = {};

            try {
                data =
                    await response.json();
            } catch {
                data = {};
            }

            if (!response.ok) {
                throw new Error(
                    data?.message ||
                        data?.error ||
                        `Delete failed with status ${response.status}`
                );
            }

            // Remove deleted record immediately
            setRecords(
                (prevRecords) =>
                    prevRecords.filter(
                        (record) =>
                            record.id !==
                            deleteId
                    )
            );

            setDeleteId(null);

            triggerToast(
                'Corrective Action record deleted successfully.',
                'success'
            );

            // Refresh from database
            await fetchRecords();
        } catch (error) {
            console.error(
                'Delete error:',
                error
            );

            triggerToast(
                error.message ||
                    'Failed to delete the record.',
                'error'
            );
        } finally {
            setDeleteLoading(false);
        }
    };

    // =========================================================
    // RESET FORM
    // =========================================================
    const resetForm = () => {
        setEditingId(null);

        setSignatures({
            'Shift Incharge': ''
        });

        setFormData({
            ...initialForm
        });
    };

    // =========================================================
    // DATE FORMAT
    // =========================================================
    const formatDate = (
        dateValue
    ) => {
        if (!dateValue)
            return '-';

        const date =
            new Date(dateValue);

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return dateValue;
        }

        return date.toLocaleDateString(
            'en-IN'
        );
    };

    // =========================================================
    // UI
    // =========================================================
    return (
        <div className="min-h-screen bg-gray-100">

            <Header />

            {/* ================================================= */}
            {/* TOAST */}
            {/* ================================================= */}
            {toast.show && (
                <div
                    className={`fixed top-5 right-5 z-[100] min-w-[320px] max-w-[450px] px-6 py-4 rounded-lg shadow-xl text-white font-bold flex items-center gap-3 ${
                        toast.type ===
                        'success'
                            ? 'bg-green-600'
                            : 'bg-red-600'
                    }`}
                >
                    <span className="text-xl">
                        {toast.type ===
                        'success'
                            ? '✓'
                            : '✕'}
                    </span>

                    <span>
                        {toast.message}
                    </span>
                </div>
            )}

            {/* ================================================= */}
            {/* DELETE CONFIRMATION */}
            {/* ================================================= */}
            {deleteId && (
                <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black bg-opacity-50 px-4">

                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">

                        <div className="flex items-center justify-center mb-4">

                            <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">

                                <span className="text-2xl text-red-600 font-black">
                                    !
                                </span>

                            </div>

                        </div>

                        <h3 className="text-xl font-black text-gray-800 text-center mb-2">
                            Delete Record?
                        </h3>

                        <p className="text-gray-600 text-center mb-6">
                            Are you sure you want to delete
                            this Corrective Action record?
                            <br />
                            This action cannot be undone.
                        </p>

                        <div className="flex justify-center gap-3">

                            <button
                                type="button"
                                onClick={
                                    handleCancelDelete
                                }
                                disabled={
                                    deleteLoading
                                }
                                className="px-6 py-3 rounded-lg bg-gray-500 hover:bg-gray-600 text-white font-bold disabled:opacity-50"
                            >
                                CANCEL
                            </button>

                            <button
                                type="button"
                                onClick={
                                    handleDelete
                                }
                                disabled={
                                    deleteLoading
                                }
                                className="px-6 py-3 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold disabled:opacity-50"
                            >
                                {deleteLoading
                                    ? 'DELETING...'
                                    : 'DELETE'}
                            </button>

                        </div>

                    </div>

                </div>
            )}

            <div className="max-w-7xl mx-auto px-4 py-6">

                {/* ================================================= */}
                {/* PAGE TITLE */}
                {/* ================================================= */}
                <div className="bg-white rounded-lg shadow-md p-5 mb-6">

                    <h1 className="text-2xl font-black text-gray-800 uppercase">
                        Corrective Action Register
                    </h1>

                    <p className="text-sm text-gray-500 mt-1">
                        Record and monitor corrective actions
                    </p>

                </div>

                {/* ================================================= */}
                {/* FORM */}
                {/* ================================================= */}
                {showForm && (
                    <form
                        onSubmit={
                            handleSubmit
                        }
                        className="bg-white rounded-lg shadow-md p-6 mb-8"
                    >

                        {/* ================================================= */}
                        {/* MACHINE DETAILS */}
                        {/* ================================================= */}
                        <div className="border-2 border-gray-800 rounded-lg p-5 mb-6">

                            <h2 className="font-bold text-lg text-gray-800 mb-5">
                                MACHINE DETAILS
                            </h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">

                                {/* LINE CODE */}
                                <div>

                                    <label className="block text-sm font-bold text-gray-700 mb-2">
                                        Line Code
                                    </label>

                                    <select
                                        value={
                                            formData.lineCode
                                        }
                                        onChange={(
                                            e
                                        ) =>
                                            handleLineChange(
                                                e.target.value
                                            )
                                        }
                                        disabled={
                                            loadingMachineDetails ||
                                            !!editingId
                                        }
                                        className="w-full border border-gray-400 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                    >

                                        <option value="">
                                            Select Line Code
                                        </option>

                                        {lineCodes.map(
                                            (
                                                lineCode
                                            ) => (
                                                <option
                                                    key={
                                                        lineCode
                                                    }
                                                    value={
                                                        lineCode
                                                    }
                                                >
                                                    {
                                                        lineCode
                                                    }
                                                </option>
                                            )
                                        )}

                                    </select>

                                </div>

                                {/* PART NAME */}
                                <div>

                                    <label className="block text-sm font-bold text-gray-700 mb-2">
                                        Part Name
                                    </label>

                                    <input
                                        type="text"
                                        value={
                                            formData.partName
                                        }
                                        readOnly
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 bg-gray-100"
                                        placeholder="Auto-filled"
                                    />

                                </div>

                                {/* PART NO */}
                                <div>

                                    <label className="block text-sm font-bold text-gray-700 mb-2">
                                        Part No
                                    </label>

                                    <input
                                        type="text"
                                        value={
                                            formData.partNo
                                        }
                                        readOnly
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 bg-gray-100"
                                        placeholder="Auto-filled"
                                    />

                                </div>

                                {/* MACHINE NO */}
                                <div>

                                    <label className="block text-sm font-bold text-gray-700 mb-2">
                                        Machine No
                                    </label>

                                    <select
                                        value={
                                            formData.machineNo
                                        }
                                        onChange={(
                                            e
                                        ) =>
                                            handleMachineChange(
                                                e.target.value
                                            )
                                        }
                                        disabled={
                                            !formData.lineCode ||
                                            loadingMachineDetails ||
                                            !!editingId
                                        }
                                        className="w-full border border-gray-400 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                    >

                                        <option value="">
                                            Select Machine No
                                        </option>

                                        {machineOptions.map(
                                            (
                                                machine,
                                                index
                                            ) => (
                                                <option
                                                    key={`${machine.machineNo}-${index}`}
                                                    value={
                                                        machine.machineNo
                                                    }
                                                >
                                                    {
                                                        machine.machineNo
                                                    }

                                                    {machine.machineType
                                                        ? ` - ${machine.machineType}`
                                                        : ''}
                                                </option>
                                            )
                                        )}

                                    </select>

                                </div>

                            </div>

                            {/* DATE */}
                            <div className="mt-5 max-w-xs">

                                <label className="block text-sm font-bold text-gray-700 mb-2">
                                    Date
                                </label>

                                <input
                                    type="date"
                                    name="recordDate"
                                    value={
                                        formData.recordDate
                                    }
                                    onChange={
                                        handleChange
                                    }
                                    className="w-full border border-gray-400 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500"
                                />

                            </div>

                        </div>

                        {/* ================================================= */}
                        {/* PROBLEM DETAILS */}
                        {/* ================================================= */}
                        <div className="border-2 border-gray-800 rounded-lg p-5 mb-6">

                            <h2 className="font-bold text-lg text-gray-800 mb-5">
                                PROBLEM DETAILS
                            </h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                                {/* PROBLEM DESCRIPTION */}
                                <div className="md:col-span-2">

                                    <label className="block text-sm font-bold text-gray-700 mb-2">
                                        Problem Description
                                    </label>

                                    <textarea
                                        name="problemDescription"
                                        value={
                                            formData.problemDescription
                                        }
                                        onChange={
                                            handleChange
                                        }
                                        rows="4"
                                        className="w-full border border-gray-400 rounded-lg px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-orange-500"
                                        placeholder="Enter problem description"
                                    />

                                </div>

                                {/* PROBLEM CATEGORY */}
                                <div>

                                    <label className="block text-sm font-bold text-gray-700 mb-2">
                                        Problem Category
                                    </label>

                                    <select
                                        name="problemCategory"
                                        value={
                                            formData.problemCategory
                                        }
                                        onChange={
                                            handleChange
                                        }
                                        className="w-full border border-gray-400 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                    >

                                        <option value="">
                                            Select Category
                                        </option>

                                        <option value="A">
                                            A
                                        </option>

                                        <option value="B">
                                            B
                                        </option>

                                        <option value="C">
                                            C
                                        </option>

                                        <option value="D">
                                            D
                                        </option>

                                        <option value="E">
                                            E
                                        </option>

                                    </select>

                                </div>

                                {/* QUANTITY */}
                                <div>

                                    <label className="block text-sm font-bold text-gray-700 mb-2">
                                        Quantity
                                    </label>

                                    <input
                                        type="number"
                                        name="quantity"
                                        min="1"
                                        value={
                                            formData.quantity
                                        }
                                        onChange={
                                            handleChange
                                        }
                                        className="w-full border border-gray-400 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500"
                                    />

                                </div>

                            </div>

                        </div>

                        {/* ================================================= */}
                        {/* ROOT CAUSE */}
                        {/* ================================================= */}
                        <div className="border-2 border-gray-800 rounded-lg p-5 mb-6">

                            <h2 className="font-bold text-lg text-gray-800 mb-5">
                                ROOT CAUSE
                            </h2>

                            <textarea
                                name="rootCause"
                                value={
                                    formData.rootCause
                                }
                                onChange={
                                    handleChange
                                }
                                rows="4"
                                className="w-full border border-gray-400 rounded-lg px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-orange-500"
                                placeholder="Enter root cause"
                            />

                        </div>

                        {/* ================================================= */}
                        {/* CORRECTIVE ACTION */}
                        {/* ================================================= */}
                        <div className="border-2 border-gray-800 rounded-lg p-5 mb-6">

                            <h2 className="font-bold text-lg text-gray-800 mb-5">
                                CORRECTIVE ACTION
                            </h2>

                            <textarea
                                name="correctiveAction"
                                value={
                                    formData.correctiveAction
                                }
                                onChange={
                                    handleChange
                                }
                                rows="4"
                                className="w-full border border-gray-400 rounded-lg px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-orange-500"
                                placeholder="Enter corrective action"
                            />

                        </div>

                        {/* ================================================= */}
                        {/* RESULT */}
                        {/* ================================================= */}
                        <div className="border-2 border-gray-800 rounded-lg p-5 mb-6">

                            <h2 className="font-bold text-lg text-gray-800 mb-5">
                                RESULT
                            </h2>

                            <textarea
                                name="result"
                                value={
                                    formData.result
                                }
                                onChange={
                                    handleChange
                                }
                                rows="3"
                                className="w-full border border-gray-400 rounded-lg px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-orange-500"
                                placeholder="Enter result"
                            />

                        </div>

                        {/* ================================================= */}
                        {/* APPROVAL */}
                        {/* ================================================= */}
                        <div className="border-2 border-gray-800 rounded-lg p-5 mb-6">

                            <h2 className="font-bold text-lg text-gray-800 mb-4">
                                APPROVAL
                            </h2>

                            <div className="border border-gray-300 rounded-lg p-4 max-w-md">

                                <p className="font-bold text-gray-700 mb-3">
                                    Shift Incharge Signature
                                </p>

                                {signatures[
                                    'Shift Incharge'
                                ] ? (
                                    <div className="text-center">

                                        <span className="text-xs font-bold text-green-600 block">
                                            Approved By ✓
                                        </span>

                                        <span className="text-lg font-black text-gray-900 uppercase">
                                            {
                                                signatures[
                                                    'Shift Incharge'
                                                ]
                                            }
                                        </span>

                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={
                                            handleApprove
                                        }
                                        className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold px-8 py-3 rounded shadow uppercase"
                                    >
                                        APPROVE
                                    </button>
                                )}

                            </div>

                        </div>

                        {/* ================================================= */}
                        {/* FORM BUTTONS */}
                        {/* ================================================= */}
                        <div className="flex flex-wrap gap-3 justify-end mb-8">

                            <button
                                type="button"
                                onClick={
                                    resetForm
                                }
                                className="bg-gray-500 hover:bg-gray-600 text-white font-bold px-6 py-3 rounded-lg uppercase"
                            >
                                RESET
                            </button>

                            <button
                                type="submit"
                                className="bg-green-600 hover:bg-green-700 text-white font-bold px-8 py-3 rounded-lg uppercase"
                            >
                                {editingId
                                    ? 'UPDATE RECORD'
                                    : 'SAVE RECORD'}
                            </button>

                        </div>

                        {/* ================================================= */}
                        {/* FORM FOOTER / PROBLEM CATEGORY NOTE */}
                        {/* ================================================= */}
                        <div className="border-2 border-gray-800 p-4 text-sm text-gray-800">

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">

                                {/* DOCUMENT NUMBER */}
                                <div className="font-bold">

                                    <p>
                                        QF/08/MRO-04,
                                        Rev.No: 03
                                    </p>

                                    <p>
                                        dt 20.08.2024
                                    </p>

                                </div>

                                {/* NOTE + A */}
                                <div>

                                    <p className="font-bold mb-1">
                                        Note:
                                    </p>

                                    <p className="font-semibold">
                                        The Problem Category
                                        to be mentioned as
                                        A or B or C or D or E
                                    </p>

                                    <p className="mt-2">
                                        <span className="font-bold">
                                            A -
                                        </span>{' '}
                                        More than 5 parts
                                        in same defect in
                                        a single day
                                        (Machining)
                                    </p>

                                </div>

                                {/* B + C */}
                                <div>

                                    <p>
                                        <span className="font-bold">
                                            B -
                                        </span>{' '}
                                        Repeated rejections
                                    </p>

                                    <p className="mt-2">
                                        <span className="font-bold">
                                            C -
                                        </span>{' '}
                                        A single defect in
                                        Customer specified
                                        characteristics
                                        (Special / Critical /
                                        Safety
                                        Characteristics)
                                    </p>

                                </div>

                                {/* D + E */}
                                <div>

                                    <p>
                                        <span className="font-bold">
                                            D -
                                        </span>{' '}
                                        A single defect due
                                        to Crack &amp; part
                                        broken.
                                    </p>

                                    <p className="mt-2">
                                        <span className="font-bold">
                                            E -
                                        </span>{' '}
                                        Any new defect
                                        occurred.
                                    </p>

                                </div>

                            </div>

                        </div>

                    </form>
                )}

                {/* ================================================= */}
                {/* RECORDS */}
                {/* ================================================= */}
                <div className="bg-white rounded-lg shadow-md p-6">

                    <div className="flex justify-between items-center mb-5">

                        <h2 className="text-xl font-black text-gray-800 uppercase">
                            Corrective Action Records
                        </h2>

                        <button
                            type="button"
                            onClick={() =>
                                setShowForm(
                                    !showForm
                                )
                            }
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2 rounded-lg"
                        >
                            {showForm
                                ? 'HIDE FORM'
                                : 'NEW RECORD'}
                        </button>

                    </div>

                    {/* LOADING */}
                    {loadingRecords ? (
                        <div className="text-center py-10 text-gray-500">
                            Loading records...
                        </div>
                    ) : records.length === 0 ? (
                        <div className="text-center py-10 text-gray-500">
                            No corrective action records found.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">

                            <table className="w-full border-collapse border border-gray-300 text-sm">

                                <thead>

                                    <tr className="bg-gray-800 text-white">

                                        <th className="border border-gray-300 px-3 py-3">
                                            S.No
                                        </th>

                                        <th className="border border-gray-300 px-3 py-3">
                                            Date
                                        </th>

                                        <th className="border border-gray-300 px-3 py-3">
                                            Line
                                        </th>

                                        <th className="border border-gray-300 px-3 py-3">
                                            Part Name
                                        </th>

                                        <th className="border border-gray-300 px-3 py-3">
                                            Part No
                                        </th>

                                        <th className="border border-gray-300 px-3 py-3">
                                            Machine
                                        </th>

                                        <th className="border border-gray-300 px-3 py-3">
                                            Problem
                                        </th>

                                        <th className="border border-gray-300 px-3 py-3">
                                            Category
                                        </th>

                                        <th className="border border-gray-300 px-3 py-3">
                                            Qty
                                        </th>

                                        <th className="border border-gray-300 px-3 py-3">
                                            Shift Incharge
                                        </th>

                                        <th className="border border-gray-300 px-3 py-3">
                                            Actions
                                        </th>

                                    </tr>

                                </thead>

                                <tbody>

                                    {records.map(
                                        (
                                            record,
                                            index
                                        ) => (

                                            <tr
                                                key={
                                                    record.id
                                                }
                                                className="hover:bg-gray-50"
                                            >

                                                <td className="border border-gray-300 px-3 py-3 text-center">
                                                    {index +
                                                        1}
                                                </td>

                                                <td className="border border-gray-300 px-3 py-3">
                                                    {formatDate(
                                                        record.recordDate
                                                    )}
                                                </td>

                                                <td className="border border-gray-300 px-3 py-3 font-bold">
                                                    {record.lineCode ||
                                                        '-'}
                                                </td>

                                                <td className="border border-gray-300 px-3 py-3">
                                                    {record.partName ||
                                                        '-'}
                                                </td>

                                                <td className="border border-gray-300 px-3 py-3">
                                                    {record.partNo ||
                                                        '-'}
                                                </td>

                                                <td className="border border-gray-300 px-3 py-3">
                                                    {record.machineNo ||
                                                        '-'}
                                                </td>

                                                <td className="border border-gray-300 px-3 py-3 max-w-xs">
                                                    {record.problemDescription ||
                                                        '-'}
                                                </td>

                                                <td className="border border-gray-300 px-3 py-3 text-center font-bold">
                                                    {record.problemCategory ||
                                                        '-'}
                                                </td>

                                                <td className="border border-gray-300 px-3 py-3 text-center">
                                                    {record.quantity ??
                                                        '-'}
                                                </td>

                                                <td className="border border-gray-300 px-3 py-3 text-center">

                                                    {record.shiftInchargeSignature ? (
                                                        <span className="text-green-600 font-bold">
                                                            {
                                                                record.shiftInchargeSignature
                                                            }
                                                        </span>
                                                    ) : (
                                                        <span className="text-red-500">
                                                            Pending
                                                        </span>
                                                    )}

                                                </td>

                                                {/* ACTIONS */}
                                                <td className="border border-gray-300 px-3 py-3">

                                                    <div className="flex gap-2">

                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                handleEdit(
                                                                    record
                                                                )
                                                            }
                                                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded font-bold"
                                                        >
                                                            EDIT
                                                        </button>

                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                handleDeleteClick(
                                                                    record.id
                                                                )
                                                            }
                                                            className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded font-bold"
                                                        >
                                                            DELETE
                                                        </button>

                                                    </div>

                                                </td>

                                            </tr>

                                        )
                                    )}

                                </tbody>

                            </table>

                        </div>
                    )}

                </div>

            </div>

        </div>
    );
};

export default CorrectiveActionRegister;