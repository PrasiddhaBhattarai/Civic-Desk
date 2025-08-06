export const shorthands = undefined;

export const up = (pgm) => {
  // Ensure PostGIS extension exists
  pgm.sql(`CREATE EXTENSION IF NOT EXISTS postgis`);

  // Create wards table
  pgm.createTable("wards", {
    id: "id",
    name: { type: "text", notNull: true },
    geojson_polygon: { type: "geometry(polygon, 4326)", notNull: true },
  });
  // id: 'id' is shorthand for
  // id: { type: 'serial', primaryKey: true }

  // Create users table
  pgm.createTable("users", {
    id: "id",
    name: { type: "text", notNull: true },
    email: { type: "text", notNull: true, unique: true },
    password_hash: { type: "text", notNull: true },
    role: { type: "text", notNull: true },
    ward_id: {
      type: "integer",
      references: '"wards"',
      onDelete: "SET NULL",
    },
  });

  // Add check constraint for user roles
  pgm.sql(`
    ALTER TABLE users
    ADD CONSTRAINT users_role_check
    CHECK (role IN ('user', 'ward_admin', 'municipality_user'))
  `);

  // Create complaints table
  pgm.createTable("complaints", {
    id: "id",
    user_id: {
      type: "integer",
      references: '"users"',
      onDelete: "CASCADE",
      notNull: true,
    },
    ward_id: {
      type: "integer",
      references: '"wards"',
      onDelete: "SET NULL",
    },
    description: { type: "text", notNull: true },
    photo_path: { type: "text" },
    location: { type: "geometry(Point, 4326)", notNull: true },
    status: {
      type: "text",
      notNull: true,
      default: "registered",
    },
    rating: {
      type: "integer",
      check: "rating >= 1 AND rating <= 5",
      default: null,
    },
    resolved_at: {
      type: "timestamp",
      default: null,
    },
    tags: {
      type: "text[]",
      default: "{}",
    },
    submitted_at: {
      type: "timestamp",
      notNull: true,
      default: pgm.func("CURRENT_TIMESTAMP"),
    },
  });

  // Add check constraint for complaint status
  pgm.sql(`
    ALTER TABLE complaints
    ADD CONSTRAINT chk_complaints_status
    CHECK (status IN (
      'registered',
      'under_review',
      'assigned',
      'in_progress',
      'resolved'
    ))
  `);
};

export const down = (pgm) => {
  pgm.dropTable("complaints");
  pgm.dropTable("users");
  pgm.dropTable("wards");
  pgm.sql(`DROP EXTENSION IF EXISTS postgis`);
};
