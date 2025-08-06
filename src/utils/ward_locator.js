import { query } from "../config/db.js";

const findWardFromLocation = async (lat, lng) => {
    const findWardQuery = `
        SELECT id, name, palika_id
        FROM wards
        WHERE ST_Contains(geojson_polygon, ST_SetSRID(ST_Point($1, $2), 4326))
        LIMIT 1
    `;
    const result = await query(findWardQuery, [lng, lat]); // Note: lng first in POINT()

    return result.rows[0] || null;
}

export {findWardFromLocation};