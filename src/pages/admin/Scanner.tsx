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

      const permissions = await navigator.mediaDevices.getUserMedia({ video: true });
      if (!permissions) {
        toast({
          title: "Ошибка",
          description: "Нет доступа к камере",
          variant: "destructive",
        });
        return;
      }

      const scanner = new Html5Qrcode(readerId, {
        formatsToSupport: [Html5QrcodeSupportedFormats.CODE_128, Html5QrcodeSupportedFormats.QR_CODE],
      });

      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          const now = Date.now();

          if (decodedText !== lastScannedCode || now - lastScanTime > 2500) {
            if (!codes.includes(decodedText)) {
              setCodes((prev) => [...prev, decodedText]);
              setLastScannedCode(decodedText);
              setLastScanTime(now);

              toast({
                title: "Трек-код добавлен",
                description: decodedText,
              });
            }
          }
        }
      );

      setIsScanning(true);
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось открыть камеру",
        variant: "destructive",
      });
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
        <CardHeader><CardTitle>Сканирование трек-кодов</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {isScanning && (
            <div className="border-2 border-primary rounded-lg p-4 bg-muted/50">
              <div id={readerId} className="w-full" />
            </div>
          )}

          {!isScanning ? (
            <Button onClick={startScanning}>
              <Camera className="h-4 w-4 mr-2" /> Открыть камеру
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
