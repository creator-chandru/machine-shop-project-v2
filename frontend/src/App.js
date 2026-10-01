import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LineSetProvider } from "./context/LineSetContext.jsx";

import Login from "./pages/Login";
import ShiftIncharge from "./pages/ShiftIncharge";
import Operator from "./pages/Operator";
import Hod from "./pages/Hod";
import Hof from "./pages/Hof";
import ProtectedRoute from "./components/ProtectedRoutes";
import ProductEngineer from "./pages/ProductEngineer";
import GM from "./pages/GM";
import MachineShopDashboard from "./pages/MachineShopDashboard";
import FormPlaceholder from "./pages/FormPlaceholder";
import QC from "./pages/qc"; // <-- Import QC

function App() {
  return (
    <BrowserRouter>
      <LineSetProvider>
        <Routes>
          <Route path="/" element={<Login />} />

          {/* Machine shop selection screen */}
          <Route
            path="/machine-shops"
            element={
              <ProtectedRoute
                allowedRoles={[
                  "operator",
                  "shiftincharge",
                  "hod",
                  "hof",
                  "productengineer",
                  "gm",
                  "admin",
                  "qc",
                  "QC",
                  "qualitycontroller"
                ]}
              >
                <MachineShopDashboard />
              </ProtectedRoute>
            }
          />

          {/* QC Route */}
          <Route
            path="/qc/:shopId"
            element={
              <ProtectedRoute allowedRoles={["qc", "QC", "qualitycontroller"]}>
                <QC />
              </ProtectedRoute>
            }
          />

          {/* QC Forms Route */}
          <Route
            path="/qc/:shopId/:formName"
            element={
              <ProtectedRoute allowedRoles={["qc", "QC", "qualitycontroller"]}>
                <FormPlaceholder />
              </ProtectedRoute>
            }
          />

          {/* Shift Incharge Route */}
          <Route
            path="/shift-incharge/:shopId"
            element={
              <ProtectedRoute allowedRoles={["shiftincharge"]}>
                <ShiftIncharge />
              </ProtectedRoute>
            }
          />

          {/* Shift Incharge Forms Route */}
          <Route
            path="/shift-incharge/:shopId/:formName"
            element={
              <ProtectedRoute allowedRoles={["shiftincharge"]}>
                <FormPlaceholder />
              </ProtectedRoute>
            }
          />

          {/* Operator dashboard */}
          <Route
            path="/operator/:shopId"
            element={
              <ProtectedRoute
                allowedRoles={[
                  "operator",
                  "shiftincharge",
                  "hod",
                  "hof",
                  "productengineer",
                  "gm",
                  "admin",
                  "qc",
                  "QC"
                ]}
              >
                <Operator />
              </ProtectedRoute>
            }
          />

          <Route
            path="/operator/:shopId/:formName"
            element={
              <ProtectedRoute
                allowedRoles={[
                  "operator",
                  "shiftincharge",
                  "hod",
                  "hof",
                  "productengineer",
                  "gm",
                  "admin",
                  "qc",
                  "QC"
                ]}
              >
                <FormPlaceholder />
              </ProtectedRoute>
            }
          />

          <Route
            path="/hod/:shopId"
            element={
              <ProtectedRoute allowedRoles={["hod"]}>
                <Hod />
              </ProtectedRoute>
            }
          />

          <Route
            path="/hof/:shopId"
            element={
              <ProtectedRoute allowedRoles={["hof"]}>
                <Hof />
              </ProtectedRoute>
            }
          />

          <Route
            path="/product-engineer/:shopId"
            element={
              <ProtectedRoute allowedRoles={["productengineer"]}>
                <ProductEngineer />
              </ProtectedRoute>
            }
          />

          <Route
            path="/gm/:shopId"
            element={
              <ProtectedRoute allowedRoles={["gm"]}>
                <GM />
              </ProtectedRoute>
            }
          />

          <Route
            path="/unauthorized"
            element={<h1>Unauthorized Access</h1>}
          />

          <Route path="*" element={<Login />} />
        </Routes>
      </LineSetProvider>
    </BrowserRouter>
  );
}

export default App;