import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, FileDown, X, ChevronDown } from "lucide-react";
import Header from "../components/Header";

const GAP_MONTHS = 6;
const GENERATED_COUNT = 3; // next plans generated after a date is chosen
const LOADED_COUNT = 3; // last saved plans loaded (locked) for an existing employee

const formMeta = {
  formCode: "QF/XX/MPD-XX",
  revision: "00",
  revisionDate: "01.01.2024",
  title: "OPERATOR OBSERVATION PLAN",
  company: "SAKTHI AUTO",
};

const API = process.env.REACT_APP_API_URL || "";

// ---------- helpers ----------
const pad2 = (n) => String(n).padStart(2, "0");

const addMonths = (dt, months) => {
  const m = String(dt || "").match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return "";
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const total = y * 12 + (mo - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = total % 12;
  const dim = new Date(ny, nm + 1, 0).getDate();
  return `${ny}-${pad2(nm + 1)}-${pad2(Math.min(d, dim))}T${pad2(h)}:${pad2(mi)}`;
};

const createPlan = (planNo, planDateTime = "") => ({
  planNo,
  planDateTime,
  actualStatus: "",
  isSaved: false,
  actualLocked: false,
  manual: false,
});

const createEmptyRow = () => ({
  empName: "",
  empNo: "",
  doj: "",
  lookedUpEmpNo: "",
  isExisting: false,
  plans: [createPlan(1)],
});

const buildGenerated = (startNo, baseDateTime) =>
  Array.from({ length: GENERATED_COUNT }, (_, i) =>
    createPlan(startNo + i, addMonths(baseDateTime, GAP_MONTHS * (i + 1)))
  );

const actualColor = (v) =>
  v === "COMPLETED"
    ? "bg-green-600 text-white font-bold"
    : v === "NOT COMPLETED"
    ? "bg-red-600 text-white font-bold"
    : "bg-white text-gray-800";

const Toast = ({ message, type, onClose }) => {
  if (!message) return null;
  const bgColor = type === "error" ? "bg-red-600" : type === "success" ? "bg-green-600" : "bg-orange-600";
  return (
    <div
      className={`fixed bottom-6 right-6 z-50 ${bgColor} text-white px-5 py-3 rounded-lg shadow-2xl flex items-center gap-3 transition-all transform animate-bounce`}
    >
      <span className="text-sm font-semibold">{message}</span>
      <button onClick={onClose} className="ml-2 font-bold text-lg leading-none hover:text-gray-200 focus:outline-none">
        ×
      </button>
    </div>
  );
};

export default function OperatorObservationPlan() {
  const { shopId } = useParams();
  const navigate = useNavigate();

  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  const currentUsername = currentUser?.username || currentUser?.employeeId || "Unknown";
  const currentUserRole = (currentUser?.role || "").toLowerCase();

  const isShiftIncharge =
    currentUserRole === "shiftincharge" ||
    currentUserRole === "supervisor" ||
    currentUserRole === "operator" ||
    currentUserRole === "";
  const isReadOnly = !isShiftIncharge;

  const [rows, setRows] = useState([createEmptyRow()]);
  const [signature, setSignature] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfEmpNo, setPdfEmpNo] = useState("");
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const [toast, setToast] = useState({ message: "", type: "" });
  const toastTimer = useRef(null);
  const [employeeOptions, setEmployeeOptions] = useState([]);

  const [openDropdownRow, setOpenDropdownRow] = useState(null);
  const [dropdownCoords, setDropdownCoords] = useState({ top: 0, left: 0 });
  const dropdownRef = useRef(null);

  const [qfHistory, setQfHistory] = useState([]);
  const [qfValue, setQfValue] = useState("QF/XX/MPD-XX, Revision 00 dt 01.01.2024");

  const triggerToast = (message, type = "error") => {
    setToast({ message, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast({ message: "", type: "" }), 4000);
  };

  const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

  useEffect(() => () => toastTimer.current && clearTimeout(toastTimer.current), []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpenDropdownRow(null);
      }
    };
    if (openDropdownRow !== null) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [openDropdownRow]);

  useEffect(() => {
    const handleScrollOrResize = () => {
      if (openDropdownRow !== null) {
        setOpenDropdownRow(null);
      }
    };
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [openDropdownRow]);

  useEffect(() => {
    const loadMasterData = async () => {
      try {
        const params = new URLSearchParams({
          machineShop: String(shopId || 3),
        });

        const res = await fetch(
          `${API}/api/operator-observation-plan/employee-options?${params}`,
          { headers: authHeaders() }
        );

        if (res.ok) {
          const data = await res.json();
          setEmployeeOptions(
            Array.isArray(data.employeeNumbers) ? data.employeeNumbers : []
          );
        }

        const qfRes = await fetch(`${API}/api/qf-values/history/operator-observation-plan`, {
          headers: authHeaders(),
        }).catch(() => null);
        if (qfRes && qfRes.ok) {
          const historyData = await qfRes.json();
          setQfHistory(historyData || []);
        }
      } catch (err) {
        console.error("Master data load error:", err);
      }
    };

    loadMasterData();
  }, [shopId]);

  useEffect(() => {
    let currentQf = "QF/XX/MPD-XX, Revision 00 dt 01.01.2024";
    const baseDate = rows[0]?.plans?.[0]?.planDateTime || rows[0]?.doj;

    if (baseDate && qfHistory.length > 0) {
      const selectedDate = new Date(baseDate);
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
  }, [rows, qfHistory]);

  const toggleDropdown = (rIdx, buttonEl) => {
    if (openDropdownRow === rIdx) {
      setOpenDropdownRow(null);
    } else {
      const rect = buttonEl.getBoundingClientRect();
      const dropdownHeight = Math.min(220, Math.max(60, employeeOptions.length * 36 + 32));
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUpwards = spaceBelow < dropdownHeight && rect.top > dropdownHeight;

      setDropdownCoords({
        top: openUpwards ? rect.top - dropdownHeight - 2 : rect.bottom + 2,
        left: Math.max(10, rect.right - 180),
      });
      setOpenDropdownRow(rIdx);
    }
  };

  const lookupEmployee = async (rIdx, empNoRaw) => {
    const empNo = String(empNoRaw || "").trim();
    const current = rows[rIdx];
    if (!empNo || !current || empNo === current.lookedUpEmpNo) return;

    const duplicate = rows.some(
      (r, i) => i !== rIdx && r.empNo.trim().toLowerCase() === empNo.toLowerCase()
    );
    if (duplicate) {
      triggerToast(`Emp No ${empNo} is already entered in another row.`, "error");
      setRows((prev) => prev.map((r, i) => (i === rIdx ? { ...createEmptyRow() } : r)));
      return;
    }

    try {
      const res = await fetch(
        `${API}/api/operator-observation-plan/employee?machineShop=${encodeURIComponent(
          shopId || 3
        )}&empNo=${encodeURIComponent(empNo)}`,
        { headers: authHeaders() }
      );
      if (!res.ok) throw new Error("Lookup failed");
      const data = await res.json();

      setRows((prev) =>
        prev.map((r, i) => {
          if (i !== rIdx) return r;

          if (data.found && data.plans.length > 0) {
            const saved = data.plans.slice(-LOADED_COUNT).map((p) => ({
              ...createPlan(p.planNo, p.planDateTime),
              actualStatus: p.actualStatus || "",
              isSaved: true,
              actualLocked: !!p.actualStatus,
            }));
            const last = saved[saved.length - 1];
            return {
              ...r,
              empNo,
              empName: data.empName || "",
              doj: data.doj || "",
              lookedUpEmpNo: empNo,
              isExisting: true,
              plans: [...saved, ...buildGenerated(last.planNo + 1, last.planDateTime)],
            };
          }

          return {
            ...r,
            empNo,
            empName: r.isExisting ? "" : r.empName,
            doj: r.isExisting ? "" : r.doj,
            lookedUpEmpNo: empNo,
            isExisting: false,
            plans: [createPlan(1)],
          };
        })
      );

      if (data.found) triggerToast("Existing employee data loaded.", "success");
    } catch (err) {
      console.error("Employee lookup error:", err);
      triggerToast("Failed to look up Emp No.", "error");
    }
  };

  const handleRowField = (rIdx, field, val) => {
    if (isReadOnly) return;
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== rIdx) return r;
        if (r.isExisting && (field === "empName" || field === "doj")) return r;
        return { ...r, [field]: val };
      })
    );
  };

  const handleSelectEmployeeOption = (rIdx, selectedEmpNo) => {
    setOpenDropdownRow(null);
    handleRowField(rIdx, "empNo", selectedEmpNo);
    lookupEmployee(rIdx, selectedEmpNo);
  };

  const handlePlanChange = (rIdx, pIdx, val) => {
    if (isReadOnly) return;
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== rIdx) return r;
        const plans = r.plans.map((p) => ({ ...p }));
        const target = plans[pIdx];
        if (!target || target.isSaved) return r;

        target.planDateTime = val;
        target.manual = true;
        if (!val) target.actualStatus = "";

        if (!r.isExisting && pIdx === 0) {
          target.manual = false;
          if (val) {
            if (plans.length === 1) {
              for (let k = 1; k <= GENERATED_COUNT; k++) {
                plans.push(createPlan(k + 1, addMonths(val, GAP_MONTHS * k)));
              }
            } else {
              for (let k = 1; k < plans.length; k++) {
                if (!plans[k].manual && !plans[k].isSaved) {
                  plans[k].planDateTime = addMonths(val, GAP_MONTHS * k);
                }
              }
            }
          }
        }
        return { ...r, plans };
      })
    );
  };

  const handleActualChange = (rIdx, pIdx, val) => {
    if (isReadOnly) return;
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== rIdx) return r;
        const plans = r.plans.map((p, k) => {
          if (k !== pIdx || p.actualLocked || !p.planDateTime) return p;
          return { ...p, actualStatus: val };
        });
        return { ...r, plans };
      })
    );
  };

  const handleRemoveEmployeeOption = async (empNo) => {
    try {
      const params = new URLSearchParams({
        machineShop: String(shopId || 3),
        empNo,
      });

      const res = await fetch(
        `${API}/api/operator-observation-plan/employee-options?${params}`,
        {
          method: "DELETE",
          headers: authHeaders(),
        }
      );

      if (!res.ok) {
        throw new Error("Failed to remove employee number");
      }

      setEmployeeOptions((prev) =>
        prev.filter((option) => option.empNo !== empNo)
      );

      triggerToast("Employee number removed from dropdown.", "success");
    } catch (err) {
      console.error("Remove employee-number option error:", err);
      triggerToast("Failed to remove employee number.", "error");
    }
  };

  const handleAddRow = () => {
    if (isReadOnly) return;
    setRows((prev) => [...prev, createEmptyRow()]);
  };

  const handleRemoveRow = () => {
    if (isReadOnly) return;
    setRows((prev) => (prev.length <= 1 ? prev : prev.slice(0, -1)));
  };

  const handleApprove = () => {
    if (!isShiftIncharge) return;
    const hasData = rows.some((r) => r.empNo.trim());
    if (!hasData) {
      triggerToast("Enter at least one employee before approving.", "error");
      return;
    }
    setSignature(currentUsername || "Approved");
    triggerToast("Shift Incharge approved successfully.", "success");
  };

  const handleDownloadPdf = async () => {
    if (!pdfEmpNo.trim()) {
      triggerToast("Please enter an Emp No.", "error");
      return;
    }
    setIsDownloadingPdf(true);
    try {
      const params = new URLSearchParams({ empNo: pdfEmpNo.trim(), shopId: String(shopId || 3) });
      const res = await fetch(`${API}/api/operator-observation-plan/report?${params.toString()}`, {
        headers: authHeaders(),
      });
      if (res.status === 404) throw new Error("No records found for this Emp No.");
      if (!res.ok) throw new Error("Report request failed");

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `Operator_Observation_Plan_${pdfEmpNo.trim()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);

      setShowPdfModal(false);
      triggerToast("PDF generated and downloaded!", "success");
    } catch (err) {
      console.error("PDF generation failed:", err);
      triggerToast(err.message || "Failed to generate PDF", "error");
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleSave = async () => {
    const activeRows = rows.filter(
      (r) => r.empNo.trim() || r.empName.trim() || r.doj || r.plans.some((p) => p.planDateTime)
    );
    if (activeRows.length === 0) {
      triggerToast("Please add at least one employee.", "error");
      return;
    }

    for (let i = 0; i < activeRows.length; i++) {
      const r = activeRows[i];
      if (!r.empName.trim() || !r.empNo.trim() || !r.doj) {
        triggerToast("Name, Emp No and DOJ are required for every row.", "error");
        return;
      }
      if (!r.plans.some((p) => p.planDateTime)) {
        triggerToast(`Please enter a plan date & time for Emp No ${r.empNo}.`, "error");
        return;
      }
    }

    if (!signature) {
      triggerToast("Please click 'Approve' under SHIFT INCHARGE before submitting.", "error");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      triggerToast("Authentication token missing. Please log in again.", "error");
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);

    const payload = {
      machineShop: shopId || 3,
      signature,
      rows: activeRows.map((r) => ({
        empName: r.empName.trim(),
        empNo: r.empNo.trim(),
        doj: r.doj,
        plans: r.plans
          .filter((p) => p.planDateTime)
          .map((p) => ({
            planNo: p.planNo,
            planDateTime: p.planDateTime,
            actualStatus: p.actualStatus,
            isSaved: p.isSaved,
          })),
      })),
    };

    try {
      const res = await fetch(`${API}/api/operator-observation-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Server returned ${res.status}: ${errorText}`);
      }

      setIsSaving(false);
      setSaveSuccess(true);
      triggerToast("Record saved and submitted successfully!", "success");
      await new Promise((resolve) => setTimeout(resolve, 1500));
      navigate(`/shift-incharge/${shopId || 3}`);
    } catch (err) {
      console.error("Save error:", err);
      setIsSaving(false);
      triggerToast(`Failed to save report. Error: ${err.message}`, "error");
    }
  };

  const maxPlans = Math.max(1, ...rows.map((r) => r.plans.length));
  const isApproved = Boolean(signature && signature !== "Pending");

  const renderPlanCells = (r, rIdx, pIdx) => {
    const p = r.plans[pIdx];

    if (!p) {
      return (
        <React.Fragment key={`empty-${rIdx}-${pIdx}`}>
          <td className="border border-gray-800 p-0 bg-gray-50" />
          <td className="border border-gray-800 p-0 bg-gray-50" />
        </React.Fragment>
      );
    }

    const planLocked = isReadOnly || p.isSaved;
    const actualLocked = isReadOnly || p.actualLocked;

    return (
      <React.Fragment key={`plan-${rIdx}-${pIdx}`}>
        <td className={`border border-gray-800 p-0 ${p.isSaved ? "bg-gray-50" : ""}`}>
          <div className="flex items-center">
            <input
              type="datetime-local"
              disabled={planLocked}
              className="w-full h-full text-center outline-none bg-transparent py-1 px-0.5 font-medium text-[11px] disabled:text-gray-700"
              value={p.planDateTime}
              onChange={(e) => handlePlanChange(rIdx, pIdx, e.target.value)}
            />
            {!planLocked && p.planDateTime && (
              <button
                type="button"
                title="Clear this plan"
                onClick={() => handlePlanChange(rIdx, pIdx, "")}
                className="px-1 text-gray-400 hover:text-red-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </td>

        <td className="border border-gray-800 p-0">
          {actualLocked ? (
            <div
              className={`w-full h-full min-h-[40px] flex items-center justify-center py-2 px-1 text-[11px] uppercase tracking-wide ${
                p.actualStatus ? actualColor(p.actualStatus) : "bg-white text-gray-400"
              }`}
            >
              {p.actualStatus || "-"}
            </div>
          ) : (
            <select
              disabled={!p.planDateTime}
              className={`w-full h-full min-h-[40px] text-center outline-none py-1 px-0.5 text-[11px] cursor-pointer disabled:cursor-not-allowed disabled:text-gray-400 ${actualColor(
                p.actualStatus
              )}`}
              value={p.actualStatus}
              onChange={(e) => handleActualChange(rIdx, pIdx, e.target.value)}
            >
              <option value="" className="bg-white text-gray-800 font-medium">
                Select
              </option>
              <option value="COMPLETED" className="bg-white text-gray-800 font-medium">
                COMPLETED
              </option>
              <option value="NOT COMPLETED" className="bg-white text-gray-800 font-medium">
                NOT COMPLETED
              </option>
            </select>
          )}
        </td>
      </React.Fragment>
    );
  };

  return (
    <div className="min-h-screen bg-[#2d2d2d] flex flex-col items-center justify-center p-6 pb-20">
      <Header />

      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: "", type: "" })} />

      {openDropdownRow !== null && (
        <div
          ref={dropdownRef}
          style={{
            position: "fixed",
            top: `${dropdownCoords.top}px`,
            left: `${dropdownCoords.left}px`,
            width: "180px",
            zIndex: 9999,
          }}
          className="bg-white border border-gray-300 rounded-lg shadow-2xl py-1 text-left text-xs"
        >
          <div className="px-3 py-1 font-bold text-[10px] text-gray-500 uppercase tracking-wider border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-lg">
            <span>Saved Emp Nos</span>
            <span className="text-[9px] bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded font-semibold">
              {employeeOptions.length}/10
            </span>
          </div>

          {employeeOptions.length === 0 ? (
            <div className="px-3 py-3 text-gray-400 italic text-center">
              No saved employees
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto divide-y divide-gray-50">
              {employeeOptions.map((option) => (
                <div
                  key={option.id || option.empNo}
                  className="flex items-center justify-between px-3 py-1.5 hover:bg-orange-50 group cursor-pointer transition-colors"
                  onClick={() => handleSelectEmployeeOption(openDropdownRow, option.empNo)}
                >
                  <span className="font-semibold text-gray-800 group-hover:text-orange-600 truncate">
                    {option.empNo}
                  </span>
                  <button
                    type="button"
                    title="Remove from saved"
                    className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded ml-2 transition-colors cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveEmployeeOption(option.empNo);
                    }}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showPdfModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md border-2 border-gray-100">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <FileDown className="w-5 h-5 text-orange-500" />
                <h3 className="text-lg font-bold text-gray-800 uppercase tracking-wide">Download Report by Emp No</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPdfModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-6">
              <label className="font-bold text-gray-700 block mb-1 text-xs uppercase tracking-wider">Emp No</label>
              <input
                type="text"
                value={pdfEmpNo}
                onChange={(e) => setPdfEmpNo(e.target.value)}
                placeholder="Enter Emp No"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
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
                onClick={handleDownloadPdf}
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

      {(isSaving || saveSuccess) && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl px-10 py-8 text-center">
            {isSaving ? (
              <>
                <div className="w-10 h-10 border-4 border-gray-300 border-t-orange-500 rounded-full animate-spin mx-auto mb-5"></div>
                <h2 className="text-xl font-bold text-gray-800">Saving Data...</h2>
                <p className="text-gray-500 mt-2">Submitting Operator Observation Plan</p>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold text-green-800">Data Saved Successfully</h2>
                <p className="text-gray-500 mt-2">Redirecting...</p>
              </>
            )}
          </div>
        </div>
      )}

      <div className="bg-white w-full max-w-[98rem] rounded-xl p-8 shadow-2xl overflow-x-auto border-4 border-gray-100 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-200 pb-4 gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <button
                type="button"
                onClick={() => navigate(`/shift-incharge/${shopId || 3}`)}
                className="p-1 text-gray-600 hover:text-orange-600 hover:bg-gray-100 rounded-full transition-colors"
                title="Back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <span className="text-xs font-bold text-orange-600 tracking-wider uppercase">{formMeta.company}</span>
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-gray-800 uppercase tracking-wide">{formMeta.title}</h2>
            <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-2 font-bold">
              <span>{qfValue}</span>
              <span>|</span>
              <span className="font-bold text-orange-600">Shop ID: {shopId}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowPdfModal(true)}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider shadow transition-colors cursor-pointer"
          >
            <FileDown className="w-4 h-4" /> Preview PDF
          </button>
        </div>

        <div className="pt-2">
          {!isReadOnly && (
            <div className="flex justify-between items-center mb-2 px-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Observation Plan Entries</span>
                <span className="text-[11px] bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full font-semibold">
                  {rows.length} Rows
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAddRow}
                  className="inline-flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold px-4 py-2 rounded transition-colors shadow hover:cursor-pointer"
                >
                  + Add Row
                </button>
                {rows.length > 1 && (
                  <button
                    type="button"
                    onClick={handleRemoveRow}
                    className="inline-flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-3 py-2 rounded transition-colors shadow hover:cursor-pointer"
                  >
                    − Delete Row
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table
              className="w-full border-collapse border-2 border-gray-800 text-xs text-center"
              style={{ minWidth: `${520 + maxPlans * 340}px` }}
            >
              <thead>
                <tr className="bg-gray-100 text-gray-800 font-bold">
                  <th rowSpan={2} className="border border-gray-800 p-1 w-[40px]">
                    Sl.<br />No
                  </th>
                  <th rowSpan={2} className="border border-gray-800 p-1 w-[160px]">Name</th>
                  <th rowSpan={2} className="border border-gray-800 p-1 w-[110px]">Emp No</th>
                  <th rowSpan={2} className="border border-gray-800 p-1 w-[130px]">DOJ</th>
                  <th colSpan={maxPlans * 2} className="border border-gray-800 p-1 bg-gray-200">
                    TEST STATUS
                  </th>
                </tr>
                <tr className="bg-gray-50 text-gray-800 font-bold text-[11px]">
                  {Array.from({ length: maxPlans }).map((_, k) => (
                    <React.Fragment key={`h-${k}`}>
                      <th className="border border-gray-800 p-1 w-[200px]">PLAN</th>
                      <th className="border border-gray-800 p-1 w-[140px]">ACTUAL</th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, rIdx) => (
                  <tr key={`row-${rIdx}`} className="h-10 hover:bg-gray-50">
                    <td className="border border-gray-800 p-1 font-semibold">{rIdx + 1}</td>
                    <td className={`border border-gray-800 p-0 ${r.isExisting ? "bg-gray-50" : ""}`}>
                      <input
                        type="text"
                        disabled={isReadOnly || r.isExisting}
                        className="w-full h-full text-center outline-none bg-transparent py-1 px-1 font-medium disabled:text-gray-700"
                        value={r.empName}
                        onChange={(e) => handleRowField(rIdx, "empName", e.target.value)}
                        placeholder="Enter name"
                      />
                    </td>

                    <td className="border border-gray-800 p-0">
                      <div className="flex items-center h-full">
                        <input
                          type="text"
                          disabled={isReadOnly}
                          className="w-full h-full min-w-0 text-center outline-none bg-transparent py-1 px-1 font-medium disabled:text-gray-700"
                          value={r.empNo}
                          onChange={(e) => handleRowField(rIdx, "empNo", e.target.value)}
                          onBlur={(e) => lookupEmployee(rIdx, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              lookupEmployee(rIdx, e.target.value);
                            }
                          }}
                          placeholder="Emp No"
                        />

                        {!isReadOnly && (
                          <button
                            type="button"
                            title="Saved employee numbers"
                            onClick={(e) => toggleDropdown(rIdx, e.currentTarget)}
                            className="w-5 shrink-0 h-full flex items-center justify-center border-l border-gray-200 bg-white text-gray-500 hover:text-orange-600 hover:bg-gray-100 transition-colors cursor-pointer"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>

                    <td className={`border border-gray-800 p-0 ${r.isExisting ? "bg-gray-50" : ""}`}>
                      <input
                        type="date"
                        disabled={isReadOnly || r.isExisting}
                        className="w-full h-full text-center outline-none bg-transparent py-1 px-1 font-medium text-[11px] disabled:text-gray-700"
                        value={r.doj}
                        onChange={(e) => handleRowField(rIdx, "doj", e.target.value)}
                      />
                    </td>
                    {Array.from({ length: maxPlans }).map((_, pIdx) => renderPlanCells(r, rIdx, pIdx))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="overflow-x-auto mt-6">
          <table className="w-full max-w-md border-collapse border-2 border-gray-800 text-xs text-center">
            <thead>
              <tr className="bg-gray-100 text-gray-800 font-bold">
                <th className="border border-gray-800 p-3">SHIFT INCHARGE</th>
              </tr>
            </thead>
            <tbody>
              <tr className="h-16">
                <td className="border border-gray-800 p-2 text-center align-middle bg-gray-50/40">
                  {isApproved ? (
                    <div className="flex flex-col items-center justify-center">
                      <span className="text-[10px] font-bold text-green-600 uppercase">Approved By ✓</span>
                      <span className="text-xs font-black text-gray-900 uppercase">{signature}</span>
                    </div>
                  ) : isShiftIncharge ? (
                    <button
                      type="button"
                      onClick={handleApprove}
                      className="bg-orange-500 hover:bg-orange-600 text-white text-[11px] font-bold px-4 py-1.5 rounded shadow hover:scale-105 transition-all uppercase tracking-wider cursor-pointer"
                    >
                      Approve
                    </button>
                  ) : (
                    <span className="text-gray-400 text-xs italic">Pending Shift Incharge</span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {!isReadOnly && (
          <div className="flex justify-end items-end mt-6 pt-4 border-t border-gray-300">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || saveSuccess}
              className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white px-10 py-3 rounded font-bold transition-colors shadow-lg hover:cursor-pointer flex items-center gap-2 uppercase tracking-wider text-sm"
            >
              {isSaving ? "SAVING..." : saveSuccess ? "SAVED ✓" : "Submit"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}