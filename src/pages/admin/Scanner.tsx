import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Camera, Plus, Copy, MessageCircle, Trash2, CameraOff } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";

type PvzLocation = "nariman" | "zhiydalik" | "dostuk";

interface ClientProfile {
  full_name: string;
  phone: string;
  client_code: string;
  pvz_location: string;
}

const PVZ_ADDRESSES = {
  nariman: "Нариман Ул.Сулайманова32",
  zhiydalik: "Жийдалик УПТК Наби кожо 61Б",
  dostuk: "Достук Ул.ХабибаАбдуллаева78"
};

export default function Scanner() {
  const [pvz, setPvz] = useState<PvzLocation>("nariman");
  const [codes, setCodes] = useState<string[]>([]);
  const [manualCode, setManualCode] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientData, setClientData] = useState<ClientProfile | null>(null);
  const [weight, setWeight] = useState("");
  const [pricePerKg, setPricePerKg] = useState("250");
  const [isScanning, setIsScanning] = useState(false);
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const lastScannedRef = useRef<string>("");
  const lastScanTimeRef = useRef<number>(0);
  const { toast } = useToast();

  const getClientCode = (id: string, pvzLocation: PvzLocation): string => {
    const prefix = pvzLocation === "nariman" ? "YQ" : pvzLocation === "zhiydalik" ? "YX" : "JL";
    return `${prefix}${id}`;
  };

  const fetchClientData = async (id: string) => {
    if (!id.trim()) {
      setClientData(null);
      return;
    }

    const clientCode = getClientCode(id, pvz);
    const { data, error } = await supabase 
      .from("profiles") 
      .select("*") 
      .eq("client_code", clientCode) 
      .single();

    if (error) {
      toast({
        title: "Ошибка",
        description: "Клиент не найден",
        variant: "destructive",
      });
      setClientData(null);
      return;
    }
    setClientData(data);
  };

  useEffect(() => {
    if (clientId) {
      fetchClientData(clientId);
    }
  }, [clientId, pvz]);

  const startScanning = async () => {
    setIsCameraLoading(true);
    setCameraError(null);
    
    try {
      // Очищаем предыдущий сканер
      if (html5QrCodeRef.current) {
        try {
          await html5QrCodeRef.current.stop();
        } catch (e) {
          console.log("Cleanup error:", e);
        }
        html5QrCodeRef.current = null;
      }

      const qrCode = new Html5Qrcode("reader");
      html5QrCodeRef.current = qrCode;

      await qrCode.start(
        { facingMode: "environment" }, 
        { 
          fps: 10, 
          qrbox: { width: 250, height: 250 },
        }, 
        (decodedText) => {
          const now = Date.now();
          const timeSinceLastScan = now - lastScanTimeRef.current;
          
          // Проверка задержки 2.5 секунды между сканированиями
          if ((decodedText !== lastScannedRef.current || timeSinceLastScan > 2500) && 
              !codes.includes(decodedText)) {
            setCodes((prev) => [...prev, decodedText]);
            lastScannedRef.current = decodedText;
            lastScanTimeRef.current = now;
            toast({
              title: "Трек-код добавлен",
              description: decodedText,
            });
          }
        }, 
        (errorMessage) => {
          // Игнорируем ошибки декодирования (это нормально)
        }
      );
      
      setIsScanning(true);
      setIsCameraLoading(false);
    } catch (error: any) {
      console.error("Camera error:", error);
      setIsCameraLoading(false);
      setIsScanning(false);
      
      let errorMsg = "Не удалось запустить камеру";
      if (error?.message?.includes("NotAllowedError")) {
        errorMsg = "Доступ к камере запрещен. Разрешите доступ в настройках браузера.";
      } else if (error?.message?.includes("NotFoundError")) {
        errorMsg = "Камера не найдена. Убедитесь, что камера подключена и доступна.";
      }
      
      setCameraError(errorMsg);
      toast({
        title: "Ошибка камеры",
        description: errorMsg,
        variant: "destructive",
      });
    }
  };

  const stopScanning = async () => {
    if (html5QrCodeRef.current) {
      try {
        setIsCameraLoading(true);
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
        html5QrCodeRef.current = null;
        setIsScanning(false);
      } catch (error) {
        console.error("Error stopping camera:", error);
      } finally {
        setIsCameraLoading(false);
      }
    }
  };

  const addManualCode = () => {
    const trimmedCode = manualCode.trim();
    if (trimmedCode && !codes.includes(trimmedCode)) {
      setCodes((prev) => [...prev, trimmedCode]);
      setManualCode("");
      toast({
        title: "Трек-код добавлен",
        description: trimmedCode,
      });
    } else if (codes.includes(trimmedCode)) {
      toast({
        title: "Код уже добавлен",
        variant: "destructive",
      });
    }
  };

  const removeCode = (codeToRemove: string) => {
    setCodes((prev) => prev.filter((code) => code !== codeToRemove));
  };

  const clearAllCodes = () => {
    setCodes([]);
    toast({
      title: "Список очищен",
    });
  };

  const totalPrice = weight && pricePerKg ? parseFloat(weight) * parseFloat(pricePerKg) : 0;

  const whatsappMessage = clientData && codes.length > 0 && weight
    ? `Здравствуйте, уважаемый(ая) ${clientData.client_code} 📦\n\nВаши посылки прибыли с трек-кодами:\n${codes.map((code, i) => `${i + 1}. ${code}`).join("\n")}\n(${codes.length} шт)\n\n⚖️ Вес посылок: ${weight} кг\n💰 Стоимость: ${totalPrice.toFixed(2)} сом\n📍 Адрес самовывоза: ${PVZ_ADDRESSES[pvz]}\n⏰ График работы: 9:00 до 21:00\n\n💳 Реквизиты для оплаты:\nМбанк ДИЛНОЗА А: 552820112\n\nПосле оплаты обязательно отправьте чек. 🧾\n\nВажно❗ Забрать нужно в течение 5 дней, иначе хранение 20 сом/день.\n\nС уважением, команда ABU Cargo ❤️`
    : "";

  const copyMessage = () => {
    if (!whatsappMessage) {
      toast({
        title: "Ошибка",
        description: "Заполните все данные для сообщения",
        variant: "destructive",
      });
      return;
    }
    
    navigator.clipboard.writeText(whatsappMessage);
    toast({
      title: "Скопировано",
      description: "Сообщение скопировано в буфер обмена",
    });
  };

  const openWhatsApp = () => {
    if (!clientData) {
      toast({
        title: "Ошибка",
        description: "Клиент не найден",
        variant: "destructive",
      });
      return;
    }

    if (!whatsappMessage) {
      toast({
        title: "Ошибка",
        description: "Заполните все данные для сообщения",
        variant: "destructive",
      });
      return;
    }

    const phone = clientData.phone.replace(/\D/g, "");
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(whatsappMessage)}`;
    window.open(url, "_blank");
  };

  // Очистка при размонтировании компонента
  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().catch(console.error);
      }
    };
  }, []);

  return (
    <div className="container mx-auto p-4 space-y-6">
      <h1 className="text-3xl font-bold text-center">Сканер посылок</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Выбор ПВЗ</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={pvz} onValueChange={(value) => setPvz(value as PvzLocation)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="nariman">Нариман</SelectItem>
              <SelectItem value="zhiydalik">Жыйдалик УПТК</SelectItem>
              <SelectItem value="dostuk">Достук</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Сканирование трек-кодов</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isScanning && (
            <div className="border-2 border-primary rounded-lg p-4 bg-muted/50">
              <div id="reader" className="w-full min-h-[300px]" />
            </div>
          )}
          
          {cameraError && (
            <div className="p-3 bg-destructive/10 border border-destructive rounded text-destructive text-sm">
              {cameraError}
            </div>
          )}

          <div className="flex gap-2">
            {!isScanning ? (
              <Button 
                onClick={startScanning} 
                disabled={isCameraLoading}
              >
                {isCameraLoading ? (
                  <>
                    <Camera className="h-4 w-4 mr-2 animate-pulse" />
                    Загрузка...
                  </>
                ) : (
                  <>
                    <Camera className="h-4 w-4 mr-2" />
                    Открыть камеру
                  </>
                )}
              </Button>
            ) : (
              <Button variant="destructive" onClick={stopScanning} disabled={isCameraLoading}>
                <CameraOff className="h-4 w-4 mr-2" />
                Остановить камеру
              </Button>
            )}
          </div>

          <div className="space-y-2">
            <Input 
              placeholder="Введите трек-код вручную" 
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && addManualCode()}
            />
            <Button onClick={addManualCode} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Добавить
            </Button>
          </div>

          {codes.length > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold">Добавленные трек-коды ({codes.length}):</h3>
                <Button variant="outline" size="sm" onClick={clearAllCodes}>
                  Очистить все
                </Button>
              </div>
              {codes.map((code) => (
                <div key={code} className="flex items-center justify-between p-2 bg-muted rounded">
                  <span className="font-mono text-sm">{code}</span>
                  <Button variant="ghost" size="icon" onClick={() => removeCode(code)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Данные клиента</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">ID клиента (например: 11)</label>
            <Input 
              placeholder="11" 
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            />
            {clientId && (
              <p className="text-sm text-muted-foreground">
                Полный код: {getClientCode(clientId, pvz)}
              </p>
            )}
          </div>
          
          {clientData && (
            <div className="p-4 bg-muted rounded space-y-2">
              <p><strong>Имя:</strong> {clientData.full_name}</p>
              <p><strong>Телефон:</strong> {clientData.phone}</p>
              <p><strong>Код клиента:</strong> {clientData.client_code}</p>
              <p><strong>ПВЗ:</strong> {PVZ_ADDRESSES[clientData.pvz_location as PvzLocation]}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Вес и расчёт стоимости</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Вес (кг)</label>
            <Input 
              type="number" 
              step="0.01" 
              placeholder="0.00" 
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Цена за кг</label>
            <Select value={pricePerKg} onValueChange={setPricePerKg}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="250">250 сом/кг</SelectItem>
                <SelectItem value="240">240 сом/кг</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {weight && (
            <div className="p-4 bg-primary/10 rounded">
              <p className="text-2xl font-bold">
                Итого: {totalPrice.toFixed(2)} сом
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {clientData && codes.length > 0 && weight && (
        <Card>
          <CardHeader>
            <CardTitle>Отправка уведомления</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-muted rounded whitespace-pre-wrap text-sm max-h-60 overflow-y-auto">
              {whatsappMessage}
            </div>
            <div className="flex gap-2">
              <Button onClick={copyMessage} variant="outline" className="flex-1">
                <Copy className="h-4 w-4 mr-2" />
                Скопировать сообщение
              </Button>
              <Button onClick={openWhatsApp} className="flex-1">
                <MessageCircle className="h-4 w-4 mr-2" />
                Отправить в WhatsApp
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
          }
