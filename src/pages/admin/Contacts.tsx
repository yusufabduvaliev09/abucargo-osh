import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface Contact {
  id: string;
  name: string;
  phone: string;
  note?: string;
}

interface ContactInfo {
  whatsapp_managers?: Contact[];
  whatsapp_group?: string;
  telegram?: string;
  instagram?: string;
}

export default function AdminContacts() {
  const [contactInfo, setContactInfo] = useState<ContactInfo>({});
  const [newContact, setNewContact] = useState({ name: "", phone: "", note: "" });
  const [socialLinks, setSocialLinks] = useState({
    whatsapp_group: "",
    telegram: "",
    instagram: "",
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    try {
      const { data, error } = await supabase
        .from("settings")
        .select("contact_info")
        .single();

      if (error) throw error;

      if (data?.contact_info) {
        const info = data.contact_info as ContactInfo;
        setContactInfo(info);
        setSocialLinks({
          whatsapp_group: info.whatsapp_group || "",
          telegram: info.telegram || "",
          instagram: info.instagram || "",
        });
      }
    } catch (error: any) {
      console.error("Error fetching contacts:", error);
    }
  };

  const saveContactInfo = async (updatedInfo: ContactInfo) => {
    try {
      const { error } = await supabase
        .from("settings")
        .update({ contact_info: updatedInfo as any })
        .eq("id", (await supabase.from("settings").select("id").single()).data?.id);

      if (error) throw error;

      toast({
        title: "Настройки сохранены",
      });
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleAddContact = async () => {
    if (!newContact.name || !newContact.phone) {
      toast({
        title: "Ошибка",
        description: "Заполните имя и телефон",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    const contact: Contact = {
      id: crypto.randomUUID(),
      name: newContact.name,
      phone: newContact.phone,
      note: newContact.note,
    };

    const managers = [...(contactInfo.whatsapp_managers || []), contact];
    const updatedInfo = { ...contactInfo, whatsapp_managers: managers };
    setContactInfo(updatedInfo);
    await saveContactInfo(updatedInfo);
    setNewContact({ name: "", phone: "", note: "" });
    setLoading(false);
  };

  const handleDeleteContact = async (id: string) => {
    const managers = (contactInfo.whatsapp_managers || []).filter((c) => c.id !== id);
    const updatedInfo = { ...contactInfo, whatsapp_managers: managers };
    setContactInfo(updatedInfo);
    await saveContactInfo(updatedInfo);
  };

  const handleSaveSocialLinks = async () => {
    setLoading(true);
    const updatedInfo = {
      ...contactInfo,
      whatsapp_group: socialLinks.whatsapp_group || undefined,
      telegram: socialLinks.telegram || undefined,
      instagram: socialLinks.instagram || undefined,
    };
    setContactInfo(updatedInfo);
    await saveContactInfo(updatedInfo);
    setLoading(false);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Настройки контактов</h1>
      <p className="text-muted-foreground">
        Управляйте контактной информацией, которая будет отображаться пользователям
      </p>

      <Card>
        <CardHeader>
          <CardTitle>WhatsApp менеджеров ПВЗ</CardTitle>
          <CardDescription>
            Добавьте номера телефонов менеджеров. Каждый номер будет отображаться как кликабельная ссылка для WhatsApp.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="name">Имя / ФИО</Label>
            <Input
              id="name"
              value={newContact.name}
              onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
              placeholder="Введите имя"
            />
          </div>
          <div>
            <Label htmlFor="phone">Телефон</Label>
            <Input
              id="phone"
              value={newContact.phone}
              onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
              placeholder="+996 XXX XXX XXX"
            />
          </div>
          <div>
            <Label htmlFor="note">Примечание (необязательно)</Label>
            <Textarea
              id="note"
              value={newContact.note}
              onChange={(e) => setNewContact({ ...newContact, note: e.target.value })}
              placeholder="Например: Менеджер ПВЗ Нариман"
            />
          </div>
          <Button onClick={handleAddContact} disabled={loading}>
            <Plus className="h-4 w-4 mr-2" />
            Добавить номер
          </Button>

          <Separator className="my-4" />

          <div className="space-y-3">
            <p className="text-sm font-medium">
              Добавленные номера ({contactInfo.whatsapp_managers?.length || 0})
            </p>
            {!contactInfo.whatsapp_managers || contactInfo.whatsapp_managers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Номера не добавлены</p>
            ) : (
              contactInfo.whatsapp_managers.map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-start justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <p className="font-semibold">{contact.name}</p>
                    <p className="text-sm text-muted-foreground">{contact.phone}</p>
                    {contact.note && (
                      <p className="text-sm mt-1">{contact.note}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteContact(contact.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Социальные сети и группы</CardTitle>
          <CardDescription>
            Добавьте ссылки на группы и каналы. Оставьте поле пустым, если ссылка не нужна.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="whatsapp_group">Группа WhatsApp</Label>
            <Input
              id="whatsapp_group"
              value={socialLinks.whatsapp_group}
              onChange={(e) => setSocialLinks({ ...socialLinks, whatsapp_group: e.target.value })}
              placeholder="https://chat.whatsapp.com/..."
            />
          </div>
          <div>
            <Label htmlFor="telegram">Телеграм-канал</Label>
            <Input
              id="telegram"
              value={socialLinks.telegram}
              onChange={(e) => setSocialLinks({ ...socialLinks, telegram: e.target.value })}
              placeholder="https://t.me/..."
            />
          </div>
          <div>
            <Label htmlFor="instagram">Instagram</Label>
            <Input
              id="instagram"
              value={socialLinks.instagram}
              onChange={(e) => setSocialLinks({ ...socialLinks, instagram: e.target.value })}
              placeholder="https://instagram.com/..."
            />
          </div>
          <Button onClick={handleSaveSocialLinks} disabled={loading}>
            Сохранить ссылки
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
