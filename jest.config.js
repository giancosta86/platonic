module.exports = {
  transform: {
    "^.+\\.(t|j)sx?$": ["@swc/jest"]
  },

  testPathIgnorePatterns: ["<rootDir>/dist/", "/_.+"],

  setupFilesAfterEnv: [
    "jest-extended/all",
    "@giancosta86/more-jest-io/dist/all"
  ]
};
