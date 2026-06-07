-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "hoursPerDay" REAL NOT NULL DEFAULT 8,
    "minEstimateDays" REAL NOT NULL DEFAULT 0.1,
    "reviewRatio" REAL NOT NULL DEFAULT 0.3,
    "reviewMinDays" REAL NOT NULL DEFAULT 0.1,
    "defaultUtilization" REAL NOT NULL DEFAULT 1.0,
    "updatedAt" DATETIME NOT NULL
);
