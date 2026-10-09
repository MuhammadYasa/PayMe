import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "@/server/env";

const penampung = globalThis as unknown as { __paymePrisma?: PrismaClient };

/** Satu klien per proses, juga saat hot reload di mode pengembangan. */
export function prisma(): PrismaClient {
  if (!penampung.__paymePrisma) {
    const url = new URL(env().DATABASE_URL);
    // Parameter `schema` milik Prisma, bukan milik driver pg, jadi dipisahkan dari connection string.
    const skema = url.searchParams.get("schema") ?? "public";
    url.searchParams.delete("schema");
    const adapter = new PrismaPg({ connectionString: url.toString() }, { schema: skema });
    penampung.__paymePrisma = new PrismaClient({ adapter });
  }
  return penampung.__paymePrisma;
}
