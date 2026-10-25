import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  skipTrailingSlashRedirect: true,
  // Os PDFs-base dos materiais de venda (materiais-vendas/bio) são lidos em tempo de execução pela rota de download: entram no pacote da função.
  outputFileTracingIncludes: {
    "/api/b2b/materiais/[id]": ["./materiais-vendas/**/*"],
  },
};

export default nextConfig;
