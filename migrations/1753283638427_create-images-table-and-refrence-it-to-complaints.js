/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
    // 1. Create images table
    pgm.createTable("images", {
        id: "id",
        url: {
            type: "text",
            notNull: true
        },
        public_id: {
            type: "text",
            notNull: true
        },
        uploaded_at: {
            type: "timestamp",
            default: pgm.func("CURRENT_TIMESTAMP")
        }
    });

    // 2. Remove old photo_path and add as FK
    pgm.dropColumn("complaints", "photo_path");

    pgm.addColumn("complaints", {
        photo_path: {
            type: "integer",
            references: '"images"',
            onDelete: "SET NULL"
        }
    });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
    // Revert changes
    pgm.dropColumn("complaints", "photo_path");
    pgm.addColumn("complaints", {
        photo_path: {
            type: "text"
        }
    });
    pgm.dropTable("images");

};
