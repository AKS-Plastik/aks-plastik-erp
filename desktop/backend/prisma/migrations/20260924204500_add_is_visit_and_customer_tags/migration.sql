-- AlterTable
ALTER TABLE "SiteVisit" ADD COLUMN "isVisit" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "CustomerTag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#e2e8f0',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_CustomerToCustomerTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerTag_name_key" ON "CustomerTag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "_CustomerToCustomerTag_AB_unique" ON "_CustomerToCustomerTag"("A", "B");

-- CreateIndex
CREATE INDEX "_CustomerToCustomerTag_B_index" ON "_CustomerToCustomerTag"("B");

-- AddForeignKey
ALTER TABLE "_CustomerToCustomerTag" ADD CONSTRAINT "_CustomerToCustomerTag_A_fkey" FOREIGN KEY ("A") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CustomerToCustomerTag" ADD CONSTRAINT "_CustomerToCustomerTag_B_fkey" FOREIGN KEY ("B") REFERENCES "CustomerTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
