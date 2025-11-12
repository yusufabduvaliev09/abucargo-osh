import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, UserPlus, Upload, Edit, Trash2, UserCog, MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { EditUserDialog } from "@/components/EditUserDialog";
import { AddUserDialog } from "@/components/AddUserDialog";
import { read, utils } from 'xlsx';

interface User {
  id: string;
  user_id: string;
  client_code: string;
  full_name: string;
  phone: string;
  pvz_location: string;
  created_at: string;
}

const AdminUsers = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [pvzFilter, setPvzFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchUsers();
  }, [pvzFilter]);

  const fetchUsers = async () => {
    setLoading(true);
    let query = supabase.from("profiles").select("*");

    if (pvzFilter !== "all") {
      query = query.eq("pvz_location", pvzFilter as "nariman" | "zhiydalik" | "dostuk");
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить пользователей",
        variant: "destructive",
      });
    } else {
      setUsers(data || []);
    }
    setLoading(false);
  };

  const handleSearch = () => {
    if (!searchTerm) {
      fetchUsers();
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const data = await file.arrayBuffer();
    const workbook = read(data);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = utils.sheet_to_json(worksheet);

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const row of jsonData as any[]) {
      const clientCode = (
        row['ID'] || row['Код'] || row['Код_пользователя'] ||
        row['id'] || row['Id']
      )?.toString().trim().toUpperCase();

      const fullName = (
        row['Имя'] || row['ФИО'] ||
        row['Name'] || row['FullName']
      )?.toString().trim();

      const phone = (
        row['Телефон'] || row['Номер'] ||
        row['Phone'] || row['Number']
      )?.toString().trim();

      const password = (
        row['Пароль'] ||
        row['Password'] || row['Pwd']
      )?.toString().trim();

      if (!clientCode || !fullName || !phone || !password) {
        errorCount++;
        errors.push(`Строка ${successCount + errorCount}: отсутствуют обязательные поля`);
        continue;
      }

      const pvzLocation = clientCode.startsWith('YQ') ? 'nariman' :
        clientCode.startsWith('YX') ? 'zhiydalik' :
        clientCode.startsWith('JL') ? 'dostuk' : null;

      if (!pvzLocation) {
        errorCount++;
        errors.push(`${clientCode}: ID должен начинаться с YQ, YX или JL`);
        continue;
      }

      try {
        // Проверяем, существует ли пользователь с таким client_code
        const { data: existingUser, error: selectError } = await supabase
          .from("profiles")
          .select("id")
          .eq("client_code", clientCode)
          .single();

        if (selectError && selectError.code !== "PGRST116") {
          throw selectError;
        }

        if (existingUser) {
          // Обновляем существующего пользователя
          const { error: updateError } = await supabase
            .from("profiles")
            .update({
              full_name: fullName,
              phone: phone,
              pvz_location: pvzLocation,
              password: password,
            })
            .eq("client_code", clientCode);

          if (updateError) throw updateError;
        } else {
          // Создаём нового пользователя
          const { error: insertError } = await supabase
            .from("profiles")
            .insert([
              {
                client_code: clientCode,
                full_name: fullName,
                phone: phone,
                pvz_location: pvzLocation,
                password: password,
              },
            ]);

          if (insertError) throw insertError;
        }

        successCount++;
      } catch (error: any) {
        errorCount++;
        errors.push(`${clientCode}: ${error.message}`);
      }
    }

    toast({
      title: "Импорт завершён",
      description: `✅ Успешно обработано: ${successCount}, Ошибок: ${errorCount}`,
    });

    if (errors.length > 0 && errors.length <= 5) {
      console.log('Ошибки импорта:', errors);
    }

    fetchUsers();
  } catch (error) {
    toast({
      title: "Ошибка",
      description: "Не удалось обработать файл",
      variant: "destructive",
    });
  }

  event.target.value = '';
};     return;
    }

    setLoading(true);
    let query = supabase.from("profiles").select("*");

    if (pvzFilter !== "all") {
      query = query.eq("pvz_location", pvzFilter as "nariman" | "zhiydalik" | "dostuk");
    }

    query.or(`client_code.ilike.%${searchTerm}%,full_name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`)
      .then(({ data, error }) => {
        if (error) {
          toast({
            title: "Ошибка",
            description: "Ошибка поиска",
            variant: "destructive",
          });
        } else {
          setUsers(data || []);
        }
        setLoading(false);
      });
  };

  

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Вы уверены, что хотите удалить этого пользователя?")) return;

    const { error } = await supabase.from("profiles").delete().eq("id", userId);

    if (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось удалить пользователя",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Успешно",
        description: "Пользователь удалён",
      });
      fetchUsers();
    }
  };

  const handleLoginAsUser = async (userId: string, userName: string) => {
    if (!confirm(`Вы уверены, что хотите войти как ${userName}?`)) return;

    try {
      // Сохраняем текущую сессию администратора
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        localStorage.setItem('admin_session', JSON.stringify({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        }));
        localStorage.setItem('impersonated_user_name', userName);
      }

      // Вызываем edge function для входа как пользователь
      const { data, error } = await supabase.functions.invoke('admin-login-as-user', {
        body: { target_user_id: userId },
      });

      if (error || data?.error) {
        throw new Error(error?.message || data?.error || 'Не удалось войти как пользователь');
      }

      // Используем hashed_token для верификации через OTP
      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: data.hashed_token,
        type: 'magiclink',
      });

      if (verifyError) throw verifyError;

      toast({
        title: "Успешно",
        description: `Вы вошли как ${userName}`,
      });

      // Перенаправляем на дашборд пользователя
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 500);

    } catch (error: any) {
      localStorage.removeItem('admin_session');
      localStorage.removeItem('impersonated_user_name');
      
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось войти как пользователь",
        variant: "destructive",
      });
    }
  };

  const getPvzLabel = (pvz: string) => {
    switch (pvz) {
      case "nariman": return "Нариман, Ул. Сулайманова 32";
      case "zhiydalik": return "Жийдалик, УПТК Наби Кожо 61Б";
      case "dostuk": return "Достук, Ул. Хабиба Абдуллаева 78";
      default: return pvz;
    }
  };

  const formatPhoneForWhatsApp = (phone: string) => {
    // Remove all non-digit characters
    const cleaned = phone.replace(/\D/g, "");
    return `https://wa.me/${cleaned}`;
  };

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Пользователи</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Button onClick={() => setShowAddDialog(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Добавить вручную
            </Button>
            <Button variant="outline" asChild>
              <label className="cursor-pointer">
                <Upload className="h-4 w-4 mr-2" />
                Импорт из Excel
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>
            </Button>
          </div>

          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Поиск по ID, имени или телефону"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="flex-1"
            />
            <Select value={pvzFilter} onValueChange={setPvzFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Все ПВЗ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все ПВЗ</SelectItem>
                <SelectItem value="nariman">Нариман (YQ)</SelectItem>
                <SelectItem value="zhiydalik">Жийдалик (YX)</SelectItem>
                <SelectItem value="dostuk">Достук (JL)</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleSearch}>
              <Search className="h-4 w-4 mr-2" />
              Поиск
            </Button>
          </div>

          {loading ? (
            <div className="text-center py-8">Загрузка...</div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Имя</TableHead>
                    <TableHead>Телефон</TableHead>
                    <TableHead>ПВЗ</TableHead>
                    <TableHead>Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center">
                        Пользователи не найдены
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-mono">{user.client_code}</TableCell>
                        <TableCell>{user.full_name}</TableCell>
                        <TableCell>{user.phone}</TableCell>
                        <TableCell>{getPvzLabel(user.pvz_location)}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              asChild
                              title="Написать в WhatsApp"
                            >
                              <a
                                href={formatPhoneForWhatsApp(user.phone)}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <MessageCircle className="h-4 w-4" />
                              </a>
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleLoginAsUser(user.user_id, user.full_name)}
                              title="Войти как пользователь"
                            >
                              <UserCog className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => setEditingUser(user)}
                              title="Изменить"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="icon"
                              onClick={() => handleDeleteUser(user.id)}
                              title="Удалить"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AddUserDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSuccess={fetchUsers}
      />

      {editingUser && (
        <EditUserDialog
          open={!!editingUser}
          onOpenChange={(open) => !open && setEditingUser(null)}
          user={editingUser}
          onSuccess={fetchUsers}
        />
      )}
    </div>
  );
};

export default AdminUsers;
