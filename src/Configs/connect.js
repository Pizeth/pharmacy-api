// const mysql = require ('mysql');

// const dbConfig = mysql.createConnection({
//   host: process.env.DB_HOST,
//   user: process.env.DB_USER,
//   password: process.env.DB_PASSWORD,
//   database: process.env.DB_DATABASE
// });

// dbConfig.connect(e => {
//   if (e) throw e;
// });

// module.exports = dbConfig;

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Prisma connection management
const main = async () => {
  try {
    // Your initialization code here if needed
    console.log("Prisma connected successfully");
  } catch (error) {
    console.error("Prisma connection error:", error);
    throw error;
  }
};

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

export default prisma;
