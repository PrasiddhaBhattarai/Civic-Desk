
export const shorthands = undefined;

export const up = (pgm) => {
    pgm.createIndex("wards", "geojson_polygon", {
        method: "gist",
    });
};


export const down = (pgm) => {
    pgm.dropIndex("wards", "geojson_polygon", {
        method: "gist",
    });
};