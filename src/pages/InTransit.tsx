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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Search, RotateCcw } from "lucide-react";

interface Package {
  id: string;
  track_number: string;
  weight: number;
  status: string;
  created_at: string;
  arrived_at: string | null;
  profiles: {
    full_name: string;
    client_code: string;
  };
}

const InTransit = () => {
  const [packages, setPackages] = useState<Package[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    setLoading(true);
    
    // First get all packages
    const { data: packagesData } = await supabase
      .from("packages")
      .select("*")
      .eq("status", "in_transit")
      .order("created_at", { ascending: false });

    if (packagesData) {
      // For each package, try to find matching user by track_number or client_code
      const packagesWithUsers = await Promise.all(
        packagesData.map(async (pkg) => {
          let profile = null;
          
          // First try to get user by user_id if it exists
          if (pkg.user_id) {
            const { data: profileData } = await supabase
              .from("profiles")
              .select("full_name, client_code")
              .eq("user_id", pkg.user_id)
              .maybeSingle();
            profile = profileData;
          }
          
          // If no user_id, try to find by client_code
          if (!profile && pkg.client_code) {
            const { data: profileData } = await supabase
              .from("profiles")
              .select("full_name, client_code")
              .eq("client_code", pkg.client_code)
              .maybeSingle();
            profile = profileData;
          }
          
          return {
            ...pkg,
            profiles: profile
          };
        })
      );
      
      setPackages(packagesWithUsers as any);
    }
    setLoading(false);
  };

  const handleSearch = async () => {
    if (!searchTerm) {
      fetchPackages();
      return;
    }

    setLoading(true);
    const { data: packagesData } = await supabase
      .from("packages")
      .select("*")
      .eq("status", "in_transit")
      .ilike("track_number", `%${searchTerm}%`)
      .order("created_at", { ascending: false });

    if (packagesData) {
      // For each package, try to find matching user
      const packagesWithUsers = await Promise.all(
        packagesData.map(async (pkg) => {
          let profile = null;
          
          if (pkg.user_id) {
            const { data: profileData } = await supabase
              .from("profiles")
              .select("full_name, client_code")
              .eq("user_id", pkg.user_id)
              .maybeSingle();
            profile = profileData;
          }
          
          if (!profile && pkg.client_code) {
            const { data: profileData } = await supabase
              .from("profiles")
              .select("full_name, client_code")
              .eq("client_code", pkg.client_code)
              .maybeSingle();
            profile = profileData;
          }
          
          return {
            ...pkg,
            profiles: profile
          };
        })
      );
      
      setPackages(packagesWithUsers as any);
    }
    setLoading(false);
  };

  const handleReset = () => {
    setSearchTerm("");
    fetchPackages();
  };

  const getStatusLabel = (status: string) => {
    const labels: { [key: string]: string } = {
      waiting_arrival: "Ожидает поступления",
      in_transit: "В пути",
      arrived: "Прибыл",
      delivered: "Выдан",
    };
    return labels[status] || status;
  };

  const handleStatusChange = async (packageId: string, newStatus: string) => {
    const { error } = await supabase
      .from("packages")
      .update({ 
        status: newStatus as "waiting_arrival" | "in_transit" | "arrived" | "delivered",
        updated_at: new Date().toISOString()
      })
      .eq("id", packageId);

    if (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось обновить статус",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Успешно",
        description: "Статус посылки обновлен",
      });
      fetchPackages();
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Посылки в пути</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Поиск по трек-номеру"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <Button onClick={handleSearch}>
              <Search className="h-4 w-4 mr-2" />
              Поиск
            </Button>
            <Button variant="outline" onClick={handleReset}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Сбросить
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
                    <TableHead>Трек-номер</TableHead>
                    <TableHead>Пользователь</TableHead>
                    <TableHead>Вес (кг)</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Дата</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {packages.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Посылок не найдено
                      </TableCell>
                    </TableRow>
                  ) : (
                    packages.map((pkg) => (
                      <TableRow key={pkg.id}>
                        <TableCell className="font-mono">{pkg.track_number}</TableCell>
                        <TableCell>
                          {pkg.profiles?.client_code ? (
                            <div>
                              <div className="font-medium">{pkg.profiles.client_code}</div>
                              <div className="text-sm text-muted-foreground">{pkg.profiles.full_name}</div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>{pkg.weight}</TableCell>
                        <TableCell>
                          <Select
                            value={pkg.status}
                            onValueChange={(value) => handleStatusChange(pkg.id, value)}
                          >
                            <SelectTrigger className="w-[180px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="waiting_arrival">Ожидает поступления</SelectItem>
                              <SelectItem value="in_transit">В пути</SelectItem>
                              <SelectItem value="arrived">Прибыл</SelectItem>
                              <SelectItem value="delivered">Выдан</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {pkg.arrived_at 
                            ? new Date(pkg.arrived_at).toLocaleDateString("ru-RU")
                            : new Date(pkg.created_at).toLocaleDateString("ru-RU")
                          }
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

export default InTransit;
