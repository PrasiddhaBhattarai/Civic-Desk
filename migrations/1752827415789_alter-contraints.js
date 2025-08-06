export const shorthands = undefined;

export const up = (pgm) => {
  // Drop old constraints
  pgm.sql(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`);
  pgm.sql(
    `ALTER TABLE complaints DROP CONSTRAINT IF EXISTS chk_complaints_status`
  );

  // Add new constraint to users.role
  pgm.sql(`
    ALTER TABLE users
    ADD CONSTRAINT check_users_role
    CHECK (role IN ('user', 'ward_admin', 'municipality_admin'))
  `);

  // Add new constraint to complaints.status
  pgm.sql(`
    ALTER TABLE complaints
    ADD CONSTRAINT check_complaints_status
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
  // Drop new constraints
  pgm.sql(`ALTER TABLE users DROP CONSTRAINT IF EXISTS check_users_role`);
  pgm.sql(
    `ALTER TABLE complaints DROP CONSTRAINT IF EXISTS check_complaints_status`
  );

  // Restore old constraint to users.role
  pgm.sql(`
    ALTER TABLE users
    ADD CONSTRAINT users_role_check
    CHECK (role IN ('user', 'ward_admin', 'municipality_user'))
  `);

  // Restore old constraint to complaints.status
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
