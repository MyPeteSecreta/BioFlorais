# Entrega — Bio Florais B2B (candidata limpa)

- **Pasta:** `C:\Users\User\bio-b2b-limpa` (worktree de `C:\Users\User\BioFlorais`)
- **Branches:** `b2b/bio-limpa-v1` (já em produção, `main` = `10c0f3a`) e **`b2b/bio-admin-v1`** (rodada Admin B2B, local, **sem push**)
- **Base:** `origin/main` = `e043f6a` (merge feito em 30/09; antes era `c15c0c8`)
- **Data:** 30/09/2026

Nada foi feito em `C:\Users\User\BioFlorais`: nenhum arquivo foi alterado ou descartado lá, a main não foi tocada e o Neon não foi acessado. Não houve seed, deploy, push nem pagamento real. As outras marcas também não foram alteradas.

---

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
