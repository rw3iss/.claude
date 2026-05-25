// SCSS / CSS module type declarations. Each import returns a
// hashed-class-name map keyed by the original class names in the file.

declare module '*.module.scss' {
    const classes: { readonly [key: string]: string };
    export default classes;
}

declare module '*.module.css' {
    const classes: { readonly [key: string]: string };
    export default classes;
}

// Plain .scss/.css imports (side-effect imports like global.scss)
declare module '*.scss';
declare module '*.css';
