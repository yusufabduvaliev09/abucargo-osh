import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileSpreadsheet, CalendarIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import * as XLSX from 'xlsx';

const AdminPackages = () => {
  const [pricePerKg, setPricePerKg] = useState("12.00");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [excelData, setExcelData] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [trackColumn, setTrackColumn] = useState("1");
  const [weightColumn, setWeightColumn] = useState("");
  const [dateColumn, setDateColumn] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date>();
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
          // Filter out empty columns like _EMPTY4, _EMPTY5
          const cols = Object.keys(jsonData[0]).filter(col => 
            col && !col.startsWith('__EMPTY') && col.trim() !== ''
          );
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
        // Get values by column index (1-based)
        const rowValues = Object.values(row);
        const trackNumber = String(rowValues[parseInt(trackColumn) - 1] || '').trim();
        
        if (!trackNumber) {
          skipCount++;
          continue;
        }

        const packageWeight = weightColumn ? parseFloat(String(rowValues[parseInt(weightColumn) - 1] || '0')) : 0;
        const packageDate = dateColumn ? String(rowValues[parseInt(dateColumn) - 1] || '') : '';

        try {
          // Check if package already exists
          const { data: existingPkg } = await supabase
            .from('packages')
            .select('id, user_id, status')
            .eq('track_number', trackNumber)
            .maybeSingle();

          const arrivedAt = selectedDate 
            ? selectedDate.toISOString() 
            : (packageDate ? new Date(packageDate).toISOString() : new Date().toISOString());

          if (existingPkg) {
            // Update existing package - change status to in_transit
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
            // Create new package with in_transit status
            const newPackage: any = {
              track_number: trackNumber,
              weight: packageWeight,
              status: 'in_transit',
              arrived_at: arrivedAt,
            };
            
            if (packageWeight > 0) {
              newPackage.price_per_kg = parseFloat(pricePerKg);
              newPackage.total_price = packageWeight * parseFloat(pricePerKg);
            }

            await supabase.from('packages').insert([newPackage]);
            successCount++;
          }
        } catch (error) {
          console.error('Ошибка обработки строки:', error);
          skipCount++;
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
      setTrackColumn("1");
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
              <h4 className="font-semibold">Настройки загрузки:</h4>
              
              <div className="space-y-2">
                <Label>Дата трек-кодов</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDate ? format(selectedDate, "dd.MM.yyyy") : "Выбрать дату для всех трек-кодов"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-muted-foreground">
                  Эта дата будет применена ко всем загружаемым трек-кодам
                </p>
              </div>
              
              <div className="space-y-2">
                <Label>Номер столбца ТРЕК-КОДА (1,2,3)</Label>
                <Input
                  type="text"
                  value={trackColumn}
                  onChange={(e) => setTrackColumn(e.target.value)}
                  placeholder="Например: 1"
                />
              </div>

              <div className="space-y-2">
                <Label>Номер столбца КОД КЛИЕНТА (1,2,3)</Label>
                <Input
                  type="text"
                  value={weightColumn}
                  onChange={(e) => setWeightColumn(e.target.value)}
                  placeholder="Например: 2 (необязательно)"
                />
              </div>

              <div className="space-y-2">
                <Label>Номер столбца ВЕС ПОСЫЛКИ (1,2,3)</Label>
                <Input
                  type="text"
                  value={dateColumn}
                  onChange={(e) => setDateColumn(e.target.value)}
                  placeholder="Например: 3 (необязательно)"
                />
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
