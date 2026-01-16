import { Navigate, Route, Routes } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import LandingPage from "@/pages/LandingPage";
import PricingPage from "@/pages/PricingPage";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import DashboardPage from "@/pages/DashboardPage";
import EmailConfirmPage from "@/pages/EmailConfirmPage";
import { useAuth } from "@/lib/auth/AuthContext";

function RequireAuth({ children }: { children: JSX.Element }) {
  const { status } = useAuth();
  if (status === "loading") {
    return <div className="flex min-h-[60vh] items-center justify-center text-slate-500">Loading...</div>;
  }
  if (status !== "authenticated") {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/email-confirm" element={<EmailConfirmPage />} />
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <DashboardPage />
              </RequireAuth>
            }
          />
          <Route path="*" element={<div className="py-24 text-center">Page not found.</div>} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
