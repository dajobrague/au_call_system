import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import astroPlugin from "eslint-plugin-astro";

export default [
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...astroPlugin.configs.recommended,
  {
    ignores: ["dist/", ".astro/", "node_modules/"],
  },
];
