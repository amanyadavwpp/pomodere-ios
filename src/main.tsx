import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import '@fontsource-variable/dm-sans/wght.css';
import '@fontsource-variable/lora/wght.css';
import '@fontsource-variable/lora/wght-italic.css';
import "./index.css";
import "./notes.css";
import "./mobile.css";
import App from "./App";
import { initializeStorage } from './lib/storage';
import { Capacitor } from '@capacitor/core';
import { TomatoMark } from './components/Brand';

const root = createRoot(document.getElementById('root')!);
document.documentElement.classList.toggle('native-app', Capacitor.isNativePlatform());

root.render(<div className="app-startup"><TomatoMark /><p>A little space, just for you.</p></div>);

void initializeStorage().then(() => {
  root.render(<StrictMode><App /></StrictMode>);
}).catch(() => {
  root.render(<main className="app-startup"><TomatoMark /><h1>Let's try that again.</h1><p>Your saved data could not be opened. Nothing has been overwritten.</p><button className="primary-button" onClick={() => window.location.reload()}>Try again</button></main>);
});
