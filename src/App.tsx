import { BrowserRouter, Route, Routes } from "react-router-dom";
import DisplayPage from "./pages/DisplayPage.tsx";
import AdminModal from "./pages/AdminModal.tsx";

export default function App() {
  return (
    <BrowserRouter>
      <DisplayPage />
      <Routes>
        <Route path="/admin" element={<AdminModal />} />
      </Routes>
    </BrowserRouter>
  );
}
