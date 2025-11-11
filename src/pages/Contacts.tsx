            import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageCircle, Users, Send, Instagram } from "lucide-react";

export default function Contacts() {
  const [loading, setLoading] = useState(false);

  // ✅ Статические контакты, чтобы не зависеть от Supabase
  const contactInfo = {
    whatsapp_managers: [
      { id: "1", name: "Менеджер 1", phone: "996997111118" },
      { id: "2", name: "Менеджер 2", phone: "996550997200" },
    ],
    whatsapp_group: "https://chat.whatsapp.com/BAJxaKj2mzRLE3eyIWEXbz?mode=ems_copy_t",
    telegram: "https://t.me/abu_cargo_o",
    instagram:
      "https://www.instagram.com/abu.cargo.osh?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw==",
  };

  const formatPhoneForWhatsApp = (phone: string) => {
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

      {/* WhatsApp менеджеры */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            WhatsApp менеджеры
          </CardTitle>
          <CardDescription>
            Нажмите на номер, чтобы написать менеджеру в WhatsApp.
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                </div>
                <MessageCircle className="h-5 w-5 text-green-600" />
              </a>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* WhatsApp группа */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            WhatsApp группа
          </CardTitle>
          <CardDescription>
            Присоединяйтесь к группе для получения новостей и акций.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full sm:w-auto bg-green-600 hover:bg-green-700">
            <a
              href={contactInfo.whatsapp_group}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Users className="h-4 w-4 mr-2" />
              Вступить в WhatsApp группу
            </a>
          </Button>
        </CardContent>
      </Card>

      {/* Telegram */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Telegram обучение
          </CardTitle>
          <CardDescription>
            Нажмите, чтобы перейти в наш Telegram канал.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full sm:w-auto bg-blue-500 hover:bg-blue-600">
            <a
              href={contactInfo.telegram}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Send className="h-4 w-4 mr-2" />
              Перейти в Telegram
            </a>
          </Button>
        </CardContent>
      </Card>

      {/* Instagram */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Instagram className="h-5 w-5" />
            Наш Instagram
          </CardTitle>
          <CardDescription>
            Следите за нашими новостями и обновлениями в Instagram.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full sm:w-auto bg-pink-600 hover:bg-pink-700">
            <a
              href={contactInfo.instagram}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Instagram className="h-4 w-4 mr-2" />
              Перейти в Instagram
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
