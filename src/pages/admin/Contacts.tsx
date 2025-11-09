import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus } from "lucide-react";

interface Contact {
  id: string;
  name: string;
  phone: string;
  note?: string;
}

export default function AdminContacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [newContact, setNewContact] = useState({ name: "", phone: "", note: "" });
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

      if (data?.contact_info && Array.isArray(data.contact_info)) {
        setContacts(data.contact_info as unknown as Contact[]);
      }
    } catch (error: any) {
      console.error("Error fetching contacts:", error);
    }
  };

  const saveContacts = async (updatedContacts: Contact[]) => {
    try {
      const { error } = await supabase
        .from("settings")
        .update({ contact_info: updatedContacts as any })
        .eq("id", (await supabase.from("settings").select("id").single()).data?.id);

      if (error) throw error;

      toast({
        title: "Контакты сохранены",
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

    const updatedContacts = [...contacts, contact];
    setContacts(updatedContacts);
    await saveContacts(updatedContacts);
    setNewContact({ name: "", phone: "", note: "" });
    setLoading(false);
  };

  const handleDeleteContact = async (id: string) => {
    const updatedContacts = contacts.filter((c) => c.id !== id);
    setContacts(updatedContacts);
    await saveContacts(updatedContacts);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Контакты</h1>

      <Card>
        <CardHeader>
          <CardTitle>Добавить контакт</CardTitle>
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
              placeholder="Дополнительная информация"
            />
          </div>
          <Button onClick={handleAddContact} disabled={loading}>
            <Plus className="h-4 w-4 mr-2" />
            Добавить контакт
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Список контактов ({contacts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {contacts.length === 0 ? (
              <p className="text-muted-foreground">Контакты не добавлены</p>
            ) : (
              contacts.map((contact) => (
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
    </div>
  );
}
