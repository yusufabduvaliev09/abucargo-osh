import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileSpreadsheet } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import * as XLSX from 'xlsx';
import { z } from 'zod';

const packageSchema = z.object({
  trackNumber: z.string()
    .trim()
    .min(3, 'Трек-код слишком короткий')
    .max(100, 'Трек-код слишком длинный')
    .regex(/^[A-Z0-9\-_]+$/i, 'Трек-код содержит недопустимые символы'),
  weight: z.number().positive('Вес должен быть положительным').max(1000, 'Вес превышает максимум (1000 кг)').optional(),
  date: z.string().optional(),
});

const AdminPackages = () => {
  const [pricePerKg, setPricePerKg] = useState("12.00");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [excelData, setExcelData] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [trackColumn, setTrackColumn] = useState("");
  const [weightColumn, setWeightColumn] = useState("");
  const [dateColumn, setDateColumn] = useState("");
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const { toast } = useToast();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      
      try {
        const data = await selectedFile.arrayBuffer();
        const workbook = XLSX.read(data);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        if (jsonData.length > 0) {
          const cols = Object.keys(jsonData[0]);
          setColumns(cols);
          setExcelData(jsonData);
          setShowColumnSelector(true);
        }
      } catch (error) {
        toast({
          title: "Ошибка",
          description: "Не удалось прочитать файл Excel",
          variant: "destructive",
        });
      }
    }
  };

  const handleUpload = async () => {
    if (!trackColumn) {
      toast({
        title: "Ошибка",
        description: "Выберите столбец с трек-кодами",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      let successCount = 0;
      let updateCount = 0;
      let skipCount = 0;

      for (const row of excelData) {
        try {
          // Validate row data
          const validated = packageSchema.parse({
            trackNumber: String(row[trackColumn] || '').trim(),
            weight: weightColumn ? parseFloat(row[weightColumn] || '0') : undefined,
            date: dateColumn ? String(row[dateColumn] || '') : undefined,
          });

          // Check if package already exists (with user_id for matching)
          const { data: existingPkg } = await supabase
            .from('packages')
            .select('id, user_id')
            .eq('track_number', validated.trackNumber)
            .maybeSingle();

          const arrivedAt = validated.date ? new Date(validated.date).toISOString() : new Date().toISOString();
          const packageWeight = validated.weight || 0;

          if (existingPkg) {
            // Update existing package, keep user_id if it exists
            const updateData: any = {
              status: 'in_transit',
              arrived_at: arrivedAt,
              updated_at: new Date().toISOString(),
            };
            
            if (packageWeight > 0) {
              updateData.weight = packageWeight;
              updateData.price_per_kg = parseFloat(pricePerKg);
              updateData.total_price = packageWeight * parseFloat(pricePerKg);
            }
            
            await supabase
              .from('packages')
              .update(updateData)
              .eq('id', existingPkg.id);
            updateCount++;
          } else {
            // Create new package - try to match with user by looking for packages they added
            // Check if any user has this tracking number in their "waiting" packages
            const { data: userPkg } = await supabase
              .from('packages')
              .select('user_id')
              .eq('track_number', validated.trackNumber)
              .eq('status', 'waiting_arrival')
              .maybeSingle();

            const newPackage: any = {
              track_number: validated.trackNumber,
              weight: packageWeight,
              status: 'in_transit',
              arrived_at: arrivedAt,
            };
            
            if (packageWeight > 0) {
              newPackage.price_per_kg = parseFloat(pricePerKg);
              newPackage.total_price = packageWeight * parseFloat(pricePerKg);
            }

            // If found a user with this tracking number, link it
            if (userPkg?.user_id) {
              newPackage.user_id = userPkg.user_id;
              
              // Get user profile to set client_code
              const { data: profile } = await supabase
                .from('profiles')
                .select('client_code')
                .eq('user_id', userPkg.user_id)
                .maybeSingle();
              
              if (profile) {
                newPackage.client_code = profile.client_code;
              }
            }

            await supabase.from('packages').insert([newPackage]);
            successCount++;
          }
        } catch (validationError) {
          skipCount++;
          console.error('Пропущена строка:', validationError);
          continue;
        }
      }

      toast({
        title: "Успешно",
        description: `Добавлено: ${successCount}, Обновлено: ${updateCount}${skipCount > 0 ? `, Пропущено: ${skipCount}` : ''}`,
      });
      
      setFile(null);
      setShowColumnSelector(false);
      setExcelData([]);
      setColumns([]);
      setTrackColumn("");
      setWeightColumn("");
      setDateColumn("");
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить файл",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSavePrice = async () => {
    const { data: existingSettings } = await supabase
      .from('settings')
      .select('id')
      .single();

    if (existingSettings) {
      const { error } = await supabase
        .from('settings')
        .update({ price_per_kg: parseFloat(pricePerKg) })
        .eq('id', existingSettings.id);

      if (error) {
        toast({
          title: "Ошибка",
          description: "Не удалось сохранить цену",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Успешно",
          description: "Цена за килограмм обновлена",
        });
      }
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Настройка цены</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pricePerKg">Цена за килограмм (сом)</Label>
            <div className="flex gap-2">
              <Input
                id="pricePerKg"
                type="number"
                step="0.01"
                value={pricePerKg}
                onChange={(e) => setPricePerKg(e.target.value)}
                className="max-w-xs"
              />
              <Button onClick={handleSavePrice}>Сохранить</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Загрузка посылок из Excel
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border-2 border-dashed rounded-lg p-8 text-center">
            <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-4">
              Загрузите файл Excel (.xlsx или .xls)
            </p>
            <Input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="max-w-md mx-auto"
            />
            {file && (
              <p className="mt-2 text-sm text-green-600">
                Выбран файл: {file.name}
              </p>
            )}
          </div>

          {showColumnSelector && (
            <div className="space-y-4 p-4 border rounded-lg">
              <h4 className="font-semibold">Выберите столбцы из файла:</h4>
              
              <div className="space-y-2">
                <Label>Столбец с трек-кодами</Label>
                <Select value={trackColumn} onValueChange={setTrackColumn}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите столбец" />
                  </SelectTrigger>
                  <SelectContent>
                    {columns.map(col => (
                      <SelectItem key={col} value={col}>{col}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Столбец с весом (необязательно)</Label>
                <Select value={weightColumn} onValueChange={setWeightColumn}>
                  <SelectTrigger>
                    <SelectValue placeholder="Не выбрано" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Не выбрано</SelectItem>
                    {columns.map(col => (
                      <SelectItem key={col} value={col}>{col}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Столбец с датой отправки (необязательно)</Label>
                <Select value={dateColumn} onValueChange={setDateColumn}>
                  <SelectTrigger>
                    <SelectValue placeholder="Не выбрано" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Не выбрано</SelectItem>
                    {columns.map(col => (
                      <SelectItem key={col} value={col}>{col}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <Button
            onClick={handleUpload}
            disabled={!showColumnSelector || uploading}
            className="w-full"
            size="lg"
          >
            {uploading ? "Загрузка..." : "Опубликовать"}
          </Button>

          <div className="bg-muted p-4 rounded-lg">
            <h4 className="font-semibold mb-2">Инструкция:</h4>
            <ul className="text-sm space-y-1 list-disc list-inside">
              <li>Загрузите Excel файл (.xlsx или .xls)</li>
              <li>Выберите столбцы с трек-кодами, весом и датой отправки</li>
              <li>Нажмите "Опубликовать" для добавления данных</li>
              <li>Если трек-код уже существует, обновится статус и дата</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminPackages;
