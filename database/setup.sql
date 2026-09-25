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
