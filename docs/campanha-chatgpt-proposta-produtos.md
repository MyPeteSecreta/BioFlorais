# Campanha ChatGPT — proposta de produtos por página (Rodada 20, para aprovação da mestre)

Antes de montar as 8 páginas `/para/*`, esta é a proposta de 3–4 produtos por página. Todos custam **R$ 35,90 (31 ml)**.
Ordem = ranking de mais vendidos da linha (`bioCommercialOrder`, no catálogo). **Só Adulto e Pet têm ranking no repositório**;
Baby e Infantil estão na ordem do catálogo (sem ranking): preciso do ranking real (Neon) ou da sua escolha.

| Página | Linha | Produtos propostos (posição no ranking da linha) | Foto |
|---|---|---|---|
| `/para/pet-sozinho` | Pet | 1. Ansiedade (nº 1) · 2. Stress (nº 3) · 3. Carência e Síndrome do Abandono (nº 5) · 4. Adaptação a um Novo Lar (nº 17) | frasco limpo, fundo branco ✔ |
| `/para/pet-habitos` | Pet | 1. Lambedura e Automutilação (nº 2) · 2. Hiperatividade (nº 4) · 3. Coprofagia (nº 6) · 4. Latido Excessivo (nº 9) | frasco limpo ✔ |
| `/para/pet-medroso` | Pet | 1. Ansiedade (nº 1) · 2. S.O.S. (nº 11) · 3. Medo de Fogos (nº 12) · 4. Medo (nº 14) | frasco limpo ✔ (o rótulo do S.O.S. traz "Resgate Rescue…" em letra miúda) |
| `/para/pausa` | Adulto | 1. Sensação de Ansiedade (nº 1) · 2. Stress (nº 6) · 3. Reequilíbrio dos Chakras (nº 12) · 4. Falta de Tolerância (nº 21) | **cena com frase**: ver pendência 1 |
| `/para/fim-do-dia` | Adulto | 1. Sono (nº 3) · 2. Stress (nº 6) · 3. Sensação de Ansiedade (nº 1) · 4. Falta de Tolerância (nº 21) | **cena com frase**: ver pendência 1 |
| `/para/rotina` | Adulto | 1. Stress (nº 6) · 2. Momento do Estudante (nº 10) · 3. Falta de Memória (nº 14) · 4. Mudanças na Vida (nº 33) | **cena com frase**: ver pendência 1 |
| `/para/bebe-soninho` | Baby | 1. Sono · 2. Choro Excessivo · 3. Bebê Nervoso (sem ranking) | frasco limpo ✔ |
| `/para/crianca-desacelerar` | Infantil | 1. Hiperatividade · 2. Ansiedade · 3. Sono · 4. Adaptação Escolar (sem ranking) | frasco limpo ✔ |

## O que deixei de fora de propósito
- **Adulto "Rescue" (nº 2):** o rótulo do frasco na foto diz RESCUE e não há como trocar; fica fora das páginas (a regra é nunca "Rescue"). Se quiserem o produto, é preciso uma foto nova com rótulo S.O.S.
- **Nomes que soam a diagnóstico** (Tristeza — Estado Depressivo, Pânico, Vícios e Dependências, Parar de Fumar, Redução de Peso, Fase da Menopausa): ficam fora, mesmo sendo top de vendas, para não parecer promessa de saúde.
- **Baby Rescue S.O.S.:** o rótulo tem "Rescue" em letra pequena; ficou fora (a página do bebê fica com 3 produtos).

## Pendências que dependem de decisão
1. **Fotos do Adulto.** Todas as fotos de produto do Adulto são *cenas* (frasco + vela, caderno, moldura) e várias trazem frases de benefício impressas nos adereços ("Quando a ansiedade chegar, respire fundo… Você é mais forte do que imagina", "Quando você descansa, seu corpo se regenera…", "Cada mudança abre espaço para algo melhor"). Só "Falta de Tolerância" e "Falta de Memória" não têm frase. A regra é "só fotos limpas dos frascos". Proponho **recortar o frasco** (CSS, sem arquivo novo, com zoom no centro) para tirar as molduras e os cartões; eu conferiria o recorte de cada foto no navegador antes de publicar. Se o recorte não ficar bom em algum produto, esse produto sai ou ganha foto nova. Pet, Baby e Infantil já são fotos limpas (fundo branco).
2. **Ranking de Baby e Infantil** (e se preferem Kids no lugar de Infantil em `crianca-desacelerar`).
3. **"Foto de momento"** de cada página (a imagem de cabeçalho): não há banco de imagens de momento/estilo de vida limpo no repositório além das cenas do Adulto e dos banners das linhas. Posso usar o banner da própria linha (sem texto de benefício) ou preciso de arquivos novos. Diga qual.
4. **Cupom GPT10 por CPF:** o modelo de cupons guarda só o **e-mail** do resgate (`coupon_redemptions.customer_email`); portanto "1 uso por cliente" é por e-mail, não por CPF. Fazer por CPF exigiria uma coluna nova no resgate (SQL aditivo adicional); diga se querem.

## Como as páginas serão montadas (resumo técnico)
- Um modelo (`src/app/para/[slug]/page.tsx`) + um arquivo de dados (`src/lib/campaign/gpt-pages.ts`): slug, título do anúncio, frase curta, foto de momento, slugs dos produtos, 3 perguntas frequentes. `generateStaticParams` com os 8 slugs; qualquer outro `/para/x` dá 404. `noindex, nofollow`; fora do sitemap e do menu.
- Estrutura: título → faixa "GPT10 aplicado: 10% na sua 1ª compra" → produtos com preço e "Comprar" (coloca na sacola e abre o checkout) → confiança (100% sem álcool; como usar em 1 linha; frete grátis a partir de R$ 100 e subsídio de 25%; Pix e cartão) → 3 perguntas → "ver a linha completa".
- GPT10 aplicado automaticamente na sacola de quem passou por `/para/*` (guardado só no navegador, removível pelo cliente no checkout). A página mostra a mesma coisa para todos (sem cloaking: nada muda por origem, user-agent ou referrer).
- Evento de chegada com origem e campanha (já existente): `/para/*` entra no `chegada`, com `campanha` vinda do `utm_campaign`.
