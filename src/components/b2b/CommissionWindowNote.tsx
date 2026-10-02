/** Janela de 180 dias da comissão do preço normal. Só aparece na área do vendedor. */
export default function CommissionWindowNote({ text }: { text: string }) {
  return (
    <p className="mx-auto mt-6 max-w-3xl rounded-2xl border border-[#d9c7dc] bg-white p-4 text-sm text-[#55245f]">
      <strong>Comissão no preço normal:</strong> {text}
    </p>
  );
}
