import { expect, test } from '@playwright/test'
const screens = [
 ['cardapio', 'aluno', '/aluno', 'Olá, João!'],
 ['pedido', 'aluno', '/aluno/pedido', 'Meu pedido'],
 ['retirada', 'aluno', '/aluno/retirada', 'Agendar pedido'],
 ['confirmado', 'aluno', '/aluno/pedido/IC-2048/confirmado', 'Pedido agendado!'],
 ['familia', 'responsavel', '/responsavel', 'Olá, Marina!'],
 ['extrato', 'responsavel', '/responsavel/alunos/lara/extrato', 'Extrato de Lara Monteiro'],
 ['limites', 'responsavel', '/responsavel/alunos/lara/limites', 'Lara Monteiro'],
]
for (const width of [360, 390, 768, 1440]) {
 test('sete telas responsivas em ' + width + 'px', async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 })
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  await page.route('**/*', route => { if (!route.request().url().startsWith('http://127.0.0.1:5174')) return route.abort();return route.continue() })
  for (const [name, role, path, heading] of screens) {
   await page.goto('/tests/visual.html?role=' + role + (name === 'confirmado' ? '&orders=1' : '') + '#' + path)
   await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
   await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
   if (name === 'retirada') await expect(page.getByRole('button', { name: 'Confirmar pedido' })).toBeDisabled()
   await page.screenshot({ path: info.outputPath(name + '-' + width + '.png'), fullPage: true })
  }
  expect(errors).toEqual([])
 })
}
