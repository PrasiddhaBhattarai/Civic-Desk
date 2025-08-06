import bcrypt from "bcrypt";
import fsp from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, end } from "../src/config/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const filePath = path.join(__dirname, '../public/data/kathmandu_wards.geojson');

const createAdmins = async () => {
  try {
    const raw = await fsp.readFile(filePath, 'utf-8');
    const geojson = JSON.parse(raw);
    const { PROVINCE, PALIKA, TYPE } = geojson.features[0].properties;

    const palikaUsername = `admin_${PROVINCE}_${PALIKA}_${TYPE}`.toLowerCase().replace(/\s+/g, '_');
    const palikaEmail = `${palikaUsername}@gov.np`;
    const palikaPassword = "???";
    const hashedPalikaPwd = await bcrypt.hash(palikaPassword, 10);

    await query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'municipality_admin')
       ON CONFLICT (email) DO NOTHING`,
      [palikaUsername, palikaEmail, hashedPalikaPwd]
    );
    console.log(`✅ Palika admin created: ${palikaEmail}`);

    const { rows: wards } = await query(
      `SELECT id, name FROM wards`
    );

    for (const ward of wards) {
      const wardUsername = `admin_${PALIKA}_${TYPE}_${ward.name}`.toLowerCase().replace(/\s+/g, '_');
      const wardEmail = `${wardUsername}@gov.np`;
      const wardPassword = "???";
      const hashedWardPwd = await bcrypt.hash(wardPassword, 10);

      await query(
        `INSERT INTO users (name, email, password_hash, role, ward_id)
         VALUES ($1, $2, $3, 'ward_admin', $4)
         ON CONFLICT (email) DO NOTHING`,
        [wardUsername, wardEmail, hashedWardPwd, ward.id]
      );

      console.log(`✅ Ward admin created: ${wardEmail}`);
    }

    console.log("✅ All admin users created successfully.");
  } catch (err) {
    console.error("Error creating admin users:", err);
  } finally {
    await end();
  }
};

createAdmins();