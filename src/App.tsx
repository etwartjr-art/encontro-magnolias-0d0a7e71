import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import Index from "./pages/Index.tsx";
const InstallPrompt = lazy(() =>
  import("@/components/InstallPrompt").then((m) => ({ default: m.InstallPrompt })),
);

const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const Auth = lazy(() => import("./pages/Auth.tsx"));
const Admin = lazy(() => import("./pages/Admin.tsx"));
const Conciliacao = lazy(() => import("./pages/Conciliacao.tsx"));
const NaoPagas = lazy(() => import("./pages/NaoPagas.tsx"));

const App = () => (
  <>
    <Toaster />
    <BrowserRouter>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/conciliacao" element={<Conciliacao />} />
          <Route path="/admin/nao-pagas" element={<NaoPagas />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <Suspense fallback={null}>
        <InstallPrompt />
      </Suspense>
    </BrowserRouter>
  </>
);

export default App;
