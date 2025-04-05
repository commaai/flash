import { render } from "preact";

import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";

import "./index.css";
import App from "./App";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Failed to find the root element");

render(<App />, rootElement);
