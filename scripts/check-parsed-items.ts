import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();

async function main() {
  const logs = await p.nutritionLog.findMany({
    orderBy: { date: 'desc' },
    take: 5,
    select: { id: true, rawInput: true, parsedItems: true, date: true },
  });
  for (const l of logs) {
    console.log('---');
    console.log('date       :', l.date.toISOString());
    console.log('rawInput   :', l.rawInput);
    console.log('parsedItems:', l.parsedItems ? l.parsedItems.substring(0, 200) : 'NULL');
  }
  await p.$disconnect();
}

main();
