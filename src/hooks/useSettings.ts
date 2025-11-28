import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Settings {
  companyName: string;
  logoUrl: string;
  primaryColor: string;
  pricePerKg: number;
}

interface PvzLocation {
  id: string;
  code: string;
  name: string;
  address: string | null;
  is_active: boolean | null;
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>({
    companyName: "AbuCargo",
    logoUrl: "",
    primaryColor: "#10b981",
    pricePerKg: 12,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase
        .from("settings")
        .select("*")
        .single();

      if (data) {
        setSettings({
          companyName: data.company_name || "AbuCargo",
          logoUrl: data.logo_url || "",
          primaryColor: data.primary_color || "#10b981",
          pricePerKg: data.price_per_kg || 12,
        });
      }
      setLoading(false);
    };

    fetchSettings();

    // Подписка на изменения настроек
    const channel = supabase
      .channel("settings-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "settings" },
        (payload) => {
          if (payload.new) {
            const data = payload.new as any;
            setSettings({
              companyName: data.company_name || "AbuCargo",
              logoUrl: data.logo_url || "",
              primaryColor: data.primary_color || "#10b981",
              pricePerKg: data.price_per_kg || 12,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { settings, loading };
}

export function usePvzLocations() {
  const [pvzLocations, setPvzLocations] = useState<PvzLocation[]>([]);
  const [pvzMap, setPvzMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPvz = async () => {
      const { data } = await supabase
        .from("pvz_locations_config")
        .select("*")
        .eq("is_active", true)
        .order("code");

      if (data) {
        setPvzLocations(data);
        const map: Record<string, string> = {};
        data.forEach((pvz) => {
          map[pvz.code] = pvz.name;
        });
        setPvzMap(map);
      }
      setLoading(false);
    };

    fetchPvz();

    // Подписка на изменения ПВЗ
    const channel = supabase
      .channel("pvz-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pvz_locations_config" },
        () => {
          fetchPvz();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { pvzLocations, pvzMap, loading };
}
