import { createMDX } from "fumadocs-mdx/next";
import { resolve } from "node:path";

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  output: "export",
  images: { unoptimized: true },
  basePath: process.env.PAGES_BASE_PATH || "",
  trailingSlash: true,
  webpack(webpackConfig) {
    // MDX files in ../docs/ need to resolve packages from website/node_modules
    webpackConfig.resolve.modules.unshift(
      resolve(import.meta.dirname, "node_modules"),
    );
    return webpackConfig;
  },
};

const withMDX = createMDX();

export default withMDX(config);
