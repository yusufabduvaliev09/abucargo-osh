import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

export const AdminSessionBanner = () => {
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [userName, setUserName] = useState("");
  const [adminSession, setAdminSession] = useState<any>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkImpersonation();
  }, []);

  const checkImpersonation = () => {
    const adminData = localStorage.getItem('admin_session');
    const impersonatedUser = localStorage.getItem('impersonated_user_name');
    
    if (adminData && impersonatedUser) {
      setIsImpersonating(true);
      setUserName(impersonatedUser);
      setAdminSession(JSON.parse(adminData));
    }
  };

  const handleReturnToAdmin = async () => {
    if (!adminSession) return;

    try {
      // Восстанавливаем сессию администратора
      const { error } = await supabase.auth.setSession({
        access_token: adminSession.access_token,
        refresh_token: adminSession.refresh_token,
      });

      if (error) throw error;

      // Очищаем данные имитации
      localStorage.removeItem('admin_session');
      localStorage.removeItem('impersonated_user_name');

      toast({
        title: "Успешно",
        description: "Вы вернулись в аккаунт администратора",
      });

      // Переходим в админку
      navigate("/admin/users");
      
      // Перезагружаем страницу для полного обновления состояния
      setTimeout(() => window.location.reload(), 100);
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: "Не удалось восстановить сессию администратора",
        variant: "destructive",
      });
    }
  };

  if (!isImpersonating) return null;

  return (
    <div className="bg-yellow-500 text-yellow-900 px-4 py-3 shadow-md">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          <span className="font-medium">
            👤 Вы вошли как <strong>{userName}</strong>
          </span>
        </div>
        <Button
          onClick={handleReturnToAdmin}
          variant="outline"
          size="sm"
          className="bg-white hover:bg-gray-100"
        >
          <LogOut className="h-4 w-4 mr-2" />
          🔙 Вернуться в аккаунт администратора
        </Button>
      </div>
    </div>
  );
};
