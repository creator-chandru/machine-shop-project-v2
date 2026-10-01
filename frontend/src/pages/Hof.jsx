import React from 'react';
import { useParams } from 'react-router-dom';
import Header from '../components/Header';
import EditPartMapping from '../components/EditPartMapping';

const Hof = () => {
  const { shopId } = useParams();

  return (
    <div className="min-h-screen w-full bg-[#2d2d2d] font-sans">
      <Header />
      <div className="p-8">
        <h1 className="text-3xl font-black text-white tracking-widest uppercase text-center mb-2">
          HOF Dashboard
        </h1>
        <p className="text-gray-400 text-center mb-8">Managing Machine Shop - {shopId}</p>
        {/* New Part Mapping Component */}
        <EditPartMapping shopId={shopId} />
      </div>
    </div>
  );
};

export default Hof;
