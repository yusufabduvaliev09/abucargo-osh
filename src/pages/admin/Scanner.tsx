import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Camera, Plus, Copy, MessageCircle, Trash2 } from "lucide-react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

type PvzLocation = "nariman" | "zhiydalik" | "dostuk";

interface ClientProfile {
  full_name: string;
  phone: string;
  client_code: string;
  pvz_location: string;
}

const PVZ_ADDRESSES = {
  nariman: "Нариман",
  zhiydalik: "Жыйдалик УПТК",
  dostuk: "Достук"
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
  const [scannerStatus, setScannerStatus] = useState<"idle" | "requesting" | "active" | "error">("idle");
  const [lastScannedCode, setLastScannedCode] = useState("");
  const [lastScanTime, setLastScanTime] = useState(0);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const readerId = "qr-reader";

  const { toast } = useToast();

  // -------------------- CLIENT FETCH --------------------
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
    if (clientId) fetchClientData(clientId);
  }, [clientId, pvz]);

  // -------------------- CAMERA START --------------------
  const startScanning = async () => {
    try {
      if (isScanning) return;

      // Проверка поддержки браузером
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast({
          title: "Браузер не поддерживает камеру",
          description: "Используйте современный браузер (Chrome, Firefox, Safari)",
          variant: "destructive",
        });
        setScannerStatus("error");
        return;
      }

      setScannerStatus("requesting");
      toast({
        title: "Запрос доступа к камере...",
        description: "Разрешите доступ в диалоге браузера",
      });

      // Запрашиваем разрешение на камеру
      try {
        await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: "environment",
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          } 
        });
      } catch (permError: any) {
        let errorMessage = "Не удалось получить доступ к камере";
        
        if (permError.name === "NotAllowedError" || permError.name === "PermissionDeniedError") {
          errorMessage = "Доступ к камере запрещен. Разрешите доступ в настройках браузера.";
        } else if (permError.name === "NotFoundError") {
          errorMessage = "Камера не найдена на устройстве";
        } else if (permError.name === "NotReadableError") {
          errorMessage = "Камера занята другим приложением";
        }
        
        toast({
          title: "Ошибка доступа к камере",
          description: errorMessage,
          variant: "destructive",
        });
        setScannerStatus("error");
        return;
      }

      // Инициализируем сканер с поддержкой нужных форматов
      const scanner = new Html5Qrcode(readerId, {
        verbose: false,
        formatsToSupport: [
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.QR_CODE,
        ]
      });
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 300, height: 150 },
        },
        (decodedText) => {
          const now = Date.now();

          if (decodedText !== lastScannedCode || now - lastScanTime > 2300) {
            if (!codes.includes(decodedText)) {
              setCodes((prev) => [...prev, decodedText]);
              setLastScannedCode(decodedText);
              setLastScanTime(now);

              // Вибрация при успехе (если поддерживается)
              if (navigator.vibrate) {
                navigator.vibrate(200);
              }

              toast({
                title: "✓ Трек-код добавлен",
                description: decodedText,
              });
            }
          }
        },
        (errorMessage) => {
          // Игнорируем ошибки сканирования (они происходят постоянно пока нет кода в кадре)
        }
      );

      setIsScanning(true);
      setScannerStatus("active");
      toast({
        title: "Сканирование активно",
        description: "Наведите камеру на штрих-код",
      });
    } catch (error: any) {
      console.error("Scanner error:", error);
      toast({
        title: "Ошибка запуска сканера",
        description: error?.message || "Не удалось запустить сканер",
        variant: "destructive",
      });
      setScannerStatus("error");
    }
  };

  // -------------------- CAMERA STOP --------------------
  const stopScanning = async () => {
    try {
      if (scannerRef.current) {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      }
    } catch (e) {
      console.error("Stop error:", e);
    }
    setIsScanning(false);
    setScannerStatus("idle");
  };

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  // -------------------- MANUAL CODE --------------------
  const addManualCode = () => {
    if (manualCode.trim() && !codes.includes(manualCode.trim())) {
      setCodes((prev) => [...prev, manualCode.trim()]);
      setManualCode("");
      toast({
        title: "Трек-код добавлен",
        description: manualCode.trim(),
      });
    }
  };

  const removeCode = (codeToRemove: string) => {
    setCodes((prev) => prev.filter((code) => code !== codeToRemove));
  };

  // -------------------- PRICE --------------------
  const totalPrice = weight && pricePerKg ? parseFloat(weight) * parseFloat(pricePerKg) : 0;

  // -------------------- WHATSAPP --------------------
  const whatsappMessage = clientData
    ? `Здравствуйте, уважаемый(ая) ${clientData.client_code} 📦
Ваши посылки прибыли:
${codes.map((c, i) => `${i + 1}. ${c}`).join("\n")}
Вес: ${weight} кг
Итого: ${totalPrice} сом
Адрес: ${PVZ_ADDRESSES[pvz]}`
    : "";

  const openWhatsApp = () => {
    if (!clientData) return;
    const phone = clientData.phone.replace(/\D/g, "");
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(whatsappMessage)}`;
    window.open(url, "_blank");
  };

  // -------------------- UI --------------------

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Сканер посылок</h1>

      {/* ПВЗ */}
      <Card>
        <CardHeader><CardTitle>Выбор ПВЗ</CardTitle></CardHeader>
        <CardContent>
          <Select value={pvz} onValueChange={(v) => setPvz(v as PvzLocation)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="nariman">Нариман</SelectItem>
              <SelectItem value="zhiydalik">Жыйдалик УПТК</SelectItem>
              <SelectItem value="dostuk">Достук</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Сканер */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Сканирование трек-кодов</span>
            {scannerStatus === "active" && (
              <span className="text-sm font-normal text-primary animate-pulse">● Сканирую...</span>
            )}
            {scannerStatus === "requesting" && (
              <span className="text-sm font-normal text-muted-foreground">⏳ Запрос разрешения...</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {!isScanning ? (
              <Button onClick={startScanning} disabled={scannerStatus === "requesting"} className="w-full">
                <Camera className="h-4 w-4 mr-2" /> 
                {scannerStatus === "requesting" ? "Разрешите доступ к камере..." : "Открыть камеру"}
              </Button>
            ) : (
              <Button variant="destructive" onClick={stopScanning} className="w-full">
                Остановить камеру
              </Button>
            )}
            
            {scannerStatus === "error" && (
              <div className="text-sm text-destructive p-3 bg-destructive/10 rounded-md">
                <p className="font-semibold">Не удалось запустить камеру</p>
                <p className="mt-1">Проверьте разрешения камеры в настройках браузера</p>
              </div>
            )}
          </div>

          {isScanning && (
            <div className="border-2 border-primary rounded-lg overflow-hidden bg-black">
              <div id={readerId} className="w-full" />
              <div className="p-3 bg-primary/10 text-center text-sm">
                <p className="text-primary font-medium">Наведите камеру на штрих-код посылки</p>
                <p className="text-muted-foreground text-xs mt-1">CODE_128, CODE_39, EAN_13</p>
              </div>
            </div>
          )}

          {/* Ввод вручную */}
          <Input
            placeholder="Введите трек-код"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
          />
          <Button onClick={addManualCode}>
            <Plus className="h-4 w-4 mr-2" /> Добавить
          </Button>

          {/* Список */}
          {codes.length > 0 &&
            codes.map((code) => (
              <div key={code} className="flex justify-between">
                <span>{code}</span>
                <Button variant="ghost" size="icon" onClick={() => removeCode(code)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
        </CardContent>
      </Card>

      {/* Клиент */}
      <Card>
        <CardHeader><CardTitle>Клиент</CardTitle></CardHeader>
        <CardContent>
          <Input
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="Введите ID клиента"
          />
          {clientData && (
            <div className="p-4 bg-muted rounded mt-4">
              <p>Имя: {clientData.full_name}</p>
              <p>Телефон: {clientData.phone}</p>
              <p>Клиент-код: {clientData.client_code}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Цена */}
      <Card>
        <CardHeader><CardTitle>Стоимость</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Input
            type="number"
            placeholder="Вес"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
          <Select value={pricePerKg} onValueChange={setPricePerKg}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="250">250</SelectItem>
              <SelectItem value="240">240</SelectItem>
            </SelectContent>
          </Select>

          {weight && (
            <p className="text-xl font-bold">Итого: {totalPrice} сом</p>
          )}
        </CardContent>
      </Card>

      {/* WhatsApp */}
      {clientData && (
        <Card>
          <CardHeader><CardTitle>Сообщение</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <pre className="p-4 bg-muted rounded whitespace-pre-wrap">{whatsappMessage}</pre>
            <Button onClick={openWhatsApp}>
              <MessageCircle className="h-4 w-4 mr-2" /> Открыть WhatsApp
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
        }
