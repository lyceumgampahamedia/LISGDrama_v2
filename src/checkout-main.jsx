import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import CheckoutApp from "./checkout/CheckoutApp.jsx";
import "./styles/style.css";
import "./styles/media.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <CheckoutApp />
  </StrictMode>,
);
