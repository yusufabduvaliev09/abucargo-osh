import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Settings as SettingsIcon, Plus, Edit, Save } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface PvzLocation {
  id: string;
  code: string;
  name: string;
  address: string;
  is_active: boolean;
}

const AdminSettings = () => {
  const [companyName, setCompanyName] = useState("AbuCargo");
  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#10b981");
  const [pricePerKg, setPricePerKg] = useState("12.00");
  const [loading, setLoading] = useState(true);
  const [pvzLocations, setPvzLocations] = useState<PvzLocation[]>([]);
  const [editingPvz, setEditingPvz] = useState<PvzLocation | null>(null);
  const [newPvz, setNewPvz] = useState({ code: "", name: "", address: "" });
  const [showPvzDialog, setShowPvzDialog] = useState(false);
  const [selectedPvz, setSelectedPvz] = useState<"nariman" | "zhiydalik" | "dostuk">("nariman");
  const [templateText, setTemplateText] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    fetchSettings();
    fetchPvzLocations();
  }, []);

  useEffect(() => {
    fetchTemplate();
  }, [selectedPvz]);

  const fetchSettings = async () => {
    const { data } = await supabase
      .from("settings")
      .select("*")
      .single();

    if (data) {
      setCompanyName(data.company_name || "AbuCargo");
      setLogoUrl(data.logo_url || "");
      setPrimaryColor(data.primary_color || "#10b981");
      setPricePerKg(data.price_per_kg?.toString() || "12.00");
    }
    setLoading(false);
  };

  const fetchPvzLocations = async () => {
    const { data } = await supabase
      .from("pvz_locations_config")
      .select("*")
      .order("code");

    if (data) {
      setPvzLocations(data);
    }
  };

  const fetchTemplate = async () => {
    const { data } = await supabase
      .from("whatsapp_templates")
      .select("template")
      .eq("pvz_location", selectedPvz)
      .single();

    if (data) {
      setTemplateText(data.template);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setLogoUrl(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    const { data: existingSettings } = await supabase
      .from("settings")
      .select("id")
      .single();

    const updates = {
      company_name: companyName,
      logo_url: logoUrl,
      primary_color: primaryColor,
      price_per_kg: parseFloat(pricePerKg) || 12.00,
    };

    let error;
    if (existingSettings) {
      ({ error } = await supabase
        .from("settings")
        .update(updates)
        .eq("id", existingSettings.id));
    } else {
      ({ error } = await supabase
        .from("settings")
        .insert([updates]));
    }

    if (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить настройки",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Успешно",
        description: "Настройки сохранены",
      });
    }
  };

  const handleSaveTemplate = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data: existingTemplate } = await supabase
      .from("whatsapp_templates")
      .select("id")
      .eq("pvz_location", selectedPvz)
      .single();

    let error;
    if (existingTemplate) {
      ({ error } = await supabase
        .from("whatsapp_templates")
        .update({ 
          template: templateText,
          updated_by: user?.id
        })
        .eq("id", existingTemplate.id));
    } else {
      ({ error } = await supabase
        .from("whatsapp_templates")
        .insert([{
          pvz_location: selectedPvz,
          template: templateText,
          updated_by: user?.id
        }]));
    }

    if (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить шаблон",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Успешно",
        description: "Шаблон сохранён",
      });
    }
  };

  const handleSavePvz = async () => {
    if (!newPvz.code || !newPvz.name) {
      toast({
        title: "Ошибка",
        description: "Заполните код и название",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase
      .from("pvz_locations_config")
      .insert([{
        code: newPvz.code,
        name: newPvz.name,
        address: newPvz.address,
      }]);

    if (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось добавить ПВЗ",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Успешно",
        description: "ПВЗ добавлен",
      });
      setNewPvz({ code: "", name: "", address: "" });
      setShowPvzDialog(false);
      fetchPvzLocations();
    }
  };

  const handleUpdatePvz = async () => {
    if (!editingPvz) return;

    const { error } = await supabase
      .from("pvz_locations_config")
      .update({
        name: editingPvz.name,
        address: editingPvz.address,
      })
      .eq("id", editingPvz.id);

    if (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось обновить ПВЗ",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Успешно",
        description: "ПВЗ обновлён",
      });
      setEditingPvz(null);
      fetchPvzLocations();
    }
  };

  const handleTogglePvz = async (pvz: PvzLocation) => {
    const { error } = await supabase
      .from("pvz_locations_config")
      .update({ is_active: !pvz.is_active })
      .eq("id", pvz.id);

    if (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось изменить статус",
        variant: "destructive",
      });
    } else {
      fetchPvzLocations();
    }
  };

  if (loading) {
    return <div className="p-8">Загрузка...</div>;
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex items-center gap-2 mb-6">
        <SettingsIcon className="h-6 w-6" />
        <h1 className="text-3xl font-bold">Настройки</h1>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">Общие</TabsTrigger>
          <TabsTrigger value="pvz">Управление ПВЗ</TabsTrigger>
          <TabsTrigger value="templates">WhatsApp шаблоны</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Общие настройки</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">Название компании</Label>
                <Input
                  id="companyName"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="AbuCargo"
                />
                <p className="text-sm text-muted-foreground">
                  Отображается на главном экране и в форме входа
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="logo">Логотип</Label>
                <div className="flex items-center gap-4">
                  {logoUrl && (
                    <img 
                      src={logoUrl} 
                      alt="Logo" 
                      className="w-24 h-24 object-contain border rounded"
                    />
                  )}
                  <div className="flex-1">
                    <Input
                      id="logo"
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      Загрузите изображение из галереи
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="color">Основной цвет</Label>
                <div className="flex gap-2">
                  <Input
                    id="color"
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-20 h-10"
                  />
                  <Input
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    placeholder="#10b981"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="price">Цена за кг (сом)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={pricePerKg}
                  onChange={(e) => setPricePerKg(e.target.value)}
                />
              </div>

              <Button onClick={handleSave}>
                <Save className="h-4 w-4 mr-2" />
                Сохранить настройки
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pvz" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Управление ПВЗ</CardTitle>
                <Dialog open={showPvzDialog} onOpenChange={setShowPvzDialog}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Добавить ПВЗ
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Добавить новый ПВЗ</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Код ПВЗ</Label>
                        <Input
                          value={newPvz.code}
                          onChange={(e) => setNewPvz({ ...newPvz, code: e.target.value })}
                          placeholder="nariman"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Название</Label>
                        <Input
                          value={newPvz.name}
                          onChange={(e) => setNewPvz({ ...newPvz, name: e.target.value })}
                          placeholder="Нариман"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Адрес</Label>
                        <Input
                          value={newPvz.address}
                          onChange={(e) => setNewPvz({ ...newPvz, address: e.target.value })}
                          placeholder="г. Бишкек, ул. ..."
                        />
                      </div>
                      <Button onClick={handleSavePvz} className="w-full">
                        Сохранить
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Код</TableHead>
                    <TableHead>Название</TableHead>
                    <TableHead>Адрес</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pvzLocations.map((pvz) => (
                    <TableRow key={pvz.id}>
                      <TableCell className="font-mono">{pvz.code}</TableCell>
                      <TableCell>
                        {editingPvz?.id === pvz.id ? (
                          <Input
                            value={editingPvz.name}
                            onChange={(e) => setEditingPvz({ ...editingPvz, name: e.target.value })}
                          />
                        ) : (
                          pvz.name
                        )}
                      </TableCell>
                      <TableCell>
                        {editingPvz?.id === pvz.id ? (
                          <Input
                            value={editingPvz.address}
                            onChange={(e) => setEditingPvz({ ...editingPvz, address: e.target.value })}
                          />
                        ) : (
                          pvz.address || "-"
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded text-xs ${pvz.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                          {pvz.is_active ? "Активен" : "Неактивен"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {editingPvz?.id === pvz.id ? (
                            <>
                              <Button size="sm" onClick={handleUpdatePvz}>
                                <Save className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setEditingPvz(null)}>
                                Отмена
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button size="sm" variant="outline" onClick={() => setEditingPvz(pvz)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant={pvz.is_active ? "destructive" : "default"}
                                onClick={() => handleTogglePvz(pvz)}
                              >
                                {pvz.is_active ? "Деактивировать" : "Активировать"}
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Шаблоны сообщений WhatsApp</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Выберите ПВЗ</Label>
                <Select value={selectedPvz} onValueChange={(v: any) => setSelectedPvz(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nariman">Нариман</SelectItem>
                    <SelectItem value="zhiydalik">Жийдалик</SelectItem>
                    <SelectItem value="dostuk">Достук</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Шаблон сообщения</Label>
                <Textarea
                  value={templateText}
                  onChange={(e) => setTemplateText(e.target.value)}
                  rows={10}
                  placeholder="Введите шаблон сообщения..."
                />
                <p className="text-sm text-muted-foreground">
                  Доступные переменные: {"{client_code}"}, {"{tracking_codes}"}, {"{pvz_location}"}
                </p>
              </div>

              <Button onClick={handleSaveTemplate}>
                <Save className="h-4 w-4 mr-2" />
                Сохранить шаблон
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminSettings;
