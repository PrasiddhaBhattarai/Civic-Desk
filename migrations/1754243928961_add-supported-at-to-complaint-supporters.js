export const shorthands = undefined;

export const up = (pgm) => {
    pgm.addColumn('complaint_supporters', {
        supported_at: {
            type: 'timestamp',
            notNull: true,
            default: pgm.func('CURRENT_TIMESTAMP'),
        },
    });
};

export const down = (pgm) => {
    pgm.dropColumn('complaint_supporters', 'supported_at');
};