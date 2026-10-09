import React, { useState } from "react";
import { X, Layers, PlusCircle } from "lucide-react";
import { toast } from "react-toastify";

const AddPartSetModal = ({ isOpen, onClose, defaultShopId }) => {
  const shopId = defaultShopId || "3";
  const [partId, setPartId] = useState("");
  const [partName, setPartName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!partId.trim() || !partName.trim()) {
      toast.error("Please enter both Part ID and Part Name.");
      return;
    }

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${process.env.REACT_APP_API_URL || ""}/api/part-sets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          shopId,
          partId: partId.trim(),
          partName: partName.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to add part set");
      }

      toast.success(data.message || "Part Set added successfully!");
      setPartId("");
      setPartName("");
      onClose();
    } catch (err) {
      toast.error(err.message || "Error adding part set");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-100 transform transition-all scale-100">
        
        {/* Modal Header */}
        <div className="bg-gray-900 text-white px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <Layers className="w-5 h-5 text-orange-400" />
            <h3 className="font-bold text-lg uppercase tracking-wider leading-tight">
              Add New Part Set
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-red-400 transition-colors cursor-pointer"
          >
            <X size={22} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Part ID Field */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
              Part ID
            </label>
            <input
              type="text"
              placeholder="e.g. 45151M69RF0 / 45111M69RF0"
              value={partId}
              onChange={(e) => setPartId(e.target.value)}
              className="w-full border border-gray-300 p-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono text-sm"
              required
            />
            <p className="text-[11px] text-gray-400 mt-1">
              Supports paired IDs separated by slash ( / ).
            </p>
          </div>

          {/* Part Name Field */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
              Part Name
            </label>
            <textarea
              rows={3}
              placeholder="e.g. YNC ESP KNUCKLE LH U/P / YNC ESP KNUCKLE RH U/P"
              value={partName}
              onChange={(e) => setPartName(e.target.value)}
              className="w-full border border-gray-300 p-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 font-semibold text-sm"
              required
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white px-6 py-2.5 rounded-lg text-sm font-bold shadow-md hover:shadow-lg transition-all cursor-pointer uppercase tracking-wider"
            >
              <PlusCircle className="w-4 h-4" />
              {isSubmitting ? "Adding..." : "Add Part Set"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddPartSetModal;