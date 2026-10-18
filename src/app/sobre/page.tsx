import type { Metadata } from "next";

import InfoPage from "@/components/layout/InfoPage";

export const metadata: Metadata = {
  title: "Conheça a Bio Florais | Desde 1997",
  description: "Bio Florais: desde 1997, florais com flores frescas brasileiras e fórmulas sem álcool para diferentes momentos da vida.",
  alternates: { canonical: "/sobre" },
};

/* TEXTO INICIAL — o Luis deve revisar e substituir pelo conteúdo institucional oficial da marca. */
export default function Page() {
  return (
    <InfoPage
      title="Conheça a Bio Florais"
      intro="Desde 1997, a Bio Florais cria florais e cosméticos com flores frescas brasileiras e fórmulas sem álcool, para acompanhar diferentes momentos da vida."
      contact={false}
      sections={[
        {
          heading: "Nossa história",
          paragraphs: [
            "A Bio Florais nasceu em 1997 com uma ideia simples: cuidar do equilíbrio emocional de forma natural, respeitando a natureza e a rotina de cada pessoa.",
            "Ao longo dos anos, a marca cresceu e hoje reúne linhas para adultos, crianças, bebês, adolescentes e também para pets.",
          ],
        },
        {
          heading: "Flores frescas brasileiras",
          paragraphs: ["Nossas fórmulas partem de flores frescas brasileiras, preparadas com cuidado para manter a delicadeza e a identidade de cada essência."],
        },
        {
          heading: "Sem álcool",
          paragraphs: ["As fórmulas são sem álcool, pensadas para serem usadas com tranquilidade por toda a família, inclusive crianças e animais."],
        },
        {
          heading: "Para cada fase da vida",
          paragraphs: ["Conheça as linhas Adulto, Pet, Infantil, Baby, Kids, Teen, Dose Única, Virtudes Divinas, Cosméticos, Cosméticos Pet e Home Care e encontre o que combina com o seu momento."],
          bullets: ["Não sabe por onde começar? Faça o quiz “Descubra seu floral” na página inicial."],
        },
      ]}
    />
  );
}
