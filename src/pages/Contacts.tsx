import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { MessageCircle, Users, Send, Instagram } from "lucide-react";

interface ContactInfo {
  whatsapp_managers?: Array<{ id: string; name: string; phone: string; note?: string }>;
  whatsapp_group?: string;
  telegram?: string;
  instagram?: string;
}

export default function Contacts() {
  const [contactInfo, setContactInfo] = useState<ContactInfo>({});
  const [loading, setLoading] = useState(true);

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
        setContactInfo(data.contact_info as ContactInfo);
      }
    } catch (error) {
      console.error("Error fetching contacts:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatPhoneForWhatsApp = (phone: string) => {
    // Remove all non-digit characters
    const cleaned = phone.replace(/\D/g, "");
    return `https://wa.me/${cleaned}`;
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <p>Загрузка...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Связь и поддержка</h1>
        <p className="text-muted-foreground">
          Используйте контакты ниже для быстрой связи с нами.
        </p>
      </div>

      {/* WhatsApp менеджеров */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            WhatsApp менеджера ПВЗ
          </CardTitle>
          <CardDescription>
            Здесь вы можете написать напрямую менеджеру пункта выдачи заказов. 
            Нажмите на номер, чтобы начать чат в WhatsApp.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {contactInfo.whatsapp_managers && contactInfo.whatsapp_managers.length > 0 ? (
            <div className="space-y-3">
              {contactInfo.whatsapp_managers.map((manager) => (
                <a
                  key={manager.id}
                  href={formatPhoneForWhatsApp(manager.phone)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors"
                >
                  <div>
                    <p className="font-semibold">{manager.name}</p>
                    <p className="text-sm text-muted-foreground">{manager.phone}</p>
                    {manager.note && (
                      <p className="text-xs text-muted-foreground mt-1">{manager.note}</p>
                    )}
                  </div>
                  <MessageCircle className="h-5 w-5 text-green-600" />
                </a>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">Контакты менеджеров пока не добавлены</p>
          )}
        </CardContent>
      </Card>

      {/* WhatsApp группа */}
      {contactInfo.whatsapp_group && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Группа WhatsApp
            </CardTitle>
            <CardDescription>
              Присоединяйтесь к нашему чату для обсуждений и обновлений.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full sm:w-auto">
              <a
                href={contactInfo.whatsapp_group}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Users className="h-4 w-4 mr-2" />
                Вступить в группу
              </a>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Telegram */}
      {contactInfo.telegram && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Телеграм-канал
            </CardTitle>
            <CardDescription>
              Будьте в курсе всех новостей и акций.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full sm:w-auto">
              <a
                href={contactInfo.telegram}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Send className="h-4 w-4 mr-2" />
                Подписаться
              </a>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Instagram */}
      {contactInfo.instagram && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Instagram className="h-5 w-5" />
              Наш Instagram
            </CardTitle>
            <CardDescription>
              Следите за нашей жизнью и новыми поступлениями.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full sm:w-auto">
              <a
                href={contactInfo.instagram}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Instagram className="h-4 w-4 mr-2" />
                Перейти в профиль
              </a>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
