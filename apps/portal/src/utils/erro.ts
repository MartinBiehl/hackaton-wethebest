import { ErroNegocio } from '@wethebest/shared'

export function mensagemDeErro(erro: unknown): string {
  if (erro instanceof ErroNegocio) return erro.message
  return 'Não foi possível concluir. Verifique a conexão e tente novamente.'
}
