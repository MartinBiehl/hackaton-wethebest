import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Item, PortalService, Profile } from '../types'
import { portalService, explain } from '../services/api'
export const ServiceContext = createContext<PortalService>(portalService)
export const ProfileContext = createContext<Profile | null>(null)
export const useService = () => useContext(ServiceContext)
export function useProfile() { const profile = useContext(ProfileContext); if (!profile) throw new Error('Sessão necessária.'); return profile }
export function useQuery<T>(load: () => Promise<T>, key: string) {
 const ref = useRef(load); ref.current = load
 const [revision, setRevision] = useState(0)
 const [state, setState] = useState<{ key: string; data?: T; error?: string; loading: boolean }>({ key, loading: true })
 const reload = useCallback(() => setRevision(n => n + 1), [])
 useEffect(() => {
  let active = true
  setState({ key, loading: true })
  ref.current().then(data => { if (active) setState({ key, data, loading: false }) }, error => { if (active) setState({ key, error: explain(error), loading: false }) })
  return () => { active = false }
 }, [key, revision])
 return { ...(state.key === key ? state : { loading: true, data: undefined, error: undefined }), reload }
}
type CartState = { items: Item[]; setItems: (items: Item[]) => void; clear: () => void }
const CartContext = createContext<CartState | null>(null)
export function CartProvider({ userId, children }: { userId: string; children: ReactNode }) {
 const storageKey = 'icarla-cart:' + userId
 const [items, setItems] = useState<Item[]>(() => {
  try {
   const saved = JSON.parse(sessionStorage.getItem(storageKey) || '[]')
   if (Array.isArray(saved)) return saved.filter(i => typeof i.productId === 'string' && typeof i.nome === 'string' && Number.isSafeInteger(i.preco) && i.preco > 0 && Number.isInteger(i.quantidade) && i.quantidade > 0 && i.quantidade <= 99)
  } catch { /* O carrinho não é uma fonte financeira; dados inválidos são descartados. */ }
  return []
 })
 useEffect(() => { try { sessionStorage.setItem(storageKey, JSON.stringify(items)) } catch { /* A navegação ainda funciona sem armazenamento. */ } }, [items, storageKey])
 return <CartContext.Provider value={{ items, setItems, clear: () => setItems([]) }}>{children}</CartContext.Provider>
}
export function useCart() { const cart = useContext(CartContext); if (!cart) throw new Error('Carrinho indisponível.'); return cart }
