import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { MessageCircle, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface GroupedPackage {
  userName: string;
  userPhone: string;
  trackNumbers: string[];
  date: string;
}

const MessagesAndDeletion = () => {
  const [groupedPackages, setGroupedPackages] = useState<GroupedPackage[]>([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    setLoading(true);
    const { data: packagesData } = await supabase
      .from("packages")
      .select("track_number, client_code, created_at")
      .eq("status", "in_transit")
      .order("created_at", { ascending: false });

    if (packagesData) {
      // Get all profiles to match with packages
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("client_code, full_name, phone");

      // Create a map of client_code to profile
      const profileMap = new Map();
      profilesData?.forEach(profile => {
        profileMap.set(profile.client_code, {
          name: profile.full_name,
          phone: profile.phone
        });
      });

      // Group packages by phone
      const grouped = new Map<string, GroupedPackage>();
      
      packagesData.forEach(pkg => {
        const profile = profileMap.get(pkg.client_code);
        if (profile && profile.phone) {
          const phone = profile.phone;
          const date = new Date(pkg.created_at).toLocaleDateString("ru-RU");
          
          if (!grouped.has(phone)) {
            grouped.set(phone, {
              userName: profile.name,
              userPhone: phone,
              trackNumbers: [],
              date: date
            });
          }
          
          grouped.get(phone)!.trackNumbers.push(pkg.track_number);
        }
      });

      setGroupedPackages(Array.from(grouped.values()));
    }
    setLoading(false);
  };

  const formatPhoneForWhatsApp = (phone: string): string => {
    const cleaned = phone.replace(/[^0-9]/g, "");
    return cleaned;
  };

  const handleSendWhatsApp = (group: GroupedPackage) => {
    const phone = formatPhoneForWhatsApp(group.userPhone);
    const trackList = group.trackNumbers.join(", ");
    const message = encodeURIComponent(
      `Ваши посылки выехали из Китая: 📦\n${trackList}\n📆 Дата отправки: ${group.date}`
    );
    window.open(`https://wa.me/${phone}?text=${message}`, "_blank");
  };

  const handleDeleteByDate = async () => {
    if (!selectedDate) {
      toast({
        title: "Ошибка",
        description: "Выберите дату для удаления",
        variant: "destructive",
      });
      return;
    }

    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    const startDate = new Date(selectedDate);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(selectedDate);
    endDate.setHours(23, 59, 59, 999);

    const { error } = await supabase
      .from("packages")
      .delete()
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString());

    if (error) {
      toast({
        title: "Ошибка при удалении отправлений",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Успешно",
        description: "Отправления за выбранную дату успешно удалены",
      });
      setSelectedDate("");
      fetchPackages();
    }
    setShowDeleteDialog(false);
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            📩 Сообщения пользователям
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
                    <TableHead>Имя</TableHead>
                    <TableHead>Телефон</TableHead>
                    <TableHead>Трек-коды</TableHead>
                    <TableHead>Дата</TableHead>
                    <TableHead className="text-right">Действие</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedPackages.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Нет посылок в пути
                      </TableCell>
                    </TableRow>
                  ) : (
                    groupedPackages.map((group, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{group.userName}</TableCell>
                        <TableCell>{group.userPhone}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {group.trackNumbers.join(", ")}
                        </TableCell>
                        <TableCell>{group.date}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSendWhatsApp(group)}
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
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            🗑 Удаление по дате
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">
                Выберите дату для удаления отправлений
              </label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
            <Button
              variant="destructive"
              onClick={handleDeleteByDate}
              disabled={!selectedDate}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Удалить отправления
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Подтверждение удаления</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить все отправления за{" "}
              {selectedDate ? new Date(selectedDate).toLocaleDateString("ru-RU") : ""}?
              Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MessagesAndDeletion;
