import { Outlet } from "react-router";
import { Header } from "./Header";
import { Footer } from "./Footer";

export function PublicLayout() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <Header />
      <main>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
