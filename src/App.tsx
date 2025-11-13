import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import TelegramAuth from "./pages/TelegramAuth";

import Dashboard from "./pages/Dashboard";
import InTransit from "./pages/InTransit";
import MyPackages from "./pages/MyPackages";
import Account from "./pages/Account";
import ChangePassword from "./pages/ChangePassword";
import AdminUsers from "./pages/admin/Users";
import AdminPackages from "./pages/admin/Packages";
import AdminRoles from "./pages/admin/Roles";
import AdminSettings from "./pages/admin/Settings";
import AdminContacts from "./pages/admin/Contacts";
import CreateAdmin from "./pages/admin/CreateAdmin";
import InitAdmin from "./pages/InitAdmin";
import NotFound from "./pages/NotFound";
import { AppLayout } from "./components/AppLayout";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          
          <Route path="/register" element={<Register />} />
          <Route path="/telegram-auth" element={<TelegramAuth />} />
          <Route path="/admin/create" element={<CreateAdmin />} />
          <Route path="/init-admin" element={<InitAdmin />} />
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/in-transit" element={<InTransit />} />
            <Route path="/my-packages" element={<MyPackages />} />
            <Route path="/account" element={<Account />} />
            <Route path="/change-password" element={<ChangePassword />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/packages" element={<AdminPackages />} />
            <Route path="/admin/roles" element={<AdminRoles />} />
            <Route path="/admin/settings" element={<AdminSettings />} />
            <Route path="/admin/contacts" element={<AdminContacts />} />
          </Route>
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
