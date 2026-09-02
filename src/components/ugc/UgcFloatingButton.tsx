"use client";

import {
  useEffect,
  useState,
} from "react";

export default function UgcFloatingButton() {
  const [
    open,
    setOpen,
  ] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (
      event: KeyboardEvent
    ) => {
      if (
        event.key ===
        "Escape"
      ) {
        setOpen(false);
      }
    };

    window.addEventListener(
      "keydown",
      onKeyDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        onKeyDown
      );
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() =>
          setOpen(true)
        }
        aria-label="Conheça o programa de criadoras Bio Florais"
        className="
          fixed
          bottom-5
          right-5
          z-50
          flex
          items-center
          gap-3
          rounded-full
          border
          border-white/60
          bg-white/95
          px-5
          py-3
          shadow-xl
          backdrop-blur
          transition
          hover:-translate-y-1
          hover:shadow-2xl
        "
      >
        <span
          className="
            flex
            h-9
            w-9
            items-center
            justify-center
            rounded-full
            bg-[#f5edf6]
            text-[#b52867]
          "
        >
          ✦
        </span>

        <span
          className="
            text-left
          "
        >
          <span
            className="
              block
              text-[9px]
              font-extrabold
              uppercase
              tracking-[0.16em]
              text-[#b52867]
            "
          >
            Seja uma criadora
          </span>

          <span
            className="
              block
              text-xs
              font-extrabold
              text-[#342737]
            "
          >
            Crie e ganhe
          </span>
        </span>
      </button>


      {open && (
        <div
          className="
            fixed
            inset-0
            z-[100]
            flex
            items-center
            justify-center
            bg-black/45
            p-4
            backdrop-blur-sm
          "
          onMouseDown={() =>
            setOpen(false)
          }
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Comunidade Bio Florais"
            onMouseDown={(
              event
            ) =>
              event.stopPropagation()
            }
            className="
              relative
              max-h-[92vh]
              w-full
              max-w-[920px]
              overflow-y-auto
              rounded-[28px]
              border
              border-[#eddce5]
              bg-[#fffdfd]
              shadow-2xl
            "
          >

            <div
              className="
                relative
                border-b
                border-[#f1e2e9]
                bg-[#fff1f6]
                px-6
                py-5
                sm:px-8
              "
            >
              <button
                type="button"
                onClick={() =>
                  setOpen(false)
                }
                aria-label="Fechar"
                className="
                  absolute
                  right-6
                  top-5
                  text-lg
                  text-[#39283c]
                "
              >
                ×
              </button>

              <p
                className="
                  text-[10px]
                  font-extrabold
                  uppercase
                  tracking-[0.20em]
                  text-[#b52867]
                "
              >
                Comunidade Bio Florais
              </p>

              <h2
                className="
                  mt-1
                  font-serif
                  text-3xl
                  font-semibold
                  leading-none
                  text-[#34203b]
                "
              >
                Crie. Indique. Ganhe.
              </h2>

              <p
                className="
                  mt-2
                  text-sm
                  text-[#766978]
                "
              >
                Você pode criar conteúdo, indicar nossos produtos — ou fazer os dois.
              </p>
            </div>


            <div
              className="
                grid
                gap-4
                p-5
                sm:p-6
                md:grid-cols-2
              "
            >

              <section
                className="
                  flex
                  h-full
                  flex-col
                  rounded-[24px]
                  border
                  border-[#ead5e0]
                  bg-[#fffdfd]
                  p-6
                "
              >
                <div
                  className="
                    text-2xl
                    text-[#b52867]
                  "
                >
                  ✦
                </div>

                <p
                  className="
                    mt-4
                    text-[10px]
                    font-extrabold
                    uppercase
                    tracking-[0.18em]
                    text-[#b52867]
                  "
                >
                  Para quem cria conteúdo
                </p>

                <h3
                  className="
                    mt-1
                    font-serif
                    text-2xl
                    font-semibold
                    text-[#34203b]
                  "
                >
                  Seja uma Criadora
                </h3>

                <p
                  className="
                    mt-2
                    leading-6
                    text-[#776979]
                  "
                >
                  Mostre os produtos do seu jeito e transforme conteúdo em oportunidade.
                </p>

                <div
                  className="
                    mt-5
                    space-y-2
                    text-sm
                    leading-6
                    text-[#5f5361]
                  "
                >
                  <p>• Condições e descontos especiais</p>
                  <p>• Venda pelo seu carrinho na TikTok Shop</p>
                  <p>• Envie seus vídeos para nossos canais</p>
                  <p>• Divulgação do seu conteúdo e perfil</p>
                  <p>• Possibilidade de entrar para o time de LIVE</p>
                </div>

                <div className="h-5 shrink-0" />

                <button
                  type="button"
                  className="
                    mt-auto
                    w-full
                    rounded-full
                    bg-[#32183a]
                    px-6
                    py-4
                    text-sm
                    font-extrabold
                    text-white
                    transition
                    hover:-translate-y-0.5
                    hover:bg-[#44204d]
                  "
                >
                  Quero ser Criadora
                </button>
              </section>


              <section
                className="
                  flex
                  h-full
                  flex-col
                  rounded-[24px]
                  border
                  border-[#ead5e0]
                  bg-[#fffdfd]
                  p-6
                "
              >
                <div
                  className="
                    text-2xl
                    text-[#b52867]
                  "
                >
                  ♡
                </div>

                <p
                  className="
                    mt-4
                    text-[10px]
                    font-extrabold
                    uppercase
                    tracking-[0.18em]
                    text-[#b52867]
                  "
                >
                  Para quem ama indicar
                </p>

                <h3
                  className="
                    mt-1
                    font-serif
                    text-2xl
                    font-semibold
                    text-[#34203b]
                  "
                >
                  Indique e Ganhe
                </h3>

                <p
                  className="
                    mt-2
                    leading-6
                    text-[#776979]
                  "
                >
                  Crie seu cupom personalizado e compartilhe com amigos, clientes e seguidores.
                </p>

                <div
                  className="
                    mt-5
                    rounded-[18px]
                    bg-[#fff0f5]
                    p-4
                  "
                >
                  <p
                    className="
                      text-xs
                      font-bold
                      text-[#b52867]
                    "
                  >
                    Campanha atual
                  </p>

                  <p
                    className="
                      mt-1
                      font-bold
                      text-[#34203b]
                    "
                  >
                    10% de desconto com seu cupom
                  </p>

                  <p
                    className="
                      mt-1
                      text-xs
                      leading-5
                      text-[#796a78]
                    "
                  >
                    Condição vigente até 30/09. Pode ser combinada com promoções da loja.
                  </p>
                </div>

                <p
                  className="
                    mt-4
                    text-sm
                    leading-6
                    text-[#776979]
                  "
                >
                  Você acumula ganhos pelas vendas realizadas com seu cupom, conforme a campanha vigente.
                </p>

                <div className="h-5 shrink-0" />

                <button
                  type="button"
                  className="
                    mt-auto
                    w-full
                    rounded-full
                    bg-[#b52867]
                    px-6
                    py-4
                    text-sm
                    font-extrabold
                    text-white
                    transition
                    hover:-translate-y-0.5
                    hover:bg-[#9f2059]
                  "
                >
                  Quero criar meu cupom
                </button>
              </section>

            </div>


            <div
              className="
                border-t
                border-[#f0e2e9]
                px-6
                py-4
                text-center
                text-[11px]
                text-[#998898]
              "
            >
              Benefícios, descontos e comissões seguem as condições vigentes de cada campanha.
            </div>

          </div>
        </div>
      )}
    </>
  );
}


