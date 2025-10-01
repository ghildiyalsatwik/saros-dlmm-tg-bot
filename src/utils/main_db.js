import dotenv from "dotenv";
dotenv.config();
import pkg from "pg";

const { Pool } = pkg;

export const pool = new Pool({connectionString: process.env.MAIN_DB_URL});