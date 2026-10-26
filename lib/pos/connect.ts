/** POS MSSQL холболтын тохиргоо (бүх POS дээр ижил эрхээр холбогдоно). */
import sql from "mssql";

export function posConfig(ip: string): sql.config {
  return {
    server: ip,
    port: Number(process.env.POS_DB_PORT ?? 1433),
    user: process.env.POS_DB_USER ?? "sa",
    password: process.env.POS_DB_PASSWORD ?? "",
    database: process.env.POS_DB_NAME ?? "DCSPS",
    connectionTimeout: 6000,
    requestTimeout: 60000,
    pool: { max: 2, min: 0 },
    options: {
      encrypt: false,
      trustServerCertificate: true,
    },
  };
}

export function connectPos(ip: string): Promise<sql.ConnectionPool> {
  return new sql.ConnectionPool(posConfig(ip)).connect();
}
