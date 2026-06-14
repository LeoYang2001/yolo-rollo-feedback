import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import App from "./App";
import ReviewPrompt from "./pages/ReviewPrompt";
import Thanks from "./pages/Thanks";
import Admin from "./pages/Admin";
import Redeem from "./pages/Redeem";
import "./index.css";

// Single-page entry — five top-level routes:
//   /         customer review form (standalone — no ordering hookup)
//   /review   Google-review nudge, shown to high raters before /thanks
//   /thanks   confirmation after submit (shows the $1 reward on screen)
//   /admin    PIN-gated dashboard for staff (browse reviews)
//   /redeem   PIN-gated camera scanner for verifying gift card QRs
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/review" element={<ReviewPrompt />} />
        <Route path="/thanks" element={<Thanks />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/redeem" element={<Redeem />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
