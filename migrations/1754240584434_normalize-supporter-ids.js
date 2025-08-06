export const shorthands = undefined;

export const up = (pgm) => {
    // 1. Create complaint_supporters table
    pgm.createTable('complaint_supporters', {
        complaint_id: {
            type: 'integer',
            notNull: true,
            references: 'complaints(id)',
            onDelete: 'CASCADE'
        },
        user_id: {
            type: 'integer',
            notNull: true,
            references: 'users(id)',
            onDelete: 'CASCADE'
        }
    });

    // 2. Add composite primary key to avoid duplicates
    pgm.addConstraint('complaint_supporters', 'pk_complaint_user', {
        primaryKey: ['complaint_id', 'user_id']
    });

    // 3. Drop supporter_ids and supporter_count from complaints
    pgm.dropColumns('complaints', ['supporter_ids', 'supporter_count']);

    // 4. Add UNIQUE constraint to photo_path in complaints
    pgm.addConstraint('complaints', 'unique_photo_path', 'UNIQUE(photo_path)');
};

export const down = (pgm) => {
    // Reverse steps in case of rollback

    // 1. Drop unique constraint
    pgm.dropConstraint('complaints', 'unique_photo_path');

    // 2. Add supporter_ids and supporter_count back
    pgm.addColumn('complaints', {
        supporter_ids: { type: 'integer[]' },
        supporter_count: { type: 'integer', default: 0 }
    });

    // 3. Drop complaint_supporters table
    pgm.dropTable('complaint_supporters');ß
};
