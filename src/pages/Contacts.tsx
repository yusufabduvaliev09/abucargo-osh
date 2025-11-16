import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { MessageCircle, Send, Instagram } from "lucide-react";

interface Contact {
  id: string;
  name: string;
  type: string;
  url: string;
  display_order: number;
}

export default function Contacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    try {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .eq("is_active", true)
        .order("display_order");

      if (error) throw error;
      setContacts(data || []);
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить контакты",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "whatsapp":
        return <MessageCircle className="h-5 w-5" />;
      case "telegram":
        return <Send className="h-5 w-5" />;
      case "instagram":
        return <Instagram className="h-5 w-5" />;
      default:
        return <MessageCircle className="h-5 w-5" />;
    }
  };

  const getButtonVariant = (type: string) => {
    switch (type) {
      case "whatsapp":
        return "default";
      case "telegram":
        return "secondary";
      case "instagram":
        return "outline";
      default:
        return "outline";
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <p>Загрузка...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Контакты</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {contacts.map((contact) => (
            <Button
              key={contact.id}
              variant={getButtonVariant(contact.type) as any}
              className="w-full justify-start h-auto py-4"
              onClick={() => window.open(contact.url, "_blank")}
            >
              {getIcon(contact.type)}
              <span className="ml-3">{contact.name}</span>
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
