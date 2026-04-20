// Twitter uses the same 1200×630 artwork. Re-exporting the default + metadata
// from the OG image keeps them in sync. `runtime` must be declared here as
// a literal — Next.js statically parses it and can't follow re-exports.
export const runtime = "edge";
export { default, alt, size, contentType } from "./opengraph-image";
