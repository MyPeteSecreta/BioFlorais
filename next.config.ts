import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  skipTrailingSlashRedirect: true,
  // Os PDFs-base dos materiais de venda (src/lib/b2b/materiais/bio) são lidos em tempo de execução pela rota de download: entram no pacote
  // da função. A chave usa curinga (e não "[id]"): os colchetes são classe de caracteres no glob e a rota ficava sem os PDFs na Vercel.
  outputFileTracingIncludes: {
    "/api/b2b/materiais/*": ["./src/lib/b2b/materiais/**/*"],
    "/api/b2b/materiais/[[]id[]]": ["./src/lib/b2b/materiais/**/*"],
  },
};

export default nextConfig;
