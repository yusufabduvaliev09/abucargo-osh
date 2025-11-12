import React, { useEffect } from "react";

const Index = () => {
  useEffect(() => {
    // Регистрация service worker при загрузке страницы
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/service-worker.js")
          .then(() => console.log("Service Worker зарегистрирован"))
          .catch((err) => console.error("Ошибка регистрации Service Worker:", err));
      });
    }
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">AbuCargo</h1>
        <p className="text-xl text-muted-foreground">
          Веб-приложение готово к установке (PWA, без адресной строки).
        </p>
        <p className="mt-4 text-sm text-gray-500">
          Добавьте сайт на главный экран, чтобы использовать как приложение.
        </p>
      </div>
    </div>
  );
};

export default Index;
