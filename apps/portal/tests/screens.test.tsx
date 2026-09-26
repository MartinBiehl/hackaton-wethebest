import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from '../src/App'
import { currentMonth } from '../src/utils/format'
import { items, makeService } from './fixtures'
function mount(route = '/aluno', service = makeService()) { location.hash = route; return render(<App service={service}/>) }
describe('portal iCarla', () => {
 it('mostra acesso necessário sem criar login', async () => { const service = makeService(); service.getProfile = async () => null; mount('/aluno', service);expect(await screen.findByText('Acesso necessário')).toBeInTheDocument();expect(screen.queryByLabelText(/senha/i)).not.toBeInTheDocument() })
 it('pesquisa, adiciona, altera e remove itens', async () => {
  const user = userEvent.setup();mount();await screen.findByText('Olá, João!')
  await user.type(screen.getByRole('searchbox'), 'pao');expect(screen.queryByRole('button', { name: 'Adicionar Coxinha de frango' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Adicionar Pão de queijo' }));await user.click(screen.getByRole('link', { name: 'Continuar' }))
  await screen.findByRole('heading', { name: 'Meu pedido' });await user.click(screen.getByLabelText('Aumentar Pão de queijo'));expect(screen.getByText('2 unidades')).toBeInTheDocument()
  await user.click(screen.getByLabelText('Remover Pão de queijo'));expect(screen.getByText('Seu pedido está vazio')).toBeInTheDocument()
 })
 it('não confirma nem debita sem serviço de pedidos', async () => {
  sessionStorage.setItem('icarla-cart:joao', JSON.stringify(items));const service = makeService();service.orders.confirm = vi.fn();mount('/aluno/retirada', service)
  expect(await screen.findByRole('heading', { name: 'Agendar pedido' })).toBeInTheDocument();expect(screen.getByRole('button', { name: 'Confirmar pedido' })).toBeDisabled();expect(service.orders.confirm).not.toHaveBeenCalled()
 })
 it('não inventa confirmação por URL', async () => { mount('/aluno/pedido/inventado/confirmado');expect(await screen.findByText('Nenhum pedido confirmado')).toBeInTheDocument() })
 it('renderiza confirmação retornada pelo serviço', async () => { mount('/aluno/pedido/IC-2048/confirmado', makeService('aluno', true));expect(await screen.findByText('Pedido agendado!')).toBeInTheDocument();expect(screen.getByText('IC-2048')).toBeInTheDocument() })
 it('bloqueia avanço quando o fiado ultrapassa R$ 250', async () => { const service = makeService();const read = service.getStudent;service.getStudent = async () => ({ ...(await read())!, saldo: -24000 });sessionStorage.setItem('icarla-cart:joao', JSON.stringify(items));mount('/aluno/pedido', service);expect(await screen.findByText(/ultrapassa o limite de fiado/)).toBeInTheDocument();expect(screen.getByRole('button', { name: 'Agendar pedido' })).toBeDisabled() })
 it('seleciona o filho correto e consulta o período completo', async () => {
  const user = userEvent.setup(), service = makeService('responsavel');const stmt = vi.spyOn(service, 'statement');mount('/responsavel', service)
  await screen.findByText('Olá, Marina!');await user.click(screen.getAllByRole('link', { name: 'Ver extrato' })[1]);expect(await screen.findByRole('heading', { name: 'Extrato de Murilo Monteiro' })).toBeInTheDocument()
  await waitFor(() => expect(stmt).toHaveBeenCalledWith('murilo', currentMonth(), 0));fireEvent.change(screen.getByLabelText('Mês do extrato'), { target: { value: '2026-01' } });await waitFor(() => expect(stmt).toHaveBeenCalledWith('murilo', '2026-01', 0))
 })
 it('salva limite e confirma crédito uma vez; falhas preservam o formulário', async () => {
  const user = userEvent.setup(), service = makeService('responsavel'), limit = vi.spyOn(service, 'setLimit');mount('/responsavel/alunos/lara/limites', service)
  await screen.findByLabelText('Novo limite mensal');await user.clear(screen.getByLabelText('Novo limite mensal'));await user.type(screen.getByLabelText('Novo limite mensal'), '150,50');await user.click(screen.getByRole('button', { name: 'Salvar limite' }))
  await waitFor(() => expect(limit).toHaveBeenCalledWith('lara', 15050));await screen.findByText('Limite mensal atualizado.')
  let rejectCredit: (reason: Error) => void = () => {}; service.addCredit = vi.fn(() => new Promise<void>((_, reject) => { rejectCredit = reject }))
  await user.type(screen.getByLabelText('Valor do crédito'), '50');await user.click(screen.getByRole('button', { name: 'Adicionar crédito' }));await user.click(screen.getByRole('button', { name: 'Confirmar crédito' }));expect(screen.getByRole('button', { name: 'Registrando…' })).toBeDisabled();expect(service.addCredit).toHaveBeenCalledTimes(1)
  await act(async () => rejectCredit(new Error('Sem conexão')));expect(screen.getByLabelText('Valor do crédito')).toHaveValue('50');expect(screen.getAllByText('Sem conexão').length).toBeGreaterThan(0)
 })
 it('mostra conta sem filhos e restringe rotas por papel', async () => { const service = makeService('responsavel');service.listStudents = async () => [];service.recentPurchases = async () => [];mount('/aluno', service);expect(await screen.findByText('Nenhum aluno vinculado')).toBeInTheDocument();expect(location.hash).toBe('#/responsavel') })
})
