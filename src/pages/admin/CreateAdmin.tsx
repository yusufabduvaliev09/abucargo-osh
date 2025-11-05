import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { ShieldCheck } from "lucide-react";

const createAdminSchema = z.object({
  fullName: z.string().min(2, "Введите имя и фамилию"),
  phone: z.string().min(10, "Введите корректный номер телефона"),
  password: z.string().min(6, "Пароль должен содержать минимум 6 символов"),
  pvzLocation: z.enum(["nariman", "zhiydalik", "dostuk"], {
    required_error: "Выберите ПВЗ",
  }),
  role: z.enum(["admin", "pvz", "user"]),
});

const CreateAdmin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [pvzLocation, setPvzLocation] = useState<string>("");
  const [role, setRole] = useState<string>("admin");
  const [isLoading, setIsLoading] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      createAdminSchema.parse({ fullName, phone, password, pvzLocation, role });
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

      // Create user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            phone: phone,
            pvz_location: pvzLocation,
          },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (authError) {
        toast({
          title: "Ошибка",
          description: authError.message,
          variant: "destructive",
        });
        return;
      }

      if (authData.user) {
        // Update user role
        const { error: roleError } = await supabase
          .from('user_roles')
          .update({ role: role as "admin" | "pvz" | "user" })
          .eq('user_id', authData.user.id);

        if (roleError) {
          toast({
            title: "Предупреждение",
            description: "Пользователь создан, но роль не обновлена",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Успешно!",
            description: `${role === 'admin' ? 'Администратор' : role === 'pvz' ? 'Админ ПВЗ' : 'Пользователь'} создан`,
          });
          navigate("/admin/users");
        }
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Произошла ошибка при создании пользователя",
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
          <div className="flex justify-center mb-2">
            <ShieldCheck className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Создать администратора</CardTitle>
          <CardDescription>Создание нового пользователя с правами администратора</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
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
                  <SelectItem value="nariman">Нариман (YQ)</SelectItem>
                  <SelectItem value="zhiydalik">Жийдалик УПТК (YX)</SelectItem>
                  <SelectItem value="dostuk">Достук (JL)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Роль</Label>
              <Select value={role} onValueChange={setRole} required>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите роль" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Администратор</SelectItem>
                  <SelectItem value="pvz">Админ ПВЗ</SelectItem>
                  <SelectItem value="user">Пользователь</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button 
              type="submit" 
              className="w-full bg-accent hover:bg-accent/90"
              disabled={isLoading}
            >
              {isLoading ? "Создание..." : "Создать"}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <Button
              variant="link"
              onClick={() => navigate("/admin/users")}
              className="text-sm"
            >
              Вернуться к списку пользователей
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateAdmin;
