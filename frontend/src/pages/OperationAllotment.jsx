import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { FileDown } from 'lucide-react';
import Header from '../components/Header';

const API_BASE = 'http://localhost:5000/api'; 

const initialForm = { 
    lineCode: '', 
    recordDate: '', 
    shift: '', 
    oprNo1: '', 
    oprNo2: '', 
    oprNo3: '', 
    oprNo4: '', 
    oprNo5: '', 
    proQty: '', 
    incNo: '', 
    productEngineer: '' 
}; 

const Toast = ({ toast }) => { 
    if (!toast) return null; 
    return ( 
        <div 
            className={`fixed bottom-6 right-6 z-[100] px-5 py-3 rounded-lg shadow-lg text-white ${ 
                toast.type === 'error' ? 'bg-red-600' : 'bg-green-600' 
            }`} 
        > 
            {toast.message} 
        </div> 
    ); 
}; 

const OperatorAllotment = () => { 
    const { shopId } = useParams(); 
    const [form, setForm] = useState(initialForm); 
    const [lineCodes, setLineCodes] = useState([]); 
    const [productEngineers, setProductEngineers] = useState([]); 
    const [loading, setLoading] = useState(true); 
    const [saving, setSaving] = useState(false); 
    const [toast, setToast] = useState(null); 
    const [recordExists, setRecordExists] = useState(false); 
    const [peStatus, setPeStatus] = useState('Pending'); 
    const [peApproved, setPeApproved] = useState(false); 

    const showToast = (message, type = 'success') => { 
        setToast({ message, type }); 
        setTimeout(() => setToast(null), 3000); 
    }; 

    // Fetch initial dropdown values
    useEffect(() => { 
        const loadDropdowns = async () => { 
            try { 
                setLoading(true); 

                // Fetch Line Codes
                const lineResponse = await fetch(`${API_BASE}/operator-allotment/lines`, {
                    headers: { 'Accept': 'application/json' }
                }); 
                if (!lineResponse.ok) { 
                    const errorData = await lineResponse.json().catch(() => ({})); 
                    throw new Error(errorData.error || 'Failed to fetch Line Codes'); 
                } 
                const lineData = await lineResponse.json(); 
                const rawLines = lineData.lines || lineData.lineCodes || []; 
                const normalizedLines = rawLines.map(line => typeof line === 'string' ? line : line.lineCode || '').filter(Boolean); 
                setLineCodes(normalizedLines); 

                // Fetch Product Engineers
                const peResponse = await fetch(`${API_BASE}/operator-allotment/product-managers`, {
                    headers: { 'Accept': 'application/json' }
                }); 
                if (!peResponse.ok) { 
                    const errorData = await peResponse.json().catch(() => ({})); 
                    throw new Error(errorData.error || 'Failed to fetch Product Engineers'); 
                } 
                const peData = await peResponse.json(); 
                setProductEngineers(peData.peList || peData.productManagers || peData.productEngineers || []); 

            } catch (error) { 
                console.error('Operator Allotment dropdown error:', error); 
                showToast(error.message || 'Failed to load dropdown data', 'error'); 
            } finally { 
                setLoading(false); 
            } 
        }; 

        loadDropdowns(); 
    }, []); 

    // Fetch allotment data automatically when recordDate or lineCode changes
    const fetchRecord = useCallback(async (date, lineCode) => {
        if (!date || !lineCode) {
            setRecordExists(false);
            setPeStatus('Pending');
            setPeApproved(false);
            return;
        }

        try {
            const response = await fetch(
                `${API_BASE}/operator-allotment?date=${encodeURIComponent(date)}&lineCode=${encodeURIComponent(lineCode)}`,
                { headers: { 'Accept': 'application/json' } }
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Failed to fetch record');
            }

            const data = await response.json();

            if (data.exists && data.data) {
                const row = data.data;
                setForm(prev => ({
                    ...prev,
                    shift: row.shift || '',
                    oprNo1: row.oprNo1 || '',
                    oprNo2: row.oprNo2 || '',
                    oprNo3: row.oprNo3 || '',
                    oprNo4: row.oprNo4 || '',
                    oprNo5: row.oprNo5 || '',
                    proQty: row.proQty || '',
                    incNo: row.incNo || '',
                    productEngineer: row.productEngineer || ''
                }));

                setRecordExists(true);
                setPeStatus(row.peStatus || 'Pending');
                setPeApproved(row.peStatus === 'Approved');
            } else {
                setForm(prev => ({
                    ...initialForm,
                    lineCode: prev.lineCode,
                    recordDate: prev.recordDate
                }));
                setRecordExists(false);
                setPeStatus('Pending');
                setPeApproved(false);
            }
        } catch (error) {
            console.error('Auto fetch record error:', error);
            showToast(error.message || 'Failed to fetch record data', 'error');
        }
    }, []);

    useEffect(() => {
        fetchRecord(form.recordDate, form.lineCode);
    }, [form.recordDate, form.lineCode, fetchRecord]);

    const handleChange = (e) => { 
        const { name, value } = e.target; 
        setForm(prev => ({ ...prev, [name]: value })); 
    }; 

    const handleSave = async () => { 
        if (!form.lineCode) { showToast('Please select Line Code', 'error'); return; } 
        if (!form.recordDate) { showToast('Please select Date', 'error'); return; } 
        if (!form.shift) { showToast('Please select Shift', 'error'); return; } 
        if (!form.productEngineer) { showToast('Please select Product Engineer', 'error'); return; } 
        if (peApproved) { showToast('Approved record cannot be edited', 'error'); return; } 

        try { 
            setSaving(true); 
            const response = await fetch(`${API_BASE}/operator-allotment`, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify(form) 
            }); 

            const data = await response.json(); 
            if (!response.ok) throw new Error(data.error || 'Failed to save'); 

            setRecordExists(true); 
            setPeStatus(data.peStatus || 'Pending'); 
            setPeApproved(false); 
            showToast(data.message || 'Operator Allotment saved and sent to Product Engineer for verification!'); 

        } catch (error) { 
            console.error(error); 
            showToast(error.message || 'Failed to save Operator Allotment', 'error'); 
        } finally { 
            setSaving(false); 
        } 
    }; 

    const downloadReport = async () => { 
        if (!form.recordDate) { showToast('Please select Date', 'error'); return; } 
        if (!form.lineCode) { showToast('Please select Line Code', 'error'); return; } 

        try { 
            const response = await fetch( 
                `${API_BASE}/operator-allotment/report?date=${encodeURIComponent(form.recordDate)}&lineCode=${encodeURIComponent(form.lineCode)}` 
            ); 

            if (!response.ok) { 
                const data = await response.json().catch(() => ({})); 
                throw new Error(data.error || 'Failed to generate report'); 
            } 

            const blob = await response.blob(); 
            const url = window.URL.createObjectURL(blob); 
            const link = document.createElement('a'); 
            link.href = url; 
            link.download = `Operator_Allotment_${form.lineCode}_${form.recordDate}.pdf`; 
            document.body.appendChild(link); 
            link.click(); 
            link.remove(); 
            window.URL.revokeObjectURL(url); 

        } catch (error) { 
            console.error(error); 
            showToast(error.message || 'Failed to generate PDF', 'error'); 
        } 
    }; 

    if (loading) { 
        return ( 
            <div className="min-h-screen bg-[#2d2d2d] flex items-center justify-center"> 
                <div className="bg-white rounded-xl px-8 py-6 shadow-2xl"> 
                    Loading Operator Allotment... 
                </div> 
            </div> 
        ); 
    } 

    return ( 
        <div className="min-h-screen bg-[#2d2d2d] flex flex-col items-center justify-center p-6 pb-20"> 
            <Header />
            <Toast toast={toast} /> 

            {saving && ( 
                <div className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center"> 
                    <div className="bg-white rounded-xl px-8 py-6 shadow-2xl flex items-center gap-4"> 
                        <div className="w-6 h-6 border-4 border-gray-300 border-t-orange-500 rounded-full animate-spin" /> 
                        <span className="font-semibold">Saving...</span> 
                    </div> 
                </div> 
            )} 

            <div className="bg-white w-full max-w-[95rem] rounded-xl p-8 shadow-2xl mt-6"> 
                <div className="flex items-start justify-between mb-6"> 
                    <div> 
                        <div className="text-orange-600 font-bold text-sm">SAKTHI AUTO</div> 
                        <h1 className="text-3xl font-bold text-gray-800 mt-1">OPERATOR ALLOTMENT SHEET</h1> 
                        <p className="text-xs text-gray-500 mt-1">QF/07/MPD-06 &nbsp; | &nbsp; Revision 05 &nbsp; | &nbsp; Revision Date: 10.07.2026</p> 
                    </div> 

                    <button 
                        type="button" 
                        onClick={downloadReport} 
                        className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer" 
                    > 
                        <FileDown size={18} /> 
                        Download Report 
                    </button> 
                </div> 

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6"> 
                    <div> 
                        <label className="block text-sm font-semibold text-gray-700 mb-2">LINE CODE</label> 
                        <select 
                            name="lineCode" 
                            value={form.lineCode} 
                            onChange={handleChange} 
                            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500" 
                        > 
                            <option value="">Select Line Code</option> 
                            {lineCodes.map((line, index) => ( 
                                <option key={index} value={line}>{line}</option> 
                            ))} 
                        </select> 
                    </div> 

                    <div> 
                        <label className="block text-sm font-semibold text-gray-700 mb-2">DATE</label> 
                        <input 
                            type="date" 
                            name="recordDate" 
                            value={form.recordDate} 
                            onChange={handleChange} 
                            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500" 
                        /> 
                    </div> 
                </div> 

                <div className="border border-gray-800 rounded-lg overflow-hidden"> 
                    <div className="overflow-x-auto"> 
                        <table className="w-full border-collapse"> 
                            <thead> 
                                <tr className="bg-[#eeeeee]"> 
                                    <th className="border border-gray-700 px-3 py-3 text-sm font-bold whitespace-nowrap">SHIFT</th> 
                                    <th className="border border-gray-700 px-3 py-3 text-sm font-bold whitespace-nowrap">OPR NO 1</th> 
                                    <th className="border border-gray-700 px-3 py-3 text-sm font-bold whitespace-nowrap">OPR NO 2</th> 
                                    <th className="border border-gray-700 px-3 py-3 text-sm font-bold whitespace-nowrap">OPR NO 3</th> 
                                    <th className="border border-gray-700 px-3 py-3 text-sm font-bold whitespace-nowrap">OPR NO 4</th> 
                                    <th className="border border-gray-700 px-3 py-3 text-sm font-bold whitespace-nowrap">OPR NO 5</th> 
                                    <th className="border border-gray-700 px-3 py-3 text-sm font-bold whitespace-nowrap">PRO QTY</th> 
                                    <th className="border border-gray-700 px-3 py-3 text-sm font-bold whitespace-nowrap">INC NO</th> 
                                    <th className="border border-gray-700 px-3 py-3 text-sm font-bold whitespace-nowrap">PRODUCT ENGINEER</th> 
                                </tr> 
                            </thead> 

                            <tbody> 
                                <tr> 
                                    <td className="border border-gray-700 p-2"> 
                                        <select 
                                            name="shift" 
                                            value={form.shift} 
                                            onChange={handleChange} 
                                            disabled={peApproved} 
                                            className="w-full min-w-[120px] border border-gray-300 rounded-md px-2 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500" 
                                        > 
                                            <option value="">Select Shift</option> 
                                            <option value="1">Shift 1</option> 
                                            <option value="2">Shift 2</option> 
                                            <option value="3">Shift 3</option> 
                                        </select> 
                                    </td> 

                                    <td className="border border-gray-700 p-2"> 
                                        <input name="oprNo1" value={form.oprNo1} onChange={handleChange} disabled={peApproved} className="w-full min-w-[110px] border border-gray-300 rounded-md px-2 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500" /> 
                                    </td> 

                                    <td className="border border-gray-700 p-2"> 
                                        <input name="oprNo2" value={form.oprNo2} onChange={handleChange} disabled={peApproved} className="w-full min-w-[110px] border border-gray-300 rounded-md px-2 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500" /> 
                                    </td> 

                                    <td className="border border-gray-700 p-2"> 
                                        <input name="oprNo3" value={form.oprNo3} onChange={handleChange} disabled={peApproved} className="w-full min-w-[110px] border border-gray-300 rounded-md px-2 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500" /> 
                                    </td> 

                                    <td className="border border-gray-700 p-2"> 
                                        <input name="oprNo4" value={form.oprNo4} onChange={handleChange} disabled={peApproved} className="w-full min-w-[110px] border border-gray-300 rounded-md px-2 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500" /> 
                                    </td> 

                                    <td className="border border-gray-700 p-2"> 
                                        <input name="oprNo5" value={form.oprNo5} onChange={handleChange} disabled={peApproved} className="w-full min-w-[110px] border border-gray-300 rounded-md px-2 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500" /> 
                                    </td> 

                                    <td className="border border-gray-700 p-2"> 
                                        <input name="proQty" value={form.proQty} onChange={handleChange} disabled={peApproved} className="w-full min-w-[110px] border border-gray-300 rounded-md px-2 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500" /> 
                                    </td> 

                                    <td className="border border-gray-700 p-2"> 
                                        <input name="incNo" value={form.incNo} onChange={handleChange} disabled={peApproved} className="w-full min-w-[110px] border border-gray-300 rounded-md px-2 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500" /> 
                                    </td> 

                                    <td className="border border-gray-700 p-2"> 
                                        <select 
                                            name="productEngineer" 
                                            value={form.productEngineer} 
                                            onChange={handleChange} 
                                            disabled={peApproved} 
                                            className="w-full min-w-[180px] border border-gray-300 rounded-md px-2 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500" 
                                        > 
                                            <option value="">Select Product Engineer</option> 
                                            {productEngineers.map((pe, index) => ( 
                                                <option key={pe.employeeId || pe.username || index} value={pe.username}> 
                                                    {pe.name || pe.username} 
                                                </option> 
                                            ))} 
                                        </select> 
                                    </td> 
                                </tr> 
                            </tbody> 
                        </table> 
                    </div> 
                </div> 

                {recordExists && ( 
                    <div className="mt-5 flex items-center gap-3"> 
                        <span className="font-semibold text-gray-700">PE Status:</span> 
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${peStatus === 'Approved' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}> 
                            {peStatus} 
                        </span> 
                    </div> 
                )} 

                <div className="flex justify-end gap-4 mt-6"> 
                    <button 
                        type="button" 
                        onClick={handleSave} 
                        disabled={saving || peApproved} 
                        className="bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white px-8 py-3 rounded-lg font-bold shadow cursor-pointer" 
                    > 
                        {saving ? 'Saving...' : 'Save'} 
                    </button> 
                </div> 
            </div> 
        </div> 
    ); 
}; 

export default OperatorAllotment;