const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const items = await prisma.orderItem.findMany({
    where: { productName: { contains: 'JUMBO 300' } },
    include: { order: true, productionTasks: true }
  })
  
  for (const item of items) {
    console.log(`\nOrder: ${item.order.code}`)
    console.log(`Product: ${item.productName}`)
    console.log(`Total Qty: ${item.quantity}`)
    console.log(`In Prod Qty: ${item.inProductionQuantity}`)
    console.log(`Produced Qty: ${item.producedQuantity}`)
    console.log('Tasks:')
    for (const t of item.productionTasks) {
      console.log(`  - ${t.status} | qty: ${t.quantity} | date: ${t.date} | createdAt: ${t.createdAt.toISOString()}`)
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
