import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { FileDown, X, CheckCircle2, Info, ArrowLeft } from 'lucide-react';

const initialFormData = {
  formCode: "QF / 07 / MPD - 15",
  revisionDate: "06-06-2018",
  title: "OPERATOR OBSERVATION SHEET",
  company: "SAKTHI AUTO COMPONENT LTD"
};

const RATING_COLUMNS = [
  { key: "followed", label: "Followed", defaultPoints: 5 },
  { key: "partiallyFollowed", label: "Partially Followed", defaultPoints: 3 },
  { key: "notFollowed", label: "Not Followed", defaultPoints: 1 },
  { key: "notAware", label: "Not Aware", defaultPoints: 0 }
];

const DEFAULT_SECTIONS = [
  {
    id: 1,
    title: "1. Work Instructions / Start Up",
    sectionMarks: "",
    columnTotals: { followed: "", partiallyFollowed: "", notFollowed: "", notAware: "" },
    items: [
      { slNo: 1, parameter: "Is the operator able to read & observe the work instruction.", followed: "", partiallyFollowed: "", notFollowed: "", notAware: "" },
      { slNo: 2, parameter: "Is the operator referring to the Work Instruction during machine operating.", followed: "", partiallyFollowed: "", notFollowed: "", notAware: "" },
      { slNo: 3, parameter: "Does the operator follow the material handling properly.", followed: "", partiallyFollowed: "", notFollowed: "", notAware: "" },
      { slNo: 4, parameter: "Does the operator follow the FIFO system.", followed: "", partiallyFollowed: "", notFollowed: "", notAware: "" }
    ]
  },
  {
    id: 2,
    title: "2. Operation Standard",
    sectionMarks: "",
    columnTotals: { followed: "", partiallyFollowed: "", notFollowed: "", notAware: "" },
    items: [
      { slNo: 1, parameter: "Does the operator know about Standard Operating Procedure.", followed: "", partiallyFollowed: "", notFollowed: "", notAware: "" },
      { slNo: 2, parameter: "Does the operator refer Standard Operating Procedure during work.", followed: "", partiallyFollowed: "", notFollowed: "", notAware: "" },
      { slNo: 3, parameter: "Does the operator Check the part as per the work instruction.", followed: "", partiallyFollowed: "", notFollowed: "", notAware: "" },
      { slNo: 4, parameter: "Is the operator changing the tool as per the work instruction.", followed: "", partiallyFollowed: "", notFollowed: "", notAware: "" }
    ]
  },
  {
    id: 3,
    title: "3. Non Conformity Management",
    sectionMarks: "",
    columnTotals: { followed: "", partiallyFollowed: "", notFollowed: "", notAware: "" },
    items: [
      { slNo: 1, parameter: "Does the operator refer Work Instructions for the NC Management during the shift?", followed: "", partiallyFollowed: "", notFollowed: "", notAware: "" },
      { slNo: 2, parameter: "Does the operator properly dispose the non conforming product.", followed: "", partiallyFollowed: "", notFollowed: "", notAware: "" },
      { slNo: 3, parameter: "Does the operator handle unusual situation component.", followed: "", partiallyFollowed: "", notFollowed: "", notAware: "" },
      { slNo: 4, parameter: "Does the operator refer limit samples / Work instruction / Process sheet / SOP", followed: "", partiallyFollowed: "", notFollowed: "", notAware: "" },
      { slNo: 5, parameter: "Does the operator properly informed to line supervisor regarding nc product.", followed: "", partiallyFollowed: "", notFollowed: "", notAware: "" }
    ]
  },
  {
    id: 4,
    title: "4. Abnormal Condition",
    sectionMarks: "",
    columnTotals: { followed: "", partiallyFollowed: "", notFollowed: "", notAware: "" },
    items: [
      { slNo: 1, parameter: "Reaction of the operator for the abnormal condition", followed: "", partiallyFollowed: "", notFollowed: "", notAware: "" }
    ]
  },
  {
    id: 5,
    title: "5. Record Keeping",
    sectionMarks: "",
    columnTotals: { followed: "", partiallyFollowed: "", notFollowed: "", notAware: "" },
    items: [
      { slNo: 1, parameter: "Does the operator fills operator check sheet at the record time ( Pre operation check sheet, Error proof verification)", followed: "", partiallyFollowed: "", notFollowed: "", notAware: "" },
      { slNo: 2, parameter: "Does the operator keeps record at designated area before or after the shift", followed: "", partiallyFollowed: "", notFollowed: "", notAware: "" }
    ]
  },
  {
    id: 6,
    title: "6. Start / Stop Procedure",
    sectionMarks: "",
    columnTotals: { followed: "", partiallyFollowed: "", notFollowed: "", notAware: "" },
    items: [
      { slNo: 1, parameter: "Does the operator follows Start / Stop Discipline", followed: "", partiallyFollowed: "", notFollowed: "", notAware: "" }
    ]
  },
  {
    id: 7,
    title: "7. Inspection",
    sectionMarks: "",
    columnTotals: { followed: "", partiallyFollowed: "", notFollowed: "", notAware: "" },
    items: [
      { slNo: 1, parameter: "Does the operator aware the inspection standard.", followed: "", partiallyFollowed: "", notFollowed: "", notAware: "" },
      { slNo: 2, parameter: "Does the operator properly check the component as per quality standard.", followed: "", partiallyFollowed: "", notFollowed: "", notAware: "" },
      { slNo: 3, parameter: "Handling of Guages", followed: "", partiallyFollowed: "", notFollowed: "", notAware: "" }
    ]
  },
  {
    id: 8,
    title: "8. Safety / PPE / 5s",
    sectionMarks: "",
    columnTotals: { followed: "", partiallyFollowed: "", notFollowed: "", notAware: "" },
    items: [
      { slNo: 1, parameter: "Does the operator wear the PPE", followed: "", partiallyFollowed: "", notFollowed: "", notAware: "" },
      { slNo: 2, parameter: "Does the operator properly clean the machine & Hand over to shift reliever.", followed: "", partiallyFollowed: "", notFollowed: "", notAware: "" }
    ]
  },
  {
    id: 9,
    title: "9. Change Management",
    sectionMarks: "",
    columnTotals: { followed: "", partiallyFollowed: "", notFollowed: "", notAware: "" },
    items: [
      { slNo: 1, parameter: "Does any temporary changes made in this process", followed: "", partiallyFollowed: "", notFollowed: "", notAware: "" },
      { slNo: 2, parameter: "Does any 4M changes in this process", followed: "", partiallyFollowed: "", notFollowed: "", notAware: "" },
      { slNo: 3, parameter: "Does any changes for customer request or internal requirement", followed: "", partiallyFollowed: "", notFollowed: "", notAware: "" }
    ]
  }
];

const getTodayISODate = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const Toast = ({ message, type, onClose }) => {
  if (!message) return null;
  const bgColor = type === 'error' ? 'bg-red-600' : type === 'success' ? 'bg-green-600' : 'bg-orange-600';

  return (
    <div className={`fixed bottom-6 right-6 z-50 ${bgColor} text-white px-5 py-3.5 rounded-xl shadow-2xl flex items-center gap-3 transition-all animate-bounce border border-black/10`}>
      <span className="text-sm font-semibold tracking-wide">{message}</span>
      <button onClick={onClose} className="ml-2 p-1 font-bold text-lg leading-none hover:text-gray-200 focus:outline-none transition-colors">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export default function OperatorObservationSheet() {
  const { shopId } = useParams();
  const navigate = useNavigate();

  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  const loggedInName = currentUser.username || currentUser.employeeId || "Authorized User";

  const [headerInfo, setHeaderInfo] = useState({
    employeeName: "",
    employeeCode: "",
    department: "",
    testDate: getTodayISODate(),
    marksPercentage: "",
    method: "Practical & Demo"
  });

  const [sections, setSections] = useState(DEFAULT_SECTIONS);
  const [isSavedRecord, setIsSavedRecord] = useState(false);

  const [footerInfo, setFooterInfo] = useState({
    reviewDate: getTodayISODate(),
    reviewedBy: "",
    approvedBy: "",
    operatorFeedback: ""
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [toast, setToast] = useState({ message: '', type: '' });
  const [hofUsers, setHofUsers] = useState([]);

  // --- Dynamic QF Value State & Fetching ---
  const [qfHistory, setQfHistory] = useState([]);
  const [qfValue, setQfValue] = useState("QF / 07 / MPD - 15, Rev. Date: 06-06-2018");

  useEffect(() => {
    const fetchQfHistory = async () => {
      try {
        const token = localStorage.getItem("token");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch(
          `${process.env.REACT_APP_API_URL}/api/qf-values/history/operator-observation-sheet`,
          { headers }
        );
        if (res.ok) {
          const data = await res.json();
          setQfHistory(data);
        }
      } catch (err) {
        console.error("Failed to fetch operator observation QF history:", err);
      }
    };
    fetchQfHistory();
  }, []);

  useEffect(() => {
    let currentQf = "QF / 07 / MPD - 15, Rev. Date: 06-06-2018";
    if (headerInfo.testDate && qfHistory.length > 0) {
      const selectedDate = new Date(headerInfo.testDate);
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
  }, [headerInfo.testDate, qfHistory]);

  const triggerToast = (message, type = 'error') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast({ message: '', type: '' });
    }, 4000);
  };

  const handleHeaderChange = (field, val) => {
    if (field === 'marksPercentage') {
      if (val === "" || /^\d*\.?\d*$/.test(val)) {
        const num = parseFloat(val);
        if (val === "" || (!isNaN(num) && num >= 0 && num <= 100)) {
          setHeaderInfo((prev) => ({ ...prev, [field]: val }));
        }
      }
      return;
    }
    setHeaderInfo((prev) => ({ ...prev, [field]: val }));
  };

  const handleFooterChange = (field, val) => {
    setFooterInfo((prev) => ({ ...prev, [field]: val }));
  };

  const recalculateTotals = (updatedSections) => {
    let allQuestionsAnswered = true;
    let totalObtainedMarks = 0;
    let totalPossibleMarks = 0;

    const computedSections = updatedSections.map((sec) => {
      let secAnsweredCount = 0;
      let secMarks = 0;
      const colTotals = { followed: 0, partiallyFollowed: 0, notFollowed: 0, notAware: 0 };

      sec.items.forEach((item) => {
        const hasSelection = RATING_COLUMNS.some((col) => item[col.key] && item[col.key] !== "");
        if (hasSelection) {
          secAnsweredCount += 1;
        }

        RATING_COLUMNS.forEach((col) => {
          if (item[col.key] === "✓") {
            colTotals[col.key] += col.defaultPoints;
            secMarks += col.defaultPoints;
          }
        });
      });

      const isSecComplete = secAnsweredCount === sec.items.length;
      if (!isSecComplete) {
        allQuestionsAnswered = false;
      }

      totalPossibleMarks += sec.items.length * 5;
      totalObtainedMarks += secMarks;

      return {
        ...sec,
        sectionMarks: isSecComplete ? String(secMarks) : "",
        columnTotals: {
          followed: isSecComplete ? String(colTotals.followed) : "",
          partiallyFollowed: isSecComplete ? String(colTotals.partiallyFollowed) : "",
          notFollowed: isSecComplete ? String(colTotals.notFollowed) : "",
          notAware: isSecComplete ? String(colTotals.notAware) : ""
        }
      };
    });

    if (allQuestionsAnswered && totalPossibleMarks > 0) {
      const percentage = ((totalObtainedMarks / totalPossibleMarks) * 100).toFixed(1);
      setHeaderInfo((prev) => ({ ...prev, marksPercentage: percentage }));
    }

    return computedSections;
  };

  const handleCellChange = (secIdx, itemIdx, colKey, val) => {
    const nextSections = JSON.parse(JSON.stringify(sections));
    const targetItem = nextSections[secIdx].items[itemIdx];

    if (val !== "") {
      RATING_COLUMNS.forEach((col) => {
        if (col.key !== colKey) {
          targetItem[col.key] = "";
        }
      });
    }

    targetItem[colKey] = val;
    const updated = recalculateTotals(nextSections);
    setSections(updated);
  };

  const handleSectionMarksChange = (secIdx, val) => {
    setSections((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      next[secIdx].sectionMarks = val;
      return next;
    });
  };

  const handleColumnTotalChange = (secIdx, colKey, val) => {
    setSections((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      next[secIdx].columnTotals[colKey] = val;
      return next;
    });
  };

  const handleApproveReview = () => {
    setFooterInfo((prev) => ({
      ...prev,
      reviewedBy: loggedInName
    }));
    triggerToast("Reviewed By signed successfully.", "success");
  };

  const populateFrontendData = (records) => {
    const first = records[0];
    
    setHeaderInfo(prev => ({
      ...prev,
      employeeName: first.employeeName || "",
      department: first.department || "",
      marksPercentage: first.marksPercentage?.replace('%', '') || "",
      method: first.method || "Practical & Demo"
    }));
    
    setFooterInfo({
      reviewDate: first.reviewDate ? first.reviewDate.split('T')[0] : first.testDate.split('T')[0],
      reviewedBy: first.reviewedBy || "",
      approvedBy: first.approvedBy || "",
      operatorFeedback: first.operatorFeedback || ""
    });

    const newSections = JSON.parse(JSON.stringify(DEFAULT_SECTIONS));
    records.forEach(r => {
      const sec = newSections.find(s => s.id === r.sectionId);
      if (sec) {
        const item = sec.items.find(i => i.slNo === r.slNo);
        if (item && r.rating) {
          item[r.rating] = "✓";
        }
      }
    });

    const recalculated = recalculateTotals(newSections);
    setSections(recalculated);
  };

  useEffect(() => {
    if (!headerInfo.employeeCode || !headerInfo.testDate) return;

    const fetchRecordData = async () => {
      try {
        const token = localStorage.getItem('token');
        const params = new URLSearchParams({
          machineShop: shopId || 3,
          employeeCode: headerInfo.employeeCode,
          testDate: headerInfo.testDate
        });

        const res = await fetch(`${process.env.REACT_APP_API_URL}/api/operator-observation-sheet?${params.toString()}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
          const data = await res.json();
          if (data && data.length > 0) {
            populateFrontendData(data);
            setIsSavedRecord(true);
            triggerToast("Existing record loaded.", "success");
          } else {
            setIsSavedRecord(false);
            setSections(JSON.parse(JSON.stringify(DEFAULT_SECTIONS)));
            setFooterInfo(prev => ({ ...prev, reviewedBy: "", approvedBy: "", operatorFeedback: "" }));
          }
        }
      } catch (err) {
        console.error("Error fetching record:", err);
      }
    };

    const delayDebounceFn = setTimeout(() => {
      fetchRecordData();
    }, 600);

    return () => clearTimeout(delayDebounceFn);
  }, [headerInfo.employeeCode, headerInfo.testDate, shopId]);

  useEffect(() => {
    const fetchHofUsers = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${process.env.REACT_APP_API_URL}/api/users/hof`, {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (res.ok) {
          const data = await res.json();
          setHofUsers(data);
        } else {
          console.error("Failed to fetch HOF users. Status:", res.status);
        }
      } catch (err) {
        console.error("Error fetching HOF users:", err);
      }
    };
    fetchHofUsers();
  }, []);

  const handleDownloadPDF = async () => {
    if (!headerInfo.employeeCode || !headerInfo.testDate) {
      triggerToast("Please enter Employee Code and Test Date to download PDF.", "error");
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        machineShop: shopId || 3,
        employeeCode: headerInfo.employeeCode,
        testDate: headerInfo.testDate
      });

      const pdfRes = await fetch(`${process.env.REACT_APP_API_URL}/api/operator-observation-sheet/report?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (pdfRes.ok) {
        const blob = await pdfRes.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = `Observation_${headerInfo.employeeCode}_${headerInfo.testDate}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
        triggerToast("PDF downloaded successfully!", "success");
      } else {
        triggerToast("Failed to generate PDF. Record might not exist.", "error");
      }
    } catch (err) {
      triggerToast("Error downloading PDF.", "error");
    }
  };

  const handleSave = async () => {
    if (!headerInfo.employeeName || !headerInfo.employeeCode) {
      triggerToast("Please fill Employee Name and Employee Code before saving.", "error");
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);

    const payloadSections = sections.map(sec => {
      const newItems = sec.items.map(item => {
        let rating = '';
        let score = 0;
        if (item.followed === '✓') { rating = 'followed'; score = 5; }
        else if (item.partiallyFollowed === '✓') { rating = 'partiallyFollowed'; score = 3; }
        else if (item.notFollowed === '✓') { rating = 'notFollowed'; score = 1; }
        else if (item.notAware === '✓') { rating = 'notAware'; score = 0; }
        
        return { ...item, rating, score };
      });
      return { ...sec, items: newItems };
    });

    const payload = {
      header: {
        ...headerInfo,
        machineShop: shopId || 3,
        marksPercentage: headerInfo.marksPercentage ? `${headerInfo.marksPercentage}%` : ""
      },
      sections: payloadSections,
      footer: footerInfo
    };

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/operator-observation-sheet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Save failed');
      }

      setIsSaving(false);
      setSaveSuccess(true);

      await new Promise((resolve) => setTimeout(resolve, 2000));
      navigate(`/operator/${shopId || 3}`);
    } catch (err) {
      console.error('Save error:', err);
      setIsSaving(false);
      triggerToast(err.message || 'Failed to save Operator Observation Sheet.', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-[#2d2d2d] flex flex-col items-center justify-start p-3 sm:p-6 lg:p-8 font-sans antialiased">
      <Header />

      <Toast 
        message={toast.message} 
        type={toast.type} 
        onClose={() => setToast({ message: '', type: '' })} 
      />

      {(isSaving || saveSuccess) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl px-8 sm:px-12 py-8 text-center border border-gray-100 max-w-sm w-full">
            {isSaving ? (
              <>
                <div className="w-12 h-12 border-4 border-gray-200 border-t-orange-500 rounded-full animate-spin mx-auto mb-4"></div>
                <h2 className="text-lg font-bold text-gray-900 tracking-wide">Saving Observation...</h2>
                <p className="text-xs text-gray-500 mt-1 font-medium">Please wait while the sheet is being saved</p>
              </>
            ) : (
              <>
                <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h2 className="text-lg font-bold text-green-800 tracking-wide">Data Saved Successfully</h2>
                <p className="text-xs text-gray-500 mt-1 font-medium">Redirecting to operator dashboard...</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Main Container Card */}
      <div className="bg-white w-full max-w-7xl rounded-2xl p-4 sm:p-8 lg:p-10 shadow-2xl border border-gray-200/80 space-y-7 my-4">
        
        {/* HEADER SECTION */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-200 pb-5 gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="p-2 text-gray-600 hover:text-orange-600 hover:bg-orange-50 rounded-xl transition-all cursor-pointer border border-gray-200 shadow-sm"
              title="Go Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <span className="text-xs font-black text-orange-600 tracking-widest uppercase block mb-0.5">
                {initialFormData.company}
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-gray-900 uppercase tracking-wide">
                {initialFormData.title}
              </h2>
              <div className="text-xs text-gray-500 font-semibold mt-1">
                <span>{qfValue}</span>
              </div>
            </div>
          </div>
          
          <button
            type="button"
            onClick={handleDownloadPDF}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider shadow hover:shadow-md transition-all cursor-pointer self-stretch sm:self-auto justify-center"
          >
            <FileDown className="w-4 h-4" /> Download PDF
          </button>
        </div>

        {/* 1. EMPLOYEE & EVALUATION DETAILS */}
        <div className="bg-white rounded-xl border border-gray-300 p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-200 pb-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
              <span className="font-extrabold text-gray-900 text-xs sm:text-sm uppercase tracking-wide">
                Operator Evaluation Details
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs sm:text-sm">
            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-gray-700 uppercase tracking-wider text-[11px]">Employee Code</label>
              <input
                type="text"
                placeholder="e.g. 710125"
                className="border border-gray-300 rounded-lg p-2.5 font-medium bg-gray-50/50 focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all"
                value={headerInfo.employeeCode}
                onChange={(e) => handleHeaderChange('employeeCode', e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-gray-700 uppercase tracking-wider text-[11px]">Employee Name</label>
              <input
                type="text"
                placeholder="e.g. M. NAGARAJAN"
                className="border border-gray-300 rounded-lg p-2.5 font-medium bg-gray-50/50 focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all"
                value={headerInfo.employeeName}
                onChange={(e) => handleHeaderChange('employeeName', e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-gray-700 uppercase tracking-wider text-[11px]">Department</label>
              <input
                type="text"
                placeholder="Production"
                className="border border-gray-300 rounded-lg p-2.5 font-medium bg-gray-50/50 focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all"
                value={headerInfo.department}
                onChange={(e) => handleHeaderChange('department', e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-gray-700 uppercase tracking-wider text-[11px]">Test Date</label>
              <input
                type="date"
                className="border border-gray-300 rounded-lg p-2.5 font-medium bg-gray-50/50 focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all cursor-pointer"
                value={headerInfo.testDate}
                onChange={(e) => handleHeaderChange('testDate', e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-gray-700 uppercase tracking-wider text-[11px]">Overall Marks (%)</label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="e.g. 82.4"
                  className="w-full border border-gray-300 rounded-lg p-2.5 pr-8 font-extrabold text-gray-900 bg-gray-50/50 focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all"
                  value={headerInfo.marksPercentage}
                  onChange={(e) => handleHeaderChange('marksPercentage', e.target.value)}
                />
                <span className="absolute right-3 top-2.5 font-bold text-gray-500 text-sm">%</span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-gray-700 uppercase tracking-wider text-[11px]">Method</label>
              <input
                type="text"
                placeholder="Practical & Demo"
                className="border border-gray-300 rounded-lg p-2.5 font-medium bg-gray-50/50 focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all"
                value={headerInfo.method}
                onChange={(e) => handleHeaderChange('method', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* 2. OBSERVATION TABLE */}
        <div className="bg-white rounded-xl border border-gray-300 p-5 space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-gray-200 pb-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
              <span className="font-extrabold text-gray-900 text-xs sm:text-sm uppercase tracking-wide">
                Evaluation Criteria & Ratings
              </span>
            </div>
            <span className="text-xs text-gray-500 font-medium">Select ✓ for observed parameter performance</span>
          </div>

          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="w-full border-collapse text-xs sm:text-sm text-left min-w-[700px]">
              <thead className="bg-gray-100/80 text-gray-900 font-extrabold border-b border-gray-200 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-3 w-16 text-center">S.NO.</th>
                  <th className="p-3 px-4 border-l border-gray-200">PARAMETERS</th>
                  {RATING_COLUMNS.map((col) => (
                    <th key={col.key} className="p-3 w-32 text-center border-l border-gray-200 font-black">
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200">
                {sections.map((sec, secIdx) => (
                  <React.Fragment key={`sec-${sec.id}`}>
                    {/* Section Header Row */}
                    <tr className="bg-gray-100 font-black text-gray-900 text-xs sm:text-sm tracking-wide">
                      <td colSpan={2} className="px-4 py-2.5 uppercase bg-gray-200/60 border-t border-gray-300">
                        {sec.title}
                      </td>
                      {RATING_COLUMNS.map((col) => (
                        <td key={`sec-pt-${sec.id}-${col.key}`} className="p-2 text-center font-black text-gray-700 bg-gray-200/60 border-l border-gray-300">
                          {col.defaultPoints} Pts
                        </td>
                      ))}
                    </tr>

                    {/* Section Question Rows */}
                    {sec.items.map((item, itemIdx) => (
                      <tr key={`item-${sec.id}-${item.slNo}`} className="hover:bg-gray-50/60 transition-colors">
                        <td className="p-2.5 text-center font-bold text-gray-600 bg-gray-50/40">
                          {item.slNo}
                        </td>
                        <td className="px-4 py-2 text-gray-800 font-medium border-l border-gray-200 text-xs sm:text-sm">
                          {item.parameter}
                        </td>
                        {RATING_COLUMNS.map((col) => (
                          <td key={`cell-${sec.id}-${item.slNo}-${col.key}`} className="p-1 border-l border-gray-200 text-center">
                            <select
                              value={item[col.key] || ""}
                              onChange={(e) => handleCellChange(secIdx, itemIdx, col.key, e.target.value)}
                              className="w-full h-9 text-center font-extrabold text-sm text-gray-900 bg-transparent rounded-lg outline-none focus:bg-orange-50/50 cursor-pointer transition-all"
                            >
                              <option value=""></option>
                              <option value="✓" className="text-green-700 font-black">✓</option>
                              <option value="X" className="text-red-700 font-black">X</option>
                            </select>
                          </td>
                        ))}
                      </tr>
                    ))}

                    {/* Section Subtotal Row */}
                    <tr className="bg-gray-50/90 font-bold text-xs text-gray-800 border-b-2 border-gray-300">
                      <td className="p-2 text-center font-bold text-gray-700 bg-gray-100/70">
                        Marks:
                      </td>
                      <td className="px-4 py-2 flex justify-between items-center border-l border-gray-200">
                        <span className="uppercase text-gray-600 font-black text-[11px] tracking-wider">
                          Section Score
                        </span>
                        <input
                          type="text"
                          placeholder="Marks"
                          value={sec.sectionMarks || ""}
                          onChange={(e) => handleSectionMarksChange(secIdx, e.target.value)}
                          className="w-24 border border-gray-300 rounded-lg px-2.5 py-1 text-xs font-black text-gray-900 bg-white outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-right"
                        />
                      </td>
                      {RATING_COLUMNS.map((col) => (
                        <td key={`col-tot-${sec.id}-${col.key}`} className="p-1 border-l border-gray-200 text-center">
                          <input
                            type="text"
                            placeholder="0"
                            value={sec.columnTotals[col.key] || ""}
                            onChange={(e) => handleColumnTotalChange(secIdx, col.key, e.target.value)}
                            className="w-full text-center py-1 font-black text-gray-900 bg-transparent outline-none text-xs"
                          />
                        </td>
                      ))}
                    </tr>
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 3. SIGN-OFF & REVIEW SECTION */}
        <div className="bg-white rounded-xl border border-gray-300 p-5 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
            <span className="font-extrabold text-gray-900 text-xs sm:text-sm uppercase tracking-wide">
              Sign-off & Verification
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs sm:text-sm">
            {/* Review Date */}
            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-gray-700 uppercase tracking-wider text-[11px]">Review Date</label>
              <input
                type="date"
                className="border border-gray-300 rounded-lg p-2.5 font-medium bg-gray-50/50 focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all cursor-pointer"
                value={footerInfo.reviewDate}
                onChange={(e) => handleFooterChange('reviewDate', e.target.value)}
              />
            </div>
            
            {/* Reviewed By */}
            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-gray-700 uppercase tracking-wider text-[11px]">Reviewed By</label>
              {footerInfo.reviewedBy ? (
                <div className="flex items-center justify-between border border-green-300 bg-green-50 rounded-lg p-2.5">
                  <span className="text-green-800 font-extrabold uppercase text-xs">
                    {footerInfo.reviewedBy}
                  </span>
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleApproveReview}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white p-2.5 rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm transition-all cursor-pointer"
                >
                  Approve Review
                </button>
              )}
            </div>
            
            {/* Approved By */}
            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-gray-700 uppercase tracking-wider text-[11px]">Approved By (HOF)</label>
              {footerInfo.approvedBy && footerInfo.approvedBy.includes('(Verified)') ? (
                <div className="flex items-center justify-between border border-green-300 bg-green-50 rounded-lg p-2.5">
                  <span className="text-green-800 font-extrabold uppercase text-xs">
                    {footerInfo.approvedBy.replace(' (Verified)', '')}
                  </span>
                  <span className="text-[10px] font-black uppercase text-green-700 bg-green-200/50 px-2 py-0.5 rounded">
                    Verified
                  </span>
                </div>
              ) : (
                <div className="relative flex items-center">
                  <select
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-orange-700 font-bold bg-gray-50/50 focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none cursor-pointer text-xs transition-all"
                    value={footerInfo.approvedBy}
                    onChange={(e) => handleFooterChange('approvedBy', e.target.value)}
                  >
                    <option value="">Select HOF Incharge...</option>
                    {hofUsers.map((user, idx) => (
                      <option key={idx} value={user.username}>
                        {user.username} ({user.employeeId})
                      </option>
                    ))}
                  </select>
                  
                  {footerInfo.approvedBy && isSavedRecord && (
                    <span className="absolute right-2 top-2.5 bg-yellow-100 text-yellow-800 text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider shadow-sm">
                      Pending
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="bg-orange-50/60 rounded-lg border border-orange-200/70 p-3 flex items-center gap-2 text-xs font-bold text-orange-900">
            <Info className="w-4 h-4 text-orange-600 flex-shrink-0" />
            <span>CRITERIA BENCHMARK: 75% or higher overall score = GOOD (Standard Passed)</span>
          </div>

          <div className="pt-2">
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Operator Feedback & General Remarks:
            </label>
            <textarea
              rows={3}
              placeholder="Enter operator feedback or remarks..."
              className="w-full border border-gray-300 p-3 text-sm rounded-lg outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-gray-50/40 focus:bg-white font-medium resize-y transition-all"
              value={footerInfo.operatorFeedback}
              onChange={(e) => handleFooterChange('operatorFeedback', e.target.value)}
            />
          </div>
        </div>

        {/* 4. FOOTER & SUBMIT BUTTON */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-5 border-t border-gray-200">
          <span className="text-xs text-gray-500 font-semibold text-center sm:text-left">
            Form Ref: {qfValue}
          </span>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || saveSuccess}
            className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white px-9 py-3.5 rounded-xl font-black transition-all shadow-lg hover:shadow-orange-500/25 cursor-pointer uppercase tracking-wider text-xs sm:text-sm active:scale-95"
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