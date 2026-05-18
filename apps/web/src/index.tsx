import React from "react";
import { createRoot } from "react-dom/client";

import "./styles/index.css";
import "./styles/glass.css";
import App from "./App";

const container = document.getElementById("root") as HTMLElement;
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
