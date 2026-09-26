import { IconeBusca } from './Icones'

type Props = {
  valor: string
  aoMudar: (valor: string) => void
  placeholder: string
  rotulo?: string
}

export function CampoBusca({ valor, aoMudar, placeholder, rotulo = placeholder }: Props) {
  return (
    <label className="busca">
      <span className="sr-only">{rotulo}</span>
      <IconeBusca />
      <input type="search" value={valor} placeholder={placeholder} onChange={(e) => aoMudar(e.target.value)} />
    </label>
  )
}
