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
                ]}
              >
                <MachineShopDashboard />
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

          {/* Operator dashboard for a specific machine shop */}
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
                ]}
              >
                <Operator />
              </ProtectedRoute>
            }
          />

          {/* All operator forms are handled centrally by FormPlaceholder */}
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
                ]}
              >
                <FormPlaceholder />
              </ProtectedRoute>
            }
          />

          {/* Added /:shopId to Hod */}
          <Route
            path="/hod/:shopId"
            element={
              <ProtectedRoute allowedRoles={["hod"]}>
                <Hod />
              </ProtectedRoute>
            }
          />

          {/* Added /:shopId to Hof */}
          <Route
            path="/hof/:shopId"
            element={
              <ProtectedRoute allowedRoles={["hof"]}>
                <Hof />
              </ProtectedRoute>
            }
          />

          {/* Added /:shopId to Product Engineer */}
          <Route
            path="/product-engineer/:shopId"
            element={
              <ProtectedRoute allowedRoles={["productengineer"]}>
                <ProductEngineer />
              </ProtectedRoute>
            }
          />

          {/* Added /:shopId to GM */}
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