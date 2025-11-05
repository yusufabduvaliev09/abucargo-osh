import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface Profile {
  id: string;
  user_id: string;
  client_code: string;
  full_name: string;
  phone: string;
  pvz_location: string;
  created_at: string;
}

const Account = () => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (data) {
      setProfile(data);
      setFullName(data.full_name);
      setPhone(data.phone);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!profile) return;

    setSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        phone: phone,
      })
      .eq("id", profile.id);

    if (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось обновить данные",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Успешно",
        description: "Данные обновлены",
      });
      fetchProfile();
    }

    setSaving(false);
  };

  const getPvzLabel = (pvz: string) => {
    const labels: { [key: string]: string } = {
      nariman: "Нариман (YQ)",
      zhiydalik: "Жийдалик УПТК (YX)",
      dostuk: "Достук (JL)",
    };
    return labels[pvz] || pvz;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Учётная запись</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>ID клиента</Label>
            <Input
              value={profile?.client_code || ""}
              disabled
              className="font-mono text-lg"
            />
          </div>

          <div className="space-y-2">
            <Label>Дата регистрации</Label>
            <Input
              value={
                profile?.created_at
                  ? new Date(profile.created_at).toLocaleDateString("ru-RU")
                  : ""
              }
              disabled
            />
          </div>

          <div className="space-y-2">
            <Label>ПВЗ</Label>
            <Input
              value={profile ? getPvzLabel(profile.pvz_location) : ""}
              disabled
            />
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
            <Label htmlFor="phone">Номер телефона</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full"
          >
            {saving ? "Сохранение..." : "Сохранить"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Account;
