import React, { useState, useEffect } from 'react';

const EditPartMapping = ({ shopId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [lines, setLines] = useState([]);
  const [partSets, setPartSets] = useState([]);
  const [selectedLine, setSelectedLine] = useState('');
  const [selectedPartSet, setSelectedPartSet] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (isOpen && shopId) {
      const token = localStorage.getItem("token");
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };

      // Fetch Lines
      fetch(`http://localhost:5000/api/mappings/${shopId}/lines`, { headers })
        .then(res => res.json())
        .then(data => Array.isArray(data) ? setLines(data) : setLines([]))
        .catch(err => console.error("Error fetching lines:", err));

      // Fetch Part Sets
      fetch(`http://localhost:5000/api/mappings/${shopId}/part-sets`, { headers })
        .then(res => res.json())
        .then(data => Array.isArray(data) ? setPartSets(data) : setPartSets([]))
        .catch(err => console.error("Error fetching part sets:", err));
    }
  }, [isOpen, shopId]);

  const handleLineSelect = (e) => {
    const lineVal = e.target.value;
    setSelectedLine(lineVal);
    
    // Auto-select existing part set if mapping already exists
    const line = lines.find(l => l.lineCode === lineVal);
    if (line && line.partSet) {
      setSelectedPartSet(line.partSet);
    } else {
      setSelectedPartSet('');
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
          idSet: idSetToSave // Send the matching part IDs to the backend
        })
      });

      const data = await response.json();
      if (response.ok) {
        setMessage('Mapping updated successfully!');
        
        setLines(lines.map(l => l.lineCode === selectedLine ? { ...l, partSet: selectedPartSet, idSet: idSetToSave } : l));
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
        {isOpen ? "Close Mapping Editor" : "Edit Part Mapping"}
      </button>

      {isOpen && (
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
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

          {selectedLine && selectedPartSet && (
            <button 
              type="submit"
              className="mt-4 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-xl transition-colors duration-300"
            >
              Save Mapping
            </button>
          )}
          
          {message && <p className="text-center text-blue-400 mt-2 font-medium">{message}</p>}
        </form>
      )}
    </div>
  );
};

export default EditPartMapping;