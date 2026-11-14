/**
 * Produtos sensíveis (UMA lista só): saem das campanhas pelos feeds (custom_label_0) e o pixel da Meta nunca os identifica
 * (src/lib/meta-privacy.ts). Comparado com o slug (sem acento): peso, alimentação, lambedura/automutilação, pânico, parar de fumar
 * e vícios. Arquivo pequeno de propósito: o navegador carrega só esta lista, não o gerador dos feeds (14/11).
 */
export const FEED_AD_EXCLUDED_SLUGS: readonly RegExp[] = [/reducao-de-peso/, /perda-de-peso/, /reequilibrio-alimentar/, /controle-alimentar/, /lambedura/, /automutilacao/, /panico/, /parar-de-fumar/, /vicios/];
