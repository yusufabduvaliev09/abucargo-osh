import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Profile {
  id: string;
  client_code: string;
  full_name: string;
  phone: string;
  pvz_location: string;
  created_at: string;
}

const Dashboard = () => {
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (profileData) {
      setProfile(profileData);
      setFullName(profileData.full_name);
      setPhone(profileData.phone);
    }

    setLoading(false);
  };

  const handleSaveProfile = async () => {
    if (!profile) return;

    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName, phone })
      .eq("id", profile.id);

    if (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить данные",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Успешно",
        description: "Данные обновлены",
      });
      checkUser();
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({
        title: "Ошибка",
        description: "Пароли не совпадают",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось изменить пароль",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Успешно",
        description: "Пароль изменён",
      });
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  const getChineseAddress = () => {
    if (!profile) return "";
    
    const prefix = profile.client_code.substring(0, 2);
    const companyName = prefix === "YX" ? "御玺" : prefix === "YQ" ? "优祺" : "佳联";
    
    return `${companyName}${profile.client_code}\n15727306315\n浙江省金华市义乌市北苑街道春晗二区36栋好运国际货运5697库\n入仓号:${companyName}${profile.client_code}`;
  };

  const copyAddress = async () => {
    const address = getChineseAddress();
    await navigator.clipboard.writeText(address);
    toast({
      title: "Скопировано",
      description: "Адрес скопирован в буфер обмена",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Tabs defaultValue="main" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-8">
          <TabsTrigger value="main">Главная</TabsTrigger>
          <TabsTrigger value="account">Учётная запись</TabsTrigger>
          <TabsTrigger value="password">Сменить пароль</TabsTrigger>
        </TabsList>

          <TabsContent value="main" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Адрес для отправки</CardTitle>
                <CardDescription>
                  Используйте этот адрес при оформлении заказов в Китае
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <pre className="text-sm whitespace-pre-wrap font-mono">
                    {getChineseAddress()}
                  </pre>
                </div>
                <Button
                  onClick={copyAddress}
                  className="w-full bg-accent hover:bg-accent/90"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Скопировать адрес
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Ваш код клиента</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary">
                  {profile?.client_code}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="account">
            <Card>
              <CardHeader>
                <CardTitle>Учётная запись</CardTitle>
                <CardDescription>Ваши персональные данные</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>ID клиента</Label>
                  <p className="text-lg font-medium">{profile?.client_code}</p>
                </div>
                <div>
                  <Label>Дата регистрации</Label>
                  <p className="text-lg">
                    {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('ru-RU') : '-'}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fullName">Имя и фамилия</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Телефон</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <Button onClick={handleSaveProfile}>Сохранить</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="password">
            <Card>
              <CardHeader>
                <CardTitle>Сменить пароль</CardTitle>
                <CardDescription>Обновите ваш пароль</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">Новый пароль</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Повторите пароль</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
                <Button onClick={handleChangePassword}>Изменить пароль</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
  );
};

export default Dashboard;
