import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { useToast } from "@/hooks/use-toast";
import { Shield, Trash2 } from "lucide-react";

interface UserRole {
  id: string;
  user_id: string;
  role: string;
  profiles: {
    client_code: string;
    full_name: string;
  };
}

const AdminRoles = () => {
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchUserRoles();
  }, []);

  const fetchUserRoles = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("user_roles")
      .select(`
        *,
        profiles:user_id (
          client_code,
          full_name
        )
      `)
      .order("role");

    if (data) {
      setUserRoles(data as any);
    }
    setLoading(false);
  };

  const handleRoleChange = async (roleId: string, newRole: string) => {
    const { error } = await supabase
      .from("user_roles")
      .update({ role: newRole as "user" | "admin" | "pvz" })
      .eq("id", roleId);

    if (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось изменить роль",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Успешно",
        description: "Роль обновлена",
      });
      fetchUserRoles();
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (!confirm("Вы уверены, что хотите удалить эту роль?")) return;

    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("id", roleId);

    if (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось удалить роль",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Успешно",
        description: "Роль удалена",
      });
      fetchUserRoles();
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Управление ролями
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Код клиента</TableHead>
                    <TableHead>ФИО</TableHead>
                    <TableHead>Роль</TableHead>
                    <TableHead>Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userRoles.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        Нет назначенных ролей
                      </TableCell>
                    </TableRow>
                  ) : (
                    userRoles.map((userRole) => (
                      <TableRow key={userRole.id}>
                        <TableCell className="font-mono">
                          {userRole.profiles?.client_code}
                        </TableCell>
                        <TableCell>{userRole.profiles?.full_name}</TableCell>
                        <TableCell>
                          <Select
                            value={userRole.role}
                            onValueChange={(value) =>
                              handleRoleChange(userRole.id, value)
                            }
                          >
                            <SelectTrigger className="w-[180px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="user">Пользователь</SelectItem>
                              <SelectItem value="admin">Администратор</SelectItem>
                              <SelectItem value="pvz">ПВЗ</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteRole(userRole.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="mt-6 bg-muted p-4 rounded-lg">
            <h4 className="font-semibold mb-2">Описание ролей:</h4>
            <ul className="text-sm space-y-2">
              <li><strong>Пользователь:</strong> Может просматривать свои посылки</li>
              <li><strong>Администратор:</strong> Полный доступ ко всем функциям</li>
              <li><strong>ПВЗ:</strong> Просмотр посылок своего пункта выдачи</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminRoles;
