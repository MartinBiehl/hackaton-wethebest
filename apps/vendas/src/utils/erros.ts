// Códigos estáveis enviados em `detail` pelas funções do banco (ver docs/DATABASE.md).
const MENSAGENS: Record<string, string> = {
  papel_insuficiente: 'Sua conta não tem permissão para esta ação.',
  aluno_invalido: 'Aluno não encontrado.',
  itens_invalidos: 'Verifique os itens da venda.',
  produto_indisponivel: 'Um dos produtos não está mais disponível.',
  estoque_insuficiente: 'Estoque insuficiente para um dos produtos.',
  limite_mensal_excedido: 'O aluno atingiu o limite mensal definido pelo responsável.',
  limite_divida_excedido: 'A venda ultrapassaria o limite de dívida de R$ 250,00.',
  venda_invalida: 'Venda inválida ou já cancelada.',
  prazo_cancelamento_expirado: 'Esta venda tem mais de 24 horas e não pode mais ser cancelada.',
  valor_invalido: 'Valor inválido.',
}

// Erros do Postgres em escritas diretas nas tabelas (produtos, estoque).
const MENSAGENS_POR_SQLSTATE: Record<string, string> = {
  '23505': 'Já existe um cadastro com esse nome.',
  '23514': 'Algum valor informado é inválido.',
  '42501': 'Sua conta não tem permissão para esta ação.',
}

export class ErroNegocio extends Error {
  readonly codigo: string | null

  constructor(codigo: string | null, mensagem: string) {
    super(mensagem)
    this.codigo = codigo
  }
}

type ErroSupabase = { code?: string | null; details?: string | null; message: string }

export function erroDoSupabase(error: ErroSupabase): ErroNegocio {
  if (error.details && error.details in MENSAGENS) {
    return new ErroNegocio(error.details, MENSAGENS[error.details])
  }
  if (error.code && error.code in MENSAGENS_POR_SQLSTATE) {
    return new ErroNegocio(error.code, MENSAGENS_POR_SQLSTATE[error.code])
  }
  return new ErroNegocio(null, 'Não foi possível concluir. Tente novamente.')
}
