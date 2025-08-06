
export const shorthands = undefined;


export const up = (pgm) => {
    pgm.addColumn('palika', {
    province: {
      type: 'text',
      notNull: false, // make true only if you're providing default or existing data
    },
  });
};


export const down = (pgm) => {
    pgm.dropColumn('palika', 'province');
};
