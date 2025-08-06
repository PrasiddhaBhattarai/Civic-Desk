import fsp from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, end } from '../src/config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const filePath = path.join(__dirname, '../public/data/kathmandu_wards.geojson');

const importPalikaAndWards = async () => {
  try {
    const geojsonRaw = await fsp.readFile(filePath, 'utf-8');
    const geojson = JSON.parse(geojsonRaw);

    const { PALIKA: name, TYPE: type } = geojson.features[0].properties;
    const province = geojson.features[0].properties.PROVINCE;

    // Insert palika if not exists
    const insertResult = await query(
      `INSERT INTO palika (name, type, province)
       VALUES ($1, $2, $3)
       ON CONFLICT (name) DO NOTHING
       RETURNING id`,
      [name, type, province]
    );

    let palikaId = insertResult.rows[0]?.id;

    if (!palikaId) {
      const res = await query(`SELECT id FROM palika WHERE name = $1 AND type = $2`, [name, type]);
      if (res.rowCount === 0) throw new Error('Could not retrieve palika ID');
      palikaId = res.rows[0].id;
    }

    // Insert wards
    for (const feature of geojson.features) {
      const wardNumber = feature.properties.WARD;
      const geometry = feature.geometry;

      if (!geometry || geometry.type !== 'Polygon') {
        console.warn(`Skipping feature with ward ${wardNumber}: Invalid geometry`);
        continue;
      }

      const geometryString = JSON.stringify(geometry);

      await query(
        `INSERT INTO wards (name, geojson_polygon, palika_id)
         VALUES ($1, ST_SetSRID(ST_GeomFromGeoJSON($2), 4326), $3)`,
        [wardNumber.toString(), geometryString, palikaId]
      );

      console.log(`✅ Inserted Ward ${wardNumber}`);
    }

    console.log(`✅ Palika '${name}' and its wards imported successfully.`);
  } catch (err) {
    console.error('Error importing palika and wards:', err);
  } finally {
    await end();
  }
};

importPalikaAndWards();