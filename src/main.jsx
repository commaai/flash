import { render } from "solid-js/web";
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "./index.css";
import config from "./config";
import App from "./app";

const manifestPromise = fetch(config.manifests.release).then((r) => r.text());

render(
  () => <App manifestPromise={manifestPromise} />,
  document.getElementById("root"),
);

const script = document.createElement("script");
script.defer = true;
script.dataset.domain = "flash.comma.ai";
script.src = "https://plausible.io/js/script.outbound-links.js";
document.body.appendChild(script);
