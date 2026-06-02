// Style import type declarations.
//
// Component styles are authored as traditional SCSS (one .scss file per
// component, imported once at the top of the component for its side effect),
// using normal hierarchical selectors and real class names — NOT CSS modules.
// So a style import carries no value; it just registers the stylesheet.

declare module '*.scss';
declare module '*.css';
