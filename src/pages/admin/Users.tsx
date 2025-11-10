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
import { Search, UserPlus, Upload, Edit, Trash2 } from "lucide-react";
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
      return;
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

      for (const row of jsonData as any[]) {
        const clientCode = row['ID']?.toString().trim();
        const fullName = row['Имя']?.toString().trim();
        const phone = row['Телефон']?.toString().trim();
        const password = row['Пароль']?.toString().trim();

        if (!clientCode || !fullName || !phone || !password) {
          errorCount++;
          continue;
        }

        const pvzLocation = clientCode.startsWith('YQ') ? 'nariman' :
                          clientCode.startsWith('YX') ? 'zhiydalik' :
                          clientCode.startsWith('JL') ? 'dostuk' : null;

        if (!pvzLocation) {
          errorCount++;
          continue;
        }

        try {
          const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
              client_code: clientCode,
              full_name: fullName,
              phone: phone,
              pvz_location: pvzLocation,
              password: password,
            }),
          });

          if (response.ok) {
            successCount++;
          } else {
            errorCount++;
          }
        } catch (error) {
          errorCount++;
        }
      }

      toast({
        title: "Импорт завершён",
        description: `✅ Импорт завершён успешно. Добавлено: ${successCount}${errorCount > 0 ? `, Ошибок: ${errorCount}` : ''}`,
      });

      fetchUsers();
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось обработать файл",
        variant: "destructive",
      });
    }

    event.target.value = '';
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

  const getPvzLabel = (pvz: string) => {
    switch (pvz) {
      case "nariman": return "Нариман";
      case "zhiydalik": return "Жийдалик УПТК";
      case "dostuk": return "Достук";
      default: return pvz;
    }
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
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingUser(user)}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Изменить
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteUser(user.id)}
                            className="ml-2"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Удалить
                          </Button>
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
