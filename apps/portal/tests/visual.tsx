// Entrada exclusiva de testes. Não integra o build do portal.
import ReactDOM from 'react-dom/client'
import App from '../src/App'
import { items, makeService } from './fixtures'
import '../src/styles/global.css'
if (import.meta.env.MODE !== 'visual') throw new Error('Entrada disponível somente para verificação visual.')
const params = new URLSearchParams(location.search)
const role = params.get('role') === 'responsavel' ? 'responsavel' : 'aluno'
if (!sessionStorage.getItem('icarla-cart:joao')) sessionStorage.setItem('icarla-cart:joao', JSON.stringify(items))
ReactDOM.createRoot(document.getElementById('root')!).render(<App service={makeService(role, params.get('orders') === '1')}/>)
