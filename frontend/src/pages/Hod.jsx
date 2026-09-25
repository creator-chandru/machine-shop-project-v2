<<<<<<< HEAD
import React from 'react';
import { useParams } from 'react-router-dom';
import EditPartQuantity from '../components/EditPartQuantity';
import Header from '../components/Header'; // Assuming you have this

const Hod = () => {
  const { shopId } = useParams();

  return (
    <div className="min-h-screen w-full bg-[#2d2d2d] font-sans">
      <Header />
      <div className="p-8">
        <h1 className="text-3xl font-black text-white tracking-widest uppercase text-center mb-2">
          HOD Dashboard
        </h1>
        <p className="text-gray-400 text-center mb-8">Managing Machine Shop - {shopId}</p>
        
        <EditPartQuantity shopId={shopId} />
      </div>
    </div>
  );
};

export default Hod;
=======
import React from 'react'
import Header from '../components/Header'

const Hod = () => {
  return (
    <div>
      <Header />
      Hod
    </div>
  )
}

export default Hod
>>>>>>> 00054a1db1bee717831f2aadc65f623953930f50
