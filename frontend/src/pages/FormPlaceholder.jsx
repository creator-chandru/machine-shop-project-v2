import { useParams } from "react-router-dom";

import PreOperationChecklist from "./preOperationChecklist";
import ErrorProofingCheckSheet from "./ErrorProofingCheckSheet";
import AirGapSensorCheckSheet from "./AirGapSensorCheckSheet";
import FourMChangeMonitoringCheckSheet from "./FourMChangeMonitoringCheckSheet";
import ToolChangeRecord from "./ToolsChangeRecord";
import RecordOfSignificantEvent from "./RecordOfSignificantEvent";

import DailyProductionReport from "./daily_Production_report";
import DailyProductionIdleTimeReport from "./daily_production_idle_time_report";
import BreakdownIntimationServiceReport from "./breakdown_intimation_service_report";

/**
 * Central map for operator forms
 *
 * Add new forms here ONLY.
 */
const formMap = {
  "pre-operation-checklist": <PreOperationChecklist />,

  "error-proofing-checksheet": <ErrorProofingCheckSheet />,

  "air-gap-sensor": <AirGapSensorCheckSheet />,

  "four-m-change-monitoring": <FourMChangeMonitoringCheckSheet />,

  "tool-change-record": <ToolChangeRecord />,

  "significant-event-record": <RecordOfSignificantEvent />,

  "daily-production-report": <DailyProductionReport />,

  "daily-production-idle-time-report": (
    <DailyProductionIdleTimeReport />
  ),

  "breakdown-intimation-service-report": (
     <BreakdownIntimationServiceReport />
   ),

  // Future forms:
  // "some-form": <SomeForm />,
};

const FormPlaceholder = () => {
  const { formName } = useParams();

  // If real form exists → render it
  if (formMap[formName]) {
    return formMap[formName];
  }

  // Otherwise → show placeholder
  return (
    <div className="min-h-screen bg-[#2d2d2d] flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-2xl p-10 text-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">
          {formName.replace(/-/g, " ").toUpperCase()}
        </h1>

        <p className="text-gray-500">
          Form will be implemented here
        </p>
      </div>
    </div>
  );
};

export default FormPlaceholder;