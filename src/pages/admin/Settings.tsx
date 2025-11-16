import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Settings as SettingsIcon, Plus, Trash2, MessageCircle, Send, Instagram } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const AdminSettings = () => {
  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#10b981");
  const [pricePerKg, setPricePerKg] = useState("12.00");
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState<any[]>([]);
  const [newContact, setNewContact] = useState({ name: "", type: "whatsapp", url: "" });
  const { toast } = useToast();

  useEffect(() => {
    fetchSettings();
    fetchContacts();
  }, []);

  const fetchSettings = async () => {
    const { data } = await supabase
      .from("settings")
      .select("*")
      .single();

    if (data) {
      setLogoUrl(data.logo_url || "");
      setPrimaryColor(data.primary_color || "#10b981");
      setPricePerKg(data.price_per_kg?.toString() || "12.00");
    }
    setLoading(false);
  };

  const fetchContacts = async () => {
    const { data } = await supabase
      .from("contacts")
      .select("*")
      .order("display_order");

    if (data) {
      setContacts(data);
    }
  };

  const addContact = async () => {
    if (!newContact.name || !newContact.url) {
      toast({
        title: "Ошибка",
        description: "Заполните все поля",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase
      .from("contacts")
      .insert([{
        ...newContact,
        display_order: contacts.length + 1,
      }]);

    if (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось добавить контакт",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Успешно",
        description: "Контакт добавлен",
      });
      setNewContact({ name: "", type: "whatsapp", url: "" });
      fetchContacts();
    }
  };

  const deleteContact = async (id: string) => {
    const { error } = await supabase
      .from("contacts")
      .delete()
      .eq("id", id);

    if (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось удалить контакт",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Успешно",
        description: "Контакт удалён",
      });
      fetchContacts();
    }
  };

  const toggleContactStatus = async (id: string, isActive: boolean) => {
    const { error } = await supabase
      .from("contacts")
      .update({ is_active: !isActive })
      .eq("id", id);

    if (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось обновить статус",
        variant: "destructive",
      });
    } else {
      fetchContacts();
    }
  };

  const handleSave = async () => {
    const { data: existingSettings } = await supabase
      .from("settings")
      .select("id")
      .single();

    if (existingSettings) {
      const { error } = await supabase
        .from("settings")
        .update({
          logo_url: logoUrl,
          primary_color: primaryColor,
          price_per_kg: parseFloat(pricePerKg),
        })
        .eq("id", existingSettings.id);

      if (error) {
        toast({
          title: "Ошибка",
          description: "Не удалось сохранить настройки",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Успешно",
          description: "Настройки сохранены",
        });
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5" />
            Настройки приложения
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="logoUrl">URL логотипа</Label>
            <Input
              id="logoUrl"
              type="url"
              placeholder="https://example.com/logo.png"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              Введите ссылку на изображение логотипа
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="primaryColor">Основной цвет</Label>
            <div className="flex gap-2 items-center">
              <Input
                id="primaryColor"
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-20 h-10"
              />
              <Input
                type="text"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                placeholder="#10b981"
                className="max-w-xs"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pricePerKg">Цена за килограмм (сом)</Label>
            <Input
              id="pricePerKg"
              type="number"
              step="0.01"
              value={pricePerKg}
              onChange={(e) => setPricePerKg(e.target.value)}
              className="max-w-xs"
            />
          </div>

          <div className="border-t pt-4">
            <h3 className="font-semibold mb-4">Контактная информация</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Telegram</Label>
                <Input placeholder="@abucargo" />
              </div>
              <div className="space-y-2">
                <Label>WhatsApp</Label>
                <Input placeholder="+996 XXX XXX XXX" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" placeholder="info@abucargo.kg" />
              </div>
              <div className="space-y-2">
                <Label>Телефон</Label>
                <Input type="tel" placeholder="+996 XXX XXX XXX" />
              </div>
            </div>
          </div>

          <Button onClick={handleSave} className="w-full" size="lg">
            Сохранить настройки
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Управление контактами</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <h3 className="font-semibold">Добавить новый контакт</h3>
            
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label>Название</Label>
                <Input
                  placeholder="Менеджер Нариман"
                  value={newContact.name}
                  onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Тип</Label>
                <Select
                  value={newContact.type}
                  onValueChange={(value) => setNewContact({ ...newContact, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="telegram">Telegram</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="other">Другое</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Ссылка</Label>
                <Input
                  placeholder="https://wa.me/996555123456"
                  value={newContact.url}
                  onChange={(e) => setNewContact({ ...newContact, url: e.target.value })}
                />
              </div>

              <Button onClick={addContact}>
                <Plus className="h-4 w-4 mr-2" />
                Добавить контакт
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold">Существующие контакты</h3>
            
            {contacts.map((contact) => (
              <div key={contact.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  {contact.type === "whatsapp" && <MessageCircle className="h-5 w-5" />}
                  {contact.type === "telegram" && <Send className="h-5 w-5" />}
                  {contact.type === "instagram" && <Instagram className="h-5 w-5" />}
                  
                  <div>
                    <p className="font-medium">{contact.name}</p>
                    <p className="text-sm text-muted-foreground">{contact.url}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant={contact.is_active ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleContactStatus(contact.id, contact.is_active)}
                  >
                    {contact.is_active ? "Активен" : "Неактивен"}
                  </Button>
                  
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => deleteContact(contact.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSettings;
