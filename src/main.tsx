import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import App from "./App";
import Thanks from "./pages/Thanks";
import Admin from "./pages/Admin";
import Redeem from "./pages/Redeem";
import "./index.css";

// Single-page entry — four top-level routes:
//   /         customer feedback form (reads ?orderId= if present)
//   /thanks   confirmation after submit
//   /admin    PIN-gated dashboard for staff (browse feedback)
//   /redeem   PIN-gated camera scanner for verifying gift card QRs
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/thanks" element={<Thanks />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/redeem" element={<Redeem />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
