import dotenv from "dotenv";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });
const globalForPrisma = globalThis;
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"] });
if (process.env.NODE_ENV !== "production")
    globalForPrisma.prisma = prisma;
