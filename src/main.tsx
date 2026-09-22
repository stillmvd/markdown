import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ToastProvider } from "./components/Toast";
import "./App.css";

addEventListener("keydown", (e) => {
  if (e.key === "Tab") document.body.dataset.kbd = "";
}, true);
addEventListener("mousedown", () => {
  delete document.body.dataset.kbd;
}, true);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </React.StrictMode>,
);
