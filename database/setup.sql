CREATE DATABASE MachineShop;

GO

USE MachineShop;

GO


-- ============================================
-- MachineShopUsers
-- ============================================

CREATE TABLE MachineShopUsers (

    id INT IDENTITY(1,1) PRIMARY KEY,

    username VARCHAR(50),

    password VARCHAR(255),

    role VARCHAR(30),

    employeeId VARCHAR(50)

);

GO


-- ============================================
-- MachineShop3Details
-- ============================================
-- Stores Machine Shop 3 line / part / machine
-- master data imported manually from Excel.
-- ============================================

CREATE TABLE MachineShop3Details (

    id INT IDENTITY(1,1) PRIMARY KEY,

    lineCode NVARCHAR(50) NOT NULL,

    partName NVARCHAR(200),

    partNo NVARCHAR(100),

    machineNo NVARCHAR(50) NOT NULL,

    machineType NVARCHAR(100),

    createdAt DATETIME DEFAULT GETDATE()

);

GO


CREATE INDEX IX_MachineShop3Details_LineCode
ON MachineShop3Details(lineCode);

GO


CREATE INDEX IX_MachineShop3Details_LinePart
ON MachineShop3Details(lineCode, partName, partNo);

GO


-- ============================================
-- PreOperationChecklist
-- ============================================

USE MachineShop;
GO

DROP TABLE IF EXISTS PreOperationChecklist;
GO

CREATE TABLE PreOperationChecklist (
    id INT IDENTITY(1,1) PRIMARY KEY,

    machineShop INT NOT NULL,
    lineCode NVARCHAR(50) NOT NULL,
    partName NVARCHAR(200),
    partNo NVARCHAR(100),
    month NVARCHAR(20),
    machineNo NVARCHAR(50),
    opNo NVARCHAR(50),
    checklistDate DATE NOT NULL,

    slNo INT NOT NULL,
    specification NVARCHAR(200),
    subRow NVARCHAR(10),
    value NVARCHAR(100),

    operatorSignature NVARCHAR(100),
    shiftInchargeSignature NVARCHAR(100),

    createdAt DATETIME DEFAULT GETDATE(),

    CONSTRAINT CK_PreOperationChecklist_MachineShop
        CHECK (machineShop IN (1, 2, 3, 4, 5))
);
GO


-- ============================================
-- ErrorProofingCheckSheet
-- ============================================

USE MachineShop;
GO

DROP TABLE IF EXISTS ErrorProofingCheckSheet;
GO

CREATE TABLE ErrorProofingCheckSheet (

    id INT IDENTITY(1,1) PRIMARY KEY,

    -- Machine / line information
    machineShop INT NOT NULL,
    lineCode NVARCHAR(100) NOT NULL,

    -- Form header information
    partName NVARCHAR(100),
    partNo NVARCHAR(100),
    checkDate DATE NOT NULL,
    shift NVARCHAR(20),
    machineNo NVARCHAR(100),

    -- Error-proofing checklist data
    slNo INT NOT NULL,
    errorProofNo NVARCHAR(100),
    errorProofName NVARCHAR(255),
    value NVARCHAR(255),

    -- Signatures
    operatorSignature NVARCHAR(100),
    shiftInchargeSignature NVARCHAR(100),

    -- Record information
    createdAt DATETIME DEFAULT GETDATE(),

    CONSTRAINT CK_ErrorProofingCheckSheet_MachineShop
        CHECK (machineShop IN (1, 2, 3, 4, 5))
);
GO

-- ============================================
-- AirGapSensorCheckSheet
-- ============================================


USE MachineShop;
GO

DROP TABLE IF EXISTS AirGapSensorCheckSheet;
GO

CREATE TABLE AirGapSensorCheckSheet (
    id INT IDENTITY(1,1) PRIMARY KEY,

    machineShop INT NOT NULL,
    lineCode NVARCHAR(50) NOT NULL,

    partName NVARCHAR(200),
    partNo NVARCHAR(100),

    checkDate DATE NOT NULL,
    machineNo NVARCHAR(50),
    errorProofNo NVARCHAR(100),

    parameter NVARCHAR(255),
    expectedStatus NVARCHAR(255),

    shift NVARCHAR(10),
    status NVARCHAR(10),

    lineInchargeSignature NVARCHAR(255),
    productionSignature NVARCHAR(255),

    createdAt DATETIME DEFAULT GETDATE(),

    CONSTRAINT CK_AirGapSensorCheckSheet_MachineShop
        CHECK (machineShop IN (1, 2, 3, 4, 5))
);
GO

-- ============================================
-- ToolChangeRecord
-- ============================================

USE MachineShop;
GO

DROP TABLE IF EXISTS ToolChangeRecord;
GO

CREATE TABLE ToolChangeRecord (

    id INT IDENTITY(1,1) PRIMARY KEY,

    -- Machine / line information
    machineShop INT NOT NULL,
    lineCode NVARCHAR(100) NOT NULL,

    -- Form header information
    partName NVARCHAR(100),

    -- Tool change section information
    toolDescription NVARCHAR(255),
    machineNo NVARCHAR(100),
    opNo NVARCHAR(100),
    checkDate DATE NOT NULL,
    shift NVARCHAR(20),
    fromTime TIME,
    toTime TIME,

    -- Tool change checklist data
    slNo INT NOT NULL,
    controlSpec NVARCHAR(255),
    beforeValue NVARCHAR(255),
    afterValue NVARCHAR(255),

    -- Tool Changed By
    toolChangedBySignature NVARCHAR(100),

    -- Verified By QC
    verifiedByQcSignature NVARCHAR(100),

    -- Record information
    createdAt DATETIME DEFAULT GETDATE(),

    CONSTRAINT CK_ToolChangeRecord_MachineShop
        CHECK (machineShop IN (1, 2, 3, 4, 5))
);
GO


-- ============================================
-- FourMChangeMonitoring
-- ============================================

USE MachineShop;
GO

DROP TABLE IF EXISTS FourMChangeMonitoring;
GO

CREATE TABLE FourMChangeMonitoring (
    id INT IDENTITY(1,1) PRIMARY KEY,

    machineShop INT NOT NULL,
    lineCode NVARCHAR(100) NOT NULL,

    partName NVARCHAR(200),
    slNo INT,
    dateShift NVARCHAR(100),
    mcNo NVARCHAR(100),
    typeOf4M NVARCHAR(100),
    description NVARCHAR(MAX),
    firstPart NVARCHAR(100),
    lastPart NVARCHAR(100),
    inspectionFrequency NVARCHAR(100),
    retroChecking NVARCHAR(100),
    quarantine NVARCHAR(100),
    partIdentification NVARCHAR(100),
    internalCommunication NVARCHAR(MAX),

    inchargeSign NVARCHAR(100),
    hodSign NVARCHAR(200),

    createdAt DATETIME DEFAULT GETDATE(),

    CONSTRAINT CK_FourMChangeMonitoring_MachineShop
        CHECK (machineShop IN (1, 2, 3, 4, 5))
);
GO


-- ============================================
-- SignificantEventRecord
-- ============================================

USE MachineShop;
GO

DROP TABLE IF EXISTS SignificantEventRecord;
GO

CREATE TABLE SignificantEventRecord (
    id INT IDENTITY(1,1) PRIMARY KEY,

    machineShop INT NOT NULL,
    lineCode NVARCHAR(100) NOT NULL,

    -- Header Info
    month NVARCHAR(50),
    partName NVARCHAR(200),
    event NVARCHAR(MAX),
    mcNo NVARCHAR(100),
    opNo NVARCHAR(100),
    recordDate DATE,
    shift NVARCHAR(20),
    fromTime NVARCHAR(50),
    toTime NVARCHAR(50),

    -- Dynamic Measurement Row
    rowIdx INT,
    controlSpec NVARCHAR(255),
    inspectionGauge NVARCHAR(255),

    beforePart1 NVARCHAR(100),
    beforePart2 NVARCHAR(100),
    beforePart3 NVARCHAR(100),

    afterPart1 NVARCHAR(100),
    afterPart2 NVARCHAR(100),
    afterPart3 NVARCHAR(100),

    -- Traceability Info
    castingBeforePart1 NVARCHAR(100),
    castingBeforePart2 NVARCHAR(100),
    castingBeforePart3 NVARCHAR(100),

    castingAfterPart1 NVARCHAR(100),
    castingAfterPart2 NVARCHAR(100),
    castingAfterPart3 NVARCHAR(100),

    machiningBeforePart1 NVARCHAR(100),
    machiningBeforePart2 NVARCHAR(100),
    machiningBeforePart3 NVARCHAR(100),

    machiningAfterPart1 NVARCHAR(100),
    machiningAfterPart2 NVARCHAR(100),
    machiningAfterPart3 NVARCHAR(100),

    -- Signatures
    prodnIncharge NVARCHAR(100),
    qcIncharge NVARCHAR(100),
    prodnHofSign NVARCHAR(100),

    createdAt DATETIME DEFAULT GETDATE(),

    CONSTRAINT CK_SignificantEventRecord_MachineShop
        CHECK (machineShop IN (1, 2, 3, 4, 5))
);
GO


-- ============================================
-- BreakdownIntimationReport
-- ============================================

USE MachineShop;
GO

DROP TABLE IF EXISTS BreakdownIntimationReport;
GO

CREATE TABLE BreakdownIntimationReport (
    id INT IDENTITY(1,1) PRIMARY KEY,

    machineShop INT NOT NULL,
    lineCode NVARCHAR(100) NOT NULL,

    -- Header & Plant Details
    slNo NVARCHAR(100),
    onlineDocNo NVARCHAR(100),
    plantName NVARCHAR(100),
    machineNo NVARCHAR(100),
    reportDate DATE,
    shift NVARCHAR(20),
    reportTime NVARCHAR(50),

    categoryMechanical BIT DEFAULT 0,
    categoryElectrical BIT DEFAULT 0,

    -- Nature of Failure
    failureDescription NVARCHAR(MAX),
    inchargeName NVARCHAR(100),
    inchargeSignature NVARCHAR(200),

    -- Maintenance Received
    maintReceivedTime NVARCHAR(50),
    maintReceivedName NVARCHAR(100),
    maintReceivedSignature NVARCHAR(200),

    -- Observation
    observationStartTime NVARCHAR(50),
    observationDescription NVARCHAR(MAX),

    -- Corrective Action
    correctiveActionType NVARCHAR(50),
    correctiveActionDescription NVARCHAR(MAX),

    -- Work Completed
    workCompletedDate DATE,
    workCompletedTime NVARCHAR(50),
    workCompletedName NVARCHAR(100),
    workCompletedSignature NVARCHAR(200),

    -- Machine Performance Report
    performanceReportDate DATE,
    performanceReportTime NVARCHAR(50),
    performanceReportName NVARCHAR(100),
    performanceReportSignature NVARCHAR(200),

    -- Time Loss Details, Workers & Spares
    timeLossDetailsOt NVARCHAR(MAX),
    timeLossData NVARCHAR(MAX),
    workersData NVARCHAR(MAX),
    sparesData NVARCHAR(MAX),

    createdAt DATETIME DEFAULT GETDATE(),

    CONSTRAINT CK_BreakdownIntimationReport_MachineShop
        CHECK (machineShop IN (1, 2, 3, 4, 5))
);
GO
USE MachineShop;
GO

-- ============================================
-- CorrectiveActionRegister
-- ============================================
USE MachineShop;
GO

DROP TABLE IF EXISTS CorrectiveActionRegister;
GO

CREATE TABLE CorrectiveActionRegister
(
    id INT IDENTITY(1,1) PRIMARY KEY,

    -- Machine / Shop / Header Information
    machineShop INT NOT NULL,
    lineCode NVARCHAR(100) NOT NULL,
    machineNo NVARCHAR(50) NULL,
    recordDate DATE NOT NULL,

    -- Entry Row Data (Matching QF/08/MRO-04 PDF Columns)
    partName NVARCHAR(200) NOT NULL,
    problemDescription NVARCHAR(MAX) NOT NULL,
    problemCategory NVARCHAR(10) NOT NULL, -- Category: 'A', 'B', 'C', 'D', 'E'
    quantity INT NOT NULL DEFAULT 1,
    rootCause NVARCHAR(MAX) NOT NULL,
    correctiveAction NVARCHAR(MAX) NOT NULL,
    result NVARCHAR(50) NOT NULL DEFAULT 'OK', -- 'OK', 'NOT OK'
    operatorSignature NVARCHAR(100) NOT NULL,
    shiftInchargeSignature NVARCHAR(100) NULL,

    -- Timestamps
    createdAt DATETIME DEFAULT GETDATE(),
    updatedAt DATETIME NULL,

    -- Constraints
    CONSTRAINT CK_CorrectiveActionRegister_MachineShop
        CHECK (machineShop IN (1, 2, 3, 4, 5)),

    CONSTRAINT CK_CorrectiveActionRegister_Category
        CHECK (problemCategory IN ('A', 'B', 'C', 'D', 'E')),

    CONSTRAINT CK_CorrectiveActionRegister_Quantity
        CHECK (quantity > 0)
);
GO

-- Index Optimization
CREATE INDEX IX_CorrectiveActionRegister_LineCode
ON CorrectiveActionRegister(lineCode);
GO

CREATE INDEX IX_CorrectiveActionRegister_Date
ON CorrectiveActionRegister(recordDate);
GO

CREATE INDEX IX_CorrectiveActionRegister_LineDate
ON CorrectiveActionRegister(lineCode, recordDate);
GO