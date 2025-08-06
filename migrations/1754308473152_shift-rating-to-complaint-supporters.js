export const shorthands = undefined;

export const up = (pgm) => {
    // Add rating and feedback to complaint_supporters
    pgm.addColumns('complaint_supporters', {
        rating: { type: 'integer', check: 'rating BETWEEN 1 AND 5', default: null },
        feedback: { type: 'text', default: null }
    });

    // Remove feedback from complaints
    pgm.dropColumn('complaints', 'feedback');

    // (Optional) Ensure rating in complaints can store float for average
    pgm.alterColumn('complaints', 'rating', {
        type: 'numeric(3,2)',
        using: 'rating::numeric',
        notNull: false
    });
};

export const down = (pgm) => {
    // Reverse the changes
    pgm.dropColumns('complaint_supporters', ['rating', 'feedback']);
    pgm.addColumn('complaints', {
        feedback: { type: 'text', default: null }
    });
    pgm.alterColumn('complaints', 'rating', {
        type: 'integer',
        using: 'rating::integer',
        notNull: false
    });
};
