import { describe, expect, it } from 'vitest'
import { filterProducts, isOpen, money, monthRange, parseMoney, productPresentation, schoolDate, totalItems, units } from '../src/utils/format'
import { items, makeService } from './fixtures'
describe('regras de apresentação', () => {
 it('converte reais sem aceitar valores inválidos', () => { expect(parseMoney('12,50')).toBe(1250);expect(parseMoney('12.50')).toBe(1250);for (const v of ['', '-2', '1e3', '1,234', '0x10']) expect(parseMoney(v)).toBeNull();expect(parseMoney('0')).toBe(0) })
 it('totaliza duas linhas como três unidades', () => { expect(totalItems(items)).toBe(2000);expect(units(items)).toBe(3);expect(money(2000)).toContain('20,00') })
 it('usa o fuso da escola na virada do mês', () => { expect(schoolDate(new Date('2026-10-01T01:00:00Z'))).toBe('2026-09-30');expect(monthRange('2026-12').end).toBe('2027-01-01T00:00:00-03:00') })
 it('fecha pedidos exatamente quinze minutos antes', () => { expect(isOpen('2026-09-30', 'manha', Date.parse('2026-09-30T09:04:59-03:00'))).toBe(true);expect(isOpen('2026-09-30', 'manha', Date.parse('2026-09-30T09:05:00-03:00'))).toBe(false);expect(isOpen('', 'manha')).toBe(false) })
 it('pesquisa sem acento e classifica desconhecidos como Outros', async () => { const products = await makeService().listProducts();expect(filterProducts(products, 'pao', 'Todos')).toHaveLength(1);expect(filterProducts(products, '', 'Bebidas')).toHaveLength(2);expect(productPresentation('Produto novo').categoria).toBe('Outros') })
})
