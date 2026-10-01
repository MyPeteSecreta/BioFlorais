/*
 * Só para `npm test` (node --test): resolve o alias "@/" do tsconfig
 * para src/ e imports sem extensão para .ts, como o Next faz no build.
 * Não é usado pela aplicação. (Mesmo padrão da My Pet.)
 */
import { register } from "node:module";

register("./ts-paths-hooks.mjs", import.meta.url);
