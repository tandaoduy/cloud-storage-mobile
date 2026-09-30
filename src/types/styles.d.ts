/** CSS imports are bundled by Expo for web; TypeScript only needs their module declarations. */
declare module '*.css';

declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}
