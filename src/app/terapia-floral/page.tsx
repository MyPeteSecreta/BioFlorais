import type { Metadata } from "next";

import InfoPage from "@/components/layout/InfoPage";

export const metadata: Metadata = {
  title: "Terapia Floral | Bio Florais",
  description: "O que é terapia floral e como os florais Bio Florais, feitos com flores frescas brasileiras e sem álcool, acompanham o seu bem-estar.",
};

/* TEXTO INICIAL — o Luis deve revisar (principalmente afirmações sobre benefícios) e substituir pelo conteúdo oficial. */
export default function Page() {
  return (
    <InfoPage
      title="Terapia Floral"
      intro="A terapia floral é uma prática complementar que usa essências de flores para acompanhar o equilíbrio emocional e o bem-estar no dia a dia."
      sections={[
        {
          heading: "O que é",
          paragraphs: [
            "As essências florais são preparadas a partir de flores e usadas em pequenas doses. A proposta é apoiar o cuidado com emoções como ansiedade, insegurança, medo e inquietação, sempre de forma complementar.",
          ],
        },
        {
          heading: "Como a Bio Florais trabalha",
          paragraphs: [
            "Desde 1997, usamos flores frescas brasileiras e fórmulas sem álcool. Cada produto traz uma proposta emocional clara, para que você escolha com facilidade.",
          ],
        },
        {
          heading: "Para quem é",
          paragraphs: ["Há linhas para adultos, crianças, bebês, adolescentes e pets, com apresentações diferentes (gotas, dose única, sprays e cosméticos)."],
        },
        {
          heading: "Importante",
          paragraphs: [
            "Os florais são complementares e não substituem o acompanhamento médico, psicológico ou veterinário. Em caso de dúvida, procure um profissional de saúde.",
          ],
        },
      ]}
    />
  );
}
