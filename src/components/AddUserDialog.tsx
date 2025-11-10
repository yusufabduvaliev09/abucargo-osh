import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface AddUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const AddUserDialog = ({ open, onOpenChange, onSuccess }: AddUserDialogProps) => {
  const [clientCode, setClientCode] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const getPvzFromCode = (code: string): "nariman" | "zhiydalik" | "dostuk" | null => {
    const prefix = code.substring(0, 2).toUpperCase();
    if (prefix === "YQ") return "nariman";
    if (prefix === "YX") return "zhiydalik";
    if (prefix === "JL") return "dostuk";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!clientCode || !fullName || !phone || !password) {
      toast({
        title: "Ошибка",
        description: "Заполните все поля",
        variant: "destructive",
      });
      return;
    }

    const pvz = getPvzFromCode(clientCode);
    if (!pvz) {
      toast({
        title: "Ошибка",
        description: "ID должен начинаться с YQ, YX или JL",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          client_code: clientCode.toUpperCase(),
          full_name: fullName,
          phone: phone,
          pvz_location: pvz,
          password: password,
        },
      });

      if (error) {
        throw new Error(error.message || 'Ошибка создания пользователя');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: "Успешно",
        description: "✅ Пользователь успешно добавлен",
      });

      setClientCode("");
      setFullName("");
      setPhone("");
      setPassword("");
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Добавить пользователя</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="client_code">ID клиента</Label>
            <Input
              id="client_code"
              value={clientCode}
              onChange={(e) => setClientCode(e.target.value)}
              placeholder="YQ443"
              className="uppercase"
            />
          </div>
          <div>
            <Label htmlFor="full_name">Имя</Label>
            <Input
              id="full_name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Иванов Иван"
            />
          </div>
          <div>
            <Label htmlFor="phone">Номер телефона</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+996555123456"
            />
          </div>
          <div>
            <Label htmlFor="password">Пароль</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Введите пароль"
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Добавление..." : "Добавить"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
