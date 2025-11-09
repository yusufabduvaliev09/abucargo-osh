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
import { Search, MessageCircle, Pencil, Trash2, UserPlus, Upload, Link as LinkIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { EditUserDialog } from "@/components/EditUserDialog";
import { AddUserDialog } from "@/components/AddUserDialog";
import * as XLSX from 'xlsx';

interface User {
  id: string;
  user_id: string;
  client_code: string;
  full_name: string;
  phone: string;
  pvz_location: string;
  created_at: string;
  auth_token: string | null;
}

const AdminUsers = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [pvzFilter, setPvzFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
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

    const { data } = await query.order("created_at", { ascending: false });

    if (data) {
      setUsers(data);
    }
    setLoading(false);
  };

  const handleSearch = async () => {
    if (!searchTerm) {
      fetchUsers();
      return;
    }

    setLoading(true);
    let query = supabase.from("profiles").select("*");

    if (pvzFilter !== "all") {
      query = query.eq("pvz_location", pvzFilter as "nariman" | "zhiydalik" | "dostuk");
    }

    const { data } = await query.or(
      `client_code.ilike.%${searchTerm}%,full_name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`
    );

    if (data) {
      setUsers(data);
    }
    setLoading(false);
  };

  const handleWhatsApp = (phone: string) => {
    const cleanPhone = phone.replace(/[^0-9]/g, "");
    window.open(`https://wa.me/${cleanPhone}`, "_blank");
  };

  const handleDelete = async (userId: string) => {
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
    const labels: { [key: string]: string } = {
      nariman: "Нариман",
      zhiydalik: "Жийдалик УПТК",
      dostuk: "Достук",
    };
    return labels[pvz] || pvz;
  };

  const getPvzFromCode = (code: string): "nariman" | "zhiydalik" | "dostuk" | null => {
    const prefix = code.substring(0, 2).toUpperCase();
    if (prefix === "YQ") return "nariman";
    if (prefix === "YX") return "zhiydalik";
    if (prefix === "JL") return "dostuk";
    return null;
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      let successCount = 0;
      let errorCount = 0;

      for (const row of jsonData as any[]) {
        const clientCode = row['ID']?.toString().trim().toUpperCase();
        const fullName = row['ФИО']?.toString().trim();
        const phone = row['Телефон']?.toString().trim();

        if (!clientCode || !fullName || !phone) {
          errorCount++;
          continue;
        }

        const pvz = getPvzFromCode(clientCode);
        if (!pvz) {
          errorCount++;
          continue;
        }

        try {
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              },
              body: JSON.stringify({
                client_code: clientCode,
                full_name: fullName,
                phone: phone,
                pvz_location: pvz,
              }),
            }
          );

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
        title: "Импорт завершен",
        description: `Успешно: ${successCount}, Ошибок: ${errorCount}`,
      });

      fetchUsers();
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось прочитать файл",
        variant: "destructive",
      });
    }

    e.target.value = '';
  };

  const copyLoginLink = (authToken: string | null) => {
    if (!authToken) {
      toast({
        title: "Ошибка",
        description: "Токен не найден",
        variant: "destructive",
      });
      return;
    }

    const link = `${window.location.origin}/login?token=${authToken}`;
    navigator.clipboard.writeText(link);
    toast({
      title: "Скопировано",
      description: "Ссылка для входа скопирована",
    });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Пользователи</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 flex-wrap mb-4">
            <Button onClick={() => setAddDialogOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Добавить пользователя
            </Button>
            <Button variant="outline" asChild>
              <label htmlFor="excel-upload" className="cursor-pointer">
                <Upload className="h-4 w-4 mr-2" />
                Импорт из Excel
                <input
                  id="excel-upload"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleExcelUpload}
                  className="hidden"
                />
              </label>
            </Button>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Input
              placeholder="Поиск по ID, ФИО или телефону"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="flex-1"
            />
            <Select value={pvzFilter} onValueChange={setPvzFilter}>
              <SelectTrigger className="w-[180px]">
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
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>ФИО</TableHead>
                    <TableHead>Телефон</TableHead>
                    <TableHead>ПВЗ</TableHead>
                    <TableHead>Дата регистрации</TableHead>
                    <TableHead>Ссылка входа</TableHead>
                    <TableHead>Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
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
                          {new Date(user.created_at).toLocaleDateString("ru-RU")}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copyLoginLink(user.auth_token)}
                          >
                            <LinkIcon className="h-4 w-4" />
                          </Button>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleWhatsApp(user.phone)}
                            >
                              <MessageCircle className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => {
                                setSelectedUser(user);
                                setEditDialogOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDelete(user.id)}
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
      
      <EditUserDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        user={selectedUser}
        onSuccess={fetchUsers}
      />
      
      <AddUserDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSuccess={fetchUsers}
      />
    </div>
  );
};

export default AdminUsers;
