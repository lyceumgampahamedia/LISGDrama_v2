import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import PublicApp from "./public/PublicApp.jsx";
import "./styles/style.css";
import "./styles/media.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <PublicApp />
  </StrictMode>,
);
