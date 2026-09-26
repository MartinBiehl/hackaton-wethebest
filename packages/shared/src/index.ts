// Código comum aos apps de vendas e portal. Consumido direto do código-fonte:
// o Vite de cada app compila estes arquivos, então não há etapa de build aqui.
export type { Database, Json } from './database'
export { ErroNegocio, erroDoSupabase } from './erros'
export { formatarCentavos, reaisParaCentavos } from './dinheiro'
export { competenciaAtual, hojeEmSaoPaulo, somarDias } from './datas'
