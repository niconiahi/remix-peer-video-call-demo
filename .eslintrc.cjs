/** @type {import('eslint').Linter.Config} */
module.exports = {
  plugins: ["prettier"],
  extends: [
    "@remix-run/eslint-config",
    "@remix-run/eslint-config/node",
    "plugin:prettier/recommended",
  ],
};
