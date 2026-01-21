import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Camera, Plus, Copy, MessageCircle, Trash2, CameraOff, Flashlight, FlashlightOff } from "lucide-react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { usePvzLocations } from "@/hooks/useSettings";

interface ClientProfile {
  full_name: string;
  phone: string;
  client_code: string;
  pvz_location: string;
}

interface PvzConfig {
  id: string;
  code: string;
  name: string;
  address: string | null;
}

// Список поддерживаемых форматов штрих-кодов (только 1D штрих-коды)
const BARCODE_FORMATS = [
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.CODE_93,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.ITF,
  Html5QrcodeSupportedFormats.CODABAR
];

export default function Scanner() {
  const { pvzLocations, pvzMap } = usePvzLocations();
  const [pvz, setPvz] = useState<string>("");
  const [codes, setCodes] = useState<string[]>([]);
  const [manualCode, setManualCode] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientData, setClientData] = useState<ClientProfile | null>(null);
  const [weight, setWeight] = useState("");
  const [pricePerKg, setPricePerKg] = useState("230");
  const [isScanning, setIsScanning] = useState(false);
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isInIframe, setIsInIframe] = useState(false);
  const [template, setTemplate] = useState<string>("");
  const [isFlashlightOn, setIsFlashlightOn] = useState(false);

  // Установить первый ПВЗ при загрузке
  useEffect(() => {
    if (pvzLocations.length > 0 && !pvz) {
      setPvz(pvzLocations[0].code);
    }
  }, [pvzLocations, pvz]);

  const qrScannerRef = useRef<Html5Qrcode | null>(null);
  const scannerDivId = "qr-reader";
  
  // Рефы для предотвращения дублирования
  const lastScannedCodeRef = useRef<string>("");
  const lastScanTimeRef = useRef<number>(0);
  const scanCooldownRef = useRef<number>(800); // Задержка между сканированиями
  const processedCodesRef = useRef<Set<string>>(new Set()); // Set для хранения уникальных кодов

  const { toast } = useToast();

  // Очистка сканера
  const cleanupScanner = async () => {
    try {
      if (qrScannerRef.current) {
        await qrScannerRef.current.stop();
        await qrScannerRef.current.clear();
        qrScannerRef.current = null;
      }
    } catch (err) {
      console.error("Cleanup error:", err);
    }
  };

  // Функция для добавления кода с защитой от дублирования
  const addCodeSafely = (newCode: string) => {
    const normalizedCode = newCode.trim().toUpperCase();
    
    // Проверяем, не был ли код уже обработан
    if (processedCodesRef.current.has(normalizedCode)) {
      console.log("Код уже был отсканирован:", normalizedCode);
      return false;
    }

    const now = Date.now();
    const timeSinceLastScan = now - lastScanTimeRef.current;

    // Проверяем временную задержку и дублирование
    if (normalizedCode === lastScannedCodeRef.current && timeSinceLastScan < scanCooldownRef.current) {
      console.log("Повторное сканирование слишком быстро:", normalizedCode);
      return false;
    }

    // Добавляем код в Set обработанных кодов
    processedCodesRef.current.add(normalizedCode);
    lastScannedCodeRef.current = normalizedCode;
    lastScanTimeRef.current = now;

    // Обновляем состояние
    setCodes(prev => {
      // Дополнительная проверка на случай race condition
      if (prev.includes(normalizedCode)) {
        return prev;
      }
      return [...prev, normalizedCode];
    });

    return true;
  };

  // -------------------- CLIENT FETCH --------------------
  const getClientCode = (id: string, pvzCode: string): string => {
    // Получаем префикс из конфигурации или используем стандартные
    const prefixMap: Record<string, string> = {
      nariman: "YQ",
      zhiydalik: "YX",
      dostuk: "JL",
    };
    const prefix = prefixMap[pvzCode] || pvzCode.toUpperCase().slice(0, 2);
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

  // -------------------- TEMPLATE FETCH --------------------
  const fetchTemplate = async () => {
    if (!pvz) return;
    
    const { data, error } = await supabase
      .from("whatsapp_templates")
      .select("template")
      .eq("pvz_location", pvz as any)
      .single();

    if (data && !error) {
      setTemplate(data.template);
    }
  };

  useEffect(() => {
    if (pvz) fetchTemplate();
  }, [pvz]);

  useEffect(() => {
    if (clientId) fetchClientData(clientId);
  }, [clientId, pvz]);

  // -------------------- FAST BARCODE SCANNING --------------------
  const startScanning = async () => {
    if (isScanning) return;
    
    setIsCameraLoading(true);
    setCameraError(null);

    try {
      // Проверка iframe
      try {
        const inIframe = window.self !== window.top;
        setIsInIframe(inIframe);
        if (inIframe) {
          toast({
            title: "Камера недоступна в режиме предпросмотра",
            description: "Откройте приложение в новой вкладке",
            variant: "destructive",
          });
          setIsCameraLoading(false);
          return;
        }
      } catch {
        setIsInIframe(true);
        toast({
          title: "Камера недоступна",
          description: "Откройте приложение в новой вкладке",
          variant: "destructive",
        });
        setIsCameraLoading(false);
        return;
      }

      await cleanupScanner();

      const html5Qr = new Html5Qrcode(scannerDivId, {
        verbose: false,
        formatsToSupport: BARCODE_FORMATS
      });
      qrScannerRef.current = html5Qr;

      // Конфигурация для быстрого сканирования
      const config = {
        fps: 30, // Высокий FPS для быстрого сканирования
        qrbox: { width: 300, height: 150 }, // Широкий прямоугольник для штрих-кодов
        aspectRatio: 1.7777778, // 16:9 для лучшего охвата
        disableFlip: false
      };

      await html5Qr.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
          // Используем безопасное добавление кода
          const wasAdded = addCodeSafely(decodedText);
          
          if (wasAdded) {
            // Короткая вибрация (если доступна)
            if (navigator.vibrate) {
              navigator.vibrate(50);
            }
            
            toast({
              title: "✓ Штрих-код добавлен",
              description: decodedText,
            });
          } else {
            // Тихий тост для дублирования (опционально)
            console.log("Дубликат пропущен:", decodedText);
          }
        },
        (error) => {
          // Игнорируем ошибки парсинга QR-кодов (нас интересуют только штрих-коды)
          if (!error.includes("No multi format readers configured") && 
              !error.includes("QR code")) {
            console.warn("Barcode scanner warning:", error);
          }
        }
      );

      setIsScanning(true);
      toast({
        title: "Сканирование активно",
        description: "Наведите камеру на штрих-код",
      });

    } catch (err: any) {
      console.error("Scanner start error:", err);
      const errorMsg = err?.message?.includes("NotAllowedError")
        ? "Доступ к камере запрещен. Разрешите доступ в настройках браузера."
        : err?.message?.includes("NotFoundError")
        ? "Камера не найдена. Убедитесь, что камера подключена и доступна."
        : "Не удалось запустить камеру. Проверьте разрешения.";
      
      setCameraError(errorMsg);
      toast({
        title: "Ошибка камеры",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setIsCameraLoading(false);
    }
  };

  // -------------------- CAMERA STOP --------------------
  const stopScanning = async () => {
    try {
      setIsCameraLoading(true);
      await cleanupScanner();
      setIsScanning(false);
      toast({
        title: "Сканирование остановлено",
      });
    } catch (err) {
      console.error("Stop error:", err);
    } finally {
      setIsCameraLoading(false);
    }
  };

  const toggleCamera = () => {
    if (isScanning) {
      stopScanning();
    } else {
      startScanning();
    }
  };

  // Переключение фонарика
  const toggleFlashlight = async () => {
    try {
      if (!qrScannerRef.current || !isScanning) {
        toast({
          title: "Фонарик недоступен",
          description: "Сначала включите камеру",
          variant: "destructive",
        });
        return;
      }

      const track = qrScannerRef.current.getRunningTrackCameraCapabilities?.();
      
      if (track && track.torchFeature && track.torchFeature().isSupported()) {
        if (isFlashlightOn) {
          await track.torchFeature().apply(false);
          setIsFlashlightOn(false);
        } else {
          await track.torchFeature().apply(true);
          setIsFlashlightOn(true);
        }
      } else {
        toast({
          title: "Фонарик не поддерживается",
          description: "Ваше устройство не поддерживает фонарик",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Flashlight error:", err);
      toast({
        title: "Ошибка фонарика",
        description: "Не удалось переключить фонарик",
        variant: "destructive",
      });
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupScanner();
    };
  }, []);

  // Detect iframe on mount
  useEffect(() => {
    try {
      setIsInIframe(window.self !== window.top);
    } catch {
      setIsInIframe(true);
    }
  }, []);

  // -------------------- MANUAL CODE --------------------
  const addManualCode = () => {
    const code = manualCode.trim();
    if (!code) return;

    const wasAdded = addCodeSafely(code);
    
    if (wasAdded) {
      setManualCode("");
      toast({
        title: "Штрих-код добавлен",
        description: code,
      });
    } else {
      toast({
        title: "Дубликат",
        description: "Этот штрих-код уже был добавлен",
        variant: "destructive",
      });
    }
  };

  const removeCode = (codeToRemove: string) => {
    setCodes(prev => prev.filter(code => code !== codeToRemove));
    // Также удаляем из Set обработанных кодов
    processedCodesRef.current.delete(codeToRemove.toUpperCase());
  };

  const clearAllCodes = () => {
    setCodes([]);
    // Очищаем Set обработанных кодов
    processedCodesRef.current.clear();
    lastScannedCodeRef.current = "";
    lastScanTimeRef.current = 0;
    
    toast({
      title: "Список очищен",
      description: "Все штрих-коды удалены",
    });
  };

  // -------------------- PRICE --------------------
  const totalPrice = weight && pricePerKg ? parseFloat(weight) * parseFloat(pricePerKg) : 0;

  // -------------------- WHATSAPP --------------------
  const whatsappMessage = clientData && template
    ? template
        .replace("{customerId}", clientData.client_code)
        .replace("{codesList}", codes.map((c, i) => `${i + 1}. ${c}`).join("\n"))
        .replace("{codesCount}", codes.length.toString())
        .replace("{weight}", weight || "0")
        .replace("{totalPrice}", totalPrice.toString())
        .replace("{address}", pvzMap[pvz] || pvz)
    : "";

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(whatsappMessage);
      toast({
        title: "Скопировано",
        description: "Сообщение скопировано в буфер",
      });
    } catch (err) {
      toast({
        title: "Ошибка",
        description: "Не удалось скопировать",
        variant: "destructive",
      });
    }
  };

  const openWhatsApp = () => {
    if (!clientData) return;
    const phone = clientData.phone.replace(/\D/g, "");
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(whatsappMessage)}`;
    window.open(url, "_blank");
  };

  return (
    <div className="container mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold text-center">Сканер посылок</h1>

      {/* ПВЗ */}
      <Card>
        <CardHeader>
          <CardTitle>Выбор ПВЗ</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={pvz} onValueChange={setPvz}>
            <SelectTrigger>
              <SelectValue placeholder="Выберите ПВЗ" />
            </SelectTrigger>
            <SelectContent>
              {pvzLocations.map((location) => (
                <SelectItem key={location.id} value={location.code}>
                  {location.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Сканер */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Сканирование штрих-кодов</span>
            {isScanning && (
              <span className="text-sm font-normal text-green-600 animate-pulse">
                ● Сканирую...
              </span>
            )}
            {isCameraLoading && (
              <span className="text-sm font-normal text-yellow-600">
                ⏳ Загрузка камеры...
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {/* Кнопки управления камерой */}
            <div className="flex gap-2">
              <Button
                onClick={toggleCamera}
                variant={isScanning ? "destructive" : "default"}
                disabled={isCameraLoading}
                className="flex-1"
              >
                {isCameraLoading ? (
                  "Загрузка..."
                ) : isScanning ? (
                  <>
                    <CameraOff className="h-4 w-4 mr-2" />
                    Остановить
                  </>
                ) : (
                  <>
                    <Camera className="h-4 w-4 mr-2" />
                    Открыть камеру
                  </>
                )}
              </Button>

              {/* Кнопка фонарика */}
              {isScanning && (
                <Button
                  onClick={toggleFlashlight}
                  variant={isFlashlightOn ? "secondary" : "outline"}
                  size="icon"
                  className="shrink-0"
                >
                  {isFlashlightOn ? (
                    <FlashlightOff className="h-5 w-5" />
                  ) : (
                    <Flashlight className="h-5 w-5" />
                  )}
                </Button>
              )}
            </div>

            {/* Сообщения об ошибках */}
            {(cameraError || isInIframe) && (
              <div className="p-3 bg-destructive/10 border border-destructive rounded-lg">
                <p className="text-destructive font-medium text-sm">
                  Не удалось запустить камеру
                </p>
                <p className="text-destructive text-xs mt-1">
                  {cameraError || "Режим предпросмотра блокирует камеру. Откройте приложение в новой вкладке."}
                </p>
              </div>
            )}

            {/* Область сканирования */}
            {(isScanning || isCameraLoading) && (
              <div className="rounded-lg overflow-hidden bg-black">
                <div 
                  id={scannerDivId} 
                  className="w-full"
                  style={{ minHeight: '280px' }}
                />
              </div>
            )}
          </div>

          {/* Ввод вручную */}
          <div className="flex gap-2">
            <Input
              placeholder="Введите штрих-код вручную"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addManualCode()}
              className="flex-1"
            />
            <Button onClick={addManualCode} size="icon">
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Список отсканированных кодов */}
          {codes.length > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">
                  Уникальных кодов: {codes.length} шт
                </span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={clearAllCodes}
                >
                  Очистить все
                </Button>
              </div>
              <div className="max-h-40 overflow-y-auto space-y-2">
                {codes.map((code, index) => (
                  <div
                    key={`${code}-${index}`}
                    className="flex items-center justify-between bg-secondary p-2 rounded-lg"
                  >
                    <span className="font-mono text-sm">{code}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeCode(code)}
                      className="h-6 w-6"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Клиент */}
      <Card>
        <CardHeader>
          <CardTitle>Клиент</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="Введите ID клиента"
          />
          {clientData && (
            <div className="p-3 bg-muted rounded-lg space-y-2">
              <p className="font-medium">Имя: {clientData.full_name}</p>
              <p className="text-sm">Телефон: {clientData.phone}</p>
              <p className="text-sm font-mono">Клиент-код: {clientData.client_code}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Цена */}
      <Card>
        <CardHeader>
          <CardTitle>Стоимость</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            type="number"
            placeholder="Вес (кг)"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
          <Select value={pricePerKg} onValueChange={setPricePerKg}>
            <SelectTrigger>
              <SelectValue placeholder="Цена за кг" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="230">230 сом/кг</SelectItem>
              <SelectItem value="240">240 сом/кг</SelectItem>
            </SelectContent>
          </Select>
          {weight && (
            <div className="p-3 bg-primary/10 rounded-lg">
              <p className="text-xl font-bold text-center">
                Итого: {totalPrice} сом
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* WhatsApp */}
      {clientData && codes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Отправка клиенту</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 bg-muted rounded-lg">
              <pre className="whitespace-pre-wrap text-sm">{whatsappMessage}</pre>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button onClick={copyToClipboard} variant="outline">
                <Copy className="h-4 w-4 mr-2" />
                Копировать
              </Button>
              <Button onClick={openWhatsApp}>
                <MessageCircle className="h-4 w-4 mr-2" />
                WhatsApp
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
      }
