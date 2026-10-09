import React, { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Save, RefreshCw } from "lucide-react";
import { toast } from "react-toastify";

const API = process.env.REACT_APP_API_URL || "";

const SPECIAL_CHARS = ["Ø", "±", "°", "×", "≤", "≥", "⌀", "⊥", "∥", "√", "Ra", "~", "'", '"', "µm", "R", "C"];

const DEFAULT_ROWS = 10;
const emptyRow = () => ({ controlName: "", specification: "" });
const blankRows = () => Array.from({ length: DEFAULT_ROWS }, emptyRow);

export default function JobSetupMasterConfigurator({ shopId }) {
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  const currentUsername = currentUser?.username || currentUser?.employeeId || "";

  const [partSets, setPartSets] = useState([]);
  const [loadingParts, setLoadingParts] = useState(true);
  const [machineDetails, setMachineDetails] = useState([]);
  const [lineMappings, setLineMappings] = useState([]);
  const [masters, setMasters] = useState([]);
  const [partName, setPartName] = useState("");
  const [rows, setRows] = useState([]);
  const [hasMaster, setHasMaster] = useState(false);
  const [loadingSpecs, setLoadingSpecs] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const activeRef = useRef({ idx: null, field: null, element: null });
  const loadSeqRef = useRef(0);

  const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

  // Derive distinct Part Names from M{shopId}PartSets (fallback to legacy if empty)
  const partOptions = Array.from(
    new Set(
      partSets.length > 0
        ? partSets.map((p) => p.partName).filter(Boolean)
        : [
            ...machineDetails.map((m) => m.partName).filter(Boolean),
            ...lineMappings.map((m) => m.partSet).filter(Boolean),
            "KNUCKLE - STRG, FR LH/RH(XBA MY19)",
            "PIVOT SUSPENSION GOA CC21 (078) LH/RH",
          ]
    )
  );

  const fetchMasters = async () => {
    try {
      const res = await fetch(`${API}/api/job-setup-verification/masters`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setMasters(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      /* ignore */
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        setLoadingParts(true);
        const currentShop = shopId || "3";

        // Fetch from dynamic M{shopId}PartSets endpoint
        const partRes = await fetch(`${API}/api/job-setup-verification/parts/${currentShop}`, {
          headers: authHeaders(),
        }).catch(() => null);
        if (partRes && partRes.ok) {
          const partData = await partRes.json();
          setPartSets(Array.isArray(partData) ? partData : []);
        }

        if (shopId) {
          const res = await fetch(`${API}/api/machine-shop/${shopId}/details`, { headers: authHeaders() }).catch(() => null);
          if (res && res.ok) setMachineDetails((await res.json()) || []);
          const mapRes = await fetch(`${API}/api/mappings/${shopId}/lines`, { headers: authHeaders() }).catch(() => null);
          if (mapRes && mapRes.ok) setLineMappings((await mapRes.json()) || []);
        }
      } catch (e) {
        /* ignore */
      } finally {
        setLoadingParts(false);
      }
    };
    load();
    fetchMasters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId]);

  const loadSpecs = async (name) => {
    const seq = ++loadSeqRef.current;
    activeRef.current = { idx: null, field: null, element: null };
    if (!name) {
      setRows([]);
      setHasMaster(false);
      return;
    }
    setLoadingSpecs(true);
    try {
      const res = await fetch(
        `${API}/api/job-setup-verification/specifications?partName=${encodeURIComponent(name)}`,
        { headers: authHeaders() }
      );
      if (seq !== loadSeqRef.current) return;
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      const specs = Array.isArray(data.specifications) ? data.specifications : [];
      if (specs.length > 0) {
        setRows(specs.map((s) => ({ controlName: s.controlName || "", specification: s.specification || "" })));
        setHasMaster(true);
      } else {
        setRows(blankRows());
        setHasMaster(false);
      }
    } catch (e) {
      if (seq === loadSeqRef.current) {
        toast.error("Failed to load control specifications.");
        setRows(blankRows());
        setHasMaster(false);
      }
    }
    if (seq === loadSeqRef.current) setLoadingSpecs(false);
  };

  const handlePartChange = (val) => {
    setPartName(val);
    loadSpecs(val);
  };

  const updateRow = (idx, field, val) =>
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: val } : r)));

  const insertSymbol = (e, char) => {
    e.preventDefault();
    const { idx, field, element } = activeRef.current;
    if (idx === null || !field) {
      toast.info("Click on a Control or Specification field first to insert a symbol");
      return;
    }
    const cur = rows[idx]?.[field] || "";
    const start = element && typeof element.selectionStart === "number" ? element.selectionStart : cur.length;
    const end = element && typeof element.selectionEnd === "number" ? element.selectionEnd : cur.length;
    const next = cur.slice(0, start) + char + cur.slice(end);
    updateRow(idx, field, next);
    setTimeout(() => {
      if (element) {
        element.focus();
        element.setSelectionRange(start + char.length, start + char.length);
      }
    }, 0);
  };

  const handleSave = async () => {
    if (!partName) {
      toast.error("Please select a Part Name first.");
      return;
    }
    const cleaned = rows
      .map((r) => ({ controlName: r.controlName.trim(), specification: r.specification.trim() }))
      .filter((r) => r.controlName || r.specification);

    if (cleaned.length === 0) {
      toast.error("Enter at least one Control / Specification row.");
      return;
    }

    const matchedPartSet = partSets.find((p) => p.partName === partName);
    const matchedMachine = machineDetails.find((m) => m.partName === partName);
    const mappingMatch = lineMappings.find((m) => m.partSet === partName);
    const partNo = matchedPartSet?.partId || matchedMachine?.partNo || mappingMatch?.idSet || "";

    setIsSaving(true);
    try {
      const res = await fetch(`${API}/api/job-setup-verification/specifications`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          partName,
          partNo,
          specifications: cleaned,
          username: currentUsername,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save control specifications");
      }
      setRows(cleaned.map((r) => ({ ...r })));
      setHasMaster(true);
      toast.success("Control specifications saved for this part!");
      fetchMasters();
    } catch (err) {
      toast.error(err.message || "Failed to save control specifications");
    }
    setIsSaving(false);
  };

  const configuredNames = new Set(masters.map((m) => m.partName));

  return (
    <div className="space-y-4">
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <label className="font-bold text-gray-800 text-sm md:w-40">Part Name:</label>
          <select
            className="flex-1 border border-gray-300 p-2 rounded font-bold text-gray-900 bg-white outline-none uppercase text-sm cursor-pointer"
            value={partName}
            onChange={(e) => handlePartChange(e.target.value)}
          >
            <option value="">{loadingParts ? "-- Loading Parts... --" : "-- Select Part Name --"}</option>
            {partOptions.map((p) => (
              <option key={p} value={p}>
                {configuredNames.has(p) ? `✓ ${p}` : p}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => loadSpecs(partName)}
            disabled={!partName}
            className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 border border-gray-300 px-3 py-2 rounded font-bold text-xs cursor-pointer"
            title="Reload saved specifications"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Reload
          </button>
        </div>

        {partName && (
          <p className="text-xs font-semibold text-gray-600">
            {loadingSpecs
              ? "Loading..."
              : hasMaster
              ? "Saved specifications loaded. Editing and saving will update what shift incharges see for this part."
              : "No specifications configured for this part yet. Fill in the rows below and save."}
          </p>
        )}

        {masters.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[11px] font-bold uppercase text-gray-600">Configured parts:</span>
            {masters.map((m) => (
              <button
                key={m.partName}
                type="button"
                onClick={() => handlePartChange(m.partName)}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-full border transition-colors cursor-pointer ${
                  m.partName === partName
                    ? "bg-orange-500 text-white border-orange-500"
                    : "bg-white text-gray-700 border-gray-300 hover:border-orange-400"
                }`}
                title={`${m.controlCount} controls`}
              >
                {m.partName} ({m.controlCount})
              </button>
            ))}
          </div>
        )}
      </div>

      {partName && !loadingSpecs && (
        <>
          <div className="bg-orange-50 border border-orange-200 p-2.5 rounded flex flex-wrap items-center gap-1.5 text-xs shadow-inner">
            <span className="font-bold text-gray-800 mr-2 uppercase text-[11px]">
              Insert Symbol to Control / Specification:
            </span>
            {SPECIAL_CHARS.map((char) => (
              <button
                key={char}
                type="button"
                onMouseDown={(e) => insertSymbol(e, char)}
                className="bg-white hover:bg-orange-500 hover:text-white border border-gray-300 rounded px-2.5 py-1 font-bold text-gray-800 shadow-sm transition-all"
              >
                {char}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto max-h-[600px] border-2 border-gray-800 rounded">
            <table className="w-full text-xs border-collapse text-center min-w-[700px]">
              <thead className="bg-gray-100 font-bold sticky top-0 z-10">
                <tr>
                  <th className="border border-gray-400 p-2 w-[8%]">Sl.No</th>
                  <th className="border border-gray-400 p-2 w-[42%]">Control</th>
                  <th className="border border-gray-400 p-2 w-[42%]">Control Specification (Refer W.I)</th>
                  <th className="border border-gray-400 p-2 w-[8%]">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr key={`spec-${idx}`} className="bg-white">
                    <td className="border border-gray-400 p-1 font-bold">{idx + 1}</td>
                    <td className="border border-gray-400 p-1">
                      <input
                        type="text"
                        className="w-full p-1 font-semibold uppercase outline-none"
                        value={r.controlName}
                        placeholder="e.g. BORE DIAMETER"
                        onFocus={(e) => {
                          activeRef.current = { idx, field: "controlName", element: e.target };
                        }}
                        onChange={(e) => updateRow(idx, "controlName", e.target.value)}
                      />
                    </td>
                    <td className="border border-gray-400 p-1">
                      <input
                        type="text"
                        className="w-full p-1 font-semibold outline-none text-gray-900"
                        value={r.specification}
                        placeholder="e.g. Ø77 +0.030 / +0.076"
                        onFocus={(e) => {
                          activeRef.current = { idx, field: "specification", element: e.target };
                        }}
                        onChange={(e) => updateRow(idx, "specification", e.target.value)}
                      />
                    </td>
                    <td className="border border-gray-400 p-1">
                      <button
                        type="button"
                        onClick={() => setRows((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-red-600 hover:text-red-800 font-bold cursor-pointer"
                        title="Delete row"
                      >
                        <Trash2 className="w-4 h-4 mx-auto" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center">
            <button
              type="button"
              onClick={() => setRows((prev) => [...prev, emptyRow()])}
              className="flex items-center gap-1 bg-gray-800 hover:bg-gray-900 text-white px-3 py-1.5 rounded font-bold text-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add Row
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white px-8 py-2.5 rounded font-bold shadow-lg uppercase tracking-wider text-xs cursor-pointer"
            >
              <Save className="w-4 h-4" /> {isSaving ? "Saving..." : "Save Specifications"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}