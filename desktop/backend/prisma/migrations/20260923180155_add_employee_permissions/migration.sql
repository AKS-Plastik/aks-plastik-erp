-- CreateTable
CREATE TABLE "EmployeePermission" (
    "id" SERIAL NOT NULL,
    "employeeId" TEXT NOT NULL,
    "page" TEXT NOT NULL,

    CONSTRAINT "EmployeePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeStatusPermission" (
    "id" SERIAL NOT NULL,
    "employeeId" TEXT NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "EmployeeStatusPermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmployeePermission_employeeId_page_key" ON "EmployeePermission"("employeeId", "page");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeStatusPermission_employeeId_status_key" ON "EmployeeStatusPermission"("employeeId", "status");
