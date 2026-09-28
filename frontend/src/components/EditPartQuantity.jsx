import React, { useState, useEffect } from 'react';

const EditPartQuantity = ({ shopId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [parts, setParts] = useState([]);
  const [selectedPartId, setSelectedPartId] = useState('');
  const [quantities, setQuantities] = useState({ shift1: 0, shift2: 0, shift3: 0 });
  const [message, setMessage] = useState('');

// Fetch parts when the edit pane is opened
  useEffect(() => {
    if (isOpen && shopId) {
      // Get the token directly from local storage
      const token = localStorage.getItem("token");

      fetch(`${process.env.REACT_APP_API_URL}/api/parts/${shopId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` // Send the token in the header
        }
      })
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.message || 'Failed to fetch parts');
          }
          return data;
        })
        .then(data => {
          if (Array.isArray(data)) {
            setParts(data);
          } else {
            console.error("API did not return an array:", data);
            setParts([]); 
          }
        })
        .catch(err => {
          console.error("Error fetching parts:", err);
          setParts([]); 
          setMessage(err.message || "Failed to load parts from database.");
        });
    }
  }, [isOpen, shopId]);

  const handlePartSelect = (e) => {
    const pId = e.target.value;
    setSelectedPartId(pId);
    
    // Auto-fill existing quantities when a part is selected
    const part = parts.find(p => p.partId === pId);
    if (part) {
      setQuantities({
        shift1: part.shift1Quantity,
        shift2: part.shift2Quantity,
        shift3: part.shift3Quantity
      });
    }
    setMessage('');
  };

const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Get the token directly from local storage for the PUT request
      const token = localStorage.getItem("token");

      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/parts/${shopId}/${selectedPartId}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` // Send the token in the header
        },
        body: JSON.stringify({
          shift1Quantity: quantities.shift1,
          shift2Quantity: quantities.shift2,
          shift3Quantity: quantities.shift3
        })
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('Quantities updated successfully!');
      } else {
        setMessage(data.message || 'Failed to update quantities.');
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
        className="w-full bg-[#ff9100] hover:bg-[#e68200] text-white font-bold py-3 px-6 rounded-xl transition-colors duration-300"
      >
        {isOpen ? "Close Editor" : "Edit Part Quantity"}
      </button>

      {isOpen && (
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <div>
            <label className="text-gray-300 mb-2 block font-medium">Select Part</label>
            <select 
              className="w-full p-3 bg-[#2d2d2d] text-white border border-[#4a4a4a] rounded-lg focus:outline-none focus:border-[#ff9100]"
              value={selectedPartId}
              onChange={handlePartSelect}
              required
            >
              <option value="" disabled>-- Select a Part --</option>
              {Array.isArray(parts) && parts.map(part => (
                <option key={part.id} value={part.partId}>
                  {part.partName} ({part.partId})
                </option>
              ))}
            </select>
          </div>

          {selectedPartId && (
            <div className="grid grid-cols-3 gap-4 mt-2">
              {['shift1', 'shift2', 'shift3'].map((shift, index) => (
                <div key={shift}>
                  <label className="text-gray-300 mb-2 block font-medium text-sm">Shift {index + 1} Qty</label>
                  <input 
                    type="number" 
                    className="w-full p-3 bg-[#2d2d2d] text-white border border-[#4a4a4a] rounded-lg focus:outline-none focus:border-[#ff9100]"
                    value={quantities[shift]}
                    onChange={(e) => setQuantities({...quantities, [shift]: parseInt(e.target.value) || 0})}
                    min="0"
                  />
                </div>
              ))}
            </div>
          )}

          {selectedPartId && (
            <button 
              type="submit"
              className="mt-4 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-xl transition-colors duration-300"
            >
              Save Changes
            </button>
          )}
          
          {message && <p className="text-center text-[#ff9100] mt-2 font-medium">{message}</p>}
        </form>
      )}
    </div>
  );
};

export default EditPartQuantity;