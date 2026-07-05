import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AdminPage from "./AdminPage.tsx";

export default function AdminModal() {
  const navigate = useNavigate();

  function close() {
    navigate("/display");
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="admin-modal-overlay" onClick={close}>
      <div className="admin-modal-panel" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="admin-modal-close" onClick={close} aria-label="閉じる">
          ×
        </button>
        <AdminPage />
      </div>
    </div>
  );
}
