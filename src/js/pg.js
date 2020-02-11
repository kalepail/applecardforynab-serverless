import { Pool } from 'pg'

export default new Pool({
  host: process.env.PG_HOST,
  port: process.env.PG_PORT,
  user: process.env.PG_USER,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  // connectionTimeoutMillis: 5000,
  // idleTimeoutMillis: 10,
  // ssl: true,
  // max: 1000,
})
