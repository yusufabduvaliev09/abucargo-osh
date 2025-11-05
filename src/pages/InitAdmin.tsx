import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

const InitAdmin = () => {
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(false);
  const { toast } = useToast();

  const createAdmin = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-admin');

      if (error) throw error;

      toast({
        title: "Успешно",
        description: "Системный администратор создан",
      });
      
      setCreated(true);
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось создать администратора",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Инициализация системы</CardTitle>
          <CardDescription>
            Создание системного администратора
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!created ? (
            <>
              <p className="text-sm text-muted-foreground">
                Нажмите кнопку ниже для создания системного администратора с логином <strong>+996558105551</strong> и паролем <strong>admin123</strong>
              </p>
              <Button 
                onClick={createAdmin} 
                disabled={loading}
                className="w-full"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Создать администратора
              </Button>
            </>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-green-600 font-medium">
                ✓ Администратор успешно создан
              </p>
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <p className="text-sm"><strong>Логин:</strong> +996558105551</p>
                <p className="text-sm"><strong>Пароль:</strong> admin123</p>
              </div>
              <Button 
                onClick={() => window.location.href = '/login'}
                className="w-full"
              >
                Перейти к входу
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default InitAdmin;
