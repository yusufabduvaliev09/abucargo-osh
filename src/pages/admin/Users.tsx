import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, UserPlus, Upload, Edit, Trash2, MessageCircle, AlertTriangle, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { EditUserDialog } from "@/components/EditUserDialog";
import { AddUserDialog } from "@/components/AddUserDialog";
import { read, utils } from 'xlsx';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

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
  const [pvzFilter, setPvzFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
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

  const handleResetSearch = () => {
    setSearchTerm("");
    fetchUsers();
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
      let updateCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      // Получаем все существующие пользователи для проверки дубликатов
      const { data: existingUsers } = await supabase
        .from("profiles")
        .select("client_code, id, user_id");

      const existingUsersMap = new Map();
      existingUsers?.forEach(user => {
        existingUsersMap.set(user.client_code.toUpperCase(), user);
      });

      for (const row of jsonData as any[]) {
        // Поддержка русских и английских заголовков
        const clientCode = (
          row['ID'] || row['Код'] || row['Код_пользователя'] || row['id'] || row['Id']
        )?.toString().trim().toUpperCase();

        const fullName = (
          row['Имя'] || row['ФИО'] || row['Name'] || row['FullName']
        )?.toString().trim();

        const phone = (
          row['Телефон'] || row['Номер'] || row['Phone'] || row['Number']
        )?.toString().trim();

        const password = (
          row['Пароль'] || row['Password'] || row['Pwd']
        )?.toString().trim();

        if (!clientCode || !fullName || !phone || !password) {
          errorCount++;
          errors.push(`Строка ${successCount + updateCount + errorCount}: отсутствуют обязательные поля (ID, Имя, Телефон, Пароль)`);
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
          const existingUser = existingUsersMap.get(clientCode);
          
          if (existingUser) {
            // Обновляем существующего пользователя
            const { error: updateError } = await supabase
              .from("profiles")
              .update({
                full_name: fullName,
                phone: phone,
                pvz_location: pvzLocation,
              })
              .eq("id", existingUser.id);

            if (updateError) {
              errorCount++;
              errors.push(`${clientCode}: Ошибка обновления - ${updateError.message}`);
            } else {
              updateCount++;
            }
          } else {
            // Создаем нового пользователя
            const { data, error } = await supabase.functions.invoke('create-user', {
              body: {
                client_code: clientCode,
                full_name: fullName,
                phone: phone,
                pvz_location: pvzLocation,
                password: password,
              },
            });

            if (error || data?.error) {
              errorCount++;
              errors.push(`${clientCode}: ${error?.message || data?.error}`);
            } else {
              successCount++;
            }
          }
        } catch (error: any) {
          errorCount++;
          errors.push(`${clientCode}: ${error.message}`);
        }
      }

      let description = "";
      if (successCount > 0 && updateCount > 0) {
        description = `✅ Добавлено: ${successCount}, Обновлено: ${updateCount}`;
      } else if (successCount > 0) {
        description = `✅ Добавлено: ${successCount}`;
      } else if (updateCount > 0) {
        description = `✅ Обновлено: ${updateCount}`;
      }

      if (errorCount > 0) {
        description += `${description ? ', ' : ''}❌ Ошибок: ${errorCount}`;
      }

      if (!description) {
        description = "Файл не содержал валидных данных";
      }

      toast({
        title: "Импорт завершён",
        description,
      });

      if (errors.length > 0 && errors.length < 10) {
        setTimeout(() => {
          alert("Ошибки импорта:\n" + errors.join('\n'));
        }, 1000);
      }

      fetchUsers();
      event.target.value = "";
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось прочитать файл",
        variant: "destructive",
      });
    }
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

  const handleWhatsAppClick = (phone: string, userName: string) => {
    // Очищаем номер телефона от всех нецифровых символов
    const cleanPhone = phone.replace(/\D/g, '');
    // Формируем ссылку WhatsApp
    const whatsappUrl = `https://wa.me/${cleanPhone}`;
    // Открываем WhatsApp в новом окне
    window.open(whatsappUrl, '_blank');
  };

  const getPvzLabel = (pvz: string) => {
    switch (pvz) {
      case "nariman":
        return "Нариман, Ул. Сулайманова 32";
      case "zhiydalik":
        return "Жийдалик, УПТК Наби Кожо 61Б";
      case "dostuk":
        return "Достук, Ул. Хабиба Абдуллаева 78";
      default:
        return pvz;
    }
  };

  const handleDeleteAllUsers = async () => {
    setIsDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('delete-all-users');
      
      if (error) {
        console.error('Error deleting all users:', error);
        toast({
          title: "Ошибка",
          description: "Не удалось удалить пользователей",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Успешно",
          description: data.message || "Все пользователи успешно удалены",
        });
        fetchUsers();
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      toast({
        title: "Ошибка",
        description: "Произошла непредвиденная ошибка",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteAllDialog(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Пользователи</span>
            <span className="text-sm font-normal text-muted-foreground">
              Количество: {users.length}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex gap-2 flex-1">
              <Button onClick={() => setShowAddDialog(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Добавить вручную
              </Button>
              
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
              />
              <Button asChild variant="outline">
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Upload className="h-4 w-4 mr-2" />
                  Импорт из Excel
                </label>
              </Button>

              <Button 
                variant="destructive" 
                onClick={() => setShowDeleteAllDialog(true)}
                disabled={isDeleting || users.length === 0}
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                Удалить всех пользователей
              </Button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <Input
              placeholder="Поиск по ID, имени или телефону..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="flex-1"
            />
            
            <Select value={pvzFilter} onValueChange={setPvzFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
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
            
            <Button onClick={handleResetSearch} variant="outline">
              <X className="h-4 w-4 mr-2" />
              Сбросить
            </Button>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-muted-foreground">Загрузка...</p>
            </div>
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
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
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
                              onClick={() => handleWhatsAppClick(user.phone, user.full_name)}
                              title="Написать в WhatsApp"
                            >
                              <MessageCircle className="h-4 w-4" />
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
                              variant="outline"
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

      {editingUser && (
        <EditUserDialog
          open={!!editingUser}
          onOpenChange={(open) => !open && setEditingUser(null)}
          user={editingUser}
          onSuccess={fetchUsers}
        />
      )}

      {showAddDialog && (
        <AddUserDialog
          open={showAddDialog}
          onOpenChange={setShowAddDialog}
          onSuccess={fetchUsers}
        />
      )}

      <AlertDialog open={showDeleteAllDialog} onOpenChange={setShowDeleteAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить всех пользователей?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить ВСЕХ пользователей? 
              <br />
              Это действие необратимо! Все пользователи (кроме вас) будут удалены из системы вместе со всеми их данными.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteAllUsers}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Удаление..." : "Да, удалить всех"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminUsers;
