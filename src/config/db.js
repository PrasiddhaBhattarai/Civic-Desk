import { Pool } from "pg";
import fsp from "fs/promises";
import path from "path";
import {config} from "dotenv";
config();

if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not defined in your environment variables");
}

// create new pool of connection
const pool = new Pool({
    connectionString : process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30000
});

//to test connection
async function testConnection() {
  try {
    const client = await pool.connect(); // try to get a clienti
    console.log('Database connection successful!');
    client.release(); // release client back to pool
  } catch (err) {
    console.error('Failed to connect to the database:', err);
  }
}
testConnection();

// for query log files
const logFilePath = path.join(process.cwd(), 'logs/query.log')

async function logToFile(logMessage) {
  const timestamp = new Date().toISOString();
  const fullMessage = `[${timestamp}] ${logMessage}\n`;

    try {
        await fsp.appendFile(logFilePath, fullMessage);
    } catch (e) {
        console.error('Failed to write query log: ', e);
    }
}

// to query database through pool
async function query(queryText, parameters) {
    try {
        const result = await pool.query(queryText, parameters);

        // console.log(`Executed query : `, {queryText, rows: result.rowCount});
        const logMessage = `Executed query: ${queryText} |
        Parameters: ${JSON.stringify(parameters)} | 
        Rows affected: ${result.rowCount}
        `;
        // console.log(logMessage);
        logToFile(logMessage)

        return result;
    } catch (e) {
        console.error(e);
        throw e;
    }
}

// to shutdown
async function shutdown() {
    try {
        await pool.end();
        console.log('Database pool has ended');
    } catch (e) {
        console.error('Error ending database pool', e);
    } finally {
        process.exit();
    }
}

// In long-running apps or scripts, closing the pool is good practice to avoid hanging processes.
// SIGINT = signal interrupt
process.on('SIGINT', shutdown);
// SIGTERM = signal terminate
process.on('SIGTERM', shutdown);

//event listener on PostgreSQL pool
// Registers a handler for the 'error' event emitted by the connection pool.
pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
  process.exit(-1);
})

export { query, shutdown as end };