import React, { useState, useEffect } from 'react';

const EditPartMapping = ({ shopId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [lines, setLines] = useState([]);
  const [partSets, setPartSets] = useState([]);
  const [selectedLine, setSelectedLine] = useState('');
  const [selectedPartSet, setSelectedPartSet] = useState('');
  const [quantities, setQuantities] = useState({ shift1: 0, shift2: 0, shift3: 0 });
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (isOpen && shopId) {
      const token = localStorage.getItem("token");
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };

      // Fetch Lines (Now includes quantities)
      fetch(`${process.env.REACT_APP_API_URL}/api/mappings/${shopId}/lines`, { headers })
        .then(res => res.json())
        .then(data => Array.isArray(data) ? setLines(data) : setLines([]))
        .catch(err => console.error("Error fetching lines:", err));

      // Fetch Part Sets
      fetch(`${process.env.REACT_APP_API_URL}/api/mappings/${shopId}/part-sets`, { headers })
        .then(res => res.json())
        .then(data => Array.isArray(data) ? setPartSets(data) : setPartSets([]))
        .catch(err => console.error("Error fetching part sets:", err));
    }
  }, [isOpen, shopId]);

  const handleLineSelect = (e) => {
    const lineVal = e.target.value;
    setSelectedLine(lineVal);
    
    // Auto-select existing part set and shift quantities if mapping already exists
    const line = lines.find(l => l.lineCode === lineVal);
    if (line) {
      setSelectedPartSet(line.partSet || '');
      setQuantities({
        shift1: line.shift1Quantity || 0,
        shift2: line.shift2Quantity || 0,
        shift3: line.shift3Quantity || 0
      });
    } else {
      setSelectedPartSet('');
      setQuantities({ shift1: 0, shift2: 0, shift3: 0 });
    }
    setMessage('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token");
      
      // Find the corresponding partId (idSet) for the selected partSet (partName)
      const selectedPartData = partSets.find(p => p.partName === selectedPartSet);
      const idSetToSave = selectedPartData ? selectedPartData.partId : null;

      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/mappings/${shopId}/mapping`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          lineCode: selectedLine,
          partSet: selectedPartSet,
          idSet: idSetToSave,
          shift1Quantity: quantities.shift1,
          shift2Quantity: quantities.shift2,
          shift3Quantity: quantities.shift3
        })
      });

      const data = await response.json();
      if (response.ok) {
        setMessage('Mapping and quantities updated successfully!');
        
        // Update local state to reflect changes instantly
        setLines(lines.map(l => l.lineCode === selectedLine ? { 
          ...l, 
          partSet: selectedPartSet, 
          idSet: idSetToSave,
          shift1Quantity: quantities.shift1,
          shift2Quantity: quantities.shift2,
          shift3Quantity: quantities.shift3 
        } : l));
      } else {
        setMessage(data.message || 'Failed to update mapping.');
      }
    } catch (error) {
      console.error(error);
      setMessage('An error occurred while saving.');
    }
  };

  return (
    <div className="mt-8 bg-[#383838] p-6 rounded-2xl shadow-lg border border-[#4a4a4a] max-w-2xl mx-auto">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl transition-colors duration-300"
      >
        {isOpen ? "Close Editor" : "Edit Part Mapping & Quantity"}
      </button>

      {isOpen && (
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
          {/* 1. Line Code Selection */}
          <div>
            <label className="text-gray-300 mb-2 block font-medium">Select Line Code</label>
            <select 
              className="w-full p-3 bg-[#2d2d2d] text-white border border-[#4a4a4a] rounded-lg focus:outline-none focus:border-blue-500"
              value={selectedLine}
              onChange={handleLineSelect}
              required
            >
              <option value="" disabled>-- Select a Line --</option>
              {lines.map(line => (
                <option key={line.id} value={line.lineCode}>
                  {line.lineCode} {line.partSet ? ' (Mapped)' : ' (Unmapped)'}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Part Set Selection */}
          {selectedLine && (
            <div>
              <label className="text-gray-300 mb-2 block font-medium">Select Part Set to Assign</label>
              <select 
                className="w-full p-3 bg-[#2d2d2d] text-white border border-[#4a4a4a] rounded-lg focus:outline-none focus:border-blue-500"
                value={selectedPartSet}
                onChange={(e) => setSelectedPartSet(e.target.value)}
                required
              >
                <option value="" disabled>-- Select a Part Set --</option>
                {partSets.map(partSet => (
                  <option key={partSet.id} value={partSet.partName}>
                    {partSet.partName}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 3. Shift Quantity Inputs */}
          {selectedLine && selectedPartSet && (
            <div className="grid grid-cols-3 gap-4 border-t border-[#4a4a4a] pt-4 mt-2">
              {['shift1', 'shift2', 'shift3'].map((shift, index) => (
                <div key={shift}>
                  <label className="text-gray-300 mb-2 block font-medium text-sm text-center">
                    Shift {index + 1} Qty
                  </label>
                  <input 
                    type="number" 
                    className="w-full p-3 bg-[#2d2d2d] text-white border border-[#4a4a4a] rounded-lg focus:outline-none focus:border-blue-500 text-center"
                    value={quantities[shift]}
                    onChange={(e) => setQuantities({...quantities, [shift]: parseInt(e.target.value) || 0})}
                    min="0"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Save Button */}
          {selectedLine && selectedPartSet && (
            <button 
              type="submit"
              className="mt-2 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-xl transition-colors duration-300"
            >
              Save Configuration
            </button>
          )}
          
          {message && <p className="text-center text-blue-400 mt-2 font-medium">{message}</p>}
        </form>
      )}
    </div>
  );
};

export default EditPartMapping;