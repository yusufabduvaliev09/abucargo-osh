import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { MessageCircle, Send, Search } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type PvzLocation = Database["public"]["Enums"]["pvz_location"];

interface UserWithPackages {
  user_id: string;
  client_code: string;
  full_name: string;
  phone: string;
  pvz_location: PvzLocation;
  track_numbers: string[];
  package_count: number;
  last_message_date: string | null;
}

export default function Broadcast() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithPackages[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserWithPackages[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [pvzFilter, setPvzFilter] = useState<PvzLocation | "all">("all");
  const [messageTemplate, setMessageTemplate] = useState(
    `Здравствуйте, {client_code}! 

Ваши посылки в пути:
{tracking_codes}

Ожидайте уведомление о прибытии на склад.

С уважением, ABU Cargo ❤️`
  );

  useEffect(() => {
    fetchUsersWithPackages();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [users, searchQuery, pvzFilter]);

  const fetchUsersWithPackages = async () => {
    setLoading(true);
    try {
      // Fetch users with in_transit packages
      const { data: packagesData, error: packagesError } = await supabase
        .from("packages")
        .select("user_id, client_code, track_number")
        .eq("status", "in_transit");

      if (packagesError) throw packagesError;

      // Group by client_code
      const userPackagesMap = new Map<string, { user_id: string; track_numbers: string[] }>();
      
      packagesData?.forEach((pkg) => {
        if (!pkg.client_code) return;
        
        if (!userPackagesMap.has(pkg.client_code)) {
          userPackagesMap.set(pkg.client_code, {
            user_id: pkg.user_id || "",
            track_numbers: [],
          });
        }
        userPackagesMap.get(pkg.client_code)?.track_numbers.push(pkg.track_number);
      });

      // Fetch profile data for these users
      const clientCodes = Array.from(userPackagesMap.keys());
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, client_code, full_name, phone, pvz_location")
        .in("client_code", clientCodes);

      if (profilesError) throw profilesError;

      // Fetch last message date for each user
      const userIds = profilesData?.map((p) => p.user_id) || [];
      const { data: messagesData } = await supabase
        .from("mass_messages")
        .select("user_id, sent_at")
        .in("user_id", userIds)
        .order("sent_at", { ascending: false });

      const lastMessageMap = new Map<string, string>();
      messagesData?.forEach((msg) => {
        if (!lastMessageMap.has(msg.user_id)) {
          lastMessageMap.set(msg.user_id, msg.sent_at);
        }
      });

      // Combine data
      const usersWithPackages: UserWithPackages[] =
        profilesData?.map((profile) => {
          const packageInfo = userPackagesMap.get(profile.client_code);
          return {
            user_id: profile.user_id,
            client_code: profile.client_code,
            full_name: profile.full_name,
            phone: profile.phone,
            pvz_location: profile.pvz_location,
            track_numbers: packageInfo?.track_numbers || [],
            package_count: packageInfo?.track_numbers.length || 0,
            last_message_date: lastMessageMap.get(profile.user_id) || null,
          };
        }) || [];

      setUsers(usersWithPackages);
      setFilteredUsers(usersWithPackages);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить пользователей",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filterUsers = () => {
    let filtered = [...users];

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(
        (user) =>
          user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          user.client_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
          user.phone.includes(searchQuery)
      );
    }

    // Filter by PVZ
    if (pvzFilter !== "all") {
      filtered = filtered.filter((user) => user.pvz_location === pvzFilter);
    }

    setFilteredUsers(filtered);
  };

  const generateMessage = (user: UserWithPackages): string => {
    const trackingCodes = user.track_numbers.join("\n");
    return messageTemplate
      .replace("{client_code}", user.client_code)
      .replace("{tracking_codes}", trackingCodes)
      .replace("{pvz_location}", user.pvz_location);
  };

  const sendWhatsAppMessage = async (user: UserWithPackages) => {
    const message = generateMessage(user);
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${user.phone}?text=${encodedMessage}`;

    // Log the message
    try {
      await supabase.from("mass_messages").insert({
        user_id: user.user_id,
        message: message,
        track_codes: user.track_numbers,
        status: "sent",
      });

      // Refresh data
      await fetchUsersWithPackages();

      toast({
        title: "Успешно",
        description: `Сообщение для ${user.client_code} отправлено`,
      });
    } catch (error) {
      console.error("Error logging message:", error);
    }

    // Open WhatsApp
    window.open(whatsappUrl, "_blank");
  };

  const sendToSelected = async () => {
    if (selectedUsers.size === 0) {
      toast({
        title: "Предупреждение",
        description: "Выберите пользователей для отправки",
        variant: "destructive",
      });
      return;
    }

    const selectedUsersList = filteredUsers.filter((user) =>
      selectedUsers.has(user.user_id)
    );

    // Send to each selected user
    for (const user of selectedUsersList) {
      await sendWhatsAppMessage(user);
      // Add a small delay between messages
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    setSelectedUsers(new Set());
  };

  const toggleUserSelection = (userId: string) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
  };

  const selectAll = () => {
    if (selectedUsers.size === filteredUsers.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(filteredUsers.map((u) => u.user_id)));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">Загрузка пользователей...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Массовая рассылка</h1>
        <p className="text-muted-foreground mt-2">
          Отправка уведомлений пользователям с посылками в пути
        </p>
      </div>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Всего пользователей</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredUsers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Выбрано</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{selectedUsers.size}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Всего посылок</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {filteredUsers.reduce((sum, u) => sum + u.package_count, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Message Template */}
      <Card>
        <CardHeader>
          <CardTitle>Шаблон сообщения</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={messageTemplate}
            onChange={(e) => setMessageTemplate(e.target.value)}
            rows={8}
            placeholder="Введите шаблон сообщения..."
          />
          <p className="text-sm text-muted-foreground">
            Доступные переменные: {"{client_code}"}, {"{tracking_codes}"}, {"{pvz_location}"}
          </p>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Фильтры</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Поиск по имени, коду или телефону..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select
              value={pvzFilter}
              onValueChange={(value) => setPvzFilter(value as PvzLocation | "all")}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Выберите ПВЗ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все ПВЗ</SelectItem>
                <SelectItem value="nariman">Нариман</SelectItem>
                <SelectItem value="zhiydalik">Жийдалик УПТК</SelectItem>
                <SelectItem value="dostuk">Достук</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-4">
        <Button onClick={selectAll} variant="outline">
          {selectedUsers.size === filteredUsers.length
            ? "Снять выделение"
            : "Выбрать всех"}
        </Button>
        <Button
          onClick={sendToSelected}
          disabled={selectedUsers.size === 0}
          className="gap-2"
        >
          <Send className="h-4 w-4" />
          Отправить выбранным ({selectedUsers.size})
        </Button>
      </div>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={
                      filteredUsers.length > 0 &&
                      selectedUsers.size === filteredUsers.length
                    }
                    onCheckedChange={selectAll}
                  />
                </TableHead>
                <TableHead>Код клиента</TableHead>
                <TableHead>ФИО</TableHead>
                <TableHead>Телефон</TableHead>
                <TableHead>ПВЗ</TableHead>
                <TableHead>Посылок</TableHead>
                <TableHead>Последняя отправка</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <p className="text-muted-foreground">
                      Нет пользователей с посылками в пути
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow key={user.user_id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedUsers.has(user.user_id)}
                        onCheckedChange={() => toggleUserSelection(user.user_id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{user.client_code}</TableCell>
                    <TableCell>{user.full_name}</TableCell>
                    <TableCell>{user.phone}</TableCell>
                    <TableCell className="capitalize">
                      {user.pvz_location === "nariman"
                        ? "Нариман"
                        : user.pvz_location === "zhiydalik"
                        ? "Жийдалик"
                        : "Достук"}
                    </TableCell>
                    <TableCell>{user.package_count}</TableCell>
                    <TableCell>
                      {user.last_message_date
                        ? new Date(user.last_message_date).toLocaleDateString("ru-RU")
                        : "Нет"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => sendWhatsAppMessage(user)}
                        className="gap-2"
                      >
                        <MessageCircle className="h-4 w-4" />
                        WhatsApp
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
