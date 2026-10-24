# Entrega — Bio Florais B2B (candidata limpa)

- **Pasta:** `C:\Users\User\bio-b2b-limpa` (worktree de `C:\Users\User\BioFlorais`)
- **Branches:** `b2b/bio-limpa-v1` (já em produção, `main` = `10c0f3a`) e **`b2b/bio-admin-v1`** (rodada Admin B2B, local, **sem push**)
- **Base:** `origin/main` = `e043f6a` (merge feito em 30/09; antes era `c15c0c8`)
- **Data:** 30/09/2026

Nada foi feito em `C:\Users\User\BioFlorais`: nenhum arquivo foi alterado ou descartado lá, a main não foi tocada e o Neon não foi acessado. Não houve seed, deploy, push nem pagamento real. As outras marcas também não foram alteradas.

---

## ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★ Rodada 20 · Cupom GPT10 e proposta das páginas /para/* (23/10/2026), sobre `a54ee67`

Sem push, deploy ou Neon. **Etapa 1 de 2:** cupom pronto; as 8 páginas **só serão montadas depois da aprovação da tabela de produtos** (pedido da mestre).

- **SQL novo (aditivo):** `sql/b2b/50b_cupom_gpt10.sql` (INSERT … ON CONFLICT (code) DO NOTHING) e a conferência somente leitura `50a_cupom_gpt10_conferencia_one_shot.sql` (rode o 50a antes e depois; ela diz se o GPT10 está "conforme"). GPT10: 10% (`percentage`), `scope='b2c'`, cupom comercial comum, `one_per_customer=true`, sem mínimo, sem limite global, sem frete, sem comissão, ativo, válido até **30/11/2026 23:59:59 BRT** (= 2026-12-01 02:59:59 UTC; `expires_at` é timestamp sem fuso em UTC). Se um GPT10 já existir, nada é alterado.
- **1 uso por cliente:** o modelo guarda só o **e-mail** (`coupon_redemptions.customer_email`): vale por e-mail, **não por CPF** (CPF exigiria coluna nova).
- **Sem acumular com outro cupom comercial:** o checkout e o servidor já aceitam um único cupom comercial por pedido; o de parceira/UGC segue a regra atual (calculado sobre o valor depois do comercial). O B2B só aceita cupom de escopo `b2b`, então o GPT10 nunca vale lá.
- **Proposta de produtos (f):** `docs/campanha-chatgpt-proposta-produtos.md`, com a tabela por página, o que ficou de fora e 4 pendências (fotos do Adulto são cenas com frases de benefício; ranking de Baby/Infantil; foto de momento; CPF no cupom).
- **Testes:** `scripts/cupom-gpt10.test.mjs` (3 casos). tsc limpo; suíte completa e build não foram repetidos (só SQL, teste e documento foram adicionados).

---

## ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★ Rodada 19c · Fluxo real do lojista, do representante e acesso sem senha (23/10/2026), sobre `6e596a1`

Sem push, deploy ou Neon. **SQL novo (aditivo): `sql/b2b/49b_acesso_lojista.sql`; conferência somente leitura: `49a_acesso_lojista_conferencia_one_shot.sql`** (rode o 49a antes e depois). Sem o 49b o `/b2b/entrar` funciona, só sem o limite de tentativas persistido.

**Como foi testado desta vez (fluxo real, sem Neon):** montei um banco local PGlite atrás de um endpoint compatível com o HTTP do Neon (`scripts/dev-harness/`, só desenvolvimento: esquema do drizzle + os SQL de `sql/b2b` + dados de teste: representante "Vendedora Ana", cliente de teste "Loja Flor de Lis Ltda" com link pessoal e a vitrine geral; Melhor Envio, ViaCEP e e-mail respondidos por stub) e rodei o app de verdade (`next dev`) no navegador a 375 px. Isso achou um erro que os testes não pegavam (abaixo).

- **Erro real corrigido: a folha de impressão quebrava** ("{imported module PrintOrderButton.tsx}.PRINT_CSS is not a function"): uma constante exportada de módulo `"use client"` chega ao servidor como referência, não como texto. O CSS foi para `src/lib/b2b/print-css.ts`. Foi aberta e conferida a folha do pedido real pelo link pessoal.
- **1) Lojista no link pessoal:** a causa do "loja genérica" era o orçamento salvo na LOJA GERAL (/parceiros): a tela seguinte usava o token da vitrine. Agora o orçamento devolve o link PESSOAL (`storeLink`, como o pedido já fazia) e "Continuar compra", "Imprimir", "Meus pedidos" e "Salve este link" usam esse link. Sacola "fantasma": a barra da loja só mostra a sacola DESTE link, ganhou "Esvaziar", "Descartar orçamento" agora limpa a sacola e o rascunho, e converter/salvar de novo já limpavam. Conferido no real: restaurar deixa 2 linhas, descartar deixa 0; converter em pedido limpa sacola e rascunho; o orçamento vira "convertido" e some de Meus pedidos.
- **2) "Continuar compra" para o lojista:** conferido no link real: Meus pedidos do link pessoal mostra o orçamento com "Continuar compra" (principal), Imprimir/PDF, WhatsApp e Copiar link; o botão restaura a sacola na loja (editável), mostra "Ir para o checkout" e o checkout vem preenchido (dados, endereço, observações) para pagar por Pix ou cartão.
- **3) Representante:** no "Lançar pedido" o checkout já tem "Salvar como orçamento"; a tela seguinte e a ficha do cliente (painel) têm "Continuar compra" (modo lançar; retomar e editar) e o bloco **"Enviar para o cliente pagar"** (WhatsApp e Copiar link com o link pessoal do lojista, sem o modo lançar: o cliente abre, confere e paga por Pix ou cartão). Conferido no real: orçamento salvo pelo representante, ficha do cliente, "Continuar compra" reabre em modo lançar com a sacola restaurada; folha pela sessão do representante.
- **4) Acesso do lojista sem senha:** `/b2b/entrar` (e-mail ou CNPJ/CPF). Resposta SEMPRE neutra. Se houver cadastro (cliente ativo, vínculo e representante ativos, fora da demonstração, com oferta pessoal ativa e link), o link pessoal vai por e-mail **só para o endereço cadastrado**. Limite: 3 por identificador e 10 por IP por hora (só hashes em `b2b_access_requests`). "Já sou cliente": na loja geral, em /parceiros (sem vitrine) e no rodapé do B2B (não aparece no painel nem no login). Conferido no real: CNPJ → e-mail para o endereço cadastrado com o link pessoal; 4ª tentativa do mesmo e-mail barrada sem mudar a resposta.
- **ATENÇÃO (envio de e-mail):** o repositório não tinha nenhum envio de e-mail. Criei `src/lib/mail.ts` pela API do Resend (sem dependência nova), que precisa das variáveis **`RESEND_API_KEY`** e **`MAIL_FROM`** (domínio verificado no Resend) na Vercel. Sem elas o fluxo responde igual, mas nada é enviado (fica registrado no log).
- **5) Registro:** o lojista NÃO tem login, só o link pessoal; o "login" que se via era o link dele ou um login de representante.
- **Testes:** `scripts/rodada19c.test.mjs` (13 casos). tsc limpo, build ok, `npm test` verde. Prints a 375 px do fluxo real: orçamento salvo (link pessoal), Meus pedidos, loja restaurada com a faixa, folha de impressão, ficha do cliente (representante), orçamento salvo pelo representante e `/b2b/entrar`.

---

## ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★ Rodada 19b · Correções dos testes do Luis (23/10/2026), sobre `cda3540`

Sem push, deploy ou Neon. **SQL novo: nenhum.** Usa o que já existe: 32b (`b2b_clients.is_test`), 46b, 47b (histórico) e 48b. A conferência 46a já conta os complementos acima de 60.

- **1) Imprimir pelos 3 caminhos:** nova autorização única `src/lib/b2b/order-access.ts`. Vale (a) o link pessoal do lojista (pedido do cliente do token), (b) o link geral `/parceiros` (storefront: só pedido de origem "parceiros" daquele vendedor da vitrine) e (c) a sessão B2B do representante (pedidos dele, inclusive no "Lançar pedido"). Sem permissão = "não encontrado". Usada na folha por token (`/b2b/oferta/<token>/pedidos/<id>/imprimir`), na nova folha só com sessão (`/b2b/pedido/<id>/imprimir`), na admin (`/admin/pedidos/<id>/folha`) e na API de reabrir orçamento. Causa do erro: a página recusava de saída qualquer token de link geral e só aceitava o cliente do token.
- **2) "Continuar compra" é o botão principal do orçamento** em Meus pedidos, tela após salvar, painel do representante (modo lançar) e admin (detalhe do pedido em orçamento). Imprimir, WhatsApp e Copiar link ficam secundários e o link compartilhado é sempre o do lojista (sem modo lançar). O botão abre a LOJA (`/b2b/oferta/<token>?orcamento=<id>`): restaura a sacola (quantidades editáveis, dá para adicionar produtos), mostra a faixa "Ir para o checkout" e guarda o rascunho (dados, endereço, observações, cupom) na aba; o checkout o lê. Orçamento vencido restaura com preços de hoje e não é convertido.
- **3) Clientes (admin):** (a) botão "Marcar como cliente de teste" (só uma bandeira em `is_test`, sem apagar, com histórico de quem/quando); testes escondidos por padrão e o filtro "Mostrar clientes de teste" os inclui (selo TESTE). (b) Aba nova "Clientes do site (B2C)", só leitura: compradores agrupados por e-mail a partir de `orders` B2C (nome e cidade/UF do pedido mais recente, nº de pedidos, último pedido, total pago), busca por e-mail/nome/cidade e link "Ver pedidos" (`/admin/pedidos?cliente=<e-mail>`). Sem exportação.
- **4) Complemento no Omie:** máximo de 60 (confirmado). A API da Central (`brand-api.ts`) agora entrega `address` já pronto (complemento cortado em 60, sem partir palavra quando há espaço nos últimos 20 caracteres) e coloca o resto na `omieObservation` ("COMPLEMENTO (continuação): …"). **A Central precisa usar `order.address.complement` (e `omieObservation`) no envio ao Omie**; o contrato (`contract.ts`) foi atualizado.
- **Testes:** `scripts/rodada19b.test.mjs` (14 casos) e ajustes de 3 asserções antigas. tsc limpo, build ok, `npm test` verde. Prints a 375 px: botões do orçamento (principal "Continuar compra"), Clientes com filtro/selo TESTE e Clientes do site.

---

## ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★ Rodada 19 · Usabilidade do pedido B2B (22/10/2026), sobre `5c5a52d`

Sem push, deploy ou Neon. **SQL novo (todo aditivo; cada conferência é só leitura; rode a `a` antes e depois da `b`):**
`46a/46b` (orders.customer_note) · `47a/47b` (endereço em b2b_clients + histórico b2b_client_edits) · `48a/48b` (orders.quote_expires_at). O 48a inclui a contagem de orçamentos pendentes/convertidos/substituídos; o 45a (rodada 17) já traz a conferência pelo slug `adulto-%`. Sem as colunas nada quebra: o pedido segue sem observação/validade, e salvar orçamento pede o 48b.

- **a) Observações do pedido (até 500) + complemento validado:** campo nos checkouts B2C e B2B (o "Lançar pedido" usa o mesmo checkout B2B). Servidor valida (mensagem clara) e grava em `orders.customer_note`; aparece no admin (detalhe e folha de separação), na Central (`customerNote`) e **segue ao Omie dentro de `omieObservation` ("OBS DO CLIENTE: ...")**. Complemento: até **60 caracteres** (limite que assumi para o campo do Omie: confirmar), uma linha, só letras/números e `. , - / # ( ) & :`; texto comprido ou símbolo recusado com orientação a usar Observações.
- **b) Admin → Clientes:** nova aba com busca (nome/razão social, CNPJ/CPF, e-mail, WhatsApp, cidade) e edição do cadastro (nome, CNPJ/CPF com dígito verificador e sem repetir outro cliente, e-mail, WhatsApp, endereço). Cada alteração grava quem/quando/antes-depois em `b2b_client_edits` e aparece no histórico. **O admin tem uma senha só: o "quem" é o nome digitado no formulário (lembrado no navegador).** Nunca apaga.
- **c) Imprimir / PDF:** folha A4 com marca, cliente, entrega, itens (qtd, preço, desconto %, unidades grátis), displays, cupom, frete, total, condição de pagamento e observações; nunca mostra comissão nem custo real do frete. Botões: revisão do checkout (também no "Lançar pedido"), tela de pedido criado, "Meus pedidos" (lojista) e painel do vendedor (orçamentos). Pelo navegador (Imprimir → Salvar como PDF). A linha "Ajuste da forma de pagamento" mostra o valor, não o percentual.
- **d) Salvar como orçamento:** botão no checkout grava o pedido sem forma de pagamento, status `quote` ("Orçamento (pendente)"), validade 15 dias (`B2B_QUOTE_VALIDITY_DAYS`, 1 a 90). Não reserva estoque, não conta como compra, não reserva promoção, não vai à Central/Omie e não gera comissão (tudo isso só olha pedido pago/pendente). O lojista reabre em "Meus pedidos" e o vendedor no painel do cliente: carrega a sacola, os dados e as observações com preços recalculados; ajusta, escolhe o pagamento e vira pedido (o orçamento passa a `quote_converted`; salvo de novo, o anterior vira `quote_replaced`). Vencido: abre para conferir, mas não é convertido. Total de referência = preço cheio (boleto); o documento mostra Pix/cartão/boleto.
- **e) Sacola/checkout B2B:** quantidade editável (− / digitar / +) na sacola e no resumo do checkout. Digitar nunca remove o item (apagar o número para digitar outro era o que esvaziava a linha). A mudança revalida na hora: kit com display (sai com aviso se o kit ficar incompleto), mínimo (aviso e botões travados), promoções, frete e total (a cotação recalcula pela quantidade).
- **Testes:** `pedido-observacoes`, `clientes-admin`, `sacola-b2b-quantidade`, `orcamento-impressao-b2b` (+ ajuste de 2 asserções antigas). tsc limpo, build ok, `npm test` verde. Prints a 375 px: folha do pedido, sacola com +/−, checkout com observações e botões.

---

## ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★ Rodada 18 · Topo das linhas e eventos do Analytics (22/10/2026), sobre `c033e93`

Sem push, deploy, Neon ou SQL. Não mexi no B2B (`/b2b/*`) nem na Home.

- **Linhas (`/linha/[slug]`, todas):** saiu a seção superior (título grande, descrição, chips "N opções"/"Bio Florais · Desde 1997" e o banner da linha) e o bloco "Explore a linha / headline". O topo agora é: eyebrow (a frase pequena de cada linha) → `<h1>` com o nome da linha → 1 frase (a descrição atual, todas ≤ 120 caracteres) → logo os cards. Mantive um breadcrumb visível de 1 linha (Início / Linhas / Nome) e todo o SEO: metadata, canonical, JSON-LD, BreadcrumbList, og:image `/og/`, `generateStaticParams`. Sem o banner, o LCP passa a ser o primeiro card: só ele leva `priority`/`fetchPriority="high"`. No celular (375×667) o 1º card aparece inteiro e o 2º já aparece sem rolar. Prints antes/depois a 375 px (infantil, adulto, pet) e desktop (infantil) feitos no navegador do app.
- **Eventos do Vercel Analytics:** `chegada` (1× por sessão do navegador), `ver_produto` (`/produto/<slug>`), `sacola` (adicionar produto ou combo ao carrinho) e `checkout` (`/checkout` e `/b2b/checkout`). Duas propriedades apenas: `origem` ("utm_source / utm_medium" do cookie `bio_origem`; sem utm usa o domínio do referrer; "direto" se vazio) e `campanha` (`utm_campaign`; "nenhuma" se vazio). Nada de dado pessoal. Só nas páginas do B2C/lojista (nunca admin nem área do vendedor); falha silenciosa se o Analytics estiver bloqueado. Custom Events exigem o plano Pro e a aba de eventos ativa no painel da Vercel.
- **Testes:** `scripts/rodada18.test.mjs` (4 casos) e ajuste de 1 asserção em `seo-fase2.test.mjs` (prioridade agora no 1º card). tsc limpo, build ok, `npm test` verde. O envio real dos eventos só pode ser conferido em produção (o script `/_vercel/insights` não existe localmente).

---

## ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★ Rodada 17 · Origem da venda em todo pedido (19/10/2026), sobre `e462e88`

Sem push, deploy ou Neon. **SQL novo (aditivo): `sql/b2b/45b_origem_venda.sql`; conferência somente leitura: `sql/b2b/45a_origem_venda_conferencia_one_shot.sql`** (rode o 45a antes e depois; o 45a inclui a conferência pelo slug `adulto-%`).

- **Captura:** `AttributionCapture` (no layout) guarda no cookie próprio `bio_origem` (first-party, SameSite=Lax, Secure, 30 dias) só `utm_source`, `utm_medium`, `utm_campaign` e o **domínio** do referrer (sem www, sem caminho/query; navegação interna ignorada). First-touch: a primeira visita COM informação fixa a origem; visita direta não grava nem trava. Mesmas páginas do banner/oppref (B2C e lojista; nunca admin nem área do vendedor). Não mexe na URL.
- **Pedido:** `attachAttribution` grava os 4 campos em `orders` na criação (B2C e B2B do próprio lojista; o pedido lançado pelo vendedor não leva a origem do vendedor), só se o pedido ainda não tem origem; tolera a ausência das colunas (como no oppref).
- **Admin:** detalhe do pedido mostra "Origem: instagram / organic / 2110_rotina" (ou "Direto"); lista de pedidos ganha "Exportar pedidos com origem (CSV)" → `GET /api/admin/orders/export` (só admin; filtros `?from=&to=`; ignora arquivados/teste; BOM + proteção de fórmula).
- **Consentimento/política:** a origem é dado de atribuição sem dado pessoal e **não depende do aceite de marketing** (nenhum código de consentimento é lido). A política de cookies e a de privacidade não cobriam esse cookie: foi acrescentada a seção "Origem da visita (análise)" (cookie `bio_origem`, 30 dias, só campanha + domínio, sem terceiros, gravado no pedido). No banner, "Análise" deixou de dizer "Sem cookies" (agora "Sempre"). Decisão jurídica (tratar como análise sem consentimento) é da empresa; o código é isolado e fácil de passar para "só com aceite".
- **Testes:** `scripts/origem-venda.test.mjs` (8 casos: captura, referrer, first-touch, sanitização, PGlite do pedido/CSV/colunas ausentes, 45a/45b, ligações). tsc limpo, build ok, `npm test` 332/332. Conferido no navegador: `?utm_source=instagram&utm_medium=organic&utm_campaign=2110_rotina` gera `bio_origem` com os 3 campos; exportação sem sessão = 401.

---

## ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★ Rodada 16 · Banner de cookies discreto (19/10/2026), sobre `418d5d0`

Sem push, deploy, Neon ou SQL. Só `src/components/consent/CookieBanner.tsx` (+ teste).

- **1ª camada:** "Usamos cookies para o site funcionar e melhorar sua experiência. Saiba mais" (link para `/cookies`), sem citar anúncios, métricas ou rastreamento. Sem título.
- **Botões:** Aceitar · Recusar · Configurar, mesma classe (mesmo tamanho e destaque). Padrão recusado: marketing só entra com o aceite (lógica de consentimento, Image Tag e `OppRefCapture` intactos).
- **Configurar:** Necessários "Para o site funcionar." · Análise "Para entender como o site é usado." · Marketing "Para medir nossas campanhas." (chave liga/desliga) + links para a Política de Cookies e a de Privacidade; Salvar · Recusar · Aceitar.
- **Compacto:** cartão menor (margem 8 px, padding 12 px, botões de 40 px), 2 linhas de texto + 1 de botões no celular. Vale em todo o site onde o pixel pode rodar (B2C, /parceiros, /b2b/oferta, /b2b/carrinho, /b2b/checkout, /b2b/pagar); nunca em admin nem na área do vendedor (regra `isPixelPath` já existente).
- **Verificação:** tsc limpo, build ok, `npm test` 324/324. Prints a 375 px (1ª camada e Configurar) e desktop feitos no navegador do app.

---

## ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★ Rodada 14b · PERF-01 e ajustes de redirect (19/10/2026), sobre `fc78927`

Sem push, deploy, Neon ou SQL.

- **PERF-01:** (1) `fetchPriority="high"` nos heróis da Home (mobile e desktop) e de `/linha/[slug]`: no Next 16 o `priority` só faz preload (sem `fetchpriority=high` no `<img>`, o Lighthouse acusava "priorityHinted: false"); `sizes` já estavam corretos e as imagens abaixo da dobra são `lazy`. (2) `/linha/[slug]` passou de renderização por visita (ƒ) para estática no build (`generateStaticParams` com todas as linhas), servida do CDN: corta o TTFB do servidor. Sem mudança visual. A query (utm_*, oppref) não altera a página.
  - **Antes/depois (Lighthouse mobile local):** o ambiente local tem piso de ~3,1 s: uma página trivial (`/cookies`) dá FCP = LCP = 3,1 s com throttling devtools (1,5 s sem throttling). Home: LCP 3,6/3,0 s (antes) → 3,2 s (depois); `/linha/adulto`: 3,1-3,6 s → 3,1 s; ambas no piso do ambiente. A imagem do herói já pesa 24 KB (Home) e 54 KB (Adulto) e é descoberta no HTML. **O critério LCP < 2,5 s não é verificável localmente**; o ganho esperado em produção é o TTFB (SSG) e a prioridade do herói. Conferir no PageSpeed após o deploy.
- **Redirects (URL-01 ajustes):** floral de ambiente `*-bio-pet-*`/`*-eco-beauty-*` → produto `cosmeticos-pet-floral-de-ambiente-<tema>` (sos→rescue-sos, ansiedade, tristeza-e-depressao, agressividade, adestramento, filhotes), sem correspondência → `/linha/cosmeticos-pet`; `-its-blossom-` segue em Home Care. `/linha-humana` → `/linha/cosmeticos`; `/shop` e `/shop/page/*` → `/`; `/categoria-produto/cosmetico/linha-humana/*` → `/linha/cosmeticos`; `.../linha-pet/*` → `/linha/cosmeticos-pet`. Grandes Animais (`linha-grandes-animais`, `*-grandes-animais-*`, `/floral-grandes-animais-*`) → `/linha/pet`. No redirect saem só `add-to-cart` e `srsltid`; utm_*, oppref e o resto seguem.
- **Testes:** 5 casos novos em `scripts/seo-fase2.test.mjs` (14b a-d + URLs de anúncio/SSG). tsc limpo, build ok, `npm test` 323/323.

---

## ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★ Rodada 14 · SEO Fase 2 (18/10/2026), sobre `2e81e9e`

Sem push, sem deploy, sem Neon, sem SQL. Só B2C/SEO.

- **URL-01 (alta):** `src/middleware.ts` agora só aplica 301 (`NextResponse.redirect(url, 301)`) vindo de `resolveLegacyRedirect` (`src/lib/seo/legacy-redirects.ts`, função pura) + dados em `src/lib/seo/legacy-redirects.data.ts` (75 casos conhecidos um a um, aliases `/fa-*`, prefixos fa/fk/fb/ft/fv, palavras de categoria). A query string INTEIRA (utm_*, oppref) é preservada (`withLegacyQuery`; `#linhas` fica depois da query). `/produto/<slug antigo>` tenta casar pelo NOME do produto (todas as palavras do nome no slug, linha sugerida, um único melhor candidato); sem casamento seguro vai para a linha pelo prefixo, senão home. Nunca loop: todo destino é URL atual (teste `resolver(destino) === null`) e o middleware ignora redirect para si mesmo. URLs atuais (`/`, `/linha/*`, `/produto/<válido>`, `/parceiros`, `/b2b/*`, `/acompanhe/*`, `/checkout`, `/api/*`) não são tocadas.
- **PERF-01:** o texto do ticket não veio na colagem; **não implementado** (aguarda o texto).
- **SCHEMA-01:** `Offer` ganha `shippingDetails` (entrega em todo o Brasil, valor/prazo pelo CEP, frete grátis a partir de R$ 100,00; `shippingRate` 0,00 só quando o produto já passa de R$ 100; **sem deliveryTime**, a política não publica prazo) e `hasMerchantReturnPolicy` (7 dias corridos, link para `/trocas-e-devolucoes`). Textos de `/frete-e-entrega` e `/trocas-e-devolucoes`.
- **SCHEMA-02:** `BreadcrumbList` (Início → Linha → Produto) em `/produto/[slug]` e (Início → Linha) em `/linha/[slug]`.
- **SCHEMA-03:** `Organization` + `WebSite` movidos da Home para o `layout.tsx` (todas as páginas). `sameAs` só com os perfis do rodapé.
- **IMG-01:** alt descritivo “Floral Bio Florais – Nome – Linha” (sem “Floral” em cosméticos/home care; sem promessa de saúde) na galeria, miniaturas, relacionados e cards da linha.
- **IMG-02:** só o herói tem `priority` (Home, linha, galeria do produto); o restante é lazy (padrão do `next/image`).
- **CONT-01:** Rescue sem “FA Retten Sauvetage Salvataggio S.O.S- 31ml”; “tranqüilidade” → “tranquilidade” no Rescue (as demais ocorrências em outros produtos ficam para um ticket próprio).
- **Testes:** `scripts/seo-fase2.test.mjs` (12 casos). Asserções antigas de `seo-b2c`/`ads-image-tag` atualizadas (middleware e `jsonLdString`).
- **Verificação:** tsc limpo, `npm run build` ok, `npm test` 318/318, `git diff --check` sem erro de espaço. Prova HTTP em `next start`: 301 com `?utm_source=x` preservado.
- **Depois do deploy:** avisar a janela Anúncios (via mestre) e rodar o Rich Results Test.

---

## ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★ Rodada 13 · SEO do B2C (18/10/2026), sobre `eace77b`

**Sem SQL.** Só metadata/SEO: nenhuma mudança visual, de fluxo de compra, de checkout, de pagamento ou de banco. FAVICON-01 **não** entra.

- **SEO-03 canonical:** `metadataBase` no layout (`getSiteUrl()`); canonical **relativo** (resolve em www) e **sem query**: `/`, `/sobre` (novo), `/linha/<slug>`, `/produto/<slug>`. **`getSiteUrl()` agora normaliza o apex para www** (se a variável `NEXT_PUBLIC_SITE_URL` da Vercel estiver sem www — causa do robots/sitemap sem www — tudo sai em www mesmo assim; conferir a variável lá).
- **SEO-02 títulos/descrições/OG:** as 3 linhas com anúncio com os textos **aprovados literais** (Adulto, Infantil, Pet); Baby, Kids, Teen, Dose Única, Virtudes Divinas, Cosméticos, Cosméticos Pet e Home Care no mesmo padrão (nome da linha + "sem álcool"/essências + contexto de uso; **sem termo de condição/cura/tratamento**, validado por teste). **og:image** copiadas de `anuncios-angelblanc\imagens\og` para **`public/og/og-home.jpg`, `og-adulto.jpg`, `og-infantil.jpg`, `og-pet.jpg`** (1200×630), URL absoluta em www; Infantil/Baby/Kids/Teen usam og-infantil, Pet e Cosméticos Pet og-pet, Adulto/Dose Única/Virtudes og-adulto, o resto og-home. Layout e Home ganham OG/Twitter padrão (og-home). **Produto:** `generateMetadata` (`await params`, `notFound`, slugs `-5l`/`-500ml` normalizados para a página base), título "<Floral|Categoria> <Nome> · <Linha> | Bio Florais", descrição = 1ª frase do texto editorial (sem o rótulo "Descrição", ≤155 caracteres) ou fallback seguro, OG/Twitter com a **imagem real da galeria** (nunca `product.image`). Nomes com condição do catálogo ficam como estão.
- **SEO-01 sitemap/robots:** um único `sitemap()` (sem `generateSitemaps`/`id`): Home + institucionais + 11 linhas + **229 produtos** = 246 URLs em www (sem `-5l`/`-500ml`); `robots.txt` usa `getSiteUrl()` → `Sitemap: https://www.bioflorais.com.br/sitemap.xml`.
- **SEO-04 JSON-LD:** `Product` em `/produto/*` (name, description, sku, url, brand "Bio Florais", imagens da galeria em URL absoluta) + `Offer` (BRL, preço com 2 casas, **`InStock` fixo** — aprovado pela mestre); sem preço = sem `Offer`; `<` escapado no JSON. **Rich Results Test do Google: rodar depois do deploy** (não dá para rodar daqui).
- **H1-01:** o `<h1>` da versão mobile da Home virou `<p>` com as mesmas classes; sobra **um único `<h1>`** (conferido no HTML renderizado).
- **NÃO QUEBRAR (conferido por teste e curl):** query string (`utm_*`, `oppref`) preservada nos redirects (`/parceiros` → loja, `/produto/<slug>-5l` → base com `?utm_source=x`, middleware); **nunca** `Referrer-Policy: no-referrer`; nenhuma tag de terceiros (sem GTM/pixel JS); URLs de destino `/`, `/linha/adulto`, `/linha/infantil`, `/linha/pet`, `/parceiros` inalteradas; B2B `noindex`, banner de cookies e Image Tag intactos.
- **Prova local (dev, com `NEXT_PUBLIC_SITE_URL=https://bioflorais.com.br` de propósito, para provar a normalização):** Home `canonical https://www.bioflorais.com.br`, `og:image https://www.bioflorais.com.br/og/og-home.jpg`; `/linha/adulto` → title "Florais Adulto sem álcool | Bio Florais", canonical `…/linha/adulto`, og-adulto.jpg; `/linha/infantil` → "Florais Infantis sem álcool | Bio Florais", og-infantil.jpg; `/linha/pet` → "Florais para cães e gatos | Bio Florais Pet", og-pet.jpg; `/sobre` canonical www; 5 produtos com title/description/og distintos (Rescue, Ansiedade Pet, Shampoo Uso Diário, Virtudes Amor, Aromatizador Bem Estar); `/sitemap.xml` **200 application/xml, 246 `<loc>`, 229 de produto, 0 sem www**; `/robots.txt` com `Sitemap: https://www.bioflorais.com.br/sitemap.xml`; JSON-LD com `"availability":"https://schema.org/InStock"`, `priceCurrency BRL`, `price 35.90`.
- **Teste:** `scripts/seo-b2c.test.mjs` (8).
- **Avisar a janela Anúncios (via mestre) depois do deploy** para reconferir UTM, oppref, a tag de compra e as páginas de destino dos anúncios.

## Arquivos tocados (B2C, só metadata/SEO)
`src/app/layout.tsx`, `src/app/page.tsx` (og + H1), `src/app/sobre/page.tsx`, `src/app/linha/[slug]/page.tsx` (generateMetadata), `src/app/produto/[slug]/page.tsx` (generateMetadata + JSON-LD), `src/app/sitemap.ts`, `src/app/robots.ts` (sem mudança de código; já usa `getSiteUrl()`), `src/lib/seo/site-url.ts`. Novos: `src/lib/seo/metadata.ts`, `public/og/og-{home,adulto,infantil,pet}.jpg`, `scripts/seo-b2c.test.mjs`.

---

## ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★ Ajuste da Image Tag: marcar "enviada" só no onLoad (18/10/2026), sobre `ff4710f`

**Sem SQL** (usa as colunas do 44b). Antes, o servidor marcava `ads_tag_sent_at` ao ENTREGAR a URL; se uma extensão/navegador bloqueasse a imagem, o evento se perdia.
- **Oferecer ≠ enviar:** `POST /api/orders/ads-tag {orderId}` só garante o `ads_event_id` (UUID aleatório salvo no pedido) e devolve a URL **sem marcar**; enquanto não confirmada, devolve a **mesma URL** (mesmo event_id: a plataforma deduplica, sem conversão dobrada).
- **`onLoad` da imagem:** o navegador chama `POST /api/orders/ads-tag {orderId, sent: true}` e **só então** o servidor grava `ads_tag_sent_at` (atômico, uma vez; só se o event_id já foi oferecido e o pedido continua pago, não boleto). A partir daí recarregar/outro aparelho não renderiza de novo.
- **`onError` (imagem bloqueada):** **nada é marcado**; a tag é re-renderizada até 2 vezes (a cada 5 s) e a próxima visita à confirmação/acompanhamento reoferece a mesma URL.
- **Testes** (`ads-image-tag.test.mjs`): oferecer não marca; reoferece a mesma URL; confirmar marca uma vez; depois não oferece; não confirma pedido pendente/boleto/arquivado/id inválido; `onLoad` confirma e `onError` nunca marca.

---

## ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★ Rodada 12 v3 · Image Tag do ChatGPT Ads (18/10/2026), sobre `297046b` (que está sobre `dfd5346`, não publicado)

`PEDIDO_TECNICO_PIXEL_BIO.md` v3. **SUBSTITUI o Pixel JS** (a correspondência avançada automática não pode ser desligada no pixel JS). **SDK `oaiq` removido** (sem script da OpenAI, sem `oaiq(...)`, sem objeto `user`, sem hash). Mantidos: banner de cookies, "Configurar cookies", repasse de query string e políticas (parágrafo da v3). API de Conversões (fase 2) **não** entra.

## SQL e ordem: **44a → 44b → 44a → push**
1. `44a_ads_tag_conferencia_one_shot.sql` (somente leitura, 1 linha JSON): `colunas_ads_existentes` (esperado depois: **3**).
2. `44b_ads_tag.sql` (aditivo, idempotente, BEGIN/COMMIT, **linha final `ok`**): `orders.oppref text`, `orders.ads_event_id uuid`, `orders.ads_tag_sent_at timestamptz`. Não altera dado existente.
3. 44a de novo. **Sem o 44b nada quebra**: a medição fica inerte (a tag não é entregue).

## O que faz
- **Captura do oppref (cookie próprio `bio_oppref`):** com consentimento de **marketing**, ao entrar com `?oppref=…` grava `bio_oppref` (first-party, **SameSite=Lax, Secure, 30 dias**, valor como veio, só codificado para ser cookie válido); nova chegada substitui e renova. **Consentimento depois:** o oppref da página de entrada fica só na sessão (`sessionStorage`) até a decisão (aceitou = grava; recusou = descarta). **Sem consentimento nada é gravado; retirar o consentimento apaga `bio_oppref`.** A query string nunca é reescrita.
- **Associação ao pedido:** na criação do pedido (B2C `/api/orders/create` e B2B do lojista) o servidor lê o cookie e grava em `orders.oppref` (só se vazio). Pedido **lançado pelo vendedor** não leva oppref (seria o do vendedor).
- **Evento "Compra" = `<img>` 1x1 no pedido PAGO** (Pix confirmado/cartão aprovado; **boleto = fase 2**): o navegador, **só com consentimento de marketing** (sem consentimento nem consulta o servidor), chama `POST /api/orders/ads-tag`; o servidor, de forma **atômica**, marca `ads_tag_sent_at`, gera/guarda o **`ads_event_id` (UUID aleatório — nunca o número do pedido)** e devolve a URL — **uma vez por pedido** (recarregar ou outro aparelho não repete). Pedido pendente, boleto, arquivado (teste) ou já enviado: nada. URL exata: `https://bzr.openai.com/v1/sdk/events?pid=C43h1qwNBKW7o7E9hgXwh9&event=order_created&event_id=<UUID>&oppref=<valor salvo no pedido ou do cookie; sem oppref o parâmetro some>&data[type]=contents&data[amount]=<centavos inteiros>&data[currency]=BRL`, tudo URL-encoded, **sem `data[contents]`**, sem e-mail/telefone/nome/documento/ID de sessão/de cliente/número do pedido. Renderizada em `/acompanhe/<token>`, no checkout B2C (quando fica pago) e no checkout B2B.
- **Onde NÃO:** `/admin/*`, área do vendedor (`/b2b/painel`, `/b2b/login`, convite, demo), `/api`; carrega no B2C e nas páginas do lojista (`/b2b/oferta`, carrinho, checkout, pagar) e `/parceiros`.
- **CSP:** o site não tem CSP (conferido em `next.config.ts`, `middleware.ts`, `vercel.json`): nada a liberar; se um dia houver, só `img-src https://bzr.openai.com` (nada em `script-src`).
- **Políticas** (Privacidade 9.1 e Cookies 9): parágrafo da v3 literal (`bio_oppref`, 30 dias, "apenas que houve uma compra, com o valor e um identificador aleatório", sem nome/e-mail/telefone/documentos/número do pedido, "Configurar cookies"); some a redação do pixel JS (`__oppref`/`__obref`).

## Verificação
- **Testes** `scripts/ads-image-tag.test.mjs` (9): sem consentimento nada grava; cookie Lax/Secure/30 dias; consentimento tardio e retirada; oppref estranho/codificação; URL da tag campo a campo (centavos, UUID, sem oppref, encode); servidor em PGlite (uma vez, event_id salvo, prioridade do oppref do pedido, boleto/pendente/arquivado, SQL ausente = inerte); 44a/44b; sem SDK/`oaiq`/sha256/CSP; fiação, onde carrega, banner e políticas; query string.
- **Navegador (localhost):** entrada por `/?oppref=teste123&utm_source=chatgpt`: banner aparece, **0 requisições a openai**, **nenhum `bio_oppref`**, oppref guardado só na sessão, URL intacta; ao Aceitar grava `bio_oppref=teste123`; ao Recusar apaga. (O cookie `__oaiq_consent=false` visto no navegador de teste é resquício do SDK testado antes; não é gerado por este código.) **Não** testado de ponta a ponta: o `<img>` com um pedido pago real (exige banco/pagamento): o Luis confere no painel (Conversões → Fluxo de eventos) após publicar e rodar o 44b.
- **Prints do banner:** `docs/prints-r10-r11/pixel-banner-375.jpg`, `pixel-banner-configurar-375.jpg`, `pixel-banner-desktop.jpg`.

## Arquivos do B2C tocados (nesta v3 + os da v2 mantidos)
`src/app/layout.tsx` (banner + captura do oppref), `src/components/layout/SiteFooter.tsx` ("Configurar cookies"), `src/app/privacidade/page.tsx`, `src/app/cookies/page.tsx`, `src/app/acompanhe/[token]/page.tsx` (tag), `src/app/checkout/page.tsx` (tag + parada da consulta de status), `src/app/api/orders/create/route.ts` (grava oppref no pedido), `src/app/produto/[slug]/page.tsx` (redirects mantêm a query), `src/app/api/orders/[orderId]/status/route.ts` (correção Lunium). B2B: `B2BCheckoutContent.tsx`, `api/b2b/orders/create/route.ts`, `parceiros/page.tsx`, `lib/b2b/partners.ts`. Removidos: `lib/pixel.ts`, `lib/pixel-event.ts`, `api/orders/pixel-event`, `ChatGptAdsPixel.tsx`, `PurchasePixel.tsx`. Novos: `lib/ads-tag.ts`, `lib/ads-tag-server.ts`, `api/orders/ads-tag`, `components/consent/{OppRefCapture,AdsPurchaseTag}.tsx`.

---

## ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★ Investigação: "Erro ao consultar Lunium: 401 chave_incorreta" (18/10/2026), sobre `dfd5346`

**Causa:** `GET /api/orders/<id>/status` tinha um bloco "Lunium / Pix (preservado)" que rodava para **todo pedido ainda não pago**, sem olhar o provider, sempre que existe `LUNIUM_API_KEY` na Vercel. A chave está inválida/desativada (o Pix da Bio é Mercado Pago), então **cada consulta de status de um pedido pendente gerava 1 chamada à Lunium e 1 erro 401**. A consulta vem do checkout B2C (`/checkout`, a cada 3 s enquanto a aba está aberta com um pedido pendente; **aba em segundo plano é limitada pelo navegador a 1 consulta por minuto** — exatamente o padrão dos ~130 erros/dia de um único pedido, `8cd0dffb…`) e dos checkouts B2B/mostruário. O pedido não tem nada de Lunium: é só uma **aba esquecida aberta** com um pedido pendente, e o código antigo consultava a Lunium por pura "preservação".
**Correção (commit abaixo):** (1) a rota só consulta a Lunium se o pedido **tem pagamento Lunium** (`payments.provider = 'lunium'`, gravado na criação de toda cobrança Lunium — `lib/payments/lunium-gate.ts`); Pix/cartão Mercado Pago e pedido sem pagamento gerado **nunca** consultam; pedido antigo com cobrança Lunium continua conciliando; (2) a tela do checkout B2C **para de consultar após 35 min** (o Pix vale 30; o webhook e a página de acompanhamento seguem valendo), para não haver consulta eterna.
**Fluxo Pix Mercado Pago (código):** criação (`/api/payments/mercadopago/pix`, B2B `/api/b2b/payments/mercadopago/pix`) → pagamento → webhook `/api/webhooks/mercadopago` + cron `reconcile-mp-pix` + a própria consulta de status (concilia a Order existente no Mercado Pago) → todos terminam em `finalizeMercadoPagoPaid` → `paid` / `paid_to_prepare`. O bloco Mercado Pago do status **não foi alterado** e roda antes do bloco Lunium. Coberto por testes de código; **não consigo confirmar a produção daqui (sem acesso ao banco/Vercel)**: conferir nos logs da Vercel que os 401 sumiram após o deploy e que um Pix de teste vira `paid`.
**Pedido 8cd0dffb-7c04-4a42-ae32-65a9f8386127 — real ou teste?** Não dá para saber sem o banco (sem acesso ao Neon). Consulta somente leitura para o Luis rodar:
```sql
SELECT o.id, o.status, o.payment_method, o.total_cents, o.created_at, o.b2b_offer_id IS NOT NULL AS b2b,
       c.name, c.email, (SELECT string_agg(p.provider || '/' || p.method || '/' || p.status, ', ') FROM payments p WHERE p.order_id = o.id) AS pagamentos
  FROM orders o LEFT JOIN customers c ON c.id = o.customer_id WHERE o.id = '8cd0dffb-7c04-4a42-ae32-65a9f8386127';
```
Teste costuma ter e-mail/nome do time e total simbólico; cliente real tem Pix gerado e status pendente por abandono. Se for abandono real, o pedido pode ser cancelado no admin depois.
**Teste:** `scripts/status-lunium-gate.test.mjs`.

---

## ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★ Rodada 12 (v2, SUPERADA pela v3 acima: o pixel JS foi removido; ficam banner, 'Configurar cookies', query string e políticas), sobre `70e4ffd`

Pedido técnico: `PEDIDO_TECNICO_PIXEL_BIO.md`. Pixel `C43h1qwNBKW7o7E9hgXwh9`. **Sem SQL.** Fase 2 (API de Conversões) **não** entra. B2C tocado só no necessário (lista no fim).

- **1. Só com aceite de marketing.** O site não tinha banner: criado `CookieBanner` discreto no padrão da Bio — **Aceitar / Recusar / Configurar com o mesmo destaque** (mesma classe, mesmo tamanho), **padrão recusado**, escolha salva (`localStorage bio_cookie_consent_v1`). "Configurar" abre as categorias: Necessários (sempre), Análise (a medição da Vercel é sem cookies e sem dado pessoal: informativo, sem chave) e **Marketing** (liga/desliga, começa desligado). "Configurar cookies" reabre as preferências a qualquer momento (rodapé do B2C e nas políticas). Sem aceite: **nenhum script `bzrcdn.openai.com`, nenhuma chamada `oaiq`, nenhum cookie** (conferido no navegador). Com aceite: `oaiq("consent", false)` → `oaiq("init", {pixelId})` → `oaiq("consent", true)`, script injetado **uma vez**. Retirada: `oaiq("consent", false)` + expira `__oppref` e `__obref` (no domínio e nos domínios pais); a própria OpenAI mantém só o cookie do estado do consentimento (`__oaiq_consent=false`).
- **2. Sem dado pessoal:** nenhum objeto `user`, nenhum `*_sha256`/e-mail/telefone/documento no código nem nas chamadas (teste varre o código); **`opt_out: true` em todo `measure`**. A "correspondência avançada automática" é desligada pelo Luis no painel (Conversões → Fonte de dados → Bio Florais - site).
- **3. Compra (`order_created`):** **uma vez por pedido PAGO** (Pix confirmado ou cartão aprovado). O servidor (`GET /api/orders/pixel-event?orderId=`) só devolve o evento se o pedido está **pago**, não é **boleto** (fase 2), não está arquivado (teste) — sem dado pessoal. `amount` = total pago (`orders.total_cents`, produtos + frete − descontos) em **centavos inteiros**; `currency "BRL"`; `contents` só `id` (slug), `name`, `content_type "product"`, `quantity` (brinde/bonificação de R$ 0,00 fica de fora); `event_id` **`b2c_<id>`** ou **`b2b_<id>`**; **não repete ao recarregar** (marca `oaiq:sent:<event_id>` só quando realmente enviou). Disparo: página de acompanhamento `/acompanhe/<token>`, checkout B2C (quando o status vira pago), checkout B2B (confirmação) — com 4 tentativas de 4 s para o webhook do cartão. Sem consentimento nada é enviado nem marcado.
- **4. Onde NÃO carrega:** `/admin/*`, área do vendedor (`/b2b/painel`, `/b2b/login`, `/b2b/convite`, `/b2b/demo`), `/api`. Carrega no B2C e nas páginas do lojista (`/b2b/oferta`, `/b2b/carrinho`, `/b2b/checkout`, `/b2b/pagar`) e `/parceiros`. O banner também não aparece fora dessas páginas (verificado em `/admin/login`, mesmo com consentimento salvo: sem banner e sem script). Se o visitante cair numa página interna com o pixel já carregado, é enviado `consent false`.
- **5. CSP:** o site **não tem** Content-Security-Policy (`next.config.ts`, `middleware.ts` e `vercel.json` conferidos): nada a liberar e nenhum `unsafe-inline` foi adicionado. Se um dia houver: `script-src` bzrcdn.openai.com; `connect-src` bzr.openai.com e bzrcdn.openai.com; `img-src` bzr.openai.com, com nonce/hash. **Query string (oppref/utm):** `/parceiros` → loja já repassa tudo (exceto `v`/`lancar`, internos); o único outro redirect do app que descartava a query (`/produto/<slug antigo -5l/-500ml>`) agora repassa; o middleware (301 de URLs antigas) já clona a URL com a query; `skipTrailingSlashRedirect` está ligado (sem redirect de barra). www/domínio é configuração da Vercel (conferir lá).
- **6. Políticas:** parágrafo do item 8 do pedido (texto literal) em **Política de Privacidade** (seção 9.1) e **Política de Cookies** (seção 9; Contato virou 10), com botão "Configurar cookies"; data de atualização: 18/10/2026.
- **7. Testes (pedido 1 a 6):** `scripts/pixel-chatgpt-ads.test.mjs` (10): sem aceite nada carrega; ordem consent false → init → consent true, script uma vez, sem `user`; retirada apaga cookies; `order_created` com centavos/BRL/event_id/opt_out, uma vez e sem `*_sha256`; evento do servidor em PGlite (pago/b2b/pendente/boleto/arquivado/brinde); onde carrega; query string; fiação e CSP; banner com mesmo destaque; políticas. Verificação no navegador: banner, sem script antes do aceite, script depois, retirada limpa `__oppref`, `/admin` sem pixel, `?oppref=teste&utm_source=chatgpt` intacto na URL. **Não** testado de ponta a ponta: o disparo real de `order_created` com pedido pago (exige banco/pagamento); falta o Luis conferir no painel (Conversões → Fluxo de eventos) após publicar.
- **Prints do banner:** `docs/prints-r10-r11/pixel-banner-375.jpg`, `pixel-banner-configurar-375.jpg`, `pixel-banner-desktop.jpg`.

## Arquivos do B2C tocados (mínimo)
`src/app/layout.tsx` (banner + pixel), `src/components/layout/SiteFooter.tsx` (link "Configurar cookies"), `src/app/privacidade/page.tsx` e `src/app/cookies/page.tsx` (parágrafo do pixel), `src/app/acompanhe/[token]/page.tsx` (evento de Compra), `src/app/checkout/page.tsx` (evento de Compra quando paga), `src/app/produto/[slug]/page.tsx` (redirects de slug antigo mantêm a query). B2B: `B2BCheckoutContent.tsx`, `parceiros/page.tsx`, `lib/b2b/partners.ts`. Novos: `lib/{consent,pixel,pixel-event,forward-query}.ts`, `components/consent/*`, `api/orders/pixel-event`.

---

## ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★ Ajuste da Rodada 11 (18/10/2026), sobre `6bb5722`

Valem sobre a entrada da Rodada 11 abaixo (onde houver diferença, vale esta).
1. **Kit Pet 12 = 13 unidades:** +1 Ansiedade (Ansiedade 3 = 2 no display + 1 de reposição), **R$ 258,70** (igual ao Adulto). Card: "13 unidades (12 no display + 1 Ansiedade de reposição) · display grátis" (a mesma frase do compacto Adulto). Opção do card continua "12" (tamanho do display); mostra 13 un.
2. **Kit Provador It's Blossom** é do **aromatizador** (Home Care; existem sabonetes líquidos e aromatizadores It's Blossom): renomeado para **"Kit Provador Aromatizador It's Blossom"**, linha Home Care (aromatizadores). Código **BIO-PROV-ITSBLOSSOM** mantido; **BIO-PROV-AMBPET** continua. (O texto da Rodada 11 sobre "It's Blossom não existe no catálogo / linha Home Care" fica resolvido por esta definição.)
3. **Dose Única:** os **6 SKUs, 2 de cada = 12 unidades**.
4. **Baby:** os **11 SKUs, 2 de cada = 22 unidades**. Fácil de mudar: constantes `BABY_SKUS` e `DOSE_UNICA_SKUS` no topo de `src/lib/b2b/displays.ts` (todo display "ranked" é só nº de SKUs + quantos levam 2).
5. **/parceiros:** o redirecionamento para `/b2b/oferta/<token>` **repassa a query string** — `utm_*`, `fbclid`, `gclid` e qualquer outro — exceto os **internos** `v` (código do vendedor) e `lancar` (modo lançamento). Função `withForwardedParams` (`lib/b2b/partners.ts`), testada (codificação, valores repetidos, vazios, path que já tem `?`).
6. **Faixa do display:** "O display Bio Florais ocupa só 15 × 15 cm. **8 florais**, 12 unidades. Cabe ao lado do caixa e vende sozinho."
- `DISPLAYS_COMPOSICAO.md` atualizado (Pet 13, Baby 22, Dose Única 12 e o Kit Provador).
- **SQL (aditivo, só o nome do produto interno):** `42a_ajuste_displays_conferencia_one_shot.sql` (somente leitura; **conferência pelo slug `adulto-%`** — 33 florais Adulto, kit compacto 8 SKUs, Pet 12 = 9 SKUs, Baby 11, Dose Única 6, aromatizadores Home Care, nome do Kit Provador) → `42b_ajuste_displays.sql` (BEGIN/COMMIT, idempotente, linha final `ok`; só um UPDATE em `products.name` do slug `bio-prov-itsblossom`) → rodar o 42a de novo (`kit_provador_itsblossom_ok = true`). Quem **ainda não rodou o 41b** não precisa do 42b: o 41b já cria com o nome novo. Pet 13, Dose Única 12 e Baby 22 são regra do app (sem SQL).
- **Testes:** `b2b-displays.test.mjs` atualizado e ampliado (Pet 13 = R$ 258,70 e frase do card; Baby 11 × 2 = 22; Dose Única 6 × 2 = 12; faixa "8 florais"; 42a/42b em PGlite; `/parceiros` com utm).

---

## ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★ Rodada 11 · Displays, kits e Kit Provador — BIO (17/10/2026), sobre `fc6ff1e`

Fonte de verdade: `DISPLAYS_COMPOSICAO.md`. **B2C intocado** (nenhum arquivo do B2C foi alterado; os produtos internos novos ficam na tabela `products`, que o B2C não lista: ele lê o catálogo do site). My Pet/Secreta: não fazem parte desta janela.

## SQL e ordem: **SQL → conferência → push**
1. `41a_displays_conferencia_one_shot.sql` (somente leitura, 1 linha JSON; roda antes do 41b sem erro) — confere pelo slug (`adulto-%`, `pet-floral-em-gotas-%`, `baby-%`, `kids-%`, `teen-%`, `infantil-%`, `virtudes-divinas-%`, `dose-unica-%`) e os SKUs do kit compacto (esperado **8**) e do Pet 12 (esperado **9**).
2. `41b_displays_mostruario.sql` (aditivo, idempotente, BEGIN/COMMIT, **linha final `ok`**): 3 colunas em `b2b_showcase_groups` (`window_days`, `fixed_price_cents`, `highlight`), **14 produtos internos** e 2 grupos do mostruário. Não apaga nem altera nada existente. Exige o 39b (aborta com mensagem clara se não existir).
3. Rodar o `41a` de novo: `colunas_grupos_ok = true`, `produtos_internos_displays = 12`, `produtos_internos_provador = 2`, `grupos_displays_e_provador = 2`.
Sem o 41b o app **não quebra**: displays do lojista funcionam (não dependem de SQL); só o mostruário não mostra displays/Kit Provador.

## Códigos internos criados (para o Luis cadastrar no Omie)
| Código | Slug (produto interno, minúsculas) | Peso / medidas |
|---|---|---|
| BIO-DISP-ADULTO-COMPACTO · -ADULTO-MEDIO · -ADULTO-GRANDE | bio-disp-adulto-compacto · -medio · -grande | 200 g · 30 × 30 × 3 cm |
| BIO-DISP-PET-12 · -PET-30 · -PET-44 | bio-disp-pet-12 · -30 · -44 | 200 g · 30 × 30 × 3 cm |
| BIO-DISP-BABY · -KIDS · -TEEN · -INFANTIL | bio-disp-baby · -kids · -teen · -infantil | 200 g · 30 × 30 × 3 cm |
| BIO-DISP-VIRTUDES-DIVINAS · BIO-DISP-DOSE-UNICA | bio-disp-virtudes-divinas · bio-disp-dose-unica | 200 g · 30 × 30 × 3 cm |
| BIO-PROV-ITSBLOSSOM | bio-prov-itsblossom (Kit Provador floral de ambiente It's Blossom) | 8 g · 6 × 2 × 2 cm |
| BIO-PROV-AMBPET | bio-prov-ambpet (Kit Provador floral de ambiente Pet) | 8 g · 6 × 2 × 2 cm |
O display do **kit do lojista** não é item nem tem produto: é brinde na sacola e vai ao Omie só como observação (a observação usa o nome: "+ 1 Display compacto Florais Adulto (brinde)").

## Lojista (link da oferta, loja pública /parceiros e Lançar pedido — mesmos componentes)
- **Selo "Com display"** nos cards das linhas com display ligado (Adulto, Pet, Baby, Kids, Teen, Infantil, Virtudes Divinas, Dose Única).
- **Faixa do display compacto** (texto exato do pedido, botão "Quero o kit com display") **entre a linha "Meus pedidos / Acompanhar pedido" e o título "Sua oferta"/"Nossas linhas"**, no mesmo estilo dos cards de linha (borda, raio, sombra); foto à direita no desktop e **em cima no celular**. O botão leva a `/linha/adulto?kit=adulto-compacto`, onde o card do kit já abre destacado.
- **Dentro da linha, como PRIMEIROS cards** (mesmo componente dos produtos: contêiner, foto quadrada, selo, título, preço e botão iguais; selo reaproveitado, "Display" no padrão do selo de tipo e "Destaque" no padrão do selo da promoção): Adulto = "Kit display compacto 15 × 15" (destaque) + "Escolha seu display" (Compacto 13 un. · Médio 30 · Grande 60); Pet = "Escolha seu display" (12 · 30 · 44); Baby, Kids, Teen, Infantil, Virtudes Divinas, Dose Única = UM card "Kit com display". Nenhuma tabela de outra linha dentro da linha.
- **Foto:** `public/b2b/displays/<nome-fixo>.webp|jpg|jpeg|png`; **sem arquivo, o card usa a imagem da própria linha + selo "Display"** (verificado: Pet mostra a arte da linha). `adulto-compacto.webp` já publicada (otimizada de 227 KB para 87 KB). Nomes fixos: adulto-compacto, adulto-medio, adulto-grande, pet-12, pet-30, pet-44, baby, kids, teen, infantil, virtudes-divinas, dose-unica. Basta colocar o arquivo e publicar.
- **Kit compacto = 13 un. (Ansiedade 3) = R$ 258,70** (8 SKUs; acima do mínimo) + display grátis. Texto do card: "13 unidades (12 no display + 1 Ansiedade de reposição) · display grátis".
- **Composição fixa** (o lojista não escolhe sabores) e **"N mais vendidos" = a ordem dos cards da linha no site, lida na hora** (Adulto/Pet: `bioCommercialOrder`; demais linhas: ordem do catálogo; Snack fora). Médio = 24 SKUs/30 un. (6 primeiros × 2, 18 × 1); Grande = 30 × 2 = 60; Pet 12 (2 de Ansiedade, Lambedura, Estresse; 1 de Agressividade, Coprofagia, Hiperatividade, Latido Excessivo, Medo, SOS) = 12; Pet 30 = 24 SKUs/30; Pet 44 = 22 × 2; Baby/Kids/Teen/Infantil 10 × 2 = 20; Virtudes Divinas 36 × 1; Dose Única 5 × 2 = 10.
- **Display sai se o kit ficar incompleto:** a sacola remove o display e mostra o aviso "O display vem grátis com o kit completo: ele saiu da sacola porque o kit ficou incompleto." O servidor revalida (cotação e pedido recusam kit incompleto, display desligado ou chave inválida).
- **Sacola/checkout:** linha "1× Display … (brinde) R$ 0,00". Preço dos itens = preço B2B normal; promoções, mínimo, cupom, Pix/cartão/boleto e comissão seguem as regras normais (o display não entra na base de comissão: não é item).
- **Frete:** cada display soma **200 g, 30 × 30 × 3 cm** na cotação do Melhor Envio.
- **Omie:** só observação do Pedido de Venda: o feed da Central (`omieObservation`) devolve "+ 1 Display compacto Florais Adulto (brinde)" (junto da de mostruário, se houver); o admin do pedido mostra a mesma linha. O display fica em `commercial_adjustments_json.displays`.

## Mostruário (vendedor)
- **Destaque no topo** (selo "Destaque"): **Kit Provador dos florais de ambiente (It's Blossom e Pet) por R$ 2,00 fixo**, 1 de cada, fora do %. **Confirmação de catálogo:** o floral de ambiente Pet é da linha Cosméticos Pet (`cosmeticos-pet-floral-de-ambiente-*`); **"It's Blossom" não existe no catálogo do site** — o produto interno foi criado na linha Home Care (única linha de ambiente), com o nome "It's Blossom"; conferir com o Luis se a linha/nome estão certos.
- **Grupo "Displays":** o vendedor pede o display VAZIO por **R$ 3,00** (fixo), **1 por linha a cada 180 dias** (janela PRÓPRIA do grupo, `window_days`; os 3 displays do Adulto dividem a mesma cota; os do Pet também), com foto (quando existir) e "libera de novo em dd/mm". Displays e Kit Provador **não consomem o teto de unidades da linha** (Florais Adulto continua 3).
- Preços e a janela de 180 dias são constantes do SQL por enquanto (edição completa fica para a rodada do Admin).

## Admin (mínimo)
Nova aba **Displays**: liga/desliga cada um dos 12 displays (some da loja do link, da faixa e do selo). Guardado em `b2b_settings.displays_disabled` (sem SQL novo). Brinde de provador 5 ml: é da Secreta, não se aplica à Bio.

## Verificação
- **Testes novos:** `scripts/b2b-displays.test.mjs` (11): kit compacto 13 un./R$ 258,70; Pet 12; "mais vendidos" = ordem do site; demais linhas; remover item tira o display; frete 200 g; observação Omie; fotos com fallback; cards por linha; liga/desliga; 41a/41b em PGlite (idempotente, conferência, preço R$ 3,00/R$ 2,00, limite 1/linha/180 dias, destaque, fora do teto da linha); mesmo componente dos cards de produto; B2C intocado.
- **Prints (375 px e desktop):** `docs/prints-r10-r11/r11-*.jpg` (faixa entre "Meus pedidos/Acompanhar pedido" e "Sua oferta", selo "Com display", kit compacto com foto, "Escolha seu display" com variações, fallback da linha no Pet, display como brinde R$ 0,00 e aviso ao remover item). Tirados com os componentes reais numa página de QA com o catálogo real (removida antes do commit).
- **Não percorrido ao vivo:** o pedido ponta a ponta com frete (Melhor Envio) e o mostruário real exigem banco/credenciais; cobertos por testes de servidor/SQL.

---

## ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★ Rodada 10 · Painel do vendedor claro (17/10/2026), sobre `c427fe4`

**Sem SQL.** Só nomes e layout; rotas e dados não mudam. Mesmos textos das 3 marcas (muda só o nome da marca). Botões ≥ 44 px.

- **Ordem do painel (375 px primeiro):** "Olá, {primeiro nome}. O que você quer fazer agora?" → **1. Montar oferta para um cliente** (card maior, cor da marca, título 3xl; botões [Escolher cliente ▾] e [+ Cliente novo]; abaixo [Usar uma oferta pronta]) → **2. Lançar pedido** (texto + botão) → **3. Links rápidos — preço de lojista, sem promoção** (3a "Link com o nome do cliente", era "Link padrão"; 3b "Link geral para divulgar", era "Meu link de captação"; "Não sabe qual usar?" abre o comparativo) → **4. Mostruário** → **5. Meus clientes**.
- **Comparativo "Qual link eu uso?"** (fechado por padrão): 3 colunas (empilham no celular) com Promoção / Nome do cliente / Quando usar / Sua comissão e uma **miniatura HTML/CSS ~120 px** (sem foto) de como o cliente vê: "Olá, Pet Honjo" + "Leve 3 pague 2"; "Olá, Pet Honjo" + "Preço de lojista"; "Preço de lojista" + "Identifique-se ao finalizar".
- **Meus clientes:** cada cartão tem [Nova oferta] (principal, nunca escondido), [Copiar link] [WhatsApp] [QR] e "Oferta ativa desde dd/mm" (ou "Ainda sem oferta ativa"). O link é lido na hora (só do próprio vendedor).
- **Ofertas prontas** (era "Minhas ofertas padrão"): título novo, explicação "Monte uma vez as linhas e promoções que você mais usa e aplique em qualquer cliente em 1 clique.", botão grande **[+ Criar oferta pronta]**, e em cada modelo botões **[Usar com um cliente]** e **[Editar]** (+ Excluir). Rotas/dados iguais.
- **Demonstração:** mesmos cards; "Lançar pedido" e "Mostruário" ficam ocultos (ações que criam pedido real seguem bloqueadas como antes).
- **Resumo do mês:** opcional na especificação, não incluído (não empurra o card principal).
- **Arquivos:** `b2b/painel/page.tsx`, `modelos/page.tsx`, componentes novos `OfferForClientCard`, `ClientCardActions`, `LinkChooser`; `NewClientForm` (props de botão), `QuickLinkPanel`, `ReferralLinkPanel`, `TemplatesPanel`; testes: novo `b2b-painel-clareza.test.mjs` e 3 asserções de texto antigas atualizadas.
- **Prints (375 px e desktop):** `docs/prints-r10-r11/r10-*.jpg` (painel, comparativo aberto, Ofertas prontas), tirados com os componentes reais numa página de QA com dados de exemplo (removida antes do commit; o painel real exige sessão e banco).

---

## ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★ Área do vendedor sem links para o B2C (16/10/2026), sobre `2895775`

**Conferência:** painel, clientes, ofertas, lançar pedido, mostruário, comissões, modelos, cadastro, login e telas de demonstração. B2C intocado.

- **Já estava ok:** logo do painel leva a `/b2b/painel`; o rodapé e os elementos flutuantes do B2C ficam ocultos em `/b2b/*` (`body > footer` oculto no layout B2B + `HideOnB2B`); "Sair" volta a `/b2b/login`.
- **Corrigido:** (1) o cabeçalho do vendedor não tinha "Lançar pedido" nem "Mostruário": agora é **Meus clientes · Lançar pedido · Mostruário · Minhas comissões · Sair** (os dois novos só para vendedor real, não na demonstração; com teste vencido só aparece Sair, como antes); (2) telas `demo-expirada` e `demo-invalido` tinham "Ir para o site" (`/`): agora "Entrar na área do representante" (`/b2b/login`); (3) o login do vendedor tinha "Voltar ao site" (`/`): removido.
- **Fora do escopo (mantido):** a loja do link do CLIENTE (`/b2b/oferta/…`, checkout e "Acompanhe seu pedido"/Política de privacidade) é a página do lojista, não a área do vendedor.
- **Teste:** `scripts/b2b-area-vendedor-sem-b2c.test.mjs` varre painel + componentes B2B + login/demo e falha se aparecer qualquer `href`/`router.push` fora de `/b2b` ou `/api`; também confere o cabeçalho (logo → painel, menu completo, Sair).

---

## ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★ Rodada 9 · Pedido lançado pelo vendedor — "Lançar pedido" (16/10/2026), sobre `50c96a4`

**O que é:** botão grande **"Lançar pedido"** no painel do vendedor (`/b2b/painel/lancar-pedido`). O vendedor escolhe o cliente e a oferta e monta o pedido na **mesma loja do link** (cards de linha → produtos, preço B2B, promoções da oferta) e no **mesmo checkout B2B**; o servidor revalida tudo. **B2C intocado.** Demonstração não cria pedido real.

- **Fluxo:** (1) cliente dele OU **novo** (razão social/nome, CNPJ/CPF com dígitos verificadores, e-mail, WhatsApp; aviso LGPD "Dados informados pelo representante com autorização do cliente."); (2) oferta: **Sem promoção** (cria o link padrão, preço B2B normal), uma **oferta ativa** do cliente (com as promoções/elegibilidade/bonificação/desconto já configurados no Offer Builder) ou **Montar oferta com promoções** (Offer Builder existente); (3) abre a loja do link com `?lancar=1` (faixa roxa "Modo lançamento"); (4) carrinho e checkout normais.
- **Regra de dono:** CNPJ/CPF que já é cliente de OUTRO representante → recusado ("Cliente atendido por outro representante.", 409), no cadastro do cliente **e** de novo na criação do pedido (servidor). Se já é cliente deste vendedor, reaproveita o cadastro (sem duplicar). O documento digitado no checkout passa a identificar o cliente (só preenche onde está vazio).
- **Checkout em modo lançamento:** dados do cliente pré-preenchidos (só o vendedor dono recebe, `/api/b2b/launch/buyer`), endereço de entrega digitado no fechamento, todas as regras B2B (mínimo R$ 250, ordem de cálculo, parcela mínima R$ 500, frete B2B, boleto só PJ 28/42/56). Mostra a **comissão estimada** (base + extra já com a promoção; só o vendedor vê — a cotação só devolve se a sessão do dono for válida).
- **Pagamento:** **Pix** = QR/copia-e-cola na tela + botão "Enviar Pix por WhatsApp"; o pedido fica aguardando até pagar. **Boleto PJ** = igual ao checkout normal. **Cartão** = o vendedor NUNCA digita o cartão: aparece o **link de pagamento** (`/b2b/pagar?pedido=…&b2b=…`) com Copiar e Enviar por WhatsApp; o cliente paga no celular com o Card Brick (mesma rota do cartão, mesma trava de token/valor/parcelas).
- **Autorização do lançamento (servidor):** `launched=true` só vale com sessão válida do vendedor **dono da oferta**, ativo e fora da demonstração; cliente que abra `?lancar=1` ou mande `launched` sem sessão é recusado (401/403). **Vendedor em teste pode lançar** (a comissão fica retida até completar o cadastro, como hoje).
- **Pedido:** `orders.origin = 'vendedor'` (SQL 37b; aparece no Acompanhamento do admin como "Lançado pelo vendedor"), comissão normal congelada por item (mesmo snapshot do pedido de link — extraído para `order-snapshots.ts`, usado na criação e na prévia), Central/Omie normais (vendedor no Omie = nome do cadastro ou o alterado). Aparece em Minhas comissões e na Central. O cliente continua com o link permanente da oferta para recompras e o vendedor pode reenviar (OfferLinkActions existente).
- **Arquivos novos:** `lib/b2b/vendor-launch.ts`, `launch-constants.ts`, `order-snapshots.ts`; APIs `api/b2b/launch/{clients,offers,buyer}`, `api/b2b/orders/pay-info`; `b2b/painel/lancar-pedido/page.tsx`, `b2b/pagar/`, `components/b2b/{LaunchOrder,LaunchModeMarker}.tsx`; alterados: `orders/create`, `shipping/quote`, `B2BCheckoutContent.tsx`, layout da oferta, painel, tracking admin; teste `scripts/b2b-lancar-pedido.test.mjs` (7 testes).
- **SQL: nenhum novo.** Depende do **35b** (coluna `b2b_clients.document`) e do **37b** (`orders.origin`), já aplicados. Sem eles o app não quebra: o cliente é cadastrado sem documento e o pedido sai sem origem.
- **Teste manual:** (1) painel → Lançar pedido → Novo cliente com CNPJ de outro vendedor → mensagem de bloqueio; (2) CNPJ novo → Sem promoção → loja com faixa roxa → carrinho (mínimo R$ 250) → checkout com cliente pré-preenchido e comissão estimada; (3) Pix: QR + WhatsApp; cartão: link de pagamento (abrir no celular e pagar com cartão de teste); PJ: boleto; (4) admin → Acompanhamento mostra "Lançado pelo vendedor"; Minhas comissões mostra o pedido; (5) abrir o link do cliente com `?lancar=1` sem estar logado: checkout recusa o lançamento.
- **QA no navegador (375 px):** cadastro de cliente (LGPD, bloqueio de CNPJ de outro representante) e escolha da oferta verificados, sem rolagem horizontal; a página de QA com API simulada foi removida antes do commit. O checkout em modo lançamento e a página de pagamento do cartão foram cobertos por testes de código/servidor, não percorridos no navegador (dependem de sessão e do Mercado Pago).
- **Limitações:** "Sem promoção" cria uma nova oferta padrão a cada uso (como o "Link padrão" do painel); modelos de oferta ("Minhas ofertas padrão") não estão na tela de escolha, só por Offer Builder.

---

## ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★ Mostruário: adendo 15/10 e TABELA FINAL do Luis (16/10/2026), sobre `ec6276b`

**Prevalece a tabela final.** Todo limite conta UNIDADES somadas na janela móvel (45 dias, admin); novo **teto por linha** (unidades somando todos os itens da linha na janela), configurável no admin.

- **Teto por linha:** padrão = soma dos limites dos grupos que têm produto da linha; o admin sobrescreve em Admin → B2B → Mostruário → "Teto por linha" (Salvar / "Padrão" volta ao automático). Fica em `b2b_showcase_line_caps` (só linhas alteradas; sem linha na tabela vale o padrão).
- **Valores resultantes (Bio):** Florais Adulto **3** · Pet **3** · Infantil, Baby, Kids, Teen, Virtudes Divinas, Dose Única **2** cada · Cosméticos **5** (shampoo 1, Murumuru 1, creme de mãos 1, creme corporal 1, sabonete líquido 1) · Cosméticos Pet **4** (shampoo 1, perfume 1, floral de ambiente 1, spray para hálito 1) · Home Care **2**. Condicionador segue fora (regra fixa).
- **Home Care entra com 1 de cada tipo.** Tipos encontrados no catálogo: **Aromatizador Spray** (5 itens: Bem Estar, Harmonia, Limpeza e Proteção, Reequilíbrio do Ambiente, Serenidade; 50 g) e **Sabonete Líquido** (9 fragrâncias; 315 ml). Grupos: "Home Care · Aromatizador" (1) e "Home Care · Sabonete líquido" (1) → teto 2.
- **Tela:** em cada grupo, "Você ainda pode pedir N desta linha (Linha: teto de X a cada 45 dias, libera em dd/mm)"; o "+" trava no teto da linha (soma entre grupos) e no limite do grupo.
- **Servidor revalida grupo E teto:** cotação e criação usam a mesma validação (`validateShowcaseCart` com `lineQuotas`); depois de gravar o pedido o servidor reconfere grupo e teto (corrida entre dois pedidos: o excedente é cancelado).
- **SQL (ordem, depois do 39b):** (1) `40a_mostruario_tabela_final_preflight_one_shot.sql` (somente leitura, 1 linha JSON; roda sem erro mesmo antes do 39b) → (2) `40b_mostruario_tabela_final.sql` (aditivo, idempotente, BEGIN/COMMIT, **não apaga nada**): cria `b2b_showcase_line_caps`; AJUSTA o grupo de florais do 39b (só se ainda estiver como o seed) para as demais linhas com 2 por linha, incluindo Virtudes Divinas e Dose Única, e renomeia para "Florais (por linha)"; cria (só se o nome não existe) "Florais · Adulto" (3), "Florais · Pet" (3) e os 2 grupos de Home Care. Grupo que o admin já editou/renomeou não é sobrescrito.
- **Sem o 40b** o app continua funcionando com os grupos do 39b (teto padrão calculado; só os valores novos da tabela final não valem).
- **Arquivos:** `showcase.ts` (linha-quota, `buildShowcaseLineQuotas`, `findShowcaseOverLimit`), `showcase-state.ts`, `showcase-quote.ts`, `api/b2b/showcase/orders`, `api/admin/b2b/showcase`, `ShowcaseStore.tsx`, `ShowcaseTab.tsx`, `painel/mostruario/page.tsx`, `scripts/b2b-mostruario.test.mjs` (+4 testes).
- **Teste manual:** admin vê os tetos (Adulto 3 … Home Care 2); mudar Cosméticos para 2 e tentar shampoo + creme de mãos + creme corporal → recusado no 3º ("Teto da linha"); comprar florais Adulto: o 4º é recusado; depois do pedido a tela mostra "libera em dd/mm".
- **Observação:** a alteração de tela (frase do teto) não foi reconferida no navegador nesta rodada; a lógica está coberta pelos testes.

---

## ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★ Mostruário do vendedor/RCA (13/10/2026), sobre `8b2b593`

**O que é:** botão **"Solicitar mostruário"** no painel do vendedor (`/b2b/painel/mostruario`): loja interna só com itens liberados, preço de mostruário, só o menor volume, limites por grupo/linha numa janela móvel de dias. Só área do vendedor + admin; **B2C e as rotas B2C intocados**. Decisões do Luis (13/10) aplicadas: condicionador fora de tudo (inclusive combo), frete SEMPRE regional, Pix ou cartão, sem mínimo.

- **Preço:** % do B2C (padrão 15, admin) com o arredondamento "reais + 0,90" do B2B (`roundB2BUnitPriceCents`). Ex.: floral R$ 35,90 → R$ 5,90; perfume pet 120 ml R$ 34,90 → R$ 5,90.
- **Itens:** cada produto cai no 1º grupo ATIVO que o aceita (linha/categoria/nome contém/não contém). Fora de grupo = indisponível. **Linha nova nunca entra sozinha** (grupo novo nasce desativado). Condicionador sai por regra fixa do código. "Só menor volume" por grupo: pet shampoo 500 ml sim / 5 L não; perfume 120 ml sim / 500 ml não.
- **Limites (seed Bio, 39b):** Florais 2 por LINHA (adulto, infantil, baby, pet, kids, teen); Shampoo 1; Shampoo Murumuru 1; Creme de mãos 1; Creme corporal 1; Sabonete líquido 1; Pet: shampoo 1, perfume 1, floral de ambiente 1, spray para hálito 1. Dose Única e Virtudes Divinas ficam **fora** (o texto do Luis tinha "…"): o admin liga se quiser.
- **Janela:** soma das unidades do vendedor nos últimos N dias (padrão 45) em pedidos de mostruário **pagos** ou **pendentes há < 60 min** (reserva). A tela mostra "Você ainda pode pegar X de Y" e "Libera de novo em dd/mm" (compra mais antiga da janela + N dias). O servidor revalida na cotação e na criação; e confere de novo depois de gravar (corrida entre dois pedidos: o excedente é cancelado).
- **Quem pode:** vendedor/RCA ativo, não demonstração, cadastro COMPLETO (`profile_completed_at`/sem teste + CPF ou CNPJ + endereço completo). Em teste/incompleto: tela "Complete seu cadastro" com link. Demonstração nunca.
- **Pedido:** comprador = dados do cadastro do vendedor (endereço editável; UF conferida pelo CEP), frete = tarifa regional (Sul/Sudeste R$ 9,90; CO/NE exceto CE R$ 35,90; Norte + CE R$ 169,90) na modalidade mais barata, custo real preservado em `shipping_cost_cents`. **Sem cupom, sem promoção, sem comissão e sem desconto Pix** (total = produtos + frete; decisão minha: o preço de mostruário já é o preço final). Cartão em 1x (regra de parcela mínima do B2B).
- **Marcação:** `orders.origin = 'mostruario'` (coluna do SQL 37b; **sem coluna nova em orders**), `b2b_offer_id` e `b2b_client_id` nulos, `b2b_responsible_*` do vendedor, observação "PEDIDO DE MOSTRUÁRIO – vendedor <nome>" em `commercial_adjustments_json`. Fica fora de comissões, de "Acompanhamento", de boletos e da contagem de vendas do vendedor porque todas essas consultas já exigem oferta (`b2b_offer_id IS NOT NULL`); a lista de vendedores do admin ganhou `isNotNull(orders.b2bOfferId)` para não contar mostruário.
- **Admin de pedidos:** selo roxo **MOSTRUÁRIO** na lista e no detalhe (+ "PEDIDO DE MOSTRUÁRIO – vendedor X").
- **Central/Omie:** `GET /api/central/orders` (Separação/Rastreio/Enviados) devolve, em todos os pedidos, campos novos **opcionais**: `showcase`, `seller`, `omieVendor` (nome no Omie efetivo = campo do admin ou nome do cadastro) e `omieObservation` ("PEDIDO DE MOSTRUÁRIO – vendedor <nome>" só nos de mostruário). A Central (My Pet) precisa ler `omieObservation` para a observação do Pedido de Venda e destacar `showcase`; quem lê o banco direto usa `orders.origin = 'mostruario'` e `b2b_responsible_name`.
- **Pagamento:** as rotas Pix (Mercado Pago e Lunium) e cartão passaram a usar `verifyB2BOrderPaymentAccess`: pedido com oferta = token da oferta (igual); pedido de mostruário = sessão do próprio vendedor (cookie + `b2b_responsible_id` do pedido; demo nunca). Boleto não muda (mostruário não tem boleto).
- **Admin → B2B → "Mostruário":** % do preço, janela em dias, grupos (nome, linhas, categorias, nome contém/não contém, limite, por linha, só menor volume, ativo; novo = desativado), lista dos pedidos de mostruário.
- **Arquivos novos:** `src/lib/b2b/showcase.ts` (regras puras + consultas), `showcase-state.ts`, `showcase-quote.ts`, `showcase-order-access.ts`, `order-payment-access.ts`, `api/b2b/showcase/{quote,orders}`, `api/admin/b2b/showcase`, `b2b/painel/mostruario/page.tsx`, `components/b2b/ShowcaseStore.tsx`, `components/admin/b2b/ShowcaseTab.tsx`, `scripts/b2b-mostruario.test.mjs`.
- **SQL (ordem):** (1) `39a_mostruario_preflight_one_shot.sql` (somente leitura, 1 linha JSON; roda antes do 39b sem erro) → (2) `39b_mostruario.sql` (aditivo, idempotente, BEGIN/COMMIT: tabela `b2b_showcase_groups`, 2 linhas em `b2b_settings` e seed dos 10 grupos só se a tabela está vazia). Pré-requisitos já aplicados: 14b e 37b. Sem o 39b o app não quebra: a tela diz "em breve" e o admin avisa.
- **Teste manual:** (1) admin → Mostruário: conferir 15% / 45 dias e os 10 grupos; (2) vendedor com cadastro completo → "Solicitar mostruário": só shampoo 300 ml humano / 500 ml pet, nenhum condicionador, florais por linha; (3) pedir 2 florais Adulto e tentar um 3º → recusado, e a linha Adulto mostra "Limite atingido · Libera de novo em dd/mm" enquanto Infantil segue com 2; (4) frete = tarifa da UF, total = produtos + frete, Pix e cartão; (5) pedido aparece no admin com selo MOSTRUÁRIO, na Separação da Central com `showcase`/`omieObservation`, e **não** aparece em Comissões/Acompanhamento; (6) vendedor em teste ou demonstração: bloqueado.
- **QA no navegador:** loja, passo de entrega/frete e Pix verificados a 375 px (sem rolagem horizontal) e em desktop com API simulada (a página de QA foi removida antes do commit).

---

## ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★ Nome do vendedor no Omie: padrão = nome do cadastro (13/10/2026), sobre `c271aa6`

- **Regra:** sem preencher nada, o "Nome no Omie" é o NOME COMPLETO do cadastro do vendedor (espaços normalizados, máx. 70). Admin → B2B → Vendedores: campo "Nome no Omie (padrão: nome do cadastro)" com selo padrão/alterado e botão **Alterar** (para quem já existe no Omie com outro nome); salvar vazio volta ao padrão.
- **Leitura sem SQL:** a lista do admin mostra o nome efetivo (gravado ou nome do cadastro). Para a Central (que lê a coluna `omie_vendor_code`), `ensureOmieVendorDefault` grava o padrão onde está vazio no cadastro do vendedor e no primeiro pedido; nunca sobrescreve e nunca toca vendedor de demonstração.
- **SQL opcional (aditivo, só preenche vazio, sem demo):** `38a_omie_nome_padrao_preflight_one_shot.sql` (leitura) e depois `38b_omie_nome_padrao.sql` (BEGIN/COMMIT, idempotente). Adianta a exportação dos vendedores antigos; o app funciona sem ele.
- **Arquivos:** `src/lib/b2b/omie-vendor.ts`, `api/b2b/orders/create`, `api/b2b/invites/accept`, `api/admin/b2b/responsibles` (lista e `[id]`), `ResponsiblesTab.tsx`, `scripts/b2b-omie-vendor.test.mjs`.
- **Teste manual:** vendedor sem nome no Omie aparece com o nome do cadastro e selo "padrão"; Alterar → salvar nome diferente → selo "alterado"; salvar vazio → volta a "padrão"; vendedor demo segue sem nome no Omie.

---

## ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★ URGENTE B2C: variações com preço em Cosméticos (13/10/2026), sobre `1e822a9`

**SEM SQL. Só a página do produto (`/produto/[slug]`); nada mais do B2C mudou.**
- **Causa:** na página do produto, Shampoo e Condicionador são tratados como "par" (o preço do cabeçalho some) e a tabela de variações (500 ml / 5 L / Combo) só existia para a linha **Cosméticos Pet** (`lineSlug === "cosmeticos-pet"`). Para **Cosméticos (humano)** o produto virava "par" mas não entrava na tabela: ficava sem preço e só com o botão genérico. O catálogo estava correto (todo item tem preço; conferido para Cosméticos, Cosméticos Pet e Home Care).
- **Correção:** para Cosméticos (humano) aparecem as variações **Shampoo 300 ml**, **Condicionador 300 ml** e **Combo** (Shampoo + Condicionador, 10% de desconto) com preço e "Escolher" (o combo adiciona os dois à sacola). Produto sem par (ex.: "Muru Muru" só shampoo; "Condicionador Premium") mostra só a variação que existe, sem combo. Cosméticos Pet segue com a matriz 500 ml / 5 L; Creme Corpo, Creme Mãos, Sabonete, Aromatizador e perfumes não mudaram.
- **Sacola:** nome completo pelo catálogo, ex. "Shampoo Uso Diário · Cosméticos · 300 ml" e "Condicionador Uso Diário · Cosméticos · 300 ml".
- **Conferido no navegador** (375 px e desktop, servidor local): `/produto/cosmeticos-shampoo-uso-diario` mostra Shampoo R$ 36,90, Condicionador R$ 39,90 e Combo R$ 69,12; "Escolher" no shampoo e no combo colocaram `cosmeticos-shampoo-uso-diario x2` e `cosmeticos-condicionador-uso-diario` na sacola. Varri as 103 páginas de produto de Cosméticos, Cosméticos Pet e Home Care: todas com preço e botão; os 21 Shampoo/Condicionador de Cosméticos com o bloco de variações.
- Observação (já existia, não mexi): o console do modo desenvolvimento mostra um erro do preload da imagem da galeria (`sizes` com quebra de linha no `ProductGallery`); a página renderiza normalmente.
- Testes: `scripts/b2c-cosmeticos-variacoes.test.mjs`.

## ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★ Visual do B2B: hero do B2C da Bio (11/10/2026), sobre `84da354`

**SEM SQL.** Regra visual do Luis (PLAYBOOK 4b). Novo `B2BHero` (`src/components/b2b/B2BHero.tsx`): o MESMO banner do B2C da Bio (`/assets/home/hero/Hero.png`, gradiente, "Bio Florais · Desde 1997", serifa e cores da Home) com texto de lojista: "Preço de lojista" + "Pedido mínimo R$ 250 · frete especial B2B a partir de R$ 450 · Pix, cartão em até 3x e boleto PJ" (no link do cliente, também "Oferta para <cliente> · atendido por <vendedor>").
- **Onde:** primeira tela do link da oferta e da loja /parceiros (`/b2b/oferta/<token>`), página de linha (`/b2b/oferta/<token>/linha/<slug>`, versão baixa com o nome da linha e o "← Voltar às linhas") e a tela de /parceiros sem vendedor. Cards de linha mantidos; os botões (Meus pedidos, Acompanhar pedido) ficam numa barra fina sob o hero.
- **Fora do B2B (já era e foi conferido):** trio de cards, quiz, convite UGC/criadora, depoimentos e blocos institucionais; o carrinho/"Seja uma criadora"/barra de linhas do B2C seguem ocultos em `/b2b/*` e `/parceiros` (`HideOnB2B`).
- **Verificado no navegador** (componente real numa página temporária, depois removida): 375 px sem rolagem lateral, hero idêntico ao mobile do B2C, título e texto legíveis; desktop com o hero em faixa mais baixa que a Home e o texto fora do rosto da imagem. As páginas reais exigem token/banco; a verificação foi do componente + cards de linha. Testes: `scripts/b2b-hero-visual.test.mjs`.

## ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★ Rodada 7 · /parceiros vira a LOJA B2B pública (11/10/2026), sobre `684c2d6`

**ORDEM: backup Neon (`bio-florais`) → `37a_loja_publica_preflight_one_shot.sql` (1 linha JSON, só leitura) → `37b_loja_publica.sql` (BEGIN/COMMIT, aditivo, idempotente; confere cada coluna antes de criar, `lock_timeout` de 10 s) → push.** O 35b já precisa estar aplicado. SQL 37b: `b2b_offers.is_storefront` (índice único: no máximo uma vitrine por vendedor), `orders.origin` e `orders.origin_code`. **Sem o 37b a loja não abre** (`/parceiros` mostra só "Falar com um representante"); o resto do site não muda.

- **O que o lojista vê:** `https://www.bioflorais.com.br/parceiros` (ou `/parceiros?v=<código>` do flyer do vendedor) abre direto a loja B2B: topo "Preço de lojista · pedido mínimo R$ 250 · frete especial B2B a partir de R$ 450 · Pix, cartão em até 3x e boleto PJ", cards das linhas → página da linha → produtos com foto, preço B2B normal e quantidade → sacola → checkout. São os MESMOS componentes do link do cliente (a vitrine é uma oferta padrão, sem promoção, de cada vendedor). Sem formulário na página. noindex continua. "Quero ser representante" ficou só como link discreto no rodapé da loja (`B2B_DEMO_CTA_URL`).
- **Identificação no checkout** (o formulário do checkout B2B de sempre: nome/razão social, CNPJ ou CPF, IE para PJ, e-mail, WhatsApp, endereço) + aviso LGPD "Seus dados serão usados para contato comercial, conforme nossa Política de Privacidade." Mínimo R$ 250, parcelas, boleto só PJ e frete especial: tudo igual ao B2B.
- **A quem o pedido pertence (resolvido na criação do pedido, no servidor):**
  1. CNPJ/CPF que **já é cliente de um vendedor** ativo (cliente cadastrado por /parceiros com o documento, ou cliente de um pedido anterior desse documento) → o pedido e o cliente ficam com o **DONO** (não troca de dono, mesmo comprando pelo link de outro vendedor); dono inativo ou demo não vale.
  2. Senão → o vendedor do link `?v=<código>` (o código vai embutido no endereço da vitrine, então a navegação não perde); sem código → o **vendedor da casa**. O cliente é criado ligado a ele, com `lead_source = parceiros` e o código.
  3. O pedido aponta para a **oferta padrão do lojista** com esse vendedor (reaproveitada se já existir e não tiver promoção; senão criada), então aparece normalmente no painel do vendedor, no admin, na Central e no Omie (com o Vendedor no Omie dele), com a comissão normal (preço normal + janela de 180 dias por linha) congelada nos itens.
  4. Origem registrada: `orders.origin = 'parceiros'` + `orders.origin_code` (relatório).
- **Depois da compra:** a tela de pedido concluído mostra o acompanhamento e **"Salve este link para comprar de novo"** (o link da oferta padrão do lojista) com Copiar e WhatsApp.
- **Mantido:** "Meu link de captação" do vendedor (`/parceiros?v=`, com Copiar, WhatsApp e QR) e o vendedor da casa no admin. **Removidos:** o formulário "Quero comprar", a API `/api/parceiros/cadastro` e a lista corrida de produtos. A vitrine não aparece como oferta/cliente do vendedor (nem no Acompanhamento do admin).
- **Pagamento:** as rotas de pagamento aceitam o token da vitrine só para pedido de origem `parceiros` (o lojista não conhece o token da oferta dele); demo continua recusado.
- **Ação do Luis:** marcar "Angel Blanc – Comercial" como vendedor da casa no admin (sem ele, `/parceiros` sem `?v=` mostra só a apresentação). Conferir no navegador a loja com banco real: nesta janela o banco não estava disponível, então o fluxo página → checkout → pedido foi coberto por testes (atribuição em PGlite, fios das rotas) e não visto de ponta a ponta.
- **Testes:** `scripts/b2b-loja-publica.test.mjs` (7: SQL, sem código → casa, com `?v=`, CNPJ de outro vendedor fica com o dono, dono inválido, oferta reaproveitada sem promoção, mínimo/comissão normal, fios) e `scripts/b2b-parceiros.test.mjs` (atualizado).

## ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★ Mapa técnico do B2B (11/10/2026)

**SEM SQL, sem código.** Novo `docs/B2B_MAPA_TECNICO.md` (complemento do PLAYBOOK_B2B_ANGEL_BLANC.md): rotas (vendedor, cliente, admin, `/api/central/*`, cron), tabelas e colunas B2B com a função de cada uma, SQL na ordem em que foi aplicado, onde ficam as regras (preço, promoção, comissão, frete), testes principais, diferenças da Bio em relação às outras marcas, variáveis e checklist para replicar numa marca nova. Conferido contra o código no commit `65f7640` (rotas, colunas do `schema.ts` e dos SQL, lista de testes). **Para o Luis revisar:** a seção 6 (diferenças entre marcas) foi escrita só com o que se vê no código da Bio e no playbook; conferir os itens das outras marcas.

## ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★ Modo demonstração B2B (11/10/2026), sobre `8ee0547` — referência: My Pet `6585957`

**ORDEM: backup Neon (`bio-florais`) → `36a_modo_demonstracao_preflight_one_shot.sql` (1 linha JSON, só leitura) → `36b_modo_demonstracao.sql` (BEGIN/COMMIT, aditivo, idempotente) → push → Admin → B2B → Vendedores → "Gerar link de demonstração".** Variáveis: `CRON_SECRET` (já existe; o cron novo usa a mesma) e opcional `B2B_DEMO_CTA_URL` (botão "Quero ser representante"; sem ela abre o WhatsApp (21) 3955-3713). SQL 36b: `b2b_responsibles.is_demo/demo_expires_at/demo_link_id`, tabelas `b2b_demo_links` (só o hash do token) e `b2b_demo_creations` (limite por IP, IP só em hash). Nenhum dado existente muda; sem o 36b nada do demo aparece e o resto segue igual (as consultas leem a coluna por `to_jsonb`).

- **Entrada, só por link de campanha gerado pelo admin** (não há rota pública aberta): Admin → B2B → Vendedores → **"Gerar link de demonstração"** (campanha, validade padrão 30 dias, limite de acessos opcional). O link aparece UMA vez (Copiar e WhatsApp) e tem a forma **`https://www.bioflorais.com.br/b2b/demo/<token>`** (a URL "Testar a plataforma" do botão do e-mail). A lista mostra campanha, validade, acessos (e limite), situação e **Revogar**. Token inexistente/revogado/vencido/esgotado → "Link de demonstração inválido ou expirado".
- Cada clique cria um **vendedor de demonstração** próprio ("Demonstração", tipo CLT, sem login/senha, 24 h, e-mail interno `demo+<id>@invalid`) com 1 cliente fictício **"Loja Exemplo"** e já entra (sessão normal de vendedor). Voltando no mesmo navegador em até 24 h (cookie assinado) continua no mesmo demo. **Limite: 10 criações por IP por hora.**
- **Experiência:** faixa fixa em todas as telas do painel e do link do cliente ("DEMONSTRAÇÃO — nada aqui é real. Compras desativadas. Seus dados de teste ficam disponíveis por 24 horas e depois são apagados automaticamente." + "Quero ser representante"); boas-vindas de 3 passos na primeira entrada; ao gerar o link (Link padrão, Minha oferta padrão, revisão, lista de ofertas): aviso "Este é um link FICTÍCIO de demonstração…", **"Abrir como cliente"** (nova aba), Copiar e **QR Code** (com o aviso de demonstração). Offer Builder, promoções, comissão "base + extra", revisão e link funcionam como no real, com linhas, artes, preços e promoções reais. O demo não tem "Meu link de captação".
- **Bloqueios no servidor (403 "Demonstração: compras desativadas."):** criação do pedido (`/api/b2b/orders/create`), todas as rotas de pagamento B2B (Pix, cartão, boleto, via `verifyB2BOrderOfferToken`) e cupom na cotação recusam oferta de vendedor `is_demo`; a cotação segue funcionando. Demo expirado: o link do cliente deixa de abrir, o painel vai para "Sua demonstração terminou" e as APIs do vendedor recusam.
- **Dados demo FORA de:** lista e métricas de Vendedores do admin, Acompanhamento (ofertas e "linha vista fora da oferta"), comissões, aba **Dados de teste**, `/parceiros` (nunca recebe lojista nem vira vendedor da casa) e Central (o demo não gera pedido).
- **Limpeza diária** (`/api/cron/cleanup-b2b-demo`, 06:30 UTC, `vercel.json`, exige `Authorization: Bearer CRON_SECRET`): apaga SÓ vendedor `is_demo=true` EXPIRADO e o que é dele (clientes só dele, vínculos, ofertas, links, promoções e grupos da oferta, visualizações, regras de comissão, modelos de oferta), numa única instrução. Demo válido, vendedor real e demo com pedido ligado ficam; cliente compartilhado com vendedor real não é apagado.
- **Roteiro (5 passos):** 1) gere o link no admin e abra em janela anônima; 2) veja a faixa, as boas-vindas e a "Loja Exemplo"; 3) crie um cliente, use "Link padrão" ou monte a oferta e gere o link; 4) "Abrir como cliente": faixa, catálogo e carrinho; no checkout a compra é recusada; 5) abra o link da campanha em outra janela anônima e confirme que os dados do primeiro demo não aparecem; no admin o demo não aparece em Vendedores/Comissões/Dados de teste.
- **Verificado no navegador** (375 px, página temporária removida): faixa, boas-vindas, aviso do link, "Abrir como cliente" e QR. Não visto com banco real (fluxo completo de entrada → painel exige o banco). Testes: `scripts/b2b-demo.test.mjs` (8: SQL, links, isolamento entre visitantes e com o real, oferta demo, limite por IP, cookie, limpeza, fios).

## ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★ LGPD no /parceiros (11/10/2026), sobre `2e93c1d`

**SEM SQL.** Abaixo do botão "Quero comprar": "Seus dados serão usados para contato comercial, conforme nossa Política de Privacidade." com link para `/privacidade`. Teste: `scripts/b2b-parceiros.test.mjs`.

## ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★ Rodada 6 · L3 Página /parceiros (11/10/2026), sobre `679ec93`

**SQL, nesta ordem:** `35a_parceiros_preflight_one_shot.sql` (somente leitura, uma linha JSON) e `35b_parceiros.sql` (BEGIN/COMMIT, só aditivo): `b2b_responsibles.referral_code` (+ índice único sem diferenciar maiúsculas; gera o código de 6 letras/números para quem já existe) e `b2b_clients.document/city/state/lead_source/lead_referral_code`. O vendedor da casa fica em `b2b_settings` (`house_responsible_id`), sem coluna nova. Sem o 35b a página abre só com a apresentação; o painel e o admin não mostram o código.

**Variável (opcional):** `B2B_DEMO_CTA_URL` = a URL da agenda de representantes (botões "Quero ser representante" e "Falar com um representante"). Sem ela, os botões abrem o WhatsApp (21) 3955-3713 — **o Luis deve definir a URL da agenda na Vercel**.

- **`/parceiros`** (pública, **noindex**, sem o carrinho/"Seja uma criadora" do B2C): apresentação para o lojista (pedido mínimo R$ 250, frete especial B2B a partir de R$ 450, Pix/cartão em até 3x/boleto PJ, entrega rápida), as linhas B2B publicadas com o card da Home e "a partir de R$" no preço B2B normal (sem promoções).
- **Vínculo:** `?v=<código>` liga o lojista àquele vendedor (mostra "Seu representante: <nome>", nunca o e-mail); sem `?v=` ou com código inexistente/inativo, ao **vendedor da casa**. **Sem vendedor da casa** e sem `?v=`, só a apresentação e "Falar com um representante" (sem formulário).
- **"Quero comprar":** cadastro rápido (nome da loja, CNPJ ou CPF válidos, WhatsApp, e-mail, cidade/UF) → cria o cliente do vendedor com a origem (`lead_source = parceiros`, código) — reaproveita o cliente do mesmo vendedor com o mesmo e-mail/documento — e abre o **link padrão (L1)**: oferta ativa com todas as linhas B2B, preço normal, sem promoção. Pedidos entram com esse vendedor. Proteções: campo-isca invisível, limite de 8 tentativas/10 min por IP, validação de CNPJ/CPF.
- **Painel do vendedor:** "Meu link de captação" (`/parceiros?v=<código>`) com Copiar, Enviar pelo WhatsApp e Mostrar QR Code (para o flyer/cartão). O código é gerado na primeira vez que o painel abre.
- **Admin → Vendedores:** em cada vendedor, o código e o link com **Copiar link, QR Code, Editar código** (4 a 12 letras/números, único), "Gerar código" quando falta e **"Definir como vendedor da casa"** (só vendedor ativo; "Remover vendedor da casa"). **Ação do Luis:** criar o vendedor CLT "Angel Blanc – Comercial" pelo convite e marcá-lo como vendedor da casa.
- Testado no navegador: `/parceiros` renderiza com noindex e, sem vendedor, mostra "Falar com um representante" sem formulário (o banco real não estava disponível, então a página com vendedor e a lista de linhas com preço não puderam ser vistas); o formulário em 375 px sem rolagem lateral e com a mensagem de erro. Testes: `scripts/b2b-parceiros.test.mjs`.

## ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★ B2C P1 da Bio (10/10/2026), sobre `05422b7`

**SEM SQL.** Quatro itens do `B2C_MELHORIAS.md`, um commit por item. Testado no navegador (375 px e desktop; sem banco, com a sacola em localStorage).

1. **Menu que trava.** O cabeçalho da home tinha Adulto, Pet e Infantil apontando TODOS para o mesmo `#linhas` (e o logo para `#topo`): depois de usar um e voltar, os outros viravam "mesma âncora" e pareciam não responder. Agora cada um vai à sua página (`/linha/adulto`, `/linha/pet`, `/linha/infantil`), "Nossas linhas" continua na âncora da home (o logo segue como no original, pedido em rodada anterior). Conferido: Adulto → voltar → Pet → voltar → Infantil → Adulto → Pet, todos navegaram. (A barra inferior do celular já usava links diretos.)
2. **Sacola/checkout com nome completo e foto.** Sacola e resumo do checkout passam a mostrar "Condicionador Filhotes · Cosméticos Pet · 500 ml" / "Floral Filhotes · Pet · 31 ml" (tipo + nome + linha + volume, o mesmo rótulo do B2B), resolvido pelo catálogo a partir do slug; a foto real vem de `GET /api/catalog/images` porque o catálogo guarda caminhos `/assets/products/*.webp` que NÃO existem em `public/` (as fotos de verdade estão em `public/products/...`), por isso a sacola mostrava imagem quebrada/sem foto. A confirmação e o acompanhamento do pedido já usavam o nome completo. O checkout não pôde ser renderizado no navegador sem o banco (a cotação vem da API): o resumo usa o mesmo código da sacola, coberto por teste.
3. **Páginas vazias.** `Conheça a marca` (`/sobre`), `Terapia floral`, `Trocas e Devoluções` e `Frete e Entrega` ganharam texto (componente `InfoPage`, mesmo visual das outras). **O Luis deve revisar:**
   - **Trocas e Devoluções** (texto padrão CDC): arrependimento em 7 dias (art. 49), vício em 30 dias (não duráveis) / 90 dias (duráveis) (art. 26), frete de devolução por conta da loja nos casos de arrependimento/defeito, reembolso do Pix em até 7 dias úteis após o recebimento, produtos de uso pessoal abertos não voltam por arrependimento. **Confirmar com o jurídico** (principalmente a regra de produto aberto e o prazo do reembolso).
   - **Frete e Entrega**: frete calculado por CEP/peso (Melhor Envio), frete grátis a partir de R$ 100 (o mesmo valor do cabeçalho do site), prazo conta após o pagamento, rastreio em "Acompanhe seu pedido". **Confirmar prazos, valor do frete grátis e transportadoras.**
   - **Conheça a marca** e **Terapia floral**: texto INICIAL (desde 1997, flores frescas brasileiras, sem álcool, linhas, "complementar, não substitui acompanhamento médico/psicológico/veterinário"). **Substituir pelo texto oficial; conferir as afirmações sobre benefícios.**
   - Contato nas páginas: WhatsApp (21) 3955-3713 e **sac@angelblanc.com** (a caixa sac@bioflorais.com.br ainda não existe, item P2).
4. **"Acompanhe seu pedido".** Logo "Bio Florais" clicável e botão "← Voltar à loja" na busca e na página do pedido.

Testes: `scripts/b2c-p1-menu.test.mjs`, `b2c-p1-sacola.test.mjs`, `b2c-p1-paginas.test.mjs`, `b2c-p1-acompanhe.test.mjs`.

## ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★ Rodada 6 · L2 "Minha oferta padrão" (10/10/2026), sobre L1

**SQL, nesta ordem:** `34a_modelos_de_oferta_preflight_one_shot.sql` (somente leitura, uma linha JSON) e `34b_modelos_de_oferta.sql` (BEGIN/COMMIT, `CREATE TABLE IF NOT EXISTS b2b_offer_templates`, índice; só aditivo). Sem o 34b a tela "Minhas ofertas padrão" abre com o aviso "falta aplicar o SQL 34b"; o resto do painel não muda.
- **Painel → "Minhas ofertas padrão"** (`/b2b/painel/modelos`): cada vendedor cria 1 ou mais modelos com o **MESMO Offer Builder** (cards das linhas, "Ver promoções", elegibilidade por compras/dias, comissão base + extra) e as mesmas regras, inclusive abertura/reconquista e a escolha por (promoção, LINHA) da rodada anterior. O modelo tem um nome ("Salvar modelo"); editar e excluir (exclusão só arquiva).
- **"Gerar link com minha oferta padrão":** escolhe o modelo + cliente existente ou só o nome → **"Conferir a oferta"** mostra, linha a linha, o que vai e os AVISOS (promoção de abertura indisponível para aquele cliente, promoção desativada/fora da vigência, linha despublicada, elegibilidade sem regra de comissão): a promoção sai daquela oferta e a linha vai com preço B2B normal, ou a linha sai se deixou de estar publicada. Só depois "Gerar link" (ou "Gerar link mesmo assim") cria a oferta já revisada e ativa, com Copiar, WhatsApp e QR.
- Tudo é revalidado no servidor na hora de gerar (`validateDraftInput`, ativação com vigência por compras/prazo, `quick-offer.ts`); só modelos e clientes do próprio vendedor.
- Testado no navegador em 375 px (rede simulada, página temporária removida): conferência com aviso amarelo e botão "Gerar link mesmo assim". Testes: `scripts/b2b-ofertas-padrao.test.mjs`.

## ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★ Rodada 6 · L1 "Link padrão" (10/10/2026)

**SEM SQL.** No painel do vendedor, logo acima de "+ Novo cliente": botão grande **"Link padrão (preço B2B, todas as linhas)"**.
- Pede só o NOME do cliente (cria o cliente com só o nome, ligado ao vendedor, como "Novo cliente") ou deixa escolher um cliente que o vendedor já tem.
- Cria a oferta **já ativa** com TODAS as linhas B2B publicadas (ativas e visíveis no B2B, sem as de teste), **sem promoção** (preço B2B normal) e mostra na hora **Copiar link, Enviar pelo WhatsApp e Mostrar QR Code**.
- Reaproveita as regras do Offer Builder (`validateDraftInput`, ativação com link; `quick-offer.ts`) e a comissão é a regra normal (base + extra de preço normal / janela de 180 dias). Só cliente do vendedor logado (rota `POST /api/b2b/offers/quick`).
- Testado no navegador em 375 px (rede simulada, página temporária removida): painel sem rolagem lateral, "Gerando…", resultado com Copiar/WhatsApp/QR e a tela do QR com "Olá, Loja do Zé!". Testes: `scripts/b2b-link-padrao.test.mjs`.

## ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★ Comissões vazias ao trocar vendedor/mês (10/10/2026)

**SEM SQL.** Item 4 do teste do Luis.
- **Causa:** a lista de comissões sempre exclui pedidos arquivados (V5) e o filtro do vendedor/mês só mostrava o que sobrava: se os pedidos do teste estavam arquivados (como dados de teste), "Todos os vendedores" em qualquer mês voltava vazio, sem explicar. O filtro de mês em si (mês de criação do pedido, "AAAA-MM") e "Todos" estavam corretos (teste cobre).
- **Correção:** aviso "n pedido(s) arquivados como teste não aparecem aqui" com a caixa "Mostrar pedidos arquivados (teste)" (linhas marcadas "arquivado (teste)"; a lista de vendedores passa a incluir os arquivados quando a caixa está marcada). Os totais seguem só com o que não está arquivado.
- Testes: `scripts/b2b-comissoes-arquivados.test.mjs`.

## ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★ "Boletos a receber" vazio com solicitação no Acompanhamento (10/10/2026), sobre `6d93e57`

**SEM SQL.** Item 3 do teste do Luis.
- **Causa:** o Acompanhamento listava TODA solicitação de boleto (inclusive de pedido arquivado como teste), enquanto "Boletos a receber" esconde pedido arquivado (V5) e ainda exigia oferta gravada no pedido e pelo menos 1 parcela. O pedido da solicitação do Luis estava nesse caso (ou sem parcelas/oferta); o código não conseguia explicar de outro jeito.
- **Correção:** toda solicitação de boleto de pedido NÃO arquivado aparece em "Boletos a receber", com ou sem cronograma, mesmo sem oferta no pedido ou com número de parcelas vazio/zero (vira 1 parcela). O Acompanhamento passou a esconder as solicitações de pedido arquivado (as duas telas agora concordam). Quando houver parcelas de pedidos arquivados, aparece o aviso em vermelho "n parcela(s) de pedidos arquivados como teste não aparecem aqui" e a caixa "Mostrar pedidos arquivados (teste)" para vê-las (marcadas "arquivado (teste)"); desfazer o arquivamento: Dados de teste → Lotes arquivados.
- **Onde o Luis dá a baixa:** Admin → B2B → **Boletos a receber** → na linha da parcela, botão **"Dar baixa"** → confirmar data e valor pagos (se o valor for diferente, escrever uma observação) → "Desfazer baixa" volta a parcela para em aberto. Com todas as parcelas baixadas o pedido vira Pago e entra na separação; a comissão da parcela vence no dia 10 do mês seguinte à baixa. A explicação agora está escrita no topo da tela.
- Testes: `scripts/b2b-boletos-solicitacoes.test.mjs`.

## ★★★★★★★★★★★★★★★★★★★★★★★★★★★★ Admin → Pedidos: "Marcar como teste e arquivar" para QUALQUER pedido (10/10/2026), sobre `5ab75d8`

**SEM SQL novo** (usa o 32b já aplicado). Itens 1 e 2 do teste do Luis.
- **O que o Luis viu ("só apaga a seleção"):** em Pedidos os únicos botões eram "Selecionar todos", "Limpar seleção" e "Imprimir separação"; não existia ação de arquivar, então "Limpar seleção" só desmarcava. Renomeado para "Desmarcar todos" e criada a ação de verdade.
- **Pedidos (lista):** selecione os pedidos → "Marcar como teste e arquivar (n)" → confirmação → arquivados (somem de Pedidos, Comissões, Boletos, Acompanhamento e da Central/Omie); a mensagem diz onde desfazer.
- **Detalhe do pedido:** botão "Marcar como teste e arquivar" (volta para a lista).
- **Pedido PAGO de verdade** (pago ou aprovado, sem o cupom de teste): segunda confirmação com aviso em vermelho; sem ela fica de fora.
- **Desfazer:** Admin → B2B → Dados de teste → "Lotes arquivados" → Desfazer (mesmo mecanismo do V5; nada é apagado). Rota `POST /api/admin/orders/archive` (só admin, até 300 pedidos).
- **Testado no navegador** (componente real numa página temporária, rede simulada, depois removida): botão desabilitado sem seleção, "(3)" ao selecionar todos, 1ª confirmação, 2ª confirmação para o pago real, mensagem final e seleção limpa. Testes: `scripts/b2b-pedidos-arquivar.test.mjs`.

## ★★★★★★★★★★★★★★★★★★★★★★★★★★★ Promoção por LINHA: a mesma promoção em várias linhas da oferta (10/10/2026), sobre `7d46371`

**BUG CONFIRMADO NA BIO.** A oferta só aceitava uma vez cada promoção: a validação recusava "a mesma promoção para duas linhas" e a tabela `b2b_offer_promotions` tinha chave única (oferta, promoção). Além disso, o servidor guardava a linha escolhida por promoção (não por promoção + linha), a ativação gravava a elegibilidade em todas as linhas da promoção e o contador de usos era um só para a promoção na oferta.

**SQL, nesta ordem:** `33a_promocao_por_linha_preflight_one_shot.sql` (somente leitura, uma linha JSON: restrições atuais da tabela, se o índice novo já existe, linhas antigas sem linha) e `33b_promocao_por_linha.sql` (BEGIN/COMMIT, idempotente, não apaga nada: troca a chave única (oferta, promoção) por (oferta, promoção, linha)). **Antes do 33b, escolher a mesma promoção em duas linhas devolve "precisa do SQL 33b"; o resto segue como estava.**

Agora a escolha vale por (promoção, LINHA), só para os produtos daquela linha:
- **Gravação:** a mesma promoção pode ser escolhida em várias linhas, cada uma com a sua elegibilidade; duas condições na MESMA linha continuam recusadas.
- **Ativação do link:** `valid_from/valid_until/max_uses` só da linha certa (antes: de todas as linhas daquela promoção, com a última vencendo).
- **Revisão e link do cliente:** já eram por linha (avisos e selos por linha); o limite restante "n compras" e a validade agora são os da linha.
- **Sacola e cálculo do servidor** (`promotion-lines.ts`, parte pura, usada pela cotação e pela criação do pedido): cada item é conferido contra a escolha da SUA linha; se a escolha de uma linha vence/esgota, a outra continua e a primeira não herda a dela.
- **Contador de usos e porteiro (abertura/recorrente):** por (promoção, linha) — pedido no Pet não gasta o limite do Infantil (consulta nova `loadPromotionUsesByLine`; a antiga, por promoção, segue para a tela de promoções do admin).
- **Comissão no pedido:** o item carrega a linha da promoção realizada e o extra/elegibilidade congelados são os dessa linha (B1 do Pet "3 compras" ≠ B1 do Infantil "60 dias").
- Admin → Promoções: "ofertas" agora conta ofertas distintas (não linhas).
- Teste do cenário pedido: Adulto = B3 "2 compras", Pet = B1 "3 compras", Infantil = B1 "60 dias" → cada linha mostra, bonifica, conta usos e comissiona só a sua. `scripts/b2b-promocao-por-linha.test.mjs`.

## ★★★★★★★★★★★★★★★★★★★★★★★★★★ Admin → B2B → Vendedores igual à Secreta (09/10/2026), sobre `27de0dd`

**SEM SQL.** A tabela larga (ações no fim, rolagem lateral) virou **um cartão por pessoa**, com busca e botões visíveis (nada de menu escondido). Regras puras em `src/lib/b2b/seller-card.ts`; as ações continuam nas mesmas rotas.
- **Selo de situação:** "Convite pendente (expira dd/mm)", "Convite expirado", "Cadastrado – em teste até dd/mm", "Cadastro completo", "Cadastrado – teste vencido", "Inativo" / "Inativo – e-mail liberado".
- **Convite pendente:** "Copiar link do convite" (copia direto o link vigente), "WhatsApp", "Gerar novo link" (confirma e avisa que o anterior é REVOGADO) e "Revogar". Convite expirado: só "Gerar novo link".
- **Vendedor cadastrado:** "Copiar acesso" (copia "Entre em https://www.bioflorais.com.br/b2b/login com o seu e-mail <e-mail> e a sua senha"), "WhatsApp" (abre o mesmo texto no número dele) e "Redefinir senha" (gera o link de nova senha; aparece a caixa com Copiar + WhatsApp). Na segunda linha, também visíveis: Desativar/Reativar, Estender teste +7 dias, Editar e-mail/login, Desativar e liberar e-mail; e o campo "Vendedor no Omie".
- **Busca** por nome ou e-mail (sem diferenciar maiúsculas/acentos; acha também pelo e-mail anterior de quem teve o e-mail liberado), com "n de N pessoas".
- Não visto com dados reais nem no navegador (exige sessão de admin e banco); conferido por teste de regras e de fios. Testes: `scripts/b2b-vendedores-cartao.test.mjs`.

## ★★★★★★★★★★★★★★★★★★★★★★★★★ QR Code do link da oferta (09/10/2026), sobre `2361bcd`

**SEM SQL.** Dependência `qrcode` (+ `@types/qrcode`), autorizada pelo Luis; o QR é gerado NO NAVEGADOR (nada de serviço externo).
- Botão "Mostrar QR Code" logo após "Gerar link" (ao lado de Copiar e WhatsApp, na revisão da oferta) e na lista de ofertas do cliente (ofertas com link ativo e não revogado). A Bio não tem modo demonstração: não há link fictício.
- Tela cheia (modal) de fundo branco, "Bio Florais" + "Olá, <nome do cliente>!", QR com 78% da largura no celular (máx. 560 px), alto contraste (preto sobre branco) e margem branca de 4 módulos; "Aponte a câmera do seu celular para abrir sua loja personalizada."; "Baixar imagem" (PNG 1024 px) e "Fechar" (também Esc). Sem permissões nem tela sempre acesa.
- O QR contém exatamente a URL do link (o teste lê o conteúdo do QR gerado). Na lista a URL vem de `GET /api/b2b/offers/link`, que só entrega ao vendedor dono da oferta e bloqueia oferta revogada/expirada como antes.
- Testes: `scripts/b2b-qrcode.test.mjs`. Conferência manual (roteiro de 3 passos): 1) painel → cliente → "Gerar link para o cliente" → "Mostrar QR Code"; 2) com a câmera de outro celular, apontar para a tela; 3) deve abrir a loja personalizada do cliente (conferir com link revogado: deve bloquear).

## ★★★★★★★★★★★★★★★★★★★★★★★★ Rodada 5 · V7 + V3/V6 + V4 — Analytics e rotas da Central (08/10/2026), sobre `107df9d`

**SEM SQL novo** (usa `order_events` do 23b e as colunas de cadastro/arquivo já existentes). **Variáveis na Vercel da Bio:** `CENTRAL_API_SECRET` (mesmo valor das 3 marcas; sem ela as rotas respondem 503) e `CENTRAL_URL` = `https://www.mypeteme.com.br` (sem elas a Bio só deixa de replicar/oferecer "Usar meus dados"; nada quebra).
- **V7 (autorizado pelo Luis):** `@vercel/analytics` e `@vercel/speed-insights` instalados; `<WebAnalytics />` no layout raiz. Tokens saem da URL antes do envio (`src/lib/analytics-url.ts`): `/b2b/oferta/[token]`, `/b2b/convite/[token]`, `/acompanhe/[token]` e os parâmetros `b2b`, `token`, `email`, `cpf`, `cnpj`. Sem cookies, sem dado pessoal. Ativar Web Analytics/Speed Insights no painel da Vercel do projeto.
- **Rotas internas (header `x-central-secret`, comparação em tempo constante; 503 sem variável, 401 segredo errado):**
  - `POST /api/central/invites`: cria o convite como o admin (RCA→`rca`, VENDEDOR→`clt`); e-mail de vendedor existente = 409 `EMAIL_IN_USE` citando o dono; convite pendente do mesmo e-mail é substituído (igual ao admin, por isso a Bio não devolve `INVITE_PENDING`); link = `getSiteUrl()` (`https://www.bioflorais.com.br`).
  - `GET /api/central/orders?stage=separation|tracking|shipped`: pagos (`paid`/`approved`), não arquivados; tracking = `ready_to_ship` sem `tracking_code`; itens com nome completo (snapshot ou rótulo B2B), pagas + bonificadas (linhas de preço 0); número `BIO-XXXXXXXX`.
  - `POST /api/central/orders/{id}/progress`: `separating`→`separating`; `separated`→`ready_to_ship`; `shipped` (exige transportadora + código, link http/https opcional) grava `shipping_service_name`/`tracking_code`; `delivered` só depois de enviado → `delivered` (mesmo que o admin da Bio). Cada ação grava `order_events` com `created_by = "Central · <nome>"` (o "separado" entra como evento `separating`, nota "Separado e embalado", para o cliente seguir vendo "Em separação"). Não pago/cancelado = 409.
  - `GET/POST /api/central/sellers/profile` (V4): consulta (ignora arquivados; `complete` = `profile_completed_at`) e replicação (só vendedor ativo que ainda NÃO completou; RCA sem termo = `TERMS_REQUIRED`; grava data/IP/versão do aceite original; mesma validação do cadastro completo).
- **V4 do lado da Bio:** ao concluir o cadastro completo (painel ou cadastro "full" do convite) a Bio chama `POST {CENTRAL_URL}/api/central/sellers/replicate` DEPOIS de responder (`after()`, melhor esforço); em "Completar cadastro" aparece "Usar meus dados de <marca>" (busca `GET {CENTRAL_URL}/api/central/sellers/lookup?email=<logado>&exclude=bio`, 4 s de limite) que só pré-preenche; o termo continua sendo aceito aqui.
- Testes: `scripts/b2b-central.test.mjs` (segredo, convite, etapas e itens, andamento + eventos, consulta/replicação, chamadas à Central com falha, Analytics, fios das rotas).

## ★★★★★★★★★★★★★★★★★★★★★★★ Rodada 5 · V5 Limpeza dos dados de TESTE, arquivando (07/10/2026), sobre `201c2af`

- **SQL, nesta ordem:** `32a_dados_de_teste_preflight_one_shot.sql` (somente leitura, uma linha JSON com o que SERIA arquivado: vendedores, clientes, pedidos com TESTEB2B95 e pagos de verdade) e `32b_dados_de_teste.sql` (aditivo, BEGIN/COMMIT, IF NOT EXISTS: `is_test` e `archived_at` em `b2b_responsibles`, `b2b_clients` e `orders`; tabela `b2b_archive_log` para desfazer). Aplicar o 32b não muda nenhum dado.
- Admin → nova aba "Dados de teste": candidatos (nome/e-mail com "teste", @example.invalid, cupom TESTEB2B95, pedidos ligados a vendedor/cliente de teste) com caixa de seleção; "Arquivar selecionados". Arquivar = `archived_at`/`is_test`; vendedor vira `inactive`, cliente `active=false` (estado anterior no log); pedidos de vendedor/cliente arquivado herdam. Pedido PAGO DE VERDADE (pago e sem o cupom de teste) fica de fora, a não ser que o admin marque a confirmação linha a linha. "Desfazer" por lote devolve tudo. NADA é apagado.
- Some de: lista de vendedores, comissões (admin e painel), boletos, acompanhamento do admin, Central de pedidos (`/admin/pedidos`, que é o que a Central/Omie lê), acompanhamento do cliente (número, e-mail+CPF, "Meus pedidos"), histórico de compras/uso de promoção e clientes do vendedor. Antes do 32b os filtros não existem e nada muda (checagem tolerante da coluna).
- Atenção Central/Omie: se a Central lê o banco da Bio por outro caminho que não `/admin/pedidos`, ela precisa filtrar `archived_at IS NULL`.
- Testes: `scripts/b2b-dados-de-teste.test.mjs`.

## ★★★★★★★★★★★★★★★★★★★★★★ Rodada 5 · V2 E-mail "preso" (07/10/2026), sobre `868b9cf`

- **SQL, nesta ordem:** `31a_email_preso_preflight_one_shot.sql` (somente leitura, uma linha JSON: colunas existem? inativos que seguram e-mail, convites vencidos) e `31b_email_preso.sql` (BEGIN/COMMIT, ADD COLUMN IF NOT EXISTS `email_original`, `login_original`, `released_at`).
- Convite revogado/expirado nunca reserva e-mail (só vendedor existente ocupa; convite novo checa só `b2b_responsibles`).
- Admin → Vendedores: "Editar e-mail/login" (valida e-mail e login contra e-mail e login de outros vendedores; guarda o original) e "Desativar e liberar e-mail" (status inactive, e-mail e login viram `liberado+<id>@invalid`, original guardado, convites pendentes desse e-mail revogados; sem DELETE; pedidos e comissões continuam no mesmo id). A lista mostra "e-mail anterior".
- Mensagem clara no convite: "Este e-mail já pertence ao vendedor ativo <nome>…" ou "…a <nome> (inativo). Use Editar… ou Desativar e liberar…".
- Antes do 31b a lista abre normalmente; editar/liberar respondem 409 pedindo o SQL.
- Testes: `scripts/b2b-email-preso.test.mjs`.

## ★★★★★★★★★★★★★★★★★★★★★ Rodada 5 · V1 Login por e-mail ou login + sessão expirada (07/10/2026), sobre `659f7b7`

Sem SQL. B2C intocado.
- `/api/b2b/auth/login`: aceita E-MAIL OU LOGIN (`lower(email)=x OR lower(login)=x`; se coincidirem em registros diferentes, vence o login igual ao digitado). Senha errada: "E-mail/login ou senha incorretos. Confira e tente de novo."
- `/b2b/login` (já existia na Bio): rótulo "E-mail ou login", link "Esqueci minha senha" (explica que o admin gera o link de nova senha e envia pelo WhatsApp; o fluxo `reset_access` já existe no admin).
- Cadastro rápido: tela final "Seu acesso: <URL de login> · use seu e-mail e a senha que você criou" + copiar + "Ir para o meu painel" (a sessão já é criada no cadastro).
- Sessão expirada (cookie de 12h): todas as rotas 401 do admin e do vendedor respondem "Sua sessão expirou. Entre de novo."; `SessionExpiredGuard` (admin e B2B) mostra faixa com link "Entrar de novo" e leva ao login sozinho em 4 s. O login em si não dispara o aviso.
- Testes: `scripts/b2b-vendor-login.test.mjs`.

## ★★★★★★★★★★★★★★★★★★★★ Cabeçalho do B2C volta ao original abaixo de 1280px (05/10/2026), sobre `4893a8e`

Decisão do Luis: vender vem primeiro. Sem SQL.
- Cabeçalho do B2C (`src/app/page.tsx`): abaixo de 1280px (celular, tablet, notebook pequeno) fica EXATAMENTE como em `2483b13` (sem o botão/link "Acompanhar pedido", "Frete grátis a partir de R$ 100" como era, logo sem `shrink-0`). Só a partir de 1280px entra o link "Acompanhe seu pedido" na navegação.
- Conferido no navegador: em 1280 e 1440 o link cabe sem quebrar linha nem tirar nada (nav, frete e "Ver produtos" em uma linha, sem rolagem horizontal); em 1024 e 375 o cabeçalho é o original (1024: frete visível; 375: sem frete no cabeçalho, como já era).
- Se algum dia o link não couber em 1280, a regra é tirá-lo (basta remover o `<Link ... xl:block>`).
- Continuam: "Acompanhe seu pedido" no rodapé; cartão "Acompanhe seu pedido" (`TrackOrderCard`) na tela de pedido criado do B2C (aparece sempre que há pedido pendente/pago: Pix e cartão, em coluna única no celular, `aside` sem `hidden`), na tela `/checkout/pagamento` e no B2B (Pix, cartão e boleto: tela de pagamento e tela final). Botão "Acompanhar pedido" no link B2B mantido.
- Testes em `scripts/b2b-omie-vendor.test.mjs`.

## ★★★★★★★★★★★★★★★★★★★ Vendedor no Omie e atalhos "Acompanhe seu pedido" (05/10/2026), sobre `2483b13`

**1) Vendedor no Omie** (a Central da My Pet exporta a coluna H "Vendedor" e não exporta pedido B2B sem esse campo)
- SQL aditivo: `30a_vendedor_omie_preflight_one_shot.sql` (somente leitura, uma linha JSON) e `30b_vendedor_omie.sql` (BEGIN/COMMIT, `ADD COLUMN IF NOT EXISTS b2b_responsibles.omie_vendor_code text`, mesmo nome da My Pet). Ordem: 30a, 30b.
- Admin → Vendedores: coluna "Vendedor no Omie" com campo editável + Salvar por vendedor (nome completo igual ao cadastro de Vendedores do Omie, máx. 70 caracteres, dica na tela; aviso quando vazio). Servidor valida (`src/lib/b2b/omie-vendor.ts`), exige admin; a lista funciona mesmo antes do 30b (mostra "não cadastrado") e salvar sem a coluna responde 409 com a orientação.
- Preencher o nome de cada vendedor ativo depois do 30b: sem isso a Central não exporta o pedido dele.

**2) Atalhos**
- Cabeçalho do B2C (home): "Acompanhe seu pedido" na navegação a partir de 1280px; de 1024 a 1279px e no celular, botão "Acompanhar pedido". Nessa faixa (1024-1279) o texto "Frete grátis a partir de R$ 100" do cabeçalho some para caber (continua no site); logo com `shrink-0`. Outros itens intactos.
- Link B2B: botão "Acompanhar pedido" no topo, ao lado de "Meus pedidos" (que segue igual).
- Testes: `scripts/b2b-omie-vendor.test.mjs`.

## ★★★★★★★★★★★★★★★★★★ Acompanhe seu pedido: busca por e-mail + CPF/CNPJ (05/10/2026), sobre `b321f71`

**Aprovado pelo Luis: mexe no B2C (só a página `/acompanhe-seu-pedido` e a rota `/api/orders/track`).** Sem SQL novo.

- Principal: e-mail + CPF/CNPJ (os dois, do MESMO cliente) → lista dos pedidos dos últimos 6 meses (nº, data, valor, situação, até 50) → clicar abre `/acompanhe/<token>` (igual a antes).
- Secundária "Tenho o número do pedido": nº + e-mail OU CPF/CNPJ, como antes.
- Mesma resposta genérica quando não acha (404); limite de 5 tentativas/10 min por IP aplicado antes de qualquer consulta, nos dois modos; nada de dado pessoal na URL; link assinado inalterado.
- Não muda: rodapé/checkout, `/acompanhe/[token]`, B2B "Meus pedidos".
- Código: `findOrdersByEmailAndDocument` em `src/lib/order-tracking.ts`; modo `contact` na rota; página reescrita.
- Testes (`scripts/b2b-tracking.test.mjs`): 0, 1 e vários pedidos; >6 meses fora; mesmo e-mail com outro CPF fora; e-mail certo + CPF errado (e o inverso) → vazio; limite antes da busca; URL sem PII.
- Conferido: tsc, build, 152/152 testes, `git diff --check` limpo, página em desktop e 375px.

## ★★★★★★★★★★★★★★★★★ Promoções reais de outubro/26 (B1 a B11), sobre `beb4659`

Só local, sem push. `npm.cmd test` 149/149, `tsc` e `build` exit 0, `git diff --check` vazio. Nada mais do site muda (preços, B2C, checkout, frete, cupons, comissão base e janela de 180 dias).
**SQL (Neon `bio-florais`), nesta ordem:** `29a_promocoes_out26_preflight_one_shot.sql` (leitura, uma linha JSON; **só siga se `pode_prosseguir` = true**) → `29b_promocoes_out26.sql` (BEGIN/COMMIT, idempotente, sem DELETE; trava com erro se alguma linha ou SKU da B9 não existir; termina com UMA linha de conferência por promoção: código, tipo, mecânica, alcance, 1x/2x/3x/30d/60d/90d/180d) → publicar o código.
**O que o 29b faz:** (a) desativa (`active=false`, `seller_selectable=false`) TODA promoção que não é da tabela (as de teste do 06b e qualquer uma criada no admin, ex.: "Black Friday…"); ofertas antigas continuam abrindo, só sem a promoção (preço B2B normal), pedidos não mudam; (b) cria/atualiza B1..B11 (chave = nome; sem a palavra "teste"; sem data de fim); (c) liga o alcance (linhas; na B9 também os SKUs); (d) grava as 7 elegibilidades como a tabela (desmarcada = regra inativa); vínculos de promoções antigas não são removidos.
**Nomes:** B1 "Compre 3 pague 2 · Florais" · B2 "10% de desconto · Florais" · B3 "Compre 4 pague 2 · Florais" · B4 "15% de desconto · Florais" · B5 "Compre 3 pague 1 · Florais Kids, Teen, Dose Única e Virtudes" · B6 "15%…" · B7 "Compre 1 ganhe mais 1 …" · B8 "20%…" (mesmas linhas) · B9 "Compre 3 ganhe mais 1 · Sabonetes, Spray para Hálito e Aromatizadores" · B10 "8% de desconto · Cosméticos, Cosméticos Pet e Home Care" · B11 "10% de desconto · Cosméticos, Cosméticos Pet e Home Care". Mecânicas: 3 pague 2 = a cada 2 pagas +1; 4 pague 2 = 2 pagas +2; 3 pague 1 = 1 paga +2; 1 ganhe mais 1 = 1 paga +1; 3 ganhe mais 1 = 3 pagas +1 (todas já existiam; nenhuma mecânica nova).
**B9: SKUs exatos** (por `products.slug`, só ativos): **Cosméticos → sabonetes líquidos (`cosmeticos-sabonete-liquido-%`, 9 no catálogo):** alegria, ansiedade, energizante, hidratante, harmonia-interior, reequilibrio-dos-chakras, refrescante, relaxante, rescue-sos. **Cosméticos Pet → 1 SKU:** `cosmeticos-pet-higiene-oral-spray-para-halito-menta` (Spray para Hálito – Menta). **Home Care → aromatizadores (`home-care-aromatizador-spray-%`, 5):** bem-estar, harmonia, limpeza-e-protecao, reequilibrio-do-ambiente, serenidade. **Ficam de fora:** os sabonetes líquidos do Home Care e todo o resto. O `29a` lista os SKUs achados no banco para você conferir (esperado 9 + 1 + 5 = 15).
**Código (mínimo, só o aviso único da B9):** nos cards e no Offer Builder o alcance por produto deixa de listar item por item e mostra "Oferta válida para os sabonetes líquidos" (Cosméticos), "…para o Spray para Hálito – Menta" (Cosméticos Pet) e "…para os aromatizadores de ambiente" (Home Care); o selo "Compre 3 e leve +1 grátis" continua nos produtos elegíveis (`describeScope` em `product-label.ts`).
**Testes (`scripts/b2b-promocoes-out26.test.mjs`):** o seed gera exatamente a tabela (tipo, mecânica, alcance, 7 elegibilidades de cada B1..B11); idempotente e sem apagar; só as 11 ativas/selecionáveis (as antigas ficam desativadas, a oferta antiga permanece); B9 liga só os 15 SKUs; o vendedor vê só as elegibilidades marcadas (ex.: B5 sem 3x e sem 180 dias); cada mecânica calcula certo (bonificação e 8/10/15/20%); 29a/29b param quando falta linha.

---

## ★★★★★★★★★★★★★★★★ BUG do cadastro rápido do vendedor (05/10/2026), sobre `8b0c388`

Só local, sem push. `npm.cmd test` 141/141, `tsc` e `build` exit 0, `git diff --check` vazio.

**Causa:** a hipótese do convite criar o vendedor está **descartada** (nenhum código cria `b2b_responsibles` no convite; só o cadastro insere, e há teste estático para isso). O erro vinha do `INSERT` do cadastro rápido, cuja mensagem era FIXA ("e-mail já em uso ou o SQL 26b não foi aplicado") para qualquer falha, escondendo a causa. O cadastro rápido grava só nome, WhatsApp, e-mail, senha e o prazo; se a tabela do banco da Bio (anterior ao B2B atual) tiver colunas do perfil (CPF, Pix, CEP...) como NOT NULL, o Postgres recusa (23502). A My Pet e a Secreta nasceram sem essa restrição. **Não consegui ler o banco para confirmar**: a causa mais provável é essa, e o `28a` prova em uma linha.
**Correção:**
1. Erro real traduzido: e-mail de OUTRO vendedor ("Este e-mail já está cadastrado para outro vendedor. Use outro e-mail ou fale com o administrador."), convite já usado/expirado, coluna que o banco exige (cita a coluna e manda rodar o 28b), coluna/tabela ausente (26b) e erro desconhecido ("o erro ficou registrado"). O servidor loga o erro COMPLETO (`code`, `column`, `constraint`, `detail`, `inviteId`).
2. O cadastro rápido repete o insert preenchendo com vazio qualquer coluna legada NOT NULL que o banco acusar (log a cada tentativa), então funciona mesmo antes do SQL.
3. **SQL:** `28a_diagnostico_cadastro_rapido_one_shot.sql` (leitura, uma linha JSON: colunas NOT NULL sem padrão que o cadastro rápido não envia, todas as colunas e constraints) e `28b_vendedor_colunas_opcionais.sql` (idempotente, só remove NOT NULL das colunas do perfil; nenhum dado muda).
**Testes:** banco legado com CPF/Pix/CEP NOT NULL: o cadastro rápido falha (23502) antes do 28b e funciona depois; convite novo → cadastro → painel com "Período de teste: faltam 7 dias"; e-mail de outro vendedor → mensagem clara; mapeamento de erros; repetição por NOT NULL.

---

## ★★★★★★★★★★★★★★★ Vendedores antigos incompletos e texto do Termo RCA (05/10/2026), sobre `b4d483a`

Só local, sem push. `npm.cmd test` 137/137, `tsc` e `build` exit 0, `git diff --check` vazio. B2C intocado.
**SQL (Neon `bio-florais`), depois do 26b:** `27a_trial_vendedores_antigos_preflight_one_shot.sql` (leitura, uma linha JSON: quem receberia prazo) → `27b_trial_vendedores_antigos.sql` (aditivo, idempotente).
1. **Antigos incompletos:** quem não tem prazo, não tem cadastro completo e não tem documento + CEP + Pix ganha `trial_ends_at` = data do SQL + 7 dias: banner no painel e comissão retida até completar (mesmo comportamento da rodada anterior). O 27b só preenche a coluna onde está nula (rodar de novo não renova o prazo; completos e quem já tem prazo não mudam).
2. **Termo RCA:** o texto da minuta (seções 1 a 10, com a tabela de condições comerciais; campos [entre colchetes] mantidos para a empresa preencher) aparece num quadro rolável acima da caixa de aceite, só para RCA, com o rótulo "Li e aceito os termos de representação". Versão `rca-2026-10` e texto ficam num único arquivo, `src/lib/b2b/rca-terms.ts`; o aceite grava essa constante (data/hora, IP e versão). Para publicar o texto final, edite só esse arquivo. Testes: seções 1–10 presentes, versão definida em um lugar só, quadro só para RCA e antes do aceite, 27a/27b (idempotência e retenção da comissão).

---

## ★★★★★★★★★★★★★★ Período de teste do vendedor (05/10/2026), sobre `4baee44`

Só local, sem push. `npm.cmd test` 135/135, `tsc` e `build` exit 0, `git diff --check` vazio. **B2C intocado.**
**ORDEM: `26a` (leitura) → `26b` → publicar.** O 26b é obrigatório antes do deploy (o app lê as colunas; sem elas ninguém é bloqueado: o acesso cai em "cadastro completo", mas o cadastro rápido não grava o teste).

1. **O que o cadastro por convite exigia:** login (3–40), nome, celular, PF: CPF+RG / PJ: CNPJ+IE, endereço completo, chave Pix, senha (8+) com confirmação e, no RCA, o aceite do Termo.
2. **Cadastro RÁPIDO** (`/b2b/convite/<token>`): só nome, WhatsApp, e-mail (vem do convite, editável) e senha; já entra no painel (a sessão é criada no cadastro) e usa tudo. O login passa a ser o e-mail.
3. **Teste de 7 dias:** `trial_ends_at` = cadastro + 7 dias. Banner fixo no painel: "Período de teste: faltam N dias (até dd/mm/aaaa). Complete seu cadastro para continuar e receber suas comissões." + botão "Completar agora".
4. **Cadastro COMPLETO** (`/b2b/painel/cadastro`, a qualquer momento): CPF/CNPJ, endereço (CEP preenche), Pix OU dados bancários completos e, no RCA, aceite do Termo (data/hora em `rca_terms_accepted_at`, IP e versão `RCA_TERMS_VERSION` em colunas novas). Grava `profile_completed_at` e o banner some. Texto do termo continua PROVISÓRIO.
5. **8º dia sem completar:** o layout do painel renderiza SÓ a tela de completar (nenhuma outra página) e as rotas do painel respondem 401 (`requireResponsible`). Os links dos clientes e a atribuição dos pedidos não olham o teste (só exigem vendedor `active`): continuam funcionando (teste confere o código).
6. **Comissão:** acumula normalmente e fica "Retida até completar o cadastro" (Minhas comissões, com card de total retido e botão para completar, e aba Comissões do admin). O admin não consegue marcar como paga comissão de vendedor sem cadastro completo (409, antes de gravar). Ao completar, libera na hora (mesmo valor, "A receber").
7. **Admin:** na lista de vendedores a situação "Em teste até dd/mm" · "Cadastro completo" · "Teste vencido" e a ação "Estender teste +7 dias" (a partir do maior entre hoje e o fim atual; recusa cadastro completo).
8. **Cadastros atuais:** o 26b marca como completos (`profile_completed_at`) os vendedores que já têm documento, CEP e Pix; só preenche coluna nova, nenhum dado existente muda. O `26a` mostra antes quantos serão marcados e quais ficam de fora (esses ficam sem trial: contam como completos pelo código até alguém definir o teste).

**SQL (Neon `bio-florais`):** `26a_trial_vendedor_preflight_one_shot.sql` (leitura, uma linha JSON) → `26b_trial_vendedor.sql` (aditivo, idempotente, transação única).
**Testes:** `scripts/b2b-vendor-trial.test.mjs` (cadastro rápido, banner, bloqueio no 8º dia, estender, links/pedidos independentes do bloqueio, comissão retida e liberada, admin sem poder pagar, 26a/26b sem alterar dados).

---

## ★★★★★★★★★★★★★ Rodada 4: acompanhamento do pedido (B2C e B2B) — 03/10/2026, sobre `a75d228`

Só local, sem push. `npm.cmd test` 125/125, `tsc` e `build` exit 0, `git diff --check` vazio.
**SQL (Neon `bio-florais`), aditivos e idempotentes, qualquer ordem, antes ou depois do deploy:** `23b_acompanhamento_pedido.sql` (tabelas `order_events` e `order_tracking_attempts`) e `25b_mensagens_chamada_e_rodizio.sql` (`short_call` + tempos de troca; não cria mensagens). Sem o 23b a página funciona (limite de tentativas em memória, sem histórico de andamento); sem o 25b o botão usa o título como chamada.

**A1 diagnóstico:** ver resposta da janela (status de `orders` e `fulfillment_status`, quem altera, ausência de entregue, Melhor Envio só cota frete, sem "meus pedidos" nem e-mail).

**O QUE MUDA NO B2C (aprovado pelo Luis) — só adições, nada do checkout/pagamento/preço mudou:**
- Rota nova pública `/acompanhe-seu-pedido` (busca) e `/acompanhe/<link assinado>` (pedido), mais `POST /api/orders/track` e `GET /api/orders/track-link`.
- Link "Acompanhe seu pedido" no rodapé do site (`SiteFooter`, 1 `<Link>` novo).
- Bloco novo "Acompanhe seu pedido" (componente `TrackOrderCard`: link assinado, copiar, WhatsApp) na tela de pedido criado/pago do checkout (`checkout/page.tsx`, 1 linha que renderiza o componente quando já existe `pendingOrderId`) e em `/checkout/pagamento`.
- `HideOnB2B` (A7) agora também esconde carrinho flutuante, convite "Seja uma criadora" e barra de linhas em `/admin/*` (antes só em `/b2b/*`). Nas páginas públicas do B2C continuam iguais (conferido no navegador).
- Admin do pedido (`/admin/pedidos/[id]`): painel novo "Andamento para o cliente"; os nomes dos itens passam a usar `product_name_snapshot` quando existe (pedidos B2C: nulo, iguais a antes); `delivered` ganhou o rótulo "Entregue". Impressão da separação idem.

**A2 página "Acompanhe seu pedido".** Busca por número (8 primeiros caracteres do id, como o cliente vê) + e-mail OU CPF/CNPJ; resposta genérica igual para qualquer erro; 5 tentativas a cada 10 min por IP (hash do IP, tabela `order_tracking_attempts`; sem a tabela, memória). Link direto assinado (HMAC com `ADMIN_SESSION_SECRET`, `<orderId>.<assinatura>`, sem e-mail/CPF/nome). Conteúdo: linha do tempo (recebido → pagamento → em separação → enviado com transportadora e rastreio clicável → entregue), cancelado com texto claro e o que fazer, Pix pendente (< 25 min) com copia-e-cola de novo (lido de `payments.raw_payload` quando o código está lá), boleto B2B com parcelas, vencimento e situação, itens com NOME COMPLETO (snapshot ou tipo · nome · linha · volume), bonificados, valores, frete, total, endereço parcial (cidade/UF e início do CEP, sem rua), SAC. Prazo de entrega: o pedido não guarda o prazo da cotação; a tela remete a "Frete e entrega" (limite honesto; gravar o prazo exigiria mexer na criação do pedido B2C). Mobile-first (conferido a 375px).
**A3** `/b2b/oferta/<token>/pedidos` ("Meus pedidos" no topo do link): só os pedidos do cliente do token, cada um abre o mesmo acompanhamento; "Acompanhar meu pedido" também no pedido concluído do B2B.
**A4** Admin: "Marcar em separação", "Marcar enviado" (transportadora + código + link opcional), "Marcar entregue", com data, quem fez e histórico (`order_events`); exige pagamento confirmado; "entregue" só depois de "enviado". A data de entregue fica gravada; nada é enviado à Academia. Melhor Envio não devolve rastreio (só cota), então o código segue manual.
**A5** Confirmado: `discounts_shipping` só é lido no resolvedor do B2B, que só aceita cupom `scope='b2b'` (comercial, cadastrado no admin) e recusa `couponType='partner'` (Partner/UGC); o B2C nunca lê o campo. Teste estático trava isso.
**A6** Varredura automática de todo `.tsx` (fundo escuro preenchido sem texto claro, em hex e em nomes do Tailwind): nada encontrado além de barras de progresso sem texto. Corrigidos: botão "Central Omie" desativado do admin (texto 2,9:1 → 8:1) e o botão flutuante das mensagens (fundo `#8a5f12`, branco 5,9:1). Não há componente compartilhado a mexer na Bio.
**A7** Feito (ver "O que muda no B2C").
**A8** Cada mensagem tem "Chamada curta" (até 30) usada no botão flutuante; a faixa mostra o texto completo; admin define "trocar a cada N segundos" separado para faixa e botão (padrão 60, 5–3600); ambos giram pelas ativas; o pop-up usa a 1ª ativa pela ordem; nenhuma mensagem nova semeada.
**Extra:** admin B2B aceita `?aba=boletos|promotions|commissions|messages|...` (a Central abre direto em "Boletos a receber").

**Testes novos:** `scripts/b2b-tracking.test.mjs` (link assinado e adulteração, busca com acerto/erro/documento, limite de 5 por 10 min, linha do tempo, itens e nome completo, boleto, Pix, isolamento entre clientes no "Meus pedidos", A5, A8, 23b e 25b).

---

## ★★★★★★★★★★★★ Comissão por item, nome completo e marketing ao lojista (03/10/2026), sobre `df04670`

Só local, sem push. `npm.cmd test` 115/115, `tsc` e `build` exit 0, `git diff --check` vazio.
**SQL (Neon `bio-florais`):** `21b_nome_completo_produto_item.sql` (aditivo; coluna `order_items.product_name_snapshot`, opcional: sem ela o pedido é gravado normalmente) e `22b_mensagens_lojista.sql` (aditivo; tabelas das mensagens + seed; sem ele o link funciona sem marketing e sem pop-up). Qualquer ordem, antes ou depois do deploy.

**1. Comissão confusa.** "Minhas comissões" e aba Comissões do admin: o VALOR em R$ da comissão ficou em destaque e o percentual virou "média 20,28%" em texto pequeno. "Ver itens do pedido" abre a lista por item: produto (nome completo), qtd., base + extra = total %, base de cálculo R$ (valor pago dos produtos sem frete, repartido pelo valor de cada item; no boleto, proporcional à parcela) e comissão R$; item de valor 0 aparece como "bonificado". A soma dos itens fecha com a comissão do pedido.

**2. Nome completo no B2B:** `"<Tipo> <Nome> · <Linha> · <volume>"` (ex.: "Shampoo Agressividade · Cosméticos Pet · 500 ml"; 5 L e 500 ml se distinguem) via `product-label.ts` (só LÊ o catálogo; B2C intocado). Aplicado: cards da linha (título com o tipo, selo do tipo sobre a imagem, linha e volume em destaque), sacola, checkout e pedido concluído (a sacola grava o nome completo ao adicionar), aviso "somente em X" do vendedor/revisão, itens na abertura da comissão e **exportação Omie/central**: novos pedidos B2B gravam o nome completo em `order_items.product_name_snapshot` (campo que a exportação já lê com fallback para `products.name`; SQL 21b). Pedidos antigos continuam com o nome curto. **Não alterado (compartilhado com o B2C): o admin de pedidos de `/admin/pedidos`** — se mostrar nome curto, aviso aqui. Carrinhos já guardados no navegador mantêm o nome antigo até serem refeitos.

**3. C11 Mensagens ao lojista.** Admin → B2B → "Mensagens ao lojista": título, texto, ativa e ordem (sem exclusão; "frete grátis" é recusado). No link do cliente (`/b2b/oferta/<token>` e linhas): (a) pop-up no 1º acesso de cada cliente (uma vez; "Entendi" grava em `b2b_retailer_popup_views`); (b) faixa no topo alternando as ativas a cada 8 s; (c) botão "Novidades para você" fixo no canto no computador; no celular o botão fica DENTRO da faixa (não flutua), então nada cobre "Adicionar" nem "Ver pedido" (conferido no navegador a 375px). Seed inicial editável: "Cliente gosta de novidade!". Só no B2B.

---

## ★★★★★★★★★★★ Ajustes pós-teste (03/10/2026), sobre `b45a203`

Só local, sem SQL novo. `npm.cmd test` 106/106, `tsc` e `build` exit 0, `git diff --check` vazio.
1. **Baixa de boleto "não acontece nada":** causa = data padrão em UTC (`toISOString`): à noite em SP já era o dia seguinte e o servidor recusava ("data futura") com a mensagem num `prompt`. Agora: data padrão de São Paulo (`todaySaoPaulo`), modal na tela com input de data, valor em R$ pré-preenchido, observação (obrigatória só se o valor difere), resultado verde/vermelho no próprio modal e a linha vira "Pago" na hora; mesmo modal para "Desfazer baixa" (motivo obrigatório). Teste às 23h30 de SP: a data UTC é recusada e a de SP é aceita.
2. **Admin → Promoções:** removido o texto antigo; "Tipo de benefício" virou 2 botões grandes ("Compre X, leve Y grátis" | "X% de desconto"); desconto % pré-preenche a tabela do 3 por 2 (editável); "BIO-B2B TEST GROUP…" some da lista de linhas (filtro `isTestCommercialGroup`, agora em `test-groups.ts`); a lista de produtos mostra a LINHA de cada produto e filtra por linha.
3. **Ponta a ponta do desconto %** (teste): admin cria → vendedor vê as 7 elegibilidades e escolhe 2 compras → link (selo "10% OFF", "−10% neste produto", preço riscado 30,00 → 27,00) → sacola (subtotal 270,00) → pedido (preço efetivo, tipo, valor descontado e comissão 10+8=18).
4. **Aviso ao vendedor:** "<cliente> visualizou a linha <X> fora da oferta (N vezes), em dd/mm/aaaa. Que tal mandar uma nova oferta com essa linha?" (data em São Paulo).

---

## ★★★★★★★★★★ C10 baixa de boletos + ordem de cálculo (02/10/2026), sobre `f460524`

Só local. **SQL `20b_boleto_baixa.sql` ANTES do deploy** (tabelas `b2b_boleto_payments`, `b2b_boleto_payment_log`; `b2b_commission_payouts` ganha `installment` e chave (pedido, parcela)).
- Admin → aba "Boletos a receber": uma linha por parcela (pedido, cliente, vendedor, n/N, valor, vencimento, Em aberto/Vencido/Pago/Cancelado; vencidas em destaque; filtros), "Dar baixa" (data, valor; diferença exige observação) e "Desfazer baixa" (motivo; bloqueado se o pedido já avançou ou a comissão da parcela já foi paga). Log em `b2b_boleto_payment_log`.
- Todas as parcelas baixadas = pedido "Pago" (+ separação); desfazer volta a "aguardando".
- Comissão do boleto: uma linha por parcela, base proporcional, "A receber" no dia 10 do mês seguinte à DATA DA BAIXA, nunca pelo vencimento (painel do vendedor e aba Comissões; "Marcar paga" por parcela).
- Central da My Pet (somente leitura): ler `b2b_boleto_requests.schedule` + `b2b_boleto_payments` (baixa) por pedido.
- Ordem de cálculo confirmada por teste (código de `quote.ts` + números): promoção % → mínimo → cupom → Pix 7%/cartão 3% só em produtos → frete.
- Testes: `b2b-boletos.test.mjs` (8) e o de ordem; `npm.cmd test` 104/104, `tsc` ok. Build e `git diff --check` não rodados nesta rodada (limite de uso).

---

## ★★★★★★★★★ Rodada 3: C1–C9 e B1 (02/10/2026), sobre `481390c`

Só local: sem push, deploy nem Neon. B2C: **nada de dados ou telas do B2C mudou**. Único toque em área compartilhada: nenhum arquivo do layout raiz; o rodapé do B2C é ocultado só dentro de `/b2b` por um `<style>` no layout B2B.

**ORDEM: SQL 19b → publicar → (opcionais, em qualquer momento) 16a/16b, 17b, 18b.**
- `19b_convite_copia_cifrada.sql` é **obrigatório antes do deploy**: o app faz `select` completo de `b2b_responsible_invites` (aceite do convite e admin), então precisa da coluna.
- `17b_promocao_percentual_snapshot.sql` e `18b_comissoes_pagas.sql`: o app tolera a falta (grava o pedido sem o snapshot do desconto %; lista as comissões sem a coluna "Paga"), mas rode antes de usar o desconto % e o "Marcar paga".
- `16a_promocoes_sem_elegibilidade.sql` (leitura) → `16b_elegibilidade_padrao_promocoes_sem_regra.sql` (aditivo): dá as 7 elegibilidades padrão às promoções ativas 3 por 2 / 4 por 2 que ficaram sem regra (a que o Luis criou no admin).

**C1 (promoção nova não clicável): causa real e correção.**
1. Promoção criada no admin não gravava nenhuma regra em `b2b_commission_rules`; sem regra não há opções 1x/2x/3x/30/60/90/180 e o botão da promoção fica `disabled` (`!hasRules`). Corrigido pelo C2.
2. Achado extra: o Offer Builder só listava promoção que tivesse **linha ligada** (`b2b_promotion_commercial_groups`). Promoção do admin só com produtos, ou sem produtos nem linhas ("vale para todos"), não aparecia em linha nenhuma. Agora o alcance por linha vem de `promotion-scope.ts` (linhas ligadas e/ou linha que contém o produto; sem nada = qualquer linha).
3. O servidor limita a promoção à **linha em que o vendedor a escolheu** (antes valia para qualquer produto da oferta).
Teste "promoção criada pelo admin → vendedor seleciona → escolhe 2x → rascunho → pedido" em `scripts/b2b-promotion-admin.test.mjs` (admin define elegibilidades → matriz do vendedor → rascunho aceito → snapshot 10+8=18; elegibilidade não marcada é recusada). Não dá para testar o link/checkout reais sem o banco da Bio.

**C2 admin.** Na aba Promoções: tipo (abertura/reconquista ou recorrente), tipo de benefício, e a seção "Elegibilidades e comissão extra" com as 7 opções (marcar/desmarcar + % extra), já preenchida com a tabela fechada para 3 por 2 (paga 2, +1) e 4 por 2 (paga 2, +2). Gravado em `b2b_commission_rules` (regras gerais; desmarcada = inativa, sem DELETE; regras por vendedor/cliente não são tocadas). Promoção ativa sem nenhuma elegibilidade é recusada (API e tela).

**C3 desconto percentual.** Novo tipo `percentage_discount` (campo `percentage` que já existia; sem coluna nova em promoções). Mesmos campos/tipo/elegibilidade/comissão extra do C2. Cliente vê preço B2B riscado, preço com desconto e "−X%" no card, na sacola e no checkout (valores do servidor). Ordem de cálculo (padrão): promoção % → pedido mínimo R$250 → cupom → desconto Pix 7% / cartão 3% sobre o preço já com a promoção → frete (R$450). Snapshot por item (SQL 17b): `promotion_type`, `promotion_percent`, `promotion_discount_cents`; `unit_price_cents` é o preço efetivo cobrado (é o que o Omie lê). Pedido com desconto % conta como uso da promoção (R5) e como item "promotion" na comissão (extra da elegibilidade).

**C4 alcance por linha.** Aviso/selo "somente em X" só nasce na linha da promoção e lista só os produtos daquela linha (`promotion-scope.ts`, testado: SKU ligado a duas linhas aparece só na que tem o produto).

**C5.** Cards do link (a Bio não tem página de produto no B2B): "4 pagas + 2 grátis = 6 unidades" ao vivo (mesma função do servidor) ou preço com −X%.

**C6 navegação.** O rodapé institucional (único elemento do layout raiz com links do B2C: /linha/*, /sobre, /atendimento, políticas, Instagram) fica oculto em `/b2b/*` (verificado no navegador: `display:none` no B2B e visível em `/atendimento`). Não existe logo/menu do site nas páginas B2B. Links verificados (todos dentro do token): oferta → `/b2b/oferta/<token>/linha/<slug>`; linha → "Voltar às linhas" `/b2b/oferta/<token>`, "Ver pedido" `/b2b/carrinho?b2b=<token>`; carrinho → "Voltar" `/b2b/oferta/<token>`, "Ir para o checkout" `/b2b/checkout?b2b=<token>`; checkout → "Voltar à oferta", "Voltar ao carrinho", pedido concluído → "Voltar à oferta"; WhatsApp do representante (wa.me).

**C7.** "Fique atento às campanhas. Pergunte ao seu representante." em "Outras linhas"; removido "Os demais produtos seguem pelo preço B2B normal" do aviso de promoção pontual. Nenhum "preço normal"/"sem promoção" restou no que o cliente vê (o badge sem promoção é só "Preço B2B").

**C8.** Admin → Vendedores: nos convites pendentes, "Copiar link de acesso / WhatsApp" (painel de compartilhamento já existente). O token do convite passa a ser guardado cifrado (AES-256-GCM, mesma chave do link da oferta) em `b2b_responsible_invites.token_ciphertext` (SQL 19b); convites antigos não têm cópia: "Gerar novo link" (o anterior deixa de valer, com aviso).

**C9 Minhas comissões** (`/b2b/painel/comissoes`, link no topo do painel; só os pedidos do vendedor, filtro no SQL por `b2b_responsible_id`). Por pedido: data, cliente, nº, pagamento, base, base + extra = total (média ponderada do snapshot), valor, situação (Aguardando pagamento · A receber em 10/mm/aaaa · Paga · Cancelada); totais (próximo dia 10, meses seguintes, já recebido, aguardando); filtros mês e cliente. Admin → aba "Comissões": lista por vendedor/mês, "Marcar paga" (data) e "Desfazer" (com motivo), com log (SQL 18b: `b2b_commission_payouts`, `b2b_commission_payout_log`). **Padrão aplicado (Luis confirma):** base = total do pedido − frete; a receber no dia 10 do mês seguinte ao **recebimento**; cancelado/estornado/expirado zera. **Limites:** (1) a Bio não grava `paid_at`; o recebimento de Pix/cartão usa a data do pagamento confirmado (`payments.created_at` do pagamento "paid"; o finalizador é compartilhado com o B2C e não foi alterado). (2) **Boleto: nunca pelo vencimento**; sem baixa da parcela fica "Aguardando pagamento (aguardando baixa do boleto)". Como a baixa por parcela é o C10 (ainda não feito), **a comissão de boleto só passa a "A receber" quando o C10 existir**. Hoje o único ponto de "pago" do boleto é o status do pedido, sem data de recebimento.

**B1 (boleto Bio na central da My Pet).** Como a Bio grava um pedido B2B por boleto: `orders.status = 'pending'` (e `fulfillment_status = 'awaiting_payment'`) **mesmo depois do boleto gerado**; `payment_method = 'boleto'`; a solicitação fica em `b2b_boleto_requests` (1 linha por pedido, `status = 'pending_request'`, `installments`, `schedule` = [{installment, dueDate, amountCents}] com 28/42/56 dias); os itens ficam em `order_items` com **duas linhas por item bonificado**: a paga (`unit_price_cents` > 0) e a bonificada (`unit_price_cents` = 0, `qty` = grátis); as duas carregam `paid_qty/bonus_qty/physical_qty` iguais. Portanto: (a) o "Aguardando pagamento" vem de `orders.status='pending'`, que é o estado real da Bio; para a central mostrar "Boleto emitido – a receber" ela deve usar `payment_method='boleto'` + existência de `b2b_boleto_requests` (e `b2b_offer_id IS NOT NULL`), **não** o status; mudar o status do pedido na Bio afetaria o B2C/Omie e não é necessário. (b) "Sem os itens bonificados": os itens bonificados **existem** no banco da Bio (linha com preço 0); se a central não os mostra, o filtro está do lado dela (provável: ignorar `unit_price_cents = 0` ou agrupar por produto e somar só `paid_qty`). Do lado da Bio não há o que corrigir. Consulta de conferência (leitura, Neon `bio-florais`) para a janela My Pet comparar com o que a central mostra: `sql/b2b/10a_conferencia_comissao_pedidos_b2b.sql` (traz `linha_do_pedido` pago/bonificado, `unit_price_cents`, status e forma) e, para o boleto, `SELECT o.id, o.status, o.payment_method, b.status, b.installments, b.schedule FROM orders o JOIN b2b_boleto_requests b ON b.order_id = o.id WHERE o.id::text LIKE 'f084d862%';`.

**Pendente/fora desta entrega:** C10 (baixa de boletos por parcela). Não toquei na central da My Pet.

**Testes (novos):** `b2b-promotion-admin.test.mjs` (C1/C2/C3/C4, SQL 16a/16b/17b), `b2b-commissions.test.mjs` (C9: base sem frete, ponderada, dia 10, boleto sem baixa, cancelada, paga, isolamento por vendedor, filtros, totais, 18b e 19b). **Verificações:** `npm.cmd test` 95/95, `tsc` exit 0, `npm.cmd run build` exit 0, `git diff --check` vazio. Telas novas (admin, painel de comissões, cards com desconto %) não foram abertas com dados reais: o navegador não alcança o Neon.

---

## ★★★★★★★★ Rodada 2: tipos de promoção, ciclo por linha e contagem (02/10/2026), sobre `dca7d8b`

Só local: sem push, deploy nem Neon. B2C intocado. **Ordem: SQL 14b → publicar.** (O app lê `b2b_promotions.promo_type`; sem o 14b o "porteiro" falha aberto e registra erro, mas o admin e o Offer Builder não funcionam.)

**R1/R7 tipo da promoção.** `b2b_promotions.promo_type` (`abertura_reconquista` | `recorrente`), obrigatório no admin (select na criação/edição); promoções existentes, inclusive as de teste, viram `abertura_reconquista` pelo default do SQL 14b. Parâmetro `reconquista_meses` (padrão 6) em `b2b_settings`, editável na aba Promoções do admin (1 a 60).

**R2 vendedor.** No "Ver promoções" as promoções ficam agrupadas em "Promoção de abertura / reconquista" e "Promoção para cliente recorrente"; cada uma mostra para o cliente em questão "Disponível: cliente nunca comprou esta linha" / "Disponível: sem compras nesta linha desde dd/mm/aaaa (reconquista)" / "Indisponível: cliente comprou esta linha em dd/mm/aaaa; abertura volta a valer em dd/mm/aaaa", e a indisponível aparece **desabilitada** (não some). O servidor revalida: rascunho (`validateDraftInput`), ativação/geração do link (`loadOfferReviewLines`), link do cliente, cotação e criação do pedido (`promotion-gate.ts` + `promotion-resolver.ts`). A abertura de uma oferta já ativa é avaliada pelo histórico do cliente **ignorando os pedidos da própria oferta** (a compra feita por ela não a invalida; a 2ª compra dentro de "2x" continua valendo).

**R3 troca de vendedor.** Tudo (histórico, ciclos, janela) vem de `orders.b2b_client_id`, nunca do vendedor. Oferta nova de outro vendedor para cliente em fase de preço normal: abertura bloqueada no rascunho e na ativação; a comissão segue a janela do cliente.

**R4 uma definição de compra** (`purchase-history.ts`, usada em tudo): pedido B2B **pago**, ou **boleto gerado** (linha em `b2b_boleto_requests`) e não cancelado. Pix/cartão pendente, expirado ou recusado não conta. Data = `orders.created_at`. Compra por linha = item pago (preço > 0) de produto da linha (`b2b_commercial_group_products`); vale também para linhas fora da oferta.

**R5 contador dinâmico.** Na Bio o `uses_count` era gravado na criação do pedido (e contava pendente/abandonado). Agora o app **não grava nem lê mais** `uses_count`: usos = pedidos da oferta que receberam bonificação da promoção e contam como compra (R4), mais **reserva** de Pix/cartão pendente criado há < 60 min (expirou/abandonou: libera). Nada foi apagado nem alterado no banco (a coluna fica como estava). Conferência: `15a_contador_de_usos_novo_vs_antigo.sql` (leitura): `uses_count_antigo` x `usos_regra_nova` por promoção. O "Usos" da aba Promoções do admin passou a usar a regra nova.

**R6 janela de 180 dias por LINHA (a confirmar pelo Luis).** Janela por cliente + linha, contada da 1ª compra (R4) do **ciclo atual** da linha; compra depois de mais de `reconquista_meses` sem comprar a linha abre ciclo novo (nova janela e nova abertura). Linha nunca comprada ou em reconquista: janela ainda não começou (a próxima compra recebe o extra). **Parametrizado em um lugar:** `COMMISSION_WINDOW_SCOPE = "line" | "brand"` em `purchase-history.ts` (`"brand"` usa o histórico da marca inteira; o teste cobre os dois). Cada item usa a janela da linha do produto (produto em mais de uma linha: vale a mais favorável). O snapshot (`commission_basis`) segue igual. O vendedor vê o texto da janela **por linha** no modal (preço normal), na revisão e na página do cliente ("Compras por linha e comissão no preço normal").

**SQL (Neon `bio-florais`), nesta ordem:** `14a_promocoes_tipo_preflight_one_shot.sql` (leitura) → `14b_promocoes_tipo.sql` (aditivo, idempotente, transação única: coluna `promo_type` com default + CHECK, tabela `b2b_settings` + `reconquista_meses=6`) → publicar → `15a_contador_de_usos_novo_vs_antigo.sql` (leitura). Os SQL 13b e 11b da rodada anterior continuam valendo.

**Pergunta do Luis: itens "duplicados" no 10a do pedido f084d862.** Não é a consulta nem linha duplicada por erro. Todo item **com bonificação** é gravado em **duas linhas** de `order_items`: a **paga** (preço > 0) e a **bonificada** (preço 0, `qty` = grátis); as duas carregam os mesmos `paid_qty`, `bonus_qty` e percentuais de comissão, e o 10a antigo não mostrava `qty` nem `unit_price_cents`, então parecia repetido (Menopausa e Viagens tinham bonificação). **Comissão ponderada:** não muda: o peso é `unit_price_cents × paid_qty` e a linha bonificada tem preço 0, logo peso 0. **Omie:** a exportação da central lê `qty` e `unit_price_cents` por linha (sem somar `physical_qty`), então a linha bonificada sai como item de valor zero com a quantidade grátis, que é o desejado; não há pagamento em dobro. O 10a foi ajustado para mostrar `linha_do_pedido` (pago | bonificado) e `unit_price_cents`. Risco só se algum relatório somar `physical_qty` ou `paid_qty` por linha: nesse caso conta em dobro (não identifiquei nenhum no código da Bio).

**Testes (novos, `scripts/b2b-promotion-cycles.test.mjs`, Postgres em memória):** cliente novo (abertura ok); fase de preço normal (abertura bloqueada com a data, recorrente ok); sem compra há 7 meses (reconquista ok, janela recomeça); ciclos (lacuna > 6 meses abre ciclo); janela por linha e por marca; troca de vendedor (nada reinicia, abertura continua bloqueada); a compra da própria oferta não invalida a abertura dela; boleto gerado não pago conta, boleto sem solicitação/cancelado/Pix expirado/Pix pendente não contam; contador dinâmico (pago, boleto, reserva < 60 min, abandono libera); dois pedidos pendentes simultâneos não usam o último uso duas vezes; servidor rejeita promoção indisponível mesmo se a tela mandar; comissão por item usa a janela da linha. Mais 14a/14b/15a no isolamento. **Verificações:** `npm.cmd test` 74/74, `tsc` exit 0, `npm.cmd run build` exit 0, `git diff --check` vazio.

**Limites assumidos:** a reserva de 60 min não é transacional (dois pedidos no mesmo milissegundo podem passar); "compra" por linha usa o produto pago do pedido (pedido misto conta nas linhas dos seus itens); o fim do ciclo/lacuna usa meses de calendário (UTC).

---

## ★★★★★★★ P2: comissão com janela de 180 dias (02/10/2026), sobre `847dda2`

Só local: sem push, deploy nem Neon.

**Regra (confirmada pelo Luis):** 180 dias, por CLIENTE nesta marca (não reinicia se trocar de vendedor), contados do `created_at` do 1º pedido B2B do cliente com `status='paid'` (`orders.b2b_client_id`; pedido pendente/cancelado não conta). Adaptado de `commission-window.ts` da My Pet (sem a tabela de janela: a 1ª compra paga sai de `min(created_at)` dos pedidos pagos, consulta única e sempre coerente com o status real, inclusive boleto baixado pelo admin).
- Item bonificado por promoção da oferta = base + extra da promoção (`promotion`), a janela não limita.
- Demais itens (sem bonificação, promoção esgotada, outras linhas): dentro da janela base + extra do preço normal (`normal_price`, 10+15=25); depois dos 180 dias só a base (`base_only`, 10). No dia 180 ainda vale 25. Sem compra paga anterior: a janela ainda não começou e a própria 1ª compra recebe o extra.
- Avaliada **na criação do pedido** e congelada por item: `order_items.commission_base/extra/total_percent` + **`commission_basis`** (coluna nova).
- **Vendedor vê** (Offer Builder, revisão e página do cliente, nunca o cliente): "10% + 15% = 25% até dd/mm/aaaa (180 dias após a 1ª compra); depois 10%"; antes da 1ª compra: "10% + 15% = 25% · válido por 180 dias a partir da 1ª compra paga; depois 10%"; janela encerrada: "Janela de 180 dias encerrada em dd/mm/aaaa: preço normal rende só 10%".

**SQL (Neon `bio-florais`):** `13b_commission_basis.sql` (aditivo: `order_items.commission_basis text`). Sem ele o pedido é criado normalmente, só sem a base (o app tenta com a coluna e, se faltar, grava sem ela). Pedidos antigos ficam NULL. Leitura: `13a_conferencia_contador_de_usos.sql`.

**Contador de usos 2x/3x (a pergunta do Luis):** na Bio ele SOBE, mas na **criação** do pedido (+1 por pedido que realmente recebeu bonificação, nunca +1 por item e nunca em pedido sem bonificação), não no pagamento. Logo a 1ª compra conta 1 de N (com "2x" a promoção continua para a 2ª compra e esgota na 3ª; com "1x" esgota depois da 1ª, como deve) — o problema da My Pet (nunca subir) não existe aqui. Efeito colateral a decidir: pedido criado e **não pago** (Pix expirado, cancelado) também consome 1 uso. `13a` mostra por promoção `uses_count` x pedidos com bonificação (pagos e não pagos) e marca `divergente`. Se houver consumo indevido, o conserto de dado é por UPDATE do `uses_count` (eu preparo depois de ver o 13a); mudar para "contar só pago" é decisão de regra (o risco é dois pedidos abertos aproveitarem a mesma promoção "1x").

**Testes:** `scripts/b2b-commission-window.test.mjs` (os 4 casos: sem compra anterior; dentro da promoção com janela fechada; promoção esgotada dentro dos 180 dias; depois de 180 dias, mais o dia 180 e o texto ao vendedor) e, no Postgres em memória, a consulta da 1ª compra paga (pendente de janeiro não conta, vendedor irrelevante), o 13b idempotente e o 13a. **Verificações:** `npm.cmd test` 61/61, `tsc` exit 0, `npm.cmd run build` exit 0, `git diff --check` vazio.

---

## ★★★★★★ Rodada comum 01/10 (noite), sobre `3dc6d5d`

Só local: sem push, deploy nem Neon. Commits: `4207cf0` (volumes) e o commit desta rodada (hash no fim da resposta).

**Volumes (aprovado pelo Luis, afeta o B2C):** só o campo `content` de `bio-products.ts`; 22 produtos mudaram para "31 ml" (os 9 Baby que mostravam 37 ml e os 13 que estavam vazios). Baby: Bebê Nervoso, Choro Excessivo, Fala Nenê!, Rescue S.O.S., Sociabilidade, Sono, Tirando a Chupeta, Tirando a Fralda (37→31); Gravidez Conturbada, Mamãe Volta ao Trabalho, Pós-Vacina (vazio→31). Kids (vazio→31): Concentração, Sociabilidade, Separação, Momento Reequilíbrio Alimentar, Medos Infantis, Carência, Pesadelos, Teimosia. Teen (vazio→31): Controle Emocional, Meu Lugar no Mundo, Controle Alimentar. O "padrão inferido" do B2B foi removido (`b2bProductContent` lê só o catálogo). Obs.: o título de alguns slugs/URLs antigos com "37ml" no `middleware.ts` (Pet) não foi tocado.

**P0.1 isolamento:** revisão feita: todas as páginas e rotas do vendedor passam por `ownership.ts` (vínculo ativo + vendedor ativo, no SQL); "Interesses dos clientes" filtra `responsible_id` na query; cliente de outro vendedor = 404; o teste com dois vendedores (lista, URL direta, oferta, transferência, desativado) segue verde. Como o código já isola, a causa provável é dado: `10b_diagnostico_isolamento_vendedores.sql` (leitura, uma linha JSON) lista cliente com 2+ vendedores ativos, cliente sem vínculo, oferta de vendedor diferente do vínculo e pedido com vendedor diferente da oferta. Rodar no `bio-florais` e me mandar o resultado; correção de dado só depois de ver.

**P0.2 sacola:** a sacola B2B já usa chave própria (`bioflorais.b2b.cart.v1`, não toca a do B2C) e só aparece no carrinho/checkout se o token da URL for igual ao token guardado; outro link esvazia. Fechei duas brechas: sacola gravada sem token é descartada e itens sem token não passam para o link novo. Concluir o pedido esvazia (já fazia). Limite assumido: uma sacola por navegador (trocar de link zera a anterior).

**P0.3 comissão:** o pedido B2B da Bio grava o snapshot **por item** em `order_items` (`commission_base/extra/total_percent`, mais `promotion_name`, `paid_qty`, `bonus_qty`), em qualquer forma de pagamento (todas passam por `orders/create`). Não existe coluna de comissão no pedido (a ponderada é calculada na consulta). Conferência para o Luis: `sql/b2b/10a_conferencia_comissao_pedidos_b2b.sql` (Neon `bio-florais`, só leitura): `itens_sem_comissao` deve ser 0 e `comissao_ponderada_pct` é a do pedido (testada: 25%/18% → 20,8%). Se vier NULL, o pedido nasceu sem a matriz de comissão.

**P1.1:** frase única "Preço B2B normal, sem promoção. Quer uma condição especial? Pergunte ao seu representante." só no topo de "Outras linhas"; removida dos cards e do cabeçalho da linha. ("Peça um novo ao administrador" nos convites é outro contexto e ficou.)

**P1.2:** bonificação ao vivo no seletor de quantidade, só em produto elegível, com a mesma função do servidor (`calculateB2BPromotionBonusQty`) sobre (já no pedido + quantidade): "+1 grátis · você recebe 3"; abaixo do mínimo: "Compre 2 para ganhar +1 grátis".

**P1.3:** no "Ver promoções", a opção escolhida (promoção e elegibilidade) fica preenchida e com ✓; o resumo do card diz "3 por 2 · 2 compras" / "· 60 dias".

**P1.4:** na página do cliente, "Copiar link da oferta" e "Enviar por WhatsApp" (wa.me com o telefone do cliente, se houver) para o link ATIVO, só do próprio vendedor (`GET /api/b2b/offers/link?offerId=`). Como o banco guarda só o hash, o token passou a ser guardado **cifrado** (AES-256-GCM, chave derivada de `ADMIN_SESSION_SECRET`) em `b2b_offer_links.token_ciphertext`: **SQL `11b_offer_link_copia_cifrada.sql`** (aditivo). Sem o 11b o app funciona (grava sem a cópia); links já existentes não têm cópia e pedem "Gerar novo link" (o anterior deixa de valer, com aviso). O convite de cadastro do vendedor é gerado pelo admin nesta marca (já tem Copiar/WhatsApp ao gerar), não há convite na área do vendedor.

**P1.5 recompra:** como era: o link não expira (`expires_at` nulo) e continua valendo depois da 1ª compra até ser revogado ou substituído; o contador `uses_count` sobe a cada pedido que usou a promoção e a promoção esgotada simplesmente deixa de bonificar (a linha segue comprável a preço normal). O que faltava e agora existe: (a) tela de pedido concluído com "Para comprar de novo, use sempre este link" + Copiar; (b) ao reabrir o link, o card da linha mostra "Você ainda tem N compras com 3 por 2" ou "3 por 2 válido até dd/mm/aaaa"; esgotada, o selo vira "Preço B2B". Não há e-mail transacional de confirmação nesta marca. O vendedor reenvia pelo P1.4.

**P1.6 texto quebrado:** não achei mojibake nos arquivos do admin B2B (as abas leem os nomes do banco); então a causa provável é dado. Diagnóstico `12a_diagnostico_texto_quebrado.sql` (leitura, uma linha JSON, mostra `texto` e `corrigido` por id) e correção `12b_corrigir_texto_quebrado.sql` (UPDATE só em `b2b_promotions`, `b2b_commercial_groups`, `b2b_clients`, `b2b_responsibles`, só onde o resultado fica limpo; antes/depois; sem DELETE). Testados no Postgres em memória ("3 por 2 â€” PromoÃ§Ã£o" → "3 por 2 — Promoção"). ⚠ **Achado fora do B2B, não corrigido:** há texto com encoding quebrado em arquivos do B2C: mensagens de erro em `src/app/api/orders/create/route.ts` (ex.: "nÃ£o informado", "vÃ¡lido"), `api/payments/mercadopago/card/route.ts`, `api/webhooks/mercadopago/route.ts` e `lib/content/product-content.ts` (comentários em `schema.ts`). Mexer muda o B2C: espero decisão do Luis.

**P2 (só desenho, não publicado, aguarda confirmar 180 dias):** nada de código. Proposta: `orders.b2b` ganha a data da 1ª compra paga por cliente (derivada: `min(paid_at)` dos pedidos B2B pagos do cliente nesta marca, calculada na criação do pedido); um resolvedor puro `resolveItemCommission({matrix, offerCondition, firstPaidAt, now, item})` devolve `{basis: 'promotion'|'normal_price'|'base_only', base, extra, total}`: item bonificado dentro da elegibilidade = promoção; senão, se `now <= firstPaidAt + 180 dias` (ou sem 1ª compra ainda) = preço normal (base+extra); senão `base_only`. O snapshot do item ganha a coluna `commission_basis` (SQL aditivo). Offer Builder, revisão e painel mostram "10% + 15% = 25% até dd/mm/aaaa (180 dias após a 1ª compra); depois 10%" ou "válido por 180 dias a partir da 1ª compra". Testes: dentro da promoção, promoção esgotada dentro de 180 dias, depois de 180 dias, cliente sem compra anterior. Pergunta aberta: o "pago" conta da confirmação do pagamento (Pix/cartão) ou da compensação do boleto?

**Verificações:** `npm.cmd test` 54/54, `tsc` exit 0, `npm.cmd run build` exit 0, `git diff --check` vazio.

**SQL desta rodada (Neon `bio-florais`):** `10a` e `10b` (leitura), `11b` (aditivo), `12a` (leitura) e, depois de ver o 12a, `12b` (UPDATE por linha).

---

## ★★★★★ Rodada 2 pós-teste: 08c, filtro em todas as listas e nova página do link (sobre `79cdf5b`)

Só local: sem push, deploy nem acesso ao Neon. **B2C intacto**: Home, header, carrinho B2C e `bio-products.ts` não foram alterados.

1. **`sql/b2b/08c_desativar_vendedor_e_cliente_de_teste.sql`** (Neon `bio-florais`): SELECT antes, `UPDATE` sem DELETE em BEGIN/COMMIT, SELECT depois, só pelos ids `dcb67a56-cadf-4cce-ab46-86fb1285f288` (vendedor → `status='inactive'`) e `1d403746-7519-454e-a9e6-32408d62d1ec` (cliente → `active=false`). Testado em Postgres em memória com ClienteTesteB2 e Bio-B2B-Test5 de isca: continuam intactos. **Vendedor inativo não loga**: o login responde 403 "acesso desativado" depois da senha, e `requireResponsible`/páginas exigem `status='active'` (teste confere os dois no código).
2. **Filtro `isTestCommercialGroup` em toda lista de linhas**: Offer Builder, contexto público da oferta e agora também "Outras linhas" (`line-views.ts`).
3. **Página do link do cliente refeita** (`/b2b/oferta/<token>`): topo com cliente, vendedor, pedido mínimo R$ 250 e frete especial B2B a partir de R$ 450; primeira tela = cards de linha com a mesma arte e proporção da Home (`B2BLineCard`, cópia do visual sem alterar a Home). "Sua oferta" primeiro, com moldura azul e selo ("3 por 2" ou "3 por 2 · promoção somente em Baby Floral em Gotas Sono"); "Outras linhas" logo abaixo com TODAS as demais linhas B2B publicadas (inclui as 7 do 09b), sem destaque, "Preço B2B normal, sem promoção". Clicar abre `/b2b/oferta/<token>/linha/<slug>` (agora serve linha da oferta e fora dela): produtos com foto, preço B2B, selo "Compre X e leve +Y grátis" só nos elegíveis, quantidade e Adicionar. Linha fora da oferta continua registrando o interesse e com o botão de WhatsApp. Celular: 1 coluna, sem rolagem horizontal (medido: largura 375 = 375).
4. **Volume faltando (37 ml)**: o dado vazio está no catálogo compartilhado com o B2C (`bio-products.ts`, 14 produtos com `content: ""`: Baby Gravidez Conturbada, Mamãe Volta ao Trabalho e Pós-Vacina; 8 da Kids; 3 da Teen). Não alterei. Só no B2B (`b2bProductContent`) uso o padrão das demais gotas da linha: Baby 37 ml, Kids e Teen 31 ml. **Luis: confirme Kids e Teen** (inferido do padrão; Baby foi dado por você). Corrigir no catálogo mudaria o B2C: decisão sua.
5. **As 7 linhas para o vendedor**: o Offer Builder lista todo grupo ativo e visível sem filtrar por promoção, então depois do 09b elas aparecem como cards marcáveis com preço B2B normal (as artes de Kids, Teen, Dose Única, Virtudes Divinas, Cosméticos, Cosméticos Pet e Home Care já estão mapeadas).

**Validação visual** (página temporária, apagada, fora do commit) com o mesmo componente e dados fictícios: desktop e celular 375px. Não foi possível testar o link real porque o navegador não alcança o Neon.

**Verificações:** `npm.cmd test` 51/51, `tsc` exit 0, `npm.cmd run build` exit 0, `git diff --check` vazio.

---

## ★★★★ Rodada de correção pós-teste do Luis (vendedor Bio5), sobre `b170d3a`

Só local: sem push, deploy nem acesso ao Neon. **Nada do B2C foi alterado** (só arquivos `src/**/b2b`, `src/lib/b2b`, `api/b2b`, SQL e testes; `products`, header, carrinho B2C e textos não foram tocados). Encoding do banco: não mexi.

### 1. "BIO-B2B TEST GROUP 5519ea839c1d460b"
- **Origem:** não existe em nenhum código, seed ou teste do repositório (`git log -S` só acha o nome sem sufixo, no 06b/ENTREGA). O sufixo hex indica um teste de fumaça feito fora do repo contra o banco de produção (provavelmente das primeiras validações do B2B). O 06b só desativava o nome **exato**, por isso este sobrou ativo.
- **Impede de repetir:** `isTestCommercialGroup` (offer-builder.ts) nunca deixa um grupo "BIO-B2B TEST*" virar card no Offer Builder nem aparecer no link do cliente; o 06b agora usa `ILIKE 'BIO-B2B TEST%'`.
- **SQL (projeto Neon `bio-florais`), nesta ordem:**
  1. `08a_dados_de_teste_preflight_one_shot.sql` (só leitura, 1 linha JSON): procura "test" em grupos, promoções, produtos, clientes, vendedores e cupons; lista linhas de produto sem grupo e as 10 ofertas mais recentes com linhas e promoções gravadas.
  2. `08b_desativar_grupo_de_teste.sql`: SELECT antes, `UPDATE` (active=false, b2b_visible=false; sem DELETE) em BEGIN/COMMIT, SELECT depois.

### 2. Demais linhas sem promoção não apareciam
- Causa: só existiam grupos comerciais Adulto/Pet/Infantil/Baby (criados pelo 06b). O Offer Builder já lista qualquer grupo ativo e visível; faltavam os grupos.
- **SQL:** `09b_linhas_b2b_demais.sql` (aditivo, idempotente, transação única): cria grupo para Kids, Teen, Dose Única, Virtudes Divinas, Cosméticos, Cosméticos Pet e Home Care **só se houver produto ativo** com aquele `products.line_slug`, e liga os produtos. Sem promoção: o card aparece com preço B2B normal. Só lê `products`. Rode o 08a antes e confira `linhas_de_produto_ativas_sem_grupo`; slug fora da lista não é criado.

### 3. Contador "1 linha(s)" com 5 cards marcados
- **Não consegui reproduzir só pelo código** (o contador lia `selected.size` do mesmo estado dos cards). Endureci o que podia causar a divergência: o contador conta só linhas que existem na tela; ids antigos de rascunho (ex.: o grupo de teste agora oculto) não são enviados nem contados; o ✓ só é desenhado na linha realmente selecionada; o texto concorda no plural.

### 4. Link do cliente sem promoção / `offer_promotions_total: 0`
- Revisei o fluxo inteiro (escolher → rascunho → revisão → ativar → link → carrinho → pedido). O servidor aplica a bonificação a partir de `b2b_offer_promotions`; **com 0 linhas nessa tabela nenhuma promoção pode valer**, então a causa está em a escolha não ter sido gravada naquela oferta.
- Achei dois pontos fracos reais e corrigi: (a) o rascunho fazia 4 comandos soltos (apagar, apagar, inserir, inserir), podendo deixar a oferta com linhas e sem promoção; agora é `db.batch` (transação única) **e confere a contagem gravada**, respondendo erro se diferir; (b) a página do link **não mostrava aviso nenhum de promoção**; agora mostra a faixa azul da linha e o selo "Compre X e leve +Y grátis" por produto elegível (promoção pontual só nos SKUs dela). A bonificação em si continua vindo do servidor (resolveB2BPromotionBonusLines).
- **Diagnóstico pendente (preciso do resultado do 08a):** o bloco `ofertas_recentes` mostra, por oferta, as linhas e as promoções gravadas. Se a oferta do Bio5 aparecer sem promoção, a escolha não foi salva (ex.: link gerado de oferta feita sem "Salvar esta condição" ou antes do 07b); se aparecer com promoção e o link ainda não bonificar, me mande a linha que investigo o resolver.

### Verificações (em `HEAD` desta rodada)
`npm.cmd test` 50/50 (novos: 08b com grupo de sufixo hex, 09b, 08a, filtro de teste), `tsc` exit 0, `npm.cmd run build` exit 0, `git diff --check` vazio.

---

## ★★★ Terceira rodada, parte 2: itens 3, 5, 6 e 7 (sobre `c2151c9`)

Mesma branch `b2b/bio-admin-v1`, commits novos **depois de `c2151c9` (produção)**. Só local: sem push, deploy nem acesso ao Neon.

```
15f7ff5 fix(security): OAuth do Melhor Envio exige sessao do admin e state aleatorio em cookie httpOnly
0b48997 feat(b2b/bio): outras linhas compraveis pelo preco B2B normal, sem promocao
2450a57 fix(b2b/bio): esconde os elementos flutuantes do B2C nas rotas /b2b
80a6b1b feat(b2b/bio): Offer Builder no padrao My Pet (cards da Home, modal de promocoes, comissao, revisao obrigatoria) + isolamento entre vendedores
333d8a8 test(b2b/bio): npm test com alias @/ e PGlite (Postgres em memoria) como devDependency
```

**Verificações (em `15f7ff5`):**
- `npm.cmd test`: **47/47**.
- `tsc` exit 0.
- `npm.cmd run build` exit 0 (42/42).
- `git diff --check c2151c9..HEAD` vazio.
- eslint: nenhum erro ou aviso nos arquivos desta rodada; os 12 erros restantes são dos arquivos B2C que já existiam.
- Validação visual no navegador (desktop 1280px e celular 375px), com uma página temporária de pré-visualização que renderiza o **mesmo** componente com dados iguais ao seed. A página foi apagada e **não está em nenhum commit**.

**Ordem de publicação:**
- `15f7ff5` (segurança do Melhor Envio) é independente e pode subir sozinho e antes.
- Os demais dependem do SQL abaixo.

### D.1 Item 3: Offer Builder no padrão da My Pet (`80a6b1b`, `2450a57`)

Replica `/area-interna/b2b` da My Pet conforme a Especificação B2B V1.26–V1.29 (§44–§48). Fluxo: **vendedor logado → só os clientes dele → cliente → Offer Builder → revisão obrigatória → link**.

| Tela | O que faz |
|---|---|
| `/b2b/painel` | **Só os clientes do vendedor** em cards; "+ Novo cliente" (**só o nome é obrigatório**, e depois de cadastrar já abre o Offer Builder); "Interesses dos clientes" com "Montar nova oferta". **O painel antigo de checkboxes ("BIO-B2B TEST GROUP") foi removido.** |
| `/b2b/painel/cliente/[id]` | Ofertas do cliente: rascunho ("Revisar e gerar link" / "Editar rascunho") ou ativa ("Gerar novo link" / "Revogar link"). |
| `/b2b/painel/cliente/[id]/oferta` | **Offer Builder.** Detalhado logo abaixo. |
| `/b2b/painel/cliente/[id]/oferta/revisao` | **Revisão obrigatória:** cada linha com a condição, a elegibilidade e a comissão "base + extra = total"; "← Voltar e editar" ou **"Gerar link para o cliente"**, que ativa a oferta e mostra o link uma vez, com Copiar e WhatsApp. |

**Offer Builder em detalhe:**
- **Cards reais das linhas da Home B2C** (`/assets/home/linhas/*.png`, mapeados por slug em `src/lib/b2b/line-images.ts`), em grade de 2 colunas no desktop e 1 no celular.
- **Check circular no canto superior esquerdo**; linha não selecionada fica **esmaecida** (opacidade 40% e escala de cinza).
- **"Ver promoções"** no canto superior direito, só nas linhas com promoção vigente e selecionável. Abre um **modal** com:
  - **Preço B2B normal** e as promoções da linha;
  - ao escolher uma promoção, o modal expande **somente as elegibilidades configuradas** no banco (1x/2x/3x compras; 30/60/90/180 dias), sem campo livre e sem a opção "compras + prazo";
  - em **toda alternativa**, "**comissão-base + extra = total**" lida de `b2b_commission_rules`, sem nada fixo no código.
- **"Salvar esta condição"**: com promoção, o card ganha **moldura azul** e o selo "Condição promocional: 3 por 2 · 60 dias"; com preço normal, o card fica selecionado sem moldura.
- **Promoção pontual por produto** (Baby Sono) aparece indicada no card fechado e no modal ("Somente Baby Floral em Gotas Sono").
- **"Salvar e revisar oferta →"** grava o **rascunho** (status `draft`) e abre a revisão. **Nenhuma rota cria oferta já ativa sem revisão:** a rota antiga `POST /api/b2b/offers` foi **removida**, e um teste garante isso.
- O **cliente nunca vê comissão**. Os dados de comissão só existem nas páginas e rotas do vendedor logado.

**Validado no navegador:**
- cards com as 4 artes reais;
- Adulto normal sem moldura; Pet e Infantil esmaecidas; Baby com moldura azul;
- modal com "10% + 15% = 25%" no preço normal;
- "3 por 2" expande compras 20/18/16% e prazos 20/18/16/13%;
- "Salvar esta condição" fecha o modal e aplica a moldura;
- no Baby, "Somente ... Sono", com a condição salva voltando pré-selecionada;
- no celular, uma coluna.

**Correção encontrada nessa validação (`2450a57`):** o botão B2C flutuante "Seja uma criadora" **cobria "Salvar e revisar oferta"**, e a barra de linhas B2C ocupava o rodapé. O componente `HideOnB2B` (no layout raiz) esconde nas rotas `/b2b` só o carrinho B2C, esse botão e a barra de linhas. O rodapé institucional continua, e o B2C não muda fora de `/b2b`.

**Ativação** (`POST /api/b2b/offers/[id]/activate`):
- revalida cada condição contra as promoções vigentes e a matriz;
- elegibilidade por prazo vira `valid_from` = agora e `valid_until` = agora + N dias; por compras, `max_uses` = N e `uses_count` = 0;
- a ativação é condicional (`WHERE status='draft'`), então dois cliques não geram dois links.

Ofertas antigas, criadas já ativas pelo painel anterior, continuam funcionando.

**Comissão congelada no pedido.** `orders/create` grava em cada `order_items`:
- `commission_base/extra/total_percent`;
- o snapshot da promoção: `paid_qty`, `bonus_qty`, `physical_qty`, `promotion_id`, `promotion_name`, X e Y.

A regra:
- **item que recebeu a bonificação de uma promoção da oferta** → extra da promoção na elegibilidade da oferta;
- **demais itens**, inclusive de linha com promoção que não chegou a bonificar → extra do preço normal.

Mudar a matriz depois não altera pedidos já feitos. Sem a matriz configurada, os campos ficam vazios: o sistema nunca inventa percentual.

Decisão a confirmar: a My Pet não chegou a implementar esse snapshot (o `commission-resolver` dela não existe). Se a comissão de um item de linha promocional que **não** bonificou deve ser a da promoção, e não a do preço normal, é só ajustar `src/lib/b2b/order-commission.ts`.

### D.2 Item 5: isolamento entre vendedores (`80a6b1b`, `333d8a8`)

- `src/lib/b2b/ownership.ts` é a **única fonte** das consultas de posse: clientes com vínculo ativo, ofertas do próprio vendedor de cliente ainda vinculado, e **vendedor desativado não vê nada**.
- Todas as páginas `/b2b/painel/**` e as rotas `clients`, `offers/draft`, `offers/link` e `offers/[id]/activate` passam por ela. Id de outro vendedor na URL resulta em 404.
- **Teste automático com dois vendedores** contra Postgres real em memória (`@electric-sql/pglite`, devDependency autorizada), em `scripts/b2b-vendor-isolation.test.mjs`:
  - cada vendedor lista só os próprios clientes;
  - não abre cliente nem oferta do outro, nem trocando ids na URL;
  - cliente transferido: o vendedor antigo perde acesso, inclusive à oferta antiga;
  - vendedor desativado não vê nada;
  - id inválido nem chega ao banco.
- **O mesmo teste executa de verdade os SQLs** que o Luis roda no Neon:
  - `06a` (preflight) antes do seed;
  - **`06b` duas vezes** (idempotente: exatamente 8 promoções com 7 regras cada, a Baby restrita ao Sono e o grupo de teste inativo);
  - a matriz lida do banco com os valores do Luis e o override por vendedor e por cliente;
  - `07b` duas vezes e `07a` confirmando as colunas.
- `scripts/b2b-offer-builder.test.mjs` varre as rotas e páginas do vendedor (sessão obrigatória e uso de `ownership.ts`) e confere que nenhuma rota além da ativação cria oferta ativa.
- `npm test` roda tudo: o script novo no `package.json` usa um carregador só de teste para o alias `@/` (mesmo padrão da My Pet).

### D.3 Item 6: outras linhas com preço B2B normal (`0b48997`)

- `/b2b/oferta/<token>/linha/<slug>` agora mostra os produtos **com preço B2B normal e "Adicionar"**: mesmo carrinho e checkout da oferta, com o aviso "sem promoção".
- A página continua **gravando o evento** e mostrando o botão de WhatsApp para o vendedor.
- A cotação aceita os produtos da oferta e das outras linhas, mas o **motor de promoção recebe só os produtos da oferta**, então promoção nunca se aplica fora dela. Um teste trava essa regra. A comissão desses itens é a do preço normal.

### D.4 Item 7: segurança do Melhor Envio (`15f7ff5`, commit separado)

- `/api/shipping/melhorenvio/authorize` e `/callback` exigem a **sessão do admin** (401 sem ela).
- O authorize gera um **state aleatório** de 256 bits, enviado na URL e num **cookie httpOnly** (`SameSite=Lax`, válido só no caminho do callback, por 10 min).
- O callback só aceita se o state devolvido for **igual ao do cookie** (comparação em tempo constante). O cookie é de **uso único** e é apagado em qualquer resposta.
- `scripts/melhorenvio-oauth.test.mjs` chama as **rotas reais**, sem rede: **6/6**. Com a versão anterior das rotas, **5 falham**.
- **Uso:** com o admin logado, abrir `/api/shipping/melhorenvio/authorize` no mesmo navegador, como antes.

### D.5 SQL (o Luis roda no Neon, nesta ordem, antes do deploy desta parte)

1. `06a` → `06b` (seed da parte 1). Cria `b2b_commission_rules`. Sem ele, o Offer Builder funciona só com o preço normal e mostra o aviso "comissão não configurada".
2. `07a_offer_builder_preflight_one_shot.sql` (uma consulta, só leitura) → `07b_offer_builder_candidate_if_not_exists.sql`:
   - `b2b_offer_promotions` recebe `commercial_group_id`, `eligibility_mode` e `duration_days`;
   - `order_items` recebe as colunas de snapshot. Pela introspecção de 29/09 elas já existem; o `IF NOT EXISTS` só garante.
   - As telas B2C e do admin leem `order_items` com colunas explícitas, então **não dependem** delas. Só o pedido B2B grava nelas.

Os dois scripts SQL desta parte e o seed **foram executados de verdade** num Postgres em memória, com as tabelas da Bio reproduzidas (`npm test`).

### D.6 Roteiro de teste (Luis)

1. Aplicar `06a`/`06b` e `07a`/`07b`.
2. Logar como vendedor A em `/b2b/login`: aparecem **só os clientes de A**. Cadastrar "Cliente Teste" só com o nome: já abre o Offer Builder.
3. **Offer Builder:**
   - aparecem os cards Adulto, Pet, Infantil e Baby com as artes da Home;
   - marcar Adulto (sem moldura);
   - em Baby, clicar "Ver promoções" → aparece "Somente ... Sono"; escolher **3 por 2 → 30 dias** (comissão 10% + 10% = 20%) e "Salvar esta condição" → **moldura azul**;
   - "Salvar e revisar oferta →".
4. **Revisão:** Adulto "Preço B2B normal 10% + 15% = 25%"; Baby "3 por 2 · 30 dias · 20%". Clicar "Gerar link para o cliente" e copiar o link.
5. **Como cliente** (aba anônima):
   - comprar 4 Sono Baby → o checkout mostra "+2 grátis";
   - abrir "Outras linhas" → Pet aparece **com preço normal** e dá para adicionar ao carrinho;
   - a promoção **não** se aplica ao Pet.
6. Fechar um pedido de teste: em `order_items`, o Sono fica com comissão 10/10/20 e a promoção "3 por 2 - Baby Sono"; os demais itens ficam com 10/15/25.
7. **Isolamento:** logar como vendedor B. Os clientes de A não aparecem, e colar a URL `/b2b/painel/cliente/<id do cliente de A>` dá 404.
8. **Interesses:** como vendedor A, o bloco "Interesses dos clientes" mostra "Cliente Teste visualizou a linha Pet"; "Montar nova oferta" já vem com Pet marcada.
9. **Melhor Envio:**
   - sem estar logado no admin, `/api/shipping/melhorenvio/authorize` dá 401;
   - logado, autoriza normalmente;
   - um callback com `state` alterado dá "State inválido".

---

## ★★★ Terceira rodada (decisões do Luis em 01/10), parte 1: itens 1, 2 e 4

Na mesma branch `b2b/bio-admin-v1`, **depois de `941e78f` (produção)**, em commits novos, sem reescrever nada publicado. Tudo só local: sem push, deploy nem acesso ao Neon.

```
1d3e3ee feat(b2b/bio): seed SQL das promocoes de teste (3 por 2 e 4 por 2) + matriz de comissao
974f7c5 chore(b2b/bio): remove import sem uso apos tirar a aprovacao
4011db8 feat(b2b/bio): cadastro pelo convite ja nasce ativo (sem aprovacao)
```

**Verificações (em `1d3e3ee`):** `tsc` exit 0; `npm.cmd run build` exit 0 (43/43); `node --test` 23/23; `git diff --check 941e78f..HEAD` vazio.

### C.1 Aprovação removida: `4011db8`
- O cadastro pelo convite nasce **ativo**: `status = "active"` e `company_approved_at` = agora. A tela final diz "Cadastro concluído. Você já pode entrar na área B2B".
- No admin, saem o status "Aguardando aprovação" e a ação "Aprovar". Ficam "Desativar" e "Reativar".
- Cadastros antigos que tenham ficado `pending` aparecem como **Inativo**. "Reativar" os ativa e preenche `company_approved_at` se estiver vazio.
- No login, qualquer status diferente de `active` resulta em "acesso desativado".
- Não precisa de SQL.

### C.2 Novo cliente: só o nome
Já era assim e foi conferido. `POST /api/b2b/clients` exige só `displayName`, e o painel só pede o nome. Contato, e-mail e telefone são opcionais, e gerar o link não exige nenhum outro dado do cliente. O Offer Builder novo (parte 2) mantém isso.

### C.3 Seed das promoções de teste: `1d3e3ee` (o Luis roda no Neon)
1. `sql/b2b/06a_seed_promocoes_teste_preflight_one_shot.sql` (um SELECT, uma linha em json, só leitura). Conferir:
   - `products_by_line`: Adulto, Pet, Infantil e Baby com produtos ativos;
   - `baby_sono_candidates`: **exatamente 1**;
   - `commission_rules_table_exists`: se a tabela já existe (se não existir, o 06b cria);
   - `promotions_scope_values` e `promotions_not_null_without_default`.
2. `sql/b2b/06b_seed_promocoes_teste.sql`, numa **transação única e idempotente** (rodar de novo não duplica nada):
   - `b2b_commission_rules`, com `CREATE TABLE IF NOT EXISTS` (estrutura da My Pet) e as colunas `eligibility_mode`, `max_uses` e `duration_days`;
   - **grupos reais** `adulto`, `pet`, `infantil` e `baby` (nomes e ordem das linhas da Home B2C), com os produtos ativos de cada linha por `products.line_slug`;
   - **"BIO-B2B TEST GROUP" fica inativo**, sem ser apagado;
   - **promoções**, todas do tipo com efeito no servidor (`buy_x_get_y_auto_same_sku`), na mesma mecânica da My Pet:
     - "3 por 2 - Adulto/Pet/Infantil": compra 2, leva +1 grátis, mesmo SKU;
     - "4 por 2 - Adulto/Pet/Infantil": compra 2, leva +2 grátis, mesmo SKU;
     - "3 por 2 - Baby Sono" e "4 por 2 - Baby Sono": vinculadas à linha Baby, mas **restritas ao produto `baby-floral-em-gotas-sono`** (o produto explícito tem prioridade no motor);
   - **comissão** (regras gerais, sem vendedor ou cliente específico):

     | Regra | Valor |
     |---|---|
     | base | 10% |
     | preço B2B normal | +15% |
     | 3 por 2, por compras 1/2/3 | +10 / +8 / +6% |
     | 3 por 2, por prazo 30/60/90/180 dias | +10 / +8 / +6 / +3% |
     | 4 por 2, por compras 1/2/3 | +6 / +4 / +2% |
     | 4 por 2, por prazo 30/60/90/180 dias | +6 / +4 / +2 / +1% |
   - **trava:** aborta tudo se não houver exatamente 1 produto `baby-floral-em-gotas-sono`.
   - Ao final do arquivo há uma consulta de conferência, em comentário. O esperado é 8 promoções, cada uma com 7 regras de comissão.
3. **Não executei** o SQL: não tenho acesso ao Neon nem Postgres local. Revisei a sintaxe manualmente.

As regras de comissão passam a ser lidas pelo **Offer Builder** (parte 2, item 3), que mostra "comissão-base + extra = total" ao vendedor. Até lá, as promoções já aparecem na aba **Promoções** do admin e ficam selecionáveis no painel atual.

### C.4 Próximo (parte 2)
Entregue na parte 2 (seção acima).

---

## ★★ Segunda publicação: segurança, vencimentos do boleto e abas 2–4 (sobre `bdead29`)

A primeira publicação é o `bdead29` (aba 1). Tudo abaixo vem **depois** dele, na mesma branch `b2b/bio-admin-v1`, só local: sem push, deploy nem acesso ao Neon.

```
7324298 feat(b2b/bio): admin B2B abas 2, 3 e 4 (linhas, promocoes, acompanhamento) + registro de linha aberta fora da oferta
d2f5fc9 feat(b2b/bio): vencimentos do boleto 28/42/56 dias da data do pedido (Sao Paulo), gravados e mostrados no checkout
c2cf328 fix(admin/security): rotas /api/admin/orders/[id]/fulfillment e /shipment exigem a sessao do admin
```

**Verificações (depois de `7324298`):**
- `tsc` exit 0.
- `npm.cmd run build` exit 0 (43/43, com todas as rotas novas).
- `node --test` nos 4 arquivos de `scripts/`: **23/23**.
- `git diff --check` vazio.
- eslint: 0 erros e 0 avisos nos arquivos B2B e admin.

**Ordem sugerida de publicação:**
- `c2cf328` é **só segurança**: não depende de SQL e pode subir sozinho e antes.
- `d2f5fc9` exige o SQL `04b` aplicado antes.
- `7324298` exige o SQL `05b` aplicado antes.

### B.1 Segurança (produção): `c2cf328`

- **Problema:** `PATCH /api/admin/orders/[id]/fulfillment` e `PATCH /api/admin/orders/[id]/shipment` não conferiam a sessão. Qualquer pessoa podia mudar a etapa de separação, a transportadora, o rastreio e marcar como enviado qualquer pedido.
- **Correção:** os dois handlers agora começam com `if (!isAdminRequest(request)) return 401`, usando o mesmo cookie e HMAC do login do admin, com comparação em tempo constante. O `isAdminRequest` passou a aceitar qualquer `Request` (lê o header `cookie`). As telas do admin chamam essas rotas do mesmo domínio, então o cookie segue junto e nada muda para quem está logado.
- **Revisão das demais rotas `/api/admin/*`:** o `login` é público por definição. As rotas `/api/admin/b2b/*` (4 da aba 1 e 7 novas) já exigiam a sessão.
- **Teste** `scripts/admin-session.test.mjs`:
  - aceita o cookie certo e recusa a falta de cookie, cookie errado, truncado ou de outro nome, e a ausência de `ADMIN_SESSION_SECRET`;
  - **varre `src/app/api/admin/**`** e falha se algum handler (exceto o login) não começar com a checagem;
  - confirmei que o teste **falha** com a versão anterior de `fulfillment` e passa com a correção.
- ⚠️ **Achado fora de `/api/admin`, não corrigido (precisa de decisão):** `/api/shipping/melhorenvio/authorize` e `/callback` usam um `state` **fixo** (`"bioflorais-shipping"`) e não exigem sessão. Qualquer pessoa pode iniciar o OAuth com a própria conta do Melhor Envio, e o callback **sobrescreve** as credenciais da loja em `integration_credentials`. A correção sugerida é exigir a sessão do admin nas duas rotas e usar um `state` aleatório guardado em cookie. Não mexi porque mudar o OAuth sem testar pode derrubar a autorização do frete em produção.

### B.2 Vencimentos do boleto B2B: `d2f5fc9`

- Mesma regra e formato da My Pet (`mypeteme-b2b-final…`, commit `d4155e9`): a 1ª parcela vence em **28 dias**, a 2ª em **42** e a 3ª em **56**, contados da **data do pedido** (`orders.created_at`) no calendário de **America/Sao_Paulo**.
- O cronograma é gravado em `b2b_boleto_requests.schedule` como `[{ installment, dueDate: "AAAA-MM-DD", amountCents }]`. Também vai no `rawPayload` do registro em `payments` e volta na resposta da rota.
- A soma das parcelas é **exatamente** o total, com a última absorvendo o arredondamento (mesma divisão já usada nas colunas de parcela).
- **Checkout:**
  - ao escolher as parcelas, mostra a prévia de data e valor de cada uma (base: hoje);
  - depois da solicitação, mostra o cronograma definitivo gravado pelo servidor;
  - o texto da tela explica a regra 28/42/56.
- **Testes:**
  - pedido em 01/10 vence em 29/10, 12/11 e 26/11;
  - pedido às 22:30 de 30/09 em São Paulo (01/10 UTC) conta a partir de 30/09;
  - a virada de ano funciona;
  - parcelas fora de 1 a 3 são recusadas.
- `orders.created_at` é `timestamp` sem fuso e é lido como UTC (padrão do Neon). O preflight `04a` mostra o fuso da sessão do banco para conferir.
- **SQL:** `04a_boleto_schedule_preflight_one_shot.sql` (uma consulta, só leitura) e `04b_boleto_schedule_candidate_if_not_exists.sql` (`ADD COLUMN IF NOT EXISTS schedule jsonb`).
- Solicitações de boleto anteriores ficam sem cronograma; o admin mostra "(sem cronograma gravado)".

### B.3 Abas 2, 3 e 4: `7324298`

**Aba 2: Linhas comerciais**
- Lista com ordem, nome, slug, situação, nº de produtos e nº de ofertas.
- Criar e editar nome, slug (gerado pelo nome se vazio, único), ativa, visível no B2B, ordem e **produtos**, num seletor com filtro **por categoria**, **busca** e "marcar/desmarcar filtrados".
- Não há exclusão: para tirar uma linha de circulação, basta desativá-la ou ocultá-la.

**Aba 3: Promoções**
- Cria e edita só **"compre X, leve Y grátis"**, o **único tipo com efeito real no servidor da Bio** (`promotion-resolver.ts`).
- Campos: vínculo com linhas e/ou produtos (sem vínculo, vale para todos os produtos da oferta), ativa, **selecionável pelo vendedor**, início e fim (datas no calendário de São Paulo, com o fim incluindo o dia todo).
- Promoções de outros tipos já existentes no banco aparecem só para consulta, como "sem efeito na Bio".
- ⚠️ **Percentual e preço fixo não foram criados**, porque não têm efeito no motor de preço da Bio (regra: não criar tipo sem efeito). Implementar exige decidir como interagem com o arredondamento ,90 e com os descontos Pix/cartão.

**Aba 4: Acompanhamento**
- **Ofertas geradas:** vendedor, cliente, linhas, promoções, data e status do link (ativo, revogado, sem link, oferta revogada).
- **Pedidos B2B:** data, pedido (com link para o detalhe no admin), cliente e PF/PJ, vendedor, forma de pagamento, total e status.
- **Solicitações de boleto:** parcelas com **vencimento e valor** de cada uma.
- **Linhas abertas fora da oferta:** cliente, linha, vendedor, quantas vezes e última vez.

**Registro "cliente visualizou a linha X fora da oferta"** (a Bio não registrava; foi criado):
- A página da oferta ganhou a seção **"Outras linhas Bio Florais"**, com as linhas B2B ativas e visíveis que não estão na oferta.
- Ao abrir uma delas, `/b2b/oferta/<token>/linha/<slug>` mostra os produtos **sem preço** e o botão **"Pedir esta linha ao representante"** (WhatsApp para o celular do vendedor, com o texto pronto).
- Ao montar a página, é gravado o evento em `b2b_offer_line_views` (oferta, linha, cliente, vendedor, data). É um POST depois de montar, então prefetch não conta como visita, e há no máximo 1 registro a cada 30 min por oferta e linha.
- **Painel do vendedor:** novo bloco **"Interesses dos clientes"** ("Cliente X visualizou a linha Y (fora da oferta)"), com o botão **"Montar nova oferta"**, que preenche cliente e linha no formulário.

**SQL:** `05a_admin_tabs_preflight_one_shot.sql` (uma consulta, só leitura: slugs duplicados, promoções por tipo e escopo, colunas obrigatórias sem default) e `05b_admin_tabs_candidate_if_not_exists.sql` (`CREATE TABLE IF NOT EXISTS b2b_offer_line_views` + índices).

### B.4 Roteiro de teste da segunda publicação

1. **Segurança:** sem estar logado, `PATCH /api/admin/orders/<id>/fulfillment` e `/shipment` dão 401. Logado no admin, mudar a etapa e o envio de um pedido continua funcionando.
2. **Boleto (PJ):** pedido de R$ 1.500+ em 3x mostra a prévia com 3 datas (hoje + 28/42/56). Depois de confirmar, a tela final mostra o cronograma. Em `b2b_boleto_requests.schedule`, as 3 parcelas somam o total.
3. **Linhas:** criar a linha "Teste B2B" com produtos filtrados por categoria. Ela aparece no painel do vendedor ao montar oferta. Desativá-la faz sumir.
4. **Promoções:** criar "Leve 4 pague 3" (a cada 3, +1) vinculada a uma linha e marcada como selecionável. O vendedor a vê ao montar a oferta, e no checkout, ao comprar 3 unidades, aparece "+1 grátis".
5. **Fora da oferta:** abrir o link de uma oferta que tem só a linha A e clicar em "Outras linhas" → B. A página mostra os produtos sem preço e o botão do WhatsApp. No admin, a aba Acompanhamento lista "cliente / B". No painel do vendedor aparece "Interesses dos clientes", e "Montar nova oferta" já preenche cliente e linha B.
6. **Acompanhamento:** ofertas, pedidos B2B e boletos (com vencimentos) aparecem com os dados certos.

---

## ★ Rodada Admin B2B — entrega da aba 1 (branch `b2b/bio-admin-v1`)

- **Branch nova** `b2b/bio-admin-v1`, criada a partir de `origin/main` = `10c0f3a` (produção). Só local: sem push, deploy, acesso ao Neon ou seed.
- **Commit:** `0701df5 feat(b2b/bio): admin B2B aba 1 (vendedores/RCAs) + convite, cadastro e aprovacao; PF sem boleto; texto de frete especial`
- **Verificações:**
  - `tsc` exit 0.
  - `npm.cmd run build` exit 0 (43/43; gera `/admin/b2b`, `/b2b/convite/[token]`, `/api/admin/b2b/*` e `/api/b2b/invites/accept`).
  - `node --test scripts/b2b-pricing.test.mjs scripts/b2b-invites.test.mjs`: **12/12**.
  - `git diff --check` vazio.
  - eslint: 0 erros nos arquivos novos e alterados; os 3 avisos restantes são das páginas de pedidos, que já existiam.
- **Não testado ponta a ponta contra banco:** sem autorização de acesso ao Neon e sem Postgres local. O roteiro abaixo é para o Luis rodar depois de aplicar o SQL da seção A.3.

### A.1 O que entrou

**Aba 1: Vendedores / RCAs** (`/admin/b2b`, link "B2B" no menu do admin)
- **Lista:** nome, e-mail, tipo (RCA / Vendedor), status (convite pendente, convite expirado, aguardando aprovação, ativo, inativo), data do convite, último acesso, nº de clientes, nº de ofertas e nº de pedidos pagos (`orders.b2b_responsible_id` com status `paid`).
- **Gerar convite** (nome, e-mail, tipo, WhatsApp opcional):
  - Token opaco de 256 bits; o banco guarda só o SHA-256; validade de 7 dias.
  - O link completo `/b2b/convite/<token>` aparece **uma única vez**, com **Copiar** e **Enviar pelo WhatsApp** (`wa.me` com o texto pronto; DDI 55 é colocado automaticamente).
  - Um e-mail que já tem cadastro é recusado, com orientação para usar "Redefinir acesso".
- **Ações:**
  - Nos convites: revogar e gerar novo link (o anterior é revogado).
  - Nos vendedores: aprovar (`company_approved_at` + status `active`), desativar e reativar, redefinir acesso.
  - Quem é reativado sem nunca ter sido aprovado volta para "aguardando aprovação".
  - Redefinir acesso gera um link para definir nova senha, com a mesma mecânica do convite; o link de redefinição anterior é revogado.
- Todas as rotas `/api/admin/b2b/*` **exigem a sessão do admin** que já existe (cookie `mypeteme_admin_session`, comparação em tempo constante).

**Fluxo do vendedor (não existia na Bio)**
1. **Convite** `/b2b/convite/<token>`: o token é validado no servidor e mensagens distintas explicam link inexistente, expirado, substituído ou já usado.
2. **Cadastro:** dados PF (CPF+RG) ou PJ (CNPJ+IE), celular, endereço (CEP preenche o resto), chave Pix e banco para as comissões, **login e senha**, e **termo RCA** (obrigatório para o tipo RCA).
   - A senha é gravada em `scrypt$<salt b64url>$<hash b64url>`, o formato atual da Bio; um teste confirma que hashes do login antigo continuam válidos.
   - O login e o e-mail são únicos, sem diferenciar maiúsculas.
   - O convite é reservado com um UPDATE condicional antes de gravar, então dois envios simultâneos não criam dois cadastros.
3. **Aprovação:** o cadastro nasce com status `pending` e o login responde "cadastro em análise" até o admin aprovar.
4. **Login** `/b2b/login` grava `last_login_at`. Os motivos de bloqueio (em análise / desativado) só aparecem **depois** da senha correta.
5. **Painel** `/b2b/painel` (já existia): criar cliente, criar oferta, gerar o link. A oferta aberta pelo cliente é `/b2b/oferta/<token>`.
   - Ao desativar o vendedor, o acesso dele e os links de oferta dele param na hora, porque a oferta exige responsável ativo.

**Regra nova: PF sem boleto.** No checkout B2B, pessoa física vê só Pix e cartão; se o boleto estava selecionado, volta para Pix. O servidor também recusa: `/api/b2b/orders/create` responde 400 e `/api/b2b/payments/boleto` responde 409 para PF.

**Texto do frete.** Nenhuma tela B2B dizia "frete grátis". O único texto assim é da página de produto **B2C** e não foi tocado. Incluí "Frete especial B2B a partir de R$ 450" na barra do catálogo da oferta e no carrinho B2B.

### A.2 Pontos de atenção

- ⚠️ **Termo RCA provisório:** o texto em `src/app/b2b/convite/[token]/InviteForm.tsx` (`RCA_TERMS`) é um **resumo que eu escrevi**. Precisa ser substituído pelo termo oficial revisado pelo jurídico antes de publicar.
- ~~Segurança: `/api/admin/orders/[id]/fulfillment` e `/shipment` sem sessão~~ → **corrigido em `c2cf328`** (seção B.1).
- **Tipos gravados:** `rca` (RCA) e `clt` (Vendedor), iguais aos da Secreta. O preflight A4 mostra se já existem outros valores no banco.

### A.3 Banco (obrigatório antes do deploy desta branch)

1. `sql/b2b/03a_admin_preflight_one_shot.sql`: um único SELECT, uma linha em json, somente leitura. Mostra colunas novas (ok/FALTANDO), colunas/índices/constraints, tipos e status já gravados, e duplicidade de login ou e-mail sem diferenciar maiúsculas (esperado: vazio).
2. `sql/b2b/03b_admin_candidate_if_not_exists.sql`: numa transação única e só aditivo, cria `b2b_responsibles.last_login_at`, `b2b_responsible_invites.purpose` (default `onboarding`) e `b2b_responsible_invites.responsible_id` (FK `NOT VALID`), mais CHECK e índice. Só mexe em tabelas `b2b_*`; nenhuma rota B2C lê essas tabelas.

### A.4 Roteiro de teste da aba 1 (Luis)

1. Entrar em `/admin/login` e clicar em **B2B** no menu.
2. Clicar em **Gerar convite** (tipo RCA, com WhatsApp): o link aparece com Copiar e WhatsApp, e a lista mostra "Convite pendente". Fechar o aviso e confirmar que o link não aparece de novo.
3. **Gerar novo link** na mesma linha, e abrir o link **antigo**: deve aparecer "substituído ou revogado".
4. Abrir o link novo numa aba anônima e fazer o **cadastro** (login `teste.rca`, senha com 8+ caracteres, aceitar o termo). Deve aparecer "Cadastro enviado". Abrir o mesmo link de novo mostra "já foi usado".
5. Em `/b2b/login` com `teste.rca`: aparece "cadastro em análise". Senha errada dá só "Login ou senha inválidos".
6. No admin, a linha vira **Aguardando aprovação**; clicar em **Aprovar** e ela passa a **Ativo**.
7. Em `/b2b/login`, entra no `/b2b/painel`. No admin, a coluna "Último acesso" fica preenchida.
8. No painel: **cadastrar cliente**, **criar oferta** com 1+ linhas e **gerar link**. No admin, as colunas Clientes e Ofertas passam a 1.
9. Abrir o link da oferta numa aba anônima (como cliente): catálogo com preços B2B e a faixa "Frete especial B2B a partir de R$ 450".
10. No checkout como **pessoa física**, o boleto não aparece. Trocar para **pessoa jurídica** e o boleto aparece.
11. No admin, clicar em **Desativar**: o login do vendedor passa a dizer "acesso desativado" e o link da oferta dele mostra "Link indisponível". Depois **Reativar**.
12. **Redefinir acesso**: abrir o link novo e trocar a senha. A senha antiga para de funcionar e a nova entra.

### A.5 Próxima entrega

Entregue na segunda publicação (seção ★★ acima).

---

## 0. Base

A base `origin/main` = `c15c0c8` foi confirmada como produção pelo Luis. Ainda em 30/09 a produção avançou para **`e043f6a`** ("Pix temporário pelo Mercado Pago enquanto a conta Lunium está bloqueada"), e a branch recebeu `git fetch` + `git merge origin/main` (merge `7f1384d`, **sem conflitos**). Tudo que veio da main foi preservado: `src/app/api/payments/mercadopago/pix/route.ts` e `src/app/checkout/page.tsx` estão **idênticos** a `origin/main` (`git diff origin/main -- <arquivos>` vazio). O commit local `e9954b3`, que só existe na `main` local de `C:\Users\User\BioFlorais`, continua de fora de propósito.

## 1. Commits

```
c09315b feat(b2b/bio): Pix B2B pelo Mercado Pago (NEXT_PUBLIC_PIX_PROVIDER) + cron de conciliacao MP Pix
7f1384d Merge remote-tracking branch 'origin/main' into b2b/bio-limpa-v1   (traz e043f6a)
19a3ffa docs(b2b/bio): ENTREGA com hash e diff --stat da revisao mestre
e40e090 fix(b2b/bio): revisao mestre — arredondamento ,90, checagem de valor Lunium para todos os pedidos, preflight em consulta unica
d3e761c docs(b2b/bio): ENTREGA_BIO_B2B.md (verificacoes, SQLs, roteiro de teste)
e15b51e feat(b2b/bio): telas B2B (oferta, carrinho, checkout, login e painel)
097b29b feat(b2b/bio): regras comerciais, cotacao autoritativa e rotas B2B
d5ae52e feat(b2b/bio): schema B2B (so adicoes) + preflight somente leitura e SQL candidato
```

Um último commit `docs(...)` só atualiza este arquivo.

### Mudanças da revisão da janela mestre

1. **Base:** `c15c0c8` confirmada e mantida.
2. **Webhook e polling Lunium:** a checagem de valor agora vale para **todos** os pedidos, B2C e B2B, igual ao hotfix da Secreta e da My Pet. Só marca pago se `amount_cents == orders.total_cents`; valor ausente também bloqueia.
3. **Arredondamento:** o preço unitário calculado passa a ser a parte inteira em reais + R$ 0,90 (27,00 → 27,90; 27,50 → 27,90; 27,95 → 27,90). É uma função única, `roundB2BUnitPriceCents`, com teste. O floral continua fixo em R$ 19,90, e a regra não se aplica a totais nem aos descontos Pix/cartão.
4. **Preflight em consulta única:** novo `sql/b2b/01b_preflight_one_shot.sql`, um único SELECT que devolve uma linha com uma coluna json (`json_build_object`) com os blocos [1] a [12]. É somente leitura.
5. `tsc` e build rodados de novo: verdes (seção 2).

### Atualização da janela mestre: Pix pelo Mercado Pago (produção `e043f6a`)

1. **Pix B2B segue a mesma chave do B2C.** Enquanto `NEXT_PUBLIC_PIX_PROVIDER` não for `"lunium"`, o checkout B2B chama a nova rota **`/api/b2b/payments/mercadopago/pix`**. Ela exige o token da oferta, a trava `payment_method === "pix"` e o status `"pending"`, e lê o total do banco (`orders.total_cents`, que já tem o desconto Pix de 7%). A rota reaproveita um Pix Mercado Pago ainda válido do mesmo valor (até 25 dos 30 minutos), para não gerar QR duplicado. Com `NEXT_PUBLIC_PIX_PROVIDER=lunium`, volta para `/api/b2b/payments/lunium/pix`.
2. **Confirmação do Pix B2B: o que já cobria e o que precisou mudar.**
   - **Webhook** `/api/webhooks/mercadopago`: **já cobria.** Ele busca o pagamento por `externalId` sem filtrar o método e confirma pela Order API autenticada antes de chamar `finalizeMercadoPagoPaid`.
   - **Rota de status** `/api/orders/[orderId]/status`: **não cobria.** Só conciliava `method === "card"`, então o Pix Mercado Pago (B2C e B2B) ficava só com o webhook. Estendi para `card` **ou** `pix`, priorizando um pagamento já pago e depois o mais recente (o Pix pode ter sido gerado de novo). O polling do checkout B2B (a cada 5s) usa essa rota.
3. **Rede de segurança:** `/api/cron/reconcile-mp-pix` (GET, exige `Authorization: Bearer ${CRON_SECRET}`, comparação em tempo constante; sem `CRON_SECRET` configurado responde sempre 401). Ele busca os `payments` `mercadopago`/`pix` das últimas 48h com pedido `pending` (no máximo 100 por execução), consulta a Order no Mercado Pago, atualiza o status do payment e, se estiver pago, chama `finalizeMercadoPagoPaid` (o mesmo finalizador idempotente do webhook). Vale para B2C e B2B e nunca cria cobrança. O `vercel.json` agenda a rota a cada 10 minutos (`*/10 * * * *`).
   - ⚠️ **Plano Vercel:** crons com frequência maior que diária exigem plano Pro. No Hobby, o deploy com `*/10` é recusado.
   - ⚠️ **`CRON_SECRET`** é variável **nova**: precisa ser criada na Vercel antes do deploy, senão o cron responde 401 e não concilia nada.

## 2. Verificações (execução real nesta pasta)

| Verificação | Resultado |
|---|---|
| `npm.cmd ci` | exit 0 |
| `npx.cmd tsc --noEmit -p .` | **exit 0** (sem erros) |
| `npm.cmd run build` (Next 16.3.2) | **exit 0**: compilou, TypeScript ok, 42/42 páginas, todas as rotas `/b2b/*` e `/api/b2b/*` geradas |
| `git diff --check origin/main..HEAD` | **vazio** |
| `eslint` | 0 problemas nos arquivos B2B novos. `eslint src` inteiro: 12 erros, todos em código B2C que já existia; nenhum foi introduzido por esta branch (o `any` em `orders/[orderId]/status/route.ts` é de uma linha original) |
| Encoding | todos os arquivos novos ou alterados são UTF-8 válido; busca por mojibake (`Ã§`, `Ã£`, `â€`, `Â·`...) nos arquivos B2B: nenhum |
| `schema.ts` | **só adições** (+351 / −0). BOM e CRLF originais preservados byte a byte |
| Regras puras (`pricing.ts`) | `node --test scripts/b2b-pricing.test.mjs`: **5/5 passam** (arredondamento ,90, floral, 55%, descontos só sobre produtos, mínimo, parcelas, frete regional). Exige Node ≥ 23.6; não usa dependência nova |
| Revisão mestre | `tsc` exit 0 e `npm.cmd run build` exit 0 rodados de novo depois das mudanças (compilou, TypeScript ok, 42/42 páginas) |
| Merge `e043f6a` + Pix B2B Mercado Pago + cron | `tsc` exit 0; `npm.cmd run build` exit 0 (compilou, TypeScript ok, **43/43** páginas, com `/api/b2b/payments/mercadopago/pix`, `/api/cron/reconcile-mp-pix` e `/api/payments/mercadopago/pix` da main); `node --test` 5/5; `git diff --check` vazio; eslint limpo nos arquivos novos |

**Sobre o build:** o build sem variáveis de ambiente falha numa rota B2C que já existia antes desta branch (`/api/admin/orders/[id]/fulfillment`). O motivo é que `src/lib/db/client.ts` lança erro na importação quando `DATABASE_URL` não existe. O build verde acima rodou com `DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build_placeholder`. Esse endereço é fictício e local: o driver HTTP do Neon não conecta no build, e o Neon não foi acessado. Na Vercel a variável real já existe.

### `git diff --stat origin/main..HEAD` (origin/main = e043f6a, até c09315b)

```
 ENTREGA_BIO_B2B.md                                 | 201 ++++++
 scripts/b2b-pricing.test.mjs                       |  61 ++
 sql/b2b/01_preflight_readonly.sql                  | 176 ++++++
 sql/b2b/01b_preflight_one_shot.sql                 | 217 +++++++
 sql/b2b/02_candidate_if_not_exists.sql             | 123 ++++
 src/app/api/b2b/auth/login/route.ts                |  69 ++
 src/app/api/b2b/auth/logout/route.ts               |  11 +
 src/app/api/b2b/clients/route.ts                   |  84 +++
 src/app/api/b2b/commercial-groups/route.ts         |  29 +
 src/app/api/b2b/offers/link/route.ts               | 133 ++++
 src/app/api/b2b/offers/mine/route.ts               |  70 +++
 src/app/api/b2b/offers/route.ts                    | 141 +++++
 src/app/api/b2b/orders/create/route.ts             | 301 +++++++++
 src/app/api/b2b/payments/boleto/route.ts           | 191 ++++++
 src/app/api/b2b/payments/lunium/pix/route.ts       | 260 ++++++++
 src/app/api/b2b/payments/mercadopago/card/route.ts | 193 ++++++
 src/app/api/b2b/payments/mercadopago/pix/route.ts  | 275 ++++++++
 src/app/api/b2b/promotions/route.ts                |  41 ++
 src/app/api/b2b/shipping/quote/route.ts            |  74 +++
 src/app/api/coupons/validate/route.ts              |   5 +-
 src/app/api/cron/reconcile-mp-pix/route.ts         | 131 ++++
 src/app/api/orders/[orderId]/status/route.ts       |  47 +-
 src/app/api/orders/create/route.ts                 |   6 +-
 src/app/api/webhooks/lunium/route.ts               |  33 +
 src/app/b2b/carrinho/B2BCartContent.tsx            | 106 ++++
 src/app/b2b/carrinho/page.tsx                      |  11 +
 src/app/b2b/checkout/B2BCheckoutContent.tsx        | 691 +++++++++++++++++++++
 src/app/b2b/checkout/page.tsx                      |  11 +
 src/app/b2b/layout.tsx                             |  13 +
 src/app/b2b/login/page.tsx                         |  71 +++
 src/app/b2b/oferta/[token]/page.tsx                |  94 +++
 src/app/b2b/painel/page.tsx                        | 257 ++++++++
 src/components/b2b/B2BOfferCatalog.tsx             | 166 +++++
 .../payments/B2BMercadoPagoCardPayment.tsx         | 151 +++++
 src/lib/b2b/cart-context.tsx                       | 173 ++++++
 src/lib/b2b/coupon-resolver.ts                     | 127 ++++
 src/lib/b2b/format.ts                              |   6 +
 src/lib/b2b/password.ts                            |  39 ++
 src/lib/b2b/pricing.ts                             | 294 +++++++++
 src/lib/b2b/promotion-engine.ts                    |  23 +
 src/lib/b2b/promotion-resolver.ts                  | 183 ++++++
 src/lib/b2b/public-offer-context.ts                | 249 ++++++++
 src/lib/b2b/quote.ts                               | 272 ++++++++
 src/lib/b2b/require-responsible.ts                 |  41 ++
 src/lib/b2b/responsible-session.ts                 |  92 +++
 src/lib/b2b/token.ts                               |  14 +
 src/lib/db/schema.ts                               | 351 +++++++++++
 src/lib/shipping/cep-lookup.ts                     |  41 ++
 vercel.json                                        |   8 +
 49 files changed, 6342 insertions(+), 14 deletions(-)
```

## 3. Arquivos B2C tocados (diff mínimo)

| Arquivo | Mudança | Efeito no B2C |
|---|---|---|
| `api/coupons/validate` | filtro `scope = 'b2c'` | cupom B2B deixa de valer no B2C (todo cupom existente fica `b2c` pelo DEFAULT) |
| `api/orders/create` | mesmo filtro no cupom comercial | idem |
| `api/webhooks/lunium` | **qualquer** pedido (B2C e B2B) só vira `paid` se `amount_cents == orders.total_cents`; valor ausente também bloqueia | **muda o B2C de propósito** (revisão mestre, igual ao hotfix da Secreta e da My Pet): um Pix B2C com valor divergente deixa de ser baixado automaticamente e fica no log "valor divergente" |
| `api/orders/[orderId]/status` | mesma regra no polling Lunium, para todos os pedidos; a conciliação Mercado Pago passa a cobrir **Pix** além de cartão | idem; o Pix Mercado Pago do B2C também passa a ser confirmado pelo polling, não só pelo webhook |
| `api/cron/reconcile-mp-pix` (novo) + `vercel.json` (novo) | concilia Pix Mercado Pago pendente das últimas 48h a cada 10 min | rede de segurança para o Pix B2C e B2B |
| `api/payments/mercadopago/pix` e `checkout/page.tsx` | **não tocados** (vieram da main em `e043f6a`) | — |

## 4. Inventário do B2B antigo em `C:\Users\User\BioFlorais` (só leitura)

`git status --short` tem 480 entradas. As que são B2B:

- `src/app/api/b2b/auth/login/route.ts`: **aproveitado como padrão**. Mantive a query por `lower(login)`, a exigência de `status = 'active'` e o formato de senha `scrypt$<salt b64url>$<hash b64url>`. Esse formato é obrigatório para não invalidar senhas já gravadas; a Secreta usa hex, que é incompatível.
- `src/lib/b2b/responsible-session.ts`: **aproveitado**. Mesmo cookie `bioflorais_b2b_session` e mesmo HMAC com `ADMIN_SESSION_SECRET`, então não precisa de variável de ambiente nova.
- `src/app/api/b2b/offers/link/route.ts`: **aproveitado como padrão**. Gerar um link novo revoga o anterior e o banco guarda só o hash.
- `src/lib/b2b/public-offer-context.ts`: padrão aproveitado. Foi reescrito no formato da Secreta, que valida link, oferta, cliente, responsável e vínculo, e ganhou a função `verifyB2BOrderOfferToken`.
- `src/lib/b2b/price-resolver.ts`: **reaproveitada só a lista de categorias florais**. O arquivo tinha mojibake (`Floral dose Ãºnica`), e a regra antiga de 55% arredondava para inteiro terminando em ",90". Substituí pela regra fechada (ver seção 6).
- `src/lib/b2b/promotion-engine.ts` / `promotion-resolver.ts`: **descartados**. Dependem de `b2b_promotion_opening_consumptions`, que não existe no Neon da Bio segundo a introspecção anterior, e de colunas de snapshot em `order_items`. No lugar entrou o motor "compre X, leve Y" da Secreta.
- `src/app/b2b/oferta/**` e `src/components/b2b/B2BProductPurchaseActions.tsx`: **descartados**. Tinham mojibake (`Â·`, `Ãrea`, `â†’`) e usavam o carrinho e o checkout **B2C** (`/checkout?b2b=`). Foram refeitos com carrinho e checkout B2B próprios.
- `src/lib/db/schema.ts` (sujo): **não copiado**. Tinha regressões: tirava o BOM, reescrevia comentários, trocava CRLF e declarava tabelas que não existem. Dele aproveitei só a **estrutura introspectada** das 14 tabelas `b2b_*` e das colunas `orders.b2b_*`, redeclarada como adição.
- Arquivos `*.before-*` e `drizzle*/`: ignorados, de propósito.

Referência de implementação: Secreta B2B em `C:\Users\User\secreta-b2b-validacao` (branch `b2b/secreta-v2`, commits até `39b5abf`, mais as mudanças ainda não commitadas daquela janela, que adicionam `totalsByPaymentMethod`).

## 5. Banco

- **Nada de journal Drizzle, `drizzle-kit migrate` ou `push`.** Os SQLs ficam em `sql/b2b/`.
- `sql/b2b/01b_preflight_one_shot.sql` (**preferido**): um único SELECT que devolve **uma linha com uma coluna json** (`preflight`) com os blocos `b1_*` a `b12_*`. Não escreve nada. O bloco [12] usa `to_jsonb(o)->>'b2b_offer_id'` e por isso não falha se a coluna ainda não existir.
- `sql/b2b/01_preflight_readonly.sql`: os mesmos blocos em SELECTs separados, `BEGIN TRANSACTION READ ONLY ... ROLLBACK`. Traz tabelas, colunas (tipo, nulabilidade, default), índices, constraints das tabelas `b2b_*` e de `orders`/`coupons`/`payments`, além de checagens de dados: formato de hash, ofertas sem `activated_at`, produtos sem dimensão, categorias ativas e boletos duplicados.
- `sql/b2b/02_candidate_if_not_exists.sql`: só `ADD COLUMN IF NOT EXISTS`, `CREATE ... IF NOT EXISTS` e `CHECK ... NOT VALID` condicionado a `pg_constraint`. Não tem DROP, ALTER TYPE nem UPDATE. O conteúdo:
  - `orders`: `b2b_client_id`, `b2b_offer_id`, `b2b_responsible_id/type/name`, `payment_method`, `payment_method_discount_cents` (sem FK, igual ao banco real) e um índice parcial em `b2b_offer_id`.
  - `coupons`: `scope` (default `b2c`) e `discounts_shipping` (default `false`), mais CHECKs para `scope ∈ {b2c,b2b}` e para "desconta frete ⇒ cupom percentual".
  - `b2b_boleto_requests` (se não existir), com índice único em `order_id`.
  - Índice único parcial `payments(order_id) WHERE method = 'boleto'`.
  - As 14 tabelas `b2b_*` que já existem **não** são recriadas. Se o preflight [2] listar alguma como faltando, é preciso parar e revisar antes.

> ⚠️ **Bloqueio de deploy:** o `schema.ts` passa a declarar `orders.payment_method`, `orders.payment_method_discount_cents`, `coupons.scope` e `coupons.discounts_shipping`. Várias rotas **B2C** fazem `db.select().from(orders)` ou `.from(coupons)` e selecionam todas as colunas declaradas. Por isso, se alguma dessas colunas não existir no Neon, o B2C quebra. **Só publicar depois que o preflight [3] mostrar tudo `ok`**, seja porque as colunas já existem (as "10/10 colunas comerciais" da coleta de 25/09 podem ser justamente essas), seja porque o candidato foi aplicado.

## 6. Regras comerciais: como ficaram

| Regra | Implementação |
|---|---|
| Floral R$ 19,90 | `products.category` ∈ {Floral em gotas, Floral dose única, Floral de Ambiente, Snack Floral, Virtudes Divinas}, comparação sem acento e sem diferenciar maiúsculas |
| Demais 55% do B2C | `roundB2BUnitPriceCents(price_cents × 11 / 20)` = parte inteira em reais + R$ 0,90 (regra de todos os sites). Ex.: 59,90 → 32,945 → **32,90**; 50,00 → 27,50 → **27,90**. Só no preço unitário; nunca em totais nem nos descontos Pix/cartão |
| Mínimo R$ 250 | sobre os produtos, antes do cupom; checado na cotação e na criação do pedido |
| Cartão/boleto até 3x, parcela mínima R$ 500 | `resolveB2BAllowedInstallments`, conferido na criação, na rota de cartão e na rota de boleto |
| Pix: provedor | mesma chave do B2C, `NEXT_PUBLIC_PIX_PROVIDER`: diferente de `"lunium"` usa `/api/b2b/payments/mercadopago/pix`; igual a `"lunium"` usa `/api/b2b/payments/lunium/pix`. As duas rotas têm as mesmas travas (token, `payment_method = pix`, `pending`, total do banco) |
| Pix 7% / cartão 3% / boleto cheio, **só sobre produtos** | `resolveB2BOrderTotalCents` = produtos pós-cupom − desconto + frete. O checkout mostra só o valor final de cada método, nunca o %. **Diferença:** a Secreta aplica o % sobre produtos **+ frete**. Alinhar lá se a regra fechada vale para os 3 |
| Frete ≥ R$ 450 (base pós-cupom) | a modalidade mais barata passa a custar `Math.min(tarifa regional, real)` (S/SE R$ 9,90; CO/NE exceto CE R$ 35,90; Norte + CE R$ 169,90); as demais ficam com preço cheio e nenhuma é ocultada; UF conferida pelo CEP (ViaCEP) no servidor; sem conferência, não há tarifa regional |
| Cupom B2B × B2C | `scope`; cupom de parceira nunca vale no B2B |
| Cupom de teste que desconta frete | `discounts_shipping`, **só percentual**: o mesmo % incide sobre o frete cobrado; o custo real (`shipping_cost_cents`) é preservado |
| Servidor recalcula tudo | `src/lib/b2b/quote.ts` é a **única** função usada pela cotação do checkout e pela criação do pedido |
| Token da oferta nos pagamentos | `verifyB2BOrderOfferToken`: a oferta do token precisa ser igual a `orders.b2b_offer_id` |
| Trava por método | `orders.payment_method`; cada rota de pagamento exige igualdade |
| Boleto | idempotente pelo banco (upsert com `xmax = 0`), composição exata `(n−1)·parcela + última = total`, registro em `payments` (`provider = boleto-manual`). **Não emite boleto real** |
| Webhook/polling Lunium | **todo** pedido (B2C e B2B) só vira pago com `amount_cents == total_cents` (valor ausente também bloqueia) |

Outras decisões:
- **Representante ativo** = `b2b_responsibles.status = 'active'` (convenção do login antigo da Bio; a Secreta usa `company_approved_at`).
- **RG** não é pedido: `customers` da Bio não tem essa coluna.
- **Cartão:** a chave de idempotência é por pedido + hash do card token, então um reenvio do mesmo token não cobra duas vezes e uma nova tentativa com outro cartão é permitida. A rota bloqueia uma segunda cobrança se já houver pagamento `paid`, `authorized` ou `pending`.
- **Cupom** é registrado na criação do pedido, no mesmo momento do B2C. O finalizador do Mercado Pago vê o registro e não duplica.

## 7. Fora do escopo / pendências conhecidas

1. Convite e onboarding de representante e aprovação pelo admin não foram portados. Usam-se os responsáveis que já existem no banco (login + senha).
2. A emissão do boleto é manual (só a solicitação é registrada).
3. As colunas de snapshot de promoção e comissão em `order_items` não são preenchidas; comissão B2B está fora do escopo.
4. O layout raiz ainda mostra os elementos do B2C (rodapé, botão do carrinho B2C quando ele tem itens) nas páginas `/b2b`.
5. Sem push nem PR: aguardando autorização do Luis.

## 8. Variáveis de ambiente

`DATABASE_URL`, `ADMIN_SESSION_SECRET`, `LUNIUM_API_KEY`, `LUNIUM_SETTLEMENT_ADDRESS`, `LUNIUM_WEBHOOK_SECRET`, `MERCADOPAGO_ACCESS_TOKEN`, `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY`, `NEXT_PUBLIC_PIX_PROVIDER` (já usada pela main), `MELHORENVIO_CEP_ORIGEM` e as credenciais do Melhor Envio (`integration_credentials`).

**Variável nova:** `CRON_SECRET`, exigida por `/api/cron/reconcile-mp-pix`.

## 9. Roteiro de teste manual (depois do preflight e, se preciso, do candidato)

**Preparação (Luis, no Neon, depois de revisar):** ter 1 responsável `active` com login e senha, ao menos 1 `b2b_commercial_groups` visível com produtos ativos que tenham peso e dimensões, e opcionalmente 1 cupom `scope = 'b2b'` e 1 cupom de teste `scope = 'b2b'`, `discount_type = 'percentage'`, `discounts_shipping = true`.

1. **Login:** `/b2b/login` → senha errada dá 401; senha certa leva a `/b2b/painel`.
2. **Painel:** cadastrar um cliente, criar uma oferta com 1+ linhas e clicar em "Gerar link". Gerar de novo e confirmar que **o link anterior para de funcionar** ("Link indisponível").
3. **Oferta** (aba anônima): floral a R$ 19,90; outros produtos a 55% do preço B2C, **sempre terminando em ,90** (ex.: B2C R$ 59,90 → R$ 32,90).
4. **Mínimo:** com menos de R$ 250 em produtos, o carrinho mostra "Faltam R$ X" e não libera o checkout.
5. **Frete < R$ 450:** CEP de SP e todas as modalidades com preço real.
6. **Frete ≥ R$ 450:**
   - SP/PR: a mais barata cai para R$ 9,90 (ou para o real, se ele for menor) e as outras ficam cheias.
   - BA/GO: R$ 35,90.
   - CE/AM: R$ 169,90.
7. **CEP × UF:** CEP de SP com UF "RS" → erro "estado não corresponde ao CEP".
8. **Cupom com frete:** um cupom que derruba a base para menos de R$ 450 volta o frete ao preço real. O cupom B2B no checkout **B2C** dá "não encontrado", e um cupom B2C no B2B dá "não é válido para pedidos B2B".
9. **Valores por método:** a lista mostra Pix < cartão < boleto, sem nenhum "%", e a diferença incide só nos produtos (o frete é igual nos três).
10. **Pix** (ambiente de teste/sandbox): gerar o QR e confirmar em `orders` que `payment_method = 'pix'` e que `total_cents` é o valor mostrado. Webhook com `amount_cents` diferente → pedido **continua** `pending` (log "valor divergente"). Repetir o teste com um pedido **B2C**: o comportamento tem que ser o mesmo. *(Vale quando `NEXT_PUBLIC_PIX_PROVIDER=lunium`.)*
10b. **Pix Mercado Pago** (padrão enquanto a Lunium estiver bloqueada): o checkout B2B mostra o QR do Mercado Pago com o valor Pix (7% de desconto nos produtos). Em `payments` aparece a linha `provider = mercadopago`, `method = pix`, com `externalId` = id da Order. Recarregar ou tentar de novo em até 25 min **reaproveita** o mesmo QR. Ao pagar, a tela confirma sozinha (polling) e o pedido vira `paid` / `paid_to_prepare`. Chamar a rota com o `orderId` de um pedido boleto dá 409; sem token dá 401.
10c. **Cron:** `GET /api/cron/reconcile-mp-pix` sem header ou com secret errado dá 401. Com `Authorization: Bearer <CRON_SECRET>` devolve `{ ok, candidates, checked, ordersPaid }`. Um Pix pago cujo webhook não chegou é baixado na próxima execução.
11. **Trava:** com o `orderId` de um pedido Pix, chamar `POST /api/b2b/payments/boleto` → 409. Sem `b2bToken` → 401. Com o token de outra oferta → 403.
12. **Cartão** (credenciais de teste do Mercado Pago): em pedidos abaixo de R$ 1.000 só aparece 1x; em pedidos de R$ 1.500 ou mais aparecem até 3x. Parcelas acima do permitido via API dão 400.
13. **Boleto:** escolher 2x num total ímpar, conferir `b2b_boleto_requests` (parcela + última = total) e 1 linha em `payments` (`method = 'boleto'`). Repetir a chamada dá `repeated: true`, sem nenhuma linha nova.
14. **Revogação:** revogar o link no painel e confirmar que oferta, cotação e pagamentos com aquele token dão 403.
15. **Regressão B2C:** fazer um pedido B2C com cupom normal e Pix/cartão para confirmar que continua igual.

## Rodada 20 — etapa 2: 8 páginas de campanha `/para/*` (sem push)
- Modelo único `src/app/para/[slug]/page.tsx`; dados em `src/lib/campaign/gpt-pages.ts` (título, frase, foto do topo como campo `hero`, produtos, FAQ). 8 slugs estáticos; outro `/para/x` dá 404. noindex/nofollow, fora do sitemap e do menu; `robots.ts` não bloqueia (o revisor acessa). Mesmo conteúdo para todos (sem cloaking).
- Ordem: título → faixa "GPT10 aplicado: 10% na sua 1ª compra" → produtos (preço + Comprar: põe na sacola e abre o checkout) → confiança → 3 perguntas → "Ver a linha completa".
- GPT10 automático: passar por `/para/*` marca o navegador (`bio_campaign_coupon_v1`); o checkout aplica o GPT10 se não houver outro cupom comercial; o cliente remove no checkout e não reaplica. Aviso na sacola. 1 uso por e-mail (sem CPF).
- Fotos do Adulto recortadas por CSS (frasco), conferidas a 375 px, sem frases. Heróis: mesma imagem do anúncio onde existe (`public/para/`); pet-habitos, pausa e fim-do-dia usam banner da linha sem texto.
- Saíram pelas regras: Tristeza (fim-do-dia, "Depressão" no rótulo) e Rescue (rotina). Essas páginas e bebe-soninho ficam com 3 produtos.
- Pendências: títulos provisórios (`titleConfirmed:false`); o hero de rotina traz o quadro "Cada mudança abre espaço para algo melhor" (arte do anúncio); `B2_adulto_sensacao_ansiedade_sem_rotulo.jpg` sem uso.
- SQL novo: nenhum (usa 50a/50b da etapa 1).
- Verificação: tsc ok; `npm test` 401/401; build ok (8 páginas estáticas); `git diff --check` limpo; teste novo `scripts/campanha-gpt.test.mjs` (9 casos).

## Rodada 20 — ajustes da etapa 2 (sem push)
- Títulos reais nas 8 páginas (`titleConfirmed: true`); topo de `/para/pausa` = `B2_adulto_sensacao_ansiedade_sem_rotulo.jpg` (anúncio "Mil coisas"), copiado para `public/para/`.
- Tristeza e Rescue continuam fora (fim-do-dia, rotina e bebe-soninho com 3 produtos).
- 2º uso do GPT10 (ou de qualquer cupom de 1 uso por e-mail) com o mesmo e-mail: `/api/orders/create` devolve 400 com "Este cupom já foi usado neste e-mail." (antes 500 com texto técnico), mostrado no checkout.
- Verificação: tsc ok; `npm test` 402/402; build ok; `git diff --check` limpo; print de pet-medroso e do topo de pausa a 375 px conferidos.

## CEP urgente + páginas /para/* (carrossel de linhas, sacola) + faixa de benefícios nos checkouts (sem push)
**CEP (B2C):** o frete é calculado sempre que o campo CEP tem 8 dígitos, por digitação, colagem, autofill ou rascunho. `onChange` calcula na hora; um verificador a cada 400 ms pega o que não dispara evento (autofill silencioso, rascunho restaurado); `onBlur` só repete se tinha falhado. O frete não espera o ViaCEP (se ele cair, o frete sai igual) e a resposta de um CEP antigo é descartada. Os hooks ficam antes do retorno da sacola vazia (React #310).
**Cupom com a sacola que muda (achado no teste):** o checkout restaurava o desconto do rascunho sem recalcular (GPT10 de R$ 3,59 com 2 produtos, devia ser R$ 7,18). Agora, quando o total dos produtos muda, o servidor recalcula o cupom comercial e o de parceira; se não vale mais, sai com aviso.
**/para/*:** cabeçalho simples + ícone da sacola com a contagem (a sacola flutuante não aparece nessas páginas, para não duplicar) e, antes do rodapé, "Conheça todas as linhas": 11 minicards (foto + nome → `/linha/<slug>`), carrossel horizontal no celular e grade de 4 colunas a partir de md.
**GPT10 ao navegar e comprar outros produtos:** continua valendo. O estado fica no navegador (localStorage), sem prazo próprio, até 30/11/2026 23:59 (BRT) ou até o cliente remover o cupom; vale 10% sobre o total dos produtos da sacola (testado: 2 produtos, − R$ 7,18 de R$ 71,80). Se o cliente voltar por outra página `/para/*`, o cupom volta a ser aplicado. 1 uso por e-mail.
**Faixa de benefícios (genérica, sem cupom):** `src/lib/checkout/benefits.ts` (regra pura) + `src/components/checkout/CheckoutBenefitsBar.tsx` (sem dependência do site: a Secreta e a My Pet copiam os dois arquivos). B2C: "Frete grátis" a partir de R$ 100 (modalidade econômica) ou "Frete com desconto · subsídio de 25%" + "Faltam R$ X para o frete grátis"; sem Pix/cartão (o B2C da Bio não tem desconto por forma de pagamento). B2B: nunca "grátis": "Frete especial" a partir de R$ 450 ou "Faltam R$ X para o frete especial"; "Pix com desconto" e "Cartão com desconto" (7%/3% da configuração, sem mostrar o percentual, como a regra do B2B). No topo do resumo e perto do botão de pagar.
**Testes:** `scripts/checkout-faixa-cep.test.mjs` (6 casos) e ajuste em `campanha-gpt.test.mjs`. Teste real no navegador (harness) a 375 px, janela limpa: /para → "Comprar" → checkout, CEP "colado" (valor sem evento, autofill), digitado com teclas e restaurado do rascunho: frete calculado nos três casos (PAC/SEDEX, total R$ 66,06 com GPT10 e subsídio); B2B com R$ 278,60 mostra "Faltam R$ 171,40 para o frete especial" e com R$ 477,60 "Frete especial".

## Rodada 20c: ajustes das páginas /para/* (sem push)
- **Um bloco só de perguntas frequentes**, agora com 5 perguntas (Como usar?, Tem álcool?, É um medicamento?, Como é o frete?, Como posso pagar?); o frete usa as constantes de configuração do B2C (R$ 100 e subsídio de 25%).
- **"Compre com tranquilidade" saiu**; no lugar, os minicards de todas as linhas (carrossel no celular, grade no desktop). Ordem: título, faixa GPT10, produtos, linhas, perguntas, "Ver a linha completa".
- **Sempre 4 cards na grade.** Páginas com 3 produtos mostram o 4º como card da linha ("Conheça a linha"): bebe-soninho usa o card da linha Baby.
- **Produtos:** pet-sozinho trocou Adaptação por Latido Excessivo; fim-do-dia e rotina ganharam Falta de Tolerância como 4º produto (foto sem frase, recorte conferido a 375 px).
- **Fotos do topo:** não há arquivo novo no repositório nem em `anuncios-angelblanc` para pet-sozinho (Carência/Latido), pet-habitos (Lambedura) e fim-do-dia ("Seu ritual"). Montei a folha `PROMPTS_B2B\opcoes_fotos_para\opcoes_fotos_para.jpg` com as alternativas que já existem e um LEIA-ME com o que falta; trocar é só o campo `hero` em `gpt-pages.ts`.
- **Testes:** `campanha-gpt.test.mjs` atualizado (produtos, 5 perguntas, ordem, card da linha).

## Conferência: pedidos da loja geral /parceiros com vendedor da oferta (Secreta tinha "venda direta") (sem push)
**Resultado: na Bio NÃO acontece. Nenhuma correção de código nem de comissão é necessária.**
- **Por quê (código):** em `/api/b2b/orders/create`, a loja `/parceiros` passa por `attributeStorefrontOrder` ANTES de gravar o pedido. Ela resolve o vendedor (dono do CNPJ/CPF, ou o vendedor da vitrine), cria/usa a oferta padrão desse cliente com esse mesmo vendedor e troca o contexto inteiro (oferta, cliente, vendedor). O pedido grava `b2b_offer_id`, `b2b_responsible_id` e `b2b_responsible_name` desse contexto, e a comissão (`loadCommissionMatrix`) usa o mesmo vendedor. Só esse caminho cria pedido com `b2b_offer_id`.
- **Como o site rotula:** admin do pedido = `b2b_responsible_name` (sem nome: "Bio Florais"); Central/Omie = nome do vendedor do pedido e "nome no Omie" (`omie_vendor_code` ou o nome do cadastro); comissões = pedidos com `b2b_offer_id` e vendedor = `b2b_responsible_id`. Não existe o rótulo "venda direta" no código da Bio.
- **Teste real (harness local, fluxo de verdade):** pedido pela vitrine `/parceiros` (origem "parceiros", código ANA01) e pedido pelo link do cliente: os dois saem com "Vendedora Ana" no pedido, na Central e no Omie. Sem regra de comissão configurada, os dois ficam "sem comissão" (é configuração, igual nos dois caminhos); com as regras base e preço normal configuradas, o pedido da vitrine sai com percentual por item.
- **SQL só leitura para o Neon:** `sql/b2b/51a_conferencia_vendedor_pedidos_oferta_one_shot.sql` (uma linha JSON). Lista, por origem, quantos pedidos de oferta estão "ok", "sem_vendedor" ou "vendedor_diferente", mostra o vendedor esperado (responsável da oferta), os rótulos do admin e da Central/Omie e se tem comissão. Se aparecer `sem_vendedor` ou `vendedor_diferente` em produção (pedido antigo, de antes da atribuição da loja pública), mande o resultado: a correção seria um UPDATE aditivo (pedido recebe o responsável da oferta) e o recálculo da comissão, para a mestre aprovar.
- **Testes:** `scripts/vendedor-pedidos-oferta.test.mjs` (SQL com 7 pedidos sintéticos, inclusive "/parceiros sem vendedor" e "vendedor diferente"; e a ordem da atribuição no código).

## Fotos do topo das /para/*, 4º card, Pix com desconto no B2C e faixa do topo dos checkouts (sem push)
**Achado importante (corrigido):** no commit anterior do CEP (`d0fdffb`) três limpezas do CEP estavam como `/D/g` em vez de `/\D/g`, então um CEP com hífen ("01310-100", colado ou do rascunho) não era reconhecido e o frete não calculava (só funcionava sem hífen). Corrigido nos três pontos (verificador, `onChange`, `onBlur`) e coberto por teste; confirmado no navegador com "01310-100" colado.
**1) Fotos do topo (só o recorte da foto, sem NENHUM texto da arte):** `public/para/hero-*.jpg`, recortadas por `sharp` das artes de produto do site (`public/cardprodutos`): pet-sozinho = Carência e Síndrome de Abandono (cão e gato na janela); pet-habitos = Lambedura e Automutilação; pausa = Sensação de Ansiedade (a mulher à esquerda); fim-do-dia = Sono (mulher dormindo); rotina = "Equilíbrio para viver melhor cada dia" (frasco com flores; no rótulo do frasco só o texto do próprio produto). Campo novo `aspect` no `hero` (4/3, rotina 1/1; no desktop a altura é limitada a 460 px).
**2) 4º card:** Falta de Tolerância saiu; em fim-do-dia e rotina o 4º espaço é o card "Conheça a linha Adulto". /para/pausa confere com a tabela do Luis (Sensação de Ansiedade, Stress, Reequilíbrio dos Chakras, Medo). Sacola no cabeçalho das /para/* só aparece quando há item.
**3) Pix com desconto no B2C (4%):** `B2C_PIX_DISCOUNT_PERCENT` e `pixDiscountCents` em `src/lib/checkout/benefits.ts` (arredonda ao centavo). Base = produtos depois de ofertas, promoções, cupons e crédito; o frete nunca entra. O servidor (`/api/orders/create`) calcula, grava `orders.payment_method` (pix/card), `payment_method_discount_cents` (e dentro de `discount_cents` e do JSON de ajustes) e já desconta do `total_cents`. O percentual nunca aparece: "R$ X a menos no Pix" na escolha do pagamento, "Desconto no Pix − R$ X" no resumo e o total já com o desconto. Cartão sem desconto no B2C.
- **Mercado Pago:** a rota do Pix manda `order.totalCents` (valor gravado). Conferido no harness com um stub: total R$ 64,77 = produtos R$ 35,90 − GPT10 R$ 3,59 − Pix R$ 1,29 + frete R$ 33,75; o `transaction_amount` enviado foi 64,77.
- **Cartão não paga pedido com desconto do Pix:** `/api/payments/mercadopago/card` recusa (409) se `payment_method_discount_cents > 0`.
- **Central/Omie:** o contrato ganhou `discountLines` (opcional): `{code: "DESCONTO_PIX" | "DESCONTO_CARTAO", label, cents}`, preenchido para B2C e B2B a partir de `payment_method_discount_cents`. Conferido: pedido pago saiu em `/api/central/orders` com `DESCONTO_PIX 129`. A Central precisa ler esse campo para lançar a linha no Omie. Admin: linha "Desconto no Pix" no resumo financeiro do pedido.
- **Não alterado:** o evento de parceiros (`partnerEventOutbox`, `commercial.totalCents`) segue sem o desconto do Pix; só a comissão de parceira continua sobre a mercadoria depois dos cupons.
**4) Faixa do topo dos checkouts** (`CheckoutTopStrip`, reaproveitável, com `buildCheckoutTopStrip`): B2C = "Frete grátis a partir de R$ 100 (abaixo disso, frete subsidiado) · Desconto no Pix" (sem cartão); B2B = "Frete especial a partir de R$ 450 · Desconto no Pix · Desconto no cartão" (sem "grátis").
**Teste real (harness, janela limpa, 375 px):** produto na /para → "Comprar" → checkout → CEP "01310-100" colado → frete calculado, Pix mostra "R$ 1,29 a menos no Pix", resumo com a linha do Pix, total R$ 64,77; trocar para cartão tira a linha e o total sobe; pedido criado gravou os valores acima.

## Fotos do topo: troca de /para/rotina e /para/pausa (sem push)
- **Aprovadas:** pet-sozinho, pet-habitos, fim-do-dia (pet-sozinho ganhou um recorte um pouco mais fechado, `hero-pet-sozinho-v2.jpg`, para tirar uma lasca do rótulo do frasco na borda esquerda).
- **Trocadas (provisório, até a Janela 3 entregar as fotos definitivas):** pausa e rotina usam o recorte da mulher calma desfocada, à direita da arte "Equilíbrio para viver melhor cada dia" (`hero-pausa-v2.jpg`, `hero-rotina-v2.jpg`, 4/3). Sem texto e sem frasco com nome de condição. Os arquivos ganharam sufixo `-v2` para furar o cache de imagens (o navegador e a CDN guardam o nome antigo).
- **Prints dos 5 topos** (375 px com emulação de celular, e 1280 px de desktop), como arquivos em `C:\Users\User\PROMPTS_B2B\prints_para\` (`<pagina>_375px.png` e `<pagina>_desktop.png`).
- **Fotos definitivas de pausa e rotina (Janela 3, aprovadas pela mestre)** substituíram as provisórias: `hero-pausa-v3.jpg` (mulher no sofá com a xícara) e `hero-rotina-v3.jpg` (mulher na mesa de trabalho), vindas de `anuncios-angelblanc\imagens\para\*.png`. Otimizadas para JPG 1448 px de largura (limite 1600), 179 KB e 172 KB (limite 200 KB). Quadro inteiro 4/3, então rosto e frasco aparecem a 375 px. Alt: "Mulher fazendo uma pausa com uma xícara de chá" e "Mulher em uma pausa tranquila na mesa de trabalho". Os arquivos provisórios `-v2` foram removidos. Prints refeitos em `PROMPTS_B2B\prints_para\`.
