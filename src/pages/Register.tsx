import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const registerSchema = z.object({
  fullName: z.string().min(2, "Введите имя и фамилию"),
  phone: z.string().min(10, "Введите корректный номер телефона"),
  password: z.string().min(6, "Пароль должен содержать минимум 6 символов"),
  pvzLocation: z.enum(["nariman", "zhiydalik", "dostuk"], {
    required_error: "Выберите ПВЗ",
  }),
});

const Register = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const telegramId = searchParams.get("tg_id");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [pvzLocation, setPvzLocation] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      registerSchema.parse({ fullName, phone, password, pvzLocation });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Ошибка валидации",
          description: error.errors[0].message,
          variant: "destructive",
        });
        return;
      }
    }

    setIsLoading(true);

    try {
      const cleanPhone = phone.replace(/[^0-9]/g, "");
      const email = `${cleanPhone}@abucargo.app`;

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            phone: phone,
            pvz_location: pvzLocation,
            telegram_id: telegramId || undefined,
          },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) {
        if (error.message.includes("already registered")) {
          toast({
            title: "Ошибка",
            description: "Пользователь с таким номером уже зарегистрирован",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Ошибка регистрации",
            description: error.message,
            variant: "destructive",
          });
        }
      } else if (data.user) {
        // Если есть telegram_id, отправляем уведомление боту
        if (telegramId) {
          try {
            // Получаем client_code из профиля
            const { data: profileData } = await supabase
              .from('profiles')
              .select('client_code')
              .eq('user_id', data.user.id)
              .single();

            await fetch("https://abucargo-bot.onrender.com/notify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                telegramId,
                fio: fullName,
                code: profileData?.client_code || '',
                phone: cleanPhone,
                pvz: pvzLocation
              })
            });
          } catch (notifyError) {
            console.error("Failed to notify bot:", notifyError);
          }
        }
        
        toast({
          title: "Успешно!",
          description: "Регистрация завершена",
        });
        navigate("/dashboard");
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Произошла ошибка при регистрации",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Регистрация</CardTitle>
          <CardDescription>Создайте новый аккаунт в AbuCargo</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Имя и фамилия</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="Иван Иванов"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Номер телефона</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+996 XXX XXX XXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <Input
                id="password"
                type="password"
                placeholder="Минимум 6 символов"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pvz">Выберите ПВЗ</Label>
              <Select value={pvzLocation} onValueChange={setPvzLocation} required>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите пункт выдачи" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nariman">Нариман</SelectItem>
                  <SelectItem value="zhiydalik">Жийдалик УПТК</SelectItem>
                  <SelectItem value="dostuk">Достук</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button 
              type="submit" 
              className="w-full bg-accent hover:bg-accent/90"
              disabled={isLoading}
            >
              {isLoading ? "Регистрация..." : "Зарегистрироваться"}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <Button
              variant="link"
              onClick={() => navigate("/")}
              className="text-sm"
            >
              Уже есть аккаунт? Войти
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Register;
