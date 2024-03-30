import { nodeResolve } from "@rollup/plugin-node-resolve";
import extensions from "./rollup-extensions.mjs";
import commonjs from "@rollup/plugin-commonjs";

import { cacheBuild } from "rollup-cache";

const cacheConfig = {
  name: "clay",
};

// This creates the bundle used by the examples
export default cacheBuild(cacheConfig, {
  input: "dist/src/index.js",
  output: {
    file: "./resources/openbim-clay.js",
    format: "esm",
  },
  external: ["three"], // so it's not included
  plugins: [
    extensions({
      extensions: [".js"],
    }),
    nodeResolve(),
    commonjs(),
  ],
});
