
export const shorthands = undefined;


export const up = async (pgm) => {
  // 1. Create 'palika' table
  pgm.createTable('palika', {
    id: 'id',
    name: { type: 'text', notNull: true },
    type: { type: 'text', notNull: true },
  });

  // 2. Add 'palika_id' column to 'wards' table
  pgm.addColumn('wards', {
    palika_id: {
      type: 'integer',
      references: 'palika(id)',
      onDelete: 'CASCADE',
    },
  });
};

export const down = async (pgm) => {
  // Rollback
  pgm.dropColumn('wards', 'palika_id');
  pgm.dropTable('palika');
};
