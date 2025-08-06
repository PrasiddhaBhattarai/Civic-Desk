
export const shorthands = undefined;

export const up = (pgm) => {
    pgm.addConstraint('palika', 'palika_unique_name_type', {
    unique: ['name'],
  });
};

export const down = (pgm) => {
    pgm.dropConstraint('palika', 'palika_unique_name_type');
};
