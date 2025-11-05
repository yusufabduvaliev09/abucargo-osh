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
import { Search, Package as PackageIcon, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface Package {
  id: string;
  track_number: string;
  weight: number;
  status: string;
  total_price: number;
  created_at: string;
}

const MyPackages = () => {
  const [packages, setPackages] = useState<Package[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [newTrackNumber, setNewTrackNumber] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchMyPackages();
  }, []);

  const fetchMyPackages = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    const { data } = await supabase
      .from("packages")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (data) {
      setPackages(data);
    }
    setLoading(false);
  };

  const handleSearch = async () => {
    if (!searchTerm) {
      fetchMyPackages();
      return;
    }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    const { data } = await supabase
      .from("packages")
      .select("*")
      .eq("user_id", user.id)
      .ilike("track_number", `%${searchTerm}%`)
      .order("created_at", { ascending: false });

    if (data) {
      setPackages(data);
    }
    setLoading(false);
  };

  const handleAddTrackNumber = async () => {
    if (!newTrackNumber.trim()) {
      toast({
        title: "Ошибка",
        description: "Введите трек-код",
        variant: "destructive",
      });
      return;
    }

    setAdding(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    const { error } = await supabase.from('packages').insert([{
      track_number: newTrackNumber.trim(),
      user_id: user.id,
      status: 'waiting_arrival',
      weight: 0,
    }]);

    if (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось добавить трек-код",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Успешно",
        description: "Трек-код добавлен",
      });
      setNewTrackNumber("");
      fetchMyPackages();
    }
    setAdding(false);
  };

  const getStatusLabel = (status: string) => {
    const labels: { [key: string]: string } = {
      waiting_arrival: "Ожидает поступления",
      in_china: "В Китае",
      in_transit: "В пути",
      in_warehouse: "На складе",
      ready_pickup: "Готова к выдаче",
      delivered: "Выдана",
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: "default" | "secondary" | "destructive" | "outline" } = {
      waiting_arrival: "outline",
      in_china: "secondary",
      in_transit: "default",
      in_warehouse: "outline",
      ready_pickup: "default",
      delivered: "secondary",
    };
    return colors[status] || "default";
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PackageIcon className="h-5 w-5" />
            Мои посылки
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Поиск по трек-коду"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
              <Button onClick={handleSearch}>
                <Search className="h-4 w-4 mr-2" />
                Поиск
              </Button>
              <Button variant="outline" onClick={() => { setSearchTerm(""); fetchMyPackages(); }}>
                Сбросить
              </Button>
            </div>

            <div className="flex gap-2">
              <Input
                placeholder="Добавить трек-код"
                value={newTrackNumber}
                onChange={(e) => setNewTrackNumber(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddTrackNumber()}
              />
              <Button onClick={handleAddTrackNumber} disabled={adding}>
                <Plus className="h-4 w-4 mr-2" />
                Добавить
              </Button>
            </div>
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
                    <TableHead>Трек-номер</TableHead>
                    <TableHead>Вес (кг)</TableHead>
                    <TableHead>Стоимость</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Дата</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {packages.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        У вас пока нет посылок
                      </TableCell>
                    </TableRow>
                  ) : (
                    packages.map((pkg) => (
                      <TableRow key={pkg.id}>
                        <TableCell className="font-mono font-medium">{pkg.track_number}</TableCell>
                        <TableCell>{pkg.weight} кг</TableCell>
                        <TableCell>
                          {pkg.total_price ? `${pkg.total_price} сом` : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusColor(pkg.status)}>
                            {getStatusLabel(pkg.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(pkg.created_at).toLocaleDateString("ru-RU")}
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
    </div>
  );
};

export default MyPackages;
