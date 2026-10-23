declare module "*.module.css" {
  const classes: { [key: string]: string };
  export default classes;
}

declare module "*.module.scss" {
  const classes: { [key: string]: string };
  export default classes;
}

// Bundled as plain text (the ".md" loader in spice.config.ts).
declare module "*.md" {
  const text: string;
  export default text;
}
