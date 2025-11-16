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
  const [pvz, setPvz] = useState<PvzLocation>("nariman");
  const [codes, setCodes] = useState<string[]>([]);
  const [manualCode, setManualCode] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientData, setClientData] = useState<ClientProfile | null>(null);
  const [weight, setWeight] = useState("");
  const [pricePerKg, setPricePerKg] = useState("250");
  const [isScanning, setIsScanning] = useState(false);
  const [qrScanner, setQrScanner] = useState<Html5Qrcode | null>(null);
  const { toast } = useToast();

  // Очистка прошлых сессий камеры (ОЧЕНЬ ВАЖНО!)
  const cleanupScanner = async () => {
    try {
      await Html5Qrcode.cleanup();
    } catch {}
  };

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

  // ЗАПУСК КАМЕРЫ
  const startScanning = async () => {
    try {
      await cleanupScanner();

      const elementId = "reader";

      const html5Qr = new Html5Qrcode(elementId);
      setQrScanner(html5Qr);

      await html5Qr.start(
        { facingMode: "environment" }, // всегда задняя камера
        { fps: 10, qrbox: { width: 250, height: 250 } },

        (decoded) => {
          if (!codes.includes(decoded)) {
            setCodes((prev) => [...prev, decoded]);
            toast({
              title: "Трек-код добавлен",
              description: decoded,
            });
          }
        },

        (err) => {
          console.warn("Ошибка QR:", err);
        }
      );

      setIsScanning(true);

    } catch (err) {
      console.error(err);
      toast({
        title: "Ошибка камеры",
        description: "Не удалось открыть камеру",
        variant: "destructive",
      });
    }
  };

  // ОСТАНОВКА КАМЕРЫ
  const stopScanning = async () => {
    try {
      if (qrScanner) {
        await qrScanner.stop();
        await cleanupScanner();
        setQrScanner(null);
      }
      setIsScanning(false);
    } catch (err) {
      console.error("Ошибка остановки камеры:", err);
    }
  };

  const addManualCode = () => {
    const code = manualCode.trim();
    if (code && !codes.includes(code)) {
      setCodes((prev) => [...prev, code]);
      toast({
        title: "Трек-код добавлен",
        description: code,
      });
    }
    setManualCode("");
  };

  const removeCode = (code: string) => {
    setCodes((prev) => prev.filter((c) => c !== code));
  };

  const totalPrice = weight && pricePerKg ? Number(weight) * Number(pricePerKg) : 0;

  const whatsappMessage = clientData
    ? `Здравствуйте, уважаемый(ая) ${clientData.client_code} 📦
Ваши посылки прибыли:
${codes.map((c, i) => `${i + 1}. ${c}`).join("\n")}
(${codes.length} шт)
Вес: ${weight} кг
Сумма: ${totalPrice} сом
Адрес: ${PVZ_ADDRESSES[pvz]}
График: 9:00–21:00
Оплата: Мбанк 552820112 (ДИЛНОЗА)
Забрать в течение 5 дней.`
    : "";

  const copyMessage = () => {
    navigator.clipboard.writeText(whatsappMessage);
    toast({
      title: "Скопировано",
      description: "Сообщение скопировано",
    });
  };

  const openWhatsApp = () => {
    if (!clientData) return;
    const phone = clientData.phone.replace(/\D/g, "");
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(whatsappMessage)}`;
    window.open(url, "_blank");
  };

  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, []);

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

      {/* СКАНЕР */}
      <Card>
        <CardHeader><CardTitle>Сканирование</CardTitle></CardHeader>
        <CardContent className="space-y-4">

          {isScanning && (
            <div className="border p-2 bg-muted rounded">
              <div id="reader" className="w-full"></div>
            </div>
          )}

          {!isScanning ? (
            <Button onClick={startScanning}>
              <Camera className="h-4 w-4 mr-2" />
              Включить камеру
            </Button>
          ) : (
            <Button variant="destructive" onClick={stopScanning}>
              Остановить камеру
            </Button>
          )}

          <Input
            placeholder="Введите трек-код вручную"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addManualCode()}
          />
          <Button onClick={addManualCode}>Добавить</Button>

          {codes.map((code) => (
            <div key={code} className="flex justify-between bg-muted p-2 rounded">
              {code}
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
        <CardContent className="space-y-3">
          <Input
            placeholder="ID клиента"
            type="number"
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

      {/* Цена */}
      <Card>
        <CardHeader><CardTitle>Вес и цена</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input
            type="number"
            placeholder="Вес"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
          <Select value={pricePerKg} onValueChange={setPricePerKg}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="250">250 сом</SelectItem>
              <SelectItem value="240">240 сом</SelectItem>
            </SelectContent>
          </Select>

          {weight && (
            <p className="font-bold text-xl">Итого: {totalPrice} сом</p>
          )}
        </CardContent>
      </Card>

      {/* УВЕДОМЛЕНИЕ */}
      {clientData && codes.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Отправка</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <pre className="bg-muted p-3 rounded whitespace-pre-wrap">
              {whatsappMessage}
            </pre>

            <Button onClick={copyMessage} variant="outline">
              <Copy className="h-4 w-4 mr-2" /> Скопировать
            </Button>

            <Button onClick={openWhatsApp}>
              <MessageCircle className="h-4 w-4 mr-2" /> WhatsApp
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
        }
