"use client";

/**
 * "Instale no seu celular": passo a passo para Android e iPhone e, quando o navegador permite (Chrome no Android), o botão
 * "Instalar agora". Já instalado (abriu como app): só avisa.
 */

import { useEffect, useState } from "react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

export default function InstallApp() {
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [platform, setPlatform] = useState<"android" | "ios" | "other">("other");

  useEffect(() => {
    const ua = navigator.userAgent;

    setPlatform(/iPhone|iPad|iPod/i.test(ua) ? "ios" : /Android/i.test(ua) ? "android" : "other");
    setInstalled(window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true);

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallEvent);
    };
    const onInstalled = () => setInstalled(true);

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!installEvent) return;

    await installEvent.prompt();
    await installEvent.userChoice.catch(() => undefined);
    setInstallEvent(null);
  }

  const card = "rounded-[22px] border border-[#eadfd9] bg-white p-5";
  const step = "mt-2 list-decimal space-y-2 pl-5 text-sm leading-6 text-[#422347]";

  return (
    <div data-testid="instalar-app">
      {installed && (
        <p role="status" className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-900" data-testid="app-ja-instalado">
          Você já está usando o app. Para sair, use o botão “Sair” do menu.
        </p>
      )}

      {installEvent && !installed && (
        <button
          type="button"
          onClick={install}
          className="mt-4 inline-flex min-h-[48px] items-center justify-center rounded-full bg-[#55245f] px-6 text-base font-extrabold text-white"
          data-testid="instalar-agora"
        >
          Instalar agora
        </button>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className={`${card} ${platform === "android" ? "ring-2 ring-[#55245f]" : ""}`} data-testid="passo-android">
          <h2 className="text-lg font-extrabold text-[#55245f]">Android (Chrome)</h2>
          <ol className={step}>
            <li>
              Abra este painel no <strong>Chrome</strong> e entre com o seu e-mail e senha.
            </li>
            <li>
              Toque nos <strong>três pontinhos</strong> (⋮) no canto de cima.
            </li>
            <li>
              Toque em <strong>“Instalar app”</strong> (ou “Adicionar à tela inicial”).
            </li>
            <li>
              Confirme em <strong>“Instalar”</strong>. O ícone <strong>Bio Vendas</strong> aparece na tela do celular.
            </li>
          </ol>
        </section>

        <section className={`${card} ${platform === "ios" ? "ring-2 ring-[#55245f]" : ""}`} data-testid="passo-iphone">
          <h2 className="text-lg font-extrabold text-[#55245f]">iPhone (Safari)</h2>
          <ol className={step}>
            <li>
              Abra este painel no <strong>Safari</strong> (não funciona pelo Chrome do iPhone) e entre com o seu e-mail e senha.
            </li>
            <li>
              Toque no botão <strong>Compartilhar</strong> (o quadrado com a seta para cima), embaixo da tela.
            </li>
            <li>
              Role a lista e toque em <strong>“Adicionar à Tela de Início”</strong>.
            </li>
            <li>
              Confirme o nome <strong>Bio Vendas</strong> e toque em <strong>“Adicionar”</strong>.
            </li>
          </ol>
        </section>
      </div>

      <section className={`${card} mt-4`}>
        <h2 className="text-lg font-extrabold text-[#55245f]">Como funciona</h2>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 text-[#422347]">
          <li>Abre em tela cheia, como um app, direto no seu painel.</li>
          <li>
            Marque <strong>“Manter conectado”</strong> ao entrar: o celular lembra de você por 30 dias, sem pedir a senha toda hora.
          </li>
          <li>
            Para encerrar o acesso (por exemplo, se emprestar o celular), toque em <strong>“Sair”</strong> no menu.
          </li>
          <li>É preciso internet: o app não guarda dados de clientes no celular.</li>
        </ul>
      </section>
    </div>
  );
}
