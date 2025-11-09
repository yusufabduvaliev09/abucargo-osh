import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const TokenLogin = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loginWithToken = async () => {
      const token = searchParams.get("token");

      if (!token) {
        toast({
          title: "Ошибка",
          description: "Неверная ссылка для входа",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      try {
        // Получаем пользователя по токену
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("user_id, client_code, full_name")
          .eq("auth_token", token)
          .single();

        if (profileError || !profile) {
          toast({
            title: "Ошибка",
            description: "Неверная ссылка для входа",
            variant: "destructive",
          });
          navigate("/");
          return;
        }

        // Входим через edge function
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/token-login`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ auth_token: token }),
          }
        );

        const data = await response.json();

        if (!response.ok || !data.session) {
          throw new Error("Не удалось войти");
        }

        // Устанавливаем сессию
        await supabase.auth.setSession(data.session);

        toast({
          title: "Добро пожаловать!",
          description: `Вы вошли как ${profile.full_name}`,
        });

        navigate("/dashboard");
      } catch (error: any) {
        console.error("Login error:", error);
        toast({
          title: "Ошибка входа",
          description: error.message,
          variant: "destructive",
        });
        navigate("/");
      } finally {
        setLoading(false);
      }
    };

    loginWithToken();
  }, [searchParams, navigate, toast]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Вход в систему...</p>
        </div>
      </div>
    );
  }

  return null;
};

export default TokenLogin;
