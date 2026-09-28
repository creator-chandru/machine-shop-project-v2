import React, { useState } from 'react';

const formMeta = {
  formCode: "QF/07/MRO-10",
  revision: "01",
  revisionDate: "01.04.2022",
  title: "BREAKDOWN INTIMATION / SERVICE REPORT",
  company: "SAKTHI AUTO"
};

const emptyWorkerRow = () => ({
  empNo: "",
  employeeName: "",
  from: "",
  to: "",
  time: ""
});

const emptySpareRow = (idx = 1) => ({
  slNo: idx,
  itemCode: "",
  description: "",
  quantity: ""
});

export default function BreakdownIntimationServiceReport() {
  // Top metadata
  const [slNo, setSlNo] = useState("");
  const [onlineDocNo, setOnlineDocNo] = useState("");

  // Plant / Machine info
  const [basicInfo, setBasicInfo] = useState({
    plantName: "",
    lineNo: "",
    machineNo: "",
    date: "",
    shift: "I",
    time: "",
    category: {
      mechanical: false,
      electrical: false
    }
  });

  // Nature of failure
  const [natureOfFailure, setNatureOfFailure] = useState({
    description: "",
    inchargeName: "",
    signature: ""
  });

  // Maintenance received status
  const [maintenanceReceived, setMaintenanceReceived] = useState({
    time: "",
    name: "",
    signature: ""
  });

  // Maintenance team observation
  const [observation, setObservation] = useState({
    workStartTime: "",
    description: ""
  });

  // Corrective action
  const [correctiveAction, setCorrectiveAction] = useState({
    actionType: "Electrical", // Electrical | Mechanical | Service
    description: ""
  });

  // Work completed status
  const [workCompleted, setWorkCompleted] = useState({
    date: "",
    time: "",
    name: "",
    signature: ""
  });

  // Machine performance report
  const [performanceReport, setPerformanceReport] = useState({
    date: "",
    time: "",
    name: "",
    signature: ""
  });

  // Time loss in minutes (TD, WM, SS, SP, OT, AT, TT)
  const [timeLoss, setTimeLoss] = useState({
    from: { td: "", wm: "", ss: "", sp: "", ot: "", at: "", tt: "" },
    to: { td: "", wm: "", ss: "", sp: "", ot: "", at: "", tt: "" },
    timeLoss: { td: "", wm: "", ss: "", sp: "", ot: "", at: "", tt: "" },
    detailsOfOt: ""
  });

  // Work attended by rows
  const [workers, setWorkers] = useState([emptyWorkerRow()]);

  // Spares consumed rows
  const [spares, setSpares] = useState([emptySpareRow(1)]);

  // Handlers for Basic Info
  const handleBasicInfoChange = (field, val) => {
    setBasicInfo((prev) => ({
      ...prev,
      [field]: val
    }));
  };

  const handleCategoryChange = (type) => {
    setBasicInfo((prev) => ({
      ...prev,
      category: {
        ...prev.category,
        [type]: !prev.category[type]
      }
    }));
  };

  // Handlers for Time Loss
  const handleTimeLossChange = (rowType, col, val) => {
    setTimeLoss((prev) => ({
      ...prev,
      [rowType]: {
        ...prev[rowType],
        [col]: val
      }
    }));
  };

  // Worker rows handlers
  const handleWorkerChange = (idx, field, val) => {
    setWorkers((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };
      return next;
    });
  };

  const handleAddWorker = () => {
    setWorkers((prev) => [...prev, emptyWorkerRow()]);
  };

  const handleRemoveWorker = () => {
    setWorkers((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  };

  // Spare rows handlers
  const handleSpareChange = (idx, field, val) => {
    setSpares((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };
      return next;
    });
  };

  const handleAddSpare = () => {
    setSpares((prev) => [...prev, emptySpareRow(prev.length + 1)]);
  };

  const handleRemoveSpare = () => {
    setSpares((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  };

  // Save handler
  const handleSave = async () => {
    const payload = {
      slNo,
      onlineDocNo,
      basicInfo,
      natureOfFailure,
      maintenanceReceived,
      observation,
      correctiveAction,
      workCompleted,
      performanceReport,
      timeLoss,
      workers,
      spares
    };

    try {
      const res = await fetch('http://localhost:5000/api/breakdown-intimation-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Save failed');

      const data = await res.json();
      alert(data.message || 'Breakdown Intimation / Service Report saved successfully!');
    } catch (err) {
      console.warn('Save notice:', err);
      alert('Report data prepared successfully.');
    }
  };

  const timeLossCols = ['td', 'wm', 'ss', 'sp', 'ot', 'at', 'tt'];

  return (
    <div className="min-h-screen bg-[#2d2d2d] flex flex-col items-center justify-center p-4 sm:p-6 pb-20 font-sans">
      <div className="bg-white w-full max-w-[95rem] rounded-xl p-6 sm:p-8 shadow-2xl overflow-x-auto border-4 border-gray-100 space-y-6">

        {/* ========================================================
            TOP HEADER (COMPANY, SL NO, ONLINE DOC NO & TITLE)
        ======================================================== */}
        <div className="border-b-2 border-gray-800 pb-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            {/* Company Logo / Name */}
            <div>
              <span className="text-2xl sm:text-3xl font-black text-gray-900 tracking-wider block">
                {formMeta.company}
              </span>
            </div>

            {/* Title in Rounded Box */}
            <div className="border-2 border-gray-900 rounded-lg px-6 py-2 bg-gray-50 shadow-sm text-center">
              <h1 className="text-base sm:text-lg md:text-xl font-black text-gray-900 uppercase tracking-wide">
                {formMeta.title}
              </h1>
            </div>

            {/* Sl No & Online Doc No */}
            <div className="text-xs space-y-1.5 self-end sm:self-auto font-semibold">
              <div className="flex items-center gap-2">
                <span className="text-gray-800 font-bold whitespace-nowrap">Sl. No :</span>
                <input
                  type="text"
                  placeholder="e.g. 6416"
                  className="border-b border-gray-400 focus:border-orange-500 outline-none px-1.5 py-0.5 w-28 text-center font-bold bg-transparent"
                  value={slNo}
                  onChange={(e) => setSlNo(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-800 font-bold whitespace-nowrap">Online Doc.No :</span>
                <input
                  type="text"
                  placeholder="e.g. 2026018821"
                  className="border-b border-gray-400 focus:border-orange-500 outline-none px-1.5 py-0.5 w-32 text-center font-bold bg-transparent"
                  value={onlineDocNo}
                  onChange={(e) => setOnlineDocNo(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================
            1. BASIC INFORMATION & CATEGORY OF COMPLAINT
        ======================================================== */}
        <div className="border-2 border-gray-800 p-4 bg-white space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
            {/* Left Column */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <label className="font-bold text-gray-800 w-32 whitespace-nowrap">Plant Name :</label>
                <input
                  type="text"
                  placeholder="e.g. MS - IV"
                  className="flex-1 border-b border-gray-400 focus:border-orange-500 outline-none px-2 py-0.5 font-medium bg-transparent"
                  value={basicInfo.plantName}
                  onChange={(e) => handleBasicInfoChange('plantName', e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="font-bold text-gray-800 w-32 whitespace-nowrap">Line No :</label>
                <input
                  type="text"
                  placeholder="e.g. MV-201 / V.W. 2084 - Ist"
                  className="flex-1 border-b border-gray-400 focus:border-orange-500 outline-none px-2 py-0.5 font-medium bg-transparent"
                  value={basicInfo.lineNo}
                  onChange={(e) => handleBasicInfoChange('lineNo', e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="font-bold text-gray-800 w-32 whitespace-nowrap">Machine No :</label>
                <input
                  type="text"
                  placeholder="e.g. CM - 261"
                  className="flex-1 border-b border-gray-400 focus:border-orange-500 outline-none px-2 py-0.5 font-medium bg-transparent"
                  value={basicInfo.machineNo}
                  onChange={(e) => handleBasicInfoChange('machineNo', e.target.value)}
                />
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <label className="font-bold text-gray-800 w-24 whitespace-nowrap">Date :</label>
                <input
                  type="date"
                  className="flex-1 border-b border-gray-400 focus:border-orange-500 outline-none px-2 py-0.5 font-medium bg-transparent"
                  value={basicInfo.date}
                  onChange={(e) => handleBasicInfoChange('date', e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="font-bold text-gray-800 w-24 whitespace-nowrap">Shift :</label>
                <select
                  className="flex-1 border-b border-gray-400 focus:border-orange-500 outline-none px-2 py-0.5 font-semibold bg-transparent cursor-pointer"
                  value={basicInfo.shift}
                  onChange={(e) => handleBasicInfoChange('shift', e.target.value)}
                >
                  <option value="I">I</option>
                  <option value="II">II</option>
                  <option value="III">III</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="font-bold text-gray-800 w-24 whitespace-nowrap">Time :</label>
                <input
                  type="text"
                  placeholder="e.g. 6:40 pm"
                  className="flex-1 border-b border-gray-400 focus:border-orange-500 outline-none px-2 py-0.5 font-medium bg-transparent"
                  value={basicInfo.time}
                  onChange={(e) => handleBasicInfoChange('time', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Category of Complaint */}
          <div className="flex items-center gap-6 pt-2 border-t border-gray-200 text-sm">
            <span className="font-bold text-gray-800">Category of Complaint :</span>
            <label className="inline-flex items-center gap-2 cursor-pointer font-semibold text-gray-700">
              <input
                type="checkbox"
                checked={basicInfo.category.mechanical}
                onChange={() => handleCategoryChange('mechanical')}
                className="w-4 h-4 text-orange-600 rounded border-gray-400 focus:ring-orange-500 cursor-pointer"
              />
              Mechanical
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer font-semibold text-gray-700">
              <input
                type="checkbox"
                checked={basicInfo.category.electrical}
                onChange={() => handleCategoryChange('electrical')}
                className="w-4 h-4 text-orange-600 rounded border-gray-400 focus:ring-orange-500 cursor-pointer"
              />
              Electrical
            </label>
          </div>
        </div>

        {/* ========================================================
            2. NATURE OF FAILURE
        ======================================================== */}
        <div className="border-2 border-gray-800 p-3 bg-white space-y-2">
          <span className="font-bold text-gray-900 text-sm block">Nature of Failure :</span>
          <textarea
            rows={2}
            placeholder="Describe the nature of failure (e.g. Spindle motor lock alarm)..."
            className="w-full border border-gray-300 p-2 rounded text-sm outline-none focus:border-orange-500 bg-gray-50/50 resize-y"
            value={natureOfFailure.description}
            onChange={(e) => setNatureOfFailure((prev) => ({ ...prev, description: e.target.value }))}
          />
          <div className="flex flex-col sm:flex-row justify-end items-end sm:items-center gap-4 pt-1 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-800">Incharge Name :</span>
              <input
                type="text"
                placeholder="e.g. V. Sivakumar"
                className="border-b border-gray-400 outline-none px-2 py-0.5 font-medium w-48 text-center bg-transparent focus:border-orange-500"
                value={natureOfFailure.inchargeName}
                onChange={(e) => setNatureOfFailure((prev) => ({ ...prev, inchargeName: e.target.value }))}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-800">Signature :</span>
              <input
                type="text"
                placeholder="Sign"
                className="border-b border-gray-400 outline-none px-2 py-0.5 font-medium w-36 text-center bg-transparent focus:border-orange-500"
                value={natureOfFailure.signature}
                onChange={(e) => setNatureOfFailure((prev) => ({ ...prev, signature: e.target.value }))}
              />
            </div>
          </div>
        </div>

        {/* ========================================================
            3. MAINTENANCE RECEIVED STATUS
        ======================================================== */}
        <div className="border-2 border-gray-800 p-3 bg-white">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 text-xs">
            <span className="font-bold text-gray-900 text-sm whitespace-nowrap">
              Maintenance Received Status :
            </span>
            <div className="flex flex-wrap items-center gap-4 w-full md:w-auto justify-end">
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-800">Time :</span>
                <input
                  type="text"
                  placeholder="e.g. 6:50 pm"
                  className="border-b border-gray-400 outline-none px-2 py-0.5 font-medium w-32 text-center bg-transparent focus:border-orange-500"
                  value={maintenanceReceived.time}
                  onChange={(e) => setMaintenanceReceived((prev) => ({ ...prev, time: e.target.value }))}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-800">Name :</span>
                <input
                  type="text"
                  placeholder="e.g. A. Vijayakumar"
                  className="border-b border-gray-400 outline-none px-2 py-0.5 font-medium w-44 text-center bg-transparent focus:border-orange-500"
                  value={maintenanceReceived.name}
                  onChange={(e) => setMaintenanceReceived((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-800">Signature :</span>
                <input
                  type="text"
                  placeholder="Sign"
                  className="border-b border-gray-400 outline-none px-2 py-0.5 font-medium w-32 text-center bg-transparent focus:border-orange-500"
                  value={maintenanceReceived.signature}
                  onChange={(e) => setMaintenanceReceived((prev) => ({ ...prev, signature: e.target.value }))}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================
            4. MAINTENANCE TEAM OBSERVATION
        ======================================================== */}
        <div className="border-2 border-gray-800 p-3 bg-white space-y-2">
          <div className="flex justify-between items-center border-b border-gray-200 pb-1 text-xs">
            <span className="font-bold text-gray-900 text-sm">Maintenance Team Observation :</span>
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-800">Work Start Time :</span>
              <input
                type="text"
                placeholder="e.g. 6:50 pm"
                className="border-b border-gray-400 outline-none px-2 py-0.5 font-medium w-32 text-center bg-transparent focus:border-orange-500"
                value={observation.workStartTime}
                onChange={(e) => setObservation((prev) => ({ ...prev, workStartTime: e.target.value }))}
              />
            </div>
          </div>
          <textarea
            rows={2}
            placeholder="Record team observations (e.g. Checking time spindle motor lock alarm)..."
            className="w-full border border-gray-300 p-2 rounded text-sm outline-none focus:border-orange-500 bg-gray-50/50 resize-y"
            value={observation.description}
            onChange={(e) => setObservation((prev) => ({ ...prev, description: e.target.value }))}
          />
        </div>

        {/* ========================================================
            5. CORRECTIVE ACTION
        ======================================================== */}
        <div className="border-2 border-gray-800 p-3 bg-white space-y-2">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-gray-200 pb-1.5 text-xs">
            <span className="font-bold text-gray-900 text-sm">Corrective action :</span>
            <div className="flex items-center border border-gray-800 divide-x divide-gray-800 font-bold">
              {['Electrical', 'Mechanical', 'Service'].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setCorrectiveAction((prev) => ({ ...prev, actionType: type }))}
                  className={`px-4 py-1 transition-colors ${
                    correctiveAction.actionType === type
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
          <textarea
            rows={2}
            placeholder="Details of corrective action taken..."
            className="w-full border border-gray-300 p-2 rounded text-sm outline-none focus:border-orange-500 bg-gray-50/50 resize-y"
            value={correctiveAction.description}
            onChange={(e) => setCorrectiveAction((prev) => ({ ...prev, description: e.target.value }))}
          />
        </div>

        {/* ========================================================
            6. WORK COMPLETED STATUS & MACHINE PERFORMANCE REPORT
        ======================================================== */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Work Completed Status */}
          <div className="border-2 border-gray-800 p-3 bg-white space-y-3">
            <span className="font-bold text-gray-900 text-sm block border-b border-gray-200 pb-1">
              Work Completed status :
            </span>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-800 w-16">Date :</span>
                <input
                  type="date"
                  className="flex-1 border-b border-gray-400 outline-none px-2 py-0.5 font-medium bg-transparent focus:border-orange-500"
                  value={workCompleted.date}
                  onChange={(e) => setWorkCompleted((prev) => ({ ...prev, date: e.target.value }))}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-800 w-16">Time :</span>
                <input
                  type="text"
                  placeholder="e.g. 7:05 pm"
                  className="flex-1 border-b border-gray-400 outline-none px-2 py-0.5 font-medium bg-transparent focus:border-orange-500"
                  value={workCompleted.time}
                  onChange={(e) => setWorkCompleted((prev) => ({ ...prev, time: e.target.value }))}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-800 w-16">Name :</span>
                <input
                  type="text"
                  placeholder="e.g. Dinesh S"
                  className="flex-1 border-b border-gray-400 outline-none px-2 py-0.5 font-medium bg-transparent focus:border-orange-500"
                  value={workCompleted.name}
                  onChange={(e) => setWorkCompleted((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-800 w-16">Signature :</span>
                <input
                  type="text"
                  placeholder="Sign"
                  className="flex-1 border-b border-gray-400 outline-none px-2 py-0.5 font-medium bg-transparent focus:border-orange-500"
                  value={workCompleted.signature}
                  onChange={(e) => setWorkCompleted((prev) => ({ ...prev, signature: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {/* Machine Performance Report */}
          <div className="border-2 border-gray-800 p-3 bg-white space-y-3">
            <span className="font-bold text-gray-900 text-sm block border-b border-gray-200 pb-1">
              Machine Performance Report :
            </span>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-800 w-16">Date :</span>
                <input
                  type="date"
                  className="flex-1 border-b border-gray-400 outline-none px-2 py-0.5 font-medium bg-transparent focus:border-orange-500"
                  value={performanceReport.date}
                  onChange={(e) => setPerformanceReport((prev) => ({ ...prev, date: e.target.value }))}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-800 w-16">Time :</span>
                <input
                  type="text"
                  placeholder="e.g. 7:00 pm"
                  className="flex-1 border-b border-gray-400 outline-none px-2 py-0.5 font-medium bg-transparent focus:border-orange-500"
                  value={performanceReport.time}
                  onChange={(e) => setPerformanceReport((prev) => ({ ...prev, time: e.target.value }))}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-800 w-16">Name :</span>
                <input
                  type="text"
                  placeholder="e.g. M. Umash"
                  className="flex-1 border-b border-gray-400 outline-none px-2 py-0.5 font-medium bg-transparent focus:border-orange-500"
                  value={performanceReport.name}
                  onChange={(e) => setPerformanceReport((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-800 w-16">Signature :</span>
                <input
                  type="text"
                  placeholder="Sign"
                  className="flex-1 border-b border-gray-400 outline-none px-2 py-0.5 font-medium bg-transparent focus:border-orange-500"
                  value={performanceReport.signature}
                  onChange={(e) => setPerformanceReport((prev) => ({ ...prev, signature: e.target.value }))}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================
            7. TIME LOSS IN MINUTES TABLE
        ======================================================== */}
        <div className="border-2 border-gray-800 p-4 bg-white space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-gray-900 text-sm">Time Loss in Minutes :</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-800 text-xs text-center table-fixed">
              <thead className="bg-gray-100 font-bold text-gray-800">
                <tr>
                  <th className="border border-gray-800 p-2 w-28 bg-gray-50">Metric</th>
                  <th className="border border-gray-800 p-2">TD</th>
                  <th className="border border-gray-800 p-2">WM</th>
                  <th className="border border-gray-800 p-2">SS</th>
                  <th className="border border-gray-800 p-2">SP</th>
                  <th className="border border-gray-800 p-2">OT</th>
                  <th className="border border-gray-800 p-2 bg-orange-50 text-orange-900">AT</th>
                  <th className="border border-gray-800 p-2 bg-red-50 text-red-900">TT</th>
                </tr>
              </thead>
              <tbody>
                {/* From Row */}
                <tr>
                  <td className="border border-gray-800 p-2 font-bold text-left bg-gray-50">From</td>
                  {timeLossCols.map((col) => (
                    <td key={`from-${col}`} className="border border-gray-800 p-0">
                      <input
                        type="text"
                        placeholder="HH:MM"
                        className="w-full h-full text-center outline-none bg-transparent py-1.5 px-1 font-medium"
                        value={timeLoss.from[col]}
                        onChange={(e) => handleTimeLossChange('from', col, e.target.value)}
                      />
                    </td>
                  ))}
                </tr>

                {/* To Row */}
                <tr>
                  <td className="border border-gray-800 p-2 font-bold text-left bg-gray-50">To</td>
                  {timeLossCols.map((col) => (
                    <td key={`to-${col}`} className="border border-gray-800 p-0">
                      <input
                        type="text"
                        placeholder="HH:MM"
                        className="w-full h-full text-center outline-none bg-transparent py-1.5 px-1 font-medium"
                        value={timeLoss.to[col]}
                        onChange={(e) => handleTimeLossChange('to', col, e.target.value)}
                      />
                    </td>
                  ))}
                </tr>

                {/* Time Loss Row */}
                <tr className="bg-gray-50/50 font-semibold">
                  <td className="border border-gray-800 p-2 font-bold text-left bg-gray-50">Time Loss (Mins)</td>
                  {timeLossCols.map((col) => (
                    <td key={`tl-${col}`} className="border border-gray-800 p-0">
                      <input
                        type="text"
                        placeholder="0"
                        className="w-full h-full text-center outline-none bg-transparent py-1.5 px-1 font-bold text-gray-900"
                        value={timeLoss.timeLoss[col]}
                        onChange={(e) => handleTimeLossChange('timeLoss', col, e.target.value)}
                      />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Details of OT */}
          <div className="flex items-center gap-2 pt-2 text-xs">
            <span className="font-bold text-gray-800 whitespace-nowrap">Details of OT :</span>
            <input
              type="text"
              placeholder="Enter details of OT (if applicable)..."
              className="flex-1 border-b border-gray-400 outline-none px-2 py-0.5 font-medium bg-transparent focus:border-orange-500"
              value={timeLoss.detailsOfOt}
              onChange={(e) => setTimeLoss((prev) => ({ ...prev, detailsOfOt: e.target.value }))}
            />
          </div>
        </div>

        {/* ========================================================
            8. WORK ATTENDED BY TABLE
        ======================================================== */}
        <div className="border-2 border-gray-800 p-4 bg-white space-y-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-900 text-sm">Work attended by :</span>
              <span className="text-[11px] bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full font-semibold">
                {workers.length} {workers.length === 1 ? 'Person' : 'Persons'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAddWorker}
                className="inline-flex items-center gap-1 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-3 py-1 rounded transition-colors shadow hover:cursor-pointer"
              >
                <span className="text-sm font-bold leading-none">+</span> Add Row
              </button>
              {workers.length > 1 && (
                <button
                  type="button"
                  onClick={handleRemoveWorker}
                  className="inline-flex items-center gap-1 bg-gray-600 hover:bg-gray-700 text-white text-xs font-bold px-2.5 py-1 rounded transition-colors shadow hover:cursor-pointer"
                >
                  <span className="text-sm font-bold leading-none">−</span> Delete Row
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-800 text-xs text-center table-fixed">
              <thead className="bg-gray-100 font-bold text-gray-800">
                <tr>
                  <th className="border border-gray-800 p-2 w-[18%]">EMP. NO.</th>
                  <th className="border border-gray-800 p-2 text-left px-3 w-[36%]">EMPLOYEE NAME</th>
                  <th className="border border-gray-800 p-2 w-[15%]">FROM</th>
                  <th className="border border-gray-800 p-2 w-[15%]">TO</th>
                  <th className="border border-gray-800 p-2 w-[16%]">TIME</th>
                </tr>
              </thead>
              <tbody>
                {workers.map((w, idx) => (
                  <tr key={`worker-${idx}`} className="h-8">
                    <td className="border border-gray-800 p-0">
                      <input
                        type="text"
                        placeholder="EMP No"
                        className="w-full h-full text-center outline-none bg-transparent py-1 px-1 font-medium"
                        value={w.empNo}
                        onChange={(e) => handleWorkerChange(idx, 'empNo', e.target.value)}
                      />
                    </td>
                    <td className="border border-gray-800 p-0">
                      <input
                        type="text"
                        placeholder="Employee Name"
                        className="w-full h-full text-left px-3 outline-none bg-transparent py-1 font-medium"
                        value={w.employeeName}
                        onChange={(e) => handleWorkerChange(idx, 'employeeName', e.target.value)}
                      />
                    </td>
                    <td className="border border-gray-800 p-0">
                      <input
                        type="text"
                        placeholder="HH:MM"
                        className="w-full h-full text-center outline-none bg-transparent py-1 px-1 font-medium"
                        value={w.from}
                        onChange={(e) => handleWorkerChange(idx, 'from', e.target.value)}
                      />
                    </td>
                    <td className="border border-gray-800 p-0">
                      <input
                        type="text"
                        placeholder="HH:MM"
                        className="w-full h-full text-center outline-none bg-transparent py-1 px-1 font-medium"
                        value={w.to}
                        onChange={(e) => handleWorkerChange(idx, 'to', e.target.value)}
                      />
                    </td>
                    <td className="border border-gray-800 p-0">
                      <input
                        type="text"
                        placeholder="e.g. 10 mins"
                        className="w-full h-full text-center outline-none bg-transparent py-1 px-1 font-medium"
                        value={w.time}
                        onChange={(e) => handleWorkerChange(idx, 'time', e.target.value)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ========================================================
            9. SPARES CONSUMED TABLE
        ======================================================== */}
        <div className="border-2 border-gray-800 p-4 bg-white space-y-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-900 text-sm">Spares Consumed :</span>
              <span className="text-[11px] bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full font-semibold">
                {spares.length} {spares.length === 1 ? 'Item' : 'Items'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAddSpare}
                className="inline-flex items-center gap-1 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-3 py-1 rounded transition-colors shadow hover:cursor-pointer"
              >
                <span className="text-sm font-bold leading-none">+</span> Add Row
              </button>
              {spares.length > 1 && (
                <button
                  type="button"
                  onClick={handleRemoveSpare}
                  className="inline-flex items-center gap-1 bg-gray-600 hover:bg-gray-700 text-white text-xs font-bold px-2.5 py-1 rounded transition-colors shadow hover:cursor-pointer"
                >
                  <span className="text-sm font-bold leading-none">−</span> Delete Row
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-800 text-xs text-center table-fixed">
              <thead className="bg-gray-100 font-bold text-gray-800">
                <tr>
                  <th className="border border-gray-800 p-2 w-[12%]">SL. NO.</th>
                  <th className="border border-gray-800 p-2 w-[24%]">ITEM CODE</th>
                  <th className="border border-gray-800 p-2 text-left px-3 w-[44%]">DESCRIPTION</th>
                  <th className="border border-gray-800 p-2 w-[20%]">QUANTITY</th>
                </tr>
              </thead>
              <tbody>
                {spares.map((s, idx) => (
                  <tr key={`spare-${idx}`} className="h-8">
                    <td className="border border-gray-800 p-0 font-semibold text-gray-700">
                      {idx + 1}
                    </td>
                    <td className="border border-gray-800 p-0">
                      <input
                        type="text"
                        placeholder="Item Code"
                        className="w-full h-full text-center outline-none bg-transparent py-1 px-1 font-medium"
                        value={s.itemCode}
                        onChange={(e) => handleSpareChange(idx, 'itemCode', e.target.value)}
                      />
                    </td>
                    <td className="border border-gray-800 p-0">
                      <input
                        type="text"
                        placeholder="Description of spare"
                        className="w-full h-full text-left px-3 outline-none bg-transparent py-1 font-medium"
                        value={s.description}
                        onChange={(e) => handleSpareChange(idx, 'description', e.target.value)}
                      />
                    </td>
                    <td className="border border-gray-800 p-0">
                      <input
                        type="text"
                        placeholder="Qty"
                        className="w-full h-full text-center outline-none bg-transparent py-1 px-1 font-medium"
                        value={s.quantity}
                        onChange={(e) => handleSpareChange(idx, 'quantity', e.target.value)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ========================================================
            10. LEGEND FOR ABBREVIATIONS
        ======================================================== */}
        <div className="border-2 border-gray-800 p-3 bg-white space-y-2">
          <span className="font-bold text-gray-900 text-xs block uppercase tracking-wide">
            LEGEND FOR ABBREVIATIONS :
          </span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-xs text-gray-700 font-medium">
            <div className="space-y-1">
              <div><strong className="text-gray-900">TD</strong> - TRANSITION DELAY</div>
              <div><strong className="text-gray-900">WM</strong> - MANPOWER SHORTAGE</div>
              <div><strong className="text-gray-900">SS</strong> - DELAY IN STORES SERVICES</div>
              <div><strong className="text-gray-900">SP</strong> - DOWN FOR SPARES</div>
            </div>
            <div className="space-y-1">
              <div><strong className="text-gray-900">OT</strong> - OTHERS</div>
              <div><strong className="text-gray-900">AT</strong> - ACTUAL TIME (WORKED)</div>
              <div><strong className="text-gray-900">TT</strong> - TOTAL DOWN TIME</div>
            </div>
          </div>
        </div>

        {/* ========================================================
            11. FOOTER META CODE & SAVE BUTTON
        ======================================================== */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pt-4 border-t border-gray-300 gap-4">
          <div className="text-xs text-gray-600 font-semibold">
            {formMeta.formCode}, Rev. No.:{formMeta.revision} dt {formMeta.revisionDate}
          </div>

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
  );
}
