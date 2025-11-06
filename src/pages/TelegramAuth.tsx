import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import logoImage from "@/assets/logo.jpg";

const TelegramAuth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"loading" | "error" | "success">("loading");
  const [message, setMessage] = useState("Выполняется вход...");

  useEffect(() => {
    const authenticateUser = async () => {
      const telegramId = searchParams.get("tg_id");

      if (!telegramId) {
        setStatus("error");
        setMessage("Отсутствует Telegram ID");
        return;
      }

      try {
        // Вызываем edge function для получения ссылки авторизации
        const { data, error } = await supabase.functions.invoke('telegram-auth', {
          body: { telegram_id: telegramId }
        });

        if (error) throw error;

        if (data.auth_url) {
          // Переходим по ссылке автоматической авторизации
          window.location.href = data.auth_url;
        } else {
          setStatus("error");
          setMessage("Не удалось получить ссылку для входа");
        }
      } catch (error: any) {
        console.error("Auth error:", error);
        setStatus("error");
        setMessage(error.message || "Пользователь не найден. Пожалуйста, зарегистрируйтесь сначала.");
        
        // Через 3 секунды перенаправляем на регистрацию
        setTimeout(() => {
          navigate(`/register?tg_id=${telegramId}`);
        }, 3000);
      }
    };

    authenticateUser();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <img 
              src={logoImage} 
              alt="AbuCargo Logo" 
              className="w-32 h-32 object-contain"
            />
          </div>
          <CardTitle className="text-2xl font-bold">AbuCargo</CardTitle>
          <CardDescription>Вход через Telegram</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-4">
          {status === "loading" && (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-center text-muted-foreground">{message}</p>
            </>
          )}
          {status === "error" && (
            <div className="text-center">
              <p className="text-destructive mb-2">{message}</p>
              <p className="text-sm text-muted-foreground">
                Перенаправление на регистрацию...
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TelegramAuth;
