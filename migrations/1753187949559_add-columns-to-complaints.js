export const shorthands = undefined;

export const up = (pgm) => {
    pgm.addColumn("complaints", {
        supporter_ids: {
            type: "integer[]",
            default: "{}",
        },
    });

    pgm.addColumn("complaints", {
        supporter_count: {
            type: "integer",
            default: 1,
            notNull: true,
        },
    });

    pgm.addColumn("complaints", {
        feedback: {
            type: "text",
            default: null,
        },
    });

    pgm.addColumn("complaints", {
        escalated_to_municipality: {
            type: "boolean",
            default: false,
            notNull: true,
        },
    });
};


export const down = (pgm) => {
    pgm.dropColumns("complaints", [
        "supporter_ids",
        "supporter_count",
        "feedback",
        "escalated_to_municipality",
    ]);
};
