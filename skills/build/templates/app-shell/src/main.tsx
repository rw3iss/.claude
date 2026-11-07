import { render } from 'preact';
import { App } from './app/App';
import '@styles/global.scss';

// Apply persisted theme (if any) before render to avoid a flash.
const savedTheme = localStorage.getItem('theme');
if (savedTheme) document.documentElement.dataset.theme = savedTheme;

// To enable the service worker later:
//   import { registerServiceWorker } from './services/sw/register';
//   registerServiceWorker();

const root = document.getElementById('root');
if (!root) throw new Error('#root element not found');
render(<App />, root);
