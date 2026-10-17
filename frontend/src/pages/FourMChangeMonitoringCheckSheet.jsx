import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FileDown, Calendar, X } from "lucide-react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Header from "../components/Header";

const formMeta = {
  formCode: "QF / 07 / MPD-36",
  revision: "01",
  revisionDate: "13.03.2019",
  title: "4M CHANGE MONITORING CHECK SHEET",
  company: "SAKTHI AUTO"
};

const getTodayISODate = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const emptyRow = (dateVal = getTodayISODate(), shiftVal = "I", mcVal = "") => ({
  date: dateVal,
  shift: shiftVal,
  dateShift: `${dateVal} ${shiftVal}`.trim(),
  mcNo: mcVal,
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
  const navigate = useNavigate();

  const [headerInfo, setHeaderInfo] = useState({
    machineShop: shopId || "",
    lineCode: "",
    partName: "",
    partNo: "",
    machineNo: ""
  });

  const [machineDetails, setMachineDetails] = useState([]);
  const [lineMappings, setLineMappings] = useState([]);
  const [loadingMachineDetails, setLoadingMachineDetails] = useState(true);
  const [hodUsers, setHodUsers] = useState([]);

  const [rows, setRows] = useState([emptyRow()]);
  const [hodSign, setHodSign] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSavedRecord, setIsSavedRecord] = useState(false);

  // PDF Date Range Modal States
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfFromDate, setPdfFromDate] = useState("");
  const [pdfToDate, setPdfToDate] = useState("");
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  // Dynamic QF States
  const [qfHistory, setQfHistory] = useState([]);
  const [qfValue, setQfValue] = useState("QF / 07 / MPD-36, Rev.No: 01, 13.03.2019");

  const lookupSeqRef = useRef(0);
  const currentUser = JSON.parse(localStorage.getItem('user'))?.username || 'Unknown';

  const triggerToast = (message, type = 'error') => {
    if (type === 'success') toast.success(message);
    else toast.error(message);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!shopId) return;
        const token = localStorage.getItem("token");
        const headers = { Authorization: `Bearer ${token}` };

        // Fetch Machine Details
        const machineRes = await fetch(`${process.env.REACT_APP_API_URL || ""}/api/machine-shop/${shopId}/pre-operation-details`, { headers });
        if (machineRes.ok) setMachineDetails(await machineRes.json());

        // Fetch Line Mappings
        const mappingRes = await fetch(`${process.env.REACT_APP_API_URL || ""}/api/mappings/${shopId}/lines`, { headers });
        if (mappingRes.ok) setLineMappings(await mappingRes.json());

        // Fetch HOD Users
        const hodRes = await fetch(`${process.env.REACT_APP_API_URL || ""}/api/four-m-change-monitoring/hods`, { headers });
        if (hodRes.ok) {
          const hodData = await hodRes.json();
          setHodUsers(hodData.hodList || []);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoadingMachineDetails(false);
      }
    };
    fetchData();
  }, [shopId]);

  // ==========================================================
  // FETCH QF HISTORY ON MOUNT
  // ==========================================================
  useEffect(() => {
    const fetchQfHistory = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(
          `${process.env.REACT_APP_API_URL || ""}/api/qf-values/history/four-m-change-monitoring`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.ok) {
          const historyData = await res.json();
          setQfHistory(historyData);
        }
      } catch (err) {
        console.error("Failed to load QF history", err);
      }
    };
    fetchQfHistory();
  }, []);

  // ==========================================================
  // TRACK CURRENT LINE, MACHINE, DATE, AND SHIFT COMBO
  // ==========================================================
  const firstRowDate = rows[0]?.date || "";
  const firstRowShift = rows[0]?.shift || "I";
  const selectedMachineNo = rows.find(r => r.mcNo)?.mcNo || headerInfo.machineNo || "";

  // ==========================================================
  // CALCULATE QF BASED ON SELECTED DATE
  // ==========================================================
  useEffect(() => {
    let currentQf = "QF / 07 / MPD-36, Rev.No: 01, 13.03.2019"; // Fallback

    if (firstRowDate && qfHistory.length > 0) {
      const selectedDate = new Date(firstRowDate);
      selectedDate.setHours(0, 0, 0, 0);

      for (let qf of qfHistory) {
        if (!qf.date) continue;
        const qfDate = new Date(qf.date);
        qfDate.setHours(0, 0, 0, 0);

        if (qfDate <= selectedDate) {
          currentQf = qf.qfValue;
          break;
        }
      }
    } else if (qfHistory.length > 0) {
      currentQf = qfHistory[0].qfValue;
    }

    setQfValue(currentQf);
  }, [firstRowDate, qfHistory]);

  useEffect(() => {
    const checkExistingRecord = async () => {
      if (!headerInfo.lineCode || !selectedMachineNo || !firstRowDate || !firstRowShift) {
        setIsSavedRecord(false);
        setHodSign("");
        return;
      }

      const seq = ++lookupSeqRef.current;
      try {
        const token = localStorage.getItem("token");
        const params = new URLSearchParams({
          machineShop: shopId || "3",
          lineCode: headerInfo.lineCode,
          machineNo: selectedMachineNo,
          date: firstRowDate,
          shift: firstRowShift
        });

        const res = await fetch(
          `${process.env.REACT_APP_API_URL || ""}/api/four-m-change-monitoring/record?${params.toString()}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (seq !== lookupSeqRef.current) return;

        if (res.ok) {
          const record = await res.json();
          if (seq !== lookupSeqRef.current) return;

          if (record && record.rows && record.rows.length > 0) {
            setIsSavedRecord(true);
            setRows(record.rows);
            if (record.hodSign) {
              setHodSign(record.hodSign);
            }
            triggerToast("Existing 4M record loaded for this combo.", "success");
          } else {
            setIsSavedRecord(false);
            setHodSign("");
            setRows([emptyRow(firstRowDate, firstRowShift, selectedMachineNo)]);
          }
        }
      } catch (err) {
        console.error("Error fetching existing 4M record:", err);
      }
    };

    checkExistingRecord();
  }, [shopId, headerInfo.lineCode, selectedMachineNo, firstRowDate, firstRowShift]);

  const lineCodes = lineMappings.length > 0
    ? lineMappings.map((m) => m.lineCode)
    : [...new Set(machineDetails.map((item) => item.lineCode).filter(Boolean))];

  const handleLineCodeChange = (lineCode) => {
    const mapping = lineMappings.find((m) => m.lineCode === lineCode);
    const autoPartName = mapping?.partSet || "";
    const autoPartNo = mapping?.idSet || "";

    setHeaderInfo((prev) => ({
      ...prev, lineCode, partName: autoPartName, partNo: autoPartNo, machineNo: ""
    }));

    setRows([emptyRow(firstRowDate || getTodayISODate(), firstRowShift || "I", "")]);
    setHodSign("");
    setIsSavedRecord(false);
  };

  const handleMachineNoChange = (rowIdx, machineNo) => {
    setHeaderInfo((prev) => ({ ...prev, machineNo }));
    setRows((prev) => {
      const next = [...prev];
      next[rowIdx] = { ...emptyRow(next[rowIdx]?.date || getTodayISODate(), next[rowIdx]?.shift || "I", machineNo) };
      return next;
    });
    setHodSign("");
    setIsSavedRecord(false);
  };

  const handleDateChange = (rowIdx, newDate) => {
    setRows((prev) => {
      const next = [...prev];
      next[rowIdx] = { ...emptyRow(newDate, next[rowIdx]?.shift || "I", next[rowIdx]?.mcNo || selectedMachineNo) };
      return next;
    });
    setHodSign("");
    setIsSavedRecord(false);
  };

  const handleShiftChange = (rowIdx, newShift) => {
    setRows((prev) => {
      const next = [...prev];
      next[rowIdx] = { ...emptyRow(next[rowIdx]?.date || getTodayISODate(), newShift, next[rowIdx]?.mcNo || selectedMachineNo) };
      return next;
    });
    setHodSign("");
    setIsSavedRecord(false);
  };

  const handleAddRow = () => setRows((prev) => [...prev, emptyRow(firstRowDate || getTodayISODate(), firstRowShift || "I", selectedMachineNo)]);
  const handleRemoveRow = () => setRows((prev) => prev.length > 1 ? prev.slice(0, -1) : prev);

  const handleRowChange = (rowIdx, field, val) => {
    setRows((prev) => {
      const next = [...prev];
      next[rowIdx] = { ...next[rowIdx], [field]: val };
      return next;
    });
  };

  const handleApproveIncharge = (rIdx) => {
    const row = rows[rIdx];
    const mc = row.mcNo || selectedMachineNo;

    if (!headerInfo.lineCode || !row.date || !mc || !row.shift) {
      triggerToast("Please select Line Code, Date, Machine No, and Shift first.", "error");
      return;
    }

    const hasData = Boolean(
      row.typeOf4M || row.description || row.firstPart || row.lastPart ||
      row.inspectionFrequency || row.retroChecking || row.quarantine ||
      row.partIdentification || row.internalCommunication
    );

    if (!hasData) {
      triggerToast("Please fill row parameters before approving.", "error");
      return;
    }

    handleRowChange(rIdx, "inchargeSign", currentUser);
    triggerToast("Incharge signature approved successfully!", "success");
  };

  const handleDownloadPdfRange = async () => {
    if (!pdfFromDate || !pdfToDate) {
      triggerToast("Please select both From Date and To Date.", "error");
      return;
    }

    if (new Date(pdfFromDate) > new Date(pdfToDate)) {
      triggerToast("From Date cannot be later than To Date.", "error");
      return;
    }

    setIsDownloadingPdf(true);
    try {
      const token = localStorage.getItem("token");
      const params = new URLSearchParams({
        fromDate: pdfFromDate,
        toDate: pdfToDate,
        shopId: String(shopId || 3)
      });

      const url = `${process.env.REACT_APP_API_URL || ""}/api/four-m-change-monitoring/report?${params.toString()}`;
      const response = await fetch(url, { method: "GET", headers: { Authorization: `Bearer ${token}` } });

      if (response.status === 404) {
        throw new Error("No records found for the selected date range.");
      }
      if (!response.ok) {
        throw new Error("Failed to generate PDF report from server.");
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `4M_Change_Report_${pdfFromDate}_to_${pdfToDate}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      setShowPdfModal(false);
      triggerToast("PDF generated and downloaded!", "success");
    } catch (err) {
      triggerToast(err.message || "Failed to download PDF", "error");
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleSave = async () => {
    if (!headerInfo.machineShop) return triggerToast("Machine shop is missing.", "error");
    if (!headerInfo.lineCode) return triggerToast("Please select a Line Code.", "error");
    if (!headerInfo.partName) return triggerToast("Part Name is missing.", "error");
    if (!selectedMachineNo) return triggerToast("Please select a Machine No in the table.", "error");

    for (let rIdx = 0; rIdx < rows.length; rIdx++) {
      const row = rows[rIdx];
      const hasDataEntered = Boolean(
        row.date || row.mcNo || row.typeOf4M || row.description || 
        row.firstPart || row.lastPart || row.inspectionFrequency || 
        row.retroChecking || row.quarantine || row.partIdentification || 
        row.internalCommunication
      );

      if (hasDataEntered && !row.inchargeSign) {
        return triggerToast(`The Approve button must be selected for row ${rIdx + 1}.`, "error");
      }
    }

    if (!hodSign) return triggerToast("Please assign an HOD for verification.", "error");

    setIsSaving(true);

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
        dateShift: `${r.date || ""} ${r.shift || ""}`.trim() || r.date || r.dateShift
      })),
      hodSign: hodSign
    };

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${process.env.REACT_APP_API_URL || ""}/api/four-m-change-monitoring`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.message || "Save failed");
      }

      setIsSavedRecord(true);

      // Check if Retro Checking requires redirection to Significant Event Record
      const requiresSignificantEvent = rows.some(r => r.retroChecking === "✓");

      if (requiresSignificantEvent) {
        triggerToast("4M CheckSheet saved! Redirecting to Significant Event...", "success");
        setTimeout(() => {
          // Fixed navigation route based on the Shift Incharge dashboard configuration
          navigate(`/shift-incharge/${shopId || 3}/significant-event-record`, {
            state: {
              lineCode: headerInfo.lineCode,
              partName: headerInfo.partName,
              mcNo: selectedMachineNo,
              date: firstRowDate || getTodayISODate(),
              shift: firstRowShift || "I"
            }
          });
        }, 2000);
      } else {
        triggerToast("4M CheckSheet saved successfully!", "success");
      }
    } catch (err) {
      triggerToast(err.message || "Failed to save checksheet.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#2d2d2d] flex flex-col items-center justify-center p-6 pb-20">
      <Header/>
      <ToastContainer position="top-right" autoClose={3000} />

      {/* Date Range Modal for PDF Download */}
      {showPdfModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md border-2 border-gray-100 animate-in fade-in">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-orange-500" />
                <h3 className="text-lg font-bold text-gray-800 uppercase tracking-wide">Download Report by Date Range</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setShowPdfModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="font-bold text-gray-700 block mb-1 text-xs uppercase tracking-wider">From Date</label>
                <input
                  type="date"
                  className="w-full border border-gray-300 p-2.5 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm font-semibold bg-white"
                  value={pdfFromDate}
                  onChange={(e) => setPdfFromDate(e.target.value)}
                />
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1 text-xs uppercase tracking-wider">To Date</label>
                <input
                  type="date"
                  className="w-full border border-gray-300 p-2.5 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm font-semibold bg-white"
                  value={pdfToDate}
                  onChange={(e) => setPdfToDate(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowPdfModal(false)}
                className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-gray-600 hover:bg-gray-100 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDownloadPdfRange}
                disabled={isDownloadingPdf}
                className="flex items-center gap-2 bg-gray-800 hover:bg-gray-900 disabled:bg-gray-400 text-white px-5 py-2 rounded font-bold text-xs uppercase tracking-wider shadow transition-colors cursor-pointer"
              >
                <FileDown className="w-4 h-4" />
                {isDownloadingPdf ? "Downloading..." : "Download Report"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white w-full max-w-[95rem] rounded-xl p-8 shadow-2xl overflow-x-auto border-4 border-gray-100">
        
        <div className="flex justify-between items-center mb-6 border-b border-gray-200 pb-4">
          <div>
            <span className="text-xs font-bold text-orange-600 tracking-wider uppercase block mb-1">{formMeta.company}</span>
            <h2 className="text-2xl font-bold text-gray-800 uppercase tracking-wide">{formMeta.title}</h2>
            {/* Dynamic QF Value Display */}
            <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-2 font-bold">
              <span>{qfValue}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowPdfModal(true)}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider shadow transition-colors cursor-pointer"
          >
            <FileDown className="w-4 h-4" /> Download Report
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="font-bold text-gray-700 block mb-1 text-sm">Line Code</label>
            <select
              className="w-full border border-gray-300 p-2 rounded text-sm font-semibold bg-white"
              value={headerInfo.lineCode}
              onChange={(e) => handleLineCodeChange(e.target.value)}
              disabled={loadingMachineDetails}
            >
              <option value="">{loadingMachineDetails ? "Loading..." : "Select Line Code"}</option>
              {lineCodes.map((lc) => (<option key={lc} value={lc}>{lc}</option>))}
            </select>
          </div>
          <div>
            <label className="font-bold text-gray-700 block mb-1 text-sm">Part No</label>
            <input type="text" readOnly className="w-full border border-gray-300 p-2 rounded text-sm font-semibold bg-gray-100" value={headerInfo.partNo} placeholder="Auto-filled" />
          </div>
          <div>
            <label className="font-bold text-gray-700 block mb-1 text-sm">Part Name</label>
            <input type="text" readOnly className="w-full border border-gray-300 p-2 rounded text-sm font-semibold bg-gray-100" value={headerInfo.partName} placeholder="Auto-filled" />
          </div>
        </div>

        <div className="flex justify-between items-center mb-2 px-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Checksheet Items</span>
            <span className="text-[11px] bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full font-semibold">{rows.length} {rows.length === 1 ? "Row" : "Rows"}</span>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleAddRow} className="inline-flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-4 py-1.5 rounded transition-colors shadow hover:cursor-pointer">+ Add Row</button>
            {rows.length > 1 && (
              <button type="button" onClick={handleRemoveRow} className="inline-flex items-center gap-1 bg-gray-600 hover:bg-gray-700 text-white text-xs font-bold px-3 py-1.5 rounded transition-colors shadow hover:cursor-pointer">− Delete Row</button>
            )}
          </div>
        </div>

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
                <th className="border border-gray-800 p-2 w-32">Inspection Frequency<br /><span className="text-[10px] font-normal text-gray-600 block mt-0.5">N - Normal / I - Increase</span></th>
                <th className="border border-gray-800 p-2 w-28">Retro<br />checking</th>
                <th className="border border-gray-800 p-2 w-28">Quarantine</th>
                <th className="border border-gray-800 p-2 w-32">Part<br />Identification</th>
                <th className="border border-gray-800 p-2 w-36">Internal<br />Communication</th>
                <th className="border border-gray-800 p-2 w-28">Incharge<br />Sign</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rIdx) => {
                const machineOptionsRaw = machineDetails.filter((item) => item.lineCode === headerInfo.lineCode);
                const machineOptions = Array.from(new Set(machineOptionsRaw.map((m) => m.machineNo).filter(Boolean))).map((mc) => machineOptionsRaw.find((m) => m.machineNo === mc));
                
                return (
                <tr key={`row-${rIdx}`} className="h-9">
                  <td className="border border-gray-800 p-0">
                    <input 
                      type="date" 
                      className="w-full h-full text-center outline-none bg-transparent py-1.5 px-1 font-medium" 
                      value={row.date} 
                      onChange={(e) => handleDateChange(rIdx, e.target.value)} 
                    />
                  </td>
                  <td className="border border-gray-800 p-0">
                    <select 
                      value={row.shift} 
                      className="w-full h-full text-center outline-none bg-transparent py-1.5 cursor-pointer font-bold text-sm" 
                      onChange={(e) => handleShiftChange(rIdx, e.target.value)}
                    >
                      <option value="I">I</option>
                      <option value="II">II</option>
                      <option value="III">III</option>
                    </select>
                  </td>
                  <td className="border border-gray-800 p-0">
                    <select 
                      value={row.mcNo} 
                      className="w-full h-full text-center outline-none bg-transparent py-1.5 cursor-pointer font-bold text-sm" 
                      onChange={(e) => handleMachineNoChange(rIdx, e.target.value)} 
                      disabled={!headerInfo.lineCode}
                    >
                      <option value="">Select</option>
                      {machineOptions.map((machine) => (<option key={machine.id} value={machine.machineNo}>{machine.machineNo}</option>))}
                    </select>
                  </td>
                  
                  {/* TYPE OF 4M DROPDOWN */}
                  <td className="border border-gray-800 p-0">
                    <select 
                      value={row.typeOf4M} 
                      className="w-full h-full text-center outline-none bg-transparent py-1.5 cursor-pointer font-bold text-sm" 
                      onChange={(e) => handleRowChange(rIdx, "typeOf4M", e.target.value)}
                    >
                      <option value="">Select</option>
                      <option value="Man">Man</option>
                      <option value="Machine">Machine</option>
                      <option value="Method">Method</option>
                      <option value="Material">Material</option>
                    </select>
                  </td>

                  <td className="border border-gray-800 p-0"><input type="text" className="w-full h-full text-left px-3 outline-none bg-transparent py-1.5 font-medium" value={row.description} onChange={(e) => handleRowChange(rIdx, "description", e.target.value)} /></td>
                  <td className="border border-gray-800 p-0"><select value={row.firstPart} className="w-full h-full text-center outline-none bg-transparent py-1.5 cursor-pointer font-bold text-sm" onChange={(e) => handleRowChange(rIdx, "firstPart", e.target.value)}><option value=""></option><option value="✓">✓</option><option value="X">X</option></select></td>
                  <td className="border border-gray-800 p-0"><select value={row.lastPart} className="w-full h-full text-center outline-none bg-transparent py-1.5 cursor-pointer font-bold text-sm" onChange={(e) => handleRowChange(rIdx, "lastPart", e.target.value)}><option value=""></option><option value="✓">✓</option><option value="X">X</option></select></td>
                  <td className="border border-gray-800 p-0"><select value={row.inspectionFrequency} className="w-full h-full text-center outline-none bg-transparent py-1.5 cursor-pointer font-bold text-sm" onChange={(e) => handleRowChange(rIdx, "inspectionFrequency", e.target.value)}><option value=""></option><option value="N">N</option><option value="I">I</option></select></td>
                  <td className="border border-gray-800 p-0"><select value={row.retroChecking} className="w-full h-full text-center outline-none bg-transparent py-1.5 cursor-pointer font-bold text-sm" onChange={(e) => handleRowChange(rIdx, "retroChecking", e.target.value)}><option value=""></option><option value="✓">✓</option><option value="X">X</option></select></td>
                  <td className="border border-gray-800 p-0"><select value={row.quarantine} className="w-full h-full text-center outline-none bg-transparent py-1.5 cursor-pointer font-bold text-sm" onChange={(e) => handleRowChange(rIdx, "quarantine", e.target.value)}><option value=""></option><option value="✓">✓</option><option value="X">X</option></select></td>
                  <td className="border border-gray-800 p-0"><select value={row.partIdentification} className="w-full h-full text-center outline-none bg-transparent py-1.5 cursor-pointer font-bold text-sm" onChange={(e) => handleRowChange(rIdx, "partIdentification", e.target.value)}><option value=""></option><option value="✓">✓</option><option value="X">X</option></select></td>
                  <td className="border border-gray-800 p-0"><select value={row.internalCommunication} className="w-full h-full text-center outline-none bg-transparent py-1.5 cursor-pointer font-bold text-sm" onChange={(e) => handleRowChange(rIdx, "internalCommunication", e.target.value)}><option value=""></option><option value="✓">✓</option><option value="X">X</option></select></td>
                  
                  {/* INCHARGE SIGN (APPROVE BUTTON) */}
                  <td className="border border-gray-800 p-1 align-middle text-center bg-gray-50">
                    {row.inchargeSign ? (
                      <div className="flex flex-col items-center justify-center">
                        <span className="text-[10px] font-bold text-green-600">Approved ✓</span>
                        <span className="text-xs font-black text-gray-900 uppercase">{row.inchargeSign}</span>
                      </div>
                    ) : (
                      <button 
                        type="button" 
                        onClick={() => handleApproveIncharge(rIdx)} 
                        className="text-[10px] font-bold px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded shadow uppercase w-full cursor-pointer"
                      >
                        Approve
                      </button>
                    )}
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mt-5 pt-3 gap-3">
          {/* HOD DROP DOWN */}
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-800 text-sm">HOD Sign :</span>
            <select
              className="border-b border-gray-800 outline-none px-2 py-1 text-sm font-semibold text-center w-52 bg-transparent focus:border-orange-500 cursor-pointer"
              value={hodSign}
              onChange={(e) => setHodSign(e.target.value)}
            >
              <option value="">-- Assign HOD --</option>
              {hodUsers.map((user, idx) => {
                const uname = user.username || user.employeeId || user.name;
                return (<option key={idx} value={uname}>{uname.toUpperCase()}</option>);
              })}
            </select>
          </div>

          <div className="flex justify-end gap-4 mt-6 pt-4 border-t border-gray-300">
            <button type="button" onClick={handleSave} disabled={isSaving} className="bg-orange-500 hover:bg-orange-600 text-white px-10 py-3 rounded font-bold transition-colors shadow-lg hover:cursor-pointer">
              {isSaving ? "Saving..." : "Save & continue"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}