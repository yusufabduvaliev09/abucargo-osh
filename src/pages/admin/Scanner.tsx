import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Camera, Plus, Copy, MessageCircle, Trash2, CameraOff, Save } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";

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

// Дефолтный шаблон сообщения
const DEFAULT_MESSAGE_TEMPLATE = `Здравствуйте, уважаемый(ая) {client_code} 📦

Ваши посылки прибыли:
{codes_list}

({codes_count} шт)
Вес: {weight} кг
Итого: {total_price} сом
Адрес: {pvz_address}
График: 9:00–21:00
Оплата: Мбанк 552820112 (ДИЛНОЗА)
Забрать в течение 5 дней.`;

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
  const [isInIframe, setIsInIframe] = useState(false);
  const [messageTemplate, setMessageTemplate] = useState(DEFAULT_MESSAGE_TEMPLATE);
  const [isTemplateLoading, setIsTemplateLoading] = useState(false);

  const qrScannerRef = useRef<Html5Qrcode | null>(null);
  const scannerDivId = "qr-reader";
  
  // Рефы для предотвращения дублирования
  const lastScannedCodeRef = useRef<string>("");
  const lastScanTimeRef = useRef<number>(0);
  const scanCooldownRef = useRef<number>(800);
  const processedCodesRef = useRef<Set<string>>(new Set());

  const { toast } = useToast();

  // Загрузка шаблона сообщения при монтировании
  useEffect(() => {
    loadMessageTemplate();
  }, []);

  const loadMessageTemplate = async () => {
    try {
      const { data, error } = await supabase
        .from("message_templates")
        .select("template")
        .eq("name", "delivery_notification")
        .single();

      if (error) {
        console.log("Используется дефолтный шаблон");
        return;
      }

      if (data?.template) {
        setMessageTemplate(data.template);
      }
    } catch (error) {
      console.error("Ошибка загрузки шаблона:", error);
    }
  };

  const saveMessageTemplate = async () => {
    setIsTemplateLoading(true);
    try {
      const { error } = await supabase
        .from("message_templates")
        .upsert({
          name: "delivery_notification",
          template: messageTemplate,
          updated_at: new Date().toISOString()
        });

      if (error) {
        throw error;
      }

      toast({
        title: "Шаблон сохранен",
        description: "Сообщение успешно обновлено",
      });
    } catch (error) {
      console.error("Ошибка сохранения шаблона:", error);
      toast({
        title: "Ошибка сохранения",
        description: "Не удалось сохранить шаблон",
        variant: "destructive",
      });
    } finally {
      setIsTemplateLoading(false);
    }
  };

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
    
    if (processedCodesRef.current.has(normalizedCode)) {
      console.log("Код уже был отсканирован:", normalizedCode);
      return false;
    }

    const now = Date.now();
    const timeSinceLastScan = now - lastScanTimeRef.current;

    if (normalizedCode === lastScannedCodeRef.current && timeSinceLastScan < scanCooldownRef.current) {
      console.log("Повторное сканирование слишком быстро:", normalizedCode);
      return false;
    }

    processedCodesRef.current.add(normalizedCode);
    lastScannedCodeRef.current = normalizedCode;
    lastScanTimeRef.current = now;

    setCodes(prev => {
      if (prev.includes(normalizedCode)) {
        return prev;
      }
      return [...prev, normalizedCode];
    });

    return true;
  };

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
        formatsToSupport: BARCODE_FORMATS
      });
      qrScannerRef.current = html5Qr;

      const config = {
        fps: 25,
        qrbox: { width: 300, height: 150 },
        aspectRatio: 1.7777778,
        disableFlip: false
      };

      await html5Qr.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
          const wasAdded = addCodeSafely(decodedText);
          
          if (wasAdded) {
            if (navigator.vibrate) {
              navigator.vibrate(50);
            }
            
            toast({
              title: "✓ Штрих-код добавлен",
              description: decodedText,
            });
          }
        },
        (error) => {
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

  useEffect(() => {
    return () => {
      cleanupScanner();
    };
  }, []);

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
    processedCodesRef.current.delete(codeToRemove.toUpperCase());
  };

  const clearAllCodes = () => {
    setCodes([]);
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

  // -------------------- WHATSAPP MESSAGE --------------------
  const generateMessage = () => {
    if (!clientData) return "";

    const codesList = codes.map((c, i) => `${i + 1}. ${c}`).join("\n");
    
    return messageTemplate
      .replace(/{client_code}/g, clientData.client_code)
      .replace(/{codes_list}/g, codesList)
      .replace(/{codes_count}/g, codes.length.toString())
      .replace(/{weight}/g, weight)
      .replace(/{total_price}/g, totalPrice.toString())
      .replace(/{pvz_address}/g, PVZ_ADDRESSES[pvz])
      .replace(/{client_name}/g, clientData.full_name)
      .replace(/{client_phone}/g, clientData.phone);
  };

  const whatsappMessage = generateMessage();

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

      <Tabs defaultValue="scanner" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="scanner">Сканер</TabsTrigger>
          <TabsTrigger value="message">Сообщение</TabsTrigger>
          <TabsTrigger value="template">Шаблон</TabsTrigger>
        </TabsList>

        <TabsContent value="scanner" className="space-y-4">
          {/* ПВЗ */}
          <Card>
            <CardHeader>
              <CardTitle>Выбор ПВЗ</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={pvz} onValueChange={(v) => setPvz(v as PvzLocation)}>
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
                <Button
                  onClick={toggleCamera}
                  variant={isScanning ? "destructive" : "default"}
                  disabled={isCameraLoading}
                  className="w-full"
                >
                  {isCameraLoading ? (
                    "Загрузка..."
                  ) : isScanning ? (
                    <>
                      <CameraOff className="h-4 w-4 mr-2" />
                      Остановить камеру
                    </>
                  ) : (
                    <>
                      <Camera className="h-4 w-4 mr-2" />
                      Открыть камеру
                    </>
                  )}
                </Button>

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

                {(isScanning || isCameraLoading) && (
                  <div className="border-2 border-primary rounded-lg overflow-hidden bg-black">
                    <div 
                      id={scannerDivId} 
                      className="w-full"
                      style={{ minHeight: '250px' }}
                    />
                    <div className="p-3 bg-primary/10 text-center text-sm">
                      <p className="text-primary font-medium">
                        Наведите камеру на штрих-код
                      </p>
                      <p className="text-muted-foreground text-xs mt-1">
                        CODE_128, CODE_39, EAN_13
                      </p>
                    </div>
                  </div>
                )}
              </div>

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
                  <SelectItem value="250">250 сом/кг</SelectItem>
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
        </TabsContent>

        <TabsContent value="message" className="space-y-4">
          {clientData && codes.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Предпросмотр сообщения</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
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
          ) : (
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-muted-foreground">
                  Для просмотра сообщения отсканируйте коды и выберите клиента
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="template" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Редактирование шаблона сообщения</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Используйте переменные в фигурных скобках для автоматической подстановки:
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <code className="bg-secondary p-1 rounded">{"{client_code}"}</code>
                  <code className="bg-secondary p-1 rounded">{"{client_name}"}</code>
                  <code className="bg-secondary p-1 rounded">{"{codes_list}"}</code>
                  <code className="bg-secondary p-1 rounded">{"{codes_count}"}</code>
                  <code className="bg-secondary p-1 rounded">{"{weight}"}</code>
                  <code className="bg-secondary p-1 rounded">{"{total_price}"}</code>
                  <code className="bg-secondary p-1 rounded">{"{pvz_address}"}</code>
                  <code className="bg-secondary p-1 rounded">{"{client_phone}"}</code>
                </div>
              </div>
              
              <Textarea
                value={messageTemplate}
                onChange={(e) => setMessageTemplate(e.target.value)}
                rows={12}
                className="font-mono text-sm"
                placeholder="Введите шаблон сообщения..."
              />
              
              <Button 
                onClick={saveMessageTemplate} 
                disabled={isTemplateLoading}
                className="w-full"
              >
                {isTemplateLoading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                    Сохранение...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Сохранить шаблон
                  </>
                )}
              </Button>

              <Button 
                variant="outline" 
                onClick={() => setMessageTemplate(DEFAULT_MESSAGE_TEMPLATE)}
                className="w-full"
              >
                Сбросить к стандартному
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
    }
