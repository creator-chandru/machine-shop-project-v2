import React, { createContext, useContext, useState } from "react";

const LineSetContext = createContext(null);

export const LineSetProvider = ({ children }) => {
  const [lineSet, setLineSetState] = useState(null);

  const setLineSet = (data) => {
    setLineSetState({
      machineShop: data.machineShop || "",
      lineCode: data.lineCode || "",
      partName: data.partName || "",
      partNo: data.partNo || "",
      machineNo: data.machineNo || ""
    });
  };

  const clearLineSet = () => {
    setLineSetState(null);
  };

  const isLineSetComplete =
    Boolean(
      lineSet?.machineShop &&
      lineSet?.lineCode &&
      lineSet?.partNo &&
      lineSet?.machineNo
    );

  return (
    <LineSetContext.Provider
      value={{
        lineSet,
        setLineSet,
        clearLineSet,
        isLineSetComplete
      }}
    >
      {children}
    </LineSetContext.Provider>
  );
};

export const useLineSet = () => {
  const context = useContext(LineSetContext);

  if (!context) {
    throw new Error(
      "useLineSet must be used inside LineSetProvider"
    );
  }

  return context;
};