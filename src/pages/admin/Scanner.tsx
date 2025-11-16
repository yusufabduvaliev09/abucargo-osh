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
const [pvz, setPvz] = useState("nariman");
const [codes, setCodes] = useState<string[]>([]);
const [manualCode, setManualCode] = useState("");
const [clientId, setClientId] = useState("");
const [clientData, setClientData] = useState<ClientProfile | null>(null);
const [weight, setWeight] = useState("");
const [pricePerKg, setPricePerKg] = useState("250");
const [isScanning, setIsScanning] = useState(false);
const [html5QrCode, setHtml5QrCode] = useState<Html5Qrcode | null>(null);
const [lastScannedCode, setLastScannedCode] = useState("");
const [lastScanTime, setLastScanTime] = useState(0);
const { toast } = useToast();

const getClientCode = (id: string, pvzLocation: PvzLocation): string => {
const prefix = pvzLocation === "nariman" ? "YQ" : pvzLocation === "zhiydalik" ? "YX" : "JL";
return ${prefix}${id};
};

const fetchClientData = async (id: string) => {
if (!id.trim()) {
setClientData(null);
return;
}

const clientCode = getClientCode(id, pvz); const { data, error } = await supabase .from("profiles") .select("*") .eq("client_code", clientCode) .single(); if (error) { toast({ title: "Ошибка", description: "Клиент не найден", variant: "destructive", }); setClientData(null); return; } setClientData(data); 

};

useEffect(() => {
if (clientId) {
fetchClientData(clientId);
}
}, [clientId, pvz]);

const startScanning = async () => {
try {
const qrCode = new Html5Qrcode("reader");
setHtml5QrCode(qrCode);

await qrCode.start( { facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 }, }, (decodedText) => { const now = Date.now(); // Проверка задержки 2.5 секунды между сканированиями if (decodedText !== lastScannedCode || now - lastScanTime > 2500) { if (!codes.includes(decodedText)) { setCodes((prev) => [...prev, decodedText]); setLastScannedCode(decodedText); setLastScanTime(now); toast({ title: "Трек-код добавлен", description: decodedText, }); } } }, () => {} ); setIsScanning(true); } catch (error) { toast({ title: "Ошибка", description: "Не удалось запустить камеру", variant: "destructive", }); } 

};

const stopScanning = async () => {
if (html5QrCode) {
try {
await html5QrCode.stop();
html5QrCode.clear();
setHtml5QrCode(null);
setIsScanning(false);
} catch (error) {
console.error("Error stopping scanner:", error);
}
}
};

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

const totalPrice = weight && pricePerKg ? parseFloat(weight) * parseFloat(pricePerKg) : 0;

const whatsappMessage = clientData
? Здравствуйте, уважаемый(ая) ${clientData.client_code} 📦 Ваши посылки прибыли с трек-кодами: ${codes.map((code, i) => ${i + 1}. ${code}).join("\n")} (${codes.length} шт) ⚖️ Вес посылок: ${weight} кг 💰 Стоимость: ${totalPrice.toFixed(2)} сом 📍 Адрес самовывоза: ${PVZ_ADDRESSES[pvz]} ⏰ График работы: 9:00 до 21:00 💳 Реквизиты для оплаты: Мбанк ДИЛНОЗА А: 552820112 После оплаты обязательно отправьте чек. 🧾 Важно❗ Забрать нужно в течение 5 дней, иначе хранение 20 сом/день. С уважением, команда ABU Cargo ❤️
: "";

const copyMessage = () => {
navigator.clipboard.writeText(whatsappMessage);
toast({
title: "Скопировано",
description: "Сообщение скопировано в буфер обмена",
});
};

const openWhatsApp = () => {
if (clientData) {
const phone = clientData.phone.replace(/\D/g, "");
const url = https://wa.me/${phone}?text=${encodeURIComponent(whatsappMessage)};
window.open(url, "_blank");
}
};

useEffect(() => {
return () => {
if (html5QrCode) {
html5QrCode.stop().catch(console.error);
}
};
}, [html5QrCode]);

return (


Сканер посылок <Card> <CardHeader> <CardTitle>Выбор ПВЗ</CardTitle> </CardHeader> <CardContent> <Select value={pvz} onValueChange={(value) => setPvz(value as PvzLocation)}> <SelectTrigger> <SelectValue /> </SelectTrigger> <SelectContent> <SelectItem value="nariman">Нариман</SelectItem> <SelectItem value="zhiydalik">Жыйдалик УПТК</SelectItem> <SelectItem value="dostuk">Достук</SelectItem> </SelectContent> </Select> </CardContent> </Card> <Card> <CardHeader> <CardTitle>Сканирование трек-кодов</CardTitle> </CardHeader> <CardContent className="space-y-4"> {isScanning && ( <div className="border-2 border-primary rounded-lg p-4 bg-muted/50"> <div id="reader" className="w-full" /> </div> )} <div className="flex gap-2"> {!isScanning ? ( <Button onClick={startScanning}> <Camera className="h-4 w-4 mr-2" /> Открыть камеру </Button> ) : ( <Button variant="destructive" onClick={stopScanning}> Остановить камеру </Button> )} </div> <div className="space-y-2"> <Input placeholder="Введите трек-код вручную" value={manualCode} onChange={(e) => setManualCode(e.target.value)} onKeyPress={(e) => e.key === "Enter" && addManualCode()} /> <Button onClick={addManualCode} className="w-full"> <Plus className="h-4 w-4 mr-2" /> Добавить </Button> </div> {codes.length > 0 && ( <div className="space-y-2"> <h3 className="font-semibold">Добавленные трек-коды ({codes.length}):</h3> {codes.map((code) => ( <div key={code} className="flex items-center justify-between p-2 bg-muted rounded"> <span className="font-mono">{code}</span> <Button variant="ghost" size="icon" onClick={() => removeCode(code)} > <Trash2 className="h-4 w-4" /> </Button> </div> ))} </div> )} </CardContent> </Card> <Card> <CardHeader> <CardTitle>Данные клиента</CardTitle> </CardHeader> <CardContent className="space-y-4"> <div className="space-y-2"> <label className="text-sm font-medium">ID клиента (например: 11)</label> <Input placeholder="11" value={clientId} onChange={(e) => setClientId(e.target.value)} type="number" /> {clientId && ( <p className="text-sm text-muted-foreground"> Полный код: {getClientCode(clientId, pvz)} </p> )} </div> {clientData && ( <div className="p-4 bg-muted rounded space-y-2"> <p><strong>Имя:</strong> {clientData.full_name}</p> <p><strong>Телефон:</strong> {clientData.phone}</p> <p><strong>Код клиента:</strong> {clientData.client_code}</p> <p><strong>ПВЗ:</strong> {PVZ_ADDRESSES[clientData.pvz_location as PvzLocation]}</p> </div> )} </CardContent> </Card> <Card> <CardHeader> <CardTitle>Вес и расчёт стоимости</CardTitle> </CardHeader> <CardContent className="space-y-4"> <div className="space-y-2"> <label className="text-sm font-medium">Вес (кг)</label> <Input type="number" step="0.01" placeholder="0.00" value={weight} onChange={(e) => setWeight(e.target.value)} /> </div> <div className="space-y-2"> <label className="text-sm font-medium">Цена за кг</label> <Select value={pricePerKg} onValueChange={setPricePerKg}> <SelectTrigger> <SelectValue /> </SelectTrigger> <SelectContent> <SelectItem value="250">250 сом/кг</SelectItem> <SelectItem value="240">240 сом/кг</SelectItem> </SelectContent> </Select> </div> {weight && ( <div className="p-4 bg-primary/10 rounded"> <p className="text-2xl font-bold"> Итого: {totalPrice.toFixed(2)} сом </p> </div> )} </CardContent> </Card> {clientData && codes.length > 0 && weight && ( <Card> <CardHeader> <CardTitle>Отправка уведомления</CardTitle> </CardHeader> <CardContent className="space-y-4"> <div className="p-4 bg-muted rounded whitespace-pre-wrap text-sm"> {whatsappMessage} </div> <div className="flex gap-2"> <Button onClick={copyMessage} variant="outline" className="flex-1"> <Copy className="h-4 w-4 mr-2" /> Скопировать сообщение </Button> <Button onClick={openWhatsApp} className="flex-1"> <MessageCircle className="h-4 w-4 mr-2" /> Отправить в WhatsApp </Button> </div> </CardContent> </Card> )} </div> 

);
  }
