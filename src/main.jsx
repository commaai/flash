import { render } from "solid-js/web";
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "./index.css";
import App from "./app";

render(() => <App />, document.getElementById("root"));

const script = document.createElement("script");
script.defer = true;
script.dataset.domain = "flash.comma.ai";
script.src = "https://plausible.io/js/script.outbound-links.js";
document.body.appendChild(script);
