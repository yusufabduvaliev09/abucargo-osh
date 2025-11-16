import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Camera, Plus, Copy, MessageCircle, Trash2 } from "lucide-react";
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

export default function Scanner() {
  const { toast } = useToast();

  const [pvz, setPvz] = useState<PvzLocation>("nariman");
  const [codes, setCodes] = useState<string[]>([]);
  const [manualCode, setManualCode] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientData, setClientData] = useState<ClientProfile | null>(null);
  const [weight, setWeight] = useState("");
  const [pricePerKg, setPricePerKg] = useState("250");

  const [isScanning, setIsScanning] = useState(false);
  const [scanner, setScanner] = useState<Html5Qrcode | null>(null);

  const [lastScannedCode, setLastScannedCode] = useState("");
  const [lastScanTime, setLastScanTime] = useState(0);

  // Генерация клиентского кода
  const getClientCode = (id: string, pvzLocation: PvzLocation): string => {
    const prefix =
      pvzLocation === "nariman"
        ? "YQ"
        : pvzLocation === "zhiydalik"
        ? "YX"
        : "JL";
    return `${prefix}${id}`;
  };

  // Загрузка профиля клиента
  const fetchClientData = async (id: string) => {
    if (!id.trim()) return setClientData(null);

    const code = getClientCode(id, pvz);

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("client_code", code)
      .single();

    if (error || !data) {
      toast({
        title: "Ошибка",
        description: "Клиент не найден",
        variant: "destructive"
      });
      return setClientData(null);
    }

    setClientData(data);
  };

  useEffect(() => {
    if (clientId) fetchClientData(clientId);
  }, [clientId, pvz]);

  // Старт камеры
  const startScanning = async () => {
    try {
      if (isScanning) return;

      // Очистка прошлой камеры
      const oldDiv = document.getElementById("reader");
      if (oldDiv) oldDiv.innerHTML = "";

      const qr = new Html5Qrcode("reader", { verbose: false });
      setScanner(qr);

      await qr.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (text) => {
          const now = Date.now();

          if (text !== lastScannedCode || now - lastScanTime > 2500) {
            if (!codes.includes(text)) {
              setCodes((prev) => [...prev, text]);
              setLastScannedCode(text);
              setLastScanTime(now);
              toast({ title: "Добавлен трек-код", description: text });
            }
          }
        }
      );

      setIsScanning(true);
    } catch (e) {
      console.log(e);
      toast({
        title: "Ошибка",
        description: "Не удалось открыть камеру. Разрешите доступ или перезапустите страницу.",
        variant: "destructive"
      });
    }
  };

  // Остановка камеры
  const stopScanning = async () => {
    try {
      if (scanner) {
        await scanner.stop();
        scanner.clear();
      }
    } catch (err) {
      console.log("Ошибка остановки камеры", err);
    }

    setScanner(null);
    setIsScanning(false);
  };

  useEffect(() => {
    return () => {
      if (scanner) {
        scanner.stop().catch(() => {});
        scanner.clear();
      }
    };
  }, []);

  // Добавление трек-кода вручную
  const addManualCode = () => {
    if (!manualCode.trim()) return;
    if (codes.includes(manualCode.trim())) return;

    setCodes((prev) => [...prev, manualCode.trim()]);
    toast({ title: "Добавлен трек-код", description: manualCode });
    setManualCode("");
  };

  // Удаление
  const removeCode = (code: string) => {
    setCodes(codes.filter((c) => c !== code));
  };

  const totalPrice =
    weight && pricePerKg
      ? parseFloat(weight) * parseFloat(pricePerKg)
      : 0;

  const whatsappMessage = clientData
    ? `Здравствуйте, уважаемый(ая) ${clientData.client_code} 📦
Ваши посылки прибыли с трек-кодами:
${codes.map((c, i) => `${i + 1}. ${c}`).join("\n")}
(${codes.length} шт)
⚖️ Вес: ${weight} кг
💰 Стоимость: ${totalPrice.toFixed(2)} сом
📍 Адрес ПВЗ: ${PVZ_ADDRESSES[pvz]}
⏰ Время работы: 9:00–21:00
💳 Оплата: Мбанк 552820112 (Дилноза А)
После оплаты отправьте чек.
С уважением, ABU Cargo ❤️`
    : "";

  const copyMessage = () => {
    navigator.clipboard.writeText(whatsappMessage);
    toast({ title: "Скопировано" });
  };

  const openWhatsApp = () => {
    if (!clientData) return;
    const phone = clientData.phone.replace(/\D/g, "");
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(whatsappMessage)}`);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Сканер посылок</h1>

      {/* --- Выбор ПВЗ --- */}
      <Card>
        <CardHeader><CardTitle>Выберите ПВЗ</CardTitle></CardHeader>
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

      {/* --- Камера --- */}
      <Card>
        <CardHeader><CardTitle>Сканирование</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {isScanning && (
            <div className="border p-4 bg-muted rounded">
              <div id="reader" />
            </div>
          )}

          {!isScanning ? (
            <Button onClick={startScanning}>
              <Camera className="w-4 h-4 mr-2" /> Открыть камеру
            </Button>
          ) : (
            <Button variant="destructive" onClick={stopScanning}>
              Остановить камеру
            </Button>
          )}

          {/* Ввод вручную */}
          <Input
            placeholder="Введите трек-код"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addManualCode()}
          />
          <Button onClick={addManualCode} className="w-full">
            <Plus className="w-4 h-4 mr-2" /> Добавить
          </Button>

          {/* Вывод кодов */}
          {codes.map((c) => (
            <div key={c} className="flex justify-between bg-muted p-2 rounded">
              <span>{c}</span>
              <Button variant="ghost" size="icon" onClick={() => removeCode(c)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Данные клиента */}
      <Card>
        <CardHeader><CardTitle>Клиент</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input
            type="number"
            placeholder="ID клиента (например 11)"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          />

          {clientData && (
            <div className="bg-muted p-3 rounded">
              <p><b>Имя:</b> {clientData.full_name}</p>
              <p><b>Телефон:</b> {clientData.phone}</p>
              <p><b>Код:</b> {clientData.client_code}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Вес и цена */}
      <Card>
        <CardHeader><CardTitle>Расчёт</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input
            type="number"
            step="0.01"
            placeholder="Вес (кг)"
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
            <div className="p-3 bg-primary/10 rounded text-xl font-bold">
              Итого: {totalPrice.toFixed(2)} сом
            </div>
          )}
        </CardContent>
      </Card>

      {/* Сообщение */}
      {clientData && codes.length > 0 && weight && (
        <Card>
          <CardHeader><CardTitle>Отправка</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <pre className="whitespace-pre-wrap bg-muted p-3 rounded text-sm">
              {whatsappMessage}
            </pre>

            <div className="flex gap-2">
              <Button onClick={copyMessage} variant="outline" className="flex-1">
                <Copy className="w-4 h-4 mr-2" /> Скопировать
              </Button>
              <Button onClick={openWhatsApp} className="flex-1">
                <MessageCircle className="w-4 h-4 mr-2" /> WhatsApp
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
    }
