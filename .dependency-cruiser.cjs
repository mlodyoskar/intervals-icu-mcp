module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "core-does-not-import-transport",
      severity: "error",
      from: { path: "^src/(activities|calendar|coaching|intervals|wellness|workouts)/" },
      to: { path: "^src/(server|tools)/" },
    },
    {
      name: "production-does-not-import-tests",
      severity: "error",
      from: { path: "^src/" },
      to: { path: "^tests/" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: "(^|/)node_modules/",
    tsConfig: { fileName: "tsconfig.json" },
  },
};
